"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowsDownUp,
  CalendarBlank,
  ChartBar,
  ChartLineUp,
  ChartPieSlice,
  CheckCircle,
  Clock,
  Coins,
  Crown,
  Eye,
  Funnel,
  Gauge,
  HandCoins,
  LockSimple,
  MagnifyingGlass,
  PixLogo,
  Receipt,
  ShieldWarning,
  Sparkle,
  Target,
  Trophy,
  Users,
  Wallet,
  X,
} from "@phosphor-icons/react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatChartDate } from "@/components/home/platform-chart-meta";
import { SectionHeading } from "@/components/home/section-heading";
import { StatTile } from "@/components/home/stat-tile";
import { FinancialHeroViz, FinancialCompetitionHeroVizSkeleton } from "@/components/competitions/financial-hero-viz";
import { HomeHero } from "@/components/home/home-hero";
import { formatCompact } from "@/components/shared/count-up";
import { Reveal } from "@/components/shared/reveal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMaskedCurrency } from "@/contexts/financial-visibility-context";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";

/* ── Tipos ─────────────────────────────────────────────────────────────── */
type FinancialsData = RouterOutputs["admin"]["getGlobalFinancials"];
type Period = "all" | "7d" | "30d" | "90d" | "180d" | "365d";
type DailyPoint = FinancialsData["dailyHistory"][number];

/* ── Períodos disponíveis ──────────────────────────────────────────────── */
const PERIOD_OPTIONS: { value: Period; label: string; description: string }[] =
  [
    { value: "7d", label: "7D", description: "últimos 7 dias" },
    { value: "30d", label: "30D", description: "últimos 30 dias" },
    { value: "90d", label: "90D", description: "últimos 90 dias" },
    { value: "180d", label: "6M", description: "últimos 6 meses" },
    { value: "365d", label: "1A", description: "último ano" },
    { value: "all", label: "Tudo", description: "todo o período" },
  ];

const periodDescription = (period: Period) =>
  PERIOD_OPTIONS.find((option) => option.value === period)?.description ??
  "todo o período";

/*
 * Cores das séries financeiras via CSS vars da marca (mudam com o tema).
 * Cada série tem identidade própria: verde = creditado/prêmios,
 * ciano = pago via PIX, azul = bônus, âmbar = ajustes.
 */
const COLOR_CREDITED = "var(--chart-growth)";
const COLOR_PAID = "var(--chart-tiktok)";
const COLOR_PRIZES = "var(--chart-growth)";
const COLOR_BONUSES = "var(--chart-facebook)";
const COLOR_ADJUSTMENTS = "var(--chart-kwai)";

/* ── Formatadores ──────────────────────────────────────────────────────── */
const formatCompactBRL = (value: number) => `R$ ${formatCompact(value)}`;

/** Compact BRL respeitando o olhinho da topbar ("••••••" quando oculto). */
function useMaskedCompactBRL() {
  const { isVisible } = useMaskedCurrency();
  return (value: number) => (isVisible ? formatCompactBRL(value) : "••••••");
}

const formatDateTime = (value: string | Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const formatDateShort = (value: string | Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(value));

/* ── Configuração visual por status de competição ──────────────────────── */
const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; dot: string }
> = {
  ACTIVE: {
    label: "Ativa",
    className:
      "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  PAUSED: {
    label: "Pausada",
    className:
      "border-yellow-500/30 bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
    dot: "bg-yellow-500",
  },
  COMPLETED: {
    label: "Encerrada",
    className:
      "border-blue-500/30 bg-blue-500/15 text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  DRAFT: {
    label: "Rascunho",
    className:
      "border-gray-500/30 bg-gray-500/15 text-gray-600 dark:text-gray-400",
    dot: "bg-gray-500",
  },
  CANCELLED: {
    label: "Cancelada",
    className: "border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400",
    dot: "bg-red-500",
  },
};

const campaignStatus = (status: string) =>
  STATUS_CONFIG[status] ?? {
    label: status,
    className: "border-gray-500/30 bg-gray-500/15 text-gray-500",
    dot: "bg-gray-500",
  };

/* ── Configuração visual por tipo de transação ─────────────────────────── */
const TX_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
  }
> = {
  PRIZE_CREDIT: {
    label: "Prêmio",
    icon: Trophy,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-500/15",
  },
  BONUS: {
    label: "Bônus",
    icon: Sparkle,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-500/15",
  },
  ADJUSTMENT: {
    label: "Ajuste",
    icon: Receipt,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/15",
  },
  WITHDRAWAL_COMPLETED: {
    label: "PIX Enviado",
    icon: PixLogo,
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-500/15",
  },
  WITHDRAWAL_REQUEST: {
    label: "Saque Pendente",
    icon: Clock,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-500/15",
  },
  WITHDRAWAL_APPROVED: {
    label: "Saque Aprovado",
    icon: CheckCircle,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-500/15",
  },
};

const txConfig = (type: string) =>
  TX_CONFIG[type] ?? {
    label: type,
    icon: Coins,
    color: "text-muted-foreground",
    bgColor: "bg-muted/40",
  };

/* ── Página ────────────────────────────────────────────────────────────── */
export default function Financial() {
  const { maskBRLExact } = useMaskedCurrency()
  const maskCompactBRL = useMaskedCompactBRL()
  const [period, setPeriod] = React.useState<Period>("all");
  const [chartMode, setChartMode] = React.useState<"daily" | "cumulative">(
    "daily",
  );
  const [campaignSearch, setCampaignSearch] = React.useState("");
  const [campaignSort, setCampaignSort] = React.useState<
    "credited" | "paid" | "cpm" | "views"
  >("credited");
  const [clipperSearch, setClipperSearch] = React.useState("");
  const [txTypeFilter, setTxTypeFilter] = React.useState("all");
  const [txCampaignFilter, setTxCampaignFilter] = React.useState("all");

  const { data, isLoading, error } = api.admin.getGlobalFinancials.useQuery({
    period,
  });

  const summary = data?.summary;

  /* Movimentação: modo acumulado calculado no cliente */
  const movementData = React.useMemo(() => {
    const history = data?.dailyHistory ?? [];
    if (chartMode === "daily") return history;
    let credited = 0;
    let paid = 0;
    return history.map((point) => {
      credited += point.credited;
      paid += point.paid;
      return { ...point, credited, paid };
    });
  }, [data?.dailyHistory, chartMode]);

  /* Prêmios × Bônus × Ajustes por dia (só dias com movimento p/ períodos longos) */
  const breakdownData = React.useMemo(() => {
    const history = data?.dailyHistory ?? [];
    if (history.length <= 45) return history;
    return history.filter(
      (point) => point.prizes > 0 || point.bonuses > 0 || point.adjustments > 0,
    );
  }, [data?.dailyHistory]);

  const donutData = React.useMemo(
    () =>
      [
        {
          name: "Prêmios",
          value: summary?.totalPrizes ?? 0,
          color: COLOR_PRIZES,
        },
        {
          name: "Bônus",
          value: summary?.totalBonuses ?? 0,
          color: COLOR_BONUSES,
        },
        {
          name: "Ajustes",
          value: summary?.totalAdjustments ?? 0,
          color: COLOR_ADJUSTMENTS,
        },
      ].filter((entry) => entry.value > 0),
    [summary],
  );

  /* Competições filtradas + ordenadas */
  const filteredCampaigns = React.useMemo(() => {
    let result = [...(data?.campaignFinancials ?? [])];
    const term = campaignSearch.trim().toLowerCase();
    if (term) {
      result = result.filter((campaign) =>
        campaign.name.toLowerCase().includes(term),
      );
    }
    result.sort((a, b) => {
      if (campaignSort === "credited") return b.totalCredited - a.totalCredited;
      if (campaignSort === "paid") return b.totalPaid - a.totalPaid;
      if (campaignSort === "cpm") return a.cpm - b.cpm;
      return b.totalViews - a.totalViews;
    });
    return result;
  }, [data?.campaignFinancials, campaignSearch, campaignSort]);

  /* Clipadores filtrados */
  const filteredClippers = React.useMemo(() => {
    const term = clipperSearch.trim().toLowerCase();
    if (!term) return data?.topClippers ?? [];
    return (data?.topClippers ?? []).filter(
      (clipper) =>
        clipper.fullName.toLowerCase().includes(term) ||
        (clipper.artisticName?.toLowerCase().includes(term) ?? false) ||
        clipper.email.toLowerCase().includes(term),
    );
  }, [data?.topClippers, clipperSearch]);

  /* Transações filtradas */
  const filteredTransactions = React.useMemo(() => {
    let result = data?.recentTransactions ?? [];
    if (txTypeFilter !== "all") {
      result = result.filter((tx) => tx.type === txTypeFilter);
    }
    if (txCampaignFilter !== "all") {
      result = result.filter((tx) => tx.campaignId === txCampaignFilter);
    }
    return result;
  }, [data?.recentTransactions, txTypeFilter, txCampaignFilter]);

  const txCampaignOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    (data?.recentTransactions ?? []).forEach((tx) => {
      if (tx.campaignId && !map.has(tx.campaignId)) {
        map.set(tx.campaignId, tx.campaignName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [data?.recentTransactions]);

  /* CPM: competições com views, da mais eficiente para a menos */
  const cpmCampaigns = React.useMemo(
    () =>
      [...(data?.campaignFinancials ?? [])]
        .filter((campaign) => campaign.totalViews > 0 && campaign.cpm > 0)
        .sort((a, b) => a.cpm - b.cpm),
    [data?.campaignFinancials],
  );

  if (error) return <AccessDeniedCard />;

  const paidRate =
    summary && summary.totalCredited > 0
      ? (summary.totalPaidPix / summary.totalCredited) * 100
      : 0;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero ===== */}
      <HomeHero
        eyebrow="Clipfy League · Financeiro"
        viz={<FinancialHeroViz />}
        vizSkeleton={<FinancialCompetitionHeroVizSkeleton />}
        title={
          <>
            Controle <span className="text-gradient">financeiro</span> das
            premiações
          </>
        }
        subtitle="Visão completa dos gastos com premiações — créditos, bônus, pagamentos via PIX e saques pendentes de todas as competições em um só lugar."
        isLoading={isLoading}
        stats={[
          {
            icon: <Coins className="size-3.5" weight="fill" />,
            label: "Creditado",
            value: summary?.totalCredited ?? 0,
            kind: "compactBRL",
          },
          {
            icon: <PixLogo className="size-3.5" weight="fill" />,
            label: "Pago via PIX",
            value: summary?.totalPaidPix ?? 0,
            kind: "compactBRL",
          },
          {
            icon: <HandCoins className="size-3.5" weight="fill" />,
            label: "Pendentes",
            value: summary?.pendingCount ?? 0,
            kind: "int",
          },
        ]}
      />

      {/* ===== Seletor de período ===== */}
      <Reveal immediate>
        <div className="glass-card flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex items-center gap-2.5">
            <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
              <CalendarBlank className="size-4" weight="fill" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-bold">Período de análise</p>
              <p className="text-muted-foreground text-xs">
                Todos os números refletem {periodDescription(period)}
              </p>
            </div>
          </div>
          <div className="bg-muted/40 grid w-full grid-cols-6 gap-1 rounded-xl p-1 sm:w-auto sm:min-w-[340px]">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPeriod(option.value)}
                aria-pressed={period === option.value}
                className={cn(
                  "cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold transition-all",
                  period === option.value
                    ? "bg-gradient-custom text-[#04222A] shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ===== KPIs principais ===== */}
      <Reveal immediate delayMs={60}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<Coins className="size-4" weight="fill" />}
            label="Total Creditado"
            value={summary?.totalCredited ?? 0}
            kind="brl"
            hint={`${(summary?.totalTransactions ?? 0).toLocaleString("pt-BR")} transações`}
            accent="gradient"
            gradientValue
            isLoading={isLoading}
          />
          <StatTile
            icon={<PixLogo className="size-4" weight="fill" />}
            label="Pago via PIX"
            value={summary?.totalPaidPix ?? 0}
            kind="brl"
            hint={`${paidRate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do creditado`}
            accent="cyan"
            isLoading={isLoading}
          />
          <StatTile
            icon={<HandCoins className="size-4" weight="fill" />}
            label="Saques Pendentes"
            value={summary?.totalPendingAmount ?? 0}
            kind="brl"
            hint={`${summary?.pendingCount ?? 0} solicitações aguardando`}
            accent="green"
            isLoading={isLoading}
          />
          <StatTile
            icon={<Wallet className="size-4" weight="fill" />}
            label="Faltam Transferir"
            value={summary?.totalRemainingToPay ?? 0}
            kind="brl"
            hint="creditado − pago via PIX"
            accent="cyan"
            isLoading={isLoading}
          />
        </div>
      </Reveal>

      {/* ===== Premiação normal × bônus × ajustes ===== */}
      <Reveal immediate delayMs={120}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<Trophy className="size-4" weight="fill" />}
            label="Premiação Normal"
            value={summary?.totalPrizes ?? 0}
            kind="brl"
            hint={shareHint(summary?.totalPrizes, summary?.totalCredited)}
            accent="green"
            isLoading={isLoading}
          />
          <StatTile
            icon={<Sparkle className="size-4" weight="fill" />}
            label="Bônus"
            value={summary?.totalBonuses ?? 0}
            kind="brl"
            hint={shareHint(summary?.totalBonuses, summary?.totalCredited)}
            accent="cyan"
            isLoading={isLoading}
          />
          <StatTile
            icon={<Receipt className="size-4" weight="fill" />}
            label="Ajustes"
            value={summary?.totalAdjustments ?? 0}
            kind="brl"
            hint={shareHint(summary?.totalAdjustments, summary?.totalCredited)}
            accent="gradient"
            isLoading={isLoading}
          />
          <CpmTile
            cpm={summary?.globalCpm ?? 0}
            views={summary?.globalViews ?? 0}
            isLoading={isLoading}
          />
        </div>
      </Reveal>

      {/* ===== Movimentação + Distribuição ===== */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-5">
        <Reveal immediate delayMs={180} className="lg:col-span-3">
          <div className="glass-card flex h-full flex-col gap-4 rounded-3xl p-4 sm:gap-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <SectionHeading
                icon={<ChartLineUp className="size-4" weight="fill" />}
                title="Movimentação Financeira"
                description={`Creditado × pago via PIX — ${periodDescription(period)}`}
              />
              <div className="bg-muted/40 flex gap-1 rounded-xl p-1">
                {(
                  [
                    { value: "daily", label: "Diário" },
                    { value: "cumulative", label: "Acumulado" },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setChartMode(mode.value)}
                    aria-pressed={chartMode === mode.value}
                    className={cn(
                      "cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all",
                      chartMode === mode.value
                        ? "bg-gradient-custom text-[#04222A] shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
            <MovementChart data={movementData} isLoading={isLoading} />
          </div>
        </Reveal>

        <Reveal immediate delayMs={240} className="lg:col-span-2">
          <div className="glass-card flex h-full flex-col gap-4 rounded-3xl p-4 sm:gap-5 sm:p-6">
            <SectionHeading
              icon={<ChartPieSlice className="size-4" weight="fill" />}
              title="Distribuição dos Gastos"
              description="Premiação normal, bônus e ajustes"
            />
            <MoneyDonut
              data={donutData}
              total={summary?.totalCredited ?? 0}
              isLoading={isLoading}
            />
          </div>
        </Reveal>
      </div>

      {/* ===== Prêmios × Bônus por dia + Saques pendentes ===== */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <Reveal immediate delayMs={300}>
          <div className="glass-card flex h-full flex-col gap-4 rounded-3xl p-4 sm:gap-5 sm:p-6">
            <SectionHeading
              icon={<ChartBar className="size-4" weight="fill" />}
              title="Prêmios × Bônus por Dia"
              description="Composição diária dos créditos por tipo"
            />
            <BreakdownBarChart data={breakdownData} isLoading={isLoading} />
          </div>
        </Reveal>

        <Reveal immediate delayMs={360}>
          <div className="glass-card flex h-full flex-col gap-4 rounded-3xl p-4 sm:gap-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <SectionHeading
                icon={<HandCoins className="size-4" weight="fill" />}
                title="Saques Pendentes"
                description="Solicitações aguardando pagamento"
              />
              {(data?.pendingWithdrawals.length ?? 0) > 0 && (
                <Badge
                  variant="outline"
                  className="shrink-0 rounded-full border-orange-500/30 bg-orange-500/15 text-[10px] font-bold text-orange-600 dark:text-orange-400"
                >
                  {data?.pendingWithdrawals.length}
                </Badge>
              )}
            </div>
            <PendingWithdrawalsList
              withdrawals={data?.pendingWithdrawals ?? []}
              isLoading={isLoading}
            />
          </div>
        </Reveal>
      </div>

      {/* ===== Comparativo por competição ===== */}
      <Reveal immediate delayMs={420}>
        <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
          <SectionHeading
            icon={<Trophy className="size-4" weight="fill" />}
            title="Gastos por Competição"
            description="Quanto cada competição custou — creditado × pago via PIX"
          />
          <CampaignComparisonList
            campaigns={(data?.campaignFinancials ?? []).slice(0, 10)}
            totalCredited={summary?.totalCredited ?? 0}
            isLoading={isLoading}
          />
        </div>
      </Reveal>

      {/* ===== Detalhamento ===== */}
      <Reveal immediate delayMs={480}>
        <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
          <SectionHeading
            icon={<MagnifyingGlass className="size-4" weight="bold" />}
            title="Detalhamento Financeiro"
            description="Competições, clipadores, transações e eficiência (CPM)"
          />
          <Tabs defaultValue="campaigns" className="flex w-full flex-col gap-4">
            <TabsList className="h-10 w-full rounded-xl">
              <TabsTrigger
                value="campaigns"
                className="flex-1 cursor-pointer gap-1.5 text-xs"
              >
                <Trophy className="size-3.5" />
                <span className="hidden sm:inline">Competições</span>
                <span className="sm:hidden">Comp.</span>
              </TabsTrigger>
              <TabsTrigger
                value="clippers"
                className="flex-1 cursor-pointer gap-1.5 text-xs"
              >
                <Users className="size-3.5" />
                <span className="hidden sm:inline">Clipadores</span>
                <span className="sm:hidden">Clip.</span>
              </TabsTrigger>
              <TabsTrigger
                value="transactions"
                className="flex-1 cursor-pointer gap-1.5 text-xs"
              >
                <Receipt className="size-3.5" />
                <span className="hidden sm:inline">Transações</span>
                <span className="sm:hidden">Trans.</span>
              </TabsTrigger>
              <TabsTrigger
                value="cpm"
                className="flex-1 cursor-pointer gap-1.5 text-xs"
              >
                <Gauge className="size-3.5" />
                CPM
              </TabsTrigger>
            </TabsList>

            {/* ─── Competições ─── */}
            <TabsContent value="campaigns" className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative min-w-0 flex-1">
                  <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
                  <Input
                    value={campaignSearch}
                    onChange={(event) => setCampaignSearch(event.target.value)}
                    placeholder="Buscar competição..."
                    className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl pl-10"
                  />
                  {campaignSearch && (
                    <button
                      type="button"
                      onClick={() => setCampaignSearch("")}
                      aria-label="Limpar busca"
                      className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
                <Select
                  value={campaignSort}
                  onValueChange={(value) =>
                    setCampaignSort(value as typeof campaignSort)
                  }
                >
                  <SelectTrigger className="h-10 w-full rounded-xl lg:w-[210px]">
                    <ArrowsDownUp className="text-muted-foreground mr-1 size-3.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credited">Maior creditado</SelectItem>
                    <SelectItem value="paid">Maior pago (PIX)</SelectItem>
                    <SelectItem value="cpm">Melhor CPM</SelectItem>
                    <SelectItem value="views">Mais views</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <CampaignsGrid
                campaigns={filteredCampaigns}
                totalCredited={summary?.totalCredited ?? 0}
                isLoading={isLoading}
              />
            </TabsContent>

            {/* ─── Clipadores ─── */}
            <TabsContent value="clippers" className="flex flex-col gap-4">
              <div className="relative">
                <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
                <Input
                  value={clipperSearch}
                  onChange={(event) => setClipperSearch(event.target.value)}
                  placeholder="Buscar por nome, @artístico ou email..."
                  className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl pl-10"
                />
                {clipperSearch && (
                  <button
                    type="button"
                    onClick={() => setClipperSearch("")}
                    aria-label="Limpar busca"
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <ClippersTable
                clippers={filteredClippers}
                isLoading={isLoading}
              />
            </TabsContent>

            {/* ─── Transações ─── */}
            <TabsContent value="transactions" className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Select value={txTypeFilter} onValueChange={setTxTypeFilter}>
                  <SelectTrigger className="h-10 w-full rounded-xl sm:w-[190px]">
                    <Funnel className="text-muted-foreground mr-1 size-3.5" />
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="PRIZE_CREDIT">Prêmios</SelectItem>
                    <SelectItem value="BONUS">Bônus</SelectItem>
                    <SelectItem value="ADJUSTMENT">Ajustes</SelectItem>
                    <SelectItem value="WITHDRAWAL_COMPLETED">
                      PIX Enviado
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={txCampaignFilter}
                  onValueChange={setTxCampaignFilter}
                >
                  <SelectTrigger className="h-10 w-full rounded-xl sm:w-[240px]">
                    <Trophy className="text-muted-foreground mr-1 size-3.5" />
                    <SelectValue placeholder="Competição" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as competições</SelectItem>
                    {txCampaignOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(txTypeFilter !== "all" || txCampaignFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground h-10 cursor-pointer rounded-xl text-xs"
                    onClick={() => {
                      setTxTypeFilter("all");
                      setTxCampaignFilter("all");
                    }}
                  >
                    <X className="size-3.5" />
                    Limpar filtros
                  </Button>
                )}
              </div>
              <TransactionsList
                transactions={filteredTransactions}
                isLoading={isLoading}
              />
            </TabsContent>

            {/* ─── CPM ─── */}
            <TabsContent value="cpm" className="flex flex-col gap-4">
              <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
                  <Target
                    className="size-4.5 text-amber-600 dark:text-amber-400"
                    weight="fill"
                  />
                </span>
                <div className="text-xs leading-relaxed">
                  <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                    O que é CPM?
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    <strong>CPM (Custo por Mil Impressões)</strong> mede o gasto
                    de premiação para cada 1.000 views. Quanto{" "}
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      menor
                    </span>
                    , mais eficiente a competição. Fórmula:{" "}
                    <code className="bg-muted/60 rounded px-1.5 py-0.5 font-mono text-[10px]">
                      (creditado ÷ views) × 1000
                    </code>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <CpmMiniStat
                  label="CPM Médio Global"
                  value={
                    (summary?.globalCpm ?? 0) > 0
                      ? maskBRLExact(summary?.globalCpm ?? 0)
                      : "—"
                  }
                  hint="por 1.000 views"
                  className="text-amber-600 dark:text-amber-400"
                  isLoading={isLoading}
                />
                <CpmMiniStat
                  label="Total Investido"
                  value={maskCompactBRL(summary?.totalCredited ?? 0)}
                  hint="em premiações"
                  className="text-emerald-600 dark:text-emerald-400"
                  isLoading={isLoading}
                />
                <CpmMiniStat
                  label="Views Alcançados"
                  value={formatCompact(summary?.globalViews ?? 0)}
                  hint="alcance orgânico total"
                  className="text-cyan-600 dark:text-cyan-400"
                  isLoading={isLoading}
                />
              </div>

              <CpmTable campaigns={cpmCampaigns} isLoading={isLoading} />
            </TabsContent>
          </Tabs>
        </div>
      </Reveal>

      {/* ===== Maiores premiados ===== */}
      <Reveal immediate delayMs={540}>
        <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <SectionHeading
              icon={<Crown className="size-4" weight="fill" />}
              title="Maiores Premiados"
              description="Clipadores com maior premiação acumulada no período"
            />
            {(data?.topClippers.length ?? 0) > 0 && (
              <Badge
                variant="outline"
                className="border-brand-cyan/25 not-dark:border-primary/30 shrink-0 rounded-full text-[10px] font-bold"
              >
                <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
                  Top {data?.topClippers.length}
                </span>
              </Badge>
            )}
          </div>
          <TopClippersList
            clippers={data?.topClippers ?? []}
            isLoading={isLoading}
          />
        </div>
      </Reveal>
    </div>
  );
}

/* ── Hint de participação percentual ───────────────────────────────────── */
function shareHint(value?: number, total?: number) {
  if (!value || !total || total <= 0) return "sem movimento no período";
  const pct = (value / total) * 100;
  return `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do creditado`;
}

/* ── Tile de CPM (precisa de centavos — fora do CountUp padrão) ────────── */
function CpmTile({
  cpm,
  views,
  isLoading,
}: {
  cpm: number;
  views: number;
  isLoading: boolean;
}) {
  const { maskBRLExact } = useMaskedCurrency()
  return (
    <div className="glass-card glass-card-hover flex flex-col gap-3 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
          CPM Médio
        </span>
        <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
          <Gauge className="size-4" weight="fill" />
        </span>
      </div>
      {isLoading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <span className="text-2xl font-bold tracking-tight tabular-nums sm:text-[1.7rem]">
          {cpm > 0 ? maskBRLExact(cpm) : "—"}
        </span>
      )}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">
          {formatCompact(views)} views totais
        </span>
      </div>
    </div>
  );
}

/* ── Mini stat do tab CPM ──────────────────────────────────────────────── */
function CpmMiniStat({
  label,
  value,
  hint,
  className,
  isLoading,
}: {
  label: string;
  value: string;
  hint: string;
  className?: string;
  isLoading: boolean;
}) {
  return (
    <div className="glass-card flex flex-col items-center gap-1 rounded-2xl p-4 text-center sm:p-5">
      <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
        {label}
      </span>
      {isLoading ? (
        <Skeleton className="mt-1 h-8 w-24" />
      ) : (
        <span
          className={cn(
            "text-2xl font-bold tracking-tight tabular-nums",
            className,
          )}
        >
          {value}
        </span>
      )}
      <span className="text-muted-foreground text-xs">{hint}</span>
    </div>
  );
}

/* ── Legenda com dots ──────────────────────────────────────────────────── */
function LegendDots({
  items,
}: {
  items: { label: string; color?: string; gradient?: boolean }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <span
          key={item.label}
          className="text-muted-foreground inline-flex items-center gap-1.5 text-[11px] font-medium sm:text-xs"
        >
          {item.gradient ? (
            <span className="bg-gradient-custom size-2 rounded-full" />
          ) : (
            <span
              className="size-2 rounded-full"
              style={{ background: item.color }}
            />
          )}
          {item.label}
        </span>
      ))}
    </div>
  );
}

/* ── Tooltip glass com valores em BRL ──────────────────────────────────── */
function MoneyTooltip({
  active,
  payload,
  label,
  formatLabel,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    stroke?: string;
    fill?: string;
  }>;
  label?: string;
  formatLabel?: (value: string) => string;
}) {
  const { maskBRLExact } = useMaskedCurrency()
  if (!active || !payload?.length) return null;
  return (
    <div className="border-border bg-popover/95 min-w-44 rounded-xl border p-3 shadow-xl backdrop-blur-md">
      <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
        {label ? (formatLabel ? formatLabel(label) : label) : ""}
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
                style={{
                  background: entry.stroke ?? entry.fill ?? entry.color,
                }}
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
  );
}

/* ── Movimentação financeira (área) ────────────────────────────────────── */
function MovementChart({
  data,
  isLoading,
}: {
  data: DailyPoint[];
  isLoading: boolean;
}) {
  const maskCompactBRL = useMaskedCompactBRL()
  if (isLoading) {
    return <Skeleton className="h-[280px] w-full rounded-2xl sm:h-[300px]" />;
  }

  if (
    data.length === 0 ||
    data.every((p) => p.credited === 0 && p.paid === 0)
  ) {
    return (
      <p className="text-muted-foreground flex h-[240px] items-center justify-center text-sm">
        Sem movimentação financeira no período
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="h-[260px] w-full sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient
                id="fin-credited-stroke"
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop offset="0%" stopColor="var(--chart-growth-start)" />
                <stop offset="100%" stopColor="var(--chart-growth-end)" />
              </linearGradient>
              <linearGradient
                id="fin-credited-fill"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="var(--chart-growth-end)"
                  stopOpacity={0.24}
                />
                <stop
                  offset="100%"
                  stopColor="var(--chart-growth-end)"
                  stopOpacity={0}
                />
              </linearGradient>
              <linearGradient id="fin-paid-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR_PAID} stopOpacity={0.18} />
                <stop offset="100%" stopColor={COLOR_PAID} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="color-mix(in oklab, var(--foreground) 7%, transparent)"
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatChartDate}
              axisLine={false}
              tickLine={false}
              minTickGap={48}
              tickMargin={10}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              tickFormatter={(value: number) => maskCompactBRL(value)}
              axisLine={false}
              tickLine={false}
              width={62}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <RechartsTooltip
              content={<MoneyTooltip formatLabel={formatChartDate} />}
              cursor={{
                stroke:
                  "color-mix(in oklab, var(--foreground) 22%, transparent)",
                strokeDasharray: "4 4",
              }}
            />
            <Area
              type="monotone"
              dataKey="credited"
              name="Creditado"
              stroke="url(#fin-credited-stroke)"
              strokeWidth={2.5}
              strokeLinecap="round"
              fill="url(#fin-credited-fill)"
              animationDuration={650}
              activeDot={{
                r: 4.5,
                fill: "var(--chart-growth-end)",
                stroke: "var(--card)",
                strokeWidth: 2,
              }}
            />
            <Area
              type="monotone"
              dataKey="paid"
              name="Pago (PIX)"
              stroke={COLOR_PAID}
              strokeWidth={2}
              strokeDasharray="6 3"
              fill="url(#fin-paid-fill)"
              animationDuration={650}
              activeDot={{
                r: 4,
                fill: COLOR_PAID,
                stroke: "var(--card)",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <LegendDots
        items={[
          { label: "Creditado", gradient: true },
          { label: "Pago (PIX)", color: COLOR_PAID },
        ]}
      />
    </div>
  );
}

/* ── Donut de distribuição dos gastos ──────────────────────────────────── */
interface DonutEntry {
  name: string;
  value: number;
  color: string;
}

function MoneyDonut({
  data,
  total,
  isLoading,
}: {
  data: DonutEntry[];
  total: number;
  isLoading: boolean;
}) {
  const maskCompactBRL = useMaskedCompactBRL()
  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <Skeleton className="size-44 rounded-full" />
        <div className="flex w-full flex-1 flex-col gap-2.5">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-5 w-full rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  const sum = data.reduce((acc, entry) => acc + entry.value, 0);

  if (sum === 0) {
    return (
      <p className="text-muted-foreground flex h-44 items-center justify-center text-sm">
        Sem créditos registrados no período
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 lg:h-full lg:justify-center">
      <div className="relative size-44 shrink-0 sm:size-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <RechartsTooltip content={<MoneyDonutTooltip total={sum} />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="68%"
              outerRadius="94%"
              paddingAngle={2}
              cornerRadius={4}
              stroke="var(--card)"
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold tabular-nums">
            {maskCompactBRL(total)}
          </span>
          <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
            creditado
          </span>
        </div>
      </div>

      <div className="flex w-full flex-col gap-2.5">
        {data.map((entry) => {
          const pct = (entry.value / sum) * 100;
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
                    {pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                  </span>
                  <span className="text-muted-foreground ml-1.5 text-xs">
                    {maskCompactBRL(entry.value)}
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
          );
        })}
      </div>
    </div>
  );
}

function MoneyDonutTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ payload?: DonutEntry }>;
  total: number;
}) {
  const { maskBRLExact } = useMaskedCurrency()
  const datum = payload?.[0]?.payload;
  if (!active || !datum) return null;
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
  );
}

/* ── Prêmios × Bônus × Ajustes (barras empilhadas) ─────────────────────── */
function BreakdownBarChart({
  data,
  isLoading,
}: {
  data: DailyPoint[];
  isLoading: boolean;
}) {
  const maskCompactBRL = useMaskedCompactBRL()
  if (isLoading) {
    return <Skeleton className="h-[260px] w-full rounded-2xl" />;
  }

  if (
    data.length === 0 ||
    data.every((p) => p.prizes === 0 && p.bonuses === 0 && p.adjustments === 0)
  ) {
    return (
      <p className="text-muted-foreground flex h-[220px] items-center justify-center text-sm">
        Sem créditos registrados no período
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="color-mix(in oklab, var(--foreground) 7%, transparent)"
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatChartDate}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
              tickMargin={10}
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            />
            <YAxis
              tickFormatter={(value: number) => maskCompactBRL(value)}
              axisLine={false}
              tickLine={false}
              width={58}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <RechartsTooltip
              content={<MoneyTooltip formatLabel={formatChartDate} />}
              cursor={{
                fill: "color-mix(in oklab, var(--foreground) 6%, transparent)",
              }}
            />
            <Bar
              dataKey="prizes"
              name="Prêmios"
              stackId="credits"
              fill={COLOR_PRIZES}
              maxBarSize={18}
            />
            <Bar
              dataKey="bonuses"
              name="Bônus"
              stackId="credits"
              fill={COLOR_BONUSES}
              maxBarSize={18}
            />
            <Bar
              dataKey="adjustments"
              name="Ajustes"
              stackId="credits"
              fill={COLOR_ADJUSTMENTS}
              radius={[4, 4, 0, 0]}
              maxBarSize={18}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <LegendDots
        items={[
          { label: "Prêmios", color: COLOR_PRIZES },
          { label: "Bônus", color: COLOR_BONUSES },
          { label: "Ajustes", color: COLOR_ADJUSTMENTS },
        ]}
      />
    </div>
  );
}

/* ── Saques pendentes ──────────────────────────────────────────────────── */
function PendingWithdrawalsList({
  withdrawals,
  isLoading,
}: {
  withdrawals: FinancialsData["pendingWithdrawals"];
  isLoading: boolean;
}) {
  const { maskBRLExact } = useMaskedCurrency()
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (withdrawals.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="size-6" weight="fill" />
        </span>
        <p className="text-muted-foreground text-sm">
          Nenhum saque pendente — tudo em dia!
        </p>
      </div>
    );
  }

  return (
    <div className="-mr-2 flex max-h-[300px] flex-col gap-1 overflow-y-auto pr-2">
      {withdrawals.map((withdrawal) => (
        <div
          key={withdrawal.id}
          className="hover:bg-muted/40 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors"
        >
          <Avatar className="size-9 shrink-0">
            <AvatarImage
              src={withdrawal.clipperImageUrl ?? undefined}
              alt={withdrawal.clipperName}
            />
            <AvatarFallback className="bg-gradient-custom text-xs font-bold text-[#04222A]">
              {withdrawal.clipperName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {withdrawal.clipperName}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {withdrawal.campaignName}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold text-orange-600 tabular-nums dark:text-orange-400">
              {maskBRLExact(withdrawal.amount)}
            </p>
            <p className="text-muted-foreground text-[10px]">
              {formatDateShort(withdrawal.createdAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Comparativo de gastos por competição ──────────────────────────────── */
function CampaignComparisonList({
  campaigns,
  totalCredited,
  isLoading,
}: {
  campaigns: FinancialsData["campaignFinancials"];
  totalCredited: number;
  isLoading: boolean;
}) {
  const maskCompactBRL = useMaskedCompactBRL()
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        Sem competições com movimento financeiro no período
      </p>
    );
  }

  const maxCredited = Math.max(...campaigns.map((c) => c.totalCredited), 1);

  return (
    <div className="flex flex-col gap-1.5">
      {campaigns.map((campaign, index) => {
        const share =
          totalCredited > 0
            ? (campaign.totalCredited / totalCredited) * 100
            : 0;
        const barPct = Math.max(
          (campaign.totalCredited / maxCredited) * 100,
          2,
        );
        const paidPct =
          campaign.totalCredited > 0
            ? Math.min((campaign.totalPaid / campaign.totalCredited) * 100, 100)
            : 0;
        return (
          <div
            key={campaign.id}
            className="hover:bg-muted/40 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors"
          >
            <span className="text-muted-foreground w-6 shrink-0 text-right text-xs font-medium tabular-nums">
              {index + 1}.
            </span>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
              <Trophy
                className="size-4 text-emerald-600 dark:text-emerald-400"
                weight="fill"
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Link
                    href={`/competitions/${campaign.slug}`}
                    className="hover:text-brand-cyan not-dark:hover:text-primary truncate text-[13px] font-semibold transition-colors"
                    title={campaign.name}
                  >
                    {campaign.name}
                  </Link>
                  {campaign.isPrivate && (
                    <LockSimple className="text-muted-foreground size-3 shrink-0" />
                  )}
                </span>
                <span className="shrink-0 text-[13px] font-bold tabular-nums">
                  {maskCompactBRL(campaign.totalCredited)}
                </span>
              </div>
              {/* Barra dupla: creditado (trilha) + pago via PIX (preenchimento) */}
              <div className="bg-muted/60 relative h-1.5 overflow-hidden rounded-full">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[var(--brand-cyan)]/35 to-[var(--brand-mint)]/35 not-dark:from-[#089eb8]/30 not-dark:to-[#0eb981]/30"
                  style={{ width: `${barPct}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[var(--brand-cyan)] to-[var(--brand-mint)] transition-[width] duration-700 ease-out not-dark:from-[#089eb8] not-dark:to-[#0eb981]"
                  style={{ width: `${(barPct * paidPct) / 100}%` }}
                />
              </div>
            </div>
            <div className="hidden w-24 shrink-0 flex-col items-end sm:flex">
              <span className="text-xs font-semibold text-cyan-600 tabular-nums dark:text-cyan-400">
                {maskCompactBRL(campaign.totalPaid)}
              </span>
              <span className="text-muted-foreground text-[10px]">
                {Math.round(paidPct)}% pago
              </span>
            </div>
            <span className="text-muted-foreground w-12 shrink-0 text-right text-xs font-semibold tabular-nums">
              {share.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Grid de competições (tab) ─────────────────────────────────────────── */
function CampaignsGrid({
  campaigns,
  totalCredited,
  isLoading,
}: {
  campaigns: FinancialsData["campaignFinancials"];
  totalCredited: number;
  isLoading: boolean;
}) {
  const { maskBRLExact } = useMaskedCurrency()
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-44 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="bg-muted/60 text-muted-foreground flex size-12 items-center justify-center rounded-2xl">
          <Trophy className="size-6" weight="fill" />
        </span>
        <p className="text-muted-foreground text-sm">
          Nenhuma competição encontrada
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {campaigns.map((campaign, index) => {
        const status = campaignStatus(campaign.status);
        const paidPct =
          campaign.totalCredited > 0
            ? Math.round((campaign.totalPaid / campaign.totalCredited) * 100)
            : 0;
        const share =
          totalCredited > 0
            ? (campaign.totalCredited / totalCredited) * 100
            : 0;
        return (
          <div
            key={campaign.id}
            className="glass-card glass-card-hover flex flex-col gap-3 rounded-2xl p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    paidPct >= 100 ? "bg-emerald-500/15" : "bg-cyan-500/15",
                  )}
                >
                  <Trophy
                    className={cn(
                      "size-4",
                      paidPct >= 100
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-cyan-600 dark:text-cyan-400",
                    )}
                    weight="fill"
                  />
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 gap-1 rounded-full text-[10px] font-semibold",
                    status.className,
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", status.dot)} />
                  {status.label}
                </Badge>
                {campaign.isPrivate && (
                  <LockSimple className="text-muted-foreground size-3 shrink-0" />
                )}
              </div>
              <span className="text-muted-foreground shrink-0 text-xs font-medium">
                #{index + 1}
              </span>
            </div>

            <Link
              href={`/competitions/${campaign.slug}`}
              className="hover:text-brand-cyan not-dark:hover:text-primary truncate text-sm font-bold transition-colors"
              title={campaign.name}
            >
              {campaign.name}
            </Link>

            <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px]">
              <span className="inline-flex items-center gap-0.5">
                <Users className="size-3" />
                {campaign.clippersCount}
              </span>
              <span aria-hidden>•</span>
              <span className="inline-flex items-center gap-0.5">
                <Eye className="size-3" />
                {formatCompact(campaign.totalViews)}
              </span>
              {campaign.cpm > 0 && (
                <>
                  <span aria-hidden>•</span>
                  <span className="inline-flex items-center gap-0.5">
                    <Gauge className="size-3" />
                    CPM {maskBRLExact(campaign.cpm)}
                  </span>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2">
                <p className="text-muted-foreground text-[9px] font-semibold tracking-wide uppercase">
                  Creditado
                </p>
                <p className="text-xs font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                  {maskBRLExact(campaign.totalCredited)}
                </p>
              </div>
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-2">
                <p className="text-muted-foreground text-[9px] font-semibold tracking-wide uppercase">
                  Pago (PIX)
                </p>
                <p className="text-xs font-bold text-cyan-600 tabular-nums dark:text-cyan-400">
                  {maskBRLExact(campaign.totalPaid)}
                </p>
              </div>
            </div>

            <div className="flex items-end justify-between gap-2">
              <div className="leading-tight">
                <p
                  className={cn(
                    "text-xs font-bold tabular-nums",
                    campaign.remaining > 0
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {maskBRLExact(campaign.remaining)}
                </p>
                <p className="text-muted-foreground text-[10px]">restante</p>
              </div>
              <Badge
                variant="outline"
                className="border-brand-cyan/25 not-dark:border-primary/30 shrink-0 rounded-full text-[10px] font-bold tabular-nums"
              >
                <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
                  {share.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                </span>
              </Badge>
            </div>

            <div className="bg-muted/60 h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--brand-cyan)] to-[var(--brand-mint)] transition-[width] duration-700 ease-out not-dark:from-[#089eb8] not-dark:to-[#0eb981]"
                style={{ width: `${Math.min(paidPct, 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Tabela de clipadores (tab) ────────────────────────────────────────── */
function ClippersTable({
  clippers,
  isLoading,
}: {
  clippers: FinancialsData["topClippers"];
  isLoading: boolean;
}) {
  const { maskBRLExact } = useMaskedCurrency()
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (clippers.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="bg-muted/60 text-muted-foreground flex size-12 items-center justify-center rounded-2xl">
          <Users className="size-6" weight="fill" />
        </span>
        <p className="text-muted-foreground text-sm">
          Nenhum clipador com movimento financeiro
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-10 text-[10px] font-bold uppercase">
              #
            </TableHead>
            <TableHead className="text-[10px] font-bold uppercase">
              Clipador
            </TableHead>
            <TableHead className="text-right text-[10px] font-bold uppercase">
              Total Ganho
            </TableHead>
            <TableHead className="hidden text-right text-[10px] font-bold uppercase sm:table-cell">
              Pago (PIX)
            </TableHead>
            <TableHead className="hidden text-right text-[10px] font-bold uppercase sm:table-cell">
              Restante
            </TableHead>
            <TableHead className="hidden text-center text-[10px] font-bold uppercase md:table-cell">
              Comp.
            </TableHead>
            <TableHead className="hidden text-right text-[10px] font-bold uppercase lg:table-cell">
              Progresso
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clippers.map((clipper, index) => {
            const paidPct =
              clipper.totalEarned > 0
                ? Math.round((clipper.totalPaid / clipper.totalEarned) * 100)
                : 0;
            return (
              <TableRow key={clipper.id} className="hover:bg-muted/20">
                <TableCell className="py-3">
                  <RankBubble rank={index + 1} />
                </TableCell>
                <TableCell className="py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-8 shrink-0">
                      <AvatarImage
                        src={clipper.imageUrl ?? undefined}
                        alt={clipper.fullName}
                      />
                      <AvatarFallback className="bg-gradient-custom text-[10px] font-bold text-[#04222A]">
                        {clipper.fullName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="max-w-[130px] truncate text-xs font-semibold sm:max-w-[220px]">
                        {clipper.fullName}
                      </p>
                      {clipper.artisticName && (
                        <p className="text-muted-foreground truncate text-[10px]">
                          @{clipper.artisticName}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-3 text-right">
                  <span className="text-xs font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                    {maskBRLExact(clipper.totalEarned)}
                  </span>
                </TableCell>
                <TableCell className="hidden py-3 text-right sm:table-cell">
                  <span className="text-xs font-semibold text-cyan-600 tabular-nums dark:text-cyan-400">
                    {maskBRLExact(clipper.totalPaid)}
                  </span>
                </TableCell>
                <TableCell className="hidden py-3 text-right sm:table-cell">
                  <span
                    className={cn(
                      "text-xs font-semibold tabular-nums",
                      clipper.remaining > 0
                        ? "text-orange-600 dark:text-orange-400"
                        : "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {maskBRLExact(clipper.remaining)}
                  </span>
                </TableCell>
                <TableCell className="hidden py-3 text-center md:table-cell">
                  <Badge
                    variant="secondary"
                    className="rounded-full text-[10px] font-semibold"
                  >
                    {clipper.campaignCount}
                  </Badge>
                </TableCell>
                <TableCell className="hidden py-3 lg:table-cell">
                  <div className="flex items-center justify-end gap-2">
                    <div className="bg-muted/60 h-1.5 w-16 overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--brand-cyan)] to-[var(--brand-mint)] not-dark:from-[#089eb8] not-dark:to-[#0eb981]"
                        style={{ width: `${Math.min(paidPct, 100)}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground w-9 text-right text-[10px] tabular-nums">
                      {paidPct}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/* ── Lista de transações (tab) ─────────────────────────────────────────── */
function TransactionsList({
  transactions,
  isLoading,
}: {
  transactions: FinancialsData["recentTransactions"];
  isLoading: boolean;
}) {
  const { maskBRLExact } = useMaskedCurrency()
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="bg-muted/60 text-muted-foreground flex size-12 items-center justify-center rounded-2xl">
          <Receipt className="size-6" weight="fill" />
        </span>
        <p className="text-muted-foreground text-sm">
          Nenhuma transação com os filtros aplicados
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="text-muted-foreground text-xs">
        Mostrando{" "}
        <span className="text-foreground font-semibold">
          {transactions.length}
        </span>{" "}
        transações mais recentes
      </p>
      <div className="-mr-2 flex max-h-[500px] flex-col gap-1 overflow-y-auto pr-2">
        {transactions.map((tx) => {
          const config = txConfig(tx.type);
          const TxIcon = config.icon;
          const isNegative = tx.amount < 0;
          return (
            <div
              key={tx.id}
              className="hover:bg-muted/40 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors"
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  config.bgColor,
                )}
              >
                <TxIcon className={cn("size-4", config.color)} weight="fill" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Avatar className="size-5 shrink-0">
                    <AvatarImage
                      src={tx.clipperImageUrl ?? undefined}
                      alt={tx.clipperName}
                    />
                    <AvatarFallback className="bg-gradient-custom text-[7px] font-bold text-[#04222A]">
                      {tx.clipperName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm font-semibold">
                    {tx.clipperName}
                  </span>
                  {tx.clipperArtisticName && (
                    <span className="text-muted-foreground hidden truncate text-[10px] sm:inline">
                      @{tx.clipperArtisticName}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-4 rounded-full border-0 px-1.5 py-0 text-[9px] font-semibold",
                      config.bgColor,
                      config.color,
                    )}
                  >
                    {config.label}
                  </Badge>
                  <span className="text-muted-foreground max-w-[130px] truncate text-[10px] sm:max-w-none">
                    {tx.campaignName}
                  </span>
                  <span className="text-muted-foreground/70 text-[10px]">
                    {formatDateTime(tx.createdAt)}
                  </span>
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 text-sm font-bold tabular-nums",
                  isNegative
                    ? "text-cyan-600 dark:text-cyan-400"
                    : "text-emerald-600 dark:text-emerald-400",
                )}
              >
                {isNegative ? "−" : "+"}
                {maskBRLExact(Math.abs(tx.amount))}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ── Tabela de CPM (tab) ───────────────────────────────────────────────── */
function CpmTable({
  campaigns,
  isLoading,
}: {
  campaigns: FinancialsData["campaignFinancials"];
  isLoading: boolean;
}) {
  const { maskBRLExact } = useMaskedCurrency()
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="bg-muted/60 text-muted-foreground flex size-12 items-center justify-center rounded-2xl">
          <Gauge className="size-6" weight="fill" />
        </span>
        <p className="text-muted-foreground text-sm">
          Nenhuma competição com views para calcular CPM
        </p>
      </div>
    );
  }

  const maxCpm = Math.max(...campaigns.map((campaign) => campaign.cpm), 1);

  return (
    <div className="overflow-x-auto rounded-2xl border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-10 text-[10px] font-bold uppercase">
              #
            </TableHead>
            <TableHead className="text-[10px] font-bold uppercase">
              Competição
            </TableHead>
            <TableHead className="text-right text-[10px] font-bold uppercase">
              Creditado
            </TableHead>
            <TableHead className="text-right text-[10px] font-bold uppercase">
              Views
            </TableHead>
            <TableHead className="hidden text-right text-[10px] font-bold uppercase sm:table-cell">
              Posts
            </TableHead>
            <TableHead className="text-right text-[10px] font-bold uppercase">
              CPM
            </TableHead>
            <TableHead className="hidden text-center text-[10px] font-bold uppercase md:table-cell">
              Eficiência
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign, index) => {
            const efficiency = Math.max(0, 100 - (campaign.cpm / maxCpm) * 100);
            const status = campaignStatus(campaign.status);
            return (
              <TableRow key={campaign.id} className="hover:bg-muted/20">
                <TableCell className="py-3">
                  <RankBubble rank={index + 1} tone="amber" />
                </TableCell>
                <TableCell className="py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Link
                      href={`/competitions/${campaign.slug}`}
                      className="hover:text-brand-cyan not-dark:hover:text-primary max-w-[150px] truncate text-xs font-semibold transition-colors sm:max-w-[250px]"
                    >
                      {campaign.name}
                    </Link>
                    {campaign.isPrivate && (
                      <LockSimple className="text-muted-foreground size-3 shrink-0" />
                    )}
                    <Badge
                      variant="outline"
                      className={cn(
                        "hidden shrink-0 rounded-full px-1.5 py-0 text-[8px] font-semibold sm:inline-flex",
                        status.className,
                      )}
                    >
                      {status.label}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="py-3 text-right">
                  <span className="text-xs font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                    {maskBRLExact(campaign.totalCredited)}
                  </span>
                </TableCell>
                <TableCell className="py-3 text-right">
                  <span className="text-xs font-semibold text-cyan-600 tabular-nums dark:text-cyan-400">
                    {formatCompact(campaign.totalViews)}
                  </span>
                </TableCell>
                <TableCell className="hidden py-3 text-right sm:table-cell">
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {campaign.totalPosts.toLocaleString("pt-BR")}
                  </span>
                </TableCell>
                <TableCell className="py-3 text-right">
                  <span className="text-xs font-bold text-amber-600 tabular-nums dark:text-amber-400">
                    {maskBRLExact(campaign.cpm)}
                  </span>
                </TableCell>
                <TableCell className="hidden py-3 md:table-cell">
                  <div className="flex items-center justify-center gap-2">
                    <div className="bg-muted/60 h-1.5 w-14 overflow-hidden rounded-full">
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width] duration-700",
                          efficiency >= 70
                            ? "bg-emerald-500"
                            : efficiency >= 40
                              ? "bg-amber-500"
                              : "bg-orange-500",
                        )}
                        style={{ width: `${efficiency}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        "w-8 text-[10px] font-semibold tabular-nums",
                        efficiency >= 70
                          ? "text-emerald-600 dark:text-emerald-400"
                          : efficiency >= 40
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-orange-600 dark:text-orange-400",
                      )}
                    >
                      {Math.round(efficiency)}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/* ── Maiores premiados ─────────────────────────────────────────────────── */
function TopClippersList({
  clippers,
  isLoading,
}: {
  clippers: FinancialsData["topClippers"];
  isLoading: boolean;
}) {
  const { maskBRLExact } = useMaskedCurrency()
  const maskCompactBRL = useMaskedCompactBRL()
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
            <Skeleton className="hidden h-5 w-24 rounded-full sm:block" />
          </div>
        ))}
      </div>
    );
  }

  if (clippers.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="bg-muted/60 text-muted-foreground flex size-12 items-center justify-center rounded-2xl">
          <Crown className="size-6" weight="fill" />
        </span>
        <p className="text-muted-foreground text-sm">
          Nenhum clipador premiado no período
        </p>
      </div>
    );
  }

  return (
    <div className="-mr-2 flex max-h-[460px] flex-col gap-1 overflow-y-auto pr-2">
      {clippers.map((clipper, index) => {
        const paidPct =
          clipper.totalEarned > 0
            ? Math.round((clipper.totalPaid / clipper.totalEarned) * 100)
            : 0;
        return (
          <div
            key={clipper.id}
            className="hover:bg-muted/40 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors"
          >
            <RankBubble rank={index + 1} />
            <Avatar className="size-9 shrink-0">
              <AvatarImage
                src={clipper.imageUrl ?? undefined}
                alt={clipper.fullName}
              />
              <AvatarFallback className="bg-gradient-custom text-xs font-bold text-[#04222A]">
                {clipper.fullName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {clipper.fullName}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {clipper.campaignCount}{" "}
                {clipper.campaignCount === 1 ? "competição" : "competições"} ·{" "}
                {paidPct}% pago
              </p>
            </div>
            <Badge
              variant="outline"
              className="hidden shrink-0 rounded-full border-emerald-500/30 bg-emerald-500/15 text-[10px] font-bold text-emerald-600 tabular-nums sm:inline-flex dark:text-emerald-400"
            >
              {maskBRLExact(clipper.totalEarned)}
            </Badge>
            <span className="shrink-0 text-xs font-bold text-emerald-600 tabular-nums sm:hidden dark:text-emerald-400">
              {maskCompactBRL(clipper.totalEarned)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Bolinha de ranking (ouro/prata/bronze) ────────────────────────────── */
function RankBubble({
  rank,
  tone = "gold",
}: {
  rank: number;
  tone?: "gold" | "amber";
}) {
  const first =
    tone === "amber"
      ? "bg-amber-500/20 text-amber-600 ring-1 ring-amber-500/30 dark:text-amber-400"
      : "bg-yellow-500/20 text-yellow-600 ring-1 ring-yellow-500/30 dark:text-yellow-400";
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
        rank === 1
          ? first
          : rank === 2
            ? "bg-gray-400/15 text-gray-500 dark:text-gray-400"
            : rank === 3
              ? "bg-amber-700/15 text-amber-700 dark:text-amber-600"
              : "bg-muted/40 text-muted-foreground",
      )}
    >
      {rank}
    </span>
  );
}

/* ── Card de acesso restrito ───────────────────────────────────────────── */
function AccessDeniedCard() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <Reveal immediate>
        <div className="glass-card flex flex-col items-center gap-4 rounded-3xl py-20 text-center">
          <span className="flex size-13 items-center justify-center rounded-2xl bg-red-500/15 text-red-500">
            <ShieldWarning className="size-6" weight="fill" />
          </span>
          <div>
            <p className="text-base font-bold">
              Acesso restrito a administradores
            </p>
            <p className="text-muted-foreground mt-1 max-w-sm text-sm">
              Você não tem permissão para visualizar os dados financeiros. Fale
              com um administrador da Clipfy League.
            </p>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
