import { type PrismaClient, Prisma, RankingMetricType } from "@prisma/client";
import {
  calculateEngagementRate,
  calculateRankingScore,
} from "@/lib/ranking-helpers";

// Privacidade: o ranking público nunca expõe o nome completo do clipador.
function getFirstName(name?: string | null) {
  return name?.trim().split(/\s+/)[0] || "";
}

function getClipperRankingDisplayName(profile: {
  artisticName?: string | null;
  fullName?: string | null;
}) {
  return (
    profile.artisticName?.trim() || getFirstName(profile.fullName) || "Clipador"
  );
}

export type MonthlyLeaderboardRow = {
  position: number;
  clipperProfileId: string;
  applicationId: string;
  monthlyRankingEntryId: string | null;
  clipperName: string;
  clipperUsername: string;
  clipperImageUrl: string | null;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  postsCount: number;
  engagementRate: number;
  rankingScore: number;
  previousPosition: number | null;
  clanTag: string | null;
  clanEmoji: string | null;
  clanEmojiColor: string | null;
};

export type MonthlyLeaderboardResult = {
  monthPeriod: string;
  monthlyRankingId: string | null;
  windowStart: Date | null;
  windowEnd: Date | null;
  metricType: RankingMetricType;
  monthlyTopCount: number;
  monthlyPrizeTable: unknown;
  rows: MonthlyLeaderboardRow[];
};

type CampaignForMonthly = {
  endDate: Date;
  status?: string | null;
  rankingMetricType: RankingMetricType | null;
  activeRankingRule: {
    monthlyTopCount: number | null;
    monthlyPrizeTable: unknown;
  } | null;
};

/**
 * Ranking mensal por clipador.
 *
 * FAST PATH (campanha ATIVA): usa ClipPost.views diretamente via groupBy —
 * dados já denormalizados, sem precisar consultar ClipPostMetrics.
 *
 * HISTORICAL PATH (campanha CONCLUÍDA): usa o último snapshot por post em
 * ClipPostMetrics até endDate + 3h30min, via single JOIN query.
 */
export async function computeMonthlyLeaderboard(
  db: PrismaClient,
  campaignId: string,
  campaignData?: CampaignForMonthly,
): Promise<MonthlyLeaderboardResult | null> {
  const campaign =
    campaignData ??
    (await db.campaign.findUnique({
      where: { id: campaignId },
      select: {
        endDate: true,
        status: true,
        rankingMetricType: true,
        activeRankingRule: {
          select: { monthlyTopCount: true, monthlyPrizeTable: true },
        },
      },
    }));

  if (!campaign?.activeRankingRule) return null;

  const rule = campaign.activeRankingRule;
  const metricType = campaign.rankingMetricType ?? RankingMetricType.VIEWS;
  const monthlyTopCount = rule.monthlyTopCount ?? 15;

  const emptyResult = (): MonthlyLeaderboardResult => ({
    monthPeriod: "",
    monthlyRankingId: null,
    windowStart: null,
    windowEnd: null,
    metricType,
    monthlyTopCount,
    monthlyPrizeTable: rule.monthlyPrizeTable,
    rows: [],
  });

  const isActive = campaign.status === "ACTIVE" || campaign.status === "PAUSED";

  // ============================================================
  // FAST PATH: campanha ativa — ClipPost.views já está atualizado
  // ============================================================
  if (isActive) {
    const [postGroups, applications] = await Promise.all([
      db.clipPost.groupBy({
        by: ["applicationId"],
        where: { campaignId, status: "ELIGIBLE" },
        _sum: {
          views: true,
          likes: true,
          comments: true,
          shares: true,
          saves: true,
        },
        _count: { id: true },
      }),
      db.clipperApplication.findMany({
        where: { campaignId, status: "APPROVED" },
        include: {
          clipperProfile: {
            include: {
              user: { select: { imageUrl: true } },
              clan: { select: { tag: true, emoji: true, emojiColor: true } },
            },
          },
        },
      }),
    ]);
    const appMap = new Map(applications.map((a) => [a.id, a]));
    const rowsUnsorted: Omit<MonthlyLeaderboardRow, "position">[] = [];

    for (const group of postGroups) {
      if (!group.applicationId) continue;
      const app = appMap.get(group.applicationId);
      if (!app) continue;

      const totalViews = Number(group._sum.views ?? 0);
      const totalLikes = group._sum.likes ?? 0;
      const totalComments = group._sum.comments ?? 0;
      const totalShares = group._sum.shares ?? 0;
      const totalSaves = group._sum.saves ?? 0;
      const postsCount = group._count.id;

      rowsUnsorted.push({
        clipperProfileId: app.clipperProfileId,
        applicationId: app.id,
        monthlyRankingEntryId: null,
        clipperName: getFirstName(app.clipperProfile.fullName) || "Clipador",
        clipperUsername: getClipperRankingDisplayName(app.clipperProfile),
        clipperImageUrl: app.clipperProfile.user?.imageUrl ?? null,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        totalSaves,
        postsCount,
        engagementRate: calculateEngagementRate(
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
          totalSaves,
        ),
        rankingScore: calculateRankingScore(
          metricType === RankingMetricType.VIEWS_X_ENGAGEMENT
            ? "VIEWS_X_ENGAGEMENT"
            : "VIEWS",
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
          totalSaves,
        ),
        previousPosition: null,
        clanTag: app.clipperProfile.clan?.tag ?? null,
        clanEmoji: app.clipperProfile.clan?.emoji ?? null,
        clanEmojiColor: app.clipperProfile.clan?.emojiColor ?? null,
      });
    }

    const sorted =
      metricType === RankingMetricType.VIEWS_X_ENGAGEMENT
        ? [...rowsUnsorted].sort((a, b) =>
            b.rankingScore !== a.rankingScore
              ? b.rankingScore - a.rankingScore
              : b.totalViews - a.totalViews,
          )
        : [...rowsUnsorted].sort((a, b) => b.totalViews - a.totalViews);

    const rows: MonthlyLeaderboardRow[] = sorted
      .slice(0, monthlyTopCount)
      .map((r, i) => ({ position: i + 1, ...r }));

    return { ...emptyResult(), rows };
  }

  // ============================================================
  // HISTORICAL PATH: campanha concluída — usar ClipPostMetrics
  // ============================================================
  const competitionEnd = new Date(campaign.endDate);
  const cutoffAtCompetitionEnd = new Date(
    competitionEnd.getTime() + (3 * 60 + 30) * 60 * 1000,
  );

  type MetricRow = {
    clipPostId: string;
    applicationId: string | null;
    views: bigint;
    likes: number;
    comments: number;
    shares: number;
    saves: number | null;
  };

  const [metricRows, applications] = await Promise.all([
    db.$queryRaw<MetricRow[]>`
      SELECT DISTINCT ON (cpm."clipPostId")
        cpm."clipPostId",
        cp."applicationId",
        cpm."views",
        cpm."likes",
        cpm."comments",
        cpm."shares",
        cpm."saves"
      FROM "ClipPostMetrics" cpm
      INNER JOIN "ClipPost" cp ON cp."id" = cpm."clipPostId"
      WHERE cp."campaignId" = ${campaignId}
        AND cp."status" = 'ELIGIBLE'
        AND cpm."collectedAt" <= ${cutoffAtCompetitionEnd}
      ORDER BY cpm."clipPostId", cpm."collectedAt" DESC
    `,
    db.clipperApplication.findMany({
      where: { campaignId, status: "APPROVED" },
      include: {
        clipperProfile: {
          include: {
            user: { select: { imageUrl: true } },
            clan: { select: { tag: true, emoji: true, emojiColor: true } },
          },
        },
      },
    }),
  ]);
  if (metricRows.length === 0) return emptyResult();

  const appMap = new Map(applications.map((a) => [a.id, a]));
  const aggByApplicationId = new Map<
    string,
    {
      totalViews: number;
      totalLikes: number;
      totalComments: number;
      totalShares: number;
      totalSaves: number;
      postsCount: number;
    }
  >();

  for (const row of metricRows) {
    if (!row.applicationId) continue;
    const current = aggByApplicationId.get(row.applicationId) ?? {
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalSaves: 0,
      postsCount: 0,
    };
    current.totalViews += Number(row.views);
    current.totalLikes += row.likes;
    current.totalComments += row.comments;
    current.totalShares += row.shares;
    current.totalSaves += row.saves ?? 0;
    current.postsCount += 1;
    aggByApplicationId.set(row.applicationId, current);
  }

  const rowsUnsorted: Omit<MonthlyLeaderboardRow, "position">[] = [];

  for (const [applicationId, agg] of aggByApplicationId) {
    const app = appMap.get(applicationId);
    if (!app) continue;
    const {
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      totalSaves,
      postsCount,
    } = agg;
    rowsUnsorted.push({
      clipperProfileId: app.clipperProfileId,
      applicationId: app.id,
      monthlyRankingEntryId: null,
      clipperName: getFirstName(app.clipperProfile.fullName) || "Clipador",
      clipperUsername: getClipperRankingDisplayName(app.clipperProfile),
      clipperImageUrl: app.clipperProfile.user?.imageUrl ?? null,
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      totalSaves,
      postsCount,
      engagementRate: calculateEngagementRate(
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        totalSaves,
      ),
      rankingScore: calculateRankingScore(
        metricType === RankingMetricType.VIEWS_X_ENGAGEMENT
          ? "VIEWS_X_ENGAGEMENT"
          : "VIEWS",
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        totalSaves,
      ),
      previousPosition: null,
      clanTag: app.clipperProfile.clan?.tag ?? null,
      clanEmoji: app.clipperProfile.clan?.emoji ?? null,
      clanEmojiColor: app.clipperProfile.clan?.emojiColor ?? null,
    });
  }

  const sorted =
    metricType === RankingMetricType.VIEWS_X_ENGAGEMENT
      ? [...rowsUnsorted].sort((a, b) =>
          b.rankingScore !== a.rankingScore
            ? b.rankingScore - a.rankingScore
            : b.totalViews - a.totalViews,
        )
      : [...rowsUnsorted].sort((a, b) => b.totalViews - a.totalViews);

  const rows: MonthlyLeaderboardRow[] = sorted
    .slice(0, monthlyTopCount)
    .map((r, i) => ({ position: i + 1, ...r }));

  return { ...emptyResult(), rows };
}
