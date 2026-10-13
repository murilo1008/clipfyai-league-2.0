import type { ApplicationStatus, CampaignStatus, Prisma } from "@prisma/client";

export const withdrawalBlockedByPostsMessage =
  "Você só pode sair de uma competição se ainda não enviou nenhum vídeo.";

export const participatingApplicationStatuses = [
  "PENDING",
  "UNDER_REVIEW",
  "APPROVED",
] satisfies ApplicationStatus[];

export const withdrawableCampaignStatuses = [
  "SCHEDULED",
  "ACTIVE",
  "PAUSED",
] satisfies CampaignStatus[];

export function isParticipatingApplication(status: string | null | undefined) {
  return participatingApplicationStatuses.some(
    (candidate) => candidate === status,
  );
}

export function canWithdrawFromCompetition(
  applicationStatus: string | null | undefined,
  campaignStatus: string,
  endDate: string | Date,
  now = new Date(),
) {
  return (
    isParticipatingApplication(applicationStatus) &&
    withdrawableCampaignStatuses.some((status) => status === campaignStatus) &&
    new Date(endDate).getTime() > now.getTime()
  );
}

export function canRejoinCompetition(
  applicationStatus: string | null | undefined,
  campaignStatus: string,
  startDate: string | Date,
  endDate: string | Date,
  now = new Date(),
) {
  return (
    applicationStatus === "WITHDRAWN" &&
    withdrawableCampaignStatuses.some((status) => status === campaignStatus) &&
    new Date(startDate).getTime() > now.getTime() &&
    new Date(endDate).getTime() > now.getTime()
  );
}

/** Uma desistência não altera períodos que já haviam encerrado. */
export function rankingApplicationWhere(
  cutoff: Date,
): Prisma.ClipperApplicationWhereInput {
  return {
    OR: [
      { status: "APPROVED" },
      { status: "WITHDRAWN", withdrawnAt: { gte: cutoff } },
    ],
  };
}

/** O ranking D usa a janela [D-1 20:00 UTC, D 20:00 UTC). */
export function firstOpenDailyRankingDate(now: Date) {
  const day = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  if (now.getUTCHours() >= 20) day.setUTCDate(day.getUTCDate() + 1);
  return day;
}
