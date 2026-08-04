"use client"

import * as React from "react"
import {
  ArrowSquareOut,
  CalendarBlank,
  CaretUpDown,
  Check,
  CheckCircle,
  CircleNotch,
  Clock,
  FileVideo,
  FilmSlate,
  FolderOpen,
  Funnel,
  Globe,
  HardDrive,
  LinkSimple,
  List,
  MagnifyingGlass,
  Play,
  Plus,
  Scissors,
  SquaresFour,
  TextAa,
  TextAlignLeft,
  Trophy,
  UploadSimple,
  X,
  YoutubeLogo,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { LibraryHeroViz, LibraryHeroVizSkeleton } from "@/components/competitions/library-hero-viz"
import { HomeHero } from "@/components/home/home-hero"
import { StatTile } from "@/components/home/stat-tile"
import { Reveal } from "@/components/shared/reveal"
import {
  Bone,
  CardGridSkeleton,
  ToolbarSkeleton,
} from "@/components/shared/skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"
import { useUploadThing } from "@/utils/uploadthing"

/* ========================================================================
   Helpers
   ======================================================================== */

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`
  return `${m}:${s.toString().padStart(2, "0")}`
}

function getYoutubeId(url: string): string | null {
  const match =
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/.exec(
      url,
    )
  return match?.[1] ?? null
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

/**
 * Lê a duração (em segundos, inteiro) de um arquivo de vídeo no client
 * antes do upload — via <video> + loadedmetadata.
 */
function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const probe = document.createElement("video")
    probe.preload = "metadata"
    probe.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl)
      const duration = Math.round(probe.duration)
      resolve(Number.isFinite(duration) && duration > 0 ? duration : null)
    }
    probe.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(null)
    }
    probe.src = objectUrl
  })
}

const YOUTUBE_EMBED_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"

/* ========================================================================
   Página
   ======================================================================== */

export default function Library() {
  const [selectedCampaignId, setSelectedCampaignId] = React.useState("all")
  const [campaignComboOpen, setCampaignComboOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid")
  const loadMoreRef = React.useRef<HTMLDivElement>(null)

  // Dialog "Adicionar Vídeo"
  const [addDialogOpen, setAddDialogOpen] = React.useState(false)
  const [addCampaignId, setAddCampaignId] = React.useState("")
  const [addCampaignComboOpen, setAddCampaignComboOpen] = React.useState(false)
  const [addTitle, setAddTitle] = React.useState("")
  const [addDescription, setAddDescription] = React.useState("")
  const [addOriginalUrl, setAddOriginalUrl] = React.useState("")
  const [uploadedFile, setUploadedFile] = React.useState<{
    url: string
    name: string
    size: number
    type: string
  } | null>(null)
  const [videoDuration, setVideoDuration] = React.useState<number | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const { startUpload, isUploading } = useUploadThing("rawVideo", {
    onClientUploadComplete: (res) => {
      if (res?.[0]) {
        setUploadedFile({
          url: res[0].ufsUrl,
          name: res[0].name,
          size: res[0].size,
          type: res[0].type,
        })
        toast.success("Arquivo enviado com sucesso!")
      }
    },
    onUploadError: (error) => {
      toast.error(error.message || "Erro ao enviar arquivo")
    },
  })

  const utils = api.useUtils()
  const createRawVideo = api.admin.createRawVideo.useMutation({
    onSuccess: () => {
      toast.success("Vídeo adicionado com sucesso!")
      setAddDialogOpen(false)
      resetAddForm()
      void utils.admin.getRawVideos.invalidate()
      void utils.admin.getRawVideosStats.invalidate()
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao adicionar vídeo")
    },
  })

  function resetAddForm() {
    setAddCampaignId("")
    setAddTitle("")
    setAddDescription("")
    setAddOriginalUrl("")
    setUploadedFile(null)
    setVideoDuration(null)
  }

  function handleFileSelect(files: FileList | null) {
    if (!files?.length) return
    const file = files[0]
    if (!file) return
    if (!file.type.startsWith("video/")) {
      toast.error("Apenas arquivos de vídeo são permitidos")
      return
    }
    // Melhoria: captura a duração no client antes do upload
    void readVideoDuration(file).then((duration) => {
      setVideoDuration(duration)
    })
    void startUpload([file])
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault()
    setIsDragging(false)
    handleFileSelect(event.dataTransfer.files)
  }

  function handleSubmitVideo() {
    if (!addCampaignId || !addTitle.trim() || !uploadedFile) return
    createRawVideo.mutate({
      campaignId: addCampaignId,
      title: addTitle.trim(),
      description: addDescription.trim() || undefined,
      storageUrl: uploadedFile.url,
      originalUrl: addOriginalUrl.trim() || undefined,
      fileSize: uploadedFile.size,
      mimeType: uploadedFile.type,
      duration: videoDuration ?? undefined,
    })
  }

  const canSubmit = !!addCampaignId && !!addTitle.trim() && !!uploadedFile
  const addYoutubePreview = addOriginalUrl ? getYoutubeId(addOriginalUrl) : null

  // Debounce da busca (300ms)
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Queries
  const { data: campaigns, isLoading: isLoadingCampaigns } =
    api.admin.getLibraryCampaigns.useQuery()

  const { data: stats, isLoading: isLoadingStats } =
    api.admin.getRawVideosStats.useQuery({
      campaignId: selectedCampaignId !== "all" ? selectedCampaignId : undefined,
    })

  const {
    data: videosData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingVideos,
  } = api.admin.getRawVideos.useInfiniteQuery(
    {
      campaignId: selectedCampaignId !== "all" ? selectedCampaignId : undefined,
      search: debouncedSearch || undefined,
      limit: 20,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  )

  const allVideos = videosData?.pages.flatMap((page) => page.videos) ?? []

  // Infinite scroll: observa a sentinela com margem de 200px
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage()
        }
      },
      { root: null, rootMargin: "200px", threshold: 0 },
    )

    const currentTarget = loadMoreRef.current
    if (currentTarget) observer.observe(currentTarget)

    return () => {
      if (currentTarget) observer.unobserve(currentTarget)
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const selectedCampaignName =
    selectedCampaignId === "all"
      ? "Todas as Competições"
      : (campaigns?.find((campaign) => campaign.id === selectedCampaignId)
          ?.name ?? "")

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero do acervo ===== */}
      <HomeHero
        eyebrow="Clipfy League · Competições"
        title={
          <>
            A <span className="text-gradient">biblioteca</span> de clipes
          </>
        }
        subtitle="Gerencie vídeos brutos e cortes das competições"
        isLoading={isLoadingStats}
        viz={<LibraryHeroViz />}
        vizSkeleton={<LibraryHeroVizSkeleton />}
        stats={[
          {
            icon: <FilmSlate className="size-3.5" weight="fill" />,
            label: "Vídeos",
            value: stats?.totalVideos ?? 0,
            kind: "int",
          },
          {
            icon: <Scissors className="size-3.5" weight="fill" />,
            label: "Cortes",
            value: stats?.totalClips ?? 0,
            kind: "int",
          },
          {
            icon: <Trophy className="size-3.5" weight="fill" />,
            label: "Competições",
            value: stats?.campaignsCount ?? 0,
            kind: "int",
          },
        ]}
      />

      {/* ===== KPIs ===== */}
      <Reveal immediate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<FilmSlate className="size-4" weight="fill" />}
            label="Vídeos Brutos"
            value={stats?.totalVideos ?? 0}
            kind="int"
            hint="no acervo"
            accent="cyan"
            gradientValue
            isLoading={isLoadingStats}
          />
          <StatTile
            icon={<Scissors className="size-4" weight="fill" />}
            label="Cortes Gerados"
            value={stats?.totalClips ?? 0}
            kind="int"
            hint="a partir dos brutos"
            accent="green"
            isLoading={isLoadingStats}
          />
          {/* Duração total é string formatada — tile custom espelhando o StatTile */}
          <div className="glass-card glass-card-hover flex flex-col gap-3 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
                Duração Total
              </span>
              <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
                <Clock className="size-4" weight="fill" />
              </span>
            </div>
            {isLoadingStats ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <span className="text-2xl font-bold tracking-tight tabular-nums sm:text-[1.7rem]">
                {formatDuration(stats?.totalDuration ?? 0)}
              </span>
            )}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">de conteúdo bruto</span>
            </div>
          </div>
          <StatTile
            icon={<Trophy className="size-4" weight="fill" />}
            label="Competições"
            value={stats?.campaignsCount ?? 0}
            kind="int"
            hint="com vídeos"
            accent="cyan"
            isLoading={isLoadingStats}
          />
        </div>
      </Reveal>

      {/* ===== Toolbar: competição, busca, visualização e novo vídeo ===== */}
      <Reveal immediate delayMs={60}>
        {isLoadingCampaigns ? (
          <ToolbarSkeleton buttons={3} />
        ) : (
          <div className="glass-card flex flex-col gap-3 rounded-3xl p-3.5 sm:p-4 lg:flex-row lg:items-center">
            {/* Filtro de competição */}
            <Popover open={campaignComboOpen} onOpenChange={setCampaignComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={campaignComboOpen}
                  className="h-10 w-full cursor-pointer justify-between gap-2 rounded-xl lg:w-auto lg:min-w-60"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Funnel className="text-muted-foreground size-4 shrink-0" />
                    <span className="truncate text-sm">
                      {selectedCampaignName}
                    </span>
                  </span>
                  <CaretUpDown className="size-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 rounded-xl p-0" align="start">
                <Command className="rounded-xl">
                  <CommandInput placeholder="Buscar competição..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>Nenhuma competição encontrada.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all"
                        onSelect={() => {
                          setSelectedCampaignId("all")
                          setCampaignComboOpen(false)
                        }}
                        className="cursor-pointer"
                      >
                        <Trophy className="text-muted-foreground size-3.5" />
                        Todas as Competições
                        <Check
                          className={cn(
                            "ml-auto size-3.5",
                            selectedCampaignId === "all"
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                      </CommandItem>
                      {campaigns?.map((campaign) => (
                        <CommandItem
                          key={campaign.id}
                          value={campaign.name}
                          onSelect={() => {
                            setSelectedCampaignId(campaign.id)
                            setCampaignComboOpen(false)
                          }}
                          className="cursor-pointer"
                        >
                          <Trophy
                            className="text-brand-cyan not-dark:text-primary size-3.5"
                            weight="fill"
                          />
                          <span className="truncate">{campaign.name}</span>
                          <Check
                            className={cn(
                              "ml-auto size-3.5",
                              selectedCampaignId === campaign.id
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Busca */}
            <div className="relative min-w-0 flex-1">
              <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar vídeos..."
                className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl pl-10"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Limpar busca"
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              {/* Toggle grid/list */}
              <div className="border-border/70 flex h-10 shrink-0 items-center overflow-hidden rounded-xl border">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  aria-label="Visualização em grade"
                  className={cn(
                    "flex h-full cursor-pointer items-center justify-center px-3 transition-colors",
                    viewMode === "grid"
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                  )}
                >
                  <SquaresFour className="size-4" weight="fill" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  aria-label="Visualização em lista"
                  className={cn(
                    "border-border/70 flex h-full cursor-pointer items-center justify-center border-l px-3 transition-colors",
                    viewMode === "list"
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                  )}
                >
                  <List className="size-4" weight="bold" />
                </button>
              </div>

              <Button
                onClick={() => setAddDialogOpen(true)}
                className="btn-gradient-auth h-10 flex-1 cursor-pointer rounded-xl px-4 font-semibold sm:flex-none"
              >
                <Plus className="size-4" weight="bold" />
                Adicionar Vídeo
              </Button>
            </div>
          </div>
        )}
      </Reveal>

      {/* ===== Conteúdo ===== */}
      {isLoadingVideos ? (
        viewMode === "grid" ? (
          <CardGridSkeleton
            count={6}
            aspectClass="aspect-video"
            gridClass="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
            withStats={false}
          />
        ) : (
          <VideoListSkeleton rows={6} />
        )
      ) : allVideos.length === 0 ? (
        <Reveal immediate>
          <div className="glass-card flex flex-col items-center gap-4 rounded-3xl py-16 text-center">
            <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
              <FolderOpen className="size-6" weight="fill" />
            </span>
            <div>
              <p className="text-base font-bold">Nenhum vídeo encontrado</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Tente ajustar os filtros ou adicione um novo vídeo
              </p>
            </div>
            <Button
              onClick={() => setAddDialogOpen(true)}
              className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
            >
              <Plus className="size-4" weight="bold" />
              Adicionar Vídeo
            </Button>
          </div>
        </Reveal>
      ) : (
        <>
          {viewMode === "grid" ? (
            /* ===== Grid view ===== */
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {allVideos.map((video, index) => {
                const youtubeId = video.originalUrl
                  ? getYoutubeId(video.originalUrl)
                  : null
                return (
                  <Reveal immediate key={video.id} delayMs={(index % 3) * 80}>
                    <div className="glass-card glass-card-hover group flex h-full flex-col overflow-hidden rounded-3xl">
                      {/* Mídia 16:9 */}
                      <div className="relative aspect-video w-full overflow-hidden bg-black/80">
                        {youtubeId ? (
                          <iframe
                            src={`https://www.youtube.com/embed/${youtubeId}`}
                            title={video.title ?? "Vídeo"}
                            allow={YOUTUBE_EMBED_ALLOW}
                            allowFullScreen
                            className="absolute inset-0 h-full w-full"
                          />
                        ) : video.thumbnail ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={video.thumbnail}
                              alt={video.title ?? ""}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <span className="flex size-13 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur-sm transition-transform group-hover:scale-110">
                                <Play className="size-6 text-white" weight="fill" />
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="dashboard-galaxy dark absolute inset-0 flex flex-col items-center justify-center gap-2">
                            <span className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/10 transition-transform group-hover:scale-110">
                              <Play className="size-6 text-white/70" weight="fill" />
                            </span>
                            <span className="flex items-center gap-1.5 text-[10px] text-white/35">
                              <HardDrive className="size-3" weight="fill" />
                              Google Cloud Storage
                            </span>
                          </div>
                        )}
                        {video.duration ? (
                          <span className="absolute right-2.5 bottom-2.5 rounded-lg border border-white/10 bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white tabular-nums backdrop-blur-sm">
                            {formatDuration(video.duration)}
                          </span>
                        ) : null}
                        {youtubeId && (
                          <span className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-600/80 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
                            <YoutubeLogo className="size-3.5" weight="fill" />
                            YouTube
                          </span>
                        )}
                      </div>

                      {/* Corpo */}
                      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
                        <h3 className="group-hover:text-brand-cyan not-dark:group-hover:text-primary line-clamp-2 text-sm leading-tight font-bold tracking-tight transition-colors">
                          {video.title ?? "Sem título"}
                        </h3>

                        {video.description && (
                          <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
                            {video.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className="border-brand-cyan/25 text-brand-cyan not-dark:border-primary/30 not-dark:text-primary max-w-full gap-1 rounded-full text-[10px]"
                          >
                            <Trophy className="size-2.5" weight="fill" />
                            <span className="truncate">{video.campaign.name}</span>
                          </Badge>
                          <Badge
                            variant="outline"
                            className="gap-1 rounded-full border-violet-500/30 text-[10px] text-violet-600 dark:text-violet-400"
                          >
                            <Scissors className="size-2.5" weight="fill" />
                            {video.clipsCount} cortes
                          </Badge>
                        </div>

                        <div className="border-border/60 mt-auto flex items-center justify-between border-t pt-3">
                          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                            <CalendarBlank className="size-3.5" />
                            {formatDate(video.createdAt)}
                          </span>
                          {video.originalUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              className="hover:text-brand-cyan not-dark:hover:text-primary size-7 cursor-pointer rounded-lg p-0"
                            >
                              <a
                                href={video.originalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Ver original"
                                aria-label="Ver original"
                              >
                                <ArrowSquareOut className="size-3.5" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Reveal>
                )
              })}
            </div>
          ) : (
            /* ===== List view ===== */
            <div className="flex flex-col gap-3">
              {allVideos.map((video, index) => {
                const youtubeId = video.originalUrl
                  ? getYoutubeId(video.originalUrl)
                  : null
                return (
                  <Reveal immediate key={video.id} delayMs={(index % 4) * 60}>
                    <div className="glass-card glass-card-hover group flex items-start gap-4 rounded-3xl p-3.5 sm:gap-5 sm:p-4">
                      {/* Mídia */}
                      <div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-xl bg-black/80 ring-1 ring-white/10 sm:w-52">
                        {youtubeId ? (
                          <iframe
                            src={`https://www.youtube.com/embed/${youtubeId}`}
                            title={video.title ?? "Vídeo"}
                            allow={YOUTUBE_EMBED_ALLOW}
                            allowFullScreen
                            className="absolute inset-0 h-full w-full"
                          />
                        ) : video.thumbnail ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={video.thumbnail}
                              alt={video.title ?? ""}
                              className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <Play className="size-5 text-white" weight="fill" />
                            </div>
                          </>
                        ) : (
                          <div className="dashboard-galaxy dark absolute inset-0 flex flex-col items-center justify-center gap-1">
                            <Play className="size-5 text-white/60" weight="fill" />
                            <span className="text-[8px] text-white/30">GCS</span>
                          </div>
                        )}
                        {video.duration ? (
                          <span className="absolute right-1.5 bottom-1.5 rounded-md border border-white/10 bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white tabular-nums">
                            {formatDuration(video.duration)}
                          </span>
                        ) : null}
                        {youtubeId && (
                          <span className="absolute top-1.5 left-1.5 flex items-center rounded-md border border-red-500/25 bg-red-600/80 px-1.5 py-0.5 text-white">
                            <YoutubeLogo className="size-2.5" weight="fill" />
                          </span>
                        )}
                      </div>

                      {/* Conteúdo */}
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <h3 className="group-hover:text-brand-cyan not-dark:group-hover:text-primary truncate text-sm leading-tight font-bold tracking-tight transition-colors">
                          {video.title ?? "Sem título"}
                        </h3>
                        {video.description && (
                          <p className="text-muted-foreground line-clamp-1 text-xs leading-relaxed">
                            {video.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                          <Badge
                            variant="outline"
                            className="border-brand-cyan/25 text-brand-cyan not-dark:border-primary/30 not-dark:text-primary max-w-full gap-1 rounded-full text-[10px]"
                          >
                            <Trophy className="size-2.5" weight="fill" />
                            <span className="truncate">{video.campaign.name}</span>
                          </Badge>
                          <Badge
                            variant="outline"
                            className="gap-1 rounded-full border-violet-500/30 text-[10px] text-violet-600 dark:text-violet-400"
                          >
                            <Scissors className="size-2.5" weight="fill" />
                            {video.clipsCount} cortes
                          </Badge>
                          <span className="text-muted-foreground inline-flex items-center gap-1 text-[10px]">
                            <CalendarBlank className="size-3.5" />
                            {formatDate(video.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Ações */}
                      {video.originalUrl && (
                        <div className="flex shrink-0 items-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="hover:text-brand-cyan not-dark:hover:text-primary size-7 cursor-pointer rounded-lg p-0"
                          >
                            <a
                              href={video.originalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Ver original"
                              aria-label="Ver original"
                            >
                              <LinkSimple className="size-3.5" />
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                  </Reveal>
                )
              })}
            </div>
          )}

          {/* Sentinela do infinite scroll */}
          <div ref={loadMoreRef} className="flex flex-col gap-4">
            {isFetchingNextPage &&
              (viewMode === "grid" ? (
                <CardGridSkeleton
                  count={3}
                  aspectClass="aspect-video"
                  gridClass="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
                  withStats={false}
                />
              ) : (
                <VideoListSkeleton rows={3} />
              ))}
            {!hasNextPage && (
              <p className="text-muted-foreground py-2 text-center text-xs">
                Todos os vídeos foram carregados
              </p>
            )}
          </div>
        </>
      )}

      {/* ===== Dialog "Adicionar Vídeo" ===== */}
      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open)
          if (!open) resetAddForm()
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[92svh] w-full flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-2xl"
        >
          {/* Header */}
          <div className="border-border/60 relative shrink-0 border-b px-4 pt-4 pb-4 sm:px-6 sm:pt-5">
            <div
              aria-hidden
              className="bg-gradient-custom pointer-events-none absolute -top-24 -right-16 size-48 rounded-full opacity-10 blur-3xl"
            />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="bg-gradient-custom flex size-10 shrink-0 items-center justify-center rounded-xl text-[#04222A] shadow-[0_8px_24px_-8px_var(--brand-cyan)] sm:size-11">
                  <UploadSimple className="size-5" weight="bold" />
                </span>
                <div className="min-w-0">
                  <DialogTitle className="truncate text-lg font-bold tracking-tight sm:text-xl">
                    Adicionar{" "}
                    <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
                      Vídeo Bruto
                    </span>
                  </DialogTitle>
                  <DialogDescription className="truncate text-xs sm:text-sm">
                    Adicione um novo vídeo bruto à biblioteca
                  </DialogDescription>
                </div>
              </div>
              <DialogClose asChild>
                <button
                  type="button"
                  aria-label="Fechar"
                  className="text-muted-foreground hover:bg-muted/60 hover:text-foreground flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors"
                >
                  <X className="size-4" weight="bold" />
                </button>
              </DialogClose>
            </div>
          </div>

          {/* Corpo rolável */}
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
            <div className="flex flex-col gap-5">
              {/* Competição */}
              <div className="flex flex-col gap-2">
                <Label className="flex items-center gap-1.5 text-sm font-semibold">
                  <Trophy
                    className="text-brand-mint not-dark:text-primary size-4"
                    weight="fill"
                  />
                  Competição <span className="text-red-400">*</span>
                </Label>
                <Popover
                  open={addCampaignComboOpen}
                  onOpenChange={setAddCampaignComboOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={addCampaignComboOpen}
                      className="h-11 w-full cursor-pointer justify-between gap-2 rounded-xl"
                    >
                      <span
                        className={cn(
                          "truncate",
                          !addCampaignId && "text-muted-foreground font-normal",
                        )}
                      >
                        {addCampaignId
                          ? campaigns?.find(
                              (campaign) => campaign.id === addCampaignId,
                            )?.name
                          : "Selecione uma competição"}
                      </span>
                      <CaretUpDown className="size-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] rounded-xl p-0"
                    align="start"
                  >
                    <Command className="rounded-xl">
                      <CommandInput
                        placeholder="Buscar competição..."
                        className="h-9"
                      />
                      <CommandList>
                        <CommandEmpty>
                          Nenhuma competição encontrada.
                        </CommandEmpty>
                        <CommandGroup>
                          {campaigns?.map((campaign) => (
                            <CommandItem
                              key={campaign.id}
                              value={campaign.name}
                              onSelect={() => {
                                setAddCampaignId(campaign.id)
                                setAddCampaignComboOpen(false)
                              }}
                              className="cursor-pointer"
                            >
                              <Trophy
                                className="text-brand-cyan not-dark:text-primary size-3.5"
                                weight="fill"
                              />
                              <span className="truncate">{campaign.name}</span>
                              <Check
                                className={cn(
                                  "ml-auto size-3.5",
                                  addCampaignId === campaign.id
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Título */}
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="video-title"
                  className="flex items-center gap-1.5 text-sm font-semibold"
                >
                  <TextAa className="text-muted-foreground size-4" />
                  Título <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="video-title"
                  value={addTitle}
                  onChange={(event) => setAddTitle(event.target.value)}
                  placeholder="Ex.: Entrevista completa — Podcast"
                  className="focus-visible:ring-brand-cyan/40 h-11 rounded-xl"
                />
              </div>

              {/* Descrição */}
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="video-description"
                  className="flex items-center gap-1.5 text-sm font-semibold"
                >
                  <TextAlignLeft className="text-muted-foreground size-4" />
                  Descrição{" "}
                  <span className="text-muted-foreground text-[10px] font-normal">
                    (opcional)
                  </span>
                </Label>
                <Textarea
                  id="video-description"
                  value={addDescription}
                  onChange={(event) => setAddDescription(event.target.value)}
                  placeholder="Breve descrição do conteúdo do vídeo..."
                  rows={3}
                  className="focus-visible:ring-brand-cyan/40 resize-none rounded-xl"
                />
              </div>

              {/* Arquivo de vídeo */}
              <div className="flex flex-col gap-2.5">
                <Label className="flex items-center gap-1.5 text-sm font-semibold">
                  <FileVideo className="text-muted-foreground size-4" />
                  Arquivo de Vídeo <span className="text-red-400">*</span>
                </Label>

                {uploadedFile ? (
                  <div className="relative rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                    <button
                      type="button"
                      onClick={() => {
                        setUploadedFile(null)
                        setVideoDuration(null)
                      }}
                      aria-label="Remover arquivo"
                      className="border-border/60 bg-background/80 absolute top-2.5 right-2.5 flex size-6 cursor-pointer items-center justify-center rounded-lg border transition-colors hover:border-red-500/40 hover:bg-red-500/10"
                    >
                      <X className="text-muted-foreground size-3" weight="bold" />
                    </button>
                    <div className="flex items-center gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
                        <CheckCircle
                          className="size-5 text-emerald-500 dark:text-emerald-400"
                          weight="fill"
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {uploadedFile.name}
                        </p>
                        <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px]">
                          <span className="tabular-nums">
                            {(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB
                          </span>
                          <span>·</span>
                          <span className="font-semibold text-emerald-500 dark:text-emerald-400">
                            Upload completo
                          </span>
                          {videoDuration ? (
                            <>
                              <span>·</span>
                              <span className="tabular-nums">
                                {formatDuration(videoDuration)}
                              </span>
                            </>
                          ) : null}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : isUploading ? (
                  <div className="border-brand-cyan/30 bg-brand-cyan/5 not-dark:border-primary/30 not-dark:bg-primary/5 flex flex-col items-center gap-3 rounded-2xl border p-6">
                    <span className="bg-brand-cyan/15 not-dark:bg-primary/10 flex size-12 items-center justify-center rounded-2xl">
                      <CircleNotch className="text-brand-cyan not-dark:text-primary size-6 animate-spin" />
                    </span>
                    <div className="text-center">
                      <p className="text-sm font-semibold">Enviando vídeo...</p>
                      <p className="text-muted-foreground mt-0.5 text-[11px]">
                        Isso pode levar alguns minutos
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={(event) => {
                      event.preventDefault()
                      setIsDragging(true)
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "group cursor-pointer rounded-2xl border-2 border-dashed p-6 transition-all sm:p-8",
                      isDragging
                        ? "border-brand-cyan bg-brand-cyan/8 not-dark:border-primary not-dark:bg-primary/5 scale-[1.01]"
                        : "border-border/70 hover:border-brand-cyan/50 hover:bg-brand-cyan/5 not-dark:hover:border-primary/50 not-dark:hover:bg-primary/5",
                    )}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(event) => handleFileSelect(event.target.files)}
                    />
                    <div className="flex flex-col items-center gap-3">
                      <span
                        className={cn(
                          "flex size-14 items-center justify-center rounded-2xl transition-all",
                          isDragging
                            ? "bg-brand-cyan/20 not-dark:bg-primary/15 scale-110"
                            : "bg-muted/40 group-hover:bg-brand-cyan/10 not-dark:group-hover:bg-primary/10 group-hover:scale-105",
                        )}
                      >
                        <UploadSimple
                          className={cn(
                            "size-7 transition-colors",
                            isDragging
                              ? "text-brand-cyan not-dark:text-primary"
                              : "text-muted-foreground group-hover:text-brand-cyan not-dark:group-hover:text-primary",
                          )}
                          weight="bold"
                        />
                      </span>
                      <div className="text-center">
                        <p className="text-sm font-semibold">
                          {isDragging
                            ? "Solte o arquivo aqui"
                            : "Arraste e solte ou clique para selecionar"}
                        </p>
                        <p className="text-muted-foreground mt-1 text-[11px]">
                          MP4, MOV, AVI, MKV, WebM — até 1GB
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* URL original */}
              <div className="border-border/70 bg-card/40 flex flex-col gap-3 rounded-2xl border p-4">
                <div className="flex flex-col gap-2">
                  <Label
                    htmlFor="video-original-url"
                    className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <Globe className="size-3.5" />
                    URL Original (YouTube, etc.){" "}
                    <span className="font-normal">(opcional)</span>
                  </Label>
                  <Input
                    id="video-original-url"
                    value={addOriginalUrl}
                    onChange={(event) => setAddOriginalUrl(event.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    inputMode="url"
                    className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl text-sm"
                  />
                </div>

                {addYoutubePreview && (
                  <div className="border-border/60 overflow-hidden rounded-xl border bg-black/80">
                    <div className="relative aspect-video">
                      <iframe
                        src={`https://www.youtube.com/embed/${addYoutubePreview}`}
                        title="Preview do YouTube"
                        allow={YOUTUBE_EMBED_ALLOW}
                        allowFullScreen
                        className="absolute inset-0 h-full w-full"
                      />
                    </div>
                    <div className="bg-card/60 flex items-center gap-2 px-3 py-2">
                      <YoutubeLogo
                        className="size-4 shrink-0 text-red-500"
                        weight="fill"
                      />
                      <span className="text-muted-foreground truncate text-[11px]">
                        Preview do YouTube detectado
                      </span>
                      <CheckCircle
                        className="ml-auto size-3.5 shrink-0 text-emerald-500 dark:text-emerald-400"
                        weight="fill"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-border/60 bg-background/85 shrink-0 border-t px-4 py-3 backdrop-blur-md sm:px-6 sm:py-3.5">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAddDialogOpen(false)
                  resetAddForm()
                }}
                disabled={createRawVideo.isPending || isUploading}
                className="h-10 cursor-pointer rounded-xl sm:h-11"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSubmitVideo}
                disabled={!canSubmit || createRawVideo.isPending || isUploading}
                className="btn-gradient-auth h-10 cursor-pointer rounded-xl px-4 font-semibold sm:h-11 sm:px-5"
              >
                {createRawVideo.isPending ? (
                  <>
                    <CircleNotch className="size-4 animate-spin" />
                    Adicionando...
                  </>
                ) : (
                  <>
                    <Plus className="size-4" weight="bold" />
                    Adicionar Vídeo
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ========================================================================
   Skeleton da list view — ossos horizontais espelhando a linha real
   ======================================================================== */

function VideoListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="glass-card flex items-start gap-4 rounded-3xl p-3.5 sm:gap-5 sm:p-4"
        >
          <Bone
            delay={index * 90}
            className="aspect-video w-40 shrink-0 rounded-xl sm:w-52"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <Bone delay={index * 90 + 50} className="h-4 w-2/3 max-w-72" />
            <Bone
              delay={index * 90 + 100}
              className="h-3 w-4/5 max-w-96 rounded-full"
            />
            <div className="flex flex-wrap gap-1.5">
              <Bone delay={index * 90 + 150} className="h-5 w-24 rounded-full" />
              <Bone delay={index * 90 + 200} className="h-5 w-20 rounded-full" />
              <Bone
                delay={index * 90 + 250}
                className="hidden h-5 w-24 rounded-full sm:block"
              />
            </div>
          </div>
          <Bone delay={index * 90 + 300} className="size-7 shrink-0 rounded-lg" />
        </div>
      ))}
    </div>
  )
}
