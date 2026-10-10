import { describe, expect, it } from "vitest";
import {
  applyIntroTitlePatch,
  clipIntroTitlePayload,
  closestIntroPreset,
  INTRO_SAMPLE_TITLE,
  INTRO_TITLE_PRESETS,
  introGalleryState,
  introHighlightColor,
  introHighlightIndices,
  introPalette,
  introPreset,
  introPreviewAnimates,
  introStageTimeline,
  introStillTimeMs,
  introStyleOf,
  introStylePatch,
  introTitleAppearance,
  introTitleEffect,
  introTitleFrame,
  introTitleOverrides,
  matchIntroPreset,
  resolveIntroTitle,
  splitIntroWords,
  typewriterEndMs,
  wordsEndMs,
  type IntroTitlePatch,
} from "./intro-title";

const defaults = resolveIntroTitle();
const withPreset = (id: Parameters<typeof introPreset>[0], base = defaults) =>
  resolveIntroTitle(
    applyIntroTitlePatch(base, introStylePatch(introPreset(id).style)),
  );

describe("estilos prontos", () => {
  it("o padrão do servidor é o Clássico", () => {
    expect(matchIntroPreset(defaults)).toBe("classic");
    expect(introPreset("classic").style).toEqual(introStyleOf(defaults));
  });
  it("cada estilo aplicado é reconhecido de volta, sem mexer nas cores, duração e posição", () => {
    const base = resolveIntroTitle({
      durationMs: 5000,
      position: "top",
      bgColor: "#7f1d1d",
    });
    for (const preset of INTRO_TITLE_PRESETS) {
      const value = withPreset(preset.id, base);
      expect(matchIntroPreset(value)).toBe(preset.id);
      expect(value).toMatchObject({
        durationMs: 5000,
        position: "top",
        bgColor: "#7f1d1d",
        ...preset.style,
      });
    }
  });
  it("os seis estilos têm combinações diferentes", () => {
    const keys = INTRO_TITLE_PRESETS.map((preset) =>
      JSON.stringify(preset.style),
    );
    expect(new Set(keys).size).toBe(6);
    expect(INTRO_TITLE_PRESETS.map((preset) => preset.name)).toEqual([
      "Clássico",
      "Impacto",
      "Cartão",
      "Neon",
      "Máquina de escrever",
      "Minimal",
    ]);
  });
  it("sem fundo e sem efeito escolhido conta como contorno (Minimal)", () => {
    expect(introTitleEffect({ band: "none" })).toBe("outline");
    expect(introTitleEffect({ band: "none", effect: "none" })).toBe("none");
    expect(introTitleEffect({ band: "box" })).toBe("none");
    expect(
      matchIntroPreset(resolveIntroTitle({ band: "none", animation: "fade" })),
    ).toBe("minimal");
    expect(
      matchIntroPreset(
        resolveIntroTitle({ band: "none", animation: "fade", effect: "none" }),
      ),
    ).toBeNull();
  });
  it("personalizar depois vira 'Personalizado' e guarda a base", () => {
    const impact = withPreset("impact");
    expect(introGalleryState(impact)).toEqual({
      selected: "impact",
      base: "impact",
    });
    const tweaked = resolveIntroTitle(
      applyIntroTitlePatch(impact, { animation: "slide" }),
    );
    expect(matchIntroPreset(tweaked)).toBeNull();
    // a base é o último estilo escolhido na tela…
    expect(introGalleryState(tweaked, "impact")).toEqual({
      selected: "custom",
      base: "impact",
    });
    // …ou, sem ele (ajuste salvo antes), o mais parecido
    expect(introGalleryState(tweaked)).toEqual({
      selected: "custom",
      base: "impact",
    });
    expect(
      closestIntroPreset(
        resolveIntroTitle({
          band: "box",
          animation: "typewriter",
          effect: "glow",
        }),
      ),
    ).toBe("typewriter");
  });
  it("mudar cores, duração ou posição não tira o estilo escolhido", () => {
    const neon = withPreset("neon");
    const moved = resolveIntroTitle(
      applyIntroTitlePatch(neon, {
        durationMs: 2000,
        position: "center",
        textColor: "#ffffff",
      }),
    );
    expect(matchIntroPreset(moved)).toBe("neon");
  });
});

describe("herança com os estilos prontos", () => {
  it("criação: escolher o estilo que já vem herdado não manda nada", () => {
    const edits = applyIntroTitlePatch(
      {},
      introStylePatch(introPreset("classic").style),
    );
    expect(introTitleOverrides(edits, defaults)).toBeUndefined();
    const kit = resolveIntroTitle(introPreset("card").style);
    expect(
      introTitleOverrides(
        applyIntroTitlePatch({}, introStylePatch(introPreset("card").style)),
        kit,
      ),
    ).toBeUndefined();
  });
  it("criação: manda só os campos que diferem do brand kit", () => {
    const kit = resolveIntroTitle({ band: "box", durationMs: 2000 });
    expect(
      introTitleOverrides(
        applyIntroTitlePatch({}, introStylePatch(introPreset("impact").style)),
        kit,
      ),
    ).toEqual({
      band: "full",
      animation: "words",
      effect: "shadow",
      highlight: "auto",
    });
  });
  it("criação: o efeito automático não vai à toa, mas 'nenhum' sem fundo vai", () => {
    // Minimal: sem fundo o contorno já é automático
    expect(
      introTitleOverrides(
        applyIntroTitlePatch({}, introStylePatch(introPreset("minimal").style)),
        defaults,
      ),
    ).toEqual({ band: "none", animation: "fade" });
    // sem fundo e sem efeito, de propósito
    expect(
      introTitleOverrides({ band: "none", effect: "none" }, defaults),
    ).toEqual({ band: "none", effect: "none" });
    // o kit tem brilho: voltar ao Clássico precisa dizer "nenhum"
    expect(
      introTitleOverrides(
        applyIntroTitlePatch({}, introStylePatch(introPreset("classic").style)),
        resolveIntroTitle({ effect: "glow" }),
      ),
    ).toEqual({ effect: "none" });
  });
  it("corte: o estilo entra por cima do ajuste do corte; voltar ao projeto descarta", () => {
    const patch: IntroTitlePatch = introStylePatch(introPreset("neon").style);
    expect(clipIntroTitlePayload({ durationMs: 2000 }, patch, false)).toEqual({
      durationMs: 2000,
      band: "none",
      animation: "fade",
      effect: "glow",
      highlight: "auto",
    });
    expect(clipIntroTitlePayload({ band: "box" }, {}, true)).toBeNull();
  });
  it("brand kit → projeto → corte, campo a campo", () => {
    expect(
      resolveIntroTitle(
        introPreset("card").style,
        { animation: "pop" },
        { highlight: "auto" },
      ),
    ).toMatchObject({
      band: "rounded",
      animation: "pop",
      effect: "shadow",
      highlight: "auto",
    });
  });
});

describe("destaque automático da prévia (a heurística do league-clips)", () => {
  const pick = (title: string) =>
    introHighlightIndices(title).map((index) => splitIntroWords(title)[index]);
  it("prefere números e palavras longas, ignorando artigos, preposições e verbos fracos", () => {
    expect(pick(INTRO_SAMPLE_TITLE)).toEqual(["3", "primeiros"]);
    expect(pick("Como fazer leilão de propostas entre empresas")).toEqual([
      "leilão",
      "propostas",
    ]);
  });
  it("número leva a unidade junto; nome próprio ganha pontos", () => {
    expect(pick("Vaga de júnior com dez anos de experiência")).toEqual([
      "dez",
      "anos",
    ]);
    expect(pick("Você vota no palhaço e elege o marginal")).toEqual([
      "palhaço",
      "marginal",
    ]);
  });
  it("nunca o título inteiro: 1 palavra, nenhuma; 2 palavras, uma", () => {
    expect(pick("Segredo")).toEqual([]);
    expect(pick("Segredo revelado")).toEqual(["revelado"]);
    expect(pick("de a o e")).toEqual([]);
    expect(pick("")).toEqual([]);
  });
  it("ignora acentos e pontuação ao reconhecer palavras vazias", () => {
    const picked = pick("Até você vai rir: é sério!");
    expect(picked).not.toContain("Até");
    expect(picked).not.toContain("é");
    expect(picked).toContain("sério!");
  });
  it("cor do destaque: contraste de 4,5:1 com o que está atrás das letras, senão a reserva", () => {
    const caption = { textColor: "#ffffff", highlightColor: "#facc15" };
    expect(
      introHighlightColor({
        band: "full",
        effect: "none",
        bgColor: "#7f1d1d",
        textColor: "#ffffff",
        caption,
      }),
    ).toBe("#facc15");
    // amarelo na faixa amarela → vermelho-escuro
    expect(
      introHighlightColor({
        band: "full",
        effect: "none",
        bgColor: "#facc15",
        textColor: "#000000",
        caption,
      }),
    ).toBe("#b3001b");
    // sem fundo, com brilho: o vídeo escuro atrás
    expect(
      introHighlightColor({
        band: "none",
        effect: "glow",
        bgColor: "#facc15",
        textColor: "#ffffff",
        caption,
      }),
    ).toBe("#facc15");
  });
  it("sem fundo: letra branca, contorno preto e destaque em neon no brilho", () => {
    const caption = {
      textColor: "#ffffff",
      highlightColor: "#2dd4bf",
      fontName: "Inter",
    };
    expect(
      introTitleAppearance({
        settings: resolveIntroTitle({ band: "none" }),
        caption,
      }),
    ).toMatchObject({
      effect: "outline",
      textColor: "#ffffff",
      autoTextColor: "#ffffff",
      outlineColor: "#000000",
      neonKeyword: null,
    });
    expect(
      introTitleAppearance({
        settings: resolveIntroTitle(introPreset("neon").style),
        caption,
      }).neonKeyword,
    ).toEqual({ core: "#2dd4bf", halo: "#ffffff" });
    expect(
      introTitleAppearance({
        settings: resolveIntroTitle({
          ...introPreset("neon").style,
          bgColor: "#d946ef",
        }),
        caption,
      }).neonKeyword,
    ).toEqual({ core: "#96eadf", halo: "#2dd4bf" });
  });
});

describe("animação da prévia", () => {
  const text = "Um dois três quatro";
  const frame = (
    animation: NonNullable<
      Parameters<typeof resolveIntroTitle>[0]
    >["animation"],
    timeMs: number,
    reducedMotion = false,
    durationMs = 3000,
  ) =>
    introTitleFrame(timeMs, resolveIntroTitle({ animation, durationMs }), {
      text,
      reducedMotion,
    });
  it("pop: fade de 100 ms e escala de 85 % a 100 % em 150 ms", () => {
    expect(frame("pop", 0).text).toMatchObject({ opacity: 0, scale: 0.85 });
    expect(frame("pop", 100).text.opacity).toBe(1);
    expect(frame("pop", 100).bg.opacity).toBe(1);
    expect(frame("pop", 150).text).toMatchObject({ opacity: 1, scale: 1 });
  });
  it("deslizar: o fundo vem da esquerda em ~280 ms e o texto 60 ms depois", () => {
    expect(frame("slide", 0).bg.shift).toBe(1);
    expect(frame("slide", 280).bg.shift).toBe(0);
    expect(frame("slide", 280).text.shift).toBeGreaterThan(0);
    expect(frame("slide", 340).text.shift).toBe(0);
    // sem fundo, o próprio texto desliza, sem atraso
    expect(
      introTitleFrame(
        280,
        resolveIntroTitle({ animation: "slide", band: "none" }),
        { text },
      ).text.shift,
    ).toBe(0);
  });
  it("digitando: letra a letra (espaços não contam) de 100 ms até ~40 % da duração", () => {
    expect(typewriterEndMs(1000)).toBe(600);
    expect(typewriterEndMs(3000)).toBe(1200);
    expect(typewriterEndMs(8000)).toBe(1400);
    const total = text.replace(/\s/g, "").length;
    expect(frame("typewriter", 100).chars).toBe(0);
    expect(frame("typewriter", 650).chars).toBeGreaterThan(0);
    expect(frame("typewriter", 650).chars).toBeLessThan(total);
    expect(frame("typewriter", 1200).chars).toBe(total);
  });
  it("palavra a palavra: a 1ª em 100 ms e a última inteira em ~35 % da duração", () => {
    expect(wordsEndMs(3000)).toBe(1050);
    const start = frame("words", 0).words!;
    expect(start).toHaveLength(4);
    expect(start[0]).toEqual({ opacity: 0, scale: 0.8 });
    const middle = frame("words", 500).words!;
    expect(middle[0]!.opacity).toBe(1);
    expect(middle[3]!.opacity).toBe(0);
    expect(
      frame("words", 1050).words!.every((word) => word.opacity === 1),
    ).toBe(true);
  });
  it("fade: entra em ~200 ms e todos saem em fade nos últimos 250 ms", () => {
    expect(frame("fade", 100).opacity).toBe(0.5);
    expect(frame("fade", 200).opacity).toBe(1);
    expect(frame("pop", 2875).opacity).toBe(0.5);
    expect(frame("pop", 3000).visible).toBe(false);
  });
  it("prefers-reduced-motion: título inteiro e parado desde o início, só com a saída", () => {
    for (const animation of [
      "pop",
      "slide",
      "typewriter",
      "words",
      "fade",
    ] as const) {
      const still = frame(animation, 0, true);
      expect(still).toMatchObject({
        visible: true,
        opacity: 1,
        bg: { opacity: 1, shift: 0 },
        text: { opacity: 1, scale: 1, shift: 0 },
        chars: null,
        words: null,
      });
      expect(frame(animation, 2875, true).opacity).toBe(0.5);
    }
  });
  it("prévias param sozinhas com menos movimento, mas o play da pessoa vence", () => {
    expect(introPreviewAnimates({ reducedMotion: false, playing: null })).toBe(
      true,
    );
    expect(introPreviewAnimates({ reducedMotion: true, playing: null })).toBe(
      false,
    );
    expect(introPreviewAnimates({ reducedMotion: true, playing: true })).toBe(
      true,
    );
    expect(introPreviewAnimates({ reducedMotion: false, playing: false })).toBe(
      false,
    );
  });
  it("o quadro parado mostra o título já inteiro", () => {
    for (const animation of ["typewriter", "words", "pop"] as const)
      for (const durationMs of [1000, 3000, 8000]) {
        const settings = resolveIntroTitle({ animation, durationMs });
        const still = introTitleFrame(introStillTimeMs(settings), settings, {
          text,
        });
        expect(still.visible).toBe(true);
        expect(still.opacity).toBe(1);
        expect(
          still.chars === null ||
            still.chars === text.replace(/\s/g, "").length,
        ).toBe(true);
        expect(still.words?.every((word) => word.opacity === 1) ?? true).toBe(
          true,
        );
      }
  });
  it("laço da prévia grande: título, legenda depois dele e uma pausa", () => {
    expect(introStageTimeline(defaults)).toEqual({
      titleMs: 3000,
      totalMs: 4600,
      captionStartMs: 2900,
    });
    expect(
      introStageTimeline(resolveIntroTitle({ hideCaptions: false }))
        .captionStartMs,
    ).toBe(0);
  });
});

describe("amostras de cor", () => {
  it("sem repetir, sem a cor automática e só cores válidas", () => {
    expect(
      introPalette(
        [
          { label: "Destaque", color: "#2DD4BF" },
          { label: "Principal", color: "#fff" },
          { label: "Branco", color: "#ffffff" },
          { label: "Vazia", color: null },
          { label: "Inválida", color: "red" },
          { label: "Repetida", color: "#2dd4bf" },
          { label: "Preto", color: "#000000" },
        ],
        ["#000000"],
      ),
    ).toEqual([
      { label: "Destaque", color: "#2dd4bf" },
      { label: "Principal", color: "#ffffff" },
    ]);
  });
});
