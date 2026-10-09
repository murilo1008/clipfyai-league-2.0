import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  announcementCategorySchema,
  announcementFieldsSchema,
  validateAnnouncementRecipient,
} from "@/lib/competition-announcements";
import {
  adminProcedure,
  createTRPCRouter,
  privateProcedure,
} from "@/server/api/trpc";
import { sendCompetitionAnnouncementEmails } from "@/server/competition-announcement-emails";
import {
  accessibleAnnouncementApplicationStatuses,
  announcementAudienceWhere,
  eligibleAnnouncementRecipientWhere,
  getAnnouncementRecipients,
  requireAnnouncementClipper,
  syncAnnouncementNotifications,
} from "@/server/competition-announcement-notifications";
const publicPostSelect = {
  id: true,
  category: true,
  title: true,
  content: true,
  linkUrl: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CompetitionAnnouncementSelect;

const adminPostSelect = {
  ...publicPostSelect,
  recipientClipperProfileId: true,
  recipient: {
    select: {
      id: true,
      fullName: true,
      artisticName: true,
      user: { select: { email: true } },
    },
  },
  notifyClippers: true,
  notificationSentAt: true,
  notificationRecipientCount: true,
  notificationLastError: true,
} satisfies Prisma.CompetitionAnnouncementSelect;

const eligibleRecipientWhere = eligibleAnnouncementRecipientWhere;

async function requireRecipient(
  db: Prisma.TransactionClient,
  campaignId: string,
  recipientClipperProfileId: string,
) {
  const application = await db.clipperApplication.findFirst({
    where: {
      ...eligibleRecipientWhere,
      campaignId,
      clipperProfileId: recipientClipperProfileId,
    },
    select: {
      clipperProfile: {
        select: { user: { select: { id: true, email: true } } },
      },
    },
  });
  if (!application) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Selecione um clipador aprovado nesta competição.",
    });
  }
  return application.clipperProfile.user;
}

const pageSchema = z.object({
  category: announcementCategorySchema.optional(),
  direction: z.enum(["forward", "backward"]).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.object({ id: z.string().min(1), createdAt: z.date() }).nullish(),
});

function postWhere(
  campaignId: string,
  input: z.infer<typeof pageSchema>,
): Prisma.CompetitionAnnouncementWhereInput {
  return {
    campaignId,
    category: input.category,
    ...(input.cursor
      ? {
          OR: [
            { createdAt: { lt: input.cursor.createdAt } },
            { createdAt: input.cursor.createdAt, id: { lt: input.cursor.id } },
          ],
        }
      : {}),
  };
}

function paginate<T extends { id: string; createdAt: Date }>(
  items: T[],
  limit: number,
) {
  const hasMore = items.length > limit;
  if (hasMore) items.pop();
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      hasMore && last ? { id: last.id, createdAt: last.createdAt } : undefined,
  };
}

export const competitionAnnouncementsRouter = createTRPCRouter({
  campaigns: adminProcedure.query(({ ctx }) =>
    ctx.db.campaign.findMany({
      select: { id: true, name: true, slug: true, status: true },
      orderBy: { createdAt: "desc" },
    }),
  ),

  recipients: adminProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        search: z.string().trim().max(200).default(""),
      }),
    )
    .query(async ({ ctx, input }) => {
      const applications = await ctx.db.clipperApplication.findMany({
        where: {
          ...eligibleRecipientWhere,
          campaignId: input.campaignId,
          clipperProfile: {
            ...eligibleRecipientWhere.clipperProfile,
            ...(input.search
              ? {
                  OR: [
                    {
                      fullName: { contains: input.search, mode: "insensitive" },
                    },
                    {
                      artisticName: {
                        contains: input.search,
                        mode: "insensitive",
                      },
                    },
                    {
                      user: {
                        email: { contains: input.search, mode: "insensitive" },
                      },
                    },
                  ],
                }
              : {}),
          },
        },
        select: {
          clipperProfile: {
            select: {
              id: true,
              fullName: true,
              artisticName: true,
              user: { select: { email: true } },
            },
          },
        },
        orderBy: [{ clipperProfile: { fullName: "asc" } }, { id: "asc" }],
        take: 50,
      });
      return applications.map((application) => application.clipperProfile);
    }),

  listAdmin: adminProcedure
    .input(pageSchema.extend({ campaignId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.competitionAnnouncement.findMany({
        where: postWhere(input.campaignId, input),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: input.limit + 1,
        select: adminPostSelect,
      });
      return paginate(items, input.limit);
    }),

  listForClipper: privateProcedure
    .input(pageSchema.extend({ slug: z.string().min(1) }).strict())
    .query(async ({ ctx, input }) => {
      const profile = await requireAnnouncementClipper(ctx.db, ctx.userId);
      const campaign = await ctx.db.campaign.findUnique({
        where: { slug: input.slug },
        select: { id: true, status: true },
      });
      if (!campaign)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Competição não encontrada.",
        });
      if (campaign.status === "ARCHIVED") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Esta competição não está mais disponível.",
        });
      }
      const application = await ctx.db.clipperApplication.findUnique({
        where: {
          campaignId_clipperProfileId: {
            campaignId: campaign.id,
            clipperProfileId: profile.id,
          },
        },
        select: { status: true },
      });
      if (
        !application ||
        !accessibleAnnouncementApplicationStatuses.includes(application.status)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não está participando desta competição.",
        });
      }
      const items = await ctx.db.competitionAnnouncement.findMany({
        where: {
          ...postWhere(campaign.id, input),
          AND: [announcementAudienceWhere(profile.id)],
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: input.limit + 1,
        select: {
          ...publicPostSelect,
          notifications: {
            where: { userId: ctx.userId, channel: "IN_APP" },
            select: { isRead: true },
            take: 1,
          },
        },
      });
      return paginate(
        items.map(({ notifications, ...post }) => ({
          ...post,
          isUnread: (notifications ?? []).some(
            (notification) => !notification.isRead,
          ),
        })),
        input.limit,
      );
    }),

  create: adminProcedure
    .input(
      announcementFieldsSchema
        .extend({
          campaignId: z.string().min(1),
          notifyClippers: z.boolean().default(false),
        })
        .strict()
        .superRefine(validateAnnouncementRecipient),
    )
    .mutation(async ({ ctx, input }) => {
      const { post, campaign, recipients, inAppNotified } =
        await ctx.db.$transaction(
          async (tx) => {
            const campaign = await tx.campaign.findUnique({
              where: { id: input.campaignId },
              select: { name: true, slug: true, status: true },
            });
            if (!campaign)
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Competição não encontrada.",
              });
            if (campaign.status === "ARCHIVED")
              throw new TRPCError({
                code: "FORBIDDEN",
                message: "Não é possível publicar em uma competição arquivada.",
              });
            const recipient = input.recipientClipperProfileId
              ? await requireRecipient(
                  tx,
                  input.campaignId,
                  input.recipientClipperProfileId,
                )
              : null;
            const post = await tx.competitionAnnouncement.create({
              data: {
                ...input,
                recipientClipperProfileId:
                  input.recipientClipperProfileId ?? null,
              },
              select: adminPostSelect,
            });
            const recipients = await getAnnouncementRecipients(
              tx,
              input.campaignId,
              recipient,
            );
            const inAppNotified = await syncAnnouncementNotifications(
              tx,
              {
                id: post.id,
                campaignId: input.campaignId,
                category: input.category,
                title: input.title,
              },
              campaign,
              recipients,
            );
            return { post, campaign, recipients, inAppNotified };
          },
          { timeout: 20000 },
        );
      if (!input.notifyClippers)
        return { post, notified: 0, notificationError: null, inAppNotified };

      let notification: { sent: number; error: string | null };
      try {
        notification = await sendCompetitionAnnouncementEmails({
          announcementId: post.id,
          campaignName: campaign.name,
          campaignSlug: campaign.slug,
          category: input.category,
          title: input.title,
          content: input.content,
          linkUrl: input.linkUrl ?? null,
          appUrl: process.env.NEXT_PUBLIC_APP_URL,
          recipients: recipients.map((recipient) => recipient.email),
        });
      } catch {
        notification = {
          sent: 0,
          error:
            "Não foi possível enviar os e-mails. A postagem está publicada no mural.",
        };
      }
      // Falhas no envio não desfazem uma publicação já disponível aos clipadores.
      const notificationData = {
        notificationSentAt: notification.error ? null : new Date(),
        notificationRecipientCount: notification.sent,
        notificationLastError: notification.error,
      };
      try {
        // Atualiza somente o resultado do envio, preservando edições concorrentes
        // e a data de alteração do conteúdo, sem acionar o @updatedAt do Prisma.
        const recorded = await ctx.db.$executeRaw`
          UPDATE "CompetitionAnnouncement"
          SET "notificationSentAt" = ${notificationData.notificationSentAt},
              "notificationRecipientCount" = ${notificationData.notificationRecipientCount},
              "notificationLastError" = ${notificationData.notificationLastError}
          WHERE "id" = ${post.id}
        `;
        if (recorded === 0)
          throw new Error("Postagem removida durante o envio");
      } catch {
        notification.error =
          "A postagem foi publicada, mas não foi possível registrar o resultado do envio de e-mails.";
      }
      return {
        post: { ...post, ...notificationData },
        notified: notification.sent,
        notificationError: notification.error,
        inAppNotified,
      };
    }),

  update: adminProcedure
    .input(
      announcementFieldsSchema
        .extend({ id: z.string().min(1), campaignId: z.string().min(1) })
        .strict()
        .superRefine(validateAnnouncementRecipient),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, campaignId, ...data } = input;
      await ctx.db.$transaction(
        async (tx) => {
          const post = await tx.competitionAnnouncement.findFirst({
            where: { id, campaignId },
            select: {
              id: true,
              campaign: { select: { name: true, slug: true, status: true } },
            },
          });
          if (!post)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Postagem não encontrada nesta competição.",
            });
          if (post.campaign.status === "ARCHIVED")
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Não é possível editar uma competição arquivada.",
            });
          const recipient = data.recipientClipperProfileId
            ? await requireRecipient(
                tx,
                campaignId,
                data.recipientClipperProfileId,
              )
            : null;
          const result = await tx.competitionAnnouncement.updateMany({
            where: { id, campaignId },
            data: {
              ...data,
              recipientClipperProfileId: data.recipientClipperProfileId ?? null,
            },
          });
          if (result.count === 0)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Postagem não encontrada nesta competição.",
            });
          const recipients = await getAnnouncementRecipients(
            tx,
            campaignId,
            recipient,
          );
          await syncAnnouncementNotifications(
            tx,
            { id, campaignId, category: data.category, title: data.title },
            post.campaign,
            recipients,
          );
        },
        { timeout: 20000 },
      );
      return { success: true };
    }),

  delete: adminProcedure
    .input(
      z
        .object({ id: z.string().min(1), campaignId: z.string().min(1) })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.competitionAnnouncement.deleteMany({
        where: input,
      });
      if (result.count === 0)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Postagem não encontrada nesta competição.",
        });
      return { success: true };
    }),
});
