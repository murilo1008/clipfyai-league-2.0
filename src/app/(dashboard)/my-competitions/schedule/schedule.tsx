"use client"

import * as React from "react"
import Image from "next/image"
import {
  ArrowRight,
  BellRinging,
  CalendarBlank,
  CaretUpDown,
  Check,
  CheckCircle,
  CircleNotch,
  Clock,
  Coins,
  Crown,
  Eye,
  Funnel,
  Gift,
  Hash,
  Lightning,
  LinkSimple,
  MagnifyingGlass,
  Medal,
  Notebook,
  Plus,
  Sparkle,
  Target,
  Timer,
  Trophy,
  UsersThree,
  Warning,
  X,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { ClipfyProPricingDialog } from "@/components/clippers/clipfy-pro-pricing-dialog"
import { HomeHero } from "@/components/home/home-hero"
import { StatTile } from "@/components/home/stat-tile"
import { ScheduleHeroViz, ScheduleHeroVizSkeleton } from "@/components/my-competitions/schedule-hero-viz"
import { formatCompact } from "@/components/shared/count-up"
import { Reveal } from "@/components/shared/reveal"
import {
  Bone,
  CardGridSkeleton,
  HeroSkeleton,
  StatTilesGridSkeleton,
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

type ScheduledCompetition = RouterOutputs["campaign"]["getScheduled"][number]
type AddSocialAccountInput = RouterInputs["clipper"]["addSocialAccount"]

const nicheConfig: Record<string, { label: string; emoji: string }> = {
  MOTIVATIONAL: { label: "Motivacional", emoji: "💪" }, GOSSIP: { label: "Fofoca", emoji: "🗣️" }, MEME: { label: "Meme", emoji: "😂" }, ENTREPRENEURSHIP: { label: "Empreendedorismo", emoji: "🚀" }, HUMOR: { label: "Humor", emoji: "🤣" }, GAMING: { label: "Gaming", emoji: "🎮" }, SPORTS: { label: "Esportes", emoji: "⚽" }, MUSIC: { label: "Música", emoji: "🎵" }, EDUCATION: { label: "Educação", emoji: "📚" }, NEWS: { label: "Notícias", emoji: "📰" }, POLITICS: { label: "Política", emoji: "🏛️" }, LIFESTYLE: { label: "Lifestyle", emoji: "✨" }, FITNESS: { label: "Fitness", emoji: "🏋️" }, FASHION: { label: "Moda", emoji: "👗" }, BEAUTY: { label: "Beleza", emoji: "💄" }, FOOD: { label: "Comida", emoji: "🍕" }, TRAVEL: { label: "Viagem", emoji: "✈️" }, TECH: { label: "Tecnologia", emoji: "💻" }, FINANCE: { label: "Finanças", emoji: "💰" }, RELIGION: { label: "Religião", emoji: "🙏" }, ENTERTAINMENT: { label: "Entretenimento", emoji: "🎬" }, HOT: { label: "Hot", emoji: "🔥" }, FAMILY: { label: "Família", emoji: "👨‍👩‍👧‍👦" }, MATERNITY: { label: "Maternidade", emoji: "🤱" }, PATERNITY: { label: "Paternidade", emoji: "👨‍👧" }, MARRIAGE: { label: "Casamento", emoji: "💍" }, BODYBUILDING: { label: "Maromba", emoji: "💪🏋️" }, WOMEN: { label: "Mulher", emoji: "👩" }, MEN: { label: "Homem", emoji: "👨" }, COUPLE: { label: "Casal", emoji: "💑" }, PETS: { label: "Pets", emoji: "🐾" }, CARS: { label: "Carros", emoji: "🚗" }, MOTORCYCLES: { label: "Motos", emoji: "🏍️" }, ANIME: { label: "Anime", emoji: "🎌" }, KPOP: { label: "K-Pop", emoji: "🇰🇷" }, DANCE: { label: "Dança", emoji: "💃" }, COMEDY: { label: "Comédia", emoji: "😆" }, DRAMA: { label: "Drama", emoji: "🎭" }, ASTROLOGY: { label: "Astrologia", emoji: "♈" }, PSYCHOLOGY: { label: "Psicologia", emoji: "🧠" }, SELF_HELP: { label: "Autoajuda", emoji: "📖" }, PRODUCTIVITY: { label: "Produtividade", emoji: "⏱️" }, MARKETING: { label: "Marketing", emoji: "📢" }, SALES: { label: "Vendas", emoji: "🛒" }, REAL_ESTATE: { label: "Imobiliário", emoji: "🏠" }, CRYPTO: { label: "Cripto", emoji: "₿" }, INVESTING: { label: "Investimentos", emoji: "📈" }, DIY: { label: "Faça Você Mesmo", emoji: "🔨" }, ART: { label: "Arte", emoji: "🎨" }, PHOTOGRAPHY: { label: "Fotografia", emoji: "📷" }, CINEMA: { label: "Cinema", emoji: "🎥" }, SERIES: { label: "Séries", emoji: "📺" }, BOOKS: { label: "Livros", emoji: "📚" }, PODCAST: { label: "Podcast", emoji: "🎙️" }, NATURE: { label: "Natureza", emoji: "🌿" }, HEALTH: { label: "Saúde", emoji: "🏥" }, MENTAL_HEALTH: { label: "Saúde Mental", emoji: "🧘" }, NUTRITION: { label: "Nutrição", emoji: "🥗" }, COOKING: { label: "Culinária", emoji: "👨‍🍳" }, DECORATION: { label: "Decoração", emoji: "🏡" }, PARENTING: { label: "Parentalidade", emoji: "👪" }, BABY: { label: "Bebê", emoji: "👶" }, KIDS: { label: "Crianças", emoji: "🧒" }, UNIVERSITY: { label: "Universidade", emoji: "🎓" }, LAW: { label: "Direito", emoji: "⚖️" }, MEDICINE: { label: "Medicina", emoji: "🩺" }, SCIENCE: { label: "Ciência", emoji: "🔬" }, YOGA: { label: "Yoga", emoji: "🧘‍♀️" }, RUNNING: { label: "Corrida", emoji: "🏃" }, MARTIAL_ARTS: { label: "Artes Marciais", emoji: "🥋" }, SOCCER: { label: "Futebol", emoji: "⚽" }, ESPORTS: { label: "E-Sports", emoji: "🕹️" }, STREAMER: { label: "Streamer", emoji: "📡" }, COSPLAY: { label: "Cosplay", emoji: "🎭" }, TATTOO: { label: "Tatuagem", emoji: "💉" }, NAILS: { label: "Unhas", emoji: "💅" }, HAIR: { label: "Cabelo", emoji: "💇" }, SKINCARE: { label: "Skincare", emoji: "🧴" }, MAKEUP: { label: "Maquiagem", emoji: "💄" }, LUXURY: { label: "Luxo", emoji: "👑" }, STREETWEAR: { label: "Streetwear", emoji: "🧢" }, WEDDING: { label: "Casamentos", emoji: "👰" }, PARTY: { label: "Festas", emoji: "🎉" }, FUNK: { label: "Funk", emoji: "🎶" }, SERTANEJO: { label: "Sertanejo", emoji: "🤠" }, RAP: { label: "Rap", emoji: "🎤" }, ROCK: { label: "Rock", emoji: "🎸" }, GOSPEL: { label: "Gospel", emoji: "✝️" }, LGBTQ: { label: "LGBTQ+", emoji: "🏳️‍🌈" }, ACTIVISM: { label: "Ativismo", emoji: "✊" }, SPIRITUAL: { label: "Espiritualidade", emoji: "🕊️" }, TAROT: { label: "Tarot", emoji: "🃏" }, TRUE_CRIME: { label: "True Crime", emoji: "🔍" }, HORROR: { label: "Terror", emoji: "👻" }, CHALLENGES: { label: "Desafios", emoji: "🏆" }, PRANKS: { label: "Pegadinhas", emoji: "😜" }, REACTIONS: { label: "Reações", emoji: "😱" }, UNBOXING: { label: "Unboxing", emoji: "📦" }, REVIEWS: { label: "Reviews", emoji: "⭐" }, TUTORIALS: { label: "Tutoriais", emoji: "📝" }, TIPS: { label: "Dicas", emoji: "💡" }, STORYTIME: { label: "Storytime", emoji: "📖" }, RELATIONSHIPS: { label: "Relacionamentos", emoji: "❤️‍🔥" }, DATING: { label: "Paquera", emoji: "💘" }, THERAPY: { label: "Terapia", emoji: "🛋️" }, OTHER: { label: "Outro", emoji: "📌" },
}

const sortedNiches = Object.entries(nicheConfig).sort((a, b) =>
  a[1].label.localeCompare(b[1].label, "pt-BR"),
)

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

const getDurationDays = (competition: ScheduledCompetition) =>
  Math.ceil(
    (new Date(competition.endDate).getTime() -
      new Date(competition.startDate).getTime()) /
      (1000 * 60 * 60 * 24),
  )

/** Cores da faixa de cronograma da capa: ≤7d vermelho, ≤30d âmbar, senão azul. */
const getTimelineChip = (daysUntil: number) => {
  if (daysUntil <= 7)
    return {
      box: "border-red-500/40 bg-red-500/15",
      text: "text-red-500 dark:text-red-400",
    }
  if (daysUntil <= 30)
    return {
      box: "border-amber-500/40 bg-amber-500/15",
      text: "text-amber-500 dark:text-amber-400",
    }
  return {
    box: "border-sky-500/40 bg-sky-500/15",
    text: "text-sky-500 dark:text-sky-400",
  }
}

export default function Schedule() {
  const { maskText, maskBRL } = useMaskedCurrency()

  const [searchQuery, setSearchQuery] = React.useState("")
  const [platformFilter, setPlatformFilter] = React.useState("all")
  const [registrationFilter, setRegistrationFilter] = React.useState("all")
  const [selectedCompetition, setSelectedCompetition] =
    React.useState<ScheduledCompetition | null>(null)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isProDialogOpen, setIsProDialogOpen] = React.useState(false)
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

  // ===== Queries =====
  const { data: userData } = api.user.getCurrentUser.useQuery()
  const isProSubscriber = userData?.subscriptionStatus === "ACTIVE"

  const {
    data: competitions = [],
    isLoading: isLoadingCompetitions,
    refetch: refetchCompetitions,
  } = api.campaign.getScheduled.useQuery()

  const {
    data: socialAccounts = [],
    isLoading: isLoadingSocialAccounts,
    refetch: refetchSocialAccounts,
  } = api.clipper.getMySocialAccounts.useQuery()

  const {
    data: myApplications = [],
    isLoading: isLoadingApplications,
    refetch: refetchApplications,
  } = api.clipper.getMyApplications.useQuery()

  const { data: prizesData, isLoading: isLoadingPrizes } =
    api.campaign.getCampaignPrizes.useQuery(
      { campaignId: selectedPrizeCompetitionId ?? "" },
      { enabled: !!selectedPrizeCompetitionId && isPrizesDialogOpen },
    )

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
      void refetchSocialAccounts()
    },
    onError: (error) => {
      toast.error("Erro ao adicionar conta", {
        description: error.message,
      })
    },
  })

  // ===== Handlers =====
  const openDetailsDialog = (competition: ScheduledCompetition) => {
    setSelectedCompetition(competition)
    setIsDialogOpen(true)
  }

  const openEnrollDialog = (competition: ScheduledCompetition) => {
    // Competição exclusiva PRO sem assinatura ativa → abre o dialog do PRO
    if (competition.isProOnly && !isProSubscriber) {
      setIsDialogOpen(false)
      setIsProDialogOpen(true)
      return
    }
    setSelectedCompetition(competition)
    setSelectedAccounts([])
    setIsDialogOpen(false)
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
      // Validar se o link foi preenchido
      if (!newAccountFacebookUrl.trim()) {
        toast.error("Link do perfil obrigatório", {
          description:
            "Para Facebook, você deve informar o link completo do perfil com /reels no final",
        })
        return
      }

      // Validar se começa com http:// ou https://
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

      // Validar se o link é do Facebook
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

      // Validar se está em um dos formatos aceitos
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

    // Limpar campos após adicionar
    setNewAccountUsername("")
    setNewAccountFacebookUrl("")
  }

  // ===== Status de inscrição =====
  const getApplicationStatus = (campaignId: string) =>
    myApplications.find((app) => app.campaignId === campaignId)

  const getEnrollmentButtonConfig = (campaignId: string) => {
    const application = getApplicationStatus(campaignId)

    if (!application) {
      return {
        label: "Inscrever-se Agora",
        icon: Lightning,
        iconWeight: "fill" as const,
        disabled: false,
      }
    }

    switch (application.status) {
      case "APPROVED":
        return {
          label: "Inscrito e Aprovado",
          icon: CheckCircle,
          iconWeight: "fill" as const,
          disabled: true,
        }
      case "PENDING":
      case "UNDER_REVIEW":
        return {
          label: "Aguardando Aprovação",
          icon: Clock,
          iconWeight: "fill" as const,
          disabled: true,
        }
      case "REJECTED":
        return {
          label: "Inscrição Rejeitada",
          icon: X,
          iconWeight: "bold" as const,
          disabled: true,
        }
      default:
        return {
          label: "Inscrever-se Agora",
          icon: Lightning,
          iconWeight: "fill" as const,
          disabled: false,
        }
    }
  }

  // ===== Filtros =====
  const filteredCompetitions = competitions.filter((competition) => {
    const query = searchQuery.toLowerCase()
    const matchesSearch =
      competition.name.toLowerCase().includes(query) ||
      (competition.description ?? "").toLowerCase().includes(query)
    const matchesPlatform =
      platformFilter === "all" ||
      (competition.platforms as string[]).includes(platformFilter)
    const matchesRegistration =
      registrationFilter === "all" ||
      (registrationFilter === "open" && competition.registrationOpen) ||
      (registrationFilter === "closed" && !competition.registrationOpen)
    return matchesSearch && matchesPlatform && matchesRegistration
  })

  // ===== Estatísticas =====
  const totalCompetitions = competitions.length
  const openRegistrations = competitions.filter(
    (c) => c.registrationOpen,
  ).length
  const totalPrizes = competitions.reduce((sum, c) => {
    const prizeStr = String(c.prize || "R$ 0")
    const value = parseFloat(prizeStr.replace(/[^\d,]/g, "").replace(",", "."))
    return sum + (isNaN(value) ? 0 : value)
  }, 0)
  const estimatedTotal = competitions.reduce(
    (sum, c) => sum + (c.estimatedParticipants || 0),
    0,
  )

  // ===== Contexto dos dialogs =====
  const isProLocked = (competition: ScheduledCompetition | null) =>
    !!competition?.isProOnly && !isProSubscriber

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

  // ===== Skeleton do kit espelhando o layout =====
  if (isLoadingCompetitions || isLoadingSocialAccounts || isLoadingApplications) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
        <HeroSkeleton stats={3} viz={<ScheduleHeroVizSkeleton />} />
        <StatTilesGridSkeleton count={4} />
        <ToolbarSkeleton buttons={2} />
        <CardGridSkeleton
          count={4}
          aspectClass="aspect-video"
          gridClass="grid-cols-1 lg:grid-cols-2"
          withStats
        />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero do cronograma ===== */}
      <HomeHero
        eyebrow="Clipfy League · Cronograma"
        title={
          <>
            Próximas <span className="text-gradient">batalhas</span>
          </>
        }
        subtitle="Veja as competições que estão por vir, garanta sua vaga com antecedência e não perca nenhuma oportunidade de premiação."
        viz={<ScheduleHeroViz />}
        vizSkeleton={<ScheduleHeroVizSkeleton />}
        stats={[
          {
            icon: <CalendarBlank className="size-3.5" weight="fill" />,
            label: "Agendadas",
            value: totalCompetitions,
            kind: "int",
          },
          {
            icon: <Lightning className="size-3.5" weight="fill" />,
            label: "Abertas",
            value: openRegistrations,
            kind: "int",
          },
          {
            icon: <Trophy className="size-3.5" weight="fill" />,
            label: "Em prêmios",
            value: totalPrizes,
            kind: "compactBRL",
          },
        ]}
      />

      {/* ===== KPIs ===== */}
      <Reveal immediate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<CalendarBlank className="size-4" weight="fill" />}
            label="Próximas Competições"
            value={totalCompetitions}
            kind="int"
            hint="agendadas"
            accent="cyan"
          />
          <StatTile
            icon={<Lightning className="size-4" weight="fill" />}
            label="Inscrições Abertas"
            value={openRegistrations}
            kind="int"
            hint="disponíveis agora"
            accent="green"
          />
          <StatTile
            icon={<Trophy className="size-4" weight="fill" />}
            label="Total em Prêmios"
            value={totalPrizes}
            kind="brl"
            hint="a distribuir"
            accent="gradient"
            gradientValue
          />
          <StatTile
            icon={<UsersThree className="size-4" weight="fill" />}
            label="Participantes Estimados"
            value={estimatedTotal}
            kind="int"
            hint="total esperado"
            accent="cyan"
          />
        </div>
      </Reveal>

      {/* ===== Toolbar: busca + plataforma + inscrições ===== */}
      <Reveal immediate delayMs={60}>
        <div className="glass-card flex flex-col gap-3 rounded-3xl p-3.5 sm:p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar competições..."
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

          <div className="grid grid-cols-2 items-center gap-2.5 sm:flex sm:flex-wrap">
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl sm:w-[190px]">
                <span className="flex min-w-0 items-center gap-2">
                  <Funnel className="text-muted-foreground size-4 shrink-0" />
                  <SelectValue placeholder="Plataforma" />
                </span>
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Todas Plataformas</SelectItem>
                {(Object.keys(platformConfig) as PlatformKey[]).map(
                  (platform) => {
                    const config = platformConfig[platform]
                    const PlatformIcon = config.icon
                    return (
                      <SelectItem key={platform} value={platform}>
                        <span className="flex items-center gap-2">
                          <PlatformIcon
                            className={cn("size-3.5", config.color)}
                          />
                          {config.label}
                        </span>
                      </SelectItem>
                    )
                  },
                )}
              </SelectContent>
            </Select>

            <Select
              value={registrationFilter}
              onValueChange={setRegistrationFilter}
            >
              <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl sm:w-[160px]">
                <span className="flex min-w-0 items-center gap-2">
                  <Funnel className="text-muted-foreground size-4 shrink-0" />
                  <SelectValue placeholder="Inscrições" />
                </span>
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="open">Abertas</SelectItem>
                <SelectItem value="closed">Em Breve</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Reveal>

      {/* ===== Grid de competições ===== */}
      {filteredCompetitions.length === 0 ? (
        <Reveal immediate>
          <div className="glass-card flex flex-col items-center gap-4 rounded-3xl py-16 text-center">
            <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
              <CalendarBlank className="size-6" weight="fill" />
            </span>
            <div className="px-4">
              <p className="text-base font-bold">
                Nenhuma competição agendada
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {searchQuery
                  ? "Tente ajustar seus filtros de busca"
                  : "Novas competições serão anunciadas em breve"}
              </p>
            </div>
          </div>
        </Reveal>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredCompetitions.map((competition, index) => {
            const daysUntil = getDaysUntilStart(competition.startDate)
            const timeline = getTimelineChip(daysUntil)
            const buttonConfig = getEnrollmentButtonConfig(competition.id)
            const ButtonIcon = buttonConfig.icon
            const locked = isProLocked(competition)

            return (
              <Reveal
                immediate
                key={competition.id}
                delayMs={(index % 2) * 80}
              >
                <article className="glass-card glass-card-hover group flex h-full flex-col overflow-hidden rounded-3xl">
                  {/* Capa */}
                  <div className="relative aspect-video w-full overflow-hidden">
                    <Image
                      src={competition.coverImageUrl}
                      alt={competition.name}
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      priority={index === 0}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/25" />

                    {/* Badges topo */}
                    <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "gap-1.5 rounded-full backdrop-blur-md",
                          competition.registrationOpen
                            ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                            : "border-amber-500/40 bg-amber-500/20 text-amber-300",
                        )}
                      >
                        <span
                          className={cn(
                            "size-1.5 animate-pulse rounded-full",
                            competition.registrationOpen
                              ? "bg-emerald-400"
                              : "bg-amber-400",
                          )}
                        />
                        {competition.registrationOpen
                          ? "Inscrições Abertas"
                          : "Em Breve"}
                      </Badge>
                      {competition.isProOnly && (
                        <Badge className="gap-1 rounded-full border-amber-400/50 bg-gradient-to-r from-amber-400 to-yellow-500 font-black text-[#3b2a00] shadow-lg shadow-amber-500/30">
                          <Crown className="size-3" weight="fill" />
                          PRO
                        </Badge>
                      )}
                    </div>

                    {/* Rodapé da capa: cronograma */}
                    <div className="absolute inset-x-3 bottom-3">
                      {daysUntil <= 0 ? (
                        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 backdrop-blur-md">
                          <Lightning
                            className="size-4 shrink-0 text-emerald-400"
                            weight="fill"
                          />
                          <span className="text-xs font-bold text-emerald-400 sm:text-sm">
                            Em andamento
                          </span>
                        </div>
                      ) : (
                        <div
                          className={cn(
                            "flex items-center gap-2 rounded-xl border px-3 py-2 backdrop-blur-md",
                            timeline.box,
                          )}
                        >
                          <Timer
                            className={cn("size-4 shrink-0", timeline.text)}
                            weight="fill"
                          />
                          <span
                            className={cn(
                              "text-xs font-bold sm:text-sm",
                              timeline.text,
                            )}
                          >
                            Começa em {daysUntil}{" "}
                            {daysUntil === 1 ? "dia" : "dias"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Corpo */}
                  <div className="flex flex-1 flex-col gap-3.5 p-4 sm:p-5">
                    <div>
                      <h3 className="text-[15px] font-bold tracking-tight sm:text-base">
                        {competition.name}
                      </h3>
                      {competition.description && (
                        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed sm:text-[13px]">
                          {competition.description}
                        </p>
                      )}
                    </div>

                    {/* Plataformas */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {competition.platforms.map((platform) => {
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

                    {/* Stats 4 colunas */}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <CardStat
                        icon={<CalendarBlank className="size-3" weight="fill" />}
                        label="Início"
                        value={formatDateShort(competition.startDate)}
                        valueClass="text-brand-cyan not-dark:text-primary"
                      />
                      <CardStat
                        icon={<UsersThree className="size-3" weight="fill" />}
                        label="Estimativa"
                        value={String(competition.estimatedParticipants)}
                        valueClass="text-sky-600 dark:text-sky-400"
                      />
                      <CardStat
                        icon={<Trophy className="size-3" weight="fill" />}
                        label="Prêmio"
                        value={maskText(formatPrizeLabel(String(competition.prize)))}
                        valueClass={cn(
                          "text-amber-600 dark:text-amber-400",
                          locked && "blur-sm select-none",
                        )}
                      />
                      <CardStat
                        icon={<Clock className="size-3" weight="fill" />}
                        label="Duração"
                        value={`${getDurationDays(competition)} dias`}
                        valueClass="text-emerald-600 dark:text-emerald-400"
                      />
                    </div>

                    {/* Faixa de datas */}
                    <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                      <CalendarBlank className="size-3.5 shrink-0" />
                      <span className="min-w-0 truncate">
                        {formatDate(competition.startDate)} até{" "}
                        {formatDate(competition.endDate)}
                      </span>
                    </p>

                    {/* Hashtags (todas) */}
                    {competition.requiredHashtags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {competition.requiredHashtags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="border-brand-cyan/25 text-brand-cyan not-dark:border-primary/30 not-dark:text-primary gap-0.5 rounded-full text-[10px]"
                          >
                            <Hash className="size-2.5" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Ações */}
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                      {competition.registrationOpen ? (
                        <Button
                          className={cn(
                            "h-10 flex-1 basis-full cursor-pointer rounded-xl font-semibold sm:basis-auto",
                            !buttonConfig.disabled && "btn-gradient-auth",
                          )}
                          variant={
                            buttonConfig.disabled ? "outline" : "default"
                          }
                          disabled={buttonConfig.disabled}
                          onClick={() =>
                            !buttonConfig.disabled &&
                            openEnrollDialog(competition)
                          }
                        >
                          <ButtonIcon
                            className="size-4"
                            weight={buttonConfig.iconWeight}
                          />
                          {buttonConfig.label}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          className="h-10 flex-1 basis-full cursor-pointer rounded-xl font-semibold sm:basis-auto"
                        >
                          <BellRinging className="size-4" weight="fill" />
                          Me Avise
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => openPrizesDialog(competition)}
                        className="h-10 flex-1 cursor-pointer rounded-xl border-amber-500/30 font-semibold text-amber-600 hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-600 sm:flex-none dark:text-amber-400 dark:hover:text-amber-400"
                      >
                        <Trophy className="size-4" weight="fill" />
                        Prêmios
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => openDetailsDialog(competition)}
                        className="h-10 flex-1 cursor-pointer rounded-xl font-semibold sm:flex-none"
                      >
                        <Eye className="size-4" />
                        Ver Detalhes
                      </Button>
                    </div>
                  </div>
                </article>
              </Reveal>
            )
          })}
        </div>
      )}

      {/* ===== Dialog A: Detalhes ===== */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-3xl">
          {selectedCompetition && (
            <>
              <DialogHeader className="border-border/60 shrink-0 border-b p-4 text-left sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="border-border/60 relative h-40 w-full shrink-0 overflow-hidden rounded-2xl border sm:size-40">
                    <Image
                      src={selectedCompetition.coverImageUrl}
                      alt={selectedCompetition.name}
                      fill
                      sizes="(max-width: 640px) 100vw, 160px"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                    <DialogTitle className="pr-6 text-xl leading-tight font-bold tracking-tight sm:text-2xl">
                      {selectedCompetition.name}
                    </DialogTitle>
                    <DialogDescription className="text-sm">
                      {selectedCompetition.description}
                    </DialogDescription>
                    <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                      <Badge
                        variant="outline"
                        className={cn(
                          "gap-1.5 rounded-full",
                          selectedCompetition.registrationOpen
                            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400",
                        )}
                      >
                        <span
                          className={cn(
                            "size-1.5 animate-pulse rounded-full",
                            selectedCompetition.registrationOpen
                              ? "bg-emerald-400"
                              : "bg-amber-400",
                          )}
                        />
                        {selectedCompetition.registrationOpen
                          ? "Inscrições Abertas"
                          : "Em Breve"}
                      </Badge>
                      {selectedCompetition.isProOnly && (
                        <Badge className="gap-1 rounded-full border-amber-400/50 bg-gradient-to-r from-amber-400 to-yellow-500 font-black text-[#3b2a00] shadow-lg shadow-amber-500/30">
                          <Crown className="size-3" weight="fill" />
                          Exclusivo PRO
                        </Badge>
                      )}
                      {getDaysUntilStart(selectedCompetition.startDate) <= 0 ? (
                        <Badge
                          variant="outline"
                          className="gap-1 rounded-full border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        >
                          <Lightning className="size-3" weight="fill" />
                          Em andamento
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1 rounded-full border-sky-500/30 bg-sky-500/15 text-sky-600 dark:text-sky-400"
                        >
                          <Timer className="size-3" weight="fill" />
                          {getDaysUntilStart(selectedCompetition.startDate)}{" "}
                          dias até começar
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
                {/* Prêmio Total */}
                <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/15 to-orange-500/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-amber-600 dark:text-amber-400">
                      <Gift className="size-4" weight="fill" />
                      Prêmio Total
                    </span>
                    <span
                      className={cn(
                        "text-xl font-bold text-amber-600 tabular-nums sm:text-2xl dark:text-amber-400",
                        isProLocked(selectedCompetition) &&
                          "blur-sm select-none",
                      )}
                    >
                      {maskText(formatPrizeLabel(String(selectedCompetition.prize)))}
                    </span>
                  </div>
                </div>

                {/* Início / Duração / Participantes */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <InfoTile
                    label="Data de Início"
                    value={formatDate(selectedCompetition.startDate)}
                  />
                  <InfoTile
                    label="Duração"
                    value={`${getDurationDays(selectedCompetition)} dias`}
                  />
                  <InfoTile
                    label="Participantes"
                    value={`${selectedCompetition.estimatedParticipants} inscritos`}
                  />
                </div>

                {/* Plataformas */}
                <SectionBlock
                  icon={<Sparkle className="size-4" weight="fill" />}
                  title="Plataformas Aceitas"
                >
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
                </SectionBlock>

                {/* Hashtags */}
                {selectedCompetition.requiredHashtags.length > 0 && (
                  <SectionBlock
                    icon={<Hash className="size-4" weight="bold" />}
                    title="Hashtags Obrigatórias"
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCompetition.requiredHashtags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="border-brand-cyan/25 text-brand-cyan not-dark:border-primary/30 not-dark:text-primary gap-0.5 rounded-full"
                        >
                          <Hash className="size-2.5" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                      <CheckCircle
                        className="size-3.5 shrink-0 text-emerald-500"
                        weight="fill"
                      />
                      Todas as hashtags devem estar presentes nos seus posts
                    </p>
                  </SectionBlock>
                )}

                {/* Cronograma */}
                <SectionBlock
                  icon={<CalendarBlank className="size-4" weight="fill" />}
                  title="Cronograma"
                >
                  <div className="flex flex-col gap-2">
                    <div className="border-brand-cyan/25 bg-brand-cyan/5 not-dark:border-primary/25 not-dark:bg-primary/5 flex items-center gap-3 rounded-xl border p-3">
                      <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
                        <ArrowRight className="size-4" weight="bold" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          Início da Competição
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {formatDate(selectedCompetition.startDate)}
                        </p>
                      </div>
                    </div>
                    <div className="border-border/60 bg-muted/30 flex items-center gap-3 rounded-xl border p-3">
                      <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
                        <Trophy
                          className="text-muted-foreground size-4"
                          weight="fill"
                        />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          Fim da Competição
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {formatDate(selectedCompetition.endDate)}
                        </p>
                      </div>
                    </div>
                  </div>
                </SectionBlock>
              </div>

              {/* Rodapé com inscrição */}
              {selectedCompetition.registrationOpen &&
                (() => {
                  const buttonConfig = getEnrollmentButtonConfig(
                    selectedCompetition.id,
                  )
                  const ButtonIcon = buttonConfig.icon
                  return (
                    <div className="border-border/60 shrink-0 border-t p-4">
                      <Button
                        className={cn(
                          "h-11 w-full cursor-pointer rounded-xl text-sm font-semibold",
                          !buttonConfig.disabled && "btn-gradient-auth",
                        )}
                        variant={buttonConfig.disabled ? "outline" : "default"}
                        disabled={buttonConfig.disabled}
                        onClick={() =>
                          !buttonConfig.disabled &&
                          openEnrollDialog(selectedCompetition)
                        }
                      >
                        <ButtonIcon
                          className="size-4.5"
                          weight={buttonConfig.iconWeight}
                        />
                        {buttonConfig.label}
                      </Button>
                    </div>
                  )
                })()}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== Dialog B: Inscrever-se ===== */}
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
                  <span className="bg-gradient-custom flex size-9 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
                    <Trophy className="size-4.5" weight="fill" />
                  </span>
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
                      if (value !== "none" && !selectedAccounts.includes(value)) {
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

      {/* ===== Dialog C: Cadastrar Nova Conta ===== */}
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
              <Label htmlFor="account-platform" className="text-sm font-semibold">
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
              <Label htmlFor="account-username" className="text-sm font-semibold">
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

      {/* ===== Dialog D: Premiação ===== */}
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

                {/* Grid de posições do ranking diário */}
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

      {/* ===== Dialog PRO ===== */}
      <ClipfyProPricingDialog
        open={isProDialogOpen}
        onOpenChange={setIsProDialogOpen}
        userEmail={userData?.email ?? undefined}
      />
    </div>
  )
}

/* ============================================================
   Blocos auxiliares no padrão visual da marca
   ============================================================ */

function CardStat({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="bg-muted/40 flex flex-col gap-1 rounded-xl px-2.5 py-2">
      <span className="text-muted-foreground inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide uppercase">
        <span className="text-foreground/60">{icon}</span>
        {label}
      </span>
      <span
        className={cn(
          "truncate text-[13px] font-bold tabular-nums",
          valueClass,
        )}
      >
        {value}
      </span>
    </div>
  )
}

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
