import { z } from "zod"
import { createTRPCRouter, privateProcedure } from "@/server/api/trpc"
import { TRPCError } from "@trpc/server"
import { clerkClient } from "@clerk/nextjs/server"
import {
  calculateEngagementRate,
  calculateRankingScore,
  type RankingMetricType,
} from "@/lib/ranking-helpers"
import { getCampaignPerformance } from "@/server/performance/get-campaign-performance"
import { aggregateCampaignPerformance } from "@/server/performance/aggregate-campaign-performance"
import { hasInvestedAmountInEveryCampaign } from "@/server/performance/visibility"
import {
  getCampaignDashboardMetrics,
  getCampaignTotals,
} from "@/server/client-dashboard"
import { getClerkUserCreationError } from "@/server/clerk-errors"

// Client status enum
const ClientStatusEnum = z.enum(["ACTIVE", "INACTIVE", "PENDING"])

/** Coletas mais recentes devolvidas no detalhe do post (gráfico e tabela). */
const POST_DETAIL_METRICS_LIMIT = 120

/** Prazo de cada chamada à API da Kiwify. */
const KIWIFY_FETCH_TIMEOUT_MS = 15_000

export const clientRouter = createTRPCRouter({
  hasPerformance: privateProcedure.query(async ({ ctx }) => {
    const campaigns = await ctx.db.campaign.findMany({
      where: { clientId: ctx.userId },
      select: {
        performanceSettings: { select: { investedAmount: true } },
      },
    })
    return hasInvestedAmountInEveryCampaign(campaigns)
  }),

  // Lista leve das campanhas do cliente (sidebar). Mesmo filtro e ordem do
  // getDashboard, sem as ~13 queries de métricas por campanha.
  getMyCampaignOptions: privateProcedure.query(async ({ ctx }) => {
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

    return ctx.db.campaign.findMany({
      where: {
        clientId: ctx.userId,
        status: {
          in: ["ACTIVE", "COMPLETED", "SCHEDULED"],
        },
      },
      select: { id: true, name: true, slug: true, status: true },
      orderBy: { startDate: "desc" },
    })
  }),

  getPerformance: privateProcedure
    .input(z.object({ campaignId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { role: true },
      })
      if (!user || user.role !== "CLIENT") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para acessar esta funcionalidade",
        })
      }

      const linkedCampaigns = await ctx.db.campaign.findMany({
        where: { clientId: ctx.userId },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          performanceSettings: { select: { investedAmount: true } },
        },
        orderBy: { startDate: "desc" },
      })
      const campaigns = hasInvestedAmountInEveryCampaign(linkedCampaigns)
        ? linkedCampaigns.map(({ id, name, slug, status }) => ({
            id,
            name,
            slug,
            status,
          }))
        : []
      if (
        input?.campaignId &&
        !campaigns.some((item) => item.id === input.campaignId)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Esta competição não está vinculada à sua conta",
        })
      }

      // Os gráficos do cliente desenham um ponto por dia: as coletas de
      // perfis e vídeos chegam resumidas (totais e crescimento iguais).
      const loadPerformance = (campaignId: string) =>
        getCampaignPerformance(ctx.db, campaignId, {
          snapshotResolution: "daily",
        })
      const forClient = (
        performance: Awaited<ReturnType<typeof loadPerformance>>,
      ) =>
        performance
          ? {
              ...performance,
              profiles: performance.profiles.filter(
                (profile) =>
                  profile.lastCollectedAt !== null &&
                  profile.history.length > 0,
              ),
            }
          : null

      // Competição escolhida (já validada acima): só ela é calculada. A
      // visão geral consolidada só aparece sem competição escolhida.
      if (input?.campaignId) {
        return {
          campaigns,
          selected: forClient(await loadPerformance(input.campaignId)),
          overall: null,
          aggregate: null,
        }
      }

      const performances = await Promise.all(
        campaigns.map((campaign) => loadPerformance(campaign.id)),
      )
      const available = performances.filter(
        (performance): performance is NonNullable<typeof performance> =>
          Boolean(performance),
      )
      const selectedId = campaigns[0]?.id
      const selected =
        available.find(
          (performance) => performance.campaign.id === selectedId,
        ) ?? null
      const selectedForClient = forClient(selected)

      const totals = available.reduce(
        (result, performance) => ({
          totalViews: result.totalViews + performance.summary.totalViews,
          investedAmount:
            result.investedAmount + performance.summary.investedAmount,
          equivalentAdsCost:
            result.equivalentAdsCost + performance.summary.equivalentAdsCost,
        }),
        { totalViews: 0, investedAmount: 0, equivalentAdsCost: 0 },
      )
      const aggregateSavings = totals.equivalentAdsCost - totals.investedAmount

      return {
        campaigns,
        selected: selectedForClient,
        overall: aggregateCampaignPerformance(available),
        aggregate: {
          ...totals,
          effectiveCpm:
            totals.totalViews > 0
              ? (totals.investedAmount / totals.totalViews) * 1_000
              : 0,
          referenceCpm:
            totals.totalViews > 0
              ? (totals.equivalentAdsCost / totals.totalViews) * 1_000
              : 0,
          estimatedSavings: aggregateSavings,
          savingsPercentage:
            totals.equivalentAdsCost > 0
              ? (aggregateSavings / totals.equivalentAdsCost) * 100
              : 0,
        },
      }
    }),

  exportCompetitionPostsCsv: privateProcedure
    .input(
      z.object({
        campaignId: z.string().optional(),
        includeAllPosts: z.boolean().default(true),
        postedAtFrom: z.string().datetime().optional(),
        postedAtTo: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const dbUser = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { role: true },
      })

      if (!dbUser || (dbUser.role !== "CLIENT" && dbUser.role !== "ADMIN")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para exportar estes clipposts",
        })
      }

      if (dbUser.role === "ADMIN" && !input.campaignId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selecione uma competição para exportar",
        })
      }

      const campaigns = await ctx.db.campaign.findMany({
        where: {
          ...(input.campaignId ? { id: input.campaignId } : {}),
          ...(dbUser.role === "CLIENT" ? { clientId: ctx.userId } : {}),
        },
        select: { id: true, name: true, slug: true },
      })

      if (input.campaignId && campaigns.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Competição não encontrada ou sem acesso",
        })
      }

      const postedAt = input.includeAllPosts
        ? undefined
        : {
            ...(input.postedAtFrom
              ? { gte: new Date(input.postedAtFrom) }
              : {}),
            ...(input.postedAtTo ? { lte: new Date(input.postedAtTo) } : {}),
          }

      const posts = await ctx.db.clipPost.findMany({
        where: {
          campaignId: { in: campaigns.map((campaign) => campaign.id) },
          status: "ELIGIBLE",
          ...(postedAt && Object.keys(postedAt).length > 0 ? { postedAt } : {}),
        },
        orderBy: [{ views: "desc" }, { postedAt: "desc" }],
        select: {
          submittedUrl: true,
          postedAt: true,
          views: true,
          likes: true,
          comments: true,
        },
      })

      return {
        campaignName:
          campaigns.length === 1 ? campaigns[0]!.name : "todas-as-competicoes",
        campaignSlug:
          campaigns.length === 1 ? campaigns[0]!.slug : "todas-as-competicoes",
        posts: posts.map((post) => ({
          videoUrl: post.submittedUrl,
          postedAt: post.postedAt?.toISOString() ?? null,
          views: post.views.toString(),
          likes: post.likes,
          comments: post.comments,
        })),
      }
    }),

  // Get all clients
  getAll: privateProcedure.query(async ({ ctx }) => {
    // Buscar role do usuário no banco
    const dbUser = await ctx.db.user.findUnique({
      where: { id: ctx.userId },
      select: { role: true },
    })

    // Apenas ADMIN e ORGANIZER_ADMIN podem ver clientes
    if (
      !dbUser ||
      (dbUser.role !== "ADMIN" && dbUser.role !== "ORGANIZER_ADMIN")
    ) {
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
            performanceSettings: { select: { investedAmount: true } },
          },
        },
        // Organização associada: só os campos usados como fallback do
        // perfil (as campanhas da organização e o `_count` — que agregava a
        // tabela de campanhas inteira — não eram usados).
        organizations: {
          select: {
            organization: {
              select: {
                id: true,
                name: true,
                website: true,
                country: true,
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
      const activeCampaigns = user.clientCampaigns.filter(
        (c) => c.status === "ACTIVE",
      ).length

      const totalSpent = user.clientCampaigns.reduce(
        (sum, campaign) =>
          sum + Number(campaign.performanceSettings?.investedAmount ?? 0),
        0,
      )

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
        campaigns: user.clientCampaigns.map((campaign) => ({
          ...campaign,
          investedAmount: Number(
            campaign.performanceSettings?.investedAmount ?? 0,
          ),
        })),
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
      if (
        !dbUser ||
        (dbUser.role !== "ADMIN" && dbUser.role !== "ORGANIZER_ADMIN")
      ) {
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
              performanceSettings: { select: { investedAmount: true } },
            },
          },
          // Organização: só os campos usados como fallback do perfil.
          organizations: {
            select: {
              organization: {
                select: {
                  name: true,
                  website: true,
                  country: true,
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
      const activeCampaigns = user.clientCampaigns.filter(
        (c) => c.status === "ACTIVE",
      ).length
      const totalSpent = user.clientCampaigns.reduce(
        (sum, campaign) =>
          sum + Number(campaign.performanceSettings?.investedAmount ?? 0),
        0,
      )

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
        campaigns: user.clientCampaigns.map((campaign) => ({
          ...campaign,
          investedAmount: Number(
            campaign.performanceSettings?.investedAmount ?? 0,
          ),
        })),
        hasStore: user.hasStore,
        hasKiwifyStore: user.hasKiwifyStore,
      }
    }),

  updateCampaignInvestment: privateProcedure
    .input(
      z.object({
        clientId: z.string().min(1),
        campaignId: z.string().min(1),
        investedAmount: z
          .number()
          .finite()
          .nonnegative()
          .max(999999999999.99)
          .refine(
            (value) => Math.round(value * 100) / 100 === value,
            "Use no máximo duas casas decimais",
          ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const admin = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { role: true },
      })
      if (admin?.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Apenas administradores podem editar o investimento",
        })
      }
      const campaign = await ctx.db.campaign.findFirst({
        where: { id: input.campaignId, clientId: input.clientId },
        select: { id: true },
      })
      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Competição não vinculada a este cliente",
        })
      }
      await ctx.db.campaignPerformanceSettings.upsert({
        where: { campaignId: input.campaignId },
        create: {
          campaignId: input.campaignId,
          investedAmount: input.investedAmount,
        },
        update: { investedAmount: input.investedAmount },
      })
      return { investedAmount: input.investedAmount }
    }),

  // Create client
  create: privateProcedure
    .input(
      z.object({
        name: z.string().trim().min(1, "Nome é obrigatório"),
        email: z.string().trim().toLowerCase().email("Email inválido"),
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
      }),
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

      // O Clerk trata emails sem diferenciar maiúsculas/minúsculas.
      const existingUser = await ctx.db.user.findFirst({
        where: { email: { equals: input.email, mode: "insensitive" } },
      })

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Já existe um usuário com este email",
        })
      }

      // 1. Criar usuário no Clerk primeiro
      const clerk = await clerkClient()
      let clerkUserId: string
      try {
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
      } catch (error) {
        console.error("Erro ao criar usuário no Clerk:", error)
        throw getClerkUserCreationError(error)
      }

      try {
        // 2. Persistir tudo em uma única transação. Se ela falhar, a conta
        // recém-criada no Clerk é removida no catch abaixo.
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
              hasKiwifyStore:
                input.hasStore === true && input.hasKiwifyStore === true,
            },
          })

          // 2. Criar o ClientProfile
          await tx.clientProfile.create({
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

          await tx.auditLog.create({
            data: {
              userId: ctx.userId,
              action: "CREATE",
              entityType: "Client",
              entityId: user.id,
              changes: {
                name: input.name,
                email: input.email,
                company: input.company,
              },
            },
          })

          return user
        })

        return { success: true, clientId: result.id }
      } catch (error) {
        try {
          await clerk.users.deleteUser(clerkUserId)
        } catch (rollbackError) {
          console.error(
            "Não foi possível remover o usuário do Clerk após falha no banco:",
            rollbackError,
          )
        }

        const prismaError = error as { code?: string }
        if (prismaError.code === "P2002") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Já existe um usuário com este email.",
          })
        }

        console.error("Erro ao salvar cliente no banco:", error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Não foi possível salvar o cliente. Tente novamente.",
        })
      }
    }),

  // Update client
  update: privateProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        password: z
          .string()
          .min(8, "Senha deve ter no mínimo 8 caracteres")
          .optional()
          .or(z.literal("")),
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
      }),
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
        if (input.hasStore !== undefined)
          userUpdateData.hasStore = input.hasStore
        if (input.hasKiwifyStore !== undefined)
          userUpdateData.hasKiwifyStore = input.hasKiwifyStore

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
              phone:
                input.phone !== undefined
                  ? input.phone
                  : user.clientProfile.phone,
              company:
                input.company !== undefined
                  ? input.company
                  : user.clientProfile.company,
              position:
                input.position !== undefined
                  ? input.position
                  : user.clientProfile.position,
              website:
                input.website !== undefined
                  ? input.website || null
                  : user.clientProfile.website,
              country:
                input.country !== undefined
                  ? input.country
                  : user.clientProfile.country,
              city:
                input.city !== undefined ? input.city : user.clientProfile.city,
              status:
                input.status !== undefined
                  ? input.status
                  : user.clientProfile.status,
              notes:
                input.notes !== undefined
                  ? input.notes
                  : user.clientProfile.notes,
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
      const hasActiveCampaigns = org?.campaigns.some(
        (c) => c.status === "ACTIVE",
      )

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
    if (
      !dbUser ||
      (dbUser.role !== "ADMIN" && dbUser.role !== "ORGANIZER_ADMIN")
    ) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Você não tem permissão para acessar esta funcionalidade",
      })
    }

    const [totalClients, totalOrganizations, totalCampaigns, activeCampaigns] =
      await Promise.all([
        ctx.db.user.count({
          where: { role: "CLIENT" },
        }),
        ctx.db.organization.count(),
        ctx.db.campaign.count(),
        ctx.db.campaign.count({
          where: { status: "ACTIVE" },
        }),
      ])

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
      }),
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
      }),
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
      },
      orderBy: {
        startDate: "desc",
      },
    })

    // Métricas agregadas no banco por competição (cache de 60 s por
    // competição). As competições já vêm filtradas pelo cliente logado.
    const campaignsWithMetrics = await Promise.all(
      campaigns.map(async (campaign) => {
        const metrics = await getCampaignDashboardMetrics(ctx.db, campaign)

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
          totalParticipants: metrics.totalParticipants,
          totalPosts: metrics.totalPosts, // Usa contagem filtrada se for Tarcísio
          totalViews: metrics.totalViews,
          totalLikes: metrics.totalLikes,
          totalComments: metrics.totalComments,
          totalShares: metrics.totalShares,
          totalSaves: metrics.totalSaves,
          engagementRate: metrics.engagementRate,
          recentViews: metrics.recentViews,
          growthData: metrics.growthData,
          growthPlatforms: metrics.growthPlatforms,
          platformStats: metrics.platformStats,
          topPosts: metrics.topPosts,
          topAccounts: metrics.topAccounts,
        }
      }),
    )

    return {
      campaigns: campaignsWithMetrics,
      hasStore: dbUser.hasStore,
      hasKiwifyStore: dbUser.hasKiwifyStore,
    }
  }),

  // Números do topo de /posts e /client-comments: só os totais por
  // competição, sem gráfico, top posts e top contas do getDashboard.
  getHeroStats: privateProcedure.query(async ({ ctx }) => {
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

    const [campaigns, postFilterCampaigns] = await Promise.all([
      // Mesmo filtro e ordem do getDashboard
      ctx.db.campaign.findMany({
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
          status: true,
          startDate: true,
          endDate: true,
          platforms: true,
        },
        orderBy: {
          startDate: "desc",
        },
      }),
      // Mesma lista (e ordem) do filtro de competição do getAllPosts
      ctx.db.campaign.findMany({
        where: { clientId: ctx.userId },
        select: { id: true, name: true, slug: true },
        orderBy: { createdAt: "desc" },
      }),
    ])

    const campaignsWithTotals = await Promise.all(
      campaigns.map(async (campaign) => {
        const totals = await getCampaignTotals(ctx.db, campaign)
        return {
          id: campaign.id,
          name: campaign.name,
          slug: campaign.slug,
          status: campaign.status,
          startDate: campaign.startDate.toISOString(),
          endDate: campaign.endDate.toISOString(),
          platforms: campaign.platforms,
          totalPosts: totals.totalPosts,
          totalViews: totals.totalViews,
          totalLikes: totals.totalLikes,
          totalComments: totals.totalComments,
          totalShares: totals.totalShares,
          totalSaves: totals.totalSaves,
          engagementRate: totals.engagementRate,
        }
      }),
    )

    return {
      campaigns: campaignsWithTotals,
      postFilterCampaigns,
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
        platform: z
          .enum(["INSTAGRAM", "TIKTOK", "YOUTUBE", "KWAI", "FACEBOOK", "ALL"])
          .optional(),
        status: z
          .enum(["PENDING", "ELIGIBLE", "INELIGIBLE", "DISQUALIFIED", "ALL"])
          .optional(),
        campaignId: z.string().optional(),
        search: z.string().optional(), // Buscar por username
        orderBy: z
          .enum(["views", "likes", "comments", "shares", "createdAt"])
          .default("views"),
        orderDirection: z.enum(["asc", "desc"]).default("desc"),
      }),
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

      const {
        page,
        limit,
        platform,
        status,
        campaignId,
        search,
        orderBy,
        orderDirection,
      } = input
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
      const tarcisioStartDate = new Date("2025-11-07T22:00:00-03:00") // 07/11/2025 22:00 BRT

      // Verificar se está filtrando especificamente pela campanha do Tarcísio
      let isTarcisioCompetition = false
      if (campaignId) {
        const campaign = clientCampaigns.find((c) => c.id === campaignId)
        isTarcisioCompetition =
          campaign?.slug === "tarcisio-de-freitas-novembro"
      }

      const where: any = {
        campaignId: {
          in: clientCampaignIds,
        },
      }

      // Aplicar filtro de data se for a competição do Tarcísio
      if (isTarcisioCompetition) {
        where.postedAt = { gte: tarcisioStartDate }
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
          not: "DISQUALIFIED",
        }
      }

      if (campaignId) {
        // O id vem da URL (/posts?campaignId=...): só as competições do cliente
        if (!clientCampaignIds.includes(campaignId)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Esta competição não está vinculada à sua conta",
          })
        }
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
        clipperName:
          post.application?.clipperProfile?.artisticName ||
          post.application?.clipperProfile?.fullName ||
          "Clipador",
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
      // Role, post e histórico saem em paralelo; nada é devolvido antes das
      // checagens de role e de dono da competição.
      const [dbUser, post, metricsHistory, metricsHistoryCount, metricsPeak] =
        await Promise.all([
          ctx.db.user.findUnique({
            where: { id: ctx.userId },
            select: { role: true },
          }),
          ctx.db.clipPost.findUnique({
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
            },
          }),
          // Só as coletas mais recentes (o gráfico da página); a série
          // completa fica com o dialog, via getPostMetricsHistory. A consulta
          // separada usa o índice (clipPostId, collectedAt) com LIMIT — o
          // `take` de uma relação aninhada seria aplicado em memória.
          ctx.db.clipPostMetrics.findMany({
            where: { clipPostId: input.postId },
            orderBy: { collectedAt: "desc" },
            take: POST_DETAIL_METRICS_LIMIT,
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
          }),
          ctx.db.clipPostMetrics.count({
            where: { clipPostId: input.postId },
          }),
          // O pico entre coletas considera o histórico inteiro, não só as
          // coletas devolvidas para o gráfico.
          ctx.db.clipPostMetrics.aggregate({
            where: { clipPostId: input.postId },
            _max: { viewsDelta: true },
          }),
        ])

      if (!dbUser || dbUser.role !== "CLIENT") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para acessar esta funcionalidade",
        })
      }

      if (!post) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Post não encontrado",
        })
      }

      if (post.campaign.clientId !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Sem permissão para acessar este post",
        })
      }

      const engagementRate = calculateEngagementRate(
        Number(post.views),
        post.likes,
        post.comments,
        post.shares,
        post.saves ?? 0,
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
        metricsHistoryCount,
        peakViewsDelta:
          metricsPeak._max.viewsDelta === null
            ? null
            : Number(metricsPeak._max.viewsDelta),
        metricsHistory: metricsHistory.map((m) => ({
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
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Post não encontrado",
        })
      }

      if (post.campaign.clientId !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Sem permissão para acessar este post",
        })
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
        const engagementRate = calculateEngagementRate(
          views,
          likes,
          comments,
          shares,
          saves,
        )
        const rankingScore = calculateRankingScore(
          metricType,
          views,
          likes,
          comments,
          shares,
          saves,
        )
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
      }),
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
        const tokenResponse = await fetch(
          "https://public-api.kiwify.com/v1/oauth/token",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              client_id: input.kiwifyClientId,
              client_secret: input.kiwifySecretKey,
            }),
            signal: AbortSignal.timeout(KIWIFY_FETCH_TIMEOUT_MS),
          },
        )

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text()
          console.error("Erro ao validar credenciais Kiwify:", errorText)

          // Mensagem mais específica baseada no erro
          let message =
            "Credenciais inválidas. Verifique o Client ID e Secret Key."
          if (
            errorText.includes("TOKEN_INVALID") ||
            errorText.includes("invalid_client")
          ) {
            message =
              "Client ID ou Secret Key inválidos. Verifique as credenciais no painel da Kiwify."
          } else if (errorText.includes("unauthorized")) {
            message =
              "Credenciais não autorizadas. Verifique se a API Key está ativa."
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
            signal: AbortSignal.timeout(KIWIFY_FETCH_TIMEOUT_MS),
          },
        )

        if (!testResponse.ok) {
          const errorText = await testResponse.text()
          console.error("Erro ao validar Account ID Kiwify:", errorText)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Account ID inválido. Verifique o ID da conta no painel da Kiwify.",
          })
        }
      } catch (error: any) {
        if (error instanceof TRPCError) {
          throw error
        }
        if (error?.name === "TimeoutError" || error?.name === "AbortError") {
          throw new TRPCError({
            code: "TIMEOUT",
            message:
              "A Kiwify não respondeu a tempo. Tente novamente em instantes.",
          })
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
})
