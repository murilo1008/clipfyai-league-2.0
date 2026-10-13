import { beforeEach, describe, expect, it, vi } from "vitest";

const currentUser = vi.hoisted(() => vi.fn());
const getCampaignPerformance = vi.hoisted(() => vi.fn());

vi.mock("@clerk/nextjs/server", () => ({
  currentUser,
  // privateProcedure autentica via auth(); deriva do mesmo mock de currentUser
  auth: async () => ({ userId: ((await currentUser()) as { id?: string } | null)?.id ?? null }),
  clerkClient: vi.fn(),
}));
vi.mock("@/server/db", () => ({ db: {} }));
vi.mock(
  "@/server/performance/get-campaign-performance",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/server/performance/get-campaign-performance")
    >()),
    getCampaignPerformance,
  }),
);

import { clientRouter } from "./client";

type TestCampaign = {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE";
  performanceSettings: { investedAmount: number | null } | null;
};

const linkedCampaign = (
  id: string,
  investedAmount: number | null,
): TestCampaign => ({
  id,
  name: `Competição ${id}`,
  slug: id,
  status: "ACTIVE",
  performanceSettings: investedAmount === null ? null : { investedAmount },
});

function caller(campaigns: TestCampaign[]) {
  const findMany = vi.fn().mockResolvedValue(campaigns);
  const api = clientRouter.createCaller({
    db: {
      user: { findUnique: vi.fn().mockResolvedValue({ role: "CLIENT" }) },
      campaign: { findMany },
    },
    headers: new Headers(),
  } as never);
  return { api, findMany };
}

describe("visibilidade da performance do cliente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser.mockResolvedValue({ id: "client-1" });
    getCampaignPerformance.mockImplementation(async (_db, id: string) => ({
      campaign: { id, name: `Competição ${id}` },
      summary: {
        investedAmount: 100,
        totalViews: 1000,
        equivalentAdsCost: 13,
        referenceCpm: 13,
      },
      cpmHistory: [],
      profiles: [],
      videos: [],
    }));
  });

  it("oculta a performance quando o cliente não tem competições", async () => {
    const { api } = caller([]);
    expect(await api.hasPerformance()).toBe(false);
    expect((await api.getPerformance()).campaigns).toEqual([]);
  });

  it("mostra uma competição quando o investimento foi informado", async () => {
    const { api, findMany } = caller([linkedCampaign("campaign-1", 100)]);
    expect(await api.hasPerformance()).toBe(true);
    const result = await api.getPerformance();
    expect(result.campaigns).toHaveLength(1);
    expect(result.selected?.summary.investedAmount).toBe(100);
    expect(getCampaignPerformance).toHaveBeenCalledWith(
      expect.anything(),
      "campaign-1",
      { snapshotResolution: "daily" },
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId: "client-1" } }),
    );
  });

  it.each([0, null])(
    "oculta todas as competições quando uma delas tem investimento %s",
    async (investedAmount) => {
      const { api } = caller([
        linkedCampaign("configured", 100),
        linkedCampaign("pending", investedAmount),
      ]);
      expect(await api.hasPerformance()).toBe(false);
      expect((await api.getPerformance()).campaigns).toEqual([]);
      expect(getCampaignPerformance).not.toHaveBeenCalled();
      await expect(
        api.getPerformance({ campaignId: "configured" }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    },
  );

  it("mostra a visão geral apenas quando todas as competições têm investimento", async () => {
    const { api } = caller([
      linkedCampaign("campaign-1", 100),
      linkedCampaign("campaign-2", 200),
    ]);
    expect(await api.hasPerformance()).toBe(true);
    const result = await api.getPerformance();
    expect(result.campaigns.map((campaign) => campaign.id)).toEqual([
      "campaign-1",
      "campaign-2",
    ]);
    expect(result.overall?.summary.investedAmount).toBe(200);
    expect(getCampaignPerformance).toHaveBeenCalledTimes(2);
  });

  it("calcula só a competição escolhida", async () => {
    const { api } = caller([
      linkedCampaign("campaign-1", 100),
      linkedCampaign("campaign-2", 200),
      linkedCampaign("campaign-3", 300),
    ]);
    const result = await api.getPerformance({ campaignId: "campaign-2" });

    expect(getCampaignPerformance).toHaveBeenCalledOnce();
    expect(getCampaignPerformance).toHaveBeenCalledWith(
      expect.anything(),
      "campaign-2",
      { snapshotResolution: "daily" },
    );
    expect(result.selected?.campaign.id).toBe("campaign-2");
    expect(result.campaigns.map((campaign) => campaign.id)).toEqual([
      "campaign-1",
      "campaign-2",
      "campaign-3",
    ]);
    expect(result.overall).toBeNull();
    expect(result.aggregate).toBeNull();
  });

  it("recusa a competição de outro cliente sem calculá-la", async () => {
    const { api, findMany } = caller([
      linkedCampaign("campaign-1", 100),
      linkedCampaign("campaign-2", 200),
    ]);

    await expect(
      api.getPerformance({ campaignId: "campaign-de-outro-cliente" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getCampaignPerformance).not.toHaveBeenCalled();
    // A lista que autoriza é sempre a do cliente logado.
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId: "client-1" } }),
    );
  });

  it("recusa quem não é cliente", async () => {
    const findMany = vi.fn();
    const api = clientRouter.createCaller({
      db: {
        user: { findUnique: vi.fn().mockResolvedValue({ role: "CLIPPER" }) },
        campaign: { findMany },
      },
      headers: new Headers(),
    } as never);

    await expect(
      api.getPerformance({ campaignId: "campaign-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(findMany).not.toHaveBeenCalled();
    expect(getCampaignPerformance).not.toHaveBeenCalled();
  });
});

describe("posts do cliente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser.mockResolvedValue({ id: "client-1" });
  });

  function postsCaller(campaigns: TestCampaign[]) {
    const postsFindMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const api = clientRouter.createCaller({
      db: {
        user: { findUnique: vi.fn().mockResolvedValue({ role: "CLIENT" }) },
        campaign: { findMany: vi.fn().mockResolvedValue(campaigns) },
        clipPost: { findMany: postsFindMany, count },
      },
      headers: new Headers(),
    } as never);
    return { api, postsFindMany };
  }

  it("recusa a competição de outro cliente vinda da URL", async () => {
    const { api, postsFindMany } = postsCaller([linkedCampaign("camp-a", 100)]);

    await expect(api.getAllPosts({ campaignId: "camp-outro" })).rejects.toThrow(
      "Esta competição não está vinculada à sua conta",
    );
    expect(postsFindMany).not.toHaveBeenCalled();
  });

  it("filtra pela competição do cliente quando ela é informada", async () => {
    const { api, postsFindMany } = postsCaller([
      linkedCampaign("camp-a", 100),
      linkedCampaign("camp-b", 100),
    ]);

    await api.getAllPosts({ campaignId: "camp-b" });

    expect(postsFindMany.mock.calls[0]?.[0]).toMatchObject({
      where: { campaignId: "camp-b" },
    });
  });
});
