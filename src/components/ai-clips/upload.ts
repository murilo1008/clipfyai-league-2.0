import { type z } from "zod";
import {
  optionsInputSchema,
  uploadStateSchema,
  type ProjectOptionsInput,
} from "@/server/league-clips/contracts";
import { optionErrorPt } from "./labels";
export function validateUploadOptions(options?: ProjectOptionsInput) {
  if (options === undefined) return { ok: true as const, options: undefined };
  const parsed = optionsInputSchema.safeParse(options);
  const issue = parsed.success
    ? undefined
    : (parsed.error.issues.find(
        (issue) =>
          issue.path[0] === "minDurationMs" ||
          issue.path[0] === "maxDurationMs",
      ) ?? parsed.error.issues[0]);
  return parsed.success
    ? { ok: true as const, options: parsed.data }
    : {
        ok: false as const,
        field: issue?.path.length ? issue.path.join(".") : undefined,
        message: optionErrorPt(issue?.path ?? [], issue?.message),
      };
}
export type StoredUpload = {
  uploadId: string;
  projectId: string;
  name: string;
  size: number;
  lastModified: number;
  parts: { partNumber: number; etag: string }[];
};
export function sameFile(
  file: Pick<File, "name" | "size" | "lastModified">,
  saved: StoredUpload,
) {
  return (
    file.name === saved.name &&
    file.size === saved.size &&
    file.lastModified === saved.lastModified
  );
}
export function partRange(partNumber: number, partSize: number, total: number) {
  const start = (partNumber - 1) * partSize;
  return { start, end: Math.min(total, start + partSize) };
}
export function retryDelay(attempt: number) {
  return Math.min(5000, 500 * 2 ** attempt);
}
export function putPart(
  url: string,
  blob: Blob,
  onProgress: (loaded: number) => void,
  signal: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    signal.addEventListener("abort", abort, { once: true });
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded);
    };
    xhr.onload = () => {
      signal.removeEventListener("abort", abort);
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader("ETag");
        if (etag) resolve(etag);
        else
          reject(
            new Error(
              "O storage não expôs o ETag. Verifique o CORS do bucket.",
            ),
          );
      } else {
        const error = new Error(
          "Falha ao enviar uma parte do arquivo.",
        ) as Error & { status: number };
        error.status = xhr.status;
        reject(error);
      }
    };
    xhr.onerror = () => {
      signal.removeEventListener("abort", abort);
      reject(new Error("Falha de rede no upload."));
    };
    xhr.onabort = () => {
      signal.removeEventListener("abort", abort);
      reject(new DOMException("Upload cancelado", "AbortError"));
    };
    xhr.send(blob);
  });
}
export function retryableUploadError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError")
    return false;
  const value = error as {
    status?: number;
    data?: { leagueError?: { code?: string } };
  } | null;
  if (
    value?.status &&
    value.status >= 400 &&
    value.status < 500 &&
    ![408, 429].includes(value.status)
  )
    return false;
  const code = value?.data?.leagueError?.code;
  return (
    !code ||
    ![
      "UPLOAD_EXPIRED",
      "UPLOAD_INCOMPLETE",
      "VALIDATION_ERROR",
      "NOT_FOUND",
      "FORBIDDEN",
      "SOURCE_TOO_LARGE",
    ].includes(code)
  );
}
export function waitForRetry(ms: number, signal: AbortSignal) {
  if (signal.aborted)
    return Promise.reject(new DOMException("Upload cancelado", "AbortError"));
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Upload cancelado", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}
export async function multipartUpload(args: {
  file: File;
  uploadId: string;
  partSizeBytes: number;
  partCount: number;
  completed: { partNumber: number; etag: string }[];
  getUrl: (number: number) => Promise<string>;
  onProgress: (overall: number, parts: Record<number, number>) => void;
  onPart: (part: { partNumber: number; etag: string }) => void;
  signal: AbortSignal;
  put?: (
    url: string,
    blob: Blob,
    onProgress: (loaded: number) => void,
    signal: AbortSignal,
  ) => Promise<string>;
  sleep?: (ms: number) => Promise<void>;
}) {
  const { file, partSizeBytes, partCount, signal } = args;
  const done = new Map(args.completed.map((p) => [p.partNumber, p.etag]));
  const loaded: Record<number, number> = {};
  for (const n of done.keys()) {
    const range = partRange(n, partSizeBytes, file.size);
    loaded[n] = range.end - range.start;
  }
  const progress = () =>
    args.onProgress(
      Math.round(
        (Object.values(loaded).reduce((a, b) => a + b, 0) / file.size) * 100,
      ),
      { ...loaded },
    );
  progress();
  const pending = Array.from({ length: partCount }, (_, i) => i + 1).filter(
    (n) => !done.has(n),
  );
  let index = 0;
  const worker = async () => {
    while (index < pending.length) {
      if (signal.aborted)
        throw new DOMException("Upload cancelado", "AbortError");
      const n = pending[index++]!,
        range = partRange(n, partSizeBytes, file.size),
        blob = file.slice(range.start, range.end);
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const url = await args.getUrl(n);
          const etag = await (args.put ?? putPart)(
            url,
            blob,
            (bytes) => {
              loaded[n] = bytes;
              progress();
            },
            signal,
          );
          done.set(n, etag);
          loaded[n] = blob.size;
          progress();
          args.onPart({ partNumber: n, etag });
          break;
        } catch (error) {
          loaded[n] = 0;
          progress();
          if (signal.aborted || attempt === 3 || !retryableUploadError(error))
            throw error;
          await (args.sleep ?? ((ms) => waitForRetry(ms, signal)))(
            retryDelay(attempt),
          );
          if (signal.aborted)
            throw new DOMException("Upload cancelado", "AbortError");
        }
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(4, pending.length) }, worker),
  );
  return [...done]
    .map(([partNumber, etag]) => ({ partNumber, etag }))
    .sort((a, b) => a.partNumber - b.partNumber);
}

export function validateResume(
  file: Pick<File, "name" | "size" | "lastModified" | "type">,
  saved: StoredUpload,
  state: z.infer<typeof uploadStateSchema>,
  projectId?: string,
  now = Date.now(),
) {
  if (!sameFile(file, saved))
    throw new Error("Escolha o mesmo arquivo para retomar o envio.");
  if (
    state.status !== "COMPLETED" &&
    (state.status !== "PENDING" || Date.parse(state.expiresAt) <= now)
  )
    throw new Error("O envio salvo expirou. Descarte-o para começar outro.");
  if (state.projectId !== null && state.projectId !== saved.projectId)
    throw new Error("O envio salvo pertence a outro projeto.");
  if (projectId && saved.projectId !== projectId)
    throw new Error("Este arquivo pertence a outro projeto.");
  if (
    state.fileName !== file.name ||
    state.sizeBytes !== file.size ||
    state.contentType !== file.type
  )
    throw new Error("O arquivo não corresponde ao envio salvo.");
  const parts =
    state.status === "COMPLETED" && !state.uploadedParts.length
      ? saved.parts
      : state.uploadedParts;
  return parts.map(({ partNumber, etag }) => ({
    partNumber,
    etag,
  }));
}

export async function abortCreatedUploadIfCancelled(
  signal: AbortSignal,
  uploadId: string,
  abortUpload: (id: string) => Promise<unknown>,
) {
  if (!signal.aborted) return false;
  await abortUpload(uploadId);
  return true;
}
