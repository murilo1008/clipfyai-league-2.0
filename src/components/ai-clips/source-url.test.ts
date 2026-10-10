import { describe, expect, it } from "vitest";
import { validSource } from "./source-url";

describe("link de origem", () => {
  it("aceita fake.local por HTTP ou HTTPS só fora de produção", () => {
    expect(validSource("https://fake.local/podcast-90s", "development")).toBe(
      true,
    );
    expect(validSource("http://fake.local/podcast-90s", "test")).toBe(true);
    expect(validSource("https://fake.local/podcast-90s", "production")).toBe(
      false,
    );
    expect(validSource("https://fake.local.evil.test/a", "development")).toBe(
      false,
    );
  });
  it("mantém as plataformas públicas permitidas", () => {
    expect(
      validSource("https://www.youtube.com/watch?v=123", "production"),
    ).toBe(true);
    expect(validSource("file:///video.mp4", "development")).toBe(false);
  });
});
