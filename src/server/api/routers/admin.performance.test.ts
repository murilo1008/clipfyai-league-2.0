import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: "admin-1" }),
  currentUser: vi.fn(),
  clerkClient: vi.fn(),
}));
vi.mock("@/server/db", () => ({ db: {} }));

import { invalidateCachedQueries } from "@/server/memory-cache";
import { adminRouter } from "./admin";

/** Reconstrói a consulta de um `$queryRaw` usado como tagged template. */
function sqlOf(call: unknown[]) {
  const [strings, ...values] = call as [TemplateStringsArray, ...unknown[]];
  return Prisma.sql(strings, ...values);
}

function caller(db: Record<string, unknown>) {
  return adminRouter.createCaller({
    db: {
      user: { findUnique: vi.fn().mockResolvedValue({ role: "ADMIN" }) },
      ...db,
    },
    headers: new Headers(),
  } as never);
}

beforeEach(() => {
  invalidateCachedQueries("admin:");
});

describe("getCompetitionChartsAdmin", () => {
  it("agrega as views por dia no banco e ajusta o último ponto", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-03T12:00:00.000Z"));
    const groupBy = vi.fn().mockResolvedValue([
      {
        platform: "TIKTOK",
        _sum: { views: 900n, likes: 9, comments: 1, shares: 2, saves: null },
        _count: { id: 3 },
      },
      {
        platform: "INSTAGRAM",
        _sum: { views: 100n, likes: 1, comments: 0, shares: 0, saves: 4 },
        _count: { id: 1 },
      },
    ]);
    const queryRaw = vi.fn().mockResolvedValue([
      { day: "2026-10-01", platform: "TIKTOK", views: 300n },
      { day: "2026-10-02", platform: "TIKTOK", views: 200n },
      { day: "2026-10-02", platform: "INSTAGRAM", views: 50n },
    ]);
    const api = caller({
      campaign: {
        findUnique: vi.fn().mockResolvedValue({
          id: "c1",
          startDate: new Date("2026-10-01T00:00:00.000Z"),
          endDate: new Date("2026-10-30T00:00:00.000Z"),
        }),
      },
      clipPost: { groupBy },
      $queryRaw: queryRaw,
    });

    const result = await api.getCompetitionChartsAdmin({ slug: "c" });
    vi.useRealTimers();

    expect(groupBy).toHaveBeenCalledOnce();
    const query = sqlOf(queryRaw.mock.calls[0]!);
    expect(query.sql).toContain("GROUP BY 1, 2");
    expect(query.sql).toContain("AT TIME ZONE");
    expect(result.growthPlatforms).toEqual(["INSTAGRAM", "TIKTOK"]);
    expect(result.platformDistribution).toEqual([
      {
        platform: "TIKTOK",
        posts: 3,
        views: 900,
        likes: 9,
        comments: 1,
        shares: 2,
        saves: 0,
      },
      {
        platform: "INSTAGRAM",
        posts: 1,
        views: 100,
        likes: 1,
        comments: 0,
        shares: 0,
        saves: 4,
      },
    ]);
    const byDate = Object.fromEntries(
      result.platformGrowthData.map((row) => [row.date, row]),
    );
    expect(byDate["2026-10-01"]).toMatchObject({
      total: 300,
      TIKTOK: 300,
      INSTAGRAM: 0,
    });
    // Último ponto (hoje) reflete os totais atuais por plataforma
    const last = result.platformGrowthData.at(-1)!;
    expect(last).toMatchObject({ total: 1000, TIKTOK: 900, INSTAGRAM: 100 });
    expect(result).not.toHaveProperty("growthData");
  });
});

describe("getCompetitionGrowthExportAdmin", () => {
  it("lê só views e completa o último dia com o total atual", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T12:00:00.000Z"));
    const queryRaw = vi.fn().mockResolvedValue([
      { snap_day: new Date("2026-09-30T00:00:00.000Z"), total_views: 10n },
      { snap_day: new Date("2026-10-01T00:00:00.000Z"), total_views: 8n },
    ]);
    const api = caller({
      campaign: {
        findUnique: vi.fn().mockResolvedValue({
          id: "c1",
          startDate: new Date("2026-10-01T00:00:00.000Z"),
          endDate: new Date("2026-10-30T00:00:00.000Z"),
        }),
      },
      clipPost: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { views: 50n } }),
      },
      $queryRaw: queryRaw,
    });

    const { growthData } = await api.getCompetitionGrowthExportAdmin({
      slug: "c",
    });
    vi.useRealTimers();

    expect(sqlOf(queryRaw.mock.calls[0]!).sql).not.toContain("likes");
    expect(growthData).toEqual([
      { date: "2026-09-30", views: 10, viewsDelta: 10 },
      { date: "2026-10-01", views: 10, viewsDelta: 0 },
      { date: "2026-10-02", views: 50, viewsDelta: 40 },
    ]);
  });
});

const accountRow = (id: string) => ({
  id,
  platform: "TIKTOK",
  username: `user_${id}`,
  profileUrl: null,
  niche: null,
  isPrimary: false,
  isActive: true,
  followers: null,
  avgViews: null,
  avgEngagementRate: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  clipperProfileId: `cp-${id}`,
  cpId: `cp-${id}`,
  fullName: null,
  artisticName: null,
  verificationStatus: "VERIFIED",
  imageUrl: null,
});

describe("getAllSocialAccounts", () => {
  it("calcula as estatísticas só das contas da página", async () => {
    const queryRawUnsafe = vi.fn().mockImplementation(async (sql: string) =>
      sql.includes("COUNT(sa.id)")
        ? [{ count: 2n }]
        : [accountRow("a"), accountRow("b")],
    );
    const queryRaw = vi
      .fn()
      .mockResolvedValue([
        { accountId: "b", totalPosts: 3n, totalViews: 1_000n },
      ]);
    const api = caller({
      $queryRawUnsafe: queryRawUnsafe,
      $queryRaw: queryRaw,
    });

    const result = await api.getAllSocialAccounts({
      sortBy: "newest",
      platform: "TIKTOK",
    });

    expect(queryRawUnsafe).toHaveBeenCalledTimes(2);
    const pageSql = queryRawUnsafe.mock.calls.find(
      ([sql]) => !String(sql).includes("COUNT(sa.id)"),
    )!;
    expect(pageSql[0]).not.toContain("account_stats");
    expect(pageSql.slice(1)).toEqual(["TIKTOK", 0, 30]);
    const statsQuery = sqlOf(queryRaw.mock.calls[0]!);
    expect(statsQuery.sql).toContain("WHERE sa2.id = ANY(");
    expect(statsQuery.values).toContainEqual(["a", "b"]);
    expect(result.totalCount).toBe(2);
    expect(
      result.accounts.map((a) => [a.id, a.totalPosts, a.totalViews]),
    ).toEqual([
      ["a", 0, 0],
      ["b", 3, 1000],
    ]);
  });

  it("ordena por views com o mapa de estatísticas em cache", async () => {
    const queryRawUnsafe = vi.fn().mockImplementation(async (sql: string) =>
      sql.includes("COUNT(sa.id)")
        ? [{ count: 3n }]
        : [{ id: "a" }, { id: "b" }, { id: "c" }],
    );
    const queryRaw = vi.fn().mockImplementation(async (...call: unknown[]) => {
      const query = sqlOf(call);
      if (query.sql.includes("GROUP BY sa2.id")) {
        return [
          { accountId: "a", totalPosts: 1n, totalViews: 10n },
          { accountId: "c", totalPosts: 2n, totalViews: 500n },
        ];
      }
      return [accountRow("a"), accountRow("c")];
    });
    const api = caller({
      $queryRawUnsafe: queryRawUnsafe,
      $queryRaw: queryRaw,
    });

    const first = await api.getAllSocialAccounts({
      sortBy: "totalViews_desc",
      perPage: 2,
    });
    expect(first.accounts.map((a) => [a.id, a.totalViews])).toEqual([
      ["c", 500],
      ["a", 10],
    ]);
    expect(first.totalPages).toBe(2);
    const statsQuery = sqlOf(queryRaw.mock.calls[0]!);
    expect(statsQuery.sql).not.toContain("ANY(");

    await api.getAllSocialAccounts({ sortBy: "totalPosts_desc", perPage: 2 });
    const statsCalls = queryRaw.mock.calls.filter((call) =>
      sqlOf(call).sql.includes("GROUP BY sa2.id"),
    );
    expect(statsCalls).toHaveLength(1);
  });
});

describe("getSocialAccountsStats", () => {
  it("lê as contagens em uma consulta e guarda o resultado", async () => {
    const queryRaw = vi.fn().mockImplementation(async (...call: unknown[]) =>
      sqlOf(call).sql.includes('FROM "SocialAccount"')
        ? [
            {
              totalAccounts: 10,
              activeAccounts: 7,
              inactiveAccounts: 3,
              accountsWithViews: 4,
              accountsWithFollowers: 5,
              viewsSum: 4_000n,
              viewsAvg: 1000.4,
              viewsMax: 2_000,
              followersSum: null,
              followersAvg: null,
              followersMax: null,
            },
          ]
        : [{ total_posts: 9n, total_views: 99n, clippers_with_posts: 2n }],
    );
    const groupBy = vi
      .fn()
      .mockResolvedValueOnce([{ platform: "TIKTOK", _count: { id: 10 } }])
      .mockResolvedValueOnce([
        {
          niche: null,
          _count: { id: 10 },
          _sum: { avgViews: null, followers: null },
          _avg: { avgViews: null, followers: null },
        },
      ]);
    const api = caller({ $queryRaw: queryRaw, socialAccount: { groupBy } });

    const stats = await api.getSocialAccountsStats();
    await api.getSocialAccountsStats();

    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(stats).toMatchObject({
      totalAccounts: 10,
      activeAccounts: 7,
      inactiveAccounts: 3,
      platformCounts: [{ platform: "TIKTOK", count: 10 }],
      viewsStats: {
        total: 4000,
        average: 1000,
        max: 2000,
        accountsWithData: 4,
      },
      followersStats: { total: 0, average: 0, max: 0, accountsWithData: 5 },
      clipPostStats: { totalPosts: 9, totalViews: 99, clippersWithPosts: 2 },
    });
  });
});

describe("getDataMetrics", () => {
  const aggRow = (
    threshold: number | null,
    platform: string,
    values: Partial<Record<string, number | bigint>>,
  ) => ({
    threshold,
    platform,
    posts: 0,
    withER: 0,
    views: 0n,
    likes: 0n,
    comments: 0n,
    shares: 0n,
    saves: 0n,
    erViews: 0n,
    erLikes: 0n,
    erComments: 0n,
    erShares: 0n,
    erSaves: 0n,
    ...values,
  });

  it("monta faixas, resumo e top vídeos a partir das agregações", async () => {
    const queryRaw = vi.fn().mockImplementation(async (...call: unknown[]) => {
      const query = sqlOf(call);
      if (query.sql.includes("LIMIT 20")) {
        return [
          {
            id: "p1",
            username: "ana",
            views: 20_000n,
            likes: 300,
            comments: 0,
            shares: 0,
            saves: null,
            platform: "TIKTOK",
            thumbnailUrl: null,
            submittedUrl: "https://t/1",
            postedAt: new Date("2026-10-01T10:00:00.000Z"),
            campaignName: "Liga",
          },
        ];
      }
      return [
        aggRow(null, "TIKTOK", {
          posts: 3,
          views: 21_000n,
          likes: 310n,
          comments: 5n,
          shares: 1n,
          saves: 0n,
        }),
        aggRow(null, "INSTAGRAM", { posts: 1, views: 50n, saves: 2n }),
        aggRow(10_000, "TIKTOK", {
          posts: 2,
          withER: 1,
          erViews: 20_000n,
          erLikes: 300n,
        }),
      ];
    });
    const api = caller({ $queryRaw: queryRaw });

    const result = await api.getDataMetrics({
      month: "2026-10",
      campaignIds: ["c1", "c2"],
    });

    const aggQuery = sqlOf(queryRaw.mock.calls[0]!);
    expect(aggQuery.sql).toContain("::float8");
    expect(aggQuery.sql).toContain("trunc(");
    expect(aggQuery.values).toContainEqual(["c1", "c2"]);
    expect(result.tiers[0]).toEqual({
      threshold: 10_000,
      label: "10k",
      total: 2,
      withER: 1,
      avgER: 1.5,
      avgViews: 20_000,
      platformBreakdown: { TIKTOK: 1 },
    });
    expect(result.tiers[4]).toEqual({
      threshold: 1_000_000,
      label: "1M",
      total: 0,
      withER: 0,
      avgER: 0,
      avgViews: 0,
      platformBreakdown: {},
    });
    expect(result.summary).toEqual({
      totalPosts: 4,
      totalViews: 21_050,
      totalEngagement: 318,
      avgER: 1.51,
      platformStats: {
        TIKTOK: { count: 3, views: 21_000 },
        INSTAGRAM: { count: 1, views: 50 },
      },
    });
    expect(result.topVideos).toEqual([
      {
        id: "p1",
        username: "ana",
        views: 20_000,
        likes: 300,
        comments: 0,
        shares: 0,
        saves: 0,
        er: 1.5,
        platform: "TIKTOK",
        thumbnailUrl: null,
        submittedUrl: "https://t/1",
        postedAt: "2026-10-01T10:00:00.000Z",
        campaignName: "Liga",
      },
    ]);
  });
});

describe("estatísticas da lista de competições", () => {
  it("agrega posts e aprovados de todas as campanhas uma vez", async () => {
    const clipPostGroupBy = vi.fn().mockResolvedValue([
      {
        campaignId: "c1",
        _sum: { views: 1_000n, likes: 10, comments: 5, shares: 3, saves: 2 },
        _count: { id: 4 },
      },
      {
        campaignId: "c3",
        _sum: { views: 7n, likes: 0, comments: 0, shares: 0, saves: null },
        _count: { id: 1 },
      },
    ]);
    const applicationGroupBy = vi
      .fn()
      .mockResolvedValue([{ campaignId: "c1", _count: { id: 6 } }]);
    const campaign = (id: string, status: string) => ({
      id,
      name: id,
      slug: id,
      status,
      description: null,
      startDate: new Date("2026-10-01T00:00:00.000Z"),
      endDate: new Date("2026-10-30T00:00:00.000Z"),
      platforms: [],
      requiredHashtags: [],
      requiredMentions: [],
      prizeInfo: { total: "R$ 100" },
      isLeaderboardPublic: true,
      isPrivate: false,
      coverImageUrl: null,
      spotifyMetricsEnabled: false,
    });
    const findMany = vi
      .fn()
      .mockResolvedValue([
        campaign("c1", "ACTIVE"),
        campaign("c2", "SCHEDULED"),
        campaign("c3", "COMPLETED"),
      ]);
    const api = caller({
      campaign: { findMany },
      clipPost: { groupBy: clipPostGroupBy },
      clipperApplication: { groupBy: applicationGroupBy },
    });

    const list = await api.getAllCampaignsWithStats();
    const stats = await api.getCampaignsStats();

    expect(clipPostGroupBy).toHaveBeenCalledOnce();
    expect(applicationGroupBy).toHaveBeenCalledOnce();
    expect(
      list.map((c) => [
        c.id,
        c.totalViews,
        c.totalPosts,
        c.activeClippers,
        c.engagementRate,
        c.prize,
      ]),
    ).toEqual([
      ["c1", 1000, 4, 6, 2, "R$ 100"],
      ["c2", 0, 0, 0, 0, "R$ 100"],
      ["c3", 7, 1, 0, 0, "R$ 100"],
    ]);
    expect(stats).toEqual({
      activeCampaigns: 1,
      scheduledCampaigns: 1,
      completedCampaigns: 1,
      totalViews: 1007,
    });
  });
});
