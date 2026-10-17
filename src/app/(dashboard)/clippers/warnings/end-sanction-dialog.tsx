"use client"

import * as React from "react"
import type { ClipperSanctionType } from "@prisma/client"
import { CircleNotch, LockKeyOpen, StopCircle } from "@phosphor-icons/react"
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

export type EndSanctionTarget = {
  id: string
  type: ClipperSanctionType
  /** "Liberar pagamento", "Encerrar", "Desfazer" (ver sanctionEndAction). */
  actionLabel: string
  /** Descrição da punição ("Pagamento retido até liberação pela equipe"). */
  description: string
}

/** Encerra uma punição antes do fim (revokeSanction); na retenção, libera o pagamento. */
export function EndSanctionDialog({
  sanction,
  open,
  onOpenChange,
}: {
  sanction: EndSanctionTarget | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isPayout = sanction?.type === "PAYOUT_HOLD"
  const Icon = isPayout ? LockKeyOpen : StopCircle
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="size-5" weight="fill" />
            {isPayout ? "Liberar pagamento" : `${sanction?.actionLabel ?? "Encerrar"} punição`}
          </DialogTitle>
          <DialogDescription>
            {sanction?.description}
            {sanction?.type === "DAY_POINTS_RESET"
              ? ". Os vídeos do dia voltam a pontuar nos rankings ainda abertos."
              : sanction?.type === "PODIUM_INELIGIBLE"
                ? ". Os vídeos do dia voltam aos rankings daquele dia que ainda não foram pagos."
                : isPayout
                  ? ". Os saques voltam a ser liberados se não houver outra retenção em vigor."
                  : ". A punição deixa de valer a partir de agora."}
          </DialogDescription>
        </DialogHeader>
        {open && sanction && (
          <EndSanctionForm
            sanction={sanction}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function EndSanctionForm({
  sanction,
  onDone,
}: {
  sanction: EndSanctionTarget
  onDone: () => void
}) {
  const invalidate = useInvalidateDiscipline()
  const [reason, setReason] = React.useState("")
  const [restorePrizes, setRestorePrizes] = React.useState(true)
  const isPayout = sanction.type === "PAYOUT_HOLD"
  // Zeragem do dia e pódio podem ter estornado prêmios: devolver é opcional.
  const isDayReset =
    sanction.type === "DAY_POINTS_RESET" || sanction.type === "PODIUM_INELIGIBLE"

  const endMutation = api.clipperDiscipline.revokeSanction.useMutation({
    onSuccess: (result) => {
      const details: string[] = []
      if (isPayout && result.walletHeld) {
        details.push(
          "A carteira continua retida por outra punição (ex.: saldo devedor ou banimento)",
        )
      }
      if (result.summary && result.summary.restoredAmount > 0) {
        details.push(`${formatBRLAmount(result.summary.restoredAmount)} devolvidos`)
      }
      toast.success(isPayout ? "Pagamento liberado" : "Punição encerrada", {
        description: details.length > 0 ? details.join(" · ") : undefined,
      })
      invalidate()
      onDone()
    },
    onError: (error) => toast.error(error.message || "Erro ao encerrar punição"),
  })

  const handleSubmit = () => {
    if (reason.trim().length < 3) {
      toast.error("Descreva o motivo (mínimo de 3 caracteres)")
      return
    }
    endMutation.mutate({
      sanctionId: sanction.id,
      reason: reason.trim(),
      restorePrizes: isDayReset ? restorePrizes : undefined,
    })
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="end-sanction-reason" className="text-sm font-bold">
            Motivo<span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="end-sanction-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={2000}
            rows={3}
            className="rounded-xl"
          />
        </div>
        {isDayReset && (
          <div className="border-border/60 bg-muted/20 flex items-start gap-3 rounded-2xl border px-3.5 py-3">
            <Checkbox
              id="end-sanction-restore"
              checked={restorePrizes}
              onCheckedChange={(value) => setRestorePrizes(value === true)}
              className="mt-0.5"
            />
            <Label
              htmlFor="end-sanction-restore"
              className="cursor-pointer text-sm font-semibold"
            >
              Devolver os prêmios estornados
            </Label>
          </div>
        )}
      </div>
      <DialogFooter className="gap-2">
        <Button
          variant="outline"
          className="cursor-pointer rounded-xl"
          onClick={onDone}
          disabled={endMutation.isPending}
        >
          Cancelar
        </Button>
        <Button
          className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
          onClick={handleSubmit}
          disabled={endMutation.isPending || reason.trim().length < 3}
        >
          {endMutation.isPending ? (
            <>
              <CircleNotch className="size-4 animate-spin" />
              Salvando...
            </>
          ) : (
            sanction.actionLabel
          )}
        </Button>
      </DialogFooter>
    </>
  )
}
