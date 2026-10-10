"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Clock,
  FileVideo,
  SpinnerGap,
  UploadSimple,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { api } from "@/trpc/react";
import {
  abortCreatedUploadIfCancelled,
  multipartUpload,
  sameFile,
  validateResume,
  validateUploadOptions,
  type StoredUpload,
} from "./upload";
import { type ProjectOptionsInput } from "@/server/league-clips/contracts";
import {
  completeUploadedVideo,
  uploadCompletionPendingMessage,
} from "./upload-completion";

const STORAGE_KEY = "ai-clips-pending-upload";
export function UploadControl({
  options,
  projectId,
  onRunningChange,
  onOptionsError,
  configuration,
}: {
  options?: ProjectOptionsInput;
  projectId?: string;
  onRunningChange?: (running: boolean) => void;
  onOptionsError?: (field: string | undefined) => void;
  configuration?: (resuming: boolean) => ReactNode;
}) {
  const router = useRouter(),
    utils = api.useUtils();
  const [file, setFile] = useState<File | null>(null),
    [duration, setDuration] = useState<number | null>(null),
    [metadataError, setMetadataError] = useState(false),
    [progress, setProgress] = useState(0),
    [partsProgress, setPartsProgress] = useState<Record<number, number>>({}),
    [partSize, setPartSize] = useState(0),
    [running, setRunning] = useState(false),
    [cancelling, setCancelling] = useState(false),
    [completing, setCompleting] = useState(false),
    [completionPending, setCompletionPending] = useState(false),
    [discarding, setDiscarding] = useState(false),
    [dragging, setDragging] = useState(false),
    [resume, setResume] = useState<StoredUpload | null>(null);
  const inputId = useId();
  const controller = useRef<AbortController | null>(null),
    activeUpload = useRef<string | null>(null),
    canceling = useRef(false),
    cancelPromise = useRef<Promise<void> | null>(null),
    cancelSucceeded = useRef(false),
    completingRef = useRef(false),
    runningRef = useRef(false),
    discardingRef = useRef(false),
    inputRef = useRef<HTMLInputElement | null>(null),
    dragDepth = useRef(0);
  const create = api.leagueClips.createUpload.useMutation(),
    parts = api.leagueClips.uploadParts.useMutation(),
    complete = api.leagueClips.completeUpload.useMutation(),
    abort = api.leagueClips.abortUpload.useMutation();
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setResume(JSON.parse(raw) as StoredUpload);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (running) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);
  useEffect(() => {
    if (!file) {
      setDuration(null);
      return;
    }
    setDuration(null);
    setMetadataError(false);
    const url = URL.createObjectURL(file),
      video = document.createElement("video");
    let current = true;
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      if (!current) return;
      setDuration(Number.isFinite(video.duration) ? video.duration : null);
      setMetadataError(!Number.isFinite(video.duration));
      URL.revokeObjectURL(url);
    };
    video.onerror = () => {
      if (!current) return;
      setMetadataError(true);
      URL.revokeObjectURL(url);
    };
    video.src = url;
    return () => {
      current = false;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
  }, [file]);
  const matchesResume = !!(
    file &&
    resume &&
    sameFile(file, resume) &&
    (!projectId || resume.projectId === projectId)
  );
  const fileError = !file
    ? null
    : !file.type.startsWith("video/")
      ? "Escolha um arquivo de vídeo."
      : file.size === 0
        ? "Este arquivo está vazio. Escolha outro vídeo."
        : file.size > 4 * 1024 ** 3
          ? "O arquivo deve ter até 4 GB."
          : duration !== null && (duration < 5 || duration > 7200)
            ? "O vídeo deve ter entre 5 segundos e 2 horas."
            : null;
  function selectFile(next: File | null) {
    if (runningRef.current || discardingRef.current) return;
    setFile(next);
    setDuration(null);
    setMetadataError(false);
    setProgress(0);
    setPartsProgress({});
  }
  async function start() {
    if (!file || runningRef.current || discardingRef.current) return;
    if (resume && !matchesResume) {
      toast.error(
        "Escolha o mesmo arquivo para retomar ou descarte o envio salvo antes de enviar outro vídeo.",
      );
      return;
    }
    if (!file.type.startsWith("video/")) {
      toast.error("Escolha um arquivo de vídeo.");
      return;
    }
    if (file.size === 0 || file.size > 4 * 1024 ** 3) {
      toast.error(
        file.size === 0
          ? "Este arquivo está vazio."
          : "O arquivo ultrapassa 4 GB.",
      );
      return;
    }
    if (duration !== null && (duration < 5 || duration > 7200)) {
      toast.error("O vídeo deve ter entre 5 segundos e 2 horas.");
      return;
    }
    const parsedOptions = validateUploadOptions(
      projectId ? undefined : options,
    );
    if (!parsedOptions.ok) {
      onOptionsError?.(parsedOptions.field);
      toast.error(parsedOptions.message);
      return;
    }
    const signal = new AbortController();
    controller.current = signal;
    canceling.current = false;
    cancelPromise.current = null;
    cancelSucceeded.current = false;
    runningRef.current = true;
    setCompletionPending(false);
    setRunning(true);
    onRunningChange?.(true);
    try {
      let stored =
        resume &&
        sameFile(file, resume) &&
        (!projectId || resume.projectId === projectId)
          ? resume
          : null;
      let session: {
        uploadId: string;
        partSizeBytes: number;
        partCount: number;
      };
      let completedParts: { partNumber: number; etag: string }[] = [];
      let alreadyCompleted = false;
      if (stored) {
        activeUpload.current = stored.uploadId;
        await utils.leagueClips.upload.invalidate({ id: stored.uploadId });
        const current = await utils.leagueClips.upload.fetch({
          id: stored.uploadId,
        });
        completedParts = validateResume(file, stored, current, projectId);
        alreadyCompleted = current.status === "COMPLETED";
        if (alreadyCompleted) {
          completingRef.current = true;
          setCompleting(true);
          setProgress(100);
        }
        if (signal.signal.aborted)
          throw new DOMException("Upload cancelado", "AbortError");
        session = current;
      }
      if (!stored) {
        const created = await create.mutateAsync({
          fileName: file.name,
          sizeBytes: file.size,
          contentType: file.type,
          projectId,
          options: parsedOptions.options,
        });
        session = created;
        stored = {
          uploadId: created.uploadId,
          projectId: created.projectId,
          name: file.name,
          size: file.size,
          lastModified: file.lastModified,
          parts: [],
        };
        setResume(stored);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        try {
          if (
            await abortCreatedUploadIfCancelled(
              signal.signal,
              created.uploadId,
              (id) => abort.mutateAsync({ id }),
            )
          ) {
            cancelSucceeded.current = true;
            throw new DOMException("Upload cancelado", "AbortError");
          }
        } catch (error) {
          if (
            !(error instanceof DOMException && error.name === "AbortError") &&
            signal.signal.aborted
          )
            toast.error(
              "Não foi possível excluir o envio; ele ficou salvo para retomada.",
            );
          throw error;
        }
      }
      activeUpload.current = session!.uploadId;
      setPartSize(session!.partSizeBytes);
      const all = alreadyCompleted
        ? completedParts
        : await multipartUpload({
            file,
            uploadId: session!.uploadId,
            partSizeBytes: session!.partSizeBytes,
            partCount: session!.partCount,
            completed: completedParts,
            signal: signal.signal,
            getUrl: async (n) => {
              const response = await parts.mutateAsync({
                id: session!.uploadId,
                partNumbers: [n],
              });
              return response.parts[0]!.url;
            },
            onProgress: (total, partValues) => {
              setProgress(total);
              setPartsProgress(partValues);
            },
            onPart: (p) => {
              stored!.parts = stored!.parts
                .filter((x) => x.partNumber !== p.partNumber)
                .concat(p);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
            },
          });
      if (signal.signal.aborted)
        throw new DOMException("Upload cancelado", "AbortError");
      completingRef.current = true;
      setCompleting(true);
      stored!.parts = all;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      const result = await completeUploadedVideo({
        complete: () =>
          complete.mutateAsync({
            id: session!.uploadId,
            parts: all,
          }),
        getProject: () =>
          utils.leagueClips.project.fetch(
            { id: stored!.projectId },
            { staleTime: 0 },
          ),
        signal: signal.signal,
        alreadyCompleted,
      });
      if (result.kind === "pending") {
        setCompletionPending(true);
        toast.info(uploadCompletionPendingMessage);
        return;
      }
      localStorage.removeItem(STORAGE_KEY);
      setResume(null);
      await utils.leagueClips.list.invalidate();
      router.push("/ai-clips/" + result.project.id);
    } catch (error) {
      const cancelled = signal.signal.aborted;
      signal.abort();
      if (!cancelled)
        toast.error(
          error instanceof Error
            ? error.message
            : "Falha no upload. Escolha o mesmo arquivo para retomar.",
        );
    } finally {
      await Promise.resolve(cancelPromise.current);
      if (cancelSucceeded.current) {
        localStorage.removeItem(STORAGE_KEY);
        setResume(null);
        setProgress(0);
      }
      setRunning(false);
      runningRef.current = false;
      setCancelling(false);
      completingRef.current = false;
      setCompleting(false);
      onRunningChange?.(false);
      activeUpload.current = null;
      controller.current = null;
      canceling.current = false;
      cancelPromise.current = null;
    }
  }
  async function discardSaved() {
    if (!resume || discardingRef.current || runningRef.current) return;
    discardingRef.current = true;
    setDiscarding(true);
    try {
      await abort.mutateAsync({ id: resume.uploadId });
      localStorage.removeItem(STORAGE_KEY);
      setResume(null);
      setProgress(0);
      setPartsProgress({});
      toast.info("Envio salvo descartado.");
    } catch {
      toast.error(
        "Não foi possível descartar o envio. Tente novamente; ele continua salvo para retomada.",
      );
    } finally {
      discardingRef.current = false;
      setDiscarding(false);
    }
  }
  async function cancel() {
    if (canceling.current || completingRef.current) return;
    canceling.current = true;
    setCancelling(true);
    controller.current?.abort();
    const id = activeUpload.current;
    if (id) {
      cancelPromise.current = abort
        .mutateAsync({ id })
        .then(() => {
          cancelSucceeded.current = true;
          toast.info("Envio cancelado.");
        })
        .catch(() => {
          toast.error(
            "Não foi possível excluir o envio; ele ficou salvo para retomada.",
          );
        });
      await cancelPromise.current;
    }
  }
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-sm font-medium">Arquivo de vídeo</p>
        <Input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="video/*"
          className="hidden"
          disabled={running || discarding}
          aria-label="Escolher arquivo de vídeo"
          aria-invalid={!!fileError}
          onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          disabled={running || discarding}
          aria-describedby={
            inputId + "-help" + (fileError ? " " + inputId + "-error" : "")
          }
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => {
            if (
              runningRef.current ||
              discardingRef.current ||
              !event.dataTransfer.types.includes("Files")
            )
              return;
            event.preventDefault();
            dragDepth.current += 1;
            setDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (!dragDepth.current) setDragging(false);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect =
              running || discarding ? "none" : "copy";
          }}
          onDrop={(event) => {
            event.preventDefault();
            dragDepth.current = 0;
            setDragging(false);
            if (runningRef.current || discardingRef.current) return;
            const next = event.dataTransfer.files[0];
            if (next) selectFile(next);
            if (event.dataTransfer.files.length > 1)
              toast.info(
                "Um vídeo por projeto. O primeiro arquivo foi selecionado.",
              );
          }}
          className={
            "focus-visible:ring-ring flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default disabled:opacity-70 sm:py-8 " +
            (fileError
              ? "border-destructive/50 bg-destructive/5"
              : dragging
                ? "border-primary bg-primary/10"
                : "border-primary/25 bg-primary/5 hover:border-primary/60 hover:bg-primary/10")
          }
        >
          <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
            {file ? (
              <FileVideo className="size-6" aria-hidden="true" />
            ) : (
              <UploadSimple className="size-6" aria-hidden="true" />
            )}
          </span>
          <span className="w-full min-w-0">
            <span
              className="block truncate text-sm font-semibold"
              title={file?.name}
            >
              {file?.name ??
                (dragging
                  ? "Solte o vídeo aqui"
                  : "Arraste seu vídeo ou escolha um arquivo")}
            </span>
            <span className="text-muted-foreground mt-1 block text-xs">
              {file
                ? running
                  ? "Envio em andamento"
                  : "Clique para trocar o arquivo"
                : "Até 4 GB · Vídeos de 5 segundos a 2 horas"}
            </span>
          </span>
        </button>
        <p id={inputId + "-help"} className="sr-only">
          Escolha um arquivo de vídeo de até 4 GB, com duração entre 5 segundos
          e 2 horas.
        </p>
        {fileError && (
          <p
            id={inputId + "-error"}
            role="alert"
            className="text-destructive text-sm"
          >
            {fileError}
          </p>
        )}
        {file && (
          <div
            className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-xs"
            aria-live="polite"
          >
            <span className="inline-flex items-center gap-1.5">
              <FileVideo className="size-4" aria-hidden="true" />
              {fileSizeLabel(file.size)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden="true" />
              {duration === null
                ? metadataError
                  ? "A duração será verificada após o envio"
                  : "Lendo duração…"
                : durationLabel(duration)}
            </span>
          </div>
        )}
      </div>
      {resume && !running && (
        <div
          className="bg-muted/40 rounded-xl border p-4 text-sm"
          role="status"
        >
          <p className="font-medium">
            {matchesResume
              ? "Pronto para retomar seu envio"
              : "Você tem um envio salvo"}
          </p>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed break-words">
            {resume.name} · {fileSizeLabel(resume.size)}
            {projectId && resume.projectId !== projectId
              ? ". Este envio pertence a outro projeto. Descarte-o para enviar o vídeo deste projeto."
              : matchesResume
                ? ". As partes já enviadas serão reaproveitadas. As preferências do envio original são mantidas."
                : ". Escolha exatamente o mesmo arquivo para continuar. Para enviar outro vídeo, descarte o envio salvo."}
          </p>
        </div>
      )}
      {completionPending && !running && (
        <p role="status" className="text-muted-foreground text-sm">
          {uploadCompletionPendingMessage}
        </p>
      )}
      {configuration?.(!!resume)}
      {running && (
        <div className="bg-background/50 space-y-3 rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span
              className="flex items-center gap-2 font-medium"
              aria-live="polite"
            >
              <SpinnerGap
                className="text-primary size-4 motion-safe:animate-spin"
                aria-hidden="true"
              />
              {cancelling
                ? "Cancelando envio…"
                : completing
                  ? "Finalizando o envio…"
                  : "Enviando seu vídeo"}
            </span>
            <span className="font-medium tabular-nums">
              {Math.round(progress)}%
            </span>
          </div>
          <Progress
            value={progress}
            aria-label="Progresso do envio do vídeo"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={Math.round(progress) + "% enviado"}
          />
          <p className="text-muted-foreground text-xs leading-relaxed">
            {completing
              ? "O arquivo foi enviado. Estamos confirmando o recebimento para iniciar o projeto."
              : "Mantenha esta página aberta durante o envio. Se a conexão cair, selecione o mesmo arquivo para retomar."}
          </p>
          {Object.keys(partsProgress).length > 0 && (
            <details className="text-muted-foreground text-xs">
              <summary className="focus-visible:ring-ring w-fit cursor-pointer rounded py-1 focus-visible:ring-2 focus-visible:outline-none">
                Detalhes do envio
              </summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {Object.entries(partsProgress).map(([part, bytes]) => (
                  <span key={part}>
                    Parte {part}:{" "}
                    {partSize && file
                      ? Math.round(
                          (bytes /
                            Math.min(
                              partSize,
                              file.size - (Number(part) - 1) * partSize,
                            )) *
                            100,
                        )
                      : 0}
                    %
                  </span>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
      <div className="flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground max-w-xs text-xs leading-relaxed">
          {duration !== null && !fileError
            ? "Estimativa: " +
              Math.ceil(duration / 60) +
              " créditos. O consumo final depende da análise do vídeo."
            : "A estimativa de créditos aparece após a análise inicial do vídeo."}
        </p>
        <div className="flex flex-col gap-2 sm:items-end">
          <Button
            type="button"
            className="h-11 gap-2 rounded-xl px-5"
            disabled={
              !file ||
              running ||
              discarding ||
              !!fileError ||
              (!!resume && !matchesResume)
            }
            onClick={start}
          >
            {running ? (
              <SpinnerGap
                className="size-4 motion-safe:animate-spin"
                aria-hidden="true"
              />
            ) : (
              <UploadSimple className="size-4" aria-hidden="true" />
            )}
            {cancelling
              ? "Cancelando…"
              : completing
                ? "Finalizando…"
                : running
                  ? "Enviando vídeo…"
                  : matchesResume
                    ? "Retomar envio"
                    : "Enviar e gerar clipes"}
            {!running && <ArrowRight className="size-4" aria-hidden="true" />}
          </Button>
          {running && (
            <Button
              type="button"
              variant="ghost"
              onClick={cancel}
              disabled={cancelling || completing}
              className="h-8 text-xs"
            >
              {cancelling ? "Cancelando…" : "Cancelar envio"}
            </Button>
          )}
          {resume && !running && (
            <Button
              type="button"
              variant="ghost"
              onClick={discardSaved}
              disabled={discarding}
              className="text-muted-foreground h-8 text-xs"
            >
              {discarding && (
                <SpinnerGap
                  className="size-3 motion-safe:animate-spin"
                  aria-hidden="true"
                />
              )}
              {discarding ? "Descartando…" : "Descartar envio salvo"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function fileSizeLabel(bytes: number) {
  return bytes >= 1024 ** 3
    ? (bytes / 1024 ** 3).toFixed(2) + " GB"
    : (bytes / 1024 ** 2).toFixed(1) + " MB";
}
function durationLabel(seconds: number) {
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remaining = rounded % 60;
  return (
    (hours ? hours + ":" + String(minutes).padStart(2, "0") : String(minutes)) +
    ":" +
    String(remaining).padStart(2, "0")
  );
}
