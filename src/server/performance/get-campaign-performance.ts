import type { PrismaClient } from "@prisma/client";

export const DEFAULT_REFERENCE_CPM = 13;

export function calculatePerformanceSummary(input: {
  totalViews: number;
  investedAmount: number;
  referenceCpm: number;
}) {
  const { totalViews, investedAmount, referenceCpm } = input;
  const effectiveCpm =
    totalViews > 0 && investedAmount > 0
      ? (investedAmount / totalViews) * 1_000
      : 0;
  const equivalentAdsCost =
    totalViews > 0 && referenceCpm > 0
      ? (totalViews / 1_000) * referenceCpm
      : 0;
  const estimatedSavings = equivalentAdsCost - investedAmount;
  return {
    totalViews,
    investedAmount,
    referenceCpm,
    effectiveCpm,
    equivalentAdsCost,
    estimatedSavings,
    savingsPercentage:
      equivalentAdsCost > 0 ? (estimatedSavings / equivalentAdsCost) * 100 : 0,
  };
}

/** Total da competição no fim de cada dia operacional com coleta. */
type DailyViewsRow = {
  date: Date;
  views: bigint;
};

/**
 * O dia operacional D compreende [D-1 20:00 UTC, D 20:00 UTC).
 * Somar quatro horas transforma esse corte em uma troca à meia-noite, sem
 * aplicar uma segunda conversão aos timestamps já persistidos.
 */
export function performanceDayKey(date: Date) {
  return new Date(date.getTime() + 4 * 60 * 60 * 1_000)
    .toISOString()
    .slice(0, 10);
}

export function buildCumulativeCpmHistory(input: {
  rows: DailyViewsRow[];
  currentTotalViews: number;
  investedAmount: number;
  referenceCpm: number;
  currentDate?: Date;
}) {
  const totalsByDay = new Map<string, number>();
  for (const row of input.rows) {
    totalsByDay.set(performanceDayKey(row.date), Number(row.views));
  }

  const now = input.currentDate ?? new Date();
  const endDay = performanceDayKey(now);
  const firstCollectionDay = [...totalsByDay.keys()]
    .sort()
    .find((day) => day <= endDay);

  if (!firstCollectionDay) return [];

  // Dias sem coleta repetem o total anterior; o máximo impede que uma
  // correção negativa de views crie um pico de CPM.
  let highestTotalViews = 0;
  const dailyTotals: Array<{ date: string; totalViews: number }> = [];
  for (
    let cursor = new Date(`${firstCollectionDay}T12:00:00.000Z`);
    cursor <= new Date(`${endDay}T12:00:00.000Z`);
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const date = cursor.toISOString().slice(0, 10);
    const collectedTotal = totalsByDay.get(date);
    if (collectedTotal !== undefined) {
      highestTotalViews = Math.max(highestTotalViews, collectedTotal);
    }
    dailyTotals.push({ date, totalViews: highestTotalViews });
  }

  const currentPoint = dailyTotals.at(-1);
  if (currentPoint) {
    currentPoint.totalViews = Math.max(
      currentPoint.totalViews,
      input.currentTotalViews,
    );
  }

  return dailyTotals.map((point) => {
    const summary = calculatePerformanceSummary({
      totalViews: point.totalViews,
      investedAmount: input.investedAmount,
      referenceCpm: input.referenceCpm,
    });
    return {
      // Meio-dia UTC preserva o mesmo dia civil em America/Sao_Paulo.
      // À meia-noite UTC, o frontend em BRT exibiria a véspera (21:00).
      date: `${point.date}T12:00:00.000Z`,
      totalViews: point.totalViews,
      investment: input.investedAmount,
      effectiveCpm: point.totalViews > 0 ? summary.effectiveCpm : null,
      referenceCpm: input.referenceCpm,
      estimatedAdsCost: summary.equivalentAdsCost,
      savings: summary.estimatedSavings,
    };
  });
}

/**
 * Cada post conta a partir do dia em que foi postado, com a última coleta até
 * o fim de cada dia. A última coleta do post em cada dia vira a variação dele
 * naquele dia, e a soma acumulada das variações é o total da competição.
 *
 * O LATERAL com OFFSET 0 obriga a ler as métricas post a post pelo índice
 * (clipPostId, collectedAt). Sem ele, o planner troca por uma varredura de
 * todas as métricas do período: ClipPostMetrics tem dezenas de milhões de
 * linhas e a consulta passa de 60 s.
 */
function queryDailyViewsHistory(
  db: PrismaClient,
  campaignId: string,
  startDate: Date,
  historyEnd: Date,
) {
  return db.$queryRaw<DailyViewsRow[]>`
      WITH posts AS (
        SELECT
          post.id,
          DATE_TRUNC('day', post."postedAt" + INTERVAL '4 hours') AS posted_day
        FROM "ClipPost" post
        WHERE post."campaignId" = ${campaignId}
          AND post.status = 'ELIGIBLE'
          AND post."postedAt" IS NOT NULL
      ),
      post_days AS (
        SELECT DISTINCT ON (posts.id, collected.day)
          posts.id AS post_id,
          collected.day,
          collected.views
        FROM posts
        CROSS JOIN LATERAL (
          SELECT
            GREATEST(
              DATE_TRUNC('day', metrics."collectedAt" + INTERVAL '4 hours'),
              posts.posted_day
            ) AS day,
            metrics.views,
            metrics."collectedAt"
          FROM "ClipPostMetrics" metrics
          WHERE metrics."clipPostId" = posts.id
            AND metrics."collectedAt" >= ${startDate}::timestamp
            AND metrics."collectedAt" <= ${historyEnd}::timestamp
          OFFSET 0
        ) collected
        ORDER BY posts.id, collected.day, collected."collectedAt" DESC
      ),
      deltas AS (
        SELECT
          day,
          views - LAG(views, 1, 0::bigint) OVER (
            PARTITION BY post_id ORDER BY day
          ) AS delta
        FROM post_days
      )
      SELECT
        day AS date,
        (SUM(SUM(delta)) OVER (ORDER BY day))::bigint AS views
      FROM deltas
      GROUP BY day
      ORDER BY day
    `;
}

/**
 * Dias encerrados não mudam, e o ponto de hoje é completado pela soma ao vivo
 * de ClipPost.views. Por isso a série é reaproveitada entre consultas: o
 * polling das telas e quem abre a mesma competição dividem uma única leitura.
 */
const VIEWS_HISTORY_TTL_MS = 10 * 60_000;
const viewsHistoryCache = new Map<
  string,
  { expiresAt: number; rows: Promise<DailyViewsRow[]> }
>();

function getDailyViewsHistory(
  db: PrismaClient,
  campaignId: string,
  startDate: Date,
) {
  const key = `${campaignId}:${startDate.getTime()}`;
  const now = Date.now();
  const cached = viewsHistoryCache.get(key);
  if (cached && cached.expiresAt > now) return cached.rows;

  for (const [cachedKey, entry] of viewsHistoryCache) {
    if (entry.expiresAt <= now) viewsHistoryCache.delete(cachedKey);
  }

  // A promessa entra no cache antes de resolver: consultas simultâneas
  // aguardam a mesma leitura. Falhas saem do cache para a próxima tentar.
  const rows = queryDailyViewsHistory(
    db,
    campaignId,
    startDate,
    new Date(now),
  );
  viewsHistoryCache.set(key, { expiresAt: now + VIEWS_HISTORY_TTL_MS, rows });
  rows.catch(() => {
    if (viewsHistoryCache.get(key)?.rows === rows) {
      viewsHistoryCache.delete(key);
    }
  });
  return rows;
}

export async function getCampaignPerformance(
  db: PrismaClient,
  campaignId: string,
) {
  const [campaign, currentViews] = await Promise.all([
    db.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        startDate: true,
        endDate: true,
        platforms: true,
        requiredMentions: true,
        performanceSettings: true,
        performanceProfiles: {
          orderBy: { createdAt: "asc" },
          include: { snapshots: { orderBy: { collectedAt: "asc" } } },
        },
        performanceVideos: {
          orderBy: { createdAt: "desc" },
          include: { snapshots: { orderBy: { collectedAt: "asc" } } },
        },
      },
    }),
    db.clipPost.aggregate({
      where: {
        campaignId,
        status: "ELIGIBLE",
        postedAt: { not: null },
      },
      _sum: { views: true },
    }),
  ]);

  if (!campaign) return null;

  const viewsHistory = await getDailyViewsHistory(
    db,
    campaignId,
    campaign.startDate,
  );

  const investedAmount = Number(
    campaign.performanceSettings?.investedAmount ?? 0,
  );
  const referenceCpm = Number(
    campaign.performanceSettings?.referenceCpm ?? DEFAULT_REFERENCE_CPM,
  );
  const platformBenchmark: Record<string, number> = {
    INSTAGRAM: 12,
    FACEBOOK: 12,
    TIKTOK: 8,
    KWAI: 8,
    YOUTUBE: 19,
  };
  const suggestedValues = campaign.platforms
    .map((platform) => platformBenchmark[platform])
    .filter((value): value is number => typeof value === "number");
  const suggestedReferenceCpm =
    suggestedValues.length > 0
      ? suggestedValues.reduce((total, value) => total + value, 0) /
        suggestedValues.length
      : 12;
  const cpmHistory = buildCumulativeCpmHistory({
    rows: viewsHistory,
    currentTotalViews: Number(currentViews._sum.views ?? 0),
    investedAmount,
    referenceCpm,
  });
  const totalViews = cpmHistory.at(-1)?.totalViews ?? 0;
  const summary = calculatePerformanceSummary({
    totalViews,
    investedAmount,
    referenceCpm,
  });

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      slug: campaign.slug,
      status: campaign.status,
      startDate: campaign.startDate.toISOString(),
      endDate: campaign.endDate.toISOString(),
      platforms: campaign.platforms,
      requiredMentions: campaign.requiredMentions,
    },
    settings: {
      investedAmount,
      referenceCpm,
      benchmarkSource: campaign.performanceSettings?.benchmarkSource ?? "",
      benchmarkSourceUrl:
        campaign.performanceSettings?.benchmarkSourceUrl ?? "",
      benchmarkDate:
        campaign.performanceSettings?.benchmarkDate?.toISOString() ?? null,
      notes: campaign.performanceSettings?.notes ?? "",
    },
    benchmarkSuggestion: {
      referenceCpm: suggestedReferenceCpm,
      source: "Benchmark de vídeo/awareness no Brasil",
      platformValues: campaign.platforms.map((platform) => ({
        platform,
        referenceCpm: platformBenchmark[platform] ?? 12,
      })),
    },
    summary,
    cpmHistory,
    profiles: campaign.performanceProfiles.map((profile) => {
      const first = profile.snapshots[0];
      const currentFollowers =
        profile.currentFollowers ?? first?.followers ?? 0;
      const initialFollowers = first?.followers ?? currentFollowers;
      const growth = currentFollowers - initialFollowers;
      return {
        id: profile.id,
        platform: profile.platform,
        username: profile.username,
        profileUrl: profile.profileUrl,
        label: profile.label,
        isActive: profile.isActive,
        currentFollowers,
        initialFollowers,
        growth,
        growthPercentage:
          initialFollowers > 0 ? (growth / initialFollowers) * 100 : 0,
        lastCollectedAt: profile.lastCollectedAt?.toISOString() ?? null,
        lastError: profile.lastError,
        history: profile.snapshots.map((snapshot) => ({
          followers: snapshot.followers,
          collectedAt: snapshot.collectedAt.toISOString(),
        })),
      };
    }),
    videos: campaign.performanceVideos.map((video) => {
      const first = video.snapshots[0];
      const currentViews = Number(video.currentViews);
      const initialViews = Number(first?.views ?? video.currentViews);
      return {
        id: video.id,
        platform: video.platform,
        originalUrl: video.originalUrl,
        platformVideoId: video.platformVideoId,
        title: video.title,
        description: video.description,
        thumbnailUrl: video.thumbnailUrl,
        isActive: video.isActive,
        currentViews,
        currentLikes: video.currentLikes,
        currentComments: video.currentComments,
        currentShares: video.currentShares,
        initialViews,
        viewsGrowth: currentViews - initialViews,
        lastCollectedAt: video.lastCollectedAt?.toISOString() ?? null,
        lastError: video.lastError,
        notifyClippers: video.notifyClippers,
        notificationSentAt: video.notificationSentAt?.toISOString() ?? null,
        notificationRecipientCount: video.notificationRecipientCount,
        notificationLastError: video.notificationLastError,
        createdAt: video.createdAt.toISOString(),
        history: video.snapshots.map((snapshot) => ({
          views: Number(snapshot.views),
          likes: snapshot.likes,
          comments: snapshot.comments,
          shares: snapshot.shares,
          collectedAt: snapshot.collectedAt.toISOString(),
        })),
      };
    }),
  };
}
