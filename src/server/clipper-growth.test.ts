import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { clipperGrowthStart, loadClipperGrowth } from "./clipper-growth";

let sequence = 0;
// Cada teste usa uma inscrição nova: o resultado fica em cache por inscrição.
const applicationId = () => `app-${++sequence}`;

const NOW = new Date("2026-10-13T15:00:00.000Z");

function mockDb(rows: Array<{ day: Date; views: bigint; engagement: bigint }>) {
  const queryRaw = vi.fn().mockResolvedValue(rows);
  return { db: { $queryRaw: queryRaw } as unknown as PrismaClient, queryRaw };
}

const day = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

describe("clipperGrowthStart", () => {
  it("começa à meia-noite UTC de 6 dias atrás (7 dias com hoje)", () => {
    expect(clipperGrowthStart(NOW).toISOString()).toBe(
      "2026-10-07T00:00:00.000Z",
    );
    // Logo depois da meia-noite UTC a janela já anda um dia
    expect(
      clipperGrowthStart(new Date("2026-10-14T00:00:01.000Z")).toISOString(),
    ).toBe("2026-10-08T00:00:00.000Z");
  });
});

describe("loadClipperGrowth", () => {
  it("devolve o total de cada dia em dd/mm e descarta os dias antes do primeiro post", async () => {
    const { db } = mockDb([
      { day: day("2026-10-07"), views: 0n, engagement: 0n },
      { day: day("2026-10-08"), views: 0n, engagement: 0n },
      { day: day("2026-10-09"), views: 1_000n, engagement: 40n },
      { day: day("2026-10-10"), views: 1_000n, engagement: 40n },
      { day: day("2026-10-11"), views: 9_007_199_254_740n, engagement: 90n },
      { day: day("2026-10-12"), views: 9_007_199_254_740n, engagement: 90n },
      { day: day("2026-10-13"), views: 9_007_199_254_741n, engagement: 0n },
    ]);

    const growth = await loadClipperGrowth(db, {
      campaignId: "camp-1",
      applicationId: applicationId(),
      now: NOW,
    });

    expect(growth).toEqual([
      { date: "09/10", views: 1_000, engagement: 40 },
      { date: "10/10", views: 1_000, engagement: 40 },
      { date: "11/10", views: 9_007_199_254_740, engagement: 90 },
      { date: "12/10", views: 9_007_199_254_740, engagement: 90 },
      { date: "13/10", views: 9_007_199_254_741, engagement: 0 },
    ]);
  });

  it("devolve lista vazia quando o clipador não tem coletas", async () => {
    const { db } = mockDb(
      [7, 8, 9, 10, 11, 12, 13].map((d) => ({
        day: day(`2026-10-${String(d).padStart(2, "0")}`),
        views: 0n,
        engagement: 0n,
      })),
    );

    await expect(
      loadClipperGrowth(db, {
        campaignId: "camp-1",
        applicationId: applicationId(),
        now: NOW,
      }),
    ).resolves.toEqual([]);
  });

  it("parte da última coleta antes da janela e acumula as diferenças por dia", async () => {
    const { db, queryRaw } = mockDb([]);
    const app = applicationId();

    await loadClipperGrowth(db, { campaignId: "camp-1", applicationId: app, now: NOW });

    const [strings, ...values] = queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    const sql = strings.join("?").replace(/\s+/g, " ");
    const start = new Date("2026-10-07T00:00:00.000Z");
    expect(values).toEqual([
      "camp-1",
      app,
      start,
      start,
      start,
      start,
      new Date("2026-10-13T00:00:00.000Z"),
    ]);
    expect(sql).toContain(
      `post."campaignId" = ? AND post."applicationId" = ? AND post.status = 'ELIGIBLE'`,
    );
    // Ponto de partida: última coleta de cada post antes da janela
    expect(sql).toContain(
      `metrics."collectedAt" < ?::timestamp ORDER BY metrics."collectedAt" DESC LIMIT 1`,
    );
    // Dentro da janela: última coleta de cada dia, lida post a post
    expect(sql).toContain(
      `SELECT DISTINCT ON (DATE_TRUNC('day', metrics."collectedAt"))`,
    );
    expect(sql).toContain("views - LAG(views, 1, 0::bigint) OVER per_post");
    // Todo dia da janela tem ponto, com o total acumulado até ele
    expect(sql).toContain("GENERATE_SERIES( ?::timestamp, ?::timestamp, INTERVAL '1 day' )");
    expect(sql).toContain("FROM daily WHERE daily.day <= days.day");
  });

  it("reaproveita o resultado da mesma inscrição", async () => {
    const { db, queryRaw } = mockDb([]);
    const input = { campaignId: "camp-1", applicationId: applicationId(), now: NOW };

    await loadClipperGrowth(db, input);
    await loadClipperGrowth(db, input);

    expect(queryRaw).toHaveBeenCalledOnce();
  });
});
