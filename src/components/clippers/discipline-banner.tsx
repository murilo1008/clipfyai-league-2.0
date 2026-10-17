"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRight,
  Clock,
  Crown,
  Eye,
  Gift,
  Prohibit,
  ShieldWarning,
  TrendDown,
  Wallet,
} from "@phosphor-icons/react"

import { CountdownTimer } from "@/components/shared/countdown-timer"
import { Button } from "@/components/ui/button"
import { formatScoreMultiplier } from "@/lib/clipper-discipline/score-multiplier"
import { cn } from "@/lib/utils"

import { formatBrtShort, useMyDisciplineStatus } from "./discipline-shared"

type BannerItem = {
  key: string
  icon: React.ReactNode
  title: string
  description: React.ReactNode
  extra?: React.ReactNode
}

/**
 * Faixa do clipador com as advertências ativas e as restrições em vigor
 * (suspensão, redutor, pagamento retido, observação, bloqueio premium).
 * Não renderiza nada quando não há restrição nem advertência ativa.
 */
export function DisciplineBanner({
  className,
  showLink = true,
}: {
  className?: string
  /** Link "Ver minhas advertências" (desligado na própria página). */
  showLink?: boolean
}) {
  const { data } = useMyDisciplineStatus()
  if (!data) return null

  const until = (endsAt: Date | null, openEnded: string) =>
    endsAt ? `até ${formatBrtShort(endsAt)}` : openEnded

  const items: BannerItem[] = []
  if (data.banned) {
    items.push({
      key: "banned",
      icon: <Prohibit className="size-4" weight="fill" />,
      title: "Conta banida",
      description:
        "O envio de vídeos, as inscrições e os saques estão bloqueados. Fale com o suporte se precisar de ajuda.",
    })
  }
  if (data.suspension) {
    items.push({
      key: "suspension",
      icon: <Clock className="size-4" weight="fill" />,
      title: "Envio de vídeos suspenso",
      description: `Envio liberado em ${formatBrtShort(data.suspension.endsAt)} (horário de Brasília)`,
      extra: <CountdownTimer target={data.suspension.endsAt} />,
    })
  }
  if (data.scoreMultiplier) {
    items.push({
      key: "multiplier",
      icon: <TrendDown className="size-4" weight="bold" />,
      title: `Redutor de pontuação ${formatScoreMultiplier(data.scoreMultiplier.bps)}`,
      description: `Vale para os vídeos postados ${until(data.scoreMultiplier.endsAt, "até a equipe liberar")}`,
    })
  }
  if (data.payoutHold) {
    items.push({
      key: "payout",
      icon: <Wallet className="size-4" weight="fill" />,
      title: "Pagamentos retidos pela equipe",
      description: "Os saques ficam bloqueados até a retenção ser liberada.",
    })
  }
  if (data.observation) {
    items.push({
      key: "observation",
      icon: <Eye className="size-4" weight="fill" />,
      title: "Em observação",
      description: `Seus vídeos passam por aprovação manual antes de pontuar ${until(data.observation.endsAt, "até a equipe liberar")}.`,
    })
  }
  if (data.premiumBlock) {
    items.push({
      key: "premium",
      icon: <Crown className="size-4" weight="fill" />,
      title: "Campanhas premium bloqueadas",
      description: `Você não pode entrar em campanhas premium ${until(data.premiumBlock.endsAt, "até a equipe liberar")}.`,
    })
  }
  if (data.bonusLoss) {
    items.push({
      key: "bonus",
      icon: <Gift className="size-4" weight="fill" />,
      title: "Sem bônus",
      description: `Bônus e extras suspensos ${until(data.bonusLoss.endsAt, "até a equipe liberar")}.`,
    })
  }

  if (items.length === 0 && data.activeWarnings === 0) return null

  const severe = data.banned || !!data.suspension
  const warningsText =
    data.activeWarnings === 0
      ? "Nenhuma advertência ativa"
      : data.activeWarnings === 1
        ? "1 advertência ativa"
        : `${data.activeWarnings} advertências ativas`

  return (
    <section
      role="status"
      className={cn(
        "flex flex-col gap-4 rounded-3xl border p-4 sm:p-5",
        severe
          ? "border-red-500/30 bg-red-500/[0.07]"
          : "border-amber-500/30 bg-amber-500/[0.07]",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              severe
                ? "bg-red-500/15 text-red-600 dark:text-red-400"
                : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
            )}
          >
            <ShieldWarning className="size-5" weight="fill" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold sm:text-base">
              {items.length > 0
                ? "Restrições na sua conta"
                : "Você tem advertências ativas"}
            </p>
            <p className="text-muted-foreground text-xs sm:text-sm">
              {warningsText}
            </p>
          </div>
        </div>
        {showLink && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-9 cursor-pointer rounded-xl font-semibold"
          >
            <Link href="/warnings">
              Ver minhas advertências
              <ArrowRight className="size-3.5" weight="bold" />
            </Link>
          </Button>
        )}
      </div>

      {items.length > 0 && (
        <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {items.map((item) => (
            <li
              key={item.key}
              className="border-border/60 bg-background/60 flex items-start gap-3 rounded-2xl border px-3.5 py-3"
            >
              <span
                className={cn(
                  "mt-0.5 shrink-0",
                  item.key === "banned" || item.key === "suspension"
                    ? "text-red-600 dark:text-red-400"
                    : "text-amber-600 dark:text-amber-400",
                )}
              >
                {item.icon}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-muted-foreground text-xs">
                  {item.description}
                </p>
                {item.extra}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
