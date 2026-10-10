import { describe, expect, it } from "vitest";
import {
  captionPreviewPages,
  previewCaptionStyle,
  type CaptionTemplate,
  type PreviewKit,
} from "./caption-preview-utils";

const template = {
  font: { family: "Montserrat", sizePx: 72, bold: true },
  colors: { text: "#ffffff", highlight: "#facc15", outline: "#000000" },
  position: "top",
  animation: "pop",
  uppercase: true,
  outlinePx: 3,
  shadowPx: 2,
  maxWordsPerPage: 4,
  maxCharsPerPage: 28,
} as CaptionTemplate;

describe("prévia das legendas", () => {
  it("usa os valores do template escolhido e mantém uma prévia sem catálogo", () => {
    expect(previewCaptionStyle(template)).toMatchObject({
      fontName: "Montserrat",
      fontSizePx: 72,
      animation: "pop",
      position: "top",
      highlightColor: "#facc15",
    });
    expect(previewCaptionStyle()).toMatchObject({
      fontName: "Inter",
      animation: "color",
      position: "bottom",
    });
  });
  it("aplica o kit sobre o template, incluindo valores falsos e zero", () => {
    const kit = {
      fontFamily: "Inter",
      colors: { accent: "#a78bfa" },
      captionStyle: {
        fontName: "Archivo Black",
        bold: false,
        uppercase: false,
        outline: 0,
        shadow: 0,
        marginV: 0,
        animation: "none",
      },
    } as PreviewKit;
    expect(previewCaptionStyle(template, kit)).toMatchObject({
      fontName: "Archivo Black",
      bold: false,
      uppercase: false,
      outline: 0,
      shadow: 0,
      marginV: 0,
      animation: "none",
      highlightColor: "#a78bfa",
      fontSizePx: 72,
    });
    expect(
      previewCaptionStyle(template, {
        ...kit,
        captionStyle: { highlightColor: "#fb7185" },
      }).highlightColor,
    ).toBe("#fb7185");
  });
  it("divide a legenda por palavras e caracteres sem perder texto", () => {
    expect(captionPreviewPages("A melhor parte do vídeo", 3, 40)).toEqual([
      ["A", "melhor", "parte"],
      ["do", "vídeo"],
    ]);
    expect(captionPreviewPages("A melhor parte do vídeo", 8, 10)).toEqual([
      ["A", "melhor"],
      ["parte", "do"],
      ["vídeo"],
    ]);
    expect(
      captionPreviewPages("  Uma   palavraextraordinária  ", 1, 6),
    ).toEqual([["Uma"], ["palavraextraordinária"]]);
    expect(captionPreviewPages("   ", 4, 28)).toEqual([]);
  });
});
