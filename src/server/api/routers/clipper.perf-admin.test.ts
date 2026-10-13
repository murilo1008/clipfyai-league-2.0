import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({
  auth,
  currentUser: vi.fn(),
}));
vi.mock("@/server/db", () => ({ db: {} }));
vi.mock("@/env", () => ({ env: {} }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: vi.fn() };
  },
}));

import { calculateEngagementRate } from "@/lib/ranking-helpers";
import { invalidateCachedQueries } from "@/server/memory-cache";
import { clipperRouter } from "./clipper";

/** Junta o template do $queryRaw (com fragmentos aninhados) em SQL + valores. */
function rawQuery(args: unknown[]) {
  const [strings, ...values] = args as [TemplateStringsArray, ...unknown[]];
  return Prisma.sql(strings, ...(values as Prisma.Sql[]));
}

const compact = (sql: string) => sql.replace(/\s+/g, " ").trim();

function caller(db: Record<string, unknown>) {
  return clipperRouter.createCaller({ db, headers: new Headers() } as never);
}

beforeEach(() => {
  invalidateCachedQueries("");
  auth.mockResolvedValue({ userId: "admin-1" });
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

// ============================================================================
// /clippers - lista paginada no servidor
// ============================================================================

describe("clipper.getAll (lista do admin)", () => {
  function listDb(pageIds: string[], total: number) {
    const queryRaw = vi.fn((...args: unknown[]) => {
      const query = rawQuery(args);
      if (query.sql.includes('COUNT(*)::int AS "total"')) {
        return Promise.resolve([{ total }]);
      }
      return Promise.resolve(pageIds.map((id) => ({ id })));
    });
    const profile = (id: string) => ({
      id,
      fullName: `Nome ${id}`,
      artisticName: null,
      city: "",
      state: "",
      verificationStatus: "VERIFIED",
      avgEngagementRate: null,
      autoScore: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      user: {
        email: `${id}@x.com`,
        imageUrl: null,
        subscriptionStatus: "NONE",
      },
      socialAccounts: [{ platform: "TIKTOK" }],
      wallet: null,
    });
    const db = {
      $queryRaw: queryRaw,
      user: { findUnique: vi.fn().mockResolvedValue({ role: "ADMIN" }) },
      clipperProfile: {
        // Ordem do findMany ≠ ordem da página: o servidor precisa reordenar.
        findMany: vi.fn(({ where }: { where: { id: { in: string[] } } }) =>
          Promise.resolve([...where.id.in].reverse().map(profile)),
        ),
      },
    };
    return { db, queryRaw };
  }

  it("devolve só a página pedida, na ordem do banco, com o total", async () => {
    const { db, queryRaw } = listDb(["c3", "c1", "c2"], 23);

    const result = await caller(db).getAll({ status: "ALL", page: 3 });

    expect(result.total).toBe(23);
    expect(result.items.map((item) => item.id)).toEqual(["c3", "c1", "c2"]);
    // Sem cpf/pixKey/telefone na lista
    expect(Object.keys(result.items[0]!)).not.toContain("cpf");

    const pageQuery = rawQuery(queryRaw.mock.calls[0]!);
    expect(compact(pageQuery.sql)).toContain(
      'ORDER BY cp."createdAt" DESC, cp."id" DESC LIMIT ? OFFSET ?',
    );
    expect(pageQuery.sql).not.toContain("WHERE");
    expect(pageQuery.values).toEqual([10, 20]);

    expect(db.clipperProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["c3", "c1", "c2"] } },
        select: expect.not.objectContaining({ cpf: true, pixKey: true }),
      }),
    );
  });

  it("aplica status, assinatura e busca (nome, e-mail ou @username) no banco", async () => {
    const { db, queryRaw } = listDb([], 0);

    const result = await caller(db).getAll({
      status: "PENDING",
      subscription: "NONE",
      search: "  João  ",
      page: 1,
    });

    expect(result).toEqual({ items: [], total: 0 });
    // Página vazia: não busca perfis
    expect(db.clipperProfile.findMany).not.toHaveBeenCalled();

    for (const call of queryRaw.mock.calls) {
      const query = rawQuery(call);
      const sql = compact(query.sql);
      expect(sql).toContain(
        'cp."verificationStatus" = ?::"ClipperVerificationStatus"',
      );
      expect(sql).toContain('u."subscriptionStatus" = ?::"SubscriptionStatus"');
      expect(sql).toContain('cp."fullName" ILIKE ?');
      expect(sql).toContain('cp."artisticName" ILIKE ?');
      expect(sql).toContain('u."email" ILIKE ?');
      expect(sql).toContain('sa."username" ILIKE ?');
      expect(query.values.slice(0, 6)).toEqual([
        "PENDING",
        "NONE",
        "%João%",
        "%João%",
        "%João%",
        "%joão%",
      ]);
    }
  });

  it.each([
    ["fullName", "asc", 'lower(cp."fullName") COLLATE "C" ASC'],
    ["totalEarned", "desc", 'COALESCE(w."totalEarned", 0) DESC'],
    ["avgEngagementRate", "asc", 'cp."avgEngagementRate" ASC NULLS FIRST'],
    ["autoScore", "desc", 'cp."autoScore" DESC NULLS LAST'],
  ] as const)(
    "ordena por %s %s com desempate pelo cadastro mais recente",
    async (sortBy, sortDir, expected) => {
      const { db, queryRaw } = listDb(["c1"], 1);

      await caller(db).getAll({ sortBy, sortDir });

      const pageQuery = rawQuery(queryRaw.mock.calls[0]!);
      expect(compact(pageQuery.sql)).toContain(
        `ORDER BY ${expected}, cp."createdAt" DESC, cp."id" DESC`,
      );
    },
  );

  it("exige ADMIN", async () => {
    const { db } = listDb([], 0);
    db.user.findUnique.mockResolvedValue({ role: "CLIPPER" });
    await expect(caller(db).getAll({})).rejects.toThrow(/Admin/);
  });
});

describe("clipper.exportVerified (Copiar Aprovados)", () => {
  function exportDb() {
    const rows = [
      {
        fullName: "Ana",
        artisticName: null,
        email: "ana@x.com",
        cpf: "123",
        pixKey: "pix",
      },
    ];
    return {
      $queryRaw: vi.fn().mockResolvedValue(rows),
      user: { findUnique: vi.fn().mockResolvedValue({ role: "ADMIN" }) },
    };
  }

  it("busca só os VERIFIED que passam pelos filtros da lista", async () => {
    const db = exportDb();

    const result = await caller(db).exportVerified({
      status: "ALL",
      subscription: "ACTIVE",
      search: "ana",
    });

    expect(result).toEqual([expect.objectContaining({ cpf: "123" })]);
    const query = rawQuery(db.$queryRaw.mock.calls[0]!);
    expect(compact(query.sql)).toContain(
      'SELECT cp."fullName", cp."artisticName", u."email", cp."cpf", cp."pixKey"',
    );
    expect(query.values.slice(0, 2)).toEqual(["VERIFIED", "ACTIVE"]);
    expect(compact(query.sql)).toContain(
      'ORDER BY cp."createdAt" DESC, cp."id" DESC',
    );
  });

  it("com outro status no filtro não há aprovados para copiar", async () => {
    const db = exportDb();
    await expect(
      caller(db).exportVerified({ status: "PENDING" }),
    ).resolves.toEqual([]);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
});

// ============================================================================
// /clippers/ranking - mesmo resultado do cálculo antigo (post a post)
// ============================================================================

const PLATFORMS = ["INSTAGRAM", "TIKTOK", "YOUTUBE", "KWAI", "FACEBOOK"];
const CAMPAIGN_STATUS_ORDER = [
  "DRAFT",
  "SCHEDULED",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
];

type FxPost = {
  status: string;
  platform: string;
  views: bigint;
  likes: number;
  comments: number;
  shares: number;
  saves: number | null;
};
type FxApplication = {
  id: string;
  campaignId: string;
  clipperProfileId: string;
  status: string;
  posts: FxPost[];
};
type FxCampaign = {
  id: string;
  name: string;
  slug: string;
  status: string;
  coverImageUrl: string | null;
  startDate: Date;
  endDate: Date;
};
type FxClipper = {
  id: string;
  fullName: string;
  artisticName: string | null;
  user: { imageUrl: string | null; email: string };
  wallet: { totalEarned: number; balance: number } | null;
};

/** Dados variados e determinísticos, com empates de propósito. */
function rankingFixture() {
  const clippers: FxClipper[] = Array.from({ length: 112 }, (_, i) => ({
    id: `cp-${String(i).padStart(3, "0")}`,
    fullName: `Clipador ${i}`,
    artisticName: i % 3 === 0 ? `Art ${i}` : null,
    user: {
      imageUrl: i % 5 === 0 ? "" : i % 7 === 0 ? null : `https://img/${i}.png`,
      email: `c${i}@x.com`,
    },
    wallet:
      i % 4 === 0
        ? null
        : { totalEarned: ((i * 37) % 50) * 10.5, balance: i * 1.25 },
  }));

  const campaignStatuses = [
    "COMPLETED",
    "COMPLETED",
    "ACTIVE",
    "PAUSED",
    "SCHEDULED",
    "DRAFT",
    "COMPLETED",
  ];
  const campaigns: FxCampaign[] = campaignStatuses.map((status, j) => ({
    id: `camp-${j}`,
    name: `Competição ${j}`,
    slug: `comp-${j}`,
    status,
    coverImageUrl: j % 2 ? null : `https://cover/${j}.png`,
    startDate: new Date(Date.UTC(2026, j, 1)),
    // camp-0 e camp-6 terminam no mesmo dia (empate na ordem dos campeões)
    endDate: new Date(Date.UTC(2026, j === 6 ? 0 : j, 20)),
  }));

  const applications: FxApplication[] = [];
  clippers.forEach((clipper, i) => {
    campaigns.forEach((campaign, j) => {
      if ((i + j) % 3 === 0) return;
      // camp-6: só inscrições sem posts elegíveis (campeão com 0 views)
      const status =
        (i * (j + 1)) % 11 === 0
          ? ["PENDING", "REJECTED", "WITHDRAWN"][i % 3]!
          : "APPROVED";
      const posts: FxPost[] = Array.from(
        { length: (i + 2 * j) % 4 },
        (_, k) => {
          const views = BigInt((i * 7919 + j * 104729 + k * 31) % 100000);
          const n = Number(views);
          return {
            status: j === 6 || (i + k) % 5 === 0 ? "INELIGIBLE" : "ELIGIBLE",
            platform: PLATFORMS[(i + j + k) % 5]!,
            views: (i + k) % 9 === 0 ? 0n : views,
            likes: n % 977,
            comments: n % 131,
            shares: n % 57,
            saves: k % 2 ? null : n % 41,
          };
        },
      );
      applications.push({
        id: `app-${i}-${j}`,
        campaignId: campaign.id,
        clipperProfileId: clipper.id,
        status,
        posts,
      });
    });
  });

  return { clippers, campaigns, applications };
}

type Fixture = ReturnType<typeof rankingFixture>;

function campaignsFindMany(fx: Fixture, statuses: string[]) {
  return fx.campaigns
    .filter((c) => statuses.includes(c.status))
    .sort(
      (a, b) =>
        CAMPAIGN_STATUS_ORDER.indexOf(a.status) -
          CAMPAIGN_STATUS_ORDER.indexOf(b.status) ||
        b.endDate.getTime() - a.endDate.getTime(),
    );
}

/** Porta fiel do getRankingData antigo (carregava inscrições + posts). */
function legacyRankingData(fx: Fixture) {
  const clipperById = new Map(fx.clippers.map((c) => [c.id, c]));
  const eligible = (app: FxApplication) =>
    app.posts.filter((p) => p.status === "ELIGIBLE");
  const topByTotalViews = fx.applications.filter(
    (a) => a.status === "APPROVED",
  );

  const clipperMetricsMap = new Map<
    string,
    {
      clipperProfileId: string;
      fullName: string;
      artisticName: string | null;
      imageUrl: string | null;
      email: string;
      totalViews: number;
      totalLikes: number;
      totalComments: number;
      totalShares: number;
      totalSaves: number;
      totalPosts: number;
      totalEarned: number;
      balance: number;
      competitionsCount: number;
      platformBreakdown: Record<string, { views: number; posts: number }>;
    }
  >();

  topByTotalViews.forEach((app) => {
    const clipperProfile = clipperById.get(app.clipperProfileId)!;
    const clipPosts = eligible(app);
    const existing = clipperMetricsMap.get(app.clipperProfileId);
    let appViews = 0;
    let appLikes = 0;
    let appComments = 0;
    let appShares = 0;
    let appSaves = 0;
    const platformBreakdown: Record<string, { views: number; posts: number }> =
      {};
    clipPosts.forEach((post) => {
      const views = Number(post.views);
      appViews += views;
      appLikes += post.likes;
      appComments += post.comments;
      appShares += post.shares;
      appSaves += post.saves ?? 0;
      platformBreakdown[post.platform] ??= { views: 0, posts: 0 };
      platformBreakdown[post.platform]!.views += views;
      platformBreakdown[post.platform]!.posts += 1;
    });
    if (existing) {
      existing.totalViews += appViews;
      existing.totalLikes += appLikes;
      existing.totalComments += appComments;
      existing.totalShares += appShares;
      existing.totalSaves += appSaves;
      existing.totalPosts += clipPosts.length;
      existing.competitionsCount += 1;
      Object.entries(platformBreakdown).forEach(([platform, data]) => {
        existing.platformBreakdown[platform] ??= { views: 0, posts: 0 };
        existing.platformBreakdown[platform].views += data.views;
        existing.platformBreakdown[platform].posts += data.posts;
      });
    } else {
      clipperMetricsMap.set(app.clipperProfileId, {
        clipperProfileId: app.clipperProfileId,
        fullName: clipperProfile.fullName,
        artisticName: clipperProfile.artisticName,
        imageUrl: clipperProfile.user?.imageUrl || null,
        email: clipperProfile.user?.email || "",
        totalViews: appViews,
        totalLikes: appLikes,
        totalComments: appComments,
        totalShares: appShares,
        totalSaves: appSaves,
        totalPosts: clipPosts.length,
        totalEarned: clipperProfile.wallet?.totalEarned || 0,
        balance: clipperProfile.wallet?.balance || 0,
        competitionsCount: 1,
        platformBreakdown,
      });
    }
  });

  const topClippersByViews = Array.from(clipperMetricsMap.values())
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, 100)
    .map((c, index) => ({
      ...c,
      rank: index + 1,
      engagementRate: calculateEngagementRate(
        c.totalViews,
        c.totalLikes,
        c.totalComments,
        c.totalShares,
        c.totalSaves,
      ),
    }));

  const topClippersByEarnings = Array.from(clipperMetricsMap.values())
    .sort((a, b) => b.totalEarned - a.totalEarned)
    .slice(0, 50)
    .map((c, index) => ({ ...c, rank: index + 1 }));

  const platformRankings: Record<string, unknown[]> = {};
  PLATFORMS.forEach((platform) => {
    platformRankings[platform] = Array.from(clipperMetricsMap.values())
      .filter((c) => c.platformBreakdown[platform])
      .map((c) => ({
        clipperProfileId: c.clipperProfileId,
        fullName: c.fullName,
        artisticName: c.artisticName,
        imageUrl: c.imageUrl,
        views: c.platformBreakdown[platform]?.views || 0,
        posts: c.platformBreakdown[platform]?.posts || 0,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 15)
      .map((c, index) => ({ ...c, rank: index + 1 }));
  });

  const allCompetitions = campaignsFindMany(fx, [
    "ACTIVE",
    "COMPLETED",
    "PAUSED",
    "SCHEDULED",
  ]);
  const competitionRankings = allCompetitions.map((campaign) => {
    const ranking = fx.applications
      .filter((a) => a.campaignId === campaign.id && a.status === "APPROVED")
      .map((app) => {
        const clipperProfile = clipperById.get(app.clipperProfileId)!;
        const clipPosts = eligible(app);
        return {
          clipperProfileId: app.clipperProfileId,
          fullName: clipperProfile.fullName,
          artisticName: clipperProfile.artisticName,
          imageUrl: clipperProfile.user?.imageUrl || null,
          totalViews: clipPosts.reduce((sum, p) => sum + Number(p.views), 0),
          postsCount: clipPosts.length,
        };
      })
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, 10)
      .map((c, index) => ({ ...c, rank: index + 1 }));
    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        slug: campaign.slug,
        status: campaign.status,
        coverImageUrl: campaign.coverImageUrl,
        startDate: campaign.startDate.toISOString(),
        endDate: campaign.endDate.toISOString(),
      },
      ranking,
    };
  });

  const completedCompetitions = allCompetitions.filter(
    (c) => c.status === "COMPLETED",
  );
  const champions: Array<{
    clipperProfileId: string;
    fullName: string;
    artisticName: string | null;
    imageUrl: string | null;
    competitionName: string;
    competitionSlug: string;
    competitionCoverUrl: string | null;
    totalViews: number;
    postsCount: number;
    endDate: string;
  }> = [];
  for (const comp of competitionRankings) {
    if (completedCompetitions.some((c) => c.id === comp.campaign.id)) {
      const winner = comp.ranking.find((r) => r.rank === 1);
      if (winner) {
        champions.push({
          clipperProfileId: winner.clipperProfileId,
          fullName: winner.fullName,
          artisticName: winner.artisticName,
          imageUrl: winner.imageUrl,
          competitionName: comp.campaign.name,
          competitionSlug: comp.campaign.slug,
          competitionCoverUrl: comp.campaign.coverImageUrl,
          totalViews: winner.totalViews,
          postsCount: winner.postsCount,
          endDate: comp.campaign.endDate,
        });
      }
    }
  }
  champions.sort(
    (a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime(),
  );
  const championCounts = new Map<string, number>();
  champions.forEach((c) => {
    championCounts.set(
      c.clipperProfileId,
      (championCounts.get(c.clipperProfileId) || 0) + 1,
    );
  });
  const championsWithTitles = champions.map((c) => ({
    ...c,
    titlesCount: championCounts.get(c.clipperProfileId) || 1,
  }));
  const topChampions = Array.from(championCounts.entries())
    .map(([clipperProfileId, count]) => {
      const champData = champions.find(
        (c) => c.clipperProfileId === clipperProfileId,
      );
      return {
        clipperProfileId,
        fullName: champData?.fullName || "",
        artisticName: champData?.artisticName || null,
        imageUrl: champData?.imageUrl || null,
        titlesCount: count,
        competitions: champions
          .filter((c) => c.clipperProfileId === clipperProfileId)
          .map((c) => ({
            name: c.competitionName,
            slug: c.competitionSlug,
            coverUrl: c.competitionCoverUrl,
            views: c.totalViews,
          })),
      };
    })
    .sort((a, b) => b.titlesCount - a.titlesCount);

  const values = Array.from(clipperMetricsMap.values());
  const platformDistribution = PLATFORMS.map((platform) => {
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalPosts = 0;
    let clippersCount = 0;
    values.forEach((c) => {
      const platformData = c.platformBreakdown[platform];
      if (platformData) {
        totalViews += platformData.views;
        totalPosts += platformData.posts;
        clippersCount++;
      }
    });
    values.forEach((c) => {
      if (c.platformBreakdown[platform]) {
        const ratio =
          c.totalViews > 0
            ? c.platformBreakdown[platform].views / c.totalViews
            : 0;
        totalLikes += Math.round(c.totalLikes * ratio);
        totalComments += Math.round(c.totalComments * ratio);
        totalShares += Math.round(c.totalShares * ratio);
      }
    });
    return {
      platform,
      totalViews,
      totalPosts,
      totalLikes,
      totalComments,
      totalShares,
      clippersCount,
      engagementRate: calculateEngagementRate(
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
      ),
      avgViewsPerPost: totalPosts > 0 ? totalViews / totalPosts : 0,
    };
  });

  return {
    topClippersByViews,
    topClippersByEarnings,
    platformRankings,
    competitionRankings,
    champions: championsWithTitles,
    topChampions,
    platformDistribution,
    stats: {
      totalClippers: clipperMetricsMap.size,
      totalViewsAllTime: values.reduce((sum, c) => sum + c.totalViews, 0),
      totalEarningsAllTime: values.reduce((sum, c) => sum + c.totalEarned, 0),
      totalPostsAllTime: values.reduce((sum, c) => sum + c.totalPosts, 0),
      activeCompetitionsCount: allCompetitions.filter(
        (c) => c.status === "ACTIVE",
      ).length,
      completedCompetitionsCount: completedCompetitions.length,
      totalCompetitionsCount: allCompetitions.length,
    },
  };
}

/** Banco falso: responde cada SQL do ranking como o Postgres responderia. */
function rankingDb(fx: Fixture) {
  const approved = fx.applications.filter((a) => a.status === "APPROVED");
  const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const walletOf = (clipperProfileId: string) =>
    fx.clippers.find((c) => c.id === clipperProfileId)?.wallet ?? null;

  const queryRaw = vi.fn((...args: unknown[]) => {
    const query = rawQuery(args);

    if (query.sql.includes('AS "competitionsCount"')) {
      const counts = new Map<string, number>();
      for (const app of approved) {
        counts.set(
          app.clipperProfileId,
          (counts.get(app.clipperProfileId) ?? 0) + 1,
        );
      }
      return Promise.resolve(
        [...counts.entries()]
          .sort(([a], [b]) => byId(a, b))
          .map(([clipperProfileId, competitionsCount]) => ({
            clipperProfileId,
            competitionsCount,
            totalEarned: walletOf(clipperProfileId)?.totalEarned ?? null,
            balance: walletOf(clipperProfileId)?.balance ?? null,
          })),
      );
    }

    if (query.sql.includes('p."platform"::text AS "platform"')) {
      const groups = new Map<
        string,
        {
          clipperProfileId: string;
          platform: string;
          views: bigint;
          likes: bigint;
          comments: bigint;
          shares: bigint;
          saves: bigint;
          posts: number;
        }
      >();
      for (const app of approved) {
        for (const post of app.posts) {
          if (post.status !== "ELIGIBLE") continue;
          const key = `${app.clipperProfileId}|${post.platform}`;
          const group = groups.get(key) ?? {
            clipperProfileId: app.clipperProfileId,
            platform: post.platform,
            views: 0n,
            likes: 0n,
            comments: 0n,
            shares: 0n,
            saves: 0n,
            posts: 0,
          };
          group.views += post.views;
          group.likes += BigInt(post.likes);
          group.comments += BigInt(post.comments);
          group.shares += BigInt(post.shares);
          group.saves += BigInt(post.saves ?? 0);
          group.posts += 1;
          groups.set(key, group);
        }
      }
      return Promise.resolve(
        [...groups.values()].sort(
          (a, b) =>
            byId(a.clipperProfileId, b.clipperProfileId) ||
            byId(a.platform, b.platform),
        ),
      );
    }

    if (query.sql.includes("ROW_NUMBER()")) {
      const campaignIds = query.values as string[];
      const rows = approved
        .filter((app) => campaignIds.includes(app.campaignId))
        .map((app) => {
          const posts = app.posts.filter((p) => p.status === "ELIGIBLE");
          return {
            campaignId: app.campaignId,
            clipperProfileId: app.clipperProfileId,
            totalViews: posts.reduce((sum, p) => sum + p.views, 0n),
            postsCount: posts.length,
          };
        });
      const ranked = campaignIds.flatMap((campaignId) =>
        rows
          .filter((row) => row.campaignId === campaignId)
          .sort(
            (a, b) =>
              (a.totalViews === b.totalViews
                ? 0
                : a.totalViews > b.totalViews
                  ? -1
                  : 1) || byId(a.clipperProfileId, b.clipperProfileId),
          )
          .map((row, index) => ({ ...row, rank: index + 1 }))
          .filter((row) => row.rank <= 10),
      );
      return Promise.resolve(
        ranked.sort(
          (a, b) => byId(a.campaignId, b.campaignId) || a.rank - b.rank,
        ),
      );
    }

    throw new Error(`SQL inesperado: ${query.sql}`);
  });

  const db = {
    $queryRaw: queryRaw,
    user: { findUnique: vi.fn().mockResolvedValue({ role: "ADMIN" }) },
    clipperProfile: {
      findMany: vi.fn(({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(
          fx.clippers
            .filter((c) => where.id.in.includes(c.id))
            .reverse()
            .map((c) => ({
              id: c.id,
              fullName: c.fullName,
              artisticName: c.artisticName,
              user: c.user,
            })),
        ),
      ),
    },
    campaign: {
      findMany: vi.fn(({ where }: { where: { status: { in: string[] } } }) =>
        Promise.resolve(campaignsFindMany(fx, where.status.in)),
      ),
      groupBy: vi.fn(({ where }: { where: { status: { in: string[] } } }) => {
        const counts = new Map<string, number>();
        for (const c of fx.campaigns) {
          if (!where.status.in.includes(c.status)) continue;
          counts.set(c.status, (counts.get(c.status) ?? 0) + 1);
        }
        return Promise.resolve(
          [...counts.entries()].map(([status, count]) => ({
            status,
            _count: { _all: count },
          })),
        );
      }),
    },
  };
  return { db, queryRaw };
}

describe("ranking geral do admin (/clippers/ranking)", () => {
  it("getRankingData devolve exatamente o que o cálculo post a post devolvia", async () => {
    const fx = rankingFixture();
    const { db } = rankingDb(fx);
    const legacy = legacyRankingData(fx);

    const result = await caller(db).getRankingData();

    // Sanidade do fixture: cortes de top 100 / 15 / 10 e campeões em uso
    expect(legacy.stats.totalClippers).toBeGreaterThan(100);
    expect(legacy.topClippersByViews).toHaveLength(100);
    expect(legacy.champions.length).toBeGreaterThan(1);
    expect(
      legacy.competitionRankings.every((c) => c.ranking.length === 10),
    ).toBe(true);

    expect(result).toEqual(legacy);
  });

  it("cada aba devolve o mesmo pedaço do payload completo", async () => {
    const fx = rankingFixture();
    const { db } = rankingDb(fx);
    const legacy = legacyRankingData(fx);
    const api = caller(db);

    expect(await api.getRankingSummary()).toEqual(legacy.stats);
    expect(await api.getRankingByViews()).toEqual(legacy.topClippersByViews);
    expect(await api.getRankingByEarnings()).toEqual(
      legacy.topClippersByEarnings,
    );
    expect(await api.getRankingByPlatform()).toEqual({
      platformRankings: legacy.platformRankings,
      platformDistribution: legacy.platformDistribution,
    });
    expect(await api.getRankingByCompetition()).toEqual(
      legacy.competitionRankings,
    );
    expect(await api.getRankingChampions()).toEqual({
      champions: legacy.champions,
      topChampions: legacy.topChampions,
    });
  });

  it("soma no banco e reaproveita as métricas entre abas (cache)", async () => {
    const fx = rankingFixture();
    const { db, queryRaw } = rankingDb(fx);
    const api = caller(db);

    await Promise.all([
      api.getRankingSummary(),
      api.getRankingByViews(),
      api.getRankingByEarnings(),
      api.getRankingByPlatform(),
    ]);
    await api.getRankingByViews();

    // Uma leitura de métricas por clipador + uma por clipador × plataforma
    const sqls = queryRaw.mock.calls.map((call) => rawQuery(call).sql);
    expect(
      sqls.filter((sql) => sql.includes('"competitionsCount"')),
    ).toHaveLength(1);
    expect(
      sqls.filter((sql) => sql.includes('p."platform"::text')),
    ).toHaveLength(1);
    expect(
      compact(sqls.find((sql) => sql.includes('p."platform"::text'))!),
    ).toContain(
      `WHERE a."status" = 'APPROVED' AND p."status" = 'ELIGIBLE' GROUP BY a."clipperProfileId", p."platform"`,
    );
  });

  it("devolve INTERNAL_SERVER_ERROR se o banco falhar", async () => {
    const { db, queryRaw } = rankingDb(rankingFixture());
    queryRaw.mockRejectedValue(new Error("boom"));
    await expect(caller(db).getRankingByViews()).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });
});

// ============================================================================
// getMySocialAccounts - só o último log de sincronização de cada conexão
// ============================================================================

describe("clipper.getMySocialAccounts", () => {
  const youtubeLog = {
    id: "yt-log-2",
    status: "COMPLETED",
    videosProcessed: 3,
    videosUpdated: 2,
    videosFailed: 1,
    errorMessage: null,
    startedAt: new Date("2026-10-01T10:00:00Z"),
    completedAt: new Date("2026-10-01T10:05:00Z"),
    createdAt: new Date("2026-10-01T10:00:00Z"),
  };
  const instagramLog = {
    id: "ig-log-9",
    status: "FAILED",
    videosProcessed: 0,
    videosUpdated: 0,
    videosFailed: 0,
    commentsFetched: 4,
    commentsNew: 1,
    errorMessage: "token",
    startedAt: null,
    completedAt: null,
    createdAt: new Date("2026-10-02T10:00:00Z"),
  };

  function socialDb() {
    const accounts = [
      {
        id: "acc-yt",
        platform: "YOUTUBE",
        username: "canal",
        youtubeAuth: { id: "yt-auth", channelId: "ch", status: "ACTIVE" },
        instagramAuth: null,
        tiktokAuth: null,
      },
      {
        id: "acc-ig",
        platform: "INSTAGRAM",
        username: "insta",
        youtubeAuth: null,
        instagramAuth: { id: "ig-auth", igUserId: "ig", status: "ACTIVE" },
        tiktokAuth: null,
      },
      {
        // Conexão TikTok sem nenhum log ainda
        id: "acc-tt",
        platform: "TIKTOK",
        username: "tt",
        youtubeAuth: null,
        instagramAuth: null,
        tiktokAuth: { id: "tt-auth", openId: "open", status: "ACTIVE" },
      },
      {
        id: "acc-kwai",
        platform: "KWAI",
        username: "kwai",
        youtubeAuth: null,
        instagramAuth: null,
        tiktokAuth: null,
      },
    ];
    const queryRaw = vi.fn((...args: unknown[]) => {
      const query = rawQuery(args);
      if (query.sql.includes('FROM "YouTubeSyncLog"')) {
        return Promise.resolve([{ authId: "yt-auth", ...youtubeLog }]);
      }
      if (query.sql.includes('FROM "InstagramSyncLog"')) {
        return Promise.resolve([{ authId: "ig-auth", ...instagramLog }]);
      }
      return Promise.resolve([]);
    });
    const db = {
      $queryRaw: queryRaw,
      clipperProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: "clipper-1",
          socialAccounts: accounts,
        }),
      },
    };
    return { db, queryRaw };
  }

  it("junta o último log de cada conexão no mesmo formato de antes", async () => {
    const { db } = socialDb();

    const result = await caller(db).getMySocialAccounts();

    expect(result.map((a) => a.id)).toEqual([
      "acc-yt",
      "acc-ig",
      "acc-tt",
      "acc-kwai",
    ]);
    expect(result[0]!.youtubeAuth).toEqual({
      id: "yt-auth",
      channelId: "ch",
      status: "ACTIVE",
      syncLogs: [youtubeLog],
    });
    expect(result[1]!.instagramAuth?.syncLogs).toEqual([instagramLog]);
    expect(result[2]!.tiktokAuth?.syncLogs).toEqual([]);
    expect(result[3]).toMatchObject({
      youtubeAuth: null,
      instagramAuth: null,
      tiktokAuth: null,
    });
  });

  it("não carrega os logs pelo include e busca só o mais recente por conexão", async () => {
    const { db, queryRaw } = socialDb();

    await caller(db).getMySocialAccounts();

    const include = (
      db.clipperProfile.findUnique.mock.calls[0]![0] as {
        include: {
          socialAccounts: {
            include: Record<string, { select: Record<string, unknown> }>;
          };
        };
      }
    ).include.socialAccounts.include;
    for (const relation of ["youtubeAuth", "instagramAuth", "tiktokAuth"]) {
      expect(include[relation]!.select).not.toHaveProperty("syncLogs");
    }

    expect(queryRaw).toHaveBeenCalledTimes(3);
    const queries = queryRaw.mock.calls.map((call) => rawQuery(call));
    for (const [query, authId, fk] of [
      [queries[0]!, "yt-auth", "youtubeAuthId"],
      [queries[1]!, "ig-auth", "instagramAuthId"],
      [queries[2]!, "tt-auth", "tiktokConnectionId"],
    ] as const) {
      const sql = compact(query.sql);
      expect(sql).toContain("CROSS JOIN LATERAL");
      expect(sql).toContain(`WHERE log."${fk}" = auth."id"`);
      expect(sql).toContain(
        'ORDER BY log."createdAt" DESC, log."id" DESC LIMIT 1',
      );
      expect(query.values).toEqual([authId]);
    }
  });

  it("sem conexões não consulta logs", async () => {
    const { db, queryRaw } = socialDb();
    db.clipperProfile.findUnique.mockResolvedValue({
      id: "clipper-1",
      socialAccounts: [],
    });
    await expect(caller(db).getMySocialAccounts()).resolves.toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
