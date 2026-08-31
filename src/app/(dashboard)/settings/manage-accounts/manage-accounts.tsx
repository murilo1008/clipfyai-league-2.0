"use client"

import * as React from "react"
import {
  ArrowsClockwise,
  CaretUpDown,
  Check,
  CircleNotch,
  Clock,
  LinkBreak,
  LinkSimple,
  PencilSimple,
  PlugsConnected,
  Plus,
  SealCheck,
  Sparkle,
  Trophy,
  UsersThree,
  Warning,
  X,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { HomeHero } from "@/components/home/home-hero"
import { ManageAccountsHeroViz, ManageAccountsHeroVizSkeleton } from "@/components/settings/manage-accounts-hero-viz"
import { Reveal } from "@/components/shared/reveal"
import {
  Bone,
  HeroSkeleton,
  ListRowsSkeleton,
} from "@/components/shared/skeletons"
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
  DialogContent,
  DialogDescription,
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
import { Switch } from "@/components/ui/switch"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"
import { api, type RouterInputs, type RouterOutputs } from "@/trpc/react"

import { formatNumber } from "../../competitions/[slug]/shared"

type SocialAccount = RouterOutputs["clipper"]["getMySocialAccounts"][number]
type AccountNiche = NonNullable<
  RouterInputs["clipper"]["addSocialAccount"]["niche"]
>

/** Hex de cada plataforma para acentos inline (contagens, glows, chips). */
const PLATFORM_HEX: Record<PlatformKey, string> = {
  INSTAGRAM: "#ec4899",
  TIKTOK: "#f1204a",
  YOUTUBE: "#ef4444",
  KWAI: "#ff7705",
  FACEBOOK: "#1877f2",
}

const PLATFORM_KEYS = Object.keys(platformConfig) as PlatformKey[]

/** Redes com integração OAuth (routers instagram/tiktok/youtube). */
type IntegrationPlatform = "INSTAGRAM" | "TIKTOK" | "YOUTUBE"

type IntegrationAuthStatus =
  | "PENDING"
  | "ACTIVE"
  | "EXPIRED"
  | "REVOKED"
  | "ERROR"

type IntegrationSyncStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "PARTIAL"

type IntegrationActionResult = {
  success?: boolean
  message?: string | null
  error?: string | null
}

function getIntegrationActionError(data: unknown): string | null {
  if (!data || typeof data !== "object" || !("success" in data)) return null

  const result = data as IntegrationActionResult
  if (result.success !== false) return null
  return result.error ?? result.message ?? "A integração informou uma falha"
}

const INTEGRATION_TONE_CLASS = {
  ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
  muted: "border-border/60 bg-muted/40 text-muted-foreground",
} as const

type IntegrationTone = keyof typeof INTEGRATION_TONE_CLASS

const AUTH_STATUS_INFO: Record<
  IntegrationAuthStatus,
  { label: string; tone: IntegrationTone }
> = {
  ACTIVE: { label: "Conectado", tone: "ok" },
  PENDING: { label: "Pendente", tone: "warn" },
  EXPIRED: { label: "Expirado", tone: "danger" },
  REVOKED: { label: "Revogado", tone: "danger" },
  ERROR: { label: "Erro", tone: "danger" },
}

const SYNC_STATUS_INFO: Record<
  IntegrationSyncStatus,
  { label: string; tone: IntegrationTone }
> = {
  COMPLETED: { label: "Concluído", tone: "ok" },
  PARTIAL: { label: "Parcial", tone: "warn" },
  RUNNING: { label: "Em andamento", tone: "muted" },
  PENDING: { label: "Na fila", tone: "muted" },
  FAILED: { label: "Falhou", tone: "danger" },
}

const syncDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

type IntegrationSyncLog = {
  status: IntegrationSyncStatus
  videosProcessed: number
  videosUpdated: number
  videosFailed: number
  errorMessage: string | null
}

/** Dados crus da conexão, já normalizados a partir do auth de cada rede. */
type IntegrationAuth = {
  status: IntegrationAuthStatus
  accountName: string | null
  followers: number | null
  expiresAt: Date | null
  lastSyncAt: Date | null
  errorMessage: string | null
  syncLog: IntegrationSyncLog | null
}

/** Shape mínimo de mutation consumido pela UI (idêntico nas 3 redes). */
type IntegrationMutation = {
  mutate: (input: { socialAccountId: string }) => void
  isPending: boolean
}

type IntegrationState = {
  platform: IntegrationPlatform
  hasConnection: boolean
  isConnected: boolean
  statusLabel: string
  statusTone: IntegrationTone
  accountName: string | null
  followers: number | null
  lastSyncLabel: string | null
  syncBadge: { label: string; title: string; tone: IntegrationTone } | null
  errorMessage: string | null
}

/**
 * Erros de infra do backend externo (LEAGUE_API_URL ausente, rede fora do ar)
 * viram uma mensagem clara — o resto propaga o texto do servidor.
 */
function describeIntegrationError(message: string) {
  const isInfraError =
    /LEAGUE_API_URL|indispon|fetch failed|failed to fetch|networkerror|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timeout/i.test(
      message,
    )
  return isInfraError
    ? "Integração indisponível no momento. Tente novamente em instantes."
    : message
}

function buildSyncBadge(log: IntegrationSyncLog | null) {
  if (!log) return null
  const info = SYNC_STATUS_INFO[log.status]
  const isCountable = log.status === "COMPLETED" || log.status === "PARTIAL"
  return {
    tone: info.tone,
    label: isCountable
      ? `${log.videosUpdated}/${log.videosProcessed} vídeos`
      : info.label,
    title:
      log.errorMessage ??
      `${log.videosProcessed} processados · ${log.videosUpdated} atualizados · ${log.videosFailed} com falha`,
  }
}

function buildIntegrationState(
  platform: IntegrationPlatform,
  auth: IntegrationAuth | null,
): IntegrationState {
  if (!auth) {
    return {
      platform,
      hasConnection: false,
      isConnected: false,
      statusLabel: "Não conectado",
      statusTone: "muted",
      accountName: null,
      followers: null,
      lastSyncLabel: null,
      syncBadge: null,
      errorMessage: null,
    }
  }

  const isExpired = auth.expiresAt
    ? auth.expiresAt.getTime() <= Date.now()
    : false
  const status: IntegrationAuthStatus =
    isExpired && auth.status === "ACTIVE" ? "EXPIRED" : auth.status
  const info = AUTH_STATUS_INFO[status]

  return {
    platform,
    hasConnection: true,
    isConnected: status === "ACTIVE",
    statusLabel: info.label,
    statusTone: info.tone,
    accountName: auth.accountName,
    followers: auth.followers,
    lastSyncLabel: auth.lastSyncAt
      ? syncDateFormatter.format(auth.lastSyncAt)
      : null,
    syncBadge: buildSyncBadge(auth.syncLog),
    errorMessage: auth.errorMessage,
  }
}

/**
 * Cada rede guarda a conexão num relacionamento próprio com nomes diferentes —
 * aqui tudo vira o mesmo formato para a UI. Redes sem OAuth devolvem null.
 */
function getIntegrationState(account: SocialAccount): IntegrationState | null {
  if (account.platform === "YOUTUBE") {
    const auth = account.youtubeAuth
    return buildIntegrationState(
      "YOUTUBE",
      auth
        ? {
            status: auth.status,
            accountName: auth.channelTitle,
            followers: null,
            expiresAt: null,
            lastSyncAt: auth.lastSyncAt,
            errorMessage: auth.errorMessage,
            syncLog: auth.syncLogs[0] ?? null,
          }
        : null,
    )
  }

  if (account.platform === "TIKTOK") {
    const auth = account.tiktokAuth
    return buildIntegrationState(
      "TIKTOK",
      auth
        ? {
            status: auth.status,
            accountName: auth.displayName ?? auth.username,
            followers: null,
            expiresAt: auth.expiresAt,
            lastSyncAt: auth.lastSyncAt,
            errorMessage: auth.errorMessage,
            syncLog: auth.syncLogs[0] ?? null,
          }
        : null,
    )
  }

  if (account.platform === "INSTAGRAM") {
    const auth = account.instagramAuth
    return buildIntegrationState(
      "INSTAGRAM",
      auth
        ? {
            status: auth.status,
            accountName: auth.username,
            followers: auth.followersCount,
            expiresAt: auth.expiresAt,
            lastSyncAt: auth.lastSyncAt,
            errorMessage: auth.lastError,
            syncLog: auth.syncLogs[0] ?? null,
          }
        : null,
    )
  }

  return null
}

/**
 * Catálogo completo de nichos (espelha o enum do router clipper —
 * addSocialAccount/updateSocialAccount). Mantido integral para que toda
 * conta com nicho salvo exiba o badge correto.
 */
const nicheConfig: Record<string, { label: string; emoji: string }> = {
  MOTIVATIONAL: { label: "Motivacional", emoji: "💪" }, GOSSIP: { label: "Fofoca", emoji: "🗣️" }, MEME: { label: "Meme", emoji: "😂" }, ENTREPRENEURSHIP: { label: "Empreendedorismo", emoji: "🚀" }, HUMOR: { label: "Humor", emoji: "🤣" }, GAMING: { label: "Gaming", emoji: "🎮" }, SPORTS: { label: "Esportes", emoji: "⚽" }, MUSIC: { label: "Música", emoji: "🎵" }, EDUCATION: { label: "Educação", emoji: "📚" }, NEWS: { label: "Notícias", emoji: "📰" }, POLITICS: { label: "Política", emoji: "🏛️" }, LIFESTYLE: { label: "Lifestyle", emoji: "✨" }, FITNESS: { label: "Fitness", emoji: "🏋️" }, FASHION: { label: "Moda", emoji: "👗" }, BEAUTY: { label: "Beleza", emoji: "💄" }, FOOD: { label: "Comida", emoji: "🍕" }, TRAVEL: { label: "Viagem", emoji: "✈️" }, TECH: { label: "Tecnologia", emoji: "💻" }, FINANCE: { label: "Finanças", emoji: "💰" }, RELIGION: { label: "Religião", emoji: "🙏" }, ENTERTAINMENT: { label: "Entretenimento", emoji: "🎬" }, HOT: { label: "Hot", emoji: "🔥" }, FAMILY: { label: "Família", emoji: "👨‍👩‍👧‍👦" }, MATERNITY: { label: "Maternidade", emoji: "🤱" }, PATERNITY: { label: "Paternidade", emoji: "👨‍👧" }, MARRIAGE: { label: "Casamento", emoji: "💍" }, BODYBUILDING: { label: "Maromba", emoji: "💪🏋️" }, WOMEN: { label: "Mulher", emoji: "👩" }, MEN: { label: "Homem", emoji: "👨" }, COUPLE: { label: "Casal", emoji: "💑" }, PETS: { label: "Pets", emoji: "🐾" }, CARS: { label: "Carros", emoji: "🚗" }, MOTORCYCLES: { label: "Motos", emoji: "🏍️" }, ANIME: { label: "Anime", emoji: "🎌" }, KPOP: { label: "K-Pop", emoji: "🇰🇷" }, DANCE: { label: "Dança", emoji: "💃" }, COMEDY: { label: "Comédia", emoji: "😆" }, DRAMA: { label: "Drama", emoji: "🎭" }, ASTROLOGY: { label: "Astrologia", emoji: "♈" }, PSYCHOLOGY: { label: "Psicologia", emoji: "🧠" }, SELF_HELP: { label: "Autoajuda", emoji: "📖" }, PRODUCTIVITY: { label: "Produtividade", emoji: "⏱️" }, MARKETING: { label: "Marketing", emoji: "📢" }, SALES: { label: "Vendas", emoji: "🛒" }, REAL_ESTATE: { label: "Imobiliário", emoji: "🏠" }, CRYPTO: { label: "Cripto", emoji: "₿" }, INVESTING: { label: "Investimentos", emoji: "📈" }, DIY: { label: "Faça Você Mesmo", emoji: "🔨" }, ART: { label: "Arte", emoji: "🎨" }, PHOTOGRAPHY: { label: "Fotografia", emoji: "📷" }, CINEMA: { label: "Cinema", emoji: "🎥" }, SERIES: { label: "Séries", emoji: "📺" }, BOOKS: { label: "Livros", emoji: "📚" }, PODCAST: { label: "Podcast", emoji: "🎙️" }, ASMR: { label: "ASMR", emoji: "🎧" }, NATURE: { label: "Natureza", emoji: "🌿" }, SUSTAINABILITY: { label: "Sustentabilidade", emoji: "♻️" }, HEALTH: { label: "Saúde", emoji: "🏥" }, MENTAL_HEALTH: { label: "Saúde Mental", emoji: "🧘" }, NUTRITION: { label: "Nutrição", emoji: "🥗" }, VEGAN: { label: "Vegano", emoji: "🌱" }, WINE: { label: "Vinho", emoji: "🍷" }, COFFEE: { label: "Café", emoji: "☕" }, BEER: { label: "Cerveja", emoji: "🍺" }, COOKING: { label: "Culinária", emoji: "👨‍🍳" }, CONFECTIONERY: { label: "Confeitaria", emoji: "🎂" }, DECORATION: { label: "Decoração", emoji: "🏡" }, ARCHITECTURE: { label: "Arquitetura", emoji: "🏗️" }, GARDEN: { label: "Jardinagem", emoji: "🌻" }, CLEANING: { label: "Limpeza", emoji: "🧹" }, ORGANIZATION: { label: "Organização", emoji: "📦" }, PARENTING: { label: "Parentalidade", emoji: "👪" }, BABY: { label: "Bebê", emoji: "👶" }, KIDS: { label: "Crianças", emoji: "🧒" }, TEENS: { label: "Adolescentes", emoji: "🧑" }, SCHOOL: { label: "Escola", emoji: "🏫" }, UNIVERSITY: { label: "Universidade", emoji: "🎓" }, LANGUAGES: { label: "Idiomas", emoji: "🌍" }, LAW: { label: "Direito", emoji: "⚖️" }, MEDICINE: { label: "Medicina", emoji: "🩺" }, ENGINEERING: { label: "Engenharia", emoji: "⚙️" }, SCIENCE: { label: "Ciência", emoji: "🔬" }, HISTORY: { label: "História", emoji: "🏛️" }, PHILOSOPHY: { label: "Filosofia", emoji: "💭" }, SOCIOLOGY: { label: "Sociologia", emoji: "👥" }, ECONOMY: { label: "Economia", emoji: "📊" }, MILITARY: { label: "Militar", emoji: "🎖️" }, POLICE: { label: "Policial", emoji: "🚔" }, FIREFIGHTER: { label: "Bombeiro", emoji: "🚒" }, TRUCKER: { label: "Caminhoneiro", emoji: "🚛" }, RURAL: { label: "Rural", emoji: "🌾" }, AGRIBUSINESS: { label: "Agronegócio", emoji: "🚜" }, FISHING: { label: "Pesca", emoji: "🎣" }, HUNTING: { label: "Caça", emoji: "🦌" }, SURF: { label: "Surf", emoji: "🏄" }, SKATE: { label: "Skate", emoji: "🛹" }, CROSSFIT: { label: "CrossFit", emoji: "🏋️‍♂️" }, YOGA: { label: "Yoga", emoji: "🧘‍♀️" }, PILATES: { label: "Pilates", emoji: "🤸" }, RUNNING: { label: "Corrida", emoji: "🏃" }, CYCLING: { label: "Ciclismo", emoji: "🚴" }, SWIMMING: { label: "Natação", emoji: "🏊" }, MARTIAL_ARTS: { label: "Artes Marciais", emoji: "🥋" }, BOXING: { label: "Boxe", emoji: "🥊" }, SOCCER: { label: "Futebol", emoji: "⚽" }, BASKETBALL: { label: "Basquete", emoji: "🏀" }, VOLLEYBALL: { label: "Vôlei", emoji: "🏐" }, TENNIS: { label: "Tênis", emoji: "🎾" }, GOLF: { label: "Golfe", emoji: "⛳" }, ESPORTS: { label: "E-Sports", emoji: "🕹️" }, STREAMER: { label: "Streamer", emoji: "📡" }, COSPLAY: { label: "Cosplay", emoji: "🎭" }, TATTOO: { label: "Tatuagem", emoji: "💉" }, PIERCING: { label: "Piercing", emoji: "💎" }, NAILS: { label: "Unhas", emoji: "💅" }, HAIR: { label: "Cabelo", emoji: "💇" }, SKINCARE: { label: "Skincare", emoji: "🧴" }, MAKEUP: { label: "Maquiagem", emoji: "💄" }, PLUS_SIZE: { label: "Plus Size", emoji: "👗" }, LUXURY: { label: "Luxo", emoji: "👑" }, MINIMALISM: { label: "Minimalismo", emoji: "🪴" }, VINTAGE: { label: "Vintage", emoji: "📻" }, STREETWEAR: { label: "Streetwear", emoji: "🧢" }, SNEAKERS: { label: "Sneakers", emoji: "👟" }, JEWELRY: { label: "Joias", emoji: "💎" }, WATCHES: { label: "Relógios", emoji: "⌚" }, HANDBAGS: { label: "Bolsas", emoji: "👜" }, WEDDING: { label: "Casamentos", emoji: "👰" }, PARTY: { label: "Festas", emoji: "🎉" }, EVENTS: { label: "Eventos", emoji: "🎪" }, CARNIVAL: { label: "Carnaval", emoji: "🎊" }, FUNK: { label: "Funk", emoji: "🎶" }, SERTANEJO: { label: "Sertanejo", emoji: "🤠" }, RAP: { label: "Rap", emoji: "🎤" }, ROCK: { label: "Rock", emoji: "🎸" }, POP: { label: "Pop", emoji: "🌟" }, ELECTRONIC: { label: "Eletrônica", emoji: "🎛️" }, GOSPEL: { label: "Gospel", emoji: "✝️" }, PAGODE: { label: "Pagode", emoji: "🪘" }, FORRO: { label: "Forró", emoji: "🪗" }, MPB: { label: "MPB", emoji: "🇧🇷" }, REGGAE: { label: "Reggae", emoji: "🟢" }, JAZZ: { label: "Jazz", emoji: "🎷" }, CLASSICAL: { label: "Clássica", emoji: "🎻" }, COUNTRY: { label: "Country", emoji: "🤠" }, TRAP: { label: "Trap", emoji: "🔊" }, LGBTQ: { label: "LGBTQ+", emoji: "🏳️‍🌈" }, DIVERSITY: { label: "Diversidade", emoji: "🌈" }, FEMINISM: { label: "Feminismo", emoji: "♀️" }, ACTIVISM: { label: "Ativismo", emoji: "✊" }, CHARITY: { label: "Caridade", emoji: "❤️" }, VOLUNTEERING: { label: "Voluntariado", emoji: "🤝" }, SPIRITUAL: { label: "Espiritualidade", emoji: "🕊️" }, MEDITATION: { label: "Meditação", emoji: "🧘" }, TAROT: { label: "Tarot", emoji: "🃏" }, NUMEROLOGY: { label: "Numerologia", emoji: "🔢" }, CONSPIRACY: { label: "Conspiração", emoji: "👁️" }, TRUE_CRIME: { label: "True Crime", emoji: "🔍" }, HORROR: { label: "Terror", emoji: "👻" }, PARANORMAL: { label: "Paranormal", emoji: "👽" }, RIDDLES: { label: "Enigmas", emoji: "🧩" }, TRIVIA: { label: "Curiosidades", emoji: "❓" }, CHALLENGES: { label: "Desafios", emoji: "🏆" }, PRANKS: { label: "Pegadinhas", emoji: "😜" }, REACTIONS: { label: "Reações", emoji: "😱" }, UNBOXING: { label: "Unboxing", emoji: "📦" }, REVIEWS: { label: "Reviews", emoji: "⭐" }, TUTORIALS: { label: "Tutoriais", emoji: "📝" }, TIPS: { label: "Dicas", emoji: "💡" }, HACKS: { label: "Hacks", emoji: "🛠️" }, STORYTIME: { label: "Storytime", emoji: "📖" }, CONFESSIONS: { label: "Confissões", emoji: "🤫" }, RELATIONSHIPS: { label: "Relacionamentos", emoji: "❤️‍🔥" }, DATING: { label: "Paquera", emoji: "💘" }, BREAKUP: { label: "Términos", emoji: "💔" }, FRIENDSHIP: { label: "Amizade", emoji: "🤗" }, BULLYING: { label: "Bullying", emoji: "🚫" }, MENTAL_WELLNESS: { label: "Bem-estar", emoji: "🌸" }, THERAPY: { label: "Terapia", emoji: "🛋️" }, ADHD: { label: "TDAH", emoji: "⚡" }, AUTISM: { label: "Autismo", emoji: "🧩" }, DISABILITY: { label: "Deficiência", emoji: "♿" }, ACCESSIBILITY: { label: "Acessibilidade", emoji: "🦽" }, SIGN_LANGUAGE: { label: "Libras", emoji: "🤟" }, IMMIGRATION: { label: "Imigração", emoji: "🌍" }, EXPAT: { label: "Expatriado", emoji: "🧳" }, NOMAD: { label: "Nômade Digital", emoji: "🏝️" }, BACKPACKING: { label: "Mochilão", emoji: "🎒" }, CAMPING: { label: "Camping", emoji: "⛺" }, HIKING: { label: "Trilha", emoji: "🥾" }, BEACH: { label: "Praia", emoji: "🏖️" }, MOUNTAIN: { label: "Montanha", emoji: "🏔️" }, FARM: { label: "Fazenda", emoji: "🐄" }, CITY: { label: "Cidade", emoji: "🏙️" }, INTERIOR: { label: "Interior", emoji: "🌄" }, FAVELA: { label: "Favela", emoji: "🏘️" }, PERIFERIAS: { label: "Periferia", emoji: "🏚️" }, NORDESTE: { label: "Nordeste", emoji: "☀️" }, AMAZONIA: { label: "Amazônia", emoji: "🌳" }, OTHER: { label: "Outro", emoji: "📌" },
}

const sortedNiches = Object.entries(nicheConfig).sort((a, b) =>
  a[1].label.localeCompare(b[1].label, "pt-BR"),
)

/** Sanitiza username: sem @ e sem espaços. */
const cleanUsername = (value: string) =>
  value.replace(/@/g, "").replace(/\s/g, "")

/**
 * Validação do link de perfil do Facebook (mesma sequência do fluxo de
 * adicionar e de editar; toasts do dialog levam description).
 */
function validateFacebookUrl(url: string, withDescriptions: boolean): boolean {
  if (!url.trim()) {
    toast.error(
      "Link do perfil obrigatório",
      withDescriptions
        ? {
            description:
              "Para Facebook, informe o link completo do perfil com /reels",
          }
        : undefined,
    )
    return false
  }
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    toast.error(
      "Link incompleto",
      withDescriptions
        ? { description: "O link deve começar com https://" }
        : undefined,
    )
    return false
  }
  if (!url.includes("facebook.com") && !url.includes("fb.com")) {
    toast.error(
      "Link inválido",
      withDescriptions
        ? { description: "O link deve ser do Facebook" }
        : undefined,
    )
    return false
  }
  const hasReelsPath = url.endsWith("/reels") || url.endsWith("/reels/")
  const hasProfileReels =
    url.includes("profile.php?id=") &&
    (url.includes("&sk=owner_reels") || url.includes("&sk=reels_tab"))
  if (!hasReelsPath && !hasProfileReels) {
    toast.error(
      "Formato incorreto",
      withDescriptions
        ? {
            description:
              "Use: /seu_perfil/reels OU profile.php?id=123&sk=owner_reels",
          }
        : undefined,
    )
    return false
  }
  return true
}

export default function ManageAccounts() {
  // ===== Dialog de adicionar =====
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [selectedPlatform, setSelectedPlatform] = React.useState("")
  const [username, setUsername] = React.useState("")
  const [selectedNiche, setSelectedNiche] = React.useState<AccountNiche | null>(
    null,
  )
  const [facebookProfileUrl, setFacebookProfileUrl] = React.useState("")
  const [addNicheOpen, setAddNicheOpen] = React.useState(false)

  // ===== Edição inline =====
  const [editingAccountId, setEditingAccountId] = React.useState<string | null>(
    null,
  )
  const [editingUsername, setEditingUsername] = React.useState("")
  const [editingNiche, setEditingNiche] = React.useState<AccountNiche | null>(
    null,
  )
  const [editingFacebookUrl, setEditingFacebookUrl] = React.useState("")
  const [editNicheOpen, setEditNicheOpen] = React.useState(false)

  // ===== Toggle ativa/inativa =====
  const [togglingAccountId, setTogglingAccountId] = React.useState<
    string | null
  >(null)

  // ===== Integrações sociais =====
  const [integrationBusyId, setIntegrationBusyId] = React.useState<
    string | null
  >(null)
  const [disconnectTarget, setDisconnectTarget] = React.useState<{
    id: string
    username: string
    platform: IntegrationPlatform
  } | null>(null)

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const callbacks = [
      { key: "instagram", label: "Instagram" },
      { key: "tiktok", label: "TikTok" },
      { key: "youtube", label: "YouTube" },
    ] as const
    const callback = callbacks.find(({ key }) => params.has(key))
    if (!callback) return

    const status = params.get(callback.key)
    if (status === "success") {
      const username = params.get("username")
      toast.success(`${callback.label} conectado`, {
        description: username
          ? `A conta @${username} foi conectada com sucesso.`
          : "A conta foi conectada com sucesso.",
      })
    } else {
      toast.error(`Erro ao conectar ${callback.label}`, {
        description:
          params.get("message") ??
          params.get("error") ??
          "A autorização não foi concluída.",
      })
    }

    params.delete(callback.key)
    params.delete("message")
    params.delete("error")
    params.delete("authId")
    params.delete("username")
    const query = params.toString()
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
    )
  }, [])

  // ===== Query =====
  const {
    data: accounts = [],
    isLoading,
    refetch,
  } = api.clipper.getMySocialAccounts.useQuery()

  /**
   * Feature flag fail-closed: sem permissão (ou enquanto carrega) a tela fica
   * exatamente como era antes das integrações.
   */
  const { data: canUseSocialIntegrations = false } =
    api.clipper.canUseSocialIntegrations.useQuery()

  // ===== Mutations =====
  const addAccountMutation = api.clipper.addSocialAccount.useMutation({
    onSuccess: () => {
      toast.success("Conta adicionada!")
      setIsAddDialogOpen(false)
      resetAddForm()
      void refetch()
    },
    onError: (error) => {
      toast.error("Erro ao adicionar conta", { description: error.message })
    },
  })

  const updateAccountMutation = api.clipper.updateSocialAccount.useMutation({
    onSuccess: () => {
      toast.success("Conta atualizada!")
      cancelEditing()
      void refetch()
    },
    onError: (error) => {
      toast.error("Erro ao atualizar conta", { description: error.message })
    },
  })

  const toggleActiveMutation = api.clipper.toggleSocialAccountActive.useMutation(
    {
      onSuccess: (_data, variables) => {
        toast.success(
          variables.isActive ? "Conta ativada!" : "Conta desativada!",
          {
            description: variables.isActive
              ? "A conta voltou a ficar ativa."
              : "A conta foi desativada e não será usada em competições.",
          },
        )
        setTogglingAccountId(null)
        void refetch()
      },
      onError: (error) => {
        setTogglingAccountId(null)
        toast.error("Erro ao alterar status", { description: error.message })
      },
    },
  )

  // ===== Mutations de integração (mesma UX nas 3 redes) =====
  const connectOptions = (label: string) => ({
    onMutate: ({ socialAccountId }: { socialAccountId: string }) => {
      setIntegrationBusyId(socialAccountId)
    },
    onSuccess: (data: {
      success: boolean
      authUrl?: string | null
      error?: string | null
    }) => {
      if (!data.success || !data.authUrl) {
        setIntegrationBusyId(null)
        toast.error(`Erro ao conectar ${label}`, {
          description: data.error ?? "URL de autorização indisponível",
        })
        return
      }
      // Redireciona para a tela de consentimento da rede social.
      window.location.href = data.authUrl
    },
    onError: (error: { message: string }) => {
      setIntegrationBusyId(null)
      toast.error(`Erro ao conectar ${label}`, {
        description: describeIntegrationError(error.message),
      })
    },
  })

  const syncOptions = (label: string) => ({
    onMutate: ({ socialAccountId }: { socialAccountId: string }) => {
      setIntegrationBusyId(socialAccountId)
    },
    onSuccess: (data: unknown) => {
      setIntegrationBusyId(null)
      const error = getIntegrationActionError(data)
      if (error) {
        toast.error(`Erro ao sincronizar ${label}`, { description: error })
        return
      }
      toast.success(`Sincronização do ${label} iniciada`, {
        description: "Os vídeos serão atualizados em instantes.",
      })
      void refetch()
    },
    onError: (error: { message: string }) => {
      setIntegrationBusyId(null)
      toast.error(`Erro ao sincronizar ${label}`, {
        description: describeIntegrationError(error.message),
      })
    },
  })

  const disconnectOptions = (label: string) => ({
    onMutate: ({ socialAccountId }: { socialAccountId: string }) => {
      setIntegrationBusyId(socialAccountId)
    },
    onSuccess: (data: unknown) => {
      setIntegrationBusyId(null)
      const error = getIntegrationActionError(data)
      if (error) {
        toast.error(`Erro ao desconectar ${label}`, { description: error })
        return
      }
      setDisconnectTarget(null)
      toast.success(`${label} desconectado`, {
        description:
          "A conta continua cadastrada, mas sem sincronização automática.",
      })
      void refetch()
    },
    onError: (error: { message: string }) => {
      setIntegrationBusyId(null)
      toast.error(`Erro ao desconectar ${label}`, {
        description: describeIntegrationError(error.message),
      })
    },
  })

  const integrationMutations: Record<
    IntegrationPlatform,
    Record<"connect" | "sync" | "disconnect", IntegrationMutation>
  > = {
    INSTAGRAM: {
      connect: api.instagram.startConnection.useMutation(
        connectOptions("Instagram"),
      ),
      sync: api.instagram.syncNow.useMutation(syncOptions("Instagram")),
      disconnect: api.instagram.disconnect.useMutation(
        disconnectOptions("Instagram"),
      ),
    },
    TIKTOK: {
      connect: api.tiktok.startConnection.useMutation(connectOptions("TikTok")),
      sync: api.tiktok.syncNow.useMutation(syncOptions("TikTok")),
      disconnect: api.tiktok.disconnect.useMutation(
        disconnectOptions("TikTok"),
      ),
    },
    YOUTUBE: {
      connect: api.youtube.startConnection.useMutation(
        connectOptions("YouTube"),
      ),
      sync: api.youtube.syncNow.useMutation(syncOptions("YouTube")),
      disconnect: api.youtube.disconnect.useMutation(
        disconnectOptions("YouTube"),
      ),
    },
  }

  // ===== Handlers =====
  const resetAddForm = () => {
    setSelectedPlatform("")
    setUsername("")
    setSelectedNiche(null)
    setFacebookProfileUrl("")
  }

  const openAddDialog = (platform?: PlatformKey) => {
    if (platform) setSelectedPlatform(platform)
    setIsAddDialogOpen(true)
  }

  const handleAddAccount = () => {
    if (!selectedPlatform || !username.trim()) {
      toast.error("Preencha todos os campos")
      return
    }
    if (!selectedNiche) {
      toast.error("Selecione o nicho da conta")
      return
    }
    const isFacebook = selectedPlatform === "FACEBOOK"
    if (isFacebook && !validateFacebookUrl(facebookProfileUrl, true)) return

    addAccountMutation.mutate({
      platform: selectedPlatform as PlatformKey,
      username,
      profileUrl: isFacebook ? facebookProfileUrl : undefined,
      niche: selectedNiche,
    })
  }

  const startEditing = (account: SocialAccount, niche?: AccountNiche | null) => {
    setEditingAccountId(account.id)
    setEditingUsername(cleanUsername(account.username))
    setEditingNiche(
      niche !== undefined ? niche : ((account.niche as AccountNiche | null) ?? null),
    )
    setEditingFacebookUrl(
      account.platform === "FACEBOOK" ? (account.profileUrl ?? "") : "",
    )
  }

  const cancelEditing = () => {
    setEditingAccountId(null)
    setEditingUsername("")
    setEditingNiche(null)
    setEditingFacebookUrl("")
    setEditNicheOpen(false)
  }

  const saveEdit = (account: SocialAccount) => {
    if (!editingUsername.trim()) {
      toast.error("Username não pode estar vazio")
      return
    }
    const isFacebook = account.platform === "FACEBOOK"
    if (isFacebook && !validateFacebookUrl(editingFacebookUrl, false)) return

    updateAccountMutation.mutate({
      accountId: account.id,
      username: editingUsername,
      profileUrl: isFacebook ? editingFacebookUrl : undefined,
      niche: editingNiche,
    })
  }

  const confirmDisconnect = () => {
    if (!disconnectTarget) return
    integrationMutations[disconnectTarget.platform].disconnect.mutate({
      socialAccountId: disconnectTarget.id,
    })
  }

  const isDisconnecting = disconnectTarget
    ? integrationMutations[disconnectTarget.platform].disconnect.isPending
    : false

  const handleToggleActive = (account: SocialAccount) => {
    setTogglingAccountId(account.id)
    toggleActiveMutation.mutate({
      accountId: account.id,
      isActive: !account.isActive,
    })
  }

  // ===== Derivados =====
  const groupedAccounts = PLATFORM_KEYS.map((platform) => ({
    platform,
    config: platformConfig[platform],
    hex: PLATFORM_HEX[platform],
    accounts: accounts.filter((account) => account.platform === platform),
  }))

  const emptyPlatforms = groupedAccounts.filter(
    (group) => group.accounts.length === 0,
  )
  const activeCount = accounts.filter((account) => account.isActive).length
  const connectedPlatforms = groupedAccounts.filter(
    (group) => group.accounts.length > 0,
  ).length

  // ===== Skeleton espelhando o layout =====
  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
        <HeroSkeleton stats={3} viz={<ManageAccountsHeroVizSkeleton />} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Bone key={index} delay={index * 100} className="h-28 rounded-2xl" />
          ))}
        </div>
        {[0, 1].map((group) => (
          <div key={group} className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <Bone delay={500 + group * 200} className="size-8 rounded-lg" />
              <Bone delay={560 + group * 200} className="h-4 w-28" />
              <Bone
                delay={620 + group * 200}
                className="h-5 w-8 rounded-full"
              />
            </div>
            <ListRowsSkeleton rows={group === 0 ? 2 : 1} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero ===== */}
      <HomeHero
        eyebrow="Clipfy League · Contas"
        title={
          <>
            Minhas <span className="text-gradient">contas</span>
          </>
        }
        subtitle="Gerencie suas contas de redes sociais para competir — conecte novos perfis, defina o nicho e ative as contas que valem pontos."
        viz={<ManageAccountsHeroViz />}
        vizSkeleton={<ManageAccountsHeroVizSkeleton />}
        stats={[
          {
            icon: <UsersThree className="size-3.5" weight="fill" />,
            label: "Contas",
            value: accounts.length,
            kind: "int",
          },
          {
            icon: <Check className="size-3.5" weight="bold" />,
            label: "Ativas",
            value: activeCount,
            kind: "int",
          },
          {
            icon: <Sparkle className="size-3.5" weight="fill" />,
            label: "Redes conectadas",
            value: connectedPlatforms,
            kind: "int",
          },
        ]}
      />

      {/* ===== Toolbar: título da seção + adicionar ===== */}
      <Reveal immediate>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight sm:text-xl">
              Contas por plataforma
            </h2>
            <p className="text-muted-foreground text-sm">
              Toque numa rede sem contas para conectar a primeira
            </p>
          </div>
          <Button
            className="btn-gradient-auth h-10 cursor-pointer rounded-xl font-semibold"
            onClick={() => openAddDialog()}
          >
            <Plus className="size-4" weight="bold" />
            Adicionar Conta
          </Button>
        </div>
      </Reveal>

      {/* ===== Resumo por plataforma ===== */}
      <Reveal immediate delayMs={60}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {groupedAccounts.map(({ platform, config, hex, accounts: list }) => {
            const PlatformIcon = config.icon
            const isEmpty = list.length === 0
            return (
              <button
                key={platform}
                type="button"
                onClick={isEmpty ? () => openAddDialog(platform) : undefined}
                className={cn(
                  "glass-card group relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl p-4 text-center transition-all",
                  config.borderColor,
                  isEmpty
                    ? "cursor-pointer hover:-translate-y-0.5"
                    : "cursor-default",
                )}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background: `radial-gradient(circle at 50% 0%, ${hex}15, transparent 70%)`,
                  }}
                />
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
                    config.bgColor,
                  )}
                >
                  <PlatformIcon className={cn("size-5", config.color)} />
                </span>
                <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
                  {config.label}
                </span>
                <span
                  className="text-xl font-bold tabular-nums sm:text-2xl"
                  style={list.length > 0 ? { color: hex } : undefined}
                >
                  {list.length}
                </span>
              </button>
            )
          })}
        </div>
      </Reveal>

      {/* ===== Grupos de contas por plataforma ===== */}
      {groupedAccounts
        .filter((group) => group.accounts.length > 0)
        .map((group, groupIndex) => {
          const { platform, config, hex, accounts: list } = group
          const PlatformIcon = config.icon
          return (
            <Reveal immediate key={platform} delayMs={120 + groupIndex * 80}>
              <section className="flex flex-col gap-3">
                {/* header do grupo */}
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg",
                      config.bgColor,
                    )}
                  >
                    <PlatformIcon className={cn("size-4", config.color)} />
                  </span>
                  <h2 className="text-sm font-bold">{config.label}</h2>
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full text-[10px] tabular-nums",
                      config.borderColor,
                      config.color,
                    )}
                  >
                    {list.length}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 cursor-pointer rounded-lg"
                    aria-label={`Adicionar conta de ${config.label}`}
                    onClick={() => openAddDialog(platform)}
                  >
                    <Plus className="size-3.5" weight="bold" />
                    <span className="hidden sm:inline">Adicionar</span>
                  </Button>
                </div>

                {/* cards de conta */}
                <div className="flex flex-col gap-2.5">
                  {list.map((account) => {
                    const isEditing = editingAccountId === account.id
                    const isToggling =
                      togglingAccountId === account.id &&
                      toggleActiveMutation.isPending
                    const nicheInfo = account.niche
                      ? nicheConfig[account.niche]
                      : undefined
                    const integration = canUseSocialIntegrations
                      ? getIntegrationState(account)
                      : null
                    const integrationActions = integration
                      ? integrationMutations[integration.platform]
                      : null
                    const isIntegrationBusy = integrationBusyId === account.id

                    return (
                      <article
                        key={account.id}
                        className={cn(
                          "glass-card relative overflow-hidden rounded-2xl transition-all",
                          account.isActive
                            ? cn("glass-card-hover", config.borderColor)
                            : "opacity-60",
                        )}
                      >
                        {account.isActive && (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0"
                            style={{
                              background: `linear-gradient(90deg, ${hex}14, transparent 55%)`,
                            }}
                          />
                        )}

                        {isEditing ? (
                          /* ===== Modo edição inline ===== */
                          <div className="relative flex flex-col gap-4 p-4 sm:p-5">
                            <div className="border-border/60 flex items-center gap-2.5 border-b pb-3">
                              <span
                                className={cn(
                                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                                  config.bgColor,
                                )}
                              >
                                <PlatformIcon
                                  className={cn("size-4", config.color)}
                                />
                              </span>
                              <p className="text-sm font-bold">
                                Editando conta
                              </p>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              {/* username */}
                              <div className="flex flex-col gap-2">
                                <Label
                                  htmlFor={`edit-username-${account.id}`}
                                  className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase"
                                >
                                  Username
                                </Label>
                                <div className="relative">
                                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm">
                                    @
                                  </span>
                                  <Input
                                    id={`edit-username-${account.id}`}
                                    placeholder="username"
                                    value={editingUsername}
                                    onChange={(event) =>
                                      setEditingUsername(
                                        cleanUsername(event.target.value),
                                      )
                                    }
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter")
                                        saveEdit(account)
                                      if (event.key === "Escape")
                                        cancelEditing()
                                    }}
                                    className="h-10 rounded-xl pl-8"
                                    disabled={updateAccountMutation.isPending}
                                  />
                                </div>
                              </div>

                              {/* nicho */}
                              <div className="flex flex-col gap-2">
                                <Label className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
                                  Nicho
                                </Label>
                                <Popover
                                  open={editNicheOpen}
                                  onOpenChange={setEditNicheOpen}
                                >
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      aria-expanded={editNicheOpen}
                                      className="h-10 w-full cursor-pointer justify-between rounded-xl font-normal"
                                      disabled={
                                        updateAccountMutation.isPending
                                      }
                                    >
                                      {editingNiche &&
                                      nicheConfig[editingNiche] ? (
                                        <span className="flex items-center gap-2">
                                          <span>
                                            {nicheConfig[editingNiche]?.emoji}
                                          </span>
                                          <span>
                                            {nicheConfig[editingNiche]?.label}
                                          </span>
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">
                                          Selecionar nicho
                                        </span>
                                      )}
                                      <CaretUpDown className="size-4 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    className="w-[var(--radix-popover-trigger-width)] rounded-xl p-0"
                                    align="start"
                                  >
                                    <Command>
                                      <CommandInput
                                        placeholder="Buscar nicho..."
                                        className="h-10"
                                      />
                                      <CommandList className="max-h-[200px]">
                                        <CommandEmpty>
                                          Nenhum nicho encontrado.
                                        </CommandEmpty>
                                        <CommandGroup>
                                          {sortedNiches.map(
                                            ([key, { label, emoji }]) => (
                                              <CommandItem
                                                key={key}
                                                value={label}
                                                onSelect={() => {
                                                  setEditingNiche(
                                                    key as AccountNiche,
                                                  )
                                                  setEditNicheOpen(false)
                                                }}
                                                className="cursor-pointer"
                                              >
                                                <span className="flex flex-1 items-center gap-2.5">
                                                  <span className="text-sm">
                                                    {emoji}
                                                  </span>
                                                  <span className="text-sm font-medium">
                                                    {label}
                                                  </span>
                                                </span>
                                                {editingNiche === key && (
                                                  <Check
                                                    className="text-brand-cyan not-dark:text-primary size-4 shrink-0"
                                                    weight="bold"
                                                  />
                                                )}
                                              </CommandItem>
                                            ),
                                          )}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </div>

                            {/* link do perfil — apenas Facebook */}
                            {account.platform === "FACEBOOK" && (
                              <div className="flex flex-col gap-2">
                                <Label
                                  htmlFor={`edit-facebook-${account.id}`}
                                  className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase"
                                >
                                  Link do Perfil
                                </Label>
                                <div className="relative">
                                  <LinkSimple className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
                                  <Input
                                    id={`edit-facebook-${account.id}`}
                                    placeholder="https://www.facebook.com/seu_perfil/reels"
                                    value={editingFacebookUrl}
                                    onChange={(event) =>
                                      setEditingFacebookUrl(event.target.value)
                                    }
                                    className="h-10 rounded-xl pl-10"
                                    disabled={updateAccountMutation.isPending}
                                  />
                                </div>
                              </div>
                            )}

                            {/* ações */}
                            <div className="flex justify-end gap-2.5">
                              <Button
                                variant="ghost"
                                className="h-10 cursor-pointer rounded-xl font-semibold"
                                onClick={cancelEditing}
                                disabled={updateAccountMutation.isPending}
                              >
                                <X className="size-4" />
                                Cancelar
                              </Button>
                              <Button
                                className="btn-gradient-auth h-10 cursor-pointer rounded-xl font-semibold"
                                onClick={() => saveEdit(account)}
                                disabled={updateAccountMutation.isPending}
                              >
                                {updateAccountMutation.isPending ? (
                                  <CircleNotch className="size-4 animate-spin" />
                                ) : (
                                  <Check className="size-4" weight="bold" />
                                )}
                                Salvar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* ===== Modo leitura ===== */
                          <div className="relative">
                            <div className="flex items-center gap-3 p-3.5 sm:p-4">
                              {/* ícone da plataforma + selo de verificação */}
                              <span
                                className={cn(
                                  "relative flex size-11 shrink-0 items-center justify-center rounded-xl",
                                  config.bgColor,
                                  !account.isActive && "opacity-60 grayscale",
                                )}
                              >
                                <PlatformIcon
                                  className={cn("size-5", config.color)}
                                />
                                {account.isVerified && (
                                  <span className="bg-background absolute -top-1.5 -right-1.5 flex size-4.5 items-center justify-center rounded-full">
                                    <SealCheck
                                      className="size-4 text-blue-500"
                                      weight="fill"
                                    />
                                  </span>
                                )}
                              </span>

                              {/* identidade */}
                              <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <p
                                    className={cn(
                                      "truncate text-sm font-bold sm:text-[15px]",
                                      !account.isActive &&
                                        "text-muted-foreground line-through",
                                    )}
                                  >
                                    {account.username}
                                  </p>
                                  {account.isPrimary && (
                                    <Badge className="gap-1 rounded-full border-amber-400/50 bg-gradient-to-r from-amber-400 to-yellow-500 text-[10px] font-black text-[#3b2a00]">
                                      <Trophy className="size-2.5" weight="fill" />
                                      Principal
                                    </Badge>
                                  )}
                                  {!account.isActive && (
                                    <Badge
                                      variant="outline"
                                      className="rounded-full border-red-500/30 text-[10px] font-semibold text-red-500 dark:text-red-400"
                                    >
                                      Desativada
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                  {nicheInfo ? (
                                    <Badge
                                      variant="outline"
                                      className="rounded-full text-[10px]"
                                    >
                                      <span className="mr-0.5">
                                        {nicheInfo.emoji}
                                      </span>
                                      {nicheInfo.label}
                                    </Badge>
                                  ) : (
                                    account.isActive && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          startEditing(account, null)
                                        }
                                        className="group/niche border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan not-dark:border-primary/30 not-dark:bg-primary/10 not-dark:text-primary inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors"
                                      >
                                        <Sparkle
                                          className="size-3 group-hover/niche:animate-spin"
                                          weight="fill"
                                          style={{ animationDuration: "1.5s" }}
                                        />
                                        Definir nicho
                                      </button>
                                    )
                                  )}
                                  {typeof account.followers === "number" &&
                                    account.followers > 0 && (
                                      <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
                                        <UsersThree
                                          className="size-3"
                                          weight="fill"
                                        />
                                        {formatNumber(account.followers)}{" "}
                                        seguidores
                                      </span>
                                    )}
                                </div>
                              </div>

                              {/* ações */}
                              <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
                                {/* wrapper de 36px: o Switch é pequeno demais
                                    para ser alvo de toque sozinho */}
                                <span className="inline-flex size-9 shrink-0 items-center justify-center">
                                  {isToggling ? (
                                    <CircleNotch className="text-muted-foreground size-4 animate-spin" />
                                  ) : (
                                    <Switch
                                      checked={account.isActive}
                                      onCheckedChange={() =>
                                        handleToggleActive(account)
                                      }
                                      aria-label={
                                        account.isActive
                                          ? `Desativar ${account.username}`
                                          : `Ativar ${account.username}`
                                      }
                                      className="cursor-pointer data-[state=checked]:bg-emerald-500"
                                    />
                                  )}
                                </span>
                                <span className="bg-border/60 hidden h-6 w-px sm:block" />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="cursor-pointer rounded-xl"
                                  aria-label={`Editar ${account.username}`}
                                  onClick={() => startEditing(account)}
                                >
                                  <PencilSimple className="size-4" />
                                </Button>
                              </div>
                            </div>

                            {/* ===== Integração oficial da rede ===== */}
                            {integration && integrationActions && (
                              <div className="border-border/60 flex flex-col gap-2.5 border-t px-3.5 py-3 sm:px-4">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "rounded-full text-[10px] font-semibold",
                                      INTEGRATION_TONE_CLASS[
                                        integration.statusTone
                                      ],
                                    )}
                                  >
                                    {integration.statusLabel}
                                  </Badge>
                                  {integration.accountName && (
                                    <span className="text-muted-foreground min-w-0 max-w-[150px] truncate text-[11px] sm:max-w-[220px]">
                                      {integration.accountName}
                                    </span>
                                  )}
                                  {typeof integration.followers === "number" && (
                                    <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
                                      <UsersThree
                                        className="size-3"
                                        weight="fill"
                                      />
                                      {formatNumber(integration.followers)}{" "}
                                      seguidores
                                    </span>
                                  )}
                                  {integration.lastSyncLabel && (
                                    <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
                                      <Clock className="size-3" weight="fill" />
                                      Sync {integration.lastSyncLabel}
                                    </span>
                                  )}
                                  {integration.syncBadge && (
                                    <Badge
                                      variant="outline"
                                      title={integration.syncBadge.title}
                                      className={cn(
                                        "rounded-full text-[10px] font-semibold tabular-nums",
                                        INTEGRATION_TONE_CLASS[
                                          integration.syncBadge.tone
                                        ],
                                      )}
                                    >
                                      {integration.syncBadge.label}
                                    </Badge>
                                  )}
                                  {integration.errorMessage && (
                                    <Badge
                                      variant="outline"
                                      title={integration.errorMessage}
                                      className={cn(
                                        "rounded-full text-[10px] font-semibold",
                                        INTEGRATION_TONE_CLASS.warn,
                                      )}
                                    >
                                      <Warning className="size-3" weight="fill" />
                                      Atenção
                                    </Badge>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={
                                      integration.hasConnection
                                        ? "outline"
                                        : "default"
                                    }
                                    className={cn(
                                      "h-9 cursor-pointer rounded-xl text-xs font-semibold",
                                      !integration.hasConnection &&
                                        "btn-gradient-auth",
                                    )}
                                    disabled={isIntegrationBusy}
                                    aria-label={`${
                                      integration.hasConnection
                                        ? "Reconectar"
                                        : "Conectar"
                                    } ${account.username} no ${config.label}`}
                                    onClick={() =>
                                      integrationActions.connect.mutate({
                                        socialAccountId: account.id,
                                      })
                                    }
                                  >
                                    {isIntegrationBusy &&
                                    integrationActions.connect.isPending ? (
                                      <CircleNotch className="size-3.5 animate-spin motion-reduce:animate-none" />
                                    ) : (
                                      <PlugsConnected
                                        className="size-3.5"
                                        weight="fill"
                                      />
                                    )}
                                    {integration.hasConnection
                                      ? "Reconectar"
                                      : "Conectar"}
                                  </Button>

                                  {integration.hasConnection && (
                                    <>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-9 cursor-pointer rounded-xl text-xs font-semibold"
                                        disabled={
                                          isIntegrationBusy ||
                                          !integration.isConnected
                                        }
                                        aria-label={`Sincronizar ${account.username} agora`}
                                        onClick={() =>
                                          integrationActions.sync.mutate({
                                            socialAccountId: account.id,
                                          })
                                        }
                                      >
                                        {isIntegrationBusy &&
                                        integrationActions.sync.isPending ? (
                                          <CircleNotch className="size-3.5 animate-spin motion-reduce:animate-none" />
                                        ) : (
                                          <ArrowsClockwise className="size-3.5" />
                                        )}
                                        Sincronizar agora
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="text-muted-foreground h-9 cursor-pointer rounded-xl text-xs font-semibold hover:text-red-500 dark:hover:text-red-400"
                                        disabled={isIntegrationBusy}
                                        aria-label={`Desconectar ${account.username} do ${config.label}`}
                                        onClick={() =>
                                          setDisconnectTarget({
                                            id: account.id,
                                            username: account.username,
                                            platform: integration.platform,
                                          })
                                        }
                                      >
                                        <LinkBreak className="size-3.5" />
                                        Desconectar
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              </section>
            </Reveal>
          )
        })}

      {/* ===== Empty states ===== */}
      {accounts.length === 0 ? (
        <Reveal immediate delayMs={140}>
          <div className="glass-card flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed py-16 text-center sm:py-20">
            <div className="relative">
              <span
                aria-hidden
                className="bg-gradient-custom absolute inset-0 animate-pulse rounded-2xl opacity-40 blur-xl"
              />
              <span className="bg-gradient-custom relative flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
                <Sparkle className="size-6" weight="fill" />
              </span>
            </div>
            <div className="px-4">
              <h3 className="text-base font-bold">Nenhuma conta conectada</h3>
              <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
                Adicione suas contas de redes sociais para começar a participar
                de competições e ganhar prêmios.
              </p>
            </div>
            <Button
              className="btn-gradient-auth h-11 cursor-pointer rounded-xl font-semibold"
              onClick={() => openAddDialog()}
            >
              <Plus className="size-4" weight="bold" />
              Adicionar Primeira Conta
            </Button>
          </div>
        </Reveal>
      ) : (
        emptyPlatforms.length > 0 && (
          <Reveal immediate delayMs={200}>
            <div className="border-border/60 rounded-2xl border border-dashed p-4">
              <p className="text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase">
                Redes sem contas
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {emptyPlatforms.map(({ platform, config, hex }) => {
                  const PlatformIcon = config.icon
                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => openAddDialog(platform)}
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-xs font-semibold transition-transform hover:-translate-y-0.5",
                        config.borderColor,
                        config.color,
                      )}
                      style={{ backgroundColor: `${hex}0d` }}
                    >
                      <PlatformIcon className="size-3.5" />
                      {config.label}
                      <Plus className="size-3" weight="bold" />
                    </button>
                  )
                })}
              </div>
            </div>
          </Reveal>
        )
      )}

      {/* ===== Dialog: Nova Conta ===== */}
      <Dialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          setIsAddDialogOpen(open)
          if (!open) resetAddForm()
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-md">
          <DialogHeader className="border-border/60 relative shrink-0 overflow-hidden border-b p-4 text-left sm:p-6">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_14%,transparent)] blur-3xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-cyan)_60%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_40%,transparent)] to-transparent"
            />
            <DialogTitle className="relative flex items-center gap-2.5">
              <span className="bg-gradient-custom flex size-9 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
                <Plus className="size-4.5" weight="bold" />
              </span>
              Nova Conta
            </DialogTitle>
            <DialogDescription className="relative">
              Adicione uma conta de rede social
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-5">
            {/* Plataforma */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-platform" className="text-sm font-semibold">
                Plataforma
              </Label>
              <Select
                value={selectedPlatform}
                onValueChange={setSelectedPlatform}
              >
                <SelectTrigger
                  id="add-platform"
                  className="h-11 w-full cursor-pointer rounded-xl"
                >
                  <SelectValue placeholder="Selecione a plataforma" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {PLATFORM_KEYS.map((platform) => {
                    const config = platformConfig[platform]
                    const PlatformIcon = config.icon
                    return (
                      <SelectItem key={platform} value={platform}>
                        <span className="flex items-center gap-2">
                          <PlatformIcon
                            className={cn("size-4", config.color)}
                          />
                          {config.label}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Username */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-username" className="text-sm font-semibold">
                Username
              </Label>
              <div className="relative">
                <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm">
                  @
                </span>
                <Input
                  id="add-username"
                  placeholder="seu_usuario"
                  value={username}
                  onChange={(event) =>
                    setUsername(cleanUsername(event.target.value))
                  }
                  className="h-11 rounded-xl pl-8"
                  disabled={addAccountMutation.isPending}
                />
              </div>
            </div>

            {/* Nicho */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-semibold">Nicho da Conta</Label>
              <Popover open={addNicheOpen} onOpenChange={setAddNicheOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={addNicheOpen}
                    className="h-11 w-full cursor-pointer justify-between rounded-xl font-normal"
                    disabled={addAccountMutation.isPending}
                  >
                    {selectedNiche && nicheConfig[selectedNiche] ? (
                      <span className="flex items-center gap-2">
                        <span>{nicheConfig[selectedNiche]?.emoji}</span>
                        <span>{nicheConfig[selectedNiche]?.label}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Selecione o nicho
                      </span>
                    )}
                    <CaretUpDown className="size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] rounded-xl p-0"
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="Buscar nicho..." className="h-10" />
                    <CommandList className="max-h-[200px]">
                      <CommandEmpty>Nenhum nicho encontrado.</CommandEmpty>
                      <CommandGroup>
                        {sortedNiches.map(([key, { label, emoji }]) => (
                          <CommandItem
                            key={key}
                            value={label}
                            onSelect={() => {
                              setSelectedNiche(key as AccountNiche)
                              setAddNicheOpen(false)
                            }}
                            className="cursor-pointer"
                          >
                            <span className="flex flex-1 items-center gap-2.5">
                              <span className="text-sm">{emoji}</span>
                              <span className="text-sm font-medium">
                                {label}
                              </span>
                            </span>
                            {selectedNiche === key && (
                              <Check
                                className="text-brand-cyan not-dark:text-primary size-4 shrink-0"
                                weight="bold"
                              />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Link do Perfil — apenas Facebook */}
            {selectedPlatform === "FACEBOOK" && (
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="add-facebook-url"
                  className="text-sm font-semibold"
                >
                  Link do Perfil
                </Label>
                <div className="relative">
                  <LinkSimple className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
                  <Input
                    id="add-facebook-url"
                    placeholder="https://www.facebook.com/seu_perfil/reels"
                    value={facebookProfileUrl}
                    onChange={(event) =>
                      setFacebookProfileUrl(event.target.value)
                    }
                    className="h-11 rounded-xl pl-10"
                    disabled={addAccountMutation.isPending}
                  />
                </div>
                <p className="text-muted-foreground text-[10px]">
                  Ex: facebook.com/seu_perfil/reels ou
                  profile.php?id=123&sk=owner_reels
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-border/60 flex shrink-0 gap-2.5 border-t p-4">
            <Button
              variant="outline"
              className="h-11 flex-1 cursor-pointer rounded-xl font-semibold"
              onClick={() => {
                setIsAddDialogOpen(false)
                resetAddForm()
              }}
              disabled={addAccountMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              className="btn-gradient-auth h-11 flex-1 cursor-pointer rounded-xl font-semibold"
              onClick={handleAddAccount}
              disabled={
                !selectedPlatform ||
                !username ||
                !selectedNiche ||
                addAccountMutation.isPending
              }
            >
              {addAccountMutation.isPending ? (
                <>
                  <CircleNotch className="size-4 animate-spin" />
                  Adicionando...
                </>
              ) : (
                <>
                  <Plus className="size-4" weight="bold" />
                  Adicionar
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Confirmação: desconectar integração ===== */}
      <AlertDialog
        open={disconnectTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isDisconnecting) setDisconnectTarget(null)
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Warning className="text-destructive size-5" weight="fill" />
              Desconectar integração
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desconectar{" "}
              <strong className="break-all">{disconnectTarget?.username}</strong>
              {disconnectTarget
                ? ` do ${platformConfig[disconnectTarget.platform].label}?`
                : "?"}{" "}
              A conta continua cadastrada, mas as métricas deixam de ser
              sincronizadas automaticamente até você conectar de novo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDisconnecting}
              className="cursor-pointer rounded-xl"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                confirmDisconnect()
              }}
              disabled={isDisconnecting}
              className="bg-destructive hover:bg-destructive/90 cursor-pointer rounded-xl text-white"
            >
              {isDisconnecting ? (
                <>
                  <CircleNotch className="size-4 animate-spin motion-reduce:animate-none" />
                  Desconectando...
                </>
              ) : (
                <>
                  <LinkBreak className="size-4" />
                  Desconectar
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
