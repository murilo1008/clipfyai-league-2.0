"use client"

import * as React from "react"
import Image from "next/image"
import {
  ArrowSquareOut,
  ArrowsClockwise,
  ArrowsDownUp,
  ArrowsLeftRight,
  At,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  ChatCircle,
  CheckCircle,
  Clock,
  Eye,
  FunnelSimple,
  Heart,
  MagnifyingGlass,
  Play,
  Pulse,
  ShareFat,
  Spinner,
  Trash,
  TrendUp,
  UserCheck,
  Warning,
  X,
  XCircle,
} from "@phosphor-icons/react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"

import { PostMetricsHistoryDialog } from "@/app/(dashboard)/posts/post-metrics-history-dialog"
import { Bone, CardGridSkeleton } from "@/components/shared/skeletons"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"
import { api, type RouterOutputs } from "@/trpc/react"

import {
  CLIP_POST_STATUS_CONFIG,
  ConfirmWordInput,
  EmptyState,
  formatClipPostListedAt,
  formatNumber,
  IneligibilityReasonNotice,
  PostPreviewFallback,
  type CompetitionTabProps,
} from "./shared"

type AdminClipPost =
  RouterOutputs["admin"]["getCompetitionPostsAdmin"]["posts"][number]

type PostsSortBy =
  | "recent"
  | "views"
  | "likes"
  | "comments"
  | "shares"
  | "engagement"

const POST_STATUS_ORDER = [
  "PENDING",
  "ELIGIBLE",
  "INELIGIBLE",
  "DISQUALIFIED",
] as const

const SORT_OPTIONS: Array<{
  value: PostsSortBy
  label: string
  icon: React.ElementType
}> = [
  { value: "recent", label: "Mais Recentes", icon: Clock },
  { value: "views", label: "Mais Vistos", icon: Eye },
  { value: "likes", label: "Mais Curtidos", icon: Heart },
  { value: "comments", label: "Mais Comentados", icon: ChatCircle },
  { value: "shares", label: "Mais Compartilhados", icon: ShareFat },
  { value: "engagement", label: "Maior Engajamento", icon: TrendUp },
]

const PLATFORM_FILTER_ORDER: PlatformKey[] = [
  "INSTAGRAM",
  "TIKTOK",
  "YOUTUBE",
  "KWAI",
  "FACEBOOK",
]

/** Lista de páginas com reticências (máx. 7 slots visíveis). */
function buildPageList(
  totalPages: number,
  current: number,
): Array<number | "ellipsis"> {
  const pages: Array<number | "ellipsis"> = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
    return pages
  }
  pages.push(1)
  if (current > 3) pages.push("ellipsis")
  const start = Math.max(2, current - 1)
  const end = Math.min(totalPages - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (current < totalPages - 2) pages.push("ellipsis")
  pages.push(totalPages)
  return pages
}

/* ============================================================
   Filtro de data/hora de postagem
   ============================================================ */

/** Valor local no formato "yyyy-MM-ddTHH:mm" → ISO (UTC) aceito pelo backend. */
function toPostedAtIso(value: string): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

function getPostedAtDate(value: string): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function getPostedAtTime(value: string): string {
  return value.includes("T") ? value.slice(11, 16) : "00:00"
}

/**
 * Seletor de data + hora usado nos filtros "Postado a partir de" / "Postado até".
 * O valor é sempre "yyyy-MM-ddTHH:mm" (ou "" quando limpo).
 */
function PostedAtFilter({
  value,
  onChange,
  label,
  placeholder,
  min,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder: string
  min?: string
}) {
  const [open, setOpen] = React.useState(false)
  const timeInputId = React.useId()

  const selectedDate = getPostedAtDate(value)
  const timeValue = value ? getPostedAtTime(value) : "00:00"
  const minDate = min ? min.slice(0, 10) : undefined

  /** Nunca deixa o valor cair abaixo do mínimo (data inicial). */
  const emitChange = (nextValue: string) => {
    if (min && nextValue < min) {
      onChange(min)
      return
    }
    onChange(nextValue)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={label}
          className={cn(
            "h-10 w-full min-w-0 cursor-pointer justify-start gap-2 rounded-xl text-left text-sm font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarBlank className="size-4 shrink-0" />
          <span className="min-w-0 truncate">
            {selectedDate
              ? format(selectedDate, "dd/MM/yyyy HH:mm", { locale: ptBR })
              : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl p-0"
      >
        <div className="border-border/60 border-b px-3 py-2">
          <p className="text-sm font-semibold">{label}</p>
        </div>

        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (!date) return
            emitChange(`${format(date, "yyyy-MM-dd")}T${timeValue}`)
          }}
          disabled={(date) =>
            minDate ? format(date, "yyyy-MM-dd") < minDate : false
          }
          defaultMonth={selectedDate}
          locale={ptBR}
          autoFocus
        />

        <div className="border-border/60 flex flex-col gap-1.5 border-t p-3">
          <Label htmlFor={timeInputId} className="text-muted-foreground text-xs">
            Horário
          </Label>
          <div className="flex items-center gap-2">
            <Clock className="text-muted-foreground size-4 shrink-0" />
            <Input
              id={timeInputId}
              type="time"
              value={timeValue}
              disabled={!selectedDate}
              onChange={(event) => {
                if (!selectedDate) return
                emitChange(
                  `${format(selectedDate, "yyyy-MM-dd")}T${event.target.value || "00:00"}`,
                )
              }}
              className="h-9 min-w-0 rounded-lg tabular-nums"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Limpar filtro "${label}"`}
              disabled={!value}
              onClick={() => {
                onChange("")
                setOpen(false)
              }}
              className="text-muted-foreground flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg p-0"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ============================================================
   Tab "Posts Recentes"
   ============================================================ */

export function PostsTab({ slug, data, active, refetch }: CompetitionTabProps) {
  const utils = api.useUtils()

  /* ===== Filtros + paginação (server-side) ===== */
  const [page, setPage] = React.useState(1)
  const [sortBy, setSortBy] = React.useState<PostsSortBy>("recent")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [platformFilter, setPlatformFilter] = React.useState("all")
  const [clipperSearch, setClipperSearch] = React.useState("")
  const [accountSearch, setAccountSearch] = React.useState("")
  const [linkSearch, setLinkSearch] = React.useState("")
  /** "yyyy-MM-ddTHH:mm" (hora local) ou "" */
  const [postedAtFrom, setPostedAtFrom] = React.useState("")
  const [postedAtTo, setPostedAtTo] = React.useState("")

  /* ===== Dialogs ===== */
  const [metricsHistoryPostId, setMetricsHistoryPostId] = React.useState<
    string | null
  >(null)

  const [isStatusOpen, setIsStatusOpen] = React.useState(false)
  const [selectedPost, setSelectedPost] = React.useState<AdminClipPost | null>(
    null,
  )
  const [newPostStatus, setNewPostStatus] = React.useState("")
  const [ineligibilityReason, setIneligibilityReason] = React.useState("")

  const [isReassignOpen, setIsReassignOpen] = React.useState(false)
  const [postToReassign, setPostToReassign] =
    React.useState<AdminClipPost | null>(null)
  const [targetApplicationId, setTargetApplicationId] = React.useState("")

  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)
  const [postToDelete, setPostToDelete] = React.useState<AdminClipPost | null>(
    null,
  )
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("")

  const hasActiveFilters =
    statusFilter !== "all" ||
    platformFilter !== "all" ||
    !!clipperSearch ||
    !!accountSearch ||
    !!linkSearch ||
    !!postedAtFrom ||
    !!postedAtTo

  /* ===== Query paginada (sem debounce — filtros server-side) ===== */
  const {
    data: postsData,
    isLoading: isLoadingPosts,
    isFetching: isFetchingPosts,
    refetch: refetchPosts,
  } = api.admin.getCompetitionPostsAdmin.useQuery(
    {
      slug,
      page,
      pageSize: 24,
      sortBy,
      status: statusFilter !== "all" ? statusFilter : undefined,
      platform: platformFilter !== "all" ? platformFilter : undefined,
      clipperSearch: clipperSearch || undefined,
      accountSearch: accountSearch || undefined,
      linkSearch: linkSearch || undefined,
      postedAtFrom: toPostedAtIso(postedAtFrom),
      postedAtTo: toPostedAtIso(postedAtTo),
    },
    {
      enabled: active,
      placeholderData: (prev) => prev,
    },
  )

  const { data: reassignTargetsData, isLoading: isLoadingReassignTargets } =
    api.admin.getClipPostReassignmentTargets.useQuery(
      { clipPostId: postToReassign?.id ?? "" },
      { enabled: isReassignOpen && !!postToReassign?.id },
    )

  /* ===== Mutations (toasts + invalidações idênticos ao original) ===== */
  const updateClipPostStatus = api.admin.updateClipPostStatus.useMutation({
    onSuccess: async () => {
      toast.success("Status do post atualizado com sucesso!")
      setIsStatusOpen(false)
      setSelectedPost(null)
      setNewPostStatus("")
      setIneligibilityReason("")
      await Promise.all([
        utils.admin.getCompetitionDetailsAdmin.invalidate({ slug }),
        utils.admin.getCompetitionPostsAdmin.invalidate(),
        utils.campaign.getCompetitionDetails.invalidate(),
      ])
      refetch()
    },
    onError: (error) =>
      toast.error(error.message || "Erro ao atualizar status do post"),
  })

  const deleteClipPost = api.admin.deleteClipPost.useMutation({
    onSuccess: async () => {
      toast.success("Post deletado com sucesso!", {
        description: "O post foi removido permanentemente da competição",
      })
      setIsDeleteOpen(false)
      setPostToDelete(null)
      setDeleteConfirmText("")
      await Promise.all([
        utils.admin.getCompetitionDetailsAdmin.invalidate({ slug }),
        utils.admin.getCompetitionPostsAdmin.invalidate(),
        utils.campaign.getCompetitionDetails.invalidate(),
      ])
      refetch()
    },
    onError: (error) => toast.error(error.message || "Erro ao deletar post"),
  })

  const reassignClipPostCompetition =
    api.admin.reassignClipPostCompetition.useMutation({
      onSuccess: async (result) => {
        toast.success(
          result.message || "Vídeo movido de competição com sucesso!",
        )
        setIsReassignOpen(false)
        setPostToReassign(null)
        setTargetApplicationId("")
        await Promise.all([
          utils.admin.getCompetitionDetailsAdmin.invalidate({ slug }),
          utils.admin.getCompetitionPostsAdmin.invalidate(),
          utils.admin.getClipPostReassignmentTargets.invalidate(),
          utils.campaign.getCompetitionDetails.invalidate(),
          refetchPosts(),
        ])
        refetch()
      },
      onError: (error) =>
        toast.error(error.message || "Erro ao trocar vídeo de competição"),
    })

  /* ===== Handlers ===== */
  const openChangeStatusDialog = (post: AdminClipPost) => {
    setSelectedPost(post)
    setNewPostStatus(post.status || "")
    setIneligibilityReason("")
    setIsStatusOpen(true)
  }

  const openReassignPostDialog = (post: AdminClipPost) => {
    setPostToReassign(post)
    setTargetApplicationId("")
    setIsReassignOpen(true)
  }

  const openDeletePostDialog = (post: AdminClipPost) => {
    setPostToDelete(post)
    setDeleteConfirmText("")
    setIsDeleteOpen(true)
  }

  const handlePostStatusChange = () => {
    if (!selectedPost || !newPostStatus) {
      toast.error("Selecione um status para o post")
      return
    }
    if (
      (newPostStatus === "INELIGIBLE" || newPostStatus === "DISQUALIFIED") &&
      !ineligibilityReason.trim()
    ) {
      toast.error(
        "Por favor, informe o motivo da ineligibilidade/desqualificação",
      )
      return
    }
    updateClipPostStatus.mutate({
      clipPostId: selectedPost.id,
      status: newPostStatus as (typeof POST_STATUS_ORDER)[number],
      ineligibilityReason: ineligibilityReason.trim() || undefined,
    })
  }

  const handleReassignPost = () => {
    if (!postToReassign) {
      toast.error("Nenhum post selecionado")
      return
    }
    if (!targetApplicationId) {
      toast.error("Selecione a competição de destino")
      return
    }
    reassignClipPostCompetition.mutate({
      clipPostId: postToReassign.id,
      targetApplicationId,
    })
  }

  const handleDeletePost = () => {
    if (deleteConfirmText !== "DELETAR") {
      toast.error("Digite 'DELETAR' para confirmar a exclusão", {
        description: "Esta ação é irreversível!",
      })
      return
    }
    if (!postToDelete) {
      toast.error("Nenhum post selecionado")
      return
    }
    deleteClipPost.mutate({ clipPostId: postToDelete.id })
  }

  const clearFilters = () => {
    setStatusFilter("all")
    setPlatformFilter("all")
    setClipperSearch("")
    setAccountSearch("")
    setLinkSearch("")
    setPostedAtFrom("")
    setPostedAtTo("")
    setPage(1)
  }

  const pagination = postsData?.pagination
  const totalCount = pagination?.totalCount ?? 0
  const requiresReason =
    newPostStatus === "INELIGIBLE" || newPostStatus === "DISQUALIFIED"

  return (
    <div className="flex flex-col gap-4">
      {/* ===== Header + filtros ===== */}
      <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex items-start gap-2.5">
            <span className="bg-gradient-custom flex size-9 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
              <Play className="size-4.5" weight="fill" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">
                  Todos os Posts
                </h2>
                {postsData && (
                  <Badge
                    variant="outline"
                    className="rounded-full border-[color-mix(in_oklab,var(--brand-cyan)_45%,transparent)] bg-[color-mix(in_oklab,var(--brand-cyan)_12%,transparent)] font-semibold tabular-nums"
                  >
                    {totalCount} {totalCount === 1 ? "post" : "posts"}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className="gap-1 rounded-full border-orange-500/40 bg-gradient-to-r from-orange-500/20 to-amber-500/20 font-semibold text-orange-500 tabular-nums dark:text-orange-400"
                >
                  <TrendUp className="size-3 animate-pulse" weight="bold" />
                  {data.todayPostsCount}{" "}
                  {data.todayPostsCount === 1 ? "post hoje" : "posts hoje"}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs sm:text-[13px]">
                Posts enviados na competição • Página {pagination?.page ?? 1} de{" "}
                {pagination?.totalPages ?? 1}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 cursor-pointer rounded-xl"
              onClick={() => void refetchPosts()}
              disabled={isFetchingPosts}
            >
              <ArrowsClockwise
                className={cn("size-3.5", isFetchingPosts && "animate-spin")}
              />
              Atualizar
            </Button>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 cursor-pointer rounded-xl"
                onClick={clearFilters}
              >
                <XCircle className="size-3.5" />
                Limpar Filtros
              </Button>
            )}
          </div>
        </div>

        {/* ===== Filtros avançados ===== */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Busca por link */}
          <div className="relative sm:col-span-2 lg:col-span-1">
            <MagnifyingGlass className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              placeholder="Buscar por link do post..."
              value={linkSearch}
              onChange={(event) => {
                setLinkSearch(event.target.value)
                setPage(1)
              }}
              className="h-10 rounded-xl pl-9"
            />
          </div>

          {/* Plataforma */}
          <Select
            value={platformFilter}
            onValueChange={(value) => {
              setPlatformFilter(value)
              setPage(1)
            }}
          >
            <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl">
              <SelectValue placeholder="Plataforma" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">
                <span className="inline-flex items-center gap-2">
                  <Play
                    className="text-brand-cyan not-dark:text-primary size-4"
                    weight="fill"
                  />
                  Todas as Plataformas
                </span>
              </SelectItem>
              {PLATFORM_FILTER_ORDER.map((platform) => {
                const config = platformConfig[platform]
                const PlatformIcon = config.icon
                return (
                  <SelectItem key={platform} value={platform}>
                    <span className="inline-flex items-center gap-2">
                      <PlatformIcon className={cn("size-4", config.color)} />
                      {config.label}
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>

          {/* Clipador */}
          <div className="relative">
            <UserCheck className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              placeholder="Buscar por clipador..."
              value={clipperSearch}
              onChange={(event) => {
                setClipperSearch(event.target.value)
                setPage(1)
              }}
              className="h-10 rounded-xl pl-9"
            />
          </div>

          {/* @username */}
          <div className="relative">
            <At className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              placeholder="Buscar por @username..."
              value={accountSearch}
              onChange={(event) => {
                setAccountSearch(event.target.value)
                setPage(1)
              }}
              className="h-10 rounded-xl pl-9"
            />
          </div>

          {/* Status */}
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value)
              setPage(1)
            }}
          >
            <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Todos os Status</SelectItem>
              {POST_STATUS_ORDER.map((status) => {
                const config = CLIP_POST_STATUS_CONFIG[status]
                return (
                  <SelectItem key={status} value={status}>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={cn("size-2 rounded-full", config?.dot)}
                      />
                      {config?.label ?? status}
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>

          {/* Ordenação */}
          <Select
            value={sortBy}
            onValueChange={(value) => {
              setSortBy(value as PostsSortBy)
              setPage(1)
            }}
          >
            <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl">
              <span className="inline-flex min-w-0 items-center gap-2">
                <ArrowsDownUp className="text-muted-foreground size-4 shrink-0" />
                <SelectValue placeholder="Ordenar" />
              </span>
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {SORT_OPTIONS.map((option) => {
                const OptionIcon = option.icon
                return (
                  <SelectItem key={option.value} value={option.value}>
                    <span className="inline-flex items-center gap-2">
                      <OptionIcon className="size-4" />
                      {option.label}
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>

          {/* Postado a partir de */}
          <PostedAtFilter
            value={postedAtFrom}
            onChange={(value) => {
              setPostedAtFrom(value)
              // Mantém o intervalo coerente: fim nunca antes do início.
              if (value && postedAtTo && postedAtTo < value) {
                setPostedAtTo(value)
              }
              setPage(1)
            }}
            label="Postado a partir de"
            placeholder="Data e hora inicial"
          />

          {/* Postado até */}
          <PostedAtFilter
            value={postedAtTo}
            onChange={(value) => {
              setPostedAtTo(value)
              setPage(1)
            }}
            label="Postado até"
            placeholder="Data e hora final"
            min={postedAtFrom || undefined}
          />
        </div>
      </div>

      {/* ===== Conteúdo ===== */}
      {isLoadingPosts ? (
        <div className="flex flex-col gap-6">
          <CardGridSkeleton
            count={10}
            aspectClass="aspect-[9/16]"
            gridClass="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
            className="gap-3"
            withStats={false}
          />
          {/* Paginação fantasma */}
          <div className="border-border/40 flex flex-col items-center gap-4 border-t pt-5">
            <Bone className="h-4 w-48" />
            <div className="flex items-center gap-1.5">
              <Bone delay={80} className="h-9 w-24 rounded-xl" />
              {Array.from({ length: 3 }).map((_, index) => (
                <Bone
                  key={index}
                  delay={160 + index * 80}
                  className="size-9 rounded-xl"
                />
              ))}
              <Bone delay={480} className="h-9 w-24 rounded-xl" />
            </div>
          </div>
        </div>
      ) : !postsData || postsData.posts.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            icon={<MagnifyingGlass className="size-6" weight="bold" />}
            title="Nenhum post encontrado"
            subtitle="Tente ajustar ou limpar os filtros aplicados"
            action={
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer rounded-xl"
                onClick={clearFilters}
              >
                <XCircle className="size-3.5" />
                Limpar Filtros
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<Play className="size-6" weight="fill" />}
            title="Nenhum post disponível ainda"
            subtitle="Os posts aparecerão aqui conforme forem submetidos"
          />
        )
      ) : (
        <div className="flex flex-col gap-6">
          {/* Indicador de resultados filtrados */}
          {hasActiveFilters && (
            <div className="rounded-xl border border-[color-mix(in_oklab,var(--brand-cyan)_30%,transparent)] bg-[color-mix(in_oklab,var(--brand-cyan)_8%,transparent)] p-3">
              <div className="flex items-center gap-2">
                <FunnelSimple
                  className="text-brand-cyan not-dark:text-primary size-4"
                  weight="bold"
                />
                <p className="text-sm font-medium">
                  <span className="font-bold tabular-nums">{totalCount}</span>{" "}
                  {totalCount === 1 ? "post encontrado" : "posts encontrados"}
                </p>
              </div>
            </div>
          )}

          {/* ===== Grid de posts ===== */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {postsData.posts.map((post) => {
              const platformInfo = platformConfig[post.platform as PlatformKey]
              const PlatformIcon = platformInfo?.icon
              const statusConfig = CLIP_POST_STATUS_CONFIG[post.status]

              return (
                <div
                  key={post.id}
                  className="glass-card glass-card-hover flex flex-col overflow-hidden rounded-2xl"
                >
                  {/* Thumbnail 9:16 */}
                  <div className="bg-muted/60 relative w-full shrink-0 overflow-hidden aspect-[9/16]">
                    {post.thumbnail ? (
                      <Image
                        src={post.thumbnail}
                        alt={`Post de ${post.clipperName}`}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1536px) 25vw, 20vw"
                        className="object-cover"
                      />
                    ) : (
                      <PostPreviewFallback status={post.status} />
                    )}

                    {PlatformIcon && (
                      <div className="absolute top-2 left-2 z-10">
                        <Badge
                          variant="outline"
                          className="gap-1 rounded-full border-white/20 bg-black/60 backdrop-blur-sm"
                        >
                          <PlatformIcon
                            className={cn("size-3", platformInfo.color)}
                          />
                        </Badge>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setMetricsHistoryPostId(post.id)}
                      title="Ver histórico de métricas"
                      className="absolute top-2 right-2 z-10 flex size-7 cursor-pointer items-center justify-center rounded-lg border border-white/15 bg-black/55 text-white backdrop-blur-md transition-colors hover:border-white/25 hover:bg-black/70"
                    >
                      <Eye className="size-3.5" />
                    </button>
                  </div>

                  {/* Footer do card */}
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <p className="text-foreground truncate text-sm font-bold">
                      {post.clipperName}
                    </p>
                    <p className="text-muted-foreground -mt-1.5 truncate text-xs">
                      @{post.username}
                    </p>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-1.5 text-xs">
                      <div className="bg-muted/40 flex flex-col items-center gap-0.5 rounded-lg p-1.5">
                        <Pulse
                          className="text-brand-mint not-dark:text-primary size-3"
                          weight="bold"
                        />
                        <span className="text-brand-mint not-dark:text-primary font-bold tabular-nums">
                          {formatNumber(post.views)}
                        </span>
                      </div>
                      <div className="bg-muted/40 flex flex-col items-center gap-0.5 rounded-lg p-1.5">
                        <Heart
                          className="size-3 text-pink-400"
                          weight="fill"
                        />
                        <span className="font-bold tabular-nums">
                          {formatNumber(post.likes)}
                        </span>
                      </div>
                      <div className="bg-muted/40 flex flex-col items-center gap-0.5 rounded-lg p-1.5">
                        <ChatCircle
                          className="size-3 text-cyan-400"
                          weight="fill"
                        />
                        <span className="font-bold tabular-nums">
                          {formatNumber(post.comments)}
                        </span>
                      </div>
                    </div>

                    {/* Data */}
                    <p className="text-muted-foreground text-center text-[10px]">
                      {formatClipPostListedAt(
                        post.postedAt ?? null,
                        post.createdAt,
                      )}
                    </p>

                    {/* Status */}
                    <div className="flex items-center justify-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px]",
                          statusConfig?.badge,
                        )}
                      >
                        {statusConfig?.label ?? post.status}
                      </Badge>
                    </div>

                    {/* Motivo da inelegibilidade/desqualificação */}
                    <IneligibilityReasonNotice
                      status={post.status}
                      reason={post.ineligibilityReason}
                    />

                    {/* Ações — grid 2×2 */}
                    <div className="mt-auto grid min-w-0 grid-cols-2 gap-1.5">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-8 min-w-0 cursor-pointer rounded-lg px-2 text-xs"
                      >
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ArrowSquareOut className="size-3 shrink-0" />
                          <span className="truncate">Abrir</span>
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 min-w-0 cursor-pointer rounded-lg px-2 text-xs"
                        onClick={() => openChangeStatusDialog(post)}
                      >
                        <ArrowsClockwise className="size-3 shrink-0" />
                        <span className="truncate">Status</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 min-w-0 cursor-pointer rounded-lg px-2 text-xs"
                        onClick={() => openReassignPostDialog(post)}
                      >
                        <ArrowsLeftRight className="size-3 shrink-0" />
                        <span className="truncate">Trocar</span>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 min-w-0 cursor-pointer rounded-lg px-2 text-xs"
                        onClick={() => openDeletePostDialog(post)}
                      >
                        <Trash className="size-3 shrink-0" />
                        <span className="truncate">Deletar</span>
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ===== Paginação ===== */}
          {pagination && pagination.totalPages > 1 && (
            <div className="border-border/50 flex flex-col items-center gap-4 border-t pt-4">
              <p className="text-muted-foreground text-sm">
                Mostrando{" "}
                <span className="text-foreground font-semibold tabular-nums">
                  {(pagination.page - 1) * pagination.pageSize + 1}
                </span>{" "}
                -{" "}
                <span className="text-foreground font-semibold tabular-nums">
                  {Math.min(
                    pagination.page * pagination.pageSize,
                    pagination.totalCount,
                  )}
                </span>{" "}
                de{" "}
                <span className="text-foreground font-semibold tabular-nums">
                  {pagination.totalCount}
                </span>{" "}
                posts
              </p>

              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 cursor-pointer rounded-xl"
                  disabled={!pagination.hasPreviousPage}
                  onClick={() => setPage(Math.max(1, pagination.page - 1))}
                >
                  <CaretLeft className="size-3.5" />
                  Anterior
                </Button>

                {buildPageList(pagination.totalPages, pagination.page).map(
                  (pageItem, index) =>
                    pageItem === "ellipsis" ? (
                      <span
                        key={`ellipsis-${index}`}
                        className="text-muted-foreground px-1 text-sm"
                      >
                        …
                      </span>
                    ) : (
                      <Button
                        key={pageItem}
                        variant={
                          pageItem === pagination.page ? "default" : "outline"
                        }
                        size="sm"
                        className={cn(
                          "size-9 cursor-pointer rounded-xl p-0 tabular-nums",
                          pageItem === pagination.page &&
                            "btn-gradient-auth font-bold",
                        )}
                        onClick={() => setPage(pageItem)}
                      >
                        {pageItem}
                      </Button>
                    ),
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 cursor-pointer rounded-xl"
                  disabled={!pagination.hasNextPage}
                  onClick={() =>
                    setPage(Math.min(pagination.totalPages, pagination.page + 1))
                  }
                >
                  Próxima
                  <CaretRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== Dialog: Alterar Status do Post ===== */}
      <Dialog open={isStatusOpen} onOpenChange={setIsStatusOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2.5">
              <span className="bg-gradient-custom flex size-9 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
                <ArrowsClockwise className="size-4.5" weight="bold" />
              </span>
              Alterar Status do Post
            </DialogTitle>
            <DialogDescription>
              Altere o status do post de{" "}
              <span className="text-foreground font-semibold">
                @{selectedPost?.username}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="post-status">Novo Status</Label>
              <Select value={newPostStatus} onValueChange={setNewPostStatus}>
                <SelectTrigger
                  id="post-status"
                  className="h-10 w-full cursor-pointer rounded-xl"
                >
                  <SelectValue placeholder="Selecione o novo status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {POST_STATUS_ORDER.map((status) => {
                    const config = CLIP_POST_STATUS_CONFIG[status]
                    return (
                      <SelectItem key={status} value={status}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className={cn("size-2 rounded-full", config?.dot)}
                          />
                          {config?.label ?? status}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {requiresReason && (
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="ineligibility-reason"
                  className="text-red-500 dark:text-red-400"
                >
                  Justificativa * (obrigatória)
                </Label>
                <Textarea
                  id="ineligibility-reason"
                  placeholder="Ex: Não contém as hashtags obrigatórias, fora do período, etc."
                  value={ineligibilityReason}
                  onChange={(event) =>
                    setIneligibilityReason(event.target.value)
                  }
                  className="min-h-[100px] resize-none rounded-xl"
                />
                <p className="text-muted-foreground text-xs">
                  Esta justificativa será registrada nos logs de auditoria
                </p>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
              <Warning
                className="mt-0.5 size-4 shrink-0 text-amber-500"
                weight="fill"
              />
              <p className="text-xs text-amber-600 dark:text-amber-400">
                <span className="font-bold">Atenção:</span> esta ação afetará
                diretamente os rankings e a elegibilidade do post.
                Certifique-se de que está fazendo a alteração correta.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer rounded-xl"
              disabled={updateClipPostStatus.isPending}
              onClick={() => setIsStatusOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
              disabled={updateClipPostStatus.isPending}
              onClick={handlePostStatusChange}
            >
              {updateClipPostStatus.isPending ? (
                <>
                  <Spinner className="size-4 animate-spin" />
                  Atualizando...
                </>
              ) : (
                <>
                  <CheckCircle className="size-4" weight="fill" />
                  Confirmar Alteração
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Dialog: Trocar vídeo de competição ===== */}
      <Dialog
        open={isReassignOpen}
        onOpenChange={(open) => {
          setIsReassignOpen(open)
          if (!open) {
            setPostToReassign(null)
            setTargetApplicationId("")
          }
        }}
      >
        <DialogContent className="overflow-x-hidden rounded-3xl sm:max-w-lg">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2.5">
              <span className="bg-gradient-custom flex size-9 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
                <ArrowsLeftRight className="size-4.5" weight="bold" />
              </span>
              Trocar vídeo de competição
            </DialogTitle>
            <DialogDescription>
              Selecione a competição de destino para este vídeo. O sistema vai
              mover o vínculo e marcar como elegível automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="border-border/60 bg-muted/30 flex w-full max-w-full min-w-0 flex-col gap-2 overflow-hidden rounded-xl border p-3 text-sm">
              <div className="min-w-0">
                <span className="text-foreground font-semibold">Clipador:</span>{" "}
                <span className="break-words">
                  {postToReassign?.clipperName || "-"}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-foreground font-semibold">Conta:</span>{" "}
                <span className="break-all">
                  @{String(postToReassign?.username || "-").replace(/^@+/, "")}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-foreground font-semibold">Link:</span>{" "}
                <span className="text-muted-foreground text-xs leading-relaxed break-all">
                  {postToReassign?.url || "-"}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="target-application">Competição de destino</Label>
              <Select
                value={targetApplicationId}
                onValueChange={setTargetApplicationId}
                disabled={
                  isLoadingReassignTargets ||
                  reassignClipPostCompetition.isPending
                }
              >
                <SelectTrigger
                  id="target-application"
                  className="h-10 w-full cursor-pointer rounded-xl"
                >
                  <SelectValue
                    placeholder={
                      isLoadingReassignTargets
                        ? "Carregando destinos..."
                        : "Selecione a competição de destino"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {(reassignTargetsData?.targetApplications ?? []).map(
                    (app) => (
                      <SelectItem key={app.id} value={app.id}>
                        {app.campaignName} ({app.applicationStatus})
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              {!isLoadingReassignTargets &&
                (reassignTargetsData?.targetApplications?.length ?? 0) ===
                  0 && (
                  <p className="text-muted-foreground text-xs">
                    Nenhuma outra aplicação encontrada para este clipador.
                  </p>
                )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer rounded-xl"
              disabled={reassignClipPostCompetition.isPending}
              onClick={() => {
                setIsReassignOpen(false)
                setPostToReassign(null)
                setTargetApplicationId("")
              }}
            >
              Cancelar
            </Button>
            <Button
              className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
              disabled={
                reassignClipPostCompetition.isPending ||
                isLoadingReassignTargets ||
                !targetApplicationId
              }
              onClick={handleReassignPost}
            >
              {reassignClipPostCompetition.isPending ? (
                <>
                  <Spinner className="size-4 animate-spin" />
                  Trocando...
                </>
              ) : (
                <>
                  <CheckCircle className="size-4" weight="fill" />
                  Confirmar troca
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Dialog: Deletar Post ===== */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="rounded-3xl sm:max-w-md">
          <AlertDialogHeader className="space-y-2 text-left">
            <AlertDialogTitle className="flex items-center gap-2.5 text-base font-semibold">
              <span className="bg-destructive/15 text-destructive flex size-9 shrink-0 items-center justify-center rounded-xl">
                <Trash className="size-4.5" weight="fill" />
              </span>
              Excluir post da competição?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-muted-foreground flex w-full flex-col gap-3 text-left text-sm">
                <p className="text-foreground/90 leading-relaxed">
                  Remove o registro do banco de dados, incluindo métricas e
                  histórico. Não pode ser desfeita, o clipper não é notificado.
                </p>
                {postToDelete && (
                  <p className="border-border bg-muted/40 text-foreground rounded-xl border px-3 py-2 text-xs sm:text-sm">
                    <span className="font-medium">
                      {postToDelete.clipperName}
                    </span>
                    <span className="text-muted-foreground"> · </span>
                    <span>{postToDelete.platform}</span>
                    <span className="text-muted-foreground"> · </span>
                    <span>{formatNumber(postToDelete.views)} views</span>
                    <span className="text-muted-foreground"> · </span>
                    <span className="tabular-nums">{postToDelete.status}</span>
                  </p>
                )}
                <ConfirmWordInput
                  word="DELETAR"
                  value={deleteConfirmText}
                  onChange={setDeleteConfirmText}
                  id="confirm-delete-post"
                />
                {deleteConfirmText.length > 0 &&
                  deleteConfirmText !== "DELETAR" && (
                    <p className="text-destructive text-xs">
                      Use exatamente a palavra DELETAR.
                    </p>
                  )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel
              className="cursor-pointer rounded-xl"
              disabled={deleteClipPost.isPending}
              onClick={() => setDeleteConfirmText("")}
            >
              <XCircle className="size-4" />
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 cursor-pointer rounded-xl text-white"
              disabled={
                deleteClipPost.isPending || deleteConfirmText !== "DELETAR"
              }
              onClick={handleDeletePost}
            >
              {deleteClipPost.isPending ? (
                <>
                  <Spinner className="size-4 animate-spin" />
                  Excluindo…
                </>
              ) : (
                <>
                  <Trash className="size-4" weight="fill" />
                  Excluir post
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== Dialog: Histórico de métricas ===== */}
      <PostMetricsHistoryDialog
        postId={metricsHistoryPostId}
        open={metricsHistoryPostId !== null}
        isAdmin
        onOpenChange={(open) => {
          if (!open) setMetricsHistoryPostId(null)
        }}
      />
    </div>
  )
}
