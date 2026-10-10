import { type Clip, type Project } from "@/server/league-clips/contracts";
import { preferredCardRender } from "./render-assets";

export function youtubeThumbnailUrl(raw: string | null) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    const segments = url.pathname.split("/").filter(Boolean);
    let id: string | null = null;
    if (host === "youtu.be") id = segments[0] ?? null;
    else if (
      [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "music.youtube.com",
        "youtube-nocookie.com",
        "www.youtube-nocookie.com",
      ].includes(host)
    ) {
      if (segments[0] === "watch") id = url.searchParams.get("v");
      else if (["shorts", "embed", "live"].includes(segments[0] ?? ""))
        id = segments[1] ?? null;
    }
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id)
      ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
      : null;
  } catch {
    return null;
  }
}

export function projectThumbnailUrls(source: Project["source"]) {
  return [
    ...new Set(
      [source.thumbnailUrl, youtubeThumbnailUrl(source.url)].filter(
        (url): url is string => !!url,
      ),
    ),
  ];
}

export function projectClipThumbnail(clips: Clip[]) {
  for (const clip of [...clips].sort((a, b) => a.rank - b.rank)) {
    const render = preferredCardRender(
      clip.renders.filter((render) => !!render.thumbnailUrl),
      clip.version,
    );
    if (render?.thumbnailUrl) return render.thumbnailUrl;
  }
  return null;
}
