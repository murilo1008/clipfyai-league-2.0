"use client";

import { useId, useState, type ReactNode } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DarkScope } from "@/components/shared/dark-scope";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type CpmComparisonPoint = {
  date: string;
  campaignCpm: number | null;
  adsCpm: number;
  totalViews: number;
  investment: number;
  estimatedAdsCost: number;
};

type Props = {
  points: CpmComparisonPoint[];
  totalViews: number;
  investment: number;
  equivalentAdsCost: number;
  referenceCpm: number;
  formatMoney: (value: number) => string;
  formatViews: (value: number) => string;
  scope?: "single" | "all";
};

type ChartMode = "cpm" | "cost";

const compactCurrency = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const preciseCurrency = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatAxisMoney(value: number) {
  return (
    "R$ " +
    (Math.abs(value) >= 1_000
      ? compactCurrency.format(value)
      : preciseCurrency.format(value))
  );
}

export function CpmComparisonChart({
  points,
  totalViews,
  investment,
  equivalentAdsCost,
  referenceCpm,
  formatMoney,
  formatViews,
  scope = "single",
}: Props) {
  const [mode, setMode] = useState<ChartMode>("cpm");
  const isMobile = useIsMobile();
  const gradientId = useId().replace(/:/g, "");
  const currentCpm = totalViews > 0 ? (investment / totalViews) * 1_000 : 0;
  const difference = equivalentAdsCost - investment;
  const differencePercent =
    equivalentAdsCost > 0
      ? (Math.abs(difference) / equivalentAdsCost) * 100
      : 0;
  const lastPoint = points.at(-1);
  const cpmValues = points.flatMap((point) =>
    [point.campaignCpm, point.adsCpm].filter(
      (value): value is number => typeof value === "number" && value > 0,
    ),
  );
  const lowestCpm = Math.min(...cpmValues);
  const highestCpm = Math.max(...cpmValues);
  const useLogCpmScale =
    Number.isFinite(lowestCpm) && lowestCpm > 0 && highestCpm / lowestCpm > 20;
  const cpmDomain: [number, number] = [
    Number.isFinite(lowestCpm)
      ? useLogCpmScale
        ? lowestCpm * 0.72
        : Math.max(0, lowestCpm * 0.75)
      : 0,
    Number.isFinite(highestCpm) ? Math.max(2, highestCpm * 1.18) : 20,
  ];
  const cpmLabelsAreClose =
    lastPoint?.campaignCpm != null &&
    Math.abs(lastPoint.campaignCpm - lastPoint.adsCpm) /
      Math.max(1, cpmDomain[1] - cpmDomain[0]) <
      0.06;
  const costLabelsAreClose =
    lastPoint != null &&
    Math.abs(lastPoint.investment - lastPoint.estimatedAdsCost) /
      Math.max(1, lastPoint.estimatedAdsCost) <
      0.12;
  const highestCost = Math.max(
    investment,
    equivalentAdsCost,
    ...points.map((point) => point.estimatedAdsCost),
  );
  const costDomain: [number, number] = [0, Math.max(1, highestCost * 1.08)];
  const showPointMarkers = points.length <= 20;
  let estimatedCostExceededInvestmentAt: string | undefined;
  for (let index = points.length - 1; index >= 0; index--) {
    const point = points[index]!;
    if (point.investment <= 0 || point.estimatedAdsCost < point.investment) {
      break;
    }
    estimatedCostExceededInvestmentAt = point.date;
  }

  return (
    <DarkScope className="contents">
      <div className="border-border/50 relative overflow-hidden rounded-2xl border bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,0.10),transparent_34%),linear-gradient(180deg,rgba(3,19,31,0.94),rgba(3,19,31,0.62))] p-3 sm:p-5">
        <div className="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full bg-violet-500/5 blur-3xl" />

        <div className="relative grid gap-2 sm:grid-cols-3">
          <ChartStat label="Valor investido" value={formatMoney(investment)} />
          <ChartStat label="Views dos cortes" value={formatViews(totalViews)} />
          <ChartStat
            label="CPM dos cortes"
            value={totalViews > 0 ? formatMoney(currentCpm) : "—"}
            emphasis
          />
        </div>

        {totalViews > 0 && referenceCpm > 0 && equivalentAdsCost > 0 && (
          <div className="relative mt-3 grid gap-4 rounded-xl border border-violet-400/20 bg-violet-400/[0.06] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-violet-300 uppercase">
                Comparação estimada com anúncios
              </p>
              <p className="text-foreground mt-1 text-sm font-medium">
                Quanto custariam as mesmas views em anúncios?
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                CPM médio de mercado: {formatMoney(referenceCpm)}
                {scope === "all" && " · ponderado por views"}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-muted-foreground text-xs">
                Custo estimado em anúncios
              </p>
              <p className="text-foreground mt-0.5 text-xl font-bold tracking-tight tabular-nums sm:text-2xl">
                {formatMoney(equivalentAdsCost)}
              </p>
              <p
                className={cn(
                  "mt-1 text-xs font-semibold tabular-nums",
                  difference > 0
                    ? "text-emerald-300"
                    : difference < 0
                      ? "text-amber-300"
                      : "text-muted-foreground",
                )}
              >
                {difference > 0
                  ? `Diferença estimada: ${formatMoney(difference)} · CPM ${differencePercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% menor`
                  : difference < 0
                    ? `Diferença estimada: ${formatMoney(Math.abs(difference))} · CPM ${differencePercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% maior`
                    : "Mesmo valor do investimento"}
              </p>
            </div>
          </div>
        )}

        <div className="relative mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div
            role="group"
            aria-label="Visualização da comparação"
            className="bg-background/60 border-border/70 inline-flex w-full rounded-xl border p-1 sm:w-auto"
          >
            <ModeButton active={mode === "cpm"} onClick={() => setMode("cpm")}>
              CPM por mil views
            </ModeButton>
            <ModeButton
              active={mode === "cost"}
              onClick={() => setMode("cost")}
            >
              Custos acumulados
            </ModeButton>
          </div>
          {estimatedCostExceededInvestmentAt && (
            <Badge className="w-fit border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/10">
              {mode === "cpm"
                ? "CPM abaixo do mercado desde "
                : "Estimativa supera investimento desde "}
              {estimatedCostExceededInvestmentAt}
            </Badge>
          )}
        </div>

        {mode === "cpm" ? (
          <div className="relative mt-4">
            <h3 className="text-foreground text-sm font-semibold">
              Evolução do CPM dos cortes
            </h3>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium md:hidden">
              <LegendItem color="cyan" label="CPM dos cortes" />
              <LegendItem
                color="violet"
                label={
                  scope === "all"
                    ? "CPM médio de mercado ponderado"
                    : "CPM médio de mercado"
                }
                dashed
              />
            </div>
            <div className="mt-4 h-72 w-full min-w-0 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={points}
                  margin={{
                    top: 12,
                    right: isMobile ? 18 : 168,
                    bottom: 4,
                    left: 6,
                  }}
                >
                  <defs>
                    <linearGradient
                      id={`${gradientId}-cpm`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#22d3ee"
                        stopOpacity={0.28}
                      />
                      <stop
                        offset="60%"
                        stopColor="#22d3ee"
                        stopOpacity={0.08}
                      />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="4 5"
                    vertical={false}
                    stroke="rgba(148, 163, 184, 0.18)"
                  />
                  <XAxis
                    dataKey="date"
                    interval="preserveStartEnd"
                    minTickGap={36}
                    tickFormatter={(date: string) =>
                      date.split("/").slice(0, 2).join("/")
                    }
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={{ stroke: "rgba(148, 163, 184, 0.22)" }}
                    tickLine={false}
                    dy={8}
                  />
                  <YAxis
                    scale={useLogCpmScale ? "log" : "linear"}
                    domain={cpmDomain}
                    allowDataOverflow
                    width={72}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatAxisMoney}
                  />
                  <ChartTooltip
                    cursor={{ stroke: "rgba(148, 163, 184, 0.45)" }}
                    content={
                      <CpmTooltip
                        scope={scope}
                        formatMoney={formatMoney}
                        formatViews={formatViews}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="campaignCpm"
                    stroke="none"
                    fill={`url(#${gradientId}-cpm)`}
                    tooltipType="none"
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="campaignCpm"
                    name="CPM dos cortes"
                    stroke="#22d3ee"
                    strokeWidth={3}
                    dot={
                      showPointMarkers
                        ? {
                            r: 3,
                            fill: "#071923",
                            stroke: "#22d3ee",
                            strokeWidth: 2,
                          }
                        : false
                    }
                    activeDot={{
                      r: 6,
                      fill: "#22d3ee",
                      stroke: "#cffafe",
                      strokeWidth: 2,
                    }}
                    isAnimationActive={false}
                  >
                    {!isMobile && (
                      <LabelList
                        dataKey="campaignCpm"
                        content={(props) =>
                          renderEndLabel(props, {
                            lastIndex: points.length - 1,
                            color: "#67e8f9",
                            label: "CPM",
                            value:
                              lastPoint?.campaignCpm == null
                                ? null
                                : formatMoney(lastPoint.campaignCpm),
                            offsetY: cpmLabelsAreClose ? 12 : 0,
                          })
                        }
                      />
                    )}
                  </Line>
                  <Line
                    type="monotone"
                    dataKey="adsCpm"
                    name="CPM médio de mercado"
                    stroke="#a78bfa"
                    strokeWidth={2.5}
                    strokeDasharray="8 6"
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: "#a78bfa",
                      stroke: "#ede9fe",
                      strokeWidth: 2,
                    }}
                    isAnimationActive={false}
                  >
                    {!isMobile && (
                      <LabelList
                        dataKey="adsCpm"
                        content={(props) =>
                          renderEndLabel(props, {
                            lastIndex: points.length - 1,
                            color: "#c4b5fd",
                            label: "Mercado",
                            value: lastPoint
                              ? formatMoney(lastPoint.adsCpm)
                              : null,
                            offsetY: cpmLabelsAreClose ? -12 : 0,
                          })
                        }
                      />
                    )}
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-foreground relative mt-4 text-sm font-semibold">
              Investimento x custo estimado em anúncios
            </h3>

            <div className="relative mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium md:hidden">
              <LegendItem color="cyan" label="Valor investido" />
              <LegendItem color="violet" label="Custo estimado em anúncios" />
            </div>

            <div className="relative mt-4 h-72 w-full min-w-0 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={points}
                  margin={{
                    top: 12,
                    right: isMobile ? 18 : 168,
                    bottom: 4,
                    left: 6,
                  }}
                >
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#a78bfa"
                        stopOpacity={0.28}
                      />
                      <stop
                        offset="60%"
                        stopColor="#a78bfa"
                        stopOpacity={0.08}
                      />
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="4 5"
                    vertical={false}
                    stroke="rgba(148, 163, 184, 0.18)"
                  />
                  <XAxis
                    dataKey="date"
                    interval="preserveStartEnd"
                    minTickGap={36}
                    tickFormatter={(date: string) =>
                      date.split("/").slice(0, 2).join("/")
                    }
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={{ stroke: "rgba(148, 163, 184, 0.22)" }}
                    tickLine={false}
                    dy={8}
                  />
                  <YAxis
                    scale="linear"
                    domain={costDomain}
                    allowDataOverflow
                    width={72}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatAxisMoney}
                  />
                  <ChartTooltip
                    cursor={{ stroke: "rgba(148, 163, 184, 0.45)" }}
                    content={
                      <ComparisonTooltip
                        scope={scope}
                        formatMoney={formatMoney}
                        formatViews={formatViews}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="estimatedAdsCost"
                    stroke="none"
                    fill={"url(#" + gradientId + ")"}
                    tooltipType="none"
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="investment"
                    name="Valor investido"
                    stroke="#22d3ee"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: "#22d3ee",
                      stroke: "#cffafe",
                      strokeWidth: 2,
                    }}
                    isAnimationActive={false}
                  >
                    {!isMobile && (
                      <LabelList
                        dataKey="investment"
                        content={(props) =>
                          renderEndLabel(props, {
                            lastIndex: points.length - 1,
                            color: "#67e8f9",
                            label: "Investido",
                            value: lastPoint
                              ? formatAxisMoney(lastPoint.investment)
                              : null,
                            offsetY: costLabelsAreClose ? 12 : 0,
                          })
                        }
                      />
                    )}
                  </Line>
                  <Line
                    type="monotone"
                    dataKey="estimatedAdsCost"
                    name="Custo estimado em anúncios"
                    stroke="#a78bfa"
                    strokeWidth={3}
                    dot={
                      showPointMarkers
                        ? {
                            r: 3,
                            fill: "#071923",
                            stroke: "#a78bfa",
                            strokeWidth: 2,
                          }
                        : false
                    }
                    activeDot={{
                      r: 6,
                      fill: "#a78bfa",
                      stroke: "#ede9fe",
                      strokeWidth: 2,
                    }}
                    isAnimationActive={false}
                  >
                    {!isMobile && (
                      <LabelList
                        dataKey="estimatedAdsCost"
                        content={(props) =>
                          renderEndLabel(props, {
                            lastIndex: points.length - 1,
                            color: "#c4b5fd",
                            label: "Anúncios estimados",
                            value: lastPoint
                              ? formatAxisMoney(lastPoint.estimatedAdsCost)
                              : null,
                            offsetY: costLabelsAreClose ? -12 : 0,
                          })
                        }
                      />
                    )}
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        <p className="text-muted-foreground relative mt-3 text-[11px] leading-relaxed">
          Período: {points[0]?.date} a {points.at(-1)?.date}
        </p>
      </div>
    </DarkScope>
  );
}

function renderEndLabel(
  props: { index?: number; viewBox?: unknown },
  options: {
    lastIndex: number;
    color: string;
    label: string;
    value: string | null;
    offsetY: number;
  },
) {
  if (props.index !== options.lastIndex || options.value === null) return null;
  const box = props.viewBox;
  if (!box || typeof box !== "object" || !("x" in box) || !("y" in box)) {
    return null;
  }
  const x = Number(box.x);
  const y = Number(box.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return (
    <text
      x={x + 10}
      y={y + options.offsetY}
      dominantBaseline="middle"
      fill={options.color}
      fontSize={11}
      fontWeight={700}
    >
      {options.label} {options.value}
    </text>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none sm:flex-none",
        active
          ? "bg-cyan-400/15 text-cyan-200 shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-white/5",
      )}
    >
      {children}
    </button>
  );
}

function LegendItem({
  color,
  label,
  dashed = false,
}: {
  color: "cyan" | "violet";
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={cn(
          "w-6 border-t-[3px]",
          color === "cyan" ? "border-cyan-400" : "border-violet-400",
          dashed && "border-dashed",
        )}
      />
      {label}
    </span>
  );
}

function CpmTooltip({
  active,
  label,
  payload,
  scope,
  formatMoney,
  formatViews,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ payload?: CpmComparisonPoint }>;
  scope: "single" | "all";
  formatMoney: (value: number) => string;
  formatViews: (value: number) => string;
}) {
  const point = payload?.find((item) => item.payload)?.payload;
  if (!active || !point) return null;

  return (
    <div className="border-border/80 bg-background/95 min-w-56 rounded-xl border p-3 shadow-2xl backdrop-blur-xl">
      <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
        {label}
      </p>
      <div className="space-y-2">
        <TooltipValue
          color="cyan"
          label="CPM dos cortes"
          value={
            point.campaignCpm === null ? "—" : formatMoney(point.campaignCpm)
          }
        />
        <TooltipValue
          color="violet"
          label={
            scope === "all"
              ? "CPM médio de mercado ponderado"
              : "CPM médio de mercado"
          }
          value={formatMoney(point.adsCpm)}
        />
      </div>
      <div className="border-border/60 mt-3 space-y-1.5 border-t pt-2">
        <TooltipRow
          label="Views acumuladas"
          value={formatViews(point.totalViews)}
        />
        <TooltipRow
          label="Valor investido"
          value={formatMoney(point.investment)}
        />
        <p className="text-muted-foreground mt-2 text-[10px]">
          CPM = investimento ÷ views × 1.000
        </p>
      </div>
    </div>
  );
}

function ComparisonTooltip({
  active,
  label,
  payload,
  scope,
  formatMoney,
  formatViews,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ payload?: CpmComparisonPoint }>;
  scope: "single" | "all";
  formatMoney: (value: number) => string;
  formatViews: (value: number) => string;
}) {
  const point = payload?.find((item) => item.payload)?.payload;
  if (!active || !point) return null;

  return (
    <div className="border-border/80 bg-background/95 min-w-56 rounded-xl border p-3 shadow-2xl backdrop-blur-xl">
      <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
        {label}
      </p>
      <div className="space-y-2">
        <TooltipValue
          color="cyan"
          label="Valor investido"
          value={formatMoney(point.investment)}
        />
        <TooltipValue
          color="violet"
          label="Custo estimado em anúncios"
          value={formatMoney(point.estimatedAdsCost)}
        />
      </div>
      <div className="border-border/60 mt-3 space-y-1.5 border-t pt-2">
        <TooltipRow
          label="Views acumuladas"
          value={formatViews(point.totalViews)}
        />
        <TooltipRow
          label={
            scope === "all" ? "CPM médio ponderado" : "CPM médio de mercado"
          }
          value={formatMoney(point.adsCpm)}
        />
        <p className="text-muted-foreground mt-2 text-[10px]">
          Custo estimado = views ÷ 1.000 × CPM médio de mercado
        </p>
      </div>
    </div>
  );
}

function TooltipValue({
  color,
  label,
  value,
}: {
  color: "cyan" | "violet";
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-5 text-xs">
      <span className="flex items-center gap-2">
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            color === "cyan" ? "bg-cyan-400" : "bg-violet-400",
          )}
        />
        {label}
      </span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}

function TooltipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function ChartStat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-4 backdrop-blur-sm",
        emphasis
          ? "border-cyan-400/25 bg-cyan-400/[0.07]"
          : "border-border/50 bg-background/35",
      )}
    >
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="text-foreground mt-1 text-xl font-bold tracking-tight tabular-nums">
        {value}
      </p>
    </div>
  );
}
