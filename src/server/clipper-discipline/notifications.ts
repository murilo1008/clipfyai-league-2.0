import type { ClipperSanctionType, Prisma, PrismaClient } from "@prisma/client";
import { Resend } from "resend";

import { CLIPPER_WARNING_NOTIFICATION_KIND } from "@/lib/clipper-discipline/constants";
import {
  formatScoreMultiplier,
} from "@/lib/clipper-discipline/score-multiplier";
import { SANCTION_TYPE_LABELS } from "@/lib/clipper-discipline/levels";
import { formatRankingDateYmd } from "@/lib/clipper-discipline/podium";
import {
  buildClipperWarningEmail,
  CLIPPER_WARNING_EMAIL_FROM,
  type ClipperWarningEmailInput,
} from "@/lib/emails/clipper-warning";

import { formatDisciplineDate } from "./restrictions";

type Tx = Prisma.TransactionClient;

export type SanctionSummaryInput = {
  type: ClipperSanctionType;
  endsAt: Date | null;
  scoreMultiplierBps?: number | null;
  /** PODIUM_INELIGIBLE: { rankingDate }. */
  metadata?: Prisma.JsonValue | null;
};

/** "Suspensão de envio até 18/10/2026 às 14:30", "Redutor de pontuação ×0,8 até …". */
export function describeSanction(sanction: SanctionSummaryInput): string {
  if (sanction.type === "PODIUM_INELIGIBLE") {
    const rankingDate = (sanction.metadata as { rankingDate?: unknown } | null)
      ?.rankingDate;
    return typeof rankingDate === "string"
      ? `${SANCTION_TYPE_LABELS.PODIUM_INELIGIBLE}: seus vídeos de ${formatRankingDateYmd(rankingDate)} ficam fora dos rankings daquele dia`
      : SANCTION_TYPE_LABELS.PODIUM_INELIGIBLE;
  }
  const label =
    sanction.type === "SCORE_MULTIPLIER" && sanction.scoreMultiplierBps
      ? `${SANCTION_TYPE_LABELS.SCORE_MULTIPLIER} ${formatScoreMultiplier(sanction.scoreMultiplierBps)}`
      : SANCTION_TYPE_LABELS[sanction.type];
  if (sanction.type === "PAYOUT_HOLD" && !sanction.endsAt) {
    return `${label} até liberação pela equipe`;
  }
  if (!sanction.endsAt) return label;
  return `${label} até ${formatDisciplineDate(sanction.endsAt)}`;
}

/**
 * Punição encerrada pela revogação: só o nome, sem prazo ("Pagamento retido
 * até liberação pela equipe" leria como se ainda valesse).
 */
export function describeEndedSanction(sanction: SanctionSummaryInput): string {
  if (sanction.type === "PODIUM_INELIGIBLE") {
    const rankingDate = (sanction.metadata as { rankingDate?: unknown } | null)
      ?.rankingDate;
    return typeof rankingDate === "string"
      ? `${SANCTION_TYPE_LABELS.PODIUM_INELIGIBLE} (${formatRankingDateYmd(rankingDate)})`
      : SANCTION_TYPE_LABELS.PODIUM_INELIGIBLE;
  }
  if (sanction.type === "SCORE_MULTIPLIER" && sanction.scoreMultiplierBps) {
    return `${SANCTION_TYPE_LABELS.SCORE_MULTIPLIER} ${formatScoreMultiplier(sanction.scoreMultiplierBps)}`;
  }
  return SANCTION_TYPE_LABELS[sanction.type];
}

export type WarningNotificationInput = {
  warningId: string;
  userId: string;
  event: "applied" | "revoked";
  title: string;
  message: string;
  campaignId?: string | null;
};

/** Notificação in-app (sino), na mesma transação da advertência. */
export async function createWarningNotification(
  tx: Tx,
  input: WarningNotificationInput,
) {
  return tx.notification.upsert({
    where: {
      idempotencyKey: `clipper-warning:${input.warningId}:${input.event}`,
    },
    create: {
      userId: input.userId,
      type: "SYSTEM_ALERT",
      channel: "IN_APP",
      title: input.title,
      message: input.message,
      actionUrl: "/warnings",
      metadata: {
        kind: CLIPPER_WARNING_NOTIFICATION_KIND,
        warningId: input.warningId,
        event: input.event,
        ...(input.campaignId ? { campaignId: input.campaignId } : {}),
      },
      idempotencyKey: `clipper-warning:${input.warningId}:${input.event}`,
      sentAt: new Date(),
    },
    update: {},
    select: { id: true },
  });
}

/**
 * E-mail da advertência, depois do commit. Falha de envio fica registrada na
 * notificação e não desfaz a advertência.
 */
export async function sendWarningEmail(
  db: PrismaClient,
  input: ClipperWarningEmailInput & {
    notificationId: string;
    to: string | null | undefined;
  },
) {
  const to = input.to?.trim().toLowerCase();
  if (!to) return { sent: false, error: "Clipador sem e-mail." };
  if (!process.env.RESEND_API_KEY) {
    await db.notification
      .update({
        where: { id: input.notificationId },
        data: { emailLastError: "O envio de e-mails não está configurado." },
      })
      .catch(() => undefined);
    return { sent: false, error: "O envio de e-mails não está configurado." };
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const email = buildClipperWarningEmail(input);
    const result = await resend.emails.send(
      { from: CLIPPER_WARNING_EMAIL_FROM, to, ...email },
      { idempotencyKey: `clipper-warning/${input.notificationId}` },
    );
    if (result.error) throw new Error(result.error.message);
    await db.notification.update({
      where: { id: input.notificationId },
      data: { emailSentAt: new Date(), emailLastError: null },
    });
    return { sent: true, error: null };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao enviar o e-mail.";
    await db.notification
      .update({
        where: { id: input.notificationId },
        data: { emailLastError: message.slice(0, 1000) },
      })
      .catch(() => undefined);
    return { sent: false, error: message };
  }
}
