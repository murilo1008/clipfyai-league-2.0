import { TRPCError } from "@trpc/server";
import { env } from "@/env";

function getAllowedUserIds() {
  return new Set(
    (env.MANUAL_METRICS_EXTRACTION_ALLOWED_USER_IDS ?? "")
      .split(",")
      .map((userId) => userId.trim())
      .filter(Boolean),
  );
}

export function canTriggerManualMetricsExtraction(userId: string) {
  return getAllowedUserIds().has(userId);
}

export function assertCanTriggerManualMetricsExtraction(userId: string) {
  if (!canTriggerManualMetricsExtraction(userId)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Extração manual de métricas não está disponível para este usuário",
    });
  }
}
