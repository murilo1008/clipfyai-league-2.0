/**
 * Cache em memória por instância do servidor, para resultados agregados que
 * podem ficar alguns segundos ou minutos defasados (rankings, totais, listas
 * iguais para todos os usuários).
 *
 * - A promessa entra no cache antes de resolver: consultas simultâneas com a
 *   mesma chave aguardam a mesma leitura em vez de repeti-la.
 * - Falhas não ficam em cache: a próxima chamada tenta de novo.
 * - Entradas vencidas são descartadas a cada nova leitura.
 *
 * Cada instância (serverless) tem o próprio cache; use TTLs curtos o bastante
 * para que a defasagem seja aceitável sem invalidação explícita.
 */
const cache = new Map<string, { expiresAt: number; value: Promise<unknown> }>();

export function cachedQuery<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value as Promise<T>;

  for (const [cachedKey, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(cachedKey);
  }

  const value = load();
  const entry = { expiresAt: now + ttlMs, value };
  cache.set(key, entry);
  value.catch(() => {
    if (cache.get(key) === entry) cache.delete(key);
  });
  return value;
}

/** Remove do cache as chaves que começam com o prefixo (ex.: após uma mutação). */
export function invalidateCachedQueries(prefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
