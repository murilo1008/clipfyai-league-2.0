import { describe, expect, it } from "vitest";

import {
  buildSanctionPlan,
  effectiveWarningStatus,
  levelRequirements,
  SanctionPlanError,
  suggestNextLevel,
  warningExpiresAt,
  warningLevelLabel,
} from "./levels";
import { DEFAULT_DISCIPLINE_SETTINGS } from "./settings";

const now = new Date("2026-10-16T15:00:00Z");
const settings = DEFAULT_DISCIPLINE_SETTINGS;
const HOUR = 60 * 60 * 1000;

describe("suggestNextLevel", () => {
  it("sem advertências ativas sugere o aviso formal", () => {
    expect(suggestNextLevel([])).toBe(0);
  });

  it("sugere o maior nível ativo mais um", () => {
    expect(suggestNextLevel([{ infractionType: "LIGHT", level: 0 }])).toBe(1);
    expect(
      suggestNextLevel([
        { infractionType: "LIGHT", level: 0 },
        { infractionType: "MEDIUM", level: 2 },
      ]),
    ).toBe(3);
  });

  it("uma grave ativa pesa como nível 3 e o teto é o banimento", () => {
    expect(suggestNextLevel([{ infractionType: "SEVERE", level: null }])).toBe(4);
    expect(suggestNextLevel([{ infractionType: "MEDIUM", level: 4 }])).toBe(4);
  });
});

describe("buildSanctionPlan", () => {
  const base = { settings, now, campaignId: "campaign-1", clipPostId: "post-1" };

  it("nível 0: só o vídeo deixa de pontuar", () => {
    const plan = buildSanctionPlan({ ...base, infractionType: "LIGHT", level: 0 });
    expect(plan.map((s) => s.type)).toEqual(["VIDEO_INVALIDATION"]);
  });

  it("nível 1: vídeo invalidado e 24h sem postar a partir de agora", () => {
    const plan = buildSanctionPlan({ ...base, infractionType: "LIGHT", level: 1 });
    expect(plan.map((s) => s.type)).toEqual(["VIDEO_INVALIDATION", "POSTING_SUSPENSION"]);
    expect(plan[1]!.startsAt).toEqual(now);
    expect(plan[1]!.endsAt!.getTime() - now.getTime()).toBe(24 * HOUR);
  });

  it("nível 2: 72h sem postar e redutor ×0,8 por 7 dias", () => {
    const plan = buildSanctionPlan({
      ...base,
      clipPostId: null,
      infractionType: "MEDIUM",
      level: 2,
    });
    expect(plan.map((s) => s.type)).toEqual(["POSTING_SUSPENSION", "SCORE_MULTIPLIER"]);
    expect(plan[0]!.endsAt!.getTime() - now.getTime()).toBe(72 * HOUR);
    expect(plan[1]).toMatchObject({ scoreMultiplierBps: 8000 });
    expect(plan[1]!.endsAt!.getTime() - now.getTime()).toBe(7 * 24 * HOUR);
  });

  it("usa os valores configurados no painel", () => {
    const plan = buildSanctionPlan({
      ...base,
      infractionType: "LIGHT",
      level: 1,
      settings: { ...settings, level1SuspensionHours: 12 },
    });
    expect(plan[1]!.endsAt!.getTime() - now.getTime()).toBe(12 * HOUR);
  });

  it("nível 3: remoção da competição", () => {
    const plan = buildSanctionPlan({ ...base, clipPostId: null, infractionType: "LIGHT", level: 3 });
    expect(plan).toEqual([
      { type: "COMPETITION_REMOVAL", startsAt: now, endsAt: null, campaignId: "campaign-1" },
    ]);
  });

  it("nível 4: banimento e carteira retida", () => {
    const plan = buildSanctionPlan({ ...base, clipPostId: null, infractionType: "MEDIUM", level: 4 });
    expect(plan.map((s) => s.type)).toEqual(["PLATFORM_BAN", "PAYOUT_HOLD"]);
    expect(plan.every((s) => s.endsAt === null)).toBe(true);
  });

  it("grave: pula a escala, remove da competição e retém pagamentos", () => {
    const plan = buildSanctionPlan({ ...base, clipPostId: null, infractionType: "SEVERE", level: 1 });
    expect(plan.map((s) => s.type)).toEqual(["COMPETITION_REMOVAL", "PAYOUT_HOLD"]);
  });

  it("exige o vídeo nos níveis 0 e 1 e a competição no 3 e na grave", () => {
    expect(() =>
      buildSanctionPlan({ ...base, clipPostId: null, infractionType: "LIGHT", level: 1 }),
    ).toThrow(SanctionPlanError);
    expect(() =>
      buildSanctionPlan({ ...base, campaignId: null, clipPostId: null, infractionType: "LIGHT", level: 3 }),
    ).toThrow("Informe a competição da infração.");
    expect(() =>
      buildSanctionPlan({ ...base, campaignId: null, clipPostId: null, infractionType: "SEVERE", level: null }),
    ).toThrow(SanctionPlanError);
    expect(() =>
      buildSanctionPlan({ ...base, infractionType: "LIGHT", level: 5 }),
    ).toThrow("Nível de advertência inválido.");
  });

  it("inelegível ao pódio: a janela do dia na competição, nos níveis 0 a 2", () => {
    const plan = buildSanctionPlan({
      ...base,
      infractionType: "MEDIUM",
      level: 2,
      podiumRankingDate: "2026-10-16",
    });
    expect(plan.at(-1)).toEqual({
      type: "PODIUM_INELIGIBLE",
      startsAt: new Date("2026-10-15T20:00:00.000Z"),
      endsAt: new Date("2026-10-16T20:00:00.000Z"),
      campaignId: "campaign-1",
      rankingDate: "2026-10-16",
    });
    expect(levelRequirements("LIGHT", 0).allowsPodium).toBe(true);
    expect(levelRequirements("LIGHT", 3).allowsPodium).toBe(false);
    expect(levelRequirements("SEVERE", null).allowsPodium).toBe(false);
  });

  it("inelegível ao pódio exige competição, nível até 2 e dia que já começou", () => {
    const podium = { infractionType: "LIGHT" as const, podiumRankingDate: "2026-10-16" };
    expect(() =>
      buildSanctionPlan({ ...base, ...podium, level: 2, campaignId: null }),
    ).toThrow("Informe a competição do inelegível ao pódio.");
    expect(() => buildSanctionPlan({ ...base, ...podium, level: 3 })).toThrow(
      SanctionPlanError,
    );
    // 16/10 às 12h (BRT): o dia aberto é o 16; o 17 ainda não começou.
    expect(() =>
      buildSanctionPlan({ ...base, ...podium, level: 0, podiumRankingDate: "2026-10-17" }),
    ).toThrow("O dia do ranking não pode ser futuro.");
    expect(() =>
      buildSanctionPlan({ ...base, ...podium, level: 0, podiumRankingDate: "2026-02-30" }),
    ).toThrow("Informe o dia do ranking.");
  });

  it("só o nível 4 pede confirmação de banimento", () => {
    expect(levelRequirements("LIGHT", 4).requiresBanConfirmation).toBe(true);
    expect(levelRequirements("LIGHT", 3).requiresBanConfirmation).toBe(false);
    expect(levelRequirements("SEVERE", null).requiresBanConfirmation).toBe(false);
  });
});

describe("expiração", () => {
  it("expira 60 dias depois da infração por padrão", () => {
    expect(warningExpiresAt(settings, now).getTime() - now.getTime()).toBe(60 * 24 * HOUR);
  });

  it("uma ACTIVE vencida conta como expirada", () => {
    expect(effectiveWarningStatus({ status: "ACTIVE", expiresAt: now }, now)).toBe("EXPIRED");
    expect(
      effectiveWarningStatus({ status: "ACTIVE", expiresAt: new Date(now.getTime() + 1) }, now),
    ).toBe("ACTIVE");
    expect(effectiveWarningStatus({ status: "REVOKED", expiresAt: now }, now)).toBe("REVOKED");
  });
});

describe("warningLevelLabel", () => {
  it("nomeia cada nível", () => {
    expect(warningLevelLabel("LIGHT", 0)).toBe("Aviso formal");
    expect(warningLevelLabel("MEDIUM", 2)).toBe("Advertência 2");
    expect(warningLevelLabel("SEVERE", null)).toBe("Infração grave");
  });
});
