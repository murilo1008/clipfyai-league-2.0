"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  FilmStrip,
  List,
  MagnifyingGlass,
  Plus,
  Sparkle,
  SquaresFour,
  VideoCamera,
  X,
} from "@phosphor-icons/react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { NewProjectDialog } from "./new-project-dialog";
import {
  EmptyPanel,
  ErrorPanel,
  PageHeader,
  ProjectProgress,
  ProjectStatusBadge,
  formatDate,
  formatDuration,
  statusLabels,
  terminal,
} from "./shared";
import { platformLabels } from "./labels";
import { readyClipsLabel } from "./project-summary";
import {
  projectClipThumbnail,
  projectThumbnailUrls,
} from "./project-thumbnail";
import { statuses, type Project } from "@/server/league-clips/contracts";

export function ProjectsView() {
  const [status, setStatus] = useState("ALL"),
    [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | undefined>(),
    [history, setHistory] = useState<(string | undefined)[]>([]);
  const [open, setOpen] = useState(false),
    [view, setView] = useState<"grid" | "list">("grid");
  const query = api.leagueClips.list.useQuery(
    {
      cursor,
      limit: 12,
      status: status === "ALL" ? undefined : (status as Project["status"]),
    },
    {
      refetchInterval: (q) =>
        q.state.data?.items.some(
          (p) => !terminal(p.status) && p.status !== "NEEDS_UPLOAD",
        )
          ? 10000
          : false,
    },
  );
  const items = query.data?.items ?? [];
  const term = search.trim().toLocaleLowerCase("pt-BR");
  const visible = items.filter((p) =>
    [
      p.source.title,
      p.source.url,
      p.source.platform ? platformLabels[p.source.platform] : "Arquivo",
    ].some((value) => value?.toLocaleLowerCase("pt-BR").includes(term)),
  );
  function changeStatus(value: string) {
    setStatus(value);
    setCursor(undefined);
    setHistory([]);
  }
  function clearFilters() {
    changeStatus("ALL");
    setSearch("");
  }
  const filtered = status !== "ALL" || !!term;
  return (
    <main className="mx-auto w-full max-w-7xl p-4 pb-16 md:p-8">
      <PageHeader
        title="AI Clips"
        description="Seu espaço para transformar vídeos em conteúdo que merece ser visto."
      >
        <Button className="h-10 rounded-lg" onClick={() => setOpen(true)}>
          <Plus aria-hidden className="size-4" />
          Novo projeto
        </Button>
      </PageHeader>
      <section
        aria-labelledby="clips-intro"
        className="border-primary/15 bg-card relative mb-8 overflow-hidden rounded-2xl border p-6 sm:p-8"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_85%_25%,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_60%)]"
        />
        <div className="relative z-10 max-w-xl md:max-w-[65%]">
          <div className="text-primary mb-3 inline-flex items-center gap-2 text-xs font-medium">
            <Sparkle aria-hidden className="size-4" />
            Menos edição. Mais criação.
          </div>
          <h2
            id="clips-intro"
            className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl"
          >
            Um vídeo. Novas possibilidades.
          </h2>
          <p className="text-muted-foreground mt-3 max-w-md text-sm leading-relaxed">
            A IA encontra os melhores momentos. Você dá o toque final com
            cortes, legendas e a sua identidade.
          </p>
          <ol className="text-muted-foreground mt-6 flex flex-wrap gap-x-5 gap-y-3 text-xs">
            {["Importe seu vídeo", "Gere com IA", "Revise e baixe"].map(
              (text, i) => (
                <li key={text} className="flex items-center gap-2">
                  <span className="bg-primary/10 text-primary flex size-6 items-center justify-center rounded-full">
                    {i + 1}
                  </span>
                  <span>{text}</span>
                </li>
              ),
            )}
          </ol>
        </div>
        <ClipIllustration />
      </section>
      <section aria-labelledby="projects-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="projects-heading" className="text-lg font-semibold">
              Seus projetos
            </h2>
            <p className="text-muted-foreground mt-1 text-xs">
              Encontre seu vídeo e continue de onde parou.
            </p>
          </div>
          <div
            aria-label="Visualização dos projetos"
            className="bg-muted/60 flex items-center gap-1 rounded-lg border p-1"
          >
            <Button
              size="icon-sm"
              variant={view === "grid" ? "secondary" : "ghost"}
              aria-label="Visualizar em grade"
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
            >
              <SquaresFour aria-hidden className="size-4" />
            </Button>
            <Button
              size="icon-sm"
              variant={view === "list" ? "secondary" : "ghost"}
              aria-label="Visualizar em lista"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <List aria-hidden className="size-4" />
            </Button>
          </div>
        </div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlass
              aria-hidden
              className="text-muted-foreground pointer-events-none absolute top-3 left-3 size-4"
            />
            <label htmlFor="project-search" className="sr-only">
              Buscar projetos nesta página
            </label>
            <Input
              id="project-search"
              type="search"
              className="bg-card h-10 rounded-lg pr-10 pl-10"
              placeholder="Buscar nesta página…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-describedby="project-search-scope"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-1 right-1"
                aria-label="Limpar busca"
                onClick={() => setSearch("")}
              >
                <X aria-hidden className="size-4" />
              </Button>
            )}
          </div>
          <Select value={status} onValueChange={changeStatus}>
            <SelectTrigger
              aria-label="Filtrar projetos por status"
              className="bg-card h-10 w-full rounded-lg sm:w-56"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os status</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p
          id="project-search-scope"
          className="text-muted-foreground mb-5 text-xs"
          role="status"
        >
          {query.isLoading
            ? "Carregando projetos…"
            : `${visible.length} ${visible.length === 1 ? "projeto" : "projetos"} nesta página`}
          {!!term && ` de ${items.length}`}. A busca considera os projetos da
          página atual.
        </p>
        {query.isLoading ? (
          <div
            aria-label="Carregando projetos"
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorPanel
            message={query.error.message}
            retry={() => void query.refetch()}
          />
        ) : !visible.length ? (
          <EmptyPanel
            title={
              filtered
                ? "Nenhum projeto encontrado"
                : "Seu primeiro corte começa aqui"
            }
            detail={
              filtered
                ? "Experimente outro título, mude o status ou consulte as próximas páginas."
                : "Cole o link de um vídeo ou envie um arquivo. A IA cuida dos primeiros cortes e você escolhe o que compartilhar."
            }
          >
            {filtered ? (
              <Button variant="outline" onClick={clearFilters}>
                Limpar filtros
              </Button>
            ) : (
              <Button onClick={() => setOpen(true)}>
                <Plus aria-hidden className="size-4" />
                Criar primeiro projeto
              </Button>
            )}
          </EmptyPanel>
        ) : (
          <div
            className={cn(
              "grid gap-4",
              view === "grid" && "md:grid-cols-2 xl:grid-cols-3",
            )}
          >
            {visible.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                compact={view === "list"}
              />
            ))}
          </div>
        )}
        {!query.isError &&
          !query.isLoading &&
          (history.length > 0 || query.data?.nextCursor) && (
            <nav
              aria-label="Paginação de projetos"
              className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5"
            >
              <span className="text-muted-foreground text-xs">
                Página {history.length + 1}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={!history.length}
                  onClick={() => {
                    setCursor(history.at(-1));
                    setHistory(history.slice(0, -1));
                  }}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  disabled={!query.data?.nextCursor}
                  onClick={() => {
                    setHistory([...history, cursor]);
                    setCursor(query.data?.nextCursor ?? undefined);
                  }}
                >
                  Próxima
                </Button>
              </div>
            </nav>
          )}
      </section>
      <NewProjectDialog open={open} onOpenChange={setOpen} />
    </main>
  );
}
function ProjectCard({
  project: p,
  compact,
}: {
  project: Project;
  compact: boolean;
}) {
  const [failedThumbnails, setFailedThumbnails] = useState<string[]>([]);
  const [loadedThumbnail, setLoadedThumbnail] = useState<string | null>(null);
  const sourceThumbnail = projectThumbnailUrls(p.source).find(
    (url) => !failedThumbnails.includes(url),
  );
  const clips = api.leagueClips.clips.useQuery(
    { id: p.id },
    {
      enabled: !sourceThumbnail && p.counts.clipsReady > 0,
      staleTime: 60_000,
      retry: false,
      refetchOnWindowFocus: false,
    },
  );
  const clipThumbnail = projectClipThumbnail(clips.data ?? []);
  const thumbnail =
    sourceThumbnail ??
    (clipThumbnail && !failedThumbnails.includes(clipThumbnail)
      ? clipThumbnail
      : null);
  const thumbnailVisible = !!thumbnail && loadedThumbnail === thumbnail;
  const completed =
    p.status === "COMPLETED" || p.status === "COMPLETED_WITH_ERRORS";
  const platform = p.source.platform
    ? platformLabels[p.source.platform]
    : "Arquivo";
  const action =
    p.status === "NEEDS_UPLOAD"
      ? "Continuar envio"
      : completed
        ? "Revisar clipes"
        : terminal(p.status)
          ? "Ver detalhes"
          : "Acompanhar projeto";
  return (
    <Link
      href={`/ai-clips/${p.id}`}
      className={cn(
        "group bg-card border-border/80 hover:border-primary/40 focus-visible:ring-primary/50 overflow-hidden rounded-2xl border transition-colors focus-visible:ring-2 focus-visible:outline-none",
        compact && "sm:flex",
      )}
    >
      <div
        className={cn(
          "bg-primary/[0.04] relative flex items-center justify-center overflow-hidden border-b",
          compact
            ? "h-28 sm:h-auto sm:w-40 sm:shrink-0 sm:border-r sm:border-b-0"
            : "h-36",
        )}
      >
        {thumbnail && (
          <Image
            key={thumbnail}
            src={thumbnail}
            alt=""
            fill
            unoptimized
            sizes={
              compact
                ? "(min-width: 640px) 160px, 100vw"
                : "(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw"
            }
            className={cn(
              "object-cover transition-[opacity,transform] duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100",
              thumbnailVisible ? "opacity-100" : "opacity-0",
            )}
            onLoad={() => setLoadedThumbnail(thumbnail)}
            onError={() =>
              setFailedThumbnails((failed) => [...failed, thumbnail])
            }
          />
        )}
        {thumbnailVisible && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"
          />
        )}
        {!thumbnailVisible && (
          <div
            aria-hidden
            className="text-primary/15 absolute inset-0 flex items-center justify-center gap-1.5"
          >
            {[
              20, 38, 54, 32, 68, 44, 80, 56, 36, 64, 42, 24, 50, 70, 36, 22,
            ].map((h, i) => (
              <span
                key={i}
                className="w-1.5 rounded-full bg-current"
                style={{ height: h }}
              />
            ))}
          </div>
        )}
        {!thumbnailVisible && (
          <div className="bg-card/90 text-primary relative flex size-12 items-center justify-center rounded-2xl border shadow-sm">
            <VideoCamera aria-hidden weight="duotone" className="size-6" />
          </div>
        )}
        {!compact && (
          <span
            className={cn(
              "absolute bottom-3 left-4 inline-flex items-center gap-1.5 text-xs",
              thumbnailVisible ? "text-white/90" : "text-muted-foreground",
            )}
          >
            <span className="bg-primary/70 size-1.5 rounded-full" />
            {platform}
          </span>
        )}
        {!compact && (
          <span
            className={cn(
              "absolute right-3 bottom-3 rounded-md px-2 py-1 text-[11px] tabular-nums",
              thumbnailVisible
                ? "bg-black/60 text-white/90"
                : "bg-card/90 text-muted-foreground",
            )}
          >
            {formatDuration(p.source.durationMs)}
          </span>
        )}
      </div>
      <div
        className={cn(
          "min-w-0 flex-1 p-5",
          compact &&
            "sm:grid sm:grid-cols-[1fr_200px] sm:items-center sm:gap-5",
        )}
      >
        <div>
          <div className="mb-3">
            <ProjectStatusBadge status={p.status} />
          </div>
          <h3 className="line-clamp-2 text-sm leading-relaxed font-semibold break-words">
            {p.source.title ?? p.source.url ?? "Vídeo enviado"}
          </h3>
          <p className="text-muted-foreground mt-1.5 text-[11px]">
            {compact && `${platform} · `}
            {formatDate(p.createdAt)}
          </p>
        </div>
        <div className={cn("mt-4", compact && "sm:mt-0")}>
          {!terminal(p.status) && p.status !== "NEEDS_UPLOAD" ? (
            <ProjectProgress project={p} />
          ) : (
            <p className="text-muted-foreground flex items-center gap-2 text-xs">
              <FilmStrip aria-hidden className="size-4" />
              {readyClipsLabel(p.counts)}
              <span className="ml-auto">
                {p.options.aspectRatios.join(" · ")}
              </span>
            </p>
          )}
          {p.lastError && (
            <p className="text-destructive mt-3 line-clamp-2 text-xs">
              {p.lastError.message}
            </p>
          )}
          <div className="border-border/60 text-primary mt-4 flex items-center justify-between gap-3 border-t pt-3 text-xs font-medium">
            <span>{action}</span>
            <ArrowRight
              aria-hidden
              className="size-4 transition-transform group-hover:translate-x-1 motion-reduce:transform-none"
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
function ClipIllustration() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-1/2 right-8 hidden h-44 w-48 -translate-y-1/2 md:block lg:right-14"
    >
      <div className="border-primary/15 bg-primary/5 absolute top-5 left-0 h-32 w-24 -rotate-12 rounded-2xl border p-3">
        <div className="bg-primary/10 h-20 rounded-lg" />
        <div className="bg-primary/15 mt-2 h-1.5 w-10 rounded-full" />
      </div>
      <div className="border-primary/30 bg-card absolute top-0 right-6 flex h-40 w-24 rotate-6 flex-col items-center justify-center rounded-2xl border shadow-lg">
        <div className="text-primary flex size-12 items-center justify-center rounded-full border">
          <FilmStrip weight="duotone" className="size-6" />
        </div>
        <div className="bg-primary/20 mt-4 h-1.5 w-14 rounded-full" />
        <div className="bg-primary/10 mt-2 h-1.5 w-10 rounded-full" />
      </div>
      <div className="bg-primary text-primary-foreground absolute right-0 bottom-1 flex size-11 items-center justify-center rounded-xl shadow-md">
        <Sparkle weight="fill" className="size-6" />
      </div>
    </div>
  );
}
