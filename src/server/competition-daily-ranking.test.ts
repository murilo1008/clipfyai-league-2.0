import { RankingMetricType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { calculateRankingScore } from "@/lib/ranking-helpers";
import {
  dailyRankingCacheTtlMs,
  getCachedLiveDailyRanking,
  loadDailyTopClippersByPostedVideos,
  loadLiveDailyRanking,
  withCurrentUser,
  type SharedDailyRankingItem,
} from "./competition-daily-ranking";
import { invalidateCachedQueries } from "./memory-cache";

/** Monta o SQL final (com os fragmentos Prisma.sql embutidos) para inspeção. */
function renderSql(call: unknown[]): { text: string; values: unknown[] } {
  const strings = call[0] as TemplateStringsArray;
  const values: unknown[] = [];
  let text = "";
  strings.forEach((part, index) => {
    text += part;
    if (index < call.length - 1) {
      const value = call[index + 1] as { strings?: string[]; values?: unknown[] };
      if (value && typeof value === "object" && Array.isArray(value.strings)) {
        // Prisma.Sql: texto com placeholders e valores próprios
        text += value.strings.join("?");
        values.push(...(value.values ?? []));
      } else {
        text += "?";
        values.push(value);
      }
    }
  });
  return { text, values };
}

function liveRow(
  id: string,
  metrics: { views: number; likes: number; comments?: number; shares?: number },
  userId = `user-${id}`,
) {
  return {
    id,
    username: `@${id}`,
    platform: "TIKTOK",
    thumbnailUrl: null,
    postedAt: new Date("2026-10-09T10:00:00Z"),
    views: BigInt(metrics.views),
    likes: metrics.likes,
    comments: metrics.comments ?? 0,
    shares: metrics.shares ?? 0,
    saves: null,
    userId,
    fullName: `Nome Completo ${id}`,
    artisticName: null,
    imageUrl: null,
    clanTag: null,
    clanEmoji: null,
    clanEmojiColor: null,
  };
}

beforeEach(() => {
  invalidateCachedQueries("");
});

describe("ranking diário ao vivo (SQL)", () => {
  it("usa ClipPost, limita ao top + folga e aplica o ranking final em JS", async () => {
    const db = {
      $queryRaw: vi.fn().mockResolvedValue([
        liveRow("b", { views: 1000, likes: 10 }),
        liveRow("a", { views: 1000, likes: 50 }),
        liveRow("c", { views: 50, likes: 0 }),
      ]),
    };

    const ranked = await loadLiveDailyRanking(db as never, {
      campaignId: "campaign-1",
      dateYmd: "2026-10-09",
      metricType: RankingMetricType.VIEWS_X_ENGAGEMENT,
      topCount: 2,
      dailyPrizeTable: { "1": 100, "2": 50 },
      entriesDailyRankingId: null,
    });

    const { text, values } = renderSql(db.$queryRaw.mock.calls[0]!);
    expect(text).toContain('FROM "ClipPost" cp');
    expect(text).not.toContain('"DailyRankingEntry"');
    expect(text).toContain('ORDER BY "score" DESC, m."views" DESC, m."id" ASC');
    expect(text).toContain("LIMIT ?");
    expect(values).toContain(12); // topCount (2) + folga (10)
    expect(values).toContainEqual(new Date("2026-10-09T20:00:00Z"));

    // Score = views × ER% (igual ao calculateRankingScore); empate → views.
    expect(ranked.map((item) => item.postId)).toEqual(["a", "b"]);
    expect(ranked[0]).toMatchObject({
      position: 1,
      rankingScore: calculateRankingScore("VIEWS_X_ENGAGEMENT", 1000, 50, 0, 0),
      prize: 100,
      clipperName: "Nome",
      ownerUserId: "user-a",
    });
    expect(ranked[0]).not.toHaveProperty("isCurrentUser");
  });

  it("com DailyRanking do dia usa as métricas diárias das entradas", async () => {
    const db = { $queryRaw: vi.fn().mockResolvedValue([]) };
    await loadLiveDailyRanking(db as never, {
      campaignId: "campaign-1",
      dateYmd: "2026-10-09",
      metricType: RankingMetricType.VIEWS,
      topCount: 15,
      dailyPrizeTable: null,
      entriesDailyRankingId: "daily-1",
    });
    const { text, values } = renderSql(db.$queryRaw.mock.calls[0]!);
    expect(text).toContain('INNER JOIN "DailyRankingEntry" dre');
    expect(text).toContain('dre."dailyViews" AS "views"');
    expect(text).toContain('m."views"::float8');
    expect(values).toContain("daily-1");
  });

  it("aplica isCurrentUser depois do cache, mantendo a ordem dos campos", async () => {
    const db = {
      $queryRaw: vi
        .fn()
        .mockResolvedValue([
          liveRow("a", { views: 10, likes: 1 }, "user-1"),
          liveRow("b", { views: 5, likes: 1 }, "user-2"),
        ]),
    };
    const params = {
      campaignId: "campaign-1",
      dateYmd: "2026-10-09",
      metricType: RankingMetricType.VIEWS,
      topCount: 15,
      dailyPrizeTable: null,
      entriesDailyRankingId: null,
    };
    const first = await getCachedLiveDailyRanking(db as never, params);
    const second = await getCachedLiveDailyRanking(db as never, params);
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);

    const forUser1 = withCurrentUser(first, "user-1");
    const forUser2 = withCurrentUser(first, "user-2");
    expect(forUser1.map((item) => item.isCurrentUser)).toEqual([true, false]);
    expect(forUser2.map((item) => item.isCurrentUser)).toEqual([false, true]);
    expect(Object.keys(forUser1[0]!)).toEqual([
      "position",
      "postId",
      "clipperName",
      "clipperImageUrl",
      "username",
      "platform",
      "thumbnailUrl",
      "views",
      "likes",
      "comments",
      "shares",
      "saves",
      "postedAt",
      "isCurrentUser",
      "engagementRate",
      "rankingScore",
      "prize",
      "clanTag",
      "clanEmoji",
      "clanEmojiColor",
    ]);
  });

  it("nunca marca como atual um item sem dono", () => {
    const item = { ownerUserId: null } as unknown as SharedDailyRankingItem;
    expect(withCurrentUser([item], "")[0]?.isCurrentUser).toBe(false);
  });
});

describe("Top Clipadores do dia", () => {
  it("ordena por vídeos, depois views, depois id do perfil e só hidrata o top", async () => {
    const groups = [
      { applicationId: "app-z", _count: { id: 3 }, _sum: { views: 10n } },
      { applicationId: "app-a", _count: { id: 3 }, _sum: { views: 10n } },
      { applicationId: "app-b", _count: { id: 3 }, _sum: { views: 99n } },
      { applicationId: "app-c", _count: { id: 5 }, _sum: { views: 1n } },
      { applicationId: "app-d", _count: { id: 1 }, _sum: { views: 1000n } },
    ];
    const profileFindMany = vi.fn().mockImplementation(async ({ where }) =>
      (where.id.in as string[]).map((id) => ({
        id,
        fullName: `Fulano ${id}`,
        artisticName: id === "profile-c" ? "Artista" : null,
        userId: `user-${id}`,
        user: { imageUrl: null },
      })),
    );
    const db = {
      topClippersDailyRankingEntry: {
        findMany: vi.fn().mockResolvedValue([{ applicationId: "app-x" }]),
      },
      clipPost: { groupBy: vi.fn().mockResolvedValue(groups) },
      clipperApplication: {
        findMany: vi.fn().mockResolvedValue(
          groups.map((group) => ({
            id: group.applicationId,
            clipperProfileId: group.applicationId.replace("app", "profile"),
          })),
        ),
      },
      clipperProfile: { findMany: profileFindMany },
      campaign: {
        findUnique: vi.fn().mockResolvedValue({ name: "Competição" }),
      },
    };

    const result = await loadDailyTopClippersByPostedVideos(db as never, {
      campaignId: "campaign-1",
      date: "2026-10-09",
      limit: 4,
    });

    expect(result.entries.map((entry) => entry.clipperProfileId)).toEqual([
      "profile-c",
      "profile-b",
      "profile-a",
      "profile-z",
    ]);
    expect(result.entries[0]).toMatchObject({
      clipperName: "Artista",
      fullName: "Fulano",
      ownerUserId: "user-profile-c",
      totalPosts: 5,
      totalViews: 1,
      campaigns: [
        { campaignId: "campaign-1", campaignName: "Competição", posts: 5, views: 1 },
      ],
    });
    expect(result.stats).toEqual({
      totalPostsInWindow: 15,
      totalViewsInWindow: 1120,
      totalClippersWithPosts: 5,
      totalCampaigns: 1,
    });
    expect(profileFindMany.mock.calls[0]?.[0].where.id.in).toHaveLength(4);
    const groupWhere = db.clipPost.groupBy.mock.calls[0]?.[0].where;
    expect(groupWhere).toMatchObject({
      campaignId: "campaign-1",
      status: "ELIGIBLE",
      applicationId: { notIn: ["app-x"] },
      postedAt: {
        gte: new Date("2026-10-08T20:00:00Z"),
        lt: new Date("2026-10-09T20:00:00Z"),
      },
    });
    expect(groupWhere.application).toEqual({
      OR: [
        { status: "APPROVED" },
        {
          status: "WITHDRAWN",
          withdrawnAt: { gte: new Date("2026-10-09T20:00:00Z") },
        },
      ],
    });
  });

  it("sem posts não hidrata perfis", async () => {
    const db = {
      topClippersDailyRankingEntry: { findMany: vi.fn().mockResolvedValue([]) },
      clipPost: { groupBy: vi.fn().mockResolvedValue([]) },
      clipperApplication: { findMany: vi.fn() },
      clipperProfile: { findMany: vi.fn() },
      campaign: { findUnique: vi.fn() },
    };
    const result = await loadDailyTopClippersByPostedVideos(db as never, {
      campaignId: "campaign-1",
      date: "2026-10-09",
      limit: 50,
    });
    expect(result.entries).toEqual([]);
    expect(result.stats.totalClippersWithPosts).toBe(0);
    expect(db.clipperProfile.findMany).not.toHaveBeenCalled();
  });
});

describe("TTL do cache por dia de ranking", () => {
  const closesAt = new Date("2026-10-09T20:00:00Z").getTime();
  it.each([
    [closesAt - 1, 60 * 1000],
    [closesAt, 5 * 60 * 1000],
    [closesAt + 47 * 60 * 60 * 1000, 5 * 60 * 1000],
    [closesAt + 48 * 60 * 60 * 1000, 6 * 60 * 60 * 1000],
  ])("em %s usa %s ms", (now, expected) => {
    expect(dailyRankingCacheTtlMs("2026-10-09", now)).toBe(expected);
  });
});
