import { z } from "zod"
import { createTRPCRouter, privateProcedure } from "@/server/api/trpc"
import { TRPCError } from "@trpc/server"
import { clerkClient } from "@clerk/nextjs/server"
import {
  calculateEngagementRate,
  calculateRankingScore,
  type RankingMetricType,
} from "@/lib/ranking-helpers"

// Client status enum
const ClientStatusEnum = z.enum(["ACTIVE", "INACTIVE", "PENDING"])

export const clientRouter = createTRPCRouter({
  // Get all clients
  getAll: privateProcedure.query(async ({ ctx }) => {
    // Buscar role do usuário no banco
    const dbUser = await ctx.db.user.findUnique({
      where: { id: ctx.userId },
      select: { role: true },
    })

    // Apenas ADMIN e ORGANIZER_ADMIN podem ver clientes
    if (!dbUser || (dbUser.role !== "ADMIN" && dbUser.role !== "ORGANIZER_ADMIN")) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Você não tem permissão para acessar esta funcionalidade",
      })
    }

    // Buscar todos os usuários com role CLIENT e seus perfis
    const users = await ctx.db.user.findMany({
      where: {
        role: "CLIENT",
      },
      select: {
        id: true,
        name: true,
        email: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
        hasStore: true,
        hasKiwifyStore: true,
        clientProfile: true,
        // Campanhas vinculadas ao cliente
        clientCampaigns: {
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true,
            createdAt: true,
          },
        },
        // Buscar organizações associadas
        organizations: {
          select: {
            organization: {
              select: {
                id: true,
                name: true,
                website: true,
                country: true,
                _count: {
                  select: {
                    campaigns: true,
                  },
                },
                campaigns: {
                  select: {
                    id: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    // Mapear para o formato do frontend
    const clients = users.map((user) => {
      const profile = user.clientProfile
      const org = user.organizations[0]?.organization
      
      // Usar clientCampaigns (campanhas vinculadas ao cliente) ao invés de org.campaigns
      const totalCampaigns = user.clientCampaigns.length
      const activeCampaigns = user.clientCampaigns.filter((c) => c.status === "ACTIVE").length

      // Calcular total investido (mock - você pode adicionar lógica real aqui)
      const totalSpent = totalCampaigns * 50000 // R$ 50k por campanha (exemplo)

      return {
        id: user.id,
        name: user.name || profile?.fullName || null,
        email: user.email,
        imageUrl: user.imageUrl,
        phone: profile?.phone || null,
        company: profile?.company || org?.name || null,
        position: profile?.position || null,
        website: profile?.website || org?.website || null,
        country: profile?.country || org?.country || null,
        city: profile?.city || null,
        status: profile?.status || "PENDING",
        notes: profile?.notes || null,
        totalCampaigns,
        activeCampaigns,
        totalSpent,
        lastActivity: user.updatedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        campaigns: user.clientCampaigns || [],
        hasStore: user.hasStore,
        hasKiwifyStore: user.hasKiwifyStore,
      }
    })

    return clients
  }),

  // Get single client
  getById: privateProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // Buscar role do usuário no banco
      const dbUser = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { role: true },
      })

      // Apenas ADMIN e ORGANIZER_ADMIN podem ver clientes
      if (!dbUser || (dbUser.role !== "ADMIN" && dbUser.role !== "ORGANIZER_ADMIN")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para acessar esta funcionalidade",
        })
      }

      const user = await ctx.db.user.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          name: true,
          email: true,
          imageUrl: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          hasStore: true,
          hasKiwifyStore: true,
          clientProfile: true,
          // Campanhas vinculadas ao cliente
          clientCampaigns: {
            select: {
              id: true,
              name: true,
              status: true,
              startDate: true,
              endDate: true,
              createdAt: true,
            },
          },
          organizations: {
            include: {
              organization: {
                include: {
                  _count: {
                    select: {
                      campaigns: true,
                    },
                  },
                  campaigns: {
                    select: {
                      id: true,
                      name: true,
                      status: true,
                      startDate: true,
                      endDate: true,
                      createdAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      })

      if (!user || user.role !== "CLIENT") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cliente não encontrado",
        })
      }

      const profile = user.clientProfile
      const org = user.organizations[0]?.organization
      
      // Usar clientCampaigns (campanhas vinculadas ao cliente)
      const totalCampaigns = user.clientCampaigns.length
      const activeCampaigns = user.clientCampaigns.filter((c) => c.status === "ACTIVE").length
      const totalSpent = totalCampaigns * 50000

      return {
        id: user.id,
        name: user.name || profile?.fullName || null,
        email: user.email,
        imageUrl: user.imageUrl,
        phone: profile?.phone || null,
        company: profile?.company || org?.name || null,
        position: profile?.position || null,
        website: profile?.website || org?.website || null,
        country: profile?.country || org?.country || null,
        city: profile?.city || null,
        status: profile?.status || "PENDING",
        notes: profile?.notes || null,
        totalCampaigns,
        activeCampaigns,
        totalSpent,
        lastActivity: user.updatedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        campaigns: user.clientCampaigns || [],
        hasStore: user.hasStore,
        hasKiwifyStore: user.hasKiwifyStore,
      }
    }),

  // Create client
  create: privateProcedure
    .input(
      z.object({
        name: z.string().min(1, "Nome é obrigatório"),
        email: z.string().email("Email inválido"),
        password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
        phone: z.string().optional(),
        company: z.string().optional(),
        position: z.string().optional(),
        website: z.string().url("URL inválida").optional().or(z.literal("")),
        country: z.string().optional(),
        city: z.string().optional(),
        status: ClientStatusEnum.optional(),
        notes: z.string().optional(),
        hasStore: z.boolean().optional(),
        hasKiwifyStore: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Buscar role do usuário no banco
      const dbUser = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { role: true },
      })

      // Apenas ADMIN pode criar clientes
      if (!dbUser || dbUser.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para criar clientes",
        })
      }

      // Verificar se já existe um usuário com este email
      const existingUser = await ctx.db.user.findUnique({
        where: { email: input.email },
      })

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Já existe um usuário com este email",
        })
      }

      // 1. Criar usuário no Clerk primeiro
      let clerkUserId: string
      try {
        const clerk = await clerkClient()
        const clerkUser = await clerk.users.createUser({
          emailAddress: [input.email],
          password: input.password,
          firstName: input.name.split(" ")[0],
          lastName: input.name.split(" ").slice(1).join(" ") || undefined,
          publicMetadata: {
            role: "CLIENT",
          },
        })
        clerkUserId = clerkUser.id
      } catch (error: any) {
        console.error("Erro ao criar usuário no Clerk:", error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao criar usuário no sistema de autenticação",
        })
      }

      // 2. Criar o usuário no banco com o ID do Clerk
      const result = await ctx.db.$transaction(async (tx) => {
        // Criar o usuário com role CLIENT usando o ID do Clerk
        const user = await tx.user.create({
          data: {
            id: clerkUserId,
            email: input.email,
            name: input.name,
            role: "CLIENT",
            onboardingCompleted: true,
            hasStore: input.hasStore || false,
            hasKiwifyStore: input.hasKiwifyStore || false,
          },
        })

        // 2. Criar o ClientProfile
        const clientProfile = await tx.clientProfile.create({
          data: {
            userId: user.id,
            fullName: input.name,
            phone: input.phone || null,
            company: input.company || null,
            position: input.position || null,
            website: input.website || null,
            country: input.country || "Brasil",
            city: input.city || null,
            status: input.status || "PENDING",
            notes: input.notes || null,
          },
        })

        // 3. Se forneceu company, criar uma organização
        if (input.company) {
          const slug = input.company
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")

          await tx.organization.create({
            data: {
              name: input.company,
              slug: `${slug}-${Date.now()}`,
              website: input.website || null,
              country: input.country || null,
              members: {
                create: {
                  userId: user.id,
                  role: "OWNER",
                },
              },
            },
          })
        }

        return { user, clientProfile }
      })

      // Criar log de auditoria
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "CREATE",
          entityType: "Client",
          entityId: result.user.id,
          changes: {
            name: input.name,
            email: input.email,
            company: input.company,
          },
        },
      })

      return { success: true, clientId: result.user.id }
    }),

  // Update client
  update: privateProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres").optional().or(z.literal("")),
        phone: z.string().optional(),
        company: z.string().optional(),
        position: z.string().optional(),
        website: z.string().url("URL inválida").optional().or(z.literal("")),
        country: z.string().optional(),
        city: z.string().optional(),
        status: ClientStatusEnum.optional(),
        notes: z.string().optional(),
        hasStore: z.boolean().optional(),
        hasKiwifyStore: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Buscar role do usuário no banco
      const dbUser = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { role: true },
      })

      // Apenas ADMIN pode atualizar clientes
      if (!dbUser || dbUser.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para atualizar clientes",
        })
      }

      const user = await ctx.db.user.findUnique({
        where: { id: input.id },
        include: {
          clientProfile: true,
          organizations: {
            include: {
              organization: true,
            },
          },
        },
      })

      if (!user || user.role !== "CLIENT") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cliente não encontrado",
        })
      }

      // Se forneceu senha, atualizar no Clerk
      if (input.password) {
        try {
          const clerk = await clerkClient()
          await clerk.users.updateUser(input.id, {
            password: input.password,
          })
        } catch (error: any) {
          console.error("Erro ao atualizar senha no Clerk:", error)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao atualizar senha no sistema de autenticação",
          })
        }
      }

      // Atualizar em transação
      await ctx.db.$transaction(async (tx) => {
        // 1. Atualizar usuário
        const userUpdateData: any = {}
        if (input.name) userUpdateData.name = input.name
        if (input.hasStore !== undefined) userUpdateData.hasStore = input.hasStore
        if (input.hasKiwifyStore !== undefined) userUpdateData.hasKiwifyStore = input.hasKiwifyStore
        
        // Se hasStore for false, também desabilita hasKiwifyStore
        if (input.hasStore === false) {
          userUpdateData.hasKiwifyStore = false
        }
        
        if (Object.keys(userUpdateData).length > 0) {
          await tx.user.update({
            where: { id: input.id },
            data: userUpdateData,
          })
        }

        // 2. Atualizar ou criar ClientProfile
        if (user.clientProfile) {
          await tx.clientProfile.update({
            where: { userId: input.id },
            data: {
              fullName: input.name || user.clientProfile.fullName,
              phone: input.phone !== undefined ? input.phone : user.clientProfile.phone,
              company: input.company !== undefined ? input.company : user.clientProfile.company,
              position: input.position !== undefined ? input.position : user.clientProfile.position,
              website: input.website !== undefined ? (input.website || null) : user.clientProfile.website,
              country: input.country !== undefined ? input.country : user.clientProfile.country,
              city: input.city !== undefined ? input.city : user.clientProfile.city,
              status: input.status !== undefined ? input.status : user.clientProfile.status,
              notes: input.notes !== undefined ? input.notes : user.clientProfile.notes,
            },
          })
        } else {
          await tx.clientProfile.create({
            data: {
              userId: input.id,
              fullName: input.name || user.name || "",
              phone: input.phone || null,
              company: input.company || null,
              position: input.position || null,
              website: input.website || null,
              country: input.country || "Brasil",
              city: input.city || null,
              status: input.status || "PENDING",
              notes: input.notes || null,
            },
          })
        }

        // 3. Atualizar organização se existir
        const org = user.organizations[0]?.organization
        if (org && input.company) {
          await tx.organization.update({
            where: { id: org.id },
            data: {
              name: input.company,
              website: input.website || null,
              country: input.country || null,
            },
          })
        }
      })

      // Criar log de auditoria
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "UPDATE",
          entityType: "Client",
          entityId: input.id,
          changes: input,
        },
      })

      return { success: true }
    }),

  // Delete client
  delete: privateProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Buscar role do usuário no banco
      const dbUser = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { role: true },
      })

      // Apenas ADMIN pode deletar clientes
      if (!dbUser || dbUser.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para deletar clientes",
        })
      }

      const user = await ctx.db.user.findUnique({
        where: { id: input.id },
        include: {
          organizations: {
            include: {
              organization: {
                include: {
                  campaigns: true,
                },
              },
            },
          },
        },
      })

      if (!user || user.role !== "CLIENT") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cliente não encontrado",
        })
      }

      // Verificar se tem campanhas ativas
      const org = user.organizations[0]?.organization
      const hasActiveCampaigns = org?.campaigns.some((c) => c.status === "ACTIVE")

      if (hasActiveCampaigns) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Não é possível deletar um cliente com campanhas ativas",
        })
      }

      // Deletar usuário (cascata vai deletar as relações)
      await ctx.db.user.delete({
        where: { id: input.id },
      })

      // Criar log de auditoria
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "DELETE",
          entityType: "Client",
          entityId: input.id,
          changes: {
            email: user.email,
            name: user.name,
          },
        },
      })

      return { success: true }
    }),

  // Get client stats
  getStats: privateProcedure.query(async ({ ctx }) => {
    // Buscar role do usuário no banco
    const dbUser = await ctx.db.user.findUnique({
      where: { id: ctx.userId },
      select: { role: true },
    })

    // Apenas ADMIN e ORGANIZER_ADMIN podem ver stats
    if (!dbUser || (dbUser.role !== "ADMIN" && dbUser.role !== "ORGANIZER_ADMIN")) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Você não tem permissão para acessar esta funcionalidade",
      })
    }

    const totalClients = await ctx.db.user.count({
      where: { role: "CLIENT" },
    })

    const totalOrganizations = await ctx.db.organization.count()

    const totalCampaigns = await ctx.db.campaign.count()

    const activeCampaigns = await ctx.db.campaign.count({
      where: { status: "ACTIVE" },
    })

    return {
      totalClients,
      totalOrganizations,
      totalCampaigns,
      activeCampaigns,
    }
  }),

  // Get available campaigns (campaigns not linked to any client or linked to this client)
  getAvailableCampaigns: privateProcedure
    .input(z.object({ clientId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      // Buscar role do usuário no banco
      const dbUser = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { role: true },
      })

      // Apenas ADMIN pode ver campanhas disponíveis
      if (!dbUser || dbUser.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para acessar esta funcionalidade",
        })
      }

      // Buscar todas as campanhas ou apenas as disponíveis
      const campaigns = await ctx.db.campaign.findMany({
        where: {
          OR: [
            { clientId: null }, // Campanhas sem cliente
            { clientId: input.clientId }, // Campanhas já vinculadas a este cliente
          ],
        },
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
          endDate: true,
          clientId: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      return campaigns
    }),

  // Link campaigns to client
  linkCampaigns: privateProcedure
    .input(
      z.object({
        clientId: z.string(),
        campaignIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Buscar role do usuário no banco
      const dbUser = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { role: true },
      })

      // Apenas ADMIN pode vincular campanhas
      if (!dbUser || dbUser.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para vincular campanhas",
        })
      }

      // Verificar se o cliente existe
      const client = await ctx.db.user.findUnique({
        where: { id: input.clientId },
        select: { role: true },
      })

      if (!client || client.role !== "CLIENT") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cliente não encontrado",
        })
      }

      // Vincular campanhas ao cliente
      await ctx.db.campaign.updateMany({
        where: {
          id: { in: input.campaignIds },
        },
        data: {
          clientId: input.clientId,
        },
      })

      // Criar log de auditoria
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "UPDATE",
          entityType: "ClientCampaigns",
          entityId: input.clientId,
          changes: {
            action: "link",
            campaignIds: input.campaignIds,
          },
        },
      })

      return { success: true, linkedCount: input.campaignIds.length }
    }),

  // Unlink campaigns from client
  unlinkCampaigns: privateProcedure
    .input(
      z.object({
        clientId: z.string(),
        campaignIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Buscar role do usuário no banco
      const dbUser = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { role: true },
      })

      // Apenas ADMIN pode desvincular campanhas
      if (!dbUser || dbUser.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para desvincular campanhas",
        })
      }

      // Desvincular campanhas do cliente
      await ctx.db.campaign.updateMany({
        where: {
          id: { in: input.campaignIds },
          clientId: input.clientId,
        },
        data: {
          clientId: null,
        },
      })

      // Criar log de auditoria
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "UPDATE",
          entityType: "ClientCampaigns",
          entityId: input.clientId,
          changes: {
            action: "unlink",
            campaignIds: input.campaignIds,
          },
        },
      })

      return { success: true, unlinkedCount: input.campaignIds.length }
    }),

  // Get client dashboard data (campaigns with metrics)
  getDashboard: privateProcedure.query(async ({ ctx }) => {
    // Buscar role do usuário no banco
    const dbUser = await ctx.db.user.findUnique({
      where: { id: ctx.userId },
      select: { 
        role: true,
        hasStore: true,
        hasKiwifyStore: true,
      },
    })

    // Apenas CLIENT pode ver dashboard de cliente
    if (!dbUser || dbUser.role !== "CLIENT") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Você não tem permissão para acessar esta funcionalidade",
      })
    }

    // Buscar campanhas do cliente
    const campaigns = await ctx.db.campaign.findMany({
      where: {
        clientId: ctx.userId,
        status: {
          in: ["ACTIVE", "COMPLETED", "SCHEDULED"],
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        status: true,
        startDate: true,
        endDate: true,
        coverImageUrl: true,
        platforms: true,
        requiredHashtags: true,
        prizeInfo: true,
        _count: {
          select: {
            applications: {
              where: {
                status: "APPROVED",
              },
            },
            clipPosts: true, // ✅ Conta TODOS os posts, independente do status
          },
        },
      },
      orderBy: {
        startDate: "desc",
      },
    })

    // Para cada campanha, buscar métricas
    const campaignsWithMetrics = await Promise.all(
      campaigns.map(async (campaign) => {
        // ⚠️ FILTRO ESPECIAL: Competição Tarcísio De Freitas - Novembro
        // Apenas posts a partir de 07/11/2025 22:00 (horário de Brasília)
        const isTarcisioCompetition = campaign.slug === "tarcisio-de-freitas-novembro";
        const tarcisioStartDate = new Date("2025-11-07T22:00:00-03:00"); // 07/11/2025 22:00 BRT
        
        const postDateFilter = isTarcisioCompetition 
          ? { postedAt: { gte: tarcisioStartDate } }
          : {};
        
        // Buscar contagem real de posts (TODOS, independente do status)
        const totalPostsCount = isTarcisioCompetition 
          ? await ctx.db.clipPost.count({
              where: {
                campaignId: campaign.id,
                // ✅ Removido filtro de status - conta TODOS os posts
                ...postDateFilter,
              },
            })
          : await ctx.db.clipPost.count({
              where: {
                campaignId: campaign.id,
                // ✅ Removido filtro de status - conta TODOS os posts
              },
            });
        
        // Buscar métricas totais da campanha (TODOS os posts, independente do status)
        const metrics = await ctx.db.clipPost.aggregate({
          where: {
            campaignId: campaign.id,
            // ✅ Removido filtro de status - soma TODOS os posts
            ...postDateFilter,
          },
          _sum: {
            views: true,
            likes: true,
            comments: true,
            shares: true,
            saves: true,
          },
        })

        // Buscar crescimento nos últimos 7 dias (TODOS os posts, independente do status)
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        const recentMetrics = await ctx.db.clipPost.aggregate({
          where: {
            campaignId: campaign.id,
            // ✅ Removido filtro de status - soma TODOS os posts
            createdAt: {
              gte: sevenDaysAgo,
            },
            ...postDateFilter,
          },
          _sum: {
            views: true,
          },
        })

        // Crescimento acumulado por plataforma (do início ao fim da competição)
        const now = new Date()
        const growthStartDate = new Date(campaign.startDate)
        growthStartDate.setHours(0, 0, 0, 0)
        const growthEndDate = campaign.endDate < now ? new Date(campaign.endDate) : now
        growthEndDate.setHours(23, 59, 59, 999)

        const [postsInRange, allCampaignPlatforms] = await Promise.all([
          ctx.db.clipPost.findMany({
            where: {
              campaignId: campaign.id,
              createdAt: { gte: growthStartDate, lte: growthEndDate },
              ...(isTarcisioCompetition ? { postedAt: { gte: tarcisioStartDate } } : {}),
            },
            select: { platform: true, views: true, createdAt: true },
          }),
          ctx.db.clipPost.groupBy({
            by: ["platform"],
            where: {
              campaignId: campaign.id,
              ...(isTarcisioCompetition ? { postedAt: { gte: tarcisioStartDate } } : {}),
            },
            _sum: { views: true },
          }),
        ])

        const growthPlatforms = allCampaignPlatforms.map((p) => p.platform).sort()

        const totalDays = Math.ceil((growthEndDate.getTime() - growthStartDate.getTime()) / (1000 * 60 * 60 * 24))
        const dayMap = new Map<string, Record<string, number>>()
        for (let i = 0; i < totalDays; i++) {
          const d = new Date(growthStartDate)
          d.setDate(d.getDate() + i)
          const key = d.toISOString().slice(0, 10)
          const row: Record<string, number> = { total: 0 }
          growthPlatforms.forEach((p) => (row[p] = 0))
          dayMap.set(key, row)
        }

        for (const post of postsInRange) {
          const key = post.createdAt.toISOString().slice(0, 10)
          const row = dayMap.get(key)
          if (!row) continue
          const views = Number(post.views || 0)
          row.total = (row.total || 0) + views
          row[post.platform] = (row[post.platform] || 0) + views
        }

        const cumTotals: Record<string, number> = {}
        growthPlatforms.forEach((p) => (cumTotals[p] = 0))
        let cumTotal = 0

        const growthData = Array.from(dayMap.entries()).map(([date, row]) => {
          cumTotal += row.total || 0
          const entry: Record<string, number | string> = { total: cumTotal }
          for (const p of growthPlatforms) {
            cumTotals[p] = (cumTotals[p] || 0) + (row[p] || 0)
            entry[p] = cumTotals[p]!
          }
          return { date, ...entry }
        })

        // Buscar top posts da campanha - apenas vídeos elegíveis
        const topPosts = await ctx.db.clipPost.findMany({
          where: {
            campaignId: campaign.id,
            status: "ELIGIBLE",
            ...postDateFilter,
          },
          select: {
            id: true,
            username: true,
            submittedUrl: true,
            thumbnailUrl: true,
            platform: true,
            views: true,
            likes: true,
            comments: true,
            shares: true,
            saves: true,
            postedAt: true,
          },
          orderBy: {
            views: "desc",
          },
          take: 5,
        })

        // Buscar distribuição por plataforma
        const platformStats = await ctx.db.clipPost.groupBy({
          by: ["platform"],
          where: {
            campaignId: campaign.id,
            status: {
              not: "DISQUALIFIED",
            },
            ...postDateFilter,
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
        })

        // Buscar top accounts - APENAS vídeos elegíveis
        const topAccountsGrouped = await ctx.db.clipPost.groupBy({
          by: ["username"],
          where: {
            campaignId: campaign.id,
            username: { not: null },
            status: "ELIGIBLE",
            ...postDateFilter,
          },
          _sum: {
            views: true,
            likes: true,
            comments: true,
          },
          _count: {
            id: true,
          },
          orderBy: {
            _sum: {
              views: "desc",
            },
          },
          take: 5,
        })

        // Para cada top account, buscar a plataforma principal
        const topAccounts = await Promise.all(
          topAccountsGrouped.map(async (acc) => {
            const topPost = await ctx.db.clipPost.findFirst({
              where: {
                campaignId: campaign.id,
                username: acc.username,
                status: "ELIGIBLE",
                ...postDateFilter,
              },
              select: {
                platform: true,
              },
              orderBy: {
                views: "desc",
              },
            })

            return {
              username: acc.username || "",
              platform: topPost?.platform || "INSTAGRAM",
              totalViews: Number(acc._sum.views || 0),
              totalLikes: acc._sum.likes || 0,
              totalComments: acc._sum.comments || 0,
              postsCount: acc._count.id,
            }
          })
        )

        // Calcular engagement rate
        const totalViews = Number(metrics._sum.views || 0)
        const totalLikes = metrics._sum.likes || 0
        const totalComments = metrics._sum.comments || 0
        const totalShares = metrics._sum.shares || 0
        const totalSaves = metrics._sum.saves || 0
        const engagementRate = calculateEngagementRate(
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
          totalSaves
        )

        return {
          id: campaign.id,
          name: campaign.name,
          slug: campaign.slug,
          description: campaign.description,
          status: campaign.status,
          startDate: campaign.startDate.toISOString(),
          endDate: campaign.endDate.toISOString(),
          coverImageUrl: campaign.coverImageUrl,
          platforms: campaign.platforms,
          requiredHashtags: campaign.requiredHashtags,
          prizeInfo: campaign.prizeInfo,
          totalParticipants: campaign._count.applications,
          totalPosts: totalPostsCount, // Usa contagem filtrada se for Tarcísio
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
          totalSaves,
          engagementRate,
          recentViews: Number(recentMetrics._sum.views || 0),
          growthData,
          growthPlatforms,
          platformStats: platformStats.map((stat) => ({
            platform: stat.platform,
            totalViews: Number(stat._sum.views || 0),
            totalLikes: stat._sum.likes || 0,
            totalComments: stat._sum.comments || 0,
            totalShares: stat._sum.shares || 0,
            postsCount: stat._count.id,
          })),
          topPosts: topPosts.map((post) => ({
            id: post.id,
            username: post.username || "",
            url: post.submittedUrl,
            thumbnailUrl: post.thumbnailUrl,
            platform: post.platform,
            views: Number(post.views),
            likes: post.likes,
            comments: post.comments,
            shares: post.shares,
            postedAt: post.postedAt?.toISOString(),
          })),
          topAccounts,
        }
      })
    )

    return {
      campaigns: campaignsWithMetrics,
      hasStore: dbUser.hasStore,
      hasKiwifyStore: dbUser.hasKiwifyStore,
    }
  }),

  // ============================================================================
  // POSTS - LISTAGEM PARA CLIENTE
  // ============================================================================

  getAllPosts: privateProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(24),
        platform: z.enum(["INSTAGRAM", "TIKTOK", "YOUTUBE", "KWAI", "FACEBOOK", "ALL"]).optional(),
        status: z.enum(["PENDING", "ELIGIBLE", "INELIGIBLE", "DISQUALIFIED", "ALL"]).optional(),
        campaignId: z.string().optional(),
        search: z.string().optional(), // Buscar por username
        orderBy: z.enum(["views", "likes", "comments", "shares", "createdAt"]).default("views"),
        orderDirection: z.enum(["asc", "desc"]).default("desc"),
      })
    )
    .query(async ({ ctx, input }) => {
      // Buscar role do usuário no banco
      const dbUser = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { role: true },
      })

      // Apenas CLIENT pode ver posts
      if (!dbUser || dbUser.role !== "CLIENT") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para acessar esta funcionalidade",
        })
      }

      const { page, limit, platform, status, campaignId, search, orderBy, orderDirection } = input
      const skip = (page - 1) * limit

      // Buscar campanhas do cliente
      const clientCampaigns = await ctx.db.campaign.findMany({
        where: {
          clientId: ctx.userId,
        },
        select: {
          id: true,
          name: true,
          slug: true,
        },
        orderBy: { createdAt: "desc" },
      })

      const clientCampaignIds = clientCampaigns.map((c) => c.id)

      // Se não tem campanhas, retornar vazio
      if (clientCampaignIds.length === 0) {
        return {
          posts: [],
          total: 0,
          totalPages: 0,
          currentPage: page,
          campaigns: [],
        }
      }

      // ⚠️ FILTRO ESPECIAL: Competição Tarcísio De Freitas - Novembro
      // Apenas posts a partir de 07/11/2025 22:00 (horário de Brasília)
      const tarcisioStartDate = new Date("2025-11-07T22:00:00-03:00"); // 07/11/2025 22:00 BRT
      
      // Verificar se está filtrando especificamente pela campanha do Tarcísio
      let isTarcisioCompetition = false;
      if (campaignId) {
        const campaign = clientCampaigns.find(c => c.id === campaignId);
        isTarcisioCompetition = campaign?.slug === "tarcisio-de-freitas-novembro";
      }

      const where: any = {
        campaignId: {
          in: clientCampaignIds,
        },
      }

      // Aplicar filtro de data se for a competição do Tarcísio
      if (isTarcisioCompetition) {
        where.postedAt = { gte: tarcisioStartDate };
      }

      if (platform && platform !== "ALL") {
        where.platform = platform
      }

      // ✅ Filtro de status: Se status é "ALL", exclui apenas DISQUALIFIED
      // Se status específico, usa o filtro do usuário
      if (status && status !== "ALL") {
        where.status = status
      } else {
        // Por padrão, NÃO mostrar posts desqualificados
        where.status = {
          not: "DISQUALIFIED"
        }
      }

      if (campaignId) {
        where.campaignId = campaignId
      }

      if (search) {
        where.username = { contains: search, mode: "insensitive" as const }
      }

      const [posts, total] = await Promise.all([
        ctx.db.clipPost.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            [orderBy]: orderDirection,
          },
          select: {
            id: true,
            submittedUrl: true,
            thumbnailUrl: true,
            platform: true,
            username: true,
            caption: true,
            views: true,
            likes: true,
            comments: true,
            shares: true,
            saves: true,
            postedAt: true,
            status: true,
            createdAt: true,
            campaign: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            application: {
              select: {
                clipperProfile: {
                  select: {
                    artisticName: true,
                    fullName: true,
                    user: {
                      select: {
                        imageUrl: true,
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        ctx.db.clipPost.count({ where }),
      ])

      const formattedPosts = posts.map((post) => ({
        id: post.id,
        url: post.submittedUrl,
        thumbnail: post.thumbnailUrl,
        platform: post.platform,
        username: post.username || "",
        caption: post.caption || "",
        clipperName: post.application?.clipperProfile?.artisticName || post.application?.clipperProfile?.fullName || "Clipador",
        clipperImage: post.application?.clipperProfile?.user?.imageUrl || null,
        views: Number(post.views),
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        saves: post.saves ?? 0,
        postedAt: post.postedAt?.toISOString(),
        status: post.status,
        createdAt: post.createdAt.toISOString(),
        campaign: post.campaign,
      }))

      return {
        posts: formattedPosts,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        campaigns: clientCampaigns, // Lista de campanhas do cliente para o filtro
      }
    }),

  getPostById: privateProcedure
    .input(z.object({ postId: z.string() }))
    .query(async ({ ctx, input }) => {
      const dbUser = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { role: true },
      })

      if (!dbUser || dbUser.role !== "CLIENT") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para acessar esta funcionalidade",
        })
      }

      const post = await ctx.db.clipPost.findUnique({
        where: { id: input.postId },
        select: {
          id: true,
          submittedUrl: true,
          normalizedUrl: true,
          platformVideoId: true,
          thumbnailUrl: true,
          platform: true,
          username: true,
          caption: true,
          hashtags: true,
          mentions: true,
          duration: true,
          postedAt: true,
          views: true,
          likes: true,
          comments: true,
          shares: true,
          saves: true,
          status: true,
          hasRequiredHashtags: true,
          hasRequiredMentions: true,
          isPublicProfile: true,
          hasDuplicates: true,
          ineligibilityReason: true,
          lastMetricsUpdate: true,
          createdAt: true,
          updatedAt: true,
          locationName: true,
          campaign: {
            select: {
              id: true,
              name: true,
              slug: true,
              clientId: true,
            },
          },
          application: {
            select: {
              clipperProfile: {
                select: {
                  artisticName: true,
                  fullName: true,
                  user: {
                    select: {
                      imageUrl: true,
                    },
                  },
                },
              },
            },
          },
          metricsHistory: {
            orderBy: { collectedAt: "desc" },
            select: {
              id: true,
              collectedAt: true,
              views: true,
              likes: true,
              comments: true,
              shares: true,
              saves: true,
              engagementRate: true,
              velocity24h: true,
              viewsDelta: true,
              likesDelta: true,
              commentsDelta: true,
              sharesDelta: true,
            },
          },
        },
      })

      if (!post) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Post não encontrado" })
      }

      if (post.campaign.clientId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para acessar este post" })
      }

      const engagementRate = calculateEngagementRate(
        Number(post.views),
        post.likes,
        post.comments,
        post.shares,
        post.saves ?? 0
      )

      return {
        id: post.id,
        url: post.submittedUrl,
        normalizedUrl: post.normalizedUrl,
        platformVideoId: post.platformVideoId,
        thumbnail: post.thumbnailUrl,
        platform: post.platform,
        username: post.username || "",
        caption: post.caption || "",
        hashtags: post.hashtags,
        mentions: post.mentions,
        duration: post.duration,
        postedAt: post.postedAt?.toISOString() ?? null,
        views: Number(post.views),
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        saves: post.saves ?? 0,
        status: post.status,
        hasRequiredHashtags: post.hasRequiredHashtags,
        hasRequiredMentions: post.hasRequiredMentions,
        isPublicProfile: post.isPublicProfile,
        hasDuplicates: post.hasDuplicates,
        ineligibilityReason: post.ineligibilityReason,
        lastMetricsUpdate: post.lastMetricsUpdate?.toISOString() ?? null,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        locationName: post.locationName,
        engagementRate,
        clipperName:
          post.application?.clipperProfile?.artisticName ||
          post.application?.clipperProfile?.fullName ||
          "Clipador",
        clipperImage: post.application?.clipperProfile?.user?.imageUrl || null,
        campaign: {
          id: post.campaign.id,
          name: post.campaign.name,
          slug: post.campaign.slug,
        },
        metricsHistory: post.metricsHistory.map((m) => ({
          id: m.id,
          collectedAt: m.collectedAt.toISOString(),
          views: Number(m.views),
          likes: m.likes,
          comments: m.comments,
          shares: m.shares,
          saves: m.saves ?? 0,
          engagementRate: m.engagementRate,
          velocity24h: m.velocity24h,
          viewsDelta: m.viewsDelta != null ? Number(m.viewsDelta) : null,
          likesDelta: m.likesDelta,
          commentsDelta: m.commentsDelta,
          sharesDelta: m.sharesDelta,
        })),
      }
    }),

  /** Histórico de ClipPostMetrics para gráfico na lista — carrega sob demanda. */
  getPostMetricsHistory: privateProcedure
    .input(z.object({ postId: z.string() }))
    .query(async ({ ctx, input }) => {
      const dbUser = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { role: true },
      })

      if (!dbUser || dbUser.role !== "CLIENT") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para acessar esta funcionalidade",
        })
      }

      const post = await ctx.db.clipPost.findUnique({
        where: { id: input.postId },
        select: {
          id: true,
          username: true,
          campaign: {
            select: {
              clientId: true,
              rankingMetricType: true,
              name: true,
            },
          },
        },
      })

      if (!post) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Post não encontrado" })
      }

      if (post.campaign.clientId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para acessar este post" })
      }

      const metricType = post.campaign.rankingMetricType as RankingMetricType

      const rows = await ctx.db.clipPostMetrics.findMany({
        where: { clipPostId: input.postId },
        orderBy: { collectedAt: "asc" },
        select: {
          id: true,
          collectedAt: true,
          views: true,
          likes: true,
          comments: true,
          shares: true,
          saves: true,
          viewsDelta: true,
          likesDelta: true,
          commentsDelta: true,
          sharesDelta: true,
        },
      })

      const points = rows.map((m) => {
        const views = Number(m.views)
        const likes = m.likes
        const comments = m.comments
        const shares = m.shares
        const saves = m.saves ?? 0
        const engagementRate = calculateEngagementRate(views, likes, comments, shares, saves)
        const rankingScore = calculateRankingScore(metricType, views, likes, comments, shares, saves)
        return {
          id: m.id,
          collectedAt: m.collectedAt.toISOString(),
          views,
          likes,
          comments,
          shares,
          saves,
          engagementRate,
          rankingScore,
          viewsDelta: m.viewsDelta != null ? Number(m.viewsDelta) : null,
          likesDelta: m.likesDelta,
          commentsDelta: m.commentsDelta,
          sharesDelta: m.sharesDelta,
        }
      })

      return {
        metricType: post.campaign.rankingMetricType,
        campaignName: post.campaign.name,
        username: post.username || "",
        points,
      }
    }),

  // ============================================================================
  // VENDAS KIWIFY - CONFIGURAÇÃO E DASHBOARD
  // ============================================================================

  // Verificar status da configuração Kiwify
  getKiwifyStatus: privateProcedure.query(async ({ ctx }) => {
    const dbUser = await ctx.db.user.findUnique({
      where: { id: ctx.userId },
      select: {
        role: true,
        hasStore: true,
        hasKiwifyStore: true,
        kiwifyClientId: true,
        kiwifySecretKey: true,
        kiwifyAccountId: true,
      },
    })

    if (!dbUser || dbUser.role !== "CLIENT") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Você não tem permissão para acessar esta funcionalidade",
      })
    }

    const isConfigured = !!(
      dbUser.hasStore &&
      dbUser.hasKiwifyStore &&
      dbUser.kiwifyClientId &&
      dbUser.kiwifySecretKey &&
      dbUser.kiwifyAccountId
    )

    return {
      hasStore: dbUser.hasStore,
      hasKiwifyStore: dbUser.hasKiwifyStore,
      isConfigured,
      hasClientId: !!dbUser.kiwifyClientId,
      hasSecretKey: !!dbUser.kiwifySecretKey,
      hasAccountId: !!dbUser.kiwifyAccountId,
    }
  }),

  // Salvar credenciais Kiwify
  saveKiwifyCredentials: privateProcedure
    .input(
      z.object({
        kiwifyClientId: z.string().min(1, "Client ID é obrigatório"),
        kiwifySecretKey: z.string().min(1, "Secret Key é obrigatória"),
        kiwifyAccountId: z.string().min(1, "Account ID é obrigatório"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const dbUser = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { role: true, hasStore: true, hasKiwifyStore: true },
      })

      if (!dbUser || dbUser.role !== "CLIENT") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para acessar esta funcionalidade",
        })
      }

      if (!dbUser.hasStore || !dbUser.hasKiwifyStore) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Sua conta não está configurada para usar a Kiwify",
        })
      }

      // Testar as credenciais antes de salvar
      try {
        // Kiwify Public API v1 - enviar client_id e client_secret no body
        const tokenResponse = await fetch("https://public-api.kiwify.com/v1/oauth/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: input.kiwifyClientId,
            client_secret: input.kiwifySecretKey,
          }),
        })

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text()
          console.error("Erro ao validar credenciais Kiwify:", errorText)
          
          // Mensagem mais específica baseada no erro
          let message = "Credenciais inválidas. Verifique o Client ID e Secret Key."
          if (errorText.includes("TOKEN_INVALID") || errorText.includes("invalid_client")) {
            message = "Client ID ou Secret Key inválidos. Verifique as credenciais no painel da Kiwify."
          } else if (errorText.includes("unauthorized")) {
            message = "Credenciais não autorizadas. Verifique se a API Key está ativa."
          }
          
          throw new TRPCError({
            code: "BAD_REQUEST",
            message,
          })
        }

        const tokenData = await tokenResponse.json()
        const accessToken = tokenData.access_token

        // Testar o Account ID fazendo uma requisição simples para listar vendas
        // end_date precisa ser maior que start_date
        const today = new Date()
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        const startDate = yesterday.toISOString().split("T")[0]
        const endDate = today.toISOString().split("T")[0]
        
        const testResponse = await fetch(
          `https://public-api.kiwify.com/v1/sales?start_date=${startDate}&end_date=${endDate}&page_size=1`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "x-kiwify-account-id": input.kiwifyAccountId,
            },
          }
        )

        if (!testResponse.ok) {
          const errorText = await testResponse.text()
          console.error("Erro ao validar Account ID Kiwify:", errorText)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Account ID inválido. Verifique o ID da conta no painel da Kiwify.",
          })
        }
      } catch (error: any) {
        if (error instanceof TRPCError) {
          throw error
        }
        console.error("Erro ao validar credenciais:", error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao validar credenciais. Tente novamente.",
        })
      }

      // Salvar credenciais
      await ctx.db.user.update({
        where: { id: ctx.userId },
        data: {
          kiwifyClientId: input.kiwifyClientId,
          kiwifySecretKey: input.kiwifySecretKey,
          kiwifyAccountId: input.kiwifyAccountId,
        },
      })

      return { success: true, message: "Credenciais salvas com sucesso!" }
    }),

  getSales: privateProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
        status: z.enum([
          "approved", "authorized", "chargedback", "paid", "pending",
          "pending_refund", "processing", "refunded", "refund_requested",
          "refused", "waiting_payment", "all"
        ]).optional(),
        paymentMethod: z.enum(["boleto", "credit_card", "pix", "all"]).optional(),
        productId: z.string().optional(),
        pageSize: z.number().min(1).max(100).default(50),
        pageNumber: z.number().min(1).default(1),
      })
    )
    .query(async ({ ctx, input }) => {
      // Buscar dados do usuário
      const dbUser = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: {
          role: true,
          hasStore: true,
          hasKiwifyStore: true,
          kiwifyClientId: true,
          kiwifySecretKey: true,
          kiwifyAccountId: true,
        },
      })

      // Apenas CLIENT com loja Kiwify pode ver vendas
      if (!dbUser || dbUser.role !== "CLIENT") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para acessar esta funcionalidade",
        })
      }

      if (!dbUser.hasStore || !dbUser.hasKiwifyStore) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Sua conta não possui loja Kiwify configurada",
        })
      }

      if (!dbUser.kiwifyClientId || !dbUser.kiwifySecretKey || !dbUser.kiwifyAccountId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Credenciais da Kiwify não configuradas. Entre em contato com o suporte.",
        })
      }

      try {
        // Obter token de acesso da Kiwify Public API v1
        const tokenResponse = await fetch("https://public-api.kiwify.com/v1/oauth/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: dbUser.kiwifyClientId,
            client_secret: dbUser.kiwifySecretKey,
          }),
        })

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text()
          console.error("Erro ao obter token Kiwify:", errorText)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao autenticar com a Kiwify. Verifique suas credenciais.",
          })
        }

        const tokenData = await tokenResponse.json()
        const accessToken = tokenData.access_token

        // Construir URL com parâmetros
        const params = new URLSearchParams({
          start_date: input.startDate,
          end_date: input.endDate,
          page_size: input.pageSize.toString(),
          page_number: input.pageNumber.toString(),
          view_full_sale_details: "true",
        })

        if (input.status && input.status !== "all") {
          params.append("status", input.status)
        }

        if (input.paymentMethod && input.paymentMethod !== "all") {
          params.append("payment_method", input.paymentMethod)
        }

        if (input.productId) {
          params.append("product_id", input.productId)
        }

        // Buscar vendas, estatísticas e todas as vendas pagas em paralelo
        const statsParams = new URLSearchParams({
          start_date: input.startDate,
          end_date: input.endDate,
        })

        // Parâmetros para buscar todas as vendas pagas (para calcular receita total)
        const paidSalesParams = new URLSearchParams({
          start_date: input.startDate,
          end_date: input.endDate,
          status: "paid",
          page_size: "100", // Buscar mais para calcular receita
          page_number: "1",
        })

        // Parâmetros para buscar vendas reembolsadas
        const refundedSalesParams = new URLSearchParams({
          start_date: input.startDate,
          end_date: input.endDate,
          status: "refunded",
          page_size: "1",
          page_number: "1",
        })

        // Parâmetros para buscar vendas pendentes
        const pendingSalesParams = new URLSearchParams({
          start_date: input.startDate,
          end_date: input.endDate,
          status: "waiting_payment",
          page_size: "1",
          page_number: "1",
        })

        const [salesResponse, statsResponse, paidSalesResponse, refundedSalesResponse, pendingSalesResponse] = await Promise.all([
          // Buscar vendas da Kiwify Public API v1 (paginada para tabela)
          fetch(`https://public-api.kiwify.com/v1/sales?${params}`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "x-kiwify-account-id": dbUser.kiwifyAccountId,
            },
          }),
          // Buscar estatísticas consolidadas do período
          fetch(`https://public-api.kiwify.com/v1/stats?${statsParams}`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "x-kiwify-account-id": dbUser.kiwifyAccountId,
            },
          }),
          // Buscar vendas pagas para calcular receita total
          fetch(`https://public-api.kiwify.com/v1/sales?${paidSalesParams}`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "x-kiwify-account-id": dbUser.kiwifyAccountId,
            },
          }),
          // Buscar contagem de vendas reembolsadas
          fetch(`https://public-api.kiwify.com/v1/sales?${refundedSalesParams}`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "x-kiwify-account-id": dbUser.kiwifyAccountId,
            },
          }),
          // Buscar contagem de vendas pendentes
          fetch(`https://public-api.kiwify.com/v1/sales?${pendingSalesParams}`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "x-kiwify-account-id": dbUser.kiwifyAccountId,
            },
          }),
        ])

        if (!salesResponse.ok) {
          console.error("Erro ao buscar vendas Kiwify:", await salesResponse.text())
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao buscar vendas da Kiwify",
          })
        }

        const salesData = await salesResponse.json()
        
        // Processar estatísticas (pode falhar silenciosamente)
        let statsData: {
          total_sales?: number
          total_net_amount?: number
          refund_rate?: number
          chargeback_rate?: number
          credit_card_approval_rate?: number
          total_boleto_generated?: number
          total_boleto_paid?: number
          boleto_rate?: number
        } = {}
        
        if (statsResponse.ok) {
          statsData = await statsResponse.json()
        } else {
          console.warn("Erro ao buscar estatísticas Kiwify:", await statsResponse.text())
        }

        // Processar vendas pagas para calcular receita total
        let allPaidSalesData: any[] = []
        let totalPaidCount = 0
        
        if (paidSalesResponse.ok) {
          const paidData = await paidSalesResponse.json()
          allPaidSalesData = paidData.data || []
          totalPaidCount = paidData.pagination?.count || allPaidSalesData.length
          
          // Se há mais páginas de vendas pagas, buscar todas
          const totalPages = Math.ceil(totalPaidCount / 100)
          if (totalPages > 1) {
            const additionalRequests = []
            for (let page = 2; page <= Math.min(totalPages, 10); page++) { // Limitar a 10 páginas (1000 vendas)
              const pageParams = new URLSearchParams({
                start_date: input.startDate,
                end_date: input.endDate,
                status: "paid",
                page_size: "100",
                page_number: page.toString(),
              })
              additionalRequests.push(
                fetch(`https://public-api.kiwify.com/v1/sales?${pageParams}`, {
                  method: "GET",
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "x-kiwify-account-id": dbUser.kiwifyAccountId,
                  },
                })
              )
            }
            
            const additionalResponses = await Promise.all(additionalRequests)
            for (const resp of additionalResponses) {
              if (resp.ok) {
                const data = await resp.json()
                allPaidSalesData = [...allPaidSalesData, ...(data.data || [])]
              }
            }
          }
        }
        
        // Calcular receita total a partir das vendas pagas
        const calculatedTotalRevenue = allPaidSalesData.reduce(
          (sum: number, sale: any) => sum + (sale.net_amount || 0), 
          0
        )

        // Processar contagem de vendas reembolsadas
        let refundedCount = 0
        if (refundedSalesResponse.ok) {
          const refundedData = await refundedSalesResponse.json()
          refundedCount = refundedData.pagination?.count || 0
        }

        // Processar contagem de vendas pendentes
        let pendingCount = 0
        if (pendingSalesResponse.ok) {
          const pendingData = await pendingSalesResponse.json()
          pendingCount = pendingData.pagination?.count || 0
        }

        // Processar e retornar dados
        const sales = salesData.data || []
        const pagination = salesData.pagination || { count: 0, page_number: 1, page_size: 50 }

        // Usar estatísticas da API para contagem, mas receita calculada das vendas
        const totalSalesFromStats = statsData.total_sales ?? 0
        const refundRate = statsData.refund_rate ?? 0
        const chargebackRate = statsData.chargeback_rate ?? 0
        
        console.log("📈 Métricas processadas:", { 
          totalSalesFromStats, 
          totalPaidCount,
          calculatedTotalRevenue: calculatedTotalRevenue / 100,
          refundRate, 
          chargebackRate 
        })

        // Métricas da página atual (para contagem local)
        const paidSales = sales.filter((s: any) => s.status === "paid")
        const refundedSales = sales.filter((s: any) => s.status === "refunded" || s.status === "chargedback")
        const pendingSales = sales.filter((s: any) => s.status === "waiting_payment" || s.status === "pending")

        // Agrupar vendas por dia para gráfico (usando TODAS as vendas pagas do período)
        // Converter para fuso horário de Brasília (America/Sao_Paulo)
        const salesByDate: Record<string, { count: number; revenue: number }> = {}
        allPaidSalesData.forEach((sale: any) => {
          // Usar toLocaleString para converter para o fuso brasileiro
          const saleDate = new Date(sale.created_at)
          const brazilDate = saleDate.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) // Formato yyyy-MM-dd
          if (brazilDate) {
            if (!salesByDate[brazilDate]) {
              salesByDate[brazilDate] = { count: 0, revenue: 0 }
            }
            salesByDate[brazilDate].count += 1
            salesByDate[brazilDate].revenue += sale.net_amount || 0
          }
        })

        const chartData = Object.entries(salesByDate)
          .map(([date, data]) => ({
            date,
            vendas: data.count,
            receita: data.revenue / 100, // Converter centavos para reais
          }))
          .sort((a, b) => a.date.localeCompare(b.date))

        // Agrupar por método de pagamento (usando TODAS as vendas pagas do período)
        const salesByPaymentMethod: Record<string, number> = {}
        allPaidSalesData.forEach((sale: any) => {
          const method = sale.payment_method || "other"
          salesByPaymentMethod[method] = (salesByPaymentMethod[method] || 0) + 1
        })

        // Agrupar por produto (usando TODAS as vendas pagas do período)
        const salesByProduct: Record<string, { count: number; revenue: number; name: string }> = {}
        allPaidSalesData.forEach((sale: any) => {
          const productId = sale.product?.id || "unknown"
          const productName = sale.product?.name || "Produto"
          if (!salesByProduct[productId]) {
            salesByProduct[productId] = { count: 0, revenue: 0, name: productName }
          }
          salesByProduct[productId].count += 1
          salesByProduct[productId].revenue += sale.net_amount || 0
        })

        const productStats = Object.entries(salesByProduct)
          .map(([id, data]) => ({
            id,
            name: data.name,
            count: data.count,
            revenue: data.revenue / 100,
          }))
          .sort((a, b) => b.revenue - a.revenue)

        return {
          sales: sales.map((sale: any) => ({
            id: sale.id,
            reference: sale.reference,
            status: sale.status,
            paymentMethod: sale.payment_method,
            netAmount: (sale.net_amount || 0) / 100, // Converter centavos para reais
            currency: sale.currency || "BRL",
            createdAt: sale.created_at,
            updatedAt: sale.updated_at,
            product: sale.product ? {
              id: sale.product.id,
              name: sale.product.name,
            } : null,
            customer: sale.customer ? {
              id: sale.customer.id,
              name: sale.customer.name,
              email: sale.customer.email,
            } : null,
          })),
          pagination: {
            total: pagination.count,
            pageNumber: pagination.page_number,
            pageSize: pagination.page_size,
            totalPages: Math.ceil(pagination.count / pagination.page_size),
          },
          metrics: {
            // Estatísticas consolidadas do período inteiro
            totalSales: totalSalesFromStats,
            // Receita calculada a partir das vendas pagas
            totalRevenue: calculatedTotalRevenue / 100, // Converter centavos para reais
            // Ticket médio baseado nas vendas pagas
            averageTicket: totalPaidCount > 0 ? (calculatedTotalRevenue / totalPaidCount) / 100 : 0,
            paidSalesCount: totalPaidCount,
            refundRate,
            chargebackRate,
            // Contagens do período completo (não apenas da página atual)
            paidSales: totalPaidCount,
            refundedCount: refundedCount,
            pendingCount: pendingCount,
          },
          chartData,
          paymentMethodStats: Object.entries(salesByPaymentMethod).map(([method, count]) => ({
            method,
            count,
          })),
          productStats,
        }
      } catch (error: any) {
        console.error("Erro ao buscar vendas:", error)
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao buscar vendas",
        })
      }
    }),

  // Buscar afiliados usando a API oficial da Kiwify
  getAffiliates: privateProcedure
    .input(
      z.object({
        pageSize: z.number().min(1).max(100).default(50),
        pageNumber: z.number().min(1).default(1),
        status: z.enum(["active", "inactive", "all"]).optional(),
        productId: z.string().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Verificar se usuário é CLIENT
        const dbUser = await ctx.db.user.findUnique({
          where: { id: ctx.userId },
          select: {
            id: true,
            role: true,
            hasStore: true,
            hasKiwifyStore: true,
            kiwifyClientId: true,
            kiwifySecretKey: true,
            kiwifyAccountId: true,
          },
        })

        if (!dbUser) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Usuário não encontrado",
          })
        }

        if (dbUser.role !== "CLIENT") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Acesso negado",
          })
        }

        if (!dbUser.kiwifyClientId || !dbUser.kiwifySecretKey || !dbUser.kiwifyAccountId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Credenciais Kiwify não configuradas",
          })
        }

        // Obter token de acesso
        const tokenResponse = await fetch("https://public-api.kiwify.com/v1/oauth/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: dbUser.kiwifyClientId,
            client_secret: dbUser.kiwifySecretKey,
          }),
        })

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text()
          console.error("Erro ao obter token Kiwify:", errorText)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao autenticar com Kiwify",
          })
        }

        const tokenData = await tokenResponse.json()
        const accessToken = tokenData.access_token

        // Construir parâmetros da query
        const params = new URLSearchParams({
          page_size: input.pageSize.toString(),
          page_number: input.pageNumber.toString(),
        })

        if (input.status && input.status !== "all") {
          params.append("status", input.status)
        }

        if (input.productId) {
          params.append("product_id", input.productId)
        }

        if (input.search) {
          params.append("search", input.search)
        }

        // Buscar afiliados da API oficial da Kiwify
        const affiliatesResponse = await fetch(`https://public-api.kiwify.com/v1/affiliates?${params}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "x-kiwify-account-id": dbUser.kiwifyAccountId,
          },
        })

        if (!affiliatesResponse.ok) {
          const errorText = await affiliatesResponse.text()
          console.error("Erro ao buscar afiliados Kiwify:", errorText)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao buscar afiliados da Kiwify",
          })
        }

        const affiliatesData = await affiliatesResponse.json()
        const affiliates = affiliatesData.data || []
        const pagination = affiliatesData.pagination || { count: 0, page_number: 1, page_size: 50 }

        // Mapear dados para o formato do frontend
        const formattedAffiliates = affiliates.map((affiliate: any) => ({
          id: affiliate.affiliate_id,
          name: affiliate.name || "Afiliado",
          email: affiliate.email || "",
          companyName: affiliate.company_name || "",
          cpf: affiliate.director_cpf || "",
          cnpj: affiliate.company_cnpj || "",
          product: affiliate.product ? {
            id: affiliate.product.id,
            name: affiliate.product.name,
          } : null,
          commission: (affiliate.commission || 0) / 100, // Converter centavos para porcentagem (4600 = 46%)
          status: affiliate.status || "inactive",
          createdAt: affiliate.created_at,
        }))

        // Calcular métricas
        const totalAffiliates = pagination.count || affiliates.length
        const activeAffiliates = formattedAffiliates.filter((a: any) => a.status === "active").length
        const totalCommissions = formattedAffiliates.reduce((sum: number, a: any) => sum + a.commission, 0)
        const averageCommission = formattedAffiliates.length > 0 ? totalCommissions / formattedAffiliates.length : 0

        // Buscar também as vendas para ter dados de performance dos afiliados
        // Vamos fazer isso em paralelo para vendas dos últimos 30 dias
        const today = new Date()
        const thirtyDaysAgo = new Date(today)
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        
        const salesParams = new URLSearchParams({
          start_date: thirtyDaysAgo.toISOString().split("T")[0] || "",
          end_date: today.toISOString().split("T")[0] || "",
          status: "paid",
          page_size: "100",
          page_number: "1",
        })

        // Buscar vendas com afiliados para calcular performance
        const salesResponse = await fetch(`https://public-api.kiwify.com/v1/sales?${salesParams}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "x-kiwify-account-id": dbUser.kiwifyAccountId,
          },
        })

        // Processar vendas por afiliado
        const affiliateSalesMap: Record<string, { salesCount: number; totalRevenue: number; totalCommission: number }> = {}
        
        if (salesResponse.ok) {
          const salesData = await salesResponse.json()
          const sales = salesData.data || []
          
          sales.forEach((sale: any) => {
            if (sale.affiliate?.document) {
              const affiliateDoc = sale.affiliate.document
              if (!affiliateSalesMap[affiliateDoc]) {
                affiliateSalesMap[affiliateDoc] = { salesCount: 0, totalRevenue: 0, totalCommission: 0 }
              }
              affiliateSalesMap[affiliateDoc].salesCount += 1
              affiliateSalesMap[affiliateDoc].totalRevenue += (sale.net_amount || 0) / 100
              affiliateSalesMap[affiliateDoc].totalCommission += (sale.affiliate_amount || 0) / 100
            }
          })
        }

        // Enriquecer dados dos afiliados com performance de vendas
        const enrichedAffiliates = formattedAffiliates.map((affiliate: any) => {
          const salesData = affiliateSalesMap[affiliate.cpf] || affiliateSalesMap[affiliate.cnpj] || { salesCount: 0, totalRevenue: 0, totalCommission: 0 }
          return {
            ...affiliate,
            salesCount: salesData.salesCount,
            totalRevenue: salesData.totalRevenue,
            earnedCommission: salesData.totalCommission,
          }
        })

        // Ordenar por vendas (maior primeiro)
        enrichedAffiliates.sort((a: any, b: any) => b.salesCount - a.salesCount)

        // Calcular total de vendas por afiliados
        const totalSales = Object.values(affiliateSalesMap).reduce((sum, a) => sum + a.salesCount, 0)
        const totalEarnedCommissions = Object.values(affiliateSalesMap).reduce((sum, a) => sum + a.totalCommission, 0)

        return {
          affiliates: enrichedAffiliates,
          totalAffiliates,
          activeAffiliates,
          totalSales,
          totalCommissions: totalEarnedCommissions,
          averageCommission: totalSales > 0 ? totalEarnedCommissions / totalSales : 0,
          pagination: {
            pageNumber: pagination.page_number,
            pageSize: pagination.page_size,
            total: pagination.count,
            totalPages: Math.ceil(pagination.count / pagination.page_size),
          },
        }
      } catch (error: any) {
        console.error("Erro ao buscar afiliados:", error)
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro ao buscar afiliados",
        })
      }
    }),
})
