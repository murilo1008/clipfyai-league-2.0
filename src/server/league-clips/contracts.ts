import { z } from "zod";

export const statuses = [
  "QUEUED",
  "INGESTING",
  "NEEDS_UPLOAD",
  "TRANSCRIBING",
  "ANALYZING",
  "RENDERING",
  "COMPLETED",
  "COMPLETED_WITH_ERRORS",
  "FAILED",
  "CANCELLED",
] as const;
export const stages = [
  "ingest",
  "transcribe",
  "analyze",
  "render-prep",
  "render",
  "finalize",
] as const;
export const layouts = [
  "AUTO",
  "FACE_TRACK",
  "SPLIT",
  "BLUR",
  "CENTER",
] as const;
export const aspects = ["9:16", "1:1"] as const;
export const errorCodes = [
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "FORBIDDEN",
  "UNAUTHORIZED",
  "RATE_LIMITED",
  "VERSION_CONFLICT",
  "IDEMPOTENCY_CONFLICT",
  "PROJECT_NOT_READY",
  "TOO_MANY_ACTIVE_PROJECTS",
  "INSUFFICIENT_CREDITS",
  "INVALID_URL",
  "UNSUPPORTED_PLATFORM",
  "SSRF_BLOCKED",
  "UPLOAD_EXPIRED",
  "UPLOAD_INCOMPLETE",
  "SOURCE_TOO_LONG",
  "SOURCE_TOO_SHORT",
  "SOURCE_TOO_LARGE",
  "DOWNLOAD_BLOCKED",
  "DOWNLOAD_FAILED",
  "PROBE_FAILED",
  "NO_AUDIO",
  "TRANSCRIPTION_FAILED",
  "TRANSCRIPTION_EMPTY",
  "LANGUAGE_MISMATCH",
  "ANALYSIS_FAILED",
  "NO_MOMENTS_FOUND",
  "LLM_COST_LIMIT",
  "VISION_FAILED",
  "RENDER_FAILED",
  "QA_FAILED",
  "STORAGE_ERROR",
  "CANCELLED",
  "TIMEOUT",
  "INTERNAL",
] as const;
export const errorCodeSchema = z.enum(errorCodes);
export type ErrorCode = z.infer<typeof errorCodeSchema>;
export const CLIP_DURATION_FLOOR_MS = 15_000;
export const CLIP_DURATION_CEILING_MS = 180_000;

// Título de abertura: o título do corte numa faixa nos primeiros segundos do vídeo.
export const fontNames = ["Archivo Black", "Inter", "Montserrat"] as const;
export const introTitlePositions = ["caption", "top", "center"] as const;
export const introTitleBands = ["full", "box", "rounded", "none"] as const;
export const introTitleAnimations = [
  "pop",
  "slide",
  "typewriter",
  "words",
  "fade",
] as const;
export const introTitleEffects = ["none", "shadow", "outline", "glow"] as const;
export const introTitleHighlights = ["none", "auto"] as const;
export const INTRO_TITLE_LIMITS = {
  durationMs: { min: 1000, max: 8000 },
  marginV: { min: 0, max: 1800 },
  maxFontSizePx: { min: 40, max: 120 },
} as const;
const introDurationMessage =
  "A duração do título de abertura deve ficar entre 1 e 8 segundos.";
const introMarginMessage =
  "A margem do título de abertura deve ficar entre 0 e 1800 px.";
const introFontSizeMessage =
  "O tamanho máximo do título de abertura deve ficar entre 40 e 120 px.";
const introColorMessage = "Use uma cor no formato #RRGGBB.";
const introColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, introColorMessage);
const introTitleFields = {
  enabled: z.boolean(),
  durationMs: z
    .number({ invalid_type_error: introDurationMessage })
    .int(introDurationMessage)
    .min(INTRO_TITLE_LIMITS.durationMs.min, introDurationMessage)
    .max(INTRO_TITLE_LIMITS.durationMs.max, introDurationMessage),
  position: z.enum(introTitlePositions),
  marginV: z
    .number({ invalid_type_error: introMarginMessage })
    .int(introMarginMessage)
    .min(INTRO_TITLE_LIMITS.marginV.min, introMarginMessage)
    .max(INTRO_TITLE_LIMITS.marginV.max, introMarginMessage),
  band: z.enum(introTitleBands),
  bgColor: introColorSchema,
  textColor: introColorSchema,
  fontName: z.enum(fontNames),
  maxFontSizePx: z
    .number({ invalid_type_error: introFontSizeMessage })
    .int(introFontSizeMessage)
    .min(INTRO_TITLE_LIMITS.maxFontSizePx.min, introFontSizeMessage)
    .max(INTRO_TITLE_LIMITS.maxFontSizePx.max, introFontSizeMessage),
  uppercase: z.boolean(),
  hideCaptions: z.boolean(),
  /** Entrada do título (padrão `pop`). */
  animation: z.enum(introTitleAnimations),
  /** Efeito no texto; ausente = nenhum, ou contorno automático quando `band` é `none`. */
  effect: z.enum(introTitleEffects),
  /** `auto`: 1–2 palavras-chave na cor de destaque, escolhidas pelo servidor (padrão `none`). */
  highlight: z.enum(introTitleHighlights),
};
/** Entrada (criar projeto, editar corte, brand kit): estrita, com as faixas do contrato. */
export const introTitleSettingsSchema = z
  .object(introTitleFields)
  .partial()
  .strict();
export type IntroTitleSettings = z.infer<typeof introTitleSettingsSchema>;
const lenient = <T extends z.ZodTypeAny>(schema: T) =>
  schema.optional().catch(undefined);
/**
 * Leitura: tolerante. Campo ausente, nulo ou fora do contrato vira "padrão" em vez de derrubar a tela
 * (o league pode ainda não ter subido o recurso ou trazer campos novos).
 */
export const introTitleReadSchema = z.object({
  enabled: lenient(introTitleFields.enabled),
  durationMs: lenient(introTitleFields.durationMs),
  position: lenient(introTitleFields.position),
  marginV: lenient(introTitleFields.marginV),
  band: lenient(introTitleFields.band),
  bgColor: lenient(introTitleFields.bgColor),
  textColor: lenient(introTitleFields.textColor),
  fontName: lenient(introTitleFields.fontName),
  maxFontSizePx: lenient(introTitleFields.maxFontSizePx),
  uppercase: lenient(introTitleFields.uppercase),
  hideCaptions: lenient(introTitleFields.hideCaptions),
  animation: lenient(introTitleFields.animation),
  effect: lenient(introTitleFields.effect),
  highlight: lenient(introTitleFields.highlight),
});
const introTitleReadField = introTitleReadSchema.nullish().catch(null);
/**
 * Padrões do servidor quando nada é definido (cores ausentes = automáticas pelo template de legenda). O `effect` fica
 * de fora: ausente, ele depende do fundo (`none` → contorno automático; ver `introTitleEffect`).
 */
export const INTRO_TITLE_DEFAULTS = {
  enabled: true,
  durationMs: 3000,
  position: "caption",
  band: "full",
  hideCaptions: true,
  animation: "pop",
  highlight: "none",
} as const satisfies IntroTitleSettings;
export type ResolvedIntroTitle = Omit<
  IntroTitleSettings,
  keyof typeof INTRO_TITLE_DEFAULTS
> &
  Required<Pick<IntroTitleSettings, keyof typeof INTRO_TITLE_DEFAULTS>>;
/** Junta as camadas (padrão do servidor ← brand kit ← projeto ← corte); campo ausente herda o anterior. */
export function resolveIntroTitle(
  ...layers: (IntroTitleSettings | null | undefined)[]
): ResolvedIntroTitle {
  const resolved: ResolvedIntroTitle = { ...INTRO_TITLE_DEFAULTS };
  for (const layer of layers)
    for (const [key, value] of Object.entries(layer ?? {}))
      if (value !== undefined && value !== null)
        Object.assign(resolved, { [key]: value });
  return resolved;
}
const durationGapMessage =
  'O campo "até" deve ser pelo menos 10 segundos maior que o campo "de".';
const optionsBaseSchema = z.object({
  language: z.enum(["pt", "en", "es", "auto"]).default("pt"),
  clipCount: z.number().int().min(1).max(30).default(10),
  minDurationMs: z
    .number({ invalid_type_error: 'Informe o campo "de" em segundos.' })
    .int('Informe uma duração válida em segundos no campo "de".')
    .min(
      CLIP_DURATION_FLOOR_MS,
      'O campo "de" deve ficar entre 15 e 60 segundos.',
    )
    .max(60000, 'O campo "de" deve ficar entre 15 e 60 segundos.')
    .default(20000),
  maxDurationMs: z
    .number({ invalid_type_error: 'Informe o campo "até" em segundos.' })
    .int('Informe uma duração válida em segundos no campo "até".')
    .min(30000, 'O campo "até" deve ficar entre 30 e 180 segundos.')
    .max(
      CLIP_DURATION_CEILING_MS,
      'O campo "até" deve ficar entre 30 e 180 segundos.',
    )
    .default(90000),
  captionTemplateKey: z.string().min(1).max(64).default("default"),
  captionsEnabled: z.boolean().default(true),
  aspectRatios: z
    .array(z.enum(aspects))
    .min(1)
    .max(2)
    .refine((v) => new Set(v).size === v.length, "Formatos repetidos")
    .default(["9:16"]),
  keyterms: z.array(z.string().min(1).max(50)).max(100).default([]),
  layout: z.enum(layouts).default("AUTO"),
  brandKitId: z.string().min(1).max(64).nullable().optional(),
  introTitle: introTitleSettingsSchema.optional(),
});
export const optionsSchema = optionsBaseSchema.refine(
  (v) => v.maxDurationMs >= v.minDurationMs + 10000,
  {
    path: ["maxDurationMs"],
    message: durationGapMessage,
  },
);
export type ProjectOptions = z.infer<typeof optionsSchema>;
export const optionsInputSchema = optionsBaseSchema
  .partial()
  .refine(
    (v) => (v.maxDurationMs ?? 90000) >= (v.minDurationMs ?? 20000) + 10000,
    {
      path: ["maxDurationMs"],
      message: durationGapMessage,
    },
  );
export type ProjectOptionsInput = z.infer<typeof optionsInputSchema>;
/** Opções lidas do league: o `introTitle` é tolerante (ausente ou fora do contrato = padrão). */
const optionsReadSchema = optionsBaseSchema
  .extend({
    introTitle: introTitleReadField.transform((value) => value ?? undefined),
  })
  .refine((v) => v.maxDurationMs >= v.minDurationMs + 10000, {
    path: ["maxDurationMs"],
    message: durationGapMessage,
  });
export const lastErrorSchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
  source: z.enum([
    "clip.update_rejected",
    "clip.render_rejected",
    "command.rejected",
  ]),
  command: z.string().nullable(),
  at: z.string(),
});
export const projectSchema = z.object({
  id: z.string(),
  userId: z.string(),
  status: z.enum(statuses),
  lastError: lastErrorSchema.nullable().optional(),
  currentStage: z.enum(stages).nullable(),
  progressPct: z.number().int().min(0).max(100),
  source: z.object({
    type: z.enum(["url", "upload"]),
    url: z.string().nullable(),
    platform: z
      .enum([
        "YOUTUBE",
        "TWITCH",
        "KICK",
        "TIKTOK",
        "INSTAGRAM",
        "FACEBOOK",
        "VIMEO",
        "GOOGLE_DRIVE",
        "UPLOAD",
        "OTHER",
      ])
      .nullable(),
    title: z.string().nullable(),
    durationMs: z.number().int().nullable(),
    thumbnailUrl: z.string().nullable().optional(),
  }),
  options: optionsReadSchema,
  counts: z.object({
    clipsTotal: z.number().int(),
    clipsReady: z.number().int(),
    clipsFailed: z.number().int(),
  }),
  error: z.object({ code: errorCodeSchema, message: z.string() }).nullable(),
  stages: z.array(
    z.object({
      stage: z.enum(stages),
      status: z.enum([
        "RUNNING",
        "SUCCEEDED",
        "FAILED",
        "CANCELLED",
        "DELAYED",
      ]),
      startedAt: z.string().nullable(),
      finishedAt: z.string().nullable(),
    }),
  ),
  externalRef: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
});
export type Project = z.infer<typeof projectSchema>;
export const renderSchema = z
  .object({
    id: z.string(),
    version: z.number().int(),
    aspectRatio: z.enum(aspects),
    status: z.enum([
      "QUEUED",
      "RENDERING",
      "READY",
      "FAILED",
      "CANCELLED",
      "SUPERSEDED",
    ]),
    width: z.number().int().nullable(),
    height: z.number().int().nullable(),
    durationMs: z.number().int().nullable(),
    videoUrl: z.string().nullable(),
    quality: z.enum(["preview", "full"]).optional(),
    exportStatus: z
      .enum(["QUEUED", "RENDERING", "READY", "FAILED", "CANCELLED"])
      .nullable()
      .optional(),
    downloadUrl: z.string().nullable().optional(),
    thumbnailUrl: z.string().nullable(),
    subtitles: z
      .object({ srt: z.string(), vtt: z.string(), ass: z.string() })
      .nullable(),
  })
  .transform((render) => ({
    ...render,
    quality: render.quality ?? "full",
    exportStatus: render.exportStatus ?? null,
    downloadUrl:
      render.downloadUrl === undefined && render.quality !== "preview"
        ? render.videoUrl
        : (render.downloadUrl ?? null),
  }));
export const clipSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  lastError: lastErrorSchema.nullable().optional(),
  rank: z.number().int(),
  status: z.enum(["PENDING", "RENDERING", "READY", "FAILED", "CANCELLED"]),
  title: z.string(),
  hookText: z.string().nullable(),
  description: z.string().nullable(),
  hashtags: z.array(z.string()),
  viralityScore: z.number().min(0).max(100).nullable(),
  reason: z.string().nullable(),
  category: z.string().nullable(),
  lowConfidence: z.boolean(),
  startMs: z.number().int(),
  endMs: z.number().int(),
  durationMs: z.number().int(),
  layout: z.enum(layouts),
  captionTemplateKey: z.string(),
  captionsEnabled: z.boolean(),
  styleOverrides: z.record(z.unknown()).nullable(),
  /** Ajuste do título de abertura só deste corte (null = segue o projeto). */
  introTitle: introTitleReadField,
  /** O que o vídeo usa (padrão ← brand kit ← projeto ← corte); ausente = league sem o recurso. */
  introTitleEffective: introTitleReadField,
  version: z.number().int(),
  renders: z.array(renderSchema),
});
export type Clip = z.infer<typeof clipSchema>;
export const transcriptSchema = z.object({
  clipId: z.string(),
  transcriptId: z.string(),
  language: z.string().nullable(),
  startMs: z.number().int(),
  endMs: z.number().int(),
  clipVersion: z.number().int().nullable(),
  words: z.array(
    z.object({
      id: z.number().int(),
      text: z.string(),
      punctuatedText: z.string(),
      edited: z.boolean(),
      hidden: z.literal(true).optional(),
      startMs: z.number().int(),
      endMs: z.number().int(),
      confidence: z.number(),
      speaker: z.string().optional(),
    }),
  ),
});
export const templateSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  isDefault: z.boolean(),
  font: z.object({
    family: z.string(),
    bold: z.boolean(),
    sizePx: z.number(),
    file: z.string(),
  }),
  uppercase: z.boolean(),
  colors: z.object({
    text: z.string(),
    highlight: z.string(),
    outline: z.string(),
    background: z.string(),
  }),
  outlinePx: z.number(),
  shadowPx: z.number(),
  animation: z.enum(["none", "color", "pop", "karaoke"]),
  position: z.enum(["bottom", "middle", "top"]),
  maxWordsPerPage: z.number().int(),
  maxCharsPerPage: z.number().int(),
});
export const creditsSchema = z.object({
  userId: z.string(),
  balanceMinutes: z.number().int(),
  reservedMinutes: z.number().int(),
  tier: z.enum(["FREE", "STARTER", "PRO", "BUSINESS"]),
  watermark: z.boolean(),
  leagueTier: z.string().nullable(),
});
export const ledgerEntrySchema = z.object({
  id: z.string(),
  type: z.enum(["GRANT", "RESERVE", "CONSUME", "RELEASE", "REFUND", "EXPIRE"]),
  amount: z.number().int(),
  balanceAfter: z.number().int(),
  reservedAfter: z.number().int(),
  projectId: z.string().nullable(),
  runNo: z.number().int().nullable(),
  reason: z.string().nullable(),
  createdAt: z.string(),
});
export const uploadCreatedSchema = z.object({
  uploadId: z.string(),
  projectId: z.string(),
  partSizeBytes: z.number().int().positive(),
  partCount: z.number().int().positive(),
  expiresAt: z.string(),
});
export const uploadStateSchema = z.object({
  uploadId: z.string(),
  projectId: z.string().nullable(),
  status: z.enum(["PENDING", "COMPLETED", "ABORTED", "EXPIRED"]),
  fileName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int(),
  partSizeBytes: z.number().int().positive(),
  partCount: z.number().int().positive(),
  expiresAt: z.string(),
  completedAt: z.string().nullable().optional(),
  uploadedParts: z.array(
    z.object({
      partNumber: z.number().int(),
      etag: z.string(),
      sizeBytes: z.number().int(),
    }),
  ),
  uploadedBytes: z.number().int(),
});
export const uploadPartsSchema = z.object({
  parts: z.array(z.object({ partNumber: z.number().int(), url: z.string() })),
});
export const captionWordSchema = z
  .object({
    id: z.number().int().min(0),
    punctuatedText: z.string().trim().min(1).max(64).nullable().optional(),
    hidden: z.boolean().optional(),
  })
  .strict()
  .refine(
    (word) => word.punctuatedText !== undefined || word.hidden !== undefined,
    "Informe punctuatedText ou hidden",
  );
export const patchClipSchema = z.object({
  startMs: z.number().int().min(0).optional(),
  endMs: z.number().int().positive().optional(),
  title: z.string().min(1).max(300).optional(),
  captionWords: z.array(captionWordSchema).max(5000).nullable().optional(),
  captionTemplateKey: z.string().min(1).max(64).optional(),
  captionsEnabled: z.boolean().optional(),
  layout: z.enum(layouts).optional(),
  /** null = voltar ao padrão do projeto. */
  introTitle: introTitleSettingsSchema.nullable().optional(),
});
export const createProjectSchema = z.object({
  url: z.string().url().max(4096),
  options: optionsInputSchema.optional(),
  idempotencyKey: z.string().uuid(),
});
export const createUploadSchema = z.object({
  fileName: z.string().min(1).max(512),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(4 * 1024 ** 3),
  contentType: z.string().regex(/^video\/[a-z0-9][a-z0-9.+-]{0,63}$/),
  projectId: z.string().optional(),
  options: optionsInputSchema.optional(),
});

// Brand kit: mirrors packages/app/src/brand-kits/schemas.ts in league-clips.
const colorSchema = z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/);
export const brandColorsSchema = z
  .object({
    primary: colorSchema.optional(),
    secondary: colorSchema.optional(),
    accent: colorSchema.optional(),
  })
  .strict();
export const captionStyleSchema = z
  .object({
    fontName: z.enum(["Archivo Black", "Inter", "Montserrat"]).optional(),
    fontSizePx: z.number().int().min(24).max(160).optional(),
    bold: z.boolean().optional(),
    uppercase: z.boolean().optional(),
    textColor: colorSchema.optional(),
    highlightColor: colorSchema.optional(),
    outlineColor: colorSchema.optional(),
    outline: z.number().min(0).max(3).optional(),
    shadow: z.number().min(0).max(4).optional(),
    position: z.enum(["bottom", "middle", "top"]).optional(),
    marginV: z.number().int().min(0).max(1800).optional(),
    maxWordsPerPage: z.number().int().min(1).max(8).optional(),
    maxCharsPerPage: z.number().int().min(6).max(40).optional(),
    animation: z.enum(["none", "color", "pop", "karaoke"]).optional(),
  })
  .strict();
export const titleStyleSchema = z
  .object({
    fontName: z.enum(["Archivo Black", "Inter", "Montserrat"]).optional(),
    fontSizePx: z.number().int().min(32).max(96).optional(),
    textColor: colorSchema.optional(),
    outlineColor: colorSchema.optional(),
    uppercase: z.boolean().optional(),
  })
  .strict();
export const logoSettingsSchema = z
  .object({
    position: z
      .enum(["top-left", "top-right", "bottom-left", "bottom-right"])
      .optional(),
    scale: z.number().min(0.05).max(0.4).optional(),
    opacity: z.number().min(0.1).max(1).optional(),
  })
  .strict();
const brandFields = {
  name: z.string().trim().min(1).max(100),
  isDefault: z.boolean().optional(),
  fontFamily: z
    .enum(["Archivo Black", "Inter", "Montserrat"])
    .nullable()
    .optional(),
  colors: brandColorsSchema.nullable().optional(),
  defaultTemplateKey: z.string().min(1).max(64).nullable().optional(),
  captionStyle: captionStyleSchema.optional(),
  titleStyle: titleStyleSchema.nullable().optional(),
  introTitle: introTitleSettingsSchema.nullable().optional(),
  logo: logoSettingsSchema.optional(),
};
export const createBrandKitSchema = z.object(brandFields).strict();
export const patchBrandKitSchema = createBrandKitSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0);
export const brandKitSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  isDefault: z.boolean(),
  version: z.number().int(),
  fontFamily: z.enum(["Archivo Black", "Inter", "Montserrat"]).nullable(),
  colors: brandColorsSchema.nullable(),
  defaultTemplateKey: z.string().nullable(),
  captionStyle: captionStyleSchema,
  titleStyle: titleStyleSchema.nullable(),
  introTitle: introTitleReadField,
  logo: z.object({
    key: z.string().nullable(),
    url: z.string().nullable(),
    width: z.number().int().nullable(),
    height: z.number().int().nullable(),
    sha256: z.string().nullable(),
    position: z.enum(["top-left", "top-right", "bottom-left", "bottom-right"]),
    scale: z.number(),
    opacity: z.number(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
  pending: z.boolean().optional(),
  lastError: lastErrorSchema.nullable().optional(),
});
export type BrandKit = z.infer<typeof brandKitSchema>;
export const logoUploadSchema = z.object({
  uploadKey: z.string(),
  url: z.string(),
  method: z.literal("PUT"),
  sizeBytes: z.number().int(),
  expiresAt: z.string(),
  maxBytes: z.number().int(),
});
