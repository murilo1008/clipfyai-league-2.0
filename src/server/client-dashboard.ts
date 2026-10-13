import { Prisma, type Platform, type PrismaClient } from "@prisma/client";

import { calculateEngagementRate } from "@/lib/ranking-helpers";
import { cachedQuery } from "@/server/memory-cache";

/**
 * Métricas do dashboard do cliente, agregadas no banco por competição.
 *
 * Os números de uma competição são iguais para todos que podem vê-la, então
 * cada competição fica 60 s em cache (chave com o id). Quem chama já filtrou
 * as competições pelo cliente logado: o cache nunca decide acesso.
 */
const CLIENT_DASHBOARD_TTL_MS = 60_000;

// ⚠️ FILTRO ESPECIAL: Competição Tarcísio De Freitas - Novembro
// Apenas posts a partir de 07/11/2025 22:00 (horário de Brasília)
export const TARCISIO_CAMPAIGN_SLUG = "tarcisio-de-freitas-novembro";
export const TARCISIO_START_DATE = new Date("2025-11-07T22:00:00-03:00");

export type DashboardCampaignRef = {
  id: string;
  slug: string;
  startDate: Date;
  endDate: Date;
};

function postedAtFilter(campaign: Pick<DashboardCampaignRef, "slug">) {
  return campaign.slug === TARCISIO_CAMPAIGN_SLUG
    ? Prisma.sql`AND "postedAt" >= ${TARCISIO_START_DATE}::timestamp`
    : Prisma.empty;
}

/** Mesmo filtro em formato Prisma, para as consultas que não são SQL cru. */
function postedAtWhere(campaign: Pick<DashboardCampaignRef, "slug">) {
  return campaign.slug === TARCISIO_CAMPAIGN_SLUG
    ? { postedAt: { gte: TARCISIO_START_DATE } }
    : {};
}

type PlatformTotalsRow = {
  platform: Platform;
  /** Posts de qualquer status. */
  allPosts: number;
  /** Posts elegíveis. */
  posts: number;
  views: bigint;
  likes: bigint;
  comments: bigint;
  shares: bigint;
  saves: bigint;
  /** Views dos posts elegíveis criados nos últimos 7 dias. */
  recentViews: bigint;
};

export type CampaignTotals = {
  totalPosts: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  engagementRate: number;
  recentViews: number;
  platformStats: Array<{
    platform: Platform;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    postsCount: number;
  }>;
};

/** Início da janela de "crescimento nos últimos 7 dias". */
export function recentViewsStartDate(now = new Date()) {
  const start = new Date(now);
  start.setDate(start.getDate() - 7);
  return start;
}

/**
 * Totais da competição em uma leitura de ClipPost: a contagem de posts usa
 * todos os status, as métricas só os elegíveis (mesma regra de antes).
 */
async function queryCampaignTotals(
  db: PrismaClient,
  campaign: Pick<DashboardCampaignRef, "id" | "slug">,
): Promise<CampaignTotals> {
  const rows = await db.$queryRaw<PlatformTotalsRow[]>`
    SELECT
      platform,
      COUNT(*)::int AS "allPosts",
      COUNT(*) FILTER (WHERE status = 'ELIGIBLE')::int AS posts,
      COALESCE(SUM(views) FILTER (WHERE status = 'ELIGIBLE'), 0)::bigint AS views,
      COALESCE(SUM(likes) FILTER (WHERE status = 'ELIGIBLE'), 0)::bigint AS likes,
      COALESCE(SUM(comments) FILTER (WHERE status = 'ELIGIBLE'), 0)::bigint AS comments,
      COALESCE(SUM(shares) FILTER (WHERE status = 'ELIGIBLE'), 0)::bigint AS shares,
      COALESCE(SUM(saves) FILTER (WHERE status = 'ELIGIBLE'), 0)::bigint AS saves,
      COALESCE(
        SUM(views) FILTER (
          WHERE status = 'ELIGIBLE'
            AND "createdAt" >= ${recentViewsStartDate()}::timestamp
        ),
        0
      )::bigint AS "recentViews"
    FROM "ClipPost"
    WHERE "campaignId" = ${campaign.id}
      ${postedAtFilter(campaign)}
    GROUP BY platform
    ORDER BY platform
  `;

  const sum = (pick: (row: PlatformTotalsRow) => bigint | number) =>
    rows.reduce((total, row) => total + Number(pick(row)), 0);

  const totalViews = sum((row) => row.views);
  const totalLikes = sum((row) => row.likes);
  const totalComments = sum((row) => row.comments);
  const totalShares = sum((row) => row.shares);
  const totalSaves = sum((row) => row.saves);

  return {
    totalPosts: sum((row) => row.allPosts),
    totalViews,
    totalLikes,
    totalComments,
    totalShares,
    totalSaves,
    engagementRate: calculateEngagementRate(
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      totalSaves,
    ),
    recentViews: sum((row) => row.recentViews),
    // Só plataformas com post elegível, como o groupBy anterior.
    platformStats: rows
      .filter((row) => row.posts > 0)
      .map((row) => ({
        platform: row.platform,
        totalViews: Number(row.views),
        totalLikes: Number(row.likes),
        totalComments: Number(row.comments),
        totalShares: Number(row.shares),
        postsCount: row.posts,
      })),
  };
}

export function getCampaignTotals(
  db: PrismaClient,
  campaign: Pick<DashboardCampaignRef, "id" | "slug">,
) {
  return cachedQuery(
    `client-dashboard:totals:${campaign.id}:${campaign.slug}`,
    CLIENT_DASHBOARD_TTL_MS,
    () => queryCampaignTotals(db, campaign),
  );
}

type GrowthRow = { day: string; platform: Platform; views: bigint };

/**
 * Janela do gráfico de crescimento: do início da competição até o fim (ou
 * hoje, se ainda não acabou), em dias inteiros no fuso do servidor.
 */
export function growthWindow(
  campaign: Pick<DashboardCampaignRef, "startDate" | "endDate">,
  now = new Date(),
) {
  const start = new Date(campaign.startDate);
  start.setHours(0, 0, 0, 0);
  const end = campaign.endDate < now ? new Date(campaign.endDate) : now;
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Views acumuladas por plataforma, com cada post contado no dia (UTC) em que
 * foi cadastrado. A soma por dia e plataforma vem pronta do banco, em vez de
 * todos os posts do período.
 */
export function buildGrowthData(input: {
  rows: GrowthRow[];
  platforms: Platform[];
  start: Date;
  end: Date;
}) {
  const growthPlatforms = [...input.platforms].sort();

  const totalDays = Math.ceil(
    (input.end.getTime() - input.start.getTime()) / (1000 * 60 * 60 * 24),
  );
  const dayMap = new Map<string, Record<string, number>>();
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(input.start);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const row: Record<string, number> = { total: 0 };
    growthPlatforms.forEach((p) => (row[p] = 0));
    dayMap.set(key, row);
  }

  for (const item of input.rows) {
    const row = dayMap.get(item.day);
    if (!row) continue;
    const views = Number(item.views || 0);
    row.total = (row.total || 0) + views;
    row[item.platform] = (row[item.platform] || 0) + views;
  }

  const cumTotals: Record<string, number> = {};
  growthPlatforms.forEach((p) => (cumTotals[p] = 0));
  let cumTotal = 0;

  const growthData = Array.from(dayMap.entries()).map(([date, row]) => {
    cumTotal += row.total || 0;
    const entry: Record<string, number | string> = { total: cumTotal };
    for (const p of growthPlatforms) {
      cumTotals[p] = (cumTotals[p] || 0) + (row[p] || 0);
      entry[p] = cumTotals[p];
    }
    return { date, ...entry };
  });

  return { growthData, growthPlatforms };
}

type TopAccountRow = {
  username: string;
  platform: Platform | null;
  views: bigint;
  likes: bigint;
  comments: bigint;
  posts: number;
};

async function loadCampaignDashboardMetrics(
  db: PrismaClient,
  campaign: DashboardCampaignRef,
) {
  const { start, end } = growthWindow(campaign);
  const dateFilter = postedAtWhere(campaign);

  const [totals, totalParticipants, growthRows, topPosts, topAccounts] =
    await Promise.all([
      getCampaignTotals(db, campaign),
      db.clipperApplication.count({
        where: { campaignId: campaign.id, status: "APPROVED" },
      }),
      db.$queryRaw<GrowthRow[]>`
        SELECT
          TO_CHAR("createdAt", 'YYYY-MM-DD') AS day,
          platform,
          COALESCE(SUM(views), 0)::bigint AS views
        FROM "ClipPost"
        WHERE "campaignId" = ${campaign.id}
          AND status = 'ELIGIBLE'
          AND "createdAt" >= ${start}::timestamp
          AND "createdAt" <= ${end}::timestamp
          ${postedAtFilter(campaign)}
        GROUP BY 1, 2
      `,
      db.clipPost.findMany({
        where: {
          campaignId: campaign.id,
          status: "ELIGIBLE",
          ...dateFilter,
        },
        select: {
          id: true,
          username: true,
          submittedUrl: true,
          thumbnailUrl: true,
          platform: true,
          views: true,
          likes: true,
          comments: true,
          shares: true,
          saves: true,
          postedAt: true,
        },
        orderBy: { views: "desc" },
        take: 5,
      }),
      // Top 5 contas por views e, de cada uma, a plataforma do post com mais
      // views — antes eram 1 groupBy + 5 findFirst em sequência.
      db.$queryRaw<TopAccountRow[]>`
        WITH accounts AS (
          SELECT
            username,
            SUM(views)::bigint AS views,
            SUM(likes)::bigint AS likes,
            SUM(comments)::bigint AS comments,
            COUNT(*)::int AS posts
          FROM "ClipPost"
          WHERE "campaignId" = ${campaign.id}
            AND status = 'ELIGIBLE'
            AND username IS NOT NULL
            ${postedAtFilter(campaign)}
          GROUP BY username
          ORDER BY SUM(views) DESC
          LIMIT 5
        )
        SELECT
          accounts.*,
          (
            SELECT post.platform
            FROM "ClipPost" post
            WHERE post."campaignId" = ${campaign.id}
              AND post.status = 'ELIGIBLE'
              AND post.username = accounts.username
              ${postedAtFilter(campaign)}
            ORDER BY post.views DESC
            LIMIT 1
          ) AS platform
        FROM accounts
        ORDER BY accounts.views DESC
      `,
    ]);

  const { growthData, growthPlatforms } = buildGrowthData({
    rows: growthRows,
    platforms: totals.platformStats.map((stat) => stat.platform),
    start,
    end,
  });

  return {
    totalParticipants,
    ...totals,
    growthData,
    growthPlatforms,
    topPosts: topPosts.map((post) => ({
      id: post.id,
      username: post.username || "",
      url: post.submittedUrl,
      thumbnailUrl: post.thumbnailUrl,
      platform: post.platform,
      views: Number(post.views),
      likes: post.likes,
      comments: post.comments,
      shares: post.shares,
      postedAt: post.postedAt?.toISOString(),
    })),
    topAccounts: topAccounts.map((account) => ({
      username: account.username || "",
      platform: account.platform || ("INSTAGRAM" as Platform),
      totalViews: Number(account.views || 0),
      totalLikes: Number(account.likes || 0),
      totalComments: Number(account.comments || 0),
      postsCount: account.posts,
    })),
  };
}

export function getCampaignDashboardMetrics(
  db: PrismaClient,
  campaign: DashboardCampaignRef,
) {
  return cachedQuery(
    `client-dashboard:metrics:${campaign.id}:${campaign.slug}:${campaign.startDate.getTime()}:${campaign.endDate.getTime()}`,
    CLIENT_DASHBOARD_TTL_MS,
    () => loadCampaignDashboardMetrics(db, campaign),
  );
}
