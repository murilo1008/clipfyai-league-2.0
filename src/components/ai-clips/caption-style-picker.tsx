"use client";

import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { CaptionSample } from "./caption-sample";
import {
  type CaptionTemplate,
  previewCaptionStyle,
} from "./caption-preview-utils";
import { fallbackTemplateOption } from "./brand-kit-utils";

export function CaptionStylePicker({
  templates,
  value,
  onValueChange,
  disabled = false,
  loading = false,
  allowDefault = false,
}: {
  templates: CaptionTemplate[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
  allowDefault?: boolean;
}) {
  const fallback = fallbackTemplateOption(value, templates);
  const choices = [
    ...(allowDefault
      ? [
          {
            key: "__default__",
            name: "Padrão Clipfy",
            description: "Usar o estilo padrão",
            template: templates.find((template) => template.isDefault),
          },
        ]
      : []),
    ...templates.map((template) => ({
      key: template.key,
      name: template.name,
      description: template.description,
      template,
    })),
    ...((!allowDefault || value !== "__default__") && fallback.needsFallback
      ? [
          {
            key: fallback.value,
            name: fallback.name,
            description: "Estilo atual",
            template: undefined,
          },
        ]
      : []),
  ];
  if (loading)
    return (
      <div
        className="grid grid-cols-2 gap-3"
        aria-label="Carregando estilos de legenda"
        aria-busy="true"
      >
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  return (
    <div
      role="group"
      aria-label="Estilo da legenda"
      className={cn(
        "grid grid-cols-2 gap-3",
        choices.length > 2 && "sm:grid-cols-3",
      )}
    >
      {choices.map((choice) => {
        const selected =
          choice.key === (value === "__default__" ? value : fallback.value);
        return (
          <button
            type="button"
            key={choice.key}
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onValueChange(choice.key)}
            className={cn(
              "group focus-visible:ring-primary/50 relative min-w-0 overflow-hidden rounded-xl border text-left transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none",
              selected
                ? "border-primary/70 bg-primary/5 ring-primary/15 ring-2"
                : "border-border/70 bg-background/30 hover:border-primary/40 hover:bg-muted/40",
            )}
          >
            <span className="relative flex h-20 items-center justify-center overflow-hidden bg-gradient-to-br from-slate-800 to-slate-950 px-3 text-sm">
              <span className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(45,212,191,0.12),transparent_70%)]" />
              <CaptionSample
                style={previewCaptionStyle(choice.template)}
                loop
                className="relative"
              />
              {selected && (
                <span className="bg-primary text-primary-foreground absolute top-2 right-2 flex size-4 items-center justify-center rounded-full">
                  <Check className="size-3" />
                </span>
              )}
            </span>
            <span className="block px-3 py-2.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                {choice.key === "__default__" && (
                  <Sparkles className="size-3 shrink-0" />
                )}
                <span className="truncate">{choice.name}</span>
              </span>
              <span className="text-muted-foreground mt-1 line-clamp-2 block text-[10px] leading-relaxed">
                {choice.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
