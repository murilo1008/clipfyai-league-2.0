import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const currentUser = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({
  currentUser,
  // privateProcedure autentica via auth(); deriva do mesmo mock de currentUser
  auth: async () => ({
    userId: ((await currentUser()) as { id?: string } | null)?.id ?? null,
  }),
}));
vi.mock("@/server/db", () => ({ db: {} }));

import { clanRouter } from "./clan";
import { calculateEngagementRate } from "@/lib/ranking-helpers";
import { invalidateCachedQueries } from "@/server/memory-cache";

// ─── Fixture ────────────────────────────────────────────────────────────────
// A ordem dos arrays é a ordem "natural" do banco (consultas sem orderBy).

const NOW = new Date("2026-10-13T15:00:00.000Z");
const todayStart = new Date(NOW);
todayStart.setHours(0, 0, 0, 0);
const hoursFromToday = (hours: number) =>
  new Date(todayStart.getTime() + hours * 3_600_000);

type CampaignRow = {
  id: string;
  name: string;
  coverImageUrl: string | null;
  status: string;
};
const campaigns: CampaignRow[] = [
  {
    id: "camp-a",
    name: "Competição A",
    coverImageUrl: "a.png",
    status: "ACTIVE",
  },
  {
    id: "camp-b",
    name: "Competição B",
    coverImageUrl: null,
    status: "ARCHIVED",
  },
  {
    id: "camp-c",
    name: "Competição C",
    coverImageUrl: null,
    status: "COMPLETED",
  },
  // Mesmo nome da A: a lista de campanhas do admin é deduplicada por nome.
  { id: "camp-d", name: "Competição A", coverImageUrl: null, status: "ACTIVE" },
];

const clan = (
  id: string,
  tag: string,
  name: string,
  createdAt: string,
  extra: Partial<{ isActive: boolean; ownerId: string; adminId: string }> = {},
) => ({
  id,
  name,
  tag,
  emoji: "🔥",
  emojiColor: "#FF5733",
  imageUrl: null,
  description: `Clã ${name}`,
  isActive: extra.isActive ?? true,
  ownerId: extra.ownerId ?? null,
  adminId: extra.adminId ?? null,
  createdAt: new Date(createdAt),
  updatedAt: new Date(createdAt),
});
const clans = [
  clan("clan-gama", "GAMA", "Gama", "2026-03-01T00:00:00Z"),
  clan("clan-alfa", "ALFA", "Alfa", "2026-01-01T00:00:00Z", {
    ownerId: "m1",
    adminId: "m2",
  }),
  clan("clan-beta", "BETA", "Beta", "2026-02-01T00:00:00Z", { ownerId: "m4" }),
  clan("clan-delt", "DELT", "Delta", "2026-01-15T00:00:00Z"),
  clan("clan-zeta", "ZETA", "Zeta", "2025-12-01T00:00:00Z", {
    isActive: false,
  }),
];

const member = (
  id: string,
  clanId: string | null,
  artisticName: string | null,
  imageUrl: string | null = `${id}.png`,
) => ({
  id,
  clanId,
  userId: `user-${id}`,
  fullName: `Membro ${id}`,
  artisticName,
  discordUsername: `discord-${id}`,
  createdAt: new Date("2026-05-01T00:00:00Z"),
  imageUrl,
});
const members = [
  member("m2", "clan-alfa", "Dois"),
  member("m1", "clan-alfa", null),
  member("m9", "clan-alfa", ""),
  member("m3", "clan-alfa", "Três", null),
  member("m10", "clan-alfa", "Dez"),
  member("m11", "clan-alfa", "Onze"),
  member("m4", "clan-beta", "Quatro"),
  member("m5", "clan-beta", "Cinco"),
  member("m6", "clan-gama", "Seis"),
  member("m12", "clan-gama", "Doze"),
  member("m7", "clan-zeta", "Sete"),
  member("m8", null, "Sem clã"),
];

const applications = [
  {
    id: "a1",
    clipperProfileId: "m1",
    campaignId: "camp-a",
    status: "APPROVED",
  },
  {
    id: "a2",
    clipperProfileId: "m1",
    campaignId: "camp-b",
    status: "APPROVED",
  },
  {
    id: "a3",
    clipperProfileId: "m2",
    campaignId: "camp-a",
    status: "REJECTED",
  },
  {
    id: "a4",
    clipperProfileId: "m2",
    campaignId: "camp-c",
    status: "APPROVED",
  },
  {
    id: "a10",
    clipperProfileId: "m2",
    campaignId: "camp-d",
    status: "APPROVED",
  },
  {
    id: "a11",
    clipperProfileId: "m3",
    campaignId: "camp-a",
    status: "APPROVED",
  },
  {
    id: "a5",
    clipperProfileId: "m4",
    campaignId: "camp-a",
    status: "WITHDRAWN",
  },
  {
    id: "a6",
    clipperProfileId: "m5",
    campaignId: "camp-c",
    status: "APPROVED",
  },
  { id: "a9", clipperProfileId: "m6", campaignId: "camp-a", status: "PENDING" },
  {
    id: "a7",
    clipperProfileId: "m7",
    campaignId: "camp-a",
    status: "APPROVED",
  },
  {
    id: "a8",
    clipperProfileId: "m8",
    campaignId: "camp-a",
    status: "APPROVED",
  },
];

type PostRow = {
  id: string;
  applicationId: string;
  status: string;
  views: bigint;
  likes: number;
  comments: number;
  shares: number;
  saves: number | null;
  platform: string;
  postedAt: Date | null;
};
const post = (
  id: string,
  applicationId: string,
  status: string,
  views: bigint,
  extra: Partial<
    Omit<PostRow, "id" | "applicationId" | "status" | "views">
  > = {},
): PostRow => ({
  id,
  applicationId,
  status,
  views,
  likes: 0,
  comments: 0,
  shares: 0,
  saves: null,
  platform: "TIKTOK",
  postedAt: null,
  ...extra,
});
const posts: PostRow[] = [
  post("p1", "a1", "ELIGIBLE", 1_000n, {
    likes: 50,
    comments: 5,
    shares: 2,
    postedAt: hoursFromToday(2),
  }),
  post("p2", "a1", "ELIGIBLE", 2_500n, {
    likes: 100,
    comments: 10,
    shares: 5,
    saves: 7,
    postedAt: hoursFromToday(-1),
  }),
  post("p3", "a1", "INELIGIBLE", 99_999n, { likes: 999 }),
  post("p4", "a2", "ELIGIBLE", 300n, { likes: 3 }),
  post("p5", "a3", "ELIGIBLE", 700n, { likes: 7, postedAt: hoursFromToday(1) }),
  post("p6", "a3", "PENDING", 5_000n),
  post("p12", "a10", "ELIGIBLE", 1_200n, {
    likes: 12,
    saves: 1,
    postedAt: hoursFromToday(3),
  }),
  post("p7", "a5", "ELIGIBLE", 4_200n, { likes: 40, comments: 1 }),
  post("p8", "a6", "ELIGIBLE", 0n),
  post("p11", "a6", "DISQUALIFIED", 8_000n),
  post("p13", "a9", "ELIGIBLE", 0n),
  post("p9", "a7", "ELIGIBLE", 10_000n, { likes: 100 }),
  post("p10", "a8", "ELIGIBLE", 50_000n, { likes: 500 }),
];

const campaignById = (id: string) => campaigns.find((c) => c.id === id)!;
const memberById = (id: string) => members.find((m) => m.id === id)!;
const applicationById = (id: string) => applications.find((a) => a.id === id)!;
const clanMembers = (clanId: string) =>
  members.filter((m) => m.clanId === clanId);

// ─── Simulação do banco ─────────────────────────────────────────────────────

type Args = Record<string, any>;

function clanMatches(c: (typeof clans)[number], where: Args = {}) {
  if (where.isActive !== undefined && c.isActive !== where.isActive)
    return false;
  if (where.tag !== undefined && c.tag !== where.tag) return false;
  if (where.OR) {
    return (where.OR as Args[]).some((cond) => {
      const [field, filter] = Object.entries(cond)[0]! as [
        "name" | "tag",
        { contains: string },
      ];
      return c[field].toLowerCase().includes(filter.contains.toLowerCase());
    });
  }
  return true;
}

function profileRow(m: (typeof members)[number], select: Args) {
  const row: Args = {
    id: m.id,
    fullName: m.fullName,
    artisticName: m.artisticName,
    discordUsername: m.discordUsername,
    createdAt: m.createdAt,
    user: {
      id: m.userId,
      imageUrl: m.imageUrl,
      email: `${m.id}@clipfy.test`,
      createdAt: m.createdAt,
    },
  };
  const apps = select.applications as Args | undefined;
  if (apps) {
    row.applications = applications
      .filter(
        (a) =>
          a.clipperProfileId === m.id &&
          (!apps.where?.status || a.status === apps.where.status),
      )
      .map((a) => ({
        id: a.id,
        campaign: campaignById(a.campaignId),
        ...(apps.select.clipPosts && {
          clipPosts: posts.filter(
            (p) => p.applicationId === a.id && p.status === "ELIGIBLE",
          ),
        }),
      }));
  }
  return row;
}

function clanRow(c: (typeof clans)[number], include: Args = {}) {
  const row: Args = { ...c };
  const ownerRow = (id: string | null) =>
    id ? profileRow(memberById(id), {}) : null;
  if (include.owner) row.owner = ownerRow(c.ownerId);
  if (include.admin) row.admin = ownerRow(c.adminId);
  if (include.members) {
    row.members = clanMembers(c.id).map((m) =>
      profileRow(m, include.members.select as Args),
    );
  }
  return row;
}

type SqlTotals = {
  posts: number;
  views: bigint;
  likes: bigint;
  comments: bigint;
  shares: bigint;
  saves: bigint;
};
function sumPosts(rows: PostRow[]): SqlTotals {
  return {
    posts: rows.length,
    views: rows.reduce((s, p) => s + p.views, 0n),
    likes: BigInt(rows.reduce((s, p) => s + p.likes, 0)),
    comments: BigInt(rows.reduce((s, p) => s + p.comments, 0)),
    shares: BigInt(rows.reduce((s, p) => s + p.shares, 0)),
    saves: BigInt(rows.reduce((s, p) => s + (p.saves ?? 0), 0)),
  };
}

/** Executa em memória as consultas SQL do router, com a mesma semântica. */
function simulateSql(sql: string, values: unknown[]) {
  if (sql.includes('GROUP BY a."clipperProfileId"')) {
    // Totais por membro de clã: inscrições de qualquer status.
    const byMember = new Map<string, PostRow[]>();
    for (const p of posts) {
      if (p.status !== "ELIGIBLE") continue;
      const app = applicationById(p.applicationId);
      if (!memberById(app.clipperProfileId).clanId) continue;
      const list = byMember.get(app.clipperProfileId) ?? [];
      list.push(p);
      byMember.set(app.clipperProfileId, list);
    }
    return [...byMember].map(([clipperProfileId, rows]) => ({
      clipperProfileId,
      ...sumPosts(rows),
    }));
  }
  if (sql.includes('GROUP BY p."applicationId"')) {
    // Totais por inscrição APROVADA dos membros do clã da tag.
    const tag = values.find((v) => typeof v === "string");
    const since = values.find((v): v is Date => v instanceof Date)!;
    const clanId = clans.find((c) => c.tag === tag)?.id;
    const byApp = new Map<string, PostRow[]>();
    for (const p of posts) {
      if (p.status !== "ELIGIBLE") continue;
      const app = applicationById(p.applicationId);
      if (app.status !== "APPROVED") continue;
      if (!clanId || memberById(app.clipperProfileId).clanId !== clanId)
        continue;
      const list = byApp.get(app.id) ?? [];
      list.push(p);
      byApp.set(app.id, list);
    }
    return [...byApp].map(([applicationId, rows]) => {
      const today = rows.filter((p) => p.postedAt && p.postedAt >= since);
      return {
        applicationId,
        ...sumPosts(rows),
        todayViews: sumPosts(today).views,
        todayPosts: today.length,
      };
    });
  }
  if (sql.includes("ROW_NUMBER()")) {
    // 5 primeiros membros de cada clã pela ordem do id.
    const clanIds = (values[0] as { values: string[] }).values;
    return clanIds.flatMap((clanId) =>
      clanMembers(clanId)
        .slice()
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .slice(0, 5)
        .map((m) => ({
          id: m.id,
          clanId,
          fullName: m.fullName,
          artisticName: m.artisticName,
          imageUrl: m.imageUrl,
        })),
    );
  }
  throw new Error(`SQL inesperado: ${sql}`);
}

function createDb(requesterId = "m2") {
  const db = {
    user: { findUnique: vi.fn().mockResolvedValue({ role: "ADMIN" }) },
    clan: {
      findMany: vi.fn(async (args: Args) => {
        const rows = clans.filter((c) => clanMatches(c, args.where as Args));
        const orderBy = args.orderBy as Args | undefined;
        if (orderBy?.createdAt) {
          const dir = orderBy.createdAt === "asc" ? 1 : -1;
          rows.sort(
            (a, b) => dir * (a.createdAt.getTime() - b.createdAt.getTime()),
          );
        } else if (orderBy?.name) {
          rows.sort((a, b) => a.name.localeCompare(b.name));
        }
        return rows.map((c) => clanRow(c, args.include as Args));
      }),
      findUnique: vi.fn(async (args: Args) => {
        const found = clans.find((c) => clanMatches(c, args.where as Args));
        return found ? clanRow(found, args.include as Args) : null;
      }),
    },
    clipperProfile: {
      findUnique: vi.fn(async () => {
        const m = memberById(requesterId);
        return {
          id: m.id,
          clanId: m.clanId,
          clan: clans.find((c) => c.id === m.clanId) ?? null,
        };
      }),
      groupBy: vi.fn(async (args: Args) =>
        (args.where.clanId.in as string[])
          .map((clanId) => ({
            clanId,
            _count: { _all: clanMembers(clanId).length },
          }))
          .filter((row) => row._count._all > 0),
      ),
      count: vi.fn(
        async (args: Args) => clanMembers(args.where.clanId as string).length,
      ),
      findMany: vi.fn(async (args: Args) =>
        clanMembers(args.where.clanId as string)
          .slice()
          .sort((a, b) => (a.id < b.id ? -1 : 1))
          .slice(0, args.take as number)
          .map((m) => profileRow(m, {})),
      ),
    },
    clanApplication: { count: vi.fn().mockResolvedValue(3) },
    $queryRaw: vi.fn(
      async (strings: TemplateStringsArray, ...values: unknown[]) =>
        simulateSql(strings.join("?"), values),
    ),
  };
  return {
    db,
    api: clanRouter.createCaller({ db, headers: new Headers() } as never),
  };
}

const sqlCalls = (db: ReturnType<typeof createDb>["db"]) =>
  db.$queryRaw.mock.calls.map(([strings]) => strings.join("?"));

// ─── Implementações antigas (somavam cada post em JS), para comparação ──────

const legacyMembers = (clanId: string, appStatus?: string) =>
  clanMembers(clanId).map((m) =>
    profileRow(m, {
      applications: {
        ...(appStatus ? { where: { status: appStatus } } : {}),
        select: { clipPosts: true },
      },
    }),
  ) as Array<{
    id: string;
    fullName: string;
    artisticName: string | null;
    discordUsername: string;
    createdAt: Date;
    user: { imageUrl: string | null; email: string };
    applications: Array<{
      id: string;
      campaign: CampaignRow;
      clipPosts: PostRow[];
    }>;
  }>;

function legacyClanRanking(clanOrder: typeof clans) {
  return clanOrder
    .map((c) => {
      const ms = legacyMembers(c.id);
      let totalViews = 0;
      let totalLikes = 0;
      let totalComments = 0;
      let totalShares = 0;
      let totalSaves = 0;
      let totalPosts = 0;
      for (const m of ms) {
        for (const app of m.applications) {
          for (const p of app.clipPosts) {
            totalPosts++;
            totalViews += Number(p.views ?? 0);
            totalLikes += p.likes ?? 0;
            totalComments += p.comments ?? 0;
            totalShares += p.shares ?? 0;
            totalSaves += p.saves ?? 0;
          }
        }
      }
      const owner = c.ownerId ? memberById(c.ownerId) : null;
      return {
        id: c.id,
        name: c.name,
        tag: c.tag,
        emoji: c.emoji,
        emojiColor: c.emojiColor,
        imageUrl: c.imageUrl,
        memberCount: ms.length,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        totalPosts,
        engagement: calculateEngagementRate(
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
          totalSaves,
        ),
        owner: owner
          ? {
              name: owner.artisticName ?? owner.fullName,
              imageUrl: owner.imageUrl ?? null,
            }
          : null,
        topMembers: ms
          .map((m) => ({
            id: m.id,
            name: m.artisticName ?? m.fullName,
            imageUrl: m.user?.imageUrl ?? null,
            views: m.applications.reduce(
              (acc, app) =>
                acc +
                app.clipPosts.reduce((s, p) => s + Number(p.views ?? 0), 0),
              0,
            ),
          }))
          .sort((a, b) => b.views - a.views)
          .slice(0, 5),
      };
    })
    .sort((a, b) => b.totalViews - a.totalViews);
}

function legacyList(clanOrder: typeof clans, sortBy: string) {
  const enriched = clanOrder.map((c) => {
    const ms = legacyMembers(c.id);
    return {
      id: c.id,
      name: c.name,
      tag: c.tag,
      emoji: c.emoji,
      emojiColor: c.emojiColor,
      imageUrl: c.imageUrl,
      description: c.description,
      isActive: c.isActive,
      createdAt: c.createdAt,
      memberCount: ms.length,
      totalViews: ms.reduce(
        (acc, m) =>
          acc +
          m.applications.reduce(
            (appAcc, app) =>
              appAcc +
              app.clipPosts.reduce((s, p) => s + Number(p.views ?? 0), 0),
            0,
          ),
        0,
      ),
      topMembers: ms.slice(0, 5).map((m) => ({
        id: m.id,
        name: m.artisticName ?? m.fullName,
        imageUrl: m.user?.imageUrl ?? null,
      })),
    };
  });
  if (sortBy === "members")
    enriched.sort((a, b) => b.memberCount - a.memberCount);
  else if (sortBy === "views")
    enriched.sort((a, b) => b.totalViews - a.totalViews);
  return enriched;
}

function legacyMemberStats(
  m: ReturnType<typeof legacyMembers>[number],
  today: Date,
) {
  let totalViews = 0;
  let totalLikes = 0;
  let totalComments = 0;
  let totalShares = 0;
  let totalSaves = 0;
  let totalPosts = 0;
  let todayViews = 0;
  let todayPosts = 0;
  const campaignNames = new Set<string>();
  for (const app of m.applications) {
    campaignNames.add(app.campaign.name);
    for (const p of app.clipPosts) {
      totalPosts++;
      const views = Number(p.views ?? 0);
      totalViews += views;
      totalLikes += p.likes ?? 0;
      totalComments += p.comments ?? 0;
      totalShares += p.shares ?? 0;
      totalSaves += p.saves ?? 0;
      if (p.postedAt && new Date(p.postedAt) >= today) {
        todayViews += views;
        todayPosts++;
      }
    }
  }
  return {
    totalViews,
    totalLikes,
    totalComments,
    totalShares,
    totalSaves,
    totalPosts,
    todayViews,
    todayPosts,
    engagement: calculateEngagementRate(
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      totalSaves,
    ),
    campaignNames: Array.from(campaignNames),
  };
}

function legacyClanStats(stats: Array<ReturnType<typeof legacyMemberStats>>) {
  const sum = (field: keyof ReturnType<typeof legacyMemberStats>) =>
    stats.reduce((a, m) => a + (m[field] as number), 0);
  return {
    totalViews: sum("totalViews"),
    totalPosts: sum("totalPosts"),
    totalLikes: sum("totalLikes"),
    totalComments: sum("totalComments"),
    totalShares: sum("totalShares"),
    engagement: calculateEngagementRate(
      sum("totalViews"),
      sum("totalLikes"),
      sum("totalComments"),
      sum("totalShares"),
      sum("totalSaves"),
    ),
  };
}

function legacyTopCampaigns(clanId: string) {
  const campaignMap = new Map<
    string,
    {
      id: string;
      name: string;
      coverImageUrl: string | null;
      totalViews: number;
      totalPosts: number;
    }
  >();
  for (const m of legacyMembers(clanId, "APPROVED")) {
    for (const app of m.applications) {
      if (app.campaign && app.campaign.status !== "ARCHIVED") {
        const campViews = app.clipPosts.reduce(
          (acc, p) => acc + Number(p.views ?? 0),
          0,
        );
        const existing = campaignMap.get(app.campaign.id);
        if (existing) {
          existing.totalViews += campViews;
          existing.totalPosts += app.clipPosts.length;
        } else {
          campaignMap.set(app.campaign.id, {
            id: app.campaign.id,
            name: app.campaign.name,
            coverImageUrl: app.campaign.coverImageUrl ?? null,
            totalViews: campViews,
            totalPosts: app.clipPosts.length,
          });
        }
      }
    }
  }
  return Array.from(campaignMap.values())
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, 5);
}

// ─── Testes ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  currentUser.mockResolvedValue({ id: "user-m2" });
  // O cache é do módulo: cada teste começa vazio.
  invalidateCachedQueries("");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("clan.getClanRanking", () => {
  it("dá o mesmo resultado da soma antiga em JS, com os posts somados no banco", async () => {
    const { api, db } = setup();
    const result = await api.getClanRanking();

    const activeInDbOrder = clans.filter((c) => c.isActive);
    expect(result).toEqual({ clans: legacyClanRanking(activeInDbOrder) });

    // Inscrições de qualquer status (REJECTED/WITHDRAWN contam), só ELIGIBLE,
    // clã inativo e clipador sem clã fora.
    expect(
      result.clans.map((c) => [c.tag, c.totalViews, c.totalPosts]),
    ).toEqual([
      ["ALFA", 5_700, 5],
      ["BETA", 4_200, 2],
      // Empate: mantém a ordem em que o banco devolveu os clãs.
      ["GAMA", 0, 1],
      ["DELT", 0, 0],
    ]);
    // Empate de views entre membros: mantém a ordem do banco.
    expect(result.clans[0]!.topMembers.map((m) => [m.id, m.views])).toEqual([
      ["m1", 3_800],
      ["m2", 1_900],
      ["m9", 0],
      ["m3", 0],
      ["m10", 0],
    ]);

    // Nenhum post carregado pelo Prisma: só membros e o agregado SQL.
    const findManyArgs = JSON.stringify(db.clan.findMany.mock.calls[0]![0]);
    expect(findManyArgs).not.toContain("clipPosts");
    expect(findManyArgs).not.toContain("_count");
    const [sql] = sqlCalls(db);
    expect(sql).toContain("p.status = 'ELIGIBLE'");
    expect(sql).toContain('cp."clanId" IS NOT NULL');
    expect(sql).not.toContain("a.status");
  });

  it("reaproveita o ranking por 5 minutos", async () => {
    const { api, db } = setup();
    await api.getClanRanking();
    await api.getClanRanking();
    expect(db.clan.findMany).toHaveBeenCalledOnce();
    expect(db.$queryRaw).toHaveBeenCalledOnce();

    vi.setSystemTime(new Date(NOW.getTime() + 5 * 60_000 + 1_000));
    await api.getClanRanking();
    expect(db.clan.findMany).toHaveBeenCalledTimes(2);
  });
});

describe("clan.list (admin)", () => {
  it.each(["views", "members", "name", "recent"] as const)(
    "dá o mesmo resultado da soma antiga (sortBy=%s)",
    async (sortBy) => {
      const { api, db } = setup();
      const result = await api.list({ status: "all", sortBy });

      // Mesma ordem de busca do banco (orderBy do procedimento).
      const fetched = (await db.clan.findMany.mock.results[0]!.value) as Array<{
        id: string;
      }>;
      const order = fetched.map((row) => clans.find((c) => c.id === row.id)!);
      expect(result).toEqual(legacyList(order, sortBy));
    },
  );

  it("ordena por views e por membros com desempate estável", async () => {
    const { api } = setup();
    const byViews = await api.list({ status: "all", sortBy: "views" });
    expect(byViews.map((c) => [c.tag, c.totalViews])).toEqual([
      ["ZETA", 10_000],
      ["ALFA", 5_700],
      ["BETA", 4_200],
      ["GAMA", 0],
      ["DELT", 0],
    ]);

    const byMembers = await api.list({ status: "all", sortBy: "members" });
    expect(byMembers.map((c) => [c.tag, c.memberCount])).toEqual([
      ["ALFA", 6],
      ["GAMA", 2],
      ["BETA", 2],
      ["ZETA", 1],
      ["DELT", 0],
    ]);
  });

  it("compartilha os totais por membro com o ranking", async () => {
    const { api, db } = setup();
    await api.getClanRanking();
    await api.list({ status: "active", sortBy: "views" });
    expect(db.$queryRaw).toHaveBeenCalledOnce();
  });
});

describe("clan.getByTag (admin)", () => {
  it("dá o mesmo resultado da soma antiga, só com inscrições aprovadas", async () => {
    const { api, db } = setup();
    const result = await api.getByTag({ tag: "alfa" });

    const stats = legacyMembers("clan-alfa", "APPROVED").map((m) =>
      legacyMemberStats(m, todayStart),
    );
    const legacyMembersEnriched = legacyMembers("clan-alfa", "APPROVED").map(
      (m, i) => {
        const s = stats[i]!;
        return {
          id: m.id,
          name: m.artisticName ?? m.fullName,
          fullName: m.fullName,
          discordUsername: m.discordUsername,
          imageUrl: m.user?.imageUrl ?? null,
          email: m.user?.email ?? null,
          joinedAt: m.createdAt,
          totalViews: s.totalViews,
          totalLikes: s.totalLikes,
          totalComments: s.totalComments,
          totalShares: s.totalShares,
          totalSaves: s.totalSaves,
          totalPosts: s.totalPosts,
          engagement: s.engagement,
          campaignCount: s.campaignNames.length,
          campaigns: s.campaignNames,
        };
      },
    );
    const clanStats = legacyClanStats(stats);

    expect(result.members).toEqual(legacyMembersEnriched);
    expect(result.memberCount).toBe(6);
    expect(result.pendingApplications).toBe(3);
    expect(result.stats).toEqual({
      ...clanStats,
      avgViewsPerMember: Math.round(clanStats.totalViews / 6),
      avgPostsPerMember: Math.round((clanStats.totalPosts / 6) * 10) / 10,
    });
    expect(result.stats).toMatchObject({
      totalViews: 5_000,
      totalPosts: 4,
      avgViewsPerMember: 833,
      avgPostsPerMember: 0.7,
    });
    // Campanha sem posts conta; nomes repetidos aparecem uma vez.
    expect(result.members.find((m) => m.id === "m2")!.campaigns).toEqual([
      "Competição C",
      "Competição A",
    ]);

    expect(JSON.stringify(db.clan.findUnique.mock.calls[0]![0])).not.toContain(
      "clipPosts",
    );
    const [sql] = sqlCalls(db);
    expect(sql).toContain("a.status = 'APPROVED'");
    expect(sql).toContain("p.status = 'ELIGIBLE'");
    expect(db.$queryRaw.mock.calls[0]).toContain("ALFA");
  });

  it("retorna NOT_FOUND para tag inexistente", async () => {
    const { api } = setup();
    await expect(api.getByTag({ tag: "XXXX" })).rejects.toThrow(
      "Clã não encontrado",
    );
  });
});

describe("clan.getByTagPublic", () => {
  it("dá o mesmo resultado da soma antiga, incluindo os posts de hoje", async () => {
    const { api, db } = setup();
    const result = await api.getByTagPublic({ tag: "ALFA" });

    const legacy = legacyMembers("clan-alfa", "APPROVED");
    const stats = legacy.map((m) => legacyMemberStats(m, todayStart));
    const clanStats = legacyClanStats(stats);

    expect(result.members).toEqual(
      legacy.map((m, i) => {
        const s = stats[i]!;
        return {
          id: m.id,
          name: m.artisticName ?? m.fullName,
          fullName: m.fullName,
          discordUsername: m.discordUsername,
          imageUrl: m.user?.imageUrl ?? null,
          joinedAt: m.createdAt,
          totalViews: s.totalViews,
          totalLikes: s.totalLikes,
          totalComments: s.totalComments,
          totalShares: s.totalShares,
          totalSaves: s.totalSaves,
          totalPosts: s.totalPosts,
          todayViews: s.todayViews,
          todayPosts: s.todayPosts,
          engagement: s.engagement,
        };
      }),
    );
    expect(result.stats).toEqual({
      ...clanStats,
      avgViewsPerMember: Math.round(clanStats.totalViews / 6),
    });
    expect(result.topCampaigns).toEqual(legacyTopCampaigns("clan-alfa"));
    // Arquivada fora; campanha aprovada sem posts entra com zero.
    expect(
      result.topCampaigns.map((c) => [c.id, c.totalViews, c.totalPosts]),
    ).toEqual([
      ["camp-a", 3_500, 2],
      ["camp-d", 1_200, 1],
      ["camp-c", 0, 0],
    ]);
    expect(
      result.members.map((m) => [m.id, m.todayViews, m.todayPosts]).slice(0, 2),
    ).toEqual([
      ["m2", 1_200, 1],
      ["m1", 1_000, 1],
    ]);
    expect(result).toMatchObject({
      memberCount: 6,
      isOwner: true,
      pendingApplications: 3,
    });

    // O início do dia vai como parâmetro do filtro de posts de hoje.
    const [sql] = sqlCalls(db);
    expect(sql).toContain('FILTER (WHERE p."postedAt" >= ?::timestamp)');
    expect(db.$queryRaw.mock.calls[0]).toContainEqual(todayStart);
  });

  it("não conta pendências para quem não administra o clã", async () => {
    const { api, db } = setup("m9");
    const result = await api.getByTagPublic({ tag: "ALFA" });
    expect(result).toMatchObject({ isOwner: false, pendingApplications: 0 });
    expect(db.clanApplication.count).not.toHaveBeenCalled();
  });

  it("recusa clã inativo", async () => {
    const { api } = setup();
    await expect(api.getByTagPublic({ tag: "ZETA" })).rejects.toThrow(
      "Este clã não está ativo",
    );
  });
});

describe("clan.listPublic", () => {
  it("conta membros só dos clãs listados e ordena com desempate pelo mais antigo", async () => {
    const { api, db } = setup();
    const result = await api.listPublic({});

    expect(result.map((c) => [c.tag, c.memberCount])).toEqual([
      ["ALFA", 6],
      // Empate: Beta (fev) foi criado antes de Gama (mar).
      ["BETA", 2],
      ["GAMA", 2],
      ["DELT", 0],
    ]);
    // 5 primeiros membros pela ordem do id (como o take aninhado do Prisma);
    // nome artístico vazio cai para o nome completo.
    expect(result[0]!.topMembers).toEqual([
      { id: "m1", name: "Membro m1", imageUrl: "m1.png" },
      { id: "m10", name: "Dez", imageUrl: "m10.png" },
      { id: "m11", name: "Onze", imageUrl: "m11.png" },
      { id: "m2", name: "Dois", imageUrl: "m2.png" },
      { id: "m3", name: "Três", imageUrl: null },
    ]);
    expect(result[0]!.owner).toEqual({
      id: "m1",
      name: "Membro m1",
      imageUrl: "m1.png",
    });
    expect(result[3]!.topMembers).toEqual([]);

    expect(db.clipperProfile.groupBy).toHaveBeenCalledWith({
      by: ["clanId"],
      where: {
        clanId: { in: ["clan-alfa", "clan-delt", "clan-beta", "clan-gama"] },
      },
      _count: { _all: true },
    });
    expect(JSON.stringify(db.clan.findMany.mock.calls[0]![0])).not.toContain(
      "_count",
    );
  });

  it("não consulta membros quando a busca não encontra clãs", async () => {
    const { api, db } = setup();
    expect(await api.listPublic({ search: "nada" })).toEqual([]);
    expect(db.clipperProfile.groupBy).not.toHaveBeenCalled();
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
});

describe("clan.myClan", () => {
  it("conta os membros e lê só os 10 primeiros pela ordem do id", async () => {
    const { api, db } = setup();
    const result = await api.myClan();

    expect(result).toEqual({
      clipperId: "m2",
      clan: {
        id: "clan-alfa",
        name: "Alfa",
        tag: "ALFA",
        emoji: "🔥",
        emojiColor: "#FF5733",
        imageUrl: null,
        description: "Clã Alfa",
        memberCount: 6,
        members: [
          { id: "m1", name: "Membro m1", imageUrl: "m1.png" },
          { id: "m10", name: "Dez", imageUrl: "m10.png" },
          { id: "m11", name: "Onze", imageUrl: "m11.png" },
          { id: "m2", name: "Dois", imageUrl: "m2.png" },
          { id: "m3", name: "Três", imageUrl: null },
          { id: "m9", name: "Membro m9", imageUrl: "m9.png" },
        ],
      },
    });
    expect(db.clipperProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clanId: "clan-alfa" },
        orderBy: { id: "asc" },
        take: 10,
      }),
    );
  });

  it("retorna clã nulo para quem não tem clã", async () => {
    const { api, db } = setup("m8");
    expect(await api.myClan()).toEqual({ clipperId: "m8", clan: null });
    expect(db.clipperProfile.count).not.toHaveBeenCalled();
  });
});

function setup(requesterId?: string) {
  return createDb(requesterId);
}
