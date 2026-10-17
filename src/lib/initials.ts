/**
 * Iniciais para avatares: primeiras letras de até duas palavras do nome
 * (ou do fallback, normalmente o e-mail). Nunca devolve string vazia.
 */
export function initialsOf(
  name: string | null | undefined,
  fallback = "",
  empty = "CL",
) {
  const source = (name ?? "").trim() || fallback.trim();
  const letters = source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
  return letters || empty;
}
