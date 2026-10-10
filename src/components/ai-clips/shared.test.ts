import { describe, expect, it } from "vitest";
import { pollMs } from "./polling";
describe("polling", () => {
  const now = Date.parse("2026-09-29T12:00:00Z");
  it("usa 3 s, passa a 10 s após 2 min e para oculto/terminal", () => {
    expect(
      pollMs("INGESTING", new Date(now - 1000).toISOString(), true, now),
    ).toBe(3000);
    expect(
      pollMs("RENDERING", new Date(now - 121000).toISOString(), true, now),
    ).toBe(10000);
    expect(
      pollMs("RENDERING", new Date(now - 121000).toISOString(), false, now),
    ).toBe(false);
    expect(
      pollMs("COMPLETED", new Date(now - 1000).toISOString(), true, now),
    ).toBe(false);
  });
});
