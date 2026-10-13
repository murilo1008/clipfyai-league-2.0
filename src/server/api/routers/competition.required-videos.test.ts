import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const currentUser = vi.hoisted(() => vi.fn());

vi.mock("@clerk/nextjs/server", () => ({
  currentUser,
  // privateProcedure autentica via auth(); deriva do mesmo mock de currentUser
  auth: async () => ({ userId: ((await currentUser()) as { id?: string } | null)?.id ?? null }),
}));
vi.mock("@/server/db", () => ({ db: {} }));

import { campaignRouter } from "./competition";
import { invalidateCachedQueries } from "@/server/memory-cache";

const requiredVideo = {
  id: "video-1",
  platform: "YOUTUBE" as const,
  originalUrl: "https://www.youtube.com/watch?v=official-video",
  title: "Conteúdo oficial",
  description: "Produza cortes deste vídeo.",
  thumbnailUrl: null,
};

function caller(
  options: {
    videos?: (typeof requiredVideo)[];
    participates?: boolean;
    archived?: boolean;
  } = {},
) {
  const findCampaign = vi.fn().mockResolvedValue({
    id: "campaign-1",
    name: "Competição",
    slug: "competicao",
    status: options.archived ? "ARCHIVED" : "ACTIVE",
    startDate: new Date("2026-09-01T00:00:00Z"),
    endDate: new Date("2026-10-31T00:00:00Z"),
    platforms: ["YOUTUBE"],
    requiredHashtags: [],
    requiredMentions: [],
    rankingMetricType: "VIEWS",
    performanceVideos: options.videos ?? [requiredVideo],
  });
  const findApplication = vi
    .fn()
    .mockResolvedValue(
      options.participates === false ? null : { id: "application-1", status: "APPROVED" },
    );
  const api = campaignRouter.createCaller({
    db: {
      clipperProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: "clipper-1" }),
      },
      campaign: { findUnique: findCampaign },
      clipperApplication: {
        findUnique: findApplication,
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([]),
      },
      clipPost: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        groupBy: vi.fn().mockResolvedValue([]),
        aggregate: vi.fn().mockResolvedValue({ _sum: {}, _count: { id: 0 } }),
      },
      monthlyRankingEntry: { findFirst: vi.fn().mockResolvedValue(null) },
      transaction: { aggregate: vi.fn().mockResolvedValue({ _sum: {} }) },
      dailyRanking: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      clipPostMetrics: { findMany: vi.fn().mockResolvedValue([]) },
      applicationSocialAccount: { count: vi.fn().mockResolvedValue(0) },
      $queryRaw: vi.fn().mockResolvedValue([]),
    },
    headers: new Headers(),
  } as never);
  return { api, findCampaign, findApplication };
}

describe("vídeos obrigatórios na competição do clipador", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    invalidateCachedQueries("");
    vi.clearAllMocks();
    currentUser.mockResolvedValue({ id: "user-1" });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("retorna os conteúdos ativos sem depender da notificação por e-mail", async () => {
    const { api, findCampaign } = caller();

    const result = await api.getCompetitionDetails({ slug: "competicao" });

    expect(result.requiredVideos).toEqual([requiredVideo]);
    const query = findCampaign.mock.calls[0]?.[0] as {
      select: { performanceVideos: { where: Record<string, unknown> } };
    };
    expect(query.select.performanceVideos.where).toEqual({ isActive: true });
    expect(result.requiredVideos[0]).not.toHaveProperty("notifyClippers");
    expect(result.requiredVideos[0]).not.toHaveProperty(
      "notificationLastError",
    );
  });

  it("retorna uma lista vazia quando não há vídeos ativos", async () => {
    const { api } = caller({ videos: [] });

    const result = await api.getCompetitionDetails({ slug: "competicao" });

    expect(result.requiredVideos).toEqual([]);
  });

  it("mantém os vídeos restritos aos participantes da competição", async () => {
    const { api } = caller({ participates: false });

    await expect(
      api.getCompetitionDetails({ slug: "competicao" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("não disponibiliza os vídeos de uma competição arquivada", async () => {
    const { api, findApplication } = caller({ archived: true });

    await expect(
      api.getCompetitionDetails({ slug: "competicao" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(findApplication).not.toHaveBeenCalled();
  });
});
