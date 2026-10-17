import { describe, expect, it, vi } from "vitest";

import {
  assertCanEnroll,
  assertCanSubmitPosts,
  assertCanWithdraw,
  disciplineScoringLockMessage,
  getClipperRestrictions,
} from "./restrictions";

const now = new Date("2026-10-16T15:00:00Z");

function makeDb({
  verificationStatus = "VERIFIED",
  sanctions = [] as Array<Record<string, unknown>>,
} = {}) {
  return {
    clipperProfile: {
      findUnique: vi.fn().mockResolvedValue({ verificationStatus }),
    },
    clipperSanction: { findMany: vi.fn().mockResolvedValue(sanctions) },
  };
}

describe("getClipperRestrictions", () => {
  it("consulta só sanções que cobrem o instante atual", async () => {
    const db = makeDb();
    await getClipperRestrictions(db as never, "clipper-1", now);
    expect(db.clipperSanction.findMany.mock.calls[0]![0].where).toMatchObject({
      clipperProfileId: "clipper-1",
      startsAt: { lte: now },
      AND: [
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        { OR: [{ revokedAt: null }, { revokedAt: { gt: now } }] },
      ],
    });
  });

  it("resume suspensão, redutor, retenção e observação", async () => {
    const db = makeDb({
      sanctions: [
        { type: "POSTING_SUSPENSION", endsAt: new Date("2026-10-17T15:00:00Z"), scoreMultiplierBps: null, reason: null },
        { type: "POSTING_SUSPENSION", endsAt: new Date("2026-10-19T15:00:00Z"), scoreMultiplierBps: null, reason: null },
        { type: "SCORE_MULTIPLIER", endsAt: new Date("2026-10-23T15:00:00Z"), scoreMultiplierBps: 8000, reason: null },
        { type: "SCORE_MULTIPLIER", endsAt: null, scoreMultiplierBps: 5000, reason: null },
        { type: "PAYOUT_HOLD", endsAt: null, scoreMultiplierBps: null, reason: "Auditoria" },
        { type: "OBSERVATION_MODE", endsAt: null, scoreMultiplierBps: null, reason: null },
      ],
    });
    const restrictions = await getClipperRestrictions(db as never, "clipper-1", now);
    expect(restrictions).toMatchObject({
      banned: false,
      suspension: { endsAt: new Date("2026-10-19T15:00:00Z") },
      scoreMultiplier: { bps: 5000, endsAt: null },
      payoutHold: { reasons: ["Auditoria"] },
      observation: { endsAt: null },
      premiumBlock: null,
      bonusLoss: null,
    });
  });
});

describe("bloqueios", () => {
  it("suspensão impede o envio e informa a liberação em horário de Brasília", async () => {
    const db = makeDb({
      sanctions: [
        { type: "POSTING_SUSPENSION", endsAt: new Date("2026-10-17T15:00:00Z"), scoreMultiplierBps: null, reason: null },
      ],
    });
    await expect(assertCanSubmitPosts(db as never, "clipper-1", now)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Você está suspenso de enviar vídeos até 17/10/2026 às 12:00 (horário de Brasília).",
    });
  });

  it("conta banida não envia, não se inscreve e não saca", async () => {
    const db = makeDb({ verificationStatus: "BANNED" });
    await expect(assertCanSubmitPosts(db as never, "clipper-1", now)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assertCanEnroll(db as never, "clipper-1", { isProOnly: false }, now)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assertCanWithdraw(db as never, "clipper-1", now)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("o bloqueio premium só vale para campanhas premium", async () => {
    const db = makeDb({
      sanctions: [
        { type: "PREMIUM_CAMPAIGN_BLOCK", endsAt: new Date("2026-10-20T15:00:00Z"), scoreMultiplierBps: null, reason: null },
      ],
    });
    await expect(assertCanEnroll(db as never, "clipper-1", { isProOnly: false }, now)).resolves.toBeUndefined();
    await expect(assertCanEnroll(db as never, "clipper-1", { isProOnly: true }, now)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("retenção de pagamento bloqueia o saque", async () => {
    const db = makeDb({
      sanctions: [{ type: "PAYOUT_HOLD", endsAt: null, scoreMultiplierBps: null, reason: null }],
    });
    await expect(assertCanWithdraw(db as never, "clipper-1", now)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("sem sanções, tudo liberado", async () => {
    const db = makeDb();
    await expect(assertCanSubmitPosts(db as never, "clipper-1", now)).resolves.toBeUndefined();
    await expect(assertCanWithdraw(db as never, "clipper-1", now)).resolves.toBeUndefined();
  });
});

describe("disciplineScoringLockMessage", () => {
  it("bloqueia restaurar vídeo invalidado por advertência ou inscrição removida", () => {
    expect(
      disciplineScoringLockMessage({
        postStatus: "DISQUALIFIED",
        ineligibilityReason: "Advertência: hashtag faltando",
      }),
    ).toMatch(/invalidado por advertência/);
    expect(disciplineScoringLockMessage({ applicationStatus: "REVOKED" })).toMatch(/removido/);
  });

  it("não interfere em desclassificações comuns", () => {
    expect(
      disciplineScoringLockMessage({
        postStatus: "DISQUALIFIED",
        ineligibilityReason: "Fraude",
        applicationStatus: "APPROVED",
      }),
    ).toBeNull();
  });
});
