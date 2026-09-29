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

type ViewsHistoryRow = {
  date: Date;
  clipPostId: string;
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
  rows: ViewsHistoryRow[];
  currentTotalViews: number;
  investedAmount: number;
  referenceCpm: number;
  startDate: Date;
  endDate: Date;
  currentDate?: Date;
}) {
  const rowsByDay = new Map<string, ViewsHistoryRow[]>();
  for (const row of input.rows) {
    const day = performanceDayKey(row.date);
    const rows = rowsByDay.get(day) ?? [];
    rows.push(row);
    rowsByDay.set(day, rows);
  }

  const requestedEnd = input.endDate.getTime();
  const now = input.currentDate ?? new Date();
  const effectiveEnd = new Date(Math.min(requestedEnd, now.getTime()));
  const endDay = performanceDayKey(effectiveEnd);
  const firstCollectionDay = [...rowsByDay.keys()]
    .sort()
    .find((day) => day <= endDay);

  if (!firstCollectionDay) return [];

  const latestViewsByPost = new Map<string, number>();
  let highestTotalViews = 0;
  const dailyTotals: Array<{ date: string; totalViews: number }> = [];
  for (
    let cursor = new Date(`${firstCollectionDay}T12:00:00.000Z`);
    cursor <= new Date(`${endDay}T12:00:00.000Z`);
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const date = cursor.toISOString().slice(0, 10);
    const rows = rowsByDay.get(date) ?? [];
    if (rows.length > 0) {
      for (const row of rows) {
        latestViewsByPost.set(row.clipPostId, Number(row.views));
      }
      const collectedTotal = [...latestViewsByPost.values()].reduce(
        (total, views) => total + views,
        0,
      );
      highestTotalViews = Math.max(highestTotalViews, collectedTotal);
    }
    dailyTotals.push({ date, totalViews: highestTotalViews });
  }

  if (input.endDate.getTime() >= now.getTime()) {
    const currentPoint = dailyTotals.at(-1);
    if (currentPoint) {
      currentPoint.totalViews = Math.max(
        currentPoint.totalViews,
        input.currentTotalViews,
      );
    }
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

export async function getCampaignPerformance(
  db: PrismaClient,
  campaignId: string,
) {
  const campaign = await db.campaign.findUnique({
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
  });

  if (!campaign) return null;

  const historyEnd = new Date(Math.min(campaign.endDate.getTime(), Date.now()));
  const viewsHistory = await db.$queryRaw<ViewsHistoryRow[]>`
      WITH day_bounds AS (
        SELECT
          DATE_TRUNC('day', MIN(post."postedAt") + INTERVAL '4 hours') AS first_day,
          DATE_TRUNC('day', ${historyEnd}::timestamp + INTERVAL '4 hours') AS last_day
        FROM "ClipPost" post
        WHERE post."campaignId" = ${campaignId}
          AND post.status = 'ELIGIBLE'
          AND post."postedAt" IS NOT NULL
      ),
      performance_days AS (
        SELECT GENERATE_SERIES(first_day, last_day, INTERVAL '1 day') AS day
        FROM day_bounds
        WHERE first_day IS NOT NULL
      )
      SELECT
        performance_days.day AS date,
        post.id AS "clipPostId",
        latest_metrics.views::bigint AS views
      FROM performance_days
      INNER JOIN "ClipPost" post
        ON post."campaignId" = ${campaignId}
        AND post.status = 'ELIGIBLE'
        AND post."postedAt" IS NOT NULL
        AND post."postedAt" < performance_days.day + INTERVAL '20 hours'
      INNER JOIN LATERAL (
        SELECT metrics.views
        FROM "ClipPostMetrics" metrics
        WHERE metrics."clipPostId" = post.id
          AND metrics."collectedAt" >= ${campaign.startDate}
          AND metrics."collectedAt" <= LEAST(
            performance_days.day + INTERVAL '1 day 5 hours',
            ${historyEnd}
          )
        ORDER BY metrics."collectedAt" DESC
        LIMIT 1
      ) latest_metrics ON true
      ORDER BY performance_days.day ASC, post.id ASC
    `;

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
    currentTotalViews: 0,
    investedAmount,
    referenceCpm,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
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
