import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: "admin-1" }),
  currentUser: vi.fn(),
}));
vi.mock("@/server/db", () => ({ db: {} }));

const { getDetails, getCharts } = vi.hoisted(() => ({
  getDetails: vi.fn(),
  getCharts: vi.fn(),
}));

// O sandbox lê a competição pelas mesmas queries da página do admin; aqui
// elas viram stubs para o teste não depender das queries de ranking.
vi.mock("./admin", async () => {
  const { z } = await import("zod");
  const { adminProcedure, createTRPCRouter } = await import(
    "@/server/api/trpc"
  );
  const input = z.object({ slug: z.string() });
  return {
    adminRouter: createTRPCRouter({
      getCompetitionDetailsAdmin: adminProcedure
        .input(input)
        .query(({ input }) => getDetails(input.slug)),
      getCompetitionChartsAdmin: adminProcedure
        .input(input)
        .query(({ input }) => getCharts(input.slug)),
    }),
  };
});

import { competitionSandboxRouter } from "./competition-sandbox";

const details = {
  campaign: {
    name: "Belli - Outubro",
    description: null,
    coverImageUrl: null,
    status: "ACTIVE",
    startDate: "2026-10-01T03:00:00.000Z",
    endDate: "2026-10-31T02:59:59.000Z",
    platforms: ["TIKTOK"],
    requiredHashtags: [],
    requiredMentions: [],
    totalPrize: "R$ 5.000",
    isPrivate: false,
    isProOnly: false,
    rankingMetricType: "VIEWS",
    organization: { name: "Clipfy" },
  },
  stats: {
    totalViews: 1000,
    totalLikes: 50,
    totalComments: 5,
    totalShares: 1,
    totalSaves: 0,
    totalClippers: 3,
    totalPosts: 12,
    engagementRate: 5.6,
  },
  topMonthlyRanking: [],
  topAccountsRanking: [],
  topPostsForReport: [
    {
      id: "post-1",
      url: "https://tiktok.com/@ana/video/1",
      platform: "TIKTOK",
      username: "ana",
      clipperName: "Ana",
      views: 500,
      likes: 20,
      comments: 2,
      shares: 1,
      postedAt: "2026-10-05T15:00:00.000Z",
    },
  ],
  rankingRule: null,
};

const savedAt = new Date("2026-10-28T12:00:00Z");

function setup(role = "ADMIN") {
  const db = {
    user: { findUnique: vi.fn().mockResolvedValue({ role }) },
    campaign: {
      findUnique: vi.fn().mockResolvedValue({
        id: "campaign-1",
        name: "Belli - Outubro",
        slug: "belli-outubro",
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    competitionSandbox: {
      findUnique: vi.fn().mockResolvedValue({
        id: "sandbox-1",
        name: "Apresentação",
        sourceCampaignId: "campaign-1",
        sourceCampaignName: "Belli - Outubro",
        data: {},
        importedAt: savedAt,
        updatedAt: savedAt,
      }),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "sandbox-2" }),
      update: vi.fn().mockResolvedValue({ id: "sandbox-1" }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    clipPost: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: "post-1", thumbnailUrl: "https://cdn.example.com/atual.jpg" },
        ]),
    },
  };
  const api = competitionSandboxRouter.createCaller({
    db,
    headers: new Headers(),
  } as never);
  return { api, db };
}

async function importedData() {
  const { api, db } = setup();
  await api.create({ campaignId: "campaign-1" });
  return db.competitionSandbox.create.mock.calls[0]![0].data.data;
}

beforeEach(() => {
  vi.clearAllMocks();
  getDetails.mockResolvedValue(details);
  getCharts.mockResolvedValue({
    platformDistribution: [],
    platformGrowthData: [],
    growthPlatforms: [],
  });
});

afterEach(() => vi.restoreAllMocks());

describe("sandbox de competição", () => {
  it("importa a competição pelo slug e grava só no sandbox", async () => {
    const { api, db } = setup();

    await expect(api.create({ campaignId: "campaign-1" })).resolves.toEqual({
      id: "sandbox-2",
    });

    expect(getDetails).toHaveBeenCalledWith("belli-outubro");
    expect(db.competitionSandbox.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Belli - Outubro (sandbox)",
        sourceCampaignId: "campaign-1",
        createdById: "admin-1",
        data: expect.objectContaining({
          version: 1,
          stats: expect.objectContaining({ totalViews: 1000 }),
        }),
      }),
      select: { id: true },
    });
  });

  it("importa sem os gráficos quando a query deles falha", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    getCharts.mockRejectedValue(new Error("timeout"));
    const { api, db } = setup();

    await api.create({ campaignId: "campaign-1", name: "Teste" });

    const data = db.competitionSandbox.create.mock.calls[0]![0].data;
    expect(data.name).toBe("Teste");
    expect(data.data.growth).toEqual([]);
  });

  it("não deixa quem não é admin importar", async () => {
    const { api, db } = setup("CLIPPER");

    await expect(api.create({ campaignId: "campaign-1" })).rejects.toThrow(
      /Admin/,
    );
    expect(db.competitionSandbox.create).not.toHaveBeenCalled();
  });

  it("salva só se ninguém gravou depois da versão carregada", async () => {
    const data = await importedData();
    const { api, db } = setup();

    const { updatedAt } = await api.update({
      id: "sandbox-1",
      name: "Apresentação",
      data,
      expectedUpdatedAt: savedAt,
    });

    // A versão devolvida é a gravada pelo próprio UPDATE condicional (ler
    // depois poderia trazer a de outro admin que salvou no meio)
    expect(db.competitionSandbox.updateMany).toHaveBeenCalledWith({
      where: { id: "sandbox-1", updatedAt: savedAt },
      data: { name: "Apresentação", data, updatedAt },
    });
    expect(updatedAt.getTime()).toBeGreaterThan(savedAt.getTime());
  });

  it("recusa salvar por cima de uma versão mais nova", async () => {
    const data = await importedData();
    const { api, db } = setup();
    db.competitionSandbox.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      api.update({
        id: "sandbox-1",
        name: "Apresentação",
        data,
        expectedUpdatedAt: savedAt,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    db.competitionSandbox.findUnique.mockResolvedValue(null);
    await expect(
      api.update({
        id: "sandbox-1",
        name: "Apresentação",
        data,
        expectedUpdatedAt: savedAt,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejeita dados fora do schema antes de gravar", async () => {
    const data = await importedData();
    const { api, db } = setup();

    await expect(
      api.update({
        id: "sandbox-1",
        name: "Apresentação",
        data: { ...data, stats: { ...data.stats, totalViews: -1 } },
        expectedUpdatedAt: savedAt,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.competitionSandbox.updateMany).not.toHaveBeenCalled();
  });

  it("abre o sandbox com a thumbnail atual dos posts de origem", async () => {
    const data = await importedData();
    expect(data.topPosts[0]).toMatchObject({
      sourcePostId: "post-1",
      thumbnailUrl: "",
    });
    const { api, db } = setup();
    db.competitionSandbox.findUnique.mockResolvedValue({
      id: "sandbox-1",
      name: "Apresentação",
      data,
      updatedAt: savedAt,
    });

    const sandbox = await api.get({ id: "sandbox-1" });

    expect(sandbox.postThumbnails).toEqual({
      "post-1": "https://cdn.example.com/atual.jpg",
    });
    expect(db.clipPost.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["post-1"] } },
      select: { id: true, thumbnailUrl: true },
    });
  });

  it("devolve o sandbox reimportado, sem depender de outro fetch", async () => {
    const data = await importedData();
    const { api, db } = setup();
    db.competitionSandbox.findUnique
      .mockResolvedValueOnce({
        id: "sandbox-1",
        sourceCampaignId: "campaign-1",
      })
      .mockResolvedValueOnce({
        id: "sandbox-1",
        name: "Apresentação",
        data,
        updatedAt: savedAt,
      });

    const sandbox = await api.reimport({ id: "sandbox-1" });

    expect(db.competitionSandbox.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sandbox-1" } }),
    );
    expect(sandbox.data.stats.totalViews).toBe(1000);
    expect(sandbox.postThumbnails["post-1"]).toBe(
      "https://cdn.example.com/atual.jpg",
    );
  });

  it("não reimporta quando a competição de origem foi excluída", async () => {
    const { api, db } = setup();
    db.competitionSandbox.findUnique.mockResolvedValue({
      id: "sandbox-1",
      sourceCampaignId: null,
    });

    await expect(api.reimport({ id: "sandbox-1" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(getDetails).not.toHaveBeenCalled();
    expect(db.competitionSandbox.update).not.toHaveBeenCalled();
  });
});
