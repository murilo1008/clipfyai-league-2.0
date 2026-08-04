import { currentUser } from "@clerk/nextjs/server";
import { createTRPCRouter, privateProcedure } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const organizationRouter = createTRPCRouter({
  // Listar todas as organizações
  getAll: privateProcedure.query(async ({ ctx }) => {
    try {
      const organizations = await ctx.db.organization.findMany({
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  imageUrl: true,
                },
              },
            },
          },
          campaigns: {
            where: {
              status: "ACTIVE",
            },
          },
          _count: {
            select: {
              campaigns: true,
              members: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Calcular métricas agregadas para cada organização
      const orgsWithMetrics = await Promise.all(
        organizations.map(async (org) => {
          // Buscar total de views de todas as campanhas
          const campaigns = await ctx.db.campaign.findMany({
            where: { organizationId: org.id },
            include: {
              clipPosts: {
                select: {
                  views: true,
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
          });

          const totalViews = campaigns.reduce((acc, campaign) => {
            const campaignViews = campaign.clipPosts.reduce(
              (sum, post) => sum + Number(post.views),
              0
            );
            return acc + campaignViews;
          }, 0);

          const totalClippers = campaigns.reduce(
            (acc, campaign) => acc + campaign._count.applications,
            0
          );

          // Buscar quota usage do mês atual
          const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
          const quotaUsage = await ctx.db.quotaUsage.findUnique({
            where: {
              organizationId_resourceType_period: {
                organizationId: org.id,
                resourceType: "INGEST",
                period: currentPeriod,
              },
            },
          });

          return {
            ...org,
            activeCampaigns: org.campaigns.length,
            totalCampaigns: org._count.campaigns,
            totalViews,
            totalClippers,
            currentIngestUsage: quotaUsage?.used || 0,
            members: org.members.length,
          };
        })
      );

      return orgsWithMetrics;
    } catch (error: any) {
      console.error("Erro ao buscar organizações:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Erro ao buscar organizações",
      });
    }
  }),

  // Buscar uma organização por ID
  getById: privateProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const organization = await ctx.db.organization.findUnique({
          where: { id: input.id },
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    imageUrl: true,
                  },
                },
              },
            },
            campaigns: true,
            _count: {
              select: {
                campaigns: true,
                members: true,
              },
            },
          },
        });

        if (!organization) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Organização não encontrada",
          });
        }

        return organization;
      } catch (error: any) {
        console.error("Erro ao buscar organização:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao buscar organização",
        });
      }
    }),

  // Criar nova organização
  create: privateProcedure
    .input(
      z.object({
        name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
        slug: z
          .string()
          .min(2, "Slug deve ter pelo menos 2 caracteres")
          .regex(
            /^[a-z0-9-]+$/,
            "Slug deve conter apenas letras minúsculas, números e hífens"
          ),
        description: z.string().optional(),
        logoUrl: z.string().url().optional().or(z.literal("")),
        website: z.string().url().optional().or(z.literal("")),
        country: z.string().default("Brasil"),
        timezone: z.string().default("America/Sao_Paulo"),
        quotaMonthlyIngest: z.number().int().positive().default(100000),
        quotaActiveCampaigns: z.number().int().positive().default(5),
        quotaCreatorsPerCampaign: z.number().int().positive().default(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await currentUser();

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Você precisa estar logado para criar uma organização.",
        });
      }

      try {
        // Verificar se o slug já existe
        const existingOrg = await ctx.db.organization.findUnique({
          where: { slug: input.slug },
        });

        if (existingOrg) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Já existe uma organização com este slug.",
          });
        }

        // Criar a organização
        const organization = await ctx.db.organization.create({
          data: {
            name: input.name,
            slug: input.slug,
            description: input.description,
            logoUrl: input.logoUrl || null,
            website: input.website || null,
            country: input.country,
            timezone: input.timezone,
            quotaMonthlyIngest: input.quotaMonthlyIngest,
            quotaActiveCampaigns: input.quotaActiveCampaigns,
            quotaCreatorsPerCampaign: input.quotaCreatorsPerCampaign,
            isActive: true,
          },
        });

        // Adicionar o usuário atual como OWNER da organização
        await ctx.db.organizationMember.create({
          data: {
            userId: user.id,
            organizationId: organization.id,
            role: "OWNER",
          },
        });

        // Criar quota usage inicial
        const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
        await ctx.db.quotaUsage.create({
          data: {
            organizationId: organization.id,
            resourceType: "INGEST",
            period: currentPeriod,
            used: 0,
            limit: input.quotaMonthlyIngest,
          },
        });

        console.log(`✅ Organização criada: ${organization.name}`);

        return {
          success: true,
          organization,
          message: "Organização criada com sucesso",
        };
      } catch (error: any) {
        console.error("Erro ao criar organização:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        if (error.code === "P2002") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Já existe uma organização com este slug.",
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao criar organização",
        });
      }
    }),

  // Atualizar organização
  update: privateProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).optional(),
        description: z.string().optional(),
        logoUrl: z.string().url().optional().or(z.literal("")),
        website: z.string().url().optional().or(z.literal("")),
        country: z.string().optional(),
        timezone: z.string().optional(),
        isActive: z.boolean().optional(),
        quotaMonthlyIngest: z.number().int().positive().optional(),
        quotaActiveCampaigns: z.number().int().positive().optional(),
        quotaCreatorsPerCampaign: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await currentUser();

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Você precisa estar logado.",
        });
      }

      try {
        const { id, ...updateData } = input;

        const organization = await ctx.db.organization.update({
          where: { id },
          data: updateData,
        });

        return {
          success: true,
          organization,
          message: "Organização atualizada com sucesso",
        };
      } catch (error: any) {
        console.error("Erro ao atualizar organização:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao atualizar organização",
        });
      }
    }),

  // Deletar organização
  delete: privateProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await currentUser();

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Você precisa estar logado.",
        });
      }

      try {
        await ctx.db.organization.delete({
          where: { id: input.id },
        });

        return {
          success: true,
          message: "Organização excluída com sucesso",
        };
      } catch (error: any) {
        console.error("Erro ao excluir organização:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao excluir organização",
        });
      }
    }),

  // Obter estatísticas agregadas
  getStats: privateProcedure.query(async ({ ctx }) => {
    try {
      const totalOrgs = await ctx.db.organization.count();
      const activeOrgs = await ctx.db.organization.count({
        where: { isActive: true },
      });
      
      const allMembers = await ctx.db.organizationMember.count();
      
      const activeCampaigns = await ctx.db.campaign.count({
        where: { status: "ACTIVE" },
      });

      // Total de views (pode ser pesado, considere cachear)
      const allCampaigns = await ctx.db.campaign.findMany({
        include: {
          clipPosts: {
            select: {
              views: true,
            },
          },
        },
      });

      const totalViews = allCampaigns.reduce((acc, campaign) => {
        const campaignViews = campaign.clipPosts.reduce(
          (sum, post) => sum + Number(post.views),
          0
        );
        return acc + campaignViews;
      }, 0);

      return {
        totalOrgs,
        activeOrgs,
        totalMembers: allMembers,
        activeCampaigns,
        totalViews,
      };
    } catch (error: any) {
      console.error("Erro ao buscar estatísticas:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Erro ao buscar estatísticas",
      });
    }
  }),

  // Adicionar membro à organização
  addMember: privateProcedure
    .input(
      z.object({
        organizationId: z.string(),
        userId: z.string(),
        role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await currentUser();

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Você precisa estar logado.",
        });
      }

      try {
        // Verificar se o membro já existe
        const existingMember = await ctx.db.organizationMember.findUnique({
          where: {
            userId_organizationId: {
              userId: input.userId,
              organizationId: input.organizationId,
            },
          },
        });

        if (existingMember) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Este usuário já é membro desta organização.",
          });
        }

        const member = await ctx.db.organizationMember.create({
          data: {
            userId: input.userId,
            organizationId: input.organizationId,
            role: input.role,
            invitedBy: user.id,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                imageUrl: true,
              },
            },
          },
        });

        return {
          success: true,
          member,
          message: "Membro adicionado com sucesso",
        };
      } catch (error: any) {
        console.error("Erro ao adicionar membro:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao adicionar membro",
        });
      }
    }),

  // Atualizar role de um membro
  updateMemberRole: privateProcedure
    .input(
      z.object({
        memberId: z.string(),
        role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await currentUser();

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Você precisa estar logado.",
        });
      }

      try {
        const member = await ctx.db.organizationMember.update({
          where: { id: input.memberId },
          data: { role: input.role },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                imageUrl: true,
              },
            },
          },
        });

        return {
          success: true,
          member,
          message: "Permissão atualizada com sucesso",
        };
      } catch (error: any) {
        console.error("Erro ao atualizar membro:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao atualizar membro",
        });
      }
    }),

  // Remover membro da organização
  removeMember: privateProcedure
    .input(z.object({ memberId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await currentUser();

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Você precisa estar logado.",
        });
      }

      try {
        await ctx.db.organizationMember.delete({
          where: { id: input.memberId },
        });

        return {
          success: true,
          message: "Membro removido com sucesso",
        };
      } catch (error: any) {
        console.error("Erro ao remover membro:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao remover membro",
        });
      }
    }),
});

