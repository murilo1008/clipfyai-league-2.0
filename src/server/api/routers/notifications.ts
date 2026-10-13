import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, privateProcedure } from "@/server/api/trpc";
import {
  accessibleAnnouncementApplicationStatuses,
  announcementActionUrl,
  announcementAudienceWhere,
} from "@/server/competition-announcement-notifications";
import { cachedQuery, invalidateCachedQueries } from "@/server/memory-cache";

// O badge do sino é consultado por polling em todas as páginas do clipador.
// Cache curto por usuário + filtro, só para "nada pendente" (o caso comum):
// com avisos não lidos, a consulta seguinte ao markRead precisa vir do banco
// mesmo caindo em outra instância. Avisos novos podem levar até 15 s.
const UNREAD_SUMMARY_TTL_MS = 15_000;

function unreadSummaryCachePrefix(userId: string) {
  return `notifications:unreadSummary:${userId}:`;
}

/**
 * Mesmas regras de requireAnnouncementClipper (perfil de clipador, papel
 * CLIPPER e não banido) numa única consulta: o filtro pela relação `user`
 * entra no mesmo SELECT, enquanto o select aninhado de `user` faria uma
 * segunda ida ao banco.
 */
async function requireInboxClipperId(
  db: Prisma.TransactionClient,
  userId: string,
) {
  const profile = await db.clipperProfile.findUnique({
    where: {
      userId,
      verificationStatus: { not: "BANNED" },
      user: { role: "CLIPPER" },
    },
    select: { id: true },
  });
  if (!profile) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acesso restrito aos clipadores participantes.",
    });
  }
  return profile.id;
}

function visibleNotificationsWhere(
  userId: string,
  clipperProfileId: string,
  campaignSlug?: string,
): Prisma.NotificationWhereInput {
  return {
    userId,
    channel: "IN_APP",
    announcementId: { not: null },
    announcement: {
      ...announcementAudienceWhere(clipperProfileId),
      campaign: {
        ...(campaignSlug ? { slug: campaignSlug } : {}),
        status: { not: "ARCHIVED" },
        applications: {
          some: {
            clipperProfileId,
            status: { in: accessibleAnnouncementApplicationStatuses },
          },
        },
      },
    },
  };
}

export const notificationsRouter = createTRPCRouter({
  unreadSummary: privateProcedure
    .input(
      z
        .object({ slug: z.string().trim().min(1).optional() })
        .strict()
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const cacheKey = `${unreadSummaryCachePrefix(ctx.userId)}${input?.slug ?? ""}`;
      const summary = await cachedQuery(
        cacheKey,
        UNREAD_SUMMARY_TTL_MS,
        async () => {
          const clipperProfileId = await requireInboxClipperId(
            ctx.db,
            ctx.userId,
          );
          const groups = await ctx.db.notification.groupBy({
            by: ["campaignId"],
            where: {
              ...visibleNotificationsWhere(
                ctx.userId,
                clipperProfileId,
                input?.slug,
              ),
              isRead: false,
            },
            _count: { id: true },
          });
          const byCampaign: Record<string, number> = {};
          for (const group of groups)
            if (group.campaignId)
              byCampaign[group.campaignId] = group._count.id;
          return {
            total: Object.values(byCampaign).reduce(
              (total, count) => total + count,
              0,
            ),
            byCampaign,
          };
        },
      );
      // Por prefixo: pode descartar também outras chaves do usuário (seguro).
      if (summary.total > 0) invalidateCachedQueries(cacheKey);
      return summary;
    }),

  list: privateProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).default(20),
          slug: z.string().trim().min(1).optional(),
          cursor: z
            .object({ id: z.string().min(1), createdAt: z.date() })
            .nullish(),
          direction: z.enum(["forward", "backward"]).optional(),
        })
        .strict(),
    )
    .query(async ({ ctx, input }) => {
      const clipperProfileId = await requireInboxClipperId(ctx.db, ctx.userId);
      const records = await ctx.db.notification.findMany({
        where: {
          ...visibleNotificationsWhere(
            ctx.userId,
            clipperProfileId,
            input.slug,
          ),
          ...(input.cursor
            ? {
                OR: [
                  { createdAt: { lt: input.cursor.createdAt } },
                  {
                    createdAt: input.cursor.createdAt,
                    id: { lt: input.cursor.id },
                  },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: input.limit + 1,
        select: {
          id: true,
          isRead: true,
          createdAt: true,
          announcement: {
            select: {
              id: true,
              title: true,
              category: true,
              campaign: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      });
      const hasMore = records.length > input.limit;
      if (hasMore) records.pop();
      const last = records.at(-1);
      return {
        items: records.flatMap((record) =>
          record.announcement
            ? [
                {
                  id: record.id,
                  isRead: record.isRead,
                  createdAt: record.createdAt,
                  announcementId: record.announcement.id,
                  title: record.announcement.title,
                  category: record.announcement.category,
                  campaignName: record.announcement.campaign.name,
                  actionUrl: announcementActionUrl(
                    record.announcement.campaign.slug,
                    record.announcement.id,
                  ),
                },
              ]
            : [],
        ),
        nextCursor:
          hasMore && last
            ? { id: last.id, createdAt: last.createdAt }
            : undefined,
      };
    }),

  getAnnouncement: privateProcedure
    .input(
      z
        .object({ slug: z.string().min(1), announcementId: z.string().min(1) })
        .strict(),
    )
    .query(async ({ ctx, input }) => {
      const clipperProfileId = await requireInboxClipperId(ctx.db, ctx.userId);
      const post = await ctx.db.competitionAnnouncement.findFirst({
        where: {
          id: input.announcementId,
          ...announcementAudienceWhere(clipperProfileId),
          campaign: {
            slug: input.slug,
            status: { not: "ARCHIVED" },
            applications: {
              some: {
                clipperProfileId,
                status: { in: accessibleAnnouncementApplicationStatuses },
              },
            },
          },
        },
        select: {
          id: true,
          category: true,
          title: true,
          content: true,
          linkUrl: true,
          createdAt: true,
          updatedAt: true,
          notifications: {
            where: { userId: ctx.userId, channel: "IN_APP" },
            select: { isRead: true },
            take: 1,
          },
        },
      });
      if (!post)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Este aviso não está disponível para você.",
        });
      const { notifications, ...content } = post;
      return {
        ...content,
        isUnread: notifications.some((notification) => !notification.isRead),
      };
    }),

  markRead: privateProcedure
    .input(z.object({ announcementId: z.string().min(1) }).strict())
    .mutation(async ({ ctx, input }) => {
      const clipperProfileId = await requireInboxClipperId(ctx.db, ctx.userId);
      const result = await ctx.db.notification.updateMany({
        where: {
          ...visibleNotificationsWhere(ctx.userId, clipperProfileId),
          announcementId: input.announcementId,
          isRead: false,
        },
        data: { isRead: true, readAt: new Date() },
      });
      // O cliente invalida o contador logo após marcar como lido.
      invalidateCachedQueries(unreadSummaryCachePrefix(ctx.userId));
      return { success: true, updated: result.count };
    }),
});
