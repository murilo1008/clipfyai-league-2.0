import type { Platform, PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  TARCISIO_CAMPAIGN_SLUG,
  TARCISIO_START_DATE,
  buildGrowthData,
  getCampaignDashboardMetrics,
  getCampaignTotals,
  growthWindow,
} from "./client-dashboard";

// O cache é do módulo: cada teste usa uma competição própria.
let sequence = 0;
const campaignId = () => `dashboard-campaign-${++sequence}`;

type RawCall = { sql: string; values: unknown[] };

function sqlOf(call: unknown[]): RawCall {
  const [strings, ...values] = call as [TemplateStringsArray, ...unknown[]];
  // Fragmentos Prisma.sql aninhados chegam como objetos com `strings`/`values`.
  const parts: string[] = [];
  const flat: unknown[] = [];
  strings.forEach((part, index) => {
    parts.push(part);
    if (index < values.length) {
      const value = values[index] as
        | { strings?: string[]; values?: unknown[] }
        | undefined;
      if (value && Array.isArray(value.strings)) {
        parts.push(value.strings.join("?"));
        flat.push(...(value.values ?? []));
      } else {
        parts.push("?");
        flat.push(value);
      }
    }
  });
  return { sql: parts.join(""), values: flat };
}

describe("getCampaignTotals", () => {
  const rows = [
    {
      platform: "INSTAGRAM" as Platform,
      allPosts: 12,
      posts: 10,
      views: 10_000n,
      likes: 500n,
      comments: 100n,
      shares: 50n,
      saves: 25n,
      recentViews: 2_000n,
    },
    {
      // Só posts não elegíveis: conta no total de posts, fora das plataformas.
      platform: "TIKTOK" as Platform,
      allPosts: 3,
      posts: 0,
      views: 0n,
      likes: 0n,
      comments: 0n,
      shares: 0n,
      saves: 0n,
      recentViews: 0n,
    },
  ];

  it("soma os totais e mantém só plataformas com post elegível", async () => {
    const queryRaw = vi.fn().mockResolvedValue(rows);
    const db = { $queryRaw: queryRaw } as unknown as PrismaClient;
    const id = campaignId();

    const totals = await getCampaignTotals(db, { id, slug: "marca" });

    expect(totals).toMatchObject({
      totalPosts: 15,
      totalViews: 10_000,
      totalLikes: 500,
      totalComments: 100,
      totalShares: 50,
      totalSaves: 25,
      recentViews: 2_000,
      platformStats: [
        {
          platform: "INSTAGRAM",
          totalViews: 10_000,
          totalLikes: 500,
          totalComments: 100,
          totalShares: 50,
          postsCount: 10,
        },
      ],
    });
    expect(totals.engagementRate).toBeGreaterThan(0);

    const { sql, values } = sqlOf(queryRaw.mock.calls[0]!);
    expect(sql).toContain('WHERE "campaignId" = ?');
    expect(sql).toContain("FILTER (WHERE status = 'ELIGIBLE')");
    expect(sql).toContain("GROUP BY platform");
    expect(sql).not.toContain('"postedAt"');
    expect(values).toContain(id);
  });

  it("aplica o corte de data da competição do Tarcísio", async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const db = { $queryRaw: queryRaw } as unknown as PrismaClient;

    const totals = await getCampaignTotals(db, {
      id: campaignId(),
      slug: TARCISIO_CAMPAIGN_SLUG,
    });

    const { sql, values } = sqlOf(queryRaw.mock.calls[0]!);
    expect(sql).toContain('AND "postedAt" >= ?::timestamp');
    expect(values).toContain(TARCISIO_START_DATE);
    expect(totals.totalPosts).toBe(0);
    expect(totals.platformStats).toEqual([]);
  });

  it("reaproveita os totais da competição por 60 s", async () => {
    const queryRaw = vi.fn().mockResolvedValue(rows);
    const db = { $queryRaw: queryRaw } as unknown as PrismaClient;
    const campaign = { id: campaignId(), slug: "marca" };

    await Promise.all([
      getCampaignTotals(db, campaign),
      getCampaignTotals(db, campaign),
    ]);
    await getCampaignTotals(db, campaign);

    expect(queryRaw).toHaveBeenCalledOnce();
  });
});

describe("buildGrowthData", () => {
  /** Algoritmo anterior: post a post, pelo dia UTC de createdAt. */
  function legacyGrowth(
    posts: Array<{ platform: Platform; views: bigint; createdAt: Date }>,
    platforms: Platform[],
    start: Date,
    end: Date,
  ) {
    const growthPlatforms = [...platforms].sort();
    const totalDays = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );
    const dayMap = new Map<string, Record<string, number>>();
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const row: Record<string, number> = { total: 0 };
      growthPlatforms.forEach((p) => (row[p] = 0));
      dayMap.set(d.toISOString().slice(0, 10), row);
    }
    for (const post of posts) {
      const row = dayMap.get(post.createdAt.toISOString().slice(0, 10));
      if (!row) continue;
      const views = Number(post.views || 0);
      row.total = (row.total || 0) + views;
      row[post.platform] = (row[post.platform] || 0) + views;
    }
    const cumTotals: Record<string, number> = {};
    let cumTotal = 0;
    return Array.from(dayMap.entries()).map(([date, row]) => {
      cumTotal += row.total || 0;
      const entry: Record<string, number | string> = { total: cumTotal };
      for (const p of growthPlatforms) {
        cumTotals[p] = (cumTotals[p] || 0) + (row[p] || 0);
        entry[p] = cumTotals[p];
      }
      return { date, ...entry };
    });
  }

  it("dá o mesmo resultado que somar post a post", () => {
    const campaign = {
      startDate: new Date("2026-10-01T15:00:00.000Z"),
      endDate: new Date("2026-10-05T15:00:00.000Z"),
    };
    const { start, end } = growthWindow(
      campaign,
      new Date("2026-10-20T00:00:00.000Z"),
    );
    const posts: Array<{ platform: Platform; views: bigint; createdAt: Date }> =
      [
        { platform: "TIKTOK", views: 100n, createdAt: new Date("2026-10-01T03:00:00.000Z") },
        { platform: "TIKTOK", views: 50n, createdAt: new Date("2026-10-01T23:59:59.000Z") },
        { platform: "INSTAGRAM", views: 70n, createdAt: new Date("2026-10-03T12:00:00.000Z") },
        { platform: "INSTAGRAM", views: 30n, createdAt: new Date("2026-10-03T00:00:00.000Z") },
        // Fora da janela do mapa de dias: ignorado nos dois algoritmos.
        { platform: "TIKTOK", views: 999n, createdAt: new Date("2026-09-20T12:00:00.000Z") },
      ];

    // O que o GROUP BY do banco devolve: soma por dia (UTC) e plataforma.
    const sums = new Map<string, { day: string; platform: Platform; views: bigint }>();
    for (const post of posts) {
      const day = post.createdAt.toISOString().slice(0, 10);
      const key = `${day}|${post.platform}`;
      const current = sums.get(key);
      if (current) current.views += post.views;
      else sums.set(key, { day, platform: post.platform, views: post.views });
    }

    const platforms: Platform[] = ["TIKTOK", "INSTAGRAM"];
    const { growthData, growthPlatforms } = buildGrowthData({
      rows: [...sums.values()],
      platforms,
      start,
      end,
    });

    expect(growthPlatforms).toEqual(["INSTAGRAM", "TIKTOK"]);
    expect(growthData).toEqual(legacyGrowth(posts, platforms, start, end));
    expect(growthData.at(-1)).toMatchObject({
      total: 250,
      INSTAGRAM: 100,
      TIKTOK: 150,
    });
  });
});

describe("getCampaignDashboardMetrics", () => {
  function setup(slug = "marca") {
    const campaign = {
      id: campaignId(),
      slug,
      startDate: new Date("2026-10-01T15:00:00.000Z"),
      endDate: new Date("2026-10-03T15:00:00.000Z"),
    };
    const queryRaw = vi.fn(async (...call: unknown[]) => {
      const { sql } = sqlOf(call);
      if (sql.includes("GROUP BY platform")) {
        return [
          {
            platform: "TIKTOK",
            allPosts: 4,
            posts: 3,
            views: 3_000n,
            likes: 30n,
            comments: 3n,
            shares: 1n,
            saves: 0n,
            recentViews: 0n,
          },
        ];
      }
      if (sql.includes("TO_CHAR")) {
        return [{ day: "2026-10-02", platform: "TIKTOK", views: 3_000n }];
      }
      if (sql.includes("WITH accounts")) {
        return [
          {
            username: "clipador",
            platform: "TIKTOK",
            views: 2_000n,
            likes: 20n,
            comments: 2n,
            posts: 2,
          },
          {
            username: "outro",
            platform: null,
            views: 1_000n,
            likes: 10n,
            comments: 1n,
            posts: 1,
          },
        ];
      }
      return [];
    });
    const count = vi.fn().mockResolvedValue(7);
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "post-1",
        username: null,
        submittedUrl: "https://tiktok.com/@clipador/video/1",
        thumbnailUrl: null,
        platform: "TIKTOK",
        views: 2_000n,
        likes: 20,
        comments: 2,
        shares: 1,
        saves: null,
        postedAt: new Date("2026-10-02T10:00:00.000Z"),
      },
    ]);
    const db = {
      $queryRaw: queryRaw,
      clipperApplication: { count },
      clipPost: { findMany },
    } as unknown as PrismaClient;
    return { campaign, db, queryRaw, count, findMany };
  }

  it("monta o mesmo formato do dashboard a partir das agregações", async () => {
    const { campaign, db, count, findMany, queryRaw } = setup();

    const metrics = await getCampaignDashboardMetrics(db, campaign);

    expect(count).toHaveBeenCalledWith({
      where: { campaignId: campaign.id, status: "APPROVED" },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { campaignId: campaign.id, status: "ELIGIBLE" },
        orderBy: { views: "desc" },
        take: 5,
      }),
    );
    expect(metrics).toMatchObject({
      totalParticipants: 7,
      totalPosts: 4,
      totalViews: 3_000,
      growthPlatforms: ["TIKTOK"],
      topPosts: [
        {
          id: "post-1",
          username: "",
          url: "https://tiktok.com/@clipador/video/1",
          views: 2_000,
          postedAt: "2026-10-02T10:00:00.000Z",
        },
      ],
      topAccounts: [
        {
          username: "clipador",
          platform: "TIKTOK",
          totalViews: 2_000,
          totalLikes: 20,
          totalComments: 2,
          postsCount: 2,
        },
        // Sem post para descobrir a plataforma: mesmo padrão de antes.
        { username: "outro", platform: "INSTAGRAM", totalViews: 1_000 },
      ],
    });
    expect(metrics.growthData.at(-1)).toMatchObject({ total: 3_000 });

    // Top contas: uma consulta só, com a plataforma do post de mais views.
    const accounts = queryRaw.mock.calls
      .map((call) => sqlOf(call).sql)
      .find((sql) => sql.includes("WITH accounts"));
    expect(accounts).toContain("ORDER BY SUM(views) DESC");
    expect(accounts).toContain("LIMIT 5");
    expect(accounts).toContain("ORDER BY post.views DESC");
  });

  it("aplica o corte do Tarcísio em todas as consultas", async () => {
    const { campaign, db, findMany, queryRaw } = setup(TARCISIO_CAMPAIGN_SLUG);

    await getCampaignDashboardMetrics(db, campaign);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          campaignId: campaign.id,
          status: "ELIGIBLE",
          postedAt: { gte: TARCISIO_START_DATE },
        },
      }),
    );
    for (const call of queryRaw.mock.calls) {
      expect(sqlOf(call).sql).toContain('"postedAt" >= ?::timestamp');
    }
  });

  it("reaproveita as métricas da competição por 60 s", async () => {
    const { campaign, db, queryRaw } = setup();

    await getCampaignDashboardMetrics(db, campaign);
    const calls = queryRaw.mock.calls.length;
    await getCampaignDashboardMetrics(db, campaign);

    expect(queryRaw.mock.calls.length).toBe(calls);
  });
});
