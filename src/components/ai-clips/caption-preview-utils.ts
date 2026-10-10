import { type z } from "zod";
import {
  type BrandKit,
  type templateSchema,
} from "@/server/league-clips/contracts";

export type CaptionTemplate = z.infer<typeof templateSchema>;
export type PreviewKit = Pick<
  BrandKit,
  "name" | "fontFamily" | "colors" | "captionStyle" | "titleStyle" | "logo"
>;

export function previewCaptionStyle(
  template?: CaptionTemplate,
  kit?: Partial<Pick<PreviewKit, "fontFamily" | "colors" | "captionStyle">>,
) {
  const caption = kit?.captionStyle;
  return {
    fontName:
      caption?.fontName ?? kit?.fontFamily ?? template?.font.family ?? "Inter",
    fontSizePx: caption?.fontSizePx ?? template?.font.sizePx ?? 64,
    bold: caption?.bold ?? template?.font.bold ?? true,
    uppercase: caption?.uppercase ?? template?.uppercase ?? false,
    textColor: caption?.textColor ?? template?.colors.text ?? "#ffffff",
    highlightColor:
      caption?.highlightColor ??
      kit?.colors?.accent ??
      template?.colors.highlight ??
      "#2dd4bf",
    outlineColor:
      caption?.outlineColor ?? template?.colors.outline ?? "#000000",
    outline: caption?.outline ?? template?.outlinePx ?? 2,
    shadow: caption?.shadow ?? template?.shadowPx ?? 1,
    position: caption?.position ?? template?.position ?? "bottom",
    marginV: caption?.marginV ?? 80,
    maxWordsPerPage: caption?.maxWordsPerPage ?? template?.maxWordsPerPage ?? 4,
    maxCharsPerPage:
      caption?.maxCharsPerPage ?? template?.maxCharsPerPage ?? 28,
    animation: caption?.animation ?? template?.animation ?? "color",
  };
}

export type PreviewCaptionStyle = ReturnType<typeof previewCaptionStyle>;

export function previewFontFamily(font: string) {
  return ["Inter", "Montserrat", "Archivo Black"].includes(font)
    ? `"Clipfy ${font}", sans-serif`
    : `"${font}", "Clipfy Inter", sans-serif`;
}

export function captionPreviewPages(
  text: string,
  maxWords: number,
  maxChars: number,
) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const pages: string[][] = [];
  let page: string[] = [];
  for (const word of words) {
    if (
      page.length &&
      (page.length >= maxWords || [...page, word].join(" ").length > maxChars)
    ) {
      pages.push(page);
      page = [];
    }
    page.push(word);
  }
  if (page.length) pages.push(page);
  return pages;
}
