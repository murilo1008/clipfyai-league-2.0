import { auth } from "@clerk/nextjs/server";

import { db } from "@/server/db";

export const runtime = "nodejs";
export const maxDuration = 300;

function safeFileName(value: string | null | undefined) {
  const fallback = "video.mp4";
  if (!value) return fallback;
  const sanitized = value.replace(/[^\w.\-]+/g, "_").slice(0, 160);
  return sanitized || fallback;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ downloadId: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { downloadId } = await context.params;
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

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  const canDownload =
    user?.role === "ADMIN" || download.campaign.clientId === userId;

  if (!canDownload) {
    return new Response("Forbidden", { status: 403 });
  }

  if (download.status !== "SUCCEEDED" || !download.publicUrl) {
    return new Response("Download is not ready", { status: 409 });
  }

  const upstream = await fetch(download.publicUrl);
  if (!upstream.ok || !upstream.body) {
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
