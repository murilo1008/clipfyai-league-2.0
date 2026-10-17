import { type PrismaClient, Prisma, RankingMetricType } from "@prisma/client";
import {
  loadMonthlyScoreMultiplierCuts,
  type MonthlyScoreMultiplierCut,
} from "@/lib/clipper-discipline/score-multiplier-queries";
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
  /**
   * Posição de TODOS os clipadores ranqueados (não só o top `rows`), na mesma
   * ordem/desempate de `rows`. Permite exibir a posição real de quem está fora do top.
   */
  positionByClipperProfileId: Map<string, number>;
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

type MonthlyTotals = {
  applicationId: string;
  clipperProfileId: string;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  postsCount: number;
};

type MonthlyScoredTotals = MonthlyTotals & {
  engagementRate: number;
  rankingScore: number;
};

/** Redutor de advertência: tira das somas o que os posts com redutor perdem. */
function applyScoreMultiplierCuts(
  totals: MonthlyTotals[],
  cuts: Map<string, MonthlyScoreMultiplierCut>,
): MonthlyTotals[] {
  if (cuts.size === 0) return totals;
  return totals.map((row) => {
    const cut = cuts.get(row.applicationId);
    if (!cut) return row;
    return {
      ...row,
      totalViews: Math.max(0, row.totalViews - cut.views),
      totalLikes: Math.max(0, row.totalLikes - cut.likes),
      totalComments: Math.max(0, row.totalComments - cut.comments),
      totalShares: Math.max(0, row.totalShares - cut.shares),
      totalSaves: Math.max(0, row.totalSaves - cut.saves),
    };
  });
}

/** Mesma ordenação/desempate do ranking mensal do ADMIN (sort estável). */
function sortMonthlyTotals(
  totals: MonthlyTotals[],
  metricType: RankingMetricType,
): MonthlyScoredTotals[] {
  const scored = totals.map((row) => ({
    ...row,
    engagementRate: calculateEngagementRate(
      row.totalViews,
      row.totalLikes,
      row.totalComments,
      row.totalShares,
      row.totalSaves,
    ),
    rankingScore: calculateRankingScore(
      metricType === RankingMetricType.VIEWS_X_ENGAGEMENT
        ? "VIEWS_X_ENGAGEMENT"
        : "VIEWS",
      row.totalViews,
      row.totalLikes,
      row.totalComments,
      row.totalShares,
      row.totalSaves,
    ),
  }));

  return metricType === RankingMetricType.VIEWS_X_ENGAGEMENT
    ? scored.sort((a, b) =>
        b.rankingScore !== a.rankingScore
          ? b.rankingScore - a.rankingScore
          : b.totalViews - a.totalViews,
      )
    : scored.sort((a, b) => b.totalViews - a.totalViews);
}

/**
 * Carrega nome/foto/clã só das inscrições do top (antes: perfil completo de
 * todas as inscrições aprovadas da campanha).
 */
async function hydrateMonthlyRows(
  db: PrismaClient,
  sorted: MonthlyScoredTotals[],
  topCount: number,
): Promise<MonthlyLeaderboardRow[]> {
  const top = sorted.slice(0, topCount);
  if (top.length === 0) return [];

  const applications = await db.clipperApplication.findMany({
    where: { id: { in: top.map((row) => row.applicationId) } },
    select: {
      id: true,
      clipperProfile: {
        select: {
          fullName: true,
          artisticName: true,
          user: { select: { imageUrl: true } },
          clan: { select: { tag: true, emoji: true, emojiColor: true } },
        },
      },
    },
  });
  const profileByApplicationId = new Map(
    applications.map((app) => [app.id, app.clipperProfile]),
  );

  const rows: MonthlyLeaderboardRow[] = [];
  for (const row of top) {
    const profile = profileByApplicationId.get(row.applicationId);
    if (!profile) continue;
    rows.push({
      position: rows.length + 1,
      clipperProfileId: row.clipperProfileId,
      applicationId: row.applicationId,
      monthlyRankingEntryId: null,
      clipperName: getFirstName(profile.fullName) || "Clipador",
      clipperUsername: getClipperRankingDisplayName(profile),
      clipperImageUrl: profile.user?.imageUrl ?? null,
      totalViews: row.totalViews,
      totalLikes: row.totalLikes,
      totalComments: row.totalComments,
      totalShares: row.totalShares,
      totalSaves: row.totalSaves,
      postsCount: row.postsCount,
      engagementRate: row.engagementRate,
      rankingScore: row.rankingScore,
      previousPosition: null,
      clanTag: profile.clan?.tag ?? null,
      clanEmoji: profile.clan?.emoji ?? null,
      clanEmojiColor: profile.clan?.emojiColor ?? null,
    });
  }
  return rows;
}

/** Cutoff do ranking de campanha concluída: endDate + 3h30min. */
export function getMonthlyRankingCutoff(endDate: Date) {
  return new Date(new Date(endDate).getTime() + (3 * 60 + 30) * 60 * 1000);
}

/**
 * Ranking mensal por clipador.
 *
 * FAST PATH (campanha ATIVA): usa ClipPost.views diretamente via groupBy —
 * dados já denormalizados, sem precisar consultar ClipPostMetrics.
 *
 * HISTORICAL PATH (campanha CONCLUÍDA): usa o último snapshot por post em
 * ClipPostMetrics até endDate + 3h30min (LATERAL por post no índice
 * (clipPostId, collectedAt, views)), somado por inscrição no SQL.
 *
 * Só as inscrições do top são hidratadas com perfil; `positionByClipperProfileId`
 * traz a posição de todos os ranqueados.
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
    positionByClipperProfileId: new Map(),
  });

  const isActive = campaign.status === "ACTIVE" || campaign.status === "PAUSED";

  const buildResult = async (
    totals: MonthlyTotals[],
    cuts: Map<string, MonthlyScoreMultiplierCut>,
  ): Promise<MonthlyLeaderboardResult> => {
    const sorted = sortMonthlyTotals(applyScoreMultiplierCuts(totals, cuts), metricType);
    const rows = await hydrateMonthlyRows(db, sorted, monthlyTopCount);
    const positionByClipperProfileId = new Map<string, number>();
    sorted.forEach((row, index) => {
      if (!positionByClipperProfileId.has(row.clipperProfileId)) {
        positionByClipperProfileId.set(row.clipperProfileId, index + 1);
      }
    });
    return { ...emptyResult(), rows, positionByClipperProfileId };
  };

  // ============================================================
  // FAST PATH: campanha ativa — ClipPost.views já está atualizado
  // ============================================================
  if (isActive) {
    const [postGroups, applications, cuts] = await Promise.all([
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
        select: { id: true, clipperProfileId: true },
      }),
      loadMonthlyScoreMultiplierCuts(db, { campaignId }),
    ]);
    const appMap = new Map(applications.map((a) => [a.id, a]));
    const totals: MonthlyTotals[] = [];

    for (const group of postGroups) {
      if (!group.applicationId) continue;
      const app = appMap.get(group.applicationId);
      if (!app) continue;

      totals.push({
        applicationId: app.id,
        clipperProfileId: app.clipperProfileId,
        totalViews: Number(group._sum.views ?? 0),
        totalLikes: group._sum.likes ?? 0,
        totalComments: group._sum.comments ?? 0,
        totalShares: group._sum.shares ?? 0,
        totalSaves: group._sum.saves ?? 0,
        postsCount: group._count.id,
      });
    }

    return buildResult(totals, cuts);
  }

  // ============================================================
  // HISTORICAL PATH: campanha concluída — usar ClipPostMetrics
  // ============================================================
  const cutoffAtCompetitionEnd = getMonthlyRankingCutoff(campaign.endDate);

  type MetricAggRow = {
    applicationId: string | null;
    views: bigint | null;
    likes: bigint | number | null;
    comments: bigint | number | null;
    shares: bigint | number | null;
    saves: bigint | number | null;
    postsCount: bigint | number;
  };

  // `OFFSET 0` isola a lista de posts elegíveis da campanha: o LATERAL faz uma
  // busca por post no índice em vez de varrer todo o ClipPostMetrics até o corte.
  // `ORDER BY MIN(p.id)` reproduz a ordem de inserção do antigo DISTINCT ON
  // (por clipPostId), que define o desempate do sort estável.
  const [metricRows, applications, cuts] = await Promise.all([
    db.$queryRaw<MetricAggRow[]>`
      SELECT
        p."applicationId",
        SUM(m."views")::bigint AS "views",
        SUM(m."likes")::bigint AS "likes",
        SUM(m."comments")::bigint AS "comments",
        SUM(m."shares")::bigint AS "shares",
        SUM(COALESCE(m."saves", 0))::bigint AS "saves",
        COUNT(*)::bigint AS "postsCount"
      FROM (
        SELECT cp."id", cp."applicationId"
        FROM "ClipPost" cp
        WHERE cp."campaignId" = ${campaignId}
          AND cp."status" = 'ELIGIBLE'
        OFFSET 0
      ) p
      CROSS JOIN LATERAL (
        SELECT
          cpm."views",
          cpm."likes",
          cpm."comments",
          cpm."shares",
          cpm."saves"
        FROM "ClipPostMetrics" cpm
        WHERE cpm."clipPostId" = p."id"
          AND cpm."collectedAt" <= ${cutoffAtCompetitionEnd}::timestamp
        ORDER BY cpm."collectedAt" DESC
        LIMIT 1
      ) m
      GROUP BY p."applicationId"
      ORDER BY MIN(p."id")
    `,
    db.clipperApplication.findMany({
      where: { campaignId, status: "APPROVED" },
      select: { id: true, clipperProfileId: true },
    }),
    loadMonthlyScoreMultiplierCuts(db, {
      campaignId,
      cutoff: cutoffAtCompetitionEnd,
    }),
  ]);
  if (metricRows.length === 0) return emptyResult();

  const appMap = new Map(applications.map((a) => [a.id, a]));
  const totals: MonthlyTotals[] = [];

  for (const row of metricRows) {
    if (!row.applicationId) continue;
    const app = appMap.get(row.applicationId);
    if (!app) continue;
    totals.push({
      applicationId: app.id,
      clipperProfileId: app.clipperProfileId,
      totalViews: Number(row.views ?? 0),
      totalLikes: Number(row.likes ?? 0),
      totalComments: Number(row.comments ?? 0),
      totalShares: Number(row.shares ?? 0),
      totalSaves: Number(row.saves ?? 0),
      postsCount: Number(row.postsCount),
    });
  }

  return buildResult(totals, cuts);
}
