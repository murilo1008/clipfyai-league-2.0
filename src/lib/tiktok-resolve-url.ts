/**
 * Resolve TikTok share/short URLs to canonical web video URLs (@user/video/id).
 * Server-only usage recommended (network + SSRF guards).
 */

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const RESOLVE_TIMEOUT_MS = 3000;

/** Hosts we allow as the starting point for resolution (share links). */
const ALLOWED_INITIAL_HOSTS = new Set([
  "tiktok.com",
  "www.tiktok.com",
  "m.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",
]);

const CANONICAL_VIDEO_PATH = /^\/@[^/]+\/video\/\d+/;

export class TikTokUrlResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TikTokUrlResolveError";
  }
}

function hostnameLower(host: string): string {
  return host.replace(/:\d+$/, "").toLowerCase();
}

function isTikTokWebHost(hostname: string): boolean {
  const h = hostnameLower(hostname);
  return h === "tiktok.com" || h === "www.tiktok.com" || h === "m.tiktok.com";
}

export function isAllowedTikTokResolutionHost(hostname: string): boolean {
  return ALLOWED_INITIAL_HOSTS.has(hostnameLower(hostname));
}

export function isCanonicalTikTokVideoUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    if (!isTikTokWebHost(u.hostname)) return false;
    return CANONICAL_VIDEO_PATH.test(u.pathname);
  } catch {
    return false;
  }
}

function normalizeCanonicalTikTokVideoUrlFromString(raw: string): string {
  const u = new URL(raw.trim());
  u.hash = "";
  u.search = "";
  let href = u.toString();
  if (href.endsWith("/")) href = href.slice(0, -1);
  return href;
}

async function fetchFinalUrlAfterRedirects(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS);
  try {
    const tryHead = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": DEFAULT_UA,
        Accept: "text/html,application/xhtml+xml",
      },
    });

    await tryHead.body?.cancel();

    try {
      const headFinal = new URL(tryHead.url);
      if (isTikTokWebHost(headFinal.hostname) && CANONICAL_VIDEO_PATH.test(headFinal.pathname)) {
        return tryHead.url;
      }
    } catch {
      /* fall through to GET */
    }

    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": DEFAULT_UA,
        Accept: "text/html,application/xhtml+xml",
      },
    });

    const finalUrl = res.url;
    await res.body?.cancel();

    try {
      const u = new URL(finalUrl);
      if (isTikTokWebHost(u.hostname) && CANONICAL_VIDEO_PATH.test(u.pathname)) {
        return finalUrl;
      }
    } catch {
      /* fall through */
    }

    if (!res.ok) {
      throw new TikTokUrlResolveError(
        "Não foi possível resolver o link do TikTok. Abra o vídeo no navegador e use o link que contém /@usuário/video/…",
      );
    }

    return finalUrl;
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      throw new TikTokUrlResolveError(
        "Tempo esgotado ao resolver o link. Abra o vídeo no navegador e cole o link completo (tiktok.com/@…/video/…).",
      );
    }
    if (e instanceof TikTokUrlResolveError) throw e;
    throw new TikTokUrlResolveError(
      "Não foi possível contatar o TikTok. Abra o vídeo no navegador e cole o link completo (tiktok.com/@…/video/…).",
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Returns a canonical TikTok video URL (no query/hash) suitable for storage.
 * No network if the URL is already in @user/video/id form on tiktok.com / www / m.
 */
export async function resolveTikTokPostUrl(inputUrl: string): Promise<string> {
  const trimmed = inputUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new TikTokUrlResolveError("URL do TikTok inválida.");
  }

  if (isCanonicalTikTokVideoUrl(trimmed)) {
    return normalizeCanonicalTikTokVideoUrlFromString(trimmed);
  }

  if (!isAllowedTikTokResolutionHost(parsed.hostname)) {
    throw new TikTokUrlResolveError(
      "Use um link oficial do TikTok (app ou navegador), por exemplo vm.tiktok.com ou tiktok.com.",
    );
  }

  const finalHref = await fetchFinalUrlAfterRedirects(parsed.toString());
  let final: URL;
  try {
    final = new URL(finalHref);
  } catch {
    throw new TikTokUrlResolveError(
      "Resposta inválida ao resolver o link. Abra o vídeo no navegador e cole o link completo.",
    );
  }

  if (!isTikTokWebHost(final.hostname) || !CANONICAL_VIDEO_PATH.test(final.pathname)) {
    throw new TikTokUrlResolveError(
      "Não foi possível obter o link do vídeo. Abra o vídeo no navegador e cole a URL que começa com tiktok.com/@…/video/…",
    );
  }

  return normalizeCanonicalTikTokVideoUrlFromString(final.href);
}
