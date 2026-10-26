import type { RouterOutputs } from "@/trpc/react";

/**
 * Regras da confirmação do "Concluir pagamento do mensal", sem React: o diálogo
 * registra em lotes só os pares PIX + clipador aprovados na simulação e junta
 * as respostas às linhas dela.
 */

export type Reconciliation =
  RouterOutputs["admin"]["reconcileMonthlyContaSimplesPix"];
export type ReconciliationLine = Reconciliation["lines"][number];
export type ApprovedMatch = {
  bankTransactionId: number;
  clipperProfileId: string;
};
/** Resultado por PIX (contaSimplesTransactionId) do que já foi confirmado. */
export type ConfirmationOutcomes = Map<number, Partial<ReconciliationLine>>;

/**
 * PIX registrados por chamada: cada um baixa o comprovante, envia ao UploadThing
 * e avisa o clipador, então lotes pequenos mantêm cada requisição dentro do
 * tempo limite da função.
 */
export const CONFIRM_BATCH_SIZE = 3;

export function approvedMatchesOf(preview: Reconciliation): ApprovedMatch[] {
  return preview.lines.flatMap((line) =>
    line.status === "WOULD_REGISTER" &&
    typeof line.contaSimplesTransactionId === "number"
      ? [
          {
            bankTransactionId: line.contaSimplesTransactionId,
            clipperProfileId: line.clipperProfileId,
          },
        ]
      : [],
  );
}

/**
 * Guarda o que o backend respondeu para um lote. Devolve o motivo para parar
 * quando ele só simulou (extrato truncado): nada daquele lote foi registrado.
 */
export function recordBatchResponse(
  outcomes: ConfirmationOutcomes,
  batch: ApprovedMatch[],
  response: Reconciliation,
): string | null {
  if (response.dryRun) {
    for (const pair of batch) {
      outcomes.set(pair.bankTransactionId, {
        status: "SKIPPED",
        reason: "not_attempted",
      });
    }
    return response.warnings[0] ?? "O backend só simulou: nada foi registrado.";
  }
  for (const line of response.lines) {
    if (typeof line.contaSimplesTransactionId === "number") {
      outcomes.set(line.contaSimplesTransactionId, line);
    }
  }
  for (const id of response.alreadyRegisteredBankTransactionIds) {
    outcomes.set(id, { status: "ALREADY_REGISTERED" });
  }
  return null;
}

/** O lote pode ter sido registrado em parte: uma nova simulação mostra o que falta. */
export function recordBatchFailure(
  outcomes: ConfirmationOutcomes,
  batch: ApprovedMatch[],
): void {
  for (const pair of batch) {
    outcomes.set(pair.bankTransactionId, {
      status: "SKIPPED",
      reason: "unknown_after_error",
    });
  }
}

export function totalsOf(
  lines: ReconciliationLine[],
): Reconciliation["totals"] {
  const totals: Reconciliation["totals"] = {};
  for (const line of lines) {
    totals[line.status] = (totals[line.status] ?? 0) + 1;
  }
  return totals;
}

/**
 * Linhas da simulação com o resultado da confirmação. Um par aprovado sem
 * resposta mudou desde a simulação (o backend recalcula tudo e não o registrou)
 * ou ficou para trás porque a confirmação parou antes dele.
 */
export function buildConfirmationResult(
  preview: Reconciliation,
  outcomes: ConfirmationOutcomes,
  stopReason: string | null,
  warnings: string[],
): Reconciliation {
  const lines = preview.lines.map((line): ReconciliationLine => {
    const id = line.contaSimplesTransactionId;
    if (line.status !== "WOULD_REGISTER" || id === undefined) return line;
    const outcome = outcomes.get(id);
    if (outcome) return { ...line, ...outcome };
    return {
      ...line,
      status: "SKIPPED",
      reason: stopReason ? "not_attempted" : "changed_since_preview",
    };
  });
  return {
    ...preview,
    dryRun: false,
    lines,
    totals: totalsOf(lines),
    warnings: [...preview.warnings, ...warnings],
  };
}

/** Pares registrados agora ou numa tentativa anterior do mesmo lote. */
export function countRegistered(lines: ReconciliationLine[]): number {
  return lines.filter(
    (line) =>
      line.status === "REGISTERED" || line.status === "ALREADY_REGISTERED",
  ).length;
}
