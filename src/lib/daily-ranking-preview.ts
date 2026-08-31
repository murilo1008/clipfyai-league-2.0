import type { PrismaClient } from "@prisma/client";
import { RankingMetricType, TransactionStatus } from "@prisma/client";

function amountsClose(a: number, b: number) {
  return Math.round(a * 100) === Math.round(b * 100);
}

export interface PrizeTableEntry {
  position: number;
  prize: number;
}

export interface DailyRankPreviewRowRaw {
  dailyRankingEntryId: string;
  clipPostId: string;
  applicationId: string;
  submittedUrl: string;
  username: string | null;
  postedAt: Date | null;
  views: bigint;
  likes: number;
  comments: number;
  shares: number;
  saves: number | null;
  er: number;
  score: number;
  clipperProfileId: string;
  fullName: string;
  artisticName: string | null;
  pixKey: string | null;
  pixPayoutEligible: boolean;
  platform: string | null;
  thumbnailUrl: string | null;
}

function getDefaultPrizeTable(): PrizeTableEntry[] {
  return [
    { position: 1, prize: 300 },
    { position: 2, prize: 160 },
    { position: 3, prize: 100 },
    ...Array.from({ length: 12 }, (_, i) => ({ position: i + 4, prize: 20 })),
  ];
}

/**
 * Parseia a tabela de prêmios do RankingRule (JSON string, objeto ou array).
 */
export function parsePrizeTable(prizeTable: unknown): PrizeTableEntry[] {
  if (prizeTable === null || prizeTable === undefined || prizeTable === "") {
    return getDefaultPrizeTable();
  }

  let parsed: unknown = prizeTable;
  if (typeof prizeTable === "string") {
    try {
      parsed = JSON.parse(prizeTable) as unknown;
    } catch {
      throw new Error("Tabela de prêmios não contém JSON válido.");
    }
  }

  const result: PrizeTableEntry[] = [];
  const addEntry = (rawPosition: unknown, rawPrize: unknown) => {
    const position = Number(rawPosition);
    const prize = Number(rawPrize);
    if (!Number.isSafeInteger(position) || position <= 0) {
      throw new Error(`Posição de prêmio inválida: ${String(rawPosition)}`);
    }
    if (typeof rawPrize !== "number" || !Number.isFinite(prize) || prize < 0) {
      throw new Error(`Valor de prêmio inválido para a posição ${position}.`);
    }
    if (result.some((entry) => entry.position === position)) {
      throw new Error(`A posição ${position} está duplicada na tabela de prêmios.`);
    }
    result.push({ position, prize: Math.round(prize * 100) / 100 });
  };

  if (Array.isArray(parsed)) {
    parsed.forEach((raw, index) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new Error(`Entrada inválida na posição ${index + 1}.`);
      }
      const entry = raw as Record<string, unknown>;
      addEntry(
        entry.position ?? entry.pos ?? index + 1,
        entry.prize ?? entry.value ?? entry.amount,
      );
    });
  } else if (typeof parsed === "object" && parsed !== null) {
    for (const [key, value] of Object.entries(parsed)) {
      if (key.includes("-")) {
        const [rawStart, rawEnd, ...rest] = key.split("-");
        const start = Number(rawStart);
        const end = Number(rawEnd);
        if (
          rest.length > 0 ||
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start <= 0 ||
          end <= 0 ||
          start > end
        ) {
          throw new Error(`Faixa de posições inválida: ${key}`);
        }
        for (let position = start; position <= end; position += 1) {
          addEntry(position, value);
        }
      } else {
        addEntry(key, value);
      }
    }
  } else {
    throw new Error("Formato de tabela de prêmios inválido.");
  }

  if (result.length === 0) {
    throw new Error("A tabela de prêmios não pode estar vazia.");
  }
  return result.sort((left, right) => left.position - right.position);
}

export function getPrizeForPosition(
  prizeTable: PrizeTableEntry[],
  position: number,
): number {
  return prizeTable.find((entry) => entry.position === position)?.prize ?? 0;
}

/** YYYY-MM-DD como dia civil UTC */
export function parseUtcDateParts(ymd: string): {
  year: number;
  month: number;
  day: number;
} {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) {
    throw new Error("Data inválida; use YYYY-MM-DD (UTC).");
  }
  const year = parseInt(m[1]!, 10);
  const month = parseInt(m[2]!, 10);
  const day = parseInt(m[3]!, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31 || Number.isNaN(year)) {
    throw new Error("Data inválida.");
  }
  return { year, month, day };
}

/** Limites do dia UTC para localizar DailyRanking.rankingDate */
export function getUtcRankingDayBounds(ymd: string): {
  startOfDay: Date;
  endOfDay: Date;
} {
  const { year, month, day } = parseUtcDateParts(ymd);
  return {
    startOfDay: new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)),
    endOfDay: new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999)),
  };
}

/**
 * Janela [D-1 20:00 UTC, D 20:00 UTC) para filtrar postedAt (igual ao script).
 */
export function getPostedAtWindowUtc(ymd: string): {
  startDate: Date;
  endDate: Date;
} {
  const { year, month, day } = parseUtcDateParts(ymd);
  const endDate = new Date(Date.UTC(year, month - 1, day, 20, 0, 0, 0));
  const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
  return { startDate, endDate };
}

export async function fetchDailyRankPreviewByViews(
  db: PrismaClient,
  dailyRankingId: string,
  startDate: Date,
  endDate: Date,
  limit: number,
): Promise<DailyRankPreviewRowRaw[]> {
  return db.$queryRaw<DailyRankPreviewRowRaw[]>`
    WITH entries AS (
      SELECT
        dre."id" AS "dailyRankingEntryId",
        dre."clipPostId"        AS "clipPostId",
        dre."applicationId",
        dre."postUrl"           AS "submittedUrl",
        dre."clipperUsername"   AS "username",
        dre."postedAt",
        dre."dailyViews"        AS "views",
        dre."dailyLikes"        AS "likes",
        dre."dailyComments"     AS "comments",
        dre."dailyShares"       AS "shares",
        dre."dailySaves"        AS "saves",
        COALESCE(dre."platform", cp."platform")::text AS "platform",
        COALESCE(NULLIF(TRIM(dre."postThumbnail"), ''), cp."thumbnailUrl") AS "thumbnailUrl"
      FROM "DailyRankingEntry" dre
      INNER JOIN "ClipPost" cp ON cp."id" = dre."clipPostId"
      WHERE dre."dailyRankingId" = ${dailyRankingId}
        AND dre."postedAt" >= ${startDate}
        AND dre."postedAt" < ${endDate}
    ),
    joined AS (
      SELECT
        e."dailyRankingEntryId",
        e."clipPostId",
        e."applicationId",
        e."submittedUrl",
        e."username",
        e."postedAt",
        e."views",
        e."likes",
        e."comments",
        e."shares",
        e."saves",
        e."platform",
        e."thumbnailUrl",
        ca."clipperProfileId",
        cp2."fullName",
        cp2."artisticName",
        cp2."pixKey",
        cp2."pixPayoutEligible",
        CASE
          WHEN e."views" > 0 THEN
            TRUNC(
              ((e."likes" + e."comments" + e."shares" + COALESCE(e."saves", 0))::numeric / e."views") * 100,
              2
            )
          ELSE 0
        END AS er,
        CASE
          WHEN e."views" > 0 THEN
            TRUNC(
              e."views" *
              TRUNC(
                ((e."likes" + e."comments" + e."shares" + COALESCE(e."saves", 0))::numeric / e."views") * 100,
                2
              )
            )
          ELSE 0
        END AS "score"
      FROM entries e
      JOIN "ClipperApplication" ca
        ON ca."id" = e."applicationId"
      JOIN "ClipperProfile" cp2
        ON cp2."id" = ca."clipperProfileId"
      ORDER BY e."views" DESC
      LIMIT ${limit}
    )
    SELECT
      "dailyRankingEntryId",
      "clipPostId",
      "applicationId",
      "submittedUrl",
      "username",
      "postedAt",
      "views",
      "likes",
      "comments",
      "shares",
      "saves",
      "platform",
      "thumbnailUrl",
      er::float8 AS er,
      "score"::int8 AS "score",
      "clipperProfileId",
      "fullName",
      "artisticName",
      "pixKey",
      "pixPayoutEligible"
    FROM joined
  `;
}

export async function fetchDailyRankPreviewByEngagement(
  db: PrismaClient,
  dailyRankingId: string,
  startDate: Date,
  endDate: Date,
  limit: number,
): Promise<DailyRankPreviewRowRaw[]> {
  return db.$queryRaw<DailyRankPreviewRowRaw[]>`
    WITH entries AS (
      SELECT
        dre."id" AS "dailyRankingEntryId",
        dre."clipPostId"        AS "clipPostId",
        dre."applicationId",
        dre."postUrl"           AS "submittedUrl",
        dre."clipperUsername"   AS "username",
        dre."postedAt",
        dre."dailyViews"        AS "views",
        dre."dailyLikes"        AS "likes",
        dre."dailyComments"     AS "comments",
        dre."dailyShares"       AS "shares",
        dre."dailySaves"        AS "saves",
        COALESCE(dre."platform", cp."platform")::text AS "platform",
        COALESCE(NULLIF(TRIM(dre."postThumbnail"), ''), cp."thumbnailUrl") AS "thumbnailUrl"
      FROM "DailyRankingEntry" dre
      INNER JOIN "ClipPost" cp ON cp."id" = dre."clipPostId"
      WHERE dre."dailyRankingId" = ${dailyRankingId}
        AND dre."postedAt" >= ${startDate}
        AND dre."postedAt" < ${endDate}
    ),
    joined AS (
      SELECT
        e."dailyRankingEntryId",
        e."clipPostId",
        e."applicationId",
        e."submittedUrl",
        e."username",
        e."postedAt",
        e."views",
        e."likes",
        e."comments",
        e."shares",
        e."saves",
        e."platform",
        e."thumbnailUrl",
        ca."clipperProfileId",
        cp2."fullName",
        cp2."artisticName",
        cp2."pixKey",
        cp2."pixPayoutEligible",
        CASE
          WHEN e."views" > 0 THEN
            TRUNC(
              ((e."likes" + e."comments" + e."shares" + COALESCE(e."saves", 0))::numeric / e."views") * 100,
              2
            )
          ELSE 0
        END AS er,
        CASE
          WHEN e."views" > 0 THEN
            TRUNC(
              e."views" *
              TRUNC(
                ((e."likes" + e."comments" + e."shares" + COALESCE(e."saves", 0))::numeric / e."views") * 100,
                2
              )
            )
          ELSE 0
        END AS "score"
      FROM entries e
      JOIN "ClipperApplication" ca
        ON ca."id" = e."applicationId"
      JOIN "ClipperProfile" cp2
        ON cp2."id" = ca."clipperProfileId"
      ORDER BY "score" DESC, e."views" DESC
      LIMIT ${limit}
    )
    SELECT
      "dailyRankingEntryId",
      "clipPostId",
      "applicationId",
      "submittedUrl",
      "username",
      "postedAt",
      "views",
      "likes",
      "comments",
      "shares",
      "saves",
      "platform",
      "thumbnailUrl",
      er::float8 AS er,
      "score"::int8 AS "score",
      "clipperProfileId",
      "fullName",
      "artisticName",
      "pixKey",
      "pixPayoutEligible"
    FROM joined
  `;
}

export async function getTotalPostsCountForDailyRanking(
  db: PrismaClient,
  dailyRankingId: string,
): Promise<number> {
  return db.dailyRankingEntry.count({
    where: { dailyRankingId },
  });
}

export async function getTotalViewsOfCampaign(
  db: PrismaClient,
  campaignId: string,
): Promise<bigint> {
  const result = await db.$queryRaw<[{ sum: bigint | null }]>`
    SELECT COALESCE(SUM(cp."views"), 0)::bigint AS sum
    FROM "ClipPost" cp
    WHERE cp."campaignId" = ${campaignId}
  `;
  return result[0]?.sum ?? BigInt(0);
}

export async function getTotalViewsAtRankingCutoff(
  db: PrismaClient,
  campaignId: string,
  cutoffDate: Date,
): Promise<bigint> {
  // Add 30-min buffer so metrics collected slightly after the cutoff hour are included
  const cutoffWithBuffer = new Date(cutoffDate.getTime() + 30 * 60 * 1000);
  const result = await db.$queryRaw<
    [
      {
        totalAtCutoffFromSnapshots: bigint | null;
        totalCurrentViews: bigint | null;
        growthAfterCutoff: bigint | null;
        postsWithSnapshot: bigint | null;
        totalPosts: bigint | null;
      },
    ]
  >`
    WITH posts AS (
      SELECT cp."id", cp."views"
      FROM "ClipPost" cp
      WHERE cp."campaignId" = ${campaignId}
    ),
    latest_before_cutoff AS (
      SELECT
        p."id" AS "clipPostId",
        (
          SELECT cpm."views"
          FROM "ClipPostMetrics" cpm
          WHERE cpm."clipPostId" = p."id"
            AND cpm."collectedAt" <= ${cutoffWithBuffer}
          ORDER BY cpm."collectedAt" DESC
          LIMIT 1
        ) AS "viewsAtCutoff"
      FROM posts p
    ),
    growth_after_cutoff AS (
      SELECT
        COALESCE(SUM(cpm."viewsDelta"), 0)::bigint AS "sumGrowth"
      FROM "ClipPostMetrics" cpm
      INNER JOIN posts p ON p."id" = cpm."clipPostId"
      WHERE cpm."collectedAt" > ${cutoffWithBuffer}
    )
    SELECT
      COALESCE(SUM(lbc."viewsAtCutoff"), 0)::bigint AS "totalAtCutoffFromSnapshots",
      COALESCE(SUM(p."views"), 0)::bigint AS "totalCurrentViews",
      (SELECT "sumGrowth" FROM growth_after_cutoff) AS "growthAfterCutoff",
      COUNT(lbc."viewsAtCutoff")::bigint AS "postsWithSnapshot",
      COUNT(*)::bigint AS "totalPosts"
    FROM posts p
    LEFT JOIN latest_before_cutoff lbc ON lbc."clipPostId" = p."id"
  `;

  const row = result[0];
  if (!row) return BigInt(0);

  const totalAtCutoffFromSnapshots =
    row.totalAtCutoffFromSnapshots ?? BigInt(0);
  const totalCurrentViews = row.totalCurrentViews ?? BigInt(0);
  const growthAfterCutoff = row.growthAfterCutoff ?? BigInt(0);
  const postsWithSnapshot = row.postsWithSnapshot ?? BigInt(0);
  const totalPosts = row.totalPosts ?? BigInt(0);

  // Preferred source: exact snapshot at/before cutoff for all posts.
  if (totalPosts > BigInt(0) && postsWithSnapshot === totalPosts) {
    return totalAtCutoffFromSnapshots;
  }

  // Fallback: estimate cutoff as current views minus growth after cutoff.
  const estimatedCutoff = totalCurrentViews - growthAfterCutoff;
  return estimatedCutoff > BigInt(0) ? estimatedCutoff : BigInt(0);
}

export async function getViewsDeltaForCampaignInPeriod(
  db: PrismaClient,
  campaignId: string,
  startDate: Date,
  endDate: Date,
): Promise<bigint> {
  // Same tolerance used by cutoff calculations.
  const startWithBuffer = new Date(startDate.getTime() + 30 * 60 * 1000);
  const endWithBuffer = new Date(endDate.getTime() + 30 * 60 * 1000);

  // Per post: growth = last views at end boundary - last views at start boundary.
  // This avoids distortions from summing raw viewsDelta rows.
  const result = await db.$queryRaw<[{ sum: bigint | null }]>`
    WITH posts AS (
      SELECT cp."id"
      FROM "ClipPost" cp
      WHERE cp."campaignId" = ${campaignId}
    ),
    post_bounds AS (
      SELECT
        p."id" AS "clipPostId",
        (
          SELECT cpm_end."views"
          FROM "ClipPostMetrics" cpm_end
          WHERE cpm_end."clipPostId" = p."id"
            AND cpm_end."collectedAt" <= ${endWithBuffer}
          ORDER BY cpm_end."collectedAt" DESC
          LIMIT 1
        ) AS "viewsEnd",
        (
          SELECT cpm_start."views"
          FROM "ClipPostMetrics" cpm_start
          WHERE cpm_start."clipPostId" = p."id"
            AND cpm_start."collectedAt" <= ${startWithBuffer}
          ORDER BY cpm_start."collectedAt" DESC
          LIMIT 1
        ) AS "viewsStart"
      FROM posts p
    )
    SELECT
      COALESCE(
        SUM(
          GREATEST(
            COALESCE("viewsEnd", 0)::bigint - COALESCE("viewsStart", 0)::bigint,
            0
          )
        ),
        0
      )::bigint AS sum
    FROM post_bounds
  `;

  return result[0]?.sum ?? BigInt(0);
}

/**
 * Regra diária (por dia civil UTC):
 * - Para cada post da campanha, pega a ÚLTIMA métrica do dia atual e do dia anterior.
 * - Crescimento do post no dia = views(dia atual) - views(dia anterior).
 * - Se não houver métrica no dia anterior, usa views(dia atual) integral.
 * - Se não houver métrica no dia atual, contribuição do post é 0.
 */
export async function getViewsDeltaByLastMetricOfDay(
  db: PrismaClient,
  campaignId: string,
  dateYmd: string,
): Promise<bigint> {
  const { startOfDay: currentDayStart, endOfDay: currentDayEnd } =
    getUtcRankingDayBounds(dateYmd);
  const previousDayStart = new Date(currentDayStart);
  previousDayStart.setUTCDate(previousDayStart.getUTCDate() - 1);
  const previousDayEnd = new Date(currentDayEnd);
  previousDayEnd.setUTCDate(previousDayEnd.getUTCDate() - 1);

  // Replaces 22k+ correlated subqueries with 2 DISTINCT ON CTEs + 1 join.
  // Each CTE does a single efficient index scan on (clipPostId, collectedAt).
  const result = await db.$queryRaw<[{ sum: bigint | null }]>`
    WITH today AS (
      SELECT DISTINCT ON (cpm."clipPostId")
        cpm."clipPostId",
        cpm."views"::bigint AS views
      FROM "ClipPostMetrics" cpm
      INNER JOIN "ClipPost" cp ON cp."id" = cpm."clipPostId"
      WHERE cp."campaignId" = ${campaignId}
        AND cpm."collectedAt" >= ${currentDayStart}
        AND cpm."collectedAt" <= ${currentDayEnd}
      ORDER BY cpm."clipPostId", cpm."collectedAt" DESC
    ),
    yesterday AS (
      SELECT DISTINCT ON (cpm."clipPostId")
        cpm."clipPostId",
        cpm."views"::bigint AS views
      FROM "ClipPostMetrics" cpm
      INNER JOIN "ClipPost" cp ON cp."id" = cpm."clipPostId"
      WHERE cp."campaignId" = ${campaignId}
        AND cpm."collectedAt" >= ${previousDayStart}
        AND cpm."collectedAt" <= ${previousDayEnd}
      ORDER BY cpm."clipPostId", cpm."collectedAt" DESC
    )
    SELECT COALESCE(SUM(
      CASE
        WHEN t.views IS NULL THEN 0
        WHEN y.views IS NULL THEN t.views
        ELSE GREATEST(t.views - y.views, 0)
      END
    ), 0)::bigint AS sum
    FROM today t
    FULL OUTER JOIN yesterday y ON t."clipPostId" = y."clipPostId"
  `;

  return result[0]?.sum ?? BigInt(0);
}

/** Contexto compartilhado entre preview do rank diário (UTC) e pagamento em lote. */
export interface DailyRankingDateContext {
  dateYmd: string;
  campaignId: string;
  campaignName: string;
  rankingMetricType: RankingMetricType;
  dailyRankingId: string;
  sortedByEngagement: boolean;
  windowStart: Date;
  windowEnd: Date;
  topCount: number;
  dailyPrizeTable: unknown;
  rawRows: DailyRankPreviewRowRaw[];
  stats: {
    totalPosts: number;
    totalCompetitionViews: bigint;
    viewsIncreaseToday: bigint;
  };
}

/**
 * Carrega campanha, snapshot do DailyRanking do dia UTC e linhas do top (mesma query do preview).
 * Retorna `null` se campanha ou ranking do dia não existir.
 */
export async function loadDailyRankingDateContext(
  db: PrismaClient,
  campaignId: string,
  dateYmd: string,
): Promise<DailyRankingDateContext | null> {
  parseUtcDateParts(dateYmd);
  const { startOfDay, endOfDay } = getUtcRankingDayBounds(dateYmd);
  const { startDate, endDate } = getPostedAtWindowUtc(dateYmd);

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      name: true,
      rankingMetricType: true,
      activeRankingRule: {
        select: {
          dailyTopCount: true,
          dailyPrizeTable: true,
        },
      },
    },
  });

  if (!campaign) {
    return null;
  }

  const dailyRanking = await db.dailyRanking.findFirst({
    where: {
      campaignId,
      rankingDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    select: { id: true, totalDailyViews: true },
    orderBy: { calculatedAt: "desc" },
  });

  if (!dailyRanking) {
    return null;
  }

  const topCount = campaign.activeRankingRule?.dailyTopCount ?? 15;
  const fetchLimit = Math.max(topCount + 35, 50);
  const sortedByEngagement =
    campaign.rankingMetricType === RankingMetricType.VIEWS_X_ENGAGEMENT;

  const rawRows = sortedByEngagement
    ? await fetchDailyRankPreviewByEngagement(
        db,
        dailyRanking.id,
        startDate,
        endDate,
        fetchLimit,
      )
    : await fetchDailyRankPreviewByViews(
        db,
        dailyRanking.id,
        startDate,
        endDate,
        fetchLimit,
      );

  const [totalPosts, totalCompetitionViews, viewsIncreaseToday] =
    await Promise.all([
      getTotalPostsCountForDailyRanking(db, dailyRanking.id),
      getTotalViewsOfCampaign(db, campaignId),
      getViewsDeltaByLastMetricOfDay(db, campaignId, dateYmd),
    ]);

  return {
    dateYmd,
    campaignId: campaign.id,
    campaignName: campaign.name,
    rankingMetricType: campaign.rankingMetricType,
    dailyRankingId: dailyRanking.id,
    sortedByEngagement,
    windowStart: startDate,
    windowEnd: endDate,
    topCount,
    dailyPrizeTable: campaign.activeRankingRule?.dailyPrizeTable ?? null,
    rawRows,
    stats: {
      totalPosts,
      totalCompetitionViews,
      viewsIncreaseToday,
    },
  };
}

const KEYCAP_DIGIT: Record<string, string> = {
  "0": "0️⃣",
  "1": "1️⃣",
  "2": "2️⃣",
  "3": "3️⃣",
  "4": "4️⃣",
  "5": "5️⃣",
  "6": "6️⃣",
  "7": "7️⃣",
  "8": "8️⃣",
  "9": "9️⃣",
};

/** 🥇🥈🥉, 🔟 para 10º, 4️⃣…9️⃣, 1️⃣1️⃣… para 11+ */
function rankPositionEmojiPrefix(position: number): string {
  if (position === 1) return "🥇";
  if (position === 2) return "🥈";
  if (position === 3) return "🥉";
  if (position === 10) return "🔟";
  if (position >= 4 && position <= 9) {
    return KEYCAP_DIGIT[String(position)[0]!] ?? `${position}º`;
  }
  return String(position)
    .split("")
    .map((d) => KEYCAP_DIGIT[d] ?? d)
    .join("");
}

function formatIntPtBR(n: number): string {
  return Math.round(Number(n)).toLocaleString("pt-BR");
}

function formatMoneyPtBR(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatBigIntStringPtBR(value: string | number | bigint): string {
  try {
    if (typeof value === "bigint") return value.toLocaleString("pt-BR");
    if (typeof value === "string") return BigInt(value).toLocaleString("pt-BR");
    return BigInt(Math.trunc(value)).toLocaleString("pt-BR");
  } catch {
    return Math.round(Number(value)).toLocaleString("pt-BR");
  }
}

const PLATFORM_LABEL: Record<string, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  KWAI: "Kwai",
  FACEBOOK: "Facebook",
};

function platformDisplayName(platform: string | null | undefined): string {
  if (!platform) return "—";
  return PLATFORM_LABEL[platform] ?? platform;
}

export interface DailyRankExportEntry {
  position: number;
  clipperName: string;
  username: string | null;
  platform: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  prize: number;
  submittedUrl: string;
  er?: number;
  score?: number;
}

export interface DailyRankExportStats {
  totalPosts: number;
  totalCompetitionViews: string;
  viewsIncreaseToday: string;
}

/**
 * Texto do ranking para Discord / .md (formato editorial com keycaps e métricas pt-BR).
 * `sortedByEngagement` é ignorado no layout do texto; a ordem das entradas já reflete o rank.
 */
export function buildDailyRankDiscordExportText(input: {
  campaignName: string;
  dateUtc: string;
  sortedByEngagement: boolean;
  entries: DailyRankExportEntry[];
  stats?: DailyRankExportStats;
}): string {
  const dateLabel = new Date(
    `${input.dateUtc}T12:00:00.000Z`,
  ).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  let text = `🏆 **RANKING DIÁRIO — ${input.campaignName}**\n`;
  text += `📅 **${dateLabel}**\n`;
  text += `\n`;

  for (const entry of input.entries) {
    const prefix = rankPositionEmojiPrefix(entry.position);
    const prizeStr = formatMoneyPtBR(entry.prize);
    text += `${prefix} **${entry.clipperName} — ${prizeStr}**\n`;
    const erStr = Number(entry.er ?? 0).toFixed(2);
    if (input.sortedByEngagement) {
      const scoreStr = formatIntPtBR(Math.round(Number(entry.score ?? 0)));
      const saves = entry.saves ?? 0;
      text += `⚡ Score: ${scoreStr} • 👀 ${formatIntPtBR(entry.views)} views • ❤️ ${formatIntPtBR(entry.likes)} • 💬 ${formatIntPtBR(entry.comments)} • 🔄 ${formatIntPtBR(entry.shares)} • 📥 ${formatIntPtBR(saves)} • 📊 ER: ${erStr}%\n`;
    } else {
      const saves = entry.saves ?? 0;
      text += `👀 ${formatIntPtBR(entry.views)} views • ❤️ ${formatIntPtBR(entry.likes)} • 💬 ${formatIntPtBR(entry.comments)} • 🔄 ${formatIntPtBR(entry.shares)} • 📥 ${formatIntPtBR(saves)} • 📊 ER: ${erStr}%\n`;
    }
    text += `📱 ${platformDisplayName(entry.platform)}\n\n`;
  }

  const totalPrize = input.entries.reduce((s, e) => s + e.prize, 0);
  const topViews = input.entries[0]?.views ?? 0;

  if (input.stats) {
    text += `🎯 **Total de posts submetidos:** ${formatIntPtBR(input.stats.totalPosts)}\n`;
    text += `👀 **Views totais da competição:** ${formatBigIntStringPtBR(input.stats.totalCompetitionViews)}\n`;
    text += `📈 **Aumento de views no dia:** ${formatBigIntStringPtBR(input.stats.viewsIncreaseToday)}\n`;
    text += `⚡ **Maior desempenho (views):** ${formatIntPtBR(topViews)}\n`;
  } else if (input.entries.length > 0) {
    text += `⚡ **Maior desempenho (views):** ${formatIntPtBR(topViews)}\n`;
  }

  text += `💵 **Premiação total distribuída:** ${formatMoneyPtBR(totalPrize)}`;

  return text;
}

export interface MonthlyRankDiscordExportEntry {
  position: number;
  displayName: string;
  usernameLabel: string;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  postsCount: number;
  engagementRate: number;
  rankingScore: number;
  prize: number;
}

export interface MonthlyRankDiscordExportStats {
  totalPostsInMonth: number;
  totalCompetitionViews: string;
}

/** Markdown para Discord — ranking mensal agregado por clipador. */
export function buildMonthlyRankDiscordExportText(input: {
  campaignName: string;
  sortedByEngagement: boolean;
  entries: MonthlyRankDiscordExportEntry[];
  stats?: MonthlyRankDiscordExportStats;
}): string {
  let text = `🏆 **RANKING MENSAL — ${input.campaignName}**\n\n`;

  let maxScore = 0;
  for (const entry of input.entries) {
    if (entry.rankingScore > maxScore) maxScore = entry.rankingScore;
  }

  for (const entry of input.entries) {
    const prefix = rankPositionEmojiPrefix(entry.position);
    const prizeStr = formatMoneyPtBR(entry.prize);
    text += `${prefix} **${entry.displayName} — ${prizeStr}**\n`;
    const erStr = Number(entry.engagementRate ?? 0).toFixed(2);
    if (input.sortedByEngagement) {
      const scoreStr = formatIntPtBR(Math.round(entry.rankingScore));
      text += `⚡ Score: ${scoreStr} • 👀 ${formatIntPtBR(entry.totalViews)} views • ❤️ ${formatIntPtBR(entry.totalLikes)} • 💬 ${formatIntPtBR(entry.totalComments)} • 🔄 ${formatIntPtBR(entry.totalShares)} • 📥 ${formatIntPtBR(entry.totalSaves)} • 📊 ER: ${erStr}%\n`;
    } else {
      text += `👀 ${formatIntPtBR(entry.totalViews)} views • ❤️ ${formatIntPtBR(entry.totalLikes)} • 💬 ${formatIntPtBR(entry.totalComments)} • 🔄 ${formatIntPtBR(entry.totalShares)} • 📥 ${formatIntPtBR(entry.totalSaves)} • 📊 ER: ${erStr}%\n`;
    }
    text += `👤 ${entry.usernameLabel}\n`;
    text += `🎯 ${formatIntPtBR(entry.postsCount)} posts elegíveis\n\n`;
  }

  const totalPrize = input.entries.reduce((s, e) => s + e.prize, 0);
  const topViews = input.entries[0]?.totalViews ?? 0;

  if (input.stats) {
    const totalComp = Number(input.stats.totalCompetitionViews) || 0;
    text += `🎯 **Posts elegíveis (campanha):** ${formatIntPtBR(input.stats.totalPostsInMonth)}\n`;
    text += `👀 **Views totais:** ${formatIntPtBR(totalComp)}\n`;
  }
  if (input.entries.length > 0) {
    text += `⚡ **Maior desempenho (views):** ${formatIntPtBR(topViews)}\n`;
  }
  if (input.sortedByEngagement && input.entries.length > 0) {
    text += `📊 **Maior Score:** ${formatIntPtBR(Math.round(maxScore))}\n`;
  }
  text += `💵 **Premiação total distribuída:** ${formatMoneyPtBR(totalPrize)}`;

  return text;
}

/**
 * Mesma regra de `canUndoRankPayments` do preview admin: top do dia com prêmio esperado
 * e todas as linhas com `dailyPrizeStatus === "PAID"`.
 */
export async function computeDailyRankWalletPaidGate(
  db: PrismaClient,
  campaignId: string,
  dateYmd: string,
): Promise<{
  core: DailyRankingDateContext;
  canUndoRankPayments: boolean;
} | null> {
  const core = await loadDailyRankingDateContext(db, campaignId, dateYmd);
  if (!core) {
    return null;
  }

  const prizeTable = parsePrizeTable(core.dailyPrizeTable);
  const entryIds = core.rawRows.map((r) => r.dailyRankingEntryId);
  const dreRows = await db.dailyRankingEntry.findMany({
    where: { id: { in: entryIds } },
    select: {
      id: true,
      dailyPrizeStatus: true,
      dailyPrizeAmount: true,
      isDisqualified: true,
    },
  });
  const dreMap = new Map(dreRows.map((e) => [e.id, e]));

  let effectiveRank = 0;
  const entries = core.rawRows.map((row) => {
    const dre = dreMap.get(row.dailyRankingEntryId);
    const isDisqualified = dre?.isDisqualified ?? false;
    if (!isDisqualified) {
      effectiveRank++;
    }
    const prize = isDisqualified
      ? 0
      : getPrizeForPosition(prizeTable, effectiveRank);
    return {
      dailyRankingEntryId: row.dailyRankingEntryId,
      prize,
      dailyPrizeStatus: dre?.dailyPrizeStatus ?? "PENDING",
      isDisqualified,
    };
  });

  const activeForPayment = entries
    .filter((e) => !e.isDisqualified)
    .slice(0, core.topCount)
    .map((e, idx) => ({
      ...e,
      effectivePrize: getPrizeForPosition(prizeTable, idx + 1),
    }));
  const withExpectedPrize = activeForPayment.filter(
    (e) => e.effectivePrize > 0,
  );
  const canUndoRankPayments =
    withExpectedPrize.length > 0 &&
    withExpectedPrize.every((e) => e.dailyPrizeStatus === "PAID");

  return { core, canUndoRankPayments };
}

/**
 * Estado efetivo do PIX do ranking diário. Não confia apenas em
 * DailyRanking.dailyPixPayoutCompleted, pois esse campo pode ter sido gravado
 * por webhooks parciais em versões antigas do fluxo.
 */
export async function computeDailyPixPayoutSettledGate(
  db: PrismaClient,
  campaignId: string,
  dateYmd: string,
): Promise<{
  core: DailyRankingDateContext;
  isSettled: boolean;
  prizeCount: number;
  unsettledCount: number;
  processingTransactionCount: number;
} | null> {
  const core = await loadDailyRankingDateContext(db, campaignId, dateYmd);
  if (!core) {
    return null;
  }

  const prizeTable = parsePrizeTable(core.dailyPrizeTable);
  const entryIds = core.rawRows.map((r) => r.dailyRankingEntryId);
  const dreRows = await db.dailyRankingEntry.findMany({
    where: { id: { in: entryIds } },
    select: {
      id: true,
      dailyPrizeStatus: true,
      dailyPrizeAmount: true,
      dailyPrizePaid: true,
      dailyPixStatus: true,
      isDisqualified: true,
    },
  });
  const dreMap = new Map(dreRows.map((e) => [e.id, e]));

  const activeForPayment = core.rawRows
    .filter((row) => {
      const dre = dreMap.get(row.dailyRankingEntryId);
      return dre && !dre.isDisqualified;
    })
    .slice(0, core.topCount)
    .map((row, idx) => ({
      row,
      expectedPrize: getPrizeForPosition(prizeTable, idx + 1),
      dre: dreMap.get(row.dailyRankingEntryId),
    }))
    .filter(
      (entry) =>
        entry.expectedPrize > 0 && entry.row.pixPayoutEligible,
    );

  const isSettledEntry = (entry: {
    dre: (typeof dreRows)[number] | undefined;
    expectedPrize: number;
  }) => {
    const { dre, expectedPrize } = entry;
    if (!dre) return false;
    return (
      dre.dailyPrizeStatus === "PAID" &&
      amountsClose(dre.dailyPrizeAmount, expectedPrize) &&
      dre.dailyPixStatus === "PAID" &&
      dre.dailyPrizePaid
    );
  };
  const unsettledCount = activeForPayment.filter(
    (entry) => !isSettledEntry(entry),
  ).length;
  const expectedEntryIds = new Set(
    activeForPayment.map((entry) => entry.row.dailyRankingEntryId),
  );
  const settledEntryIds = new Set(
    activeForPayment
      .filter((entry) => isSettledEntry(entry))
      .map((entry) => entry.row.dailyRankingEntryId),
  );

  const processingTransactions = await db.transaction.findMany({
    where: {
      status: TransactionStatus.PROCESSING,
      metadata: { path: ["source"], equals: "daily_ranking_pix" },
      AND: [
        {
          metadata: {
            path: ["dailyRankingId"],
            equals: core.dailyRankingId,
          },
        },
      ],
    },
    select: { metadata: true },
  });
  const processingTransactionCount = processingTransactions.filter((tx) => {
    const metadata = tx.metadata as { dailyRankingEntryId?: string } | null;
    const entryId = metadata?.dailyRankingEntryId;
    if (!entryId || !expectedEntryIds.has(entryId)) return true;
    return !settledEntryIds.has(entryId);
  }).length;

  return {
    core,
    isSettled:
      activeForPayment.length > 0 &&
      unsettledCount === 0 &&
      processingTransactionCount === 0,
    prizeCount: activeForPayment.length,
    unsettledCount,
    processingTransactionCount,
  };
}
