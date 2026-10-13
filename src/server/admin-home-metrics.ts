import type { Platform, PrismaClient } from "@prisma/client";

import { cachedQuery } from "@/server/memory-cache";

/**
 * Os números da home do admin são agregados de tabelas grandes (ClipPost tem
 * centenas de milhares de linhas) e não precisam ser ao vivo: cada resultado é
 * reaproveitado por 5 minutos, e as consultas do mesmo lote aguardam a mesma
 * leitura.
 */
const ADMIN_HOME_TTL_MS = 5 * 60_000;

export function cachedAdminHomeQuery<T>(
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  return cachedQuery(`admin-home:${key}`, ADMIN_HOME_TTL_MS, load);
}

/** Início da janela de 90 dias do gráfico de crescimento de views. */
export function viewsGrowthStartDate(now = new Date()) {
  const start = new Date(now);
  start.setDate(start.getDate() - 89);
  start.setHours(0, 0, 0, 0);
  return start;
}

export type EligiblePlatformTotals = {
  platform: Platform;
  posts: number;
  /** Inscrições distintas com post elegível na plataforma. */
  applications: number;
  views: number;
  /** Views dos posts criados antes do início do gráfico de crescimento. */
  viewsBefore: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
};

type TotalsRow = {
  platform: Platform;
  posts: number;
  applications: number;
  views: bigint;
  viewsBefore: bigint;
  likes: bigint;
  comments: bigint;
  shares: bigint;
  saves: bigint;
};

/**
 * Totais dos posts elegíveis por plataforma, em uma varredura de ClipPost.
 * O dashboard, o gráfico de crescimento e os dados por plataforma usam os
 * mesmos totais.
 */
export function getEligiblePlatformTotals(
  db: PrismaClient,
  viewsBeforeDate = viewsGrowthStartDate(),
) {
  return cachedAdminHomeQuery(
    `platform-totals:${viewsBeforeDate.getTime()}`,
    async (): Promise<EligiblePlatformTotals[]> => {
      const rows = await db.$queryRaw<TotalsRow[]>`
        SELECT
          platform,
          COUNT(*)::int AS posts,
          COUNT(DISTINCT "applicationId")::int AS applications,
          COALESCE(SUM(views), 0)::bigint AS views,
          COALESCE(SUM(views) FILTER (WHERE "createdAt" < ${viewsBeforeDate}::timestamp), 0)::bigint AS "viewsBefore",
          COALESCE(SUM(likes), 0)::bigint AS likes,
          COALESCE(SUM(comments), 0)::bigint AS comments,
          COALESCE(SUM(shares), 0)::bigint AS shares,
          COALESCE(SUM(saves), 0)::bigint AS saves
        FROM "ClipPost"
        WHERE status = 'ELIGIBLE'
        GROUP BY platform
      `;
      return rows.map((row) => ({
        platform: row.platform,
        posts: row.posts,
        applications: row.applications,
        views: Number(row.views),
        viewsBefore: Number(row.viewsBefore),
        likes: Number(row.likes),
        comments: Number(row.comments),
        shares: Number(row.shares),
        saves: Number(row.saves),
      }));
    },
  );
}
