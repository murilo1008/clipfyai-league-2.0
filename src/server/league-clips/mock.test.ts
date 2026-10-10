import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  brandKitSchema,
  logoUploadSchema,
  clipSchema,
  transcriptSchema,
  patchClipSchema,
  projectSchema,
  uploadStateSchema,
  uploadPartsSchema,
  creditsSchema,
  ledgerEntrySchema,
  type Clip,
} from "./contracts";

vi.mock("server-only", () => ({}));
import {
  MockClipsError,
  mockCall,
  mockUploadPart,
  mockLogoPut,
  resetMockClips,
} from "./mock";

const user = "admin-test";
const url = "https://www.youtube.com/watch?v=demo";
function create(options?: object, suffix = "") {
  return projectSchema.parse(
    mockCall(
      "POST",
      "/projects",
      user,
      { source: { type: "url", url: url + suffix }, options },
      { "Idempotency-Key": crypto.randomUUID() },
    ),
  );
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-29T12:00:00Z"));
  resetMockClips();
});
afterEach(() => {
  resetMockClips();
  vi.useRealTimers();
});

describe("mock AI Clips", () => {
  describe("exportação em 1080p", () => {
    function example(count = 1, preview = true) {
      const p = create(
        { clipCount: count, aspectRatios: ["9:16", "1:1"] },
        preview ? "&mockScenario=preview" : "",
      );
      vi.advanceTimersByTime(100_000);
      return (
        mockCall("GET", "/projects/" + p.id + "/clips", user) as unknown[]
      ).map((item) => clipSchema.parse(item));
    }
    const read = (id: string) =>
      clipSchema.parse(mockCall("GET", "/clips/" + id, user));
    it("mantém os full e inclui uma prévia de exemplo no projeto normal", () => {
      const [full, preview] = example(2, false);
      expect(
        full!.renders.every(
          (r) => r.quality === "full" && r.downloadUrl === r.videoUrl,
        ),
      ).toBe(true);
      expect(
        preview!.renders.every(
          (r) => r.quality === "preview" && r.downloadUrl === null,
        ),
      ).toBe(true);
    });
    it("202 devolve o estado atual, depois QUEUED → RENDERING → READY só no formato pedido", () => {
      const c = example()[0]!;
      const response = mockCall("POST", "/clips/" + c.id + "/export", user, {
        aspectRatios: ["9:16"],
      }) as { renders: Clip["renders"]; clipVersion: number };
      expect(response.clipVersion).toBe(c.version);
      expect(response.renders[0]!.exportStatus).toBeNull();
      vi.advanceTimersByTime(800);
      expect(read(c.id).renders[0]!.exportStatus).toBe("QUEUED");
      vi.advanceTimersByTime(1500);
      expect(read(c.id).renders[0]!.exportStatus).toBe("RENDERING");
      vi.advanceTimersByTime(18500);
      const ready = read(c.id);
      expect(ready.renders[0]).toMatchObject({
        exportStatus: "READY",
        downloadUrl: c.renders[0]!.videoUrl,
        videoUrl: c.renders[0]!.videoUrl,
        quality: "preview",
        subtitles: c.renders[0]!.subtitles,
      });
      expect(ready.renders[1]!.downloadUrl).toBeNull();
      expect(response.renders[0]!.exportStatus).toBeNull();
    });
    it("falha uma exportação e permite tentar de novo", () => {
      const c = example()[0]!;
      mockCall(
        "PATCH",
        "/clips/" + c.id,
        user,
        { title: "Falha export" },
        { "If-Match": "1" },
      );
      vi.advanceTimersByTime(800);
      mockCall("POST", "/clips/" + c.id + "/render", user, {});
      vi.advanceTimersByTime(5800);
      mockCall("POST", "/clips/" + c.id + "/export", user, {});
      vi.advanceTimersByTime(20800);
      expect(read(c.id).renders[0]!.exportStatus).toBe("FAILED");
      mockCall("POST", "/clips/" + c.id + "/export", user, {});
      vi.advanceTimersByTime(20800);
      expect(read(c.id).renders[0]!.exportStatus).toBe("READY");
    });
    it("cancela a exportação quando o corte é editado e recusa até renderizar a versão nova", () => {
      const c = example()[0]!;
      mockCall("POST", "/clips/" + c.id + "/export", user, {});
      vi.advanceTimersByTime(2300);
      mockCall(
        "PATCH",
        "/clips/" + c.id,
        user,
        { title: "Alterado" },
        { "If-Match": "1" },
      );
      vi.advanceTimersByTime(800);
      expect(read(c.id).renders[0]!.exportStatus).toBe("CANCELLED");
      mockCall("POST", "/clips/" + c.id + "/export", user, {});
      vi.advanceTimersByTime(800);
      expect(read(c.id).lastError).toMatchObject({
        command: "clip.export",
        code: "VALIDATION_ERROR",
      });
      mockCall("POST", "/clips/" + c.id + "/render", user, {});
      vi.advanceTimersByTime(800);
      mockCall("POST", "/clips/" + c.id + "/export", user, {});
      vi.advanceTimersByTime(800);
      expect(read(c.id).lastError?.code).toBe("VALIDATION_ERROR");
      vi.advanceTimersByTime(4200);
      mockCall("POST", "/clips/" + c.id + "/export", user, {});
      vi.advanceTimersByTime(20800);
      expect(read(c.id).renders[0]!.downloadUrl).toBeTruthy();
    });
    it("recusa formato sem prévia pronta depois de responder 202", () => {
      const p = create({ clipCount: 1 }, "&mockScenario=preview");
      vi.advanceTimersByTime(100000);
      const c = clipSchema.parse(
        (mockCall("GET", "/projects/" + p.id + "/clips", user) as unknown[])[0],
      );
      mockCall("POST", "/clips/" + c.id + "/export", user, {
        aspectRatios: ["1:1"],
      });
      vi.advanceTimersByTime(800);
      expect(read(c.id).lastError).toMatchObject({
        command: "clip.export",
        code: "VALIDATION_ERROR",
      });
    });
    it("limita exportações simultâneas e libera a fila após concluir", () => {
      const cuts = example(3);
      for (const c of cuts)
        mockCall("POST", "/clips/" + c.id + "/export", user, {});
      vi.advanceTimersByTime(800);
      expect(read(cuts[2]!.id).lastError).toMatchObject({
        code: "RATE_LIMITED",
        command: "clip.export",
      });
      vi.advanceTimersByTime(20000);
      mockCall("POST", "/clips/" + cuts[2]!.id + "/export", user, {});
      vi.advanceTimersByTime(20800);
      expect(read(cuts[2]!.id).renders[0]!.exportStatus).toBe("READY");
    });
    it("preserva o isolamento por usuário", () => {
      const c = example()[0]!;
      expect(() =>
        mockCall("POST", "/clips/" + c.id + "/export", "other", {}),
      ).toThrowError(MockClipsError);
    });
  });
  it("devolve DTO QUEUED, respeita clipCount e gera mídias com as proporções escolhidas", () => {
    const p = create({ clipCount: 4, aspectRatios: ["9:16", "1:1"] });
    expect(p.status).toBe("QUEUED");
    expect(p.source.durationMs).toBeNull();
    expect(p.counts.clipsTotal).toBe(0);
    vi.advanceTimersByTime(100_000);
    const done = projectSchema.parse(
      mockCall("GET", "/projects/" + p.id, user),
    );
    expect(done.status).toBe("COMPLETED");
    expect(done.counts).toEqual({
      clipsTotal: 4,
      clipsReady: 4,
      clipsFailed: 0,
    });
    const clips = (
      mockCall("GET", "/projects/" + p.id + "/clips", user) as unknown[]
    ).map((x) => clipSchema.parse(x));
    expect(clips).toHaveLength(4);
    expect(
      clips[0]?.renders.map((r) => [r.aspectRatio, r.width, r.height]),
    ).toEqual([
      ["9:16", 360, 640],
      ["1:1", 360, 360],
    ]);
    expect(clips[0]?.renders[1]?.videoUrl).toBe("/mock/clip-square.mp4");
    expect(clips.every((clip) => !clip.lowConfidence)).toBe(true);
  });
  it("seleciona 6 cortes bons de até 10, com um clipe de 110 segundos", () => {
    const p = create(
      { clipCount: 10, aspectRatios: ["9:16", "1:1"] },
      "&mockScenario=fewer",
    );
    expect(mockCall("GET", "/projects/" + p.id + "/clips", user)).toEqual([]);
    vi.advanceTimersByTime(100000);
    const done = projectSchema.parse(
      mockCall("GET", "/projects/" + p.id, user),
    );
    expect(done.status).toBe("COMPLETED");
    expect(done.options.clipCount).toBe(10);
    expect(done.counts).toEqual({
      clipsTotal: 6,
      clipsReady: 6,
      clipsFailed: 0,
    });
    const clips = (
      mockCall("GET", "/projects/" + p.id + "/clips", user) as unknown[]
    ).map((clip) => clipSchema.parse(clip));
    expect(clips).toHaveLength(6);
    expect(clips.every((clip) => !clip.lowConfidence)).toBe(true);
    expect(clips[0]?.durationMs).toBe(110000);
    expect(clips.map((clip) => clip.startMs)).toEqual([
      0, 110000, 135000, 160000, 185000, 210000,
    ]);
    expect(
      clips
        .slice(1)
        .every((clip, index) => clip.startMs >= clips[index]!.endMs),
    ).toBe(true);
    expect(clips[0]?.renders[0]).toMatchObject({
      durationMs: 110000,
      videoUrl: "/mock/clip-context.mp4",
    });
    expect(clips[0]?.renders[1]).toMatchObject({
      durationMs: 110000,
      videoUrl: "/mock/clip-context-square.mp4",
    });
    expect(
      clipSchema.parse(
        mockCall(
          "PATCH",
          "/clips/" + clips[0]!.id,
          user,
          { title: "Contexto completo" },
          { "If-Match": "1" },
        ),
      ).durationMs,
    ).toBe(110000);
  });
  it("termina sem clipes com NO_MOMENTS_FOUND", () => {
    const p = create(undefined, "&mockScenario=no-moments");
    vi.advanceTimersByTime(100000);
    const failed = projectSchema.parse(
      mockCall("GET", "/projects/" + p.id, user),
    );
    expect(failed.status).toBe("FAILED");
    expect(failed.error).toMatchObject({ code: "NO_MOMENTS_FOUND" });
    expect(failed.error?.message).toContain("Seus créditos foram devolvidos.");
    expect(failed.counts).toEqual({
      clipsTotal: 0,
      clipsReady: 0,
      clipsFailed: 0,
    });
    expect(mockCall("GET", "/projects/" + p.id + "/clips", user)).toEqual([]);
  });
  it.each([99999, 100000, 120000])(
    "escolhe o vídeo longo a partir de 100000 ms (duração: %i)",
    (durationMs) => {
      const p = create({ clipCount: 1, aspectRatios: ["9:16", "1:1"] });
      vi.advanceTimersByTime(100000);
      const clip = clipSchema.parse(
        (mockCall("GET", "/projects/" + p.id + "/clips", user) as unknown[])[0],
      );
      mockCall(
        "PATCH",
        "/clips/" + clip.id,
        user,
        { startMs: 0, endMs: durationMs },
        { "If-Match": "1" },
      );
      mockCall("POST", "/clips/" + clip.id + "/render", user, {
        aspectRatios: ["9:16", "1:1"],
      });
      vi.advanceTimersByTime(6000);
      const updated = clipSchema.parse(
        mockCall("GET", "/clips/" + clip.id, user),
      );
      expect(
        updated.renders
          .filter((render) => render.status === "READY")
          .map((render) => render.videoUrl),
      ).toEqual(
        durationMs >= 100000
          ? ["/mock/clip-context.mp4", "/mock/clip-context-square.mp4"]
          : ["/mock/clip-1.mp4", "/mock/clip-square.mp4"],
      );
    },
  );
  it.each([15000, 180000])(
    "aceita edição com %i ms fora da duração ideal",
    (durationMs) => {
      const p = create({ minDurationMs: 60000, maxDurationMs: 90000 });
      vi.advanceTimersByTime(100000);
      const clip = clipSchema.parse(
        (mockCall("GET", "/projects/" + p.id + "/clips", user) as unknown[])[0],
      );
      const updated = clipSchema.parse(
        mockCall(
          "PATCH",
          "/clips/" + clip.id,
          user,
          { startMs: 0, endMs: durationMs },
          { "If-Match": "1" },
        ),
      );
      expect(updated.durationMs).toBe(durationMs);
    },
  );
  it.each([14999, 180001])(
    "rejeita edição com %i ms fora dos limites absolutos",
    (durationMs) => {
      const p = create();
      vi.advanceTimersByTime(100000);
      const clip = clipSchema.parse(
        (mockCall("GET", "/projects/" + p.id + "/clips", user) as unknown[])[0],
      );
      expect(() =>
        mockCall(
          "PATCH",
          "/clips/" + clip.id,
          user,
          { startMs: 0, endMs: durationMs },
          { "If-Match": "1" },
        ),
      ).toThrow("A duração deve ficar entre 15 e 180 segundos.");
    },
  );
  it("aplica replay de idempotência e rejeita a mesma chave com outro corpo", () => {
    const key = crypto.randomUUID();
    const body = { source: { type: "url", url } };
    const first = projectSchema.parse(
      mockCall("POST", "/projects", user, body, { "Idempotency-Key": key }),
    );
    const replay = projectSchema.parse(
      mockCall("POST", "/projects", user, body, { "Idempotency-Key": key }),
    );
    expect(replay.id).toBe(first.id);
    expect(() =>
      mockCall(
        "POST",
        "/projects",
        user,
        { source: { type: "url", url: url + "2" } },
        { "Idempotency-Key": key },
      ),
    ).toThrowError(MockClipsError);
    expect(() =>
      mockCall("GET", "/projects/" + first.id, "outro-admin"),
    ).toThrowError(MockClipsError);
  });
  it("simula bloqueio de download, exige PUT e ETags válidos e retoma o mesmo projeto", () => {
    const p = create(undefined, "&mockScenario=blocked");
    vi.advanceTimersByTime(20_000);
    expect(
      projectSchema.parse(mockCall("GET", "/projects/" + p.id, user)).status,
    ).toBe("NEEDS_UPLOAD");
    const created = mockCall("POST", "/uploads", user, {
      projectId: p.id,
      fileName: "video.mp4",
      contentType: "video/mp4",
      sizeBytes: 8 * 1024 * 1024 + 4,
    }) as { uploadId: string; projectId: string };
    expect(created.projectId).toBe(p.id);
    const parts = uploadPartsSchema.parse(
      mockCall("POST", "/uploads/" + created.uploadId + "/parts", user, {
        partNumbers: [1, 2],
      }),
    );
    expect(parts.parts).toHaveLength(2);
    const first = mockUploadPart(created.uploadId, 1, user, 8 * 1024 * 1024);
    expect(() => mockUploadPart(created.uploadId, 2, user, 3)).toThrowError(
      MockClipsError,
    );
    const second = mockUploadPart(created.uploadId, 2, user, 4);
    expect(
      uploadStateSchema.parse(
        mockCall("GET", "/uploads/" + created.uploadId, user),
      ).uploadedBytes,
    ).toBe(8 * 1024 * 1024 + 4);
    expect(() =>
      mockCall("POST", "/uploads/" + created.uploadId + "/complete", user, {
        parts: [
          { partNumber: 1, etag: first },
          { partNumber: 2, etag: "wrong" },
        ],
      }),
    ).toThrowError(MockClipsError);
    const queued = projectSchema.parse(
      mockCall("POST", "/uploads/" + created.uploadId + "/complete", user, {
        parts: [
          { partNumber: 1, etag: first },
          { partNumber: 2, etag: second },
        ],
      }),
    );
    expect(queued.status).toBe("QUEUED");
    expect(queued.source.type).toBe("upload");
    expect(queued.error).toBeNull();
  });
  it("DELETE cancela o upload pendente e remove o projeto órfão", () => {
    const created = mockCall("POST", "/uploads", user, {
      fileName: "video.mp4",
      contentType: "video/mp4",
      sizeBytes: 10,
    }) as { uploadId: string; projectId: string };
    expect(mockCall("DELETE", "/uploads/" + created.uploadId, user)).toBeNull();
    expect(
      uploadStateSchema.parse(
        mockCall("GET", "/uploads/" + created.uploadId, user),
      ).status,
    ).toBe("ABORTED");
    expect(() =>
      mockCall("GET", "/projects/" + created.projectId, user),
    ).toThrowError(MockClipsError);
  });
  it("simula 503 após salvar o arquivo e permite repetir complete até enfileirar uma única vez", () => {
    const p = create(undefined, "&mockScenario=complete-unavailable");
    vi.advanceTimersByTime(20000);
    expect(
      projectSchema.parse(mockCall("GET", "/projects/" + p.id, user)).status,
    ).toBe("NEEDS_UPLOAD");
    const created = mockCall("POST", "/uploads", user, {
      projectId: p.id,
      fileName: "video.mp4",
      contentType: "video/mp4",
      sizeBytes: 10,
    }) as { uploadId: string };
    const etag = mockUploadPart(created.uploadId, 1, user, 10);
    const body = { parts: [{ partNumber: 1, etag }] };
    for (let attempt = 0; attempt < 4; attempt++) {
      expect(() =>
        mockCall(
          "POST",
          "/uploads/" + created.uploadId + "/complete",
          user,
          body,
        ),
      ).toThrow(expect.objectContaining({ status: 503, code: "INTERNAL" }));
      const state = uploadStateSchema.parse(
        mockCall("GET", "/uploads/" + created.uploadId, user),
      );
      expect(state.status).toBe("COMPLETED");
      expect(state.uploadedBytes).toBe(10);
      expect(state.uploadedParts).toEqual([
        { partNumber: 1, etag, sizeBytes: 10 },
      ]);
      expect(
        projectSchema.parse(mockCall("GET", "/projects/" + p.id, user)).status,
      ).toBe("NEEDS_UPLOAD");
    }
    vi.advanceTimersByTime(3600000);
    const queued = projectSchema.parse(
      mockCall(
        "POST",
        "/uploads/" + created.uploadId + "/complete",
        user,
        body,
      ),
    );
    expect(queued.status).toBe("QUEUED");
    expect(queued.id).toBe(p.id);
    vi.advanceTimersByTime(100000);
    const replay = projectSchema.parse(
      mockCall(
        "POST",
        "/uploads/" + created.uploadId + "/complete",
        user,
        body,
      ),
    );
    expect(replay.status).toBe("COMPLETED");
    expect(replay.createdAt).toBe(queued.createdAt);
  });
  it("simula conclusão parcial e impede editar antes do fim", () => {
    const p = create({ clipCount: 3 }, "&mockScenario=partial");
    vi.advanceTimersByTime(65_000);
    const ready = mockCall("GET", "/projects/" + p.id + "/clips", user) as {
      id: string;
    }[];
    expect(ready.length).toBeGreaterThan(0);
    expect(() =>
      mockCall(
        "PATCH",
        "/clips/" + ready[0]!.id,
        user,
        { title: "Novo" },
        { "If-Match": "1" },
      ),
    ).toThrowError(MockClipsError);
    vi.advanceTimersByTime(35_000);
    const done = projectSchema.parse(
      mockCall("GET", "/projects/" + p.id, user),
    );
    expect(done.status).toBe("COMPLETED_WITH_ERRORS");
    expect(done.counts).toEqual({
      clipsTotal: 3,
      clipsReady: 2,
      clipsFailed: 1,
    });
    const clips = (
      mockCall("GET", "/projects/" + p.id + "/clips", user) as unknown[]
    ).map((x) => clipSchema.parse(x));
    expect(clips.at(-1)?.status).toBe("FAILED");
    expect(clips.at(-1)?.renders).toHaveLength(0);
    const edited = clipSchema.parse(
      mockCall(
        "PATCH",
        "/clips/" + clips[0]!.id,
        user,
        { title: "Novo" },
        { "If-Match": "1" },
      ),
    );
    expect(edited.version).toBe(2);
    expect(() =>
      mockCall(
        "PATCH",
        "/clips/" + clips[0]!.id,
        user,
        { title: "Antigo" },
        { "If-Match": "1" },
      ),
    ).toThrowError(MockClipsError);
    const render = mockCall(
      "POST",
      "/clips/" + clips[0]!.id + "/render",
      user,
      { aspectRatios: ["9:16"] },
    ) as { renders: { videoUrl: string | null }[] };
    expect(render.renders[0]?.videoUrl).toMatch(/mock/);
    vi.advanceTimersByTime(800);
    const queued = clipSchema.parse(
      mockCall("GET", "/clips/" + clips[0]!.id, user),
    );
    expect(queued.renders[0]?.videoUrl).toBeNull();
    vi.advanceTimersByTime(5_000);
    const current = clipSchema.parse(
      mockCall("GET", "/clips/" + clips[0]!.id, user),
    );
    expect(current.renders[0]?.status).toBe("READY");
    expect(current.renders.some((r) => r.status === "SUPERSEDED")).toBe(true);
  });
  it("oferece dois kits, aplica o padrão ao projeto e respeita null/override", () => {
    const list = mockCall("GET", "/brand-kits", user) as { items: unknown[] };
    expect(list.items).toHaveLength(2);
    const first = brandKitSchema.parse(list.items[0]);
    expect(first.isDefault).toBe(true);
    expect(first.logo.url).toBe("/mock/brand-logo.png");
    const projectWithKit = create();
    expect(projectWithKit.options.brandKitId).toBe(first.id);
    expect(projectWithKit.options.captionTemplateKey).toBe("clean");
    mockCall(
      "PATCH",
      "/brand-kits/" + first.id,
      user,
      { captionStyle: { highlightColor: "#ff0000" } },
      { "If-Match": "1" },
    );
    vi.advanceTimersByTime(100000);
    const frozen = (
      mockCall(
        "GET",
        "/projects/" + projectWithKit.id + "/clips",
        user,
      ) as unknown[]
    ).map((clip) => clipSchema.parse(clip));
    expect(frozen[0]?.styleOverrides).toMatchObject({
      highlightColor: "#2dd4bf",
    });
    expect(create({ brandKitId: null }).options.brandKitId).toBeNull();
    vi.advanceTimersByTime(100000);
    expect(
      create({ captionTemplateKey: "default" }).options.captionTemplateKey,
    ).toBe("default");
  });
  it("valida If-Match, pending e fluxo de logo", () => {
    const kit = brandKitSchema.parse(
      mockCall("POST", "/brand-kits", user, { name: "Novo" }),
    );
    expect(kit.pending).toBe(true);
    expect(() =>
      mockCall(
        "PATCH",
        "/brand-kits/" + kit.id,
        user,
        { name: "Mudou" },
        { "If-Match": "99" },
      ),
    ).toThrowError(MockClipsError);
    vi.advanceTimersByTime(1000);
    expect(
      brandKitSchema.parse(mockCall("GET", "/brand-kits/" + kit.id, user))
        .pending,
    ).toBe(false);
    const updated = brandKitSchema.parse(
      mockCall(
        "PATCH",
        "/brand-kits/" + kit.id,
        user,
        { name: "Mudou" },
        { "If-Match": "1" },
      ),
    );
    expect(updated.version).toBe(2);
    const image = readFileSync("public/mock/brand-logo.png");
    const upload = logoUploadSchema.parse(
      mockCall("POST", "/brand-kits/" + kit.id + "/logo/upload", user, {
        contentType: "image/png",
        sizeBytes: image.length,
      }),
    );
    expect(() =>
      mockCall(
        "POST",
        "/brand-kits/" + kit.id + "/logo",
        user,
        { uploadKey: upload.uploadKey },
        { "If-Match": "2" },
      ),
    ).toThrowError(MockClipsError);
    expect(() =>
      mockLogoPut(
        upload.uploadKey,
        user,
        new Uint8Array(image.length),
        "image/png",
      ),
    ).toThrowError(MockClipsError);
    mockLogoPut(upload.uploadKey, user, image, "image/png");
    const attached = brandKitSchema.parse(
      mockCall(
        "POST",
        "/brand-kits/" + kit.id + "/logo",
        user,
        { uploadKey: upload.uploadKey },
        { "If-Match": "2" },
      ),
    );
    expect(attached.logo.url).toBe("/mock/brand-logo.png");
    const removed = brandKitSchema.parse(
      mockCall("DELETE", "/brand-kits/" + kit.id + "/logo", user, undefined, {
        "If-Match": "3",
      }),
    );
    expect(removed.logo.key).toBeNull();
  });
  it("mostra lastError de recusa assíncrona", () => {
    const kit = brandKitSchema.parse(
      mockCall("GET", "/brand-kits/mock-studio", user),
    );
    mockCall(
      "PATCH",
      "/brand-kits/" + kit.id,
      user,
      { name: "Rejeitar depois" },
      { "If-Match": "1" },
    );
    vi.advanceTimersByTime(1000);
    expect(
      brandKitSchema.parse(mockCall("GET", "/brand-kits/" + kit.id, user))
        .lastError?.source,
    ).toBe("command.rejected");
  });
  it("expõe lastError após cancelamento, edição e render recusados depois da resposta", () => {
    const cancelling = create(undefined, "&mockScenario=cancel-rejected");
    expect(
      projectSchema.parse(
        mockCall("POST", "/projects/" + cancelling.id + "/cancel", user, {}),
      ).status,
    ).toBe("CANCELLED");
    vi.advanceTimersByTime(1000);
    expect(
      projectSchema.parse(mockCall("GET", "/projects/" + cancelling.id, user))
        .lastError?.source,
    ).toBe("command.rejected");
    const p = create({ clipCount: 2 });
    vi.advanceTimersByTime(100000);
    const clips = (
      mockCall("GET", "/projects/" + p.id + "/clips", user) as unknown[]
    ).map((value) => clipSchema.parse(value));
    const before = clips[0]!;
    const optimistic = clipSchema.parse(
      mockCall(
        "PATCH",
        "/clips/" + before.id,
        user,
        { title: "Recusa edição" },
        { "If-Match": String(before.version) },
      ),
    );
    expect(optimistic.version).toBe(before.version + 1);
    vi.advanceTimersByTime(800);
    const rejected = clipSchema.parse(
      mockCall("GET", "/clips/" + before.id, user),
    );
    expect(rejected.version).toBe(before.version);
    expect(rejected.lastError?.source).toBe("clip.update_rejected");
    const second = clips[1]!;
    mockCall(
      "PATCH",
      "/clips/" + second.id,
      user,
      { title: "Recusa render" },
      { "If-Match": String(second.version) },
    );
    const response = mockCall("POST", "/clips/" + second.id + "/render", user, {
      aspectRatios: ["9:16"],
    }) as { renders: unknown[] };
    expect(response.renders.length).toBeGreaterThan(0);
    vi.advanceTimersByTime(800);
    expect(
      clipSchema.parse(mockCall("GET", "/clips/" + second.id, user)).lastError
        ?.code,
    ).toBe("RATE_LIMITED");
  });
  it("mantém pontuação e mescla só palavras alteradas após clipVersion confirmar", () => {
    const p = create({ clipCount: 1 });
    vi.advanceTimersByTime(100000);
    const clip = clipSchema.parse(
      (mockCall("GET", "/projects/" + p.id + "/clips", user) as unknown[])[0],
    );
    const path = "/clips/" + clip.id;
    const original = transcriptSchema.parse(
      mockCall("GET", path + "/transcript", user),
    );
    expect(original.words[11]?.punctuatedText).toBe("ver.");
    expect(original.words[11]?.edited).toBe(false);
    const partial = [{ id: 12, punctuatedText: "ver!" }];
    expect(
      patchClipSchema.parse({ captionWords: partial }).captionWords,
    ).toEqual(partial);
    expect(
      patchClipSchema.safeParse({ captionWords: [{ id: 12, text: "ver!" }] })
        .success,
    ).toBe(false);
    const saved = clipSchema.parse(
      mockCall(
        "PATCH",
        path,
        user,
        { captionWords: partial },
        { "If-Match": String(clip.version) },
      ),
    );
    expect(saved.version).toBe(clip.version + 1);
    expect(
      transcriptSchema.parse(mockCall("GET", path + "/transcript", user))
        .clipVersion,
    ).toBe(clip.version);
    vi.advanceTimersByTime(800);
    const after = transcriptSchema.parse(
      mockCall("GET", path + "/transcript", user),
    );
    expect(after.clipVersion).toBe(saved.version);
    expect(after.words[11]).toMatchObject({
      text: "ver",
      punctuatedText: "ver!",
      edited: true,
    });
    mockCall(
      "PATCH",
      path,
      user,
      { captionWords: [{ id: 1, hidden: true }] },
      { "If-Match": String(saved.version) },
    );
    vi.advanceTimersByTime(800);
    const merged = transcriptSchema.parse(
      mockCall("GET", path + "/transcript", user),
    );
    expect(merged.words[0]).toMatchObject({ hidden: true, edited: true });
    expect(merged.words[11]?.punctuatedText).toBe("ver!");
    mockCall(
      "PATCH",
      path,
      user,
      { captionWords: [{ id: 12, punctuatedText: null }] },
      { "If-Match": String(saved.version + 1) },
    );
    vi.advanceTimersByTime(800);
    const reset = transcriptSchema.parse(
      mockCall("GET", path + "/transcript", user),
    );
    expect(reset.words[11]).toMatchObject({
      punctuatedText: "ver.",
      edited: false,
    });
    expect(reset.words[0]?.hidden).toBe(true);
    mockCall(
      "PATCH",
      path,
      user,
      { title: "Só título" },
      { "If-Match": String(saved.version + 2) },
    );
    vi.advanceTimersByTime(800);
    const afterTitle = transcriptSchema.parse(
      mockCall("GET", path + "/transcript", user),
    );
    expect(afterTitle.words[0]?.hidden).toBe(true);
    expect(afterTitle.words[11]?.punctuatedText).toBe("ver.");
    mockCall(
      "PATCH",
      path,
      user,
      { captionWords: null },
      { "If-Match": String(saved.version + 3) },
    );
    vi.advanceTimersByTime(800);
    expect(
      transcriptSchema.parse(mockCall("GET", path + "/transcript", user))
        .words[0]?.hidden,
    ).toBeUndefined();
  });
  it("herda o título de abertura do kit, ajusta o corte e volta ao padrão do projeto", () => {
    const p = create({
      brandKitId: "mock-minimal",
      introTitle: { durationMs: 4000 },
    });
    expect(p.options.introTitle).toEqual({
      durationMs: 4000,
      position: "top",
      band: "box",
      bgColor: "#f59e0b",
    });
    vi.advanceTimersByTime(100_000);
    const [clip] = (
      mockCall("GET", "/projects/" + p.id + "/clips", user) as unknown[]
    ).map((item) => clipSchema.parse(item));
    expect(clip!.introTitle).toBeNull();
    expect(clip!.introTitleEffective).toEqual({
      enabled: true,
      durationMs: 4000,
      position: "top",
      band: "box",
      hideCaptions: true,
      animation: "pop",
      highlight: "none",
      bgColor: "#f59e0b",
    });
    const changes = patchClipSchema.parse({
      introTitle: { position: "center", bgColor: "#123456" },
    });
    const edited = clipSchema.parse(
      mockCall("PATCH", "/clips/" + clip!.id, user, changes, {
        "If-Match": "1",
      }),
    );
    expect(edited.introTitle).toEqual({
      position: "center",
      bgColor: "#123456",
    });
    expect(edited.introTitleEffective).toMatchObject({
      durationMs: 4000,
      position: "center",
      band: "box",
      bgColor: "#123456",
    });
    const reset = clipSchema.parse(
      mockCall(
        "PATCH",
        "/clips/" + clip!.id,
        user,
        { introTitle: null },
        { "If-Match": "2" },
      ),
    );
    expect(reset.introTitle).toBeNull();
    expect(reset.introTitleEffective).toMatchObject({
      position: "top",
      bgColor: "#f59e0b",
    });
  });
  it("aceita e devolve animação, efeito, fundo e destaque do título de abertura", () => {
    const style = {
      band: "rounded",
      animation: "slide",
      effect: "shadow",
      highlight: "auto",
    } as const;
    const kit = brandKitSchema.parse(
      mockCall("POST", "/brand-kits", user, {
        name: "Cartão",
        introTitle: style,
      }),
    );
    expect(kit.introTitle).toEqual(style);
    const p = create({
      brandKitId: kit.id,
      introTitle: { band: "none", effect: "glow" },
    });
    expect(p.options.introTitle).toEqual({
      ...style,
      band: "none",
      effect: "glow",
    });
    vi.advanceTimersByTime(100_000);
    const [clip] = (
      mockCall("GET", "/projects/" + p.id + "/clips", user) as unknown[]
    ).map((item) => clipSchema.parse(item));
    expect(clip!.introTitleEffective).toMatchObject({
      band: "none",
      animation: "slide",
      effect: "glow",
      highlight: "auto",
    });
    const edited = clipSchema.parse(
      mockCall(
        "PATCH",
        "/clips/" + clip!.id,
        user,
        patchClipSchema.parse({
          introTitle: { animation: "typewriter", highlight: "none" },
        }),
        { "If-Match": "1" },
      ),
    );
    expect(edited.introTitle).toEqual({
      animation: "typewriter",
      highlight: "none",
    });
    expect(edited.introTitleEffective).toMatchObject({
      band: "none",
      animation: "typewriter",
      effect: "glow",
      highlight: "none",
    });
  });
  it("guarda e limpa o título de abertura do brand kit", () => {
    const kit = brandKitSchema.parse(
      mockCall("POST", "/brand-kits", user, {
        name: "Abertura",
        introTitle: { enabled: false },
      }),
    );
    expect(kit.introTitle).toEqual({ enabled: false });
    const updated = brandKitSchema.parse(
      mockCall(
        "PATCH",
        "/brand-kits/" + kit.id,
        user,
        { introTitle: null },
        { "If-Match": "1" },
      ),
    );
    expect(updated.introTitle).toBeNull();
  });
  it("devolve créditos e extrato válidos", () => {
    creditsSchema.parse(mockCall("GET", "/credits", user));
    const ledger = mockCall("GET", "/credits/ledger", user) as {
      items: unknown[];
    };
    ledger.items.forEach((item) => ledgerEntrySchema.parse(item));
    expect(ledger.items).toHaveLength(1);
  });
});
