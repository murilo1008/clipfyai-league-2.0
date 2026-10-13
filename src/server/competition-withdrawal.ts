import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import {
  canWithdrawFromCompetition,
  firstOpenDailyRankingDate,
  participatingApplicationStatuses,
  withdrawableCampaignStatuses,
  withdrawalBlockedByPostsMessage,
} from "@/lib/competition-participation";

export async function withdrawFromCompetition(
  db: PrismaClient,
  userId: string,
  campaignId: string,
) {
  return db.$transaction(async (tx) => {
    const profile = await tx.clipperProfile.findUnique({
      where: { userId },
      select: { id: true, user: { select: { role: true } } },
    });
    if (!profile || profile.user.role !== "CLIPPER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Acesso restrito aos clipadores.",
      });
    }

    // O mesmo lock é usado no envio de posts e no vínculo de contas.
    await tx.$executeRaw`
      SELECT id FROM "ClipperApplication"
      WHERE "campaignId" = ${campaignId} AND "clipperProfileId" = ${profile.id}
      FOR UPDATE
    `;
    const application = await tx.clipperApplication.findUnique({
      where: {
        campaignId_clipperProfileId: {
          campaignId,
          clipperProfileId: profile.id,
        },
      },
      include: {
        campaign: { select: { name: true, status: true, endDate: true } },
        socialAccounts: { select: { accountId: true } },
      },
    });
    if (!application) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Você não está inscrito nesta competição.",
      });
    }
    if (application.status === "WITHDRAWN") {
      return { success: true, message: "Você já saiu desta competição." };
    }

    const withdrawnAt = new Date();
    if (
      !canWithdrawFromCompetition(
        application.status,
        application.campaign.status,
        application.campaign.endDate,
        withdrawnAt,
      )
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Só é possível sair de uma inscrição ativa em uma competição ainda não encerrada.",
      });
    }
    // Considera todos os status, incluindo vídeos pendentes e inelegíveis.
    // A inscrição continua sob lock para serializar a saída com submitPosts.
    const postedVideoCount = await tx.clipPost.count({
      where: { applicationId: application.id },
    });
    if (postedVideoCount > 0) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: withdrawalBlockedByPostsMessage,
      });
    }

    const updated = await tx.clipperApplication.updateMany({
      where: {
        id: application.id,
        clipPosts: { none: {} },
        status: { in: participatingApplicationStatuses },
        campaign: {
          status: { in: withdrawableCampaignStatuses },
          endDate: { gt: withdrawnAt },
        },
      },
      data: { status: "WITHDRAWN", withdrawnAt },
    });
    if (updated.count !== 1) {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "A inscrição ou competição foi atualizada. Recarregue a página e tente novamente.",
      });
    }

    // Desvincula somente a competição: as contas e os posts do clipador permanecem.
    await tx.applicationSocialAccount.deleteMany({
      where: { applicationId: application.id },
    });
    const firstOpenDate = firstOpenDailyRankingDate(withdrawnAt);
    const withdrawnDailyEntries =
      await tx.dailyRankingEntry.updateManyAndReturn({
        where: {
          applicationId: application.id,
          isDisqualified: false,
          dailyRanking: { rankingDate: { gte: firstOpenDate } },
          dailyPrizeStatus: { not: "PAID" },
          dailyPrizePaid: false,
        },
        data: { isDisqualified: true },
        select: { id: true },
      });
    const withdrawnTopEntries =
      await tx.topClippersDailyRankingEntry.updateManyAndReturn({
        where: {
          applicationId: application.id,
          isDisqualified: false,
          ranking: { rankingDate: { gte: firstOpenDate } },
          prizeStatus: { not: "PAID" },
        },
        data: {
          isDisqualified: true,
          disqualificationReason: "Saída voluntária da competição",
          disqualifiedAt: withdrawnAt,
          disqualifiedBy: userId,
        },
        select: { id: true },
      });
    await tx.auditLog.create({
      data: {
        userId,
        action: "UPDATE",
        entityType: "ClipperApplication",
        entityId: application.id,
        campaignId,
        changes: {
          action: "clipper_withdraw_from_competition",
          previousStatus: application.status,
          status: "WITHDRAWN",
          withdrawnAt: withdrawnAt.toISOString(),
          campaignName: application.campaign.name,
          socialAccountIds: application.socialAccounts.map(
            (account) => account.accountId,
          ),
          dailyRankingEntryIds: withdrawnDailyEntries.map((entry) => entry.id),
          topClippersRankingEntryIds: withdrawnTopEntries.map(
            (entry) => entry.id,
          ),
        },
      },
    });
    return {
      success: true,
      message:
        "Você saiu da competição. Seu histórico e saldo foram preservados.",
    };
  });
}
