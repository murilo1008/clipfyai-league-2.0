import { describe, expect, it } from "vitest";

import {
  formatRankingDateYmd,
  isRankingDateYmd,
  openRankingDateYmd,
  podiumCoversPost,
  rankingDayWindowUtc,
} from "./podium";
import {
  DAILY_RANKING_SNAPSHOT_LOCK_PREFIX,
  dailyRankingSnapshotLockSql,
  podiumIneligibleSql,
} from "./podium-sql";

const normalize = (sql: string) => sql.replace(/\s+/g, " ").trim();

/**
 * Texto fixo do fragmento. O backend league tem uma cópia byte a byte
 * (src/modules/clipper-discipline/podium.sql.ts) e o spec de lá compara com
 * esta mesma string: o ranking ao vivo e a varredura do snapshot excluem igual.
 */
const EXPECTED_SQL =
  'EXISTS ( SELECT 1 FROM "ClipperSanction" s ' +
  'WHERE s."clipperProfileId" = ca."clipperProfileId" ' +
  'AND s."campaignId" = cp."campaignId" ' +
  "AND s.\"type\" = 'PODIUM_INELIGIBLE' " +
  'AND s."revokedAt" IS NULL ' +
  'AND s."startsAt" <= cp."postedAt" ' +
  'AND s."endsAt" > cp."postedAt" )';

describe("podiumIneligibleSql", () => {
  it("gera o fragmento compartilhado com o league, sem parâmetros", () => {
    const fragment = podiumIneligibleSql('ca."clipperProfileId"', 'cp."campaignId"', 'cp."postedAt"');
    expect(normalize(fragment.sql)).toBe(EXPECTED_SQL);
    expect(fragment.values).toEqual([]);
  });

  it("lock com o mesmo prefixo da varredura do league", () => {
    expect(DAILY_RANKING_SNAPSHOT_LOCK_PREFIX).toBe("daily-ranking-snapshot:");
    const lock = dailyRankingSnapshotLockSql("campaign-1");
    expect(lock.sql).toBe("SELECT pg_advisory_xact_lock(hashtext(?))");
    expect(lock.values).toEqual(["daily-ranking-snapshot:campaign-1"]);
  });
});

describe("dia do ranking", () => {
  it("vai das 17h do dia anterior às 17h do dia (Brasília)", () => {
    expect(rankingDayWindowUtc("2026-10-16")).toEqual({
      startDate: new Date("2026-10-15T20:00:00.000Z"),
      endDate: new Date("2026-10-16T20:00:00.000Z"),
    });
    expect(rankingDayWindowUtc("2026-11-01").startDate).toEqual(
      new Date("2026-10-31T20:00:00.000Z"),
    );
  });

  it("o dia aberto vira às 17h de Brasília", () => {
    expect(openRankingDateYmd(new Date("2026-10-16T19:59:59Z"))).toBe("2026-10-16");
    expect(openRankingDateYmd(new Date("2026-10-16T20:00:00Z"))).toBe("2026-10-17");
    expect(openRankingDateYmd(new Date("2026-10-16T02:00:00Z"))).toBe("2026-10-16");
  });

  it("valida a data e formata para exibição", () => {
    expect(isRankingDateYmd("2026-10-16")).toBe(true);
    expect(isRankingDateYmd("2026-02-30")).toBe(false);
    expect(isRankingDateYmd("16/10/2026")).toBe(false);
    expect(formatRankingDateYmd("2026-10-16")).toBe("16/10/2026");
  });
});

describe("podiumCoversPost", () => {
  const sanction = {
    clipperProfileId: "clipper-1",
    campaignId: "camp",
    startsAt: new Date("2026-10-15T20:00:00.000Z"),
    endsAt: new Date("2026-10-16T20:00:00.000Z"),
    revokedAt: null,
  };
  const post = (postedAt: string, overrides = {}) => ({
    clipperProfileId: "clipper-1",
    campaignId: "camp",
    postedAt: new Date(postedAt),
    ...overrides,
  });

  it("cobre só os vídeos do dia, do clipador e da competição", () => {
    expect(podiumCoversPost([sanction], post("2026-10-15T20:00:00.000Z"))).toBe(true);
    expect(podiumCoversPost([sanction], post("2026-10-16T19:59:59.999Z"))).toBe(true);
    expect(podiumCoversPost([sanction], post("2026-10-16T20:00:00.000Z"))).toBe(false);
    expect(podiumCoversPost([sanction], post("2026-10-16T12:00:00Z", { campaignId: "other" }))).toBe(false);
    expect(podiumCoversPost([sanction], post("2026-10-16T12:00:00Z", { clipperProfileId: "x" }))).toBe(false);
    expect(podiumCoversPost([sanction], { ...post("2026-10-16T12:00:00Z"), postedAt: null })).toBe(false);
  });

  it("revogada não cobre mais nada", () => {
    expect(
      podiumCoversPost(
        [{ ...sanction, revokedAt: new Date("2026-10-20T00:00:00Z") }],
        post("2026-10-16T12:00:00Z"),
      ),
    ).toBe(false);
  });
});
