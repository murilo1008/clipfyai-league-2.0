export function waitingForClipVersion(
  currentVersion: number,
  expectedVersion: number | null,
  hasError: boolean,
) {
  return (
    expectedVersion !== null && !hasError && currentVersion < expectedVersion
  );
}
export function waitingForRender(
  currentIds: string[],
  originalIds: string[] | null,
  hasError: boolean,
) {
  return (
    originalIds !== null &&
    !hasError &&
    !currentIds.some((id) => !originalIds.includes(id))
  );
}
export function leagueCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("data" in error)) return null;
  const data = error.data;
  if (!data || typeof data !== "object" || !("leagueError" in data))
    return null;
  const service = data.leagueError;
  if (!service || typeof service !== "object" || !("code" in service))
    return null;
  return typeof service.code === "string" ? service.code : null;
}
