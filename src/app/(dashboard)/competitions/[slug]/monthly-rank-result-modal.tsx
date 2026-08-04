"use client"

import * as React from "react"
import {
  BookmarkSimple,
  CalendarBlank,
  ChatCircle,
  CheckCircle,
  Coins,
  Copy,
  Crown,
  DownloadSimple,
  Eye,
  FileText,
  FilmSlate,
  Heart,
  Lightning,
  ShareFat,
  Spinner,
  TrendUp,
  Trophy,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { buildMonthlyRankDiscordExportText } from "@/lib/daily-ranking-preview"
import { cn } from "@/lib/utils"
import { api, type RouterOutputs } from "@/trpc/react"

import {
  ConfirmWordInput,
  downloadTextFile,
  formatMetricFull,
  MetricPill,
  PositionBadge,
  useFormatCurrency,
} from "./shared"

export type MonthlyRankPreview =
  RouterOutputs["admin"]["previewMonthlyRankByPeriod"]

type MonthlyPayPlan = Extract<
  RouterOutputs["admin"]["payMonthlyRankByPeriod"],
  { dryRun: true }
>

interface MonthlyRankResultModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: MonthlyRankPreview | null
  slug: string
  refetch: () => void
  /** Re-preview silencioso disparado após um pagamento concluído. */
  onSilentRepreview: () => void
}

export function MonthlyRankResultModal({
  open,
  onOpenChange,
  data,
  slug,
  refetch,
  onSilentRepreview,
}: MonthlyRankResultModalProps) {
  const formatCurrency = useFormatCurrency()
  const utils = api.useUtils()

  /* ===== Exportar Discord ===== */
  const [exportOpen, setExportOpen] = React.useState(false)
  const [exportText, setExportText] = React.useState("")

  /* ===== Pagar ranking mensal ===== */
  const [payOpen, setPayOpen] = React.useState(false)
  const [payPlan, setPayPlan] = React.useState<MonthlyPayPlan | null>(null)
  const [payInput, setPayInput] = React.useState("")

  /* Fecha os sub-dialogs quando o modal principal fecha. */
  React.useEffect(() => {
    if (!open) {
      setExportOpen(false)
      setExportText("")
      setPayOpen(false)
      setPayPlan(null)
      setPayInput("")
    }
  }, [open])

  const payMonthlyRank = api.admin.payMonthlyRankByPeriod.useMutation({
    onSuccess: async (result) => {
      if (result.dryRun) {
        setPayPlan(result)
        setPayOpen(true)
        return
      }
      const ok = result.paid.length
      const bad = result.failed.length
      if (bad === 0) {
        toast.success(
          `Pagamento mensal concluído: ${ok} crédito(s) processado(s).`,
          {
            description: `Total creditado: ${formatCurrency(result.totalAmountPaid)}`,
          },
        )
      } else {
        toast.warning(`Pagamento parcial: ${ok} ok, ${bad} falha(s).`, {
          description: result.failed
            .map((f) => `${f.position}º ${f.clipperName}: ${f.error}`)
            .join(" · "),
        })
      }
      setPayOpen(false)
      setPayPlan(null)
      setPayInput("")
      onSilentRepreview()
      await utils.admin.getCompetitionDetailsAdmin.invalidate({ slug })
      refetch()
    },
    onError: (error) =>
      toast.error(
        error.message || "Erro ao processar pagamento do rank mensal",
      ),
  })

  const openExport = () => {
    if (!data || data.entries.length === 0) {
      toast.error("Nenhum dado no rank para gerar o texto")
      return
    }
    setExportText(
      buildMonthlyRankDiscordExportText({
        campaignName: data.campaignName,
        sortedByEngagement: data.sortedByEngagement,
        entries: data.entries.map((entry) => ({
          position: entry.position,
          displayName: entry.fullName || entry.clipperName,
          usernameLabel: `@${String(entry.clipperName).replace(/^@/, "")}`,
          totalViews: entry.totalViews,
          totalLikes: entry.totalLikes,
          totalComments: entry.totalComments,
          totalShares: entry.totalShares,
          totalSaves: entry.totalSaves,
          postsCount: entry.postsCount,
          engagementRate: entry.engagementRate,
          rankingScore: entry.rankingScore,
          prize: entry.prize,
        })),
        stats: data.stats,
      }),
    )
    setExportOpen(true)
  }

  const copyExportText = () => {
    if (!exportText) {
      toast.error("Nada para copiar")
      return
    }
    navigator.clipboard
      .writeText(exportText)
      .then(() => {
        toast.success("Texto copiado", {
          description: "Cole no Discord ou salve como .md.",
        })
      })
      .catch(() => {
        toast.error("Não foi possível copiar")
      })
  }

  const downloadExportMd = () => {
    if (!exportText) {
      toast.error("Nenhum texto para baixar")
      return
    }
    const fileName = `ranking_mensal_${slug}_${data?.monthPeriod || "mes"}.md`
    downloadTextFile(fileName, exportText, "text/markdown")
    toast.success("Arquivo .md baixado", { description: fileName })
  }

  const startPaySimulation = () => {
    if (!data?.campaignId) {
      toast.error("Gere o rank mensal antes de pagar")
      return
    }
    payMonthlyRank.mutate({ campaignId: data.campaignId, dryRun: true })
  }

  const confirmPayExecution = () => {
    if (!data?.campaignId) return
    payMonthlyRank.mutate({ campaignId: data.campaignId, dryRun: false })
  }

  return (
    <>
      {/* ===== Modal: resultado do rank mensal ===== */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] w-[96vw] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-3xl">
          {/* Header roxo/violeta */}
          <div className="border-border/60 relative shrink-0 overflow-hidden border-b">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-fuchsia-500/10" />
            <div className="relative flex flex-col gap-3 p-4 pr-12 sm:p-6 sm:pr-14">
              <DialogHeader className="gap-2 text-left">
                <DialogTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-violet-500 dark:text-violet-300">
                    <Trophy className="size-4.5" weight="fill" />
                  </span>
                  <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text font-bold text-transparent dark:from-violet-300 dark:via-purple-300 dark:to-fuchsia-200">
                    Rank Mensal
                  </span>
                  <span className="text-muted-foreground hidden text-sm font-normal sm:inline">
                    —
                  </span>
                  <span className="text-foreground/80 hidden min-w-0 truncate text-sm font-medium sm:inline">
                    {data?.campaignName}
                  </span>
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="flex flex-col gap-1.5 text-left">
                    <span className="text-foreground/70 block text-xs font-medium sm:hidden">
                      {data?.campaignName}
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className="gap-1 rounded-full border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300"
                      >
                        <CalendarBlank className="size-3" weight="fill" />
                        {data?.monthPeriod || "acumulado"}
                      </Badge>
                      {data?.sortedByEngagement ? (
                        <Badge
                          variant="outline"
                          className="gap-1 rounded-full border-fuchsia-500/30 bg-gradient-to-r from-fuchsia-500/15 to-violet-500/15 text-fuchsia-600 dark:text-fuchsia-300"
                        >
                          <Lightning className="size-3" weight="fill" />
                          Score
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1 rounded-full border-sky-500/30 bg-gradient-to-r from-sky-500/15 to-cyan-500/15 text-sky-600 dark:text-sky-300"
                        >
                          <Eye className="size-3" weight="fill" />
                          Views
                        </Badge>
                      )}
                      {data?.topCount != null && (
                        <Badge
                          variant="outline"
                          className="gap-1 rounded-full border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        >
                          <Crown className="size-3" weight="fill" />
                          Top {data.topCount}
                        </Badge>
                      )}
                    </span>
                  </div>
                </DialogDescription>
              </DialogHeader>

              {data && data.entries.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="border-border/60 bg-muted/20 rounded-xl border px-2.5 py-2 text-center sm:px-3">
                    <p className="text-sm font-bold tabular-nums sm:text-base">
                      {formatMetricFull(data.stats.totalPostsInMonth)}
                    </p>
                    <p className="text-muted-foreground text-[9px] font-semibold tracking-wider uppercase sm:text-[10px]">
                      Posts elegíveis
                    </p>
                  </div>
                  <div className="border-border/60 bg-muted/20 rounded-xl border px-2.5 py-2 text-center sm:px-3">
                    <p className="text-sm font-bold tabular-nums sm:text-base">
                      {formatMetricFull(data.stats.totalCompetitionViews)}
                    </p>
                    <p className="text-muted-foreground text-[9px] font-semibold tracking-wider uppercase sm:text-[10px]">
                      Views totais
                    </p>
                  </div>
                </div>
              )}

              {data && data.entries.length > 0 && (
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openExport}
                    className="h-9 w-full cursor-pointer gap-2 rounded-xl border-teal-500/40 bg-teal-500/10 font-semibold text-teal-600 hover:bg-teal-500/20 hover:text-teal-700 sm:w-auto dark:text-teal-300 dark:hover:text-teal-200"
                  >
                    <FileText className="size-3.5 shrink-0" weight="fill" />
                    Exportar Discord
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={startPaySimulation}
                    disabled={
                      data.canUndoRankPayments || payMonthlyRank.isPending
                    }
                    className={cn(
                      "h-9 w-full cursor-pointer gap-2 rounded-xl font-semibold sm:w-auto",
                      data.canUndoRankPayments
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 disabled:opacity-60 dark:text-emerald-300"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-amber-300 dark:hover:text-amber-200",
                    )}
                  >
                    {payMonthlyRank.isPending ? (
                      <Spinner className="size-3.5 shrink-0 animate-spin" />
                    ) : data.canUndoRankPayments ? (
                      <CheckCircle className="size-3.5 shrink-0" weight="fill" />
                    ) : (
                      <Coins className="size-3.5 shrink-0" weight="fill" />
                    )}
                    {data.canUndoRankPayments
                      ? "Ranking pago"
                      : "Pagar rank mensal"}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Lista de entries */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {data && data.entries.length > 0 ? (
              <div className="flex flex-col gap-2">
                {data.entries.map((entry) => (
                  <div
                    key={`${entry.position}-${entry.clipperProfileId}`}
                    className="border-border/60 bg-muted/20 rounded-2xl border p-3.5 sm:p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <PositionBadge position={entry.position} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">
                            {entry.fullName || entry.clipperName}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            @{String(entry.clipperName).replace(/^@/, "")}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {entry.prize > 0 && (
                          <Badge className="rounded-full border-0 bg-gradient-to-r from-emerald-500 to-green-600 font-bold text-white">
                            {formatCurrency(entry.prize)}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full text-[10px]",
                            entry.prizeStatus === "PAID"
                              ? "gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "border-border bg-muted/40 text-muted-foreground",
                          )}
                        >
                          {entry.prizeStatus === "PAID" ? (
                            <>
                              <CheckCircle className="size-3" weight="fill" />
                              Pago
                            </>
                          ) : entry.prizeStatus === "PENDING" ? (
                            "Pendente"
                          ) : (
                            entry.prizeStatus
                          )}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <MetricPill
                        icon={<Eye className="size-3.5" weight="fill" />}
                        value={formatMetricFull(entry.totalViews)}
                        label="views"
                      />
                      <MetricPill
                        icon={<Heart className="size-3.5" weight="fill" />}
                        value={formatMetricFull(entry.totalLikes)}
                      />
                      <MetricPill
                        icon={<ChatCircle className="size-3.5" weight="fill" />}
                        value={formatMetricFull(entry.totalComments)}
                      />
                      <MetricPill
                        icon={<ShareFat className="size-3.5" weight="fill" />}
                        value={formatMetricFull(entry.totalShares)}
                      />
                      <MetricPill
                        icon={
                          <BookmarkSimple className="size-3.5" weight="fill" />
                        }
                        value={formatMetricFull(entry.totalSaves)}
                      />
                      <MetricPill
                        icon={<FilmSlate className="size-3.5" weight="fill" />}
                        value={formatMetricFull(entry.postsCount)}
                        label="posts eleg."
                      />
                      <MetricPill
                        icon={<TrendUp className="size-3.5" weight="bold" />}
                        value={`${entry.engagementRate.toFixed(2)}%`}
                        label="ER"
                      />
                      {data.sortedByEngagement && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-fuchsia-500/10 px-2 py-1 text-xs font-semibold text-fuchsia-600 tabular-nums dark:text-fuchsia-300">
                          <Lightning className="size-3.5" weight="fill" />
                          {formatMetricFull(Math.round(entry.rankingScore))}
                          <span className="font-medium opacity-70">score</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Nenhuma entrada (sem posts elegíveis agregados).
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="border-border/60 flex shrink-0 items-center justify-end border-t px-4 py-3 sm:px-6">
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer rounded-xl px-5"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Modal: exportar Discord (.md) ===== */}
      <Dialog
        open={exportOpen}
        onOpenChange={(nextOpen) => {
          setExportOpen(nextOpen)
          if (!nextOpen) setExportText("")
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-2xl">
          <DialogHeader className="border-border/60 shrink-0 border-b p-4 text-left sm:p-6">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="text-muted-foreground size-5" weight="fill" />
              Rank mensal para o Discord (.md)
            </DialogTitle>
            <DialogDescription>
              Copie o texto abaixo ou baixe o arquivo .md para publicar no
              Discord.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <Textarea
              readOnly
              value={exportText || "—"}
              className="min-h-[300px] w-full resize-none rounded-xl font-mono text-xs leading-relaxed"
            />
          </div>
          <DialogFooter className="border-border/60 shrink-0 gap-2 border-t px-4 py-3 sm:justify-end sm:px-6">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer rounded-xl"
              onClick={() => setExportOpen(false)}
            >
              Voltar
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="cursor-pointer gap-2 rounded-xl"
              disabled={!exportText}
              onClick={downloadExportMd}
            >
              <DownloadSimple className="size-4" weight="bold" />
              Baixar .md
            </Button>
            <Button
              type="button"
              className="btn-gradient-auth cursor-pointer gap-2 rounded-xl font-semibold"
              disabled={!exportText}
              onClick={copyExportText}
            >
              <Copy className="size-4" weight="fill" />
              Copiar texto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== AlertDialog: pagar ranking mensal ===== */}
      <AlertDialog
        open={payOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !payMonthlyRank.isPending) {
            setPayOpen(false)
            setPayPlan(null)
            setPayInput("")
          }
        }}
      >
        <AlertDialogContent className="flex max-h-[90vh] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-lg">
          {/* Header roxo */}
          <div className="border-border/60 relative shrink-0 overflow-hidden border-b">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-fuchsia-500/10" />
            <AlertDialogHeader className="relative gap-2 p-4 text-left sm:p-6">
              <AlertDialogTitle className="flex items-center gap-2.5 text-base sm:text-lg">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-violet-500 dark:text-violet-300">
                  <Coins className="size-5" weight="fill" />
                </span>
                <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text font-bold text-transparent dark:from-violet-300 dark:via-purple-300 dark:to-fuchsia-200">
                  Pagar Ranking Mensal
                </span>
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="flex flex-col gap-1 text-left text-sm">
                  {payPlan ? (
                    <>
                      <span className="flex flex-wrap items-center gap-2">
                        <strong className="text-foreground">
                          {payPlan.campaignName}
                        </strong>
                        <Badge
                          variant="outline"
                          className="gap-1 rounded-full border-violet-500/30 bg-violet-500/10 text-[10px] text-violet-600 dark:text-violet-300"
                        >
                          <CalendarBlank className="size-2.5" weight="fill" />
                          {payPlan.monthPeriod || "acumulado"}
                        </Badge>
                      </span>
                      <span className="text-muted-foreground/80 text-xs">
                        Prêmios mensais conforme a tabela da regra ativa.
                      </span>
                    </>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Spinner className="size-3 animate-spin" />
                      Carregando resumo…
                    </span>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>

          {/* Plano */}
          {payPlan && (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 text-sm sm:p-6">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-violet-500/25 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 px-3.5 py-3">
                <div>
                  <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
                    Total a creditar
                  </p>
                  <p className="text-lg font-bold text-violet-600 tabular-nums sm:text-xl dark:text-violet-300">
                    {formatCurrency(payPlan.totalAmount)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-xs">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {payPlan.payableCount}
                    </span>{" "}
                    pagamento(s)
                  </p>
                  {payPlan.skippedCount > 0 && (
                    <p className="text-muted-foreground text-xs">
                      <span className="text-muted-foreground/60">
                        {payPlan.skippedCount}
                      </span>{" "}
                      ignorado(s)
                    </p>
                  )}
                </div>
              </div>

              {payPlan.payable.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-foreground/80 text-xs font-semibold tracking-wider uppercase">
                    Créditos a processar
                  </p>
                  <div className="border-border/60 bg-muted/10 flex max-h-36 flex-col gap-1 overflow-y-auto rounded-xl border p-2">
                    {payPlan.payable.map((payment) => (
                      <div
                        key={`mpay-${payment.position}-${payment.clipperName}`}
                        className="hover:bg-muted/40 flex items-center justify-between gap-2 rounded-lg px-2 py-1.5"
                      >
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="text-foreground/80 shrink-0 font-mono text-xs font-bold">
                            {payment.position}º
                          </span>
                          <p className="text-foreground/90 truncate text-xs font-medium">
                            {payment.clipperName}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                          {formatCurrency(payment.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {payPlan.skipped.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-muted-foreground/60 text-xs font-semibold tracking-wider uppercase">
                    Ignorados
                  </p>
                  <div className="border-border/60 bg-muted/10 flex max-h-28 flex-col gap-1 overflow-y-auto rounded-xl border p-2">
                    {payPlan.skipped.map((skip) => (
                      <div
                        key={`mskip-${skip.position}-${skip.reason}`}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5"
                      >
                        <span className="text-muted-foreground/60 truncate text-xs">
                          {skip.clipperName}
                        </span>
                        <span className="text-muted-foreground/40 shrink-0 text-[10px]">
                          {skip.reason}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Confirmação */}
          <div className="border-border/60 shrink-0 border-t p-4 sm:px-6">
            <ConfirmWordInput
              word="PAGAR"
              value={payInput}
              onChange={setPayInput}
              id="confirm-pagar-rank-mensal"
            />
          </div>

          <AlertDialogFooter className="border-border/60 shrink-0 gap-2 border-t px-4 py-3 sm:px-6">
            <AlertDialogCancel
              disabled={payMonthlyRank.isPending}
              className="cursor-pointer rounded-xl"
              onClick={() => setPayInput("")}
            >
              Cancelar
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={
                payInput !== "PAGAR" ||
                payMonthlyRank.isPending ||
                !payPlan ||
                payPlan.payableCount === 0
              }
              onClick={confirmPayExecution}
              className="cursor-pointer gap-2 rounded-xl bg-violet-600 font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {payMonthlyRank.isPending ? (
                <Spinner className="size-4 animate-spin" />
              ) : (
                <Coins className="size-4" weight="fill" />
              )}
              Confirmar pagamento
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
