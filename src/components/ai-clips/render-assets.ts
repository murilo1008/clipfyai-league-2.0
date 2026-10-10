import { type Clip } from "@/server/league-clips/contracts";

type Render = Clip["renders"][number];
export type RenderAsset = "video" | "srt" | "vtt";

export function renderDownloadUrl(render: Render) {
  return render.downloadUrl === undefined && render.quality !== "preview"
    ? render.videoUrl
    : (render.downloadUrl ?? null);
}

export function freshRenderAsset(
  renders: Render[],
  renderId: string,
  asset: RenderAsset,
) {
  const render = renders.find((item) => item.id === renderId);
  if (!render) return null;
  if (asset === "video") return renderDownloadUrl(render);
  return render.subtitles?.[asset] ?? null;
}

export function preferredCardRender(renders: Render[], clipVersion: number) {
  const ready = renders.filter((render) => render.status === "READY");
  return (
    ready.find(
      (render) =>
        render.version === clipVersion && render.aspectRatio === "9:16",
    ) ??
    ready.find((render) => render.version === clipVersion) ??
    ready.find((render) => render.aspectRatio === "9:16") ??
    ready[0] ??
    renders.find(
      (render) =>
        render.status === "SUPERSEDED" &&
        render.aspectRatio === "9:16" &&
        render.videoUrl,
    ) ??
    renders.find((render) => render.status === "SUPERSEDED" && render.videoUrl)
  );
}

export function isPreviousRender(render: Render, currentVersion: number) {
  return render.version < currentVersion;
}

export function renderDownloadLabel(
  render: Render,
  currentVersion: number,
  format: "MP4" | "SRT" | "VTT",
) {
  const label = format === "MP4" ? `MP4 ${render.aspectRatio}` : format;
  return isPreviousRender(render, currentVersion)
    ? `${label} · versão anterior`
    : label;
}

export function previousRenderState(
  render: Render,
  renders: Render[],
  clipVersion: number,
): "pending" | "failed" | "stale" | null {
  if (!isPreviousRender(render, clipVersion)) return null;
  const current = renders.filter(
    (item) =>
      item.version === clipVersion && item.aspectRatio === render.aspectRatio,
  );
  if (current.some((item) => item.status === "READY")) return null;
  if (current.some((item) => ["QUEUED", "RENDERING"].includes(item.status)))
    return "pending";
  if (current.some((item) => item.status === "FAILED")) return "failed";
  return "stale";
}

export function renderStatusLabel(
  render: Render,
  renders: Render[],
  clipVersion: number,
) {
  const status =
    render.status === "SUPERSEDED"
      ? "Substituída"
      : render.status === "READY"
        ? "Pronta"
        : render.status === "FAILED"
          ? "Falhou"
          : render.status === "CANCELLED"
            ? "Cancelada"
            : "Renderizando";
  const previous = previousRenderState(render, renders, clipVersion);
  const suffix =
    previous === "pending"
      ? " · versão anterior (será substituída)"
      : previous === "failed"
        ? " · versão anterior (novo render falhou)"
        : previous === "stale"
          ? " · versão anterior (edições não renderizadas)"
          : "";
  return status + suffix;
}
