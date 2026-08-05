import { describe, expect, it } from "vitest";

import { maxVisibleRatio, REVEAL_OBSERVER_OPTIONS } from "./reveal-options";

describe("REVEAL_OBSERVER_OPTIONS", () => {
  it("usa threshold 0 — qualquer valor fracionário esconde blocos altos", () => {
    expect(REVEAL_OBSERVER_OPTIONS.threshold).toBe(0);
  });
});

describe("maxVisibleRatio", () => {
  it("blocos mais altos que a viewport nunca chegam a 100%", () => {
    // Caso real: tabs da competição do clipador em produção.
    expect(maxVisibleRatio(9478, 800)).toBeCloseTo(0.084, 3);
  });

  it("um threshold de 0.15 seria inalcançável nesse caso", () => {
    expect(maxVisibleRatio(9478, 800)).toBeLessThan(0.15);
  });

  it("blocos menores que a viewport chegam a 100%", () => {
    expect(maxVisibleRatio(400, 800)).toBe(1);
  });
});
