"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCompact } from "@/components/shared/count-up";

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});
const chartDayFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
});

/* ── Gráfico de evolução ───────────────────────────────────────────────── */

export function PlaysEvolutionChart({
  points,
}: {
  points: { collectedAt: Date | string; playCount: number }[];
}) {
  const data = points.map((point) => ({
    date: new Date(point.collectedAt).toISOString(),
    playCount: point.playCount,
  }));
  const lastPoint = data[data.length - 1];

  return (
    <div className="h-[240px] w-full sm:h-[300px] lg:h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient
              id="spotify-plays-stroke"
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <stop offset="0%" stopColor="var(--chart-growth-start)" />
              <stop offset="100%" stopColor="var(--chart-growth-end)" />
            </linearGradient>
            <linearGradient id="spotify-plays-fill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--chart-growth-end)"
                stopOpacity={0.28}
              />
              <stop
                offset="55%"
                stopColor="var(--chart-growth-end)"
                stopOpacity={0.08}
              />
              <stop
                offset="100%"
                stopColor="var(--chart-growth-end)"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>

          <CartesianGrid
            vertical={false}
            stroke="color-mix(in oklab, var(--foreground) 7%, transparent)"
            strokeDasharray="0"
          />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) =>
              chartDayFormat.format(new Date(value))
            }
            axisLine={false}
            tickLine={false}
            minTickGap={40}
            tickMargin={10}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <YAxis
            tickFormatter={(value: number) => formatCompact(value)}
            axisLine={false}
            tickLine={false}
            width={48}
            domain={["auto", "auto"]}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <RechartsTooltip
            content={<PlaysTooltip />}
            cursor={{
              stroke: "color-mix(in oklab, var(--foreground) 22%, transparent)",
              strokeDasharray: "4 4",
            }}
          />

          <Area
            type="monotone"
            dataKey="playCount"
            stroke="url(#spotify-plays-stroke)"
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="url(#spotify-plays-fill)"
            animationDuration={650}
            activeDot={{
              r: 4.5,
              fill: "var(--chart-growth-end)",
              stroke: "var(--card)",
              strokeWidth: 2,
            }}
          />

          {lastPoint && (
            <ReferenceDot
              x={lastPoint.date}
              y={lastPoint.playCount}
              shape={<EndDot />}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function EndDot({ cx, cy }: { cx?: number; cy?: number }) {
  if (cx === undefined || cy === undefined) return null;
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={8}
        fill="var(--chart-growth-end)"
        opacity={0.15}
      />
      <circle
        cx={cx}
        cy={cy}
        r={3.5}
        fill="var(--chart-growth-end)"
        stroke="var(--card)"
        strokeWidth={2}
      />
    </g>
  );
}

function PlaysTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value?: number | string }[];
  label?: string | number;
}) {
  if (!active || !payload?.length || !label) return null;

  return (
    <div className="border-border bg-popover/95 min-w-44 rounded-xl border p-3 shadow-xl backdrop-blur-md">
      <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
        {dateTimeFormat.format(new Date(String(label)))}
      </p>
      <div className="flex items-center justify-between gap-6 text-xs">
        <span className="text-muted-foreground inline-flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ background: "var(--chart-growth-end)" }}
          />
          Plays
        </span>
        <span className="text-sm font-bold tabular-nums">
          {Number(payload[0]?.value ?? 0).toLocaleString("pt-BR")}
        </span>
      </div>
    </div>
  );
}
