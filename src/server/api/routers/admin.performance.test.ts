import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: "admin-1" }),
  currentUser: vi.fn(),
  clerkClient: vi.fn(),
}));
vi.mock("@/server/db", () => ({ db: {} }));

const loadDailyRankingDateContext = vi.hoisted(() => vi.fn());
const computeMonthlyLeaderboard = vi.hoisted(() => vi.fn());
vi.mock("@/lib/daily-ranking-preview", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/daily-ranking-preview")>()),
  loadDailyRankingDateContext,
}));
vi.mock("@/lib/monthly-ranking-leaderboard", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/lib/monthly-ranking-leaderboard")
  >()),
  computeMonthlyLeaderboard,
}));

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

describe("getDailyRankingCalendar", () => {
  it("conta entradas no banco e soma só as premiadas", async () => {
    const dailyRanking = (id: string, date: string) => ({
      id,
      rankingDate: new Date(`${date}T00:00:00.000Z`),
      totalPosts: 10,
      totalDailyViews: 1_000n,
      totalClippers: 4,
      announced: false,
    });
    const entryGroupBy = vi.fn().mockResolvedValue([
      { dailyRankingId: "r1", _count: { _all: 120 } },
      { dailyRankingId: "r2", _count: { _all: 3 } },
    ]);
    const prizeEntry = (
      id: string,
      dailyRankingId: string,
      amount: number,
      status: string,
      pix: { eligible: boolean; status: string; paid: boolean },
    ) => ({
      id,
      dailyRankingId,
      dailyPrizeStatus: status,
      dailyPrizeAmount: amount,
      dailyPrizePaid: pix.paid,
      dailyPixStatus: pix.status,
      application: {
        clipperProfile: { pixPayoutEligible: pix.eligible },
      },
    });
    const entryFindMany = vi.fn().mockResolvedValue([
      prizeEntry("e1", "r1", 50, "PAID", {
        eligible: true,
        status: "PAID",
        paid: true,
      }),
      prizeEntry("e2", "r1", 30.5, "PENDING", {
        eligible: false,
        status: "PENDING",
        paid: false,
      }),
      prizeEntry("e3", "r2", 20, "PAID", {
        eligible: true,
        status: "PENDING",
        paid: false,
      }),
    ]);
    const queryRaw = vi
      .fn()
      .mockResolvedValue([{ day: "2026-10-01", clippers: 5 }]);
    const api = caller({
      campaign: {
        findUnique: vi.fn().mockResolvedValue({
          id: "c1",
          startDate: new Date("2026-10-01T00:00:00.000Z"),
          endDate: new Date("2026-10-30T00:00:00.000Z"),
          topClippersRankingEnabled: true,
          topClippersPrizeTable: [
            { position: 1, prize: 100 },
            { position: 2, prize: 50 },
            { position: 3, prize: 25 },
          ],
        }),
      },
      dailyRanking: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            dailyRanking("r1", "2026-10-01"),
            dailyRanking("r2", "2026-10-02"),
          ]),
      },
      dailyRankingEntry: { groupBy: entryGroupBy, findMany: entryFindMany },
      transaction: { findMany: vi.fn().mockResolvedValue([]) },
      $queryRaw: queryRaw,
    });

    const result = await api.getDailyRankingCalendar({ campaignId: "c1" });

    expect(entryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          dailyRankingId: { in: ["r1", "r2"] },
          isDisqualified: false,
          dailyPrizeAmount: { gt: 0 },
        },
        orderBy: { position: "asc" },
      }),
    );
    const topPostersQuery = sqlOf(queryRaw.mock.calls[0]!);
    expect(topPostersQuery.sql).toContain("interval '4 hours'");
    expect(topPostersQuery.sql).toContain("interval '20 hours'");
    expect(topPostersQuery.sql).toContain('e."isDisqualified" = true');
    expect(topPostersQuery.values).toEqual(
      expect.arrayContaining([
        new Date("2026-09-30T20:00:00.000Z"),
        new Date("2026-10-02T20:00:00.000Z"),
      ]),
    );
    expect(result.days).toEqual([
      expect.objectContaining({
        dateStr: "2026-10-01",
        totalEntries: 120,
        paidEntries: 1,
        pendingEntries: 1,
        dailyRankingPrizeAmount: 80.5,
        // 5 clipadores, top 3 premiado
        topPostersPrizeAmount: 175,
        totalPrizeAmount: 255.5,
        paidPrizeAmount: 50,
        paymentStatus: "partial",
        dailyPixPayoutCompleted: true,
      }),
      expect.objectContaining({
        dateStr: "2026-10-02",
        totalEntries: 3,
        paidEntries: 1,
        pendingEntries: 0,
        dailyRankingPrizeAmount: 20,
        topPostersPrizeAmount: 0,
        paymentStatus: "all_paid",
        dailyPixPayoutCompleted: false,
      }),
    ]);
  });
});

describe("getDailyTopClippersByPostedVideos", () => {
  it("agrupa por inscrição no banco e carrega só os perfis do top", async () => {
    const groupBy = vi.fn().mockResolvedValue([
      { applicationId: "a1", _count: { applicationId: 2 }, _sum: { views: 10n } },
      { applicationId: "a2", _count: { applicationId: 3 }, _sum: { views: 5n } },
      { applicationId: "a3", _count: { applicationId: 2 }, _sum: { views: 40n } },
    ]);
    const applicationFindMany = vi.fn().mockImplementation(async ({ where }) =>
      (where.id.in as string[]).map((id) => ({
        id,
        clipperProfileId: `cp-${id}`,
        clipperProfile: {
          fullName: `Nome ${id}`,
          artisticName: null,
          user: { imageUrl: null },
        },
      })),
    );
    const api = caller({
      campaign: {
        findUnique: vi.fn().mockResolvedValue({
          name: "Liga",
          topClippersRankingEnabled: true,
          topClippersPrizeTable: [{ position: 1, prize: 10 }],
        }),
      },
      clipPost: { groupBy },
      clipperApplication: { findMany: applicationFindMany },
    });

    const result = await api.getDailyTopClippersByPostedVideos({
      campaignId: "c1",
      date: "2026-10-02",
      limit: 2,
    });

    expect(groupBy.mock.calls[0]![0].where.application).toMatchObject({
      campaignId: "c1",
      OR: expect.any(Array),
    });
    expect(applicationFindMany.mock.calls[0]![0].where.id.in).toEqual([
      "a2",
      "a3",
    ]);
    expect(
      result.entries.map((e) => [
        e.position,
        e.clipperProfileId,
        e.totalPosts,
        e.totalViews,
        e.prize,
      ]),
    ).toEqual([
      [1, "cp-a2", 3, 5, 10],
      [2, "cp-a3", 2, 40, 0],
    ]);
    expect(result.entries[0]!.campaigns).toEqual([
      { campaignId: "c1", campaignName: "Liga", posts: 3, views: 5 },
    ]);
    expect(result.stats).toEqual({
      totalPostsInWindow: 7,
      totalViewsInWindow: 55,
      totalClippersWithPosts: 3,
      totalCampaigns: 1,
    });
  });
});

describe("pagamentos em lote", () => {
  it("payTopPostersDailyRankByDate busca prêmios e estornos uma vez", async () => {
    const groupBy = vi.fn().mockResolvedValue(
      ["a1", "a2", "a3"].map((applicationId, index) => ({
        applicationId,
        _count: { applicationId: 5 - index },
        _sum: { views: 100n },
      })),
    );
    const transactionFindMany = vi
      .fn()
      // créditos candidatos: a posição 1 tem um crédito estornado e um válido
      .mockResolvedValueOnce([
        {
          id: "credit-reversed",
          amount: 100,
          processedAt: null,
          createdAt: new Date("2026-10-03T10:00:00.000Z"),
          rankingPosition: 2,
        },
        {
          id: "credit-ok",
          amount: 100,
          processedAt: null,
          createdAt: new Date("2026-10-03T09:00:00.000Z"),
          rankingPosition: 1,
        },
      ])
      // estornos
      .mockResolvedValueOnce([
        { metadata: { reversedPrizeCreditId: "credit-reversed" } },
      ]);
    const entryFindMany = vi
      .fn()
      .mockResolvedValueOnce([]) // persistTopClippersEntries: entradas existentes
      .mockResolvedValueOnce([
        {
          id: "entry-2",
          applicationId: "a2",
          isDisqualified: false,
          prizeStatus: "PENDING",
        },
        {
          id: "entry-3",
          applicationId: "a3",
          isDisqualified: true,
          prizeStatus: "PENDING",
        },
      ]);
    const upsert = vi.fn().mockResolvedValue({});
    const api = caller({
      campaign: {
        findUnique: vi.fn().mockResolvedValue({
          id: "c1",
          name: "Liga",
          dailyPix: false,
          topClippersRankingEnabled: true,
          topClippersPrizeTable: [
            { position: 1, prize: 100 },
            { position: 2, prize: 50 },
            { position: 3, prize: 25 },
          ],
        }),
      },
      topClippersDailyRanking: {
        upsert: vi.fn().mockResolvedValue({ id: "ranking-1", entries: [] }),
      },
      clipPost: { groupBy },
      clipperApplication: {
        findMany: vi.fn().mockResolvedValue(
          ["a1", "a2", "a3"].map((id) => ({
            id,
            clipperProfileId: `cp-${id}`,
            clipperProfile: {
              fullName: `Nome ${id}`,
              artisticName: null,
              user: { email: null },
            },
          })),
        ),
      },
      transaction: { findMany: transactionFindMany },
      topClippersDailyRankingEntry: { findMany: entryFindMany, upsert },
    });

    const result = await api.payTopPostersDailyRankByDate({
      campaignId: "c1",
      date: "2026-10-02",
      dryRun: true,
    });

    expect(transactionFindMany).toHaveBeenCalledTimes(2);
    const candidatesWhere = transactionFindMany.mock.calls[0]![0].where;
    expect(candidatesWhere.OR).toHaveLength(3);
    expect(candidatesWhere.OR[0].AND[1]).toEqual({ rankingPosition: 1 });
    expect(
      transactionFindMany.mock.calls[1]![0].where.AND[1].OR,
    ).toHaveLength(2);
    // Só as posições sem prêmio prévio são gravadas
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(groupBy.mock.calls[0]![0].where.application).toMatchObject({
      campaignId: "c1",
    });
    expect(result).toMatchObject({
      dryRun: true,
      totalAmount: 50,
      payable: [{ position: 2, amount: 50, totalPosts: 4 }],
      skipped: [
        { position: 1, reason: "Prêmio de Top Postadores já creditado" },
        { position: 3, reason: "Clipador desclassificado deste ranking" },
      ],
    });
  });

  it("payDailyRankByDate lê entradas e posts do top em lote", async () => {
    const rawRow = (index: number) => ({
      dailyRankingEntryId: `dre-${index}`,
      clipPostId: `post-${index}`,
      clipperProfileId: `cp-${index}`,
      artisticName: null,
      fullName: `Nome ${index}`,
    });
    loadDailyRankingDateContext.mockResolvedValue({
      campaignId: "c1",
      campaignName: "Liga",
      dailyRankingId: "r1",
      topCount: 3,
      dailyPrizeTable: [
        { position: 1, prize: 30 },
        { position: 2, prize: 20 },
        { position: 3, prize: 10 },
      ],
      rawRows: [1, 2, 3, 4, 5].map(rawRow),
    });
    const entryFindMany = vi.fn().mockResolvedValue([
      { id: "dre-1", clipPostId: "post-1", dailyPrizeStatus: "PENDING", isDisqualified: false },
      { id: "dre-2", clipPostId: "post-2", dailyPrizeStatus: "PENDING", isDisqualified: true },
      { id: "dre-3", clipPostId: "post-3", dailyPrizeStatus: "PAID", isDisqualified: false },
      { id: "dre-4", clipPostId: "post-4", dailyPrizeStatus: "PENDING", isDisqualified: false },
      { id: "dre-5", clipPostId: "post-5", dailyPrizeStatus: "PENDING", isDisqualified: false },
    ]);
    const clipPostFindMany = vi.fn().mockResolvedValue([
      { id: "post-1", status: "ELIGIBLE" },
      { id: "post-3", status: "ELIGIBLE" },
      { id: "post-4", status: "DISQUALIFIED" },
    ]);
    const api = caller({
      dailyRankingEntry: { findMany: entryFindMany },
      clipPost: { findMany: clipPostFindMany },
    });

    const result = await api.payDailyRankByDate({
      campaignId: "c1",
      date: "2026-10-02",
      dryRun: true,
    });

    expect(entryFindMany).toHaveBeenCalledOnce();
    expect(clipPostFindMany.mock.calls[0]![0].where.id.in).toEqual([
      "post-1",
      "post-3",
      "post-4",
    ]);
    expect(result).toMatchObject({
      dryRun: true,
      totalAmount: 30,
      payable: [{ position: 1, amount: 30 }],
      skipped: [
        { position: 2, reason: "Prêmio diário já marcado como pago" },
        { position: 3, reason: "Post desqualificado" },
      ],
    });
  });

  it("payMonthlyRankByPeriod consulta os prêmios anteriores uma vez", async () => {
    computeMonthlyLeaderboard.mockResolvedValue({
      monthlyPrizeTable: [
        { position: 1, prize: 300 },
        { position: 2, prize: 200 },
      ],
      monthPeriod: "2026-10",
      rows: [1, 2, 3].map((position) => ({
        position,
        clipperProfileId: `cp-${position}`,
        clipperName: `Nome ${position}`,
        clipperUsername: `user${position}`,
      })),
    });
    const transactionFindMany = vi.fn().mockResolvedValue([
      { rankingPosition: 2, wallet: { clipperProfileId: "cp-2" } },
      // mesmo clipador em outra posição não conta
      { rankingPosition: 1, wallet: { clipperProfileId: "cp-2" } },
    ]);
    const api = caller({
      campaign: {
        findUnique: vi.fn().mockResolvedValue({ id: "c1", name: "Liga" }),
      },
      transaction: { findMany: transactionFindMany },
    });

    const result = await api.payMonthlyRankByPeriod({
      campaignId: "c1",
      dryRun: true,
    });

    expect(transactionFindMany).toHaveBeenCalledOnce();
    expect(transactionFindMany.mock.calls[0]![0].where.OR).toEqual([
      { rankingPosition: 1, wallet: { clipperProfileId: "cp-1" } },
      { rankingPosition: 2, wallet: { clipperProfileId: "cp-2" } },
    ]);
    expect(result).toMatchObject({
      dryRun: true,
      totalAmount: 300,
      payable: [{ position: 1, amount: 300 }],
      skipped: [
        {
          position: 2,
          reason: "Prêmio mensal já creditado para esta posição",
        },
        { position: 3, reason: "Sem valor de prêmio para esta posição" },
      ],
    });
  });
});

describe("getCompetitionDetailsAdmin", () => {
  it("deriva totais e ranking de contas de uma agregação e hidrata só o top do dia", async () => {
    computeMonthlyLeaderboard.mockResolvedValue({ rows: [] });
    const queryRaw = vi.fn().mockResolvedValue([
      {
        username: "ana",
        platform: "TIKTOK",
        allPosts: 3,
        posts: 2,
        views: 1_000n,
        likes: 50n,
        comments: 5n,
        shares: 5n,
        saves: null,
      },
      {
        username: null,
        platform: "INSTAGRAM",
        allPosts: 1,
        posts: 1,
        views: 3_000n,
        likes: 10n,
        comments: 0n,
        shares: 0n,
        saves: 20n,
      },
      // só posts não elegíveis: conta no total de posts, fora do ranking
      {
        username: "bia",
        platform: "TIKTOK",
        allPosts: 4,
        posts: 0,
        views: 0n,
        likes: 0n,
        comments: 0n,
        shares: 0n,
        saves: null,
      },
    ]);
    const todayPost = (id: string, applicationId: string, views: bigint) => ({
      id,
      applicationId,
      submittedUrl: `https://t/${id}`,
      username: "ana",
      platform: "TIKTOK",
      thumbnailUrl: null,
      postedAt: new Date("2026-10-02T10:00:00.000Z"),
      views,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: null,
    });
    const clipPostFindMany = vi
      .fn()
      .mockImplementation(async ({ take }) =>
        take === 10
          ? []
          : [
              todayPost("p1", "a1", 10n),
              todayPost("p2", "a2", 30n),
              todayPost("p3", "a3", 20n),
            ],
      );
    const applicationFindMany = vi.fn().mockImplementation(async ({ where }) =>
      (where.id.in as string[]).map((id) => ({
        id,
        clipperProfile: {
          artisticName: `Artista ${id}`,
          fullName: `Nome ${id}`,
          user: { imageUrl: `https://img/${id}` },
          clan: null,
        },
      })),
    );
    const api = caller({
      campaign: {
        findUnique: vi.fn().mockResolvedValue({
          id: "c1",
          slug: "c",
          name: "Liga",
          status: "ACTIVE",
          startDate: new Date("2026-10-01T00:00:00.000Z"),
          endDate: new Date("2026-10-30T00:00:00.000Z"),
          rankingMetricType: "VIEWS",
          prizeInfo: null,
          organization: null,
          activeRankingRule: { dailyTopCount: 2, dailyPrizeTable: [] },
        }),
      },
      clipperApplication: {
        count: vi.fn().mockResolvedValue(7),
        findMany: applicationFindMany,
      },
      clipPost: {
        count: vi.fn().mockResolvedValue(5),
        findMany: clipPostFindMany,
      },
      dailyRanking: { findFirst: vi.fn().mockResolvedValue(null) },
      $queryRaw: queryRaw,
    });

    const result = await api.getCompetitionDetailsAdmin({ slug: "c" });

    expect(result.stats).toEqual({
      totalViews: 4000,
      totalLikes: 60,
      totalComments: 5,
      totalShares: 5,
      totalSaves: 20,
      totalClippers: 7,
      totalPosts: 8,
      engagementRate: 2.25,
    });
    expect(
      result.topAccountsRanking.map((a) => [
        a.position,
        a.username,
        a.postsCount,
        a.totalViews,
        a.totalSaves,
      ]),
    ).toEqual([
      [1, "unknown", 1, 3000, 20],
      [2, "ana", 2, 1000, 0],
    ]);
    // Posts de hoje sem relações; perfis só das 2 posições do top
    expect(clipPostFindMany.mock.calls[0]![0].select).not.toHaveProperty(
      "application",
    );
    expect(applicationFindMany.mock.calls[0]![0].where.id.in).toEqual([
      "a2",
      "a3",
    ]);
    expect(
      result.topDailyRanking.map((p) => [
        p.position,
        p.postId,
        p.clipperName,
        p.clipperImageUrl,
        p.postUrl,
      ]),
    ).toEqual([
      [1, "p2", "Artista a2", "https://img/a2", "https://t/p2"],
      [2, "p3", "Artista a3", "https://img/a3", "https://t/p3"],
    ]);
  });
});

describe("getCompetitionApplicationsAdmin", () => {
  it("soma posts e ganhos agrupados no banco", async () => {
    const postGroupBy = vi.fn().mockResolvedValue([
      {
        applicationId: "a1",
        status: "ELIGIBLE",
        platform: "TIKTOK",
        username: "Ana",
        _count: { _all: 2 },
        _sum: { views: 300n, likes: 30 },
      },
      {
        applicationId: "a1",
        status: "ELIGIBLE",
        platform: "TIKTOK",
        username: "ana",
        _count: { _all: 1 },
        _sum: { views: 100n, likes: 10 },
      },
      {
        applicationId: "a1",
        status: "PENDING",
        platform: "TIKTOK",
        username: "ana",
        _count: { _all: 4 },
        _sum: { views: 999n, likes: 99 },
      },
      {
        applicationId: "a1",
        status: "ELIGIBLE",
        platform: "INSTAGRAM",
        username: "outra",
        _count: { _all: 1 },
        _sum: { views: 5n, likes: 1 },
      },
    ]);
    const transactionGroupBy = vi
      .fn()
      .mockResolvedValue([{ walletId: "w1", _sum: { amount: 125.5 } }]);
    const application = {
      id: "a1",
      clipperProfileId: "cp1",
      status: "APPROVED",
      withdrawnAt: null,
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
      approvedAt: null,
      reviewedBy: null,
      reviewNotes: null,
      rejectionReason: null,
      clipperProfile: {
        fullName: "Ana Silva",
        artisticName: "Ana",
        phone: null,
        cpf: null,
        pixKey: null,
        city: null,
        state: null,
        user: { name: null, email: "ana@x", imageUrl: null },
        clan: null,
      },
      socialAccounts: [
        {
          socialAccount: {
            id: "s1",
            platform: "TIKTOK",
            username: "ANA",
            profileUrl: null,
            isPrimary: true,
            isVerified: false,
            followers: null,
          },
        },
      ],
    };
    const api = caller({
      campaign: { findUnique: vi.fn().mockResolvedValue({ id: "c1" }) },
      clipperApplication: {
        groupBy: vi.fn().mockResolvedValue([
          { status: "APPROVED", _count: { id: 1 } },
          { status: "PENDING", _count: { id: 2 } },
        ]),
        findMany: vi.fn().mockResolvedValue([application]),
        count: vi.fn().mockResolvedValue(1),
      },
      clipPost: { groupBy: postGroupBy },
      wallet: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "w1", clipperProfileId: "cp1" }]),
      },
      transaction: { groupBy: transactionGroupBy },
    });

    const result = await api.getCompetitionApplicationsAdmin({ slug: "c" });

    expect(postGroupBy.mock.calls[0]![0].where).toEqual({
      applicationId: { in: ["a1"] },
    });
    expect(transactionGroupBy.mock.calls[0]![0].where).toMatchObject({
      campaignId: "c1",
      wallet: { clipperProfileId: { in: ["cp1"] } },
    });
    const [app] = result.applications;
    expect(app).toMatchObject({
      postsCount: 8,
      eligiblePostsCount: 4,
      totalViews: 405,
      totalLikes: 41,
      totalEarned: 125.5,
      socialAccounts: [
        { id: "s1", postsCount: 7, eligiblePostsCount: 3, totalViews: 400 },
      ],
    });
    expect(app).not.toHaveProperty("posts");
    expect(result).toMatchObject({
      pendingCount: 2,
      approvedCount: 1,
      totalCount: 3,
    });
  });
});

describe("getCompetitionPostsAdmin", () => {
  it("ordena por engajamento no banco e pagina pelos ids", async () => {
    const queryRaw = vi.fn().mockImplementation(async (...call: unknown[]) =>
      sqlOf(call).sql.includes("COUNT(*)")
        ? [{ count: 40 }]
        : [{ id: "p2" }, { id: "p1" }],
    );
    const post = (id: string) => ({
      id,
      submittedUrl: `https://www.tiktok.com/@a/video/${id}`,
      platformVideoId: id,
      thumbnailUrl: null,
      platform: "TIKTOK",
      username: "a",
      views: 10n,
      likes: 1,
      comments: 0,
      shares: 0,
      postedAt: null,
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
      status: "ELIGIBLE",
      ineligibilityReason: null,
      bucketVideo: null,
      application: null,
    });
    const findMany = vi.fn().mockResolvedValue([post("p1"), post("p2")]);
    const api = caller({
      campaign: { findUnique: vi.fn().mockResolvedValue({ id: "c1" }) },
      clipPost: { findMany },
      $queryRaw: queryRaw,
    });

    const result = await api.getCompetitionPostsAdmin({
      slug: "c",
      sortBy: "engagement",
      page: 2,
      pageSize: 20,
      commentsDataFilter: "without",
      accountSearch: "@ana_",
    });

    const pageQuery = sqlOf(
      queryRaw.mock.calls.find((call) => !sqlOf(call).sql.includes("COUNT(*)"))!,
    );
    expect(pageQuery.sql).toContain("::float8 / cp.views::float8");
    expect(pageQuery.sql).toContain('NOT EXISTS');
    expect(pageQuery.sql).toContain("ILIKE");
    expect(pageQuery.values).toEqual(
      expect.arrayContaining(["c1", "%ana_%", 20]),
    );
    expect(findMany.mock.calls[0]![0].where).toEqual({
      id: { in: ["p2", "p1"] },
    });
    expect(result.posts.map((p) => p.id)).toEqual(["p2", "p1"]);
    expect(result.pagination).toMatchObject({
      totalCount: 40,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });
});

describe("getGlobalFinancials", () => {
  it("agrupa por competição e clipador sem varreduras quadráticas", async () => {
    const profile = (id: string) => ({
      id,
      fullName: `Nome ${id}`,
      artisticName: null,
      pixKey: null,
      cpf: null,
      user: { email: `${id}@x`, imageUrl: null },
    });
    const tx = (
      id: string,
      type: string,
      amount: number,
      campaignId: string | null,
      clipper: string,
      createdAt: string,
    ) => ({
      id,
      type,
      amount,
      status: "COMPLETED",
      campaignId,
      rankingPosition: null,
      description: id,
      createdAt: new Date(createdAt),
      proofUrls: [],
      withdrawalDetails: null,
      wallet: { clipperProfile: profile(clipper) },
    });
    const transactionFindMany = vi
      .fn()
      .mockResolvedValueOnce([
        tx("t1", "PRIZE_CREDIT", 100, "c1", "k1", "2026-10-03T10:00:00Z"),
        tx("t2", "BONUS", 50, "c2", "k1", "2026-10-02T10:00:00Z"),
        tx("t3", "ADJUSTMENT", 10, null, "k2", "2026-10-01T10:00:00Z"),
      ])
      .mockResolvedValueOnce([
        tx("p1", "WITHDRAWAL_COMPLETED", -30, "c1", "k1", "2026-10-04T10:00:00Z"),
      ])
      .mockResolvedValueOnce([]);
    const api = caller({
      campaign: {
        findMany: vi.fn().mockResolvedValue([
          { id: "c1", name: "Liga 1" },
          { id: "c2", name: "Liga 2" },
        ]),
      },
      transaction: { findMany: transactionFindMany },
      clipPost: {
        groupBy: vi.fn().mockResolvedValue([
          {
            campaignId: "c1",
            _sum: { views: 10_000n },
            _count: { id: 4 },
          },
        ]),
      },
    });

    const result = await api.getGlobalFinancials({ period: "all" });

    expect(
      result.campaignFinancials.map((c) => [
        c.id,
        c.totalCredited,
        c.totalPaid,
        c.transactionCount,
        c.clippersCount,
        c.totalViews,
        c.cpm,
      ]),
    ).toEqual([
      ["c1", 100, 30, 1, 1, 10_000, 10],
      ["c2", 50, 0, 1, 1, 0, 0],
    ]);
    expect(
      result.topClippers.map((c) => [c.id, c.totalEarned, c.campaignCount]),
    ).toEqual([
      ["k1", 150, 2],
      ["k2", 10, 0],
    ]);
    expect(
      result.recentTransactions.map((t) => [t.id, t.campaignName]),
    ).toEqual([
      ["p1", "Liga 1"],
      ["t1", "Liga 1"],
      ["t2", "Liga 2"],
      ["t3", "—"],
    ]);
    expect(result.summary).toMatchObject({
      totalCredited: 160,
      totalPaidPix: 30,
      globalViews: 10_000,
      totalClippers: 2,
    });
  });
});

describe("spotifyMetrics.listTracks", () => {
  it("lê a métrica mais recente e a primeira do período em uma consulta", async () => {
    const link = (id: string, trackId: string) => ({
      id,
      isActive: true,
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
      spotifyTrackId: trackId,
      spotifyTrack: {
        id: trackId,
        spotifyTrackId: `ext-${trackId}`,
        spotifyUri: `spotify:track:${trackId}`,
        shareUrl: null,
        name: trackId,
        artists: [],
        albumName: null,
        albumImageUrl: null,
        lastCollectedAt: null,
        lastError: null,
      },
    });
    const queryRaw = vi.fn().mockResolvedValue([
      {
        spotifyTrackId: "t1",
        latestPlayCount: 500n,
        latestCollectedAt: new Date("2026-10-10T00:00:00.000Z"),
        firstPlayCount: 100n,
      },
      {
        spotifyTrackId: "t2",
        latestPlayCount: null,
        latestCollectedAt: null,
        firstPlayCount: null,
      },
    ]);
    const api = caller({
      campaignSpotifyTrack: {
        findMany: vi
          .fn()
          .mockResolvedValue([link("l1", "t1"), link("l2", "t2")]),
      },
      $queryRaw: queryRaw,
    });

    const result = await api.spotifyMetrics.listTracks({
      campaignId: "c1",
      range: "7d",
    });

    expect(queryRaw).toHaveBeenCalledOnce();
    const query = sqlOf(queryRaw.mock.calls[0]!);
    expect(query.sql).toContain("LIMIT 1");
    expect(query.values[0]).toEqual(["t1", "t2"]);
    expect(result.map((r) => r.track)).toEqual([
      expect.objectContaining({
        currentPlayCount: 500,
        previousPlayCount: 100,
        latestCollectedAt: new Date("2026-10-10T00:00:00.000Z"),
      }),
      expect.objectContaining({
        currentPlayCount: null,
        previousPlayCount: null,
        latestCollectedAt: null,
      }),
    ]);
  });
});
