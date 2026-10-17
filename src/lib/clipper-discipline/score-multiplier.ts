import { Prisma } from "@prisma/client";

/**
 * Redutor de score das advertências. O fator vem em bps (8000 = ×0,8) e vale
 * para cada vídeo postado dentro da janela de uma sanção SCORE_MULTIPLIER;
 * com sanções sobrepostas vale o menor fator. O backend league aplica o mesmo
 * fragmento SQL na query do payout PIX, então o texto precisa ficar idêntico
 * ao de league/src/modules/clipper-discipline/score-multiplier.sql.ts.
 */
export const SCORE_MULTIPLIER_NEUTRAL_BPS = 10000;

/** Fator (bps) do redutor de score do clipador para um post. 10000 = sem redutor. Texto idêntico ao do league. */
export function scoreMultiplierBpsSql(
  profileCol: string,
  postedAtCol: string,
): Prisma.Sql {
  const profile = Prisma.raw(profileCol);
  const postedAt = Prisma.raw(postedAtCol);
  return Prisma.sql`COALESCE((
    SELECT MIN(s."scoreMultiplierBps")
    FROM "ClipperSanction" s
    WHERE s."clipperProfileId" = ${profile}
      AND s."type" = 'SCORE_MULTIPLIER'
      AND s."scoreMultiplierBps" IS NOT NULL
      AND s."startsAt" <= ${postedAt}
      AND (s."endsAt" IS NULL OR s."endsAt" > ${postedAt})
      AND (s."revokedAt" IS NULL OR s."revokedAt" > ${postedAt})
  ), 10000)`;
}

/** floor(value * bps / 10000) exato para inteiros não negativos. */
export function applyScoreMultiplierBps(value: number, bps: number): number {
  if (bps >= SCORE_MULTIPLIER_NEUTRAL_BPS) return value;
  const n = value * bps;
  return (n - (n % 10000)) / 10000;
}

export type ScoreMultiplierWindow = {
  scoreMultiplierBps: number | null;
  startsAt: Date;
  endsAt: Date | null;
  revokedAt: Date | null;
};

/** Uma sanção cobre o instante t: startsAt <= t < min(endsAt, revokedAt). */
export function sanctionCoversInstant(
  sanction: Pick<ScoreMultiplierWindow, "startsAt" | "endsAt" | "revokedAt">,
  at: Date,
): boolean {
  const t = at.getTime();
  return (
    sanction.startsAt.getTime() <= t &&
    (sanction.endsAt === null || sanction.endsAt.getTime() > t) &&
    (sanction.revokedAt === null || sanction.revokedAt.getTime() > t)
  );
}

/** Mesmo predicado do SQL, em JS (caminhos que montam o ranking via Prisma). */
export function resolveScoreMultiplierBps(
  sanctions: readonly ScoreMultiplierWindow[],
  postedAt: Date | null,
): number {
  if (!postedAt) return SCORE_MULTIPLIER_NEUTRAL_BPS;
  let bps = SCORE_MULTIPLIER_NEUTRAL_BPS;
  for (const sanction of sanctions) {
    if (
      sanction.scoreMultiplierBps !== null &&
      sanctionCoversInstant(sanction, postedAt) &&
      sanction.scoreMultiplierBps < bps
    ) {
      bps = sanction.scoreMultiplierBps;
    }
  }
  return bps;
}

/** "×0,8" para exibição. */
export function formatScoreMultiplier(bps: number): string {
  return `×${(bps / 10000).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}`;
}
