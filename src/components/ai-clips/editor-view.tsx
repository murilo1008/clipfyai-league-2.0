"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  FloppyDisk,
  MagnifyingGlass,
  Palette,
  Play,
  Scissors,
  SpinnerGap,
  Subtitles,
  TextT,
  VideoCamera,
  WarningCircle,
} from "@phosphor-icons/react";
import { toast, type ExternalToast } from "sonner";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ErrorPanel, formatDuration, PageHeader } from "./shared";
import { msToTime, timeToMs, validateCut } from "./editor-time";
import {
  leagueCode,
  waitingForClipVersion,
  waitingForRender,
} from "./async-state";
import { layoutLabels } from "./labels";
import { displayTemplateKey, fallbackTemplateOption } from "./brand-kit-utils";
import { renderStatusLabel } from "./render-assets";
import { useClipDownloads, usePageVisible } from "./use-clip-downloads";
import { Mp4DownloadButton } from "./mp4-download-button";
import { clipExportMessage } from "./export-downloads";
import {
  captionChanges,
  invalidCaptionChange,
  canApplyTranscriptVersion,
  canRenderTranscriptVersion,
  transcriptVersionError,
  type EditableWord,
} from "./caption-edits";
import {
  CLIP_DURATION_FLOOR_MS,
  CLIP_DURATION_CEILING_MS,
  captionStyleSchema,
  type Clip,
} from "@/server/league-clips/contracts";
import { previewCaptionStyle } from "./caption-preview-utils";
import {
  applyIntroTitlePatch,
  clipIntroTitlePayload,
  formatIntroSeconds,
  introTitleAppearance,
  introTitleForSubmit,
  introTitleIssues,
  introTitlePhase,
  resolveIntroTitle,
  type IntroTitleKey,
  type IntroTitlePatch,
} from "./intro-title";
import {
  focusIntroTitleField,
  IntroTitleControls,
} from "./intro-title-controls";
import { VideoIntroTitleOverlay } from "./intro-title-overlay";

const introIdPrefix = "clip-intro";

const editorToastOptions = { position: "top-right" } satisfies ExternalToast;

export function EditorView({
  projectId,
  clipId,
}: {
  projectId: string;
  clipId: string;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const visible = usePageVisible();
  const project = api.leagueClips.project.useQuery({ id: projectId });
  const [expectedVersion, setExpectedVersion] = useState<number | null>(null);
  const [originalRenderIds, setOriginalRenderIds] = useState<string[] | null>(
    null,
  );
  const [watchUntil, setWatchUntil] = useState(0);
  const clip = api.leagueClips.clip.useQuery(
    { id: clipId },
    {
      refetchInterval: (q) =>
        !visible
          ? false
          : q.state.data &&
              ((watchUntil > Date.now() && !q.state.data.lastError) ||
                waitingForClipVersion(
                  q.state.data.version,
                  expectedVersion,
                  !!q.state.data.lastError,
                ) ||
                waitingForRender(
                  q.state.data.renders.map((r) => r.id),
                  originalRenderIds,
                  !!q.state.data.lastError,
                ))
            ? 3000
            : q.state.data?.renders.some(
                  (r) => r.status === "QUEUED" || r.status === "RENDERING",
                )
              ? 3000
              : false,
    },
  );
  const mp4Downloads = useClipDownloads(clip.data ? [clip.data] : []);
  useEffect(() => {
    if (clip.data?.lastError) {
      setExpectedVersion(null);
      setOriginalRenderIds(null);
    } else if (
      clip.data &&
      expectedVersion !== null &&
      clip.data.version >= expectedVersion
    )
      setExpectedVersion(null);
    if (
      clip.data &&
      originalRenderIds &&
      !waitingForRender(
        clip.data.renders.map((r) => r.id),
        originalRenderIds,
        false,
      )
    )
      setOriginalRenderIds(null);
  }, [clip.data, expectedVersion, originalRenderIds]);
  const [transcriptExpectedVersion, setTranscriptExpectedVersion] = useState<
    number | null
  >(null);
  const [transcriptWatchUntil, setTranscriptWatchUntil] = useState(0);
  const targetTranscriptVersion =
    transcriptExpectedVersion ?? clip.data?.version ?? null;
  const transcript = api.leagueClips.transcript.useQuery(
    { id: clipId },
    {
      refetchInterval: (q) =>
        targetTranscriptVersion !== null &&
        !clip.data?.lastError &&
        (q.state.data?.clipVersion === null
          ? transcriptExpectedVersion !== null &&
            transcriptWatchUntil > Date.now()
          : (q.state.data?.clipVersion ?? -1) < targetTranscriptVersion)
          ? 3000
          : false,
    },
  );
  const templates = api.leagueClips.templates.useQuery();
  const patch = api.leagueClips.patch.useMutation(),
    render = api.leagueClips.render.useMutation();
  const synced = useRef<string | null>(null);
  const savedVersion = useRef<number | null>(null);
  const baselineVersion = useRef<number | null>(null);
  const attemptedVideoUrl = useRef<string | null>(null);
  const baselineWords = useRef<EditableWord[]>([]);
  const syncedTranscript = useRef<string | null>(null);
  const [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [title, setTitle] = useState(""),
    [template, setTemplate] = useState("default"),
    [layout, setLayout] = useState<Clip["layout"]>("AUTO"),
    [captions, setCaptions] = useState(true),
    [words, setWords] = useState<EditableWord[]>([]),
    [wordsDirty, setWordsDirty] = useState(false),
    [dirty, setDirty] = useState(false);
  const [introEdits, setIntroEdits] = useState<IntroTitlePatch>({});
  const [introReset, setIntroReset] = useState(false);
  const [videoTimeMs, setVideoTimeMs] = useState(0);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(
    null,
  );
  const [showIntroPreview, setShowIntroPreview] = useState(true);
  const [tab, setTab] = useState("cut");
  const [wordSearch, setWordSearch] = useState("");
  const [activeWordId, setActiveWordId] = useState<number | null>(null);
  const [conflictVersion, setConflictVersion] = useState<number | null>(null);
  const [leaveHref, setLeaveHref] = useState<string | null>(null);
  const [reloadDialogOpen, setReloadDialogOpen] = useState(false);
  useEffect(() => {
    if (!dirty && !patch.isPending) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirty, patch.isPending]);
  useEffect(() => {
    if (!clip.data) return;
    const key = clip.data.id + ":" + clip.data.version;
    if (synced.current === key) return;
    if (
      synced.current !== null &&
      dirty &&
      savedVersion.current !== clip.data.version
    ) {
      setConflictVersion(clip.data.version);
      return;
    }
    synced.current = key;
    baselineVersion.current = clip.data.version;
    savedVersion.current = null;
    setStart(msToTime(clip.data.startMs));
    setEnd(msToTime(clip.data.endMs));
    setTitle(clip.data.title);
    setTemplate(clip.data.captionTemplateKey);
    setLayout(clip.data.layout);
    setCaptions(clip.data.captionsEnabled);
    setIntroEdits({});
    setIntroReset(false);
    setDirty(false);
    setConflictVersion(null);
  }, [clip.data, dirty]);
  useEffect(() => {
    const data = transcript.data;
    if (!data) return;
    if (!canApplyTranscriptVersion(data.clipVersion, targetTranscriptVersion))
      return;
    if (
      dirty &&
      data.clipVersion !== null &&
      baselineVersion.current !== null &&
      data.clipVersion > baselineVersion.current &&
      data.clipVersion !== savedVersion.current
    )
      return;
    const key = data.transcriptId + ":" + data.clipVersion;
    if (syncedTranscript.current === key && transcriptExpectedVersion === null)
      return;
    if (wordsDirty && transcriptExpectedVersion === null) return;
    const loaded = data.words.map((word) => ({
      id: word.id,
      punctuatedText: word.punctuatedText,
      hidden: word.hidden === true,
      edited: word.edited,
      startMs: word.startMs,
      endMs: word.endMs,
    }));
    baselineWords.current = loaded;
    setWords(loaded);
    syncedTranscript.current = key;
    setWordsDirty(false);
    if (transcriptExpectedVersion !== null) setTranscriptExpectedVersion(null);
  }, [
    transcript.data,
    transcriptExpectedVersion,
    targetTranscriptVersion,
    wordsDirty,
    dirty,
  ]);
  useEffect(() => {
    if (clip.data?.lastError && transcriptExpectedVersion !== null) {
      setTranscriptExpectedVersion(null);
      setWordsDirty(false);
      syncedTranscript.current = null;
      void transcript.refetch();
    }
  }, [clip.data?.lastError, transcriptExpectedVersion, transcript]);
  if (project.isLoading || clip.isLoading)
    return (
      <main className="mx-auto max-w-6xl p-4 md:p-8">
        <Skeleton className="h-96 rounded-xl" />
      </main>
    );
  if (project.isError || clip.isError || !project.data || !clip.data)
    return (
      <main className="mx-auto max-w-6xl p-4 md:p-8">
        <ErrorPanel
          message={
            project.error?.message ??
            clip.error?.message ??
            "Clipe não encontrado."
          }
        />
      </main>
    );
  const p = project.data,
    c = clip.data;
  if (c.projectId !== p.id)
    return (
      <main className="mx-auto max-w-6xl p-4 md:p-8">
        <ErrorPanel message="Este clipe não pertence ao projeto." />
      </main>
    );
  if (p.status !== "COMPLETED" && p.status !== "COMPLETED_WITH_ERRORS")
    return (
      <main className="mx-auto max-w-6xl p-4 md:p-8">
        <ErrorPanel message="O editor fica disponível quando o projeto termina." />
      </main>
    );
  const current =
    c.renders.find((r) => r.version === c.version && r.status === "READY") ??
    c.renders.find((r) => r.status === "READY");
  const templateList = templates.data ?? [];
  const fallbackTemplate = fallbackTemplateOption(template, templateList);
  const selected = templates.data?.find(
    (t) => t.key === displayTemplateKey(template, templates.data ?? []),
  );
  const edit =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setDirty(true);
    };
  // Título de abertura: o efetivo vem do league; sem ele (league antigo), projeto ← corte sobre o padrão.
  const projectIntro = resolveIntroTitle(p.options.introTitle);
  const savedIntro = c.introTitleEffective
    ? resolveIntroTitle(c.introTitleEffective)
    : resolveIntroTitle(p.options.introTitle, c.introTitle);
  const introValue = resolveIntroTitle(
    applyIntroTitlePatch(introReset ? projectIntro : savedIntro, introEdits),
  );
  const introDirty = introReset || Object.keys(introEdits).length > 0;
  const introPayload = introTitleForSubmit(
    clipIntroTitlePayload(c.introTitle, introEdits, introReset),
  );
  const introIssues = introValue.enabled
    ? introTitleIssues(applyIntroTitlePatch(null, introEdits))
    : {};
  const introErrorKey = Object.keys(introIssues)[0] as
    | IntroTitleKey
    | undefined;
  const introError = introErrorKey ? introIssues[introErrorKey] : undefined;
  const hasClipIntro =
    !introReset && !!c.introTitle && Object.keys(c.introTitle).length > 0;
  const overrideStyle = captionStyleSchema
    .strip()
    .safeParse(c.styleOverrides ?? {});
  const captionStyle = previewCaptionStyle(selected, {
    captionStyle: overrideStyle.success ? overrideStyle.data : undefined,
  });
  const introAppearance = introTitleAppearance({
    settings: introValue,
    caption: captionStyle,
    templateUppercase: selected?.uppercase,
  });
  function changeIntro(patch: IntroTitlePatch) {
    setIntroEdits((previous) => ({ ...previous, ...patch }));
    setDirty(true);
  }
  function resetIntro() {
    setIntroReset(true);
    setIntroEdits({});
    setDirty(true);
  }
  async function save() {
    const a = timeToMs(start),
      b = timeToMs(end);
    if (a === null || b === null) {
      toast.error("Use timecodes no formato 00:00:00.000.", editorToastOptions);
      return;
    }
    const invalid = validateCut(a, b, p.source.durationMs);
    if (invalid) {
      toast.error(invalid, editorToastOptions);
      return;
    }
    if (!title.trim()) {
      toast.error("Informe um título.", editorToastOptions);
      return;
    }
    if (introError) {
      setTab("intro");
      toast.error(introError, editorToastOptions);
      window.setTimeout(
        () => focusIntroTitleField(introIdPrefix, introErrorKey),
        0,
      );
      return;
    }
    const changedWords = captionChanges(baselineWords.current, words);
    if (invalidCaptionChange(changedWords)) {
      toast.error(
        "A palavra alterada deve ter entre 1 e 64 caracteres.",
        editorToastOptions,
      );
      return;
    }
    try {
      const updated = await patch.mutateAsync({
        id: clipId,
        version: baselineVersion.current ?? c.version,
        changes: {
          startMs: a,
          endMs: b,
          title: title.trim(),
          captionTemplateKey: template,
          layout,
          captionsEnabled: captions,
          ...(changedWords.length ? { captionWords: changedWords } : {}),
          // Só com mudança: um league sem o recurso continua aceitando o PATCH de sempre.
          ...(introDirty ? { introTitle: introPayload } : {}),
        },
      });
      savedVersion.current = updated.version;
      setExpectedVersion(updated.version);
      setWatchUntil(Date.now() + 15000);
      if (changedWords.length) {
        setTranscriptExpectedVersion(updated.version);
        setTranscriptWatchUntil(Date.now() + 15000);
      }
      setWordsDirty(false);
      await Promise.all([
        utils.leagueClips.clip.invalidate({ id: clipId }),
        utils.leagueClips.clips.invalidate({ id: projectId }),
      ]);
      toast.success(
        "Alterações salvas. Gere a versão para atualizar o vídeo.",
        editorToastOptions,
      );
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Não foi possível salvar.";
      toast.error(msg, editorToastOptions);
      if (leagueCode(error) === "VERSION_CONFLICT") {
        setTranscriptExpectedVersion(null);
        await clip.refetch();
        await transcript.refetch();
      }
    }
  }
  async function startRender() {
    try {
      setOriginalRenderIds(c.renders.map((r) => r.id));
      setWatchUntil(Date.now() + 15000);
      await render.mutateAsync({
        id: clipId,
        aspectRatios: p.options.aspectRatios,
      });
      await clip.refetch();
      toast.success(
        "Geração iniciada. A prévia será atualizada quando terminar.",
        editorToastOptions,
      );
    } catch (e) {
      setOriginalRenderIds(null);
      toast.error(
        e instanceof Error ? e.message : "Não foi possível gerar o vídeo.",
        editorToastOptions,
      );
    }
  }
  const parsedStart = timeToMs(start),
    parsedEnd = timeToMs(end);
  const cutDuration =
    parsedStart !== null && parsedEnd !== null && parsedEnd > parsedStart
      ? parsedEnd - parsedStart
      : null;
  const cutError =
    parsedStart === null || parsedEnd === null
      ? "Use o formato 00:00:00.000 para os tempos."
      : validateCut(parsedStart, parsedEnd, p.source.durationMs);
  const confirming =
    expectedVersion !== null || transcriptExpectedVersion !== null;
  const generating =
    render.isPending ||
    originalRenderIds !== null ||
    c.renders.some(
      (item) =>
        item.version === c.version &&
        (item.status === "QUEUED" || item.status === "RENDERING"),
    );
  const editingLocked =
    patch.isPending || confirming || conflictVersion !== null;
  const transcriptReady =
    !transcript.isLoading &&
    !!transcript.data &&
    transcript.data.clipVersion !== null &&
    canApplyTranscriptVersion(
      transcript.data.clipVersion,
      targetTranscriptVersion,
    );
  const invalidWords = invalidCaptionChange(
    captionChanges(baselineWords.current, words),
  );
  const saveValidationError =
    cutError ??
    (!title.trim()
      ? "Informe um título para salvar o clipe."
      : invalidWords
        ? "Cada palavra alterada precisa ter entre 1 e 64 caracteres."
        : (introError ?? null));
  const saveDisabled =
    !dirty ||
    editingLocked ||
    !transcriptReady ||
    !!cutError ||
    !title.trim() ||
    invalidWords ||
    !!introError;
  const generateDisabled =
    dirty ||
    confirming ||
    generating ||
    patch.isPending ||
    conflictVersion !== null ||
    !canRenderTranscriptVersion(
      transcript.data?.clipVersion,
      c.version,
      transcriptExpectedVersion !== null,
    );
  const query = wordSearch.trim().toLocaleLowerCase("pt-BR");
  const visibleWords = words.filter((word) =>
    word.punctuatedText.toLocaleLowerCase("pt-BR").includes(query),
  );
  const activeWord = words.find((word) => word.id === activeWordId);
  const hiddenWordCount = words.filter((word) => word.hidden).length;
  const currentVideoReady = current?.version === c.version;
  const actionStatus =
    conflictVersion !== null
      ? "Há uma versão mais recente"
      : patch.isPending
        ? "Salvando alterações…"
        : confirming
          ? "Confirmando alterações salvas…"
          : dirty && saveValidationError
            ? "Revise antes de salvar"
            : dirty
              ? "Alterações pendentes"
              : generating
                ? "Gerando vídeo…"
                : !transcriptReady
                  ? "Aguardando texto das legendas"
                  : currentVideoReady
                    ? "Versão atual pronta"
                    : "Alterações salvas";
  const actionDetail =
    conflictVersion !== null
      ? "Seu rascunho está preservado. Revise o aviso acima."
      : patch.isPending || confirming
        ? "Aguarde para continuar a edição."
        : dirty && saveValidationError
          ? saveValidationError
          : dirty
            ? "Salve antes de gerar a nova versão."
            : generating
              ? "Você pode acompanhar a geração nesta tela."
              : !transcriptReady
                ? "A confirmação das legendas libera as ações do clipe."
                : currentVideoReady
                  ? "A prévia já mostra a última versão salva."
                  : "Gere a versão para aplicar as edições ao vídeo.";

  function updateWord(id: number, changes: Partial<EditableWord>) {
    setWords((previous) =>
      previous.map((word) => (word.id === id ? { ...word, ...changes } : word)),
    );
    setWordsDirty(true);
    setDirty(true);
  }

  function reloadCurrentVersion() {
    synced.current = null;
    syncedTranscript.current = null;
    savedVersion.current = null;
    setConflictVersion(null);
    setWordsDirty(false);
    setDirty(false);
    setActiveWordId(null);
    void clip.refetch();
    void transcript.refetch();
  }

  return (
    <main
      className="mx-auto max-w-7xl p-4 pb-8 md:p-8"
      onClickCapture={(event) => {
        if ((!dirty && !patch.isPending) || event.defaultPrevented) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;
        const anchor =
          event.target instanceof Element
            ? event.target.closest<HTMLAnchorElement>("a[href]")
            : null;
        const href = anchor?.getAttribute("href");
        if (href?.startsWith("/") && anchor?.target !== "_blank") {
          event.preventDefault();
          setLeaveHref(href);
        }
      }}
    >
      <PageHeader
        title="Editar clipe"
        description="Refine o corte, ajuste as legendas e gere a versão final."
      >
        <Button asChild variant="outline" className="gap-2">
          <Link href={"/ai-clips/" + projectId}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Voltar ao projeto
          </Link>
        </Button>
      </PageHeader>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant="outline">Versão {c.version}</Badge>
        <Badge variant="secondary" className="max-w-full truncate">
          {c.title}
        </Badge>
        {cutDuration !== null && (
          <span className="text-muted-foreground text-xs">
            {formatDuration(cutDuration)} de duração
          </span>
        )}
      </div>
      {c.lastError && (
        <div className="mb-6">
          <ErrorPanel message={clipExportMessage(c) ?? c.lastError.message} />
        </div>
      )}
      {conflictVersion !== null && (
        <div
          role="alert"
          className="bg-accent/50 mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5"
        >
          <div className="flex items-start gap-3">
            <WarningCircle
              className="text-primary mt-0.5 size-5 shrink-0"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium">
                A versão {conflictVersion} foi salva em outra sessão.
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                Seu rascunho foi preservado. Carregue a versão atual para
                continuar a edição.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setReloadDialogOpen(true)}>
            Carregar versão atual
          </Button>
        </div>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <aside className="lg:sticky lg:top-20 lg:order-2">
          <Card className="overflow-hidden rounded-2xl py-0 shadow-sm lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
            <CardHeader className="border-b px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <VideoCamera
                    className="text-primary size-5"
                    aria-hidden="true"
                  />
                  Prévia do clipe
                </CardTitle>
                <Badge variant="outline">
                  {current ? current.aspectRatio : "Vídeo"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div
                className="relative mx-auto w-full max-w-[260px] overflow-hidden rounded-xl bg-[#020a14] shadow-lg"
                style={{
                  aspectRatio: current?.aspectRatio.replace(":", "/") ?? "9/16",
                }}
              >
                {current?.videoUrl ? (
                  <video
                    ref={setVideoElement}
                    className="h-full w-full object-contain"
                    controls
                    playsInline
                    preload="metadata"
                    aria-label={"Prévia do clipe: " + c.title}
                    src={current.videoUrl}
                    poster={current.thumbnailUrl ?? undefined}
                    onLoadedMetadata={(event) =>
                      setVideoTimeMs(event.currentTarget.currentTime * 1000)
                    }
                    onTimeUpdate={(event) =>
                      setVideoTimeMs(event.currentTarget.currentTime * 1000)
                    }
                    onSeeked={(event) =>
                      setVideoTimeMs(event.currentTarget.currentTime * 1000)
                    }
                    onError={() => {
                      if (attemptedVideoUrl.current !== current.videoUrl) {
                        attemptedVideoUrl.current = current.videoUrl;
                        void utils.leagueClips.clip.invalidate({ id: clipId });
                      }
                    }}
                  />
                ) : (
                  <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 px-6 text-center text-white">
                    {generating ? (
                      <SpinnerGap
                        className="size-9 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    ) : (
                      <VideoCamera className="size-9" aria-hidden="true" />
                    )}
                    <p className="text-sm">
                      {generating
                        ? "Preparando sua prévia…"
                        : "Gere o vídeo para visualizar este clipe."}
                    </p>
                  </div>
                )}
                {showIntroPreview && (
                  <VideoIntroTitleOverlay
                    video={current?.videoUrl ? videoElement : null}
                    text={title.trim() || c.title}
                    settings={introValue}
                    appearance={introAppearance}
                    aspect={current?.aspectRatio ?? "9:16"}
                    caption={captionStyle}
                    timeMs={videoTimeMs}
                    clipDurationMs={cutDuration ?? c.durationMs}
                    className="z-10"
                  />
                )}
                {captions &&
                  words.some((word) => !word.hidden) &&
                  !(
                    showIntroPreview &&
                    introTitlePhase(
                      videoTimeMs,
                      introValue,
                      cutDuration ?? c.durationMs,
                    ).captionsHidden
                  ) && (
                    <div
                      aria-label="Amostra do estilo da legenda"
                      className="pointer-events-none absolute right-3 bottom-16 left-3 rounded-lg bg-black/70 px-3 py-2 text-center text-sm font-bold shadow-lg"
                      style={{ color: selected?.colors.text ?? "#ffffff" }}
                    >
                      {words
                        .filter((word) => !word.hidden)
                        .slice(0, 4)
                        .map((word, index) => (
                          <span
                            key={word.id}
                            style={{
                              color:
                                index === 1
                                  ? selected?.colors.highlight
                                  : undefined,
                            }}
                          >
                            {word.punctuatedText}{" "}
                          </span>
                        ))}
                    </div>
                  )}
              </div>
              <div className="bg-muted/50 rounded-xl p-3 text-xs leading-relaxed">
                <p className="font-medium">
                  {generating
                    ? "Gerando a versão " + c.version
                    : current
                      ? "Vídeo da versão " + current.version
                      : "Prévia ainda indisponível"}
                </p>
                <p className="text-muted-foreground mt-1">
                  {dirty || !currentVideoReady
                    ? "O vídeo mantém a última versão gerada. Salve e gere novamente para ver os ajustes finais."
                    : "O vídeo corresponde à versão salva. A amostra de legenda sobreposta demonstra o estilo escolhido."}
                </p>
                {captions && (
                  <p className="text-muted-foreground mt-1">
                    A amostra de legenda é aproximada; o resultado final aparece
                    após a geração.
                  </p>
                )}
                {introValue.enabled && (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p
                      className="text-muted-foreground"
                      id="intro-preview-help"
                    >
                      {showIntroPreview
                        ? "A faixa do título aparece nos primeiros " +
                          formatIntroSeconds(introValue.durationMs) +
                          " do vídeo, como prévia aproximada."
                        : "Prévia do título de abertura oculta."}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      aria-pressed={showIntroPreview}
                      aria-describedby="intro-preview-help"
                      onClick={() => setShowIntroPreview((value) => !value)}
                    >
                      {showIntroPreview ? "Ocultar prévia" : "Mostrar prévia"}
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {c.renders
                  .filter((r) => r.status === "READY" && r.videoUrl)
                  .map((r) => (
                    <Mp4DownloadButton
                      key={r.id}
                      render={r}
                      clipVersion={c.version}
                      state={mp4Downloads.state(c, r)}
                      onDownload={() => void mp4Downloads.request(c, r)}
                    />
                  ))}
              </div>
              {c.renders.length > 0 && (
                <details className="border-t pt-3">
                  <summary className="text-muted-foreground focus-visible:ring-ring cursor-pointer rounded text-xs font-medium focus-visible:ring-2 focus-visible:outline-none">
                    Histórico de versões ({c.renders.length})
                  </summary>
                  <ul className="mt-3 max-h-44 space-y-2 overflow-y-auto text-xs">
                    {c.renders.map((item) => (
                      <li
                        key={item.id}
                        className="bg-muted/40 rounded-lg p-2.5"
                      >
                        <p className="font-medium">
                          Versão {item.version} · {item.aspectRatio}
                        </p>
                        <p className="text-muted-foreground mt-1">
                          {renderStatusLabel(item, c.renders, c.version)
                            .replace("Renderizando", "Gerando vídeo")
                            .replace(
                              "novo render falhou",
                              "nova geração falhou",
                            )
                            .replace(
                              "edições não renderizadas",
                              "edições ainda não aplicadas",
                            )}
                        </p>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </CardContent>
          </Card>
        </aside>
        <Card className="min-w-0 gap-0 overflow-hidden rounded-2xl py-0 shadow-sm lg:order-1">
          <Tabs value={tab} onValueChange={setTab} className="gap-0">
            <CardHeader className="gap-4 border-b px-4 py-5 sm:px-6">
              <div>
                <CardTitle className="text-lg">Ajuste seu clipe</CardTitle>
                <p className="text-muted-foreground mt-1 text-sm">
                  Comece pelo trecho e personalize o resultado.
                </p>
              </div>
              <TabsList
                className="grid h-auto w-full grid-cols-2 p-1 sm:grid-cols-4"
                aria-label="Ajustes do clipe"
              >
                <TabsTrigger value="cut" className="gap-2 py-2.5">
                  <Scissors className="size-4" aria-hidden="true" />
                  Corte
                </TabsTrigger>
                <TabsTrigger value="style" className="gap-2 py-2.5">
                  <Palette className="size-4" aria-hidden="true" />
                  Estilo
                </TabsTrigger>
                <TabsTrigger value="intro" className="gap-2 py-2.5">
                  <TextT className="size-4" aria-hidden="true" />
                  Abertura
                </TabsTrigger>
                <TabsTrigger value="text" className="gap-2 py-2.5">
                  <Subtitles className="size-4" aria-hidden="true" />
                  Texto
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            <TabsContent value="cut" className="p-4 sm:p-6">
              <fieldset disabled={editingLocked} className="space-y-6">
                <legend className="sr-only">Trecho e título do clipe</legend>
                <div className="space-y-2">
                  <Label htmlFor="clip-title">Título do clipe</Label>
                  <Input
                    id="clip-title"
                    maxLength={300}
                    value={title}
                    className="h-11"
                    onChange={(event) => edit(setTitle)(event.target.value)}
                    aria-describedby="clip-title-help"
                  />
                  <p
                    id="clip-title-help"
                    className="text-muted-foreground text-xs"
                  >
                    Um título claro ajuda a identificar este corte no projeto.
                  </p>
                </div>
                <div className="space-y-4">
                  <div>
                    <h2 className="text-sm font-medium">
                      Trecho do vídeo original
                    </h2>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Defina os pontos de início e fim no vídeo de origem.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="start">Início</Label>
                      <Input
                        id="start"
                        value={start}
                        placeholder="00:00:00.000"
                        className="h-11 font-mono text-sm tabular-nums"
                        onChange={(event) => edit(setStart)(event.target.value)}
                        aria-describedby="cut-help cut-duration"
                        aria-invalid={!!cutError}
                        spellCheck={false}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end">Fim</Label>
                      <Input
                        id="end"
                        value={end}
                        placeholder="00:01:00.000"
                        className="h-11 font-mono text-sm tabular-nums"
                        onChange={(event) => edit(setEnd)(event.target.value)}
                        aria-describedby="cut-help cut-duration"
                        aria-invalid={!!cutError}
                        spellCheck={false}
                      />
                    </div>
                  </div>
                  <p id="cut-help" className="text-muted-foreground text-xs">
                    Formato: horas:minutos:segundos.milissegundos.
                    {p.source.durationMs
                      ? " Vídeo original: " +
                        formatDuration(p.source.durationMs) +
                        "."
                      : ""}
                  </p>
                  <div
                    id="cut-duration"
                    className="border-primary/15 bg-primary/5 rounded-xl border p-4"
                    aria-live="polite"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        Duração do corte
                      </span>
                      <span className="text-primary text-lg font-semibold tabular-nums">
                        {cutDuration !== null
                          ? (cutDuration / 1000).toLocaleString("pt-BR", {
                              maximumFractionDigits: 3,
                            }) + " s"
                          : "—"}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-2 text-xs">
                      Entre {CLIP_DURATION_FLOOR_MS / 1000} e{" "}
                      {CLIP_DURATION_CEILING_MS / 1000} segundos. A duração
                      ideal escolhida no projeto é uma sugestão para os cortes.
                    </p>
                    {cutError && (
                      <p className="text-destructive mt-2 text-xs">
                        {cutError}
                      </p>
                    )}
                  </div>
                </div>
              </fieldset>
            </TabsContent>
            <TabsContent value="style" className="p-4 sm:p-6">
              <fieldset disabled={editingLocked} className="space-y-6">
                <legend className="sr-only">Estilo visual e legendas</legend>
                <div className="space-y-2">
                  <Label htmlFor="edit-layout">Enquadramento</Label>
                  <Select
                    value={layout}
                    disabled={editingLocked}
                    onValueChange={(value) =>
                      edit(setLayout)(value as Clip["layout"])
                    }
                  >
                    <SelectTrigger id="edit-layout" className="h-11 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["AUTO", "FACE_TRACK", "SPLIT", "BLUR", "CENTER"].map(
                        (value) => (
                          <SelectItem key={value} value={value}>
                            {layoutLabels[value as keyof typeof layoutLabels]}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">
                    Escolha como o conteúdo se adapta ao formato do clipe.
                  </p>
                </div>
                <div className="bg-muted/40 flex items-center justify-between gap-4 rounded-xl border p-4">
                  <div>
                    <Label htmlFor="show-captions" className="cursor-pointer">
                      Mostrar legendas
                    </Label>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Inclua o texto da fala no vídeo final.
                    </p>
                  </div>
                  <Checkbox
                    id="show-captions"
                    checked={captions}
                    disabled={editingLocked}
                    onCheckedChange={(value) =>
                      edit(setCaptions)(value === true)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-template">Estilo da legenda</Label>
                  <Select
                    value={fallbackTemplate.value}
                    disabled={editingLocked || templates.isLoading}
                    onValueChange={edit(setTemplate)}
                  >
                    <SelectTrigger id="edit-template" className="h-11 w-full">
                      <SelectValue placeholder="Escolha um estilo" />
                    </SelectTrigger>
                    <SelectContent>
                      {templateList.map((item) => (
                        <SelectItem key={item.key} value={item.key}>
                          {item.name}
                        </SelectItem>
                      ))}
                      {fallbackTemplate.needsFallback && (
                        <SelectItem value={fallbackTemplate.value}>
                          {fallbackTemplate.name}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">
                    A amostra na prévia acompanha o estilo selecionado.
                  </p>
                  {templates.isError && (
                    <p className="text-destructive text-xs" role="status">
                      Não foi possível carregar os estilos.
                      <button
                        type="button"
                        className="ml-1 underline underline-offset-2"
                        onClick={() => void templates.refetch()}
                      >
                        Tentar novamente
                      </button>
                    </p>
                  )}
                </div>
              </fieldset>
            </TabsContent>
            <TabsContent value="intro" className="space-y-5 p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-medium">Título de abertura</h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    O título deste corte (aba Corte) nos primeiros segundos do
                    vídeo. O ajuste vale só para este corte.
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {introReset
                    ? "Volta ao padrão ao salvar"
                    : hasClipIntro || Object.keys(introEdits).length > 0
                      ? "Ajuste deste corte"
                      : "Padrão do projeto"}
                </Badge>
              </div>
              <IntroTitleControls
                idPrefix={introIdPrefix}
                value={introValue}
                look={{
                  caption: captionStyle,
                  templateUppercase: selected?.uppercase,
                }}
                baseline={projectIntro}
                sampleText={title.trim() || c.title}
                aspect={current?.aspectRatio ?? "9:16"}
                issues={introIssues}
                disabled={editingLocked}
                onChange={changeIntro}
                footer={
                  (hasClipIntro || Object.keys(introEdits).length > 0) && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                      <p className="text-muted-foreground text-xs">
                        Desfaça o ajuste deste corte e use o que foi escolhido
                        no projeto.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={resetIntro}
                      >
                        Voltar ao padrão do projeto
                      </Button>
                    </div>
                  )
                }
              />
              <p className="text-muted-foreground text-xs">
                Salve e gere a versão para aplicar o título ao vídeo.
              </p>
            </TabsContent>
            <TabsContent value="text" className="space-y-5 p-4 sm:p-6">
              <div>
                <h2 className="text-sm font-medium">Texto das legendas</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Selecione uma palavra para corrigir ou ocultar. Os tempos e a
                  pontuação são preservados.
                </p>
              </div>
              {targetTranscriptVersion !== null &&
                transcript.data?.clipVersion !== null &&
                transcript.data?.clipVersion !== undefined &&
                transcript.data.clipVersion < targetTranscriptVersion && (
                  <p role="status" className="text-muted-foreground text-sm">
                    Confirmando o texto da versão salva…
                  </p>
                )}
              {transcriptVersionError(transcript.data?.clipVersion) && (
                <ErrorPanel
                  message="Ainda não foi possível confirmar as edições de legenda. Aguarde a atualização do texto antes de salvar."
                  retry={() => void transcript.refetch()}
                />
              )}
              {transcript.isLoading ? (
                <div
                  className="space-y-3"
                  role="status"
                  aria-label="Carregando legendas"
                >
                  <Skeleton className="h-11 rounded-xl" />
                  <Skeleton className="h-48 rounded-xl" />
                </div>
              ) : transcript.isError ? (
                <ErrorPanel
                  message={transcript.error.message}
                  retry={() => void transcript.refetch()}
                />
              ) : words.length === 0 ? (
                <div className="bg-muted/40 rounded-xl border border-dashed p-6 text-center">
                  <Subtitles
                    className="text-muted-foreground mx-auto mb-3 size-7"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium">
                    Nenhuma palavra disponível
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Este trecho ainda não tem texto para editar.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="word-search" className="sr-only">
                      Buscar palavra nas legendas
                    </Label>
                    <div className="relative">
                      <MagnifyingGlass
                        className="text-muted-foreground pointer-events-none absolute top-3.5 left-3 size-4"
                        aria-hidden="true"
                      />
                      <Input
                        id="word-search"
                        value={wordSearch}
                        className="h-11 pl-9"
                        placeholder="Buscar no texto…"
                        onChange={(event) => setWordSearch(event.target.value)}
                        aria-describedby="word-count"
                      />
                    </div>
                    <p
                      id="word-count"
                      className="text-muted-foreground text-xs"
                      aria-live="polite"
                    >
                      {query
                        ? visibleWords.length +
                          " de " +
                          words.length +
                          " palavras encontradas"
                        : words.length + " palavras"}
                      {hiddenWordCount > 0 &&
                        " · " + hiddenWordCount + " ocultas"}
                    </p>
                  </div>
                  <div
                    className="bg-muted/20 flex max-h-64 flex-wrap content-start gap-1.5 overflow-y-auto rounded-xl border p-3 sm:p-4"
                    aria-label="Palavras da legenda"
                  >
                    {visibleWords.length ? (
                      visibleWords.map((word) => (
                        <button
                          key={word.id}
                          type="button"
                          aria-pressed={activeWordId === word.id}
                          aria-label={
                            "Editar palavra " +
                            word.punctuatedText +
                            ", em " +
                            msToTime(word.startMs) +
                            (word.hidden ? ", oculta" : "")
                          }
                          onClick={() => setActiveWordId(word.id)}
                          className={
                            "focus-visible:ring-ring min-h-10 rounded-lg border px-2.5 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none " +
                            (activeWordId === word.id
                              ? "border-primary/30 bg-primary/10 text-primary font-medium"
                              : "bg-card hover:border-primary/30 border-transparent") +
                            (word.hidden
                              ? " text-muted-foreground line-through"
                              : "")
                          }
                        >
                          {word.punctuatedText || "(vazio)"}
                          {(word.edited || word.reset) && (
                            <span
                              className="text-primary ml-1"
                              aria-hidden="true"
                            >
                              ·
                            </span>
                          )}
                        </button>
                      ))
                    ) : (
                      <p className="text-muted-foreground py-4 text-sm">
                        Nenhuma palavra encontrada. Tente outro termo.
                      </p>
                    )}
                  </div>
                  {activeWord ? (
                    <fieldset
                      disabled={editingLocked || !transcriptReady}
                      className="bg-accent/30 space-y-4 rounded-xl border p-4"
                    >
                      <legend className="sr-only">
                        Editar palavra selecionada
                      </legend>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label htmlFor={"word-" + activeWord.id}>
                          Palavra selecionada
                        </Label>
                        <span className="text-muted-foreground font-mono text-xs tabular-nums">
                          {msToTime(activeWord.startMs)}
                        </span>
                      </div>
                      <Input
                        id={"word-" + activeWord.id}
                        maxLength={64}
                        value={activeWord.punctuatedText}
                        className="bg-background h-11"
                        onChange={(event) =>
                          updateWord(activeWord.id, {
                            punctuatedText: event.target.value,
                            reset: false,
                          })
                        }
                        aria-describedby="word-edit-help"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                          <Checkbox
                            checked={activeWord.hidden}
                            disabled={editingLocked || !transcriptReady}
                            onCheckedChange={(value) =>
                              updateWord(activeWord.id, {
                                hidden: value === true,
                              })
                            }
                          />
                          Ocultar no vídeo
                        </label>
                        {activeWord.edited && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={editingLocked || !transcriptReady}
                            onClick={() =>
                              updateWord(activeWord.id, {
                                reset: true,
                                hidden: false,
                              })
                            }
                          >
                            Restaurar original
                          </Button>
                        )}
                      </div>
                      <p
                        id="word-edit-help"
                        className="text-muted-foreground text-xs"
                      >
                        {activeWord.reset
                          ? "O texto original será restaurado após salvar."
                          : "Até 64 caracteres. A alteração mantém o tempo original da palavra."}
                      </p>
                    </fieldset>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      Clique em uma palavra acima para abrir os controles de
                      edição.
                    </p>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </div>
      <div className="border-primary/15 bg-card/95 sticky bottom-4 z-20 mt-6 flex flex-col gap-4 rounded-2xl border p-4 shadow-xl backdrop-blur-md sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="flex min-w-0 items-start gap-3"
          role="status"
          aria-live="polite"
        >
          {patch.isPending || confirming || generating ? (
            <SpinnerGap
              className="text-primary mt-0.5 size-5 shrink-0 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : dirty || conflictVersion !== null ? (
            <WarningCircle
              className="text-primary mt-0.5 size-5 shrink-0"
              aria-hidden="true"
            />
          ) : (
            <CheckCircle
              className="text-primary mt-0.5 size-5 shrink-0"
              aria-hidden="true"
            />
          )}
          <div>
            <p className="text-sm font-medium">{actionStatus}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {actionDetail}
            </p>
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
          <Button
            variant="outline"
            disabled={saveDisabled}
            onClick={save}
            className="h-11 gap-2"
          >
            <FloppyDisk
              className="hidden size-4 min-[360px]:block"
              aria-hidden="true"
            />
            {patch.isPending ? (
              "Salvando…"
            ) : (
              <>
                <span className="sm:hidden">Salvar</span>
                <span className="hidden sm:inline">Salvar alterações</span>
              </>
            )}
          </Button>
          <Button
            disabled={generateDisabled}
            onClick={startRender}
            className="h-11 gap-2"
          >
            {generating ? (
              <SpinnerGap
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <Play className="size-4" weight="fill" aria-hidden="true" />
            )}
            {generating ? "Gerando…" : "Gerar versão"}
          </Button>
        </div>
      </div>
      <AlertDialog
        open={leaveHref !== null}
        onOpenChange={(open) => !open && setLeaveHref(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair sem salvar?</AlertDialogTitle>
            <AlertDialogDescription>
              {patch.isPending
                ? "As alterações ainda estão sendo salvas. Aguarde o término para sair com segurança."
                : "Você tem alterações pendentes neste clipe. Se sair agora, seu rascunho será perdido."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              disabled={patch.isPending}
              onClick={() => {
                const href = leaveHref;
                if (!href) return;
                setDirty(false);
                router.push(href);
              }}
            >
              Sair sem salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={reloadDialogOpen} onOpenChange={setReloadDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Carregar a versão mais recente?</AlertDialogTitle>
            <AlertDialogDescription>
              Seu rascunho será descartado e substituído pela versão salva mais
              recentemente. Copie qualquer ajuste que queira preservar antes de
              continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter rascunho</AlertDialogCancel>
            <AlertDialogAction onClick={reloadCurrentVersion}>
              Carregar versão atual
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
