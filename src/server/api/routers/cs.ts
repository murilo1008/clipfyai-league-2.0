import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { clerkClient } from "@clerk/nextjs/server";
import type { Prisma, PrismaClient } from "@prisma/client";

import {
  adminProcedure,
  createTRPCRouter,
  csProcedure,
} from "@/server/api/trpc";
import { getClerkUserCreationError } from "@/server/clerk-errors";
import {
  CS_ROLE,
  VIEWABLE_CAMPAIGN_STATUSES,
  allowedClientIdsFor,
  viewableClientWhere,
} from "@/server/cs-view/eligibility";

/**
 * Router do papel Customer Success (CUSTOMER_SUCCESS).
 *
 * - `cs.view.*`  → usado pelo próprio CS (seletor de clientes no header / landing).
 * - `cs.admin.*` → gestão da equipe de CS pelo ADMIN (página Configurações → Equipe CS).
 *
 * A troca efetiva de "usuário atual" acontece no middleware `isAuth` (ver trpc.ts) a
 * partir do cookie setado pela Server Action `selectCsClient`; aqui só listamos e
 * administramos.
 */

const idSchema = z.string().trim().min(1).max(64);
const clientIdsSchema = z.array(idSchema).max(500);
const searchInput = z
  .object({ search: z.string().trim().max(100).optional() })
  .optional();

type Db = PrismaClient | Prisma.TransactionClient;

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids));
}

/** Garante que todos os ids informados são usuários com papel CLIENT. */
async function assertClientIds(db: Db, ids: string[]) {
  if (ids.length === 0) return;
  const count = await db.user.count({
    where: { id: { in: ids }, role: "CLIENT" },
  });
  if (count !== ids.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Um ou mais clientes selecionados não existem ou não são clientes.",
    });
  }
}

const csUserSelect = {
  id: true,
  name: true,
  email: true,
  imageUrl: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  csClientAccess: {
    orderBy: { createdAt: "asc" },
    select: {
      clientId: true,
      createdAt: true,
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          imageUrl: true,
          clientProfile: { select: { company: true } },
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

type CsUserRow = Prisma.UserGetPayload<{ select: typeof csUserSelect }>;

function serializeCsUser(user: CsUserRow) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    imageUrl: user.imageUrl,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    /** Sem nenhuma linha de acesso = vê todos os clientes elegíveis. */
    allClients: user.csClientAccess.length === 0,
    clients: user.csClientAccess.map((access) => ({
      id: access.client.id,
      name: access.client.name,
      email: access.client.email,
      imageUrl: access.client.imageUrl,
      company: access.client.clientProfile?.company ?? null,
    })),
  };
}

async function findCsUserOrThrow(db: Db, id: string) {
  const user = await db.user.findUnique({
    where: { id },
    select: csUserSelect,
  });
  if (!user || user.role !== CS_ROLE) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Usuário de CS não encontrado",
    });
  }
  return user;
}

export const csRouter = createTRPCRouter({
  // ==========================================================================
  // Lado do CS
  // ==========================================================================
  view: createTRPCRouter({
    /** Clientes que o CS logado pode visualizar (allowlist ∩ elegíveis). */
    clients: csProcedure.input(searchInput).query(async ({ ctx, input }) => {
      const access = await ctx.db.csClientAccess.findMany({
        where: { csUserId: ctx.actorUserId },
        select: { clientId: true },
      });
      const allowedIds = allowedClientIdsFor(access);

      const users = await ctx.db.user.findMany({
        where: viewableClientWhere(allowedIds, input?.search),
        select: {
          id: true,
          name: true,
          email: true,
          imageUrl: true,
          clientProfile: { select: { company: true } },
          clientCampaigns: {
            where: { status: { in: [...VIEWABLE_CAMPAIGN_STATUSES] } },
            select: { status: true },
          },
        },
        orderBy: [{ name: "asc" }, { email: "asc" }],
        take: 50,
      });

      return users.map((user) => {
        const activeCampaigns = user.clientCampaigns.filter(
          (campaign) => campaign.status === "ACTIVE",
        ).length;
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          imageUrl: user.imageUrl,
          company: user.clientProfile?.company ?? null,
          activeCampaigns,
          completedCampaigns: user.clientCampaigns.length - activeCampaigns,
          eligibleCampaigns: user.clientCampaigns.length,
        };
      });
    }),
  }),

  // ==========================================================================
  // Lado do ADMIN — gestão da equipe de CS
  // ==========================================================================
  admin: createTRPCRouter({
    list: adminProcedure.input(searchInput).query(async ({ ctx, input }) => {
      const term = input?.search?.trim();
      const users = await ctx.db.user.findMany({
        where: {
          role: CS_ROLE,
          ...(term
            ? {
                OR: [
                  { name: { contains: term, mode: "insensitive" } },
                  { email: { contains: term, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        select: csUserSelect,
        orderBy: { createdAt: "desc" },
      });
      return users.map(serializeCsUser);
    }),

    stats: adminProcedure.query(async ({ ctx }) => {
      const [users, eligibleClients] = await Promise.all([
        ctx.db.user.findMany({
          where: { role: CS_ROLE },
          select: { id: true, _count: { select: { csClientAccess: true } } },
        }),
        ctx.db.user.count({ where: viewableClientWhere(null) }),
      ]);
      const restricted = users.filter(
        (user) => user._count.csClientAccess > 0,
      ).length;
      return {
        total: users.length,
        restricted,
        unrestricted: users.length - restricted,
        eligibleClients,
      };
    }),

    /**
     * Todos os clientes (para o multi-select). O admin pode pré-autorizar um cliente
     * ainda sem competição elegível; a elegibilidade só vale na hora de visualizar.
     */
    clientOptions: adminProcedure.query(async ({ ctx }) => {
      const clients = await ctx.db.user.findMany({
        where: { role: "CLIENT" },
        select: {
          id: true,
          name: true,
          email: true,
          imageUrl: true,
          clientProfile: { select: { company: true, status: true } },
          _count: {
            select: {
              clientCampaigns: {
                where: { status: { in: [...VIEWABLE_CAMPAIGN_STATUSES] } },
              },
            },
          },
        },
        orderBy: [{ name: "asc" }, { email: "asc" }],
      });
      return clients.map((client) => ({
        id: client.id,
        name: client.name,
        email: client.email,
        imageUrl: client.imageUrl,
        company: client.clientProfile?.company ?? null,
        status: client.clientProfile?.status ?? "PENDING",
        eligibleCampaigns: client._count.clientCampaigns,
      }));
    }),

    create: adminProcedure
      .input(
        z.object({
          name: z.string().trim().min(1, "Nome é obrigatório").max(120),
          email: z.string().trim().toLowerCase().email("Email inválido"),
          password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
          clientIds: clientIdsSchema.default([]),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const clientIds = uniqueIds(input.clientIds);
        await assertClientIds(ctx.db, clientIds);

        // O Clerk trata emails sem diferenciar maiúsculas/minúsculas.
        const existing = await ctx.db.user.findFirst({
          where: { email: { equals: input.email, mode: "insensitive" } },
          select: { id: true },
        });
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Já existe um usuário com este email",
          });
        }

        // 1. Criar no Clerk primeiro
        const clerk = await clerkClient();
        let clerkUserId: string;
        try {
          const clerkUser = await clerk.users.createUser({
            emailAddress: [input.email],
            password: input.password,
            firstName: input.name.split(" ")[0],
            lastName: input.name.split(" ").slice(1).join(" ") || undefined,
            publicMetadata: { role: CS_ROLE },
          });
          clerkUserId = clerkUser.id;
        } catch (error) {
          console.error("Erro ao criar usuário de CS no Clerk:", error);
          throw getClerkUserCreationError(error);
        }

        // 2. Persistir em transação; em falha, remover a conta do Clerk.
        try {
          const created = await ctx.db.$transaction(async (tx) => {
            const user = await tx.user.create({
              data: {
                id: clerkUserId,
                email: input.email,
                name: input.name,
                role: CS_ROLE,
                onboardingCompleted: true,
              },
            });

            if (clientIds.length > 0) {
              await tx.csClientAccess.createMany({
                data: clientIds.map((clientId) => ({
                  csUserId: user.id,
                  clientId,
                  grantedBy: ctx.userId,
                })),
              });
            }

            await tx.auditLog.create({
              data: {
                userId: ctx.userId,
                action: "CREATE",
                entityType: "CsUser",
                entityId: user.id,
                changes: { name: input.name, email: input.email, clientIds },
              },
            });

            return user;
          });

          return { success: true, id: created.id };
        } catch (error) {
          try {
            await clerk.users.deleteUser(clerkUserId);
          } catch (rollbackError) {
            console.error(
              "Não foi possível remover o usuário de CS do Clerk após falha no banco:",
              rollbackError,
            );
          }

          const prismaError = error as { code?: string };
          if (prismaError.code === "P2002") {
            throw new TRPCError({
              code: "CONFLICT",
              message: "Já existe um usuário com este email.",
            });
          }

          console.error("Erro ao salvar usuário de CS no banco:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "Não foi possível salvar o usuário de CS. Tente novamente.",
          });
        }
      }),

    update: adminProcedure
      .input(
        z.object({
          id: idSchema,
          name: z
            .string()
            .trim()
            .min(1, "Nome é obrigatório")
            .max(120)
            .optional(),
          password: z
            .string()
            .min(8, "Senha deve ter no mínimo 8 caracteres")
            .optional()
            .or(z.literal("")),
          clientIds: clientIdsSchema.optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const before = await findCsUserOrThrow(ctx.db, input.id);
        const beforeClientIds = before.csClientAccess.map((a) => a.clientId);
        const nextClientIds = input.clientIds
          ? uniqueIds(input.clientIds)
          : undefined;
        if (nextClientIds) await assertClientIds(ctx.db, nextClientIds);

        if (input.password) {
          try {
            const clerk = await clerkClient();
            await clerk.users.updateUser(input.id, {
              password: input.password,
            });
          } catch (error) {
            console.error("Erro ao atualizar senha do CS no Clerk:", error);
            throw getClerkUserCreationError(error);
          }
        }

        await ctx.db.$transaction(async (tx) => {
          if (input.name) {
            await tx.user.update({
              where: { id: input.id },
              data: { name: input.name },
            });
          }

          if (nextClientIds) {
            await tx.csClientAccess.deleteMany({
              where: { csUserId: input.id },
            });
            if (nextClientIds.length > 0) {
              await tx.csClientAccess.createMany({
                data: nextClientIds.map((clientId) => ({
                  csUserId: input.id,
                  clientId,
                  grantedBy: ctx.userId,
                })),
              });
            }
          }

          await tx.auditLog.create({
            data: {
              userId: ctx.userId,
              action: "UPDATE",
              entityType: "CsUser",
              entityId: input.id,
              changes: {
                before: { name: before.name, clientIds: beforeClientIds },
                after: {
                  name: input.name ?? before.name,
                  clientIds: nextClientIds ?? beforeClientIds,
                },
                passwordChanged: Boolean(input.password),
              },
            },
          });
        });

        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: idSchema }))
      .mutation(async ({ ctx, input }) => {
        if (input.id === ctx.userId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Você não pode remover a si mesmo",
          });
        }

        const user = await findCsUserOrThrow(ctx.db, input.id);

        // Cascade remove as linhas de CsClientAccess.
        await ctx.db.user.delete({ where: { id: input.id } });

        // Sem isto o login continuaria funcionando com getCurrentUser === null.
        try {
          const clerk = await clerkClient();
          await clerk.users.deleteUser(input.id);
        } catch (error) {
          console.error(
            "Não foi possível remover o usuário de CS do Clerk:",
            error,
          );
        }

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.userId,
            action: "DELETE",
            entityType: "CsUser",
            entityId: input.id,
            changes: {
              email: user.email,
              name: user.name,
              clientIds: user.csClientAccess.map((a) => a.clientId),
            },
          },
        });

        return { success: true };
      }),
  }),
});
