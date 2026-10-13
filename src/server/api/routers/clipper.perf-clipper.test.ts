import { beforeEach, describe, expect, it, vi } from "vitest";

const currentUser = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({
  currentUser,
  auth: async () => ({ userId: ((await currentUser()) as { id?: string } | null)?.id ?? null }),
}));
vi.mock("@/server/db", () => ({ db: {} }));
vi.mock("@/env", () => ({ env: {} }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: vi.fn() };
  },
}));

import { clipperRouter } from "./clipper";
import { invalidateCachedQueries } from "@/server/memory-cache";

function caller(db: Record<string, unknown>) {
  return clipperRouter.createCaller({ db, headers: new Headers() } as never);
}

function sqlOf(call: unknown[]) {
  return (call[0] as string[]).join("?");
}

beforeEach(() => {
  invalidateCachedQueries("");
  currentUser.mockResolvedValue({ id: "user-1" });
});

describe("home do clipador", () => {
  it("dashboard: ranking mais recente por inscrição numa consulta só", async () => {
    const monthlyFindMany = vi.fn().mockResolvedValue([
      // ordenado por lastUpdated desc
      { applicationId: "app-1", position: 3, previousPosition: 5, monthlyRanking: { campaignId: "c-1" } },
      { applicationId: "app-2", position: 8, previousPosition: null, monthlyRanking: { campaignId: "c-2" } },
      { applicationId: "app-1", position: 1, previousPosition: 1, monthlyRanking: { campaignId: "c-1" } },
    ]);
    const db = {
      clipperProfile: { findUnique: vi.fn().mockResolvedValue({ id: "clipper-1" }) },
      wallet: { findUnique: vi.fn().mockResolvedValue({ totalEarned: 150 }) },
      clipperApplication: {
        count: vi.fn().mockResolvedValue(2),
        findMany: vi.fn().mockResolvedValue([{ id: "app-1" }, { id: "app-2" }, { id: "app-3" }]),
      },
      clipPost: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { views: 12345n } }),
      },
      monthlyRankingEntry: { findMany: monthlyFindMany },
    };

    const stats = await caller(db).getDashboardStats();

    expect(stats).toEqual({
      activeCompetitions: 2,
      totalViews: 12345,
      totalEarned: 150,
      // melhor posição por campanha: c-1 → 3 (entrada mais recente), c-2 → 8
      averageRanking: Math.round((3 + 8) / 2),
      viewsGrowth: 0,
      competitionsGrowth: 0,
      earningsGrowth: 0,
      rankingChange: 2,
    });
    expect(monthlyFindMany).toHaveBeenCalledTimes(1);
    expect(monthlyFindMany.mock.calls[0]?.[0]).toMatchObject({
      where: { applicationId: { in: ["app-1", "app-2", "app-3"] } },
      orderBy: { lastUpdated: "desc" },
    });
  });

  it("busca o perfil uma vez por requisição entre procedures do mesmo batch", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "clipper-1" });
    const db = {
      clipperProfile: { findUnique },
      clipperApplication: { findMany: vi.fn().mockResolvedValue([]) },
      clipPost: { groupBy: vi.fn().mockResolvedValue([]) },
    };
    const api = caller(db);
    await Promise.all([api.getMyApplications(), api.getMyCompetitions()]);
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { id: true },
    });
  });

  it("minhas competições somam views por groupBy e usam a menor posição", async () => {
    const db = {
      clipperProfile: { findUnique: vi.fn().mockResolvedValue({ id: "clipper-1" }) },
      clipperApplication: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "app-1",
            campaignId: "c-1",
            campaign: {
              id: "c-1",
              name: "Competição",
              slug: "competicao",
              coverImageUrl: null,
              startDate: new Date("2026-10-01T00:00:00Z"),
              endDate: new Date("2099-01-01T00:00:00Z"),
              platforms: ["TIKTOK"],
              prizeInfo: { total: "R$ 500" },
              status: "ACTIVE",
              rankingMetricType: "VIEWS",
              isProOnly: false,
            },
          },
        ]),
        groupBy: vi.fn().mockResolvedValue([{ campaignId: "c-1", _count: { id: 40 } }]),
      },
      monthlyRankingEntry: {
        groupBy: vi.fn().mockResolvedValue([{ applicationId: "app-1", _min: { position: 4 } }]),
      },
      clipPost: {
        groupBy: vi.fn().mockResolvedValue([
          { applicationId: "app-1", _count: { id: 6 }, _sum: { views: 999n } },
        ]),
      },
    };
    const [competition] = await caller(db).getMyCompetitions();
    expect(competition).toMatchObject({
      id: "c-1",
      slug: "competicao",
      prize: "R$ 500",
      myRanking: 4,
      totalParticipants: 40,
      myPosts: 6,
      myViews: 999,
      coverImageUrl: "",
    });
  });

  it("opções do menu trazem só id/nome/slug com o mesmo filtro", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([{ campaign: { id: "c-1", name: "Competição", slug: "competicao" } }]);
    const options = await caller({ clipperApplication: { findMany } }).getMyCompetitionOptions();
    expect(options).toEqual([{ id: "c-1", name: "Competição", slug: "competicao" }]);
    expect(findMany.mock.calls[0]?.[0].where).toEqual({
      clipperProfile: { userId: "user-1" },
      status: "APPROVED",
      campaign: { status: { in: ["ACTIVE", "SCHEDULED"] } },
    });
  });

  it("top clipadores: agrega no SQL, hidrata só o top e usa cache", async () => {
    const queryRaw = vi.fn().mockResolvedValue([
      {
        clipperProfileId: "p-1",
        views: 1000n,
        likes: 50n,
        comments: 10n,
        shares: 0n,
        saves: 0n,
        posts: 4,
        totalClippers: 12,
        totalViews: 5000n,
        totalPosts: 30n,
      },
    ]);
    const profileFindMany = vi.fn().mockResolvedValue([
      {
        id: "p-1",
        fullName: "Fulano de Tal",
        artisticName: null,
        instagramUsernames: [],
        user: { name: null, imageUrl: null },
        clan: null,
        socialAccounts: [{ username: "fulano" }],
      },
    ]);
    const db = { $queryRaw: queryRaw, clipperProfile: { findMany: profileFindMany } };

    const first = await caller(db).getTopClippersRanking();
    await caller(db).getTopClippersRanking();

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const sql = sqlOf(queryRaw.mock.calls[0]!);
    expect(sql).toContain(`p."status" = 'ELIGIBLE'`);
    expect(sql).toContain(`ORDER BY pc."views" DESC, pc."clipperProfileId" ASC`);
    expect(sql).toContain("LIMIT 10");
    expect(first).toMatchObject({
      totalClippers: 12,
      totalViews: 5000,
      totalPosts: 30,
      clippers: [
        {
          position: 1,
          profileId: "p-1",
          name: "Fulano de Tal",
          artisticName: "fulano",
          username: "fulano",
          views: 1000,
          posts: 4,
          engagementRate: 6,
        },
      ],
    });
  });

  it("próxima competição usa o cache das ativas e ignora privadas/não iniciadas", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    const base = {
      description: null,
      status: "ACTIVE",
      endDate: new Date("2026-11-01T00:00:00Z"),
      platforms: ["TIKTOK"],
      requiredHashtags: [],
      coverImageUrl: null,
      prizeInfo: null,
      rankingMetricType: "VIEWS",
      isProOnly: false,
      organization: { id: "o", name: "Org", logoUrl: null },
    };
    const db = {
      clipperProfile: { findUnique: vi.fn().mockResolvedValue({ id: "clipper-1" }) },
      campaign: {
        findMany: vi.fn().mockResolvedValue([
          { ...base, id: "privada", name: "P", slug: "p", isPrivate: true, publishedAt: new Date(), startDate: new Date("2026-10-01T00:00:00Z") },
          { ...base, id: "futura", name: "F", slug: "f", isPrivate: false, publishedAt: new Date(), startDate: new Date("2026-10-20T00:00:00Z") },
          { ...base, id: "rascunho", name: "R", slug: "r", isPrivate: false, publishedAt: null, startDate: new Date("2026-10-01T00:00:00Z") },
          { ...base, id: "cheia", name: "C", slug: "c", isPrivate: false, publishedAt: new Date(), startDate: new Date("2026-10-01T00:00:00Z") },
          { ...base, id: "vazia", name: "V", slug: "v", isPrivate: false, publishedAt: new Date(), startDate: new Date("2026-10-02T00:00:00Z") },
          { ...base, id: "inscrito", name: "I", slug: "i", isPrivate: false, publishedAt: new Date(), startDate: new Date("2026-10-03T00:00:00Z") },
        ]),
      },
      clipperApplication: {
        findMany: vi.fn().mockResolvedValue([{ campaignId: "inscrito" }]),
        groupBy: vi.fn().mockResolvedValue([
          { campaignId: "cheia", _count: { id: 50 } },
          { campaignId: "vazia", _count: { id: 2 } },
          { campaignId: "inscrito", _count: { id: 0 } },
        ]),
      },
      clipPost: { groupBy: vi.fn().mockResolvedValue([]) },
    };
    try {
      const next = await caller(db).getNextAvailableCompetition();
      expect(next).toMatchObject({ id: "vazia", totalApplications: 2 });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("carteira", () => {
  it("estatísticas numa consulta, com os mesmos critérios", async () => {
    const queryRaw = vi.fn().mockResolvedValue([
      {
        totalTransactions: 9,
        totalCredits: 320.5,
        totalCreditsCount: 4,
        totalWithdrawals: 3,
        pendingWithdrawals: 1,
        completedWithdrawals: 2,
      },
    ]);
    const db = {
      clipperProfile: { findUnique: vi.fn().mockResolvedValue({ userId: "user-1" }) },
      user: { findUnique: vi.fn().mockResolvedValue({ role: "CLIPPER" }) },
      $queryRaw: queryRaw,
      transaction: { findFirst: vi.fn().mockResolvedValue({ id: "tx-9" }) },
    };
    const stats = await caller(db).getWalletStats({ clipperProfileId: "clipper-1" });
    expect(stats).toEqual({
      totalTransactions: 9,
      totalCredits: 320.5,
      totalCreditsCount: 4,
      totalWithdrawals: 3,
      pendingWithdrawals: 1,
      completedWithdrawals: 2,
      lastTransaction: { id: "tx-9" },
    });
    const sql = sqlOf(queryRaw.mock.calls[0]!);
    expect(sql).toContain(`t."type" IN ('PRIZE_CREDIT', 'BONUS', 'ADJUSTMENT', 'REFUND')`);
    expect(sql).toContain(`t."type" = 'WITHDRAWAL_COMPLETED' AND t."status" = 'COMPLETED'`);
    expect(queryRaw.mock.calls[0]?.[1]).toBe("clipper-1");
  });

  it("transações: total e página em paralelo, só campos exibidos", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const db = {
      clipperProfile: { findUnique: vi.fn().mockResolvedValue({ userId: "user-1" }) },
      user: { findUnique: vi.fn().mockResolvedValue({ role: "CLIPPER" }) },
      transaction: { findMany, count },
    };
    const result = await caller(db).getTransactions({
      clipperProfileId: "clipper-1",
      pageSize: 500,
      type: "BONUS",
    });
    expect(result).toEqual({
      transactions: [],
      total: 0,
      page: 1,
      pageSize: 500,
      totalPages: 0,
    });
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { wallet: { clipperProfileId: "clipper-1" }, type: "BONUS" },
      take: 500,
      skip: 0,
    });
    expect(findMany.mock.calls[0]?.[0].select).not.toHaveProperty("metadata");
    expect(findMany.mock.calls[0]?.[0].select).not.toHaveProperty(
      "withdrawalDetails",
    );
  });
});

describe("envio de posts", () => {
  function submitDb() {
    const db = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      $transaction: vi.fn(),
      clipperProfile: { findUnique: vi.fn().mockResolvedValue({ id: "clipper-1" }) },
      clipperApplication: {
        findUnique: vi.fn().mockResolvedValue({
          id: "app-1",
          status: "APPROVED",
          campaign: {
            status: "ACTIVE",
            endDate: new Date("2099-01-01T00:00:00Z"),
            platforms: ["YOUTUBE"],
            requiredHashtags: [],
          },
        }),
      },
      socialAccount: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "acc-1", platform: "YOUTUBE", username: "canal" }]),
      },
      clipPost: {
        findMany: vi.fn().mockResolvedValue([]),
        createManyAndReturn: vi
          .fn()
          .mockImplementation(async ({ data }) =>
            data.map((row: object, index: number) => ({ id: `post-${index}`, ...row })),
          ),
      },
    };
    db.$transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback(db));
    return db;
  }
  const posts = [
    { accountId: "acc-1", url: "https://www.youtube.com/shorts/aaaaaaaaaaa" },
    { accountId: "acc-1", url: "https://www.youtube.com/shorts/bbbbbbbbbbb" },
  ];

  it("checa vídeos repetidos do lote numa consulta e acusa o primeiro na ordem enviada", async () => {
    const db = submitDb();
    db.clipPost.findMany
      .mockResolvedValueOnce([]) // URLs
      .mockResolvedValueOnce([
        {
          platformVideoId: "bbbbbbbbbbb",
          platform: "YOUTUBE",
          campaign: { name: "Outra B" },
          application: { clipperProfile: { fullName: "Beltrano", artisticName: null } },
        },
        {
          platformVideoId: "aaaaaaaaaaa",
          platform: "YOUTUBE",
          campaign: { name: "Outra A" },
          application: { clipperProfile: { fullName: "Fulano", artisticName: "Fu" } },
        },
      ]);
    await expect(
      caller(db).submitPosts({ campaignId: "campaign-1", posts }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining(`"Outra A" por Fu`),
    });
    expect(db.clipPost.findMany.mock.calls[1]?.[0].where).toEqual({
      OR: [
        { platformVideoId: "aaaaaaaaaaa", platform: "YOUTUBE" },
        { platformVideoId: "bbbbbbbbbbb", platform: "YOUTUBE" },
      ],
    });
    expect(db.clipPost.createManyAndReturn).not.toHaveBeenCalled();
  });

  it("grava o lote num único INSERT após revalidar sob lock", async () => {
    const db = submitDb();
    const result = await caller(db).submitPosts({ campaignId: "campaign-1", posts });
    expect(result.postsCreated).toBe(2);
    expect(db.clipPost.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(
      db.clipPost.createManyAndReturn.mock.calls[0]?.[0].data.map(
        (row: { platformVideoId: string }) => row.platformVideoId,
      ),
    ).toEqual(["aaaaaaaaaaa", "bbbbbbbbbbb"]);
    expect(db.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      db.clipPost.createManyAndReturn.mock.invocationCallOrder[0]!,
    );
  });
});
