import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, privateProcedure } from "@/server/api/trpc";
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

async function leagueFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const baseUrl = getLeagueApiBaseUrl();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (env.LEAGUE_INTERNAL_API_KEY) {
    headers.set("x-internal-api-key", env.LEAGUE_INTERNAL_API_KEY);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });

  const text = await response.text();

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

  startConnection: privateProcedure
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

  disconnect: privateProcedure
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

  syncNow: privateProcedure
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
