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
  ) {
    super(`Serviço de payout indisponível (HTTP ${status}).`);
    this.name = "DailyPayoutHttpError";
  }
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

type JsonPostBody = Record<string, string | boolean | null | undefined>;

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
    throw new DailyPayoutHttpError(path, res.status);
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

export async function fetchDailyPixReconciliation(input: {
  dailyRankingId?: string;
  campaignId?: string;
  asaasTransferId?: string;
  dryRun?: boolean;
}): Promise<unknown> {
  return postJson<unknown>("/daily-ranking-payout/reconcile-pix", input);
}
