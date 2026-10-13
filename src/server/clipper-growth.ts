import type { PrismaClient } from "@prisma/client";

import { cachedQuery } from "@/server/memory-cache";

/** Dias do gráfico "Crescimento de Views & Engajamento" (inclui hoje). */
export const CLIPPER_GROWTH_DAYS = 7;

/** As coletas chegam no máximo de hora em hora: 5 min de defasagem não muda o gráfico. */
const CLIPPER_GROWTH_TTL_MS = 5 * 60_000;

export type ClipperGrowthPoint = {
  /** Dia UTC no formato "dd/mm". */
  date: string;
  /** Views somadas dos posts elegíveis do clipador ao fim do dia. */
  views: number;
  /** Likes + comentários + shares somados ao fim do dia. */
  engagement: number;
};

type ClipperGrowthRow = {
  day: Date;
  views: bigint;
  engagement: bigint;
};

/** Meia-noite UTC do primeiro dia do gráfico. */
export function clipperGrowthStart(now = new Date()) {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - (CLIPPER_GROWTH_DAYS - 1));
  return start;
}

/**
 * Total de views e engajamento dos posts elegíveis do clipador ao fim de cada
 * dia UTC dos últimos 7 dias. Cada post entra com a última coleta conhecida
 * até o fim do dia, mesmo que não tenha sido coletado nele: o League não
 * coleta todo post todo dia, e somar só as coletas do dia derrubava a linha.
 *
 * O ponto de partida é a última coleta de cada post antes da janela; dentro
 * dela, a última coleta de cada dia vira diferença para a anterior, e o total
 * de cada dia é o ponto de partida mais as diferenças acumuladas. Dias antes
 * do primeiro post do clipador (total zero) ficam de fora.
 */
export function loadClipperGrowth(
  db: PrismaClient,
  input: { campaignId: string; applicationId: string; now?: Date },
): Promise<ClipperGrowthPoint[]> {
  const start = clipperGrowthStart(input.now);
  const lastDay = new Date(start);
  lastDay.setUTCDate(lastDay.getUTCDate() + CLIPPER_GROWTH_DAYS - 1);

  return cachedQuery(
    `clipper-growth:${input.applicationId}:${start.getTime()}`,
    CLIPPER_GROWTH_TTL_MS,
    async () => {
      const rows = await db.$queryRaw<ClipperGrowthRow[]>`
        WITH posts AS (
          SELECT post.id
          FROM "ClipPost" post
          WHERE post."campaignId" = ${input.campaignId}
            AND post."applicationId" = ${input.applicationId}
            AND post.status = 'ELIGIBLE'
        ),
        post_days AS (
          -- Última coleta antes da janela, como o "dia zero" de cada post
          SELECT
            posts.id AS post_id,
            ${start}::timestamp - INTERVAL '1 day' AS day,
            before_window.views,
            before_window.engagement
          FROM posts
          CROSS JOIN LATERAL (
            SELECT
              metrics.views,
              (metrics.likes::bigint + metrics.comments + metrics.shares) AS engagement
            FROM "ClipPostMetrics" metrics
            WHERE metrics."clipPostId" = posts.id
              AND metrics."collectedAt" < ${start}::timestamp
            ORDER BY metrics."collectedAt" DESC
            LIMIT 1
          ) before_window
          UNION ALL
          -- Última coleta de cada dia da janela
          SELECT posts.id, in_window.day, in_window.views, in_window.engagement
          FROM posts
          CROSS JOIN LATERAL (
            SELECT DISTINCT ON (DATE_TRUNC('day', metrics."collectedAt"))
              DATE_TRUNC('day', metrics."collectedAt") AS day,
              metrics.views,
              (metrics.likes::bigint + metrics.comments + metrics.shares) AS engagement
            FROM "ClipPostMetrics" metrics
            WHERE metrics."clipPostId" = posts.id
              AND metrics."collectedAt" >= ${start}::timestamp
            ORDER BY DATE_TRUNC('day', metrics."collectedAt"), metrics."collectedAt" DESC
          ) in_window
        ),
        deltas AS (
          SELECT
            day,
            views - LAG(views, 1, 0::bigint) OVER per_post AS views,
            engagement - LAG(engagement, 1, 0::bigint) OVER per_post AS engagement
          FROM post_days
          WINDOW per_post AS (PARTITION BY post_id ORDER BY day)
        ),
        daily AS (
          SELECT day, SUM(views) AS views, SUM(engagement) AS engagement
          FROM deltas
          GROUP BY day
        ),
        days AS (
          SELECT GENERATE_SERIES(
            ${start}::timestamp,
            ${lastDay}::timestamp,
            INTERVAL '1 day'
          ) AS day
        )
        SELECT
          days.day,
          (SELECT COALESCE(SUM(daily.views), 0) FROM daily WHERE daily.day <= days.day)::bigint AS views,
          (SELECT COALESCE(SUM(daily.engagement), 0) FROM daily WHERE daily.day <= days.day)::bigint AS engagement
        FROM days
        ORDER BY days.day
      `;

      const points = rows.map((row) => ({
        date: row.day.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          timeZone: "UTC",
        }),
        views: Number(row.views),
        engagement: Number(row.engagement),
      }));
      const firstWithData = points.findIndex(
        (point) => point.views !== 0 || point.engagement !== 0,
      );
      return firstWithData === -1 ? [] : points.slice(firstWithData);
    },
  );
}
