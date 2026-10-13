"use client"

import { useState } from "react"
import { SignOut } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  canWithdrawFromCompetition,
  withdrawalBlockedByPostsMessage,
} from "@/lib/competition-participation"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

type Props = {
  competition: {
    id: string
    name: string
    status: string
    startDate: string | Date
    endDate: string | Date
  }
  applicationStatus: string | null | undefined
  postedVideoCount: number
  className?: string
  onSuccess?: () => void
}

export function LeaveCompetitionButton({
  competition,
  applicationStatus,
  postedVideoCount,
  className,
  onSuccess,
}: Props) {
  const [open, setOpen] = useState(false)
  const utils = api.useUtils()
  const hasPosts = postedVideoCount > 0
  const leave = api.campaign.leaveCompetition.useMutation({
    onSuccess: async (result) => {
      setOpen(false)
      toast.success(result.message)
      onSuccess?.()
      await Promise.all([
        utils.campaign.invalidate(),
        utils.clipper.invalidate(),
        utils.notifications.invalidate(),
      ])
    },
    onError: (error) => {
      toast.error("Não foi possível sair", { description: error.message })
      void utils.campaign.invalidate()
      void utils.clipper.getMyApplications.invalidate()
    },
  })

  if (
    !canWithdrawFromCompetition(
      applicationStatus,
      competition.status,
      competition.endDate,
    )
  )
    return null

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!leave.isPending && (!next || !hasPosts)) setOpen(next)
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={hasPosts}
          title={hasPosts ? withdrawalBlockedByPostsMessage : undefined}
          className={cn(
            "h-9 cursor-pointer rounded-xl border-red-500/30 text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400",
            className,
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <SignOut className="size-4" weight="bold" />
          {hasPosts ? "Saída bloqueada: vídeo enviado" : "Sair da competição"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(event) => event.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Sair de {competition.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {hasPosts
              ? withdrawalBlockedByPostsMessage
              : "A saída só é permitida enquanto você não tiver enviado nenhum vídeo nesta competição."}{" "}
            Você deixará de disputar os rankings ainda abertos e não poderá
            enviar novos posts. Você poderá se reinscrever somente antes do
            início da competição; em competições privadas, o administrador faz a
            reinscrição. Seus posts, resultados de períodos encerrados e valores
            já creditados serão preservados. Suas contas continuarão disponíveis
            nas outras competições.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={leave.isPending}>
            Continuar participando
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 text-white hover:bg-red-700"
            disabled={leave.isPending || hasPosts}
            onClick={(event) => {
              event.preventDefault()
              leave.mutate({ campaignId: competition.id })
            }}
          >
            {leave.isPending ? "Saindo..." : "Confirmar saída"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
