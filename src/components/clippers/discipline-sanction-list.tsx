"use client"

import type { ClipperSanctionType } from "@prisma/client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
  SanctionStateBadge,
  describeSanction,
  formatBrtDateTime,
  formatSanctionDuration,
  sanctionEndAction,
  sanctionState,
} from "./discipline-shared"

export type SanctionListItem = {
  id: string
  type: ClipperSanctionType
  startsAt: Date
  endsAt: Date | null
  scoreMultiplierBps: number | null
  reason: string | null
  revokedAt: Date | null
  revokeReason: string | null
  campaign: { name: string } | null
}

/**
 * Punições com descrição, duração e status. Com `onEnd`, mostra a ação de
 * encerrar ("Encerrar", "Liberar pagamento", "Desfazer") onde ela cabe.
 */
export function SanctionList({
  sanctions,
  now,
  linkedToWarning,
  showReason = false,
  onEnd,
  emptyText = "Nenhuma punição",
  className,
}: {
  sanctions: SanctionListItem[]
  now: Date
  /** Punições da escala (algumas só saem revogando a advertência). */
  linkedToWarning: boolean
  showReason?: boolean
  onEnd?: (sanction: SanctionListItem, actionLabel: string, description: string) => void
  emptyText?: string
  className?: string
}) {
  if (sanctions.length === 0) {
    return (
      <p className={cn("text-muted-foreground text-xs", className)}>{emptyText}</p>
    )
  }
  return (
    <ul className={cn("flex flex-col gap-1.5", className)}>
      {sanctions.map((sanction) => {
        const state = sanctionState(sanction, now)
        const description = describeSanction(sanction)
        const duration = formatSanctionDuration(sanction.startsAt, sanction.endsAt)
        const action = onEnd
          ? sanctionEndAction(sanction, now, { linkedToWarning })
          : null
        return (
          <li
            key={sanction.id}
            className="border-border/60 bg-background/40 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p
                className={cn(
                  "text-xs font-semibold sm:text-sm",
                  (state === "revoked" || state === "finished") &&
                    "text-muted-foreground line-through decoration-1",
                )}
              >
                {description}
              </p>
              <p className="text-muted-foreground text-[11px]">
                {duration ? `Duração: ${duration} · ` : ""}desde{" "}
                {formatBrtDateTime(sanction.startsAt)}
                {state === "revoked" && sanction.revokedAt
                  ? ` · encerrada em ${formatBrtDateTime(sanction.revokedAt)}${sanction.revokeReason ? ` — ${sanction.revokeReason}` : ""}`
                  : ""}
              </p>
              {showReason && sanction.reason && (
                <p className="text-muted-foreground text-[11px]">
                  Motivo: {sanction.reason}
                </p>
              )}
            </div>
            <SanctionStateBadge state={state} />
            {action && onEnd && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 cursor-pointer rounded-lg px-2.5 text-xs"
                onClick={() => onEnd(sanction, action, description)}
              >
                {action}
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
