import {
  ANNOUNCEMENT_CATEGORIES,
  type AnnouncementCategory,
} from "@/lib/competition-announcements";

export const COMPETITION_ANNOUNCEMENT_EMAIL_FROM =
  "ClipfyAI <noreply@league.clipfyai.com>";

export type CompetitionAnnouncementEmailInput = {
  announcementId?: string;
  campaignName: string;
  campaignSlug: string;
  category: AnnouncementCategory;
  title: string;
  content: string;
  linkUrl: string | null;
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

export function buildCompetitionAnnouncementEmail(
  input: CompetitionAnnouncementEmailInput,
) {
  const campaignName = input.campaignName.trim().replace(/\s+/g, " ");
  const title = input.title.trim().replace(/\s+/g, " ");
  const category = ANNOUNCEMENT_CATEGORIES[input.category].label;
  const preheader = `${campaignName}: ${title}`;
  const competitionUrl = new URL(
    `/my-competitions/${encodeURIComponent(input.campaignSlug)}?tab=announcements`,
    input.appUrl || "https://league.clipfyai.com",
  );
  if (input.announcementId)
    competitionUrl.searchParams.set("announcement", input.announcementId);

  return {
    subject: `${category} — ${campaignName}: ${title}`,
    text: [
      "Clipfy League",
      campaignName,
      category,
      title,
      input.content,
      ...(input.linkUrl ? [`Acessar conteúdo: ${input.linkUrl}`] : []),
      `Ver mural da competição: ${competitionUrl}`,
    ].join("\n\n"),
    html: `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:24px 12px;background:#03101b;font-family:Arial,Helvetica,sans-serif;color:#ecf7f9;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;"><tr><td style="padding:24px;background:#071b29;border:1px solid #1d3b49;border-radius:16px;">
<p style="margin:0 0 16px;font-size:24px;font-weight:bold;color:#14f7ff;">Clipfy League</p>
<p style="margin:0 0 12px;color:#b6ccd6;">${escapeHtml(campaignName)}</p>
<p style="margin:0 0 24px;color:#37ff9f;">${escapeHtml(category)}</p>
<h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;overflow-wrap:anywhere;">${escapeHtml(input.title)}</h1>
<div style="font-size:15px;line-height:1.7;color:#b6ccd6;overflow-wrap:anywhere;">${escapeHtml(input.content).replace(/\r?\n/g, "<br>")}</div>
${input.linkUrl ? `<p><a href="${escapeHtml(input.linkUrl)}" style="color:#14f7ff;">Acessar conteúdo</a></p>` : ""}
<p style="margin:28px 0 0;"><a href="${escapeHtml(competitionUrl.toString())}" style="display:inline-block;padding:14px 22px;background:#14f7ff;border-radius:10px;color:#04222a;text-decoration:none;font-weight:bold;">Ver mural da competição</a></p>
</td></tr></table></td></tr></table></body></html>`,
  };
}
