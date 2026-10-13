import { createTRPCRouter, privateProcedure, adminProcedure } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  calculateEngagementRate,
  type RankingMetricType,
} from "@/lib/ranking-helpers";
import { getPostedAtWindowUtc } from "@/lib/daily-ranking-preview";
import {
  getClipperDailyReferenceDateYmd,
  getLiveDailyWindowByReferenceDate,
} from "@/lib/daily-ranking-shared";
import {
  getTopClippersPrize,
  parseTopClippersPrizeTable,
} from "@/lib/top-clippers-ranking";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  computeMonthlyLeaderboard,
  getMonthlyRankingCutoff,
} from "@/lib/monthly-ranking-leaderboard";
import {
  firstOpenDailyRankingDate,
  canRejoinCompetition,
  isParticipatingApplication,
  participatingApplicationStatuses,
} from "@/lib/competition-participation";
import {
  dailyRankingCacheTtlMs,
  getCachedDailyEligiblePostsCount,
  getCachedLiveDailyRanking,
  getCachedSnapshotDailyRanking,
  isCalendarDateYmd,
  isDailyRankingDateInRange,
  liveDailyPrizeTable,
  loadDailyTopClippersByPostedVideos,
  snapshotDailyPrizeTable,
  withCurrentUser,
} from "@/server/competition-daily-ranking";
import { cachedQuery } from "@/server/memory-cache";
import { loadClipperGrowth } from "@/server/clipper-growth";
import { getVisibleActiveCampaigns } from "@/server/competition-active-campaigns";
import { withdrawFromCompetition } from "@/server/competition-withdrawal";
import { reenrollWithdrawnApplication } from "@/server/competition-reenrollment";
import {
  loadCampaignReports,
  loadEligiblePlatformsByUsername,
} from "@/server/competition-reports";

const brlCurrencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
});

function formatBrlCurrency(amount: number) {
  return brlCurrencyFormatter.format(amount);
}

/** Campos de um post exibidos em "Meus Posts" / post mais viral. */
const myCompetitionPostSelect = {
  id: true,
  submittedUrl: true,
  platform: true,
  thumbnailUrl: true,
  caption: true,
  username: true, // Username da conta que postou
  postedAt: true,
  createdAt: true,
  views: true,
  likes: true,
  comments: true,
  shares: true,
  saves: true,
  hashtags: true,
  status: true, // Incluir status para renderizar loading
  ineligibilityReason: true,
} satisfies Prisma.ClipPostSelect;

type MyCompetitionPostRow = Prisma.ClipPostGetPayload<{
  select: typeof myCompetitionPostSelect;
}>;

function formatMyCompetitionPost(
  post: MyCompetitionPostRow,
  options: {
    rankingMap: Map<string, number>;
    myCurrentEarnings: number;
    myTotalPostsCount: number;
  },
) {
  const engagementRate = calculateEngagementRate(
    Number(post.views),
    post.likes,
    post.comments,
    post.shares,
    post.saves ?? 0,
  );

  // Buscar earnings deste post (simplificado)
  const earnings =
    options.myCurrentEarnings > 0 && options.myTotalPostsCount > 0
      ? options.myCurrentEarnings / options.myTotalPostsCount
      : 0;

  return {
    id: post.id,
    url: post.submittedUrl,
    platform: post.platform,
    thumbnailUrl: post.thumbnailUrl || "", // Deixar vazio para mostrar loading quando PENDING
    caption: post.caption || "",
    username: post.username || "", // Username da conta que postou
    postedAt: post.postedAt?.toISOString() ?? null,
    createdAt: post.createdAt.toISOString(),
    views: Number(post.views),
    likes: post.likes,
    comments: post.comments,
    shares: post.shares,
    saves: post.saves ?? 0,
    engagementRate,
    rankInCompetition: options.rankingMap.get(post.id) || 0,
    earnings: formatBrlCurrency(earnings),
    status: post.status, // Usar o status real do post (PENDING, ELIGIBLE, etc.)
    ineligibilityReason:
      post.ineligibilityReason ||
      (post.status === "DISQUALIFIED"
        ? "Post desqualificado. Nenhum motivo detalhado foi registrado."
        : null),
    hashtags: post.hashtags,
  };
}

/** Posição dos posts no ranking diário mais recente da campanha. */
async function loadLatestDailyRankPositions(
  db: PrismaClient,
  campaignId: string,
  postIds: string[],
) {
  const rankingMap = new Map<string, number>();
  if (postIds.length === 0) return rankingMap;

  const latestDailyRanking = await db.dailyRanking.findFirst({
    where: { campaignId },
    orderBy: { rankingDate: "desc" },
    select: { id: true },
  });
  if (!latestDailyRanking) return rankingMap;

  const entries = await db.dailyRankingEntry.findMany({
    where: {
      dailyRankingId: latestDailyRanking.id,
      clipPostId: { in: postIds },
    },
    select: { clipPostId: true, position: true },
  });
  entries.forEach((entry) => {
    rankingMap.set(entry.clipPostId, entry.position);
  });
  return rankingMap;
}

/** Participantes aprovados, posts elegíveis e views da campanha (iguais para todos). */
function getCachedCampaignTotals(db: PrismaClient, campaignId: string) {
  return cachedQuery(`campaign-totals:${campaignId}`, 60 * 1000, async () => {
    const [totalParticipants, eligiblePostsAgg] = await Promise.all([
      db.clipperApplication.count({
        where: { campaignId, status: "APPROVED" },
      }),
      db.clipPost.aggregate({
        where: { campaignId, status: "ELIGIBLE" },
        _count: { id: true },
        _sum: { views: true },
      }),
    ]);
    return {
      totalParticipants,
      totalPosts: eligiblePostsAgg._count.id,
      competitionTotalViews: Number(eligiblePostsAgg._sum.views || 0),
    };
  });
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * TTL do ranking mensal no cache:
 * - em andamento, ou concluída antes do corte (endDate + 3h30, métricas ainda
 *   entrando): 60 s;
 * - nas 48 h após o corte: 5 min (o admin ainda desqualifica/remove/paga);
 * - depois disso: 6 h (não muda mais).
 */
export function monthlyLeaderboardCacheTtlMs(
  campaign: { status: string; endDate: Date },
  now = Date.now(),
) {
  if (campaign.status !== "COMPLETED") return MINUTE_MS;
  const closedForMs = now - getMonthlyRankingCutoff(campaign.endDate).getTime();
  if (closedForMs < 0) return MINUTE_MS;
  if (closedForMs < 48 * HOUR_MS) return 5 * MINUTE_MS;
  return 6 * HOUR_MS;
}

/**
 * Ranking mensal da campanha (igual para todos os clipadores), com o TTL de
 * `monthlyLeaderboardCacheTtlMs`.
 */
function getCachedMonthlyLeaderboard(
  db: PrismaClient,
  campaign: {
    id: string;
    status: string;
    endDate: Date;
    rankingMetricType: RankingMetricType | null;
    activeRankingRule: {
      monthlyTopCount: number | null;
      monthlyPrizeTable: unknown;
    } | null;
  },
) {
  const rule = campaign.activeRankingRule;
  return cachedQuery(
    [
      "monthly-board",
      campaign.id,
      campaign.status,
      campaign.rankingMetricType ?? "-",
      rule?.monthlyTopCount ?? "-",
      campaign.endDate.getTime(),
    ].join(":"),
    monthlyLeaderboardCacheTtlMs(campaign),
    () =>
      computeMonthlyLeaderboard(db, campaign.id, {
        endDate: campaign.endDate,
        status: campaign.status,
        rankingMetricType: campaign.rankingMetricType,
        activeRankingRule: rule
          ? {
              monthlyTopCount: rule.monthlyTopCount,
              monthlyPrizeTable: rule.monthlyPrizeTable,
            }
          : null,
      }),
  );
}

/** Dia de ranking: YYYY-MM-DD que existe no calendário (2026-02-31 é BAD_REQUEST). */
const dailyRankingDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isCalendarDateYmd, "Data inexistente; use YYYY-MM-DD.");

/**
 * O admin vê o ranking de qualquer competição (aba Diário). O clipador só vê
 * o da própria inscrição e, se saiu, apenas os períodos encerrados antes.
 * Retorna null para o admin.
 */
async function requireRankingMembership(
  db: PrismaClient,
  userId: string,
  campaignId: string,
  cutoff?: Date,
) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, clipperProfile: { select: { id: true } } },
  });
  if (user?.role === "ADMIN") return null;

  const profile = user?.clipperProfile;
  const application = profile
    ? await db.clipperApplication.findUnique({
        where: {
          campaignId_clipperProfileId: {
            campaignId,
            clipperProfileId: profile.id,
          },
        },
        select: { id: true, status: true, withdrawnAt: true },
      })
    : null;
  const withdrawn = application?.status === "WITHDRAWN";
  if (
    !application ||
    (!isParticipatingApplication(application.status) && !withdrawn) ||
    (withdrawn &&
      (!application.withdrawnAt ||
        (cutoff && application.withdrawnAt < cutoff)))
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Sua inscrição não permite acessar o ranking deste período.",
    });
  }
  return application;
}

export const campaignRouter = createTRPCRouter({
  // Buscar campanhas ativas
  getActive: privateProcedure.query(async ({ ctx }) => {
    try {
      const activeCampaigns = await ctx.db.campaign.findMany({
        where: {
          status: "ACTIVE",
          isPrivate: false,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
        },
        orderBy: {
          startDate: "desc",
        },
        take: 10,
      });
      return activeCampaigns;
    } catch (error: any) {
      console.error("Erro ao buscar campanhas ativas:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Erro ao buscar campanhas ativas",
      });
    }
  }),

  // Buscar todas as campanhas para o select
  // Somente ADMIN: listagem administrativa de campanhas.
  getAll: adminProcedure.query(async ({ ctx }) => {
    try {
      const campaigns = await ctx.db.campaign.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
      return campaigns;
    } catch (error: any) {
      console.error("Erro ao buscar campanhas:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Erro ao buscar campanhas",
      });
    }
  }),

  // Relatórios completos de uma campanha
  // Somente ADMIN: relatório da campanha.
  getReports: adminProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        return await loadCampaignReports(ctx.db, input.campaignId);
      } catch (error: any) {
        console.error("Erro ao buscar relatórios:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao buscar relatórios",
        });
      }
    }),

  // Query paginada para posts elegíveis de uma campanha (infinite scroll)
  // Somente ADMIN: posts do relatório da campanha.
  getReportsPosts: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        limit: z.number().min(1).max(100).default(30),
        cursor: z.number().optional(),
        platform: z.string().optional(),
        search: z.string().optional(),
        sortBy: z.enum(["views", "likes", "comments"]).default("views"),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const { campaignId, limit, cursor, platform, search, sortBy } = input;
        const skip = cursor || 0;

        // Construir where clause apenas com posts elegíveis
        const where: any = {
          campaignId,
          status: "ELIGIBLE",
        };

        if (platform && platform !== "all") {
          where.platform = platform;
        }

        if (search) {
          where.username = {
            contains: search,
            mode: "insensitive",
          };
        }

        // Buscar posts
        const posts = await ctx.db.clipPost.findMany({
          where,
          select: {
            id: true,
            username: true,
            submittedUrl: true,
            views: true,
            likes: true,
            comments: true,
            shares: true,
            thumbnailUrl: true,
            platform: true,
            postedAt: true,
          },
          // Desempate estável: a paginação por offset não repete nem pula posts
          orderBy: [{ [sortBy]: "desc" }, { views: "desc" }, { id: "asc" }],
          skip,
          take: limit + 1, // +1 para verificar se tem próxima página
        });

        let nextCursor: number | undefined = undefined;
        if (posts.length > limit) {
          posts.pop(); // Remove o último item
          nextCursor = skip + limit;
        }

        return {
          posts: posts.map((post) => ({
            id: post.id,
            username: post.username || "",
            url: post.submittedUrl,
            platform: post.platform,
            views: Number(post.views),
            likes: post.likes,
            comments: post.comments,
            shares: post.shares,
            thumbnailUrl: post.thumbnailUrl,
            postedAt: post.postedAt?.toISOString() || new Date().toISOString(),
          })),
          nextCursor,
        };
      } catch (error: any) {
        console.error("Erro ao buscar posts paginados:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao buscar posts",
        });
      }
    }),

  // Query paginada para contas com posts elegíveis (infinite scroll)
  // Somente ADMIN: contas do relatório da campanha.
  getReportsAccounts: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        limit: z.number().min(1).max(100).default(30),
        cursor: z.number().optional(),
        platform: z.string().optional(),
        search: z.string().optional(),
        sortBy: z.enum(["views", "posts", "engagement"]).default("views"),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const { campaignId, limit, cursor, platform, search, sortBy } = input;
        const skip = cursor || 0;

        // Primeiro, buscar contas com posts elegíveis (usernames únicos)
        const where: any = {
          campaignId,
          username: { not: null },
          status: "ELIGIBLE",
        };

        if (search) {
          where.username = {
            contains: search,
            mode: "insensitive",
          };
        }

        // Buscar contas agrupadas e, numa consulta só, as plataformas de cada uma
        const [allAccountsGrouped, platformsByUsername] = await Promise.all([
          ctx.db.clipPost.groupBy({
            by: ["username"],
            where,
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
          }),
          loadEligiblePlatformsByUsername(ctx.db, campaignId),
        ]);

        let accounts = allAccountsGrouped.map((acc) => {
          const platforms = platformsByUsername.get(acc.username ?? "") ?? [];
          const totalViews = Number(acc._sum.views || 0);
          const totalLikes = acc._sum.likes || 0;
          const totalComments = acc._sum.comments || 0;
          const totalShares = acc._sum.shares || 0;
          const totalSaves = acc._sum.saves || 0;
          const avgEngagement = calculateEngagementRate(
            totalViews,
            totalLikes,
            totalComments,
            totalShares,
            totalSaves,
          );

          return {
            username: acc.username || "",
            platforms,
            totalViews,
            totalLikes,
            totalComments,
            totalShares,
            totalSaves,
            postsCount: acc._count.id,
            avgEngagement,
          };
        });

        // Filtrar por plataforma se especificado
        if (platform && platform !== "all") {
          accounts = accounts.filter((acc) =>
            acc.platforms.some((p) => p === platform),
          );
        }

        // Ordenar
        if (sortBy === "views") {
          accounts.sort((a, b) => b.totalViews - a.totalViews);
        } else if (sortBy === "posts") {
          accounts.sort((a, b) => b.postsCount - a.postsCount);
        } else if (sortBy === "engagement") {
          accounts.sort((a, b) => b.avgEngagement - a.avgEngagement);
        }

        // Paginar manualmente
        const paginatedAccounts = accounts.slice(skip, skip + limit + 1);
        let nextCursor: number | undefined = undefined;
        if (paginatedAccounts.length > limit) {
          paginatedAccounts.pop();
          nextCursor = skip + limit;
        }

        return {
          accounts: paginatedAccounts,
          nextCursor,
        };
      } catch (error: any) {
        console.error("Erro ao buscar contas paginadas:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao buscar contas",
        });
      }
    }),

  // Buscar competições ativas (cronograma do clipador)
  // Competições privadas são filtradas - só aparecem se o clipper estiver inscrito
  getScheduled: privateProcedure.query(async ({ ctx }) => {
    try {
      // Buscar perfil do clipper para verificar inscrições em competições privadas
      // Perfil buscado uma vez por requisição (compartilhado no batch)
      const clipperProfileId = await ctx.getClipperProfileId();
      const clipperProfile = clipperProfileId ? { id: clipperProfileId } : null;

      // Competições ativas (cache compartilhado) visíveis ao clipador
      const { campaigns: scheduledCampaigns, participantsByCampaign } =
        await getVisibleActiveCampaigns(ctx.db, clipperProfile?.id ?? null);

      return scheduledCampaigns.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        slug: campaign.slug,
        description: campaign.description,
        status: campaign.status,
        startDate: campaign.startDate.toISOString(),
        endDate: campaign.endDate.toISOString(),
        platforms: campaign.platforms,
        requiredHashtags: campaign.requiredHashtags,
        prize: campaign.prizeInfo
          ? typeof campaign.prizeInfo === "object" &&
            campaign.prizeInfo !== null &&
            "total" in campaign.prizeInfo
            ? typeof campaign.prizeInfo.total === "object"
              ? "R$ 0"
              : String(campaign.prizeInfo.total)
            : "R$ 0"
          : "R$ 0",
        coverImageUrl:
          campaign.coverImageUrl ||
          "https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&h=450&fit=crop",
        estimatedParticipants: participantsByCampaign.get(campaign.id) ?? 0,
        registrationOpen: true, // Sempre aberto por enquanto
        organizerName: campaign.organization.name,
        organizerLogo: campaign.organization.logoUrl,
        rankingMetricType: campaign.rankingMetricType,
        isProOnly: campaign.isProOnly,
        isPrivate: campaign.isPrivate,
      }));
    } catch (error: any) {
      console.error("Erro ao buscar competições agendadas:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Erro ao buscar competições agendadas",
      });
    }
  }),

  // Sair voluntariamente de uma competição, preservando o histórico.
  leaveCompetition: privateProcedure
    .input(z.object({ campaignId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      withdrawFromCompetition(ctx.db, ctx.userId, input.campaignId),
    ),

  // Inscrever-se em uma competição.
  enrollInCompetition: privateProcedure
    .input(
      z.object({
        campaignId: z.string(),
        socialAccountIds: z
          .array(z.string())
          .min(1, "Selecione ao menos uma conta"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Buscar perfil do clipper
        const clipperProfile = await ctx.db.clipperProfile.findUnique({
          where: { userId: ctx.userId },
        });

        if (!clipperProfile) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Perfil de clipper não encontrado. Complete o onboarding primeiro.",
          });
        }

        // Verificar se a campanha existe
        const campaign = await ctx.db.campaign.findUnique({
          where: { id: input.campaignId },
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true,
            requiresApproval: true,
            isPrivate: true,
            isProOnly: true,
          },
        });

        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Competição não encontrada",
          });
        }

        // Bloquear autoinscrição em competições privadas
        if (campaign.isPrivate) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Esta competição é privada. Apenas administradores podem inscrever participantes.",
          });
        }

        // Bloquear inscrição em competições PRO-only para não-assinantes
        if (campaign.isProOnly) {
          const user = await ctx.db.user.findUnique({
            where: { id: ctx.userId },
            select: { subscriptionStatus: true },
          });
          if (!user || user.subscriptionStatus !== "ACTIVE") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message:
                "Esta competição é exclusiva para assinantes PRO. Assine o PRO para participar.",
            });
          }
        }

        // Verificar se já existe uma aplicação
        const existingApplication = await ctx.db.clipperApplication.findUnique({
          where: {
            campaignId_clipperProfileId: {
              campaignId: input.campaignId,
              clipperProfileId: clipperProfile.id,
            },
          },
        });

        if (existingApplication && !canRejoinCompetition(existingApplication.status, campaign.status, campaign.startDate, campaign.endDate)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: existingApplication.status === "WITHDRAWN"
              ? "A reinscrição após a saída só é permitida antes do início da competição."
              : "Você já se inscreveu nesta competição",
          });
        }

        // Verificar se as contas sociais pertencem ao clipper
        const socialAccounts = await ctx.db.socialAccount.findMany({
          where: {
            id: {
              in: input.socialAccountIds,
            },
            clipperProfileId: clipperProfile.id,
          },
        });

        if (socialAccounts.length !== input.socialAccountIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Uma ou mais contas sociais não foram encontradas",
          });
        }

        if (existingApplication?.status === "WITHDRAWN") {
          const application = await reenrollWithdrawnApplication(ctx.db, {
            campaignId: input.campaignId,
            clipperProfileId: clipperProfile.id,
            actorUserId: ctx.userId,
            socialAccountIds: input.socialAccountIds,
          });
          return {
            success: true,
            application,
            message: application.status === "PENDING"
              ? "Reinscrição enviada! Aguarde aprovação."
              : "Reinscrição realizada com sucesso!",
          };
        }

        // Criar aplicação com contas sociais
        const application = await ctx.db.clipperApplication.create({
          data: {
            campaignId: input.campaignId,
            clipperProfileId: clipperProfile.id,
            status: campaign.requiresApproval ? "PENDING" : "APPROVED",
            formData: {
              enrolledAt: new Date().toISOString(),
            },
            autoScore: clipperProfile.autoScore,
            autoDecision: campaign.requiresApproval
              ? "MANUAL_REVIEW"
              : "APPROVE",
            // Criar relações com as contas sociais
            socialAccounts: {
              create: socialAccounts.map((acc) => ({
                accountId: acc.id,
              })),
            },
          },
        });

        return {
          success: true,
          application,
          message: campaign.requiresApproval
            ? "Inscrição enviada! Aguarde aprovação."
            : "Inscrição realizada com sucesso!",
        };
      } catch (error: any) {
        console.error("Erro ao inscrever em competição:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao realizar inscrição",
        });
      }
    }),

  // Buscar contas sociais usadas em uma application
  getApplicationAccounts: privateProcedure
    .input(
      z.object({
        applicationId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const application = await ctx.db.clipperApplication.findUnique({
          where: { id: input.applicationId },
          include: {
            clipperProfile: {
              select: {
                userId: true,
              },
            },
            socialAccounts: {
              include: {
                socialAccount: true,
              },
            },
          },
        });

        if (!application) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Inscrição não encontrada",
          });
        }

        // Verificar se a application pertence ao usuário
        if (application.clipperProfile.userId !== ctx.userId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Você não tem permissão para ver esta inscrição",
          });
        }

        return application.socialAccounts.map((acc) => acc.socialAccount);
      } catch (error: any) {
        console.error("Erro ao buscar contas da inscrição:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao buscar contas da inscrição",
        });
      }
    }),

  // Buscar TODAS as competições ativas (para "Minhas Competições" - tab Ativas)
  // Competições privadas são filtradas - só aparecem se o clipper estiver inscrito
  getAllActiveCompetitions: privateProcedure.query(async ({ ctx }) => {
    try {
      // Perfil buscado uma vez por requisição (compartilhado no batch)
      const clipperProfileId = await ctx.getClipperProfileId();
      const clipperProfile = clipperProfileId ? { id: clipperProfileId } : null;

      if (!clipperProfile) {
        return [];
      }

      // Competições ativas (cache compartilhado) visíveis ao clipador
      // (privadas só se estiver inscrito), da mais recente para a mais antiga
      const {
        campaigns: visibleCampaigns,
        participantsByCampaign: participantCountMap,
        eligiblePostsByCampaign: postCountMap,
      } = await getVisibleActiveCampaigns(ctx.db, clipperProfile.id);
      const activeCampaigns = [...visibleCampaigns].sort(
        (a, b) => b.startDate.getTime() - a.startDate.getTime(),
      );

      if (activeCampaigns.length === 0) return [];

      const campaignIds = activeCampaigns.map((c) => c.id);

      const [applications, prizeTransactions] = await Promise.all([
        // Todas as applications do clipper nessas campanhas
        ctx.db.clipperApplication.findMany({
          where: {
            clipperProfileId: clipperProfile.id,
            campaignId: { in: campaignIds },
          },
          select: {
            id: true,
            campaignId: true,
            status: true,
          },
        }),
        // Transações de prêmio do clipper em todas essas campanhas
        ctx.db.transaction.findMany({
          where: {
            wallet: { clipperProfileId: clipperProfile.id },
            campaignId: { in: campaignIds },
            type: { in: ["PRIZE_CREDIT", "BONUS", "ADJUSTMENT"] },
          },
          select: { campaignId: true, amount: true, status: true },
        }),
      ]);

      const applicationIds = applications.map((a) => a.id);

      // Agregados por inscrição (em vez de carregar os posts): vídeos enviados
      // (todos os status), soma/contagem dos elegíveis e o último postedAt,
      // além do melhor ranking mensal.
      const [rankings, postedCounts, eligibleTotals] =
        applicationIds.length > 0
          ? await Promise.all([
              ctx.db.monthlyRankingEntry.findMany({
                where: { applicationId: { in: applicationIds } },
                orderBy: [{ position: "asc" }, { lastUpdated: "desc" }],
                distinct: ["applicationId"],
                select: {
                  applicationId: true,
                  position: true,
                  previousPosition: true,
                },
              }),
              ctx.db.clipPost.groupBy({
                by: ["applicationId"],
                where: { applicationId: { in: applicationIds } },
                _count: { id: true },
              }),
              ctx.db.clipPost.groupBy({
                by: ["applicationId"],
                where: {
                  applicationId: { in: applicationIds },
                  status: "ELIGIBLE",
                },
                _count: { id: true, postedAt: true },
                _sum: {
                  views: true,
                  likes: true,
                  comments: true,
                  shares: true,
                  saves: true,
                },
                _max: { postedAt: true },
              }),
            ])
          : [[], [], []];

      // Maps para lookup O(1)
      const appByCampaign = new Map(applications.map((a) => [a.campaignId, a]));
      const rankingByApp = new Map(rankings.map((r) => [r.applicationId, r]));
      const postedCountByApp = new Map(
        postedCounts.map((row) => [row.applicationId, row._count.id]),
      );
      const eligibleByApp = new Map(
        eligibleTotals.map((row) => [row.applicationId, row]),
      );

      const txByCampaign = new Map<string, number>();
      for (const tx of prizeTransactions) {
        if (!tx.campaignId) continue;
        txByCampaign.set(
          tx.campaignId,
          (txByCampaign.get(tx.campaignId) ?? 0) + tx.amount,
        );
      }

      const formatCurrency = (amount: number) =>
        new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
          minimumFractionDigits: 0,
        }).format(amount);

      const competitionsWithData = activeCampaigns.map((campaign) => {
        const application = appByCampaign.get(campaign.id);
        const totalParticipants = participantCountMap.get(campaign.id) ?? 0;
        const totalPosts = postCountMap.get(campaign.id) ?? 0;
        const totalPrize =
          campaign.prizeInfo &&
          typeof campaign.prizeInfo === "object" &&
          "total" in campaign.prizeInfo
            ? typeof campaign.prizeInfo.total === "object"
              ? "R$ 0"
              : String(campaign.prizeInfo.total)
            : "R$ 0";

        if (!application) {
          return {
            id: campaign.id,
            name: campaign.name,
            slug: campaign.slug,
            status: campaign.status,
            description: campaign.description,
            startDate: campaign.startDate.toISOString(),
            endDate: campaign.endDate.toISOString(),
            platforms: campaign.platforms,
            requiredHashtags: campaign.requiredHashtags,
            prize: totalPrize,
            coverImageUrl:
              campaign.coverImageUrl ||
              "https://images.unsplash.com/photo-1551434678-e076c223a692?w=400&h=400&fit=crop",
            totalPosts,
            totalParticipants,
            rankingMetricType: campaign.rankingMetricType,
            isProOnly: campaign.isProOnly,
            isPrivate: campaign.isPrivate,
            myRanking: 0,
            myPreviousRanking: 0,
            myPosts: 0,
            postedVideoCount: 0,
            myTotalViews: 0,
            myEngagementRate: 0,
            myPotentialPrize: "R$ 0",
            actualPrize: undefined,
            applicationStatus: null,
            lastPostDate: undefined,
          };
        }

        const bestRanking = rankingByApp.get(application.id);
        const eligible = eligibleByApp.get(application.id);
        // Último post elegível por postedAt DESC (NULLS FIRST no Postgres):
        // com algum postedAt nulo, a data fica indefinida, como antes.
        const lastPostDate =
          eligible && eligible._count.postedAt === eligible._count.id
            ? eligible._max.postedAt?.toISOString()
            : undefined;
        const myPrizeAmount = txByCampaign.get(campaign.id) ?? 0;

        const myTotalViews = Number(eligible?._sum.views ?? 0);
        const myTotalLikes = eligible?._sum.likes ?? 0;
        const myTotalComments = eligible?._sum.comments ?? 0;
        const myTotalShares = eligible?._sum.shares ?? 0;
        const myTotalSaves = eligible?._sum.saves ?? 0;
        const myEngagementRate = calculateEngagementRate(
          myTotalViews,
          myTotalLikes,
          myTotalComments,
          myTotalShares,
          myTotalSaves,
        );

        return {
          id: campaign.id,
          name: campaign.name,
          slug: campaign.slug,
          status: campaign.status,
          description: campaign.description,
          startDate: campaign.startDate.toISOString(),
          endDate: campaign.endDate.toISOString(),
          platforms: campaign.platforms,
          requiredHashtags: campaign.requiredHashtags,
          prize: totalPrize,
          coverImageUrl:
            campaign.coverImageUrl ||
            "https://images.unsplash.com/photo-1551434678-e076c223a692?w=400&h=400&fit=crop",
          totalPosts,
          rankingMetricType: campaign.rankingMetricType,
          myRanking: bestRanking?.position || 0,
          myPreviousRanking: bestRanking?.previousPosition || 0,
          totalParticipants,
          myPosts: eligible?._count.id ?? 0,
          postedVideoCount: postedCountByApp.get(application.id) ?? 0,
          myTotalViews,
          myEngagementRate,
          myPotentialPrize:
            myPrizeAmount > 0 ? formatCurrency(myPrizeAmount) : "R$ 0",
          actualPrize:
            campaign.status === "COMPLETED" && myPrizeAmount > 0
              ? formatCurrency(myPrizeAmount)
              : undefined,
          applicationStatus: application.status,
          lastPostDate,
          isProOnly: campaign.isProOnly,
            isPrivate: campaign.isPrivate,
        };
      });

      return competitionsWithData;
    } catch (error: any) {
      console.error("Erro ao buscar competições ativas:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Erro ao buscar competições ativas",
      });
    }
  }),

  // Buscar competições concluídas do clipper
  getMyCompletedCompetitions: privateProcedure.query(async ({ ctx }) => {
    try {
      // Perfil buscado uma vez por requisição (compartilhado no batch)
      const clipperProfileId = await ctx.getClipperProfileId();
      const clipperProfile = clipperProfileId ? { id: clipperProfileId } : null;

      if (!clipperProfile) {
        return [];
      }

      // Buscar applications aprovadas em campanhas concluídas (excluir ARCHIVED)
      const applications = await ctx.db.clipperApplication.findMany({
        where: {
          clipperProfileId: clipperProfile.id,
          status: "APPROVED",
          campaign: {
            status: "COMPLETED",
          },
        },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              startDate: true,
              endDate: true,
              platforms: true,
              requiredHashtags: true,
              coverImageUrl: true,
              prizeInfo: true,
              isProOnly: true,
            },
          },
        },
        orderBy: {
          campaign: {
            endDate: "desc",
          },
        },
      });

      if (applications.length === 0) return [];

      const applicationIds = applications.map((a) => a.id);
      const campaignIds = [...new Set(applications.map((a) => a.campaignId))];

      // Batch: substituir N×3 queries por 4 queries paralelas
      const [rankings, participantCounts, prizeTransactions, eligibleTotals] =
        await Promise.all([
          ctx.db.monthlyRankingEntry.findMany({
            where: { applicationId: { in: applicationIds } },
            orderBy: [{ position: "asc" }, { lastUpdated: "desc" }],
            distinct: ["applicationId"],
            select: { applicationId: true, position: true },
          }),
          ctx.db.clipperApplication.groupBy({
            by: ["campaignId"],
            where: { campaignId: { in: campaignIds }, status: "APPROVED" },
            _count: { id: true },
          }),
          ctx.db.transaction.findMany({
            where: {
              wallet: { clipperProfileId: clipperProfile.id },
              campaignId: { in: campaignIds },
              type: { in: ["PRIZE_CREDIT", "BONUS", "ADJUSTMENT"] },
            },
            select: { campaignId: true, amount: true, status: true },
          }),
          // Soma dos posts elegíveis por inscrição (em vez de carregar os posts)
          ctx.db.clipPost.groupBy({
            by: ["applicationId"],
            where: {
              applicationId: { in: applicationIds },
              status: "ELIGIBLE",
            },
            _count: { id: true },
            _sum: {
              views: true,
              likes: true,
              comments: true,
              shares: true,
              saves: true,
            },
          }),
        ]);

      const rankingByApp = new Map(rankings.map((r) => [r.applicationId, r]));
      const eligibleByApp = new Map(
        eligibleTotals.map((row) => [row.applicationId, row]),
      );
      const participantCountMap = new Map(
        participantCounts.map((r) => [r.campaignId, r._count.id]),
      );

      const txByCampaign = new Map<
        string,
        { total: number; hasPaid: boolean }
      >();
      for (const tx of prizeTransactions) {
        if (!tx.campaignId) continue;
        const cur = txByCampaign.get(tx.campaignId) ?? {
          total: 0,
          hasPaid: false,
        };
        txByCampaign.set(tx.campaignId, {
          total: cur.total + tx.amount,
          hasPaid: cur.hasPaid || tx.status === "COMPLETED",
        });
      }

      const completedCompetitions = applications.map((app) => {
        const bestRanking = rankingByApp.get(app.id);
        const totalParticipants = participantCountMap.get(app.campaignId) ?? 0;
        const txData = txByCampaign.get(app.campaignId);
        const myPrizeAmount = txData?.total ?? 0;
        const prizePaid = txData?.hasPaid ?? false;

        const eligible = eligibleByApp.get(app.id);
        const myTotalViews = Number(eligible?._sum.views ?? 0);
        const myTotalLikes = eligible?._sum.likes ?? 0;
        const myTotalComments = eligible?._sum.comments ?? 0;
        const myTotalShares = eligible?._sum.shares ?? 0;
        const myTotalSaves = eligible?._sum.saves ?? 0;
        const myEngagementRate = calculateEngagementRate(
          myTotalViews,
          myTotalLikes,
          myTotalComments,
          myTotalShares,
          myTotalSaves,
        );

        const totalPrize =
          app.campaign.prizeInfo &&
          typeof app.campaign.prizeInfo === "object" &&
          "total" in app.campaign.prizeInfo
            ? typeof app.campaign.prizeInfo.total === "object"
              ? "R$ 0"
              : String(app.campaign.prizeInfo.total)
            : "R$ 0";

        return {
          id: app.campaign.id,
          name: app.campaign.name,
          slug: app.campaign.slug,
          description: app.campaign.description,
          startDate: app.campaign.startDate.toISOString(),
          endDate: app.campaign.endDate.toISOString(),
          platforms: app.campaign.platforms,
          requiredHashtags: app.campaign.requiredHashtags,
          totalPrize,
          coverImageUrl:
            app.campaign.coverImageUrl ||
            "https://images.unsplash.com/photo-1551434678-e076c223a692?w=400&h=400&fit=crop",
          myRanking: bestRanking?.position || 0,
          totalParticipants,
          myPosts: eligible?._count.id ?? 0,
          myTotalViews,
          myEngagementRate,
          myPrize:
            myPrizeAmount > 0
              ? new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  minimumFractionDigits: 0,
                }).format(myPrizeAmount)
              : "R$ 0",
          prizePaid,
          isProOnly: app.campaign.isProOnly,
        };
      });

      return completedCompetitions;
    } catch (error: any) {
      console.error("Erro ao buscar histórico de competições:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Erro ao buscar histórico de competições",
      });
    }
  }),

  // Buscar detalhes de uma competição específica (página do clipador).
  // O ranking (aba Ranking) e a lista paginada de posts têm procedures próprias:
  // getCompetitionRanking e getMyCompetitionPosts.
  getCompetitionDetails: privateProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const [clipperProfile, campaign] = await Promise.all([
          ctx.db.clipperProfile.findUnique({
            where: { userId: ctx.userId },
            select: { id: true, artisticName: true, fullName: true },
          }),
          // Buscar campanha (excluir ARCHIVED)
          ctx.db.campaign.findUnique({
            where: { slug: input.slug },
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              status: true,
              startDate: true,
              endDate: true,
              platforms: true,
              requiredHashtags: true,
              requiredMentions: true,
              prizeInfo: true,
              coverImageUrl: true,
              rankingMetricType: true, // Tipo de métrica de ranking (VIEWS ou VIEWS_X_ENGAGEMENT)
              dailyPix: true,
              activeRankingRule: true,
              isProOnly: true,
              topClippersRankingEnabled: true,
              topClippersPrizeTable: true,
              // Links de afiliado
              affiliateLinkInstagram: true,
              affiliateLinkTiktok: true,
              affiliateLinkYoutube: true,
              affiliateLinkFacebook: true,
              affiliateLinkKwai: true,
              performanceVideos: {
                where: { isActive: true },
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                select: {
                  id: true,
                  platform: true,
                  originalUrl: true,
                  title: true,
                  description: true,
                  thumbnailUrl: true,
                },
              },
            },
          }),
        ]);

        if (!clipperProfile) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Perfil de clipper não encontrado",
          });
        }

        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Competição não encontrada",
          });
        }

        // Verificar se a campanha está arquivada
        if (campaign.status === "ARCHIVED") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Esta competição não está mais disponível",
          });
        }

        // Buscar application do clipper
        const application = await ctx.db.clipperApplication.findUnique({
          where: {
            campaignId_clipperProfileId: {
              campaignId: campaign.id,
              clipperProfileId: clipperProfile.id,
            },
          },
          select: { id: true, status: true },
        });

        if (!application || !participatingApplicationStatuses.some((status) => status === application.status)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Você não está participando desta competição",
          });
        }

        const [
          campaignStats,
          monthlyBoard,
          postsByPlatform,
          myTotalMetrics,
          prizeAgg,
          topViralPostRow,
          bestEngagementRows,
          growthData,
          applicationAccountsCount,
        ] = await Promise.all([
          // Participantes, posts e views da campanha (iguais para todos)
          getCachedCampaignTotals(ctx.db, campaign.id),
          getCachedMonthlyLeaderboard(ctx.db, campaign),
          // Contagem/views dos meus posts (TODOS os status) por plataforma
          ctx.db.clipPost.groupBy({
            by: ["platform"],
            where: {
              campaignId: campaign.id,
              applicationId: application.id,
            },
            _count: { id: true },
            _sum: { views: true },
            _max: { createdAt: true },
          }),
          // Métricas TOTAIS dos meus posts ELEGÍVEIS (agregação, não limitado)
          ctx.db.clipPost.aggregate({
            where: {
              campaignId: campaign.id,
              applicationId: application.id,
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
          }),
          // Soma de transações (ganhos) — aggregate evita carregar todas as linhas
          ctx.db.transaction.aggregate({
            where: {
              wallet: {
                clipperProfileId: clipperProfile.id,
              },
              campaignId: campaign.id,
              type: {
                in: ["PRIZE_CREDIT", "BONUS", "ADJUSTMENT"],
              },
            },
            _sum: { amount: true },
          }),
          // Post mais viral: mais views; empate → mais recente (ordem da lista)
          ctx.db.clipPost.findFirst({
            where: {
              campaignId: campaign.id,
              applicationId: application.id,
            },
            select: myCompetitionPostSelect,
            orderBy: [{ views: "desc" }, { createdAt: "desc" }, { id: "desc" }],
          }),
          // Maior ER entre todos os meus posts (mesma conta de calculateEngagementRate)
          ctx.db.$queryRaw<[{ bestEngagementRate: number | null }]>`
            SELECT MAX(
              CASE
                WHEN cp."views" > 0 THEN
                  TRUNC(
                    ((cp."likes"::bigint + cp."comments" + cp."shares" + COALESCE(cp."saves", 0))::float8
                      / cp."views"::float8) * 100 * 100
                  ) / 100
                ELSE 0
              END
            )::float8 AS "bestEngagementRate"
            FROM "ClipPost" cp
            WHERE cp."campaignId" = ${campaign.id}
              AND cp."applicationId" = ${application.id}
          `,
          // Crescimento (últimos 7 dias): total dos meus posts ao fim de cada dia
          loadClipperGrowth(ctx.db, {
            campaignId: campaign.id,
            applicationId: application.id,
          }),
          // Contador da aba "Minhas Contas" (a lista carrega ao abrir a aba)
          ctx.db.applicationSocialAccount.count({
            where: { applicationId: application.id },
          }),
        ]);

        const { totalParticipants, totalPosts, competitionTotalViews } =
          campaignStats;

        const myTotalViews = Number(myTotalMetrics._sum.views || 0);
        const myTotalLikes = myTotalMetrics._sum.likes || 0;
        const myTotalComments = myTotalMetrics._sum.comments || 0;
        const myTotalShares = myTotalMetrics._sum.shares || 0;
        const myTotalSaves = myTotalMetrics._sum.saves || 0;
        const myTotalPostsCount = myTotalMetrics._count.id;
        const myEngagementRate = calculateEngagementRate(
          myTotalViews,
          myTotalLikes,
          myTotalComments,
          myTotalShares,
          myTotalSaves,
        );

        const myCurrentEarnings = prizeAgg._sum.amount ?? 0;

        // Posição real no ranking mensal (mesma fonte do ADMIN), mesmo fora do top.
        const myMonthlyPosition =
          monthlyBoard?.positionByClipperProfileId.get(clipperProfile.id) ?? 0;

        // Por plataforma, na ordem do post mais recente (ordem em que a lista
        // completa de posts as apresentava).
        const myPostsByPlatform = [...postsByPlatform]
          .sort(
            (a, b) =>
              (b._max.createdAt?.getTime() ?? 0) -
              (a._max.createdAt?.getTime() ?? 0),
          )
          .map((group) => ({
            platform: group.platform,
            posts: group._count.id,
            views: Number(group._sum.views ?? 0),
          }));
        const postedVideoCount = myPostsByPlatform.reduce(
          (sum, group) => sum + group.posts,
          0,
        );

        // Rank diário (último DailyRanking) do post mais viral
        const rankingMap = topViralPostRow
          ? await loadLatestDailyRankPositions(ctx.db, campaign.id, [
              topViralPostRow.id,
            ])
          : new Map<string, number>();
        const topViralPost = topViralPostRow
          ? formatMyCompetitionPost(topViralPostRow, {
              rankingMap,
              myCurrentEarnings,
              myTotalPostsCount,
            })
          : null;

        const referenceDateYmd = getClipperDailyReferenceDateYmd();
        const { startDate: dailyWindowStart, endDate: dailyWindowEnd } =
          getLiveDailyWindowByReferenceDate(referenceDateYmd);

        // Formatar prêmio total
        const totalPrize =
          campaign.prizeInfo &&
          typeof campaign.prizeInfo === "object" &&
          "total" in campaign.prizeInfo
            ? typeof campaign.prizeInfo.total === "object"
              ? "R$ 0"
              : String(campaign.prizeInfo.total)
            : "R$ 0";

        const result = {
          id: campaign.id,
          applicationId: application.id, // ID da aplicação para adicionar contas
          applicationStatus: application.status,
          applicationAccountsCount,
          postedVideoCount,
          name: campaign.name,
          slug: campaign.slug,
          status: campaign.status,
          description: campaign.description,
          startDate: campaign.startDate.toISOString(),
          endDate: campaign.endDate.toISOString(),
          platforms: campaign.platforms,
          requiredHashtags: campaign.requiredHashtags,
          requiredMentions: campaign.requiredMentions,
          requiredVideos: campaign.performanceVideos,
          totalPrize,
          coverImageUrl:
            campaign.coverImageUrl ||
            "https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&h=450&fit=crop",
          totalPosts,
          totalParticipants,
          competitionTotalViews,
          rankingMetricType: campaign.rankingMetricType, // Tipo de métrica (VIEWS ou VIEWS_X_ENGAGEMENT)
          dailyPix: campaign.dailyPix,
          isProOnly: campaign.isProOnly,
          topClippersRankingEnabled: campaign.topClippersRankingEnabled,
          topClippersPrizeTable: campaign.topClippersPrizeTable,

          // Links de afiliado
          affiliateLinkInstagram: campaign.affiliateLinkInstagram,
          affiliateLinkTiktok: campaign.affiliateLinkTiktok,
          affiliateLinkYoutube: campaign.affiliateLinkYoutube,
          affiliateLinkFacebook: campaign.affiliateLinkFacebook,
          affiliateLinkKwai: campaign.affiliateLinkKwai,

          // Nome artístico do clipper (para links de afiliado)
          clipperArtisticName:
            clipperProfile.artisticName || clipperProfile.fullName || "",

          // Ranking do usuário
          myCurrentRanking: myMonthlyPosition,
          myPreviousRanking: myMonthlyPosition,
          myMonthlyRanking: myMonthlyPosition,
          myTotalPosts: myTotalPostsCount, // Usando contagem agregada (não limitada)
          myTotalViews,
          myTotalLikes,
          myTotalComments,
          myTotalShares,
          myTotalSaves,
          myEngagementRate,
          myCurrentEarnings: formatBrlCurrency(myCurrentEarnings),
          myProjectedEarnings: formatBrlCurrency(myCurrentEarnings * 1.5), // Projeção simplificada

          // Resumo dos meus posts (a lista paginada vem de getMyCompetitionPosts)
          topViralPost,
          bestEngagementRate: Number(bestEngagementRows[0]?.bestEngagementRate ?? 0),
          myPostsByPlatform,

          dailyRankingMode: "TOP_POSTS",
          dailyRankingReferenceDate: referenceDateYmd,
          dailyWindowStart: dailyWindowStart.toISOString(),
          dailyWindowEnd: dailyWindowEnd.toISOString(),
          growthData,

          // Regras de ranking e premiação
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
        return result;
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

  // Rankings mensal e diário (dia de referência atual) da página do clipador.
  // Carregado só quando a aba Ranking está aberta.
  getCompetitionRanking: privateProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const [clipperProfileId, campaign] = await Promise.all([
          ctx.getClipperProfileId(),
          ctx.db.campaign.findUnique({
            where: { id: input.campaignId },
            select: {
              id: true,
              status: true,
              endDate: true,
              rankingMetricType: true,
              activeRankingRule: {
                select: {
                  dailyTopCount: true,
                  dailyPrizeTable: true,
                  monthlyTopCount: true,
                  monthlyPrizeTable: true,
                },
              },
            },
          }),
        ]);

        if (!clipperProfileId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Perfil de clipper não encontrado",
          });
        }
        const clipperProfile = { id: clipperProfileId };
        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Competição não encontrada",
          });
        }
        if (campaign.status === "ARCHIVED") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Esta competição não está mais disponível",
          });
        }

        const application = await ctx.db.clipperApplication.findUnique({
          where: {
            campaignId_clipperProfileId: {
              campaignId: campaign.id,
              clipperProfileId: clipperProfile.id,
            },
          },
          select: { status: true },
        });
        if (!application || !isParticipatingApplication(application.status)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Você não está participando desta competição",
          });
        }

        const dailyLimit = campaign.activeRankingRule?.dailyTopCount ?? 15;
        const referenceDateYmd = getClipperDailyReferenceDateYmd();
        const { startDate: dailyWindowStart, endDate: dailyWindowEnd } =
          getLiveDailyWindowByReferenceDate(referenceDateYmd);

        const [monthlyBoard, snapshot, todayPostsCount] = await Promise.all([
          getCachedMonthlyLeaderboard(ctx.db, campaign),
          getCachedSnapshotDailyRanking(ctx.db, campaign.id, referenceDateYmd),
          getCachedDailyEligiblePostsCount(
            ctx.db,
            campaign.id,
            referenceDateYmd,
          ),
        ]);

        // Prêmios pela tabela atual da campanha (fora do cache). Com snapshot
        // do dia a tabela é lida no modo estrito, como antes.
        const dailyPrizeTable =
          campaign.activeRankingRule?.dailyPrizeTable ?? null;
        const snapshotPrizes = snapshot.hasSnapshot
          ? snapshotDailyPrizeTable(dailyPrizeTable)
          : [];

        // O ranking ao vivo só é calculado quando não há snapshot do dia.
        const fromSnapshot = snapshot.hasSnapshot && snapshot.posts.length > 0;
        const topDailyPosts = fromSnapshot
          ? withCurrentUser(snapshot.posts, ctx.userId, snapshotPrizes)
          : withCurrentUser(
              await getCachedLiveDailyRanking(ctx.db, {
                campaignId: campaign.id,
                dateYmd: referenceDateYmd,
                metricType: campaign.rankingMetricType,
                topCount: dailyLimit,
                entriesDailyRankingId: snapshot.entriesDailyRankingId,
              }),
              ctx.userId,
              liveDailyPrizeTable(dailyPrizeTable),
            );

        // Mesma fonte do ADMIN para filtros, métricas históricas e desempates.
        const topRanking = (monthlyBoard?.rows ?? []).map((row) => ({
          position: row.position,
          username: `@${row.clipperUsername}`,
          imageUrl: row.clipperImageUrl,
          totalViews: row.totalViews,
          rankingScore: row.rankingScore,
          engagementRate: row.engagementRate,
          totalPosts: row.postsCount,
          isCurrentUser: row.clipperProfileId === clipperProfile.id,
          clanTag: row.clanTag,
          clanEmoji: row.clanEmoji,
          clanEmojiColor: row.clanEmojiColor,
        }));

        return {
          topRanking, // Já ordenado pela query
          topDailyPosts,
          todayPostsCount, // Total de posts submetidos hoje
          dailyRankingMode: "TOP_POSTS",
          dailyRankingReferenceDate: referenceDateYmd,
          dailyRankingSource: fromSnapshot ? "SNAPSHOT" : "LIVE",
          dailyWindowStart: dailyWindowStart.toISOString(),
          dailyWindowEnd: dailyWindowEnd.toISOString(),
        };
      } catch (error: any) {
        console.error("Erro ao buscar ranking da competição:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao buscar ranking da competição",
        });
      }
    }),

  // Meus posts na competição (TODOS os status), paginados no servidor com os
  // mesmos filtros/ordenações da aba "Meus Posts".
  getMyCompetitionPosts: privateProcedure
    .input(
      z.object({
        campaignId: z.string(),
        platform: z.string().optional(),
        search: z.string().max(200).optional(),
        status: z
          .enum(["PENDING", "ELIGIBLE", "INELIGIBLE", "DISQUALIFIED"])
          .optional(),
        // Período sobre a data exibida do post (postedAt ou createdAt − 3h)
        timelineFrom: z.date().optional(),
        timelineTo: z.date().optional(),
        sortBy: z
          .enum(["recent", "views", "engagement", "earnings"])
          .default("recent"),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(60).default(24),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Perfil buscado uma vez por requisição (compartilhado no batch)
        const clipperProfileId = await ctx.getClipperProfileId();
        const clipperProfile = clipperProfileId ? { id: clipperProfileId } : null;
        if (!clipperProfile) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Perfil de clipper não encontrado",
          });
        }

        const application = await ctx.db.clipperApplication.findUnique({
          where: {
            campaignId_clipperProfileId: {
              campaignId: input.campaignId,
              clipperProfileId: clipperProfile.id,
            },
          },
          select: { id: true, status: true, campaign: { select: { status: true } } },
        });
        // Mesma mensagem de getCompetitionDetails/getCompetitionRanking
        if (application?.campaign.status === "ARCHIVED") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Esta competição não está mais disponível",
          });
        }
        if (!application || !isParticipatingApplication(application.status)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Você não está participando desta competição",
          });
        }

        const filters: Prisma.Sql[] = [
          Prisma.sql`cp."campaignId" = ${input.campaignId}`,
          Prisma.sql`cp."applicationId" = ${application.id}`,
        ];
        if (input.platform) {
          filters.push(Prisma.sql`cp."platform"::text = ${input.platform}`);
        }
        if (input.status) {
          filters.push(Prisma.sql`cp."status"::text = ${input.status}`);
        }
        if (input.search) {
          // Igual ao filtro antigo: legenda (vazia se nula) contém o termo.
          // As duas pontas em minúsculas no Postgres: a mesma regra de
          // maiúsculas/minúsculas (acentos) para a legenda e para o termo.
          filters.push(
            Prisma.sql`strpos(lower(COALESCE(cp."caption", '')), lower(${input.search}::text)) > 0`,
          );
        }
        const timeline = Prisma.sql`COALESCE(cp."postedAt", cp."createdAt" - interval '3 hours')`;
        if (input.timelineFrom) {
          filters.push(
            Prisma.sql`${timeline} >= ${input.timelineFrom}::timestamp`,
          );
        }
        if (input.timelineTo) {
          filters.push(Prisma.sql`${timeline} < ${input.timelineTo}::timestamp`);
        }
        const where = Prisma.join(filters, " AND ");

        // Base: createdAt desc, id desc; a ordenação escolhida vem antes
        // (mesmo resultado do sort estável que era feito no cliente).
        const orderBy =
          input.sortBy === "recent"
            ? Prisma.sql`${timeline} DESC, cp."createdAt" DESC, cp."id" DESC`
            : input.sortBy === "views"
              ? Prisma.sql`cp."views" DESC, cp."createdAt" DESC, cp."id" DESC`
              : input.sortBy === "engagement"
                ? Prisma.sql`
                    CASE
                      WHEN cp."views" > 0 THEN
                        TRUNC(
                          ((cp."likes"::bigint + cp."comments" + cp."shares" + COALESCE(cp."saves", 0))::float8
                            / cp."views"::float8) * 100 * 100
                        ) / 100
                      ELSE 0
                    END DESC,
                    cp."createdAt" DESC,
                    cp."id" DESC
                  `
                : // Ganhos são iguais em todos os posts: mantém a ordem base.
                  Prisma.sql`cp."createdAt" DESC, cp."id" DESC`;

        const offset = (input.page - 1) * input.pageSize;
        const [pageRows, countRows, myTotals, prizeAgg] = await Promise.all([
          ctx.db.$queryRaw<{ id: string }[]>`
            SELECT cp."id"
            FROM "ClipPost" cp
            WHERE ${where}
            ORDER BY ${orderBy}
            LIMIT ${input.pageSize}
            OFFSET ${offset}
          `,
          ctx.db.$queryRaw<[{ total: bigint }]>`
            SELECT COUNT(*)::bigint AS "total"
            FROM "ClipPost" cp
            WHERE ${where}
          `,
          ctx.db.clipPost.count({
            where: {
              campaignId: input.campaignId,
              applicationId: application.id,
              status: "ELIGIBLE",
            },
          }),
          ctx.db.transaction.aggregate({
            where: {
              wallet: { clipperProfileId: clipperProfile.id },
              campaignId: input.campaignId,
              type: { in: ["PRIZE_CREDIT", "BONUS", "ADJUSTMENT"] },
            },
            _sum: { amount: true },
          }),
        ]);

        const ids = pageRows.map((row) => row.id);
        const [posts, rankingMap] =
          ids.length > 0
            ? await Promise.all([
                ctx.db.clipPost.findMany({
                  where: { id: { in: ids } },
                  select: myCompetitionPostSelect,
                }),
                loadLatestDailyRankPositions(ctx.db, input.campaignId, ids),
              ])
            : [[], new Map<string, number>()];
        const postById = new Map(posts.map((post) => [post.id, post]));
        const formatOptions = {
          rankingMap,
          myCurrentEarnings: prizeAgg._sum.amount ?? 0,
          myTotalPostsCount: myTotals,
        };

        return {
          posts: ids.flatMap((id) => {
            const post = postById.get(id);
            return post ? [formatMyCompetitionPost(post, formatOptions)] : [];
          }),
          total: Number(countRows[0]?.total ?? 0),
          page: input.page,
          pageSize: input.pageSize,
        };
      } catch (error: any) {
        console.error("Erro ao buscar posts da competição:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao buscar posts da competição",
        });
      }
    }),

  getDailyRankingHistory: privateProcedure
    .input(
      z.object({
        campaignId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const application = await requireRankingMembership(ctx.db, ctx.userId, input.campaignId);
      const rankings = await ctx.db.dailyRanking.findMany({
        where: {
          campaignId: input.campaignId,
          ...(application?.status === "WITHDRAWN" && application.withdrawnAt
            ? { rankingDate: { lt: firstOpenDailyRankingDate(application.withdrawnAt) } }
            : {}),
        },
        select: {
          rankingDate: true,
          calculatedAt: true,
        },
        orderBy: [{ rankingDate: "desc" }, { calculatedAt: "desc" }],
        take: 90,
      });

      const unique = new Map<string, string>();
      rankings.forEach((row) => {
        const dateStr = row.rankingDate.toISOString().split("T")[0]!;
        if (!unique.has(dateStr)) {
          unique.set(dateStr, row.calculatedAt.toISOString());
        }
      });

      return Array.from(unique.entries()).map(([date, calculatedAt]) => ({
        date,
        calculatedAt,
      }));
    }),

  getDailyRankingByDate: privateProcedure
    .input(
      z.object({
        campaignId: z.string(),
        date: dailyRankingDateSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      const membership = await requireRankingMembership(ctx.db, ctx.userId, input.campaignId, getPostedAtWindowUtc(input.date).endDate);
      // ADMIN (sem inscrição) lê direto do banco: a aba Diário do painel mostra
      // na hora desqualificações e recálculos. Clipadores usam o cache por dia.
      const readOptions = { fresh: membership === null };
      const campaign = await ctx.db.campaign.findUnique({
        where: { id: input.campaignId },
        select: {
          id: true,
          startDate: true,
          rankingMetricType: true,
          activeRankingRule: {
            select: {
              dailyTopCount: true,
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

      const { startDate, endDate } = getPostedAtWindowUtc(input.date);
      // Prêmios pela tabela atual da campanha, aplicados depois do cache.
      const dailyPrizeTable =
        campaign.activeRankingRule?.dailyPrizeTable ?? null;

      // Fora dos dias em que a campanha pode ter posts: ranking vazio, sem
      // consultar o banco nem criar chaves no cache.
      if (!isDailyRankingDateInRange(input.date, campaign.startDate)) {
        return {
          date: input.date,
          source: "LIVE" as const,
          rankingMode: "TOP_POSTS" as const,
          posts: [],
          totalPosts: 0,
          windowStart: startDate.toISOString(),
          windowEnd: endDate.toISOString(),
        };
      }

      // Dados iguais para todos (cache por campanha/dia); isCurrentUser e
      // prêmio aplicados depois.
      const fromSnapshot = await getCachedSnapshotDailyRanking(
        ctx.db,
        campaign.id,
        input.date,
        readOptions,
      );

      if (fromSnapshot.hasSnapshot) {
        return {
          date: input.date,
          source: "SNAPSHOT" as const,
          rankingMode: "TOP_POSTS" as const,
          posts: withCurrentUser(
            fromSnapshot.posts,
            ctx.userId,
            snapshotDailyPrizeTable(dailyPrizeTable),
          ),
          totalPosts: fromSnapshot.totalPosts,
          windowStart: startDate.toISOString(),
          windowEnd: endDate.toISOString(),
        };
      }

      // Sem DailyRanking no dia: ranking ao vivo pelas métricas de ClipPost.
      const [ranked, totalPosts] = await Promise.all([
        getCachedLiveDailyRanking(
          ctx.db,
          {
            campaignId: campaign.id,
            dateYmd: input.date,
            metricType: campaign.rankingMetricType,
            topCount: campaign.activeRankingRule?.dailyTopCount ?? 15,
            entriesDailyRankingId: null,
          },
          readOptions,
        ),
        getCachedDailyEligiblePostsCount(
          ctx.db,
          campaign.id,
          input.date,
          readOptions,
        ),
      ]);

      return {
        date: input.date,
        source: "LIVE" as const,
        rankingMode: "TOP_POSTS" as const,
        posts: withCurrentUser(
          ranked,
          ctx.userId,
          liveDailyPrizeTable(dailyPrizeTable),
        ),
        totalPosts,
        windowStart: startDate.toISOString(),
        windowEnd: endDate.toISOString(),
      };
    }),

  // Ranking "Top Clipadores" do dia: ordena por QUANTIDADE de vídeos postados na janela
  getDailyTopClippersByPostedVideos: privateProcedure
    .input(
      z.object({
        campaignId: z.string(),
        date: dailyRankingDateSchema,
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const campaignConfig = await ctx.db.campaign.findUnique({
        where: { id: input.campaignId },
        select: {
          startDate: true,
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

      const { startDate, endDate } = getLiveDailyWindowByReferenceDate(input.date);
      const membership = await requireRankingMembership(ctx.db, ctx.userId, input.campaignId, endDate);
      const loadBoard = () =>
        loadDailyTopClippersByPostedVideos(ctx.db, {
          campaignId: input.campaignId,
          date: input.date,
          limit: input.limit,
        });
      // Igual para todos (cache por campanha/dia); isCurrentUser e prêmio
      // depois. ADMIN lê direto do banco; fora dos dias possíveis da campanha
      // o ranking é vazio (sem banco nem cache).
      const board = !isDailyRankingDateInRange(
        input.date,
        campaignConfig.startDate,
      )
        ? {
            entries: [],
            stats: {
              totalPostsInWindow: 0,
              totalViewsInWindow: 0,
              totalClippersWithPosts: 0,
              totalCampaigns: 1,
            },
          }
        : membership === null
          ? await loadBoard()
          : await cachedQuery(
              `top-clippers-day:${input.campaignId}:${input.date}:${input.limit}`,
              dailyRankingCacheTtlMs(input.date),
              loadBoard,
            );

      const entries = board.entries.map((clipper, index) => ({
        position: index + 1,
        clipperProfileId: clipper.clipperProfileId,
        clipperName: clipper.clipperName,
        fullName: clipper.fullName,
        imageUrl: clipper.imageUrl,
        isCurrentUser: clipper.ownerUserId === ctx.userId,
        prize: getTopClippersPrize(prizeTable, index + 1),
        totalPosts: clipper.totalPosts,
        totalViews: clipper.totalViews,
        campaigns: clipper.campaigns,
      }));

      return {
        date: input.date,
        windowStart: startDate.toISOString(),
        windowEnd: endDate.toISOString(),
        prizeTable,
        entries,
        stats: board.stats,
      };
    }),

  // Buscar regras de premiação de uma campanha (público)
  getCampaignPrizes: privateProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const campaign = await ctx.db.campaign.findUnique({
          where: { id: input.campaignId },
          select: {
            id: true,
            name: true,
            slug: true,
            platforms: true,
            prizeInfo: true,
            rankingMetricType: true, // Tipo de métrica de ranking
            topClippersRankingEnabled: true,
            topClippersPrizeTable: true,
            activeRankingRule: {
              select: {
                id: true,
                label: true,
                description: true,
                // Premiação Diária
                dailyEnabled: true,
                dailyTopCount: true,
                dailyTotalPrize: true,
                dailyPrizeTable: true,
                dailyWindowStart: true,
                dailyWindowEnd: true,
                dailyTimezone: true,
                // Bônus
                bonusEnabled: true,
                bonusMilestone: true,
                bonusAmount: true,
                bonusMonthlyBudgetCap: true,
                // Premiação Mensal
                monthlyEnabled: true,
                monthlyTopCount: true,
                monthlyTotalPrize: true,
                monthlyPrizeTable: true,
                // Configurações gerais
                primaryMetric: true,
                eligiblePlatforms: true,
                notes: true,
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

        return {
          id: campaign.id,
          name: campaign.name,
          slug: campaign.slug,
          platforms: campaign.platforms,
          prizeInfo: campaign.prizeInfo,
          rankingMetricType: campaign.rankingMetricType,
          topClippersRankingEnabled: campaign.topClippersRankingEnabled,
          topClippersPrizeTable: campaign.topClippersPrizeTable,
          rankingRule: campaign.activeRankingRule,
        };
      } catch (error: any) {
        console.error("Erro ao buscar prêmios da campanha:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao buscar prêmios da campanha",
        });
      }
    }),
});
