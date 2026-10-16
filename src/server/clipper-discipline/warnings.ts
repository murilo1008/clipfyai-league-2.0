import type {
  ClipperInfractionType,
  ClipperSanctionType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";

import {
  CLIPPER_WARNING_NOTIFICATION_KIND,
  DISCIPLINE_DAY_RESET_REASON,
  DISCIPLINE_INVALIDATION_REASON_PREFIX,
  DISCIPLINE_OBSERVATION_REASON,
  DISCIPLINE_REMOVAL_REASON,
} from "@/lib/clipper-discipline/constants";
import {
  buildSanctionPlan,
  levelRequirements,
  podiumRankingDateError,
  SanctionPlanError,
  suggestNextLevel,
  warningExpiresAt,
  warningLevelLabel,
  type ManualSanctionType,
} from "@/lib/clipper-discipline/levels";
import { rankingDayWindowUtc } from "@/lib/clipper-discipline/podium";
import { getPostedAtWindowUtc } from "@/lib/daily-ranking-preview";
import { invalidateCachedQueries } from "@/server/memory-cache";

import {
  applyCompetitionRemoval,
  applyDayPointsReset,
  applyPlatformBan,
  applyPodiumIneligibility,
  applyVideoInvalidation,
  hasEffects,
  lastLockedPostedAtCutoff,
  syncDebtHold,
  lockClipperProfile,
  mergeEffects,
  parseEffects,
  restoreEffects,
  restorePodiumDay,
  syncWalletHold,
  type DisciplineEffects,
  type RestoreSummary,
} from "./effects";
import {
  createWarningNotification,
  describeSanction,
  sendWarningEmail,
} from "./notifications";
import { getDisciplineSettings } from "./settings";

type Tx = Prisma.TransactionClient;

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;

/** Advertências ACTIVE que já venceram passam a EXPIRED (dentro do lock do clipador). */
async function expireStaleWarnings(tx: Tx, clipperProfileId: string, now: Date) {
  await tx.clipperWarning.updateMany({
    where: { clipperProfileId, status: "ACTIVE", expiresAt: { lte: now } },
    data: { status: "EXPIRED" },
  });
}

export function activeWarningWhere(
  clipperProfileId: string,
  now: Date,
): Prisma.ClipperWarningWhereInput {
  return { clipperProfileId, status: "ACTIVE", expiresAt: { gt: now } };
}

export async function suggestLevelForClipper(
  db: PrismaClient | Tx,
  clipperProfileId: string,
  now = new Date(),
) {
  const active = await db.clipperWarning.findMany({
    where: activeWarningWhere(clipperProfileId, now),
    select: { infractionType: true, level: true },
  });
  return { suggestedLevel: suggestNextLevel(active), activeCount: active.length };
}

function invalidateRankingCaches(campaignIds: readonly string[]) {
  for (const campaignId of new Set(campaignIds)) {
    invalidateCachedQueries(`clipper-daily-snapshot:${campaignId}:`);
    invalidateCachedQueries(`clipper-daily-count:${campaignId}:`);
    invalidateCachedQueries(`clipper-daily-live:${campaignId}:`);
    invalidateCachedQueries(`top-clippers-day:${campaignId}`);
    invalidateCachedQueries(`monthly-board:${campaignId}:`);
  }
}

function assertDisciplineEnabled() {
  if (process.env.CLIPPER_DISCIPLINE_ENABLED !== "true") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "O sistema de advertências ainda não foi liberado neste ambiente (CLIPPER_DISCIPLINE_ENABLED).",
    });
  }
}

/** Dia do ranking de uma sanção PODIUM_INELIGIBLE (metadata.rankingDate). */
function sanctionRankingDate(metadata: Prisma.JsonValue | null): string | null {
  const value = (metadata as { rankingDate?: unknown } | null)?.rankingDate;
  return typeof value === "string" ? value : null;
}

/**
 * Desfaz um "inelegível ao pódio" já encerrado: os efeitos gravados na sanção
 * (estornos, entradas de dias travados) e as entradas do dia que a varredura
 * do league desclassificou depois.
 */
async function restorePodiumSanction(
  tx: Tx,
  sanction: {
    id: string;
    clipperProfileId: string;
    campaignId: string | null;
    metadata: Prisma.JsonValue | null;
  },
  input: {
    restorePrizes: boolean;
    actorUserId: string;
    now: Date;
    description: string;
  },
): Promise<RestoreSummary> {
  const metadata = sanction.metadata as { effects?: unknown } | null;
  // As entries do dia voltam pelo recálculo de restorePodiumDay, que também
  // confere o vídeo e a inscrição de agora.
  const { dailyEntryIds: _dayEntries, ...effects } = parseEffects(metadata?.effects);
  const deferred: DisciplineEffects = {};
  const summary = await restoreEffects(tx, effects, {
    clipperProfileId: sanction.clipperProfileId,
    ...input,
    deferred,
  });
  await saveSanctionDeferred(tx, sanction, deferred);
  const rankingDate = sanctionRankingDate(sanction.metadata);
  if (sanction.campaignId && rankingDate) {
    const day = await restorePodiumDay(tx, {
      clipperProfileId: sanction.clipperProfileId,
      campaignId: sanction.campaignId,
      rankingDate,
    });
    summary.restoredEntries += day.restoredEntries;
    summary.keptLockedEntries += day.keptLockedEntries;
    summary.keptCoveredItems += day.keptCoveredItems;
  }
  return summary;
}

type DeferredHolder = { deferred?: DisciplineEffects };

function deferredOf(value: Prisma.JsonValue | null): DisciplineEffects | null {
  const deferred = (value as DeferredHolder | null)?.deferred;
  return deferred && hasEffects(deferred) ? deferred : null;
}

/** Guarda (ou limpa) na sanção revogada o que ficou para depois. */
async function saveSanctionDeferred(
  tx: Tx,
  sanction: { id: string; metadata: Prisma.JsonValue | null },
  deferred: DisciplineEffects,
) {
  const metadata = (sanction.metadata ?? {}) as Record<string, unknown> & DeferredHolder;
  if (!hasEffects(deferred) && !metadata.deferred) return;
  const { deferred: _previous, ...rest } = metadata;
  await tx.clipperSanction.update({
    where: { id: sanction.id },
    data: {
      metadata: (hasEffects(deferred) ? { ...rest, deferred } : rest) as Prisma.InputJsonValue,
    },
  });
}

/** Guarda (ou limpa) na advertência revogada o que ficou para depois. */
async function saveWarningDeferred(
  tx: Tx,
  warning: { id: string; effects: Prisma.JsonValue | null },
  deferred: DisciplineEffects,
) {
  const effects = parseEffects(warning.effects) as DisciplineEffects & DeferredHolder;
  if (!hasEffects(deferred) && !effects.deferred) return;
  const { deferred: _previous, ...rest } = effects;
  await tx.clipperWarning.update({
    where: { id: warning.id },
    data: {
      effects: (hasEffects(deferred) ? { ...rest, deferred } : rest) as Prisma.InputJsonValue,
    },
  });
}

/**
 * Tenta de novo o que revogações anteriores deixaram de fora porque outra
 * punição ainda cobria (vídeo invalidado e depois removido da competição, por
 * exemplo): a outra não tinha gravado esses itens, então só voltam por aqui.
 * Roda depois de cada revogação que pode ter tirado essa cobertura.
 */
async function retryDeferredRestores(
  tx: Tx,
  input: { clipperProfileId: string; actorUserId: string; now: Date },
): Promise<{ summary: RestoreSummary; campaignIds: string[] }> {
  const summary: RestoreSummary = {
    restoredPosts: 0,
    restoredEntries: 0,
    keptLockedEntries: 0,
    keptCoveredItems: 0,
    restoredApplications: 0,
    restoredAmount: 0,
    unbanned: false,
  };
  const campaignIds = new Set<string>();
  const retry = async (deferred: DisciplineEffects) => {
    const next: DisciplineEffects = {};
    const result = await restoreEffects(tx, deferred, {
      clipperProfileId: input.clipperProfileId,
      // Prêmio só fica para depois quando a revogação pediu a devolução.
      restorePrizes: true,
      actorUserId: input.actorUserId,
      now: input.now,
      description: "Devolução de prêmio: punição revogada",
      deferred: next,
    });
    // O que segue coberto já entrou no resumo da revogação que o guardou.
    addRestoreSummary(summary, { ...result, keptLockedEntries: 0, keptCoveredItems: 0 });
    for (const id of await campaignsTouched(tx, deferred, null)) campaignIds.add(id);
    const postIds = (deferred.posts ?? []).map((post) => post.id);
    if (postIds.length > 0) {
      const posts = await tx.clipPost.findMany({
        where: { id: { in: postIds } },
        select: { campaignId: true },
      });
      for (const post of posts) campaignIds.add(post.campaignId);
    }
    return next;
  };

  const warnings = await tx.clipperWarning.findMany({
    where: { clipperProfileId: input.clipperProfileId, status: "REVOKED" },
    select: { id: true, effects: true },
  });
  for (const warning of warnings) {
    const deferred = deferredOf(warning.effects);
    if (deferred) await saveWarningDeferred(tx, warning, await retry(deferred));
  }
  const sanctions = await tx.clipperSanction.findMany({
    where: {
      clipperProfileId: input.clipperProfileId,
      revokedAt: { not: null },
      type: { in: ["DAY_POINTS_RESET", "PODIUM_INELIGIBLE", "PLATFORM_BAN"] },
    },
    select: { id: true, metadata: true },
  });
  for (const sanction of sanctions) {
    const deferred = deferredOf(sanction.metadata);
    if (deferred) await saveSanctionDeferred(tx, sanction, await retry(deferred));
  }
  return { summary, campaignIds: [...campaignIds] };
}

function addRestoreSummary(target: RestoreSummary, extra: RestoreSummary) {
  target.restoredPosts += extra.restoredPosts;
  target.restoredEntries += extra.restoredEntries;
  target.keptLockedEntries += extra.keptLockedEntries;
  target.keptCoveredItems += extra.keptCoveredItems;
  target.restoredApplications += extra.restoredApplications;
  target.restoredAmount =
    Math.round((target.restoredAmount + extra.restoredAmount) * 100) / 100;
  target.unbanned = target.unbanned || extra.unbanned;
  return target;
}

// ---------------------------------------------------------------------------
// Aplicar advertência
// ---------------------------------------------------------------------------

export type ApplyWarningInput = {
  clipperProfileId: string;
  infractionType: ClipperInfractionType;
  /** 0–4 para leve/média; ignorado na grave. */
  level: number | null;
  campaignId?: string | null;
  clipPostId?: string | null;
  videoUrl?: string | null;
  reason: string;
  /** Obrigatório no nível 4 (banimento). */
  confirmBan?: boolean;
  /** Inelegível ao pódio no dia do ranking (YYYY-MM-DD), níveis 0 a 2. */
  podiumRankingDate?: string | null;
  actorUserId: string;
  now?: Date;
};

export async function applyClipperWarning(
  db: PrismaClient,
  input: ApplyWarningInput,
) {
  assertDisciplineEnabled();
  const now = input.now ?? new Date();
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Descreva o motivo da advertência." });
  }
  const level = input.infractionType === "SEVERE" ? null : input.level;
  const requirements = levelRequirements(input.infractionType, level);
  if (requirements.requiresBanConfirmation && !input.confirmBan) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Confirme o banimento para aplicar a advertência 4.",
    });
  }

  const result = await db.$transaction(async (tx) => {
    await lockClipperProfile(tx, input.clipperProfileId);
    const profile = await tx.clipperProfile.findUnique({
      where: { id: input.clipperProfileId },
      select: {
        id: true,
        fullName: true,
        artisticName: true,
        userId: true,
        user: { select: { email: true, role: true } },
      },
    });
    if (!profile || profile.user.role !== "CLIPPER") {
      throw new TRPCError({ code: "NOT_FOUND", message: "Clipador não encontrado." });
    }

    // Vídeo e competição: o vídeo precisa ser do clipador e define a competição.
    let campaignId = input.campaignId ?? null;
    let videoUrl = input.videoUrl?.trim() || null;
    if (input.clipPostId) {
      const post = await tx.clipPost.findUnique({
        where: { id: input.clipPostId },
        select: {
          id: true,
          campaignId: true,
          submittedUrl: true,
          application: { select: { clipperProfileId: true } },
        },
      });
      if (!post || post.application.clipperProfileId !== profile.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "O vídeo informado não é deste clipador.",
        });
      }
      if (campaignId && campaignId !== post.campaignId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "O vídeo informado não é desta competição.",
        });
      }
      campaignId = post.campaignId;
      videoUrl = videoUrl ?? post.submittedUrl;
    }
    const campaign = campaignId
      ? await tx.campaign.findUnique({
          where: { id: campaignId },
          select: { id: true, name: true },
        })
      : null;
    if (campaignId && !campaign) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Competição não encontrada." });
    }

    const settings = await getDisciplineSettings(tx);
    await expireStaleWarnings(tx, profile.id, now);
    const { suggestedLevel } = await suggestLevelForClipper(tx, profile.id, now);

    let plan;
    try {
      plan = buildSanctionPlan({
        infractionType: input.infractionType,
        level,
        settings,
        now,
        campaignId,
        clipPostId: input.clipPostId,
        podiumRankingDate: input.podiumRankingDate,
      });
    } catch (error) {
      if (error instanceof SanctionPlanError) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }
      throw error;
    }

    // Janela rolante: a nova infração empurra a expiração de todas as ativas.
    const expiresAt = warningExpiresAt(settings, now);
    await tx.clipperWarning.updateMany({
      where: { clipperProfileId: profile.id, status: "ACTIVE", expiresAt: { gt: now } },
      data: { expiresAt },
    });

    const warning = await tx.clipperWarning.create({
      data: {
        clipperProfileId: profile.id,
        campaignId,
        clipPostId: input.clipPostId ?? null,
        videoUrl,
        infractionType: input.infractionType,
        level,
        suggestedLevel: input.infractionType === "SEVERE" ? null : suggestedLevel,
        reason,
        appliedById: input.actorUserId,
        appliedAt: now,
        expiresAt,
        banReviewStatus: input.infractionType === "SEVERE" ? "PENDING" : null,
        configSnapshot: settings,
      },
      select: { id: true },
    });

    const sanctions = [];
    for (const draft of plan) {
      sanctions.push(
        await tx.clipperSanction.create({
          data: {
            clipperProfileId: profile.id,
            warningId: warning.id,
            type: draft.type,
            campaignId: draft.campaignId ?? null,
            clipPostId: draft.clipPostId ?? null,
            scoreMultiplierBps: draft.scoreMultiplierBps ?? null,
            startsAt: draft.startsAt,
            endsAt: draft.endsAt,
            reason,
            createdById: input.actorUserId,
            metadata: draft.rankingDate ? { rankingDate: draft.rankingDate } : undefined,
          },
          select: {
            id: true,
            type: true,
            endsAt: true,
            scoreMultiplierBps: true,
            metadata: true,
          },
        }),
      );
    }

    const effects: DisciplineEffects = {};
    const reasonTag = `${DISCIPLINE_INVALIDATION_REASON_PREFIX} ${reason}`.slice(0, 500);
    const types = new Set(plan.map((draft) => draft.type));
    if (types.has("VIDEO_INVALIDATION") && input.clipPostId && campaignId) {
      mergeEffects(
        effects,
        await applyVideoInvalidation(tx, {
          clipperProfileId: profile.id,
          campaignId,
          clipPostId: input.clipPostId,
          reason: reasonTag,
          actorUserId: input.actorUserId,
          now,
          warningId: warning.id,
        }),
      );
    }
    if (types.has("COMPETITION_REMOVAL") && campaignId) {
      mergeEffects(
        effects,
        await applyCompetitionRemoval(tx, {
          clipperProfileId: profile.id,
          campaignId,
          reversePrizes: true,
          reason: DISCIPLINE_REMOVAL_REASON,
          actorUserId: input.actorUserId,
          now,
          warningId: warning.id,
        }),
      );
    }
    if (types.has("PLATFORM_BAN")) {
      mergeEffects(
        effects,
        await applyPlatformBan(tx, {
          clipperProfileId: profile.id,
          reason: DISCIPLINE_REMOVAL_REASON,
          actorUserId: input.actorUserId,
          now,
          warningId: warning.id,
        }),
      );
    }

    // O pódio guarda os efeitos na própria sanção: ela pode ser encerrada
    // sozinha ("Desfazer"), sem revogar a advertência.
    let podiumReversedAmount = 0;
    const podiumSanction = sanctions.find(
      (sanction) => sanction.type === "PODIUM_INELIGIBLE",
    );
    const podiumRankingDate = podiumSanction
      ? sanctionRankingDate(podiumSanction.metadata)
      : null;
    if (podiumSanction && podiumRankingDate && campaignId) {
      const podiumEffects = await applyPodiumIneligibility(tx, {
        clipperProfileId: profile.id,
        campaignId,
        rankingDate: podiumRankingDate,
        actorUserId: input.actorUserId,
        now,
        sanctionId: podiumSanction.id,
      });
      await tx.clipperSanction.update({
        where: { id: podiumSanction.id },
        data: {
          metadata: {
            rankingDate: podiumRankingDate,
            effects: podiumEffects as Prisma.InputJsonValue,
          },
        },
      });
      podiumReversedAmount = (podiumEffects.reversals ?? []).reduce(
        (sum, row) => sum + row.amount,
        0,
      );
    }

    const debtHoldId = await syncDebtHold(tx, {
      clipperProfileId: profile.id,
      actorUserId: input.actorUserId,
      now,
    });
    await syncWalletHold(tx, profile.id, now);

    await tx.clipperWarning.update({
      where: { id: warning.id },
      data: { effects: effects as Prisma.InputJsonValue },
    });

    const reversedAmount =
      Math.round(
        ((effects.reversals ?? []).reduce((sum, row) => sum + row.amount, 0) +
          podiumReversedAmount) *
          100,
      ) / 100;
    await tx.auditLog.create({
      data: {
        userId: input.actorUserId,
        action: "CREATE",
        entityType: "ClipperWarning",
        entityId: warning.id,
        campaignId,
        changes: {
          action: "apply_clipper_warning",
          clipperProfileId: profile.id,
          infractionType: input.infractionType,
          level,
          suggestedLevel,
          clipPostId: input.clipPostId ?? null,
          sanctionIds: sanctions.map((sanction) => sanction.id),
          invalidatedPostIds: (effects.posts ?? []).map((post) => post.id),
          reversedAmount,
          debtHoldSanctionId: debtHoldId,
        },
      },
    });

    const levelLabel = warningLevelLabel(input.infractionType, level);
    const punishments = sanctions
      .filter((sanction) => sanction.type !== "VIDEO_INVALIDATION")
      .map((sanction) => describeSanction(sanction));
    if (input.clipPostId) punishments.unshift("O vídeo da infração não pontua");
    if (reversedAmount > 0) {
      punishments.push(
        `Estorno de R$ ${reversedAmount.toFixed(2).replace(".", ",")} em prêmios`,
      );
    }
    const title =
      input.infractionType === "SEVERE"
        ? "Infração grave registrada"
        : level === 0
          ? "Aviso formal registrado"
          : `Advertência ${level} aplicada`;
    const message = [
      `Motivo: ${reason}`,
      ...(punishments.length > 0 ? [`Punições: ${punishments.join("; ")}.`] : []),
      "Você pode enviar sua defesa em Minhas advertências.",
    ].join(" ");
    const notification = await createWarningNotification(tx, {
      warningId: warning.id,
      userId: profile.userId,
      event: "applied",
      title,
      message,
      campaignId,
    });

    return {
      warningId: warning.id,
      level,
      suggestedLevel,
      expiresAt,
      sanctions,
      reversedAmount,
      invalidatedPosts: (effects.posts ?? []).length,
      email: {
        notificationId: notification.id,
        to: profile.user.email,
        clipperName: profile.artisticName || profile.fullName,
        title,
        levelLabel,
        reason,
        punishments,
        campaignName: campaign?.name ?? null,
      },
      touchedCampaignIds: await campaignsTouched(tx, effects, campaignId),
    };
  }, TRANSACTION_OPTIONS);

  invalidateRankingCaches(result.touchedCampaignIds);
  const emailResult = await sendWarningEmail(db, {
    event: "applied",
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    ...result.email,
  });

  return {
    warningId: result.warningId,
    level: result.level,
    suggestedLevel: result.suggestedLevel,
    expiresAt: result.expiresAt,
    sanctions: result.sanctions,
    reversedAmount: result.reversedAmount,
    invalidatedPosts: result.invalidatedPosts,
    emailSent: emailResult.sent,
  };
}

async function campaignsTouched(
  tx: Tx,
  effects: DisciplineEffects,
  campaignId: string | null,
): Promise<string[]> {
  const ids = new Set<string>();
  if (campaignId) ids.add(campaignId);
  const appIds = (effects.applications ?? []).map((application) => application.id);
  if (appIds.length > 0) {
    const rows = await tx.clipperApplication.findMany({
      where: { id: { in: appIds } },
      select: { campaignId: true },
    });
    for (const row of rows) ids.add(row.campaignId);
  }
  return [...ids];
}

// ---------------------------------------------------------------------------
// Revogar advertência
// ---------------------------------------------------------------------------

export async function revokeClipperWarning(
  db: PrismaClient,
  input: {
    warningId: string;
    reason: string;
    restorePrizes: boolean;
    actorUserId: string;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Descreva o motivo da revogação." });
  }

  const result = await db.$transaction(async (tx) => {
    const found = await tx.clipperWarning.findUnique({
      where: { id: input.warningId },
      select: { clipperProfileId: true },
    });
    if (!found) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Advertência não encontrada." });
    }
    await lockClipperProfile(tx, found.clipperProfileId);
    const warning = await tx.clipperWarning.findUniqueOrThrow({
      where: { id: input.warningId },
      include: {
        sanctions: true,
        campaign: { select: { name: true } },
        clipperProfile: {
          select: {
            userId: true,
            fullName: true,
            artisticName: true,
            user: { select: { email: true } },
          },
        },
      },
    });
    if (warning.status === "REVOKED") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Esta advertência já foi revogada." });
    }

    await tx.clipperWarning.update({
      where: { id: warning.id },
      data: {
        status: "REVOKED",
        revokedAt: now,
        revokedById: input.actorUserId,
        revokeReason: reason,
      },
    });
    // O pódio de um dia já fechado continua valendo até ser revogado.
    const endedSanctions = warning.sanctions.filter(
      (sanction) =>
        !sanction.revokedAt &&
        (sanction.type === "PODIUM_INELIGIBLE" ||
          !sanction.endsAt ||
          sanction.endsAt > now),
    );
    // Revogar desfaz a advertência, não só a encerra a partir de agora:
    // - suspensão/observação deixam de cobrir o período (o league volta a
    //   promover os vídeos que segurou);
    // - o redutor sai de tudo que ainda não foi creditado/pago (dias travados
    //   continuam como foram pagos);
    // - o resto (retenção, ban, remoção) termina agora.
    const lockedCutoff = warning.sanctions.some(
      (sanction) => sanction.type === "SCORE_MULTIPLIER" && !sanction.revokedAt,
    )
      ? await lastLockedPostedAtCutoff(tx, warning.clipperProfileId)
      : null;
    for (const sanction of warning.sanctions) {
      if (sanction.revokedAt) continue;
      let revokedAt = now;
      if (
        sanction.type === "POSTING_SUSPENSION" ||
        sanction.type === "OBSERVATION_MODE"
      ) {
        revokedAt = sanction.startsAt < now ? sanction.startsAt : now;
      } else if (sanction.type === "SCORE_MULTIPLIER") {
        const cut =
          lockedCutoff && lockedCutoff > sanction.startsAt
            ? lockedCutoff
            : sanction.startsAt;
        revokedAt = cut < now ? cut : now;
      }
      await tx.clipperSanction.update({
        where: { id: sanction.id },
        data: { revokedAt, revokedById: input.actorUserId, revokeReason: reason },
      });
    }

    const effects = parseEffects(warning.effects);
    const deferred: DisciplineEffects = {};
    const summary = await restoreEffects(tx, effects, {
      clipperProfileId: warning.clipperProfileId,
      restorePrizes: input.restorePrizes,
      actorUserId: input.actorUserId,
      now,
      description: "Devolução de prêmio: advertência revogada",
      deferred,
    });
    for (const sanction of warning.sanctions) {
      if (sanction.type !== "PODIUM_INELIGIBLE" || sanction.revokedAt) continue;
      addRestoreSummary(
        summary,
        await restorePodiumSanction(tx, sanction, {
          restorePrizes: input.restorePrizes,
          actorUserId: input.actorUserId,
          now,
          description: "Devolução de prêmio: advertência revogada",
        }),
      );
    }
    const retried = await retryDeferredRestores(tx, {
      clipperProfileId: warning.clipperProfileId,
      actorUserId: input.actorUserId,
      now,
    });
    addRestoreSummary(summary, retried.summary);
    await saveWarningDeferred(tx, warning, deferred);
    await syncDebtHold(tx, {
      clipperProfileId: warning.clipperProfileId,
      actorUserId: input.actorUserId,
      now,
    });
    await syncWalletHold(tx, warning.clipperProfileId, now);

    await tx.auditLog.create({
      data: {
        userId: input.actorUserId,
        action: "UPDATE",
        entityType: "ClipperWarning",
        entityId: warning.id,
        campaignId: warning.campaignId,
        changes: {
          action: "revoke_clipper_warning",
          clipperProfileId: warning.clipperProfileId,
          reason,
          restorePrizes: input.restorePrizes,
          ...summary,
        },
      },
    });

    const levelLabel = warningLevelLabel(warning.infractionType, warning.level);
    const title = `${levelLabel} revogada`;
    const punishments = endedSanctions
      .filter((sanction) => sanction.type !== "VIDEO_INVALIDATION")
      .map((sanction) => describeSanction({ ...sanction, endsAt: null }));
    const notification = await createWarningNotification(tx, {
      warningId: warning.id,
      userId: warning.clipperProfile.userId,
      event: "revoked",
      title,
      message: `A equipe revogou esta advertência. Motivo: ${reason}`,
      campaignId: warning.campaignId,
    });

    return {
      summary,
      touchedCampaignIds: [
        ...new Set([
          ...(await campaignsTouched(tx, effects, warning.campaignId)),
          ...retried.campaignIds,
        ]),
      ],
      email: {
        notificationId: notification.id,
        to: warning.clipperProfile.user.email,
        clipperName:
          warning.clipperProfile.artisticName || warning.clipperProfile.fullName,
        title,
        levelLabel,
        reason,
        punishments,
        campaignName: warning.campaign?.name ?? null,
      },
    };
  }, TRANSACTION_OPTIONS);

  invalidateRankingCaches(result.touchedCampaignIds);
  await sendWarningEmail(db, {
    event: "revoked",
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    ...result.email,
  });
  return result.summary satisfies RestoreSummary;
}

// ---------------------------------------------------------------------------
// Punições avulsas
// ---------------------------------------------------------------------------

export type ApplySanctionInput = {
  clipperProfileId: string;
  type: ManualSanctionType;
  /** Duração em dias; ausente = até liberação manual (retenção, observação). */
  durationDays?: number | null;
  scoreMultiplierBps?: number | null;
  campaignId?: string | null;
  /** DAY_POINTS_RESET e PODIUM_INELIGIBLE: dia do ranking (YYYY-MM-DD). */
  rankingDate?: string | null;
  reason: string;
  actorUserId: string;
  now?: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function applyManualSanction(
  db: PrismaClient,
  input: ApplySanctionInput,
) {
  assertDisciplineEnabled();
  const now = input.now ?? new Date();
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Descreva o motivo da punição." });
  }
  const durationRequired: ManualSanctionType[] = [
    "SCORE_MULTIPLIER",
    "BONUS_LOSS",
    "PREMIUM_CAMPAIGN_BLOCK",
  ];
  if (durationRequired.includes(input.type) && !input.durationDays) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Informe a duração em dias." });
  }
  if (
    input.type === "SCORE_MULTIPLIER" &&
    (!input.scoreMultiplierBps ||
      input.scoreMultiplierBps < 100 ||
      input.scoreMultiplierBps >= 10000)
  ) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Informe o percentual do redutor." });
  }
  const isDayScoped =
    input.type === "DAY_POINTS_RESET" || input.type === "PODIUM_INELIGIBLE";
  if (isDayScoped && (!input.campaignId || !input.rankingDate)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Informe a competição e o dia do ranking.",
    });
  }
  if (input.type === "PODIUM_INELIGIBLE" && input.rankingDate) {
    const dateError = podiumRankingDateError(input.rankingDate, now);
    if (dateError) throw new TRPCError({ code: "BAD_REQUEST", message: dateError });
  }

  const result = await db.$transaction(async (tx) => {
    await lockClipperProfile(tx, input.clipperProfileId);
    const profile = await tx.clipperProfile.findUnique({
      where: { id: input.clipperProfileId },
      select: { id: true, userId: true },
    });
    if (!profile) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Clipador não encontrado." });
    }
    const window =
      input.type === "DAY_POINTS_RESET" && input.rankingDate
        ? getPostedAtWindowUtc(input.rankingDate)
        : null;
    // O pódio guarda a janela do dia em startsAt/endsAt (é o que o ranking
    // ao vivo e a varredura do league leem).
    const podiumWindow =
      input.type === "PODIUM_INELIGIBLE" && input.rankingDate
        ? rankingDayWindowUtc(input.rankingDate)
        : null;
    const sanction = await tx.clipperSanction.create({
      data: {
        clipperProfileId: profile.id,
        type: input.type as ClipperSanctionType,
        campaignId: input.campaignId ?? null,
        scoreMultiplierBps:
          input.type === "SCORE_MULTIPLIER" ? input.scoreMultiplierBps : null,
        startsAt: podiumWindow?.startDate ?? now,
        // Retenção é sempre até liberação manual: com prazo, a carteira
        // continuaria bloqueada depois do fim (o bloqueio é recalculado só
        // nas ações de advertência).
        endsAt: podiumWindow
          ? podiumWindow.endDate
          : input.type === "DAY_POINTS_RESET" || input.type === "PAYOUT_HOLD"
            ? null
            : input.durationDays
              ? new Date(now.getTime() + input.durationDays * DAY_MS)
              : null,
        reason,
        createdById: input.actorUserId,
        metadata: window
          ? {
              rankingDate: input.rankingDate,
              startDate: window.startDate.toISOString(),
              endDate: window.endDate.toISOString(),
            }
          : podiumWindow
            ? { rankingDate: input.rankingDate }
            : undefined,
      },
      select: {
        id: true,
        type: true,
        endsAt: true,
        scoreMultiplierBps: true,
        metadata: true,
      },
    });

    let effects: DisciplineEffects = {};
    if (window && input.campaignId) {
      effects = await applyDayPointsReset(tx, {
        clipperProfileId: profile.id,
        campaignId: input.campaignId,
        window,
        reason: `${DISCIPLINE_DAY_RESET_REASON} (${input.rankingDate})`,
        actorUserId: input.actorUserId,
        now,
        sanctionId: sanction.id,
      });
      await tx.clipperSanction.update({
        where: { id: sanction.id },
        data: {
          metadata: {
            rankingDate: input.rankingDate,
            startDate: window.startDate.toISOString(),
            endDate: window.endDate.toISOString(),
            effects: effects as Prisma.InputJsonValue,
          },
        },
      });
      await syncDebtHold(tx, {
        clipperProfileId: profile.id,
        actorUserId: input.actorUserId,
        now,
      });
    }
    if (podiumWindow && input.campaignId && input.rankingDate) {
      effects = await applyPodiumIneligibility(tx, {
        clipperProfileId: profile.id,
        campaignId: input.campaignId,
        rankingDate: input.rankingDate,
        actorUserId: input.actorUserId,
        now,
        sanctionId: sanction.id,
      });
      await tx.clipperSanction.update({
        where: { id: sanction.id },
        data: {
          metadata: {
            rankingDate: input.rankingDate,
            effects: effects as Prisma.InputJsonValue,
          },
        },
      });
      await syncDebtHold(tx, {
        clipperProfileId: profile.id,
        actorUserId: input.actorUserId,
        now,
      });
    }
    await syncWalletHold(tx, profile.id, now);

    await tx.auditLog.create({
      data: {
        userId: input.actorUserId,
        action: "CREATE",
        entityType: "ClipperSanction",
        entityId: sanction.id,
        campaignId: input.campaignId ?? null,
        changes: {
          action: "apply_clipper_sanction",
          clipperProfileId: profile.id,
          type: input.type,
          durationDays: input.durationDays ?? null,
          scoreMultiplierBps: input.scoreMultiplierBps ?? null,
          rankingDate: input.rankingDate ?? null,
          invalidatedPostIds: (effects.posts ?? []).map((post) => post.id),
          disqualifiedDailyEntryIds: effects.dailyEntryIds ?? [],
          reversedAmount: (effects.reversals ?? []).reduce(
            (sum, row) => sum + row.amount,
            0,
          ),
        },
      },
    });

    await tx.notification.create({
      data: {
        userId: profile.userId,
        type: "SYSTEM_ALERT",
        channel: "IN_APP",
        title: "Nova punição aplicada",
        message: `${describeSanction(sanction)}. Motivo: ${reason}`,
        actionUrl: "/warnings",
        metadata: {
          kind: CLIPPER_WARNING_NOTIFICATION_KIND,
          sanctionId: sanction.id,
          event: "sanction_applied",
        },
        idempotencyKey: `clipper-sanction:${sanction.id}:applied`,
        sentAt: now,
      },
    });
    return { sanction, campaignId: input.campaignId ?? null };
  }, TRANSACTION_OPTIONS);

  if (result.campaignId) invalidateRankingCaches([result.campaignId]);
  return result.sanction;
}

/** Encerra uma punição antes do fim (inclui liberar retenção de pagamento). */
export async function revokeSanction(
  db: PrismaClient,
  input: {
    sanctionId: string;
    reason: string;
    restorePrizes?: boolean;
    actorUserId: string;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Descreva o motivo." });
  }
  const result = await db.$transaction(async (tx) => {
    const found = await tx.clipperSanction.findUnique({
      where: { id: input.sanctionId },
      select: { clipperProfileId: true },
    });
    if (!found) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Punição não encontrada." });
    }
    await lockClipperProfile(tx, found.clipperProfileId);
    const sanction = await tx.clipperSanction.findUniqueOrThrow({
      where: { id: input.sanctionId },
    });
    if (sanction.revokedAt) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Esta punição já foi encerrada." });
    }
    if (
      sanction.type === "PLATFORM_BAN" ||
      sanction.type === "COMPETITION_REMOVAL" ||
      sanction.type === "VIDEO_INVALIDATION"
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Banimento, remoção de competição e vídeo invalidado são desfeitos revogando a advertência.",
      });
    }
    await tx.clipperSanction.update({
      where: { id: sanction.id },
      data: { revokedAt: now, revokedById: input.actorUserId, revokeReason: reason },
    });
    let summary: RestoreSummary | null = null;
    if (sanction.type === "PODIUM_INELIGIBLE") {
      summary = await restorePodiumSanction(tx, sanction, {
        restorePrizes: input.restorePrizes ?? true,
        actorUserId: input.actorUserId,
        now,
        description: "Devolução de prêmio: punição encerrada",
      });
    }
    if (sanction.type === "DAY_POINTS_RESET") {
      const metadata = sanction.metadata as { effects?: unknown } | null;
      const deferred: DisciplineEffects = {};
      summary = await restoreEffects(tx, parseEffects(metadata?.effects), {
        clipperProfileId: sanction.clipperProfileId,
        restorePrizes: input.restorePrizes ?? true,
        actorUserId: input.actorUserId,
        now,
        description: "Devolução de prêmio: punição encerrada",
        deferred,
      });
      await saveSanctionDeferred(tx, sanction, deferred);
    }
    // A zeragem e o pódio cobriam vídeos do dia: o que outra revogação deixou
    // de fora por causa deles volta agora.
    const campaignIds = sanction.campaignId ? [sanction.campaignId] : [];
    if (summary) {
      const retried = await retryDeferredRestores(tx, {
        clipperProfileId: sanction.clipperProfileId,
        actorUserId: input.actorUserId,
        now,
      });
      addRestoreSummary(summary, retried.summary);
      campaignIds.push(...retried.campaignIds);
      await syncDebtHold(tx, {
        clipperProfileId: sanction.clipperProfileId,
        actorUserId: input.actorUserId,
        now,
      });
    }
    const walletHeld = await syncWalletHold(tx, sanction.clipperProfileId, now);
    await tx.auditLog.create({
      data: {
        userId: input.actorUserId,
        action: "UPDATE",
        entityType: "ClipperSanction",
        entityId: sanction.id,
        campaignId: sanction.campaignId,
        changes: {
          action: "revoke_clipper_sanction",
          type: sanction.type,
          reason,
          walletHeld,
          ...(summary ?? {}),
        },
      },
    });
    return { walletHeld, summary, campaignIds: [...new Set(campaignIds)] };
  }, TRANSACTION_OPTIONS);
  // Depois do commit: senão uma leitura concorrente recoloca o estado antigo no cache.
  if (result.campaignIds.length > 0) invalidateRankingCaches(result.campaignIds);
  return { walletHeld: result.walletHeld, summary: result.summary };
}

// ---------------------------------------------------------------------------
// Defesa do clipador
// ---------------------------------------------------------------------------

export async function submitWarningDefense(
  db: PrismaClient,
  input: { warningId: string; clipperProfileId: string; text: string; now?: Date },
) {
  const text = input.text.trim();
  if (text.length < 10) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Escreva sua defesa com pelo menos 10 caracteres.",
    });
  }
  const warning = await db.clipperWarning.findUnique({
    where: { id: input.warningId },
    select: { id: true, clipperProfileId: true, status: true, defenseSubmittedAt: true },
  });
  if (!warning || warning.clipperProfileId !== input.clipperProfileId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Advertência não encontrada." });
  }
  if (warning.status === "REVOKED") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Esta advertência foi revogada." });
  }
  if (warning.defenseSubmittedAt) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Você já enviou sua defesa." });
  }
  await db.clipperWarning.update({
    where: { id: warning.id },
    data: { defenseText: text.slice(0, 5000), defenseSubmittedAt: input.now ?? new Date() },
  });
  return { success: true };
}

// ---------------------------------------------------------------------------
// Fila de observação e análise de banimento
// ---------------------------------------------------------------------------

// Sem o prefixo "Advertência:": não há advertência a revogar, então o admin
// pode reaprovar o vídeo depois pelo status do post.
export const REVIEW_REJECTED_REASON = "Reprovado na revisão manual (em observação)";

export async function reviewObservationPost(
  db: PrismaClient,
  input: { clipPostId: string; approve: boolean; actorUserId: string },
) {
  return db.$transaction(async (tx) => {
    const post = await tx.clipPost.findUnique({
      where: { id: input.clipPostId },
      select: { id: true, status: true, ineligibilityReason: true, campaignId: true },
    });
    if (
      !post ||
      post.status !== "INELIGIBLE" ||
      post.ineligibilityReason !== DISCIPLINE_OBSERVATION_REASON
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Este vídeo não está aguardando revisão.",
      });
    }
    await tx.clipPost.update({
      where: { id: post.id },
      data: input.approve
        ? { status: "ELIGIBLE", ineligibilityReason: null }
        : { status: "DISQUALIFIED", ineligibilityReason: REVIEW_REJECTED_REASON },
    });
    await tx.auditLog.create({
      data: {
        userId: input.actorUserId,
        action: input.approve ? "APPROVE" : "REJECT",
        entityType: "ClipPost",
        entityId: post.id,
        campaignId: post.campaignId,
        changes: { action: "review_observation_clip_post", approve: input.approve },
      },
    });
    invalidateRankingCaches([post.campaignId]);
    return { success: true };
  });
}

/** Infração grave: a equipe decide se bane ou arquiva a análise. */
export async function decideBanReview(
  db: PrismaClient,
  input: { warningId: string; ban: boolean; actorUserId: string; now?: Date },
) {
  assertDisciplineEnabled();
  const now = input.now ?? new Date();
  const result = await db.$transaction(async (tx) => {
    const found = await tx.clipperWarning.findUnique({
      where: { id: input.warningId },
      select: { clipperProfileId: true },
    });
    if (!found) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Advertência não encontrada." });
    }
    await lockClipperProfile(tx, found.clipperProfileId);
    const warning = await tx.clipperWarning.findUniqueOrThrow({
      where: { id: input.warningId },
      select: {
        id: true,
        clipperProfileId: true,
        banReviewStatus: true,
        status: true,
        reason: true,
        effects: true,
        campaignId: true,
      },
    });
    if (warning.banReviewStatus !== "PENDING" || warning.status === "REVOKED") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Esta análise de banimento já foi decidida.",
      });
    }
    let touched: string[] = [];
    if (input.ban) {
      await tx.clipperSanction.create({
        data: {
          clipperProfileId: warning.clipperProfileId,
          warningId: warning.id,
          type: "PLATFORM_BAN",
          startsAt: now,
          endsAt: null,
          reason: warning.reason,
          createdById: input.actorUserId,
        },
      });
      const banEffects = await applyPlatformBan(tx, {
        clipperProfileId: warning.clipperProfileId,
        reason: DISCIPLINE_REMOVAL_REASON,
        actorUserId: input.actorUserId,
        now,
        warningId: warning.id,
      });
      const effects = mergeEffects(parseEffects(warning.effects), banEffects);
      await tx.clipperWarning.update({
        where: { id: warning.id },
        data: { effects: effects as Prisma.InputJsonValue },
      });
      touched = await campaignsTouched(tx, banEffects, null);
      await syncWalletHold(tx, warning.clipperProfileId, now);
    }
    await tx.clipperWarning.update({
      where: { id: warning.id },
      data: {
        banReviewStatus: input.ban ? "BANNED" : "DISMISSED",
        banReviewedAt: now,
        banReviewedById: input.actorUserId,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: input.actorUserId,
        action: input.ban ? "APPROVE" : "REJECT",
        entityType: "ClipperWarning",
        entityId: warning.id,
        campaignId: warning.campaignId,
        changes: { action: "decide_clipper_ban_review", ban: input.ban },
      },
    });
    return { touched };
  }, TRANSACTION_OPTIONS);
  invalidateRankingCaches(result.touched);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Botão Banir / Desbanir do painel (sem advertência)
// ---------------------------------------------------------------------------

export function isDisciplineEnabled() {
  return process.env.CLIPPER_DISCIPLINE_ENABLED === "true";
}

/**
 * Banimento manual: conta BANNED, saída das competições em andamento (sem
 * estorno) e carteira retida. Os efeitos ficam na sanção PLATFORM_BAN para o
 * desbanimento restaurar.
 */
export async function banClipperManually(
  db: PrismaClient,
  input: { clipperProfileId: string; reason: string; actorUserId: string; now?: Date },
) {
  const now = input.now ?? new Date();
  const reason = input.reason.trim() || "Banimento aplicado pela equipe";
  const result = await db.$transaction(async (tx) => {
    await lockClipperProfile(tx, input.clipperProfileId);
    const ban = await tx.clipperSanction.create({
      data: {
        clipperProfileId: input.clipperProfileId,
        type: "PLATFORM_BAN",
        startsAt: now,
        endsAt: null,
        reason,
        createdById: input.actorUserId,
      },
      select: { id: true },
    });
    await tx.clipperSanction.create({
      data: {
        clipperProfileId: input.clipperProfileId,
        type: "PAYOUT_HOLD",
        startsAt: now,
        endsAt: null,
        reason: "Conta banida",
        createdById: input.actorUserId,
        metadata: { banSanctionId: ban.id },
      },
    });
    const effects = await applyPlatformBan(tx, {
      clipperProfileId: input.clipperProfileId,
      reason: DISCIPLINE_REMOVAL_REASON,
      actorUserId: input.actorUserId,
      now,
    });
    await tx.clipperSanction.update({
      where: { id: ban.id },
      data: { metadata: { effects: effects as Prisma.InputJsonValue } },
    });
    await syncWalletHold(tx, input.clipperProfileId, now);
    await tx.auditLog.create({
      data: {
        userId: input.actorUserId,
        action: "DISABLE",
        entityType: "ClipperProfile",
        entityId: input.clipperProfileId,
        changes: {
          action: "ban_clipper",
          reason,
          sanctionId: ban.id,
          removedApplicationIds: (effects.applications ?? []).map((row) => row.id),
        },
      },
    });
    return campaignsTouched(tx, effects, null);
  }, TRANSACTION_OPTIONS);
  invalidateRankingCaches(result);
  return { success: true };
}

/** Desbanir: encerra o banimento manual e a retenção dele, e restaura as inscrições. */
export async function unbanClipperManually(
  db: PrismaClient,
  input: { clipperProfileId: string; actorUserId: string; now?: Date },
) {
  const now = input.now ?? new Date();
  const result = await db.$transaction(async (tx) => {
    await lockClipperProfile(tx, input.clipperProfileId);
    const bans = await tx.clipperSanction.findMany({
      where: {
        clipperProfileId: input.clipperProfileId,
        type: "PLATFORM_BAN",
        warningId: null,
        revokedAt: null,
      },
      select: { id: true, metadata: true },
    });
    // Encerra os bans antes de restaurar: restoreEffects só desfaz o que
    // nenhuma outra punição ativa continua cobrindo.
    const banIds = bans.map((ban) => ban.id);
    await tx.clipperSanction.updateMany({
      where: { id: { in: banIds }, revokedAt: null },
      data: { revokedAt: now, revokedById: input.actorUserId, revokeReason: "Desbanido" },
    });
    if (banIds.length > 0) {
      await tx.clipperSanction.updateMany({
        where: {
          clipperProfileId: input.clipperProfileId,
          type: "PAYOUT_HOLD",
          revokedAt: null,
          OR: banIds.map((id) => ({ metadata: { path: ["banSanctionId"], equals: id } })),
        },
        data: { revokedAt: now, revokedById: input.actorUserId, revokeReason: "Desbanido" },
      });
    }
    const touched = new Set<string>();
    const deferredByBan: { ban: (typeof bans)[number]; deferred: DisciplineEffects }[] = [];
    for (const ban of bans) {
      const effects = parseEffects(
        (ban.metadata as { effects?: unknown } | null)?.effects,
      );
      const deferred: DisciplineEffects = {};
      await restoreEffects(tx, effects, {
        clipperProfileId: input.clipperProfileId,
        restorePrizes: false,
        actorUserId: input.actorUserId,
        now,
        description: "Desbanimento",
        deferred,
      });
      deferredByBan.push({ ban, deferred });
      for (const id of await campaignsTouched(tx, effects, null)) touched.add(id);
    }
    if (bans.length > 0) {
      const retried = await retryDeferredRestores(tx, {
        clipperProfileId: input.clipperProfileId,
        actorUserId: input.actorUserId,
        now,
      });
      for (const id of retried.campaignIds) touched.add(id);
      for (const { ban, deferred } of deferredByBan) {
        await saveSanctionDeferred(tx, ban, deferred);
      }
      await syncDebtHold(tx, {
        clipperProfileId: input.clipperProfileId,
        actorUserId: input.actorUserId,
        now,
      });
    }
    await syncWalletHold(tx, input.clipperProfileId, now);
    return [...touched];
  }, TRANSACTION_OPTIONS);
  invalidateRankingCaches(result);
  return { success: true };
}
