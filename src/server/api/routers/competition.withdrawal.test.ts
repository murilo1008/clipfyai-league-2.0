import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const currentUser = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({
  currentUser,
  // privateProcedure autentica via auth(); deriva do mesmo mock de currentUser
  auth: async () => ({ userId: ((await currentUser()) as { id?: string } | null)?.id ?? null }),
}));
vi.mock("@/server/db", () => ({ db: {} }));

import { campaignRouter } from "./competition";
import { invalidateCachedQueries } from "@/server/memory-cache";

const now = new Date("2026-10-09T18:00:00.000Z");

function fixture() {
  const posts: Array<{ applicationId: string; status: string }> = [];
  const application = {
    id: "application-1",
    clipperProfileId: "clipper-1",
    status: "APPROVED",
    withdrawnAt: null as Date | null,
    campaign: {
      name: "Competição",
      status: "ACTIVE",
      endDate: new Date("2026-11-01T00:00:00.000Z"),
    },
    socialAccounts: [{ accountId: "account-1" }],
  };
  const db = {
    $transaction: vi.fn(),
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn().mockResolvedValue([]),
    user: {
      findUnique: vi.fn().mockResolvedValue({
        role: "CLIPPER",
        clipperProfile: { id: "clipper-1" },
      }),
    },
    clipperProfile: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: "clipper-1", user: { role: "CLIPPER" } }),
    },
    clipperApplication: {
      findUnique: vi.fn().mockImplementation(async (query) => {
        const owner = query.where.campaignId_clipperProfileId;
        return owner.clipperProfileId === application.clipperProfileId
          ? {
              ...application,
              campaign: { ...application.campaign },
              socialAccounts: [...application.socialAccounts],
            }
          : null;
      }),
      updateMany: vi.fn().mockImplementation(async ({ data }) => {
        Object.assign(application, data);
        return { count: 1 };
      }),
      delete: vi.fn(),
    },
    applicationSocialAccount: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    dailyRankingEntry: {
      updateManyAndReturn: vi.fn().mockResolvedValue([{ id: "daily-entry-1" }]),
      deleteMany: vi.fn(),
    },
    topClippersDailyRankingEntry: {
      updateManyAndReturn: vi.fn().mockResolvedValue([{ id: "top-entry-1" }]),
    },
    monthlyRankingEntry: { deleteMany: vi.fn() },
    clipPost: {
      count: vi
        .fn()
        .mockImplementation(
          async ({ where }) =>
            posts.filter((post) => post.applicationId === where.applicationId)
              .length,
        ),
      deleteMany: vi.fn(),
    },
    socialAccount: { deleteMany: vi.fn() },
    transaction: { create: vi.fn(), deleteMany: vi.fn() },
    wallet: { update: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  };
  db.$transaction.mockImplementation((callback) => callback(db));
  const api = campaignRouter.createCaller({
    db,
    headers: new Headers(),
  } as never);
  return { api, db, application, posts };
}

beforeEach(() => {
  invalidateCachedQueries("");
  // Só congela Date; os timers do middleware tRPC continuam funcionando.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  currentUser.mockResolvedValue({ id: "user-1" });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("saída voluntária da competição", () => {
  it.each(["PENDING", "ELIGIBLE", "INELIGIBLE", "DISQUALIFIED"])(
    "bloqueia a saída com vídeo %s sem alterar a inscrição, contas ou rankings",
    async (status) => {
      const { api, db, application, posts } = fixture();
      posts.push({ applicationId: application.id, status });

      await expect(
        api.leaveCompetition({ campaignId: "campaign-1" }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message:
          "Você só pode sair de uma competição se ainda não enviou nenhum vídeo.",
      });

      expect(db.clipPost.count).toHaveBeenCalledWith({
        where: { applicationId: application.id },
      });
      expect(db.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        db.clipPost.count.mock.invocationCallOrder[0]!,
      );
      expect(application.status).toBe("APPROVED");
      expect(application.withdrawnAt).toBeNull();
      for (const mutation of [
        db.clipperApplication.updateMany,
        db.applicationSocialAccount.deleteMany,
        db.dailyRankingEntry.updateManyAndReturn,
        db.topClippersDailyRankingEntry.updateManyAndReturn,
        db.clipPost.deleteMany,
        db.auditLog.create,
      ]) {
        expect(mutation).not.toHaveBeenCalled();
      }
    },
  );

  it("permite sair quando os vídeos pertencem somente a outra competição", async () => {
    const { api, db, application, posts } = fixture();
    posts.push({ applicationId: "other-application", status: "ELIGIBLE" });

    expect(
      await api.leaveCompetition({ campaignId: "campaign-1" }),
    ).toMatchObject({
      success: true,
    });
    expect(application.status).toBe("WITHDRAWN");
    expect(db.clipperApplication.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: application.id,
          clipPosts: { none: {} },
        }),
      }),
    );
  });

  it("contabiliza vídeos não elegíveis para bloquear a saída na lista de competições", async () => {
    const { api, db, application } = fixture();
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        {
          id: application.id,
          campaignId: "campaign-1",
          status: "APPROVED",
        },
      ]);
    Object.assign(db, {
      campaign: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "campaign-1",
            name: "Competição",
            slug: "competicao",
            status: "ACTIVE",
            startDate: new Date("2026-10-01T00:00:00Z"),
            endDate: application.campaign.endDate,
            prizeInfo: null,
          },
        ]),
      },
      monthlyRankingEntry: { findMany: vi.fn().mockResolvedValue([]) },
    });
    Object.assign(db.clipperApplication, {
      findMany,
      groupBy: vi.fn().mockResolvedValue([]),
    });
    // Um vídeo não elegível: conta em postedVideoCount (todos os status),
    // não em myPosts (só elegíveis).
    const clipPostGroupBy = vi.fn().mockImplementation(async ({ by, where }) =>
      by[0] === "applicationId" && !where.status
        ? [{ applicationId: application.id, _count: { id: 1 } }]
        : [],
    );
    Object.assign(db.clipPost, {
      groupBy: clipPostGroupBy,
      findMany: vi.fn().mockResolvedValue([]),
    });
    Object.assign(db.transaction, { findMany: vi.fn().mockResolvedValue([]) });

    expect(await api.getAllActiveCompetitions()).toEqual([
      expect.objectContaining({ myPosts: 0, postedVideoCount: 1 }),
    ]);
    expect(clipPostGroupBy).toHaveBeenCalledWith({
      by: ["applicationId"],
      where: { applicationId: { in: [application.id] } },
      _count: { id: true },
    });
  });

  it("mantém acesso ao histórico encerrado antes da saída", async () => {
    const { api, db, application } = fixture();
    application.status = "WITHDRAWN";
    application.withdrawnAt = now;
    const findMany = vi
      .fn()
      .mockResolvedValue([
        { rankingDate: new Date("2026-10-08T00:00:00Z"), calculatedAt: now },
      ]);
    Object.assign(db, { dailyRanking: { findMany } });
    expect(
      await api.getDailyRankingHistory({ campaignId: "campaign-1" }),
    ).toHaveLength(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          campaignId: "campaign-1",
          rankingDate: { lt: new Date("2026-10-09T00:00:00Z") },
        },
      }),
    );
  });

  it("não expõe os rankings de períodos posteriores à saída", async () => {
    const { api, application } = fixture();
    application.status = "WITHDRAWN";
    application.withdrawnAt = now;
    await expect(
      api.getDailyRankingByDate({
        campaignId: "campaign-1",
        date: "2026-10-09",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("permite consultar o ranking de um período encerrado antes da saída", async () => {
    const { api, db, application } = fixture();
    application.status = "WITHDRAWN";
    application.withdrawnAt = now;
    Object.assign(db, {
      campaign: {
        findUnique: vi.fn().mockResolvedValue({
          id: "campaign-1",
          startDate: new Date("2026-10-01T00:00:00Z"),
          rankingMetricType: "VIEWS",
          activeRankingRule: null,
        }),
      },
      dailyRanking: { findFirst: vi.fn().mockResolvedValue(null) },
      clipPost: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
    });
    expect(
      await api.getDailyRankingByDate({
        campaignId: "campaign-1",
        date: "2026-10-08",
      }),
    ).toMatchObject({ date: "2026-10-08", posts: [] });
  });

  it("deixa o admin ver o histórico e o ranking de qualquer dia sem inscrição", async () => {
    const { api, db } = fixture();
    db.user.findUnique.mockResolvedValue({ role: "ADMIN", clipperProfile: null });
    const findMany = vi
      .fn()
      .mockResolvedValue([
        { rankingDate: new Date("2026-10-09T00:00:00Z"), calculatedAt: now },
      ]);
    Object.assign(db, {
      dailyRanking: { findMany, findFirst: vi.fn().mockResolvedValue(null) },
      campaign: {
        findUnique: vi.fn().mockResolvedValue({
          id: "campaign-1",
          startDate: new Date("2026-10-01T00:00:00Z"),
          rankingMetricType: "VIEWS",
          activeRankingRule: null,
        }),
      },
      clipPost: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
    });

    expect(
      await api.getDailyRankingHistory({ campaignId: "campaign-1" }),
    ).toHaveLength(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { campaignId: "campaign-1" } }),
    );
    expect(
      await api.getDailyRankingByDate({
        campaignId: "campaign-1",
        date: "2026-10-09",
      }),
    ).toMatchObject({ date: "2026-10-09", posts: [] });
    expect(db.clipperApplication.findUnique).not.toHaveBeenCalled();
  });

  it("continua bloqueando o ranking para clipador sem inscrição", async () => {
    const { api, db } = fixture();
    db.user.findUnique.mockResolvedValue({
      role: "CLIPPER",
      clipperProfile: { id: "clipper-2" },
    });
    await expect(
      api.getDailyRankingHistory({ campaignId: "campaign-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it.each(["PENDING", "UNDER_REVIEW", "APPROVED"])(
    "permite sair de uma inscrição %s preservando dados e saldo",
    async (status) => {
      const { api, db, application } = fixture();
      application.status = status;
      const result = await api.leaveCompetition({ campaignId: "campaign-1" });
      expect(result.success).toBe(true);
      expect(application.status).toBe("WITHDRAWN");
      expect(application.withdrawnAt).toEqual(now);
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-1",
            changes: expect.objectContaining({
              previousStatus: status,
              socialAccountIds: ["account-1"],
            }),
          }),
        }),
      );
      expect(db.applicationSocialAccount.deleteMany).toHaveBeenCalledWith({
        where: { applicationId: application.id },
      });
      for (const deleteMany of [
        db.clipPost.deleteMany,
        db.socialAccount.deleteMany,
        db.monthlyRankingEntry.deleteMany,
        db.dailyRankingEntry.deleteMany,
        db.transaction.deleteMany,
      ]) {
        expect(deleteMany).not.toHaveBeenCalled();
      }
      expect(db.clipperApplication.delete).not.toHaveBeenCalled();
      expect(db.wallet.update).not.toHaveBeenCalled();
      expect(db.transaction.create).not.toHaveBeenCalled();
    },
  );

  it("repetir a saída não duplica a auditoria", async () => {
    const { api, db } = fixture();
    await api.leaveCompetition({ campaignId: "campaign-1" });
    await api.leaveCompetition({ campaignId: "campaign-1" });
    expect(db.clipperApplication.updateMany).toHaveBeenCalledTimes(1);
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("não permite sair usando a inscrição de outro usuário", async () => {
    const { api, db } = fixture();
    db.clipperProfile.findUnique.mockResolvedValue({
      id: "clipper-2",
      user: { role: "CLIPPER" },
    });
    await expect(
      api.leaveCompetition({ campaignId: "campaign-1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.clipperApplication.updateMany).not.toHaveBeenCalled();
  });

  it("restringe a operação aos clipadores", async () => {
    const { api, db } = fixture();
    db.clipperProfile.findUnique.mockResolvedValue({
      id: "clipper-1",
      user: { role: "ADMIN" },
    });
    await expect(
      api.leaveCompetition({ campaignId: "campaign-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.clipperApplication.updateMany).not.toHaveBeenCalled();
  });

  it.each(["REJECTED", "REVOKED"])(
    "não transforma %s em desistência",
    async (status) => {
      const { api, db, application } = fixture();
      application.status = status;
      await expect(
        api.leaveCompetition({ campaignId: "campaign-1" }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(db.clipperApplication.updateMany).not.toHaveBeenCalled();
    },
  );

  it.each(["COMPLETED", "ARCHIVED", "DRAFT"])(
    "impede saída de competição %s",
    async (status) => {
      const { api, db, application } = fixture();
      application.campaign.status = status;
      await expect(
        api.leaveCompetition({ campaignId: "campaign-1" }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(db.clipperApplication.updateMany).not.toHaveBeenCalled();
    },
  );

  it("respeita o término mesmo quando a campanha continua marcada como ACTIVE", async () => {
    const { api, db, application } = fixture();
    application.campaign.endDate = now;
    await expect(
      api.leaveCompetition({ campaignId: "campaign-1" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.clipperApplication.updateMany).not.toHaveBeenCalled();
  });

  it("não desvincula contas quando o estado mudou durante a operação", async () => {
    const { api, db } = fixture();
    db.clipperApplication.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      api.leaveCompetition({ campaignId: "campaign-1" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.applicationSocialAccount.deleteMany).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it.each([
    ["2026-10-09T19:59:59.999Z", "2026-10-09T00:00:00.000Z"],
    ["2026-10-09T20:00:00.000Z", "2026-10-10T00:00:00.000Z"],
  ])(
    "preserva rankings encerrados e pagos na saída em %s",
    async (at, firstOpen) => {
      vi.setSystemTime(new Date(at));
      const { api, db } = fixture();
      await api.leaveCompetition({ campaignId: "campaign-1" });
      expect(db.dailyRankingEntry.updateManyAndReturn).toHaveBeenCalledWith({
        where: {
          applicationId: "application-1",
          isDisqualified: false,
          dailyRanking: { rankingDate: { gte: new Date(firstOpen) } },
          dailyPrizeStatus: { not: "PAID" },
          dailyPrizePaid: false,
        },
        data: { isDisqualified: true },
        select: { id: true },
      });
      expect(
        db.topClippersDailyRankingEntry.updateManyAndReturn,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ranking: { rankingDate: { gte: new Date(firstOpen) } },
            prizeStatus: { not: "PAID" },
          }),
        }),
      );
    },
  );

  it("bloqueia reinscrição após o início da competição", async () => {
    const { api, db, application } = fixture();
    application.status = "WITHDRAWN";
    Object.assign(db, {
      campaign: {
        findUnique: vi.fn().mockResolvedValue({
          isPrivate: false,
          isProOnly: false,
          status: "ACTIVE",
          startDate: now,
          endDate: application.campaign.endDate,
        }),
      },
    });
    await expect(
      api.enrollInCompetition({
        campaignId: "campaign-1",
        socialAccountIds: ["account-1"],
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("antes do início"),
    });
  });

  it("bloqueia detalhes e materiais de uma competição após a saída", async () => {
    const { api, db, application } = fixture();
    application.status = "WITHDRAWN";
    Object.assign(db, {
      campaign: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: "campaign-1", status: "ACTIVE" }),
      },
    });
    await expect(
      api.getCompetitionDetails({ slug: "competicao" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("ranking diário: cache, ADMIN e datas aceitas", () => {
  const campaignStart = new Date("2026-10-01T03:00:00Z");

  function rankingFixture() {
    const setup = fixture();
    const dailyRankingFindFirst = vi.fn().mockResolvedValue(null);
    const clipPostGroupBy = vi.fn().mockResolvedValue([]);
    Object.assign(setup.db, {
      dailyRanking: { findFirst: dailyRankingFindFirst },
      campaign: {
        findUnique: vi.fn().mockResolvedValue({
          id: "campaign-1",
          name: "Competição",
          startDate: campaignStart,
          rankingMetricType: "VIEWS",
          activeRankingRule: null,
          topClippersRankingEnabled: true,
          topClippersPrizeTable: null,
        }),
      },
      clipPost: {
        count: vi.fn().mockResolvedValue(0),
        groupBy: clipPostGroupBy,
      },
      topClippersDailyRankingEntry: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    });
    return { ...setup, dailyRankingFindFirst, clipPostGroupBy };
  }

  it("clipador usa o cache do dia; ADMIN lê direto do banco", async () => {
    const { api, db } = rankingFixture();
    const input = { campaignId: "campaign-1", date: "2026-10-08" };

    await api.getDailyRankingByDate(input);
    await api.getDailyRankingByDate(input);
    // Ranking ao vivo (SQL) calculado uma vez para os clipadores.
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);

    db.user.findUnique.mockResolvedValue({ role: "ADMIN", clipperProfile: null });
    await api.getDailyRankingByDate(input);
    await api.getDailyRankingByDate(input);
    expect(db.$queryRaw).toHaveBeenCalledTimes(3);
  });

  it("Top Clipadores: clipador usa o cache do dia; ADMIN lê direto do banco", async () => {
    const { api, db, clipPostGroupBy } = rankingFixture();
    const input = { campaignId: "campaign-1", date: "2026-10-08" };

    await api.getDailyTopClippersByPostedVideos(input);
    await api.getDailyTopClippersByPostedVideos(input);
    expect(clipPostGroupBy).toHaveBeenCalledTimes(1);

    db.user.findUnique.mockResolvedValue({ role: "ADMIN", clipperProfile: null });
    await api.getDailyTopClippersByPostedVideos(input);
    await api.getDailyTopClippersByPostedVideos(input);
    expect(clipPostGroupBy).toHaveBeenCalledTimes(3);
  });

  it("fora dos dias possíveis da campanha devolve o ranking vazio sem consultar", async () => {
    const { api, db, dailyRankingFindFirst, clipPostGroupBy } = rankingFixture();

    // Antes do dia anterior ao início e depois de amanhã (agora: 2026-10-09).
    for (const date of ["2026-09-29", "2026-10-11"]) {
      expect(
        await api.getDailyRankingByDate({ campaignId: "campaign-1", date }),
      ).toEqual({
        date,
        source: "LIVE",
        rankingMode: "TOP_POSTS",
        posts: [],
        totalPosts: 0,
        windowStart: new Date(
          Date.parse(`${date}T20:00:00Z`) - 24 * 60 * 60 * 1000,
        ).toISOString(),
        windowEnd: `${date}T20:00:00.000Z`,
      });
      expect(
        await api.getDailyTopClippersByPostedVideos({ campaignId: "campaign-1", date }),
      ).toMatchObject({
        date,
        entries: [],
        stats: {
          totalPostsInWindow: 0,
          totalViewsInWindow: 0,
          totalClippersWithPosts: 0,
          totalCampaigns: 1,
        },
      });
    }
    expect(db.$queryRaw).not.toHaveBeenCalled();
    expect(dailyRankingFindFirst).not.toHaveBeenCalled();
    expect(clipPostGroupBy).not.toHaveBeenCalled();
    expect(db.clipPost.count).not.toHaveBeenCalled();

    // Os limites ainda consultam: dia anterior ao início e amanhã.
    await api.getDailyRankingByDate({ campaignId: "campaign-1", date: "2026-09-30" });
    await api.getDailyRankingByDate({ campaignId: "campaign-1", date: "2026-10-10" });
    expect(db.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it("recusa datas que não existem no calendário", async () => {
    const { api } = rankingFixture();
    await expect(
      api.getDailyRankingByDate({ campaignId: "campaign-1", date: "2026-02-31" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      api.getDailyTopClippersByPostedVideos({
        campaignId: "campaign-1",
        date: "2026-13-01",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
