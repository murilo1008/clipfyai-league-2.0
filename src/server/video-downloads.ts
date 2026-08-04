import { TRPCError } from "@trpc/server";

function getLeagueApiUrl() {
  return (process.env.LEAGUE_API_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

function getInternalApiKey() {
  return (process.env.LEAGUE_INTERNAL_API_KEY || "").trim();
}

async function requestLeague<T>(path: string, body: unknown): Promise<T> {
  const key = getInternalApiKey();
  if (!key) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Configure LEAGUE_INTERNAL_API_KEY para processar downloads de vídeos.",
    });
  }

  const response = await fetch(`${getLeagueApiUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-api-key": key,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      typeof data?.message === "string"
        ? data.message
        : Array.isArray(data?.message)
          ? data.message.join(", ")
          : `Falha ao chamar o League (${response.status})`;
    throw new Error(message);
  }

  return data as T;
}

export function enqueueVideoDownload(clipPostId: string) {
  return requestLeague("/api/v1/video-downloads/enqueue", { clipPostId });
}

export function enqueuePendingVideoDownloads(limit = 3) {
  return requestLeague<{ enqueued: number }>(
    "/api/v1/video-downloads/process-queue",
    {
      limit,
    },
  );
}
