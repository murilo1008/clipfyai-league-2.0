"use client"

import {
  At,
  BookOpen,
  CalendarBlank,
  CheckCircle,
  ClipboardText,
  Copy,
  Crown,
  CurrencyDollar,
  Fire,
  Gift,
  Hash,
  Info,
  Medal,
  Sparkle,
  Trophy,
  UsersThree,
  VideoCamera,
  Warning,
} from "@phosphor-icons/react"
import { toast } from "sonner"

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
import { useMaskedCurrency } from "@/contexts/financial-visibility-context"
import { formatPrizeLabel } from "@/lib/currency"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"

import { formatNumber } from "../../competitions/[slug]/shared"
import { formatDateTimeBrasil, type CompetitionDetails } from "./shared"

/* ============================================================
   Dialog "Regras & Premiações"
   ============================================================ */

export function RulesDialog({
  open,
  onOpenChange,
  competition,
  isProSubscriber,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  competition: CompetitionDetails
  isProSubscriber: boolean
}) {
  const { maskText, maskBRL } = useMaskedCurrency()
  const proLocked = competition.isProOnly && !isProSubscriber

  const allMentions = competition.requiredMentions || []
  const allHashtags = competition.requiredHashtags || []
  const copyText = [
    ...allMentions.map((mention) => `@${mention}`),
    ...allHashtags.map((hashtag) => `#${hashtag}`),
  ].join(" ")

  const rule = competition.rankingRule

  const dailyPrizeEntries = rule?.dailyPrizeTable
    ? Object.entries(rule.dailyPrizeTable as unknown as Record<string, number>)
    : []
  const monthlyPrizeEntries = rule?.monthlyPrizeTable
    ? Object.entries(rule.monthlyPrizeTable as unknown as Record<string, number>)
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-4xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="bg-gradient-custom flex size-12 shrink-0 items-center justify-center rounded-2xl text-[#04222A]">
              <Trophy className="size-6" weight="fill" />
            </span>
            <div className="text-left">
              <DialogTitle className="text-xl font-bold sm:text-2xl">
                Regras & Premiações
              </DialogTitle>
              <DialogDescription>
                Tudo que você precisa saber sobre {competition.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          {/* ===== Informações Gerais ===== */}
          <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
            <p className="flex items-center gap-2 text-base font-bold sm:text-lg">
              <Info className="text-primary size-5" weight="fill" />
              Informações Gerais
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-muted/30 flex items-start gap-3 rounded-xl p-3">
                <CalendarBlank
                  className="text-primary mt-0.5 size-5 shrink-0"
                  weight="fill"
                />
                <div>
                  <p className="mb-1 text-sm font-medium">Período</p>
                  <p className="text-muted-foreground text-xs">
                    {formatDateTimeBrasil(competition.startDate)} até{" "}
                    {formatDateTimeBrasil(competition.endDate)}
                  </p>
                </div>
              </div>
              <div className="bg-muted/30 flex items-start gap-3 rounded-xl p-3">
                <CurrencyDollar
                  className="mt-0.5 size-5 shrink-0 text-emerald-500 dark:text-emerald-400"
                  weight="bold"
                />
                <div>
                  <p className="mb-1 text-sm font-medium">Prêmio Total</p>
                  <p
                    className={cn(
                      "text-muted-foreground text-xs",
                      proLocked && "blur-sm select-none",
                    )}
                  >
                    {maskText(formatPrizeLabel(competition.totalPrize))}
                  </p>
                </div>
              </div>
              <div className="bg-muted/30 flex items-start gap-3 rounded-xl p-3">
                <UsersThree
                  className="mt-0.5 size-5 shrink-0 text-blue-500 dark:text-blue-400"
                  weight="fill"
                />
                <div>
                  <p className="mb-1 text-sm font-medium">Participantes</p>
                  <p className="text-muted-foreground text-xs">
                    {competition.totalParticipants} clippers
                  </p>
                </div>
              </div>
              <div className="bg-muted/30 flex items-start gap-3 rounded-xl p-3">
                <VideoCamera
                  className="mt-0.5 size-5 shrink-0 text-violet-500 dark:text-violet-400"
                  weight="fill"
                />
                <div>
                  <p className="mb-1 text-sm font-medium">Posts Totais</p>
                  <p className="text-muted-foreground text-xs">
                    {competition.totalPosts} vídeos
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ===== Plataformas Aceitas ===== */}
          <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
            <p className="flex items-center gap-2 text-base font-bold sm:text-lg">
              <VideoCamera className="text-primary size-5" weight="fill" />
              Plataformas Aceitas
            </p>
            <div className="flex flex-wrap gap-2">
              {competition.platforms.map((platform) => {
                const config = platformConfig[platform as PlatformKey]
                if (!config) return null
                const PlatformIcon = config.icon
                return (
                  <div
                    key={platform}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3.5 sm:p-4",
                      config.bgColor,
                      config.borderColor,
                    )}
                  >
                    <PlatformIcon className={cn("size-5 sm:size-6", config.color)} />
                    <span className={cn("text-sm font-semibold", config.color)}>
                      {config.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ===== Requisitos Obrigatórios ===== */}
          {(allHashtags.length > 0 || allMentions.length > 0) && (
            <div className="overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/8 via-transparent to-orange-500/8">
              <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400" />

              <div className="flex flex-col gap-5 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                      <Warning className="size-5 text-amber-500" weight="fill" />
                    </span>
                    <div>
                      <p className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-base font-bold text-transparent sm:text-lg dark:from-amber-300 dark:to-orange-300">
                        Requisitos Obrigatórios
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs font-normal">
                        Itens essenciais para validação do seu vídeo
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="group shrink-0 cursor-pointer gap-2 rounded-xl border-amber-500/30 bg-amber-500/10 text-amber-600 transition-all hover:bg-amber-500/20 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-200"
                    onClick={() => {
                      void navigator.clipboard.writeText(copyText)
                      toast.success("Copiado!", {
                        description:
                          "Menções e hashtags copiadas para a área de transferência",
                      })
                    }}
                  >
                    <ClipboardText
                      className="size-4 transition-transform group-hover:scale-110"
                      weight="fill"
                    />
                    <span className="hidden sm:inline">Copiar Tudo</span>
                    <span className="sm:hidden">Copiar</span>
                  </Button>
                </div>

                {/* Menções */}
                {allMentions.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-pink-500/15 p-1.5">
                        <At className="size-4 text-pink-400" weight="bold" />
                      </span>
                      <p className="text-sm font-semibold">
                        Menções Obrigatórias
                      </p>
                      <Badge
                        variant="outline"
                        className="rounded-full border-pink-500/30 bg-pink-500/10 px-1.5 py-0 text-[10px] text-pink-500 dark:text-pink-400"
                      >
                        {allMentions.length}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {allMentions.map((mention) => (
                        <Badge
                          key={mention}
                          variant="outline"
                          className="cursor-default rounded-full border-pink-500/30 bg-gradient-to-r from-pink-500/15 to-rose-500/15 px-3 py-1.5 font-mono text-sm text-pink-600 transition-all hover:from-pink-500/25 hover:to-rose-500/25 dark:text-pink-300"
                        >
                          <At className="mr-1 size-3.5 text-pink-400" weight="bold" />
                          {mention}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hashtags */}
                {allHashtags.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-amber-500/15 p-1.5">
                        <Hash className="size-4 text-amber-400" weight="bold" />
                      </span>
                      <p className="text-sm font-semibold">
                        Hashtags Obrigatórias
                      </p>
                      <Badge
                        variant="outline"
                        className="rounded-full border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-500 dark:text-amber-400"
                      >
                        {allHashtags.length}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {allHashtags.map((hashtag) => (
                        <Badge
                          key={hashtag}
                          variant="outline"
                          className="cursor-default rounded-full border-amber-500/30 bg-gradient-to-r from-amber-500/15 to-yellow-500/15 px-3 py-1.5 font-mono text-sm text-amber-600 transition-all hover:from-amber-500/25 hover:to-yellow-500/25 dark:text-amber-300"
                        >
                          <Hash
                            className="mr-1 size-3.5 text-amber-400"
                            weight="bold"
                          />
                          {hashtag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prévia da legenda */}
                <div className="border-border/50 bg-muted/20 relative rounded-2xl border p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="rounded-lg bg-cyan-500/15 p-1.5">
                      <Copy className="size-3.5 text-cyan-500 dark:text-cyan-400" />
                    </span>
                    <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                      Prévia da legenda
                    </p>
                  </div>
                  <div className="border-border/30 bg-background/80 rounded-lg border p-3 font-mono text-sm leading-relaxed break-all">
                    {allMentions.map((mention) => (
                      <span key={mention} className="text-pink-500 dark:text-pink-400">
                        @{mention}{" "}
                      </span>
                    ))}
                    {allMentions.length > 0 && allHashtags.length > 0 && (
                      <span className="text-muted-foreground">• </span>
                    )}
                    {allHashtags.map((hashtag) => (
                      <span key={hashtag} className="text-amber-500 dark:text-amber-400">
                        #{hashtag}{" "}
                      </span>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground hover:bg-muted/50 absolute top-3 right-3 size-8 cursor-pointer rounded-lg p-0"
                    onClick={() => {
                      void navigator.clipboard.writeText(copyText)
                      toast.success("Texto copiado!")
                    }}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                </div>

                {/* Observações */}
                <div className="flex flex-col gap-2.5">
                  {allMentions.length > 0 && (
                    <div className="flex items-start gap-3 rounded-2xl border border-red-500/25 bg-gradient-to-r from-red-500/10 to-orange-500/10 p-3.5">
                      <span className="mt-0.5 shrink-0 rounded-lg bg-red-500/20 p-1.5">
                        <Warning className="size-4 text-red-400" weight="fill" />
                      </span>
                      <div>
                        <p className="mb-1 text-sm font-bold text-red-500 dark:text-red-300">
                          ⚠️ Regra Obrigatória
                        </p>
                        <p className="text-xs leading-relaxed text-red-600/80 dark:text-red-300/80">
                          A{" "}
                          <span className="font-bold text-red-600 dark:text-red-200">
                            marcação (@menção)
                          </span>{" "}
                          deve ser obrigatoriamente a{" "}
                          <span className="font-bold text-red-600 underline decoration-red-400/50 dark:text-red-200">
                            primeira coisa na legenda
                          </span>{" "}
                          do seu vídeo. Vídeos que não seguirem esta regra serão
                          automaticamente desqualificados.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/8 p-3">
                    <Info
                      className="mt-0.5 size-4 shrink-0 text-amber-400"
                      weight="fill"
                    />
                    <p className="text-xs leading-relaxed text-amber-700/80 dark:text-amber-300/80">
                      Posts sem as {allMentions.length > 0 ? "menções e " : ""}
                      hashtags obrigatórias serão automaticamente
                      desqualificados da competição.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== Premiação Diária ===== */}
          {rule?.dailyEnabled && (
            <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
              <div>
                <p className="flex items-center gap-2 text-base font-bold sm:text-lg">
                  <CalendarBlank
                    className="size-5 text-blue-500 dark:text-blue-400"
                    weight="fill"
                  />
                  Premiação Diária
                </p>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  Top {rule.dailyTopCount} vídeos do dia
                </p>
              </div>

              <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
                <p className="flex flex-wrap items-center gap-2 text-sm text-blue-500 dark:text-blue-400">
                  <Trophy className="size-4" weight="fill" />
                  <span className="font-semibold">Total Diário:</span>
                  <span
                    className={cn("font-bold", proLocked && "blur-sm select-none")}
                  >
                    {maskBRL(rule.dailyTotalPrize)}
                  </span>
                </p>
              </div>

              <div className="grid gap-3">
                {dailyPrizeEntries.map(([position, prize], index) => {
                  const isFirst = index === 0
                  const isRange = position.includes("-")
                  return (
                    <div
                      key={position}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3.5 sm:gap-4 sm:p-4",
                        isFirst
                          ? "border-yellow-500/30 bg-gradient-to-r from-yellow-500/20 to-amber-500/20"
                          : "border-border/60 bg-muted/20",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-11 shrink-0 items-center justify-center rounded-full sm:size-12",
                          isFirst ? "bg-yellow-500/20" : "bg-primary/10",
                        )}
                      >
                        {isFirst ? (
                          <Crown className="size-5 text-yellow-400 sm:size-6" weight="fill" />
                        ) : (
                          <Trophy className="text-primary size-5 sm:size-6" weight="fill" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "font-bold",
                            isFirst && "text-yellow-500 dark:text-yellow-400",
                          )}
                        >
                          {position}º Lugar{isRange ? "es" : ""}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {isRange ? "Cada posição" : "Vencedor do dia"}
                        </p>
                      </div>
                      <p
                        className={cn(
                          "text-xl font-bold tabular-nums sm:text-2xl",
                          isFirst
                            ? "text-yellow-500 dark:text-yellow-400"
                            : "text-primary",
                          proLocked && "blur-sm select-none",
                        )}
                      >
                        {maskBRL(Number(prize) || 0)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ===== Premiação Mensal ===== */}
          {rule?.monthlyEnabled && (
            <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
              <div>
                <p className="flex items-center gap-2 text-base font-bold sm:text-lg">
                  <Trophy
                    className="size-5 text-violet-500 dark:text-violet-400"
                    weight="fill"
                  />
                  Premiação Mensal
                </p>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  Top {rule.monthlyTopCount} clippers do mês
                </p>
              </div>

              <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-4">
                <p className="flex flex-wrap items-center gap-2 text-sm text-violet-500 dark:text-violet-400">
                  <Sparkle className="size-4" weight="fill" />
                  <span className="font-semibold">Total Mensal:</span>
                  <span
                    className={cn("font-bold", proLocked && "blur-sm select-none")}
                  >
                    {maskBRL(rule.monthlyTotalPrize)}
                  </span>
                </p>
              </div>

              <div className="grid gap-3">
                {monthlyPrizeEntries.map(([position, prize]) => {
                  const posNum = parseInt(position, 10)
                  const isFirst = posNum === 1
                  const isSecond = posNum === 2
                  const isThird = posNum === 3
                  return (
                    <div
                      key={position}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3.5 sm:gap-4 sm:p-4",
                        isFirst
                          ? "border-yellow-500/30 bg-gradient-to-r from-yellow-500/20 to-amber-500/20"
                          : isSecond
                            ? "border-gray-400/30 bg-gradient-to-r from-gray-400/20 to-gray-500/20"
                            : isThird
                              ? "border-orange-600/30 bg-gradient-to-r from-orange-600/20 to-amber-600/20"
                              : "border-border/60 bg-muted/20",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-11 shrink-0 items-center justify-center rounded-full sm:size-12",
                          isFirst
                            ? "bg-yellow-500/20"
                            : isSecond
                              ? "bg-gray-400/20"
                              : isThird
                                ? "bg-orange-600/20"
                                : "bg-primary/10",
                        )}
                      >
                        {isFirst ? (
                          <Crown className="size-5 text-yellow-400 sm:size-6" weight="fill" />
                        ) : isSecond ? (
                          <Medal className="size-5 text-gray-400 sm:size-6" weight="fill" />
                        ) : isThird ? (
                          <Medal className="size-5 text-orange-400 sm:size-6" weight="fill" />
                        ) : (
                          <Trophy className="text-primary size-5 sm:size-6" weight="fill" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "font-bold",
                            isFirst && "text-yellow-500 dark:text-yellow-400",
                            isSecond && "text-gray-500 dark:text-gray-300",
                            isThird && "text-orange-500 dark:text-orange-400",
                          )}
                        >
                          {position}º Lugar
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {isFirst
                            ? "Campeão"
                            : isSecond
                              ? "Vice-campeão"
                              : isThird
                                ? "Terceiro colocado"
                                : "Premiação"}
                        </p>
                      </div>
                      <p
                        className={cn(
                          "text-xl font-bold tabular-nums sm:text-2xl",
                          isFirst
                            ? "text-yellow-500 dark:text-yellow-400"
                            : isSecond
                              ? "text-gray-500 dark:text-gray-300"
                              : isThird
                                ? "text-orange-500 dark:text-orange-400"
                                : "text-primary",
                          proLocked && "blur-sm select-none",
                        )}
                      >
                        {maskBRL(Number(prize) || 0)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ===== Bônus Especial ===== */}
          {rule?.bonusEnabled && (
            <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
              <p className="flex items-center gap-2 text-base font-bold sm:text-lg">
                <Gift
                  className="size-5 text-amber-500 dark:text-amber-400"
                  weight="fill"
                />
                Bônus Especial
              </p>
              <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 p-4 sm:gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-500/20 sm:size-12">
                  <Fire className="size-5 text-amber-400 sm:size-6" weight="fill" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-amber-500 dark:text-amber-400">
                    Vídeo com +{formatNumber(rule.bonusMilestone)} views
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Bônus adicional por vídeo viral
                  </p>
                </div>
                <p className="text-xl font-bold text-amber-500 tabular-nums sm:text-2xl dark:text-amber-400">
                  +{maskBRL(rule.bonusAmount)}
                </p>
              </div>
            </div>
          )}

          {/* ===== Resumo Total ===== */}
          {competition.totalPrize && (
            <div className="glass-card flex flex-col gap-4 rounded-3xl p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-muted-foreground mb-1 text-sm">
                    Prêmio Total da Competição
                  </p>
                  <p
                    className={cn(
                      "text-2xl font-bold text-emerald-500 sm:text-3xl dark:text-emerald-400",
                      proLocked && "blur-md select-none",
                    )}
                  >
                    {maskText(formatPrizeLabel(competition.totalPrize))}
                  </p>
                </div>
                <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 sm:size-16">
                  <Sparkle
                    className="size-7 text-emerald-500 sm:size-8 dark:text-emerald-400"
                    weight="fill"
                  />
                </span>
              </div>

              <div className="rounded-xl bg-emerald-500/10 p-3">
                <p className="flex items-start gap-2 text-xs text-emerald-600/90 dark:text-emerald-400/90">
                  <Sparkle className="mt-0.5 size-4 shrink-0" weight="fill" />
                  <span>
                    Os prêmios são calculados com base no total de views. Quanto
                    mais views, maior sua chance de ganhar!
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* ===== Regras Importantes ===== */}
          <div className="rounded-3xl border border-blue-500/20 bg-blue-500/5 p-4 sm:p-5">
            <p className="mb-4 flex items-center gap-2 text-base font-bold sm:text-lg">
              <BookOpen
                className="size-5 text-blue-500 dark:text-blue-400"
                weight="fill"
              />
              Regras Importantes
            </p>
            <div className="flex flex-col gap-3">
              {[
                {
                  title: "Posts Elegíveis",
                  text: "Apenas posts com todas as hashtags e menções obrigatórias contam para o ranking",
                },
                {
                  title: "Atualização de Métricas",
                  text: "As views são atualizadas automaticamente 2x por dia",
                },
                {
                  title: "Contas Cadastradas",
                  text: "Apenas posts das contas cadastradas nesta competição serão contabilizados",
                },
                {
                  title: "Detecção de Fraude",
                  text: "Posts com compra de views serão desqualificados automaticamente",
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <CheckCircle
                    className="mt-0.5 size-5 shrink-0 text-blue-500 dark:text-blue-400"
                    weight="fill"
                  />
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-muted-foreground text-xs">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            className="btn-gradient-auth w-full cursor-pointer rounded-xl font-semibold sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            <CheckCircle className="size-4" weight="fill" />
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
