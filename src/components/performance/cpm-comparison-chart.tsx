"use client";

import { Info } from "@phosphor-icons/react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DarkScope } from "@/components/shared/dark-scope";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const seriesName =
    scope === "all" ? "CPM das competições" : "CPM da competição";
  const reachHint =
    scope === "all"
      ? "Alcance acumulado das competições"
      : "Alcance acumulado da competição";
  const investmentHint =
    scope === "all"
      ? "Soma das competições"
      : "Valor cadastrado para a competição";
  const positiveCpmValues = points.flatMap((point) =>
    [point.campaignCpm, point.adsCpm].filter(
      (value): value is number => typeof value === "number" && value > 0,
    ),
  );
  const lowestCpm = Math.min(...positiveCpmValues);
  const highestCpm = Math.max(...positiveCpmValues);
  const cpmDomain: [number, number] = [
    Math.max(0.1, Number.isFinite(lowestCpm) ? lowestCpm * 0.72 : 1),
    Math.max(
      2,
      Number.isFinite(highestCpm) ? highestCpm * 1.35 : referenceCpm || 20,
    ),
  ];
  const showPointMarkers = points.length <= 20;
  const efficiencyReachedAt = points.find(
    (point) =>
      point.campaignCpm !== null &&
      point.campaignCpm > 0 &&
      point.adsCpm > 0 &&
      point.campaignCpm <= point.adsCpm,
  )?.date;

  return (
    <DarkScope className="contents">
      <div className="border-border/50 relative overflow-hidden rounded-2xl border bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,0.10),transparent_34%),linear-gradient(180deg,rgba(3,19,31,0.94),rgba(3,19,31,0.62))] p-3 sm:p-5">
        <div className="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full bg-violet-500/5 blur-3xl" />

        <div className="relative mb-5 grid gap-2 sm:grid-cols-3">
          <ChartStat
            label="Visualizações geradas"
            value={formatViews(totalViews)}
            hint={reachHint}
          />
          <ChartStat
            label="Investimento total"
            value={formatMoney(investment)}
            hint={investmentHint}
          />
          <ChartStat
            label="Custo equivalente em ADS"
            value={formatMoney(equivalentAdsCost)}
            hint={`Para as mesmas views a ${formatMoney(referenceCpm)} CPM`}
          />
        </div>

        <div className="relative mb-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium">
            <span className="flex items-center gap-2 text-cyan-300">
              <span className="h-1 w-7 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.75)]" />
              {seriesName}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground cursor-help"
                      aria-label="Como o CPM é calculado"
                    >
                      <Info className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-64">
                    CPM = investimento ÷ visualizações × 1.000
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span>
            <span className="flex items-center gap-2 text-violet-300">
              <span className="w-7 border-t-2 border-dashed border-violet-400" />
              Referência de ADS
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {efficiencyReachedAt && (
              <Badge className="border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/10">
                CPM eficiente desde {efficiencyReachedAt}
              </Badge>
            )}
            <Badge
              variant="outline"
              className="border-border/70 bg-background/60 text-muted-foreground rounded-full text-[10px]"
            >
              Escala logarítmica
            </Badge>
          </div>
        </div>

        <div className="relative h-72 w-full min-w-0 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={points}
              margin={{ top: 12, right: 18, bottom: 4, left: 6 }}
            >
              <defs>
                <linearGradient
                  id="campaignCpmArea"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.32} />
                  <stop offset="55%" stopColor="#22d3ee" stopOpacity={0.1} />
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
                scale="log"
                domain={cpmDomain}
                allowDataOverflow
                width={64}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) =>
                  `R$ ${Number(value).toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                }
              />
              <ChartTooltip
                cursor={{ stroke: "rgba(148, 163, 184, 0.45)" }}
                content={
                  <CpmTooltip
                    formatMoney={formatMoney}
                    formatViews={formatViews}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="campaignCpm"
                name="CPM da competição"
                stroke="none"
                fill="url(#campaignCpmArea)"
                isAnimationActive
                animationDuration={700}
                tooltipType="none"
              />
              <Line
                type="monotone"
                dataKey="campaignCpm"
                name="CPM da competição"
                stroke="#22d3ee"
                strokeWidth={4}
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
                isAnimationActive
                animationDuration={700}
              />
              <Line
                type="monotone"
                dataKey="adsCpm"
                name="Referência de ADS"
                stroke="#a78bfa"
                strokeWidth={3}
                strokeDasharray="8 6"
                dot={false}
                activeDot={{
                  r: 5,
                  fill: "#a78bfa",
                  stroke: "#ede9fe",
                  strokeWidth: 2,
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-muted-foreground mt-3 text-[11px] leading-relaxed">
          Período: {points[0]?.date} a {points.at(-1)?.date}
        </p>
      </div>
    </DarkScope>
  );
}

function CpmTooltip({
  active,
  label,
  payload,
  formatMoney,
  formatViews,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{
    dataKey?: string | number;
    name?: string;
    value?: number | string;
    color?: string;
    payload?: {
      estimatedAdsCost?: number;
      totalViews?: number;
      investment?: number;
    };
  }>;
  formatMoney: (value: number) => string;
  formatViews: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const uniquePayload = payload.filter(
    (item, index, items) =>
      items.findIndex((candidate) => candidate.dataKey === item.dataKey) ===
      index,
  );
  const point = payload[0]?.payload;

  return (
    <div className="border-border/80 bg-background/95 min-w-52 rounded-xl border p-3 shadow-2xl backdrop-blur-xl">
      <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
        {label}
      </p>
      <div className="space-y-2">
        {uniquePayload.map((item) => (
          <div
            key={String(item.dataKey)}
            className="flex items-center justify-between gap-5 text-sm"
          >
            <span className="flex items-center gap-2 text-xs">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.name}
            </span>
            <span className="font-bold tabular-nums">
              {formatMoney(Number(item.value) || 0)}
            </span>
          </div>
        ))}
      </div>
      <div className="border-border/60 mt-3 space-y-1.5 border-t pt-2 text-xs">
        <TooltipRow
          label="Views acumuladas"
          value={formatViews(Number(point?.totalViews ?? 0))}
        />
        <TooltipRow
          label="Investimento total"
          value={formatMoney(Number(point?.investment ?? 0))}
        />
        <TooltipRow
          label="Custo equivalente em ADS"
          value={formatMoney(Number(point?.estimatedAdsCost ?? 0))}
        />
        <p className="text-muted-foreground mt-2 text-[10px]">
          CPM = investimento ÷ visualizações × 1.000
        </p>
      </div>
    </div>
  );
}

function TooltipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function ChartStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="border-border/50 bg-background/35 rounded-xl border px-4 py-3 backdrop-blur-sm">
      <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
        {label}
      </p>
      <p className="text-foreground mt-1 text-lg font-bold tracking-tight tabular-nums">
        {value}
      </p>
      <p className="text-muted-foreground mt-0.5 text-[10px]">{hint}</p>
    </div>
  );
}
