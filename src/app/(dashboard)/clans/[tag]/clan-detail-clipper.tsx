"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CalendarBlank,
  ChartBar,
  ChatCircle,
  ChatText,
  CheckCircle,
  ClipboardText,
  Clock,
  Crown,
  Envelope,
  Eye,
  Heart,
  MagnifyingGlass,
  Medal,
  Megaphone,
  Pulse,
  ShareNetwork,
  Shield,
  Sparkle,
  Spinner,
  TrendUp,
  Trophy,
  UserCheck,
  UserMinus,
  UsersThree,
  VideoCamera,
  XCircle,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { ClanTagBadge, getClanIcon } from "@/components/clan-tag-badge"
import { StatTile } from "@/components/home/stat-tile"
import { DarkScope } from "@/components/shared/dark-scope"
import { Reveal } from "@/components/shared/reveal"
import {
  Bone,
  StatTilesGridSkeleton,
  TableSkeleton,
} from "@/components/shared/skeletons"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

import { EmptyState, PositionBadge } from "../../competitions/[slug]/shared"

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString("pt-BR")
}

const HERO_SPARKLES = [
  { left: "58%", top: "16%", size: 11, delay: 0, dur: 3.6 },
  { left: "78%", top: "10%", size: 9, delay: 1.4, dur: 4.4 },
  { left: "88%", top: "34%", size: 13, delay: 2.2, dur: 3.4 },
  { left: "68%", top: "58%", size: 8, delay: 0.8, dur: 4.8 },
] as const

const HERO_PARTICLES = [
  { left: "62%", bottom: "18%", size: 3, delay: 0.4, dur: 5.6, x: 12 },
  { left: "74%", bottom: "12%", size: 2, delay: 2, dur: 6.6, x: -12 },
  { left: "86%", bottom: "20%", size: 3, delay: 1.2, dur: 5.4, x: 10 },
  { left: "94%", bottom: "14%", size: 2, delay: 3.4, dur: 6.2, x: -8 },
] as const

const RANK_STYLES = [
  {
    bg: "from-amber-500/15 via-yellow-500/10 to-transparent",
    ring: "ring-amber-500/40",
    text: "text-amber-600 dark:text-amber-400",
    chip: "bg-amber-500",
    icon: Crown,
    label: "1º",
  },
  {
    bg: "from-slate-300/15 via-slate-400/10 to-transparent",
    ring: "ring-slate-400/40",
    text: "text-slate-500 dark:text-slate-300",
    chip: "bg-slate-400",
    icon: Medal,
    label: "2º",
  },
  {
    bg: "from-orange-700/15 via-orange-600/10 to-transparent",
    ring: "ring-orange-700/40",
    text: "text-orange-600",
    chip: "bg-orange-700",
    icon: Medal,
    label: "3º",
  },
] as const

interface ClanDetailClipperProps {
  tag: string
}

export default function ClanDetailClipper({ tag }: ClanDetailClipperProps) {
  const [appSearch, setAppSearch] = React.useState("")

  const utils = api.useUtils()
  const { data: clan, isLoading } = api.clan.getByTagPublic.useQuery({ tag })

  const { data: pendingApps, isLoading: appsLoading } =
    api.clan.listApplications.useQuery(
      { clanId: clan?.id ?? "", status: "PENDING" },
      { enabled: !!clan?.id && !!clan?.isOwner },
    )

  const approveMutation = api.clan.approveApplication.useMutation({
    onSuccess: () => {
      toast.success("Inscrição aprovada com sucesso!")
      void utils.clan.listApplications.invalidate()
      void utils.clan.getByTagPublic.invalidate({ tag })
    },
    onError: (err) => toast.error(err.message),
  })

  const rejectMutation = api.clan.rejectApplication.useMutation({
    onSuccess: () => {
      toast.success("Inscrição rejeitada")
      void utils.clan.listApplications.invalidate()
      void utils.clan.getByTagPublic.invalidate({ tag })
    },
    onError: (err) => toast.error(err.message),
  })

  const removeMemberMutation = api.clan.removeMemberAsOwner.useMutation({
    onSuccess: () => {
      toast.success("Membro removido do clã com sucesso")
      void utils.clan.getByTagPublic.invalidate({ tag })
    },
    onError: (err) => toast.error(err.message),
  })

  const filteredApps = React.useMemo(() => {
    if (!pendingApps) return []
    if (!appSearch) return pendingApps
    const q = appSearch.toLowerCase()
    return pendingApps.filter((app) => {
      const name = (
        app.clipper.artisticName ?? app.clipper.fullName
      ).toLowerCase()
      const discord = app.clipper.discordUsername?.toLowerCase() ?? ""
      const email = app.clipper.user?.email?.toLowerCase() ?? ""
      return name.includes(q) || discord.includes(q) || email.includes(q)
    })
  }, [pendingApps, appSearch])

  const rankedMembers = React.useMemo(() => {
    if (!clan) return []
    return [...clan.members].sort((a, b) => b.totalViews - a.totalViews)
  }, [clan])

  const todayTop = React.useMemo(() => {
    if (!clan) return []
    return [...clan.members]
      .filter((m) => m.todayViews > 0)
      .sort((a, b) => b.todayViews - a.todayViews)
      .slice(0, 3)
  }, [clan])

  if (isLoading) return <LoadingSkeleton />

  if (!clan) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="glass-card flex flex-col items-center gap-4 rounded-3xl py-20 text-center">
          <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
            <Shield className="size-6" weight="fill" />
          </span>
          <div>
            <p className="text-lg font-bold">Clã não encontrado</p>
            <p className="text-muted-foreground mt-1 text-sm">
              O clã que você está procurando não existe ou não está ativo.
            </p>
          </div>
          <Button asChild variant="outline" className="cursor-pointer rounded-xl">
            <Link href="/clans">
              <ArrowLeft className="size-4" />
              Voltar para Clãs
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  const ClanIcon = getClanIcon(clan.emoji)
  const maxCampaignViews = clan.topCampaigns[0]?.totalViews ?? 0

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-7 sm:px-6 sm:py-8">
      {/* ===== Voltar ===== */}
      <Reveal immediate>
        <Button
          asChild
          variant="ghost"
          className="text-muted-foreground hover:text-foreground -ml-2 w-fit cursor-pointer rounded-xl"
        >
          <Link href="/clans">
            <ArrowLeft className="size-4" />
            Voltar para Clãs
          </Link>
        </Button>
      </Reveal>

      {/* ===== Hero do clã (faixa dark tingida pela cor do clã) ===== */}
      <DarkScope className="contents">
        <Reveal immediate>
          <section
            className="relative overflow-hidden rounded-3xl bg-[#050f1c] p-5 ring-1 ring-[color-mix(in_oklab,var(--clan-color)_26%,transparent)] sm:p-7 lg:p-8"
            style={{ "--clan-color": clan.emojiColor } as React.CSSProperties}
          >
            {/* backdrop animado tingido pela emojiColor */}
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <span
                className="arena-aurora absolute -top-20 right-[6%] size-64 rounded-full blur-2xl"
                style={{
                  background:
                    "radial-gradient(circle, color-mix(in oklab, var(--clan-color) 26%, transparent), transparent 66%)",
                }}
              />
              <span
                className="arena-aurora absolute -bottom-24 left-[18%] size-72 rounded-full blur-2xl"
                style={{
                  background:
                    "radial-gradient(circle, color-mix(in oklab, var(--clan-color) 16%, transparent), transparent 66%)",
                  animationDelay: "-6s",
                }}
              />
              <div className="hero-grid absolute inset-0 opacity-35 [mask-image:radial-gradient(ellipse_at_75%_40%,#000_25%,transparent_75%)]" />
              <div className="absolute inset-y-0 left-1/3 w-28 overflow-visible">
                <span
                  className="hero-sweep block h-full w-full"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, transparent, color-mix(in oklab, var(--clan-color) 12%, transparent), transparent)",
                  }}
                />
              </div>
              <span
                className="arena-comet absolute top-[8%] right-[12%] h-px w-24 rounded-full bg-gradient-to-l from-white/70 via-[color-mix(in_oklab,var(--clan-color)_65%,transparent)] to-transparent"
                style={
                  {
                    "--comet-dur": "10s",
                    "--comet-delay": "2.5s",
                    "--comet-x": "-300px",
                    "--comet-y": "200px",
                    "--comet-angle": "-33deg",
                  } as React.CSSProperties
                }
              />
              {HERO_SPARKLES.map((sparkle, index) => (
                <Sparkle
                  key={index}
                  weight="fill"
                  className="arena-twinkle absolute"
                  style={
                    {
                      left: sparkle.left,
                      top: sparkle.top,
                      width: sparkle.size,
                      height: sparkle.size,
                      color:
                        index % 2 === 0
                          ? clan.emojiColor
                          : "var(--brand-cyan)",
                      "--twinkle-delay": `${sparkle.delay}s`,
                      "--twinkle-dur": `${sparkle.dur}s`,
                      "--twinkle-opacity": 0.85,
                    } as React.CSSProperties
                  }
                />
              ))}
              {HERO_PARTICLES.map((particle, index) => (
                <span
                  key={index}
                  className="arena-particle absolute rounded-full"
                  style={
                    {
                      left: particle.left,
                      bottom: particle.bottom,
                      width: particle.size,
                      height: particle.size,
                      backgroundColor:
                        index % 2 === 0
                          ? clan.emojiColor
                          : "var(--brand-cyan)",
                      "--particle-delay": `${particle.delay}s`,
                      "--particle-dur": `${particle.dur}s`,
                      "--particle-x": `${particle.x}px`,
                      "--particle-opacity": 0.75,
                    } as React.CSSProperties
                  }
                />
              ))}
              <span
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, color-mix(in oklab, var(--clan-color) 60%, transparent), color-mix(in oklab, var(--clan-color) 32%, transparent), transparent)",
                }}
              />
            </div>

            <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-start">
              {/* Imagem / ícone do clã com glow na emojiColor */}
              <div className="relative z-0 shrink-0">
                {clan.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={clan.imageUrl}
                    alt={clan.name}
                    loading="eager"
                    className="size-28 rounded-2xl object-cover ring-2 ring-[color-mix(in_oklab,var(--clan-color)_45%,transparent)] sm:size-36"
                  />
                ) : (
                  <div
                    className="flex size-28 items-center justify-center rounded-2xl ring-2 ring-[color-mix(in_oklab,var(--clan-color)_45%,transparent)] sm:size-36"
                    style={{
                      background:
                        "linear-gradient(135deg, color-mix(in oklab, var(--clan-color) 24%, transparent), color-mix(in oklab, var(--clan-color) 8%, transparent))",
                    }}
                  >
                    <ClanIcon
                      className="size-14"
                      style={{ color: clan.emojiColor }}
                    />
                  </div>
                )}
                <span
                  aria-hidden
                  className="absolute -inset-1 -z-10 rounded-2xl blur-xl"
                  style={{ backgroundColor: clan.emojiColor, opacity: 0.25 }}
                />
              </div>

              {/* Info */}
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-gradient text-2xl leading-tight font-bold tracking-tight sm:text-3xl lg:text-4xl">
                    {clan.name}
                  </h1>
                  <span className="bg-gradient-custom inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-[#04222A]">
                    Ativo
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <ClanTagBadge
                    tag={clan.tag}
                    emoji={clan.emoji}
                    emojiColor={clan.emojiColor}
                    size="md"
                  />
                  <span className="inline-flex items-center gap-1.5 text-sm text-[#8aa3b3]">
                    <UsersThree className="size-4" weight="fill" />
                    {clan.memberCount} membros
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm text-[#8aa3b3]">
                    <CalendarBlank className="size-4" />
                    Criado em{" "}
                    {new Date(clan.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                </div>

                {clan.description && (
                  <p className="max-w-3xl text-sm leading-relaxed text-[#8aa3b3]">
                    {clan.description}
                  </p>
                )}

                {clan.owner && (
                  <div className="mt-1 flex items-center gap-2">
                    <Avatar className="size-6 ring-1 ring-violet-500/40">
                      <AvatarImage src={clan.owner.imageUrl ?? undefined} />
                      <AvatarFallback className="text-[10px]">
                        {clan.owner.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-[#8aa3b3]">
                      Liderado por{" "}
                      <span className="font-semibold text-violet-300">
                        {clan.owner.name}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>
        </Reveal>
      </DarkScope>

      {/* ===== KPIs ===== */}
      <Reveal immediate delayMs={60}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            icon={<Eye className="size-4" weight="fill" />}
            label="Views Totais"
            value={clan.stats.totalViews}
            kind="compact"
            hint={`${clan.stats.totalPosts} posts no total`}
            accent="gradient"
            gradientValue
          />
          <StatTile
            icon={<VideoCamera className="size-4" weight="fill" />}
            label="Posts Totais"
            value={clan.stats.totalPosts}
            kind="compact"
            hint={`${clan.memberCount} membros ativos`}
            accent="cyan"
          />
          <StatTile
            icon={<Pulse className="size-4" weight="fill" />}
            label="Engajamento"
            value={clan.stats.engagement}
            kind="percent"
            hint={`${formatNumber(clan.stats.totalLikes + clan.stats.totalComments + clan.stats.totalShares)} interações`}
            accent="green"
          />
          <StatTile
            icon={<ChartBar className="size-4" weight="fill" />}
            label="Média Views"
            value={clan.stats.avgViewsPerMember}
            kind="compact"
            hint="por membro"
            accent="cyan"
          />
        </div>
      </Reveal>

      {/* ===== Top Clipadores do Dia ===== */}
      {todayTop.length > 0 && (
        <Reveal immediate delayMs={120}>
          <div className="glass-card relative overflow-hidden rounded-3xl p-4 sm:p-6">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-amber-500/10 blur-3xl"
            />
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <TrendUp className="size-4.5" weight="bold" />
              </span>
              <h2 className="text-lg font-bold">Top Clipadores do Dia</h2>
              <Badge
                variant="outline"
                className="ml-auto rounded-full border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
              >
                Hoje
              </Badge>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {todayTop.map((member, idx) => {
                const style = RANK_STYLES[idx]!
                const RankIcon = style.icon
                return (
                  <div
                    key={member.id}
                    className={cn(
                      "border-border/60 relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 transition-all duration-300 hover:shadow-lg",
                      style.bg,
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className={cn("size-12 ring-2", style.ring)}>
                          <AvatarImage src={member.imageUrl ?? undefined} />
                          <AvatarFallback className="text-sm">
                            {member.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={cn(
                            "ring-background absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full ring-2",
                            style.chip,
                          )}
                        >
                          <RankIcon
                            className="size-3.5 text-white"
                            weight="fill"
                          />
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className={cn("text-xs font-bold", style.text)}>
                          {style.label}
                        </span>
                        <p className="mt-0.5 truncate text-sm font-semibold">
                          {member.name}
                        </p>
                        {member.discordUsername && (
                          <p className="text-muted-foreground truncate text-[11px]">
                            @{member.discordUsername}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="border-border/40 mt-3 grid grid-cols-2 gap-2 border-t pt-3">
                      <div>
                        <p className="text-muted-foreground/60 text-[10px] tracking-wider uppercase">
                          Views Hoje
                        </p>
                        <p
                          className={cn(
                            "text-lg font-bold tabular-nums",
                            style.text,
                          )}
                        >
                          {formatNumber(member.todayViews)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground/60 text-[10px] tracking-wider uppercase">
                          Posts Hoje
                        </p>
                        <p className="text-foreground text-lg font-bold tabular-nums">
                          {member.todayPosts}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Reveal>
      )}

      {/* ===== Breakdown de engajamento ===== */}
      <Reveal immediate delayMs={180}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile
            icon={<Heart className="size-4" weight="fill" />}
            label="Curtidas Totais"
            value={clan.stats.totalLikes}
            kind="compact"
            accent="gradient"
          />
          <StatTile
            icon={<ChatCircle className="size-4" weight="fill" />}
            label="Comentários Totais"
            value={clan.stats.totalComments}
            kind="compact"
            accent="cyan"
          />
          <StatTile
            icon={<ShareNetwork className="size-4" weight="fill" />}
            label="Compartilhamentos"
            value={clan.stats.totalShares}
            kind="compact"
            accent="green"
          />
        </div>
      </Reveal>

      {/* ===== Top Competições do Clã ===== */}
      {clan.topCampaigns.length > 0 && (
        <Reveal immediate delayMs={220}>
          <div className="glass-card relative overflow-hidden rounded-3xl p-4 sm:p-6">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_8%,transparent)] blur-3xl"
            />
            <div className="flex items-center gap-2.5">
              <span className="bg-gradient-custom flex size-9 items-center justify-center rounded-xl text-[#04222A]">
                <Megaphone className="size-4.5" weight="fill" />
              </span>
              <h2 className="text-lg font-bold">Top Competições do Clã</h2>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {clan.topCampaigns.map((campaign, idx) => (
                <div
                  key={campaign.id}
                  className="group border-border/60 bg-card relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 hover:border-[color-mix(in_oklab,var(--brand-cyan)_30%,transparent)] hover:shadow-lg"
                >
                  <span className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-cyan)_55%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_40%,transparent)] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                        idx === 0
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : idx === 1
                            ? "bg-slate-400/15 text-slate-500 dark:text-slate-300"
                            : "bg-muted/60 text-foreground/80",
                      )}
                    >
                      #{idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {campaign.name}
                      </p>
                      <div className="mt-1.5 flex items-center gap-3">
                        <span className="text-muted-foreground flex items-center gap-1 text-xs">
                          <Eye className="size-3" />
                          {formatNumber(campaign.totalViews)}
                        </span>
                        <span className="text-muted-foreground flex items-center gap-1 text-xs">
                          <VideoCamera className="size-3" />
                          {campaign.totalPosts} posts
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Barra proporcional de views */}
                  <div className="mt-3">
                    <div className="bg-muted/40 h-1.5 overflow-hidden rounded-full">
                      <div
                        className="bg-gradient-custom h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${
                            maxCampaignViews > 0
                              ? Math.max(
                                  5,
                                  (campaign.totalViews / maxCampaignViews) *
                                    100,
                                )
                              : 100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      )}

      {/* ===== Ranking do Clã ===== */}
      <Reveal immediate delayMs={260}>
        <div className="glass-card overflow-hidden rounded-3xl">
          <div className="flex items-center gap-2.5 p-4 sm:p-5">
            <span className="bg-gradient-custom flex size-9 items-center justify-center rounded-xl text-[#04222A]">
              <Trophy className="size-4.5" weight="fill" />
            </span>
            <h2 className="text-lg font-bold">Ranking do Clã</h2>
            <Badge
              variant="outline"
              className="text-muted-foreground border-border/60 ml-auto rounded-full text-[10px]"
            >
              {clan.memberCount} membros
            </Badge>
          </div>

          {rankedMembers.length === 0 ? (
            <div className="px-4 pb-5 sm:px-5">
              <EmptyState
                icon={<UsersThree className="size-6" weight="fill" />}
                title="Nenhum membro neste clã"
                subtitle="Assim que clipadores entrarem, o ranking aparece aqui"
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[60px] pl-5 text-xs font-semibold tracking-wider uppercase">
                      #
                    </TableHead>
                    <TableHead className="text-xs font-semibold tracking-wider uppercase">
                      Membro
                    </TableHead>
                    <TableHead className="text-xs font-semibold tracking-wider uppercase">
                      Views
                    </TableHead>
                    <TableHead className="hidden text-xs font-semibold tracking-wider uppercase sm:table-cell">
                      Posts
                    </TableHead>
                    <TableHead className="hidden text-xs font-semibold tracking-wider uppercase md:table-cell">
                      Engajamento
                    </TableHead>
                    <TableHead className="hidden text-xs font-semibold tracking-wider uppercase lg:table-cell">
                      Curtidas
                    </TableHead>
                    {clan.isOwner && (
                      <TableHead className="w-[80px] pr-5 text-right text-xs font-semibold tracking-wider uppercase">
                        Ações
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankedMembers.map((member, i) => (
                    <TableRow
                      key={member.id}
                      className={cn(
                        i % 2 === 0 ? "bg-transparent" : "bg-muted/30",
                      )}
                    >
                      <TableCell className="pl-5">
                        <PositionBadge position={i + 1} size="sm" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar
                              className={cn(
                                "size-9",
                                i === 0 && "ring-2 ring-amber-500/30",
                                i === 1 && "ring-2 ring-slate-400/30",
                                i === 2 && "ring-2 ring-orange-700/30",
                              )}
                            >
                              <AvatarImage src={member.imageUrl ?? undefined} />
                              <AvatarFallback className="text-xs">
                                {member.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            {i === 0 && (
                              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-amber-500">
                                <Crown
                                  className="size-2.5 text-white"
                                  weight="fill"
                                />
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="max-w-[160px] truncate text-sm font-medium">
                              {member.name}
                            </p>
                            {member.discordUsername && (
                              <p className="text-muted-foreground max-w-[160px] truncate text-xs">
                                @{member.discordUsername}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Eye className="text-muted-foreground/50 size-3.5" />
                          <span className="text-sm font-medium tabular-nums">
                            {formatNumber(member.totalViews)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-sm font-medium tabular-nums">
                          {member.totalPosts}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <EngagementBadge value={member.engagement} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-sm font-medium tabular-nums">
                          {formatNumber(member.totalLikes)}
                        </span>
                      </TableCell>
                      {clan.isOwner && (
                        <TableCell className="pr-5 text-right">
                          {member.id !== clan.owner?.id ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-muted-foreground/50 size-8 cursor-pointer rounded-lg transition-all hover:bg-red-500/10 hover:text-red-500"
                                  disabled={removeMemberMutation.isPending}
                                >
                                  {removeMemberMutation.isPending ? (
                                    <Spinner className="size-3.5 animate-spin" />
                                  ) : (
                                    <UserMinus className="size-3.5" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="max-w-md rounded-3xl">
                                <AlertDialogHeader>
                                  <span className="mx-auto mb-2 w-fit rounded-full bg-red-500/10 p-3">
                                    <UserMinus className="size-6 text-red-500" />
                                  </span>
                                  <AlertDialogTitle className="text-center text-lg">
                                    Remover membro do clã?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription className="space-y-3 text-center">
                                    <span className="block">
                                      Você está prestes a remover{" "}
                                      <span className="text-foreground font-semibold">
                                        {member.name}
                                      </span>{" "}
                                      do clã{" "}
                                      <span className="text-foreground font-semibold">
                                        {clan.name}
                                      </span>
                                      .
                                    </span>
                                    <span className="text-muted-foreground/70 block text-xs">
                                      O clipador poderá se inscrever novamente
                                      no futuro. Esta ação não pode ser
                                      desfeita.
                                    </span>
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0">
                                  <AlertDialogCancel className="cursor-pointer rounded-xl">
                                    Cancelar
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    className="cursor-pointer gap-2 rounded-xl bg-red-600 text-white hover:bg-red-500"
                                    onClick={() =>
                                      removeMemberMutation.mutate({
                                        clipperId: member.id,
                                        clanId: clan.id,
                                      })
                                    }
                                  >
                                    <UserMinus className="size-4" />
                                    Remover Membro
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : (
                            <Badge
                              variant="outline"
                              className="rounded-full border-violet-500/30 bg-violet-500/10 text-[10px] text-violet-500 dark:text-violet-400"
                            >
                              Dono
                            </Badge>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Reveal>

      {/* ===== Dono: Gerenciar Inscrições ===== */}
      {clan.isOwner && (
        <Reveal immediate delayMs={300}>
          <div className="glass-card relative overflow-hidden rounded-3xl">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-20 -right-20 size-48 rounded-full bg-orange-500/10 blur-3xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-16 -left-16 size-36 rounded-full bg-amber-500/10 blur-3xl"
            />

            <div className="p-4 sm:p-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <h2 className="flex items-center gap-2.5 text-lg font-bold">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-orange-500/15 text-orange-500 ring-1 ring-orange-500/20 dark:text-orange-400">
                    <ClipboardText className="size-4.5" weight="fill" />
                  </span>
                  Gerenciar Inscrições
                  {clan.pendingApplications > 0 && (
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-500/15 px-1.5 text-[11px] font-bold text-orange-500 ring-1 ring-orange-500/30 dark:text-orange-400">
                      {clan.pendingApplications}
                    </span>
                  )}
                </h2>

                {(pendingApps?.length ?? 0) > 0 && (
                  <div className="relative w-full sm:w-64">
                    <MagnifyingGlass className="text-muted-foreground/50 absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                    <Input
                      placeholder="Buscar por nome ou discord..."
                      value={appSearch}
                      onChange={(e) => setAppSearch(e.target.value)}
                      className="h-9 rounded-xl pl-9"
                    />
                  </div>
                )}
              </div>

              <p className="text-muted-foreground/70 mt-1 text-xs">
                Como dono do clã, você pode aprovar ou rejeitar inscrições de
                novos clipadores.
              </p>

              {/* Mini-stats */}
              {clan.pendingApplications > 0 && (
                <div className="border-border/60 bg-muted/30 mt-3 flex items-center gap-4 rounded-xl border p-3">
                  <div className="flex items-center gap-2">
                    <span className="size-2 animate-pulse rounded-full bg-orange-500" />
                    <span className="text-xs font-medium text-orange-500 dark:text-orange-400">
                      {clan.pendingApplications} pendente
                      {clan.pendingApplications > 1 ? "s" : ""}
                    </span>
                  </div>
                  <span className="bg-border/50 h-3 w-px" />
                  <span className="text-muted-foreground text-xs">
                    {clan.memberCount} membro{clan.memberCount > 1 ? "s" : ""}{" "}
                    no clã
                  </span>
                </div>
              )}
            </div>

            <div className="px-4 pb-5 sm:px-5">
              {appsLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12">
                  <div className="relative">
                    <span
                      className="absolute inset-0 animate-ping rounded-full bg-orange-500/20"
                      style={{ animationDuration: "1.5s" }}
                    />
                    <span className="relative block rounded-full bg-orange-500/10 p-3">
                      <Spinner className="size-6 animate-spin text-orange-500 dark:text-orange-400" />
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Carregando inscrições...
                  </p>
                </div>
              ) : filteredApps.length === 0 ? (
                <EmptyState
                  icon={
                    appSearch ? (
                      <MagnifyingGlass className="size-6" weight="bold" />
                    ) : (
                      <CheckCircle className="size-6" weight="fill" />
                    )
                  }
                  title={
                    appSearch
                      ? "Nenhuma inscrição encontrada"
                      : "Nenhuma inscrição pendente"
                  }
                  subtitle={
                    appSearch
                      ? "Tente buscar com outro nome"
                      : "Todas as inscrições foram processadas"
                  }
                />
              ) : (
                <div className="space-y-3">
                  {filteredApps.map((app) => (
                    <div
                      key={app.id}
                      className="group border-border/60 bg-card relative overflow-hidden rounded-2xl border transition-all duration-300 hover:border-orange-500/25 hover:shadow-lg hover:shadow-orange-500/5"
                    >
                      <span className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-orange-500/40 via-amber-500/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                      <div className="p-4 sm:p-5">
                        {/* Avatar + Info */}
                        <div className="flex items-start gap-3 sm:gap-4">
                          <div className="relative shrink-0">
                            <Avatar className="size-11 ring-2 ring-orange-500/20 transition-all group-hover:ring-orange-500/40 sm:size-12">
                              <AvatarImage
                                src={app.clipper.user?.imageUrl ?? undefined}
                              />
                              <AvatarFallback className="bg-orange-500/10 text-sm text-orange-500 dark:text-orange-400">
                                {(
                                  app.clipper.artisticName ??
                                  app.clipper.fullName
                                ).charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="ring-background absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-orange-500 ring-2">
                              <Clock
                                className="size-2.5 text-white"
                                weight="fill"
                              />
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold">
                                {app.clipper.artisticName ??
                                  app.clipper.fullName}
                              </p>
                              <Badge
                                variant="outline"
                                className="shrink-0 rounded-full border-orange-500/30 bg-orange-500/10 px-1.5 py-0 text-[10px] text-orange-600 dark:text-orange-400"
                              >
                                Pendente
                              </Badge>
                            </div>

                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                              {app.clipper.discordUsername && (
                                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                                  <span className="font-medium text-violet-500 dark:text-violet-400">
                                    @
                                  </span>
                                  {app.clipper.discordUsername}
                                </span>
                              )}
                              {app.clipper.user?.email && (
                                <span className="text-muted-foreground flex max-w-[220px] items-center gap-1 truncate text-xs">
                                  <Envelope className="text-muted-foreground/50 size-3 shrink-0" />
                                  {app.clipper.user.email}
                                </span>
                              )}
                              <span className="text-muted-foreground/50 flex items-center gap-1 text-xs">
                                <CalendarBlank className="size-3 shrink-0" />
                                {new Date(app.createdAt).toLocaleDateString(
                                  "pt-BR",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )}
                              </span>
                            </div>

                            {app.clipper.fullName !==
                              (app.clipper.artisticName ??
                                app.clipper.fullName) && (
                              <p className="text-muted-foreground/50 mt-1 text-[11px]">
                                Nome completo: {app.clipper.fullName}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Mensagem */}
                        {app.message ? (
                          <div className="relative mt-4">
                            <span className="absolute top-0 bottom-0 left-0 w-[3px] rounded-full bg-gradient-to-b from-orange-500/40 to-amber-500/20" />
                            <div className="border-border/40 bg-muted/30 ml-4 rounded-r-xl border border-l-0 px-4 py-3">
                              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase text-orange-600/80 dark:text-orange-400/70">
                                <ChatText className="size-3" />
                                Mensagem de Inscrição
                              </p>
                              <p className="text-foreground/80 text-sm leading-relaxed">
                                &ldquo;{app.message}&rdquo;
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="text-muted-foreground/40 mt-3 flex items-center gap-2">
                            <ChatText className="size-3.5" />
                            <p className="text-xs italic">
                              Nenhuma mensagem de inscrição enviada
                            </p>
                          </div>
                        )}

                        {/* Ações */}
                        <div className="border-border/40 mt-4 flex flex-col justify-between gap-3 border-t pt-3 sm:flex-row sm:items-center">
                          <p className="text-muted-foreground/40 hidden text-[10px] sm:block">
                            Inscreveu-se em{" "}
                            {new Date(app.createdAt).toLocaleDateString(
                              "pt-BR",
                              {
                                day: "2-digit",
                                month: "long",
                                year: "numeric",
                              },
                            )}
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="h-8 flex-1 cursor-pointer gap-1.5 rounded-xl bg-green-600 text-xs text-white shadow-sm hover:bg-green-500 sm:flex-none"
                              disabled={
                                approveMutation.isPending ||
                                rejectMutation.isPending
                              }
                              onClick={() =>
                                approveMutation.mutate({
                                  applicationId: app.id,
                                })
                              }
                            >
                              {approveMutation.isPending ? (
                                <Spinner className="size-3.5 animate-spin" />
                              ) : (
                                <UserCheck className="size-3.5" />
                              )}
                              Aprovar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 flex-1 cursor-pointer gap-1.5 rounded-xl border-red-500/30 text-xs text-red-500 hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400 sm:flex-none"
                              disabled={
                                approveMutation.isPending ||
                                rejectMutation.isPending
                              }
                              onClick={() =>
                                rejectMutation.mutate({ applicationId: app.id })
                              }
                            >
                              {rejectMutation.isPending ? (
                                <Spinner className="size-3.5 animate-spin" />
                              ) : (
                                <XCircle className="size-3.5" />
                              )}
                              Rejeitar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Reveal>
      )}
    </div>
  )
}

function EngagementBadge({ value }: { value: number }) {
  const color =
    value >= 5
      ? "bg-green-500/10 text-green-600 dark:text-green-400"
      : value >= 2
        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "bg-muted text-muted-foreground"
  const Icon = value >= 5 ? TrendUp : Pulse

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        color,
      )}
    >
      <Icon className="size-3" weight="bold" />
      {value}%
    </span>
  )
}

function LoadingSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-7 sm:px-6 sm:py-8">
      {/* Voltar */}
      <Bone className="h-9 w-44" />

      {/* Hero fantasma do clã */}
      <section className="dark relative overflow-hidden rounded-3xl bg-[#050f1c] p-5 ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_18%,transparent)] sm:p-7 lg:p-8">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 right-[6%] size-64 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_10%,transparent)] blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-28 left-[18%] size-72 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_8%,transparent)] blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-cyan)_60%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_40%,transparent)] to-transparent"
        />

        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-start">
          <Bone className="size-28 shrink-0 rounded-2xl sm:size-36" />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <Bone className="h-8 w-52 sm:h-9" />
              <Bone delay={80} className="h-6 w-16 rounded-full" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Bone delay={160} className="h-7 w-24 rounded-md" />
              <Bone delay={240} className="h-4 w-28 rounded-full" />
              <Bone delay={320} className="h-4 w-40 rounded-full" />
            </div>
            <Bone delay={400} className="h-4 w-full max-w-xl rounded-full" />
            <div className="flex items-center gap-2">
              <Bone delay={480} className="size-6 rounded-full" />
              <Bone delay={540} className="h-3.5 w-40 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <StatTilesGridSkeleton count={4} className="grid-cols-2 gap-4 lg:grid-cols-4" />

      {/* Pódio do dia */}
      <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
        <div className="flex items-center gap-2.5">
          <Bone className="size-9 rounded-xl" />
          <Bone delay={60} className="h-5 w-44" />
          <Bone delay={120} className="ml-auto h-5 w-14 rounded-full" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="border-border/60 bg-muted/20 rounded-2xl border p-4"
            >
              <div className="flex items-center gap-3">
                <Bone delay={index * 140} className="size-12 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Bone delay={index * 140 + 60} className="h-3 w-8 rounded-full" />
                  <Bone delay={index * 140 + 120} className="h-4 w-24" />
                  <Bone
                    delay={index * 140 + 180}
                    className="h-3 w-16 rounded-full"
                  />
                </div>
              </div>
              <div className="border-border/40 mt-3 grid grid-cols-2 gap-2 border-t pt-3">
                <div className="flex flex-col gap-1">
                  <Bone
                    delay={index * 140 + 240}
                    className="h-2.5 w-14 rounded-full"
                  />
                  <Bone delay={index * 140 + 300} className="h-5 w-12" />
                </div>
                <div className="flex flex-col gap-1">
                  <Bone
                    delay={index * 140 + 360}
                    className="h-2.5 w-14 rounded-full"
                  />
                  <Bone delay={index * 140 + 420} className="h-5 w-6" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Breakdown */}
      <StatTilesGridSkeleton
        count={3}
        className="grid-cols-1 gap-4 sm:grid-cols-3"
      />

      {/* Ranking */}
      <TableSkeleton rows={6} />
    </div>
  )
}
