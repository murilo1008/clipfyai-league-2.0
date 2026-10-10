"use client";

import { type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import {
  captionPreviewPages,
  previewFontFamily,
  type PreviewCaptionStyle,
} from "./caption-preview-utils";
import styles from "./clip-preview.module.css";

export function CaptionSample({
  style,
  text = "A melhor parte do vídeo",
  timeMs = 1300,
  loop = false,
  scaled = false,
  className,
}: {
  style: PreviewCaptionStyle;
  text?: string;
  timeMs?: number;
  loop?: boolean;
  scaled?: boolean;
  className?: string;
}) {
  const pages = captionPreviewPages(
    text,
    style.maxWordsPerPage,
    style.maxCharsPerPage,
  );
  const wordCount = pages.reduce((count, page) => count + page.length, 0);
  const currentWord = Math.floor(timeMs / 650) % Math.max(1, wordCount);
  let offset = 0;
  const pageIndex = pages.findIndex((page) => {
    offset += page.length;
    return currentWord < offset;
  });
  const page = loop ? text.trim().split(/\s+/) : (pages[pageIndex] ?? []);
  const activeWord = currentWord - (offset - page.length);
  const customStyle = {
    fontFamily: previewFontFamily(style.fontName),
    fontWeight: style.bold ? 800 : 400,
    textTransform: style.uppercase ? "uppercase" : undefined,
    color: style.textColor,
    "--caption-size": style.fontSizePx,
    "--outline-size": style.outline,
    "--outline-color": style.outlineColor,
    "--shadow-size": style.shadow,
    "--text": style.textColor,
    "--highlight": style.highlightColor,
    "--cycle": `${page.length * 650}ms`,
  } as CSSProperties;
  return (
    <span
      className={cn(
        "block text-center leading-tight",
        scaled && styles.caption,
        className,
      )}
      style={customStyle}
      aria-label={text}
    >
      {page.map((word, index) => {
        const active =
          style.animation !== "none" &&
          (style.animation === "karaoke"
            ? index <= activeWord
            : index === activeWord);
        return (
          <span
            key={`${pageIndex}-${index}-${active}`}
            aria-hidden="true"
            className={cn(
              styles.word,
              loop && style.animation === "color" && styles.colorLoop,
              loop && style.animation === "pop" && styles.popLoop,
              loop && style.animation === "karaoke" && styles.karaokeLoop,
              !loop && active && style.animation === "pop" && styles.popActive,
            )}
            style={
              {
                color: active && !loop ? style.highlightColor : undefined,
                "--delay": `${index * 650}ms`,
              } as CSSProperties
            }
          >
            {word}
            {index < page.length - 1 ? " " : ""}
          </span>
        );
      })}
    </span>
  );
}
