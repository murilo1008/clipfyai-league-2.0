import "server-only";
import { randomUUID } from "node:crypto";
import {
  type BrandKit,
  type Clip,
  type ErrorCode,
  type Project,
  type ProjectOptionsInput,
  optionsSchema,
  resolveIntroTitle,
  CLIP_DURATION_FLOOR_MS,
  CLIP_DURATION_CEILING_MS,
} from "./contracts";

// Acrescente &mockScenario=fewer ou &mockScenario=no-moments ao link do vídeo.
// complete-unavailable exige envio manual e simula quatro respostas 503 no complete.
type Scenario =
  | "normal"
  | "blocked"
  | "failed"
  | "partial"
  | "cancel-rejected"
  | "fewer"
  | "complete-unavailable"
  | "preview"
  | "no-moments";
export class MockClipsError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    message: string,
    public readonly details: unknown = null,
  ) {
    super(message);
  }
}
function fail(code: ErrorCode, status: number, message: string): never {
  throw new MockClipsError(code, status, message);
}
type Upload = {
  uploadId: string;
  projectId: string;
  userId: string;
  status: "PENDING" | "COMPLETED" | "ABORTED" | "EXPIRED";
  fileName: string;
  contentType: string;
  sizeBytes: number;
  partSizeBytes: number;
  partCount: number;
  expiresAt: string;
  completedAt: string | null;
  uploadedParts: { partNumber: number; etag: string; sizeBytes: number }[];
  uploadedBytes: number;
  resumedExisting: boolean;
  completeAttempts: number;
};
type MockTranscriptWord = {
  id: number;
  text: string;
  punctuatedText: string;
  startMs: number;
  endMs: number;
  confidence: number;
  edited: boolean;
  hidden?: true;
};
type Store = {
  projects: Map<string, Project>;
  uploads: Map<string, Upload>;
  clips: Map<string, Clip[]>;
  keys: Map<string, { projectId: string; payload: string; expiresAt: number }>;
  scenarios: Map<string, Scenario>;
  brandKits: Map<string, BrandKit>;
  brandSnapshots: Map<string, BrandKit["captionStyle"] | null>;
  seededUsers: Set<string>;
  exportAttempts: Map<string, number>;
  logoUploads: Map<
    string,
    {
      userId: string;
      kitId: string;
      sizeBytes: number;
      contentType: string;
      received: boolean;
      width?: number;
      height?: number;
    }
  >;
  edits: Map<
    string,
    {
      clipVersion: number;
      words: MockTranscriptWord[];
      original: MockTranscriptWord[];
    }
  >;
};
const globalMock = globalThis as typeof globalThis & { __clipsMock?: Store };
const db: Store = (globalMock.__clipsMock ??= {
  projects: new Map(),
  uploads: new Map(),
  clips: new Map(),
  keys: new Map(),
  edits: new Map(),
  scenarios: new Map(),
  brandKits: new Map(),
  brandSnapshots: new Map(),
  seededUsers: new Set(),
  exportAttempts: new Map(),
  logoUploads: new Map(),
});
// The development server can keep an older store across hot reloads.
db.exportAttempts ??= new Map();
const nowIso = () => new Date().toISOString();
export function resetMockClips() {
  db.projects.clear();
  db.uploads.clear();
  db.clips.clear();
  db.keys.clear();
  db.edits.clear();
  db.scenarios.clear();
  db.brandKits.clear();
  db.brandSnapshots.clear();
  db.seededUsers.clear();
  db.exportAttempts.clear();
  db.logoUploads.clear();
}
const plusHour = () => new Date(Date.now() + 3600000).toISOString();
function seedBrandKits(userId: string) {
  if (db.seededUsers.has(userId)) return;
  db.seededUsers.add(userId);
  const now = nowIso();
  for (const [id, name, isDefault] of [
    ["mock-studio", "Estúdio Clipfy", true],
    ["mock-minimal", "Minimalista", false],
  ] as const) {
    db.brandKits.set(userId + ":" + id, {
      id,
      userId,
      name,
      isDefault,
      version: 1,
      fontFamily: isDefault ? "Archivo Black" : "Inter",
      colors: isDefault
        ? { primary: "#111827", accent: "#2dd4bf" }
        : { primary: "#111827", accent: "#f59e0b" },
      defaultTemplateKey: isDefault ? "clean" : null,
      captionStyle: {
        textColor: "#ffffff",
        highlightColor: isDefault ? "#2dd4bf" : "#f59e0b",
      },
      titleStyle: { fontSizePx: 56, textColor: "#ffffff" },
      // O kit secundário demonstra a herança do título de abertura (caixa no topo, 2 s, cor própria).
      introTitle: isDefault
        ? null
        : {
            durationMs: 2000,
            position: "top",
            band: "box",
            bgColor: "#f59e0b",
          },
      logo: {
        key: isDefault ? "mock-logo" : null,
        url: isDefault ? "/mock/brand-logo.png" : null,
        width: isDefault ? 64 : null,
        height: isDefault ? 64 : null,
        sha256: isDefault ? "mock-sha" : null,
        position: "bottom-left",
        scale: 0.15,
        opacity: 0.9,
      },
      createdAt: now,
      updatedAt: now,
    });
  }
}
function ownKit(id: string, userId: string) {
  seedBrandKits(userId);
  const kit = db.brandKits.get(userId + ":" + id);
  if (!kit) fail("NOT_FOUND", 404, "Brand kit não encontrado.");
  return kit;
}
function pendingKit(kit: BrandKit, command: string, previous?: BrandKit) {
  kit.pending = true;
  kit.lastError = null;
  setTimeout(() => {
    if (!db.brandKits.has(kit.userId + ":" + kit.id)) return;
    kit.pending = false;
    if (kit.name === "Rejeitar depois") {
      if (previous) Object.assign(kit, previous);
      kit.pending = false;
      kit.lastError = {
        code: "VALIDATION_ERROR",
        message: "Alteração recusada pelo League.",
        source: "command.rejected",
        command,
        at: nowIso(),
      };
    }
  }, 800);
  return kit;
}
function imageDimensions(
  data: Uint8Array,
  contentType: string,
): { width: number; height: number } | null {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (
    contentType === "image/png" &&
    data.length >= 24 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => data[i] === v)
  )
    return { width: view.getUint32(16), height: view.getUint32(20) };
  if (
    contentType === "image/webp" &&
    data.length >= 30 &&
    String.fromCharCode(...data.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...data.slice(8, 12)) === "WEBP"
  ) {
    const kind = String.fromCharCode(...data.slice(12, 16));
    if (kind === "VP8X")
      return {
        width: 1 + data[24]! + (data[25]! << 8) + (data[26]! << 16),
        height: 1 + data[27]! + (data[28]! << 8) + (data[29]! << 16),
      };
    if (kind === "VP8L" && data.length >= 25)
      return {
        width: 1 + data[21]! + ((data[22]! & 63) << 8),
        height:
          1 + (data[22]! >> 6) + (data[23]! << 2) + ((data[24]! & 15) << 10),
      };
    if (kind === "VP8 " && data.length >= 30)
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
  }
  if (
    contentType === "image/jpeg" &&
    data.length > 4 &&
    data[0] === 255 &&
    data[1] === 216
  ) {
    let i = 2;
    while (i + 4 < data.length) {
      if (data[i] !== 255) {
        i++;
        continue;
      }
      const marker = data[i + 1]!,
        length = view.getUint16(i + 2);
      if (
        [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb].includes(
          marker,
        ) &&
        i + 9 < data.length
      )
        return { height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
      if (length < 2) break;
      i += 2 + length;
    }
  }
  return null;
}
export function mockLogoPut(
  key: string,
  userId: string,
  bytes: Uint8Array,
  contentType: string,
) {
  const upload = db.logoUploads.get(key);
  if (!upload || upload.userId !== userId)
    fail("NOT_FOUND", 404, "Upload de logo não encontrado.");
  if (upload.sizeBytes !== bytes.length || upload.contentType !== contentType)
    fail("VALIDATION_ERROR", 400, "Arquivo diferente do pedido.");
  const size = imageDimensions(bytes, contentType);
  if (!size)
    throw new MockClipsError("VALIDATION_ERROR", 400, "Imagem inválida.", {
      reason: "decode_failed",
    });
  if (size.width < 16 || size.height < 16)
    throw new MockClipsError("VALIDATION_ERROR", 400, "Logo pequeno.", {
      reason: "too_small_px",
    });
  if (size.width > 1024 || size.height > 1024)
    throw new MockClipsError("VALIDATION_ERROR", 400, "Logo grande.", {
      reason: "too_large_px",
    });
  upload.received = true;
  upload.width = size.width;
  upload.height = size.height;
}

function assertMockTemplate(value: string | null | undefined) {
  if (
    value !== null &&
    value !== undefined &&
    !["default", "clean"].includes(value)
  )
    fail("VALIDATION_ERROR", 400, "Template de legenda desconhecido.");
}
function sourcePlatform(url: string): Project["source"]["platform"] {
  const host = new URL(url).hostname.toLowerCase();
  const matches = (domain: string) =>
    host === domain || host.endsWith("." + domain);
  if (matches("youtube.com") || matches("youtu.be")) return "YOUTUBE";
  if (matches("twitch.tv")) return "TWITCH";
  if (matches("kick.com")) return "KICK";
  if (matches("tiktok.com")) return "TIKTOK";
  if (matches("instagram.com")) return "INSTAGRAM";
  if (matches("facebook.com") || matches("fb.watch")) return "FACEBOOK";
  if (matches("vimeo.com")) return "VIMEO";
  if (matches("drive.google.com")) return "GOOGLE_DRIVE";
  return null;
}
const stageNames = [
  "ingest",
  "transcribe",
  "analyze",
  "render-prep",
  "render",
  "finalize",
] as const;
function project(
  userId: string,
  type: "url" | "upload",
  title: string,
  options?: ProjectOptionsInput,
  url?: string,
): Project {
  const id = randomUUID(),
    now = nowIso(),
    resolvedOptions = (() => {
      seedBrandKits(userId);
      assertMockTemplate(options?.captionTemplateKey);
      const kit =
        options?.brandKitId === null
          ? null
          : options?.brandKitId
            ? (db.brandKits.get(userId + ":" + options.brandKitId) ?? null)
            : ([...db.brandKits.values()].find(
                (k) => k.userId === userId && k.isDefault,
              ) ?? null);
      if (options?.brandKitId && !kit)
        throw new MockClipsError(
          "VALIDATION_ERROR",
          400,
          "Brand kit não encontrado.",
          { brandKitId: options.brandKitId },
        );
      // O projeto guarda o título de abertura do kit com a escolha da pessoa por cima (como o estilo da legenda).
      const introTitle = { ...kit?.introTitle, ...options?.introTitle };
      return optionsSchema.parse({
        ...options,
        brandKitId: kit?.id ?? null,
        captionTemplateKey:
          options?.captionTemplateKey ?? kit?.defaultTemplateKey ?? undefined,
        introTitle: Object.keys(introTitle).length ? introTitle : undefined,
      });
    })();
  const selectedKit = resolvedOptions.brandKitId
    ? db.brandKits.get(userId + ":" + resolvedOptions.brandKitId)
    : null;
  db.brandSnapshots.set(
    id,
    selectedKit ? structuredClone(selectedKit.captionStyle) : null,
  );
  const p: Project = {
    id,
    userId,
    status: type === "upload" ? "NEEDS_UPLOAD" : "QUEUED",
    currentStage: null,
    progressPct: 0,
    source: {
      type,
      url: url ?? null,
      platform: type === "upload" ? "UPLOAD" : sourcePlatform(url!),
      title,
      durationMs: null,
    },
    options: resolvedOptions,
    counts: {
      clipsTotal: 0,
      clipsReady: 0,
      clipsFailed: 0,
    },
    error: null,
    stages: [],
    externalRef: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    expiresAt: null,
  };
  db.projects.set(id, p);
  const marker = url ? new URL(url).searchParams.get("mockScenario") : null;
  db.scenarios.set(
    id,
    marker === "blocked" ||
      marker === "failed" ||
      marker === "partial" ||
      marker === "cancel-rejected" ||
      marker === "fewer" ||
      marker === "complete-unavailable" ||
      marker === "preview" ||
      marker === "no-moments"
      ? marker
      : "normal",
  );
  return p;
}
function evolve(p: Project): Project {
  if (
    [
      "FAILED",
      "CANCELLED",
      "NEEDS_UPLOAD",
      "COMPLETED",
      "COMPLETED_WITH_ERRORS",
    ].includes(p.status)
  )
    return p;
  const elapsed = Math.max(0, Date.now() - Date.parse(p.createdAt));
  if (elapsed < 3000) return p;
  const pct = Math.min(100, Math.floor((elapsed - 3000) / 900));
  const index = Math.min(5, Math.floor(pct / 17));
  const scenario = db.scenarios.get(p.id) ?? "normal";
  p.progressPct = pct;
  p.currentStage = pct === 100 ? null : stageNames[index]!;
  p.source.durationMs = 1_800_000;
  p.status =
    pct === 100
      ? "COMPLETED"
      : index === 0
        ? "INGESTING"
        : index === 1
          ? "TRANSCRIBING"
          : index === 2
            ? "ANALYZING"
            : "RENDERING";
  p.stages = stageNames
    .slice(0, pct === 100 ? 6 : index + 1)
    .map((stage, i) => ({
      stage,
      status:
        pct === 100 || i < index
          ? ("SUCCEEDED" as const)
          : ("RUNNING" as const),
      startedAt: p.createdAt,
      finishedAt: pct === 100 || i < index ? nowIso() : null,
    }));
  p.counts.clipsTotal =
    index < 3
      ? 0
      : scenario === "fewer"
        ? Math.max(1, Math.floor(p.options.clipCount * 0.6))
        : p.options.clipCount;
  const target =
    scenario === "partial" && p.counts.clipsTotal > 1
      ? p.counts.clipsTotal - 1
      : p.counts.clipsTotal;
  p.counts.clipsReady =
    pct < 55
      ? 0
      : Math.min(target, Math.max(1, Math.ceil(((pct - 55) / 45) * target)));
  if (
    (scenario === "blocked" || scenario === "complete-unavailable") &&
    pct >= 15
  ) {
    p.status = "NEEDS_UPLOAD";
    p.progressPct = 15;
    p.currentStage = null;
    p.error = {
      code: "DOWNLOAD_BLOCKED",
      message: "A plataforma bloqueou o download. Envie o arquivo.",
    };
    p.stages = [
      {
        stage: "ingest",
        status: "FAILED",
        startedAt: p.createdAt,
        finishedAt: nowIso(),
      },
    ];
  } else if (
    (scenario === "failed" || scenario === "no-moments") &&
    pct >= 45
  ) {
    p.status = "FAILED";
    p.progressPct = 45;
    p.currentStage = null;
    p.counts.clipsTotal = 0;
    p.counts.clipsReady = 0;
    p.error =
      scenario === "no-moments"
        ? {
            code: "NO_MOMENTS_FOUND",
            message:
              "Não encontramos momentos com potencial de corte neste vídeo. Seus créditos foram devolvidos.",
          }
        : {
            code: "ANALYSIS_FAILED",
            message: "Não foi possível analisar os momentos.",
          };
    p.stages = stageNames.slice(0, 3).map((stage, i) => ({
      stage,
      status: i === 2 ? ("FAILED" as const) : ("SUCCEEDED" as const),
      startedAt: p.createdAt,
      finishedAt: nowIso(),
    }));
  } else if (pct === 100) {
    if (scenario === "partial" && p.counts.clipsTotal > 1) {
      p.status = "COMPLETED_WITH_ERRORS";
      p.counts.clipsFailed = 1;
    }
    p.completedAt = nowIso();
  }
  p.updatedAt = nowIso();
  return p;
}
function mockRenderAssets(
  rank: number,
  aspectRatio: "9:16" | "1:1",
  durationMs: number,
) {
  const thumbnail =
    aspectRatio === "9:16" ? "clip-" + (((rank - 1) % 3) + 1) : "clip-square";
  const video =
    durationMs >= 100000
      ? aspectRatio === "9:16"
        ? "clip-context"
        : "clip-context-square"
      : thumbnail;
  return {
    videoUrl: "/mock/" + video + ".mp4",
    thumbnailUrl: "/mock/" + thumbnail + ".jpg",
  };
}
function clips(p: Project): Clip[] {
  let list = db.clips.get(p.id);
  if (!list || list.length !== p.counts.clipsTotal) {
    let nextStartMs = 0;
    list = Array.from({ length: p.counts.clipsTotal }, (_, i): Clip => {
      const durationMs =
        db.scenarios.get(p.id) === "fewer" && i === 0 ? 110000 : 25000;
      const startMs = nextStartMs;
      nextStartMs += durationMs;
      return {
        id: randomUUID(),
        projectId: p.id,
        rank: i + 1,
        status: "READY",
        title: [
          "O momento que mudou tudo",
          "A dica que ninguém conta",
          "Uma ideia para começar hoje",
        ][i % 3]!,
        hookText: "Veja por que isso importa",
        description:
          "Um trecho especial gerado para mostrar os melhores momentos do vídeo.",
        hashtags: ["#Cortes", "#AIClips"],
        viralityScore: [91, 84, 76][i % 3]!,
        reason: "Gancho forte nos primeiros segundos e fala clara.",
        category: "Destaque",
        lowConfidence: false,
        startMs,
        endMs: startMs + durationMs,
        durationMs,
        layout: p.options.layout,
        captionTemplateKey: p.options.captionTemplateKey,
        captionsEnabled: p.options.captionsEnabled,
        styleOverrides: db.brandSnapshots.get(p.id) ?? null,
        introTitle: null,
        introTitleEffective: resolveIntroTitle(p.options.introTitle),
        version: 1,
        renders: p.options.aspectRatios.map((aspectRatio) => {
          const assets = mockRenderAssets(i + 1, aspectRatio, durationMs);
          const preview = i === 1 || db.scenarios.get(p.id) === "preview";
          return {
            id: randomUUID(),
            version: 1,
            aspectRatio,
            status: "READY",
            width: 360,
            height: aspectRatio === "9:16" ? 640 : 360,
            durationMs,
            ...assets,
            quality: preview ? "preview" : "full",
            exportStatus: null,
            downloadUrl: preview ? null : assets.videoUrl,
            subtitles: {
              srt: "/mock/sample.srt",
              vtt: "/mock/sample.vtt",
              ass: "/mock/sample.ass",
            },
          };
        }),
      };
    });
    db.clips.set(p.id, list);
  }
  if (p.status === "COMPLETED_WITH_ERRORS" && list.length > 1) {
    const failed = list.at(-1)!;
    failed.status = "FAILED";
    failed.renders = [];
  }
  return list.slice(0, p.counts.clipsReady + p.counts.clipsFailed);
}
function ownProject(id: string, userId: string) {
  const p = db.projects.get(id);
  if (!p || p.userId !== userId) fail("NOT_FOUND", 404, "Item não encontrado.");
  return evolve(p);
}
function ownUpload(id: string, userId: string) {
  const u = db.uploads.get(id);
  if (!u || u.userId !== userId)
    fail("NOT_FOUND", 404, "Envio não encontrado.");
  if (u.status === "PENDING" && Date.now() > Date.parse(u.expiresAt))
    u.status = "EXPIRED";
  return u;
}
export function mockUploadPart(
  id: string,
  partNumber: number,
  userId: string,
  size: number,
) {
  const u = ownUpload(id, userId);
  if (u.status !== "PENDING") fail("UPLOAD_EXPIRED", 410, "O envio expirou.");
  if (
    !Number.isInteger(partNumber) ||
    partNumber < 1 ||
    partNumber > u.partCount
  )
    fail("VALIDATION_ERROR", 400, "Número de parte inválido.");
  const expected = Math.min(
    u.partSizeBytes,
    u.sizeBytes - (partNumber - 1) * u.partSizeBytes,
  );
  if (size !== expected)
    fail("VALIDATION_ERROR", 400, "Tamanho da parte incorreto.");
  const etag = '"mock-' + id + "-" + partNumber + '"';
  u.uploadedParts = u.uploadedParts
    .filter((x) => x.partNumber !== partNumber)
    .concat({ partNumber, etag, sizeBytes: size });
  u.uploadedBytes = u.uploadedParts.reduce(
    (sum, part) => sum + part.sizeBytes,
    0,
  );
  return etag;
}
export function mockCall(
  method: string,
  path: string,
  userId: string,
  body?: any,
  headers?: Record<string, string>,
): unknown {
  const [route, search] = path.split("?");
  const q = new URLSearchParams(search);
  if (route === "/brand-kits" && method === "GET") {
    seedBrandKits(userId);
    return {
      items: [...db.brandKits.values()]
        .filter((kit) => kit.userId === userId)
        .sort((a, b) => Number(b.isDefault) - Number(a.isDefault)),
    };
  }
  if (route === "/brand-kits" && method === "POST") {
    seedBrandKits(userId);
    assertMockTemplate(body.defaultTemplateKey);
    if (
      [...db.brandKits.values()].filter((k) => k.userId === userId).length >= 10
    )
      fail("RATE_LIMITED", 429, "Limite de 10 brand kits.");
    const now = nowIso(),
      kit: BrandKit = {
        id: randomUUID(),
        userId,
        name: body.name,
        isDefault: body.isDefault ?? false,
        version: 1,
        fontFamily: body.fontFamily ?? null,
        colors: body.colors ?? null,
        defaultTemplateKey: body.defaultTemplateKey ?? null,
        captionStyle: body.captionStyle ?? {},
        titleStyle: body.titleStyle ?? null,
        introTitle: body.introTitle ?? null,
        logo: {
          key: null,
          url: null,
          width: null,
          height: null,
          sha256: null,
          position: body.logo?.position ?? "bottom-left",
          scale: body.logo?.scale ?? 0.15,
          opacity: body.logo?.opacity ?? 0.9,
        },
        createdAt: now,
        updatedAt: now,
      };
    if (kit.isDefault)
      for (const other of db.brandKits.values())
        if (other.userId === userId) other.isDefault = false;
    db.brandKits.set(userId + ":" + kit.id, kit);
    return pendingKit(kit, "brand_kit.create");
  }
  const brand =
    /^\/brand-kits\/([^/]+)(?:\/(default|logo)(?:\/(upload))?)?$/.exec(
      route ?? "",
    );
  if (brand) {
    const kit = ownKit(brand[1]!, userId);
    const action = brand[2],
      sub = brand[3];
    if (!action) {
      if (method === "GET") return kit;
      if (method === "DELETE") {
        db.brandKits.delete(userId + ":" + kit.id);
        return null;
      }
      if (method === "PATCH") {
        assertMockTemplate(body.defaultTemplateKey);
        if (Number(headers?.["If-Match"]) !== kit.version)
          throw new MockClipsError(
            "VERSION_CONFLICT",
            409,
            "Versão divergente.",
            { currentVersion: kit.version },
          );
        const previous = structuredClone(kit);
        Object.assign(kit, body);
        if (body.logo) Object.assign(kit.logo, body.logo);
        kit.version++;
        kit.updatedAt = nowIso();
        return pendingKit(kit, "brand_kit.update", previous);
      }
    }
    if (action === "default" && method === "POST") {
      for (const other of db.brandKits.values())
        if (other.userId === userId) other.isDefault = false;
      kit.isDefault = true;
      kit.version++;
      kit.updatedAt = nowIso();
      return pendingKit(kit, "brand_kit.set_default");
    }
    if (action === "logo" && sub === "upload" && method === "POST") {
      if (!["image/png", "image/webp", "image/jpeg"].includes(body.contentType))
        throw new MockClipsError("VALIDATION_ERROR", 400, "Tipo inválido.", {
          reason: body.contentType === "image/svg+xml" ? "svg" : "unknown",
        });
      if (body.sizeBytes > 2 * 1024 * 1024)
        throw new MockClipsError(
          "SOURCE_TOO_LARGE",
          413,
          "Logo maior que 2 MB.",
          { reason: "too_large_bytes" },
        );
      const uploadKey = "mock-logo-" + randomUUID();
      db.logoUploads.set(uploadKey, {
        userId,
        kitId: kit.id,
        sizeBytes: body.sizeBytes,
        contentType: body.contentType,
        received: false,
      });
      return {
        uploadKey,
        url: "/api/ai-clips/mock-logo?key=" + encodeURIComponent(uploadKey),
        method: "PUT",
        sizeBytes: body.sizeBytes,
        expiresAt: plusHour(),
        maxBytes: 2 * 1024 * 1024,
      };
    }
    if (action === "logo" && !sub) {
      if (Number(headers?.["If-Match"]) !== kit.version)
        throw new MockClipsError(
          "VERSION_CONFLICT",
          409,
          "Versão divergente.",
          { currentVersion: kit.version },
        );
      if (method === "POST") {
        const upload = db.logoUploads.get(body.uploadKey);
        if (
          !upload ||
          upload.userId !== userId ||
          upload.kitId !== kit.id ||
          !upload.received
        )
          throw new MockClipsError(
            "VALIDATION_ERROR",
            400,
            "Upload não encontrado.",
            { reason: "upload_not_found" },
          );
        kit.logo = {
          ...kit.logo,
          key: body.uploadKey,
          url: "/mock/brand-logo.png",
          width: upload.width ?? 64,
          height: upload.height ?? 64,
          sha256: "mock-sha",
        };
        db.logoUploads.delete(body.uploadKey);
      } else if (method === "DELETE")
        kit.logo = {
          ...kit.logo,
          key: null,
          url: null,
          width: null,
          height: null,
          sha256: null,
        };
      kit.version++;
      kit.updatedAt = nowIso();
      return pendingKit(kit, "brand_kit.update");
    }
  }
  if (route === "/projects" && method === "POST") {
    const token = headers?.["Idempotency-Key"];
    if (!token) fail("VALIDATION_ERROR", 400, "Idempotency-Key obrigatório.");
    const key = userId + ":" + token;
    const payload = JSON.stringify({
      source: body.source,
      options: body.options,
    });
    const previous = db.keys.get(key);
    if (previous && previous.expiresAt > Date.now()) {
      if (previous.payload !== payload)
        fail("IDEMPOTENCY_CONFLICT", 409, "Chave usada com outros dados.");
      return ownProject(previous.projectId, userId);
    }
    const active = [...db.projects.values()].filter(
      (p) =>
        p.userId === userId &&
        !["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED", "CANCELLED"].includes(
          evolve(p).status,
        ),
    );
    if (active.length >= 2)
      fail(
        "TOO_MANY_ACTIVE_PROJECTS",
        429,
        "Você já tem dois projetos ativos.",
      );
    const p = project(
      userId,
      "url",
      body.source.url,
      body.options,
      body.source.url,
    );
    db.keys.set(key, {
      projectId: p.id,
      payload,
      expiresAt: Date.now() + 24 * 3600000,
    });
    return p;
  }
  if (route === "/projects" && method === "GET") {
    const all = [...db.projects.values()]
      .filter((p) => p.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const filtered = all
      .map(evolve)
      .filter((p) => !q.get("status") || p.status === q.get("status"));
    const offset = Number(q.get("cursor") ?? 0),
      limit = Number(q.get("limit") ?? 12);
    return {
      items: filtered.slice(offset, offset + limit).map(evolve),
      nextCursor:
        offset + limit < filtered.length ? String(offset + limit) : null,
    };
  }
  if (route === "/caption-templates")
    return [
      {
        key: "default",
        name: "Destaque",
        description: "Palavras em destaque com animação pop",
        isDefault: true,
        font: { family: "Montserrat", bold: true, sizePx: 72, file: "" },
        uppercase: false,
        colors: {
          text: "#ffffff",
          highlight: "#2dd4bf",
          outline: "#000000",
          background: "#000000",
        },
        outlinePx: 3,
        shadowPx: 2,
        animation: "pop",
        position: "bottom",
        maxWordsPerPage: 4,
        maxCharsPerPage: 28,
      },
      {
        key: "clean",
        name: "Clean",
        description: "Legenda discreta",
        isDefault: false,
        font: { family: "Inter", bold: true, sizePx: 64, file: "" },
        uppercase: false,
        colors: {
          text: "#ffffff",
          highlight: "#facc15",
          outline: "#000000",
          background: "#000000",
        },
        outlinePx: 2,
        shadowPx: 1,
        animation: "color",
        position: "bottom",
        maxWordsPerPage: 5,
        maxCharsPerPage: 32,
      },
    ];
  if (route === "/credits")
    return {
      userId,
      balanceMinutes: 120,
      reservedMinutes: 0,
      tier: "FREE",
      watermark: true,
      leagueTier: null,
    };
  if (route === "/credits/ledger")
    return {
      items: [
        {
          id: "grant-" + userId,
          type: "GRANT",
          amount: 120,
          balanceAfter: 120,
          reservedAfter: 0,
          projectId: null,
          runNo: null,
          reason: "Créditos de demonstração",
          createdAt: "2026-09-01T12:00:00.000Z",
        },
      ],
      nextCursor: null,
    };
  if (route === "/uploads" && method === "POST") {
    const resumedExisting = Boolean(body.projectId);
    if (
      !resumedExisting &&
      [...db.projects.values()].filter(
        (p) =>
          p.userId === userId &&
          ![
            "COMPLETED",
            "COMPLETED_WITH_ERRORS",
            "FAILED",
            "CANCELLED",
          ].includes(evolve(p).status),
      ).length >= 2
    )
      fail(
        "TOO_MANY_ACTIVE_PROJECTS",
        429,
        "Você já tem dois projetos ativos.",
      );
    const p = resumedExisting
      ? ownProject(body.projectId, userId)
      : project(userId, "upload", body.fileName, body.options);
    if (p.status !== "NEEDS_UPLOAD")
      fail("PROJECT_NOT_READY", 409, "O projeto não está aguardando arquivo.");
    const active = [...db.uploads.values()].find(
      (upload) => upload.projectId === p.id && upload.status === "PENDING",
    );
    if (active)
      fail(
        "VALIDATION_ERROR",
        409,
        "Já existe um envio ativo para este projeto.",
      );
    const partSizeBytes = 8 * 1024 * 1024;
    const u: Upload = {
      uploadId: randomUUID(),
      projectId: p.id,
      userId,
      status: "PENDING",
      fileName: body.fileName,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
      partSizeBytes,
      partCount: Math.ceil(body.sizeBytes / partSizeBytes),
      expiresAt: plusHour(),
      completedAt: null,
      uploadedParts: [],
      uploadedBytes: 0,
      resumedExisting,
      completeAttempts: 0,
    };
    db.uploads.set(u.uploadId, u);
    return {
      uploadId: u.uploadId,
      projectId: u.projectId,
      partSizeBytes,
      partCount: u.partCount,
      expiresAt: u.expiresAt,
    };
  }
  const upload = /^\/uploads\/([^/]+)(?:\/(parts|complete))?$/.exec(
    route ?? "",
  );
  if (upload) {
    const u = ownUpload(upload[1]!, userId);
    if (method === "GET" && !upload[2]) {
      const {
        completedAt: _completedAt,
        resumedExisting: _resumedExisting,
        completeAttempts: _completeAttempts,
        ...state
      } = u;
      return { ...state, projectId: u.resumedExisting ? u.projectId : null };
    }
    if (method === "DELETE" && !upload[2]) {
      if (u.status !== "PENDING")
        fail("UPLOAD_EXPIRED", 410, "Envio indisponível.");
      u.status = "ABORTED";
      if (!u.resumedExisting) db.projects.delete(u.projectId);
      return null;
    }
    if (method === "POST" && upload[2] === "parts") {
      if (u.status !== "PENDING")
        fail("UPLOAD_EXPIRED", 410, "O envio expirou.");
      if (
        body.partNumbers.some(
          (n: number) => !Number.isInteger(n) || n < 1 || n > u.partCount,
        )
      )
        fail("VALIDATION_ERROR", 400, "Número de parte inválido.");
      return {
        parts: body.partNumbers.map((partNumber: number) => ({
          partNumber,
          url:
            "/api/ai-clips/mock-upload?uploadId=" +
            u.uploadId +
            "&partNumber=" +
            partNumber,
        })),
      };
    }
    if (method === "POST" && upload[2] === "complete") {
      if (u.status !== "PENDING" && u.status !== "COMPLETED")
        fail("UPLOAD_EXPIRED", 410, "O envio expirou.");
      const submitted = body.parts as { partNumber: number; etag: string }[];
      if (
        submitted.length !== u.partCount ||
        u.uploadedParts.length !== u.partCount ||
        new Set(submitted.map((part) => part.partNumber)).size !==
          u.partCount ||
        submitted.some(
          (part) =>
            u.uploadedParts.find(
              (saved) => saved.partNumber === part.partNumber,
            )?.etag !== part.etag,
        )
      )
        fail(
          "UPLOAD_INCOMPLETE",
          409,
          "Há partes pendentes ou ETags incorretos.",
        );
      u.status = "COMPLETED";
      u.completedAt ??= nowIso();
      const p = ownProject(u.projectId, userId);
      if (p.status !== "NEEDS_UPLOAD") return p;
      if (
        db.scenarios.get(p.id) === "complete-unavailable" &&
        u.completeAttempts++ < 4
      )
        fail("INTERNAL", 503, "A fila está temporariamente indisponível.");
      p.status = "QUEUED";
      p.currentStage = null;
      p.progressPct = 0;
      p.error = null;
      p.stages = [];
      p.counts.clipsTotal = 0;
      p.counts.clipsReady = 0;
      p.counts.clipsFailed = 0;
      p.source = {
        type: "upload",
        url: null,
        platform: "UPLOAD",
        title: u.fileName,
        durationMs: null,
      };
      p.createdAt = nowIso();
      p.updatedAt = p.createdAt;
      p.completedAt = null;
      db.scenarios.set(p.id, "normal");
      return p;
    }
  }
  const pm = /^\/projects\/([^/]+)(?:\/(cancel|clips))?$/.exec(route ?? "");
  if (pm) {
    const p = ownProject(pm[1]!, userId);
    if (pm[2] === "clips") return clips(p);
    if (pm[2] === "cancel") {
      const before = structuredClone(p);
      p.status = "CANCELLED";
      p.currentStage = null;
      p.updatedAt = nowIso();
      p.lastError = null;
      if (db.scenarios.get(p.id) === "cancel-rejected")
        setTimeout(() => {
          Object.assign(p, before);
          p.lastError = {
            code: "PROJECT_NOT_READY",
            message: "Cancelamento recusado pelo League.",
            source: "command.rejected",
            command: "project.cancel",
            at: nowIso(),
          };
        }, 800);
      return p;
    }
    if (method === "DELETE") {
      db.projects.delete(p.id);
      db.clips.delete(p.id);
      db.brandSnapshots.delete(p.id);
      db.scenarios.delete(p.id);
      return null;
    }
    return p;
  }
  const cm = /^\/clips\/([^/]+)(?:\/(transcript|render|export))?$/.exec(
    route ?? "",
  );
  if (cm) {
    const p = [...db.projects.values()].find(
      (x) =>
        x.userId === userId && db.clips.get(x.id)?.some((c) => c.id === cm[1]),
    );
    if (!p) fail("NOT_FOUND", 404, "Clipe não encontrado.");
    const c = db.clips.get(p.id)!.find((x) => x.id === cm[1])!;
    if (cm[2] === "transcript") {
      let words = db.edits.get(c.id)?.words;
      if (!words) {
        words = Array.from({ length: 12 }, (_, i) => ({
          id: i + 1,
          text: [
            "Este",
            "é",
            "um",
            "momento",
            "especial",
            "do",
            "vídeo",
            "que",
            "vale",
            "a",
            "pena",
            "ver",
          ][i]!,
          punctuatedText: [
            "Este",
            "é",
            "um",
            "momento",
            "especial",
            "do",
            "vídeo",
            "que",
            "vale",
            "a",
            "pena",
            "ver.",
          ][i]!,
          startMs: c.startMs + i * 1200,
          endMs: c.startMs + i * 1200 + 900,
          confidence: 0.96,
          edited: false,
        }));
        db.edits.set(c.id, {
          words,
          original: structuredClone(words),
          clipVersion: c.version,
        });
      }
      return {
        clipId: c.id,
        transcriptId: "mock-" + c.id,
        language: "pt",
        startMs: c.startMs,
        endMs: c.endMs,
        clipVersion: db.edits.get(c.id)!.clipVersion,
        words,
      };
    }
    if (cm[2] === "export" && method === "POST") {
      if (p.status !== "COMPLETED" && p.status !== "COMPLETED_WITH_ERRORS")
        fail("PROJECT_NOT_READY", 409, "O projeto ainda não terminou.");
      const current = {
        renders: structuredClone(c.renders),
        clipVersion: c.version,
      };
      const clipVersion = c.version;
      const ratios: ("9:16" | "1:1")[] =
        body.aspectRatios ?? p.options.aspectRatios;
      c.lastError = null;
      setTimeout(() => {
        const selected = ratios.map((ratio) =>
          c.renders.find(
            (r) =>
              r.aspectRatio === ratio &&
              r.version === clipVersion &&
              r.status === "READY",
          ),
        );
        const reject = (code: ErrorCode) => {
          c.lastError = {
            code,
            message: "Exportação recusada.",
            source: "command.rejected",
            command: "clip.export",
            at: nowIso(),
          };
        };
        if (c.version !== clipVersion || selected.some((r) => !r)) {
          reject("VALIDATION_ERROR");
          return;
        }
        const attempts = (db.exportAttempts.get(c.id) ?? 0) + 1;
        db.exportAttempts.set(c.id, attempts);
        const active = [...db.clips.values()]
          .flat()
          .filter(
            (clip) =>
              db.projects.get(clip.projectId)?.userId === userId &&
              clip.id !== c.id &&
              clip.renders.some(
                (r) =>
                  r.exportStatus === "QUEUED" || r.exportStatus === "RENDERING",
              ),
          );
        if (
          active.length >= 2 ||
          (c.title === "Recusa export" && attempts === 1)
        ) {
          reject("RATE_LIMITED");
          return;
        }
        for (const render of selected) {
          if (
            !render ||
            render.downloadUrl ||
            render.quality === "full" ||
            render.exportStatus === "QUEUED" ||
            render.exportStatus === "RENDERING"
          )
            continue;
          render.exportStatus = "QUEUED";
          setTimeout(() => {
            if (render.exportStatus === "QUEUED")
              render.exportStatus = "RENDERING";
          }, 1500);
          setTimeout(() => {
            if (
              c.version !== clipVersion ||
              render.exportStatus === "CANCELLED"
            ) {
              render.exportStatus = "CANCELLED";
              return;
            }
            if (c.title === "Falha export" && attempts === 1) {
              render.exportStatus = "FAILED";
              return;
            }
            render.exportStatus = "READY";
            render.downloadUrl = render.videoUrl;
            c.lastError = null;
          }, 20_000);
        }
      }, 800);
      return current;
    }
    if (cm[2] === "render") {
      if (p.status !== "COMPLETED" && p.status !== "COMPLETED_WITH_ERRORS")
        fail("PROJECT_NOT_READY", 409, "O projeto ainda não terminou.");
      const current = {
        renders: structuredClone(c.renders),
        clipVersion: c.version,
      };
      c.lastError = null;
      if (c.title === "Recusa render") {
        setTimeout(() => {
          c.lastError = {
            code: "RATE_LIMITED",
            message: "Muitos renders ativos. Tente novamente em instantes.",
            source: "clip.render_rejected",
            command: "clip.render",
            at: nowIso(),
          };
        }, 800);
        return current;
      }
      const ratios: ("9:16" | "1:1")[] =
        body.aspectRatios ?? p.options.aspectRatios;
      setTimeout(() => {
        const renders: Clip["renders"] = ratios.map((aspectRatio) => ({
          id: randomUUID(),
          version: c.version,
          aspectRatio,
          status: "RENDERING",
          width: null,
          height: null,
          durationMs: null,
          videoUrl: null,
          quality: c.renders.some((r) => r.quality === "preview")
            ? "preview"
            : "full",
          exportStatus: null,
          downloadUrl: null,
          thumbnailUrl: null,
          subtitles: null,
        }));
        c.renders.unshift(...renders);
        c.status = "RENDERING";
        setTimeout(() => {
          for (const old of c.renders)
            if (!renders.includes(old) && old.status === "READY")
              old.status = "SUPERSEDED";
          for (const next of renders) {
            next.status = "READY";
            next.width = 360;
            next.height = next.aspectRatio === "9:16" ? 640 : 360;
            next.durationMs = c.durationMs;
            Object.assign(
              next,
              mockRenderAssets(c.rank, next.aspectRatio, c.durationMs),
            );
            next.downloadUrl = next.quality === "full" ? next.videoUrl : null;
            next.subtitles = {
              srt: "/mock/sample.srt",
              vtt: "/mock/sample.vtt",
              ass: "/mock/sample.ass",
            };
          }
          c.status = "READY";
        }, 5000);
      }, 800);
      return current;
    }
    if (method === "PATCH") {
      if (p.status !== "COMPLETED" && p.status !== "COMPLETED_WITH_ERRORS")
        fail("PROJECT_NOT_READY", 409, "O projeto ainda não terminou.");
      if (Number(headers?.["If-Match"]) !== c.version)
        fail("VERSION_CONFLICT", 409, "O clipe mudou em outra sessão.");
      const startMs = body.startMs ?? c.startMs,
        endMs = body.endMs ?? c.endMs;
      if (
        endMs - startMs < CLIP_DURATION_FLOOR_MS ||
        endMs - startMs > CLIP_DURATION_CEILING_MS
      )
        fail(
          "VALIDATION_ERROR",
          400,
          "A duração deve ficar entre 15 e 180 segundos.",
        );
      const before = structuredClone(c);
      if (!db.edits.has(c.id))
        mockCall("GET", "/clips/" + c.id + "/transcript", userId);
      const originalEntry = structuredClone(db.edits.get(c.id)!);
      const { captionWords, ...changes } = body;
      Object.assign(c, changes);
      c.introTitleEffective = resolveIntroTitle(
        p.options.introTitle,
        c.introTitle,
      );
      c.lastError = null;
      c.durationMs = c.endMs - c.startMs;
      c.version++;
      const newVersion = c.version;
      const rejectEdit = c.title === "Recusa edição";
      setTimeout(() => {
        if (rejectEdit) {
          Object.assign(c, before);
          db.edits.set(c.id, originalEntry);
          c.lastError = {
            code: "VALIDATION_ERROR",
            message: "Edição recusada pelo League.",
            source: "clip.update_rejected",
            command: "clip.update",
            at: nowIso(),
          };
          return;
        }
        for (const render of c.renders) {
          if (
            render.exportStatus === "QUEUED" ||
            render.exportStatus === "RENDERING"
          ) {
            render.exportStatus = "CANCELLED";
            render.downloadUrl = null;
          }
        }
        const entry = db.edits.get(c.id)!;
        if (
          captionWords === null ||
          (Array.isArray(captionWords) && captionWords.length === 0)
        )
          entry.words = structuredClone(entry.original);
        else if (Array.isArray(captionWords)) {
          for (const patch of captionWords as {
            id: number;
            punctuatedText?: string | null;
            hidden?: boolean;
          }[]) {
            const target = entry.words.find((word) => word.id === patch.id);
            const original = entry.original.find(
              (word) => word.id === patch.id,
            );
            if (!target || !original) continue;
            if (patch.punctuatedText === null) {
              target.punctuatedText = original.punctuatedText;
              target.text = original.text;
            } else if (patch.punctuatedText !== undefined) {
              target.punctuatedText = patch.punctuatedText.trim();
              target.text = target.punctuatedText.replace(
                /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,
                "",
              );
            }
            if (patch.hidden === true) target.hidden = true;
            else if (patch.hidden === false) delete target.hidden;
            target.edited =
              target.punctuatedText !== original.punctuatedText ||
              !!target.hidden;
          }
        }
        entry.clipVersion = newVersion;
      }, 800);
      return c;
    }
    return c;
  }
  fail("NOT_FOUND", 404, "Rota mock não encontrada.");
}
