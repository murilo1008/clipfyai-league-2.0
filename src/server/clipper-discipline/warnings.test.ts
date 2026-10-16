import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const effects = vi.hoisted(() => ({
  applyVideoInvalidation: vi.fn(),
  applyCompetitionRemoval: vi.fn(),
  applyPlatformBan: vi.fn(),
  applyDayPointsReset: vi.fn(),
  applyPodiumIneligibility: vi.fn(),
  restorePodiumDay: vi.fn(),
  syncDebtHold: vi.fn(),
  lastLockedPostedAtCutoff: vi.fn(),
  syncWalletHold: vi.fn(),
  lockClipperProfile: vi.fn(),
  restoreEffects: vi.fn(),
}));
vi.mock("./effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./effects")>()),
  ...effects,
}));
const sendWarningEmail = vi.hoisted(() => vi.fn());
vi.mock("./notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./notifications")>()),
  sendWarningEmail,
}));

import {
  applyClipperWarning,
  applyManualSanction,
  revokeClipperWarning,
  revokeSanction,
} from "./warnings";

const now = new Date("2026-10-16T15:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function makeDb({ activeWarnings = [] as Array<{ infractionType: string; level: number | null }> } = {}) {
  let sanctionSeq = 0;
  const tx = {
    clipperProfile: {
      findUnique: vi.fn().mockResolvedValue({
        id: "clipper-1",
        fullName: "Fulano",
        artisticName: "fulano",
        userId: "user-1",
        user: { email: "fulano@example.com", role: "CLIPPER" },
      }),
    },
    clipPost: {
      findUnique: vi.fn().mockResolvedValue({
        id: "post-1",
        campaignId: "camp-1",
        submittedUrl: "https://tiktok.com/@f/video/1",
        application: { clipperProfileId: "clipper-1" },
      }),
    },
    campaign: {
      findUnique: vi.fn().mockResolvedValue({ id: "camp-1", name: "Liga" }),
    },
    clipperDisciplineSettings: { findUnique: vi.fn().mockResolvedValue(null) },
    clipperWarning: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue(activeWarnings),
      create: vi.fn().mockResolvedValue({ id: "warning-1" }),
      update: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    clipperSanction: {
      create: vi.fn().mockImplementation(async ({ data }) => ({
        id: `sanction-${++sanctionSeq}`,
        type: data.type,
        endsAt: data.endsAt,
        scoreMultiplierBps: data.scoreMultiplierBps,
        metadata: data.metadata ?? null,
      })),
      updateMany: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    clipperApplication: { findMany: vi.fn().mockResolvedValue([]) },
    auditLog: { create: vi.fn() },
    notification: {
      upsert: vi.fn().mockResolvedValue({ id: "notification-1" }),
      create: vi.fn(),
    },
  };
  const db = {
    ...tx,
    $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  return { db, tx };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CLIPPER_DISCIPLINE_ENABLED", "true");
  effects.applyVideoInvalidation.mockResolvedValue({
    posts: [{ id: "post-1", status: "ELIGIBLE", ineligibilityReason: null }],
  });
  effects.applyCompetitionRemoval.mockResolvedValue({});
  effects.applyPlatformBan.mockResolvedValue({});
  effects.syncDebtHold.mockResolvedValue(null);
  effects.lastLockedPostedAtCutoff.mockResolvedValue(null);
  // Um resumo novo por chamada: quem revoga soma os resumos.
  effects.restoreEffects.mockImplementation(async () => ({
    restoredPosts: 1,
    restoredEntries: 0,
    keptLockedEntries: 0,
    keptCoveredItems: 0,
    restoredApplications: 0,
    restoredAmount: 0,
    unbanned: false,
  }));
  effects.applyPodiumIneligibility.mockResolvedValue({
    dailyEntryIds: ["entry-1"],
    reversals: [{ adjustmentId: "adj-1", creditId: "credit-1", amount: 25 }],
  });
  effects.restorePodiumDay.mockResolvedValue({
    restoredEntries: 2,
    keptLockedEntries: 0,
    keptCoveredItems: 0,
  });
  sendWarningEmail.mockResolvedValue({ sent: true, error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const baseInput = {
  clipperProfileId: "clipper-1",
  infractionType: "LIGHT" as const,
  level: 1,
  clipPostId: "post-1",
  reason: "Hashtag obrigatória faltando",
  actorUserId: "admin-1",
  now,
};

describe("applyClipperWarning", () => {
  it("fica bloqueado enquanto o sistema não é liberado no ambiente", async () => {
    vi.stubEnv("CLIPPER_DISCIPLINE_ENABLED", "false");
    const { db } = makeDb();
    await expect(applyClipperWarning(db as never, baseInput)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("nível 4 exige a confirmação do banimento", async () => {
    const { db } = makeDb();
    await expect(
      applyClipperWarning(db as never, { ...baseInput, level: 4, clipPostId: null }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("nível 1: registra a advertência, a suspensão e o vídeo invalidado, e notifica", async () => {
    const { db, tx } = makeDb({ activeWarnings: [{ infractionType: "LIGHT", level: 0 }] });
    const result = await applyClipperWarning(db as never, baseInput);

    const expiresAt = new Date(now.getTime() + 60 * DAY);
    // Janela rolante: as ativas passam a expirar junto com a nova.
    expect(tx.clipperWarning.updateMany).toHaveBeenCalledWith({
      where: { clipperProfileId: "clipper-1", status: "ACTIVE", expiresAt: { gt: now } },
      data: { expiresAt },
    });
    expect(tx.clipperWarning.create.mock.calls[0]![0].data).toMatchObject({
      clipperProfileId: "clipper-1",
      campaignId: "camp-1",
      clipPostId: "post-1",
      videoUrl: "https://tiktok.com/@f/video/1",
      infractionType: "LIGHT",
      level: 1,
      suggestedLevel: 1,
      reason: "Hashtag obrigatória faltando",
      appliedById: "admin-1",
      expiresAt,
      banReviewStatus: null,
      configSnapshot: expect.objectContaining({ level1SuspensionHours: 24 }),
    });
    expect(tx.clipperSanction.create.mock.calls.map((call) => call[0].data.type)).toEqual([
      "VIDEO_INVALIDATION",
      "POSTING_SUSPENSION",
    ]);
    expect(effects.applyVideoInvalidation).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ clipPostId: "post-1", campaignId: "camp-1", warningId: "warning-1" }),
    );
    expect(effects.applyCompetitionRemoval).not.toHaveBeenCalled();
    expect(effects.syncWalletHold).toHaveBeenCalledWith(tx, "clipper-1", now);
    expect(tx.notification.upsert.mock.calls[0]![0]).toMatchObject({
      where: { idempotencyKey: "clipper-warning:warning-1:applied" },
      create: {
        userId: "user-1",
        type: "SYSTEM_ALERT",
        title: "Advertência 1 aplicada",
        actionUrl: "/warnings",
        metadata: { kind: "clipper_warning", warningId: "warning-1", event: "applied" },
      },
    });
    expect(sendWarningEmail).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ to: "fulano@example.com", notificationId: "notification-1" }),
    );
    expect(result).toMatchObject({ warningId: "warning-1", level: 1, invalidatedPosts: 1 });
  });

  it("recusa vídeo de outro clipador", async () => {
    const { db, tx } = makeDb();
    tx.clipPost.findUnique.mockResolvedValue({
      id: "post-1",
      campaignId: "camp-1",
      submittedUrl: "x",
      application: { clipperProfileId: "clipper-2" },
    });
    await expect(applyClipperWarning(db as never, baseInput)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "O vídeo informado não é deste clipador.",
    });
  });

  it("nível 3: remove da competição estornando os prêmios", async () => {
    const { db } = makeDb();
    await applyClipperWarning(db as never, {
      ...baseInput,
      level: 3,
      clipPostId: null,
      campaignId: "camp-1",
    });
    expect(effects.applyCompetitionRemoval).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ campaignId: "camp-1", reversePrizes: true }),
    );
    expect(effects.syncDebtHold).toHaveBeenCalled();
  });

  it("grave: entra na fila de análise de banimento sem banir", async () => {
    const { db, tx } = makeDb();
    await applyClipperWarning(db as never, {
      ...baseInput,
      infractionType: "SEVERE",
      level: null,
      clipPostId: null,
      campaignId: "camp-1",
    });
    expect(tx.clipperWarning.create.mock.calls[0]![0].data).toMatchObject({
      level: null,
      banReviewStatus: "PENDING",
    });
    expect(tx.clipperSanction.create.mock.calls.map((call) => call[0].data.type)).toEqual([
      "COMPETITION_REMOVAL",
      "PAYOUT_HOLD",
    ]);
    expect(effects.applyPlatformBan).not.toHaveBeenCalled();
  });

  it("nível 4 confirmado bane e retém a carteira", async () => {
    const { db, tx } = makeDb();
    await applyClipperWarning(db as never, {
      ...baseInput,
      level: 4,
      clipPostId: null,
      confirmBan: true,
    });
    expect(effects.applyPlatformBan).toHaveBeenCalled();
    expect(tx.clipperSanction.create.mock.calls.map((call) => call[0].data.type)).toEqual([
      "PLATFORM_BAN",
      "PAYOUT_HOLD",
    ]);
  });
});

describe("inelegível ao pódio na advertência", () => {
  it("grava a janela do dia na sanção, aplica os efeitos nela e avisa o clipador", async () => {
    const { db, tx } = makeDb();
    const result = await applyClipperWarning(db as never, {
      ...baseInput,
      podiumRankingDate: "2026-10-16",
    });
    const podiumCreate = tx.clipperSanction.create.mock.calls.find(
      (call) => call[0].data.type === "PODIUM_INELIGIBLE",
    );
    expect(podiumCreate![0].data).toMatchObject({
      warningId: "warning-1",
      campaignId: "camp-1",
      startsAt: new Date("2026-10-15T20:00:00.000Z"),
      endsAt: new Date("2026-10-16T20:00:00.000Z"),
      metadata: { rankingDate: "2026-10-16" },
    });
    expect(effects.applyPodiumIneligibility).toHaveBeenCalledWith(tx, {
      clipperProfileId: "clipper-1",
      campaignId: "camp-1",
      rankingDate: "2026-10-16",
      actorUserId: "admin-1",
      now,
      sanctionId: "sanction-3",
    });
    // Os efeitos ficam na própria sanção (ela pode ser desfeita sozinha)...
    expect(tx.clipperSanction.update).toHaveBeenCalledWith({
      where: { id: "sanction-3" },
      data: {
        metadata: {
          rankingDate: "2026-10-16",
          effects: {
            dailyEntryIds: ["entry-1"],
            reversals: [{ adjustmentId: "adj-1", creditId: "credit-1", amount: 25 }],
          },
        },
      },
    });
    // ...e não nos da advertência.
    expect(tx.clipperWarning.update).toHaveBeenCalledWith({
      where: { id: "warning-1" },
      data: { effects: { posts: [{ id: "post-1", status: "ELIGIBLE", ineligibilityReason: null }] } },
    });
    // O estorno do saldo devedor considera também o prêmio do dia estornado.
    expect(effects.syncDebtHold).toHaveBeenCalled();
    expect(result.reversedAmount).toBe(25);
    expect(tx.notification.upsert.mock.calls[0]![0].create.message).toContain(
      "Inelegível ao pódio: seus vídeos de 16/10/2026 ficam fora dos rankings daquele dia",
    );
  });

  it("não vale do nível 3 em diante (o clipador já sai da competição)", async () => {
    const { db } = makeDb();
    await expect(
      applyClipperWarning(db as never, {
        ...baseInput,
        level: 3,
        clipPostId: null,
        campaignId: "camp-1",
        podiumRankingDate: "2026-10-16",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(effects.applyPodiumIneligibility).not.toHaveBeenCalled();
  });

  it("revogar a advertência devolve os vídeos do dia aos rankings", async () => {
    const { db, tx } = makeDb();
    tx.clipperWarning.findUnique.mockResolvedValue({ clipperProfileId: "clipper-1" });
    const podiumSanction = {
      id: "s-podium",
      type: "PODIUM_INELIGIBLE",
      clipperProfileId: "clipper-1",
      campaignId: "camp-1",
      startsAt: new Date("2026-10-15T20:00:00.000Z"),
      endsAt: new Date("2026-10-16T20:00:00.000Z"),
      revokedAt: null,
      scoreMultiplierBps: null,
      metadata: { rankingDate: "2026-10-16", effects: { dailyEntryIds: ["entry-1"] } },
    };
    tx.clipperWarning.findUniqueOrThrow.mockResolvedValue({
      id: "warning-1",
      clipperProfileId: "clipper-1",
      campaignId: "camp-1",
      status: "ACTIVE",
      infractionType: "LIGHT",
      level: 0,
      effects: {},
      sanctions: [podiumSanction],
      campaign: { name: "Liga" },
      clipperProfile: {
        userId: "user-1",
        fullName: "Fulano",
        artisticName: null,
        user: { email: "fulano@example.com" },
      },
    });
    const summary = await revokeClipperWarning(db as never, {
      warningId: "warning-1",
      reason: "Aplicada por engano",
      restorePrizes: true,
      actorUserId: "admin-1",
      now,
    });
    expect(tx.clipperSanction.update).toHaveBeenCalledWith({
      where: { id: "s-podium" },
      data: { revokedAt: now, revokedById: "admin-1", revokeReason: "Aplicada por engano" },
    });
    // Efeitos da advertência e os da sanção do pódio (as entries do dia voltam
    // pelo recálculo de restorePodiumDay).
    expect(effects.restoreEffects).toHaveBeenNthCalledWith(
      2,
      tx,
      {},
      expect.objectContaining({ clipperProfileId: "clipper-1", restorePrizes: true }),
    );
    expect(effects.restorePodiumDay).toHaveBeenCalledWith(tx, {
      clipperProfileId: "clipper-1",
      campaignId: "camp-1",
      rankingDate: "2026-10-16",
    });
    expect(summary).toMatchObject({ restoredPosts: 2, restoredEntries: 2 });
  });
});

describe("inelegível ao pódio avulso", () => {
  function manualDb() {
    const { db, tx } = makeDb();
    tx.clipperProfile.findUnique.mockResolvedValue({ id: "clipper-1", userId: "user-1" });
    return { db, tx };
  }
  const input = {
    clipperProfileId: "clipper-1",
    type: "PODIUM_INELIGIBLE" as const,
    campaignId: "camp-1",
    rankingDate: "2026-10-16",
    reason: "Spam de vídeos repetidos",
    actorUserId: "admin-1",
    now,
  };

  it("vale para a janela do dia escolhido", async () => {
    const { db, tx } = manualDb();
    await applyManualSanction(db as never, input);
    expect(tx.clipperSanction.create.mock.calls[0]![0].data).toMatchObject({
      type: "PODIUM_INELIGIBLE",
      campaignId: "camp-1",
      startsAt: new Date("2026-10-15T20:00:00.000Z"),
      endsAt: new Date("2026-10-16T20:00:00.000Z"),
      metadata: { rankingDate: "2026-10-16" },
    });
    expect(effects.applyPodiumIneligibility).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ campaignId: "camp-1", rankingDate: "2026-10-16", sanctionId: "sanction-1" }),
    );
    expect(effects.applyDayPointsReset).not.toHaveBeenCalled();
    expect(effects.syncDebtHold).toHaveBeenCalled();
  });

  it("recusa dia futuro e falta de competição", async () => {
    const { db } = manualDb();
    await expect(
      applyManualSanction(db as never, { ...input, rankingDate: "2026-10-17" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "O dia do ranking não pode ser futuro." });
    await expect(
      applyManualSanction(db as never, { ...input, campaignId: null }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("desfazer devolve os vídeos do dia, mesmo quando veio de uma advertência", async () => {
    const { db, tx } = manualDb();
    const sanction = {
      id: "s-podium",
      clipperProfileId: "clipper-1",
      warningId: "warning-1",
      type: "PODIUM_INELIGIBLE",
      campaignId: "camp-1",
      revokedAt: null,
      metadata: { rankingDate: "2026-10-16", effects: {} },
    };
    tx.clipperSanction.findUnique.mockResolvedValue({ clipperProfileId: "clipper-1" });
    tx.clipperSanction.findUniqueOrThrow.mockResolvedValue(sanction);
    const result = await revokeSanction(db as never, {
      sanctionId: "s-podium",
      reason: "Defesa aceita",
      actorUserId: "admin-1",
      now,
    });
    expect(effects.restorePodiumDay).toHaveBeenCalledWith(tx, {
      clipperProfileId: "clipper-1",
      campaignId: "camp-1",
      rankingDate: "2026-10-16",
    });
    expect(result.summary).toMatchObject({ restoredEntries: 2 });
  });
});

describe("revokeClipperWarning", () => {
  it("desfaz o período das sanções, restaura os efeitos e libera a retenção", async () => {
    const { db, tx } = makeDb();
    const cutoff = new Date(now.getTime() - 2 * DAY);
    effects.lastLockedPostedAtCutoff.mockResolvedValue(cutoff);
    tx.clipperWarning.findUnique.mockResolvedValue({ clipperProfileId: "clipper-1" });
    tx.clipperWarning.findUniqueOrThrow.mockResolvedValue({
      id: "warning-1",
      clipperProfileId: "clipper-1",
      campaignId: "camp-1",
      status: "ACTIVE",
      infractionType: "LIGHT",
      level: 1,
      effects: { posts: [{ id: "post-1", status: "ELIGIBLE", ineligibilityReason: null }] },
      sanctions: [
        {
          id: "s-susp",
          type: "POSTING_SUSPENSION",
          startsAt: new Date(now.getTime() - DAY),
          endsAt: new Date(now.getTime() + DAY),
          revokedAt: null,
          scoreMultiplierBps: null,
        },
        {
          id: "s-mult",
          type: "SCORE_MULTIPLIER",
          startsAt: new Date(now.getTime() - 3 * DAY),
          endsAt: new Date(now.getTime() + 4 * DAY),
          revokedAt: null,
          scoreMultiplierBps: 8000,
        },
        {
          id: "s-hold",
          type: "PAYOUT_HOLD",
          startsAt: new Date(now.getTime() - DAY),
          endsAt: null,
          revokedAt: null,
          scoreMultiplierBps: null,
        },
      ],
      campaign: { name: "Liga" },
      clipperProfile: {
        userId: "user-1",
        fullName: "Fulano",
        artisticName: null,
        user: { email: "fulano@example.com" },
      },
    });

    const summary = await revokeClipperWarning(db as never, {
      warningId: "warning-1",
      reason: "Aplicada por engano",
      restorePrizes: true,
      actorUserId: "admin-1",
      now,
    });

    expect(tx.clipperWarning.update).toHaveBeenCalledWith({
      where: { id: "warning-1" },
      data: {
        status: "REVOKED",
        revokedAt: now,
        revokedById: "admin-1",
        revokeReason: "Aplicada por engano",
      },
    });
    const revokedAtById = Object.fromEntries(
      tx.clipperSanction.update.mock.calls.map((call) => [call[0].where.id, call[0].data.revokedAt]),
    );
    // A suspensão deixa de cobrir o período inteiro (o league libera os vídeos).
    expect(revokedAtById["s-susp"]).toEqual(new Date(now.getTime() - DAY));
    // O redutor sai a partir do fim do último dia já pago.
    expect(revokedAtById["s-mult"]).toEqual(cutoff);
    // A retenção termina agora.
    expect(revokedAtById["s-hold"]).toEqual(now);
    expect(effects.syncDebtHold).toHaveBeenCalled();
    expect(effects.restoreEffects).toHaveBeenCalledWith(
      tx,
      { posts: [{ id: "post-1", status: "ELIGIBLE", ineligibilityReason: null }] },
      expect.objectContaining({ restorePrizes: true }),
    );
    expect(effects.syncWalletHold).toHaveBeenCalledWith(tx, "clipper-1", now);
    expect(tx.notification.upsert.mock.calls[0]![0].where).toEqual({
      idempotencyKey: "clipper-warning:warning-1:revoked",
    });
    expect(summary).toMatchObject({ restoredPosts: 1 });
  });

  it("não revoga duas vezes", async () => {
    const { db, tx } = makeDb();
    tx.clipperWarning.findUnique.mockResolvedValue({ clipperProfileId: "clipper-1" });
    tx.clipperWarning.findUniqueOrThrow.mockResolvedValue({ status: "REVOKED", sanctions: [] });
    await expect(
      revokeClipperWarning(db as never, {
        warningId: "warning-1",
        reason: "Duplicado",
        restorePrizes: true,
        actorUserId: "admin-1",
        now,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("itens que ficaram para depois", () => {
  it("revogar tenta de novo o que outra revogação deixou de fora e guarda o que segue coberto", async () => {
    const { db, tx } = makeDb();
    tx.clipperWarning.findUnique.mockResolvedValue({ clipperProfileId: "clipper-1" });
    const ownEffects = {
      posts: [{ id: "post-1", status: "ELIGIBLE", ineligibilityReason: null }],
    };
    tx.clipperWarning.findUniqueOrThrow.mockResolvedValue({
      id: "warning-1",
      clipperProfileId: "clipper-1",
      campaignId: "camp-1",
      status: "ACTIVE",
      infractionType: "MEDIUM",
      level: 3,
      effects: ownEffects,
      sanctions: [],
      campaign: { name: "Liga" },
      clipperProfile: {
        userId: "user-1",
        fullName: "Fulano",
        artisticName: null,
        user: { email: "fulano@example.com" },
      },
    });
    // Advertência revogada antes, com um vídeo que esta remoção ainda cobria.
    const pending = [{ id: "post-9", status: "ELIGIBLE", ineligibilityReason: null }];
    tx.clipperWarning.findMany.mockResolvedValue([
      { id: "warning-old", effects: { posts: pending, deferred: { posts: pending } } },
    ]);
    Object.assign(tx.clipPost, {
      findMany: vi.fn().mockResolvedValue([{ campaignId: "camp-2" }]),
    });
    effects.restoreEffects.mockImplementation(
      async (_tx: unknown, restoring: unknown, options: { deferred?: Record<string, unknown> }) => {
        // A própria advertência: post-1 segue coberto por outra punição.
        if (restoring === ownEffects) options.deferred!.posts = ownEffects.posts;
        return {
          restoredPosts: restoring === ownEffects ? 0 : 1,
          restoredEntries: 0,
          keptLockedEntries: 0,
          keptCoveredItems: restoring === ownEffects ? 1 : 0,
          restoredApplications: 0,
          restoredAmount: 0,
          unbanned: false,
        };
      },
    );

    const summary = await revokeClipperWarning(db as never, {
      warningId: "warning-1",
      reason: "Defesa aceita",
      restorePrizes: true,
      actorUserId: "admin-1",
      now,
    });

    expect(effects.restoreEffects).toHaveBeenNthCalledWith(
      2,
      tx,
      { posts: pending },
      expect.objectContaining({ restorePrizes: true, deferred: {} }),
    );
    // Voltou: a pendência sai da advertência antiga.
    expect(tx.clipperWarning.update).toHaveBeenCalledWith({
      where: { id: "warning-old" },
      data: { effects: { posts: pending } },
    });
    // Segue coberto: fica guardado nesta advertência.
    expect(tx.clipperWarning.update).toHaveBeenCalledWith({
      where: { id: "warning-1" },
      data: { effects: { ...ownEffects, deferred: { posts: ownEffects.posts } } },
    });
    expect(summary).toMatchObject({ restoredPosts: 1, keptCoveredItems: 1 });
  });

  it("não encerra uma invalidação de vídeo fora da advertência", async () => {
    const { db, tx } = makeDb();
    tx.clipperSanction.findUnique.mockResolvedValue({ clipperProfileId: "clipper-1" });
    tx.clipperSanction.findUniqueOrThrow.mockResolvedValue({
      id: "s-video",
      clipperProfileId: "clipper-1",
      type: "VIDEO_INVALIDATION",
      revokedAt: null,
    });
    await expect(
      revokeSanction(db as never, {
        sanctionId: "s-video",
        reason: "Engano",
        actorUserId: "admin-1",
        now,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(tx.clipperSanction.update).not.toHaveBeenCalled();
  });
});
