"use client";

import Image from "next/image";
import { type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { type ResolvedIntroTitle } from "@/server/league-clips/contracts";
import { CaptionSample } from "./caption-sample";
import {
  previewCaptionStyle,
  previewFontFamily,
  type CaptionTemplate,
  type PreviewKit,
} from "./caption-preview-utils";
import { introTitleAppearance, introTitlePhase } from "./intro-title";
import { IntroTitleOverlay } from "./intro-title-overlay";
import styles from "./clip-preview.module.css";

const positions = {
  "top-left": "top-[3%] left-[5%]",
  "top-right": "top-[3%] right-[5%]",
  "bottom-left": "bottom-[3%] left-[5%]",
  "bottom-right": "bottom-[3%] right-[5%]",
};

export function BrandPreview({
  kit,
  template,
  watermark = false,
  compact = false,
  aspectRatio = "9:16",
  captionsEnabled = true,
  timeMs = 1300,
  captionText = "A melhor parte do vídeo começa com uma boa ideia",
  titleText,
  showGuides = false,
  background = "scene",
  intro,
}: {
  kit?: PreviewKit;
  template?: CaptionTemplate;
  watermark?: boolean;
  compact?: boolean;
  aspectRatio?: "9:16" | "1:1";
  captionsEnabled?: boolean;
  timeMs?: number;
  captionText?: string;
  titleText?: string;
  showGuides?: boolean;
  background?: "scene" | "plain";
  /** Título de abertura: substitui o título fixo no topo e aparece só nos primeiros N segundos (`timeMs`). */
  intro?: { settings: ResolvedIntroTitle; text: string; timeMs: number } | null;
}) {
  const caption = previewCaptionStyle(template, kit);
  const introPhase = intro
    ? introTitlePhase(intro.timeMs, intro.settings)
    : null;
  const showCaptions = captionsEnabled && !introPhase?.captionsHidden;
  const logoPosition =
    kit && watermark && kit.logo.position === "bottom-right"
      ? "bottom-left"
      : kit?.logo.position;
  const marginPercent =
    (caption.marginV / (aspectRatio === "9:16" ? 1920 : 1080)) * 100;
  const captionPosition: CSSProperties =
    caption.position === "middle"
      ? { top: "50%", transform: "translateY(-50%)" }
      : caption.position === "top"
        ? { top: `${marginPercent}%` }
        : { bottom: `${marginPercent}%` };
  return (
    <div
      className={cn(
        styles.scene,
        "relative mx-auto overflow-hidden rounded-2xl bg-slate-950 text-white ring-1 ring-white/10 transition-[aspect-ratio] duration-300 ease-out motion-reduce:transition-none",
        compact ? "w-28" : "w-full max-w-[300px]",
      )}
      style={{ aspectRatio: aspectRatio === "9:16" ? "9 / 16" : "1 / 1" }}
      role="img"
      aria-label={`Prévisualização ${aspectRatio}${kit ? ` da identidade ${kit.name}` : ""}${captionsEnabled ? ", com legenda" : ", sem legenda"}${intro?.settings.enabled ? ", com título de abertura" : ""}`}
    >
      {background === "scene" && (
        <Image
          src="/images/ai-clips/preview-podcast.webp"
          alt=""
          fill
          sizes={compact ? "112px" : "300px"}
          className="object-cover"
          style={{ objectPosition: "50% 45%" }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/55" />
      {showGuides && (
        <div className="pointer-events-none absolute inset-x-[6%] inset-y-[8%] rounded-lg border border-dashed border-white/40">
          <span className="absolute top-1 left-2 text-[8px] tracking-wider text-white/70 uppercase">
            Área segura
          </span>
        </div>
      )}
      {kit && !intro && (
        <div
          className={cn(
            styles.title,
            "absolute inset-x-[8%] top-[15%] text-center leading-tight font-extrabold break-words",
          )}
          style={
            {
              fontFamily: previewFontFamily(
                kit.titleStyle?.fontName ?? kit.fontFamily ?? "Inter",
              ),
              color: kit.titleStyle?.textColor ?? "#ffffff",
              textTransform: kit.titleStyle?.uppercase
                ? "uppercase"
                : undefined,
              "--title-size": kit.titleStyle?.fontSizePx ?? 56,
              "--title-outline": kit.titleStyle?.outlineColor ?? "#000000",
            } as CSSProperties
          }
        >
          {titleText ?? kit.name}
        </div>
      )}
      {intro && (
        <IntroTitleOverlay
          text={intro.text}
          settings={intro.settings}
          appearance={introTitleAppearance({
            settings: intro.settings,
            caption,
            titleStyle: kit?.titleStyle,
            templateUppercase: template?.uppercase,
          })}
          aspect={aspectRatio}
          caption={caption}
          timeMs={intro.timeMs}
        />
      )}
      {showCaptions && (
        <div className="absolute inset-x-[6%]" style={captionPosition}>
          <CaptionSample
            style={caption}
            text={captionText}
            timeMs={timeMs}
            scaled
          />
        </div>
      )}
      {kit?.logo.url && logoPosition && (
        <div
          className={cn("absolute", positions[logoPosition])}
          style={{
            width: `${kit.logo.scale * 100}%`,
            opacity: kit.logo.opacity,
          }}
        >
          <Image
            src={kit.logo.url}
            alt=""
            width={96}
            height={96}
            unoptimized
            className="h-auto w-full object-contain"
          />
        </div>
      )}
      {watermark && (
        <div className="absolute right-[5%] bottom-[3%] text-[9px] font-bold drop-shadow-md">
          Clipfy
        </div>
      )}
    </div>
  );
}
