"use client"

import * as React from "react"
import Image from "next/image"
import {
  ArrowCounterClockwise,
  ArrowSquareOut,
  CalendarBlank,
  ChatCircle,
  Check,
  CheckCircle,
  Clock,
  Coins,
  Copy,
  CurrencyDollar,
  DownloadSimple,
  Eye,
  FileCsv,
  FileText,
  Heart,
  Lightning,
  Megaphone,
  Money,
  Pulse,
  Receipt,
  ShareNetwork,
  Sparkle,
  Spinner,
  Trophy,
  UserMinus,
  VideoCamera,
  Wallet,
  Warning,
  X,
  XCircle,
} from "@phosphor-icons/react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
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
import { Label } from "@/components/ui/label"
import { Bone } from "@/components/shared/skeletons"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { buildDailyRankDiscordExportText } from "@/lib/daily-ranking-preview"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"
import { api, type RouterOutputs } from "@/trpc/react"

import {
  ConfirmWordInput,
  PositionBadge,
  detectPlatformFromPostUrl,
  downloadTextFile,
  escapeCsvCell,
  formatCurrencyPlain,
  formatIsoInstantBrasil,
  formatMetricFull,
  parsePixPreviewNumber,
  useFormatCurrency,
  type CompetitionDetails,
} from "./shared"

/* ============================================================
   Tipos do contrato tab-daily ⇄ modal resultado
   ============================================================ */

export type DailyRankPreview = RouterOutputs["admin"]["previewDailyRankByDate"]

type DailyRankPreviewEntry = DailyRankPreview["entries"][number]

type PayRankPlan = Extract<
  RouterOutputs["admin"]["payDailyRankByDate"],
  { dryRun: true }
>

type UndoRankPlan = Extract<
  RouterOutputs["admin"]["undoDailyRankPayments"],
  { dryRun: true }
>

type TopPostersPreview =
  RouterOutputs["admin"]["previewTopPostersDailyRankByDate"]

type PayTopPostersPlan = Extract<
  RouterOutputs["admin"]["payTopPostersDailyRankByDate"],
  { dryRun: true }
>

export interface DailyRankResultModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slug: string
  campaignId: string
  data: CompetitionDetails
  preview: DailyRankPreview | null
  markAnnouncedOnPay: boolean
  onMarkAnnouncedChange: (value: boolean) => void
  /**
   * Re-preview SILENCIOSO do rank (atualiza dados sem toast/troca de modal).
   * `fallbackErrorMessage` vira toast extra caso o refresh falhe.
   */
  refreshPreviewSilently: (options?: { fallbackErrorMessage?: string }) => void
  refetch: () => void
}

/* ============================================================
   Helpers locais
   ============================================================ */

function slugifyCampaignName(name: string | null | undefined): string {
  return (name ?? "ranking")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
}

function formatLongDate(ymd: string): string {
  return format(parseISO(ymd), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
}

/** Chip de métrica compacto (variação com cores por métrica). */
function MetricChip({
  icon,
  children,
  tone,
  muted,
}: {
  icon?: React.ReactNode
  children: React.ReactNode
  tone: "blue" | "rose" | "sky" | "violet" | "amber" | "pink"
  muted?: boolean
}) {
  const tones: Record<string, string> = {
    blue: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-300",
    rose: "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300",
    sky: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-300",
    violet:
      "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-300",
    amber:
      "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300",
    pink: "border-pink-500/20 bg-gradient-to-r from-pink-500/10 to-purple-500/10 text-pink-600 dark:text-pink-300",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium tabular-nums sm:text-[11px]",
        muted
          ? "border-border/30 bg-muted/20 text-muted-foreground"
          : tones[tone],
      )}
    >
      {icon}
      {children}
    </span>
  )
}

/* ============================================================
   Modal Resultado do Rank Diário (o centro de tudo)
   ============================================================ */

export function DailyRankResultModal({
  open,
  onOpenChange,
  slug,
  campaignId,
  data,
  preview,
  markAnnouncedOnPay,
  onMarkAnnouncedChange,
  refreshPreviewSilently,
  refetch,
}: DailyRankResultModalProps) {
  const formatCurrency = useFormatCurrency()
  const utils = api.useUtils()

  /* ===== Estado interno dos sub-modais ===== */
  const [dailyRankExportModalOpen, setDailyRankExportModalOpen] =
    React.useState(false)
  const [dailyRankExportText, setDailyRankExportText] = React.useState("")
  const [topPostersModalOpen, setTopPostersModalOpen] = React.useState(false)
  const [topPostersExportModalOpen, setTopPostersExportModalOpen] =
    React.useState(false)
  const [topPostersExportText, setTopPostersExportText] = React.useState("")
  const [topPostersPreviewData, setTopPostersPreviewData] =
    React.useState<TopPostersPreview | null>(null)
  /** Clipadores removidos do rateio do Top Postadores antes de pagar. */
  const [
    topPostersExcludedApplicationIds,
    setTopPostersExcludedApplicationIds,
  ] = React.useState<string[]>([])
  const [topPostersPayDialogOpen, setTopPostersPayDialogOpen] =
    React.useState(false)
  const [topPostersPayPlan, setTopPostersPayPlan] =
    React.useState<PayTopPostersPlan | null>(null)
  const [topPostersPayInput, setTopPostersPayInput] = React.useState("")
  const [paymentTransactionsOpen, setPaymentTransactionsOpen] =
    React.useState(false)
  const [dailyPixPayoutModalOpen, setDailyPixPayoutModalOpen] =
    React.useState(false)
  const [dailyPixPreviewPayload, setDailyPixPreviewPayload] =
    React.useState<Record<string, unknown> | null>(null)
  const [payRankDialogOpen, setPayRankDialogOpen] = React.useState(false)
  const [payRankInput, setPayRankInput] = React.useState("")
  const [payRankPlan, setPayRankPlan] = React.useState<PayRankPlan | null>(null)
  const [undoRankDialogOpen, setUndoRankDialogOpen] = React.useState(false)
  const [undoRankPlan, setUndoRankPlan] = React.useState<UndoRankPlan | null>(
    null,
  )
  const [disqualifyConfirm, setDisqualifyConfirm] = React.useState<{
    dailyRankingEntryId: string
    clipPostId: string
    clipperName: string
    submittedUrl: string
  } | null>(null)
  const [disqualifyInput, setDisqualifyInput] = React.useState("")
  const [disqualifyReason, setDisqualifyReason] = React.useState("")

  /* Ao fechar o modal principal, zera todos os sub-estados. */
  React.useEffect(() => {
    if (!open) {
      setDailyRankExportModalOpen(false)
      setDailyRankExportText("")
      setTopPostersModalOpen(false)
      setTopPostersExportModalOpen(false)
      setTopPostersExportText("")
      setTopPostersPreviewData(null)
      setTopPostersExcludedApplicationIds([])
      setTopPostersPayDialogOpen(false)
      setTopPostersPayPlan(null)
      setTopPostersPayInput("")
      setPaymentTransactionsOpen(false)
      setDailyPixPayoutModalOpen(false)
      setDailyPixPreviewPayload(null)
      setPayRankDialogOpen(false)
      setPayRankInput("")
      setPayRankPlan(null)
      setUndoRankDialogOpen(false)
      setUndoRankPlan(null)
      setDisqualifyConfirm(null)
      setDisqualifyInput("")
      setDisqualifyReason("")
    }
  }, [open])

  /* ===== Queries ===== */
  const { data: paymentTransactions, isLoading: isLoadingTransactions } =
    api.admin.getDailyRankPaymentTransactions.useQuery(
      { campaignId, date: preview?.date ?? "" },
      { enabled: paymentTransactionsOpen && !!campaignId && !!preview?.date },
    )

  /* ===== Mutations ===== */
  const previewTopPostersDailyRankByDate =
    api.admin.previewTopPostersDailyRankByDate.useMutation({
      onSuccess: (result) => {
        setTopPostersPreviewData(result)
        setTopPostersModalOpen(true)
      },
      onError: (err) => {
        toast.error(err.message || "Erro ao gerar top postadores do dia")
      },
    })

  const payTopPostersDailyRankByDate =
    api.admin.payTopPostersDailyRankByDate.useMutation({
      onSuccess: async (result) => {
        if (result.dryRun) {
          setTopPostersPayPlan(result)
          setTopPostersPayDialogOpen(true)
          return
        }

        const ok = result.paid.length
        const bad = result.failed.length
        if (bad === 0) {
          toast.success(
            `Top Postadores pago: ${ok} crédito(s) processado(s).`,
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

        setTopPostersPayDialogOpen(false)
        setTopPostersPayPlan(null)
        setTopPostersPayInput("")

        if (result.campaignId && result.date) {
          previewTopPostersDailyRankByDate.mutate({
            campaignId: result.campaignId,
            date: result.date,
            excludedApplicationIds: topPostersExcludedApplicationIds,
          })
        }

        await utils.admin.getCompetitionDetailsAdmin.invalidate({ slug })
        refetch()
      },
      onError: (err) => {
        toast.error(err.message || "Erro ao pagar Top Postadores")
      },
    })

  const payDailyRankByDate = api.admin.payDailyRankByDate.useMutation({
    onSuccess: async (result) => {
      if (result.dryRun) {
        setPayRankPlan(result)
        setPayRankDialogOpen(true)
        return
      }
      const ok = result.paid.length
      const bad = result.failed.length
      if (bad === 0) {
        toast.success(
          `Pagamento concluído: ${ok} crédito(s) de prêmio processado(s).`,
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
      setPayRankDialogOpen(false)
      setPayRankPlan(null)
      refreshPreviewSilently()
      await utils.admin.getCompetitionDetailsAdmin.invalidate({ slug })
      refetch()
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao processar pagamento do rank")
    },
  })

  const previewDailyPixPayout = api.admin.previewDailyPixPayout.useMutation({
    onSuccess: (payload) => {
      setDailyPixPreviewPayload(payload as Record<string, unknown>)
      setDailyPixPayoutModalOpen(true)
      toast.success("Prévia PIX carregada")
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao carregar prévia PIX")
    },
  })

  const executeDailyPixPayout = api.admin.executeDailyPixPayout.useMutation({
    onSuccess: async () => {
      toast.success("Pagamento PIX concluído.")
      setDailyPixPayoutModalOpen(false)
      setDailyPixPreviewPayload(null)
      refreshPreviewSilently()
      await utils.admin.getDailyRankPaymentTransactions.invalidate({
        campaignId,
        date: preview?.date ?? "",
      })
      await utils.admin.getDailyRankingCalendar.invalidate({ campaignId })
      await utils.admin.getCompetitionDetailsAdmin.invalidate({ slug })
      refetch()
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao executar pagamento PIX")
    },
  })

  const undoDailyRankPayments = api.admin.undoDailyRankPayments.useMutation({
    onSuccess: async (result) => {
      if (result.dryRun) {
        setUndoRankPlan(result)
        setUndoRankDialogOpen(true)
        return
      }
      toast.success(
        `Estorno concluído: ${result.reversed.length} lançamento(s) revertido(s).`,
        {
          description: `Total debitado das carteiras: ${formatCurrency(result.totalAmountReversed)}`,
        },
      )
      setUndoRankDialogOpen(false)
      setUndoRankPlan(null)
      refreshPreviewSilently()
      await utils.admin.getDailyRankingCalendar.invalidate({ campaignId })
      await utils.admin.getCompetitionDetailsAdmin.invalidate({ slug })
      refetch()
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao desfazer pagamento do rank")
    },
  })

  const disqualifyDailyRankingEntry =
    api.admin.disqualifyDailyRankingEntry.useMutation({
      onSuccess: async (result) => {
        toast.success(result.message)
        setDisqualifyConfirm(null)
        setDisqualifyInput("")
        setDisqualifyReason("")
        refreshPreviewSilently({
          fallbackErrorMessage:
            "Vídeo desqualificado, mas não foi possível atualizar a lista do preview.",
        })
        await utils.admin.getCompetitionDetailsAdmin.invalidate({ slug })
        refetch()
      },
      onError: (err) => {
        toast.error(err.message || "Erro ao desqualificar vídeo")
      },
    })

  const undoDisqualifyEntry =
    api.admin.undoDisqualifyDailyRankingEntry.useMutation({
      onSuccess: async (result) => {
        toast.success(result.message)
        refreshPreviewSilently({
          fallbackErrorMessage:
            "Desclassificação revertida, mas não foi possível atualizar a lista.",
        })
        await utils.admin.getCompetitionDetailsAdmin.invalidate({ slug })
        refetch()
      },
      onError: (err) => {
        toast.error(err.message || "Erro ao reverter desclassificação")
      },
    })

  const toggleAnnounced = api.admin.toggleDailyRankingAnnounced.useMutation({
    onSuccess: () => {
      void utils.admin.getDailyRankingCalendar.invalidate({ campaignId })
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao atualizar status de divulgação")
    },
  })

  /* ===== Handlers de export ===== */

  const openDailyRankPreviewExport = () => {
    if (!preview || preview.entries.length === 0) {
      toast.error("Nenhum dado no rank para gerar o texto")
      return
    }
    const topCount = preview.topCount ?? 15
    const activeForExport = preview.entries
      .filter((e) => !e.isDisqualified)
      .slice(0, topCount)
    setDailyRankExportText(
      buildDailyRankDiscordExportText({
        campaignName: preview.campaignName,
        dateUtc: preview.date,
        sortedByEngagement: preview.sortedByEngagement,
        entries: activeForExport.map((e, idx) => ({
          position: idx + 1,
          clipperName: e.clipperName,
          username: e.username,
          platform: e.platform,
          views: e.views,
          likes: e.likes,
          comments: e.comments,
          shares: e.shares,
          saves: e.saves,
          prize: e.prize,
          submittedUrl: e.submittedUrl,
          er: e.er,
          score: e.score,
        })),
        stats: preview.stats,
      }),
    )
    setDailyRankExportModalOpen(true)
  }

  const copyDailyRankExportText = () => {
    if (!dailyRankExportText) {
      toast.error("Nada para copiar")
      return
    }
    navigator.clipboard
      .writeText(dailyRankExportText)
      .then(() => {
        toast.success("Texto copiado", {
          description:
            "Cole no Discord ou em um arquivo .md com Ctrl+V (Cmd+V no Mac).",
        })
      })
      .catch(() => {
        toast.error("Não foi possível copiar")
      })
  }

  const downloadDailyRankMd = () => {
    if (!dailyRankExportText) {
      toast.error("Nenhum texto para baixar")
      return
    }
    const slugSafe = slugifyCampaignName(preview?.campaignName)
    const datePart = preview?.date ?? "data"
    const fileName = `ranking_diario_${slugSafe}_${datePart}.md`
    downloadTextFile(fileName, dailyRankExportText, "text/markdown")
    toast.success("Arquivo .md baixado", { description: fileName })
  }

  const openTopPostersPreviewExport = () => {
    if (!topPostersPreviewData || topPostersPreviewData.entries.length === 0) {
      toast.error("Nenhum dado no top postadores para gerar markdown")
      return
    }
    const dateLabel = format(parseISO(topPostersPreviewData.date), "dd/MM/yyyy")
    const lines: string[] = []
    lines.push(
      `🏆 **TOP POSTADORES DO DIA — ${topPostersPreviewData.campaignName}**`,
    )
    lines.push(`📅 **${dateLabel}**`)
    lines.push("")

    topPostersPreviewData.entries.forEach((entry) => {
      const prize = formatCurrencyPlain(entry.prize)
      lines.push(`${entry.position}º **${entry.clipperName} — ${prize}**`)
      lines.push(
        `🎯 ${entry.totalPosts} posts • 👀 ${entry.totalViews.toLocaleString("pt-BR")} views`,
      )
      lines.push("")
    })

    lines.push(
      `📊 **Total de posts na janela:** ${topPostersPreviewData.stats.totalPostsInWindow.toLocaleString("pt-BR")}`,
    )
    lines.push(
      `👀 **Total de views na janela:** ${topPostersPreviewData.stats.totalViewsInWindow.toLocaleString("pt-BR")}`,
    )

    setTopPostersExportText(lines.join("\n"))
    setTopPostersExportModalOpen(true)
  }

  const copyTopPostersExportText = () => {
    if (!topPostersExportText) {
      toast.error("Nada para copiar")
      return
    }
    navigator.clipboard
      .writeText(topPostersExportText)
      .then(() => {
        toast.success("Texto copiado", {
          description: "Cole no Discord ou em um arquivo .md.",
        })
      })
      .catch(() => {
        toast.error("Não foi possível copiar")
      })
  }

  const downloadTopPostersMd = () => {
    if (!topPostersExportText) {
      toast.error("Nenhum texto para baixar")
      return
    }
    const slugSafe = slugifyCampaignName(topPostersPreviewData?.campaignName)
    const datePart = topPostersPreviewData?.date ?? "data"
    const fileName = `top_postadores_dia_${slugSafe}_${datePart}.md`
    downloadTextFile(fileName, topPostersExportText, "text/markdown")
    toast.success("Arquivo .md baixado", { description: fileName })
  }

  const downloadCsv = () => {
    if (!preview || preview.entries.length === 0) {
      toast.error("Nenhum dado no rank para gerar o CSV")
      return
    }
    const topCount = preview.topCount ?? 15
    const activeForExport = preview.entries
      .filter((e) => !e.isDisqualified)
      .slice(0, topCount)

    const rows = activeForExport.map((e, idx) => {
      const pos = idx + 1
      const clipadorLabel = `${pos}º — ${formatCurrencyPlain(e.prize)} — ${e.fullName || e.clipperName}`
      const pix = e.pixKey || "—"
      return `${escapeCsvCell(clipadorLabel)},${escapeCsvCell(pix)}`
    })

    rows.reverse()

    const csvContent = "CLIPADOR,CHAVE PIX\n" + rows.join("\n") + "\n"
    const campaignSlug = slugifyCampaignName(preview.campaignName)
    const ddmmyyyy = format(parseISO(preview.date), "ddMMyyyy")
    const fileName = `${campaignSlug}_${ddmmyyyy}.csv`

    downloadTextFile(fileName, csvContent, "text/csv", true)
    toast.success("CSV baixado com sucesso", { description: fileName })
  }

  /* ===== Handlers de pagamento ===== */

  const startPayRankSimulation = () => {
    if (!preview?.campaignId || !preview.date) {
      toast.error("Gere o rank diário antes de pagar")
      return
    }
    payDailyRankByDate.mutate({
      campaignId: preview.campaignId,
      date: preview.date,
      dryRun: true,
    })
  }

  const confirmPayRankExecution = () => {
    if (!preview?.campaignId || !preview.date) return
    payDailyRankByDate.mutate({
      campaignId: preview.campaignId,
      date: preview.date,
      dryRun: false,
    })
  }

  const confirmUndoRankExecution = () => {
    if (!preview?.campaignId || !preview.date) return
    undoDailyRankPayments.mutate({
      campaignId: preview.campaignId,
      date: preview.date,
      dryRun: false,
    })
  }

  /* ===== Handlers do Top Postadores ===== */

  /** Abre o preview do Top Postadores do dia (zera exclusões anteriores). */
  const openTopPostersPreview = () => {
    if (!campaignId || !preview?.date) {
      toast.error("Gere o rank diário antes de abrir o Top Postadores")
      return
    }
    setTopPostersExcludedApplicationIds([])
    previewTopPostersDailyRankByDate.mutate({
      campaignId,
      date: preview.date,
      excludedApplicationIds: [],
    })
  }

  const startTopPostersPaySimulation = () => {
    if (!topPostersPreviewData?.campaignId || !topPostersPreviewData.date) {
      toast.error("Gere o Top Postadores antes de pagar")
      return
    }
    payTopPostersDailyRankByDate.mutate({
      campaignId: topPostersPreviewData.campaignId,
      date: topPostersPreviewData.date,
      dryRun: true,
      excludedApplicationIds: topPostersExcludedApplicationIds,
    })
  }

  const confirmTopPostersPayExecution = () => {
    if (!topPostersPreviewData?.campaignId || !topPostersPreviewData.date) return
    payTopPostersDailyRankByDate.mutate({
      campaignId: topPostersPreviewData.campaignId,
      date: topPostersPreviewData.date,
      dryRun: false,
      excludedApplicationIds: topPostersExcludedApplicationIds,
    })
  }

  /** Remove um clipador do rateio e recalcula o Top Postadores. */
  const removeFromTopPosters = (applicationId: string, clipperName: string) => {
    if (!topPostersPreviewData) return
    const excludedApplicationIds = [
      ...topPostersExcludedApplicationIds,
      applicationId,
    ]
    setTopPostersExcludedApplicationIds(excludedApplicationIds)
    previewTopPostersDailyRankByDate.mutate({
      campaignId: topPostersPreviewData.campaignId,
      date: topPostersPreviewData.date,
      excludedApplicationIds,
    })
    toast.success(`${clipperName} removido do Top Postadores`)
  }

  /* ===== Renderização de uma linha do rank ===== */

  const renderEntry = (
    entry: DailyRankPreviewEntry,
    computedPosition: number | null,
    computedPrize: number,
  ) => {
    const platformInfo = entry.platform
      ? platformConfig[entry.platform as PlatformKey]
      : undefined
    const PlatformIcon = platformInfo?.icon
    const isDisqualified = entry.isDisqualified
    const pos = computedPosition
    const isTop3 = pos !== null && pos <= 3
    const medalColors = [
      "from-amber-500/15 to-yellow-500/10 border-amber-500/30",
      "from-zinc-400/15 to-zinc-500/10 border-zinc-400/30",
      "from-orange-500/15 to-amber-700/10 border-orange-500/30",
    ]

    return (
      <div
        key={entry.dailyRankingEntryId}
        className={cn(
          "group relative rounded-2xl border p-2.5 transition-all duration-300 sm:p-3.5",
          isDisqualified
            ? "border-rose-500/20 bg-rose-500/5 opacity-50 hover:opacity-70"
            : isTop3
              ? cn("bg-gradient-to-r", medalColors[(pos ?? 1) - 1])
              : "border-border/50 bg-muted/10 hover:bg-muted/20",
        )}
      >
        {isDisqualified && (
          <div className="absolute inset-x-0 top-0 flex items-center justify-center">
            <div className="inline-flex items-center gap-1.5 rounded-b-lg bg-gradient-to-r from-rose-600/90 to-red-600/90 px-3 py-0.5 text-[10px] font-bold text-white shadow-lg sm:text-xs">
              <XCircle className="size-3" weight="fill" />
              DESCLASSIFICADO
            </div>
          </div>
        )}
        <div
          className={cn(
            "flex items-start gap-2.5 sm:gap-3",
            isDisqualified && "mt-3",
          )}
        >
          {/* Posição */}
          {isDisqualified ? (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/15 text-rose-500 sm:size-9">
              <X className="size-3.5" weight="bold" />
            </span>
          ) : (
            <PositionBadge position={pos ?? 0} />
          )}

          {/* Thumbnail */}
          <div
            className={cn(
              "relative h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-muted/50 ring-1 ring-border/40 sm:h-20 sm:w-14",
              isDisqualified && "grayscale",
            )}
          >
            {entry.thumbnailUrl ? (
              <Image
                src={entry.thumbnailUrl}
                alt={`Post por @${entry.username ?? ""}`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 44px, 56px"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <VideoCamera className="text-muted-foreground/50 size-4 sm:size-5" />
              </div>
            )}
            {PlatformIcon && platformInfo && (
              <div className="absolute right-0.5 bottom-0.5">
                <div className="flex size-4 items-center justify-center rounded-md bg-black/70 ring-1 ring-white/10 backdrop-blur-sm sm:size-[18px]">
                  <PlatformIcon
                    className={cn("size-2.5 sm:size-3", platformInfo.color)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p
                  className={cn(
                    "truncate text-sm leading-tight font-semibold sm:text-[15px]",
                    isDisqualified && "text-muted-foreground line-through",
                  )}
                >
                  {entry.clipperName}
                </p>
                <p className="text-muted-foreground truncate text-[11px] sm:text-xs">
                  @{entry.username?.replace(/^@/, "") || "N/A"}
                </p>
                {entry.pixKey && (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-indigo-500/80 sm:text-[11px] dark:text-indigo-400/70">
                    <Wallet className="size-2.5 shrink-0" weight="fill" />
                    <span className="truncate">{entry.pixKey}</span>
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {!isDisqualified && computedPrize > 0 && (
                  <Badge className="border border-emerald-500/40 bg-gradient-to-r from-emerald-500/20 to-green-500/20 px-1.5 py-0.5 text-[10px] text-emerald-600 sm:px-2 sm:text-xs dark:text-emerald-300">
                    <CurrencyDollar className="mr-0.5 size-3" weight="bold" />
                    {formatCurrency(computedPrize)}
                  </Badge>
                )}
                {!isDisqualified && entry.dailyPrizeStatus === "PAID" && (
                  <div
                    className="flex size-5 items-center justify-center rounded-full bg-emerald-500/20 sm:size-[22px]"
                    title="Pago"
                  >
                    <CheckCircle
                      className="size-3 text-emerald-500 sm:size-3.5 dark:text-emerald-400"
                      weight="fill"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Métricas */}
            <div className="flex flex-wrap gap-1 sm:gap-1.5">
              <MetricChip tone="blue" muted={isDisqualified} icon={<Eye className="size-2.5" />}>
                {formatMetricFull(entry.views)}
              </MetricChip>
              <MetricChip tone="rose" muted={isDisqualified} icon={<Heart className="size-2.5" />}>
                {formatMetricFull(entry.likes)}
              </MetricChip>
              <MetricChip tone="sky" muted={isDisqualified} icon={<ChatCircle className="size-2.5" />}>
                {formatMetricFull(entry.comments)}
              </MetricChip>
              <MetricChip tone="violet" muted={isDisqualified} icon={<ShareNetwork className="size-2.5" />}>
                {formatMetricFull(entry.shares)}
              </MetricChip>
              <MetricChip tone="amber" muted={isDisqualified}>
                ER{" "}
                {Number(entry.er).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                %
              </MetricChip>
              {preview?.sortedByEngagement && (
                <MetricChip tone="pink" muted={isDisqualified} icon={<Sparkle className="size-2.5" weight="fill" />}>
                  {Math.round(entry.score).toLocaleString("pt-BR")}
                </MetricChip>
              )}
            </div>

            {/* URL + ações */}
            <div className="flex items-center justify-between gap-2">
              {entry.submittedUrl ? (
                <a
                  href={entry.submittedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary/70 hover:text-primary flex items-center gap-1 truncate text-[11px] transition-colors sm:text-xs"
                >
                  <ArrowSquareOut className="size-3 shrink-0" />
                  <span className="max-w-[140px] truncate sm:max-w-[250px]">
                    {entry.submittedUrl.replace(/^https?:\/\/(www\.)?/, "")}
                  </span>
                </a>
              ) : (
                <span />
              )}
              {isDisqualified ? (
                <Button
                  type="button"
                  size="sm"
                  className={cn(
                    "h-7 shrink-0 cursor-pointer gap-1.5 rounded-lg px-2.5 text-[10px] font-semibold sm:h-8 sm:px-3 sm:text-xs",
                    "border border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
                    "hover:border-emerald-400 hover:bg-emerald-500/25",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                  disabled={undoDisqualifyEntry.isPending}
                  onClick={() => {
                    undoDisqualifyEntry.mutate({
                      dailyRankingEntryId: entry.dailyRankingEntryId,
                    })
                  }}
                >
                  {undoDisqualifyEntry.isPending ? (
                    <Spinner className="size-3 animate-spin sm:size-3.5" />
                  ) : (
                    <ArrowCounterClockwise className="size-3 sm:size-3.5" />
                  )}
                  Reverter
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className={cn(
                    "h-7 shrink-0 cursor-pointer gap-1.5 rounded-lg px-2.5 text-[10px] font-semibold sm:h-8 sm:px-3 sm:text-xs",
                    "border border-rose-500/40 bg-rose-500/15 text-rose-600 dark:text-rose-300",
                    "hover:border-rose-400 hover:bg-rose-500/25",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                  disabled={disqualifyDailyRankingEntry.isPending}
                  onClick={() => {
                    setDisqualifyInput("")
                    setDisqualifyConfirm({
                      dailyRankingEntryId: entry.dailyRankingEntryId,
                      clipPostId: entry.clipPostId,
                      clipperName: entry.clipperName,
                      submittedUrl: entry.submittedUrl,
                    })
                  }}
                >
                  <XCircle className="size-3 sm:size-3.5" />
                  Desclassificar
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const topCount = preview?.topCount ?? 15
  const activeEntries = (preview?.entries ?? []).filter(
    (e) => !e.isDisqualified,
  )
  const disqualifiedEntries = (preview?.entries ?? []).filter(
    (e) => e.isDisqualified,
  )
  const visibleActive = activeEntries.slice(0, topCount)

  return (
    <>
      {/* ============ MODAL RESULTADO ============ */}
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          onOpenChange(nextOpen)
        }}
      >
        <DialogContent className="flex max-h-[90vh] w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-4xl">
          {/* Header com gradiente âmbar */}
          <div className="relative shrink-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-rose-500/10" />
            <div className="absolute top-0 left-0 size-32 -translate-x-16 -translate-y-16 rounded-full bg-amber-500/10 blur-2xl" />
            <div className="absolute top-0 right-0 size-24 translate-x-12 -translate-y-12 rounded-full bg-orange-500/10 blur-2xl" />

            <div className="relative space-y-3 px-4 pt-5 pr-12 pb-4 sm:px-6 sm:pt-6 sm:pr-14">
              <DialogHeader className="space-y-2 text-left">
                <DialogTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
                  <span className="flex size-8 items-center justify-center rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/20 to-orange-500/20 sm:size-9">
                    <Trophy
                      className="size-4 text-amber-500 sm:size-5 dark:text-amber-400"
                      weight="fill"
                    />
                  </span>
                  <span className="bg-gradient-to-r from-amber-600 via-orange-500 to-amber-500 bg-clip-text font-bold text-transparent dark:from-amber-200 dark:via-orange-200 dark:to-amber-100">
                    Rank Diário
                  </span>
                  <span className="text-muted-foreground hidden text-sm font-normal sm:inline">
                    —
                  </span>
                  <span className="text-foreground/80 hidden text-sm font-medium sm:inline">
                    {preview?.campaignName}
                  </span>
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-1.5 text-left">
                    <span className="text-foreground/70 block text-xs font-medium sm:hidden">
                      {preview?.campaignName}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {preview?.date && (
                        <Badge
                          variant="outline"
                          className="border-border/60 bg-muted/40 text-foreground/90 gap-1.5 rounded-full"
                        >
                          <CalendarBlank className="text-muted-foreground size-3" />
                          {formatLongDate(preview.date)}
                        </Badge>
                      )}
                      {preview?.sortedByEngagement ? (
                        <Badge
                          variant="outline"
                          className="gap-1 rounded-full border-pink-500/30 bg-gradient-to-r from-pink-500/15 to-purple-500/15 text-pink-600 dark:text-pink-300"
                        >
                          <Pulse className="size-3" weight="bold" />
                          Score
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1 rounded-full border-blue-500/30 bg-gradient-to-r from-blue-500/15 to-cyan-500/15 text-blue-600 dark:text-blue-300"
                        >
                          <Eye className="size-3" weight="fill" />
                          Views
                        </Badge>
                      )}
                    </div>
                    {preview && (
                      <span className="text-muted-foreground/70 flex items-center gap-1.5 text-[10px] sm:text-[11px]">
                        <Clock className="size-3 shrink-0" />
                        {formatIsoInstantBrasil(preview.windowStart)} →{" "}
                        {formatIsoInstantBrasil(preview.windowEnd)}
                      </span>
                    )}
                  </div>
                </DialogDescription>
              </DialogHeader>

              {/* Stats */}
              {preview && preview.entries.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="border-border/60 bg-muted/20 rounded-xl border px-2.5 py-2 text-center sm:px-3">
                    <p className="text-foreground text-sm font-bold sm:text-base">
                      {formatMetricFull(preview.stats.totalPosts)}
                    </p>
                    <p className="text-muted-foreground text-[9px] tracking-wider uppercase sm:text-[10px]">
                      Posts
                    </p>
                  </div>
                  <div className="border-border/60 bg-muted/20 rounded-xl border px-2.5 py-2 text-center sm:px-3">
                    <p className="text-foreground text-sm font-bold sm:text-base">
                      {formatMetricFull(preview.stats.totalCompetitionViews)}
                    </p>
                    <p className="text-muted-foreground text-[9px] tracking-wider uppercase sm:text-[10px]">
                      Views Totais
                    </p>
                  </div>
                  <div className="border-border/60 bg-muted/20 rounded-xl border px-2.5 py-2 text-center sm:px-3">
                    <p className="text-sm font-bold text-emerald-500 sm:text-base dark:text-emerald-400">
                      +{formatMetricFull(preview.stats.viewsIncreaseToday)}
                    </p>
                    <p className="text-muted-foreground text-[9px] tracking-wider uppercase sm:text-[10px]">
                      Δ Views
                    </p>
                  </div>
                </div>
              )}

              {/* Botões de ação */}
              {preview && (
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {data.campaign.topClippersRankingEnabled && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={openTopPostersPreview}
                      className={cn(
                        "h-9 w-full cursor-pointer gap-2 rounded-xl font-semibold sm:w-auto",
                        "border border-orange-500/40 bg-orange-500/15 text-orange-600 dark:text-orange-300",
                        "hover:border-orange-400 hover:bg-orange-500/25",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                      )}
                      disabled={previewTopPostersDailyRankByDate.isPending}
                    >
                      {previewTopPostersDailyRankByDate.isPending ? (
                        <Spinner className="size-3.5 shrink-0 animate-spin" />
                      ) : (
                        <Trophy className="size-3.5 shrink-0" weight="fill" />
                      )}
                      Top Postadores do Dia
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    onClick={openDailyRankPreviewExport}
                    className={cn(
                      "h-9 w-full cursor-pointer gap-2 rounded-xl font-semibold sm:w-auto",
                      "border border-teal-500/40 bg-teal-500/15 text-teal-600 dark:text-teal-300",
                      "hover:border-teal-400 hover:bg-teal-500/25",
                    )}
                  >
                    <FileText className="size-3.5 shrink-0" />
                    Exportar Discord
                  </Button>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="w-full sm:w-auto">
                          <Button
                            type="button"
                            size="sm"
                            onClick={startPayRankSimulation}
                            disabled={
                              !markAnnouncedOnPay ||
                              preview.canUndoRankPayments ||
                              payDailyRankByDate.isPending
                            }
                            className={cn(
                              "h-9 w-full cursor-pointer gap-2 rounded-xl font-semibold",
                              preview.canUndoRankPayments
                                ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-600 disabled:opacity-60 dark:text-emerald-300"
                                : cn(
                                    "border border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-300",
                                    "hover:border-amber-400 hover:bg-amber-500/25",
                                    "disabled:cursor-not-allowed disabled:opacity-40",
                                  ),
                            )}
                          >
                            {payDailyRankByDate.isPending ? (
                              <Spinner className="size-3.5 shrink-0 animate-spin" />
                            ) : preview.canUndoRankPayments ? (
                              <CheckCircle
                                className="size-3.5 shrink-0"
                                weight="fill"
                              />
                            ) : (
                              <Coins className="size-3.5 shrink-0" weight="fill" />
                            )}
                            {preview.canUndoRankPayments
                              ? "Ranking pago"
                              : "Pagar rank"}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {preview.canUndoRankPayments ? (
                        <TooltipContent
                          side="bottom"
                          className="max-w-[220px] text-center"
                        >
                          <p className="text-xs">
                            O ranking deste dia já foi <strong>pago</strong>
                          </p>
                        </TooltipContent>
                      ) : !markAnnouncedOnPay ? (
                        <TooltipContent
                          side="bottom"
                          className="max-w-[220px] text-center"
                        >
                          <p className="text-xs">
                            O ranking precisa ser marcado como{" "}
                            <strong>divulgado</strong> antes de realizar o
                            pagamento
                          </p>
                        </TooltipContent>
                      ) : null}
                    </Tooltip>
                  </TooltipProvider>
                  {data.campaign.dailyPix && (
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="w-full sm:w-auto">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                if (!campaignId || !preview?.date) return
                                previewDailyPixPayout.mutate({
                                  campaignId,
                                  date: preview.date,
                                })
                              }}
                              disabled={
                                !markAnnouncedOnPay ||
                                previewDailyPixPayout.isPending ||
                                preview?.dailyPixPayoutCompleted === true
                              }
                              className={cn(
                                "h-9 w-full cursor-pointer gap-2 rounded-xl font-semibold",
                                "border border-emerald-500/45 bg-emerald-600/20 text-emerald-600 dark:text-emerald-200",
                                "hover:border-emerald-400 hover:bg-emerald-600/30",
                                "disabled:cursor-not-allowed disabled:opacity-40",
                              )}
                            >
                              {previewDailyPixPayout.isPending ? (
                                <Spinner className="size-3.5 shrink-0 animate-spin" />
                              ) : (
                                <Money className="size-3.5 shrink-0" weight="fill" />
                              )}
                              Prévia PIX
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {preview?.dailyPixPayoutCompleted ? (
                          <TooltipContent
                            side="bottom"
                            className="max-w-[240px] text-center"
                          >
                            <p className="text-xs">
                              O pagamento PIX deste dia já foi concluído.
                            </p>
                          </TooltipContent>
                        ) : !markAnnouncedOnPay ? (
                          <TooltipContent
                            side="bottom"
                            className="max-w-[240px] text-center"
                          >
                            <p className="text-xs">
                              Marque o dia como <strong>divulgado</strong>{" "}
                              antes. Depois: <strong>Pagar rank</strong>{" "}
                              (carteira) e então confirme o PIX.
                            </p>
                          </TooltipContent>
                        ) : (
                          <TooltipContent
                            side="bottom"
                            className="max-w-[260px] text-center"
                          >
                            <p className="text-xs">
                              Ordem sugerida: divulgado →{" "}
                              <strong>Pagar rank</strong> → abrir esta prévia →{" "}
                              <strong>Confirmar PIX</strong> (após o rank pago
                              na carteira).
                            </p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {preview.canUndoRankPayments && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        if (!preview?.campaignId || !preview.date) return
                        undoDailyRankPayments.mutate({
                          campaignId: preview.campaignId,
                          date: preview.date,
                          dryRun: true,
                        })
                      }}
                      disabled={undoDailyRankPayments.isPending}
                      className={cn(
                        "h-9 w-full cursor-pointer gap-2 rounded-xl font-semibold sm:w-auto",
                        "border border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300",
                        "hover:border-rose-400 hover:bg-rose-500/20",
                        "disabled:opacity-60",
                      )}
                    >
                      {undoDailyRankPayments.isPending ? (
                        <Spinner className="size-3.5 shrink-0 animate-spin" />
                      ) : (
                        <ArrowCounterClockwise className="size-3.5 shrink-0" />
                      )}
                      Desfazer pagamentos
                    </Button>
                  )}
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="w-full sm:w-auto">
                          <Button
                            type="button"
                            size="sm"
                            onClick={downloadCsv}
                            disabled={!preview.canUndoRankPayments}
                            className={cn(
                              "h-9 w-full cursor-pointer gap-2 rounded-xl font-semibold",
                              "border border-indigo-500/40 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300",
                              "hover:border-indigo-400 hover:bg-indigo-500/25",
                              "disabled:cursor-not-allowed disabled:opacity-40",
                            )}
                          >
                            <FileCsv className="size-3.5 shrink-0" />
                            Exportar CSV
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {!preview.canUndoRankPayments && (
                        <TooltipContent
                          side="bottom"
                          className="max-w-[220px] text-center"
                        >
                          <p className="text-xs">
                            O ranking precisa estar <strong>pago</strong> antes
                            de exportar o CSV
                          </p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                  {preview.canUndoRankPayments && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setPaymentTransactionsOpen(true)}
                      className={cn(
                        "h-9 w-full cursor-pointer gap-2 rounded-xl font-semibold sm:w-auto",
                        "border border-sky-500/40 bg-sky-500/15 text-sky-600 dark:text-sky-300",
                        "hover:border-sky-400 hover:bg-sky-500/25",
                      )}
                    >
                      <Receipt className="size-3.5 shrink-0" weight="fill" />
                      Ver transações
                    </Button>
                  )}
                </div>
              )}

              {/* Aviso sobre ordem dos estornos com PIX ativo */}
              {preview && data.campaign.dailyPix && (
                <p className="flex items-start gap-1.5 px-0.5 text-[10px] text-amber-600 dark:text-amber-200/80">
                  <Warning className="mt-0.5 size-3 shrink-0" weight="fill" />
                  <span>
                    Com PIX ativo: estornar o rank na carteira pode falhar se o
                    débito PIX já foi registrado — trate estornos na ordem
                    inversa quando possível.
                  </span>
                </p>
              )}

              {/* Toggle Divulgado */}
              {preview && preview.date && (
                <button
                  onClick={() => {
                    if (!campaignId || !preview.date) return
                    toggleAnnounced.mutate(
                      {
                        dailyRankingDate: preview.date,
                        campaignId,
                        announced: !markAnnouncedOnPay,
                      },
                      {
                        onSuccess: (res) => onMarkAnnouncedChange(res.announced),
                      },
                    )
                  }}
                  disabled={toggleAnnounced.isPending}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 transition-all",
                    markAnnouncedOnPay
                      ? "border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/15"
                      : "border-border/60 bg-muted/20 hover:bg-muted/40",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md transition-colors",
                      markAnnouncedOnPay
                        ? "bg-indigo-500 text-white"
                        : "border-border/60 bg-muted/40 text-muted-foreground/40 border",
                    )}
                  >
                    {toggleAnnounced.isPending ? (
                      <Spinner className="size-3 animate-spin" />
                    ) : markAnnouncedOnPay ? (
                      <Check className="size-3" weight="bold" />
                    ) : (
                      <X className="size-3" weight="bold" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span
                      className={cn(
                        "text-xs font-medium sm:text-sm",
                        markAnnouncedOnPay
                          ? "text-indigo-600 dark:text-indigo-300"
                          : "text-muted-foreground/70",
                      )}
                    >
                      {markAnnouncedOnPay
                        ? "Ranking divulgado"
                        : "Ranking não divulgado"}
                    </span>
                  </span>
                  <Megaphone
                    className={cn(
                      "size-4 shrink-0 transition-colors",
                      markAnnouncedOnPay
                        ? "text-indigo-500 dark:text-indigo-400"
                        : "text-muted-foreground/30",
                    )}
                    weight="fill"
                  />
                </button>
              )}
            </div>
            <div className="via-border/60 h-px bg-gradient-to-r from-transparent to-transparent" />
          </div>

          {/* Corpo com scroll */}
          <div className="min-h-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-3 sm:px-5">
            {!preview || preview.entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <div className="bg-muted/30 flex size-16 items-center justify-center rounded-2xl">
                  <Lightning className="text-muted-foreground/40 size-8" weight="fill" />
                </div>
                <p className="text-muted-foreground text-sm">
                  Nenhuma entrada no período para esta data.
                </p>
              </div>
            ) : (
              <div className="space-y-2 pb-2">
                {visibleActive.map((entry, idx) =>
                  renderEntry(entry, idx + 1, entry.prize),
                )}

                {disqualifiedEntries.length > 0 && (
                  <>
                    <div className="flex items-center gap-3 pt-3 pb-1">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-rose-500/30 to-transparent" />
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-rose-500/80 uppercase sm:text-xs dark:text-rose-400/80">
                        <XCircle className="size-3" weight="fill" />
                        Desclassificados ({disqualifiedEntries.length})
                      </span>
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-rose-500/30 to-transparent" />
                    </div>
                    {disqualifiedEntries.map((entry) =>
                      renderEntry(entry, null, 0),
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Rodapé */}
          <div className="via-border/60 h-px shrink-0 bg-gradient-to-r from-transparent to-transparent" />
          <div className="flex shrink-0 items-center justify-end px-4 py-3 sm:px-6 sm:py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-9 cursor-pointer rounded-xl px-5"
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ MODAL TOP POSTADORES ============ */}
      <Dialog
        open={topPostersModalOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && payTopPostersDailyRankByDate.isPending) return
          setTopPostersModalOpen(nextOpen)
          if (!nextOpen) {
            setTopPostersPreviewData(null)
            setTopPostersExportModalOpen(false)
            setTopPostersExportText("")
            setTopPostersExcludedApplicationIds([])
            setTopPostersPayDialogOpen(false)
            setTopPostersPayPlan(null)
            setTopPostersPayInput("")
          }
        }}
      >
        <DialogContent className="flex max-h-[90vh] w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-3xl">
          <div className="relative shrink-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-yellow-500/10" />
            <div className="relative space-y-3 px-4 pt-5 pr-12 pb-4 sm:px-6 sm:pt-6 sm:pr-14">
              <DialogHeader className="space-y-2 text-left">
                <DialogTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
                  <span className="flex size-8 items-center justify-center rounded-xl border border-orange-500/30 bg-gradient-to-br from-orange-500/20 to-amber-500/20 sm:size-9">
                    <Trophy
                      className="size-4 text-orange-500 sm:size-5 dark:text-orange-300"
                      weight="fill"
                    />
                  </span>
                  <span className="bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-500 bg-clip-text font-bold text-transparent dark:from-orange-200 dark:via-amber-200 dark:to-yellow-100">
                    Top Postadores do Dia
                  </span>
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-1.5 text-left">
                    <span className="text-foreground/70 block text-xs font-medium">
                      {topPostersPreviewData?.campaignName}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {topPostersPreviewData?.date && (
                        <Badge
                          variant="outline"
                          className="border-border/60 bg-muted/40 text-foreground/90 gap-1.5 rounded-full"
                        >
                          <CalendarBlank className="text-muted-foreground size-3" />
                          {formatLongDate(topPostersPreviewData.date)}
                        </Badge>
                      )}
                    </div>
                    {topPostersPreviewData && (
                      <span className="text-muted-foreground/70 flex items-center gap-1.5 text-[10px] sm:text-[11px]">
                        <Clock className="size-3 shrink-0" />
                        {formatIsoInstantBrasil(
                          topPostersPreviewData.windowStart,
                        )}{" "}
                        →{" "}
                        {formatIsoInstantBrasil(topPostersPreviewData.windowEnd)}
                      </span>
                    )}
                  </div>
                </DialogDescription>
              </DialogHeader>

              {topPostersPreviewData && (
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="border-border/60 bg-muted/20 rounded-xl border px-2.5 py-2 text-center sm:px-3">
                    <p className="text-foreground text-sm font-bold sm:text-base">
                      {topPostersPreviewData.stats.totalPostsInWindow.toLocaleString(
                        "pt-BR",
                      )}
                    </p>
                    <p className="text-muted-foreground text-[9px] tracking-wider uppercase sm:text-[10px]">
                      Posts na janela
                    </p>
                  </div>
                  <div className="border-border/60 bg-muted/20 rounded-xl border px-2.5 py-2 text-center sm:px-3">
                    <p className="text-foreground text-sm font-bold sm:text-base">
                      {topPostersPreviewData.stats.totalViewsInWindow.toLocaleString(
                        "pt-BR",
                      )}
                    </p>
                    <p className="text-muted-foreground text-[9px] tracking-wider uppercase sm:text-[10px]">
                      Views na janela
                    </p>
                  </div>
                </div>
              )}

              {topPostersPreviewData && (
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    onClick={openTopPostersPreviewExport}
                    className={cn(
                      "h-9 w-full cursor-pointer gap-2 rounded-xl font-semibold sm:w-auto",
                      "border border-teal-500/40 bg-teal-500/15 text-teal-600 dark:text-teal-300",
                      "hover:border-teal-400 hover:bg-teal-500/25",
                    )}
                  >
                    <FileText className="size-3.5 shrink-0" />
                    Exportar Discord
                  </Button>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="w-full sm:w-auto">
                          <Button
                            type="button"
                            size="sm"
                            onClick={startTopPostersPaySimulation}
                            disabled={
                              !topPostersPreviewData.canPayTopPosters ||
                              payTopPostersDailyRankByDate.isPending ||
                              previewTopPostersDailyRankByDate.isPending
                            }
                            className={cn(
                              "h-9 w-full cursor-pointer gap-2 rounded-xl font-semibold",
                              !topPostersPreviewData.canPayTopPosters
                                ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-600 disabled:opacity-60 dark:text-emerald-300"
                                : cn(
                                    "border border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-300",
                                    "hover:border-amber-400 hover:bg-amber-500/25",
                                    "disabled:cursor-not-allowed disabled:opacity-40",
                                  ),
                            )}
                          >
                            {payTopPostersDailyRankByDate.isPending ? (
                              <Spinner className="size-3.5 shrink-0 animate-spin" />
                            ) : !topPostersPreviewData.canPayTopPosters ? (
                              <CheckCircle
                                className="size-3.5 shrink-0"
                                weight="fill"
                              />
                            ) : (
                              <Coins className="size-3.5 shrink-0" weight="fill" />
                            )}
                            {!topPostersPreviewData.canPayTopPosters
                              ? "Ranking pago"
                              : "Pagar Top"}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {!topPostersPreviewData.canPayTopPosters ? (
                        <TooltipContent
                          side="bottom"
                          className="max-w-[240px] text-center"
                        >
                          <p className="text-xs">
                            Todas as posições premiadas deste Top Postadores já
                            foram <strong>pagas</strong>.
                          </p>
                        </TooltipContent>
                      ) : (
                        <TooltipContent
                          side="bottom"
                          className="max-w-[260px] text-center"
                        >
                          <p className="text-xs">
                            Credita o prêmio de cada posição na carteira. Remova
                            quem não deve entrar no rateio antes de pagar.
                          </p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}

              {topPostersExcludedApplicationIds.length > 0 && (
                <p className="flex items-start gap-1.5 px-0.5 text-[10px] text-amber-600 sm:text-[11px] dark:text-amber-200/80">
                  <Warning className="mt-0.5 size-3 shrink-0" weight="fill" />
                  <span>
                    {topPostersExcludedApplicationIds.length}{" "}
                    {topPostersExcludedApplicationIds.length === 1
                      ? "clipador removido"
                      : "clipadores removidos"}{" "}
                    deste Top Postadores. As posições foram recalculadas — feche
                    o modal para restaurar a lista completa.
                  </span>
                </p>
              )}
            </div>
            <div className="via-border/60 h-px bg-gradient-to-r from-transparent to-transparent" />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6">
            {!topPostersPreviewData ||
            topPostersPreviewData.entries.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Nenhum clipador no período selecionado.
              </p>
            ) : (
              <div className="space-y-2 pb-2">
                {topPostersPreviewData.entries.map((entry) => (
                  <div
                    key={`${entry.position}-${entry.applicationId}`}
                    className="border-border/50 bg-muted/10 rounded-2xl border p-3 sm:p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-foreground truncate text-sm font-bold">
                          {entry.position}º — {entry.clipperName}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {entry.fullName}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        <Badge className="border-0 bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                          {formatCurrency(entry.prize)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full text-[10px]",
                            entry.prizeStatus === "PAID"
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                              : "border-border/60 bg-muted/30 text-muted-foreground",
                          )}
                        >
                          {entry.prizeStatus === "PAID" ? "Pago" : "Pendente"}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={
                            entry.prizeStatus === "PAID" ||
                            previewTopPostersDailyRankByDate.isPending ||
                            payTopPostersDailyRankByDate.isPending
                          }
                          onClick={() =>
                            removeFromTopPosters(
                              entry.applicationId,
                              entry.clipperName,
                            )
                          }
                          className="h-9 cursor-pointer gap-1 rounded-lg px-2.5 text-[10px] font-semibold text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-rose-300 dark:hover:text-rose-200"
                          aria-label={
                            entry.prizeStatus === "PAID"
                              ? `Não é possível remover ${entry.clipperName} após o pagamento`
                              : `Remover ${entry.clipperName} deste Top Postadores`
                          }
                          title={
                            entry.prizeStatus === "PAID"
                              ? "Não é possível remover após o pagamento"
                              : "Remover deste Top Postadores"
                          }
                        >
                          {previewTopPostersDailyRankByDate.isPending ? (
                            <Spinner className="size-3 animate-spin" />
                          ) : (
                            <UserMinus className="size-3" weight="bold" />
                          )}
                          Remover
                        </Button>
                      </div>
                    </div>
                    <div className="text-muted-foreground mt-2 flex flex-wrap gap-2 text-[11px]">
                      <span className="inline-flex items-center gap-1">
                        <VideoCamera className="size-3" />
                        {entry.totalPosts.toLocaleString("pt-BR")} posts
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Eye className="size-3" />
                        {entry.totalViews.toLocaleString("pt-BR")} views
                      </span>
                      {entry.pixKey ? (
                        <span className="inline-flex items-center gap-1">
                          <Wallet className="size-3" />
                          PIX: {entry.pixKey}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="via-border/60 h-px shrink-0 bg-gradient-to-r from-transparent to-transparent" />
          <div className="flex shrink-0 items-center justify-end px-4 py-3 sm:px-6 sm:py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTopPostersModalOpen(false)}
              className="h-9 cursor-pointer rounded-xl px-5"
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ ALERT: PAGAR TOP POSTADORES ============ */}
      <AlertDialog
        open={topPostersPayDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !payTopPostersDailyRankByDate.isPending) {
            setTopPostersPayDialogOpen(false)
            setTopPostersPayPlan(null)
            setTopPostersPayInput("")
          }
        }}
      >
        <AlertDialogContent className="flex max-h-[90vh] w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-lg">
          {/* Header */}
          <div className="relative shrink-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-yellow-500/10" />
            <div className="absolute top-0 left-0 size-24 -translate-x-12 -translate-y-12 rounded-full bg-orange-500/10 blur-2xl" />

            <div className="relative space-y-2 px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
              <AlertDialogHeader className="space-y-2 text-left">
                <AlertDialogTitle className="flex items-center gap-3 text-left text-base sm:text-lg">
                  <span className="flex size-9 items-center justify-center rounded-xl border border-orange-500/30 bg-gradient-to-br from-orange-500/20 to-amber-500/20 sm:size-10">
                    <Coins
                      className="size-4 text-orange-500 sm:size-5 dark:text-orange-300"
                      weight="fill"
                    />
                  </span>
                  <span className="bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-500 bg-clip-text font-bold text-transparent dark:from-orange-200 dark:via-amber-200 dark:to-yellow-100">
                    Pagar Top Postadores
                  </span>
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="text-muted-foreground space-y-1.5 text-left text-sm">
                    {topPostersPayPlan ? (
                      <>
                        <p>
                          <strong className="text-foreground">
                            {topPostersPayPlan.campaignName}
                          </strong>
                          {topPostersPayPlan.date && (
                            <Badge
                              variant="outline"
                              className="border-border/60 bg-muted/40 text-foreground/80 ml-2 gap-1 rounded-full text-[10px]"
                            >
                              <CalendarBlank className="size-2.5" />
                              {format(
                                parseISO(topPostersPayPlan.date),
                                "dd/MM/yyyy",
                                { locale: ptBR },
                              )}
                            </Badge>
                          )}
                        </p>
                        <p className="text-muted-foreground/70 text-xs">
                          Prêmios por quantidade de vídeos postados na janela do
                          dia.
                        </p>
                      </>
                    ) : (
                      <p className="flex items-center gap-2">
                        <Spinner className="size-3 animate-spin" /> Carregando
                        resumo…
                      </p>
                    )}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>
          </div>

          <div className="via-border/60 h-px shrink-0 bg-gradient-to-r from-transparent to-transparent" />

          {/* Plano (scroll) */}
          {topPostersPayPlan && (
            <div className="max-h-[min(40vh,300px)] space-y-3 overflow-y-auto overscroll-contain px-5 py-4 text-sm sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-orange-500/25 bg-gradient-to-r from-orange-500/10 to-amber-500/10 px-3 py-3 sm:px-4">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-[10px] tracking-wider uppercase sm:text-xs">
                    Total a creditar
                  </p>
                  <p className="text-lg font-bold text-orange-600 sm:text-xl dark:text-orange-300">
                    {formatCurrency(topPostersPayPlan.totalAmount)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-xs">
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      {topPostersPayPlan.payableCount}
                    </span>{" "}
                    pagamento(s)
                  </p>
                  {topPostersPayPlan.skippedCount > 0 && (
                    <p className="text-muted-foreground text-xs">
                      <span className="text-muted-foreground/60">
                        {topPostersPayPlan.skippedCount}
                      </span>{" "}
                      ignorado(s)
                    </p>
                  )}
                </div>
              </div>

              {topPostersPayPlan.payable.length > 0 && (
                <div className="space-y-2">
                  <p className="text-foreground/80 text-xs font-semibold tracking-wider uppercase">
                    Créditos a processar
                  </p>
                  <div className="border-border/50 bg-muted/10 max-h-36 space-y-1 overflow-y-auto rounded-xl border p-2">
                    {topPostersPayPlan.payable.map((p) => (
                      <div
                        key={`tppay-${p.position}-${p.clipperName}`}
                        className="hover:bg-muted/30 flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors"
                      >
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="text-foreground/80 shrink-0 font-mono text-xs font-bold">
                            {p.position}º
                          </span>
                          <div className="min-w-0">
                            <p className="text-foreground/90 truncate text-xs font-medium">
                              {p.clipperName}
                            </p>
                            <p className="text-muted-foreground/50 truncate text-[10px]">
                              {formatMetricFull(p.totalPosts)} posts ·{" "}
                              {formatMetricFull(p.totalViews)} views
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(p.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {topPostersPayPlan.skipped.length > 0 && (
                <div className="space-y-2">
                  <p className="text-muted-foreground/60 text-xs font-semibold tracking-wider uppercase">
                    Ignorados
                  </p>
                  <div className="border-border/50 bg-muted/10 max-h-28 space-y-1 overflow-y-auto rounded-xl border p-2">
                    {topPostersPayPlan.skipped.map((s) => (
                      <div
                        key={`tpskip-${s.position}-${s.reason}`}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5"
                      >
                        <span className="text-muted-foreground/60 min-w-0 truncate text-xs">
                          {s.position}º {s.clipperName}
                        </span>
                        <span className="text-muted-foreground/40 shrink-0 text-[10px]">
                          {s.reason}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="via-border/60 h-px shrink-0 bg-gradient-to-r from-transparent to-transparent" />

          {/* Confirmação por palavra */}
          <div className="shrink-0 space-y-4 px-5 py-4 sm:px-6">
            <ConfirmWordInput
              word="PAGAR"
              value={topPostersPayInput}
              onChange={setTopPostersPayInput}
              id="confirm-pagar-top-postadores"
            />
          </div>

          <div className="via-border/60 h-px shrink-0 bg-gradient-to-r from-transparent to-transparent" />

          {/* Footer */}
          <div className="flex shrink-0 flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <AlertDialogCancel
              disabled={payTopPostersDailyRankByDate.isPending}
              className="h-10 cursor-pointer rounded-xl"
              onClick={() => setTopPostersPayInput("")}
            >
              Cancelar
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={
                topPostersPayInput !== "PAGAR" ||
                payTopPostersDailyRankByDate.isPending ||
                !topPostersPayPlan ||
                topPostersPayPlan.payableCount === 0
              }
              onClick={confirmTopPostersPayExecution}
              className={cn(
                "h-10 cursor-pointer gap-2 rounded-xl font-semibold",
                "bg-orange-600 text-white hover:bg-orange-500",
                "disabled:cursor-not-allowed disabled:opacity-40",
              )}
            >
              {payTopPostersDailyRankByDate.isPending ? (
                <>
                  <Spinner className="size-4 animate-spin" />
                  Processando…
                </>
              ) : (
                <>
                  <Coins className="size-4" weight="fill" />
                  Confirmar pagamento
                </>
              )}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ============ MODAL EXPORT TOP POSTADORES ============ */}
      <Dialog
        open={topPostersExportModalOpen}
        onOpenChange={(nextOpen) => {
          setTopPostersExportModalOpen(nextOpen)
          if (!nextOpen) setTopPostersExportText("")
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-2xl">
          <DialogHeader className="border-border/50 shrink-0 space-y-1 border-b px-6 py-4 text-left">
            <DialogTitle className="flex items-center gap-2 text-left">
              <FileText className="text-muted-foreground size-5" />
              Top Postadores para o Discord
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
            <Textarea
              readOnly
              value={topPostersExportText || "—"}
              className="border-border/60 bg-muted/30 min-h-[280px] rounded-xl font-mono text-xs leading-relaxed"
            />
          </div>
          <DialogFooter className="border-border/50 shrink-0 gap-2 border-t px-6 py-4 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer rounded-xl"
              onClick={() => setTopPostersExportModalOpen(false)}
            >
              Voltar
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="cursor-pointer gap-2 rounded-xl"
              disabled={!topPostersExportText}
              onClick={downloadTopPostersMd}
            >
              <DownloadSimple className="size-4" />
              Baixar .md
            </Button>
            <Button
              type="button"
              className="btn-gradient-auth cursor-pointer gap-2 rounded-xl font-semibold"
              disabled={!topPostersExportText}
              onClick={copyTopPostersExportText}
            >
              <Copy className="size-4" />
              Copiar texto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ MODAL EXPORT DISCORD (RANK DIÁRIO) ============ */}
      <Dialog
        open={dailyRankExportModalOpen}
        onOpenChange={(nextOpen) => {
          setDailyRankExportModalOpen(nextOpen)
          if (!nextOpen) {
            setDailyRankExportText("")
          }
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-2xl">
          <DialogHeader className="border-border/50 shrink-0 space-y-1 border-b px-6 py-4 text-left">
            <DialogTitle className="flex items-center gap-2 text-left">
              <FileText className="text-muted-foreground size-5" />
              Rank para o Discord
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
            <Textarea
              readOnly
              value={dailyRankExportText || "—"}
              className="border-border/60 bg-muted/30 min-h-[280px] rounded-xl font-mono text-xs leading-relaxed"
            />
          </div>
          <DialogFooter className="border-border/50 shrink-0 gap-2 border-t px-6 py-4 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer rounded-xl"
              onClick={() => setDailyRankExportModalOpen(false)}
            >
              Voltar
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="cursor-pointer gap-2 rounded-xl"
              disabled={!dailyRankExportText}
              onClick={downloadDailyRankMd}
            >
              <DownloadSimple className="size-4" />
              Baixar .md
            </Button>
            <Button
              type="button"
              className="btn-gradient-auth cursor-pointer gap-2 rounded-xl font-semibold"
              disabled={!dailyRankExportText}
              onClick={copyDailyRankExportText}
            >
              <Copy className="size-4" />
              Copiar texto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ DIALOG TRANSAÇÕES DO PAGAMENTO ============ */}
      <Dialog
        open={paymentTransactionsOpen}
        onOpenChange={setPaymentTransactionsOpen}
      >
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-2xl">
          <DialogHeader className="border-border/50 relative shrink-0 space-y-1 overflow-hidden border-b px-6 py-4 text-left">
            <div className="absolute inset-0 bg-gradient-to-r from-sky-500/10 via-blue-500/8 to-cyan-500/8" />
            <DialogTitle className="relative flex items-center gap-2 text-left">
              <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 shadow-md shadow-sky-500/20">
                <Receipt className="size-4 text-white" weight="fill" />
              </span>
              <span>
                <span className="bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text font-bold text-transparent dark:from-sky-300 dark:to-blue-300">
                  Transações do Ranking
                </span>
                {preview?.date && (
                  <span className="text-muted-foreground mt-0.5 block text-xs font-normal">
                    {formatLongDate(preview.date)}
                  </span>
                )}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
            {isLoadingTransactions ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="border-border/40 flex items-center gap-3 rounded-xl border p-3"
                  >
                    <Bone
                      delay={index * 100}
                      className="size-8 shrink-0 rounded-lg"
                    />
                    <div className="flex flex-1 flex-col gap-1.5">
                      <Bone delay={index * 100 + 50} className="h-4 w-32" />
                      <Bone
                        delay={index * 100 + 100}
                        className="h-3 w-48 rounded-full"
                      />
                    </div>
                    <Bone
                      delay={index * 100 + 150}
                      className="h-5 w-16 rounded-full"
                    />
                  </div>
                ))}
              </div>
            ) : !paymentTransactions || paymentTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12">
                <div className="bg-muted/30 flex size-14 items-center justify-center rounded-2xl">
                  <Receipt className="text-muted-foreground/40 size-7" />
                </div>
                <p className="text-muted-foreground text-sm">
                  Nenhuma transação encontrada para este dia.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-col gap-1 px-1 pb-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-muted-foreground text-xs">
                    {paymentTransactions.length} transação(ões)
                  </p>
                  <div className="space-y-0.5 text-right text-[10px] sm:text-xs">
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                      Créditos rank:{" "}
                      {formatCurrency(
                        paymentTransactions
                          .filter(
                            (t) =>
                              (t.transactionType ?? "PRIZE_CREDIT") ===
                              "PRIZE_CREDIT",
                          )
                          .reduce((s, t) => s + t.amount, 0),
                      )}
                    </p>
                    <p className="font-semibold text-amber-600 dark:text-amber-400">
                      PIX (débito):{" "}
                      {formatCurrency(
                        paymentTransactions
                          .filter(
                            (t) => t.transactionType === "WITHDRAWAL_COMPLETED",
                          )
                          .reduce((s, t) => s + Math.abs(t.amount), 0),
                      )}
                    </p>
                  </div>
                </div>
                {paymentTransactions.map((tx) => {
                  const kind = tx.transactionType ?? "PRIZE_CREDIT"
                  const isPix = kind === "WITHDRAWAL_COMPLETED"
                  const displayAmount = isPix ? Math.abs(tx.amount) : tx.amount
                  return (
                    <div
                      key={tx.id}
                      className="group border-border/40 bg-muted/10 hover:bg-muted/20 flex items-center gap-3 rounded-xl border p-3 transition-all"
                    >
                      <PositionBadge position={tx.position ?? 0} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold">
                            {tx.clipperName}
                          </p>
                          {isPix && (
                            <Badge
                              variant="outline"
                              className="rounded-full border-amber-500/40 bg-amber-500/15 px-1.5 py-0 text-[9px] text-amber-600 dark:text-amber-300"
                            >
                              PIX
                            </Badge>
                          )}
                        </div>
                        {tx.fullName && tx.fullName !== tx.clipperName && (
                          <p className="text-muted-foreground truncate text-[11px]">
                            {tx.fullName}
                          </p>
                        )}
                        {tx.pixKey && (
                          <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-indigo-500/80 dark:text-indigo-400/70">
                            <Wallet className="size-2.5 shrink-0" weight="fill" />
                            {tx.pixKey}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <Badge
                          className={cn(
                            "px-2 py-0.5 text-xs",
                            isPix
                              ? "border border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-200"
                              : "border border-emerald-500/40 bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-600 dark:text-emerald-300",
                          )}
                        >
                          {isPix ? "−" : "+"}
                          {formatCurrency(displayAmount)}
                        </Badge>
                        <p className="text-muted-foreground mt-1 text-[10px]">
                          {format(parseISO(tx.processedAt), "dd/MM HH:mm", {
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <DialogFooter className="border-border/50 shrink-0 border-t px-6 py-4 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setPaymentTransactionsOpen(false)}
              className="cursor-pointer rounded-xl"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ MODAL PRÉVIA / CONFIRMAÇÃO PIX ============ */}
      <Dialog
        open={dailyPixPayoutModalOpen}
        onOpenChange={(nextOpen) => {
          setDailyPixPayoutModalOpen(nextOpen)
          if (!nextOpen) setDailyPixPreviewPayload(null)
        }}
      >
        <DialogContent className="flex max-h-[90vh] w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-4xl">
          {/* Header */}
          <div className="relative shrink-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-rose-500/10" />
            <div className="absolute top-0 left-0 size-32 -translate-x-16 -translate-y-16 rounded-full bg-amber-500/10 blur-2xl" />
            <div className="absolute top-0 right-0 size-24 translate-x-12 -translate-y-12 rounded-full bg-orange-500/10 blur-2xl" />

            <div className="relative space-y-3 px-4 pt-5 pr-12 pb-4 sm:px-6 sm:pt-6 sm:pr-14">
              <DialogHeader className="space-y-2 text-left">
                <DialogTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
                  <span className="flex size-8 items-center justify-center rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/20 to-orange-500/20 sm:size-9">
                    <Money
                      className="size-4 text-amber-500 sm:size-5 dark:text-amber-400"
                      weight="fill"
                    />
                  </span>
                  <span className="bg-gradient-to-r from-amber-600 via-orange-500 to-amber-500 bg-clip-text font-bold text-transparent dark:from-amber-200 dark:via-orange-200 dark:to-amber-100">
                    Prévia PIX
                  </span>
                  <span className="text-muted-foreground hidden text-sm font-normal sm:inline">
                    —
                  </span>
                  <span className="text-foreground/80 hidden text-sm font-medium sm:inline">
                    {typeof dailyPixPreviewPayload?.campaignName === "string"
                      ? dailyPixPreviewPayload.campaignName
                      : (preview?.campaignName ?? "Ranking diário")}
                  </span>
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-1.5 text-left">
                    <span className="text-foreground/70 block text-xs font-medium sm:hidden">
                      {typeof dailyPixPreviewPayload?.campaignName === "string"
                        ? dailyPixPreviewPayload.campaignName
                        : preview?.campaignName}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {preview?.date && (
                        <Badge
                          variant="outline"
                          className="border-border/60 bg-muted/40 text-foreground/90 gap-1.5 rounded-full"
                        >
                          <CalendarBlank className="text-muted-foreground size-3" />
                          {formatLongDate(preview.date)}
                        </Badge>
                      )}
                      {(
                        typeof dailyPixPreviewPayload?.sortedByEngagement ===
                        "boolean"
                          ? dailyPixPreviewPayload.sortedByEngagement
                          : preview?.sortedByEngagement
                      ) ? (
                        <Badge
                          variant="outline"
                          className="gap-1 rounded-full border-pink-500/30 bg-gradient-to-r from-pink-500/15 to-purple-500/15 text-pink-600 dark:text-pink-300"
                        >
                          <Pulse className="size-3" weight="bold" />
                          Score
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1 rounded-full border-blue-500/30 bg-gradient-to-r from-blue-500/15 to-cyan-500/15 text-blue-600 dark:text-blue-300"
                        >
                          <Eye className="size-3" weight="fill" />
                          Views
                        </Badge>
                      )}
                      {typeof dailyPixPreviewPayload?.topCount === "number" && (
                        <Badge
                          variant="outline"
                          className="border-border/60 bg-muted/40 text-foreground/85 gap-1 rounded-full"
                        >
                          <Trophy
                            className="size-3 text-amber-500/90 dark:text-amber-400/90"
                            weight="fill"
                          />
                          Top {dailyPixPreviewPayload.topCount}
                        </Badge>
                      )}
                      {dailyPixPreviewPayload &&
                        typeof dailyPixPreviewPayload.hasSufficientBalance ===
                          "boolean" && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "gap-1.5 rounded-full border",
                              dailyPixPreviewPayload.hasSufficientBalance
                                ? "border-emerald-500/35 bg-emerald-500/12 text-emerald-600 dark:text-emerald-200"
                                : "border-rose-500/35 bg-rose-500/12 text-rose-600 dark:text-rose-200",
                            )}
                          >
                            Saldo Asaas:{" "}
                            {dailyPixPreviewPayload.hasSufficientBalance
                              ? "suficiente"
                              : "insuficiente"}
                          </Badge>
                        )}
                      {dailyPixPreviewPayload &&
                        typeof dailyPixPreviewPayload.totalPrizeAmount ===
                          "number" && (
                          <Badge
                            variant="outline"
                            className="gap-1.5 rounded-full border-sky-500/35 bg-sky-500/10 text-sky-600 dark:text-sky-200"
                          >
                            Total prêmios:{" "}
                            {formatCurrency(
                              dailyPixPreviewPayload.totalPrizeAmount,
                            )}
                          </Badge>
                        )}
                    </div>
                    {(typeof dailyPixPreviewPayload?.startDate === "string" &&
                      typeof dailyPixPreviewPayload?.endDate === "string") ||
                    preview ? (
                      <span className="text-muted-foreground/70 flex items-center gap-1.5 text-[10px] sm:text-[11px]">
                        <Clock className="size-3 shrink-0" />
                        {typeof dailyPixPreviewPayload?.startDate === "string" &&
                        typeof dailyPixPreviewPayload?.endDate === "string"
                          ? `${formatIsoInstantBrasil(dailyPixPreviewPayload.startDate)} → ${formatIsoInstantBrasil(dailyPixPreviewPayload.endDate)}`
                          : preview
                            ? `${formatIsoInstantBrasil(preview.windowStart)} → ${formatIsoInstantBrasil(preview.windowEnd)}`
                            : null}
                      </span>
                    ) : null}
                    <p className="text-muted-foreground/90 pt-0.5 text-[11px] sm:text-xs">
                      Confira valores e chaves mascaradas.{" "}
                      <strong>Confirmar PIX</strong> só libera após{" "}
                      <strong>Pagar rank</strong> (carteira) neste dia.
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>

              {/* Stats PIX */}
              {dailyPixPreviewPayload && (
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="border-border/60 bg-muted/20 rounded-xl border px-2.5 py-2 text-center sm:px-3">
                    <p className="text-foreground text-sm font-bold sm:text-base">
                      {Array.isArray(dailyPixPreviewPayload.lines)
                        ? (dailyPixPreviewPayload.lines as unknown[]).length
                        : 0}
                    </p>
                    <p className="text-muted-foreground text-[9px] tracking-wider uppercase sm:text-[10px]">
                      Linhas PIX
                    </p>
                  </div>
                  <div className="border-border/60 bg-muted/20 rounded-xl border px-2.5 py-2 text-center sm:px-3">
                    <p className="text-sm font-bold text-emerald-500 sm:text-base dark:text-emerald-400">
                      {typeof dailyPixPreviewPayload.totalPrizeAmount ===
                      "number"
                        ? formatCurrency(
                            dailyPixPreviewPayload.totalPrizeAmount,
                          )
                        : "—"}
                    </p>
                    <p className="text-muted-foreground text-[9px] tracking-wider uppercase sm:text-[10px]">
                      Total prêmios
                    </p>
                  </div>
                  <div className="border-border/60 bg-muted/20 rounded-xl border px-2.5 py-2 text-center sm:px-3">
                    <p
                      className={cn(
                        "text-sm font-bold sm:text-base",
                        dailyPixPreviewPayload.hasSufficientBalance === true
                          ? "text-emerald-500 dark:text-emerald-400"
                          : dailyPixPreviewPayload.hasSufficientBalance ===
                              false
                            ? "text-rose-500 dark:text-rose-400"
                            : "text-muted-foreground",
                      )}
                    >
                      {typeof dailyPixPreviewPayload.hasSufficientBalance ===
                      "boolean"
                        ? dailyPixPreviewPayload.hasSufficientBalance
                          ? "OK"
                          : "Baixo"
                        : "—"}
                    </p>
                    <p className="text-muted-foreground text-[9px] tracking-wider uppercase sm:text-[10px]">
                      Saldo Asaas
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="via-border/60 h-px bg-gradient-to-r from-transparent to-transparent" />
          </div>

          {/* Lista de linhas PIX */}
          <div className="min-h-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-3 sm:px-5">
            {!dailyPixPreviewPayload ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <div className="bg-muted/30 flex size-16 items-center justify-center rounded-2xl">
                  <Money className="text-muted-foreground/40 size-8" weight="fill" />
                </div>
                <p className="text-muted-foreground text-sm">
                  Nenhuma prévia carregada.
                </p>
              </div>
            ) : !Array.isArray(dailyPixPreviewPayload.lines) ||
              (dailyPixPreviewPayload.lines as unknown[]).length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <div className="bg-muted/30 flex size-16 items-center justify-center rounded-2xl">
                  <Lightning className="text-muted-foreground/40 size-8" weight="fill" />
                </div>
                <p className="text-muted-foreground text-sm">
                  Nenhuma linha retornada na prévia.
                </p>
              </div>
            ) : (
              <div className="space-y-2 pb-2 sm:pb-4">
                {(dailyPixPreviewPayload.lines as Record<string, unknown>[]).map(
                  (line, idx) => {
                    const pos =
                      typeof line.position === "number" ? line.position : idx + 1
                    const name =
                      typeof line.displayName === "string"
                        ? line.displayName
                        : typeof line.username === "string"
                          ? line.username
                          : "—"
                    const unameRaw =
                      typeof line.username === "string" ? line.username : ""
                    const uname = unameRaw.replace(/^@/, "") || "N/A"
                    const masked =
                      typeof line.pixKeyMasked === "string"
                        ? line.pixKeyMasked
                        : "—"
                    const valid = line.pixKeyValid === true
                    const prize = parsePixPreviewNumber(line.prizeAmount)
                    const postUrl =
                      typeof line.postUrl === "string" ? line.postUrl : ""
                    const platformKey = postUrl
                      ? detectPlatformFromPostUrl(postUrl)
                      : null
                    const platformInfo = platformKey
                      ? platformConfig[platformKey as PlatformKey]
                      : undefined
                    const PlatformIcon = platformInfo?.icon
                    const views = parsePixPreviewNumber(line.views)
                    const likes = parsePixPreviewNumber(line.likes)
                    const comments = parsePixPreviewNumber(line.comments)
                    const er = parsePixPreviewNumber(line.er)
                    const score = parsePixPreviewNumber(line.score)
                    const useScore =
                      typeof dailyPixPreviewPayload?.sortedByEngagement ===
                      "boolean"
                        ? dailyPixPreviewPayload.sortedByEngagement
                        : preview?.sortedByEngagement === true
                    const isTop3 = pos <= 3
                    const medalColors = [
                      "from-amber-500/15 to-yellow-500/10 border-amber-500/30",
                      "from-zinc-400/15 to-zinc-500/10 border-zinc-400/30",
                      "from-orange-500/15 to-amber-700/10 border-orange-500/30",
                    ]

                    return (
                      <div
                        key={`pix-${typeof line.entryId === "string" ? line.entryId : idx}`}
                        className={cn(
                          "group relative rounded-2xl border p-2.5 transition-all duration-300 sm:p-3.5",
                          "border-border/50 bg-muted/10 hover:bg-muted/20",
                          isTop3 &&
                            cn("bg-gradient-to-r", medalColors[pos - 1]),
                        )}
                      >
                        <div className="flex items-start gap-2.5 sm:gap-3">
                          <PositionBadge position={pos} />

                          <div className="bg-muted/50 ring-border/40 relative flex h-16 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 sm:h-20 sm:w-14">
                            <VideoCamera className="text-muted-foreground/50 size-4 sm:size-5" />
                            {PlatformIcon && platformInfo && (
                              <div className="absolute right-0.5 bottom-0.5">
                                <div className="flex size-4 items-center justify-center rounded-md bg-black/70 ring-1 ring-white/10 backdrop-blur-sm sm:size-[18px]">
                                  <PlatformIcon
                                    className={cn(
                                      "size-2.5 sm:size-3",
                                      platformInfo.color,
                                    )}
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm leading-tight font-semibold sm:text-[15px]">
                                  {name}
                                </p>
                                <p className="text-muted-foreground truncate text-[11px] sm:text-xs">
                                  @{uname}
                                </p>
                                <p className="mt-0.5 flex items-center gap-1 truncate font-mono text-[10px] text-indigo-500/80 sm:text-[11px] dark:text-indigo-400/80">
                                  <Wallet
                                    className="size-2.5 shrink-0"
                                    weight="fill"
                                  />
                                  <span className="truncate">{masked}</span>
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5">
                                {prize > 0 && (
                                  <Badge className="border border-emerald-500/40 bg-gradient-to-r from-emerald-500/20 to-green-500/20 px-1.5 py-0.5 text-[10px] text-emerald-600 sm:px-2 sm:text-xs dark:text-emerald-300">
                                    <CurrencyDollar
                                      className="mr-0.5 size-3"
                                      weight="bold"
                                    />
                                    {formatCurrency(prize)}
                                  </Badge>
                                )}
                                <div
                                  className={cn(
                                    "flex size-5 items-center justify-center rounded-full sm:size-[22px]",
                                    valid
                                      ? "bg-emerald-500/20"
                                      : "bg-rose-500/20",
                                  )}
                                  title={
                                    valid
                                      ? "Chave PIX válida"
                                      : "Chave PIX inválida"
                                  }
                                >
                                  {valid ? (
                                    <CheckCircle
                                      className="size-3 text-emerald-500 sm:size-3.5 dark:text-emerald-400"
                                      weight="fill"
                                    />
                                  ) : (
                                    <XCircle
                                      className="size-3 text-rose-500 sm:size-3.5 dark:text-rose-400"
                                      weight="fill"
                                    />
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1 sm:gap-1.5">
                              <MetricChip tone="blue" icon={<Eye className="size-2.5" />}>
                                {formatMetricFull(views)}
                              </MetricChip>
                              <MetricChip tone="rose" icon={<Heart className="size-2.5" />}>
                                {formatMetricFull(likes)}
                              </MetricChip>
                              <MetricChip tone="sky" icon={<ChatCircle className="size-2.5" />}>
                                {formatMetricFull(comments)}
                              </MetricChip>
                              <MetricChip tone="amber">
                                ER{" "}
                                {er.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                                %
                              </MetricChip>
                              {useScore && (
                                <MetricChip tone="pink" icon={<Sparkle className="size-2.5" weight="fill" />}>
                                  {Math.round(score).toLocaleString("pt-BR")}
                                </MetricChip>
                              )}
                            </div>

                            {postUrl ? (
                              <a
                                href={postUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary/70 hover:text-primary flex items-center gap-1 truncate text-[11px] transition-colors sm:text-xs"
                              >
                                <ArrowSquareOut className="size-3 shrink-0" />
                                <span className="max-w-[180px] truncate sm:max-w-[320px]">
                                  {postUrl.replace(/^https?:\/\/(www\.)?/, "")}
                                </span>
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )
                  },
                )}
              </div>
            )}
          </div>

          <DialogFooter className="border-border/60 bg-background/95 relative z-10 shrink-0 flex-col-reverse gap-2 border-t px-4 py-4 backdrop-blur-md sm:flex-row sm:justify-end sm:px-6">
            <Button
              type="button"
              variant="outline"
              className="w-full cursor-pointer rounded-xl sm:w-auto"
              onClick={() => {
                setDailyPixPayoutModalOpen(false)
                setDailyPixPreviewPayload(null)
              }}
            >
              Fechar
            </Button>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-full sm:w-auto">
                    <Button
                      type="button"
                      className="w-full cursor-pointer gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md shadow-amber-900/20 hover:from-amber-500 hover:to-orange-500 sm:w-auto"
                      disabled={
                        !preview?.canUndoRankPayments ||
                        dailyPixPreviewPayload?.hasSufficientBalance === false ||
                        executeDailyPixPayout.isPending ||
                        !campaignId ||
                        !preview?.date ||
                        preview?.dailyPixPayoutCompleted === true
                      }
                      onClick={() => {
                        if (!campaignId || !preview?.date) return
                        executeDailyPixPayout.mutate({
                          campaignId,
                          date: preview.date,
                        })
                      }}
                    >
                      {executeDailyPixPayout.isPending ? (
                        <Spinner className="size-4 animate-spin" />
                      ) : (
                        <Money className="size-4" weight="fill" />
                      )}
                      Confirmar pagamento PIX
                    </Button>
                  </span>
                </TooltipTrigger>
                {!preview?.canUndoRankPayments ? (
                  <TooltipContent side="top" className="max-w-[260px]">
                    <p className="text-xs">
                      Primeiro use <strong>Pagar rank</strong> para creditar as
                      carteiras; depois confirme o PIX aqui.
                    </p>
                  </TooltipContent>
                ) : dailyPixPreviewPayload?.hasSufficientBalance === false ? (
                  <TooltipContent side="top" className="max-w-[260px]">
                    <p className="text-xs">
                      Saldo Asaas insuficiente para o total de prêmios.
                      Recarregue a prévia após ajustar a conta Asaas.
                    </p>
                  </TooltipContent>
                ) : null}
              </Tooltip>
            </TooltipProvider>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ ALERT: CONFIRMAR PAGAMENTO ============ */}
      <AlertDialog
        open={payRankDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !payDailyRankByDate.isPending) {
            setPayRankDialogOpen(false)
            setPayRankPlan(null)
            setPayRankInput("")
          }
        }}
      >
        <AlertDialogContent className="flex max-h-[90vh] w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-lg">
          {/* Header */}
          <div className="relative shrink-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-orange-500/10" />
            <div className="absolute top-0 left-0 size-24 -translate-x-12 -translate-y-12 rounded-full bg-amber-500/10 blur-2xl" />

            <div className="relative space-y-2 px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
              <AlertDialogHeader className="space-y-2 text-left">
                <AlertDialogTitle className="flex items-center gap-3 text-left text-base sm:text-lg">
                  <span className="flex size-9 items-center justify-center rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/20 to-yellow-500/20 sm:size-10">
                    <Coins
                      className="size-4 text-amber-500 sm:size-5 dark:text-amber-400"
                      weight="fill"
                    />
                  </span>
                  <span className="bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-500 bg-clip-text font-bold text-transparent dark:from-amber-200 dark:via-yellow-200 dark:to-amber-100">
                    Pagar Ranking Diário
                  </span>
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="text-muted-foreground space-y-1.5 text-left text-sm">
                    {payRankPlan ? (
                      <>
                        <p>
                          <strong className="text-foreground">
                            {payRankPlan.campaignName}
                          </strong>
                          {payRankPlan.date && (
                            <Badge
                              variant="outline"
                              className="border-border/60 bg-muted/40 text-foreground/80 ml-2 gap-1 rounded-full text-[10px]"
                            >
                              <CalendarBlank className="size-2.5" />
                              {format(parseISO(payRankPlan.date), "dd/MM/yyyy", {
                                locale: ptBR,
                              })}
                            </Badge>
                          )}
                        </p>
                        <p className="text-muted-foreground/70 text-xs">
                          Cada colocado recebe crédito na carteira, registro de
                          transação e auditoria.
                        </p>
                      </>
                    ) : (
                      <p className="flex items-center gap-2">
                        <Spinner className="size-3 animate-spin" /> Carregando
                        resumo…
                      </p>
                    )}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>
          </div>

          <div className="via-border/60 h-px shrink-0 bg-gradient-to-r from-transparent to-transparent" />

          {/* Plano (scroll) */}
          {payRankPlan && (
            <div className="max-h-[min(40vh,300px)] space-y-3 overflow-y-auto overscroll-contain px-5 py-4 text-sm sm:px-6">
              <div className="flex items-center justify-between rounded-xl border border-amber-500/25 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 px-3 py-3 sm:px-4">
                <div>
                  <p className="text-muted-foreground text-[10px] tracking-wider uppercase sm:text-xs">
                    Total a creditar
                  </p>
                  <p className="text-lg font-bold text-amber-600 sm:text-xl dark:text-amber-300">
                    {formatCurrency(payRankPlan.totalAmount)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-xs">
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      {payRankPlan.payableCount}
                    </span>{" "}
                    pagamento(s)
                  </p>
                  {payRankPlan.skippedCount > 0 && (
                    <p className="text-muted-foreground text-xs">
                      <span className="text-muted-foreground/60">
                        {payRankPlan.skippedCount}
                      </span>{" "}
                      ignorado(s)
                    </p>
                  )}
                </div>
              </div>

              {payRankPlan.payable.length > 0 && (
                <div className="space-y-2">
                  <p className="text-foreground/80 text-xs font-semibold tracking-wider uppercase">
                    Créditos a processar
                  </p>
                  <div className="border-border/50 bg-muted/10 max-h-36 space-y-1 overflow-y-auto rounded-xl border p-2">
                    {payRankPlan.payable.map((p) => (
                      <div
                        key={`pay-${p.position}-${p.clipperName}`}
                        className="hover:bg-muted/30 flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors"
                      >
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="text-foreground/80 shrink-0 font-mono text-xs font-bold">
                            {p.position}º
                          </span>
                          <div className="min-w-0">
                            <p className="text-foreground/90 truncate text-xs font-medium">
                              {p.clipperName}
                            </p>
                            {p.fullName && p.fullName !== p.clipperName && (
                              <p className="text-muted-foreground/50 truncate text-[10px]">
                                {p.fullName}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(p.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {payRankPlan.skipped.length > 0 && (
                <div className="space-y-2">
                  <p className="text-muted-foreground/60 text-xs font-semibold tracking-wider uppercase">
                    Ignorados
                  </p>
                  <div className="border-border/50 bg-muted/10 max-h-28 space-y-1 overflow-y-auto rounded-xl border p-2">
                    {payRankPlan.skipped.map((s) => (
                      <div
                        key={`skip-${s.position}-${s.reason}`}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5"
                      >
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="text-muted-foreground/50 shrink-0 font-mono text-xs">
                            {s.position}º
                          </span>
                          <div className="min-w-0">
                            <p className="text-muted-foreground/60 truncate text-xs">
                              {s.clipperName}
                            </p>
                            {s.fullName && s.fullName !== s.clipperName && (
                              <p className="text-muted-foreground/40 truncate text-[10px]">
                                {s.fullName}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="text-muted-foreground/40 shrink-0 text-[10px]">
                          {s.reason}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="via-border/60 h-px shrink-0 bg-gradient-to-r from-transparent to-transparent" />

          {/* Confirmação por palavra */}
          <div className="shrink-0 space-y-4 px-5 py-4 sm:px-6">
            <ConfirmWordInput
              word="PAGAR"
              value={payRankInput}
              onChange={setPayRankInput}
              id="confirm-pagar-rank-diario"
            />
          </div>

          <div className="via-border/60 h-px shrink-0 bg-gradient-to-r from-transparent to-transparent" />

          {/* Footer */}
          <div className="flex shrink-0 flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <AlertDialogCancel
              disabled={payDailyRankByDate.isPending}
              className="h-10 cursor-pointer rounded-xl"
              onClick={() => setPayRankInput("")}
            >
              Cancelar
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={
                payRankInput !== "PAGAR" ||
                payDailyRankByDate.isPending ||
                !payRankPlan ||
                payRankPlan.payableCount === 0
              }
              onClick={confirmPayRankExecution}
              className={cn(
                "h-10 cursor-pointer gap-2 rounded-xl font-semibold",
                "bg-amber-600 text-white hover:bg-amber-500",
                "disabled:cursor-not-allowed disabled:opacity-40",
              )}
            >
              {payDailyRankByDate.isPending ? (
                <>
                  <Spinner className="size-4 animate-spin" />
                  Processando…
                </>
              ) : (
                <>
                  <Coins className="size-4" weight="fill" />
                  Confirmar pagamento
                </>
              )}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ============ ALERT: DESFAZER PAGAMENTOS ============ */}
      <AlertDialog
        open={undoRankDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !undoDailyRankPayments.isPending) {
            setUndoRankDialogOpen(false)
            setUndoRankPlan(null)
          }
        }}
      >
        <AlertDialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-lg">
          <AlertDialogHeader className="border-border/50 shrink-0 space-y-2 border-b px-6 py-4 text-left">
            <AlertDialogTitle className="flex items-center gap-2 text-left">
              <ArrowCounterClockwise className="size-5 text-rose-500 dark:text-rose-400" />
              Desfazer pagamento do rank
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-muted-foreground space-y-1 text-left text-sm">
                {undoRankPlan ? (
                  <>
                    <p>
                      <strong className="text-foreground">
                        {undoRankPlan.campaignName}
                      </strong>{" "}
                      ·{" "}
                      <strong className="text-foreground">
                        {undoRankPlan.date}
                      </strong>
                    </p>
                    <p>
                      Será criado um ajuste negativo na carteira de cada
                      clipador, o status do prêmio na entrada volta para{" "}
                      <strong className="text-foreground">PENDING</strong> e o
                      valor zerado. A transação original de prêmio permanece no
                      histórico.
                    </p>
                  </>
                ) : (
                  <p>Carregando resumo…</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {undoRankPlan && (
            <div className="max-h-[min(45vh,360px)] space-y-4 overflow-y-auto overscroll-contain px-6 py-4 text-sm">
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2">
                <p className="font-semibold text-rose-600 dark:text-rose-100">
                  Total a estornar: {formatCurrency(undoRankPlan.totalAmount)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {undoRankPlan.entryCount} lançamento(s)
                </p>
              </div>
              {undoRankPlan.balanceIssues.length > 0 && (
                <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-xl border px-3 py-2">
                  <p className="font-medium">
                    Saldo insuficiente em algumas carteiras
                  </p>
                  <ul className="mt-2 list-inside list-disc text-xs">
                    {undoRankPlan.balanceIssues.map((b) => (
                      <li key={`bal-${b.position}-${b.clipperName}`}>
                        {b.position}º {b.clipperName}: saldo{" "}
                        {formatCurrency(b.balance)} · necessário{" "}
                        {formatCurrency(b.needed)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {undoRankPlan.lines.length > 0 && (
                <div>
                  <p className="text-foreground mb-2 font-medium">Estornos</p>
                  <ul className="text-muted-foreground max-h-40 space-y-1 overflow-y-auto">
                    {undoRankPlan.lines.map((l) => (
                      <li key={`undo-${l.position}-${l.clipperName}`}>
                        {l.position}º {l.clipperName} —{" "}
                        {formatCurrency(l.amount)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <AlertDialogFooter className="border-border/50 shrink-0 border-t px-6 py-4 sm:justify-end">
            <AlertDialogCancel
              disabled={undoDailyRankPayments.isPending}
              className="cursor-pointer rounded-xl"
            >
              Cancelar
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="cursor-pointer gap-2 rounded-xl"
              disabled={
                undoDailyRankPayments.isPending ||
                !undoRankPlan ||
                !undoRankPlan.canExecute
              }
              onClick={confirmUndoRankExecution}
            >
              {undoDailyRankPayments.isPending ? (
                <>
                  <Spinner className="size-4 animate-spin" />
                  Processando…
                </>
              ) : (
                <>
                  <ArrowCounterClockwise className="size-4" />
                  Confirmar estorno
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ============ ALERT: DESCLASSIFICAR ============ */}
      <AlertDialog
        open={disqualifyConfirm !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !disqualifyDailyRankingEntry.isPending) {
            setDisqualifyConfirm(null)
            setDisqualifyInput("")
            setDisqualifyReason("")
          }
        }}
      >
        <AlertDialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-lg">
          {/* Header com accent vermelho */}
          <div className="relative shrink-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-rose-500/15 via-red-500/10 to-orange-500/10" />
            <div className="absolute top-0 left-0 size-24 -translate-x-12 -translate-y-12 rounded-full bg-rose-500/10 blur-2xl" />

            <div className="relative px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
              <AlertDialogHeader className="space-y-3 text-left">
                <AlertDialogTitle className="flex items-center gap-3 text-base sm:text-lg">
                  <span className="flex size-9 items-center justify-center rounded-xl border border-rose-500/30 bg-gradient-to-br from-rose-500/20 to-red-500/20 sm:size-10">
                    <Warning
                      className="size-4 text-rose-500 sm:size-5 dark:text-rose-400"
                      weight="fill"
                    />
                  </span>
                  <span className="font-bold text-rose-600 dark:text-rose-200">
                    Desclassificar vídeo
                  </span>
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="text-muted-foreground space-y-3 text-sm">
                    <p>
                      {disqualifyConfirm?.submittedUrl?.trim() ? (
                        <>
                          O post de{" "}
                          <a
                            href={disqualifyConfirm.submittedUrl.trim()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary decoration-primary/60 hover:text-primary/90 inline-flex items-center gap-1 font-semibold underline underline-offset-2"
                          >
                            {disqualifyConfirm.clipperName}
                            <ArrowSquareOut className="size-3.5 shrink-0 opacity-80" />
                          </a>
                        </>
                      ) : (
                        <>
                          O post de{" "}
                          <strong className="text-foreground">
                            {disqualifyConfirm?.clipperName}
                          </strong>
                        </>
                      )}{" "}
                      será{" "}
                      <strong className="text-rose-500 dark:text-rose-400">
                        desclassificado
                      </strong>{" "}
                      e removido deste ranking diário. As posições abaixo serão
                      renumeradas.
                    </p>
                    <div className="space-y-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
                      <p className="text-xs font-medium text-rose-600/90 dark:text-rose-300/80">
                        O registro do vídeo na competição permanece, apenas o
                        status muda.
                      </p>
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>
          </div>

          <div className="via-border/60 h-px shrink-0 bg-gradient-to-r from-transparent to-transparent" />

          {/* Motivo + confirmação */}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="disqualify-reason"
                className="text-muted-foreground text-xs font-medium sm:text-sm"
              >
                Motivo da desclassificação (opcional)
              </Label>
              <Textarea
                id="disqualify-reason"
                value={disqualifyReason}
                onChange={(e) => setDisqualifyReason(e.target.value)}
                placeholder="Ex.: postagem fora das regras da campanha"
                className="min-h-[88px] rounded-xl text-sm"
                disabled={disqualifyDailyRankingEntry.isPending}
              />
            </div>
            <ConfirmWordInput
              word="DESCLASSIFICAR"
              value={disqualifyInput}
              onChange={setDisqualifyInput}
              id="confirm-desclassificar-daily"
            />
          </div>

          <div className="via-border/60 h-px shrink-0 bg-gradient-to-r from-transparent to-transparent" />

          {/* Footer */}
          <div className="flex shrink-0 flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <AlertDialogCancel
              disabled={disqualifyDailyRankingEntry.isPending}
              className="h-10 cursor-pointer rounded-xl"
              onClick={() => {
                setDisqualifyInput("")
                setDisqualifyReason("")
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={
                disqualifyInput !== "DESCLASSIFICAR" ||
                disqualifyDailyRankingEntry.isPending
              }
              onClick={() => {
                if (!disqualifyConfirm) return
                disqualifyDailyRankingEntry.mutate({
                  dailyRankingEntryId: disqualifyConfirm.dailyRankingEntryId,
                  clipPostId: disqualifyConfirm.clipPostId,
                  disqualificationReason: disqualifyReason.trim() || undefined,
                })
              }}
              className={cn(
                "h-10 cursor-pointer gap-2 rounded-xl font-semibold",
                "bg-rose-600 text-white hover:bg-rose-500",
                "disabled:cursor-not-allowed disabled:opacity-40",
              )}
            >
              {disqualifyDailyRankingEntry.isPending ? (
                <>
                  <Spinner className="size-4 animate-spin" />
                  Processando…
                </>
              ) : (
                <>
                  <XCircle className="size-4" weight="fill" />
                  Desclassificar
                </>
              )}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
