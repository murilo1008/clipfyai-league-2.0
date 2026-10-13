import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => vi.fn());

vi.mock("@clerk/nextjs/server", () => ({
  auth,
  currentUser: vi.fn(),
}));
vi.mock("@/server/db", () => ({ db: {} }));

import { videoDownloadsRouter } from "./video-downloads";

function setup() {
  const campaigns = [
    { id: "c1", name: "A", slug: "a", status: "ACTIVE", downloadVideos: true },
    { id: "c2", name: "B", slug: "b", status: "ACTIVE", downloadVideos: true },
  ];
  const db = {
    campaign: {
      findMany: vi.fn().mockResolvedValue(campaigns),
      findFirst: vi.fn().mockResolvedValue({ id: "c1" }),
    },
    clipPost: {
      groupBy: vi
        .fn()
        .mockResolvedValue([{ campaignId: "c1", _count: { _all: 40 } }]),
    },
    clipPostBucketVideo: {
      groupBy: vi.fn().mockResolvedValue([
        { campaignId: "c1", _count: { _all: 3 } },
        { campaignId: "c2", _count: { _all: 1 } },
      ]),
      findMany: vi
        .fn()
        .mockResolvedValue([{ clipPostId: "p1", status: "SUCCEEDED" }]),
    },
  };
  const api = videoDownloadsRouter.createCaller({
    db,
    headers: new Headers(),
  } as never);
  return { api, db };
}

describe("videoDownloads.client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.mockResolvedValue({ userId: "client-1" });
  });

  it("conta posts e downloads só das competições listadas", async () => {
    const { api, db } = setup();

    const campaigns = await api.client.campaigns();

    expect(db.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          clientId: "client-1",
          downloadVideos: true,
          status: { not: "ARCHIVED" },
        },
      }),
    );
    expect(db.clipPost.groupBy).toHaveBeenCalledWith({
      by: ["campaignId"],
      where: { campaignId: { in: ["c1", "c2"] } },
      _count: { _all: true },
    });
    expect(campaigns.map((campaign) => campaign._count)).toEqual([
      { clipPosts: 40, bucketVideos: 3 },
      { clipPosts: 0, bucketVideos: 1 },
    ]);
  });

  it("status em andamento: só da competição do cliente", async () => {
    const { api, db } = setup();

    const statuses = await api.client.statuses({
      campaignId: "c1",
      clipPostIds: ["p1"],
    });

    expect(db.campaign.findFirst).toHaveBeenCalledWith({
      where: { id: "c1", downloadVideos: true, clientId: "client-1" },
      select: { id: true },
    });
    expect(db.clipPostBucketVideo.findMany).toHaveBeenCalledWith({
      // Pela competição do post: o download não acompanha um post movido
      where: { clipPostId: { in: ["p1"] }, clipPost: { campaignId: "c1" } },
      select: { clipPostId: true, status: true },
    });
    expect(statuses).toEqual([{ clipPostId: "p1", status: "SUCCEEDED" }]);

    db.campaign.findFirst.mockResolvedValueOnce(null);
    await expect(
      api.client.statuses({ campaignId: "c-outro", clipPostIds: ["p9"] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
