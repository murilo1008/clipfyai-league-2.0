"use client"

import * as React from "react"
import type {
  ClipperInfractionType,
  ClipperSanctionType,
  ClipperWarningStatus,
} from "@prisma/client"
import {
  Clock,
  Crown,
  Eye,
  Gift,
  Prohibit,
  TrendDown,
  Wallet,
} from "@phosphor-icons/react"
import { formatInTimeZone } from "date-fns-tz"

import { Badge } from "@/components/ui/badge"
import {
  INFRACTION_TYPE_LABELS,
  SANCTION_TYPE_LABELS,
  WARNING_STATUS_LABELS,
} from "@/lib/clipper-discipline/levels"
import { formatScoreMultiplier } from "@/lib/clipper-discipline/score-multiplier"
import type { DisciplineSettings } from "@/lib/clipper-discipline/settings"
import { cn } from "@/lib/utils"
import { api, type RouterOutputs } from "@/trpc/react"

/* ============================================================
   Datas — sempre no horário de Brasília
   ============================================================ */

export const DISCIPLINE_TIME_ZONE = "America/Sao_Paulo"

/** "16/10/2026 às 14:30" (horário de Brasília). */
export function formatBrtDateTime(date: Date | string) {
  return formatInTimeZone(
    new Date(date),
    DISCIPLINE_TIME_ZONE,
    "dd/MM/yyyy 'às' HH:mm",
  )
}

/** "16/10 às 14:30" (horário de Brasília). */
export function formatBrtShort(date: Date | string) {
  return formatInTimeZone(new Date(date), DISCIPLINE_TIME_ZONE, "dd/MM 'às' HH:mm")
}

/** "16/10/2026" (horário de Brasília). */
export function formatBrtDate(date: Date | string) {
  return formatInTimeZone(new Date(date), DISCIPLINE_TIME_ZONE, "dd/MM/yyyy")
}

/** "2026-10-16" (dia corrente em Brasília), para inputs type=date. */
export function brtYmd(date: Date | string) {
  return formatInTimeZone(new Date(date), DISCIPLINE_TIME_ZONE, "yyyy-MM-dd")
}

/** "Agora" que avança sozinho, para status que dependem do relógio. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(interval)
  }, [intervalMs])
  return now
}

/** "24 h", "72 h", "7 dias" — duração de uma janela de punição. */
export function formatSanctionDuration(
  startsAt: Date | string,
  endsAt: Date | string | null,
) {
  if (!endsAt) return null
  const hours = Math.round(
    (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 3_600_000,
  )
  if (hours <= 0) return null
  if (hours <= 72) return `${hours} h`
  const days = Math.round(hours / 24)
  return `${days} ${days === 1 ? "dia" : "dias"}`
}

export function formatBRLAmount(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

/* ============================================================
   Punições (ClipperSanction)
   ============================================================ */

export type SanctionView = {
  type: ClipperSanctionType
  startsAt: Date
  endsAt: Date | null
  scoreMultiplierBps: number | null
  revokedAt: Date | null
  campaign?: { name: string } | null
  /** DAY_POINTS_RESET e PODIUM_INELIGIBLE: dia do ranking (YYYY-MM-DD). */
  rankingDate?: string | null
}

/** Punições pontuais: valem no momento em que são aplicadas, sem janela. */
const ONE_OFF_SANCTIONS: ClipperSanctionType[] = [
  "VIDEO_INVALIDATION",
  "DAY_POINTS_RESET",
  "PODIUM_INELIGIBLE",
]

/** Encerradas só revogando a advertência (o servidor recusa revokeSanction). */
const WARNING_ONLY_SANCTIONS: ClipperSanctionType[] = [
  "PLATFORM_BAN",
  "COMPETITION_REMOVAL",
]

/** "Redutor de pontuação ×0,8" ou o rótulo do tipo. */
export function sanctionLabel(sanction: Pick<SanctionView, "type" | "scoreMultiplierBps">) {
  if (sanction.type === "SCORE_MULTIPLIER" && sanction.scoreMultiplierBps) {
    return `${SANCTION_TYPE_LABELS.SCORE_MULTIPLIER} ${formatScoreMultiplier(sanction.scoreMultiplierBps)}`
  }
  return SANCTION_TYPE_LABELS[sanction.type]
}

/** Frase completa: "Suspensão de envio até 18/10/2026 às 14:30". */
export function describeSanction(sanction: SanctionView) {
  const label = sanctionLabel(sanction)
  const campaignName = sanction.campaign?.name
  switch (sanction.type) {
    case "VIDEO_INVALIDATION":
      return "Vídeo invalidado (não pontua)"
    case "COMPETITION_REMOVAL":
      return campaignName ? `Removido da competição ${campaignName}` : label
    case "DAY_POINTS_RESET": {
      const day = sanction.rankingDate
        ? ` (${sanction.rankingDate.split("-").reverse().join("/")})`
        : ""
      return campaignName ? `${label}${day} em ${campaignName}` : `${label}${day}`
    }
    case "PODIUM_INELIGIBLE": {
      const day = sanction.rankingDate
        ? `: vídeos de ${sanction.rankingDate.split("-").reverse().join("/")} fora dos rankings do dia`
        : ""
      return campaignName ? `${label}${day} em ${campaignName}` : `${label}${day}`
    }
    case "PLATFORM_BAN":
      return label
    case "PAYOUT_HOLD":
    case "OBSERVATION_MODE":
      return sanction.endsAt
        ? `${label} até ${formatBrtDateTime(sanction.endsAt)}`
        : `${label} até liberação pela equipe`
    default:
      return sanction.endsAt
        ? `${label} até ${formatBrtDateTime(sanction.endsAt)}`
        : label
  }
}

export type SanctionState = "active" | "finished" | "revoked" | "applied"

export function sanctionState(sanction: SanctionView, now: Date): SanctionState {
  if (sanction.revokedAt && new Date(sanction.revokedAt) <= now) return "revoked"
  if (ONE_OFF_SANCTIONS.includes(sanction.type)) return "applied"
  if (sanction.endsAt && new Date(sanction.endsAt) <= now) return "finished"
  return "active"
}

export const SANCTION_STATE_META: Record<
  SanctionState,
  { label: string; className: string }
> = {
  active: {
    label: "Em vigor",
    className:
      "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  applied: {
    label: "Aplicada",
    className: "border-border bg-muted/50 text-muted-foreground",
  },
  finished: {
    label: "Cumprida",
    className: "border-border bg-muted/50 text-muted-foreground",
  },
  revoked: {
    label: "Encerrada",
    className:
      "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
}

/**
 * Ação de encerrar uma punição avulsa ou da advertência: "Liberar pagamento"
 * na retenção, "Desfazer" na zeragem do dia, "Encerrar" nas demais. null
 * quando não cabe (já encerrada, cumprida ou só sai revogando a advertência).
 */
export function sanctionEndAction(
  sanction: SanctionView,
  now: Date,
  { linkedToWarning }: { linkedToWarning: boolean },
): string | null {
  if (WARNING_ONLY_SANCTIONS.includes(sanction.type)) return null
  const state = sanctionState(sanction, now)
  if (state === "revoked" || state === "finished") return null
  if (sanction.type === "VIDEO_INVALIDATION") return null
  if (sanction.type === "DAY_POINTS_RESET") {
    // Na advertência, a zeragem é desfeita revogando a advertência.
    return linkedToWarning ? null : "Desfazer"
  }
  // O pódio guarda os próprios efeitos: dá para desfazer mesmo na advertência.
  if (sanction.type === "PODIUM_INELIGIBLE") return "Desfazer"
  if (sanction.type === "PAYOUT_HOLD") return "Liberar pagamento"
  return "Encerrar"
}

/* ============================================================
   Advertências (ClipperWarning)
   ============================================================ */

/** O que cada nível da escala faz, com os valores do painel. */
export function levelDescription(level: number, settings: DisciplineSettings) {
  switch (level) {
    case 0:
      return "Aviso formal: o vídeo da infração não pontua"
    case 1:
      return `Vídeo invalidado + suspensão de envio de ${settings.level1SuspensionHours} h`
    case 2:
      return `Suspensão de envio de ${settings.level2SuspensionHours} h + redutor ${formatScoreMultiplier(settings.level2ScoreMultiplierBps)} por ${settings.level2ScoreMultiplierDays} ${settings.level2ScoreMultiplierDays === 1 ? "dia" : "dias"}`
    case 3:
      return "Removido da competição + estorno de todos os prêmios dela já creditados na carteira"
    case 4:
      return "Banimento: bloqueio da conta, saída das competições ativas e carteira retida"
    default:
      return ""
  }
}

export const SEVERE_DESCRIPTION =
  "Removido da competição com estorno dos prêmios dela + pagamento retido + análise de banimento"

export const INFRACTION_TYPE_BADGE: Record<ClipperInfractionType, string> = {
  LIGHT: "border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-400",
  MEDIUM:
    "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400",
  SEVERE: "border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-400",
}

export const WARNING_STATUS_BADGE: Record<ClipperWarningStatus, string> = {
  ACTIVE: "border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-400",
  EXPIRED: "border-border bg-muted/50 text-muted-foreground",
  REVOKED:
    "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
}

export function InfractionTypeBadge({
  type,
  className,
}: {
  type: ClipperInfractionType
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("rounded-full", INFRACTION_TYPE_BADGE[type], className)}
    >
      {INFRACTION_TYPE_LABELS[type]}
    </Badge>
  )
}

export function WarningStatusBadge({
  status,
  className,
}: {
  status: ClipperWarningStatus
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("rounded-full", WARNING_STATUS_BADGE[status], className)}
    >
      {WARNING_STATUS_LABELS[status]}
    </Badge>
  )
}

export function SanctionStateBadge({
  state,
  className,
}: {
  state: SanctionState
  className?: string
}) {
  const meta = SANCTION_STATE_META[state]
  return (
    <Badge
      variant="outline"
      className={cn("rounded-full text-[10px]", meta.className, className)}
    >
      {meta.label}
    </Badge>
  )
}

export const CLIP_POST_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  PENDING: {
    label: "Pendente",
    className: "border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-400",
  },
  ELIGIBLE: {
    label: "Elegível",
    className:
      "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  INELIGIBLE: {
    label: "Inelegível",
    className:
      "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  DISQUALIFIED: {
    label: "Desclassificado",
    className: "border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-400",
  },
}

/* ============================================================
   Restrições do clipador (myStatus / historyByClipper)
   ============================================================ */

type Restrictions =
  RouterOutputs["clipperDiscipline"]["historyByClipper"]["restrictions"]

/** Fim de uma janela de restrição em texto curto ("até 18/10 às 14:30"). */
function untilText(endsAt: Date | null, openEnded = "até liberar") {
  return endsAt ? `até ${formatBrtShort(endsAt)}` : openEnded
}

export type RestrictionItem = {
  key: string
  icon: React.ReactNode
  label: string
  className: string
}

/** Restrições em vigor como itens de badge (vazio quando não há nenhuma). */
export function restrictionItems(restrictions: Restrictions): RestrictionItem[] {
  const items: RestrictionItem[] = []
  const red = "border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-400"
  const amber =
    "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400"
  const violet =
    "border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-400"

  if (restrictions.banned) {
    items.push({
      key: "banned",
      icon: <Prohibit className="size-3" weight="fill" />,
      label: "Banido",
      className: "border-red-900/40 bg-red-900/25 text-red-700 dark:text-red-300",
    })
  }
  if (restrictions.suspension) {
    items.push({
      key: "suspension",
      icon: <Clock className="size-3" weight="fill" />,
      label: `Suspenso até ${formatBrtShort(restrictions.suspension.endsAt)}`,
      className: red,
    })
  }
  if (restrictions.scoreMultiplier) {
    items.push({
      key: "multiplier",
      icon: <TrendDown className="size-3" weight="bold" />,
      label: `Redutor ${formatScoreMultiplier(restrictions.scoreMultiplier.bps)} ${untilText(restrictions.scoreMultiplier.endsAt, "sem prazo")}`,
      className: amber,
    })
  }
  if (restrictions.payoutHold) {
    items.push({
      key: "payout",
      icon: <Wallet className="size-3" weight="fill" />,
      label: "Pagamento retido",
      className: red,
    })
  }
  if (restrictions.observation) {
    items.push({
      key: "observation",
      icon: <Eye className="size-3" weight="fill" />,
      label: `Em observação ${untilText(restrictions.observation.endsAt)}`,
      className: amber,
    })
  }
  if (restrictions.premiumBlock) {
    items.push({
      key: "premium",
      icon: <Crown className="size-3" weight="fill" />,
      label: `Bloqueio premium ${untilText(restrictions.premiumBlock.endsAt)}`,
      className: violet,
    })
  }
  if (restrictions.bonusLoss) {
    items.push({
      key: "bonus",
      icon: <Gift className="size-3" weight="fill" />,
      label: `Sem bônus ${untilText(restrictions.bonusLoss.endsAt)}`,
      className: violet,
    })
  }
  return items
}

export function RestrictionBadges({
  restrictions,
  emptyText,
  className,
}: {
  restrictions: Restrictions
  /** Texto quando não há restrição; sem ele, nada é renderizado. */
  emptyText?: string
  className?: string
}) {
  const items = restrictionItems(restrictions)
  if (items.length === 0) {
    return emptyText ? (
      <p className={cn("text-muted-foreground text-sm", className)}>
        {emptyText}
      </p>
    ) : null
  }
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {items.map((item) => (
        <Badge
          key={item.key}
          variant="outline"
          title={
            item.key === "payout" && restrictions.payoutHold?.reasons.length
              ? restrictions.payoutHold.reasons.join(" · ")
              : undefined
          }
          className={cn("gap-1 rounded-full", item.className)}
        >
          {item.icon}
          {item.label}
        </Badge>
      ))}
    </div>
  )
}

/* ============================================================
   Estado do próprio clipador (myStatus)
   ============================================================ */

/** setTimeout aceita no máximo ~24,8 dias. */
const MAX_TIMEOUT_MS = 2_147_000_000

/**
 * Restrições do clipador logado (banner, envio de posts, sidebar, financeiro).
 * Cache de ~60 s; quando a suspensão termina, busca de novo sozinho para
 * liberar o envio sem recarregar a página.
 */
export function useMyDisciplineStatus({ enabled = true }: { enabled?: boolean } = {}) {
  const query = api.clipperDiscipline.myStatus.useQuery(undefined, {
    enabled,
    staleTime: 60_000,
  })
  const { refetch } = query
  const suspensionEndMs = query.data?.suspension
    ? new Date(query.data.suspension.endsAt).getTime()
    : null

  React.useEffect(() => {
    if (suspensionEndMs === null || !enabled) return
    const delay = suspensionEndMs - Date.now()
    if (delay > MAX_TIMEOUT_MS) return
    const timer = setTimeout(() => void refetch(), Math.max(delay, 0) + 1_500)
    return () => clearTimeout(timer)
  }, [suspensionEndMs, enabled, refetch])

  return query
}
