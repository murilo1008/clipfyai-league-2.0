import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const currentUser = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({
  currentUser,
  // privateProcedure autentica via auth(); deriva do mesmo mock de currentUser
  auth: async () => ({ userId: ((await currentUser()) as { id?: string } | null)?.id ?? null }),
}));
vi.mock("@/server/db", () => ({ db: {} }));
vi.mock("@/env", () => ({ env: {} }));
vi.mock("@/lib/monthly-ranking-leaderboard", () => ({
  computeMonthlyLeaderboard: vi.fn().mockResolvedValue({
    monthlyPrizeTable: { "1": 100 },
    monthPeriod: "outubro",
    rows: [
      {
        position: 1,
        clipperProfileId: "clipper-1",
        clipperUsername: "clipador",
        clipperName: "Clipador",
      },
    ],
  }),
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: vi.fn() };
  },
}));

import { clipperRouter } from "./clipper";
import { adminRouter } from "./admin";

function fixture() {
  const application = {
    id: "application-1",
    clipperProfileId: "clipper-1",
    status: "APPROVED",
    campaign: {
      id: "campaign-1",
      name: "Competição",
      status: "ACTIVE",
      endDate: new Date("2099-01-01T00:00:00Z"),
      platforms: ["YOUTUBE"],
      requiredHashtags: [],
    },
    clipperProfile: {
      fullName: "Clipador",
      user: { email: "clipper@example.com" },
    },
  };
  const db = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    $transaction: vi.fn(),
    user: { findUnique: vi.fn().mockResolvedValue({ role: "ADMIN" }) },
    campaign: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: "campaign-1", name: "Competição" }),
    },
    clipperProfile: {
      findUnique: vi.fn().mockResolvedValue({ id: "clipper-1" }),
    },
    clipperApplication: {
      findUnique: vi.fn().mockResolvedValue(application),
      findMany: vi.fn().mockResolvedValue([application]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    socialAccount: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: "account-1", platform: "YOUTUBE", username: "clipador" },
        ]),
    },
    applicationSocialAccount: { create: vi.fn() },
    clipPost: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      createManyAndReturn: vi.fn().mockResolvedValue([{ id: "post-1" }]),
    },
    monthlyRanking: { findMany: vi.fn() },
    wallet: { findUnique: vi.fn(), update: vi.fn() },
    transaction: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    },
    dailyRankingEntry: {
      findUnique: vi.fn().mockResolvedValue({
        id: "entry-1",
        applicationId: application.id,
        isDisqualified: true,
        dailyRanking: {
          rankingDate: new Date("2026-10-09T00:00:00Z"),
          campaign: { id: "campaign-1" },
        },
        clipPost: { status: "ELIGIBLE" },
      }),
      update: vi.fn(),
    },
    topClippersDailyRankingEntry: {
      findUnique: vi.fn().mockResolvedValue({
        id: "entry-1",
        applicationId: application.id,
        prizeStatus: "PENDING",
        transactionId: null,
        ranking: {
          campaignId: "campaign-1",
          rankingDate: new Date("2026-10-09T00:00:00Z"),
        },
      }),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  };
  db.$transaction.mockImplementation((callback) => callback(db));
  const context = { db, headers: new Headers() } as never;
  return {
    db,
    application,
    clipper: clipperRouter.createCaller(context),
    admin: adminRouter.createCaller(context),
  };
}

const postInput = {
  campaignId: "campaign-1",
  posts: [
    {
      accountId: "account-1",
      url: "https://www.youtube.com/shorts/abcdefghijk",
    },
  ],
};

beforeEach(() => {
  currentUser.mockResolvedValue({ id: "user-1" });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("ações após a saída", () => {
  it("informa todos os vídeos enviados em minhas inscrições para validar a saída", async () => {
    const { clipper, db, application } = fixture();
    // Contagem de todos os status (inclusive não elegíveis), só das inscrições do clipador
    const groupBy = vi
      .fn()
      .mockResolvedValue([{ applicationId: application.id, _count: { id: 2 } }]);
    Object.assign(db.clipPost, { groupBy });

    const result = await clipper.getMyApplications();

    expect(result).toEqual([
      expect.objectContaining({ id: application.id, postedVideoCount: 2 }),
    ]);
    expect(groupBy).toHaveBeenCalledWith({
      by: ["applicationId"],
      where: { applicationId: { in: [application.id] } },
      _count: { id: true },
    });
  });

  it("não credita um prêmio mensal se o clipador sair depois da consulta do ranking", async () => {
    const { admin, db } = fixture();
    const result = await admin.payMonthlyRankByPeriod({
      campaignId: "campaign-1",
      dryRun: false,
    });
    expect(result.paid).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(db.wallet.update).not.toHaveBeenCalled();
    expect(db.transaction.create).not.toHaveBeenCalled();
  });

  it("não restaura a elegibilidade diária de quem saiu durante o período", async () => {
    const { admin, db } = fixture();
    await expect(
      admin.undoDisqualifyDailyRankingEntry({ dailyRankingEntryId: "entry-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.dailyRankingEntry.update).not.toHaveBeenCalled();
  });

  it("não restaura a elegibilidade do Top Clipadores de quem saiu durante o período", async () => {
    const { admin, db } = fixture();
    await expect(
      admin.undoDisqualifyTopClippersDailyRankingEntry({
        rankingEntryId: "entry-1",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.topClippersDailyRankingEntry.update).not.toHaveBeenCalled();
  });

  it("não aceita novos posts de uma inscrição retirada", async () => {
    const { clipper, db, application } = fixture();
    application.status = "WITHDRAWN";
    await expect(clipper.submitPosts(postInput)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.clipPost.createManyAndReturn).not.toHaveBeenCalled();
  });

  it("revalida a inscrição sob lock antes de gravar posts", async () => {
    const { clipper, db, application } = fixture();
    db.clipperApplication.findUnique
      .mockResolvedValueOnce(application)
      .mockResolvedValue({ ...application, status: "WITHDRAWN" });
    await expect(clipper.submitPosts(postInput)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.$executeRaw).toHaveBeenCalled();
    expect(db.clipPost.createManyAndReturn).not.toHaveBeenCalled();
  });

  it("continua aceitando posts de quem permanece aprovado", async () => {
    const { clipper, db } = fixture();
    expect(await clipper.submitPosts(postInput)).toMatchObject({
      success: true,
      postsCreated: 1,
    });
    expect(db.clipPost.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(db.clipPost.createManyAndReturn.mock.calls[0]?.[0].data).toEqual([
      expect.objectContaining({
        campaignId: "campaign-1",
        applicationId: "application-1",
        platform: "YOUTUBE",
        submittedUrl: postInput.posts[0]!.url,
        platformVideoId: "abcdefghijk",
        username: "clipador",
        status: "PENDING",
      }),
    ]);
    expect(db.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      db.clipPost.createManyAndReturn.mock.invocationCallOrder[0]!,
    );
  });

  it("não aceita vínculo de contas após a saída", async () => {
    const { clipper, db, application } = fixture();
    application.status = "WITHDRAWN";
    await expect(
      clipper.addAccountsToApplication({
        applicationId: application.id,
        accountIds: ["account-1"],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.applicationSocialAccount.create).not.toHaveBeenCalled();
  });

  it("revalida a inscrição antes de vincular contas quando a saída ocorre simultaneamente", async () => {
    const { clipper, db, application } = fixture();
    db.clipperApplication.findUnique
      .mockResolvedValueOnce(application)
      .mockResolvedValue({ ...application, status: "WITHDRAWN" });
    await expect(
      clipper.addAccountsToApplication({
        applicationId: application.id,
        accountIds: ["account-1"],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.$executeRaw).toHaveBeenCalled();
    expect(db.applicationSocialAccount.create).not.toHaveBeenCalled();
  });

  it("o admin não reativa uma desistência pela aprovação", async () => {
    const { admin, db, application } = fixture();
    application.status = "WITHDRAWN";
    await expect(
      admin.approveApplication({ applicationId: application.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.clipperApplication.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: application.id, status: { not: "WITHDRAWN" } },
      }),
    );
    expect(db.monthlyRanking.findMany).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("o admin não substitui a desistência por rejeição", async () => {
    const { admin, db, application } = fixture();
    application.status = "WITHDRAWN";
    await expect(
      admin.rejectApplication({
        applicationId: application.id,
        rejectionReason: "Teste",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("a aprovação em lote ignora quem desistiu depois da consulta inicial", async () => {
    const { admin, db, application } = fixture();
    application.status = "PENDING";
    expect(
      await admin.approveAllApplications({ campaignId: "campaign-1" }),
    ).toMatchObject({ approvedCount: 0 });
    expect(db.clipperApplication.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: application.id, status: "PENDING" },
      }),
    );
    expect(db.monthlyRanking.findMany).not.toHaveBeenCalled();
  });
});
