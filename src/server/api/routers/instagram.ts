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
 * Fail-closed: sem LEAGUE_API_URL configurada não há para onde chamar a API de
 * integração, então devolvemos erro claro em vez de montar uma URL inválida.
 */
function getLeagueBaseUrl(): string {
  const baseUrl: string | undefined = env.LEAGUE_API_URL;

  if (!baseUrl) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Integração Instagram indisponível: LEAGUE_API_URL não está configurada",
    });
  }

  return baseUrl.replace(/\/$/, "");
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
  const baseUrl = getLeagueBaseUrl();
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
        message: `A integração Instagram não respondeu a tempo. Tente novamente em instantes.`,
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
    const errorBody = (data ?? {}) as LeagueErrorBody;

    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        errorBody.message ??
        errorBody.error ??
        `Erro ao comunicar com a integração Instagram (${response.status})`,
    });
  }

  if (text && data === null) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "A integração Instagram retornou uma resposta inválida",
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
        "A integração Instagram informou uma falha",
    });
  }

  return data as T;
}

const SYNC_LOG_SELECT = {
  id: true,
  status: true,
  videosProcessed: true,
  videosUpdated: true,
  videosFailed: true,
  commentsFetched: true,
  commentsNew: true,
  errorMessage: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
} as const;

export const instagramRouter = createTRPCRouter({
  getConnection: privateProcedure
    .input(z.object({ socialAccountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const account = await ctx.db.socialAccount.findFirst({
        where: {
          id: input.socialAccountId,
          clipperProfile: { userId: ctx.userId },
          platform: "INSTAGRAM",
        },
        include: {
          instagramAuth: {
            select: {
              id: true,
              socialAccountId: true,
              igUserId: true,
              username: true,
              accountType: true,
              profilePictureUrl: true,
              followersCount: true,
              mediaCount: true,
              isActive: true,
              status: true,
              scope: true,
              expiresAt: true,
              lastSyncAt: true,
              lastError: true,
              createdAt: true,
              updatedAt: true,
              syncLogs: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: SYNC_LOG_SELECT,
              },
            },
          },
        },
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conta Instagram não encontrada",
        });
      }

      return account.instagramAuth;
    }),

  startConnection: privateProcedureWithUser
    .input(z.object({ socialAccountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertCanUseSocialIntegrations({ userId: ctx.userId, user: ctx.user });

      const account = await ctx.db.socialAccount.findFirst({
        where: {
          id: input.socialAccountId,
          clipperProfile: { userId: ctx.userId },
          platform: "INSTAGRAM",
        },
        select: { id: true },
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conta Instagram não encontrada",
        });
      }

      return leagueFetch<{
        success: boolean;
        authUrl: string;
        error?: string;
      }>("/api/v1/instagram-auth/initiate", {
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
          platform: "INSTAGRAM",
        },
        include: { instagramAuth: { select: { id: true } } },
      });

      if (!account?.instagramAuth) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conexão Instagram não encontrada",
        });
      }

      return leagueFetch<{ success: boolean; error?: string }>(
        `/api/v1/instagram-auth/revoke/${input.socialAccountId}`,
        { method: "DELETE" },
      );
    }),

  syncNow: privateProcedureWithUser
    .input(z.object({ socialAccountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertCanUseSocialIntegrations({ userId: ctx.userId, user: ctx.user });

      const account = await ctx.db.socialAccount.findFirst({
        where: {
          id: input.socialAccountId,
          clipperProfile: { userId: ctx.userId },
          platform: "INSTAGRAM",
        },
        select: { id: true },
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conta Instagram não encontrada",
        });
      }

      return leagueFetch<{ success: boolean; error?: string }>(
        `/api/v1/instagram-sync/full/${input.socialAccountId}`,
        { method: "POST" },
        LEAGUE_SYNC_TIMEOUT_MS,
      );
    }),

  getSyncLogs: privateProcedure
    .input(
      z.object({
        socialAccountId: z.string(),
        limit: z.number().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const account = await ctx.db.socialAccount.findFirst({
        where: {
          id: input.socialAccountId,
          clipperProfile: { userId: ctx.userId },
          platform: "INSTAGRAM",
        },
        include: {
          instagramAuth: {
            select: {
              syncLogs: {
                orderBy: { createdAt: "desc" },
                take: input.limit,
                select: SYNC_LOG_SELECT,
              },
            },
          },
        },
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conta Instagram não encontrada",
        });
      }

      return account.instagramAuth?.syncLogs ?? [];
    }),
});
