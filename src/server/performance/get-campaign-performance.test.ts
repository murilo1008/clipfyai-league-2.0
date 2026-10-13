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

describe("getCampaignPerformance — coletas de perfis e vídeos", () => {
  let sequence = 0;

  function setup() {
    const now = Date.now();
    const campaign = {
      id: `snapshots-campaign-${++sequence}`,
      name: "Competição",
      slug: "competicao",
      status: "ACTIVE",
      startDate: new Date(now - 3 * 86_400_000),
      endDate: new Date(now + 86_400_000),
      platforms: ["INSTAGRAM"],
      requiredMentions: [],
      performanceSettings: null,
    };
    const profile = {
      id: "profile-1",
      campaignId: campaign.id,
      platform: "INSTAGRAM",
      username: "marca",
      profileUrl: null,
      label: null,
      isActive: true,
      currentFollowers: 1_300,
      lastCollectedAt: new Date(now - 60_000),
      lastError: null,
      createdAt: new Date(now - 4 * 86_400_000),
      updatedAt: new Date(now),
    };
    const video = {
      id: "video-1",
      campaignId: campaign.id,
      platform: "TIKTOK",
      originalUrl: "https://tiktok.com/@marca/video/1",
      platformVideoId: "1",
      title: "Oficial",
      description: null,
      thumbnailUrl: null,
      isActive: true,
      currentViews: 9_000n,
      currentLikes: 90,
      currentComments: 9,
      currentShares: 1,
      lastCollectedAt: new Date(now - 60_000),
      lastError: null,
      notifyClippers: false,
      notificationSentAt: null,
      notificationRecipientCount: 0,
      notificationLastError: null,
      createdAt: new Date(now - 4 * 86_400_000),
      updatedAt: new Date(now),
    };
    const day1Morning = new Date("2026-10-10T11:00:00.000Z");
    const day1Evening = new Date("2026-10-10T19:00:00.000Z");
    const day2Evening = new Date("2026-10-11T19:00:00.000Z");

    const findUnique = vi.fn(async (args: { select: Record<string, any> }) => {
      const includesSnapshots = Boolean(
        args.select.performanceProfiles?.include?.snapshots,
      );
      return {
        ...campaign,
        performanceProfiles: [
          {
            ...profile,
            ...(includesSnapshots
              ? {
                  snapshots: [
                    { followers: 1_000, collectedAt: day1Morning },
                    { followers: 1_100, collectedAt: day1Evening },
                    { followers: 1_300, collectedAt: day2Evening },
                  ],
                }
              : {}),
          },
        ],
        performanceVideos: [
          {
            ...video,
            ...(includesSnapshots
              ? {
                  snapshots: [
                    {
                      views: 1_000n,
                      likes: 10,
                      comments: 1,
                      shares: 0,
                      collectedAt: day1Morning,
                    },
                    {
                      views: 9_000n,
                      likes: 90,
                      comments: 9,
                      shares: 1,
                      collectedAt: day2Evening,
                    },
                  ],
                }
              : {}),
          },
        ],
      };
    });
    const queryRaw = vi.fn(
      async (strings: TemplateStringsArray, ..._values: unknown[]) => {
        const sql = strings.join("?");
        if (sql.includes('"CampaignPerformanceProfileSnapshot"')) {
          // Primeira coleta + última de cada dia operacional.
          return [
            {
              profileId: "profile-1",
              followers: 1_000,
              collectedAt: day1Morning,
            },
            {
              profileId: "profile-1",
              followers: 1_100,
              collectedAt: day1Evening,
            },
            {
              profileId: "profile-1",
              followers: 1_300,
              collectedAt: day2Evening,
            },
          ];
        }
        if (sql.includes('"CampaignPerformanceVideoSnapshot"')) {
          return [
            {
              videoId: "video-1",
              views: 1_000n,
              likes: 10,
              comments: 1,
              shares: 0,
              collectedAt: day1Morning,
            },
            {
              videoId: "video-1",
              views: 9_000n,
              likes: 90,
              comments: 9,
              shares: 1,
              collectedAt: day2Evening,
            },
          ];
        }
        return [];
      },
    );
    const db = {
      campaign: { findUnique },
      clipPost: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { views: 0n } }),
      },
      $queryRaw: queryRaw,
    } as unknown as PrismaClient;
    return { campaign, db, findUnique, queryRaw };
  }

  it("por padrão lê todas as coletas, sem o metadata bruto", async () => {
    const { campaign, db, findUnique, queryRaw } = setup();

    const result = await getCampaignPerformance(db, campaign.id);

    const select = findUnique.mock.calls[0]![0].select;
    expect(select.performanceProfiles.include.snapshots).toEqual({
      select: { followers: true, collectedAt: true },
      orderBy: { collectedAt: "asc" },
    });
    expect(select.performanceVideos.include.snapshots).toEqual({
      select: {
        views: true,
        likes: true,
        comments: true,
        shares: true,
        collectedAt: true,
      },
      orderBy: { collectedAt: "asc" },
    });
    // Só a série de views da competição vai para o SQL.
    expect(queryRaw).toHaveBeenCalledOnce();
    expect(result?.profiles[0]?.history).toHaveLength(3);
    expect(result?.profiles[0]?.initialFollowers).toBe(1_000);
    expect(result?.videos[0]?.initialViews).toBe(1_000);
  });

  it("no modo diário resume as coletas no SQL e mantém base e crescimento", async () => {
    const { campaign, db, findUnique, queryRaw } = setup();

    const daily = await getCampaignPerformance(db, campaign.id, {
      snapshotResolution: "daily",
    });

    const select = findUnique.mock.calls[0]![0].select;
    expect(select.performanceProfiles).toEqual({ orderBy: { createdAt: "asc" } });
    expect(select.performanceVideos).toEqual({ orderBy: { createdAt: "desc" } });

    const snapshotQueries = queryRaw.mock.calls
      .map(([strings, ...values]) => ({ sql: strings.join("?"), values }))
      .filter(({ sql }) => sql.includes("Snapshot"));
    expect(snapshotQueries).toHaveLength(2);
    for (const { sql, values } of snapshotQueries) {
      // Última coleta de cada dia operacional + a primeira coleta.
      expect(sql).toContain("DISTINCT ON");
      expect(sql).toContain("INTERVAL '4 hours'");
      expect(sql).toContain('"collectedAt" DESC');
      expect(sql).toContain("UNION");
      expect(sql).toContain('."campaignId" = ?');
      expect(values).toEqual([campaign.id, campaign.id]);
    }

    const profile = daily?.profiles[0];
    expect(profile?.initialFollowers).toBe(1_000);
    expect(profile?.currentFollowers).toBe(1_300);
    expect(profile?.growth).toBe(300);
    expect(profile?.history.map((point) => point.followers)).toEqual([
      1_000, 1_100, 1_300,
    ]);
    const video = daily?.videos[0];
    expect(video?.initialViews).toBe(1_000);
    expect(video?.viewsGrowth).toBe(8_000);
    expect(video?.history.map((point) => point.views)).toEqual([1_000, 9_000]);
  });
});
