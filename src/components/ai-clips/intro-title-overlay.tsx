"use client";

import {
  Fragment,
  useEffect,
  useState,
  type ComponentProps,
  type CSSProperties,
} from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { type ResolvedIntroTitle } from "@/server/league-clips/contracts";
import { previewFontFamily } from "./caption-preview-utils";
import {
  introHighlightIndices,
  introTitleAppearance,
  introTitleFrame,
  introTitleLayout,
  splitIntroWords,
} from "./intro-title";
import styles from "./clip-preview.module.css";

export type IntroAppearance = ReturnType<typeof introTitleAppearance>;

/** px de um quadro de 1080 de largura → unidade da prévia (o quadro é um container de consulta). */
const u = (px: number) => `calc(${Math.round(px * 100) / 100} * 100cqw / 1080)`;
/** Cor #rrggbb com opacidade. */
const alpha = (hex: string, value: number) =>
  hex +
  Math.round(Math.min(1, Math.max(0, value)) * 255)
    .toString(16)
    .padStart(2, "0");

/**
 * Prévia aproximada do título de abertura (HTML/CSS), com o desenho do league-clips (§66): fundo (faixa, caixa, caixa
 * arredondada ou nenhum), efeito, destaque e animação de entrada/saída no instante `timeMs`. `variant="tile"`
 * centraliza o título e o reduz um pouco (cartões da galeria); `frame` usa a posição escolhida. O resultado exato vem
 * da nova geração do vídeo.
 */
export function IntroTitleOverlay({
  text,
  settings,
  appearance,
  aspect,
  caption,
  timeMs,
  clipDurationMs,
  reducedMotion,
  variant = "frame",
  className,
}: {
  text: string;
  settings: ResolvedIntroTitle;
  appearance: IntroAppearance;
  aspect: "9:16" | "1:1";
  caption: { position: "bottom" | "middle" | "top"; marginV: number };
  timeMs: number;
  clipDurationMs?: number | null;
  /** Sem valor, segue o `prefers-reduced-motion` do sistema. */
  reducedMotion?: boolean;
  variant?: "frame" | "tile";
  className?: string;
}) {
  const prefersReduced = useReducedMotion();
  const frame = introTitleFrame(timeMs, settings, {
    text,
    clipDurationMs,
    reducedMotion: reducedMotion ?? !!prefersReduced,
  });
  const layout = frame.visible
    ? introTitleLayout({
        text,
        settings,
        aspect,
        fontName: appearance.fontName,
        uppercase: appearance.uppercase,
        maxFontSizePx: appearance.maxFontSizePx,
        caption,
      })
    : null;
  if (!layout) return null;
  const k = variant === "tile" ? 0.85 : 1;
  const uu = (px: number) => u(px * k);
  const scale = aspect === "1:1" ? 0.85 : 1;
  const band = settings.band;
  const boxed = band === "box" || band === "rounded";
  const effect = appearance.effect;
  // Deslizando, a faixa/caixa recorta o texto que vem atrás dela.
  const sliding = frame.bg.shift > 0 || frame.text.shift > 0;
  const words = splitIntroWords(text);
  const marked = new Set(
    settings.highlight === "auto" ? introHighlightIndices(text) : [],
  );
  // Efeitos do league-clips: medidas em fração da fonte (em) ou em px do quadro.
  const textEffect: CSSProperties =
    effect === "outline"
      ? {
          WebkitTextStroke: `0.17em ${appearance.outlineColor}`,
          paintOrder: "stroke fill",
        }
      : effect === "shadow"
        ? {
            textShadow:
              band === "none"
                ? "0 0.07em 0.1em rgba(0, 0, 0, 0.69)"
                : "0 0.045em 0.035em rgba(0, 0, 0, 0.37)",
          }
        : effect === "glow" && band === "none"
          ? {
              textShadow: [
                `0 0 0.06em ${alpha(appearance.glowColor, 0.9)}`,
                `0 0 0.17em ${alpha(appearance.glowColor, 0.6)}`,
                `0 0 0.32em ${alpha(appearance.glowColor, 0.4)}`,
              ].join(", "),
            }
          : {};
  const shapeShadow =
    band === "none"
      ? undefined
      : effect === "shadow"
        ? `0 ${uu(10 * scale)} ${uu(16 * scale)} ${alpha("#000000", 0.62 * frame.bg.opacity)}`
        : effect === "glow"
          ? `0 0 ${uu(20 * scale)} ${uu(12 * scale)} ${alpha(appearance.bgColor, 0.56 * frame.bg.opacity)}`
          : undefined;
  const shift = (value: number) =>
    value ? `translateX(calc(${-value} * 100cqw))` : undefined;
  // Dentro da faixa/caixa, o texto anda em relação a ela (que o recorta); sem fundo, anda sozinho.
  const textShift =
    band === "none" ? frame.text.shift : frame.text.shift - frame.bg.shift;
  let offset = 0;
  const offsets = words.map((word) => {
    const start = offset;
    offset += word.length;
    return start;
  });
  const neon = appearance.neonKeyword;
  const textBlock = (
    <span
      className="block text-center break-words"
      style={{
        fontFamily: previewFontFamily(appearance.fontName),
        fontWeight: appearance.fontName === "Archivo Black" ? 400 : 800,
        fontSize: uu(layout.fontPx),
        lineHeight: 1,
        textTransform: appearance.uppercase ? "uppercase" : undefined,
        textWrap: "balance",
        maxWidth: uu(layout.textWidth),
        color: appearance.textColor,
        opacity: frame.text.opacity,
        transform:
          [
            shift(textShift),
            frame.text.scale !== 1 ? `scale(${frame.text.scale})` : undefined,
          ]
            .filter(Boolean)
            .join(" ") || undefined,
        ...textEffect,
      }}
    >
      {words.map((word, index) => {
        const start = offsets[index] ?? 0;
        const shown =
          frame.chars === null
            ? word.length
            : Math.min(word.length, Math.max(0, frame.chars - start));
        const pop = frame.words?.[index];
        const highlighted = marked.has(index);
        return (
          <Fragment key={index}>
            <span
              className="inline-block"
              style={{
                opacity: pop?.opacity,
                transform: pop ? `scale(${pop.scale})` : undefined,
                ...(highlighted
                  ? neon
                    ? {
                        color: neon.core,
                        textShadow: `0 0 0.06em ${neon.halo}, 0 0 0.17em ${alpha(neon.halo, 0.7)}, 0 0 0.32em ${alpha(neon.halo, 0.45)}`,
                      }
                    : { color: appearance.highlightColor }
                  : {}),
              }}
            >
              {shown < word.length ? (
                <>
                  {word.slice(0, shown)}
                  <span style={{ opacity: 0 }}>{word.slice(shown)}</span>
                </>
              ) : (
                word
              )}
            </span>
            {index < words.length - 1 ? " " : null}
          </Fragment>
        );
      })}
    </span>
  );
  const height = (layout.bandBottom - layout.bandTop) * k;
  const shapeStyle: CSSProperties = {
    backgroundColor: alpha(appearance.bgColor, frame.bg.opacity),
    boxShadow: shapeShadow,
    transform: shift(frame.bg.shift),
    overflow: sliding ? "hidden" : undefined,
  };
  return (
    <span
      aria-hidden="true"
      className={cn(
        styles.scene,
        "pointer-events-none absolute inset-0 block overflow-hidden",
        className,
      )}
      style={{ opacity: frame.opacity }}
    >
      <span
        className="absolute inset-x-0 flex items-center justify-center"
        style={
          variant === "tile"
            ? { top: "50%", height: u(height), transform: "translateY(-50%)" }
            : { top: u(layout.bandTop), height: u(height) }
        }
      >
        {band === "full" ? (
          <span
            className="absolute inset-0 flex items-center justify-center"
            style={shapeStyle}
          >
            {textBlock}
          </span>
        ) : boxed ? (
          <span
            className="block"
            style={{
              ...shapeStyle,
              padding: `${uu(layout.padding)} ${uu((band === "rounded" ? 40 : 30) * scale)}`,
              borderRadius: band === "rounded" ? uu(24 * scale) : undefined,
            }}
          >
            {textBlock}
          </span>
        ) : (
          textBlock
        )}
      </span>
    </span>
  );
}

/**
 * A prévia do título por cima do vídeo do corte, no tempo do próprio vídeo: tocando, segue o vídeo quadro a quadro
 * durante a abertura (só este componente redesenha); parado, mostra o título já assentado naquele instante.
 */
export function VideoIntroTitleOverlay({
  video,
  timeMs: fallbackTimeMs,
  ...props
}: Omit<ComponentProps<typeof IntroTitleOverlay>, "reducedMotion"> & {
  video: HTMLVideoElement | null;
}) {
  const [state, setState] = useState({ timeMs: 0, playing: false });
  const introMs = props.settings.durationMs;
  useEffect(() => {
    if (!video) return;
    let frame = 0;
    const read = () =>
      setState({
        timeMs: video.currentTime * 1000,
        playing: !video.paused && !video.ended,
      });
    const loop = () => {
      read();
      if (
        !video.paused &&
        !video.ended &&
        video.currentTime * 1000 < introMs + 400
      )
        frame = requestAnimationFrame(loop);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      read();
    };
    const seeked = () => (video.paused ? read() : start());
    read();
    if (!video.paused) start();
    video.addEventListener("play", start);
    video.addEventListener("pause", stop);
    video.addEventListener("ended", stop);
    video.addEventListener("seeked", seeked);
    video.addEventListener("timeupdate", read);
    return () => {
      cancelAnimationFrame(frame);
      video.removeEventListener("play", start);
      video.removeEventListener("pause", stop);
      video.removeEventListener("ended", stop);
      video.removeEventListener("seeked", seeked);
      video.removeEventListener("timeupdate", read);
    };
  }, [video, introMs]);
  const playing = !!video && state.playing;
  return (
    <IntroTitleOverlay
      {...props}
      timeMs={video ? state.timeMs : fallbackTimeMs}
      reducedMotion={playing ? undefined : true}
    />
  );
}
