import { createHash } from "node:crypto";
import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { Resend } from "resend";
import {
  ClipPostStatus,
  Platform,
  Prisma,
  RankingMetricType,
  type PrismaClient,
} from "@prisma/client";
import {
  calculateRankingScore,
  calculateEngagementRate,
  type RankingMetricType as RankingMetricTypeForScore,
} from "@/lib/ranking-helpers";
import {
  computeDailyPixPayoutSettledGate,
  computeDailyRankWalletPaidGate,
  getPrizeForPosition,
  getPostedAtWindowUtc,
  getTotalViewsAtRankingCutoff,
  getUtcRankingDayBounds,
  loadDailyRankingDateContext,
  parsePrizeTable,
} from "@/lib/daily-ranking-preview";
import {
  getClipperDailyReferenceDateYmd,
  getLiveDailyWindowByReferenceDate,
  loadDailyRankingEntryMetricsMap,
  pickMetricsForDailyRank,
  rankLiveDailyPosts,
} from "@/lib/daily-ranking-shared";
import { computeMonthlyLeaderboard } from "@/lib/monthly-ranking-leaderboard";
import {
  DailyPayoutConfigError,
  fetchDailyPixReconciliation,
  fetchDailyPayoutPay,
  fetchDailyPayoutPreview,
  fetchTopPostersPayoutPay,
  fetchTopPostersPayoutPreview,
} from "@/lib/daily-payout-client";
import {
  assertCanTriggerManualMetricsExtraction,
  canTriggerManualMetricsExtraction,
} from "@/server/api/utils/manual-metrics-extraction-access";
import { parseSpotifyTrackId } from "@/lib/spotify-track";
import {
  getTopClippersPrize,
  parseTopClippersPrizeTable,
} from "@/lib/top-clippers-ranking";
import { canRejoinCompetition, rankingApplicationWhere } from "@/lib/competition-participation";
import { disconnectGoogleCalendar } from "@/server/google-calendar";
import {
  DEFAULT_REFERENCE_CPM,
  getCampaignPerformance,
} from "@/server/performance/get-campaign-performance";
import { buildOfficialProfileTargets } from "@/server/performance/profile-targets";
import {
  cachedAdminHomeQuery,
  getEligiblePlatformTotals,
  getHomeTickerClips,
  viewsGrowthStartDate,
} from "@/server/admin-home-metrics";
import { cachedQuery } from "@/server/memory-cache";
import { reenrollWithdrawnApplication } from "@/server/competition-reenrollment";
import { buildCompetitionVideoEmail } from "@/lib/emails/competition-video";

function getFirstName(name?: string | null) {
  return name?.trim().split(/\s+/)[0] || "";
}

function getClipperRankingDisplayName(profile: {
  artisticName?: string | null;
  fullName?: string | null;
}) {
  return (
    profile.artisticName?.trim() || getFirstName(profile.fullName) || "Clipador"
  );
}

function assertPrizeTableMatchesTotal(input: {
  label: string;
  table: unknown;
  topCount: number;
  totalPrize: number;
}) {
  const entries = parsePrizeTable(input.table);
  const outOfRange = entries.find(
    (entry) => entry.position > input.topCount && entry.prize > 0,
  );
  if (outOfRange) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${input.label}: a posição ${outOfRange.position} excede o top ${input.topCount}.`,
    });
  }
  const calculatedCents = Array.from({ length: input.topCount }, (_, index) =>
    getPrizeForPosition(entries, index + 1),
  ).reduce((total, value) => total + Math.round(value * 100), 0);
  const configuredCents = Math.round(input.totalPrize * 100);
  if (calculatedCents !== configuredCents) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${input.label}: a soma da tabela deve ser igual ao total configurado.`,
    });
  }
}

function assertPrizeConfiguration(input: {
  dailyTopCount: number;
  dailyTotalPrize: number;
  dailyPrizeTable: unknown;
  monthlyTopCount: number;
  monthlyTotalPrize: number;
  monthlyPrizeTable: unknown;
}) {
  assertPrizeTableMatchesTotal({
    label: "Premiação diária",
    table: input.dailyPrizeTable,
    topCount: input.dailyTopCount,
    totalPrize: input.dailyTotalPrize,
  });
  assertPrizeTableMatchesTotal({
    label: "Premiação mensal",
    table: input.monthlyPrizeTable,
    topCount: input.monthlyTopCount,
    totalPrize: input.monthlyTotalPrize,
  });
}

/**
 * Um crédito de Top Postadores que recebeu o ajuste de estorno deixa de
 * representar uma posição paga. O crédito original é mantido no ledger para
 * auditoria; por isso não basta verificar somente seu status COMPLETED.
 */
async function findUnreversedTopPostersPrize(
  db: Pick<Prisma.TransactionClient, "transaction">,
  input: Pick<Prisma.TransactionFindManyArgs, "where">,
) {
  const candidates = await db.transaction.findMany({
    where: input.where,
    select: { id: true, amount: true, processedAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const reversedIds = await findReversedTopPostersPrizeIds(
    db,
    candidates.map((candidate) => candidate.id),
  );
  return candidates.find((candidate) => !reversedIds.has(candidate.id)) ?? null;
}

/** Créditos de Top Postadores (entre os informados) que já foram estornados. */
async function findReversedTopPostersPrizeIds(
  db: Pick<Prisma.TransactionClient, "transaction">,
  creditIds: string[],
) {
  if (creditIds.length === 0) return new Set<string>();
  const reversals = await db.transaction.findMany({
    where: {
      type: "ADJUSTMENT",
      status: "COMPLETED",
      AND: [
        {
          metadata: {
            path: ["action"],
            equals: "undo_top_posters_daily_rank",
          },
        },
        {
          OR: creditIds.map((creditId) => ({
            metadata: {
              path: ["reversedPrizeCreditId"],
              equals: creditId,
            },
          })),
        },
      ],
    },
    select: { metadata: true },
  });
  const ids = new Set(creditIds);
  const reversedIds = new Set<string>();
  for (const reversal of reversals) {
    const metadata = reversal.metadata as {
      reversedPrizeCreditId?: unknown;
    } | null;
    const creditId = metadata?.reversedPrizeCreditId;
    if (typeof creditId === "string" && ids.has(creditId)) {
      reversedIds.add(creditId);
    }
  }
  return reversedIds;
}

/**
 * findUnreversedTopPostersPrize para várias posições de uma vez: uma consulta
 * para os créditos e outra para os estornos. Cada critério vale só para a sua
 * posição (rankingPosition), então cada crédito encontrado pertence a uma
 * única posição — o resultado é o mesmo de consultar posição por posição.
 */
async function findUnreversedTopPostersPrizesByPosition(
  db: Pick<Prisma.TransactionClient, "transaction">,
  criteria: Array<{ position: number; where: Prisma.TransactionWhereInput }>,
) {
  const prizes = new Map<
    number,
    { id: string; amount: number; processedAt: Date | null; createdAt: Date }
  >();
  if (criteria.length === 0) return prizes;

  const candidates = await db.transaction.findMany({
    where: {
      OR: criteria.map(({ position, where }) => ({
        AND: [where, { rankingPosition: position }],
      })),
    },
    select: {
      id: true,
      amount: true,
      processedAt: true,
      createdAt: true,
      rankingPosition: true,
    },
    orderBy: { createdAt: "desc" },
  });
  const reversedIds = await findReversedTopPostersPrizeIds(
    db,
    candidates.map((candidate) => candidate.id),
  );

  for (const { rankingPosition, ...candidate } of candidates) {
    if (rankingPosition === null || prizes.has(rankingPosition)) continue;
    if (reversedIds.has(candidate.id)) continue;
    prizes.set(rankingPosition, candidate);
  }
  return prizes;
}

function topClippersRankingDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function topClippersPaymentPlanFingerprint(
  rows: Array<{
    rankingEntryId: string;
    position: number;
    clipperProfileId: string;
    amount: number;
    totalPosts: number;
    totalViews: number;
  }>,
) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        rows.map((row) => [
          row.rankingEntryId,
          row.position,
          row.clipperProfileId,
          Math.round(row.amount * 100),
          row.totalPosts,
          row.totalViews,
        ]),
      ),
    )
    .digest("hex");
}

async function getTopClippersSnapshotState(
  db: Prisma.TransactionClient,
  campaignId: string,
  date: string,
) {
  const ranking = await db.topClippersDailyRanking.upsert({
    where: {
      campaignId_rankingDate: {
        campaignId,
        rankingDate: topClippersRankingDate(date),
      },
    },
    create: { campaignId, rankingDate: topClippersRankingDate(date) },
    update: { calculatedAt: new Date() },
    select: {
      id: true,
      entries: {
        where: { isDisqualified: true },
        select: { applicationId: true },
      },
    },
  });
  return {
    rankingId: ranking.id,
    disqualifiedApplicationIds: ranking.entries.map(
      (entry) => entry.applicationId,
    ),
  };
}

async function persistTopClippersEntries(
  db: Prisma.TransactionClient,
  rankingId: string,
  rows: Array<{
    applicationId: string;
    clipperProfileId: string;
    position: number;
    totalPosts: number;
    totalViews: number;
    prizeAmount: number;
  }>,
) {
  const existingEntries = await db.topClippersDailyRankingEntry.findMany({
    where: {
      topClippersDailyRankingId: rankingId,
      applicationId: { in: rows.map((row) => row.applicationId) },
    },
    select: {
      applicationId: true,
      isDisqualified: true,
      prizeStatus: true,
    },
  });
  const existingByApplication = new Map(
    existingEntries.map((entry) => [entry.applicationId, entry]),
  );
  await Promise.all(
    rows.map((row) => {
      const existing = existingByApplication.get(row.applicationId);
      const isFrozen =
        existing?.isDisqualified || existing?.prizeStatus === "PAID";
      return db.topClippersDailyRankingEntry.upsert({
        where: {
          topClippersDailyRankingId_applicationId: {
            topClippersDailyRankingId: rankingId,
            applicationId: row.applicationId,
          },
        },
        create: { topClippersDailyRankingId: rankingId, ...row },
        update: isFrozen
          ? {}
          : {
              clipperProfileId: row.clipperProfileId,
              position: row.position,
              totalPosts: row.totalPosts,
              totalViews: row.totalViews,
              prizeAmount: row.prizeAmount,
            },
      });
    }),
  );
}

// Os totais por campanha mudam devagar e são iguais para todos os admins: a
// lista de competições reaproveita as agregações por 2 minutos.
const CAMPAIGN_TOTALS_TTL_MS = 2 * 60_000;

/** Somas dos posts elegíveis por campanha, em uma única agregação. */
async function getCachedCampaignPostTotals(db: PrismaClient) {
  return cachedQuery("admin:campaign-post-totals", CAMPAIGN_TOTALS_TTL_MS, async () => {
    const rows = await db.clipPost.groupBy({
      by: ["campaignId"],
      where: { status: "ELIGIBLE" },
      _sum: {
        views: true,
        likes: true,
        comments: true,
        shares: true,
        saves: true,
      },
      _count: { id: true },
    });
    return new Map(
      rows.map((row) => [
        row.campaignId,
        { _sum: row._sum, _count: { id: row._count.id } },
      ]),
    );
  });
}

/** Inscrições aprovadas por campanha, em uma única agregação. */
async function getCachedApprovedApplicationCounts(db: PrismaClient) {
  return cachedQuery(
    "admin:campaign-approved-applications",
    CAMPAIGN_TOTALS_TTL_MS,
    async () => {
      const rows = await db.clipperApplication.groupBy({
        by: ["campaignId"],
        where: { status: "APPROVED" },
        _count: { id: true },
      });
      return new Map(rows.map((row) => [row.campaignId, row._count.id]));
    },
  );
}

type SocialAccountPostStats = { totalPosts: number; totalViews: number };

/**
 * Posts elegíveis e views de cada conta social: posts das inscrições do mesmo
 * clipador, na mesma plataforma e com o mesmo username (sem "@" e sem
 * diferenciar maiúsculas). Sem `accountIds`, calcula para todas as contas.
 */
async function loadSocialAccountPostStats(
  db: Pick<PrismaClient, "$queryRaw">,
  accountIds?: string[],
): Promise<Map<string, SocialAccountPostStats>> {
  if (accountIds && accountIds.length === 0) return new Map();
  const rows = await db.$queryRaw<
    Array<{ accountId: string; totalPosts: bigint; totalViews: bigint }>
  >`
    SELECT
      sa2.id as "accountId",
      COUNT(cp2.id)::bigint as "totalPosts",
      COALESCE(SUM(cp2.views), 0)::bigint as "totalViews"
    FROM "SocialAccount" sa2
    JOIN "ClipperApplication" ca2 ON ca2."clipperProfileId" = sa2."clipperProfileId"
    JOIN "ClipPost" cp2 ON cp2."applicationId" = ca2.id
      AND cp2."platform"::text = sa2."platform"::text
      AND LOWER(REPLACE(COALESCE(cp2."username", ''), '@', '')) = LOWER(REPLACE(sa2."username", '@', ''))
      AND cp2."status" = 'ELIGIBLE'
    ${accountIds ? Prisma.sql`WHERE sa2.id = ANY(${accountIds})` : Prisma.empty}
    GROUP BY sa2.id
  `;
  return new Map(
    rows.map((row) => [
      row.accountId,
      {
        totalPosts: Number(row.totalPosts),
        totalViews: Number(row.totalViews),
      },
    ]),
  );
}

/** Estatísticas de todas as contas, para ordenar por views/posts (5 min). */
function getCachedSocialAccountPostStats(db: Pick<PrismaClient, "$queryRaw">) {
  return cachedQuery("admin:social-account-post-stats", 5 * 60_000, () =>
    loadSocialAccountPostStats(db),
  );
}

function isRetryablePrismaTransactionError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const maybePrisma = error as Error & { code?: string };
  if (maybePrisma.code === "P2034" || maybePrisma.code === "P2028") {
    return true;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("transaction already closed") ||
    message.includes("transaction has already been closed") ||
    message.includes("transaction timeout") ||
    message.includes("timed out") ||
    message.includes("write conflict") ||
    message.includes("deadlock")
  );
}

async function withPrismaTransactionRetry<T>(
  operation: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryablePrismaTransactionError(error) || attempt === attempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
  }

  throw lastError;
}

// Inicializar Resend
const resend = new Resend(process.env.RESEND_API_KEY);

const performancePlatformSchema = z.nativeEnum(Platform);
const performanceProfilePlatformSchema = z.enum([
  Platform.INSTAGRAM,
  Platform.TIKTOK,
  Platform.YOUTUBE,
]);

function assertPerformanceUrlMatchesPlatform(
  value: string | null | undefined,
  platform: Platform,
) {
  if (!value) return;
  const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  const allowedDomains: Record<Platform, string[]> = {
    INSTAGRAM: ["instagram.com"],
    TIKTOK: ["tiktok.com"],
    YOUTUBE: ["youtube.com", "youtu.be"],
    FACEBOOK: ["facebook.com", "fb.watch"],
    KWAI: ["kwai.com", "kuaishou.com"],
  };
  if (
    !allowedDomains[platform].some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    )
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `A URL informada não pertence à plataforma ${platform}`,
    });
  }
}

async function notifyCompetitionClippersAboutVideo(input: {
  campaignName: string;
  campaignSlug: string;
  videoTitle: string;
  videoUrl: string;
  recipients: Array<{ email: string; name: string }>;
}) {
  let sent = 0;
  const errors: string[] = [];

  for (let index = 0; index < input.recipients.length; index += 100) {
    const chunk = input.recipients.slice(index, index + 100);
    const { data, error } = await resend.batch.send(
      chunk.map((recipient) => ({
        from: "ClipfyAI <noreply@league.clipfyai.com>",
        to: recipient.email,
        ...buildCompetitionVideoEmail({
          recipientName: recipient.name,
          campaignName: input.campaignName,
          campaignSlug: input.campaignSlug,
          videoTitle: input.videoTitle,
          videoUrl: input.videoUrl,
          appUrl: process.env.NEXT_PUBLIC_APP_URL,
        }),
      })),
    );
    if (error) errors.push(error.message);
    else sent += data?.data.length ?? chunk.length;
  }

  return { sent, error: errors.length > 0 ? errors.join("; ") : null };
}

type CampaignMetricsExtractionStatus = {
  executionId: string;
  campaignId: string;
  status: "DISCOVERING" | "RUNNING" | "COMPLETED" | "FAILED";
  totalCount: number;
  queuedCount: number;
  processedCount: number;
  remainingCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  progressPercent: number;
  triggeredByUserId?: string | null;
  triggeredByUserEmail?: string | null;
  startedAt: string | Date;
  completedAt?: string | Date | null;
  lastProgressAt: string | Date;
  errorMessage?: string | null;
  items?: Array<{
    id: string;
    clipPostId: string | null;
    platform: string | null;
    platformPostId: string | null;
    queueName: string | null;
    queueJobId: string | null;
    status: "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "SKIPPED";
    attemptsMade: number;
    errorMessage: string | null;
    skippedReason: string | null;
    startedAt: string | Date | null;
    completedAt: string | Date | null;
    createdAt: string | Date;
    updatedAt: string | Date;
  }>;
};

async function leagueFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const baseUrl = (
    process.env.LEAGUE_API_URL || "http://localhost:3000"
  ).replace(/\/$/, "");
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  if (process.env.LEAGUE_INTERNAL_API_KEY) {
    headers.set("x-internal-api-key", process.env.LEAGUE_INTERNAL_API_KEY);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const responseMessage =
      typeof data?.message === "string"
        ? data.message
        : typeof data?.message?.message === "string"
          ? data.message.message
          : typeof data?.error === "string"
            ? data.error
            : `Erro ao comunicar com extração de métricas (${response.status})`;

    throw new TRPCError({
      code:
        response.status === 409
          ? "CONFLICT"
          : response.status === 404
            ? "NOT_FOUND"
            : "BAD_REQUEST",
      message: responseMessage,
      cause: data,
    });
  }

  return data as T;
}

/**
 * Quantos clipadores entram no Top Postadores de cada dia: inscrições com post
 * elegível na janela [D-1 20:00, D 20:00) (a mesma de
 * getTopPostersDailyWindowBrt), elegíveis ao ranking no corte do dia (mesma
 * regra de rankingApplicationWhere) e não desclassificadas no ranking do dia.
 * Uma única varredura agrupada por dia, em vez de duas consultas por dia.
 */
async function countTopPostersClippersByDate(
  db: Pick<PrismaClient, "$queryRaw">,
  campaignId: string,
  dates: string[],
): Promise<Map<string, number>> {
  const sortedDates = [...dates].sort();
  const firstWindow = getTopPostersDailyWindowBrt(sortedDates[0]!);
  const lastWindow = getTopPostersDailyWindowBrt(sortedDates.at(-1)!);
  const rows = await db.$queryRaw<Array<{ day: string; clippers: number }>>`
    WITH posts AS (
      SELECT
        cp."applicationId",
        (cp."postedAt" + interval '4 hours')::date AS day
      FROM "ClipPost" cp
      WHERE cp."campaignId" = ${campaignId}
        AND cp.status = 'ELIGIBLE'
        AND cp."postedAt" >= ${firstWindow.startDate}::timestamp
        AND cp."postedAt" < ${lastWindow.endDate}::timestamp
    )
    SELECT to_char(p.day, 'YYYY-MM-DD') AS day, COUNT(DISTINCT p."applicationId")::int AS clippers
    FROM posts p
    JOIN "ClipperApplication" ca ON ca.id = p."applicationId"
    WHERE (
        ca.status = 'APPROVED'
        OR (ca.status = 'WITHDRAWN' AND ca."withdrawnAt" >= p.day + interval '20 hours')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM "TopClippersDailyRankingEntry" e
        JOIN "TopClippersDailyRanking" r ON r.id = e."topClippersDailyRankingId"
        WHERE r."campaignId" = ${campaignId}
          AND r."rankingDate" = p.day::timestamp
          AND e."isDisqualified" = true
          AND e."applicationId" = p."applicationId"
      )
    GROUP BY p.day
  `;
  const clippersByDate = new Map(rows.map((row) => [row.day, row.clippers]));
  return new Map(dates.map((date) => [date, clippersByDate.get(date) ?? 0]));
}

function getTopPostersDailyWindowBrt(dateYmd: string): {
  startDate: Date;
  endDate: Date;
} {
  // Mantém a mesma referência do SQL informado: corte em 20:00 sem offset explícito.
  const endDate = new Date(`${dateYmd}T20:00:00.000Z`);
  const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
  return { startDate, endDate };
}

// Template de email de notificação de pagamento
function getPaymentNotificationEmailTemplate(
  clipperName: string,
  amount: number,
  paymentType: string,
  description: string,
  newBalance: number,
  campaignName?: string,
  position?: number,
  rankingType?: string,
  automaticPix = false,
) {
  const paymentTypeLabel =
    paymentType === "PRIZE_CREDIT"
      ? "Prêmio"
      : paymentType === "BONUS"
        ? "Bônus"
        : "Ajuste";

  const paymentTypeEmoji =
    paymentType === "PRIZE_CREDIT"
      ? "🏆"
      : paymentType === "BONUS"
        ? "⭐"
        : "💰";

  const positionEmoji =
    position === 1
      ? "🥇"
      : position === 2
        ? "🥈"
        : position === 3
          ? "🥉"
          : `${position}º`;
  const rankingLabel =
    rankingType === "daily"
      ? "Diário"
      : rankingType === "monthly"
        ? "Mensal"
        : "";

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pagamento Recebido - ClipfyAI</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #000000; color: #ffffff;">
  <div style="max-width: 600px; margin: 0 auto; background: #000000;">
    
    <!-- Header com Logo -->
    <div style="text-align: center; padding: 32px 24px;">
      <a href="https://www.clipfyai.com" target="_blank" style="text-decoration: none; display: inline-block;">
        <img src="https://framerusercontent.com/images/yDoe24MwEeKgmJpW2aiCrKIxzs.png?scale-down-to=512" 
             alt="Clipfy League" 
             width="250" 
             style="display: block; width: 250px; height: auto; border: 0; margin: 0 auto;" />
      </a>
    </div>

    <!-- Banner Principal -->
    <div style="background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); border: 2px solid #37FF9F; padding: 32px 24px; border-radius: 16px; margin: 0 16px 32px; text-align: center; box-shadow: 0 0 30px rgba(55, 255, 159, 0.2);">
      <div style="font-size: 64px; margin-bottom: 16px;">${paymentTypeEmoji}</div>
      <h1 style="margin: 0; font-size: 36px; font-weight: 900; color: #37FF9F; line-height: 1.2; letter-spacing: -0.5px;">
        PAGAMENTO RECEBIDO!
      </h1>
      <p style="margin: 16px 0 0 0; font-size: 18px; font-weight: 600; color: #14F7FF;">
        ${clipperName}, você recebeu um ${paymentTypeLabel.toLowerCase()}! 🎉
      </p>
      ${
        position && rankingType
          ? `
      <div style="margin-top: 20px; padding: 16px; background: rgba(55, 255, 159, 0.1); border: 1px solid #37FF9F; border-radius: 12px;">
        <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #888888; text-transform: uppercase; letter-spacing: 1px;">
          Posição no Ranking
        </p>
        <p style="margin: 0; font-size: 48px; font-weight: 900; color: #37FF9F; line-height: 1;">
          ${positionEmoji}
        </p>
        <p style="margin: 8px 0 0 0; font-size: 16px; font-weight: 700; color: #14F7FF;">
          Ranking ${rankingLabel}
        </p>
      </div>
      `
          : ""
      }
    </div>

    <!-- Conteúdo Principal -->
    <div style="padding: 0 24px 32px;">
      
      <!-- Detalhes do Pagamento -->
      <div style="background: #111111; border: 2px solid #37FF9F; border-radius: 16px; padding: 32px; margin-bottom: 24px; box-shadow: 0 4px 20px rgba(55, 255, 159, 0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #14F7FF; text-transform: uppercase; letter-spacing: 1px;">
            💸 Valor Creditado
          </p>
          <p style="margin: 0; font-size: 48px; font-weight: 900; color: #37FF9F; line-height: 1.2;">
            ${formatCurrency(amount)}
          </p>
        </div>

        <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, #37FF9F 50%, transparent 100%); margin: 24px 0;"></div>

        <div style="space-y: 16px;">
          <div style="margin-bottom: 16px;">
            <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #888888; text-transform: uppercase; letter-spacing: 1px;">
              Tipo de Pagamento
            </p>
            <p style="margin: 0; font-size: 18px; font-weight: 700; color: #ffffff;">
              ${paymentTypeEmoji} ${paymentTypeLabel}
            </p>
          </div>

          <div style="margin-bottom: 16px;">
            <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #888888; text-transform: uppercase; letter-spacing: 1px;">
              Descrição
            </p>
            <p style="margin: 0; font-size: 16px; font-weight: 600; color: #e0e0e0; line-height: 1.5;">
              ${description}
            </p>
          </div>

          ${
            campaignName
              ? `
          <div style="margin-bottom: 16px;">
            <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #888888; text-transform: uppercase; letter-spacing: 1px;">
              Competição
            </p>
            <p style="margin: 0; font-size: 16px; font-weight: 700; color: #14F7FF;">
              ${campaignName}
            </p>
          </div>
          `
              : ""
          }

          <div>
            <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #888888; text-transform: uppercase; letter-spacing: 1px;">
              Novo Saldo Disponível
            </p>
            <p style="margin: 0; font-size: 24px; font-weight: 900; color: #37FF9F;">
              ${formatCurrency(newBalance)}
            </p>
          </div>
        </div>
      </div>

      <!-- Informações Importantes -->
      <div style="background: rgba(20, 247, 255, 0.1); border: 1px solid #14F7FF; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 700; color: #14F7FF;">
          💡 Como funciona?
        </p>
        <ul style="margin: 0; padding: 0 0 0 20px; list-style-type: none;">
          <li style="margin-bottom: 8px; font-size: 14px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F; font-weight: 700;">✓</span>
            Os fundos foram <strong style="color: #ffffff;">creditados em sua carteira ClipfyAI</strong>
          </li>
          <li style="margin-bottom: 8px; font-size: 14px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F; font-weight: 700;">✓</span>
            Você pode <strong style="color: #ffffff;">acompanhar seu saldo</strong> na plataforma
          </li>
          ${
            automaticPix
              ? `<li style="margin: 0; font-size: 14px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F; font-weight: 700;">✓</span>
            O envio automático para sua chave <strong style="color: #ffffff;">PIX será processado em seguida</strong>; a confirmação aparecerá na plataforma
          </li>`
              : `<li style="margin-bottom: 8px; font-size: 14px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F; font-weight: 700;">✓</span>
            O pagamento será realizado <strong style="color: #ffffff;">via PIX no final da competição</strong>
          </li>
          <li style="margin: 0; font-size: 14px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F; font-weight: 700;">✓</span>
            Você receberá as <strong style="color: #ffffff;">instruções para saque</strong> em breve
          </li>`
          }
        </ul>
      </div>

      <!-- Call to Action -->
      <div style="text-align: center; margin: 32px 0;">
        <p style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #ffffff;">
          🚀 Continue competindo e ganhe ainda mais!
        </p>
        <a href="https://league.clipfyai.com/my-competitions" 
           target="_blank" 
           style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #14F7FF 0%, #37FF9F 100%); color: #000000; text-decoration: none; border-radius: 12px; font-weight: 800; font-size: 16px; box-shadow: 0 4px 20px rgba(20, 247, 255, 0.3); transition: transform 0.2s;">
          ✨ ACESSAR MINHAS COMPETIÇÕES
        </a>
      </div>

      <!-- Dúvidas -->
      <div style="background: #111111; border: 1px solid #333333; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #14F7FF;">
          ❓ Tem dúvidas sobre o pagamento?
        </p>
        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #e0e0e0;">
          Nossa equipe está pronta para te ajudar! Entre em contato através das redes sociais ou pelo suporte na plataforma.
        </p>
      </div>

      <!-- Redes Sociais -->
      <div style="text-align: center; margin: 32px 0 24px;">
        <p style="margin: 0 0 16px 0; font-size: 14px; color: #888888;">
          Siga a Clipfy League nas redes sociais
        </p>
        <a href="https://tiktok.com/@clipfyai.league" target="_blank" style="display: inline-block; margin: 5px; padding: 12px 20px; background: #14F7FF; color: #000000; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
          TikTok
        </a>
        <a href="https://instagram.com/clipfyai.league" target="_blank" style="display: inline-block; margin: 5px; padding: 12px 20px; background: #37FF9F; color: #000000; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
          Instagram
        </a>
      </div>

      <!-- Footer -->
      <div style="text-align: center; padding: 24px 0; border-top: 1px solid #222222;">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #888888;">
          Parabéns pelo seu desempenho! 🎬✨
        </p>
        <p style="margin: 0 0 4px 0; font-size: 14px; color: #888888;">
          <strong style="color: #14F7FF;">ClipfyAI</strong> - Sua plataforma de competições de cortes
        </p>
        <p style="margin: 0; font-size: 12px; color: #666666;">
          <a href="https://league.clipfyai.com/terms-of-use" target="_blank" style="color: #14F7FF; text-decoration: none;">Termos de Uso</a> | 
          <a href="https://league.clipfyai.com/rules" target="_blank" style="color: #14F7FF; text-decoration: none;">Regras</a>
        </p>
      </div>

    </div>
  </div>
</body>
</html>
  `;
}

// Template de email de aprovação de inscrição
function getApplicationApprovalEmailTemplate(
  clipperName: string,
  campaignName: string,
  startDate: Date,
  endDate: Date,
  campaignSlug: string,
) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
  };

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inscrição Aprovada - ${campaignName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #000000; color: #ffffff;">
  <div style="max-width: 600px; margin: 0 auto; background: #000000;">
    
    <!-- Header com Logo -->
    <div style="text-align: center; padding: 32px 24px;">
      <a href="https://www.clipfyai.com" target="_blank" style="text-decoration: none; display: inline-block;">
        <img src="https://framerusercontent.com/images/yDoe24MwEeKgmJpW2aiCrKIxzs.png?scale-down-to=512" 
             alt="Clipfy League" 
             width="250" 
             style="display: block; width: 250px; height: auto; border: 0; margin: 0 auto;" />
      </a>
    </div>

    <!-- Banner Principal -->
    <div style="background: #1a1a1a; border: 2px solid #14F7FF; padding: 32px 24px; border-radius: 16px; margin: 0 16px 32px; text-align: center; box-shadow: 0 0 30px rgba(20, 247, 255, 0.2);">
      <h1 style="margin: 0; font-size: 36px; font-weight: 900; color: #14F7FF; line-height: 1.2; letter-spacing: -0.5px;">
        🎉 PARABÉNS, ${clipperName.toUpperCase()}!
      </h1>
      <p style="margin: 12px 0 20px; font-size: 20px; font-weight: 700; color: #37FF9F;">
        Sua inscrição foi aprovada!
      </p>
      
      <div style="background: #111111; border: 1px solid #37FF9F; border-radius: 12px; padding: 20px; margin-top: 24px;">
        <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #14F7FF; text-transform: uppercase; letter-spacing: 1px;">
          🏆 Competição
        </p>
        <p style="margin: 0; font-size: 24px; font-weight: 900; color: #37FF9F; line-height: 1.3;">
          ${campaignName}
        </p>
      </div>
    </div>

    <!-- Conteúdo Principal -->
    <div style="padding: 0 24px 32px;">
      
      <!-- Informações da Competição -->
      <div style="background: #111111; border: 1px solid #333333; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #14F7FF;">
          📅 Período da Competição
        </h2>
        <p style="margin: 0 0 8px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
          <strong style="color: #37FF9F;">Início:</strong> ${formatDate(startDate)}
        </p>
        <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
          <strong style="color: #37FF9F;">Término:</strong> ${formatDate(endDate)}
        </p>
      </div>

      <!-- Próximos Passos -->
      <div style="background: #111111; border: 1px solid #333333; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #14F7FF;">
          🎯 Próximos Passos
        </h2>
        <ul style="margin: 0; padding: 0 0 0 20px; list-style-type: none;">
          <li style="margin-bottom: 12px; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F;">✓</span>
            <strong style="color: #ffffff;">Acesse a página da competição</strong> para ver regras e prêmios
          </li>
          <li style="margin-bottom: 12px; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F;">✓</span>
            <strong style="color: #ffffff;">Cadastre suas contas de redes sociais</strong>
          </li>
          <li style="margin-bottom: 12px; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F;">✓</span>
            <strong style="color: #ffffff;">Comece a enviar seus posts</strong> e concorra aos prêmios!
          </li>
          <li style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F;">✓</span>
            <strong style="color: #ffffff;">Acompanhe seu ranking</strong> em tempo real
          </li>
        </ul>
      </div>

      <!-- Call to Action Principal -->
      <div style="text-align: center; margin: 32px 0;">
        <p style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #ffffff;">
          🚀 Pronto para começar a competir?
        </p>
        <a href="https://league.clipfyai.com/my-competitions/${campaignSlug}" 
           target="_blank" 
           style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #14F7FF 0%, #37FF9F 100%); color: #000000; text-decoration: none; border-radius: 12px; font-weight: 800; font-size: 16px; box-shadow: 0 4px 20px rgba(20, 247, 255, 0.3); transition: transform 0.2s;">
          ✨ ACESSAR COMPETIÇÃO AGORA
        </a>
      </div>

      <!-- Dica Importante -->
      <div style="background: rgba(20, 247, 255, 0.1); border: 1px solid #14F7FF; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #14F7FF;">
          💡 Dica Importante
        </p>
        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #e0e0e0;">
          Quanto mais cedo você começar a postar, maiores suas chances de ganhar prêmios diários e mensais. Não perca tempo! 🏃‍♂️💨
        </p>
      </div>

      <!-- Redes Sociais -->
      <div style="text-align: center; margin: 32px 0 24px;">
        <p style="margin: 0 0 16px 0; font-size: 14px; color: #888888;">
          Siga a Clipfy League nas redes sociais
        </p>
        <a href="https://tiktok.com/@clipfyai.league" target="_blank" style="display: inline-block; margin: 5px; padding: 12px 20px; background: #14F7FF; color: #000000; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
          TikTok
        </a>
        <a href="https://instagram.com/clipfyai.league" target="_blank" style="display: inline-block; margin: 5px; padding: 12px 20px; background: #37FF9F; color: #000000; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
          Instagram
        </a>
      </div>

      <!-- Footer -->
      <div style="text-align: center; padding: 24px 0; border-top: 1px solid #222222;">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #888888;">
          Boa sorte e boas criações! 🎬✨
        </p>
        <p style="margin: 0 0 4px 0; font-size: 14px; color: #888888;">
          <strong style="color: #14F7FF;">ClipfyAI</strong> - Sua plataforma de competições de cortes
        </p>
        <p style="margin: 0; font-size: 12px; color: #666666;">
          <a href="https://league.clipfyai.com/terms-of-use" target="_blank" style="color: #14F7FF; text-decoration: none;">Termos de Uso</a> | 
          <a href="https://league.clipfyai.com/rules" target="_blank" style="color: #14F7FF; text-decoration: none;">Regras</a>
        </p>
      </div>

    </div>
  </div>
</body>
</html>
  `;
}

/**
 * ADMIN ROUTER - CRUD Completo
 * Acesso exclusivo para Admin Clipfy
 */
export const adminRouter = createTRPCRouter({
  getCompetitionPerformance: adminProcedure
    .input(z.object({ campaignId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const performance = await getCampaignPerformance(
        ctx.db,
        input.campaignId,
      );
      if (!performance) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Competição não encontrada",
        });
      }
      return performance;
    }),

  updateCompetitionPerformanceSettings: adminProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        investedAmount: z
          .number()
          .finite()
          .nonnegative()
          .max(999999999999.99)
          .refine(
            (value) => Math.round(value * 100) / 100 === value,
            "Use no máximo duas casas decimais",
          )
          .nullable(),
        referenceCpm: z.number().finite().nonnegative().nullable(),
        benchmarkSource: z.string().trim().max(200).nullable().optional(),
        benchmarkSourceUrl: z.string().url().nullable().optional(),
        benchmarkDate: z.string().datetime().nullable().optional(),
        notes: z.string().trim().max(3000).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { campaignId, benchmarkDate, ...inputData } = input;
      const data = {
        ...inputData,
        referenceCpm: inputData.referenceCpm ?? DEFAULT_REFERENCE_CPM,
      };
      await ctx.db.campaignPerformanceSettings.upsert({
        where: { campaignId },
        create: {
          campaignId,
          ...data,
          benchmarkDate: benchmarkDate ? new Date(benchmarkDate) : null,
        },
        update: {
          ...data,
          benchmarkDate: benchmarkDate ? new Date(benchmarkDate) : null,
        },
      });
      return getCampaignPerformance(ctx.db, campaignId);
    }),

  createPerformanceProfile: adminProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        platform: performanceProfilePlatformSchema,
        username: z.string().trim().min(1).max(120),
        profileUrl: z.string().url().nullable().optional(),
        label: z.string().trim().max(120).nullable().optional(),
        isActive: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertPerformanceUrlMatchesPlatform(input.profileUrl, input.platform);
      const profile = await ctx.db.campaignPerformanceProfile.create({
        data: {
          ...input,
          username: input.username.replace(/^@+/, ""),
        },
      });
      return { id: profile.id };
    }),

  updatePerformanceProfile: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        platform: performanceProfilePlatformSchema.optional(),
        username: z.string().trim().min(1).max(120).optional(),
        profileUrl: z.string().url().nullable().optional(),
        label: z.string().trim().max(120).nullable().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, username, ...data } = input;
      if (data.profileUrl || data.platform) {
        const current = await ctx.db.campaignPerformanceProfile.findUnique({
          where: { id },
          select: { platform: true, profileUrl: true },
        });
        if (!current) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Perfil não encontrado",
          });
        }
        assertPerformanceUrlMatchesPlatform(
          data.profileUrl === undefined ? current.profileUrl : data.profileUrl,
          data.platform ?? current.platform,
        );
      }
      await ctx.db.campaignPerformanceProfile.update({
        where: { id },
        data: {
          ...data,
          ...(username ? { username: username.replace(/^@+/, "") } : {}),
        },
      });
      return { success: true };
    }),

  deletePerformanceProfile: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.campaignPerformanceProfile.delete({
        where: { id: input.id },
      });
      return { success: true };
    }),

  createPerformanceVideo: adminProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        platform: performancePlatformSchema,
        originalUrl: z.string().url(),
        title: z.string().trim().max(200).nullable().optional(),
        description: z.string().trim().max(3000).nullable().optional(),
        thumbnailUrl: z.string().url().nullable().optional(),
        isActive: z.boolean().default(true),
        notifyClippers: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertPerformanceUrlMatchesPlatform(input.originalUrl, input.platform);
      const campaign = await ctx.db.campaign.findUnique({
        where: { id: input.campaignId },
        select: { name: true, slug: true },
      });
      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Competição não encontrada",
        });
      }

      const video = await ctx.db.campaignPerformanceVideo.create({
        data: input,
      });
      if (!input.notifyClippers) return { id: video.id, notified: 0 };

      const applications = await ctx.db.clipperApplication.findMany({
        where: { campaignId: input.campaignId, status: "APPROVED" },
        select: {
          clipperProfile: {
            select: { fullName: true, user: { select: { email: true } } },
          },
        },
      });
      const uniqueRecipients = new Map<
        string,
        { email: string; name: string }
      >();
      for (const application of applications) {
        const email = application.clipperProfile.user.email
          .trim()
          .toLowerCase();
        if (email) {
          uniqueRecipients.set(email, {
            email,
            name: application.clipperProfile.fullName || "Clipador",
          });
        }
      }

      if (uniqueRecipients.size === 0) {
        await ctx.db.campaignPerformanceVideo.update({
          where: { id: video.id },
          data: {
            notificationSentAt: new Date(),
            notificationRecipientCount: 0,
            notificationLastError: null,
          },
        });
        return { id: video.id, notified: 0 };
      }

      try {
        const notification = await notifyCompetitionClippersAboutVideo({
          campaignName: campaign.name,
          campaignSlug: campaign.slug,
          videoTitle: input.title || "Novo conteúdo",
          videoUrl: input.originalUrl,
          recipients: [...uniqueRecipients.values()],
        });
        await ctx.db.campaignPerformanceVideo.update({
          where: { id: video.id },
          data: {
            notificationSentAt: notification.error ? null : new Date(),
            notificationRecipientCount: notification.sent,
            notificationLastError: notification.error,
          },
        });
        return { id: video.id, notified: notification.sent };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Falha ao enviar notificações";
        await ctx.db.campaignPerformanceVideo.update({
          where: { id: video.id },
          data: { notificationLastError: message },
        });
        return { id: video.id, notified: 0, notificationError: message };
      }
    }),

  updatePerformanceVideo: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        platform: performancePlatformSchema.optional(),
        originalUrl: z.string().url().optional(),
        title: z.string().trim().max(200).nullable().optional(),
        description: z.string().trim().max(3000).nullable().optional(),
        thumbnailUrl: z.string().url().nullable().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      if (data.originalUrl || data.platform) {
        const current = await ctx.db.campaignPerformanceVideo.findUnique({
          where: { id },
          select: { platform: true, originalUrl: true },
        });
        if (!current) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Vídeo não encontrado",
          });
        }
        assertPerformanceUrlMatchesPlatform(
          data.originalUrl ?? current.originalUrl,
          data.platform ?? current.platform,
        );
      }
      await ctx.db.campaignPerformanceVideo.update({ where: { id }, data });
      return { success: true };
    }),

  deletePerformanceVideo: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.campaignPerformanceVideo.delete({ where: { id: input.id } });
      return { success: true };
    }),

  getGoogleCalendarSubscription: adminProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ ctx, input }) => {
      const subscription = await ctx.db.campaignCalendarSubscription.findUnique(
        {
          where: {
            campaignId_userId: {
              campaignId: input.campaignId,
              userId: ctx.userId,
            },
          },
          select: {
            enabled: true,
            lastSyncedAt: true,
            lastError: true,
            connection: { select: { googleEmail: true, revokedAt: true } },
          },
        },
      );
      return {
        connected: Boolean(
          subscription?.enabled && !subscription.connection.revokedAt,
        ),
        googleEmail: subscription?.connection.googleEmail ?? null,
        lastSyncedAt: subscription?.lastSyncedAt ?? null,
        lastError: subscription?.lastError ?? null,
      };
    }),

  disconnectGoogleCalendarSubscription: adminProcedure
    .input(z.object({ campaignId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await disconnectGoogleCalendar({
          userId: ctx.userId,
          campaignId: input.campaignId,
        });
      } catch (error) {
        return {
          disconnected: false,
          cleanupWarning:
            error instanceof Error
              ? error.message
              : "Falha ao desconectar o Google Agenda",
        };
      }
    }),
  canTriggerManualMetricsExtraction: adminProcedure.query(({ ctx }) => {
    return {
      allowed: canTriggerManualMetricsExtraction(ctx.userId),
    };
  }),

  triggerCampaignMetricsExtraction: adminProcedure
    .input(z.object({ campaignId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertCanTriggerManualMetricsExtraction(ctx.userId);

      const campaign = await ctx.db.campaign.findUnique({
        where: { id: input.campaignId },
        select: { id: true },
      });

      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Competição não encontrada",
        });
      }

      const clerkUser = await currentUser();
      const triggeredByUserEmail =
        clerkUser?.emailAddresses?.[0]?.emailAddress ||
        clerkUser?.primaryEmailAddress?.emailAddress;

      const result = await leagueFetch<CampaignMetricsExtractionStatus>(
        `/api/v1/metrics-extractions/campaigns/${input.campaignId}/trigger`,
        {
          method: "POST",
          body: JSON.stringify({
            triggeredByUserId: ctx.userId,
            triggeredByUserEmail,
          }),
        },
      );

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "CREATE",
          entityType: "CampaignMetricsExtractionRun",
          entityId: result.executionId,
          campaignId: input.campaignId,
          metadata: {
            triggeredByUserEmail,
            totalCount: result.totalCount,
            queuedCount: result.queuedCount,
            skippedCount: result.skippedCount,
          },
        },
      });

      return result;
    }),

  getCampaignMetricsExtractionLatest: adminProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ input }) => {
      return leagueFetch<CampaignMetricsExtractionStatus | null>(
        `/api/v1/metrics-extractions/campaigns/${input.campaignId}/latest`,
      );
    }),

  getCampaignMetricsExtractionStatus: adminProcedure
    .input(z.object({ executionId: z.string() }))
    .query(async ({ input }) => {
      return leagueFetch<CampaignMetricsExtractionStatus>(
        `/api/v1/metrics-extractions/${input.executionId}`,
      );
    }),

  triggerPostCommentsExtraction: adminProcedure
    .input(z.object({ postId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const post = await ctx.db.clipPost.findUnique({
        where: { id: input.postId },
        select: { id: true, campaignId: true },
      });
      if (!post) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Post não encontrado",
        });
      }

      const result = await leagueFetch<{
        queued: number;
        skipped: number;
        jobIds: string[];
        reason?: string;
      }>(`/api/v1/comments-extractions/posts/${input.postId}/trigger`, {
        method: "POST",
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "CREATE",
          entityType: "CommentsExtractionJob",
          entityId: result.jobIds[0] || input.postId,
          campaignId: post.campaignId,
          metadata: {
            clipPostId: input.postId,
            queued: result.queued,
            skipped: result.skipped,
            reason: result.reason || null,
          },
        },
      });

      return result;
    }),

  getPostCommentsExtractionJob: adminProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input }) => {
      return leagueFetch<{
        jobId: string;
        clipPostId: string;
        status: "PENDING" | "DELAYED" | "RUNNING" | "COMPLETED" | "FAILED";
        progress: number;
        attemptsMade: number;
        maxAttempts: number;
        failedReason: string | null;
        result: {
          fetched?: number;
          created?: number;
          updated?: number;
          repliesFetched?: number;
          failed?: number;
          skipped?: boolean;
          source?: string;
        } | null;
        platform: string | null;
        platformComments: number;
        storedComments: number;
        latestSyncAt: string | Date | null;
      }>(
        `/api/v1/comments-extractions/jobs/${encodeURIComponent(input.jobId)}`,
      );
    }),

  triggerCampaignCommentsExtraction: adminProcedure
    .input(z.object({ campaignId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.db.campaign.findUnique({
        where: { id: input.campaignId },
        select: { id: true },
      });
      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Competição não encontrada",
        });
      }

      const result = await leagueFetch<{
        campaignId: string;
        eligiblePosts: number;
        queued: number;
        skipped: number;
        jobIds: string[];
        batchId: string | null;
        reason?: string;
      }>(`/api/v1/comments-extractions/campaigns/${input.campaignId}/trigger`, {
        method: "POST",
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "CREATE",
          entityType: "CampaignCommentsExtraction",
          entityId: input.campaignId,
          campaignId: input.campaignId,
          metadata: {
            eligiblePosts: result.eligiblePosts,
            queued: result.queued,
            skipped: result.skipped,
            jobCount: result.jobIds.length,
            batchId: result.batchId,
            reason: result.reason || null,
          },
        },
      });
      return result;
    }),

  getCampaignCommentsExtractionStatus: adminProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ input }) => {
      return leagueFetch<{
        batchId: string;
        totalJobs: number;
        processedJobs: number;
        completedJobs: number;
        failedJobs: number;
        progressPercent: number;
        statusCounts: Record<string, number>;
        totals: {
          fetched: number;
          created: number;
          updated: number;
          repliesFetched: number;
        };
      }>(
        `/api/v1/comments-extractions/campaign-batches/${encodeURIComponent(input.batchId)}`,
      );
    }),

  spotifyMetrics: createTRPCRouter({
    campaigns: adminProcedure
      .input(
        z
          .object({
            spotifyStatus: z
              .enum(["ALL", "ENABLED", "DISABLED"])
              .default("ALL"),
            status: z
              .enum([
                "DRAFT",
                "SCHEDULED",
                "ACTIVE",
                "PAUSED",
                "COMPLETED",
                "ARCHIVED",
              ])
              .optional(),
          })
          .default({}),
      )
      .query(async ({ ctx, input }) => {
        return ctx.db.campaign.findMany({
          where: {
            ...(input.spotifyStatus === "ENABLED"
              ? { spotifyMetricsEnabled: true }
              : {}),
            ...(input.spotifyStatus === "DISABLED"
              ? { spotifyMetricsEnabled: false }
              : {}),
            ...(input.status ? { status: input.status } : {}),
          },
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            spotifyMetricsEnabled: true,
          },
          orderBy: { createdAt: "desc" },
        });
      }),

    setCampaignEnabled: adminProcedure
      .input(z.object({ campaignId: z.string(), enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        return ctx.db.campaign.update({
          where: { id: input.campaignId },
          data: { spotifyMetricsEnabled: input.enabled },
          select: { id: true, spotifyMetricsEnabled: true },
        });
      }),

    listTracks: adminProcedure
      .input(
        z.object({
          campaignId: z.string(),
          range: z.enum(["7d", "30d", "90d", "all"]).default("30d"),
        }),
      )
      .query(async ({ ctx, input }) => {
        const days =
          input.range === "all" ? null : Number(input.range.replace("d", ""));
        const since = days
          ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          : null;
        const tracks = await ctx.db.campaignSpotifyTrack.findMany({
          where: { campaignId: input.campaignId },
          include: { spotifyTrack: true },
          orderBy: { createdAt: "desc" },
        });

        // Métrica mais recente e primeira do período de todas as faixas em uma
        // consulta (antes eram duas por faixa); cada LATERAL é uma busca no
        // índice (spotifyTrackId, collectedAt).
        const trackIds = [...new Set(tracks.map((link) => link.spotifyTrackId))];
        const metricRows =
          trackIds.length > 0
            ? await ctx.db.$queryRaw<
                Array<{
                  spotifyTrackId: string;
                  latestPlayCount: bigint | null;
                  latestCollectedAt: Date | null;
                  firstPlayCount: bigint | null;
                }>
              >`
                SELECT
                  t.id AS "spotifyTrackId",
                  latest."playCount" AS "latestPlayCount",
                  latest."collectedAt" AS "latestCollectedAt",
                  first_in_range."playCount" AS "firstPlayCount"
                FROM unnest(${trackIds}::text[]) AS t(id)
                LEFT JOIN LATERAL (
                  SELECT m."playCount", m."collectedAt"
                  FROM "SpotifyTrackMetric" m
                  WHERE m."spotifyTrackId" = t.id
                  ORDER BY m."collectedAt" DESC
                  LIMIT 1
                ) latest ON true
                LEFT JOIN LATERAL (
                  SELECT m."playCount"
                  FROM "SpotifyTrackMetric" m
                  WHERE m."spotifyTrackId" = t.id
                    ${since ? Prisma.sql`AND m."collectedAt" >= ${since}::timestamp` : Prisma.empty}
                  ORDER BY m."collectedAt" ASC
                  LIMIT 1
                ) first_in_range ON true
              `
            : [];
        const metricsByTrack = new Map(
          metricRows.map((row) => [row.spotifyTrackId, row]),
        );

        return tracks.map((link) => {
          const metrics = metricsByTrack.get(link.spotifyTrackId);
          const latest =
            metrics?.latestPlayCount != null
              ? {
                  playCount: metrics.latestPlayCount,
                  collectedAt: metrics.latestCollectedAt,
                }
              : null;
          const firstInRange =
            metrics?.firstPlayCount != null
              ? { playCount: metrics.firstPlayCount }
              : null;

          return {
            id: link.id,
            isActive: link.isActive,
            createdAt: link.createdAt,
            track: {
              id: link.spotifyTrack.id,
              spotifyTrackId: link.spotifyTrack.spotifyTrackId,
              spotifyUri: link.spotifyTrack.spotifyUri,
              shareUrl: link.spotifyTrack.shareUrl,
              name: link.spotifyTrack.name,
              artists: link.spotifyTrack.artists,
              albumName: link.spotifyTrack.albumName,
              albumImageUrl: link.spotifyTrack.albumImageUrl,
              lastCollectedAt: link.spotifyTrack.lastCollectedAt,
              lastError: link.spotifyTrack.lastError,
              currentPlayCount: latest ? Number(latest.playCount) : null,
              previousPlayCount: firstInRange
                ? Number(firstInRange.playCount)
                : null,
              latestCollectedAt: latest?.collectedAt ?? null,
            },
          };
        });
      }),

    addTrack: adminProcedure
      .input(
        z.object({ campaignId: z.string(), spotifyInput: z.string().min(1) }),
      )
      .mutation(async ({ ctx, input }) => {
        const spotifyExternalId = parseSpotifyTrackId(input.spotifyInput);
        if (!spotifyExternalId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Informe uma URL, URI ou ID válido do Spotify",
          });
        }

        const campaign = await ctx.db.campaign.findUnique({
          where: { id: input.campaignId },
          select: { id: true, status: true, spotifyMetricsEnabled: true },
        });
        if (!campaign)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campanha não encontrada",
          });
        if (!campaign.spotifyMetricsEnabled) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Ative o acompanhamento de plays no Spotify antes de cadastrar músicas",
          });
        }

        const track = await ctx.db.spotifyTrack.upsert({
          where: { spotifyTrackId: spotifyExternalId },
          create: {
            spotifyTrackId: spotifyExternalId,
            spotifyUri: `spotify:track:${spotifyExternalId}`,
            shareUrl: `https://open.spotify.com/track/${spotifyExternalId}`,
          },
          update: {},
        });

        const existing = await ctx.db.campaignSpotifyTrack.findUnique({
          where: {
            campaignId_spotifyTrackId: {
              campaignId: campaign.id,
              spotifyTrackId: track.id,
            },
          },
        });
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Esta música já está vinculada à campanha",
          });
        }

        const link = await ctx.db.campaignSpotifyTrack.create({
          data: { campaignId: campaign.id, spotifyTrackId: track.id },
          select: { id: true, spotifyTrackId: true },
        });

        let refreshQueued = false;
        if (campaign.status === "ACTIVE" && campaign.spotifyMetricsEnabled) {
          try {
            await leagueFetch(
              `/api/v1/spotify-metrics/tracks/${track.id}/refresh`,
              { method: "POST" },
            );
            refreshQueued = true;
          } catch {
            // A configuração permanece salva e o próximo cron tentará a coleta.
          }
        }
        return { ...link, refreshQueued };
      }),

    refreshTrack: adminProcedure
      .input(z.object({ campaignSpotifyTrackId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const link = await ctx.db.campaignSpotifyTrack.findUnique({
          where: { id: input.campaignSpotifyTrackId },
          select: {
            spotifyTrackId: true,
            isActive: true,
            campaign: { select: { status: true, spotifyMetricsEnabled: true } },
          },
        });
        if (!link)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Música não encontrada",
          });
        if (
          !link.isActive ||
          link.campaign.status !== "ACTIVE" ||
          !link.campaign.spotifyMetricsEnabled
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "A coleta manual exige uma música ativa em uma campanha ativa com métricas Spotify habilitadas",
          });
        }

        return leagueFetch<{ runId: string }>(
          `/api/v1/spotify-metrics/tracks/${link.spotifyTrackId}/refresh`,
          { method: "POST" },
        );
      }),

    setTrackActive: adminProcedure
      .input(
        z.object({ campaignSpotifyTrackId: z.string(), isActive: z.boolean() }),
      )
      .mutation(async ({ ctx, input }) => {
        if (input.isActive) {
          const track = await ctx.db.campaignSpotifyTrack.findUnique({
            where: { id: input.campaignSpotifyTrackId },
            select: { campaign: { select: { spotifyMetricsEnabled: true } } },
          });
          if (!track)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Música não encontrada",
            });
          if (!track.campaign.spotifyMetricsEnabled) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Ative o acompanhamento de plays no Spotify antes de ativar esta música",
            });
          }
        }
        return ctx.db.campaignSpotifyTrack.update({
          where: { id: input.campaignSpotifyTrackId },
          data: { isActive: input.isActive },
          select: { id: true, isActive: true },
        });
      }),

    removeTrack: adminProcedure
      .input(z.object({ campaignSpotifyTrackId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.db.campaignSpotifyTrack.delete({
          where: { id: input.campaignSpotifyTrackId },
        });
        return { success: true };
      }),

    evolution: adminProcedure
      .input(
        z.object({
          campaignSpotifyTrackId: z.string(),
          range: z.enum(["7d", "30d", "90d", "all"]).default("30d"),
        }),
      )
      .query(async ({ ctx, input }) => {
        const link = await ctx.db.campaignSpotifyTrack.findUnique({
          where: { id: input.campaignSpotifyTrackId },
          include: { spotifyTrack: true },
        });
        if (!link)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Música não encontrada",
          });

        const days =
          input.range === "all" ? null : Number(input.range.replace("d", ""));
        const since = days
          ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          : undefined;
        const metrics = await ctx.db.spotifyTrackMetric.findMany({
          where: {
            spotifyTrackId: link.spotifyTrackId,
            ...(since ? { collectedAt: { gte: since } } : {}),
          },
          orderBy: { collectedAt: "asc" },
        });
        const first = metrics[0];
        const latest = metrics.at(-1);
        // Última coleta SEM o filtro de range — é o par correto para comparar
        // com `listTracks.track.latestCollectedAt` no client (mesma origem:
        // spotifyTrackMetric.collectedAt). `summary.lastCollectedAt` é do
        // recorte e vira null quando não há snapshots no período.
        const latestOverall = since
          ? await ctx.db.spotifyTrackMetric.findFirst({
              where: { spotifyTrackId: link.spotifyTrackId },
              orderBy: { collectedAt: "desc" },
              select: { collectedAt: true },
            })
          : latest;
        return {
          track: {
            id: link.spotifyTrack.id,
            name: link.spotifyTrack.name,
            artists: link.spotifyTrack.artists,
            albumImageUrl: link.spotifyTrack.albumImageUrl,
            lastCollectedAt: link.spotifyTrack.lastCollectedAt,
            lastError: link.spotifyTrack.lastError,
          },
          points: metrics.map((metric) => ({
            collectedAt: metric.collectedAt,
            playCount: Number(metric.playCount),
          })),
          summary: {
            currentPlayCount: latest ? Number(latest.playCount) : null,
            growthInRange:
              first && latest
                ? Number(latest.playCount - first.playCount)
                : null,
            lastCollectedAt: latest?.collectedAt ?? null,
            latestCollectedAt: latestOverall?.collectedAt ?? null,
          },
        };
      }),

    runs: adminProcedure
      .input(z.object({ campaignId: z.string().optional() }).default({}))
      .query(async ({ ctx, input }) => {
        return ctx.db.spotifyMetricsRun.findMany({
          where: input.campaignId
            ? {
                items: {
                  some: {
                    spotifyTrack: {
                      campaigns: { some: { campaignId: input.campaignId } },
                    },
                  },
                },
              }
            : undefined,
          include: {
            items: {
              include: {
                spotifyTrack: { select: { name: true, spotifyTrackId: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        });
      }),
  }),

  // ============================================================================
  // USUÁRIOS - CRUD
  // ============================================================================

  users: createTRPCRouter({
    // Listar todos os usuários com filtros e paginação
    list: adminProcedure
      .input(
        z.object({
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(100).default(20),
          role: z
            .enum(["ADMIN", "ORGANIZER_ADMIN", "CLIENT", "CLIPPER"])
            .optional(),
          search: z.string().optional(), // Buscar por email ou nome
        }),
      )
      .query(async ({ ctx, input }) => {
        const { page, limit, role, search } = input;
        const skip = (page - 1) * limit;

        const where = {
          ...(role && { role }),
          ...(search && {
            OR: [
              { email: { contains: search, mode: "insensitive" as const } },
              { name: { contains: search, mode: "insensitive" as const } },
            ],
          }),
        };

        const [users, total] = await Promise.all([
          ctx.db.user.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
              organizations: {
                include: {
                  organization: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                    },
                  },
                },
              },
              clipperProfile: {
                select: {
                  id: true,
                  fullName: true,
                  verificationStatus: true,
                },
              },
              _count: {
                select: {
                  createdCampaigns: true,
                  auditLogs: true,
                },
              },
            },
          }),
          ctx.db.user.count({ where }),
        ]);

        return {
          users,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      }),

    // Buscar usuário por ID
    getById: adminProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const user = await ctx.db.user.findUnique({
          where: { id: input.id },
          include: {
            organizations: {
              include: {
                organization: true,
              },
            },
            clipperProfile: true,
            createdCampaigns: {
              take: 5,
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
              },
            },
            _count: {
              select: {
                auditLogs: true,
                notifications: true,
              },
            },
          },
        });

        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        return user;
      }),

    // Criar novo usuário (admin pode criar manualmente)
    create: adminProcedure
      .input(
        z.object({
          id: z.string(), // Clerk ID
          email: z.string().email(),
          name: z.string().optional(),
          role: z.enum(["ADMIN", "ORGANIZER_ADMIN", "CLIENT", "CLIPPER"]),
          imageUrl: z.string().url().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        // Verificar se já existe
        const existing = await ctx.db.user.findUnique({
          where: { id: input.id },
        });

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "User already exists",
          });
        }

        const user = await ctx.db.user.create({
          data: input,
        });

        // Log de auditoria
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.userId,
            action: "CREATE",
            entityType: "User",
            entityId: user.id,
            changes: { created: input },
          },
        });

        return user;
      }),

    // Criar novo admin (cria no Clerk e depois no banco)
    createAdmin: adminProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(8),
          name: z.string().optional(),
          imageUrl: z.string().url().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        // Verificar se já existe um usuário com este email
        const existingEmail = await ctx.db.user.findUnique({
          where: { email: input.email },
        });

        if (existingEmail) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Email already exists",
          });
        }

        // Criar usuário no Clerk
        const clerk = await clerkClient();
        const clerkUser = await clerk.users.createUser({
          emailAddress: [input.email],
          password: input.password,
          ...(input.name && {
            firstName: input.name.split(" ")[0],
            lastName: input.name.split(" ").slice(1).join(" "),
          }),
          publicMetadata: {
            role: "ADMIN",
          },
        });

        // Criar usuário no banco de dados
        const user = await ctx.db.user.create({
          data: {
            id: clerkUser.id,
            email: input.email,
            name: input.name || null,
            imageUrl: input.imageUrl || null,
            role: "ADMIN",
          },
        });

        // Log de auditoria
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.userId,
            action: "CREATE",
            entityType: "User",
            entityId: user.id,
            changes: {
              created: {
                email: input.email,
                name: input.name,
                role: "ADMIN",
              },
            },
          },
        });

        return user;
      }),

    // Atualizar usuário
    update: adminProcedure
      .input(
        z.object({
          id: z.string(),
          data: z.object({
            name: z.string().optional(),
            email: z.string().email().optional(),
            role: z
              .enum(["ADMIN", "ORGANIZER_ADMIN", "CLIENT", "CLIPPER"])
              .optional(),
            imageUrl: z.string().url().optional(),
          }),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const before = await ctx.db.user.findUnique({
          where: { id: input.id },
        });

        if (!before) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        const updated = await ctx.db.user.update({
          where: { id: input.id },
          data: input.data,
        });

        // Log de auditoria
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.userId,
            action: "UPDATE",
            entityType: "User",
            entityId: updated.id,
            changes: {
              before,
              after: updated,
            },
          },
        });

        return updated;
      }),

    // Deletar usuário (apenas ADMIN e ORGANIZER_ADMIN - NÃO permite deletar CLIPPERS)
    delete: adminProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        // Não permitir deletar a si mesmo
        if (input.id === ctx.userId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot delete yourself",
          });
        }

        const user = await ctx.db.user.findUnique({
          where: { id: input.id },
        });

        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        // PROTEÇÃO: Não permitir deletar CLIPPERS ou CLIENTS por esta rota
        if (user.role === "CLIPPER") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Não é permitido deletar clipadores por esta rota",
          });
        }

        if (user.role === "CLIENT") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Use a rota client.delete para deletar clientes",
          });
        }

        await ctx.db.user.delete({
          where: { id: input.id },
        });

        // Log de auditoria
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.userId,
            action: "DELETE",
            entityType: "User",
            entityId: input.id,
            changes: { deleted: user },
          },
        });

        return { success: true };
      }),

    // Estatísticas de usuários
    stats: adminProcedure.query(async ({ ctx }) => {
      const [total, byRole, recentSignups] = await Promise.all([
        ctx.db.user.count(),
        ctx.db.user.groupBy({
          by: ["role"],
          _count: true,
        }),
        ctx.db.user.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Últimos 30 dias
            },
          },
        }),
      ]);

      return {
        total,
        byRole: byRole.reduce(
          (acc, curr) => {
            acc[curr.role] = curr._count;
            return acc;
          },
          {} as Record<string, number>,
        ),
        recentSignups,
      };
    }),
  }),

  // ============================================================================
  // CAMPANHAS - CRUD
  // ============================================================================

  campaigns: createTRPCRouter({
    // Criar campanha
    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          coverImageUrl: z.string().url().optional().nullable(),
          startDate: z.date(),
          endDate: z.date(),
          platforms: z.array(z.string()).min(1),
          requiredHashtags: z.array(z.string()).default([]),
          requiredMentions: z.array(z.string()).default([]),
          prohibitedContent: z.array(z.string()).default([]),
          prizeInfo: z.any().optional(),
          isLeaderboardPublic: z.boolean().default(true),
          requiresApproval: z.boolean().default(true),
          autoApproveCreators: z.boolean().default(false),
          organizationId: z.string().optional(),
          rankingMetricType: z
            .enum(["VIEWS", "VIEWS_X_ENGAGEMENT"])
            .default("VIEWS"),
          // Privacidade - se true, admin inscreve clipadores manualmente
          isPrivate: z.boolean().default(false),
          // Exclusivo PRO - se true, apenas assinantes PRO podem se inscrever
          isProOnly: z.boolean().default(false),
          // Pagamento PIX do rank diário (Asaas, após crédito na carteira)
          dailyPix: z.boolean().default(false),
          // Ranking diário de clipadores por quantidade de vídeos
          topClippersRankingEnabled: z.boolean().default(false),
          topClippersPrizeTable: z.record(z.number().min(0)).default({}),
          // Links de afiliados (opcionais) - URL base sem o ID do clipper
          // Aceita URL válida, string vazia (transformada em null), ou null
          affiliateLinkInstagram: z
            .union([z.string().url(), z.literal(""), z.null()])
            .transform((val) => (val === "" ? null : val))
            .optional(),
          affiliateLinkTiktok: z
            .union([z.string().url(), z.literal(""), z.null()])
            .transform((val) => (val === "" ? null : val))
            .optional(),
          affiliateLinkYoutube: z
            .union([z.string().url(), z.literal(""), z.null()])
            .transform((val) => (val === "" ? null : val))
            .optional(),
          affiliateLinkFacebook: z
            .union([z.string().url(), z.literal(""), z.null()])
            .transform((val) => (val === "" ? null : val))
            .optional(),
          affiliateLinkKwai: z
            .union([z.string().url(), z.literal(""), z.null()])
            .transform((val) => (val === "" ? null : val))
            .optional(),
          // Configuração personalizada de prêmios
          prizeConfig: z
            .object({
              // Diária
              dailyEnabled: z.boolean(),
              dailyTopCount: z.number().int().positive().max(100),
              dailyTotalPrize: z.number().finite().nonnegative(),
              dailyPrizeTable: z.record(z.number().finite().nonnegative()),
              // Bônus
              bonusEnabled: z.boolean(),
              bonusMilestone: z.number().int().positive(),
              bonusAmount: z.number().finite().nonnegative(),
              bonusMonthlyBudgetCap: z.number().finite().nonnegative(),
              // Mensal
              monthlyEnabled: z.boolean(),
              monthlyTopCount: z.number().int().positive().max(100),
              monthlyTotalPrize: z.number().finite().nonnegative(),
              monthlyPrizeTable: z.record(z.number().finite().nonnegative()),
            })
            .optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          if (input.prizeConfig) {
            assertPrizeConfiguration(input.prizeConfig);
          }
          if (
            input.topClippersRankingEnabled &&
            !parseTopClippersPrizeTable(input.topClippersPrizeTable).some(
              (entry) => entry.prize > 0,
            )
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Configure ao menos uma posição com prêmio maior que zero para habilitar o Top Clipadores.",
            });
          }

          // Gerar slug a partir do nome
          const slug = input.name
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Remove acentos
            .replace(/[^a-z0-9]+/g, "-") // Substitui caracteres especiais por hífen
            .replace(/^-+|-+$/g, "") // Remove hífens no início e fim
            .replace(/-+/g, "-"); // Remove hífens duplicados

          // Verificar se slug já existe, se sim, adicionar sufixo
          let uniqueSlug = slug;
          let counter = 1;
          while (
            await ctx.db.campaign.findUnique({ where: { slug: uniqueSlug } })
          ) {
            uniqueSlug = `${slug}-${counter}`;
            counter++;
          }

          // Buscar organização padrão ou criar uma se necessário
          let organizationId = input.organizationId;

          if (!organizationId) {
            // Buscar primeira organização ativa
            const defaultOrg = await ctx.db.organization.findFirst({
              where: { isActive: true },
              select: { id: true },
            });

            if (!defaultOrg) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message:
                  "Nenhuma organização disponível. Crie uma organização primeiro.",
              });
            }

            organizationId = defaultOrg.id;
          }

          // Criar campanha
          const officialMentions = [...new Set(input.requiredMentions)];
          const officialProfileTargets =
            buildOfficialProfileTargets(officialMentions);

          const campaign = await ctx.db.campaign.create({
            data: {
              name: input.name,
              slug: uniqueSlug,
              description: input.description || "",
              coverImageUrl: input.coverImageUrl,
              organizationId,
              creatorId: ctx.userId,
              startDate: input.startDate,
              endDate: input.endDate,
              platforms: input.platforms,
              requiredHashtags: input.requiredHashtags,
              requiredMentions: officialMentions,
              prohibitedContent: input.prohibitedContent,
              prizeInfo: input.prizeInfo,
              isLeaderboardPublic: input.isLeaderboardPublic,
              requiresApproval: input.requiresApproval,
              autoApproveCreators: input.autoApproveCreators,
              rankingMetricType: input.rankingMetricType,
              isPrivate: input.isPrivate,
              isProOnly: input.isProOnly,
              dailyPix: input.dailyPix,
              topClippersRankingEnabled: input.topClippersRankingEnabled,
              topClippersPrizeTable: input.topClippersPrizeTable,
              // Links de afiliados (opcionais)
              affiliateLinkInstagram: input.affiliateLinkInstagram,
              affiliateLinkTiktok: input.affiliateLinkTiktok,
              affiliateLinkYoutube: input.affiliateLinkYoutube,
              affiliateLinkFacebook: input.affiliateLinkFacebook,
              affiliateLinkKwai: input.affiliateLinkKwai,
              status: "DRAFT",
              publishedAt: new Date(),
              performanceSettings: {
                create: { referenceCpm: DEFAULT_REFERENCE_CPM },
              },
              performanceProfiles:
                officialProfileTargets.length > 0
                  ? {
                      create: officialProfileTargets.map((target) => ({
                        ...target,
                        label: `@${target.username}`,
                        isActive: true,
                      })),
                    }
                  : undefined,
            },
          });

          // Usar configuração personalizada ou valores padrão
          const config = input.prizeConfig || {
            dailyEnabled: true,
            dailyTopCount: 15,
            dailyTotalPrize: 1000,
            dailyPrizeTable: {
              "1": 350,
              "2": 200,
              "3": 150,
              "4-15": 25,
            },
            bonusEnabled: true,
            bonusMilestone: 1000000,
            bonusAmount: 100,
            bonusMonthlyBudgetCap: 6000,
            monthlyEnabled: true,
            monthlyTopCount: 10,
            monthlyTotalPrize: 20000,
            monthlyPrizeTable: {
              "1": 7000,
              "2": 4000,
              "3": 3000,
              "4": 2000,
              "5": 1000,
              "6": 800,
              "7": 700,
              "8": 600,
              "9": 500,
              "10": 400,
            },
          };

          // Criar regra de ranking (100% views)
          const rankingRule = await ctx.db.rankingRule.create({
            data: {
              campaignId: campaign.id,
              label: "V1",
              description:
                `Premiação 100% baseada em views - ${config.dailyEnabled ? `Diária R$ ${((config.dailyTotalPrize * 30) / 1000).toFixed(0)}k` : ""} ${config.monthlyEnabled ? `+ Mensal R$ ${(config.monthlyTotalPrize / 1000).toFixed(0)}k` : ""}`.trim(),
              version: 1,
              isActive: true,

              // Premiação Diária
              dailyEnabled: config.dailyEnabled,
              dailyTopCount: config.dailyTopCount,
              dailyTotalPrize: config.dailyTotalPrize,
              dailyTotalMonthBudget: config.dailyTotalPrize * 30,
              dailyPrizeTable: config.dailyPrizeTable,
              dailyWindowStart: "00:00",
              dailyWindowEnd: "23:59",
              dailyTimezone: "America/Sao_Paulo",
              dailyTiebreakerRules: ["views_6h", "views_12h", "posted_earlier"],

              // Bônus por Marco de Views
              bonusEnabled: config.bonusEnabled,
              bonusMilestone: config.bonusMilestone,
              bonusAmount: config.bonusAmount,
              bonusDeductFromDaily: false,
              bonusMonthlyBudgetCap: config.bonusMonthlyBudgetCap,

              // Premiação Mensal
              monthlyEnabled: config.monthlyEnabled,
              monthlyTopCount: config.monthlyTopCount,
              monthlyTotalPrize: config.monthlyTotalPrize,
              monthlyPrizeTable: config.monthlyPrizeTable,
              monthlyTiebreakerRules: [
                "videos_100k",
                "videos_500k",
                "peak_views",
                "first_post",
              ],
              monthlyThreshold100k: 100000,
              monthlyThreshold500k: 500000,

              // Configurações Gerais
              primaryMetric: "VIEWS",
              eligiblePlatforms: [
                "INSTAGRAM",
                "TIKTOK",
                "YOUTUBE",
                "FACEBOOK",
                "KWAI",
              ],
              countBestPlatformOnly: true,
              notes:
                `${config.dailyEnabled ? `Premiação diária: Top ${config.dailyTopCount} vídeos do dia` : ""} ${config.monthlyEnabled ? `| Premiação mensal: Top ${config.monthlyTopCount} clippers do mês` : ""} ${config.bonusEnabled ? `| Bônus: +R$ ${config.bonusAmount} por vídeo com ${(config.bonusMilestone / 1000000).toFixed(1)}M+ views` : ""}`.trim(),
            },
          });

          // Atualizar campanha com a regra de ranking ativa
          await ctx.db.campaign.update({
            where: { id: campaign.id },
            data: { activeRankingRuleId: rankingRule.id },
          });

          // Criar MonthlyRanking para cada mês da competição
          const startDate = new Date(input.startDate);
          const endDate = new Date(input.endDate);

          // Lista de meses que a competição abrange
          const monthsToCreate: { period: string; start: Date; end: Date }[] =
            [];

          const currentDate = new Date(
            startDate.getFullYear(),
            startDate.getMonth(),
            1,
          );
          const campaignEndDate = new Date(
            endDate.getFullYear(),
            endDate.getMonth(),
            1,
          );

          while (currentDate <= campaignEndDate) {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();

            // Formato: "2025-01", "2025-02", etc.
            const monthPeriod = `${year}-${String(month + 1).padStart(2, "0")}`;

            // windowStart: primeiro dia do mês OU data de início da campanha (se for no meio do mês)
            const windowStart = new Date(year, month, 1);
            if (
              currentDate.getTime() ===
                new Date(
                  startDate.getFullYear(),
                  startDate.getMonth(),
                  1,
                ).getTime() &&
              startDate.getDate() > 1
            ) {
              windowStart.setDate(startDate.getDate());
            }

            // windowEnd: último dia do mês OU data de fim da campanha (se for no meio do mês)
            const windowEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
            if (
              currentDate.getTime() === campaignEndDate.getTime() &&
              endDate.getDate() < windowEnd.getDate()
            ) {
              windowEnd.setDate(endDate.getDate());
              windowEnd.setHours(23, 59, 59, 999);
            }

            monthsToCreate.push({
              period: monthPeriod,
              start: windowStart,
              end: windowEnd,
            });

            // Avançar para o próximo mês
            currentDate.setMonth(currentDate.getMonth() + 1);
          }

          // Criar MonthlyRanking para cada mês
          await Promise.all(
            monthsToCreate.map((monthData) =>
              ctx.db.monthlyRanking.create({
                data: {
                  campaignId: campaign.id,
                  rankingRuleId: rankingRule.id,
                  monthPeriod: monthData.period,
                  windowStart: monthData.start,
                  windowEnd: monthData.end,
                  totalParticipants: 0,
                  totalPosts: 0,
                  totalViews: 0,
                  averageViews: 0,
                },
              }),
            ),
          );

          console.log(
            `✅ Criados ${monthsToCreate.length} MonthlyRanking(s) para a campanha ${campaign.name}`,
          );

          // Log de auditoria
          await ctx.db.auditLog.create({
            data: {
              userId: ctx.userId,
              action: "CREATE",
              entityType: "Campaign",
              entityId: campaign.id,
              campaignId: campaign.id,
              changes: { created: input },
            },
          });

          return campaign;
        } catch (error: any) {
          console.error("Erro ao criar campanha:", error);
          if (error instanceof TRPCError) {
            throw error;
          }
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "Erro ao criar campanha",
          });
        }
      }),

    // Atualizar campanha
    update: adminProcedure
      .input(
        z.object({
          id: z.string(),
          data: z.object({
            name: z.string().min(1).optional(),
            description: z.string().optional(),
            status: z
              .enum([
                "DRAFT",
                "SCHEDULED",
                "ACTIVE",
                "PAUSED",
                "COMPLETED",
                "ARCHIVED",
              ])
              .optional(),
            startDate: z.date().optional(),
            endDate: z.date().optional(),
            platforms: z.array(z.string()).optional(),
            requiredHashtags: z.array(z.string()).optional(),
            requiredMentions: z.array(z.string()).optional(),
            prohibitedContent: z.array(z.string()).optional(),
            isLeaderboardPublic: z.boolean().optional(),
            requiresApproval: z.boolean().optional(),
            autoApproveCreators: z.boolean().optional(),
            isPrivate: z.boolean().optional(),
            isProOnly: z.boolean().optional(),
            dailyPix: z.boolean().optional(),
            topClippersRankingEnabled: z.boolean().optional(),
            topClippersPrizeTable: z.record(z.number().min(0)).optional(),
            coverImageUrl: z.string().url().nullable().optional(),
            prizeInfo: z.any().optional(),
            rankingMetricType: z
              .enum(["VIEWS", "VIEWS_X_ENGAGEMENT"])
              .optional(),
            // Links de afiliados (opcionais) - URL base sem o ID do clipper
            // Aceita URL válida, string vazia (transformada em null), ou null
            affiliateLinkInstagram: z
              .union([z.string().url(), z.literal(""), z.null()])
              .transform((val) => (val === "" ? null : val))
              .optional(),
            affiliateLinkTiktok: z
              .union([z.string().url(), z.literal(""), z.null()])
              .transform((val) => (val === "" ? null : val))
              .optional(),
            affiliateLinkYoutube: z
              .union([z.string().url(), z.literal(""), z.null()])
              .transform((val) => (val === "" ? null : val))
              .optional(),
            affiliateLinkFacebook: z
              .union([z.string().url(), z.literal(""), z.null()])
              .transform((val) => (val === "" ? null : val))
              .optional(),
            affiliateLinkKwai: z
              .union([z.string().url(), z.literal(""), z.null()])
              .transform((val) => (val === "" ? null : val))
              .optional(),
          }),
          // Configuração de prêmios (opcional - para atualizar RankingRule)
          prizeConfig: z
            .object({
              dailyEnabled: z.boolean().optional(),
              dailyTopCount: z.number().int().positive().max(100).optional(),
              dailyTotalPrize: z.number().finite().nonnegative().optional(),
              dailyPrizeTable: z
                .record(z.number().finite().nonnegative())
                .optional(),
              bonusEnabled: z.boolean().optional(),
              bonusMilestone: z.number().int().positive().optional(),
              bonusAmount: z.number().finite().nonnegative().optional(),
              bonusMonthlyBudgetCap: z
                .number()
                .finite()
                .nonnegative()
                .optional(),
              monthlyEnabled: z.boolean().optional(),
              monthlyTopCount: z.number().int().positive().max(100).optional(),
              monthlyTotalPrize: z.number().finite().nonnegative().optional(),
              monthlyPrizeTable: z
                .record(z.number().finite().nonnegative())
                .optional(),
            })
            .optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const before = await ctx.db.campaign.findUnique({
          where: { id: input.id },
          include: { activeRankingRule: true },
        });

        if (!before) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campaign not found",
          });
        }

        if (input.prizeConfig && before.activeRankingRule) {
          assertPrizeConfiguration({
            dailyTopCount:
              input.prizeConfig.dailyTopCount ??
              before.activeRankingRule.dailyTopCount,
            dailyTotalPrize:
              input.prizeConfig.dailyTotalPrize ??
              before.activeRankingRule.dailyTotalPrize,
            dailyPrizeTable:
              input.prizeConfig.dailyPrizeTable ??
              before.activeRankingRule.dailyPrizeTable,
            monthlyTopCount:
              input.prizeConfig.monthlyTopCount ??
              before.activeRankingRule.monthlyTopCount,
            monthlyTotalPrize:
              input.prizeConfig.monthlyTotalPrize ??
              before.activeRankingRule.monthlyTotalPrize,
            monthlyPrizeTable:
              input.prizeConfig.monthlyPrizeTable ??
              before.activeRankingRule.monthlyPrizeTable,
          });
        }

        const nextTopClippersEnabled =
          input.data.topClippersRankingEnabled ??
          before.topClippersRankingEnabled;
        const nextTopClippersPrizeTable =
          input.data.topClippersPrizeTable ?? before.topClippersPrizeTable;
        if (
          nextTopClippersEnabled &&
          !parseTopClippersPrizeTable(nextTopClippersPrizeTable).some(
            (entry) => entry.prize > 0,
          )
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Configure ao menos uma posição com prêmio maior que zero para habilitar o Top Clipadores.",
          });
        }

        // Atualizar campanha
        const updated = await ctx.db.campaign.update({
          where: { id: input.id },
          data: input.data,
        });

        // Atualizar RankingRule se prizeConfig foi enviado
        if (input.prizeConfig && before.activeRankingRuleId) {
          await ctx.db.rankingRule.update({
            where: { id: before.activeRankingRuleId },
            data: {
              dailyEnabled: input.prizeConfig.dailyEnabled,
              dailyTopCount: input.prizeConfig.dailyTopCount,
              dailyTotalPrize: input.prizeConfig.dailyTotalPrize,
              dailyPrizeTable: input.prizeConfig.dailyPrizeTable,
              bonusEnabled: input.prizeConfig.bonusEnabled,
              bonusMilestone: input.prizeConfig.bonusMilestone,
              bonusAmount: input.prizeConfig.bonusAmount,
              bonusMonthlyBudgetCap: input.prizeConfig.bonusMonthlyBudgetCap,
              monthlyEnabled: input.prizeConfig.monthlyEnabled,
              monthlyTopCount: input.prizeConfig.monthlyTopCount,
              monthlyTotalPrize: input.prizeConfig.monthlyTotalPrize,
              monthlyPrizeTable: input.prizeConfig.monthlyPrizeTable,
            },
          });
        }

        // Log de auditoria
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.userId,
            action: "UPDATE",
            entityType: "Campaign",
            entityId: updated.id,
            campaignId: updated.id,
            changes: { before, after: updated },
          },
        });

        return updated;
      }),

    // Deletar campanha
    delete: adminProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const campaign = await ctx.db.campaign.findUnique({
          where: { id: input.id },
          include: {
            calendarSubscriptions: { include: { connection: true } },
          },
        });

        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campaign not found",
          });
        }

        // Apenas permitir deletar se não estiver ativa
        if (campaign.status === "ACTIVE") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot delete active campaign",
          });
        }

        const { calendarSubscriptions, ...deletedCampaign } = campaign;
        await Promise.allSettled(
          calendarSubscriptions.map((subscription) =>
            disconnectGoogleCalendar({
              userId: subscription.userId,
              campaignId: campaign.id,
            }),
          ),
        );

        await ctx.db.campaign.delete({
          where: { id: input.id },
        });

        // Log de auditoria
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.userId,
            action: "DELETE",
            entityType: "Campaign",
            entityId: input.id,
            changes: { deleted: deletedCampaign },
          },
        });

        return { success: true };
      }),
  }),

  // ============================================================================
  // DASHBOARD - Visão Geral do Sistema
  // ============================================================================

  dashboard: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      platformTotals,
      totalUsers,
      totalOrganizations,
      totalCampaigns,
      activeCampaigns,
      totalClipPosts,
      totalClippers,
      activeClippers,
      recentUsers,
      criticalFlags,
      pendingFrauds,
      systemHealth,
      newClippersThisMonth,
      newCampaignsThisMonth,
    ] = await Promise.all([
      // Totais dos posts elegíveis (views, curtidas...), compartilhados com o
      // gráfico de crescimento e os dados por plataforma.
      getEligiblePlatformTotals(ctx.db),
      ctx.db.user.count(),
      ctx.db.organization.count(),
      ctx.db.campaign.count(),
      ctx.db.campaign.count({ where: { status: "ACTIVE" } }),
      ctx.db.clipPost.count(),
      ctx.db.clipperProfile.count(),
      ctx.db.clipperProfile.count({
        where: { verificationStatus: "VERIFIED" },
      }),
      ctx.db.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      ctx.db.fraudFlag.count({
        where: {
          status: "OPEN",
          severity: { in: ["HIGH", "CRITICAL"] },
        },
      }),
      ctx.db.fraudFlag.count({
        where: { status: { in: ["OPEN", "UNDER_REVIEW"] } },
      }),
      // Health check de jobs
      ctx.db.job.groupBy({
        by: ["status"],
        _count: true,
      }),
      // Crescimento de clippers e campanhas (novos no último mês)
      ctx.db.clipperProfile.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      ctx.db.campaign.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    const sumTotals = (field: "views" | "likes" | "comments" | "shares" | "saves") =>
      platformTotals.reduce((total, platform) => total + platform[field], 0);
    const totalViews = sumTotals("views");
    const totalLikes = sumTotals("likes");
    const engagementRate = calculateEngagementRate(
      totalViews,
      totalLikes,
      sumTotals("comments"),
      sumTotals("shares"),
      sumTotals("saves"),
    );

    return {
      overview: {
        totalUsers,
        totalOrganizations,
        totalCampaigns,
        activeCampaigns,
        totalClipPosts,
        totalClippers,
        activeClippers,
        recentUsers,
        criticalFlags,
        pendingFrauds,
        totalViews,
        totalLikes,
        engagementRate,
        newClippersThisMonth,
        newCampaignsThisMonth,
      },
      systemHealth: systemHealth.reduce(
        (acc, curr) => {
          acc[curr.status] = curr._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }),

  getViewsByPlatformGrowth: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const startDate = viewsGrowthStartDate(now);

    // Views somadas no banco por dia (UTC) e plataforma: no máximo 90 × 5
    // linhas, em vez de todos os posts dos últimos 90 dias.
    const [dailyViews, platformTotals] = await Promise.all([
      cachedAdminHomeQuery(`views-growth:${startDate.getTime()}`, () =>
        ctx.db.$queryRaw<Array<{ day: string; platform: string; views: bigint }>>`
        SELECT
          to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day,
          platform::text AS platform,
          COALESCE(SUM(views), 0)::bigint AS views
        FROM "ClipPost"
        WHERE status = 'ELIGIBLE' AND "createdAt" >= ${startDate}::timestamp
        GROUP BY 1, 2
      `),
      getEligiblePlatformTotals(ctx.db, startDate),
    ]);

    const platforms = platformTotals.map((p) => p.platform).sort();

    const beforeMap: Record<string, number> = {};
    let totalBefore = 0;
    for (const totals of platformTotals) {
      beforeMap[totals.platform] = totals.viewsBefore;
      totalBefore += totals.viewsBefore;
    }

    const dayMap = new Map<string, Record<string, number>>();
    for (let i = 89; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const row: Record<string, number> = { total: 0 };
      platforms.forEach((p) => (row[p] = 0));
      dayMap.set(key, row);
    }

    for (const daily of dailyViews) {
      const row = dayMap.get(daily.day);
      if (!row) continue;
      const views = Number(daily.views);
      row.total = (row.total || 0) + views;
      row[daily.platform] = (row[daily.platform] || 0) + views;
    }

    const cumTotals: Record<string, number> = {};
    platforms.forEach((p) => (cumTotals[p] = beforeMap[p] || 0));
    let cumTotal = totalBefore;

    const result = Array.from(dayMap.entries()).map(([date, row]) => {
      cumTotal += row.total || 0;
      const entry: Record<string, number | string> = { total: cumTotal };
      for (const p of platforms) {
        cumTotals[p] = (cumTotals[p] || 0) + (row[p] || 0);
        entry[p] = cumTotals[p]!;
      }
      return { date, ...entry };
    });

    return { data: result, platforms };
  }),

  // Dados por plataforma
  getPlatformData: adminProcedure.query(async ({ ctx }) => {
    // Clipadores = inscrições distintas com post elegível na plataforma.
    const platformTotals = await getEligiblePlatformTotals(ctx.db);
    return platformTotals.map((p) => ({
      platform: p.platform,
      posts: p.posts,
      clippers: p.applications,
      views: p.views,
      totalInteractions: p.likes + p.comments + p.shares + p.saves,
      engagementRate: calculateEngagementRate(
        p.views,
        p.likes,
        p.comments,
        p.shares,
        p.saves,
      ),
    }));
  }),

  // Top Campanhas
  getTopCampaigns: adminProcedure.query(({ ctx }) =>
    cachedAdminHomeQuery("top-campaigns", async () => {
    const campaigns = await ctx.db.campaign.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, slug: true },
    });
    if (campaigns.length === 0) return [];

    const postStats = await ctx.db.clipPost.groupBy({
      by: ["campaignId"],
      where: {
        campaignId: { in: campaigns.map((campaign) => campaign.id) },
        status: "ELIGIBLE",
      },
      _sum: { views: true },
      _count: { id: true },
    });
    const statsByCampaign = new Map(
      postStats.map((stats) => [stats.campaignId, stats]),
    );

    return campaigns
      .map((campaign) => {
        const stats = statsByCampaign.get(campaign.id);
        const views = Number(stats?._sum.views ?? 0);
        return {
          ...campaign,
          views,
          posts: stats?._count.id ?? 0,
          viewsFormatted:
            views >= 1000000
              ? `${(views / 1000000).toFixed(1)}M`
              : views >= 1000
                ? `${(views / 1000).toFixed(1)}K`
                : views.toString(),
        };
      })
      .sort((left, right) => right.views - left.views)
      .slice(0, 3);
    }),
  ),

  // Top Clippers
  // Ticker do hero da home: top vídeos das competições ativas, já intercalados
  getHomeTickerClips: adminProcedure.query(({ ctx }) =>
    getHomeTickerClips(ctx.db),
  ),

  getTopClippers: adminProcedure.query(({ ctx }) =>
    cachedAdminHomeQuery("top-clippers", async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Soma e ordena no banco: devolve só os 5 primeiros, em vez de trazer
    // todos os posts elegíveis dos últimos 30 dias.
    const ranked = await ctx.db.$queryRaw<
      Array<{
        clipperProfileId: string;
        views: bigint;
        likes: bigint;
        comments: bigint;
        shares: bigint;
        saves: bigint;
        posts: number;
      }>
    >`
      SELECT
        a."clipperProfileId",
        COALESCE(SUM(p.views), 0)::bigint AS views,
        COALESCE(SUM(p.likes), 0)::bigint AS likes,
        COALESCE(SUM(p.comments), 0)::bigint AS comments,
        COALESCE(SUM(p.shares), 0)::bigint AS shares,
        COALESCE(SUM(p.saves), 0)::bigint AS saves,
        COUNT(*)::int AS posts
      FROM "ClipPost" p
      INNER JOIN "ClipperApplication" a ON a.id = p."applicationId"
      WHERE p.status = 'ELIGIBLE' AND p."createdAt" >= ${thirtyDaysAgo}::timestamp
      GROUP BY a."clipperProfileId"
      ORDER BY views DESC, a."clipperProfileId"
      LIMIT 5
    `;
    const sorted = ranked.map(
      (row) =>
        [
          row.clipperProfileId,
          {
            views: Number(row.views),
            likes: Number(row.likes),
            comments: Number(row.comments),
            shares: Number(row.shares),
            saves: Number(row.saves),
            posts: row.posts,
          },
        ] as const,
    );

    const topClippers = await Promise.all(
      sorted.map(async ([profileId, stats]) => {
        const profile = await ctx.db.clipperProfile.findUnique({
          where: { id: profileId },
          include: {
            user: { select: { name: true, imageUrl: true } },
            clan: { select: { tag: true, emoji: true, emojiColor: true } },
            socialAccounts: { where: { isPrimary: true }, take: 1 },
          },
        });

        if (!profile) return null;

        const engagementRate = calculateEngagementRate(
          stats.views,
          stats.likes,
          stats.comments,
          stats.shares,
          stats.saves,
        );

        const username =
          profile.socialAccounts[0]?.username ||
          profile.instagramUsernames[0] ||
          "@clipper";

        const artisticName = profile.artisticName || username;

        return {
          name: profile.user?.name || profile.fullName,
          artisticName,
          username,
          imageUrl: profile.user?.imageUrl || null,
          views: stats.views,
          viewsFormatted:
            stats.views >= 1000000
              ? `${(stats.views / 1000000).toFixed(1)}M`
              : stats.views >= 1000
                ? `${(stats.views / 1000).toFixed(0)}K`
                : stats.views.toString(),
          posts: stats.posts,
          engagementRate: `${engagementRate.toFixed(1)}%`,
          clanTag: profile.clan?.tag || null,
          clanEmoji: profile.clan?.emoji || null,
          clanEmojiColor: profile.clan?.emojiColor || null,
        };
      }),
    );

    return topClippers.filter(Boolean);
    }),
  ),

  // Buscar todas as campanhas com estatísticas
  getAllCampaignsWithStats: adminProcedure.query(async ({ ctx }) => {
    try {
      // Buscar todas as campanhas
      const campaigns = await ctx.db.campaign.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          description: true,
          startDate: true,
          endDate: true,
          platforms: true,
          requiredHashtags: true,
          requiredMentions: true,
          prizeInfo: true,
          isLeaderboardPublic: true,
          isPrivate: true,
          coverImageUrl: true,
          spotifyMetricsEnabled: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Totais de todas as campanhas em duas agregações (cache curto)
      const [postTotals, approvedCounts] = await Promise.all([
        getCachedCampaignPostTotals(ctx.db),
        getCachedApprovedApplicationCounts(ctx.db),
      ]);

      const campaignsWithStats = campaigns.map((campaign) => {
        // Estatísticas de posts elegíveis
        const postsStats = postTotals.get(campaign.id) ?? {
          _sum: {
            views: null,
            likes: null,
            comments: null,
            shares: null,
            saves: null,
          },
          _count: { id: 0 },
        };

        // Clippers ativos (aprovados)
        const activeClippers = approvedCounts.get(campaign.id) ?? 0;

        const totalViews = Number(postsStats._sum.views || 0);
        const totalLikes = postsStats._sum.likes || 0;
        const totalComments = postsStats._sum.comments || 0;
        const totalShares = postsStats._sum.shares || 0;
        const totalSaves = postsStats._sum.saves || 0;
        const totalPosts = postsStats._count.id;

        const engagementRate = calculateEngagementRate(
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
          totalSaves,
        );

        // Formatar prêmio
        const prize =
          campaign.prizeInfo &&
          typeof campaign.prizeInfo === "object" &&
          "total" in campaign.prizeInfo
            ? typeof campaign.prizeInfo.total === "object"
              ? "R$ 0"
              : String(campaign.prizeInfo.total)
            : "R$ 0";

        return {
          id: campaign.id,
          name: campaign.name,
          slug: campaign.slug,
          status: campaign.status,
          description: campaign.description,
          coverImageUrl: campaign.coverImageUrl,
          startDate: campaign.startDate.toISOString(),
          endDate: campaign.endDate.toISOString(),
          platforms: campaign.platforms,
          requiredHashtags: campaign.requiredHashtags,
          prize,
          isLeaderboardPublic: campaign.isLeaderboardPublic,
          isPrivate: campaign.isPrivate,
          totalViews,
          totalPosts,
          activeClippers,
          engagementRate: Number(engagementRate.toFixed(2)),
        };
      });

      return campaignsWithStats;
    } catch (error: any) {
      console.error("Erro ao buscar campanhas com stats:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Erro ao buscar campanhas",
      });
    }
  }),

  // Estatísticas gerais de campanhas
  getCampaignsStats: adminProcedure.query(async ({ ctx }) => {
    try {
      // Status de todas as campanhas (tabela pequena) + views elegíveis por
      // campanha (agregação em cache compartilhada com a lista de campanhas)
      const [campaigns, postTotals] = await Promise.all([
        ctx.db.campaign.findMany({ select: { id: true, status: true } }),
        getCachedCampaignPostTotals(ctx.db),
      ]);

      const countByStatus = (status: string) =>
        campaigns.filter((campaign) => campaign.status === status).length;
      const activeCampaigns = countByStatus("ACTIVE");
      const scheduledCampaigns = countByStatus("SCHEDULED");
      const completedCampaigns = countByStatus("COMPLETED");

      // Views elegíveis de todas as campanhas ativas e concluídas
      const totalViews = campaigns
        .filter(
          (campaign) =>
            campaign.status === "ACTIVE" || campaign.status === "COMPLETED",
        )
        .reduce(
          (sum, campaign) =>
            sum + Number(postTotals.get(campaign.id)?._sum.views || 0),
          0,
        );

      return {
        activeCampaigns,
        scheduledCampaigns,
        completedCampaigns,
        totalViews,
      };
    } catch (error: any) {
      console.error("Erro ao buscar stats de campanhas:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Erro ao buscar estatísticas",
      });
    }
  }),

  // ============================================================================
  // GESTÃO DE APLICAÇÕES
  // ============================================================================

  // Aprovar aplicação de um clipper
  approveApplication: adminProcedure
    .input(
      z.object({
        applicationId: z.string(),
        reviewNotes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Buscar aplicação
        const application = await ctx.db.clipperApplication.findUnique({
          where: { id: input.applicationId },
          include: {
            campaign: {
              select: {
                id: true,
                name: true,
                slug: true,
                startDate: true,
                endDate: true,
              },
            },
            clipperProfile: {
              include: {
                user: {
                  select: {
                    email: true,
                  },
                },
              },
            },
          },
        });

        if (!application) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Aplicação não encontrada",
          });
        }

        if (application.status === "APPROVED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Esta aplicação já foi aprovada",
          });
        }

        // Atualizar status da aplicação
        const changed = await ctx.db.clipperApplication.updateMany({
          where: { id: input.applicationId, status: { not: "WITHDRAWN" } },
          data: {
            status: "APPROVED",
            approvedAt: new Date(),
            reviewedBy: ctx.userId,
            reviewedAt: new Date(),
            reviewNotes: input.reviewNotes,
          },
        });

        if (changed.count !== 1) {
          throw new TRPCError({ code: "FORBIDDEN", message: "O clipador saiu desta competição. A inscrição não pode ser reativada." });
        }

        // Buscar todos os MonthlyRanking da campanha
        const monthlyRankings = await ctx.db.monthlyRanking.findMany({
          where: {
            campaignId: application.campaignId,
          },
          select: {
            id: true,
            monthPeriod: true,
          },
        });

        if (monthlyRankings.length === 0) {
          console.warn(
            `⚠️ Nenhum MonthlyRanking encontrado para a campanha ${application.campaign.name}`,
          );
        }

        // Criar MonthlyRankingEntry para cada MonthlyRanking
        const rankingEntriesCreated = await Promise.all(
          monthlyRankings.map(async (ranking) => {
            // Verificar se já existe entry (evitar duplicatas)
            const existingEntry = await ctx.db.monthlyRankingEntry.findUnique({
              where: {
                monthlyRankingId_clipperProfileId: {
                  monthlyRankingId: ranking.id,
                  clipperProfileId: application.clipperProfileId,
                },
              },
            });

            if (existingEntry) {
              console.log(
                `⚠️ MonthlyRankingEntry já existe para ${application.clipperProfile.fullName} no período ${ranking.monthPeriod}`,
              );
              return null;
            }

            // Contar quantos entries já existem para calcular a posição inicial
            const currentEntriesCount = await ctx.db.monthlyRankingEntry.count({
              where: {
                monthlyRankingId: ranking.id,
              },
            });

            // Criar entry
            return ctx.db.monthlyRankingEntry.create({
              data: {
                monthlyRankingId: ranking.id,
                clipperProfileId: application.clipperProfileId,
                applicationId: application.id,
                position: currentEntriesCount + 1, // Posição inicial no final do ranking
                previousPosition: null,
                totalViews: 0,
                totalLikes: 0,
                totalComments: 0,
                totalShares: 0,
                totalSaves: 0,
                postsCount: 0,
                averageViewsPerPost: 0,
                bestPostViews: null,
                bestPostId: null,
                engagementRate: 0,
                clipperName: application.clipperProfile.fullName,
                clipperUsername:
                  application.clipperProfile.artisticName ||
                  application.clipperProfile.fullName,
                clipperImageUrl: null, // Será preenchido depois
              },
            });
          }),
        );

        const entriesCreatedCount =
          rankingEntriesCreated.filter(Boolean).length;

        // Atualizar totalParticipants em cada MonthlyRanking
        await Promise.all(
          monthlyRankings.map((ranking) =>
            ctx.db.monthlyRanking.update({
              where: { id: ranking.id },
              data: {
                totalParticipants: {
                  increment: 1,
                },
              },
            }),
          ),
        );

        // Log de auditoria
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.userId,
            action: "APPROVE",
            entityType: "ClipperApplication",
            entityId: application.id,
            campaignId: application.campaignId,
            changes: {
              applicationId: application.id,
              clipperName: application.clipperProfile.fullName,
              campaignName: application.campaign.name,
              reviewNotes: input.reviewNotes,
              entriesCreated: entriesCreatedCount,
            },
          },
        });

        console.log(
          `✅ Aplicação aprovada: ${application.clipperProfile.fullName} na campanha ${application.campaign.name}`,
        );
        console.log(`✅ Criados ${entriesCreatedCount} MonthlyRankingEntry(s)`);

        // Enviar email de aprovação
        const userEmail = application.clipperProfile.user?.email;
        if (userEmail) {
          const emailHtml = getApplicationApprovalEmailTemplate(
            application.clipperProfile.fullName,
            application.campaign.name,
            application.campaign.startDate,
            application.campaign.endDate,
            application.campaign.slug,
          );

          resend.emails
            .send({
              from: "ClipfyAI <noreply@league.clipfyai.com>",
              to: userEmail,
              subject: `🎉 Inscrição aprovada: ${application.campaign.name}`,
              html: emailHtml,
            })
            .then(() => {
              console.log(`✅ Email de aprovação enviado para ${userEmail}`);
            })
            .catch((error) => {
              console.error(`❌ Erro ao enviar email de aprovação:`, error);
            });
        } else {
          console.warn(
            `⚠️ Email não encontrado para o clipper ${application.clipperProfile.fullName}`,
          );
        }

        return {
          success: true,
          message: "Aplicação aprovada com sucesso!",
          entriesCreated: entriesCreatedCount,
        };
      } catch (error: any) {
        console.error("Erro ao aprovar aplicação:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao aprovar aplicação",
        });
      }
    }),

  // Aprovar todas as aplicações pendentes de uma campanha
  approveAllApplications: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Buscar todas as aplicações pendentes
        const pendingApplications = await ctx.db.clipperApplication.findMany({
          where: {
            campaignId: input.campaignId,
            status: "PENDING",
          },
          include: {
            campaign: {
              select: {
                id: true,
                name: true,
                slug: true,
                startDate: true,
                endDate: true,
              },
            },
            clipperProfile: {
              include: {
                user: {
                  select: {
                    email: true,
                  },
                },
              },
            },
          },
        });

        if (pendingApplications.length === 0) {
          return {
            success: true,
            message: "Nenhuma aplicação pendente encontrada",
            approvedCount: 0,
          };
        }

        let approvedCount = 0;
        const errors: string[] = [];

        // Processar cada aplicação
        for (const application of pendingApplications) {
          try {
            // Atualizar status da aplicação
            const changed = await ctx.db.clipperApplication.updateMany({
              where: { id: application.id, status: "PENDING" },
              data: {
                status: "APPROVED",
                approvedAt: new Date(),
                reviewedBy: ctx.userId,
                reviewedAt: new Date(),
              },
            });

            if (changed.count !== 1) continue;

            // Buscar todos os MonthlyRanking da campanha
            const monthlyRankings = await ctx.db.monthlyRanking.findMany({
              where: {
                campaignId: application.campaignId,
              },
              select: {
                id: true,
                monthPeriod: true,
              },
            });

            // Criar MonthlyRankingEntry para cada MonthlyRanking
            for (const ranking of monthlyRankings) {
              // Verificar se já existe entry (evitar duplicatas)
              const existingEntry = await ctx.db.monthlyRankingEntry.findUnique(
                {
                  where: {
                    monthlyRankingId_clipperProfileId: {
                      monthlyRankingId: ranking.id,
                      clipperProfileId: application.clipperProfileId,
                    },
                  },
                },
              );

              if (!existingEntry) {
                // Contar quantos entries já existem para calcular a posição inicial
                const currentEntriesCount =
                  await ctx.db.monthlyRankingEntry.count({
                    where: {
                      monthlyRankingId: ranking.id,
                    },
                  });

                // Criar entry
                await ctx.db.monthlyRankingEntry.create({
                  data: {
                    monthlyRankingId: ranking.id,
                    clipperProfileId: application.clipperProfileId,
                    applicationId: application.id,
                    position: currentEntriesCount + 1,
                    previousPosition: null,
                    totalViews: 0,
                    totalLikes: 0,
                    totalComments: 0,
                    totalShares: 0,
                    totalSaves: 0,
                    postsCount: 0,
                    averageViewsPerPost: 0,
                    bestPostViews: null,
                    bestPostId: null,
                    engagementRate: 0,
                    clipperName: application.clipperProfile.fullName,
                    clipperUsername:
                      application.clipperProfile.artisticName ||
                      application.clipperProfile.fullName,
                    clipperImageUrl: null,
                  },
                });

                // Atualizar totalParticipants
                await ctx.db.monthlyRanking.update({
                  where: { id: ranking.id },
                  data: {
                    totalParticipants: {
                      increment: 1,
                    },
                  },
                });
              }
            }

            // Enviar email de aprovação
            const userEmail = application.clipperProfile.user?.email;
            if (userEmail) {
              const emailHtml = getApplicationApprovalEmailTemplate(
                application.clipperProfile.fullName,
                application.campaign.name,
                application.campaign.startDate,
                application.campaign.endDate,
                application.campaign.slug,
              );

              resend.emails
                .send({
                  from: "ClipfyAI <noreply@league.clipfyai.com>",
                  to: userEmail,
                  subject: `🎉 Inscrição aprovada: ${application.campaign.name}`,
                  html: emailHtml,
                })
                .then(() => {
                  console.log(
                    `✅ Email de aprovação enviado para ${userEmail}`,
                  );
                })
                .catch((error) => {
                  console.error(`❌ Erro ao enviar email de aprovação:`, error);
                });
            }

            approvedCount++;
            console.log(
              `✅ Aplicação aprovada: ${application.clipperProfile.fullName}`,
            );
          } catch (error: any) {
            console.error(
              `❌ Erro ao aprovar ${application.clipperProfile.fullName}:`,
              error,
            );
            errors.push(
              `${application.clipperProfile.fullName}: ${error.message}`,
            );
          }
        }

        // Log de auditoria
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.userId,
            action: "APPROVE",
            entityType: "ClipperApplication",
            entityId: input.campaignId,
            campaignId: input.campaignId,
            changes: {
              action: "bulk_approve",
              totalApplications: pendingApplications.length,
              approvedCount,
              errors: errors.length > 0 ? errors : undefined,
            },
          },
        });

        console.log(
          `✅ ${approvedCount} de ${pendingApplications.length} aplicações aprovadas em massa`,
        );

        return {
          success: true,
          message: `${approvedCount} aplicações aprovadas com sucesso!`,
          approvedCount,
          totalApplications: pendingApplications.length,
          errors: errors.length > 0 ? errors : undefined,
        };
      } catch (error: any) {
        console.error("Erro ao aprovar aplicações em massa:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao aprovar aplicações",
        });
      }
    }),

  // Rejeitar aplicação de um clipper
  rejectApplication: adminProcedure
    .input(
      z.object({
        applicationId: z.string(),
        rejectionReason: z.string().min(1, "Informe o motivo da rejeição"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Buscar aplicação
        const application = await ctx.db.clipperApplication.findUnique({
          where: { id: input.applicationId },
          include: {
            campaign: {
              select: {
                name: true,
              },
            },
            clipperProfile: {
              select: {
                fullName: true,
              },
            },
          },
        });

        if (!application) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Aplicação não encontrada",
          });
        }

        if (application.status === "REJECTED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Esta aplicação já foi rejeitada",
          });
        }

        // Atualizar status da aplicação
        const changed = await ctx.db.clipperApplication.updateMany({
          where: { id: input.applicationId, status: { not: "WITHDRAWN" } },
          data: {
            status: "REJECTED",
            reviewedBy: ctx.userId,
            reviewedAt: new Date(),
            rejectionReason: input.rejectionReason,
          },
        });

        if (changed.count !== 1) {
          throw new TRPCError({ code: "FORBIDDEN", message: "O clipador já saiu desta competição." });
        }

        // Log de auditoria
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.userId,
            action: "REJECT",
            entityType: "ClipperApplication",
            entityId: application.id,
            campaignId: application.campaignId,
            changes: {
              applicationId: application.id,
              clipperName: application.clipperProfile.fullName,
              campaignName: application.campaign.name,
              rejectionReason: input.rejectionReason,
            },
          },
        });

        console.log(
          `❌ Aplicação rejeitada: ${application.clipperProfile.fullName} na campanha ${application.campaign.name}`,
        );

        return {
          success: true,
          message: "Aplicação rejeitada",
        };
      } catch (error: any) {
        console.error("Erro ao rejeitar aplicação:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao rejeitar aplicação",
        });
      }
    }),

  // ============================================================================
  // COMPETIÇÕES PRIVADAS - GESTÃO DE INSCRIÇÕES PELO ADMIN
  // ============================================================================

  // Listar clipadores disponíveis para inscrever em uma competição privada
  listAvailableClippersForCompetition: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        search: z.string().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const { campaignId, search, page, limit } = input;
        const skip = (page - 1) * limit;

        // Verificar se a campanha existe
        const campaign = await ctx.db.campaign.findUnique({
          where: { id: campaignId },
          select: { id: true, name: true, isPrivate: true, status: true, startDate: true, endDate: true },
        });

        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campanha não encontrada",
          });
        }

        // Buscar clipperProfileIds que já estão inscritos nesta campanha
        const existingApplications = await ctx.db.clipperApplication.findMany({
          where: {
            campaignId,
            status: canRejoinCompetition("WITHDRAWN", campaign.status, campaign.startDate, campaign.endDate)
              ? { notIn: ["REJECTED", "WITHDRAWN"] }
              : { not: "REJECTED" },
          },
          select: {
            clipperProfileId: true,
          },
        });

        const enrolledProfileIds = existingApplications.map(
          (a) => a.clipperProfileId,
        );

        // Construir filtro de busca - APENAS clipadores verificados
        const where: any = {
          verificationStatus: "VERIFIED",
          id: {
            notIn:
              enrolledProfileIds.length > 0 ? enrolledProfileIds : undefined,
          },
        };

        // Se enrolledProfileIds está vazio, remover o filtro notIn
        if (enrolledProfileIds.length === 0) {
          delete where.id;
        }

        if (search) {
          where.OR = [
            { fullName: { contains: search, mode: "insensitive" as const } },
            {
              artisticName: { contains: search, mode: "insensitive" as const },
            },
            {
              user: {
                email: { contains: search, mode: "insensitive" as const },
              },
            },
            { phone: { contains: search, mode: "insensitive" as const } },
          ];
        }

        // Buscar clipadores disponíveis (que NÃO estão inscritos)
        const [clippers, total] = await Promise.all([
          ctx.db.clipperProfile.findMany({
            where,
            select: {
              id: true,
              fullName: true,
              artisticName: true,
              phone: true,
              instagramUsernames: true,
              tiktokUsernames: true,
              youtubeUsernames: true,
              kwaiUsernames: true,
              facebookUsernames: true,
              verificationStatus: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  imageUrl: true,
                },
              },
              socialAccounts: {
                where: { isActive: true },
                select: {
                  id: true,
                  platform: true,
                  username: true,
                  isPrimary: true,
                },
              },
            },
            orderBy: { fullName: "asc" },
            skip,
            take: limit,
          }),
          ctx.db.clipperProfile.count({ where }),
        ]);

        return {
          clippers: clippers.map((c) => ({
            id: c.id,
            userId: c.user.id,
            fullName: c.fullName,
            artisticName: c.artisticName,
            email: c.user.email,
            imageUrl: c.user.imageUrl,
            phone: c.phone,
            verificationStatus: c.verificationStatus,
            socialAccounts: c.socialAccounts,
            instagramUsernames: c.instagramUsernames,
            tiktokUsernames: c.tiktokUsernames,
            youtubeUsernames: c.youtubeUsernames,
            kwaiUsernames: c.kwaiUsernames,
            facebookUsernames: c.facebookUsernames,
          })),
          total,
          page,
          totalPages: Math.ceil(total / limit),
        };
      } catch (error: any) {
        console.error("Erro ao listar clipadores disponíveis:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao listar clipadores disponíveis",
        });
      }
    }),

  // Admin inscreve UM clipador em uma competição privada (status PENDING)
  enrollClipperInPrivateCompetition: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        clipperProfileId: z.string(),
        socialAccountIds: z.array(z.string()).optional(), // Opcional - admin pode ou não selecionar contas
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verificar se a campanha existe e é privada
        const campaign = await ctx.db.campaign.findUnique({
          where: { id: input.campaignId },
          select: {
            id: true,
            name: true,
            slug: true,
            isPrivate: true,
            requiresApproval: true,
            startDate: true,
            endDate: true,
          },
        });

        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campanha não encontrada",
          });
        }

        if (!campaign.isPrivate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Esta campanha não é privada. Clipadores podem se inscrever normalmente.",
          });
        }

        // Verificar se o clipper existe
        const clipperProfile = await ctx.db.clipperProfile.findUnique({
          where: { id: input.clipperProfileId },
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
            socialAccounts: {
              where: { isActive: true },
              select: { id: true },
            },
          },
        });

        if (!clipperProfile) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Perfil de clipador não encontrado",
          });
        }

        // Verificar se já existe uma aplicação (não rejeitada)
        const existingApplication = await ctx.db.clipperApplication.findFirst({
          where: {
            campaignId: input.campaignId,
            clipperProfileId: input.clipperProfileId,
            status: { not: "REJECTED" },
          },
        });

        if (existingApplication?.status === "WITHDRAWN") {
          const socialAccountIds = input.socialAccountIds?.length
            ? input.socialAccountIds
            : clipperProfile.socialAccounts.map((account) => account.id);
          const application = await reenrollWithdrawnApplication(ctx.db, {
            campaignId: input.campaignId,
            clipperProfileId: input.clipperProfileId,
            actorUserId: ctx.userId,
            socialAccountIds,
            byAdmin: true,
          });
          return {
            success: true,
            application,
            message: `${clipperProfile.fullName} reinscrito antes do início (pendente de aprovação)`,
          };
        }

        if (existingApplication) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `${clipperProfile.fullName} já está inscrito nesta competição`,
          });
        }

        // Definir contas sociais a vincular
        const socialAccountIds =
          input.socialAccountIds && input.socialAccountIds.length > 0
            ? input.socialAccountIds
            : clipperProfile.socialAccounts.map((sa) => sa.id); // Usar todas as contas ativas

        // Criar aplicação com status PENDING (admin inscreveu, mas ainda precisa ser aprovado)
        const application = await ctx.db.clipperApplication.create({
          data: {
            campaignId: input.campaignId,
            clipperProfileId: input.clipperProfileId,
            status: "PENDING",
            formData: {
              enrolledAt: new Date().toISOString(),
              enrolledBy: ctx.userId,
              enrollmentType: "ADMIN_PRIVATE_COMPETITION",
            },
            autoScore: clipperProfile.autoScore,
            autoDecision: "MANUAL_REVIEW",
            // Vincular contas sociais
            socialAccounts:
              socialAccountIds.length > 0
                ? {
                    create: socialAccountIds.map((accountId) => ({
                      accountId,
                    })),
                  }
                : undefined,
          },
          include: {
            clipperProfile: {
              select: {
                fullName: true,
                artisticName: true,
              },
            },
          },
        });

        // Log de auditoria
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.userId,
            action: "CREATE",
            entityType: "ClipperApplication",
            entityId: application.id,
            campaignId: input.campaignId,
            changes: {
              action: "admin_enroll_private_competition",
              clipperName: clipperProfile.fullName,
              campaignName: campaign.name,
              socialAccountsLinked: socialAccountIds.length,
            },
          },
        });

        console.log(
          `✅ Admin inscreveu ${clipperProfile.fullName} na competição privada ${campaign.name}`,
        );

        return {
          success: true,
          application,
          message: `${clipperProfile.fullName} inscrito com sucesso na competição "${campaign.name}" (pendente de aprovação)`,
        };
      } catch (error: any) {
        console.error(
          "Erro ao inscrever clipador em competição privada:",
          error,
        );
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao inscrever clipador",
        });
      }
    }),

  // Admin inscreve MÚLTIPLOS clipadores em uma competição privada (bulk)
  enrollMultipleClippersInPrivateCompetition: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        clipperProfileIds: z
          .array(z.string())
          .min(1, "Selecione ao menos um clipador"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verificar se a campanha existe e é privada
        const campaign = await ctx.db.campaign.findUnique({
          where: { id: input.campaignId },
          select: {
            id: true,
            name: true,
            slug: true,
            isPrivate: true,
            requiresApproval: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        });

        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campanha não encontrada",
          });
        }

        if (!campaign.isPrivate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Esta campanha não é privada. Clipadores podem se inscrever normalmente.",
          });
        }

        // Buscar aplicações existentes para evitar duplicatas
        const existingApplications = await ctx.db.clipperApplication.findMany({
          where: {
            campaignId: input.campaignId,
            clipperProfileId: { in: input.clipperProfileIds },
            status: { not: "REJECTED" },
          },
          select: {
            clipperProfileId: true,
            status: true,
          },
        });

        const alreadyEnrolledIds = new Set(
          existingApplications
            .filter((application) => !canRejoinCompetition(application.status, campaign.status, campaign.startDate, campaign.endDate))
            .map((application) => application.clipperProfileId),
        );

        // Filtrar apenas os que ainda não estão inscritos
        const newClipperIds = input.clipperProfileIds.filter(
          (id) => !alreadyEnrolledIds.has(id),
        );

        if (newClipperIds.length === 0) {
          return {
            success: true,
            message:
              "Todos os clipadores selecionados já estão inscritos nesta competição",
            enrolledCount: 0,
            skippedCount: input.clipperProfileIds.length,
            errors: [],
          };
        }

        // Buscar perfis dos clipadores com suas contas sociais
        const clipperProfiles = await ctx.db.clipperProfile.findMany({
          where: {
            id: { in: newClipperIds },
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
            socialAccounts: {
              where: { isActive: true },
              select: { id: true },
            },
          },
        });

        let enrolledCount = 0;
        const errors: string[] = [];

        const withdrawnProfileIds = new Set(
          existingApplications.filter((application) => application.status === "WITHDRAWN").map((application) => application.clipperProfileId),
        );

        // Inscrever cada clipador
        for (const clipper of clipperProfiles) {
          try {
            const socialAccountIds = clipper.socialAccounts.map((sa) => sa.id);

            if (withdrawnProfileIds.has(clipper.id)) {
              await reenrollWithdrawnApplication(ctx.db, {
                campaignId: input.campaignId,
                clipperProfileId: clipper.id,
                actorUserId: ctx.userId,
                socialAccountIds,
                byAdmin: true,
              });
              enrolledCount++;
              continue;
            }

            await ctx.db.clipperApplication.create({
              data: {
                campaignId: input.campaignId,
                clipperProfileId: clipper.id,
                status: "PENDING",
                formData: {
                  enrolledAt: new Date().toISOString(),
                  enrolledBy: ctx.userId,
                  enrollmentType: "ADMIN_PRIVATE_COMPETITION_BULK",
                },
                autoScore: clipper.autoScore,
                autoDecision: "MANUAL_REVIEW",
                socialAccounts:
                  socialAccountIds.length > 0
                    ? {
                        create: socialAccountIds.map((accountId) => ({
                          accountId,
                        })),
                      }
                    : undefined,
              },
            });

            enrolledCount++;
            console.log(`✅ Inscrito: ${clipper.fullName}`);
          } catch (err: any) {
            console.error(`❌ Erro ao inscrever ${clipper.fullName}:`, err);
            errors.push(`${clipper.fullName}: ${err.message}`);
          }
        }

        // Log de auditoria
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.userId,
            action: "CREATE",
            entityType: "ClipperApplication",
            entityId: input.campaignId,
            campaignId: input.campaignId,
            changes: {
              action: "admin_bulk_enroll_private_competition",
              campaignName: campaign.name,
              totalRequested: input.clipperProfileIds.length,
              enrolledCount,
              skippedCount: alreadyEnrolledIds.size,
              errorsCount: errors.length,
              errors: errors.length > 0 ? errors : undefined,
            },
          },
        });

        console.log(
          `✅ ${enrolledCount} clipadores inscritos em massa na competição privada ${campaign.name}`,
        );

        return {
          success: true,
          message: `${enrolledCount} clipador(es) inscrito(s) com sucesso na competição "${campaign.name}" (pendentes de aprovação)`,
          enrolledCount,
          skippedCount: alreadyEnrolledIds.size,
          errors: errors.length > 0 ? errors : [],
        };
      } catch (error: any) {
        console.error("Erro ao inscrever clipadores em massa:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao inscrever clipadores em massa",
        });
      }
    }),

  // Listar competições para seleção (dropdown) — exclui a campanha atual
  listCampaignsForClone: adminProcedure
    .input(
      z.object({
        excludeCampaignId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const campaigns = await ctx.db.campaign.findMany({
        where: {
          id: { not: input.excludeCampaignId },
          status: { in: ["ACTIVE", "COMPLETED", "PAUSED", "SCHEDULED"] },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          isPrivate: true,
          _count: {
            select: {
              applications: {
                where: { status: { in: ["APPROVED", "PENDING"] } },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return campaigns;
    }),

  // Preview de clipadores elegíveis para clone (retorna lista com nomes/avatares)
  previewCloneApplications: adminProcedure
    .input(
      z.object({
        sourceCampaignId: z.string(),
        targetCampaignId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Buscar aplicações aprovadas/pendentes da origem
      const sourceApplications = await ctx.db.clipperApplication.findMany({
        where: {
          campaignId: input.sourceCampaignId,
          status: { in: ["APPROVED", "PENDING"] },
        },
        include: {
          clipperProfile: {
            include: {
              user: { select: { imageUrl: true } },
              socialAccounts: {
                where: { isActive: true },
                select: { id: true },
              },
            },
          },
        },
      });

      // Buscar já inscritos no destino
      const existingApplications = await ctx.db.clipperApplication.findMany({
        where: {
          campaignId: input.targetCampaignId,
          clipperProfileId: {
            in: sourceApplications.map((a) => a.clipperProfileId),
          },
          status: { not: "REJECTED" },
        },
        select: { clipperProfileId: true },
      });

      const alreadyEnrolledIds = new Set(
        existingApplications.map((a) => a.clipperProfileId),
      );

      const eligible = sourceApplications
        .filter((app) => !alreadyEnrolledIds.has(app.clipperProfileId))
        .map((app) => ({
          clipperProfileId: app.clipperProfile.id,
          fullName: app.clipperProfile.fullName,
          imageUrl: app.clipperProfile.user?.imageUrl || null,
          autoScore: app.clipperProfile.autoScore,
          socialAccountIds: app.clipperProfile.socialAccounts.map(
            (sa: { id: string }) => sa.id,
          ),
        }));

      return {
        eligible,
        skippedCount: alreadyEnrolledIds.size,
        totalInSource: sourceApplications.length,
      };
    }),

  // Clonar UMA aplicação de uma competição para outra (chamado individualmente para progresso real-time)
  cloneSingleApplication: adminProcedure
    .input(
      z.object({
        sourceCampaignId: z.string(),
        targetCampaignId: z.string(),
        clipperProfileId: z.string(),
        socialAccountIds: z.array(z.string()),
        autoScore: z.number().nullable().optional(),
        sourceCampaignName: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verificar duplicata one more time (safety)
      const existing = await ctx.db.clipperApplication.findFirst({
        where: {
          campaignId: input.targetCampaignId,
          clipperProfileId: input.clipperProfileId,
          status: { not: "REJECTED" },
        },
      });

      if (existing) {
        return { success: true, skipped: true };
      }

      await ctx.db.clipperApplication.create({
        data: {
          campaignId: input.targetCampaignId,
          clipperProfileId: input.clipperProfileId,
          status: "PENDING",
          formData: {
            clonedAt: new Date().toISOString(),
            clonedBy: ctx.userId,
            clonedFrom: input.sourceCampaignId,
            clonedFromCampaignName: input.sourceCampaignName,
            enrollmentType: "ADMIN_CLONE_FROM_COMPETITION",
          },
          autoScore: input.autoScore ?? undefined,
          autoDecision: "MANUAL_REVIEW",
          socialAccounts:
            input.socialAccountIds.length > 0
              ? {
                  create: input.socialAccountIds.map((accountId) => ({
                    accountId,
                  })),
                }
              : undefined,
        },
      });

      return { success: true, skipped: false };
    }),

  // Log de auditoria após clone completo (chamado uma vez no final)
  logCloneCompletion: adminProcedure
    .input(
      z.object({
        sourceCampaignId: z.string(),
        sourceCampaignName: z.string(),
        targetCampaignId: z.string(),
        targetCampaignName: z.string(),
        totalInSource: z.number(),
        clonedCount: z.number(),
        skippedCount: z.number(),
        errorsCount: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "CREATE",
          entityType: "ClipperApplication",
          entityId: input.targetCampaignId,
          campaignId: input.targetCampaignId,
          changes: {
            action: "admin_clone_applications_from_competition",
            sourceCampaignId: input.sourceCampaignId,
            sourceCampaignName: input.sourceCampaignName,
            targetCampaignName: input.targetCampaignName,
            totalInSource: input.totalInSource,
            clonedCount: input.clonedCount,
            skippedCount: input.skippedCount,
            errorsCount: input.errorsCount,
          },
        },
      });
      return { success: true };
    }),

  // Remover clipador de uma competição privada
  removeClipperFromPrivateCompetition: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        clipperProfileId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verificar se a campanha existe
        const campaign = await ctx.db.campaign.findUnique({
          where: { id: input.campaignId },
          select: { id: true, name: true, isPrivate: true },
        });

        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campanha não encontrada",
          });
        }

        if (!campaign.isPrivate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Esta campanha não é privada",
          });
        }

        // Buscar a aplicação
        const application = await ctx.db.clipperApplication.findUnique({
          where: {
            campaignId_clipperProfileId: {
              campaignId: input.campaignId,
              clipperProfileId: input.clipperProfileId,
            },
          },
          include: {
            clipperProfile: {
              select: { fullName: true },
            },
          },
        });

        if (!application) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Inscrição não encontrada",
          });
        }

        // Remover MonthlyRankingEntries associadas
        await ctx.db.monthlyRankingEntry.deleteMany({
          where: {
            applicationId: application.id,
          },
        });

        // Remover DailyRankingEntries associadas
        await ctx.db.dailyRankingEntry.deleteMany({
          where: {
            applicationId: application.id,
          },
        });

        // Remover ApplicationSocialAccounts
        await ctx.db.applicationSocialAccount.deleteMany({
          where: {
            applicationId: application.id,
          },
        });

        // Remover a aplicação
        await ctx.db.clipperApplication.delete({
          where: { id: application.id },
        });

        // Log de auditoria
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.userId,
            action: "DELETE",
            entityType: "ClipperApplication",
            entityId: application.id,
            campaignId: input.campaignId,
            changes: {
              action: "admin_remove_from_private_competition",
              clipperName: application.clipperProfile.fullName,
              campaignName: campaign.name,
            },
          },
        });

        console.log(
          `🗑️ ${application.clipperProfile.fullName} removido da competição privada ${campaign.name}`,
        );

        return {
          success: true,
          message: `${application.clipperProfile.fullName} removido da competição`,
        };
      } catch (error: any) {
        console.error("Erro ao remover clipador da competição:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao remover clipador",
        });
      }
    }),

  // ============================================================================
  // DETALHES COMPLETOS DA COMPETIÇÃO (ADMIN)
  // ============================================================================

  getCompetitionDetailsAdmin: adminProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        // Buscar campanha
        const campaign = await ctx.db.campaign.findUnique({
          where: { slug: input.slug },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
              },
            },
            activeRankingRule: true,
          },
        });
        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Competição não encontrada",
          });
        }

        const metricType =
          campaign.rankingMetricType ?? RankingMetricType.VIEWS;

        // Dados da campanha prontos para passar ao computeMonthlyLeaderboard (evita re-fetch)
        const campaignForMonthly = {
          endDate: campaign.endDate,
          status: campaign.status,
          rankingMetricType: campaign.rankingMetricType,
          activeRankingRule: campaign.activeRankingRule
            ? {
                monthlyTopCount: campaign.activeRankingRule.monthlyTopCount,
                monthlyPrizeTable: campaign.activeRankingRule.monthlyPrizeTable,
              }
            : null,
        };

        const referenceDateYmd = getClipperDailyReferenceDateYmd();
        const { startDate: todayStartUTC, endDate: todayEndUTC } =
          getLiveDailyWindowByReferenceDate(referenceDateYmd);

        // Totais por conta (username + plataforma) em uma varredura dos posts
        // da campanha: as somas dos elegíveis dão o ranking de contas e os
        // totais gerais; a contagem de todos os status dá o total de posts.
        type AccountGroupRow = {
          username: string | null;
          platform: Platform;
          allPosts: number;
          posts: number;
          views: bigint;
          likes: bigint;
          comments: bigint;
          shares: bigint;
          saves: bigint | null;
        };

        // Executar TODAS as queries em paralelo após obter campaign.id
        const [
          [accountGroups, totalClippers],
          monthlyBoard,
          [todayPostsCountResult, todayPosts, dailyEntryMetricsMap],
          topPostsForReport,
        ] = await Promise.all([
          // 1. Estatísticas gerais e top contas por rede social
          Promise.all([
            ctx.db.$queryRaw<AccountGroupRow[]>`
              SELECT
                username,
                platform,
                COUNT(*)::int AS "allPosts",
                (COUNT(*) FILTER (WHERE status = 'ELIGIBLE'))::int AS posts,
                COALESCE(SUM(views) FILTER (WHERE status = 'ELIGIBLE'), 0)::bigint AS views,
                COALESCE(SUM(likes) FILTER (WHERE status = 'ELIGIBLE'), 0)::bigint AS likes,
                COALESCE(SUM(comments) FILTER (WHERE status = 'ELIGIBLE'), 0)::bigint AS comments,
                COALESCE(SUM(shares) FILTER (WHERE status = 'ELIGIBLE'), 0)::bigint AS shares,
                (SUM(saves) FILTER (WHERE status = 'ELIGIBLE'))::bigint AS saves
              FROM "ClipPost"
              WHERE "campaignId" = ${campaign.id}
              GROUP BY username, platform
            `,
            ctx.db.clipperApplication.count({
              where: { campaignId: campaign.id, status: "APPROVED" },
            }),
          ]),
          // 2. Ranking mensal (com dados de campanha já carregados)
          computeMonthlyLeaderboard(ctx.db, campaign.id, campaignForMonthly),
          // 3. Posts e ranking diário de hoje (perfis só do top, abaixo)
          Promise.all([
            ctx.db.clipPost.count({
              where: {
                campaignId: campaign.id,
                postedAt: { gte: todayStartUTC, lt: todayEndUTC },
                application: {
                  campaignId: campaign.id,
                  ...rankingApplicationWhere(todayEndUTC),
                },
              },
            }),
            ctx.db.clipPost.findMany({
              where: {
                campaignId: campaign.id,
                status: "ELIGIBLE",
                postedAt: { gte: todayStartUTC, lt: todayEndUTC },
                application: {
                  campaignId: campaign.id,
                  ...rankingApplicationWhere(todayEndUTC),
                },
              },
              select: {
                id: true,
                applicationId: true,
                submittedUrl: true,
                username: true,
                platform: true,
                thumbnailUrl: true,
                postedAt: true,
                views: true,
                likes: true,
                comments: true,
                shares: true,
                saves: true,
              },
            }),
            loadDailyRankingEntryMetricsMap(
              ctx.db,
              campaign.id,
              referenceDateYmd,
            ),
          ]),
          // 4. Top 10 posts para relatório
          ctx.db.clipPost.findMany({
            where: { campaignId: campaign.id, status: "ELIGIBLE" },
            orderBy: { views: "desc" },
            take: 10,
            select: {
              id: true,
              submittedUrl: true,
              thumbnailUrl: true,
              platform: true,
              username: true,
              views: true,
              likes: true,
              comments: true,
              shares: true,
              postedAt: true,
              application: {
                select: {
                  clipperProfile: {
                    select: { artisticName: true, fullName: true },
                  },
                },
              },
            },
          }),
        ]);
        const eligibleAccountGroups = accountGroups.filter(
          (row) => row.posts > 0,
        );
        const sumEligible = (
          field: "views" | "likes" | "comments" | "shares" | "saves",
        ) =>
          eligibleAccountGroups.reduce(
            (sum, row) => sum + Number(row[field] ?? 0),
            0,
          );
        const totalPosts = accountGroups.reduce(
          (sum, row) => sum + row.allPosts,
          0,
        );
        const topMonthlyRanking = monthlyBoard?.rows ?? [];

        const totalViews = sumEligible("views");
        const totalLikes = sumEligible("likes");
        const totalComments = sumEligible("comments");
        const totalShares = sumEligible("shares");
        const totalSaves = sumEligible("saves");
        const engagementRate = calculateEngagementRate(
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
          totalSaves,
        );

        const topAccountsRanking = eligibleAccountGroups
          .map((row) => {
            const totalViews = Number(row.views);
            const totalLikes = Number(row.likes);
            const totalComments = Number(row.comments);
            const totalShares = Number(row.shares);
            const totalSaves = Number(row.saves ?? 0);
            const engagementRate = calculateEngagementRate(
              totalViews,
              totalLikes,
              totalComments,
              totalShares,
              totalSaves,
            );
            const rankingScore = calculateRankingScore(
              metricType === RankingMetricType.VIEWS_X_ENGAGEMENT
                ? "VIEWS_X_ENGAGEMENT"
                : "VIEWS",
              totalViews,
              totalLikes,
              totalComments,
              totalShares,
              totalSaves,
            );
            return {
              username: row.username ?? "unknown",
              platform: row.platform,
              totalViews,
              totalLikes,
              totalComments,
              totalShares,
              totalSaves,
              postsCount: row.posts,
              engagementRate,
              rankingScore,
            };
          })
          .sort((a, b) => b.rankingScore - a.rankingScore)
          .slice(0, 15)
          .map((account, index) => ({
            position: index + 1,
            ...account,
          }));

        const todayPostsCount = todayPostsCountResult;
        const dailyLimit = campaign.activeRankingRule?.dailyTopCount ?? 15;
        const hasSnapshotMetrics = dailyEntryMetricsMap.size > 0;
        const rankedDailyPosts = rankLiveDailyPosts({
          posts: todayPosts.flatMap((post) => {
            const clipTotals = {
              views: Number(post.views),
              likes: post.likes,
              comments: post.comments,
              shares: post.shares,
              saves: post.saves ?? 0,
            };
            const { metrics, source } = pickMetricsForDailyRank(
              post.id,
              clipTotals,
              dailyEntryMetricsMap,
            );
            // Se já existe snapshot do dia, não misturar com totais live de ClipPost.
            if (hasSnapshotMetrics && source !== "daily_entry") {
              return [];
            }
            return {
              postId: post.id,
              // Perfil e clã são preenchidos depois, só para o top do dia
              clipperName: "",
              clipperImageUrl: null,
              username: post.username || "",
              platform: post.platform,
              thumbnailUrl: post.thumbnailUrl || "",
              views: metrics.views,
              likes: metrics.likes,
              comments: metrics.comments,
              shares: metrics.shares,
              saves: metrics.saves,
              postedAtIso:
                post.postedAt?.toISOString() || new Date().toISOString(),
              isCurrentUser: false,
              clanTag: null,
              clanEmoji: null,
              clanEmojiColor: null,
            };
          }),
          metricType:
            metricType === RankingMetricType.VIEWS_X_ENGAGEMENT
              ? RankingMetricType.VIEWS_X_ENGAGEMENT
              : RankingMetricType.VIEWS,
          topCount: dailyLimit,
          dailyPrizeTable: campaign.activeRankingRule?.dailyPrizeTable ?? null,
        });
        const todayPostById = new Map(todayPosts.map((p) => [p.id, p]));
        const topDailyApplicationIds = [
          ...new Set(
            rankedDailyPosts.flatMap((item) => {
              const applicationId = todayPostById.get(item.postId)?.applicationId;
              return applicationId ? [applicationId] : [];
            }),
          ),
        ];
        const topDailyApplications =
          topDailyApplicationIds.length > 0
            ? await ctx.db.clipperApplication.findMany({
                where: { id: { in: topDailyApplicationIds } },
                select: {
                  id: true,
                  clipperProfile: {
                    select: {
                      artisticName: true,
                      fullName: true,
                      user: { select: { imageUrl: true } },
                      clan: {
                        select: { tag: true, emoji: true, emojiColor: true },
                      },
                    },
                  },
                },
              })
            : [];
        const topDailyProfileByApplication = new Map(
          topDailyApplications.map((application) => [
            application.id,
            application.clipperProfile,
          ]),
        );
        const topDailyRanking = rankedDailyPosts.map((item) => {
          const post = todayPostById.get(item.postId);
          const profile = post
            ? topDailyProfileByApplication.get(post.applicationId)
            : undefined;
          return {
            ...item,
            clipperName: profile
              ? profile.artisticName || profile.fullName
              : item.clipperName,
            clipperImageUrl: profile?.user?.imageUrl || null,
            clanTag: profile?.clan?.tag ?? null,
            clanEmoji: profile?.clan?.emoji ?? null,
            clanEmojiColor: profile?.clan?.emojiColor ?? null,
            postUrl: post?.submittedUrl ?? "",
          };
        });

        const formattedTopPostsForReport = topPostsForReport.map((post) => ({
          id: post.id,
          url: post.submittedUrl,
          thumbnail: post.thumbnailUrl,
          platform: post.platform,
          username: post.username || "",
          clipperName: post.application?.clipperProfile
            ? getClipperRankingDisplayName(post.application.clipperProfile)
            : "Clipador",
          views: Number(post.views),
          likes: post.likes,
          comments: post.comments,
          shares: post.shares,
          postedAt: post.postedAt?.toISOString(),
          status: "ELIGIBLE" as const,
        }));

        // Formatar prêmio
        const totalPrize =
          campaign.prizeInfo &&
          typeof campaign.prizeInfo === "object" &&
          "total" in campaign.prizeInfo
            ? typeof campaign.prizeInfo.total === "object"
              ? "R$ 0"
              : String(campaign.prizeInfo.total)
            : "R$ 0";

        const adminResult = {
          campaign: {
            id: campaign.id,
            name: campaign.name,
            slug: campaign.slug,
            description: campaign.description,
            status: campaign.status,
            coverImageUrl: campaign.coverImageUrl,
            startDate: campaign.startDate.toISOString(),
            endDate: campaign.endDate.toISOString(),
            platforms: campaign.platforms,
            requiredHashtags: campaign.requiredHashtags,
            requiredMentions: campaign.requiredMentions,
            prohibitedContent: campaign.prohibitedContent,
            prizeInfo: campaign.prizeInfo,
            totalPrize,
            isLeaderboardPublic: campaign.isLeaderboardPublic,
            isPrivate: campaign.isPrivate,
            requiresApproval: campaign.requiresApproval,
            autoApproveCreators: campaign.autoApproveCreators,
            organization: campaign.organization,
            rankingMetricType: campaign.rankingMetricType, // Tipo de métrica (VIEWS ou VIEWS_X_ENGAGEMENT)
            isProOnly: campaign.isProOnly,
            dailyPix: campaign.dailyPix,
            topClippersRankingEnabled: campaign.topClippersRankingEnabled,
            topClippersPrizeTable: campaign.topClippersPrizeTable,
            // Links de afiliados
            affiliateLinkInstagram: campaign.affiliateLinkInstagram,
            affiliateLinkTiktok: campaign.affiliateLinkTiktok,
            affiliateLinkYoutube: campaign.affiliateLinkYoutube,
            affiliateLinkFacebook: campaign.affiliateLinkFacebook,
            affiliateLinkKwai: campaign.affiliateLinkKwai,
            activeRankingRule: campaign.activeRankingRule
              ? {
                  id: campaign.activeRankingRule.id,
                  dailyEnabled: campaign.activeRankingRule.dailyEnabled,
                  dailyTopCount: campaign.activeRankingRule.dailyTopCount,
                  dailyTotalPrize: campaign.activeRankingRule.dailyTotalPrize,
                  dailyPrizeTable: campaign.activeRankingRule.dailyPrizeTable,
                  bonusEnabled: campaign.activeRankingRule.bonusEnabled,
                  bonusMilestone: campaign.activeRankingRule.bonusMilestone,
                  bonusAmount: campaign.activeRankingRule.bonusAmount,
                  bonusMonthlyBudgetCap:
                    campaign.activeRankingRule.bonusMonthlyBudgetCap,
                  monthlyEnabled: campaign.activeRankingRule.monthlyEnabled,
                  monthlyTopCount: campaign.activeRankingRule.monthlyTopCount,
                  monthlyTotalPrize:
                    campaign.activeRankingRule.monthlyTotalPrize,
                  monthlyPrizeTable:
                    campaign.activeRankingRule.monthlyPrizeTable,
                }
              : null,
          },
          stats: {
            totalViews,
            totalLikes,
            totalComments,
            totalShares,
            totalSaves,
            totalClippers,
            totalPosts,
            engagementRate: Number(engagementRate.toFixed(2)),
          },
          topMonthlyRanking,
          topAccountsRanking,
          topDailyRanking,
          todayPostsCount, // Total de posts submetidos hoje
          topPostsForReport: formattedTopPostsForReport,
          rankingRule: campaign.activeRankingRule
            ? {
                dailyEnabled: campaign.activeRankingRule.dailyEnabled,
                dailyTopCount: campaign.activeRankingRule.dailyTopCount,
                dailyTotalPrize: campaign.activeRankingRule.dailyTotalPrize,
                dailyPrizeTable: campaign.activeRankingRule.dailyPrizeTable,
                bonusEnabled: campaign.activeRankingRule.bonusEnabled,
                bonusMilestone: campaign.activeRankingRule.bonusMilestone,
                bonusAmount: campaign.activeRankingRule.bonusAmount,
                monthlyEnabled: campaign.activeRankingRule.monthlyEnabled,
                monthlyTopCount: campaign.activeRankingRule.monthlyTopCount,
                monthlyTotalPrize: campaign.activeRankingRule.monthlyTotalPrize,
                monthlyPrizeTable: campaign.activeRankingRule.monthlyPrizeTable,
              }
            : null,
        };
        return adminResult;
      } catch (error: any) {
        console.error("Erro ao buscar detalhes da competição:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao buscar detalhes da competição",
        });
      }
    }),

  // ============================================================================
  // APLICAÇÕES DA COMPETIÇÃO (lazy loading - tab "Clipadores")
  // ============================================================================
  getCompetitionApplicationsAdmin: adminProcedure
    .input(
      z.object({
        slug: z.string(),
        status: z
          .enum(["PENDING", "APPROVED", "REJECTED", "UNDER_REVIEW", "REVOKED", "WITHDRAWN"])
          .optional(),
        search: z.string().max(200).optional(),
        /** Carrega uma inscrição específica (ex.: "Ver aplicação" do ranking). */
        applicationId: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(200).default(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const campaign = await ctx.db.campaign.findUnique({
          where: { slug: input.slug },
          select: {
            id: true,
          },
        });

        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Competição não encontrada",
          });
        }

        const searchTrimmed = input.search?.trim() ?? "";
        const applicationsWhere: Prisma.ClipperApplicationWhereInput = {
          campaignId: campaign.id,
          ...(input.applicationId ? { id: input.applicationId } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(searchTrimmed
            ? {
                OR: [
                  {
                    clipperProfile: {
                      fullName: {
                        contains: searchTrimmed,
                        mode: "insensitive",
                      },
                    },
                  },
                  {
                    clipperProfile: {
                      artisticName: {
                        contains: searchTrimmed,
                        mode: "insensitive",
                      },
                    },
                  },
                  {
                    clipperProfile: {
                      phone: { contains: searchTrimmed, mode: "insensitive" },
                    },
                  },
                  {
                    clipperProfile: {
                      cpf: { contains: searchTrimmed, mode: "insensitive" },
                    },
                  },
                  {
                    clipperProfile: {
                      pixKey: { contains: searchTrimmed, mode: "insensitive" },
                    },
                  },
                  {
                    clipperProfile: {
                      discordUsername: {
                        contains: searchTrimmed,
                        mode: "insensitive",
                      },
                    },
                  },
                  {
                    clipperProfile: {
                      user: {
                        email: { contains: searchTrimmed, mode: "insensitive" },
                      },
                    },
                  },
                  {
                    clipperProfile: {
                      user: {
                        name: { contains: searchTrimmed, mode: "insensitive" },
                      },
                    },
                  },
                  {
                    socialAccounts: {
                      some: {
                        socialAccount: {
                          username: {
                            contains: searchTrimmed,
                            mode: "insensitive",
                          },
                        },
                      },
                    },
                  },
                ],
              }
            : {}),
        };

        const skip = (input.page - 1) * input.pageSize;

        const [statusCounts, applications, listMatchCount] = await Promise.all([
          // Contagens por status (sempre, independente do filtro ativo)
          ctx.db.clipperApplication.groupBy({
            by: ["status"],
            where: { campaignId: campaign.id },
            _count: { id: true },
          }),
          ctx.db.clipperApplication.findMany({
            where: applicationsWhere,
            skip,
            take: input.pageSize,
            include: {
              clipperProfile: {
                include: {
                  user: {
                    select: {
                      name: true,
                      email: true,
                      imageUrl: true,
                    },
                  },
                  clan: {
                    select: {
                      tag: true,
                      emoji: true,
                      emojiColor: true,
                    },
                  },
                },
              },
              socialAccounts: {
                include: {
                  socialAccount: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          }),
          ctx.db.clipperApplication.count({ where: applicationsWhere }),
        ]);
        const countByStatus = new Map(
          statusCounts.map((r) => [r.status, r._count.id]),
        );
        const pendingCount = countByStatus.get("PENDING") ?? 0;
        const approvedCount = countByStatus.get("APPROVED") ?? 0;
        const totalCount = statusCounts.reduce((s, r) => s + r._count.id, 0);

        // Totais dos posts (por status, plataforma e conta) e o total ganho
        // NESTA competição, agregados no banco só para as inscrições da página
        const applicationIds = applications.map((app) => app.id);
        const clipperProfileIds = applications.map(
          (app) => app.clipperProfileId,
        );
        const [postGroups, wallets, earningsByWallet] =
          applications.length > 0
            ? await Promise.all([
                ctx.db.clipPost.groupBy({
                  by: ["applicationId", "status", "platform", "username"],
                  where: { applicationId: { in: applicationIds } },
                  _count: { _all: true },
                  _sum: { views: true, likes: true },
                }),
                ctx.db.wallet.findMany({
                  where: { clipperProfileId: { in: clipperProfileIds } },
                  select: { id: true, clipperProfileId: true },
                }),
                ctx.db.transaction.groupBy({
                  by: ["walletId"],
                  where: {
                    wallet: { clipperProfileId: { in: clipperProfileIds } },
                    campaignId: campaign.id,
                    status: "COMPLETED",
                    type: {
                      in: ["PRIZE_CREDIT", "BONUS", "ADJUSTMENT"],
                    },
                  },
                  _sum: { amount: true },
                }),
              ])
            : [[], [], []];

        // Mapa com o total ganho por clipper NESTA competição
        const clipperByWallet = new Map(
          wallets.map((wallet) => [wallet.id, wallet.clipperProfileId]),
        );
        const earningsMap = new Map<string, number>();
        for (const row of earningsByWallet) {
          const clipperProfileId = clipperByWallet.get(row.walletId);
          if (clipperProfileId) {
            earningsMap.set(clipperProfileId, Number(row._sum.amount ?? 0));
          }
        }

        const postGroupsByApplication = new Map<string, typeof postGroups>();
        for (const group of postGroups) {
          const current = postGroupsByApplication.get(group.applicationId) ?? [];
          current.push(group);
          postGroupsByApplication.set(group.applicationId, current);
        }
        const summarizePosts = (groups: typeof postGroups) => {
          const eligible = groups.filter(
            (group) => group.status === "ELIGIBLE",
          );
          return {
            postsCount: groups.reduce((sum, g) => sum + g._count._all, 0),
            eligiblePostsCount: eligible.reduce(
              (sum, g) => sum + g._count._all,
              0,
            ),
            totalViews: eligible.reduce(
              (sum, g) => sum + Number(g._sum.views ?? 0),
              0,
            ),
            totalLikes: eligible.reduce(
              (sum, g) => sum + (g._sum.likes ?? 0),
              0,
            ),
          };
        };

        const formattedApplications = applications.map((app) => {
          const appPostGroups = postGroupsByApplication.get(app.id) ?? [];
          const { postsCount, eligiblePostsCount, totalViews, totalLikes } =
            summarizePosts(appPostGroups);
          const totalEarned = earningsMap.get(app.clipperProfileId) || 0;

          return {
            id: app.id,
            clipperProfileId: app.clipperProfileId,
            status: app.status,
            withdrawnAt: app.withdrawnAt?.toISOString() ?? null,
            clipperName: app.clipperProfile.fullName,
            clipperArtisticName: app.clipperProfile.artisticName,
            clipperImageUrl: app.clipperProfile.user?.imageUrl,
            clipperEmail: app.clipperProfile.user?.email,
            clipperPhone: app.clipperProfile.phone,
            clipperCpf: app.clipperProfile.cpf,
            clipperPixKey: app.clipperProfile.pixKey,
            clipperCity: app.clipperProfile.city,
            clipperState: app.clipperProfile.state,
            clanTag: app.clipperProfile.clan?.tag ?? null,
            clanEmoji: app.clipperProfile.clan?.emoji ?? null,
            clanEmojiColor: app.clipperProfile.clan?.emojiColor ?? null,
            postsCount,
            eligiblePostsCount,
            totalViews,
            totalLikes,
            totalEarned,
            createdAt: app.createdAt.toISOString(),
            approvedAt: app.approvedAt?.toISOString(),
            reviewedBy: app.reviewedBy,
            reviewNotes: app.reviewNotes,
            rejectionReason: app.rejectionReason,
            socialAccounts: app.socialAccounts.map((acc) => {
              // Contar posts desta conta nesta competição
              const accountPosts = summarizePosts(
                appPostGroups.filter(
                  (group) =>
                    group.username?.toLowerCase() ===
                      acc.socialAccount.username?.toLowerCase() &&
                    group.platform === acc.socialAccount.platform,
                ),
              );

              return {
                id: acc.socialAccount.id,
                platform: acc.socialAccount.platform,
                username: acc.socialAccount.username,
                profileUrl: acc.socialAccount.profileUrl,
                isPrimary: acc.socialAccount.isPrimary,
                isVerified: acc.socialAccount.isVerified,
                followers: acc.socialAccount.followers,
                postsCount: accountPosts.postsCount,
                eligiblePostsCount: accountPosts.eligiblePostsCount,
                totalViews: accountPosts.totalViews,
              };
            }),
          };
        });

        return {
          applications: formattedApplications,
          pagination: {
            page: input.page,
            pageSize: input.pageSize,
            totalCount: listMatchCount,
            totalPages: Math.ceil(listMatchCount / input.pageSize) || 0,
            hasNextPage:
              input.page < Math.ceil(listMatchCount / input.pageSize),
            hasPreviousPage: input.page > 1,
          },
          pendingCount,
          approvedCount,
          totalCount,
        };
      } catch (error: any) {
        console.error("Erro ao buscar aplicações da competição:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao buscar aplicações",
        });
      }
    }),

  // ============================================================================
  // DADOS DE GRÁFICOS DA COMPETIÇÃO (lazy loading)
  // ============================================================================
  getCompetitionChartsAdmin: adminProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const campaign = await ctx.db.campaign.findUnique({
          where: { slug: input.slug },
          select: {
            id: true,
            startDate: true,
            endDate: true,
          },
        });

        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Competição não encontrada",
          });
        }

        // Per-platform cumulative growth (same style as admin dashboard)
        const growthStartDate = new Date(campaign.startDate);
        growthStartDate.setHours(0, 0, 0, 0);
        const nowDate = new Date();
        const growthEndDate =
          campaign.endDate < nowDate ? new Date(campaign.endDate) : nowDate;
        growthEndDate.setHours(23, 59, 59, 999);

        const toLocalDateStr = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const todayStr = toLocalDateStr(new Date());

        // Os dias são agrupados no fuso do processo (o mesmo de toLocalDateStr),
        // para manter o agrupamento que antes era feito em JS post a post.
        const localTimeZone =
          Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

        // Distribuição por plataforma (também dá os totais do último ponto) e
        // views dos posts criados no período, somadas por dia e plataforma.
        const [platformStats, postsInRangeByDay] = await Promise.all([
          ctx.db.clipPost.groupBy({
            by: ["platform"],
            where: {
              campaignId: campaign.id,
              status: "ELIGIBLE",
            },
            _sum: {
              views: true,
              likes: true,
              comments: true,
              shares: true,
              saves: true,
            },
            _count: {
              id: true,
            },
          }),
          ctx.db.$queryRaw<
            Array<{ day: string; platform: Platform; views: bigint }>
          >`
            SELECT
              to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${localTimeZone}, 'YYYY-MM-DD') AS day,
              platform,
              COALESCE(SUM(views), 0)::bigint AS views
            FROM "ClipPost"
            WHERE "campaignId" = ${campaign.id}
              AND status = 'ELIGIBLE'
              AND "createdAt" >= ${growthStartDate}::timestamp
              AND "createdAt" <= ${growthEndDate}::timestamp
            GROUP BY 1, 2
          `,
        ]);

        const platformDistribution = platformStats.map((stat) => ({
          platform: stat.platform,
          posts: stat._count.id,
          views: Number(stat._sum.views || 0),
          likes: stat._sum.likes || 0,
          comments: stat._sum.comments || 0,
          shares: stat._sum.shares || 0,
          saves: stat._sum.saves || 0,
        }));

        const growthPlatforms = platformStats.map((p) => p.platform).sort();

        const totalDaysRange = Math.ceil(
          (growthEndDate.getTime() - growthStartDate.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        const platformDayMap = new Map<string, Record<string, number>>();
        for (let i = 0; i < totalDaysRange; i++) {
          const d = new Date(growthStartDate);
          d.setDate(d.getDate() + i);
          const key = toLocalDateStr(d);
          if (key > todayStr) break;
          const row: Record<string, number> = { total: 0 };
          growthPlatforms.forEach((p) => (row[p] = 0));
          platformDayMap.set(key, row);
        }

        for (const dayRow of postsInRangeByDay) {
          const row = platformDayMap.get(dayRow.day);
          if (!row) continue;
          const views = Number(dayRow.views || 0);
          row.total = (row.total || 0) + views;
          row[dayRow.platform] = (row[dayRow.platform] || 0) + views;
        }

        const cumPlatformTotals: Record<string, number> = {};
        growthPlatforms.forEach((p) => (cumPlatformTotals[p] = 0));
        let cumPlatformTotal = 0;

        const platformGrowthData = Array.from(platformDayMap.entries()).map(
          ([date, row]) => {
            cumPlatformTotal += row.total || 0;
            const entry: Record<string, number | string> = {
              total: cumPlatformTotal,
            };
            for (const p of growthPlatforms) {
              cumPlatformTotals[p] =
                (cumPlatformTotals[p] || 0) + (row[p] || 0);
              entry[p] = cumPlatformTotals[p]!;
            }
            return { date, ...entry };
          },
        );

        // Ensure last data point reflects current real-time totals
        if (platformGrowthData.length > 0) {
          const lastEntry = platformGrowthData[
            platformGrowthData.length - 1
          ] as Record<string, number | string>;
          lastEntry.total = platformDistribution.reduce(
            (acc, p) => acc + p.views,
            0,
          );
          for (const p of platformDistribution) {
            lastEntry[p.platform] = p.views;
          }
        }

        return {
          platformDistribution,
          platformGrowthData,
          growthPlatforms,
        };
      } catch (error: any) {
        console.error("Erro ao buscar dados de gráficos:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao buscar dados de gráficos",
        });
      }
    }),

  // ============================================================================
  // EVOLUÇÃO DIÁRIA DE VIEWS (somente para a exportação em Excel)
  // ============================================================================
  getCompetitionGrowthExportAdmin: adminProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const campaign = await ctx.db.campaign.findUnique({
          where: { slug: input.slug },
          select: {
            id: true,
            startDate: true,
            endDate: true,
          },
        });

        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Competição não encontrada",
          });
        }

        // ============================================================================
        // CRESCIMENTO AO LONGO DO TEMPO — single query com generate_series
        // ============================================================================
        const growthData: Array<{
          date: string;
          views: number;
          viewsDelta: number;
        }> = [];

        const competitionStart = new Date(campaign.startDate);
        competitionStart.setUTCDate(competitionStart.getUTCDate() - 1);
        competitionStart.setUTCHours(0, 0, 0, 0);

        const competitionEnd = new Date(campaign.endDate);
        competitionEnd.setUTCDate(competitionEnd.getUTCDate() + 1);
        competitionEnd.setUTCHours(23, 59, 59, 999);

        const nowBR = new Date();
        nowBR.setUTCHours(23, 59, 59, 999);

        const effectiveEnd = competitionEnd > nowBR ? nowBR : competitionEnd;

        const daysDiff = Math.ceil(
          (effectiveEnd.getTime() - competitionStart.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        const totalDays = Math.min(daysDiff, 90);

        if (totalDays <= 0) {
          return { growthData };
        }

        // Último dia da série (inclusive)
        const lastDayEnd = new Date(competitionStart);
        lastDayEnd.setUTCDate(competitionStart.getUTCDate() + totalDays - 1);
        lastDayEnd.setUTCHours(23, 59, 59, 999);

        // Strategy: single DISTINCT ON (clipPostId, day) scan → group by day → ~90 rows.
        // Avoids the LATERAL que roda um full-scan por dia (lento com 10k+ posts).
        // runningMax em JS compensa posts sem métrica em dias intermediários.
        // Só lê views: o índice (clipPostId, collectedAt, views) cobre a consulta.
        type DailyTotalRow = {
          snap_day: Date;
          total_views: bigint;
        };

        const [totalStatsAgg, dailyTotals] = await Promise.all([
          // Total atual para ajuste do último ponto do gráfico
          ctx.db.clipPost.aggregate({
            where: { campaignId: campaign.id, status: "ELIGIBLE" },
            _sum: { views: true },
          }),
          ctx.db.$queryRaw<DailyTotalRow[]>`
            WITH per_post_day AS (
              SELECT DISTINCT ON (cpm."clipPostId", DATE_TRUNC('day', cpm."collectedAt" AT TIME ZONE 'UTC'))
                DATE_TRUNC('day', cpm."collectedAt" AT TIME ZONE 'UTC') AS snap_day,
                cpm."views"::bigint  AS views
              FROM "ClipPostMetrics" cpm
              INNER JOIN "ClipPost" cp ON cp."id" = cpm."clipPostId"
              WHERE cp."campaignId" = ${campaign.id}
                AND cp."status" = 'ELIGIBLE'
                AND cpm."collectedAt" >= ${competitionStart}
                AND cpm."collectedAt" <= ${lastDayEnd}
              ORDER BY
                cpm."clipPostId",
                DATE_TRUNC('day', cpm."collectedAt" AT TIME ZONE 'UTC'),
                cpm."collectedAt" DESC
            )
            SELECT
              snap_day,
              COALESCE(SUM(views), 0)::bigint AS total_views
            FROM per_post_day
            GROUP BY snap_day
            ORDER BY snap_day
          `,
        ]);
        const totalViews = Number(totalStatsAgg._sum.views || 0);

        // Build lookup map from date string → totals
        const dailyMap = new Map<string, number>();
        for (const row of dailyTotals) {
          const dayStr = row.snap_day.toISOString().split("T")[0]!;
          dailyMap.set(dayStr, Number(row.total_views));
        }

        // Generate day series and apply runningMax (compensates for forward-fill gaps)
        let runningMaxViews = 0;

        for (let i = 0; i < totalDays; i++) {
          const day = new Date(competitionStart);
          day.setUTCDate(competitionStart.getUTCDate() + i);
          const dayStr = day.toISOString().split("T")[0]!;

          const prevViews = runningMaxViews;

          const views = dailyMap.get(dayStr);
          if (views !== undefined) {
            runningMaxViews = Math.max(runningMaxViews, views);
          }

          growthData.push({
            date: dayStr,
            views: runningMaxViews,
            viewsDelta: runningMaxViews - prevViews,
          });
        }

        // Ajustar último ponto para bater com totalViews real
        const lastEntry = growthData[growthData.length - 1];
        if (lastEntry && lastEntry.views < totalViews) {
          lastEntry.viewsDelta += totalViews - lastEntry.views;
          lastEntry.views = totalViews;
        }

        return { growthData };
      } catch (error: any) {
        console.error("Erro ao buscar evolução diária:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao buscar evolução diária",
        });
      }
    }),

  // ============================================================================
  // POSTS PAGINADOS DA COMPETIÇÃO (para tab "Posts Recentes")
  // ============================================================================
  getCompetitionPostsAdmin: adminProcedure
    .input(
      z.object({
        slug: z.string(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(24),
        sortBy: z
          .enum([
            "recent",
            "views",
            "likes",
            "comments",
            "shares",
            "engagement",
          ])
          .default("recent"),
        status: z.string().optional(),
        platform: z.string().optional(),
        clipperSearch: z.string().optional(),
        accountSearch: z.string().optional(),
        linkSearch: z.string().optional(),
        postedAtFrom: z.string().datetime().optional(),
        postedAtTo: z.string().datetime().optional(),
        commentsDataFilter: z.enum(["all", "with", "without"]).default("all"),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const campaign = await ctx.db.campaign.findUnique({
          where: { slug: input.slug },
          select: { id: true },
        });

        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Competição não encontrada",
          });
        }

        // Filtros em SQL (mesma semântica dos filtros do Prisma de antes:
        // `contains` + insensitive = ILIKE '%valor%'). Assim a ordenação por
        // engajamento também roda no banco, com LIMIT/OFFSET.
        const conditions: Prisma.Sql[] = [
          Prisma.sql`cp."campaignId" = ${campaign.id}`,
        ];

        if (input.status && input.status !== "all") {
          conditions.push(
            Prisma.sql`cp.status = ${input.status}::"ClipPostStatus"`,
          );
        }

        if (input.platform && input.platform !== "all") {
          conditions.push(Prisma.sql`cp.platform = ${input.platform}::"Platform"`);
        }

        if (input.accountSearch) {
          conditions.push(
            Prisma.sql`cp.username ILIKE ${`%${input.accountSearch.replace("@", "")}%`}`,
          );
        }

        if (input.linkSearch) {
          conditions.push(
            Prisma.sql`cp."submittedUrl" ILIKE ${`%${input.linkSearch}%`}`,
          );
        }

        if (input.postedAtFrom) {
          conditions.push(
            Prisma.sql`cp."postedAt" >= ${new Date(input.postedAtFrom)}::timestamp`,
          );
        }

        if (input.postedAtTo) {
          conditions.push(
            Prisma.sql`cp."postedAt" <= ${new Date(input.postedAtTo)}::timestamp`,
          );
        }

        // Posts com/sem comentários detalhados (EXISTS pelo índice de clipPostId)
        if (input.commentsDataFilter !== "all") {
          const hasCommentsData = Prisma.sql`EXISTS (
            SELECT 1 FROM "ClipPostComment" cpc WHERE cpc."clipPostId" = cp.id
          )`;
          conditions.push(
            input.commentsDataFilter === "with"
              ? hasCommentsData
              : Prisma.sql`NOT ${hasCommentsData}`,
          );
        }

        // Se buscar por clipper, filtrar por aplicação
        if (input.clipperSearch) {
          const matchingApplications = await ctx.db.clipperApplication.findMany(
            {
              where: {
                campaignId: campaign.id,
                clipperProfile: {
                  OR: [
                    {
                      artisticName: {
                        contains: input.clipperSearch,
                        mode: "insensitive",
                      },
                    },
                    {
                      fullName: {
                        contains: input.clipperSearch,
                        mode: "insensitive",
                      },
                    },
                  ],
                },
              },
              select: { id: true },
            },
          );
          conditions.push(
            Prisma.sql`cp."applicationId" = ANY(${matchingApplications.map((a) => a.id)}::text[])`,
          );
        }

        const whereSql = Prisma.join(conditions, " AND ");

        // Determinar ordenação (id desempata para a paginação ser estável)
        let orderBySql: Prisma.Sql;
        switch (input.sortBy) {
          case "views":
            orderBySql = Prisma.sql`cp.views DESC, cp.id`;
            break;
          case "likes":
            orderBySql = Prisma.sql`cp.likes DESC, cp.id`;
            break;
          case "comments":
            orderBySql = Prisma.sql`cp.comments DESC, cp.id`;
            break;
          case "shares":
            orderBySql = Prisma.sql`cp.shares DESC, cp.id`;
            break;
          case "engagement":
            // Mesma conta de antes: (likes + comments + shares) / views, 0 sem views
            orderBySql = Prisma.sql`CASE WHEN cp.views > 0
              THEN (cp.likes::bigint + cp.comments + cp.shares)::float8 / cp.views::float8
              ELSE 0 END DESC, cp.id`;
            break;
          case "recent":
          default:
            orderBySql = Prisma.sql`cp."createdAt" DESC, cp.id`;
            break;
        }

        const skip = (input.page - 1) * input.pageSize;

        // Contagem e ids da página em paralelo
        const [countRows, pageRows] = await Promise.all([
          ctx.db.$queryRaw<[{ count: number }]>`
            SELECT COUNT(*)::int AS count FROM "ClipPost" cp WHERE ${whereSql}
          `,
          ctx.db.$queryRaw<Array<{ id: string }>>`
            SELECT cp.id FROM "ClipPost" cp
            WHERE ${whereSql}
            ORDER BY ${orderBySql}
            OFFSET ${skip} LIMIT ${input.pageSize}
          `,
        ]);
        const totalCount = countRows[0]?.count ?? 0;
        const pageIds = pageRows.map((row) => row.id);

        let posts: any[];
        if (pageIds.length === 0) {
          posts = [];
        } else {
          const idOrder = new Map(pageIds.map((id, i) => [id, i]));
          const pagePosts = await ctx.db.clipPost.findMany({
            where: { id: { in: pageIds } },
            select: {
              id: true,
              submittedUrl: true,
              platformVideoId: true,
              thumbnailUrl: true,
              platform: true,
              username: true,
              views: true,
              likes: true,
              comments: true,
              shares: true,
              postedAt: true,
              createdAt: true,
              status: true,
              ineligibilityReason: true,
              bucketVideo: {
                select: { status: true, publicUrl: true, errorMessage: true },
              },
              application: {
                select: {
                  clipperProfile: {
                    select: {
                      artisticName: true,
                      fullName: true,
                    },
                  },
                },
              },
            },
          });
          posts = pagePosts.sort(
            (a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0),
          );
        }

        const instagramVideoIdByPostId = new Map<string, string>();
        for (const post of posts) {
          if (post.platform !== "INSTAGRAM") continue;
          let videoId = post.platformVideoId;
          if (!videoId) {
            try {
              const parts = new URL(post.submittedUrl).pathname
                .split("/")
                .filter(Boolean);
              const typeIndex = parts.findIndex((part) =>
                ["p", "reel", "reels", "tv"].includes(part.toLowerCase()),
              );
              videoId = typeIndex >= 0 ? parts[typeIndex + 1] || null : null;
            } catch {
              videoId = null;
            }
          }
          if (videoId) instagramVideoIdByPostId.set(post.id, videoId);
        }
        const instagramVideoIds = [
          ...new Set(instagramVideoIdByPostId.values()),
        ];

        const instagramMedia =
          instagramVideoIds.length > 0
            ? await ctx.db.instagramMediaAnalytics.findMany({
                where: {
                  isVideo: true,
                  mediaUrl: { not: null },
                  OR: instagramVideoIds.map((videoId) => ({
                    permalink: { contains: videoId },
                  })),
                },
                orderBy: { date: "desc" },
                select: { permalink: true, mediaUrl: true },
              })
            : [];

        const instagramMediaByVideoId = new Map<string, string>();
        for (const media of instagramMedia) {
          if (!media.mediaUrl) continue;
          const matchingVideoId = instagramVideoIds.find((videoId) =>
            media.permalink.includes(videoId),
          );
          if (
            matchingVideoId &&
            !instagramMediaByVideoId.has(matchingVideoId)
          ) {
            instagramMediaByVideoId.set(matchingVideoId, media.mediaUrl);
          }
        }

        console.info("[InstagramPlayback] media resolution", {
          campaignId: campaign.id,
          instagramPosts: posts.filter((post) => post.platform === "INSTAGRAM")
            .length,
          shortcodesResolved: instagramVideoIdByPostId.size,
          syncedMediaRecords: instagramMedia.length,
          playableMediaResolved: instagramMediaByVideoId.size,
        });

        const formattedPosts = posts.map((post) => ({
          id: post.id,
          url: post.submittedUrl,
          videoUrl:
            (post.bucketVideo?.status === "SUCCEEDED"
              ? post.bucketVideo.publicUrl
              : null) ||
            instagramMediaByVideoId.get(
              instagramVideoIdByPostId.get(post.id) ?? "",
            ) ||
            null,
          videoPreparationStatus: post.bucketVideo?.status ?? null,
          videoPreparationError: post.bucketVideo?.errorMessage ?? null,
          thumbnail: post.thumbnailUrl,
          platform: post.platform,
          username: post.username || "",
          clipperName:
            post.application?.clipperProfile?.artisticName ||
            post.application?.clipperProfile?.fullName ||
            "Clipador",
          views: Number(post.views),
          likes: post.likes,
          comments: post.comments,
          commentsDataCount: input.commentsDataFilter === "with" ? 1 : 0,
          shares: post.shares,
          postedAt: post.postedAt?.toISOString() ?? null,
          createdAt: post.createdAt.toISOString(),
          status: post.status,
          ineligibilityReason:
            post.ineligibilityReason ||
            (post.status === "DISQUALIFIED"
              ? "Post desqualificado. Nenhum motivo detalhado foi registrado."
              : null),
        }));

        const totalPages = Math.ceil(totalCount / input.pageSize);

        return {
          posts: formattedPosts,
          pagination: {
            page: input.page,
            pageSize: input.pageSize,
            totalCount,
            totalPages,
            hasNextPage: input.page < totalPages,
            hasPreviousPage: input.page > 1,
          },
        };
      } catch (error: any) {
        console.error("Erro ao buscar posts paginados:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao buscar posts paginados",
        });
      }
    }),

  getPostComments: adminProcedure
    .input(
      z.object({
        postId: z.string(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(5).max(50).default(20),
        search: z.string().trim().max(120).optional(),
        sortBy: z
          .enum(["recent", "oldest", "likes", "replies"])
          .default("recent"),
        filter: z.enum(["all", "topLevel", "replies"]).default("all"),
        sentiment: z
          .enum(["all", "positive", "negative", "neutral"])
          .default("all"),
        grouped: z.boolean().default(true),
      }),
    )
    .query(async ({ ctx, input }) => {
      type CommentRow = {
        id: string;
        clipPostId: string;
        platform: string;
        platformCommentId: string;
        platformVideoId: string | null;
        parentCommentId: string | null;
        text: string;
        username: string | null;
        displayName: string | null;
        authorChannelId: string | null;
        createdAtPlatform: Date | null;
        likes: number | bigint | null;
        replyCount: number | bigint | null;
        source: string | null;
        lastSyncAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        parentId?: string | null;
        parentPlatformCommentId?: string | null;
        parentUsername?: string | null;
        parentDisplayName?: string | null;
        parentText?: string | null;
      };

      type SerializedComment = {
        id: string;
        clipPostId: string;
        platform: string;
        platformCommentId: string;
        platformVideoId: string | null;
        parentCommentId: string | null;
        text: string;
        username: string | null;
        displayName: string | null;
        authorChannelId: string | null;
        createdAtPlatform: string | null;
        likes: number;
        replyCount: number;
        source: string;
        lastSyncAt: string | null;
        createdAt: string;
        updatedAt: string;
        parentComment?: {
          id: string;
          platformCommentId: string | null;
          username: string | null;
          displayName: string | null;
          text: string | null;
        };
        replies?: SerializedComment[];
      };

      type CommentStatsRow = {
        storedTotal: number | bigint;
        topLevelTotal: number | bigint;
        repliesTotal: number | bigint;
        latestSyncAt: Date | null;
      };

      type CountRow = { total: number | bigint };
      type SourceRow = { name: string | null; count: number | bigint };

      const toNumber = (value: number | bigint | null | undefined) =>
        Number(value ?? 0);

      const commentSelectSql = Prisma.sql`
        c."id",
        c."clipPostId",
        c."platform"::text AS "platform",
        c."platformCommentId",
        c."platformVideoId",
        c."parentCommentId",
        c."text",
        c."username",
        c."displayName",
        c."authorChannelId",
        c."createdAtPlatform",
        c."likes",
        c."replyCount",
        c."source",
        c."lastSyncAt",
        c."createdAt",
        c."updatedAt",
        p."id" AS "parentId",
        p."platformCommentId" AS "parentPlatformCommentId",
        p."username" AS "parentUsername",
        p."displayName" AS "parentDisplayName",
        p."text" AS "parentText"
      `;

      const serializeComment = (
        comment: CommentRow & { replies?: CommentRow[] },
      ): SerializedComment => ({
        id: comment.id,
        clipPostId: comment.clipPostId,
        platform: comment.platform,
        platformCommentId: comment.platformCommentId,
        platformVideoId: comment.platformVideoId,
        parentCommentId: comment.parentCommentId,
        text: comment.text,
        username: comment.username,
        displayName: comment.displayName,
        authorChannelId: comment.authorChannelId,
        createdAtPlatform: comment.createdAtPlatform?.toISOString() ?? null,
        likes: toNumber(comment.likes),
        replyCount: toNumber(comment.replyCount),
        source: comment.source ?? "Sem fonte",
        lastSyncAt: comment.lastSyncAt?.toISOString() ?? null,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
        parentComment: comment.parentId
          ? {
              id: comment.parentId,
              platformCommentId: comment.parentPlatformCommentId ?? null,
              username: comment.parentUsername ?? null,
              displayName: comment.parentDisplayName ?? null,
              text: comment.parentText ?? null,
            }
          : undefined,
        replies: comment.replies?.map((reply) => serializeComment(reply)),
      });

      const post = await ctx.db.clipPost.findUnique({
        where: { id: input.postId },
        select: {
          id: true,
          comments: true,
          platform: true,
        },
      });

      if (!post) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Post não encontrado",
        });
      }

      const search = input.search?.trim();
      const searchSql = search
        ? Prisma.sql`
            AND (
              c."text" ILIKE ${`%${search}%`}
              OR COALESCE(c."username", '') ILIKE ${`%${search}%`}
              OR COALESCE(c."displayName", '') ILIKE ${`%${search}%`}
            )
          `
        : Prisma.empty;

      const baseFilterSql =
        input.filter === "topLevel"
          ? Prisma.sql`AND c."parentCommentId" IS NULL`
          : input.filter === "replies"
            ? Prisma.sql`AND c."parentCommentId" IS NOT NULL`
            : Prisma.empty;

      const sentimentFilterSql =
        input.sentiment === "all"
          ? Prisma.empty
          : Prisma.sql`
              AND (
                SELECT LOWER(analysis."sentiment")
                FROM "CommentAnalysisResult" analysis
                WHERE analysis."commentId" = c."id"
                ORDER BY analysis."analyzedAt" DESC
                LIMIT 1
              ) = ${input.sentiment}
            `;

      const orderBySql =
        input.sortBy === "oldest"
          ? Prisma.sql`c."createdAtPlatform" ASC NULLS LAST, c."createdAt" ASC`
          : input.sortBy === "likes"
            ? Prisma.sql`c."likes" DESC, c."createdAtPlatform" DESC NULLS LAST, c."createdAt" DESC`
            : input.sortBy === "replies"
              ? Prisma.sql`c."replyCount" DESC, c."createdAtPlatform" DESC NULLS LAST, c."createdAt" DESC`
              : Prisma.sql`c."createdAtPlatform" DESC NULLS LAST, c."createdAt" DESC`;

      const [stats] = await ctx.db.$queryRaw<CommentStatsRow[]>`
        SELECT
          COUNT(*)::bigint AS "storedTotal",
          COUNT(*) FILTER (WHERE c."parentCommentId" IS NULL)::bigint AS "topLevelTotal",
          COUNT(*) FILTER (WHERE c."parentCommentId" IS NOT NULL)::bigint AS "repliesTotal",
          MAX(c."lastSyncAt") AS "latestSyncAt"
        FROM "ClipPostComment" c
        WHERE c."clipPostId" = ${input.postId}
      `;

      const storedTotal = toNumber(stats?.storedTotal);
      const topLevelTotal = toNumber(stats?.topLevelTotal);
      const repliesTotal = toNumber(stats?.repliesTotal);
      const shouldGroup =
        input.grouped &&
        input.filter !== "replies" &&
        input.sentiment === "all" &&
        topLevelTotal > 0;
      const listFilterSql = shouldGroup
        ? Prisma.sql`AND c."parentCommentId" IS NULL`
        : baseFilterSql;
      const offset = (input.page - 1) * input.limit;

      const [sources, filteredCountRows, comments] = await Promise.all([
        ctx.db.$queryRaw<SourceRow[]>`
          SELECT c."source" AS "name", COUNT(*)::bigint AS "count"
          FROM "ClipPostComment" c
          WHERE c."clipPostId" = ${input.postId}
          GROUP BY c."source"
          ORDER BY COUNT(*) DESC
        `,
        ctx.db.$queryRaw<CountRow[]>`
          SELECT COUNT(*)::bigint AS "total"
          FROM "ClipPostComment" c
          WHERE c."clipPostId" = ${input.postId}
          ${listFilterSql}
          ${searchSql}
          ${sentimentFilterSql}
        `,
        ctx.db.$queryRaw<CommentRow[]>`
          SELECT ${commentSelectSql}
          FROM "ClipPostComment" c
          LEFT JOIN "ClipPostComment" p ON p."id" = c."parentCommentId"
          WHERE c."clipPostId" = ${input.postId}
          ${listFilterSql}
          ${searchSql}
          ${sentimentFilterSql}
          ORDER BY ${orderBySql}
          OFFSET ${offset}
          LIMIT ${input.limit}
        `,
      ]);

      let commentsWithReplies: Array<CommentRow & { replies?: CommentRow[] }> =
        comments;
      if (shouldGroup && comments.length > 0) {
        const parentIds = comments.map((comment) => comment.id);
        const replies = await ctx.db.$queryRaw<CommentRow[]>`
          SELECT ${commentSelectSql}
          FROM "ClipPostComment" c
          LEFT JOIN "ClipPostComment" p ON p."id" = c."parentCommentId"
          WHERE c."parentCommentId" IN (${Prisma.join(parentIds)})
          ORDER BY c."createdAtPlatform" ASC NULLS LAST, c."createdAt" ASC
        `;
        const repliesByParent = new Map<string, CommentRow[]>();
        for (const reply of replies) {
          if (!reply.parentCommentId) continue;
          const group = repliesByParent.get(reply.parentCommentId) ?? [];
          group.push(reply);
          repliesByParent.set(reply.parentCommentId, group);
        }
        commentsWithReplies = comments.map((comment) => ({
          ...comment,
          replies: repliesByParent.get(comment.id) ?? [],
        }));
      }

      const filteredTotal = toNumber(filteredCountRows[0]?.total);

      const supported = ["INSTAGRAM", "TIKTOK", "YOUTUBE"].includes(
        post.platform,
      );

      return {
        comments: commentsWithReplies.map(serializeComment),
        pagination: {
          page: input.page,
          limit: input.limit,
          total: filteredTotal,
          totalPages: Math.ceil(filteredTotal / input.limit),
        },
        stats: {
          platformComments: post.comments,
          storedTotal,
          topLevelTotal,
          repliesTotal,
          latestSyncAt: stats?.latestSyncAt?.toISOString() ?? null,
          sources: sources.map((source) => ({
            name: source.name ?? "Sem fonte",
            count: toNumber(source.count),
          })),
          isPartial: post.comments > storedTotal,
          supported,
        },
      };
    }),

  getPostCommentDetails: adminProcedure
    .input(z.object({ commentId: z.string() }))
    .query(async ({ ctx, input }) => {
      type CommentDetailsRow = {
        id: string;
        clipPostId: string;
        platform: string;
        platformCommentId: string;
        platformVideoId: string | null;
        parentCommentId: string | null;
        text: string;
        username: string | null;
        displayName: string | null;
        authorChannelId: string | null;
        createdAtPlatform: Date | null;
        likes: number | bigint | null;
        replyCount: number | bigint | null;
        source: string | null;
        raw: unknown;
        lastSyncAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        parentId: string | null;
        parentPlatformCommentId: string | null;
        parentUsername: string | null;
        parentDisplayName: string | null;
        parentText: string | null;
      };

      const toNumber = (value: number | bigint | null | undefined) =>
        Number(value ?? 0);

      const [comment] = await ctx.db.$queryRaw<CommentDetailsRow[]>`
        SELECT
          c."id",
          c."clipPostId",
          c."platform"::text AS "platform",
          c."platformCommentId",
          c."platformVideoId",
          c."parentCommentId",
          c."text",
          c."username",
          c."displayName",
          c."authorChannelId",
          c."createdAtPlatform",
          c."likes",
          c."replyCount",
          c."source",
          c."raw",
          c."lastSyncAt",
          c."createdAt",
          c."updatedAt",
          p."id" AS "parentId",
          p."platformCommentId" AS "parentPlatformCommentId",
          p."username" AS "parentUsername",
          p."displayName" AS "parentDisplayName",
          p."text" AS "parentText"
        FROM "ClipPostComment" c
        LEFT JOIN "ClipPostComment" p ON p."id" = c."parentCommentId"
        WHERE c."id" = ${input.commentId}
        LIMIT 1
      `;

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comentário não encontrado",
        });
      }

      return {
        ...comment,
        createdAtPlatform: comment.createdAtPlatform?.toISOString() ?? null,
        likes: toNumber(comment.likes),
        replyCount: toNumber(comment.replyCount),
        source: comment.source ?? "Sem fonte",
        lastSyncAt: comment.lastSyncAt?.toISOString() ?? null,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
        parentComment: comment.parentId
          ? {
              id: comment.parentId,
              platformCommentId: comment.parentPlatformCommentId,
              username: comment.parentUsername,
              displayName: comment.parentDisplayName,
              text: comment.parentText,
            }
          : undefined,
      };
    }),

  // ============================================================================
  // GESTÃO FINANCEIRA
  // ============================================================================

  // Processar pagamento para clipper
  processPayment: adminProcedure
    .input(
      z.object({
        clipperProfileId: z.string(),
        amount: z.number().positive("Valor deve ser positivo"),
        description: z.string().min(1, "Descrição é obrigatória"),
        type: z.enum(["PRIZE_CREDIT", "BONUS", "ADJUSTMENT"]),
        campaignId: z.string().optional(),
        position: z.number().int().positive().optional(),
        rankingType: z.enum(["daily", "monthly"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Buscar ou criar wallet, criar transação e atualizar saldo em operação atômica
        const { transaction, newBalance } = await ctx.db.$transaction(
          async (tx) => {
            let wallet = await tx.wallet.findUnique({
              where: { clipperProfileId: input.clipperProfileId },
            });

            if (!wallet) {
              wallet = await tx.wallet.create({
                data: {
                  clipperProfileId: input.clipperProfileId,
                  balance: 0,
                  totalEarned: 0,
                  totalWithdrawn: 0,
                  pendingWithdraw: 0,
                  currency: "BRL",
                  isActive: true,
                },
              });
            }

            const balanceBefore = wallet.balance;
            const balanceAfter = balanceBefore + input.amount;

            const txn = await tx.transaction.create({
              data: {
                walletId: wallet.id,
                type: input.type,
                status: "COMPLETED",
                amount: input.amount,
                balanceBefore,
                balanceAfter,
                description: input.description,
                campaignId: input.campaignId,
                rankingPosition: input.position,
                processedBy: ctx.userId,
                processedAt: new Date(),
              },
            });

            await tx.wallet.update({
              where: { id: wallet.id },
              data: {
                balance: { increment: input.amount },
                totalEarned: { increment: input.amount },
              },
            });

            await tx.auditLog.create({
              data: {
                userId: ctx.userId,
                action: "CREATE",
                entityType: "Transaction",
                entityId: txn.id,
                campaignId: input.campaignId,
                changes: {
                  action: "payment_processed",
                  clipperProfileId: input.clipperProfileId,
                  amount: input.amount,
                  type: input.type,
                  description: input.description,
                  previousBalance: balanceBefore,
                  newBalance: balanceAfter,
                  rankingPosition: input.position,
                  rankingType: input.rankingType,
                },
              },
            });

            return { transaction: txn, newBalance: balanceAfter };
          },
        );

        console.log(
          `✅ Pagamento processado: R$ ${input.amount} para clipper ${input.clipperProfileId}`,
        );
        console.log(
          `💳 Transaction ID: ${transaction.id}, Campaign ID: ${input.campaignId}, Position: ${input.position}`,
        );

        // Buscar informações do clipper para enviar email
        const clipperProfile = await ctx.db.clipperProfile.findUnique({
          where: { id: input.clipperProfileId },
          include: {
            user: {
              select: {
                email: true,
              },
            },
          },
        });

        // Buscar nome da campanha se fornecido
        let campaignName: string | undefined;
        if (input.campaignId) {
          const campaign = await ctx.db.campaign.findUnique({
            where: { id: input.campaignId },
            select: { name: true },
          });
          campaignName = campaign?.name;
        }

        // Enviar email de notificação de pagamento
        if (clipperProfile?.user?.email) {
          const emailHtml = getPaymentNotificationEmailTemplate(
            clipperProfile.fullName,
            input.amount,
            input.type,
            input.description,
            newBalance,
            campaignName,
            input.position,
            input.rankingType,
          );

          resend.emails
            .send({
              from: "ClipfyAI <noreply@league.clipfyai.com>",
              to: clipperProfile.user.email,
              subject: `🏆 Pagamento Recebido: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(input.amount)}`,
              html: emailHtml,
            })
            .then(() => {
              console.log(
                `✅ Email de pagamento enviado para ${clipperProfile.user?.email}`,
              );
            })
            .catch((error) => {
              console.error(`❌ Erro ao enviar email de pagamento:`, error);
            });
        }

        return {
          success: true,
          transaction,
          newBalance,
        };
      } catch (error: any) {
        console.error("Erro ao processar pagamento:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao processar pagamento",
        });
      }
    }),

  // Registrar PIX para clipper (deduz do saldo da competição)
  sendPixPayment: adminProcedure
    .input(
      z.object({
        clipperProfileId: z.string(),
        amount: z.number().positive("Valor deve ser positivo"),
        pixKey: z.string().min(1, "Chave PIX é obrigatória"),
        campaignId: z.string(),
        proofUrl: z.string().url("URL do comprovante é obrigatória"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Buscar informações da campanha
        const campaign = await ctx.db.campaign.findUnique({
          where: { id: input.campaignId },
          select: {
            id: true,
            name: true,
          },
        });

        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Competição não encontrada",
          });
        }

        // Verificar saldo, criar transação e debitar wallet em operação atômica
        const { transaction, newBalance } = await ctx.db.$transaction(
          async (tx) => {
            const wallet = await tx.wallet.findUnique({
              where: { clipperProfileId: input.clipperProfileId },
            });

            if (!wallet) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Carteira do clipper não encontrada",
              });
            }

            if (!wallet.isActive) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Carteira do clipper está bloqueada",
              });
            }

            if (wallet.balance < input.amount) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Saldo insuficiente",
              });
            }

            const balanceBefore = wallet.balance;
            const balanceAfter = balanceBefore - input.amount;

            const txn = await tx.transaction.create({
              data: {
                walletId: wallet.id,
                type: "WITHDRAWAL_COMPLETED",
                status: "COMPLETED",
                amount: -input.amount,
                balanceBefore,
                balanceAfter,
                description: `PIX registrado para ${input.pixKey} - ${campaign.name}`,
                campaignId: input.campaignId,
                withdrawalMethod: "PIX",
                withdrawalDetails: {
                  pixKey: input.pixKey,
                  proofUrl: input.proofUrl,
                  sentBy: ctx.userId,
                  sentAt: new Date().toISOString(),
                  campaignName: campaign.name,
                },
                proofUrls: [input.proofUrl],
                processedBy: ctx.userId,
                processedAt: new Date(),
              },
            });

            await tx.wallet.update({
              where: { id: wallet.id },
              data: {
                balance: { decrement: input.amount },
                totalWithdrawn: { increment: input.amount },
              },
            });

            await tx.auditLog.create({
              data: {
                userId: ctx.userId,
                action: "CREATE",
                entityType: "Transaction",
                entityId: txn.id,
                campaignId: input.campaignId,
                changes: {
                  action: "pix_registered",
                  clipperProfileId: input.clipperProfileId,
                  amount: input.amount,
                  pixKey: input.pixKey,
                  proofUrl: input.proofUrl,
                  campaignName: campaign.name,
                },
              },
            });

            return { transaction: txn, newBalance: balanceAfter };
          },
        );

        console.log(
          `✅ PIX registrado: R$ ${input.amount} para ${input.pixKey} (Clipper: ${input.clipperProfileId})`,
        );
        console.log(
          `💳 Transaction ID: ${transaction.id}, Campaign: ${campaign.name}`,
        );
        console.log(`📄 Comprovante: ${input.proofUrl}`);
        console.log(`💰 Novo saldo: R$ ${newBalance}`);

        // Buscar informações do clipper para enviar email e criar notificação
        const clipperProfile = await ctx.db.clipperProfile.findUnique({
          where: { id: input.clipperProfileId },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        });

        // Criar notificação para o clipper
        if (clipperProfile?.user) {
          await ctx.db.notification.create({
            data: {
              userId: clipperProfile.user.id,
              type: "METRICS_MILESTONE", // Usando tipo existente, pode criar novo se necessário
              channel: "IN_APP",
              title: "💰 PIX Recebido!",
              message: `Você recebeu R$ ${input.amount.toFixed(2)} da competição "${campaign.name}". O valor foi creditado em sua conta PIX.`,
              actionUrl: input.proofUrl, // Link para ver o comprovante
              metadata: {
                transactionId: transaction.id,
                amount: input.amount,
                pixKey: input.pixKey,
                campaignName: campaign.name,
                proofUrl: input.proofUrl,
              },
              campaignId: input.campaignId,
              sentAt: new Date(),
            },
          });
          console.log(
            `🔔 Notificação criada para ${clipperProfile.user.email}`,
          );
        }

        // Enviar email de notificação de PIX
        if (clipperProfile?.user?.email) {
          const emailHtml = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                  .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                  .amount { font-size: 32px; font-weight: bold; color: #22c55e; text-align: center; margin: 20px 0; }
                  .info-box { background: white; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; }
                  .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>💰 PIX Enviado!</h1>
                  </div>
                  <div class="content">
                    <p>Olá, <strong>${clipperProfile.fullName}</strong>!</p>
                    
                    <p>Acabamos de enviar um PIX para você! 🎉</p>
                    
                    <div class="amount">
                      ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(input.amount)}
                    </div>
                    
                    <div class="info-box">
                      <h3 style="margin-top: 0;">📋 Detalhes do Pagamento</h3>
                      <p><strong>Chave PIX:</strong> ${input.pixKey}</p>
                      <p><strong>Competição:</strong> ${campaign.name}</p>
                      <p><strong>Data:</strong> ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                      <p><strong>Comprovante:</strong> <a href="${input.proofUrl}" target="_blank" style="color: #667eea;">Ver comprovante</a></p>
                    </div>
                    
                    <p>O valor deve aparecer em sua conta em instantes.</p>
                    
                    <p style="margin-top: 30px;">Continue mandando bem! 🚀</p>
                    
                    <div class="footer">
                      <p>ClipfyAI - Plataforma de Competições de Cortes</p>
                      <p>Este é um email automático, não responda.</p>
                    </div>
                  </div>
                </div>
              </body>
            </html>
          `;

          resend.emails
            .send({
              from: "ClipfyAI <noreply@league.clipfyai.com>",
              to: clipperProfile.user.email,
              subject: `💰 PIX Enviado: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(input.amount)}`,
              html: emailHtml,
            })
            .then(() => {
              console.log(
                `✅ Email de PIX enviado para ${clipperProfile.user?.email}`,
              );
            })
            .catch((error) => {
              console.error(`❌ Erro ao enviar email de PIX:`, error);
            });
        }

        return {
          success: true,
          transaction,
        };
      } catch (error: any) {
        console.error("Erro ao enviar PIX:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao enviar PIX",
        });
      }
    }),

  // Atualizar chave PIX do clipador
  updateClipperPixKey: adminProcedure
    .input(
      z.object({
        clipperProfileId: z.string(),
        pixKey: z.string().min(1, "Chave PIX é obrigatória"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const clipperProfile = await ctx.db.clipperProfile.findUnique({
          where: { id: input.clipperProfileId },
          select: { id: true, fullName: true, pixKey: true },
        });

        if (!clipperProfile) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Clipador não encontrado",
          });
        }

        const oldPixKey = clipperProfile.pixKey;

        const updated = await ctx.db.clipperProfile.update({
          where: { id: input.clipperProfileId },
          data: { pixKey: input.pixKey },
          select: { id: true, pixKey: true, fullName: true },
        });

        console.log(
          `🔑 Chave PIX atualizada pelo admin ${ctx.userId}: ${clipperProfile.fullName} | "${oldPixKey}" -> "${input.pixKey}"`,
        );

        return {
          success: true,
          clipperProfile: updated,
        };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao atualizar chave PIX",
        });
      }
    }),

  getAllSocialAccounts: adminProcedure
    .input(
      z
        .object({
          platform: z
            .enum(["INSTAGRAM", "TIKTOK", "YOUTUBE", "KWAI", "FACEBOOK"])
            .optional(),
          search: z.string().optional(),
          isActive: z.boolean().optional(),
          niche: z.string().optional(),
          page: z.number().min(1).default(1),
          perPage: z.number().min(1).max(100).default(30),
          sortBy: z
            .enum([
              "newest",
              "oldest",
              "followers_desc",
              "followers_asc",
              "totalViews_desc",
              "totalPosts_desc",
            ])
            .default("newest"),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const page = input?.page ?? 1;
      const perPage = input?.perPage ?? 30;
      const sortBy = input?.sortBy ?? "newest";

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      if (input?.platform) {
        conditions.push(`sa."platform"::text = $${paramIdx}`);
        params.push(input.platform);
        paramIdx++;
      }
      if (input?.isActive !== undefined) {
        conditions.push(`sa."isActive" = $${paramIdx}`);
        params.push(input.isActive);
        paramIdx++;
      }
      if (input?.niche) {
        conditions.push(`sa."niche"::text = $${paramIdx}`);
        params.push(input.niche);
        paramIdx++;
      }
      if (input?.search) {
        conditions.push(`(
          sa."username" ILIKE $${paramIdx}
          OR cp."fullName" ILIKE $${paramIdx}
          OR cp."artisticName" ILIKE $${paramIdx}
        )`);
        params.push(`%${input.search}%`);
        paramIdx++;
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const orderByMap: Record<string, string> = {
        newest: `sa."createdAt" DESC, sa."id" DESC`,
        oldest: `sa."createdAt" ASC, sa."id" ASC`,
        followers_desc: `sa."followers" DESC NULLS LAST, sa."createdAt" DESC, sa."id" DESC`,
        followers_asc: `sa."followers" ASC NULLS LAST, sa."createdAt" DESC, sa."id" DESC`,
      };
      const statsSortKey =
        sortBy === "totalViews_desc"
          ? "totalViews"
          : sortBy === "totalPosts_desc"
            ? "totalPosts"
            : null;

      const filterParams = params.slice(0, paramIdx - 1);
      const accountColumnsSql = `
          sa.id,
          sa.platform::text as platform,
          sa.username,
          sa."profileUrl",
          sa.niche::text as niche,
          sa."isPrimary",
          sa."isActive",
          sa.followers,
          sa."avgViews",
          sa."avgEngagementRate",
          sa."createdAt",
          sa."clipperProfileId",
          cp.id as "cpId",
          cp."fullName",
          cp."artisticName",
          cp."verificationStatus"::text as "verificationStatus",
          u."imageUrl"`;
      const accountFromSql = `
        FROM "SocialAccount" sa
        JOIN "ClipperProfile" cp ON sa."clipperProfileId" = cp.id
        JOIN "User" u ON cp."userId" = u.id`;

      const countPromise = ctx.db
        .$queryRawUnsafe<[{ count: bigint }]>(
          `SELECT COUNT(sa.id)::bigint as count
         FROM "SocialAccount" sa
         JOIN "ClipperProfile" cp ON sa."clipperProfileId" = cp.id
         ${whereClause}`,
          ...filterParams,
        )
        .then((result) => Number(result[0]?.count ?? 0));

      let totalCount: number;
      let rawAccounts: any[];
      let accountStats: Map<string, SocialAccountPostStats>;

      if (statsSortKey) {
        // Ordenação pelas estatísticas: usa o mapa de todas as contas (cache de
        // 5 min) e ordena em memória os ids filtrados; só a página é lida.
        const [count, filteredIds, allStats] = await Promise.all([
          countPromise,
          ctx.db.$queryRawUnsafe<Array<{ id: string }>>(
            `SELECT sa.id ${accountFromSql}
        ${whereClause}
        ORDER BY sa."createdAt" DESC, sa."id" DESC`,
            ...filterParams,
          ),
          getCachedSocialAccountPostStats(ctx.db),
        ]);
        const statValue = (id: string) =>
          allStats.get(id)?.[statsSortKey] ?? 0;
        const pageIds = filteredIds
          .map((row) => row.id)
          .sort((a, b) => statValue(b) - statValue(a))
          .slice((page - 1) * perPage, page * perPage);
        const pageRows =
          pageIds.length > 0
            ? await ctx.db.$queryRaw<any[]>`
                SELECT ${Prisma.raw(accountColumnsSql)} ${Prisma.raw(accountFromSql)}
                WHERE sa.id = ANY(${pageIds})`
            : [];
        const rowsById = new Map(pageRows.map((row) => [row.id as string, row]));
        totalCount = count;
        rawAccounts = pageIds
          .map((id) => rowsById.get(id))
          .filter((row) => row !== undefined);
        accountStats = allStats;
      } else {
        const orderBy = orderByMap[sortBy] ?? `sa."createdAt" DESC`;
        const offsetParam = `$${paramIdx}`;
        const limitParam = `$${paramIdx + 1}`;
        params.push((page - 1) * perPage, perPage);

        const [count, pageRows] = await Promise.all([
          countPromise,
          ctx.db.$queryRawUnsafe<any[]>(
            `SELECT ${accountColumnsSql} ${accountFromSql}
        ${whereClause}
        ORDER BY ${orderBy}
        OFFSET ${offsetParam} LIMIT ${limitParam}`,
            ...params,
          ),
        ]);
        totalCount = count;
        rawAccounts = pageRows;
        // Estatísticas apenas das contas da página
        accountStats = await loadSocialAccountPostStats(
          ctx.db,
          pageRows.map((row) => row.id as string),
        );
      }

      const accounts = rawAccounts.map((r) => ({
        id: r.id as string,
        platform: r.platform as string,
        username: r.username as string,
        profileUrl: r.profileUrl as string | null,
        niche: r.niche as string | null,
        isPrimary: r.isPrimary as boolean,
        isActive: r.isActive as boolean,
        followers: r.followers as number | null,
        avgViews: r.avgViews as number | null,
        avgEngagementRate: r.avgEngagementRate as number | null,
        createdAt: r.createdAt as Date,
        clipperProfileId: r.clipperProfileId as string,
        clipperProfile: {
          id: r.cpId as string,
          fullName: r.fullName as string | null,
          artisticName: r.artisticName as string | null,
          verificationStatus: r.verificationStatus as string,
          user: { imageUrl: r.imageUrl as string | null },
        },
        totalPosts: accountStats.get(r.id as string)?.totalPosts ?? 0,
        totalViews: accountStats.get(r.id as string)?.totalViews ?? 0,
      }));

      return {
        accounts,
        totalCount,
        page,
        perPage,
        totalPages: Math.ceil(totalCount / perPage),
      };
    }),

  // Igual para todos os admins e caro (agrega todos os posts elegíveis):
  // reaproveitado por 5 minutos.
  getSocialAccountsStats: adminProcedure.query(({ ctx }) =>
    cachedQuery("admin:social-accounts-stats", 5 * 60_000, async () => {
      const [accountTotals, platformCounts, nicheCounts, clipPostAgg] =
        await Promise.all([
          ctx.db.$queryRaw<
            [
              {
                totalAccounts: number;
                activeAccounts: number;
                inactiveAccounts: number;
                accountsWithViews: number;
                accountsWithFollowers: number;
                viewsSum: bigint | null;
                viewsAvg: number | null;
                viewsMax: number | null;
                followersSum: bigint | null;
                followersAvg: number | null;
                followersMax: number | null;
              },
            ]
          >`
            SELECT
              COUNT(*)::int AS "totalAccounts",
              COUNT(*) FILTER (WHERE "isActive" = true)::int AS "activeAccounts",
              COUNT(*) FILTER (WHERE "isActive" = false)::int AS "inactiveAccounts",
              COUNT(*) FILTER (WHERE "avgViews" > 0)::int AS "accountsWithViews",
              COUNT(*) FILTER (WHERE "followers" > 0)::int AS "accountsWithFollowers",
              SUM("avgViews")::bigint AS "viewsSum",
              AVG("avgViews")::float8 AS "viewsAvg",
              MAX("avgViews") AS "viewsMax",
              SUM("followers")::bigint AS "followersSum",
              AVG("followers")::float8 AS "followersAvg",
              MAX("followers") AS "followersMax"
            FROM "SocialAccount"
          `,
          ctx.db.socialAccount.groupBy({
            by: ["platform"],
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
          }),
          ctx.db.socialAccount.groupBy({
            by: ["niche"],
            _count: { id: true },
            _sum: { avgViews: true, followers: true },
            _avg: { avgViews: true, followers: true },
            orderBy: { _count: { id: "desc" } },
          }),
          ctx.db.$queryRaw<
            [
              {
                total_posts: bigint;
                total_views: bigint;
                clippers_with_posts: bigint;
              },
            ]
          >`
          SELECT
            COUNT(cp.id)::bigint as total_posts,
            COALESCE(SUM(cp.views), 0)::bigint as total_views,
            COUNT(DISTINCT ca."clipperProfileId")::bigint as clippers_with_posts
          FROM "ClipPost" cp
          JOIN "ClipperApplication" ca ON cp."applicationId" = ca.id
          WHERE cp."status" = 'ELIGIBLE'
        `,
        ]);

      const totals = accountTotals[0];
      const postData = clipPostAgg[0] ?? {
        total_posts: BigInt(0),
        total_views: BigInt(0),
        clippers_with_posts: BigInt(0),
      };

      return {
        totalAccounts: totals.totalAccounts,
        activeAccounts: totals.activeAccounts,
        inactiveAccounts: totals.inactiveAccounts,
        platformCounts: platformCounts.map((p) => ({
          platform: p.platform,
          count: p._count.id,
        })),
        nicheCounts: nicheCounts.map((n) => ({
          niche: n.niche,
          count: n._count.id,
          totalViews: n._sum.avgViews ?? 0,
          totalFollowers: n._sum.followers ?? 0,
          avgViews: Math.round(n._avg.avgViews ?? 0),
          avgFollowers: Math.round(n._avg.followers ?? 0),
        })),
        viewsStats: {
          total: Number(totals.viewsSum ?? 0),
          average: Math.round(totals.viewsAvg ?? 0),
          max: totals.viewsMax ?? 0,
          accountsWithData: totals.accountsWithViews,
        },
        followersStats: {
          total: Number(totals.followersSum ?? 0),
          average: Math.round(totals.followersAvg ?? 0),
          max: totals.followersMax ?? 0,
          accountsWithData: totals.accountsWithFollowers,
        },
        clipPostStats: {
          totalPosts: Number(postData.total_posts),
          totalViews: Number(postData.total_views),
          clippersWithPosts: Number(postData.clippers_with_posts),
        },
      };
    }),
  ),

  updateClipperInfo: adminProcedure
    .input(
      z.object({
        clipperProfileId: z.string(),
        artisticName: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        pixKey: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const clipperProfile = await ctx.db.clipperProfile.findUnique({
        where: { id: input.clipperProfileId },
        select: {
          id: true,
          fullName: true,
          artisticName: true,
          phone: true,
          pixKey: true,
        },
      });
      if (!clipperProfile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clipador não encontrado",
        });
      }

      const data: Record<string, any> = {};
      if (input.artisticName !== undefined)
        data.artisticName = input.artisticName || null;
      if (input.phone !== undefined) data.phone = input.phone || null;
      if (input.pixKey !== undefined) data.pixKey = input.pixKey || null;

      const updated = await ctx.db.clipperProfile.update({
        where: { id: input.clipperProfileId },
        data,
        select: {
          id: true,
          artisticName: true,
          phone: true,
          pixKey: true,
          fullName: true,
        },
      });

      return { success: true, clipperProfile: updated };
    }),

  // ============================================================================
  // GESTÃO DE CLIP POSTS
  // ============================================================================

  // Buscar aplicações elegíveis para trocar o post de competição
  getClipPostReassignmentTargets: adminProcedure
    .input(
      z.object({
        clipPostId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const clipPost = await ctx.db.clipPost.findUnique({
          where: { id: input.clipPostId },
          include: {
            campaign: {
              select: {
                id: true,
                name: true,
              },
            },
            application: {
              select: {
                id: true,
                clipperProfileId: true,
                clipperProfile: {
                  select: {
                    fullName: true,
                    artisticName: true,
                  },
                },
              },
            },
          },
        });

        if (!clipPost) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Post não encontrado",
          });
        }

        const applications = await ctx.db.clipperApplication.findMany({
          where: {
            clipperProfileId: clipPost.application.clipperProfileId,
          },
          select: {
            id: true,
            campaignId: true,
            status: true,
            createdAt: true,
            approvedAt: true,
            campaign: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        const currentApplication =
          applications.find((app) => app.id === clipPost.applicationId) || null;
        const targetApplications = applications
          .filter((app) => app.id !== clipPost.applicationId)
          .map((app) => ({
            id: app.id,
            campaignId: app.campaignId,
            campaignName: app.campaign.name,
            campaignSlug: app.campaign.slug,
            campaignStatus: app.campaign.status,
            applicationStatus: app.status,
            createdAt: app.createdAt.toISOString(),
            approvedAt: app.approvedAt?.toISOString() || null,
          }));

        return {
          clipPost: {
            id: clipPost.id,
            platform: clipPost.platform,
            submittedUrl: clipPost.submittedUrl,
            clipperName:
              clipPost.application.clipperProfile.artisticName ||
              clipPost.application.clipperProfile.fullName ||
              "Clipador",
            currentCampaignId: clipPost.campaignId,
            currentCampaignName: clipPost.campaign.name,
          },
          currentApplication: currentApplication
            ? {
                id: currentApplication.id,
                campaignId: currentApplication.campaignId,
                campaignName: currentApplication.campaign.name,
                campaignSlug: currentApplication.campaign.slug,
                campaignStatus: currentApplication.campaign.status,
                applicationStatus: currentApplication.status,
              }
            : null,
          targetApplications,
        };
      } catch (error: any) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error.message || "Erro ao buscar destinos para troca de competição",
        });
      }
    }),

  // Trocar o vínculo de um ClipPost para outra aplicação/competição
  reassignClipPostCompetition: adminProcedure
    .input(
      z.object({
        clipPostId: z.string(),
        targetApplicationId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await ctx.db.$transaction(async (tx) => {
          const clipPost = await tx.clipPost.findUnique({
            where: { id: input.clipPostId },
            include: {
              campaign: {
                select: {
                  id: true,
                  name: true,
                },
              },
              application: {
                select: {
                  id: true,
                  clipperProfileId: true,
                },
              },
            },
          });

          if (!clipPost) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Post não encontrado",
            });
          }

          const targetApplication = await tx.clipperApplication.findUnique({
            where: { id: input.targetApplicationId },
            include: {
              campaign: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          });

          if (!targetApplication) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Aplicação de destino não encontrada",
            });
          }

          if (targetApplication.id === clipPost.applicationId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "O post já está vinculado a esta aplicação",
            });
          }

          if (
            targetApplication.clipperProfileId !==
            clipPost.application.clipperProfileId
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "A aplicação de destino pertence a outro clipador",
            });
          }

          if (clipPost.platformVideoId) {
            const duplicateInTarget = await tx.clipPost.findFirst({
              where: {
                campaignId: targetApplication.campaignId,
                platform: clipPost.platform,
                platformVideoId: clipPost.platformVideoId,
                id: {
                  not: clipPost.id,
                },
              },
              select: { id: true },
            });

            if (duplicateInTarget) {
              throw new TRPCError({
                code: "CONFLICT",
                message:
                  "Já existe um vídeo com este ID/plataforma na competição de destino",
              });
            }
          }

          const updated = await tx.clipPost.update({
            where: { id: clipPost.id },
            data: {
              campaignId: targetApplication.campaignId,
              applicationId: targetApplication.id,
              status: "ELIGIBLE",
              ineligibilityReason: null,
            },
          });

          await tx.auditLog.create({
            data: {
              userId: ctx.userId,
              action: "UPDATE",
              entityType: "ClipPost",
              entityId: updated.id,
              campaignId: targetApplication.campaignId,
              changes: {
                action: "clip_post_reassigned_competition",
                clipPostId: clipPost.id,
                previousCampaignId: clipPost.campaignId,
                previousCampaignName: clipPost.campaign.name,
                previousApplicationId: clipPost.applicationId,
                newCampaignId: targetApplication.campaignId,
                newCampaignName: targetApplication.campaign.name,
                newApplicationId: targetApplication.id,
                forcedStatus: "ELIGIBLE",
                ineligibilityReason: null,
              },
            },
          });

          return {
            clipPostId: clipPost.id,
            previousCampaignName: clipPost.campaign.name,
            newCampaignName: targetApplication.campaign.name,
          };
        });

        return {
          success: true,
          message: "Vídeo movido de competição com sucesso",
          ...result,
        };
      } catch (error: any) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao trocar vídeo de competição",
        });
      }
    }),

  // Atualizar status de ClipPost
  updateClipPostStatus: adminProcedure
    .input(
      z.object({
        clipPostId: z.string(),
        status: z.enum(["PENDING", "ELIGIBLE", "INELIGIBLE", "DISQUALIFIED"]),
        ineligibilityReason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Buscar o post
        const clipPost = await ctx.db.clipPost.findUnique({
          where: { id: input.clipPostId },
          include: {
            campaign: {
              select: {
                id: true,
                name: true,
              },
            },
            application: {
              include: {
                clipperProfile: {
                  select: {
                    fullName: true,
                  },
                },
              },
            },
          },
        });

        if (!clipPost) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Post não encontrado",
          });
        }

        // Atualizar status
        const updated = await ctx.db.clipPost.update({
          where: { id: input.clipPostId },
          data: {
            status: input.status,
            ineligibilityReason: input.ineligibilityReason || null,
          },
        });

        // Log de auditoria
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.userId,
            action: "UPDATE",
            entityType: "ClipPost",
            entityId: updated.id,
            campaignId: clipPost.campaignId,
            changes: {
              clipPostId: clipPost.id,
              clipperName: clipPost.application.clipperProfile.fullName,
              campaignName: clipPost.campaign.name,
              previousStatus: clipPost.status,
              newStatus: input.status,
              ineligibilityReason: input.ineligibilityReason,
            },
          },
        });

        console.log(
          `✅ Status do ClipPost ${clipPost.id} alterado de ${clipPost.status} para ${input.status}`,
        );

        return {
          success: true,
          message: "Status do post atualizado com sucesso!",
        };
      } catch (error: any) {
        console.error("Erro ao atualizar status do ClipPost:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao atualizar status do post",
        });
      }
    }),

  // Deletar ClipPost (com verificação dupla no frontend)
  deleteClipPost: adminProcedure
    .input(
      z.object({
        clipPostId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Buscar o post antes de deletar
        const clipPost = await ctx.db.clipPost.findUnique({
          where: { id: input.clipPostId },
          include: {
            campaign: {
              select: {
                id: true,
                name: true,
              },
            },
            application: {
              include: {
                clipperProfile: {
                  select: {
                    fullName: true,
                  },
                },
              },
            },
          },
        });

        if (!clipPost) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Post não encontrado",
          });
        }

        // Deletar o post (cascade vai deletar métricas e outras relações)
        await ctx.db.clipPost.delete({
          where: { id: input.clipPostId },
        });

        // Log de auditoria
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.userId,
            action: "DELETE",
            entityType: "ClipPost",
            entityId: clipPost.id,
            campaignId: clipPost.campaignId,
            changes: {
              action: "post_deleted",
              clipPostId: clipPost.id,
              clipperName: clipPost.application.clipperProfile.fullName,
              campaignName: clipPost.campaign.name,
              postUrl: clipPost.submittedUrl,
              platform: clipPost.platform,
              views: Number(clipPost.views),
              status: clipPost.status,
            },
          },
        });

        console.log(`🗑️ ClipPost deletado: ${clipPost.id} por ${ctx.userId}`);

        return {
          success: true,
          message: "Post deletado com sucesso!",
        };
      } catch (error: any) {
        console.error("Erro ao deletar ClipPost:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao deletar post",
        });
      }
    }),

  // Deletar vários ClipPosts de uma vez. A confirmação é feita no frontend,
  // enquanto esta mutation garante que todos os IDs existem antes de apagar.
  deleteClipPostsBulk: adminProcedure
    .input(
      z.object({
        clipPostIds: z
          .array(z.string())
          .min(1, "Selecione ao menos um post")
          .max(100, "É possível excluir no máximo 100 posts por vez")
          .refine(
            (ids) => new Set(ids).size === ids.length,
            "A lista de posts contém itens duplicados",
          ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const clipPosts = await ctx.db.clipPost.findMany({
          where: { id: { in: input.clipPostIds } },
          include: {
            campaign: {
              select: {
                id: true,
                name: true,
              },
            },
            application: {
              include: {
                clipperProfile: {
                  select: {
                    fullName: true,
                  },
                },
              },
            },
          },
        });

        if (clipPosts.length !== input.clipPostIds.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Um ou mais posts selecionados não foram encontrados",
          });
        }

        await ctx.db.$transaction(async (tx) => {
          await tx.clipPost.deleteMany({
            where: { id: { in: input.clipPostIds } },
          });

          await tx.auditLog.createMany({
            data: clipPosts.map((clipPost) => ({
              userId: ctx.userId,
              action: "DELETE",
              entityType: "ClipPost",
              entityId: clipPost.id,
              campaignId: clipPost.campaignId,
              changes: {
                action: "post_deleted",
                clipPostId: clipPost.id,
                clipperName: clipPost.application.clipperProfile.fullName,
                campaignName: clipPost.campaign.name,
                postUrl: clipPost.submittedUrl,
                platform: clipPost.platform,
                views: Number(clipPost.views),
                status: clipPost.status,
                bulkDelete: true,
              },
            })),
          });
        });

        console.log(
          `🗑️ ${clipPosts.length} ClipPosts deletados em lote por ${ctx.userId}`,
        );

        return {
          success: true,
          deletedCount: clipPosts.length,
          message: `${clipPosts.length} posts deletados com sucesso!`,
        };
      } catch (error: any) {
        console.error("Erro ao deletar ClipPosts em lote:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao deletar posts selecionados",
        });
      }
    }),

  // Buscar TODAS as transações de um clipper (não apenas desta campanha)
  getClipperAllTransactions: adminProcedure
    .input(
      z.object({
        clipperProfileId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Buscar wallet do clipper
        const wallet = await ctx.db.wallet.findUnique({
          where: { clipperProfileId: input.clipperProfileId },
        });

        if (!wallet) {
          return {
            transactions: [],
            totalEarned: 0,
            totalCount: 0,
            walletBalance: 0,
          };
        }

        // Buscar TODAS as transações
        const transactions = await ctx.db.transaction.findMany({
          where: {
            walletId: wallet.id,
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            type: true,
            status: true,
            amount: true,
            description: true,
            rankingPosition: true,
            campaignId: true,
            createdAt: true,
            processedAt: true,
            processedBy: true,
          },
        });

        // Calcular total ganho (apenas créditos completados)
        const totalEarned = transactions
          .filter(
            (t) =>
              t.status === "COMPLETED" &&
              ["PRIZE_CREDIT", "BONUS", "ADJUSTMENT"].includes(t.type),
          )
          .reduce((sum, t) => sum + Number(t.amount), 0);

        console.log(
          `📊 Buscadas ${transactions.length} transações TOTAIS para clipper ${input.clipperProfileId}`,
        );

        return {
          transactions,
          totalEarned,
          totalCount: transactions.length,
          walletBalance: wallet.balance,
        };
      } catch (error: any) {
        console.error("Erro ao buscar transações do clipper:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao buscar transações",
        });
      }
    }),

  // Buscar transações de um clipper em uma campanha específica
  getClipperTransactionsInCampaign: adminProcedure
    .input(
      z.object({
        clipperProfileId: z.string(),
        campaignId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Buscar wallet do clipper
        const wallet = await ctx.db.wallet.findUnique({
          where: { clipperProfileId: input.clipperProfileId },
        });

        if (!wallet) {
          return {
            transactions: [],
            totalEarned: 0,
            totalCount: 0,
          };
        }

        // Buscar transações desta campanha
        const transactions = await ctx.db.transaction.findMany({
          where: {
            walletId: wallet.id,
            campaignId: input.campaignId,
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            type: true,
            status: true,
            amount: true,
            description: true,
            rankingPosition: true,
            createdAt: true,
            processedAt: true,
            processedBy: true,
          },
        });

        // Calcular total ganho (apenas créditos completados)
        const totalEarned = transactions
          .filter(
            (t) =>
              t.status === "COMPLETED" &&
              ["PRIZE_CREDIT", "BONUS", "ADJUSTMENT"].includes(t.type),
          )
          .reduce((sum, t) => sum + Number(t.amount), 0);

        console.log(
          `📊 Buscadas ${transactions.length} transações para clipper ${input.clipperProfileId} na campanha ${input.campaignId}`,
        );

        return {
          transactions,
          totalEarned,
          totalCount: transactions.length,
        };
      } catch (error: any) {
        console.error("Erro ao buscar transações do clipper:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao buscar transações",
        });
      }
    }),

  // ============================================================================
  // POSTS - LISTAGEM GLOBAL
  // ============================================================================

  getAllPosts: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(24),
        platform: z
          .enum(["INSTAGRAM", "TIKTOK", "YOUTUBE", "KWAI", "FACEBOOK", "ALL"])
          .optional(),
        status: z
          .enum(["PENDING", "ELIGIBLE", "INELIGIBLE", "DISQUALIFIED", "ALL"])
          .optional(),
        campaignId: z.string().optional(),
        search: z.string().optional(), // Buscar por username
        orderBy: z
          .enum(["views", "likes", "comments", "shares", "createdAt"])
          .default("views"),
        orderDirection: z.enum(["asc", "desc"]).default("desc"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const {
        page,
        limit,
        platform,
        status,
        campaignId,
        search,
        orderBy,
        orderDirection,
      } = input;
      const skip = (page - 1) * limit;

      const where: any = {};

      if (platform && platform !== "ALL") {
        where.platform = platform;
      }

      if (status && status !== "ALL") {
        where.status = status;
      }

      if (campaignId) {
        where.campaignId = campaignId;
      }

      if (search) {
        where.username = { contains: search, mode: "insensitive" as const };
      }

      const [posts, total, campaigns] = await Promise.all([
        ctx.db.clipPost.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            [orderBy]: orderDirection,
          },
          select: {
            id: true,
            submittedUrl: true,
            thumbnailUrl: true,
            platform: true,
            username: true,
            caption: true,
            views: true,
            likes: true,
            comments: true,
            shares: true,
            saves: true,
            postedAt: true,
            status: true,
            createdAt: true,
            campaign: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            application: {
              select: {
                clipperProfile: {
                  select: {
                    artisticName: true,
                    fullName: true,
                    user: {
                      select: {
                        imageUrl: true,
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        ctx.db.clipPost.count({ where }),
        ctx.db.campaign.findMany({
          select: {
            id: true,
            name: true,
            slug: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        }),
      ]);

      const formattedPosts = posts.map((post) => ({
        id: post.id,
        url: post.submittedUrl,
        thumbnail: post.thumbnailUrl,
        platform: post.platform,
        username: post.username || "",
        caption: post.caption || "",
        clipperName:
          post.application?.clipperProfile?.artisticName ||
          post.application?.clipperProfile?.fullName ||
          "Clipador",
        clipperImage: post.application?.clipperProfile?.user?.imageUrl || null,
        views: Number(post.views),
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        saves: post.saves ?? 0,
        postedAt: post.postedAt?.toISOString(),
        status: post.status,
        createdAt: post.createdAt.toISOString(),
        campaign: post.campaign,
      }));

      return {
        posts: formattedPosts,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        campaigns, // Lista de campanhas para o filtro
      };
    }),

  /** Histórico ClipPostMetrics (lista /posts admin) — mesmo payload que customers.getPostMetricsHistory. */
  getPostMetricsHistory: adminProcedure
    .input(z.object({ postId: z.string() }))
    .query(async ({ ctx, input }) => {
      const post = await ctx.db.clipPost.findUnique({
        where: { id: input.postId },
        select: {
          id: true,
          username: true,
          campaign: {
            select: {
              rankingMetricType: true,
              name: true,
            },
          },
        },
      });

      if (!post) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Post não encontrado",
        });
      }

      const metricType = post.campaign
        .rankingMetricType as RankingMetricTypeForScore;

      const rows = await ctx.db.clipPostMetrics.findMany({
        where: { clipPostId: input.postId },
        orderBy: { collectedAt: "asc" },
        select: {
          id: true,
          collectedAt: true,
          views: true,
          likes: true,
          comments: true,
          shares: true,
          saves: true,
          viewsDelta: true,
          likesDelta: true,
          commentsDelta: true,
          sharesDelta: true,
        },
      });

      const points = rows.map((m) => {
        const views = Number(m.views);
        const likes = m.likes;
        const comments = m.comments;
        const shares = m.shares;
        const saves = m.saves ?? 0;
        const engagementRate = calculateEngagementRate(
          views,
          likes,
          comments,
          shares,
          saves,
        );
        const rankingScore = calculateRankingScore(
          metricType,
          views,
          likes,
          comments,
          shares,
          saves,
        );
        return {
          id: m.id,
          collectedAt: m.collectedAt.toISOString(),
          views,
          likes,
          comments,
          shares,
          saves,
          engagementRate,
          rankingScore,
          viewsDelta: m.viewsDelta != null ? Number(m.viewsDelta) : null,
          likesDelta: m.likesDelta,
          commentsDelta: m.commentsDelta,
          sharesDelta: m.sharesDelta,
        };
      });

      return {
        metricType: post.campaign.rankingMetricType,
        campaignName: post.campaign.name,
        username: post.username || "",
        points,
      };
    }),

  // Alterar senha de um usuário no Clerk
  changeUserPassword: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        newPassword: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Buscar usuário no banco
        const user = await ctx.db.user.findUnique({
          where: { id: input.userId },
          select: {
            id: true,
            email: true,
            name: true,
          },
        });

        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Usuário não encontrado",
          });
        }

        // Atualizar senha no Clerk
        const clerk = await clerkClient();
        await clerk.users.updateUser(input.userId, {
          password: input.newPassword,
        });

        // Log de auditoria
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.userId,
            action: "UPDATE",
            entityType: "User",
            entityId: user.id,
            changes: {
              action: "password_changed",
              targetUser: {
                id: user.id,
                email: user.email,
                name: user.name,
              },
              changedBy: ctx.userId,
            },
          },
        });

        console.log(
          `✅ Senha alterada para usuário ${user.email} (${user.id}) por admin ${ctx.userId}`,
        );

        return {
          success: true,
          message: "Senha alterada com sucesso!",
        };
      } catch (error: any) {
        console.error("Erro ao alterar senha:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao alterar senha",
        });
      }
    }),

  // ============================================================================
  // FINANCEIRO GLOBAL — Visão geral de todas as competições
  // ============================================================================
  getGlobalFinancials: adminProcedure
    .input(
      z.object({
        period: z
          .enum(["all", "7d", "30d", "90d", "180d", "365d"])
          .default("all"),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const PERIOD_DAYS: Record<
          Exclude<typeof input.period, "all">,
          number
        > = {
          "7d": 7,
          "30d": 30,
          "90d": 90,
          "180d": 180,
          "365d": 365,
        };
        const DAY_MS = 24 * 60 * 60 * 1000;
        const dateFilter =
          input.period !== "all"
            ? {
                createdAt: {
                  gte: new Date(
                    Date.now() - PERIOD_DAYS[input.period] * DAY_MS,
                  ),
                },
              }
            : {};

        // Consultas independentes em paralelo
        const [
          campaigns,
          creditTransactions,
          pixTransactions,
          pendingWithdrawals,
          campaignPostTotals,
        ] = await Promise.all([
          // Buscar todas as competições
          ctx.db.campaign.findMany({
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              startDate: true,
              endDate: true,
              isPrivate: true,
            },
            orderBy: { createdAt: "desc" },
          }),

          // Buscar todas as transações de crédito (prêmios, bônus, ajustes)
          ctx.db.transaction.findMany({
            where: {
              type: { in: ["PRIZE_CREDIT", "BONUS", "ADJUSTMENT"] },
              status: "COMPLETED",
              ...dateFilter,
            },
            select: {
              id: true,
              type: true,
              amount: true,
              status: true,
              campaignId: true,
              rankingPosition: true,
              description: true,
              createdAt: true,
              wallet: {
                select: {
                  clipperProfile: {
                    select: {
                      id: true,
                      fullName: true,
                      artisticName: true,
                      user: { select: { email: true, imageUrl: true } },
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: "desc" },
          }),

          // Buscar todas as transações de PIX (saques completados)
          ctx.db.transaction.findMany({
            where: {
              type: "WITHDRAWAL_COMPLETED",
              status: "COMPLETED",
              ...dateFilter,
            },
            select: {
              id: true,
              type: true,
              amount: true,
              status: true,
              campaignId: true,
              description: true,
              createdAt: true,
              proofUrls: true,
              withdrawalDetails: true,
              wallet: {
                select: {
                  clipperProfile: {
                    select: {
                      id: true,
                      fullName: true,
                      artisticName: true,
                      pixKey: true,
                      cpf: true,
                      user: { select: { email: true, imageUrl: true } },
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: "desc" },
          }),

          // Buscar saques pendentes
          ctx.db.transaction.findMany({
            where: {
              type: { in: ["WITHDRAWAL_REQUEST", "WITHDRAWAL_APPROVED"] },
              status: { in: ["PENDING", "PROCESSING"] },
            },
            select: {
              id: true,
              amount: true,
              type: true,
              status: true,
              campaignId: true,
              description: true,
              createdAt: true,
              wallet: {
                select: {
                  clipperProfile: {
                    select: {
                      id: true,
                      fullName: true,
                      artisticName: true,
                      pixKey: true,
                      user: { select: { email: true, imageUrl: true } },
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: "desc" },
          }),

          // Total de views por competição (para CPM), agregação em cache curto
          getCachedCampaignPostTotals(ctx.db),
        ]);

        // === CÁLCULOS ===

        // Total creditado (prêmios + bônus + ajustes)
        const totalCredited = creditTransactions.reduce(
          (sum, tx) => sum + tx.amount,
          0,
        );
        const totalPrizes = creditTransactions
          .filter((tx) => tx.type === "PRIZE_CREDIT")
          .reduce((sum, tx) => sum + tx.amount, 0);
        const totalBonuses = creditTransactions
          .filter((tx) => tx.type === "BONUS")
          .reduce((sum, tx) => sum + tx.amount, 0);
        const totalAdjustments = creditTransactions
          .filter((tx) => tx.type === "ADJUSTMENT")
          .reduce((sum, tx) => sum + tx.amount, 0);

        // Total pago via PIX
        const totalPaidPix = pixTransactions.reduce(
          (sum, tx) => sum + Math.abs(tx.amount),
          0,
        );

        // Total pendente de pagamento
        const totalPendingAmount = pendingWithdrawals.reduce(
          (sum, tx) => sum + Math.abs(tx.amount),
          0,
        );

        // Saldo restante a pagar (creditado - pago)
        const totalRemainingToPay = Math.max(0, totalCredited - totalPaidPix);

        const viewsMap = new Map(
          Array.from(campaignPostTotals, ([campaignId, totals]) => [
            campaignId,
            { views: Number(totals._sum.views || 0), posts: totals._count.id },
          ]),
        );
        const campaignNameById = new Map(
          campaigns.map((campaign) => [campaign.id, campaign.name]),
        );

        // Transações agrupadas por competição em uma passada (mantém a ordem)
        const groupByCampaign = <T extends { campaignId: string | null }>(
          transactions: T[],
        ) => {
          const grouped = new Map<string, T[]>();
          for (const tx of transactions) {
            if (!tx.campaignId) continue;
            const current = grouped.get(tx.campaignId) ?? [];
            current.push(tx);
            grouped.set(tx.campaignId, current);
          }
          return grouped;
        };
        const creditsByCampaign = groupByCampaign(creditTransactions);
        const pixByCampaign = groupByCampaign(pixTransactions);

        // Agrupar por competição
        const campaignFinancials = campaigns
          .map((campaign) => {
            const campaignCredits = creditsByCampaign.get(campaign.id) ?? [];
            const campaignPix = pixByCampaign.get(campaign.id) ?? [];
            const credited = campaignCredits.reduce(
              (sum, tx) => sum + tx.amount,
              0,
            );
            const paid = campaignPix.reduce(
              (sum, tx) => sum + Math.abs(tx.amount),
              0,
            );
            const uniqueClippers = new Set(
              campaignCredits.map((tx) => tx.wallet.clipperProfile.id),
            ).size;
            const viewsData = viewsMap.get(campaign.id) || {
              views: 0,
              posts: 0,
            };
            // CPM = (total creditado / views) * 1000
            const cpm =
              viewsData.views > 0 ? (credited / viewsData.views) * 1000 : 0;

            return {
              ...campaign,
              totalCredited: credited,
              totalPaid: paid,
              remaining: Math.max(0, credited - paid),
              transactionCount: campaignCredits.length,
              clippersCount: uniqueClippers,
              totalViews: viewsData.views,
              totalPosts: viewsData.posts,
              cpm,
            };
          })
          .filter((c) => c.totalCredited > 0 || c.totalPaid > 0)
          .sort((a, b) => b.totalCredited - a.totalCredited);

        // Total global de views
        const globalViews = campaignFinancials.reduce(
          (sum, c) => sum + c.totalViews,
          0,
        );
        const globalCpm =
          globalViews > 0 ? (totalCredited / globalViews) * 1000 : 0;

        // Agrupar por clipador (top clipadores)
        const clipperMap = new Map<
          string,
          {
            id: string;
            fullName: string;
            artisticName: string | null;
            email: string;
            imageUrl: string | null;
            totalEarned: number;
            totalPaid: number;
            remaining: number;
            campaignCount: number;
          }
        >();

        creditTransactions.forEach((tx) => {
          const cp = tx.wallet.clipperProfile;
          const existing = clipperMap.get(cp.id);
          if (existing) {
            existing.totalEarned += tx.amount;
          } else {
            clipperMap.set(cp.id, {
              id: cp.id,
              fullName: cp.fullName,
              artisticName: cp.artisticName,
              email: cp.user?.email || "",
              imageUrl: cp.user?.imageUrl || null,
              totalEarned: tx.amount,
              totalPaid: 0,
              remaining: 0,
              campaignCount: 0,
            });
          }
        });

        pixTransactions.forEach((tx) => {
          const cp = tx.wallet.clipperProfile;
          const existing = clipperMap.get(cp.id);
          if (existing) {
            existing.totalPaid += Math.abs(tx.amount);
          } else {
            clipperMap.set(cp.id, {
              id: cp.id,
              fullName: cp.fullName,
              artisticName: cp.artisticName,
              email: cp.user?.email || "",
              imageUrl: cp.user?.imageUrl || null,
              totalEarned: 0,
              totalPaid: Math.abs(tx.amount),
              remaining: 0,
              campaignCount: 0,
            });
          }
        });

        // Contar competições por clipador (uma passada pelos créditos)
        const campaignsByClipper = new Map<string, Set<string>>();
        for (const tx of creditTransactions) {
          if (!tx.campaignId) continue;
          const clipperId = tx.wallet.clipperProfile.id;
          const current = campaignsByClipper.get(clipperId) ?? new Set<string>();
          current.add(tx.campaignId);
          campaignsByClipper.set(clipperId, current);
        }
        clipperMap.forEach((clipper, clipperId) => {
          clipper.campaignCount = campaignsByClipper.get(clipperId)?.size ?? 0;
          clipper.remaining = Math.max(
            0,
            clipper.totalEarned - clipper.totalPaid,
          );
        });

        const topClippers = Array.from(clipperMap.values())
          .sort((a, b) => b.totalEarned - a.totalEarned)
          .slice(0, 20);

        // Histórico diário acompanhando o período selecionado,
        // com quebra por tipo de crédito (prêmio × bônus × ajuste)
        const dayKey = (d: Date) => d.toISOString().split("T")[0]!;
        const dayMap = new Map<
          string,
          {
            credited: number;
            prizes: number;
            bonuses: number;
            adjustments: number;
            paid: number;
            count: number;
          }
        >();

        creditTransactions.forEach((tx) => {
          const key = dayKey(tx.createdAt);
          const entry = dayMap.get(key) ?? {
            credited: 0,
            prizes: 0,
            bonuses: 0,
            adjustments: 0,
            paid: 0,
            count: 0,
          };
          entry.credited += tx.amount;
          if (tx.type === "PRIZE_CREDIT") entry.prizes += tx.amount;
          else if (tx.type === "BONUS") entry.bonuses += tx.amount;
          else entry.adjustments += tx.amount;
          entry.count += 1;
          dayMap.set(key, entry);
        });
        pixTransactions.forEach((tx) => {
          const key = dayKey(tx.createdAt);
          const entry = dayMap.get(key) ?? {
            credited: 0,
            prizes: 0,
            bonuses: 0,
            adjustments: 0,
            paid: 0,
            count: 0,
          };
          entry.paid += Math.abs(tx.amount);
          dayMap.set(key, entry);
        });

        // "all" cobre desde a primeira transação (mín. 30, máx. 730 dias)
        let historyDays: number;
        if (input.period !== "all") {
          historyDays = PERIOD_DAYS[input.period];
        } else {
          const earliest = [
            ...creditTransactions,
            ...pixTransactions,
          ].reduce<Date | null>(
            (min, tx) => (!min || tx.createdAt < min ? tx.createdAt : min),
            null,
          );
          historyDays = earliest
            ? Math.min(
                Math.max(
                  Math.ceil((Date.now() - earliest.getTime()) / DAY_MS) + 1,
                  30,
                ),
                730,
              )
            : 30;
        }

        const dailyHistory: {
          date: string;
          credited: number;
          prizes: number;
          bonuses: number;
          adjustments: number;
          paid: number;
          count: number;
        }[] = [];
        const historyStart = new Date(Date.now() - (historyDays - 1) * DAY_MS);
        for (let i = 0; i < historyDays; i++) {
          const dateStr = dayKey(new Date(historyStart.getTime() + i * DAY_MS));
          const entry = dayMap.get(dateStr);
          dailyHistory.push({
            date: dateStr,
            credited: entry?.credited ?? 0,
            prizes: entry?.prizes ?? 0,
            bonuses: entry?.bonuses ?? 0,
            adjustments: entry?.adjustments ?? 0,
            paid: entry?.paid ?? 0,
            count: entry?.count ?? 0,
          });
        }

        // Transações recentes (últimas 50)
        const recentTransactions = [...creditTransactions, ...pixTransactions]
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 50)
          .map((tx) => ({
            id: tx.id,
            type: tx.type,
            amount: tx.amount,
            status: tx.status,
            campaignId: tx.campaignId,
            campaignName:
              (tx.campaignId && campaignNameById.get(tx.campaignId)) || "—",
            description: tx.description,
            createdAt: tx.createdAt,
            clipperName: tx.wallet.clipperProfile.fullName,
            clipperArtisticName: tx.wallet.clipperProfile.artisticName,
            clipperImageUrl: tx.wallet.clipperProfile.user?.imageUrl || null,
          }));

        return {
          summary: {
            totalCredited,
            totalPrizes,
            totalBonuses,
            totalAdjustments,
            totalPaidPix,
            totalPendingAmount,
            totalRemainingToPay,
            totalTransactions:
              creditTransactions.length + pixTransactions.length,
            totalClippers: clipperMap.size,
            pendingCount: pendingWithdrawals.length,
            globalViews,
            globalCpm,
          },
          campaignFinancials,
          topClippers,
          dailyHistory,
          recentTransactions,
          pendingWithdrawals: pendingWithdrawals.map((tx) => ({
            id: tx.id,
            amount: Math.abs(tx.amount),
            type: tx.type,
            status: tx.status,
            campaignId: tx.campaignId,
            campaignName:
              (tx.campaignId && campaignNameById.get(tx.campaignId)) || "—",
            description: tx.description,
            createdAt: tx.createdAt,
            clipperName: tx.wallet.clipperProfile.fullName,
            clipperArtisticName: tx.wallet.clipperProfile.artisticName,
            clipperPixKey: tx.wallet.clipperProfile.pixKey,
            clipperImageUrl: tx.wallet.clipperProfile.user?.imageUrl || null,
          })),
        };
      } catch (error: any) {
        console.error("Erro ao buscar dados financeiros globais:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao buscar dados financeiros globais",
        });
      }
    }),

  // Buscar dados financeiros completos de uma competição
  getCompetitionFinancials: adminProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        // Buscar campanha
        const campaign = await ctx.db.campaign.findUnique({
          where: { slug: input.slug },
          include: {
            activeRankingRule: true,
          },
        });

        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Competição não encontrada",
          });
        }

        // Só os campos usados abaixo (antes vinham as linhas inteiras)
        const clipperSelect = {
          wallet: {
            select: {
              clipperProfile: {
                select: {
                  id: true,
                  fullName: true,
                  artisticName: true,
                  phone: true,
                  cpf: true,
                  pixKey: true,
                  user: { select: { email: true } },
                },
              },
            },
          },
        } satisfies Prisma.TransactionSelect;

        const [transactions, pixTransactions] = await Promise.all([
          // Buscar todas as transações relacionadas a esta campanha
          ctx.db.transaction.findMany({
            where: {
              campaignId: campaign.id,
              type: {
                in: ["PRIZE_CREDIT", "BONUS", "ADJUSTMENT"], // Incluir ajustes no financeiro
              },
              status: "COMPLETED",
            },
            select: {
              id: true,
              type: true,
              amount: true,
              description: true,
              status: true,
              rankingPosition: true,
              createdAt: true,
              ...clipperSelect,
            },
            orderBy: {
              createdAt: "desc",
            },
          }),
          // Buscar todas as transações de PIX (WITHDRAWAL_COMPLETED) desta campanha
          ctx.db.transaction.findMany({
            where: {
              campaignId: campaign.id,
              type: "WITHDRAWAL_COMPLETED",
              status: "COMPLETED",
            },
            select: {
              id: true,
              amount: true,
              description: true,
              status: true,
              createdAt: true,
              withdrawalDetails: true,
              proofUrls: true,
              ...clipperSelect,
            },
            orderBy: {
              createdAt: "desc",
            },
          }),
        ]);

        // Agrupar transações por clipador
        const clipperFinancials = new Map<
          string,
          {
            clipperProfileId: string;
            clipperName: string;
            clipperArtisticName: string | null;
            clipperEmail: string;
            clipperPhone: string;
            clipperCpf: string;
            clipperPixKey: string;
            totalEarned: number;
            totalPaidViaPix: number;
            remainingToPay: number;
            transactions: Array<{
              id: string;
              type: string;
              amount: number;
              description: string;
              status: string;
              rankingPosition: number | null;
              createdAt: Date;
            }>;
            pixRecords: Array<{
              id: string;
              amount: number;
              description: string;
              status: string;
              createdAt: Date;
              pixKey: string | null;
              proofUrl: string | null;
              sentBy: string | null;
              sentAt: string | null;
              proofUrls: string[];
            }>;
          }
        >();

        transactions.forEach((tx) => {
          const clipperProfile = tx.wallet.clipperProfile;
          const key = clipperProfile.id;

          if (!clipperFinancials.has(key)) {
            clipperFinancials.set(key, {
              clipperProfileId: clipperProfile.id,
              clipperName: clipperProfile.fullName,
              clipperArtisticName: clipperProfile.artisticName,
              clipperEmail: clipperProfile.user?.email || "",
              clipperPhone: clipperProfile.phone,
              clipperCpf: clipperProfile.cpf,
              clipperPixKey: clipperProfile.pixKey,
              totalEarned: 0,
              totalPaidViaPix: 0,
              remainingToPay: 0,
              transactions: [],
              pixRecords: [],
            });
          }

          const clipper = clipperFinancials.get(key)!;
          clipper.totalEarned += tx.amount;
          clipper.transactions.push({
            id: tx.id,
            type: tx.type,
            amount: tx.amount,
            description: tx.description,
            status: tx.status,
            rankingPosition: tx.rankingPosition,
            createdAt: tx.createdAt,
          });
        });

        // Adicionar registros de PIX aos clipadores
        pixTransactions.forEach((tx) => {
          const clipperProfile = tx.wallet.clipperProfile;
          const key = clipperProfile.id;

          // Inicializar clipper se não existir (caso tenha PIX mas sem prêmios)
          if (!clipperFinancials.has(key)) {
            clipperFinancials.set(key, {
              clipperProfileId: clipperProfile.id,
              clipperName: clipperProfile.fullName,
              clipperArtisticName: clipperProfile.artisticName,
              clipperEmail: clipperProfile.user?.email || "",
              clipperPhone: clipperProfile.phone,
              clipperCpf: clipperProfile.cpf,
              clipperPixKey: clipperProfile.pixKey,
              totalEarned: 0,
              totalPaidViaPix: 0,
              remainingToPay: 0,
              transactions: [],
              pixRecords: [],
            });
          }

          const clipper = clipperFinancials.get(key)!;
          const pixAmount = Math.abs(tx.amount); // amount é negativo no banco (débito)
          clipper.totalPaidViaPix += pixAmount;

          // Extrair detalhes do PIX do campo withdrawalDetails
          const details = tx.withdrawalDetails as any;
          clipper.pixRecords.push({
            id: tx.id,
            amount: pixAmount,
            description: tx.description,
            status: tx.status,
            createdAt: tx.createdAt,
            pixKey: details?.pixKey || null,
            proofUrl: details?.proofUrl || null,
            sentBy: details?.sentBy || null,
            sentAt: details?.sentAt || null,
            proofUrls: (tx.proofUrls as string[]) || [],
          });
        });

        // Calcular remainingToPay para cada clipper
        clipperFinancials.forEach((clipper) => {
          clipper.remainingToPay = Math.max(
            0,
            clipper.totalEarned - clipper.totalPaidViaPix,
          );
        });

        // Converter Map para Array e ordenar por total ganho
        const clippersArray = Array.from(clipperFinancials.values()).sort(
          (a, b) => b.totalEarned - a.totalEarned,
        );

        // Calcular total pago via PIX
        const totalPaidViaPix = pixTransactions.reduce(
          (sum, tx) => sum + Math.abs(tx.amount),
          0,
        );
        const totalRemainingToPay = clippersArray.reduce(
          (sum, c) => sum + c.remainingToPay,
          0,
        );

        // Calcular totais
        const totalPaid = transactions.reduce((sum, tx) => sum + tx.amount, 0);
        const totalTransactions = transactions.length;

        // Calcular estimativa de prêmios futuros (baseado nas regras de ranking)
        let estimatedFuturePayments = 0;
        if (campaign.activeRankingRule) {
          const rule = campaign.activeRankingRule;

          // Calcular dias restantes da competição
          const now = new Date();
          const endDate = new Date(campaign.endDate);
          const daysLeft = Math.max(
            0,
            Math.ceil(
              (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
            ),
          );

          // Estimativa de pagamentos diários restantes
          if (rule.dailyEnabled && daysLeft > 0) {
            estimatedFuturePayments += rule.dailyTotalPrize * daysLeft;
          }

          // Adicionar prêmio mensal (se ainda não foi pago)
          if (rule.monthlyEnabled) {
            estimatedFuturePayments += rule.monthlyTotalPrize;
          }
        }

        return {
          campaign: {
            id: campaign.id,
            name: campaign.name,
            slug: campaign.slug,
            status: campaign.status,
            startDate: campaign.startDate.toISOString(),
            endDate: campaign.endDate.toISOString(),
          },
          summary: {
            totalPaid,
            totalTransactions,
            totalClippers: clippersArray.length,
            estimatedFuturePayments,
            estimatedTotal: totalPaid + estimatedFuturePayments,
            totalPaidViaPix,
            totalRemainingToPay,
          },
          clippers: clippersArray,
          rankingRule: campaign.activeRankingRule
            ? {
                dailyEnabled: campaign.activeRankingRule.dailyEnabled,
                dailyTotalPrize: campaign.activeRankingRule.dailyTotalPrize,
                dailyPrizeTable: campaign.activeRankingRule.dailyPrizeTable,
                monthlyEnabled: campaign.activeRankingRule.monthlyEnabled,
                monthlyTotalPrize: campaign.activeRankingRule.monthlyTotalPrize,
                monthlyPrizeTable: campaign.activeRankingRule.monthlyPrizeTable,
              }
            : null,
        };
      } catch (error: any) {
        console.error("Erro ao buscar dados financeiros:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao buscar dados financeiros",
        });
      }
    }),

  // Buscar todos os posts de um clipador específico em uma competição (para métricas detalhadas)
  getClipperPostsInCompetition: adminProcedure
    .input(
      z.object({
        clipperName: z.string(),
        campaignId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Buscar todos os posts deste clipador nesta competição
        const posts = await ctx.db.clipPost.findMany({
          where: {
            campaignId: input.campaignId,
            application: {
              clipperProfile: {
                OR: [
                  { fullName: input.clipperName },
                  { artisticName: input.clipperName },
                ],
              },
            },
          },
          select: {
            id: true,
            submittedUrl: true,
            thumbnailUrl: true,
            platform: true,
            username: true,
            views: true,
            likes: true,
            comments: true,
            shares: true,
            saves: true,
            postedAt: true,
            status: true,
            createdAt: true,
          },
          orderBy: {
            views: "desc",
          },
        });

        return posts;
      } catch (error: any) {
        console.error("Erro ao buscar posts do clipador:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao buscar posts",
        });
      }
    }),

  previewDailyRankByDate: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const core = await loadDailyRankingDateContext(
          ctx.db,
          input.campaignId,
          input.date,
        );

        if (!core) {
          const campaignExists = await ctx.db.campaign.findUnique({
            where: { id: input.campaignId },
            select: { id: true },
          });
          throw new TRPCError({
            code: "NOT_FOUND",
            message: campaignExists
              ? `Nenhum ranking diário para a data UTC ${input.date}`
              : "Campanha não encontrada",
          });
        }

        const prizeTable = parsePrizeTable(core.dailyPrizeTable);

        const entryIds = core.rawRows.map((r) => r.dailyRankingEntryId);
        const dreRows = await ctx.db.dailyRankingEntry.findMany({
          where: { id: { in: entryIds } },
          select: {
            id: true,
            dailyPrizeStatus: true,
            dailyPrizeAmount: true,
            dailyPrizePaid: true,
            dailyPixStatus: true,
            isDisqualified: true,
          },
        });
        const dreMap = new Map(dreRows.map((e) => [e.id, e]));

        let effectiveRank = 0;
        const entries = core.rawRows.map((row, index) => {
          const dre = dreMap.get(row.dailyRankingEntryId);
          const isDisqualified = dre?.isDisqualified ?? false;
          if (!isDisqualified) {
            effectiveRank++;
          }
          const prize = isDisqualified
            ? 0
            : getPrizeForPosition(prizeTable, effectiveRank);
          const position = isDisqualified ? index + 1 : effectiveRank;
          return {
            position,
            dailyRankingEntryId: row.dailyRankingEntryId,
            clipPostId: row.clipPostId,
            applicationId: row.applicationId,
            clipperProfileId: row.clipperProfileId,
            clipperName: getClipperRankingDisplayName(row),
            fullName: getFirstName(row.fullName) || "Clipador",
            views: Number(row.views),
            likes: row.likes,
            comments: row.comments,
            shares: row.shares,
            saves: row.saves ?? 0,
            submittedUrl: row.submittedUrl,
            thumbnailUrl: row.thumbnailUrl,
            platform: row.platform,
            er: row.er,
            score: Number(row.score),
            prize,
            dailyPrizeStatus: dre?.dailyPrizeStatus ?? "PENDING",
            dailyPrizeAmount: dre?.dailyPrizeAmount ?? 0,
            dailyPrizePaid: dre?.dailyPrizePaid ?? false,
            dailyPixStatus: dre?.dailyPixStatus ?? "PENDING",
            isDisqualified,
            postedAt: row.postedAt?.toISOString() ?? null,
            username: row.username,
            pixKey: row.pixKey,
            pixPayoutEligible: row.pixPayoutEligible,
          };
        });

        const activeForPayment = entries
          .filter((e) => !e.isDisqualified)
          .slice(0, core.topCount)
          .map((e, idx) => ({
            ...e,
            effectivePrize: getPrizeForPosition(prizeTable, idx + 1),
          }));
        const withExpectedPrize = activeForPayment.filter(
          (e) => e.effectivePrize > 0,
        );
        const withPixExpectedPrize = withExpectedPrize.filter(
          (e) => e.pixPayoutEligible,
        );
        const canUndoRankPayments =
          withExpectedPrize.length > 0 &&
          withExpectedPrize.every((e) => e.dailyPrizeStatus === "PAID");
        const processingPixTransactions = await ctx.db.transaction.findMany({
          where: {
            status: "PROCESSING",
            metadata: { path: ["source"], equals: "daily_ranking_pix" },
            AND: [
              {
                metadata: {
                  path: ["dailyRankingId"],
                  equals: core.dailyRankingId,
                },
              },
            ],
          },
          select: { metadata: true },
        });
        const isPixEntrySettled = (e: (typeof withPixExpectedPrize)[number]) =>
          e.dailyPrizeStatus === "PAID" &&
          Math.abs(e.dailyPrizeAmount - e.effectivePrize) < 0.01 &&
          e.dailyPrizePaid &&
          e.dailyPixStatus === "PAID";
        const expectedPixEntryIds = new Set(
          withPixExpectedPrize.map((e) => e.dailyRankingEntryId),
        );
        const settledPixEntryIds = new Set(
          withPixExpectedPrize
            .filter((e) => isPixEntrySettled(e))
            .map((e) => e.dailyRankingEntryId),
        );
        const blockingProcessingPixTransactions =
          processingPixTransactions.filter((tx) => {
            const metadata = tx.metadata as {
              dailyRankingEntryId?: string;
            } | null;
            const entryId = metadata?.dailyRankingEntryId;
            if (!entryId || !expectedPixEntryIds.has(entryId)) return true;
            return !settledPixEntryIds.has(entryId);
          });
        const effectiveDailyPixPayoutCompleted =
          withPixExpectedPrize.length > 0 &&
          blockingProcessingPixTransactions.length === 0 &&
          withPixExpectedPrize.every((e) => isPixEntrySettled(e));

        const dateStart = new Date(`${input.date}T00:00:00.000Z`);
        const dateEnd = new Date(`${input.date}T23:59:59.999Z`);
        const dailyRankingRecord = await ctx.db.dailyRanking.findFirst({
          where: {
            campaignId: input.campaignId,
            rankingDate: { gte: dateStart, lte: dateEnd },
          },
          select: { announced: true, dailyPixPayoutCompleted: true },
        });

        return {
          date: input.date,
          campaignName: core.campaignName,
          campaignId: core.campaignId,
          sortedByEngagement: core.sortedByEngagement,
          topCount: core.topCount,
          windowStart: core.windowStart.toISOString(),
          windowEnd: core.windowEnd.toISOString(),
          stats: {
            totalPosts: core.stats.totalPosts,
            totalCompetitionViews: core.stats.totalCompetitionViews.toString(),
            viewsIncreaseToday: core.stats.viewsIncreaseToday.toString(),
          },
          entries,
          canUndoRankPayments,
          announced: dailyRankingRecord?.announced ?? false,
          dailyPixPayoutCompleted: effectiveDailyPixPayoutCompleted,
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) {
          throw error;
        }
        const message =
          error instanceof Error
            ? error.message
            : "Erro ao gerar preview do rank";
        console.error("previewDailyRankByDate:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  previewTopPostersDailyRankByDate: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const campaign = await ctx.db.campaign.findUnique({
          where: { id: input.campaignId },
          select: {
            id: true,
            name: true,
            dailyPix: true,
            topClippersRankingEnabled: true,
            topClippersPrizeTable: true,
          },
        });

        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campanha não encontrada",
          });
        }

        if (!campaign.topClippersRankingEnabled) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "O ranking Top Clipadores não está habilitado nesta competição.",
          });
        }
        const prizeTable = parseTopClippersPrizeTable(
          campaign.topClippersPrizeTable,
        );
        if (!prizeTable.some((entry) => entry.prize > 0)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Esta campanha não possui premiação configurada para o Top Clipadores.",
          });
        }
        const topCount = Math.max(...prizeTable.map((entry) => entry.position));

        const snapshot = await getTopClippersSnapshotState(
          ctx.db,
          input.campaignId,
          input.date,
        );
        const { startDate, endDate } = getTopPostersDailyWindowBrt(input.date);
        const grouped = await ctx.db.clipPost.groupBy({
          by: ["applicationId"],
          where: {
            campaignId: input.campaignId,
            status: "ELIGIBLE",
            postedAt: { gte: startDate, lt: endDate },
            application: {
              campaignId: input.campaignId,
              ...rankingApplicationWhere(endDate),
            },
            applicationId: { notIn: snapshot.disqualifiedApplicationIds },
          },
          _count: { applicationId: true },
          _sum: { views: true },
          orderBy: [
            { _count: { applicationId: "desc" } },
            { _sum: { views: "desc" } },
            { applicationId: "asc" },
          ],
          take: topCount,
        });

        const appIds = grouped
          .map((row: { applicationId: string | null }) => row.applicationId)
          .filter((id: string | null): id is string => Boolean(id));

        const applications = await ctx.db.clipperApplication.findMany({
          where: { id: { in: appIds } },
          select: {
            id: true,
            clipperProfileId: true,
            clipperProfile: {
              select: {
                fullName: true,
                artisticName: true,
                pixKey: true,
              },
            },
          },
        });

        const appMap = new Map(applications.map((row) => [row.id, row]));
        const dateFormatted = new Date(
          `${input.date}T12:00:00.000Z`,
        ).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "UTC",
        });

        const entriesBase = grouped
          .filter((row: { applicationId: string | null }) =>
            Boolean(row.applicationId),
          )
          .map((row, idx) => {
            const app = appMap.get(row.applicationId as string);
            const totalPosts = Number(row._count?.applicationId ?? 0);
            const totalViews = Number(row._sum?.views ?? 0);
            return {
              position: idx + 1,
              applicationId: row.applicationId as string,
              clipperProfileId: app?.clipperProfileId ?? "",
              clipperName: app?.clipperProfile
                ? getClipperRankingDisplayName(app.clipperProfile)
                : "Clipador",
              fullName:
                getFirstName(app?.clipperProfile?.fullName) || "Clipador",
              pixKey: app?.clipperProfile?.pixKey ?? null,
              totalPosts,
              totalViews,
              prize: getTopClippersPrize(prizeTable, idx + 1),
            };
          });

        await persistTopClippersEntries(
          ctx.db,
          snapshot.rankingId,
          entriesBase.map((entry) => ({
            applicationId: entry.applicationId,
            clipperProfileId: entry.clipperProfileId,
            position: entry.position,
            totalPosts: entry.totalPosts,
            totalViews: entry.totalViews,
            prizeAmount: entry.prize,
          })),
        );
        const persistedEntries =
          await ctx.db.topClippersDailyRankingEntry.findMany({
            where: {
              topClippersDailyRankingId: snapshot.rankingId,
              applicationId: {
                in: entriesBase.map((entry) => entry.applicationId),
              },
            },
            select: {
              id: true,
              applicationId: true,
              prizeAmount: true,
              prizeStatus: true,
            },
          });
        const persistedEntryByApplication = new Map(
          persistedEntries.map((entry) => [entry.applicationId, entry]),
        );

        // Prêmios já creditados (e não estornados) de todas as posições de uma vez
        const priorPrizes = await findUnreversedTopPostersPrizesByPosition(
          ctx.db,
          entriesBase.map((entry) => ({
            position: entry.position,
            where: {
              campaignId: input.campaignId,
              type: "PRIZE_CREDIT",
              status: "COMPLETED",
              rankingPosition: entry.position,
              clipPostId: null,
              wallet: { clipperProfileId: entry.clipperProfileId },
              OR: [
                {
                  metadata: {
                    equals: {
                      source: "top_posters_daily_rank",
                      campaignId: input.campaignId,
                      date: input.date,
                      rankingPosition: entry.position,
                    },
                  },
                },
                {
                  description: {
                    contains: `Top Postadores ${dateFormatted}`,
                  },
                },
              ],
            },
          })),
        );

        const entries = await Promise.all(
          entriesBase.map(async (entry) => {
            const persistedEntry = persistedEntryByApplication.get(
              entry.applicationId,
            )!;
            const priorPrize = priorPrizes.get(entry.position) ?? null;

            if (priorPrize && persistedEntry.prizeStatus !== "PAID") {
              await ctx.db.topClippersDailyRankingEntry.update({
                where: { id: persistedEntry.id },
                data: {
                  prizeStatus: "PAID",
                  prizeAmount: priorPrize.amount,
                  paidAt: priorPrize.processedAt ?? priorPrize.createdAt,
                  transactionId: priorPrize.id,
                },
              });
            }

            return {
              ...entry,
              rankingEntryId: persistedEntry.id,
              prize: persistedEntry.prizeAmount,
              prizeStatus:
                persistedEntry.prizeStatus === "PAID" || priorPrize
                  ? "PAID"
                  : "PENDING",
              prizeAmountPaid: priorPrize?.amount ?? 0,
            };
          }),
        );
        const disqualifiedEntries =
          await ctx.db.topClippersDailyRankingEntry.findMany({
            where: {
              topClippersDailyRankingId: snapshot.rankingId,
              isDisqualified: true,
            },
            include: {
              application: {
                select: {
                  clipperProfile: {
                    select: { fullName: true, artisticName: true },
                  },
                },
              },
            },
            orderBy: [{ disqualifiedAt: "asc" }, { position: "asc" }],
          });

        const windowTotals = await ctx.db.clipPost.aggregate({
          where: {
            campaignId: input.campaignId,
            status: "ELIGIBLE",
            postedAt: { gte: startDate, lt: endDate },
            application: {
              campaignId: input.campaignId,
              ...rankingApplicationWhere(endDate),
            },
          },
          _count: { _all: true },
          _sum: { views: true },
        });

        return {
          date: input.date,
          campaignId: campaign.id,
          campaignName: campaign.name,
          windowStart: startDate.toISOString(),
          windowEnd: endDate.toISOString(),
          entries,
          disqualifiedEntries: disqualifiedEntries.map((entry) => ({
            rankingEntryId: entry.id,
            applicationId: entry.applicationId,
            position: entry.position,
            clipperName: getClipperRankingDisplayName(
              entry.application.clipperProfile,
            ),
            fullName:
              getFirstName(entry.application.clipperProfile.fullName) ||
              "Clipador",
            totalPosts: entry.totalPosts,
            totalViews: Number(entry.totalViews),
            reason: entry.disqualificationReason,
            disqualifiedAt: entry.disqualifiedAt?.toISOString() ?? null,
          })),
          canPayTopPosters: entries.some(
            (entry) => entry.prize > 0 && entry.prizeStatus !== "PAID",
          ),
          stats: {
            totalPostsInWindow: windowTotals._count._all,
            totalViewsInWindow: Number(windowTotals._sum.views || 0),
          },
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) {
          throw error;
        }
        const message =
          error instanceof Error
            ? error.message
            : "Erro ao gerar top postadores";
        console.error("previewTopPostersDailyRankByDate:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  disqualifyTopClippersDailyRankingEntry: adminProcedure
    .input(
      z.object({
        rankingEntryId: z.string(),
        reason: z.string().trim().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.db.topClippersDailyRankingEntry.findUnique({
        where: { id: input.rankingEntryId },
        include: { ranking: { select: { campaignId: true } } },
      });
      if (!entry) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Entrada do Top Clipadores não encontrada",
        });
      }
      await ctx.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT id FROM "TopClippersDailyRankingEntry" WHERE id = ${entry.id} FOR UPDATE`;
        const currentEntry = await tx.topClippersDailyRankingEntry.findUnique({
          where: { id: entry.id },
          select: { prizeStatus: true, transactionId: true },
        });
        if (
          !currentEntry ||
          currentEntry.prizeStatus === "PAID" ||
          currentEntry.transactionId
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Não é possível desclassificar após o crédito do prêmio. Faça o estorno primeiro.",
          });
        }
        await tx.topClippersDailyRankingEntry.update({
          where: { id: entry.id },
          data: {
            isDisqualified: true,
            disqualificationReason:
              input.reason || "Desclassificado pelo administrador.",
            disqualifiedAt: new Date(),
            disqualifiedBy: ctx.userId,
            prizeAmount: 0,
          },
        });
        await tx.auditLog.create({
          data: {
            userId: ctx.userId,
            action: "UPDATE",
            entityType: "TopClippersDailyRankingEntry",
            entityId: entry.id,
            campaignId: entry.ranking.campaignId,
            changes: {
              action: "disqualify_top_clippers_daily_ranking_entry",
              applicationId: entry.applicationId,
              previousPosition: entry.position,
              reason: input.reason || "Desclassificado pelo administrador.",
            },
          },
        });
      });
      return {
        success: true,
        message: "Clipador desclassificado deste ranking.",
      };
    }),

  undoDisqualifyTopClippersDailyRankingEntry: adminProcedure
    .input(z.object({ rankingEntryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.db.topClippersDailyRankingEntry.findUnique({
        where: { id: input.rankingEntryId },
        include: { ranking: { select: { campaignId: true, rankingDate: true } } },
      });
      if (!entry) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Entrada do Top Clipadores não encontrada",
        });
      }
      await ctx.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT id FROM "TopClippersDailyRankingEntry" WHERE id = ${entry.id} FOR UPDATE`;
        const currentEntry = await tx.topClippersDailyRankingEntry.findUnique({
          where: { id: entry.id },
          select: { prizeStatus: true, transactionId: true },
        });
        if (
          !currentEntry ||
          currentEntry.prizeStatus === "PAID" ||
          currentEntry.transactionId
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Não é possível alterar uma entrada já paga.",
          });
        }
        const cutoff = getPostedAtWindowUtc(entry.ranking.rankingDate.toISOString().slice(0, 10)).endDate;
        const eligible = await tx.clipperApplication.count({
          where: { id: entry.applicationId, ...rankingApplicationWhere(cutoff) },
        });
        if (!eligible) {
          throw new TRPCError({ code: "FORBIDDEN", message: "A saída voluntária impede a participação neste período." });
        }
        await tx.topClippersDailyRankingEntry.update({
          where: { id: entry.id },
          data: {
            isDisqualified: false,
            disqualificationReason: null,
            disqualifiedAt: null,
            disqualifiedBy: null,
          },
        });
        await tx.auditLog.create({
          data: {
            userId: ctx.userId,
            action: "UPDATE",
            entityType: "TopClippersDailyRankingEntry",
            entityId: entry.id,
            campaignId: entry.ranking.campaignId,
            changes: {
              action: "undo_disqualify_top_clippers_daily_ranking_entry",
            },
          },
        });
      });
      return { success: true, message: "Desclassificação revertida." };
    }),

  payTopPostersDailyRankByDate: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dryRun: z.boolean(),
        expectedPlanFingerprint: z.string().length(64).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const campaign = await ctx.db.campaign.findUnique({
          where: { id: input.campaignId },
          select: {
            id: true,
            name: true,
            dailyPix: true,
            topClippersRankingEnabled: true,
            topClippersPrizeTable: true,
          },
        });

        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campanha não encontrada",
          });
        }

        if (!campaign.topClippersRankingEnabled) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "O ranking Top Clipadores não está habilitado nesta competição.",
          });
        }

        const prizeTable = parseTopClippersPrizeTable(
          campaign.topClippersPrizeTable,
        );

        if (!prizeTable.some((entry) => entry.prize > 0)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Esta campanha não possui premiação configurada para o Top Clipadores.",
          });
        }
        const topCount = Math.max(...prizeTable.map((entry) => entry.position));

        const snapshot = await getTopClippersSnapshotState(
          ctx.db,
          input.campaignId,
          input.date,
        );
        const { startDate, endDate } = getTopPostersDailyWindowBrt(input.date);
        const dateFormatted = new Date(
          `${input.date}T12:00:00.000Z`,
        ).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "UTC",
        });

        const grouped = await ctx.db.clipPost.groupBy({
          by: ["applicationId"],
          where: {
            campaignId: input.campaignId,
            status: "ELIGIBLE",
            postedAt: { gte: startDate, lt: endDate },
            application: {
              campaignId: input.campaignId,
              ...rankingApplicationWhere(endDate),
            },
            applicationId: { notIn: snapshot.disqualifiedApplicationIds },
          },
          _count: { applicationId: true },
          _sum: { views: true },
          orderBy: [
            { _count: { applicationId: "desc" } },
            { _sum: { views: "desc" } },
            { applicationId: "asc" },
          ],
          take: topCount,
        });

        const appIds = grouped
          .map((row: { applicationId: string | null }) => row.applicationId)
          .filter((id: string | null): id is string => Boolean(id));

        const applications = await ctx.db.clipperApplication.findMany({
          where: { id: { in: appIds } },
          select: {
            id: true,
            clipperProfileId: true,
            clipperProfile: {
              select: {
                fullName: true,
                artisticName: true,
                user: { select: { email: true } },
              },
            },
          },
        });

        const appMap = new Map(applications.map((row) => [row.id, row]));

        type PlanRow =
          | {
              kind: "payable";
              position: number;
              applicationId: string;
              rankingEntryId: string;
              clipperProfileId: string;
              clipperName: string;
              fullName: string;
              amount: number;
              totalPosts: number;
              totalViews: number;
            }
          | {
              kind: "skip";
              position: number;
              clipperName: string;
              fullName: string;
              amount: number;
              skipReason: string;
            };

        const plan: PlanRow[] = [];

        const rows = grouped.map((row, index) => {
          const position = index + 1;
          const app = row.applicationId ? appMap.get(row.applicationId) : null;
          return {
            row,
            position,
            amount: getTopClippersPrize(prizeTable, position),
            app,
            clipperName: app?.clipperProfile
              ? getClipperRankingDisplayName(app.clipperProfile)
              : "Clipador",
            fullName: getFirstName(app?.clipperProfile?.fullName) || "Clipador",
          };
        });
        const hasApplication = (line: (typeof rows)[number]) =>
          Boolean(line.row.applicationId && line.app?.clipperProfileId);

        // Prêmios já creditados (e não estornados) de todas as posições de uma vez
        const priorPrizes = await findUnreversedTopPostersPrizesByPosition(
          ctx.db,
          rows
            .filter((line) => hasApplication(line) && line.amount > 0)
            .map((line) => ({
              position: line.position,
              where: {
                campaignId: input.campaignId,
                type: "PRIZE_CREDIT",
                status: "COMPLETED",
                rankingPosition: line.position,
                clipPostId: null,
                OR: [
                  {
                    metadata: {
                      equals: {
                        source: "top_posters_daily_rank",
                        campaignId: input.campaignId,
                        date: input.date,
                        rankingPosition: line.position,
                      },
                    },
                  },
                  {
                    description: {
                      contains: `Top Postadores ${dateFormatted}`,
                    },
                  },
                ],
              },
            })),
        );

        // Grava as posições sem prêmio prévio e lê as entradas de uma vez
        const rowsToPersist = rows.filter(
          (line) =>
            hasApplication(line) &&
            line.amount > 0 &&
            !priorPrizes.has(line.position),
        );
        let rankingEntries: Array<{
          id: string;
          applicationId: string;
          isDisqualified: boolean;
          prizeStatus: string;
        }> = [];
        if (rowsToPersist.length > 0) {
          await persistTopClippersEntries(
            ctx.db,
            snapshot.rankingId,
            rowsToPersist.map((line) => ({
              applicationId: line.row.applicationId,
              clipperProfileId: line.app!.clipperProfileId,
              position: line.position,
              totalPosts: Number(line.row._count?.applicationId ?? 0),
              totalViews: Number(line.row._sum?.views ?? 0),
              prizeAmount: line.amount,
            })),
          );
          rankingEntries = await ctx.db.topClippersDailyRankingEntry.findMany({
            where: {
              topClippersDailyRankingId: snapshot.rankingId,
              applicationId: {
                in: rowsToPersist.map((line) => line.row.applicationId),
              },
            },
            select: {
              id: true,
              applicationId: true,
              isDisqualified: true,
              prizeStatus: true,
            },
          });
        }
        const rankingEntryByApplication = new Map(
          rankingEntries.map((entry) => [entry.applicationId, entry]),
        );

        for (const line of rows) {
          const { row, position, amount, app, clipperName, fullName } = line;

          if (!row.applicationId || !app?.clipperProfileId) {
            plan.push({
              kind: "skip",
              position,
              clipperName,
              fullName,
              amount,
              skipReason: "Aplicação ou clipador não encontrado",
            });
            continue;
          }

          if (amount <= 0) {
            plan.push({
              kind: "skip",
              position,
              clipperName,
              fullName,
              amount,
              skipReason: "Sem valor de prêmio para esta posição",
            });
            continue;
          }

          if (priorPrizes.has(position)) {
            plan.push({
              kind: "skip",
              position,
              clipperName,
              fullName,
              amount,
              skipReason: "Prêmio de Top Postadores já creditado",
            });
            continue;
          }

          const rankingEntry = rankingEntryByApplication.get(row.applicationId);
          if (!rankingEntry) {
            throw new Error(
              "Entrada do Top Clipadores não encontrada após gravar o ranking",
            );
          }
          if (rankingEntry.isDisqualified) {
            plan.push({
              kind: "skip",
              position,
              clipperName,
              fullName,
              amount,
              skipReason: "Clipador desclassificado deste ranking",
            });
            continue;
          }
          if (rankingEntry.prizeStatus === "PAID") {
            plan.push({
              kind: "skip",
              position,
              clipperName,
              fullName,
              amount,
              skipReason: "Prêmio de Top Postadores já creditado",
            });
            continue;
          }

          plan.push({
            kind: "payable",
            position,
            applicationId: row.applicationId,
            rankingEntryId: rankingEntry.id,
            clipperProfileId: app.clipperProfileId,
            clipperName,
            fullName,
            amount,
            totalPosts: Number(row._count?.applicationId ?? 0),
            totalViews: Number(row._sum?.views ?? 0),
          });
        }

        const payable = plan.filter(
          (p): p is Extract<PlanRow, { kind: "payable" }> =>
            p.kind === "payable",
        );
        const skipped = plan.filter(
          (p): p is Extract<PlanRow, { kind: "skip" }> => p.kind === "skip",
        );
        const totalAmount = payable.reduce((sum, row) => sum + row.amount, 0);
        const planFingerprint = topClippersPaymentPlanFingerprint(payable);

        if (!input.dryRun) {
          if (!input.expectedPlanFingerprint) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "Simule o pagamento novamente antes de confirmar.",
            });
          }
          if (input.expectedPlanFingerprint !== planFingerprint) {
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "O Top Clipadores mudou depois da simulação. Revise o novo plano antes de pagar.",
            });
          }
        }

        if (input.dryRun) {
          return {
            dryRun: true as const,
            date: input.date,
            campaignId: campaign.id,
            campaignName: campaign.name,
            totalAmount,
            planFingerprint,
            payableCount: payable.length,
            skippedCount: skipped.length,
            payable: payable.map((p) => ({
              position: p.position,
              clipperName: p.clipperName,
              fullName: p.fullName,
              amount: p.amount,
              totalPosts: p.totalPosts,
              totalViews: p.totalViews,
            })),
            skipped: skipped.map((s) => ({
              position: s.position,
              clipperName: s.clipperName,
              fullName: s.fullName,
              amount: s.amount,
              reason: s.skipReason,
            })),
          };
        }

        const paid: {
          position: number;
          clipperName: string;
          amount: number;
          transactionId: string;
        }[] = [];

        const failed: {
          position: number;
          clipperName: string;
          amount: number;
          error: string;
        }[] = [];

        for (const line of payable) {
          const description = `Prêmio ${line.position}º lugar - Top Postadores ${dateFormatted} — ${campaign.name}`;
          const topPostersMeta: Prisma.InputJsonValue = {
            source: "top_posters_daily_rank",
            campaignId: input.campaignId,
            date: input.date,
            rankingPosition: line.position,
            topClippersDailyRankingEntryId: line.rankingEntryId,
          };

          try {
            let newTransactionId = "";
            await ctx.db.$transaction(async (tx) => {
              await tx.$executeRaw`SELECT id FROM "TopClippersDailyRankingEntry" WHERE id = ${line.rankingEntryId} FOR UPDATE`;
              const currentEntry =
                await tx.topClippersDailyRankingEntry.findUnique({
                  where: { id: line.rankingEntryId },
                  select: { isDisqualified: true, prizeStatus: true },
                });
              if (!currentEntry || currentEntry.isDisqualified) {
                throw new Error("Entrada do Top Clipadores desclassificada");
              }
              if (currentEntry.prizeStatus === "PAID") {
                throw new Error("Prêmio de Top Postadores já creditado");
              }
              let wallet = await tx.wallet.findUnique({
                where: { clipperProfileId: line.clipperProfileId },
              });

              if (!wallet) {
                wallet = await tx.wallet.create({
                  data: {
                    clipperProfileId: line.clipperProfileId,
                    balance: 0,
                    totalEarned: 0,
                    totalWithdrawn: 0,
                    pendingWithdraw: 0,
                    currency: "BRL",
                    isActive: true,
                  },
                });
              }

              const dup = await findUnreversedTopPostersPrize(tx, {
                where: {
                  campaignId: input.campaignId,
                  type: "PRIZE_CREDIT",
                  status: "COMPLETED",
                  rankingPosition: line.position,
                  clipPostId: null,
                  metadata: { equals: topPostersMeta },
                },
              });

              if (dup) {
                throw new Error(
                  "Prêmio de Top Postadores já registrado para esta posição",
                );
              }

              const txRow = await tx.transaction.create({
                data: {
                  walletId: wallet.id,
                  type: "PRIZE_CREDIT",
                  status: "COMPLETED",
                  amount: line.amount,
                  balanceBefore: wallet.balance,
                  balanceAfter: wallet.balance + line.amount,
                  description,
                  campaignId: input.campaignId,
                  clipPostId: null,
                  rankingPosition: line.position,
                  idempotencyKey: `top-clippers-prize:entry:${line.rankingEntryId}`,
                  processedBy: ctx.userId,
                  processedAt: new Date(),
                  metadata: topPostersMeta,
                },
              });
              newTransactionId = txRow.id;

              await tx.wallet.update({
                where: { id: wallet.id },
                data: {
                  balance: { increment: line.amount },
                  totalEarned: { increment: line.amount },
                },
              });

              await tx.topClippersDailyRankingEntry.update({
                where: { id: line.rankingEntryId },
                data: {
                  prizeStatus: "PAID",
                  paidAt: new Date(),
                  transactionId: txRow.id,
                },
              });

              await tx.auditLog.create({
                data: {
                  userId: ctx.userId,
                  action: "CREATE",
                  entityType: "Transaction",
                  entityId: txRow.id,
                  campaignId: input.campaignId,
                  changes: {
                    action: "top_posters_daily_prize_payment",
                    clipperProfileId: line.clipperProfileId,
                    amount: line.amount,
                    position: line.position,
                    date: input.date,
                    totalPosts: line.totalPosts,
                    totalViews: line.totalViews,
                  },
                },
              });
            });

            paid.push({
              position: line.position,
              clipperName: line.clipperName,
              amount: line.amount,
              transactionId: newTransactionId,
            });

            const clipperProfile = await ctx.db.clipperProfile.findUnique({
              where: { id: line.clipperProfileId },
              include: { user: { select: { email: true } } },
            });
            const walletAfter = await ctx.db.wallet.findUnique({
              where: { clipperProfileId: line.clipperProfileId },
              select: { balance: true },
            });

            if (clipperProfile?.user?.email && walletAfter !== null) {
              const emailHtml = getPaymentNotificationEmailTemplate(
                clipperProfile.fullName,
                line.amount,
                "PRIZE_CREDIT",
                description,
                walletAfter.balance,
                campaign.name,
                line.position,
                "daily",
                campaign.dailyPix,
              );

              resend.emails
                .send({
                  from: "ClipfyAI <noreply@league.clipfyai.com>",
                  to: clipperProfile.user.email,
                  subject: `🏆 Pagamento Recebido: ${new Intl.NumberFormat(
                    "pt-BR",
                    {
                      style: "currency",
                      currency: "BRL",
                    },
                  ).format(line.amount)}`,
                  html: emailHtml,
                })
                .catch((err: unknown) => {
                  console.error(
                    "Erro ao enviar email de prêmio Top Postadores:",
                    err,
                  );
                });
            }
          } catch (err: unknown) {
            const msg =
              err instanceof Error
                ? err.message
                : "Erro ao processar pagamento";
            failed.push({
              position: line.position,
              clipperName: line.clipperName,
              amount: line.amount,
              error: msg,
            });
            console.error("payTopPostersDailyRankByDate item:", err);
          }
        }

        return {
          dryRun: false as const,
          date: input.date,
          campaignId: campaign.id,
          campaignName: campaign.name,
          totalAmountPaid: paid.reduce((sum, p) => sum + p.amount, 0),
          paid,
          failed,
          skipped: skipped.map((s) => ({
            position: s.position,
            clipperName: s.clipperName,
            amount: s.amount,
            reason: s.skipReason,
          })),
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) {
          throw error;
        }
        const message =
          error instanceof Error
            ? error.message
            : "Erro ao pagar Top Postadores";
        console.error("payTopPostersDailyRankByDate:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  getDailyTopClippersByPostedVideos: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const campaignConfig = await ctx.db.campaign.findUnique({
        where: { id: input.campaignId },
        select: {
          name: true,
          topClippersRankingEnabled: true,
          topClippersPrizeTable: true,
        },
      });

      if (!campaignConfig) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Competição não encontrada.",
        });
      }

      if (!campaignConfig.topClippersRankingEnabled) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "O ranking Top Clipadores não está habilitado nesta competição.",
        });
      }
      const prizeTable = parseTopClippersPrizeTable(
        campaignConfig.topClippersPrizeTable,
      );

      const { startDate, endDate } = getLiveDailyWindowByReferenceDate(
        input.date,
      );

      // Uma inscrição por clipador na competição: agrupar por inscrição é o
      // mesmo que agrupar por clipador. Só os perfis do top são carregados.
      const grouped = await ctx.db.clipPost.groupBy({
        by: ["applicationId"],
        where: {
          campaignId: input.campaignId,
          status: ClipPostStatus.ELIGIBLE,
          postedAt: { gte: startDate, lt: endDate },
          application: {
            campaignId: input.campaignId,
            ...rankingApplicationWhere(endDate),
          },
        },
        _count: { applicationId: true },
        _sum: { views: true },
      });

      const groups = grouped.map((row) => ({
        applicationId: row.applicationId,
        totalPosts: row._count.applicationId,
        totalViews: Number(row._sum.views || 0),
      }));
      const totalPostsInWindow = groups.reduce(
        (sum, row) => sum + row.totalPosts,
        0,
      );
      const totalViewsInWindow = groups.reduce(
        (sum, row) => sum + row.totalViews,
        0,
      );

      // Mesma ordem da prévia e do pagamento (posts, views e, no empate,
      // applicationId crescente): a posição e o prêmio exibidos são os pagos.
      const topGroups = groups
        .sort((a, b) => {
          if (b.totalPosts !== a.totalPosts) return b.totalPosts - a.totalPosts;
          if (b.totalViews !== a.totalViews) return b.totalViews - a.totalViews;
          if (a.applicationId === b.applicationId) return 0;
          return a.applicationId < b.applicationId ? -1 : 1;
        })
        .slice(0, input.limit);

      const applications =
        topGroups.length > 0
          ? await ctx.db.clipperApplication.findMany({
              where: { id: { in: topGroups.map((row) => row.applicationId) } },
              select: {
                id: true,
                clipperProfileId: true,
                clipperProfile: {
                  select: {
                    fullName: true,
                    artisticName: true,
                    user: { select: { imageUrl: true } },
                  },
                },
              },
            })
          : [];
      const applicationById = new Map(
        applications.map((application) => [application.id, application]),
      );

      const entries = topGroups.flatMap((row, index) => {
        const application = applicationById.get(row.applicationId);
        if (!application) return [];
        const profile = application.clipperProfile;
        return [
          {
            position: index + 1,
            clipperProfileId: application.clipperProfileId,
            clipperName: getClipperRankingDisplayName(profile),
            fullName: getFirstName(profile.fullName) || "Clipador",
            imageUrl: profile.user.imageUrl,
            prize: getTopClippersPrize(prizeTable, index + 1),
            totalPosts: row.totalPosts,
            totalViews: row.totalViews,
            campaigns: [
              {
                campaignId: input.campaignId,
                campaignName: campaignConfig.name,
                posts: row.totalPosts,
                views: row.totalViews,
              },
            ],
          },
        ];
      });

      return {
        date: input.date,
        windowStart: startDate.toISOString(),
        windowEnd: endDate.toISOString(),
        campaignIds: [input.campaignId],
        prizeTable,
        entries,
        stats: {
          totalPostsInWindow,
          totalViewsInWindow,
          totalClippersWithPosts: groups.length,
          totalCampaigns: 1,
        },
      };
    }),

  /**
   * Simula ou executa pagamentos PRIZE_CREDIT do top do rank diário (data UTC),
   * alinhado ao preview (`previewDailyRankByDate`) e ao `processPayment`.
   */
  payDailyRankByDate: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dryRun: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const core = await loadDailyRankingDateContext(
          ctx.db,
          input.campaignId,
          input.date,
          { includeStats: false },
        );

        if (!core) {
          const campaignExists = await ctx.db.campaign.findUnique({
            where: { id: input.campaignId },
            select: { id: true },
          });
          throw new TRPCError({
            code: "NOT_FOUND",
            message: campaignExists
              ? `Nenhum ranking diário para a data UTC ${input.date}`
              : "Campanha não encontrada",
          });
        }

        const prizeTable = parsePrizeTable(core.dailyPrizeTable);
        const dateFormatted = new Date(
          `${input.date}T12:00:00.000Z`,
        ).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "UTC",
        });

        type PlanRow =
          | {
              kind: "payable";
              position: number;
              dailyRankingEntryId: string;
              clipPostId: string;
              clipperProfileId: string;
              clipperName: string;
              fullName: string;
              amount: number;
            }
          | {
              kind: "skip";
              position: number;
              clipperName: string;
              fullName: string;
              amount: number;
              skipReason: string;
            };

        const plan: PlanRow[] = [];

        const dreStatusMap = new Map<
          string,
          {
            clipPostId: string;
            dailyPrizeStatus: string;
            isDisqualified: boolean;
          }
        >();
        const dres =
          core.rawRows.length > 0
            ? await ctx.db.dailyRankingEntry.findMany({
                where: {
                  id: { in: core.rawRows.map((row) => row.dailyRankingEntryId) },
                },
                select: {
                  id: true,
                  clipPostId: true,
                  dailyPrizeStatus: true,
                  isDisqualified: true,
                },
              })
            : [];
        for (const { id, ...dre } of dres) {
          dreStatusMap.set(id, dre);
        }

        const activeRows = core.rawRows.filter((row) => {
          const dre = dreStatusMap.get(row.dailyRankingEntryId);
          return dre && !dre.isDisqualified;
        });

        const topRows = activeRows.slice(0, core.topCount);
        const topClipPosts =
          topRows.length > 0
            ? await ctx.db.clipPost.findMany({
                where: { id: { in: topRows.map((row) => row.clipPostId) } },
                select: { id: true, status: true },
              })
            : [];
        const clipPostStatusById = new Map(
          topClipPosts.map((clipPost) => [clipPost.id, clipPost.status]),
        );

        for (let index = 0; index < topRows.length; index++) {
          const row = topRows[index]!;
          const position = index + 1;
          const amount = getPrizeForPosition(prizeTable, position);
          const clipperName = getClipperRankingDisplayName(row);
          const fullName = getFirstName(row.fullName);
          const dre = dreStatusMap.get(row.dailyRankingEntryId)!;

          if (dre.clipPostId !== row.clipPostId) {
            plan.push({
              kind: "skip",
              position,
              clipperName,
              fullName,
              amount,
              skipReason: "Inconsistência entre entrada e clip",
            });
            continue;
          }

          if (
            clipPostStatusById.get(row.clipPostId) ===
            ClipPostStatus.DISQUALIFIED
          ) {
            plan.push({
              kind: "skip",
              position,
              clipperName,
              fullName,
              amount,
              skipReason: "Post desqualificado",
            });
            continue;
          }

          if (dre.dailyPrizeStatus === "PAID") {
            plan.push({
              kind: "skip",
              position,
              clipperName,
              fullName,
              amount,
              skipReason: "Prêmio diário já marcado como pago",
            });
            continue;
          }

          if (amount <= 0) {
            plan.push({
              kind: "skip",
              position,
              clipperName,
              fullName,
              amount,
              skipReason: "Sem valor de prêmio para esta posição",
            });
            continue;
          }

          plan.push({
            kind: "payable",
            position,
            dailyRankingEntryId: row.dailyRankingEntryId,
            clipPostId: row.clipPostId,
            clipperProfileId: row.clipperProfileId,
            clipperName,
            fullName,
            amount,
          });
        }

        const payable = plan.filter(
          (p): p is Extract<PlanRow, { kind: "payable" }> =>
            p.kind === "payable",
        );
        const skipped = plan.filter(
          (p): p is Extract<PlanRow, { kind: "skip" }> => p.kind === "skip",
        );
        const totalAmount = payable.reduce((s, p) => s + p.amount, 0);

        if (input.dryRun) {
          return {
            dryRun: true as const,
            date: input.date,
            campaignId: core.campaignId,
            campaignName: core.campaignName,
            totalAmount,
            payableCount: payable.length,
            skippedCount: skipped.length,
            payable: payable.map((p) => ({
              position: p.position,
              clipperName: p.clipperName,
              fullName: p.fullName,
              amount: p.amount,
            })),
            skipped: skipped.map((s) => ({
              position: s.position,
              clipperName: s.clipperName,
              fullName: s.fullName,
              amount: s.amount,
              reason: s.skipReason,
            })),
          };
        }

        const paid: {
          position: number;
          clipperName: string;
          amount: number;
          transactionId: string;
        }[] = [];

        const failed: {
          position: number;
          clipperName: string;
          amount: number;
          error: string;
        }[] = [];

        for (const line of payable) {
          const description = `Prêmio ${line.position}º lugar - Ranking Diário ${dateFormatted}`;
          try {
            let newTransactionId = "";
            await withPrismaTransactionRetry(() =>
              ctx.db.$transaction(
                async (tx) => {
                  const currentEntry = await tx.dailyRankingEntry.findUnique({
                    where: { id: line.dailyRankingEntryId },
                    select: {
                      dailyPrizeStatus: true,
                      isDisqualified: true,
                    },
                  });
                  if (!currentEntry || currentEntry.isDisqualified) {
                    throw new Error(
                      "Entrada do ranking não encontrada ou desclassificada",
                    );
                  }
                  if (currentEntry.dailyPrizeStatus === "PAID") {
                    throw new Error("Prêmio diário já marcado como pago");
                  }

                  let wallet = await tx.wallet.findUnique({
                    where: { clipperProfileId: line.clipperProfileId },
                  });

                  if (!wallet) {
                    wallet = await tx.wallet.create({
                      data: {
                        clipperProfileId: line.clipperProfileId,
                        balance: 0,
                        totalEarned: 0,
                        totalWithdrawn: 0,
                        pendingWithdraw: 0,
                        currency: "BRL",
                        isActive: true,
                      },
                    });
                  }

                  const txRow = await tx.transaction.create({
                    data: {
                      walletId: wallet.id,
                      type: "PRIZE_CREDIT",
                      status: "COMPLETED",
                      amount: line.amount,
                      balanceBefore: wallet.balance,
                      balanceAfter: wallet.balance + line.amount,
                      description,
                      campaignId: input.campaignId,
                      clipPostId: line.clipPostId,
                      rankingPosition: line.position,
                      idempotencyKey: `daily-ranking-prize:entry:${line.dailyRankingEntryId}`,
                      processedBy: ctx.userId,
                      processedAt: new Date(),
                      metadata: {
                        source: "daily_ranking_prize",
                        date: input.date,
                        dailyRankingId: core.dailyRankingId,
                        dailyRankingEntryId: line.dailyRankingEntryId,
                      },
                    },
                  });
                  newTransactionId = txRow.id;

                  await tx.wallet.update({
                    where: { id: wallet.id },
                    data: {
                      balance: { increment: line.amount },
                      totalEarned: { increment: line.amount },
                    },
                  });

                  await tx.dailyRankingEntry.update({
                    where: { id: line.dailyRankingEntryId },
                    data: {
                      dailyPrizeStatus: "PAID",
                      dailyPrizeAmount: line.amount,
                    },
                  });

                  await tx.auditLog.create({
                    data: {
                      userId: ctx.userId,
                      action: "CREATE",
                      entityType: "Transaction",
                      entityId: txRow.id,
                      campaignId: input.campaignId,
                      changes: {
                        action: "daily_ranking_prize_payment",
                        clipperProfileId: line.clipperProfileId,
                        amount: line.amount,
                        position: line.position,
                        dailyRankingEntryId: line.dailyRankingEntryId,
                        clipPostId: line.clipPostId,
                      },
                    },
                  });
                },
                {
                  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
                  maxWait: 10_000,
                  timeout: 15_000,
                },
              ),
            );

            paid.push({
              position: line.position,
              clipperName: line.clipperName,
              amount: line.amount,
              transactionId: newTransactionId,
            });

            const clipperProfile = await ctx.db.clipperProfile.findUnique({
              where: { id: line.clipperProfileId },
              include: {
                user: {
                  select: { email: true },
                },
              },
            });

            const walletAfter = await ctx.db.wallet.findUnique({
              where: { clipperProfileId: line.clipperProfileId },
              select: { balance: true },
            });

            if (clipperProfile?.user?.email && walletAfter !== null) {
              const emailHtml = getPaymentNotificationEmailTemplate(
                clipperProfile.fullName,
                line.amount,
                "PRIZE_CREDIT",
                description,
                walletAfter.balance,
                core.campaignName,
                line.position,
                "daily",
              );

              resend.emails
                .send({
                  from: "ClipfyAI <noreply@league.clipfyai.com>",
                  to: clipperProfile.user.email,
                  subject: `🏆 Pagamento Recebido: ${new Intl.NumberFormat(
                    "pt-BR",
                    {
                      style: "currency",
                      currency: "BRL",
                    },
                  ).format(line.amount)}`,
                  html: emailHtml,
                })
                .then(() => {
                  console.log(
                    `✅ Email de prêmio diário enviado para ${clipperProfile.user?.email}`,
                  );
                })
                .catch((err: unknown) => {
                  console.error("Erro ao enviar email de prêmio diário:", err);
                });
            }
          } catch (err: unknown) {
            const msg =
              err instanceof Error
                ? err.message
                : "Erro ao processar pagamento";

            const confirmedPayment = await ctx.db.transaction.findFirst({
              where: {
                campaignId: input.campaignId,
                type: "PRIZE_CREDIT",
                status: "COMPLETED",
                metadata: {
                  path: ["dailyRankingEntryId"],
                  equals: line.dailyRankingEntryId,
                },
              },
              select: { id: true },
            });
            const confirmedEntry = await ctx.db.dailyRankingEntry.findUnique({
              where: { id: line.dailyRankingEntryId },
              select: { dailyPrizeStatus: true },
            });
            if (
              confirmedPayment &&
              confirmedEntry?.dailyPrizeStatus === "PAID"
            ) {
              paid.push({
                position: line.position,
                clipperName: line.clipperName,
                amount: line.amount,
                transactionId: confirmedPayment.id,
              });
              continue;
            }

            failed.push({
              position: line.position,
              clipperName: line.clipperName,
              amount: line.amount,
              error: msg,
            });
            await ctx.db.auditLog
              .create({
                data: {
                  userId: ctx.userId,
                  action: "CREATE",
                  entityType: "DailyRankingEntry",
                  entityId: line.dailyRankingEntryId,
                  campaignId: input.campaignId,
                  changes: {
                    action: "daily_ranking_prize_payment_failed",
                    clipperProfileId: line.clipperProfileId,
                    amount: line.amount,
                    position: line.position,
                    dailyRankingId: core.dailyRankingId,
                    dailyRankingEntryId: line.dailyRankingEntryId,
                    clipPostId: line.clipPostId,
                    error: msg,
                  },
                },
              })
              .catch((auditError: unknown) => {
                console.error("payDailyRankByDate failure audit:", auditError);
              });
            console.error("payDailyRankByDate item:", err);
          }
        }

        return {
          dryRun: false as const,
          date: input.date,
          campaignId: core.campaignId,
          campaignName: core.campaignName,
          totalAmountPaid: paid.reduce((s, p) => s + p.amount, 0),
          paid,
          failed,
          skipped: skipped.map((s) => ({
            position: s.position,
            clipperName: s.clipperName,
            amount: s.amount,
            reason: s.skipReason,
          })),
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) {
          throw error;
        }
        const message =
          error instanceof Error
            ? error.message
            : "Erro ao pagar ranking diário";
        console.error("payDailyRankByDate:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  previewMonthlyRankByPeriod: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const campaign = await ctx.db.campaign.findUnique({
          where: { id: input.campaignId },
          select: { id: true, name: true, endDate: true },
        });
        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campanha não encontrada",
          });
        }

        const board = await computeMonthlyLeaderboard(ctx.db, input.campaignId);
        if (!board) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Campanha sem regra de ranking ativa. Configure a regra mensal para ver o rank.",
          });
        }

        const prizeTable = parsePrizeTable(board.monthlyPrizeTable);

        const entries = board.rows.map((row) => {
          const prize = getPrizeForPosition(prizeTable, row.position);
          return {
            position: row.position,
            monthlyRankingEntryId: row.monthlyRankingEntryId,
            clipperProfileId: row.clipperProfileId,
            applicationId: row.applicationId,
            clipperName: row.clipperUsername || row.clipperName,
            fullName: row.clipperName,
            totalViews: row.totalViews,
            totalLikes: row.totalLikes,
            totalComments: row.totalComments,
            totalShares: row.totalShares,
            totalSaves: row.totalSaves,
            postsCount: row.postsCount,
            engagementRate: row.engagementRate,
            rankingScore: row.rankingScore,
            prize,
            prizeStatus: "PENDING",
            prizeAmountPaid: 0,
          };
        });

        const canUndoRankPayments = false;

        const [totalPostsInMonth, totalCompetitionViews] = await Promise.all([
          ctx.db.clipPost.count({
            where: {
              campaignId: input.campaignId,
              status: "ELIGIBLE",
            },
          }),
          getTotalViewsAtRankingCutoff(
            ctx.db,
            input.campaignId,
            campaign.endDate,
          ),
        ]);

        return {
          campaignId: campaign.id,
          campaignName: campaign.name,
          monthPeriod: board.monthPeriod,
          monthlyRankingId: board.monthlyRankingId,
          sortedByEngagement:
            board.metricType === RankingMetricType.VIEWS_X_ENGAGEMENT,
          topCount: board.monthlyTopCount,
          windowStart: board.windowStart?.toISOString() ?? null,
          windowEnd: board.windowEnd?.toISOString() ?? null,
          entries,
          canUndoRankPayments,
          stats: {
            totalPostsInMonth,
            totalCompetitionViews: totalCompetitionViews.toString(),
          },
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        const message =
          error instanceof Error
            ? error.message
            : "Erro ao gerar preview do rank mensal";
        console.error("previewMonthlyRankByPeriod:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  payMonthlyRankByPeriod: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        dryRun: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const campaign = await ctx.db.campaign.findUnique({
          where: { id: input.campaignId },
          select: { id: true, name: true },
        });
        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campanha não encontrada",
          });
        }

        const board = await computeMonthlyLeaderboard(ctx.db, input.campaignId);
        if (!board) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Campanha sem regra de ranking ativa. Configure a regra mensal para pagar o rank.",
          });
        }

        const prizeTable = parsePrizeTable(board.monthlyPrizeTable);
        const monthLabel = board.monthPeriod.trim()
          ? board.monthPeriod
          : "acumulado";

        type PlanRow =
          | {
              kind: "payable";
              position: number;
              clipperProfileId: string;
              clipperName: string;
              fullName: string;
              amount: number;
            }
          | {
              kind: "skip";
              position: number;
              clipperName: string;
              fullName: string;
              amount: number;
              skipReason: string;
            };

        const plan: PlanRow[] = [];

        // Prêmios mensais já creditados, para todas as posições premiadas de
        // uma vez (mesmo critério da consulta por posição e clipador)
        const prizedRows = board.rows.filter(
          (row) => getPrizeForPosition(prizeTable, row.position) > 0,
        );
        const priorPrizes =
          prizedRows.length > 0
            ? await ctx.db.transaction.findMany({
                where: {
                  campaignId: input.campaignId,
                  type: "PRIZE_CREDIT",
                  status: "COMPLETED",
                  clipPostId: null,
                  description: { contains: "Ranking Mensal" },
                  OR: prizedRows.map((row) => ({
                    rankingPosition: row.position,
                    wallet: { clipperProfileId: row.clipperProfileId },
                  })),
                },
                select: {
                  rankingPosition: true,
                  wallet: { select: { clipperProfileId: true } },
                },
              })
            : [];
        const priorPrizeKeys = new Set(
          priorPrizes.map(
            (prize) =>
              `${prize.rankingPosition}:${prize.wallet.clipperProfileId}`,
          ),
        );

        for (const row of board.rows) {
          const position = row.position;
          const amount = getPrizeForPosition(prizeTable, position);
          const clipperName = row.clipperUsername || row.clipperName;
          const fullName = row.clipperName || "";

          if (amount <= 0) {
            plan.push({
              kind: "skip",
              position,
              clipperName,
              fullName,
              amount,
              skipReason: "Sem valor de prêmio para esta posição",
            });
            continue;
          }

          if (priorPrizeKeys.has(`${position}:${row.clipperProfileId}`)) {
            plan.push({
              kind: "skip",
              position,
              clipperName,
              fullName,
              amount,
              skipReason: "Prêmio mensal já creditado para esta posição",
            });
            continue;
          }

          plan.push({
            kind: "payable",
            position,
            clipperProfileId: row.clipperProfileId,
            clipperName,
            fullName,
            amount,
          });
        }

        const payable = plan.filter(
          (p): p is Extract<PlanRow, { kind: "payable" }> =>
            p.kind === "payable",
        );
        const skipped = plan.filter(
          (p): p is Extract<PlanRow, { kind: "skip" }> => p.kind === "skip",
        );
        const totalAmount = payable.reduce((s, p) => s + p.amount, 0);

        if (input.dryRun) {
          return {
            dryRun: true as const,
            monthPeriod: board.monthPeriod,
            campaignId: campaign.id,
            campaignName: campaign.name,
            totalAmount,
            payableCount: payable.length,
            skippedCount: skipped.length,
            payable: payable.map((p) => ({
              position: p.position,
              clipperName: p.clipperName,
              fullName: p.fullName,
              amount: p.amount,
            })),
            skipped: skipped.map((s) => ({
              position: s.position,
              clipperName: s.clipperName,
              fullName: s.fullName,
              amount: s.amount,
              reason: s.skipReason,
            })),
          };
        }

        const paid: {
          position: number;
          clipperName: string;
          amount: number;
          transactionId: string;
        }[] = [];

        const failed: {
          position: number;
          clipperName: string;
          amount: number;
          error: string;
        }[] = [];

        for (const line of payable) {
          const description = `Prêmio ${line.position}º lugar - Ranking Mensal ${monthLabel} — ${campaign.name}`;
          const aggregateMeta: Prisma.InputJsonValue = {
            source: "monthly_ranking_prize_aggregate",
            campaignId: input.campaignId,
            rankingPosition: line.position,
          };
          try {
            let newTransactionId = "";
            await ctx.db.$transaction(async (tx) => {
              await tx.$executeRaw`
                SELECT id FROM "ClipperApplication"
                WHERE "campaignId" = ${input.campaignId} AND "clipperProfileId" = ${line.clipperProfileId}
                FOR UPDATE
              `;
              const stillParticipating = await tx.clipperApplication.findFirst({
                where: { campaignId: input.campaignId, clipperProfileId: line.clipperProfileId, status: "APPROVED" },
                select: { id: true },
              });
              if (!stillParticipating) {
                throw new TRPCError({ code: "CONFLICT", message: "O clipador não participa mais da competição. Recalcule o ranking antes de pagar." });
              }

              let wallet = await tx.wallet.findUnique({
                where: { clipperProfileId: line.clipperProfileId },
              });

              if (!wallet) {
                wallet = await tx.wallet.create({
                  data: {
                    clipperProfileId: line.clipperProfileId,
                    balance: 0,
                    totalEarned: 0,
                    totalWithdrawn: 0,
                    pendingWithdraw: 0,
                    currency: "BRL",
                    isActive: true,
                  },
                });
              }

              const dupAgg = await tx.transaction.findFirst({
                where: {
                  campaignId: input.campaignId,
                  type: "PRIZE_CREDIT",
                  status: "COMPLETED",
                  rankingPosition: line.position,
                  clipPostId: null,
                  wallet: { clipperProfileId: line.clipperProfileId },
                  metadata: { equals: aggregateMeta },
                },
              });
              if (dupAgg) {
                throw new Error(
                  "Prêmio mensal agregado já registrado para esta posição",
                );
              }

              const txRow = await tx.transaction.create({
                data: {
                  walletId: wallet.id,
                  type: "PRIZE_CREDIT",
                  status: "COMPLETED",
                  amount: line.amount,
                  balanceBefore: wallet.balance,
                  balanceAfter: wallet.balance + line.amount,
                  description,
                  campaignId: input.campaignId,
                  clipPostId: null,
                  rankingPosition: line.position,
                  processedBy: ctx.userId,
                  processedAt: new Date(),
                  metadata: aggregateMeta,
                },
              });
              newTransactionId = txRow.id;

              await tx.wallet.update({
                where: { id: wallet.id },
                data: {
                  balance: { increment: line.amount },
                  totalEarned: { increment: line.amount },
                },
              });

              await tx.auditLog.create({
                data: {
                  userId: ctx.userId,
                  action: "CREATE",
                  entityType: "Transaction",
                  entityId: txRow.id,
                  campaignId: input.campaignId,
                  changes: {
                    action: "monthly_ranking_prize_payment",
                    clipperProfileId: line.clipperProfileId,
                    amount: line.amount,
                    position: line.position,
                    monthPeriod: board.monthPeriod || null,
                    monthlyRankingAggregate: true,
                  },
                },
              });
            });

            paid.push({
              position: line.position,
              clipperName: line.clipperName,
              amount: line.amount,
              transactionId: newTransactionId,
            });

            const clipperProfile = await ctx.db.clipperProfile.findUnique({
              where: { id: line.clipperProfileId },
              include: {
                user: {
                  select: { email: true },
                },
              },
            });

            const walletAfter = await ctx.db.wallet.findUnique({
              where: { clipperProfileId: line.clipperProfileId },
              select: { balance: true },
            });

            if (clipperProfile?.user?.email && walletAfter !== null) {
              const emailHtml = getPaymentNotificationEmailTemplate(
                clipperProfile.fullName,
                line.amount,
                "PRIZE_CREDIT",
                description,
                walletAfter.balance,
                campaign.name,
                line.position,
                "monthly",
              );

              resend.emails
                .send({
                  from: "ClipfyAI <noreply@league.clipfyai.com>",
                  to: clipperProfile.user.email,
                  subject: `🏆 Pagamento Recebido: ${new Intl.NumberFormat(
                    "pt-BR",
                    {
                      style: "currency",
                      currency: "BRL",
                    },
                  ).format(line.amount)}`,
                  html: emailHtml,
                })
                .then(() => {
                  console.log(
                    `✅ Email de prêmio mensal enviado para ${clipperProfile.user?.email}`,
                  );
                })
                .catch((err: unknown) => {
                  console.error("Erro ao enviar email de prêmio mensal:", err);
                });
            }
          } catch (err: unknown) {
            const msg =
              err instanceof Error
                ? err.message
                : "Erro ao processar pagamento";
            failed.push({
              position: line.position,
              clipperName: line.clipperName,
              amount: line.amount,
              error: msg,
            });
            console.error("payMonthlyRankByPeriod item:", err);
          }
        }

        return {
          dryRun: false as const,
          monthPeriod: board.monthPeriod,
          campaignId: campaign.id,
          campaignName: campaign.name,
          totalAmountPaid: paid.reduce((s, p) => s + p.amount, 0),
          paid,
          failed,
          skipped: skipped.map((s) => ({
            position: s.position,
            clipperName: s.clipperName,
            amount: s.amount,
            reason: s.skipReason,
          })),
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        const message =
          error instanceof Error
            ? error.message
            : "Erro ao pagar ranking mensal";
        console.error("payMonthlyRankByPeriod:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  /**
   * Prévia do payout PIX (Asaas) para o ranking diário do dia UTC.
   */
  getDailyRankingPixPayoutStatus: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .query(async ({ ctx, input }) => {
      const gate = await computeDailyPixPayoutSettledGate(
        ctx.db,
        input.campaignId,
        input.date,
      );
      if (!gate || gate.prizeCount === 0) {
        return { status: "NOT_READY" as const };
      }
      if (gate.isSettled) return { status: "COMPLETED" as const };
      if (gate.processingTransactionCount > 0) {
        return { status: "PROCESSING" as const };
      }
      const queued = await ctx.db.dailyRankingEntry.count({
        where: {
          dailyRankingId: gate.core.dailyRankingId,
          dailyPixStatus: "QUEUED",
        },
      });
      if (queued > 0) return { status: "QUEUED" as const };
      if (gate.unsettledCount < gate.prizeCount) {
        return { status: "PARTIAL" as const };
      }
      return { status: "PENDING" as const };
    }),

  getTopPostersPixPayoutStatus: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .query(async ({ ctx, input }) => {
      const credits = await ctx.db.transaction.findMany({
        where: {
          campaignId: input.campaignId,
          type: "PRIZE_CREDIT",
          status: "COMPLETED",
          metadata: { path: ["source"], equals: "top_posters_daily_rank" },
          AND: { metadata: { path: ["date"], equals: input.date } },
        },
        select: {
          id: true,
          amount: true,
          rankingPosition: true,
          wallet: {
            select: {
              clipperProfile: {
                select: { fullName: true, artisticName: true },
              },
            },
          },
        },
        orderBy: { rankingPosition: "asc" },
      });
      const reversals = await ctx.db.transaction.findMany({
        where: {
          campaignId: input.campaignId,
          type: "ADJUSTMENT",
          status: "COMPLETED",
        },
        select: { metadata: true },
      });
      const reversedCreditIds = new Set(
        reversals
          .map((row) => {
            const metadata = row.metadata as {
              reversedPrizeCreditId?: unknown;
            } | null;
            return typeof metadata?.reversedPrizeCreditId === "string"
              ? metadata.reversedPrizeCreditId
              : null;
          })
          .filter((id): id is string => Boolean(id)),
      );
      const activeCredits = credits.filter(
        (credit) => !reversedCreditIds.has(credit.id),
      );
      const idempotencyKeys = activeCredits.map(
        (credit) =>
          `top_posters_daily_pix:${input.campaignId}:${input.date}:${credit.id}`,
      );
      const payouts = idempotencyKeys.length
        ? await ctx.db.transaction.findMany({
            where: { idempotencyKey: { in: idempotencyKeys } },
            select: {
              id: true,
              idempotencyKey: true,
              status: true,
              proofUrls: true,
              failureReason: true,
            },
          })
        : [];
      const payoutByKey = new Map(
        payouts.map((payout) => [payout.idempotencyKey, payout]),
      );
      const retryId = `top-posters:${input.campaignId}:${input.date}`;
      const queuedRetry = await ctx.db.$queryRaw<Array<{ nextAttemptAt: Date }>>`
        SELECT "nextAttemptAt" FROM "PixPayoutRetry"
        WHERE "dailyRankingId" = ${retryId}
          AND "status" IN ('PENDING', 'RUNNING')
        LIMIT 1
      `;
      const isQueued = queuedRetry.length > 0;
      const lines = activeCredits.map((credit) => {
        const key = `top_posters_daily_pix:${input.campaignId}:${input.date}:${credit.id}`;
        const payout = payoutByKey.get(key);
        return {
          position: credit.rankingPosition,
          clipperName:
            credit.wallet.clipperProfile.artisticName ||
            credit.wallet.clipperProfile.fullName,
          amount: credit.amount,
          status: payout?.status === "COMPLETED" || payout?.status === "PROCESSING"
            ? payout.status
            : isQueued ? ("QUEUED" as const) : payout?.status ?? ("PENDING" as const),
          transactionId: payout?.id ?? null,
          proofUrl: payout?.proofUrls[0] ?? null,
          failureReason: payout?.failureReason ?? null,
        };
      });
      const completed = lines.filter(
        (line) => line.status === "COMPLETED",
      ).length;
      const processing = lines.filter(
        (line) => line.status === "PROCESSING",
      ).length;
      const failed = lines.filter((line) => line.status === "FAILED").length;
      const pending = lines.filter((line) => line.status === "PENDING").length;
      const queued = lines.filter((line) => line.status === "QUEUED").length;
      let status:
        | "NOT_READY"
        | "PENDING"
        | "PROCESSING"
        | "QUEUED"
        | "PARTIAL"
        | "FAILED"
        | "COMPLETED" = "NOT_READY";
      if (lines.length > 0) {
        if (completed === lines.length) status = "COMPLETED";
        else if (processing > 0 && completed === 0 && failed === 0) {
          status = "PROCESSING";
        } else if (failed === lines.length) status = "FAILED";
        else if (pending === lines.length) status = "PENDING";
        else status = "PARTIAL";
      }
      return {
        status,
        total: lines.length,
        completed,
        processing,
        failed,
        pending,
        queued,
        nextAttemptAt: queuedRetry[0]?.nextAttemptAt ?? null,
        lines,
      };
    }),

  previewTopPostersPixPayout: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.db.campaign.findUnique({
        where: { id: input.campaignId },
        select: { dailyPix: true, topClippersRankingEnabled: true },
      });
      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campanha não encontrada",
        });
      }
      if (!campaign.dailyPix || !campaign.topClippersRankingEnabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "O PIX diário e o Top Postadores precisam estar habilitados.",
        });
      }
      try {
        return await fetchTopPostersPayoutPreview(input.campaignId, input.date);
      } catch (error) {
        if (error instanceof DailyPayoutConfigError) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: error.message,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Erro na prévia PIX do Top Postadores",
        });
      }
    }),

  executeTopPostersPixPayout: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.db.campaign.findUnique({
        where: { id: input.campaignId },
        select: { dailyPix: true, topClippersRankingEnabled: true },
      });
      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campanha não encontrada",
        });
      }
      if (!campaign.dailyPix || !campaign.topClippersRankingEnabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "O PIX diário e o Top Postadores precisam estar habilitados.",
        });
      }
      try {
        return await fetchTopPostersPayoutPay(input.campaignId, input.date);
      } catch (error) {
        if (error instanceof DailyPayoutConfigError) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: error.message,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Erro no PIX do Top Postadores",
        });
      }
    }),

  previewDailyPixPayout: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const campaign = await ctx.db.campaign.findUnique({
          where: { id: input.campaignId },
          select: { id: true, dailyPix: true },
        });
        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campanha não encontrada",
          });
        }
        if (!campaign.dailyPix) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Esta competição não está configurada para pagamento PIX do rank diário.",
          });
        }

        const core = await loadDailyRankingDateContext(
          ctx.db,
          input.campaignId,
          input.date,
          { includeStats: false },
        );
        if (!core) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Nenhum ranking diário para a data UTC ${input.date}`,
          });
        }

        const pixGate = await computeDailyPixPayoutSettledGate(
          ctx.db,
          input.campaignId,
          input.date,
        );
        if (pixGate?.isSettled) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "O pagamento PIX deste ranking diário já foi concluído.",
          });
        }

        const raw = await fetchDailyPayoutPreview(core.dailyRankingId);
        return raw;
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        if (error instanceof DailyPayoutConfigError) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: error.message,
          });
        }
        const message =
          error instanceof Error
            ? error.message
            : "Erro ao obter prévia PIX do ranking diário";
        console.error("previewDailyPixPayout:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),

  /**
   * Executa payout PIX via serviço interno e registra WITHDRAWAL_COMPLETED por linha SUCCESS.
   * Exige que o lote do dia já tenha sido pago na carteira (PRIZE_CREDIT).
   */
  executeDailyPixPayout: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const payResultSchema = z.object({
        dailyRankingId: z.string(),
        totalPrizeAmount: z.number(),
        lines: z.array(
          z.object({
            entryId: z.string(),
            position: z.number(),
            status: z.string(),
            prizeAmount: z.number().optional(),
            asaasTransferId: z.string().optional(),
            asaasPayoutReceiptUrl: z.string().nullable().optional(),
            error: z.string().optional(),
            nextAttemptAt: z.string().optional(),
          }),
        ),
      });

      try {
        const campaign = await ctx.db.campaign.findUnique({
          where: { id: input.campaignId },
          select: { id: true, name: true, dailyPix: true },
        });
        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campanha não encontrada",
          });
        }
        if (!campaign.dailyPix) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Esta competição não está configurada para pagamento PIX do rank diário.",
          });
        }

        const gate = await computeDailyRankWalletPaidGate(
          ctx.db,
          input.campaignId,
          input.date,
        );
        if (!gate) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Nenhum ranking diário para a data UTC ${input.date}`,
          });
        }
        if (!gate.canUndoRankPayments) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Conclua primeiro o pagamento do rank na carteira (botão “Pagar rank”) antes de executar o PIX.",
          });
        }

        const { core } = gate;
        const pixGateBeforePay = await computeDailyPixPayoutSettledGate(
          ctx.db,
          input.campaignId,
          input.date,
        );
        if (pixGateBeforePay?.isSettled) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "O pagamento PIX deste ranking diário já foi concluído.",
          });
        }

        const dateFormatted = new Date(
          `${input.date}T12:00:00.000Z`,
        ).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "UTC",
        });

        const rawPay = await fetchDailyPayoutPay(core.dailyRankingId);
        const parsed = payResultSchema.safeParse(rawPay);
        if (!parsed.success) {
          console.error(
            "executeDailyPixPayout: resposta inválida",
            parsed.error.flatten(),
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Resposta inválida do serviço de payout PIX.",
          });
        }
        const pay = parsed.data;

        const ledgerLines: {
          entryId: string;
          position: number;
          status: string;
          prizeAmount?: number;
          transactionId?: string;
          skipped?: string;
          error?: string;
          asaasTransferId?: string;
          asaasPayoutReceiptUrl?: string | null;
        }[] = [];

        const existingWithdrawals = await ctx.db.transaction.findMany({
          where: {
            campaignId: input.campaignId,
            type: "WITHDRAWAL_COMPLETED",
            status: "COMPLETED",
          },
          select: { id: true, metadata: true },
        });

        const alreadyPixEntryIds = new Set<string>();
        for (const t of existingWithdrawals) {
          const m = t.metadata as {
            source?: string;
            dailyRankingEntryId?: string;
          } | null;
          if (m?.source === "daily_ranking_pix" && m?.dailyRankingEntryId) {
            alreadyPixEntryIds.add(m.dailyRankingEntryId);
          }
        }

        for (const line of pay.lines) {
          if (line.status === "SKIPPED_ALREADY_PAID") {
            ledgerLines.push({
              entryId: line.entryId,
              position: line.position,
              status: line.status,
              skipped: "Serviço indicou já pago; ledger local não alterado.",
            });
            continue;
          }

          if (line.status === "SKIPPED_PIX_IGNORED") {
            ledgerLines.push({
              entryId: line.entryId,
              position: line.position,
              status: line.status,
              prizeAmount: line.prizeAmount,
              skipped:
                "Serviço indicou PIX ignorado para este perfil; ledger local não alterado.",
            });
            continue;
          }

          if (line.status === "QUEUED") {
            ledgerLines.push({
              entryId: line.entryId,
              position: line.position,
              status: line.status,
              prizeAmount: line.prizeAmount,
              skipped: `PIX agendado para ${line.nextAttemptAt ?? "após a janela do Asaas"}.`,
            });
            continue;
          }

          if (line.status === "PROCESSING") {
            ledgerLines.push({
              entryId: line.entryId,
              position: line.position,
              status: line.status,
              prizeAmount: line.prizeAmount,
              asaasTransferId: line.asaasTransferId,
              asaasPayoutReceiptUrl: line.asaasPayoutReceiptUrl ?? null,
              skipped:
                "Transferência criada na Asaas; aguardando confirmação via webhook.",
            });
            continue;
          }

          if (line.status !== "SUCCESS") {
            ledgerLines.push({
              entryId: line.entryId,
              position: line.position,
              status: line.status,
              prizeAmount: line.prizeAmount,
              error: line.error,
            });
            continue;
          }

          const prizeAmount = line.prizeAmount ?? 0;
          if (prizeAmount <= 0) {
            ledgerLines.push({
              entryId: line.entryId,
              position: line.position,
              status: "FAILED",
              error: "Valor de prêmio inválido na linha SUCCESS.",
            });
            continue;
          }

          if (alreadyPixEntryIds.has(line.entryId)) {
            ledgerLines.push({
              entryId: line.entryId,
              position: line.position,
              status: "SKIPPED_ALREADY_PAID",
              skipped: "Transação PIX deste rank já registrada no sistema.",
            });
            continue;
          }

          const dre = await ctx.db.dailyRankingEntry.findUnique({
            where: { id: line.entryId },
            include: {
              clipPost: { select: { id: true, campaignId: true } },
            },
          });

          if (!dre || dre.clipPost.campaignId !== input.campaignId) {
            ledgerLines.push({
              entryId: line.entryId,
              position: line.position,
              status: "FAILED",
              prizeAmount,
              error:
                "Entrada do ranking não encontrada ou campanha divergente.",
            });
            continue;
          }

          const clipperProfileId = dre.clipperProfileId;
          if (!clipperProfileId) {
            ledgerLines.push({
              entryId: line.entryId,
              position: line.position,
              status: "FAILED",
              prizeAmount,
              error: "Entrada sem clipperProfileId.",
            });
            continue;
          }

          alreadyPixEntryIds.add(line.entryId);
          ledgerLines.push({
            entryId: line.entryId,
            position: line.position,
            status: "SUCCESS",
            prizeAmount,
            asaasTransferId: line.asaasTransferId,
            asaasPayoutReceiptUrl: line.asaasPayoutReceiptUrl ?? null,
          });
        }

        const pixGateAfterPay = await computeDailyPixPayoutSettledGate(
          ctx.db,
          input.campaignId,
          input.date,
        );
        if (pixGateAfterPay?.isSettled) {
          await ctx.db.dailyRanking.update({
            where: { id: core.dailyRankingId },
            data: { dailyPixPayoutCompleted: true },
          });
        } else {
          await ctx.db.dailyRanking.update({
            where: { id: core.dailyRankingId },
            data: { dailyPixPayoutCompleted: false },
          });
        }

        return {
          dailyRankingId: pay.dailyRankingId,
          totalPrizeAmount: pay.totalPrizeAmount,
          serviceLines: pay.lines,
          ledgerLines,
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        if (error instanceof DailyPayoutConfigError) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: error.message,
          });
        }
        const message =
          error instanceof Error
            ? error.message
            : "Erro ao executar payout PIX do ranking diário";
        console.error("executeDailyPixPayout:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),

  reconcileDailyPixPayout: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const reconciliationSchema = z
        .object({
          dryRun: z.boolean(),
          totals: z.object({
            transfers: z.number(),
            dailyRankings: z.number(),
            entriesUpdated: z.number(),
            transactionsUpdated: z.number(),
            dailyRankingsUpdated: z.number(),
          }),
          completionResults: z.array(
            z.object({
              dailyRankingId: z.string(),
              completed: z.boolean(),
              expectedPrizeEntries: z.number(),
              unsettledEntries: z.number(),
              blockingProcessingTransactions: z.number(),
              dailyRankingUpdated: z.boolean(),
            }),
          ),
        })
        .passthrough();

      try {
        const campaign = await ctx.db.campaign.findUnique({
          where: { id: input.campaignId },
          select: { id: true, dailyPix: true },
        });
        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campanha não encontrada",
          });
        }
        if (!campaign.dailyPix) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Esta competição não está configurada para pagamento PIX do rank diário.",
          });
        }

        const core = await loadDailyRankingDateContext(
          ctx.db,
          input.campaignId,
          input.date,
          { includeStats: false },
        );
        if (!core) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Nenhum ranking diário para a data UTC ${input.date}`,
          });
        }

        const raw = await fetchDailyPixReconciliation({
          dailyRankingId: core.dailyRankingId,
          dryRun: false,
        });
        const parsed = reconciliationSchema.safeParse(raw);
        if (!parsed.success) {
          console.error(
            "reconcileDailyPixPayout: resposta inválida",
            parsed.error.flatten(),
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Resposta inválida do reconciliador PIX.",
          });
        }

        const pixGateAfterReconcile = await computeDailyPixPayoutSettledGate(
          ctx.db,
          input.campaignId,
          input.date,
        );
        await ctx.db.dailyRanking.update({
          where: { id: core.dailyRankingId },
          data: {
            dailyPixPayoutCompleted: pixGateAfterReconcile?.isSettled ?? false,
          },
        });

        return {
          ...parsed.data,
          dailyRankingId: core.dailyRankingId,
          dailyPixPayoutCompleted: pixGateAfterReconcile?.isSettled ?? false,
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        if (error instanceof DailyPayoutConfigError) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: error.message,
          });
        }
        const message =
          error instanceof Error
            ? error.message
            : "Erro ao reconciliar PIX do ranking diário";
        console.error("reconcileDailyPixPayout:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),

  /**
   * Estorna o lote de prêmios do top do rank (mesma data/preview que payDailyRankByDate).
   * Só deve ser chamado quando todas as posições com prêmio na tabela estão PAID (use canUndoRankPayments no preview).
   */
  undoDailyRankPayments: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dryRun: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const amountsClose = (a: number, b: number) => Math.abs(a - b) < 0.01;

      try {
        const core = await loadDailyRankingDateContext(
          ctx.db,
          input.campaignId,
          input.date,
          { includeStats: false },
        );

        if (!core) {
          const campaignExists = await ctx.db.campaign.findUnique({
            where: { id: input.campaignId },
            select: { id: true },
          });
          throw new TRPCError({
            code: "NOT_FOUND",
            message: campaignExists
              ? `Nenhum ranking diário para a data UTC ${input.date}`
              : "Campanha não encontrada",
          });
        }

        const prizeTable = parsePrizeTable(core.dailyPrizeTable);
        const dateFormatted = new Date(
          `${input.date}T12:00:00.000Z`,
        ).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "UTC",
        });

        type ReverseLine = {
          position: number;
          dailyRankingEntryId: string;
          clipPostId: string;
          clipperProfileId: string;
          clipperName: string;
          amount: number;
          prizeCreditTransactionId: string;
        };

        const toReverse: ReverseLine[] = [];
        const entryIds = core.rawRows.map((row) => row.dailyRankingEntryId);
        const entryRows = await ctx.db.dailyRankingEntry.findMany({
          where: { id: { in: entryIds } },
          select: {
            id: true,
            dailyPrizeStatus: true,
            dailyPrizeAmount: true,
            isDisqualified: true,
            dailyPrizePaid: true,
            dailyPixStatus: true,
          },
        });
        const entryMap = new Map(entryRows.map((entry) => [entry.id, entry]));
        const activeRows = core.rawRows
          .filter((row) => {
            const entry = entryMap.get(row.dailyRankingEntryId);
            return entry && !entry.isDisqualified;
          })
          .slice(0, core.topCount);

        for (let index = 0; index < activeRows.length; index++) {
          const row = activeRows[index]!;
          const position = index + 1;
          const expectedPrize = getPrizeForPosition(prizeTable, position);
          if (expectedPrize <= 0) continue;

          const dre = entryMap.get(row.dailyRankingEntryId);

          if (!dre || dre.dailyPrizeStatus !== "PAID") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Desfazer indisponível: a posição ${position} precisa estar PAID no ranking (atual: ${dre?.dailyPrizeStatus ?? "—"}).`,
            });
          }

          const amount = dre.dailyPrizeAmount;
          if (amount <= 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Desfazer indisponível: posição ${position} sem valor de prêmio gravado.`,
            });
          }

          const exactPrizeTx = await ctx.db.transaction.findFirst({
            where: {
              campaignId: input.campaignId,
              clipPostId: row.clipPostId,
              type: "PRIZE_CREDIT",
              status: "COMPLETED",
              metadata: {
                path: ["dailyRankingEntryId"],
                equals: row.dailyRankingEntryId,
              },
            },
            orderBy: { createdAt: "desc" },
          });
          const prizeTx =
            exactPrizeTx ??
            (await ctx.db.transaction.findFirst({
              where: {
                campaignId: input.campaignId,
                clipPostId: row.clipPostId,
                rankingPosition: position,
                type: "PRIZE_CREDIT",
                status: "COMPLETED",
                wallet: { clipperProfileId: row.clipperProfileId },
                description: { contains: `Ranking Diário ${dateFormatted}` },
              },
              orderBy: { createdAt: "desc" },
            }));

          if (!prizeTx || !amountsClose(prizeTx.amount, amount)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Não foi encontrada transação PRIZE_CREDIT compatível com a posição ${position} (valor gravado R$ ${amount}).`,
            });
          }

          const clipperName = getClipperRankingDisplayName(row);
          toReverse.push({
            position,
            dailyRankingEntryId: row.dailyRankingEntryId,
            clipPostId: row.clipPostId,
            clipperProfileId: row.clipperProfileId,
            clipperName,
            amount,
            prizeCreditTransactionId: prizeTx.id,
          });
        }

        if (toReverse.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Não há posições com prêmio na tabela para estornar neste top.",
          });
        }

        const pixIssues = toReverse
          .filter((line) => {
            const entry = entryMap.get(line.dailyRankingEntryId);
            return (
              entry?.dailyPrizePaid ||
              entry?.dailyPixStatus === "PAID" ||
              entry?.dailyPixStatus === "PROCESSING" ||
              entry?.dailyPixStatus === "QUEUED"
            );
          })
          .map((line) => ({
            position: line.position,
            clipperName: line.clipperName,
            status:
              entryMap.get(line.dailyRankingEntryId)?.dailyPixStatus ?? "—",
          }));
        const dailyRankingState = await ctx.db.dailyRanking.findUnique({
          where: { id: core.dailyRankingId },
          select: { dailyPixPayoutCompleted: true },
        });
        if (
          dailyRankingState?.dailyPixPayoutCompleted &&
          pixIssues.length === 0
        ) {
          pixIssues.push({
            position: 0,
            clipperName: "Lote diário",
            status: "PAID",
          });
        }

        const balanceIssues: {
          position: number;
          clipperName: string;
          needed: number;
          balance: number;
        }[] = [];
        const requiredByClipper = new Map<
          string,
          { amount: number; positions: number[]; clipperName: string }
        >();
        for (const line of toReverse) {
          const current = requiredByClipper.get(line.clipperProfileId);
          if (current) {
            current.amount += line.amount;
            current.positions.push(line.position);
          } else {
            requiredByClipper.set(line.clipperProfileId, {
              amount: line.amount,
              positions: [line.position],
              clipperName: line.clipperName,
            });
          }
        }

        for (const [clipperProfileId, required] of requiredByClipper) {
          const w = await ctx.db.wallet.findUnique({
            where: { clipperProfileId },
            select: { balance: true },
          });
          const balance = w?.balance ?? 0;
          if (balance + 1e-9 < required.amount) {
            balanceIssues.push({
              position: required.positions[0]!,
              clipperName: required.clipperName,
              needed: required.amount,
              balance,
            });
          }
        }

        const totalAmount = toReverse.reduce((s, l) => s + l.amount, 0);

        if (input.dryRun) {
          return {
            dryRun: true as const,
            date: input.date,
            campaignId: core.campaignId,
            campaignName: core.campaignName,
            totalAmount,
            entryCount: toReverse.length,
            lines: toReverse.map((l) => ({
              position: l.position,
              clipperName: l.clipperName,
              amount: l.amount,
            })),
            balanceIssues,
            pixIssues,
            canExecute: balanceIssues.length === 0 && pixIssues.length === 0,
          };
        }

        if (pixIssues.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "O estorno não pode ser executado porque o PIX deste ranking está em processamento ou já foi enviado.",
          });
        }

        if (balanceIssues.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Saldo insuficiente para estornar em ${balanceIssues.length} carteira(s). Ex.: ${balanceIssues[0]!.clipperName} (pos. ${balanceIssues[0]!.position}): saldo R$ ${balanceIssues[0]!.balance.toFixed(2)}, necessário R$ ${balanceIssues[0]!.needed.toFixed(2)}.`,
          });
        }

        const reversed: {
          position: number;
          clipperName: string;
          amount: number;
          adjustmentTransactionId: string;
        }[] = [];

        try {
          const transactionResult = await ctx.db.$transaction(
            async (tx) => {
              const currentDailyRanking = await tx.dailyRanking.findUnique({
                where: { id: core.dailyRankingId },
                select: { dailyPixPayoutCompleted: true },
              });
              if (currentDailyRanking?.dailyPixPayoutCompleted) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message:
                    "O PIX deste ranking já foi concluído. Não é possível estornar a carteira.",
                });
              }

              const wallets = new Map<
                string,
                { id: string; remainingBalance: number }
              >();
              for (const [clipperProfileId, required] of requiredByClipper) {
                const wallet = await tx.wallet.findUnique({
                  where: { clipperProfileId },
                  select: { id: true, balance: true },
                });
                if (!wallet || wallet.balance + 1e-9 < required.amount) {
                  throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `Saldo insuficiente para estornar ${required.clipperName}. Saldo atual: R$ ${(wallet?.balance ?? 0).toFixed(2)}; necessário: R$ ${required.amount.toFixed(2)}.`,
                  });
                }
                wallets.set(clipperProfileId, {
                  id: wallet.id,
                  remainingBalance: wallet.balance,
                });
              }

              const result: typeof reversed = [];
              for (const line of toReverse) {
                const entry = await tx.dailyRankingEntry.findUnique({
                  where: { id: line.dailyRankingEntryId },
                  select: {
                    dailyPrizeStatus: true,
                    dailyPrizeAmount: true,
                    dailyPrizePaid: true,
                    dailyPixStatus: true,
                  },
                });
                if (
                  !entry ||
                  entry.dailyPrizeStatus !== "PAID" ||
                  !amountsClose(entry.dailyPrizeAmount, line.amount)
                ) {
                  throw new TRPCError({
                    code: "CONFLICT",
                    message: `A posição ${line.position} mudou desde a prévia. Recarregue o ranking antes de tentar novamente.`,
                  });
                }
                if (
                  entry.dailyPrizePaid ||
                  entry.dailyPixStatus === "PAID" ||
                  entry.dailyPixStatus === "PROCESSING" ||
                  entry.dailyPixStatus === "QUEUED"
                ) {
                  throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `PIX em andamento ou já enviado para a posição ${line.position} (status: ${entry.dailyPixStatus}). Não é possível reverter.`,
                  });
                }

                const wallet = wallets.get(line.clipperProfileId);
                if (!wallet) {
                  throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Carteira não encontrada",
                  });
                }
                const balanceBefore = wallet.remainingBalance;
                const balanceAfter = balanceBefore - line.amount;

                const adj = await tx.transaction.create({
                  data: {
                    walletId: wallet.id,
                    type: "ADJUSTMENT",
                    status: "COMPLETED",
                    amount: -line.amount,
                    balanceBefore,
                    balanceAfter,
                    description: `Estorno prêmio ranking diário ${dateFormatted} (${line.position}º) — reverso do lote admin`,
                    campaignId: input.campaignId,
                    clipPostId: line.clipPostId,
                    rankingPosition: line.position,
                    processedBy: ctx.userId,
                    processedAt: new Date(),
                    proofUrls: [],
                    metadata: {
                      action: "undo_daily_rank_batch",
                      reversedPrizeCreditId: line.prizeCreditTransactionId,
                      date: input.date,
                      dailyRankingId: core.dailyRankingId,
                      dailyRankingEntryId: line.dailyRankingEntryId,
                    },
                  },
                });
                wallet.remainingBalance = balanceAfter;

                await tx.wallet.update({
                  where: { id: wallet.id },
                  data: {
                    balance: { decrement: line.amount },
                    totalEarned: { decrement: line.amount },
                  },
                });

                await tx.dailyRankingEntry.update({
                  where: { id: line.dailyRankingEntryId },
                  data: {
                    dailyPrizeStatus: "PENDING",
                    dailyPrizeAmount: 0,
                  },
                });

                await tx.auditLog.create({
                  data: {
                    userId: ctx.userId,
                    action: "CREATE",
                    entityType: "Transaction",
                    entityId: adj.id,
                    campaignId: input.campaignId,
                    changes: {
                      action: "undo_daily_ranking_prize_payment",
                      clipperProfileId: line.clipperProfileId,
                      amount: line.amount,
                      position: line.position,
                      dailyRankingEntryId: line.dailyRankingEntryId,
                      clipPostId: line.clipPostId,
                      reversedPrizeCreditId: line.prizeCreditTransactionId,
                    },
                  },
                });

                result.push({
                  position: line.position,
                  clipperName: line.clipperName,
                  amount: line.amount,
                  adjustmentTransactionId: adj.id,
                });
              }

              await tx.dailyRanking.update({
                where: { id: core.dailyRankingId },
                data: { dailyPixPayoutCompleted: false },
              });

              return result;
            },
            {
              isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            },
          );
          reversed.push(...transactionResult);
        } catch (err: unknown) {
          if (err instanceof TRPCError) {
            throw err;
          }
          const msg =
            err instanceof Error ? err.message : "Erro ao estornar linha";
          console.error("undoDailyRankPayments item:", err);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `O estorno não foi aplicado: ${msg}`,
          });
        }

        return {
          dryRun: false as const,
          date: input.date,
          campaignId: core.campaignId,
          campaignName: core.campaignName,
          totalAmountReversed: reversed.reduce((s, r) => s + r.amount, 0),
          reversed,
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) {
          throw error;
        }
        const message =
          error instanceof Error
            ? error.message
            : "Erro ao desfazer pagamento do ranking";
        console.error("undoDailyRankPayments:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  disqualifyDailyRankingEntry: adminProcedure
    .input(
      z.object({
        dailyRankingEntryId: z.string(),
        clipPostId: z.string(),
        disqualificationReason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const entry = await ctx.db.dailyRankingEntry.findUnique({
          where: { id: input.dailyRankingEntryId },
          include: {
            dailyRanking: {
              include: { campaign: { select: { id: true, name: true } } },
            },
            clipPost: {
              select: { id: true, submittedUrl: true, status: true },
            },
            application: {
              include: {
                clipperProfile: {
                  select: { fullName: true, artisticName: true },
                },
              },
            },
          },
        });

        if (!entry) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Entrada do ranking não encontrada",
          });
        }

        if (entry.clipPostId !== input.clipPostId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "O clip não corresponde a esta entrada do ranking",
          });
        }

        const customReason = input.disqualificationReason?.trim();
        const finalReason =
          customReason && customReason.length > 0
            ? customReason
            : "Desqualificado pelo administrador a partir do ranking diário.";

        const previousClipStatus = entry.clipPost.status;

        await ctx.db.$transaction(async (tx) => {
          await tx.clipPost.update({
            where: { id: input.clipPostId },
            data: {
              status: ClipPostStatus.DISQUALIFIED,
              ineligibilityReason: finalReason,
            },
          });

          await tx.dailyRankingEntry.update({
            where: { id: input.dailyRankingEntryId },
            data: { isDisqualified: true },
          });

          await tx.auditLog.create({
            data: {
              userId: ctx.userId,
              action: "UPDATE",
              entityType: "DailyRankingEntry",
              entityId: input.dailyRankingEntryId,
              campaignId: entry.dailyRanking.campaignId,
              changes: {
                action: "disqualify_daily_ranking_entry",
                previousClipStatus,
                newClipStatus: ClipPostStatus.DISQUALIFIED,
                clipPostId: input.clipPostId,
                clipperName:
                  entry.application.clipperProfile.artisticName ||
                  entry.application.clipperProfile.fullName,
                position: entry.position,
                campaignName: entry.dailyRanking.campaign.name,
                disqualificationReason: finalReason,
              },
            },
          });
        });

        return {
          success: true,
          message: "Vídeo desclassificado do ranking diário.",
        };
      } catch (error: unknown) {
        console.error("disqualifyDailyRankingEntry:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        const message =
          error instanceof Error
            ? error.message
            : "Erro ao desqualificar vídeo";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  undoDisqualifyDailyRankingEntry: adminProcedure
    .input(
      z.object({
        dailyRankingEntryId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const entry = await ctx.db.dailyRankingEntry.findUnique({
          where: { id: input.dailyRankingEntryId },
          include: {
            dailyRanking: {
              include: { campaign: { select: { id: true, name: true } } },
            },
            clipPost: { select: { id: true, status: true } },
            application: {
              include: {
                clipperProfile: {
                  select: { fullName: true, artisticName: true },
                },
              },
            },
          },
        });

        if (!entry) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Entrada do ranking não encontrada",
          });
        }

        if (!entry.isDisqualified) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Esta entrada não está desclassificada",
          });
        }

        await ctx.db.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT id FROM "DailyRankingEntry" WHERE id = ${entry.id} FOR UPDATE`;
          const cutoff = getPostedAtWindowUtc(entry.dailyRanking.rankingDate.toISOString().slice(0, 10)).endDate;
          const eligible = await tx.clipperApplication.count({
            where: { id: entry.applicationId, ...rankingApplicationWhere(cutoff) },
          });
          if (!eligible) {
            throw new TRPCError({ code: "FORBIDDEN", message: "A saída voluntária impede a participação neste período." });
          }

          await tx.dailyRankingEntry.update({
            where: { id: input.dailyRankingEntryId },
            data: { isDisqualified: false },
          });

          if (entry.clipPost.status === ClipPostStatus.DISQUALIFIED) {
            await tx.clipPost.update({
              where: { id: entry.clipPostId },
              data: {
                status: ClipPostStatus.ELIGIBLE,
                ineligibilityReason: null,
              },
            });
          }

          await tx.auditLog.create({
            data: {
              userId: ctx.userId,
              action: "UPDATE",
              entityType: "DailyRankingEntry",
              entityId: input.dailyRankingEntryId,
              campaignId: entry.dailyRanking.campaignId,
              changes: {
                action: "undo_disqualify_daily_ranking_entry",
                clipPostId: entry.clipPostId,
                clipperName:
                  entry.application.clipperProfile.artisticName ||
                  entry.application.clipperProfile.fullName,
                position: entry.position,
                campaignName: entry.dailyRanking.campaign.name,
              },
            },
          });
        });

        return {
          success: true,
          message: "Desclassificação revertida com sucesso.",
        };
      } catch (error: unknown) {
        console.error("undoDisqualifyDailyRankingEntry:", error);
        if (error instanceof TRPCError) throw error;
        const message =
          error instanceof Error
            ? error.message
            : "Erro ao reverter desclassificação";
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),

  // ============================================================================
  // CAPTAÇÃO / ACQUISITION - Análise de origem dos clipadores
  // ============================================================================

  acquisition: createTRPCRouter({
    // Dashboard completo de captação
    getDashboard: adminProcedure.query(({ ctx }) =>
      cachedAdminHomeQuery("acquisition-dashboard", async () => {
      // Filtro base: apenas CLIPPER com clipperProfile (iniciou onboarding)
      const baseWhere = {
        role: "CLIPPER" as const,
        clipperProfile: { isNot: null },
      };

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      // As consultas são independentes: rodam juntas, não uma após a outra.
      const [
        totalClippers,
        verifiedClippers,
        clippersWithReferral,
        allCampaignSlugs,
        referralGroupsRaw,
        dailyRegistrations,
        cumulativeBefore,
        cumulativeVerifiedBefore,
      ] = await Promise.all([
        // 1. Total de clipadores com perfil
        ctx.db.user.count({ where: baseWhere }),
        // 2. Clipadores verificados (completaram onboarding)
        ctx.db.user.count({
          where: {
            ...baseWhere,
            clipperProfile: { is: { verificationStatus: "VERIFIED" } },
          },
        }),
        // 4. Clipadores com referralSlug (vieram de algum canal)
        ctx.db.user.count({
          where: { ...baseWhere, referralSlug: { not: null } },
        }),
        // 6. Slugs de campanhas para cruzar com as fontes
        ctx.db.campaign.findMany({ select: { slug: true, name: true } }),
        // 7. Agrupamento por referralSlug (top fontes) — apenas com perfil
        ctx.db.user.groupBy({
          by: ["referralSlug"],
          where: { ...baseWhere, referralSlug: { not: null } },
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
        }),
        // 8. Cadastros dos últimos 90 dias — apenas com perfil
        ctx.db.user.findMany({
          where: { ...baseWhere, createdAt: { gte: ninetyDaysAgo } },
          select: {
            createdAt: true,
            referralSlug: true,
            clipperProfile: { select: { verificationStatus: true } },
          },
          orderBy: { createdAt: "asc" },
        }),
        // Acumulados antes da janela de 90 dias (apenas com perfil)
        ctx.db.user.count({
          where: { ...baseWhere, createdAt: { lt: ninetyDaysAgo } },
        }),
        ctx.db.user.count({
          where: {
            ...baseWhere,
            clipperProfile: { is: { verificationStatus: "VERIFIED" } },
            createdAt: { lt: ninetyDaysAgo },
          },
        }),
      ]);

      // 3. Clipadores não verificados (iniciaram mas não completaram)
      const unverifiedClippers = totalClippers - verifiedClippers;

      // 5. Clipadores sem referralSlug (orgânicos)
      const organicClippers = totalClippers - clippersWithReferral;

      const campaignSlugMap = new Map(
        allCampaignSlugs.map((c) => [c.slug, c.name]),
      );

      const topSources = referralGroupsRaw.map((g) => {
        const slug = g.referralSlug!;
        const campaignName = campaignSlugMap.get(slug);
        return {
          slug,
          count: g._count.id,
          isCampaign: !!campaignName,
          campaignName: campaignName || null,
        };
      });

      // 8. Crescimento de clipadores por dia: agrupar (com verificados/não verificados)
      const dailyMap = new Map<
        string,
        {
          total: number;
          organic: number;
          referred: number;
          verified: number;
          unverified: number;
        }
      >();
      for (const u of dailyRegistrations) {
        const day = u.createdAt.toISOString().split("T")[0]!;
        const entry = dailyMap.get(day) || {
          total: 0,
          organic: 0,
          referred: 0,
          verified: 0,
          unverified: 0,
        };
        entry.total++;
        if (u.referralSlug) {
          entry.referred++;
        } else {
          entry.organic++;
        }
        if (u.clipperProfile?.verificationStatus === "VERIFIED") {
          entry.verified++;
        } else {
          entry.unverified++;
        }
        dailyMap.set(day, entry);
      }

      // Fill missing days
      const growthData: {
        date: string;
        total: number;
        organic: number;
        referred: number;
        cumulative: number;
        cumulativeVerified: number;
        cumulativeUnverified: number;
      }[] = [];
      const startDate = new Date(ninetyDaysAgo);
      const today = new Date();

      let cumulative = cumulativeBefore;
      let cumulativeVerified = cumulativeVerifiedBefore;
      let cumulativeUnverified = cumulativeBefore - cumulativeVerifiedBefore;
      for (
        let d = new Date(startDate);
        d <= today;
        d.setDate(d.getDate() + 1)
      ) {
        const dayStr = d.toISOString().split("T")[0]!;
        const entry = dailyMap.get(dayStr) || {
          total: 0,
          organic: 0,
          referred: 0,
          verified: 0,
          unverified: 0,
        };
        cumulative += entry.total;
        cumulativeVerified += entry.verified;
        cumulativeUnverified += entry.unverified;
        growthData.push({
          date: dayStr,
          total: entry.total,
          organic: entry.organic,
          referred: entry.referred,
          cumulative,
          cumulativeVerified,
          cumulativeUnverified,
        });
      }

      // 9. Crescimento semanal (últimas 12 semanas)
      const weeklyData: {
        week: string;
        total: number;
        organic: number;
        referred: number;
      }[] = [];
      const twelveWeeksAgo = new Date();
      twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

      for (let i = 0; i < 12; i++) {
        const weekStart = new Date(twelveWeeksAgo);
        weekStart.setDate(weekStart.getDate() + i * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        let total = 0,
          organic = 0,
          referred = 0;
        for (const u of dailyRegistrations) {
          if (u.createdAt >= weekStart && u.createdAt < weekEnd) {
            total++;
            if (u.referralSlug) referred++;
            else organic++;
          }
        }

        const weekLabel = `${weekStart.getDate().toString().padStart(2, "0")}/${(weekStart.getMonth() + 1).toString().padStart(2, "0")}`;
        weeklyData.push({ week: weekLabel, total, organic, referred });
      }

      // 10. Últimos clipadores com referralSlug (apenas com perfil)
      const recentReferred = await ctx.db.user.findMany({
        where: { ...baseWhere, referralSlug: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          name: true,
          email: true,
          imageUrl: true,
          referralSlug: true,
          createdAt: true,
        },
      });

      const recentReferredWithCampaign = recentReferred.map((u) => ({
        ...u,
        isCampaign: campaignSlugMap.has(u.referralSlug!),
        campaignName: campaignSlugMap.get(u.referralSlug!) || null,
      }));

      // 11. Métricas de hoje e últimos 7/30 dias (apenas com perfil)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [todayCount, last7daysCount, last30daysCount] = await Promise.all([
        ctx.db.user.count({
          where: { ...baseWhere, createdAt: { gte: todayStart } },
        }),
        ctx.db.user.count({
          where: { ...baseWhere, createdAt: { gte: sevenDaysAgo } },
        }),
        ctx.db.user.count({
          where: { ...baseWhere, createdAt: { gte: thirtyDaysAgo } },
        }),
      ]);

      // 11b. Per-slug breakdown for each time period
      const [todayBySlug, last7BySlug, last30BySlug] = await Promise.all([
        ctx.db.user.groupBy({
          by: ["referralSlug"],
          where: {
            ...baseWhere,
            createdAt: { gte: todayStart },
            referralSlug: { not: null },
          },
          _count: { id: true },
        }),
        ctx.db.user.groupBy({
          by: ["referralSlug"],
          where: {
            ...baseWhere,
            createdAt: { gte: sevenDaysAgo },
            referralSlug: { not: null },
          },
          _count: { id: true },
        }),
        ctx.db.user.groupBy({
          by: ["referralSlug"],
          where: {
            ...baseWhere,
            createdAt: { gte: thirtyDaysAgo },
            referralSlug: { not: null },
          },
          _count: { id: true },
        }),
      ]);

      const toSlugMap = (groups: typeof todayBySlug) =>
        Object.fromEntries(groups.map((g) => [g.referralSlug!, g._count.id]));

      const todaySlugBreakdown = toSlugMap(todayBySlug);
      const last7SlugBreakdown = toSlugMap(last7BySlug);
      const last30SlugBreakdown = toSlugMap(last30BySlug);

      // 12. Proporção campanha vs outros slugs
      const campaignSources = topSources.filter((s) => s.isCampaign);
      const otherSources = topSources.filter((s) => !s.isCampaign);
      const campaignReferralCount = campaignSources.reduce(
        (acc, s) => acc + s.count,
        0,
      );
      const otherReferralCount = otherSources.reduce(
        (acc, s) => acc + s.count,
        0,
      );

      return {
        stats: {
          totalClippers,
          verifiedClippers,
          unverifiedClippers,
          clippersWithReferral,
          organicClippers,
          todayCount,
          last7daysCount,
          last30daysCount,
          campaignReferralCount,
          otherReferralCount,
        },
        topSources,
        campaignSources,
        otherSources,
        growthData,
        weeklyData,
        recentReferred: recentReferredWithCampaign,
        slugBreakdowns: {
          today: todaySlugBreakdown,
          last7: last7SlugBreakdown,
          last30: last30SlugBreakdown,
        },
      };
      }),
    ),
  }),

  getDailyRankPaymentTransactions: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .query(async ({ ctx, input }) => {
      const dateFormatted = new Date(
        `${input.date}T12:00:00.000Z`,
      ).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      });
      const descriptionPattern = `Ranking Diário ${dateFormatted}`;

      const transactions = await ctx.db.transaction.findMany({
        where: {
          campaignId: input.campaignId,
          description: { contains: descriptionPattern },
          type: { in: ["PRIZE_CREDIT", "WITHDRAWAL_COMPLETED"] },
        },
        orderBy: [{ rankingPosition: "asc" }, { createdAt: "asc" }],
        include: {
          wallet: {
            include: {
              clipperProfile: {
                select: {
                  id: true,
                  fullName: true,
                  artisticName: true,
                  pixKey: true,
                },
              },
            },
          },
        },
      });

      return transactions.map((tx) => ({
        id: tx.id,
        transactionType: tx.type,
        position: tx.rankingPosition,
        clipperName:
          tx.wallet.clipperProfile.artisticName ||
          tx.wallet.clipperProfile.fullName,
        fullName: tx.wallet.clipperProfile.fullName,
        pixKey: tx.wallet.clipperProfile.pixKey,
        amount: tx.amount,
        status: tx.status,
        description: tx.description,
        processedAt:
          tx.processedAt?.toISOString() ?? tx.createdAt.toISOString(),
      }));
    }),

  getDailyRankingCalendar: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const campaign = await ctx.db.campaign.findUnique({
        where: { id: input.campaignId },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          topClippersRankingEnabled: true,
          topClippersPrizeTable: true,
        },
      });

      if (!campaign) {
        return { days: [], startDate: null, endDate: null };
      }

      const dailyRankings = await ctx.db.dailyRanking.findMany({
        where: { campaignId: input.campaignId },
        select: {
          id: true,
          rankingDate: true,
          totalPosts: true,
          totalDailyViews: true,
          totalClippers: true,
          announced: true,
        },
        orderBy: { rankingDate: "asc" },
      });
      const dailyRankingIds = dailyRankings.map((dr) => dr.id);

      const topPostersPrizeTable = campaign.topClippersRankingEnabled
        ? parseTopClippersPrizeTable(campaign.topClippersPrizeTable)
        : [];
      const topPostersCount = Math.max(
        0,
        ...topPostersPrizeTable.map((entry) => entry.position),
      );
      const rankingDates = dailyRankings.map(
        (dr) => dr.rankingDate.toISOString().split("T")[0]!,
      );

      const [
        activeEntryCounts,
        prizeEntries,
        processingPixTransactions,
        topPostersClippersByDate,
      ] = await Promise.all([
        // Só a contagem das entradas ativas (podem ser milhares por dia)
        dailyRankingIds.length > 0
          ? ctx.db.dailyRankingEntry.groupBy({
              by: ["dailyRankingId"],
              where: {
                dailyRankingId: { in: dailyRankingIds },
                isDisqualified: false,
              },
              _count: { _all: true },
            })
          : [],
        // Entradas premiadas (somas, status de pagamento e checagem do PIX)
        dailyRankingIds.length > 0
          ? ctx.db.dailyRankingEntry.findMany({
              where: {
                dailyRankingId: { in: dailyRankingIds },
                isDisqualified: false,
                dailyPrizeAmount: { gt: 0 },
              },
              select: {
                id: true,
                dailyRankingId: true,
                dailyPrizeStatus: true,
                dailyPrizeAmount: true,
                dailyPrizePaid: true,
                dailyPixStatus: true,
                application: {
                  select: {
                    clipperProfile: {
                      select: { pixPayoutEligible: true },
                    },
                  },
                },
              },
              orderBy: { position: "asc" },
            })
          : [],
        ctx.db.transaction.findMany({
          where: {
            campaignId: input.campaignId,
            status: "PROCESSING",
            metadata: { path: ["source"], equals: "daily_ranking_pix" },
          },
          select: { metadata: true },
        }),
        topPostersCount > 0 && rankingDates.length > 0
          ? countTopPostersClippersByDate(
              ctx.db,
              input.campaignId,
              rankingDates,
            )
          : new Map<string, number>(),
      ]);

      const activeEntriesByDailyRankingId = new Map(
        activeEntryCounts.map((row) => [row.dailyRankingId, row._count._all]),
      );
      const prizeEntriesByDailyRankingId = new Map<
        string,
        typeof prizeEntries
      >();
      for (const entry of prizeEntries) {
        const current =
          prizeEntriesByDailyRankingId.get(entry.dailyRankingId) ?? [];
        current.push(entry);
        prizeEntriesByDailyRankingId.set(entry.dailyRankingId, current);
      }

      const processingPixByDailyRankingId = new Map<
        string,
        typeof processingPixTransactions
      >();
      for (const tx of processingPixTransactions) {
        const metadata = tx.metadata as { dailyRankingId?: string } | null;
        const dailyRankingId = metadata?.dailyRankingId;
        if (!dailyRankingId) continue;
        const current = processingPixByDailyRankingId.get(dailyRankingId) ?? [];
        current.push(tx);
        processingPixByDailyRankingId.set(dailyRankingId, current);
      }

      // Prêmio dos Top Postadores: as posições pagas são as primeiras N do
      // dia, então o total depende só de quantos clipadores entraram no top.
      const topPostersPrizeByDate = new Map<string, number>();
      for (const [dateStr, clippers] of topPostersClippersByDate) {
        let total = 0;
        for (
          let position = 1;
          position <= Math.min(clippers, topPostersCount);
          position++
        ) {
          total += getTopClippersPrize(topPostersPrizeTable, position);
        }
        topPostersPrizeByDate.set(dateStr, total);
      }

      const days = dailyRankings.map((dr) => {
        const dateStr = dr.rankingDate.toISOString().split("T")[0]!;
        const prizeEntries = prizeEntriesByDailyRankingId.get(dr.id) ?? [];
        const totalEntries = activeEntriesByDailyRankingId.get(dr.id) ?? 0;
        const paidEntries = prizeEntries.filter(
          (e) => e.dailyPrizeStatus === "PAID",
        ).length;
        const pendingEntries = prizeEntries.filter(
          (e) => e.dailyPrizeStatus !== "PAID",
        ).length;
        const dailyRankingPrizeAmount = prizeEntries.reduce(
          (sum, e) => sum + e.dailyPrizeAmount,
          0,
        );
        const topPostersPrizeAmount = topPostersPrizeByDate.get(dateStr) ?? 0;
        const totalPrizeAmount =
          dailyRankingPrizeAmount + topPostersPrizeAmount;
        const paidPrizeAmount = prizeEntries
          .filter((e) => e.dailyPrizeStatus === "PAID")
          .reduce((sum, e) => sum + e.dailyPrizeAmount, 0);

        let paymentStatus: "none" | "partial" | "all_paid" = "none";
        if (prizeEntries.length > 0) {
          if (paidEntries === prizeEntries.length) paymentStatus = "all_paid";
          else if (paidEntries > 0) paymentStatus = "partial";
          else paymentStatus = "none";
        }

        return {
          date: dr.rankingDate.toISOString(),
          dateStr,
          totalPosts: dr.totalPosts,
          totalDailyViews: Number(dr.totalDailyViews),
          totalClippers: dr.totalClippers,
          totalEntries,
          paidEntries,
          pendingEntries,
          dailyRankingPrizeAmount,
          topPostersPrizeAmount,
          totalPrizeAmount,
          paidPrizeAmount,
          paymentStatus,
          announced: dr.announced,
          dailyPixPayoutCompleted: (() => {
            const pixRequiredEntries = prizeEntries.filter(
              (e) => e.application.clipperProfile.pixPayoutEligible,
            );
            return (
              pixRequiredEntries.length > 0 &&
              (processingPixByDailyRankingId.get(dr.id) ?? []).filter((tx) => {
                const metadata = tx.metadata as {
                  dailyRankingEntryId?: string;
                } | null;
                const entryId = metadata?.dailyRankingEntryId;
                const entry = entryId
                  ? pixRequiredEntries.find((e) => e.id === entryId)
                  : null;
                if (!entry) return true;
                return !(
                  entry.dailyPixStatus === "PAID" && entry.dailyPrizePaid
                );
              }).length === 0 &&
              pixRequiredEntries.every(
                (e) => e.dailyPixStatus === "PAID" && e.dailyPrizePaid,
              )
            );
          })(),
        };
      });

      return {
        days,
        startDate: campaign.startDate.toISOString(),
        endDate: campaign.endDate.toISOString(),
      };
    }),

  toggleDailyRankingAnnounced: adminProcedure
    .input(
      z.object({
        dailyRankingDate: z.string(),
        campaignId: z.string(),
        announced: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const dateStart = new Date(`${input.dailyRankingDate}T00:00:00.000Z`);
      const dateEnd = new Date(`${input.dailyRankingDate}T23:59:59.999Z`);

      const dailyRanking = await ctx.db.dailyRanking.findFirst({
        where: {
          campaignId: input.campaignId,
          rankingDate: { gte: dateStart, lte: dateEnd },
        },
      });

      if (!dailyRanking) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ranking não encontrado para esta data",
        });
      }

      await ctx.db.dailyRanking.update({
        where: { id: dailyRanking.id },
        data: { announced: input.announced },
      });

      return { success: true, announced: input.announced };
    }),

  getDataMetrics: adminProcedure
    .input(
      z.object({
        month: z.string().refine((v) => v === "all" || /^\d{4}-\d{2}$/.test(v)),
        campaignIds: z.array(z.string()).min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const isAll = input.month === "all";
      const dateFilter: { gte?: Date; lt?: Date } = {};
      if (!isAll) {
        const [year, month] = input.month.split("-").map(Number) as [
          number,
          number,
        ];
        dateFilter.gte = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
        dateFilter.lt = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
      }

      const thresholds = [10_000, 50_000, 100_000, 500_000, 1_000_000] as const;

      // Tudo é agregado no banco (antes cada post elegível vinha para o Node).
      // has_er replica calculateEngagementRate(...) > 1 em float8, com o mesmo
      // truncamento em 2 casas e a mesma ordem de operações do JS.
      const postedAtSqlFor = (alias: string) =>
        isAll
          ? Prisma.empty
          : Prisma.sql`AND ${Prisma.raw(`${alias}."postedAt"`)} >= ${dateFilter.gte}::timestamp AND ${Prisma.raw(`${alias}."postedAt"`)} < ${dateFilter.lt}::timestamp`;
      const hasErSql = (alias: string) => {
        const col = (name: string) => Prisma.raw(`${alias}."${name}"`);
        return Prisma.sql`(CASE WHEN ${col("views")} > 0
          THEN trunc(((${col("likes")}::bigint + ${col("comments")} + ${col("shares")} + COALESCE(${col("saves")}, 0))::float8 / ${col("views")}::float8 * 100) * 100) / 100 > 1
          ELSE false END)`;
      };

      type DataMetricsAggRow = {
        threshold: number | null;
        platform: Platform;
        posts: number;
        withER: number;
        views: bigint;
        likes: bigint;
        comments: bigint;
        shares: bigint;
        saves: bigint;
        erViews: bigint;
        erLikes: bigint;
        erComments: bigint;
        erShares: bigint;
        erSaves: bigint;
      };
      type TopVideoRow = {
        id: string;
        username: string | null;
        views: bigint;
        likes: number;
        comments: number;
        shares: number;
        saves: number | null;
        platform: Platform;
        thumbnailUrl: string | null;
        submittedUrl: string;
        postedAt: Date | null;
        campaignName: string;
      };

      const [aggRows, topVideoRows] = await Promise.all([
        // threshold NULL = todos os posts (resumo); demais linhas = por faixa
        ctx.db.$queryRaw<DataMetricsAggRow[]>`
          WITH p AS MATERIALIZED (
            SELECT
              platform,
              views,
              likes,
              comments,
              shares,
              COALESCE(saves, 0) AS saves,
              ${hasErSql('"ClipPost"')} AS has_er
            FROM "ClipPost"
            WHERE "campaignId" = ANY(${input.campaignIds})
              AND status = 'ELIGIBLE'
              ${postedAtSqlFor('"ClipPost"')}
          ),
          tiers AS (
            SELECT NULL::int AS threshold, p.* FROM p
            UNION ALL
            SELECT t.threshold, p.*
            FROM p
            JOIN unnest(ARRAY[${Prisma.raw(thresholds.join(", "))}]) AS t(threshold)
              ON p.views >= t.threshold
          )
          SELECT
            threshold,
            platform,
            COUNT(*)::int AS posts,
            (COUNT(*) FILTER (WHERE has_er))::int AS "withER",
            COALESCE(SUM(views), 0)::bigint AS views,
            COALESCE(SUM(likes), 0)::bigint AS likes,
            COALESCE(SUM(comments), 0)::bigint AS comments,
            COALESCE(SUM(shares), 0)::bigint AS shares,
            COALESCE(SUM(saves), 0)::bigint AS saves,
            COALESCE(SUM(views) FILTER (WHERE has_er), 0)::bigint AS "erViews",
            COALESCE(SUM(likes) FILTER (WHERE has_er), 0)::bigint AS "erLikes",
            COALESCE(SUM(comments) FILTER (WHERE has_er), 0)::bigint AS "erComments",
            COALESCE(SUM(shares) FILTER (WHERE has_er), 0)::bigint AS "erShares",
            COALESCE(SUM(saves) FILTER (WHERE has_er), 0)::bigint AS "erSaves"
          FROM tiers
          GROUP BY threshold, platform
        `,
        ctx.db.$queryRaw<TopVideoRow[]>`
          SELECT
            cp.id,
            cp.username,
            cp.views,
            cp.likes,
            cp.comments,
            cp.shares,
            cp.saves,
            cp.platform,
            cp."thumbnailUrl",
            cp."submittedUrl",
            cp."postedAt",
            c.name AS "campaignName"
          FROM "ClipPost" cp
          JOIN "Campaign" c ON c.id = cp."campaignId"
          WHERE cp."campaignId" = ANY(${input.campaignIds})
            AND cp.status = 'ELIGIBLE'
            ${postedAtSqlFor("cp")}
            AND cp.views >= 10000
            AND ${hasErSql("cp")}
          ORDER BY cp.views DESC, cp.id
          LIMIT 20
        `,
      ]);

      type TierData = {
        threshold: number;
        label: string;
        total: number;
        withER: number;
        avgER: number;
        avgViews: number;
        platformBreakdown: Record<string, number>;
      };

      const tiers: TierData[] = thresholds.map((t) => {
        const label =
          t >= 1_000_000
            ? `${t / 1_000_000}M`
            : t >= 1_000
              ? `${t / 1_000}k`
              : String(t);

        const rows = aggRows.filter((row) => row.threshold === t);
        const total = rows.reduce((sum, row) => sum + row.posts, 0);
        const withER = rows.reduce((sum, row) => sum + row.withER, 0);
        const tierViews = rows.reduce((sum, row) => sum + Number(row.erViews), 0);
        const avgER = calculateEngagementRate(
          tierViews,
          rows.reduce((sum, row) => sum + Number(row.erLikes), 0),
          rows.reduce((sum, row) => sum + Number(row.erComments), 0),
          rows.reduce((sum, row) => sum + Number(row.erShares), 0),
          rows.reduce((sum, row) => sum + Number(row.erSaves), 0),
        );
        const avgViews = withER > 0 ? tierViews / withER : 0;

        const platformBreakdown: Record<string, number> = {};
        rows.forEach((row) => {
          if (row.withER > 0) platformBreakdown[row.platform] = row.withER;
        });

        return {
          threshold: t,
          label,
          total,
          withER,
          avgER,
          avgViews,
          platformBreakdown,
        };
      });

      const summaryRows = aggRows.filter((row) => row.threshold === null);
      const sumOf = (
        field: "views" | "likes" | "comments" | "shares" | "saves",
      ) => summaryRows.reduce((sum, row) => sum + Number(row[field]), 0);
      const totalPosts = summaryRows.reduce((sum, row) => sum + row.posts, 0);
      const totalViews = sumOf("views");
      const totalEngagement =
        sumOf("likes") + sumOf("comments") + sumOf("shares") + sumOf("saves");
      const avgER = calculateEngagementRate(
        totalViews,
        sumOf("likes"),
        sumOf("comments"),
        sumOf("shares"),
        sumOf("saves"),
      );

      const platformStats: Record<string, { count: number; views: number }> =
        {};
      summaryRows.forEach((row) => {
        platformStats[row.platform] = {
          count: row.posts,
          views: Number(row.views),
        };
      });

      const topVideos = topVideoRows.map((p) => ({
        id: p.id,
        username: p.username,
        views: Number(p.views),
        likes: p.likes,
        comments: p.comments,
        shares: p.shares,
        saves: p.saves ?? 0,
        er: calculateEngagementRate(
          Number(p.views),
          p.likes,
          p.comments,
          p.shares,
          p.saves ?? 0,
        ),
        platform: p.platform,
        thumbnailUrl: p.thumbnailUrl,
        submittedUrl: p.submittedUrl,
        postedAt: p.postedAt?.toISOString() ?? null,
        campaignName: p.campaignName,
      }));

      return {
        month: input.month,
        tiers,
        summary: {
          totalPosts,
          totalViews,
          totalEngagement,
          avgER,
          platformStats,
        },
        topVideos,
      };
    }),

  // ============================================================================
  // BIBLIOTECA — Raw Videos
  // ============================================================================

  getRawVideos: adminProcedure
    .input(
      z.object({
        campaignId: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, campaignId, search } = input;

      const where: any = {};
      if (campaignId) {
        where.campaignId = campaignId;
      }
      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      const rawVideos = await ctx.db.rawVideo.findMany({
        where,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          campaignId: true,
          title: true,
          description: true,
          storageUrl: true,
          originalUrl: true,
          fileSize: true,
          duration: true,
          mimeType: true,
          thumbnail: true,
          createdAt: true,
          campaign: { select: { id: true, name: true, slug: true } },
          _count: { select: { clips: true } },
        },
      });

      let nextCursor: string | undefined;
      if (rawVideos.length > limit) {
        const next = rawVideos.pop();
        nextCursor = next?.id;
      }

      return {
        videos: rawVideos.map((v) => ({
          ...v,
          fileSize: v.fileSize ? Number(v.fileSize) : null,
          clipsCount: v._count.clips,
        })),
        nextCursor,
      };
    }),

  getRawVideosStats: adminProcedure
    .input(z.object({ campaignId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = input.campaignId
        ? { campaignId: input.campaignId }
        : {};

      const [totalVideos, totalClips, durationAgg, campaignsCount] =
        await Promise.all([
          ctx.db.rawVideo.count({ where }),
          ctx.db.rawVideoClip.count({
            where: input.campaignId
              ? { rawVideo: { campaignId: input.campaignId } }
              : {},
          }),
          ctx.db.rawVideo.aggregate({ where, _sum: { duration: true } }),
          input.campaignId
            ? Promise.resolve(1)
            : ctx.db.rawVideo
                .groupBy({ by: ["campaignId"], where })
                .then((g) => g.length),
        ]);

      return {
        totalVideos,
        totalClips,
        totalDuration: durationAgg._sum.duration ?? 0,
        campaignsCount,
      };
    }),

  getLibraryCampaigns: adminProcedure.query(async ({ ctx }) => {
    const campaigns = await ctx.db.campaign.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { createdAt: "desc" },
    });
    return campaigns;
  }),

  createRawVideo: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        title: z.string().min(1),
        description: z.string().optional(),
        storageUrl: z.string().url(),
        originalUrl: z.string().url().optional().or(z.literal("")),
        fileSize: z.number().optional(),
        mimeType: z.string().optional(),
        duration: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const video = await ctx.db.rawVideo.create({
        data: {
          campaignId: input.campaignId,
          title: input.title,
          description: input.description || null,
          storageUrl: input.storageUrl,
          originalUrl: input.originalUrl || null,
          fileSize: input.fileSize ? BigInt(input.fileSize) : null,
          mimeType: input.mimeType || null,
          duration: input.duration ?? null,
        },
      });
      return video;
    }),
});
