"use client"

import * as React from "react"
import {
  Coins,
  Crown,
  Medal,
  Notebook,
  Sparkle,
  Target,
  Trophy,
} from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Bone } from "@/components/shared/skeletons"
import { parsePrizeTable } from "@/lib/daily-ranking-preview"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

import { EmptyState, formatNumber, useFormatCurrency } from "./shared"

interface PrizesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaignId: string
}

/** Dialog "Prêmios da Competição" — visão completa das regras de premiação. */
export function PrizesDialog({
  open,
  onOpenChange,
  campaignId,
}: PrizesDialogProps) {
  const formatCurrency = useFormatCurrency()

  const { data, isLoading } = api.campaign.getCampaignPrizes.useQuery(
    { campaignId },
    { enabled: open },
  )

  const rule = data?.rankingRule
  const monthlyEntries = React.useMemo(
    () => parsePrizeTable(rule?.monthlyPrizeTable),
    [rule?.monthlyPrizeTable],
  )
  const dailyEntries = React.useMemo(
    () => parsePrizeTable(rule?.dailyPrizeTable),
    [rule?.dailyPrizeTable],
  )

  const totalPrizes =
    (rule?.monthlyEnabled ? (rule?.monthlyTotalPrize ?? 0) : 0) +
    (rule?.dailyEnabled ? (rule?.dailyTotalPrize ?? 0) * 30 : 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-4xl">
        <DialogHeader className="border-border/60 shrink-0 border-b p-4 text-left sm:p-6">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="bg-gradient-custom flex size-9 items-center justify-center rounded-xl text-[#04222A]">
              <Trophy className="size-4.5" weight="fill" />
            </span>
            Prêmios da Competição
          </DialogTitle>
          <DialogDescription>
            {data?.name ?? "Regras completas de premiação"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
          {isLoading ? (
            <>
              {/* Card do total de prêmios */}
              <div className="border-border/60 rounded-2xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Bone className="h-5 w-52 rounded-full" />
                  <Bone delay={100} className="h-7 w-28" />
                </div>
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
                  <Bone delay={200} className="h-3 w-28 rounded-full" />
                  <Bone delay={280} className="h-3 w-36 rounded-full" />
                </div>
              </div>

              {/* Pódio do ranking mensal */}
              <div className="border-border/60 bg-muted/20 flex flex-col gap-3 rounded-2xl border p-4">
                <div className="flex items-center gap-2">
                  <Bone delay={120} className="size-7 rounded-lg" />
                  <Bone delay={200} className="h-4 w-36" />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Bone
                      key={index}
                      delay={280 + index * 110}
                      className="h-24 rounded-2xl"
                    />
                  ))}
                </div>
              </div>

              {/* Grid de posições do ranking diário */}
              <div className="border-border/60 bg-muted/20 flex flex-col gap-3 rounded-2xl border p-4">
                <div className="flex items-center gap-2">
                  <Bone delay={400} className="size-7 rounded-lg" />
                  <Bone delay={480} className="h-4 w-32" />
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <Bone
                      key={index}
                      delay={560 + index * 70}
                      className="h-9"
                    />
                  ))}
                </div>
              </div>
            </>
          ) : !rule ? (
            <EmptyState
              icon={<Trophy className="size-6" weight="fill" />}
              title="Sem regras de premiação"
              subtitle="Esta competição é 100% baseada em views, sem premiação configurada"
            />
          ) : (
            <>
              {/* Total */}
              <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/15 to-orange-500/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-amber-600 dark:text-amber-400">
                    <Sparkle className="size-4" weight="fill" />
                    Total de Prêmios (estimado/mês)
                  </span>
                  <span className="text-xl font-bold text-amber-600 tabular-nums dark:text-amber-400">
                    {formatCurrency(totalPrizes)}
                  </span>
                </div>
                <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {rule.monthlyEnabled && (
                    <span>
                      Mensal: {formatCurrency(rule.monthlyTotalPrize ?? 0)}
                    </span>
                  )}
                  {rule.dailyEnabled && (
                    <span>
                      Diário: {formatCurrency(rule.dailyTotalPrize ?? 0)} × 30
                      dias
                    </span>
                  )}
                  {rule.bonusEnabled && (
                    <span>
                      Bônus por marco: {formatCurrency(rule.bonusAmount ?? 0)}
                    </span>
                  )}
                </div>
              </div>

              {/* Ranking Mensal */}
              {rule.monthlyEnabled && (
                <PrizeSection
                  icon={<Trophy className="size-4" weight="fill" />}
                  title="Ranking Mensal"
                  subtitle={`Top ${rule.monthlyTopCount ?? 0} do mês · ${formatCurrency(rule.monthlyTotalPrize ?? 0)} no total`}
                >
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {monthlyEntries.slice(0, 3).map((entry, index) => (
                      <div
                        key={entry.position}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-2xl border p-3 text-center",
                          index === 0
                            ? "border-amber-500/40 bg-amber-500/10"
                            : index === 1
                              ? "border-zinc-400/40 bg-zinc-400/10"
                              : "border-orange-500/40 bg-orange-500/10",
                        )}
                      >
                        <Medal
                          className={cn(
                            "size-5",
                            index === 0
                              ? "text-amber-500"
                              : index === 1
                                ? "text-zinc-400"
                                : "text-orange-500",
                          )}
                          weight="fill"
                        />
                        <span className="text-muted-foreground text-xs font-semibold">
                          {entry.position}º lugar
                        </span>
                        <span className="text-base font-bold tabular-nums">
                          {formatCurrency(entry.prize)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {monthlyEntries.length > 3 && (
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                      {monthlyEntries.slice(3).map((entry) => (
                        <div
                          key={entry.position}
                          className="bg-muted/30 flex items-center justify-between rounded-xl px-3 py-2 text-xs"
                        >
                          <span className="text-muted-foreground font-semibold">
                            {entry.position}º
                          </span>
                          <span className="font-bold tabular-nums">
                            {formatCurrency(entry.prize)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </PrizeSection>
              )}

              {/* Ranking Diário */}
              {rule.dailyEnabled && (
                <PrizeSection
                  icon={<Coins className="size-4" weight="fill" />}
                  title="Ranking Diário"
                  subtitle={`Top ${rule.dailyTopCount ?? 0} do dia • 20h às 20h do dia seguinte (BRT) · ${formatCurrency(rule.dailyTotalPrize ?? 0)}/dia`}
                >
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                    {dailyEntries.map((entry) => (
                      <div
                        key={entry.position}
                        className="bg-muted/30 flex items-center justify-between rounded-xl px-3 py-2 text-xs"
                      >
                        <span className="text-muted-foreground font-semibold">
                          {entry.position}º
                        </span>
                        <span className="font-bold tabular-nums">
                          {formatCurrency(entry.prize)}
                        </span>
                      </div>
                    ))}
                  </div>
                </PrizeSection>
              )}

              {/* Bônus por marco */}
              {rule.bonusEnabled && (
                <PrizeSection
                  icon={<Target className="size-4" weight="fill" />}
                  title="Bônus por Marco de Views"
                  subtitle="Recompensa extra ao atingir a meta de views"
                >
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <InfoTile
                      label="Meta de Views"
                      value={formatNumber(rule.bonusMilestone ?? 0)}
                    />
                    <InfoTile
                      label="Valor do Bônus"
                      value={formatCurrency(rule.bonusAmount ?? 0)}
                    />
                    {rule.bonusMonthlyBudgetCap != null && (
                      <InfoTile
                        label="Teto Mensal"
                        value={formatCurrency(rule.bonusMonthlyBudgetCap)}
                      />
                    )}
                  </div>
                </PrizeSection>
              )}

              {/* Regras adicionais */}
              {rule.notes && (
                <PrizeSection
                  icon={<Notebook className="size-4" weight="fill" />}
                  title="Regras Adicionais"
                >
                  <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
                    {rule.notes}
                  </p>
                </PrizeSection>
              )}

              {/* Plataformas elegíveis */}
              <PrizeSection
                icon={<Crown className="size-4" weight="fill" />}
                title="Plataformas Elegíveis"
              >
                <div className="flex flex-wrap gap-1.5">
                  {(rule.eligiblePlatforms?.length
                    ? rule.eligiblePlatforms
                    : (data?.platforms ?? [])
                  ).map((platform) => {
                    const config = platformConfig[platform as PlatformKey]
                    if (!config) return null
                    const PlatformIcon = config.icon
                    return (
                      <Badge
                        key={platform}
                        variant="outline"
                        className={cn(
                          "gap-1 rounded-full",
                          config.borderColor,
                          config.bgColor,
                          config.color,
                        )}
                      >
                        <PlatformIcon className="size-3" />
                        {config.label}
                      </Badge>
                    )
                  })}
                </div>
              </PrizeSection>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PrizeSection({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="border-border/60 bg-muted/20 flex flex-col gap-3 rounded-2xl border p-4">
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-2 text-sm font-bold">
          <span className="bg-gradient-custom flex size-7 items-center justify-center rounded-lg text-[#04222A]">
            {icon}
          </span>
          {title}
        </span>
        {subtitle && (
          <span className="text-muted-foreground pl-9 text-xs">{subtitle}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 flex flex-col items-center gap-0.5 rounded-xl px-3 py-2.5 text-center">
      <span className="text-base font-bold tabular-nums">{value}</span>
      <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
        {label}
      </span>
    </div>
  )
}
