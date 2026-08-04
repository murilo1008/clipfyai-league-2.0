import { describe, expect, it } from "vitest";
import {
  getTopClippersPrize,
  parseTopClippersPrizeTable,
} from "./top-clippers-ranking";

describe("top clippers prize table", () => {
  it("parses object positions and ranges", () => {
    expect(parseTopClippersPrizeTable({ "1": 100, "2-3": 50 })).toEqual([
      { position: 1, prize: 100 },
      { position: 2, prize: 50 },
      { position: 3, prize: 50 },
    ]);
  });

  it("does not invent prizes for unconfigured positions", () => {
    const table = parseTopClippersPrizeTable({ "1": 100 });
    expect(getTopClippersPrize(table, 1)).toBe(100);
    expect(getTopClippersPrize(table, 2)).toBe(0);
  });

  it("ignores malformed and negative values", () => {
    expect(parseTopClippersPrizeTable({ "0": 10, "1": -5, nope: 20 })).toEqual(
      [],
    );
  });
});
