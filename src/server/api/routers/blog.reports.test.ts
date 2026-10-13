import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));
vi.mock("@/server/db", () => ({ db: {} }));
vi.mock("@/env", () => ({ env: {} }));
vi.mock("uploadthing/server", () => ({ UTApi: vi.fn(), UTFile: vi.fn() }));

import { countLast30Days } from "./blog";

const DAY_MS = 86_400_000;

type RawSql = { strings?: string[]; values?: unknown[] };

function render(call: unknown[]) {
  const [strings, ...values] = call as [TemplateStringsArray, ...unknown[]];
  const parts: string[] = [];
  const params: unknown[] = [];
  strings.forEach((part, index) => {
    parts.push(part);
    if (index >= values.length) return;
    const value = values[index] as RawSql | undefined;
    if (value && Array.isArray(value.strings)) {
      parts.push(value.strings.join("?"));
      params.push(...(value.values ?? []));
    } else {
      parts.push("?");
      params.push(value);
    }
  });
  return { sql: parts.join(""), params };
}

/** Os 30 counts em sequência de antes, sobre os mesmos instantes. */
function legacyCounts(times: Date[], today: Date) {
  const days: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const dayStart = new Date(today.getTime() - i * DAY_MS);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);
    days.push({
      date: dayStart.toISOString().split("T")[0]!,
      count: times.filter((time) => time >= dayStart && time < dayEnd).length,
    });
  }
  return days;
}

describe("countLast30Days", () => {
  const today = new Date("2026-10-13T03:00:00.000Z"); // meia-noite em BRT
  const times = [
    new Date(today.getTime() - 29 * DAY_MS), // início exato da 1ª janela
    new Date(today.getTime() - 29 * DAY_MS - 1), // antes da 1ª janela
    new Date(today.getTime() - 10 * DAY_MS + 5_000),
    new Date(today.getTime() - 10 * DAY_MS + 6_000),
    new Date(today.getTime() + DAY_MS - 1), // fim da última janela
    new Date(today.getTime() + DAY_MS), // fora (amanhã)
  ];

  it("agrupa no banco e mantém as janelas e os rótulos de antes", async () => {
    const queryRaw = vi.fn(async (...call: unknown[]) => {
      const { params } = render(call);
      const start = params[0] as Date;
      const end = params[params.length - 1] as Date;
      // O que o GROUP BY devolve para os instantes acima.
      const buckets = new Map<number, number>();
      for (const time of times) {
        if (time < start || time >= end) continue;
        const bucket = Math.floor((time.getTime() - start.getTime()) / DAY_MS);
        buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
      }
      return [...buckets].map(([bucket, count]) => ({ bucket, count }));
    });

    const days = await countLast30Days(
      { $queryRaw: queryRaw } as never,
      "views",
      today,
    );

    expect(days).toEqual(legacyCounts(times, today));
    expect(days).toHaveLength(30);
    expect(days[0]).toMatchObject({ count: 1 });
    expect(days.at(-1)).toMatchObject({ count: 1 });

    const { sql, params } = render(queryRaw.mock.calls[0]!);
    expect(sql).toContain('FROM "BlogPostView"');
    expect(sql).toContain('FLOOR(EXTRACT(EPOCH FROM ("viewedAt" - ?::timestamp)) / 86400)');
    expect(sql).toContain('"viewedAt" >= ?::timestamp');
    expect(sql).toContain('"viewedAt" < ?::timestamp');
    expect(params).toEqual([
      new Date(today.getTime() - 29 * DAY_MS),
      new Date(today.getTime() - 29 * DAY_MS),
      new Date(today.getTime() + DAY_MS),
    ]);
  });

  it("usa a coluna createdAt para curtidas e comentários", async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const db = { $queryRaw: queryRaw } as never;

    await countLast30Days(db, "likes", today);
    await countLast30Days(db, "comments", today);

    expect(render(queryRaw.mock.calls[0]!).sql).toContain(
      'FROM "BlogPostLike"',
    );
    expect(render(queryRaw.mock.calls[1]!).sql).toContain(
      'FROM "BlogComment"',
    );
    expect(render(queryRaw.mock.calls[1]!).sql).toContain('"createdAt" >= ?');
  });
});
