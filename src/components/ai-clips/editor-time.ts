import {
  CLIP_DURATION_FLOOR_MS,
  CLIP_DURATION_CEILING_MS,
} from "@/server/league-clips/contracts";

export function msToTime(ms: number) {
  const hours = Math.floor(ms / 3600000),
    minutes = Math.floor((ms % 3600000) / 60000),
    seconds = Math.floor((ms % 60000) / 1000),
    millis = ms % 1000;
  return (
    [hours, minutes, seconds].map((v) => String(v).padStart(2, "0")).join(":") +
    "." +
    String(millis).padStart(3, "0")
  );
}
export function timeToMs(value: string) {
  const match = /^(\d{1,2}):([0-5]\d):([0-5]\d)(?:\.(\d{1,3}))?$/.exec(
    value.trim(),
  );
  if (!match) return null;
  return (
    Number(match[1]) * 3600000 +
    Number(match[2]) * 60000 +
    Number(match[3]) * 1000 +
    Number((match[4] ?? "").padEnd(3, "0"))
  );
}
export function validateCut(
  start: number,
  end: number,
  sourceDuration?: number | null,
) {
  if (start < 0 || end <= start)
    return "O fim precisa ser posterior ao início.";
  if (
    end - start < CLIP_DURATION_FLOOR_MS ||
    end - start > CLIP_DURATION_CEILING_MS
  )
    return (
      "A duração deve ficar entre " +
      CLIP_DURATION_FLOOR_MS / 1000 +
      " e " +
      CLIP_DURATION_CEILING_MS / 1000 +
      " segundos."
    );
  if (sourceDuration && end > sourceDuration)
    return "O fim ultrapassa a duração do vídeo.";
  return null;
}
