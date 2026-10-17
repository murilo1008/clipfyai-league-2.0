import {
  Prisma,
  type ApplicationStatus,
  type ClipPostStatus,
  type ClipperVerificationStatus,
  type TransactionType,
} from "@prisma/client";

import {
  DISCIPLINE_INVALIDATION_REASON_PREFIX,
  DISCIPLINE_PODIUM_REASON,
  REVERSED_PRIZE_STATUS,
  WARNING_PRIZE_RESTORE_ACTION,
  WARNING_PRIZE_REVERSAL_ACTION,
} from "@/lib/clipper-discipline/constants";
import { rankingDayWindowUtc } from "@/lib/clipper-discipline/podium";
import { dailyRankingSnapshotLockSql } from "@/lib/clipper-discipline/podium-sql";
import { rankingApplicationWhere } from "@/lib/competition-participation";
import { findReversedPrizeCreditIds } from "@/server/prize-reversals";

import { activeSanctionWhere } from "./restrictions";

type Tx = Prisma.TransactionClient;

/**
 * Tudo que uma advertência (ou punição avulsa) mudou fora das próprias
 * tabelas, com o estado anterior, para a revogação restaurar só isso.
 */
export type DisciplineEffects = {
  posts?: {
    id: string;
    status: ClipPostStatus;
    ineligibilityReason: string | null;
  }[];
  /** DailyRankingEntry que passaram a isDisqualified (dias destravados). */
  dailyEntryIds?: string[];
  /** TopClippersDailyRankingEntry que passaram a isDisqualified. */
  topEntryIds?: string[];
  /**
   * DailyRankingEntry de dias travados que ficaram REVERSED: pagas cujo
   * crédito foi estornado, ou ainda sem crédito (`forfeited`), cujo prêmio o
   * clipador perde sem mudar as posições já pagas.
   */
  reversedDailyEntries?: {
    id: string;
    previousStatus: string;
    forfeited?: boolean;
  }[];
  applications?: {
    id: string;
    status: ApplicationStatus;
    withdrawnAt: string | null;
  }[];
  reversals?: {
    adjustmentId: string;
    creditId: string;
    amount: number;
    dailyRankingEntryId?: string;
  }[];
  ban?: { previousStatus: ClipperVerificationStatus };
};

export function mergeEffects(
  target: DisciplineEffects,
  extra: DisciplineEffects,
): DisciplineEffects {
  const keys = [
    "posts",
    "dailyEntryIds",
    "topEntryIds",
    "reversedDailyEntries",
    "applications",
    "reversals",
  ] as const;
  for (const key of keys) {
    const values = extra[key];
    if (values && values.length > 0) {
      (target[key] as unknown[] | undefined) = [
        ...((target[key] as unknown[] | undefined) ?? []),
        ...values,
      ];
    }
  }
  if (extra.ban) target.ban = extra.ban;
  return target;
}

export function parseEffects(value: unknown): DisciplineEffects {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as DisciplineEffects;
}

const ROUND = (value: number) => Math.round(value * 100) / 100;

// ---------------------------------------------------------------------------
// Locks e dias travados
// ---------------------------------------------------------------------------

export async function lockClipperProfile(tx: Tx, clipperProfileId: string) {
  await tx.$executeRaw`
    SELECT id FROM "ClipperProfile" WHERE id = ${clipperProfileId} FOR UPDATE
  `;
}

/**
 * Dias do ranking diário que não podem mais mudar de posição: já creditados
 * na carteira ou com PIX em andamento. Pega o lock da varredura pós-snapshot
 * do league (ou ela vê esta advertência comitada, ou esta advertência vê as
 * entries do snapshot) e trava os DailyRanking da campanha, o mesmo lock que
 * o snapshot do league pega ao fazer o upsert do dia.
 */
export async function lockedDailyRankingIds(
  tx: Tx,
  campaignId: string,
): Promise<Set<string>> {
  await tx.$executeRaw(dailyRankingSnapshotLockSql(campaignId));
  await tx.$executeRaw`
    SELECT id FROM "DailyRanking" WHERE "campaignId" = ${campaignId} FOR UPDATE
  `;
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT dr."id"
    FROM "DailyRanking" dr
    WHERE dr."campaignId" = ${campaignId}
      AND (
        dr."dailyPixPayoutCompleted" = true
        OR EXISTS (
          SELECT 1 FROM "DailyRankingEntry" e
          WHERE e."dailyRankingId" = dr."id"
            AND (
              e."dailyPrizeStatus" IN ('PAID', ${REVERSED_PRIZE_STATUS})
              OR e."dailyPrizePaid" = true
              OR e."dailyPixStatus" IN ('PAID', 'PROCESSING', 'QUEUED')
            )
        )
      )
  `;
  return new Set(rows.map((row) => row.id));
}

/** Rankings do Top Clipadores com alguma posição já paga. */
async function lockedTopRankingIds(
  tx: Tx,
  campaignId: string,
): Promise<Set<string>> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT r."id"
    FROM "TopClippersDailyRanking" r
    WHERE r."campaignId" = ${campaignId}
      AND EXISTS (
        SELECT 1 FROM "TopClippersDailyRankingEntry" e
        WHERE e."topClippersDailyRankingId" = r."id"
          AND e."prizeStatus" IN ('PAID', ${REVERSED_PRIZE_STATUS})
      )
  `;
  return new Set(rows.map((row) => row.id));
}

// ---------------------------------------------------------------------------
// Vídeos e entradas do ranking
// ---------------------------------------------------------------------------

/** Vídeos passam a DISQUALIFIED (o league nunca promove esse status). */
export async function invalidatePosts(
  tx: Tx,
  input: { postIds: readonly string[]; reason: string },
): Promise<DisciplineEffects> {
  if (input.postIds.length === 0) return {};
  const posts = await tx.clipPost.findMany({
    where: { id: { in: [...input.postIds] }, status: { not: "DISQUALIFIED" } },
    select: { id: true, status: true, ineligibilityReason: true },
  });
  if (posts.length === 0) return {};
  await tx.clipPost.updateMany({
    where: { id: { in: posts.map((post) => post.id) } },
    data: { status: "DISQUALIFIED", ineligibilityReason: input.reason },
  });
  return { posts };
}

/**
 * Tira os vídeos dos rankings diários ainda destravados. Nos travados a
 * posição fica como está (o PIX do league segue as posições gravadas) e o
 * prêmio, se houver, é estornado à parte.
 */
async function disqualifyDailyEntries(
  tx: Tx,
  input: {
    where: Prisma.DailyRankingEntryWhereInput;
    lockedRankingIds: Set<string>;
  },
): Promise<DisciplineEffects> {
  const entries = await tx.dailyRankingEntry.findMany({
    where: { ...input.where, isDisqualified: false },
    select: {
      id: true,
      dailyRankingId: true,
      dailyPrizeStatus: true,
      dailyPrizePaid: true,
    },
  });
  const unlocked = entries
    .filter((entry) => !input.lockedRankingIds.has(entry.dailyRankingId))
    .map((entry) => entry.id);
  // Dia travado com a posição ainda sem crédito: o prêmio fica perdido
  // (REVERSED), senão o dia nunca fecha (o front pula o vídeo desqualificado
  // e o league não paga o que não foi creditado).
  const forfeited = entries.filter(
    (entry) =>
      input.lockedRankingIds.has(entry.dailyRankingId) &&
      !entry.dailyPrizePaid &&
      entry.dailyPrizeStatus !== "PAID" &&
      entry.dailyPrizeStatus !== REVERSED_PRIZE_STATUS,
  );
  const effects: DisciplineEffects = {};
  if (unlocked.length > 0) {
    await tx.dailyRankingEntry.updateMany({
      where: { id: { in: unlocked } },
      data: { isDisqualified: true },
    });
    effects.dailyEntryIds = unlocked;
  }
  if (forfeited.length > 0) {
    await tx.dailyRankingEntry.updateMany({
      where: { id: { in: forfeited.map((entry) => entry.id) } },
      data: { dailyPrizeStatus: REVERSED_PRIZE_STATUS },
    });
    effects.reversedDailyEntries = forfeited.map((entry) => ({
      id: entry.id,
      previousStatus: entry.dailyPrizeStatus,
      forfeited: true,
    }));
  }
  return effects;
}

async function disqualifyTopEntries(
  tx: Tx,
  input: {
    campaignId: string;
    where: Prisma.TopClippersDailyRankingEntryWhereInput;
    reason: string;
    actorUserId: string;
    now: Date;
  },
): Promise<DisciplineEffects> {
  const locked = await lockedTopRankingIds(tx, input.campaignId);
  const entries = await tx.topClippersDailyRankingEntry.findMany({
    where: {
      ...input.where,
      isDisqualified: false,
      prizeStatus: { not: "PAID" },
      ranking: { campaignId: input.campaignId },
    },
    select: { id: true, topClippersDailyRankingId: true },
  });
  const unlocked = entries
    .filter((entry) => !locked.has(entry.topClippersDailyRankingId))
    .map((entry) => entry.id);
  if (unlocked.length === 0) return {};
  await tx.topClippersDailyRankingEntry.updateMany({
    where: { id: { in: unlocked } },
    data: {
      isDisqualified: true,
      disqualificationReason: input.reason,
      disqualifiedAt: input.now,
      disqualifiedBy: input.actorUserId,
    },
  });
  return { topEntryIds: unlocked };
}

// ---------------------------------------------------------------------------
// Estorno de prêmios
// ---------------------------------------------------------------------------

/**
 * Estorna créditos de prêmio ainda válidos com um ADJUSTMENT negativo cada.
 * O saldo pode ficar negativo (o prêmio já saiu por PIX): vira dívida, e a
 * retenção de pagamento é criada por quem chamou (syncDebtHold).
 */
export async function reversePrizeCredits(
  tx: Tx,
  input: {
    clipperProfileId: string;
    where: Prisma.TransactionWhereInput;
    /** Padrão: prêmios e bônus. */
    types?: readonly TransactionType[];
    description: string;
    actorUserId: string;
    now: Date;
    warningId?: string;
    sanctionId?: string;
  },
): Promise<DisciplineEffects> {
  const wallet = await tx.wallet.findUnique({
    where: { clipperProfileId: input.clipperProfileId },
    select: { id: true },
  });
  if (!wallet) return {};

  const credits = await tx.transaction.findMany({
    where: {
      ...input.where,
      walletId: wallet.id,
      type: { in: [...(input.types ?? ["PRIZE_CREDIT", "BONUS"])] },
      status: "COMPLETED",
      amount: { gt: 0 },
    },
    select: {
      id: true,
      amount: true,
      campaignId: true,
      clipPostId: true,
      rankingPosition: true,
      metadata: true,
    },
    orderBy: { createdAt: "asc" },
  });
  if (credits.length === 0) return {};

  const reversedIds = await findReversedPrizeCreditIds(
    tx,
    credits.map((credit) => credit.id),
  );
  const toReverse = credits.filter((credit) => !reversedIds.has(credit.id));
  if (toReverse.length === 0) return {};

  // Mesma ordem de locks do payout do league: entry do ranking, depois carteira.
  const entryIdsToLock = toReverse
    .map(
      (credit) =>
        (credit.metadata as { dailyRankingEntryId?: unknown } | null)
          ?.dailyRankingEntryId,
    )
    .filter((id): id is string => typeof id === "string");
  if (entryIdsToLock.length > 0) {
    await tx.$executeRaw`
      SELECT id FROM "DailyRankingEntry"
      WHERE id IN (${Prisma.join(entryIdsToLock)})
      ORDER BY id
      FOR UPDATE
    `;
  }
  await tx.$executeRaw`SELECT id FROM "Wallet" WHERE id = ${wallet.id} FOR UPDATE`;

  const current = await tx.wallet.findUniqueOrThrow({
    where: { id: wallet.id },
    select: { balance: true },
  });
  let balance = current.balance;
  const reversals: NonNullable<DisciplineEffects["reversals"]> = [];
  const reversedDailyEntries: NonNullable<
    DisciplineEffects["reversedDailyEntries"]
  > = [];

  for (const credit of toReverse) {
    const amount = ROUND(credit.amount);
    const balanceAfter = ROUND(balance - amount);
    const dailyRankingEntryId = (
      credit.metadata as { dailyRankingEntryId?: unknown } | null
    )?.dailyRankingEntryId;
    const adjustment = await tx.transaction.create({
      data: {
        walletId: wallet.id,
        type: "ADJUSTMENT",
        status: "COMPLETED",
        amount: -amount,
        balanceBefore: balance,
        balanceAfter,
        description: input.description,
        campaignId: credit.campaignId,
        clipPostId: credit.clipPostId,
        rankingPosition: credit.rankingPosition,
        idempotencyKey: `clipper-warning-reversal:${credit.id}:${input.warningId ?? input.sanctionId ?? "manual"}`,
        processedBy: input.actorUserId,
        processedAt: input.now,
        proofUrls: [],
        metadata: {
          action: WARNING_PRIZE_REVERSAL_ACTION,
          reversedPrizeCreditId: credit.id,
          ...(input.warningId ? { warningId: input.warningId } : {}),
          ...(input.sanctionId ? { sanctionId: input.sanctionId } : {}),
          ...(typeof dailyRankingEntryId === "string"
            ? { dailyRankingEntryId }
            : {}),
        },
      },
      select: { id: true },
    });
    balance = balanceAfter;
    reversals.push({
      adjustmentId: adjustment.id,
      creditId: credit.id,
      amount,
      ...(typeof dailyRankingEntryId === "string" ? { dailyRankingEntryId } : {}),
    });

    if (typeof dailyRankingEntryId === "string") {
      const entry = await tx.dailyRankingEntry.findUnique({
        where: { id: dailyRankingEntryId },
        select: { dailyPrizeStatus: true },
      });
      if (entry && entry.dailyPrizeStatus !== REVERSED_PRIZE_STATUS) {
        await tx.dailyRankingEntry.update({
          where: { id: dailyRankingEntryId },
          data: { dailyPrizeStatus: REVERSED_PRIZE_STATUS },
        });
        reversedDailyEntries.push({
          id: dailyRankingEntryId,
          previousStatus: entry.dailyPrizeStatus,
        });
      }
    }
  }

  const total = ROUND(reversals.reduce((sum, row) => sum + row.amount, 0));
  await tx.wallet.update({
    where: { id: wallet.id },
    data: {
      balance: { decrement: total },
      totalEarned: { decrement: total },
    },
  });
  return { reversals, reversedDailyEntries };
}

// ---------------------------------------------------------------------------
// Retenção de pagamento
// ---------------------------------------------------------------------------

export const WALLET_HOLD_BLOCK_REASON = "Pagamento retido (advertência)";

/**
 * Wallet.isActive espelha as retenções em vigor: false enquanto houver uma
 * sanção PAYOUT_HOLD ativa. O league pula o PIX de carteiras inativas e o
 * saque/PIX manual do frontend também checam isActive.
 */
export async function syncWalletHold(
  tx: Tx,
  clipperProfileId: string,
  now: Date,
) {
  const holds = await tx.clipperSanction.count({
    where: activeSanctionWhere(clipperProfileId, now, ["PAYOUT_HOLD"]),
  });
  const wallet = await tx.wallet.findUnique({
    where: { clipperProfileId },
    select: { id: true, isActive: true, blockReason: true },
  });
  if (holds > 0) {
    if (!wallet) {
      await tx.wallet.create({
        data: {
          clipperProfileId,
          isActive: false,
          blockedAt: now,
          blockReason: WALLET_HOLD_BLOCK_REASON,
        },
      });
    } else if (wallet.isActive) {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          isActive: false,
          blockedAt: now,
          blockReason: WALLET_HOLD_BLOCK_REASON,
        },
      });
    }
    return true;
  }
  // Só libera um bloqueio feito pela retenção (outro motivo fica como está).
  if (
    wallet &&
    !wallet.isActive &&
    wallet.blockReason === WALLET_HOLD_BLOCK_REASON
  ) {
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { isActive: true, blockedAt: null, blockReason: null },
    });
  }
  return false;
}

export const DEBT_HOLD_REASON =
  "Saldo devedor após estorno de prêmios por advertência";

/**
 * Retenção "saldo devedor": existe enquanto o saldo estiver negativo (prêmio
 * estornado que já tinha saído por PIX). Não pertence a nenhuma advertência,
 * para que revogar uma delas não a libere com a dívida ainda aberta; sai
 * sozinha quando o saldo volta a ficar >= 0 numa ação de advertência, ou pelo
 * admin ("Liberar pagamento").
 */
export async function syncDebtHold(
  tx: Tx,
  input: { clipperProfileId: string; actorUserId: string; now: Date },
): Promise<string | null> {
  const wallet = await tx.wallet.findUnique({
    where: { clipperProfileId: input.clipperProfileId },
    select: { balance: true },
  });
  const inDebt = !!wallet && wallet.balance < -0.005;
  const existing = await tx.clipperSanction.findFirst({
    where: {
      ...activeSanctionWhere(input.clipperProfileId, input.now, ["PAYOUT_HOLD"]),
      reason: DEBT_HOLD_REASON,
    },
    select: { id: true },
  });
  if (!inDebt) {
    if (existing) {
      await tx.clipperSanction.updateMany({
        where: {
          ...activeSanctionWhere(input.clipperProfileId, input.now, ["PAYOUT_HOLD"]),
          reason: DEBT_HOLD_REASON,
        },
        data: {
          revokedAt: input.now,
          revokedById: input.actorUserId,
          revokeReason: "Saldo quitado",
        },
      });
    }
    return null;
  }
  if (existing) return existing.id;
  const sanction = await tx.clipperSanction.create({
    data: {
      clipperProfileId: input.clipperProfileId,
      warningId: null,
      type: "PAYOUT_HOLD",
      startsAt: input.now,
      endsAt: null,
      reason: DEBT_HOLD_REASON,
      createdById: input.actorUserId,
      metadata: { debtBalance: wallet.balance },
    },
    select: { id: true },
  });
  return sanction.id;
}

/**
 * Corte para retirar retroativamente um redutor de score: os vídeos dos dias
 * já creditados/pagos continuam como foram pagos; dali em diante o redutor
 * deixa de valer. É o fim da janela do último dia travado nas competições do
 * clipador (null = nenhum dia travado).
 */
export async function lastLockedPostedAtCutoff(
  tx: Tx,
  clipperProfileId: string,
): Promise<Date | null> {
  const rows = await tx.$queryRaw<{ day: Date | null }[]>`
    SELECT MAX(dr."rankingDate") AS "day"
    FROM "DailyRanking" dr
    WHERE dr."campaignId" IN (
        SELECT ca."campaignId" FROM "ClipperApplication" ca
        WHERE ca."clipperProfileId" = ${clipperProfileId}
      )
      AND (
        dr."dailyPixPayoutCompleted" = true
        OR EXISTS (
          SELECT 1 FROM "DailyRankingEntry" e
          WHERE e."dailyRankingId" = dr."id"
            AND (
              e."dailyPrizeStatus" IN ('PAID', ${REVERSED_PRIZE_STATUS})
              OR e."dailyPrizePaid" = true
              OR e."dailyPixStatus" IN ('PAID', 'PROCESSING', 'QUEUED')
            )
        )
      )
  `;
  const day = rows[0]?.day;
  if (!day) return null;
  // Janela do ranking D: [D-1 20:00 UTC, D 20:00 UTC).
  return new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 20),
  );
}

// ---------------------------------------------------------------------------
// Efeitos compostos
// ---------------------------------------------------------------------------

/** Nível 0/1 (e qualquer nível com vídeo): o vídeo não pontua e o prêmio dele é estornado. */
export async function applyVideoInvalidation(
  tx: Tx,
  input: {
    clipperProfileId: string;
    campaignId: string;
    clipPostId: string;
    reason: string;
    actorUserId: string;
    now: Date;
    warningId?: string;
  },
): Promise<DisciplineEffects> {
  const effects: DisciplineEffects = {};
  const locked = await lockedDailyRankingIds(tx, input.campaignId);
  mergeEffects(
    effects,
    await invalidatePosts(tx, { postIds: [input.clipPostId], reason: input.reason }),
  );
  mergeEffects(
    effects,
    await disqualifyDailyEntries(tx, {
      where: { clipPostId: input.clipPostId },
      lockedRankingIds: locked,
    }),
  );
  mergeEffects(
    effects,
    await reversePrizeCredits(tx, {
      clipperProfileId: input.clipperProfileId,
      where: { campaignId: input.campaignId, clipPostId: input.clipPostId },
      description: "Estorno de prêmio: vídeo invalidado por advertência",
      actorUserId: input.actorUserId,
      now: input.now,
      warningId: input.warningId,
    }),
  );
  return effects;
}

/**
 * Remove o clipador da competição: inscrição REVOKED (com withdrawnAt para
 * preservar os rankings encerrados antes), vídeos DISQUALIFIED, saída dos
 * rankings ainda destravados e, opcionalmente, estorno dos prêmios dela.
 */
export async function applyCompetitionRemoval(
  tx: Tx,
  input: {
    clipperProfileId: string;
    campaignId: string;
    reversePrizes: boolean;
    reason: string;
    actorUserId: string;
    now: Date;
    warningId?: string;
  },
): Promise<DisciplineEffects> {
  const effects: DisciplineEffects = {};
  await tx.$executeRaw`
    SELECT id FROM "ClipperApplication"
    WHERE "campaignId" = ${input.campaignId}
      AND "clipperProfileId" = ${input.clipperProfileId}
    FOR UPDATE
  `;
  const application = await tx.clipperApplication.findUnique({
    where: {
      campaignId_clipperProfileId: {
        campaignId: input.campaignId,
        clipperProfileId: input.clipperProfileId,
      },
    },
    select: { id: true, status: true, withdrawnAt: true },
  });

  const locked = await lockedDailyRankingIds(tx, input.campaignId);

  if (application) {
    if (application.status !== "REVOKED") {
      const withdrawnAt =
        application.withdrawnAt && application.withdrawnAt < input.now
          ? application.withdrawnAt
          : input.now;
      await tx.clipperApplication.update({
        where: { id: application.id },
        data: { status: "REVOKED", withdrawnAt },
      });
      effects.applications = [
        {
          id: application.id,
          status: application.status,
          withdrawnAt: application.withdrawnAt?.toISOString() ?? null,
        },
      ];
    }
    const posts = await tx.clipPost.findMany({
      where: { applicationId: application.id },
      select: { id: true },
    });
    mergeEffects(
      effects,
      await invalidatePosts(tx, {
        postIds: posts.map((post) => post.id),
        reason: input.reason,
      }),
    );
    mergeEffects(
      effects,
      await disqualifyDailyEntries(tx, {
        where: { applicationId: application.id },
        lockedRankingIds: locked,
      }),
    );
    mergeEffects(
      effects,
      await disqualifyTopEntries(tx, {
        campaignId: input.campaignId,
        where: { applicationId: application.id },
        reason: input.reason,
        actorUserId: input.actorUserId,
        now: input.now,
      }),
    );
  }

  if (input.reversePrizes) {
    mergeEffects(
      effects,
      await reversePrizeCredits(tx, {
        clipperProfileId: input.clipperProfileId,
        where: { campaignId: input.campaignId },
        description: "Estorno de prêmios: removido da competição por advertência",
        actorUserId: input.actorUserId,
        now: input.now,
        warningId: input.warningId,
      }),
    );
  }
  return effects;
}

/** Zera os pontos de um dia: os vídeos postados na janela do dia deixam de pontuar. */
export async function applyDayPointsReset(
  tx: Tx,
  input: {
    clipperProfileId: string;
    campaignId: string;
    window: { startDate: Date; endDate: Date };
    reason: string;
    actorUserId: string;
    now: Date;
    sanctionId: string;
  },
): Promise<DisciplineEffects> {
  const effects: DisciplineEffects = {};
  const application = await tx.clipperApplication.findUnique({
    where: {
      campaignId_clipperProfileId: {
        campaignId: input.campaignId,
        clipperProfileId: input.clipperProfileId,
      },
    },
    select: { id: true },
  });
  if (!application) return effects;
  const locked = await lockedDailyRankingIds(tx, input.campaignId);
  const posts = await tx.clipPost.findMany({
    where: {
      applicationId: application.id,
      postedAt: { gte: input.window.startDate, lt: input.window.endDate },
    },
    select: { id: true },
  });
  const postIds = posts.map((post) => post.id);
  if (postIds.length === 0) return effects;
  mergeEffects(effects, await invalidatePosts(tx, { postIds, reason: input.reason }));
  mergeEffects(
    effects,
    await disqualifyDailyEntries(tx, {
      where: { clipPostId: { in: postIds } },
      lockedRankingIds: locked,
    }),
  );
  mergeEffects(
    effects,
    await reversePrizeCredits(tx, {
      clipperProfileId: input.clipperProfileId,
      where: { campaignId: input.campaignId, clipPostId: { in: postIds } },
      description: "Estorno de prêmio: pontos do dia zerados por advertência",
      actorUserId: input.actorUserId,
      now: input.now,
      sanctionId: input.sanctionId,
    }),
  );
  return effects;
}

/** TopClippersDailyRanking.rankingDate do dia (meia-noite UTC). */
function topClippersRankingDate(rankingDate: string) {
  return new Date(`${rankingDate}T00:00:00.000Z`);
}

/**
 * Tira o clipador do Top Clipadores do dia: a entrada fica desclassificada
 * (criada, se ainda não existir, com a posição 0) e o ranking ao vivo e o
 * pagamento passam a pulá-lo. Um dia com posição já paga fica como está.
 */
async function excludeFromTopClippersDay(
  tx: Tx,
  input: {
    campaignId: string;
    applicationId: string;
    clipperProfileId: string;
    rankingDate: string;
    actorUserId: string;
    now: Date;
  },
): Promise<boolean> {
  const campaign = await tx.campaign.findUnique({
    where: { id: input.campaignId },
    select: { topClippersRankingEnabled: true },
  });
  if (!campaign?.topClippersRankingEnabled) return false;
  const ranking = await tx.topClippersDailyRanking.upsert({
    where: {
      campaignId_rankingDate: {
        campaignId: input.campaignId,
        rankingDate: topClippersRankingDate(input.rankingDate),
      },
    },
    create: {
      campaignId: input.campaignId,
      rankingDate: topClippersRankingDate(input.rankingDate),
    },
    update: {},
    select: { id: true },
  });
  const locked = await lockedTopRankingIds(tx, input.campaignId);
  if (locked.has(ranking.id)) return false;
  const data = {
    isDisqualified: true,
    disqualificationReason: DISCIPLINE_PODIUM_REASON,
    disqualifiedAt: input.now,
    disqualifiedBy: input.actorUserId,
  };
  const entry = await tx.topClippersDailyRankingEntry.findUnique({
    where: {
      topClippersDailyRankingId_applicationId: {
        topClippersDailyRankingId: ranking.id,
        applicationId: input.applicationId,
      },
    },
    select: { id: true, isDisqualified: true, prizeStatus: true },
  });
  if (entry) {
    if (entry.isDisqualified || entry.prizeStatus === "PAID") return false;
    await tx.topClippersDailyRankingEntry.update({ where: { id: entry.id }, data });
    return true;
  }
  await tx.topClippersDailyRankingEntry.create({
    data: {
      topClippersDailyRankingId: ranking.id,
      applicationId: input.applicationId,
      clipperProfileId: input.clipperProfileId,
      position: 0,
      ...data,
    },
  });
  return true;
}

/**
 * Inelegível ao pódio: os vídeos do clipador postados no dia do ranking saem
 * dos rankings diários da competição (ranking diário e Top Clipadores) sem
 * ser invalidados, então o mensal continua contando. Num dia travado a posição
 * fica e o prêmio do dia é estornado. Sem snapshot ainda, o ranking ao vivo e
 * a varredura pós-snapshot do league aplicam a sanção pela janela dela.
 */
export async function applyPodiumIneligibility(
  tx: Tx,
  input: {
    clipperProfileId: string;
    campaignId: string;
    rankingDate: string;
    actorUserId: string;
    now: Date;
    sanctionId: string;
  },
): Promise<DisciplineEffects & { topClippersExcluded?: boolean }> {
  const effects: DisciplineEffects = {};
  const application = await tx.clipperApplication.findUnique({
    where: {
      campaignId_clipperProfileId: {
        campaignId: input.campaignId,
        clipperProfileId: input.clipperProfileId,
      },
    },
    select: { id: true },
  });
  if (!application) return effects;
  const window = rankingDayWindowUtc(input.rankingDate);
  const locked = await lockedDailyRankingIds(tx, input.campaignId);
  const posts = await tx.clipPost.findMany({
    where: {
      applicationId: application.id,
      campaignId: input.campaignId,
      postedAt: { gte: window.startDate, lt: window.endDate },
    },
    select: { id: true },
  });
  const postIds = posts.map((post) => post.id);
  if (postIds.length > 0) {
    mergeEffects(
      effects,
      await disqualifyDailyEntries(tx, {
        where: {
          clipPostId: { in: postIds },
          dailyRanking: { campaignId: input.campaignId },
        },
        lockedRankingIds: locked,
      }),
    );
    // Só o prêmio do ranking diário: o bônus de views e o mensal continuam.
    mergeEffects(
      effects,
      await reversePrizeCredits(tx, {
        clipperProfileId: input.clipperProfileId,
        where: { campaignId: input.campaignId, clipPostId: { in: postIds } },
        types: ["PRIZE_CREDIT"],
        description: "Estorno de prêmio: inelegível ao pódio no dia",
        actorUserId: input.actorUserId,
        now: input.now,
        sanctionId: input.sanctionId,
      }),
    );
  }
  const topClippersExcluded = await excludeFromTopClippersDay(tx, {
    campaignId: input.campaignId,
    applicationId: application.id,
    clipperProfileId: input.clipperProfileId,
    rankingDate: input.rankingDate,
    actorUserId: input.actorUserId,
    now: input.now,
  });
  mergeEffects(
    effects,
    await reversePrizeCredits(tx, {
      clipperProfileId: input.clipperProfileId,
      where: {
        campaignId: input.campaignId,
        clipPostId: null,
        AND: [
          { metadata: { path: ["source"], equals: "top_posters_daily_rank" } },
          { metadata: { path: ["date"], equals: input.rankingDate } },
        ],
      },
      types: ["PRIZE_CREDIT"],
      description: "Estorno de prêmio do Top Clipadores: inelegível ao pódio no dia",
      actorUserId: input.actorUserId,
      now: input.now,
      sanctionId: input.sanctionId,
    }),
  );
  return { ...effects, topClippersExcluded };
}

const BAN_ACTIVE_CAMPAIGN_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "ACTIVE",
  "PAUSED",
] as const;

/**
 * Banimento: conta BANNED e saída das competições em andamento (sem estornar
 * o que já foi ganho). A retenção da carteira é uma sanção PAYOUT_HOLD à parte.
 */
export async function applyPlatformBan(
  tx: Tx,
  input: {
    clipperProfileId: string;
    reason: string;
    actorUserId: string;
    now: Date;
    warningId?: string;
  },
): Promise<DisciplineEffects> {
  const effects: DisciplineEffects = {};
  const profile = await tx.clipperProfile.findUniqueOrThrow({
    where: { id: input.clipperProfileId },
    select: { verificationStatus: true },
  });
  if (profile.verificationStatus !== "BANNED") {
    await tx.clipperProfile.update({
      where: { id: input.clipperProfileId },
      data: { verificationStatus: "BANNED", verifiedAt: null },
    });
    effects.ban = { previousStatus: profile.verificationStatus };
  }
  const applications = await tx.clipperApplication.findMany({
    where: {
      clipperProfileId: input.clipperProfileId,
      status: { in: ["APPROVED", "PENDING", "UNDER_REVIEW"] },
      campaign: { status: { in: [...BAN_ACTIVE_CAMPAIGN_STATUSES] } },
    },
    select: { campaignId: true },
    // Locks por competição sempre na mesma ordem (dois bans ao mesmo tempo).
    orderBy: { campaignId: "asc" },
  });
  for (const application of applications) {
    mergeEffects(
      effects,
      await applyCompetitionRemoval(tx, {
        clipperProfileId: input.clipperProfileId,
        campaignId: application.campaignId,
        reversePrizes: false,
        reason: input.reason,
        actorUserId: input.actorUserId,
        now: input.now,
        warningId: input.warningId,
      }),
    );
  }
  return effects;
}

// ---------------------------------------------------------------------------
// Revogação
// ---------------------------------------------------------------------------

export type RestoreSummary = {
  restoredPosts: number;
  restoredEntries: number;
  keptLockedEntries: number;
  /** Itens que outra punição ainda ativa continua cobrindo (não restaurados). */
  keptCoveredItems: number;
  restoredApplications: number;
  restoredAmount: number;
  unbanned: boolean;
};

type PostRef = { id: string; campaignId: string; postedAt: Date | null };

/**
 * O que as punições ainda ativas do clipador cobrem. Quem revoga encerra as
 * próprias sanções antes de restaurar, então aqui só sobram as outras.
 */
async function loadActiveCoverage(tx: Tx, clipperProfileId: string) {
  const sanctions = await tx.clipperSanction.findMany({
    where: {
      clipperProfileId,
      revokedAt: null,
      type: {
        in: [
          "VIDEO_INVALIDATION",
          "COMPETITION_REMOVAL",
          "PLATFORM_BAN",
          "DAY_POINTS_RESET",
          "PODIUM_INELIGIBLE",
        ],
      },
    },
    select: {
      type: true,
      clipPostId: true,
      campaignId: true,
      startsAt: true,
      endsAt: true,
      metadata: true,
    },
  });
  const invalidatedPostIds = new Set<string>();
  const removedCampaignIds = new Set<string>();
  const dayResets: { campaignId: string; start: Date; end: Date }[] = [];
  const podiumDays: { campaignId: string; start: Date; end: Date }[] = [];
  let banned = false;
  for (const sanction of sanctions) {
    if (sanction.type === "PLATFORM_BAN") banned = true;
    if (sanction.type === "VIDEO_INVALIDATION" && sanction.clipPostId) {
      invalidatedPostIds.add(sanction.clipPostId);
    }
    if (sanction.type === "COMPETITION_REMOVAL" && sanction.campaignId) {
      removedCampaignIds.add(sanction.campaignId);
    }
    if (
      sanction.type === "PODIUM_INELIGIBLE" &&
      sanction.campaignId &&
      sanction.endsAt
    ) {
      podiumDays.push({
        campaignId: sanction.campaignId,
        start: sanction.startsAt,
        end: sanction.endsAt,
      });
    }
    if (sanction.type === "DAY_POINTS_RESET" && sanction.campaignId) {
      const metadata = sanction.metadata as {
        startDate?: unknown;
        endDate?: unknown;
      } | null;
      if (
        typeof metadata?.startDate === "string" &&
        typeof metadata.endDate === "string"
      ) {
        dayResets.push({
          campaignId: sanction.campaignId,
          start: new Date(metadata.startDate),
          end: new Date(metadata.endDate),
        });
      }
    }
  }
  /** O vídeo continua punido (invalidação, remoção, zeragem do dia ou ban). */
  const coversPost = (post: PostRef, options: { ignoreBan?: boolean } = {}) =>
    (!options.ignoreBan && banned) ||
    invalidatedPostIds.has(post.id) ||
    removedCampaignIds.has(post.campaignId) ||
    dayResets.some(
      (reset) =>
        reset.campaignId === post.campaignId &&
        !!post.postedAt &&
        post.postedAt >= reset.start &&
        post.postedAt < reset.end,
    );
  const podiumCovers = (post: PostRef) =>
    podiumDays.some(
      (day) =>
        day.campaignId === post.campaignId &&
        !!post.postedAt &&
        post.postedAt >= day.start &&
        post.postedAt < day.end,
    );
  /** O vídeo continua fora dos rankings diários (o acima ou inelegível ao pódio). */
  const coversRanking = (post: PostRef, options: { ignoreBan?: boolean } = {}) =>
    coversPost(post, options) || podiumCovers(post);
  /** Dia do Top Clipadores (rankingDate à meia-noite UTC) com o clipador inelegível ao pódio. */
  const podiumCoversTopDay = (campaignId: string, rankingDate: Date) => {
    const { startDate, endDate } = rankingDayWindowUtc(
      rankingDate.toISOString().slice(0, 10),
    );
    return podiumDays.some(
      (day) =>
        day.campaignId === campaignId && day.start < endDate && day.end > startDate,
    );
  };
  return {
    banned,
    removedCampaignIds,
    coversPost,
    coversRanking,
    podiumCoversTopDay,
  };
}

/**
 * Desfaz os efeitos gravados. Não restaura o que outra punição ainda ativa
 * cobre (outro ban, uma remoção posterior da mesma competição, outra
 * invalidação do vídeo), nem as entradas de dias que travaram depois da
 * punição (pagos sem o clipador), para não mudar posições já pagas.
 */
export async function restoreEffects(
  tx: Tx,
  effects: DisciplineEffects,
  input: {
    clipperProfileId: string;
    restorePrizes: boolean;
    actorUserId: string;
    now: Date;
    description: string;
    /**
     * Recebe o que ficou de fora por outra punição ainda cobrir: a outra pode
     * não ter gravado esses itens (já estavam punidos quando ela veio), então
     * quem revoga os guarda e tenta de novo quando ela for revogada.
     */
    deferred?: DisciplineEffects;
  },
): Promise<RestoreSummary> {
  const summary: RestoreSummary = {
    restoredPosts: 0,
    restoredEntries: 0,
    keptLockedEntries: 0,
    keptCoveredItems: 0,
    restoredApplications: 0,
    restoredAmount: 0,
    unbanned: false,
  };
  const coverage = await loadActiveCoverage(tx, input.clipperProfileId);
  const kept: DisciplineEffects = {};
  /** Competições em que um vídeo ou a inscrição voltou a valer. */
  const reopenedCampaignIds = new Set<string>();

  // Referências dos vídeos envolvidos (competição e data de postagem).
  const postRefs = new Map<string, PostRef>();
  const loadPostRefs = async (ids: (string | null | undefined)[]) => {
    const missing = [
      ...new Set(ids.filter((id): id is string => !!id && !postRefs.has(id))),
    ];
    if (missing.length === 0) return;
    const rows = await tx.clipPost.findMany({
      where: { id: { in: missing } },
      select: { id: true, campaignId: true, postedAt: true },
    });
    for (const row of rows) postRefs.set(row.id, row);
  };

  // --- vídeos
  await loadPostRefs((effects.posts ?? []).map((post) => post.id));
  for (const post of effects.posts ?? []) {
    const ref = postRefs.get(post.id);
    if (ref && coverage.coversPost(ref)) {
      summary.keptCoveredItems += 1;
      (kept.posts ??= []).push(post);
      continue;
    }
    const result = await tx.clipPost.updateMany({
      where: {
        id: post.id,
        status: "DISQUALIFIED",
        ineligibilityReason: { startsWith: DISCIPLINE_INVALIDATION_REASON_PREFIX },
      },
      data: {
        status: post.status,
        ineligibilityReason: post.ineligibilityReason,
      },
    });
    summary.restoredPosts += result.count;
    if (result.count > 0 && ref) reopenedCampaignIds.add(ref.campaignId);
  }

  // --- inscrições
  if ((effects.applications ?? []).length > 0) {
    const rows = await tx.clipperApplication.findMany({
      where: { id: { in: effects.applications!.map((row) => row.id) } },
      select: { id: true, campaignId: true },
    });
    const campaignByApplication = new Map(
      rows.map((row) => [row.id, row.campaignId]),
    );
    for (const application of effects.applications ?? []) {
      const campaignId = campaignByApplication.get(application.id);
      if (
        coverage.banned ||
        (campaignId && coverage.removedCampaignIds.has(campaignId))
      ) {
        summary.keptCoveredItems += 1;
        (kept.applications ??= []).push(application);
        continue;
      }
      const result = await tx.clipperApplication.updateMany({
        where: { id: application.id, status: "REVOKED" },
        data: {
          status: application.status,
          withdrawnAt: application.withdrawnAt
            ? new Date(application.withdrawnAt)
            : null,
        },
      });
      summary.restoredApplications += result.count;
      if (result.count > 0 && campaignId) reopenedCampaignIds.add(campaignId);
    }
  }

  // --- entradas do ranking diário
  const lockedByCampaign = new Map<string, Set<string>>();
  const lockedFor = async (campaignId: string) => {
    let locked = lockedByCampaign.get(campaignId);
    if (!locked) {
      locked = await lockedDailyRankingIds(tx, campaignId);
      lockedByCampaign.set(campaignId, locked);
    }
    return locked;
  };
  if ((effects.dailyEntryIds ?? []).length > 0) {
    const entries = await tx.dailyRankingEntry.findMany({
      where: { id: { in: effects.dailyEntryIds }, isDisqualified: true },
      select: {
        id: true,
        clipPostId: true,
        dailyRankingId: true,
        dailyRanking: { select: { campaignId: true } },
      },
    });
    await loadPostRefs(entries.map((entry) => entry.clipPostId));
    const restorable: string[] = [];
    for (const entry of entries) {
      const ref = postRefs.get(entry.clipPostId);
      if (ref && coverage.coversRanking(ref)) {
        summary.keptCoveredItems += 1;
        (kept.dailyEntryIds ??= []).push(entry.id);
        continue;
      }
      const locked = await lockedFor(entry.dailyRanking.campaignId);
      if (locked.has(entry.dailyRankingId)) summary.keptLockedEntries += 1;
      else restorable.push(entry.id);
    }
    if (restorable.length > 0) {
      const result = await tx.dailyRankingEntry.updateMany({
        where: { id: { in: restorable } },
        data: { isDisqualified: false },
      });
      summary.restoredEntries += result.count;
    }
  }

  // --- Top Clipadores
  if ((effects.topEntryIds ?? []).length > 0) {
    const entries = await tx.topClippersDailyRankingEntry.findMany({
      where: { id: { in: effects.topEntryIds }, isDisqualified: true },
      select: {
        id: true,
        ranking: { select: { campaignId: true, rankingDate: true } },
      },
    });
    const keptForPodium: string[] = [];
    const restorable = entries
      .filter((entry) => {
        if (
          coverage.banned ||
          coverage.removedCampaignIds.has(entry.ranking.campaignId)
        ) {
          summary.keptCoveredItems += 1;
          (kept.topEntryIds ??= []).push(entry.id);
          return false;
        }
        if (
          coverage.podiumCoversTopDay(
            entry.ranking.campaignId,
            entry.ranking.rankingDate,
          )
        ) {
          keptForPodium.push(entry.id);
          summary.keptCoveredItems += 1;
          return false;
        }
        return true;
      })
      .map((entry) => entry.id);
    // Fica fora só pelo pódio: com o motivo dele, a revogação do pódio a devolve.
    if (keptForPodium.length > 0) {
      await tx.topClippersDailyRankingEntry.updateMany({
        where: { id: { in: keptForPodium } },
        data: { disqualificationReason: DISCIPLINE_PODIUM_REASON },
      });
    }
    if (restorable.length > 0) {
      const result = await tx.topClippersDailyRankingEntry.updateMany({
        where: {
          id: { in: restorable },
          isDisqualified: true,
          prizeStatus: { not: "PAID" },
          ranking: {
            entries: {
              none: { prizeStatus: { in: ["PAID", REVERSED_PRIZE_STATUS] } },
            },
          },
        },
        data: {
          isDisqualified: false,
          disqualificationReason: null,
          disqualifiedAt: null,
          disqualifiedBy: null,
        },
      });
      summary.restoredEntries += result.count;
    }
  }

  // --- prêmios estornados
  const restoredEntryIds = new Set<string>();
  if (input.restorePrizes && (effects.reversals ?? []).length > 0) {
    const wallet = await tx.wallet.findUnique({
      where: { clipperProfileId: input.clipperProfileId },
      select: { id: true },
    });
    if (wallet) {
      const reversalIds = effects.reversals!.map((row) => row.adjustmentId);
      const reversalRows = await tx.transaction.findMany({
        where: { id: { in: reversalIds } },
        select: {
          id: true,
          amount: true,
          campaignId: true,
          clipPostId: true,
          rankingPosition: true,
          metadata: true,
        },
      });
      const alreadyRestored = await tx.transaction.findMany({
        where: {
          type: "ADJUSTMENT",
          status: "COMPLETED",
          OR: reversalIds.map((id) => ({
            metadata: { path: ["restoredReversalId"], equals: id },
          })),
        },
        select: { metadata: true },
      });
      const restoredSet = new Set(
        alreadyRestored
          .map(
            (row) =>
              (row.metadata as { restoredReversalId?: unknown } | null)
                ?.restoredReversalId,
          )
          .filter((id): id is string => typeof id === "string"),
      );
      await loadPostRefs(reversalRows.map((row) => row.clipPostId));
      const toRestore = reversalRows.filter((reversal) => {
        if (restoredSet.has(reversal.id)) return false;
        const ref = reversal.clipPostId ? postRefs.get(reversal.clipPostId) : null;
        // O ban não tira prêmios; a remoção e a invalidação, sim.
        const covered =
          (!!reversal.campaignId &&
            coverage.removedCampaignIds.has(reversal.campaignId)) ||
          (!!ref && coverage.coversRanking(ref, { ignoreBan: true }));
        if (covered) {
          summary.keptCoveredItems += 1;
          const row = effects.reversals!.find(
            (item) => item.adjustmentId === reversal.id,
          );
          if (row) (kept.reversals ??= []).push(row);
        }
        return !covered;
      });

      if (toRestore.length > 0) {
        const entryIdsToLock = toRestore
          .map(
            (row) =>
              (row.metadata as { dailyRankingEntryId?: unknown } | null)
                ?.dailyRankingEntryId,
          )
          .filter((id): id is string => typeof id === "string");
        if (entryIdsToLock.length > 0) {
          await tx.$executeRaw`
            SELECT id FROM "DailyRankingEntry"
            WHERE id IN (${Prisma.join(entryIdsToLock)})
            ORDER BY id
            FOR UPDATE
          `;
        }
        await tx.$executeRaw`SELECT id FROM "Wallet" WHERE id = ${wallet.id} FOR UPDATE`;
        const current = await tx.wallet.findUniqueOrThrow({
          where: { id: wallet.id },
          select: { balance: true },
        });
        let balance = current.balance;
        let total = 0;
        for (const reversal of toRestore) {
          const amount = ROUND(Math.abs(reversal.amount));
          const metadata = reversal.metadata as {
            reversedPrizeCreditId?: string;
            dailyRankingEntryId?: string;
          } | null;
          await tx.transaction.create({
            data: {
              walletId: wallet.id,
              type: "ADJUSTMENT",
              status: "COMPLETED",
              amount,
              balanceBefore: balance,
              balanceAfter: ROUND(balance + amount),
              description: input.description,
              campaignId: reversal.campaignId,
              clipPostId: reversal.clipPostId,
              rankingPosition: reversal.rankingPosition,
              idempotencyKey: `clipper-warning-restore:${reversal.id}`,
              processedBy: input.actorUserId,
              processedAt: input.now,
              proofUrls: [],
              metadata: {
                action: WARNING_PRIZE_RESTORE_ACTION,
                restoredReversalId: reversal.id,
                ...(metadata?.reversedPrizeCreditId
                  ? { restoredCreditId: metadata.reversedPrizeCreditId }
                  : {}),
              },
            },
          });
          if (metadata?.dailyRankingEntryId) {
            restoredEntryIds.add(metadata.dailyRankingEntryId);
          }
          balance = ROUND(balance + amount);
          total = ROUND(total + amount);
        }
        if (total > 0) {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              balance: { increment: total },
              totalEarned: { increment: total },
            },
          });
        }
        summary.restoredAmount = total;
      }
    }
  }

  // --- entradas REVERSED: voltam se o crédito voltou, ou, quando o prêmio
  // nem chegou a ser creditado (perdido), se o vídeo não segue punido.
  const forfeited = (effects.reversedDailyEntries ?? []).filter(
    (entry) => entry.forfeited,
  );
  if (forfeited.length > 0) {
    const rows = await tx.dailyRankingEntry.findMany({
      where: { id: { in: forfeited.map((entry) => entry.id) } },
      select: { id: true, clipPostId: true },
    });
    await loadPostRefs(rows.map((row) => row.clipPostId));
    const postByEntry = new Map(rows.map((row) => [row.id, row.clipPostId]));
    for (const entry of forfeited) {
      const ref = postRefs.get(postByEntry.get(entry.id) ?? "");
      if (ref && coverage.coversRanking(ref)) {
        summary.keptCoveredItems += 1;
        (kept.reversedDailyEntries ??= []).push(entry);
        continue;
      }
      restoredEntryIds.add(entry.id);
    }
  }
  // A entrada de um prêmio que ficou para depois volta junto com ele.
  const keptReversalEntryIds = new Set(
    (kept.reversals ?? []).map((row) => row.dailyRankingEntryId),
  );
  for (const entry of effects.reversedDailyEntries ?? []) {
    if (!entry.forfeited && keptReversalEntryIds.has(entry.id)) {
      (kept.reversedDailyEntries ??= []).push(entry);
    }
    if (!restoredEntryIds.has(entry.id)) continue;
    await tx.dailyRankingEntry.updateMany({
      where: { id: entry.id, dailyPrizeStatus: REVERSED_PRIZE_STATUS },
      data: { dailyPrizeStatus: entry.previousStatus },
    });
  }

  // --- banimento: só volta se nenhum outro ban continua ativo.
  if (effects.ban) {
    if (coverage.banned) {
      summary.keptCoveredItems += 1;
      kept.ban = effects.ban;
    } else {
      const result = await tx.clipperProfile.updateMany({
        where: { id: input.clipperProfileId, verificationStatus: "BANNED" },
        data: { verificationStatus: effects.ban.previousStatus },
      });
      summary.unbanned = result.count > 0;
    }
  }

  // Um "inelegível ao pódio" desfeito enquanto esta punição ainda cobria o dia
  // deixou as entries dele de fora (ela não as tinha gravado): o dia é
  // recalculado agora que o vídeo ou a inscrição voltou.
  if (reopenedCampaignIds.size > 0) {
    const podiums = await tx.clipperSanction.findMany({
      where: {
        clipperProfileId: input.clipperProfileId,
        type: "PODIUM_INELIGIBLE",
        campaignId: { in: [...reopenedCampaignIds] },
        revokedAt: { not: null },
      },
      select: { type: true, campaignId: true, revokedAt: true, metadata: true },
    });
    for (const podium of podiums) {
      const rankingDate = (podium.metadata as { rankingDate?: unknown } | null)
        ?.rankingDate;
      if (
        podium.type !== "PODIUM_INELIGIBLE" ||
        !podium.revokedAt ||
        !podium.campaignId ||
        typeof rankingDate !== "string"
      ) {
        continue;
      }
      const day = await restorePodiumDay(tx, {
        clipperProfileId: input.clipperProfileId,
        campaignId: podium.campaignId,
        rankingDate,
      });
      summary.restoredEntries += day.restoredEntries;
    }
  }

  if (input.deferred) mergeEffects(input.deferred, kept);
  return summary;
}

export function hasEffects(effects: DisciplineEffects): boolean {
  return (
    !!effects.ban ||
    [
      effects.posts,
      effects.dailyEntryIds,
      effects.topEntryIds,
      effects.reversedDailyEntries,
      effects.applications,
      effects.reversals,
    ].some((values) => (values?.length ?? 0) > 0)
  );
}

/**
 * Devolve aos rankings do dia os vídeos de um "inelegível ao pódio" revogado.
 * Recalcula pelo dia, porque parte das entries é desclassificada depois da
 * sanção (pela varredura pós-snapshot do league): só as de vídeos ainda
 * elegíveis, de inscrição que conta naquele dia, sem outra punição cobrindo e
 * em dia destravado. Quem chama encerra a sanção antes.
 */
export async function restorePodiumDay(
  tx: Tx,
  input: { clipperProfileId: string; campaignId: string; rankingDate: string },
): Promise<Pick<RestoreSummary, "restoredEntries" | "keptLockedEntries" | "keptCoveredItems">> {
  const result = { restoredEntries: 0, keptLockedEntries: 0, keptCoveredItems: 0 };
  const window = rankingDayWindowUtc(input.rankingDate);
  const coverage = await loadActiveCoverage(tx, input.clipperProfileId);
  const locked = await lockedDailyRankingIds(tx, input.campaignId);

  const entries = await tx.dailyRankingEntry.findMany({
    where: {
      isDisqualified: true,
      dailyRanking: { campaignId: input.campaignId },
      application: {
        clipperProfileId: input.clipperProfileId,
        ...rankingApplicationWhere(window.endDate),
      },
      clipPost: {
        campaignId: input.campaignId,
        status: "ELIGIBLE",
        postedAt: { gte: window.startDate, lt: window.endDate },
      },
    },
    select: {
      id: true,
      dailyRankingId: true,
      clipPost: { select: { id: true, campaignId: true, postedAt: true } },
    },
  });
  const restorable: string[] = [];
  for (const entry of entries) {
    if (coverage.coversRanking(entry.clipPost)) {
      result.keptCoveredItems += 1;
    } else if (locked.has(entry.dailyRankingId)) {
      result.keptLockedEntries += 1;
    } else {
      restorable.push(entry.id);
    }
  }
  if (restorable.length > 0) {
    const updated = await tx.dailyRankingEntry.updateMany({
      where: { id: { in: restorable } },
      data: { isDisqualified: false },
    });
    result.restoredEntries += updated.count;
  }

  // Top Clipadores: só a entrada que o pódio desclassificou (pelo motivo).
  const topEntry = await tx.topClippersDailyRankingEntry.findFirst({
    where: {
      isDisqualified: true,
      disqualificationReason: DISCIPLINE_PODIUM_REASON,
      prizeStatus: { not: "PAID" },
      application: {
        clipperProfileId: input.clipperProfileId,
        campaignId: input.campaignId,
      },
      ranking: {
        campaignId: input.campaignId,
        rankingDate: topClippersRankingDate(input.rankingDate),
      },
    },
    select: { id: true, position: true, topClippersDailyRankingId: true },
  });
  if (topEntry) {
    const topLocked = await lockedTopRankingIds(tx, input.campaignId);
    if (
      coverage.banned ||
      coverage.removedCampaignIds.has(input.campaignId) ||
      coverage.podiumCoversTopDay(
        input.campaignId,
        topClippersRankingDate(input.rankingDate),
      )
    ) {
      result.keptCoveredItems += 1;
    } else if (topLocked.has(topEntry.topClippersDailyRankingId)) {
      result.keptLockedEntries += 1;
    } else if (topEntry.position === 0) {
      // Criada pelo pódio só para tirar o clipador: some, e o ranking volta a calcular a posição.
      await tx.topClippersDailyRankingEntry.delete({ where: { id: topEntry.id } });
      result.restoredEntries += 1;
    } else {
      await tx.topClippersDailyRankingEntry.update({
        where: { id: topEntry.id },
        data: {
          isDisqualified: false,
          disqualificationReason: null,
          disqualifiedAt: null,
          disqualifiedBy: null,
        },
      });
      result.restoredEntries += 1;
    }
  }
  return result;
}
