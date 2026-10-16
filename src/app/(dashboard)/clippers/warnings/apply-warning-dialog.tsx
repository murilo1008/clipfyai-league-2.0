"use client"

import * as React from "react"
import type { ClipperInfractionType } from "@prisma/client"
import {
  ArrowSquareOut,
  CheckCircle,
  CircleNotch,
  Eye,
  Medal,
  Info,
  Link as LinkIcon,
  ListBullets,
  MagnifyingGlass,
  Prohibit,
  ShieldWarning,
  WarningCircle,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  DISCIPLINE_DISABLED_MESSAGE,
  CLIP_POST_STATUS_LABELS,
  RestrictionBadges,
  SEVERE_DESCRIPTION,
  formatBRLAmount,
  formatBrtDate,
  formatBrtDateTime,
  formatBrtShort,
  levelDescription,
  useNow,
} from "@/components/clippers/discipline-shared"
import { formatCompact } from "@/components/shared/count-up"
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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { MAX_WARNING_LEVEL } from "@/lib/clipper-discipline/constants"
import {
  INFRACTION_TYPE_LABELS,
  SEVERE_EQUIVALENT_LEVEL,
  buildSanctionPlan,
  levelRequirements,
  podiumRankingDateError,
  warningLevelLabel,
  warningExpiresAt,
  type SanctionDraft,
} from "@/lib/clipper-discipline/levels"
import {
  formatRankingDateYmd,
  openRankingDateYmd,
  rankingDayWindowUtc,
} from "@/lib/clipper-discipline/podium"
import { formatScoreMultiplier } from "@/lib/clipper-discipline/score-multiplier"
import type { DisciplineSettings } from "@/lib/clipper-discipline/settings"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"
import { api, type RouterOutputs } from "@/trpc/react"

import { useInvalidateDiscipline } from "./use-invalidate-discipline"

type ApplyContext = RouterOutputs["clipperDiscipline"]["applyContext"]
type ClipperPost = RouterOutputs["clipperDiscipline"]["clipperPosts"][number]

const NO_CAMPAIGN = "__none__"
const BAN_CONFIRMATION_WORD = "BANIR"
/** Placeholder só para montar a prévia enquanto o formulário está incompleto. */
const PENDING_ID = "__pending__"

const INFRACTION_HINTS: Record<ClipperInfractionType, string> = {
  LIGHT: "Hashtag/marcação faltando, fora do direcionamento, formato errado",
  MEDIUM: "Reincidência no dia, baixa qualidade proposital, spam",
  SEVERE: "Bot, engajamento comprado, reupload, conteúdo roubado",
}

const APPLICATION_STATUS_LABELS: Record<string, string> = {
  PENDING: "inscrição pendente",
  UNDER_REVIEW: "em análise",
  APPROVED: "participando",
  REJECTED: "inscrição rejeitada",
  WITHDRAWN: "saiu",
  REVOKED: "removido",
}

const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendada",
  ACTIVE: "Em andamento",
  PAUSED: "Pausada",
  COMPLETED: "Encerrada",
  ARCHIVED: "Arquivada",
}

const LEVELS = Array.from({ length: MAX_WARNING_LEVEL + 1 }, (_, level) => level)

/* ============================================================
   Textos de apoio
   ============================================================ */

function suggestionText(context: ApplyContext) {
  const count = context.activeCount
  if (count === 0) {
    return "Nenhuma advertência ativa → sugerido aviso formal (nível 0)"
  }
  const highest = context.activeWarnings.reduce((best, warning) => {
    const value =
      warning.infractionType === "SEVERE"
        ? SEVERE_EQUIVALENT_LEVEL
        : (warning.level ?? 0)
    return Math.max(best, value)
  }, 0)
  const highestWarning = context.activeWarnings.find((warning) =>
    warning.infractionType === "SEVERE"
      ? SEVERE_EQUIVALENT_LEVEL === highest
      : (warning.level ?? 0) === highest,
  )
  const highestLabel = highestWarning
    ? warningLevelLabel(highestWarning.infractionType, highestWarning.level)
    : null
  const severeNote =
    highestWarning?.infractionType === "SEVERE"
      ? " — a grave conta como nível 3"
      : ""
  return `${count} ${count === 1 ? "advertência ativa" : "advertências ativas"}${
    highestLabel ? ` (maior: ${highestLabel}${severeNote})` : ""
  } → sugerido nível ${context.suggestedLevel}`
}

/** Prévia em texto do que a advertência faz, a partir do plano de sanções. */
function describePlan({
  plan,
  infractionType,
  campaignName,
  hasVideo,
  activeCount,
  settings,
  now,
}: {
  plan: SanctionDraft[]
  infractionType: ClipperInfractionType
  campaignName: string | null
  hasVideo: boolean
  activeCount: number
  settings: DisciplineSettings
  now: Date
}) {
  const lines: { text: string; tone: "danger" | "warning" | "info" }[] = []
  const competition = campaignName ? `da competição ${campaignName}` : "da competição"
  for (const draft of plan) {
    switch (draft.type) {
      case "VIDEO_INVALIDATION":
        lines.push({
          text: hasVideo
            ? "O vídeo da infração deixa de pontuar (o prêmio dele, se já creditado, é estornado)"
            : "O vídeo da infração deixa de pontuar (escolha o vídeo)",
          tone: "warning",
        })
        break
      case "POSTING_SUSPENSION":
        if (draft.endsAt) {
          lines.push({
            text: `Suspensão de envio até ${formatBrtShort(draft.endsAt)}`,
            tone: "danger",
          })
        }
        break
      case "SCORE_MULTIPLIER":
        lines.push({
          text: `Redutor ${formatScoreMultiplier(draft.scoreMultiplierBps ?? 10000)} nos vídeos postados até ${draft.endsAt ? formatBrtShort(draft.endsAt) : "a liberação"}`,
          tone: "warning",
        })
        break
      case "COMPETITION_REMOVAL":
        lines.push({
          text: `Removido ${competition} (os vídeos dele deixam de pontuar)`,
          tone: "danger",
        })
        lines.push({
          text: `Estorno de todos os prêmios ${competition} já creditados na carteira`,
          tone: "danger",
        })
        break
      case "PAYOUT_HOLD":
        lines.push({
          text: "Pagamento retido até liberação manual",
          tone: "danger",
        })
        break
      case "PLATFORM_BAN":
        lines.push({
          text: "Banimento: conta bloqueada e saída das competições em andamento (sem estorno)",
          tone: "danger",
        })
        break
      case "PODIUM_INELIGIBLE":
        lines.push({
          text: `Inelegível ao pódio em ${draft.rankingDate ? formatRankingDateYmd(draft.rankingDate) : "um dia"}: os vídeos postados de ${formatBrtShort(draft.startsAt)} a ${draft.endsAt ? formatBrtShort(draft.endsAt) : "—"} ficam fora dos rankings do dia ${competition} (diário e Top Clipadores) e continuam no mensal; prêmio do dia já creditado é estornado`,
          tone: "warning",
        })
        break
      default:
        break
    }
  }
  if (infractionType === "SEVERE") {
    lines.push({
      text: "Análise de banimento aberta na fila de Revisões (o ban é decidido lá)",
      tone: "info",
    })
  }
  if (
    plan.some(
      (draft) =>
        draft.type === "VIDEO_INVALIDATION" ||
        draft.type === "COMPETITION_REMOVAL" ||
        draft.type === "PODIUM_INELIGIBLE",
    )
  ) {
    lines.push({
      text: "Se o estorno deixar o saldo negativo, os pagamentos ficam retidos (saldo devedor)",
      tone: "info",
    })
  }
  const expiry = formatBrtDate(warningExpiresAt(settings, now))
  lines.push({
    text:
      activeCount > 0
        ? `Fica ativa até ${expiry}; a nova infração renova a expiração das ${activeCount} ativas`
        : `Fica ativa até ${expiry} (expira após ${settings.warningExpiryDays} dias sem nova infração)`,
    tone: "info",
  })
  lines.push({
    text: "O clipador recebe notificação e e-mail e pode enviar uma defesa",
    tone: "info",
  })
  return lines
}

/* ============================================================
   Dialog
   ============================================================ */

export interface ApplyWarningDialogProps {
  clipperProfileId: string
  clipperName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplied?: () => void
}

export function ApplyWarningDialog({
  clipperProfileId,
  clipperName,
  open,
  onOpenChange,
  onApplied,
}: ApplyWarningDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[96vw] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-2xl">
        <DialogHeader className="border-border/60 shrink-0 border-b p-4 text-left sm:p-6">
          <DialogTitle className="flex items-center gap-2 text-base font-bold sm:text-lg">
            <span className="flex size-8 items-center justify-center rounded-lg bg-red-500/15 text-red-600 dark:text-red-400">
              <ShieldWarning className="size-4.5" weight="fill" />
            </span>
            Aplicar advertência
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {clipperName}
          </DialogDescription>
        </DialogHeader>
        {/* O formulário só monta com o dialog aberto: cada abertura começa limpa. */}
        {open && (
          <ApplyWarningForm
            clipperProfileId={clipperProfileId}
            onCancel={() => onOpenChange(false)}
            onApplied={() => {
              onOpenChange(false)
              onApplied?.()
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ApplyWarningForm({
  clipperProfileId,
  onCancel,
  onApplied,
}: {
  clipperProfileId: string
  onCancel: () => void
  onApplied: () => void
}) {
  const invalidate = useInvalidateDiscipline()
  const now = useNow(30_000)

  const {
    data: context,
    isLoading,
    isError,
  } = api.clipperDiscipline.applyContext.useQuery({ clipperProfileId })

  const [infractionType, setInfractionType] =
    React.useState<ClipperInfractionType>("LIGHT")
  /** null = ainda segue a sugestão do sistema. */
  const [levelChoice, setLevelChoice] = React.useState<number | null>(null)
  const [campaignId, setCampaignId] = React.useState("")
  const [videoMode, setVideoMode] = React.useState<"post" | "manual">("post")
  const [selectedPost, setSelectedPost] = React.useState<ClipperPost | null>(null)
  const [manualUrl, setManualUrl] = React.useState("")
  const [postSearch, setPostSearch] = React.useState("")
  const [reason, setReason] = React.useState("")
  const [banConfirmation, setBanConfirmation] = React.useState("")
  const [podiumEnabled, setPodiumEnabled] = React.useState(false)
  const [podiumDate, setPodiumDate] = React.useState(() =>
    openRankingDateYmd(new Date()),
  )

  const isSevere = infractionType === "SEVERE"
  const suggestedLevel = context?.suggestedLevel ?? 0
  const level = isSevere ? null : (levelChoice ?? suggestedLevel)
  const requirements = levelRequirements(infractionType, level)
  const disabled = !context?.enabled

  // Para os níveis 0 e 1 o vídeo precisa vir da lista (é ele que deixa de pontuar).
  const effectiveVideoMode = requirements.requiresVideo ? "post" : videoMode
  const podiumActive = requirements.allowsPodium && podiumEnabled
  const podiumDateError = podiumActive
    ? podiumRankingDateError(podiumDate, now)
    : null
  // O vídeo da lista sai das inscrições numa competição: exigir o vídeo exige
  // ela; o pódio também vale para uma competição.
  const campaignRequired =
    requirements.requiresCampaign || requirements.requiresVideo || podiumActive

  const debouncedSearch = useDebouncedValue(postSearch.trim(), 300)
  const postsQuery = api.clipperDiscipline.clipperPosts.useQuery(
    {
      clipperProfileId,
      campaignId,
      search: debouncedSearch || undefined,
    },
    { enabled: !!campaignId && effectiveVideoMode === "post" },
  )

  const clipPostId =
    effectiveVideoMode === "post" ? (selectedPost?.id ?? null) : null
  const campaign = context?.competitions.find((item) => item.id === campaignId)

  const plan = React.useMemo(() => {
    if (!context) return []
    try {
      return buildSanctionPlan({
        infractionType,
        level,
        settings: context.settings,
        now,
        campaignId:
          campaignId || (campaignRequired ? PENDING_ID : null),
        clipPostId:
          clipPostId || (requirements.requiresVideo ? PENDING_ID : null),
        podiumRankingDate:
          podiumActive && !podiumDateError ? podiumDate : null,
      })
    } catch {
      return []
    }
  }, [
    context,
    infractionType,
    level,
    now,
    campaignId,
    clipPostId,
    campaignRequired,
    requirements.requiresVideo,
    podiumActive,
    podiumDate,
    podiumDateError,
  ])

  const summary = context
    ? describePlan({
        plan,
        infractionType,
        campaignName: campaign?.name ?? null,
        hasVideo: !!clipPostId,
        activeCount: context.activeCount,
        settings: context.settings,
        now,
      })
    : []

  const missing: string[] = []
  if ((requirements.requiresCampaign || podiumActive) && !campaignId) {
    missing.push("a competição")
  }
  if (requirements.requiresVideo && !clipPostId) missing.push("o vídeo da infração")
  if (podiumDateError) missing.push("o dia do pódio")
  if (reason.trim().length < 3) missing.push("o motivo")
  if (
    requirements.requiresBanConfirmation &&
    banConfirmation.trim().toUpperCase() !== BAN_CONFIRMATION_WORD
  ) {
    missing.push(`a confirmação "${BAN_CONFIRMATION_WORD}"`)
  }

  const applyMutation = api.clipperDiscipline.apply.useMutation({
    onSuccess: (result) => {
      const title = isSevere
        ? "Infração grave registrada"
        : result.level === 0
          ? "Aviso formal registrado"
          : `Advertência ${result.level} aplicada`
      const details: string[] = []
      if (result.invalidatedPosts > 0) {
        details.push(
          `${result.invalidatedPosts} ${result.invalidatedPosts === 1 ? "vídeo invalidado" : "vídeos invalidados"}`,
        )
      }
      if (result.reversedAmount > 0) {
        details.push(`${formatBRLAmount(result.reversedAmount)} estornados`)
      }
      if (!result.emailSent) details.push("e-mail não enviado")
      toast.success(title, {
        description: details.length > 0 ? details.join(" · ") : undefined,
      })
      invalidate()
      onApplied()
    },
    onError: (error) =>
      toast.error(error.message || "Erro ao aplicar advertência"),
  })

  const handleSubmit = () => {
    if (!context || disabled) return
    if (!isSevere && level === null) {
      toast.error("Escolha o nível da advertência")
      return
    }
    if ((requirements.requiresCampaign || podiumActive) && !campaignId) {
      toast.error("Escolha a competição da infração")
      return
    }
    if (podiumDateError) {
      toast.error(podiumDateError)
      return
    }
    if (requirements.requiresVideo && !clipPostId) {
      toast.error("Escolha o vídeo da infração na lista")
      return
    }
    const trimmedUrl = manualUrl.trim()
    if (effectiveVideoMode === "manual" && trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
      toast.error("O link do vídeo precisa começar com http:// ou https://")
      return
    }
    if (reason.trim().length < 3) {
      toast.error("Descreva o motivo (mínimo de 3 caracteres)")
      return
    }
    const banConfirmed =
      banConfirmation.trim().toUpperCase() === BAN_CONFIRMATION_WORD
    if (requirements.requiresBanConfirmation && !banConfirmed) {
      toast.error(`Digite ${BAN_CONFIRMATION_WORD} para confirmar o banimento`)
      return
    }
    applyMutation.mutate({
      clipperProfileId,
      infractionType,
      level,
      campaignId: campaignId || null,
      clipPostId,
      videoUrl:
        effectiveVideoMode === "manual" && trimmedUrl ? trimmedUrl : null,
      reason: reason.trim(),
      confirmBan: requirements.requiresBanConfirmation ? banConfirmed : undefined,
      podiumRankingDate: podiumActive ? podiumDate : null,
    })
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4 sm:p-6">
        <Bone className="h-14 w-full rounded-2xl" />
        <Bone delay={80} className="h-24 w-full rounded-2xl" />
        <Bone delay={160} className="h-40 w-full rounded-2xl" />
      </div>
    )
  }

  if (isError || !context) {
    return (
      <p className="text-muted-foreground p-6 text-center text-sm">
        Não foi possível carregar os dados do clipador.
      </p>
    )
  }

  const dangerous = isSevere || (level ?? 0) >= 3
  const isPending = applyMutation.isPending

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-6">
        {disabled && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-sm text-amber-700 dark:text-amber-400">
            <WarningCircle className="mt-0.5 size-4 shrink-0" weight="fill" />
            {DISCIPLINE_DISABLED_MESSAGE}
          </div>
        )}

        {/* Situação atual do clipador */}
        <div className="border-border/60 bg-muted/20 flex flex-col gap-2 rounded-2xl border px-3.5 py-3">
          <p className="text-sm font-semibold">
            {context.activeCount === 0
              ? "Nenhuma advertência ativa"
              : `${context.activeCount} ${context.activeCount === 1 ? "advertência ativa" : "advertências ativas"}`}
          </p>
          <RestrictionBadges
            restrictions={context.restrictions}
            emptyText="Sem restrições em vigor"
          />
        </div>

        {/* Tipo de infração */}
        <fieldset className="flex flex-col gap-2" disabled={disabled}>
          <legend className="mb-2 text-sm font-bold">Tipo de infração</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(["LIGHT", "MEDIUM", "SEVERE"] as const).map((type) => (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={infractionType === type}
                onClick={() => setInfractionType(type)}
                className={cn(
                  "flex cursor-pointer flex-col gap-1 rounded-2xl border px-3.5 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  infractionType === type
                    ? type === "SEVERE"
                      ? "border-red-500/60 bg-red-500/10"
                      : "border-[var(--brand-cyan)]/60 bg-[var(--brand-cyan)]/10"
                    : "border-border/60 hover:bg-muted/40",
                )}
              >
                <span className="text-sm font-semibold">
                  {INFRACTION_TYPE_LABELS[type]}
                </span>
                <span className="text-muted-foreground text-[11px] leading-snug">
                  {INFRACTION_HINTS[type]}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        {/* Nível */}
        {isSevere ? (
          <div className="flex items-start gap-2.5 rounded-2xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-700 dark:text-red-400">
            <Prohibit className="mt-0.5 size-4 shrink-0" weight="fill" />
            <span>
              {SEVERE_DESCRIPTION}. A infração grave não segue a escala; o
              banimento é decidido manualmente na fila de Revisões.
            </span>
          </div>
        ) : (
          <fieldset className="flex flex-col gap-2" disabled={disabled}>
            <legend className="mb-1 text-sm font-bold">Nível</legend>
            <p className="text-muted-foreground mb-1 flex items-start gap-1.5 text-xs">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              {suggestionText(context)}
            </p>
            <div className="flex flex-col gap-1.5">
              {LEVELS.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={level === option}
                  onClick={() => setLevelChoice(option)}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    level === option
                      ? option >= 3
                        ? "border-red-500/60 bg-red-500/10"
                        : "border-[var(--brand-cyan)]/60 bg-[var(--brand-cyan)]/10"
                      : "border-border/60 hover:bg-muted/40",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      level === option
                        ? "bg-gradient-custom text-[#04222A]"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {option}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                      {warningLevelLabel(infractionType, option)}
                      {option === suggestedLevel && (
                        <Badge
                          variant="outline"
                          className="rounded-full border-[var(--brand-cyan)]/40 bg-[var(--brand-cyan)]/10 text-[10px] text-cyan-700 dark:text-[var(--brand-cyan)]"
                        >
                          Sugerido
                        </Badge>
                      )}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {levelDescription(option, context.settings)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {/* Competição */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="warning-campaign" className="text-sm font-bold">
            Competição
            {campaignRequired ? (
              <span className="text-red-500">*</span>
            ) : (
              <span className="text-muted-foreground text-xs font-normal">
                (opcional)
              </span>
            )}
          </Label>
          {context.competitions.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              O clipador não tem inscrições em competições.
            </p>
          ) : (
            <Select
              // "" mostra o placeholder quando a competição é obrigatória
              value={campaignId || (campaignRequired ? "" : NO_CAMPAIGN)}
              onValueChange={(value) => {
                setCampaignId(value === NO_CAMPAIGN ? "" : value)
                setSelectedPost(null)
                setPostSearch("")
              }}
              disabled={disabled}
            >
              <SelectTrigger
                id="warning-campaign"
                className="h-10 w-full cursor-pointer rounded-xl"
              >
                <SelectValue placeholder="Selecione a competição" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {!campaignRequired && (
                  <SelectItem value={NO_CAMPAIGN}>Sem competição</SelectItem>
                )}
                {context.competitions.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    <span className="truncate">{item.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {CAMPAIGN_STATUS_LABELS[item.campaignStatus] ??
                        item.campaignStatus}{" "}
                      ·{" "}
                      {APPLICATION_STATUS_LABELS[item.applicationStatus] ??
                        item.applicationStatus}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {requirements.requiresVideo && (
            <p className="text-muted-foreground text-xs">
              Escolha a competição para listar os vídeos do clipador.
            </p>
          )}
        </div>

        {/* Vídeo */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold">
              Vídeo da infração
              {requirements.requiresVideo ? (
                <span className="text-red-500">*</span>
              ) : (
                <span className="text-muted-foreground ml-1 text-xs font-normal">
                  (opcional)
                </span>
              )}
            </span>
            <div className="bg-muted/40 flex gap-1 rounded-xl p-1">
              <Button
                type="button"
                size="sm"
                variant={effectiveVideoMode === "post" ? "secondary" : "ghost"}
                className="h-7 cursor-pointer rounded-lg px-2.5 text-xs"
                onClick={() => setVideoMode("post")}
                disabled={disabled}
              >
                <ListBullets className="size-3.5" />
                Da lista
              </Button>
              <Button
                type="button"
                size="sm"
                variant={effectiveVideoMode === "manual" ? "secondary" : "ghost"}
                className="h-7 cursor-pointer rounded-lg px-2.5 text-xs"
                onClick={() => setVideoMode("manual")}
                disabled={disabled || requirements.requiresVideo}
                title={
                  requirements.requiresVideo
                    ? "No aviso formal e na advertência 1 o vídeo vem da lista: é ele que deixa de pontuar"
                    : undefined
                }
              >
                <LinkIcon className="size-3.5" />
                Link manual
              </Button>
            </div>
          </div>

          {effectiveVideoMode === "manual" ? (
            <div className="flex flex-col gap-1.5">
              <Input
                value={manualUrl}
                onChange={(event) => setManualUrl(event.target.value)}
                placeholder="https://..."
                className="h-10 rounded-xl"
                disabled={disabled}
              />
              <p className="text-muted-foreground text-xs">
                Fica registrado como referência; não invalida nenhum vídeo.
              </p>
            </div>
          ) : !campaignId ? (
            <p className="text-muted-foreground border-border/60 rounded-2xl border border-dashed px-3.5 py-3 text-xs">
              Selecione uma competição para escolher o vídeo.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {selectedPost && (
                <PostRow post={selectedPost} selected onToggle={() => setSelectedPost(null)} disabled={disabled} />
              )}
              <div className="relative">
                <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={postSearch}
                  onChange={(event) => setPostSearch(event.target.value)}
                  placeholder="Buscar pelo link do vídeo..."
                  className="h-9 rounded-xl pl-9"
                  disabled={disabled}
                />
              </div>
              <div className="border-border/60 flex max-h-64 flex-col gap-1.5 overflow-y-auto rounded-2xl border p-1.5">
                {postsQuery.isLoading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <Bone key={index} delay={index * 80} className="h-14 w-full rounded-xl" />
                  ))
                ) : postsQuery.isError ? (
                  <p className="text-muted-foreground px-2 py-4 text-center text-xs">
                    Não foi possível carregar os vídeos.
                  </p>
                ) : (postsQuery.data ?? []).length === 0 ? (
                  <p className="text-muted-foreground px-2 py-4 text-center text-xs">
                    {debouncedSearch
                      ? "Nenhum vídeo encontrado para essa busca."
                      : "O clipador não enviou vídeos nesta competição."}
                  </p>
                ) : (
                  (postsQuery.data ?? [])
                    .filter((post) => post.id !== selectedPost?.id)
                    .map((post) => (
                      <PostRow
                        key={post.id}
                        post={post}
                        selected={false}
                        onToggle={() => setSelectedPost(post)}
                        disabled={disabled}
                      />
                    ))
                )}
              </div>
              {(postsQuery.data ?? []).length >= 50 && (
                <p className="text-muted-foreground text-[11px]">
                  Mostrando os 50 vídeos mais recentes. Use a busca para achar
                  outros.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Inelegível ao pódio */}
        {requirements.allowsPodium && (
          <div className="border-border/60 flex flex-col gap-3 rounded-2xl border px-3.5 py-3">
            <div className="flex items-start justify-between gap-3">
              <Label
                htmlFor="warning-podium"
                className="flex cursor-pointer items-start gap-2.5"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Medal className="size-4" weight="fill" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold">Inelegível ao pódio</span>
                  <span className="text-muted-foreground text-xs font-normal">
                    Os vídeos do dia ficam fora dos rankings daquele dia
                    (diário e Top Clipadores) e continuam no mensal
                  </span>
                </span>
              </Label>
              <Switch
                id="warning-podium"
                checked={podiumEnabled}
                onCheckedChange={setPodiumEnabled}
                disabled={disabled}
                className="mt-1 cursor-pointer"
              />
            </div>
            {podiumEnabled && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="warning-podium-date" className="text-sm font-bold">
                  Dia do ranking
                </Label>
                <Input
                  id="warning-podium-date"
                  type="date"
                  value={podiumDate}
                  max={openRankingDateYmd(now)}
                  onChange={(event) => setPodiumDate(event.target.value)}
                  className="h-10 rounded-xl sm:max-w-56"
                  disabled={disabled}
                />
                <p
                  className={cn(
                    "text-xs",
                    podiumDateError ? "text-red-500" : "text-muted-foreground",
                  )}
                >
                  {podiumDateError ??
                    (() => {
                      const window = rankingDayWindowUtc(podiumDate)
                      return `Vídeos postados de ${formatBrtShort(window.startDate)} a ${formatBrtShort(window.endDate)} (horário de Brasília)`
                    })()}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Motivo */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="warning-reason" className="text-sm font-bold">
            Motivo<span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="warning-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Ex.: vídeo sem a hashtag obrigatória #exemplo"
            className="rounded-xl"
            disabled={disabled}
          />
          <p className="text-muted-foreground text-right text-[11px]">
            {reason.length}/2000 · o clipador vê este texto
          </p>
        </div>

        {/* Confirmação do banimento */}
        {requirements.requiresBanConfirmation && (
          <div className="flex flex-col gap-1.5 rounded-2xl border border-red-500/40 bg-red-500/10 p-3.5">
            <Label
              htmlFor="warning-ban-confirmation"
              className="text-sm font-bold text-red-700 dark:text-red-400"
            >
              Digite {BAN_CONFIRMATION_WORD} para confirmar o banimento
            </Label>
            <Input
              id="warning-ban-confirmation"
              value={banConfirmation}
              onChange={(event) => setBanConfirmation(event.target.value)}
              placeholder={BAN_CONFIRMATION_WORD}
              autoComplete="off"
              className="h-10 rounded-xl font-mono uppercase"
              disabled={disabled}
            />
          </div>
        )}

        {/* Resumo das consequências */}
        <div
          className={cn(
            "flex flex-col gap-2 rounded-2xl border p-3.5",
            dangerous
              ? "border-red-500/30 bg-red-500/[0.06]"
              : "border-border/60 bg-muted/20",
          )}
        >
          <p className="text-sm font-bold">
            O que vai acontecer ·{" "}
            {warningLevelLabel(infractionType, level)}
          </p>
          <ul className="flex flex-col gap-1.5">
            {summary.map((line) => (
              <li key={line.text} className="flex items-start gap-2 text-xs sm:text-sm">
                {line.tone === "info" ? (
                  <Info className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                ) : (
                  <WarningCircle
                    className={cn(
                      "mt-0.5 size-3.5 shrink-0",
                      line.tone === "danger"
                        ? "text-red-500"
                        : "text-amber-500",
                    )}
                    weight="fill"
                  />
                )}
                <span
                  className={cn(line.tone === "info" && "text-muted-foreground")}
                >
                  {line.text}
                </span>
              </li>
            ))}
          </ul>
          {missing.length > 0 && (
            <p className="text-muted-foreground text-xs">
              Falta preencher: {missing.join(", ")}.
            </p>
          )}
        </div>
      </div>

      <div className="border-border/60 bg-muted/20 flex shrink-0 flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end sm:p-6">
        <Button
          variant="outline"
          className="h-10 cursor-pointer rounded-xl"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancelar
        </Button>
        <Button
          className={cn(
            "h-10 cursor-pointer rounded-xl font-semibold",
            dangerous
              ? "bg-red-600 text-white hover:bg-red-700"
              : "btn-gradient-auth",
          )}
          onClick={handleSubmit}
          disabled={disabled || isPending || missing.length > 0}
        >
          {isPending ? (
            <>
              <CircleNotch className="size-4 animate-spin" />
              Aplicando...
            </>
          ) : (
            <>
              <CheckCircle className="size-4" weight="fill" />
              {isSevere
                ? "Registrar infração grave"
                : level === MAX_WARNING_LEVEL
                  ? "Banir e aplicar advertência 4"
                  : `Aplicar ${warningLevelLabel(infractionType, level).toLowerCase()}`}
            </>
          )}
        </Button>
      </div>
    </>
  )
}

/** Linha de vídeo escolhível: URL, plataforma, status e views. */
function PostRow({
  post,
  selected,
  onToggle,
  disabled,
}: {
  post: ClipperPost
  selected: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  const platform = platformConfig[post.platform as PlatformKey]
  const PlatformIcon = platform?.icon
  const status = CLIP_POST_STATUS_LABELS[post.status]
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-2.5 py-2",
        selected
          ? "border-[var(--brand-cyan)]/60 bg-[var(--brand-cyan)]/10"
          : "hover:bg-muted/40 border-transparent",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={selected}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left disabled:cursor-not-allowed"
      >
        {PlatformIcon ? (
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg",
              platform.bgColor,
              platform.color,
            )}
          >
            <PlatformIcon className="size-4" />
          </span>
        ) : null}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-xs font-medium">{post.submittedUrl}</span>
          <span className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-[11px]">
            {status && (
              <Badge
                variant="outline"
                className={cn("rounded-full px-1.5 py-0 text-[10px]", status.className)}
              >
                {status.label}
              </Badge>
            )}
            <span className="inline-flex items-center gap-0.5">
              <Eye className="size-3" />
              {formatCompact(Number(post.views))}
            </span>
            <span>
              {formatBrtDateTime(post.postedAt ?? post.createdAt)}
            </span>
          </span>
        </span>
        {selected ? (
          <CheckCircle className="size-4.5 shrink-0 text-[var(--brand-cyan)]" weight="fill" />
        ) : null}
      </button>
      <a
        href={post.submittedUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Abrir vídeo"
        className="text-muted-foreground hover:text-foreground shrink-0"
      >
        <ArrowSquareOut className="size-4" />
      </a>
    </div>
  )
}
