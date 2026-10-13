import { Prisma, type PrismaClient, type RankingMetricType } from "@prisma/client";

import { rankingApplicationWhere } from "@/lib/competition-participation";
import {
  getPostedAtWindowUtc,
  getPrizeForPosition,
  loadDailyRankingDateContext,
  parsePrizeTable,
  type PrizeTableEntry,
} from "@/lib/daily-ranking-preview";
import {
  rankLiveDailyPosts,
  type DailyClipperRankingItem,
} from "@/lib/daily-ranking-shared";
import { cachedQuery } from "@/server/memory-cache";

/**
 * Ranking diário exibido ao clipador (página da competição e histórico por dia).
 *
 * Os dados são iguais para todos os clipadores da campanha: ficam em cache por
 * (campanha, dia). O `isCurrentUser` e o prêmio de cada posição são aplicados
 * depois, por quem chama (a tabela de prêmios vem da campanha lida na
 * requisição, então uma edição dela não espera o cache vencer).
 */

export function getFirstName(name?: string | null) {
  return name?.trim().split(/\s+/)[0] || "";
}

// Nome exibido no ranking: nome artístico, senão só o primeiro nome (evita expor nome completo)
export function getClipperRankingDisplayName(profile: {
  artisticName?: string | null;
  fullName?: string | null;
}) {
  return (
    profile.artisticName?.trim() || getFirstName(profile.fullName) || "Clipador"
  );
}

/** Item do ranking sem o campo por usuário (`isCurrentUser`) e sem o prêmio. */
export type SharedDailyRankingItem = Omit<
  DailyClipperRankingItem,
  "isCurrentUser" | "prize"
> & {
  ownerUserId: string | null;
};

/**
 * Tabela de prêmios do ranking vindo do snapshot (DailyRanking): a mesma
 * leitura estrita de antes (tabela vazia ou inválida é erro).
 */
export function snapshotDailyPrizeTable(dailyPrizeTable: unknown) {
  return parsePrizeTable(dailyPrizeTable);
}

/** Tabela de prêmios do ranking ao vivo (`rankLiveDailyPosts` aceita vazia). */
export function liveDailyPrizeTable(dailyPrizeTable: unknown) {
  return parsePrizeTable(dailyPrizeTable, { allowEmpty: true });
}

/**
 * Mesma forma (e ordem de campos) do item original, com `isCurrentUser` e o
 * prêmio da posição pela tabela informada.
 */
export function withCurrentUser(
  items: SharedDailyRankingItem[],
  userId: string,
  prizeTable: PrizeTableEntry[],
): DailyClipperRankingItem[] {
  return items.map((item) => ({
    position: item.position,
    postId: item.postId,
    clipperName: item.clipperName,
    clipperImageUrl: item.clipperImageUrl,
    username: item.username,
    platform: item.platform,
    thumbnailUrl: item.thumbnailUrl,
    views: item.views,
    likes: item.likes,
    comments: item.comments,
    shares: item.shares,
    saves: item.saves,
    postedAt: item.postedAt,
    isCurrentUser: item.ownerUserId !== null && item.ownerUserId === userId,
    engagementRate: item.engagementRate,
    rankingScore: item.rankingScore,
    prize: getPrizeForPosition(prizeTable, item.position),
    clanTag: item.clanTag,
    clanEmoji: item.clanEmoji,
    clanEmojiColor: item.clanEmojiColor,
  }));
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * TTL do cache de um dia de ranking (janela [D-1 20:00 UTC, D 20:00 UTC)):
 * - dia aberto: 60 s (dados ao vivo);
 * - fechado há menos de 48 h: 5 min (o admin ainda recalcula/desqualifica/paga);
 * - mais antigo: 6 h (não muda mais).
 */
export function dailyRankingCacheTtlMs(dateYmd: string, now = Date.now()) {
  const { endDate } = getPostedAtWindowUtc(dateYmd);
  const closedForMs = now - endDate.getTime();
  if (closedForMs < 0) return MINUTE_MS;
  if (closedForMs < 48 * HOUR_MS) return 5 * MINUTE_MS;
  return 6 * HOUR_MS;
}

const DAY_MS = 24 * HOUR_MS;

/** YYYY-MM-DD que existe no calendário UTC (2026-02-31 e 2026-13-01 não passam). */
export function isCalendarDateYmd(dateYmd: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYmd);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC trata anos 0–99 como 1900–1999: a volta para o texto também barra.
  return date.toISOString().slice(0, 10) === dateYmd;
}

/**
 * Dias de ranking que podem ter posts da campanha: do dia anterior ao início
 * até amanhã (UTC). Fora disso o ranking é vazio e não vai ao banco nem ao
 * cache — as chaves por dia não crescem com datas arbitrárias.
 */
export function isDailyRankingDateInRange(
  dateYmd: string,
  campaignStartDate: Date,
  now = Date.now(),
) {
  const first = new Date(campaignStartDate.getTime() - DAY_MS)
    .toISOString()
    .slice(0, 10);
  const last = new Date(now + DAY_MS).toISOString().slice(0, 10);
  return dateYmd >= first && dateYmd <= last;
}

/** `fresh`: lê direto do banco, sem usar nem preencher o cache (ADMIN). */
type DailyRankingReadOptions = { fresh?: boolean };

export type SnapshotDailyRanking = {
  posts: SharedDailyRankingItem[];
  totalPosts: number;
  hasSnapshot: boolean;
  /** DailyRanking do dia com ao menos uma entrada (usado pelo modo ao vivo). */
  entriesDailyRankingId: string | null;
};

/** Top do dia a partir do snapshot (DailyRanking/DailyRankingEntry), sem desqualificados. */
export async function loadSnapshotDailyRanking(
  db: PrismaClient,
  campaignId: string,
  dateYmd: string,
): Promise<SnapshotDailyRanking> {
  // O clipador não usa views totais/aumento do dia: pula essas varreduras.
  const core = await loadDailyRankingDateContext(db, campaignId, dateYmd, {
    includeStats: false,
  });
  if (!core) {
    return {
      posts: [],
      totalPosts: 0,
      hasSnapshot: false,
      entriesDailyRankingId: null,
    };
  }

  const entryIds = core.rawRows.map((row) => row.dailyRankingEntryId);
  const appIds = Array.from(
    new Set(core.rawRows.map((row) => row.applicationId)),
  );
  const [dreRows, appRows] = await Promise.all([
    db.dailyRankingEntry.findMany({
      where: { id: { in: entryIds } },
      select: { id: true, isDisqualified: true },
    }),
    db.clipperApplication.findMany({
      where: { id: { in: appIds } },
      select: {
        id: true,
        clipperProfile: {
          select: {
            userId: true,
            user: { select: { imageUrl: true } },
            clan: { select: { tag: true, emoji: true, emojiColor: true } },
          },
        },
      },
    }),
  ]);
  const disqualifiedMap = new Map(
    dreRows.map((row) => [row.id, row.isDisqualified]),
  );
  const appMap = new Map(appRows.map((row) => [row.id, row]));

  let effectiveRank = 0;
  const posts = core.rawRows
    .filter((row) => !disqualifiedMap.get(row.dailyRankingEntryId))
    .map((row) => {
      effectiveRank += 1;
      const profile = appMap.get(row.applicationId)?.clipperProfile;
      return {
        position: effectiveRank,
        postId: row.clipPostId,
        clipperName: getClipperRankingDisplayName({
          artisticName: row.artisticName,
          fullName: row.fullName,
        }),
        clipperImageUrl: profile?.user?.imageUrl ?? null,
        username: row.username || "",
        platform: row.platform,
        thumbnailUrl: row.thumbnailUrl || "",
        views: Number(row.views),
        likes: row.likes,
        comments: row.comments,
        shares: row.shares,
        saves: row.saves ?? 0,
        postedAt: row.postedAt?.toISOString() ?? new Date().toISOString(),
        engagementRate: Number(row.er),
        rankingScore: Number(row.score),
        clanTag: profile?.clan?.tag ?? null,
        clanEmoji: profile?.clan?.emoji ?? null,
        clanEmojiColor: profile?.clan?.emojiColor ?? null,
        ownerUserId: profile?.userId ?? null,
      } satisfies SharedDailyRankingItem;
    })
    .slice(0, core.topCount);

  return {
    posts,
    totalPosts: core.stats.totalPosts,
    hasSnapshot: true,
    entriesDailyRankingId: core.stats.totalPosts > 0 ? core.dailyRankingId : null,
  };
}

export function getCachedSnapshotDailyRanking(
  db: PrismaClient,
  campaignId: string,
  dateYmd: string,
  options: DailyRankingReadOptions = {},
) {
  if (options.fresh) return loadSnapshotDailyRanking(db, campaignId, dateYmd);
  return cachedQuery(
    `clipper-daily-snapshot:${campaignId}:${dateYmd}`,
    dailyRankingCacheTtlMs(dateYmd),
    () => loadSnapshotDailyRanking(db, campaignId, dateYmd),
  );
}

/** Posts ELEGÍVEIS da janela do dia (mesmo filtro de inscrição do ranking). */
export function countDailyEligiblePosts(
  db: PrismaClient,
  campaignId: string,
  dateYmd: string,
) {
  const { startDate, endDate } = getPostedAtWindowUtc(dateYmd);
  return db.clipPost.count({
    where: {
      campaignId,
      status: "ELIGIBLE",
      postedAt: { gte: startDate, lt: endDate },
      application: rankingApplicationWhere(endDate),
    },
  });
}

export function getCachedDailyEligiblePostsCount(
  db: PrismaClient,
  campaignId: string,
  dateYmd: string,
  options: DailyRankingReadOptions = {},
) {
  if (options.fresh) return countDailyEligiblePosts(db, campaignId, dateYmd);
  return cachedQuery(
    `clipper-daily-count:${campaignId}:${dateYmd}`,
    dailyRankingCacheTtlMs(dateYmd),
    () => countDailyEligiblePosts(db, campaignId, dateYmd),
  );
}

type LiveRankRow = {
  id: string;
  username: string | null;
  platform: string | null;
  thumbnailUrl: string | null;
  postedAt: Date | null;
  views: bigint;
  likes: number;
  comments: number;
  shares: number;
  saves: number | null;
  userId: string;
  fullName: string;
  artisticName: string | null;
  imageUrl: string | null;
  clanTag: string | null;
  clanEmoji: string | null;
  clanEmojiColor: string | null;
};

/** Folga sobre o top para o desempate final em JS (`rankLiveDailyPosts`). */
const LIVE_RANK_MARGIN = 10;

/**
 * Ranking ao vivo do dia, ordenado no SQL (score DESC, views DESC) e limitado
 * ao top; só essas linhas são hidratadas. O score replica em float8 a conta de
 * `calculateRankingScore` (mesmas operações IEEE-754 do JS) e o ranking final
 * (posições, ER) continua sendo feito por `rankLiveDailyPosts`. O prêmio fica
 * de fora: quem chama aplica a tabela atual da campanha (`withCurrentUser`).
 *
 * Com `entriesDailyRankingId` (já existe DailyRanking do dia com entradas),
 * usa as métricas do dia (DailyRankingEntry) e só os posts presentes nele —
 * mesma regra de `pickMetricsForDailyRank` no caminho antigo.
 */
export async function loadLiveDailyRanking(
  db: PrismaClient,
  params: {
    campaignId: string;
    dateYmd: string;
    metricType: RankingMetricType;
    topCount: number;
    entriesDailyRankingId: string | null;
  },
): Promise<SharedDailyRankingItem[]> {
  const { startDate, endDate } = getPostedAtWindowUtc(params.dateYmd);
  const limit = Math.max(params.topCount, 0) + LIVE_RANK_MARGIN;

  const applicationFilter = Prisma.sql`
    cp."campaignId" = ${params.campaignId}
    AND cp."status" = 'ELIGIBLE'
    AND cp."postedAt" >= ${startDate}::timestamp
    AND cp."postedAt" < ${endDate}::timestamp
    AND (
      ca."status" = 'APPROVED'
      OR (ca."status" = 'WITHDRAWN' AND ca."withdrawnAt" >= ${endDate}::timestamp)
    )
  `;
  const metricsSql = params.entriesDailyRankingId
    ? Prisma.sql`
        SELECT
          cp."id", cp."applicationId", cp."username",
          cp."platform"::text AS "platform", cp."thumbnailUrl", cp."postedAt",
          dre."dailyViews" AS "views",
          dre."dailyLikes" AS "likes",
          dre."dailyComments" AS "comments",
          dre."dailyShares" AS "shares",
          dre."dailySaves" AS "saves"
        FROM "ClipPost" cp
        INNER JOIN "ClipperApplication" ca ON ca."id" = cp."applicationId"
        INNER JOIN "DailyRankingEntry" dre
          ON dre."clipPostId" = cp."id"
          AND dre."dailyRankingId" = ${params.entriesDailyRankingId}
        WHERE ${applicationFilter}
      `
    : Prisma.sql`
        SELECT
          cp."id", cp."applicationId", cp."username",
          cp."platform"::text AS "platform", cp."thumbnailUrl", cp."postedAt",
          cp."views", cp."likes", cp."comments", cp."shares", cp."saves"
        FROM "ClipPost" cp
        INNER JOIN "ClipperApplication" ca ON ca."id" = cp."applicationId"
        WHERE ${applicationFilter}
      `;
  // calculateRankingScore: VIEWS → views; VIEWS_X_ENGAGEMENT →
  // trunc(views × trunc(((l+c+s+sv)/views) × 100 × 100) / 100), em float8.
  const scoreSql =
    params.metricType === "VIEWS_X_ENGAGEMENT"
      ? Prisma.sql`
          CASE
            WHEN m."views" > 0 THEN
              TRUNC(
                m."views"::float8 * (
                  TRUNC(
                    ((m."likes"::bigint + m."comments" + m."shares" + COALESCE(m."saves", 0))::float8
                      / m."views"::float8) * 100 * 100
                  ) / 100
                )
              )
            ELSE 0
          END
        `
      : Prisma.sql`m."views"::float8`;

  const rows = await db.$queryRaw<LiveRankRow[]>`
    WITH metrics AS (${metricsSql}),
    ranked AS (
      SELECT m.*, ${scoreSql} AS "score"
      FROM metrics m
      ORDER BY "score" DESC, m."views" DESC, m."id" ASC
      LIMIT ${limit}
    )
    SELECT
      r."id", r."username", r."platform", r."thumbnailUrl", r."postedAt",
      r."views", r."likes", r."comments", r."shares", r."saves",
      prof."userId", prof."fullName", prof."artisticName",
      u."imageUrl",
      cl."tag" AS "clanTag", cl."emoji" AS "clanEmoji", cl."emojiColor" AS "clanEmojiColor"
    FROM ranked r
    INNER JOIN "ClipperApplication" ca ON ca."id" = r."applicationId"
    INNER JOIN "ClipperProfile" prof ON prof."id" = ca."clipperProfileId"
    INNER JOIN "User" u ON u."id" = prof."userId"
    LEFT JOIN "Clan" cl ON cl."id" = prof."clanId"
    ORDER BY r."score" DESC, r."views" DESC, r."id" ASC
  `;

  const ownerByPostId = new Map(rows.map((row) => [row.id, row.userId]));
  const ranked = rankLiveDailyPosts({
    posts: rows.map((row) => ({
      postId: row.id,
      clipperName: getClipperRankingDisplayName(row),
      clipperImageUrl: row.imageUrl || null,
      username: row.username || "",
      platform: row.platform,
      thumbnailUrl: row.thumbnailUrl || "",
      views: Number(row.views),
      likes: row.likes,
      comments: row.comments,
      shares: row.shares,
      saves: row.saves ?? 0,
      postedAtIso: row.postedAt?.toISOString() || new Date().toISOString(),
      isCurrentUser: false,
      clanTag: row.clanTag ?? null,
      clanEmoji: row.clanEmoji ?? null,
      clanEmojiColor: row.clanEmojiColor ?? null,
    })),
    metricType: params.metricType,
    topCount: params.topCount,
    // O prêmio calculado aqui é descartado (ver `withCurrentUser`).
    dailyPrizeTable: null,
  });

  return ranked.map(
    ({ isCurrentUser: _ignored, prize: _prizeAppliedLater, ...item }) => ({
      ...item,
      ownerUserId: ownerByPostId.get(item.postId) ?? null,
    }),
  );
}

export function getCachedLiveDailyRanking(
  db: PrismaClient,
  params: Parameters<typeof loadLiveDailyRanking>[1],
  options: DailyRankingReadOptions = {},
) {
  if (options.fresh) return loadLiveDailyRanking(db, params);
  return cachedQuery(
    `clipper-daily-live:${params.campaignId}:${params.dateYmd}:${params.metricType}:${params.topCount}:${params.entriesDailyRankingId ?? "-"}`,
    dailyRankingCacheTtlMs(params.dateYmd),
    () => loadLiveDailyRanking(db, params),
  );
}

export type DailyTopClipperRow = {
  clipperProfileId: string;
  clipperName: string;
  fullName: string;
  imageUrl: string | null;
  ownerUserId: string;
  totalPosts: number;
  totalViews: number;
  campaigns: {
    campaignId: string;
    campaignName: string;
    posts: number;
    views: number;
  }[];
};

/**
 * Ranking "Top Clipadores" do dia: quantidade de vídeos ELEGÍVEIS postados na
 * janela; desempate por views e depois pelo id do perfil. Agrega no banco
 * (groupBy por inscrição) e só hidrata os perfis do top.
 */
export async function loadDailyTopClippersByPostedVideos(
  db: PrismaClient,
  params: { campaignId: string; date: string; limit: number },
): Promise<{
  entries: DailyTopClipperRow[];
  stats: {
    totalPostsInWindow: number;
    totalViewsInWindow: number;
    totalClippersWithPosts: number;
    totalCampaigns: number;
  };
}> {
  const { startDate, endDate } = getPostedAtWindowUtc(params.date);
  const persistedDisqualifications =
    await db.topClippersDailyRankingEntry.findMany({
      where: {
        isDisqualified: true,
        ranking: {
          campaignId: params.campaignId,
          rankingDate: new Date(`${params.date}T00:00:00.000Z`),
        },
      },
      select: { applicationId: true },
    });
  const disqualifiedApplicationIds = persistedDisqualifications.map(
    (entry) => entry.applicationId,
  );

  const groups = await db.clipPost.groupBy({
    by: ["applicationId"],
    where: {
      campaignId: params.campaignId,
      status: "ELIGIBLE",
      postedAt: { gte: startDate, lt: endDate },
      applicationId: { notIn: disqualifiedApplicationIds },
      application: rankingApplicationWhere(endDate),
    },
    _count: { id: true },
    _sum: { views: true },
  });

  const applications =
    groups.length > 0
      ? await db.clipperApplication.findMany({
          where: { id: { in: groups.map((group) => group.applicationId) } },
          select: { id: true, clipperProfileId: true },
        })
      : [];
  const profileIdByApplication = new Map(
    applications.map((app) => [app.id, app.clipperProfileId]),
  );

  // Uma inscrição por clipador na campanha; soma por perfil por segurança.
  const totalsByProfile = new Map<
    string,
    { clipperProfileId: string; totalPosts: number; totalViews: number }
  >();
  let totalPostsInWindow = 0;
  let totalViewsInWindow = 0;
  for (const group of groups) {
    const clipperProfileId = profileIdByApplication.get(group.applicationId);
    if (!clipperProfileId) continue;
    const posts = group._count.id;
    const views = Number(group._sum.views ?? 0);
    const current = totalsByProfile.get(clipperProfileId) ?? {
      clipperProfileId,
      totalPosts: 0,
      totalViews: 0,
    };
    current.totalPosts += posts;
    current.totalViews += views;
    totalsByProfile.set(clipperProfileId, current);
    totalPostsInWindow += posts;
    totalViewsInWindow += views;
  }

  const top = Array.from(totalsByProfile.values())
    .sort((a, b) => {
      if (b.totalPosts !== a.totalPosts) return b.totalPosts - a.totalPosts;
      if (b.totalViews !== a.totalViews) return b.totalViews - a.totalViews;
      return a.clipperProfileId.localeCompare(b.clipperProfileId);
    })
    .slice(0, params.limit);

  const [profiles, campaign] =
    top.length > 0
      ? await Promise.all([
          db.clipperProfile.findMany({
            where: { id: { in: top.map((row) => row.clipperProfileId) } },
            select: {
              id: true,
              fullName: true,
              artisticName: true,
              userId: true,
              user: { select: { imageUrl: true } },
            },
          }),
          db.campaign.findUnique({
            where: { id: params.campaignId },
            select: { name: true },
          }),
        ])
      : [[], null];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  const entries = top.flatMap((row): DailyTopClipperRow[] => {
    const profile = profileById.get(row.clipperProfileId);
    if (!profile) return [];
    return [
      {
        clipperProfileId: row.clipperProfileId,
        clipperName: getClipperRankingDisplayName(profile),
        fullName: getFirstName(profile.fullName) || "Clipador",
        imageUrl: profile.user.imageUrl,
        ownerUserId: profile.userId,
        totalPosts: row.totalPosts,
        totalViews: row.totalViews,
        campaigns: [
          {
            campaignId: params.campaignId,
            campaignName: campaign?.name ?? "",
            posts: row.totalPosts,
            views: row.totalViews,
          },
        ],
      },
    ];
  });

  return {
    entries,
    stats: {
      totalPostsInWindow,
      totalViewsInWindow,
      totalClippersWithPosts: totalsByProfile.size,
      totalCampaigns: 1,
    },
  };
}
