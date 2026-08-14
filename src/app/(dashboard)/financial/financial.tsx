"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowCounterClockwise,
  ArrowSquareOut,
  ArrowsOut,
  CaretDown,
  CaretUp,
  Check,
  CheckCircle,
  CircleNotch,
  Clock,
  Coins,
  CurrencyDollar,
  DownloadSimple,
  Eye,
  EyeSlash,
  Info,
  MagnifyingGlass,
  PencilSimple,
  PixLogo,
  Prohibit,
  Receipt,
  Sparkle,
  TrendDown,
  TrendUp,
  Trophy,
  Wallet,
  WarningCircle,
  X,
  type Icon,
} from "@phosphor-icons/react"
import { format, startOfDay, subDays } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"
import { toast } from "sonner"

import { WalletPaydayHeroViz, WalletPaydayHeroVizSkeleton } from "@/components/financial/wallet-payday-hero-viz"
import { CountUp, formatCompact } from "@/components/shared/count-up"
import { DarkScope } from "@/components/shared/dark-scope"
import { Reveal } from "@/components/shared/reveal"
import {
  Bone,
  ChartSkeleton,
  DonutSkeleton,
  HeroSkeleton,
  ListRowsSkeleton,
  StatTilesGridSkeleton,
  ToolbarSkeleton,
} from "@/components/shared/skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { useMaskedCurrency } from "@/contexts/financial-visibility-context"
import {
  PIX_KEY_TYPE_OPTIONS,
  inferPixKeyType,
  type PixKeyType,
} from "@/lib/pix-key"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

/* ===== Cores dos gráficos (paridade com o original) ===== */
const LINE_GREEN = "#22c55e"
const PIE_PRIZES = "#facc15"
const PIE_BONUSES = "#a855f7"
const PIE_ADJUSTMENTS = "#3b82f6"
const BAR_ORANGE = "#f97316"

/* ===== Ícone/estilo por tipo de ganho (com REFUND e fallback — correção
   do original, que deixava um quadrado vazio para tipos desconhecidos) ===== */
interface IncomeTypeStyle {
  icon: Icon
  box: string
  text: string
}

const incomeTypeConfig: Record<string, IncomeTypeStyle> = {
  PRIZE_CREDIT: {
    icon: Trophy,
    box: "bg-yellow-500/10",
    text: "text-yellow-500 dark:text-yellow-400",
  },
  BONUS: {
    icon: Sparkle,
    box: "bg-purple-500/10",
    text: "text-purple-500 dark:text-purple-400",
  },
  ADJUSTMENT: {
    icon: CurrencyDollar,
    box: "bg-blue-500/10",
    text: "text-blue-500 dark:text-blue-400",
  },
  REFUND: {
    icon: ArrowCounterClockwise,
    box: "bg-cyan-500/10",
    text: "text-cyan-600 dark:text-cyan-400",
  },
}

const fallbackIncomeType: IncomeTypeStyle = {
  icon: Coins,
  box: "bg-muted/50",
  text: "text-muted-foreground",
}

/* ===== Estilo por status de saque (com CANCELLED e FAILED — correção
   do original, que não cobria esses estados) ===== */
interface WithdrawalStatusStyle {
  label: string
  icon: Icon
  iconWeight: "fill" | "bold"
  row: string
  iconBox: string
  iconText: string
  badge: string
  amount: string
}

const withdrawalStatusConfig: Record<string, WithdrawalStatusStyle> = {
  COMPLETED: {
    label: "Concluído",
    icon: CheckCircle,
    iconWeight: "fill",
    row: "border-green-500/25 bg-green-500/5",
    iconBox: "bg-green-500/10",
    iconText: "text-green-600 dark:text-green-400",
    badge: "border-green-500/40 text-green-600 dark:text-green-400",
    amount: "text-orange-600 dark:text-orange-400",
  },
  PROCESSING: {
    label: "Processando",
    icon: Clock,
    iconWeight: "fill",
    row: "border-yellow-500/25 bg-yellow-500/5",
    iconBox: "bg-yellow-500/10",
    iconText: "text-yellow-600 dark:text-yellow-400",
    badge: "border-yellow-500/40 text-yellow-600 dark:text-yellow-400",
    amount: "text-yellow-600 dark:text-yellow-400",
  },
  PENDING: {
    label: "Pendente",
    icon: Clock,
    iconWeight: "fill",
    row: "border-yellow-500/25 bg-yellow-500/5",
    iconBox: "bg-yellow-500/10",
    iconText: "text-yellow-600 dark:text-yellow-400",
    badge: "border-yellow-500/40 text-yellow-600 dark:text-yellow-400",
    amount: "text-yellow-600 dark:text-yellow-400",
  },
  REJECTED: {
    label: "Rejeitado",
    icon: X,
    iconWeight: "bold",
    row: "border-red-500/25 bg-red-500/5",
    iconBox: "bg-red-500/10",
    iconText: "text-red-600 dark:text-red-400",
    badge: "border-red-500/40 text-red-600 dark:text-red-400",
    amount: "text-red-600 dark:text-red-400",
  },
  CANCELLED: {
    label: "Cancelado",
    icon: Prohibit,
    iconWeight: "bold",
    row: "border-border/60 bg-muted/20",
    iconBox: "bg-muted/50",
    iconText: "text-muted-foreground",
    badge: "border-border text-muted-foreground",
    amount: "text-muted-foreground",
  },
  FAILED: {
    label: "Falhou",
    icon: WarningCircle,
    iconWeight: "fill",
    row: "border-red-500/25 bg-red-500/5",
    iconBox: "bg-red-500/10",
    iconText: "text-red-600 dark:text-red-400",
    badge: "border-red-500/40 text-red-600 dark:text-red-400",
    amount: "text-red-600 dark:text-red-400",
  },
}

/* ===== Helpers ===== */

/** BRL com centavos e Math.abs — mesmo formato do original (e do CSV). */
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(Math.abs(value))

const formatDateShort = (date: Date) =>
  format(date, "dd/MM/yy HH:mm", { locale: ptBR })

/** Campo CSV com escape correto (aspas duplas) — correção do original. */
const escapeCsvField = (field: string) => `"${field.replace(/"/g, '""')}"`

/** Rótulo em pt-BR do tipo de chave PIX. */
const pixKeyTypeLabel = (type: PixKeyType) =>
  PIX_KEY_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? "Chave"

/** Chave PIX parcialmente oculta: dá para conferir sem expor o dado inteiro. */
const maskPixKeyValue = (value: string, type: PixKeyType): string => {
  const digits = value.replace(/\D/g, "")

  switch (type) {
    case "CPF":
      return digits.length === 11
        ? `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`
        : "•••"
    case "CNPJ":
      return digits.length === 14
        ? `**.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-**`
        : "•••"
    case "PHONE": {
      const local =
        digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits
      return local.length >= 6
        ? `(${local.slice(0, 2)}) *****-${local.slice(-4)}`
        : "•••"
    }
    case "EMAIL": {
      const at = value.indexOf("@")
      if (at < 1) return "•••"
      const local = value.slice(0, at)
      const stars = "*".repeat(Math.min(Math.max(local.length - 2, 1), 4))
      return `${local.slice(0, 2)}${stars}${value.slice(at)}`
    }
    case "EVP":
      return value.length >= 12
        ? `${value.slice(0, 8)}-****-****-****-${value.slice(-4).padStart(12, "*")}`
        : "•••"
  }
}

export default function Financial() {
  const { isVisible, maskBRL } = useMaskedCurrency()

  const [searchTerm, setSearchTerm] = React.useState("")
  const [showAllIncome, setShowAllIncome] = React.useState(false)
  const [showAllWithdrawals, setShowAllWithdrawals] = React.useState(false)
  const [selectedProof, setSelectedProof] = React.useState<string | null>(null)

  // ===== Queries =====
  const { data: userData, isLoading: isLoadingUser } =
    api.user.getCurrentUser.useQuery()
  const clipperProfileId = userData?.clipperProfile?.id

  const { data: wallet, isLoading: isLoadingWallet } =
    api.clipper.getWallet.useQuery(
      { clipperProfileId: clipperProfileId ?? "" },
      { enabled: !!clipperProfileId },
    )

  const { data: walletStats, isLoading: isLoadingWalletStats } =
    api.clipper.getWalletStats.useQuery(
      { clipperProfileId: clipperProfileId ?? "" },
      { enabled: !!clipperProfileId },
    )

  const { data: transactionsData, isLoading: isLoadingTransactions } =
    api.clipper.getTransactions.useQuery(
      { clipperProfileId: clipperProfileId ?? "", page: 1, pageSize: 500 },
      { enabled: !!clipperProfileId },
    )

  const allTransactions = React.useMemo(
    () => transactionsData?.transactions ?? [],
    [transactionsData?.transactions],
  )

  // ===== Derivações (idênticas ao original) =====
  const incomeTransactions = React.useMemo(
    () => allTransactions.filter((t) => t.amount > 0),
    [allTransactions],
  )

  const withdrawalTransactions = React.useMemo(
    () => allTransactions.filter((t) => t.amount <= 0),
    [allTransactions],
  )

  const totalIncome = wallet?.totalEarned ?? 0
  const completedWithdrawalsCount = walletStats?.completedWithdrawals ?? 0
  const totalWithdrawals = wallet?.totalWithdrawn ?? 0
  const pendingAmount = wallet?.pendingWithdraw ?? 0
  const totalIncomeTransactions = walletStats?.totalCreditsCount ?? 0

  // Ganhos por dia — últimos 7 dias
  const chartData = React.useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), 6 - i)
        const dayStart = startOfDay(date)
        const dayEnd = new Date(dayStart)
        dayEnd.setHours(23, 59, 59, 999)

        const dayIncome = incomeTransactions
          .filter((t) => {
            const tDate = new Date(t.createdAt)
            return tDate >= dayStart && tDate <= dayEnd
          })
          .reduce((sum, t) => sum + t.amount, 0)

        return {
          date: format(date, "dd/MM", { locale: ptBR }),
          ganhos: dayIncome,
        }
      }),
    [incomeTransactions],
  )

  // Distribuição por tipo de ganho (só fatias > 0)
  const pieData = React.useMemo(() => {
    const sumByType = (type: string) =>
      incomeTransactions
        .filter((t) => t.type === type)
        .reduce((sum, t) => sum + t.amount, 0)

    const prizes = sumByType("PRIZE_CREDIT")
    const bonuses = sumByType("BONUS")
    const adjustments = sumByType("ADJUSTMENT")

    const data: Array<{ name: string; value: number; color: string }> = []
    if (prizes > 0) data.push({ name: "Prêmios", value: prizes, color: PIE_PRIZES })
    if (bonuses > 0) data.push({ name: "Bônus", value: bonuses, color: PIE_BONUSES })
    if (adjustments > 0)
      data.push({ name: "Ajustes", value: adjustments, color: PIE_ADJUSTMENTS })

    return data
  }, [incomeTransactions])

  const pieTotal = React.useMemo(
    () => pieData.reduce((sum, entry) => sum + entry.value, 0),
    [pieData],
  )

  // Saques concluídos por mês — últimos 3 meses
  const withdrawalChartData = React.useMemo(() => {
    const months = Array.from({ length: 3 }, (_, i) => {
      const date = new Date()
      date.setMonth(date.getMonth() - (2 - i))
      return date
    })

    return months.map((date) => {
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)
      monthEnd.setHours(23, 59, 59, 999)

      const monthWithdrawals = withdrawalTransactions
        .filter((t) => {
          if (t.status !== "COMPLETED") return false
          const tDate = new Date(t.createdAt)
          return tDate >= monthStart && tDate <= monthEnd
        })
        .reduce((sum, t) => sum + Math.abs(t.amount), 0)

      return {
        month: format(date, "MMM", { locale: ptBR }),
        value: monthWithdrawals,
      }
    })
  }, [withdrawalTransactions])

  // ===== Filtro de busca (client-side, como o original) =====
  const filteredIncome = React.useMemo(
    () =>
      incomeTransactions.filter((t) =>
        t.description.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [incomeTransactions, searchTerm],
  )

  const filteredWithdrawals = React.useMemo(
    () =>
      withdrawalTransactions.filter((t) =>
        t.description.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [withdrawalTransactions, searchTerm],
  )

  const displayedIncome = showAllIncome
    ? filteredIncome
    : filteredIncome.slice(0, 5)
  const displayedWithdrawals = showAllWithdrawals
    ? filteredWithdrawals
    : filteredWithdrawals.slice(0, 5)

  const availableBalance = wallet?.balance ?? 0

  // ===== Chave PIX do clipador (o banco guarda só a chave; o tipo é inferido) =====
  const pixKey = userData?.clipperProfile?.pixKey?.trim() ?? ""
  const pixKeyType = inferPixKeyType(pixKey)

  // ===== Export CSV (valores sempre em claro, com escape correto) =====
  const handleExportCSV = () => {
    if (!allTransactions.length) {
      toast.error("Nenhuma transação para exportar")
      return
    }

    const rows = [
      [
        "Data",
        "Tipo",
        "Descrição",
        "Status",
        "Valor",
        "Saldo Anterior",
        "Saldo Posterior",
      ],
      ...allTransactions.map((t) => [
        format(new Date(t.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR }),
        t.type,
        t.description,
        t.status,
        formatCurrency(t.amount),
        formatCurrency(t.balanceBefore),
        formatCurrency(t.balanceAfter),
      ]),
    ]

    const csv = rows
      .map((row) => row.map(escapeCsvField).join(","))
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `transacoes-${format(new Date(), "yyyy-MM-dd")}.csv`
    a.click()
    URL.revokeObjectURL(url)

    toast.success("Relatório exportado!", {
      description: "O arquivo CSV foi baixado com sucesso",
    })
  }

  /** Eixo Y monetário compacto, respeitando o olhinho. */
  const formatAxisBRL = (value: number) =>
    isVisible ? `R$ ${formatCompact(value)}` : "•••"

  const isLoading =
    isLoadingUser ||
    (!!clipperProfileId &&
      (isLoadingWallet || isLoadingWalletStats || isLoadingTransactions))

  // ===== Skeleton espelhando o layout real =====
  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
        <HeroSkeleton stats={2} viz={<WalletPaydayHeroVizSkeleton />} />
        <StatTilesGridSkeleton count={4} className="grid-cols-1 md:grid-cols-2 xl:grid-cols-4" />
        <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
          <div className="flex items-center gap-2.5">
            <Bone className="size-8 rounded-lg" />
            <div className="flex flex-col gap-1.5">
              <Bone delay={60} className="h-4 w-40" />
              <Bone delay={120} className="h-3 w-56 max-w-full rounded-full" />
            </div>
          </div>
          <Bone delay={180} className="h-14 w-full rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
          <ChartSkeleton className="md:col-span-4" heightClass="h-56" bars={7} />
          <DonutSkeleton className="md:col-span-3" />
        </div>
        <ToolbarSkeleton buttons={0} />
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Bone className="h-9 w-36 rounded-xl" />
            <Bone delay={100} className="h-9 w-36 rounded-xl" />
          </div>
          <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
            <div className="flex items-center gap-2.5">
              <Bone className="size-8 rounded-lg" />
              <div className="flex flex-col gap-1.5">
                <Bone delay={60} className="h-4 w-40" />
                <Bone delay={120} className="h-3 w-56 rounded-full" />
              </div>
            </div>
            <ListRowsSkeleton rows={5} />
          </div>
        </div>
      </div>
    )
  }

  // ===== Não-clipador: estado vazio elegante (correção do original,
  // que deixava o usuário preso no skeleton para sempre) =====
  if (!clipperProfileId) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 py-6 sm:px-6 sm:py-8">
        <div className="glass-card flex flex-col items-center gap-4 rounded-3xl py-20 text-center">
          <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
            <Wallet className="size-6" weight="fill" />
          </span>
          <div className="px-4">
            <p className="text-base font-bold">Área exclusiva para clipadores</p>
            <p className="text-muted-foreground mt-1 text-sm">
              A carteira financeira está disponível apenas para contas de
              clipador.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero: faixa dark-petrol fixa com a viz "Dia de Pagamento" ===== */}
      <DarkScope className="contents">
        <Reveal immediate>
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#050f1c] to-[#0a1c2b] p-6 ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_18%,transparent)] sm:p-8 lg:p-10">
            {/* Glows da marca */}
            <span
              aria-hidden
              className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_16%,transparent)] blur-3xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-24 -left-10 size-72 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_12%,transparent)] blur-3xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-cyan)_60%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_40%,transparent)] to-transparent"
            />

            <WalletPaydayHeroViz />

            <div className="relative z-10 flex max-w-2xl flex-col gap-4">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] text-[#8aa3b3] uppercase">
                <span className="bg-gradient-custom size-1.5 rounded-full" />
                Clipfy League · Financeiro
              </span>

              <h1 className="text-3xl leading-tight font-bold tracking-tight text-[#ecf7f9] sm:text-4xl lg:text-[2.75rem]">
                Acompanhe seus{" "}
                <span className="text-gradient">ganhos e saques</span>
              </h1>

              <p className="max-w-xl text-sm leading-relaxed text-[#8aa3b3] sm:text-base">
                Saldo, histórico de prêmios e retiradas da sua carteira — tudo
                em um lugar.
              </p>

              <div className="mt-1 flex flex-wrap items-center gap-2.5">
                <Button
                  variant="outline"
                  onClick={handleExportCSV}
                  disabled={!allTransactions.length}
                  className="h-11 cursor-pointer rounded-xl border-white/12 bg-white/[0.06] px-5 font-semibold text-[#ecf7f9] hover:bg-white/12 hover:text-white"
                >
                  <DownloadSimple className="size-4.5" weight="bold" />
                  Exportar
                </Button>
              </div>
            </div>
          </section>
        </Reveal>
      </DarkScope>

      {/* ===== Resumo: 4 cards ===== */}
      <Reveal immediate delayMs={60}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            icon={<Wallet className="size-4" weight="fill" />}
            chipClass="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            label="Saldo Disponível"
            value={availableBalance}
            valueClass="text-emerald-600 dark:text-emerald-400"
            sub="Pronto para saque"
          />
          <SummaryCard
            icon={<TrendUp className="size-4" weight="bold" />}
            chipClass="bg-green-500/15 text-green-600 dark:text-green-400"
            label="Total Recebido"
            value={totalIncome}
            delayMs={120}
            sub={`+${totalIncomeTransactions} transações`}
            subClass="text-green-600 dark:text-green-400"
          />
          <SummaryCard
            icon={<TrendDown className="size-4" weight="bold" />}
            chipClass="bg-orange-500/15 text-orange-600 dark:text-orange-400"
            label="Total Sacado"
            value={totalWithdrawals}
            delayMs={240}
            sub={`${completedWithdrawalsCount} saques concluídos`}
            subClass="text-orange-600 dark:text-orange-400"
          />
          <SummaryCard
            icon={<Clock className="size-4" weight="fill" />}
            chipClass="bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
            label="Em Processamento"
            value={pendingAmount}
            valueClass="text-yellow-600 dark:text-yellow-400"
            delayMs={360}
            sub="Aguardando"
          />
        </div>
      </Reveal>

      {/* ===== Chave PIX cadastrada ===== */}
      <Reveal immediate delayMs={90}>
        <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
          <ChartCardHeader
            icon={<PixLogo className="size-4" weight="fill" />}
            chipClass="bg-teal-500/15 text-teal-600 dark:text-teal-400"
            title="Chave PIX cadastrada"
            description="Destino dos pagamentos da sua carteira"
          />

          {pixKey ? (
            <>
              <div className="border-border/60 bg-muted/20 flex flex-col gap-3 rounded-2xl border px-3.5 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <Badge
                    variant="outline"
                    className="shrink-0 rounded-full border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-300"
                  >
                    {pixKeyTypeLabel(pixKeyType)}
                  </Badge>
                  <p className="min-w-0 flex-1 truncate font-mono text-sm font-semibold sm:text-base">
                    {maskPixKeyValue(pixKey, pixKeyType)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-9 shrink-0 cursor-pointer rounded-xl font-semibold"
                >
                  <Link href="/settings/profile#chave-pix">
                    <PencilSimple className="size-3.5" />
                    Alterar
                  </Link>
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Por segurança, mostramos a chave parcialmente. Confira o final
                antes de solicitar um pagamento.
              </p>
            </>
          ) : (
            <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 px-3.5 py-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
                  <WarningCircle
                    className="size-5 text-amber-600 dark:text-amber-400"
                    weight="fill"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    Nenhuma chave PIX cadastrada
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Sem chave PIX não é possível receber os prêmios da carteira.
                  </p>
                </div>
              </div>
              <Button
                asChild
                className="btn-gradient-auth h-9 shrink-0 cursor-pointer rounded-xl font-semibold"
              >
                <Link href="/settings/profile#chave-pix">
                  Cadastrar no perfil
                </Link>
              </Button>
            </div>
          )}
        </div>
      </Reveal>

      {/* ===== Gráficos: linha (7 dias) + donut (distribuição) ===== */}
      <Reveal immediate delayMs={120}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
          {/* Ganhos nos últimos 7 dias */}
          <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6 md:col-span-4">
            <ChartCardHeader
              icon={<TrendUp className="size-4" weight="bold" />}
              chipClass="bg-green-500/15 text-green-600 dark:text-green-400"
              title="Ganhos nos Últimos 7 Dias"
              description="Evolução diária dos seus ganhos"
            />
            <div className="relative">
              <div
                className={cn(
                  "h-[220px] transition-all duration-300",
                  !isVisible && "pointer-events-none blur-md select-none",
                )}
              >
                {incomeTransactions.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid
                        vertical={false}
                        stroke="color-mix(in oklab, var(--foreground) 7%, transparent)"
                      />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tickMargin={10}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                      />
                      <YAxis
                        tickFormatter={formatAxisBRL}
                        axisLine={false}
                        tickLine={false}
                        width={56}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                      />
                      <RechartsTooltip
                        content={<MoneyTooltip />}
                        cursor={{
                          stroke:
                            "color-mix(in oklab, var(--foreground) 22%, transparent)",
                          strokeDasharray: "4 4",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="ganhos"
                        name="Ganhos"
                        stroke={LINE_GREEN}
                        strokeWidth={2}
                        strokeLinecap="round"
                        dot={{ r: 3, fill: LINE_GREEN, strokeWidth: 0 }}
                        activeDot={{
                          r: 4.5,
                          fill: LINE_GREEN,
                          stroke: "var(--card)",
                          strokeWidth: 2,
                        }}
                        animationDuration={650}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                    Sem dados para exibir
                  </div>
                )}
              </div>
              {!isVisible && <MaskedOverlay />}
            </div>
          </div>

          {/* Distribuição dos ganhos */}
          <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6 md:col-span-3">
            <ChartCardHeader
              icon={<Coins className="size-4" weight="fill" />}
              chipClass="bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
              title="Distribuição dos Ganhos"
              description="Por tipo de remuneração"
            />
            <div className="relative flex-1">
              <div
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-5 transition-all duration-300",
                  !isVisible && "pointer-events-none blur-md select-none",
                )}
              >
                {pieData.length > 0 ? (
                  <>
                    <div className="relative size-40 shrink-0 sm:size-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <RechartsTooltip
                            content={<DonutTooltip total={pieTotal} />}
                          />
                          <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius="64%"
                            outerRadius="92%"
                            paddingAngle={3}
                            cornerRadius={4}
                            stroke="var(--card)"
                            strokeWidth={2}
                            animationDuration={650}
                          >
                            {pieData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg font-bold tabular-nums">
                          {isVisible
                            ? `R$ ${formatCompact(pieTotal)}`
                            : "••••••"}
                        </span>
                        <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
                          recebido
                        </span>
                      </div>
                    </div>

                    {/* Legenda com rótulos e valores (identidade nunca só pela cor) */}
                    <div className="flex w-full flex-col gap-2.5">
                      {pieData.map((entry) => {
                        const pct = (entry.value / pieTotal) * 100
                        return (
                          <div key={entry.name} className="flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-3 text-[13px]">
                              <span className="text-foreground/90 inline-flex min-w-0 items-center gap-2">
                                <span
                                  className="size-2.5 shrink-0 rounded-[4px]"
                                  style={{ background: entry.color }}
                                />
                                <span className="truncate">{entry.name}</span>
                              </span>
                              <span className="shrink-0 tabular-nums">
                                <span className="font-bold">
                                  {pct.toLocaleString("pt-BR", {
                                    maximumFractionDigits: 1,
                                  })}
                                  %
                                </span>
                                <span className="text-muted-foreground ml-1.5 text-xs">
                                  {isVisible
                                    ? `R$ ${formatCompact(entry.value)}`
                                    : "••••••"}
                                </span>
                              </span>
                            </div>
                            <div className="bg-muted/50 h-1 w-full overflow-hidden rounded-full">
                              <div
                                className="h-full rounded-full transition-[width] duration-700 ease-out"
                                style={{
                                  width: `${Math.max(pct, 2)}%`,
                                  background: entry.color,
                                }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground flex h-40 items-center justify-center text-sm">
                    Sem dados para exibir
                  </div>
                )}
              </div>
              {!isVisible && <MaskedOverlay />}
            </div>
          </div>
        </div>
      </Reveal>

      {/* ===== Busca ===== */}
      <Reveal immediate delayMs={180}>
        <div className="glass-card rounded-3xl p-3.5 sm:p-4">
          <div className="relative max-w-md">
            <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar transação..."
              className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl pl-10"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                aria-label="Limpar busca"
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>
      </Reveal>

      {/* ===== Tabs: Ganhos × Saques ===== */}
      <Reveal immediate delayMs={240}>
        <Tabs defaultValue="income" className="gap-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="income" className="cursor-pointer gap-1.5">
              <TrendUp className="size-4" weight="bold" />
              Ganhos ({filteredIncome.length})
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="cursor-pointer gap-1.5">
              <TrendDown className="size-4" weight="bold" />
              Saques ({filteredWithdrawals.length})
            </TabsTrigger>
          </TabsList>

          {/* ===== TAB: GANHOS ===== */}
          <TabsContent value="income" className="flex flex-col gap-4">
            <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
              <ChartCardHeader
                icon={<Trophy className="size-4" weight="fill" />}
                chipClass="bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
                title="Histórico de Ganhos"
                description="Prêmios, bônus e ajustes recebidos"
              />

              <div className="flex flex-col gap-2">
                {displayedIncome.map((transaction) => {
                  const typeStyle =
                    incomeTypeConfig[transaction.type] ?? fallbackIncomeType
                  const TypeIcon = typeStyle.icon

                  return (
                    <div
                      key={transaction.id}
                      className="border-border/60 bg-muted/20 hover:bg-muted/40 flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-colors"
                    >
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-xl",
                          typeStyle.box,
                        )}
                      >
                        <TypeIcon
                          className={cn("size-5", typeStyle.text)}
                          weight="fill"
                        />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">
                            {transaction.description}
                          </p>
                          {transaction.rankingPosition && (
                            <Badge
                              variant="outline"
                              className="shrink-0 rounded-full text-xs"
                            >
                              {transaction.rankingPosition}º
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {formatDateShort(new Date(transaction.createdAt))}
                        </p>
                      </div>

                      <p className="shrink-0 text-right text-sm font-bold text-green-600 tabular-nums sm:text-base dark:text-green-400">
                        {isVisible
                          ? `+${formatCurrency(transaction.amount)}`
                          : "••••••"}
                      </p>
                    </div>
                  )
                })}

                {filteredIncome.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Trophy className="text-muted-foreground/50 mb-3 size-12" />
                    <p className="text-muted-foreground text-sm">
                      Nenhum ganho encontrado
                    </p>
                  </div>
                )}

                {filteredIncome.length > 5 && (
                  <Button
                    variant="ghost"
                    className="w-full cursor-pointer gap-2 rounded-xl"
                    onClick={() => setShowAllIncome(!showAllIncome)}
                  >
                    {showAllIncome ? (
                      <>
                        <CaretUp className="size-4" />
                        Mostrar menos
                      </>
                    ) : (
                      <>
                        <CaretDown className="size-4" />
                        Ver todos ({filteredIncome.length - 5} mais)
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ===== TAB: SAQUES ===== */}
          <TabsContent value="withdrawals" className="flex flex-col gap-4">
            {/* Saques por mês */}
            <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
              <ChartCardHeader
                icon={<TrendDown className="size-4" weight="bold" />}
                chipClass="bg-orange-500/15 text-orange-600 dark:text-orange-400"
                title="Saques por Mês"
                description="Histórico de retiradas"
              />
              <div className="relative">
                <div
                  className={cn(
                    "h-[200px] transition-all duration-300",
                    !isVisible && "pointer-events-none blur-md select-none",
                  )}
                >
                  {withdrawalChartData.some((d) => d.value > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={withdrawalChartData}
                        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                      >
                        <CartesianGrid
                          vertical={false}
                          stroke="color-mix(in oklab, var(--foreground) 7%, transparent)"
                        />
                        <XAxis
                          dataKey="month"
                          axisLine={false}
                          tickLine={false}
                          tickMargin={10}
                          tick={{
                            fill: "var(--muted-foreground)",
                            fontSize: 11,
                          }}
                        />
                        <YAxis
                          tickFormatter={formatAxisBRL}
                          axisLine={false}
                          tickLine={false}
                          width={56}
                          tick={{
                            fill: "var(--muted-foreground)",
                            fontSize: 11,
                          }}
                        />
                        <RechartsTooltip
                          content={<MoneyTooltip />}
                          cursor={{
                            fill: "color-mix(in oklab, var(--foreground) 6%, transparent)",
                          }}
                        />
                        <Bar
                          dataKey="value"
                          name="Sacado"
                          fill={BAR_ORANGE}
                          radius={[8, 8, 0, 0]}
                          maxBarSize={48}
                          animationDuration={650}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                      Sem saques realizados
                    </div>
                  )}
                </div>
                {!isVisible && <MaskedOverlay />}
              </div>
            </div>

            {/* Histórico de saques */}
            <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
              <ChartCardHeader
                icon={<Receipt className="size-4" weight="fill" />}
                chipClass="bg-orange-500/15 text-orange-600 dark:text-orange-400"
                title="Histórico de Saques"
                description="Retiradas realizadas e pendentes"
              />

              <div className="flex flex-col gap-2">
                {displayedWithdrawals.map((transaction) => {
                  const statusStyle =
                    withdrawalStatusConfig[transaction.status] ??
                    withdrawalStatusConfig.PENDING!
                  const StatusIcon = statusStyle.icon
                  const proofUrls: string[] = transaction.proofUrls ?? []

                  return (
                    <div
                      key={transaction.id}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-colors",
                        statusStyle.row,
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-xl",
                          statusStyle.iconBox,
                        )}
                      >
                        <StatusIcon
                          className={cn("size-5", statusStyle.iconText)}
                          weight={statusStyle.iconWeight}
                        />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">
                            {transaction.description}
                          </p>
                          <Badge
                            variant="outline"
                            className={cn(
                              "shrink-0 rounded-full text-xs",
                              statusStyle.badge,
                            )}
                          >
                            {statusStyle.label}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <p className="text-muted-foreground text-xs">
                            {formatDateShort(new Date(transaction.createdAt))}
                          </p>
                          {proofUrls.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                              {proofUrls.map((url, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => setSelectedProof(url)}
                                  className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                                >
                                  <Eye className="size-3" />
                                  Comprovante
                                  {proofUrls.length > 1 ? ` ${index + 1}` : ""}
                                  <ArrowsOut className="size-3" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <p
                        className={cn(
                          "shrink-0 text-right text-sm font-bold tabular-nums sm:text-base",
                          statusStyle.amount,
                        )}
                      >
                        {transaction.amount !== 0
                          ? isVisible
                            ? formatCurrency(transaction.amount)
                            : "••••••"
                          : "—"}
                      </p>
                    </div>
                  )
                })}

                {filteredWithdrawals.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Receipt className="text-muted-foreground/50 mb-3 size-12" />
                    <p className="text-muted-foreground text-sm">
                      Nenhum saque encontrado
                    </p>
                  </div>
                )}

                {filteredWithdrawals.length > 5 && (
                  <Button
                    variant="ghost"
                    className="w-full cursor-pointer gap-2 rounded-xl"
                    onClick={() => setShowAllWithdrawals(!showAllWithdrawals)}
                  >
                    {showAllWithdrawals ? (
                      <>
                        <CaretUp className="size-4" />
                        Mostrar menos
                      </>
                    ) : (
                      <>
                        <CaretDown className="size-4" />
                        Ver todos ({filteredWithdrawals.length - 5} mais)
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Reveal>

      {/* ===== Dialog: Comprovante de Pagamento ===== */}
      <Dialog
        open={!!selectedProof}
        onOpenChange={(open) => !open && setSelectedProof(null)}
      >
        <DialogContent className="max-h-[90vh] gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-4xl">
          <DialogHeader className="p-6 pb-4 text-left">
            <DialogTitle className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400">
                <Receipt className="size-4.5" weight="fill" />
              </span>
              Comprovante de Pagamento
            </DialogTitle>
            <DialogDescription>
              Visualize o comprovante ou abra em uma nova aba
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6">
            <div className="bg-muted/20 relative h-[70vh] w-full overflow-hidden rounded-2xl">
              {selectedProof &&
                (selectedProof.toLowerCase().endsWith(".pdf") ? (
                  <iframe
                    src={selectedProof}
                    className="h-full w-full"
                    title="Comprovante PDF"
                  />
                ) : (
                  <div className="relative flex h-full w-full items-center justify-center">
                    <Image
                      src={selectedProof}
                      alt="Comprovante"
                      fill
                      className="object-contain"
                      sizes="(max-width: 1024px) 100vw, 1024px"
                    />
                  </div>
                ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs">
                Clique fora para fechar
              </p>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="cursor-pointer rounded-xl font-semibold"
              >
                <a
                  href={selectedProof ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gap-2"
                >
                  <ArrowSquareOut className="size-4" />
                  Abrir em nova aba
                </a>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}

/* ===== Card de resumo (KPI) com CountUp mascarável ===== */
function SummaryCard({
  icon,
  chipClass,
  label,
  value,
  valueClass,
  sub,
  subClass,
  delayMs = 0,
}: {
  icon: React.ReactNode
  chipClass: string
  label: string
  value: number
  valueClass?: string
  sub: string
  subClass?: string
  delayMs?: number
}) {
  return (
    <div className="glass-card glass-card-hover flex flex-col gap-3 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
          {label}
        </span>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            chipClass,
          )}
        >
          {icon}
        </span>
      </div>
      <CountUp
        value={value}
        kind="brl"
        delayMs={delayMs}
        className={cn(
          "text-2xl font-bold tracking-tight tabular-nums sm:text-[1.7rem]",
          valueClass,
        )}
      />
      <span className={cn("text-muted-foreground text-xs", subClass)}>
        {sub}
      </span>
    </div>
  )
}

/* ===== Cabeçalho de card de gráfico/lista ===== */
function ChartCardHeader({
  icon,
  chipClass,
  title,
  description,
}: {
  icon: React.ReactNode
  chipClass: string
  title: string
  description: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          chipClass,
        )}
      >
        {icon}
      </span>
      <div className="leading-tight">
        <h2 className="text-sm font-bold tracking-tight sm:text-base">
          {title}
        </h2>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
    </div>
  )
}

/* ===== Overlay "Valores ocultos" sobre gráficos borrados ===== */
function MaskedOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center">
      <div className="border-border/60 bg-background/80 flex items-center gap-2 rounded-xl border px-4 py-2 backdrop-blur-sm">
        <EyeSlash className="text-muted-foreground size-4" />
        <span className="text-muted-foreground text-sm font-medium">
          Valores ocultos
        </span>
      </div>
    </div>
  )
}

/* ===== Tooltip glass com valores em BRL mascaráveis ===== */
function MoneyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{
    name?: string
    value?: number
    color?: string
    stroke?: string
    fill?: string
  }>
  label?: string
}) {
  const { maskBRLExact } = useMaskedCurrency()
  if (!active || !payload?.length) return null
  return (
    <div className="border-border bg-popover/95 min-w-40 rounded-xl border p-3 shadow-xl backdrop-blur-md">
      <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
        {label}
      </p>
      <div className="flex flex-col gap-1">
        {payload.map((entry, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-6 text-xs"
          >
            <span className="text-muted-foreground inline-flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: entry.stroke ?? entry.fill ?? entry.color }}
              />
              {entry.name}
            </span>
            <span className="font-semibold tabular-nums">
              {maskBRLExact(Number(entry.value ?? 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ===== Tooltip do donut ===== */
function DonutTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean
  payload?: Array<{
    payload?: { name: string; value: number; color: string }
  }>
  total: number
}) {
  const { maskBRLExact } = useMaskedCurrency()
  const datum = payload?.[0]?.payload
  if (!active || !datum || total <= 0) return null
  return (
    <div className="border-border bg-popover/95 rounded-xl border p-3 text-xs shadow-xl backdrop-blur-md">
      <p className="mb-1 font-semibold">{datum.name}</p>
      <p className="text-muted-foreground">
        {maskBRLExact(datum.value)} ·{" "}
        {((datum.value / total) * 100).toLocaleString("pt-BR", {
          maximumFractionDigits: 1,
        })}
        %
      </p>
    </div>
  )
}
