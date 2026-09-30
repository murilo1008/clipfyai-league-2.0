import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  buildCumulativeCpmHistory,
  calculatePerformanceSummary,
  getCampaignPerformance,
  performanceDayKey,
} from "./get-campaign-performance";

describe("calculatePerformanceSummary", () => {
  it("calcula CPM, custo equivalente e economia", () => {
    expect(
      calculatePerformanceSummary({
        totalViews: 10_000_000,
        investedAmount: 50_000,
        referenceCpm: 15,
      }),
    ).toEqual({
      totalViews: 10_000_000,
      investedAmount: 50_000,
      referenceCpm: 15,
      effectiveCpm: 5,
      equivalentAdsCost: 150_000,
      estimatedSavings: 100_000,
      savingsPercentage: (100_000 / 150_000) * 100,
    });
  });

  it("não divide por zero quando ainda não existem visualizações", () => {
    const result = calculatePerformanceSummary({
      totalViews: 0,
      investedAmount: 5_000,
      referenceCpm: 15,
    });

    expect(result.effectiveCpm).toBe(0);
    expect(result.equivalentAdsCost).toBe(0);
    expect(result.savingsPercentage).toBe(0);
  });
});

describe("buildCumulativeCpmHistory", () => {
  it("carrega as views anteriores de cada post e mantém o CPM decrescente", () => {
    const history = buildCumulativeCpmHistory({
      investedAmount: 70_000,
      referenceCpm: 13,
      currentTotalViews: 10_000_000,
      currentDate: new Date("2026-09-13T12:00:00.000Z"),
      rows: [
        {
          date: new Date("2026-09-10T13:00:00.000Z"),
          clipPostId: "post-a",
          views: 500_000n,
        },
        {
          date: new Date("2026-09-11T13:00:00.000Z"),
          clipPostId: "post-b",
          views: 500_000n,
        },
        {
          date: new Date("2026-09-12T13:00:00.000Z"),
          clipPostId: "post-a",
          views: 1_500_000n,
        },
      ],
    });

    expect(history.map((point) => point.totalViews)).toEqual([
      500_000, 1_000_000, 2_000_000, 10_000_000,
    ]);
    expect(history.map((point) => point.effectiveCpm)).toEqual([
      140, 70, 35, 7,
    ]);
  });

  it("não deixa uma correção negativa de views criar um pico de CPM", () => {
    const history = buildCumulativeCpmHistory({
      investedAmount: 10_000,
      referenceCpm: 13,
      currentTotalViews: 900_000,
      currentDate: new Date("2026-09-12T12:00:00.000Z"),
      rows: [
        {
          date: new Date("2026-09-10T13:00:00.000Z"),
          clipPostId: "post-a",
          views: 1_000_000n,
        },
        {
          date: new Date("2026-09-11T13:00:00.000Z"),
          clipPostId: "post-a",
          views: 900_000n,
        },
      ],
    });

    expect(history.map((point) => point.totalViews)).toEqual([
      1_000_000, 1_000_000, 1_000_000,
    ]);
    expect(history.every((point) => point.effectiveCpm === 10)).toBe(true);
  });

  it("começa no dia da primeira coleta real", () => {
    const history = buildCumulativeCpmHistory({
      investedAmount: 10_000,
      referenceCpm: 13,
      currentTotalViews: 1_000_000,
      currentDate: new Date("2026-09-11T12:00:00.000Z"),
      rows: [
        {
          date: new Date("2026-09-10T13:00:00.000Z"),
          clipPostId: "post-a",
          views: 500_000n,
        },
      ],
    });

    expect(history.map((point) => point.date.slice(0, 10))).toEqual([
      "2026-09-10",
      "2026-09-11",
    ]);
    expect(history.map((point) => point.effectiveCpm)).toEqual([20, 10]);
  });

  it("agrupa coletas pela janela operacional que encerra às 20h", () => {
    const history = buildCumulativeCpmHistory({
      investedAmount: 10_000,
      referenceCpm: 13,
      currentTotalViews: 1_000_000,
      currentDate: new Date("2026-09-22T02:00:00.000Z"),
      rows: [
        {
          // Está na janela de 22/09: [21/09 20h, 22/09 20h).
          date: new Date("2026-09-22T01:00:00.000Z"),
          clipPostId: "post-a",
          views: 1_000_000n,
        },
      ],
    });

    expect(history.map((point) => point.date.slice(0, 10))).toEqual([
      "2026-09-22",
    ]);
    expect(history[0]?.totalViews).toBe(1_000_000);
  });
});

describe("performanceDayKey", () => {
  it("mantém 19:59 no dia e move 20:00 para o dia seguinte", () => {
    expect(performanceDayKey(new Date("2026-09-20T19:59:59.999Z"))).toBe(
      "2026-09-20",
    );
    expect(performanceDayKey(new Date("2026-09-20T20:00:00.000Z"))).toBe(
      "2026-09-21",
    );
  });
});

describe("getCampaignPerformance", () => {
  it("começa na primeira coleta após o início e segue após o fim da competição", async () => {
    const now = Date.now();
    const firstAfterStart = new Date(now - 2.5 * 60_000);
    const afterEnd = new Date(now - 60_000);
    const campaign = {
      id: "campaign-1",
      name: "Competição encerrada",
      slug: "competicao-encerrada",
      status: "COMPLETED",
      startDate: new Date(now - 3 * 60_000),
      endDate: new Date(now - 2 * 60_000),
      platforms: [],
      requiredMentions: [],
      performanceSettings: null,
      performanceProfiles: [],
      performanceVideos: [],
    };
    const queryRaw = vi.fn(
      async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = strings.join("?");
        expect(sql).toContain('MIN(first_metrics."collectedAt")');
        expect(sql).not.toContain('MIN(post."postedAt")');
        expect(sql.match(/metrics\."collectedAt" >=/g)).toHaveLength(2);
        expect(sql).toContain(
          `metrics."collectedAt" < performance_days.day + INTERVAL '20 hours'`,
        );
        expect(sql).not.toContain("INTERVAL '1 day 5 hours'");
        expect(
          values.filter((value) => value === campaign.startDate),
        ).toHaveLength(2);
        expect(values).not.toContain(campaign.endDate);
        expect(
          values.some(
            (value) => value instanceof Date && value > campaign.endDate,
          ),
        ).toBe(true);
        return [
          { date: firstAfterStart, clipPostId: "post-1", views: 1_234n },
          { date: afterEnd, clipPostId: "post-2", views: 567n },
        ];
      },
    );
    const aggregate = vi.fn().mockResolvedValue({
      _sum: { views: 2_000n },
    });
    const db = {
      campaign: { findUnique: vi.fn().mockResolvedValue(campaign) },
      clipPost: { aggregate },
      $queryRaw: queryRaw,
    } as unknown as PrismaClient;

    const result = await getCampaignPerformance(db, campaign.id);

    expect(queryRaw).toHaveBeenCalledOnce();
    expect(aggregate).toHaveBeenCalledWith({
      where: {
        campaignId: campaign.id,
        status: "ELIGIBLE",
        postedAt: { not: null },
      },
      _sum: { views: true },
    });
    expect(result?.cpmHistory[0]?.date.slice(0, 10)).toBe(
      performanceDayKey(firstAfterStart),
    );
    expect(result?.summary.totalViews).toBe(2_000);
    expect(result?.cpmHistory.at(-1)?.totalViews).toBe(2_000);
  });
});
