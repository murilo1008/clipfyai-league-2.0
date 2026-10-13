import { afterEach, describe, expect, it, vi } from "vitest";

import { cachedQuery, invalidateCachedQueries } from "./memory-cache";

let sequence = 0;
const key = (prefix = "teste") => `${prefix}:${++sequence}`;

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
});
