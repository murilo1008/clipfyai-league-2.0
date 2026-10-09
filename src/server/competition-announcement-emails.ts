import { Resend } from "resend";

import {
  buildCompetitionAnnouncementEmail,
  COMPETITION_ANNOUNCEMENT_EMAIL_FROM,
  type CompetitionAnnouncementEmailInput,
} from "@/lib/emails/competition-announcement";

export async function sendCompetitionAnnouncementEmails(
  input: CompetitionAnnouncementEmailInput & {
    announcementId: string;
    recipients: string[];
  },
) {
  const recipients = [
    ...new Set(
      input.recipients
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (recipients.length === 0) return { sent: 0, error: null };
  if (!process.env.RESEND_API_KEY) {
    return { sent: 0, error: "O envio de e-mails não está configurado." };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const email = buildCompetitionAnnouncementEmail(input);
  let sent = 0;
  const errors: string[] = [];

  for (let index = 0; index < recipients.length; index += 100) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, 600));
    const chunk = recipients.slice(index, index + 100);
    try {
      const result = await resend.batch.send(
        chunk.map((recipient) => ({
          from: COMPETITION_ANNOUNCEMENT_EMAIL_FROM,
          to: recipient,
          ...email,
        })),
        {
          idempotencyKey: `competition-announcement/${input.announcementId}/${index / 100}`,
        },
      );
      if (result.error) errors.push(result.error.message);
      else if (result.data) {
        sent += result.data.data.length;
        if (result.data.data.length < chunk.length) {
          errors.push("Nem todos os e-mails tiveram o envio confirmado.");
        }
      } else errors.push("O serviço de e-mail não confirmou o envio.");
    } catch {
      errors.push("Não foi possível enviar um lote de e-mails.");
    }
  }

  return {
    sent,
    error: errors.length > 0 ? [...new Set(errors)].join("; ") : null,
  };
}
