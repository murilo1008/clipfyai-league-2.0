import {
  INTRO_TITLE_DEFAULTS,
  introTitleSettingsSchema,
  resolveIntroTitle,
  type IntroTitleSettings,
  type ResolvedIntroTitle,
} from "@/server/league-clips/contracts";

/** Mudança pedida pelos controles: `null` remove o campo (volta ao herdado ou ao automático). */
export type IntroTitlePatch = {
  [K in keyof IntroTitleSettings]?: IntroTitleSettings[K] | null;
};
export type IntroTitleKey = keyof IntroTitleSettings;
export type IntroTitleIssues = Partial<Record<IntroTitleKey, string>>;

/** Marcas do controle de duração (o controle vai de 1 a 8 s). */
export const INTRO_TITLE_DURATION_PRESETS_MS = [2000, 3000, 4000, 5000];
/** Título de exemplo das prévias (criação e brand kit): número e palavra forte mostram o destaque automático. */
export const INTRO_SAMPLE_TITLE = "O segredo dos 3 primeiros segundos";
/** Fonte máxima do título quando nada é definido (px num quadro 1080×1920), como no league-clips. */
export const INTRO_TITLE_DEFAULT_MAX_FONT_PX = 84;
const INTRO_TITLE_MIN_FONT_PX = 60;
const INTRO_TITLE_MAX_LINES = 3;
const INTRO_TITLE_PADDING_PX = 30;
/** Saída em fade nos últimos 250 ms; a legenda entra 100 ms antes do fim (troca cruzada). */
export const INTRO_TITLE_FADE_OUT_MS = 250;
const INTRO_TITLE_CAPTION_OVERLAP_MS = 100;

type Option = { label: string; hint: string };
export type IntroBand = ResolvedIntroTitle["band"];
export type IntroAnimation = ResolvedIntroTitle["animation"];
export type IntroEffect = NonNullable<IntroTitleSettings["effect"]>;
export type IntroHighlight = ResolvedIntroTitle["highlight"];
export type IntroPosition = ResolvedIntroTitle["position"];

export const introAnimationOptions: Record<IntroAnimation, Option> = {
  pop: { label: "Pop", hint: "Entra crescendo, em um piscar de olhos." },
  slide: {
    label: "Deslizar",
    hint: "O fundo desliza da esquerda e o texto vem logo atrás.",
  },
  typewriter: { label: "Digitando", hint: "As letras aparecem uma a uma." },
  words: {
    label: "Palavra a palavra",
    hint: "Cada palavra salta em sequência.",
  },
  fade: { label: "Fade", hint: "Surge suave, sem movimento." },
};
export const introEffectOptions: Record<IntroEffect, Option> = {
  none: { label: "Nenhum", hint: "Texto limpo, sem efeito." },
  shadow: { label: "Sombra", hint: "Sombra suave por baixo do texto." },
  outline: {
    label: "Contorno",
    hint: "Contorno grosso na cor oposta à do texto.",
  },
  glow: {
    label: "Brilho",
    hint: "Halo na cor de destaque: no texto, sem fundo; na faixa ou caixa, com fundo.",
  },
};
export const introBandOptions: Record<IntroBand, Option> = {
  full: { label: "Faixa", hint: "Faixa colorida de ponta a ponta." },
  box: { label: "Caixa", hint: "Caixa só atrás do texto." },
  rounded: { label: "Arredondada", hint: "Caixa com cantos arredondados." },
  none: {
    label: "Sem fundo",
    hint: "Só o texto; sem efeito escolhido, ganha contorno automático.",
  },
};
export const introPositionOptions: Record<IntroPosition, Option> = {
  caption: {
    label: "Na legenda",
    hint: "Na altura em que a legenda aparece depois.",
  },
  top: { label: "Topo", hint: "Logo abaixo da área segura do topo." },
  center: { label: "Centro", hint: "No meio da tela." },
};

const isColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

/** Sem campos vazios (`undefined`/`null`), para não mandar ruído ao league. */
export function cleanIntroTitle(
  settings: IntroTitleSettings | null | undefined,
): IntroTitleSettings {
  return Object.fromEntries(
    Object.entries(settings ?? {}).filter(
      ([, value]) => value !== undefined && value !== null,
    ),
  ) as IntroTitleSettings;
}

export function applyIntroTitlePatch(
  settings: IntroTitleSettings | null | undefined,
  patch: IntroTitlePatch,
): IntroTitleSettings {
  const next: Record<string, unknown> = { ...cleanIntroTitle(settings) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete next[key];
    else if (value !== undefined) next[key] = value;
  }
  return next as IntroTitleSettings;
}

function sameValue(a: unknown, b: unknown) {
  return isColor(a) && isColor(b)
    ? a.toLowerCase() === b.toLowerCase()
    : a === b;
}

/** Mesmo ajuste (ordem dos campos e caixa das cores não importam; vazio = nulo). */
export function sameIntroTitle(
  a: IntroTitleSettings | null | undefined,
  b: IntroTitleSettings | null | undefined,
) {
  const left = cleanIntroTitle(a),
    right = cleanIntroTitle(b);
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) =>
    sameValue(left[key as IntroTitleKey], right[key as IntroTitleKey]),
  );
}

/** Ajuste vazio vira `null` (= segue o padrão). */
export function introTitleOrNull(
  settings: IntroTitleSettings | null | undefined,
) {
  const clean = cleanIntroTitle(settings);
  return Object.keys(clean).length ? clean : null;
}

/** Ao duplicar um brand kit: leva o título de abertura do original, se houver e for válido. */
export function duplicatedIntroTitle(source: {
  introTitle?: IntroTitleSettings | null;
}): { introTitle?: IntroTitleSettings } {
  const clean = introTitleOrNull(source.introTitle);
  return clean && introTitleSettingsSchema.safeParse(clean).success
    ? { introTitle: clean }
    : {};
}

/**
 * O que vai em `options.introTitle` ao criar o projeto: só o que a pessoa mudou e difere do herdado (brand kit
 * escolhido ou padrão do servidor). Desligado manda só `enabled: false`. `undefined` = nada a enviar.
 */
export function introTitleOverrides(
  edits: IntroTitleSettings,
  inherited: ResolvedIntroTitle,
): IntroTitleSettings | undefined {
  const effective = resolveIntroTitle(inherited, edits);
  if (!effective.enabled)
    return inherited.enabled ? { enabled: false } : undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(cleanIntroTitle(edits)))
    if (!sameValue(inherited[key as IntroTitleKey], value)) out[key] = value;
  // `effect` só vai quando muda o resultado: ausente, ele já é "nenhum" (ou contorno, sem fundo).
  if (
    "effect" in out &&
    introTitleEffect(
      resolveIntroTitle(inherited, { ...out, effect: undefined }),
    ) === introTitleEffect(effective)
  )
    delete out.effect;
  return Object.keys(out).length ? (out as IntroTitleSettings) : undefined;
}

/**
 * O que vai no PATCH do corte: o ajuste atual do corte com as mudanças desta edição; `reset` (voltar ao padrão do
 * projeto) descarta o ajuste anterior. Ajuste vazio = `null` (o corte segue o projeto).
 */
export function clipIntroTitlePayload(
  current: IntroTitleSettings | null | undefined,
  edits: IntroTitlePatch,
  reset: boolean,
): IntroTitleSettings | null {
  const next = applyIntroTitlePatch(reset ? null : current, edits);
  return Object.keys(next).length ? next : null;
}

/** Erros por campo, com as faixas e mensagens do contrato (vazio = válido). */
export function introTitleIssues(
  settings: IntroTitleSettings | null | undefined,
): IntroTitleIssues {
  const parsed = introTitleSettingsSchema.safeParse(settings ?? {});
  if (parsed.success) return {};
  const issues: IntroTitleIssues = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in issues))
      issues[key as IntroTitleKey] = issue.message;
  }
  return issues;
}

/**
 * O que enviar quando o título está desligado: os campos ficam fora da tela, então um valor inválido digitado antes
 * é descartado em vez de travar o envio.
 */
export function introTitleForSubmit(
  settings: IntroTitleSettings | null,
): IntroTitleSettings | null {
  if (!settings || settings.enabled !== false) return settings;
  const issues = introTitleIssues(settings);
  return Object.fromEntries(
    Object.entries(settings).filter(([key]) => !(key in issues)),
  ) as IntroTitleSettings;
}

export function formatIntroSeconds(ms: number) {
  return (
    (ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " s"
  );
}

export function introTitleSummary(settings: ResolvedIntroTitle) {
  if (!settings.enabled) return "Sem título de abertura";
  const preset = matchIntroPreset(settings);
  return (
    "Título de abertura: " +
    (preset ? introPreset(preset).name : "Personalizado") +
    ", " +
    formatIntroSeconds(settings.durationMs)
  );
}

function rgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((char) => char + char)
          .join("")
      : value;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0) as [
    number,
    number,
    number,
  ];
}

/** Luminância relativa (WCAG 2.x), de 0 (preto) a 1 (branco). */
export function relativeLuminance(hex: string) {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: string, b: string) {
  const la = relativeLuminance(a),
    lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function isAccent(hex: string) {
  const [r, g, b] = rgb(hex);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  return max / 255 >= 0.25 && (max - min) / Math.max(1, max) >= 0.35;
}

const toSixDigits = (hex: string) =>
  "#" +
  rgb(hex)
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("");

/**
 * Faixa automática, como no league-clips (§63): a cor do título do brand kit; senão a cor de destaque da legenda —
 * o texto se for cromático, senão a palavra ativa se for cromática, senão o próprio texto.
 */
export function autoIntroBandColor(
  caption: { textColor: string; highlightColor: string },
  titleTextColor?: string | null,
) {
  if (titleTextColor) return toSixDigits(titleTextColor);
  if (isAccent(caption.textColor)) return toSixDigits(caption.textColor);
  if (isAccent(caption.highlightColor))
    return toSixDigits(caption.highlightColor);
  return toSixDigits(caption.textColor);
}

/** Letra automática: preta ou branca, a de maior contraste com a faixa (empate → preta). */
export function autoIntroTextColor(bandColor: string) {
  return contrastRatio(bandColor, "#000000") >=
    contrastRatio(bandColor, "#ffffff")
    ? "#000000"
    : "#ffffff";
}

export type IntroAppearanceInput = {
  settings: ResolvedIntroTitle;
  /** Estilo efetivo da legenda (template + brand kit). */
  caption: {
    textColor: string;
    highlightColor: string;
    outlineColor?: string;
    fontName: string;
  };
  titleStyle?: {
    fontName?: string;
    textColor?: string;
    uppercase?: boolean;
  } | null;
  templateUppercase?: boolean;
};

export type IntroLook = Omit<IntroAppearanceInput, "settings">;

/** Letra automática como no league-clips (§66): sobre o fundo, preta ou branca pelo contraste; sem fundo, branca. */
export function autoIntroLetterColor(band: IntroBand, bgColor: string) {
  return band === "none" ? "#ffffff" : autoIntroTextColor(bgColor);
}

export function introTitleAppearance({
  settings,
  caption,
  titleStyle,
  templateUppercase,
}: IntroAppearanceInput) {
  const autoBand = autoIntroBandColor(caption, titleStyle?.textColor);
  const bgColor = settings.bgColor ?? autoBand;
  const autoText = autoIntroLetterColor(settings.band, bgColor);
  const textColor = settings.textColor ?? autoText;
  const effect = introTitleEffect(settings);
  const highlightColor = introHighlightColor({
    band: settings.band,
    effect,
    bgColor,
    textColor,
    caption,
  });
  return {
    bgColor,
    autoBgColor: autoBand,
    textColor,
    autoTextColor: autoText,
    fontName: settings.fontName ?? titleStyle?.fontName ?? caption.fontName,
    uppercase:
      settings.uppercase ?? titleStyle?.uppercase ?? templateUppercase ?? false,
    maxFontSizePx: settings.maxFontSizePx ?? INTRO_TITLE_DEFAULT_MAX_FONT_PX,
    effect,
    /** Contorno: preto ou branco, o oposto da letra. */
    outlineColor: autoIntroTextColor(textColor),
    highlightColor,
    /** Brilho: sem fundo, halo do texto na cor de destaque do título (a da faixa); com fundo, halo da faixa/caixa. */
    glowColor: bgColor,
    /** Palavra destacada no brilho sem fundo: neon de miolo claro (ou, se ela some no halo, halo na cor da letra). */
    neonKeyword:
      settings.band === "none" && effect === "glow"
        ? introNeonKeyword(highlightColor, bgColor, textColor)
        : null,
  };
}

/** Efeito que o vídeo usa: o escolhido; sem escolha, contorno quando não há fundo e nenhum nos demais. */
export function introTitleEffect(
  settings: Pick<IntroTitleSettings, "effect" | "band">,
): IntroEffect {
  return settings.effect ?? (settings.band === "none" ? "outline" : "none");
}

const rgbDistance = (a: string, b: string) => {
  const [r1, g1, b1] = rgb(a),
    [r2, g2, b2] = rgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
};
const mixWith = (hex: string, target: 0 | 255, amount: number) =>
  "#" +
  rgb(hex)
    .map((c) =>
      Math.round(c + (target - c) * amount)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
const HIGHLIGHT_ON_LIGHT = ["#b3001b", "#1e3a8a", "#5b21b6", "#7a0010"];
const HIGHLIGHT_ON_DARK = ["#ffd60a", "#22d3ee", "#f472b6", "#a3e635"];

/**
 * Cor das palavras destacadas, com a regra do league-clips (§66): a primeira com contraste ≥ 4,5:1 com o que fica
 * atrás das letras (a faixa; sem fundo, preto na sombra/brilho ou a cor oposta à letra) e distante da letra — entre o
 * destaque da legenda, o texto da legenda, a faixa e o contorno da legenda (se cromático); senão a primeira cromática
 * escurecida/clareada até 30 %; senão uma cor de reserva.
 */
export function introHighlightColor({
  band,
  effect,
  bgColor,
  textColor,
  caption,
}: {
  band: IntroBand;
  effect: IntroEffect;
  bgColor: string;
  textColor: string;
  caption: { textColor: string; highlightColor: string; outlineColor?: string };
}) {
  const background =
    band !== "none"
      ? toSixDigits(bgColor)
      : effect === "shadow" || effect === "glow"
        ? "#000000"
        : autoIntroTextColor(textColor);
  const ok = (color: string) =>
    contrastRatio(color, background) >= 4.5 &&
    rgbDistance(color, textColor) >= 100;
  const candidates: string[] = [];
  for (const color of [caption.highlightColor, caption.textColor, bgColor]) {
    const six = toSixDigits(color);
    if (!candidates.includes(six)) candidates.push(six);
  }
  if (caption.outlineColor && isAccent(caption.outlineColor)) {
    const six = toSixDigits(caption.outlineColor);
    if (!candidates.includes(six)) candidates.push(six);
  }
  const hit = candidates.find(ok);
  if (hit) return hit;
  const light = autoIntroTextColor(background) === "#000000";
  for (const color of candidates.filter(isAccent))
    for (let step = 1; step <= 6; step++) {
      const shifted = mixWith(color, light ? 0 : 255, step * 0.05);
      if (ok(shifted)) return shifted;
    }
  const reserve = light ? HIGHLIGHT_ON_LIGHT : HIGHLIGHT_ON_DARK;
  return reserve.find(ok) ?? reserve[0]!;
}

/** Neon da palavra destacada no brilho sem fundo (§66): miolo claro e halo na cor do destaque. */
export function introNeonKeyword(
  highlight: string,
  glow: string,
  text: string,
) {
  return rgbDistance(highlight, glow) >= 100
    ? { core: mixWith(highlight, 255, 0.5), halo: toSixDigits(highlight) }
    : { core: toSixDigits(highlight), halo: toSixDigits(text) };
}

const charEm: Record<string, { upper: number; mixed: number }> = {
  "Archivo Black": { upper: 0.54, mixed: 0.45 },
  Inter: { upper: 0.54, mixed: 0.45 },
  Montserrat: { upper: 0.5, mixed: 0.42 },
};

/** Nº de linhas da quebra gulosa em linhas de até `maxChars` (o mínimo possível com essa largura). */
export function countLines(text: string, maxChars: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  let lines = 0,
    current = 0;
  for (const word of words) {
    if (current && current + 1 + word.length <= maxChars)
      current += 1 + word.length;
    else {
      lines++;
      current = word.length;
    }
  }
  return lines;
}

const frames = {
  "9:16": { height: 1920, scale: 1, top: 160, bottom: 380, side: 140 },
  "1:1": { height: 1080, scale: 0.85, top: 65, bottom: 65, side: 60 },
} as const;

export type IntroLayoutInput = {
  text: string;
  settings: ResolvedIntroTitle;
  aspect: "9:16" | "1:1";
  fontName: string;
  uppercase: boolean;
  maxFontSizePx: number;
  /** Onde a legenda estaria (posição e margem em px do quadro). */
  caption: { position: "bottom" | "middle" | "top"; marginV: number };
};

/**
 * Geometria aproximada da prévia (px num quadro de 1080 de largura): a maior fonte, de `maxFontSizePx` descendo de 2
 * em 2 até 60 px, em que o título cabe em 3 linhas na largura da zona segura; ancorada como no league-clips (base,
 * topo ou centro) e mantida dentro da zona segura. `null` sem texto.
 */
export function introTitleLayout(input: IntroLayoutInput) {
  const text = input.text.trim();
  if (!text) return null;
  const frame = frames[input.aspect];
  const H = frame.height;
  const padding = Math.round(INTRO_TITLE_PADDING_PX * frame.scale);
  const textWidth = 1080 - 2 * frame.side;
  const em = (charEm[input.fontName] ?? charEm.Inter!)[
    input.uppercase ? "upper" : "mixed"
  ];
  const max = input.maxFontSizePx;
  const min = Math.min(INTRO_TITLE_MIN_FONT_PX, max);
  const sizes: number[] = [];
  for (let px = max; px > min; px -= 2) sizes.push(px);
  sizes.push(min);
  let fontPx = 0,
    lines = 0;
  for (const px of sizes) {
    fontPx = Math.round(px * frame.scale);
    // no menor tamanho, quantas linhas precisar
    lines = countLines(text, Math.floor(textWidth / (em * fontPx)));
    if (lines <= INTRO_TITLE_MAX_LINES) break;
  }
  const textHeight = lines * fontPx;
  const toFrame = (marginV: number) => (marginV * H) / 1920;
  const { position, marginV } = input.settings;
  let center: number;
  if (position === "center") center = H / 2;
  else if (position === "top")
    center = toFrame(marginV ?? frame.top) + textHeight / 2;
  else if (marginV !== undefined)
    center = H - toFrame(marginV) - textHeight / 2;
  else if (input.caption.position === "middle") center = H / 2;
  else if (input.caption.position === "top")
    center = input.caption.marginV + textHeight / 2;
  else center = H - input.caption.marginV - textHeight / 2;
  const half = textHeight / 2 + padding;
  center = Math.round(
    Math.min(Math.max(center, frame.top + half), H - frame.bottom - half),
  );
  return {
    fontPx,
    lines,
    padding,
    frameHeight: H,
    textWidth,
    bandTop: Math.round(center - half),
    bandBottom: Math.round(center + half),
  };
}

/** Em que ponto da abertura está um instante do vídeo. */
export function introTitlePhase(
  timeMs: number,
  settings: ResolvedIntroTitle,
  clipDurationMs?: number | null,
) {
  const end = settings.enabled
    ? Math.min(settings.durationMs, clipDurationMs ?? Infinity)
    : 0;
  const visible = timeMs < end;
  return {
    visible,
    opacity: visible
      ? Math.min(1, Math.max(0, (end - timeMs) / INTRO_TITLE_FADE_OUT_MS))
      : 0,
    captionsHidden:
      settings.hideCaptions && timeMs < end - INTRO_TITLE_CAPTION_OVERLAP_MS,
  };
}

/** Linha do tempo da prévia em laço: com a legenda escondida, ela começa depois do título. */
export function previewTimeline(
  captionMs: number,
  settings?: ResolvedIntroTitle | null,
) {
  if (!settings?.enabled) return { totalMs: captionMs, captionOffsetMs: 0 };
  return settings.hideCaptions
    ? {
        totalMs: settings.durationMs + captionMs,
        captionOffsetMs: settings.durationMs,
      }
    : {
        totalMs: Math.max(settings.durationMs, captionMs),
        captionOffsetMs: 0,
      };
}

// ---------------------------------------------------------------------------------------------------------------
// Estilos prontos: combinações de fundo, animação, efeito e destaque (só no front; o league recebe os campos).

export type IntroStyle = {
  band: IntroBand;
  animation: IntroAnimation;
  effect: IntroEffect;
  highlight: IntroHighlight;
};
const styleKeys = ["band", "animation", "effect", "highlight"] as const;

export const INTRO_TITLE_PRESETS = [
  {
    id: "classic",
    name: "Clássico",
    description: "Faixa de ponta a ponta com entrada rápida.",
    style: {
      band: "full",
      animation: "pop",
      effect: "none",
      highlight: "none",
    },
  },
  {
    id: "impact",
    name: "Impacto",
    description: "Palavra a palavra, com destaque e sombra.",
    style: {
      band: "full",
      animation: "words",
      effect: "shadow",
      highlight: "auto",
    },
  },
  {
    id: "card",
    name: "Cartão",
    description: "Caixa arredondada que desliza da esquerda.",
    style: {
      band: "rounded",
      animation: "slide",
      effect: "shadow",
      highlight: "none",
    },
  },
  {
    id: "neon",
    name: "Neon",
    description: "Só o texto, com brilho na cor de destaque.",
    style: {
      band: "none",
      animation: "fade",
      effect: "glow",
      highlight: "auto",
    },
  },
  {
    id: "typewriter",
    name: "Máquina de escrever",
    description: "Letra a letra, numa caixa atrás do texto.",
    style: {
      band: "box",
      animation: "typewriter",
      effect: "none",
      highlight: "none",
    },
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Só o texto com contorno, em fade.",
    style: {
      band: "none",
      animation: "fade",
      effect: "outline",
      highlight: "none",
    },
  },
] as const satisfies readonly {
  id: string;
  name: string;
  description: string;
  style: IntroStyle;
}[];
export type IntroPresetId = (typeof INTRO_TITLE_PRESETS)[number]["id"];

export function introPreset(id: IntroPresetId) {
  return INTRO_TITLE_PRESETS.find((preset) => preset.id === id)!;
}

/** O estilo como o vídeo o desenha (o efeito automático já resolvido). */
export function introStyleOf(settings: ResolvedIntroTitle): IntroStyle {
  return {
    band: settings.band,
    animation: settings.animation,
    effect: introTitleEffect(settings),
    highlight: settings.highlight,
  };
}

const matchingFields = (a: IntroStyle, b: IntroStyle) =>
  styleKeys.filter((key) => a[key] === b[key]).length;

/** O estilo pronto igual ao ajuste, ou `null` (= personalizado). */
export function matchIntroPreset(
  settings: ResolvedIntroTitle,
): IntroPresetId | null {
  const style = introStyleOf(settings);
  return (
    INTRO_TITLE_PRESETS.find(
      (preset) => matchingFields(preset.style, style) === styleKeys.length,
    )?.id ?? null
  );
}

/** O estilo pronto mais parecido (mais campos iguais; empate → o primeiro da galeria). */
export function closestIntroPreset(
  settings: ResolvedIntroTitle,
): IntroPresetId {
  const style = introStyleOf(settings);
  let best: IntroPresetId = INTRO_TITLE_PRESETS[0].id,
    score = -1;
  for (const preset of INTRO_TITLE_PRESETS) {
    const value = matchingFields(preset.style, style);
    if (value > score) [best, score] = [preset.id, value];
  }
  return best;
}

/** Mudança que aplica um estilo: os quatro campos explícitos (vencem o herdado); cores, duração e o resto ficam. */
export function introStylePatch(style: IntroStyle): IntroTitlePatch {
  return { ...style };
}

/**
 * Estado da galeria: o cartão marcado (um estilo pronto ou "personalizado") e a base — o último estilo escolhido
 * nesta tela ou, sem ele, o mais parecido.
 */
export function introGalleryState(
  settings: ResolvedIntroTitle,
  lastPreset?: IntroPresetId | null,
): { selected: IntroPresetId | "custom"; base: IntroPresetId } {
  const match = matchIntroPreset(settings);
  if (match) return { selected: match, base: match };
  return {
    selected: "custom",
    base: lastPreset ?? closestIntroPreset(settings),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Destaque automático na prévia: a mesma heurística do league-clips (§66, `introTitleKeywords`) — fora artigos,
// preposições, conectivos, pronomes, advérbios comuns e verbos fracos; nota = letras + 10 se é número + 2 se é nome
// próprio − 3 se é genérica − 2 se termina em "-mente". A tela avisa que a escolha é automática.

const words = (list: string) => new Set(list.split(" "));
const keywordStopwords = words(
  "o a os as um uma uns umas ao aos de do da dos das em no na nos nas num numa nuns numas dum duma duns dumas por " +
    "pelo pela pelos pelas para pra pras pro pros com sem sob sobre entre ate apos ante desde contra perante tras via " +
    "e ou mas que se porque pois como quando onde enquanto embora entao porem tambem nem logo portanto contudo " +
    "todavia assim caso conforme eu tu ele ela nos vos eles elas voce voces me te lhe lhes seu sua seus suas meu " +
    "minha meus minhas teu tua nosso nossa nossos nossas dele dela deles delas isso isto aquilo esse essa esses essas " +
    "este esta estes estas aquele aquela aqueles aquelas quem qual quais cujo cuja algo alguem tudo nada todo toda " +
    "todos todas cada outro outra outros outras mesmo mesma nao sim ja so mais menos muito muita muitos muitas pouco " +
    "bem mal ainda aqui ali la ca agora hoje depois antes tao tanto quase",
);
const keywordWeakVerbs = words(
  "e sao foi foram era eram ser sendo sido seja sejam sera esta estao estar estava estavam esteve tem ter tinha " +
    "tive teve ha havia vai vao vou ir ia fui faz fazer faca facam fez fiz feito fazendo da dar deu dou pode podem " +
    "poder posso quer querem querer sabe saber diz dizer disse fica ficar ficou vem vir veio deve devem dever precisa " +
    "precisam precisar deixa deixar ve ver vi viu",
);
const keywordCommon = words(
  "coisa coisas pessoa pessoas gente vez vezes tempo dia dias vida mundo forma parte caso jeito empresa empresas " +
    "trabalho hora horas ano anos mes meses",
);
const keywordNumbers = words(
  "dois duas tres quatro cinco seis sete oito nove dez onze doze treze catorze quatorze quinze dezesseis dezessete " +
    "dezoito dezenove vinte trinta quarenta cinquenta sessenta setenta oitenta noventa cem cento mil milhao milhoes " +
    "bilhao bilhoes dobro triplo metade",
);
const keywordUnits = words(
  "ano anos mes meses semana semanas dia dias hora horas minuto minutos segundos reais real dolares mil milhao " +
    "milhoes bilhao bilhoes vezes pessoas",
);
const normalizeWord = (core: string) =>
  core.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{M}/gu, "");

export function splitIntroWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean);
}

/**
 * Índices (em ordem) das palavras-chave destacadas: no máximo 2 e nunca o título inteiro (1 palavra: nenhuma; 2: uma);
 * um número leva junto a unidade logo depois dele («dez anos»).
 */
export function introHighlightIndices(text: string): number[] {
  const list = splitIntroWords(text);
  const max = Math.min(2, list.length - 1);
  if (max <= 0) return [];
  const mixedCase = text !== text.toLocaleUpperCase("pt-BR");
  const scored: { index: number; score: number; number: boolean }[] = [];
  list.forEach((word, index) => {
    const core = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    const norm = normalizeWord(core);
    const letters = [...core].length;
    const number = /\p{N}/u.test(core) || keywordNumbers.has(norm);
    if (
      !number &&
      (letters < 3 || keywordStopwords.has(norm) || keywordWeakVerbs.has(norm))
    )
      return;
    let score = letters + (number ? 10 : 0);
    if (mixedCase && index > 0 && /^\p{Lu}/u.test(core)) score += 2;
    if (keywordCommon.has(norm)) score -= 3;
    if (norm.endsWith("mente")) score -= 2;
    scored.push({ index, score, number });
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  const picked: number[] = [];
  for (const item of scored) {
    if (picked.length >= max) break;
    if (picked.includes(item.index)) continue;
    picked.push(item.index);
    const next = list[item.index + 1];
    const unit = next
      ? normalizeWord(next.replace(/[^\p{L}\p{N}]+$/gu, ""))
      : "";
    if (
      item.number &&
      picked.length < max &&
      keywordUnits.has(unit) &&
      !picked.includes(item.index + 1)
    )
      picked.push(item.index + 1);
  }
  return picked.sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------------------------------------------
// Animação da prévia: o quadro de cada instante, igual em todas as prévias (cartões, prévia grande e vídeo).

/** Tempos do league-clips (§66): entradas, atrasos e fades (ms). */
export const INTRO_TIMING = {
  /** Faixa e texto em fade (pop, digitando, palavra a palavra); a 1ª letra/palavra começa aqui. */
  bgFadeMs: 100,
  popMs: 150,
  slideMs: 280,
  slideTextDelayMs: 60,
  wordPopMs: 140,
  fadeInMs: 200,
  /** A legenda entra em fade depois do título. */
  captionFadeInMs: 200,
} as const;

/** Fim da digitação: ~40 % da duração, entre 600 e 1.400 ms. */
export function typewriterEndMs(durationMs: number) {
  return Math.min(1400, Math.max(600, Math.round(durationMs * 0.4)));
}
/** Fim da última palavra: ~35 % da duração. */
export function wordsEndMs(durationMs: number) {
  return Math.round(durationMs * 0.35);
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const easeOut = (value: number) => 1 - (1 - clamp01(value)) ** 3;

export type IntroFrame = {
  visible: boolean;
  /** Opacidade do conjunto (entrada em fade e saída de 250 ms). */
  opacity: number;
  /** Fundo: opacidade e deslocamento para a esquerda, em larguras do quadro (1 = fora da tela). */
  bg: { opacity: number; shift: number };
  /** Texto: o deslocamento é o absoluto (dentro da faixa/caixa, ela o recorta). */
  text: { opacity: number; scale: number; shift: number };
  /** Letras já digitadas (espaços não contam); `null` = todas. */
  chars: number | null;
  /** Cada palavra (palavra a palavra); `null` = todas inteiras. */
  words: { opacity: number; scale: number }[] | null;
  captionsHidden: boolean;
};

/**
 * Quadro da abertura no instante `timeMs`, com a semântica do vídeo (league-clips §66): pop, deslizar, digitando,
 * palavra a palavra e fade, e a saída em fade. Com `reducedMotion`, sem escala, deslocamento, digitação nem fade de
 * entrada.
 */
export function introTitleFrame(
  timeMs: number,
  settings: ResolvedIntroTitle,
  {
    text = "",
    clipDurationMs,
    reducedMotion = false,
  }: {
    text?: string;
    clipDurationMs?: number | null;
    reducedMotion?: boolean;
  } = {},
): IntroFrame {
  const phase = introTitlePhase(timeMs, settings, clipDurationMs);
  const t = Math.max(0, timeMs);
  const frame: IntroFrame = {
    visible: phase.visible,
    opacity: phase.opacity,
    bg: { opacity: 1, shift: 0 },
    text: { opacity: 1, scale: 1, shift: 0 },
    chars: null,
    words: null,
    captionsHidden: phase.captionsHidden,
  };
  // Menos movimento: o título já entra inteiro e parado (só a saída em fade continua).
  if (!phase.visible || reducedMotion) return frame;
  const end = Math.min(settings.durationMs, clipDurationMs ?? Infinity);
  const bgFade = clamp01(t / INTRO_TIMING.bgFadeMs);
  switch (settings.animation) {
    case "slide": {
      const bgShift = 1 - easeOut(t / INTRO_TIMING.slideMs);
      // Sem fundo, o próprio texto desliza; com fundo, vem 60 ms depois, recortado por ele.
      const delay =
        settings.band === "none" ? 0 : INTRO_TIMING.slideTextDelayMs;
      return {
        ...frame,
        bg: { opacity: 1, shift: bgShift },
        text: {
          opacity: 1,
          scale: 1,
          shift: 1 - easeOut((t - delay) / INTRO_TIMING.slideMs),
        },
      };
    }
    case "typewriter": {
      const total = splitIntroWords(text).join("").length;
      const start = INTRO_TIMING.bgFadeMs;
      const progress = clamp01((t - start) / (typewriterEndMs(end) - start));
      return {
        ...frame,
        bg: { opacity: bgFade, shift: 0 },
        chars: Math.min(total, Math.ceil(progress * total)),
      };
    }
    case "words": {
      const count = splitIntroWords(text).length;
      const first = INTRO_TIMING.bgFadeMs;
      const step =
        count > 1
          ? Math.max(
              0,
              (wordsEndMs(end) - INTRO_TIMING.wordPopMs - first) / (count - 1),
            )
          : 0;
      return {
        ...frame,
        bg: { opacity: bgFade, shift: 0 },
        words: Array.from({ length: count }, (_, index) => {
          const p = clamp01(
            (t - first - index * step) / INTRO_TIMING.wordPopMs,
          );
          return { opacity: p, scale: 0.8 + 0.2 * easeOut(p) };
        }),
      };
    }
    case "fade":
      return {
        ...frame,
        opacity: Math.min(frame.opacity, clamp01(t / INTRO_TIMING.fadeInMs)),
      };
    case "pop":
    default:
      return {
        ...frame,
        bg: { opacity: bgFade, shift: 0 },
        text: {
          opacity: bgFade,
          scale: 0.85 + 0.15 * easeOut(t / INTRO_TIMING.popMs),
          shift: 0,
        },
      };
  }
}

/** Instante "parado" das prévias (sem animação ou em pausa): o título já inteiro na tela. */
export function introStillTimeMs(settings: ResolvedIntroTitle) {
  return Math.min(
    Math.max(0, settings.durationMs - INTRO_TITLE_FADE_OUT_MS - 1),
    Math.max(
      600,
      settings.animation === "typewriter"
        ? typewriterEndMs(settings.durationMs) + 50
        : settings.animation === "words"
          ? wordsEndMs(settings.durationMs) + 50
          : 0,
    ),
  );
}

/** Laço da prévia grande: o título, a legenda depois dele e uma pausa curta antes de recomeçar. */
export function introStageTimeline(settings: ResolvedIntroTitle) {
  const titleMs = settings.durationMs;
  return {
    titleMs,
    totalMs: titleMs + 1600,
    captionStartMs: settings.hideCaptions
      ? titleMs - INTRO_TITLE_CAPTION_OVERLAP_MS
      : 0,
  };
}

/** Prévia em movimento só quando a pessoa não pediu menos movimento ou deu play por conta própria. */
export function introPreviewAnimates({
  reducedMotion,
  playing,
}: {
  reducedMotion: boolean;
  playing: boolean | null;
}) {
  return playing ?? !reducedMotion;
}

// ---------------------------------------------------------------------------------------------------------------
// Amostras de cor: as da identidade e do estilo de legenda, sem repetir (a automática/herdada vem à parte).

export function introPalette(
  sources: { label: string; color?: string | null }[],
  exclude: (string | null | undefined)[] = [],
  max = 6,
) {
  const seen = new Set(
    exclude.filter(Boolean).map((color) => toSixDigits(color!).toLowerCase()),
  );
  const out: { label: string; color: string }[] = [];
  for (const { label, color } of sources) {
    if (!color || !/^#(?:[0-9a-f]{3}){1,2}$/i.test(color)) continue;
    const value = toSixDigits(color).toLowerCase();
    if (seen.has(value)) continue;
    seen.add(value);
    out.push({ label, color: value });
    if (out.length >= max) break;
  }
  return out;
}

export { INTRO_TITLE_DEFAULTS, resolveIntroTitle };
