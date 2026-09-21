import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const TOKEN_PREFIX = "enc:v1:";
export const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.events";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} não está configurada`);
  return value;
}

function encryptionKey(): Buffer {
  return createHash("sha256")
    .update(required("GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY"))
    .digest();
}

export function encryptGoogleCalendarToken(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${TOKEN_PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptGoogleCalendarToken(value: string): string {
  if (!value.startsWith(TOKEN_PREFIX)) return value;
  const [iv, tag, encrypted] = value.slice(TOKEN_PREFIX.length).split(".");
  if (!iv || !tag || !encrypted)
    throw new Error("Token Google Calendar inválido");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

type OAuthState = {
  userId: string;
  campaignId: string;
  exp: number;
  nonce: string;
};

export function createGoogleCalendarState(
  userId: string,
  campaignId: string,
): string {
  const payload: OAuthState = {
    userId,
    campaignId,
    exp: Date.now() + 10 * 60_000,
    nonce: randomBytes(16).toString("hex"),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac(
    "sha256",
    required("GOOGLE_CALENDAR_OAUTH_STATE_SECRET"),
  )
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyGoogleCalendarState(state: string): OAuthState {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) throw new Error("Estado OAuth inválido");
  const expected = createHmac(
    "sha256",
    required("GOOGLE_CALENDAR_OAUTH_STATE_SECRET"),
  )
    .update(encoded)
    .digest("base64url");
  const valid =
    signature.length === expected.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) throw new Error("Assinatura OAuth inválida");
  const payload = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8"),
  ) as OAuthState;
  if (!payload.userId || !payload.campaignId || payload.exp < Date.now()) {
    throw new Error("Autorização OAuth expirada");
  }
  return payload;
}

export function googleCalendarRedirectUri(): string {
  return required("GOOGLE_CALENDAR_REDIRECT_URI");
}

export function googleCalendarAuthorizationUrl(state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", required("GOOGLE_CALENDAR_CLIENT_ID"));
  url.searchParams.set("redirect_uri", googleCalendarRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", `${GOOGLE_CALENDAR_SCOPE} openid email`);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeGoogleCalendarCode(code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: required("GOOGLE_CALENDAR_CLIENT_ID"),
      client_secret: required("GOOGLE_CALENDAR_CLIENT_SECRET"),
      redirect_uri: googleCalendarRedirectUri(),
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Google OAuth HTTP ${response.status}`);
  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    scope?: string;
  };
}

export async function fetchGoogleAccountEmail(accessToken: string) {
  const response = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) return null;
  const profile = (await response.json()) as { email?: string };
  return profile.email ?? null;
}

export function googleCalendarEventId(
  campaignId: string,
  kind: string,
): string {
  return `c${createHash("sha256").update(`${campaignId}:${kind}`).digest("hex").slice(0, 31)}`;
}

export async function refreshGoogleAccessToken(
  refreshToken: string,
): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: required("GOOGLE_CALENDAR_CLIENT_ID"),
      client_secret: required("GOOGLE_CALENDAR_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new Error(`Google OAuth refresh HTTP ${response.status}`);
  const token = (await response.json()) as { access_token?: string };
  if (!token.access_token) throw new Error("Google não retornou access token");
  return token.access_token;
}

export async function removeGoogleCalendarCampaignEvents(input: {
  campaignId: string;
  calendarId: string;
  refreshTokenEncrypted: string;
}) {
  const accessToken = await refreshGoogleAccessToken(
    decryptGoogleCalendarToken(input.refreshTokenEncrypted),
  );
  const errors: string[] = [];
  for (const kind of [
    "start",
    "checkin",
    "ending-7",
    "ending-3",
    "ending-1",
    "end",
  ]) {
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events/${googleCalendarEventId(input.campaignId, kind)}`,
    );
    const response = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok && response.status !== 404 && response.status !== 410) {
      errors.push(`${kind}: HTTP ${response.status}`);
    }
  }
  if (errors.length > 0) {
    throw new Error(
      `Falha ao remover eventos do Google Calendar (${errors.join(", ")})`,
    );
  }
}
