import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const currentUser = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({
  currentUser,
  // privateProcedure autentica via auth(); deriva do mesmo mock de currentUser
  auth: async () => ({ userId: ((await currentUser()) as { id?: string } | null)?.id ?? null }),
}));
vi.mock("@/server/db", () => ({ db: {} }));
vi.mock("@/env", () => ({ env: {} }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: vi.fn() };
  },
}));

import { campaignRouter } from "./competition";
import { adminRouter } from "./admin";

const now = new Date("2026-10-09T18:00:00Z");
const start = new Date("2026-10-10T18:00:00Z");

function fixture({
  privateCompetition = false,
  requiresApproval = false,
} = {}) {
  const profile = {
    id: "clipper-1",
    userId: "user-1",
    fullName: "Clipador",
    artisticName: "clipador",
    user: { role: "CLIPPER", subscriptionStatus: "ACTIVE" },
    socialAccounts: [{ id: "account-1" }],
  };
  const campaign = {
    id: "campaign-1",
    name: "Competição",
    slug: "competicao",
    status: "ACTIVE",
    startDate: start,
    endDate: new Date("2026-11-01T18:00:00Z"),
    isPrivate: privateCompetition,
    isProOnly: false,
    requiresApproval,
  };
  const application = {
    id: "application-1",
    clipperProfileId: profile.id,
    campaignId: campaign.id,
    status: "WITHDRAWN",
    withdrawnAt: new Date("2026-10-09T17:00:00Z"),
    formData: {
      enrolledAt: "2026-10-08T00:00:00Z",
      customAnswer: "Preservado",
    },
    campaign,
    clipperProfile: profile,
  };
  const db = {
    // Sem sanções de advertência (redutor, suspensão, retenção).
    clipperSanction: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    $executeRaw: vi.fn().mockResolvedValue(1),
    $transaction: vi.fn(),
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ role: "ADMIN", subscriptionStatus: "ACTIVE" }),
    },
    campaign: {
      findUnique: vi.fn().mockImplementation(async () => ({ ...campaign })),
    },
    clipperProfile: {
      findUnique: vi.fn().mockResolvedValue(profile),
      findMany: vi.fn().mockResolvedValue([profile]),
    },
    clipperApplication: {
      findUnique: vi.fn().mockImplementation(async () => ({
        ...application,
        campaign: { ...campaign },
        clipperProfile: { ...profile, user: { ...profile.user } },
      })),
      findFirst: vi.fn().mockImplementation(async () => ({ ...application })),
      findMany: vi.fn().mockImplementation(async () => [{ ...application }]),
      findUniqueOrThrow: vi
        .fn()
        .mockImplementation(async () => ({ ...application })),
      updateMany: vi.fn().mockImplementation(async ({ data }) => {
        Object.assign(application, data);
        return { count: 1 };
      }),
      create: vi.fn(),
      delete: vi.fn(),
    },
    socialAccount: {
      findMany: vi.fn().mockResolvedValue([{ id: "account-1" }]),
    },
    applicationSocialAccount: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: {
      findFirst: vi.fn().mockResolvedValue({
        changes: {
          dailyRankingEntryIds: ["withdrawal-daily-1"],
          topClippersRankingEntryIds: ["withdrawal-top-1"],
        },
      }),
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
    dailyRankingEntry: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    topClippersDailyRankingEntry: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    clipPost: { deleteMany: vi.fn() },
    wallet: { update: vi.fn() },
    transaction: { create: vi.fn() },
  };
  db.$transaction.mockImplementation((callback) => callback(db));
  const context = { db, headers: new Headers() } as never;
  return {
    db,
    profile,
    campaign,
    application,
    api: campaignRouter.createCaller(context),
    admin: adminRouter.createCaller(context),
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  currentUser.mockResolvedValue({ id: "user-1" });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const enrollment = {
  campaignId: "campaign-1",
  socialAccountIds: ["account-1"],
};

describe("reinscrição somente antes do início", () => {
  it.each(["DRAFT", "COMPLETED", "ARCHIVED"])(
    "não reabre inscrição em competição %s",
    async (status) => {
      const { api, db, campaign } = fixture();
      campaign.status = status;
      await expect(api.enrollInCompetition(enrollment)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(db.clipperApplication.updateMany).not.toHaveBeenCalled();
    },
  );

  it("não vincula contas de outro clipador durante a reinscrição", async () => {
    const { api, db } = fixture();
    db.socialAccount.findMany.mockResolvedValue([]);
    await expect(api.enrollInCompetition(enrollment)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(db.clipperApplication.updateMany).not.toHaveBeenCalled();
    expect(db.applicationSocialAccount.createMany).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "reutiliza a inscrição e respeita requiresApproval=%s",
    async (requiresApproval) => {
      const { api, db, application } = fixture({ requiresApproval });
      const result = await api.enrollInCompetition(enrollment);
      expect(result.application.id).toBe("application-1");
      expect(result.application.status).toBe(
        requiresApproval ? "PENDING" : "APPROVED",
      );
      expect(application.withdrawnAt).toBeNull();
      expect(application.formData.customAnswer).toBe("Preservado");
      expect(db.clipperApplication.create).not.toHaveBeenCalled();
      expect(db.clipperApplication.delete).not.toHaveBeenCalled();
      expect(db.clipPost.deleteMany).not.toHaveBeenCalled();
      expect(db.wallet.update).not.toHaveBeenCalled();
      expect(db.transaction.create).not.toHaveBeenCalled();
      expect(db.applicationSocialAccount.createMany).toHaveBeenCalledWith({
        data: [{ applicationId: "application-1", accountId: "account-1" }],
      });
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            changes: expect.objectContaining({
              previousWithdrawnAt: "2026-10-09T17:00:00.000Z",
              action: "reenroll_before_competition_start",
            }),
          }),
        }),
      );
    },
  );

  it.each(["2026-10-10T18:00:00.000Z", "2026-10-10T18:00:00.001Z"])(
    "bloqueia retorno a partir do início em %s",
    async (at) => {
      vi.setSystemTime(new Date(at));
      const { api, db } = fixture();
      await expect(api.enrollInCompetition(enrollment)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(db.clipperApplication.updateMany).not.toHaveBeenCalled();
    },
  );

  it("revalida o horário depois de adquirir o lock da inscrição", async () => {
    const { api, db } = fixture();
    db.$executeRaw.mockImplementation(async () => {
      vi.setSystemTime(start);
      return 1;
    });
    await expect(api.enrollInCompetition(enrollment)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(db.clipperApplication.updateMany).not.toHaveBeenCalled();
  });

  it("não duplica uma reinscrição repetida", async () => {
    const { api, db } = fixture();
    await api.enrollInCompetition(enrollment);
    await expect(api.enrollInCompetition(enrollment)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(db.clipperApplication.updateMany).toHaveBeenCalledTimes(1);
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("mantém o bloqueio PRO após a saída", async () => {
    const { api, db, campaign } = fixture();
    campaign.isProOnly = true;
    db.user.findUnique.mockResolvedValue({
      role: "CLIPPER",
      subscriptionStatus: "NONE",
    });
    await expect(api.enrollInCompetition(enrollment)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.clipperApplication.updateMany).not.toHaveBeenCalled();
  });

  it("revalida a assinatura PRO durante a transação", async () => {
    const { api, db, campaign, profile } = fixture();
    campaign.isProOnly = true;
    profile.user.subscriptionStatus = "NONE";
    await expect(api.enrollInCompetition(enrollment)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.clipperApplication.updateMany).not.toHaveBeenCalled();
  });

  it("o clipador não se reinscreve sozinho em competição privada", async () => {
    const { api, db } = fixture({ privateCompetition: true });
    await expect(api.enrollInCompetition(enrollment)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.clipperApplication.updateMany).not.toHaveBeenCalled();
  });

  it("restaura somente exclusões registradas pela saída, mantendo punições manuais e pagamentos", async () => {
    const { api, db } = fixture();
    await api.enrollInCompetition(enrollment);
    expect(db.dailyRankingEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["withdrawal-daily-1"] },
          isDisqualified: true,
          clipPost: { status: "ELIGIBLE" },
          dailyPrizeStatus: { not: "PAID" },
          dailyPrizePaid: false,
        }),
      }),
    );
    expect(db.topClippersDailyRankingEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["withdrawal-top-1"] },
          disqualificationReason: "Saída voluntária da competição",
          prizeStatus: { not: "PAID" },
        }),
      }),
    );
  });

  it("não desvincula contas quando a competição muda antes da gravação", async () => {
    const { api, db } = fixture();
    db.clipperApplication.updateMany.mockResolvedValue({ count: 0 });
    await expect(api.enrollInCompetition(enrollment)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(db.applicationSocialAccount.deleteMany).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("o administrador reinscreve em competição privada antes do início, sempre pendente de aprovação", async () => {
    currentUser.mockResolvedValue({ id: "admin-1" });
    const { admin, application, db } = fixture({ privateCompetition: true });
    const result = await admin.enrollClipperInPrivateCompetition({
      campaignId: "campaign-1",
      clipperProfileId: "clipper-1",
    });
    expect(result.success).toBe(true);
    expect(application.status).toBe("PENDING");
    expect(db.clipperApplication.create).not.toHaveBeenCalled();
  });

  it("o administrador também não pode reinscrever depois do início", async () => {
    vi.setSystemTime(start);
    currentUser.mockResolvedValue({ id: "admin-1" });
    const { admin, db } = fixture({ privateCompetition: true });
    await expect(
      admin.enrollClipperInPrivateCompetition({
        campaignId: "campaign-1",
        clipperProfileId: "clipper-1",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.clipperApplication.updateMany).not.toHaveBeenCalled();
  });

  it("a reinscrição em lote também reutiliza o registro antes do início", async () => {
    currentUser.mockResolvedValue({ id: "admin-1" });
    const { admin, application, db } = fixture({ privateCompetition: true });
    expect(
      await admin.enrollMultipleClippersInPrivateCompetition({
        campaignId: "campaign-1",
        clipperProfileIds: ["clipper-1"],
      }),
    ).toMatchObject({ enrolledCount: 1, skippedCount: 0 });
    expect(application.status).toBe("PENDING");
    expect(db.clipperApplication.create).not.toHaveBeenCalled();
  });

  it("o lote não reabre inscrições quando o início já ocorreu", async () => {
    vi.setSystemTime(start);
    currentUser.mockResolvedValue({ id: "admin-1" });
    const { admin, db } = fixture({ privateCompetition: true });
    expect(
      await admin.enrollMultipleClippersInPrivateCompetition({
        campaignId: "campaign-1",
        clipperProfileIds: ["clipper-1"],
      }),
    ).toMatchObject({ enrolledCount: 0, skippedCount: 1 });
    expect(db.clipperApplication.updateMany).not.toHaveBeenCalled();
  });
});
