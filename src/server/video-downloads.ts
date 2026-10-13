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

/** O League só enfileira (responde 202); o download em si roda no worker. */
const LEAGUE_REQUEST_TIMEOUT_MS = 20_000;

async function requestLeague<T>(path: string, body: unknown): Promise<T> {
  const key = getInternalApiKey();
  if (!key) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Configure LEAGUE_INTERNAL_API_KEY para processar downloads de vídeos.",
    });
  }

  let response: Response;
  let text: string;
  try {
    // O prazo cobre também a leitura do corpo.
    response = await fetch(`${getLeagueApiUrl()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": key,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(LEAGUE_REQUEST_TIMEOUT_MS),
    });
    text = await response.text();
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw new TRPCError({
        code: "TIMEOUT",
        message:
          "O serviço de downloads não respondeu a tempo. Tente novamente em instantes.",
        cause: error,
      });
    }
    throw error;
  }
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
