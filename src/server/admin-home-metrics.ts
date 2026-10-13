import type { Platform, PrismaClient } from "@prisma/client";

import { cachedQuery } from "@/server/memory-cache";

/**
 * Os números da home do admin são agregados de tabelas grandes (ClipPost tem
 * centenas de milhares de linhas) e não precisam ser ao vivo: cada resultado é
 * reaproveitado por 5 minutos, e as consultas do mesmo lote aguardam a mesma
 * leitura.
 */
const ADMIN_HOME_TTL_MS = 5 * 60_000;

export function cachedAdminHomeQuery<T>(
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  return cachedQuery(`admin-home:${key}`, ADMIN_HOME_TTL_MS, load);
}

/** Início da janela de 90 dias do gráfico de crescimento de views. */
export function viewsGrowthStartDate(now = new Date()) {
  const start = new Date(now);
  start.setDate(start.getDate() - 89);
  start.setHours(0, 0, 0, 0);
  return start;
}

export type EligiblePlatformTotals = {
  platform: Platform;
  posts: number;
  /** Inscrições distintas com post elegível na plataforma. */
  applications: number;
  views: number;
  /** Views dos posts criados antes do início do gráfico de crescimento. */
  viewsBefore: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
};

type TotalsRow = {
  platform: Platform;
  posts: number;
  applications: number;
  views: bigint;
  viewsBefore: bigint;
  likes: bigint;
  comments: bigint;
  shares: bigint;
  saves: bigint;
};

/**
 * Totais dos posts elegíveis por plataforma, em uma varredura de ClipPost.
 * O dashboard, o gráfico de crescimento e os dados por plataforma usam os
 * mesmos totais.
 */
export function getEligiblePlatformTotals(
  db: PrismaClient,
  viewsBeforeDate = viewsGrowthStartDate(),
) {
  return cachedAdminHomeQuery(
    `platform-totals:${viewsBeforeDate.getTime()}`,
    async (): Promise<EligiblePlatformTotals[]> => {
      const rows = await db.$queryRaw<TotalsRow[]>`
        SELECT
          platform,
          COUNT(*)::int AS posts,
          COUNT(DISTINCT "applicationId")::int AS applications,
          COALESCE(SUM(views), 0)::bigint AS views,
          COALESCE(SUM(views) FILTER (WHERE "createdAt" < ${viewsBeforeDate}::timestamp), 0)::bigint AS "viewsBefore",
          COALESCE(SUM(likes), 0)::bigint AS likes,
          COALESCE(SUM(comments), 0)::bigint AS comments,
          COALESCE(SUM(shares), 0)::bigint AS shares,
          COALESCE(SUM(saves), 0)::bigint AS saves
        FROM "ClipPost"
        WHERE status = 'ELIGIBLE'
        GROUP BY platform
      `;
      return rows.map((row) => ({
        platform: row.platform,
        posts: row.posts,
        applications: row.applications,
        views: Number(row.views),
        viewsBefore: Number(row.viewsBefore),
        likes: Number(row.likes),
        comments: Number(row.comments),
        shares: Number(row.shares),
        saves: Number(row.saves),
      }));
    },
  );
}

/** Vídeo do ticker do hero (só os campos que o card usa). */
export type HomeTickerClip = {
  id: string;
  thumbnail: string;
  views: number;
  engagementRate: number;
  username: string;
  platform: Platform;
};

export type HomeTickerPost = {
  id: string;
  thumbnailUrl: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  username: string | null;
  platform: Platform;
};

const TICKER_CAMPAIGNS = 10;
const TICKER_POSTS_PER_CAMPAIGN = 10;
const TICKER_CLIPS = 20;

/**
 * Intercala (round-robin) os mais vistos de cada competição: o 1º de cada,
 * depois o 2º de cada, etc. Ignora vídeos sem thumbnail e thumbnails repetidas.
 */
export function buildHomeTickerClips(
  postsPerCampaign: HomeTickerPost[][],
): HomeTickerClip[] {
  const perCampaign = postsPerCampaign.map((posts) =>
    posts.filter((post) => post.thumbnailUrl && post.thumbnailUrl.trim() !== ""),
  );

  const seenThumbnails = new Set<string>();
  const clips: HomeTickerClip[] = [];

  for (
    let round = 0;
    round < TICKER_POSTS_PER_CAMPAIGN && clips.length < TICKER_CLIPS;
    round++
  ) {
    for (const posts of perCampaign) {
      if (clips.length >= TICKER_CLIPS) break;
      const post = posts[round];
      if (!post?.thumbnailUrl) continue;
      if (seenThumbnails.has(post.thumbnailUrl)) continue;
      seenThumbnails.add(post.thumbnailUrl);
      clips.push({
        id: post.id,
        thumbnail: post.thumbnailUrl,
        views: post.views,
        engagementRate:
          post.views > 0
            ? ((post.likes + post.comments + post.shares) / post.views) * 100
            : 0,
        username: post.username || "",
        platform: post.platform,
      });
    }
  }
  return clips;
}

type TickerRow = Omit<HomeTickerPost, "views"> & {
  campaignRank: number;
  views: bigint;
};

/**
 * Ticker do hero: os 10 vídeos elegíveis mais vistos de cada uma das 10
 * competições ativas e públicas mais recentes (as mesmas de
 * `campaign.getActive`), em uma consulta e com cache de 5 minutos.
 */
export function getHomeTickerClips(db: Pick<PrismaClient, "$queryRaw">) {
  return cachedAdminHomeQuery("ticker-clips", async () => {
    const rows = await db.$queryRaw<TickerRow[]>`
      WITH active AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY "startDate" DESC)::int AS rank
        FROM "Campaign"
        WHERE status = 'ACTIVE' AND "isPrivate" = false
        ORDER BY "startDate" DESC
        LIMIT ${TICKER_CAMPAIGNS}
      )
      SELECT
        a.rank AS "campaignRank",
        p.id,
        p."thumbnailUrl",
        p.views,
        p.likes,
        p.comments,
        p.shares,
        p.username,
        p.platform
      FROM active a
      CROSS JOIN LATERAL (
        SELECT cp.id, cp."thumbnailUrl", cp.views, cp.likes, cp.comments,
          cp.shares, cp.username, cp.platform
        FROM "ClipPost" cp
        WHERE cp."campaignId" = a.id AND cp.status = 'ELIGIBLE'
        ORDER BY cp.views DESC
        LIMIT ${TICKER_POSTS_PER_CAMPAIGN}
      ) p
      ORDER BY a.rank, p.views DESC
    `;

    const postsByCampaign = new Map<number, HomeTickerPost[]>();
    for (const { campaignRank, ...row } of rows) {
      const posts = postsByCampaign.get(campaignRank) ?? [];
      posts.push({ ...row, views: Number(row.views) });
      postsByCampaign.set(campaignRank, posts);
    }
    return buildHomeTickerClips(
      [...postsByCampaign.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, posts]) => posts),
    );
  });
}
