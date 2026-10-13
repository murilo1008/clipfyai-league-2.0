"use client"

import { useState } from "react"
import { SignOut } from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import { getQueryKey } from "@trpc/react-query"
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
    /** Quando informado, descarta o cache da página da competição após sair. */
    slug?: string
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
  const queryClient = useQueryClient()
  const hasPosts = postedVideoCount > 0

  // Listas que mostram a inscrição (antes invalidava os routers inteiros).
  const refreshEnrollmentLists = () => {
    void utils.campaign.getAllActiveCompetitions.invalidate()
    void utils.campaign.getScheduled.invalidate()
    void utils.clipper.getMyApplications.invalidate()
    void utils.clipper.getMyCompetitions.invalidate()
    void utils.clipper.getMyCompetitionOptions.invalidate()
    void utils.clipper.getDashboardStats.invalidate()
    void utils.clipper.getNextAvailableCompetition.invalidate()
  }

  const leave = api.campaign.leaveCompetition.useMutation({
    onSuccess: (result) => {
      setOpen(false)
      toast.success(result.message)
      onSuccess?.()
      // A página da competição deixa de ser acessível: descarta o cache dela.
      if (competition.slug) {
        queryClient.removeQueries({
          queryKey: getQueryKey(
            api.campaign.getCompetitionDetails,
            { slug: competition.slug },
            "query",
          ),
        })
      }
      queryClient.removeQueries({
        queryKey: getQueryKey(
          api.campaign.getCompetitionRanking,
          { campaignId: competition.id },
          "query",
        ),
      })
      queryClient.removeQueries({
        queryKey: getQueryKey(
          api.campaign.getMyCompetitionPosts,
          { campaignId: competition.id },
          "query",
        ),
      })
      refreshEnrollmentLists()
      // Avisos da competição deixam de aparecer para quem saiu.
      void utils.notifications.invalidate()
    },
    onError: (error) => {
      toast.error("Não foi possível sair", { description: error.message })
      refreshEnrollmentLists()
      if (competition.slug) {
        void utils.campaign.getCompetitionDetails.invalidate({
          slug: competition.slug,
        })
      }
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
