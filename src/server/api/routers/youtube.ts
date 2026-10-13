import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, privateProcedure, privateProcedureWithUser } from "@/server/api/trpc";
import { env } from "@/env";
import { assertCanUseSocialIntegrations } from "@/server/api/utils/social-integrations-access";

type LeagueErrorBody = {
  message?: string;
  error?: string;
};

/**
 * Fail-closed: com SKIP_ENV_VALIDATION o env pode chegar aqui vazio, então
 * validamos antes de montar a URL em vez de deixar o fetch quebrar.
 */
function getLeagueApiBaseUrl() {
  const rawBaseUrl = env.LEAGUE_API_URL as string | undefined;

  if (!rawBaseUrl) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Integração YouTube indisponível: LEAGUE_API_URL não está configurada",
    });
  }

  return rawBaseUrl.replace(/\/$/, "");
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
        message: `A integração YouTube não respondeu a tempo. Tente novamente em instantes.`,
        cause: error,
      });
    }
    throw error;
  }

  // A API pode responder HTML em erros de gateway; não deixamos o parse estourar.
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorBody = (data ?? {}) as LeagueErrorBody;

    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        errorBody.message ??
        errorBody.error ??
        `Erro ao comunicar com a integração YouTube (${response.status})`,
    });
  }

  if (text && data === null) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "A integração YouTube retornou uma resposta inválida",
    });
  }

  if (
    data &&
    typeof data === "object" &&
    "success" in data &&
    data.success === false
  ) {
    const errorBody = data as LeagueErrorBody;
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        errorBody.message ??
        errorBody.error ??
        "A integração YouTube informou uma falha",
    });
  }

  return data as T;
}

export const youtubeRouter = createTRPCRouter({
  getConnection: privateProcedure
    .input(z.object({ socialAccountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const account = await ctx.db.socialAccount.findFirst({
        where: {
          id: input.socialAccountId,
          clipperProfile: { userId: ctx.userId },
          platform: "YOUTUBE",
        },
        include: {
          youtubeAuth: {
            select: {
              id: true,
              socialAccountId: true,
              channelId: true,
              channelTitle: true,
              channelUrl: true,
              thumbnailUrl: true,
              status: true,
              lastSyncAt: true,
              errorMessage: true,
              createdAt: true,
              updatedAt: true,
              syncLogs: {
                orderBy: { createdAt: "desc" },
                take: 5,
              },
            },
          },
        },
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conta YouTube não encontrada",
        });
      }

      return account.youtubeAuth;
    }),

  startConnection: privateProcedureWithUser
    .input(z.object({ socialAccountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertCanUseSocialIntegrations({ userId: ctx.userId, user: ctx.user });

      const account = await ctx.db.socialAccount.findFirst({
        where: {
          id: input.socialAccountId,
          clipperProfile: { userId: ctx.userId },
          platform: "YOUTUBE",
        },
        select: { id: true },
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conta YouTube não encontrada",
        });
      }

      return leagueFetch<{
        success: boolean;
        authUrl: string;
        error?: string;
      }>("/api/v1/youtube-auth/initiate", {
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
          platform: "YOUTUBE",
        },
        include: { youtubeAuth: { select: { id: true } } },
      });

      if (!account?.youtubeAuth) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conexão YouTube não encontrada",
        });
      }

      return leagueFetch(`/api/v1/youtube-auth/${account.youtubeAuth.id}`, {
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
          platform: "YOUTUBE",
        },
        select: { id: true },
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conta YouTube não encontrada",
        });
      }

      return leagueFetch(
        `/api/v1/youtube-sync/account/${input.socialAccountId}`,
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
          platform: "YOUTUBE",
        },
        include: {
          youtubeAuth: {
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
          message: "Conta YouTube não encontrada",
        });
      }

      return account.youtubeAuth?.syncLogs ?? [];
    }),
});
