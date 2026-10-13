/**
 * Cache em memória por instância do servidor, para resultados agregados que
 * podem ficar alguns segundos ou minutos defasados (rankings, totais, listas
 * iguais para todos os usuários).
 *
 * - A promessa entra no cache antes de resolver: consultas simultâneas com a
 *   mesma chave aguardam a mesma leitura em vez de repeti-la.
 * - Falhas não ficam em cache: a próxima chamada tenta de novo.
 * - Entradas vencidas são descartadas numa varredura feita no máximo a cada
 *   `MEMORY_CACHE_SWEEP_INTERVAL_MS` (não a cada leitura que falha no cache).
 * - O cache guarda no máximo `MEMORY_CACHE_MAX_ENTRIES` chaves: ao passar do
 *   limite, as inseridas há mais tempo saem primeiro. Isso limita a memória
 *   mesmo quando a chave depende de entrada do usuário (datas, limites).
 *
 * Cada instância (serverless) tem o próprio cache; use TTLs curtos o bastante
 * para que a defasagem seja aceitável sem invalidação explícita.
 */
export const MEMORY_CACHE_MAX_ENTRIES = 5_000;
export const MEMORY_CACHE_SWEEP_INTERVAL_MS = 10_000;

const cache = new Map<string, { expiresAt: number; value: Promise<unknown> }>();
let lastSweepAt = 0;

function sweepExpired(now: number) {
  lastSweepAt = now;
  for (const [cachedKey, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(cachedKey);
  }
}

export function cachedQuery<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value as Promise<T>;

  if (now - lastSweepAt >= MEMORY_CACHE_SWEEP_INTERVAL_MS) sweepExpired(now);

  const value = load();
  const entry = { expiresAt: now + ttlMs, value };
  // A chave volta para o fim da ordem de inserção (a vencida sai antes).
  cache.delete(key);
  // Limite de tamanho: descarta as chaves inseridas há mais tempo. Quem já
  // recebeu a promessa de uma chave descartada continua aguardando por ela.
  while (cache.size >= MEMORY_CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
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

/** Quantidade de chaves guardadas (inclui as vencidas ainda não varridas). */
export function cachedQueryCount() {
  return cache.size;
}
