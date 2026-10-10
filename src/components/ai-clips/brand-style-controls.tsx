"use client";

import { type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const color =
    value.length === 4
      ? `#${value
          .slice(1)
          .split("")
          .map((char) => char + char)
          .join("")}`
      : value;
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <label
        htmlFor={id}
        className="bg-background/40 focus-within:ring-primary/50 flex h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 focus-within:ring-2"
      >
        <span
          className="relative size-6 shrink-0 overflow-hidden rounded-md border border-white/15 shadow-sm"
          style={{ backgroundColor: color }}
        >
          <input
            id={id}
            aria-label={label}
            type="color"
            value={color}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
        </span>
        <span className="text-muted-foreground font-mono text-xs uppercase">
          {value}
        </span>
      </label>
    </div>
  );
}

export function RangeField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className="text-xs">
          {label}
        </Label>
        <div className="flex items-center gap-1">
          <Input
            id={id}
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            className="h-8 w-[72px] rounded-lg text-right text-xs tabular-nums"
            onChange={(event) => {
              const next = event.target.valueAsNumber;
              if (Number.isFinite(next) && next >= min && next <= max)
                onChange(Math.round(next / step) * step);
            }}
          />
          {suffix && (
            <span className="text-muted-foreground text-[10px]">{suffix}</span>
          )}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        className="accent-primary h-1.5 w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

export function EditorSection({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="bg-card overflow-hidden rounded-2xl border">
      <div className="flex items-start gap-3 border-b p-5">
        <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
          {icon}
        </span>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {description}
          </p>
        </div>
      </div>
      <div className="space-y-6 p-5">{children}</div>
    </section>
  );
}

export function ChoiceButton({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "focus-visible:ring-primary/50 flex min-w-0 flex-col items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50",
        selected
          ? "border-primary/60 bg-primary/10 text-primary"
          : "border-border/70 bg-background/30 text-muted-foreground hover:border-primary/30 hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}
