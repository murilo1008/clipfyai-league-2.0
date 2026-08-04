"use client"

import { formatInTimeZone } from "date-fns-tz"
import { ptBR } from "date-fns/locale"

import type { RouterInputs, RouterOutputs } from "@/trpc/react"

/* ============================================================
   Tipos compartilhados da página da competição (clipador)
   ============================================================ */

export type CompetitionDetails =
  RouterOutputs["campaign"]["getCompetitionDetails"]

export type MyPost = CompetitionDetails["myPosts"][number]

export type MonthlyRankingEntry = CompetitionDetails["topRanking"][number]

export type DailyRankingItem = CompetitionDetails["topDailyPosts"][number]

export type ApplicationAccount =
  RouterOutputs["campaign"]["getApplicationAccounts"][number]

export type SocialAccount =
  RouterOutputs["clipper"]["getMySocialAccounts"][number]

export type AccountNiche = NonNullable<
  RouterInputs["clipper"]["addSocialAccount"]["niche"]
>

export type SocialPlatformKey =
  | "INSTAGRAM"
  | "TIKTOK"
  | "YOUTUBE"
  | "KWAI"
  | "FACEBOOK"

/* ============================================================
   Helpers
   ============================================================ */

/** "R$ 50.000" / "R$ 1.234,56" → número. */
export function parseBrlNumber(value: string): number {
  const parsed = parseFloat(
    value.replace(/[^\d,]/g, "").replace(",", "."),
  )
  return Number.isFinite(parsed) ? parsed : 0
}

/** Posts sem postedAt exibem createdAt com offset de -3h (BRT). */
export const CLIP_POST_SUBMIT_DISPLAY_OFFSET_MS = 3 * 60 * 60 * 1000

export function getClipPostTimelineMs(post: {
  postedAt?: string | null
  createdAt: string
}): number {
  if (post.postedAt) return new Date(post.postedAt).getTime()
  return (
    new Date(post.createdAt).getTime() - CLIP_POST_SUBMIT_DISPLAY_OFFSET_MS
  )
}

/** ER de um post (likes + comentários + shares) / views. */
export function getPostEngagementRate(post: {
  views: number
  likes: number
  comments: number
  shares: number | null
}): number {
  if (post.views <= 0) return 0
  return (
    ((post.likes + post.comments + (post.shares ?? 0)) / post.views) * 100
  )
}

export function formatDateTimeBrasil(iso: string): string {
  return formatInTimeZone(
    new Date(iso),
    "America/Sao_Paulo",
    "dd 'de' MMM • HH:mm",
    { locale: ptBR },
  )
}

/** Mantém o relógio do instante ISO (exibe em UTC) — usado no ranking diário. */
export function formatDailyPostTime(iso: string): string {
  return formatInTimeZone(new Date(iso), "UTC", "dd 'de' MMM • HH:mm", {
    locale: ptBR,
  })
}

/** Sanitiza o nome artístico para os links de afiliado. */
export function sanitizeArtisticName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
}

/* ============================================================
   Acentos por plataforma (cards de post 9:16 e sub-tabs)
   ============================================================ */

export const PLATFORM_ACCENT: Record<
  string,
  {
    /** Gradiente do chip redondo da plataforma. */
    chip: string
    /** Borda do card 9:16. */
    card: string
    /** Fundo do placeholder "Processando...". */
    pending: string
    /** Cor do spinner do placeholder. */
    spinner: string
    /** Fallback do badge de rank (posições 4-10). */
    rank: string
    /** Classes do TabsTrigger ativo da sub-tab. */
    tab: string
  }
> = {
  INSTAGRAM: {
    chip: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500",
    card: "border-pink-500/30 hover:border-pink-500 hover:shadow-pink-500/20",
    pending: "from-pink-500/20 via-card to-pink-500/10",
    spinner: "text-pink-400",
    rank: "bg-gradient-to-r from-pink-500 to-purple-500",
    tab: "data-[state=active]:bg-pink-500/20 data-[state=active]:text-pink-500 dark:data-[state=active]:text-pink-400",
  },
  TIKTOK: {
    chip: "bg-gradient-to-br from-cyan-400 to-cyan-600",
    card: "border-cyan-500/30 hover:border-cyan-500 hover:shadow-cyan-500/20",
    pending: "from-cyan-500/20 via-card to-cyan-500/10",
    spinner: "text-cyan-400",
    rank: "bg-gradient-to-r from-cyan-500 to-blue-500",
    tab: "data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-600 dark:data-[state=active]:text-cyan-400",
  },
  YOUTUBE: {
    chip: "bg-gradient-to-br from-red-500 to-red-700",
    card: "border-red-500/30 hover:border-red-500 hover:shadow-red-500/20",
    pending: "from-red-500/20 via-card to-red-500/10",
    spinner: "text-red-400",
    rank: "bg-gradient-to-r from-red-500 to-red-700",
    tab: "data-[state=active]:bg-red-500/20 data-[state=active]:text-red-500 dark:data-[state=active]:text-red-400",
  },
  KWAI: {
    chip: "bg-gradient-to-br from-orange-500 to-orange-700",
    card: "border-orange-500/30 hover:border-orange-500 hover:shadow-orange-500/20",
    pending: "from-orange-500/20 via-card to-orange-500/10",
    spinner: "text-orange-400",
    rank: "bg-gradient-to-r from-orange-500 to-orange-700",
    tab: "data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-500 dark:data-[state=active]:text-orange-400",
  },
  FACEBOOK: {
    chip: "bg-gradient-to-br from-blue-500 to-blue-700",
    card: "border-blue-500/30 hover:border-blue-500 hover:shadow-blue-500/20",
    pending: "from-blue-500/20 via-card to-blue-500/10",
    spinner: "text-blue-400",
    rank: "bg-gradient-to-r from-blue-500 to-blue-700",
    tab: "data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-500 dark:data-[state=active]:text-blue-400",
  },
}

export const DEFAULT_PLATFORM_ACCENT = {
  chip: "bg-gradient-to-br from-gray-500 to-gray-700",
  card: "border-border/50 hover:border-primary hover:shadow-primary/20",
  pending: "from-primary/20 via-card to-primary/10",
  spinner: "text-primary",
  rank: "bg-gradient-custom",
  tab: "data-[state=active]:bg-primary/20 data-[state=active]:text-primary",
} satisfies (typeof PLATFORM_ACCENT)[string]

export function getPlatformAccent(platform: string) {
  return PLATFORM_ACCENT[platform] ?? DEFAULT_PLATFORM_ACCENT
}

/* ============================================================
   Nichos (dialog "Nova Conta")
   ============================================================ */

export const nicheConfig: Record<string, { label: string; emoji: string }> = {
  MOTIVATIONAL: { label: "Motivacional", emoji: "💪" }, GOSSIP: { label: "Fofoca", emoji: "🗣️" }, MEME: { label: "Meme", emoji: "😂" }, ENTREPRENEURSHIP: { label: "Empreendedorismo", emoji: "🚀" }, HUMOR: { label: "Humor", emoji: "🤣" }, GAMING: { label: "Gaming", emoji: "🎮" }, SPORTS: { label: "Esportes", emoji: "⚽" }, MUSIC: { label: "Música", emoji: "🎵" }, EDUCATION: { label: "Educação", emoji: "📚" }, NEWS: { label: "Notícias", emoji: "📰" }, POLITICS: { label: "Política", emoji: "🏛️" }, LIFESTYLE: { label: "Lifestyle", emoji: "✨" }, FITNESS: { label: "Fitness", emoji: "🏋️" }, FASHION: { label: "Moda", emoji: "👗" }, BEAUTY: { label: "Beleza", emoji: "💄" }, FOOD: { label: "Comida", emoji: "🍕" }, TRAVEL: { label: "Viagem", emoji: "✈️" }, TECH: { label: "Tecnologia", emoji: "💻" }, FINANCE: { label: "Finanças", emoji: "💰" }, RELIGION: { label: "Religião", emoji: "🙏" }, ENTERTAINMENT: { label: "Entretenimento", emoji: "🎬" }, HOT: { label: "Hot", emoji: "🔥" }, FAMILY: { label: "Família", emoji: "👨‍👩‍👧‍👦" }, MATERNITY: { label: "Maternidade", emoji: "🤱" }, PATERNITY: { label: "Paternidade", emoji: "👨‍👧" }, MARRIAGE: { label: "Casamento", emoji: "💍" }, BODYBUILDING: { label: "Maromba", emoji: "💪🏋️" }, WOMEN: { label: "Mulher", emoji: "👩" }, MEN: { label: "Homem", emoji: "👨" }, COUPLE: { label: "Casal", emoji: "💑" }, PETS: { label: "Pets", emoji: "🐾" }, CARS: { label: "Carros", emoji: "🚗" }, MOTORCYCLES: { label: "Motos", emoji: "🏍️" }, ANIME: { label: "Anime", emoji: "🎌" }, KPOP: { label: "K-Pop", emoji: "🇰🇷" }, DANCE: { label: "Dança", emoji: "💃" }, COMEDY: { label: "Comédia", emoji: "😆" }, DRAMA: { label: "Drama", emoji: "🎭" }, ASTROLOGY: { label: "Astrologia", emoji: "♈" }, PSYCHOLOGY: { label: "Psicologia", emoji: "🧠" }, SELF_HELP: { label: "Autoajuda", emoji: "📖" }, PRODUCTIVITY: { label: "Produtividade", emoji: "⏱️" }, MARKETING: { label: "Marketing", emoji: "📢" }, SALES: { label: "Vendas", emoji: "🛒" }, REAL_ESTATE: { label: "Imobiliário", emoji: "🏠" }, CRYPTO: { label: "Cripto", emoji: "₿" }, INVESTING: { label: "Investimentos", emoji: "📈" }, DIY: { label: "Faça Você Mesmo", emoji: "🔨" }, ART: { label: "Arte", emoji: "🎨" }, PHOTOGRAPHY: { label: "Fotografia", emoji: "📷" }, CINEMA: { label: "Cinema", emoji: "🎥" }, SERIES: { label: "Séries", emoji: "📺" }, BOOKS: { label: "Livros", emoji: "📚" }, PODCAST: { label: "Podcast", emoji: "🎙️" }, ASMR: { label: "ASMR", emoji: "🎧" }, NATURE: { label: "Natureza", emoji: "🌿" }, SUSTAINABILITY: { label: "Sustentabilidade", emoji: "♻️" }, HEALTH: { label: "Saúde", emoji: "🏥" }, MENTAL_HEALTH: { label: "Saúde Mental", emoji: "🧘" }, NUTRITION: { label: "Nutrição", emoji: "🥗" }, VEGAN: { label: "Vegano", emoji: "🌱" }, COOKING: { label: "Culinária", emoji: "👨‍🍳" }, CONFECTIONERY: { label: "Confeitaria", emoji: "🎂" }, DECORATION: { label: "Decoração", emoji: "🏡" }, PARENTING: { label: "Parentalidade", emoji: "👪" }, BABY: { label: "Bebê", emoji: "👶" }, KIDS: { label: "Crianças", emoji: "🧒" }, UNIVERSITY: { label: "Universidade", emoji: "🎓" }, LAW: { label: "Direito", emoji: "⚖️" }, MEDICINE: { label: "Medicina", emoji: "🩺" }, SCIENCE: { label: "Ciência", emoji: "🔬" }, CROSSFIT: { label: "CrossFit", emoji: "🏋️‍♂️" }, YOGA: { label: "Yoga", emoji: "🧘‍♀️" }, RUNNING: { label: "Corrida", emoji: "🏃" }, MARTIAL_ARTS: { label: "Artes Marciais", emoji: "🥋" }, SOCCER: { label: "Futebol", emoji: "⚽" }, ESPORTS: { label: "E-Sports", emoji: "🕹️" }, STREAMER: { label: "Streamer", emoji: "📡" }, COSPLAY: { label: "Cosplay", emoji: "🎭" }, TATTOO: { label: "Tatuagem", emoji: "💉" }, NAILS: { label: "Unhas", emoji: "💅" }, HAIR: { label: "Cabelo", emoji: "💇" }, SKINCARE: { label: "Skincare", emoji: "🧴" }, MAKEUP: { label: "Maquiagem", emoji: "💄" }, LUXURY: { label: "Luxo", emoji: "👑" }, STREETWEAR: { label: "Streetwear", emoji: "🧢" }, SNEAKERS: { label: "Sneakers", emoji: "👟" }, WEDDING: { label: "Casamentos", emoji: "👰" }, PARTY: { label: "Festas", emoji: "🎉" }, FUNK: { label: "Funk", emoji: "🎶" }, SERTANEJO: { label: "Sertanejo", emoji: "🤠" }, RAP: { label: "Rap", emoji: "🎤" }, ROCK: { label: "Rock", emoji: "🎸" }, GOSPEL: { label: "Gospel", emoji: "✝️" }, LGBTQ: { label: "LGBTQ+", emoji: "🏳️‍🌈" }, ACTIVISM: { label: "Ativismo", emoji: "✊" }, SPIRITUAL: { label: "Espiritualidade", emoji: "🕊️" }, TAROT: { label: "Tarot", emoji: "🃏" }, TRUE_CRIME: { label: "True Crime", emoji: "🔍" }, HORROR: { label: "Terror", emoji: "👻" }, CHALLENGES: { label: "Desafios", emoji: "🏆" }, PRANKS: { label: "Pegadinhas", emoji: "😜" }, REACTIONS: { label: "Reações", emoji: "😱" }, UNBOXING: { label: "Unboxing", emoji: "📦" }, REVIEWS: { label: "Reviews", emoji: "⭐" }, TUTORIALS: { label: "Tutoriais", emoji: "📝" }, TIPS: { label: "Dicas", emoji: "💡" }, STORYTIME: { label: "Storytime", emoji: "📖" }, RELATIONSHIPS: { label: "Relacionamentos", emoji: "❤️‍🔥" }, DATING: { label: "Paquera", emoji: "💘" }, THERAPY: { label: "Terapia", emoji: "🛋️" }, OTHER: { label: "Outro", emoji: "📌" },
}

export const sortedNiches = Object.entries(nicheConfig).sort((a, b) =>
  a[1].label.localeCompare(b[1].label, "pt-BR"),
)
