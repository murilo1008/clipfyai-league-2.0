"use client"

import * as React from "react"
import {
  ArrowsDownUp,
  Calculator,
  ChartPieSlice,
  Coins,
  Eye,
  Info,
  Medal,
  Play,
  Pulse,
  Sparkle,
  TrendUp,
  Trophy,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  SANDBOX_PLATFORMS,
  SANDBOX_STATUSES,
  buildLinearGrowth,
  computeEngagementRate,
  keepPrizesOnPositions,
  newSandboxRowId,
  nextYmd,
  sandboxRankingScore,
  scaleGrowthToTotal,
  uniqueTags,
  type SandboxAccountRow,
  type SandboxCampaign,
  type SandboxData,
  type SandboxGrowthPoint,
  type SandboxMonthlyRow,
  type SandboxPlatform,
  type SandboxPlatformRow,
  type SandboxPostRow,
  type SandboxPrizes,
  type SandboxStats,
} from "@/lib/competition-sandbox"
import { platformConfig } from "@/lib/platform-config"
import { cn } from "@/lib/utils"

import { CAMPAIGN_STATUS_CONFIG, formatMetricFull } from "../../[slug]/shared"
import {
  EditableTable,
  Field,
  ListInput,
  NumberInput,
  SectionCard,
  numberColumn,
  textColumn,
  type EditableColumn,
} from "./sandbox-fields"

type MetricType = SandboxCampaign["rankingMetricType"]

function PlatformSelect({
  value,
  onChange,
  options = SANDBOX_PLATFORMS,
  className,
}: {
  value: SandboxPlatform
  onChange: (value: SandboxPlatform) => void
  options?: readonly SandboxPlatform[]
  className?: string
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as SandboxPlatform)}
    >
      <SelectTrigger
        aria-label="Plataforma"
        className={cn("h-9 w-full cursor-pointer rounded-lg", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((platform) => {
          const PlatformIcon = platformConfig[platform].icon
          return (
            <SelectItem
              key={platform}
              value={platform}
              className="cursor-pointer"
            >
              <PlatformIcon
                className={cn("size-3.5", platformConfig[platform].color)}
              />
              {platformConfig[platform].label}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

function platformColumn<Row extends { platform: SandboxPlatform }>(
  options?: (row: Row) => readonly SandboxPlatform[],
): EditableColumn<Row> {
  return {
    key: "platform",
    header: "Plataforma",
    className: "min-w-36",
    render: (row, update) => (
      <PlatformSelect
        value={row.platform}
        options={options?.(row)}
        onChange={(platform) => update({ platform } as Partial<Row>)}
      />
    ),
  }
}

function sortByRanking<
  Row extends { totalViews: number; engagementRate: number },
>(rows: Row[], metricType: MetricType) {
  return [...rows].sort(
    (a, b) =>
      sandboxRankingScore(metricType, b) - sandboxRankingScore(metricType, a),
  )
}

function SwitchField({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <label
      htmlFor={id}
      className="border-border/60 bg-muted/20 flex h-10 cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 text-sm"
    >
      {label}
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  )
}

/* ============================================================
   Competição
   ============================================================ */

export const CampaignForm = React.memo(function CampaignForm({
  campaign,
  onChange,
}: {
  campaign: SandboxCampaign
  onChange: (campaign: SandboxCampaign) => void
}) {
  const set = <K extends keyof SandboxCampaign>(
    key: K,
    value: SandboxCampaign[K],
  ) => onChange({ ...campaign, [key]: value })

  return (
    <SectionCard
      icon={<Trophy className="size-4" weight="fill" />}
      title="Dados da competição"
      subtitle="Cabeçalho da página: nome, período, plataformas e prêmio"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Nome" htmlFor="sb-name" className="sm:col-span-2">
          <Input
            id="sb-name"
            value={campaign.name}
            maxLength={200}
            onChange={(event) => set("name", event.target.value)}
            className="h-10 rounded-xl"
          />
        </Field>
        <Field
          label="Prêmio total"
          htmlFor="sb-prize"
          hint="Texto livre; vazio esconde o selo"
        >
          <Input
            id="sb-prize"
            value={campaign.totalPrize}
            maxLength={200}
            placeholder="R$ 10.000"
            onChange={(event) => set("totalPrize", event.target.value)}
            className="h-10 rounded-xl"
          />
        </Field>

        <Field label="Status" htmlFor="sb-status">
          <Select
            value={campaign.status}
            onValueChange={(value) =>
              set("status", value as SandboxCampaign["status"])
            }
          >
            <SelectTrigger
              id="sb-status"
              className="h-10 w-full cursor-pointer rounded-xl"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SANDBOX_STATUSES.map((status) => (
                <SelectItem
                  key={status}
                  value={status}
                  className="cursor-pointer"
                >
                  {CAMPAIGN_STATUS_CONFIG[status]?.label ?? status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Métrica do ranking" htmlFor="sb-metric">
          <Select
            value={campaign.rankingMetricType}
            onValueChange={(value) =>
              set("rankingMetricType", value as MetricType)
            }
          >
            <SelectTrigger
              id="sb-metric"
              className="h-10 w-full cursor-pointer rounded-xl"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="VIEWS" className="cursor-pointer">
                Views
              </SelectItem>
              <SelectItem value="VIEWS_X_ENGAGEMENT" className="cursor-pointer">
                Views × Engajamento
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Início" htmlFor="sb-start">
          <Input
            id="sb-start"
            type="date"
            value={campaign.startDate}
            onChange={(event) => set("startDate", event.target.value)}
            className="h-10 rounded-xl"
          />
        </Field>
        <Field label="Fim" htmlFor="sb-end">
          <Input
            id="sb-end"
            type="date"
            value={campaign.endDate}
            onChange={(event) => set("endDate", event.target.value)}
            className="h-10 rounded-xl"
          />
        </Field>

        <Field
          label="Descrição"
          htmlFor="sb-description"
          className="sm:col-span-2 lg:col-span-4"
        >
          <Textarea
            id="sb-description"
            value={campaign.description}
            maxLength={5000}
            rows={3}
            onChange={(event) => set("description", event.target.value)}
            className="rounded-xl"
          />
        </Field>
        <Field
          label="URL da capa"
          htmlFor="sb-cover"
          hint="Vazio esconde a capa"
          className="sm:col-span-2"
        >
          <Input
            id="sb-cover"
            value={campaign.coverImageUrl}
            maxLength={2000}
            placeholder="https://…"
            onChange={(event) => set("coverImageUrl", event.target.value)}
            className="h-10 rounded-xl"
          />
        </Field>
        <Field
          label="Hashtags obrigatórias"
          htmlFor="sb-hashtags"
          hint="Separadas por vírgula"
        >
          <ListInput
            id="sb-hashtags"
            value={campaign.requiredHashtags}
            placeholder="#marca, #campanha"
            onChange={(value) =>
              set("requiredHashtags", uniqueTags(value, "#").slice(0, 50))
            }
          />
        </Field>
        <Field
          label="Menções obrigatórias"
          htmlFor="sb-mentions"
          hint="Separadas por vírgula"
        >
          <ListInput
            id="sb-mentions"
            value={campaign.requiredMentions}
            placeholder="@marca"
            onChange={(value) =>
              set("requiredMentions", uniqueTags(value, "@").slice(0, 50))
            }
          />
        </Field>

        <Field label="Plataformas" className="sm:col-span-2">
          <div className="flex flex-wrap gap-1.5">
            {SANDBOX_PLATFORMS.map((platform) => {
              const config = platformConfig[platform]
              const PlatformIcon = config.icon
              const selected = campaign.platforms.includes(platform)
              return (
                <button
                  key={platform}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    set(
                      "platforms",
                      selected
                        ? campaign.platforms.filter((p) => p !== platform)
                        : SANDBOX_PLATFORMS.filter(
                            (p) =>
                              p === platform || campaign.platforms.includes(p),
                          ),
                    )
                  }
                  className={cn(
                    "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors",
                    selected
                      ? cn(config.borderColor, config.bgColor, config.color)
                      : "border-border/60 text-muted-foreground hover:bg-muted/40",
                  )}
                >
                  <PlatformIcon className="size-3.5" />
                  {config.label}
                </button>
              )
            })}
          </div>
        </Field>
        <SwitchField
          id="sb-private"
          label="Competição privada"
          checked={campaign.isPrivate}
          onCheckedChange={(checked) => set("isPrivate", checked)}
        />
        <SwitchField
          id="sb-pro"
          label="Exclusivo PRO"
          checked={campaign.isProOnly}
          onCheckedChange={(checked) => set("isProOnly", checked)}
        />
      </div>
    </SectionCard>
  )
})

/* ============================================================
   KPIs
   ============================================================ */

const STAT_FIELDS: Array<{
  key: keyof SandboxStats
  label: string
  decimals?: number
}> = [
  { key: "totalViews", label: "Total de views" },
  { key: "totalLikes", label: "Likes" },
  { key: "totalComments", label: "Comentários" },
  { key: "totalShares", label: "Compartilhamentos" },
  { key: "totalSaves", label: "Saves" },
  { key: "totalClippers", label: "Clipadores ativos" },
  { key: "totalPosts", label: "Posts submetidos" },
  { key: "engagementRate", label: "Engajamento geral (%)", decimals: 2 },
]

export const StatsForm = React.memo(function StatsForm({
  stats,
  onChange,
}: {
  stats: SandboxStats
  onChange: (stats: SandboxStats) => void
}) {
  const computedRate = computeEngagementRate(stats)

  return (
    <SectionCard
      icon={<Eye className="size-4" weight="fill" />}
      title="KPIs"
      subtitle="Cards do topo e engajamento geral"
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 cursor-pointer rounded-xl"
          disabled={computedRate === stats.engagementRate}
          title="(likes + comentários + compartilhamentos + saves) ÷ views"
          onClick={() => onChange({ ...stats, engagementRate: computedRate })}
        >
          <Calculator className="size-3.5" />
          Recalcular engajamento ({computedRate.toFixed(2)}%)
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAT_FIELDS.map((field) => (
          <Field
            key={field.key}
            label={field.label}
            htmlFor={`sb-${field.key}`}
          >
            <NumberInput
              id={`sb-${field.key}`}
              value={stats[field.key]}
              decimals={field.decimals}
              onChange={(value) => onChange({ ...stats, [field.key]: value })}
              className="h-10 rounded-xl"
            />
          </Field>
        ))}
      </div>
    </SectionCard>
  )
})

/* ============================================================
   Premiações
   ============================================================ */

export const PrizesForm = React.memo(function PrizesForm({
  prizes,
  onChange,
}: {
  prizes: SandboxPrizes
  onChange: (prizes: SandboxPrizes) => void
}) {
  const set = <K extends keyof SandboxPrizes>(
    key: K,
    value: SandboxPrizes[K],
  ) => onChange({ ...prizes, [key]: value })

  const groups = [
    {
      icon: <Coins className="size-4" weight="fill" />,
      title: "Premiação diária",
      enabled: "dailyEnabled",
      fields: [
        { key: "dailyTopCount", label: "Top posições" },
        { key: "dailyTotalPrize", label: "Prêmio diário (R$)", decimals: 2 },
      ],
    },
    {
      icon: <Trophy className="size-4" weight="fill" />,
      title: "Premiação mensal",
      enabled: "monthlyEnabled",
      fields: [
        { key: "monthlyTopCount", label: "Top posições" },
        { key: "monthlyTotalPrize", label: "Prêmio mensal (R$)", decimals: 2 },
      ],
    },
    {
      icon: <Medal className="size-4" weight="fill" />,
      title: "Bônus por marco",
      enabled: "bonusEnabled",
      fields: [
        { key: "bonusMilestone", label: "Marco (views)" },
        { key: "bonusAmount", label: "Bônus (R$)", decimals: 2 },
      ],
    },
  ] as const

  return (
    <SectionCard
      icon={<Sparkle className="size-4" weight="fill" />}
      title="Premiações"
      subtitle="Cards de premiação da visão geral"
    >
      <div className="grid gap-3 lg:grid-cols-3">
        {groups.map((group) => (
          <div
            key={group.title}
            className="border-border/60 bg-muted/10 flex flex-col gap-3 rounded-2xl border p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-sm font-bold">
                {group.icon}
                {group.title}
              </span>
              <Switch
                aria-label={`Exibir ${group.title.toLowerCase()}`}
                checked={prizes[group.enabled]}
                onCheckedChange={(checked) => set(group.enabled, checked)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {group.fields.map((field) => (
                <Field
                  key={field.key}
                  label={field.label}
                  htmlFor={`sb-${field.key}`}
                >
                  <NumberInput
                    id={`sb-${field.key}`}
                    value={prizes[field.key]}
                    decimals={"decimals" in field ? field.decimals : 0}
                    disabled={!prizes[group.enabled]}
                    onChange={(value) => set(field.key, value)}
                  />
                </Field>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
})

/* ============================================================
   Distribuição por plataforma
   ============================================================ */

export const PlatformDistributionForm = React.memo(
  function PlatformDistributionForm({
    rows,
    onChange,
  }: {
    rows: SandboxPlatformRow[]
    onChange: (rows: SandboxPlatformRow[]) => void
  }) {
    const usedKey = rows.map((row) => row.platform).join(",")
    const free = SANDBOX_PLATFORMS.filter(
      (platform) => !rows.some((row) => row.platform === platform),
    )

    // Só muda quando muda o conjunto de redes (opções do select)
    const columns = React.useMemo<EditableColumn<SandboxPlatformRow>[]>(() => {
      const used = new Set(usedKey.split(","))
      return [
        platformColumn((row) =>
          SANDBOX_PLATFORMS.filter(
            (platform) => platform === row.platform || !used.has(platform),
          ),
        ),
        numberColumn("views", "Views"),
        numberColumn("posts", "Posts"),
        numberColumn("likes", "Likes"),
        numberColumn("comments", "Comentários"),
        numberColumn("shares", "Compart."),
        numberColumn("saves", "Saves"),
      ]
    }, [usedKey])

    return (
      <SectionCard
        icon={<ChartPieSlice className="size-4" weight="fill" />}
        title="Distribuição por plataforma"
        subtitle="Gráfico de pizza e taxa de engajamento por rede"
      >
        <EditableTable
          rows={rows}
          columns={columns}
          onChange={onChange}
          maxRows={SANDBOX_PLATFORMS.length}
          showPosition={false}
          addLabel="Adicionar plataforma"
          emptyLabel="Nenhuma plataforma: o gráfico de pizza fica oculto"
          newRow={
            free[0]
              ? () => ({
                  id: newSandboxRowId(),
                  platform: free[0]!,
                  posts: 0,
                  views: 0,
                  likes: 0,
                  comments: 0,
                  shares: 0,
                  saves: 0,
                })
              : undefined
          }
        />
      </SectionCard>
    )
  },
)

/* ============================================================
   Crescimento de views
   ============================================================ */

export const GrowthForm = React.memo(function GrowthForm({
  growth,
  growthPlatforms,
  platformDistribution,
  startDate,
  endDate,
  targetTotal,
  onChange,
}: {
  growth: SandboxGrowthPoint[]
  growthPlatforms: SandboxPlatform[]
  platformDistribution: SandboxPlatformRow[]
  startDate: string
  endDate: string
  /** Total de views dos KPIs (alvo de "Ajustar" e "Gerar curva"). */
  targetTotal: number
  onChange: (patch: Pick<SandboxData, "growth" | "growthPlatforms">) => void
}) {
  const lastTotal = growth.at(-1)?.total ?? 0

  const setPoints = (points: SandboxGrowthPoint[]) =>
    onChange({ growth: points, growthPlatforms })

  const togglePlatform = (platform: SandboxPlatform) => {
    const enabled = growthPlatforms.includes(platform)
    const nextPlatforms = enabled
      ? growthPlatforms.filter((p) => p !== platform)
      : SANDBOX_PLATFORMS.filter(
          (p) => p === platform || growthPlatforms.includes(p),
        )
    onChange({
      growthPlatforms: nextPlatforms,
      growth: growth.map((point) => {
        const next = { ...point }
        if (enabled) delete next[platform]
        else next[platform] = 0
        return next
      }),
    })
  }

  const generate = () => {
    const shares: Partial<Record<SandboxPlatform, number>> = {}
    for (const row of platformDistribution) {
      if (growthPlatforms.includes(row.platform))
        shares[row.platform] = row.views
    }
    const points = buildLinearGrowth({
      startDate,
      endDate,
      total: targetTotal,
      shares,
    })
    if (points.length === 0) {
      toast.error("Não foi possível gerar a curva", {
        description:
          "Preencha início e fim da competição (o fim não pode ser antes do início).",
      })
      return
    }
    if (
      growth.length > 0 &&
      !window.confirm(
        `Substituir os ${growth.length} pontos atuais por uma curva linear de ${points.length} dias?`,
      )
    ) {
      return
    }
    setPoints(points)
  }

  const columns = React.useMemo<EditableColumn<SandboxGrowthPoint>[]>(
    () => [
      {
        key: "date",
        header: "Dia",
        className: "min-w-36",
        render: (row, update) => (
          <Input
            type="date"
            aria-label="Dia"
            value={row.date}
            onChange={(event) => update({ date: event.target.value })}
            className="h-9 rounded-lg"
          />
        ),
      },
      numberColumn("total", "Total acumulado"),
      ...growthPlatforms.map(
        (platform): EditableColumn<SandboxGrowthPoint> => ({
          key: platform,
          header: platformConfig[platform].label,
          className: "min-w-28",
          render: (row, update) => (
            <NumberInput
              aria-label={platformConfig[platform].label}
              value={row[platform] ?? 0}
              onChange={(value) => update({ [platform]: value })}
            />
          ),
        }),
      ),
    ],
    [growthPlatforms],
  )

  return (
    <SectionCard
      icon={<TrendUp className="size-4" weight="bold" />}
      title="Crescimento de views"
      subtitle="Views acumuladas por dia (o gráfico mostra a soma até cada dia)"
      actions={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 cursor-pointer rounded-xl"
            disabled={growth.length === 0 || lastTotal === targetTotal}
            title="Multiplica todos os pontos para o último dia bater com o total de views dos KPIs"
            onClick={() => setPoints(scaleGrowthToTotal(growth, targetTotal))}
          >
            <Calculator className="size-3.5" />
            Ajustar ao total ({formatMetricFull(targetTotal)})
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 cursor-pointer rounded-xl"
            title="Substitui os pontos por uma curva linear do início ao fim da competição"
            onClick={generate}
          >
            <TrendUp className="size-3.5" />
            Gerar curva linear
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground mr-1 text-xs">
          Linhas por rede:
        </span>
        {SANDBOX_PLATFORMS.map((platform) => {
          const config = platformConfig[platform]
          const PlatformIcon = config.icon
          const selected = growthPlatforms.includes(platform)
          return (
            <button
              key={platform}
              type="button"
              aria-pressed={selected}
              onClick={() => togglePlatform(platform)}
              className={cn(
                "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition-colors",
                selected
                  ? cn(config.borderColor, config.bgColor, config.color)
                  : "border-border/60 text-muted-foreground hover:bg-muted/40",
              )}
            >
              <PlatformIcon className="size-3" />
              {config.label}
            </button>
          )
        })}
      </div>
      <EditableTable
        rows={growth}
        columns={columns}
        onChange={setPoints}
        maxRows={1000}
        showPosition={false}
        addLabel="Adicionar dia"
        emptyLabel="Sem pontos: o gráfico de crescimento fica oculto"
        newRow={() => {
          const last = growth.at(-1)
          const point: SandboxGrowthPoint = {
            id: newSandboxRowId(),
            date: nextYmd(last?.date),
            total: last?.total ?? 0,
          }
          for (const platform of growthPlatforms) {
            point[platform] = last?.[platform] ?? 0
          }
          return point
        }}
      />
    </SectionCard>
  )
})

/* ============================================================
   Rankings e posts
   ============================================================ */

function RankingActions<
  Row extends {
    totalViews: number
    totalLikes: number
    totalComments: number
    totalShares: number
    totalSaves?: number
    engagementRate: number
  },
>({
  rows,
  metricType,
  onChange,
}: {
  rows: Row[]
  metricType: MetricType
  onChange: (rows: Row[]) => void
}) {
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 cursor-pointer rounded-xl"
        disabled={rows.length < 2}
        onClick={() => onChange(sortByRanking(rows, metricType))}
      >
        <ArrowsDownUp className="size-3.5" />
        {metricType === "VIEWS_X_ENGAGEMENT"
          ? "Ordenar por score"
          : "Ordenar por views"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 cursor-pointer rounded-xl"
        disabled={rows.length === 0}
        title="(likes + comentários + compartilhamentos + saves) ÷ views de cada linha"
        onClick={() =>
          onChange(
            rows.map((row) => ({
              ...row,
              engagementRate: computeEngagementRate(row),
            })),
          )
        }
      >
        <Calculator className="size-3.5" />
        Recalcular ER
      </Button>
    </>
  )
}

function PositionHint({ children }: { children?: React.ReactNode }) {
  return (
    <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
      <Info className="mt-0.5 size-3.5 shrink-0" />
      <span>
        {children ??
          "A posição é a ordem das linhas: use as setas ou o botão de ordenar."}
      </span>
    </p>
  )
}

const MONTHLY_COLUMNS: EditableColumn<SandboxMonthlyRow>[] = [
  textColumn("clipperName", "Nome"),
  textColumn("clipperUsername", "@usuário", { className: "min-w-32" }),
  textColumn("clanTag", "Clã", { className: "min-w-20", maxLength: 20 }),
  numberColumn("totalViews", "Views", { className: "min-w-32" }),
  numberColumn("totalLikes", "Likes"),
  numberColumn("totalComments", "Coment."),
  numberColumn("totalShares", "Compart."),
  numberColumn("totalSaves", "Saves"),
  numberColumn("postsCount", "Posts", { className: "min-w-20" }),
  numberColumn("engagementRate", "ER (%)", {
    decimals: 2,
    className: "min-w-24",
  }),
  numberColumn("prize", "Prêmio da posição (R$)", {
    decimals: 2,
    className: "min-w-32",
  }),
  textColumn("clipperImageUrl", "URL da foto", {
    className: "min-w-48",
    placeholder: "https://…",
    maxLength: 2000,
  }),
]

export const MonthlyRankingForm = React.memo(function MonthlyRankingForm({
  rows,
  metricType,
  onChange,
}: {
  rows: SandboxMonthlyRow[]
  metricType: MetricType
  onChange: (rows: SandboxMonthlyRow[]) => void
}) {
  // Reordenar/remover não leva o prêmio junto: ele é da posição
  const handleChange = (next: SandboxMonthlyRow[]) =>
    onChange(keepPrizesOnPositions(rows, next))

  return (
    <SectionCard
      icon={<Trophy className="size-4" weight="fill" />}
      title="Ranking mensal"
      subtitle="Clipadores, métricas e prêmio de cada posição"
      actions={
        <RankingActions
          rows={rows}
          metricType={metricType}
          onChange={handleChange}
        />
      }
    >
      <PositionHint>
        A posição é a ordem das linhas: use as setas ou o botão de ordenar. O
        prêmio fica na posição; o clipador que sobe ou desce passa a mostrar o
        prêmio da nova posição.
      </PositionHint>
      <EditableTable
        rows={rows}
        columns={MONTHLY_COLUMNS}
        onChange={handleChange}
        maxRows={200}
        addLabel="Adicionar clipador"
        emptyLabel="Nenhum clipador no ranking"
        newRow={() => ({
          id: newSandboxRowId(),
          clipperName: "Novo clipador",
          clipperUsername: "",
          clipperImageUrl: "",
          clanTag: "",
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          totalSaves: 0,
          postsCount: 0,
          engagementRate: 0,
          prize: 0,
        })}
      />
    </SectionCard>
  )
})

const ACCOUNT_COLUMNS: EditableColumn<SandboxAccountRow>[] = [
  textColumn("username", "@usuário"),
  platformColumn(),
  numberColumn("totalViews", "Views", { className: "min-w-32" }),
  numberColumn("totalLikes", "Likes"),
  numberColumn("totalComments", "Coment."),
  numberColumn("totalShares", "Compart."),
  numberColumn("totalSaves", "Saves"),
  numberColumn("postsCount", "Posts", { className: "min-w-20" }),
  numberColumn("engagementRate", "ER (%)", {
    decimals: 2,
    className: "min-w-24",
  }),
]

export const AccountsRankingForm = React.memo(function AccountsRankingForm({
  rows,
  metricType,
  onChange,
}: {
  rows: SandboxAccountRow[]
  metricType: MetricType
  onChange: (rows: SandboxAccountRow[]) => void
}) {
  return (
    <SectionCard
      icon={<Pulse className="size-4" weight="bold" />}
      title="Ranking de contas"
      subtitle="Perfis por rede social"
      actions={
        <RankingActions
          rows={rows}
          metricType={metricType}
          onChange={onChange}
        />
      }
    >
      <PositionHint />
      <EditableTable
        rows={rows}
        columns={ACCOUNT_COLUMNS}
        onChange={onChange}
        maxRows={200}
        addLabel="Adicionar conta"
        emptyLabel="Nenhuma conta no ranking"
        newRow={(): SandboxAccountRow => ({
          id: newSandboxRowId(),
          username: "nova.conta",
          platform: "INSTAGRAM",
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          totalSaves: 0,
          postsCount: 0,
          engagementRate: 0,
        })}
      />
    </SectionCard>
  )
})

const POST_COLUMNS: EditableColumn<SandboxPostRow>[] = [
  textColumn("clipperName", "Clipador"),
  textColumn("username", "@usuário", { className: "min-w-32" }),
  platformColumn(),
  numberColumn("views", "Views", { className: "min-w-32" }),
  numberColumn("likes", "Likes"),
  numberColumn("comments", "Coment."),
  numberColumn("shares", "Compart."),
  {
    key: "postedAt",
    header: "Postado em",
    className: "min-w-36",
    render: (row, update) => (
      <Input
        type="date"
        aria-label="Postado em"
        value={row.postedAt}
        onChange={(event) => update({ postedAt: event.target.value })}
        className="h-9 rounded-lg"
      />
    ),
  },
  {
    key: "thumbnailUrl",
    header: "URL da thumbnail",
    className: "min-w-48",
    render: (row, update) => (
      <Input
        aria-label="URL da thumbnail"
        value={row.thumbnailUrl}
        maxLength={2000}
        placeholder={
          row.sourcePostId ? "Vazio = thumbnail atual do post" : "https://…"
        }
        onChange={(event) => update({ thumbnailUrl: event.target.value })}
        className="h-9 rounded-lg"
      />
    ),
  },
  textColumn("url", "Link do post", {
    className: "min-w-48",
    placeholder: "https://…",
    maxLength: 2000,
  }),
]

export const TopPostsForm = React.memo(function TopPostsForm({
  rows,
  onChange,
}: {
  rows: SandboxPostRow[]
  onChange: (rows: SandboxPostRow[]) => void
}) {
  return (
    <SectionCard
      icon={<Play className="size-4" weight="fill" />}
      title="Top posts"
      subtitle="Cards de posts, na ordem das linhas"
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 cursor-pointer rounded-xl"
          disabled={rows.length < 2}
          onClick={() => onChange([...rows].sort((a, b) => b.views - a.views))}
        >
          <ArrowsDownUp className="size-3.5" />
          Ordenar por views
        </Button>
      }
    >
      <EditableTable
        rows={rows}
        columns={POST_COLUMNS}
        onChange={onChange}
        maxRows={100}
        addLabel="Adicionar post"
        emptyLabel="Nenhum post"
        newRow={(): SandboxPostRow => ({
          id: newSandboxRowId(),
          sourcePostId: "",
          url: "",
          thumbnailUrl: "",
          platform: "INSTAGRAM",
          username: "",
          clipperName: "Novo clipador",
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          postedAt: "",
        })}
      />
    </SectionCard>
  )
})
