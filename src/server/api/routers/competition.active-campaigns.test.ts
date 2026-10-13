import { beforeEach, describe, expect, it, vi } from "vitest";

const currentUser = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({
  currentUser,
  auth: async () => ({ userId: ((await currentUser()) as { id?: string } | null)?.id ?? null }),
}));
vi.mock("@/server/db", () => ({ db: {} }));

import { campaignRouter } from "./competition";
import { invalidateCachedQueries } from "@/server/memory-cache";

function campaign(id: string, startDate: string, isPrivate = false) {
  return {
    id,
    name: `Competição ${id}`,
    slug: id,
    description: null,
    status: "ACTIVE",
    startDate: new Date(startDate),
    endDate: new Date("2026-12-01T00:00:00Z"),
    platforms: [],
    requiredHashtags: [],
    coverImageUrl: null,
    prizeInfo: { total: "R$ 1.000" },
    rankingMetricType: "VIEWS",
    isProOnly: false,
    isPrivate,
    organization: { id: "org", name: "Org", logoUrl: null },
  };
}

function fixture() {
  const campaigns = [
    campaign("a", "2026-10-01T00:00:00Z"),
    campaign("private", "2026-10-02T00:00:00Z", true),
    campaign("b", "2026-10-03T00:00:00Z"),
  ];
  const db = {
    clipperProfile: {
      findUnique: vi.fn().mockImplementation(async ({ where }) =>
        where.userId === "user-1" ? { id: "clipper-1" } : { id: "clipper-2" },
      ),
    },
    campaign: { findMany: vi.fn().mockResolvedValue(campaigns) },
    clipperApplication: {
      findMany: vi.fn().mockImplementation(async ({ where }) => {
        if (where.campaign?.isPrivate) {
          return where.clipperProfileId === "clipper-1"
            ? [{ campaignId: "private" }]
            : [];
        }
        return [{ id: "app-b", campaignId: "b", status: "APPROVED" }];
      }),
      groupBy: vi.fn().mockResolvedValue([
        { campaignId: "a", _count: { id: 3 } },
        { campaignId: "b", _count: { id: 7 } },
      ]),
    },
    clipPost: {
      groupBy: vi.fn().mockImplementation(async ({ by, where }) => {
        if (by[0] === "campaignId") return [{ campaignId: "b", _count: { id: 12 } }];
        if (!where.status) return [{ applicationId: "app-b", _count: { id: 4 } }];
        return [
          {
            applicationId: "app-b",
            _count: { id: 3, postedAt: 2 },
            _sum: { views: 900n, likes: 9, comments: 0, shares: 0, saves: null },
            _max: { postedAt: new Date("2026-10-05T00:00:00Z") },
          },
        ];
      }),
    },
    monthlyRankingEntry: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ applicationId: "app-b", position: 2, previousPosition: 5 }]),
    },
    transaction: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { db, api: campaignRouter.createCaller({ db, headers: new Headers() } as never) };
}

beforeEach(() => {
  invalidateCachedQueries("");
  currentUser.mockResolvedValue({ id: "user-1" });
});

describe("competições ativas compartilhadas entre usuários", () => {
  it("filtra privadas por inscrição depois do cache", async () => {
    const { api, db } = fixture();
    const forEnrolled = await api.getScheduled();
    currentUser.mockResolvedValue({ id: "user-2" });
    const forOther = await api.getScheduled();

    expect(forEnrolled.map((c) => c.id)).toEqual(["a", "private", "b"]);
    expect(forOther.map((c) => c.id)).toEqual(["a", "b"]);
    expect(forOther.map((c) => c.estimatedParticipants)).toEqual([3, 7]);
    expect(forOther[0]).toMatchObject({
      prize: "R$ 1.000",
      registrationOpen: true,
      organizerName: "Org",
    });
    expect(db.campaign.findMany).toHaveBeenCalledTimes(1);
  });

  it("agrega meus posts por inscrição sem carregar os posts", async () => {
    const { api } = fixture();
    const result = await api.getAllActiveCompetitions();
    // Mais recente primeiro
    expect(result.map((c) => c.id)).toEqual(["b", "private", "a"]);
    expect(result[0]).toMatchObject({
      totalParticipants: 7,
      totalPosts: 12,
      myPosts: 3,
      postedVideoCount: 4,
      myTotalViews: 900,
      myEngagementRate: 1,
      myRanking: 2,
      myPreviousRanking: 5,
      applicationStatus: "APPROVED",
      // Há post elegível sem postedAt: o "último post" (DESC, NULLS FIRST) não tem data
      lastPostDate: undefined,
    });
    expect(result[2]).toMatchObject({ myPosts: 0, applicationStatus: null });
  });
});
