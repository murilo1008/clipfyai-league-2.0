"use client"

import * as React from "react"
import { ArrowCounterClockwise, CircleNotch } from "@phosphor-icons/react"
import { toast } from "sonner"

import { formatBRLAmount } from "@/components/clippers/discipline-shared"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/trpc/react"

import { useInvalidateDiscipline } from "./use-invalidate-discipline"

export type RevokeWarningTarget = {
  id: string
  /** "Advertência 2", "Infração grave"... */
  levelLabel: string
  clipperName: string
}

export interface RevokeWarningDialogProps {
  warning: RevokeWarningTarget | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRevoked?: () => void
}

/** Revoga uma advertência: pede o motivo e se os prêmios estornados voltam. */
export function RevokeWarningDialog({
  warning,
  open,
  onOpenChange,
  onRevoked,
}: RevokeWarningDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowCounterClockwise className="size-5" weight="bold" />
            Revogar advertência
          </DialogTitle>
          <DialogDescription>
            {warning
              ? `${warning.levelLabel} de ${warning.clipperName}.`
              : "Advertência"}{" "}
            As punições em vigor são encerradas e os efeitos são desfeitos
            (vídeos invalidados, remoção da competição, banimento). Posições de
            rankings já pagos não mudam.
          </DialogDescription>
        </DialogHeader>
        {open && warning && (
          <RevokeWarningForm
            warning={warning}
            onCancel={() => onOpenChange(false)}
            onRevoked={() => {
              onOpenChange(false)
              onRevoked?.()
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function RevokeWarningForm({
  warning,
  onCancel,
  onRevoked,
}: {
  warning: RevokeWarningTarget
  onCancel: () => void
  onRevoked: () => void
}) {
  const invalidate = useInvalidateDiscipline()
  const [reason, setReason] = React.useState("")
  const [restorePrizes, setRestorePrizes] = React.useState(true)

  const revokeMutation = api.clipperDiscipline.revoke.useMutation({
    onSuccess: (summary) => {
      const details: string[] = []
      if (summary.restoredPosts > 0) {
        details.push(
          `${summary.restoredPosts} ${summary.restoredPosts === 1 ? "vídeo restaurado" : "vídeos restaurados"}`,
        )
      }
      if (summary.restoredApplications > 0) {
        details.push(
          summary.restoredApplications === 1
            ? "inscrição restaurada"
            : `${summary.restoredApplications} inscrições restauradas`,
        )
      }
      if (summary.restoredAmount > 0) {
        details.push(`${formatBRLAmount(summary.restoredAmount)} devolvidos`)
      }
      if (summary.unbanned) details.push("banimento desfeito")
      if (summary.keptLockedEntries > 0) {
        details.push(
          `${summary.keptLockedEntries} ${summary.keptLockedEntries === 1 ? "posição de ranking já pago mantida" : "posições de rankings já pagos mantidas"}`,
        )
      }
      toast.success("Advertência revogada", {
        description: details.length > 0 ? details.join(" · ") : undefined,
      })
      invalidate()
      onRevoked()
    },
    onError: (error) =>
      toast.error(error.message || "Erro ao revogar advertência"),
  })

  const handleSubmit = () => {
    if (reason.trim().length < 3) {
      toast.error("Descreva o motivo da revogação (mínimo de 3 caracteres)")
      return
    }
    revokeMutation.mutate({
      warningId: warning.id,
      reason: reason.trim(),
      restorePrizes,
    })
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="revoke-reason" className="text-sm font-bold">
            Motivo da revogação<span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="revoke-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Ex.: a defesa comprovou que a hashtag estava na legenda"
            className="rounded-xl"
          />
          <p className="text-muted-foreground text-[11px]">
            O clipador recebe este motivo por notificação e e-mail.
          </p>
        </div>
        <div className="border-border/60 bg-muted/20 flex items-start gap-3 rounded-2xl border px-3.5 py-3">
          <Checkbox
            id="revoke-restore-prizes"
            checked={restorePrizes}
            onCheckedChange={(value) => setRestorePrizes(value === true)}
            className="mt-0.5"
          />
          <Label
            htmlFor="revoke-restore-prizes"
            className="flex cursor-pointer flex-col items-start gap-0.5"
          >
            <span className="text-sm font-semibold">
              Devolver os prêmios estornados
            </span>
            <span className="text-muted-foreground text-xs font-normal">
              Credita de volta na carteira os prêmios que esta advertência
              estornou.
            </span>
          </Label>
        </div>
      </div>
      <DialogFooter className="gap-2">
        <Button
          variant="outline"
          className="cursor-pointer rounded-xl"
          onClick={onCancel}
          disabled={revokeMutation.isPending}
        >
          Cancelar
        </Button>
        <Button
          className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
          onClick={handleSubmit}
          disabled={revokeMutation.isPending || reason.trim().length < 3}
        >
          {revokeMutation.isPending ? (
            <>
              <CircleNotch className="size-4 animate-spin" />
              Revogando...
            </>
          ) : (
            "Revogar advertência"
          )}
        </Button>
      </DialogFooter>
    </>
  )
}
