import { afterEach, describe, expect, it, vi } from "vitest";

import { cachedQuery, invalidateCachedQueries } from "./memory-cache";

let sequence = 0;
const key = (prefix = "teste") => `${prefix}:${++sequence}`;

/** Módulo novo (cache vazio, sem varredura anterior) para testar limites. */
async function freshCache() {
  vi.resetModules();
  return import("./memory-cache");
}

afterEach(() => {
  vi.useRealTimers();
});

describe("cachedQuery", () => {
  it("respeita o prazo informado", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T12:00:00.000Z"));
    const k = key();
    const load = vi.fn().mockResolvedValue(1);

    await cachedQuery(k, 30_000, load);
    vi.setSystemTime(new Date("2026-10-13T12:00:29.000Z"));
    await cachedQuery(k, 30_000, load);
    expect(load).toHaveBeenCalledOnce();

    vi.setSystemTime(new Date("2026-10-13T12:00:31.000Z"));
    await cachedQuery(k, 30_000, load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("invalida as chaves pelo prefixo", async () => {
    const campaignKey = key("campanha-1");
    const otherKey = key("campanha-2");
    const load = vi.fn().mockResolvedValue("ok");

    await cachedQuery(campaignKey, 60_000, load);
    await cachedQuery(otherKey, 60_000, load);
    invalidateCachedQueries("campanha-1:");
    await cachedQuery(campaignKey, 60_000, load);
    await cachedQuery(otherKey, 60_000, load);

    expect(load).toHaveBeenCalledTimes(3);
  });

  it("compartilha a leitura em andamento e não guarda falhas", async () => {
    const k = key();
    let reject: (error: Error) => void = () => undefined;
    const load = vi.fn(
      () =>
        new Promise<number>((_resolve, rejectLoad) => {
          reject = rejectLoad;
        }),
    );

    const first = cachedQuery(k, 60_000, load);
    const second = cachedQuery(k, 60_000, load);
    expect(second).toBe(first);
    expect(load).toHaveBeenCalledOnce();

    reject(new Error("falhou"));
    await expect(first).rejects.toThrow("falhou");

    const retry = vi.fn().mockResolvedValue(2);
    await expect(cachedQuery(k, 60_000, retry)).resolves.toBe(2);
    expect(retry).toHaveBeenCalledOnce();
  });

  it("guarda no máximo MEMORY_CACHE_MAX_ENTRIES chaves, descartando as mais antigas", async () => {
    const memoryCache = await freshCache();
    const max = memoryCache.MEMORY_CACHE_MAX_ENTRIES;
    const load = vi.fn().mockResolvedValue("ok");

    for (let index = 0; index < max; index += 1) {
      void memoryCache.cachedQuery(`k:${index}`, 60_000, load);
    }
    expect(memoryCache.cachedQueryCount()).toBe(max);

    await memoryCache.cachedQuery("k:nova", 60_000, load);
    expect(memoryCache.cachedQueryCount()).toBe(max);

    load.mockClear();
    // A mais recente das antigas continua em cache...
    await memoryCache.cachedQuery(`k:${max - 1}`, 60_000, load);
    expect(load).not.toHaveBeenCalled();
    // ...e a inserida primeiro foi descartada.
    await memoryCache.cachedQuery("k:0", 60_000, load);
    expect(load).toHaveBeenCalledOnce();
    expect(memoryCache.cachedQueryCount()).toBe(max);
  });

  it("varre as vencidas no máximo a cada MEMORY_CACHE_SWEEP_INTERVAL_MS", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = new Date("2026-10-13T12:00:00.000Z").getTime();
    vi.setSystemTime(start);
    const memoryCache = await freshCache();
    const load = vi.fn().mockResolvedValue("ok");

    // Primeira falha no cache: varre e marca o horário da varredura.
    await memoryCache.cachedQuery("a", 1_000, load);

    // "a" venceu, mas a próxima varredura só sai após o intervalo.
    vi.setSystemTime(start + 2_000);
    await memoryCache.cachedQuery("b", 1_000, load);
    expect(memoryCache.cachedQueryCount()).toBe(2);

    // Uma chave vencida é recarregada mesmo sem varredura.
    await memoryCache.cachedQuery("a", 1_000, load);
    expect(load).toHaveBeenCalledTimes(3);
    expect(memoryCache.cachedQueryCount()).toBe(2);

    // Passado o intervalo, a falha seguinte descarta "a" e "b" (vencidas).
    vi.setSystemTime(start + memoryCache.MEMORY_CACHE_SWEEP_INTERVAL_MS + 1);
    await memoryCache.cachedQuery("c", 60_000, load);
    expect(memoryCache.cachedQueryCount()).toBe(1);
  });
});
