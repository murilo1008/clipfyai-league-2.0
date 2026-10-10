import { describe, expect, it } from "vitest";
import {
  applyIntroTitlePatch,
  autoIntroBandColor,
  autoIntroTextColor,
  clipIntroTitlePayload,
  contrastRatio,
  countLines,
  duplicatedIntroTitle,
  introTitleAppearance,
  introTitleForSubmit,
  introTitleIssues,
  introTitleLayout,
  introTitleOrNull,
  introTitleOverrides,
  introTitlePhase,
  introTitleSummary,
  previewTimeline,
  resolveIntroTitle,
  sameIntroTitle,
} from "./intro-title";

const defaults = resolveIntroTitle();

describe("camadas do título de abertura", () => {
  it("usa os padrões do servidor quando nada é definido", () => {
    expect(defaults).toEqual({
      enabled: true,
      durationMs: 3000,
      position: "caption",
      band: "full",
      hideCaptions: true,
      animation: "pop",
      highlight: "none",
    });
  });
  it("aplica brand kit, projeto e corte em ordem e ignora vazios", () => {
    expect(
      resolveIntroTitle(
        { durationMs: 5000, band: "box", bgColor: "#ff0000" },
        null,
        { durationMs: 2000, position: "top" },
        undefined,
      ),
    ).toEqual({
      ...defaults,
      durationMs: 2000,
      band: "box",
      position: "top",
      bgColor: "#ff0000",
    });
  });
  it("aplica mudanças e remove campos com null", () => {
    expect(
      applyIntroTitlePatch(
        { bgColor: "#ff0000", durationMs: 4000, textColor: undefined },
        { bgColor: null, band: "box", marginV: undefined },
      ),
    ).toEqual({ durationMs: 4000, band: "box" });
  });
});

describe("options.introTitle na criação do projeto", () => {
  it("não envia nada sem mudanças ou com o mesmo valor herdado", () => {
    expect(introTitleOverrides({}, defaults)).toBeUndefined();
    expect(
      introTitleOverrides({ durationMs: 3000, enabled: true }, defaults),
    ).toBeUndefined();
    expect(
      introTitleOverrides(
        { bgColor: "#FF0000" },
        resolveIntroTitle({ bgColor: "#ff0000" }),
      ),
    ).toBeUndefined();
  });
  it("envia só o que difere do brand kit", () => {
    const kit = resolveIntroTitle({ durationMs: 5000, band: "box" });
    expect(
      introTitleOverrides(
        { durationMs: 3000, band: "box", position: "center" },
        kit,
      ),
    ).toEqual({ durationMs: 3000, position: "center" });
  });
  it("desligado envia só enabled: false, e nada se o herdado já é desligado", () => {
    expect(
      introTitleOverrides({ enabled: false, durationMs: 9000 }, defaults),
    ).toEqual({ enabled: false });
    expect(
      introTitleOverrides(
        { durationMs: 5000 },
        resolveIntroTitle({ enabled: false }),
      ),
    ).toBeUndefined();
  });
});

describe("introTitle no PATCH do corte", () => {
  it("mantém o ajuste atual do corte e acrescenta a edição", () => {
    expect(
      clipIntroTitlePayload(
        { durationMs: 2000, bgColor: "#123456" },
        { band: "box", bgColor: null },
        false,
      ),
    ).toEqual({ durationMs: 2000, band: "box" });
  });
  it("voltar ao padrão do projeto manda null, ou só o que mudou depois", () => {
    expect(clipIntroTitlePayload({ durationMs: 2000 }, {}, true)).toBeNull();
    expect(
      clipIntroTitlePayload({ durationMs: 2000 }, { position: "top" }, true),
    ).toEqual({ position: "top" });
  });
  it("ajuste vazio vira null", () => {
    expect(
      clipIntroTitlePayload({ bgColor: "#123456" }, { bgColor: null }, false),
    ).toBeNull();
  });
});

describe("brand kit", () => {
  it("compara ajustes sem depender da ordem, da caixa das cores ou de vazios", () => {
    expect(
      sameIntroTitle(
        { band: "box", bgColor: "#FF0000" },
        { bgColor: "#ff0000", band: "box", textColor: undefined },
      ),
    ).toBe(true);
    expect(sameIntroTitle(null, {})).toBe(true);
    expect(sameIntroTitle({ durationMs: 2000 }, null)).toBe(false);
  });
  it("ajuste vazio vira null", () => {
    expect(introTitleOrNull({ bgColor: undefined })).toBeNull();
    expect(introTitleOrNull({ uppercase: false })).toEqual({
      uppercase: false,
    });
  });
  it("desligado descarta só os campos inválidos", () => {
    expect(
      introTitleForSubmit({ enabled: false, durationMs: 9000, band: "box" }),
    ).toEqual({ enabled: false, band: "box" });
    expect(introTitleForSubmit({ durationMs: 9000 })).toEqual({
      durationMs: 9000,
    });
    expect(introTitleForSubmit(null)).toBeNull();
  });
  it("duplica o título de abertura só quando é válido", () => {
    expect(duplicatedIntroTitle({ introTitle: { durationMs: 2000 } })).toEqual({
      introTitle: { durationMs: 2000 },
    });
    expect(duplicatedIntroTitle({ introTitle: null })).toEqual({});
    expect(duplicatedIntroTitle({})).toEqual({});
    expect(duplicatedIntroTitle({ introTitle: { durationMs: 1 } })).toEqual({});
  });
});

describe("validação com as faixas do contrato", () => {
  it("aceita os limites inclusivos", () => {
    expect(
      introTitleIssues({
        durationMs: 1000,
        marginV: 1800,
        maxFontSizePx: 40,
        bgColor: "#A1b2C3",
      }),
    ).toEqual({});
    expect(
      introTitleIssues({ durationMs: 8000, marginV: 0, maxFontSizePx: 120 }),
    ).toEqual({});
    expect(introTitleIssues(null)).toEqual({});
  });
  it.each([
    [
      { durationMs: 999 },
      "durationMs",
      "A duração do título de abertura deve ficar entre 1 e 8 segundos.",
    ],
    [
      { durationMs: 8001 },
      "durationMs",
      "A duração do título de abertura deve ficar entre 1 e 8 segundos.",
    ],
    [
      { durationMs: 2500.5 },
      "durationMs",
      "A duração do título de abertura deve ficar entre 1 e 8 segundos.",
    ],
    [
      { durationMs: Number.NaN },
      "durationMs",
      "A duração do título de abertura deve ficar entre 1 e 8 segundos.",
    ],
    [
      { marginV: 1801 },
      "marginV",
      "A margem do título de abertura deve ficar entre 0 e 1800 px.",
    ],
    [
      { maxFontSizePx: 39 },
      "maxFontSizePx",
      "O tamanho máximo do título de abertura deve ficar entre 40 e 120 px.",
    ],
    [{ bgColor: "#fff" }, "bgColor", "Use uma cor no formato #RRGGBB."],
    [{ textColor: "red" }, "textColor", "Use uma cor no formato #RRGGBB."],
  ])("recusa %j", (settings, field, message) => {
    expect(introTitleIssues(settings)).toEqual({ [field]: message });
  });
});

describe("cores automáticas", () => {
  it("faixa: texto cromático, senão destaque cromático, senão o texto", () => {
    expect(
      autoIntroBandColor({ textColor: "#FFE600", highlightColor: "#ff0000" }),
    ).toBe("#ffe600");
    expect(
      autoIntroBandColor({ textColor: "#ffffff", highlightColor: "#2dd4bf" }),
    ).toBe("#2dd4bf");
    expect(
      autoIntroBandColor({ textColor: "#fff", highlightColor: "#eeeeee" }),
    ).toBe("#ffffff");
  });
  it("a cor do título do brand kit vira a faixa", () => {
    expect(
      autoIntroBandColor(
        { textColor: "#ffffff", highlightColor: "#2dd4bf" },
        "#5b21b6",
      ),
    ).toBe("#5b21b6");
  });
  it("letra preta ou branca pelo maior contraste", () => {
    expect(autoIntroTextColor("#facc15")).toBe("#000000");
    expect(autoIntroTextColor("#ffffff")).toBe("#000000");
    expect(autoIntroTextColor("#7f1d1d")).toBe("#ffffff");
    for (const band of ["#facc15", "#2dd4bf", "#7f1d1d", "#5b21b6", "#808080"])
      expect(
        contrastRatio(band, autoIntroTextColor(band)),
      ).toBeGreaterThanOrEqual(4.5);
  });
  it("cores e fonte escolhidas vencem as automáticas", () => {
    const caption = {
      textColor: "#ffffff",
      highlightColor: "#2dd4bf",
      fontName: "Montserrat",
    };
    expect(introTitleAppearance({ settings: defaults, caption })).toEqual({
      bgColor: "#2dd4bf",
      autoBgColor: "#2dd4bf",
      textColor: "#000000",
      autoTextColor: "#000000",
      fontName: "Montserrat",
      uppercase: false,
      maxFontSizePx: 84,
      effect: "none",
      outlineColor: "#ffffff",
      // o destaque da legenda é a própria faixa: entra a cor de reserva com contraste (azul-marinho)
      highlightColor: "#1e3a8a",
      glowColor: "#2dd4bf",
      neonKeyword: null,
    });
    expect(
      introTitleAppearance({
        settings: resolveIntroTitle({
          bgColor: "#7f1d1d",
          fontName: "Inter",
          uppercase: true,
          maxFontSizePx: 100,
        }),
        caption,
        titleStyle: { fontName: "Archivo Black", uppercase: false },
      }),
    ).toMatchObject({
      bgColor: "#7f1d1d",
      textColor: "#ffffff",
      fontName: "Inter",
      uppercase: true,
      maxFontSizePx: 100,
    });
  });
});

describe("geometria da prévia", () => {
  const base = {
    aspect: "9:16" as const,
    fontName: "Archivo Black",
    uppercase: true,
    maxFontSizePx: 84,
    settings: defaults,
    caption: { position: "bottom" as const, marginV: 720 },
  };
  it("conta linhas da quebra gulosa", () => {
    expect(countLines("um dois tres", 7)).toBe(2);
    expect(countLines("", 10)).toBe(0);
  });
  it("título de 45 caracteres fica em 84 px e 3 linhas, com a base na da legenda", () => {
    const layout = introTitleLayout({
      ...base,
      text: "Como fazer leilão de propostas entre empresas",
    });
    expect(layout).toMatchObject({
      fontPx: 84,
      lines: 3,
      bandTop: 918,
      bandBottom: 1230,
    });
  });
  it("título de 55 caracteres desce para 70 px em 3 linhas", () => {
    expect(
      introTitleLayout({
        ...base,
        text: "A casca de banana: perguntar dos lugares onde trabalhou",
      }),
    ).toMatchObject({ fontPx: 70, lines: 3 });
  });
  it("centro, topo e margem própria, sempre dentro da zona segura", () => {
    const text = "Uma ideia curta";
    const center = introTitleLayout({
      ...base,
      text,
      settings: resolveIntroTitle({ position: "center" }),
    })!;
    expect((center.bandTop + center.bandBottom) / 2).toBe(960);
    const top = introTitleLayout({
      ...base,
      text,
      settings: resolveIntroTitle({ position: "top" }),
    })!;
    expect(top.bandTop).toBe(160);
    const low = introTitleLayout({
      ...base,
      text,
      settings: resolveIntroTitle({ marginV: 0 }),
    })!;
    expect(low.bandBottom).toBe(1920 - 380);
  });
  it("1:1 escala a fonte e sem texto não há faixa", () => {
    expect(
      introTitleLayout({ ...base, aspect: "1:1", text: "Curto" })?.fontPx,
    ).toBe(71);
    expect(introTitleLayout({ ...base, text: "   " })).toBeNull();
  });
});

describe("tempo da abertura", () => {
  it("mostra o título até o fim, com fade nos últimos 250 ms", () => {
    expect(introTitlePhase(0, defaults)).toEqual({
      visible: true,
      opacity: 1,
      captionsHidden: true,
    });
    expect(introTitlePhase(2875, defaults).opacity).toBe(0.5);
    expect(introTitlePhase(2950, defaults).captionsHidden).toBe(false);
    expect(introTitlePhase(3000, defaults).visible).toBe(false);
  });
  it("corte mais curto que o título e título desligado", () => {
    expect(introTitlePhase(1500, defaults, 1200).visible).toBe(false);
    expect(introTitlePhase(0, resolveIntroTitle({ enabled: false }))).toEqual({
      visible: false,
      opacity: 0,
      captionsHidden: false,
    });
    expect(
      introTitlePhase(0, resolveIntroTitle({ hideCaptions: false }))
        .captionsHidden,
    ).toBe(false);
  });
  it("na prévia em laço a legenda começa depois do título", () => {
    expect(previewTimeline(6000, defaults)).toEqual({
      totalMs: 9000,
      captionOffsetMs: 3000,
    });
    expect(
      previewTimeline(6000, resolveIntroTitle({ hideCaptions: false })),
    ).toEqual({ totalMs: 6000, captionOffsetMs: 0 });
    expect(previewTimeline(6000, null)).toEqual({
      totalMs: 6000,
      captionOffsetMs: 0,
    });
  });
  it("resume em pt-BR, com o estilo", () => {
    expect(introTitleSummary(defaults)).toBe(
      "Título de abertura: Clássico, 3 s",
    );
    expect(
      introTitleSummary(
        resolveIntroTitle({
          durationMs: 2500,
          band: "none",
          animation: "fade",
        }),
      ),
    ).toBe("Título de abertura: Minimal, 2,5 s");
    expect(introTitleSummary(resolveIntroTitle({ animation: "slide" }))).toBe(
      "Título de abertura: Personalizado, 3 s",
    );
    expect(introTitleSummary(resolveIntroTitle({ enabled: false }))).toBe(
      "Sem título de abertura",
    );
  });
});
