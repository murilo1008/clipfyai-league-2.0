import type { PrismaClient } from "@prisma/client";
import { RankingMetricType } from "@prisma/client";
import { calculateEngagementRate, calculateRankingScore } from "@/lib/ranking-helpers";
import {
  getPostedAtWindowUtc,
  getPrizeForPosition,
  getUtcRankingDayBounds,
  parsePrizeTable,
} from "@/lib/daily-ranking-preview";

type DailyLivePostInput = {
  postId: string;
  clipperName: string;
  clipperImageUrl: string | null;
  username: string;
  platform: string | null;
  thumbnailUrl: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  postedAtIso: string;
  isCurrentUser: boolean;
  clanTag: string | null;
  clanEmoji: string | null;
  clanEmojiColor: string | null;
};

export type DailyClipperRankingItem = {
  position: number;
  postId: string;
  clipperName: string;
  clipperImageUrl: string | null;
  username: string;
  platform: string | null;
  thumbnailUrl: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  postedAt: string;
  isCurrentUser: boolean;
  engagementRate: number;
  rankingScore: number;
  prize: number;
  clanTag: string | null;
  clanEmoji: string | null;
  clanEmojiColor: string | null;
};

function getBrazilDateParts(now: Date): { year: number; month: number; day: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const read = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
  };
}

function toYmd(parts: { year: number; month: number; day: number }): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function getClipperDailyReferenceDateYmd(now: Date = new Date()): string {
  const brasilia = getBrazilDateParts(now);
  const date = new Date(Date.UTC(brasilia.year, brasilia.month - 1, brasilia.day));
  if (brasilia.hour < 6) {
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return toYmd({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

export function getLiveDailyWindowByReferenceDate(dateYmd: string): { startDate: Date; endDate: Date } {
  return getPostedAtWindowUtc(dateYmd);
}

/**
 * Métricas usadas no preview/admin (SQL em `daily-ranking-preview`): `dailyViews`, `dailyLikes`, …
 * O rank "live" precisa usar as mesmas colunas quando já existir `DailyRanking` + `DailyRankingEntry`,
 * senão o score usa totais de `ClipPost` e diverge do admin.
 */
export type DailyEntryMetricsForRank = {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
};

export async function loadDailyRankingEntryMetricsMap(
  db: PrismaClient,
  campaignId: string,
  dateYmd: string
): Promise<Map<string, DailyEntryMetricsForRank>> {
  const { startOfDay, endOfDay } = getUtcRankingDayBounds(dateYmd);
  const dailyRanking = await db.dailyRanking.findFirst({
    where: {
      campaignId,
      rankingDate: { gte: startOfDay, lte: endOfDay },
    },
    select: { id: true },
    orderBy: { calculatedAt: "desc" },
  });
  if (!dailyRanking) {
    return new Map();
  }

  const rows = await db.dailyRankingEntry.findMany({
    where: { dailyRankingId: dailyRanking.id },
    select: {
      clipPostId: true,
      dailyViews: true,
      dailyLikes: true,
      dailyComments: true,
      dailyShares: true,
      dailySaves: true,
    },
  });

  return new Map(
    rows.map((r) => [
      r.clipPostId,
      {
        views: Number(r.dailyViews),
        likes: r.dailyLikes,
        comments: r.dailyComments,
        shares: r.dailyShares,
        saves: r.dailySaves ?? 0,
      },
    ])
  );
}

export function pickMetricsForDailyRank(
  clipPostId: string,
  clipPostTotals: DailyEntryMetricsForRank,
  dailyMap: Map<string, DailyEntryMetricsForRank>
): { metrics: DailyEntryMetricsForRank; source: "daily_entry" | "clip_post" } {
  const fromDaily = dailyMap.get(clipPostId);
  if (fromDaily) {
    return { metrics: fromDaily, source: "daily_entry" };
  }
  return { metrics: clipPostTotals, source: "clip_post" };
}

export function rankLiveDailyPosts(params: {
  posts: DailyLivePostInput[];
  metricType: RankingMetricType;
  topCount: number;
  dailyPrizeTable: unknown;
}): DailyClipperRankingItem[] {
  const prizeTable = parsePrizeTable(params.dailyPrizeTable);
  return params.posts
    .map((post) => {
      const engagementRate = calculateEngagementRate(
        post.views,
        post.likes,
        post.comments,
        post.shares,
        post.saves
      );
      const rankingScore = calculateRankingScore(
        params.metricType,
        post.views,
        post.likes,
        post.comments,
        post.shares,
        post.saves
      );
      return { ...post, engagementRate, rankingScore };
    })
    .sort((a, b) => {
      if (b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore;
      return b.views - a.views;
    })
    .slice(0, params.topCount)
    .map((post, index) => {
      const position = index + 1;
      return {
        position,
        postId: post.postId,
        clipperName: post.clipperName,
        clipperImageUrl: post.clipperImageUrl,
        username: post.username,
        platform: post.platform,
        thumbnailUrl: post.thumbnailUrl,
        views: post.views,
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        saves: post.saves,
        postedAt: post.postedAtIso,
        isCurrentUser: post.isCurrentUser,
        engagementRate: post.engagementRate,
        rankingScore: post.rankingScore,
        prize: getPrizeForPosition(prizeTable, position),
        clanTag: post.clanTag,
        clanEmoji: post.clanEmoji,
        clanEmojiColor: post.clanEmojiColor,
      };
    });
}
