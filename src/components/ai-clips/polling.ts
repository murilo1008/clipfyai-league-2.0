import { type Project } from "@/server/league-clips/contracts";
export const terminal = (s: Project["status"]) =>
  ["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED", "CANCELLED"].includes(s);
export function pollMs(
  status: Project["status"] | undefined,
  createdAt: string | undefined,
  visible: boolean,
  now = Date.now(),
) {
  return !status || terminal(status) || !visible
    ? false
    : now - Date.parse(createdAt ?? new Date().toISOString()) > 120000
      ? 10000
      : 3000;
}
