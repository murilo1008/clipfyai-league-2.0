import { describe, expect, it } from "vitest";
import {
  canWithdrawFromCompetition,
  canRejoinCompetition,
  isParticipatingApplication,
  rankingApplicationWhere,
} from "./competition-participation";
import {
  fetchDailyRankPreviewByEngagement,
  fetchDailyRankPreviewByViews,
} from "./daily-ranking-preview";

describe("participação e ranking após saída", () => {
  it.each([
    ["2026-10-09T17:59:59.999Z", true],
    ["2026-10-09T18:00:00.000Z", false],
    ["2026-10-09T18:00:00.001Z", false],
  ] as const)(
    "a reinscrição respeita o instante de início em %s",
    (at, expected) => {
      expect(
        canRejoinCompetition(
          "WITHDRAWN",
          "ACTIVE",
          "2026-10-09T18:00:00Z",
          "2026-10-31T00:00:00Z",
          new Date(at),
        ),
      ).toBe(expected);
    },
  );

  it.each(["APPROVED", "PENDING", "UNDER_REVIEW"])(
    "inclui %s no filtro Participando",
    (status) => {
      expect(isParticipatingApplication(status)).toBe(true);
    },
  );
  it.each(["WITHDRAWN", "REJECTED", "REVOKED", null, undefined])(
    "não considera %s como participação atual",
    (status) => {
      expect(isParticipatingApplication(status)).toBe(false);
    },
  );
  it.each(["ACTIVE", "SCHEDULED", "PAUSED"])(
    "permite saída em campanha %s que ainda não terminou",
    (status) => {
      expect(
        canWithdrawFromCompetition(
          "APPROVED",
          status,
          "2026-10-10T00:00:00Z",
          new Date("2026-10-09T00:00:00Z"),
        ),
      ).toBe(true);
    },
  );
  it("usa o fechamento do período para preservar a elegibilidade histórica", () => {
    const cutoff = new Date("2026-10-09T20:00:00Z");
    expect(rankingApplicationWhere(cutoff)).toEqual({
      OR: [
        { status: "APPROVED" },
        { status: "WITHDRAWN", withdrawnAt: { gte: cutoff } },
      ],
    });
  });
  it.each([fetchDailyRankPreviewByViews, fetchDailyRankPreviewByEngagement])(
    "o preview SQL filtra desistências antes do limite e da premiação",
    async (fetchPreview) => {
      const cutoff = new Date("2026-10-09T20:00:00Z");
      let query = "";
      let parameters: unknown[] = [];
      const db = {
        $queryRaw: async (
          parts: TemplateStringsArray,
          ...values: unknown[]
        ) => {
          query = parts.join("?");
          parameters = values;
          return [];
        },
      };
      await fetchPreview(
        db as never,
        "daily-1",
        new Date("2026-10-08T20:00:00Z"),
        cutoff,
        50,
      );
      expect(query).toContain(
        'WHERE ca."status" = \'APPROVED\' OR (ca."status" = \'WITHDRAWN\' AND ca."withdrawnAt" >= ?)',
      );
      expect(query.indexOf('WHERE ca."status"')).toBeLessThan(
        query.indexOf("LIMIT"),
      );
      expect(
        parameters.filter((parameter) => parameter === cutoff),
      ).toHaveLength(2);
    },
  );
});
