"use client"

import * as React from "react"
import {
  ArrowLeft,
  ArrowRight,
  CalendarBlank,
  CheckCircle,
  CircleNotch,
  Crown,
  Lightning,
  Link as LinkIcon,
  PaperPlaneTilt,
  Plus,
  Sparkle,
  Trophy,
  WarningCircle,
  X,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Bone } from "@/components/shared/skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useMaskedCurrency } from "@/contexts/financial-visibility-context"
import { formatPrizeLabel } from "@/lib/currency"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

/* ============================================================
   Validação de URL por plataforma (regex idênticos ao original)
   ============================================================ */

const URL_VALIDATION: Record<
  PlatformKey,
  { patterns: RegExp[]; example: string }
> = {
  INSTAGRAM: {
    patterns: [
      /^https?:\/\/(www\.)?instagram\.com\/p\/[A-Za-z0-9_-]+\/?(\?.*)?$/,
      /^https?:\/\/(www\.)?instagram\.com\/reel\/[A-Za-z0-9_-]+\/?(\?.*)?$/,
    ],
    example:
      "https://www.instagram.com/p/ABC123xyz ou https://www.instagram.com/reel/ABC123xyz",
  },
  TIKTOK: {
    patterns: [
      /^https?:\/\/(www\.)?tiktok\.com\/@[A-Za-z0-9_.]+\/video\/\d+\/?(\?.*)?$/,
      /^https?:\/\/m\.tiktok\.com\/@[A-Za-z0-9_.]+\/video\/\d+\/?(\?.*)?$/,
      /^https?:\/\/(vm|vt)\.tiktok\.com\/[A-Za-z0-9]+\/?(\?.*)?$/,
      /^https?:\/\/(www\.)?tiktok\.com\/t\/[A-Za-z0-9]+\/?(\?.*)?$/,
    ],
    example:
      "Link do app (vm.tiktok.com/…) ou do navegador (tiktok.com/@usuario/video/…)",
  },
  YOUTUBE: {
    patterns: [
      /^https?:\/\/(www\.)?youtube\.com\/shorts\/[A-Za-z0-9_-]+\/?(\?.*)?$/,
      /^https?:\/\/youtu\.be\/[A-Za-z0-9_-]+\/?(\?.*)?$/,
    ],
    example:
      "https://www.youtube.com/shorts/ABC123xyz ou https://youtu.be/ABC123",
  },
  KWAI: {
    patterns: [
      /^https?:\/\/(www\.)?kwai\.com\/@[A-Za-z0-9_.]+\/video\/[A-Za-z0-9_-]+\/?(\?.*)?$/,
      /^https?:\/\/(www\.)?kwai\.com\/short\/[A-Za-z0-9_-]+\/?(\?.*)?$/,
      /^https?:\/\/k\.kwai\.com\/p\/[A-Za-z0-9_-]+\/?(\?.*)?$/,
    ],
    example:
      "https://www.kwai.com/@username/video/ABC123 ou https://k.kwai.com/p/ABC123",
  },
  FACEBOOK: {
    patterns: [
      /^https?:\/\/(www\.)?facebook\.com\/[A-Za-z0-9._-]+\/reels\/?(\?.*)?$/,
      /^https?:\/\/(www\.|web\.)?facebook\.com\/profile\.php\?id=\d+&sk=owner_reels$/,
      /^https?:\/\/(www\.|web\.)?facebook\.com\/profile\.php\?id=\d+&sk=reels_tab$/,
      /^https?:\/\/(www\.)?facebook\.com\/[A-Za-z0-9.]+\/videos\/\d+\/?(\?.*)?$/,
      /^https?:\/\/(www\.)?facebook\.com\/watch\/?\?v=\d+$/,
      /^https?:\/\/(www\.)?fb\.watch\/[A-Za-z0-9_-]+\/?(\?.*)?$/,
      /^https?:\/\/(www\.)?facebook\.com\/reel\/\d+\/?(\?.*)?$/,
    ],
    example:
      "https://www.facebook.com/seu_perfil/reels ou profile.php?id=123&sk=owner_reels ou &sk=reels_tab",
  },
}

const PLATFORM_ORDER: PlatformKey[] = [
  "INSTAGRAM",
  "TIKTOK",
  "YOUTUBE",
  "KWAI",
  "FACEBOOK",
]

/* ============================================================
   Tipos
   ============================================================ */

interface CreatePostDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preSelectedCampaignId?: string
  onSuccess?: () => void
}

interface PostUrlData {
  id: string
  url: string
  /** Erro de formato da URL para a plataforma da conta. */
  error: string
  /** Erro de duplicidade dentro do próprio lote sendo enviado. */
  batchDuplicateError: string
  /** Erro de duplicidade já registrada no banco (outra competição/clipador). */
  duplicateError: string
  isValid: boolean
  isCheckingDuplicate: boolean
}

const EMPTY_POST: Omit<PostUrlData, "id"> = {
  url: "",
  error: "",
  batchDuplicateError: "",
  duplicateError: "",
  isValid: false,
  isCheckingDuplicate: false,
}

/** Tempo de espera após a digitação antes de consultar o servidor. */
const DUPLICATE_CHECK_DEBOUNCE_MS = 650

export function CreatePostDialog({
  open,
  onOpenChange,
  preSelectedCampaignId,
  onSuccess,
}: CreatePostDialogProps) {
  const { maskText } = useMaskedCurrency()
  const [step, setStep] = React.useState(1)
  const [selectedCompetition, setSelectedCompetition] = React.useState(
    preSelectedCampaignId || "",
  )
  const [accountPosts, setAccountPosts] = React.useState<
    Record<string, PostUrlData[]>
  >({})
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  /** Timers de debounce por input (`accountId:postId`). */
  const validationTimersRef = React.useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({})
  /** Contador de requisições por input, para descartar respostas obsoletas. */
  const validationRequestsRef = React.useRef<Record<string, number>>({})
  /**
   * Contador monotônico de IDs de link. Usar `length + 1` colidia: remover um
   * link do meio fazia o próximo "Adicionar" reaproveitar um id já existente,
   * o que duplicava edições/remoções e embaralhava a chave de validação.
   */
  const postIdCounterRef = React.useRef(0)

  const createPostId = (accountId: string) => {
    postIdCounterRef.current += 1
    return `${accountId}-${postIdCounterRef.current}`
  }

  const utils = api.useUtils()

  // Competições ativas do clipador
  const { data: competitions = [], isLoading: isLoadingCompetitions } =
    api.clipper.getMyCompetitions.useQuery()

  // Contas sociais do clipador
  const { data: socialAccounts = [], isLoading: isLoadingSocialAccounts } =
    api.clipper.getMySocialAccounts.useQuery()

  // Verificação de duplicidade em tempo real (debounce enquanto digita/cola)
  const validatePostUrlMutation = api.clipper.validatePostUrl.useMutation()

  const clearValidationTimer = (validationKey: string) => {
    const timer = validationTimersRef.current[validationKey]
    if (timer !== undefined) {
      clearTimeout(timer)
      delete validationTimersRef.current[validationKey]
    }
  }

  const clearValidationTimers = () => {
    Object.values(validationTimersRef.current).forEach((timer) =>
      clearTimeout(timer),
    )
    validationTimersRef.current = {}
    validationRequestsRef.current = {}
  }

  // Limpa timers pendentes ao desmontar o dialog
  React.useEffect(() => clearValidationTimers, [])

  /**
   * Recalcula duplicidade DENTRO do lote (mesma URL repetida em qualquer conta)
   * e reavalia `isValid` de todos os inputs.
   */
  const recomputeBatchDuplicateState = (
    postsByAccount: Record<string, PostUrlData[]>,
  ) => {
    const urlCounts = new Map<string, number>()

    Object.values(postsByAccount).forEach((posts) => {
      posts.forEach((post) => {
        if (post.url.trim() && !post.error) {
          const key = post.url.trim().toLowerCase()
          urlCounts.set(key, (urlCounts.get(key) ?? 0) + 1)
        }
      })
    })

    const next: Record<string, PostUrlData[]> = {}

    Object.entries(postsByAccount).forEach(([accountId, posts]) => {
      next[accountId] = posts.map((post) => {
        const key = post.url.trim().toLowerCase()
        const batchDuplicateError =
          key && !post.error && (urlCounts.get(key) ?? 0) > 1
            ? "Este link já está na lista de envio. Remova uma das duplicatas."
            : ""

        return {
          ...post,
          batchDuplicateError,
          isValid:
            post.url.trim() !== "" &&
            !post.error &&
            !batchDuplicateError &&
            !post.duplicateError &&
            !post.isCheckingDuplicate,
        }
      })
    })

    return next
  }

  const setPostDuplicateState = (
    accountId: string,
    postId: string,
    duplicateState: Partial<
      Pick<PostUrlData, "duplicateError" | "isCheckingDuplicate" | "isValid">
    >,
  ) => {
    setAccountPosts((prev) => {
      const accountPostsArray = prev[accountId] ?? []
      return {
        ...prev,
        [accountId]: accountPostsArray.map((post) =>
          post.id === postId
            ? {
                ...post,
                ...duplicateState,
                isValid:
                  duplicateState.isValid === undefined
                    ? post.isValid
                    : duplicateState.isValid &&
                      !post.error &&
                      !post.batchDuplicateError &&
                      !(duplicateState.duplicateError ?? post.duplicateError),
              }
            : post,
        ),
      }
    })
  }

  /** Agenda a consulta ao servidor com debounce, descartando respostas obsoletas. */
  const scheduleDuplicateValidation = (
    accountId: string,
    postId: string,
    url: string,
    hasValidFormat: boolean,
  ) => {
    const validationKey = `${accountId}:${postId}`

    clearValidationTimer(validationKey)

    const requestId = (validationRequestsRef.current[validationKey] ?? 0) + 1
    validationRequestsRef.current[validationKey] = requestId

    if (!url.trim() || !hasValidFormat) {
      return
    }

    validationTimersRef.current[validationKey] = setTimeout(() => {
      void (async () => {
        setPostDuplicateState(accountId, postId, {
          duplicateError: "",
          isCheckingDuplicate: true,
          isValid: false,
        })

        try {
          const result = await validatePostUrlMutation.mutateAsync({
            accountId,
            url,
          })

          if (validationRequestsRef.current[validationKey] !== requestId) return

          setPostDuplicateState(accountId, postId, {
            duplicateError: result.isDuplicate
              ? (result.message ?? "Este vídeo já foi enviado.")
              : "",
            isCheckingDuplicate: false,
            isValid: !result.isDuplicate,
          })
        } catch (error) {
          if (validationRequestsRef.current[validationKey] !== requestId) return

          const message =
            error instanceof Error
              ? error.message
              : "Não foi possível validar se este vídeo já existe."

          setPostDuplicateState(accountId, postId, {
            duplicateError: message,
            isCheckingDuplicate: false,
            isValid: false,
          })
        }
      })()
    }, DUPLICATE_CHECK_DEBOUNCE_MS)
  }

  // Mutation para submeter posts
  const submitPostsMutation = api.clipper.submitPosts.useMutation({
    onSuccess: async (data) => {
      const count = data.postsCreated
      toast.success(
        `${count} ${count === 1 ? "post enviado" : "posts enviados"} com sucesso!`,
        {
          description:
            "Seus posts estão sendo processados e aparecerão em breve no ranking.",
        },
      )

      // Invalidar TODAS as queries relevantes para atualizar contadores e rankings
      await Promise.all([
        // Queries do clipper
        utils.clipper.getMyCompetitions.invalidate(),
        utils.clipper.getMySocialAccounts.invalidate(),

        // Queries de campanha
        utils.campaign.getMyActiveAndCompletedCompetitions.invalidate(),
        utils.campaign.getCompetitionDetails.invalidate(),
        utils.campaign.getScheduled.invalidate(),

        // Invalidar query específica da competição se houver
        selectedCompetition &&
          utils.campaign.getCompetitionDetails.invalidate({
            slug:
              competitions.find((c) => c.id === selectedCompetition)?.slug ||
              "",
          }),
      ])

      setIsSubmitting(false)
      handleClose()

      if (onSuccess) {
        onSuccess()
      }
    },
    onError: (error) => {
      toast.error("Erro ao enviar posts", {
        description: error.message,
      })
      setIsSubmitting(false)
    },
  })

  // Sincronizar selectedCompetition com preSelectedCampaignId quando o dialog abrir
  React.useEffect(() => {
    if (open && preSelectedCampaignId) {
      setSelectedCompetition(preSelectedCampaignId)
    }
  }, [open, preSelectedCampaignId])

  const handleClose = () => {
    setStep(1)
    setSelectedCompetition("")
    setAccountPosts({})
    setIsSubmitting(false)
    clearValidationTimers()
    onOpenChange(false)
  }

  // Validar URL para uma conta específica (apenas formato — sem validação de username)
  const validateUrl = (url: string, accountId: string) => {
    if (!url.trim()) {
      return ""
    }

    const account = socialAccounts.find((acc) => acc.id === accountId)
    if (!account) return "Conta não encontrada"

    const validation = URL_VALIDATION[account.platform as PlatformKey]
    const config = platformConfig[account.platform as PlatformKey]
    if (!validation || !config) return "Plataforma inválida"

    const isValidFormat = validation.patterns.some((pattern) =>
      pattern.test(url),
    )

    if (!isValidFormat) {
      return `Link inválido para ${config.label}`
    }

    return ""
  }

  // Próximo passo
  const handleNext = () => {
    if (step === 1 && !selectedCompetition) {
      toast.error("Selecione uma competição")
      return
    }

    const competition = competitions.find((c) => c.id === selectedCompetition)
    if (!competition) return

    const compatibleAccounts = socialAccounts.filter(
      (acc) =>
        acc.isActive &&
        (competition.platforms as string[]).includes(acc.platform),
    )

    if (compatibleAccounts.length === 0) {
      toast.error(
        "Você não tem contas cadastradas para as plataformas desta competição",
      )
      return
    }

    // Verificar se há contas do Facebook sem link configurado
    const facebookAccountsWithoutLink = compatibleAccounts.filter(
      (acc) => acc.platform === "FACEBOOK" && !acc.profileUrl,
    )

    if (facebookAccountsWithoutLink.length > 0) {
      toast.error("Configuração do Facebook incompleta", {
        description:
          "Você precisa adicionar o link do perfil das suas contas do Facebook em Gerenciar Contas antes de postar.",
      })
      return
    }

    const initialAccounts: Record<string, PostUrlData[]> = {}
    compatibleAccounts.forEach((account) => {
      initialAccounts[account.id] = [
        { id: createPostId(account.id), ...EMPTY_POST },
      ]
    })
    setAccountPosts(initialAccounts)
    setStep(2)
  }

  // Voltar
  const handleBack = () => {
    setStep(1)
    setAccountPosts({})
    clearValidationTimers()
  }

  // Adicionar novo post para uma conta
  const addPostToAccount = (accountId: string) => {
    const newId = createPostId(accountId)
    setAccountPosts((prev) => {
      const currentPosts = prev[accountId] || []
      return {
        ...prev,
        [accountId]: [...currentPosts, { id: newId, ...EMPTY_POST }],
      }
    })
  }

  // Remover post de uma conta
  const removePostFromAccount = (accountId: string, postId: string) => {
    const validationKey = `${accountId}:${postId}`
    clearValidationTimer(validationKey)
    delete validationRequestsRef.current[validationKey]

    setAccountPosts((prev) => {
      const accountPostsArray = prev[accountId] || []
      // Recalcula o lote: remover uma duplicata pode liberar a que sobrou.
      return recomputeBatchDuplicateState({
        ...prev,
        [accountId]: accountPostsArray.filter((p) => p.id !== postId),
      })
    })
  }

  // Atualizar URL e validar automaticamente (formato + duplicidade no lote)
  const updatePostUrl = (accountId: string, postId: string, url: string) => {
    const error = validateUrl(url, accountId)
    const hasValidFormat = url.trim() !== "" && error === ""

    setAccountPosts((prev) => {
      const accountPostsArray = prev[accountId] || []

      return recomputeBatchDuplicateState({
        ...prev,
        [accountId]: accountPostsArray.map((post) =>
          post.id === postId
            ? {
                ...post,
                url,
                error,
                batchDuplicateError: "",
                duplicateError: "",
                isCheckingDuplicate: hasValidFormat,
                isValid: false,
              }
            : post,
        ),
      })
    })

    // Duplicidade contra o banco é confirmada pelo servidor, com debounce.
    scheduleDuplicateValidation(accountId, postId, url, hasValidFormat)
  }

  const getAccount = (accountId: string) =>
    socialAccounts.find((acc) => acc.id === accountId)

  // Submeter
  const handleSubmit = () => {
    const postsToSubmit: Array<{ accountId: string; url: string }> = []

    Object.entries(accountPosts).forEach(([accountId, posts]) => {
      posts.forEach((post) => {
        if (post.url.trim() && post.isValid) {
          postsToSubmit.push({ accountId, url: post.url })
        }
      })
    })

    if (postsToSubmit.length === 0) {
      toast.error("Cole pelo menos um link válido de post")
      return
    }

    const hasInvalidPosts = Object.values(accountPosts).some((posts) =>
      posts.some((post) => post.url.trim() !== "" && !post.isValid),
    )

    if (hasInvalidPosts) {
      toast.error("Corrija os links inválidos ou duplicados antes de enviar")
      return
    }

    const hasPendingValidations = Object.values(accountPosts).some((posts) =>
      posts.some((post) => post.isCheckingDuplicate),
    )

    if (hasPendingValidations) {
      toast.error("Aguarde a validação dos links antes de enviar")
      return
    }

    setIsSubmitting(true)

    submitPostsMutation.mutate({
      campaignId: selectedCompetition,
      posts: postsToSubmit,
    })
  }

  const competition = competitions.find((c) => c.id === selectedCompetition)

  const validPostsCount = Object.values(accountPosts).reduce(
    (total, posts) => total + posts.filter((p) => p.isValid).length,
    0,
  )

  const isCheckingAnyPost = Object.values(accountPosts).some((posts) =>
    posts.some((post) => post.isCheckingDuplicate),
  )

  const formatEndDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose()
      }}
    >
      <DialogContent className="flex max-h-[90vh] w-[96vw] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-[600px]">
        {/* ===== Header ===== */}
        <DialogHeader className="border-border/60 shrink-0 border-b p-4 text-left sm:p-6">
          <div className="flex items-center gap-3">
            <span className="bg-gradient-custom flex size-11 shrink-0 items-center justify-center rounded-2xl text-[#04222A] sm:size-12">
              <PaperPlaneTilt className="size-5 sm:size-6" weight="fill" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-bold tracking-tight sm:text-lg">
                Enviar Post{step === 2 && "s"}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs sm:text-sm">
                {step === 1
                  ? "Selecione a competição"
                  : "Cole os links de todas as suas contas"}
              </DialogDescription>
            </div>
          </div>

          {/* Indicador de steps */}
          <div className="mt-3 flex items-center gap-2.5">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-xs font-bold",
                  step >= 1
                    ? "bg-gradient-custom text-[#04222A]"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {step > 1 ? (
                  <CheckCircle className="size-4" weight="fill" />
                ) : (
                  "1"
                )}
              </span>
              <span
                className={cn(
                  "text-xs font-semibold sm:text-sm",
                  step >= 1 ? "text-foreground" : "text-muted-foreground",
                )}
              >
                Competição
              </span>
            </div>

            <span
              className={cn(
                "h-0.5 w-8 rounded-full sm:w-12",
                step >= 2 ? "bg-gradient-custom" : "bg-muted",
              )}
            />

            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-xs font-bold",
                  step >= 2
                    ? "bg-gradient-custom text-[#04222A]"
                    : "bg-muted text-muted-foreground",
                )}
              >
                2
              </span>
              <span
                className={cn(
                  "text-xs font-semibold sm:text-sm",
                  step >= 2 ? "text-foreground" : "text-muted-foreground",
                )}
              >
                Links
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* ===== Corpo scrollável ===== */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6">
          {/* Step 1: Selecionar Competição */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="competition"
                  className="flex items-center gap-2 text-sm font-bold"
                >
                  <span className="bg-gradient-custom flex size-7 items-center justify-center rounded-lg text-[#04222A]">
                    <Trophy className="size-4" weight="fill" />
                  </span>
                  Competição Ativa
                </Label>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  Escolha para qual competição você deseja enviar este post
                </p>
              </div>

              {isLoadingCompetitions ? (
                <div className="flex flex-col gap-3">
                  <Bone className="h-12 w-full rounded-xl" />
                  <div className="border-border/60 bg-muted/20 flex flex-col gap-3 rounded-2xl border p-3.5 sm:p-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Bone delay={80} className="h-[22px] w-24 rounded-full" />
                      <Bone
                        delay={160}
                        className="h-[22px] w-20 rounded-full"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Bone delay={240} className="h-3.5 w-36 rounded-full" />
                      <Bone
                        delay={320}
                        className="h-[22px] w-16 rounded-full"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <Select
                  value={selectedCompetition}
                  onValueChange={setSelectedCompetition}
                >
                  <SelectTrigger
                    id="competition"
                    className="h-12 w-full cursor-pointer rounded-xl font-medium"
                  >
                    <SelectValue placeholder="Selecione uma competição" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {competitions.length === 0 ? (
                      <div className="text-muted-foreground p-4 text-center text-sm">
                        Você não está inscrito em nenhuma competição ativa
                      </div>
                    ) : (
                      competitions.map((comp) => (
                        <SelectItem
                          key={comp.id}
                          value={comp.id}
                          className="cursor-pointer rounded-lg py-2.5"
                        >
                          <span className="flex items-center gap-2.5">
                            <span className="bg-gradient-custom flex size-6 shrink-0 items-center justify-center rounded-md text-[#04222A]">
                              <Trophy className="size-3.5" weight="fill" />
                            </span>
                            <span className="font-medium">{comp.name}</span>
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}

              {/* Detalhes da competição selecionada */}
              {competition && (
                <div className="border-border/60 bg-muted/20 flex flex-col gap-2.5 rounded-2xl border p-3.5 sm:p-4">
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
                            "gap-1 rounded-full text-xs",
                            config.bgColor,
                            config.borderColor,
                          )}
                        >
                          <PlatformIcon
                            className={cn("size-3.5", config.color)}
                          />
                          {config.label}
                        </Badge>
                      )
                    })}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs sm:text-sm">
                      <CalendarBlank className="size-3.5" />
                      Termina em {formatEndDate(competition.endDate)}
                    </span>
                    <Badge
                      variant="outline"
                      className="gap-1 rounded-full border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    >
                      <Sparkle className="size-3" weight="fill" />
                      {maskText(formatPrizeLabel(competition.prize))}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Cole os links por conta */}
          {step === 2 && (
            <div className="flex flex-col gap-4 sm:gap-5">
              {/* Competição selecionada */}
              {competition && (
                <div className="border-border/60 bg-muted/20 flex items-center gap-3 rounded-2xl border p-3.5 sm:p-4">
                  <span className="bg-gradient-custom flex size-9 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
                    <Trophy className="size-4" weight="fill" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground text-xs font-medium">
                      Enviando para:
                    </p>
                    <p className="line-clamp-1 text-sm font-bold sm:text-base">
                      {competition.name}
                    </p>
                  </div>
                </div>
              )}

              {/* Título e instruções */}
              <div className="flex flex-col gap-1.5">
                <Label className="flex items-center gap-2 text-sm font-bold">
                  <span className="bg-gradient-custom flex size-7 items-center justify-center rounded-lg text-[#04222A]">
                    <LinkIcon className="size-4" weight="bold" />
                  </span>
                  Cole os Links dos Seus Posts
                </Label>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  Cole os links por plataforma. Você pode adicionar vários posts
                  da mesma plataforma!
                </p>
                {validPostsCount > 0 && (
                  <Badge
                    variant="outline"
                    className="mt-1 w-fit gap-1.5 rounded-full border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  >
                    <CheckCircle className="size-3" weight="fill" />
                    {validPostsCount}{" "}
                    {validPostsCount === 1 ? "post pronto" : "posts prontos"}{" "}
                    para enviar
                  </Badge>
                )}
              </div>

              {/* Lista de contas com inputs */}
              <div className="flex flex-col gap-3.5 sm:gap-4">
                {Object.entries(accountPosts)
                  .map(([accountId, posts]) => ({
                    accountId,
                    posts,
                    account: getAccount(accountId),
                  }))
                  .filter((item) => item.account !== undefined)
                  .sort((a, b) => {
                    // Ordenar por plataforma primeiro
                    const aPlatformIndex = PLATFORM_ORDER.indexOf(
                      a.account!.platform as PlatformKey,
                    )
                    const bPlatformIndex = PLATFORM_ORDER.indexOf(
                      b.account!.platform as PlatformKey,
                    )

                    if (aPlatformIndex !== bPlatformIndex) {
                      return aPlatformIndex - bPlatformIndex
                    }

                    // Se mesma plataforma, ordenar por isPrimary (principal primeiro)
                    if (a.account!.isPrimary !== b.account!.isPrimary) {
                      return a.account!.isPrimary ? -1 : 1
                    }

                    // Se mesmos critérios, ordenar por username
                    return a.account!.username.localeCompare(
                      b.account!.username,
                    )
                  })
                  .map(({ accountId, posts, account }) => {
                    if (!account) return null

                    const config =
                      platformConfig[account.platform as PlatformKey]
                    const validation =
                      URL_VALIDATION[account.platform as PlatformKey]
                    if (!config || !validation) return null

                    const PlatformIcon = config.icon
                    const validPostsForAccount = posts.filter(
                      (p) => p.isValid,
                    ).length
                    const isFacebookBlocked =
                      account.platform === "FACEBOOK" && !account.profileUrl

                    return (
                      <div
                        key={accountId}
                        className={cn(
                          "flex flex-col gap-3 rounded-2xl border p-3.5 transition-colors sm:p-4",
                          isFacebookBlocked
                            ? "border-red-500/30 bg-red-500/5"
                            : validPostsForAccount > 0
                              ? "border-emerald-500/30 bg-emerald-500/5"
                              : "border-border/60 bg-muted/20",
                        )}
                      >
                        {/* Alerta: Facebook sem link do perfil */}
                        {isFacebookBlocked && (
                          <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-2.5">
                            <WarningCircle
                              className="mt-0.5 size-4 shrink-0 text-red-500"
                              weight="fill"
                            />
                            <div className="flex flex-col gap-0.5">
                              <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                                Link do perfil não configurado
                              </p>
                              <p className="text-[10px] text-red-600/80 dark:text-red-400/80">
                                Você precisa adicionar o link do seu perfil do
                                Facebook em "Gerenciar Contas" antes de enviar
                                posts.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Cabeçalho da conta */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
                            <span
                              className={cn(
                                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                                config.bgColor,
                              )}
                            >
                              <PlatformIcon
                                className={cn("size-5", config.color)}
                              />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="text-sm font-bold sm:text-base">
                                  {config.label} - {account.username}
                                </p>
                                {account.isPrimary && (
                                  <Badge
                                    variant="outline"
                                    className="gap-1 rounded-full border-amber-500/40 bg-amber-500/15 text-[10px] text-amber-600 dark:text-amber-400"
                                  >
                                    <Crown className="size-2.5" weight="fill" />
                                    Principal
                                  </Badge>
                                )}
                                {validPostsForAccount > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="rounded-full border-emerald-500/30 bg-emerald-500/15 text-[10px] text-emerald-600 dark:text-emerald-400"
                                  >
                                    {validPostsForAccount}{" "}
                                    {validPostsForAccount === 1
                                      ? "link"
                                      : "links"}
                                  </Badge>
                                )}
                              </div>
                              {account.followers != null &&
                                account.followers > 0 && (
                                  <p className="text-muted-foreground text-[10px] sm:text-xs">
                                    {account.followers.toLocaleString("pt-BR")}{" "}
                                    seguidores
                                  </p>
                                )}
                              <p className="text-muted-foreground mt-1 text-[10px] break-all sm:text-xs">
                                Ex: {validation.example}
                              </p>
                            </div>
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => addPostToAccount(accountId)}
                            aria-label={`Adicionar link para ${config.label} - ${account.username}`}
                            className="h-8 shrink-0 cursor-pointer gap-1 rounded-xl px-2.5 text-xs sm:px-3"
                            disabled={isFacebookBlocked}
                          >
                            <Plus className="size-3.5" weight="bold" />
                            <span className="hidden sm:inline">Adicionar</span>
                          </Button>
                        </div>

                        {/* Inputs dos links */}
                        <div className="flex flex-col gap-2.5">
                          {posts.map((post, index) => {
                            // Prioridade: formato > duplicata no lote > duplicata no banco
                            const postError =
                              post.error ||
                              post.batchDuplicateError ||
                              post.duplicateError

                            return (
                              <div
                                key={post.id}
                                className="flex flex-col gap-1.5"
                              >
                                <div className="flex items-center gap-2">
                                  {post.isCheckingDuplicate ? (
                                    <CircleNotch
                                      className="text-muted-foreground size-4 shrink-0 animate-spin motion-reduce:animate-none"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    post.isValid && (
                                      <CheckCircle
                                        className="size-4 shrink-0 text-emerald-500"
                                        weight="fill"
                                        aria-hidden="true"
                                      />
                                    )
                                  )}
                                  <Input
                                    placeholder={
                                      isFacebookBlocked
                                        ? "Configure o link do perfil primeiro"
                                        : `Cole o link ${posts.length > 1 ? `#${index + 1}` : "do post"} aqui`
                                    }
                                    value={post.url}
                                    onChange={(e) =>
                                      updatePostUrl(
                                        accountId,
                                        post.id,
                                        e.target.value,
                                      )
                                    }
                                    aria-invalid={postError ? true : undefined}
                                    aria-describedby={`${post.id}-status`}
                                    className={cn(
                                      "h-10 min-w-0 flex-1 rounded-xl text-sm",
                                      postError &&
                                        "border-red-500 focus-visible:ring-red-500/40",
                                      post.isValid &&
                                        "border-emerald-500 focus-visible:ring-emerald-500/40",
                                    )}
                                    disabled={isFacebookBlocked}
                                  />
                                  {posts.length > 1 && (
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      onClick={() =>
                                        removePostFromAccount(accountId, post.id)
                                      }
                                      aria-label={`Remover link ${index + 1} de ${account.username}`}
                                      className="text-muted-foreground size-10 shrink-0 cursor-pointer rounded-xl hover:text-red-500"
                                      disabled={isFacebookBlocked}
                                    >
                                      <X className="size-4" />
                                    </Button>
                                  )}
                                </div>

                                {/* Verificando duplicidade no servidor */}
                                {post.isCheckingDuplicate && (
                                  <div
                                    id={`${post.id}-status`}
                                    role="status"
                                    className="border-border/60 bg-muted/50 flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5"
                                  >
                                    <CircleNotch
                                      className="text-muted-foreground size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
                                      aria-hidden="true"
                                    />
                                    <p className="text-muted-foreground text-[10px] font-medium sm:text-xs">
                                      Verificando se este vídeo já foi enviado...
                                    </p>
                                  </div>
                                )}

                                {/* Confirmação de validação */}
                                {post.isValid && (
                                  <div
                                    id={`${post.id}-status`}
                                    role="status"
                                    className="flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5"
                                  >
                                    <CheckCircle
                                      className="size-3.5 shrink-0 text-emerald-500"
                                      weight="fill"
                                      aria-hidden="true"
                                    />
                                    <p className="text-[10px] font-medium text-emerald-600 sm:text-xs dark:text-emerald-400">
                                      Link válido e ainda não enviado
                                    </p>
                                  </div>
                                )}

                                {/* Erro de formato ou duplicidade */}
                                {postError && (
                                  <div
                                    id={`${post.id}-status`}
                                    role="alert"
                                    className="flex items-start gap-1.5 rounded-xl border border-red-500/25 bg-red-500/10 px-2.5 py-1.5"
                                  >
                                    <WarningCircle
                                      className="mt-0.5 size-3.5 shrink-0 text-red-500"
                                      weight="fill"
                                      aria-hidden="true"
                                    />
                                    <p className="min-w-0 text-[10px] font-medium break-words text-red-600 sm:text-xs dark:text-red-400">
                                      {postError}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
              </div>

              {/* Dica final */}
              {Object.keys(accountPosts).length > 1 &&
                validPostsCount === 0 && (
                  <div className="flex items-start gap-2.5 rounded-2xl border border-sky-500/25 bg-sky-500/10 p-3.5 sm:p-4">
                    <Sparkle
                      className="mt-0.5 size-4 shrink-0 text-sky-500 sm:size-5"
                      weight="fill"
                    />
                    <div className="flex flex-col gap-0.5">
                      <p className="text-xs font-semibold text-sky-600 sm:text-sm dark:text-sky-400">
                        Dica: Envie múltiplos posts por conta!
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Você pode adicionar vários posts de cada conta. Use o
                        botão "Adicionar" em cada card!
                      </p>
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* ===== Footer ===== */}
        <div className="border-border/60 bg-muted/20 flex shrink-0 items-center gap-2.5 border-t p-4 sm:p-6">
          {step === 2 && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isSubmitting}
              aria-label="Voltar para a etapa anterior"
              className="h-10 cursor-pointer rounded-xl px-4 sm:px-6"
            >
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Voltar</span>
            </Button>
          )}

          {step === 1 ? (
            <Button
              onClick={handleNext}
              disabled={
                !selectedCompetition ||
                isLoadingCompetitions ||
                isLoadingSocialAccounts
              }
              className="btn-gradient-auth h-10 flex-1 cursor-pointer rounded-xl px-4 font-semibold sm:px-6"
            >
              {isLoadingCompetitions || isLoadingSocialAccounts ? (
                <>
                  <CircleNotch className="size-4 animate-spin" />
                  Carregando...
                </>
              ) : (
                <>
                  Continuar
                  <ArrowRight className="size-4" weight="bold" />
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={
                validPostsCount === 0 || isSubmitting || isCheckingAnyPost
              }
              className="btn-gradient-auth h-10 flex-1 cursor-pointer rounded-xl px-4 font-semibold sm:px-6"
            >
              {isSubmitting || isCheckingAnyPost ? (
                <>
                  <CircleNotch className="size-4 animate-spin motion-reduce:animate-none" />
                  {isSubmitting ? "Enviando..." : "Validando..."}
                </>
              ) : (
                <>
                  <Lightning className="size-4" weight="fill" />
                  {validPostsCount === 0
                    ? "Enviar Posts"
                    : `Enviar ${validPostsCount} ${validPostsCount === 1 ? "Post" : "Posts"}`}
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
