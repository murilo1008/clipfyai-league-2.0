import { describe, expect, it } from "vitest";
import {
  leagueCode,
  waitingForClipVersion,
  waitingForRender,
} from "./async-state";
describe("confirmação assíncrona", () => {
  it("mantém polling até a versão ou novo render aparecer e para em lastError", () => {
    expect(waitingForClipVersion(1, 2, false)).toBe(true);
    expect(waitingForClipVersion(2, 2, false)).toBe(false);
    expect(waitingForClipVersion(1, 2, true)).toBe(false);
    expect(waitingForRender(["old"], ["old"], false)).toBe(true);
    expect(waitingForRender(["old", "new"], ["old"], false)).toBe(false);
    expect(waitingForRender(["old"], ["old"], true)).toBe(false);
  });
  it("identifica conflito pelo código estruturado", () => {
    expect(
      leagueCode({ data: { leagueError: { code: "VERSION_CONFLICT" } } }),
    ).toBe("VERSION_CONFLICT");
    expect(leagueCode(new Error("versão alterada"))).toBeNull();
  });
});
