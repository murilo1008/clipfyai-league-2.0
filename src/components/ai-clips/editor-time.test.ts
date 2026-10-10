import { describe, expect, it } from "vitest";
import { msToTime, timeToMs, validateCut } from "./editor-time";
describe("timecodes do editor", () => {
  it("converte em ambas direções", () => {
    expect(msToTime(3723456)).toBe("01:02:03.456");
    expect(timeToMs("01:02:03.456")).toBe(3723456);
    expect(timeToMs("01:99:03")).toBeNull();
  });
  it.each([15000, 19000, 90000, 110000, 180000])(
    "aceita %i ms independentemente da duração ideal do projeto",
    (duration) => {
      expect(validateCut(1000, 1000 + duration, 300000)).toBeNull();
    },
  );
  it.each([14999, 180001])(
    "rejeita duração de %i ms fora do piso/teto",
    (duration) => {
      expect(validateCut(1000, 1000 + duration)).toBe(
        "A duração deve ficar entre 15 e 180 segundos.",
      );
    },
  );
  it("respeita a ordem dos tempos e o fim da fonte", () => {
    expect(validateCut(-1, 20000)).toContain("posterior");
    expect(validateCut(1000, 1000)).toContain("posterior");
    expect(validateCut(20000, 1000)).toContain("posterior");
    expect(validateCut(1000, 35000, 30000)).toContain("ultrapassa");
    expect(validateCut(15000, 30000, 30000)).toBeNull();
  });
});
