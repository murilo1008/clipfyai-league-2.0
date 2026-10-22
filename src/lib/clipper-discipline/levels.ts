import type {
  ClipperInfractionType,
  ClipperSanctionType,
  ClipperWarningStatus,
} from "@prisma/client";

import { MAX_WARNING_LEVEL } from "./constants";
import {
  isRankingDateYmd,
  lastClosedRankingDateYmd,
  openRankingDateYmd,
  rankingDayWindowUtc,
} from "./podium";
import type { DisciplineSettings } from "./settings";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Na sugestão, uma infração grave ativa pesa como o nível 3. */
export const SEVERE_EQUIVALENT_LEVEL = 3;

export type ActiveWarningForSuggestion = {
  infractionType: ClipperInfractionType;
  level: number | null;
};

/**
 * Próximo nível da escala para uma infração leve/média: o maior nível ativo
 * mais um (até 4), ou 0 (aviso formal) sem advertências ativas.
 */
export function suggestNextLevel(
  activeWarnings: readonly ActiveWarningForSuggestion[],
): number {
  if (activeWarnings.length === 0) return 0;
  const highest = Math.max(
    ...activeWarnings.map((warning) =>
      warning.infractionType === "SEVERE"
        ? SEVERE_EQUIVALENT_LEVEL
        : (warning.level ?? 0),
    ),
  );
  return Math.min(highest + 1, MAX_WARNING_LEVEL);
}

export type WarningStatusInput = {
  status: ClipperWarningStatus;
  expiresAt: Date;
};

/** Status efetivo: uma ACTIVE vencida já conta como expirada. */
export function effectiveWarningStatus(
  warning: WarningStatusInput,
  now: Date,
): ClipperWarningStatus {
  if (warning.status === "ACTIVE" && warning.expiresAt <= now) {
    return "EXPIRED";
  }
  return warning.status;
}

export type SanctionDraft = {
  type: ClipperSanctionType;
  startsAt: Date;
  endsAt: Date | null;
  scoreMultiplierBps?: number;
  campaignId?: string;
  clipPostId?: string;
  /** PODIUM_INELIGIBLE: dia do ranking (YYYY-MM-DD), gravado em metadata. */
  rankingDate?: string;
};

export type SanctionPlanInput = {
  infractionType: ClipperInfractionType;
  /** 0–4; ignorado na infração grave. */
  level: number | null;
  settings: DisciplineSettings;
  now: Date;
  campaignId?: string | null;
  clipPostId?: string | null;
  /** Inelegível ao pódio no dia do ranking informado (YYYY-MM-DD). */
  podiumRankingDate?: string | null;
};

export class SanctionPlanError extends Error {}

/** Exigências de cada nível, para validar o formulário antes de aplicar. */
export function levelRequirements(
  infractionType: ClipperInfractionType,
  level: number | null,
) {
  if (infractionType === "SEVERE") {
    return {
      requiresVideo: false,
      requiresCampaign: true,
      requiresBanConfirmation: false,
      allowsPodium: false,
    };
  }
  return {
    requiresVideo: level === 0 || level === 1,
    requiresCampaign: level === 3,
    requiresBanConfirmation: level === MAX_WARNING_LEVEL,
    // Do nível 3 em diante o clipador já sai da competição inteira.
    allowsPodium: level !== null && level <= 2,
  };
}

/** Valida o dia do "inelegível ao pódio": existe e não é futuro. */
export function podiumRankingDateError(dateYmd: string, now: Date): string | null {
  if (!isRankingDateYmd(dateYmd)) return "Informe o dia do ranking.";
  if (dateYmd > openRankingDateYmd(now)) {
    return "O dia do ranking não pode ser futuro.";
  }
  return null;
}

/**
 * Valida o dia do "zerar pontos do dia": existe e já fechou. A zeragem só
 * pega os vídeos que existem ao aplicar, então no dia aberto os enviados
 * depois continuariam pontuando.
 */
export function dayPointsResetDateError(dateYmd: string, now: Date): string | null {
  if (!isRankingDateYmd(dateYmd)) return "Informe o dia do ranking.";
  if (dateYmd > lastClosedRankingDateYmd(now)) {
    return "Só dá para zerar um dia do ranking já encerrado.";
  }
  return null;
}

/**
 * Punições geradas pela advertência. O vídeo da infração, quando informado,
 * sempre deixa de pontuar.
 */
export function buildSanctionPlan(input: SanctionPlanInput): SanctionDraft[] {
  const { infractionType, settings, now } = input;
  const campaignId = input.campaignId ?? undefined;
  const clipPostId = input.clipPostId ?? undefined;
  const level = infractionType === "SEVERE" ? null : input.level;

  if (infractionType !== "SEVERE") {
    if (
      level === null ||
      !Number.isInteger(level) ||
      level < 0 ||
      level > MAX_WARNING_LEVEL
    ) {
      throw new SanctionPlanError("Nível de advertência inválido.");
    }
  }

  const requirements = levelRequirements(infractionType, level);
  if (requirements.requiresVideo && !clipPostId) {
    throw new SanctionPlanError("Informe o vídeo da infração.");
  }
  if (requirements.requiresCampaign && !campaignId) {
    throw new SanctionPlanError("Informe a competição da infração.");
  }
  const podiumRankingDate = input.podiumRankingDate ?? undefined;
  if (podiumRankingDate) {
    if (!requirements.allowsPodium) {
      throw new SanctionPlanError(
        "Inelegível ao pódio vale só para os níveis 0 a 2: os demais já tiram o clipador da competição.",
      );
    }
    if (!campaignId) {
      throw new SanctionPlanError("Informe a competição do inelegível ao pódio.");
    }
    const dateError = podiumRankingDateError(podiumRankingDate, now);
    if (dateError) throw new SanctionPlanError(dateError);
  }

  const plan: SanctionDraft[] = [];
  if (clipPostId) {
    plan.push({
      type: "VIDEO_INVALIDATION",
      startsAt: now,
      endsAt: null,
      campaignId,
      clipPostId,
    });
  }

  if (infractionType === "SEVERE") {
    plan.push(
      { type: "COMPETITION_REMOVAL", startsAt: now, endsAt: null, campaignId },
      { type: "PAYOUT_HOLD", startsAt: now, endsAt: null },
    );
    return plan;
  }

  switch (level) {
    case 1:
      plan.push({
        type: "POSTING_SUSPENSION",
        startsAt: now,
        endsAt: new Date(now.getTime() + settings.level1SuspensionHours * HOUR_MS),
      });
      break;
    case 2:
      plan.push(
        {
          type: "POSTING_SUSPENSION",
          startsAt: now,
          endsAt: new Date(
            now.getTime() + settings.level2SuspensionHours * HOUR_MS,
          ),
        },
        {
          type: "SCORE_MULTIPLIER",
          startsAt: now,
          endsAt: new Date(
            now.getTime() + settings.level2ScoreMultiplierDays * DAY_MS,
          ),
          scoreMultiplierBps: settings.level2ScoreMultiplierBps,
        },
      );
      break;
    case 3:
      plan.push({
        type: "COMPETITION_REMOVAL",
        startsAt: now,
        endsAt: null,
        campaignId,
      });
      break;
    case 4:
      plan.push(
        { type: "PLATFORM_BAN", startsAt: now, endsAt: null },
        { type: "PAYOUT_HOLD", startsAt: now, endsAt: null },
      );
      break;
    default:
      break;
  }
  if (podiumRankingDate && campaignId) {
    const window = rankingDayWindowUtc(podiumRankingDate);
    plan.push({
      type: "PODIUM_INELIGIBLE",
      startsAt: window.startDate,
      endsAt: window.endDate,
      campaignId,
      rankingDate: podiumRankingDate,
    });
  }
  return plan;
}

export function warningExpiresAt(settings: DisciplineSettings, now: Date): Date {
  return new Date(now.getTime() + settings.warningExpiryDays * DAY_MS);
}

/** Punições complementares que o admin aplica sem advertência. */
export const MANUAL_SANCTION_TYPES = [
  "SCORE_MULTIPLIER",
  "OBSERVATION_MODE",
  "BONUS_LOSS",
  "PREMIUM_CAMPAIGN_BLOCK",
  "DAY_POINTS_RESET",
  "PODIUM_INELIGIBLE",
  "PAYOUT_HOLD",
] as const satisfies readonly ClipperSanctionType[];

export type ManualSanctionType = (typeof MANUAL_SANCTION_TYPES)[number];

export const INFRACTION_TYPE_LABELS: Record<ClipperInfractionType, string> = {
  LIGHT: "Leve",
  MEDIUM: "Média",
  SEVERE: "Grave",
};

export const WARNING_STATUS_LABELS: Record<ClipperWarningStatus, string> = {
  ACTIVE: "Ativa",
  EXPIRED: "Expirada",
  REVOKED: "Revogada",
};

export const SANCTION_TYPE_LABELS: Record<ClipperSanctionType, string> = {
  VIDEO_INVALIDATION: "Vídeo invalidado",
  POSTING_SUSPENSION: "Suspensão de envio",
  SCORE_MULTIPLIER: "Redutor de pontuação",
  COMPETITION_REMOVAL: "Removido da competição",
  PAYOUT_HOLD: "Pagamento retido",
  OBSERVATION_MODE: "Em observação",
  BONUS_LOSS: "Perda de bônus",
  PREMIUM_CAMPAIGN_BLOCK: "Bloqueio de campanhas premium",
  DAY_POINTS_RESET: "Pontos do dia zerados",
  PLATFORM_BAN: "Banimento",
  PODIUM_INELIGIBLE: "Inelegível ao pódio",
};

export function warningLevelLabel(
  infractionType: ClipperInfractionType,
  level: number | null,
): string {
  if (infractionType === "SEVERE") return "Infração grave";
  if (level === 0) return "Aviso formal";
  return `Advertência ${level}`;
}
