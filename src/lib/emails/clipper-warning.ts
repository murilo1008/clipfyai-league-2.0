export const CLIPPER_WARNING_EMAIL_FROM = "ClipfyAI <noreply@league.clipfyai.com>";

export type ClipperWarningEmailInput = {
  event: "applied" | "revoked";
  clipperName: string;
  title: string;
  levelLabel: string;
  reason: string;
  /** Uma linha por punição, já com a duração ("Suspensão de envio até 18/10/2026 às 14:30"). */
  punishments: string[];
  campaignName?: string | null;
  appUrl?: string;
};

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(
    /[&<>"']/g,
    (character) => entities[character] ?? character,
  );
}

export function buildClipperWarningEmail(input: ClipperWarningEmailInput) {
  const warningsUrl = new URL(
    "/warnings",
    input.appUrl || "https://league.clipfyai.com",
  ).toString();
  const intro =
    input.event === "applied"
      ? `Olá, ${input.clipperName}. A equipe da Clipfy League registrou uma advertência na sua conta.`
      : `Olá, ${input.clipperName}. Uma advertência da sua conta foi revogada pela equipe da Clipfy League.`;
  const defenseLine =
    input.event === "applied"
      ? "Se quiser, envie sua defesa pela página Minhas advertências."
      : null;
  const punishmentsTitle =
    input.event === "applied" ? "Punições" : "Punições encerradas";

  const text = [
    "Clipfy League",
    intro,
    `${input.levelLabel}${input.campaignName ? ` — ${input.campaignName}` : ""}`,
    `Motivo: ${input.reason}`,
    ...(input.punishments.length > 0
      ? [`${punishmentsTitle}:\n${input.punishments.map((line) => `- ${line}`).join("\n")}`]
      : []),
    ...(defenseLine ? [defenseLine] : []),
    `Ver minhas advertências: ${warningsUrl}`,
  ].join("\n\n");

  const punishmentsHtml =
    input.punishments.length > 0
      ? `<p style="margin:20px 0 8px;font-weight:bold;">${escapeHtml(punishmentsTitle)}</p>
<ul style="margin:0;padding-left:20px;color:#b6ccd6;line-height:1.7;">${input.punishments
          .map((line) => `<li>${escapeHtml(line)}</li>`)
          .join("")}</ul>`
      : "";

  return {
    subject: `${input.title} — Clipfy League`,
    text,
    html: `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.title)}</title></head>
<body style="margin:0;padding:24px 12px;background:#03101b;font-family:Arial,Helvetica,sans-serif;color:#ecf7f9;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;"><tr><td style="padding:24px;background:#071b29;border:1px solid #1d3b49;border-radius:16px;">
<p style="margin:0 0 16px;font-size:24px;font-weight:bold;color:#14f7ff;">Clipfy League</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;overflow-wrap:anywhere;">${escapeHtml(input.title)}</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#b6ccd6;">${escapeHtml(intro)}</p>
<p style="margin:0 0 8px;color:#ffb547;font-weight:bold;">${escapeHtml(input.levelLabel)}${input.campaignName ? ` — ${escapeHtml(input.campaignName)}` : ""}</p>
<p style="margin:0;font-size:15px;line-height:1.7;color:#b6ccd6;overflow-wrap:anywhere;"><strong>Motivo:</strong> ${escapeHtml(input.reason).replace(/\r?\n/g, "<br>")}</p>
${punishmentsHtml}
${defenseLine ? `<p style="margin:20px 0 0;font-size:15px;color:#b6ccd6;">${escapeHtml(defenseLine)}</p>` : ""}
<p style="margin:28px 0 0;"><a href="${escapeHtml(warningsUrl)}" style="display:inline-block;padding:14px 22px;background:#14f7ff;border-radius:10px;color:#04222a;text-decoration:none;font-weight:bold;">Ver minhas advertências</a></p>
</td></tr></table></td></tr></table></body></html>`,
  };
}
