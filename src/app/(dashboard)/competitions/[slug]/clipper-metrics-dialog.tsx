"use client"

import * as React from "react"
import Image from "next/image"
import {
  ArrowSquareOut,
  ChartBar,
  ChatCircle,
  CheckCircle,
  Clock,
  Eye,
  FilmSlate,
  Heart,
  Pulse,
  ShareFat,
  Spinner,
  TrendUp,
  Trophy,
  UsersThree,
  Warning,
  XCircle,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"
import { api, type RouterOutputs } from "@/trpc/react"

import { CLIP_POST_STATUS_CONFIG, formatNumber } from "./shared"

type ClipperPost =
  RouterOutputs["admin"]["getClipperPostsInCompetition"][number]

/** Campos mínimos usados pelo dialog (compatível com o entry do ranking mensal). */
export interface ClipperMetricsEntry {
  clipperName: string
  totalViews: number
  totalLikes: number
  postsCount: number
  engagementRate: number
}

interface ClipperMetricsDialogProps {
  entry: ClipperMetricsEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
  campaignId: string
}

interface AccountAgg {
  username: string | null
  platform: string
  posts: ClipperPost[]
  totalViews: number
  totalLikes: number
  totalComments: number
  totalShares: number
}

interface PlatformAgg {
  platform: string
  count: number
  totalViews: number
  totalLikes: number
}

const PLATFORM_BAR_GRADIENTS: Record<string, string> = {
  INSTAGRAM: "from-pink-500 to-rose-500",
  TIKTOK: "from-cyan-400 to-blue-500",
  YOUTUBE: "from-red-500 to-red-600",
  KWAI: "from-orange-400 to-amber-500",
  FACEBOOK: "from-blue-500 to-indigo-500",
}

const POST_STATUS_ICONS: Record<string, React.ElementType> = {
  ELIGIBLE: CheckCircle,
  PENDING: Clock,
  INELIGIBLE: XCircle,
  DISQUALIFIED: Warning,
}

export function ClipperMetricsDialog({
  entry,
  open,
  onOpenChange,
  campaignId,
}: ClipperMetricsDialogProps) {
  const { data: posts, isLoading } =
    api.admin.getClipperPostsInCompetition.useQuery(
      { clipperName: entry?.clipperName ?? "", campaignId },
      { enabled: open && !!entry && !!campaignId },
    )

  /* ===== Agregações ===== */
  const accounts = React.useMemo<AccountAgg[]>(() => {
    if (!posts) return []
    const map = new Map<string, AccountAgg>()
    for (const post of posts) {
      const key = post.username ?? "Sem conta"
      let agg = map.get(key)
      if (!agg) {
        agg = {
          username: post.username,
          platform: post.platform,
          posts: [],
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
        }
        map.set(key, agg)
      }
      agg.posts.push(post)
      agg.totalViews += Number(post.views)
      agg.totalLikes += post.likes
      agg.totalComments += post.comments
      agg.totalShares += post.shares ?? 0
    }
    return [...map.values()].sort((a, b) => b.totalViews - a.totalViews)
  }, [posts])

  const platforms = React.useMemo<PlatformAgg[]>(() => {
    if (!posts) return []
    const map = new Map<string, PlatformAgg>()
    for (const post of posts) {
      let agg = map.get(post.platform)
      if (!agg) {
        agg = { platform: post.platform, count: 0, totalViews: 0, totalLikes: 0 }
        map.set(post.platform, agg)
      }
      agg.count++
      agg.totalViews += Number(post.views)
      agg.totalLikes += post.likes
    }
    return [...map.values()].sort((a, b) => b.totalViews - a.totalViews)
  }, [posts])

  const totalPlatformViews = React.useMemo(
    () => platforms.reduce((sum, p) => sum + p.totalViews, 0),
    [platforms],
  )

  const bestPost = React.useMemo<ClipperPost | null>(() => {
    if (!posts || posts.length === 0) return null
    return posts.reduce((best, post) =>
      Number(post.views) > Number(best.views) ? post : best,
    )
  }, [posts])

  const statusCounts = React.useMemo<[string, number][]>(() => {
    if (!posts) return []
    const counts = new Map<string, number>()
    for (const post of posts) {
      counts.set(post.status, (counts.get(post.status) ?? 0) + 1)
    }
    return [...counts.entries()]
  }, [posts])

  if (!entry) return null

  const bestPostConfig = bestPost
    ? platformConfig[bestPost.platform as PlatformKey]
    : null
  const BestPostIcon = bestPostConfig?.icon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[96vw] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-4xl">
        {/* ===== Header ===== */}
        <DialogHeader className="border-border/60 shrink-0 border-b p-4 text-left sm:p-6">
          <div className="flex items-center gap-3">
            <span className="bg-gradient-custom flex size-10 shrink-0 items-center justify-center rounded-2xl text-[#04222A]">
              <ChartBar className="size-5" weight="fill" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-base font-bold tracking-tight sm:text-lg">
                {entry.clipperName}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Métricas detalhadas na competição
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* ===== Corpo scrollável ===== */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
          {!posts || isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Spinner className="text-brand-cyan not-dark:text-primary size-8 animate-spin" />
              <p className="text-muted-foreground text-sm">
                Carregando métricas...
              </p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <SummaryCard
                  icon={<Eye className="size-4" weight="fill" />}
                  label="Views"
                  value={formatNumber(entry.totalViews)}
                  className="text-brand-cyan not-dark:text-primary"
                />
                <SummaryCard
                  icon={<Heart className="size-4" weight="fill" />}
                  label="Likes"
                  value={formatNumber(entry.totalLikes)}
                  className="text-pink-600 dark:text-pink-400"
                />
                <SummaryCard
                  icon={<FilmSlate className="size-4" weight="fill" />}
                  label="Posts"
                  value={String(entry.postsCount || posts.length)}
                  className="text-sky-600 dark:text-sky-400"
                />
                <SummaryCard
                  icon={<TrendUp className="size-4" weight="bold" />}
                  label="ER"
                  value={`${(entry.engagementRate ?? 0).toFixed(1)}%`}
                  className="text-violet-600 dark:text-violet-400"
                />
              </div>

              {/* Distribuição por plataforma */}
              {platforms.length > 0 && (
                <SectionCard
                  icon={<ChartBar className="size-4" weight="fill" />}
                  title="Distribuição por Plataforma"
                >
                  <div className="flex flex-col gap-3">
                    {platforms.map((platform) => {
                      const percentage =
                        totalPlatformViews > 0
                          ? (platform.totalViews / totalPlatformViews) * 100
                          : 0
                      const config =
                        platformConfig[platform.platform as PlatformKey]
                      const PlatformIcon = config?.icon
                      const barGradient =
                        PLATFORM_BAR_GRADIENTS[platform.platform] ??
                        "from-zinc-400 to-zinc-500"
                      return (
                        <div
                          key={platform.platform}
                          className="flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              {PlatformIcon && (
                                <PlatformIcon
                                  className={cn(
                                    "size-4 shrink-0",
                                    config?.color,
                                  )}
                                />
                              )}
                              <span className="truncate text-xs font-medium sm:text-sm">
                                {config?.label ?? platform.platform}
                              </span>
                            </div>
                            <div className="text-muted-foreground flex shrink-0 items-center gap-2 text-[10px] sm:gap-3 sm:text-xs">
                              <span>{platform.count} posts</span>
                              <span className="hidden sm:inline">·</span>
                              <span className="hidden sm:inline">
                                {formatNumber(platform.totalViews)} views
                              </span>
                              <span className="text-foreground font-bold">
                                {percentage.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          <div className="bg-muted/40 h-2 overflow-hidden rounded-full">
                            <div
                              className={cn(
                                "h-full rounded-full bg-gradient-to-r transition-all duration-500",
                                barGradient,
                              )}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </SectionCard>
              )}

              {/* Performance por conta */}
              {accounts.length > 0 && (
                <SectionCard
                  icon={<UsersThree className="size-4" weight="fill" />}
                  title="Performance por Conta"
                >
                  <div className="flex flex-col gap-2.5">
                    {accounts.map((account, index) => {
                      const config =
                        platformConfig[account.platform as PlatformKey]
                      const AccountIcon = config?.icon
                      return (
                        <div
                          key={index}
                          className="border-border/60 bg-background/60 flex flex-col gap-2.5 rounded-2xl border p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              {AccountIcon && (
                                <AccountIcon
                                  className={cn(
                                    "size-4 shrink-0",
                                    config?.color,
                                  )}
                                />
                              )}
                              <span className="truncate text-sm font-semibold">
                                {account.username
                                  ? `@${account.username.replace("@", "")}`
                                  : "Sem conta"}
                              </span>
                            </div>
                            <span className="text-muted-foreground shrink-0 text-[10px] sm:text-xs">
                              {account.posts.length} posts
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {[
                              {
                                icon: Eye,
                                label: "Views",
                                value: formatNumber(account.totalViews),
                              },
                              {
                                icon: Heart,
                                label: "Likes",
                                value: formatNumber(account.totalLikes),
                              },
                              {
                                icon: ChatCircle,
                                label: "Comentários",
                                value: formatNumber(account.totalComments),
                              },
                              {
                                icon: ShareFat,
                                label: "Shares",
                                value: formatNumber(account.totalShares),
                              },
                            ].map((metric) => {
                              const MetricIcon = metric.icon
                              return (
                                <div
                                  key={metric.label}
                                  className="border-border/40 bg-muted/20 rounded-lg border p-2"
                                >
                                  <div className="text-muted-foreground mb-0.5 flex items-center gap-1 text-[10px]">
                                    <MetricIcon className="size-3" />
                                    {metric.label}
                                  </div>
                                  <p className="text-xs font-bold tabular-nums sm:text-sm">
                                    {metric.value}
                                  </p>
                                </div>
                              )
                            })}
                          </div>
                          <div className="text-muted-foreground border-border/40 flex flex-wrap items-center gap-3 border-t pt-1.5 text-[10px]">
                            <span>Média/post:</span>
                            <span className="text-foreground font-semibold">
                              {formatNumber(
                                Math.round(
                                  account.totalViews / account.posts.length,
                                ),
                              )}{" "}
                              views
                            </span>
                            <span className="text-foreground font-semibold">
                              {formatNumber(
                                Math.round(
                                  account.totalLikes / account.posts.length,
                                ),
                              )}{" "}
                              likes
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </SectionCard>
              )}

              {/* Melhor post */}
              {bestPost && (
                <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-yellow-600 text-[#3b2a00]">
                      <Trophy className="size-3.5" weight="fill" />
                    </span>
                    Melhor Post
                  </div>
                  <div className="flex items-start gap-3 sm:gap-4">
                    {bestPost.thumbnailUrl && (
                      <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-xl border border-amber-500/30 sm:h-32 sm:w-24">
                        <Image
                          src={bestPost.thumbnailUrl}
                          alt=""
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                      <div className="flex items-center gap-2">
                        {BestPostIcon && (
                          <BestPostIcon
                            className={cn(
                              "size-4 shrink-0",
                              bestPostConfig?.color,
                            )}
                          />
                        )}
                        <span className="truncate text-sm font-semibold">
                          {bestPost.username
                            ? `@${bestPost.username.replace("@", "")}`
                            : "Sem conta"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          {
                            label: "Views",
                            value: formatNumber(Number(bestPost.views)),
                            className:
                              "text-brand-cyan not-dark:text-primary",
                          },
                          {
                            label: "Likes",
                            value: formatNumber(bestPost.likes),
                            className: "text-pink-600 dark:text-pink-400",
                          },
                          {
                            label: "Comments",
                            value: formatNumber(bestPost.comments),
                            className: "text-foreground",
                          },
                          {
                            label: "Shares",
                            value: formatNumber(bestPost.shares ?? 0),
                            className: "text-foreground",
                          },
                        ].map((stat) => (
                          <div key={stat.label}>
                            <p className="text-muted-foreground text-[10px]">
                              {stat.label}
                            </p>
                            <p
                              className={cn(
                                "text-xs font-bold tabular-nums sm:text-sm",
                                stat.className,
                              )}
                            >
                              {stat.value}
                            </p>
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-fit cursor-pointer gap-1.5 rounded-xl text-xs"
                        onClick={() =>
                          window.open(bestPost.submittedUrl, "_blank")
                        }
                      >
                        <ArrowSquareOut className="size-3" />
                        Ver Post
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Status dos posts */}
              {statusCounts.length > 0 && (
                <SectionCard
                  icon={<Pulse className="size-4" weight="bold" />}
                  title="Status dos Posts"
                >
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {statusCounts.map(([status, count]) => {
                      const config = CLIP_POST_STATUS_CONFIG[status]
                      const StatusIcon = POST_STATUS_ICONS[status] ?? Pulse
                      return (
                        <div
                          key={status}
                          className={cn(
                            "rounded-xl border p-2.5",
                            config?.badge ??
                              "border-border bg-muted/40 text-muted-foreground",
                          )}
                        >
                          <div className="mb-1 flex items-center gap-1.5">
                            <StatusIcon className="size-3.5" weight="fill" />
                            <span className="text-[10px] font-semibold tracking-wide uppercase">
                              {config?.label ?? status}
                            </span>
                          </div>
                          <p className="text-foreground text-xl font-black tabular-nums">
                            {count}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </SectionCard>
              )}
            </>
          )}
        </div>

        {/* ===== Footer ===== */}
        <div className="border-border/60 flex shrink-0 items-center justify-end border-t px-4 py-3 sm:px-6">
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ===== Blocos auxiliares ===== */

function SummaryCard({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode
  label: string
  value: string
  className?: string
}) {
  return (
    <div className="border-border/60 bg-muted/20 flex flex-col gap-1.5 rounded-2xl border px-3.5 py-3">
      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase">
        <span className={className}>{icon}</span>
        {label}
      </span>
      <span
        className={cn(
          "text-base font-bold tabular-nums sm:text-lg",
          className,
        )}
      >
        {value}
      </span>
    </div>
  )
}

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="border-border/60 bg-muted/20 flex flex-col gap-3 rounded-2xl border p-4">
      <span className="inline-flex items-center gap-2 text-sm font-bold">
        <span className="bg-gradient-custom flex size-7 items-center justify-center rounded-lg text-[#04222A]">
          {icon}
        </span>
        {title}
      </span>
      {children}
    </div>
  )
}
