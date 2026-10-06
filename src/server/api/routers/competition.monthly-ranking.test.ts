import { beforeEach, describe, expect, it, vi } from "vitest";

const currentUser = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ currentUser }));
vi.mock("@/server/db", () => ({ db: {} }));

import { campaignRouter } from "./competition";
import { computeMonthlyLeaderboard } from "@/lib/monthly-ranking-leaderboard";

function fixture(status: "ACTIVE" | "COMPLETED") {
  const campaign = {
    id: "campaign-1",
    name: "Competição",
    slug: "competicao",
    status,
    startDate: new Date("2026-09-02T23:00:00Z"),
    endDate: new Date("2026-10-02T23:00:00Z"),
    platforms: [],
    requiredHashtags: [],
    requiredMentions: [],
    performanceVideos: [],
    rankingMetricType: "VIEWS_X_ENGAGEMENT" as const,
    activeRankingRule: { monthlyTopCount: 5, monthlyPrizeTable: { "1": 2200 } },
  };
  const apps = [1, 2].map((i) => ({
    id: `app-${i}`,
    clipperProfileId: `clipper-${i}`,
    clipperProfile: {
      fullName: `Nome ${i}`,
      artisticName: `Clipador ${i}`,
      user: { imageUrl: null },
      clan: null,
    },
  }));
  const db = {
    campaign: { findUnique: vi.fn().mockResolvedValue(campaign) },
    clipperProfile: {
      findUnique: vi.fn().mockResolvedValue({ id: "clipper-2" }),
    },
    clipperApplication: {
      findUnique: vi.fn().mockResolvedValue({ id: "app-2" }),
      count: vi.fn().mockResolvedValue(2),
      findMany: vi.fn().mockResolvedValue(apps),
    },
    clipPost: {
      count: vi.fn().mockResolvedValue(2),
      findMany: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _sum: {}, _count: { id: 0 } }),
      groupBy: vi.fn().mockResolvedValue([
        {
          applicationId: "app-1",
          _sum: { views: 100n, likes: 10, comments: 0, shares: 0, saves: 0 },
          _count: { id: 1 },
        },
        {
          applicationId: "app-2",
          _sum: { views: 200n, likes: 10, comments: 0, shares: 0, saves: 0 },
          _count: { id: 1 },
        },
        {
          applicationId: "rejected",
          _sum: { views: 10000n, likes: 1000 },
          _count: { id: 1 },
        },
      ]),
    },
    $queryRaw: vi.fn().mockResolvedValue([
      {
        clipPostId: "post-1",
        applicationId: "app-1",
        views: 100n,
        likes: 20,
        comments: 0,
        shares: 0,
        saves: 0,
      },
      {
        clipPostId: "post-2",
        applicationId: "app-2",
        views: 200n,
        likes: 5,
        comments: 0,
        shares: 0,
        saves: 0,
      },
    ]),
    monthlyRankingEntry: {
      findFirst: vi.fn().mockResolvedValue({ position: 1 }),
    },
    transaction: { aggregate: vi.fn().mockResolvedValue({ _sum: {} }) },
    dailyRanking: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    clipPostMetrics: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return {
    db,
    campaign,
    api: campaignRouter.createCaller({ db, headers: new Headers() } as never),
  };
}

beforeEach(() => {
  currentUser.mockResolvedValue({ id: "user-2" });
});

describe("ranking mensal do clipador alinhado ao ADMIN", () => {
  it.each(["ACTIVE", "COMPLETED"] as const)(
    "usa a mesma lista em campanha %s",
    async (status) => {
      const { db, campaign, api } = fixture(status);
      const admin = await computeMonthlyLeaderboard(
        db as never,
        campaign.id,
        campaign,
      );
      const result = await api.getCompetitionDetails({ slug: campaign.slug });
      expect(result.topRanking).toEqual(
        admin!.rows.map((row) => ({
          position: row.position,
          username: `@${row.clipperUsername}`,
          imageUrl: row.clipperImageUrl,
          totalViews: row.totalViews,
          rankingScore: row.rankingScore,
          engagementRate: row.engagementRate,
          totalPosts: row.postsCount,
          isCurrentUser: row.clipperProfileId === "clipper-2",
          clanTag: row.clanTag,
          clanEmoji: row.clanEmoji,
          clanEmojiColor: row.clanEmojiColor,
        })),
      );
      expect(result.myMonthlyRanking).toBe(status === "ACTIVE" ? 1 : 2);
      expect(result.myCurrentRanking).toBe(result.myMonthlyRanking);
      expect(db.monthlyRankingEntry.findFirst).not.toHaveBeenCalled();
      expect(db.clipperApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { campaignId: campaign.id, status: "APPROVED" },
        }),
      );
      if (status === "COMPLETED") {
        expect(db.clipPost.groupBy).not.toHaveBeenCalled();
        expect(db.$queryRaw.mock.calls[0]?.[2]).toEqual(
          new Date("2026-10-03T02:30:00Z"),
        );
      } else {
        expect(result.topRanking.map((row) => row.username)).toEqual([
          "@Clipador 2",
          "@Clipador 1",
        ]);
      }
    },
  );
});
