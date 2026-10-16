"use client"

import * as React from "react"
import {
  ArrowCounterClockwise,
  ArrowSquareOut,
  ChatText,
  ShieldWarning,
} from "@phosphor-icons/react"

import { SanctionList } from "@/components/clippers/discipline-sanction-list"
import {
  InfractionTypeBadge,
  WarningStatusBadge,
  formatBrtDateTime,
  useNow,
} from "@/components/clippers/discipline-shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { warningLevelLabel } from "@/lib/clipper-discipline/levels"
import { cn } from "@/lib/utils"
import type { RouterOutputs } from "@/trpc/react"

import type { RevokeWarningTarget } from "./revoke-warning-dialog"

/** Advertência como as queries admin devolvem (list, historyByClipper, banReviewQueue). */
export type AdminWarning =
  RouterOutputs["clipperDiscipline"]["list"]["items"][number]

export function clipperDisplayName(
  profile: Pick<AdminWarning["clipperProfile"], "fullName" | "artisticName">,
) {
  return profile.artisticName?.trim() || profile.fullName
}

/** Dados do RevokeWarningDialog a partir de uma advertência. */
export function revokeTargetOf(warning: AdminWarning): RevokeWarningTarget {
  return {
    id: warning.id,
    levelLabel: warningLevelLabel(warning.infractionType, warning.level),
    clipperName: clipperDisplayName(warning.clipperProfile),
  }
}

const BAN_REVIEW_LABELS: Record<string, { label: string; className: string }> = {
  PENDING: {
    label: "Análise de ban pendente",
    className:
      "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  BANNED: {
    label: "Banido na análise",
    className: "border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-400",
  },
  DISMISSED: {
    label: "Análise arquivada",
    className: "border-border bg-muted/50 text-muted-foreground",
  },
}

export function BanReviewBadge({ status }: { status: string | null }) {
  if (!status) return null
  const meta = BAN_REVIEW_LABELS[status]
  if (!meta) return null
  return (
    <Badge variant="outline" className={cn("rounded-full", meta.className)}>
      {meta.label}
    </Badge>
  )
}

/** Todos os dados de uma advertência: vídeo, defesa, sanções e revogação. */
export function WarningDetailsDialog({
  warning,
  open,
  onOpenChange,
  onRevoke,
}: {
  warning: AdminWarning | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Sem ele, o botão "Revogar" não aparece. */
  onRevoke?: (warning: AdminWarning) => void
}) {
  const now = useNow(60_000)
  if (!warning) return null

  const levelLabel = warningLevelLabel(warning.infractionType, warning.level)
  const name = clipperDisplayName(warning.clipperProfile)
  const suggestedLabel =
    warning.infractionType !== "SEVERE" && warning.suggestedLevel !== null
      ? warningLevelLabel(warning.infractionType, warning.suggestedLevel)
      : null
  const canRevoke = !!onRevoke && warning.status !== "REVOKED"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[96vw] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-2xl">
        <DialogHeader className="border-border/60 shrink-0 border-b p-4 text-left sm:p-6">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base font-bold sm:text-lg">
            <ShieldWarning className="size-5 text-red-500" weight="fill" />
            {levelLabel}
            <InfractionTypeBadge type={warning.infractionType} />
            <WarningStatusBadge status={warning.effectiveStatus} />
            <BanReviewBadge status={warning.banReviewStatus} />
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {name} · {warning.clipperProfile.user.email}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
          <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <DetailItem label="Competição">
              {warning.campaign?.name ?? "—"}
            </DetailItem>
            <DetailItem label="Nível">
              {levelLabel}
              {suggestedLabel && suggestedLabel !== levelLabel && (
                <span className="text-muted-foreground text-xs">
                  {" "}
                  (sugerido: {suggestedLabel})
                </span>
              )}
            </DetailItem>
            <DetailItem label="Aplicada em">
              {formatBrtDateTime(warning.appliedAt)}
              <span className="text-muted-foreground block text-xs">
                por {warning.appliedByName ?? "—"}
              </span>
            </DetailItem>
            <DetailItem label="Expira em">
              {warning.status === "REVOKED"
                ? "—"
                : formatBrtDateTime(warning.expiresAt)}
            </DetailItem>
            {warning.banReviewStatus && (
              <DetailItem label="Análise de banimento">
                <BanReviewBadge status={warning.banReviewStatus} />
                {warning.banReviewedAt && (
                  <span className="text-muted-foreground block text-xs">
                    decidida em {formatBrtDateTime(warning.banReviewedAt)}
                  </span>
                )}
              </DetailItem>
            )}
          </dl>

          <Section title="Vídeo">
            {warning.videoUrl ? (
              <a
                href={warning.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex max-w-full items-center gap-1.5 text-sm font-medium break-all underline-offset-4 hover:underline"
              >
                <ArrowSquareOut className="size-4 shrink-0" />
                {warning.videoUrl}
              </a>
            ) : (
              <p className="text-muted-foreground text-sm">
                Nenhum vídeo informado
              </p>
            )}
            {warning.clipPostId && (
              <p className="text-muted-foreground text-xs">
                Vídeo da lista do clipador (deixou de pontuar).
              </p>
            )}
          </Section>

          <Section title="Motivo">
            <p className="text-sm whitespace-pre-wrap">{warning.reason}</p>
          </Section>

          <Section title="Defesa do clipador">
            {warning.defenseText ? (
              <div className="flex flex-col gap-1">
                <p className="flex items-start gap-2 text-sm whitespace-pre-wrap">
                  <ChatText className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  {warning.defenseText}
                </p>
                {warning.defenseSubmittedAt && (
                  <p className="text-muted-foreground text-xs">
                    Enviada em {formatBrtDateTime(warning.defenseSubmittedAt)}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                O clipador ainda não enviou defesa.
              </p>
            )}
          </Section>

          <Section title="Punições">
            <SanctionList
              sanctions={warning.sanctions}
              now={now}
              linkedToWarning
              emptyText="Esta advertência não gerou punições (aviso sem vídeo)."
            />
          </Section>

          {warning.status === "REVOKED" && (
            <Section title="Revogação">
              <p className="text-sm">
                Revogada em{" "}
                {warning.revokedAt ? formatBrtDateTime(warning.revokedAt) : "—"}{" "}
                por {warning.revokedByName ?? "—"}
              </p>
              {warning.revokeReason && (
                <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                  Motivo: {warning.revokeReason}
                </p>
              )}
            </Section>
          )}
        </div>

        {canRevoke && (
          <div className="border-border/60 bg-muted/20 flex shrink-0 justify-end border-t p-4 sm:p-6">
            <Button
              variant="outline"
              className="h-10 cursor-pointer rounded-xl"
              onClick={() => onRevoke(warning)}
            >
              <ArrowCounterClockwise className="size-4" weight="bold" />
              Revogar advertência
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DetailItem({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="border-border/60 bg-muted/20 rounded-2xl border px-3.5 py-2.5">
      <dt className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium">{children}</dd>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}
