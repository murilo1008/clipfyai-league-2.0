import type { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  it("usa o total acumulado de cada dia e mantém o CPM decrescente", () => {
    const history = buildCumulativeCpmHistory({
      investedAmount: 70_000,
      referenceCpm: 13,
      currentTotalViews: 10_000_000,
      currentDate: new Date("2026-09-13T12:00:00.000Z"),
      rows: [
        { date: new Date("2026-09-10T13:00:00.000Z"), views: 500_000n },
        { date: new Date("2026-09-11T13:00:00.000Z"), views: 1_000_000n },
        { date: new Date("2026-09-12T13:00:00.000Z"), views: 2_000_000n },
      ],
    });

    expect(history.map((point) => point.totalViews)).toEqual([
      500_000, 1_000_000, 2_000_000, 10_000_000,
    ]);
    expect(history.map((point) => point.effectiveCpm)).toEqual([
      140, 70, 35, 7,
    ]);
  });

  it("repete o total anterior nos dias sem coleta", () => {
    const history = buildCumulativeCpmHistory({
      investedAmount: 10_000,
      referenceCpm: 13,
      currentTotalViews: 0,
      currentDate: new Date("2026-09-13T12:00:00.000Z"),
      rows: [
        { date: new Date("2026-09-10T13:00:00.000Z"), views: 500_000n },
        { date: new Date("2026-09-12T13:00:00.000Z"), views: 800_000n },
      ],
    });

    expect(history.map((point) => point.totalViews)).toEqual([
      500_000, 500_000, 800_000, 800_000,
    ]);
  });

  it("não deixa uma correção negativa de views criar um pico de CPM", () => {
    const history = buildCumulativeCpmHistory({
      investedAmount: 10_000,
      referenceCpm: 13,
      currentTotalViews: 900_000,
      currentDate: new Date("2026-09-12T12:00:00.000Z"),
      rows: [
        { date: new Date("2026-09-10T13:00:00.000Z"), views: 1_000_000n },
        { date: new Date("2026-09-11T13:00:00.000Z"), views: 900_000n },
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
      rows: [{ date: new Date("2026-09-10T13:00:00.000Z"), views: 500_000n }],
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
        // Está na janela de 22/09: [21/09 20h, 22/09 20h).
        { date: new Date("2026-09-22T01:00:00.000Z"), views: 1_000_000n },
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
  // A série fica em cache por competição: cada teste usa um id próprio.
  let sequence = 0;

  function setup(
    rows: Array<{ date: Date; views: bigint }> = [],
    overrides: { startDate?: Date; endDate?: Date } = {},
  ) {
    const now = Date.now();
    const campaign = {
      id: `campaign-${++sequence}`,
      name: "Competição",
      slug: "competicao",
      status: "COMPLETED",
      startDate: overrides.startDate ?? new Date(now - 3 * 60_000),
      endDate: overrides.endDate ?? new Date(now - 2 * 60_000),
      platforms: [],
      requiredMentions: [],
      performanceSettings: null,
      performanceProfiles: [],
      performanceVideos: [],
    };
    const queryRaw = vi.fn(
      async (_strings: TemplateStringsArray, ..._values: unknown[]) => rows,
    );
    const aggregate = vi.fn().mockResolvedValue({ _sum: { views: 2_000n } });
    const findUnique = vi.fn().mockResolvedValue(campaign);
    const db = {
      campaign: { findUnique },
      clipPost: { aggregate },
      $queryRaw: queryRaw,
    } as unknown as PrismaClient;
    return { campaign, db, queryRaw, aggregate, findUnique };
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it("começa na primeira coleta após o início e segue após o fim da competição", async () => {
    const now = Date.now();
    const firstAfterStart = new Date(now - 2.5 * 60_000);
    const afterEnd = new Date(now - 60_000);
    const { campaign, db, queryRaw, aggregate } = setup([
      { date: firstAfterStart, views: 1_234n },
      { date: afterEnd, views: 1_801n },
    ]);

    const result = await getCampaignPerformance(db, campaign.id);

    expect(queryRaw).toHaveBeenCalledOnce();
    const [strings, ...values] = queryRaw.mock.calls[0]!;
    const sql = strings.join("?");
    // Leitura post a post pelo índice (clipPostId, collectedAt).
    expect(sql).toContain('metrics."clipPostId" = posts.id');
    expect(sql).toContain("OFFSET 0");
    // Dia operacional encerrado às 20h UTC, contando a partir da postagem.
    expect(sql).toContain("INTERVAL '4 hours'");
    expect(sql).toContain("posts.posted_day");
    expect(values.filter((value) => value === campaign.startDate)).toHaveLength(
      1,
    );
    expect(values).not.toContain(campaign.endDate);
    expect(
      values.some((value) => value instanceof Date && value > campaign.endDate),
    ).toBe(true);
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

  it("reaproveita a série entre consultas, inclusive simultâneas", async () => {
    const { campaign, db, queryRaw, aggregate, findUnique } = setup();

    await Promise.all([
      getCampaignPerformance(db, campaign.id),
      getCampaignPerformance(db, campaign.id),
    ]);
    await getCampaignPerformance(db, campaign.id);

    expect(queryRaw).toHaveBeenCalledOnce();
    // Configurações, perfis, vídeos e total atual continuam ao vivo.
    expect(findUnique).toHaveBeenCalledTimes(3);
    expect(aggregate).toHaveBeenCalledTimes(3);
  });

  it("lê a série de novo depois de 10 minutos", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T15:00:00.000Z"));
    const { campaign, db, queryRaw } = setup();

    await getCampaignPerformance(db, campaign.id);
    vi.setSystemTime(new Date("2026-10-12T15:09:59.000Z"));
    await getCampaignPerformance(db, campaign.id);
    expect(queryRaw).toHaveBeenCalledOnce();

    vi.setSystemTime(new Date("2026-10-12T15:10:01.000Z"));
    await getCampaignPerformance(db, campaign.id);
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it("lê a série de novo quando a data de início muda", async () => {
    const { campaign, db, queryRaw, findUnique } = setup();

    await getCampaignPerformance(db, campaign.id);
    findUnique.mockResolvedValueOnce({
      ...campaign,
      startDate: new Date(campaign.startDate.getTime() - 86_400_000),
    });
    await getCampaignPerformance(db, campaign.id);

    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it("não guarda falhas no cache", async () => {
    const { campaign, db, queryRaw } = setup();
    queryRaw.mockRejectedValueOnce(new Error("timeout"));

    await expect(getCampaignPerformance(db, campaign.id)).rejects.toThrow(
      "timeout",
    );
    await expect(getCampaignPerformance(db, campaign.id)).resolves.toBeTruthy();
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });
});
