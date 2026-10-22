"use client"

import * as React from "react"
import {
  CheckCircle,
  CircleNotch,
  Gavel,
  Info,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { formatBrtShort, useNow } from "@/components/clippers/discipline-shared"
import { Bone } from "@/components/shared/skeletons"
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
import { Textarea } from "@/components/ui/textarea"
import {
  MANUAL_SANCTION_TYPES,
  SANCTION_TYPE_LABELS,
  type ManualSanctionType,
} from "@/lib/clipper-discipline/levels"
import {
  formatRankingDateYmd,
  lastClosedRankingDateYmd,
  openRankingDateYmd,
  rankingDayWindowUtc,
} from "@/lib/clipper-discipline/podium"
import { formatScoreMultiplier } from "@/lib/clipper-discipline/score-multiplier"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

import { useInvalidateDiscipline } from "./use-invalidate-discipline"

const DAY_MS = 24 * 60 * 60 * 1000

const SANCTION_HINTS: Record<ManualSanctionType, string> = {
  SCORE_MULTIPLIER:
    "Reduz a pontuação dos vídeos postados durante o período",
  OBSERVATION_MODE:
    "Os vídeos novos só pontuam depois de aprovados na fila de Revisões",
  BONUS_LOSS: "Sem bônus e extras durante o período",
  PREMIUM_CAMPAIGN_BLOCK: "Não pode se inscrever em campanhas premium",
  DAY_POINTS_RESET:
    "Os vídeos de um dia do ranking deixam de pontuar (e os prêmios do dia são estornados)",
  PODIUM_INELIGIBLE:
    "Os vídeos de um dia do ranking ficam fora dos rankings daquele dia (diário e Top Clipadores); continuam valendo no mensal",
  PAYOUT_HOLD: "Saques e pagamentos bloqueados até liberação manual",
}

/** Tipos com duração obrigatória (o servidor recusa sem dias). */
const DURATION_REQUIRED: ManualSanctionType[] = [
  "SCORE_MULTIPLIER",
  "BONUS_LOSS",
  "PREMIUM_CAMPAIGN_BLOCK",
]

export interface ApplySanctionDialogProps {
  clipperProfileId: string
  clipperName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplied?: () => void
}

export function ApplySanctionDialog({
  clipperProfileId,
  clipperName,
  open,
  onOpenChange,
  onApplied,
}: ApplySanctionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[96vw] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-lg">
        <DialogHeader className="border-border/60 shrink-0 border-b p-4 text-left sm:p-6">
          <DialogTitle className="flex items-center gap-2 text-base font-bold sm:text-lg">
            <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Gavel className="size-4.5" weight="fill" />
            </span>
            Aplicar punição
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Punição complementar, sem advertência · {clipperName}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <ApplySanctionForm
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

function ApplySanctionForm({
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
  const { data: context, isLoading } =
    api.clipperDiscipline.applyContext.useQuery({ clipperProfileId })

  const [type, setType] = React.useState<ManualSanctionType>("SCORE_MULTIPLIER")
  const [percent, setPercent] = React.useState("80")
  const [days, setDays] = React.useState("7")
  const [campaignId, setCampaignId] = React.useState("")
  const [rankingDate, setRankingDate] = React.useState(() =>
    lastClosedRankingDateYmd(new Date()),
  )
  const [reason, setReason] = React.useState("")

  // Campos travados enquanto o contexto do clipador carrega.
  const disabled = !context
  const showDuration =
    type === "SCORE_MULTIPLIER" ||
    type === "OBSERVATION_MODE" ||
    type === "BONUS_LOSS" ||
    type === "PREMIUM_CAMPAIGN_BLOCK"
  const durationRequired = DURATION_REQUIRED.includes(type)

  const parsedDays = days.trim() === "" ? null : Number(days)
  const daysValid =
    parsedDays === null
      ? !durationRequired
      : Number.isInteger(parsedDays) && parsedDays >= 1 && parsedDays <= 365
  const parsedPercent = Number(percent.replace(",", "."))
  const bps = Math.round(parsedPercent * 100)
  const percentValid =
    Number.isFinite(parsedPercent) && bps >= 100 && bps <= 9999

  const endsAt =
    showDuration && parsedDays && daysValid
      ? new Date(now.getTime() + parsedDays * DAY_MS)
      : null
  const campaign = context?.competitions.find((item) => item.id === campaignId)
  const isDayScoped = type === "DAY_POINTS_RESET" || type === "PODIUM_INELIGIBLE"
  // O pódio vale até o dia do ranking ainda aberto; a zeragem, só para um dia
  // já encerrado (no aberto os vídeos enviados depois continuariam pontuando).
  const maxRankingDate =
    type === "PODIUM_INELIGIBLE"
      ? openRankingDateYmd(now)
      : lastClosedRankingDateYmd(now)
  const dayWindow = /^\d{4}-\d{2}-\d{2}$/.test(rankingDate)
    ? rankingDayWindowUtc(rankingDate)
    : null

  const preview = (() => {
    switch (type) {
      case "SCORE_MULTIPLIER":
        return percentValid && endsAt
          ? `Redutor ${formatScoreMultiplier(bps)} nos vídeos postados até ${formatBrtShort(endsAt)} (mantém ${parsedPercent.toLocaleString("pt-BR")}% da pontuação)`
          : "Informe o percentual e a duração"
      case "OBSERVATION_MODE":
        return endsAt
          ? `Em observação até ${formatBrtShort(endsAt)}`
          : "Em observação até a equipe liberar"
      case "BONUS_LOSS":
        return endsAt ? `Sem bônus até ${formatBrtShort(endsAt)}` : "Informe a duração"
      case "PREMIUM_CAMPAIGN_BLOCK":
        return endsAt
          ? `Bloqueio de campanhas premium até ${formatBrtShort(endsAt)}`
          : "Informe a duração"
      case "DAY_POINTS_RESET":
        return campaign && rankingDate
          ? `Zera os pontos de ${rankingDate.split("-").reverse().join("/")} em ${campaign.name}`
          : "Informe a competição e o dia do ranking"
      case "PODIUM_INELIGIBLE":
        return campaign && dayWindow
          ? `Os vídeos postados de ${formatBrtShort(dayWindow.startDate)} a ${formatBrtShort(dayWindow.endDate)} ficam fora dos rankings de ${formatRankingDateYmd(rankingDate)} em ${campaign.name}; se o dia já foi pago, o prêmio é estornado`
          : "Informe a competição e o dia do ranking"
      case "PAYOUT_HOLD":
        return "Pagamento retido até a equipe liberar"
    }
  })()

  const sanctionMutation = api.clipperDiscipline.applySanction.useMutation({
    onSuccess: () => {
      toast.success("Punição aplicada", {
        description: "O clipador foi notificado.",
      })
      invalidate()
      onApplied()
    },
    onError: (error) => toast.error(error.message || "Erro ao aplicar punição"),
  })

  const handleSubmit = () => {
    if (disabled) return
    if (type === "SCORE_MULTIPLIER" && !percentValid) {
      toast.error("O percentual mantido precisa ficar entre 1% e 99,99%")
      return
    }
    if (showDuration && !daysValid) {
      toast.error(
        durationRequired
          ? "Informe a duração em dias (1 a 365)"
          : "A duração precisa ficar entre 1 e 365 dias",
      )
      return
    }
    if (isDayScoped) {
      if (!campaignId) {
        toast.error("Escolha a competição")
        return
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rankingDate)) {
        toast.error("Informe o dia do ranking")
        return
      }
      if (rankingDate > maxRankingDate) {
        toast.error(
          type === "PODIUM_INELIGIBLE"
            ? "O dia do ranking não pode ser futuro"
            : "Só dá para zerar um dia do ranking já encerrado",
        )
        return
      }
    }
    if (reason.trim().length < 3) {
      toast.error("Descreva o motivo (mínimo de 3 caracteres)")
      return
    }
    sanctionMutation.mutate({
      clipperProfileId,
      type,
      durationDays: showDuration ? parsedDays : null,
      scoreMultiplierBps: type === "SCORE_MULTIPLIER" ? bps : null,
      campaignId: isDayScoped ? campaignId : null,
      rankingDate: isDayScoped ? rankingDate : null,
      reason: reason.trim(),
    })
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4 sm:p-6">
        <Bone className="h-10 w-full rounded-xl" />
        <Bone delay={80} className="h-24 w-full rounded-2xl" />
      </div>
    )
  }

  const isPending = sanctionMutation.isPending

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sanction-type" className="text-sm font-bold">
            Punição
          </Label>
          <Select
            value={type}
            onValueChange={(value) => {
              const next = value as ManualSanctionType
              setType(next)
              // O pódio começa no dia do ranking aberto; a zeragem, no último
              // dia já encerrado.
              if (next === "PODIUM_INELIGIBLE") {
                setRankingDate(openRankingDateYmd(new Date()))
              } else if (next === "DAY_POINTS_RESET") {
                setRankingDate(lastClosedRankingDateYmd(new Date()))
              }
              // Observação começa "até liberar"; as demais com duração, 7 dias.
              if (next === "OBSERVATION_MODE") setDays("")
              else if (DURATION_REQUIRED.includes(next) && !days.trim()) {
                setDays("7")
              }
            }}
            disabled={disabled}
          >
            <SelectTrigger
              id="sanction-type"
              className="h-10 w-full cursor-pointer rounded-xl"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {MANUAL_SANCTION_TYPES.map((option) => (
                <SelectItem key={option} value={option}>
                  {SANCTION_TYPE_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">{SANCTION_HINTS[type]}</p>
        </div>

        {type === "SCORE_MULTIPLIER" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sanction-percent" className="text-sm font-bold">
              Pontuação mantida (%)
            </Label>
            <Input
              id="sanction-percent"
              inputMode="decimal"
              value={percent}
              onChange={(event) => setPercent(event.target.value)}
              className="h-10 rounded-xl"
              disabled={disabled}
            />
            <p
              className={cn(
                "text-xs",
                percentValid ? "text-muted-foreground" : "text-red-500",
              )}
            >
              {percentValid
                ? `${parsedPercent.toLocaleString("pt-BR")}% = ${formatScoreMultiplier(bps)} (perde ${(100 - parsedPercent).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% da pontuação)`
                : "Entre 1% e 99,99%"}
            </p>
          </div>
        )}

        {showDuration && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sanction-days" className="text-sm font-bold">
              Duração (dias)
              {!durationRequired && (
                <span className="text-muted-foreground text-xs font-normal">
                  (opcional)
                </span>
              )}
            </Label>
            <Input
              id="sanction-days"
              type="number"
              min={1}
              max={365}
              step={1}
              value={days}
              onChange={(event) => setDays(event.target.value)}
              placeholder={durationRequired ? "7" : "Vazio = até liberar"}
              className="h-10 rounded-xl"
              disabled={disabled}
            />
            {!durationRequired && (
              <p className="text-muted-foreground text-xs">
                Deixe vazio para manter até a equipe liberar.
              </p>
            )}
          </div>
        )}

        {isDayScoped && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sanction-campaign" className="text-sm font-bold">
                Competição
              </Label>
              {(context?.competitions.length ?? 0) === 0 ? (
                <p className="text-muted-foreground text-xs">
                  O clipador não tem inscrições.
                </p>
              ) : (
                <Select
                  value={campaignId}
                  onValueChange={setCampaignId}
                  disabled={disabled}
                >
                  <SelectTrigger
                    id="sanction-campaign"
                    className="h-10 w-full cursor-pointer rounded-xl"
                  >
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {context?.competitions.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sanction-date" className="text-sm font-bold">
                Dia do ranking
              </Label>
              <Input
                id="sanction-date"
                type="date"
                value={rankingDate}
                max={maxRankingDate}
                onChange={(event) => setRankingDate(event.target.value)}
                className="h-10 rounded-xl"
                disabled={disabled}
              />
            </div>
            <p className="text-muted-foreground text-xs sm:col-span-2">
              O dia do ranking vai das 17h do dia anterior às 17h do dia
              escolhido (horário de Brasília).
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sanction-reason" className="text-sm font-bold">
            Motivo<span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="sanction-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={2000}
            rows={3}
            className="rounded-xl"
            disabled={disabled}
          />
          <p className="text-muted-foreground text-right text-[11px]">
            {reason.length}/2000 · o clipador vê este texto
          </p>
        </div>

        <div className="border-border/60 bg-muted/20 flex items-start gap-2 rounded-2xl border px-3.5 py-3 text-sm">
          <Info className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <span>{preview}</span>
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
          className="btn-gradient-auth h-10 cursor-pointer rounded-xl font-semibold"
          onClick={handleSubmit}
          disabled={disabled || isPending || reason.trim().length < 3}
        >
          {isPending ? (
            <>
              <CircleNotch className="size-4 animate-spin" />
              Aplicando...
            </>
          ) : (
            <>
              <CheckCircle className="size-4" weight="fill" />
              Aplicar punição
            </>
          )}
        </Button>
      </div>
    </>
  )
}
