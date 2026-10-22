import { Prisma } from "@prisma/client";

/**
 * Redutor de score das advertências. O fator vem em bps (8000 = ×0,8) e vale
 * para cada vídeo postado dentro da janela de uma sanção SCORE_MULTIPLIER;
 * com sanções sobrepostas vale o menor fator. O backend league aplica o mesmo
 * fragmento SQL na query do payout PIX, então o texto precisa ficar idêntico
 * ao de league/src/modules/clipper-discipline/score-multiplier.sql.ts.
 */
export const SCORE_MULTIPLIER_NEUTRAL_BPS = 10000;

/**
 * Onde o redutor é lido: o ranking diário (e o payout PIX do league) ou o
 * mensal. Cada um trava em momentos diferentes (dia pago × prêmio mensal pago).
 */
export type ScoreMultiplierScope = "daily" | "monthly";

/**
 * Sanção revogada com a advertência: o redutor sai desde o início, mas
 * continua valendo até a data gravada aqui, por escopo e competição, nos
 * rankings que já foram pagos (ISO, UTC). Fica em ClipperSanction.metadata.
 */
export type ScoreMultiplierKeptUntil = Partial<
  Record<ScoreMultiplierScope, Record<string, string>>
>;

/** Fator (bps) do redutor de score do clipador para um post. 10000 = sem redutor. Texto idêntico ao do league. */
export function scoreMultiplierBpsSql(
  profileCol: string,
  postedAtCol: string,
  campaignCol: string,
  scope: ScoreMultiplierScope,
): Prisma.Sql {
  const profile = Prisma.raw(profileCol);
  const postedAt = Prisma.raw(postedAtCol);
  const campaign = Prisma.raw(campaignCol);
  const keptScope = Prisma.raw(`'${scope}'`);
  return Prisma.sql`COALESCE((
    SELECT MIN(s."scoreMultiplierBps")
    FROM "ClipperSanction" s
    WHERE s."clipperProfileId" = ${profile}
      AND s."type" = 'SCORE_MULTIPLIER'
      AND s."scoreMultiplierBps" IS NOT NULL
      AND s."startsAt" <= ${postedAt}
      AND (s."endsAt" IS NULL OR s."endsAt" > ${postedAt})
      AND (
        s."revokedAt" IS NULL
        OR s."revokedAt" > ${postedAt}
        OR (s."metadata"->'keptUntil'->${keptScope}->>${campaign})::timestamp > ${postedAt}
      )
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
  metadata?: Prisma.JsonValue | null;
};

/** keptUntil[scope][campaignId] da sanção, se houver. */
export function scoreMultiplierKeptUntil(
  metadata: Prisma.JsonValue | null | undefined,
  scope: ScoreMultiplierScope,
  campaignId: string,
): Date | null {
  const keptUntil = (metadata as { keptUntil?: ScoreMultiplierKeptUntil } | null)
    ?.keptUntil;
  const value = keptUntil?.[scope]?.[campaignId];
  return typeof value === "string" ? new Date(value) : null;
}

/** Mesmo predicado do SQL, em JS (caminhos que montam o ranking via Prisma). */
export function resolveScoreMultiplierBps(
  sanctions: readonly ScoreMultiplierWindow[],
  post: { postedAt: Date | null; campaignId: string },
  scope: ScoreMultiplierScope,
): number {
  if (!post.postedAt) return SCORE_MULTIPLIER_NEUTRAL_BPS;
  const t = post.postedAt.getTime();
  let bps = SCORE_MULTIPLIER_NEUTRAL_BPS;
  for (const sanction of sanctions) {
    if (sanction.scoreMultiplierBps === null) continue;
    if (sanction.startsAt.getTime() > t) continue;
    if (sanction.endsAt !== null && sanction.endsAt.getTime() <= t) continue;
    const keptUntil = scoreMultiplierKeptUntil(sanction.metadata, scope, post.campaignId);
    const live =
      sanction.revokedAt === null ||
      sanction.revokedAt.getTime() > t ||
      (keptUntil !== null && keptUntil.getTime() > t);
    if (live && sanction.scoreMultiplierBps < bps) bps = sanction.scoreMultiplierBps;
  }
  return bps;
}

/**
 * keptUntil de um redutor revogado com a advertência. `priorEnd` é até onde
 * ele valia antes (encerrado antes ou agora). Diário: até o fim do último dia
 * pago de cada competição. Mensal: inteiro nas competições com prêmio mensal
 * já pago.
 */
export function buildScoreMultiplierKeptUntil(input: {
  startsAt: Date;
  priorEnd: Date;
  dailyLockedUntil: ReadonlyMap<string, Date>;
  monthlyPaidCampaignIds: ReadonlySet<string>;
}): ScoreMultiplierKeptUntil {
  const keptUntil: ScoreMultiplierKeptUntil = {};
  const start = input.startsAt.getTime();
  for (const [campaignId, cutoff] of input.dailyLockedUntil) {
    const until = cutoff < input.priorEnd ? cutoff : input.priorEnd;
    if (until.getTime() <= start) continue;
    (keptUntil.daily ??= {})[campaignId] = until.toISOString();
  }
  if (input.priorEnd.getTime() > start) {
    for (const campaignId of input.monthlyPaidCampaignIds) {
      (keptUntil.monthly ??= {})[campaignId] = input.priorEnd.toISOString();
    }
  }
  return keptUntil;
}

/** "×0,8" para exibição. */
export function formatScoreMultiplier(bps: number): string {
  return `×${(bps / 10000).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}`;
}
