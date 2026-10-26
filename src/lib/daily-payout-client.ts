/**
 * Cliente HTTP para o serviço interno de payout PIX do ranking diário (Asaas).
 * Variáveis: DAILY_PAYOUT_BASE_URL, DAILY_PAYOUT_INTERNAL_KEY
 */
import { z } from "zod";

export class DailyPayoutConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DailyPayoutConfigError";
  }
}

export class DailyPayoutHttpError extends Error {
  constructor(
    public readonly path: string,
    public readonly status: number,
    /** Mensagem do backend (campo `message` do erro do Nest), quando houver. */
    public readonly detail: string | null = null,
  ) {
    super(`Serviço de payout indisponível (HTTP ${status}).`);
    this.name = "DailyPayoutHttpError";
  }
}

function errorDetailOf(text: string): string | null {
  try {
    const message = (JSON.parse(text) as { message?: unknown }).message;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join("; ");
  } catch {
    // corpo não é JSON
  }
  return null;
}

export function requireDailyPayoutConfig(): {
  baseUrl: string;
  internalKey: string;
} {
  const baseUrl = (process.env.DAILY_PAYOUT_BASE_URL ?? "").replace(/\/$/, "");
  const internalKey = process.env.DAILY_PAYOUT_INTERNAL_KEY ?? "";
  if (!baseUrl || !internalKey) {
    throw new DailyPayoutConfigError(
      "Configure DAILY_PAYOUT_BASE_URL e DAILY_PAYOUT_INTERNAL_KEY no servidor.",
    );
  }
  return { baseUrl, internalKey };
}

type JsonPostBody = Record<
  string,
  string | boolean | Array<Record<string, string | number>> | null | undefined
>;

async function postJson<T>(path: string, body: JsonPostBody): Promise<T> {
  const { baseUrl, internalKey } = requireDailyPayoutConfig();
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${internalKey}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new DailyPayoutHttpError(path, res.status, errorDetailOf(text));
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Daily payout ${path}: resposta não é JSON`);
  }
}

export async function fetchDailyPayoutPreview(
  dailyRankingId: string,
): Promise<unknown> {
  return postJson<unknown>("/daily-ranking-payout/preview", { dailyRankingId });
}

export async function fetchDailyPayoutPay(
  dailyRankingId: string,
): Promise<unknown> {
  return postJson<unknown>("/daily-ranking-payout/pay", { dailyRankingId });
}

export async function fetchTopPostersPayoutPreview(
  campaignId: string,
  date: string,
): Promise<unknown> {
  return postJson<unknown>("/daily-ranking-payout/top-posters/preview", {
    campaignId,
    date,
  });
}

export async function fetchTopPostersPayoutPay(
  campaignId: string,
  date: string,
): Promise<z.infer<typeof topPostersPayoutResultSchema>> {
  const response = await postJson<unknown>("/daily-ranking-payout/top-posters/pay", {
    campaignId,
    date,
  });
  return topPostersPayoutResultSchema.parse(response);
}

const topPostersPayoutResultSchema = z.object({
  campaignId: z.string(),
  date: z.string(),
  totalPrizeAmount: z.number(),
  lines: z.array(
    z
      .object({
        position: z.number().nullable().optional(),
        status: z.string(),
        transactionId: z.string().optional(),
        asaasTransferId: z.string().optional(),
        error: z.string().optional(),
      })
      .passthrough(),
  ),
});

const contaSimplesBankPixSchema = z.object({
  contaSimplesTransactionId: z.number(),
  transactionDate: z.string(),
  amount: z.number(),
  counterpartyName: z.string(),
  costCenter: z.string(),
  competitionCostCenter: z.boolean(),
});

const contaSimplesReconciliationSchema = z.object({
  dryRun: z.boolean(),
  window: z.object({ startDate: z.string(), endDate: z.string() }),
  statement: z
    .object({
      pixOut: z.number(),
      alreadyRegistered: z.number(),
      externallyRegistered: z.number(),
      truncated: z.boolean(),
    })
    .passthrough(),
  notDue: z.object({ payouts: z.number(), amount: z.number() }),
  totals: z.record(z.string(), z.number()),
  warnings: z.array(z.string()),
  lines: z.array(
    z.object({
      status: z.enum([
        "REGISTERED",
        "WOULD_REGISTER",
        "ALREADY_REGISTERED",
        "AMBIGUOUS",
        "UNMATCHED",
        "SKIPPED",
        "FAILED",
      ]),
      clipperProfileId: z.string(),
      clipperName: z.string(),
      campaignId: z.string(),
      campaignName: z.string(),
      amount: z.number(),
      contaSimplesTransactionId: z.number().optional(),
      transactionDate: z.string().optional(),
      counterpartyName: z.string().optional(),
      costCenter: z.string().optional(),
      candidates: z.array(contaSimplesBankPixSchema).optional(),
      reason: z.string().optional(),
      transactionId: z.string().optional(),
      proofUrl: z.string().optional(),
    }),
  ),
  unclaimedBankTransactions: z.array(contaSimplesBankPixSchema),
  alreadyRegisteredBankTransactionIds: z.array(z.number()),
});

export type ContaSimplesReconciliation = z.infer<
  typeof contaSimplesReconciliationSchema
>;

/**
 * Concilia os PIX do mensal enviados pela Conta Simples com os saldos de uma
 * competição (backend league, POST /conta-simples-payout/reconcile).
 * `dryRun` só simula; sem ele, registra cada PIX com o comprovante.
 * `approvedMatches` limita o registro aos pares PIX + clipador aprovados na simulação.
 */
export async function fetchContaSimplesPayoutReconciliation(input: {
  campaignId: string;
  startDate: string;
  dryRun: boolean;
  requestedBy: string;
  approvedMatches?: Array<{
    bankTransactionId: number;
    clipperProfileId: string;
  }>;
}): Promise<ContaSimplesReconciliation> {
  const response = await postJson<unknown>(
    "/conta-simples-payout/reconcile",
    input,
  );
  return contaSimplesReconciliationSchema.parse(response);
}

export async function fetchDailyPixReconciliation(input: {
  dailyRankingId?: string;
  campaignId?: string;
  asaasTransferId?: string;
  dryRun?: boolean;
}): Promise<unknown> {
  return postJson<unknown>("/daily-ranking-payout/reconcile-pix", input);
}
