"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useUser } from "@clerk/nextjs"
import {
  ArrowRight,
  ArrowUpRight,
  ArrowsDownUp,
  CalendarBlank,
  CaretUpDown,
  ChatCircle,
  Check,
  CheckCircle,
  CircleNotch,
  Clock,
  Coins,
  Crown,
  DiscordLogo,
  Eye,
  Heart,
  Info,
  Lightning,
  LinkSimple,
  Lock,
  Medal,
  Notebook,
  PaperPlaneTilt,
  Play,
  Plus,
  Pulse,
  ShareNetwork,
  Sparkle,
  Target,
  Timer,
  Trophy,
  UserPlus,
  UsersThree,
  Wallet,
  Warning,
  X,
} from "@phosphor-icons/react"
import { motion } from "framer-motion"
import { toast } from "sonner"

import { ClipfyProPricingDialog } from "@/components/clippers/clipfy-pro-pricing-dialog"
import { ClanTagBadge } from "@/components/clan-tag-badge"
import { ClipperHeroViz, ClipperHeroVizSkeleton } from "@/components/home/clipper-hero-viz"
import { HomeHero } from "@/components/home/home-hero"
import { StatTile } from "@/components/home/stat-tile"
import { CountUp, formatCompact } from "@/components/shared/count-up"
import { Reveal } from "@/components/shared/reveal"
import {
  Bone,
  CardGridSkeleton,
  HeroSkeleton,
  ListRowsSkeleton,
  StatTilesGridSkeleton,
  ToolbarSkeleton,
} from "@/components/shared/skeletons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { useMaskedCurrency } from "@/contexts/financial-visibility-context"
import { formatPrizeLabel } from "@/lib/currency"
import { parsePrizeTable } from "@/lib/daily-ranking-preview"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"
import { api, type RouterInputs, type RouterOutputs } from "@/trpc/react"

// Discord invite URL
const DISCORD_INVITE_URL = "https://discord.gg/f2eNVbYnzn"

type ScheduledCompetition = RouterOutputs["campaign"]["getScheduled"][number]
type NextCompetition = NonNullable<
  RouterOutputs["clipper"]["getNextAvailableCompetition"]
>
type EnrollableCompetition = ScheduledCompetition | NextCompetition
type AddSocialAccountInput = RouterInputs["clipper"]["addSocialAccount"]

const nicheConfig: Record<string, { label: string; emoji: string }> = {
  MOTIVATIONAL: { label: "Motivacional", emoji: "💪" }, GOSSIP: { label: "Fofoca", emoji: "🗣️" }, MEME: { label: "Meme", emoji: "😂" }, ENTREPRENEURSHIP: { label: "Empreendedorismo", emoji: "🚀" }, HUMOR: { label: "Humor", emoji: "🤣" }, GAMING: { label: "Gaming", emoji: "🎮" }, SPORTS: { label: "Esportes", emoji: "⚽" }, MUSIC: { label: "Música", emoji: "🎵" }, EDUCATION: { label: "Educação", emoji: "📚" }, NEWS: { label: "Notícias", emoji: "📰" }, POLITICS: { label: "Política", emoji: "🏛️" }, LIFESTYLE: { label: "Lifestyle", emoji: "✨" }, FITNESS: { label: "Fitness", emoji: "🏋️" }, FASHION: { label: "Moda", emoji: "👗" }, BEAUTY: { label: "Beleza", emoji: "💄" }, FOOD: { label: "Comida", emoji: "🍕" }, TRAVEL: { label: "Viagem", emoji: "✈️" }, TECH: { label: "Tecnologia", emoji: "💻" }, FINANCE: { label: "Finanças", emoji: "💰" }, RELIGION: { label: "Religião", emoji: "🙏" }, ENTERTAINMENT: { label: "Entretenimento", emoji: "🎬" }, HOT: { label: "Hot", emoji: "🔥" }, FAMILY: { label: "Família", emoji: "👨‍👩‍👧‍👦" }, MATERNITY: { label: "Maternidade", emoji: "🤱" }, PATERNITY: { label: "Paternidade", emoji: "👨‍👧" }, MARRIAGE: { label: "Casamento", emoji: "💍" }, BODYBUILDING: { label: "Maromba", emoji: "💪🏋️" }, WOMEN: { label: "Mulher", emoji: "👩" }, MEN: { label: "Homem", emoji: "👨" }, COUPLE: { label: "Casal", emoji: "💑" }, PETS: { label: "Pets", emoji: "🐾" }, CARS: { label: "Carros", emoji: "🚗" }, MOTORCYCLES: { label: "Motos", emoji: "🏍️" }, ANIME: { label: "Anime", emoji: "🎌" }, KPOP: { label: "K-Pop", emoji: "🇰🇷" }, DANCE: { label: "Dança", emoji: "💃" }, COMEDY: { label: "Comédia", emoji: "😆" }, DRAMA: { label: "Drama", emoji: "🎭" }, ASTROLOGY: { label: "Astrologia", emoji: "♈" }, PSYCHOLOGY: { label: "Psicologia", emoji: "🧠" }, SELF_HELP: { label: "Autoajuda", emoji: "📖" }, PRODUCTIVITY: { label: "Produtividade", emoji: "⏱️" }, MARKETING: { label: "Marketing", emoji: "📢" }, SALES: { label: "Vendas", emoji: "🛒" }, REAL_ESTATE: { label: "Imobiliário", emoji: "🏠" }, CRYPTO: { label: "Cripto", emoji: "₿" }, INVESTING: { label: "Investimentos", emoji: "📈" }, DIY: { label: "Faça Você Mesmo", emoji: "🔨" }, ART: { label: "Arte", emoji: "🎨" }, PHOTOGRAPHY: { label: "Fotografia", emoji: "📷" }, CINEMA: { label: "Cinema", emoji: "🎥" }, SERIES: { label: "Séries", emoji: "📺" }, BOOKS: { label: "Livros", emoji: "📚" }, PODCAST: { label: "Podcast", emoji: "🎙️" }, ASMR: { label: "ASMR", emoji: "🎧" }, NATURE: { label: "Natureza", emoji: "🌿" }, SUSTAINABILITY: { label: "Sustentabilidade", emoji: "♻️" }, HEALTH: { label: "Saúde", emoji: "🏥" }, MENTAL_HEALTH: { label: "Saúde Mental", emoji: "🧘" }, NUTRITION: { label: "Nutrição", emoji: "🥗" }, VEGAN: { label: "Vegano", emoji: "🌱" }, WINE: { label: "Vinho", emoji: "🍷" }, COFFEE: { label: "Café", emoji: "☕" }, BEER: { label: "Cerveja", emoji: "🍺" }, COOKING: { label: "Culinária", emoji: "👨‍🍳" }, CONFECTIONERY: { label: "Confeitaria", emoji: "🎂" }, DECORATION: { label: "Decoração", emoji: "🏡" }, ARCHITECTURE: { label: "Arquitetura", emoji: "🏗️" }, GARDEN: { label: "Jardinagem", emoji: "🌻" }, CLEANING: { label: "Limpeza", emoji: "🧹" }, ORGANIZATION: { label: "Organização", emoji: "📦" }, PARENTING: { label: "Parentalidade", emoji: "👪" }, BABY: { label: "Bebê", emoji: "👶" }, KIDS: { label: "Crianças", emoji: "🧒" }, TEENS: { label: "Adolescentes", emoji: "🧑" }, SCHOOL: { label: "Escola", emoji: "🏫" }, UNIVERSITY: { label: "Universidade", emoji: "🎓" }, LANGUAGES: { label: "Idiomas", emoji: "🌍" }, LAW: { label: "Direito", emoji: "⚖️" }, MEDICINE: { label: "Medicina", emoji: "🩺" }, ENGINEERING: { label: "Engenharia", emoji: "⚙️" }, SCIENCE: { label: "Ciência", emoji: "🔬" }, HISTORY: { label: "História", emoji: "🏛️" }, PHILOSOPHY: { label: "Filosofia", emoji: "💭" }, SOCIOLOGY: { label: "Sociologia", emoji: "👥" }, ECONOMY: { label: "Economia", emoji: "📊" }, MILITARY: { label: "Militar", emoji: "🎖️" }, POLICE: { label: "Policial", emoji: "🚔" }, FIREFIGHTER: { label: "Bombeiro", emoji: "🚒" }, TRUCKER: { label: "Caminhoneiro", emoji: "🚛" }, RURAL: { label: "Rural", emoji: "🌾" }, AGRIBUSINESS: { label: "Agronegócio", emoji: "🚜" }, FISHING: { label: "Pesca", emoji: "🎣" }, HUNTING: { label: "Caça", emoji: "🦌" }, SURF: { label: "Surf", emoji: "🏄" }, SKATE: { label: "Skate", emoji: "🛹" }, CROSSFIT: { label: "CrossFit", emoji: "🏋️‍♂️" }, YOGA: { label: "Yoga", emoji: "🧘‍♀️" }, PILATES: { label: "Pilates", emoji: "🤸" }, RUNNING: { label: "Corrida", emoji: "🏃" }, CYCLING: { label: "Ciclismo", emoji: "🚴" }, SWIMMING: { label: "Natação", emoji: "🏊" }, MARTIAL_ARTS: { label: "Artes Marciais", emoji: "🥋" }, BOXING: { label: "Boxe", emoji: "🥊" }, SOCCER: { label: "Futebol", emoji: "⚽" }, BASKETBALL: { label: "Basquete", emoji: "🏀" }, VOLLEYBALL: { label: "Vôlei", emoji: "🏐" }, TENNIS: { label: "Tênis", emoji: "🎾" }, GOLF: { label: "Golfe", emoji: "⛳" }, ESPORTS: { label: "E-Sports", emoji: "🕹️" }, STREAMER: { label: "Streamer", emoji: "📡" }, COSPLAY: { label: "Cosplay", emoji: "🎭" }, TATTOO: { label: "Tatuagem", emoji: "💉" }, PIERCING: { label: "Piercing", emoji: "💎" }, NAILS: { label: "Unhas", emoji: "💅" }, HAIR: { label: "Cabelo", emoji: "💇" }, SKINCARE: { label: "Skincare", emoji: "🧴" }, MAKEUP: { label: "Maquiagem", emoji: "💄" }, PLUS_SIZE: { label: "Plus Size", emoji: "👗" }, LUXURY: { label: "Luxo", emoji: "👑" }, MINIMALISM: { label: "Minimalismo", emoji: "🪴" }, VINTAGE: { label: "Vintage", emoji: "📻" }, STREETWEAR: { label: "Streetwear", emoji: "🧢" }, SNEAKERS: { label: "Sneakers", emoji: "👟" }, JEWELRY: { label: "Joias", emoji: "💎" }, WATCHES: { label: "Relógios", emoji: "⌚" }, HANDBAGS: { label: "Bolsas", emoji: "👜" }, WEDDING: { label: "Casamentos", emoji: "👰" }, PARTY: { label: "Festas", emoji: "🎉" }, EVENTS: { label: "Eventos", emoji: "🎪" }, CARNIVAL: { label: "Carnaval", emoji: "🎊" }, FUNK: { label: "Funk", emoji: "🎶" }, SERTANEJO: { label: "Sertanejo", emoji: "🤠" }, RAP: { label: "Rap", emoji: "🎤" }, ROCK: { label: "Rock", emoji: "🎸" }, POP: { label: "Pop", emoji: "🌟" }, ELECTRONIC: { label: "Eletrônica", emoji: "🎛️" }, GOSPEL: { label: "Gospel", emoji: "✝️" }, PAGODE: { label: "Pagode", emoji: "🪘" }, FORRO: { label: "Forró", emoji: "🪗" }, MPB: { label: "MPB", emoji: "🇧🇷" }, REGGAE: { label: "Reggae", emoji: "🟢" }, JAZZ: { label: "Jazz", emoji: "🎷" }, CLASSICAL: { label: "Clássica", emoji: "🎻" }, COUNTRY: { label: "Country", emoji: "🤠" }, TRAP: { label: "Trap", emoji: "🔊" }, LGBTQ: { label: "LGBTQ+", emoji: "🏳️‍🌈" }, DIVERSITY: { label: "Diversidade", emoji: "🌈" }, FEMINISM: { label: "Feminismo", emoji: "♀️" }, ACTIVISM: { label: "Ativismo", emoji: "✊" }, CHARITY: { label: "Caridade", emoji: "❤️" }, VOLUNTEERING: { label: "Voluntariado", emoji: "🤝" }, SPIRITUAL: { label: "Espiritualidade", emoji: "🕊️" }, MEDITATION: { label: "Meditação", emoji: "🧘" }, TAROT: { label: "Tarot", emoji: "🃏" }, NUMEROLOGY: { label: "Numerologia", emoji: "🔢" }, CONSPIRACY: { label: "Conspiração", emoji: "👁️" }, TRUE_CRIME: { label: "True Crime", emoji: "🔍" }, HORROR: { label: "Terror", emoji: "👻" }, PARANORMAL: { label: "Paranormal", emoji: "👽" }, RIDDLES: { label: "Enigmas", emoji: "🧩" }, TRIVIA: { label: "Curiosidades", emoji: "❓" }, CHALLENGES: { label: "Desafios", emoji: "🏆" }, PRANKS: { label: "Pegadinhas", emoji: "😜" }, REACTIONS: { label: "Reações", emoji: "😱" }, UNBOXING: { label: "Unboxing", emoji: "📦" }, REVIEWS: { label: "Reviews", emoji: "⭐" }, TUTORIALS: { label: "Tutoriais", emoji: "📝" }, TIPS: { label: "Dicas", emoji: "💡" }, HACKS: { label: "Hacks", emoji: "🛠️" }, STORYTIME: { label: "Storytime", emoji: "📖" }, CONFESSIONS: { label: "Confissões", emoji: "🤫" }, RELATIONSHIPS: { label: "Relacionamentos", emoji: "❤️‍🔥" }, DATING: { label: "Paquera", emoji: "💘" }, BREAKUP: { label: "Términos", emoji: "💔" }, FRIENDSHIP: { label: "Amizade", emoji: "🤗" }, BULLYING: { label: "Bullying", emoji: "🚫" }, MENTAL_WELLNESS: { label: "Bem-estar", emoji: "🌸" }, THERAPY: { label: "Terapia", emoji: "🛋️" }, ADHD: { label: "TDAH", emoji: "⚡" }, AUTISM: { label: "Autismo", emoji: "🧩" }, DISABILITY: { label: "Deficiência", emoji: "♿" }, ACCESSIBILITY: { label: "Acessibilidade", emoji: "🦽" }, SIGN_LANGUAGE: { label: "Libras", emoji: "🤟" }, IMMIGRATION: { label: "Imigração", emoji: "🌍" }, EXPAT: { label: "Expatriado", emoji: "🧳" }, NOMAD: { label: "Nômade Digital", emoji: "🏝️" }, BACKPACKING: { label: "Mochilão", emoji: "🎒" }, CAMPING: { label: "Camping", emoji: "⛺" }, HIKING: { label: "Trilha", emoji: "🥾" }, BEACH: { label: "Praia", emoji: "🏖️" }, MOUNTAIN: { label: "Montanha", emoji: "🏔️" }, FARM: { label: "Fazenda", emoji: "🐄" }, CITY: { label: "Cidade", emoji: "🏙️" }, INTERIOR: { label: "Interior", emoji: "🌄" }, FAVELA: { label: "Favela", emoji: "🏘️" }, PERIFERIAS: { label: "Periferia", emoji: "🏚️" }, NORDESTE: { label: "Nordeste", emoji: "☀️" }, AMAZONIA: { label: "Amazônia", emoji: "🌳" }, OTHER: { label: "Outro", emoji: "📌" },
}

const sortedNiches = Object.entries(nicheConfig).sort((a, b) =>
  a[1].label.localeCompare(b[1].label, "pt-BR"),
)

/* ============================================================
   Helpers
   ============================================================ */

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })

const formatDateShort = (dateString: string) =>
  new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  })

const getDaysUntilStart = (startDate: string) => {
  const diffTime = new Date(startDate).getTime() - Date.now()
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
}

const parsePrize = (prize: unknown): number => {
  if (typeof prize === "string")
    return (
      parseFloat(prize.replace(/[^\d.,]/g, "").replace(",", ".")) || 0
    )
  return typeof prize === "number" ? prize : 0
}

/* ============================================================
   Countdown ao vivo (d/h/m/s) — portado do original
   ============================================================ */

function CountdownTimer({ startDate }: { startDate: string }) {
  const calcTimeLeft = React.useCallback(() => {
    const diff = new Date(startDate).getTime() - Date.now()
    if (diff <= 0) return null
    return {
      d: Math.floor(diff / (1000 * 60 * 60 * 24)),
      h: Math.floor((diff / (1000 * 60 * 60)) % 24),
      m: Math.floor((diff / (1000 * 60)) % 60),
      s: Math.floor((diff / 1000) % 60),
    }
  }, [startDate])

  const [timeLeft, setTimeLeft] = React.useState(calcTimeLeft)

  React.useEffect(() => {
    const interval = setInterval(() => setTimeLeft(calcTimeLeft()), 1000)
    return () => clearInterval(interval)
  }, [calcTimeLeft])

  if (!timeLeft) return null

  const units = [
    { label: "d", value: timeLeft.d },
    { label: "h", value: timeLeft.h },
    { label: "m", value: timeLeft.m },
    { label: "s", value: timeLeft.s },
  ]

  return (
    <div className="relative flex h-[22px] items-center gap-[3px] overflow-hidden rounded-full px-2.5 py-0.5">
      <div className="absolute inset-0 rounded-full border border-[var(--brand-cyan)]/25 bg-gradient-to-r from-[#0d1117] via-[#111827] to-[#0d1117] shadow-[0_0_12px_rgba(20,247,255,0.15),inset_0_1px_1px_rgba(255,255,255,0.05)]" />
      <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.04] to-transparent" />
      <Timer
        className="relative size-3 shrink-0 animate-pulse text-[var(--brand-cyan)] drop-shadow-[0_0_4px_rgba(20,247,255,0.6)]"
        weight="fill"
      />
      {units.map((u, i) => (
        <span
          key={u.label}
          className="relative text-[11px] leading-none font-black tracking-tight tabular-nums"
        >
          <span className="bg-gradient-to-b from-[var(--brand-cyan)] via-[var(--brand-mint)] to-[var(--brand-green)] bg-clip-text text-transparent drop-shadow-[0_0_6px_rgba(20,247,255,0.4)]">
            {String(u.value).padStart(2, "0")}
          </span>
          <span className="text-[9px] font-semibold text-white/40">
            {u.label}
          </span>
          {i < units.length - 1 && (
            <span className="mx-[1px] text-[var(--brand-cyan)]/30">:</span>
          )}
        </span>
      ))}
    </div>
  )
}

/* ============================================================
   Página
   ============================================================ */

export default function HomeClipper() {
  const { user } = useUser()
  const { maskBRL, maskText } = useMaskedCurrency()

  const [isMounted, setIsMounted] = React.useState(false)

  // Dialogs de competição
  const [selectedCompetition, setSelectedCompetition] =
    React.useState<EnrollableCompetition | null>(null)
  const [isEnrollDialogOpen, setIsEnrollDialogOpen] = React.useState(false)
  const [isAddAccountDialogOpen, setIsAddAccountDialogOpen] =
    React.useState(false)
  const [selectedAccounts, setSelectedAccounts] = React.useState<string[]>([])
  const [newAccountPlatform, setNewAccountPlatform] = React.useState("")
  const [newAccountUsername, setNewAccountUsername] = React.useState("")
  const [newAccountNiche, setNewAccountNiche] = React.useState("")
  const [newAccountNicheOpen, setNewAccountNicheOpen] = React.useState(false)
  const [newAccountFacebookUrl, setNewAccountFacebookUrl] = React.useState("")
  const [isPrizesDialogOpen, setIsPrizesDialogOpen] = React.useState(false)
  const [selectedPrizeCompetitionId, setSelectedPrizeCompetitionId] =
    React.useState<string | null>(null)
  const [isHowToParticipateDialogOpen, setIsHowToParticipateDialogOpen] =
    React.useState(false)
  const [isProDialogOpen, setIsProDialogOpen] = React.useState(false)
  const [isRankingDialogOpen, setIsRankingDialogOpen] = React.useState(false)

  // Select de competição das estatísticas
  const [selectedClipperCompId, setSelectedClipperCompId] = React.useState<
    string | null
  >(null)

  // Filtro & ordenação das competições disponíveis
  const [competitionFilter, setCompetitionFilter] = React.useState<
    "all" | "participating" | "started" | "private"
  >("all")
  const [competitionSort, setCompetitionSort] = React.useState<
    "prize_desc" | "prize_asc" | "newest" | "oldest" | "ending_soon"
  >("newest")

  // ===== Queries =====
  const { data: stats, isLoading: isLoadingStats } =
    api.clipper.getDashboardStats.useQuery()
  const { data: competitions, isLoading: isLoadingCompetitions } =
    api.clipper.getMyCompetitions.useQuery()
  const { data: userData } = api.user.getCurrentUser.useQuery()

  const clipperProfileId = userData?.clipperProfile?.id

  const { data: wallet } = api.clipper.getWallet.useQuery(
    { clipperProfileId: clipperProfileId ?? "" },
    { enabled: !!clipperProfileId },
  )

  const { data: nextCompetition, isLoading: isLoadingNextCompetition } =
    api.clipper.getNextAvailableCompetition.useQuery()

  const {
    data: scheduledCompetitions = [],
    isLoading: isLoadingScheduled,
    refetch: refetchCompetitions,
  } = api.campaign.getScheduled.useQuery()

  const { data: myApplications = [], refetch: refetchApplications } =
    api.clipper.getMyApplications.useQuery()

  const { data: socialAccounts = [], refetch: refetchSocialAccounts } =
    api.clipper.getMySocialAccounts.useQuery()

  const { data: rankingData, isLoading: isLoadingRanking } =
    api.clipper.getTopClippersRanking.useQuery(undefined, {
      enabled: isRankingDialogOpen,
    })

  const { data: prizesData, isLoading: isLoadingPrizes } =
    api.campaign.getCampaignPrizes.useQuery(
      { campaignId: selectedPrizeCompetitionId ?? "" },
      { enabled: !!selectedPrizeCompetitionId && isPrizesDialogOpen },
    )

  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  // ===== Mutations =====
  const enrollMutation = api.campaign.enrollInCompetition.useMutation({
    onSuccess: (data) => {
      toast.success(data.message, {
        description: `Você se inscreveu com ${selectedAccounts.length} conta(s).`,
      })
      setIsEnrollDialogOpen(false)
      setSelectedAccounts([])
      void refetchCompetitions()
      void refetchApplications()
    },
    onError: (error) => {
      toast.error("Erro ao inscrever", {
        description: error.message,
      })
    },
  })

  const addAccountMutation = api.clipper.addSocialAccount.useMutation({
    onSuccess: () => {
      toast.success("Conta adicionada!", {
        description: "A conta foi adicionada ao seu perfil.",
      })
      setIsAddAccountDialogOpen(false)
      setNewAccountPlatform("")
      setNewAccountUsername("")
      setNewAccountNiche("")
      setNewAccountFacebookUrl("")
      void refetchSocialAccounts()
    },
    onError: (error) => {
      toast.error("Erro ao adicionar conta", {
        description: error.message,
      })
    },
  })

  // ===== Derivados =====
  const isProSubscriber = userData?.subscriptionStatus === "ACTIVE"
  const availableBalance = wallet?.balance ?? 0

  const isProLocked = (competition: { isProOnly: boolean } | null) =>
    !!competition?.isProOnly && !isProSubscriber

  const getApplicationStatus = (campaignId: string) =>
    myApplications.find((app) => app.campaignId === campaignId)

  // ===== Handlers =====
  const openEnrollDialog = (competition: EnrollableCompetition) => {
    // Competição exclusiva PRO sem assinatura ativa → abre o dialog do PRO
    if (competition.isProOnly && !isProSubscriber) {
      setIsProDialogOpen(true)
      return
    }
    setSelectedCompetition(competition)
    setSelectedAccounts([])
    setIsEnrollDialogOpen(true)
  }

  const openPrizesDialog = (competition: ScheduledCompetition) => {
    setSelectedCompetition(competition)
    setSelectedPrizeCompetitionId(competition.id)
    setIsPrizesDialogOpen(true)
  }

  const toggleAccountSelection = (accountId: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId],
    )
  }

  const handleEnroll = () => {
    if (selectedAccounts.length === 0) {
      toast.error("Selecione ao menos uma conta para se inscrever")
      return
    }
    if (!selectedCompetition) return

    enrollMutation.mutate({
      campaignId: selectedCompetition.id,
      socialAccountIds: selectedAccounts,
    })
  }

  const handleAddAccount = () => {
    if (!newAccountPlatform || !newAccountUsername) {
      toast.error("Preencha todos os campos")
      return
    }

    if (!newAccountNiche) {
      toast.error("Selecione o nicho da conta")
      return
    }

    const isFacebook = newAccountPlatform === "FACEBOOK"

    if (isFacebook) {
      if (!newAccountFacebookUrl.trim()) {
        toast.error("Link do perfil obrigatório", {
          description:
            "Para Facebook, você deve informar o link completo do perfil com /reels no final",
        })
        return
      }

      if (
        !newAccountFacebookUrl.startsWith("http://") &&
        !newAccountFacebookUrl.startsWith("https://")
      ) {
        toast.error("Link incompleto", {
          description:
            "O link deve começar com https:// (ex: https://www.facebook.com/seu_perfil/reels)",
        })
        return
      }

      const isFacebookLink =
        newAccountFacebookUrl.includes("facebook.com") ||
        newAccountFacebookUrl.includes("fb.com")

      if (!isFacebookLink) {
        toast.error("Link inválido", {
          description:
            "Para Facebook, você deve inserir o link completo do perfil (ex: https://www.facebook.com/seu_perfil/reels)",
        })
        return
      }

      const hasReelsPath =
        newAccountFacebookUrl.endsWith("/reels") ||
        newAccountFacebookUrl.endsWith("/reels/")
      const hasProfileReels =
        newAccountFacebookUrl.includes("profile.php?id=") &&
        (newAccountFacebookUrl.includes("&sk=owner_reels") ||
          newAccountFacebookUrl.includes("&sk=reels_tab"))

      if (!hasReelsPath && !hasProfileReels) {
        toast.error("Formato incorreto", {
          description:
            "Use: /seu_perfil/reels OU profile.php?id=123&sk=owner_reels OU profile.php?id=123&sk=reels_tab",
        })
        return
      }
    }

    addAccountMutation.mutate({
      platform: newAccountPlatform as AddSocialAccountInput["platform"],
      username: newAccountUsername,
      niche: newAccountNiche as AddSocialAccountInput["niche"],
      profileUrl: isFacebook ? newAccountFacebookUrl : undefined,
    })
  }

  // ===== Competições disponíveis: filtro + ordenação =====
  const sortedCompetitions = React.useMemo(() => {
    let filtered = [...scheduledCompetitions]

    if (competitionFilter === "participating") {
      filtered = filtered.filter((c) =>
        myApplications.some((app) => app.campaignId === c.id),
      )
    } else if (competitionFilter === "started") {
      filtered = filtered.filter((c) => getDaysUntilStart(c.startDate) <= 0)
    } else if (competitionFilter === "private") {
      filtered = filtered.filter((c) => c.isPrivate || c.isProOnly)
    }

    filtered.sort((a, b) => {
      switch (competitionSort) {
        case "prize_desc":
          return parsePrize(b.prize) - parsePrize(a.prize)
        case "prize_asc":
          return parsePrize(a.prize) - parsePrize(b.prize)
        case "newest":
          return (
            new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
          )
        case "oldest":
          return (
            new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
          )
        case "ending_soon":
          // Correção: encerrando logo = endDate mais próximo primeiro
          return new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
        default:
          return parsePrize(b.prize) - parsePrize(a.prize)
      }
    })

    return filtered
  }, [scheduledCompetitions, competitionFilter, competitionSort, myApplications])

  // Contadores por aba de filtro (Todas / Participando / Em andamento / Privadas)
  const filterCounts = React.useMemo(
    () => ({
      all: scheduledCompetitions.length,
      participating: scheduledCompetitions.filter((c) =>
        myApplications.some((app) => app.campaignId === c.id),
      ).length,
      started: scheduledCompetitions.filter(
        (c) => getDaysUntilStart(c.startDate) <= 0,
      ).length,
      private: scheduledCompetitions.filter((c) => c.isPrivate || c.isProOnly)
        .length,
    }),
    [scheduledCompetitions, myApplications],
  )

  // ===== Select de competição ativa =====
  const displayCompetitions = React.useMemo(
    () => competitions ?? [],
    [competitions],
  )

  React.useEffect(() => {
    if (!selectedClipperCompId && displayCompetitions.length > 0) {
      setSelectedClipperCompId(
        displayCompetitions.length > 1
          ? "__all__"
          : displayCompetitions[0]!.id,
      )
    }
  }, [displayCompetitions, selectedClipperCompId])

  const selectedClipperComp =
    selectedClipperCompId && selectedClipperCompId !== "__all__"
      ? displayCompetitions.find((c) => c.id === selectedClipperCompId)
      : undefined

  const activeClipperComps =
    selectedClipperCompId === "__all__"
      ? displayCompetitions
      : selectedClipperComp
        ? [selectedClipperComp]
        : displayCompetitions

  const compTotalViews = activeClipperComps.reduce(
    (sum, c) => sum + c.myViews,
    0,
  )
  // ===== Stats com fallback (growth do backend é 0 — usamos hints de texto) =====
  const displayStats = stats ?? {
    activeCompetitions: 0,
    totalViews: 0,
    totalEarned: 0,
    averageRanking: 0,
    viewsGrowth: 0,
    competitionsGrowth: 0,
    earningsGrowth: 0,
    rankingChange: 0,
  }

  const rankingClippers = (rankingData?.clippers ?? []).filter(
    (clipper): clipper is NonNullable<typeof clipper> => clipper != null,
  )

  // ===== Premiação (dialog) =====
  const prizeRule = prizesData?.rankingRule
  const monthlyEntries = React.useMemo(
    () => parsePrizeTable(prizeRule?.monthlyPrizeTable),
    [prizeRule?.monthlyPrizeTable],
  )
  const dailyEntries = React.useMemo(
    () => parsePrizeTable(prizeRule?.dailyPrizeTable),
    [prizeRule?.dailyPrizeTable],
  )
  const totalPrizePool =
    (prizeRule?.monthlyEnabled ? (prizeRule?.monthlyTotalPrize ?? 0) : 0) +
    (prizeRule?.dailyEnabled ? (prizeRule?.dailyTotalPrize ?? 0) * 30 : 0)

  // ===== Contas compatíveis para a inscrição =====
  const compatibleAccounts = selectedCompetition
    ? socialAccounts.filter(
        (account) =>
          account.isActive &&
          (selectedCompetition.platforms as string[]).includes(
            account.platform,
          ) &&
          !selectedAccounts.includes(account.id),
      )
    : []

  /* ============================================================
     Skeleton do kit espelhando TODA a página
     ============================================================ */
  if (!isMounted || isLoadingStats || isLoadingCompetitions) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
        <HeroSkeleton stats={3} viz={<ClipperHeroVizSkeleton />} />
        <ToolbarSkeleton buttons={3} />
        {/* Banner fantasma da próxima competição */}
        <div className="glass-card flex items-center gap-4 rounded-3xl p-4">
          <Bone className="size-16 shrink-0 rounded-2xl sm:size-20" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Bone delay={80} className="h-4 w-40 rounded-full" />
            <Bone delay={160} className="h-5 w-3/5 max-w-72" />
            <Bone delay={240} className="h-3.5 w-2/5 max-w-48 rounded-full" />
          </div>
          <Bone delay={320} className="hidden size-10 rounded-full sm:block" />
        </div>
        <StatTilesGridSkeleton count={4} />
        <CardGridSkeleton
          count={3}
          aspectClass="aspect-square"
          gridClass="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          withStats={false}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== 1. Hero ===== */}
      <HomeHero
        eyebrow="Clipfy League · Clipador"
        title={
          <>
            Participe das principais{" "}
            <span className="text-gradient">competições de corte</span>
          </>
        }
        subtitle="Inscreva-se, poste seus cortes e ganhe prêmios em dinheiro a cada ranking."
        viz={<ClipperHeroViz />}
        vizSkeleton={<ClipperHeroVizSkeleton />}
        isLoading={isLoadingStats}
        stats={[
          {
            icon: <Eye className="size-3.5" weight="fill" />,
            label: "Views totais",
            value: displayStats.totalViews,
            kind: "compact",
          },
          {
            icon: <Wallet className="size-3.5" weight="fill" />,
            label: "Total ganho",
            value: displayStats.totalEarned,
            kind: "compactBRL",
          },
          {
            icon: <Trophy className="size-3.5" weight="fill" />,
            label: "Competições ativas",
            value: displayStats.activeCompetitions,
            kind: "int",
          },
        ]}
      />

      {/* ===== 2. Toolbar: ações + select de competição ===== */}
      <Reveal immediate>
        <div className="glass-card flex flex-col gap-3 rounded-3xl p-3.5 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              className="h-10 flex-1 cursor-pointer rounded-xl font-semibold sm:flex-none"
              onClick={() => setIsHowToParticipateDialogOpen(true)}
            >
              <Sparkle
                className="text-brand-cyan not-dark:text-primary size-4"
                weight="fill"
              />
              <span className="hidden sm:inline">Como Participar</span>
              <span className="sm:hidden">Ajuda</span>
            </Button>
            <div className="relative flex-1 sm:flex-none">
              <Button
                className="btn-gradient-auth h-10 w-full cursor-pointer rounded-xl font-semibold"
                onClick={() => setIsRankingDialogOpen(true)}
              >
                <Crown className="size-4" weight="fill" />
                <span className="hidden sm:inline">Ranking Clipadores</span>
                <span className="sm:hidden">Ranking</span>
              </Button>
              <span className="pointer-events-none absolute -top-2.5 -right-2 flex items-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-amber-500 opacity-40" />
                <span className="relative rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-2 py-[3px] text-[9px] font-black tracking-widest text-black uppercase shadow-[0_0_14px_rgba(234,179,8,0.7)]">
                  Novo
                </span>
              </span>
            </div>
          </div>

          {displayCompetitions.length > 0 && (
            <Select
              value={selectedClipperCompId ?? undefined}
              onValueChange={(value) => setSelectedClipperCompId(value)}
            >
              <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl lg:w-[320px]">
                <SelectValue placeholder="Selecione a competição" />
              </SelectTrigger>
              <SelectContent className="rounded-xl" align="start">
                {displayCompetitions.length > 1 && (
                  <SelectItem value="__all__" className="cursor-pointer">
                    <span className="flex items-center gap-2.5">
                      <Trophy
                        className="text-brand-cyan not-dark:text-primary size-4 shrink-0"
                        weight="fill"
                      />
                      <span className="font-medium">Todas as competições</span>
                      <Badge
                        variant="outline"
                        className="border-brand-cyan/30 text-brand-cyan bg-brand-cyan/10 not-dark:border-primary/30 not-dark:text-primary not-dark:bg-primary/10 h-4 shrink-0 rounded-full px-1.5 text-[10px]"
                      >
                        {displayCompetitions.length}
                      </Badge>
                    </span>
                  </SelectItem>
                )}
                {displayCompetitions.map((comp) => (
                  <SelectItem
                    key={comp.id}
                    value={comp.id}
                    className="cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <Pulse
                        className="size-4 shrink-0 text-emerald-500"
                        weight="bold"
                      />
                      <span className="truncate">{comp.name}</span>
                      <Badge
                        variant="outline"
                        className="h-4 shrink-0 rounded-full border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-600 dark:text-emerald-400"
                      >
                        {comp.status === "ACTIVE" ? "Ativa" : "Agendada"}
                      </Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </Reveal>

      {/* ===== 3. Banner: Próxima Competição ===== */}
      {isLoadingNextCompetition ? (
        <Reveal immediate delayMs={90}>
          <div className="flex items-center justify-center gap-3 rounded-3xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
            <CircleNotch className="size-4 animate-spin text-amber-500" />
            <p className="text-xs font-medium text-amber-600 dark:text-amber-300">
              Buscando competições disponíveis...
            </p>
          </div>
        </Reveal>
      ) : nextCompetition ? (
        <Reveal immediate delayMs={90}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => openEnrollDialog(nextCompetition)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                openEnrollDialog(nextCompetition)
              }
            }}
            className="group relative cursor-pointer overflow-hidden rounded-3xl border-2 border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-orange-500/15 backdrop-blur-sm transition-all duration-300 hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/15"
          >
            {/* Brilho varrendo (shine da marca) */}
            <span
              aria-hidden
              className="arena-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            />

            <div className="relative px-3 py-3 sm:px-4 sm:py-3.5">
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
                {/* Capa */}
                {nextCompetition.coverImageUrl ? (
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border-2 border-amber-500/30 transition-colors group-hover:border-amber-500/50 sm:size-20">
                    <Image
                      src={nextCompetition.coverImageUrl}
                      alt={nextCompetition.name}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  </div>
                ) : (
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-xl border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/20 to-orange-500/20 sm:size-20">
                    <Trophy
                      className="size-8 text-amber-500 sm:size-10"
                      weight="fill"
                    />
                  </div>
                )}

                {/* Conteúdo */}
                <div className="w-full min-w-0 flex-1 sm:w-auto">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <Badge className="animate-pulse gap-1 rounded-full border-amber-500/50 bg-amber-500/30 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                      <Sparkle className="size-3" weight="fill" />
                      NOVA
                    </Badge>
                    {nextCompetition.isProOnly && (
                      <Badge className="gap-1 rounded-full border-amber-400/50 bg-gradient-to-r from-amber-400 to-yellow-500 px-2 py-0.5 text-xs font-black text-[#3b2a00]">
                        <Crown className="size-3" weight="fill" />
                        PRO
                      </Badge>
                    )}
                    {nextCompetition.daysUntilStart > 0 && (
                      <Badge className="gap-1 rounded-full border-orange-500/50 bg-orange-500/25 px-2 py-0.5 text-xs font-bold text-orange-700 dark:text-orange-300">
                        <CalendarBlank className="size-3" weight="fill" />
                        {nextCompetition.daysUntilStart === 1
                          ? "Começa amanhã!"
                          : `Faltam ${nextCompetition.daysUntilStart} dias`}
                      </Badge>
                    )}
                  </div>

                  <h4 className="mb-2 line-clamp-1 text-base leading-tight font-bold sm:text-lg">
                    {nextCompetition.name}
                  </h4>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/15 px-2 py-1">
                      <Trophy
                        className="size-3.5 shrink-0 text-amber-500"
                        weight="fill"
                      />
                      <span
                        className={cn(
                          "text-xs font-black text-amber-700 sm:text-sm dark:text-amber-200",
                          isProLocked(nextCompetition) &&
                            "blur-sm select-none",
                        )}
                      >
                        {maskText(formatPrizeLabel(nextCompetition.prize))}
                      </span>
                    </span>

                    {nextCompetition.totalApplications > 0 && (
                      <span className="flex items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/15 px-2 py-1">
                        <UsersThree
                          className="size-3.5 shrink-0 text-orange-500"
                          weight="fill"
                        />
                        <span className="text-xs font-bold text-orange-700 sm:text-sm dark:text-orange-200">
                          {nextCompetition.totalApplications}
                        </span>
                      </span>
                    )}

                    <span className="flex flex-wrap items-center gap-1.5">
                      {nextCompetition.platforms.map((platform) => {
                        const config = platformConfig[platform as PlatformKey]
                        if (!config) return null
                        const PlatformIcon = config.icon
                        return (
                          <span
                            key={platform}
                            className="bg-card/50 flex size-7 items-center justify-center rounded-md border border-amber-500/20 transition-colors group-hover:border-amber-500/40 sm:size-8"
                          >
                            <PlatformIcon
                              className={cn("size-4", config.color)}
                            />
                          </span>
                        )
                      })}
                    </span>
                  </div>
                </div>

                {/* Seta (desktop) */}
                <span className="hidden size-10 shrink-0 items-center justify-center rounded-full border-2 border-amber-500/30 bg-amber-500/20 transition-all group-hover:border-amber-500/50 group-hover:bg-amber-500/30 sm:flex">
                  <ArrowRight
                    className="size-5 text-amber-600 transition-transform group-hover:translate-x-0.5 dark:text-amber-300"
                    weight="bold"
                  />
                </span>

                {/* CTA (mobile) */}
                <div className="mt-1 w-full sm:hidden">
                  <Button className="h-10 w-full cursor-pointer rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-sm font-bold text-black shadow-lg shadow-amber-500/30 hover:from-amber-600 hover:to-amber-500">
                    <UserPlus className="size-4" weight="fill" />
                    Inscrever-se Agora
                    <ArrowRight className="size-4" weight="bold" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      ) : null}

      {/* ===== 4. StatTiles ===== */}
      <Reveal immediate delayMs={120}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<Eye className="size-4" weight="fill" />}
            label="Total de Views"
            value={
              displayCompetitions.length > 0
                ? compTotalViews
                : displayStats.totalViews
            }
            kind="compact"
            hint={
              displayCompetitions.length > 0
                ? selectedClipperCompId === "__all__"
                  ? `${displayCompetitions.length} competições somadas`
                  : (selectedClipperComp?.name ?? "Visualizações totais")
                : "Visualizações totais"
            }
            accent="cyan"
            gradientValue
          />
          <StatTile
            icon={<Wallet className="size-4" weight="fill" />}
            label="Total Ganho"
            value={displayStats.totalEarned}
            kind="brl"
            hint="Ganhos acumulados"
            accent="gradient"
          />
          <StatTile
            icon={<Trophy className="size-4" weight="fill" />}
            label="Competições Ativas"
            value={displayStats.activeCompetitions}
            kind="int"
            hint="Participando agora"
            accent="cyan"
          />

          {/* Carteira: card inteiro leva ao /financial (fluxo do original) */}
          <Link
            href="/financial"
            aria-label="Abrir carteira"
            className="glass-card glass-card-hover group relative flex flex-col gap-3 rounded-2xl p-4 sm:p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
                Carteira
              </span>
              <span className="bg-[var(--brand-green)] not-dark:bg-[#0eb981] not-dark:text-white flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A] transition-transform duration-300 group-hover:scale-110">
                <Wallet className="size-4" weight="fill" />
              </span>
            </div>
            <CountUp
              value={availableBalance}
              kind="brl"
              className="text-2xl font-bold tracking-tight tabular-nums sm:text-[1.7rem]"
            />
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">Saldo disponível</span>
              <ArrowUpRight className="text-muted-foreground/60 group-hover:text-brand-cyan not-dark:group-hover:text-primary size-3.5 transition-colors" />
            </div>
          </Link>
        </div>
      </Reveal>

      {/* ===== 5. Competições Disponíveis ===== */}
      <div className="flex flex-col gap-4 sm:gap-5">
        {/* Header + ordenação */}
        <Reveal immediate>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="bg-gradient-custom flex size-10 shrink-0 items-center justify-center rounded-xl text-[#04222A] shadow-lg">
                  <Trophy className="size-5" weight="fill" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-bold tracking-tight">
                    Competições Disponíveis
                  </h2>
                  <p className="text-muted-foreground hidden text-sm sm:block">
                    Encontre e participe das melhores competições
                  </p>
                </div>
              </div>

              <Select
                value={competitionSort}
                onValueChange={(value) =>
                  setCompetitionSort(value as typeof competitionSort)
                }
              >
                <SelectTrigger className="h-9 w-[195px] shrink-0 cursor-pointer rounded-xl text-xs sm:h-10 sm:w-[230px] sm:text-sm">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <ArrowsDownUp className="text-muted-foreground size-3.5 shrink-0" />
                    <span className="truncate">
                      <SelectValue placeholder="Ordenar" />
                    </span>
                  </span>
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem
                    value="prize_desc"
                    className="cursor-pointer text-xs sm:text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <Trophy
                        className="size-3.5 text-amber-500"
                        weight="fill"
                      />
                      Maior premiação
                    </span>
                  </SelectItem>
                  <SelectItem
                    value="prize_asc"
                    className="cursor-pointer text-xs sm:text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <Trophy className="text-muted-foreground size-3.5" />
                      Menor premiação
                    </span>
                  </SelectItem>
                  <SelectItem
                    value="newest"
                    className="cursor-pointer text-xs sm:text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <CalendarBlank
                        className="size-3.5 text-sky-500"
                        weight="fill"
                      />
                      Mais recente
                    </span>
                  </SelectItem>
                  <SelectItem
                    value="oldest"
                    className="cursor-pointer text-xs sm:text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <CalendarBlank className="text-muted-foreground size-3.5" />
                      Mais antiga
                    </span>
                  </SelectItem>
                  <SelectItem
                    value="ending_soon"
                    className="cursor-pointer text-xs sm:text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <Clock className="size-3.5 text-red-500" weight="fill" />
                      Encerrando logo
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tabs de filtro — indicador deslizante + contadores por aba */}
            <div className="border-border/40 bg-muted/40 grid w-full grid-cols-4 gap-1 rounded-2xl border p-1 backdrop-blur-sm">
              {(
                [
                  {
                    value: "all",
                    label: "Todas",
                    mobileLabel: "Todas",
                    icon: Trophy,
                  },
                  {
                    value: "participating",
                    label: "Participando",
                    mobileLabel: "Minhas",
                    icon: CheckCircle,
                  },
                  {
                    value: "started",
                    label: "Em andamento",
                    mobileLabel: "Ativas",
                    icon: Play,
                  },
                  {
                    value: "private",
                    label: "Privadas",
                    mobileLabel: "PRO",
                    icon: Lock,
                  },
                ] as const
              ).map(({ value, label, mobileLabel, icon: TabIcon }) => {
                const isActive = competitionFilter === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCompetitionFilter(value)}
                    className={cn(
                      "relative flex min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors duration-300 sm:gap-2 sm:px-3 sm:text-sm",
                      isActive
                        ? "text-[#04222A]"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/70",
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="competition-filter-pill"
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 40,
                        }}
                        className="bg-gradient-custom shadow-brand-cyan/25 absolute inset-0 rounded-xl shadow-lg"
                      />
                    )}
                    <TabIcon
                      className="relative z-10 size-3.5 shrink-0"
                      weight="fill"
                    />
                    <span className="relative z-10 hidden truncate sm:inline">
                      {label}
                    </span>
                    <span className="relative z-10 truncate sm:hidden">
                      {mobileLabel}
                    </span>
                    <span
                      className={cn(
                        "relative z-10 hidden min-w-5 shrink-0 rounded-full px-1.5 py-px text-center text-[10px] font-bold tabular-nums min-[420px]:inline-block",
                        isActive
                          ? "bg-[#04222A]/15 text-[#04222A]"
                          : "bg-muted-foreground/15 text-muted-foreground",
                      )}
                    >
                      {filterCounts[value]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </Reveal>

        {/* Grid de cards */}
        {isLoadingScheduled ? (
          <CardGridSkeleton
            count={3}
            aspectClass="aspect-square"
            gridClass="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            withStats={false}
          />
        ) : sortedCompetitions.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedCompetitions.map((competition, index) => {
              const daysUntil = getDaysUntilStart(competition.startDate)
              const application = getApplicationStatus(competition.id)
              const locked = isProLocked(competition)

              return (
                <Reveal
                  immediate
                  key={competition.id}
                  delayMs={(index % 3) * 80}
                >
                  <article className="glass-card glass-card-hover group flex h-full flex-col overflow-hidden rounded-3xl">
                    {/* Capa 1:1 */}
                    <div className="relative aspect-square w-full overflow-hidden">
                      {competition.coverImageUrl ? (
                        <Image
                          src={competition.coverImageUrl}
                          alt={competition.name}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="dashboard-galaxy dark flex h-full w-full items-center justify-center">
                          <Trophy
                            className="size-20 text-[color-mix(in_oklab,var(--brand-cyan)_30%,transparent)]"
                            weight="fill"
                          />
                        </div>
                      )}

                      {/* Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/25" />

                      {/* Badges topo */}
                      <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "gap-1.5 rounded-full backdrop-blur-md",
                            daysUntil <= 0
                              ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-500 dark:text-emerald-400"
                              : competition.registrationOpen
                                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-500 dark:text-emerald-400"
                                : "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400",
                          )}
                        >
                          <span
                            className={cn(
                              "size-1.5 animate-pulse rounded-full",
                              daysUntil <= 0
                                ? "bg-green-400"
                                : competition.registrationOpen
                                  ? "bg-emerald-400"
                                  : "bg-amber-400",
                            )}
                          />
                          {daysUntil <= 0
                            ? "Em Andamento"
                            : competition.registrationOpen
                              ? "Inscrições Abertas"
                              : "Em Breve"}
                        </Badge>

                        {/* Pilha direita: PRO / inscrição / countdown */}
                        <div className="flex flex-col items-end gap-1.5">
                          {competition.isProOnly && (
                            <Badge className="gap-1 rounded-full border-amber-400/50 bg-gradient-to-r from-amber-400 to-yellow-500 px-2 py-0.5 text-xs font-black text-[#3b2a00] shadow-lg shadow-amber-500/30">
                              <Crown className="size-3" weight="fill" />
                              PRO
                            </Badge>
                          )}

                          {application && !competition.isProOnly && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "gap-1.5 rounded-full backdrop-blur-md",
                                application.status === "APPROVED"
                                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-500 dark:text-emerald-400"
                                  : application.status === "PENDING" ||
                                      application.status === "UNDER_REVIEW"
                                    ? "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                    : "border-red-500/30 bg-red-500/15 text-red-500 dark:text-red-400",
                              )}
                            >
                              <span
                                className={cn(
                                  "size-1.5 animate-pulse rounded-full",
                                  application.status === "APPROVED"
                                    ? "bg-emerald-400"
                                    : application.status === "PENDING" ||
                                        application.status === "UNDER_REVIEW"
                                      ? "bg-amber-400"
                                      : "bg-red-400",
                                )}
                              />
                              {application.status === "APPROVED"
                                ? "Inscrito"
                                : application.status === "PENDING" ||
                                    application.status === "UNDER_REVIEW"
                                  ? "Aguardando"
                                  : "Rejeitado"}
                            </Badge>
                          )}

                          {daysUntil > 0 && competition.registrationOpen && (
                            <CountdownTimer
                              startDate={competition.startDate}
                            />
                          )}
                        </div>
                      </div>

                      {/* Plataformas sobre a capa */}
                      <div className="absolute bottom-3 left-3 flex items-center gap-1">
                        {competition.platforms.slice(0, 5).map((platform) => {
                          const config =
                            platformConfig[platform as PlatformKey]
                          if (!config) return null
                          const PlatformIcon = config.icon
                          return (
                            <span
                              key={platform}
                              className="flex size-6.5 items-center justify-center rounded-lg bg-black/55 backdrop-blur-sm"
                            >
                              <PlatformIcon
                                className={cn("size-3.5", config.color)}
                              />
                            </span>
                          )
                        })}
                      </div>

                      {/* Métrica de ranking sobre a capa */}
                      <div className="absolute right-3 bottom-3">
                        {competition.rankingMetricType ===
                        "VIEWS_X_ENGAGEMENT" ? (
                          <span
                            className="relative flex items-center gap-1 overflow-hidden rounded-lg px-2 py-1 backdrop-blur-md"
                            style={{
                              background:
                                "linear-gradient(135deg, rgba(168,85,247,0.3) 0%, rgba(236,72,153,0.3) 50%, rgba(249,115,22,0.3) 100%)",
                            }}
                          >
                            {/* Borda gradiente */}
                            <span
                              aria-hidden
                              className="absolute inset-0 rounded-lg"
                              style={{
                                background:
                                  "linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #f97316 100%)",
                                mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                                WebkitMask:
                                  "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                                maskComposite: "exclude",
                                WebkitMaskComposite: "xor",
                                padding: "1px",
                              }}
                            />
                            <Pulse
                              className="relative z-10 size-3 text-pink-300"
                              weight="bold"
                            />
                            <span className="relative z-10 bg-gradient-to-r from-purple-300 via-pink-300 to-orange-300 bg-clip-text text-[10px] font-bold text-transparent">
                              V×E
                            </span>
                          </span>
                        ) : (
                          <span className="flex h-6.5 items-center gap-1 rounded-lg bg-black/55 px-2 backdrop-blur-sm">
                            <Eye
                              className="size-3 text-cyan-300"
                              weight="fill"
                            />
                            <span className="text-[10px] font-bold text-cyan-200">
                              Views
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Corpo */}
                    <div className="flex flex-1 flex-col gap-3.5 p-4 sm:p-5">
                      <div className="min-w-0">
                        <h3 className="truncate text-[15px] font-bold tracking-tight sm:text-base">
                          {competition.name}
                        </h3>
                        {competition.description && (
                          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed sm:text-[13px]">
                            {competition.description}
                          </p>
                        )}
                      </div>

                      {/* Período */}
                      <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                        <CalendarBlank className="size-3.5" />
                        {formatDateShort(competition.startDate)} –{" "}
                        {formatDateShort(competition.endDate)}
                      </p>

                      {/* Premiação */}
                      <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                          <Sparkle className="size-3.5" weight="fill" />
                          Premiação
                        </span>
                        <span
                          className={cn(
                            "truncate text-sm font-bold text-amber-600 tabular-nums dark:text-amber-400",
                            locked && "blur-sm select-none",
                          )}
                        >
                          {maskText(
                            formatPrizeLabel(String(competition.prize)),
                          )}
                        </span>
                      </div>

                      {/* CTAs */}
                      <div className="mt-auto flex flex-col gap-1.5 pt-1 sm:gap-2 sm:pt-2">
                        {application?.status === "APPROVED" ? (
                          <Button
                            asChild
                            variant="outline"
                            className="h-9 w-full cursor-pointer rounded-xl text-xs font-semibold sm:h-10 sm:text-sm"
                          >
                            <Link
                              href={`/my-competitions/${competition.slug}`}
                            >
                              <Eye className="size-4" />
                              Ver Competição
                            </Link>
                          </Button>
                        ) : application?.status === "PENDING" ||
                          application?.status === "UNDER_REVIEW" ? (
                          <Button
                            variant="outline"
                            disabled
                            className="h-9 w-full rounded-xl text-xs font-semibold sm:h-10 sm:text-sm"
                          >
                            <Clock className="size-4 animate-pulse" weight="fill" />
                            Aguardando Aprovação
                          </Button>
                        ) : application?.status === "REJECTED" ? (
                          <Button
                            variant="outline"
                            disabled
                            className="h-9 w-full rounded-xl text-xs font-semibold sm:h-10 sm:text-sm"
                          >
                            <X className="size-4" weight="bold" />
                            Inscrição Rejeitada
                          </Button>
                        ) : (
                          <Button
                            className="btn-gradient-auth h-9 w-full cursor-pointer rounded-xl text-xs font-semibold sm:h-10 sm:text-sm"
                            onClick={() => openEnrollDialog(competition)}
                          >
                            <Lightning className="size-4" weight="fill" />
                            Inscrever-se Agora
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          onClick={() => openPrizesDialog(competition)}
                          className="h-9 w-full cursor-pointer rounded-xl border-amber-500/30 text-xs font-semibold text-amber-600 hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-600 sm:h-10 sm:text-sm dark:text-amber-400 dark:hover:text-amber-400"
                        >
                          <Trophy className="size-4" weight="fill" />
                          Ver Prêmios
                        </Button>
                      </div>
                    </div>
                  </article>
                </Reveal>
              )
            })}
          </div>
        ) : (
          <Reveal immediate>
            <div className="glass-card flex flex-col items-center gap-4 rounded-3xl py-16 text-center">
              <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
                {competitionFilter !== "all" ? (
                  <ArrowsDownUp className="size-6" weight="bold" />
                ) : (
                  <Trophy className="size-6" weight="fill" />
                )}
              </span>
              <div className="px-4">
                <p className="text-base font-bold">
                  {competitionFilter === "participating"
                    ? "Você ainda não participa de nenhuma competição"
                    : competitionFilter === "started"
                      ? "Nenhuma competição em andamento"
                      : competitionFilter === "private"
                        ? "Nenhuma competição privada disponível"
                        : "Nenhuma competição disponível"}
                </p>
                <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
                  {competitionFilter !== "all"
                    ? "Tente mudar o filtro para encontrar outras competições."
                    : "Novas competições serão anunciadas em breve. Fique atento!"}
                </p>
              </div>
              {competitionFilter !== "all" ? (
                <Button
                  variant="outline"
                  className="cursor-pointer rounded-xl font-semibold"
                  onClick={() => setCompetitionFilter("all")}
                >
                  <Trophy className="size-4" weight="fill" />
                  Ver todas competições
                </Button>
              ) : (
                <Button
                  asChild
                  variant="outline"
                  className="cursor-pointer rounded-xl font-semibold"
                >
                  <Link href="/my-competitions/schedule">
                    <Sparkle className="size-4" weight="fill" />
                    Ver Cronograma
                  </Link>
                </Button>
              )}
            </div>
          </Reveal>
        )}
      </div>

      {/* ===== Dialog: Inscrever-se ===== */}
      <Dialog open={isEnrollDialogOpen} onOpenChange={setIsEnrollDialogOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-2xl">
          {selectedCompetition && (
            <>
              {/* Header com gradiente da marca */}
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
                    <Lightning className="size-4.5" weight="fill" />
                  </span>
                  Inscrever-se na Competição
                </DialogTitle>
                <DialogDescription className="relative truncate">
                  {selectedCompetition.name}
                </DialogDescription>
              </DialogHeader>

              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-5">
                {/* Info da competição */}
                <div className="border-brand-cyan/25 bg-brand-cyan/5 not-dark:border-primary/25 not-dark:bg-primary/5 flex items-center gap-3 rounded-2xl border p-3.5">
                  {selectedCompetition.coverImageUrl ? (
                    <div className="border-border/60 relative size-12 shrink-0 overflow-hidden rounded-xl border">
                      <Image
                        src={selectedCompetition.coverImageUrl}
                        alt={selectedCompetition.name}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    </div>
                  ) : (
                    <span className="bg-gradient-custom flex size-9 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
                      <Trophy className="size-4.5" weight="fill" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold sm:text-base">
                      {selectedCompetition.name}
                    </p>
                    <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                      <CalendarBlank className="size-3 shrink-0" />
                      {formatDate(selectedCompetition.startDate)} →{" "}
                      {formatDate(selectedCompetition.endDate)}
                    </p>
                  </div>
                </div>

                {/* Plataformas aceitas */}
                <div className="flex flex-col gap-2">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase">
                    <Sparkle
                      className="text-brand-cyan not-dark:text-primary size-3"
                      weight="fill"
                    />
                    Plataformas aceitas
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCompetition.platforms.map((platform) => {
                      const config = platformConfig[platform as PlatformKey]
                      if (!config) return null
                      const PlatformIcon = config.icon
                      return (
                        <Badge
                          key={platform}
                          variant="outline"
                          className={cn(
                            "gap-1 rounded-full",
                            config.borderColor,
                            config.bgColor,
                            config.color,
                          )}
                        >
                          <PlatformIcon className="size-3" />
                          {config.label}
                        </Badge>
                      )
                    })}
                  </div>
                </div>

                <div className="bg-border/60 h-px" />

                {/* STEP 1: contas existentes */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="bg-brand-cyan/15 text-brand-cyan not-dark:bg-primary/10 not-dark:text-primary flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                      1
                    </span>
                    <div>
                      <p className="text-sm font-bold">
                        Selecionar contas existentes
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Escolha as contas que vai usar nesta competição
                      </p>
                    </div>
                  </div>

                  <Select
                    value=""
                    onValueChange={(value) => {
                      if (
                        value !== "none" &&
                        !selectedAccounts.includes(value)
                      ) {
                        toggleAccountSelection(value)
                      }
                    }}
                  >
                    <SelectTrigger className="border-brand-cyan/30 bg-brand-cyan/5 hover:bg-brand-cyan/10 not-dark:border-primary/30 not-dark:bg-primary/5 h-11 w-full cursor-pointer rounded-xl transition-colors">
                      <SelectValue placeholder="Toque para escolher uma conta" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {compatibleAccounts.map((account) => {
                        const config =
                          platformConfig[account.platform as PlatformKey]
                        const PlatformIcon = config.icon
                        return (
                          <SelectItem key={account.id} value={account.id}>
                            <span className="flex items-center gap-2.5">
                              <span
                                className={cn(
                                  "flex size-6 items-center justify-center rounded-lg border",
                                  config.bgColor,
                                  config.borderColor,
                                )}
                              >
                                <PlatformIcon
                                  className={cn("size-3.5", config.color)}
                                />
                              </span>
                              <span className="text-sm font-semibold">
                                {account.username}
                              </span>
                            </span>
                          </SelectItem>
                        )
                      })}
                      {compatibleAccounts.length === 0 && (
                        <SelectItem value="none" disabled>
                          Nenhuma conta compatível disponível
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Contas selecionadas */}
                {selectedAccounts.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle className="size-4" weight="fill" />
                      Contas que valerão pontos ({selectedAccounts.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedAccounts.map((accountId) => {
                        const account = socialAccounts.find(
                          (item) => item.id === accountId,
                        )
                        if (!account) return null
                        const config =
                          platformConfig[account.platform as PlatformKey]
                        const PlatformIcon = config.icon
                        return (
                          <span
                            key={account.id}
                            className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 py-1 pr-1 pl-2 transition-colors hover:bg-emerald-500/15"
                          >
                            <span
                              className={cn(
                                "flex size-5 items-center justify-center rounded-md border",
                                config.bgColor,
                                config.borderColor,
                              )}
                            >
                              <PlatformIcon
                                className={cn("size-3", config.color)}
                              />
                            </span>
                            <span className="text-xs font-bold">
                              {account.username}
                            </span>
                            <button
                              type="button"
                              aria-label={`Remover ${account.username}`}
                              onClick={() =>
                                toggleAccountSelection(account.id)
                              }
                              className="hover:bg-destructive/15 cursor-pointer rounded-full p-1 transition-colors"
                            >
                              <X className="text-destructive/70 hover:text-destructive size-3" />
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="bg-border/60 h-px" />

                {/* STEP 2: nova conta */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-xs font-bold text-violet-500 dark:text-violet-400">
                      2
                    </span>
                    <div>
                      <p className="text-sm font-bold">
                        Não encontrou sua conta?
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Cadastre uma nova conta ao seu perfil
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setIsAddAccountDialogOpen(true)}
                    className="h-11 w-full cursor-pointer rounded-xl border-2 border-dashed border-violet-500/30 font-semibold text-violet-500 hover:border-violet-500/50 hover:bg-violet-500/5 hover:text-violet-500 dark:text-violet-400 dark:hover:text-violet-400"
                  >
                    <Plus className="size-4" weight="bold" />
                    Cadastrar Nova Conta
                  </Button>
                </div>

                {/* Aviso */}
                <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3.5">
                  <div className="flex gap-2.5">
                    <Warning
                      className="mt-0.5 size-4 shrink-0 text-amber-500"
                      weight="fill"
                    />
                    <div className="min-w-0 space-y-1 text-xs">
                      <p className="font-bold text-amber-600 dark:text-amber-400">
                        Atenção!
                      </p>
                      <p className="text-muted-foreground">
                        • Somente as contas selecionadas acima serão{" "}
                        <strong className="text-foreground">válidas</strong>
                      </p>
                      <p className="text-muted-foreground">
                        • Posts de outras contas{" "}
                        <strong className="text-foreground">
                          não valerão pontos
                        </strong>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-border/60 flex shrink-0 gap-2.5 border-t p-4">
                <Button
                  variant="outline"
                  className="h-11 flex-1 cursor-pointer rounded-xl font-semibold"
                  onClick={() => setIsEnrollDialogOpen(false)}
                  disabled={enrollMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  className="btn-gradient-auth h-11 flex-1 cursor-pointer rounded-xl font-semibold"
                  onClick={handleEnroll}
                  disabled={
                    selectedAccounts.length === 0 || enrollMutation.isPending
                  }
                >
                  {enrollMutation.isPending ? (
                    <>
                      <CircleNotch className="size-4 animate-spin" />
                      Inscrevendo...
                    </>
                  ) : (
                    <>
                      <Lightning className="size-4" weight="fill" />
                      Confirmar ({selectedAccounts.length})
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== Dialog: Cadastrar Nova Conta ===== */}
      <Dialog
        open={isAddAccountDialogOpen}
        onOpenChange={setIsAddAccountDialogOpen}
      >
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-md">
          <DialogHeader className="border-border/60 relative shrink-0 overflow-hidden border-b p-4 text-left sm:p-6">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-16 -right-10 size-40 rounded-full bg-violet-500/10 blur-3xl"
            />
            <DialogTitle className="relative flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30">
                <Plus className="size-4.5" weight="bold" />
              </span>
              Cadastrar Nova Conta
            </DialogTitle>
            <DialogDescription className="relative">
              Adicione uma nova conta social ao seu perfil
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-5">
            {/* Plataforma */}
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="account-platform"
                className="text-sm font-semibold"
              >
                Plataforma
              </Label>
              <Select
                value={newAccountPlatform}
                onValueChange={setNewAccountPlatform}
              >
                <SelectTrigger
                  id="account-platform"
                  className="h-11 w-full cursor-pointer rounded-xl"
                >
                  <SelectValue placeholder="Selecione a plataforma" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {(Object.keys(platformConfig) as PlatformKey[]).map(
                    (platform) => {
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
                    },
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Username */}
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="account-username"
                className="text-sm font-semibold"
              >
                Nome de Usuário
              </Label>
              <div className="relative">
                <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm">
                  @
                </span>
                <Input
                  id="account-username"
                  placeholder="seu_usuario"
                  value={newAccountUsername}
                  onChange={(e) => {
                    const cleaned = e.target.value
                      .replace(/@/g, "")
                      .replace(/\s/g, "")
                    setNewAccountUsername(cleaned)
                  }}
                  className="h-11 rounded-xl pl-8"
                  disabled={addAccountMutation.isPending}
                />
              </div>
            </div>

            {/* Nicho */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-semibold">Nicho da Conta</Label>
              <Popover
                open={newAccountNicheOpen}
                onOpenChange={setNewAccountNicheOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={newAccountNicheOpen}
                    className="h-11 w-full cursor-pointer justify-between rounded-xl font-normal"
                  >
                    {newAccountNiche ? (
                      <span className="flex items-center gap-2">
                        <span>{nicheConfig[newAccountNiche]?.emoji}</span>
                        <span>{nicheConfig[newAccountNiche]?.label}</span>
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
                    <CommandInput
                      placeholder="Buscar nicho..."
                      className="h-10"
                    />
                    <CommandList className="max-h-[200px]">
                      <CommandEmpty>Nenhum nicho encontrado.</CommandEmpty>
                      <CommandGroup>
                        {sortedNiches.map(([key, { label, emoji }]) => (
                          <CommandItem
                            key={key}
                            value={label}
                            onSelect={() => {
                              setNewAccountNiche(key)
                              setNewAccountNicheOpen(false)
                            }}
                            className="cursor-pointer"
                          >
                            <span className="flex flex-1 items-center gap-2.5">
                              <span className="text-sm">{emoji}</span>
                              <span className="text-sm font-medium">
                                {label}
                              </span>
                            </span>
                            {newAccountNiche === key && (
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
            {newAccountPlatform === "FACEBOOK" && (
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="account-facebook-url"
                  className="text-sm font-semibold"
                >
                  Link do Perfil
                </Label>
                <Input
                  id="account-facebook-url"
                  placeholder="https://www.facebook.com/seu_perfil/reels"
                  value={newAccountFacebookUrl}
                  onChange={(e) => setNewAccountFacebookUrl(e.target.value)}
                  className="h-11 rounded-xl"
                  disabled={addAccountMutation.isPending}
                />
                <p className="text-muted-foreground text-xs">
                  Ex: https://www.facebook.com/seu_perfil/reels
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-sky-500/25 bg-sky-500/10 p-3">
              <div className="flex gap-2.5">
                <LinkSimple className="mt-0.5 size-4 shrink-0 text-sky-500" />
                <p className="text-muted-foreground text-xs">
                  Você poderá usar esta conta em competições futuras que
                  aceitem a plataforma selecionada
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-border/60 flex shrink-0 gap-2.5 border-t p-4">
            <Button
              variant="outline"
              className="h-11 flex-1 cursor-pointer rounded-xl font-semibold"
              onClick={() => {
                setIsAddAccountDialogOpen(false)
                setNewAccountPlatform("")
                setNewAccountUsername("")
                setNewAccountNiche("")
                setNewAccountFacebookUrl("")
              }}
              disabled={addAccountMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              className="h-11 flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 font-semibold text-white shadow-lg shadow-violet-500/20 hover:from-violet-600 hover:to-purple-700"
              onClick={handleAddAccount}
              disabled={
                !newAccountPlatform ||
                !newAccountUsername ||
                !newAccountNiche ||
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
                  Cadastrar Conta
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Dialog: Premiação ===== */}
      <Dialog open={isPrizesDialogOpen} onOpenChange={setIsPrizesDialogOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-4xl">
          <DialogHeader className="border-border/60 shrink-0 border-b p-4 text-left sm:p-6">
            <DialogTitle className="flex items-center gap-2.5">
              <span className="bg-gradient-custom flex size-9 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
                <Trophy className="size-4.5" weight="fill" />
              </span>
              Prêmios da Competição
            </DialogTitle>
            <DialogDescription className="truncate">
              {selectedCompetition?.name ?? "Regras completas de premiação"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
            {isLoadingPrizes ? (
              <>
                {/* Card do total de prêmios */}
                <div className="border-border/60 rounded-2xl border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Bone className="h-5 w-52 rounded-full" />
                    <Bone delay={100} className="h-7 w-28" />
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
                    <Bone delay={200} className="h-3 w-28 rounded-full" />
                    <Bone delay={280} className="h-3 w-36 rounded-full" />
                  </div>
                </div>

                {/* Pódio do ranking mensal */}
                <div className="border-border/60 bg-muted/20 flex flex-col gap-3 rounded-2xl border p-4">
                  <div className="flex items-center gap-2">
                    <Bone delay={120} className="size-7 rounded-lg" />
                    <Bone delay={200} className="h-4 w-36" />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <Bone
                        key={index}
                        delay={280 + index * 110}
                        className="h-24 rounded-2xl"
                      />
                    ))}
                  </div>
                </div>

                {/* Grid do ranking diário */}
                <div className="border-border/60 bg-muted/20 flex flex-col gap-3 rounded-2xl border p-4">
                  <div className="flex items-center gap-2">
                    <Bone delay={400} className="size-7 rounded-lg" />
                    <Bone delay={480} className="h-4 w-32" />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <Bone
                        key={index}
                        delay={560 + index * 70}
                        className="h-9"
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : !prizeRule ? (
              <div className="border-border/60 bg-muted/10 flex flex-col items-center gap-3 rounded-2xl border py-12 text-center">
                <span className="bg-gradient-custom flex size-12 items-center justify-center rounded-2xl text-[#04222A]">
                  <Trophy className="size-6" weight="fill" />
                </span>
                <div className="px-4">
                  <p className="text-sm font-bold">Premiação não definida</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    As regras de premiação desta competição ainda não foram
                    configuradas. Volte mais tarde para conferir os prêmios.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Total */}
                <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/15 to-orange-500/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-amber-600 dark:text-amber-400">
                      <Sparkle className="size-4" weight="fill" />
                      Total de Prêmios (estimado/mês)
                    </span>
                    <span
                      className={cn(
                        "text-xl font-bold text-amber-600 tabular-nums dark:text-amber-400",
                        isProLocked(selectedCompetition) &&
                          "blur-sm select-none",
                      )}
                    >
                      {maskBRL(totalPrizePool)}
                    </span>
                  </div>
                  <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {prizeRule.monthlyEnabled && (
                      <span
                        className={cn(
                          isProLocked(selectedCompetition) &&
                            "blur-sm select-none",
                        )}
                      >
                        Mensal: {maskBRL(prizeRule.monthlyTotalPrize ?? 0)}
                      </span>
                    )}
                    {prizeRule.dailyEnabled && (
                      <span
                        className={cn(
                          isProLocked(selectedCompetition) &&
                            "blur-sm select-none",
                        )}
                      >
                        Diário: {maskBRL(prizeRule.dailyTotalPrize ?? 0)} × 30
                        dias
                      </span>
                    )}
                    {prizeRule.bonusEnabled && (
                      <span
                        className={cn(
                          isProLocked(selectedCompetition) &&
                            "blur-sm select-none",
                        )}
                      >
                        Bônus por marco: {maskBRL(prizeRule.bonusAmount ?? 0)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Ranking Mensal — pódio + demais posições */}
                {prizeRule.monthlyEnabled && (
                  <SectionBlock
                    icon={<Trophy className="size-4" weight="fill" />}
                    title="Ranking Mensal"
                    subtitle={`Top ${prizeRule.monthlyTopCount ?? 0} do mês · ${maskBRL(prizeRule.monthlyTotalPrize ?? 0)} no total`}
                  >
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {monthlyEntries.slice(0, 3).map((entry, index) => (
                        <div
                          key={entry.position}
                          className={cn(
                            "flex flex-col items-center gap-1 rounded-2xl border p-3 text-center",
                            index === 0
                              ? "border-amber-500/40 bg-amber-500/10"
                              : index === 1
                                ? "border-zinc-400/40 bg-zinc-400/10"
                                : "border-orange-500/40 bg-orange-500/10",
                          )}
                        >
                          <Medal
                            className={cn(
                              "size-5",
                              index === 0
                                ? "text-amber-500"
                                : index === 1
                                  ? "text-zinc-400"
                                  : "text-orange-500",
                            )}
                            weight="fill"
                          />
                          <span className="text-muted-foreground text-xs font-semibold">
                            {entry.position}º lugar
                          </span>
                          <span
                            className={cn(
                              "text-base font-bold tabular-nums",
                              isProLocked(selectedCompetition) &&
                                "blur-sm select-none",
                            )}
                          >
                            {maskBRL(entry.prize)}
                          </span>
                        </div>
                      ))}
                    </div>
                    {monthlyEntries.length > 3 && (
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                        {monthlyEntries.slice(3).map((entry) => (
                          <div
                            key={entry.position}
                            className="bg-muted/30 flex items-center justify-between rounded-xl px-3 py-2 text-xs"
                          >
                            <span className="text-muted-foreground font-semibold">
                              {entry.position}º
                            </span>
                            <span
                              className={cn(
                                "font-bold tabular-nums",
                                isProLocked(selectedCompetition) &&
                                  "blur-sm select-none",
                              )}
                            >
                              {maskBRL(entry.prize)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </SectionBlock>
                )}

                {/* Ranking Diário */}
                {prizeRule.dailyEnabled && (
                  <SectionBlock
                    icon={<Coins className="size-4" weight="fill" />}
                    title="Ranking Diário"
                    subtitle={`Top ${prizeRule.dailyTopCount ?? 0} do dia • 20h às 20h do dia seguinte (BRT) · ${maskBRL(prizeRule.dailyTotalPrize ?? 0)}/dia`}
                  >
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                      {dailyEntries.map((entry) => (
                        <div
                          key={entry.position}
                          className="bg-muted/30 flex items-center justify-between rounded-xl px-3 py-2 text-xs"
                        >
                          <span className="text-muted-foreground font-semibold">
                            {entry.position}º
                          </span>
                          <span
                            className={cn(
                              "font-bold tabular-nums",
                              isProLocked(selectedCompetition) &&
                                "blur-sm select-none",
                            )}
                          >
                            {maskBRL(entry.prize)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </SectionBlock>
                )}

                {/* Bônus por marco */}
                {prizeRule.bonusEnabled && (
                  <SectionBlock
                    icon={<Target className="size-4" weight="fill" />}
                    title="Bônus por Marco de Views"
                    subtitle="Recompensa extra ao atingir a meta de views"
                  >
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <InfoTile
                        label="Meta de Views"
                        value={formatCompact(prizeRule.bonusMilestone ?? 0)}
                      />
                      <InfoTile
                        label="Valor do Bônus"
                        value={maskBRL(prizeRule.bonusAmount ?? 0)}
                        blurred={isProLocked(selectedCompetition)}
                      />
                      {prizeRule.bonusMonthlyBudgetCap != null && (
                        <InfoTile
                          label="Teto Mensal"
                          value={maskBRL(prizeRule.bonusMonthlyBudgetCap)}
                          blurred={isProLocked(selectedCompetition)}
                        />
                      )}
                    </div>
                  </SectionBlock>
                )}

                {/* Regras adicionais */}
                {prizeRule.notes && (
                  <SectionBlock
                    icon={<Notebook className="size-4" weight="fill" />}
                    title="Regras Adicionais"
                  >
                    <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
                      {prizeRule.notes}
                    </p>
                  </SectionBlock>
                )}

                {/* Plataformas elegíveis */}
                <SectionBlock
                  icon={<Crown className="size-4" weight="fill" />}
                  title="Plataformas Elegíveis"
                >
                  <div className="flex flex-wrap gap-1.5">
                    {(prizeRule.eligiblePlatforms?.length
                      ? prizeRule.eligiblePlatforms
                      : (selectedCompetition?.platforms ?? [])
                    ).map((platform) => {
                      const config = platformConfig[platform as PlatformKey]
                      if (!config) return null
                      const PlatformIcon = config.icon
                      return (
                        <Badge
                          key={platform}
                          variant="outline"
                          className={cn(
                            "gap-1 rounded-full",
                            config.borderColor,
                            config.bgColor,
                            config.color,
                          )}
                        >
                          <PlatformIcon className="size-3" />
                          {config.label}
                        </Badge>
                      )
                    })}
                  </div>
                </SectionBlock>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-border/60 flex shrink-0 flex-col items-center justify-between gap-3 border-t p-4 sm:flex-row">
            <span className="text-muted-foreground inline-flex items-center gap-2 text-xs">
              <CheckCircle
                className="size-3.5 shrink-0 text-emerald-500"
                weight="fill"
              />
              Prêmios pagos via PIX em até 5 dias úteis após a conclusão da
              competição
            </span>
            <Button
              variant="outline"
              size="sm"
              className="w-full cursor-pointer rounded-xl sm:w-auto"
              onClick={() => setIsPrizesDialogOpen(false)}
            >
              Entendi
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Dialog: Como Participar ===== */}
      <Dialog
        open={isHowToParticipateDialogOpen}
        onOpenChange={setIsHowToParticipateDialogOpen}
      >
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-lg">
          {/* Header com gradiente da marca */}
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
                <Sparkle className="size-4.5" weight="fill" />
              </span>
              Como Participar
            </DialogTitle>
            <DialogDescription className="relative">
              Siga os passos abaixo para começar
            </DialogDescription>
          </DialogHeader>

          {/* Passos */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
            {/* Passo 1 — Discord */}
            <div className="group relative overflow-hidden rounded-2xl border-2 border-[#5865F2]/30 bg-gradient-to-br from-[#5865F2]/10 via-[#5865F2]/5 to-transparent p-4 transition-all hover:border-[#5865F2]/50 hover:shadow-lg hover:shadow-[#5865F2]/10">
              <span
                aria-hidden
                className="pointer-events-none absolute -top-10 -right-10 size-20 rounded-full bg-[#5865F2]/10 blur-xl transition-transform duration-500 group-hover:scale-150"
              />
              <div className="relative flex items-start gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#5865F2] to-[#4752C4] shadow-lg shadow-[#5865F2]/30">
                  <span className="text-lg font-black text-white">1</span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center gap-2">
                    <h3 className="text-base font-bold sm:text-lg">
                      Entre no Discord
                    </h3>
                    <ChatCircle
                      className="size-4 text-[#5865F2]"
                      weight="fill"
                    />
                  </div>
                  <p className="text-muted-foreground mb-3 text-sm">
                    Acesse nossa comunidade oficial no Discord para ficar por
                    dentro das regras e novidades.
                  </p>
                  <Button
                    size="sm"
                    className="cursor-pointer rounded-xl bg-[#5865F2] font-semibold text-white shadow-md shadow-[#5865F2]/20 transition-all hover:scale-105 hover:bg-[#4752C4]"
                    onClick={() => window.open(DISCORD_INVITE_URL, "_blank")}
                  >
                    <DiscordLogo className="size-4" weight="fill" />
                    Entrar no Discord
                    <ArrowUpRight className="size-3.5" weight="bold" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Conector */}
            <div className="flex justify-center">
              <span className="h-4 w-0.5 rounded-full bg-gradient-to-b from-[#5865F2]/50 to-emerald-500/50" />
            </div>

            {/* Passo 2 — Inscrição */}
            <div className="group relative overflow-hidden rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-4 transition-all hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10">
              <span
                aria-hidden
                className="pointer-events-none absolute -top-10 -right-10 size-20 rounded-full bg-emerald-500/10 blur-xl transition-transform duration-500 group-hover:scale-150"
              />
              <div className="relative flex items-start gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/30">
                  <span className="text-lg font-black text-white">2</span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center gap-2">
                    <h3 className="text-base font-bold sm:text-lg">
                      Inscreva-se na Competição
                    </h3>
                    <UserPlus
                      className="size-4 text-emerald-500"
                      weight="fill"
                    />
                  </div>
                  <p className="text-muted-foreground mb-2 text-sm">
                    Escolha uma competição e aguarde a aprovação da sua
                    inscrição.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant="outline"
                      className="gap-1 rounded-full border-emerald-500/30 bg-emerald-500/10 font-medium text-emerald-600 dark:text-emerald-400"
                    >
                      <Plus className="size-3" weight="bold" />
                      Adicione mais contas
                    </Badge>
                    <Badge
                      variant="outline"
                      className="gap-1 rounded-full border-amber-500/30 bg-amber-500/10 font-medium text-amber-600 dark:text-amber-400"
                    >
                      <ChatCircle className="size-3" weight="fill" />
                      Ticket no Discord
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Conector */}
            <div className="flex justify-center">
              <span className="h-4 w-0.5 rounded-full bg-gradient-to-b from-emerald-500/50 to-amber-500/50" />
            </div>

            {/* Passo 3 — Submeta */}
            <div className="group relative overflow-hidden rounded-2xl border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent p-4 transition-all hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10">
              <span
                aria-hidden
                className="pointer-events-none absolute -top-10 -right-10 size-20 rounded-full bg-amber-500/10 blur-xl transition-transform duration-500 group-hover:scale-150"
              />
              <div className="relative flex items-start gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30">
                  <span className="text-lg font-black text-white">3</span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center gap-2">
                    <h3 className="text-base font-bold sm:text-lg">
                      Submeta seus Vídeos
                    </h3>
                    <PaperPlaneTilt
                      className="size-4 text-amber-500"
                      weight="fill"
                    />
                  </div>
                  <p className="text-muted-foreground mb-2 text-sm">
                    Após aprovado, envie os links dos vídeos postados seguindo
                    as regras do Discord oficial.
                  </p>
                  <Badge
                    variant="outline"
                    className="gap-1 rounded-full border-amber-500/30 bg-amber-500/10 text-xs font-medium text-amber-600 dark:text-amber-400"
                  >
                    <CheckCircle className="size-3" weight="fill" />
                    Siga as regras do Discord
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-border/60 flex shrink-0 flex-col items-center justify-between gap-3 border-t p-4 sm:flex-row sm:p-5">
            <span className="text-muted-foreground inline-flex items-center gap-2 text-xs">
              <Info
                className="text-brand-cyan not-dark:text-primary size-3.5 shrink-0"
                weight="fill"
              />
              Dúvidas? Abra um ticket no Discord
            </span>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 cursor-pointer rounded-xl sm:flex-none"
                onClick={() => setIsHowToParticipateDialogOpen(false)}
              >
                Fechar
              </Button>
              <Button
                asChild
                size="sm"
                className="btn-gradient-auth flex-1 cursor-pointer rounded-xl font-semibold sm:flex-none"
                onClick={() => setIsHowToParticipateDialogOpen(false)}
              >
                <Link href="/my-competitions/schedule">
                  <Trophy className="size-4" weight="fill" />
                  Ver Competições
                </Link>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Dialog: PRO Pricing ===== */}
      <ClipfyProPricingDialog
        open={isProDialogOpen}
        onOpenChange={setIsProDialogOpen}
        userEmail={user?.emailAddresses?.[0]?.emailAddress}
      />

      {/* ===== Dialog: Ranking de Clipadores ===== */}
      <Dialog open={isRankingDialogOpen} onOpenChange={setIsRankingDialogOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-2xl">
          {/* Header âmbar */}
          <DialogHeader className="border-border/60 relative shrink-0 overflow-hidden border-b p-4 text-left sm:p-6">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-amber-500/10 blur-3xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-14 -left-10 size-36 rounded-full bg-amber-500/5 blur-3xl"
            />
            <div className="relative flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-500/30">
                <Crown className="size-5" weight="fill" />
              </span>
              <div className="min-w-0 flex-1">
                <DialogTitle>Ranking de Clipadores</DialogTitle>
                <DialogDescription className="mt-0.5">
                  Top 10 por views nos últimos 30 dias
                </DialogDescription>
              </div>
              <Badge className="shrink-0 gap-1 rounded-full border-amber-500/30 bg-amber-500/15 text-[10px] font-bold text-amber-600 sm:text-xs dark:text-amber-400">
                <Clock className="size-3" weight="fill" />
                Últimos 30 dias
              </Badge>
            </div>
          </DialogHeader>

          {/* Conteúdo */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoadingRanking ? (
              <div className="flex flex-col gap-4 p-4 sm:p-5">
                {/* Pódio fantasma */}
                <div className="grid grid-cols-3 gap-2 pt-3 sm:gap-3">
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      className={cn(
                        "border-border/60 flex flex-col items-center gap-2 rounded-2xl border p-2.5 sm:p-4",
                        index === 1 && "-mt-2 sm:-mt-4",
                      )}
                    >
                      <Bone
                        delay={index * 100}
                        className="size-6 rounded-full"
                      />
                      <Bone
                        delay={index * 100 + 60}
                        className={cn(
                          "rounded-full",
                          index === 1 ? "size-14 sm:size-16" : "size-11 sm:size-14",
                        )}
                      />
                      <Bone delay={index * 100 + 120} className="h-3 w-3/4" />
                      <Bone
                        delay={index * 100 + 180}
                        className="h-5 w-12 rounded-full"
                      />
                    </div>
                  ))}
                </div>
                <ListRowsSkeleton rows={5} />
              </div>
            ) : rankingClippers.length > 0 ? (
              <div className="divide-border/40 divide-y">
                {/* Pódio (2º, 1º, 3º) */}
                <div className="p-3 pb-5 sm:p-5 sm:pb-6">
                  <div className="grid grid-cols-3 gap-2 pt-3 sm:gap-3">
                    {[1, 0, 2].map((index) => {
                      const clipper = rankingClippers[index]
                      if (!clipper) return <div key={index} />

                      const podiumStyles = {
                        1: {
                          card: "border-amber-500/50 shadow-[0_0_20px_rgba(234,179,8,0.15)] hover:shadow-[0_0_30px_rgba(234,179,8,0.25)]",
                          bg: "from-amber-500/20 via-amber-500/10 to-amber-500/5",
                          badge:
                            "bg-gradient-to-br from-amber-400 to-amber-500 shadow-lg shadow-amber-500/40",
                          textColor: "text-amber-500",
                          ring: "ring-amber-500/60 shadow-[0_0_12px_rgba(234,179,8,0.3)]",
                          size: "size-14 sm:size-16",
                        },
                        2: {
                          card: "border-zinc-400/40 shadow-[0_0_15px_rgba(148,163,184,0.1)] hover:shadow-[0_0_25px_rgba(148,163,184,0.2)]",
                          bg: "from-zinc-300/15 via-zinc-400/5 to-zinc-300/5",
                          badge:
                            "bg-gradient-to-br from-zinc-300 to-zinc-400 shadow-md shadow-zinc-400/30",
                          textColor: "text-zinc-400",
                          ring: "ring-zinc-400/50",
                          size: "size-11 sm:size-14",
                        },
                        3: {
                          card: "border-amber-700/40 shadow-[0_0_15px_rgba(180,83,9,0.1)] hover:shadow-[0_0_25px_rgba(180,83,9,0.2)]",
                          bg: "from-amber-700/15 via-orange-800/5 to-amber-700/5",
                          badge:
                            "bg-gradient-to-br from-amber-600 to-orange-700 shadow-md shadow-amber-700/30",
                          textColor: "text-amber-700 dark:text-amber-600",
                          ring: "ring-amber-700/50",
                          size: "size-11 sm:size-14",
                        },
                      }[clipper.position as 1 | 2 | 3]

                      if (!podiumStyles) return <div key={index} />

                      return (
                        <div
                          key={clipper.profileId}
                          className={cn(
                            "relative flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 transition-all duration-500 sm:gap-2 sm:p-4",
                            `bg-gradient-to-br ${podiumStyles.bg} ${podiumStyles.card}`,
                            clipper.position === 1 && "-mt-2 sm:-mt-4",
                          )}
                        >
                          {/* Badge de posição */}
                          <span
                            className={cn(
                              "absolute -top-2.5 left-1/2 z-10 flex size-5 -translate-x-1/2 items-center justify-center rounded-full text-[10px] font-black text-black sm:-top-3 sm:size-6 sm:text-xs",
                              podiumStyles.badge,
                            )}
                          >
                            {clipper.position}
                          </span>

                          {/* Avatar */}
                          <Avatar
                            className={cn(
                              "ring-offset-background relative mt-1.5 ring-2 ring-offset-2 transition-transform duration-300 hover:scale-105",
                              podiumStyles.size,
                              podiumStyles.ring,
                            )}
                          >
                            <AvatarImage
                              src={clipper.imageUrl ?? undefined}
                              alt={clipper.artisticName}
                            />
                            <AvatarFallback className="text-xs font-bold sm:text-sm">
                              {(clipper.artisticName || clipper.name)?.[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          {/* Nome + clã */}
                          <div className="relative w-full min-w-0 text-center">
                            <p className="truncate text-[10px] font-bold sm:text-xs">
                              {clipper.artisticName}
                            </p>
                            {clipper.clanTag && (
                              <div className="mt-1 flex justify-center">
                                <ClanTagBadge
                                  tag={clipper.clanTag}
                                  emoji={clipper.clanEmoji ?? "Shield"}
                                  emojiColor={
                                    clipper.clanEmojiColor ?? "#9ca3af"
                                  }
                                  size="xs"
                                />
                              </div>
                            )}
                          </div>

                          {/* Views */}
                          <div className="relative text-center">
                            <p
                              className={cn(
                                "text-sm font-black tabular-nums sm:text-lg",
                                podiumStyles.textColor,
                              )}
                            >
                              {formatCompact(clipper.views)}
                            </p>
                            <p className="text-muted-foreground text-[8px] font-medium sm:text-[10px]">
                              views
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* 4º–10º */}
                {rankingClippers.slice(3, 10).length > 0 && (
                  <div className="flex flex-col gap-1.5 p-3 sm:gap-2 sm:p-5">
                    {rankingClippers.slice(3, 10).map((clipper) => (
                      <div
                        key={clipper.profileId}
                        className="border-border/60 bg-muted/20 hover:bg-muted/40 flex items-center gap-2.5 rounded-2xl border p-2.5 transition-colors sm:gap-3 sm:p-3"
                      >
                        <span className="bg-muted/60 text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums sm:size-8 sm:text-xs">
                          {clipper.position}
                        </span>

                        <Avatar className="size-8 shrink-0 sm:size-10">
                          <AvatarImage
                            src={clipper.imageUrl ?? undefined}
                            alt={clipper.artisticName}
                          />
                          <AvatarFallback className="bg-muted text-[10px] font-bold sm:text-xs">
                            {(clipper.artisticName || clipper.name)?.[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-xs font-bold sm:text-sm">
                              {clipper.artisticName}
                            </p>
                            {clipper.clanTag && (
                              <ClanTagBadge
                                tag={clipper.clanTag}
                                emoji={clipper.clanEmoji ?? "Shield"}
                                emojiColor={clipper.clanEmojiColor ?? "#9ca3af"}
                                size="xs"
                              />
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-brand-cyan not-dark:text-primary text-xs font-bold tabular-nums sm:text-sm">
                            {formatCompact(clipper.views)}
                          </p>
                          <div className="mt-0.5 flex items-center justify-end gap-2">
                            <span className="flex items-center gap-0.5">
                              <Heart
                                className="size-2.5 text-pink-500/60"
                                weight="fill"
                              />
                              <span className="text-muted-foreground text-[9px] tabular-nums sm:text-[10px]">
                                {formatCompact(clipper.likes)}
                              </span>
                            </span>
                            <span className="flex items-center gap-0.5">
                              <ChatCircle
                                className="size-2.5 text-sky-500/60"
                                weight="fill"
                              />
                              <span className="text-muted-foreground text-[9px] tabular-nums sm:text-[10px]">
                                {formatCompact(clipper.comments)}
                              </span>
                            </span>
                            <span className="flex items-center gap-0.5">
                              <ShareNetwork
                                className="size-2.5 text-emerald-500/60"
                                weight="fill"
                              />
                              <span className="text-muted-foreground text-[9px] tabular-nums sm:text-[10px]">
                                {formatCompact(clipper.shares)}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/10">
                  <Trophy className="size-6 text-amber-500/60" weight="fill" />
                </span>
                <div>
                  <p className="text-muted-foreground text-sm font-semibold">
                    Nenhum dado de ranking disponível
                  </p>
                  <p className="text-muted-foreground/70 mt-1 text-xs">
                    Os dados aparecerão quando houver posts nos últimos 30 dias
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ============================================================
   Blocos auxiliares no padrão visual da marca
   ============================================================ */

function SectionBlock({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="border-border/60 bg-muted/20 flex flex-col gap-3 rounded-2xl border p-4">
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-2 text-sm font-bold">
          <span className="bg-gradient-custom flex size-7 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
            {icon}
          </span>
          {title}
        </span>
        {subtitle && (
          <span className="text-muted-foreground pl-9 text-xs">{subtitle}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function InfoTile({
  label,
  value,
  blurred = false,
}: {
  label: string
  value: string
  blurred?: boolean
}) {
  return (
    <div className="bg-muted/30 flex flex-col items-center gap-0.5 rounded-xl px-3 py-2.5 text-center">
      <span
        className={cn(
          "text-base font-bold tabular-nums",
          blurred && "blur-sm select-none",
        )}
      >
        {value}
      </span>
      <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
        {label}
      </span>
    </div>
  )
}
