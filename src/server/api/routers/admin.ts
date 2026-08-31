import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { clerkClient } from "@clerk/nextjs/server";
import { Resend } from "resend";
import { ClipPostStatus, Prisma, RankingMetricType } from "@prisma/client";
import {
  calculateRankingScore,
  calculateEngagementRate,
  type RankingMetricType as RankingMetricTypeForScore,
} from "@/lib/ranking-helpers";
import {
  computeDailyPixPayoutSettledGate,
  computeDailyRankWalletPaidGate,
  getPrizeForPosition,
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
  const calculatedCents = Array.from(
    { length: input.topCount },
    (_, index) => getPrizeForPosition(entries, index + 1),
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
    select: { id: true, amount: true },
    orderBy: { createdAt: "desc" },
  });

  for (const candidate of candidates) {
    const reversal = await db.transaction.findFirst({
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
            metadata: {
              path: ["reversedPrizeCreditId"],
              equals: candidate.id,
            },
          },
        ],
      },
      select: { id: true },
    });

    if (!reversal) {
      return candidate;
    }
  }

  return null;
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
          <li style="margin-bottom: 8px; font-size: 14px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F; font-weight: 700;">✓</span>
            O pagamento será realizado <strong style="color: #ffffff;">via PIX no final da competição</strong>
          </li>
          <li style="margin: 0; font-size: 14px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F; font-weight: 700;">✓</span>
            Você receberá as <strong style="color: #ffffff;">instruções para saque</strong> em breve
          </li>
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

      const triggeredByUserEmail =
        ctx.user.emailAddresses?.[0]?.emailAddress ||
        ctx.user.primaryEmailAddress?.emailAddress;

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

        return Promise.all(
          tracks.map(async (link) => {
            const [latest, firstInRange] = await Promise.all([
              ctx.db.spotifyTrackMetric.findFirst({
                where: { spotifyTrackId: link.spotifyTrackId },
                orderBy: { collectedAt: "desc" },
              }),
              ctx.db.spotifyTrackMetric.findFirst({
                where: {
                  spotifyTrackId: link.spotifyTrackId,
                  ...(since ? { collectedAt: { gte: since } } : {}),
                },
                orderBy: { collectedAt: "asc" },
              }),
            ]);

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
          }),
        );
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
  // ORGANIZAÇÕES - CRUD
  // ============================================================================

  organizations: createTRPCRouter({
    // Listar organizações
    list: adminProcedure
      .input(
        z.object({
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(100).default(20),
          search: z.string().optional(),
          isActive: z.boolean().optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        const { page, limit, search, isActive } = input;
        const skip = (page - 1) * limit;

        const where = {
          ...(isActive !== undefined && { isActive }),
          ...(search && {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { slug: { contains: search, mode: "insensitive" as const } },
            ],
          }),
        };

        const [organizations, total] = await Promise.all([
          ctx.db.organization.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
              _count: {
                select: {
                  members: true,
                  campaigns: true,
                },
              },
            },
          }),
          ctx.db.organization.count({ where }),
        ]);

        return {
          organizations,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      }),

    // Buscar por ID
    getById: adminProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const organization = await ctx.db.organization.findUnique({
          where: { id: input.id },
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    imageUrl: true,
                  },
                },
              },
            },
            campaigns: {
              orderBy: { createdAt: "desc" },
              take: 10,
            },
            quotaUsage: {
              orderBy: { period: "desc" },
              take: 6,
            },
            _count: {
              select: {
                members: true,
                campaigns: true,
                webhookEndpoints: true,
              },
            },
          },
        });

        if (!organization) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Organization not found",
          });
        }

        return organization;
      }),

    // Criar organização
    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1),
          slug: z
            .string()
            .min(1)
            .regex(/^[a-z0-9-]+$/),
          description: z.string().optional(),
          logoUrl: z.string().url().optional(),
          website: z.string().url().optional(),
          country: z.string().optional(),
          timezone: z.string().default("UTC"),
          quotaMonthlyIngest: z.number().int().min(0).default(100000),
          quotaActiveCampaigns: z.number().int().min(1).default(5),
          quotaCreatorsPerCampaign: z.number().int().min(1).default(1000),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        // Verificar se slug já existe
        const existing = await ctx.db.organization.findUnique({
          where: { slug: input.slug },
        });

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Organization slug already exists",
          });
        }

        const organization = await ctx.db.organization.create({
          data: input,
        });

        // Log de auditoria
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.userId,
            action: "CREATE",
            entityType: "Organization",
            entityId: organization.id,
            changes: { created: input },
          },
        });

        return organization;
      }),

    // Atualizar organização
    update: adminProcedure
      .input(
        z.object({
          id: z.string(),
          data: z.object({
            name: z.string().min(1).optional(),
            slug: z
              .string()
              .min(1)
              .regex(/^[a-z0-9-]+$/)
              .optional(),
            description: z.string().optional(),
            logoUrl: z.string().url().optional(),
            website: z.string().url().optional(),
            country: z.string().optional(),
            timezone: z.string().optional(),
            isActive: z.boolean().optional(),
            quotaMonthlyIngest: z.number().int().min(0).optional(),
            quotaActiveCampaigns: z.number().int().min(1).optional(),
            quotaCreatorsPerCampaign: z.number().int().min(1).optional(),
          }),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const before = await ctx.db.organization.findUnique({
          where: { id: input.id },
        });

        if (!before) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Organization not found",
          });
        }

        // Se mudando slug, verificar conflito
        if (input.data.slug && input.data.slug !== before.slug) {
          const slugExists = await ctx.db.organization.findUnique({
            where: { slug: input.data.slug },
          });

          if (slugExists) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "Slug already in use",
            });
          }
        }

        const updated = await ctx.db.organization.update({
          where: { id: input.id },
          data: input.data,
        });

        // Log de auditoria
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.userId,
            action: "UPDATE",
            entityType: "Organization",
            entityId: updated.id,
            changes: { before, after: updated },
          },
        });

        return updated;
      }),

    // Deletar organização
    delete: adminProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const organization = await ctx.db.organization.findUnique({
          where: { id: input.id },
          include: {
            _count: {
              select: { campaigns: true, members: true },
            },
          },
        });

        if (!organization) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Organization not found",
          });
        }

        // Verificar se tem campanhas ativas
        const activeCampaigns = await ctx.db.campaign.count({
          where: {
            organizationId: input.id,
            status: { in: ["ACTIVE", "SCHEDULED"] },
          },
        });

        if (activeCampaigns > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot delete organization with active campaigns",
          });
        }

        await ctx.db.organization.delete({
          where: { id: input.id },
        });

        // Log de auditoria
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.userId,
            action: "DELETE",
            entityType: "Organization",
            entityId: input.id,
            changes: { deleted: organization },
          },
        });

        return { success: true };
      }),

    // Estatísticas
    stats: adminProcedure.query(async ({ ctx }) => {
      const [total, active, totalCampaigns, totalMembers] = await Promise.all([
        ctx.db.organization.count(),
        ctx.db.organization.count({ where: { isActive: true } }),
        ctx.db.campaign.count(),
        ctx.db.organizationMember.count(),
      ]);

      return {
        total,
        active,
        inactive: total - active,
        totalCampaigns,
        totalMembers,
      };
    }),
  }),

  // ============================================================================
  // CAMPANHAS - CRUD
  // ============================================================================

  campaigns: createTRPCRouter({
    // Listar todas as campanhas
    list: adminProcedure
      .input(
        z.object({
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(100).default(20),
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
          organizationId: z.string().optional(),
          search: z.string().optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        const { page, limit, status, organizationId, search } = input;
        const skip = (page - 1) * limit;

        const where = {
          ...(status && { status }),
          ...(organizationId && { organizationId }),
          ...(search && {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { slug: { contains: search, mode: "insensitive" as const } },
            ],
          }),
        };

        const [campaigns, total] = await Promise.all([
          ctx.db.campaign.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
              organization: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
              creator: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              _count: {
                select: {
                  applications: true,
                  clipPosts: true,
                  fraudFlags: true,
                },
              },
            },
          }),
          ctx.db.campaign.count({ where }),
        ]);

        return {
          campaigns,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      }),

    // Buscar por ID
    getById: adminProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const campaign = await ctx.db.campaign.findUnique({
          where: { id: input.id },
          include: {
            organization: true,
            creator: {
              select: {
                id: true,
                name: true,
                email: true,
                imageUrl: true,
              },
            },
            activeRankingRule: true,
            rankingRules: {
              orderBy: { version: "desc" },
            },
            _count: {
              select: {
                applications: true,
                clipPosts: true,
                fraudFlags: true,
                auditLogs: true,
              },
            },
          },
        });

        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campaign not found",
          });
        }

        // Estatísticas adicionais
        const [applicationsStats, clipPostsStats] = await Promise.all([
          ctx.db.clipperApplication.groupBy({
            by: ["status"],
            where: { campaignId: input.id },
            _count: true,
          }),
          ctx.db.clipPost.groupBy({
            by: ["status"],
            where: { campaignId: input.id },
            _count: true,
          }),
        ]);

        return {
          campaign,
          stats: {
            applications: applicationsStats.reduce(
              (acc, curr) => {
                acc[curr.status] = curr._count;
                return acc;
              },
              {} as Record<string, number>,
            ),
            clipPosts: clipPostsStats.reduce(
              (acc, curr) => {
                acc[curr.status] = curr._count;
                return acc;
              },
              {} as Record<string, number>,
            ),
          },
        };
      }),

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
              requiredMentions: input.requiredMentions,
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
              dailyPrizeTable: z.record(z.number().finite().nonnegative()).optional(),
              bonusEnabled: z.boolean().optional(),
              bonusMilestone: z.number().int().positive().optional(),
              bonusAmount: z.number().finite().nonnegative().optional(),
              bonusMonthlyBudgetCap: z.number().finite().nonnegative().optional(),
              monthlyEnabled: z.boolean().optional(),
              monthlyTopCount: z.number().int().positive().max(100).optional(),
              monthlyTotalPrize: z.number().finite().nonnegative().optional(),
              monthlyPrizeTable: z.record(z.number().finite().nonnegative()).optional(),
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
            changes: { deleted: campaign },
          },
        });

        return { success: true };
      }),

    // Estatísticas
    stats: adminProcedure.query(async ({ ctx }) => {
      const [total, byStatus, totalClipPosts, totalClippers] =
        await Promise.all([
          ctx.db.campaign.count(),
          ctx.db.campaign.groupBy({
            by: ["status"],
            _count: true,
          }),
          ctx.db.clipPost.count(),
          ctx.db.clipperApplication.count({
            where: { status: "APPROVED" },
          }),
        ]);

      return {
        total,
        byStatus: byStatus.reduce(
          (acc, curr) => {
            acc[curr.status] = curr._count;
            return acc;
          },
          {} as Record<string, number>,
        ),
        totalClipPosts,
        totalClippers,
      };
    }),
  }),

  // ============================================================================
  // FRAUD FLAGS - Gerenciamento
  // ============================================================================

  fraudFlags: createTRPCRouter({
    // Listar flags
    list: adminProcedure
      .input(
        z.object({
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(100).default(20),
          status: z
            .enum([
              "OPEN",
              "UNDER_REVIEW",
              "RESOLVED_VALID",
              "RESOLVED_FALSE",
              "IGNORED",
            ])
            .optional(),
          severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
          campaignId: z.string().optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        const { page, limit, status, severity, campaignId } = input;
        const skip = (page - 1) * limit;

        const where = {
          ...(status && { status }),
          ...(severity && { severity }),
          ...(campaignId && { campaignId }),
        };

        const [flags, total] = await Promise.all([
          ctx.db.fraudFlag.findMany({
            where,
            skip,
            take: limit,
            orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
            include: {
              campaign: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
              clipPost: {
                select: {
                  id: true,
                  submittedUrl: true,
                  platform: true,
                },
              },
              reviewer: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          }),
          ctx.db.fraudFlag.count({ where }),
        ]);

        return {
          flags,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      }),

    // Revisar flag
    review: adminProcedure
      .input(
        z.object({
          id: z.string(),
          status: z.enum(["RESOLVED_VALID", "RESOLVED_FALSE", "IGNORED"]),
          reviewNotes: z.string().optional(),
          resolution: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const flag = await ctx.db.fraudFlag.update({
          where: { id: input.id },
          data: {
            status: input.status,
            reviewedBy: ctx.userId,
            reviewedAt: new Date(),
            reviewNotes: input.reviewNotes,
            resolution: input.resolution,
          },
        });

        // Log de auditoria
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.userId,
            action: "UPDATE",
            entityType: "FraudFlag",
            entityId: flag.id,
            campaignId: flag.campaignId,
            changes: {
              action: "reviewed",
              status: input.status,
              notes: input.reviewNotes,
            },
          },
        });

        return flag;
      }),

    // Estatísticas
    stats: adminProcedure.query(async ({ ctx }) => {
      const [total, bySeverity, byStatus, openCritical] = await Promise.all([
        ctx.db.fraudFlag.count(),
        ctx.db.fraudFlag.groupBy({
          by: ["severity"],
          _count: true,
        }),
        ctx.db.fraudFlag.groupBy({
          by: ["status"],
          _count: true,
        }),
        ctx.db.fraudFlag.count({
          where: {
            status: "OPEN",
            severity: "CRITICAL",
          },
        }),
      ]);

      return {
        total,
        openCritical,
        bySeverity: bySeverity.reduce(
          (acc, curr) => {
            acc[curr.severity] = curr._count;
            return acc;
          },
          {} as Record<string, number>,
        ),
        byStatus: byStatus.reduce(
          (acc, curr) => {
            acc[curr.status] = curr._count;
            return acc;
          },
          {} as Record<string, number>,
        ),
      };
    }),
  }),

  // ============================================================================
  // AUDITORIA - Visualização
  // ============================================================================

  auditLogs: createTRPCRouter({
    // Listar logs
    list: adminProcedure
      .input(
        z.object({
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(100).default(50),
          userId: z.string().optional(),
          entityType: z.string().optional(),
          action: z
            .enum([
              "CREATE",
              "UPDATE",
              "DELETE",
              "APPROVE",
              "REJECT",
              "ENABLE",
              "DISABLE",
              "EXPORT",
              "LOGIN",
              "LOGOUT",
            ])
            .optional(),
          campaignId: z.string().optional(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        const {
          page,
          limit,
          userId,
          entityType,
          action,
          campaignId,
          startDate,
          endDate,
        } = input;
        const skip = (page - 1) * limit;

        const where = {
          ...(userId && { userId }),
          ...(entityType && { entityType }),
          ...(action && { action }),
          ...(campaignId && { campaignId }),
          ...((startDate || endDate) && {
            createdAt: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate }),
            },
          }),
        };

        const [logs, total] = await Promise.all([
          ctx.db.auditLog.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              campaign: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          }),
          ctx.db.auditLog.count({ where }),
        ]);

        return {
          logs,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      }),

    // Estatísticas de auditoria
    stats: adminProcedure
      .input(
        z.object({
          startDate: z.date().optional(),
          endDate: z.date().optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        const where = {
          ...((input.startDate || input.endDate) && {
            createdAt: {
              ...(input.startDate && { gte: input.startDate }),
              ...(input.endDate && { lte: input.endDate }),
            },
          }),
        };

        const [total, byAction, byEntityType, topUsers] = await Promise.all([
          ctx.db.auditLog.count({ where }),
          ctx.db.auditLog.groupBy({
            by: ["action"],
            where,
            _count: true,
          }),
          ctx.db.auditLog.groupBy({
            by: ["entityType"],
            where,
            _count: true,
          }),
          ctx.db.auditLog.groupBy({
            by: ["userId"],
            where: {
              ...where,
              userId: { not: null },
            },
            _count: true,
            orderBy: { _count: { userId: "desc" } },
            take: 10,
          }),
        ]);

        return {
          total,
          byAction: byAction.reduce(
            (acc, curr) => {
              acc[curr.action] = curr._count;
              return acc;
            },
            {} as Record<string, number>,
          ),
          byEntityType: byEntityType.reduce(
            (acc, curr) => {
              acc[curr.entityType] = curr._count;
              return acc;
            },
            {} as Record<string, number>,
          ),
          topUsers: topUsers.map((u) => ({
            userId: u.userId!,
            count: u._count,
          })),
        };
      }),
  }),

  // ============================================================================
  // DASHBOARD - Visão Geral do Sistema
  // ============================================================================

  dashboard: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Buscar total de views somando views de todos os posts
    const totalMetricsResult = await ctx.db.clipPost.aggregate({
      _sum: {
        views: true,
        likes: true,
        comments: true,
        shares: true,
        saves: true,
      },
    });
    const totalViews = Number(totalMetricsResult._sum.views || 0);
    const totalLikes = totalMetricsResult._sum.likes || 0;
    const engagementRate = calculateEngagementRate(
      totalViews,
      totalLikes,
      totalMetricsResult._sum.comments || 0,
      totalMetricsResult._sum.shares || 0,
      totalMetricsResult._sum.saves || 0,
    );

    // Buscar views do mês anterior para calcular crescimento
    const previousMonth = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const previousMonthViewsResult = await ctx.db.clipPost.aggregate({
      _sum: { views: true },
      where: {
        createdAt: {
          gte: previousMonth,
          lt: thirtyDaysAgo,
        },
      },
    });
    const previousMonthViews = Number(previousMonthViewsResult._sum.views || 0);
    const viewsGrowth =
      previousMonthViews > 0
        ? ((totalViews - previousMonthViews) / previousMonthViews) * 100
        : 0;

    const [
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
    ] = await Promise.all([
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
    ]);

    // Buscar crescimento de clippers (novos no último mês)
    const newClippersThisMonth = await ctx.db.clipperProfile.count({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    // Buscar crescimento de campanhas (novas no último mês)
    const newCampaignsThisMonth = await ctx.db.campaign.count({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    // Calcular crescimento de engagement rate (simplificado)
    const previousEngagementRate =
      engagementRate > 0 ? engagementRate * 0.9 : 0; // mock do crescimento
    const engagementGrowth =
      previousEngagementRate > 0
        ? ((engagementRate - previousEngagementRate) / previousEngagementRate) *
          100
        : 0;

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
        viewsGrowth: Number(viewsGrowth.toFixed(1)),
        newClippersThisMonth,
        newCampaignsThisMonth,
        engagementGrowth: Number(engagementGrowth.toFixed(1)),
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

  // Dados de crescimento ao longo do tempo (últimos 30 dias)
  getGrowthData: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const days = [];

    // Gerar últimos 30 dias
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      // Formato: "04/Nov" ou "15/Out"
      const dayLabel = date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      });

      // Buscar views e engagement do dia
      const [viewsResult, likesResult] = await Promise.all([
        ctx.db.clipPost.aggregate({
          _sum: { views: true },
          where: {
            createdAt: {
              gte: date,
              lt: nextDay,
            },
          },
        }),
        ctx.db.clipPost.aggregate({
          _sum: { likes: true },
          where: {
            createdAt: {
              gte: date,
              lt: nextDay,
            },
          },
        }),
      ]);

      days.push({
        month: dayLabel.replace(".", "").replace(" de ", "/"), // Formato: "04/nov"
        views: Number(viewsResult._sum.views || 0),
        engagement: likesResult._sum.likes || 0,
      });
    }

    return days;
  }),

  getViewsByPlatformGrowth: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 89);
    startDate.setHours(0, 0, 0, 0);

    const [postsInRange, allPlatforms, viewsBefore] = await Promise.all([
      ctx.db.clipPost.findMany({
        where: { createdAt: { gte: startDate } },
        select: { platform: true, views: true, createdAt: true },
      }),
      ctx.db.clipPost.groupBy({
        by: ["platform"],
        _sum: { views: true },
      }),
      ctx.db.clipPost.groupBy({
        by: ["platform"],
        where: { createdAt: { lt: startDate } },
        _sum: { views: true },
      }),
    ]);

    const platforms = allPlatforms.map((p) => p.platform).sort();

    const beforeMap: Record<string, number> = {};
    let totalBefore = 0;
    for (const vb of viewsBefore) {
      const v = Number(vb._sum.views || 0);
      beforeMap[vb.platform] = v;
      totalBefore += v;
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

    for (const post of postsInRange) {
      const key = post.createdAt.toISOString().slice(0, 10);
      const row = dayMap.get(key);
      if (!row) continue;
      const views = Number(post.views || 0);
      row.total = (row.total || 0) + views;
      row[post.platform] = (row[post.platform] || 0) + views;
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
    const platforms = await ctx.db.clipPost.groupBy({
      by: ["platform"],
      _count: { id: true },
      _sum: {
        views: true,
        likes: true,
        comments: true,
        shares: true,
        saves: true,
      },
    });

    const platformData = await Promise.all(
      platforms.map(async (p) => {
        // Contar clippers únicos por plataforma
        const clippers = await ctx.db.clipPost.findMany({
          where: { platform: p.platform },
          select: { applicationId: true },
          distinct: ["applicationId"],
        });

        const totalViews = Number(p._sum.views || 0);
        const totalLikes = p._sum.likes || 0;
        const totalComments = p._sum.comments || 0;
        const totalShares = p._sum.shares || 0;
        const totalSaves = p._sum.saves || 0;
        const engagementRate = calculateEngagementRate(
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
          totalSaves,
        );

        return {
          platform: p.platform,
          posts: p._count.id,
          clippers: clippers.length,
          views: totalViews,
          totalInteractions:
            totalLikes + totalComments + totalShares + totalSaves,
          engagementRate,
        };
      }),
    );

    return platformData;
  }),

  // Top Campanhas
  getTopCampaigns: adminProcedure.query(async ({ ctx }) => {
    const campaigns = await ctx.db.campaign.findMany({
      where: { status: "ACTIVE" },
      take: 3,
      orderBy: { createdAt: "desc" },
      include: {
        clipPosts: {
          select: {
            views: true,
          },
        },
        _count: {
          select: { clipPosts: true },
        },
      },
    });

    return campaigns.map((campaign) => {
      const totalViews = campaign.clipPosts.reduce(
        (sum, post) => sum + Number(post.views),
        0,
      );

      return {
        id: campaign.id,
        name: campaign.name,
        slug: campaign.slug,
        views: totalViews,
        posts: campaign._count.clipPosts,
        viewsFormatted:
          totalViews >= 1000000
            ? `${(totalViews / 1000000).toFixed(1)}M`
            : totalViews >= 1000
              ? `${(totalViews / 1000).toFixed(1)}K`
              : totalViews.toString(),
      };
    });
  }),

  // Top Clippers
  getTopClippers: adminProcedure.query(async ({ ctx }) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const posts = await ctx.db.clipPost.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: {
        views: true,
        likes: true,
        comments: true,
        shares: true,
        saves: true,
        application: {
          select: { clipperProfileId: true },
        },
      },
    });

    const clipperMap = new Map<
      string,
      {
        views: number;
        likes: number;
        comments: number;
        shares: number;
        saves: number;
        posts: number;
      }
    >();
    for (const post of posts) {
      const cpId = post.application.clipperProfileId;
      const existing = clipperMap.get(cpId) || {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        posts: 0,
      };
      existing.views += Number(post.views || 0);
      existing.likes += post.likes || 0;
      existing.comments += post.comments || 0;
      existing.shares += post.shares || 0;
      existing.saves += post.saves || 0;
      existing.posts += 1;
      clipperMap.set(cpId, existing);
    }

    const sorted = Array.from(clipperMap.entries())
      .sort((a, b) => b[1].views - a[1].views)
      .slice(0, 5);

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

  // Sincronizar fotos de perfil do Clerk para o banco
  syncProfileImages: adminProcedure.mutation(async ({ ctx }) => {
    try {
      console.log("🔄 Iniciando sincronização de imagens via Admin...");

      // Importar dinamicamente para evitar problemas
      const { createClerkClient } = await import("@clerk/backend");

      const clerkClient = createClerkClient({
        secretKey: process.env.CLERK_SECRET_KEY,
      });

      // 1. Buscar usuários do banco
      const dbUsers = await ctx.db.user.findMany({
        select: {
          id: true,
          email: true,
          imageUrl: true,
        },
      });

      // 2. Buscar usuários do Clerk
      const clerkUsers = await clerkClient.users.getUserList({
        limit: 500,
      });

      // 3. Processar cada usuário
      let updatedCount = 0;
      let skippedCount = 0;
      const updates: Array<{ email: string; status: string }> = [];

      for (const clerkUser of clerkUsers.data) {
        const dbUser = dbUsers.find((u) => u.id === clerkUser.id);

        if (!dbUser) {
          skippedCount++;
          continue;
        }

        if (!clerkUser.imageUrl) {
          skippedCount++;
          continue;
        }

        if (dbUser.imageUrl === clerkUser.imageUrl) {
          skippedCount++;
          continue;
        }

        // Atualizar no banco
        await ctx.db.user.update({
          where: { id: clerkUser.id },
          data: { imageUrl: clerkUser.imageUrl },
        });

        updatedCount++;
        updates.push({
          email: dbUser.email || "sem email",
          status: "atualizado",
        });
      }

      console.log(
        `✅ Sincronização concluída: ${updatedCount} atualizados, ${skippedCount} ignorados`,
      );

      return {
        success: true,
        updatedCount,
        skippedCount,
        totalProcessed: clerkUsers.data.length,
        updates,
      };
    } catch (error: any) {
      console.error("❌ Erro na sincronização:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Erro ao sincronizar imagens",
      });
    }
  }),

  // Métricas de Performance (Radar Chart)
  getPerformanceMetrics: adminProcedure.query(async ({ ctx }) => {
    // Buscar totais de todas as métricas
    const [totalMetrics, maxMetrics] = await Promise.all([
      ctx.db.clipPost.aggregate({
        _sum: {
          views: true,
          likes: true,
          comments: true,
          shares: true,
          saves: true,
        },
        _count: { _all: true },
      }),
      ctx.db.clipPost.aggregate({
        _max: {
          views: true,
          likes: true,
          comments: true,
          shares: true,
          saves: true,
        },
      }),
    ]);

    const totalViews = Number(totalMetrics._sum.views || 0);
    const totalLikes = totalMetrics._sum.likes || 0;
    const totalComments = totalMetrics._sum.comments || 0;
    const totalShares = totalMetrics._sum.shares || 0;
    const totalSaves = totalMetrics._sum.saves || 0;
    const totalPosts = totalMetrics._count._all;

    // Calcular scores normalizados (0-100)
    // Views: normalizado pela média
    const avgViews = totalPosts > 0 ? totalViews / totalPosts : 0;
    const maxViews = Number(maxMetrics._max.views || 1);
    const viewsScore =
      maxViews > 0 ? Math.min((avgViews / maxViews) * 100, 100) : 0;

    // Likes: normalizado pela taxa (likes/views)
    const likesRate = totalViews > 0 ? (totalLikes / totalViews) * 100 : 0;
    const likesScore = Math.min(likesRate * 10, 100); // Taxa de 10% = score 100

    // Comments: normalizado pela taxa (comments/views)
    const commentsRate =
      totalViews > 0 ? (totalComments / totalViews) * 100 : 0;
    const commentsScore = Math.min(commentsRate * 20, 100); // Taxa de 5% = score 100

    // Shares: normalizado pela taxa (shares/views)
    const sharesRate = totalViews > 0 ? (totalShares / totalViews) * 100 : 0;
    const sharesScore = Math.min(sharesRate * 25, 100); // Taxa de 4% = score 100

    // Saves: normalizado pela taxa (saves/views)
    const savesRate = totalViews > 0 ? (totalSaves / totalViews) * 100 : 0;
    const savesScore = Math.min(savesRate * 20, 100); // Taxa de 5% = score 100

    // Engagement Rate: (likes + comments + shares + saves) / views
    const engagementRate = calculateEngagementRate(
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      totalSaves,
    );
    const erScore = Math.min(engagementRate * 5, 100); // ER de 20% = score 100

    const metrics = [
      { metric: "Views", score: Math.round(viewsScore) },
      { metric: "Likes", score: Math.round(likesScore) },
      { metric: "Shares", score: Math.round(sharesScore) },
      { metric: "Comments", score: Math.round(commentsScore) },
      { metric: "Saves", score: Math.round(savesScore) },
      { metric: "ER", score: Math.round(erScore) },
    ];

    // Calcular média geral
    const averageScore =
      metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length;

    return {
      metrics,
      averageScore: Number(averageScore.toFixed(1)),
    };
  }),

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

      // Para cada campanha, buscar estatísticas
      const campaignsWithStats = await Promise.all(
        campaigns.map(async (campaign) => {
          // Buscar estatísticas de posts - TODOS os posts independente do status
          const postsStats = await ctx.db.clipPost.aggregate({
            where: {
              campaignId: campaign.id,
              // Removido filtro de status para contar TODOS os posts
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
          });

          // Contar clippers ativos (aprovados)
          const activeClippers = await ctx.db.clipperApplication.count({
            where: {
              campaignId: campaign.id,
              status: "APPROVED",
            },
          });

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
        }),
      );

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
      // Contar campanhas por status
      const [activeCampaigns, scheduledCampaigns, completedCampaigns] =
        await Promise.all([
          ctx.db.campaign.count({
            where: { status: "ACTIVE" },
          }),
          ctx.db.campaign.count({
            where: { status: "SCHEDULED" },
          }),
          ctx.db.campaign.count({
            where: { status: "COMPLETED" },
          }),
        ]);

      // Buscar total de views de todas as campanhas ativas e concluídas - TODOS os posts
      const totalViewsStats = await ctx.db.clipPost.aggregate({
        where: {
          campaign: {
            status: {
              in: ["ACTIVE", "COMPLETED"],
            },
          },
          // Removido filtro de status para contar TODOS os posts
        },
        _sum: {
          views: true,
        },
      });

      const totalViews = Number(totalViewsStats._sum.views || 0);

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
        await ctx.db.clipperApplication.update({
          where: { id: input.applicationId },
          data: {
            status: "APPROVED",
            approvedAt: new Date(),
            reviewedBy: ctx.userId,
            reviewedAt: new Date(),
            reviewNotes: input.reviewNotes,
          },
        });

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
            await ctx.db.clipperApplication.update({
              where: { id: application.id },
              data: {
                status: "APPROVED",
                approvedAt: new Date(),
                reviewedBy: ctx.userId,
                reviewedAt: new Date(),
              },
            });

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
        await ctx.db.clipperApplication.update({
          where: { id: input.applicationId },
          data: {
            status: "REJECTED",
            reviewedBy: ctx.userId,
            reviewedAt: new Date(),
            rejectionReason: input.rejectionReason,
          },
        });

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
          select: { id: true, name: true, isPrivate: true },
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
            status: { not: "REJECTED" }, // Excluir rejeitados para permitir reinscrição
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
          },
        });

        const alreadyEnrolledIds = new Set(
          existingApplications.map((a) => a.clipperProfileId),
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

        // Inscrever cada clipador
        for (const clipper of clipperProfiles) {
          try {
            const socialAccountIds = clipper.socialAccounts.map((sa) => sa.id);

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

        // Executar TODAS as queries em paralelo após obter campaign.id
        const [
          [totalStats, totalClippers, totalPosts],
          monthlyBoard,
          topAccountsGrouped,
          [todayPostsCountResult, todayPosts, dailyEntryMetricsMap],
          topPostsForReport,
        ] = await Promise.all([
          // 1. Estatísticas gerais
          Promise.all([
            ctx.db.clipPost.aggregate({
              where: { campaignId: campaign.id },
              _sum: {
                views: true,
                likes: true,
                comments: true,
                shares: true,
                saves: true,
              },
              _count: { id: true },
            }),
            ctx.db.clipperApplication.count({
              where: { campaignId: campaign.id, status: "APPROVED" },
            }),
            ctx.db.clipPost.count({ where: { campaignId: campaign.id } }),
          ]),
          // 2. Ranking mensal (com dados de campanha já carregados)
          computeMonthlyLeaderboard(ctx.db, campaign.id, campaignForMonthly),
          // 3. Top contas por rede social
          ctx.db.clipPost.groupBy({
            by: ["username", "platform"],
            where: { campaignId: campaign.id, status: "ELIGIBLE" },
            _sum: {
              views: true,
              likes: true,
              comments: true,
              shares: true,
              saves: true,
            },
            _count: { id: true },
          }),
          // 4. Posts e ranking diário de hoje
          Promise.all([
            ctx.db.clipPost.count({
              where: {
                campaignId: campaign.id,
                postedAt: { gte: todayStartUTC, lt: todayEndUTC },
              },
            }),
            ctx.db.clipPost.findMany({
              where: {
                campaignId: campaign.id,
                status: { not: "DISQUALIFIED" },
                postedAt: { gte: todayStartUTC, lt: todayEndUTC },
              },
              include: {
                application: {
                  include: {
                    clipperProfile: {
                      include: {
                        user: { select: { imageUrl: true } },
                        clan: {
                          select: { tag: true, emoji: true, emojiColor: true },
                        },
                      },
                    },
                  },
                },
              },
            }),
            loadDailyRankingEntryMetricsMap(
              ctx.db,
              campaign.id,
              referenceDateYmd,
            ),
          ]),
          // 5. Top 10 posts para relatório
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
        const topMonthlyRanking = monthlyBoard?.rows ?? [];

        const totalViews = Number(totalStats._sum.views || 0);
        const totalLikes = totalStats._sum.likes || 0;
        const totalComments = totalStats._sum.comments || 0;
        const totalShares = totalStats._sum.shares || 0;
        const totalSaves = totalStats._sum.saves || 0;
        const engagementRate = calculateEngagementRate(
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
          totalSaves,
        );

        const topAccountsRanking = topAccountsGrouped
          .map((row) => {
            const totalViews = Number(row._sum.views ?? 0);
            const totalLikes = row._sum.likes ?? 0;
            const totalComments = row._sum.comments ?? 0;
            const totalShares = row._sum.shares ?? 0;
            const totalSaves = row._sum.saves ?? 0;
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
              postsCount: row._count.id,
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
              clipperName:
                post.application.clipperProfile.artisticName ||
                post.application.clipperProfile.fullName,
              clipperImageUrl:
                post.application.clipperProfile.user?.imageUrl || null,
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
              clanTag: post.application.clipperProfile.clan?.tag ?? null,
              clanEmoji: post.application.clipperProfile.clan?.emoji ?? null,
              clanEmojiColor:
                post.application.clipperProfile.clan?.emojiColor ?? null,
            };
          }),
          metricType:
            metricType === RankingMetricType.VIEWS_X_ENGAGEMENT
              ? RankingMetricType.VIEWS_X_ENGAGEMENT
              : RankingMetricType.VIEWS,
          topCount: dailyLimit,
          dailyPrizeTable: campaign.activeRankingRule?.dailyPrizeTable ?? null,
        });
        const todayPostUrlMap = new Map(
          todayPosts.map((p) => [p.id, p.submittedUrl]),
        );
        const topDailyRanking = rankedDailyPosts.map((item) => ({
          ...item,
          postUrl: todayPostUrlMap.get(item.postId) ?? "",
        }));

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
          .enum(["PENDING", "APPROVED", "REJECTED", "UNDER_REVIEW"])
          .optional(),
        search: z.string().max(200).optional(),
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

        // Contagens por status (sempre, independente do filtro ativo)
        const statusCounts = await ctx.db.clipperApplication.groupBy({
          by: ["status"],
          where: { campaignId: campaign.id },
          _count: { id: true },
        });
        const countByStatus = new Map(
          statusCounts.map((r) => [r.status, r._count.id]),
        );
        const pendingCount = countByStatus.get("PENDING") ?? 0;
        const approvedCount = countByStatus.get("APPROVED") ?? 0;
        const totalCount = statusCounts.reduce((s, r) => s + r._count.id, 0);

        const searchTrimmed = input.search?.trim() ?? "";
        const applicationsWhere: Prisma.ClipperApplicationWhereInput = {
          campaignId: campaign.id,
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

        const [applications, listMatchCount] = await Promise.all([
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
              clipPosts: {
                select: {
                  id: true,
                  status: true,
                  views: true,
                  likes: true,
                  username: true,
                  platform: true,
                  submittedUrl: true,
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

        // Buscar transações de todos os clippers para calcular total ganho NESTA competição
        const clipperProfileIds = applications.map(
          (app) => app.clipperProfileId,
        );
        const transactions =
          clipperProfileIds.length > 0
            ? await ctx.db.transaction.findMany({
                where: {
                  wallet: {
                    clipperProfileId: {
                      in: clipperProfileIds,
                    },
                  },
                  campaignId: campaign.id,
                  status: "COMPLETED",
                  type: {
                    in: ["PRIZE_CREDIT", "BONUS", "ADJUSTMENT"],
                  },
                },
                select: {
                  wallet: {
                    select: {
                      clipperProfileId: true,
                    },
                  },
                  amount: true,
                },
              })
            : [];

        // Criar um mapa com o total ganho por clipper NESTA competição
        const earningsMap = new Map<string, number>();
        transactions.forEach((transaction) => {
          const clipperProfileId = transaction.wallet.clipperProfileId;
          const currentTotal = earningsMap.get(clipperProfileId) || 0;
          earningsMap.set(
            clipperProfileId,
            currentTotal + Number(transaction.amount),
          );
        });

        const formattedApplications = applications.map((app) => {
          const eligiblePosts = app.clipPosts.filter(
            (post) => post.status === "ELIGIBLE",
          );
          const totalViews = eligiblePosts.reduce(
            (sum, post) => sum + Number(post.views),
            0,
          );
          const totalLikes = eligiblePosts.reduce(
            (sum, post) => sum + post.likes,
            0,
          );
          const totalEarned = earningsMap.get(app.clipperProfileId) || 0;

          return {
            id: app.id,
            clipperProfileId: app.clipperProfileId,
            status: app.status,
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
            postsCount: app.clipPosts.length,
            eligiblePostsCount: eligiblePosts.length,
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
              const accountPosts = app.clipPosts.filter(
                (post) =>
                  post.username?.toLowerCase() ===
                    acc.socialAccount.username?.toLowerCase() &&
                  post.platform === acc.socialAccount.platform,
              );
              const eligibleAccountPosts = accountPosts.filter(
                (p) => p.status === "ELIGIBLE",
              );
              const accountViews = eligibleAccountPosts.reduce(
                (sum, p) => sum + Number(p.views),
                0,
              );

              return {
                id: acc.socialAccount.id,
                platform: acc.socialAccount.platform,
                username: acc.socialAccount.username,
                profileUrl: acc.socialAccount.profileUrl,
                isPrimary: acc.socialAccount.isPrimary,
                isVerified: acc.socialAccount.isVerified,
                followers: acc.socialAccount.followers,
                postsCount: accountPosts.length,
                eligiblePostsCount: eligibleAccountPosts.length,
                totalViews: accountViews,
              };
            }),
            posts: app.clipPosts.map((post) => ({
              id: post.id,
              status: post.status,
              views: Number(post.views),
              likes: post.likes,
              username: post.username,
              platform: post.platform,
              submittedUrl: post.submittedUrl,
            })),
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

        // Estatísticas gerais para ajuste do último ponto do gráfico
        const totalStatsAgg = await ctx.db.clipPost.aggregate({
          where: { campaignId: campaign.id },
          _sum: {
            views: true,
            likes: true,
          },
        });
        const totalViews = Number(totalStatsAgg._sum.views || 0);
        const totalLikes = totalStatsAgg._sum.likes || 0;

        // ============================================================================
        // CRESCIMENTO AO LONGO DO TEMPO — single query com generate_series
        // ============================================================================
        const growthData: Array<{
          date: string;
          views: number;
          likes: number;
          viewsDelta: number;
          likesDelta: number;
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

        if (totalDays > 0) {
          // Último dia da série (inclusive)
          const lastDayEnd = new Date(competitionStart);
          lastDayEnd.setUTCDate(competitionStart.getUTCDate() + totalDays - 1);
          lastDayEnd.setUTCHours(23, 59, 59, 999);

          // Strategy: single DISTINCT ON (clipPostId, day) scan → group by day → ~90 rows.
          // Avoids the LATERAL que roda um full-scan por dia (lento com 10k+ posts).
          // runningMax em JS compensa posts sem métrica em dias intermediários.
          type DailyTotalRow = {
            snap_day: Date;
            total_views: bigint;
            total_likes: bigint;
          };

          const dailyTotals = await ctx.db.$queryRaw<DailyTotalRow[]>`
            WITH per_post_day AS (
              SELECT DISTINCT ON (cpm."clipPostId", DATE_TRUNC('day', cpm."collectedAt" AT TIME ZONE 'UTC'))
                DATE_TRUNC('day', cpm."collectedAt" AT TIME ZONE 'UTC') AS snap_day,
                cpm."views"::bigint  AS views,
                cpm."likes"::bigint  AS likes
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
              COALESCE(SUM(views), 0)::bigint AS total_views,
              COALESCE(SUM(likes), 0)::bigint AS total_likes
            FROM per_post_day
            GROUP BY snap_day
            ORDER BY snap_day
          `;
          // Build lookup map from date string → totals
          const dailyMap = new Map<string, { views: number; likes: number }>();
          for (const row of dailyTotals) {
            const dayStr = row.snap_day.toISOString().split("T")[0]!;
            dailyMap.set(dayStr, {
              views: Number(row.total_views),
              likes: Number(row.total_likes),
            });
          }

          // Generate day series and apply runningMax (compensates for forward-fill gaps)
          let runningMaxViews = 0;
          let runningMaxLikes = 0;

          for (let i = 0; i < totalDays; i++) {
            const day = new Date(competitionStart);
            day.setUTCDate(competitionStart.getUTCDate() + i);
            const dayStr = day.toISOString().split("T")[0]!;

            const prevViews = runningMaxViews;
            const prevLikes = runningMaxLikes;

            const entry = dailyMap.get(dayStr);
            if (entry) {
              runningMaxViews = Math.max(runningMaxViews, entry.views);
              runningMaxLikes = Math.max(runningMaxLikes, entry.likes);
            }

            growthData.push({
              date: dayStr,
              views: runningMaxViews,
              likes: runningMaxLikes,
              viewsDelta: runningMaxViews - prevViews,
              likesDelta: runningMaxLikes - prevLikes,
            });
          }

          // Ajustar último ponto para bater com totalViews real
          if (growthData.length > 0) {
            const lastEntry = growthData[growthData.length - 1]!;
            if (lastEntry.views < totalViews) {
              const extraViews = totalViews - lastEntry.views;
              const extraLikes = Math.max(0, totalLikes - lastEntry.likes);
              lastEntry.views = totalViews;
              lastEntry.likes = Math.max(lastEntry.likes, totalLikes);
              lastEntry.viewsDelta += extraViews;
              lastEntry.likesDelta += extraLikes;
            }
          }
        }

        // Distribuição por plataforma
        const platformStats = await ctx.db.clipPost.groupBy({
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
        });

        const platformDistribution = platformStats.map((stat) => ({
          platform: stat.platform,
          posts: stat._count.id,
          views: Number(stat._sum.views || 0),
          likes: stat._sum.likes || 0,
          comments: stat._sum.comments || 0,
          shares: stat._sum.shares || 0,
          saves: stat._sum.saves || 0,
        }));

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

        const [postsInRange, allPlatformsInCampaign] = await Promise.all([
          ctx.db.clipPost.findMany({
            where: {
              campaignId: campaign.id,
              createdAt: { gte: growthStartDate, lte: growthEndDate },
            },
            select: { platform: true, views: true, createdAt: true },
          }),
          ctx.db.clipPost.groupBy({
            by: ["platform"],
            where: { campaignId: campaign.id },
            _sum: { views: true },
          }),
        ]);

        const growthPlatforms = allPlatformsInCampaign
          .map((p) => p.platform)
          .sort();

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

        for (const post of postsInRange) {
          const key = toLocalDateStr(post.createdAt);
          const row = platformDayMap.get(key);
          if (!row) continue;
          const views = Number(post.views || 0);
          row.total = (row.total || 0) + views;
          row[post.platform] = (row[post.platform] || 0) + views;
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
          const realTotal = allPlatformsInCampaign.reduce(
            (acc, p) => acc + Number(p._sum.views || 0),
            0,
          );
          lastEntry.total = realTotal;
          for (const p of growthPlatforms) {
            const platformData = allPlatformsInCampaign.find(
              (x) => x.platform === p,
            );
            if (platformData) {
              lastEntry[p] = Number(platformData._sum.views || 0);
            }
          }
        }

        return {
          growthData,
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

        // Construir where clause
        const where: any = {
          campaignId: campaign.id,
        };

        if (input.status && input.status !== "all") {
          where.status = input.status;
        }

        if (input.platform && input.platform !== "all") {
          where.platform = input.platform;
        }

        if (input.accountSearch) {
          where.username = {
            contains: input.accountSearch.replace("@", ""),
            mode: "insensitive",
          };
        }

        if (input.linkSearch) {
          where.submittedUrl = {
            contains: input.linkSearch,
            mode: "insensitive",
          };
        }

        if (input.postedAtFrom || input.postedAtTo) {
          where.postedAt = {};

          if (input.postedAtFrom) {
            where.postedAt.gte = new Date(input.postedAtFrom);
          }

          if (input.postedAtTo) {
            where.postedAt.lte = new Date(input.postedAtTo);
          }
        }

        if (input.commentsDataFilter !== "all") {
          const postsWithDetailedComments = await ctx.db.$queryRaw<
            Array<{ clipPostId: string }>
          >`
            SELECT DISTINCT cpc."clipPostId"
            FROM "ClipPostComment" cpc
            INNER JOIN "ClipPost" cp ON cp."id" = cpc."clipPostId"
            WHERE cp."campaignId" = ${campaign.id}
          `;
          const postIdsWithDetailedComments = postsWithDetailedComments.map(
            (row) => row.clipPostId,
          );

          if (input.commentsDataFilter === "with") {
            where.id = {
              in:
                postIdsWithDetailedComments.length > 0
                  ? postIdsWithDetailedComments
                  : ["__no_posts_with_detailed_comments__"],
            };
          }

          if (
            input.commentsDataFilter === "without" &&
            postIdsWithDetailedComments.length > 0
          ) {
            where.id = { notIn: postIdsWithDetailedComments };
          }
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
          where.applicationId = { in: matchingApplications.map((a) => a.id) };
        }

        // Contar total
        const totalCount = await ctx.db.clipPost.count({ where });

        // Determinar ordenação
        let orderBy: any;
        switch (input.sortBy) {
          case "views":
            orderBy = { views: "desc" };
            break;
          case "likes":
            orderBy = { likes: "desc" };
            break;
          case "comments":
            orderBy = { comments: "desc" };
            break;
          case "shares":
            orderBy = { shares: "desc" };
            break;
          case "recent":
          default:
            orderBy = { createdAt: "desc" };
            break;
        }

        const isEngagementSort = input.sortBy === "engagement";
        const skip = (input.page - 1) * input.pageSize;

        let posts: any[];
        if (isEngagementSort) {
          // Fase 1: buscar só id + métricas para ordenar (sem relações, sem colunas extras)
          const allPostsForSort = await ctx.db.clipPost.findMany({
            where,
            select: {
              id: true,
              views: true,
              likes: true,
              comments: true,
              shares: true,
            },
          });

          allPostsForSort.sort((a, b) => {
            const viewsA = Number(a.views);
            const viewsB = Number(b.views);
            const engA =
              viewsA > 0 ? (a.likes + a.comments + a.shares) / viewsA : 0;
            const engB =
              viewsB > 0 ? (b.likes + b.comments + b.shares) / viewsB : 0;
            return engB - engA;
          });

          const pageIds = allPostsForSort
            .slice(skip, skip + input.pageSize)
            .map((p) => p.id);

          if (pageIds.length === 0) {
            posts = [];
          } else {
            const idOrder = new Map(pageIds.map((id, i) => [id, i]));
            const pagePosts = await ctx.db.clipPost.findMany({
              where: { id: { in: pageIds } },
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
                createdAt: true,
                status: true,
                ineligibilityReason: true,
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
        } else {
          posts = await ctx.db.clipPost.findMany({
            where,
            orderBy,
            skip,
            take: input.pageSize,
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
              createdAt: true,
              status: true,
              ineligibilityReason: true,
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
        }

        const formattedPosts = posts.map((post) => ({
          id: post.id,
          url: post.submittedUrl,
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
        newest: `sa."createdAt" DESC`,
        oldest: `sa."createdAt" ASC`,
        followers_desc: `sa."followers" DESC NULLS LAST`,
        followers_asc: `sa."followers" ASC NULLS LAST`,
        totalViews_desc: `"totalViews" DESC NULLS LAST`,
        totalPosts_desc: `"totalPosts" DESC NULLS LAST`,
      };
      const orderBy = orderByMap[sortBy] ?? `sa."createdAt" DESC`;

      const offsetParam = `$${paramIdx}`;
      const limitParam = `$${paramIdx + 1}`;
      params.push((page - 1) * perPage, perPage);

      const countResult = await ctx.db.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(sa.id)::bigint as count
         FROM "SocialAccount" sa
         JOIN "ClipperProfile" cp ON sa."clipperProfileId" = cp.id
         ${whereClause}`,
        ...params.slice(0, paramIdx - 1),
      );
      const totalCount = Number(countResult[0]?.count ?? 0);

      const rawAccounts = await ctx.db.$queryRawUnsafe<any[]>(
        `WITH account_stats AS (
          SELECT
            sa2.id as "accountId",
            COUNT(cp2.id)::bigint as "totalPosts",
            COALESCE(SUM(cp2.views), 0)::bigint as "totalViews"
          FROM "SocialAccount" sa2
          JOIN "ClipperApplication" ca2 ON ca2."clipperProfileId" = sa2."clipperProfileId"
          JOIN "ClipPost" cp2 ON cp2."applicationId" = ca2.id
            AND cp2."platform"::text = sa2."platform"::text
            AND LOWER(REPLACE(COALESCE(cp2."username", ''), '@', '')) = LOWER(REPLACE(sa2."username", '@', ''))
          GROUP BY sa2.id
        )
        SELECT
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
          u."imageUrl",
          COALESCE(ast."totalPosts", 0)::int as "totalPosts",
          COALESCE(ast."totalViews", 0)::bigint as "totalViews"
        FROM "SocialAccount" sa
        JOIN "ClipperProfile" cp ON sa."clipperProfileId" = cp.id
        JOIN "User" u ON cp."userId" = u.id
        LEFT JOIN account_stats ast ON sa.id = ast."accountId"
        ${whereClause}
        ORDER BY ${orderBy}
        OFFSET ${offsetParam} LIMIT ${limitParam}`,
        ...params,
      );

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
        totalPosts: Number(r.totalPosts),
        totalViews: Number(r.totalViews),
      }));

      return {
        accounts,
        totalCount,
        page,
        perPage,
        totalPages: Math.ceil(totalCount / perPage),
      };
    }),

  getSocialAccountsStats: adminProcedure.query(async ({ ctx }) => {
    const [
      totalAccounts,
      activeAccounts,
      inactiveAccounts,
      platformCounts,
      nicheCounts,
      viewsAgg,
      followersAgg,
      accountsWithViews,
      accountsWithFollowers,
      clipPostAgg,
    ] = await Promise.all([
      ctx.db.socialAccount.count(),
      ctx.db.socialAccount.count({ where: { isActive: true } }),
      ctx.db.socialAccount.count({ where: { isActive: false } }),
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
      ctx.db.socialAccount.aggregate({
        _sum: { avgViews: true },
        _avg: { avgViews: true },
        _max: { avgViews: true },
        where: { avgViews: { not: null } },
      }),
      ctx.db.socialAccount.aggregate({
        _sum: { followers: true },
        _avg: { followers: true },
        _max: { followers: true },
        where: { followers: { not: null } },
      }),
      ctx.db.socialAccount.count({ where: { avgViews: { not: null, gt: 0 } } }),
      ctx.db.socialAccount.count({
        where: { followers: { not: null, gt: 0 } },
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
        `,
    ]);

    const postData = clipPostAgg[0] ?? {
      total_posts: BigInt(0),
      total_views: BigInt(0),
      clippers_with_posts: BigInt(0),
    };

    return {
      totalAccounts,
      activeAccounts,
      inactiveAccounts,
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
        total: viewsAgg._sum.avgViews ?? 0,
        average: Math.round(viewsAgg._avg.avgViews ?? 0),
        max: viewsAgg._max.avgViews ?? 0,
        accountsWithData: accountsWithViews,
      },
      followersStats: {
        total: followersAgg._sum.followers ?? 0,
        average: Math.round(followersAgg._avg.followers ?? 0),
        max: followersAgg._max.followers ?? 0,
        accountsWithData: accountsWithFollowers,
      },
      clipPostStats: {
        totalPosts: Number(postData.total_posts),
        totalViews: Number(postData.total_views),
        clippersWithPosts: Number(postData.clippers_with_posts),
      },
    };
  }),

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

        // Buscar todas as competições
        const campaigns = await ctx.db.campaign.findMany({
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
        });

        // Buscar todas as transações de crédito (prêmios, bônus, ajustes)
        const creditTransactions = await ctx.db.transaction.findMany({
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
        });

        // Buscar todas as transações de PIX (saques completados)
        const pixTransactions = await ctx.db.transaction.findMany({
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
        });

        // Buscar saques pendentes
        const pendingWithdrawals = await ctx.db.transaction.findMany({
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
        });

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

        // Buscar total de views por competição (para CPM)
        const campaignViews = await ctx.db.clipPost.groupBy({
          by: ["campaignId"],
          _sum: { views: true },
          _count: { id: true },
        });
        const viewsMap = new Map(
          campaignViews.map((v) => [
            v.campaignId,
            { views: Number(v._sum.views || 0), posts: v._count.id },
          ]),
        );

        // Agrupar por competição
        const campaignFinancials = campaigns
          .map((campaign) => {
            const campaignCredits = creditTransactions.filter(
              (tx) => tx.campaignId === campaign.id,
            );
            const campaignPix = pixTransactions.filter(
              (tx) => tx.campaignId === campaign.id,
            );
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

        // Contar competições por clipador
        clipperMap.forEach((clipper, clipperId) => {
          const campaigns = new Set(
            creditTransactions
              .filter(
                (tx) =>
                  tx.wallet.clipperProfile.id === clipperId && tx.campaignId,
              )
              .map((tx) => tx.campaignId!),
          );
          clipper.campaignCount = campaigns.size;
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
              campaigns.find((c) => c.id === tx.campaignId)?.name || "—",
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
              campaigns.find((c) => c.id === tx.campaignId)?.name || "—",
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

        // Buscar todas as transações relacionadas a esta campanha
        const transactions = await ctx.db.transaction.findMany({
          where: {
            campaignId: campaign.id,
            type: {
              in: ["PRIZE_CREDIT", "BONUS", "ADJUSTMENT"], // Incluir ajustes no financeiro
            },
            status: "COMPLETED",
          },
          include: {
            wallet: {
              include: {
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
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        // Buscar todas as transações de PIX (WITHDRAWAL_COMPLETED) desta campanha
        const pixTransactions = await ctx.db.transaction.findMany({
          where: {
            campaignId: campaign.id,
            type: "WITHDRAWAL_COMPLETED",
            status: "COMPLETED",
          },
          include: {
            wallet: {
              include: {
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
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

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
          (e) =>
            e.pixPayoutEligible,
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
        excludedApplicationIds: z.array(z.string()).max(100).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const campaign = await ctx.db.campaign.findUnique({
          where: { id: input.campaignId },
          select: {
            id: true,
            name: true,
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

        const { startDate, endDate } = getTopPostersDailyWindowBrt(input.date);
        const grouped = await ctx.db.clipPost.groupBy({
          by: ["applicationId"],
          where: {
            campaignId: input.campaignId,
            status: "ELIGIBLE",
            postedAt: { gte: startDate, lt: endDate },
            applicationId: { notIn: input.excludedApplicationIds },
          },
          _count: { applicationId: true },
          _sum: { views: true },
          orderBy: [
            { _count: { applicationId: "desc" } },
            { _sum: { views: "desc" } },
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

        const entries = await Promise.all(
          entriesBase.map(async (entry) => {
            const priorPrize = await findUnreversedTopPostersPrize(ctx.db, {
              where: {
                campaignId: input.campaignId,
                type: "PRIZE_CREDIT",
                status: "COMPLETED",
                rankingPosition: entry.position,
                clipPostId: null,
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
            });

            return {
              ...entry,
              prizeStatus: priorPrize ? "PAID" : "PENDING",
              prizeAmountPaid: priorPrize?.amount ?? 0,
            };
          }),
        );

        const [totalPostsInWindow, totalViewsInWindow] = await Promise.all([
          ctx.db.clipPost.count({
            where: {
              campaignId: input.campaignId,
              status: "ELIGIBLE",
              postedAt: { gte: startDate, lt: endDate },
            },
          }),
          ctx.db.clipPost.aggregate({
            where: {
              campaignId: input.campaignId,
              status: "ELIGIBLE",
              postedAt: { gte: startDate, lt: endDate },
            },
            _sum: { views: true },
          }),
        ]);

        return {
          date: input.date,
          campaignId: campaign.id,
          campaignName: campaign.name,
          windowStart: startDate.toISOString(),
          windowEnd: endDate.toISOString(),
          entries,
          canPayTopPosters: entries.some(
            (entry) => entry.prize > 0 && entry.prizeStatus !== "PAID",
          ),
          stats: {
            totalPostsInWindow,
            totalViewsInWindow: Number(totalViewsInWindow._sum.views || 0),
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

  payTopPostersDailyRankByDate: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dryRun: z.boolean(),
        excludedApplicationIds: z.array(z.string()).max(100).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const campaign = await ctx.db.campaign.findUnique({
          where: { id: input.campaignId },
          select: {
            id: true,
            name: true,
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
            applicationId: { notIn: input.excludedApplicationIds },
          },
          _count: { applicationId: true },
          _sum: { views: true },
          orderBy: [
            { _count: { applicationId: "desc" } },
            { _sum: { views: "desc" } },
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

        for (let index = 0; index < grouped.length; index++) {
          const row = grouped[index]!;
          const position = index + 1;
          const amount = getTopClippersPrize(prizeTable, position);
          const app = row.applicationId ? appMap.get(row.applicationId) : null;
          const clipperName = app?.clipperProfile
            ? getClipperRankingDisplayName(app.clipperProfile)
            : "Clipador";
          const fullName =
            getFirstName(app?.clipperProfile?.fullName) || "Clipador";

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

          const topPostersMeta: Prisma.InputJsonValue = {
            source: "top_posters_daily_rank",
            campaignId: input.campaignId,
            date: input.date,
            rankingPosition: position,
          };

          const priorPrize = await findUnreversedTopPostersPrize(ctx.db, {
            where: {
              campaignId: input.campaignId,
              type: "PRIZE_CREDIT",
              status: "COMPLETED",
              rankingPosition: position,
              clipPostId: null,
              OR: [
                { metadata: { equals: topPostersMeta } },
                {
                  description: { contains: `Top Postadores ${dateFormatted}` },
                },
              ],
            },
          });

          if (priorPrize) {
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

        if (input.dryRun) {
          return {
            dryRun: true as const,
            date: input.date,
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
          };

          try {
            let newTransactionId = "";
            await ctx.db.$transaction(async (tx) => {
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

      type CampaignBreakdown = {
        campaignId: string;
        campaignName: string;
        posts: number;
        views: number;
      };

      type TopClipperAccumulator = {
        clipperProfileId: string;
        clipperName: string;
        fullName: string;
        imageUrl: string | null;
        totalPosts: number;
        totalViews: number;
        campaigns: Map<string, CampaignBreakdown>;
      };

      const clippersMap = new Map<string, TopClipperAccumulator>();
      let totalPostsInWindow = 0;
      let totalViewsInWindow = 0;

      const addClipperPost = (post: {
        clipperProfileId: string;
        clipperName: string;
        fullName: string;
        imageUrl: string | null;
        campaignId: string;
        campaignName: string;
        views: number;
      }) => {
        const current = clippersMap.get(post.clipperProfileId) ?? {
          clipperProfileId: post.clipperProfileId,
          clipperName: post.clipperName,
          fullName: post.fullName,
          imageUrl: post.imageUrl,
          totalPosts: 0,
          totalViews: 0,
          campaigns: new Map<string, CampaignBreakdown>(),
        };
        const campaignBreakdown = current.campaigns.get(post.campaignId) ?? {
          campaignId: post.campaignId,
          campaignName: post.campaignName,
          posts: 0,
          views: 0,
        };

        current.totalPosts += 1;
        current.totalViews += post.views;
        campaignBreakdown.posts += 1;
        campaignBreakdown.views += post.views;
        current.campaigns.set(post.campaignId, campaignBreakdown);
        clippersMap.set(post.clipperProfileId, current);
        totalPostsInWindow += 1;
        totalViewsInWindow += post.views;
      };

      const livePosts = await ctx.db.clipPost.findMany({
        where: {
          campaignId: input.campaignId,
          status: ClipPostStatus.ELIGIBLE,
          postedAt: { gte: startDate, lt: endDate },
        },
        select: {
          campaignId: true,
          views: true,
          campaign: { select: { name: true } },
          application: {
            select: {
              clipperProfileId: true,
              clipperProfile: {
                select: {
                  fullName: true,
                  artisticName: true,
                  user: { select: { imageUrl: true } },
                },
              },
            },
          },
        },
      });

      for (const post of livePosts) {
        const profile = post.application.clipperProfile;
        addClipperPost({
          clipperProfileId: post.application.clipperProfileId,
          clipperName: getClipperRankingDisplayName(profile),
          fullName: getFirstName(profile.fullName) || "Clipador",
          imageUrl: profile.user.imageUrl,
          campaignId: post.campaignId,
          campaignName: post.campaign.name,
          views: Number(post.views || 0),
        });
      }

      const entries = Array.from(clippersMap.values())
        .sort((a, b) => {
          if (b.totalPosts !== a.totalPosts) return b.totalPosts - a.totalPosts;
          return b.totalViews - a.totalViews;
        })
        .slice(0, input.limit)
        .map((clipper, index) => ({
          position: index + 1,
          clipperProfileId: clipper.clipperProfileId,
          clipperName: clipper.clipperName,
          fullName: clipper.fullName,
          imageUrl: clipper.imageUrl,
          prize: getTopClippersPrize(prizeTable, index + 1),
          totalPosts: clipper.totalPosts,
          totalViews: clipper.totalViews,
          campaigns: Array.from(clipper.campaigns.values()).sort((a, b) => {
            if (b.posts !== a.posts) return b.posts - a.posts;
            return b.views - a.views;
          }),
        }));

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
          totalClippersWithPosts: clippersMap.size,
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
        for (const row of core.rawRows) {
          const dre = await ctx.db.dailyRankingEntry.findUnique({
            where: { id: row.dailyRankingEntryId },
            select: {
              clipPostId: true,
              dailyPrizeStatus: true,
              isDisqualified: true,
            },
          });
          if (dre) dreStatusMap.set(row.dailyRankingEntryId, dre);
        }

        const activeRows = core.rawRows.filter((row) => {
          const dre = dreStatusMap.get(row.dailyRankingEntryId);
          return dre && !dre.isDisqualified;
        });

        const topRows = activeRows.slice(0, core.topCount);

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

          const clipPost = await ctx.db.clipPost.findUnique({
            where: { id: row.clipPostId },
            select: { status: true },
          });

          if (clipPost?.status === ClipPostStatus.DISQUALIFIED) {
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
                console.error(
                  "payDailyRankByDate failure audit:",
                  auditError,
                );
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

          const priorPrize = await ctx.db.transaction.findFirst({
            where: {
              campaignId: input.campaignId,
              type: "PRIZE_CREDIT",
              status: "COMPLETED",
              rankingPosition: position,
              clipPostId: null,
              wallet: { clipperProfileId: row.clipperProfileId },
              description: { contains: "Ranking Mensal" },
            },
          });

          if (priorPrize) {
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
              skipped: "Serviço indicou PIX ignorado para este perfil; ledger local não alterado.",
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
              skipped: "Transferência criada na Asaas; aguardando confirmação via webhook.",
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
          data: { dailyPixPayoutCompleted: pixGateAfterReconcile?.isSettled ?? false },
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
              entry?.dailyPixStatus === "PROCESSING"
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
                  entry.dailyPixStatus === "PROCESSING"
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

  getDailyRanking: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const now = new Date();
        const brasiliaOffset = -3 * 60;
        const brasiliaTime = new Date(
          now.getTime() + (brasiliaOffset - now.getTimezoneOffset()) * 60000,
        );
        const rankingDateStr = brasiliaTime.toISOString().split("T")[0]!;

        const startOfDay = new Date(`${rankingDateStr}T00:00:00.000Z`);
        const endOfDay = new Date(`${rankingDateStr}T23:59:59.999Z`);

        const dailyRanking = await ctx.db.dailyRanking.findFirst({
          where: {
            campaignId: input.campaignId,
            rankingDate: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
          include: {
            campaign: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            rankingRule: {
              select: {
                dailyTopCount: true,
                dailyTotalPrize: true,
                dailyPrizeTable: true,
              },
            },
          },
        });

        if (!dailyRanking) {
          return {
            success: false,
            message: `Ranking diário não encontrado para a data ${rankingDateStr}`,
            ranking: null,
            entries: [],
            totalEntries: 0,
            date: rankingDateStr,
          };
        }

        const entries = await ctx.db.dailyRankingEntry.findMany({
          where: {
            dailyRankingId: dailyRanking.id,
          },
          orderBy: {
            position: "asc",
          },
          include: {
            clipPost: {
              select: {
                id: true,
                submittedUrl: true,
                thumbnailUrl: true,
                platform: true,
                username: true,
              },
            },
            application: {
              include: {
                clipperProfile: {
                  select: {
                    id: true,
                    artisticName: true,
                    fullName: true,
                  },
                },
              },
            },
          },
        });

        const formattedEntries = entries.map((entry) => {
          const clipperName =
            entry.application.clipperProfile.artisticName ||
            entry.application.clipperProfile.fullName;

          return {
            id: entry.id,
            clipPostId: entry.clipPostId,
            position: entry.position,
            dailyViews: Number(entry.dailyViews),
            dailyLikes: entry.dailyLikes,
            dailyComments: entry.dailyComments,
            dailyShares: entry.dailyShares,
            dailySaves: entry.dailySaves,
            postUrl: entry.postUrl || entry.clipPost.submittedUrl,
            thumbnailUrl: entry.postThumbnail || entry.clipPost.thumbnailUrl,
            platform: entry.platform || entry.clipPost.platform,
            username: entry.clipPost.username,
            clipperProfileId: entry.application.clipperProfile.id,
            clipperName,
            clipperImageUrl: entry.clipperImageUrl,
            dailyPrizeAmount: entry.dailyPrizeAmount,
            dailyPrizeStatus: entry.dailyPrizeStatus,
            postedAt: entry.postedAt?.toISOString(),
          };
        });

        return {
          success: true,
          message: "Ranking diário encontrado",
          ranking: {
            id: dailyRanking.id,
            campaignId: dailyRanking.campaignId,
            campaignName: dailyRanking.campaign.name,
            campaignSlug: dailyRanking.campaign.slug,
            rankingDate: dailyRanking.rankingDate.toISOString(),
            totalPosts: dailyRanking.totalPosts,
            totalDailyViews: Number(dailyRanking.totalDailyViews),
            totalClippers: dailyRanking.totalClippers,
            bestDailyViews: dailyRanking.bestDailyViews
              ? Number(dailyRanking.bestDailyViews)
              : null,
            averageViews: dailyRanking.averageViews,
            dailyTopCount: dailyRanking.rankingRule.dailyTopCount,
            dailyTotalPrize: dailyRanking.rankingRule.dailyTotalPrize,
            dailyPrizeTable: dailyRanking.rankingRule.dailyPrizeTable,
          },
          entries: formattedEntries,
          totalEntries: formattedEntries.length,
          date: rankingDateStr,
        };
      } catch (error: any) {
        console.error("Erro ao buscar ranking diário:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao buscar ranking diário",
        });
      }
    }),

  removeDailyRankingEntry: adminProcedure
    .input(
      z.object({
        entryId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const entryToRemove = await ctx.db.dailyRankingEntry.findUnique({
          where: { id: input.entryId },
          include: {
            dailyRanking: {
              include: {
                campaign: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            clipPost: {
              select: {
                submittedUrl: true,
              },
            },
            application: {
              include: {
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

        if (!entryToRemove) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Entrada do ranking não encontrada",
          });
        }

        const positionRemoved = entryToRemove.position;
        const dailyRankingId = entryToRemove.dailyRankingId;

        await ctx.db.dailyRankingEntry.delete({
          where: { id: input.entryId },
        });

        const entriesToUpdate = await ctx.db.dailyRankingEntry.findMany({
          where: {
            dailyRankingId: dailyRankingId,
            position: {
              gt: positionRemoved,
            },
          },
          orderBy: {
            position: "asc",
          },
        });

        for (const entry of entriesToUpdate) {
          await ctx.db.dailyRankingEntry.update({
            where: { id: entry.id },
            data: {
              position: entry.position - 1,
            },
          });
        }

        const remainingEntries = await ctx.db.dailyRankingEntry.findMany({
          where: { dailyRankingId: dailyRankingId },
        });

        const totalPosts = remainingEntries.length;
        const totalDailyViews = remainingEntries.reduce(
          (sum, e) => sum + Number(e.dailyViews),
          0,
        );
        const bestDailyViews =
          remainingEntries.length > 0
            ? Math.max(...remainingEntries.map((e) => Number(e.dailyViews)))
            : 0;
        const averageViews = totalPosts > 0 ? totalDailyViews / totalPosts : 0;
        const uniqueClippers = new Set(
          remainingEntries.map((e) => e.clipperProfileId).filter(Boolean),
        );

        await ctx.db.dailyRanking.update({
          where: { id: dailyRankingId },
          data: {
            totalPosts,
            totalDailyViews: BigInt(totalDailyViews),
            totalClippers: uniqueClippers.size,
            bestDailyViews: bestDailyViews > 0 ? BigInt(bestDailyViews) : null,
            averageViews,
          },
        });

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.userId,
            action: "DELETE",
            entityType: "DailyRankingEntry",
            entityId: input.entryId,
            campaignId: entryToRemove.dailyRanking.campaignId,
            changes: {
              action: "remove_from_daily_ranking",
              entryId: input.entryId,
              clipPostId: entryToRemove.clipPostId,
              postUrl: entryToRemove.clipPost.submittedUrl,
              clipperName:
                entryToRemove.application.clipperProfile.artisticName ||
                entryToRemove.application.clipperProfile.fullName,
              position: positionRemoved,
              dailyViews: Number(entryToRemove.dailyViews),
              entriesRepositioned: entriesToUpdate.length,
              campaignName: entryToRemove.dailyRanking.campaign.name,
            },
          },
        });

        return {
          success: true,
          message: `Vídeo removido do ranking. ${entriesToUpdate.length} vídeos foram reposicionados.`,
          removedPosition: positionRemoved,
          repositionedCount: entriesToUpdate.length,
        };
      } catch (error: any) {
        console.error("Erro ao remover vídeo do ranking:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao remover vídeo do ranking",
        });
      }
    }),

  /**
   * Desqualifica o clip (DISQUALIFIED) e remove a entrada do DailyRanking do dia,
   * com reposicionamento e atualização de totais (transação atômica).
   */
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

  generateDailyRankingText: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const now = new Date();
        const brasiliaOffset = -3 * 60;
        const brasiliaTime = new Date(
          now.getTime() + (brasiliaOffset - now.getTimezoneOffset()) * 60000,
        );
        const rankingDateStr = brasiliaTime.toISOString().split("T")[0]!;

        const campaign = await ctx.db.campaign.findUnique({
          where: { id: input.campaignId },
          include: {
            activeRankingRule: {
              select: {
                dailyTopCount: true,
                dailyTotalPrize: true,
                dailyPrizeTable: true,
              },
            },
          },
        });

        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campanha não encontrada",
          });
        }

        const startOfDay = new Date(`${rankingDateStr}T00:00:00.000Z`);
        const endOfDay = new Date(`${rankingDateStr}T23:59:59.999Z`);

        const dailyRanking = await ctx.db.dailyRanking.findFirst({
          where: {
            campaignId: input.campaignId,
            rankingDate: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        });

        if (!dailyRanking) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Ranking diário não encontrado para a data ${rankingDateStr}`,
          });
        }

        const entries = await ctx.db.dailyRankingEntry.findMany({
          where: {
            dailyRankingId: dailyRanking.id,
          },
          orderBy: {
            position: "asc",
          },
          include: {
            application: {
              include: {
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

        const prizeTable = campaign.activeRankingRule
          ?.dailyPrizeTable as Record<string, number> | null;
        const dailyTopCount = campaign.activeRankingRule?.dailyTopCount || 15;

        const getPrizeForPosition = (position: number): number => {
          if (!prizeTable) return 0;

          if (prizeTable[String(position)]) {
            return prizeTable[String(position)]!;
          }

          for (const key of Object.keys(prizeTable)) {
            if (key.includes("-")) {
              const [start, end] = key.split("-").map(Number);
              if (start && end && position >= start && position <= end) {
                return prizeTable[key]!;
              }
            }
          }

          return 0;
        };

        const getPositionEmoji = (position: number): string => {
          const emojis: Record<number, string> = {
            1: "🥇",
            2: "🥈",
            3: "🥉",
            4: "4️⃣",
            5: "5️⃣",
            6: "6️⃣",
            7: "7️⃣",
            8: "8️⃣",
            9: "9️⃣",
            10: "🔟",
            11: "1️⃣1️⃣",
            12: "1️⃣2️⃣",
            13: "1️⃣3️⃣",
            14: "1️⃣4️⃣",
            15: "1️⃣5️⃣",
          };
          return emojis[position] || `${position}️⃣`;
        };

        const formatNumber = (num: number): string => {
          return new Intl.NumberFormat("pt-BR").format(num);
        };

        const formatCurrency = (value: number): string => {
          return `R$ ${formatNumber(value)}`;
        };

        const dateObj = new Date(`${rankingDateStr}T12:00:00`);
        const formattedDate = new Intl.DateTimeFormat("pt-BR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(dateObj);

        let text = `🏆 **RANKING DIÁRIO — ${campaign.name}**\n`;
        text += `📅 **${formattedDate}**\n\n`;

        let totalPrizeDistributed = 0;
        let bestPerformance = 0;
        const entriesToShow = entries.slice(0, dailyTopCount);

        for (const entry of entriesToShow) {
          const clipperName =
            entry.application.clipperProfile.artisticName ||
            entry.application.clipperProfile.fullName;
          const prize = getPrizeForPosition(entry.position);
          totalPrizeDistributed += prize;

          const views = Number(entry.dailyViews);
          if (views > bestPerformance) {
            bestPerformance = views;
          }

          const emoji = getPositionEmoji(entry.position);

          text += `${emoji} **${clipperName} — ${formatCurrency(prize)}**\n`;
          text += `📱 ${formatNumber(views)} views • ❤️ ${formatNumber(entry.dailyLikes)} • 💬 ${formatNumber(entry.dailyComments)} • 🔄 ${formatNumber(entry.dailyShares)}`;

          if (entry.dailySaves && entry.dailySaves > 0) {
            text += ` • 💾 ${formatNumber(entry.dailySaves)}`;
          }

          text += `\n\n`;
        }

        text += `🎯 **Total de posts submetidos:** ${entries.length}\n`;
        text += `⚡ **Maior desempenho:** ${formatNumber(bestPerformance)} views\n`;
        text += `💵 **Premiação total distribuída:** ${formatCurrency(totalPrizeDistributed)}`;

        return {
          success: true,
          text,
          stats: {
            totalPosts: entries.length,
            bestPerformance,
            totalPrizeDistributed,
            entriesInRanking: entriesToShow.length,
            date: rankingDateStr,
            campaignName: campaign.name,
          },
        };
      } catch (error: any) {
        console.error("Erro ao gerar texto do ranking:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao gerar texto do ranking",
        });
      }
    }),

  // ============================================================================
  // CAPTAÇÃO / ACQUISITION - Análise de origem dos clipadores
  // ============================================================================

  acquisition: createTRPCRouter({
    // Dashboard completo de captação
    getDashboard: adminProcedure.query(async ({ ctx }) => {
      // Filtro base: apenas CLIPPER com clipperProfile (iniciou onboarding)
      const baseWhere = {
        role: "CLIPPER" as const,
        clipperProfile: { isNot: null },
      };

      // 1. Total de clipadores com perfil
      const totalClippers = await ctx.db.user.count({
        where: baseWhere,
      });

      // 2. Clipadores verificados (completaram onboarding)
      const verifiedClippers = await ctx.db.user.count({
        where: {
          ...baseWhere,
          clipperProfile: { is: { verificationStatus: "VERIFIED" } },
        },
      });

      // 3. Clipadores não verificados (iniciaram mas não completaram)
      const unverifiedClippers = totalClippers - verifiedClippers;

      // 4. Clipadores com referralSlug (vieram de algum canal)
      const clippersWithReferral = await ctx.db.user.count({
        where: { ...baseWhere, referralSlug: { not: null } },
      });

      // 5. Clipadores sem referralSlug (orgânicos)
      const organicClippers = totalClippers - clippersWithReferral;

      // 6. Buscar todos os slugs existentes de campanhas para cruzar
      const allCampaignSlugs = await ctx.db.campaign.findMany({
        select: { slug: true, name: true },
      });
      const campaignSlugMap = new Map(
        allCampaignSlugs.map((c) => [c.slug, c.name]),
      );

      // 7. Agrupamento por referralSlug (top fontes) — apenas com perfil
      const referralGroupsRaw = await ctx.db.user.groupBy({
        by: ["referralSlug"],
        where: { ...baseWhere, referralSlug: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      });

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

      // 8. Crescimento de clipadores por dia (últimos 90 dias) — apenas com perfil
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const dailyRegistrations = await ctx.db.user.findMany({
        where: {
          ...baseWhere,
          createdAt: { gte: ninetyDaysAgo },
        },
        select: {
          createdAt: true,
          referralSlug: true,
          clipperProfile: { select: { verificationStatus: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      // Agrupar por dia (com verificados/não verificados)
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

      // Get cumulative counts before 90 days (apenas com perfil)
      const [cumulativeBefore, cumulativeVerifiedBefore] = await Promise.all([
        ctx.db.user.count({
          where: {
            ...baseWhere,
            createdAt: { lt: ninetyDaysAgo },
          },
        }),
        ctx.db.user.count({
          where: {
            ...baseWhere,
            clipperProfile: { is: { verificationStatus: "VERIFIED" } },
            createdAt: { lt: ninetyDaysAgo },
          },
        }),
      ]);

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
        select: { id: true, startDate: true, endDate: true },
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
          dailyPixPayoutCompleted: true,
          entries: {
            select: {
              id: true,
              clipperProfileId: true,
              position: true,
              dailyPrizeStatus: true,
              dailyPrizeAmount: true,
              dailyPrizePaid: true,
              dailyPixStatus: true,
              isDisqualified: true,
              application: {
                select: {
                  clipperProfile: {
                    select: { pixPayoutEligible: true },
                  },
                },
              },
            },
            orderBy: { position: "asc" },
          },
        },
        orderBy: { rankingDate: "asc" },
      });
      const processingPixTransactions = await ctx.db.transaction.findMany({
        where: {
          campaignId: input.campaignId,
          status: "PROCESSING",
          metadata: { path: ["source"], equals: "daily_ranking_pix" },
        },
        select: { metadata: true },
      });
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

      const days = dailyRankings.map((dr) => {
        const activeEntries = dr.entries.filter((e) => !e.isDisqualified);
        const prizeEntries = activeEntries.filter(
          (e) => e.dailyPrizeAmount > 0,
        );
        const totalEntries = activeEntries.length;
        const paidEntries = prizeEntries.filter(
          (e) => e.dailyPrizeStatus === "PAID",
        ).length;
        const pendingEntries = prizeEntries.filter(
          (e) => e.dailyPrizeStatus !== "PAID",
        ).length;
        const totalPrizeAmount = prizeEntries.reduce(
          (sum, e) => sum + e.dailyPrizeAmount,
          0,
        );
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
          dateStr: dr.rankingDate.toISOString().split("T")[0]!,
          totalPosts: dr.totalPosts,
          totalDailyViews: Number(dr.totalDailyViews),
          totalClippers: dr.totalClippers,
          totalEntries,
          paidEntries,
          pendingEntries,
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
                  entry.dailyPixStatus === "PAID" &&
                  entry.dailyPrizePaid
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

      const posts = await ctx.db.clipPost.findMany({
        where: {
          campaignId: { in: input.campaignIds },
          ...(isAll ? {} : { postedAt: dateFilter }),
        },
        select: {
          id: true,
          views: true,
          likes: true,
          comments: true,
          shares: true,
          saves: true,
          platform: true,
          username: true,
          thumbnailUrl: true,
          submittedUrl: true,
          postedAt: true,
          campaign: { select: { name: true } },
        },
      });

      const thresholds = [10_000, 50_000, 100_000, 500_000, 1_000_000] as const;

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

        const matching = posts.filter((p) => Number(p.views) >= t);

        const withER = matching.filter((p) => {
          return (
            calculateEngagementRate(
              Number(p.views),
              p.likes,
              p.comments,
              p.shares,
              p.saves ?? 0,
            ) > 1
          );
        });

        const tierViews = withER.reduce((sum, p) => sum + Number(p.views), 0);
        const avgER = calculateEngagementRate(
          tierViews,
          withER.reduce((sum, p) => sum + p.likes, 0),
          withER.reduce((sum, p) => sum + p.comments, 0),
          withER.reduce((sum, p) => sum + p.shares, 0),
          withER.reduce((sum, p) => sum + (p.saves ?? 0), 0),
        );
        const avgViews =
          withER.length > 0
            ? withER.reduce((a, p) => a + Number(p.views), 0) / withER.length
            : 0;

        const platformBreakdown: Record<string, number> = {};
        withER.forEach((p) => {
          platformBreakdown[p.platform] =
            (platformBreakdown[p.platform] || 0) + 1;
        });

        return {
          threshold: t,
          label,
          total: matching.length,
          withER: withER.length,
          avgER,
          avgViews,
          platformBreakdown,
        };
      });

      const totalPosts = posts.length;
      const totalViews = posts.reduce((s, p) => s + Number(p.views), 0);
      const totalEngagement = posts.reduce(
        (sum, p) => sum + p.likes + p.comments + p.shares + (p.saves ?? 0),
        0,
      );
      const avgER = calculateEngagementRate(
        totalViews,
        posts.reduce((sum, p) => sum + p.likes, 0),
        posts.reduce((sum, p) => sum + p.comments, 0),
        posts.reduce((sum, p) => sum + p.shares, 0),
        posts.reduce((sum, p) => sum + (p.saves ?? 0), 0),
      );

      const platformStats: Record<string, { count: number; views: number }> =
        {};
      posts.forEach((p) => {
        if (!platformStats[p.platform])
          platformStats[p.platform] = { count: 0, views: 0 };
        platformStats[p.platform]!.count++;
        platformStats[p.platform]!.views += Number(p.views);
      });

      const topVideos = posts
        .filter((p) => {
          const v = Number(p.views);
          return (
            v >= 10_000 &&
            calculateEngagementRate(
              v,
              p.likes,
              p.comments,
              p.shares,
              p.saves ?? 0,
            ) > 1
          );
        })
        .sort((a, b) => Number(b.views) - Number(a.views))
        .slice(0, 20)
        .map((p) => ({
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
          campaignName: p.campaign.name,
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
