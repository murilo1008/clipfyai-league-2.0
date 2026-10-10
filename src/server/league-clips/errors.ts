import { TRPCError } from "@trpc/server";
import { errorCodeSchema } from "./contracts";

import { messages } from "@/lib/ai-clips/messages";
export class LeagueErrorCause extends Error {
  constructor(
    public readonly leagueCode: string,
    public readonly leagueMessage: string,
    public readonly details: unknown,
    public readonly status: number,
  ) {
    super(leagueMessage);
  }
}
export function leagueError(status: number, body: unknown): TRPCError {
  const raw = (
    body && typeof body === "object" && "error" in body ? body.error : null
  ) as { code?: unknown; message?: unknown; details?: unknown } | null;
  const parsed = errorCodeSchema.safeParse(raw?.code);
  const code = parsed.success ? parsed.data : "INTERNAL";
  const trpcCode =
    status === 401
      ? "UNAUTHORIZED"
      : status === 403
        ? "FORBIDDEN"
        : status === 404
          ? "NOT_FOUND"
          : status === 400
            ? "BAD_REQUEST"
            : status === 402
              ? "PAYMENT_REQUIRED"
              : status === 410
                ? "NOT_FOUND"
                : status === 413
                  ? "PAYLOAD_TOO_LARGE"
                  : status === 503
                    ? "SERVICE_UNAVAILABLE"
                    : status === 429
                      ? "TOO_MANY_REQUESTS"
                      : status === 409
                        ? "CONFLICT"
                        : "INTERNAL_SERVER_ERROR";
  const rawMessage =
    typeof raw?.message === "string" && raw.message.trim()
      ? raw.message
      : status === 503
        ? "AI Clips indisponível. Tente novamente em instantes."
        : messages[code];
  return new TRPCError({
    code: trpcCode,
    message: rawMessage,
    cause: new LeagueErrorCause(code, rawMessage, raw?.details ?? null, status),
  });
}
