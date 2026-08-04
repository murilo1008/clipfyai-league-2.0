import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, privateProcedure } from "@/server/api/trpc";
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
  const data: unknown = text ? JSON.parse(text) : null;

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

  startConnection: privateProcedure
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

  disconnect: privateProcedure
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

  syncNow: privateProcedure
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
