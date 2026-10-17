import { Prisma } from "@prisma/client";

/**
 * Vídeo de um clipador "inelegível ao pódio" no dia em que foi postado: fica
 * fora dos rankings diários da competição. O backend league desclassifica as
 * entries do snapshot com o mesmo fragmento, então o texto precisa ficar
 * idêntico ao de league/src/modules/clipper-discipline/podium.sql.ts.
 * Qualquer revogação devolve os vídeos ao ranking.
 */
export function podiumIneligibleSql(
  profileCol: string,
  campaignCol: string,
  postedAtCol: string,
): Prisma.Sql {
  const profile = Prisma.raw(profileCol);
  const campaign = Prisma.raw(campaignCol);
  const postedAt = Prisma.raw(postedAtCol);
  return Prisma.sql`EXISTS (
    SELECT 1
    FROM "ClipperSanction" s
    WHERE s."clipperProfileId" = ${profile}
      AND s."campaignId" = ${campaign}
      AND s."type" = 'PODIUM_INELIGIBLE'
      AND s."revokedAt" IS NULL
      AND s."startsAt" <= ${postedAt}
      AND s."endsAt" > ${postedAt}
  )`;
}

/**
 * Lock (pg_advisory_xact_lock(hashtext(prefixo + campaignId))) que a varredura
 * pós-snapshot do league pega por campanha. As advertências que mexem nos
 * rankings pegam o mesmo lock antes de ler as entries: ou a varredura vê a
 * advertência já comitada, ou a advertência vê as entries do snapshot. Mesmo
 * prefixo de league/src/modules/clipper-discipline/podium.sql.ts.
 */
export const DAILY_RANKING_SNAPSHOT_LOCK_PREFIX = "daily-ranking-snapshot:";

export function dailyRankingSnapshotLockSql(campaignId: string): Prisma.Sql {
  return Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${DAILY_RANKING_SNAPSHOT_LOCK_PREFIX + campaignId}))`;
}
