import type { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cachedAdminHomeQuery,
  getEligiblePlatformTotals,
  viewsGrowthStartDate,
} from "./admin-home-metrics";

// O cache é do módulo: cada teste usa chaves próprias.
let sequence = 0;
const key = () => `teste-${++sequence}`;

afterEach(() => {
  vi.useRealTimers();
});

describe("cachedAdminHomeQuery", () => {
  it("reaproveita o resultado e une consultas simultâneas", async () => {
    const k = key();
    const load = vi.fn().mockResolvedValue(42);

    const [first, second] = await Promise.all([
      cachedAdminHomeQuery(k, load),
      cachedAdminHomeQuery(k, load),
    ]);
    const third = await cachedAdminHomeQuery(k, load);

    expect([first, second, third]).toEqual([42, 42, 42]);
    expect(load).toHaveBeenCalledOnce();
  });

  it("lê de novo depois de 5 minutos", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T12:00:00.000Z"));
    const k = key();
    const load = vi.fn().mockResolvedValue("valor");

    await cachedAdminHomeQuery(k, load);
    vi.setSystemTime(new Date("2026-10-13T12:04:59.000Z"));
    await cachedAdminHomeQuery(k, load);
    expect(load).toHaveBeenCalledOnce();

    vi.setSystemTime(new Date("2026-10-13T12:05:01.000Z"));
    await cachedAdminHomeQuery(k, load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("não guarda falhas", async () => {
    const k = key();
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue("ok");

    await expect(cachedAdminHomeQuery(k, load)).rejects.toThrow("timeout");
    await expect(cachedAdminHomeQuery(k, load)).resolves.toBe("ok");
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("getEligiblePlatformTotals", () => {
  it("lê os totais uma vez para o lote e converte para número", async () => {
    const queryRaw = vi.fn().mockResolvedValue([
      {
        platform: "TIKTOK",
        posts: 10,
        applications: 3,
        views: 1_500n,
        viewsBefore: 500n,
        likes: 30n,
        comments: 4n,
        shares: 2n,
        saves: 1n,
      },
    ]);
    const db = { $queryRaw: queryRaw } as unknown as PrismaClient;
    // Data própria para não reaproveitar o cache de outro teste.
    const start = new Date("2020-01-01T00:00:00.000Z");

    const [dashboard, platformData] = await Promise.all([
      getEligiblePlatformTotals(db, start),
      getEligiblePlatformTotals(db, start),
    ]);

    expect(queryRaw).toHaveBeenCalledOnce();
    expect(dashboard).toBe(platformData);
    expect(dashboard).toEqual([
      {
        platform: "TIKTOK",
        posts: 10,
        applications: 3,
        views: 1_500,
        viewsBefore: 500,
        likes: 30,
        comments: 4,
        shares: 2,
        saves: 1,
      },
    ]);
    const [strings, ...values] = queryRaw.mock.calls[0]!;
    expect((strings as string[]).join("?")).toContain('COUNT(DISTINCT "applicationId")');
    expect(values).toContain(start);
  });

  it("começa o gráfico de crescimento à meia-noite de 89 dias atrás", () => {
    const start = viewsGrowthStartDate(new Date(2026, 9, 13, 15, 30));
    expect(start).toEqual(new Date(2026, 6, 16, 0, 0, 0, 0));
  });
});
