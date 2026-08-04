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

async function leagueFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const baseUrl = getLeagueBaseUrl();
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
  const data: unknown = text ? JSON.parse(text) : null;

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

  startConnection: privateProcedure
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

  disconnect: privateProcedure
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

  syncNow: privateProcedure
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
