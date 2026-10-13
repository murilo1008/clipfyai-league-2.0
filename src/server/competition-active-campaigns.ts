import type { Prisma, PrismaClient } from "@prisma/client";

import { participatingApplicationStatuses } from "@/lib/competition-participation";
import { cachedQuery } from "@/server/memory-cache";

/** Campos das competições ativas usados no cronograma e em "Minhas Competições". */
const activeCampaignSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  status: true,
  startDate: true,
  endDate: true,
  platforms: true,
  requiredHashtags: true,
  coverImageUrl: true,
  prizeInfo: true,
  rankingMetricType: true,
  isProOnly: true,
  isPrivate: true,
  publishedAt: true,
  organization: {
    select: {
      id: true,
      name: true,
      logoUrl: true,
    },
  },
} satisfies Prisma.CampaignSelect;

/**
 * Competições ATIVAS (públicas e privadas) com participantes aprovados e posts
 * elegíveis — iguais para todos; o filtro de privadas por inscrição é aplicado
 * por quem chama. Cache de 60 s.
 */
export function getCachedActiveCampaigns(db: PrismaClient) {
  return cachedQuery("active-campaigns-with-counts", 60 * 1000, async () => {
    const campaigns = await db.campaign.findMany({
      where: { status: "ACTIVE" },
      select: activeCampaignSelect,
      orderBy: [{ startDate: "asc" }, { id: "asc" }],
    });
    const campaignIds = campaigns.map((campaign) => campaign.id);
    const [participantCounts, postCounts] =
      campaignIds.length > 0
        ? await Promise.all([
            db.clipperApplication.groupBy({
              by: ["campaignId"],
              where: { campaignId: { in: campaignIds }, status: "APPROVED" },
              _count: { id: true },
            }),
            db.clipPost.groupBy({
              by: ["campaignId"],
              where: { campaignId: { in: campaignIds }, status: "ELIGIBLE" },
              _count: { id: true },
            }),
          ])
        : [[], []];
    return {
      campaigns,
      participantsByCampaign: new Map(
        participantCounts.map((row) => [row.campaignId, row._count.id]),
      ),
      eligiblePostsByCampaign: new Map(
        postCounts.map((row) => [row.campaignId, row._count.id]),
      ),
    };
  });
}

/** Competições ativas visíveis ao clipador: públicas + privadas em que participa. */
export async function getVisibleActiveCampaigns(
  db: PrismaClient,
  clipperProfileId: string | null,
) {
  const [active, privateEnrolled] = await Promise.all([
    getCachedActiveCampaigns(db),
    clipperProfileId
      ? db.clipperApplication.findMany({
          where: {
            clipperProfileId,
            status: { in: participatingApplicationStatuses },
            campaign: { isPrivate: true, status: "ACTIVE" },
          },
          select: { campaignId: true },
        })
      : Promise.resolve([]),
  ]);
  const privateEnrolledIds = new Set(
    privateEnrolled.map((application) => application.campaignId),
  );
  return {
    ...active,
    // Ordem: startDate asc
    campaigns: active.campaigns.filter(
      (campaign) => !campaign.isPrivate || privateEnrolledIds.has(campaign.id),
    ),
  };
}
