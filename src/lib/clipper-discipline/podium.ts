/**
 * "Inelegível ao pódio": os vídeos que o clipador postou num dia do ranking
 * ficam fora de todos os rankings diários daquele dia na competição da
 * advertência (ranking diário e Top Clipadores). Os vídeos continuam válidos
 * e contam no ranking mensal. A sanção PODIUM_INELIGIBLE guarda a janela do
 * dia em startsAt/endsAt.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const YMD_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** YYYY-MM-DD que existe no calendário. */
export function isRankingDateYmd(value: string): boolean {
  const match = YMD_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().slice(0, 10) === value;
}

/**
 * Janela do dia D do ranking: [D-1 20:00 UTC, D 20:00 UTC), ou seja, das 17h
 * do dia anterior às 17h do dia D no horário de Brasília. Única definição:
 * getPostedAtWindowUtc (ranking diário e Top Clipadores) delega para cá.
 */
export function rankingDayWindowUtc(dateYmd: string): {
  startDate: Date;
  endDate: Date;
} {
  const match = YMD_PATTERN.exec(dateYmd);
  if (!match) throw new Error(`Dia do ranking inválido: ${dateYmd}`);
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  const endDate = new Date(Date.UTC(year, month - 1, day, 20));
  return { startDate: new Date(endDate.getTime() - DAY_MS), endDate };
}

/** Dia do ranking que está aberto no instante (o que fecha às próximas 17h de Brasília). */
export function openRankingDateYmd(now: Date): string {
  return new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Último dia do ranking já fechado no instante (o anterior ao aberto). */
export function lastClosedRankingDateYmd(now: Date): string {
  return new Date(now.getTime() + 4 * 60 * 60 * 1000 - DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** TopClippersDailyRanking.rankingDate do dia do ranking (meia-noite UTC). */
export function topClippersRankingDate(dateYmd: string): Date {
  return new Date(`${dateYmd}T00:00:00.000Z`);
}

/** "16/10/2026". */
export function formatRankingDateYmd(dateYmd: string): string {
  return dateYmd.split("-").reverse().join("/");
}

export type PodiumSanctionWindow = {
  clipperProfileId: string;
  campaignId: string | null;
  startsAt: Date;
  endsAt: Date | null;
  revokedAt: Date | null;
};

/** Mesmo predicado de podiumIneligibleSql, em JS. */
export function podiumCoversPost(
  sanctions: readonly PodiumSanctionWindow[],
  post: { clipperProfileId: string; campaignId: string; postedAt: Date | null },
): boolean {
  if (!post.postedAt) return false;
  const t = post.postedAt.getTime();
  return sanctions.some(
    (sanction) =>
      sanction.revokedAt === null &&
      sanction.clipperProfileId === post.clipperProfileId &&
      sanction.campaignId === post.campaignId &&
      sanction.startsAt.getTime() <= t &&
      sanction.endsAt !== null &&
      sanction.endsAt.getTime() > t,
  );
}
