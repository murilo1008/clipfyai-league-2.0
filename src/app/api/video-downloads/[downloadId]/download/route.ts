import { getViewer } from "@/server/cs-view/viewer";
import { db } from "@/server/db";

export const runtime = "nodejs";
export const maxDuration = 300;

function safeFileName(value: string | null | undefined) {
  const fallback = "video.mp4";
  if (!value) return fallback;
  const sanitized = value.replace(/[^\w.\-]+/g, "_").slice(0, 160);
  return sanitized || fallback;
}

/** Tempo máximo para o storage começar a responder. */
const UPSTREAM_CONNECT_TIMEOUT_MS = 30_000;

export async function GET(
  request: Request,
  context: { params: Promise<{ downloadId: string }> },
) {
  // Em modo Customer Success, `viewer.effective.id` é o cliente visualizado.
  const viewer = await getViewer();
  if (!viewer) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { downloadId } = await context.params;
  // O papel do usuário já veio em `viewer`; só falta o download.
  const download = await db.clipPostBucketVideo.findUnique({
    where: { id: downloadId },
    select: {
      status: true,
      publicUrl: true,
      fileName: true,
      destinationPath: true,
      campaign: {
        select: {
          clientId: true,
        },
      },
    },
  });

  if (!download) {
    return new Response("Download not found", { status: 404 });
  }

  const canDownload =
    viewer.actor.role === "ADMIN" ||
    download.campaign.clientId === viewer.effective.id;

  if (!canDownload) {
    return new Response("Forbidden", { status: 403 });
  }

  if (download.status !== "SUCCEEDED" || !download.publicUrl) {
    return new Response("Download is not ready", { status: 409 });
  }

  // O arquivo é repassado em stream (sem bufferizar na função). O prazo vale
  // só até o storage responder os cabeçalhos; a transferência em si fica
  // limitada pelo maxDuration. Se o cliente cancelar, o upstream é abortado.
  const connect = new AbortController();
  const connectTimeout = setTimeout(
    () => connect.abort(),
    UPSTREAM_CONNECT_TIMEOUT_MS,
  );
  const abortUpstream = () => connect.abort();
  request.signal.addEventListener("abort", abortUpstream, { once: true });
  let upstream: Response;
  try {
    upstream = await fetch(download.publicUrl, { signal: connect.signal });
  } catch {
    request.signal.removeEventListener("abort", abortUpstream);
    return new Response("Could not fetch video file", { status: 502 });
  } finally {
    clearTimeout(connectTimeout);
  }
  if (!upstream.ok || !upstream.body) {
    request.signal.removeEventListener("abort", abortUpstream);
    return new Response("Could not fetch video file", { status: 502 });
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    upstream.headers.get("content-type") || "application/octet-stream",
  );
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);
  headers.set(
    "Content-Disposition",
    `attachment; filename="${safeFileName(download.fileName || download.destinationPath)}"`,
  );
  headers.set("Cache-Control", "private, no-store");

  return new Response(upstream.body, { headers });
}
