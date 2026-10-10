import {
  type BrandKit,
  type ProjectOptionsInput,
} from "@/server/league-clips/contracts";
const types = ["image/png", "image/webp", "image/jpeg"];
export function validateLogoMeta(file: {
  type: string;
  size: number;
  width: number;
  height: number;
}) {
  if (!types.includes(file.type))
    return file.type === "image/svg+xml"
      ? "SVG não é aceito; envie PNG, WebP ou JPEG."
      : "Envie PNG, WebP ou JPEG.";
  if (file.size > 2 * 1024 * 1024 || file.size <= 0)
    return "O logo deve ter até 2 MB.";
  if (file.width < 16 || file.height < 16)
    return "O logo deve ter pelo menos 16 px de lado.";
  if (file.width > 1024 || file.height > 1024)
    return "O logo deve ter no máximo 1024 px de lado.";
  return null;
}
export function logoReasonMessage(reason: string | null) {
  const reasons: Record<string, string> = {
    svg: "SVG não é aceito; envie PNG, WebP ou JPEG.",
    gif: "GIF não é aceito; envie PNG, WebP ou JPEG.",
    unknown: "O arquivo não é uma imagem válida.",
    too_large_bytes: "O logo deve ter até 2 MB.",
    too_large_px: "O logo deve ter no máximo 1024 px de lado.",
    too_small_px: "O logo deve ter pelo menos 16 px de lado.",
    probe_failed: "Não foi possível ler o logo.",
    decode_failed: "O arquivo de imagem está corrompido.",
    invalid_key: "O logo enviado pertence a outro kit.",
    upload_not_found: "O envio expirou. Escolha o arquivo novamente.",
  };
  return reason
    ? (reasons[reason] ?? "Não foi possível salvar o logo.")
    : "Não foi possível salvar o logo.";
}
export function shouldPollBrandKit(
  kit: Pick<BrandKit, "pending" | "lastError"> | undefined,
) {
  return !!kit?.pending && !kit.lastError;
}
export function selectedBrandKit(
  kits: BrandKit[],
  options: ProjectOptionsInput,
) {
  return options.brandKitId === null
    ? null
    : options.brandKitId
      ? (kits.find((kit) => kit.id === options.brandKitId) ?? null)
      : (kits.find((kit) => kit.isDefault) ?? null);
}
export type TemplateChoice = { key: string; isDefault: boolean };
export function displayTemplateKey(key: string, templates: TemplateChoice[]) {
  return key === "default"
    ? (templates.find((template) => template.isDefault)?.key ?? key)
    : key;
}
export function templateDisplayName(
  key: string | null,
  templates: (TemplateChoice & { name: string })[],
) {
  const resolved = displayTemplateKey(key ?? "default", templates);
  return (
    templates.find((template) => template.key === resolved)?.name ??
    (key && key !== "default" ? key : "Padrão")
  );
}
export function fallbackTemplateOption(
  key: string,
  templates: (TemplateChoice & { name: string })[],
) {
  const value = displayTemplateKey(key, templates);
  return {
    value,
    name: templateDisplayName(value, templates),
    needsFallback: !templates.some((template) => template.key === value),
  };
}
export function effectiveTemplate(
  kits: BrandKit[],
  options: ProjectOptionsInput,
  templates: TemplateChoice[] = [],
) {
  const key =
    options.captionTemplateKey ??
    selectedBrandKit(kits, options)?.defaultTemplateKey ??
    "default";
  return displayTemplateKey(key, templates);
}
export async function logoDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () =>
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Não foi possível ler o logo."));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function putLogo(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error("Falha ao enviar logo."));
    xhr.onerror = () => reject(new Error("Falha de rede ao enviar logo."));
    xhr.send(file);
  });
}
