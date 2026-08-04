import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const campaignRouter = createTRPCRouter({
  // Buscar campanhas ativas
  getActive: publicProcedure.query(async ({ ctx }) => {
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
        take: 10, // Limitar a 10 campanhas em andamento
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
  getAll: publicProcedure.query(async ({ ctx }) => {
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
  getReports: publicProcedure
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
        const topAccounts = await ctx.db.clipPost.groupBy({
          by: ["username"],
          where: {
            campaignId: input.campaignId,
            username: { not: null },
            status: "ELIGIBLE",
          },
          _sum: {
            views: true,
            likes: true,
            comments: true,
            shares: true,
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
        const topPostsByViews = await ctx.db.clipPost.findMany({
          where: {
            campaignId: input.campaignId,
            status: "ELIGIBLE",
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
        const topPostsByLikes = await ctx.db.clipPost.findMany({
          where: {
            campaignId: input.campaignId,
            status: "ELIGIBLE",
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
        const topPostsByComments = await ctx.db.clipPost.findMany({
          where: {
            campaignId: input.campaignId,
            status: "ELIGIBLE",
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
          },
          orderBy: {
            collectedAt: "asc",
          },
        });

        // Agrupar métricas por data
        const metricsGroupedByDate = metricsHistory.reduce((acc: Record<string, any>, metric) => {
          const date = new Date(metric.collectedAt).toISOString().split("T")[0];
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
        }, {} as Record<string, any>);

        const growthData = Object.entries(metricsGroupedByDate).map(([date, data]: [string, any]) => ({
          date,
          views: Number(data.views),
          likes: data.likes,
          comments: data.comments,
          shares: data.shares,
        }));

        // Estatísticas gerais
        const totalStats = await ctx.db.clipPost.aggregate({
          where: {
            campaignId: input.campaignId,
            status: "ELIGIBLE",
          },
          _sum: {
            views: true,
            likes: true,
            comments: true,
            shares: true,
          },
          _count: {
            id: true,
          },
        });

        // Distribuição por plataforma
        const platformStats = await ctx.db.clipPost.groupBy({
          by: ["platform"],
          where: {
            campaignId: input.campaignId,
            status: "ELIGIBLE",
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
          topPostsByLikes,
          topPostsByComments,
          growthData,
          totalStats: {
            totalViews: Number(totalStats._sum.views || 0),
            totalLikes: totalStats._sum.likes || 0,
            totalComments: totalStats._sum.comments || 0,
            totalShares: totalStats._sum.shares || 0,
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
});

