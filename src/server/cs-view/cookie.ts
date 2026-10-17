/**
 * Cookie que guarda qual cliente o usuário CS (CUSTOMER_SUCCESS) está visualizando.
 *
 * Valor: "<csUserId>:<clientId>". O id do CS fica no valor para o cookie ser ignorado
 * caso outro usuário entre no mesmo navegador. O servidor revalida o acesso em TODO
 * request (ver `resolveCsView`); o cookie é apenas a seleção, nunca a autorização.
 */

export const CS_COOKIE_NAME = "clipfy_cs_client";
export const CS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export type CsCookieValue = { actorId: string; clientId: string };

export function isValidCsId(value: string | null | undefined): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

export function serializeCsCookie(value: CsCookieValue) {
  return `${value.actorId}:${value.clientId}`;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Interpreta o VALOR do cookie (sem o nome). */
export function parseCsCookieValue(
  value: string | null | undefined,
): CsCookieValue | null {
  if (!value) return null;
  const decoded = safeDecode(value.trim());
  const separator = decoded.indexOf(":");
  if (separator <= 0) return null;
  const actorId = decoded.slice(0, separator);
  const clientId = decoded.slice(separator + 1);
  if (!isValidCsId(actorId) || !isValidCsId(clientId)) return null;
  return { actorId, clientId };
}

/** Extrai o valor bruto do cookie a partir do header `Cookie` completo. */
export function readCsCookieFromHeader(
  cookieHeader: string | null | undefined,
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq).trim() !== CS_COOKIE_NAME) continue;
    return trimmed.slice(eq + 1).trim();
  }
  return null;
}

/** Interpreta o cookie a partir do header `Cookie` completo. */
export function parseCsCookie(
  cookieHeader: string | null | undefined,
): CsCookieValue | null {
  return parseCsCookieValue(readCsCookieFromHeader(cookieHeader));
}

export function csCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure,
    maxAge: CS_COOKIE_MAX_AGE_SECONDS,
  };
}
