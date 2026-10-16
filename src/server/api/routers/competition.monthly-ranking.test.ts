import { beforeEach, describe, expect, it, vi } from "vitest";

const currentUser = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({
  currentUser,
  // privateProcedure autentica via auth(); deriva do mesmo mock de currentUser
  auth: async () => ({ userId: ((await currentUser()) as { id?: string } | null)?.id ?? null }),
}));
vi.mock("@/server/db", () => ({ db: {} }));

import { campaignRouter, monthlyLeaderboardCacheTtlMs } from "./competition";
import { computeMonthlyLeaderboard } from "@/lib/monthly-ranking-leaderboard";
import { invalidateCachedQueries } from "@/server/memory-cache";

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
    // Sem sanções de advertência (redutor, suspensão, retenção).
    clipperSanction: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    campaign: { findUnique: vi.fn().mockResolvedValue(campaign) },
    clipperProfile: {
      findUnique: vi.fn().mockResolvedValue({ id: "clipper-2" }),
    },
    clipperApplication: {
      findUnique: vi.fn().mockResolvedValue({ id: "app-2", status: "APPROVED" }),
      count: vi.fn().mockResolvedValue(2),
      findMany: vi.fn().mockResolvedValue(apps),
    },
    clipPost: {
      count: vi.fn().mockResolvedValue(2),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      aggregate: vi.fn().mockResolvedValue({ _sum: {}, _count: { id: 0 } }),
      // Só o groupBy por inscrição (ranking mensal ativo) tem dados aqui.
      groupBy: vi.fn().mockImplementation(async ({ by }: { by: string[] }) =>
        by[0] !== "applicationId" ? [] : [
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
    // Ranking histórico (último snapshot por post até o corte, somado por inscrição);
    // as demais consultas SQL da página (crescimento, maior ER) ficam vazias.
    $queryRaw: vi.fn().mockImplementation(async (parts: TemplateStringsArray) =>
      parts.join("?").includes('GROUP BY p."applicationId"')
        ? [
            {
              applicationId: "app-1",
              views: 100n,
              likes: 20n,
              comments: 0n,
              shares: 0n,
              saves: 0n,
              postsCount: 1n,
            },
            {
              applicationId: "app-2",
              views: 200n,
              likes: 5n,
              comments: 0n,
              shares: 0n,
              saves: 0n,
              postsCount: 1n,
            },
          ]
        : [],
    ),
    monthlyRankingEntry: {
      findFirst: vi.fn().mockResolvedValue({ position: 1 }),
    },
    transaction: { aggregate: vi.fn().mockResolvedValue({ _sum: {} }) },
    dailyRanking: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    clipPostMetrics: { findMany: vi.fn().mockResolvedValue([]) },
    applicationSocialAccount: { count: vi.fn().mockResolvedValue(0) },
  };
  return {
    db,
    campaign,
    api: campaignRouter.createCaller({ db, headers: new Headers() } as never),
  };
}

beforeEach(() => {
  invalidateCachedQueries("");
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
      const ranking = await api.getCompetitionRanking({
        campaignId: campaign.id,
      });
      expect(ranking.topRanking).toEqual(
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
        expect(db.clipPost.groupBy).not.toHaveBeenCalledWith(
          expect.objectContaining({ by: ["applicationId"] }),
        );
        const historicalCall = db.$queryRaw.mock.calls.find((call) =>
          (call[0] as TemplateStringsArray)
            .join("?")
            .includes('GROUP BY p."applicationId"'),
        );
        expect(historicalCall?.[2]).toEqual(new Date("2026-10-03T02:30:00Z"));
      } else {
        expect(ranking.topRanking.map((row) => row.username)).toEqual([
          "@Clipador 2",
          "@Clipador 1",
        ]);
      }
    },
  );
});

describe("TTL do ranking mensal no cache", () => {
  const endDate = new Date("2026-10-02T23:00:00Z");
  // Corte do ranking de campanha concluída: endDate + 3h30.
  const cutoff = endDate.getTime() + (3 * 60 + 30) * 60 * 1000;
  const hour = 60 * 60 * 1000;
  it.each([
    ["ACTIVE", cutoff + 100 * hour, 60 * 1000],
    ["PAUSED", cutoff + 100 * hour, 60 * 1000],
    // Concluída antes do corte: métricas ainda entram no ranking.
    ["COMPLETED", cutoff - 1, 60 * 1000],
    ["COMPLETED", cutoff, 5 * 60 * 1000],
    ["COMPLETED", cutoff + 48 * hour - 1, 5 * 60 * 1000],
    ["COMPLETED", cutoff + 48 * hour, 6 * hour],
  ] as const)("%s em %s usa %s ms", (status, now, expected) => {
    expect(monthlyLeaderboardCacheTtlMs({ status, endDate }, now)).toBe(expected);
  });
});
