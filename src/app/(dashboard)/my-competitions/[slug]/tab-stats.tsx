"use client"

import * as React from "react"
import Image from "next/image"
import {
  ChatCircle,
  Eye,
  Heart,
  Pulse,
  ShareFat,
  Star,
  VideoCamera,
} from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"

import {
  EmptyState,
  formatNumber,
  PLATFORM_CHART_COLORS,
} from "../../competitions/[slug]/shared"
import { type CompetitionDetails } from "./shared"

/* ============================================================
   Tab "Estatísticas"
   ============================================================ */

export function StatsTab({
  competition,
  viewsGoal,
}: {
  competition: CompetitionDetails
  viewsGoal: number
}) {
  /* Meta real da competição (totalPrize × 2000) em vez do 2M fixo */
  const goalPct =
    viewsGoal > 0 ? (competition.myTotalViews / viewsGoal) * 100 : 0

  /* Views por plataforma */
  const platformRows = React.useMemo(() => {
    const totals = competition.myPosts.reduce<Record<string, number>>(
      (acc, post) => {
        acc[post.platform] = (acc[post.platform] ?? 0) + post.views
        return acc
      },
      {},
    )
    const totalViews = Object.values(totals).reduce(
      (sum, views) => sum + views,
      0,
    )
    return {
      totalViews,
      rows: Object.entries(totals).sort((a, b) => b[1] - a[1]),
    }
  }, [competition.myPosts])

  const bestPost = React.useMemo(() => {
    if (competition.myPosts.length === 0) return null
    return [...competition.myPosts].sort((a, b) => b.views - a.views)[0] ?? null
  }, [competition.myPosts])

  return (
    <div className="flex flex-col gap-4">
      {/* ===== Views + Engajamento ===== */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Total de Visualizações */}
        <div className="glass-card flex flex-col gap-3 rounded-3xl p-4 sm:p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-500 dark:text-blue-400">
              <Eye className="size-4" weight="fill" />
            </span>
            <p className="text-sm font-bold sm:text-base">
              Total de Visualizações
            </p>
          </div>
          <p className="text-2xl font-bold text-blue-500 tabular-nums sm:text-3xl dark:text-blue-400">
            {formatNumber(competition.myTotalViews)}
          </p>
          {viewsGoal > 0 ? (
            <>
              <Progress
                value={Math.min(goalPct, 100)}
                className="bg-blue-500/15 [&>[data-slot=progress-indicator]]:bg-gradient-to-r [&>[data-slot=progress-indicator]]:from-blue-500 [&>[data-slot=progress-indicator]]:to-cyan-400"
              />
              <p className="text-muted-foreground text-xs sm:text-sm">
                {goalPct.toFixed(1)}% da meta de {formatNumber(viewsGoal)}{" "}
                views da competição
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-xs sm:text-sm">
              Soma de todos os seus vídeos nesta competição
            </p>
          )}
        </div>

        {/* Engajamento Total */}
        <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-pink-500/15 text-pink-500 dark:text-pink-400">
              <Pulse className="size-4" weight="bold" />
            </span>
            <p className="text-sm font-bold sm:text-base">Engajamento Total</p>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <div>
              <Heart
                className="mb-1 size-4 text-pink-400 sm:size-4.5"
                weight="fill"
              />
              <p className="text-base font-bold tabular-nums sm:text-lg">
                {formatNumber(competition.myTotalLikes)}
              </p>
              <p className="text-muted-foreground text-[10px] sm:text-xs">
                Likes
              </p>
            </div>
            <div>
              <ChatCircle
                className="mb-1 size-4 text-blue-400 sm:size-4.5"
                weight="fill"
              />
              <p className="text-base font-bold tabular-nums sm:text-lg">
                {formatNumber(competition.myTotalComments)}
              </p>
              <p className="text-muted-foreground text-[10px] sm:text-xs">
                Coment.
              </p>
            </div>
            <div>
              <ShareFat
                className="mb-1 size-4 text-emerald-400 sm:size-4.5"
                weight="fill"
              />
              <p className="text-base font-bold tabular-nums sm:text-lg">
                {formatNumber(competition.myTotalShares)}
              </p>
              <p className="text-muted-foreground text-[10px] sm:text-xs">
                Shares
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Performance por Plataforma ===== */}
      <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
        <div className="flex items-center gap-2.5">
          <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
            <VideoCamera className="size-4" weight="fill" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold sm:text-base">
              Performance por Plataforma
            </p>
            <p className="text-muted-foreground text-xs">
              Distribuição das suas views por rede social
            </p>
          </div>
        </div>

        {platformRows.rows.length === 0 ? (
          <EmptyState
            icon={<VideoCamera className="size-6" weight="fill" />}
            title="Nenhum post enviado ainda"
            subtitle="Envie posts para acompanhar sua performance por plataforma"
          />
        ) : (
          <div className="flex flex-col gap-3 sm:gap-4">
            {platformRows.rows.map(([platform, views]) => {
              const config = platformConfig[platform as PlatformKey]
              const PlatformIcon = config?.icon
              const color = PLATFORM_CHART_COLORS[platform] ?? "#6b7280"
              const percentage =
                platformRows.totalViews > 0
                  ? (views / platformRows.totalViews) * 100
                  : 0
              return (
                <div key={platform} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2">
                      {PlatformIcon && (
                        <PlatformIcon className="size-4 sm:size-5" style={{ color }} />
                      )}
                      <span className="text-xs font-medium sm:text-sm">
                        {config?.label ?? platform}
                      </span>
                    </span>
                    <span className="text-xs font-bold tabular-nums sm:text-sm">
                      {formatNumber(views)} views
                      <span className="text-muted-foreground ml-1.5 font-medium">
                        {percentage.toFixed(1)}%
                      </span>
                    </span>
                  </div>
                  <div className="bg-muted/40 h-2 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.max(percentage, 2)}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ===== Melhor Performance ===== */}
      <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500 dark:text-amber-400">
            <Star className="size-4" weight="fill" />
          </span>
          <p className="text-sm font-bold sm:text-base">Melhor Performance</p>
        </div>

        {bestPost ? (
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="bg-muted relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl sm:size-24">
              {bestPost.thumbnailUrl ? (
                <Image
                  src={bestPost.thumbnailUrl}
                  alt="Melhor post"
                  fill
                  className="object-cover"
                  sizes="96px"
                />
              ) : (
                <VideoCamera className="text-muted-foreground size-8" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-2 line-clamp-2 text-xs font-medium sm:text-sm">
                {bestPost.caption || "Sem descrição"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="gap-1 rounded-full text-[10px] sm:text-xs"
                >
                  <Eye className="size-3 sm:size-3.5" weight="fill" />
                  {formatNumber(bestPost.views)}
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-full text-[10px] sm:text-xs"
                >
                  ER: {bestPost.engagementRate.toFixed(1)}%
                </Badge>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<Star className="size-6" weight="fill" />}
            title="Nenhum post ainda"
            subtitle="Envie seu primeiro post para ver seu melhor desempenho aqui"
          />
        )}
      </div>
    </div>
  )
}
