import type { ApplicationStatus, Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import {
  ANNOUNCEMENT_CATEGORIES,
  type AnnouncementCategory,
} from "@/lib/competition-announcements";

export const eligibleAnnouncementRecipientWhere = {
  status: "APPROVED",
  clipperProfile: {
    verificationStatus: { not: "BANNED" },
    user: { role: "CLIPPER" },
  },
} satisfies Prisma.ClipperApplicationWhereInput;

export const accessibleAnnouncementApplicationStatuses: ApplicationStatus[] = [
  "APPROVED",
  "PENDING",
  "UNDER_REVIEW",
];

export function announcementAudienceWhere(
  clipperProfileId: string,
): Prisma.CompetitionAnnouncementWhereInput {
  return {
    OR: [
      { category: { not: "GUIDANCE" }, recipientClipperProfileId: null },
      { category: "GUIDANCE", recipientClipperProfileId: clipperProfileId },
    ],
  };
}

export async function requireAnnouncementClipper(
  db: Prisma.TransactionClient,
  userId: string,
) {
  const profile = await db.clipperProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      verificationStatus: true,
      user: { select: { role: true } },
    },
  });
  if (
    !profile ||
    profile.user.role !== "CLIPPER" ||
    profile.verificationStatus === "BANNED"
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acesso restrito aos clipadores participantes.",
    });
  }
  return profile;
}

export function announcementActionUrl(slug: string, announcementId: string) {
  return `/my-competitions/${encodeURIComponent(slug)}?tab=announcements&announcement=${encodeURIComponent(announcementId)}`;
}

export type AnnouncementRecipient = { id: string; email: string };

export async function getAnnouncementRecipients(
  db: Prisma.TransactionClient,
  campaignId: string,
  recipient: AnnouncementRecipient | null,
) {
  if (recipient) return [recipient];
  const applications = await db.clipperApplication.findMany({
    where: { ...eligibleAnnouncementRecipientWhere, campaignId },
    select: {
      clipperProfile: {
        select: { user: { select: { id: true, email: true } } },
      },
    },
    orderBy: { id: "asc" },
  });
  return applications.map((application) => application.clipperProfile.user);
}

export async function syncAnnouncementNotifications(
  db: Prisma.TransactionClient,
  announcement: {
    id: string;
    campaignId: string;
    category: AnnouncementCategory;
    title: string;
  },
  campaign: { name: string; slug: string },
  recipients: AnnouncementRecipient[],
) {
  const content = {
    title: announcement.title,
    message: `${campaign.name} · ${ANNOUNCEMENT_CATEGORIES[announcement.category].label}`,
    actionUrl: announcementActionUrl(campaign.slug, announcement.id),
    metadata: { category: announcement.category },
  };
  // Alterações de destinatário não deixam alertas privados nas caixas anteriores.
  await db.notification.deleteMany({
    where: {
      announcementId: announcement.id,
      userId: { notIn: recipients.map((recipient) => recipient.id) },
    },
  });
  // Edições preservam o estado de leitura dos destinatários que continuam elegíveis.
  await db.notification.updateMany({
    where: { announcementId: announcement.id },
    data: content,
  });
  if (recipients.length === 0) return 0;
  const result = await db.notification.createMany({
    data: recipients.map((recipient) => ({
      ...content,
      userId: recipient.id,
      campaignId: announcement.campaignId,
      announcementId: announcement.id,
      type: "SYSTEM_ALERT",
      channel: "IN_APP",
      sentAt: new Date(),
      idempotencyKey: `competition-announcement:${announcement.id}:${recipient.id}`,
    })),
    skipDuplicates: true,
  });
  return result.count;
}
