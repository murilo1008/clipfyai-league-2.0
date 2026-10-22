import type { PrismaClient } from "@prisma/client";

import {
  resolveScoreMultiplierBps,
  scoreMultiplierBpsSql,
  SCORE_MULTIPLIER_NEUTRAL_BPS,
} from "@/lib/clipper-discipline/score-multiplier";

/**
 * Fator do redutor por post do ranking diário de uma competição, para os
 * caminhos que montam o ranking via Prisma (mesmo predicado do SQL). Uma
 * consulta só, e nenhuma se ninguém tem redutor.
 */
export async function loadScoreMultipliersForPosts(
  db: PrismaClient,
  campaignId: string,
  posts: readonly { id: string; applicationId: string; postedAt: Date | null }[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (posts.length === 0) return result;
  const applicationIds = [...new Set(posts.map((post) => post.applicationId))];
  const sanctions = await db.clipperSanction.findMany({
    where: {
      type: "SCORE_MULTIPLIER",
      scoreMultiplierBps: { not: null },
      clipperProfile: { applications: { some: { id: { in: applicationIds } } } },
    },
    select: {
      clipperProfileId: true,
      scoreMultiplierBps: true,
      startsAt: true,
      endsAt: true,
      revokedAt: true,
      metadata: true,
    },
  });
  if (sanctions.length === 0) return result;

  const applications = await db.clipperApplication.findMany({
    where: {
      id: { in: applicationIds },
      clipperProfileId: { in: [...new Set(sanctions.map((s) => s.clipperProfileId))] },
    },
    select: { id: true, clipperProfileId: true },
  });
  const profileByApplication = new Map(
    applications.map((application) => [application.id, application.clipperProfileId]),
  );
  for (const post of posts) {
    const profileId = profileByApplication.get(post.applicationId);
    if (!profileId) continue;
    const bps = resolveScoreMultiplierBps(
      sanctions.filter((sanction) => sanction.clipperProfileId === profileId),
      { postedAt: post.postedAt, campaignId },
      "daily",
    );
    if (bps < SCORE_MULTIPLIER_NEUTRAL_BPS) result.set(post.id, bps);
  }
  return result;
}

export type MonthlyScoreMultiplierCut = {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
};

type CutRow = {
  applicationId: string;
  views: bigint | null;
  likes: bigint | null;
  comments: bigint | null;
  shares: bigint | null;
  saves: bigint | null;
};

/**
 * Ranking mensal: quanto subtrair das métricas somadas de cada inscrição.
 * Cada métrica de um post com redutor vira floor(m × bps / 10000); escalar
 * todas as métricas do post preserva o ER dele. Só posts de clipadores com
 * alguma sanção SCORE_MULTIPLIER entram na conta.
 *
 * Sem `cutoff` usa as métricas atuais do ClipPost (campanha ativa); com
 * `cutoff`, o último snapshot de ClipPostMetrics até ele (campanha concluída).
 */
export async function loadMonthlyScoreMultiplierCuts(
  db: PrismaClient,
  input: { campaignId: string; cutoff?: Date | null },
): Promise<Map<string, MonthlyScoreMultiplierCut>> {
  // Caso comum: ninguém da campanha tem redutor (a tabela de sanções é pequena).
  const anySanction = await db.clipperSanction.findFirst({
    where: {
      type: "SCORE_MULTIPLIER",
      clipperProfile: {
        applications: { some: { campaignId: input.campaignId } },
      },
    },
    select: { id: true },
  });
  if (!anySanction) return new Map();

  // Mesmo instante de referência do diário e do JS: postedAt (sem data, sem redutor).
  const bps = scoreMultiplierBpsSql(
    'ca."clipperProfileId"',
    'cp."postedAt"',
    'ca."campaignId"',
    "monthly",
  );
  const rows = input.cutoff
    ? await db.$queryRaw<CutRow[]>`
        SELECT
          p."applicationId",
          SUM(m."views" - (m."views"::int8 * p."bps") / 10000)::bigint AS "views",
          SUM(m."likes" - (m."likes"::int8 * p."bps") / 10000)::bigint AS "likes",
          SUM(m."comments" - (m."comments"::int8 * p."bps") / 10000)::bigint AS "comments",
          SUM(m."shares" - (m."shares"::int8 * p."bps") / 10000)::bigint AS "shares",
          SUM(COALESCE(m."saves", 0) - (COALESCE(m."saves", 0)::int8 * p."bps") / 10000)::bigint AS "saves"
        FROM (
          SELECT cp."id", cp."applicationId", ${bps} AS "bps"
          FROM "ClipPost" cp
          JOIN "ClipperApplication" ca ON ca."id" = cp."applicationId"
          WHERE cp."campaignId" = ${input.campaignId}
            AND cp."status" = 'ELIGIBLE'
            AND EXISTS (
              SELECT 1 FROM "ClipperSanction" s0
              WHERE s0."clipperProfileId" = ca."clipperProfileId"
                AND s0."type" = 'SCORE_MULTIPLIER'
            )
          OFFSET 0
        ) p
        CROSS JOIN LATERAL (
          SELECT cpm."views", cpm."likes", cpm."comments", cpm."shares", cpm."saves"
          FROM "ClipPostMetrics" cpm
          WHERE cpm."clipPostId" = p."id"
            AND cpm."collectedAt" <= ${input.cutoff}::timestamp
          ORDER BY cpm."collectedAt" DESC
          LIMIT 1
        ) m
        WHERE p."bps" < 10000
        GROUP BY p."applicationId"
      `
    : await db.$queryRaw<CutRow[]>`
        SELECT
          p."applicationId",
          SUM(p."views" - (p."views"::int8 * p."bps") / 10000)::bigint AS "views",
          SUM(p."likes" - (p."likes"::int8 * p."bps") / 10000)::bigint AS "likes",
          SUM(p."comments" - (p."comments"::int8 * p."bps") / 10000)::bigint AS "comments",
          SUM(p."shares" - (p."shares"::int8 * p."bps") / 10000)::bigint AS "shares",
          SUM(p."saves" - (p."saves"::int8 * p."bps") / 10000)::bigint AS "saves"
        FROM (
          SELECT
            cp."applicationId",
            cp."views", cp."likes", cp."comments", cp."shares",
            COALESCE(cp."saves", 0) AS "saves",
            ${bps} AS "bps"
          FROM "ClipPost" cp
          JOIN "ClipperApplication" ca ON ca."id" = cp."applicationId"
          WHERE cp."campaignId" = ${input.campaignId}
            AND cp."status" = 'ELIGIBLE'
            AND EXISTS (
              SELECT 1 FROM "ClipperSanction" s0
              WHERE s0."clipperProfileId" = ca."clipperProfileId"
                AND s0."type" = 'SCORE_MULTIPLIER'
            )
        ) p
        WHERE p."bps" < 10000
        GROUP BY p."applicationId"
      `;
  return new Map(
    rows.map((row) => [
      row.applicationId,
      {
        views: Number(row.views ?? 0),
        likes: Number(row.likes ?? 0),
        comments: Number(row.comments ?? 0),
        shares: Number(row.shares ?? 0),
        saves: Number(row.saves ?? 0),
      },
    ]),
  );
}
