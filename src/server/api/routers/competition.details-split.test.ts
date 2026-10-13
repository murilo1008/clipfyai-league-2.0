import { beforeEach, describe, expect, it, vi } from "vitest";

const currentUser = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({
  currentUser,
  auth: async () => ({ userId: ((await currentUser()) as { id?: string } | null)?.id ?? null }),
}));
vi.mock("@/server/db", () => ({ db: {} }));

import { campaignRouter } from "./competition";
import { invalidateCachedQueries } from "@/server/memory-cache";

/** SQL final com os fragmentos Prisma.sql embutidos. */
function renderSql(call: unknown[]) {
  const strings = call[0] as TemplateStringsArray;
  const values: unknown[] = [];
  let text = "";
  strings.forEach((part, index) => {
    text += part;
    if (index < call.length - 1) {
      const value = call[index + 1] as { strings?: string[]; values?: unknown[] };
      if (value && typeof value === "object" && Array.isArray(value.strings)) {
        text += value.strings.join("?");
        values.push(...(value.values ?? []));
      } else {
        text += "?";
        values.push(value);
      }
    }
  });
  return { text, values };
}

const profiles: Record<string, string> = {
  "user-1": "clipper-1",
  "user-2": "clipper-2",
  "user-7": "clipper-7",
};

function fixture() {
  const campaign = {
    id: "campaign-1",
    name: "Competição",
    slug: "competicao",
    status: "ACTIVE",
    startDate: new Date("2026-09-01T00:00:00Z"),
    endDate: new Date("2026-11-01T00:00:00Z"),
    platforms: [],
    requiredHashtags: [],
    requiredMentions: [],
    prizeInfo: null,
    performanceVideos: [],
    rankingMetricType: "VIEWS" as const,
    activeRankingRule: {
      dailyTopCount: 15,
      dailyPrizeTable: { "1": 10 },
      monthlyTopCount: 2,
      monthlyPrizeTable: { "1": 100 },
    },
  };
  // 7 clipadores com views decrescentes: clipper-1 > ... > clipper-7
  const groups = [1, 2, 3, 4, 5, 6, 7].map((i) => ({
    applicationId: `app-${i}`,
    _sum: { views: BigInt(1000 - i), likes: 0, comments: 0, shares: 0, saves: 0 },
    _count: { id: 1 },
  }));
  const db = {
    clipperProfile: {
      findUnique: vi.fn().mockImplementation(async ({ where }) => ({
        id: profiles[where.userId as string],
        artisticName: null,
        fullName: "Fulano",
      })),
    },
    campaign: { findUnique: vi.fn().mockResolvedValue(campaign) },
    clipperApplication: {
      findUnique: vi.fn().mockImplementation(async ({ where }) => {
        const profileId = where.campaignId_clipperProfileId.clipperProfileId as string;
        return {
          id: profileId.replace("clipper", "app"),
          status: "APPROVED",
          campaign: { status: "ACTIVE" },
        };
      }),
      count: vi.fn().mockResolvedValue(7),
      findMany: vi.fn().mockImplementation(async ({ where }) =>
        where.campaignId
          ? groups.map((g) => ({
              id: g.applicationId,
              clipperProfileId: g.applicationId.replace("app", "clipper"),
            }))
          : (where.id.in as string[]).map((id) => ({
              id,
              clipperProfile: {
                fullName: `Nome ${id}`,
                artisticName: null,
                userId: id.replace("app", "user"),
                user: { imageUrl: null },
                clan: null,
              },
            })),
      ),
    },
    clipPost: {
      groupBy: vi.fn().mockImplementation(async ({ by }) =>
        by[0] === "applicationId" ? groups : [],
      ),
      aggregate: vi.fn().mockResolvedValue({ _sum: {}, _count: { id: 0 } }),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(3),
    },
    transaction: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 30 } }) },
    applicationSocialAccount: { count: vi.fn().mockResolvedValue(2) },
    dailyRanking: { findFirst: vi.fn().mockResolvedValue(null) },
    dailyRankingEntry: { findMany: vi.fn().mockResolvedValue([]) },
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
  return {
    db,
    api: campaignRouter.createCaller({ db, headers: new Headers() } as never),
  };
}

beforeEach(() => {
  invalidateCachedQueries("");
  currentUser.mockResolvedValue({ id: "user-1" });
});

describe("página da competição do clipador", () => {
  it("mostra a posição mensal real mesmo fora do top", async () => {
    const { api } = fixture();
    currentUser.mockResolvedValue({ id: "user-7" });
    const details = await api.getCompetitionDetails({ slug: "competicao" });
    expect(details.myMonthlyRanking).toBe(7);
    expect(details.myCurrentRanking).toBe(7);
    expect(details.myPreviousRanking).toBe(7);
    expect(details.applicationAccountsCount).toBe(2);
    expect(details).not.toHaveProperty("myPosts");
    expect(details).not.toHaveProperty("topRanking");
  });

  it("ranking compartilhado em cache com isCurrentUser por usuário", async () => {
    const { api, db } = fixture();
    const forUser1 = await api.getCompetitionRanking({ campaignId: "campaign-1" });
    currentUser.mockResolvedValue({ id: "user-2" });
    const forUser2 = await api.getCompetitionRanking({ campaignId: "campaign-1" });

    expect(forUser1.topRanking.map((row) => row.isCurrentUser)).toEqual([true, false]);
    expect(forUser2.topRanking.map((row) => row.isCurrentUser)).toEqual([false, true]);
    // Ranking mensal e contagem do dia calculados uma vez só.
    expect(
      db.clipPost.groupBy.mock.calls.filter(([args]) => args.by[0] === "applicationId"),
    ).toHaveLength(1);
    expect(db.clipPost.count).toHaveBeenCalledTimes(1);
    expect(forUser1.todayPostsCount).toBe(3);
    // Sem snapshot do dia: ranking ao vivo pelo SQL.
    expect(forUser1.dailyRankingSource).toBe("LIVE");
  });

  it("bloqueia o ranking para quem não participa", async () => {
    const { api, db } = fixture();
    db.clipperApplication.findUnique.mockResolvedValue({ status: "WITHDRAWN" });
    await expect(
      api.getCompetitionRanking({ campaignId: "campaign-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("meus posts paginados", () => {
  it.each([
    ["recent", `COALESCE(cp."postedAt", cp."createdAt" - interval '3 hours') DESC, cp."createdAt" DESC, cp."id" DESC`],
    ["views", `cp."views" DESC, cp."createdAt" DESC, cp."id" DESC`],
    ["earnings", `ORDER BY cp."createdAt" DESC, cp."id" DESC`],
  ] as const)("ordena por %s com a ordem base como desempate", async (sortBy, expected) => {
    const { api, db } = fixture();
    await api.getMyCompetitionPosts({ campaignId: "campaign-1", sortBy });
    const pageCall = db.$queryRaw.mock.calls.find((call) =>
      renderSql(call).text.includes("LIMIT"),
    )!;
    expect(renderSql(pageCall).text.replace(/\s+/g, " ")).toContain(expected);
  });

  it("aplica filtros, paginação e formata como a lista antiga", async () => {
    const { api, db } = fixture();
    db.$queryRaw.mockImplementation(async (...call: unknown[]) => {
      const { text } = renderSql(call);
      if (text.includes("COUNT(*)")) return [{ total: 30n }];
      return [{ id: "post-2" }, { id: "post-1" }];
    });
    db.clipPost.findMany.mockResolvedValue(
      ["post-1", "post-2"].map((id) => ({
        id,
        submittedUrl: `https://tiktok.com/${id}`,
        platform: "TIKTOK",
        thumbnailUrl: null,
        caption: null,
        username: null,
        postedAt: null,
        createdAt: new Date("2026-10-01T12:00:00Z"),
        views: 200n,
        likes: 10,
        comments: 5,
        shares: 5,
        saves: null,
        hashtags: [],
        status: id === "post-1" ? "DISQUALIFIED" : "ELIGIBLE",
        ineligibilityReason: null,
      })),
    );
    db.dailyRanking.findFirst.mockResolvedValue({ id: "daily-9" });
    db.dailyRankingEntry.findMany.mockResolvedValue([
      { clipPostId: "post-2", position: 4 },
    ]);

    const from = new Date("2026-10-08T03:00:00Z");
    const to = new Date("2026-10-09T03:00:00Z");
    const result = await api.getMyCompetitionPosts({
      campaignId: "campaign-1",
      platform: "TIKTOK",
      status: "ELIGIBLE",
      search: "Gol",
      timelineFrom: from,
      timelineTo: to,
      sortBy: "views",
      page: 2,
      pageSize: 24,
    });

    const pageCall = db.$queryRaw.mock.calls.find((call) =>
      renderSql(call).text.includes("LIMIT"),
    )!;
    const { text, values } = renderSql(pageCall);
    expect(text).toContain(`cp."platform"::text = ?`);
    expect(text).toContain(`cp."status"::text = ?`);
    // Legenda e termo em minúsculas pelo Postgres (mesma regra de acentos).
    expect(text).toContain(
      `strpos(lower(COALESCE(cp."caption", '')), lower(?::text)) > 0`,
    );
    expect(values).toEqual(
      expect.arrayContaining(["campaign-1", "app-1", "TIKTOK", "ELIGIBLE", "Gol", from, to, 24, 24]),
    );

    expect(result.total).toBe(30);
    expect(result.posts.map((post) => post.id)).toEqual(["post-2", "post-1"]);
    expect(result.posts[0]).toEqual({
      id: "post-2",
      url: "https://tiktok.com/post-2",
      platform: "TIKTOK",
      thumbnailUrl: "",
      caption: "",
      username: "",
      postedAt: null,
      createdAt: "2026-10-01T12:00:00.000Z",
      views: 200,
      likes: 10,
      comments: 5,
      shares: 5,
      saves: 0,
      engagementRate: 10,
      rankInCompetition: 4,
      // 30 de ganhos / 3 posts elegíveis, mesmo formato da lista antiga
      earnings: new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 0,
      }).format(10),
      status: "ELIGIBLE",
      ineligibilityReason: null,
      hashtags: [],
    });
    expect(result.posts[1]?.ineligibilityReason).toBe(
      "Post desqualificado. Nenhum motivo detalhado foi registrado.",
    );
  });
});
