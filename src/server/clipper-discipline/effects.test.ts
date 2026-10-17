import { describe, expect, it, vi } from "vitest";

import {
  applyPodiumIneligibility,
  applyVideoInvalidation,
  DEBT_HOLD_REASON,
  syncDebtHold,
  restoreEffects,
  restorePodiumDay,
  reversePrizeCredits,
  syncWalletHold,
  WALLET_HOLD_BLOCK_REASON,
} from "./effects";

const now = new Date("2026-10-16T15:00:00Z");

describe("reversePrizeCredits", () => {
  function makeTx() {
    const transactionFindMany = vi
      .fn()
      // créditos da campanha
      .mockResolvedValueOnce([
        { id: "c1", amount: 50, campaignId: "camp", clipPostId: "p1", rankingPosition: 1, metadata: {} },
        {
          id: "c2",
          amount: 30,
          campaignId: "camp",
          clipPostId: "p2",
          rankingPosition: 2,
          metadata: { dailyRankingEntryId: "e2" },
        },
      ])
      // estornos existentes: c1 já foi estornado pelo admin
      .mockResolvedValueOnce([{ id: "adj-old", metadata: { reversedPrizeCreditId: "c1" } }])
      // nenhuma devolução
      .mockResolvedValueOnce([]);
    return {
      $executeRaw: vi.fn().mockResolvedValue(1),
      wallet: {
        findUnique: vi.fn().mockResolvedValue({ id: "w1" }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ balance: 10 }),
        update: vi.fn(),
      },
      transaction: {
        findMany: transactionFindMany,
        create: vi.fn().mockResolvedValue({ id: "adj-new" }),
      },
      dailyRankingEntry: {
        findUnique: vi.fn().mockResolvedValue({ dailyPrizeStatus: "PAID" }),
        update: vi.fn(),
      },
    };
  }

  it("estorna só créditos ainda válidos e deixa o saldo negativo virar dívida", async () => {
    const tx = makeTx();
    const effects = await reversePrizeCredits(tx as never, {
      clipperProfileId: "clipper-1",
      where: { campaignId: "camp" },
      description: "Estorno",
      actorUserId: "admin-1",
      now,
      warningId: "warning-1",
    });

    expect(tx.transaction.create).toHaveBeenCalledOnce();
    expect(tx.transaction.create.mock.calls[0]![0].data).toMatchObject({
      walletId: "w1",
      type: "ADJUSTMENT",
      status: "COMPLETED",
      amount: -30,
      balanceBefore: 10,
      balanceAfter: -20,
      campaignId: "camp",
      metadata: {
        action: "clipper_warning_prize_reversal",
        reversedPrizeCreditId: "c2",
        warningId: "warning-1",
        dailyRankingEntryId: "e2",
      },
    });
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "w1" },
      data: { balance: { decrement: 30 }, totalEarned: { decrement: 30 } },
    });
    // A posição paga continua no ranking, mas o prêmio fica marcado como estornado.
    expect(tx.dailyRankingEntry.update).toHaveBeenCalledWith({
      where: { id: "e2" },
      data: { dailyPrizeStatus: "REVERSED" },
    });
    expect(effects).toEqual({
      reversals: [
        { adjustmentId: "adj-new", creditId: "c2", amount: 30, dailyRankingEntryId: "e2" },
      ],
      reversedDailyEntries: [{ id: "e2", previousStatus: "PAID" }],
    });
    // Mesma ordem de locks do payout do league: entry, depois carteira.
    const locks = tx.$executeRaw.mock.calls.map((call) => (call[0] as string[]).join("?"));
    expect(locks[0]).toContain('FROM "DailyRankingEntry"');
    expect(locks[1]).toContain('FROM "Wallet"');
  });

  it("sem carteira não há o que estornar", async () => {
    const tx = makeTx();
    tx.wallet.findUnique.mockResolvedValue(null);
    expect(
      await reversePrizeCredits(tx as never, {
        clipperProfileId: "clipper-1",
        where: {},
        description: "Estorno",
        actorUserId: "admin-1",
        now,
      }),
    ).toEqual({});
    expect(tx.transaction.create).not.toHaveBeenCalled();
  });
});

describe("retenção da carteira", () => {
  function makeTx({ holds = 0, wallet = null as Record<string, unknown> | null } = {}) {
    return {
      clipperSanction: { count: vi.fn().mockResolvedValue(holds) },
      wallet: {
        findUnique: vi.fn().mockResolvedValue(wallet),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
  }

  it("cria a carteira já bloqueada quando a retenção chega antes do primeiro prêmio", async () => {
    const tx = makeTx({ holds: 1 });
    expect(await syncWalletHold(tx as never, "clipper-1", now)).toBe(true);
    expect(tx.wallet.create).toHaveBeenCalledWith({
      data: {
        clipperProfileId: "clipper-1",
        isActive: false,
        blockedAt: now,
        blockReason: WALLET_HOLD_BLOCK_REASON,
      },
    });
  });

  it("bloqueia a carteira ativa e libera quando a retenção acaba", async () => {
    const held = makeTx({ holds: 1, wallet: { id: "w1", isActive: true, blockReason: null } });
    await syncWalletHold(held as never, "clipper-1", now);
    expect(held.wallet.update.mock.calls[0]![0].data).toMatchObject({ isActive: false });

    const released = makeTx({
      wallet: { id: "w1", isActive: false, blockReason: WALLET_HOLD_BLOCK_REASON },
    });
    expect(await syncWalletHold(released as never, "clipper-1", now)).toBe(false);
    expect(released.wallet.update).toHaveBeenCalledWith({
      where: { id: "w1" },
      data: { isActive: true, blockedAt: null, blockReason: null },
    });
  });

  it("não libera um bloqueio feito por outro motivo", async () => {
    const tx = makeTx({ wallet: { id: "w1", isActive: false, blockReason: "Bloqueio manual" } });
    await syncWalletHold(tx as never, "clipper-1", now);
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });

  it("saldo negativo gera a retenção de saldo devedor, sem vínculo com a advertência", async () => {
    const tx = {
      wallet: { findUnique: vi.fn().mockResolvedValue({ balance: -20 }) },
      clipperSanction: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "hold-1" }),
        updateMany: vi.fn(),
      },
    };
    expect(
      await syncDebtHold(tx as never, { clipperProfileId: "clipper-1", actorUserId: "admin-1", now }),
    ).toBe("hold-1");
    expect(tx.clipperSanction.create.mock.calls[0]![0].data).toMatchObject({
      warningId: null,
      type: "PAYOUT_HOLD",
      endsAt: null,
      reason: DEBT_HOLD_REASON,
    });
  });

  it("com o saldo quitado a retenção de saldo devedor é encerrada", async () => {
    const tx = {
      wallet: { findUnique: vi.fn().mockResolvedValue({ balance: 5 }) },
      clipperSanction: {
        findFirst: vi.fn().mockResolvedValue({ id: "hold-1" }),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
    };
    expect(
      await syncDebtHold(tx as never, { clipperProfileId: "clipper-1", actorUserId: "admin-1", now }),
    ).toBeNull();
    expect(tx.clipperSanction.create).not.toHaveBeenCalled();
    expect(tx.clipperSanction.updateMany.mock.calls[0]![0]).toMatchObject({
      where: { reason: DEBT_HOLD_REASON },
      data: { revokedAt: now, revokeReason: "Saldo quitado" },
    });
  });
});

describe("applyVideoInvalidation", () => {
  it("tira o vídeo só dos rankings destravados", async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      $queryRaw: vi.fn().mockResolvedValue([{ id: "dr-paid" }]),
      clipPost: {
        findMany: vi.fn().mockResolvedValue([
          { id: "post-1", status: "ELIGIBLE", ineligibilityReason: null },
        ]),
        updateMany: vi.fn(),
      },
      dailyRankingEntry: {
        findMany: vi.fn().mockResolvedValue([
          { id: "entry-open", dailyRankingId: "dr-open", dailyPrizeStatus: "PENDING", dailyPrizePaid: false },
          // Dia já creditado em parte, mas esta posição ainda sem crédito.
          { id: "entry-paid", dailyRankingId: "dr-paid", dailyPrizeStatus: "PENDING", dailyPrizePaid: false },
        ]),
        updateMany: vi.fn(),
      },
      wallet: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const effects = await applyVideoInvalidation(tx as never, {
      clipperProfileId: "clipper-1",
      campaignId: "camp",
      clipPostId: "post-1",
      reason: "Advertência: hashtag faltando",
      actorUserId: "admin-1",
      now,
    });
    expect(tx.clipPost.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["post-1"] } },
      data: { status: "DISQUALIFIED", ineligibilityReason: "Advertência: hashtag faltando" },
    });
    expect(tx.dailyRankingEntry.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["entry-open"] } },
      data: { isDisqualified: true },
    });
    // No dia travado a posição fica, mas o prêmio não creditado é perdido.
    expect(tx.dailyRankingEntry.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["entry-paid"] } },
      data: { dailyPrizeStatus: "REVERSED" },
    });
    expect(effects).toEqual({
      posts: [{ id: "post-1", status: "ELIGIBLE", ineligibilityReason: null }],
      dailyEntryIds: ["entry-open"],
      reversedDailyEntries: [{ id: "entry-paid", previousStatus: "PENDING", forfeited: true }],
    });
  });
});

describe("restoreEffects", () => {
  function makeTx({ activeSanctions = [] as Array<Record<string, unknown>> } = {}) {
    return {
      $executeRaw: vi.fn().mockResolvedValue(1),
      $queryRaw: vi.fn().mockResolvedValue([{ id: "dr-paid-later" }]),
      clipperSanction: { findMany: vi.fn().mockResolvedValue(activeSanctions) },
      clipPost: {
        findMany: vi.fn().mockResolvedValue([
          { id: "post-1", campaignId: "camp", postedAt: new Date("2026-10-15T10:00:00Z") },
          { id: "post-2", campaignId: "camp", postedAt: new Date("2026-10-14T10:00:00Z") },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      clipperApplication: {
        findMany: vi.fn().mockResolvedValue([{ id: "app-1", campaignId: "camp" }]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      dailyRankingEntry: {
        findMany: vi.fn().mockResolvedValue([
          { id: "entry-open", clipPostId: "post-1", dailyRankingId: "dr-open", dailyRanking: { campaignId: "camp" } },
          { id: "entry-late", clipPostId: "post-2", dailyRankingId: "dr-paid-later", dailyRanking: { campaignId: "camp" } },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      topClippersDailyRankingEntry: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      clipperProfile: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
  }
  const effects = {
    posts: [{ id: "post-1", status: "ELIGIBLE" as const, ineligibilityReason: null }],
    applications: [{ id: "app-1", status: "APPROVED" as const, withdrawnAt: null }],
    dailyEntryIds: ["entry-open", "entry-late"],
    ban: { previousStatus: "VERIFIED" as const },
  };
  const input = { clipperProfileId: "clipper-1", restorePrizes: false, actorUserId: "admin-1", now, description: "x" };

  it("restaura o que a advertência mudou, sem mexer em dias que travaram depois", async () => {
    const tx = makeTx();
    const summary = await restoreEffects(tx as never, effects, input);
    expect(tx.clipPost.updateMany).toHaveBeenCalledWith({
      where: {
        id: "post-1",
        status: "DISQUALIFIED",
        ineligibilityReason: { startsWith: "Advertência:" },
      },
      data: { status: "ELIGIBLE", ineligibilityReason: null },
    });
    expect(tx.clipperApplication.updateMany).toHaveBeenCalledWith({
      where: { id: "app-1", status: "REVOKED" },
      data: { status: "APPROVED", withdrawnAt: null },
    });
    expect(tx.dailyRankingEntry.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["entry-open"] } },
      data: { isDisqualified: false },
    });
    expect(summary).toMatchObject({
      restoredPosts: 1,
      restoredApplications: 1,
      restoredEntries: 1,
      keptLockedEntries: 1,
      keptCoveredItems: 0,
      unbanned: true,
    });
  });

  it("não desbane nem devolve inscrições enquanto outro banimento continua ativo", async () => {
    const tx = makeTx({ activeSanctions: [{ type: "PLATFORM_BAN", clipPostId: null, campaignId: null, metadata: null }] });
    const deferred = {};
    const summary = await restoreEffects(tx as never, effects, { ...input, deferred });
    expect(tx.clipperProfile.updateMany).not.toHaveBeenCalled();
    expect(tx.clipperApplication.updateMany).not.toHaveBeenCalled();
    expect(tx.clipPost.updateMany).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ unbanned: false, restoredPosts: 0, restoredApplications: 0 });
    // O outro ban não gravou esses itens: ficam para quando ele for revogado.
    expect(deferred).toEqual({
      posts: effects.posts,
      applications: effects.applications,
      dailyEntryIds: ["entry-open", "entry-late"],
      ban: effects.ban,
    });
  });

  it("não devolve o vídeo quando uma remoção posterior da mesma competição segue ativa", async () => {
    const tx = makeTx({
      activeSanctions: [{ type: "COMPETITION_REMOVAL", clipPostId: null, campaignId: "camp", metadata: null }],
    });
    tx.dailyRankingEntry.findMany.mockResolvedValue([
      { id: "entry-open", clipPostId: "post-1", dailyRankingId: "dr-open", dailyRanking: { campaignId: "camp" } },
    ]);
    const summary = await restoreEffects(tx as never, { posts: effects.posts, dailyEntryIds: ["entry-open"] }, input);
    expect(tx.clipPost.updateMany).not.toHaveBeenCalled();
    expect(tx.dailyRankingEntry.updateMany).not.toHaveBeenCalled();
    expect(summary.keptCoveredItems).toBe(2);
  });

  it("respeita a zeragem de pontos do dia ainda ativa", async () => {
    const tx = makeTx({
      activeSanctions: [
        {
          type: "DAY_POINTS_RESET",
          clipPostId: null,
          campaignId: "camp",
          metadata: { startDate: "2026-10-14T20:00:00.000Z", endDate: "2026-10-15T20:00:00.000Z" },
        },
      ],
    });
    await restoreEffects(tx as never, { posts: effects.posts }, input);
    // post-1 foi postado dentro do dia zerado.
    expect(tx.clipPost.updateMany).not.toHaveBeenCalled();
  });

  it("devolve a posição perdida quando o vídeo não segue punido", async () => {
    const tx = makeTx();
    tx.dailyRankingEntry.findMany.mockResolvedValue([{ id: "entry-paid", clipPostId: "post-1" }]);
    await restoreEffects(
      tx as never,
      { reversedDailyEntries: [{ id: "entry-paid", previousStatus: "PENDING", forfeited: true }] },
      input,
    );
    expect(tx.dailyRankingEntry.updateMany).toHaveBeenCalledWith({
      where: { id: "entry-paid", dailyPrizeStatus: "REVERSED" },
      data: { dailyPrizeStatus: "PENDING" },
    });
  });
});

describe("applyPodiumIneligibility", () => {
  function makeTx({
    lockedDaily = [] as Array<{ id: string }>,
    lockedTop = [] as Array<{ id: string }>,
    topEntry = null as Record<string, unknown> | null,
  } = {}) {
    return {
      $executeRaw: vi.fn().mockResolvedValue(1),
      // lockedDailyRankingIds, depois lockedTopRankingIds
      $queryRaw: vi.fn().mockResolvedValueOnce(lockedDaily).mockResolvedValueOnce(lockedTop),
      clipperApplication: { findUnique: vi.fn().mockResolvedValue({ id: "app-1" }) },
      clipPost: {
        findMany: vi.fn().mockResolvedValue([{ id: "post-1" }, { id: "post-2" }]),
        updateMany: vi.fn(),
      },
      dailyRankingEntry: {
        findMany: vi.fn().mockResolvedValue([
          { id: "entry-1", dailyRankingId: "dr-1", dailyPrizeStatus: "PENDING", dailyPrizePaid: false },
        ]),
        updateMany: vi.fn(),
      },
      wallet: { findUnique: vi.fn().mockResolvedValue({ id: "w1" }) },
      transaction: { findMany: vi.fn().mockResolvedValue([]) },
      campaign: { findUnique: vi.fn().mockResolvedValue({ topClippersRankingEnabled: true }) },
      topClippersDailyRanking: { upsert: vi.fn().mockResolvedValue({ id: "top-1" }) },
      topClippersDailyRankingEntry: {
        findUnique: vi.fn().mockResolvedValue(topEntry),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
  }
  const input = {
    clipperProfileId: "clipper-1",
    campaignId: "camp",
    rankingDate: "2026-10-16",
    actorUserId: "admin-1",
    now,
    sanctionId: "sanction-1",
  };

  it("tira os vídeos do dia dos rankings sem invalidá-los", async () => {
    const tx = makeTx();
    const effects = await applyPodiumIneligibility(tx as never, input);

    // Primeiro o lock da varredura pós-snapshot do league, depois os DailyRanking.
    const firstLock = tx.$executeRaw.mock.calls[0]![0] as { sql: string; values: unknown[] };
    expect(firstLock.sql).toBe("SELECT pg_advisory_xact_lock(hashtext(?))");
    expect(firstLock.values).toEqual(["daily-ranking-snapshot:camp"]);

    // Vídeos postados na janela do dia: [15/10 20:00 UTC, 16/10 20:00 UTC).
    expect(tx.clipPost.findMany.mock.calls[0]![0].where).toEqual({
      applicationId: "app-1",
      campaignId: "camp",
      postedAt: {
        gte: new Date("2026-10-15T20:00:00.000Z"),
        lt: new Date("2026-10-16T20:00:00.000Z"),
      },
    });
    expect(tx.clipPost.updateMany).not.toHaveBeenCalled();
    expect(tx.dailyRankingEntry.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["entry-1"] } },
      data: { isDisqualified: true },
    });
    // Só prêmios do ranking (o bônus de views continua), e o do Top Clipadores do dia.
    const creditQueries = tx.transaction.findMany.mock.calls.map((call) => call[0].where);
    expect(creditQueries[0]).toMatchObject({
      campaignId: "camp",
      clipPostId: { in: ["post-1", "post-2"] },
      type: { in: ["PRIZE_CREDIT"] },
    });
    expect(creditQueries[1]).toMatchObject({
      campaignId: "camp",
      clipPostId: null,
      type: { in: ["PRIZE_CREDIT"] },
      AND: [
        { metadata: { path: ["source"], equals: "top_posters_daily_rank" } },
        { metadata: { path: ["date"], equals: "2026-10-16" } },
      ],
    });
    // Top Clipadores: entrada criada já desclassificada, na posição 0.
    expect(tx.topClippersDailyRanking.upsert.mock.calls[0]![0].where).toEqual({
      campaignId_rankingDate: {
        campaignId: "camp",
        rankingDate: new Date("2026-10-16T00:00:00.000Z"),
      },
    });
    expect(tx.topClippersDailyRankingEntry.create).toHaveBeenCalledWith({
      data: {
        topClippersDailyRankingId: "top-1",
        applicationId: "app-1",
        clipperProfileId: "clipper-1",
        position: 0,
        isDisqualified: true,
        disqualificationReason: "Advertência: inelegível ao pódio",
        disqualifiedAt: now,
        disqualifiedBy: "admin-1",
      },
    });
    expect(effects).toEqual({ dailyEntryIds: ["entry-1"], topClippersExcluded: true });
  });

  it("num dia já pago a posição fica, o prêmio é perdido e o Top Clipadores não muda", async () => {
    const tx = makeTx({ lockedDaily: [{ id: "dr-1" }], lockedTop: [{ id: "top-1" }] });
    const effects = await applyPodiumIneligibility(tx as never, input);
    expect(tx.dailyRankingEntry.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["entry-1"] } },
      data: { dailyPrizeStatus: "REVERSED" },
    });
    expect(tx.topClippersDailyRankingEntry.create).not.toHaveBeenCalled();
    expect(tx.topClippersDailyRankingEntry.update).not.toHaveBeenCalled();
    expect(effects).toEqual({
      reversedDailyEntries: [{ id: "entry-1", previousStatus: "PENDING", forfeited: true }],
      topClippersExcluded: false,
    });
  });

  it("desclassifica a entrada do Top Clipadores que já existe", async () => {
    const tx = makeTx({ topEntry: { id: "top-entry-1", isDisqualified: false, prizeStatus: "PENDING" } });
    await applyPodiumIneligibility(tx as never, input);
    expect(tx.topClippersDailyRankingEntry.update).toHaveBeenCalledWith({
      where: { id: "top-entry-1" },
      data: expect.objectContaining({
        isDisqualified: true,
        disqualificationReason: "Advertência: inelegível ao pódio",
      }),
    });
    expect(tx.topClippersDailyRankingEntry.create).not.toHaveBeenCalled();
  });

  it("sem inscrição na competição não faz nada", async () => {
    const tx = makeTx();
    tx.clipperApplication.findUnique.mockResolvedValue(null);
    expect(await applyPodiumIneligibility(tx as never, input)).toEqual({});
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });
});

describe("restorePodiumDay", () => {
  function makeTx({
    activeSanctions = [] as Array<Record<string, unknown>>,
    lockedDaily = [] as Array<{ id: string }>,
    topEntry = { id: "top-entry-1", position: 0, topClippersDailyRankingId: "top-1" } as Record<
      string,
      unknown
    > | null,
  } = {}) {
    return {
      $executeRaw: vi.fn().mockResolvedValue(1),
      $queryRaw: vi.fn().mockResolvedValueOnce(lockedDaily).mockResolvedValueOnce([]),
      clipperSanction: { findMany: vi.fn().mockResolvedValue(activeSanctions) },
      dailyRankingEntry: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "entry-1",
            dailyRankingId: "dr-1",
            clipPost: { id: "post-1", campaignId: "camp", postedAt: new Date("2026-10-16T12:00:00Z") },
          },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      topClippersDailyRankingEntry: {
        findFirst: vi.fn().mockResolvedValue(topEntry),
        delete: vi.fn(),
        update: vi.fn(),
      },
    };
  }
  const input = { clipperProfileId: "clipper-1", campaignId: "camp", rankingDate: "2026-10-16" };

  it("devolve as entradas do dia, inclusive as que a varredura do league desclassificou", async () => {
    const tx = makeTx();
    const result = await restorePodiumDay(tx as never, input);
    expect(tx.dailyRankingEntry.findMany.mock.calls[0]![0].where).toEqual({
      isDisqualified: true,
      dailyRanking: { campaignId: "camp" },
      application: {
        clipperProfileId: "clipper-1",
        OR: [
          { status: "APPROVED" },
          {
            status: { in: ["WITHDRAWN", "REVOKED"] },
            withdrawnAt: { gte: new Date("2026-10-16T20:00:00.000Z") },
          },
        ],
      },
      // Vídeo invalidado por outro motivo continua fora.
      clipPost: {
        campaignId: "camp",
        status: "ELIGIBLE",
        postedAt: {
          gte: new Date("2026-10-15T20:00:00.000Z"),
          lt: new Date("2026-10-16T20:00:00.000Z"),
        },
      },
    });
    expect(tx.dailyRankingEntry.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["entry-1"] } },
      data: { isDisqualified: false },
    });
    // A entrada criada só para tirar o clipador do Top Clipadores some.
    expect(tx.topClippersDailyRankingEntry.findFirst.mock.calls[0]![0].where).toMatchObject({
      isDisqualified: true,
      disqualificationReason: "Advertência: inelegível ao pódio",
      ranking: { campaignId: "camp", rankingDate: new Date("2026-10-16T00:00:00.000Z") },
    });
    expect(tx.topClippersDailyRankingEntry.delete).toHaveBeenCalledWith({ where: { id: "top-entry-1" } });
    expect(result).toEqual({ restoredEntries: 2, keptLockedEntries: 0, keptCoveredItems: 0 });
  });

  it("uma entrada do Top Clipadores com posição volta a valer", async () => {
    const tx = makeTx({ topEntry: { id: "top-entry-1", position: 4, topClippersDailyRankingId: "top-1" } });
    await restorePodiumDay(tx as never, input);
    expect(tx.topClippersDailyRankingEntry.delete).not.toHaveBeenCalled();
    expect(tx.topClippersDailyRankingEntry.update).toHaveBeenCalledWith({
      where: { id: "top-entry-1" },
      data: {
        isDisqualified: false,
        disqualificationReason: null,
        disqualifiedAt: null,
        disqualifiedBy: null,
      },
    });
  });

  it("mantém tudo fora enquanto outro pódio do mesmo dia continua ativo", async () => {
    const tx = makeTx({
      activeSanctions: [
        {
          type: "PODIUM_INELIGIBLE",
          clipPostId: null,
          campaignId: "camp",
          startsAt: new Date("2026-10-15T20:00:00.000Z"),
          endsAt: new Date("2026-10-16T20:00:00.000Z"),
          metadata: { rankingDate: "2026-10-16" },
        },
      ],
    });
    const result = await restorePodiumDay(tx as never, input);
    expect(tx.dailyRankingEntry.updateMany).not.toHaveBeenCalled();
    expect(tx.topClippersDailyRankingEntry.delete).not.toHaveBeenCalled();
    expect(result).toEqual({ restoredEntries: 0, keptLockedEntries: 0, keptCoveredItems: 2 });
  });

  it("dia pago depois da punição continua como foi pago", async () => {
    const tx = makeTx({ lockedDaily: [{ id: "dr-1" }], topEntry: null });
    const result = await restorePodiumDay(tx as never, input);
    expect(tx.dailyRankingEntry.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ restoredEntries: 0, keptLockedEntries: 1, keptCoveredItems: 0 });
  });
});

describe("restoreEffects com inelegível ao pódio ativo", () => {
  it("devolve o vídeo, mas a entrada do dia continua fora do ranking", async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      $queryRaw: vi.fn().mockResolvedValue([]),
      clipperSanction: {
        findMany: vi.fn().mockResolvedValue([
          {
            type: "PODIUM_INELIGIBLE",
            clipPostId: null,
            campaignId: "camp",
            startsAt: new Date("2026-10-15T20:00:00.000Z"),
            endsAt: new Date("2026-10-16T20:00:00.000Z"),
            metadata: null,
          },
        ]),
      },
      clipPost: {
        findMany: vi.fn().mockResolvedValue([
          { id: "post-1", campaignId: "camp", postedAt: new Date("2026-10-16T12:00:00Z") },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      dailyRankingEntry: {
        findMany: vi.fn().mockResolvedValue([
          { id: "entry-1", clipPostId: "post-1", dailyRankingId: "dr-1", dailyRanking: { campaignId: "camp" } },
        ]),
        updateMany: vi.fn(),
      },
      topClippersDailyRankingEntry: {
        findMany: vi.fn().mockResolvedValue([
          { id: "top-entry-1", ranking: { campaignId: "camp", rankingDate: new Date("2026-10-16T00:00:00.000Z") } },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const summary = await restoreEffects(
      tx as never,
      {
        posts: [{ id: "post-1", status: "ELIGIBLE", ineligibilityReason: null }],
        dailyEntryIds: ["entry-1"],
        topEntryIds: ["top-entry-1"],
      },
      { clipperProfileId: "clipper-1", restorePrizes: false, actorUserId: "admin-1", now, description: "x" },
    );
    expect(tx.clipPost.updateMany).toHaveBeenCalledOnce();
    expect(tx.dailyRankingEntry.updateMany).not.toHaveBeenCalled();
    // Fica fora só pelo pódio: passa a ter o motivo dele, para a revogação do pódio devolvê-la.
    expect(tx.topClippersDailyRankingEntry.updateMany).toHaveBeenCalledOnce();
    expect(tx.topClippersDailyRankingEntry.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["top-entry-1"] } },
      data: { disqualificationReason: "Advertência: inelegível ao pódio" },
    });
    expect(summary).toMatchObject({ restoredPosts: 1, restoredEntries: 0, keptCoveredItems: 2 });
  });
});

describe("restoreEffects depois de um pódio já desfeito", () => {
  it("recalcula o dia do pódio quando o vídeo volta a valer", async () => {
    const postedAt = new Date("2026-10-16T12:00:00Z");
    const revokedPodium = {
      type: "PODIUM_INELIGIBLE",
      campaignId: "camp",
      revokedAt: new Date("2026-10-16T13:00:00Z"),
      metadata: { rankingDate: "2026-10-16" },
    };
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      $queryRaw: vi.fn().mockResolvedValue([]),
      clipperSanction: {
        // Cobertura ativa (nenhuma), pódios desfeitos, cobertura do recálculo.
        findMany: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([revokedPodium])
          .mockResolvedValue([]),
      },
      clipPost: {
        findMany: vi.fn().mockResolvedValue([{ id: "post-1", campaignId: "camp", postedAt }]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      dailyRankingEntry: {
        // A entry que o pódio desclassificou e a invalidação não chegou a gravar.
        findMany: vi.fn().mockResolvedValue([
          { id: "entry-1", dailyRankingId: "dr-1", clipPost: { id: "post-1", campaignId: "camp", postedAt } },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      topClippersDailyRankingEntry: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const summary = await restoreEffects(
      tx as never,
      { posts: [{ id: "post-1", status: "ELIGIBLE", ineligibilityReason: null }] },
      { clipperProfileId: "clipper-1", restorePrizes: false, actorUserId: "admin-1", now, description: "x" },
    );
    expect(tx.clipperSanction.findMany.mock.calls[1]![0].where).toEqual({
      clipperProfileId: "clipper-1",
      type: "PODIUM_INELIGIBLE",
      campaignId: { in: ["camp"] },
      revokedAt: { not: null },
    });
    expect(tx.dailyRankingEntry.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["entry-1"] } },
      data: { isDisqualified: false },
    });
    expect(summary).toMatchObject({ restoredPosts: 1, restoredEntries: 1 });
  });
});
