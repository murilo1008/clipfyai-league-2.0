import type { ClipperSanctionType, Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { formatInTimeZone } from "date-fns-tz";

import { DISCIPLINE_INVALIDATION_REASON_PREFIX } from "@/lib/clipper-discipline/constants";

export type DisciplineDb = PrismaClient | Prisma.TransactionClient;

const RESTRICTION_TYPES = [
  "POSTING_SUSPENSION",
  "PAYOUT_HOLD",
  "OBSERVATION_MODE",
  "PREMIUM_CAMPAIGN_BLOCK",
  "SCORE_MULTIPLIER",
  "BONUS_LOSS",
] as const satisfies readonly ClipperSanctionType[];

/** Sanções que cobrem o instante `now` (startsAt <= now < min(endsAt, revokedAt)). */
export function activeSanctionWhere(
  clipperProfileId: string,
  now: Date,
  types: readonly ClipperSanctionType[],
): Prisma.ClipperSanctionWhereInput {
  return {
    clipperProfileId,
    type: { in: [...types] },
    startsAt: { lte: now },
    AND: [
      { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      { OR: [{ revokedAt: null }, { revokedAt: { gt: now } }] },
    ],
  };
}

type Window = { endsAt: Date | null };

export type ClipperRestrictions = {
  banned: boolean;
  /** Fim da suspensão de envio mais longa em vigor. */
  suspension: { endsAt: Date } | null;
  payoutHold: { reasons: string[] } | null;
  observation: Window | null;
  premiumBlock: Window | null;
  scoreMultiplier: (Window & { bps: number }) | null;
  bonusLoss: Window | null;
};

/** Fim mais distante entre as janelas (null = sem fim). */
function latestEnd(windows: readonly Window[]): Window | null {
  if (windows.length === 0) return null;
  if (windows.some((window) => window.endsAt === null)) return { endsAt: null };
  const max = Math.max(...windows.map((window) => window.endsAt!.getTime()));
  return { endsAt: new Date(max) };
}

export async function getClipperRestrictions(
  db: DisciplineDb,
  clipperProfileId: string,
  now = new Date(),
): Promise<ClipperRestrictions> {
  const [profile, sanctions] = await Promise.all([
    db.clipperProfile.findUnique({
      where: { id: clipperProfileId },
      select: { verificationStatus: true },
    }),
    db.clipperSanction.findMany({
      where: activeSanctionWhere(clipperProfileId, now, RESTRICTION_TYPES),
      select: {
        type: true,
        endsAt: true,
        scoreMultiplierBps: true,
        reason: true,
      },
    }),
  ]);

  const ofType = (type: ClipperSanctionType) =>
    sanctions.filter((sanction) => sanction.type === type);

  const suspensions = ofType("POSTING_SUSPENSION");
  const suspensionEnd = latestEnd(suspensions);
  const holds = ofType("PAYOUT_HOLD");
  const multipliers = ofType("SCORE_MULTIPLIER").filter(
    (sanction) => sanction.scoreMultiplierBps !== null,
  );
  const strongest = multipliers.reduce<(typeof multipliers)[number] | null>(
    (best, sanction) =>
      !best || sanction.scoreMultiplierBps! < best.scoreMultiplierBps!
        ? sanction
        : best,
    null,
  );

  return {
    banned: profile?.verificationStatus === "BANNED",
    // Toda suspensão tem fim; uma sem fim (dado inconsistente) vale por 100 anos.
    suspension: suspensionEnd
      ? {
          endsAt:
            suspensionEnd.endsAt ??
            new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000),
        }
      : null,
    payoutHold:
      holds.length > 0
        ? {
            reasons: holds
              .map((hold) => hold.reason?.trim())
              .filter((reason): reason is string => !!reason),
          }
        : null,
    observation: latestEnd(ofType("OBSERVATION_MODE")),
    premiumBlock: latestEnd(ofType("PREMIUM_CAMPAIGN_BLOCK")),
    scoreMultiplier: strongest
      ? { bps: strongest.scoreMultiplierBps!, endsAt: strongest.endsAt }
      : null,
    bonusLoss: latestEnd(ofType("BONUS_LOSS")),
  };
}

/** "16/10/2026 às 14:30" no horário de Brasília. */
export function formatDisciplineDate(date: Date): string {
  return formatInTimeZone(date, "America/Sao_Paulo", "dd/MM/yyyy 'às' HH:mm");
}

export const BANNED_ACCOUNT_MESSAGE =
  "Sua conta está banida da plataforma. Fale com o suporte se precisar de ajuda.";

export function suspensionMessage(endsAt: Date): string {
  return `Você está suspenso de enviar vídeos até ${formatDisciplineDate(endsAt)} (horário de Brasília).`;
}

/** Envio de vídeos: bloqueia conta banida e suspensão em vigor. */
export async function assertCanSubmitPosts(
  db: DisciplineDb,
  clipperProfileId: string,
  now = new Date(),
) {
  const restrictions = await getClipperRestrictions(db, clipperProfileId, now);
  if (restrictions.banned) {
    throw new TRPCError({ code: "FORBIDDEN", message: BANNED_ACCOUNT_MESSAGE });
  }
  if (restrictions.suspension) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: suspensionMessage(restrictions.suspension.endsAt),
    });
  }
}

/** Inscrição em competição: bloqueia conta banida e o bloqueio de campanhas premium. */
export async function assertCanEnroll(
  db: DisciplineDb,
  clipperProfileId: string,
  campaign: { isProOnly: boolean },
  now = new Date(),
) {
  const restrictions = await getClipperRestrictions(db, clipperProfileId, now);
  if (restrictions.banned) {
    throw new TRPCError({ code: "FORBIDDEN", message: BANNED_ACCOUNT_MESSAGE });
  }
  if (campaign.isProOnly && restrictions.premiumBlock) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: restrictions.premiumBlock.endsAt
        ? `Você não pode entrar em campanhas premium até ${formatDisciplineDate(restrictions.premiumBlock.endsAt)} (horário de Brasília).`
        : "Você não pode entrar em campanhas premium no momento.",
    });
  }
}

export const PAYOUT_HELD_MESSAGE =
  "Seus pagamentos estão retidos pela equipe. O saque fica liberado quando a retenção for encerrada.";

/** Saque: bloqueia conta banida e retenção de pagamento. */
export async function assertCanWithdraw(
  db: DisciplineDb,
  clipperProfileId: string,
  now = new Date(),
) {
  const restrictions = await getClipperRestrictions(db, clipperProfileId, now);
  if (restrictions.banned) {
    throw new TRPCError({ code: "FORBIDDEN", message: BANNED_ACCOUNT_MESSAGE });
  }
  if (restrictions.payoutHold) {
    throw new TRPCError({ code: "FORBIDDEN", message: PAYOUT_HELD_MESSAGE });
  }
}

/**
 * Bloqueia ações do admin que fariam um vídeo punido voltar a pontuar por
 * fora da revogação (que restaura só o que a advertência mudou).
 */
export function disciplineScoringLockMessage(input: {
  postStatus?: string | null;
  ineligibilityReason?: string | null;
  applicationStatus?: string | null;
}): string | null {
  if (input.applicationStatus === "REVOKED") {
    return "O clipador foi removido desta competição por advertência. Revogue a advertência para restaurar a participação.";
  }
  if (
    input.postStatus === "DISQUALIFIED" &&
    input.ineligibilityReason?.startsWith(DISCIPLINE_INVALIDATION_REASON_PREFIX)
  ) {
    return "Este vídeo foi invalidado por advertência. Revogue a advertência para restaurá-lo.";
  }
  return null;
}
