import { RankingMetricType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { computeMonthlyLeaderboard } from "./monthly-ranking-leaderboard";

function campaign(
  status: "ACTIVE" | "COMPLETED",
  rankingMetricType: RankingMetricType,
  monthlyTopCount = 2,
) {
  return {
    endDate: new Date("2026-10-02T23:00:00Z"),
    status,
    rankingMetricType,
    activeRankingRule: { monthlyTopCount, monthlyPrizeTable: { "1": 100 } },
  };
}

function hydrationMock() {
  return vi.fn().mockImplementation(async (args) => {
    // 1ª chamada: inscrições aprovadas (id + perfil); depois: hidratação do top.
    if (args.where.campaignId) {
      return ["app-1", "app-2", "app-3", "app-4"].map((id) => ({
        id,
        clipperProfileId: id.replace("app", "clipper"),
      }));
    }
    return (args.where.id.in as string[]).map((id) => ({
      id,
      clipperProfile: {
        fullName: `Nome ${id} Sobrenome`,
        artisticName: null,
        user: { imageUrl: `https://img/${id}` },
        clan: null,
      },
    }));
  });
}

function group(applicationId: string, views: bigint, likes = 0) {
  return {
    applicationId,
    _sum: { views, likes, comments: 0, shares: 0, saves: null },
    _count: { id: 1 },
  };
}

describe("ranking mensal (campanha ativa)", () => {
  it("hidrata só o top e devolve a posição real de todos", async () => {
    const findMany = hydrationMock();
    const db = {
      clipPost: {
        groupBy: vi
          .fn()
          .mockResolvedValue([
            group("app-1", 10n),
            group("app-2", 30n),
            group("app-3", 20n),
            group("app-4", 5n),
            group("app-rejeitada", 1000n),
          ]),
      },
      clipperApplication: { findMany },
    };

    const board = await computeMonthlyLeaderboard(
      db as never,
      "campaign-1",
      campaign("ACTIVE", RankingMetricType.VIEWS),
    );

    expect(board!.rows.map((row) => [row.position, row.applicationId])).toEqual([
      [1, "app-2"],
      [2, "app-3"],
    ]);
    expect(board!.rows[0]).toMatchObject({
      clipperProfileId: "clipper-2",
      clipperName: "Nome",
      clipperUsername: "Nome",
      clipperImageUrl: "https://img/app-2",
      totalViews: 30,
      totalSaves: 0,
      postsCount: 1,
      previousPosition: null,
      monthlyRankingEntryId: null,
    });
    expect(Object.fromEntries(board!.positionByClipperProfileId)).toEqual({
      "clipper-2": 1,
      "clipper-3": 2,
      "clipper-1": 3,
      "clipper-4": 4,
    });
    // Aprovadas: só id/perfil; hidratação: só as 2 do top.
    expect(findMany.mock.calls[0]?.[0]).toEqual({
      where: { campaignId: "campaign-1", status: "APPROVED" },
      select: { id: true, clipperProfileId: true },
    });
    expect(findMany.mock.calls[1]?.[0].where).toEqual({
      id: { in: ["app-2", "app-3"] },
    });
  });

  it("VIEWS: empate em views mantém a ordem do agrupamento (sort estável)", async () => {
    const db = {
      clipPost: {
        groupBy: vi
          .fn()
          .mockResolvedValue([
            group("app-3", 10n),
            group("app-1", 10n),
            group("app-2", 10n),
          ]),
      },
      clipperApplication: { findMany: hydrationMock() },
    };
    const board = await computeMonthlyLeaderboard(
      db as never,
      "campaign-1",
      campaign("ACTIVE", RankingMetricType.VIEWS, 3),
    );
    expect(board!.rows.map((row) => row.applicationId)).toEqual([
      "app-3",
      "app-1",
      "app-2",
    ]);
  });

  it("VIEWS_X_ENGAGEMENT: score e depois views", async () => {
    const db = {
      clipPost: {
        groupBy: vi.fn().mockResolvedValue([
          group("app-1", 100n, 10), // ER 10% → score 1000
          group("app-2", 200n, 10), // ER 5% → score 1000 (mais views)
          group("app-3", 1000n, 0), // score 0
        ]),
      },
      clipperApplication: { findMany: hydrationMock() },
    };
    const board = await computeMonthlyLeaderboard(
      db as never,
      "campaign-1",
      campaign("ACTIVE", RankingMetricType.VIEWS_X_ENGAGEMENT, 3),
    );
    expect(
      board!.rows.map((row) => [row.applicationId, row.rankingScore]),
    ).toEqual([
      ["app-2", 1000],
      ["app-1", 1000],
      ["app-3", 0],
    ]);
  });
});

describe("ranking mensal (campanha concluída)", () => {
  it("lê o último snapshot por post via LATERAL até endDate + 3h30", async () => {
    const queryRaw = vi.fn().mockResolvedValue([
      {
        applicationId: "app-1",
        views: 100n,
        likes: 20n,
        comments: 0n,
        shares: 0n,
        saves: 0n,
        postsCount: 2n,
      },
      {
        applicationId: "app-fora",
        views: 999n,
        likes: 0n,
        comments: 0n,
        shares: 0n,
        saves: 0n,
        postsCount: 1n,
      },
      {
        applicationId: "app-2",
        views: 300n,
        likes: 3n,
        comments: 0n,
        shares: 0n,
        saves: 0n,
        postsCount: 1n,
      },
    ]);
    const db = {
      $queryRaw: queryRaw,
      clipperApplication: { findMany: hydrationMock() },
      clipPost: { groupBy: vi.fn() },
    };

    const board = await computeMonthlyLeaderboard(
      db as never,
      "campaign-1",
      campaign("COMPLETED", RankingMetricType.VIEWS),
    );

    const sql = (queryRaw.mock.calls[0]?.[0] as string[]).join("?");
    expect(sql).toContain("CROSS JOIN LATERAL");
    expect(sql).toContain("OFFSET 0");
    expect(sql).toContain('ORDER BY cpm."collectedAt" DESC');
    expect(sql).toContain("LIMIT 1");
    expect(sql).toContain('GROUP BY p."applicationId"');
    expect(sql).toContain('ORDER BY MIN(p."id")');
    expect(queryRaw.mock.calls[0]?.[1]).toBe("campaign-1");
    expect(queryRaw.mock.calls[0]?.[2]).toEqual(
      new Date("2026-10-03T02:30:00Z"),
    );
    expect(db.clipPost.groupBy).not.toHaveBeenCalled();

    expect(
      board!.rows.map((row) => [row.applicationId, row.totalViews, row.postsCount]),
    ).toEqual([
      ["app-2", 300, 1],
      ["app-1", 100, 2],
    ]);
    expect(board!.positionByClipperProfileId.get("clipper-1")).toBe(2);
  });

  it("sem métricas até o corte devolve ranking vazio", async () => {
    const db = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      clipperApplication: { findMany: hydrationMock() },
    };
    const board = await computeMonthlyLeaderboard(
      db as never,
      "campaign-1",
      campaign("COMPLETED", RankingMetricType.VIEWS),
    );
    expect(board!.rows).toEqual([]);
    expect(board!.positionByClipperProfileId.size).toBe(0);
  });
});
