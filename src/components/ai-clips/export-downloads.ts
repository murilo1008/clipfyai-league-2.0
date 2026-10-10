import { type Clip } from "@/server/league-clips/contracts";
import { leagueCode } from "./async-state";
import { renderDownloadUrl } from "./render-assets";

type Render = Clip["renders"][number];
export const preparingExport = "Preparando o vídeo em 1080p…";
export const failedExport = "Não foi possível preparar o 1080p.";
export const cancelledExport =
  "O corte mudou depois da prévia; aguarde o render novo e baixe de novo.";

export function exportErrorMessage(code: string | null) {
  if (code === "VALIDATION_ERROR")
    return "Aguarde o render da versão atual deste formato terminar e baixe de novo.";
  if (code === "RATE_LIMITED")
    return "Há muitas exportações em andamento. Aguarde e tente de novo.";
  if (code === "PROJECT_NOT_READY")
    return "Aguarde o projeto terminar para preparar o vídeo em 1080p.";
  return failedExport;
}

export type ExportRequest = {
  clipId: string;
  renderId: string;
  aspectRatio: Render["aspectRatio"];
  version: number;
  phase: "submitting" | "waiting" | "retrying" | "failed" | "cancelled";
  batch: boolean;
  awaitingAcceptance: boolean;
  initialStatus: Render["exportStatus"];
  ignoredError: string | null;
  acknowledgeUntil: number;
  retryAt: number;
  attempts: number;
  message: string | null;
};
const active = (request: ExportRequest) =>
  ["submitting", "waiting", "retrying"].includes(request.phase);
const errorKey = (clip: Clip) =>
  clip.lastError?.command === "clip.export"
    ? JSON.stringify(clip.lastError)
    : null;
const key = (clipId: string, renderId: string) => `${clipId}/${renderId}`;

export function exportPollMs(
  clip: Clip | undefined,
  requests: readonly ExportRequest[],
  visible: boolean,
) {
  if (!visible) return false;
  if (requests.some(active)) return 3000;
  if (clip?.lastError?.command === "clip.export") return false;
  return clip?.renders.some((r) =>
    ["QUEUED", "RENDERING"].includes(r.exportStatus ?? ""),
  )
    ? 3000
    : false;
}

export function mp4ButtonState(render: Render, request?: ExportRequest) {
  if (request && active(request))
    return {
      preparing: true,
      label: preparingExport,
      message: request.message,
    };
  if (renderDownloadUrl(render))
    return { preparing: false, label: "Baixar MP4", message: null };
  if (request?.phase === "failed" || request?.phase === "cancelled")
    return {
      preparing: false,
      label: "Tentar de novo",
      message: request.message,
    };
  if (["QUEUED", "RENDERING"].includes(render.exportStatus ?? ""))
    return { preparing: true, label: preparingExport, message: null };
  if (render.exportStatus === "FAILED")
    return { preparing: false, label: "Tentar de novo", message: failedExport };
  if (render.exportStatus === "CANCELLED")
    return { preparing: false, label: "Baixar MP4", message: cancelledExport };
  return { preparing: false, label: "Baixar MP4", message: null };
}

/** Keeps the download intent while TanStack Query reads the asynchronous export. */
export class ClipDownloadManager {
  private requests = new Map<string, ExportRequest>();
  private snapshot: ExportRequest[] = [];
  private listeners = new Set<() => void>();
  constructor(
    private dependencies: {
      exportClip: (
        clipId: string,
        ratios: Render["aspectRatio"][],
      ) => Promise<unknown>;
      download: (url: string, clipId: string, render: Render) => void;
    },
  ) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = () => this.snapshot;
  private publish() {
    this.snapshot = [...this.requests.values()].map((r) => ({ ...r }));
    this.listeners.forEach((listener) => listener());
  }
  private reject(request: ExportRequest, code: string | null) {
    request.message = exportErrorMessage(code);
    if (code === "RATE_LIMITED" && request.batch) {
      request.phase = "retrying";
      request.retryAt =
        Date.now() + Math.min(30_000, 3000 * 2 ** request.attempts);
    } else request.phase = "failed";
  }
  private async submit(requests: ExportRequest[]) {
    for (const r of requests) {
      r.phase = "submitting";
      r.awaitingAcceptance = true;
      r.acknowledgeUntil = Date.now() + 30_000;
      r.message = null;
      r.attempts++;
    }
    this.publish();
    try {
      await this.dependencies.exportClip(requests[0]!.clipId, [
        ...new Set(requests.map((r) => r.aspectRatio)),
      ]);
      for (const r of requests)
        if (r.phase === "submitting") r.phase = "waiting";
    } catch (error) {
      for (const r of requests) this.reject(r, leagueCode(error));
    }
    this.publish();
  }
  request(clip: Clip, renders: Render[], batch = false) {
    const submit: ExportRequest[] = [];
    for (const render of renders) {
      const requestKey = key(clip.id, render.id);
      if (
        this.requests.has(requestKey) &&
        active(this.requests.get(requestKey)!)
      )
        continue;
      const url = renderDownloadUrl(render);
      if (url) {
        this.dependencies.download(url, clip.id, render);
        continue;
      }
      const inProgress = ["QUEUED", "RENDERING"].includes(
        render.exportStatus ?? "",
      );
      const request: ExportRequest = {
        clipId: clip.id,
        renderId: render.id,
        aspectRatio: render.aspectRatio,
        version: clip.version,
        phase: "waiting",
        batch,
        awaitingAcceptance: !inProgress,
        initialStatus: render.exportStatus,
        ignoredError: errorKey(clip),
        acknowledgeUntil: Date.now() + 30_000,
        retryAt: 0,
        attempts: 0,
        message: null,
      };
      this.requests.set(requestKey, request);
      if (!inProgress) submit.push(request);
    }
    this.publish();
    return submit.length ? this.submit(submit) : Promise.resolve();
  }
  requestAll(clips: Clip[]) {
    // One command per clip, all formats together; commands start without awaiting each other.
    return Promise.all(
      clips.map((clip) => {
        const ready = clip.renders.filter(
          (r) => r.status === "READY" && r.videoUrl,
        );
        const latest = new Map<Render["aspectRatio"], Render>();
        for (const render of ready) {
          const selected = latest.get(render.aspectRatio);
          if (!selected || render.version > selected.version)
            latest.set(render.aspectRatio, render);
        }
        return this.request(clip, [...latest.values()], true);
      }),
    );
  }
  observe(clip: Clip) {
    let changed = false;
    const retry: ExportRequest[] = [];
    for (const request of this.requests.values()) {
      if (request.clipId !== clip.id || !active(request)) continue;
      if (clip.version < request.version) continue;
      const render = clip.renders.find((r) => r.id === request.renderId);
      const url = render && renderDownloadUrl(render);
      if (clip.version !== request.version || !render) {
        request.phase = "cancelled";
        request.message = cancelledExport;
        changed = true;
      } else if (url) {
        this.dependencies.download(url, clip.id, render);
        this.requests.delete(key(clip.id, render.id));
        changed = true;
      } else if (request.phase === "submitting") {
        continue;
      } else if (errorKey(clip) && errorKey(clip) !== request.ignoredError) {
        request.ignoredError = errorKey(clip);
        this.reject(request, clip.lastError!.code);
        changed = true;
      } else if (request.phase === "retrying") {
        if (Date.now() >= request.retryAt) retry.push(request);
      } else if (["QUEUED", "RENDERING"].includes(render.exportStatus ?? "")) {
        if (request.awaitingAcceptance) {
          request.awaitingAcceptance = false;
          changed = true;
        }
      } else if (
        request.awaitingAcceptance &&
        render.exportStatus === request.initialStatus &&
        Date.now() < request.acknowledgeUntil
      ) {
        continue;
      } else if (render.exportStatus === "CANCELLED") {
        request.phase = "cancelled";
        request.message = cancelledExport;
        changed = true;
      } else if (
        render.exportStatus === "FAILED" ||
        render.exportStatus === "READY" ||
        Date.now() >= request.acknowledgeUntil
      ) {
        this.reject(request, null);
        changed = true;
      }
    }
    if (retry.length) void this.submit(retry);
    else if (changed) this.publish();
  }
}

export function clipExportMessage(clip: Clip) {
  return clip.lastError?.command === "clip.export"
    ? exportErrorMessage(clip.lastError.code)
    : clip.lastError
      ? clip.lastError.message
      : null;
}
