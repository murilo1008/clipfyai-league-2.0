"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { toast } from "sonner"

import {
  ArrowLeft,
  ArrowRight,
  Buildings,
  Camera,
  CaretUpDown,
  Check,
  CheckCircle,
  CircleNotch,
  FileText,
  Heart,
  IdentificationCard,
  InstagramLogo,
  MapPin,
  Medal,
  Phone,
  PixLogo,
  Plus,
  Sparkle,
  Star,
  Tag,
  UploadSimple,
  User,
  WarningCircle,
  X,
  YoutubeLogo,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react"

import { TikTokIcon } from "@/components/icons/tiktok-icon"
import { KwaiIcon } from "@/components/icons/kwai-icon"
import { FacebookIcon } from "@/components/icons/facebook-icon"
import { DiscordIcon } from "@/components/icons/discord-icon"

import { AuthLoadingScreen } from "@/components/templates/auth-template"
import { DashboardBackground } from "@/components/dashboard-background"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { api, type RouterInputs } from "@/trpc/react"
import { cn } from "@/lib/utils"
import {
  PIX_KEY_TYPE_OPTIONS,
  inferPixKeyType,
  normalizePixKeyForType,
  pixKeyPlaceholder,
  type PixKeyType,
} from "@/lib/pix-key"

/* ============================================================
   Configuração das etapas
   ============================================================ */
const STEPS: { id: number; title: string; icon: PhosphorIcon }[] = [
  { id: 1, title: "Informações Pessoais", icon: User },
  { id: 2, title: "Redes Sociais", icon: Sparkle },
  { id: 3, title: "Termos", icon: FileText },
  { id: 4, title: "Conclusão", icon: CheckCircle },
]

const BRAZILIAN_STATES: { uf: string; name: string }[] = [
  { uf: "AC", name: "Acre" }, { uf: "AL", name: "Alagoas" }, { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" }, { uf: "BA", name: "Bahia" }, { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" }, { uf: "ES", name: "Espírito Santo" }, { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" }, { uf: "MT", name: "Mato Grosso" }, { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" }, { uf: "PA", name: "Pará" }, { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" }, { uf: "PE", name: "Pernambuco" }, { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" }, { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" }, { uf: "RO", name: "Rondônia" }, { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" }, { uf: "SP", name: "São Paulo" }, { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" },
]

const nicheConfig: Record<string, { label: string; emoji: string }> = {
  MOTIVATIONAL: { label: "Motivacional", emoji: "💪" }, GOSSIP: { label: "Fofoca", emoji: "🗣️" }, MEME: { label: "Meme", emoji: "😂" }, ENTREPRENEURSHIP: { label: "Empreendedorismo", emoji: "🚀" }, HUMOR: { label: "Humor", emoji: "🤣" }, GAMING: { label: "Gaming", emoji: "🎮" }, SPORTS: { label: "Esportes", emoji: "⚽" }, MUSIC: { label: "Música", emoji: "🎵" }, EDUCATION: { label: "Educação", emoji: "📚" }, NEWS: { label: "Notícias", emoji: "📰" }, POLITICS: { label: "Política", emoji: "🏛️" }, LIFESTYLE: { label: "Lifestyle", emoji: "✨" }, FITNESS: { label: "Fitness", emoji: "🏋️" }, FASHION: { label: "Moda", emoji: "👗" }, BEAUTY: { label: "Beleza", emoji: "💄" }, FOOD: { label: "Comida", emoji: "🍕" }, TRAVEL: { label: "Viagem", emoji: "✈️" }, TECH: { label: "Tecnologia", emoji: "💻" }, FINANCE: { label: "Finanças", emoji: "💰" }, RELIGION: { label: "Religião", emoji: "🙏" }, ENTERTAINMENT: { label: "Entretenimento", emoji: "🎬" }, HOT: { label: "Hot", emoji: "🔥" }, FAMILY: { label: "Família", emoji: "👨‍👩‍👧‍👦" }, MATERNITY: { label: "Maternidade", emoji: "🤱" }, PATERNITY: { label: "Paternidade", emoji: "👨‍👧" }, MARRIAGE: { label: "Casamento", emoji: "💍" }, BODYBUILDING: { label: "Maromba", emoji: "💪🏋️" }, WOMEN: { label: "Mulher", emoji: "👩" }, MEN: { label: "Homem", emoji: "👨" }, COUPLE: { label: "Casal", emoji: "💑" }, PETS: { label: "Pets", emoji: "🐾" }, CARS: { label: "Carros", emoji: "🚗" }, MOTORCYCLES: { label: "Motos", emoji: "🏍️" }, ANIME: { label: "Anime", emoji: "🎌" }, KPOP: { label: "K-Pop", emoji: "🇰🇷" }, DANCE: { label: "Dança", emoji: "💃" }, COMEDY: { label: "Comédia", emoji: "😆" }, DRAMA: { label: "Drama", emoji: "🎭" }, ASTROLOGY: { label: "Astrologia", emoji: "♈" }, PSYCHOLOGY: { label: "Psicologia", emoji: "🧠" }, SELF_HELP: { label: "Autoajuda", emoji: "📖" }, PRODUCTIVITY: { label: "Produtividade", emoji: "⏱️" }, MARKETING: { label: "Marketing", emoji: "📢" }, SALES: { label: "Vendas", emoji: "🛒" }, REAL_ESTATE: { label: "Imobiliário", emoji: "🏠" }, CRYPTO: { label: "Cripto", emoji: "₿" }, INVESTING: { label: "Investimentos", emoji: "📈" }, DIY: { label: "Faça Você Mesmo", emoji: "🔨" }, ART: { label: "Arte", emoji: "🎨" }, PHOTOGRAPHY: { label: "Fotografia", emoji: "📷" }, CINEMA: { label: "Cinema", emoji: "🎥" }, SERIES: { label: "Séries", emoji: "📺" }, BOOKS: { label: "Livros", emoji: "📚" }, PODCAST: { label: "Podcast", emoji: "🎙️" }, ASMR: { label: "ASMR", emoji: "🎧" }, NATURE: { label: "Natureza", emoji: "🌿" }, SUSTAINABILITY: { label: "Sustentabilidade", emoji: "♻️" }, HEALTH: { label: "Saúde", emoji: "🏥" }, MENTAL_HEALTH: { label: "Saúde Mental", emoji: "🧘" }, NUTRITION: { label: "Nutrição", emoji: "🥗" }, VEGAN: { label: "Vegano", emoji: "🌱" }, COOKING: { label: "Culinária", emoji: "👨‍🍳" }, CONFECTIONERY: { label: "Confeitaria", emoji: "🎂" }, DECORATION: { label: "Decoração", emoji: "🏡" }, PARENTING: { label: "Parentalidade", emoji: "👪" }, BABY: { label: "Bebê", emoji: "👶" }, KIDS: { label: "Crianças", emoji: "🧒" }, UNIVERSITY: { label: "Universidade", emoji: "🎓" }, LAW: { label: "Direito", emoji: "⚖️" }, MEDICINE: { label: "Medicina", emoji: "🩺" }, SCIENCE: { label: "Ciência", emoji: "🔬" }, CROSSFIT: { label: "CrossFit", emoji: "🏋️‍♂️" }, YOGA: { label: "Yoga", emoji: "🧘‍♀️" }, RUNNING: { label: "Corrida", emoji: "🏃" }, MARTIAL_ARTS: { label: "Artes Marciais", emoji: "🥋" }, SOCCER: { label: "Futebol", emoji: "⚽" }, ESPORTS: { label: "E-Sports", emoji: "🕹️" }, STREAMER: { label: "Streamer", emoji: "📡" }, COSPLAY: { label: "Cosplay", emoji: "🎭" }, TATTOO: { label: "Tatuagem", emoji: "💉" }, NAILS: { label: "Unhas", emoji: "💅" }, HAIR: { label: "Cabelo", emoji: "💇" }, SKINCARE: { label: "Skincare", emoji: "🧴" }, MAKEUP: { label: "Maquiagem", emoji: "💄" }, LUXURY: { label: "Luxo", emoji: "👑" }, STREETWEAR: { label: "Streetwear", emoji: "🧢" }, SNEAKERS: { label: "Sneakers", emoji: "👟" }, WEDDING: { label: "Casamentos", emoji: "👰" }, PARTY: { label: "Festas", emoji: "🎉" }, FUNK: { label: "Funk", emoji: "🎶" }, SERTANEJO: { label: "Sertanejo", emoji: "🤠" }, RAP: { label: "Rap", emoji: "🎤" }, ROCK: { label: "Rock", emoji: "🎸" }, GOSPEL: { label: "Gospel", emoji: "✝️" }, LGBTQ: { label: "LGBTQ+", emoji: "🏳️‍🌈" }, ACTIVISM: { label: "Ativismo", emoji: "✊" }, SPIRITUAL: { label: "Espiritualidade", emoji: "🕊️" }, TAROT: { label: "Tarot", emoji: "🃏" }, TRUE_CRIME: { label: "True Crime", emoji: "🔍" }, HORROR: { label: "Terror", emoji: "👻" }, CHALLENGES: { label: "Desafios", emoji: "🏆" }, PRANKS: { label: "Pegadinhas", emoji: "😜" }, REACTIONS: { label: "Reações", emoji: "😱" }, UNBOXING: { label: "Unboxing", emoji: "📦" }, REVIEWS: { label: "Reviews", emoji: "⭐" }, TUTORIALS: { label: "Tutoriais", emoji: "📝" }, TIPS: { label: "Dicas", emoji: "💡" }, STORYTIME: { label: "Storytime", emoji: "📖" }, RELATIONSHIPS: { label: "Relacionamentos", emoji: "❤️‍🔥" }, DATING: { label: "Paquera", emoji: "💘" }, THERAPY: { label: "Terapia", emoji: "🛋️" }, OTHER: { label: "Outro", emoji: "📌" },
}

const sortedNiches = Object.entries(nicheConfig).sort((a, b) =>
  a[1].label.localeCompare(b[1].label, "pt-BR"),
)

interface SocialAccountEntry {
  username: string
  niche: string
}

interface OnboardingData {
  // Step 1: Informações Pessoais
  fullName: string
  artisticName: string
  phone: string
  cpf: string
  pixKey: string
  pixKeyType: PixKeyType
  country: string
  state: string
  city: string

  // Step 2: Redes Sociais
  instagramAccounts: SocialAccountEntry[]
  tiktokAccounts: SocialAccountEntry[]
  youtubeAccounts: SocialAccountEntry[]
  kwaiAccounts: SocialAccountEntry[]
  facebookAccounts: SocialAccountEntry[]

  // Step 3: Termos
  agreeToTerms: boolean
  agreeToCompliance: boolean
  agreeToPublicProfile: boolean
  agreeToDataProcessing: boolean
  isOver18: boolean
}

type UpsertClipperProfileInput = RouterInputs["user"]["upsertClipperProfile"]
type ClerkUser = ReturnType<typeof useUser>["user"]

/* ============================================================
   Máscaras
   ============================================================ */
const applyPhoneMask = (value: string): string => {
  const numbers = value.replace(/\D/g, "")

  if (numbers.length <= 2) {
    return numbers
  } else if (numbers.length <= 7) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
  } else if (numbers.length <= 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`
  } else {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
  }
}

const applyCpfMask = (value: string): string => {
  const numbers = value.replace(/\D/g, "")

  if (numbers.length <= 3) {
    return numbers
  } else if (numbers.length <= 6) {
    return `${numbers.slice(0, 3)}.${numbers.slice(3)}`
  } else if (numbers.length <= 9) {
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`
  } else {
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`
  }
}

const applyCnpjMask = (value: string): string => {
  const numbers = value.replace(/\D/g, "")

  if (numbers.length <= 2) {
    return numbers
  } else if (numbers.length <= 5) {
    return `${numbers.slice(0, 2)}.${numbers.slice(2)}`
  } else if (numbers.length <= 8) {
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`
  } else if (numbers.length <= 12) {
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`
  } else {
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12, 14)}`
  }
}

/* ============================================================
   Chave PIX: máscara, limites e dicas por tipo
   ============================================================ */

/** Deixa a chave no formato de digitação do tipo escolhido. */
const maskPixKey = (value: string, type: PixKeyType): string => {
  switch (type) {
    case "CPF":
      return applyCpfMask(value)
    case "CNPJ":
      return applyCnpjMask(value)
    case "PHONE": {
      let numbers = value.replace(/\D/g, "")
      // Chave salva como +55DDDNÚMERO volta a ser exibida só com DDD + número
      if (numbers.startsWith("55") && numbers.length > 11) {
        numbers = numbers.slice(2)
      }
      return applyPhoneMask(numbers)
    }
    case "EMAIL":
      return value.replace(/\s/g, "")
    case "EVP":
      return value.trim().toLowerCase()
  }
}

const PIX_KEY_MAX_LENGTH: Record<PixKeyType, number> = {
  CPF: 14,
  CNPJ: 18,
  EMAIL: 77,
  PHONE: 15,
  EVP: 36,
}

const PIX_KEY_INPUT_MODE: Record<
  PixKeyType,
  "numeric" | "tel" | "email" | "text"
> = {
  CPF: "numeric",
  CNPJ: "numeric",
  EMAIL: "email",
  PHONE: "tel",
  EVP: "text",
}

const PIX_KEY_HINT: Record<PixKeyType, string> = {
  CPF: "Use o CPF do titular da conta que vai receber os prêmios.",
  CNPJ: "Use o CNPJ da empresa titular da conta que vai receber os prêmios.",
  EMAIL: "O e-mail é salvo em minúsculas, exatamente como cadastrado no banco.",
  PHONE: "Use DDD + número. O sistema salva automaticamente com +55.",
  EVP: "Cole a chave aleatória gerada pelo seu banco (36 caracteres).",
}

/** Rótulo legível do tipo (usado em mensagens de erro e resumos). */
const pixKeyTypeLabel = (type: PixKeyType): string =>
  PIX_KEY_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? "Chave"

/* ============================================================
   Estilos compartilhados da página (identidade da marca)
   ============================================================ */

/** Input de vidro theme-aware, com foco no ciano da marca (primary no light). */
const glassInput =
  "h-11 sm:h-12 rounded-xl border-border/60 bg-card/50 text-sm backdrop-blur-sm placeholder:text-muted-foreground/50 focus-visible:border-brand-cyan/40 focus-visible:ring-brand-cyan/25 not-dark:focus-visible:border-primary/50 not-dark:focus-visible:ring-primary/25"

/** Círculo com o degradê oficial (remapeado para o primary no tema light). */
const brandCircle =
  "bg-gradient-to-r from-brand-cyan via-brand-mint to-brand-green not-dark:from-primary not-dark:via-primary not-dark:to-[#0eb981]"

/** Ícone sobre o degradê da marca. */
const onBrand = "text-[#04222A] not-dark:text-white"

/** Painel de vidro interno das seções. */
const glassPanel = "rounded-xl sm:rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm"

/** Cabeçalho de etapa: ícone em círculo degradê + título + descrição. */
function StepHeading({
  icon: HeadingIcon,
  title,
  children,
}: {
  icon: PhosphorIcon
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-5 text-center sm:mb-8">
      <div className="relative mb-3 inline-flex sm:mb-4">
        <span
          aria-hidden
          className="from-brand-cyan/25 to-brand-green/25 not-dark:from-primary/20 not-dark:to-primary/10 absolute -inset-2 rounded-full bg-gradient-to-r blur-lg"
        />
        <span
          className={cn(
            "shadow-brand-cyan/25 not-dark:shadow-primary/25 relative inline-flex h-12 w-12 items-center justify-center rounded-full shadow-lg sm:h-16 sm:w-16",
            brandCircle,
          )}
        >
          <HeadingIcon className={cn("h-6 w-6 sm:h-8 sm:w-8", onBrand)} weight="fill" />
        </span>
      </div>
      <h2 className="mb-1.5 text-xl font-bold sm:mb-2 sm:text-2xl md:text-3xl">{title}</h2>
      {children}
    </div>
  )
}

/* ============================================================
   Página
   ============================================================ */
export default function Onboarding() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  // Query para buscar dados do usuário do banco
  const { data: userData, isLoading: isLoadingUserData } = api.user.getCurrentUser.useQuery()

  const [data, setData] = useState<OnboardingData>({
    fullName: "",
    artisticName: "",
    phone: "",
    cpf: "",
    pixKey: "",
    pixKeyType: "CPF",
    country: "Brasil",
    state: "",
    city: "",
    instagramAccounts: [],
    tiktokAccounts: [],
    youtubeAccounts: [],
    kwaiAccounts: [],
    facebookAccounts: [],
    agreeToTerms: false,
    agreeToCompliance: false,
    agreeToPublicProfile: false,
    agreeToDataProcessing: false,
    isOver18: false,
  })

  // Mutations
  const upsertProfile = api.user.upsertClipperProfile.useMutation()
  const completeOnboarding = api.user.completeOnboarding.useMutation()

  // Redirecionar se já completou onboarding ou está verificado
  useEffect(() => {
    if (userData && userData.onboardingCompleted) {
      // Se já completou onboarding, redireciona para o dashboard
      router.push("/")
    }
  }, [userData, router])

  // Preencher dados do Clerk e banco de dados
  useEffect(() => {
    if (isLoaded && user && userData) {
      const profile = userData.clipperProfile

      // Buscar telefone de várias fontes possíveis
      const clerkPhone = user.primaryPhoneNumber?.phoneNumber || ""
      const metadataPhone = (user.publicMetadata?.phone as string) || ""
      const dbPhone = profile?.phone || ""

      // Pegar o primeiro telefone disponível
      const rawPhone = clerkPhone || metadataPhone || dbPhone
      const formattedPhone = rawPhone ? applyPhoneMask(rawPhone.replace(/\D/g, "")) : ""

      // Chave PIX: o banco guarda só a chave normalizada, então o tipo é inferido
      const rawPixKey = profile?.pixKey || ""
      const inferredPixKeyType = inferPixKeyType(rawPixKey)

      // Verificar se há dados salvos
      const toEntries = (usernames?: string[]): SocialAccountEntry[] =>
        (usernames || []).map((u) => ({ username: u, niche: "" }))

      const hasProfileData =
        profile &&
        (profile.fullName ||
          profile.instagramUsernames.length > 0 ||
          profile.tiktokUsernames.length > 0 ||
          profile.youtubeUsernames.length > 0 ||
          profile.kwaiUsernames.length > 0 ||
          profile.facebookUsernames.length > 0)

      setData((prev) => ({
        ...prev,
        // Step 1: Informações Pessoais
        fullName: profile?.fullName || user.fullName || prev.fullName,
        artisticName: profile?.artisticName || prev.artisticName,
        phone: formattedPhone || prev.phone,
        cpf: profile?.cpf || prev.cpf,
        pixKey: rawPixKey ? maskPixKey(rawPixKey, inferredPixKeyType) : prev.pixKey,
        pixKeyType: rawPixKey ? inferredPixKeyType : prev.pixKeyType,
        country: profile?.country || prev.country,
        state: profile?.state || prev.state,
        city: profile?.city || prev.city,

        // Step 2: Redes Sociais
        instagramAccounts: profile?.instagramUsernames?.length ? toEntries(profile.instagramUsernames) : prev.instagramAccounts,
        tiktokAccounts: profile?.tiktokUsernames?.length ? toEntries(profile.tiktokUsernames) : prev.tiktokAccounts,
        youtubeAccounts: profile?.youtubeUsernames?.length ? toEntries(profile.youtubeUsernames) : prev.youtubeAccounts,
        kwaiAccounts: profile?.kwaiUsernames?.length ? toEntries(profile.kwaiUsernames) : prev.kwaiAccounts,
        facebookAccounts: profile?.facebookUsernames?.length ? toEntries(profile.facebookUsernames) : prev.facebookAccounts,

        // Step 3: Termos
        agreeToTerms: profile?.agreeToTerms || prev.agreeToTerms,
        agreeToCompliance: profile?.agreeToCompliance || prev.agreeToCompliance,
        agreeToPublicProfile: profile?.agreeToPublicProfile || prev.agreeToPublicProfile,
        agreeToDataProcessing: profile?.agreeToDataProcessing || prev.agreeToDataProcessing,
        isOver18: profile?.isOver18 || prev.isOver18,
      }))

      // Mostrar toast se houver dados salvos
      if (hasProfileData) {
        toast.info("Seus dados foram carregados! Você pode continuar de onde parou.", {
          duration: 4000,
        })
      }
    }
  }, [isLoaded, user, userData])

  // Salvar progresso ao mudar de etapa
  const saveProgress = async (stepData: UpsertClipperProfileInput) => {
    try {
      await upsertProfile.mutateAsync(stepData)
    } catch (error) {
      console.error("Erro ao salvar progresso:", error)
    }
  }

  const confirmSocialMediaAndProceed = async () => {
    setShowConfirmDialog(false)
    setIsSubmitting(true)

    try {
      const allAccounts = [
        ...data.instagramAccounts.map((a) => ({ platform: "INSTAGRAM" as const, username: a.username, niche: a.niche })),
        ...data.tiktokAccounts.map((a) => ({ platform: "TIKTOK" as const, username: a.username, niche: a.niche })),
        ...data.youtubeAccounts.map((a) => ({ platform: "YOUTUBE" as const, username: a.username, niche: a.niche })),
        ...data.kwaiAccounts.map((a) => ({ platform: "KWAI" as const, username: a.username, niche: a.niche })),
        ...data.facebookAccounts.map((a) => ({ platform: "FACEBOOK" as const, username: a.username, niche: a.niche })),
      ]
      await saveProgress({
        instagramUsernames: data.instagramAccounts.map((a) => a.username),
        tiktokUsernames: data.tiktokAccounts.map((a) => a.username),
        youtubeUsernames: data.youtubeAccounts.map((a) => a.username),
        kwaiUsernames: data.kwaiAccounts.map((a) => a.username),
        facebookUsernames: data.facebookAccounts.map((a) => a.username),
        socialAccountsData: allAccounts,
      })
      setCurrentStep((prev) => prev + 1)
      toast.success("Redes sociais confirmadas!")
    } catch (error) {
      toast.error("Erro ao salvar redes sociais")
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNext = async () => {
    setIsSubmitting(true)

    try {
      // Validar e salvar dados da etapa atual
      if (currentStep === 1) {
        // Etapa 1: Informações Pessoais
        if (!data.fullName.trim()) {
          toast.error("Nome completo é obrigatório")
          setIsSubmitting(false)
          return
        }
        if (!data.artisticName.trim()) {
          toast.error("Nome artístico é obrigatório")
          setIsSubmitting(false)
          return
        }
        if (!data.phone.trim()) {
          toast.error("Telefone é obrigatório")
          setIsSubmitting(false)
          return
        }
        if (!data.cpf.trim()) {
          toast.error("CPF é obrigatório")
          setIsSubmitting(false)
          return
        }
        if (!data.pixKey.trim()) {
          toast.error("Chave PIX é obrigatória")
          setIsSubmitting(false)
          return
        }
        const normalizedPixKey = normalizePixKeyForType(data.pixKey, data.pixKeyType)
        if (!normalizedPixKey.ok) {
          toast.error(normalizedPixKey.error)
          setIsSubmitting(false)
          return
        }
        if (!data.country.trim()) {
          toast.error("País é obrigatório")
          setIsSubmitting(false)
          return
        }
        if (!data.state.trim()) {
          toast.error("Estado é obrigatório")
          setIsSubmitting(false)
          return
        }
        if (!data.city.trim()) {
          toast.error("Cidade é obrigatória")
          setIsSubmitting(false)
          return
        }
        await saveProgress({
          fullName: data.fullName,
          artisticName: data.artisticName,
          phone: data.phone,
          cpf: data.cpf,
          pixKey: normalizedPixKey.value,
          country: data.country,
          state: data.state,
          city: data.city,
        })
      } else if (currentStep === 2) {
        // Etapa 2: Redes Sociais
        if (data.instagramAccounts.length === 0 && data.tiktokAccounts.length === 0 && data.youtubeAccounts.length === 0 && data.kwaiAccounts.length === 0 && data.facebookAccounts.length === 0) {
          toast.error("Adicione pelo menos uma rede social")
          setIsSubmitting(false)
          return
        }
        // Mostrar dialog de confirmação
        setShowConfirmDialog(true)
        setIsSubmitting(false)
        return
      } else if (currentStep === 3) {
        // Etapa 3: Termos
        if (!data.isOver18) {
          toast.error("Você deve confirmar que é maior de 18 anos")
          setIsSubmitting(false)
          return
        }
        if (!data.agreeToTerms) {
          toast.error("Você deve aceitar os Termos de Uso")
          setIsSubmitting(false)
          return
        }
        if (!data.agreeToCompliance) {
          toast.error("Você deve se comprometer a seguir as regras")
          setIsSubmitting(false)
          return
        }
        if (!data.agreeToPublicProfile) {
          toast.error("Você deve autorizar a exibição do seu perfil")
          setIsSubmitting(false)
          return
        }
        if (!data.agreeToDataProcessing) {
          toast.error("Você deve concordar com o processamento de dados")
          setIsSubmitting(false)
          return
        }
        await saveProgress({
          agreeToTerms: data.agreeToTerms,
          agreeToCompliance: data.agreeToCompliance,
          agreeToPublicProfile: data.agreeToPublicProfile,
          agreeToDataProcessing: data.agreeToDataProcessing,
          isOver18: data.isOver18,
        })
      } else if (currentStep === 4) {
        // Etapa 4: Conclusão - Finalizar onboarding (auto-aprovação)
        await completeOnboarding.mutateAsync()

        // Redirecionar direto para o dashboard (auto-aprovado)
        toast.success("🎉 Bem-vindo à Clipfy League! Sua conta foi aprovada automaticamente!")
        setTimeout(() => {
          router.push("/")
        }, 1500)
        return
      }

      if (currentStep < 4) {
        setCurrentStep(currentStep + 1)
        window.scrollTo({ top: 0, behavior: "smooth" })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar progresso")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const progress = ((currentStep - 1) / (STEPS.length - 1)) * 100

  // Enquanto a chave PIX digitada estiver inválida, o avanço fica bloqueado
  const isPixKeyBlocking =
    currentStep === 1 &&
    data.pixKey.trim().length > 0 &&
    !normalizePixKeyForType(data.pixKey, data.pixKeyType).ok

  if (!isLoaded || isLoadingUserData) {
    return <AuthLoadingScreen stage={isLoaded ? "profile" : "session"} />
  }

  const confirmPlatforms: {
    accounts: SocialAccountEntry[]
    label: string
    Icon: React.ComponentType<{ className?: string }>
    cardClass: string
    iconColor: string
    badgeBorder: string
  }[] = [
    { accounts: data.instagramAccounts, label: "Instagram", Icon: InstagramLogo, cardClass: "border-pink-500/30 bg-gradient-to-br from-pink-500/5 to-transparent", iconColor: "text-pink-400", badgeBorder: "border-pink-500/30" },
    { accounts: data.tiktokAccounts, label: "TikTok", Icon: TikTokIcon, cardClass: "border-[#f1204a]/30 bg-gradient-to-br from-[#f1204a]/5 to-transparent", iconColor: "text-[#f1204a]", badgeBorder: "border-[#f1204a]/30" },
    { accounts: data.youtubeAccounts, label: "YouTube", Icon: YoutubeLogo, cardClass: "border-red-500/30 bg-gradient-to-br from-red-500/5 to-transparent", iconColor: "text-red-400", badgeBorder: "border-red-500/30" },
    { accounts: data.kwaiAccounts, label: "Kwai", Icon: KwaiIcon, cardClass: "border-[#ff7705]/30 bg-gradient-to-br from-[#ff7705]/5 to-transparent", iconColor: "text-[#ff7705]", badgeBorder: "border-[#ff7705]/30" },
    { accounts: data.facebookAccounts, label: "Facebook", Icon: FacebookIcon, cardClass: "border-[#1877f2]/30 bg-gradient-to-br from-[#1877f2]/5 to-transparent", iconColor: "text-[#1877f2]", badgeBorder: "border-[#1877f2]/30" },
  ]

  return (
    <div className="bg-background relative min-h-svh overflow-hidden">
      {/* Keyframes locais da página (prefixo onb-) */}
      <style>{`
        .onb-border-glow {
          background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--primary) 30%, transparent) 0%,
            color-mix(in srgb, var(--primary) 10%, transparent) 50%,
            color-mix(in srgb, var(--primary) 30%, transparent) 100%
          );
          background-size: 200% 200%;
          animation: onb-border-glow 8s ease-in-out infinite;
        }
        .dark .onb-border-glow {
          background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--brand-cyan) 32%, transparent) 0%,
            color-mix(in srgb, var(--brand-green) 10%, transparent) 50%,
            color-mix(in srgb, var(--brand-cyan) 32%, transparent) 100%
          );
          background-size: 200% 200%;
          animation: onb-border-glow 8s ease-in-out infinite;
        }
        @keyframes onb-border-glow {
          0%, 100% { background-position: 0% 50%; opacity: 0.45; }
          50% { background-position: 100% 50%; opacity: 0.75; }
        }
        @media (prefers-reduced-motion: reduce) {
          .onb-border-glow, .dark .onb-border-glow { animation: none; }
        }
      `}</style>

      {/* Fundo oficial: galáxia petróleo + grid + glows */}
      <DashboardBackground />

      {/* Auroras e partículas sutis (decoração da arena) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="arena-aurora not-dark:bg-[color-mix(in_oklab,var(--primary)_7%,transparent)] absolute -top-32 left-[12%] size-[24rem] rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_10%,transparent)] blur-3xl sm:size-[30rem]" />
        <span
          className="arena-aurora not-dark:bg-[color-mix(in_oklab,var(--primary)_5%,transparent)] absolute -right-24 -bottom-32 size-[24rem] rounded-full bg-[color-mix(in_oklab,var(--brand-green)_8%,transparent)] blur-3xl sm:size-[30rem]"
          style={{ animationDelay: "-6s" }}
        />
        <span
          className="arena-twinkle absolute top-[22%] left-[7%]"
          style={{ "--twinkle-dur": "3.6s" } as React.CSSProperties}
        >
          <Star className="text-brand-cyan/30 not-dark:text-primary/25 size-2.5" weight="fill" />
        </span>
        <span
          className="arena-twinkle absolute top-[38%] right-[6%]"
          style={{ "--twinkle-dur": "4.4s", "--twinkle-delay": "0.8s" } as React.CSSProperties}
        >
          <Star className="text-brand-mint/30 size-2 not-dark:text-emerald-500/25" weight="fill" />
        </span>
        <span
          className="arena-twinkle absolute bottom-[18%] left-[14%]"
          style={{ "--twinkle-dur": "4s", "--twinkle-delay": "1.5s" } as React.CSSProperties}
        >
          <Star className="text-brand-green/30 size-2 not-dark:text-primary/25" weight="fill" />
        </span>
      </div>

      {/* Header */}
      <div className="border-border/40 bg-background/60 sticky top-0 z-10 border-b backdrop-blur-2xl">
        <div className="mx-auto max-w-5xl space-y-3 px-3 py-3 sm:space-y-4 sm:px-4 sm:py-4 md:px-6 md:py-5">
          {/* Top row */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold tracking-tight sm:text-xl md:text-2xl">
                <span className="from-foreground to-foreground/70 bg-gradient-to-r bg-clip-text text-transparent">Bem-vindo à </span>
                <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">Clipfy League</span>
              </h1>
              <p className="text-muted-foreground mt-0.5 text-[10px] sm:text-xs md:text-sm">
                Etapa {currentStep} de {STEPS.length}
              </p>
            </div>
            <Badge
              variant="outline"
              className="border-primary/20 bg-primary/5 text-primary shrink-0 px-2 py-0.5 text-[10px] font-semibold tabular-nums sm:px-3 sm:py-1 sm:text-xs"
            >
              {Math.round(progress)}%
            </Badge>
          </div>

          {/* Progress Bar */}
          <div className="bg-muted/40 relative h-1.5 overflow-hidden rounded-full sm:h-2">
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out",
                brandCircle,
              )}
              style={{ width: `${progress}%` }}
            />
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full opacity-50 blur-sm transition-all duration-700 ease-out",
                brandCircle,
              )}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Steps */}
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon
              const isActive = currentStep === step.id
              const isCompleted = currentStep > step.id

              return (
                <div key={step.id} className="flex flex-1 items-center last:flex-none">
                  <div className="relative flex flex-col items-center gap-1 sm:gap-1.5">
                    {/* Anel externo com o degradê da marca */}
                    <div
                      className={cn(
                        "rounded-full p-[2px] transition-all duration-300 sm:p-[2.5px]",
                        isCompleted || isActive
                          ? cn(brandCircle, "shadow-brand-cyan/20 not-dark:shadow-primary/25 shadow-lg")
                          : "bg-muted/50",
                      )}
                    >
                      {/* Glow pulsante atrás do passo ativo */}
                      {isActive && (
                        <div className="from-brand-cyan/25 to-brand-green/25 not-dark:from-primary/20 not-dark:to-primary/20 absolute -inset-1.5 animate-pulse rounded-full bg-gradient-to-r blur-md sm:-inset-2" />
                      )}
                      {/* Círculo interno */}
                      <div
                        className={cn(
                          "relative flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300 sm:h-10 sm:w-10 md:h-11 md:w-11",
                          isCompleted
                            ? cn(brandCircle, onBrand)
                            : isActive
                              ? "bg-background text-brand-cyan not-dark:text-primary"
                              : "bg-background text-muted-foreground/50",
                        )}
                      >
                        {isCompleted ? (
                          <CheckCircle className="h-3.5 w-3.5 sm:h-[18px] sm:w-[18px] md:h-5 md:w-5" weight="fill" />
                        ) : (
                          <StepIcon className="h-3.5 w-3.5 sm:h-[18px] sm:w-[18px] md:h-5 md:w-5" weight={isActive ? "fill" : "regular"} />
                        )}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "text-center text-[9px] leading-tight font-medium transition-colors sm:text-[10px] md:text-xs",
                        isActive ? "text-foreground" : isCompleted ? "text-muted-foreground" : "text-muted-foreground/50",
                      )}
                    >
                      <span className="hidden sm:inline">{step.title}</span>
                      <span className="sm:hidden">{step.id}</span>
                    </span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className="relative mx-1.5 mt-[-0.75rem] h-px flex-1 sm:mx-2.5 sm:mt-[-0.5rem] md:mx-4">
                      <div className="bg-muted/40 absolute inset-0 rounded-full" />
                      <div
                        className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-500", brandCircle)}
                        style={{ width: isCompleted ? "100%" : isActive ? "50%" : "0%" }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 mx-auto max-w-4xl px-3 py-6 sm:px-4 sm:py-8 md:px-6 md:py-12">
        <div className="group/card relative">
          {/* Borda animada com o glow da marca */}
          <div className="onb-border-glow absolute -inset-[1px] rounded-2xl blur-[1px] transition-opacity duration-500 sm:rounded-3xl" />

          {/* Card de vidro */}
          <div className="glass-card rounded-2xl p-4 sm:rounded-3xl sm:p-6 md:p-10">
            {/* Reflexos internos */}
            <div className="pointer-events-none absolute inset-0">
              <div className="bg-brand-cyan/[0.05] not-dark:bg-primary/[0.04] absolute -top-28 -left-28 h-56 w-56 rounded-full blur-[80px]" />
              <div className="bg-brand-green/[0.04] not-dark:bg-primary/[0.03] absolute -right-24 -bottom-24 h-48 w-48 rounded-full blur-[60px]" />
            </div>

            {/* Conteúdo do card */}
            <div className="relative">
              {/* Step Content */}
              {currentStep === 1 && <Step1PersonalInfo data={data} setData={setData} />}
              {currentStep === 2 && <Step2SocialMedia data={data} setData={setData} />}
              {currentStep === 3 && <Step3Terms data={data} setData={setData} />}
              {currentStep === 4 && <Step4Complete user={user} />}

              {/* Navigation Buttons */}
              <div className="border-border/40 mt-6 flex items-center justify-between gap-4 border-t pt-4 sm:mt-8 sm:pt-6">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep === 1 || isSubmitting}
                  aria-label="Voltar para a etapa anterior"
                  className="h-11 gap-2 rounded-xl sm:h-12 sm:px-6"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Voltar</span>
                </Button>

                <Button
                  onClick={handleNext}
                  disabled={isSubmitting || isPixKeyBlocking}
                  aria-describedby={isPixKeyBlocking ? "pixKey-error" : undefined}
                  className="btn-gradient-auth h-11 min-w-28 gap-2 rounded-xl font-semibold shadow-[0_8px_30px_-8px_rgba(20,247,254,0.45)] transition-all hover:shadow-[0_10px_36px_-8px_rgba(55,250,156,0.5)] sm:h-12 sm:min-w-32 sm:px-6"
                >
                  {isSubmitting ? (
                    <>
                      <CircleNotch className="h-4 w-4 animate-spin" />
                      <span className="hidden sm:inline">Salvando...</span>
                    </>
                  ) : currentStep === 4 ? (
                    <>
                      Finalizar
                      <CheckCircle className="h-4 w-4" weight="fill" />
                    </>
                  ) : (
                    <>
                      Próximo
                      <ArrowRight className="h-4 w-4" weight="bold" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Dialog de Confirmação de Redes Sociais */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-2xl">
              <Sparkle className="text-brand-cyan not-dark:text-primary h-6 w-6" weight="fill" />
              Confirme suas Redes Sociais
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Por favor, revise os usernames que você adicionou. Certifique-se de que estão corretos antes de continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-[50vh] space-y-4 overflow-y-auto py-4">
            {confirmPlatforms
              .filter((p) => p.accounts.length > 0)
              .map(({ accounts, label, Icon, cardClass, iconColor, badgeBorder }) => (
                <Card key={label} className={cardClass}>
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Icon className={cn("h-5 w-5", iconColor)} />
                      <h3 className="text-lg font-semibold">{label}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {accounts.map((account, index) => (
                        <Badge key={index} variant="outline" className={cn("gap-1.5", badgeBorder)}>
                          <span className="text-gradient font-semibold not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
                            {account.username}
                          </span>
                          {account.niche && nicheConfig[account.niche] && (
                            <span className="text-xs opacity-80">
                              {nicheConfig[account.niche]!.emoji} {nicheConfig[account.niche]!.label}
                            </span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              Voltar e Editar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSocialMediaAndProceed}
              disabled={isSubmitting}
              className="btn-gradient-auth gap-2 border-0"
            >
              {isSubmitting ? (
                <>
                  <CircleNotch className="h-4 w-4 animate-spin" />
                  Confirmando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" weight="fill" />
                  Confirmar e Continuar
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ============================================================
   STEP COMPONENTS
   ============================================================ */

// Step 1: Personal Information
function Step1PersonalInfo({ data, setData }: {
  data: OnboardingData
  setData: React.Dispatch<React.SetStateAction<OnboardingData>>
}) {
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const maskedValue = applyPhoneMask(e.target.value)
    setData({ ...data, phone: maskedValue })
  }

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const maskedValue = applyCpfMask(e.target.value)
    setData({ ...data, cpf: maskedValue })
  }

  const handlePixKeyTypeChange = (value: string) => {
    const nextType = value as PixKeyType
    setData({
      ...data,
      pixKeyType: nextType,
      // Reaproveita o que já foi digitado, reformatado para o novo tipo
      pixKey: maskPixKey(data.pixKey, nextType),
    })
  }

  const handlePixKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setData({ ...data, pixKey: maskPixKey(e.target.value, data.pixKeyType) })
  }

  const [stateOpen, setStateOpen] = useState(false)
  const selectedState = BRAZILIAN_STATES.find((s) => s.uf === data.state)

  // Validação em tempo real da chave PIX (só depois que o usuário digita algo)
  const pixKeyTouched = data.pixKey.trim().length > 0
  const pixKeyCheck = normalizePixKeyForType(data.pixKey, data.pixKeyType)
  const pixKeyError = pixKeyTouched && !pixKeyCheck.ok ? pixKeyCheck.error : null
  const pixKeyIsValid = pixKeyTouched && pixKeyCheck.ok

  const fieldIcon =
    "text-muted-foreground/60 pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2"

  return (
    <div className="animate-fade-in-up space-y-5 sm:space-y-6">
      <StepHeading icon={User} title="Conte-nos sobre você">
        <p className="text-muted-foreground text-xs sm:text-sm">
          Vamos começar com suas informações básicas
        </p>
      </StepHeading>

      <div className="grid grid-cols-1 gap-3.5 sm:gap-5 md:grid-cols-2">
        <div className="space-y-1.5 sm:space-y-2">
          <Label htmlFor="fullName" className="text-xs font-medium sm:text-sm">
            Nome Completo <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <User className={fieldIcon} />
            <Input
              id="fullName"
              value={data.fullName}
              onChange={(e) => setData({ ...data, fullName: e.target.value })}
              placeholder="Conforme seu documento"
              className={cn(glassInput, "pl-10.5")}
            />
          </div>
          <p className="text-muted-foreground/60 text-[10px] leading-relaxed sm:text-xs">
            Deve ser igual ao que consta no seu CPF ou RG
          </p>
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          <Label htmlFor="artisticName" className="text-xs font-medium sm:text-sm">
            Nome Artístico <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Sparkle className={fieldIcon} />
            <Input
              id="artisticName"
              value={data.artisticName}
              onChange={(e) => setData({ ...data, artisticName: e.target.value })}
              placeholder="Como você quer ser conhecido"
              className={cn(glassInput, "pl-10.5")}
            />
          </div>
          <p className="text-muted-foreground/60 text-[10px] leading-relaxed sm:text-xs">
            Esse é o nome visível para outros clipadores e clientes
          </p>
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          <Label htmlFor="phone" className="text-xs font-medium sm:text-sm">
            Telefone <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Phone className={fieldIcon} />
            <Input
              id="phone"
              type="tel"
              value={data.phone}
              onChange={handlePhoneChange}
              placeholder="(11) 99999-9999"
              maxLength={15}
              className={cn(glassInput, "pl-10.5")}
            />
          </div>
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          <Label htmlFor="cpf" className="text-xs font-medium sm:text-sm">
            CPF <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <IdentificationCard className={fieldIcon} />
            <Input
              id="cpf"
              type="text"
              value={data.cpf}
              onChange={handleCpfChange}
              placeholder="000.000.000-00"
              maxLength={14}
              className={cn(glassInput, "pl-10.5")}
            />
          </div>
        </div>

        <div className="space-y-1.5 sm:space-y-2 md:col-span-2">
          <Label htmlFor="pixKey" className="text-xs font-medium sm:text-sm">
            Chave PIX <span className="text-destructive">*</span>
          </Label>

          <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[9.5rem_1fr]">
            <Select value={data.pixKeyType} onValueChange={handlePixKeyTypeChange}>
              <SelectTrigger
                aria-label="Tipo da chave PIX"
                className={cn(
                  glassInput,
                  "w-full cursor-pointer data-[size=default]:h-11 sm:data-[size=default]:h-12",
                )}
              >
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {PIX_KEY_TYPE_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="cursor-pointer"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative min-w-0">
              <PixLogo className={fieldIcon} />
              <Input
                id="pixKey"
                value={data.pixKey}
                onChange={handlePixKeyChange}
                placeholder={pixKeyPlaceholder(data.pixKeyType)}
                inputMode={PIX_KEY_INPUT_MODE[data.pixKeyType]}
                maxLength={PIX_KEY_MAX_LENGTH[data.pixKeyType]}
                autoComplete="off"
                spellCheck={false}
                aria-label={`Chave PIX do tipo ${pixKeyTypeLabel(data.pixKeyType)}`}
                aria-invalid={!!pixKeyError}
                aria-describedby={pixKeyError ? "pixKey-error" : "pixKey-hint"}
                className={cn(
                  glassInput,
                  "pl-10.5",
                  pixKeyError &&
                    "border-destructive/60 focus-visible:border-destructive/60 focus-visible:ring-destructive/25 not-dark:focus-visible:border-destructive/60 not-dark:focus-visible:ring-destructive/25",
                  pixKeyIsValid && "border-emerald-500/50 pr-10.5",
                )}
              />
              {pixKeyIsValid && (
                <CheckCircle
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 right-3.5 size-4.5 -translate-y-1/2 text-emerald-500"
                  weight="fill"
                />
              )}
            </div>
          </div>

          {pixKeyError ? (
            <p
              id="pixKey-error"
              role="alert"
              className="text-destructive flex items-start gap-1.5 text-[10px] leading-relaxed sm:text-xs"
            >
              <WarningCircle
                aria-hidden
                className="mt-px size-3.5 shrink-0"
                weight="fill"
              />
              <span className="min-w-0">{pixKeyError}</span>
            </p>
          ) : (
            <p
              id="pixKey-hint"
              className="text-muted-foreground/60 text-[10px] leading-relaxed sm:text-xs"
            >
              {PIX_KEY_HINT[data.pixKeyType]}
            </p>
          )}
        </div>
      </div>

      <div className="border-border/40 my-4 border-t sm:my-6" />

      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center gap-2 text-sm font-semibold sm:text-lg">
          <MapPin className="text-brand-cyan not-dark:text-primary h-4 w-4 sm:h-5 sm:w-5" weight="fill" />
          Localização
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3 sm:gap-4">
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="country" className="text-xs font-medium sm:text-sm">
              País <span className="text-destructive">*</span>
            </Label>
            <Input
              id="country"
              value={data.country}
              disabled
              className={cn(glassInput, "cursor-not-allowed opacity-50")}
            />
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <Label className="text-xs font-medium sm:text-sm">
              Estado <span className="text-destructive">*</span>
            </Label>
            <Popover open={stateOpen} onOpenChange={setStateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={stateOpen}
                  className={cn("w-full cursor-pointer justify-between font-normal", glassInput)}
                >
                  {selectedState ? (
                    <span className="truncate">{selectedState.name}</span>
                  ) : (
                    <span className="text-muted-foreground/50">Selecione o estado</span>
                  )}
                  <CaretUpDown className="h-3.5 w-3.5 shrink-0 opacity-50 sm:h-4 sm:w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] rounded-xl p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar estado..." className="h-10" />
                  <CommandList className="max-h-[220px]">
                    <CommandEmpty>Nenhum estado encontrado.</CommandEmpty>
                    <CommandGroup>
                      {BRAZILIAN_STATES.map((s) => (
                        <CommandItem
                          key={s.uf}
                          value={s.name}
                          onSelect={() => {
                            setData({ ...data, state: s.uf })
                            setStateOpen(false)
                          }}
                          className="cursor-pointer"
                        >
                          <span className="flex flex-1 items-center gap-2">
                            <span className="text-muted-foreground w-5 font-mono text-xs">{s.uf}</span>
                            <span className="text-sm">{s.name}</span>
                          </span>
                          {data.state === s.uf && (
                            <Check className="text-primary h-4 w-4 shrink-0" weight="bold" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="city" className="text-xs font-medium sm:text-sm">
              Cidade <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Buildings className={fieldIcon} />
              <Input
                id="city"
                value={data.city}
                onChange={(e) => setData({ ...data, city: e.target.value })}
                placeholder="São Paulo"
                className={cn(glassInput, "pl-10.5")}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Step 2: Social Media
function Step2SocialMedia({ data, setData }: {
  data: OnboardingData
  setData: React.Dispatch<React.SetStateAction<OnboardingData>>
}) {
  const [tempUsernames, setTempUsernames] = useState<Record<string, string>>({})
  const [tempNiches, setTempNiches] = useState<Record<string, string>>({})
  const [nichePopovers, setNichePopovers] = useState<Record<string, boolean>>({})

  type Platform = "instagram" | "tiktok" | "youtube" | "kwai" | "facebook"
  const dataKey = (p: Platform) => `${p}Accounts` as const

  const addSocialAccount = (platform: Platform) => {
    const username = (tempUsernames[platform] || "").trim()
    const niche = tempNiches[platform] || ""
    if (!username) {
      toast.error("Digite o nome de usuário")
      return
    }
    if (!niche) {
      toast.error("Selecione o nicho da conta")
      return
    }
    const key = dataKey(platform)
    const current = data[key]
    setData({ ...data, [key]: [...current, { username, niche }] })
    setTempUsernames((prev) => ({ ...prev, [platform]: "" }))
    setTempNiches((prev) => ({ ...prev, [platform]: "" }))
  }

  const removeSocialAccount = (platform: Platform, index: number) => {
    const key = dataKey(platform)
    const current = data[key]
    setData({ ...data, [key]: current.filter((_, i) => i !== index) })
  }

  const platforms: {
    id: Platform
    label: string
    sublabel: string
    placeholder: string
    Icon: React.ComponentType<{ className?: string }>
    bgColor: string
    iconColor: string
    badgeBorder: string
  }[] = [
    { id: "instagram", label: "Instagram", sublabel: "Adicione suas contas", placeholder: "@seuusuario", Icon: InstagramLogo, bgColor: "bg-pink-500/15", iconColor: "text-pink-400", badgeBorder: "border-pink-500/50" },
    { id: "tiktok", label: "TikTok", sublabel: "Adicione suas contas", placeholder: "@seuusuario", Icon: TikTokIcon, bgColor: "bg-[#f1204a]/15", iconColor: "text-[#f1204a]", badgeBorder: "border-[#f1204a]/50" },
    { id: "youtube", label: "YouTube", sublabel: "Adicione seus canais", placeholder: "@seucanal", Icon: YoutubeLogo, bgColor: "bg-red-500/15", iconColor: "text-red-400", badgeBorder: "border-red-500/50" },
    { id: "kwai", label: "Kwai", sublabel: "Adicione suas contas", placeholder: "@seuusuario", Icon: KwaiIcon, bgColor: "bg-[#ff7705]/15", iconColor: "text-[#ff7705]", badgeBorder: "border-[#ff7705]/50" },
    { id: "facebook", label: "Facebook", sublabel: "Adicione suas contas", placeholder: "@seuusuario", Icon: FacebookIcon, bgColor: "bg-[#1877f2]/15", iconColor: "text-[#1877f2]", badgeBorder: "border-[#1877f2]/50" },
  ]

  return (
    <div className="animate-fade-in-up space-y-5 sm:space-y-6">
      <StepHeading icon={Sparkle} title="Suas Redes Sociais">
        <p className="text-muted-foreground text-xs sm:text-sm">
          Conecte suas contas para mostrar seu alcance <span className="text-destructive">*</span>
        </p>
        <p className="text-muted-foreground mt-1 text-[10px] sm:mt-2 sm:text-xs">
          Adicione pelo menos uma rede social com seu nicho
        </p>
      </StepHeading>

      {platforms.map(({ id, label, sublabel, placeholder, Icon, bgColor, iconColor, badgeBorder }, platformIndex) => {
        const accounts = data[dataKey(id)]
        const selectedNiche = tempNiches[id] || ""
        const isPopoverOpen = nichePopovers[id] || false

        return (
          <div
            key={id}
            className={cn(glassPanel, "animate-fade-in-up space-y-3 p-3 sm:space-y-4 sm:p-5")}
            style={{ animationDelay: `${platformIndex * 70}ms`, animationFillMode: "backwards" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10", bgColor)}>
                  <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5", iconColor)} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold sm:text-base">{label}</h3>
                  <p className="text-muted-foreground text-[10px] sm:text-xs">{sublabel}</p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={cn("shrink-0 text-[10px] sm:text-xs", accounts.length > 0 ? badgeBorder : "border-border/60")}
              >
                {accounts.length} {accounts.length === 1 ? (id === "youtube" ? "canal" : "conta") : (id === "youtube" ? "canais" : "contas")}
              </Badge>
            </div>

            {/* Username input */}
            <div className="space-y-2">
              <Input
                value={tempUsernames[id] || ""}
                onChange={(e) => setTempUsernames((prev) => ({ ...prev, [id]: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && addSocialAccount(id)}
                placeholder={placeholder}
                className={glassInput}
              />

              {/* Niche + Add button row */}
              <div className="flex gap-2">
                <Popover
                  open={isPopoverOpen}
                  onOpenChange={(open) => setNichePopovers((prev) => ({ ...prev, [id]: open }))}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isPopoverOpen}
                      className={cn(glassInput, "flex-1 cursor-pointer justify-between text-xs font-normal sm:text-sm")}
                    >
                      {selectedNiche && nicheConfig[selectedNiche] ? (
                        <span className="flex items-center gap-2 truncate">
                          <span>{nicheConfig[selectedNiche].emoji}</span>
                          <span>{nicheConfig[selectedNiche].label}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Tag className="h-3.5 w-3.5" />
                          <span>Selecione o nicho</span>
                        </span>
                      )}
                      <CaretUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] rounded-xl p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar nicho..." className="h-10" />
                      <CommandList className="max-h-[200px]">
                        <CommandEmpty>Nenhum nicho encontrado.</CommandEmpty>
                        <CommandGroup>
                          {sortedNiches.map(([key, { label: nicheLabel, emoji }]) => (
                            <CommandItem
                              key={key}
                              value={nicheLabel}
                              onSelect={() => {
                                setTempNiches((prev) => ({ ...prev, [id]: key }))
                                setNichePopovers((prev) => ({ ...prev, [id]: false }))
                              }}
                              className="cursor-pointer"
                            >
                              <span className="flex flex-1 items-center gap-2.5">
                                <span className="text-sm">{emoji}</span>
                                <span className="text-sm font-medium">{nicheLabel}</span>
                              </span>
                              {selectedNiche === key && (
                                <Check className="text-primary h-4 w-4 shrink-0" weight="bold" />
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                <Button
                  type="button"
                  onClick={() => addSocialAccount(id)}
                  aria-label={`Adicionar conta de ${label}`}
                  className="btn-gradient-auth h-11 shrink-0 gap-1.5 rounded-xl px-3 text-xs font-semibold sm:h-12 sm:px-4 sm:text-sm"
                  disabled={!(tempUsernames[id] || "").trim() || !selectedNiche}
                >
                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" weight="bold" />
                  <span className="hidden sm:inline">Adicionar</span>
                </Button>
              </div>
            </div>

            {/* Added accounts */}
            {accounts.length > 0 && (
              <div className="border-border/40 flex flex-wrap gap-1.5 border-t pt-3 sm:gap-2">
                {accounts.map((account, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="animate-scale-in border-border/60 gap-1 px-2 py-1 text-[10px] sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs"
                  >
                    <span className="text-gradient font-semibold not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
                      {account.username}
                    </span>
                    {account.niche && nicheConfig[account.niche] && (
                      <span className="text-[10px] opacity-75 sm:text-xs">
                        {nicheConfig[account.niche]!.emoji}
                      </span>
                    )}
                    <button
                      onClick={() => removeSocialAccount(id, index)}
                      className="hover:bg-destructive/20 ml-0.5 rounded-full p-0.5 transition-colors"
                      aria-label={`Remover ${account.username}`}
                    >
                      <X className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Step 3: Terms
function Step3Terms({ data, setData }: {
  data: OnboardingData
  setData: React.Dispatch<React.SetStateAction<OnboardingData>>
}) {
  const checkPanel = cn(glassPanel, "p-3.5 sm:p-5 transition-colors")
  const checkboxCls =
    "mt-0.5 data-[state=checked]:border-transparent data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-brand-cyan data-[state=checked]:to-brand-green not-dark:data-[state=checked]:from-primary not-dark:data-[state=checked]:to-[#0eb981]"
  const termLink =
    "text-primary underline hover:text-primary/80 font-semibold"

  return (
    <div className="animate-fade-in-up space-y-5 sm:space-y-6">
      <StepHeading icon={FileText} title="Termos e Condições">
        <p className="text-muted-foreground text-xs sm:text-sm">
          Leia os{" "}
          <a href="/terms-of-use" target="_blank" rel="noopener noreferrer" className={termLink}>
            Termos de Uso
          </a>
          {" "}e o{" "}
          <a href="/rules" target="_blank" rel="noopener noreferrer" className={termLink}>
            Regulamento
          </a>
          {" "}para continuar
        </p>
      </StepHeading>

      <div className="space-y-3 sm:space-y-4">
        <div className={cn(checkPanel, "border-destructive/25 bg-destructive/[0.04]")}>
          <div className="flex items-start gap-3 sm:gap-4">
            <Checkbox id="isOver18" checked={data.isOver18} onCheckedChange={(checked) => setData({ ...data, isOver18: checked as boolean })} className={checkboxCls} />
            <Label htmlFor="isOver18" className="cursor-pointer text-xs font-semibold sm:text-sm">
              Confirmo que sou maior de 18 anos <span className="text-destructive">*</span>
            </Label>
          </div>
        </div>

        <div className={checkPanel}>
          <div className="flex items-start gap-3 sm:gap-4">
            <Checkbox id="agreeToTerms" checked={data.agreeToTerms} onCheckedChange={(checked) => setData({ ...data, agreeToTerms: checked as boolean })} className={checkboxCls} />
            <div className="space-y-0.5 sm:space-y-1">
              <Label htmlFor="agreeToTerms" className="cursor-pointer text-xs font-semibold sm:text-sm">
                Aceito os Termos de Uso <span className="text-destructive">*</span>
              </Label>
              <p className="text-muted-foreground text-[10px] sm:text-xs">
                Li e concordo com os{" "}
                <a href="/terms-of-use" target="_blank" rel="noopener noreferrer" className={termLink}>termos de uso</a>{" "}
                da plataforma
              </p>
            </div>
          </div>
        </div>

        <div className={checkPanel}>
          <div className="flex items-start gap-3 sm:gap-4">
            <Checkbox id="agreeToCompliance" checked={data.agreeToCompliance} onCheckedChange={(checked) => setData({ ...data, agreeToCompliance: checked as boolean })} className={checkboxCls} />
            <div className="space-y-0.5 sm:space-y-1">
              <Label htmlFor="agreeToCompliance" className="cursor-pointer text-xs font-semibold sm:text-sm">
                Comprometo-me a seguir as regras <span className="text-destructive">*</span>
              </Label>
              <p className="text-muted-foreground text-[10px] sm:text-xs">
                Concordo em seguir todas as diretrizes e{" "}
                <a href="/rules" target="_blank" rel="noopener noreferrer" className={termLink}>regras das competições</a>
              </p>
            </div>
          </div>
        </div>

        <div className={checkPanel}>
          <div className="flex items-start gap-3 sm:gap-4">
            <Checkbox id="agreeToPublicProfile" checked={data.agreeToPublicProfile} onCheckedChange={(checked) => setData({ ...data, agreeToPublicProfile: checked as boolean })} className={checkboxCls} />
            <div className="space-y-0.5 sm:space-y-1">
              <Label htmlFor="agreeToPublicProfile" className="cursor-pointer text-xs font-semibold sm:text-sm">
                Perfil Público <span className="text-destructive">*</span>
              </Label>
              <p className="text-muted-foreground text-[10px] sm:text-xs">Autorizo que meu perfil e trabalhos sejam exibidos publicamente</p>
            </div>
          </div>
        </div>

        <div className={checkPanel}>
          <div className="flex items-start gap-3 sm:gap-4">
            <Checkbox id="agreeToDataProcessing" checked={data.agreeToDataProcessing} onCheckedChange={(checked) => setData({ ...data, agreeToDataProcessing: checked as boolean })} className={checkboxCls} />
            <div className="space-y-0.5 sm:space-y-1">
              <Label htmlFor="agreeToDataProcessing" className="cursor-pointer text-xs font-semibold sm:text-sm">
                Processamento de Dados <span className="text-destructive">*</span>
              </Label>
              <p className="text-muted-foreground text-[10px] sm:text-xs">Concordo com o processamento dos meus dados conforme a política de privacidade</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Step 4: Complete
function Step4Complete({ user }: { user: ClerkUser }) {
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [profileImageUrl, setProfileImageUrl] = useState(user?.imageUrl || "")

  // Mutation para atualizar imageUrl no banco
  const updateProfileImage = api.user.updateProfileImage.useMutation()

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    // Validar tamanho do arquivo (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB")
      return
    }

    // Validar tipo de arquivo
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem válida")
      return
    }

    setIsUploadingImage(true)

    try {
      // 1. Upload para o Clerk
      await user.setProfileImage({ file })

      // 2. Esperar um pouco para garantir que o Clerk processou
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // 3. Recarregar dados do usuário para pegar a nova imageUrl
      await user.reload()

      // 4. Atualizar a URL da imagem localmente
      setProfileImageUrl(URL.createObjectURL(file))

      // 5. Salvar a imageUrl no banco de dados
      if (user.imageUrl) {
        await updateProfileImage.mutateAsync({ imageUrl: user.imageUrl })
      }

      toast.success("Foto de perfil atualizada com sucesso!")
    } catch (error) {
      console.error("Erro ao fazer upload da imagem:", error)
      toast.error("Erro ao fazer upload da imagem. Tente novamente.")
    } finally {
      setIsUploadingImage(false)
    }
  }

  const nextSteps: {
    icon: PhosphorIcon
    title: string
    description: string
    iconBg: string
    iconColor: string
  }[] = [
    { icon: Sparkle, title: "Explore", description: "Competições disponíveis", iconBg: "bg-brand-cyan/15 not-dark:bg-primary/10", iconColor: "text-brand-cyan not-dark:text-primary" },
    { icon: Medal, title: "Participe", description: "Envie seus vídeos", iconBg: "bg-brand-mint/15 not-dark:bg-emerald-500/10", iconColor: "text-brand-mint not-dark:text-emerald-600" },
    { icon: Heart, title: "Conquiste", description: "Topo do ranking", iconBg: "bg-brand-green/15 not-dark:bg-[#0eb981]/10", iconColor: "text-brand-green not-dark:text-[#0eb981]" },
  ]

  return (
    <div className="animate-fade-in-up space-y-5 sm:space-y-6">
      <div className="text-center">
        <div className="relative mb-4 inline-flex sm:mb-6">
          <span
            aria-hidden
            className="from-brand-cyan/25 to-brand-green/25 not-dark:from-primary/20 not-dark:to-primary/10 absolute -inset-2 animate-pulse rounded-full bg-gradient-to-r blur-xl"
          />
          <span
            className={cn(
              "shadow-brand-cyan/25 not-dark:shadow-primary/25 relative inline-flex h-14 w-14 animate-bounce items-center justify-center rounded-full shadow-lg sm:h-20 sm:w-20",
              brandCircle,
            )}
          >
            <CheckCircle className={cn("h-7 w-7 sm:h-10 sm:w-10", onBrand)} weight="fill" />
          </span>
        </div>
        <h2 className="mb-2 text-2xl font-bold sm:mb-4 sm:text-3xl md:text-4xl">
          Quase Lá!
        </h2>
        <p className="text-muted-foreground mx-auto mb-2 max-w-2xl text-sm sm:mb-4 sm:text-base">
          Seu perfil foi criado com sucesso! Falta apenas um passo.
        </p>
        <p className="text-muted-foreground mx-auto max-w-2xl text-xs sm:text-sm">
          Entre no nosso Discord e preencha seu username abaixo para finalizar.
        </p>
      </div>

      {/* Discord */}
      <div className={cn(glassPanel, "border-[#5865F2]/25 bg-[#5865F2]/[0.06] p-4 sm:p-6")}>
        <div className="space-y-4 sm:space-y-5">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#5865F2]/20 sm:h-12 sm:w-12 sm:rounded-xl">
              <DiscordIcon className="h-4 w-4 text-[#5865F2] sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold sm:text-xl">Entre no nosso Discord</h3>
              <p className="text-muted-foreground mt-0.5 text-[10px] sm:mt-1 sm:text-sm">
                A comunidade do Discord é essencial para participar
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-500/15 bg-amber-500/5 p-2.5 sm:p-3">
            <span className="mt-0.5 shrink-0 text-xs text-amber-500 sm:text-base">⚠️</span>
            <p className="text-muted-foreground text-[10px] sm:text-sm">
              <strong className="text-foreground">Importante:</strong> Você deve estar no servidor do Discord para receber avisos e premiações.
            </p>
          </div>

          <div className="text-center">
            <a
              href="https://discord.gg/f2eNVbYnzn"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#5865F2] px-4 py-2.5 text-xs font-semibold text-white transition-all hover:scale-[1.02] hover:bg-[#4752C4] hover:shadow-lg hover:shadow-[#5865F2]/30 sm:px-6 sm:py-3 sm:text-sm"
            >
              <DiscordIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">Entrar no Discord da Clipfy League</span>
              <span className="sm:hidden">Entrar no Discord</span>
              <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" weight="bold" />
            </a>
          </div>
        </div>
      </div>

      {/* Upload de Foto de Perfil */}
      <div className={cn(glassPanel, "p-4 sm:p-6")}>
        <div className="space-y-4 sm:space-y-6">
          <div className="text-center">
            <h3 className="mb-1 text-sm font-semibold sm:mb-2 sm:text-xl">Foto de Perfil</h3>
            <p className="text-muted-foreground text-[10px] sm:text-sm">
              Adicione uma foto para personalizar seu perfil (opcional)
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 sm:gap-4">
            <div className="relative">
              <div className="border-border/60 bg-card/40 h-24 w-24 overflow-hidden rounded-full border-2 sm:h-32 sm:w-32 sm:border-4">
                {profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profileImageUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <User className="text-muted-foreground/40 h-10 w-10 sm:h-16 sm:w-16" />
                  </div>
                )}
              </div>
              <label
                htmlFor="profile-image-upload"
                className={cn(
                  "absolute right-0 bottom-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110 sm:h-10 sm:w-10",
                  brandCircle,
                )}
              >
                {isUploadingImage ? (
                  <CircleNotch className={cn("h-4 w-4 animate-spin sm:h-5 sm:w-5", onBrand)} />
                ) : (
                  <Camera className={cn("h-4 w-4 sm:h-5 sm:w-5", onBrand)} weight="fill" />
                )}
              </label>
              <input id="profile-image-upload" type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploadingImage} className="hidden" />
            </div>

            <div className="text-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("profile-image-upload")?.click()}
                disabled={isUploadingImage}
                className="gap-2 rounded-xl text-xs sm:text-sm"
              >
                <UploadSimple className="h-3.5 w-3.5 sm:h-4 sm:w-4" weight="bold" />
                {profileImageUrl ? "Alterar Foto" : "Adicionar Foto"}
              </Button>
              <p className="text-muted-foreground mt-1.5 text-[10px] sm:mt-2 sm:text-xs">JPG, PNG ou GIF (máx. 5MB)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Próximos Passos */}
      <div className={cn(glassPanel, "p-4 sm:p-6")}>
        <div className="space-y-4 sm:space-y-6">
          <h3 className="text-center text-sm font-semibold sm:text-xl">Próximos Passos</h3>

          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {nextSteps.map((step, index) => {
              const NextStepIcon = step.icon
              return (
                <div
                  key={step.title}
                  className="animate-fade-in-up p-2 text-center sm:p-4"
                  style={{ animationDelay: `${index * 100}ms`, animationFillMode: "backwards" }}
                >
                  <div className={cn("mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full sm:mb-3 sm:h-12 sm:w-12", step.iconBg)}>
                    <NextStepIcon className={cn("h-4 w-4 sm:h-6 sm:w-6", step.iconColor)} weight="fill" />
                  </div>
                  <h4 className="mb-0.5 text-[10px] font-semibold sm:mb-1 sm:text-sm">{step.title}</h4>
                  <p className="text-muted-foreground text-[9px] sm:text-xs">{step.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
