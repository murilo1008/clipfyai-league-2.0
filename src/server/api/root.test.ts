import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: null }),
  currentUser: async () => null,
}));
vi.mock("@/server/db", () => ({ db: {} }));

describe("appRouter", () => {
  // O tRPC recusa nomes reservados (apply, call, then) só ao montar o router,
  // o que no deploy quebra o build em "Collecting page data".
  it("monta todos os routers", async () => {
    const { appRouter } = await import("./root");

    expect(appRouter._def.procedures).toHaveProperty(
      "clipperDiscipline.applyWarning",
    );
  });
});
