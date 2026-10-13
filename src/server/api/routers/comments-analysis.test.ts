import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => vi.fn());

vi.mock("@clerk/nextjs/server", () => ({
  auth,
  currentUser: vi.fn(),
}));
vi.mock("@/server/db", () => ({ db: {} }));
vi.mock("@/env", () => ({
  env: {
    LEAGUE_API_URL: "http://league.test",
    LEAGUE_INTERNAL_API_KEY: "key",
  },
}));

import { commentsAnalysisRouter, countCampaignComments } from "./comments-analysis";

// O cache das contagens é do módulo: cada teste usa um agregado próprio.
let sequence = 0;

function campaignAggregate(campaignId: string) {
  return {
    id: `aggregate-${++sequence}`,
    scope: "CAMPAIGN",
    campaignId,
    clipPostId: null,
    generatedAt: new Date("2026-10-10T12:00:00.000Z"),
    analyzedComments: 10,
    sentimentCounts: {},
    topPositivePoints: [],
    topCriticisms: [],
    topSuggestions: [],
    summary: "",
    publicPerception: "",
    promptVersion: "v1",
    model: "m",
    representative: null,
  };
}

function setup(role: string, clientId = "client-1") {
  const findUniqueUser = vi.fn().mockResolvedValue({ role });
  const findUniqueCampaign = vi.fn().mockResolvedValue({ clientId });
  const aggregate = campaignAggregate(`campaign-${sequence}`);
  const findFirst = vi.fn().mockResolvedValue(aggregate);
  const queryRaw = vi
    .fn()
    .mockResolvedValue([{ storedComments: 120, newComments: 7 }]);
  const count = vi.fn();
  const db = {
    user: { findUnique: findUniqueUser },
    campaign: { findUnique: findUniqueCampaign },
    commentAnalysisAggregate: { findFirst },
    clipPostComment: { count },
    $queryRaw: queryRaw,
  };
  const api = commentsAnalysisRouter.createCaller({
    db,
    headers: new Headers(),
  } as never);
  return { api, db, aggregate, queryRaw, count, findUniqueUser };
}

describe("frescor do agregado da competição", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.mockResolvedValue({ userId: "client-1" });
  });

  it("conta pelos posts da competição, sem varrer ClipPostComment", async () => {
    const { api, aggregate, queryRaw, count } = setup("CLIENT");

    const result = await api.getCampaignAggregate({
      campaignId: aggregate.campaignId,
    });

    expect(result).toMatchObject({
      newCommentsSinceGeneratedAt: 7,
      isStale: true,
    });
    // O cliente não recebe o total guardado (metadado de admin).
    expect(result).not.toHaveProperty("storedComments");
    expect(count).not.toHaveBeenCalled();

    const [strings, ...values] = queryRaw.mock.calls[0]!;
    const sql = (strings as string[]).join("?");
    expect(sql).toContain('FROM "ClipPost" post');
    expect(sql).toContain("CROSS JOIN LATERAL");
    expect(sql).toContain('c."clipPostId" = post.id');
    expect(sql).toContain("OFFSET 0");
    expect(sql).toContain('WHERE post."campaignId" = ?');
    expect(values).toEqual([aggregate.generatedAt, aggregate.campaignId]);
  });

  it("reaproveita a contagem do mesmo agregado por 5 minutos", async () => {
    const { api, aggregate, queryRaw } = setup("ADMIN");

    const first = await api.getCampaignAggregate({
      campaignId: aggregate.campaignId,
    });
    await api.getCampaignAggregate({ campaignId: aggregate.campaignId });

    expect(first).toMatchObject({ storedComments: 120 });
    expect(queryRaw).toHaveBeenCalledOnce();
  });

  it("valida o acesso antes de contar", async () => {
    const { api, aggregate, queryRaw } = setup("CLIENT", "outro-cliente");

    await expect(
      api.getCampaignAggregate({ campaignId: aggregate.campaignId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("lê o role uma vez por chamada", async () => {
    const { api, findUniqueUser } = setup("ADMIN");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })));

    await api.estimateCampaign({ campaignId: "campaign-x" });

    expect(findUniqueUser).toHaveBeenCalledOnce();
    fetchMock.mockRestore();
  });
});

describe("countCampaignComments", () => {
  it("devolve zero sem posts", async () => {
    const db = { $queryRaw: vi.fn().mockResolvedValue([]) };
    await expect(
      countCampaignComments(db as never, "campaign", new Date(0)),
    ).resolves.toEqual({ storedComments: 0, newCommentsSinceGeneratedAt: 0 });
  });
});

describe("chamadas ao League", () => {
  afterEach(() => vi.restoreAllMocks());

  it("aborta depois do prazo e responde TIMEOUT", async () => {
    auth.mockResolvedValue({ userId: "admin-1" });
    const { api } = setup("ADMIN");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_url, init) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        const error = new Error("The operation was aborted due to timeout");
        error.name = "TimeoutError";
        throw error;
      });

    await expect(
      api.estimatePost({ postId: "post-1" }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
