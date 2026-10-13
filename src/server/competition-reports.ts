import type { Platform, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

/** Todos os números do relatório consideram só os posts elegíveis. */
function eligiblePostsWhere(campaignId: string) {
  return { campaignId, status: "ELIGIBLE" as const };
}

const topPostSelect = {
  id: true,
  username: true,
  submittedUrl: true,
  views: true,
  likes: true,
  comments: true,
  shares: true,
  thumbnailUrl: true,
  platform: true,
  postedAt: true,
} as const;

export type CampaignGrowthPoint = {
  /** Dia UTC, "YYYY-MM-DD". */
  date: string;
  /** Views ganhas no dia (o mesmo vale para likes, comentários e shares). */
  views: number;
  likes: number;
  comments: number;
  shares: number;
};

type GrowthRow = {
  date: string;
  views: bigint;
  likes: bigint;
  comments: bigint;
  shares: bigint;
};

/**
 * Crescimento da campanha por dia UTC: views (e likes, comentários e shares)
 * ganhas em cada dia. Para cada post elegível, vale a última coleta de cada
 * dia; o ganho do dia é a diferença para a coleta anterior do post (a
 * primeira coleta conta inteira). Somar o valor das coletas do dia não serve:
 * cada coleta é o total acumulado do post, e o League não coleta todo post
 * todo dia. Dias sem coleta entram com ganho zero, para o eixo ser contínuo.
 *
 * O LATERAL lê as métricas post a post pelo índice (clipPostId, collectedAt):
 * o DISTINCT ON dentro da subconsulta impede o planner de achatá-la numa
 * varredura de ClipPostMetrics inteira (dezenas de milhões de linhas), e a
 * ordenação por dia fica restrita às poucas coletas de cada post.
 */
export async function loadCampaignGrowth(
  db: PrismaClient,
  campaignId: string,
): Promise<CampaignGrowthPoint[]> {
  const rows = await db.$queryRaw<GrowthRow[]>`
    WITH post_days AS (
      SELECT
        post.id AS post_id,
        last_of_day.day,
        last_of_day.views,
        last_of_day.likes,
        last_of_day.comments,
        last_of_day.shares
      FROM "ClipPost" post
      CROSS JOIN LATERAL (
        SELECT DISTINCT ON (DATE_TRUNC('day', metrics."collectedAt"))
          DATE_TRUNC('day', metrics."collectedAt") AS day,
          metrics.views,
          metrics.likes,
          metrics.comments,
          metrics.shares
        FROM "ClipPostMetrics" metrics
        WHERE metrics."clipPostId" = post.id
        ORDER BY DATE_TRUNC('day', metrics."collectedAt"), metrics."collectedAt" DESC
      ) last_of_day
      WHERE post."campaignId" = ${campaignId}
        AND post.status = 'ELIGIBLE'
    ),
    deltas AS (
      SELECT
        day,
        views - LAG(views, 1, 0::bigint) OVER per_post AS views,
        likes - LAG(likes, 1, 0) OVER per_post AS likes,
        comments - LAG(comments, 1, 0) OVER per_post AS comments,
        shares - LAG(shares, 1, 0) OVER per_post AS shares
      FROM post_days
      WINDOW per_post AS (PARTITION BY post_id ORDER BY day)
    ),
    gains AS (
      SELECT
        day,
        SUM(views) AS views,
        SUM(likes) AS likes,
        SUM(comments) AS comments,
        SUM(shares) AS shares
      FROM deltas
      GROUP BY day
    ),
    days AS (
      SELECT GENERATE_SERIES(MIN(day), MAX(day), INTERVAL '1 day') AS day
      FROM gains
    )
    SELECT
      TO_CHAR(days.day, 'YYYY-MM-DD') AS date,
      COALESCE(gains.views, 0)::bigint AS views,
      COALESCE(gains.likes, 0)::bigint AS likes,
      COALESCE(gains.comments, 0)::bigint AS comments,
      COALESCE(gains.shares, 0)::bigint AS shares
    FROM days
    LEFT JOIN gains ON gains.day = days.day
    ORDER BY days.day
  `;

  return rows.map((row) => ({
    date: row.date,
    views: Number(row.views),
    likes: Number(row.likes),
    comments: Number(row.comments),
    shares: Number(row.shares),
  }));
}

/**
 * Relatório completo de uma campanha (admin). As consultas são independentes
 * e rodam em paralelo; a lista de posts fica com `getReportsPosts` (paginada).
 */
export async function loadCampaignReports(
  db: PrismaClient,
  campaignId: string,
) {
  const eligible = eligiblePostsWhere(campaignId);

  const [
    campaign,
    topAccounts,
    topPostsByViews,
    topPostsByLikes,
    topPostsByComments,
    growthData,
    totalStats,
    platformStats,
  ] = await Promise.all([
    db.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    }),
    // Top Accounts (usuários com mais views elegíveis somadas)
    db.clipPost.groupBy({
      by: ["username"],
      where: { ...eligible, username: { not: null } },
      _sum: {
        views: true,
        likes: true,
        comments: true,
        shares: true,
        saves: true,
      },
      _count: { id: true },
      orderBy: { _sum: { views: "desc" } },
      take: 10,
    }),
    db.clipPost.findMany({
      where: eligible,
      select: topPostSelect,
      orderBy: { views: "desc" },
      take: 10,
    }),
    db.clipPost.findMany({
      where: eligible,
      select: topPostSelect,
      orderBy: { likes: "desc" },
      take: 10,
    }),
    db.clipPost.findMany({
      where: eligible,
      select: topPostSelect,
      orderBy: { comments: "desc" },
      take: 10,
    }),
    loadCampaignGrowth(db, campaignId),
    db.clipPost.aggregate({
      where: eligible,
      _sum: {
        views: true,
        likes: true,
        comments: true,
        shares: true,
        saves: true,
      },
      _count: { id: true },
    }),
    // Distribuição dos posts elegíveis por plataforma
    db.clipPost.groupBy({
      by: ["platform"],
      where: eligible,
      _sum: { views: true, likes: true, comments: true },
      _count: { id: true },
    }),
  ]);

  if (!campaign) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Campanha não encontrada",
    });
  }

  const withNumberViews = <T extends { views: bigint }>(post: T) => ({
    ...post,
    views: Number(post.views),
  });

  return {
    campaign,
    topAccounts: topAccounts.map((acc) => ({
      username: acc.username,
      platform: "INSTAGRAM", // Simplificação - pegar a plataforma mais usada
      profileUrl: `https://instagram.com/${acc.username}`,
      totalViews: Number(acc._sum.views || 0),
      totalLikes: acc._sum.likes || 0,
      totalComments: acc._sum.comments || 0,
      totalShares: acc._sum.shares || 0,
      postsCount: acc._count.id,
    })),
    topPostsByViews: topPostsByViews.map(withNumberViews),
    topPostsByLikes: topPostsByLikes.map(withNumberViews),
    topPostsByComments: topPostsByComments.map(withNumberViews),
    growthData,
    totalStats: {
      totalViews: Number(totalStats._sum.views || 0),
      totalLikes: totalStats._sum.likes || 0,
      totalComments: totalStats._sum.comments || 0,
      totalShares: totalStats._sum.shares || 0,
      totalSaves: totalStats._sum.saves || 0,
      totalPosts: totalStats._count.id,
    },
    platformStats: platformStats.map((stat) => ({
      platform: stat.platform,
      totalViews: Number(stat._sum.views || 0),
      totalLikes: stat._sum.likes || 0,
      totalComments: stat._sum.comments || 0,
      postsCount: stat._count.id,
    })),
  };
}

/**
 * Plataformas dos posts elegíveis de cada conta da campanha, numa consulta só
 * (em vez de um findMany por conta).
 */
export async function loadEligiblePlatformsByUsername(
  db: PrismaClient,
  campaignId: string,
) {
  const rows = await db.clipPost.groupBy({
    by: ["username", "platform"],
    where: { ...eligiblePostsWhere(campaignId), username: { not: null } },
  });

  const platformsByUsername = new Map<string, Platform[]>();
  for (const row of rows) {
    if (!row.username) continue;
    const platforms = platformsByUsername.get(row.username);
    if (platforms) platforms.push(row.platform);
    else platformsByUsername.set(row.username, [row.platform]);
  }
  return platformsByUsername;
}
