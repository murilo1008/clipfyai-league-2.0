"use client";

import { useId, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  ImageIcon,
  Pause,
  Play,
  RotateCcw,
  Scan,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { type ResolvedIntroTitle } from "@/server/league-clips/contracts";
import { BrandPreview } from "./brand-preview";
import { type CaptionTemplate, type PreviewKit } from "./caption-preview-utils";
import { INTRO_SAMPLE_TITLE, previewTimeline } from "./intro-title";
import { useLoopClock } from "./loop-clock";

const defaultText = "A melhor parte do vídeo começa com uma boa ideia";
const defaultTitle = "Seu próximo grande momento";

export function ClipPreviewPlayer({
  kit,
  template,
  watermark = false,
  captionsEnabled = true,
  aspectRatios = ["9:16", "1:1"],
  editableText = false,
  introTitle,
  className,
}: {
  kit?: PreviewKit;
  template?: CaptionTemplate;
  watermark?: boolean;
  captionsEnabled?: boolean;
  aspectRatios?: ("9:16" | "1:1")[];
  editableText?: boolean;
  /** Título de abertura resolvido; ausente = prévia sem abertura (e com o título fixo do kit, como antes). */
  introTitle?: ResolvedIntroTitle | null;
  className?: string;
}) {
  const id = useId();
  const reducedMotion = useReducedMotion();
  const [playing, setPlaying] = useState(true);
  const [ratio, setRatio] = useState<"9:16" | "1:1">("9:16");
  const [guides, setGuides] = useState(false);
  const [scene, setScene] = useState(true);
  const [text, setText] = useState(defaultText);
  const currentRatio = aspectRatios.includes(ratio)
    ? ratio
    : (aspectRatios[0] ?? "9:16");
  const captionDuration = Math.max(650, text.trim().split(/\s+/).length * 650);
  const { totalMs: duration, captionOffsetMs } = previewTimeline(
    captionDuration,
    introTitle,
  );
  const isPlaying = playing && !reducedMotion;
  // ~30 quadros/s: as entradas do título de abertura duram de 140 a 280 ms.
  const { timeMs, seek } = useLoopClock({
    periodMs: duration,
    playing: isPlaying,
  });
  return (
    <section
      className={cn(
        "bg-background/40 overflow-hidden rounded-2xl border",
        className,
      )}
      aria-label="Prévisualização do clipe"
    >
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <p className="flex items-center gap-2 text-xs font-semibold">
          <Sparkles className="text-primary size-3.5" />
          Prévia do clipe
        </p>
        <span className="text-muted-foreground flex items-center gap-1.5 text-[10px]">
          <span className="bg-primary size-1.5 rounded-full" />
          Ao vivo
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div
          className="bg-muted/50 flex gap-1 rounded-lg p-1"
          role="group"
          aria-label="Formato da prévia"
        >
          {aspectRatios.map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={currentRatio === value}
              onClick={() => setRatio(value)}
              className={cn(
                "focus-visible:ring-primary/50 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none",
                currentRatio === value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Mostrar área segura"
            aria-pressed={guides}
            onClick={() => setGuides(!guides)}
          >
            <Scan className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Usar cena de exemplo"
            aria-pressed={scene}
            onClick={() => setScene(!scene)}
          >
            <ImageIcon className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="bg-[radial-gradient(ellipse_at_center,var(--muted),transparent_75%)] px-5 pb-4">
        <BrandPreview
          kit={kit}
          template={template}
          watermark={watermark}
          captionsEnabled={captionsEnabled}
          aspectRatio={currentRatio}
          timeMs={Math.max(0, timeMs - captionOffsetMs)}
          captionText={text.trim() || defaultText}
          titleText={defaultTitle}
          intro={
            introTitle
              ? { settings: introTitle, text: INTRO_SAMPLE_TITLE, timeMs }
              : null
          }
          showGuides={guides}
          background={scene ? "scene" : "plain"}
        />
      </div>
      <div className="space-y-3 border-t px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={isPlaying ? "Pausar prévia" : "Reproduzir prévia"}
            onClick={() => setPlaying(!playing)}
            disabled={!!reducedMotion}
          >
            {isPlaying ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
          </Button>
          <input
            type="range"
            min={0}
            max={duration - 1}
            step={100}
            value={Math.min(timeMs, duration - 1)}
            aria-label="Tempo da prévia"
            aria-valuetext={`${(timeMs / 1000).toFixed(1)} segundos`}
            className="accent-primary h-1 w-full min-w-0 cursor-pointer"
            onChange={(event) => {
              setPlaying(false);
              seek(Number(event.target.value));
            }}
          />
          <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
            0:{String(Math.floor(timeMs / 1000)).padStart(2, "0")}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            aria-label="Reiniciar prévia"
            onClick={() => {
              seek(0);
              setPlaying(true);
            }}
          >
            <RotateCcw className="size-3.5" />
          </Button>
        </div>
        {editableText && (
          <div className="space-y-2">
            <Label
              htmlFor={`${id}-text`}
              className="text-muted-foreground text-[11px]"
            >
              Texto de teste
            </Label>
            <Input
              id={`${id}-text`}
              value={text}
              maxLength={120}
              className="h-9 rounded-lg text-xs"
              placeholder={defaultText}
              onChange={(event) => {
                setText(event.target.value);
                seek(0);
              }}
            />
          </div>
        )}
        <p className="text-muted-foreground text-[10px] leading-relaxed">
          Cena de exemplo. A prévia é aproximada; o resultado usa o seu vídeo.
          {introTitle?.enabled &&
            " O título de abertura usa o título de cada corte."}
          {!captionsEnabled && " Legendas desativadas."}
        </p>
      </div>
    </section>
  );
}
