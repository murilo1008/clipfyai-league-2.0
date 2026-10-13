import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, privateProcedure, privateProcedureWithUser } from "@/server/api/trpc";
import { env } from "@/env";
import { assertCanUseSocialIntegrations } from "@/server/api/utils/social-integrations-access";

function getLeagueApiBaseUrl(): string {
  // `env.LEAGUE_API_URL` tem default de localhost, então checamos a env crua:
  // sem a variável configurada a integração é considerada indisponível (fail-closed).
  if (!process.env.LEAGUE_API_URL?.trim()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Integração TikTok indisponível: LEAGUE_API_URL não está configurada",
    });
  }

  return env.LEAGUE_API_URL.replace(/\/$/, "");
}

/** Prazo padrão das chamadas à API de integração do League. */
const LEAGUE_FETCH_TIMEOUT_MS = 15_000;
/** A sincronização manual roda na hora no League e pode demorar mais. */
const LEAGUE_SYNC_TIMEOUT_MS = 60_000;

async function leagueFetch<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = LEAGUE_FETCH_TIMEOUT_MS,
): Promise<T> {
  const baseUrl = getLeagueApiBaseUrl();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (env.LEAGUE_INTERNAL_API_KEY) {
    headers.set("x-internal-api-key", env.LEAGUE_INTERNAL_API_KEY);
  }

  let response: Response;
  let text: string;
  try {
    // O prazo cobre também a leitura do corpo.
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(timeoutMs),
    });
    text = await response.text();
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw new TRPCError({
        code: "TIMEOUT",
        message: `A integração TikTok não respondeu a tempo. Tente novamente em instantes.`,
        cause: error,
      });
    }
    throw error;
  }
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const payload = (data ?? {}) as { message?: string; error?: string };

    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        payload.message ??
        payload.error ??
        `Erro ao comunicar com a integração TikTok (${response.status})`,
    });
  }

  if (text && data === null) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "A integração TikTok retornou uma resposta inválida",
    });
  }

  if (
    data &&
    typeof data === "object" &&
    "success" in data &&
    data.success === false
  ) {
    const payload = data as { message?: string; error?: string };
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        payload.message ??
        payload.error ??
        "A integração TikTok informou uma falha",
    });
  }

  return data as T;
}

export const tiktokRouter = createTRPCRouter({
  getConnection: privateProcedure
    .input(z.object({ socialAccountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const account = await ctx.db.socialAccount.findFirst({
        where: {
          id: input.socialAccountId,
          clipperProfile: { userId: ctx.userId },
          platform: "TIKTOK",
        },
        include: {
          tiktokAuth: {
            select: {
              id: true,
              socialAccountId: true,
              openId: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              status: true,
              scope: true,
              expiresAt: true,
              refreshExpiresAt: true,
              lastSyncAt: true,
              errorMessage: true,
              createdAt: true,
              updatedAt: true,
              syncLogs: {
                orderBy: { createdAt: "desc" },
                take: 5,
                select: {
                  id: true,
                  status: true,
                  videosProcessed: true,
                  videosUpdated: true,
                  videosFailed: true,
                  errorMessage: true,
                  startedAt: true,
                  completedAt: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conta TikTok não encontrada",
        });
      }

      return account.tiktokAuth;
    }),

  startConnection: privateProcedureWithUser
    .input(z.object({ socialAccountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertCanUseSocialIntegrations({ userId: ctx.userId, user: ctx.user });

      const account = await ctx.db.socialAccount.findFirst({
        where: {
          id: input.socialAccountId,
          clipperProfile: { userId: ctx.userId },
          platform: "TIKTOK",
        },
        select: { id: true },
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conta TikTok não encontrada",
        });
      }

      return leagueFetch<{
        success: boolean;
        authUrl: string;
        error?: string;
      }>("/api/v1/tiktok-auth/initiate", {
        method: "POST",
        body: JSON.stringify({ socialAccountId: input.socialAccountId }),
      });
    }),

  disconnect: privateProcedureWithUser
    .input(z.object({ socialAccountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertCanUseSocialIntegrations({ userId: ctx.userId, user: ctx.user });

      const account = await ctx.db.socialAccount.findFirst({
        where: {
          id: input.socialAccountId,
          clipperProfile: { userId: ctx.userId },
          platform: "TIKTOK",
        },
        include: { tiktokAuth: { select: { id: true } } },
      });

      if (!account?.tiktokAuth) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conexão TikTok não encontrada",
        });
      }

      return leagueFetch(`/api/v1/tiktok-auth/${account.tiktokAuth.id}`, {
        method: "DELETE",
      });
    }),

  syncNow: privateProcedureWithUser
    .input(z.object({ socialAccountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertCanUseSocialIntegrations({ userId: ctx.userId, user: ctx.user });

      const account = await ctx.db.socialAccount.findFirst({
        where: {
          id: input.socialAccountId,
          clipperProfile: { userId: ctx.userId },
          platform: "TIKTOK",
        },
        select: { id: true },
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conta TikTok não encontrada",
        });
      }

      return leagueFetch(
        `/api/v1/tiktok-sync/account/${input.socialAccountId}`,
        {
          method: "POST",
        },
        LEAGUE_SYNC_TIMEOUT_MS,
      );
    }),

  getSyncLogs: privateProcedure
    .input(z.object({ socialAccountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const account = await ctx.db.socialAccount.findFirst({
        where: {
          id: input.socialAccountId,
          clipperProfile: { userId: ctx.userId },
          platform: "TIKTOK",
        },
        include: {
          tiktokAuth: {
            select: {
              syncLogs: {
                orderBy: { createdAt: "desc" },
                take: 20,
              },
            },
          },
        },
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conta TikTok não encontrada",
        });
      }

      return account.tiktokAuth?.syncLogs ?? [];
    }),
});
