"use client";

import * as React from "react";
import {
  ArrowSquareOut,
  CaretDown,
  CheckCircle,
  Info,
  MagnifyingGlass,
  Spinner,
  Warning,
} from "@phosphor-icons/react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import {
  approvedMatchesOf,
  buildConfirmationResult,
  CONFIRM_BATCH_SIZE,
  type ConfirmationOutcomes,
  countRegistered,
  recordBatchFailure,
  recordBatchResponse,
  type Reconciliation,
  type ReconciliationLine,
} from "./monthly-pix-reconciliation";
import { useFormatCurrency } from "./shared";

const POSITIVE =
  "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
const ATTENTION =
  "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400";
const NEGATIVE =
  "border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400";
const NEUTRAL = "border-border bg-muted/40 text-muted-foreground";

const STATUS_CONFIG: Record<
  ReconciliationLine["status"],
  { label: string; className: string; order: number }
> = {
  WOULD_REGISTER: { label: "Será registrado", className: POSITIVE, order: 0 },
  REGISTERED: { label: "Registrado", className: POSITIVE, order: 0 },
  ALREADY_REGISTERED: { label: "Registrado", className: POSITIVE, order: 0 },
  FAILED: { label: "Falhou", className: NEGATIVE, order: 1 },
  AMBIGUOUS: { label: "Revisar", className: ATTENTION, order: 2 },
  SKIPPED: { label: "Não registrado", className: ATTENTION, order: 3 },
  UNMATCHED: { label: "PIX não encontrado", className: NEUTRAL, order: 4 },
};

const REASON_LABELS: Record<string, string> = {
  wallet_held: "Carteira do clipador bloqueada",
  insufficient_wallet_balance: "Saldo da carteira menor que o valor",
  receipt_unavailable: "Comprovante indisponível na Conta Simples",
  pending_amount_changed: "O saldo mudou durante o registro",
  multiple_bank_transactions: "Mais de um PIX possível no extrato",
  bank_transaction_shared: "O mesmo PIX serve a outro saldo do clipador",
  changed_since_preview: "Mudou desde a simulação: simule de novo",
  not_attempted: "O registro parou antes deste PIX",
  unknown_after_error: "Falha de comunicação: simule de novo para conferir",
};

/** "Hoje" no fuso do backend: a data do pagamento não pode passar dele. */
function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function formatYmd(ymd: string): string {
  const [year, month, day] = ymd.split("-");
  return `${day}/${month}/${year}`;
}

function formatPixDate(iso: string | undefined): string {
  return iso
    ? format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: ptBR })
    : "—";
}

export function MonthlyPixReconciliationDialog({
  open,
  onOpenChange,
  slug,
  campaignId,
  campaignName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  campaignId: string;
  campaignName: string;
}) {
  const utils = api.useUtils();
  const formatCurrency = useFormatCurrency();

  const [paymentDate, setPaymentDate] = React.useState(todayInSaoPaulo);
  const [preview, setPreview] = React.useState<Reconciliation | null>(null);
  const [result, setResult] = React.useState<Reconciliation | null>(null);
  const [progress, setProgress] = React.useState<{
    done: number;
    total: number;
  } | null>(null);

  React.useEffect(() => {
    if (open) {
      setPaymentDate(todayInSaoPaulo());
      setPreview(null);
      setResult(null);
      setProgress(null);
    }
  }, [open]);

  const reconcile = api.admin.reconcileMonthlyContaSimplesPix.useMutation();
  const isConfirming = progress !== null && result === null;
  const isBusy = reconcile.isPending || isConfirming;

  const handleSimulate = () => {
    setPreview(null);
    setResult(null);
    reconcile.mutate(
      { campaignId, paymentDate, dryRun: true },
      {
        onSuccess: setPreview,
        onError: (error) =>
          toast.error(error.message || "Erro ao simular os PIX do mensal"),
      },
    );
  };

  /**
   * Registra só os pares PIX + clipador aprovados na simulação, em lotes. O
   * backend recalcula tudo a cada lote: o que mudou desde a simulação não entra.
   */
  const handleConfirm = async () => {
    if (!preview) return;
    const approved = approvedMatchesOf(preview);
    const outcomes: ConfirmationOutcomes = new Map();
    const warnings: string[] = [];
    let stopReason: string | null = null;
    setProgress({ done: 0, total: approved.length });

    for (let start = 0; start < approved.length; start += CONFIRM_BATCH_SIZE) {
      const batch = approved.slice(start, start + CONFIRM_BATCH_SIZE);
      try {
        const data = await reconcile.mutateAsync({
          campaignId,
          paymentDate,
          dryRun: false,
          approvedMatches: batch,
        });
        stopReason = recordBatchResponse(outcomes, batch, data);
        if (stopReason) {
          warnings.push(...data.warnings);
          break;
        }
      } catch (error) {
        stopReason =
          error instanceof Error ? error.message : "Erro ao registrar os PIX";
        recordBatchFailure(outcomes, batch);
        break;
      }
      setProgress({
        done: Math.min(start + batch.length, approved.length),
        total: approved.length,
      });
    }

    const finalResult = buildConfirmationResult(
      preview,
      outcomes,
      stopReason,
      warnings,
    );
    setResult(finalResult);

    const registered = countRegistered(finalResult.lines);
    const notRegistered = approved.length - registered;
    if (stopReason) {
      toast.error(`Registro interrompido: ${stopReason}`, {
        description: `${registered} de ${approved.length} PIX registrados.`,
      });
    } else if (notRegistered > 0) {
      toast.warning(
        `${registered} PIX registrado(s); ${notRegistered} não. Confira a lista.`,
      );
    } else {
      toast.success(`${registered} PIX registrado(s) com comprovante`);
    }

    if (registered > 0) {
      void Promise.all([
        utils.admin.getCompetitionDetailsAdmin.invalidate({ slug }),
        utils.admin.getCompetitionFinancials.invalidate({ slug }),
        utils.admin.getClipperAllTransactions.invalidate(),
        utils.admin.getClipperTransactionsInCampaign.invalidate(),
        utils.clipper.getWallet.invalidate(),
        utils.clipper.getTransactions.invalidate(),
        utils.clipper.getWalletStats.invalidate(),
      ]);
    }
  };

  const shown = result ?? preview;
  const lines = React.useMemo(
    () =>
      [...(shown?.lines ?? [])].sort(
        (a, b) =>
          STATUS_CONFIG[a.status].order - STATUS_CONFIG[b.status].order ||
          a.clipperName.localeCompare(b.clipperName, "pt-BR"),
      ),
    [shown],
  );
  const unclaimed = React.useMemo(
    () =>
      (shown?.unclaimedBankTransactions ?? []).filter(
        (pix) => pix.competitionCostCenter,
      ),
    [shown],
  );

  const sumOf = (statuses: ReconciliationLine["status"][]) => {
    const matching = lines.filter((line) => statuses.includes(line.status));
    return {
      count: matching.length,
      amount: matching.reduce((total, line) => total + line.amount, 0),
    };
  };
  const paid = sumOf(
    result ? ["REGISTERED", "ALREADY_REGISTERED"] : ["WOULD_REGISTER"],
  );
  const review = sumOf(["AMBIGUOUS", "SKIPPED", "FAILED"]);
  const missing = sumOf(["UNMATCHED"]);

  const canConfirm =
    !result &&
    !!preview &&
    paid.count > 0 &&
    !preview.statement.truncated &&
    !isBusy;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isBusy) onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-4xl">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle
              className="text-brand-cyan not-dark:text-primary size-5"
              weight="fill"
            />
            Concluir pagamento do mensal
          </DialogTitle>
          <DialogDescription>
            Procura no extrato da Conta Simples os PIX enviados para os
            clipadores de <strong>{campaignName}</strong> a partir da data do
            pagamento e registra cada um com o comprovante, como o
            &quot;Registrar PIX&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="monthly-pix-payment-date">
                Data do pagamento
              </Label>
              <Input
                id="monthly-pix-payment-date"
                type="date"
                className="h-10 rounded-xl sm:w-48"
                value={paymentDate}
                max={todayInSaoPaulo()}
                disabled={isBusy || !!result}
                onChange={(event) => {
                  setPaymentDate(event.target.value);
                  setPreview(null);
                }}
              />
            </div>
            <Button
              variant="outline"
              className="h-10 cursor-pointer rounded-xl"
              disabled={!paymentDate || isBusy || !!result}
              onClick={handleSimulate}
            >
              {reconcile.isPending && !isConfirming ? (
                <Spinner className="size-4 animate-spin" />
              ) : (
                <MagnifyingGlass className="size-4" />
              )}
              Simular
            </Button>
          </div>

          {!shown && (
            <p className="text-muted-foreground flex items-start gap-2 text-sm">
              <Info className="mt-0.5 size-4 shrink-0" />
              Use o dia em que o lote de PIX foi enviado. A busca vai dessa data
              até hoje e nada é registrado antes da sua confirmação.
            </p>
          )}

          {shown && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <SummaryTile
                  label={result ? "Registrados" : "Serão registrados"}
                  count={paid.count}
                  amount={formatCurrency(paid.amount)}
                  className={POSITIVE}
                />
                <SummaryTile
                  label="Para revisar"
                  count={review.count}
                  amount={formatCurrency(review.amount)}
                  className={ATTENTION}
                />
                <SummaryTile
                  label="PIX não encontrado"
                  count={missing.count}
                  amount={formatCurrency(missing.amount)}
                  className={NEUTRAL}
                />
              </div>

              <p className="text-muted-foreground text-xs">
                Extrato de {formatYmd(shown.window.startDate)} a{" "}
                {formatYmd(shown.window.endDate)} ·{" "}
                {shown.statement.externallyRegistered} PIX do período já tinham
                sido registrados à mão e foram ignorados.
              </p>

              {shown.notDue.payouts > 0 && (
                <Notice>
                  A competição ainda não terminou: {shown.notDue.payouts}{" "}
                  saldo(s) ({formatCurrency(shown.notDue.amount)}) ficam de fora
                  até o fim dela.
                </Notice>
              )}
              {shown.warnings.map((warning) => (
                <Notice key={warning}>{warning}</Notice>
              ))}

              {lines.length === 0 ? (
                <p className="border-border/60 text-muted-foreground rounded-2xl border px-4 py-8 text-center text-sm">
                  Nenhum saldo pendente nesta competição.
                </p>
              ) : (
                <div className="border-border/60 overflow-x-auto rounded-2xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Clipador</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>PIX no extrato</TableHead>
                        <TableHead>Situação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((line) => (
                        <TableRow key={line.clipperProfileId}>
                          <TableCell className="font-medium">
                            {line.clipperName}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(line.amount)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {line.contaSimplesTransactionId ? (
                              <>
                                <div>{formatPixDate(line.transactionDate)}</div>
                                <div>{line.counterpartyName}</div>
                                {line.costCenter && (
                                  <div>{line.costCenter}</div>
                                )}
                              </>
                            ) : line.candidates?.length ? (
                              line.candidates.map((candidate) => (
                                <div key={candidate.contaSimplesTransactionId}>
                                  {formatPixDate(candidate.transactionDate)}
                                  {candidate.costCenter
                                    ? ` · ${candidate.costCenter}`
                                    : ""}
                                </div>
                              ))
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col items-start gap-1">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "rounded-full",
                                  STATUS_CONFIG[line.status].className,
                                )}
                              >
                                {STATUS_CONFIG[line.status].label}
                              </Badge>
                              {line.reason && (
                                <span className="text-muted-foreground text-xs">
                                  {REASON_LABELS[line.reason] ?? line.reason}
                                </span>
                              )}
                              {line.proofUrl && (
                                <a
                                  href={line.proofUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-brand-cyan not-dark:text-primary inline-flex items-center gap-1 text-xs hover:underline"
                                >
                                  Comprovante
                                  <ArrowSquareOut className="size-3" />
                                </a>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {unclaimed.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-xs font-medium">
                    <CaretDown className="size-3" />
                    PIX de competições no período sem saldo correspondente (
                    {unclaimed.length})
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-1">
                    {unclaimed.map((pix) => (
                      <div
                        key={pix.contaSimplesTransactionId}
                        className="text-muted-foreground flex flex-wrap gap-x-3 text-xs"
                      >
                        <span>{formatPixDate(pix.transactionDate)}</span>
                        <span className="text-foreground">
                          {pix.counterpartyName}
                        </span>
                        <span className="tabular-nums">
                          {formatCurrency(pix.amount)}
                        </span>
                        <span>{pix.costCenter}</span>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          {result ? (
            <Button
              className="btn-gradient-auth cursor-pointer rounded-xl"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                className="cursor-pointer rounded-xl"
                disabled={isBusy}
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
                disabled={!canConfirm}
                onClick={() => void handleConfirm()}
              >
                {isConfirming ? (
                  <Spinner className="size-4 animate-spin" />
                ) : (
                  <CheckCircle className="size-4" weight="fill" />
                )}
                {isConfirming && progress
                  ? `Registrando ${progress.done} de ${progress.total}…`
                  : paid.count > 0
                    ? `Registrar ${paid.count} PIX (${formatCurrency(paid.amount)})`
                    : "Registrar PIX"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryTile({
  label,
  count,
  amount,
  className,
}: {
  label: string;
  count: number;
  amount: string;
  className: string;
}) {
  return (
    <div className={cn("rounded-2xl border p-3", className)}>
      <p className="text-xs font-medium">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{count}</p>
      <p className="text-xs tabular-nums opacity-80">{amount}</p>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-2xl border p-3 text-sm",
        ATTENTION,
      )}
    >
      <Warning className="mt-0.5 size-4 shrink-0" weight="fill" />
      <span>{children}</span>
    </p>
  );
}
