import { type Project } from "@/server/league-clips/contracts";
export const layoutLabels = {
  AUTO: "Automático",
  FACE_TRACK: "Rosto",
  SPLIT: "Dividido",
  BLUR: "Fundo desfocado",
  CENTER: "Centro",
} as const;
export const tierLabels = {
  FREE: "Gratuito",
  STARTER: "Inicial",
  PRO: "Pro",
  BUSINESS: "Empresarial",
} as const;
export const platformLabels: Record<
  NonNullable<Project["source"]["platform"]>,
  string
> = {
  YOUTUBE: "YouTube",
  TWITCH: "Twitch",
  KICK: "Kick",
  TIKTOK: "TikTok",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  VIMEO: "Vimeo",
  GOOGLE_DRIVE: "Google Drive",
  UPLOAD: "Arquivo",
  OTHER: "Outra plataforma",
};
const optionLabels: Record<string, string> = {
  clipCount: "o máximo de clipes",
  minDurationMs: "a duração ideal inicial",
  maxDurationMs: "a duração ideal final",
  captionTemplateKey: "o template da legenda",
  aspectRatios: "os formatos",
  keyterms: "as palavras-chave",
  brandKitId: "o brand kit",
  layout: "o layout",
  language: "o idioma",
  introTitle: "o título de abertura",
};
export function optionErrorPt(path: PropertyKey[], message?: string) {
  if (
    (path[0] === "minDurationMs" ||
      path[0] === "maxDurationMs" ||
      path[0] === "introTitle") &&
    message
  )
    return message;
  return (
    "Confira " + (optionLabels[String(path[0])] ?? "as opções do projeto") + "."
  );
}
