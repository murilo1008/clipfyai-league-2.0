import { createTRPCRouter, privateProcedure, adminProcedure } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  calculateEngagementRate,
  calculateRankingScore,
  type RankingMetricType,
} from "@/lib/ranking-helpers";
import {
  getPostedAtWindowUtc,
  getPrizeForPosition,
  loadDailyRankingDateContext,
  parsePrizeTable,
} from "@/lib/daily-ranking-preview";
import {
  getClipperDailyReferenceDateYmd,
  getLiveDailyWindowByReferenceDate,
  loadDailyRankingEntryMetricsMap,
  pickMetricsForDailyRank,
  rankLiveDailyPosts,
  type DailyClipperRankingItem,
} from "@/lib/daily-ranking-shared";
import {
  getTopClippersPrize,
  parseTopClippersPrizeTable,
} from "@/lib/top-clippers-ranking";
import { ClipPostStatus } from "@prisma/client";

function getFirstName(name?: string | null) {
  return name?.trim().split(/\s+/)[0] || "";
}

// Nome exibido no ranking: nome artístico, senão só o primeiro nome (evita expor nome completo)
function getClipperRankingDisplayName(profile: {
  artisticName?: string | null;
  fullName?: string | null;
}) {
  return (
    profile.artisticName?.trim() || getFirstName(profile.fullName) || "Clipador"
  );
}

async function buildSnapshotDailyRankingForClipper(params: {
  db: any;
  campaignId: string;
  dateYmd: string;
  userId: string;
}): Promise<{
  posts: DailyClipperRankingItem[];
  totalPosts: number;
  hasSnapshot: boolean;
}> {
  const core = await loadDailyRankingDateContext(
    params.db,
    params.campaignId,
    params.dateYmd,
  );
  if (!core) {
    return { posts: [], totalPosts: 0, hasSnapshot: false };
  }

  const prizeTable = parsePrizeTable(core.dailyPrizeTable);
  const entryIds = core.rawRows.map((row) => row.dailyRankingEntryId);
  const dreRows = await params.db.dailyRankingEntry.findMany({
    where: { id: { in: entryIds } },
    select: { id: true, isDisqualified: true },
  });
  const disqualifiedMap = new Map(
    dreRows.map((row: { id: string; isDisqualified: boolean }) => [
      row.id,
      row.isDisqualified,
    ]),
  );

  const appIds = Array.from(
    new Set(core.rawRows.map((row) => row.applicationId)),
  );
  const appRows = await params.db.clipperApplication.findMany({
    where: { id: { in: appIds } },
    select: {
      id: true,
      clipperProfile: {
        select: {
          userId: true,
          user: { select: { imageUrl: true } },
          clan: { select: { tag: true, emoji: true, emojiColor: true } },
        },
      },
    },
  });
  const appMap = new Map<string, any>(appRows.map((row: any) => [row.id, row]));

  let effectiveRank = 0;
  const posts = core.rawRows
    .filter((row) => !disqualifiedMap.get(row.dailyRankingEntryId))
    .map((row) => {
      effectiveRank += 1;
      const profile = appMap.get(row.applicationId)?.clipperProfile;
      return {
        position: effectiveRank,
        postId: row.clipPostId,
        clipperName: getClipperRankingDisplayName({
          artisticName: row.artisticName,
          fullName: row.fullName,
        }),
        clipperImageUrl: profile?.user?.imageUrl ?? null,
        username: row.username || "",
        platform: row.platform,
        thumbnailUrl: row.thumbnailUrl || "",
        views: Number(row.views),
        likes: row.likes,
        comments: row.comments,
        shares: row.shares,
        saves: row.saves ?? 0,
        postedAt: row.postedAt?.toISOString() ?? new Date().toISOString(),
        isCurrentUser: profile?.userId === params.userId,
        engagementRate: Number(row.er),
        rankingScore: Number(row.score),
        prize: getPrizeForPosition(prizeTable, effectiveRank),
        clanTag: profile?.clan?.tag ?? null,
        clanEmoji: profile?.clan?.emoji ?? null,
        clanEmojiColor: profile?.clan?.emojiColor ?? null,
      } satisfies DailyClipperRankingItem;
    })
    .slice(0, core.topCount);

  return {
    posts,
    totalPosts: core.stats.totalPosts,
    hasSnapshot: true,
  };
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
        // Buscar dados da campanha
        const campaign = await ctx.db.campaign.findUnique({
          where: { id: input.campaignId },
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        });

        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campanha não encontrada",
          });
        }

        // Top Accounts (usuários com mais views somadas)
        // Inclui TODOS os posts independente do status
        const topAccounts = await ctx.db.clipPost.groupBy({
          by: ["username"],
          where: {
            campaignId: input.campaignId,
            username: { not: null },
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
          orderBy: {
            _sum: {
              views: "desc",
            },
          },
          take: 10,
        });

        // Top Posts por Views
        // Inclui TODOS os posts independente do status
        const topPostsByViews = await ctx.db.clipPost.findMany({
          where: {
            campaignId: input.campaignId,
          },
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
          orderBy: {
            views: "desc",
          },
          take: 10,
        });

        // Top Posts por Likes
        // Inclui TODOS os posts independente do status
        const topPostsByLikes = await ctx.db.clipPost.findMany({
          where: {
            campaignId: input.campaignId,
          },
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
          orderBy: {
            likes: "desc",
          },
          take: 10,
        });

        // Top Posts por Comments
        // Inclui TODOS os posts independente do status
        const topPostsByComments = await ctx.db.clipPost.findMany({
          where: {
            campaignId: input.campaignId,
          },
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
          orderBy: {
            comments: "desc",
          },
          take: 10,
        });

        // TODOS os posts para a tabela
        // Inclui TODOS os posts independente do status
        const allPosts = await ctx.db.clipPost.findMany({
          where: {
            campaignId: input.campaignId,
          },
          select: {
            id: true,
            username: true,
            submittedUrl: true,
            views: true,
            likes: true,
            comments: true,
            shares: true,
            saves: true,
            platform: true,
            postedAt: true,
          },
          orderBy: {
            views: "desc",
          },
        });

        // TODAS as contas para a tabela (agrupadas)
        // Inclui TODOS os posts independente do status
        const allAccountsGrouped = await ctx.db.clipPost.groupBy({
          by: ["username"],
          where: {
            campaignId: input.campaignId,
            username: { not: null },
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
          orderBy: {
            _sum: {
              views: "desc",
            },
          },
        });

        // Para cada conta, buscar as plataformas
        // Inclui TODOS os posts independente do status
        const allAccounts = await Promise.all(
          allAccountsGrouped.map(async (acc) => {
            const posts = await ctx.db.clipPost.findMany({
              where: {
                campaignId: input.campaignId,
                username: acc.username,
              },
              select: {
                platform: true,
                views: true,
                likes: true,
                comments: true,
              },
            });

            const platforms = [...new Set(posts.map((p) => p.platform))];
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
          }),
        );

        // Crescimento de views ao longo do tempo (histórico de métricas)
        const metricsHistory = await ctx.db.clipPostMetrics.findMany({
          where: {
            clipPost: {
              campaignId: input.campaignId,
            },
          },
          select: {
            collectedAt: true,
            views: true,
            likes: true,
            comments: true,
            shares: true,
            saves: true,
          },
          orderBy: {
            collectedAt: "asc",
          },
        });

        // Agrupar métricas por data
        const metricsGroupedByDate = metricsHistory.reduce(
          (acc: Record<string, any>, metric) => {
            const date = new Date(metric.collectedAt)
              .toISOString()
              .split("T")[0];
            if (!date) return acc;

            if (!acc[date]) {
              acc[date] = {
                views: BigInt(0),
                likes: 0,
                comments: 0,
                shares: 0,
                count: 0,
              };
            }
            acc[date].views += metric.views;
            acc[date].likes += metric.likes;
            acc[date].comments += metric.comments;
            acc[date].shares += metric.shares;
            acc[date].count += 1;
            return acc;
          },
          {} as Record<string, any>,
        );

        const growthData = Object.entries(metricsGroupedByDate).map(
          ([date, data]: [string, any]) => ({
            date,
            views: Number(data.views),
            likes: data.likes,
            comments: data.comments,
            shares: data.shares,
          }),
        );

        // Estatísticas gerais
        // Inclui TODOS os posts independente do status
        const totalStats = await ctx.db.clipPost.aggregate({
          where: {
            campaignId: input.campaignId,
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
        });

        // Distribuição por plataforma
        // Inclui TODOS os posts independente do status
        const platformStats = await ctx.db.clipPost.groupBy({
          by: ["platform"],
          where: {
            campaignId: input.campaignId,
          },
          _sum: {
            views: true,
            likes: true,
            comments: true,
          },
          _count: {
            id: true,
          },
        });

        return {
          campaign,
          topAccounts: topAccounts.map((acc) => ({
            username: acc.username,
            platform: "INSTAGRAM", // Simplificação - pegar a plataforma mais usada
            profileUrl: `https://instagram.com/${acc.username}`,
            totalViews: Number(acc._sum.views || 0),
            totalLikes: acc._sum.likes || 0,
            totalComments: acc._sum.comments || 0,
            totalShares: acc._sum.shares || 0,
            postsCount: acc._count.id,
          })),
          topPostsByViews: topPostsByViews.map((post) => ({
            ...post,
            views: Number(post.views),
          })),
          topPostsByLikes: topPostsByLikes.map((post) => ({
            ...post,
            views: Number(post.views),
          })),
          topPostsByComments: topPostsByComments.map((post) => ({
            ...post,
            views: Number(post.views),
          })),
          allPosts: allPosts.map((post) => ({
            id: post.id,
            username: post.username || "",
            url: post.submittedUrl,
            platform: post.platform,
            views: Number(post.views),
            likes: post.likes,
            comments: post.comments,
            shares: post.shares,
            saves: post.saves ?? 0,
            postedAt: post.postedAt?.toISOString() || new Date().toISOString(),
          })),
          allAccounts,
          growthData,
          totalStats: {
            totalViews: Number(totalStats._sum.views || 0),
            totalLikes: totalStats._sum.likes || 0,
            totalComments: totalStats._sum.comments || 0,
            totalShares: totalStats._sum.shares || 0,
            totalSaves: totalStats._sum.saves || 0,
            totalPosts: totalStats._count.id,
          },
          platformStats: platformStats.map((stat) => ({
            platform: stat.platform,
            totalViews: Number(stat._sum.views || 0),
            totalLikes: stat._sum.likes || 0,
            totalComments: stat._sum.comments || 0,
            postsCount: stat._count.id,
          })),
        };
      } catch (error: any) {
        console.error("Erro ao buscar relatórios:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao buscar relatórios",
        });
      }
    }),

  // Query paginada para TODOS os posts de uma campanha (infinite scroll)
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

        // Construir where clause
        // Inclui TODOS os posts independente do status
        const where: any = {
          campaignId,
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
          orderBy: {
            [sortBy]: "desc",
          },
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

  // Query paginada para TODAS as contas de uma campanha (infinite scroll)
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

        // Primeiro, buscar TODAS as contas (usernames únicos)
        // Inclui TODOS os posts independente do status
        const where: any = {
          campaignId,
          username: { not: null },
        };

        if (search) {
          where.username = {
            contains: search,
            mode: "insensitive",
          };
        }

        // Buscar contas agrupadas
        const allAccountsGrouped = await ctx.db.clipPost.groupBy({
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
        });

        // Para cada conta, buscar plataformas e calcular engagement
        // Inclui TODOS os posts independente do status
        let accounts = await Promise.all(
          allAccountsGrouped.map(async (acc) => {
            const posts = await ctx.db.clipPost.findMany({
              where: {
                campaignId,
                username: acc.username,
              },
              select: {
                platform: true,
              },
            });

            const platforms = Array.from(new Set(posts.map((p) => p.platform)));
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
          }),
        );

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
      const clipperProfile = await ctx.db.clipperProfile.findUnique({
        where: { userId: ctx.userId },
        select: { id: true },
      });

      // Buscar IDs de campanhas privadas em que o clipper está inscrito
      const privateEnrolledCampaignIds = clipperProfile
        ? (
            await ctx.db.clipperApplication.findMany({
              where: {
                clipperProfileId: clipperProfile.id,
                status: { not: "REJECTED" },
                campaign: { isPrivate: true, status: "ACTIVE" },
              },
              select: { campaignId: true },
            })
          ).map((a) => a.campaignId)
        : [];

      const scheduledCampaigns = await ctx.db.campaign.findMany({
        where: {
          status: "ACTIVE",
          OR: [
            { isPrivate: false }, // Competições públicas
            { id: { in: privateEnrolledCampaignIds } }, // Privadas onde está inscrito
          ],
        },
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
          coverImageUrl: true,
          prizeInfo: true,
          isLeaderboardPublic: true,
          requiresApproval: true,
          rankingMetricType: true,
          isProOnly: true,
          isPrivate: true,
          organization: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
            },
          },
          _count: {
            select: {
              applications: {
                where: {
                  status: "APPROVED",
                },
              },
            },
          },
        },
        orderBy: {
          startDate: "asc",
        },
      });

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
        estimatedParticipants: campaign._count.applications,
        registrationOpen: campaign.requiresApproval === false || true, // Sempre aberto por enquanto
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

  // Inscrever-se em uma competição
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

        if (existingApplication) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Você já se inscreveu nesta competição",
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
      const clipperProfile = await ctx.db.clipperProfile.findUnique({
        where: { userId: ctx.userId },
      });

      if (!clipperProfile) {
        return [];
      }

      // Buscar IDs de campanhas privadas em que o clipper está inscrito
      const privateEnrolledCampaignIds = (
        await ctx.db.clipperApplication.findMany({
          where: {
            clipperProfileId: clipperProfile.id,
            status: { not: "REJECTED" },
            campaign: { isPrivate: true, status: "ACTIVE" },
          },
          select: { campaignId: true },
        })
      ).map((a) => a.campaignId);

      // Buscar TODAS as campanhas ativas (não arquivadas)
      // Excluir competições privadas onde o clipper NÃO está inscrito
      const activeCampaigns = await ctx.db.campaign.findMany({
        where: {
          status: "ACTIVE",
          OR: [
            { isPrivate: false }, // Competições públicas
            { id: { in: privateEnrolledCampaignIds } }, // Privadas onde está inscrito
          ],
        },
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
          status: true,
          rankingMetricType: true,
          isProOnly: true,
        },
        orderBy: {
          startDate: "desc",
        },
      });

      if (activeCampaigns.length === 0) return [];

      const campaignIds = activeCampaigns.map((c) => c.id);

      // Batch: 4 queries paralelas que substituem N×6 queries
      const [applications, participantCounts, postCounts, prizeTransactions] =
        await Promise.all([
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
              clipPosts: {
                where: { status: "ELIGIBLE" },
                select: {
                  id: true,
                  views: true,
                  likes: true,
                  comments: true,
                  shares: true,
                  saves: true,
                },
              },
            },
          }),
          // Contagem de participantes aprovados por campanha
          ctx.db.clipperApplication.groupBy({
            by: ["campaignId"],
            where: { campaignId: { in: campaignIds }, status: "APPROVED" },
            _count: { id: true },
          }),
          // Contagem de posts elegíveis por campanha
          ctx.db.clipPost.groupBy({
            by: ["campaignId"],
            where: { campaignId: { in: campaignIds }, status: "ELIGIBLE" },
            _count: { id: true },
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

      // Buscar melhores rankings e último post por application (parallel)
      const [rankings, lastPosts] =
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
              ctx.db.clipPost.findMany({
                where: {
                  applicationId: { in: applicationIds },
                  status: "ELIGIBLE",
                },
                orderBy: { postedAt: "desc" },
                distinct: ["applicationId"],
                select: { applicationId: true, postedAt: true },
              }),
            ])
          : [[], []];

      // Maps para lookup O(1)
      const appByCampaign = new Map(applications.map((a) => [a.campaignId, a]));
      const participantCountMap = new Map(
        participantCounts.map((r) => [r.campaignId, r._count.id]),
      );
      const postCountMap = new Map(
        postCounts.map((r) => [r.campaignId, r._count.id]),
      );
      const rankingByApp = new Map(rankings.map((r) => [r.applicationId, r]));
      const lastPostByApp = new Map(lastPosts.map((p) => [p.applicationId, p]));

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
            myRanking: 0,
            myPreviousRanking: 0,
            myPosts: 0,
            myTotalViews: 0,
            myEngagementRate: 0,
            myPotentialPrize: "R$ 0",
            actualPrize: undefined,
            applicationStatus: null,
            lastPostDate: undefined,
          };
        }

        const bestRanking = rankingByApp.get(application.id);
        const lastPost = lastPostByApp.get(application.id);
        const myPrizeAmount = txByCampaign.get(campaign.id) ?? 0;

        const myTotalViews = application.clipPosts.reduce(
          (sum, p) => sum + Number(p.views),
          0,
        );
        const myTotalLikes = application.clipPosts.reduce(
          (sum, p) => sum + p.likes,
          0,
        );
        const myTotalComments = application.clipPosts.reduce(
          (sum, p) => sum + p.comments,
          0,
        );
        const myTotalShares = application.clipPosts.reduce(
          (sum, p) => sum + p.shares,
          0,
        );
        const myTotalSaves = application.clipPosts.reduce(
          (sum, p) => sum + (p.saves ?? 0),
          0,
        );
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
          myPosts: application.clipPosts.length,
          myTotalViews,
          myEngagementRate,
          myPotentialPrize:
            myPrizeAmount > 0 ? formatCurrency(myPrizeAmount) : "R$ 0",
          actualPrize:
            campaign.status === "COMPLETED" && myPrizeAmount > 0
              ? formatCurrency(myPrizeAmount)
              : undefined,
          applicationStatus: application.status,
          lastPostDate: lastPost?.postedAt?.toISOString(),
          isProOnly: campaign.isProOnly,
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

  // Buscar competições ativas e concluídas do clipper (para "Minhas Competições")
  getMyActiveAndCompletedCompetitions: privateProcedure.query(
    async ({ ctx }) => {
      try {
        const clipperProfile = await ctx.db.clipperProfile.findUnique({
          where: { userId: ctx.userId },
        });

        if (!clipperProfile) {
          return [];
        }

        // Buscar applications aprovadas em campanhas ativas ou concluídas (excluir ARCHIVED)
        const applications = await ctx.db.clipperApplication.findMany({
          where: {
            clipperProfileId: clipperProfile.id,
            status: "APPROVED",
            campaign: {
              status: {
                in: ["ACTIVE", "COMPLETED"],
              },
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
                status: true,
                rankingMetricType: true,
              },
            },
            clipPosts: {
              where: {
                status: "ELIGIBLE",
              },
              select: {
                id: true,
                views: true,
                likes: true,
                comments: true,
                shares: true,
                saves: true,
              },
            },
          },
          orderBy: {
            campaign: {
              startDate: "desc",
            },
          },
        });

        if (applications.length === 0) return [];

        const applicationIds = applications.map((a) => a.id);
        const campaignIds = [...new Set(applications.map((a) => a.campaignId))];

        // Batch: substituir N×4 queries por 4 queries paralelas
        const [
          rankings,
          participantCounts,
          postCounts,
          prizeTransactions,
          lastPosts,
        ] = await Promise.all([
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
          ctx.db.clipperApplication.groupBy({
            by: ["campaignId"],
            where: { campaignId: { in: campaignIds }, status: "APPROVED" },
            _count: { id: true },
          }),
          ctx.db.clipPost.groupBy({
            by: ["campaignId"],
            where: { campaignId: { in: campaignIds }, status: "ELIGIBLE" },
            _count: { id: true },
          }),
          ctx.db.transaction.findMany({
            where: {
              wallet: { clipperProfileId: clipperProfile.id },
              campaignId: { in: campaignIds },
              type: { in: ["PRIZE_CREDIT", "BONUS", "ADJUSTMENT"] },
            },
            select: { campaignId: true, amount: true },
          }),
          ctx.db.clipPost.findMany({
            where: {
              applicationId: { in: applicationIds },
              status: "ELIGIBLE",
            },
            orderBy: { postedAt: "desc" },
            distinct: ["applicationId"],
            select: { applicationId: true, postedAt: true },
          }),
        ]);

        const rankingByApp = new Map(rankings.map((r) => [r.applicationId, r]));
        const participantCountMap = new Map(
          participantCounts.map((r) => [r.campaignId, r._count.id]),
        );
        const postCountMap = new Map(
          postCounts.map((r) => [r.campaignId, r._count.id]),
        );
        const lastPostByApp = new Map(
          lastPosts.map((p) => [p.applicationId, p]),
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

        const competitions = applications.map((app) => {
          const bestRanking = rankingByApp.get(app.id);
          const lastPost = lastPostByApp.get(app.id);
          const totalParticipants =
            participantCountMap.get(app.campaignId) ?? 0;
          const totalPosts = postCountMap.get(app.campaignId) ?? 0;
          const myPrizeAmount = txByCampaign.get(app.campaignId) ?? 0;

          const myTotalViews = app.clipPosts.reduce(
            (sum, p) => sum + Number(p.views),
            0,
          );
          const myTotalLikes = app.clipPosts.reduce(
            (sum, p) => sum + p.likes,
            0,
          );
          const myTotalComments = app.clipPosts.reduce(
            (sum, p) => sum + p.comments,
            0,
          );
          const myTotalShares = app.clipPosts.reduce(
            (sum, p) => sum + p.shares,
            0,
          );
          const myTotalSaves = app.clipPosts.reduce(
            (sum, p) => sum + (p.saves ?? 0),
            0,
          );
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
            status: app.campaign.status,
            description: app.campaign.description,
            startDate: app.campaign.startDate.toISOString(),
            endDate: app.campaign.endDate.toISOString(),
            platforms: app.campaign.platforms,
            requiredHashtags: app.campaign.requiredHashtags,
            prize: totalPrize,
            coverImageUrl:
              app.campaign.coverImageUrl ||
              "https://images.unsplash.com/photo-1551434678-e076c223a692?w=400&h=400&fit=crop",
            totalPosts,
            myRanking: bestRanking?.position || 0,
            myPreviousRanking: bestRanking?.previousPosition || 0,
            totalParticipants,
            myPosts: app.clipPosts.length,
            myTotalViews,
            myEngagementRate,
            myPotentialPrize:
              myPrizeAmount > 0 ? formatCurrency(myPrizeAmount) : "R$ 0",
            actualPrize:
              app.campaign.status === "COMPLETED" && myPrizeAmount > 0
                ? formatCurrency(myPrizeAmount)
                : undefined,
            rankingMetricType: app.campaign.rankingMetricType,
            applicationStatus: app.status,
            lastPostDate: lastPost?.postedAt?.toISOString(),
          };
        });

        return competitions;
      } catch (error: any) {
        console.error("Erro ao buscar competições do clipper:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao buscar competições do clipper",
        });
      }
    },
  ),

  // Buscar competições concluídas do clipper
  getMyCompletedCompetitions: privateProcedure.query(async ({ ctx }) => {
    try {
      const clipperProfile = await ctx.db.clipperProfile.findUnique({
        where: { userId: ctx.userId },
      });

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
          clipPosts: {
            where: {
              status: "ELIGIBLE",
            },
            select: {
              id: true,
              views: true,
              likes: true,
              comments: true,
              shares: true,
              saves: true,
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

      // Batch: substituir N×3 queries por 3 queries paralelas
      const [rankings, participantCounts, prizeTransactions] =
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
        ]);

      const rankingByApp = new Map(rankings.map((r) => [r.applicationId, r]));
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

        const myTotalViews = app.clipPosts.reduce(
          (sum, p) => sum + Number(p.views),
          0,
        );
        const myTotalLikes = app.clipPosts.reduce((sum, p) => sum + p.likes, 0);
        const myTotalComments = app.clipPosts.reduce(
          (sum, p) => sum + p.comments,
          0,
        );
        const myTotalShares = app.clipPosts.reduce(
          (sum, p) => sum + p.shares,
          0,
        );
        const myTotalSaves = app.clipPosts.reduce(
          (sum, p) => sum + (p.saves ?? 0),
          0,
        );
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
          myPosts: app.clipPosts.length,
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

  // Buscar detalhes completos de uma competição específica (para página individual)
  getCompetitionDetails: privateProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const clipperProfile = await ctx.db.clipperProfile.findUnique({
          where: { userId: ctx.userId },
        });

        if (!clipperProfile) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Perfil de clipper não encontrado",
          });
        }

        // Buscar campanha (excluir ARCHIVED)
        const campaign = await ctx.db.campaign.findUnique({
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
          },
        });

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
        });

        if (!application) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Você não está participando desta competição",
          });
        }

        // Contar participantes, posts totais e views totais
        const [totalParticipants, totalPosts, competitionViewsAgg] =
          await Promise.all([
            ctx.db.clipperApplication.count({
              where: {
                campaignId: campaign.id,
                status: "APPROVED",
              },
            }),
            ctx.db.clipPost.count({
              where: {
                campaignId: campaign.id,
                status: "ELIGIBLE",
              },
            }),
            ctx.db.clipPost.aggregate({
              where: {
                campaignId: campaign.id,
                // Incluir TODOS os posts (ELIGIBLE, INELIGIBLE, PENDING, DISQUALIFIED) para a meta de views
              },
              _sum: {
                views: true,
              },
            }),
          ]);

        const competitionTotalViews = Number(
          competitionViewsAgg._sum.views || 0,
        );

        // Buscar posts do clipper nesta competição (TODOS os status, incluindo PENDING)
        // OTIMIZAÇÃO: Limitar a 100 posts mais recentes para evitar queries pesadas
        const myPosts = await ctx.db.clipPost.findMany({
          where: {
            campaignId: campaign.id,
            applicationId: application.id,
            // Removido filtro de status para mostrar TODOS os posts
          },
          select: {
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
          },
          orderBy: { createdAt: "desc" },
          take: 100, // Limitar para evitar timeout
        });

        // Buscar rankings diários dos posts do clipper (última atualização)
        // OTIMIZAÇÃO: Buscar todos os rankings em uma única query ao invés de N queries
        const postIds = myPosts.map((p) => p.id);

        const rankingMap = new Map<string, number>();

        if (postIds.length > 0) {
          // Buscar o ranking diário mais recente da campanha
          const latestDailyRanking = await ctx.db.dailyRanking.findFirst({
            where: {
              campaignId: campaign.id,
            },
            orderBy: {
              rankingDate: "desc",
            },
            select: {
              id: true,
            },
          });

          if (latestDailyRanking) {
            // Buscar todas as entries desse ranking para os posts do clipper em uma única query
            const allRankingEntries = await ctx.db.dailyRankingEntry.findMany({
              where: {
                dailyRankingId: latestDailyRanking.id,
                clipPostId: {
                  in: postIds,
                },
              },
              select: {
                clipPostId: true,
                position: true,
              },
            });

            // Mapear os resultados
            allRankingEntries.forEach((entry) => {
              rankingMap.set(entry.clipPostId, entry.position);
            });
          }
        }

        // Calcular métricas TOTAIS dos meus posts ELEGÍVEIS usando agregação (não limitado)
        const myTotalMetrics = await ctx.db.clipPost.aggregate({
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
        });

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

        // Buscar ranking mensal atual do clipper
        const bestRanking = await ctx.db.monthlyRankingEntry.findFirst({
          where: {
            applicationId: application.id,
            monthlyRanking: {
              campaignId: campaign.id,
            },
          },
          orderBy: [{ position: "asc" }, { lastUpdated: "desc" }],
          select: {
            position: true,
            previousPosition: true,
          },
        });

        // Buscar soma de transações (ganhos) — aggregate evita carregar todas as linhas
        const prizeAgg = await ctx.db.transaction.aggregate({
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
        });

        const myCurrentEarnings = prizeAgg._sum.amount ?? 0;

        // Buscar top ranking (top 15)
        // Tipo de métrica de ranking (VIEWS ou VIEWS_X_ENGAGEMENT)
        const metricType = campaign.rankingMetricType as RankingMetricType;

        let topRanking: Array<{
          position: number;
          username: string;
          imageUrl: string | null;
          totalViews: number;
          rankingScore: number;
          engagementRate: number;
          totalPosts: number;
          isCurrentUser: boolean;
          clanTag: string | null;
          clanEmoji: string | null;
          clanEmojiColor: string | null;
        }> = [];

        if (metricType === "VIEWS") {
          // Para VIEWS: Usar aggregação direta no banco (mais eficiente)
          const topApplicationsAgg = await ctx.db.clipPost.groupBy({
            by: ["applicationId"],
            where: {
              campaignId: campaign.id,
              status: "ELIGIBLE",
              NOT: {
                applicationId: undefined,
              },
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
            orderBy: {
              _sum: {
                views: "desc",
              },
            },
            take: campaign.activeRankingRule?.monthlyTopCount ?? 15,
          });

          // Buscar dados dos clippers
          const topApplicationIds = topApplicationsAgg
            .filter(
              (a): a is typeof a & { applicationId: string } =>
                a.applicationId !== null,
            )
            .map((a) => a.applicationId);

          const topClipperData = await ctx.db.clipperApplication.findMany({
            where: {
              id: { in: topApplicationIds },
            },
            select: {
              id: true,
              clipperProfile: {
                select: {
                  userId: true,
                  artisticName: true,
                  fullName: true,
                  user: {
                    select: {
                      imageUrl: true,
                    },
                  },
                  clan: {
                    select: {
                      tag: true,
                      emoji: true,
                      emojiColor: true,
                    },
                  },
                },
              },
            },
          });

          // Mapear os dados
          const clipperDataMap = new Map(topClipperData.map((c) => [c.id, c]));

          topRanking = topApplicationsAgg
            .filter(
              (agg): agg is typeof agg & { applicationId: string } =>
                agg.applicationId !== null,
            )
            .map((agg, index) => {
              const clipperInfo = clipperDataMap.get(agg.applicationId);
              const totalViews = Number(agg._sum?.views || 0);
              const totalLikes = agg._sum?.likes || 0;
              const totalComments = agg._sum?.comments || 0;
              const totalShares = agg._sum?.shares || 0;
              const totalSaves = agg._sum?.saves || 0;
              const engagementRate = calculateEngagementRate(
                totalViews,
                totalLikes,
                totalComments,
                totalShares,
                totalSaves,
              );
              return {
                position: index + 1,
                username: clipperInfo
                  ? `@${getClipperRankingDisplayName(clipperInfo.clipperProfile)}`
                  : "@unknown",
                imageUrl: clipperInfo?.clipperProfile.user?.imageUrl || null,
                totalViews,
                rankingScore: totalViews,
                engagementRate,
                totalPosts: agg._count?.id || 0,
                isCurrentUser:
                  clipperInfo?.clipperProfile.userId === ctx.userId,
                clanTag: clipperInfo?.clipperProfile.clan?.tag ?? null,
                clanEmoji: clipperInfo?.clipperProfile.clan?.emoji ?? null,
                clanEmojiColor:
                  clipperInfo?.clipperProfile.clan?.emojiColor ?? null,
              };
            })
            .filter((entry) => entry.username !== "@unknown");
        } else {
          // Para VIEWS_X_ENGAGEMENT: Precisa calcular score por post
          // Buscar posts agrupados por application com métricas
          const topApplicationsAgg = await ctx.db.clipPost.groupBy({
            by: ["applicationId"],
            where: {
              campaignId: campaign.id,
              status: "ELIGIBLE",
              NOT: {
                applicationId: undefined,
              },
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
          });

          // Calcular ranking score para cada application
          const applicationsWithScore = topApplicationsAgg
            .filter(
              (a): a is typeof a & { applicationId: string } =>
                a.applicationId !== null,
            )
            .map((agg) => {
              const views = Number(agg._sum.views || 0);
              const likes = agg._sum.likes || 0;
              const comments = agg._sum.comments || 0;
              const shares = agg._sum.shares || 0;
              const saves = agg._sum.saves || 0;

              const rankingScore = calculateRankingScore(
                metricType,
                views,
                likes,
                comments,
                shares,
                saves,
              );

              const engagementRate = calculateEngagementRate(
                views,
                likes,
                comments,
                shares,
                saves,
              );

              return {
                applicationId: agg.applicationId,
                totalViews: views,
                rankingScore,
                engagementRate,
                totalPosts: agg._count.id,
              };
            })
            .sort((a, b) => b.rankingScore - a.rankingScore)
            .slice(0, campaign.activeRankingRule?.monthlyTopCount ?? 15);

          // Buscar dados dos clippers
          const topApplicationIds = applicationsWithScore.map(
            (a) => a.applicationId,
          );

          const topClipperData = await ctx.db.clipperApplication.findMany({
            where: {
              id: { in: topApplicationIds },
            },
            select: {
              id: true,
              clipperProfile: {
                select: {
                  userId: true,
                  artisticName: true,
                  fullName: true,
                  user: {
                    select: {
                      imageUrl: true,
                    },
                  },
                  clan: {
                    select: {
                      tag: true,
                      emoji: true,
                      emojiColor: true,
                    },
                  },
                },
              },
            },
          });

          const clipperDataMap = new Map(topClipperData.map((c) => [c.id, c]));

          topRanking = applicationsWithScore
            .map((app, index) => {
              const clipperInfo = clipperDataMap.get(app.applicationId);
              return {
                position: index + 1,
                username: clipperInfo
                  ? `@${getClipperRankingDisplayName(clipperInfo.clipperProfile)}`
                  : "@unknown",
                imageUrl: clipperInfo?.clipperProfile.user?.imageUrl || null,
                totalViews: app.totalViews,
                rankingScore: app.rankingScore,
                engagementRate: app.engagementRate,
                totalPosts: app.totalPosts,
                isCurrentUser:
                  clipperInfo?.clipperProfile.userId === ctx.userId,
                clanTag: clipperInfo?.clipperProfile.clan?.tag ?? null,
                clanEmoji: clipperInfo?.clipperProfile.clan?.emoji ?? null,
                clanEmojiColor:
                  clipperInfo?.clipperProfile.clan?.emojiColor ?? null,
              };
            })
            .filter((entry) => entry.username !== "@unknown");
        }

        const dailyLimit = campaign.activeRankingRule?.dailyTopCount ?? 15;
        const referenceDateYmd = getClipperDailyReferenceDateYmd();
        const { startDate: dailyWindowStart, endDate: dailyWindowEnd } =
          getLiveDailyWindowByReferenceDate(referenceDateYmd);

        const [
          todayPostsCount,
          snapshotRankingForReference,
          todayPosts,
          dailyRankingDates,
          dailyEntryMetricsMap,
        ] = await Promise.all([
          ctx.db.clipPost.count({
            where: {
              campaignId: campaign.id,
              status: "ELIGIBLE",
              postedAt: { gte: dailyWindowStart, lt: dailyWindowEnd },
            },
          }),
          buildSnapshotDailyRankingForClipper({
            db: ctx.db,
            campaignId: campaign.id,
            dateYmd: referenceDateYmd,
            userId: ctx.userId,
          }),
          ctx.db.clipPost.findMany({
            where: {
              campaignId: campaign.id,
              status: { not: "DISQUALIFIED" },
              postedAt: { gte: dailyWindowStart, lt: dailyWindowEnd },
            },
            include: {
              application: {
                include: {
                  clipperProfile: {
                    include: {
                      user: { select: { imageUrl: true } },
                      clan: {
                        select: { tag: true, emoji: true, emojiColor: true },
                      },
                    },
                  },
                },
              },
            },
          }),
          ctx.db.dailyRanking.findMany({
            where: { campaignId: campaign.id },
            select: { rankingDate: true },
            orderBy: [{ rankingDate: "desc" }],
            take: 90,
          }),
          loadDailyRankingEntryMetricsMap(
            ctx.db,
            campaign.id,
            referenceDateYmd,
          ),
        ]);

        const hasSnapshotMetrics = dailyEntryMetricsMap.size > 0;
        const liveDailyPosts = rankLiveDailyPosts({
          posts: todayPosts.flatMap((post) => {
            const clipTotals = {
              views: Number(post.views),
              likes: post.likes,
              comments: post.comments,
              shares: post.shares,
              saves: post.saves ?? 0,
            };
            const { metrics, source } = pickMetricsForDailyRank(
              post.id,
              clipTotals,
              dailyEntryMetricsMap,
            );
            // Se houver snapshot do dia, não misturar métricas totais de ClipPost.
            if (hasSnapshotMetrics && source !== "daily_entry") {
              return [];
            }
            return {
              postId: post.id,
              clipperName: getClipperRankingDisplayName(
                post.application.clipperProfile,
              ),
              clipperImageUrl:
                post.application.clipperProfile.user?.imageUrl || null,
              username: post.username || "",
              platform: post.platform,
              thumbnailUrl: post.thumbnailUrl || "",
              views: metrics.views,
              likes: metrics.likes,
              comments: metrics.comments,
              shares: metrics.shares,
              saves: metrics.saves,
              postedAtIso:
                post.postedAt?.toISOString() || new Date().toISOString(),
              isCurrentUser:
                post.application.clipperProfile.userId === ctx.userId,
              clanTag: post.application.clipperProfile.clan?.tag ?? null,
              clanEmoji: post.application.clipperProfile.clan?.emoji ?? null,
              clanEmojiColor:
                post.application.clipperProfile.clan?.emojiColor ?? null,
            };
          }),
          metricType: campaign.rankingMetricType,
          topCount: dailyLimit,
          dailyPrizeTable: campaign.activeRankingRule?.dailyPrizeTable ?? null,
        });

        const topDailyPosts =
          snapshotRankingForReference.hasSnapshot &&
          snapshotRankingForReference.posts.length > 0
            ? snapshotRankingForReference.posts
            : liveDailyPosts;

        // Dados de crescimento (últimos 7 dias)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const metricsHistory = await ctx.db.clipPostMetrics.findMany({
          where: {
            clipPost: {
              campaignId: campaign.id,
              applicationId: application.id,
            },
            collectedAt: {
              gte: sevenDaysAgo,
            },
          },
          select: {
            collectedAt: true,
            views: true,
            likes: true,
            comments: true,
            shares: true,
            saves: true,
          },
          orderBy: {
            collectedAt: "asc",
          },
          take: 1000, // 7 dias × 2 coletas/dia × max 100 posts = ~1400, cap de segurança
        });

        // Agrupar por dia
        const growthDataMap: Record<
          string,
          { views: number; engagement: number }
        > = {};
        metricsHistory.forEach((metric) => {
          const date = metric.collectedAt.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          });
          if (!growthDataMap[date]) {
            growthDataMap[date] = { views: 0, engagement: 0 };
          }
          growthDataMap[date].views += Number(metric.views);
          growthDataMap[date].engagement +=
            metric.likes + metric.comments + metric.shares;
        });

        const growthData = Object.entries(growthDataMap).map(
          ([date, data]) => ({
            date,
            views: data.views,
            engagement: data.engagement,
          }),
        );

        // Formatar posts para retorno
        const formattedPosts = myPosts.map((post) => {
          const engagementRate = calculateEngagementRate(
            Number(post.views),
            post.likes,
            post.comments,
            post.shares,
            post.saves ?? 0,
          );

          // Buscar earnings deste post (simplificado)
          const earnings =
            myCurrentEarnings > 0 && myTotalPostsCount > 0
              ? myCurrentEarnings / myTotalPostsCount
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
            rankInCompetition: rankingMap.get(post.id) || 0,
            earnings: new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
              minimumFractionDigits: 0,
            }).format(earnings),
            status: post.status, // Usar o status real do post (PENDING, ELIGIBLE, etc.)
            ineligibilityReason:
              post.ineligibilityReason ||
              (post.status === "DISQUALIFIED"
                ? "Post desqualificado. Nenhum motivo detalhado foi registrado."
                : null),
            hashtags: post.hashtags,
          };
        });

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
          name: campaign.name,
          slug: campaign.slug,
          status: campaign.status,
          description: campaign.description,
          startDate: campaign.startDate.toISOString(),
          endDate: campaign.endDate.toISOString(),
          platforms: campaign.platforms,
          requiredHashtags: campaign.requiredHashtags,
          requiredMentions: campaign.requiredMentions,
          totalPrize,
          coverImageUrl:
            campaign.coverImageUrl ||
            "https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&h=450&fit=crop",
          totalPosts,
          totalParticipants,
          competitionTotalViews,
          rankingMetricType: campaign.rankingMetricType, // Tipo de métrica (VIEWS ou VIEWS_X_ENGAGEMENT)
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
          myCurrentRanking: bestRanking?.position || 0,
          myPreviousRanking:
            bestRanking?.previousPosition || bestRanking?.position || 0,
          myMonthlyRanking: bestRanking?.position || 0, // Simplificado
          myTotalPosts: myTotalPostsCount, // Usando contagem agregada (não limitada)
          myTotalViews,
          myTotalLikes,
          myTotalComments,
          myTotalShares,
          myTotalSaves,
          myEngagementRate,
          myCurrentEarnings: new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
            minimumFractionDigits: 0,
          }).format(myCurrentEarnings),
          myProjectedEarnings: new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
            minimumFractionDigits: 0,
          }).format(myCurrentEarnings * 1.5), // Projeção simplificada

          // Posts e rankings
          myPosts: formattedPosts,
          topRanking, // Já ordenado pela query
          topDailyPosts,
          todayPostsCount, // Total de posts submetidos hoje
          dailyRankingMode: "TOP_POSTS",
          dailyRankingReferenceDate: referenceDateYmd,
          dailyRankingSource:
            snapshotRankingForReference.hasSnapshot &&
            snapshotRankingForReference.posts.length > 0
              ? "SNAPSHOT"
              : "LIVE",
          dailyWindowStart: dailyWindowStart.toISOString(),
          dailyWindowEnd: dailyWindowEnd.toISOString(),
          dailyRankingDates: dailyRankingDates.map(
            (item) => item.rankingDate.toISOString().split("T")[0]!,
          ),
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

  getDailyRankingHistory: privateProcedure
    .input(
      z.object({
        campaignId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rankings = await ctx.db.dailyRanking.findMany({
        where: { campaignId: input.campaignId },
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
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .query(async ({ ctx, input }) => {
      const campaign = await ctx.db.campaign.findUnique({
        where: { id: input.campaignId },
        select: {
          id: true,
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

      const fromSnapshot = await buildSnapshotDailyRankingForClipper({
        db: ctx.db,
        campaignId: campaign.id,
        dateYmd: input.date,
        userId: ctx.userId,
      });

      if (fromSnapshot.hasSnapshot) {
        const { startDate, endDate } = getPostedAtWindowUtc(input.date);
        return {
          date: input.date,
          source: "SNAPSHOT" as const,
          rankingMode: "TOP_POSTS" as const,
          posts: fromSnapshot.posts,
          totalPosts: fromSnapshot.totalPosts,
          windowStart: startDate.toISOString(),
          windowEnd: endDate.toISOString(),
        };
      }

      const { startDate, endDate } = getPostedAtWindowUtc(input.date);
      const [posts, dailyEntryMetricsMap] = await Promise.all([
        ctx.db.clipPost.findMany({
          where: {
            campaignId: input.campaignId,
            status: { not: "DISQUALIFIED" },
            postedAt: {
              gte: startDate,
              lt: endDate,
            },
          },
          include: {
            application: {
              include: {
                clipperProfile: {
                  include: {
                    user: { select: { imageUrl: true } },
                    clan: {
                      select: { tag: true, emoji: true, emojiColor: true },
                    },
                  },
                },
              },
            },
          },
        }),
        loadDailyRankingEntryMetricsMap(ctx.db, input.campaignId, input.date),
      ]);

      const hasSnapshotMetrics = dailyEntryMetricsMap.size > 0;
      const ranked = rankLiveDailyPosts({
        posts: posts.flatMap((post) => {
          const clipTotals = {
            views: Number(post.views),
            likes: post.likes,
            comments: post.comments,
            shares: post.shares,
            saves: post.saves ?? 0,
          };
          const { metrics, source } = pickMetricsForDailyRank(
            post.id,
            clipTotals,
            dailyEntryMetricsMap,
          );
          if (hasSnapshotMetrics && source !== "daily_entry") {
            return [];
          }
          return {
            postId: post.id,
            clipperName: getClipperRankingDisplayName(
              post.application.clipperProfile,
            ),
            clipperImageUrl:
              post.application.clipperProfile.user?.imageUrl || null,
            username: post.username || "",
            platform: post.platform,
            thumbnailUrl: post.thumbnailUrl || "",
            views: metrics.views,
            likes: metrics.likes,
            comments: metrics.comments,
            shares: metrics.shares,
            saves: metrics.saves,
            postedAtIso:
              post.postedAt?.toISOString() || new Date().toISOString(),
            isCurrentUser:
              post.application.clipperProfile.userId === ctx.userId,
            clanTag: post.application.clipperProfile.clan?.tag ?? null,
            clanEmoji: post.application.clipperProfile.clan?.emoji ?? null,
            clanEmojiColor:
              post.application.clipperProfile.clan?.emojiColor ?? null,
          };
        }),
        metricType: campaign.rankingMetricType,
        topCount: campaign.activeRankingRule?.dailyTopCount ?? 15,
        dailyPrizeTable: campaign.activeRankingRule?.dailyPrizeTable ?? null,
      });

      return {
        date: input.date,
        source: "LIVE" as const,
        rankingMode: "TOP_POSTS" as const,
        posts: ranked,
        totalPosts: posts.length,
        windowStart: startDate.toISOString(),
        windowEnd: endDate.toISOString(),
      };
    }),

  // Ranking "Top Clipadores" do dia: ordena por QUANTIDADE de vídeos postados na janela
  getDailyTopClippersByPostedVideos: privateProcedure
    .input(
      z.object({
        campaignId: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const campaignConfig = await ctx.db.campaign.findUnique({
        where: { id: input.campaignId },
        select: {
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

      const clipperProfile = await ctx.db.clipperProfile.findUnique({
        where: { userId: ctx.userId },
        select: { id: true },
      });

      const application = clipperProfile
        ? await ctx.db.clipperApplication.findUnique({
            where: {
              campaignId_clipperProfileId: {
                campaignId: input.campaignId,
                clipperProfileId: clipperProfile.id,
              },
            },
            select: { id: true },
          })
        : null;

      if (!application) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Você precisa participar desta competição para ver o Top Clipadores.",
        });
      }

      const { startDate, endDate } = getLiveDailyWindowByReferenceDate(
        input.date,
      );

      type CampaignBreakdown = {
        campaignId: string;
        campaignName: string;
        posts: number;
        views: number;
      };

      type TopClipperAccumulator = {
        clipperProfileId: string;
        clipperName: string;
        fullName: string;
        imageUrl: string | null;
        isCurrentUser: boolean;
        totalPosts: number;
        totalViews: number;
        campaigns: Map<string, CampaignBreakdown>;
      };

      const clippersMap = new Map<string, TopClipperAccumulator>();
      let totalPostsInWindow = 0;
      let totalViewsInWindow = 0;

      const addClipperPost = (post: {
        clipperProfileId: string;
        clipperName: string;
        fullName: string;
        imageUrl: string | null;
        userId: string;
        campaignId: string;
        campaignName: string;
        views: number;
      }) => {
        const current = clippersMap.get(post.clipperProfileId) ?? {
          clipperProfileId: post.clipperProfileId,
          clipperName: post.clipperName,
          fullName: post.fullName,
          imageUrl: post.imageUrl,
          isCurrentUser: post.userId === ctx.userId,
          totalPosts: 0,
          totalViews: 0,
          campaigns: new Map<string, CampaignBreakdown>(),
        };
        const campaignBreakdown = current.campaigns.get(post.campaignId) ?? {
          campaignId: post.campaignId,
          campaignName: post.campaignName,
          posts: 0,
          views: 0,
        };

        current.isCurrentUser =
          current.isCurrentUser || post.userId === ctx.userId;
        current.totalPosts += 1;
        current.totalViews += post.views;
        campaignBreakdown.posts += 1;
        campaignBreakdown.views += post.views;
        current.campaigns.set(post.campaignId, campaignBreakdown);
        clippersMap.set(post.clipperProfileId, current);
        totalPostsInWindow += 1;
        totalViewsInWindow += post.views;
      };

      const livePosts = await ctx.db.clipPost.findMany({
        where: {
          campaignId: input.campaignId,
          status: ClipPostStatus.ELIGIBLE,
          postedAt: { gte: startDate, lt: endDate },
        },
        select: {
          campaignId: true,
          views: true,
          campaign: { select: { name: true } },
          application: {
            select: {
              clipperProfileId: true,
              clipperProfile: {
                select: {
                  fullName: true,
                  artisticName: true,
                  userId: true,
                  user: { select: { imageUrl: true } },
                },
              },
            },
          },
        },
      });

      for (const post of livePosts) {
        const profile = post.application.clipperProfile;
        addClipperPost({
          clipperProfileId: post.application.clipperProfileId,
          clipperName: getClipperRankingDisplayName(profile),
          fullName: getFirstName(profile.fullName) || "Clipador",
          imageUrl: profile.user.imageUrl,
          userId: profile.userId,
          campaignId: post.campaignId,
          campaignName: post.campaign.name,
          views: Number(post.views || 0),
        });
      }

      const entries = Array.from(clippersMap.values())
        .sort((a, b) => {
          if (b.totalPosts !== a.totalPosts) return b.totalPosts - a.totalPosts;
          return b.totalViews - a.totalViews;
        })
        .slice(0, input.limit)
        .map((clipper, index) => ({
          position: index + 1,
          clipperProfileId: clipper.clipperProfileId,
          clipperName: clipper.clipperName,
          fullName: clipper.fullName,
          imageUrl: clipper.imageUrl,
          isCurrentUser: clipper.isCurrentUser,
          prize: getTopClippersPrize(prizeTable, index + 1),
          totalPosts: clipper.totalPosts,
          totalViews: clipper.totalViews,
          campaigns: Array.from(clipper.campaigns.values()).sort((a, b) => {
            if (b.posts !== a.posts) return b.posts - a.posts;
            return b.views - a.views;
          }),
        }));

      return {
        date: input.date,
        windowStart: startDate.toISOString(),
        windowEnd: endDate.toISOString(),
        prizeTable,
        entries,
        stats: {
          totalPostsInWindow,
          totalViewsInWindow,
          totalClippersWithPosts: clippersMap.size,
          totalCampaigns: 1,
        },
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
