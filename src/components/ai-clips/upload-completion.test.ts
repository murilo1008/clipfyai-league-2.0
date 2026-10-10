import { describe, expect, it, vi } from "vitest";
import {
  optionsSchema,
  statuses,
  type Project,
} from "@/server/league-clips/contracts";
import {
  completeUploadedVideo,
  recoverableCompleteError,
  uploadCompletionDecision,
} from "./upload-completion";

const project: Project = {
  id: "project",
  userId: "admin",
  status: "NEEDS_UPLOAD",
  currentStage: null,
  progressPct: 0,
  source: {
    type: "upload",
    url: null,
    platform: "UPLOAD",
    title: "Vídeo",
    durationMs: null,
  },
  options: optionsSchema.parse({}),
  counts: { clipsTotal: 0, clipsReady: 0, clipsFailed: 0 },
  error: null,
  stages: [],
  externalRef: null,
  createdAt: "2026-10-06T12:00:00Z",
  updatedAt: "2026-10-06T12:00:00Z",
  completedAt: null,
  expiresAt: null,
};
const unavailable = {
  data: { httpStatus: 503, leagueError: { status: 503, code: "INTERNAL" } },
};
const queued: Project = { ...project, status: "QUEUED" };
const signal = () => new AbortController().signal;

describe("decisão de conclusão do upload", () => {
  it.each(statuses)("decide a retomada pelo status %s", (status) => {
    expect(uploadCompletionDecision(status)).toBe(
      status === "NEEDS_UPLOAD"
        ? "retry"
        : status === "FAILED"
          ? "failed"
          : "success",
    );
  });
  it.each([500, 502, 503, 504, 599])(
    "recupera erro HTTP %i do League",
    (status) => {
      expect(
        recoverableCompleteError({ data: { leagueError: { status } } }),
      ).toBe(true);
    },
  );
  it.each([400, 401, 403, 404, 408, 409, 410, 413, 429])(
    "mantém o erro HTTP %i sem repetir complete",
    (status) => {
      expect(
        recoverableCompleteError({
          data: { httpStatus: 500, leagueError: { status } },
        }),
      ).toBe(false);
    },
  );
  it("usa o HTTP do tRPC para falha de conexão e rejeita cancelamento", () => {
    expect(
      recoverableCompleteError({
        data: { httpStatus: 502, leagueError: null },
      }),
    ).toBe(true);
    expect(
      recoverableCompleteError({
        data: { httpStatus: 403, leagueError: null },
      }),
    ).toBe(false);
    expect(recoverableCompleteError(new TypeError("Failed to fetch"))).toBe(
      true,
    );
    expect(
      recoverableCompleteError(new DOMException("Cancelado", "AbortError")),
    ).toBe(false);
  });
});

describe("recuperação do complete", () => {
  it("conclui normalmente sem consultar o projeto", async () => {
    const getProject = vi.fn();
    expect(
      await completeUploadedVideo({
        complete: async () => queued,
        getProject,
        signal: signal(),
      }),
    ).toEqual({ kind: "success", project: queued });
    expect(getProject).not.toHaveBeenCalled();
  });
  it.each([unavailable, new TypeError("Failed to fetch")])(
    "reconhece sucesso quando só a resposta de complete se perdeu: %j",
    async (error) => {
      const complete = vi.fn().mockRejectedValue(error);
      const getProject = vi.fn().mockResolvedValue(queued);
      expect(
        await completeUploadedVideo({ complete, getProject, signal: signal() }),
      ).toEqual({ kind: "success", project: queued });
      expect(complete).toHaveBeenCalledTimes(1);
      expect(getProject).toHaveBeenCalledTimes(1);
    },
  );
  it("repete complete com espera crescente enquanto NEEDS_UPLOAD e depois conclui", async () => {
    const complete = vi
      .fn()
      .mockRejectedValueOnce(unavailable)
      .mockRejectedValueOnce(unavailable)
      .mockResolvedValue(queued);
    const getProject = vi.fn().mockResolvedValue(project);
    const sleep = vi.fn(async () => undefined);
    expect(
      await completeUploadedVideo({
        complete,
        getProject,
        signal: signal(),
        sleep,
      }),
    ).toEqual({ kind: "success", project: queued });
    expect(complete).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[500], [1000]]);
  });
  it("esgota quatro tentativas e devolve pendência sem tratar o arquivo como falha", async () => {
    const complete = vi.fn().mockRejectedValue(unavailable);
    const getProject = vi.fn().mockResolvedValue(project);
    const sleep = vi.fn(async () => undefined);
    expect(
      await completeUploadedVideo({
        complete,
        getProject,
        signal: signal(),
        sleep,
      }),
    ).toEqual({ kind: "pending" });
    expect(complete).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls).toEqual([[500], [1000], [2000]]);
  });
  it("preserva a pendência quando GET também está fora", async () => {
    const complete = vi.fn().mockRejectedValue(unavailable);
    const getProject = vi.fn().mockRejectedValue(new TypeError("Offline"));
    expect(
      await completeUploadedVideo({
        complete,
        getProject,
        signal: signal(),
        sleep: async () => undefined,
      }),
    ).toEqual({ kind: "pending" });
    expect(complete).toHaveBeenCalledTimes(1);
    expect(getProject).toHaveBeenCalledTimes(4);
  });
  it.each([false, true])(
    "mostra a mensagem do projeto FAILED (retomada: %s)",
    async (alreadyCompleted) => {
      const failed: Project = {
        ...project,
        status: "FAILED",
        error: {
          code: "NO_MOMENTS_FOUND",
          message: "Sem momentos",
        },
      };
      await expect(
        completeUploadedVideo({
          complete: vi.fn().mockRejectedValue(unavailable),
          getProject: async () => failed,
          alreadyCompleted,
          signal: signal(),
        }),
      ).rejects.toThrow(
        "Não encontramos momentos com potencial de corte neste vídeo. Seus créditos foram devolvidos.",
      );
    },
  );
  it("mostra FAILED também quando devolvido por complete", async () => {
    await expect(
      completeUploadedVideo({
        complete: async () => ({
          ...project,
          status: "FAILED",
          error: { code: "NO_AUDIO", message: "O vídeo não contém áudio." },
        }),
        getProject: vi.fn(),
        signal: signal(),
      }),
    ).rejects.toThrow("O vídeo não contém áudio.");
  });
  it("mantém 4xx sem consultar o projeto nem repetir complete", async () => {
    const error = { data: { leagueError: { status: 409 } } };
    const complete = vi.fn().mockRejectedValue(error),
      getProject = vi.fn(),
      sleep = vi.fn();
    await expect(
      completeUploadedVideo({ complete, getProject, signal: signal(), sleep }),
    ).rejects.toBe(error);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(getProject).not.toHaveBeenCalled();
    expect(sleep).not.toHaveBeenCalled();
  });
  it("retoma COMPLETED consultando o projeto antes de repetir complete", async () => {
    const calls: string[] = [];
    expect(
      await completeUploadedVideo({
        alreadyCompleted: true,
        signal: signal(),
        getProject: async () => {
          calls.push("GET");
          return project;
        },
        complete: async () => {
          calls.push("complete");
          return queued;
        },
      }),
    ).toEqual({ kind: "success", project: queued });
    expect(calls).toEqual(["GET", "complete"]);
  });
  it("retoma COMPLETED seguindo direto para um projeto que já entrou na fila", async () => {
    const complete = vi.fn();
    expect(
      await completeUploadedVideo({
        alreadyCompleted: true,
        signal: signal(),
        complete,
        getProject: async () => queued,
      }),
    ).toEqual({ kind: "success", project: queued });
    expect(complete).not.toHaveBeenCalled();
  });
  it("interrompe tentativas quando o sinal é cancelado durante a espera", async () => {
    const controller = new AbortController();
    const complete = vi.fn().mockRejectedValue(unavailable);
    await expect(
      completeUploadedVideo({
        complete,
        getProject: async () => project,
        signal: controller.signal,
        sleep: async () => controller.abort(),
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(complete).toHaveBeenCalledTimes(1);
  });
});
