"use client"

import * as React from "react"
import {
  Archive,
  CheckCircle,
  Clock,
  Eye,
  Pause,
  Play,
  Prohibit,
  Spinner,
  VideoCamera,
  Warning,
  XCircle,
} from "@phosphor-icons/react"
import { format } from "date-fns"
import { formatInTimeZone } from "date-fns-tz"
import { ptBR } from "date-fns/locale"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useFinancialVisibility } from "@/contexts/financial-visibility-context"
import { cn } from "@/lib/utils"
import type { RouterOutputs } from "@/trpc/react"

/* ============================================================
   Tipos compartilhados da página da competição (admin)
   ============================================================ */

export type CompetitionDetails =
  RouterOutputs["admin"]["getCompetitionDetailsAdmin"]

export type AdminApplication =
  RouterOutputs["admin"]["getCompetitionApplicationsAdmin"]["applications"][number]

export interface CompetitionTabProps {
  slug: string
  campaignId: string
  data: CompetitionDetails
  /** Se a tab está ativa (use nos `enabled` das queries lazy). */
  active: boolean
  refetch: () => void
}

/* ============================================================
   Configs
   ============================================================ */

export const CAMPAIGN_STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; badge: string; dot: string }
> = {
  ACTIVE: {
    label: "Ativa",
    icon: Play,
    badge:
      "border-emerald-500/30 bg-emerald-500/15 text-emerald-500 dark:text-emerald-400",
    dot: "bg-emerald-400",
  },
  SCHEDULED: {
    label: "Agendada",
    icon: Clock,
    badge: "border-sky-500/30 bg-sky-500/15 text-sky-600 dark:text-sky-400",
    dot: "bg-sky-400",
  },
  PAUSED: {
    label: "Pausada",
    icon: Pause,
    badge:
      "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-400",
  },
  COMPLETED: {
    label: "Concluída",
    icon: CheckCircle,
    badge:
      "border-violet-500/30 bg-violet-500/15 text-violet-600 dark:text-violet-400",
    dot: "bg-violet-400",
  },
  ARCHIVED: {
    label: "Arquivada",
    icon: Archive,
    badge: "border-border bg-muted/50 text-muted-foreground",
    dot: "bg-zinc-400",
  },
  DRAFT: {
    label: "Rascunho",
    icon: Warning,
    badge:
      "border-orange-500/30 bg-orange-500/15 text-orange-600 dark:text-orange-400",
    dot: "bg-orange-400",
  },
}

export const APPLICATION_STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; badge: string; dot: string }
> = {
  PENDING: {
    label: "Pendente",
    icon: Clock,
    badge:
      "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-400",
  },
  UNDER_REVIEW: {
    label: "Em Revisão",
    icon: Eye,
    badge: "border-sky-500/30 bg-sky-500/15 text-sky-600 dark:text-sky-400",
    dot: "bg-sky-400",
  },
  APPROVED: {
    label: "Aprovado",
    icon: CheckCircle,
    badge:
      "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-400",
  },
  REJECTED: {
    label: "Rejeitado",
    icon: XCircle,
    badge: "border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400",
    dot: "bg-red-400",
  },
  REVOKED: {
    label: "Revogado",
    icon: Prohibit,
    badge:
      "border-orange-500/30 bg-orange-500/15 text-orange-600 dark:text-orange-400",
    dot: "bg-orange-400",
  },
}

export const CLIP_POST_STATUS_CONFIG: Record<
  string,
  { label: string; badge: string; dot: string }
> = {
  ELIGIBLE: {
    label: "Elegível",
    badge:
      "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-400",
  },
  PENDING: {
    label: "Pendente",
    badge:
      "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-400",
  },
  INELIGIBLE: {
    label: "Inelegível",
    badge: "border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400",
    dot: "bg-red-400",
  },
  DISQUALIFIED: {
    label: "Desqualificado",
    badge: "border-border bg-muted/50 text-muted-foreground",
    dot: "bg-zinc-400",
  },
}

/** Cores dos gráficos por plataforma (pie/área). */
export const PLATFORM_CHART_COLORS: Record<string, string> = {
  INSTAGRAM: "#ec4899",
  TIKTOK: "#22d3ee",
  YOUTUBE: "#ef4444",
  KWAI: "#f97316",
  FACEBOOK: "#3b82f6",
}

export const PLATFORM_GROWTH_COLORS: Record<
  string,
  { stroke: string; label: string }
> = {
  TIKTOK: { stroke: "hsl(199,90%,50%)", label: "TikTok" },
  INSTAGRAM: { stroke: "hsl(330,80%,55%)", label: "Instagram" },
  YOUTUBE: { stroke: "hsl(0,80%,55%)", label: "YouTube" },
  KWAI: { stroke: "hsl(38,90%,55%)", label: "Kwai" },
  FACEBOOK: { stroke: "hsl(220,80%,55%)", label: "Facebook" },
}

/** Competições com ranking especial "Top Postadores do Dia". */
export const TOP_POSTERS_DAILY_COMPETITION_IDS = [
  "cmnunyzlw0009id04vleej0rs",
  "cmns7eoo10001jx04nevch2rp",
]

export const CLIP_POST_SUBMIT_DISPLAY_OFFSET_MS = 3 * 60 * 60 * 1000

/* ============================================================
   Helpers de formatação
   ============================================================ */

export function formatNumber(value: number): string {
  if (value >= 1_000_000)
    return `${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`
  if (value >= 1_000)
    return `${(value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}K`
  return Math.round(value).toLocaleString("pt-BR")
}

/** Inteiro completo com separador pt-BR, tolerante a bigint/string. */
export function formatMetricFull(value: number | string | bigint): string {
  const num = typeof value === "bigint" ? Number(value) : Number(value ?? 0)
  if (!Number.isFinite(num)) return "0"
  return Math.round(num).toLocaleString("pt-BR")
}

/** Moeda BRL sem casas decimais — SEM máscara (use em exports/CSV). */
export function formatCurrencyPlain(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  })
}

/**
 * Moeda BRL respeitando o toggle de visibilidade financeira da topbar
 * (retorna "••••••" quando oculto). Use em TODOS os valores monetários
 * exibidos na página.
 */
export function useFormatCurrency() {
  const { isVisible } = useFinancialVisibility()
  return React.useCallback(
    (value: number) => (isVisible ? formatCurrencyPlain(value) : "••••••"),
    [isVisible],
  )
}

export function formatDateLong(date: string | Date): string {
  return format(new Date(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
}

export function formatYmdToDmy(ymd: string): string {
  const [year, month, day] = ymd.split("-")
  return `${day}/${month}/${year}`
}

/** Mantém o relógio do instante ISO (exibe em UTC). */
export function formatIsoInstantBrasil(iso: string): string {
  return formatInTimeZone(iso, "UTC", "dd/MM/yyyy HH:mm", { locale: ptBR })
}

export function formatClipPostListedAt(
  postedAt: string | null,
  createdAt: string,
): string {
  if (postedAt) {
    return formatInTimeZone(postedAt, "UTC", "dd/MM/yy 'às' HH:mm", {
      locale: ptBR,
    })
  }
  const adjusted = new Date(
    new Date(createdAt).getTime() - CLIP_POST_SUBMIT_DISPLAY_OFFSET_MS,
  )
  return formatInTimeZone(adjusted.toISOString(), "UTC", "dd/MM/yy 'às' HH:mm", {
    locale: ptBR,
  })
}

/** Data de hoje (YYYY-MM-DD) no fuso de São Paulo. */
export function getDailyRankPickerDateBrasil(): string {
  return formatInTimeZone(new Date(), "America/Sao_Paulo", "yyyy-MM-dd")
}

/** Igual acima, mas antes das 6h BRT usa o dia anterior. */
export function getDailyRankReferenceDateBrasil(): string {
  const now = new Date()
  const hour = Number(formatInTimeZone(now, "America/Sao_Paulo", "H"))
  if (hour < 6) {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    return formatInTimeZone(yesterday, "America/Sao_Paulo", "yyyy-MM-dd")
  }
  return formatInTimeZone(now, "America/Sao_Paulo", "yyyy-MM-dd")
}

export function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function detectPlatformFromPostUrl(url: string): string | null {
  const lower = url.toLowerCase()
  if (lower.includes("instagram.com")) return "INSTAGRAM"
  if (lower.includes("tiktok.com")) return "TIKTOK"
  if (lower.includes("youtube.com") || lower.includes("youtu.be"))
    return "YOUTUBE"
  if (lower.includes("kwai.com")) return "KWAI"
  if (lower.includes("facebook.com")) return "FACEBOOK"
  return null
}

/** number ou string pt-BR ("1.234,56") → number. */
export function parsePixPreviewNumber(value: unknown): number {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const normalized = value.replace(/\./g, "").replace(",", ".")
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

/** Baixa um arquivo de texto (md/csv) no navegador. */
export function downloadTextFile(
  filename: string,
  content: string,
  mime = "text/plain",
  withBom = false,
) {
  const blob = new Blob([withBom ? "﻿" + content : content], {
    type: `${mime};charset=utf-8`,
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

/* ============================================================
   Blocos de UI compartilhados
   ============================================================ */

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
  className,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "border-border/60 bg-muted/10 flex flex-col items-center gap-3 rounded-2xl border py-12 text-center",
        className,
      )}
    >
      <span className="bg-gradient-custom flex size-12 items-center justify-center rounded-2xl text-[#04222A]">
        {icon}
      </span>
      <div className="px-4">
        <p className="text-sm font-bold">{title}</p>
        {subtitle && (
          <p className="text-muted-foreground mt-0.5 text-xs">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  )
}

/** Input de confirmação por palavra (PAGAR / DELETAR / CONFIRMAR / DESCLASSIFICAR). */
export function ConfirmWordInput({
  word,
  value,
  onChange,
  id,
}: {
  word: string
  value: string
  onChange: (value: string) => void
  id?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id ?? `confirm-${word.toLowerCase()}`} className="text-xs">
        Digite <span className="font-mono font-bold">{word}</span> para
        confirmar
      </Label>
      <Input
        id={id ?? `confirm-${word.toLowerCase()}`}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder={word}
        autoComplete="off"
        className="h-11 rounded-xl font-mono tracking-[0.2em] uppercase"
      />
    </div>
  )
}

/** Badge de posição com medalhas para o pódio (1º–3º). */
export function PositionBadge({
  position,
  size = "md",
}: {
  position: number
  size?: "sm" | "md"
}) {
  const medal =
    position === 1
      ? "bg-gradient-to-br from-amber-400 to-yellow-600 text-[#3b2a00]"
      : position === 2
        ? "bg-gradient-to-br from-zinc-300 to-zinc-500 text-zinc-900"
        : position === 3
          ? "bg-gradient-to-br from-orange-400 to-amber-700 text-[#3b1d00]"
          : "bg-muted/60 text-foreground/80"
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl font-black tabular-nums",
        size === "md" ? "size-9 text-sm" : "size-7 text-xs",
        medal,
      )}
    >
      {position}º
    </span>
  )
}

/** Status de post que exigem justificativa visível no card. */
const POST_STATUS_REQUIRING_REASON = ["INELIGIBLE", "DISQUALIFIED"]

/**
 * Aviso vermelho com o motivo da inelegibilidade/desqualificação de um post.
 * Renderiza `null` quando o status não exige justificativa ou não há motivo.
 * Compartilhado entre o card do admin e o card do clipador.
 */
export function IneligibilityReasonNotice({
  status,
  reason,
  className,
}: {
  status?: string | null
  reason?: string | null
  className?: string
}) {
  const trimmedReason = reason?.trim()
  const isDisqualified = status === "DISQUALIFIED"
  const displayReason =
    trimmedReason ||
    (isDisqualified
      ? "Post desqualificado. Nenhum motivo detalhado foi registrado."
      : "")

  if (!POST_STATUS_REQUIRING_REASON.includes(status ?? "") || !displayReason) {
    return null
  }

  return (
    <div
      title={displayReason}
      className={cn(
        "rounded-xl border border-red-500/30 bg-red-500/10 px-2.5 py-2",
        className,
      )}
    >
      <div className="flex items-start gap-1.5">
        <Warning
          aria-hidden
          className="mt-0.5 size-3.5 shrink-0 text-red-500 dark:text-red-400"
          weight="fill"
        />
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-wide text-red-600 uppercase dark:text-red-300">
            Motivo
          </p>
          <p className="mt-0.5 line-clamp-3 text-xs leading-snug font-medium break-words text-red-700 dark:text-red-100">
            {displayReason}
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Placeholder da miniatura de um post quando ainda não há thumbnail.
 * Em `PENDING` mostra o spinner (extração em andamento); nos demais status
 * mostra "Prévia indisponível". Use dentro de um container `relative`.
 */
export function PostPreviewFallback({
  status,
  className,
}: {
  status?: string | null
  className?: string
}) {
  if (status === "PENDING") {
    return (
      <div
        className={cn(
          "bg-muted/60 absolute inset-0 flex items-center justify-center",
          className,
        )}
      >
        <Spinner
          aria-hidden
          className="text-muted-foreground size-8 animate-spin motion-reduce:animate-none"
        />
        <span className="sr-only">Gerando prévia do post…</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#071321] px-2 text-center text-white/60",
        className,
      )}
    >
      <VideoCamera aria-hidden className="size-8" />
      <span className="text-xs font-medium">Prévia indisponível</span>
    </div>
  )
}

/** Par métrica-ícone compacto usado nas listas de ranking/posts. */
export function MetricPill({
  icon,
  value,
  label,
  className,
}: {
  icon: React.ReactNode
  value: string
  label?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "bg-muted/40 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold tabular-nums",
        className,
      )}
    >
      <span className="text-brand-mint not-dark:text-primary">{icon}</span>
      {value}
      {label && (
        <span className="text-muted-foreground font-medium">{label}</span>
      )}
    </span>
  )
}
