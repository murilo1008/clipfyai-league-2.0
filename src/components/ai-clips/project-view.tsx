"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowsClockwise,
  CheckCircle,
  CircleNotch,
  Copy,
  DownloadSimple,
  DotsThree,
  FilmStrip,
  PencilSimple,
  Trash,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { api } from "@/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { UploadControl } from "./upload-control";
import { platformLabels } from "./labels";
import { useClipDownloads } from "./use-clip-downloads";
import { Mp4DownloadButton } from "./mp4-download-button";
import { clipExportMessage } from "./export-downloads";
import { projectClipsContent, selectedClipsNotice } from "./project-summary";
import {
  freshRenderAsset,
  preferredCardRender,
  previousRenderState,
  renderDownloadLabel,
  type RenderAsset,
} from "./render-assets";
import {
  EmptyPanel,
  ErrorPanel,
  PageHeader,
  ProjectProgress,
  ProjectStatusBadge,
  formatDate,
  formatDuration,
  pollMs,
  projectError,
  stageLabels,
  terminal,
} from "./shared";
import {
  stages,
  type Clip,
  type Project,
} from "@/server/league-clips/contracts";

export function ProjectView({ projectId }: { projectId: string }) {
  const router = useRouter(),
    utils = api.useUtils();
  const [visible, setVisible] = useState(true),
    [cancelWatchUntil, setCancelWatchUntil] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const projectActionsButton = useRef<HTMLButtonElement>(null);
  const [clipFilter, setClipFilter] = useState("ALL"),
    [sort, setSort] = useState("rank");
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const project = api.leagueClips.project.useQuery(
    { id: projectId },
    {
      refetchInterval: (q) =>
        cancelWatchUntil > Date.now() && !q.state.data?.lastError && visible
          ? 3000
          : pollMs(q.state.data?.status, q.state.data?.createdAt, visible),
    },
  );
  const clips = api.leagueClips.clips.useQuery(
    { id: projectId },
    {
      enabled: !!project.data,
      refetchInterval: () =>
        project.data && !terminal(project.data.status) && visible
          ? pollMs(project.data.status, project.data.createdAt, visible)
          : false,
    },
  );
  const lastStatus = useRef<Project["status"] | null>(null);
  const downloads = useClipDownloads(clips.data ?? []);
  useEffect(() => {
    const status = project.data?.status;
    if (status && terminal(status) && !terminal(lastStatus.current ?? "QUEUED"))
      void clips.refetch();
    if (status) lastStatus.current = status;
  }, [project.data?.status, clips]);
  const cancel = api.leagueClips.cancel.useMutation(),
    remove = api.leagueClips.delete.useMutation();
  async function cancelProject() {
    try {
      await cancel.mutateAsync({ id: projectId });
      setCancelWatchUntil(Date.now() + 15000);
      await project.refetch();
      toast.info("Solicitação de cancelamento enviada.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível cancelar.",
      );
    }
  }
  async function deleteProject() {
    try {
      await remove.mutateAsync({ id: projectId });
      await utils.leagueClips.list.invalidate();
      router.push("/ai-clips");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  }
  if (project.isLoading)
    return (
      <main className="mx-auto w-full max-w-7xl p-4 md:p-8">
        <Skeleton className="mb-6 h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </main>
    );
  if (project.isError || !project.data)
    return (
      <main className="mx-auto w-full max-w-7xl p-4 md:p-8">
        <Button asChild variant="ghost" className="mb-5">
          <Link href="/ai-clips">
            <ArrowLeft aria-hidden className="size-4" />
            Seus projetos
          </Link>
        </Button>
        <ErrorPanel
          message={project.error?.message ?? "Projeto não encontrado."}
          retry={() => void project.refetch()}
        />
      </main>
    );
  const p = project.data;
  const finished = terminal(p.status);
  const completed =
    p.status === "COMPLETED" || p.status === "COMPLETED_WITH_ERRORS";
  const clipsNotice = selectedClipsNotice(p);
  const clipsContent = projectClipsContent(
    p.status,
    clips.data?.length ?? p.counts.clipsTotal,
  );
  const visibleClips = (clips.data ?? [])
    .filter((c) => clipFilter === "ALL" || c.status === clipFilter)
    .slice()
    .sort((a, b) =>
      sort === "score"
        ? (b.viralityScore ?? -1) - (a.viralityScore ?? -1)
        : a.rank - b.rank,
    );
  return (
    <main className="mx-auto w-full max-w-7xl p-4 pb-16 md:p-8">
      <PageHeader
        title={p.source.title ?? "Projeto de vídeo"}
        description={`Criado em ${formatDate(p.createdAt)}`}
      >
        <Button asChild variant="outline">
          <Link href="/ai-clips">
            <ArrowLeft aria-hidden className="size-4" />
            Projetos
          </Link>
        </Button>
        <Button
          variant="outline"
          disabled={project.isFetching || clips.isFetching}
          aria-label="Atualizar projeto e clipes"
          onClick={() => {
            void project.refetch();
            void clips.refetch();
          }}
        >
          <ArrowsClockwise
            aria-hidden
            className={cn(
              "size-4",
              (project.isFetching || clips.isFetching) &&
                "motion-safe:animate-spin",
            )}
          />
          Atualizar
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              ref={projectActionsButton}
              variant="ghost"
              size="icon"
              aria-label="Mais ações do projeto"
            >
              <DotsThree aria-hidden className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive"
              disabled={remove.isPending}
              onSelect={() => setConfirmDelete(true)}
            >
              <Trash aria-hidden className="size-4" />
              Excluir projeto
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>
      <div className="bg-card mb-6 flex flex-wrap items-center gap-x-6 gap-y-4 rounded-xl border p-5">
        <ProjectStatusBadge status={p.status} />
        <dl className="flex flex-wrap gap-x-6 gap-y-3 text-xs">
          <div>
            <dt className="text-muted-foreground mb-1">Origem</dt>
            <dd className="font-medium">
              {p.source.platform
                ? platformLabels[p.source.platform]
                : "Arquivo"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground mb-1">Duração do vídeo</dt>
            <dd className="font-medium tabular-nums">
              {formatDuration(p.source.durationMs)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground mb-1">Formatos</dt>
            <dd className="font-medium">
              {p.options.aspectRatios.join(" · ")}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground mb-1">Clipes prontos</dt>
            <dd className="font-medium">
              {p.counts.clipsReady} de {p.counts.clipsTotal}
            </dd>
          </div>
          {p.expiresAt && (
            <div>
              <dt className="text-muted-foreground mb-1">Disponível até</dt>
              <dd className="font-medium">{formatDate(p.expiresAt)}</dd>
            </div>
          )}
        </dl>
      </div>
      {!finished && p.status !== "NEEDS_UPLOAD" && (
        <Card className="border-primary/20 mb-6 shadow-none">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CircleNotch
                  aria-hidden
                  className="text-primary size-5 motion-safe:animate-spin"
                />
                Estamos preparando seus clipes
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                disabled={cancel.isPending}
                onClick={() => void cancelProject()}
              >
                {cancel.isPending ? "Solicitando…" : "Cancelar processamento"}
              </Button>
            </div>
            <p className="text-muted-foreground text-sm">
              Você pode sair desta tela e acompanhar o resultado na sua
              biblioteca.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <ProjectProgress project={p} />
            <ProcessingStages project={p} />
          </CardContent>
        </Card>
      )}
      {finished && (
        <details className="bg-card/50 mb-6 rounded-xl border">
          <summary className="text-muted-foreground cursor-pointer px-5 py-4 text-sm">
            Ver etapas do processamento
          </summary>
          <div className="px-5 pb-5">
            <ProcessingStages project={p} />
          </div>
        </details>
      )}
      {p.lastError && (
        <div className="mb-6">
          <ErrorPanel message={p.lastError.message} />
        </div>
      )}
      {p.status === "NEEDS_UPLOAD" && (
        <Card className="mb-6 border-amber-500/25">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UploadIcon />
              Seu vídeo precisa de um envio manual
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              A plataforma bloqueou o download. Envie o mesmo vídeo para
              continuar este projeto.
            </p>
          </CardHeader>
          <CardContent>
            <UploadControl projectId={p.id} />
          </CardContent>
        </Card>
      )}
      {p.status === "FAILED" && (
        <div className="mb-6">
          <ErrorPanel message={projectError(p.error)} />
        </div>
      )}
      {p.status === "COMPLETED_WITH_ERRORS" && (
        <div
          role="status"
          className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm"
        >
          <WarningCircle
            aria-hidden
            className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-300"
          />
          <p>
            {p.counts.clipsFailed}{" "}
            {p.counts.clipsFailed === 1
              ? "clipe não pôde ser gerado"
              : "clipes não puderam ser gerados"}
            . Os clipes prontos estão disponíveis abaixo.
          </p>
        </div>
      )}
      {clipsContent === "cancelled" && (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Projeto cancelado</CardTitle>
            <p className="text-muted-foreground text-sm">
              O processamento foi interrompido antes de gerar clipes.
            </p>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/ai-clips">Voltar aos projetos</Link>
            </Button>
          </CardContent>
        </Card>
      )}
      {clipsContent === "section" && (
        <section aria-labelledby="clips-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2
                id="clips-heading"
                className="flex items-center gap-2 text-xl font-semibold"
              >
                <FilmStrip aria-hidden className="text-primary size-5" />
                Seus clipes
                <Badge variant="secondary" className="rounded-full">
                  {p.counts.clipsReady}
                </Badge>
              </h2>
              <p className="text-muted-foreground mt-2 text-sm">
                {finished
                  ? "Confira os momentos selecionados, personalize e baixe seu favorito."
                  : "Os cortes ficam disponíveis aqui conforme são gerados."}
              </p>
            </div>
            {!!clips.data?.length && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={
                    downloads.preparing ||
                    !clips.data.some((c) =>
                      c.renders.some((r) => r.status === "READY" && r.videoUrl),
                    )
                  }
                  onClick={() => void downloads.requestAll(clips.data ?? [])}
                >
                  {downloads.preparing ? (
                    <CircleNotch
                      aria-hidden
                      className="size-4 motion-safe:animate-spin"
                    />
                  ) : (
                    <DownloadSimple aria-hidden className="size-4" />
                  )}
                  {downloads.preparing
                    ? "Preparando o vídeo em 1080p…"
                    : "Baixar todos"}
                </Button>
                <Select value={clipFilter} onValueChange={setClipFilter}>
                  <SelectTrigger
                    aria-label="Filtrar clipes por status"
                    className="bg-card w-40"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos os clipes</SelectItem>
                    <SelectItem value="READY">Prontos</SelectItem>
                    <SelectItem value="RENDERING">Gerando</SelectItem>
                    <SelectItem value="PENDING">Na fila</SelectItem>
                    <SelectItem value="FAILED">Com falha</SelectItem>
                    <SelectItem value="CANCELLED">Cancelados</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sort} onValueChange={setSort}>
                  <SelectTrigger
                    aria-label="Ordenar clipes"
                    className="bg-card w-44"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rank">Ordem sugerida</SelectItem>
                    <SelectItem value="score">Maior potencial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {clipsNotice && (
            <p
              role="status"
              className="bg-muted text-muted-foreground mb-4 rounded-xl p-4 text-sm"
            >
              {clipsNotice}
            </p>
          )}
          {clips.isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-96 rounded-2xl" />
              ))}
            </div>
          ) : clips.isError ? (
            <ErrorPanel
              message={clips.error.message}
              retry={() => void clips.refetch()}
            />
          ) : !visibleClips.length ? (
            <EmptyPanel
              title={
                clips.data?.length
                  ? "Nenhum clipe com esse status"
                  : p.status === "NEEDS_UPLOAD"
                    ? "Envie o vídeo para gerar seus clipes"
                    : completed
                      ? "Nenhum corte selecionado"
                      : "Seus próximos cortes estão a caminho"
              }
              detail={
                clips.data?.length
                  ? "Escolha outro status para ver os clipes deste projeto."
                  : finished
                    ? "Você pode voltar à biblioteca e criar um projeto com outro vídeo."
                    : p.status === "NEEDS_UPLOAD"
                      ? "Use a área de envio acima para retomar este projeto."
                      : "A IA está analisando seu vídeo para encontrar os melhores momentos."
              }
            >
              {clips.data?.length ? (
                <Button variant="outline" onClick={() => setClipFilter("ALL")}>
                  Mostrar todos os clipes
                </Button>
              ) : finished ? (
                <Button asChild variant="outline">
                  <Link href="/ai-clips">Voltar aos projetos</Link>
                </Button>
              ) : null}
            </EmptyPanel>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {visibleClips.map((c) => (
                <ClipCard
                  key={c.id}
                  clip={c}
                  project={p}
                  mp4Downloads={downloads}
                />
              ))}
            </div>
          )}
        </section>
      )}
      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => {
          if (!remove.isPending) setConfirmDelete(open);
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            projectActionsButton.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              O projeto e seus clipes deixarão de estar disponíveis. Baixe os
              vídeos que deseja guardar antes de excluir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              Manter projeto
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault();
                void deleteProject();
              }}
            >
              {remove.isPending ? "Excluindo…" : "Excluir projeto"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
function UploadIcon() {
  return (
    <WarningCircle
      aria-hidden
      className="size-5 text-amber-600 dark:text-amber-300"
    />
  );
}
function ProcessingStages({ project }: { project: Project }) {
  const labels = {
    SUCCEEDED: "Concluído",
    RUNNING: "Em andamento",
    FAILED: "Falhou",
    CANCELLED: "Cancelado",
    DELAYED: "Aguardando",
  };
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {stages.map((stageKey, i) => {
        const stage = project.stages.find((item) => item.stage === stageKey);
        const succeeded = stage?.status === "SUCCEEDED",
          failed = stage?.status === "FAILED",
          running = stage?.status === "RUNNING";
        const Icon = succeeded
          ? CheckCircle
          : failed
            ? XCircle
            : running
              ? CircleNotch
              : null;
        return (
          <li key={stageKey} className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg text-xs",
                succeeded
                  ? "dark:text-brand-green bg-emerald-500/10 text-emerald-700"
                  : failed
                    ? "bg-destructive/10 text-destructive"
                    : running
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground",
              )}
            >
              {Icon ? (
                <Icon
                  aria-hidden
                  className={cn(
                    "size-4",
                    running && "motion-safe:animate-spin",
                  )}
                />
              ) : (
                i + 1
              )}
            </span>
            <div>
              <p className="text-xs font-medium">{stageLabels[stageKey]}</p>
              <p className="text-muted-foreground mt-0.5 text-[11px]">
                {stage
                  ? labels[stage.status]
                  : terminal(project.status)
                    ? "Não executado"
                    : "Aguardando"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
function ClipCard({
  clip,
  project,
  mp4Downloads,
}: {
  clip: Clip;
  project: Project;
  mp4Downloads: ReturnType<typeof useClipDownloads>;
}) {
  const utils = api.useUtils(),
    [fresh, setFresh] = useState<Clip | null>(null),
    [refreshing, setRefreshing] = useState(false),
    [downloading, setDownloading] = useState(false),
    downloadLock = useRef(false),
    attemptedUrl = useRef<string | null>(null);
  useEffect(() => {
    setFresh(null);
  }, [clip]);
  const c = fresh ?? clip,
    render = preferredCardRender(c.renders, c.version),
    previousState = render
      ? previousRenderState(render, c.renders, c.version)
      : null;
  async function renew() {
    if (
      refreshing ||
      !render?.videoUrl ||
      attemptedUrl.current === render.videoUrl
    )
      return;
    attemptedUrl.current = render.videoUrl;
    setRefreshing(true);
    try {
      await utils.leagueClips.clip.invalidate({ id: c.id });
      const updated = await utils.leagueClips.clip.fetch({ id: c.id });
      setFresh(updated);
    } catch {
      toast.error("Não foi possível renovar o link do vídeo.");
    } finally {
      setRefreshing(false);
    }
  }
  async function downloadFresh(renderId: string, asset: RenderAsset = "video") {
    if (downloadLock.current) return;
    downloadLock.current = true;
    setDownloading(true);
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    try {
      await utils.leagueClips.clip.invalidate({ id: c.id });
      const latest = await utils.leagueClips.clip.fetch({ id: c.id });
      setFresh(latest);
      const url = freshRenderAsset(latest.renders, renderId, asset);
      if (!url) throw new Error("Link indisponível.");
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else window.location.href = url;
    } catch {
      tab?.close();
      toast.error("Não foi possível renovar o link de download.");
    } finally {
      downloadLock.current = false;
      setDownloading(false);
    }
  }
  useEffect(() => {
    if (!render?.thumbnailUrl) return;
    const img = new window.Image();
    img.onerror = () => {
      void renew();
    };
    img.src = render.thumbnailUrl;
    return () => {
      img.onerror = null;
    };
    // The signed URL itself is the refresh trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [render?.thumbnailUrl]);
  const text = [c.description, c.hashtags.join(" ")].filter(Boolean).join("\n");
  const downloads = c.renders.filter((r) => r.status === "READY" && r.videoUrl);
  return (
    <Card className="overflow-hidden rounded-2xl pt-0 shadow-none">
      <div className="relative flex aspect-[9/16] max-h-[420px] items-center justify-center bg-neutral-950">
        {render?.videoUrl ? (
          <video
            className="h-full w-full object-contain"
            controls
            playsInline
            preload="none"
            poster={render.thumbnailUrl ?? undefined}
            src={render.videoUrl}
            onError={() => void renew()}
            aria-label={`Prévia do clipe ${c.rank}: ${c.title}`}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 px-5 text-center text-white/70">
            <FilmStrip aria-hidden className="size-9" />
            <p className="text-sm">
              {c.status === "FAILED"
                ? "Não foi possível gerar este clipe"
                : c.status === "CANCELLED"
                  ? "Geração cancelada"
                  : c.status === "READY"
                    ? "Prévia indisponível"
                    : "Preparando a prévia…"}
            </p>
          </div>
        )}
        <span className="pointer-events-none absolute top-3 left-3 rounded-md border border-white/15 bg-black/60 px-2 py-1 text-[11px] font-medium text-white">
          Corte {String(c.rank).padStart(2, "0")}
        </span>
        {c.status !== "READY" && (
          <Badge className="pointer-events-none absolute top-3 right-3 border-white/15 bg-black/60 text-white">
            {c.status === "FAILED"
              ? "Falha no clipe"
              : c.status === "CANCELLED"
                ? "Cancelado"
                : "Gerando"}
          </Badge>
        )}
      </div>
      <CardContent className="flex flex-1 flex-col gap-3 pt-1">
        <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
          <span className="tabular-nums">
            {formatDuration(c.durationMs)} ·{" "}
            {render?.aspectRatio ?? project.options.aspectRatios.join(" · ")}
          </span>
          {c.viralityScore !== null && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-primary focus-visible:ring-primary/50 bg-primary/10 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] focus-visible:ring-2 focus-visible:outline-none"
                    aria-label={`Potencial de alcance: ${Math.round(c.viralityScore)} de 100`}
                  >
                    <span>Potencial</span>
                    <strong>{Math.round(c.viralityScore)}/100</strong>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">
                  {c.reason ??
                    "Estimativa da IA com base no conteúdo deste corte."}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <h3 className="line-clamp-2 text-sm leading-relaxed font-semibold">
          {c.title}
        </h3>
        {c.lowConfidence && (
          <Badge
            variant="outline"
            className="w-fit gap-1 border-amber-500/25 text-amber-700 dark:text-amber-300"
          >
            <WarningCircle aria-hidden className="size-3" />
            Revise este corte
          </Badge>
        )}
        {c.hookText && (
          <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
            {c.hookText}
          </p>
        )}
        {!!text && (
          <details className="text-muted-foreground text-xs">
            <summary className="hover:text-foreground cursor-pointer">
              Texto para publicar
            </summary>
            <div className="mt-2 space-y-2 leading-relaxed">
              <p className="whitespace-pre-wrap">{c.description}</p>
              <p className="text-primary break-words">{c.hashtags.join(" ")}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(text)
                    .then(() => toast.success("Texto copiado."))
                    .catch(() =>
                      toast.error(
                        "Não foi possível copiar. Selecione o texto e copie manualmente.",
                      ),
                    );
                }}
              >
                <Copy aria-hidden className="size-3.5" />
                Copiar texto
              </Button>
            </div>
          </details>
        )}
        {c.lastError && (
          <p role="alert" className="text-destructive text-xs">
            {clipExportMessage(c)}
          </p>
        )}
        <div className="border-border/60 mt-auto flex flex-wrap gap-2 border-t pt-3">
          {downloads.map((r) => (
            <Mp4DownloadButton
              key={r.id}
              render={r}
              clipVersion={c.version}
              state={mp4Downloads.state(c, r)}
              onDownload={() => void mp4Downloads.request(c, r)}
            />
          ))}
          {(project.status === "COMPLETED" ||
            project.status === "COMPLETED_WITH_ERRORS") && (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="flex-1 rounded-lg"
            >
              <Link href={`/ai-clips/${project.id}/clips/${c.id}/edit`}>
                <PencilSimple aria-hidden className="size-4" />
                Editar
              </Link>
            </Button>
          )}
          {render?.subtitles && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="outline"
                  disabled={downloading}
                  aria-label={`Mais downloads do clipe ${c.rank}`}
                  className="rounded-lg"
                >
                  <DotsThree aria-hidden className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {render?.subtitles && (
                  <>
                    <DropdownMenuLabel>Legendas</DropdownMenuLabel>
                    <DropdownMenuItem
                      onSelect={() => void downloadFresh(render.id, "srt")}
                    >
                      {renderDownloadLabel(render, c.version, "SRT")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => void downloadFresh(render.id, "vtt")}
                    >
                      {renderDownloadLabel(render, c.version, "VTT")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {previousState && (
          <p className="text-muted-foreground text-xs">
            {previousState === "pending"
              ? "Prévia da versão anterior. A atualização está sendo gerada."
              : previousState === "failed"
                ? "A atualização falhou. Você ainda pode baixar a versão anterior."
                : "Esta prévia é da versão anterior. Gere o vídeo no editor para aplicar suas edições."}
          </p>
        )}
        {refreshing && (
          <p role="status" className="text-muted-foreground text-xs">
            Atualizando a prévia…
          </p>
        )}
      </CardContent>
    </Card>
  );
}
