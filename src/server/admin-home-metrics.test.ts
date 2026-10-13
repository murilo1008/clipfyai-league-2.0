import type { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildHomeTickerClips,
  cachedAdminHomeQuery,
  getEligiblePlatformTotals,
  getHomeTickerClips,
  type HomeTickerPost,
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

const tickerPost = (
  id: string,
  views: number,
  thumbnailUrl: string | null = `https://img/${id}.jpg`,
): HomeTickerPost => ({
  id,
  thumbnailUrl,
  views,
  likes: 5,
  comments: 3,
  shares: 2,
  username: null,
  platform: "TIKTOK",
});

describe("buildHomeTickerClips", () => {
  it("intercala as competições e ignora thumbnails vazias ou repetidas", () => {
    const clips = buildHomeTickerClips([
      [
        tickerPost("a1", 100),
        tickerPost("a2", 50, "  "),
        tickerPost("a3", 40),
      ],
      [tickerPost("b1", 80, "https://img/a1.jpg"), tickerPost("b2", 0)],
    ]);

    expect(clips.map((clip) => clip.id)).toEqual(["a1", "a3", "b2"]);
    expect(clips[0]).toEqual({
      id: "a1",
      thumbnail: "https://img/a1.jpg",
      views: 100,
      engagementRate: 10,
      username: "",
      platform: "TIKTOK",
    });
    expect(clips[2]!.engagementRate).toBe(0);
  });

  it("limita a 20 vídeos", () => {
    const campaigns = Array.from({ length: 5 }, (_, c) =>
      Array.from({ length: 10 }, (_, i) => tickerPost(`c${c}-${i}`, 100 - i)),
    );
    const clips = buildHomeTickerClips(campaigns);
    expect(clips).toHaveLength(20);
    expect(clips.slice(0, 6).map((clip) => clip.id)).toEqual([
      "c0-0",
      "c1-0",
      "c2-0",
      "c3-0",
      "c4-0",
      "c0-1",
    ]);
  });
});

describe("getHomeTickerClips", () => {
  it("busca o top de cada competição ativa em uma consulta", async () => {
    const row = (campaignRank: number, id: string, views: bigint) => ({
      ...tickerPost(id, 0),
      campaignRank,
      views,
    });
    const queryRaw = vi
      .fn()
      .mockResolvedValue([
        row(1, "a1", 300n),
        row(1, "a2", 200n),
        row(2, "b1", 250n),
      ]);
    const db = { $queryRaw: queryRaw } as unknown as PrismaClient;

    const clips = await getHomeTickerClips(db);
    await getHomeTickerClips(db);

    expect(queryRaw).toHaveBeenCalledOnce();
    const [strings] = queryRaw.mock.calls[0]!;
    expect((strings as string[]).join("?")).toContain("CROSS JOIN LATERAL");
    expect(clips.map((clip) => [clip.id, clip.views])).toEqual([
      ["a1", 300],
      ["b1", 250],
      ["a2", 200],
    ]);
  });
});
