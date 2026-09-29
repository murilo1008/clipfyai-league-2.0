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
import { Checkbox } from "@/components/ui/checkbox"
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

/**
 * Converte links públicos das plataformas em URLs dos players oficiais.
 * Não tentamos extrair o arquivo de vídeo: isso preserva autenticação,
 * privacidade e os controles oferecidos pela própria plataforma.
 */
export function getPostEmbedUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url)
    const host = parsedUrl.hostname.replace(/^www\./, "").toLowerCase()
    const pathParts = parsedUrl.pathname.split("/").filter(Boolean)

    if (host === "instagram.com" || host === "instagr.am") {
      const postTypeIndex = pathParts.findIndex((part) =>
        ["p", "reel", "reels", "tv"].includes(part.toLowerCase()),
      )
      const shortcode = pathParts[postTypeIndex + 1]
      if (postTypeIndex >= 0 && shortcode) {
        const postType = pathParts[postTypeIndex]?.toLowerCase()
        const normalizedType = postType === "reels" ? "reel" : postType
        return `https://www.instagram.com/${normalizedType}/${encodeURIComponent(shortcode)}/embed/captioned/`
      }
    }

    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
      const videoIndex = pathParts.findIndex(
        (part) => part.toLowerCase() === "video",
      )
      const videoId = pathParts[videoIndex + 1]
      if (videoIndex >= 0 && videoId) {
        return `https://www.tiktok.com/player/v1/${encodeURIComponent(videoId)}?controls=1&autoplay=0&loop=0&rel=0`
      }
    }

    if (
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtu.be"
    ) {
      const videoId =
        host === "youtu.be"
          ? pathParts[0]
          : parsedUrl.searchParams.get("v") ||
            (["shorts", "embed"].includes(pathParts[0]?.toLowerCase() ?? "")
              ? pathParts[1]
              : null)
      if (videoId) {
        return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`
      }
    }

    return null
  } catch {
    return null
  }
}

export function InstagramBrowserEmbed({ url }: { url: string }) {
  const [isLoading, setIsLoading] = React.useState(true)
  const [hasFailed, setHasFailed] = React.useState(false)
  const [useDirectIframe, setUseDirectIframe] = React.useState(true)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const normalizedUrl = React.useMemo(() => {
    try {
      const parsedUrl = new URL(url)
      return `https://www.instagram.com${parsedUrl.pathname.replace(/\/+$/, "")}/`
    } catch {
      return url
    }
  }, [url])

  React.useEffect(() => {
    if (!useDirectIframe || !isLoading) return

    // O iframe direto dispensa embed.js no caminho normal. Se ele não carregar,
    // usamos o embed por script que já existia nesta tela.
    const timeout = window.setTimeout(() => setUseDirectIframe(false), 5000)
    return () => window.clearTimeout(timeout)
  }, [isLoading, useDirectIframe, normalizedUrl])

  React.useEffect(() => {
    if (useDirectIframe) return

    let cancelled = false
    let attempts = 0
    let processingTimer: number | undefined
    let staleScriptTimer: number | undefined
    let observedScript: HTMLScriptElement | null = null
    const startedAt = performance.now()
    const log = (
      level: "info" | "warn" | "error",
      event: string,
      details: Record<string, unknown> = {},
    ) => {
      // Falhas do embed podem ser recuperadas abrindo o post original. No Next.js
      // dev, console.error abre o error overlay mesmo quando o erro foi tratado.
      const consoleMethod = level === "error" ? console.warn : console[level]
      consoleMethod(`[InstagramEmbed] ${event}`, {
        url: normalizedUrl,
        elapsedMs: Math.round(performance.now() - startedAt),
        ...details,
      })
    }

    setIsLoading(true)
    setHasFailed(false)
    log("info", "script_fallback_initializing")

    const scriptTimeout = window.setTimeout(() => {
      if (cancelled || containerRef.current?.querySelector("iframe")) return
      log("warn", "script_fallback_timeout")
      setIsLoading(false)
      setHasFailed(true)
    }, 12000)

    const processEmbed = () => {
      if (cancelled) {
        log("info", "processing_skipped_component_unmounted")
        return
      }
      const instagramWindow = window as typeof window & {
        instgrm?: { Embeds?: { process: () => void } }
      }
      const hasInstagramApi = Boolean(instagramWindow.instgrm?.Embeds?.process)
      log("info", "processing_started", { hasInstagramApi })
      instagramWindow.instgrm?.Embeds?.process()

      const waitForIframe = () => {
        if (cancelled) return
        const iframe = containerRef.current?.querySelector("iframe")
        if (iframe) {
          log("info", "iframe_created", {
            attempts,
            iframeTitle: iframe.title || null,
          })
          setIsLoading(false)
          return
        }
        attempts += 1
        if (attempts >= 24) {
          const hasInstagramApi = Boolean(
            instagramWindow.instgrm?.Embeds?.process,
          )
          log("error", "iframe_creation_timeout", {
            attempts,
            hasInstagramApi,
            blockquotePresent: Boolean(
              containerRef.current?.querySelector(".instagram-media"),
            ),
          })
          setIsLoading(false)
          setHasFailed(true)
          return
        }
        if (attempts === 1 || attempts % 8 === 0) {
          log("warn", "waiting_for_iframe", {
            attempts,
            hasInstagramApi: Boolean(instagramWindow.instgrm?.Embeds?.process),
          })
        }
        instagramWindow.instgrm?.Embeds?.process()
        processingTimer = window.setTimeout(waitForIframe, 250)
      }
      waitForIframe()
    }

    const handleScriptError = (event: Event | string) => {
      log("error", "embed_script_failed", {
        eventType: typeof event === "string" ? event : event.type,
        online: navigator.onLine,
      })
      if (!cancelled) {
        setIsLoading(false)
        setHasFailed(true)
      }
    }

    const appendFreshScript = () => {
      if (cancelled) return
      log("info", "embed_script_appending")
      const script = document.createElement("script")
      script.async = true
      script.src = "https://www.instagram.com/embed.js"
      script.dataset.clipfyInstagramEmbed = "true"
      script.onload = () => {
        log("info", "embed_script_loaded")
        processEmbed()
      }
      script.onerror = handleScriptError
      document.body.appendChild(script)
      observedScript = script
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.instagram.com/embed.js"]',
    )
    if (existingScript) {
      const instagramWindow = window as typeof window & {
        instgrm?: { Embeds?: { process: () => void } }
      }
      log("info", "embed_script_already_present", {
        scriptAsync: existingScript.async,
        hasInstagramApi: Boolean(instagramWindow.instgrm?.Embeds?.process),
      })
      if (instagramWindow.instgrm?.Embeds?.process) {
        processEmbed()
      } else {
        observedScript = existingScript
        existingScript.addEventListener("load", processEmbed, { once: true })
        existingScript.addEventListener("error", handleScriptError, {
          once: true,
        })
        staleScriptTimer = window.setTimeout(() => {
          const currentWindow = window as typeof window & {
            instgrm?: { Embeds?: { process: () => void } }
          }
          if (cancelled || currentWindow.instgrm?.Embeds?.process) return
          log("warn", "stale_embed_script_reloading")
          existingScript.removeEventListener("load", processEmbed)
          existingScript.removeEventListener("error", handleScriptError)
          existingScript.remove()
          appendFreshScript()
        }, 2000)
      }
    } else {
      appendFreshScript()
    }

    return () => {
      log("info", "cleanup", { attempts })
      cancelled = true
      if (processingTimer) window.clearTimeout(processingTimer)
      if (staleScriptTimer) window.clearTimeout(staleScriptTimer)
      if (scriptTimeout) window.clearTimeout(scriptTimeout)
      observedScript?.removeEventListener("load", processEmbed)
      observedScript?.removeEventListener("error", handleScriptError)
    }
  }, [normalizedUrl, useDirectIframe])

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-y-auto bg-white px-1 py-3 sm:px-4"
    >
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
          <Spinner className="size-7 animate-spin text-white" />
        </div>
      )}
      {hasFailed && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black px-6 text-center text-white">
          <Warning className="size-8 text-amber-400" weight="fill" />
          <p className="font-semibold">O Instagram bloqueou a incorporação</p>
          <p className="max-w-sm text-sm text-white/65">
            O post pode estar privado, com incorporação desativada, ou o
            navegador pode estar bloqueando o Instagram.
          </p>
        </div>
      )}
      {useDirectIframe ? (
        <iframe
          src={getPostEmbedUrl(normalizedUrl) ?? normalizedUrl}
          title="Publicação do Instagram"
          className="mx-auto h-full w-full max-w-[540px] border-0 bg-white"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          onLoad={() => {
            console.info("[InstagramEmbed] direct_iframe_loaded", {
              url: normalizedUrl,
            })
            setIsLoading(false)
          }}
          onError={() => {
            console.warn("[InstagramEmbed] direct_iframe_failed", {
              url: normalizedUrl,
            })
            setUseDirectIframe(false)
          }}
        />
      ) : (
        <blockquote
          key={normalizedUrl}
          className="instagram-media mx-auto! max-w-[540px]! min-w-0!"
          data-instgrm-permalink={normalizedUrl}
          data-instgrm-version="14"
        >
          <a href={url} target="_blank" rel="noopener noreferrer">
            Carregando publicação do Instagram
          </a>
        </blockquote>
      )}
    </div>
  )
}

const TIKTOK_EMBED_SCRIPT_URL = "https://www.tiktok.com/embed.js"

/** Aquece a conexão e baixa o script sem executar o embed antes do clique. */
export function warmTikTokEmbed() {
  if (typeof document === "undefined") return

  if (!document.querySelector('link[data-clipfy-tiktok-preconnect="true"]')) {
    const connection = document.createElement("link")
    connection.rel = "preconnect"
    connection.href = "https://www.tiktok.com"
    connection.dataset.clipfyTiktokPreconnect = "true"
    document.head.appendChild(connection)
  }

  if (!document.querySelector('link[data-clipfy-tiktok-preload="true"]')) {
    const preload = document.createElement("link")
    preload.rel = "preload"
    preload.as = "script"
    preload.href = TIKTOK_EMBED_SCRIPT_URL
    preload.dataset.clipfyTiktokPreload = "true"
    document.head.appendChild(preload)
  }
}

export function TikTokBrowserEmbed({
  url,
  thumbnailUrl,
}: {
  url: string
  thumbnailUrl?: string | null
}) {
  const [isLoading, setIsLoading] = React.useState(true)
  const [hasFailed, setHasFailed] = React.useState(false)
  const [attempt, setAttempt] = React.useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const videoId = React.useMemo(() => {
    try {
      const parts = new URL(url).pathname.split("/").filter(Boolean)
      const videoIndex = parts.findIndex(
        (part) => part.toLowerCase() === "video",
      )
      return videoIndex >= 0 ? parts[videoIndex + 1] : undefined
    } catch {
      return undefined
    }
  }, [url])

  React.useEffect(() => {
    if (!videoId) {
      setIsLoading(false)
      return
    }

    let cancelled = false
    let embedReady = false
    setIsLoading(true)
    setHasFailed(false)

    const handleEmbedMessage = (event: MessageEvent) => {
      if (cancelled || event.origin !== "https://www.tiktok.com") return
      const iframe = containerRef.current?.querySelector("iframe")
      if (!iframe || event.source !== iframe.contentWindow) return
      if (typeof event.data !== "string") return

      try {
        const message = JSON.parse(event.data) as {
          signalSource?: string
          height?: number
        }
        if (
          message.signalSource?.startsWith("__tt_embed__") &&
          typeof message.height === "number" &&
          message.height > 0
        ) {
          embedReady = true
          setIsLoading(false)
        }
      } catch {
        // Mensagens de outros recursos do TikTok não indicam embed pronto.
      }
    }
    window.addEventListener("message", handleEmbedMessage)

    const retryOrFail = () => {
      if (cancelled || embedReady) return
      if (attempt === 0) {
        setAttempt(1)
      } else {
        setIsLoading(false)
        setHasFailed(true)
      }
    }

    document.querySelector('script[data-clipfy-tiktok-embed="true"]')?.remove()
    const script = document.createElement("script")
    script.async = true
    script.fetchPriority = "high"
    script.src = TIKTOK_EMBED_SCRIPT_URL
    script.dataset.clipfyTiktokEmbed = "true"
    script.onerror = retryOrFail
    document.body.appendChild(script)

    // O iframe dispara load até quando o TikTok responde com erro. A mensagem
    // de altura chega somente depois de o embed renderizar seu conteúdo.
    const timeout = window.setTimeout(retryOrFail, 7000)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      window.removeEventListener("message", handleEmbedMessage)
      script.onerror = null
      script.remove()
    }
  }, [videoId, attempt])

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-y-auto bg-white px-1 py-3 sm:px-4"
    >
      {isLoading && videoId && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black text-white">
          {thumbnailUrl && (
            <Image
              src={thumbnailUrl}
              alt=""
              fill
              sizes="160px"
              className="object-contain opacity-50 blur-sm"
            />
          )}
          <Spinner className="relative size-7 animate-spin" />
          <span className="relative text-sm">
            {attempt === 0 ? "Carregando vídeo..." : "Tentando novamente..."}
          </span>
        </div>
      )}
      {hasFailed && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black px-6 text-center text-white">
          <Warning className="size-8 text-amber-400" weight="fill" />
          <p className="font-semibold">Não foi possível carregar este vídeo</p>
          <button
            type="button"
            onClick={() => setAttempt((current) => current + 1)}
            className="flex cursor-pointer items-center gap-1.5 text-sm underline"
          >
            <ArrowsClockwise className="size-4" />
            Tentar novamente
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline"
          >
            Abrir no TikTok
          </a>
        </div>
      )}
      {videoId ? (
        <blockquote
          key={`${url}-${attempt}`}
          className="tiktok-embed mx-auto! max-w-[605px]! min-w-0!"
          cite={url}
          data-video-id={videoId}
          data-embed-from="embed_page"
        >
          <section>
            <a href={url} target="_blank" rel="noopener noreferrer">
              Ver este vídeo no TikTok
            </a>
          </section>
        </blockquote>
      ) : (
        <p className="p-6 text-center text-sm text-black/65">
          Não foi possível identificar este vídeo do TikTok.
        </p>
      )}
    </div>
  )
}

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
          <Label
            htmlFor={timeInputId}
            className="text-muted-foreground text-xs"
          >
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
  const [isPlayerOpen, setIsPlayerOpen] = React.useState(false)
  const [playerPostId, setPlayerPostId] = React.useState<string | null>(null)
  const [failedVideoPostId, setFailedVideoPostId] = React.useState<
    string | null
  >(null)
  const [isPlayerLoading, setIsPlayerLoading] = React.useState(false)

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
  const [selectedPostIds, setSelectedPostIds] = React.useState<Set<string>>(
    new Set(),
  )
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = React.useState(false)
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = React.useState("")

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

  const hasTikTokPosts =
    postsData?.posts.some((post) => post.platform === "TIKTOK") ?? false
  React.useEffect(() => {
    if (hasTikTokPosts) warmTikTokEmbed()
  }, [hasTikTokPosts])

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

  const deleteClipPostsBulk = api.admin.deleteClipPostsBulk.useMutation({
    onSuccess: async (result) => {
      toast.success(
        `${result.deletedCount} ${result.deletedCount === 1 ? "post deletado" : "posts deletados"} com sucesso!`,
        {
          description: "Os posts foram removidos permanentemente da competição",
        },
      )
      setIsBulkDeleteOpen(false)
      setBulkDeleteConfirmText("")
      setSelectedPostIds(new Set())
      await Promise.all([
        utils.admin.getCompetitionDetailsAdmin.invalidate({ slug }),
        utils.admin.getCompetitionPostsAdmin.invalidate(),
        utils.campaign.getCompetitionDetails.invalidate(),
      ])
      refetch()
    },
    onError: (error) =>
      toast.error(error.message || "Erro ao deletar posts selecionados"),
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
  const openChangeStatusDialog = (
    post: AdminClipPost,
    initialStatus = post.status || "",
  ) => {
    setSelectedPost(post)
    setNewPostStatus(initialStatus)
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

  const togglePostSelection = (postId: string) => {
    setSelectedPostIds((current) => {
      const next = new Set(current)
      if (next.has(postId)) {
        next.delete(postId)
      } else {
        next.add(postId)
      }
      return next
    })
  }

  const toggleSelectAllVisible = () => {
    const visiblePostIds = postsData?.posts.map((post) => post.id) ?? []
    const allVisibleSelected = visiblePostIds.every((id) =>
      selectedPostIds.has(id),
    )
    setSelectedPostIds((current) => {
      const next = new Set(current)
      for (const id of visiblePostIds) {
        if (allVisibleSelected) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  const handleBulkDeletePosts = () => {
    if (bulkDeleteConfirmText !== "DELETAR") {
      toast.error("Digite 'DELETAR' para confirmar a exclusão", {
        description: "Esta ação é irreversível!",
      })
      return
    }
    if (selectedPostIds.size === 0) {
      toast.error("Selecione ao menos um post")
      return
    }
    deleteClipPostsBulk.mutate({ clipPostIds: Array.from(selectedPostIds) })
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
  const visiblePostIds = postsData?.posts.map((post) => post.id) ?? []
  const allVisiblePostsSelected =
    visiblePostIds.length > 0 &&
    visiblePostIds.every((id) => selectedPostIds.has(id))
  const playerPostIndex =
    postsData?.posts.findIndex((post) => post.id === playerPostId) ?? -1
  const playerPost =
    playerPostIndex >= 0 ? postsData?.posts[playerPostIndex] : undefined
  const playerEmbedUrl = playerPost ? getPostEmbedUrl(playerPost.url) : null
  const playerVideoUrl =
    playerPost?.id === failedVideoPostId ? null : (playerPost?.videoUrl ?? null)
  const requiresReason =
    newPostStatus === "INELIGIBLE" || newPostStatus === "DISQUALIFIED"

  const showPlayerPost = React.useCallback(
    (index: number) => {
      const nextPost = postsData?.posts[index]
      if (!nextPost) return
      setIsPlayerLoading(true)
      setPlayerPostId(nextPost.id)
      setIsPlayerOpen(true)
    },
    [postsData?.posts],
  )

  React.useEffect(() => {
    if (!playerPost) return

    const handlePlayerKeyboard = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && playerPostIndex > 0) {
        event.preventDefault()
        showPlayerPost(playerPostIndex - 1)
      }
      if (
        event.key === "ArrowRight" &&
        playerPostIndex < (postsData?.posts.length ?? 0) - 1
      ) {
        event.preventDefault()
        showPlayerPost(playerPostIndex + 1)
      }
    }

    window.addEventListener("keydown", handlePlayerKeyboard)
    return () => window.removeEventListener("keydown", handlePlayerKeyboard)
  }, [playerPost, playerPostIndex, postsData?.posts.length, showPlayerPost])

  React.useEffect(() => {
    if (!isPlayerOpen || !isPlayerLoading) return

    // Alguns provedores bloqueiam o evento load quando recusam o embed.
    // Liberar a camada garante acesso ao player ou à mensagem do provedor.
    const loadingTimeout = window.setTimeout(
      () => setIsPlayerLoading(false),
      5000,
    )
    return () => window.clearTimeout(loadingTimeout)
  }, [isPlayerLoading, isPlayerOpen, playerPostId])

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

          {/* ===== Seleção para ações em lote ===== */}
          <div className="border-border/60 bg-muted/30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 sm:px-4">
            <button
              type="button"
              onClick={toggleSelectAllVisible}
              className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-2 text-sm transition-colors"
            >
              <Checkbox
                checked={allVisiblePostsSelected}
                className="pointer-events-none"
              />
              <span className="font-medium">Selecionar todos desta página</span>
            </button>

            {selectedPostIds.size > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-destructive/30 bg-destructive/10 text-destructive rounded-full px-2.5 py-0.5"
                >
                  {selectedPostIds.size}{" "}
                  {selectedPostIds.size === 1
                    ? "post selecionado"
                    : "posts selecionados"}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 cursor-pointer rounded-lg text-xs"
                  onClick={() => setSelectedPostIds(new Set())}
                >
                  Limpar seleção
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 cursor-pointer rounded-lg text-xs"
                  onClick={() => {
                    setBulkDeleteConfirmText("")
                    setIsBulkDeleteOpen(true)
                  }}
                >
                  <Trash className="size-3.5" weight="fill" />
                  Excluir selecionados
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">
                Selecione os posts que deseja excluir.
              </p>
            )}
          </div>

          {/* ===== Grid de posts ===== */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {postsData.posts.map((post) => {
              const platformInfo = platformConfig[post.platform as PlatformKey]
              const PlatformIcon = platformInfo?.icon
              const statusConfig = CLIP_POST_STATUS_CONFIG[post.status]
              const isSelected = selectedPostIds.has(post.id)

              return (
                <div
                  key={post.id}
                  className={cn(
                    "glass-card glass-card-hover flex flex-col overflow-hidden rounded-2xl",
                    isSelected && "ring-destructive/60 ring-2",
                  )}
                >
                  {/* Thumbnail 9:16 */}
                  <div className="bg-muted/60 relative aspect-[9/16] w-full shrink-0 overflow-hidden">
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

                    <button
                      type="button"
                      onClick={() => {
                        setIsPlayerLoading(true)
                        setPlayerPostId(post.id)
                        setIsPlayerOpen(true)
                      }}
                      aria-label={`Reproduzir vídeo de ${post.clipperName}`}
                      className="group absolute inset-0 z-20 flex cursor-pointer items-center justify-center bg-black/5 transition-colors hover:bg-black/25 focus-visible:bg-black/25 focus-visible:outline-none"
                    >
                      <span className="flex size-12 items-center justify-center rounded-full border border-white/30 bg-black/60 text-white shadow-xl backdrop-blur-md transition-transform group-hover:scale-110">
                        <Play className="ml-0.5 size-5" weight="fill" />
                      </span>
                    </button>

                    {PlatformIcon && (
                      <div className="pointer-events-none absolute top-2 left-2 z-30">
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

                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => togglePostSelection(post.id)}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`Selecionar post de ${post.clipperName}`}
                      className="data-[state=checked]:border-destructive data-[state=checked]:bg-destructive absolute top-2 right-11 z-30 size-5 border-white/45 bg-black/60 text-white backdrop-blur-md"
                    />

                    <button
                      type="button"
                      onClick={() => setMetricsHistoryPostId(post.id)}
                      title="Ver histórico de métricas"
                      className="absolute top-2 right-2 z-30 flex size-7 cursor-pointer items-center justify-center rounded-lg border border-white/15 bg-black/55 text-white backdrop-blur-md transition-colors hover:border-white/25 hover:bg-black/70"
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
                        <Heart className="size-3 text-pink-400" weight="fill" />
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
                    setPage(
                      Math.min(pagination.totalPages, pagination.page + 1),
                    )
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

      {/* ===== Player de posts com navegação ===== */}
      <Dialog
        open={isPlayerOpen}
        onOpenChange={(open) => {
          setIsPlayerOpen(open)
          if (!open) {
            setPlayerPostId(null)
            setFailedVideoPostId(null)
            setIsPlayerLoading(false)
          }
        }}
      >
        <DialogContent className="flex h-[92svh] w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:h-[90svh] sm:max-w-3xl">
          <DialogHeader className="border-border/60 shrink-0 border-b px-4 py-3 pr-12 text-left sm:px-5">
            <DialogTitle className="flex min-w-0 items-center gap-2 text-base">
              <Play
                className="text-brand-cyan not-dark:text-primary size-4 shrink-0"
                weight="fill"
              />
              <span className="truncate">
                {playerPost?.clipperName} · @{playerPost?.username}
              </span>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Reprodutor do post com navegação entre os vídeos desta página
            </DialogDescription>
          </DialogHeader>

          <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
            {playerVideoUrl ? (
              <video
                key={playerPost?.id}
                src={playerVideoUrl}
                poster={playerPost?.thumbnail ?? undefined}
                className="h-full w-full object-contain"
                controls
                autoPlay
                playsInline
                preload="metadata"
                onCanPlay={() => setIsPlayerLoading(false)}
                onLoadedData={() => setIsPlayerLoading(false)}
                onError={() => {
                  setFailedVideoPostId(playerPost?.id ?? null)
                  setIsPlayerLoading(false)
                }}
              >
                Seu navegador não suporta a reprodução deste vídeo.
              </video>
            ) : playerPost?.platform === "INSTAGRAM" ? (
              <InstagramBrowserEmbed key={playerPost.id} url={playerPost.url} />
            ) : playerPost?.platform === "TIKTOK" ? (
              <TikTokBrowserEmbed
                key={playerPost.id}
                url={playerPost.url}
                thumbnailUrl={playerPost.thumbnail}
              />
            ) : playerEmbedUrl ? (
              <>
                {isPlayerLoading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
                    <Spinner className="size-7 animate-spin text-white" />
                  </div>
                )}
                <iframe
                  key={playerPost?.id}
                  src={playerEmbedUrl}
                  title={`Vídeo de ${playerPost?.clipperName ?? "clipador"}`}
                  className="h-full w-full max-w-[520px] border-0 bg-white"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  loading="eager"
                  onLoad={() => setIsPlayerLoading(false)}
                />
              </>
            ) : (
              <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center text-white">
                <Warning className="size-8 text-amber-400" weight="fill" />
                <p className="font-semibold">
                  Player indisponível para este link
                </p>
                <p className="text-sm text-white/65">
                  Esta plataforma ou formato não oferece reprodução incorporada.
                </p>
              </div>
            )}
          </div>

          <div className="border-border/60 flex shrink-0 flex-col gap-2 border-t px-3 py-3 sm:px-5">
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Vídeo anterior"
                disabled={playerPostIndex <= 0}
                onClick={() => showPlayerPost(playerPostIndex - 1)}
                className="h-9 cursor-pointer rounded-lg px-2 sm:px-3"
              >
                <CaretLeft className="size-4" weight="bold" />
                <span className="hidden sm:inline">Anterior</span>
              </Button>
              <p className="text-muted-foreground text-center text-xs tabular-nums">
                {playerPostIndex + 1} de {postsData?.posts.length ?? 0}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Próximo vídeo"
                disabled={
                  playerPostIndex < 0 ||
                  playerPostIndex >= (postsData?.posts.length ?? 0) - 1
                }
                onClick={() => showPlayerPost(playerPostIndex + 1)}
                className="h-9 cursor-pointer rounded-lg px-2 sm:px-3"
              >
                <span className="hidden sm:inline">Próximo</span>
                <CaretRight className="size-4" weight="bold" />
              </Button>
            </div>
            {playerPost && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg text-xs"
                >
                  <a
                    href={playerPost.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ArrowSquareOut className="size-3.5" />
                    Abrir original
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={playerPost.status === "DISQUALIFIED"}
                  onClick={() => {
                    setIsPlayerOpen(false)
                    setPlayerPostId(null)
                    openChangeStatusDialog(playerPost, "DISQUALIFIED")
                  }}
                  className="h-8 cursor-pointer rounded-lg text-xs"
                >
                  <XCircle className="size-3.5" weight="fill" />
                  {playerPost.status === "DISQUALIFIED"
                    ? "Desclassificado"
                    : "Desclassificar"}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
                diretamente os rankings e a elegibilidade do post. Certifique-se
                de que está fazendo a alteração correta.
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

      {/* ===== Dialog: Deletar posts em lote ===== */}
      <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <AlertDialogContent className="rounded-3xl sm:max-w-md">
          <AlertDialogHeader className="space-y-2 text-left">
            <AlertDialogTitle className="flex items-center gap-2.5 text-base font-semibold">
              <span className="bg-destructive/15 text-destructive flex size-9 shrink-0 items-center justify-center rounded-xl">
                <Trash className="size-4.5" weight="fill" />
              </span>
              Excluir posts selecionados?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-muted-foreground flex w-full flex-col gap-3 text-left text-sm">
                <p className="text-foreground/90 leading-relaxed">
                  Você está prestes a excluir permanentemente{" "}
                  {selectedPostIds.size}{" "}
                  {selectedPostIds.size === 1 ? "post" : "posts"}, incluindo
                  métricas e histórico. Esta ação não pode ser desfeita e os
                  clippers não serão notificados.
                </p>
                <ConfirmWordInput
                  word="DELETAR"
                  value={bulkDeleteConfirmText}
                  onChange={setBulkDeleteConfirmText}
                  id="confirm-bulk-delete-posts"
                />
                {bulkDeleteConfirmText.length > 0 &&
                  bulkDeleteConfirmText !== "DELETAR" && (
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
              disabled={deleteClipPostsBulk.isPending}
              onClick={() => setBulkDeleteConfirmText("")}
            >
              <XCircle className="size-4" />
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 cursor-pointer rounded-xl text-white"
              disabled={
                deleteClipPostsBulk.isPending ||
                bulkDeleteConfirmText !== "DELETAR"
              }
              onClick={handleBulkDeletePosts}
            >
              {deleteClipPostsBulk.isPending ? (
                <>
                  <Spinner className="size-4 animate-spin" />
                  Excluindo…
                </>
              ) : (
                <>
                  <Trash className="size-4" weight="fill" />
                  Excluir {selectedPostIds.size}{" "}
                  {selectedPostIds.size === 1 ? "post" : "posts"}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
