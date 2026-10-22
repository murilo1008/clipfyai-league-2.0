import { describe, expect, it } from "vitest";

import {
  applyScoreMultiplierBps,
  buildScoreMultiplierKeptUntil,
  formatScoreMultiplier,
  resolveScoreMultiplierBps,
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
  "AND ( s.\"revokedAt\" IS NULL OR s.\"revokedAt\" > e.\"postedAt\" " +
  "OR (s.\"metadata\"->'keptUntil'->'daily'->>ca.\"campaignId\")::timestamp > e.\"postedAt\" ) " +
  "), 10000)";

describe("scoreMultiplierBpsSql", () => {
  it("gera o fragmento compartilhado com o league, sem parâmetros", () => {
    const fragment = scoreMultiplierBpsSql(
      'ca."clipperProfileId"',
      'e."postedAt"',
      'ca."campaignId"',
      "daily",
    );
    expect(normalize(fragment.sql)).toBe(EXPECTED_SQL);
    expect(fragment.values).toEqual([]);
  });

  it("o mensal lê o próprio keptUntil", () => {
    const fragment = scoreMultiplierBpsSql(
      'ca."clipperProfileId"',
      'cp."postedAt"',
      'ca."campaignId"',
      "monthly",
    );
    expect(normalize(fragment.sql)).toContain(
      `(s."metadata"->'keptUntil'->'monthly'->>ca."campaignId")::timestamp > cp."postedAt"`,
    );
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
  const at = (iso: string | Date) => ({
    postedAt: typeof iso === "string" ? new Date(iso) : iso,
    campaignId: "camp-a",
  });

  it("aplica o redutor só a posts dentro da janela [início, fim)", () => {
    expect(resolveScoreMultiplierBps([sanction], at(startsAt), "daily")).toBe(8000);
    expect(resolveScoreMultiplierBps([sanction], at("2026-10-16T00:00:00Z"), "daily")).toBe(8000);
    expect(resolveScoreMultiplierBps([sanction], at(endsAt), "daily")).toBe(10000);
    expect(resolveScoreMultiplierBps([sanction], at("2026-10-10T11:59:59Z"), "daily")).toBe(10000);
  });

  it("a revogação encerra a janela no momento em que acontece", () => {
    const revoked = { ...sanction, revokedAt: new Date("2026-10-12T00:00:00Z") };
    expect(resolveScoreMultiplierBps([revoked], at("2026-10-11T00:00:00Z"), "daily")).toBe(8000);
    expect(resolveScoreMultiplierBps([revoked], at("2026-10-13T00:00:00Z"), "daily")).toBe(10000);
  });

  it("revogado com a advertência, vale só onde ficou mantido (competição e escopo)", () => {
    const revoked = {
      ...sanction,
      revokedAt: startsAt,
      metadata: { keptUntil: { daily: { "camp-a": "2026-10-12T20:00:00.000Z" } } },
    };
    const post = at("2026-10-11T00:00:00Z");
    expect(resolveScoreMultiplierBps([revoked], post, "daily")).toBe(8000);
    expect(resolveScoreMultiplierBps([revoked], at("2026-10-13T00:00:00Z"), "daily")).toBe(10000);
    expect(resolveScoreMultiplierBps([revoked], { ...post, campaignId: "camp-b" }, "daily")).toBe(
      10000,
    );
    expect(resolveScoreMultiplierBps([revoked], post, "monthly")).toBe(10000);
  });

  it("com sanções sobrepostas vale o menor fator", () => {
    const stronger = { ...sanction, scoreMultiplierBps: 5000, endsAt: null };
    expect(resolveScoreMultiplierBps([sanction, stronger], at(startsAt), "daily")).toBe(5000);
  });

  it("sem data de postagem não aplica redutor", () => {
    expect(
      resolveScoreMultiplierBps([sanction], { postedAt: null, campaignId: "camp-a" }, "daily"),
    ).toBe(SCORE_MULTIPLIER_NEUTRAL_BPS);
  });

  it("formata o fator para exibição", () => {
    expect(formatScoreMultiplier(8000)).toBe("×0,8");
    expect(formatScoreMultiplier(7500)).toBe("×0,75");
  });
});

describe("buildScoreMultiplierKeptUntil", () => {
  const startsAt = new Date("2026-10-01T15:00:00Z");
  const priorEnd = new Date("2026-10-10T15:00:00Z");

  it("diário: até o último dia pago de cada competição; mensal: inteiro onde já foi pago", () => {
    expect(
      buildScoreMultiplierKeptUntil({
        startsAt,
        priorEnd,
        dailyLockedUntil: new Map([
          ["camp-a", new Date("2026-10-09T20:00:00Z")],
          // pago depois do fim: limitado ao fim que o redutor tinha
          ["camp-b", new Date("2026-10-20T20:00:00Z")],
          // último dia pago antes do redutor: nada a manter
          ["camp-c", new Date("2026-09-30T20:00:00Z")],
        ]),
        monthlyPaidCampaignIds: new Set(["camp-d"]),
      }),
    ).toEqual({
      daily: {
        "camp-a": "2026-10-09T20:00:00.000Z",
        "camp-b": "2026-10-10T15:00:00.000Z",
      },
      monthly: { "camp-d": "2026-10-10T15:00:00.000Z" },
    });
  });

  it("sem nada pago não mantém nada", () => {
    expect(
      buildScoreMultiplierKeptUntil({
        startsAt,
        priorEnd,
        dailyLockedUntil: new Map(),
        monthlyPaidCampaignIds: new Set(),
      }),
    ).toEqual({});
  });
});
