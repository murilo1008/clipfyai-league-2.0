import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import {
  canRejoinCompetition,
  withdrawableCampaignStatuses,
} from "@/lib/competition-participation";

type Reenrollment = {
  campaignId: string;
  clipperProfileId: string;
  actorUserId: string;
  socialAccountIds: string[];
  byAdmin?: boolean;
};

export async function reenrollWithdrawnApplication(
  db: PrismaClient,
  input: Reenrollment,
) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT id FROM "ClipperApplication"
      WHERE "campaignId" = ${input.campaignId} AND "clipperProfileId" = ${input.clipperProfileId}
      FOR UPDATE
    `;
    const application = await tx.clipperApplication.findUnique({
      where: {
        campaignId_clipperProfileId: {
          campaignId: input.campaignId,
          clipperProfileId: input.clipperProfileId,
        },
      },
      include: {
        campaign: {
          select: {
            status: true,
            startDate: true,
            endDate: true,
            isPrivate: true,
            isProOnly: true,
            requiresApproval: true,
          },
        },
        clipperProfile: {
          select: {
            userId: true,
            user: { select: { role: true, subscriptionStatus: true } },
          },
        },
      },
    });
    if (!application) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Inscrição não encontrada.",
      });
    }
    if (input.byAdmin) {
      const actor = await tx.user.findUnique({
        where: { id: input.actorUserId },
        select: { role: true },
      });
      if (actor?.role !== "ADMIN" || !application.campaign.isPrivate) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "A reinscrição administrativa exige acesso de administrador a uma competição privada.",
        });
      }
    } else if (
      application.clipperProfile.userId !== input.actorUserId ||
      application.clipperProfile.user.role !== "CLIPPER" ||
      application.campaign.isPrivate
    ) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Você não pode se reinscrever nesta competição.",
      });
    }
    if (
      !input.byAdmin &&
      application.campaign.isProOnly &&
      application.clipperProfile.user.subscriptionStatus !== "ACTIVE"
    ) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Esta competição é exclusiva para assinantes PRO.",
      });
    }

    const now = new Date();
    if (
      !canRejoinCompetition(
        application.status,
        application.campaign.status,
        application.campaign.startDate,
        application.campaign.endDate,
        now,
      )
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "A reinscrição após a saída só é permitida antes do início da competição.",
      });
    }
    const uniqueAccounts = [...new Set(input.socialAccountIds)];
    const accounts = await tx.socialAccount.findMany({
      where: {
        id: { in: uniqueAccounts },
        clipperProfileId: input.clipperProfileId,
      },
      select: { id: true },
    });
    if (
      (!input.byAdmin && uniqueAccounts.length === 0) ||
      accounts.length !== uniqueAccounts.length
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Selecione contas sociais que pertençam ao clipador.",
      });
    }

    const needsApproval =
      input.byAdmin || application.campaign.requiresApproval;
    const originalForm =
      application.formData &&
      typeof application.formData === "object" &&
      !Array.isArray(application.formData)
        ? application.formData
        : {};
    const updated = await tx.clipperApplication.updateMany({
      where: {
        id: application.id,
        status: "WITHDRAWN",
        campaign: {
          status: { in: withdrawableCampaignStatuses },
          startDate: { gt: now },
          endDate: { gt: now },
        },
      },
      data: {
        status: needsApproval ? "PENDING" : "APPROVED",
        withdrawnAt: null,
        approvedAt: needsApproval ? null : now,
        reviewedAt: null,
        reviewedBy: null,
        reviewNotes: null,
        rejectionReason: null,
        autoDecision: needsApproval ? "MANUAL_REVIEW" : "APPROVE",
        formData: {
          ...originalForm,
          reenrolledAt: now.toISOString(),
          reenrolledBy: input.actorUserId,
        },
      },
    });
    if (updated.count !== 1) {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "A inscrição ou competição mudou. Recarregue a página e tente novamente.",
      });
    }
    await tx.applicationSocialAccount.deleteMany({
      where: { applicationId: application.id },
    });
    if (uniqueAccounts.length) {
      await tx.applicationSocialAccount.createMany({
        data: uniqueAccounts.map((accountId) => ({
          applicationId: application.id,
          accountId,
        })),
      });
    }

    const lastWithdrawal = await tx.auditLog.findFirst({
      where: {
        entityType: "ClipperApplication",
        entityId: application.id,
        changes: {
          path: ["action"],
          equals: "clipper_withdraw_from_competition",
        },
      },
      orderBy: { createdAt: "desc" },
      select: { changes: true },
    });
    const changes = lastWithdrawal?.changes;
    const recordedIds = (key: string): string[] => {
      if (!changes || typeof changes !== "object" || Array.isArray(changes))
        return [];
      const ids = changes[key];
      return Array.isArray(ids)
        ? ids.filter((id): id is string => typeof id === "string")
        : [];
    };
    // Restaura apenas as exclusões causadas pela saída, mantendo punições manuais e pagamentos.
    await tx.dailyRankingEntry.updateMany({
      where: {
        id: { in: recordedIds("dailyRankingEntryIds") },
        applicationId: application.id,
        isDisqualified: true,
        dailyPrizeStatus: { not: "PAID" },
        dailyPrizePaid: false,
        clipPost: { status: "ELIGIBLE" },
      },
      data: { isDisqualified: false },
    });
    await tx.topClippersDailyRankingEntry.updateMany({
      where: {
        id: { in: recordedIds("topClippersRankingEntryIds") },
        applicationId: application.id,
        isDisqualified: true,
        prizeStatus: { not: "PAID" },
        disqualificationReason: "Saída voluntária da competição",
        disqualifiedAt: application.withdrawnAt,
      },
      data: {
        isDisqualified: false,
        disqualificationReason: null,
        disqualifiedAt: null,
        disqualifiedBy: null,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: input.actorUserId,
        action: "UPDATE",
        entityType: "ClipperApplication",
        entityId: application.id,
        campaignId: input.campaignId,
        changes: {
          action: "reenroll_before_competition_start",
          previousStatus: "WITHDRAWN",
          previousWithdrawnAt: application.withdrawnAt?.toISOString() ?? null,
          status: needsApproval ? "PENDING" : "APPROVED",
          reenrolledAt: now.toISOString(),
          socialAccountIds: uniqueAccounts,
        },
      },
    });
    return tx.clipperApplication.findUniqueOrThrow({
      where: { id: application.id },
      include: {
        clipperProfile: { select: { fullName: true, artisticName: true } },
      },
    });
  });
}
