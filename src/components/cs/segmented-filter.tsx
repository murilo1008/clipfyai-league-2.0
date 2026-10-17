"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  count?: number;
  icon?: React.ReactNode;
};

/**
 * Filtro segmentado em pílulas: ativo com o gradiente da marca, contagem em
 * badge e rolagem horizontal no mobile (sem quebrar linha nem mostrar barra).
 */
export function SegmentedFilter<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-semibold whitespace-nowrap transition-all duration-200",
              "focus-visible:ring-brand-cyan/50 focus-visible:ring-2 focus-visible:outline-none",
              active
                ? "bg-gradient-custom border-transparent text-[#04222A] shadow-[0_8px_24px_-12px_var(--brand-cyan)]"
                : "border-border/70 bg-background/40 text-muted-foreground hover:text-foreground hover:border-[color-mix(in_oklab,var(--brand-cyan)_40%,transparent)]",
            )}
          >
            {option.icon}
            {option.label}
            {typeof option.count === "number" && (
              <span
                className={cn(
                  "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums",
                  active ? "bg-[#04222A]/15" : "bg-muted text-foreground/70",
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
