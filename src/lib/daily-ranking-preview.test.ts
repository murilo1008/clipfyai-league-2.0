import { describe, expect, it } from "vitest";
import { getPrizeForPosition, parsePrizeTable } from "./daily-ranking-preview";

describe("daily ranking prize table", () => {
  it("expande faixas e arredonda para centavos", () => {
    expect(parsePrizeTable({ "1": 100, "2-3": 20.999 })).toEqual([
      { position: 1, prize: 100 },
      { position: 2, prize: 21 },
      { position: 3, prize: 21 },
    ]);
  });

  it("não usa valor implícito para posição ausente", () => {
    expect(getPrizeForPosition(parsePrizeTable({ "1": 100 }), 2)).toBe(0);
  });

  it("recusa tabela inválida", () => {
    expect(() => parsePrizeTable({ "1": -1 })).toThrow();
    expect(() => parsePrizeTable("invalid-json")).toThrow();
  });
});
