"use client"

import * as React from "react"
import {
  CheckCircle,
  Eye,
  GearSix,
  Lightning,
  Play,
  Sparkle,
  Spinner,
  Trophy,
  Wallet,
  Warning,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { api } from "@/trpc/react"

import {
  formatNumber,
  useFormatCurrency,
  type AdminApplication,
} from "./shared"

type PaymentType = "PRIZE_CREDIT" | "BONUS" | "ADJUSTMENT"
type RankingType = "daily" | "monthly"

function buildPrizeDescription(position: string, rankingType: RankingType) {
  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
  const rankingText =
    rankingType === "daily" ? "Ranking Diário" : "Ranking Mensal"
  return `Prêmio ${position}º lugar - ${rankingText} ${dateStr}`
}

export function ProcessPaymentDialog({
  application,
  open,
  onOpenChange,
  slug,
  campaignId,
}: {
  application: AdminApplication | null
  open: boolean
  onOpenChange: (open: boolean) => void
  slug: string
  campaignId: string
}) {
  const utils = api.useUtils()
  const formatCurrency = useFormatCurrency()

  const [paymentAmount, setPaymentAmount] = React.useState("")
  const [paymentDescription, setPaymentDescription] = React.useState("")
  const [paymentType, setPaymentType] =
    React.useState<PaymentType>("PRIZE_CREDIT")
  const [paymentPosition, setPaymentPosition] = React.useState("")
  const [paymentRankingType, setPaymentRankingType] =
    React.useState<RankingType>("daily")

  const resetForm = React.useCallback(() => {
    setPaymentAmount("")
    setPaymentDescription("")
    setPaymentType("PRIZE_CREDIT")
    setPaymentPosition("")
    setPaymentRankingType("daily")
  }, [])

  React.useEffect(() => {
    if (open) resetForm()
  }, [open, application?.id, resetForm])

  const processPayment = api.admin.processPayment.useMutation({
    onSuccess: async () => {
      toast.success("Pagamento processado com sucesso!")
      onOpenChange(false)
      resetForm()
      await Promise.all([
        utils.admin.getCompetitionDetailsAdmin.invalidate({ slug }),
        utils.admin.getCompetitionApplicationsAdmin.invalidate({ slug }),
        utils.admin.getClipperAllTransactions.invalidate(),
        utils.admin.getClipperTransactionsInCampaign.invalidate(),
        utils.clipper.getWallet.invalidate(),
        utils.clipper.getTransactions.invalidate(),
        utils.clipper.getWalletStats.invalidate(),
      ])
    },
    onError: (error) =>
      toast.error(error.message || "Erro ao processar pagamento"),
  })

  const handleProcessPayment = () => {
    if (!application || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error("Informe um valor válido para o pagamento")
      return
    }
    if (!paymentDescription.trim()) {
      toast.error("Informe uma descrição para o pagamento")
      return
    }
    processPayment.mutate({
      clipperProfileId: application.clipperProfileId,
      amount: parseFloat(paymentAmount),
      description: paymentDescription.trim(),
      type: paymentType,
      campaignId,
      position: paymentPosition ? parseInt(paymentPosition) : undefined,
      rankingType: paymentPosition ? paymentRankingType : undefined,
    })
  }

  if (!application) return null

  const previewValue = parseFloat(paymentAmount)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-2xl">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2">
            <Wallet
              className="text-brand-cyan not-dark:text-primary size-5"
              weight="fill"
            />
            Processar Pagamento
          </DialogTitle>
          <DialogDescription>
            Adicione fundos à carteira do clipper
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          {/* Bloco do clipper */}
          <div className="border-brand-cyan/25 not-dark:border-primary/25 bg-muted/20 flex items-start gap-3.5 rounded-2xl border p-4">
            <Avatar className="size-13 shrink-0 rounded-2xl sm:size-14">
              <AvatarImage
                src={application.clipperImageUrl ?? undefined}
                alt={application.clipperName}
              />
              <AvatarFallback className="bg-gradient-custom rounded-2xl text-base font-bold text-[#04222A]">
                {application.clipperName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-bold sm:text-xl">
                {application.clipperName}
              </h3>
              {application.clipperArtisticName && (
                <p className="text-muted-foreground truncate text-sm">
                  @{application.clipperArtisticName}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1 rounded-full">
                  <Play className="size-3" weight="fill" />
                  {application.postsCount} posts
                </Badge>
                <Badge variant="outline" className="gap-1 rounded-full">
                  <Eye className="size-3" weight="fill" />
                  {formatNumber(application.totalViews)} views
                </Badge>
              </div>
            </div>
          </div>

          {/* Tipo de pagamento */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-type">Tipo de Pagamento</Label>
            <Select
              value={paymentType}
              onValueChange={(value) => setPaymentType(value as PaymentType)}
            >
              <SelectTrigger
                id="payment-type"
                className="h-10 w-full cursor-pointer rounded-xl"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="PRIZE_CREDIT">
                  <span className="inline-flex items-center gap-2">
                    <Trophy className="size-4 text-amber-500" weight="fill" />
                    Prêmio
                  </span>
                </SelectItem>
                <SelectItem value="BONUS">
                  <span className="inline-flex items-center gap-2">
                    <Sparkle className="size-4 text-violet-500" weight="fill" />
                    Bônus
                  </span>
                </SelectItem>
                <SelectItem value="ADJUSTMENT">
                  <span className="inline-flex items-center gap-2">
                    <GearSix className="size-4 text-sky-500" weight="fill" />
                    Ajuste
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ranking + posição (apenas prêmio) */}
          {paymentType === "PRIZE_CREDIT" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ranking-type">Tipo de Ranking</Label>
                <Select
                  value={paymentRankingType}
                  onValueChange={(value) => {
                    const rankingType = value as RankingType
                    setPaymentRankingType(rankingType)
                    if (paymentPosition) {
                      setPaymentDescription(
                        buildPrizeDescription(paymentPosition, rankingType),
                      )
                    }
                  }}
                >
                  <SelectTrigger
                    id="ranking-type"
                    className="h-10 w-full cursor-pointer rounded-xl"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="daily">
                      <span className="inline-flex items-center gap-2">
                        <Lightning
                          className="size-4 text-orange-500"
                          weight="fill"
                        />
                        Diário
                      </span>
                    </SelectItem>
                    <SelectItem value="monthly">
                      <span className="inline-flex items-center gap-2">
                        <Trophy
                          className="size-4 text-violet-500"
                          weight="fill"
                        />
                        Mensal
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="payment-position">Posição</Label>
                <Input
                  id="payment-position"
                  type="number"
                  min={1}
                  max={100}
                  placeholder="Ex: 1"
                  value={paymentPosition}
                  onChange={(e) => {
                    setPaymentPosition(e.target.value)
                    if (e.target.value) {
                      setPaymentDescription(
                        buildPrizeDescription(
                          e.target.value,
                          paymentRankingType,
                        ),
                      )
                    }
                  }}
                  className="h-10 rounded-xl font-semibold"
                />
              </div>
            </div>
          )}

          {/* Valor */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-amount">
              Valor (R$) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="payment-amount"
              type="number"
              min={0}
              step="0.01"
              placeholder="Ex: 350.00"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="h-10 rounded-xl text-lg font-semibold"
            />
            <p className="text-muted-foreground text-xs">
              Informe o valor em reais (R$)
            </p>
          </div>

          {/* Descrição */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-description">
              Descrição <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="payment-description"
              placeholder="Ex: Prêmio 1º lugar - Ranking Diário 04/11/2026"
              value={paymentDescription}
              onChange={(e) => setPaymentDescription(e.target.value)}
              rows={3}
              className="resize-none rounded-xl"
            />
            <p className="text-muted-foreground text-xs">
              Descreva o motivo do pagamento para registro e auditoria
            </p>
          </div>

          {/* Preview */}
          {paymentAmount && previewValue > 0 && (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground text-sm font-medium">
                  Valor a ser creditado:
                </span>
                <span className="text-2xl font-black text-emerald-600 tabular-nums dark:text-emerald-400">
                  {formatCurrency(previewValue)}
                </span>
              </div>
              <p className="text-muted-foreground text-xs">
                O valor será adicionado imediatamente à carteira do clipper
              </p>
            </div>
          )}

          {/* Aviso */}
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
            <div className="flex gap-3">
              <Warning
                className="mt-0.5 size-5 shrink-0 text-amber-500"
                weight="fill"
              />
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                  Atenção ao processar pagamento
                </p>
                <ul className="text-muted-foreground flex flex-col gap-1 text-xs">
                  <li>• O saldo será adicionado imediatamente à carteira</li>
                  <li>
                    • A transação será registrada no histórico financeiro
                  </li>
                  <li>• Esta ação não pode ser desfeita automaticamente</li>
                  <li>• Caso necessite reverter, crie um ajuste negativo</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="cursor-pointer rounded-xl"
            disabled={processPayment.isPending}
            onClick={() => {
              onOpenChange(false)
              resetForm()
            }}
          >
            Cancelar
          </Button>
          <Button
            className="cursor-pointer gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 font-semibold text-white hover:opacity-90"
            disabled={
              processPayment.isPending ||
              !paymentAmount ||
              parseFloat(paymentAmount) <= 0 ||
              !paymentDescription.trim()
            }
            onClick={handleProcessPayment}
          >
            {processPayment.isPending ? (
              <>
                <Spinner className="size-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <CheckCircle className="size-4" weight="fill" />
                Confirmar Pagamento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
