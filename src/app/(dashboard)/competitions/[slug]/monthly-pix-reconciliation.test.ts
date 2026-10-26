import { describe, expect, it } from "vitest";

import {
  approvedMatchesOf,
  buildConfirmationResult,
  type ConfirmationOutcomes,
  countRegistered,
  recordBatchFailure,
  recordBatchResponse,
  type Reconciliation,
  type ReconciliationLine,
} from "./monthly-pix-reconciliation";

function line(
  clipper: string,
  overrides: Partial<ReconciliationLine> = {},
): ReconciliationLine {
  return {
    status: "WOULD_REGISTER",
    clipperProfileId: clipper,
    clipperName: clipper,
    campaignId: "campaign-1",
    campaignName: "Belli - Setembro",
    amount: 150,
    ...overrides,
  };
}

function reconciliation(
  lines: ReconciliationLine[],
  overrides: Partial<Reconciliation> = {},
): Reconciliation {
  return {
    dryRun: true,
    window: { startDate: "2026-10-16", endDate: "2026-10-26" },
    statement: {
      pixOut: 3,
      alreadyRegistered: 0,
      externallyRegistered: 0,
      truncated: false,
    },
    notDue: { payouts: 0, amount: 0 },
    totals: {},
    warnings: [],
    lines,
    unclaimedBankTransactions: [],
    alreadyRegisteredBankTransactionIds: [],
    ...overrides,
  };
}

const preview = reconciliation([
  line("a", { contaSimplesTransactionId: 1 }),
  line("b", { contaSimplesTransactionId: 2 }),
  line("c", { contaSimplesTransactionId: 3 }),
  line("d", { status: "UNMATCHED" }),
  line("e", {
    status: "AMBIGUOUS",
    reason: "bank_transaction_shared",
    contaSimplesTransactionId: undefined,
  }),
]);

describe("concluir pagamento do mensal", () => {
  it("aprova só as linhas que seriam registradas, como pares PIX + clipador", () => {
    expect(approvedMatchesOf(preview)).toEqual([
      { bankTransactionId: 1, clipperProfileId: "a" },
      { bankTransactionId: 2, clipperProfileId: "b" },
      { bankTransactionId: 3, clipperProfileId: "c" },
    ]);
  });

  it("junta os lotes: registrado, já registrado numa tentativa anterior e mudado desde a simulação", () => {
    const outcomes: ConfirmationOutcomes = new Map();
    const response = reconciliation(
      [
        line("a", {
          status: "REGISTERED",
          contaSimplesTransactionId: 1,
          proofUrl: "https://x/1.pdf",
        }),
      ],
      { dryRun: false, alreadyRegisteredBankTransactionIds: [2] },
    );
    expect(
      recordBatchResponse(
        outcomes,
        approvedMatchesOf(preview).slice(0, 3),
        response,
      ),
    ).toBeNull();

    const result = buildConfirmationResult(preview, outcomes, null, []);
    expect(result.dryRun).toBe(false);
    expect(
      result.lines.map((l) => [l.clipperProfileId, l.status, l.reason]),
    ).toEqual([
      ["a", "REGISTERED", undefined],
      ["b", "ALREADY_REGISTERED", undefined],
      ["c", "SKIPPED", "changed_since_preview"],
      ["d", "UNMATCHED", undefined],
      ["e", "AMBIGUOUS", "bank_transaction_shared"],
    ]);
    expect(result.lines[0]?.proofUrl).toBe("https://x/1.pdf");
    expect(result.totals).toEqual({
      REGISTERED: 1,
      ALREADY_REGISTERED: 1,
      SKIPPED: 1,
      UNMATCHED: 1,
      AMBIGUOUS: 1,
    });
    expect(countRegistered(result.lines)).toBe(2);
  });

  it("para quando o backend só simulou (extrato truncado) e não marca nada como registrado", () => {
    const outcomes: ConfirmationOutcomes = new Map();
    const truncated = reconciliation([], {
      dryRun: true,
      warnings: [
        "Extrato truncado no limite de páginas: nada foi registrado, só simulado.",
      ],
    });
    const stopReason = recordBatchResponse(
      outcomes,
      approvedMatchesOf(preview).slice(0, 2),
      truncated,
    );
    expect(stopReason).toContain("Extrato truncado");

    const result = buildConfirmationResult(
      preview,
      outcomes,
      stopReason,
      truncated.warnings,
    );
    expect(result.lines.slice(0, 3).map((l) => l.reason)).toEqual([
      "not_attempted",
      "not_attempted",
      "not_attempted",
    ]);
    expect(countRegistered(result.lines)).toBe(0);
    expect(result.warnings).toEqual(truncated.warnings);
  });

  it("depois de um erro, marca o lote como incerto e o resto como não tentado", () => {
    const outcomes: ConfirmationOutcomes = new Map();
    recordBatchFailure(outcomes, approvedMatchesOf(preview).slice(0, 1));
    const result = buildConfirmationResult(preview, outcomes, "timeout", []);
    expect(result.lines.slice(0, 3).map((l) => l.reason)).toEqual([
      "unknown_after_error",
      "not_attempted",
      "not_attempted",
    ]);
  });
});
