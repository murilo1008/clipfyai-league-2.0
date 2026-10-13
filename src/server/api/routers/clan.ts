import { z } from "zod";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  createTRPCRouter,
  adminProcedure,
  privateProcedure,
} from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { calculateEngagementRate } from "@/lib/ranking-helpers";
import { cachedQuery } from "@/server/memory-cache";

function isClanManager(
  clipper: { id: string } | null | undefined,
  clan: { ownerId: string | null; adminId: string | null },
) {
  return (
    !!clipper && (clan.ownerId === clipper.id || clan.adminId === clipper.id)
  );
}

// Os totais dos clãs somam os posts elegíveis dos membros (ClipPost tem
// centenas de milhares de linhas): são agregados no banco, em vez de carregar
// cada post, e o ranking/lista reaproveitam o resultado por 5 minutos em cada
// instância.
const CLAN_TOTALS_TTL_MS = 5 * 60_000;

type PostTotals = {
  posts: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
};

type PostTotalsRow = {
  posts: number;
  views: bigint;
  likes: bigint;
  comments: bigint;
  shares: bigint;
  saves: bigint;
};

function toPostTotals(row: PostTotalsRow): PostTotals {
  return {
    posts: Number(row.posts),
    views: Number(row.views),
    likes: Number(row.likes),
    comments: Number(row.comments),
    shares: Number(row.shares),
    saves: Number(row.saves),
  };
}

/**
 * Totais dos posts elegíveis de cada membro de clã (chave: id do
 * ClipperProfile), somando as inscrições de qualquer status, como a lista e o
 * ranking de clãs sempre contaram.
 */
function getClanMemberPostTotals(db: PrismaClient) {
  return cachedQuery(
    "clan:member-post-totals",
    CLAN_TOTALS_TTL_MS,
    async (): Promise<Map<string, PostTotals>> => {
      const rows = await db.$queryRaw<
        Array<PostTotalsRow & { clipperProfileId: string }>
      >`
        SELECT
          a."clipperProfileId",
          COUNT(*)::int AS posts,
          COALESCE(SUM(p.views), 0)::bigint AS views,
          COALESCE(SUM(p.likes), 0)::bigint AS likes,
          COALESCE(SUM(p.comments), 0)::bigint AS comments,
          COALESCE(SUM(p.shares), 0)::bigint AS shares,
          COALESCE(SUM(p.saves), 0)::bigint AS saves
        FROM "ClipPost" p
        INNER JOIN "ClipperApplication" a ON a.id = p."applicationId"
        INNER JOIN "ClipperProfile" cp ON cp.id = a."clipperProfileId"
        WHERE p.status = 'ELIGIBLE' AND cp."clanId" IS NOT NULL
        GROUP BY a."clipperProfileId"
      `;
      return new Map(
        rows.map((row) => [row.clipperProfileId, toPostTotals(row)]),
      );
    },
  );
}

type ApplicationPostTotals = PostTotals & {
  todayViews: number;
  todayPosts: number;
};

/**
 * Totais dos posts elegíveis de cada inscrição APROVADA dos membros do clã
 * (chave: id da inscrição). Posts de hoje: `postedAt >= todayStart`.
 */
async function getApprovedApplicationPostTotals(
  db: PrismaClient,
  clanTag: string,
  todayStart: Date,
) {
  const rows = await db.$queryRaw<
    Array<
      PostTotalsRow & {
        applicationId: string;
        todayViews: bigint;
        todayPosts: number;
      }
    >
  >`
    SELECT
      p."applicationId",
      COUNT(*)::int AS posts,
      COALESCE(SUM(p.views), 0)::bigint AS views,
      COALESCE(SUM(p.likes), 0)::bigint AS likes,
      COALESCE(SUM(p.comments), 0)::bigint AS comments,
      COALESCE(SUM(p.shares), 0)::bigint AS shares,
      COALESCE(SUM(p.saves), 0)::bigint AS saves,
      COALESCE(SUM(p.views) FILTER (WHERE p."postedAt" >= ${todayStart}::timestamp), 0)::bigint AS "todayViews",
      (COUNT(*) FILTER (WHERE p."postedAt" >= ${todayStart}::timestamp))::int AS "todayPosts"
    FROM "ClipPost" p
    INNER JOIN "ClipperApplication" a ON a.id = p."applicationId"
    INNER JOIN "ClipperProfile" cp ON cp.id = a."clipperProfileId"
    INNER JOIN "Clan" c ON c.id = cp."clanId"
    WHERE c.tag = ${clanTag} AND a.status = 'APPROVED' AND p.status = 'ELIGIBLE'
    GROUP BY p."applicationId"
  `;
  return new Map<string, ApplicationPostTotals>(
    rows.map((row) => [
      row.applicationId,
      {
        ...toPostTotals(row),
        todayViews: Number(row.todayViews),
        todayPosts: Number(row.todayPosts),
      },
    ]),
  );
}

type FirstClanMember = {
  id: string;
  fullName: string;
  artisticName: string | null;
  imageUrl: string | null;
};

/**
 * Os 5 primeiros membros de cada clã, na ordem do id (a mesma do `take`
 * aninhado do Prisma), limitados no banco em vez de carregar todos os membros.
 */
async function getFirstFiveClanMembers(db: PrismaClient, clanIds: string[]) {
  const byClan = new Map<string, FirstClanMember[]>();
  if (clanIds.length === 0) return byClan;

  const rows = await db.$queryRaw<Array<FirstClanMember & { clanId: string }>>`
    SELECT m.id, m."clanId", m."fullName", m."artisticName", u."imageUrl"
    FROM (
      SELECT
        id,
        "clanId",
        "fullName",
        "artisticName",
        "userId",
        ROW_NUMBER() OVER (PARTITION BY "clanId" ORDER BY id) AS position
      FROM "ClipperProfile"
      WHERE "clanId" IN (${Prisma.join(clanIds)})
    ) m
    LEFT JOIN "User" u ON u.id = m."userId"
    WHERE m.position <= 5
    ORDER BY m."clanId", m.id
  `;
  for (const { clanId, ...member } of rows) {
    const members = byClan.get(clanId);
    if (members) members.push(member);
    else byClan.set(clanId, [member]);
  }
  return byClan;
}

export const clanRouter = createTRPCRouter({
  list: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.enum(["all", "active", "inactive"]).default("all"),
        sortBy: z
          .enum(["members", "views", "name", "recent"])
          .default("members"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { search, status, sortBy } = input;

      const where = {
        ...(status === "active" && { isActive: true }),
        ...(status === "inactive" && { isActive: false }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { tag: { contains: search, mode: "insensitive" as const } },
          ],
        }),
      };

      const orderBy = (() => {
        switch (sortBy) {
          case "name":
            return { name: "asc" as const };
          case "recent":
            return { createdAt: "desc" as const };
          default:
            return { createdAt: "desc" as const };
        }
      })();

      // Views somadas no banco por membro (cache de 5 min); os membros são
      // lidos na hora, então entradas/saídas aparecem imediatamente.
      const [clans, memberTotals] = await Promise.all([
        ctx.db.clan.findMany({
          where,
          orderBy,
          include: {
            members: {
              select: {
                id: true,
                fullName: true,
                artisticName: true,
                user: {
                  select: {
                    imageUrl: true,
                  },
                },
              },
            },
          },
        }),
        getClanMemberPostTotals(ctx.db),
      ]);

      const enriched = clans.map((clan) => {
        const totalViews = clan.members.reduce(
          (acc, m) => acc + (memberTotals.get(m.id)?.views ?? 0),
          0,
        );

        const topMembers = clan.members.slice(0, 5).map((m) => ({
          id: m.id,
          name: m.artisticName ?? m.fullName,
          imageUrl: m.user?.imageUrl ?? null,
        }));

        return {
          id: clan.id,
          name: clan.name,
          tag: clan.tag,
          emoji: clan.emoji,
          emojiColor: clan.emojiColor,
          imageUrl: clan.imageUrl,
          description: clan.description,
          isActive: clan.isActive,
          createdAt: clan.createdAt,
          // Todos os membros do clã são carregados: o total é o mesmo do _count.
          memberCount: clan.members.length,
          totalViews,
          topMembers,
        };
      });

      if (sortBy === "members") {
        enriched.sort((a, b) => b.memberCount - a.memberCount);
      } else if (sortBy === "views") {
        enriched.sort((a, b) => b.totalViews - a.totalViews);
      }

      return enriched;
    }),

  getStats: adminProcedure.query(async ({ ctx }) => {
    const [totalClans, activeClans, totalMembers] = await Promise.all([
      ctx.db.clan.count(),
      ctx.db.clan.count({ where: { isActive: true } }),
      ctx.db.clipperProfile.count({ where: { clanId: { not: null } } }),
    ]);

    return {
      totalClans,
      activeClans,
      totalMembers,
      avgMembers: totalClans > 0 ? Math.round(totalMembers / totalClans) : 0,
    };
  }),

  getById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const clan = await ctx.db.clan.findUnique({
        where: { id: input.id },
        include: {
          members: {
            select: {
              id: true,
              fullName: true,
              artisticName: true,
              user: {
                select: {
                  id: true,
                  imageUrl: true,
                  email: true,
                },
              },
              applications: {
                select: {
                  clipPosts: {
                    where: { status: "ELIGIBLE" },
                    select: {
                      views: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!clan) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clã não encontrado",
        });
      }

      return clan;
    }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
        tag: z
          .string()
          .min(2, "Tag deve ter pelo menos 2 caracteres")
          .max(4, "Tag deve ter no máximo 4 caracteres")
          .transform((v) => v.toUpperCase()),
        emoji: z.string().min(1, "Ícone é obrigatório"),
        emojiColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor hex inválida"),
        imageUrl: z.string().url("URL da imagem inválida").optional(),
        description: z
          .string()
          .max(500, "Descrição deve ter no máximo 500 caracteres")
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.clan.findUnique({
        where: { tag: input.tag },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Já existe um clã com a tag "${input.tag}"`,
        });
      }

      return ctx.db.clan.create({
        data: {
          name: input.name,
          tag: input.tag,
          emoji: input.emoji,
          emojiColor: input.emojiColor,
          imageUrl: input.imageUrl,
          description: input.description,
        },
      });
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).optional(),
        tag: z
          .string()
          .min(2)
          .max(4)
          .transform((v) => v.toUpperCase())
          .optional(),
        emoji: z.string().min(1).optional(),
        emojiColor: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/)
          .optional(),
        imageUrl: z.string().url().nullable().optional(),
        description: z.string().max(500).nullable().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      if (data.tag) {
        const existing = await ctx.db.clan.findFirst({
          where: { tag: data.tag, id: { not: id } },
        });
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Já existe um clã com a tag "${data.tag}"`,
          });
        }
      }

      return ctx.db.clan.update({
        where: { id },
        data,
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.clipperProfile.updateMany({
        where: { clanId: input.id },
        data: { clanId: null },
      });

      return ctx.db.clan.delete({
        where: { id: input.id },
      });
    }),

  toggleActive: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const clan = await ctx.db.clan.findUnique({
        where: { id: input.id },
        select: { isActive: true },
      });

      if (!clan) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clã não encontrado",
        });
      }

      return ctx.db.clan.update({
        where: { id: input.id },
        data: { isActive: !clan.isActive },
      });
    }),

  addMember: adminProcedure
    .input(
      z.object({
        clanId: z.string(),
        clipperId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const clipper = await ctx.db.clipperProfile.findUnique({
        where: { id: input.clipperId },
        select: { clanId: true },
      });

      if (!clipper) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clipador não encontrado",
        });
      }

      if (clipper.clanId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Clipador já pertence a um clã",
        });
      }

      return ctx.db.clipperProfile.update({
        where: { id: input.clipperId },
        data: { clanId: input.clanId },
      });
    }),

  removeMember: adminProcedure
    .input(
      z.object({
        clipperId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.clan.updateMany({
        where: { adminId: input.clipperId },
        data: { adminId: null },
      });

      return ctx.db.clipperProfile.update({
        where: { id: input.clipperId },
        data: { clanId: null },
      });
    }),

  removeMemberAsOwner: privateProcedure
    .input(
      z.object({
        clipperId: z.string(),
        clanId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ownerProfile = await ctx.db.clipperProfile.findUnique({
        where: { userId: ctx.userId },
        select: { id: true },
      });
      if (!ownerProfile) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Perfil de clipper não encontrado",
        });
      }

      const clan = await ctx.db.clan.findUnique({
        where: { id: input.clanId },
        select: { ownerId: true, adminId: true },
      });
      if (!clan || !isClanManager(ownerProfile, clan)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Apenas administradores do clã podem remover membros",
        });
      }

      if (
        input.clipperId === ownerProfile.id ||
        input.clipperId === clan.ownerId ||
        input.clipperId === clan.adminId
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Administradores do clã não podem ser removidos por este fluxo",
        });
      }

      const member = await ctx.db.clipperProfile.findUnique({
        where: { id: input.clipperId },
        select: { clanId: true },
      });
      if (!member || member.clanId !== input.clanId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Membro não encontrado neste clã",
        });
      }

      await ctx.db.clan.updateMany({
        where: { adminId: input.clipperId },
        data: { adminId: null },
      });

      return ctx.db.clipperProfile.update({
        where: { id: input.clipperId },
        data: { clanId: null },
      });
    }),

  getByTag: adminProcedure
    .input(z.object({ tag: z.string() }))
    .query(async ({ ctx, input }) => {
      const tag = input.tag.toUpperCase();

      // Posts elegíveis somados no banco por inscrição aprovada, em paralelo
      // com o clã (os totais de hoje não são usados aqui).
      const [clan, applicationTotals] = await Promise.all([
        ctx.db.clan.findUnique({
          where: { tag },
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
                artisticName: true,
                user: { select: { imageUrl: true } },
              },
            },
            admin: {
              select: {
                id: true,
                fullName: true,
                artisticName: true,
                user: { select: { imageUrl: true } },
              },
            },
            members: {
              select: {
                id: true,
                fullName: true,
                artisticName: true,
                discordUsername: true,
                createdAt: true,
                user: {
                  select: {
                    id: true,
                    imageUrl: true,
                    email: true,
                    createdAt: true,
                  },
                },
                applications: {
                  where: { status: "APPROVED" },
                  select: {
                    id: true,
                    campaign: {
                      select: { id: true, name: true },
                    },
                  },
                },
              },
            },
          },
        }),
        getApprovedApplicationPostTotals(ctx.db, tag, new Date()),
      ]);

      if (!clan) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clã não encontrado",
        });
      }

      const membersEnriched = clan.members.map((m) => {
        let totalViews = 0;
        let totalLikes = 0;
        let totalComments = 0;
        let totalShares = 0;
        let totalSaves = 0;
        let totalPosts = 0;
        const campaigns = new Set<string>();

        for (const app of m.applications) {
          if (app.campaign) campaigns.add(app.campaign.name);
          const totals = applicationTotals.get(app.id);
          if (!totals) continue;
          totalPosts += totals.posts;
          totalViews += totals.views;
          totalLikes += totals.likes;
          totalComments += totals.comments;
          totalShares += totals.shares;
          totalSaves += totals.saves;
        }

        const engagement = calculateEngagementRate(
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
          totalSaves,
        );

        return {
          id: m.id,
          name: m.artisticName ?? m.fullName,
          fullName: m.fullName,
          discordUsername: m.discordUsername,
          imageUrl: m.user?.imageUrl ?? null,
          email: m.user?.email ?? null,
          joinedAt: m.createdAt,
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
          totalSaves,
          totalPosts,
          engagement,
          campaignCount: campaigns.size,
          campaigns: Array.from(campaigns),
        };
      });

      const clanTotalViews = membersEnriched.reduce(
        (a, m) => a + m.totalViews,
        0,
      );
      const clanTotalPosts = membersEnriched.reduce(
        (a, m) => a + m.totalPosts,
        0,
      );
      const clanTotalLikes = membersEnriched.reduce(
        (a, m) => a + m.totalLikes,
        0,
      );
      const clanTotalComments = membersEnriched.reduce(
        (a, m) => a + m.totalComments,
        0,
      );
      const clanTotalShares = membersEnriched.reduce(
        (a, m) => a + m.totalShares,
        0,
      );
      const clanTotalSaves = membersEnriched.reduce(
        (a, m) => a + m.totalSaves,
        0,
      );
      const clanEngagement = calculateEngagementRate(
        clanTotalViews,
        clanTotalLikes,
        clanTotalComments,
        clanTotalShares,
        clanTotalSaves,
      );

      const pendingApplications = await ctx.db.clanApplication.count({
        where: { clanId: clan.id, status: "PENDING" },
      });

      // Todos os membros do clã são carregados: o total é o mesmo do _count.
      const memberCount = clan.members.length;

      return {
        id: clan.id,
        name: clan.name,
        tag: clan.tag,
        emoji: clan.emoji,
        emojiColor: clan.emojiColor,
        imageUrl: clan.imageUrl,
        description: clan.description,
        isActive: clan.isActive,
        createdAt: clan.createdAt,
        updatedAt: clan.updatedAt,
        ownerId: clan.ownerId,
        adminId: clan.adminId,
        owner: clan.owner
          ? {
              id: clan.owner.id,
              name: clan.owner.artisticName ?? clan.owner.fullName,
              imageUrl: clan.owner.user?.imageUrl ?? null,
            }
          : null,
        admin: clan.admin
          ? {
              id: clan.admin.id,
              name: clan.admin.artisticName ?? clan.admin.fullName,
              imageUrl: clan.admin.user?.imageUrl ?? null,
            }
          : null,
        memberCount,
        pendingApplications,
        stats: {
          totalViews: clanTotalViews,
          totalPosts: clanTotalPosts,
          totalLikes: clanTotalLikes,
          totalComments: clanTotalComments,
          totalShares: clanTotalShares,
          engagement: clanEngagement,
          avgViewsPerMember:
            memberCount > 0 ? Math.round(clanTotalViews / memberCount) : 0,
          avgPostsPerMember:
            memberCount > 0
              ? Math.round((clanTotalPosts / memberCount) * 10) / 10
              : 0,
        },
        members: membersEnriched,
      };
    }),

  getByTagPublic: privateProcedure
    .input(z.object({ tag: z.string() }))
    .query(async ({ ctx, input }) => {
      const tag = input.tag.toUpperCase();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Posts elegíveis somados no banco por inscrição aprovada, em paralelo
      // com o clã e o perfil de quem consulta.
      const [clan, applicationTotals, clipperProfile] = await Promise.all([
        ctx.db.clan.findUnique({
          where: { tag },
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
                artisticName: true,
                user: { select: { imageUrl: true } },
              },
            },
            admin: {
              select: {
                id: true,
                fullName: true,
                artisticName: true,
                user: { select: { imageUrl: true } },
              },
            },
            members: {
              select: {
                id: true,
                fullName: true,
                artisticName: true,
                discordUsername: true,
                createdAt: true,
                user: {
                  select: {
                    id: true,
                    imageUrl: true,
                  },
                },
                applications: {
                  where: { status: "APPROVED" },
                  select: {
                    id: true,
                    campaign: {
                      select: {
                        id: true,
                        name: true,
                        coverImageUrl: true,
                        status: true,
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        getApprovedApplicationPostTotals(ctx.db, tag, today),
        ctx.db.clipperProfile.findUnique({
          where: { userId: ctx.userId },
          select: { id: true },
        }),
      ]);

      if (!clan) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clã não encontrado",
        });
      }

      if (!clan.isActive) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Este clã não está ativo",
        });
      }

      const isOwner = isClanManager(clipperProfile, clan);

      let pendingApplications = 0;
      if (isOwner) {
        pendingApplications = await ctx.db.clanApplication.count({
          where: { clanId: clan.id, status: "PENDING" },
        });
      }

      const campaignMap = new Map<
        string,
        {
          id: string;
          name: string;
          coverImageUrl: string | null;
          totalViews: number;
          totalPosts: number;
        }
      >();

      const membersEnriched = clan.members.map((m) => {
        let totalViews = 0;
        let totalLikes = 0;
        let totalComments = 0;
        let totalShares = 0;
        let totalSaves = 0;
        let totalPosts = 0;
        let todayViews = 0;
        let todayPosts = 0;

        for (const app of m.applications) {
          const totals = applicationTotals.get(app.id);

          if (app.campaign && app.campaign.status !== "ARCHIVED") {
            const campViews = totals?.views ?? 0;
            const campPosts = totals?.posts ?? 0;
            const existing = campaignMap.get(app.campaign.id);
            if (existing) {
              existing.totalViews += campViews;
              existing.totalPosts += campPosts;
            } else {
              campaignMap.set(app.campaign.id, {
                id: app.campaign.id,
                name: app.campaign.name,
                coverImageUrl: app.campaign.coverImageUrl ?? null,
                totalViews: campViews,
                totalPosts: campPosts,
              });
            }
          }

          if (!totals) continue;
          totalPosts += totals.posts;
          totalViews += totals.views;
          totalLikes += totals.likes;
          totalComments += totals.comments;
          totalShares += totals.shares;
          totalSaves += totals.saves;
          todayViews += totals.todayViews;
          todayPosts += totals.todayPosts;
        }

        const engagement = calculateEngagementRate(
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
          totalSaves,
        );

        return {
          id: m.id,
          name: m.artisticName ?? m.fullName,
          fullName: m.fullName,
          discordUsername: m.discordUsername,
          imageUrl: m.user?.imageUrl ?? null,
          joinedAt: m.createdAt,
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
          totalSaves,
          totalPosts,
          todayViews,
          todayPosts,
          engagement,
        };
      });

      const clanTotalViews = membersEnriched.reduce(
        (a, m) => a + m.totalViews,
        0,
      );
      const clanTotalPosts = membersEnriched.reduce(
        (a, m) => a + m.totalPosts,
        0,
      );
      const clanTotalLikes = membersEnriched.reduce(
        (a, m) => a + m.totalLikes,
        0,
      );
      const clanTotalComments = membersEnriched.reduce(
        (a, m) => a + m.totalComments,
        0,
      );
      const clanTotalShares = membersEnriched.reduce(
        (a, m) => a + m.totalShares,
        0,
      );
      const clanTotalSaves = membersEnriched.reduce(
        (a, m) => a + m.totalSaves,
        0,
      );
      const clanEngagement = calculateEngagementRate(
        clanTotalViews,
        clanTotalLikes,
        clanTotalComments,
        clanTotalShares,
        clanTotalSaves,
      );

      const topCampaigns = Array.from(campaignMap.values())
        .sort((a, b) => b.totalViews - a.totalViews)
        .slice(0, 5);

      // Todos os membros do clã são carregados: o total é o mesmo do _count.
      const memberCount = clan.members.length;

      return {
        id: clan.id,
        name: clan.name,
        tag: clan.tag,
        emoji: clan.emoji,
        emojiColor: clan.emojiColor,
        imageUrl: clan.imageUrl,
        description: clan.description,
        createdAt: clan.createdAt,
        owner: clan.owner
          ? {
              id: clan.owner.id,
              name: clan.owner.artisticName ?? clan.owner.fullName,
              imageUrl: clan.owner.user?.imageUrl ?? null,
            }
          : null,
        admin: clan.admin
          ? {
              id: clan.admin.id,
              name: clan.admin.artisticName ?? clan.admin.fullName,
              imageUrl: clan.admin.user?.imageUrl ?? null,
            }
          : null,
        memberCount,
        isOwner,
        pendingApplications,
        stats: {
          totalViews: clanTotalViews,
          totalPosts: clanTotalPosts,
          totalLikes: clanTotalLikes,
          totalComments: clanTotalComments,
          totalShares: clanTotalShares,
          engagement: clanEngagement,
          avgViewsPerMember:
            memberCount > 0 ? Math.round(clanTotalViews / memberCount) : 0,
        },
        members: membersEnriched,
        topCampaigns,
      };
    }),

  listPublic: privateProcedure
    .input(
      z.object({
        search: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = {
        isActive: true,
        ...(input.search && {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { tag: { contains: input.search, mode: "insensitive" as const } },
          ],
        }),
      };

      const clans = await ctx.db.clan.findMany({
        where,
        // Desempate entre clãs com o mesmo número de membros: mais antigo antes.
        orderBy: { createdAt: "asc" },
        include: {
          owner: {
            select: {
              id: true,
              fullName: true,
              artisticName: true,
              user: { select: { imageUrl: true } },
            },
          },
        },
      });

      // Contagem e primeiros membros só dos clãs listados (o _count do Prisma
      // agrupava a tabela inteira de clipadores e o `take` aninhado carregava
      // todos os membros).
      const clanIds = clans.map((clan) => clan.id);
      const [memberCounts, firstMembers] = await Promise.all([
        clanIds.length > 0
          ? ctx.db.clipperProfile.groupBy({
              by: ["clanId"],
              where: { clanId: { in: clanIds } },
              _count: { _all: true },
            })
          : [],
        getFirstFiveClanMembers(ctx.db, clanIds),
      ]);
      const memberCountByClan = new Map(
        memberCounts.map((row) => [row.clanId, row._count._all]),
      );

      return clans
        .map((clan) => ({
          id: clan.id,
          name: clan.name,
          tag: clan.tag,
          emoji: clan.emoji,
          emojiColor: clan.emojiColor,
          imageUrl: clan.imageUrl,
          description: clan.description,
          memberCount: memberCountByClan.get(clan.id) ?? 0,
          owner: clan.owner
            ? {
                id: clan.owner.id,
                name: clan.owner.artisticName ?? clan.owner.fullName,
                imageUrl: clan.owner.user?.imageUrl ?? null,
              }
            : null,
          topMembers: (firstMembers.get(clan.id) ?? []).map((m) => ({
            id: m.id,
            name: m.artisticName || m.fullName,
            imageUrl: m.imageUrl ?? null,
          })),
        }))
        .sort((a, b) => b.memberCount - a.memberCount);
    }),

  myClan: privateProcedure.query(async ({ ctx }) => {
    const clipper = await ctx.db.clipperProfile.findUnique({
      where: { userId: ctx.userId },
      select: {
        id: true,
        clanId: true,
        clan: true,
      },
    });

    if (!clipper) return null;

    if (!clipper.clan) return { clipperId: clipper.id, clan: null };

    const clan = clipper.clan;
    // Contagem e 10 primeiros membros (ordem do id) limitados no banco, em vez
    // do _count e do `take` aninhado que carregava todos os membros.
    const [memberCount, members] = await Promise.all([
      ctx.db.clipperProfile.count({ where: { clanId: clan.id } }),
      ctx.db.clipperProfile.findMany({
        where: { clanId: clan.id },
        orderBy: { id: "asc" },
        take: 10,
        select: {
          id: true,
          fullName: true,
          artisticName: true,
          user: { select: { imageUrl: true } },
        },
      }),
    ]);

    return {
      clipperId: clipper.id,
      clan: {
        id: clan.id,
        name: clan.name,
        tag: clan.tag,
        emoji: clan.emoji,
        emojiColor: clan.emojiColor,
        imageUrl: clan.imageUrl,
        description: clan.description,
        memberCount,
        members: members.map((m) => ({
          id: m.id,
          name: m.artisticName || m.fullName,
          imageUrl: m.user?.imageUrl ?? null,
        })),
      },
    };
  }),

  // ── Ranking público dos clãs ──
  // Igual para todos os clipadores: reaproveitado por 5 minutos em cada
  // instância, com os posts somados no banco por membro.
  getClanRanking: privateProcedure.query(({ ctx }) =>
    cachedQuery("clan:ranking", CLAN_TOTALS_TTL_MS, async () => {
      const [clans, memberTotals] = await Promise.all([
        ctx.db.clan.findMany({
          where: { isActive: true },
          include: {
            owner: {
              select: {
                id: true,
                artisticName: true,
                fullName: true,
                user: { select: { imageUrl: true } },
              },
            },
            members: {
              select: {
                id: true,
                artisticName: true,
                fullName: true,
                user: { select: { imageUrl: true } },
              },
            },
          },
        }),
        getClanMemberPostTotals(ctx.db),
      ]);

      const ranked = clans
        .map((clan) => {
          let totalViews = 0;
          let totalLikes = 0;
          let totalComments = 0;
          let totalShares = 0;
          let totalSaves = 0;
          let totalPosts = 0;

          for (const member of clan.members) {
            const totals = memberTotals.get(member.id);
            if (!totals) continue;
            totalPosts += totals.posts;
            totalViews += totals.views;
            totalLikes += totals.likes;
            totalComments += totals.comments;
            totalShares += totals.shares;
            totalSaves += totals.saves;
          }

          const engagement = calculateEngagementRate(
            totalViews,
            totalLikes,
            totalComments,
            totalShares,
            totalSaves,
          );

          return {
            id: clan.id,
            name: clan.name,
            tag: clan.tag,
            emoji: clan.emoji,
            emojiColor: clan.emojiColor,
            imageUrl: clan.imageUrl,
            // Todos os membros são carregados: o total é o mesmo do _count.
            memberCount: clan.members.length,
            totalViews,
            totalLikes,
            totalComments,
            totalShares,
            totalPosts,
            engagement,
            owner: clan.owner
              ? {
                  name: clan.owner.artisticName ?? clan.owner.fullName,
                  imageUrl: clan.owner.user?.imageUrl ?? null,
                }
              : null,
            topMembers: clan.members
              .map((m) => ({
                id: m.id,
                name: m.artisticName ?? m.fullName,
                imageUrl: m.user?.imageUrl ?? null,
                views: memberTotals.get(m.id)?.views ?? 0,
              }))
              .sort((a, b) => b.views - a.views)
              .slice(0, 5),
          };
        })
        .sort((a, b) => b.totalViews - a.totalViews);

      return { clans: ranked };
    }),
  ),

  // ── Clipper: se inscrever em um clã ──
  applyClan: privateProcedure
    .input(
      z.object({
        clanId: z.string(),
        message: z.string().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const clipper = await ctx.db.clipperProfile.findUnique({
        where: { userId: ctx.userId },
        select: { id: true, clanId: true },
      });

      if (!clipper) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Perfil de clipador não encontrado",
        });
      }

      if (clipper.clanId) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Você já pertence a um clã. Saia primeiro para se inscrever em outro.",
        });
      }

      const clan = await ctx.db.clan.findUnique({
        where: { id: input.clanId },
        select: { isActive: true },
      });

      if (!clan || !clan.isActive) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clã não encontrado ou inativo",
        });
      }

      const existing = await ctx.db.clanApplication.findUnique({
        where: {
          clanId_clipperId: { clanId: input.clanId, clipperId: clipper.id },
        },
      });

      if (existing && existing.status === "PENDING") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Você já tem uma inscrição pendente neste clã.",
        });
      }

      if (existing) {
        return ctx.db.clanApplication.update({
          where: { id: existing.id },
          data: {
            status: "PENDING",
            message: input.message ?? null,
            reviewedAt: null,
            reviewedBy: null,
          },
        });
      }

      return ctx.db.clanApplication.create({
        data: {
          clanId: input.clanId,
          clipperId: clipper.id,
          message: input.message ?? null,
        },
      });
    }),

  // ── Clipper: cancelar inscrição pendente ──
  cancelApplication: privateProcedure
    .input(z.object({ clanId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const clipper = await ctx.db.clipperProfile.findUnique({
        where: { userId: ctx.userId },
        select: { id: true },
      });

      if (!clipper) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Perfil de clipador não encontrado",
        });
      }

      const application = await ctx.db.clanApplication.findUnique({
        where: {
          clanId_clipperId: { clanId: input.clanId, clipperId: clipper.id },
        },
      });

      if (!application || application.status !== "PENDING") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inscrição pendente não encontrada",
        });
      }

      return ctx.db.clanApplication.delete({ where: { id: application.id } });
    }),

  // ── Clipper: verificar status da inscrição em um clã ──
  myApplications: privateProcedure.query(async ({ ctx }) => {
    const clipper = await ctx.db.clipperProfile.findUnique({
      where: { userId: ctx.userId },
      select: { id: true },
    });

    if (!clipper) return [];

    return ctx.db.clanApplication.findMany({
      where: { clipperId: clipper.id },
      include: {
        clan: {
          select: {
            id: true,
            name: true,
            tag: true,
            emoji: true,
            emojiColor: true,
            imageUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  // ── Clipper: sair do clã ──
  leaveClan: privateProcedure.mutation(async ({ ctx }) => {
    const clipper = await ctx.db.clipperProfile.findUnique({
      where: { userId: ctx.userId },
      select: { id: true, clanId: true },
    });

    if (!clipper) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Perfil de clipador não encontrado",
      });
    }

    if (!clipper.clanId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Você não pertence a nenhum clã",
      });
    }

    await Promise.all([
      ctx.db.clanApplication.deleteMany({
        where: { clipperId: clipper.id, clanId: clipper.clanId },
      }),
      ctx.db.clan.updateMany({
        where: { adminId: clipper.id },
        data: { adminId: null },
      }),
    ]);

    return ctx.db.clipperProfile.update({
      where: { id: clipper.id },
      data: { clanId: null },
    });
  }),

  // ── Owner/Admin: listar inscrições pendentes de um clã ──
  listApplications: privateProcedure
    .input(
      z.object({
        clanId: z.string(),
        status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const clipper = await ctx.db.clipperProfile.findUnique({
        where: { userId: ctx.userId },
        select: { id: true },
      });

      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { role: true },
      });

      const clan = await ctx.db.clan.findUnique({
        where: { id: input.clanId },
        select: { ownerId: true, adminId: true },
      });

      if (!clan) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clã não encontrado",
        });
      }

      const isOwner = isClanManager(clipper, clan);
      const isAdmin = user?.role === "ADMIN";

      if (!isOwner && !isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Apenas o dono do clã ou admins podem ver inscrições",
        });
      }

      return ctx.db.clanApplication.findMany({
        where: { clanId: input.clanId, status: input.status },
        include: {
          clipper: {
            select: {
              id: true,
              fullName: true,
              artisticName: true,
              discordUsername: true,
              user: { select: { id: true, imageUrl: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  // ── Owner/Admin: aprovar inscrição ──
  approveApplication: privateProcedure
    .input(z.object({ applicationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const application = await ctx.db.clanApplication.findUnique({
        where: { id: input.applicationId },
        include: { clan: { select: { ownerId: true, adminId: true } } },
      });

      if (!application) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inscrição não encontrada",
        });
      }

      const clipper = await ctx.db.clipperProfile.findUnique({
        where: { userId: ctx.userId },
        select: { id: true },
      });

      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { role: true },
      });

      const isOwner = isClanManager(clipper, application.clan);
      const isAdmin = user?.role === "ADMIN";

      if (!isOwner && !isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Apenas o dono do clã ou admins podem aprovar inscrições",
        });
      }

      if (application.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Esta inscrição já foi processada",
        });
      }

      // Verifica se clipper já pertence a outro clã
      const applicantProfile = await ctx.db.clipperProfile.findUnique({
        where: { id: application.clipperId },
        select: { clanId: true },
      });

      if (applicantProfile?.clanId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Este clipador já pertence a outro clã",
        });
      }

      // Aprova e adiciona ao clã
      await ctx.db.clanApplication.update({
        where: { id: input.applicationId },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
          reviewedBy: ctx.userId,
        },
      });

      return ctx.db.clipperProfile.update({
        where: { id: application.clipperId },
        data: { clanId: application.clanId },
      });
    }),

  // ── Owner/Admin: rejeitar inscrição (remove para o clipador poder aplicar novamente) ──
  rejectApplication: privateProcedure
    .input(z.object({ applicationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const application = await ctx.db.clanApplication.findUnique({
        where: { id: input.applicationId },
        include: { clan: { select: { ownerId: true, adminId: true } } },
      });

      if (!application) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inscrição não encontrada",
        });
      }

      const clipper = await ctx.db.clipperProfile.findUnique({
        where: { userId: ctx.userId },
        select: { id: true },
      });

      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { role: true },
      });

      const isOwner = isClanManager(clipper, application.clan);
      const isAdmin = user?.role === "ADMIN";

      if (!isOwner && !isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Apenas o dono do clã ou admins podem rejeitar inscrições",
        });
      }

      if (application.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Esta inscrição já foi processada",
        });
      }

      // Remove a application para o clipador poder aplicar novamente
      return ctx.db.clanApplication.delete({
        where: { id: input.applicationId },
      });
    }),

  // ── Admin: definir dono de um clã ──
  setOwner: adminProcedure
    .input(
      z.object({
        clanId: z.string(),
        clipperId: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const clan = await ctx.db.clan.findUnique({
        where: { id: input.clanId },
      });

      if (!clan) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clã não encontrado",
        });
      }

      if (input.clipperId) {
        const clipper = await ctx.db.clipperProfile.findUnique({
          where: { id: input.clipperId },
          select: { id: true, clanId: true },
        });

        if (!clipper) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Clipador não encontrado",
          });
        }

        // Se o clipper não é membro do clã, adiciona automaticamente
        if (clipper.clanId !== input.clanId) {
          await ctx.db.clipperProfile.update({
            where: { id: input.clipperId },
            data: { clanId: input.clanId },
          });
        }
      }

      return ctx.db.clan.update({
        where: { id: input.clanId },
        data: {
          ownerId: input.clipperId,
          ...(input.clipperId && clan.adminId === input.clipperId
            ? { adminId: null }
            : {}),
        },
      });
    }),

  // ── Admin: definir administrador secundário de um clã ──
  setAdmin: adminProcedure
    .input(
      z.object({
        clanId: z.string(),
        clipperId: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const clan = await ctx.db.clan.findUnique({
        where: { id: input.clanId },
      });

      if (!clan) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clã não encontrado",
        });
      }

      if (input.clipperId) {
        if (input.clipperId === clan.ownerId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "O dono do clã já é administrador principal",
          });
        }

        const clipper = await ctx.db.clipperProfile.findUnique({
          where: { id: input.clipperId },
          select: { id: true, clanId: true },
        });

        if (!clipper) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Clipador não encontrado",
          });
        }

        if (clipper.clanId !== input.clanId) {
          await ctx.db.clipperProfile.update({
            where: { id: input.clipperId },
            data: { clanId: input.clanId },
          });
        }
      }

      return ctx.db.clan.update({
        where: { id: input.clanId },
        data: { adminId: input.clipperId },
      });
    }),

  // ── Admin: listar clipadores para selecionar como dono ──
  searchClippers: adminProcedure
    .input(z.object({ search: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const q = input.search;

      return ctx.db.clipperProfile.findMany({
        where: {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { artisticName: { contains: q, mode: "insensitive" } },
            { discordUsername: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 10,
        select: {
          id: true,
          fullName: true,
          artisticName: true,
          discordUsername: true,
          clanId: true,
          user: { select: { imageUrl: true } },
        },
      });
    }),

  getReports: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const [clans, allApprovedApps, totalPending] = await Promise.all([
      ctx.db.clan.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          tag: true,
          emoji: true,
          emojiColor: true,
          imageUrl: true,
          createdAt: true,
          _count: { select: { members: true, applications: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      ctx.db.clanApplication.findMany({
        where: { status: "APPROVED" },
        select: {
          clanId: true,
          createdAt: true,
          reviewedAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      ctx.db.clanApplication.count({ where: { status: "PENDING" } }),
    ]);

    const totalMembers = clans.reduce((s, c) => s + c._count.members, 0);
    const todayApproved = allApprovedApps.filter((a) => {
      const d = a.reviewedAt ?? a.createdAt;
      return d >= todayStart;
    }).length;
    const last7dApproved = allApprovedApps.filter((a) => {
      const d = a.reviewedAt ?? a.createdAt;
      return d >= sevenDaysAgo;
    }).length;
    const last30dApproved = allApprovedApps.filter((a) => {
      const d = a.reviewedAt ?? a.createdAt;
      return d >= thirtyDaysAgo;
    }).length;

    const clanById = new Map(clans.map((c) => [c.id, c]));

    const dateRange: string[] = [];
    for (
      let d = new Date(ninetyDaysAgo);
      d <= now;
      d.setDate(d.getDate() + 1)
    ) {
      dateRange.push(d.toISOString().slice(0, 10));
    }

    const dailyCumulative = new Map<string, Map<string, number>>();
    for (const clan of clans) {
      dailyCumulative.set(clan.id, new Map());
    }

    const clanApprovedByDate = new Map<string, Map<string, number>>();
    for (const app of allApprovedApps) {
      const joinDate = (app.reviewedAt ?? app.createdAt)
        .toISOString()
        .slice(0, 10);
      if (!clanApprovedByDate.has(app.clanId)) {
        clanApprovedByDate.set(app.clanId, new Map());
      }
      const m = clanApprovedByDate.get(app.clanId)!;
      m.set(joinDate, (m.get(joinDate) ?? 0) + 1);
    }

    const memberGrowthData: Array<Record<string, string | number>> = [];
    const clanCumulatives = new Map<string, number>();
    for (const clan of clans) {
      const beforeRange = allApprovedApps.filter((a) => {
        const d = (a.reviewedAt ?? a.createdAt).toISOString().slice(0, 10);
        return a.clanId === clan.id && d < dateRange[0]!;
      }).length;
      clanCumulatives.set(clan.id, beforeRange);
    }

    for (const date of dateRange) {
      const entry: Record<string, string | number> = { date };
      for (const clan of clans) {
        const dayCount = clanApprovedByDate.get(clan.id)?.get(date) ?? 0;
        const prev = clanCumulatives.get(clan.id) ?? 0;
        const newTotal = prev + dayCount;
        clanCumulatives.set(clan.id, newTotal);
        entry[clan.id] = newTotal;
      }
      memberGrowthData.push(entry);
    }

    const clanCards = clans
      .map((clan) => {
        const clanApps = allApprovedApps.filter((a) => a.clanId === clan.id);
        const last7d = clanApps.filter((a) => {
          const d = a.reviewedAt ?? a.createdAt;
          return d >= sevenDaysAgo;
        }).length;
        const last30d = clanApps.filter((a) => {
          const d = a.reviewedAt ?? a.createdAt;
          return d >= thirtyDaysAgo;
        }).length;

        return {
          id: clan.id,
          name: clan.name,
          tag: clan.tag,
          emoji: clan.emoji,
          emojiColor: clan.emojiColor,
          imageUrl: clan.imageUrl,
          createdAt: clan.createdAt,
          memberCount: clan._count.members,
          totalApplications: clan._count.applications,
          totalApproved: clanApps.length,
          last7dApproved: last7d,
          last30dApproved: last30d,
        };
      })
      .sort((a, b) => b.memberCount - a.memberCount);

    const totalClanCreations = clans.reduce<Record<string, number>>(
      (acc, clan) => {
        const d = clan.createdAt.toISOString().slice(0, 10);
        acc[d] = (acc[d] ?? 0) + 1;
        return acc;
      },
      {},
    );
    const clanCreationGrowth: Array<{ date: string; total: number }> = [];
    let cum = 0;
    for (const date of dateRange) {
      cum += totalClanCreations[date] ?? 0;
      clanCreationGrowth.push({ date, total: cum });
    }
    if (cum === 0) {
      cum = clans.filter((c) => c.createdAt < ninetyDaysAgo).length;
      for (const entry of clanCreationGrowth) {
        entry.total += cum;
      }
    }

    return {
      stats: {
        totalClans: clans.length,
        totalMembers,
        todayApproved,
        last7dApproved,
        last30dApproved,
        totalPending,
      },
      clanCards,
      memberGrowthData,
      clanCreationGrowth,
      clansForChart: clans.map((c) => ({
        id: c.id,
        name: c.name,
        tag: c.tag,
        emoji: c.emoji,
        emojiColor: c.emojiColor,
      })),
    };
  }),
});
