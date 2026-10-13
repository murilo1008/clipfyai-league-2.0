import { describe, expect, it } from "vitest";

import { boundedPollingInterval } from "./use-bounded-polling";

describe("boundedPollingInterval", () => {
  const options = {
    initialMs: 5_000,
    maxIntervalMs: 30_000,
    maxDurationMs: 10 * 60_000,
  };

  it("recua de 5 s até 30 s a cada minuto", () => {
    expect(boundedPollingInterval(0, options)).toBe(5_000);
    expect(boundedPollingInterval(59_999, options)).toBe(5_000);
    expect(boundedPollingInterval(60_000, options)).toBe(10_000);
    expect(boundedPollingInterval(2 * 60_000, options)).toBe(20_000);
    expect(boundedPollingInterval(3 * 60_000, options)).toBe(30_000);
    expect(boundedPollingInterval(9 * 60_000, options)).toBe(30_000);
  });

  it("para depois do prazo máximo", () => {
    expect(boundedPollingInterval(10 * 60_000, options)).toBe(false);
    expect(boundedPollingInterval(60 * 60_000, options)).toBe(false);
  });

  it("respeita o passo configurado", () => {
    expect(
      boundedPollingInterval(3 * 60_000, { ...options, stepMs: 2 * 60_000 }),
    ).toBe(10_000);
  });
});
