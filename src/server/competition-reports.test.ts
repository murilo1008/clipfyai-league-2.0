import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  loadCampaignGrowth,
  loadCampaignReports,
  loadEligiblePlatformsByUsername,
} from "./competition-reports";

const campaign = {
  id: "camp-1",
  name: "Competição",
  status: "ACTIVE",
  startDate: new Date("2026-09-01T00:00:00.000Z"),
  endDate: new Date("2026-10-31T00:00:00.000Z"),
};

const post = (id: string, views: bigint, likes: number, comments: number) => ({
  id,
  username: `user-${id}`,
  submittedUrl: `https://tiktok.com/@user/video/${id}`,
  views,
  likes,
  comments,
  shares: 1,
  thumbnailUrl: null,
  platform: "TIKTOK",
  postedAt: new Date("2026-09-10T12:00:00.000Z"),
});

const growthRows = [
  { date: "2026-09-10", views: 1_000n, likes: 50n, comments: 5n, shares: 2n },
  {
    date: "2026-09-11",
    views: 9_007_199_254_740n,
    likes: 80n,
    comments: 9n,
    shares: 3n,
  },
];

function mockDb(overrides: { campaign?: typeof campaign | null } = {}) {
  const queryRaw = vi.fn().mockResolvedValue(growthRows);
  const groupBy = vi.fn((args: { by: string[] }) => {
    if (args.by.join() === "username") {
      return Promise.resolve([
        {
          username: "ana",
          _sum: { views: 5_000n, likes: 300, comments: 20, shares: 4, saves: null },
          _count: { id: 2 },
        },
        {
          username: "bia",
          _sum: { views: null, likes: null, comments: null, shares: null, saves: null },
          _count: { id: 1 },
        },
      ]);
    }
    return Promise.resolve([
      {
        platform: "TIKTOK",
        _sum: { views: 4_000n, likes: 200, comments: 15 },
        _count: { id: 2 },
      },
      {
        platform: "INSTAGRAM",
        _sum: { views: 1_000n, likes: 100, comments: 5 },
        _count: { id: 1 },
      },
    ]);
  });
  const findMany = vi.fn((args: { orderBy: Record<string, string> }) => {
    const [key] = Object.keys(args.orderBy);
    if (key === "views") return Promise.resolve([post("p1", 4_000n, 10, 1)]);
    if (key === "likes") return Promise.resolve([post("p2", 1_000n, 90, 2)]);
    return Promise.resolve([post("p3", 500n, 5, 40)]);
  });
  const aggregate = vi.fn().mockResolvedValue({
    _sum: { views: 5_000n, likes: 300, comments: 20, shares: 4, saves: null },
    _count: { id: 3 },
  });
  const findUnique = vi
    .fn()
    .mockResolvedValue(
      overrides.campaign === undefined ? campaign : overrides.campaign,
    );

  const db = {
    $queryRaw: queryRaw,
    campaign: { findUnique },
    clipPost: { groupBy, findMany, aggregate },
  } as unknown as PrismaClient;

  return { db, queryRaw, groupBy, findMany, aggregate, findUnique };
}

describe("loadCampaignGrowth", () => {
  it("converte os totais diários para número e mantém a ordem do SQL", async () => {
    const { db, queryRaw } = mockDb();

    const growth = await loadCampaignGrowth(db, "camp-1");

    expect(growth).toEqual([
      { date: "2026-09-10", views: 1_000, likes: 50, comments: 5, shares: 2 },
      {
        date: "2026-09-11",
        views: 9_007_199_254_740,
        likes: 80,
        comments: 9,
        shares: 3,
      },
    ]);
    expect(queryRaw).toHaveBeenCalledOnce();
  });

  it("soma só a última coleta de cada post em cada dia, lida post a post", async () => {
    const { db, queryRaw } = mockDb();

    await loadCampaignGrowth(db, "camp-1");

    const [strings, ...values] = queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    const sql = strings.join("?").replace(/\s+/g, " ");
    expect(values).toEqual(["camp-1"]);
    expect(sql).toContain("CROSS JOIN LATERAL");
    expect(sql).toContain(
      `SELECT DISTINCT ON (DATE_TRUNC('day', metrics."collectedAt"))`,
    );
    expect(sql).toContain(`WHERE metrics."clipPostId" = post.id`);
    expect(sql).toContain(
      `ORDER BY DATE_TRUNC('day', metrics."collectedAt"), metrics."collectedAt" DESC`,
    );
    expect(sql).toContain(`post."campaignId" = ? AND post.status = 'ELIGIBLE'`);
    expect(sql).toContain("GROUP BY last_of_day.day ORDER BY last_of_day.day");
  });

  it("devolve lista vazia sem métricas", async () => {
    const { db, queryRaw } = mockDb();
    queryRaw.mockResolvedValueOnce([]);

    await expect(loadCampaignGrowth(db, "camp-1")).resolves.toEqual([]);
  });
});

describe("loadCampaignReports", () => {
  it("monta o relatório com os totais, tops e crescimento", async () => {
    const { db } = mockDb();

    const reports = await loadCampaignReports(db, "camp-1");

    expect(reports.campaign).toEqual(campaign);
    expect(reports.topAccounts).toEqual([
      {
        username: "ana",
        platform: "INSTAGRAM",
        profileUrl: "https://instagram.com/ana",
        totalViews: 5_000,
        totalLikes: 300,
        totalComments: 20,
        totalShares: 4,
        postsCount: 2,
      },
      {
        username: "bia",
        platform: "INSTAGRAM",
        profileUrl: "https://instagram.com/bia",
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        postsCount: 1,
      },
    ]);
    expect(reports.topPostsByViews).toEqual([
      { ...post("p1", 4_000n, 10, 1), views: 4_000 },
    ]);
    expect(reports.topPostsByLikes).toEqual([
      { ...post("p2", 1_000n, 90, 2), views: 1_000 },
    ]);
    expect(reports.topPostsByComments).toEqual([
      { ...post("p3", 500n, 5, 40), views: 500 },
    ]);
    expect(reports.growthData.map((point) => point.date)).toEqual([
      "2026-09-10",
      "2026-09-11",
    ]);
    expect(reports.totalStats).toEqual({
      totalViews: 5_000,
      totalLikes: 300,
      totalComments: 20,
      totalShares: 4,
      totalSaves: 0,
      totalPosts: 3,
    });
    expect(reports.platformStats).toEqual([
      {
        platform: "TIKTOK",
        totalViews: 4_000,
        totalLikes: 200,
        totalComments: 15,
        postsCount: 2,
      },
      {
        platform: "INSTAGRAM",
        totalViews: 1_000,
        totalLikes: 100,
        totalComments: 5,
        postsCount: 1,
      },
    ]);
  });

  it("não devolve mais a lista completa de posts nem de contas", async () => {
    const { db } = mockDb();

    const reports = await loadCampaignReports(db, "camp-1");

    expect(reports).not.toHaveProperty("allPosts");
    expect(reports).not.toHaveProperty("allAccounts");
  });

  it("limita todas as consultas aos posts elegíveis da campanha", async () => {
    const { db, groupBy, findMany, aggregate, findUnique } = mockDb();

    await loadCampaignReports(db, "camp-1");

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "camp-1" } }),
    );
    for (const call of [
      ...groupBy.mock.calls,
      ...findMany.mock.calls,
      ...aggregate.mock.calls,
    ]) {
      expect(call[0]).toMatchObject({
        where: { campaignId: "camp-1", status: "ELIGIBLE" },
      });
    }
    // Só os tops são listados, sempre limitados a 10
    expect(findMany).toHaveBeenCalledTimes(3);
    for (const [args] of findMany.mock.calls) {
      expect(args).toMatchObject({ take: 10 });
    }
    expect(groupBy).toHaveBeenCalledTimes(2);
  });

  it("falha com NOT_FOUND quando a campanha não existe", async () => {
    const { db } = mockDb({ campaign: null });

    await expect(loadCampaignReports(db, "nao-existe")).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Campanha não encontrada",
    });
  });
});

describe("loadEligiblePlatformsByUsername", () => {
  it("agrupa as plataformas por conta numa consulta só", async () => {
    const groupBy = vi.fn().mockResolvedValue([
      { username: "ana", platform: "TIKTOK" },
      { username: "bia", platform: "INSTAGRAM" },
      { username: "ana", platform: "YOUTUBE" },
      { username: null, platform: "KWAI" },
    ]);
    const db = { clipPost: { groupBy } } as unknown as PrismaClient;

    const platforms = await loadEligiblePlatformsByUsername(db, "camp-1");

    expect(groupBy).toHaveBeenCalledOnce();
    expect(groupBy).toHaveBeenCalledWith({
      by: ["username", "platform"],
      where: {
        campaignId: "camp-1",
        status: "ELIGIBLE",
        username: { not: null },
      },
    });
    expect(Object.fromEntries(platforms)).toEqual({
      ana: ["TIKTOK", "YOUTUBE"],
      bia: ["INSTAGRAM"],
    });
  });
});
