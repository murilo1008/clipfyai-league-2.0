"use client"

import * as React from "react"
import {
  ArrowSquareOut,
  CaretDown,
  CaretUp,
  Check,
  CheckCircle,
  Clock,
  Coins,
  Copy,
  CurrencyDollar,
  Envelope,
  Eye,
  FileCsv,
  Funnel,
  GearSix,
  IdentificationCard,
  Lightning,
  Medal,
  PencilSimple,
  Phone,
  Pulse,
  Receipt,
  Sparkle,
  Spinner,
  Trash,
  Trophy,
  UserCheck,
  UsersThree,
  Wallet,
  Warning,
  X,
  XCircle,
} from "@phosphor-icons/react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"

import {
  StatTilesGridSkeleton,
  TableSkeleton,
} from "@/components/shared/skeletons"
import {
  AlertDialog,
  AlertDialogAction,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"
import type { RouterOutputs } from "@/trpc/react"
import { UploadButton } from "@/utils/uploadthing"

import {
  downloadTextFile,
  EmptyState,
  escapeCsvCell,
  formatCurrencyPlain,
  useFormatCurrency,
} from "./shared"
import type { CompetitionTabProps } from "./shared"

/* ============================================================
   Tipos
   ============================================================ */

type CompetitionFinancials =
  RouterOutputs["admin"]["getCompetitionFinancials"]

type FinancialClipper = CompetitionFinancials["clippers"][number]

type FlatTransaction = FinancialClipper["transactions"][number] & {
  clipperName: string
  clipperArtisticName: string | null
  clipperProfileId: string
}

type FinancialSortKey = "totalEarned" | "totalPaidViaPix" | "remainingToPay"

/* ============================================================
   Helpers locais
   ============================================================ */

const formatDateTimeLong = (date: Date | string) =>
  format(new Date(date), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })

/** JsonValue de tabela de prêmios → entries [posição, valor] numéricas. */
function toPrizeEntries(value: unknown): Array<[string, number]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return []
  return Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, number] => typeof entry[1] === "number",
  )
}

/** Config visual dos tipos de transação (dialog de detalhes do clipador). */
const TX_DETAIL_TYPES: Record<
  string,
  {
    label: string
    icon: React.ElementType
    color: string
    bg: string
    border: string
  }
> = {
  PRIZE_CREDIT: {
    label: "Prêmio",
    icon: Trophy,
    color: "text-yellow-500 dark:text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/25",
  },
  BONUS: {
    label: "Bônus",
    icon: Sparkle,
    color: "text-violet-500 dark:text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/25",
  },
  ADJUSTMENT: {
    label: "Ajuste",
    icon: GearSix,
    color: "text-sky-500 dark:text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/25",
  },
}

/** Config visual dos tipos na tabela "Todas as Transações". */
const TX_TABLE_TYPES: Record<
  string,
  {
    label: string
    icon: React.ElementType
    color: string
    bg: string
    border: string
  }
> = {
  PRIZE_CREDIT: {
    label: "Prêmio",
    icon: Trophy,
    color: "text-violet-500 dark:text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/40",
  },
  BONUS: {
    label: "Bônus",
    icon: Lightning,
    color: "text-amber-500 dark:text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/40",
  },
  ADJUSTMENT: {
    label: "Ajuste",
    icon: GearSix,
    color: "text-sky-500 dark:text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/40",
  },
}

/* ============================================================
   Tab Financeiro
   ============================================================ */

export function FinancialTab(props: CompetitionTabProps) {
  const { slug, campaignId, data, active, refetch } = props
  const formatCurrency = useFormatCurrency()
  const utils = api.useUtils()

  const { data: financialData, isLoading } =
    api.admin.getCompetitionFinancials.useQuery(
      { slug },
      {
        enabled: active && !!data,
        placeholderData: (prev) => prev,
      },
    )

  /* ===== Ordenação da tabela ===== */
  const [sortBy, setSortBy] = React.useState<FinancialSortKey>("totalEarned")
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc")

  const toggleSort = (column: FinancialSortKey) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === "desc" ? "asc" : "desc"))
    } else {
      setSortBy(column)
      setSortDir("desc")
    }
  }

  const sortedClippers = React.useMemo(() => {
    if (!financialData) return []
    const clippers = [...financialData.clippers]
    clippers.sort((a, b) => {
      const aVal = a[sortBy]
      const bVal = b[sortBy]
      return sortDir === "desc" ? bVal - aVal : aVal - bVal
    })
    return clippers
  }, [financialData, sortBy, sortDir])

  /* ===== Dialog: detalhes financeiros do clipador ===== */
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false)
  const [selectedClipper, setSelectedClipper] =
    React.useState<FinancialClipper | null>(null)
  const [isEditingPixKey, setIsEditingPixKey] = React.useState(false)
  const [editPixKeyValue, setEditPixKeyValue] = React.useState("")

  /* ===== Dialog: todas as transações ===== */
  const [transactionsDialogOpen, setTransactionsDialogOpen] =
    React.useState(false)
  const [selectedClipperFilter, setSelectedClipperFilter] =
    React.useState<string>("all")
  const [transactionTypeFilter, setTransactionTypeFilter] =
    React.useState<string>("all")

  /* ===== Dialog: registrar PIX ===== */
  const [isPixDialogOpen, setIsPixDialogOpen] = React.useState(false)
  const [pixAmount, setPixAmount] = React.useState("")
  const [pixKey, setPixKey] = React.useState("")
  const [useCustomPixKey, setUseCustomPixKey] = React.useState(false)
  const [customPixKey, setCustomPixKey] = React.useState("")
  const [pixProofUrl, setPixProofUrl] = React.useState("")
  const [isUploadingProof, setIsUploadingProof] = React.useState(false)
  const [isPixConfirmDialogOpen, setIsPixConfirmDialogOpen] =
    React.useState(false)

  /* ===== Transações agregadas (dialog Todas as Transações) ===== */
  const allTransactions = React.useMemo<FlatTransaction[]>(() => {
    if (!financialData) return []
    const rows: FlatTransaction[] = []
    financialData.clippers.forEach((clipper) => {
      clipper.transactions.forEach((tx) => {
        rows.push({
          ...tx,
          clipperName: clipper.clipperName,
          clipperArtisticName: clipper.clipperArtisticName,
          clipperProfileId: clipper.clipperProfileId,
        })
      })
    })
    return rows.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }, [financialData])

  const filteredTransactions = React.useMemo(() => {
    let filtered = allTransactions
    if (selectedClipperFilter !== "all") {
      filtered = filtered.filter(
        (tx) => tx.clipperProfileId === selectedClipperFilter,
      )
    }
    if (transactionTypeFilter !== "all") {
      filtered = filtered.filter((tx) => tx.type === transactionTypeFilter)
    }
    return filtered
  }, [allTransactions, selectedClipperFilter, transactionTypeFilter])

  const transactionsStats = React.useMemo(() => {
    const total = filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0)
    const count = filteredTransactions.length
    const byType = filteredTransactions.reduce<Record<string, number>>(
      (acc, tx) => {
        acc[tx.type] = (acc[tx.type] ?? 0) + 1
        return acc
      },
      {},
    )
    return { total, count, byType }
  }, [filteredTransactions])

  /* ===== Mutations ===== */

  const updateClipperPixKey = api.admin.updateClipperPixKey.useMutation({
    onSuccess: async (result) => {
      toast.success("Chave PIX atualizada!", {
        description: `Nova chave: ${result.clipperProfile.pixKey}`,
      })
      setSelectedClipper((prev) =>
        prev ? { ...prev, clipperPixKey: result.clipperProfile.pixKey } : prev,
      )
      setIsEditingPixKey(false)
      setEditPixKeyValue("")
      await utils.admin.getCompetitionFinancials.invalidate({ slug })
    },
    onError: (error) =>
      toast.error(error.message || "Erro ao atualizar chave PIX"),
  })

  const sendPixPayment = api.admin.sendPixPayment.useMutation({
    onSuccess: async () => {
      toast.success("PIX registrado com sucesso!", {
        description: `${formatCurrency(parseFloat(pixAmount))} foi debitado da conta da competição`,
      })

      // Fechar todos os dialogs
      setIsPixConfirmDialogOpen(false)
      setIsPixDialogOpen(false)
      setIsDetailsOpen(false)

      // Limpar estados
      setPixAmount("")
      setPixKey("")
      setUseCustomPixKey(false)
      setCustomPixKey("")
      setPixProofUrl("")
      setIsUploadingProof(false)
      setSelectedClipper(null)

      // Invalidar queries relacionadas
      await Promise.all([
        utils.admin.getCompetitionDetailsAdmin.invalidate({ slug }),
        utils.admin.getCompetitionFinancials.invalidate({ slug }),
        utils.admin.getClipperAllTransactions.invalidate(),
        utils.admin.getClipperTransactionsInCampaign.invalidate(),
        utils.clipper.getWallet.invalidate(),
        utils.clipper.getTransactions.invalidate(),
        utils.clipper.getWalletStats.invalidate(),
      ])
      refetch()
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao registrar PIX")
      setIsPixConfirmDialogOpen(false)
    },
  })

  /* ===== Handlers ===== */

  const handleCopyMissingPayments = () => {
    if (!financialData || financialData.clippers.length === 0) {
      toast.error("Nenhum dado financeiro para copiar")
      return
    }

    const faltantes = financialData.clippers.filter(
      (c) => c.remainingToPay > 0,
    )

    if (faltantes.length === 0) {
      toast.info("Todos os pagamentos já foram realizados! 🎉")
      return
    }

    // Montar TSV (tab-separated values) compatível com Notion
    const header = [
      "Clipador",
      "Chave PIX",
      "Total de Ganhos",
      "",
      "Pagamento",
      "Comprovante",
    ].join("\t")

    const rows = faltantes
      .sort((a, b) => a.remainingToPay - b.remainingToPay)
      .map((clipper) =>
        [
          clipper.clipperName,
          clipper.clipperPixKey || "",
          formatCurrencyPlain(clipper.remainingToPay),
          "", // Notion interpreta como unchecked
          "Não Iniciado",
          "",
        ].join("\t"),
      )

    void navigator.clipboard.writeText([header, ...rows].join("\n"))
    toast.success("Pagamentos faltantes copiados!", {
      description: `${faltantes.length} clipador(es) com pagamento pendente — cole diretamente no Notion`,
    })
  }

  const handleDownloadMissingCsv = () => {
    if (!financialData || financialData.clippers.length === 0) {
      toast.error("Nenhum dado financeiro disponível")
      return
    }

    const faltantes = financialData.clippers
      .filter((c) => c.remainingToPay > 0)
      .sort((a, b) => a.remainingToPay - b.remainingToPay)

    if (faltantes.length === 0) {
      toast.info("Todos os pagamentos já foram realizados! 🎉")
      return
    }

    const fileDate = format(new Date(), "dd-MM-yyyy_HH-mm")
    const header = [
      "Clipador",
      "Chave PIX",
      "Total de Ganhos",
      "Pagamento",
      "Comprovante",
    ]
    const dataRows = faltantes.map((c) => [
      c.clipperName,
      c.clipperPixKey || "",
      formatCurrencyPlain(c.remainingToPay),
      "Não Iniciado",
      "",
    ])
    const csvLines = [
      header.map(escapeCsvCell).join(","),
      ...dataRows.map((row) =>
        row.map((cell) => escapeCsvCell(String(cell))).join(","),
      ),
    ]

    const safeName = financialData.campaign.name
      .replace(/[^a-zA-Z0-9À-ÿ\s-]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 50)

    downloadTextFile(
      `Pagamentos_Faltantes_${safeName}_${fileDate}.csv`,
      csvLines.join("\n"),
      "text/csv",
      true,
    )

    toast.success("CSV baixado!", {
      description: `${faltantes.length} pagamento(s) faltante(s) exportado(s)`,
    })
  }

  const openPixDialog = () => {
    if (!selectedClipper) return
    setPixAmount("")
    setPixKey(selectedClipper.clipperPixKey || "")
    setUseCustomPixKey(false)
    setCustomPixKey("")
    setPixProofUrl("")
    setIsUploadingProof(false)
    setIsPixDialogOpen(true)
  }

  const handlePixConfirm = () => {
    const amount = parseFloat(pixAmount)

    if (!amount || amount <= 0) {
      toast.error("Informe um valor válido")
      return
    }

    const finalPixKey = useCustomPixKey ? customPixKey.trim() : pixKey

    if (!finalPixKey) {
      toast.error("Informe uma chave PIX válida")
      return
    }

    if (!pixProofUrl) {
      toast.error("Faça upload do comprovante de pagamento")
      return
    }

    // Fechar dialog inicial e abrir confirmação
    setIsPixDialogOpen(false)
    setIsPixConfirmDialogOpen(true)
  }

  const handlePixSend = () => {
    if (!selectedClipper) return
    const amount = parseFloat(pixAmount)
    const finalPixKey = useCustomPixKey ? customPixKey.trim() : pixKey

    sendPixPayment.mutate({
      clipperProfileId: selectedClipper.clipperProfileId,
      amount,
      pixKey: finalPixKey,
      campaignId,
      proofUrl: pixProofUrl,
    })
  }

  const handleCopyIndividualReport = () => {
    const clipper = selectedClipper
    if (!clipper) return

    let text = `💰 RELATÓRIO INDIVIDUAL - ${clipper.clipperName.toUpperCase()}\n`
    text += `${"=".repeat(70)}\n\n`

    text += `👤 DADOS DO CLIPADOR:\n`
    text += `   Nome: ${clipper.clipperName}\n`
    if (clipper.clipperArtisticName) {
      text += `   Nome Artístico: ${clipper.clipperArtisticName}\n`
    }
    text += `   Email: ${clipper.clipperEmail}\n`
    text += `   Telefone: ${clipper.clipperPhone || "N/A"}\n`
    text += `   CPF: ${clipper.clipperCpf || "N/A"}\n`
    text += `   Chave PIX: ${clipper.clipperPixKey || "N/A"}\n\n`

    text += `💵 RESUMO FINANCEIRO:\n`
    text += `   Total Ganho: ${formatCurrencyPlain(clipper.totalEarned)}\n`
    text += `   Total Pago via PIX: ${formatCurrencyPlain(clipper.totalPaidViaPix)}\n`
    text += `   Falta Pagar: ${formatCurrencyPlain(clipper.remainingToPay)}\n`
    text += `   Total de Transações: ${clipper.transactions.length}\n`
    text += `   Total de PIX: ${clipper.pixRecords.length}\n\n`
    text += `${"=".repeat(70)}\n\n`

    text += `📝 TRANSAÇÕES (CRÉDITOS):\n\n`
    clipper.transactions.forEach((tx, txIndex) => {
      const txDate = format(new Date(tx.createdAt), "dd/MM/yyyy HH:mm", {
        locale: ptBR,
      })
      text += `${txIndex + 1}. ${tx.description}\n`
      text += `   Valor: ${formatCurrencyPlain(tx.amount)}\n`
      text += `   Data: ${txDate}\n`
      if (tx.rankingPosition) {
        text += `   Posição: ${tx.rankingPosition}º\n`
      }
      text += `   Status: ${tx.status}\n`
      text += `   Tipo: ${tx.type === "PRIZE_CREDIT" ? "Prêmio" : tx.type === "BONUS" ? "Bônus" : "Ajuste"}\n\n`
    })

    if (clipper.pixRecords.length > 0) {
      text += `\n📤 REGISTROS DE PIX:\n\n`
      clipper.pixRecords.forEach((pix, pixIndex) => {
        const pixDate = format(new Date(pix.createdAt), "dd/MM/yyyy HH:mm", {
          locale: ptBR,
        })
        text += `${pixIndex + 1}. ${pix.description}\n`
        text += `   Valor: ${formatCurrencyPlain(pix.amount)}\n`
        text += `   Data: ${pixDate}\n`
        text += `   Chave PIX: ${pix.pixKey || "N/A"}\n`
        text += `   Status: ${pix.status}\n\n`
      })
    }

    text += `${"=".repeat(70)}\n`
    text += `\nRelatório gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}\n`

    void navigator.clipboard.writeText(text)
    toast.success("Relatório copiado!", {
      description: `Dados de ${clipper.clipperName} copiados para a área de transferência`,
    })
  }

  const handleCopyFilteredTransactions = () => {
    if (!financialData) return

    let text = `📊 TRANSAÇÕES - ${financialData.campaign.name.toUpperCase()}\n`
    text += `${"=".repeat(80)}\n\n`
    text += `Total: ${formatCurrencyPlain(transactionsStats.total)}\n`
    text += `Quantidade: ${transactionsStats.count} transações\n\n`
    text += `${"=".repeat(80)}\n\n`

    filteredTransactions.forEach((tx, index) => {
      const txDate = format(new Date(tx.createdAt), "dd/MM/yyyy HH:mm", {
        locale: ptBR,
      })
      text += `${index + 1}. ${tx.clipperName}\n`
      text += `   Descrição: ${tx.description}\n`
      text += `   Valor: ${formatCurrencyPlain(tx.amount)}\n`
      text += `   Tipo: ${tx.type}\n`
      if (tx.rankingPosition) {
        text += `   Posição: ${tx.rankingPosition}º\n`
      }
      text += `   Status: ${tx.status}\n`
      text += `   Data: ${txDate}\n\n`
    })

    text += `${"=".repeat(80)}\n`
    text += `Relatório gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}\n`

    void navigator.clipboard.writeText(text)
    toast.success("Transações copiadas!", {
      description: `${filteredTransactions.length} transações copiadas para área de transferência`,
    })
  }

  /* ===== Loading ===== */
  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 sm:gap-6">
        <StatTilesGridSkeleton
          count={5}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5"
        />
        <TableSkeleton rows={6} />
      </div>
    )
  }

  /* ===== Sem dados ===== */
  if (!financialData) {
    return (
      <EmptyState
        icon={<Wallet className="size-6" weight="fill" />}
        title="Dados financeiros não disponíveis"
        subtitle="Não foi possível carregar o financeiro desta competição"
      />
    )
  }

  const { summary, rankingRule } = financialData

  const summaryCards = [
    {
      icon: CurrencyDollar,
      label: "Total Creditado",
      shortLabel: "Creditado",
      value: formatCurrency(summary.totalPaid),
      subtitle: `${summary.totalTransactions} transações`,
      border: "border-emerald-500/25",
      from: "from-emerald-500/10",
      iconBg: "bg-emerald-500/15",
      text: "text-emerald-600 dark:text-emerald-400",
    },
    {
      icon: Receipt,
      label: "Total Pago (PIX)",
      shortLabel: "Pago PIX",
      value: formatCurrency(summary.totalPaidViaPix),
      subtitle: "transferido via PIX",
      border: "border-cyan-500/25",
      from: "from-cyan-500/10",
      iconBg: "bg-cyan-500/15",
      text: "text-cyan-600 dark:text-cyan-400",
    },
    {
      icon: Warning,
      label: "Falta Pagar",
      shortLabel: "Falta",
      value: formatCurrency(summary.totalRemainingToPay),
      subtitle: "pendente de transferência",
      border: "border-red-500/25",
      from: "from-red-500/10",
      iconBg: "bg-red-500/15",
      text: "text-red-600 dark:text-red-400",
    },
    {
      icon: UsersThree,
      label: "Clipadores Pagos",
      shortLabel: "Clipadores",
      value: String(summary.totalClippers),
      subtitle: "receberam pagamentos",
      border: "border-violet-500/25",
      from: "from-violet-500/10",
      iconBg: "bg-violet-500/15",
      text: "text-violet-600 dark:text-violet-400",
    },
    {
      icon: Wallet,
      label: "Total Estimado",
      shortLabel: "Estimado",
      value: formatCurrency(summary.estimatedTotal),
      subtitle: "pago + futuro",
      border: "border-amber-500/25",
      from: "from-amber-500/10",
      iconBg: "bg-amber-500/15",
      text: "text-amber-600 dark:text-amber-400",
    },
  ] as const

  const dailyPrizeEntries = toPrizeEntries(rankingRule?.dailyPrizeTable)
  const monthlyPrizeEntries = toPrizeEntries(rankingRule?.monthlyPrizeTable)

  const selectedPaidPercent =
    selectedClipper && selectedClipper.totalEarned > 0
      ? Math.min(
          100,
          (selectedClipper.totalPaidViaPix / selectedClipper.totalEarned) *
            100,
        )
      : 0

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {/* ===== Cards de resumo financeiro ===== */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5 lg:gap-4">
        {summaryCards.map((card, index) => {
          const CardIcon = card.icon
          return (
            <div
              key={card.label}
              className={cn(
                "rounded-2xl border bg-gradient-to-br to-transparent p-2.5 transition-all hover:shadow-md sm:p-3 lg:p-4",
                card.border,
                card.from,
                index === 4 && "col-span-2 sm:col-span-1",
              )}
            >
              {/* Mobile: layout horizontal compacto */}
              <div className="flex items-center gap-2 sm:hidden">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    card.iconBg,
                    card.text,
                  )}
                >
                  <CardIcon className="size-4" weight="fill" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground truncate text-[10px] leading-tight font-medium">
                    {card.shortLabel}
                  </p>
                  <p
                    className={cn(
                      "truncate text-base leading-tight font-bold tabular-nums",
                      card.text,
                    )}
                  >
                    {card.value}
                  </p>
                </div>
              </div>
              {/* SM+: layout vertical detalhado */}
              <div className="hidden sm:block">
                <div className="mb-1.5 flex items-center gap-2 lg:mb-2">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-lg lg:size-8",
                      card.iconBg,
                      card.text,
                    )}
                  >
                    <CardIcon className="size-3.5 lg:size-4" weight="fill" />
                  </span>
                  <p className="text-muted-foreground truncate text-[11px] leading-tight font-medium lg:text-xs">
                    {card.label}
                  </p>
                </div>
                <p
                  className={cn(
                    "truncate text-lg leading-none font-bold tabular-nums md:text-xl lg:text-2xl",
                    card.text,
                  )}
                >
                  {card.value}
                </p>
                <p className="text-muted-foreground mt-1 truncate text-[10px] lg:text-xs">
                  {card.subtitle}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* ===== Pagamentos por Clipador ===== */}
      <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
        <div className="flex flex-col items-start justify-between gap-3 sm:gap-4 lg:flex-row lg:items-center">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold sm:text-base">
              <span className="bg-gradient-custom flex size-8 items-center justify-center rounded-lg text-[#04222A]">
                <Trophy className="size-4" weight="fill" />
              </span>
              Pagamentos por Clipador
            </h3>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
              Histórico completo de transações desta competição
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
            <Button
              variant="outline"
              className="h-9 flex-1 cursor-pointer rounded-xl sm:flex-none"
              onClick={handleCopyMissingPayments}
            >
              <Copy className="size-4" />
              <span className="hidden sm:inline">
                Copiar Pagamentos Faltantes
              </span>
              <span className="sm:hidden">Copiar Faltantes</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-9 shrink-0 cursor-pointer rounded-xl border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-400"
              title="Baixar CSV de pagamentos faltantes"
              onClick={handleDownloadMissingCsv}
            >
              <FileCsv className="size-4" weight="fill" />
            </Button>
            <Button
              className="btn-gradient-auth h-9 w-full cursor-pointer rounded-xl font-semibold sm:w-auto"
              onClick={() => setTransactionsDialogOpen(true)}
            >
              <Receipt className="size-4" weight="fill" />
              <span className="hidden sm:inline">Ver Todas as Transações</span>
              <span className="sm:hidden">Transações</span>
            </Button>
          </div>
        </div>

        <div className="border-border/60 overflow-hidden rounded-2xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-[40px] sm:w-[50px]">#</TableHead>
                <TableHead className="max-w-[120px] sm:max-w-[180px]">
                  Clipador
                </TableHead>
                <TableHead className="hidden max-w-[160px] xl:table-cell">
                  Email
                </TableHead>
                <TableHead className="hidden max-w-[120px] 2xl:table-cell">
                  CPF
                </TableHead>
                <TableHead className="hidden max-w-[120px] 2xl:table-cell">
                  PIX
                </TableHead>
                <TableHead className="w-[60px] text-center sm:w-[70px]">
                  Trans.
                </TableHead>
                <SortableHead
                  label="Total Ganho"
                  shortLabel="Total"
                  column="totalEarned"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  activeColor="text-emerald-500"
                />
                <SortableHead
                  label="Pago (PIX)"
                  shortLabel="PIX"
                  column="totalPaidViaPix"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  activeColor="text-cyan-500"
                />
                <SortableHead
                  label="Falta Pagar"
                  shortLabel="Falta"
                  column="remainingToPay"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  activeColor="text-red-500"
                />
                <TableHead className="w-[80px] sm:w-[110px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedClippers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center">
                    <div className="text-muted-foreground flex flex-col items-center justify-center gap-1.5 py-8">
                      <Wallet className="mb-1 size-10 opacity-40" weight="fill" />
                      <p className="text-sm font-medium">
                        Nenhum pagamento realizado ainda
                      </p>
                      <p className="text-xs">
                        Os pagamentos aparecerão aqui quando forem processados
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedClippers.map((clipper, index) => (
                  <TableRow
                    key={clipper.clipperProfileId}
                    className="hover:bg-muted/40"
                  >
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="flex size-7 items-center justify-center rounded-full p-0 text-xs tabular-nums sm:size-8"
                      >
                        {index + 1}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[120px] sm:max-w-[180px]">
                      <div className="flex min-w-0 flex-col overflow-hidden">
                        <span className="truncate text-sm font-semibold">
                          {clipper.clipperName}
                        </span>
                        {clipper.clipperArtisticName && (
                          <span className="text-muted-foreground truncate text-xs">
                            @{clipper.clipperArtisticName}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-[160px] xl:table-cell">
                      <span className="text-muted-foreground block truncate overflow-hidden text-sm">
                        {clipper.clipperEmail}
                      </span>
                    </TableCell>
                    <TableCell className="hidden max-w-[120px] 2xl:table-cell">
                      <span className="block truncate overflow-hidden font-mono text-sm">
                        {clipper.clipperCpf || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden max-w-[120px] 2xl:table-cell">
                      <span className="block truncate overflow-hidden font-mono text-sm">
                        {clipper.clipperPixKey || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-gradient-custom rounded-full border-0 text-xs font-bold text-[#04222A]">
                        {clipper.transactions.length}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-bold text-emerald-600 tabular-nums sm:text-base dark:text-emerald-400">
                        {formatCurrency(clipper.totalEarned)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-bold text-cyan-600 tabular-nums sm:text-base dark:text-cyan-400">
                        {formatCurrency(clipper.totalPaidViaPix)}
                      </span>
                      {clipper.pixRecords.length > 0 && (
                        <p className="text-muted-foreground mt-0.5 hidden text-[10px] sm:block">
                          {clipper.pixRecords.length} PIX
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {clipper.remainingToPay > 0 ? (
                        <span className="text-sm font-bold text-red-600 tabular-nums sm:text-base dark:text-red-400">
                          {formatCurrency(clipper.remainingToPay)}
                        </span>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1 rounded-full border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-600 sm:text-xs dark:text-emerald-400"
                        >
                          <CheckCircle className="size-3" weight="fill" />
                          <span className="hidden sm:inline">Quitado</span>
                          <span className="sm:hidden">OK</span>
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        className="btn-gradient-auth h-8 shrink-0 cursor-pointer rounded-xl font-semibold"
                        onClick={() => {
                          setSelectedClipper(clipper)
                          setIsDetailsOpen(true)
                        }}
                      >
                        <Eye className="size-3.5" weight="fill" />
                        <span className="hidden lg:inline">Detalhes</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ===== Regras de Premiação ===== */}
      {rankingRule && (
        <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold sm:text-base">
            <span className="bg-gradient-custom flex size-8 items-center justify-center rounded-lg text-[#04222A]">
              <Medal className="size-4" weight="fill" />
            </span>
            Regras de Premiação
          </h3>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
            {/* Ranking Diário */}
            {rankingRule.dailyEnabled && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Lightning
                    className="size-4.5 text-orange-500 dark:text-orange-400"
                    weight="fill"
                  />
                  <h4 className="text-base font-bold sm:text-lg">
                    Ranking Diário
                  </h4>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Prêmio Total/Dia:
                  </span>
                  <span className="font-bold text-orange-500 tabular-nums dark:text-orange-400">
                    {formatCurrency(rankingRule.dailyTotalPrize)}
                  </span>
                </div>
                <div className="border-border/60 bg-muted/30 rounded-xl border p-3">
                  <p className="text-muted-foreground mb-2 text-xs font-medium">
                    Tabela de Prêmios:
                  </p>
                  <div className="flex flex-col gap-1">
                    {dailyPrizeEntries.map(([position, value]) => (
                      <div
                        key={position}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground">
                          {position}º lugar:
                        </span>
                        <span className="font-semibold tabular-nums">
                          {formatCurrency(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Ranking Mensal */}
            {rankingRule.monthlyEnabled && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Trophy
                    className="size-4.5 text-violet-500 dark:text-violet-400"
                    weight="fill"
                  />
                  <h4 className="text-base font-bold sm:text-lg">
                    Ranking Mensal
                  </h4>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Prêmio Total/Mês:
                  </span>
                  <span className="font-bold text-violet-500 tabular-nums dark:text-violet-400">
                    {formatCurrency(rankingRule.monthlyTotalPrize)}
                  </span>
                </div>
                <div className="border-border/60 bg-muted/30 rounded-xl border p-3">
                  <p className="text-muted-foreground mb-2 text-xs font-medium">
                    Tabela de Prêmios:
                  </p>
                  <div className="flex flex-col gap-1">
                    {monthlyPrizeEntries.map(([position, value]) => (
                      <div
                        key={position}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground">
                          {position}º lugar:
                        </span>
                        <span className="font-semibold tabular-nums">
                          {formatCurrency(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          Dialog: Detalhes Financeiros do Clipador
          ============================================================ */}
      <Dialog
        open={isDetailsOpen}
        onOpenChange={(nextOpen) => {
          setIsDetailsOpen(nextOpen)
          if (!nextOpen) {
            setIsEditingPixKey(false)
            setEditPixKeyValue("")
          }
        }}
      >
        <DialogContent className="flex max-h-[90vh] w-[96vw] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-4xl">
          <DialogHeader className="border-border/60 shrink-0 border-b p-4 text-left sm:p-6">
            <DialogTitle className="flex items-center gap-2.5">
              <span className="bg-gradient-custom flex size-9 items-center justify-center rounded-xl text-[#04222A]">
                <Wallet className="size-4.5" weight="fill" />
              </span>
              Detalhes Financeiros Completos
            </DialogTitle>
            <DialogDescription>
              Histórico completo de transações e dados do clipador
            </DialogDescription>
          </DialogHeader>

          {selectedClipper && (
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-6">
              {/* Header do clipador */}
              <div className="border-brand-cyan/25 from-brand-cyan/10 not-dark:border-primary/25 not-dark:from-primary/10 rounded-2xl border bg-gradient-to-br to-transparent p-4 sm:p-5">
                <div className="flex flex-col items-start gap-4 sm:flex-row">
                  <span className="bg-gradient-custom flex size-14 shrink-0 items-center justify-center rounded-2xl text-[#04222A] sm:size-16">
                    <UsersThree className="size-7 sm:size-8" weight="fill" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xl font-bold sm:text-2xl">
                      {selectedClipper.clipperName}
                    </h3>
                    {selectedClipper.clipperArtisticName && (
                      <p className="text-brand-cyan not-dark:text-primary text-base font-semibold sm:text-lg">
                        @{selectedClipper.clipperArtisticName}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-row gap-4 sm:flex-col sm:gap-1 sm:text-right">
                    <div>
                      <p className="text-muted-foreground text-xs">
                        Total Ganho
                      </p>
                      <p className="text-2xl font-bold text-emerald-600 tabular-nums sm:text-3xl dark:text-emerald-400">
                        {formatCurrency(selectedClipper.totalEarned)}
                      </p>
                    </div>
                    {selectedClipper.remainingToPay > 0 && (
                      <div>
                        <p className="text-muted-foreground text-xs">
                          Falta Pagar
                        </p>
                        <p className="text-xl font-bold text-red-600 tabular-nums sm:text-2xl dark:text-red-400">
                          {formatCurrency(selectedClipper.remainingToPay)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Dados de contato e pagamento */}
              <div>
                <h4 className="mb-3 flex items-center gap-2 text-sm font-bold sm:text-base">
                  <span className="bg-gradient-custom flex size-7 items-center justify-center rounded-lg text-[#04222A]">
                    <Envelope className="size-4" weight="fill" />
                  </span>
                  Dados de Contato e Pagamento
                </h4>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <ContactTile
                    icon={<Envelope className="size-5" weight="fill" />}
                    label="Email"
                    value={selectedClipper.clipperEmail || "Não informado"}
                    accent="bg-sky-500/15 text-sky-600 dark:text-sky-400"
                  />
                  <ContactTile
                    icon={<Phone className="size-5" weight="fill" />}
                    label="Telefone"
                    value={selectedClipper.clipperPhone || "Não informado"}
                    accent="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  />
                  <ContactTile
                    icon={
                      <IdentificationCard className="size-5" weight="fill" />
                    }
                    label="CPF"
                    value={selectedClipper.clipperCpf || "Não informado"}
                    accent="bg-violet-500/15 text-violet-600 dark:text-violet-400"
                    mono
                  />

                  {/* Chave PIX com edição inline */}
                  <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/5 px-3.5 py-3">
                    {isEditingPixKey ? (
                      <div className="flex flex-col gap-2.5">
                        <div className="flex items-center gap-2">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                            <CurrencyDollar className="size-4" weight="bold" />
                          </span>
                          <p className="text-muted-foreground text-xs font-medium">
                            Editar Chave PIX
                          </p>
                        </div>
                        <Input
                          value={editPixKeyValue}
                          onChange={(e) => setEditPixKeyValue(e.target.value)}
                          placeholder="Digite a nova chave PIX..."
                          className="h-9 rounded-xl font-mono text-sm"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="h-8 flex-1 cursor-pointer rounded-lg bg-cyan-600 text-xs font-semibold text-white hover:bg-cyan-700"
                            disabled={
                              !editPixKeyValue.trim() ||
                              updateClipperPixKey.isPending
                            }
                            onClick={() =>
                              updateClipperPixKey.mutate({
                                clipperProfileId:
                                  selectedClipper.clipperProfileId,
                                pixKey: editPixKeyValue.trim(),
                              })
                            }
                          >
                            {updateClipperPixKey.isPending ? (
                              <>
                                <Spinner className="size-3.5 animate-spin" />
                                Salvando...
                              </>
                            ) : (
                              <>
                                <Check className="size-3.5" weight="bold" />
                                Salvar
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 cursor-pointer rounded-lg text-xs"
                            disabled={updateClipperPixKey.isPending}
                            onClick={() => {
                              setIsEditingPixKey(false)
                              setEditPixKeyValue("")
                            }}
                          >
                            <X className="size-3.5" />
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                          <CurrencyDollar className="size-5" weight="bold" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
                            Chave PIX
                          </p>
                          <p className="truncate font-mono text-sm font-medium">
                            {selectedClipper.clipperPixKey || "Não informado"}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground size-8 shrink-0 cursor-pointer rounded-lg p-0 transition-colors hover:text-cyan-500"
                          title="Editar chave PIX"
                          onClick={() => {
                            setEditPixKeyValue(
                              selectedClipper.clipperPixKey || "",
                            )
                            setIsEditingPixKey(true)
                          }}
                        >
                          <PencilSimple className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Resumo financeiro do clipador */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <StatTileMini
                  icon={<CurrencyDollar className="size-6 sm:size-7" weight="bold" />}
                  value={formatCurrency(selectedClipper.totalEarned)}
                  label="Total Ganho"
                  border="border-emerald-500/25"
                  from="from-emerald-500/10"
                  text="text-emerald-600 dark:text-emerald-400"
                />
                <StatTileMini
                  icon={<Receipt className="size-6 sm:size-7" weight="fill" />}
                  value={formatCurrency(selectedClipper.totalPaidViaPix)}
                  label="Pago via PIX"
                  border="border-cyan-500/25"
                  from="from-cyan-500/10"
                  text="text-cyan-600 dark:text-cyan-400"
                />
                <StatTileMini
                  icon={<Warning className="size-6 sm:size-7" weight="fill" />}
                  value={
                    selectedClipper.remainingToPay > 0
                      ? formatCurrency(selectedClipper.remainingToPay)
                      : "Quitado"
                  }
                  label="Falta Pagar"
                  border={
                    selectedClipper.remainingToPay > 0
                      ? "border-red-500/25"
                      : "border-emerald-500/25"
                  }
                  from={
                    selectedClipper.remainingToPay > 0
                      ? "from-red-500/10"
                      : "from-emerald-500/10"
                  }
                  text={
                    selectedClipper.remainingToPay > 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }
                />
                <StatTileMini
                  icon={<Pulse className="size-6 sm:size-7" weight="bold" />}
                  value={String(selectedClipper.transactions.length)}
                  label="Transações"
                  border="border-sky-500/25"
                  from="from-sky-500/10"
                  text="text-sky-600 dark:text-sky-400"
                />
                <StatTileMini
                  icon={<Trophy className="size-6 sm:size-7" weight="fill" />}
                  value={
                    selectedClipper.transactions.length > 0
                      ? formatCurrency(
                          selectedClipper.totalEarned /
                            selectedClipper.transactions.length,
                        )
                      : formatCurrency(0)
                  }
                  label="Média por Transação"
                  border="border-violet-500/25"
                  from="from-violet-500/10"
                  text="text-violet-600 dark:text-violet-400"
                  className="col-span-2 md:col-span-1"
                />
              </div>

              {/* Barra de progresso de pagamento */}
              {selectedClipper.totalEarned > 0 && (
                <div className="border-border/60 rounded-2xl border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-muted-foreground text-sm font-medium">
                      Progresso de Pagamento
                    </p>
                    <p className="text-sm font-bold tabular-nums">
                      {Math.min(100, Math.round(selectedPaidPercent))}%
                    </p>
                  </div>
                  <div className="bg-muted h-3 w-full overflow-hidden rounded-full">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500 ease-out",
                        selectedClipper.remainingToPay <= 0
                          ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                          : "bg-gradient-to-r from-cyan-500 to-sky-400",
                      )}
                      style={{ width: `${selectedPaidPercent}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-muted-foreground text-[10px]">
                      Pago: {formatCurrency(selectedClipper.totalPaidViaPix)}
                    </p>
                    <p className="text-muted-foreground text-[10px]">
                      Total: {formatCurrency(selectedClipper.totalEarned)}
                    </p>
                  </div>
                </div>
              )}

              {/* Registros de PIX */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="flex items-center gap-2 text-sm font-bold sm:text-base">
                    <Receipt
                      className="size-4.5 text-cyan-600 dark:text-cyan-400"
                      weight="fill"
                    />
                    Registros de PIX
                    {selectedClipper.pixRecords.length > 0 && (
                      <Badge
                        variant="outline"
                        className="rounded-full border-cyan-500/30 bg-cyan-500/10 text-xs text-cyan-600 dark:text-cyan-400"
                      >
                        {selectedClipper.pixRecords.length}
                      </Badge>
                    )}
                  </h4>
                </div>

                {selectedClipper.pixRecords.length === 0 ? (
                  <div className="border-border/60 rounded-2xl border border-dashed py-8 text-center">
                    <Receipt
                      className="text-muted-foreground mx-auto mb-3 size-10 opacity-40"
                      weight="fill"
                    />
                    <p className="text-muted-foreground text-sm font-medium">
                      Nenhum PIX registrado ainda
                    </p>
                    <p className="text-muted-foreground/60 mt-1 text-xs">
                      Os registros de PIX aparecerão aqui quando forem
                      processados
                    </p>
                  </div>
                ) : (
                  <div className="flex max-h-[350px] flex-col gap-3 overflow-y-auto pr-1">
                    {[...selectedClipper.pixRecords]
                      .sort(
                        (a, b) =>
                          new Date(b.createdAt).getTime() -
                          new Date(a.createdAt).getTime(),
                      )
                      .map((pix) => {
                        const proofHref = pix.proofUrls[0] ?? pix.proofUrl
                        return (
                          <div
                            key={pix.id}
                            className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/5 to-transparent p-4 transition-all hover:border-cyan-500/40 hover:shadow-lg"
                          >
                            <div className="flex items-start gap-3 sm:gap-4">
                              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-sky-500/10 text-cyan-600 sm:size-12 dark:text-cyan-400">
                                <Receipt
                                  className="size-5 sm:size-6"
                                  weight="fill"
                                />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="mb-2 flex flex-col items-start justify-between gap-2 sm:flex-row">
                                  <div className="min-w-0 flex-1">
                                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                                      <Badge
                                        variant="outline"
                                        className="gap-1 rounded-full border-cyan-500/40 bg-cyan-500/10 text-[10px] text-cyan-600 sm:text-xs dark:text-cyan-400"
                                      >
                                        <Receipt className="size-3" />
                                        PIX
                                      </Badge>
                                      <Badge
                                        variant="outline"
                                        className="gap-1 rounded-full border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-600 sm:text-xs dark:text-emerald-400"
                                      >
                                        <CheckCircle
                                          className="size-3"
                                          weight="fill"
                                        />
                                        {pix.status === "COMPLETED"
                                          ? "Concluído"
                                          : pix.status}
                                      </Badge>
                                    </div>
                                    <p className="truncate text-xs font-semibold sm:text-sm">
                                      {pix.description}
                                    </p>
                                    <p className="text-muted-foreground mt-1 text-[10px] sm:text-xs">
                                      {formatDateTimeLong(pix.createdAt)}
                                    </p>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className="text-xl font-bold text-cyan-600 tabular-nums sm:text-2xl dark:text-cyan-400">
                                      {formatCurrency(pix.amount)}
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-3 grid grid-cols-1 gap-2 border-t border-cyan-500/10 pt-3 sm:grid-cols-3">
                                  <div>
                                    <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                                      Chave PIX
                                    </p>
                                    <p className="truncate font-mono text-xs">
                                      {pix.pixKey || "N/A"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                                      ID da Transação
                                    </p>
                                    <p className="font-mono text-xs">
                                      {pix.id.substring(0, 12)}...
                                    </p>
                                  </div>
                                  <div className="sm:text-right">
                                    <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                                      Comprovante
                                    </p>
                                    {proofHref ? (
                                      <a
                                        href={proofHref}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-cyan-600 underline underline-offset-2 transition-colors hover:text-cyan-500 dark:text-cyan-400 dark:hover:text-cyan-300"
                                      >
                                        <ArrowSquareOut className="size-3" />
                                        Ver comprovante
                                      </a>
                                    ) : (
                                      <p className="text-muted-foreground/60 text-xs">
                                        Não disponível
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>

              <Separator />

              {/* Histórico de transações (créditos) */}
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h4 className="flex items-center gap-2 text-sm font-bold sm:text-base">
                    <Coins
                      className="text-brand-mint not-dark:text-primary size-4.5"
                      weight="fill"
                    />
                    Histórico de Transações (Créditos)
                    {selectedClipper.transactions.length > 0 && (
                      <Badge
                        variant="outline"
                        className="rounded-full border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400"
                      >
                        {selectedClipper.transactions.length}
                      </Badge>
                    )}
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 cursor-pointer rounded-xl"
                    onClick={handleCopyIndividualReport}
                  >
                    <Copy className="size-3.5" />
                    <span className="hidden sm:inline">Copiar Relatório</span>
                  </Button>
                </div>

                {selectedClipper.transactions.length === 0 ? (
                  <div className="border-border/60 rounded-2xl border border-dashed py-8 text-center">
                    <Coins
                      className="text-muted-foreground mx-auto mb-3 size-10 opacity-40"
                      weight="fill"
                    />
                    <p className="text-muted-foreground text-sm font-medium">
                      Nenhuma transação registrada
                    </p>
                    <p className="text-muted-foreground/60 mt-1 text-xs">
                      As transações de prêmios aparecerão aqui
                    </p>
                  </div>
                ) : (
                  <div className="flex max-h-[400px] flex-col gap-3 overflow-y-auto pr-1">
                    {[...selectedClipper.transactions]
                      .sort(
                        (a, b) =>
                          new Date(b.createdAt).getTime() -
                          new Date(a.createdAt).getTime(),
                      )
                      .map((transaction) => {
                        const config = TX_DETAIL_TYPES[transaction.type]
                        const TypeIcon = config?.icon ?? CurrencyDollar
                        return (
                          <div
                            key={transaction.id}
                            className={cn(
                              "rounded-2xl border p-4 transition-all hover:shadow-lg",
                              config?.border ?? "border-border/60",
                            )}
                          >
                            <div className="flex items-start gap-3 sm:gap-4">
                              <span
                                className={cn(
                                  "flex size-10 shrink-0 items-center justify-center rounded-xl sm:size-12",
                                  config?.bg ?? "bg-muted/60",
                                  config?.color ?? "text-muted-foreground",
                                )}
                              >
                                <TypeIcon
                                  className="size-5 sm:size-6"
                                  weight="fill"
                                />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="mb-2 flex flex-col items-start justify-between gap-2 sm:flex-row">
                                  <div className="min-w-0 flex-1">
                                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "gap-1 rounded-full text-[10px] sm:text-xs",
                                          config?.bg,
                                          config?.border,
                                          config?.color,
                                        )}
                                      >
                                        <TypeIcon
                                          className="size-3"
                                          weight="fill"
                                        />
                                        {config?.label ?? transaction.type}
                                      </Badge>
                                      {transaction.status === "COMPLETED" && (
                                        <Badge
                                          variant="outline"
                                          className="gap-1 rounded-full border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-600 sm:text-xs dark:text-emerald-400"
                                        >
                                          <CheckCircle
                                            className="size-3"
                                            weight="fill"
                                          />
                                          Concluído
                                        </Badge>
                                      )}
                                      {transaction.rankingPosition != null && (
                                        <Badge
                                          variant="outline"
                                          className="gap-1 rounded-full border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-600 sm:text-xs dark:text-amber-400"
                                        >
                                          <Medal
                                            className="size-3"
                                            weight="fill"
                                          />
                                          {transaction.rankingPosition}º lugar
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="truncate text-xs font-semibold sm:text-sm">
                                      {transaction.description}
                                    </p>
                                    <p className="text-muted-foreground mt-1 text-[10px] sm:text-xs">
                                      {formatDateTimeLong(
                                        transaction.createdAt,
                                      )}
                                    </p>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className="text-xl font-bold text-emerald-600 tabular-nums sm:text-2xl dark:text-emerald-400">
                                      +{formatCurrency(transaction.amount)}
                                    </p>
                                  </div>
                                </div>

                                <div className="border-border/60 mt-3 grid grid-cols-2 gap-2 border-t pt-3">
                                  <div>
                                    <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                                      ID da Transação
                                    </p>
                                    <p className="font-mono text-xs">
                                      {transaction.id.substring(0, 12)}...
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                                      Status
                                    </p>
                                    <p className="text-xs font-semibold">
                                      {transaction.status}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="border-border/60 shrink-0 flex-col gap-2 border-t p-4 sm:flex-row sm:p-5">
            <Button
              className="cursor-pointer rounded-xl bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
              onClick={openPixDialog}
            >
              <Receipt className="size-4" weight="fill" />
              Registrar PIX
            </Button>
            <Button
              variant="outline"
              className="cursor-pointer rounded-xl"
              onClick={() => {
                setIsDetailsOpen(false)
                setSelectedClipper(null)
              }}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================
          Dialog: Registrar PIX
          ============================================================ */}
      <Dialog open={isPixDialogOpen} onOpenChange={setIsPixDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="size-5 text-emerald-500" weight="fill" />
              Registrar PIX
            </DialogTitle>
            <DialogDescription>
              Registre o pagamento via PIX para {selectedClipper?.clipperName}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {/* Valor */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="pix-amount">Valor (R$)</Label>
              <Input
                id="pix-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={pixAmount}
                onChange={(e) => setPixAmount(e.target.value)}
                className="h-10 rounded-xl tabular-nums"
              />
            </div>

            {/* Chave PIX */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="pix-key">Chave PIX</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-brand-cyan not-dark:text-primary h-auto cursor-pointer p-0 text-xs font-semibold hover:bg-transparent"
                  onClick={() => {
                    setUseCustomPixKey(!useCustomPixKey)
                    if (!useCustomPixKey) {
                      setCustomPixKey("")
                    }
                  }}
                >
                  {useCustomPixKey
                    ? "Usar chave cadastrada"
                    : "Usar outra chave"}
                </Button>
              </div>

              {!useCustomPixKey ? (
                <div className="border-border/60 bg-muted/40 rounded-xl border p-3">
                  <p className="truncate font-mono text-sm">
                    {selectedClipper?.clipperPixKey ||
                      "Nenhuma chave cadastrada"}
                  </p>
                </div>
              ) : (
                <Input
                  id="custom-pix-key"
                  type="text"
                  placeholder="Digite a chave PIX"
                  value={customPixKey}
                  onChange={(e) => setCustomPixKey(e.target.value)}
                  className="h-10 rounded-xl font-mono"
                />
              )}
            </div>

            {/* Comprovante */}
            <div className="flex flex-col gap-2">
              <Label>Comprovante de Pagamento *</Label>
              {!pixProofUrl ? (
                <div className="border-border/70 bg-muted/10 rounded-2xl border-2 border-dashed p-4 text-center">
                  <UploadButton
                    endpoint="pixProof"
                    onClientUploadComplete={(res) => {
                      const url = res?.[0]?.ufsUrl ?? res?.[0]?.url
                      if (url) {
                        setPixProofUrl(url)
                        setIsUploadingProof(false)
                        toast.success("Comprovante enviado com sucesso!")
                      }
                    }}
                    onUploadError={(error: Error) => {
                      setIsUploadingProof(false)
                      toast.error(`Erro ao enviar: ${error.message}`)
                    }}
                    onUploadBegin={() => {
                      setIsUploadingProof(true)
                    }}
                    appearance={{
                      button:
                        "ut-ready:bg-emerald-600 ut-ready:hover:bg-emerald-700 ut-uploading:bg-emerald-600/50 ut-uploading:cursor-not-allowed rounded-xl text-sm font-semibold cursor-pointer after:bg-transparent",
                      container: "w-full",
                      allowedContent: "text-muted-foreground text-xs mt-2",
                    }}
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <CheckCircle
                        className="size-5 shrink-0 text-emerald-500"
                        weight="fill"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          Comprovante anexado
                        </p>
                        <a
                          href={pixProofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground inline-flex items-center gap-1 text-xs hover:underline"
                        >
                          Ver comprovante
                          <ArrowSquareOut className="size-3" />
                        </a>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-8 shrink-0 cursor-pointer rounded-lg p-0 text-red-500 hover:bg-red-500/10 hover:text-red-400"
                      onClick={() => setPixProofUrl("")}
                    >
                      <Trash className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Aviso */}
            <div className="rounded-xl border border-orange-500/25 bg-orange-500/10 p-3">
              <p className="flex items-start gap-2 text-xs text-orange-600 dark:text-orange-400">
                <Warning className="mt-0.5 size-4 shrink-0" weight="fill" />
                <span>
                  O valor será debitado do saldo desta competição específica
                  após o registro.
                </span>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer rounded-xl"
              onClick={() => {
                setIsPixDialogOpen(false)
                setPixAmount("")
                setUseCustomPixKey(false)
                setCustomPixKey("")
                setPixProofUrl("")
                setIsUploadingProof(false)
              }}
            >
              Cancelar
            </Button>
            <Button
              className="cursor-pointer rounded-xl bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
              onClick={handlePixConfirm}
              disabled={
                !pixAmount ||
                parseFloat(pixAmount) <= 0 ||
                (!useCustomPixKey && !selectedClipper?.clipperPixKey) ||
                (useCustomPixKey && !customPixKey.trim()) ||
                !pixProofUrl ||
                isUploadingProof
              }
            >
              {isUploadingProof ? "Enviando..." : "Continuar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================
          AlertDialog: Confirmação do PIX
          ============================================================ */}
      <AlertDialog
        open={isPixConfirmDialogOpen}
        onOpenChange={setIsPixConfirmDialogOpen}
      >
        <AlertDialogContent className="rounded-3xl sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Warning className="size-5 text-orange-500" weight="fill" />
              Confirmar Registro de PIX
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a registrar um PIX com os seguintes dados:
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex flex-col gap-3">
            <div className="border-border/60 bg-muted/30 flex flex-col gap-2 rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground text-sm">Clipador:</span>
                <span className="truncate text-sm font-semibold">
                  {selectedClipper?.clipperName}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground text-sm">Valor:</span>
                <span className="text-sm font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                  {formatCurrency(parseFloat(pixAmount || "0"))}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground text-sm">
                  Chave PIX:
                </span>
                <span className="max-w-[200px] truncate font-mono text-sm">
                  {useCustomPixKey
                    ? customPixKey
                    : selectedClipper?.clipperPixKey}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground text-sm">
                  Competição:
                </span>
                <span className="max-w-[200px] truncate text-sm font-semibold">
                  {data.campaign.name}
                </span>
              </div>
              <div className="border-border/60 border-t pt-2">
                <span className="text-muted-foreground mb-2 block text-sm">
                  Comprovante:
                </span>
                <a
                  href={pixProofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-sky-600 hover:underline dark:text-sky-400"
                >
                  <CheckCircle className="size-4" weight="fill" />
                  Ver comprovante anexado
                  <ArrowSquareOut className="size-3" />
                </a>
              </div>
            </div>

            <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3">
              <p className="text-xs font-medium text-red-600 dark:text-red-400">
                ⚠️ Esta ação é irreversível! O valor será debitado
                imediatamente do saldo da competição.
              </p>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              className="cursor-pointer rounded-xl"
              onClick={() => {
                setIsPixConfirmDialogOpen(false)
                setIsPixDialogOpen(true)
              }}
            >
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer rounded-xl bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
              disabled={sendPixPayment.isPending}
              onClick={(e) => {
                e.preventDefault()
                handlePixSend()
              }}
            >
              {sendPixPayment.isPending ? (
                <>
                  <Spinner className="size-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <CheckCircle className="size-4" weight="fill" />
                  Confirmar Registro
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ============================================================
          Dialog: Todas as Transações
          ============================================================ */}
      <Dialog
        open={transactionsDialogOpen}
        onOpenChange={setTransactionsDialogOpen}
      >
        <DialogContent className="flex h-[95svh] w-[96vw] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:h-[90svh] sm:max-w-7xl">
          <DialogHeader className="border-border/60 shrink-0 border-b p-4 text-left sm:p-6">
            <DialogTitle className="flex items-center gap-2.5">
              <span className="bg-gradient-custom flex size-9 items-center justify-center rounded-xl text-[#04222A]">
                <Receipt className="size-4.5" weight="fill" />
              </span>
              Todas as Transações
            </DialogTitle>
            <DialogDescription>
              Histórico completo de transações da competição com filtros
              avançados
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            <div className="flex flex-col gap-3 p-4 sm:gap-4 sm:p-6">
              {/* Cards de resumo por tipo */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <TxStatCard
                  icon={<CurrencyDollar className="size-8" weight="bold" />}
                  label="Total Filtrado"
                  value={formatCurrency(transactionsStats.total)}
                  border="border-emerald-500/25"
                  from="from-emerald-500/10"
                  text="text-emerald-600 dark:text-emerald-400"
                />
                <TxStatCard
                  icon={<Receipt className="size-8" weight="fill" />}
                  label="Transações"
                  value={String(transactionsStats.count)}
                  border="border-sky-500/25"
                  from="from-sky-500/10"
                  text="text-sky-600 dark:text-sky-400"
                />
                <TxStatCard
                  icon={<Trophy className="size-8" weight="fill" />}
                  label="Prêmios"
                  value={String(transactionsStats.byType.PRIZE_CREDIT ?? 0)}
                  border="border-violet-500/25"
                  from="from-violet-500/10"
                  text="text-violet-600 dark:text-violet-400"
                />
                <TxStatCard
                  icon={<Lightning className="size-8" weight="fill" />}
                  label="Bônus"
                  value={String(transactionsStats.byType.BONUS ?? 0)}
                  border="border-amber-500/25"
                  from="from-amber-500/10"
                  text="text-amber-600 dark:text-amber-400"
                />
              </div>

              {/* Filtros */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <Label className="text-muted-foreground mb-1.5 block text-xs font-medium">
                    Filtrar por Clipador
                  </Label>
                  <Select
                    value={selectedClipperFilter}
                    onValueChange={setSelectedClipperFilter}
                  >
                    <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl">
                      <SelectValue placeholder="Todos os clipadores" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all">
                        <span className="flex items-center gap-2">
                          <UsersThree className="size-4" />
                          Todos os clipadores
                        </span>
                      </SelectItem>
                      {financialData.clippers.map((clipper) => (
                        <SelectItem
                          key={clipper.clipperProfileId}
                          value={clipper.clipperProfileId}
                        >
                          <span className="flex items-center gap-2">
                            <UserCheck className="size-4" />
                            {clipper.clipperName}
                            {clipper.clipperArtisticName && (
                              <span className="text-muted-foreground text-xs">
                                (@{clipper.clipperArtisticName})
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1">
                  <Label className="text-muted-foreground mb-1.5 block text-xs font-medium">
                    Tipo de Transação
                  </Label>
                  <Select
                    value={transactionTypeFilter}
                    onValueChange={setTransactionTypeFilter}
                  >
                    <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl">
                      <SelectValue placeholder="Todos os tipos" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all">
                        <span className="flex items-center gap-2">
                          <Funnel className="size-4" />
                          Todos os tipos
                        </span>
                      </SelectItem>
                      <SelectItem value="PRIZE_CREDIT">
                        <span className="flex items-center gap-2">
                          <Trophy
                            className="size-4 text-violet-500 dark:text-violet-400"
                            weight="fill"
                          />
                          Prêmios
                        </span>
                      </SelectItem>
                      <SelectItem value="BONUS">
                        <span className="flex items-center gap-2">
                          <Lightning
                            className="size-4 text-amber-500 dark:text-amber-400"
                            weight="fill"
                          />
                          Bônus
                        </span>
                      </SelectItem>
                      <SelectItem value="ADJUSTMENT">
                        <span className="flex items-center gap-2">
                          <GearSix
                            className="size-4 text-sky-500 dark:text-sky-400"
                            weight="fill"
                          />
                          Ajustes
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(selectedClipperFilter !== "all" ||
                  transactionTypeFilter !== "all") && (
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 cursor-pointer rounded-xl"
                      onClick={() => {
                        setSelectedClipperFilter("all")
                        setTransactionTypeFilter("all")
                      }}
                    >
                      <XCircle className="size-4" />
                      Limpar Filtros
                    </Button>
                  </div>
                )}
              </div>

              {/* Tabela de transações */}
              <div className="border-border/60 overflow-hidden rounded-2xl border">
                {filteredTransactions.length === 0 ? (
                  <div className="text-muted-foreground flex flex-col items-center justify-center py-12">
                    <Receipt className="mb-4 size-14 opacity-40" weight="fill" />
                    <p className="text-sm font-medium">
                      Nenhuma transação encontrada
                    </p>
                    <p className="mt-1 text-xs">
                      {selectedClipperFilter !== "all" ||
                      transactionTypeFilter !== "all"
                        ? "Tente ajustar os filtros"
                        : "Ainda não há transações nesta competição"}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="w-[50px]">#</TableHead>
                        <TableHead className="min-w-[110px] sm:min-w-[140px]">
                          Data/Hora
                        </TableHead>
                        <TableHead className="min-w-[140px] sm:min-w-[180px]">
                          Clipador
                        </TableHead>
                        <TableHead className="min-w-[200px] sm:min-w-[300px]">
                          Descrição
                        </TableHead>
                        <TableHead className="min-w-[110px] sm:w-[120px]">
                          Tipo
                        </TableHead>
                        <TableHead className="w-[70px] text-center sm:w-[80px]">
                          Pos.
                        </TableHead>
                        <TableHead className="min-w-[110px] text-right sm:w-[140px]">
                          Valor
                        </TableHead>
                        <TableHead className="min-w-[90px] sm:w-[100px]">
                          Status
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.map((tx, index) => {
                        const config =
                          TX_TABLE_TYPES[tx.type] ??
                          TX_TABLE_TYPES.ADJUSTMENT!
                        const TypeIcon = config.icon
                        return (
                          <TableRow key={tx.id} className="hover:bg-muted/40">
                            <TableCell className="text-muted-foreground text-xs font-medium sm:text-sm">
                              {index + 1}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-xs font-medium whitespace-nowrap sm:text-sm">
                                  {format(
                                    new Date(tx.createdAt),
                                    "dd/MM/yyyy",
                                    { locale: ptBR },
                                  )}
                                </span>
                                <span className="text-muted-foreground text-[10px] sm:text-xs">
                                  {format(new Date(tx.createdAt), "HH:mm", {
                                    locale: ptBR,
                                  })}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex min-w-0 flex-col">
                                <span className="truncate text-xs font-semibold sm:text-sm">
                                  {tx.clipperName}
                                </span>
                                {tx.clipperArtisticName && (
                                  <span className="text-muted-foreground truncate text-[10px] sm:text-xs">
                                    @{tx.clipperArtisticName}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="line-clamp-2 text-xs sm:text-sm">
                                {tx.description}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "gap-1 rounded-full px-1.5 py-0.5 text-[10px] whitespace-nowrap sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-xs",
                                  config.bg,
                                  config.border,
                                )}
                              >
                                <TypeIcon
                                  className={cn(
                                    "size-3 sm:size-3.5",
                                    config.color,
                                  )}
                                  weight="fill"
                                />
                                <span className={config.color}>
                                  {config.label}
                                </span>
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {tx.rankingPosition ? (
                                <Badge
                                  variant="outline"
                                  className="flex size-8 items-center justify-center rounded-full p-0 text-[10px] tabular-nums sm:size-10 sm:text-xs"
                                >
                                  {tx.rankingPosition}º
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">
                                  -
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-sm font-bold whitespace-nowrap text-emerald-600 tabular-nums sm:text-base dark:text-emerald-400">
                                {formatCurrency(tx.amount)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "gap-1 rounded-full text-[10px] whitespace-nowrap sm:text-xs",
                                  tx.status === "COMPLETED"
                                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                                )}
                              >
                                {tx.status === "COMPLETED" ? (
                                  <CheckCircle
                                    className="size-3"
                                    weight="fill"
                                  />
                                ) : (
                                  <Clock className="size-3" weight="fill" />
                                )}
                                {tx.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </div>

          {/* Footer fixo */}
          <div className="border-border/60 bg-background/85 shrink-0 border-t px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4">
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
              <Button
                variant="outline"
                size="sm"
                className="h-9 cursor-pointer rounded-xl"
                onClick={handleCopyFilteredTransactions}
              >
                <Copy className="size-4" />
                <span className="hidden sm:inline">Copiar Transações</span>
                <span className="sm:hidden">Copiar</span>
              </Button>
              <Button
                size="sm"
                className="btn-gradient-auth h-9 w-full cursor-pointer rounded-xl font-semibold sm:w-auto"
                onClick={() => setTransactionsDialogOpen(false)}
              >
                Fechar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ============================================================
   Blocos auxiliares
   ============================================================ */

function SortableHead({
  label,
  shortLabel,
  column,
  sortBy,
  sortDir,
  onSort,
  activeColor,
}: {
  label: string
  shortLabel: string
  column: FinancialSortKey
  sortBy: FinancialSortKey
  sortDir: "asc" | "desc"
  onSort: (column: FinancialSortKey) => void
  activeColor: string
}) {
  return (
    <TableHead
      className="hover:text-foreground min-w-[90px] cursor-pointer text-right transition-colors select-none sm:min-w-[110px]"
      onClick={() => onSort(column)}
    >
      <div className="flex items-center justify-end gap-1">
        <span className="hidden sm:inline">{label}</span>
        <span className="text-xs sm:hidden">{shortLabel}</span>
        <span className="flex flex-col">
          <CaretUp
            className={cn(
              "-mb-0.5 size-3",
              sortBy === column && sortDir === "asc"
                ? activeColor
                : "text-muted-foreground/30",
            )}
            weight="bold"
          />
          <CaretDown
            className={cn(
              "-mt-0.5 size-3",
              sortBy === column && sortDir === "desc"
                ? activeColor
                : "text-muted-foreground/30",
            )}
            weight="bold"
          />
        </span>
      </div>
    </TableHead>
  )
}

function ContactTile({
  icon,
  label,
  value,
  accent,
  mono,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent: string
  mono?: boolean
}) {
  return (
    <div className="border-border/60 bg-muted/20 flex items-center gap-3 rounded-2xl border px-3.5 py-3">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          accent,
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
          {label}
        </p>
        <p
          className={cn("truncate text-sm font-medium", mono && "font-mono")}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

function StatTileMini({
  icon,
  value,
  label,
  border,
  from,
  text,
  className,
}: {
  icon: React.ReactNode
  value: string
  label: string
  border: string
  from: string
  text: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-2xl border bg-gradient-to-br to-transparent px-3 py-3.5 text-center",
        border,
        from,
        className,
      )}
    >
      <span className={text}>{icon}</span>
      <span
        className={cn(
          "max-w-full truncate text-lg font-bold tabular-nums sm:text-xl",
          text,
        )}
      >
        {value}
      </span>
      <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
        {label}
      </span>
    </div>
  )
}

function TxStatCard({
  icon,
  label,
  value,
  border,
  from,
  text,
}: {
  icon: React.ReactNode
  label: string
  value: string
  border: string
  from: string
  text: string
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-gradient-to-br to-transparent p-4",
        border,
        from,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground mb-1 text-xs">{label}</p>
          <p
            className={cn(
              "truncate text-xl font-bold tabular-nums sm:text-2xl",
              text,
            )}
          >
            {value}
          </p>
        </div>
        <span className={cn("shrink-0 opacity-50", text)}>{icon}</span>
      </div>
    </div>
  )
}
