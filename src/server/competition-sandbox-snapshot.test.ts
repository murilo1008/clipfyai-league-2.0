import { describe, expect, it } from "vitest";

import {
  buildLinearGrowth,
  computeEngagementRate,
  describeSandboxIssue,
  keepPrizesOnPositions,
  nextYmd,
  sandboxDataSchema,
  scaleGrowthToTotal,
  uniqueTags,
  type SandboxGrowthPoint,
} from "@/lib/competition-sandbox";

import {
  buildSandboxSnapshot,
  type SandboxSourceCharts,
  type SandboxSourceDetails,
} from "./competition-sandbox-snapshot";

function details(
  overrides: Partial<SandboxSourceDetails> = {},
): SandboxSourceDetails {
  return {
    campaign: {
      name: "Belli - Outubro",
      description: "Cortes da Belli",
      coverImageUrl: null,
      status: "ACTIVE",
      // 03:00Z = meia-noite em São Paulo: o dia não pode voltar um
      startDate: "2026-10-01T03:00:00.000Z",
      endDate: "2026-10-31T02:59:59.000Z",
      platforms: ["TIKTOK", "INSTAGRAM"],
      requiredHashtags: ["#belli", " "],
      requiredMentions: ["@belli"],
      totalPrize: "R$ 10.000",
      isPrivate: false,
      isProOnly: true,
      rankingMetricType: "VIEWS_X_ENGAGEMENT",
    },
    stats: {
      totalViews: 1_000_000,
      totalLikes: 50_000,
      totalComments: 2_000,
      totalShares: 1_000,
      totalSaves: 500,
      totalClippers: 40,
      totalPosts: 320,
      engagementRate: 5.35,
    },
    topMonthlyRanking: [
      {
        position: 1,
        clipperName: "Ana",
        clipperUsername: "ana.cortes",
        clipperImageUrl: null,
        clanTag: null,
        totalViews: 400_000,
        totalLikes: 20_000,
        totalComments: 800,
        totalShares: 300,
        totalSaves: 100,
        postsCount: 30,
        engagementRate: 5.3,
      },
      {
        position: 2,
        clipperName: "Bruno",
        clipperUsername: "bruno",
        clipperImageUrl: "https://img.clerk.com/bruno.png",
        clanTag: "ALFA",
        totalViews: 300_000,
        totalLikes: 15_000,
        totalComments: 500,
        totalShares: 200,
        totalSaves: 50,
        postsCount: 25,
        engagementRate: 5.25,
      },
    ],
    topAccountsRanking: [
      {
        username: "ana.cortes",
        platform: "TIKTOK",
        totalViews: 400_000,
        totalLikes: 20_000,
        totalComments: 800,
        totalShares: 300,
        totalSaves: 200,
        postsCount: 30,
        engagementRate: 5.3,
      },
    ],
    topPostsForReport: [
      {
        id: "post-1",
        url: "https://tiktok.com/@ana/video/1",
        platform: "TIKTOK",
        username: "ana.cortes",
        clipperName: "Ana",
        views: 120_000,
        likes: 6_000,
        comments: 100,
        shares: 40,
        postedAt: "2026-10-05T01:30:00.000Z",
      },
    ],
    rankingRule: {
      dailyEnabled: true,
      dailyTopCount: 15,
      dailyTotalPrize: 1000,
      monthlyEnabled: true,
      monthlyTopCount: 10,
      monthlyTotalPrize: 20_000,
      monthlyPrizeTable: { "1": 5000, "2-3": 2500 },
      bonusEnabled: false,
      bonusMilestone: 1_000_000,
      bonusAmount: 100,
    },
    ...overrides,
  };
}

const charts: SandboxSourceCharts = {
  platformDistribution: [
    {
      platform: "TIKTOK",
      posts: 200,
      views: 700_000,
      likes: 35_000,
      comments: 1_500,
      shares: 800,
      saves: 300,
    },
    {
      platform: "INSTAGRAM",
      posts: 120,
      views: 300_000,
      likes: 15_000,
      comments: 500,
      shares: 200,
      saves: 200,
    },
  ],
  platformGrowthData: [
    { date: "2026-10-01", total: 100_000, INSTAGRAM: 30_000, TIKTOK: 70_000 },
    {
      date: "2026-10-02",
      total: 1_000_000,
      INSTAGRAM: 300_000,
      TIKTOK: 700_000,
    },
  ],
  growthPlatforms: ["INSTAGRAM", "TIKTOK"],
};

describe("buildSandboxSnapshot", () => {
  it("copia a competição num snapshot que passa no schema", () => {
    const snapshot = buildSandboxSnapshot({ details: details(), charts });

    expect(sandboxDataSchema.safeParse(snapshot).success).toBe(true);
    expect(snapshot.campaign).toMatchObject({
      name: "Belli - Outubro",
      coverImageUrl: "",
      startDate: "2026-10-01",
      endDate: "2026-10-30",
      requiredHashtags: ["#belli"],
      totalPrize: "R$ 10.000",
      rankingMetricType: "VIEWS_X_ENGAGEMENT",
    });
    expect(snapshot.stats.totalViews).toBe(1_000_000);
    expect(snapshot.growthPlatforms).toEqual(["INSTAGRAM", "TIKTOK"]);
    expect(snapshot.growth.at(-1)).toMatchObject({
      date: "2026-10-02",
      total: 1_000_000,
      TIKTOK: 700_000,
    });
    expect(snapshot.platformDistribution.map((row) => row.platform)).toEqual([
      "TIKTOK",
      "INSTAGRAM",
    ]);
    // Data do post no fuso de São Paulo (01:30Z ainda é dia 4 em BRT)
    expect(snapshot.topPosts[0]).toMatchObject({
      postedAt: "2026-10-04",
      thumbnailUrl: "",
    });
  });

  it("calcula o prêmio de cada posição pela tabela mensal", () => {
    const snapshot = buildSandboxSnapshot({ details: details(), charts });

    expect(snapshot.monthlyRanking.map((row) => row.prize)).toEqual([
      5000, 2500,
    ]);
    expect(snapshot.monthlyRanking[1]).toMatchObject({
      clipperImageUrl: "https://img.clerk.com/bruno.png",
      clanTag: "ALFA",
      totalSaves: 50,
    });
  });

  it("importa mesmo sem gráficos, regra de ranking ou prêmio", () => {
    const snapshot = buildSandboxSnapshot({
      details: details({
        rankingRule: null,
        campaign: { ...details().campaign, totalPrize: "R$ 0" },
      }),
      charts: null,
    });

    expect(sandboxDataSchema.safeParse(snapshot).success).toBe(true);
    expect(snapshot.campaign.totalPrize).toBe("");
    expect(snapshot.growth).toEqual([]);
    expect(snapshot.platformDistribution).toEqual([]);
    expect(snapshot.prizes.monthlyEnabled).toBe(false);
  });

  it("ignora tabela de prêmios inválida em vez de falhar a importação", () => {
    const base = details();
    const snapshot = buildSandboxSnapshot({
      details: {
        ...base,
        rankingRule: { ...base.rankingRule!, monthlyPrizeTable: "{quebrado" },
      },
      charts,
    });

    expect(snapshot.monthlyRanking.map((row) => row.prize)).toEqual([0, 0]);
  });
});

describe("helpers de edição", () => {
  it("recalcula o engajamento com a fórmula do sistema", () => {
    expect(
      computeEngagementRate({
        totalViews: 1_000_000,
        totalLikes: 50_000,
        totalComments: 2_000,
        totalShares: 1_000,
        totalSaves: 500,
      }),
    ).toBe(5.35);
    expect(
      computeEngagementRate({
        totalViews: 0,
        totalLikes: 10,
        totalComments: 0,
        totalShares: 0,
      }),
    ).toBe(0);
  });

  it("reescala a curva para terminar no total informado", () => {
    const points: SandboxGrowthPoint[] = [
      { id: "a", date: "2026-10-01", total: 100, TIKTOK: 60 },
      { id: "b", date: "2026-10-02", total: 400, TIKTOK: 300 },
    ];

    expect(scaleGrowthToTotal(points, 800)).toEqual([
      { id: "a", date: "2026-10-01", total: 200, TIKTOK: 120 },
      { id: "b", date: "2026-10-02", total: 800, TIKTOK: 600 },
    ]);
    // Curva zerada não tem formato para reescalar
    const flat = [{ id: "z", date: "2026-10-01", total: 0 }];
    expect(scaleGrowthToTotal(flat, 500)).toBe(flat);
  });

  it("gera curva linear dia a dia dividida pelas redes", () => {
    const points = buildLinearGrowth({
      startDate: "2026-10-30",
      endDate: "2026-11-02",
      total: 1000,
      shares: { TIKTOK: 3, INSTAGRAM: 1 },
    });

    expect(points.map((point) => point.date)).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
    expect(points.at(-1)).toMatchObject({
      total: 1000,
      TIKTOK: 750,
      INSTAGRAM: 250,
    });
    expect(
      buildLinearGrowth({
        startDate: "2026-11-02",
        endDate: "2026-10-30",
        total: 1000,
        shares: {},
      }),
    ).toEqual([]);
  });

  it("avança um dia na data, inclusive na virada do mês", () => {
    expect(nextYmd("2026-10-31")).toBe("2026-11-01");
  });

  it("rejeita a mesma plataforma duas vezes na distribuição", () => {
    const snapshot = buildSandboxSnapshot({ details: details(), charts });
    const duplicated = {
      ...snapshot,
      platformDistribution: [
        snapshot.platformDistribution[0]!,
        { ...snapshot.platformDistribution[0]!, id: "outra" },
      ],
    };

    expect(sandboxDataSchema.safeParse(duplicated).success).toBe(false);
  });

  it("mantém o prêmio na posição ao reordenar ou remover clipadores", () => {
    const rows = [
      { id: "a", prize: 300 },
      { id: "b", prize: 160 },
      { id: "c", prize: 100 },
    ];

    // Ordenar: o novo 1º leva os R$ 300
    expect(keepPrizesOnPositions(rows, [rows[2]!, rows[0]!, rows[1]!])).toEqual(
      [
        { id: "c", prize: 300 },
        { id: "a", prize: 160 },
        { id: "b", prize: 100 },
      ],
    );
    // Remover o 1º: quem sobe herda o prêmio da nova posição
    expect(keepPrizesOnPositions(rows, [rows[1]!, rows[2]!])).toEqual([
      { id: "b", prize: 300 },
      { id: "c", prize: 160 },
    ]);
    // Adicionar no fim: a nova posição começa sem prêmio
    expect(
      keepPrizesOnPositions(rows, [...rows, { id: "d", prize: 0 }]).at(-1),
    ).toEqual({ id: "d", prize: 0 });
    // Editar o prêmio (mesma ordem) passa direto
    const edited = [rows[0]!, { id: "b", prize: 999 }, rows[2]!];
    expect(keepPrizesOnPositions(rows, edited)).toBe(edited);
  });

  it("remove hashtags e menções repetidas", () => {
    expect(uniqueTags(["belli", "#belli", "#Belli", "outra"], "#")).toEqual([
      "belli",
      "outra",
    ]);
    expect(uniqueTags(["@marca", "marca", "@"], "@")).toEqual(["@marca"]);
  });

  it("aponta o erro na numeração da tela", () => {
    const snapshot = buildSandboxSnapshot({ details: details(), charts });
    const result = sandboxDataSchema.safeParse({
      ...snapshot,
      monthlyRanking: snapshot.monthlyRanking.map((row, index) =>
        index === 1 ? { ...row, prize: -5 } : row,
      ),
    });

    expect(result.success).toBe(false);
    expect(describeSandboxIssue(result.error!)).toMatch(
      /^Ranking mensal › linha 2 › prize: /,
    );
  });

  it("não importa nome só com espaços", () => {
    const snapshot = buildSandboxSnapshot({
      details: details({ campaign: { ...details().campaign, name: "   " } }),
      charts,
    });

    expect(snapshot.campaign.name).toBe("Competição");
    expect(sandboxDataSchema.safeParse(snapshot).success).toBe(true);
  });
});
