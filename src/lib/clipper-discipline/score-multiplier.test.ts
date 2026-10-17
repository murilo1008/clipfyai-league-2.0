import { describe, expect, it } from "vitest";

import {
  applyScoreMultiplierBps,
  formatScoreMultiplier,
  resolveScoreMultiplierBps,
  sanctionCoversInstant,
  SCORE_MULTIPLIER_NEUTRAL_BPS,
  scoreMultiplierBpsSql,
} from "./score-multiplier";

const normalize = (sql: string) => sql.replace(/\s+/g, " ").trim();

/**
 * Texto fixo do fragmento. O backend league tem uma cópia byte a byte
 * (src/modules/clipper-discipline/score-multiplier.sql.ts) e o spec de lá
 * compara com esta mesma string: front e payout PIX ordenam igual.
 */
const EXPECTED_SQL =
  'COALESCE(( SELECT MIN(s."scoreMultiplierBps") FROM "ClipperSanction" s ' +
  'WHERE s."clipperProfileId" = ca."clipperProfileId" ' +
  "AND s.\"type\" = 'SCORE_MULTIPLIER' " +
  'AND s."scoreMultiplierBps" IS NOT NULL ' +
  'AND s."startsAt" <= e."postedAt" ' +
  'AND (s."endsAt" IS NULL OR s."endsAt" > e."postedAt") ' +
  'AND (s."revokedAt" IS NULL OR s."revokedAt" > e."postedAt") ' +
  "), 10000)";

describe("scoreMultiplierBpsSql", () => {
  it("gera o fragmento compartilhado com o league, sem parâmetros", () => {
    const fragment = scoreMultiplierBpsSql('ca."clipperProfileId"', 'e."postedAt"');
    expect(normalize(fragment.sql)).toBe(EXPECTED_SQL);
    expect(fragment.values).toEqual([]);
  });
});

describe("applyScoreMultiplierBps", () => {
  // Mesmos vetores do spec do league.
  it.each([
    [0, 8000, 0],
    [1, 8000, 0],
    [5, 8000, 4],
    [12345, 8000, 9876],
    [999999, 8000, 799999],
    [100, 10000, 100],
    [7, 5000, 3],
    [1000000000, 8000, 800000000],
    [123456789, 7500, 92592591],
  ])("floor(%i × %i / 10000) = %i", (value, bps, expected) => {
    expect(applyScoreMultiplierBps(value, bps)).toBe(expected);
  });

  it("bate com a divisão inteira exata", () => {
    for (const [value, bps] of [
      [987654321, 8000],
      [3, 3333],
      [2 ** 31, 9999],
    ] as const) {
      expect(BigInt(applyScoreMultiplierBps(value, bps))).toBe(
        (BigInt(value) * BigInt(bps)) / 10000n,
      );
    }
  });
});

describe("resolveScoreMultiplierBps", () => {
  const startsAt = new Date("2026-10-10T12:00:00Z");
  const endsAt = new Date("2026-10-17T12:00:00Z");
  const sanction = { scoreMultiplierBps: 8000, startsAt, endsAt, revokedAt: null };

  it("aplica o redutor só a posts dentro da janela [início, fim)", () => {
    expect(resolveScoreMultiplierBps([sanction], startsAt)).toBe(8000);
    expect(resolveScoreMultiplierBps([sanction], new Date("2026-10-16T00:00:00Z"))).toBe(8000);
    expect(resolveScoreMultiplierBps([sanction], endsAt)).toBe(10000);
    expect(resolveScoreMultiplierBps([sanction], new Date("2026-10-10T11:59:59Z"))).toBe(10000);
  });

  it("a revogação encerra a janela no momento em que acontece", () => {
    const revoked = { ...sanction, revokedAt: new Date("2026-10-12T00:00:00Z") };
    expect(resolveScoreMultiplierBps([revoked], new Date("2026-10-11T00:00:00Z"))).toBe(8000);
    expect(resolveScoreMultiplierBps([revoked], new Date("2026-10-13T00:00:00Z"))).toBe(10000);
  });

  it("com sanções sobrepostas vale o menor fator", () => {
    const stronger = { ...sanction, scoreMultiplierBps: 5000, endsAt: null };
    expect(resolveScoreMultiplierBps([sanction, stronger], startsAt)).toBe(5000);
  });

  it("sem data de postagem não aplica redutor", () => {
    expect(resolveScoreMultiplierBps([sanction], null)).toBe(SCORE_MULTIPLIER_NEUTRAL_BPS);
  });

  it("sanctionCoversInstant usa o mesmo predicado do SQL", () => {
    expect(sanctionCoversInstant({ startsAt, endsAt: null, revokedAt: null }, endsAt)).toBe(true);
  });

  it("formata o fator para exibição", () => {
    expect(formatScoreMultiplier(8000)).toBe("×0,8");
    expect(formatScoreMultiplier(7500)).toBe("×0,75");
  });
});
