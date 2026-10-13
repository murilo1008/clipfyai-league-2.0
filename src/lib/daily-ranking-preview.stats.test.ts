import { afterEach, describe, expect, it, vi } from "vitest";

import {
  computeDailyRankWalletPaidGate,
  getTotalViewsAtRankingCutoff,
  loadDailyRankingDateContext,
} from "./daily-ranking-preview";

function contextDb() {
  const queryRaw = vi.fn().mockImplementation(async (parts: string[]) => {
    const sql = parts.join("?");
    if (sql.includes('FROM "DailyRankingEntry" dre')) return [];
    if (sql.includes("SUM(cp.\"views\")")) return [{ sum: 1000n }];
    return [{ sum: 50n }];
  });
  return {
    $queryRaw: queryRaw,
    campaign: {
      findUnique: vi.fn().mockResolvedValue({
        id: "campaign-1",
        name: "Competição",
        rankingMetricType: "VIEWS",
        activeRankingRule: { dailyTopCount: 15, dailyPrizeTable: { "1": 10 } },
      }),
    },
    dailyRanking: {
      findFirst: vi.fn().mockResolvedValue({ id: "daily-1", totalDailyViews: 0n }),
    },
    dailyRankingEntry: {
      count: vi.fn().mockResolvedValue(7),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

describe("contexto do ranking diário", () => {
  it("por padrão calcula as estatísticas de views", async () => {
    const db = contextDb();
    const core = await loadDailyRankingDateContext(
      db as never,
      "campaign-1",
      "2026-10-09",
    );
    expect(core?.stats).toEqual({
      totalPosts: 7,
      totalCompetitionViews: 1000n,
      viewsIncreaseToday: 50n,
    });
    expect(db.$queryRaw).toHaveBeenCalledTimes(3);
  });

  it("includeStats: false pula as varreduras de ClipPostMetrics", async () => {
    const db = contextDb();
    const core = await loadDailyRankingDateContext(
      db as never,
      "campaign-1",
      "2026-10-09",
      { includeStats: false },
    );
    expect(core?.stats).toEqual({ totalPosts: 7 });
    expect(core?.dailyRankingId).toBe("daily-1");
    // Só a query das linhas do top.
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("os gates de pagamento não calculam as estatísticas", async () => {
    const db = contextDb();
    const gate = await computeDailyRankWalletPaidGate(
      db as never,
      "campaign-1",
      "2026-10-09",
    );
    expect(gate?.canUndoRankPayments).toBe(false);
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
  });
});

describe("views totais no corte do ranking mensal", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function cutoffDb(row: Record<string, bigint>, growth = 30n) {
    return {
      $queryRaw: vi.fn().mockImplementation(async (parts: string[]) =>
        parts.join("?").includes('"viewsDelta"')
          ? [{ sumGrowth: growth }]
          : [row],
      ),
    };
  }

  it("com snapshot de todos os posts não lê o crescimento posterior", async () => {
    const db = cutoffDb({
      totalAtCutoffFromSnapshots: 900n,
      totalCurrentViews: 1000n,
      postsWithSnapshot: 2n,
      totalPosts: 2n,
    });
    expect(
      await getTotalViewsAtRankingCutoff(
        db as never,
        "campaign-1",
        new Date("2026-10-01T00:00:00Z"),
      ),
    ).toBe(900n);
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    const sql = (db.$queryRaw.mock.calls[0]?.[0] as string[]).join("?");
    expect(sql).toContain("LEFT JOIN LATERAL");
    expect(db.$queryRaw.mock.calls[0]?.[1]).toEqual(
      new Date("2026-10-01T00:30:00Z"),
    );
  });

  it("sem snapshot em algum post estima pelas views atuais menos o crescimento", async () => {
    const db = cutoffDb({
      totalAtCutoffFromSnapshots: 900n,
      totalCurrentViews: 1000n,
      postsWithSnapshot: 1n,
      totalPosts: 2n,
    });
    expect(
      await getTotalViewsAtRankingCutoff(
        db as never,
        "campaign-1",
        new Date("2026-10-01T00:00:00Z"),
      ),
    ).toBe(970n);
    expect(db.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it("com o corte no futuro não há crescimento posterior a ler", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
    const db = cutoffDb({
      totalAtCutoffFromSnapshots: 0n,
      totalCurrentViews: 1000n,
      postsWithSnapshot: 0n,
      totalPosts: 2n,
    });
    expect(
      await getTotalViewsAtRankingCutoff(
        db as never,
        "campaign-1",
        new Date("2026-10-31T00:00:00Z"),
      ),
    ).toBe(1000n);
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
