import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));
vi.mock("@/server/db", () => ({ db: {} }));
vi.mock("@/env", () => ({ env: {} }));

import { executeTool } from "./chat";

function setupDb() {
  const executeRaw = vi.fn().mockResolvedValue(0);
  const executeRawUnsafe = vi.fn().mockResolvedValue(0);
  const findMany = vi.fn().mockResolvedValue([{ id: "1", views: 10n }]);
  const groupBy = vi.fn().mockResolvedValue([]);
  const tx = {
    $executeRaw: executeRaw,
    $executeRawUnsafe: executeRawUnsafe,
    campaign: { findMany, groupBy },
    clipPost: { findMany, groupBy },
    clipPostMetrics: { findMany },
  };
  const transaction = vi.fn(
    async (run: (client: typeof tx) => Promise<unknown>, _options: unknown) =>
      run(tx),
  );
  const db = {
    ...tx,
    $transaction: transaction,
  };
  return { db, tx, transaction, executeRaw, executeRawUnsafe, findMany, groupBy };
}

const run = (db: unknown, args: Record<string, unknown>) =>
  executeTool(db as never, "executeDynamicQuery", args) as Promise<
    Record<string, any>
  >;

describe("executeDynamicQuery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("roda somente leitura, com statement_timeout, dentro de uma transação", async () => {
    const { db, transaction, executeRaw, executeRawUnsafe, findMany } =
      setupDb();

    const result = await run(db, {
      model: "campaign",
      operation: "findMany",
      args: { where: { status: "ACTIVE" }, take: 5_000 },
    });

    expect(transaction).toHaveBeenCalledOnce();
    expect(transaction.mock.calls[0]![1]).toMatchObject({ timeout: 15_000 });
    expect(executeRaw.mock.calls[0]![0].join("")).toBe(
      "SET TRANSACTION READ ONLY",
    );
    expect(executeRawUnsafe).toHaveBeenCalledWith(
      "SET LOCAL statement_timeout = '10s'",
    );
    // Teto de linhas preservado e consulta feita no cliente da transação.
    expect(findMany).toHaveBeenCalledWith({
      where: { status: "ACTIVE" },
      take: 200,
    });
    expect(result.data).toEqual({ id: "1", views: 10 });
  });

  it("limita as relações em lista aninhadas", async () => {
    const { db, findMany } = setupDb();

    await run(db, {
      model: "campaign",
      operation: "findMany",
      args: {
        take: 10,
        include: {
          clipPosts: true,
          applications: { take: 1_000, include: { clipPosts: true } },
          organization: true,
        },
      },
    });

    expect(findMany).toHaveBeenCalledWith({
      take: 10,
      include: {
        clipPosts: { take: 50 },
        applications: { take: 50, include: { clipPosts: { take: 50 } } },
        organization: true,
      },
    });
  });

  it("exige filtro por post nas tabelas de métricas", async () => {
    const { db, transaction } = setupDb();

    const result = await run(db, {
      model: "clipPostMetrics",
      operation: "findMany",
      args: { where: { velocity24h: { gt: 500 } }, take: 20 },
    });

    expect(result.error).toContain("clipPostId");
    expect(transaction).not.toHaveBeenCalled();

    const scoped = await run(db, {
      model: "clipPostMetrics",
      operation: "findMany",
      args: { where: { clipPostId: "post-1" }, take: 20 },
    });
    expect(scoped.error).toBeUndefined();
    expect(transaction).toHaveBeenCalledOnce();
  });

  it("recusa distinct, que o Prisma resolve em memória", async () => {
    const { db, transaction } = setupDb();

    const result = await run(db, {
      model: "clipPost",
      operation: "findMany",
      args: { distinct: ["applicationId"], take: 10 },
    });

    expect(result.error).toContain("distinct");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("limita groupBy ordenado e corta o resultado sem ordenação", async () => {
    const { db, groupBy } = setupDb();

    await run(db, {
      model: "clipPost",
      operation: "groupBy",
      args: { by: ["platform"], orderBy: { platform: "asc" }, take: 900 },
    });
    expect(groupBy).toHaveBeenLastCalledWith({
      by: ["platform"],
      orderBy: { platform: "asc" },
      take: 200,
    });

    groupBy.mockResolvedValueOnce(
      Array.from({ length: 250 }, (_, index) => ({ username: `u${index}` })),
    );
    const result = await run(db, {
      model: "clipPost",
      operation: "groupBy",
      args: { by: ["username"] },
    });
    expect(result.data).toHaveLength(200);
    expect(result._meta.truncated).toBe(true);
  });

  it("explica quando a consulta estoura o tempo", async () => {
    const { db, findMany } = setupDb();
    findMany.mockRejectedValueOnce(
      new Error("canceling statement due to statement timeout"),
    );

    const result = await run(db, {
      model: "campaign",
      operation: "findMany",
      args: { take: 10 },
    });

    expect(result.error).toContain("foi cancelada");
  });
});

describe("getClipPostDetails", () => {
  it("lê o histórico pela relação certa, com limite no banco", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "post-1", views: 5n });
    const metricsFindMany = vi
      .fn()
      .mockResolvedValue([{ collectedAt: new Date(0), views: 5n }]);
    const db = {
      clipPost: { findUnique },
      clipPostMetrics: { findMany: metricsFindMany },
    };

    const result = (await executeTool(db as never, "getClipPostDetails", {
      clipPostId: "post-1",
    })) as Record<string, any>;

    expect(findUnique.mock.calls[0]![0].include).not.toHaveProperty("metrics");
    expect(metricsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clipPostId: "post-1" },
        orderBy: { collectedAt: "desc" },
        take: 30,
      }),
    );
    expect(result.data.metricsHistory).toEqual([
      { collectedAt: new Date(0).toISOString(), views: 5 },
    ]);
  });
});
