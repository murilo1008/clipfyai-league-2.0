import { describe, expect, it, vi } from "vitest";
import { uploadStateSchema } from "@/server/league-clips/contracts";
import {
  abortCreatedUploadIfCancelled,
  multipartUpload,
  partRange,
  putPart,
  retryDelay,
  sameFile,
  validateResume,
  validateUploadOptions,
  waitForRetry,
  retryableUploadError,
} from "./upload";

describe("upload multipart", () => {
  it("valida opções parciais antes do upload com erro legível", () => {
    expect(validateUploadOptions(undefined)).toEqual({
      ok: true,
      options: undefined,
    });
    expect(validateUploadOptions({ brandKitId: null })).toEqual({
      ok: true,
      options: { brandKitId: null },
    });
    expect(validateUploadOptions({ clipCount: 31 })).toEqual({
      ok: false,
      field: "clipCount",
      message: "Confira o máximo de clipes.",
    });
    expect(
      validateUploadOptions({ minDurationMs: 60000, maxDurationMs: 60000 }),
    ).toEqual({
      ok: false,
      field: "maxDurationMs",
      message:
        'O campo "até" deve ser pelo menos 10 segundos maior que o campo "de".',
    });
  });
  it.each([
    [
      { minDurationMs: 14000 },
      'O campo "de" deve ficar entre 15 e 60 segundos.',
    ],
    [
      { maxDurationMs: 181000 },
      'O campo "até" deve ficar entre 30 e 180 segundos.',
    ],
  ])(
    "mostra limites em segundos antes de iniciar o upload: %j",
    (options, message) => {
      expect(validateUploadOptions(options)).toEqual({
        ok: false,
        field: Object.keys(options)[0],
        message,
      });
    },
  );
  it("aponta o campo do título de abertura com a mensagem do contrato", () => {
    expect(validateUploadOptions({ introTitle: { durationMs: 9000 } })).toEqual(
      {
        ok: false,
        field: "introTitle.durationMs",
        message:
          "A duração do título de abertura deve ficar entre 1 e 8 segundos.",
      },
    );
    expect(
      validateUploadOptions({ introTitle: { band: "box", enabled: true } }),
    ).toEqual({
      ok: true,
      options: { introTitle: { band: "box", enabled: true } },
    });
  });
  it("calcula partes e identifica o mesmo arquivo para retomada", () => {
    expect(partRange(3, 4, 10)).toEqual({ start: 8, end: 10 });
    expect(
      sameFile(
        { name: "video.mp4", size: 10, lastModified: 123 },
        {
          uploadId: "u",
          projectId: "p",
          name: "video.mp4",
          size: 10,
          lastModified: 123,
          parts: [],
        },
      ),
    ).toBe(true);
    expect(retryDelay(2)).toBe(2000);
  });
  it("aceita o GET real sem completedAt e retoma pelas partes do servidor", () => {
    const state = uploadStateSchema.parse({
      uploadId: "u",
      projectId: null,
      status: "PENDING",
      fileName: "video.mp4",
      contentType: "video/mp4",
      sizeBytes: 10,
      partSizeBytes: 4,
      partCount: 3,
      expiresAt: "2099-01-01T00:00:00Z",
      uploadedParts: [{ partNumber: 1, etag: "server", sizeBytes: 4 }],
      uploadedBytes: 4,
    });
    const saved = {
      uploadId: "u",
      projectId: "p",
      name: "video.mp4",
      size: 10,
      lastModified: 1,
      parts: [{ partNumber: 1, etag: "stale" }],
    };
    const file = {
      name: "video.mp4",
      size: 10,
      lastModified: 1,
      type: "video/mp4",
    };
    expect(validateResume(file, saved, state)).toEqual([
      { partNumber: 1, etag: "server" },
    ]);
    expect(() =>
      validateResume(file, saved, { ...state, status: "EXPIRED" }),
    ).toThrow("expirou");
    expect(() =>
      validateResume(file, saved, { ...state, sizeBytes: 9 }),
    ).toThrow("não corresponde");
    expect(() =>
      validateResume(file, saved, { ...state, projectId: "outro" }),
    ).toThrow("outro projeto");
    const completed = {
      ...state,
      status: "COMPLETED" as const,
      expiresAt: "2000-01-01T00:00:00Z",
      uploadedParts: [],
    };
    expect(validateResume(file, saved, completed)).toEqual(saved.parts);
    expect(
      validateResume(file, saved, {
        ...completed,
        uploadedParts: state.uploadedParts,
      }),
    ).toEqual([{ partNumber: 1, etag: "server" }]);
    expect(() =>
      validateResume({ ...file, name: "outro.mp4" }, saved, completed),
    ).toThrow("mesmo arquivo");
    expect(() => validateResume(file, saved, completed, "outro")).toThrow(
      "outro projeto",
    );
    expect(() =>
      validateResume(file, saved, { ...completed, contentType: "video/webm" }),
    ).toThrow("não corresponde");
    expect(() =>
      validateResume(file, saved, { ...state, status: "ABORTED" }),
    ).toThrow("expirou");
  });
  it("retoma partes concluídas, repete uma falha e usa os ETags retornados", async () => {
    const blob = Object.assign(new Blob(["abcdefghij"]), {
      name: "video.mp4",
      lastModified: 1,
    }) as File;
    const attempts = new Map<number, number>(),
      progress: number[] = [];
    const result = await multipartUpload({
      file: blob,
      uploadId: "u",
      partSizeBytes: 4,
      partCount: 3,
      completed: [{ partNumber: 1, etag: "old" }],
      signal: new AbortController().signal,
      getUrl: async (n) => String(n),
      onProgress: (p) => progress.push(p),
      onPart: vi.fn(),
      sleep: async () => undefined,
      put: async (url, part, onProgress) => {
        const n = Number(url);
        attempts.set(n, (attempts.get(n) ?? 0) + 1);
        if (n === 2 && attempts.get(n) === 1) throw new Error("rede");
        onProgress(part.size);
        return '"etag-' + n + '"';
      },
    });
    expect(result).toEqual([
      { partNumber: 1, etag: "old" },
      { partNumber: 2, etag: '"etag-2"' },
      { partNumber: 3, etag: '"etag-3"' },
    ]);
    expect(attempts.get(1)).toBeUndefined();
    expect(attempts.get(2)).toBe(2);
    expect(progress.at(-1)).toBe(100);
  });
  it("lê o ETag do PUT e rejeita resposta sem ETag", async () => {
    const previous = globalThis.XMLHttpRequest;
    class FakeXHR {
      upload: {
        onprogress?: (e: { lengthComputable: boolean; loaded: number }) => void;
      } = {};
      status = 200;
      onload?: () => void;
      onerror?: () => void;
      onabort?: () => void;
      open() {
        return undefined;
      }
      send(blob: Blob) {
        this.upload.onprogress?.({ lengthComputable: true, loaded: blob.size });
        this.onload?.();
      }
      abort() {
        this.onabort?.();
      }
      getResponseHeader() {
        return '"etag"';
      }
    }
    globalThis.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest;
    try {
      expect(
        await putPart(
          "/signed",
          new Blob(["abc"]),
          () => undefined,
          new AbortController().signal,
        ),
      ).toBe('"etag"');
    } finally {
      globalThis.XMLHttpRequest = previous;
    }
  });
  it("rejeita PUT sem ETag e status não 2xx", async () => {
    const original = globalThis.XMLHttpRequest;
    let status = 200,
      etag: string | null = null;
    class Xhr {
      upload = { onprogress: undefined };
      status = status;
      onload?: () => void;
      onerror?: () => void;
      onabort?: () => void;
      open() {
        return undefined;
      }
      send() {
        this.onload?.();
      }
      abort() {
        this.onabort?.();
      }
      getResponseHeader() {
        return etag;
      }
    }
    globalThis.XMLHttpRequest = Xhr as unknown as typeof XMLHttpRequest;
    try {
      await expect(
        putPart(
          "/signed",
          new Blob(["a"]),
          () => undefined,
          new AbortController().signal,
        ),
      ).rejects.toThrow("ETag");
      status = 403;
      etag = '"etag"';
      await expect(
        putPart(
          "/signed",
          new Blob(["a"]),
          () => undefined,
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ status: 403 });
    } finally {
      globalThis.XMLHttpRequest = original;
    }
  });
  it("usa URL nova até quatro tentativas e limita simultaneidade a quatro", async () => {
    const file = Object.assign(new Blob(["abcde"]), {
      name: "a.mp4",
      lastModified: 1,
    }) as File;
    let active = 0,
      maxActive = 0,
      attempts = 0;
    const urls: string[] = [];
    const result = await multipartUpload({
      file,
      uploadId: "u",
      partSizeBytes: 1,
      partCount: 5,
      completed: [],
      signal: new AbortController().signal,
      onProgress: () => undefined,
      onPart: () => undefined,
      getUrl: async (n) => {
        const url = n + ":" + ++attempts;
        urls.push(url);
        return url;
      },
      put: async (url) => {
        active++;
        maxActive = Math.max(maxActive, active);
        await Promise.resolve();
        active--;
        if (
          url.startsWith("1:") &&
          urls.filter((x) => x.startsWith("1:")).length < 4
        )
          throw Error("network");
        return '"etag"';
      },
      sleep: async () => undefined,
    });
    expect(result).toHaveLength(5);
    expect(urls.filter((x) => x.startsWith("1:"))).toHaveLength(4);
    expect(new Set(urls).size).toBe(urls.length);
    expect(maxActive).toBe(4);
  });
  it("esgota quatro tentativas e interrompe backoff no abort", async () => {
    const file = Object.assign(new Blob(["a"]), {
      name: "a.mp4",
      lastModified: 1,
    }) as File;
    let attempts = 0;
    const base = {
      file,
      uploadId: "u",
      partSizeBytes: 1,
      partCount: 1,
      completed: [],
      onProgress: () => undefined,
      onPart: () => undefined,
      getUrl: async () => String(++attempts),
      put: async () => {
        throw Error("network");
      },
      sleep: async () => undefined,
    };
    await expect(
      multipartUpload({ ...base, signal: new AbortController().signal }),
    ).rejects.toThrow("network");
    expect(attempts).toBe(4);
    const ctl = new AbortController();
    const waiting = waitForRetry(10000, ctl.signal);
    ctl.abort();
    await expect(waiting).rejects.toMatchObject({ name: "AbortError" });
    expect(retryableUploadError({ status: 403 })).toBe(false);
    expect(
      retryableUploadError({
        data: { leagueError: { code: "UPLOAD_EXPIRED" } },
      }),
    ).toBe(false);
  });
  it("cancela uma sessão criada após o usuário pedir cancelamento durante o POST", async () => {
    const controller = new AbortController(),
      abort = vi.fn(async (_id: string) => undefined);
    expect(
      await abortCreatedUploadIfCancelled(controller.signal, "new", abort),
    ).toBe(false);
    controller.abort();
    expect(
      await abortCreatedUploadIfCancelled(controller.signal, "new", abort),
    ).toBe(true);
    expect(abort).toHaveBeenCalledExactlyOnceWith("new");
  });
});
