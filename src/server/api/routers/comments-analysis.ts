import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type {
  CommentAnalysisAggregate,
  Prisma,
  UserRole,
} from "@prisma/client";

import { env } from "@/env";
import type { db as prismaClient } from "@/server/db";
import { cachedQuery } from "@/server/memory-cache";
import {
  createTRPCRouter,
  privateProcedure,
  privateProcedureWithUser,
} from "@/server/api/trpc";

/** Subconjunto do contexto do tRPC usado pelos helpers deste router. */
type AnalysisContext = {
  db: typeof prismaClient;
  userId: string;
};

type LeagueResponse = Record<string, unknown>;

/**
 * A URL da API de análise vem do env como opcional (fail-closed): sem ela,
 * responde erro claro em vez de disparar fetch para uma base inválida.
 */
function resolveLeagueBaseUrl(): string {
  const baseUrl = env.LEAGUE_API_URL?.trim();
  if (!baseUrl) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Análise de comentários indisponível: LEAGUE_API_URL não está configurada",
    });
  }
  return baseUrl.replace(/\/$/, "");
}

function extractErrorMessage(data: any, status: number): string {
  const candidates: unknown[] = [
    data?.message?.message,
    data?.message,
    data?.error,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return `Erro ao comunicar com análise de comentários (${status})`;
}

/** Prazo de cada chamada à API do League (estimativas rodam ao abrir a tela). */
const LEAGUE_FETCH_TIMEOUT_MS = 15_000;

function isAbortError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

async function leagueFetch<T = LeagueResponse>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const baseUrl = resolveLeagueBaseUrl();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const internalApiKey = env.LEAGUE_INTERNAL_API_KEY;
  if (internalApiKey) {
    headers.set("x-internal-api-key", internalApiKey);
  }

  let response: Response;
  let text: string;
  try {
    // O prazo cobre também a leitura do corpo.
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(LEAGUE_FETCH_TIMEOUT_MS),
    });
    text = await response.text();
  } catch (error) {
    if (isAbortError(error)) {
      throw new TRPCError({
        code: "TIMEOUT",
        message:
          "A análise de comentários não respondeu a tempo. Tente novamente em instantes.",
        cause: error,
      });
    }
    throw error;
  }
  const data: any = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new TRPCError({
      code:
        response.status === 404
          ? "NOT_FOUND"
          : response.status === 409
            ? "CONFLICT"
            : "BAD_REQUEST",
      message: extractErrorMessage(data, response.status),
      cause: data,
    });
  }

  return data as T;
}

// Os helpers de acesso são encadeados (assertAdmin + assertCanAccess*): o
// role é lido uma vez por chamada de procedure, não uma vez por helper.
const roleByContext = new WeakMap<AnalysisContext, Promise<UserRole | null>>();

async function getUserRole(ctx: AnalysisContext) {
  let pending = roleByContext.get(ctx);
  if (!pending) {
    pending = ctx.db.user
      .findUnique({
        where: { id: ctx.userId },
        select: { role: true },
      })
      .then((user) => user?.role ?? null);
    roleByContext.set(ctx, pending);
  }
  const role = await pending;
  if (!role) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Usuário não encontrado",
    });
  }
  return role;
}

async function assertCanAccessPost(ctx: AnalysisContext, postId: string) {
  const role = await getUserRole(ctx);
  if (role === "ADMIN") return role;

  const post = await ctx.db.clipPost.findUnique({
    where: { id: postId },
    select: { campaign: { select: { clientId: true } } },
  });
  if (!post) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Post não encontrado" });
  }
  if (role === "CLIENT" && post.campaign.clientId === ctx.userId) {
    return role;
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Sem permissão para acessar análise deste post",
  });
}

async function assertCanAccessCampaign(
  ctx: AnalysisContext,
  campaignId: string,
) {
  const role = await getUserRole(ctx);
  if (role === "ADMIN") return role;

  const campaign = await ctx.db.campaign.findUnique({
    where: { id: campaignId },
    select: { clientId: true },
  });
  if (!campaign) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Campanha não encontrada",
    });
  }
  if (role === "CLIENT" && campaign.clientId === ctx.userId) {
    return role;
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Sem permissão para acessar análise desta campanha",
  });
}

async function assertAdmin(ctx: AnalysisContext) {
  const role = await getUserRole(ctx);
  if (role !== "ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Esta operação está disponível somente para administradores",
    });
  }
}

const triggerInput = z.object({
  forceReprocess: z.boolean().optional(),
  maxComments: z.number().int().positive().optional(),
});

const sentimentFilterSchema = z
  .enum(["all", "positive", "negative", "neutral", "mixed"])
  .default("all");

type AggregateFreshness = {
  storedComments: number;
  newCommentsSinceGeneratedAt: number;
  isStale: boolean;
};

type AggregateWithFreshness = CommentAnalysisAggregate &
  Partial<AggregateFreshness>;

/** A contagem da competição é a mesma para todos que podem vê-la. */
const CAMPAIGN_COMMENT_COUNTS_TTL_MS = 5 * 60_000;

type CommentCounts = {
  storedComments: number;
  newCommentsSinceGeneratedAt: number;
};

/**
 * Comentários guardados da competição e quantos chegaram depois do agregado.
 * ClipPostComment não tem campaignId: a contagem parte dos posts da competição
 * e lê os comentários post a post pelo índice de clipPostId (o OFFSET 0 impede
 * o planner de trocar por uma varredura da tabela inteira, que tem GBs).
 */
export async function countCampaignComments(
  db: AnalysisContext["db"],
  campaignId: string,
  generatedAt: Date,
): Promise<CommentCounts> {
  const [row] = await db.$queryRaw<
    Array<{ storedComments: number; newComments: number }>
  >`
    SELECT
      COUNT(*)::int AS "storedComments",
      COUNT(*) FILTER (
        WHERE comment."createdAt" > ${generatedAt}::timestamp
      )::int AS "newComments"
    FROM "ClipPost" post
    CROSS JOIN LATERAL (
      SELECT c."createdAt"
      FROM "ClipPostComment" c
      WHERE c."clipPostId" = post.id
      OFFSET 0
    ) comment
    WHERE post."campaignId" = ${campaignId}
  `;
  return {
    storedComments: row?.storedComments ?? 0,
    newCommentsSinceGeneratedAt: row?.newComments ?? 0,
  };
}

function countCommentsForAggregate(
  ctx: AnalysisContext,
  aggregate: CommentAnalysisAggregate,
): Promise<CommentCounts> | null {
  if (aggregate.scope === "POST") {
    if (!aggregate.clipPostId) return null;
    const where: Prisma.ClipPostCommentWhereInput = {
      clipPostId: aggregate.clipPostId,
    };
    return Promise.all([
      ctx.db.clipPostComment.count({ where }),
      ctx.db.clipPostComment.count({
        where: {
          ...where,
          createdAt: { gt: aggregate.generatedAt },
        },
      }),
    ]).then(([storedComments, newCommentsSinceGeneratedAt]) => ({
      storedComments,
      newCommentsSinceGeneratedAt,
    }));
  }

  const campaignId = aggregate.campaignId;
  if (!campaignId) return null;
  // Quem chama já validou o acesso à competição; a chave inclui o agregado,
  // então um agregado novo já conta do zero.
  return cachedQuery(
    `comments-analysis:campaign-counts:${campaignId}:${aggregate.id}:${aggregate.generatedAt.getTime()}`,
    CAMPAIGN_COMMENT_COUNTS_TTL_MS,
    () => countCampaignComments(ctx.db, campaignId, aggregate.generatedAt),
  );
}

async function withAggregateFreshness(
  ctx: AnalysisContext,
  aggregate: CommentAnalysisAggregate | null,
): Promise<AggregateWithFreshness | null> {
  if (!aggregate) return null;

  // O agregado guarda apenas um dos dois ids conforme o escopo; sem ele não há
  // como contar comentários novos, então devolve o agregado sem frescor.
  const counts = countCommentsForAggregate(ctx, aggregate);

  if (!counts) {
    return {
      ...aggregate,
      storedComments: 0,
      newCommentsSinceGeneratedAt: 0,
      isStale: false,
    };
  }

  const { storedComments, newCommentsSinceGeneratedAt } = await counts;

  return {
    ...aggregate,
    storedComments,
    newCommentsSinceGeneratedAt,
    isStale: newCommentsSinceGeneratedAt > 0,
  };
}

function toAnalysisResult(
  aggregate: AggregateWithFreshness | null,
  includeAdminMetadata = false,
) {
  if (!aggregate) return null;

  return {
    analyzedComments: aggregate.analyzedComments,
    sentimentCounts: aggregate.sentimentCounts,
    topPositivePoints: aggregate.topPositivePoints,
    topCriticisms: aggregate.topCriticisms,
    topSuggestions: aggregate.topSuggestions,
    summary: aggregate.summary,
    publicPerception: aggregate.publicPerception,
    generatedAt: aggregate.generatedAt,
    newCommentsSinceGeneratedAt: aggregate.newCommentsSinceGeneratedAt ?? 0,
    isStale: aggregate.isStale ?? false,
    ...(includeAdminMetadata
      ? {
          storedComments: aggregate.storedComments,
        }
      : {}),
  };
}

type RepresentativeIds = {
  positive?: string[];
  negative?: string[];
  neutral?: string[];
  mixed?: string[];
};

export const commentsAnalysisRouter = createTRPCRouter({
  estimatePost: privateProcedure
    .input(z.object({ postId: z.string() }).merge(triggerInput))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      await assertCanAccessPost(ctx, input.postId);
      return leagueFetch(
        `/api/v1/comments-analysis/posts/${input.postId}/estimate`,
        {
          method: "POST",
          body: JSON.stringify({
            forceReprocess: input.forceReprocess,
            maxComments: input.maxComments,
          }),
        },
      );
    }),

  triggerPost: privateProcedureWithUser
    .input(z.object({ postId: z.string() }).merge(triggerInput))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      await assertCanAccessPost(ctx, input.postId);
      return leagueFetch(
        `/api/v1/comments-analysis/posts/${input.postId}/trigger`,
        {
          method: "POST",
          body: JSON.stringify({
            requestedByUserId: ctx.userId,
            requestedByUserEmail: ctx.user?.primaryEmailAddress?.emailAddress,
            forceReprocess: input.forceReprocess,
            maxComments: input.maxComments,
          }),
        },
      );
    }),

  estimateCampaign: privateProcedure
    .input(z.object({ campaignId: z.string() }).merge(triggerInput))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      await assertCanAccessCampaign(ctx, input.campaignId);
      return leagueFetch(
        `/api/v1/comments-analysis/campaigns/${input.campaignId}/estimate`,
        {
          method: "POST",
          body: JSON.stringify({
            forceReprocess: input.forceReprocess,
            maxComments: input.maxComments,
          }),
        },
      );
    }),

  triggerCampaign: privateProcedureWithUser
    .input(z.object({ campaignId: z.string() }).merge(triggerInput))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      await assertCanAccessCampaign(ctx, input.campaignId);
      return leagueFetch(
        `/api/v1/comments-analysis/campaigns/${input.campaignId}/trigger`,
        {
          method: "POST",
          body: JSON.stringify({
            requestedByUserId: ctx.userId,
            requestedByUserEmail: ctx.user?.primaryEmailAddress?.emailAddress,
            forceReprocess: input.forceReprocess,
            maxComments: input.maxComments,
          }),
        },
      );
    }),

  getJob: privateProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const job = await leagueFetch<
        LeagueResponse & {
          clipPostId?: string | null;
          campaignId?: string | null;
        }
      >(`/api/v1/comments-analysis/jobs/${input.jobId}`);

      if (typeof job.clipPostId === "string" && job.clipPostId.length > 0) {
        await assertCanAccessPost(ctx, job.clipPostId);
      } else if (
        typeof job.campaignId === "string" &&
        job.campaignId.length > 0
      ) {
        await assertCanAccessCampaign(ctx, job.campaignId);
      } else {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Não foi possível validar o acesso a este processamento",
        });
      }
      return job;
    }),

  getPostAggregate: privateProcedure
    .input(z.object({ postId: z.string() }))
    .query(async ({ ctx, input }) => {
      const role = await assertCanAccessPost(ctx, input.postId);
      const aggregate = await ctx.db.commentAnalysisAggregate.findFirst({
        where: { scope: "POST", clipPostId: input.postId },
        orderBy: { generatedAt: "desc" },
      });
      return toAnalysisResult(
        await withAggregateFreshness(ctx, aggregate),
        role === "ADMIN",
      );
    }),

  getCampaignAggregate: privateProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ ctx, input }) => {
      const role = await assertCanAccessCampaign(ctx, input.campaignId);
      const aggregate = await ctx.db.commentAnalysisAggregate.findFirst({
        where: { scope: "CAMPAIGN", campaignId: input.campaignId },
        orderBy: { generatedAt: "desc" },
      });
      return toAnalysisResult(
        await withAggregateFreshness(ctx, aggregate),
        role === "ADMIN",
      );
    }),

  getRepresentativeComments: privateProcedure
    .input(
      z.object({
        postId: z.string().optional(),
        campaignId: z.string().optional(),
        sentiment: sentimentFilterSchema,
        limit: z.number().int().min(1).max(60).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { postId, campaignId } = input;
      if (!postId && !campaignId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Informe postId ou campaignId",
        });
      }
      if (postId) await assertCanAccessPost(ctx, postId);
      if (campaignId) await assertCanAccessCampaign(ctx, campaignId);

      const aggregate = await ctx.db.commentAnalysisAggregate.findFirst({
        where: postId
          ? { scope: "POST", clipPostId: postId }
          : { scope: "CAMPAIGN", campaignId },
        orderBy: { generatedAt: "desc" },
      });
      if (!aggregate) return { aggregate: null, comments: [] };
      const analysisResult = toAnalysisResult(aggregate);

      if (input.sentiment !== "all") {
        const results = await ctx.db.commentAnalysisResult.findMany({
          where: {
            promptVersion: aggregate.promptVersion,
            model: aggregate.model,
            sentiment: input.sentiment,
            ...(postId ? { clipPostId: postId } : { campaignId }),
          },
          orderBy: [{ representativeScore: "desc" }, { analyzedAt: "desc" }],
          take: input.limit,
          select: {
            sentiment: true,
            comment: {
              select: {
                id: true,
                platform: true,
                text: true,
                username: true,
                displayName: true,
                likes: true,
              },
            },
          },
        });

        return {
          aggregate: analysisResult,
          comments: results.map((result) => ({
            ...result.comment,
            analyses: [{ sentiment: result.sentiment }],
          })),
        };
      }

      const representative =
        aggregate.representative as RepresentativeIds | null;
      const ids = [
        ...(representative?.positive ?? []),
        ...(representative?.negative ?? []),
        ...(representative?.neutral ?? []),
        ...(representative?.mixed ?? []),
      ].slice(0, input.limit);

      const comments =
        ids.length > 0
          ? await ctx.db.clipPostComment.findMany({
              where: { id: { in: ids } },
              select: {
                id: true,
                platform: true,
                text: true,
                username: true,
                displayName: true,
                likes: true,
                analyses: {
                  where: {
                    promptVersion: aggregate.promptVersion,
                    model: aggregate.model,
                  },
                  orderBy: { analyzedAt: "desc" },
                  take: 1,
                  select: {
                    sentiment: true,
                  },
                },
              },
            })
          : [];

      return { aggregate: analysisResult, comments };
    }),
});
