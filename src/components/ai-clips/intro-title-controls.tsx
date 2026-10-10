"use client";

import Image from "next/image";
import {
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { useReducedMotion } from "framer-motion";
import {
  Blend,
  Check,
  ChevronDown,
  Clapperboard,
  Eye,
  Highlighter,
  Keyboard,
  MoveRight,
  Pause,
  Pipette,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  Type,
  Zap,
} from "lucide-react";
import {
  RadioGroup as RadioGroupPrimitive,
  Slider as SliderPrimitive,
} from "radix-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  fontNames,
  INTRO_TITLE_LIMITS,
  introTitleAnimations,
  introTitleBands,
  introTitleEffects,
  introTitlePositions,
  type BrandKit,
  type IntroTitleSettings,
  type ResolvedIntroTitle,
} from "@/server/league-clips/contracts";
import { ColorField } from "./brand-style-controls";
import { CaptionSample } from "./caption-sample";
import {
  previewFontFamily,
  type PreviewCaptionStyle,
} from "./caption-preview-utils";
import {
  autoIntroTextColor,
  contrastRatio,
  formatIntroSeconds,
  INTRO_SAMPLE_TITLE,
  INTRO_TIMING,
  INTRO_TITLE_DEFAULT_MAX_FONT_PX,
  INTRO_TITLE_DURATION_PRESETS_MS,
  INTRO_TITLE_PRESETS,
  introAnimationOptions,
  introBandOptions,
  introEffectOptions,
  introGalleryState,
  introHighlightIndices,
  introPalette,
  introPositionOptions,
  introPreset,
  introPreviewAnimates,
  introStageTimeline,
  introStillTimeMs,
  introStyleOf,
  introStylePatch,
  introTitleAppearance,
  introTitlePhase,
  matchIntroPreset,
  resolveIntroTitle,
  splitIntroWords,
  type IntroAnimation,
  type IntroAppearanceInput,
  type IntroBand,
  type IntroEffect,
  type IntroPosition,
  type IntroPresetId,
  type IntroStyle,
  type IntroTitleIssues,
  type IntroTitlePatch,
} from "./intro-title";
import { IntroTitleOverlay, type IntroAppearance } from "./intro-title-overlay";
import { useLoopClock } from "./loop-clock";
import styles from "./clip-preview.module.css";

/** Cores herdadas (brand kit escolhido): a amostra "automática" vira "da identidade" e mostra a cor que vem dela. */
export type InheritedIntroColors = {
  label: string;
  bgColor?: string;
  textColor?: string;
};

/** O que a prévia precisa saber do estilo de legenda e da identidade para desenhar o título como no vídeo. */
export type IntroTitleLook = {
  caption: PreviewCaptionStyle;
  titleStyle?: IntroAppearanceInput["titleStyle"];
  templateUppercase?: boolean;
};

const SCENE = "/images/ai-clips/preview-podcast.webp";
const CAPTION_SAMPLE = "A melhor parte do vídeo começa com uma boa ideia";

const same = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

/**
 * Título de abertura, o mesmo componente na criação do projeto (`compact`: galeria, liga/desliga e "Personalizar")
 * e no editor do corte e no brand kit (`full`: com a prévia grande). Mostra o valor resolvido (`value`) e devolve só
 * a mudança (`onChange`; `null` = voltar ao herdado/automático).
 */
export function IntroTitleControls({
  idPrefix,
  value,
  look,
  onChange,
  issues = {},
  disabled = false,
  inherited,
  autoBgHint = "Cor de destaque do estilo de legenda.",
  brandColors,
  baseline,
  sampleText = INTRO_SAMPLE_TITLE,
  density = "full",
  aspect = "9:16",
  footer,
}: {
  idPrefix: string;
  value: ResolvedIntroTitle;
  look: IntroTitleLook;
  onChange: (patch: IntroTitlePatch) => void;
  issues?: IntroTitleIssues;
  disabled?: boolean;
  inherited?: InheritedIntroColors;
  autoBgHint?: string;
  /** Paleta da identidade, para as amostras de cor. */
  brandColors?: BrandKit["colors"];
  /** O que vale sem ajuste nesta tela (padrão do servidor, da identidade ou do projeto): marcado como "padrão". */
  baseline?: ResolvedIntroTitle;
  /** Texto das prévias: o título do corte no editor; um exemplo nas outras telas. */
  sampleText?: string;
  density?: "compact" | "full";
  aspect?: "9:16" | "1:1";
  footer?: ReactNode;
}) {
  const id = (key: string) => `${idPrefix}-${key}`;
  const reducedMotion = !!useReducedMotion();
  const customizeRef = useRef<HTMLDetailsElement>(null);
  const base = baseline ?? resolveIntroTitle();
  const text = sampleText.trim() || INTRO_SAMPLE_TITLE;
  const appearance = introTitleAppearance({ settings: value, ...look });
  const preset = matchIntroPreset(value);
  return (
    <div className="@container min-w-0 space-y-5">
      <fieldset
        disabled={disabled}
        className="min-w-0"
        aria-describedby={id("help")}
      >
        <legend className="sr-only">Título de abertura</legend>
        <div className="bg-background/30 flex items-center justify-between gap-4 rounded-xl border p-4">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="bg-primary/10 text-primary hidden size-9 shrink-0 items-center justify-center rounded-lg @sm:flex"
              aria-hidden="true"
            >
              <Clapperboard className="size-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Label
                  htmlFor={id("enabled")}
                  className="text-sm font-semibold"
                >
                  Mostrar título de abertura
                </Label>
                {value.enabled && (
                  <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-semibold">
                    {preset ? introPreset(preset).name : "Personalizado"} ·{" "}
                    {formatIntroSeconds(value.durationMs)}
                  </span>
                )}
              </div>
              <p
                id={id("help")}
                className="text-muted-foreground mt-1 text-xs leading-relaxed"
              >
                O título do corte aparece nos primeiros segundos; a legenda
                entra quando ele sai.
              </p>
            </div>
          </div>
          <Switch
            id={id("enabled")}
            checked={value.enabled}
            onCheckedChange={(enabled) => onChange({ enabled })}
          />
        </div>
      </fieldset>
      {value.enabled ? (
        <>
          <div
            className={cn(
              "grid min-w-0 items-start gap-5",
              density === "full" &&
                "@xl:grid-cols-[200px_minmax(0,1fr)] @3xl:grid-cols-[236px_minmax(0,1fr)]",
            )}
          >
            {density === "full" && (
              <IntroTitleStage
                idPrefix={idPrefix}
                value={value}
                appearance={appearance}
                look={look}
                text={text}
                aspect={aspect}
                reducedMotion={reducedMotion}
                presetName={preset ? introPreset(preset).name : "Personalizado"}
              />
            )}
            <IntroStyleGallery
              idPrefix={idPrefix}
              value={value}
              look={look}
              text={text}
              baseline={base}
              disabled={disabled}
              reducedMotion={reducedMotion}
              onChange={onChange}
              onCustomize={() => {
                if (customizeRef.current) customizeRef.current.open = true;
              }}
            />
          </div>
          <fieldset disabled={disabled} className="min-w-0">
            <legend className="sr-only">
              Personalizar o título de abertura
            </legend>
            <IntroCustomize
              idPrefix={idPrefix}
              detailsRef={customizeRef}
              value={value}
              appearance={appearance}
              look={look}
              text={text}
              baseline={base}
              issues={issues}
              disabled={disabled}
              inherited={inherited}
              autoBgHint={autoBgHint}
              brandColors={brandColors}
              onChange={onChange}
            />
          </fieldset>
        </>
      ) : (
        <div className="flex items-center gap-4 rounded-xl border border-dashed p-4">
          <span
            className="bg-muted/60 relative h-14 w-9 shrink-0 rounded-md border"
            aria-hidden="true"
          >
            <span className="bg-muted-foreground/40 absolute inset-x-1.5 bottom-3 h-[3px] rounded-full" />
            <span className="bg-muted-foreground/25 absolute inset-x-2.5 bottom-1.5 h-[3px] rounded-full" />
          </span>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Os cortes começam direto, sem o título na abertura. Ligue para
            escolher um estilo.
          </p>
        </div>
      )}
      {footer}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Galeria de estilos prontos

function IntroStyleGallery({
  idPrefix,
  value,
  look,
  text,
  baseline,
  disabled,
  reducedMotion,
  onChange,
  onCustomize,
}: {
  idPrefix: string;
  value: ResolvedIntroTitle;
  look: IntroTitleLook;
  text: string;
  baseline: ResolvedIntroTitle;
  disabled: boolean;
  reducedMotion: boolean;
  onChange: (patch: IntroTitlePatch) => void;
  onCustomize: () => void;
}) {
  const id = (key: string) => `${idPrefix}-${key}`;
  const [lastPreset, setLastPreset] = useState<IntroPresetId | null>(null);
  const [savedCustom, setSavedCustom] = useState<{
    style: IntroStyle;
    base: IntroPresetId;
  } | null>(null);
  const [playing, setPlaying] = useState<boolean | null>(null);
  const animate = introPreviewAnimates({ reducedMotion, playing });
  // Os cartões repetem a entrada a cada poucos segundos (no máximo 3,5 s de título e uma pausa curta).
  const cardSettings = {
    ...value,
    durationMs: Math.min(value.durationMs, 3500),
  };
  const cycle = cardSettings.durationMs + 900;
  const clock = useLoopClock({ periodMs: cycle, playing: animate });
  const state = introGalleryState(value, lastPreset);
  const current = introStyleOf(value);
  const custom =
    state.selected === "custom"
      ? { style: current, base: state.base, live: true }
      : savedCustom
        ? { ...savedCustom, live: false }
        : null;
  const defaultPreset = matchIntroPreset(baseline);
  function choose(next: string) {
    if (next === "custom") {
      if (state.selected !== "custom" && savedCustom)
        onChange(introStylePatch(savedCustom.style));
      return;
    }
    if (next === state.selected) return;
    if (state.selected === "custom")
      setSavedCustom({ style: current, base: state.base });
    setLastPreset(next as IntroPresetId);
    onChange(introStylePatch(introPreset(next as IntroPresetId).style));
  }
  const cards = [
    ...INTRO_TITLE_PRESETS.map((preset) => ({
      id: preset.id as string,
      name: preset.name as string,
      description: preset.description as string,
      style: preset.style as IntroStyle,
    })),
    ...(custom
      ? [
          {
            id: "custom",
            name: "Personalizado",
            description:
              "Baseado em " +
              introPreset(custom.base).name +
              (custom.live
                ? ", com os seus ajustes."
                : ". Escolha para voltar aos seus ajustes."),
            style: custom.style,
          },
        ]
      : []),
  ];
  return (
    <section
      aria-labelledby={id("gallery-label")}
      className="@container min-w-0 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 id={id("gallery-label")} className="text-sm font-semibold">
            Estilos prontos
          </h4>
          <p
            id={id("gallery-help")}
            className="text-muted-foreground mt-0.5 text-xs leading-relaxed"
          >
            Escolha um ponto de partida. Cores, duração e posição continuam as
            suas.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground h-8 shrink-0 gap-1.5 px-2 text-xs"
          onClick={() => setPlaying(!animate)}
        >
          {animate ? (
            <Pause className="size-3.5" aria-hidden="true" />
          ) : (
            <Play className="size-3.5" aria-hidden="true" />
          )}
          {animate ? "Pausar prévias" : "Animar prévias"}
        </Button>
      </div>
      <RadioGroupPrimitive.Root
        value={state.selected}
        onValueChange={choose}
        disabled={disabled}
        aria-labelledby={id("gallery-label")}
        aria-describedby={id("gallery-help")}
        className="grid grid-cols-2 gap-3 @lg:grid-cols-3"
      >
        {cards.map((card, index) => {
          const settings = { ...cardSettings, ...card.style };
          const checked = state.selected === card.id;
          const isBase = state.selected === "custom" && card.id === state.base;
          return (
            <RadioGroupPrimitive.Item
              key={card.id}
              value={card.id}
              aria-labelledby={id(`preset-${card.id}-name`)}
              aria-describedby={id(`preset-${card.id}-description`)}
              onClick={card.id === "custom" ? onCustomize : undefined}
              className={cn(
                "group bg-card focus-visible:ring-primary/60 focus-visible:ring-offset-background relative flex min-w-0 flex-col overflow-hidden rounded-xl border text-left transition-[border-color,box-shadow,transform] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-safe:active:scale-[0.98] motion-reduce:transition-none",
                checked
                  ? "border-primary ring-primary/20 shadow-sm ring-2"
                  : isBase
                    ? "border-primary/50 border-dashed"
                    : "border-border/70 hover:border-primary/40 hover:shadow-sm",
              )}
            >
              <span
                className="relative block aspect-[16/10] overflow-hidden bg-slate-950"
                aria-hidden="true"
              >
                <Image
                  src={SCENE}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 200px, 45vw"
                  className="object-cover opacity-80 transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
                  style={{ objectPosition: "50% 38%" }}
                />
                <span className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/5 to-black/45" />
                <IntroTitleOverlay
                  variant="tile"
                  text={text}
                  settings={settings}
                  appearance={introTitleAppearance({ settings, ...look })}
                  aspect="9:16"
                  caption={look.caption}
                  timeMs={
                    animate
                      ? (clock.timeMs + index * 220) % cycle
                      : introStillTimeMs(settings)
                  }
                  reducedMotion={reducedMotion || !animate}
                />
                {checked && (
                  <span className="bg-primary text-primary-foreground absolute top-2 right-2 flex size-5 items-center justify-center rounded-full shadow-md">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                )}
                {card.id === defaultPreset && (
                  <span className="absolute top-2 left-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                    Padrão
                  </span>
                )}
                {isBase && (
                  <span className="bg-primary/90 text-primary-foreground absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                    Base
                  </span>
                )}
              </span>
              <span className="block px-3 py-2.5">
                <span
                  id={id(`preset-${card.id}-name`)}
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-semibold",
                    checked && "text-primary",
                  )}
                >
                  {card.id === "custom" && (
                    <SlidersHorizontal
                      className="size-3 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <span className="truncate">{card.name}</span>
                  {card.id === defaultPreset && (
                    <span className="sr-only"> (padrão)</span>
                  )}
                  {isBase && (
                    <span className="sr-only"> (base do personalizado)</span>
                  )}
                </span>
                <span
                  id={id(`preset-${card.id}-description`)}
                  className="text-muted-foreground mt-0.5 line-clamp-2 block text-[11px] leading-snug"
                >
                  {card.description}
                </span>
              </span>
            </RadioGroupPrimitive.Item>
          );
        })}
      </RadioGroupPrimitive.Root>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Prévia grande (9:16) em laço: entrada, permanência, saída e a legenda depois

function IntroTitleStage({
  idPrefix,
  value,
  appearance,
  look,
  text,
  aspect,
  reducedMotion,
  presetName,
}: {
  idPrefix: string;
  value: ResolvedIntroTitle;
  appearance: IntroAppearance;
  look: IntroTitleLook;
  text: string;
  aspect: "9:16" | "1:1";
  reducedMotion: boolean;
  presetName: string;
}) {
  const id = (key: string) => `${idPrefix}-${key}`;
  const timeline = introStageTimeline(value);
  const [playing, setPlaying] = useState<boolean | null>(null);
  const animate = introPreviewAnimates({ reducedMotion, playing });
  const clock = useLoopClock({ periodMs: timeline.totalMs, playing: animate });
  // Sem animação desde o início (menos movimento): o quadro com o título inteiro.
  const time =
    playing === null && !animate ? introStillTimeMs(value) : clock.timeMs;
  const phase = introTitlePhase(time, value);
  const caption = look.caption;
  const showCaption = !phase.captionsHidden;
  const marginPercent =
    (caption.marginV / (aspect === "9:16" ? 1920 : 1080)) * 100;
  const captionPosition: CSSProperties =
    caption.position === "middle"
      ? { top: "50%", transform: "translateY(-50%)" }
      : caption.position === "top"
        ? { top: `${marginPercent}%` }
        : { bottom: `${marginPercent}%` };
  const titleShare = (timeline.titleMs / timeline.totalMs) * 100;
  return (
    <section
      aria-labelledby={id("stage-label")}
      className="mx-auto w-full max-w-[236px] min-w-0 space-y-3 @xl:mx-0"
    >
      <p
        id={id("stage-label")}
        className="flex items-center gap-1.5 text-xs font-semibold"
      >
        <Eye className="text-primary size-3.5" aria-hidden="true" />
        Prévia da abertura
      </p>
      <div
        className={cn(
          styles.scene,
          "relative overflow-hidden rounded-2xl bg-slate-950 shadow-lg ring-1 ring-black/5 dark:ring-white/10",
        )}
        style={{ aspectRatio: aspect === "9:16" ? "9 / 16" : "1 / 1" }}
        role="img"
        aria-label={`Prévia do título de abertura no estilo ${presetName}: ${text}`}
      >
        <Image
          src={SCENE}
          alt=""
          fill
          sizes="236px"
          className="object-cover"
          style={{ objectPosition: "50% 45%" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/55" />
        <IntroTitleOverlay
          text={text}
          settings={value}
          appearance={appearance}
          aspect={aspect}
          caption={caption}
          timeMs={time}
          reducedMotion={reducedMotion}
        />
        {showCaption && (
          <div
            className="absolute inset-x-[6%]"
            style={{
              ...captionPosition,
              // a legenda entra em fade de 200 ms depois do título, como no vídeo
              opacity: Math.min(
                1,
                Math.max(
                  0,
                  (time - timeline.captionStartMs) /
                    INTRO_TIMING.captionFadeInMs,
                ),
              ),
            }}
          >
            <CaptionSample
              style={caption}
              text={CAPTION_SAMPLE}
              timeMs={Math.max(0, time - timeline.captionStartMs)}
              scaled
            />
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={animate ? "Pausar prévia" : "Reproduzir prévia"}
            onClick={() => setPlaying(!animate)}
          >
            {animate ? (
              <Pause className="size-4" aria-hidden="true" />
            ) : (
              <Play className="size-4" aria-hidden="true" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label="Repetir do início"
            onClick={() => {
              clock.seek(0);
              setPlaying(true);
            }}
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
          </Button>
          <div
            role="progressbar"
            aria-label="Tempo da prévia"
            aria-valuemin={0}
            aria-valuemax={Math.round(timeline.totalMs / 100) / 10}
            aria-valuenow={Math.round(time / 100) / 10}
            aria-valuetext={`${formatIntroSeconds(time)} de ${formatIntroSeconds(timeline.totalMs)}`}
            className="bg-muted relative mx-1 h-1.5 min-w-0 flex-1 overflow-hidden rounded-full"
          >
            <span
              className="bg-primary/25 absolute inset-y-0 left-0"
              style={{ width: `${titleShare}%` }}
            />
            <span
              className="bg-primary absolute inset-0 origin-left"
              style={{ transform: `scaleX(${time / timeline.totalMs})` }}
            />
            <span
              className="bg-foreground/50 absolute inset-y-0 w-0.5"
              style={{ left: `${titleShare}%` }}
            />
          </div>
          <span
            className="text-muted-foreground w-11 shrink-0 text-right text-[11px] tabular-nums"
            aria-hidden="true"
          >
            {(time / 1000).toLocaleString("pt-BR", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}{" "}
            s
          </span>
        </div>
        <div className="text-muted-foreground flex justify-between gap-2 px-1 text-[10px]">
          <span>Título · {formatIntroSeconds(value.durationMs)}</span>
          <span className="text-right">
            {value.hideCaptions ? "Depois, a legenda" : "Legenda junto"}
          </span>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Personalizar (fechado por padrão)

const animationIcons: Record<IntroAnimation, typeof Zap> = {
  pop: Zap,
  slide: MoveRight,
  typewriter: Keyboard,
  words: Type,
  fade: Blend,
};

function IntroCustomize({
  idPrefix,
  detailsRef,
  value,
  appearance,
  look,
  text,
  baseline,
  issues,
  disabled,
  inherited,
  autoBgHint,
  brandColors,
  onChange,
}: {
  idPrefix: string;
  detailsRef: RefObject<HTMLDetailsElement | null>;
  value: ResolvedIntroTitle;
  appearance: IntroAppearance;
  look: IntroTitleLook;
  text: string;
  baseline: ResolvedIntroTitle;
  issues: IntroTitleIssues;
  disabled: boolean;
  inherited?: InheritedIntroColors;
  autoBgHint: string;
  brandColors?: BrandKit["colors"];
  onChange: (patch: IntroTitlePatch) => void;
}) {
  const id = (key: string) => `${idPrefix}-${key}`;
  const effect = appearance.effect;
  const baseEffect = introStyleOf(baseline).effect;
  const words = splitIntroWords(text);
  const highlighted = introHighlightIndices(text).map((index) => words[index]);
  const hasIssues = Object.keys(issues).length > 0;
  const fineIssues = !!(issues.maxFontSizePx || issues.marginV);
  const caption = look.caption;
  const bgPalette = introPalette(
    [
      {
        label: "Cor do título da identidade",
        color: look.titleStyle?.textColor,
      },
      { label: "Cor principal da identidade", color: brandColors?.primary },
      { label: "Cor secundária da identidade", color: brandColors?.secondary },
      { label: "Cor de destaque da identidade", color: brandColors?.accent },
      { label: "Destaque da legenda", color: caption.highlightColor },
      { label: "Texto da legenda", color: caption.textColor },
      { label: "Branco", color: "#ffffff" },
      { label: "Preto", color: "#000000" },
    ],
    [inherited?.bgColor ?? appearance.autoBgColor],
  );
  const textPalette = introPalette(
    [
      { label: "Branco", color: "#ffffff" },
      { label: "Preto", color: "#000000" },
      { label: "Destaque da legenda", color: caption.highlightColor },
      { label: "Cor principal da identidade", color: brandColors?.primary },
      { label: "Cor de destaque da identidade", color: brandColors?.accent },
    ],
    [inherited?.textColor ?? appearance.autoTextColor],
  );
  const lowContrast =
    value.band !== "none" &&
    contrastRatio(appearance.textColor, appearance.bgColor) < 3;
  const summary = [
    introAnimationOptions[value.animation].label,
    introBandOptions[value.band].label,
    effect !== "none" ? introEffectOptions[effect].label : null,
    value.highlight === "auto" ? "Destaque" : null,
    formatIntroSeconds(value.durationMs),
    introPositionOptions[value.position].label,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <details
      ref={detailsRef}
      className="group/custom bg-background/30 rounded-xl border open:shadow-sm"
    >
      <summary className="focus-visible:ring-primary/50 flex cursor-pointer list-none items-center gap-3 rounded-xl p-4 focus-visible:ring-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <span
          className="bg-muted text-foreground flex size-9 shrink-0 items-center justify-center rounded-lg"
          aria-hidden="true"
        >
          <SlidersHorizontal className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Personalizar</span>
          <span className="text-muted-foreground block truncate text-xs">
            {summary}
          </span>
        </span>
        {hasIssues && (
          <span className="text-destructive shrink-0 text-xs font-medium">
            Revise os valores
          </span>
        )}
        <ChevronDown
          className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-open/custom:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>
      <div className="space-y-7 border-t p-4 sm:p-5">
        <Group title="Movimento">
          <ChoiceGroup
            id={id("animation")}
            label="Animação de entrada"
            hint={introAnimationOptions[value.animation].hint}
            value={value.animation}
            disabled={disabled}
            baseValue={baseline.animation}
            className="grid-cols-3 @lg:grid-cols-5"
            onValueChange={(animation) => onChange({ animation })}
            options={introTitleAnimations.map((animation) => {
              const Icon = animationIcons[animation];
              return {
                value: animation,
                label: introAnimationOptions[animation].label,
                className: styles.animChip,
                visual: (
                  <span className="bg-muted/70 group-data-[state=checked]:bg-primary/15 flex size-8 items-center justify-center rounded-lg">
                    <Icon
                      className={cn(styles.animIcon, "size-4")}
                      data-animation={animation}
                    />
                  </span>
                ),
              };
            })}
          />
          <DurationField
            id={id("durationMs")}
            value={value.durationMs}
            baseValue={baseline.durationMs}
            error={issues.durationMs}
            disabled={disabled}
            onChange={(durationMs) => onChange({ durationMs })}
          />
        </Group>
        <Group title="Visual">
          <div className="grid gap-6 @2xl:grid-cols-2">
            <ChoiceGroup
              id={id("band")}
              label="Fundo"
              hint={introBandOptions[value.band].hint}
              value={value.band}
              disabled={disabled}
              baseValue={baseline.band}
              className="grid-cols-4"
              onValueChange={(band) => onChange({ band })}
              options={introTitleBands.map((band) => ({
                value: band,
                label: introBandOptions[band].label,
                visual: <BandMockup band={band} />,
              }))}
            />
            <ChoiceGroup
              id={id("effect")}
              label="Efeito no texto"
              hint={
                value.effect === undefined && value.band === "none"
                  ? "Contorno automático: sem fundo, o texto ganha contorno para ser lido em qualquer cena."
                  : introEffectOptions[effect].hint
              }
              value={effect}
              disabled={disabled}
              baseValue={baseEffect}
              className="grid-cols-4"
              onValueChange={(next) => onChange({ effect: next })}
              options={introTitleEffects.map((option) => ({
                value: option,
                label: introEffectOptions[option].label,
                visual: (
                  <EffectSample effect={option} appearance={appearance} />
                ),
              }))}
            />
          </div>
          <div className="bg-background/40 flex items-start justify-between gap-4 rounded-xl border p-3.5">
            <div className="min-w-0">
              <Label
                htmlFor={id("highlight")}
                className="flex items-center gap-1.5 text-xs font-semibold"
              >
                <Highlighter
                  className="text-primary size-3.5"
                  aria-hidden="true"
                />
                Destaque automático
              </Label>
              <p
                id={id("highlight-help")}
                className="text-muted-foreground mt-1 text-[11px] leading-relaxed"
              >
                Pinta 1 ou 2 palavras-chave do título na cor de destaque. A
                escolha é automática: números e palavras fortes primeiro.
              </p>
              {value.highlight === "auto" && highlighted.length > 0 && (
                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-muted-foreground">Na prévia:</span>
                  {highlighted.map((word, index) => (
                    <span
                      key={index}
                      className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold"
                    >
                      <span
                        className="size-2 rounded-full border border-black/10"
                        style={{ backgroundColor: appearance.highlightColor }}
                        aria-hidden="true"
                      />
                      {word}
                    </span>
                  ))}
                </p>
              )}
            </div>
            <Switch
              id={id("highlight")}
              checked={value.highlight === "auto"}
              aria-describedby={id("highlight-help")}
              onCheckedChange={(on) =>
                onChange({ highlight: on ? "auto" : "none" })
              }
            />
          </div>
          <div className="grid gap-6 @2xl:grid-cols-2">
            {value.band === "none" && effect !== "glow" ? (
              <div className="space-y-2.5">
                <p className="text-xs font-semibold">Cor do fundo</p>
                <p className="text-muted-foreground bg-muted/40 rounded-lg px-3 py-2.5 text-[11px] leading-relaxed">
                  Este estilo não tem fundo: o texto fica direto sobre o vídeo,
                  com contorno ou sombra para ser lido.
                </p>
              </div>
            ) : (
              <ColorSwatches
                id={id("bgColor")}
                title={value.band === "none" ? "Cor do brilho" : "Cor do fundo"}
                value={value.bgColor}
                autoColor={appearance.autoBgColor}
                autoHint={autoBgHint}
                inheritedColor={inherited?.bgColor}
                inheritedLabel={inherited?.label}
                palette={bgPalette}
                error={issues.bgColor}
                disabled={disabled}
                onChange={(bgColor) => onChange({ bgColor })}
              />
            )}
            <ColorSwatches
              id={id("textColor")}
              title="Cor do texto"
              value={value.textColor}
              autoColor={appearance.autoTextColor}
              autoHint="Sobre o fundo, preto ou branco (o que contrastar mais); sem fundo, branco."
              inheritedColor={inherited?.textColor}
              inheritedLabel={inherited?.label}
              palette={textPalette}
              error={issues.textColor}
              disabled={disabled}
              onChange={(textColor) => onChange({ textColor })}
            />
          </div>
          {lowContrast && (
            <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
              <TriangleAlert
                className="mt-px size-3.5 shrink-0"
                aria-hidden="true"
              />
              Pouco contraste entre o texto e o fundo (
              {contrastRatio(appearance.textColor, appearance.bgColor)
                .toFixed(1)
                .replace(".", ",")}
              :1). A cor automática do texto sempre contrasta.
            </p>
          )}
        </Group>
        <Group title="Posição">
          <ChoiceGroup
            id={id("position")}
            label="Onde o título aparece"
            hint={introPositionOptions[value.position].hint}
            value={value.position}
            disabled={disabled}
            baseValue={baseline.position}
            className="max-w-md grid-cols-3"
            onValueChange={(position) => onChange({ position })}
            options={introTitlePositions.map((position) => ({
              value: position,
              label: introPositionOptions[position].label,
              visual: <PositionMockup position={position} />,
            }))}
          />
        </Group>
        <details className="group/fine rounded-xl border">
          <summary className="focus-visible:ring-primary/50 flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl p-3.5 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            <span>
              Ajustes finos
              <span className="text-muted-foreground ml-2 font-normal">
                Fonte, maiúsculas, tamanho, margem e legenda
              </span>
              {fineIssues && (
                <span className="text-destructive ml-2 font-normal">
                  Revise os valores
                </span>
              )}
            </span>
            <ChevronDown
              className="text-muted-foreground size-4 shrink-0 transition-transform group-open/fine:rotate-180 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </summary>
          <div className="grid gap-4 border-t p-4 @lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={id("fontName")} className="text-xs">
                Fonte do título
              </Label>
              <select
                id={id("fontName")}
                className="bg-background/40 focus-visible:ring-primary/50 h-10 w-full rounded-xl border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                value={value.fontName ?? "auto"}
                onChange={(event) =>
                  onChange({
                    fontName:
                      event.target.value === "auto"
                        ? null
                        : (event.target
                            .value as IntroTitleSettings["fontName"]),
                  })
                }
              >
                <option value="auto">Automática ({appearance.fontName})</option>
                {fontNames.map((font) => (
                  <option key={font}>{font}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={id("uppercase")} className="text-xs">
                Letras maiúsculas
              </Label>
              <select
                id={id("uppercase")}
                className="bg-background/40 focus-visible:ring-primary/50 h-10 w-full rounded-xl border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                value={
                  value.uppercase === undefined
                    ? "auto"
                    : value.uppercase
                      ? "yes"
                      : "no"
                }
                onChange={(event) =>
                  onChange({
                    uppercase:
                      event.target.value === "auto"
                        ? null
                        : event.target.value === "yes",
                  })
                }
              >
                <option value="auto">Como o estilo da legenda</option>
                <option value="yes">Sempre em maiúsculas</option>
                <option value="no">Como foi escrito</option>
              </select>
            </div>
            <OptionalNumber
              id={id("maxFontSizePx")}
              label="Tamanho máximo da fonte"
              suffix="px"
              value={value.maxFontSizePx}
              placeholder={String(INTRO_TITLE_DEFAULT_MAX_FONT_PX)}
              min={INTRO_TITLE_LIMITS.maxFontSizePx.min}
              max={INTRO_TITLE_LIMITS.maxFontSizePx.max}
              help="De 40 a 120 px. A fonte diminui para o título caber em até 3 linhas."
              error={issues.maxFontSizePx}
              onChange={(maxFontSizePx) => onChange({ maxFontSizePx })}
            />
            <OptionalNumber
              id={id("marginV")}
              label={
                value.position === "top"
                  ? "Distância do topo"
                  : "Distância da base"
              }
              suffix="px"
              value={value.position === "center" ? undefined : value.marginV}
              placeholder={
                value.position === "center" ? "Centralizado" : "Automática"
              }
              min={INTRO_TITLE_LIMITS.marginV.min}
              max={INTRO_TITLE_LIMITS.marginV.max}
              disabled={value.position === "center"}
              help={
                value.position === "center"
                  ? "No centro, a margem não se aplica."
                  : value.position === "top"
                    ? "De 0 a 1800 px num quadro de 1080×1920. Vazio: logo abaixo da área segura do topo."
                    : "De 0 a 1800 px num quadro de 1080×1920. Vazio: na mesma altura da legenda."
              }
              error={issues.marginV}
              onChange={(marginV) => onChange({ marginV })}
            />
            <div className="bg-background/30 flex items-center justify-between gap-4 rounded-xl border p-3.5 @lg:col-span-2">
              <div className="min-w-0">
                <Label htmlFor={id("hideCaptions")} className="text-xs">
                  Esconder a legenda durante o título
                </Label>
                <p
                  id={id("hideCaptions-help")}
                  className="text-muted-foreground mt-1 text-[11px] leading-relaxed"
                >
                  Desligado, a legenda aparece junto com o título.
                </p>
              </div>
              <Switch
                id={id("hideCaptions")}
                checked={value.hideCaptions}
                aria-describedby={id("hideCaptions-help")}
                onCheckedChange={(hideCaptions) => onChange({ hideCaptions })}
              />
            </div>
          </div>
        </details>
      </div>
    </details>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-5">
      <p className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase">
        {title}
        <span className="bg-border h-px flex-1" aria-hidden="true" />
      </p>
      {children}
    </div>
  );
}

/** Grupo de opções visuais (radiogroup): rótulo curto, amostra, "padrão" marcado e a dica da opção escolhida. */
function ChoiceGroup<T extends string>({
  id,
  label,
  hint,
  value,
  baseValue,
  options,
  disabled,
  className,
  onValueChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: T;
  baseValue?: T;
  options: { value: T; label: string; visual: ReactNode; className?: string }[];
  disabled?: boolean;
  className?: string;
  onValueChange: (value: T) => void;
}) {
  return (
    <div className="min-w-0 space-y-2.5">
      <p id={id + "-label"} className="text-xs font-semibold">
        {label}
      </p>
      <RadioGroupPrimitive.Root
        id={id}
        value={value}
        disabled={disabled}
        onValueChange={(next) => onValueChange(next as T)}
        aria-labelledby={id + "-label"}
        aria-describedby={id + "-hint"}
        className={cn("grid gap-2", className)}
      >
        {options.map((option) => (
          <RadioGroupPrimitive.Item
            key={option.value}
            value={option.value}
            className={cn(
              "group focus-visible:ring-primary/60 relative flex min-h-11 min-w-0 flex-col items-center justify-start gap-1.5 rounded-xl border px-1.5 pt-2 pb-1.5 text-center text-[11px] leading-tight font-medium transition-colors outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
              "data-[state=checked]:border-primary/70 data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary",
              "data-[state=unchecked]:border-border/70 data-[state=unchecked]:bg-background/30 data-[state=unchecked]:text-muted-foreground data-[state=unchecked]:hover:border-primary/30 data-[state=unchecked]:hover:text-foreground",
              option.className,
            )}
          >
            <span
              aria-hidden="true"
              className="flex items-center justify-center"
            >
              {option.visual}
            </span>
            <span>{option.label}</span>
            {option.value === baseValue && (
              <span className="text-muted-foreground text-[9px] font-normal tracking-wide uppercase">
                padrão
              </span>
            )}
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>
      <p
        id={id + "-hint"}
        className="text-muted-foreground text-[11px] leading-relaxed"
      >
        {hint}
      </p>
    </div>
  );
}

function BandMockup({ band }: { band: IntroBand }) {
  return (
    <span className="relative flex h-11 w-8 items-center justify-center overflow-hidden rounded-md border border-current/30 bg-current/5">
      {band === "full" && (
        <span className="absolute inset-x-0 flex h-3 items-center justify-center bg-current/80">
          <span className="bg-background h-[2px] w-4 rounded-full" />
        </span>
      )}
      {(band === "box" || band === "rounded") && (
        <span
          className={cn(
            "flex h-3 w-5 items-center justify-center bg-current/80",
            band === "rounded" ? "rounded-[5px]" : "rounded-[1px]",
          )}
        >
          <span className="bg-background h-[2px] w-3 rounded-full" />
        </span>
      )}
      {band === "none" && (
        <span className="flex flex-col items-center gap-[3px]">
          <span className="h-[2.5px] w-5 rounded-full bg-current" />
          <span className="h-[2.5px] w-3.5 rounded-full bg-current" />
        </span>
      )}
    </span>
  );
}

function PositionMockup({ position }: { position: IntroPosition }) {
  return (
    <span className="relative h-12 w-8 overflow-hidden rounded-md border border-current/30 bg-current/5">
      <span
        className={cn(
          "absolute inset-x-0 h-2.5 bg-current/80",
          position === "top"
            ? "top-1.5"
            : position === "center"
              ? "top-1/2 -translate-y-1/2"
              : "bottom-3",
        )}
      />
      {position === "caption" && (
        <span className="absolute inset-x-2 bottom-1.5 h-[2px] rounded-full border-t border-dashed border-current" />
      )}
    </span>
  );
}

function EffectSample({
  effect,
  appearance,
}: {
  effect: IntroEffect;
  appearance: IntroAppearance;
}) {
  const style: CSSProperties =
    effect === "shadow"
      ? { textShadow: "0 3px 7px rgba(0, 0, 0, 0.75)" }
      : effect === "outline"
        ? { WebkitTextStroke: "4px #000000", paintOrder: "stroke fill" }
        : effect === "glow"
          ? {
              textShadow: `0 0 3px ${appearance.glowColor}, 0 0 9px ${appearance.glowColor}, 0 0 16px ${appearance.glowColor}`,
            }
          : {};
  return (
    <span
      className="flex h-8 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-slate-500 to-slate-700 text-base text-white"
      style={{
        fontFamily: previewFontFamily(appearance.fontName),
        fontWeight: appearance.fontName === "Archivo Black" ? 400 : 800,
        ...style,
      }}
    >
      Aa
    </span>
  );
}

function DurationField({
  id,
  value,
  baseValue,
  error,
  disabled,
  onChange,
}: {
  id: string;
  value: number;
  baseValue: number;
  error?: string;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const { min, max } = INTRO_TITLE_LIMITS.durationMs;
  const valid = Number.isFinite(value);
  const clamped = valid ? Math.min(max, Math.max(min, value)) : 3000;
  const percent = (ms: number) => ((ms - min) / (max - min)) * 100;
  return (
    <div className="min-w-0 space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p id={id + "-label"} className="text-xs font-semibold">
          Duração na tela
        </p>
        <span className="text-sm font-semibold tabular-nums">
          {valid ? formatIntroSeconds(value) : "—"}
        </span>
      </div>
      <SliderPrimitive.Root
        min={min}
        max={max}
        step={500}
        value={[clamped]}
        disabled={disabled}
        onValueChange={([next]) => {
          if (next !== undefined) onChange(next);
        }}
        className="relative flex h-6 w-full touch-none items-center select-none data-[disabled]:opacity-50"
      >
        <SliderPrimitive.Track className="bg-muted relative h-1.5 grow overflow-hidden rounded-full">
          <SliderPrimitive.Range className="bg-primary absolute h-full" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          id={id}
          aria-labelledby={id + "-label"}
          aria-valuetext={formatIntroSeconds(clamped).replace(
            " s",
            " segundos",
          )}
          aria-describedby={[id + "-help", error ? id + "-error" : ""]
            .filter(Boolean)
            .join(" ")}
          aria-invalid={!!error}
          className="border-primary bg-background ring-primary/25 block size-5 rounded-full border-2 shadow-md transition-[box-shadow] outline-none hover:ring-4 focus-visible:ring-4 data-[disabled]:cursor-not-allowed"
        />
      </SliderPrimitive.Root>
      <div className="relative h-8" role="group" aria-label="Durações comuns">
        <span className="text-muted-foreground absolute top-1 left-0 text-[10px]">
          1 s
        </span>
        <span className="text-muted-foreground absolute top-1 right-0 text-[10px]">
          8 s
        </span>
        {INTRO_TITLE_DURATION_PRESETS_MS.map((ms) => (
          <button
            key={ms}
            type="button"
            aria-pressed={value === ms}
            aria-label={`${ms / 1000} segundos${ms === baseValue ? " (padrão)" : ""}`}
            onClick={() => onChange(ms)}
            className={cn(
              "focus-visible:ring-primary/50 absolute top-0 flex -translate-x-1/2 flex-col items-center rounded-md px-1.5 py-0.5 text-[10px] leading-tight font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
              value === ms
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
            style={{ left: `${percent(ms)}%` }}
          >
            {ms / 1000} s
            {ms === baseValue && (
              <span className="text-[8px] font-normal tracking-wide uppercase">
                padrão
              </span>
            )}
          </button>
        ))}
      </div>
      <p id={id + "-help"} className="text-muted-foreground text-[11px]">
        De 1 a 8 segundos, de meio em meio. Depois do título, entra a legenda.
      </p>
      {error && (
        <p id={id + "-error"} className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

/** Amostras de cor (radiogroup): automática ou herdada, as da identidade/legenda e uma personalizada. */
function ColorSwatches({
  id,
  title,
  value,
  autoColor,
  autoHint,
  inheritedColor,
  inheritedLabel,
  palette,
  error,
  disabled,
  onChange,
}: {
  id: string;
  title: string;
  value?: string;
  autoColor: string;
  autoHint: string;
  inheritedColor?: string;
  inheritedLabel?: string;
  palette: { label: string; color: string }[];
  error?: string;
  disabled: boolean;
  onChange: (value: string | null) => void;
}) {
  const [picking, setPicking] = useState(false);
  const baseColor = inheritedColor ?? autoColor;
  const baseLabel = inheritedColor
    ? (inheritedLabel ?? "Da identidade")
    : "Automática";
  const fromPalette = palette.find((swatch) => same(swatch.color, value));
  const selected = picking
    ? "custom"
    : !value || same(value, inheritedColor)
      ? "base"
      : fromPalette
        ? "palette:" + fromPalette.color
        : "custom";
  const selectedLabel =
    selected === "base"
      ? baseLabel
      : selected === "custom"
        ? "Personalizada"
        : fromPalette!.label;
  return (
    <div className="min-w-0 space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p id={id + "-label"} className="text-xs font-semibold">
          {title}
        </p>
        <span className="text-muted-foreground truncate text-[11px]">
          {selectedLabel}
        </span>
      </div>
      <RadioGroupPrimitive.Root
        value={selected}
        disabled={disabled}
        aria-labelledby={id + "-label"}
        className="flex flex-wrap gap-1.5"
        onValueChange={(next) => {
          if (next === "custom") {
            setPicking(true);
            onChange(value ?? baseColor);
            return;
          }
          setPicking(false);
          onChange(next === "base" ? null : next.slice("palette:".length));
        }}
      >
        <Swatch
          value="base"
          color={baseColor}
          label={`${baseLabel} (${baseColor.toUpperCase()})`}
          checked={selected === "base"}
          marker
        />
        {palette.map((swatch) => (
          <Swatch
            key={swatch.color}
            value={"palette:" + swatch.color}
            color={swatch.color}
            label={`${swatch.label} (${swatch.color.toUpperCase()})`}
            checked={selected === "palette:" + swatch.color}
          />
        ))}
        <Swatch
          value="custom"
          label="Escolher outra cor"
          checked={selected === "custom"}
        />
      </RadioGroupPrimitive.Root>
      {selected === "custom" ? (
        <ColorField
          id={id}
          label={"Escolher " + title.toLowerCase()}
          value={value ?? baseColor}
          onChange={(next) => onChange(next.toLowerCase())}
        />
      ) : (
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          {selected === "base"
            ? inheritedColor
              ? "Definida na identidade visual."
              : autoHint
            : "Da paleta da identidade e do estilo de legenda."}
        </p>
      )}
      {error && (
        <p id={id + "-error"} className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

function Swatch({
  value,
  color,
  label,
  checked,
  marker = false,
}: {
  value: string;
  color?: string;
  label: string;
  checked: boolean;
  marker?: boolean;
}) {
  return (
    <RadioGroupPrimitive.Item
      value={value}
      aria-label={label}
      title={label}
      className="focus-visible:ring-primary/60 focus-visible:ring-offset-background data-[state=checked]:ring-primary data-[state=checked]:ring-offset-background relative flex size-10 items-center justify-center rounded-full transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:ring-2 data-[state=checked]:ring-offset-2"
    >
      <span
        className="size-8 rounded-full border border-black/10 shadow-inner dark:border-white/15"
        style={{
          background:
            color ??
            "conic-gradient(from 0deg, #f43f5e, #f59e0b, #facc15, #22c55e, #14f7fe, #6366f1, #d946ef, #f43f5e)",
        }}
        aria-hidden="true"
      />
      {color === undefined ? (
        <Pipette
          className="absolute size-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
          aria-hidden="true"
        />
      ) : checked ? (
        <Check
          className="absolute size-3.5"
          strokeWidth={3}
          style={{ color: autoIntroTextColor(color) }}
          aria-hidden="true"
        />
      ) : null}
      {marker && (
        <span
          className="bg-card text-primary absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full border shadow-sm"
          aria-hidden="true"
        >
          <Sparkles className="size-2.5" />
        </span>
      )}
    </RadioGroupPrimitive.Item>
  );
}

function OptionalNumber({
  id,
  label,
  suffix,
  value,
  placeholder,
  min,
  max,
  help,
  error,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  suffix: string;
  value?: number;
  placeholder: string;
  min: number;
  max: number;
  help: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: number | null) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          disabled={disabled}
          placeholder={placeholder}
          value={value !== undefined && Number.isFinite(value) ? value : ""}
          aria-invalid={!!error}
          aria-describedby={[id + "-help", error ? id + "-error" : ""]
            .filter(Boolean)
            .join(" ")}
          className="h-10 rounded-xl tabular-nums"
          onChange={(event) =>
            onChange(
              event.target.value === ""
                ? null
                : Number.isFinite(event.target.valueAsNumber)
                  ? event.target.valueAsNumber
                  : Number.NaN,
            )
          }
        />
        <span className="text-muted-foreground text-xs">{suffix}</span>
      </div>
      <p id={id + "-help"} className="text-muted-foreground text-[11px]">
        {help}
      </p>
      {error && (
        <p id={id + "-error"} className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Leva o foco ao campo com erro (abrindo "Personalizar" e "Ajustes finos" se preciso); sem o campo na tela, ao
 * liga/desliga.
 */
export function focusIntroTitleField(idPrefix: string, key?: string) {
  const target =
    (key ? document.getElementById(`${idPrefix}-${key}`) : null) ??
    document.getElementById(`${idPrefix}-enabled`);
  for (
    let details = target?.closest("details") ?? null;
    details;
    details = details.parentElement?.closest("details") ?? null
  )
    details.open = true;
  target?.focus();
}
