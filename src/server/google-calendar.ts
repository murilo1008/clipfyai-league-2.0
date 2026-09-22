function leagueApiUrl() {
  return (process.env.LEAGUE_API_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

async function requestLeague<T>(path: string, body: unknown): Promise<T> {
  const apiKey = process.env.LEAGUE_INTERNAL_API_KEY?.trim();
  if (!apiKey) throw new Error("LEAGUE_INTERNAL_API_KEY não está configurada");
  const response = await fetch(`${leagueApiUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-api-key": apiKey,
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `League respondeu HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function startGoogleCalendarConnection(input: {
  userId: string;
  campaignId: string;
  forceConsent: boolean;
}) {
  return requestLeague<{ redirectUrl: string }>(
    "/api/v1/google-calendar/connect",
    input,
  );
}

export function disconnectGoogleCalendar(input: {
  userId: string;
  campaignId: string;
}) {
  return requestLeague<{ disconnected: boolean; cleanupWarning?: string }>(
    "/api/v1/google-calendar/disconnect",
    input,
  );
}

export async function forwardGoogleCalendarCallback(requestUrl: URL) {
  const callback = new URL("/api/v1/google-calendar/callback", leagueApiUrl());
  requestUrl.searchParams.forEach((value, key) =>
    callback.searchParams.append(key, value),
  );
  const response = await fetch(callback, {
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const destination = response.headers.get("location");
  if (!destination || (response.status !== 301 && response.status !== 302)) {
    throw new Error(`Callback do League respondeu HTTP ${response.status}`);
  }
  return destination;
}
