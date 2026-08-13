"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowsDownUp,
  CalendarBlank,
  CaretDown,
  CaretUp,
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
  Pulse,
  ShareNetwork,
  Shield,
  Sparkle,
  Spinner,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
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

import { EmptyState } from "../../competitions/[slug]/shared"

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

type SortKey = "name" | "views" | "posts"
type SortDir = "asc" | "desc"
type StatusFilter = "all" | "approved" | "pending"

interface ClanDetailAdminProps {
  tag: string
}

export default function ClanDetailAdmin({ tag }: ClanDetailAdminProps) {
  const [search, setSearch] = React.useState("")
  const [sortKey, setSortKey] = React.useState<SortKey>("views")
  const [sortDir, setSortDir] = React.useState<SortDir>("desc")
  const [ownerDialogOpen, setOwnerDialogOpen] = React.useState(false)
  const [managerDialogRole, setManagerDialogRole] = React.useState<
    "owner" | "admin"
  >("owner")
  const [ownerSearch, setOwnerSearch] = React.useState("")
  const [settingOwnerId, setSettingOwnerId] = React.useState<string | null>(
    null,
  )
  const [settingAdminId, setSettingAdminId] = React.useState<string | null>(
    null,
  )
  const [applicationsOpen, setApplicationsOpen] = React.useState(false)
  const [memberStatusFilter, setMemberStatusFilter] =
    React.useState<StatusFilter>("all")
  const [appSearch, setAppSearch] = React.useState("")
  const [detailMemberId, setDetailMemberId] = React.useState<string | null>(
    null,
  )

  const utils = api.useUtils()

  const { data: clan, isLoading } = api.clan.getByTag.useQuery({ tag })

  const { data: clipperResults, isFetching: searchingClippers } =
    api.clan.searchClippers.useQuery(
      { search: ownerSearch },
      { enabled: ownerSearch.length >= 1 },
    )

  const { data: pendingApps, isLoading: appsLoading } =
    api.clan.listApplications.useQuery(
      { clanId: clan?.id ?? "", status: "PENDING" },
      { enabled: !!clan?.id },
    )

  const setOwnerMutation = api.clan.setOwner.useMutation({
    onSuccess: () => {
      toast.success("Dono do clã atualizado")
      setOwnerDialogOpen(false)
      setOwnerSearch("")
      setSettingOwnerId(null)
      void utils.clan.getByTag.invalidate({ tag })
    },
    onError: (err) => {
      toast.error(err.message)
      setSettingOwnerId(null)
    },
  })

  const setAdminMutation = api.clan.setAdmin.useMutation({
    onSuccess: () => {
      toast.success("Administrador do clã atualizado")
      setOwnerDialogOpen(false)
      setOwnerSearch("")
      setSettingAdminId(null)
      void utils.clan.getByTag.invalidate({ tag })
    },
    onError: (err) => {
      toast.error(err.message)
      setSettingAdminId(null)
    },
  })

  const approveMutation = api.clan.approveApplication.useMutation({
    onSuccess: () => {
      toast.success("Inscrição aprovada")
      void utils.clan.listApplications.invalidate()
      void utils.clan.getByTag.invalidate({ tag })
    },
    onError: (err) => toast.error(err.message),
  })

  const rejectMutation = api.clan.rejectApplication.useMutation({
    onSuccess: () => {
      toast.success("Inscrição rejeitada")
      void utils.clan.listApplications.invalidate()
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

  const unifiedMembers = React.useMemo(() => {
    if (!clan) return []
    const rows: Array<{
      id: string
      clipperId: string
      name: string
      fullName: string
      discordUsername: string | null
      imageUrl: string | null
      email: string | null
      totalViews: number
      totalPosts: number
      totalLikes: number
      status: "approved" | "pending"
      applicationMessage?: string | null
      applicationDate?: Date
      applicationId?: string
      isOwner: boolean
      isAdmin: boolean
    }> = []

    if (memberStatusFilter !== "pending") {
      for (const m of clan.members) {
        rows.push({
          id: m.id,
          clipperId: m.id,
          name: m.name,
          fullName: m.fullName,
          discordUsername: m.discordUsername,
          imageUrl: m.imageUrl,
          email: m.email,
          totalViews: m.totalViews,
          totalPosts: m.totalPosts,
          totalLikes: m.totalLikes,
          status: "approved",
          isOwner: !!clan.owner && m.id === clan.owner.id,
          isAdmin: !!clan.admin && m.id === clan.admin.id,
        })
      }
    }

    if (memberStatusFilter !== "approved" && pendingApps) {
      for (const app of pendingApps) {
        rows.push({
          id: `app-${app.id}`,
          clipperId: app.clipper.id,
          name: app.clipper.artisticName ?? app.clipper.fullName,
          fullName: app.clipper.fullName,
          discordUsername: app.clipper.discordUsername,
          imageUrl: app.clipper.user?.imageUrl ?? null,
          email: app.clipper.user?.email ?? null,
          totalViews: 0,
          totalPosts: 0,
          totalLikes: 0,
          status: "pending",
          applicationMessage: app.message,
          applicationDate: app.createdAt,
          applicationId: app.id,
          isOwner: false,
          isAdmin: false,
        })
      }
    }

    let filtered = rows
    if (search) {
      const q = search.toLowerCase()
      filtered = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.fullName.toLowerCase().includes(q) ||
          (r.email && r.email.toLowerCase().includes(q)) ||
          (r.discordUsername && r.discordUsername.toLowerCase().includes(q)),
      )
    }

    filtered.sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1
      switch (sortKey) {
        case "name":
          return mul * a.name.localeCompare(b.name)
        case "views":
          return mul * (a.totalViews - b.totalViews)
        case "posts":
          return mul * (a.totalPosts - b.totalPosts)
        default:
          return 0
      }
    })

    return filtered
  }, [clan, pendingApps, search, sortKey, sortDir, memberStatusFilter])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column)
      return <ArrowsDownUp className="ml-1 size-3 opacity-40" />
    return sortDir === "asc" ? (
      <CaretUp className="ml-1 size-3" weight="bold" />
    ) : (
      <CaretDown className="ml-1 size-3" weight="bold" />
    )
  }

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
              O clã que você está procurando não existe.
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            className="cursor-pointer rounded-xl"
          >
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
  const topMember =
    clan.members.length > 0
      ? clan.members.reduce(
          (top, m) => (m.totalViews > top.totalViews ? m : top),
          clan.members[0]!,
        )
      : null

  const pendingCount = pendingApps?.length ?? 0
  const approvedCount = clan.memberCount
  const totalCount = approvedCount + pendingCount
  const detailMember =
    unifiedMembers.find((m) => m.id === detailMemberId) ?? null
  const activeManager = managerDialogRole === "owner" ? clan.owner : clan.admin
  const activeManagerMutation =
    managerDialogRole === "owner" ? setOwnerMutation : setAdminMutation
  const activeSettingId =
    managerDialogRole === "owner" ? settingOwnerId : settingAdminId

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
              <div className="hero-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_75%_40%,#000_25%,transparent_75%)] opacity-35" />
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
                        index % 2 === 0 ? clan.emojiColor : "var(--brand-cyan)",
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
                        index % 2 === 0 ? clan.emojiColor : "var(--brand-cyan)",
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
                  {clan.isActive ? (
                    <span className="bg-gradient-custom inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-[#04222A]">
                      Ativo
                    </span>
                  ) : (
                    <Badge variant="secondary" className="rounded-full text-xs">
                      Inativo
                    </Badge>
                  )}
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
              </div>
            </div>
          </section>
        </Reveal>
      </DarkScope>

      {/* ===== Dono + Inscrições Pendentes ===== */}
      <Reveal immediate delayMs={60}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Dono do Clã */}
          <div className="glass-card glass-card-hover relative overflow-hidden rounded-2xl p-4 sm:p-5">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-10 -right-10 size-28 rounded-full bg-violet-500/10 blur-2xl"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-500 dark:text-violet-400">
                  <Crown className="size-4" weight="fill" />
                </span>
                <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
                  Dono do Clã
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 cursor-pointer rounded-lg px-2 text-xs text-violet-500 hover:bg-violet-500/10 hover:text-violet-400 dark:text-violet-400 dark:hover:text-violet-300"
                onClick={() => {
                  setManagerDialogRole("owner")
                  setOwnerDialogOpen(true)
                }}
              >
                {clan.owner ? "Alterar" : "Definir"}
              </Button>
            </div>
            {clan.owner ? (
              <div className="mt-3 flex items-center gap-3">
                <Avatar className="size-10 ring-2 ring-violet-500/30">
                  <AvatarImage src={clan.owner.imageUrl ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {clan.owner.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {clan.owner.name}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Responsável pelas aprovações
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground/60 mt-3 text-sm">
                Nenhum dono definido
              </p>
            )}
          </div>

          {/* Admin Secundário */}
          <div className="glass-card glass-card-hover relative overflow-hidden rounded-2xl p-4 sm:p-5">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-10 -right-10 size-28 rounded-full bg-cyan-500/10 blur-2xl"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-500 dark:text-cyan-400">
                  <UserCheck className="size-4" weight="fill" />
                </span>
                <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
                  Admin do Clã
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 cursor-pointer rounded-lg px-2 text-xs text-cyan-500 hover:bg-cyan-500/10 hover:text-cyan-400 dark:text-cyan-400 dark:hover:text-cyan-300"
                onClick={() => {
                  setManagerDialogRole("admin")
                  setOwnerDialogOpen(true)
                }}
              >
                {clan.admin ? "Alterar" : "Definir"}
              </Button>
            </div>
            {clan.admin ? (
              <div className="mt-3 flex items-center gap-3">
                <Avatar className="size-10 ring-2 ring-cyan-500/30">
                  <AvatarImage src={clan.admin.imageUrl ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {clan.admin.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {clan.admin.name}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Ajuda nas aprovações
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground/60 mt-3 text-sm">
                Nenhum admin secundário
              </p>
            )}
          </div>

          {/* Inscrições Pendentes */}
          <div className="glass-card glass-card-hover relative overflow-hidden rounded-2xl p-4 sm:p-5">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-10 -right-10 size-28 rounded-full bg-orange-500/10 blur-2xl"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-orange-500 dark:text-orange-400">
                  <ClipboardText className="size-4" weight="fill" />
                </span>
                <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
                  Inscrições Pendentes
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 cursor-pointer rounded-lg px-2 text-xs text-orange-500 hover:bg-orange-500/10 hover:text-orange-400 dark:text-orange-400 dark:hover:text-orange-300"
                onClick={() => setApplicationsOpen(true)}
              >
                Gerenciar
              </Button>
            </div>
            <p className="mt-2 text-2xl font-bold text-orange-500 sm:text-3xl dark:text-orange-400">
              {clan.pendingApplications}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              aguardando aprovação
            </p>
          </div>
        </div>
      </Reveal>

      {/* ===== KPIs ===== */}
      <Reveal immediate delayMs={120}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            icon={<Eye className="size-4" weight="fill" />}
            label="Views Totais"
            value={clan.stats.totalViews}
            kind="compact"
            hint={`${clan.stats.totalPosts} posts`}
            accent="gradient"
            gradientValue
          />
          <StatTile
            icon={<VideoCamera className="size-4" weight="fill" />}
            label="Posts Totais"
            value={clan.stats.totalPosts}
            kind="compact"
            hint={`${clan.stats.avgPostsPerMember} por membro`}
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
            label="Média Views/Membro"
            value={clan.stats.avgViewsPerMember}
            kind="compact"
            hint={`${clan.memberCount} membros`}
            accent="cyan"
          />
        </div>
      </Reveal>

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

      {/* ===== Membro Destaque ===== */}
      {topMember && (
        <Reveal immediate delayMs={220}>
          <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/15 to-orange-500/10 p-4 sm:p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Crown className="size-4" weight="fill" />
              </span>
              <span className="text-[11px] font-semibold tracking-[0.14em] text-amber-600 uppercase dark:text-amber-400">
                Membro Destaque
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Avatar className="size-10 ring-2 ring-amber-500/40">
                <AvatarImage src={topMember.imageUrl ?? undefined} />
                <AvatarFallback className="text-xs">
                  {topMember.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{topMember.name}</p>
                <p className="text-muted-foreground text-xs">
                  {formatNumber(topMember.totalViews)} views ·{" "}
                  {topMember.totalPosts} posts · {topMember.engagement}% eng.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      )}

      {/* ===== Tabela unificada: Membros & Inscrições ===== */}
      <Reveal immediate delayMs={260}>
        <div className="glass-card overflow-hidden rounded-3xl">
          <div className="flex flex-col gap-4 p-4 sm:p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <h2 className="flex items-center gap-2.5 text-lg font-bold">
                <span className="bg-gradient-custom flex size-9 items-center justify-center rounded-xl text-[#04222A]">
                  <UsersThree className="size-4.5" weight="fill" />
                </span>
                Membros & Inscrições
              </h2>
              <div className="relative w-full sm:w-64">
                <MagnifyingGlass className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 rounded-xl pl-9"
                />
              </div>
            </div>

            {/* Abas-pílula com contadores */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                {
                  key: "all" as StatusFilter,
                  label: "Todos",
                  count: totalCount,
                  activeClass:
                    "bg-foreground/10 text-foreground ring-1 ring-foreground/20",
                },
                {
                  key: "approved" as StatusFilter,
                  label: "Aprovados",
                  count: approvedCount,
                  activeClass:
                    "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30",
                },
                {
                  key: "pending" as StatusFilter,
                  label: "Pendentes",
                  count: pendingCount,
                  activeClass:
                    "bg-orange-500/15 text-orange-600 dark:text-orange-400 ring-1 ring-orange-500/30",
                },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setMemberStatusFilter(tab.key)}
                  className={cn(
                    "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                    memberStatusFilter === tab.key
                      ? tab.activeClass
                      : "text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold",
                      memberStatusFilter === tab.key
                        ? "bg-foreground/10"
                        : "bg-muted",
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {unifiedMembers.length === 0 ? (
            <div className="px-4 pb-5 sm:px-5">
              <EmptyState
                icon={<UsersThree className="size-6" weight="fill" />}
                title={
                  search
                    ? "Nenhum resultado encontrado"
                    : memberStatusFilter === "pending"
                      ? "Nenhuma inscrição pendente"
                      : memberStatusFilter === "approved"
                        ? "Nenhum membro aprovado"
                        : "Nenhum membro ou inscrição"
                }
                subtitle={
                  search
                    ? "Tente buscar com outro nome"
                    : "Assim que houver movimento, aparece aqui"
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[280px] pl-5">
                      <button
                        onClick={() => toggleSort("name")}
                        className="flex cursor-pointer items-center text-xs font-semibold tracking-wider uppercase"
                      >
                        Membro <SortIcon column="name" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => toggleSort("views")}
                        className="flex cursor-pointer items-center text-xs font-semibold tracking-wider uppercase"
                      >
                        Views <SortIcon column="views" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => toggleSort("posts")}
                        className="flex cursor-pointer items-center text-xs font-semibold tracking-wider uppercase"
                      >
                        Posts <SortIcon column="posts" />
                      </button>
                    </TableHead>
                    <TableHead className="hidden xl:table-cell">
                      <span className="text-xs font-semibold tracking-wider uppercase">
                        Contato
                      </span>
                    </TableHead>
                    <TableHead>
                      <span className="text-xs font-semibold tracking-wider uppercase">
                        Status
                      </span>
                    </TableHead>
                    <TableHead className="pr-5 text-right">
                      <span className="text-xs font-semibold tracking-wider uppercase">
                        Inscrição
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unifiedMembers.map((member, i) => (
                    <TableRow
                      key={member.id}
                      className={cn(
                        i % 2 === 0 ? "bg-transparent" : "bg-muted/30",
                        member.status === "pending" && "bg-orange-500/[0.04]",
                      )}
                    >
                      <TableCell className="pl-5">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar
                              className={cn(
                                "size-9",
                                member.status === "pending" &&
                                  "ring-2 ring-orange-500/30",
                              )}
                            >
                              <AvatarImage src={member.imageUrl ?? undefined} />
                              <AvatarFallback className="text-xs">
                                {member.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            {member.isOwner && (
                              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-violet-500">
                                <Crown
                                  className="size-2.5 text-white"
                                  weight="fill"
                                />
                              </span>
                            )}
                            {member.isAdmin && !member.isOwner && (
                              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-cyan-500">
                                <UserCheck
                                  className="size-2.5 text-white"
                                  weight="fill"
                                />
                              </span>
                            )}
                            {member.status === "pending" && (
                              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-orange-500">
                                <Clock
                                  className="size-2.5 text-white"
                                  weight="fill"
                                />
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="max-w-[160px] truncate text-sm font-medium">
                                {member.name}
                              </p>
                              {member.isOwner && (
                                <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-violet-500 dark:text-violet-400">
                                  DONO
                                </span>
                              )}
                              {member.isAdmin && !member.isOwner && (
                                <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-500 dark:text-cyan-400">
                                  ADMIN
                                </span>
                              )}
                            </div>
                            {member.discordUsername && (
                              <p className="text-muted-foreground max-w-[160px] truncate text-xs">
                                @{member.discordUsername}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {member.status === "approved" ? (
                          <div className="flex items-center gap-1.5">
                            <Eye className="text-muted-foreground/50 size-3.5" />
                            <span className="text-sm font-medium tabular-nums">
                              {formatNumber(member.totalViews)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/30 text-sm">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {member.status === "approved" ? (
                          <span className="text-sm font-medium tabular-nums">
                            {member.totalPosts}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30 text-sm">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {member.email && (
                          <span className="text-muted-foreground flex max-w-[180px] items-center gap-1 truncate text-xs">
                            <Envelope className="size-3 shrink-0" />
                            {member.email}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {member.status === "approved" ? (
                          <Badge
                            variant="outline"
                            className="gap-1 rounded-full border-emerald-500/30 bg-emerald-500/10 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
                          >
                            <CheckCircle className="size-3" weight="fill" />
                            Aprovado
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="gap-1 rounded-full border-orange-500/30 bg-orange-500/10 text-[10px] font-semibold text-orange-600 dark:text-orange-400"
                          >
                            <Clock className="size-3" weight="fill" />
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-foreground h-7 cursor-pointer gap-1.5 rounded-lg text-xs"
                          onClick={() => setDetailMemberId(member.id)}
                        >
                          <Eye className="size-3.5" />
                          <span className="hidden sm:inline">Ver Mais</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Reveal>

      {/* ===== Dialog: Definir Dono ===== */}
      <Dialog
        open={ownerDialogOpen}
        onOpenChange={(open) => {
          setOwnerDialogOpen(open)
          if (!open) {
            setOwnerSearch("")
            setSettingOwnerId(null)
            setSettingAdminId(null)
          }
        }}
      >
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-md">
          <DialogHeader className="border-border/60 shrink-0 border-b p-4 text-left sm:p-6">
            <DialogTitle className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-500 dark:text-violet-400">
                <Crown className="size-4.5" weight="fill" />
              </span>
              {managerDialogRole === "owner"
                ? "Definir Dono do Clã"
                : "Definir Admin do Clã"}
            </DialogTitle>
            <DialogDescription>
              {managerDialogRole === "owner"
                ? "O dono será o responsável principal por aprovar ou rejeitar inscrições neste clã."
                : "O admin secundário também poderá aprovar/rejeitar inscrições e remover membros."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
            {/* Dono atual */}
            {activeManager && (
              <div className="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-r from-violet-500/10 to-transparent p-3.5">
                <div className="flex items-center gap-3.5">
                  <div className="relative">
                    <Avatar className="size-11 ring-2 ring-violet-500/40">
                      <AvatarImage src={activeManager.imageUrl ?? undefined} />
                      <AvatarFallback className="bg-violet-500/10 text-sm text-violet-500 dark:text-violet-400">
                        {activeManager.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="ring-background absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-violet-500 ring-2">
                      <Crown className="size-2.5 text-white" weight="fill" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {activeManager.name}
                    </p>
                    <p className="text-[11px] font-medium text-violet-500 dark:text-violet-400">
                      {managerDialogRole === "owner"
                        ? "Dono atual do clã"
                        : "Admin atual do clã"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 cursor-pointer gap-1.5 rounded-lg px-3 text-xs text-red-500 hover:bg-red-500/10 hover:text-red-400"
                    disabled={
                      activeManagerMutation.isPending &&
                      activeSettingId === null
                    }
                    onClick={() => {
                      if (managerDialogRole === "owner") {
                        setSettingOwnerId(null)
                        setOwnerMutation.mutate({
                          clanId: clan.id,
                          clipperId: null,
                        })
                      } else {
                        setSettingAdminId(null)
                        setAdminMutation.mutate({
                          clanId: clan.id,
                          clipperId: null,
                        })
                      }
                    }}
                  >
                    {activeManagerMutation.isPending &&
                    activeSettingId === null ? (
                      <Spinner className="size-3 animate-spin" />
                    ) : (
                      <UserMinus className="size-3" />
                    )}
                    Remover
                  </Button>
                </div>
              </div>
            )}

            {/* Busca */}
            <div className="relative">
              <MagnifyingGlass className="text-muted-foreground/50 absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
              <Input
                placeholder="Buscar clipador por nome ou discord..."
                value={ownerSearch}
                onChange={(e) => setOwnerSearch(e.target.value)}
                className="h-11 rounded-xl pl-10"
              />
            </div>

            {/* Resultados */}
            {ownerSearch.length >= 1 && (
              <div className="border-border/60 bg-muted/10 max-h-72 overflow-y-auto rounded-2xl border">
                {searchingClippers ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-10">
                    <Spinner className="size-6 animate-spin text-violet-500 dark:text-violet-400" />
                    <p className="text-muted-foreground text-xs">
                      Buscando clipadores...
                    </p>
                  </div>
                ) : !clipperResults?.length ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-10">
                    <MagnifyingGlass className="text-muted-foreground/20 size-8" />
                    <p className="text-muted-foreground text-sm">
                      Nenhum clipador encontrado
                    </p>
                    <p className="text-muted-foreground/50 text-xs">
                      Tente buscar com outro nome
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5 p-1.5">
                    {clipperResults.map((clipper) => {
                      const isSettingThis =
                        activeManagerMutation.isPending &&
                        activeSettingId === clipper.id
                      const isInAnotherClan =
                        clipper.clanId && clipper.clanId !== clan.id
                      return (
                        <button
                          key={clipper.id}
                          className={cn(
                            "group flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-all",
                            isSettingThis
                              ? "border-violet-500/25 bg-violet-500/10"
                              : "hover:bg-muted/50 border-transparent",
                          )}
                          disabled={activeManagerMutation.isPending}
                          onClick={() => {
                            if (managerDialogRole === "owner") {
                              setSettingOwnerId(clipper.id)
                              setOwnerMutation.mutate({
                                clanId: clan.id,
                                clipperId: clipper.id,
                              })
                            } else {
                              setSettingAdminId(clipper.id)
                              setAdminMutation.mutate({
                                clanId: clan.id,
                                clipperId: clipper.id,
                              })
                            }
                          }}
                        >
                          <Avatar
                            className={cn(
                              "size-10 transition-all",
                              isSettingThis && "ring-2 ring-violet-500/40",
                            )}
                          >
                            <AvatarImage
                              src={clipper.user?.imageUrl ?? undefined}
                            />
                            <AvatarFallback className="text-xs">
                              {(
                                clipper.artisticName ?? clipper.fullName
                              ).charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {clipper.artisticName ?? clipper.fullName}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {clipper.discordUsername
                                ? `@${clipper.discordUsername}`
                                : clipper.fullName}
                            </p>
                            {isInAnotherClan && (
                              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400/80">
                                <Shield className="size-2.5" weight="fill" />
                                Já está em outro clã
                              </p>
                            )}
                          </div>
                          <div className="shrink-0">
                            {isSettingThis ? (
                              <div className="flex items-center gap-2">
                                <Spinner className="size-4 animate-spin text-violet-500 dark:text-violet-400" />
                                <span className="hidden text-[11px] font-medium text-violet-500 sm:inline dark:text-violet-400">
                                  Definindo...
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                                <span className="hidden text-[11px] font-medium text-violet-500 sm:inline dark:text-violet-400">
                                  Selecionar
                                </span>
                                <UserCheck className="size-4 text-violet-500 dark:text-violet-400" />
                              </div>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Vazio sem busca */}
            {ownerSearch.length === 0 && !activeManager && (
              <div className="flex flex-col items-center justify-center gap-2 py-8">
                <span className="rounded-full bg-violet-500/10 p-3">
                  <MagnifyingGlass className="size-6 text-violet-500/50" />
                </span>
                <p className="text-muted-foreground text-sm">
                  Busque um clipador para definir como{" "}
                  {managerDialogRole === "owner" ? "dono" : "admin"}
                </p>
                <p className="text-muted-foreground/50 text-xs">
                  Digite o nome, nome artístico ou discord
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Dialog: Gerenciar Inscrições ===== */}
      <Dialog
        open={applicationsOpen}
        onOpenChange={(open) => {
          setApplicationsOpen(open)
          if (!open) setAppSearch("")
        }}
      >
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-2xl">
          <div className="border-border/60 relative shrink-0 overflow-hidden border-b p-4 sm:p-6">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-orange-500/10 blur-3xl"
            />
            <DialogHeader className="text-left">
              <DialogTitle className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl bg-orange-500/15 text-orange-500 ring-1 ring-orange-500/20 dark:text-orange-400">
                  <ClipboardText className="size-4.5" weight="fill" />
                </span>
                <span className="flex items-center gap-2">
                  Gerenciar Inscrições
                  {pendingCount > 0 && (
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-500/15 px-1.5 text-[11px] font-bold text-orange-500 ring-1 ring-orange-500/30 dark:text-orange-400">
                      {pendingCount}
                    </span>
                  )}
                </span>
              </DialogTitle>
              <DialogDescription>
                Gerencie as inscrições de clipadores para o clã{" "}
                <span className="text-foreground font-semibold">
                  {clan.name}
                </span>
                . Aprove ou rejeite cada solicitação.
              </DialogDescription>
            </DialogHeader>

            {/* Mini-stats */}
            {pendingCount > 0 && (
              <div className="border-border/60 bg-muted/30 mt-4 flex items-center gap-4 rounded-xl border p-3">
                <div className="flex items-center gap-2">
                  <span className="size-2 animate-pulse rounded-full bg-orange-500" />
                  <span className="text-xs font-medium text-orange-500 dark:text-orange-400">
                    {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
                  </span>
                </div>
                <span className="bg-border/50 h-3 w-px" />
                <span className="text-muted-foreground text-xs">
                  {approvedCount} membro{approvedCount > 1 ? "s" : ""} aprovado
                  {approvedCount > 1 ? "s" : ""}
                </span>
              </div>
            )}

            {/* Busca */}
            <div className="relative mt-4">
              <MagnifyingGlass className="text-muted-foreground/50 absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
              <Input
                placeholder="Buscar por nome, discord ou email..."
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                className="h-10 rounded-xl pl-10"
              />
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1 overflow-y-auto">
            <div className="p-4 sm:p-6">
              {appsLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16">
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
                              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-orange-600/80 uppercase dark:text-orange-400/70">
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
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ===== Dialog: Detalhes da Inscrição ===== */}
      <Dialog
        open={!!detailMemberId}
        onOpenChange={(open) => {
          if (!open) setDetailMemberId(null)
        }}
      >
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-md">
          {detailMember && (
            <>
              <DialogHeader className="border-border/60 shrink-0 border-b p-4 text-left sm:p-6">
                <DialogTitle className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-xl ring-1",
                      detailMember.status === "approved"
                        ? "bg-emerald-500/15 text-emerald-500 ring-emerald-500/20 dark:text-emerald-400"
                        : "bg-orange-500/15 text-orange-500 ring-orange-500/20 dark:text-orange-400",
                    )}
                  >
                    <ClipboardText className="size-4.5" weight="fill" />
                  </span>
                  Detalhes da Inscrição
                </DialogTitle>
                <DialogDescription>
                  Informações completas sobre a inscrição no clã{" "}
                  <span className="text-foreground font-semibold">
                    {clan.name}
                  </span>
                  .
                </DialogDescription>
              </DialogHeader>

              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
                {/* Info do membro */}
                <div className="border-border/60 bg-muted/30 flex items-center gap-4 rounded-2xl border p-4">
                  <div className="relative shrink-0">
                    <Avatar
                      className={cn(
                        "size-14 ring-2",
                        detailMember.status === "approved"
                          ? "ring-emerald-500/30"
                          : "ring-orange-500/30",
                      )}
                    >
                      <AvatarImage src={detailMember.imageUrl ?? undefined} />
                      <AvatarFallback className="text-lg">
                        {detailMember.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    {detailMember.isOwner && (
                      <span className="ring-background absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-violet-500 ring-2">
                        <Crown className="size-3 text-white" weight="fill" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-semibold">
                        {detailMember.name}
                      </p>
                      {detailMember.isOwner && (
                        <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-violet-500 dark:text-violet-400">
                          DONO
                        </span>
                      )}
                    </div>
                    {detailMember.fullName !== detailMember.name && (
                      <p className="text-muted-foreground/60 text-xs">
                        {detailMember.fullName}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {detailMember.discordUsername && (
                        <span className="text-muted-foreground flex items-center gap-1 text-xs">
                          <span className="font-medium text-violet-500 dark:text-violet-400">
                            @
                          </span>
                          {detailMember.discordUsername}
                        </span>
                      )}
                      {detailMember.email && (
                        <span className="text-muted-foreground flex max-w-[200px] items-center gap-1 truncate text-xs">
                          <Envelope className="text-muted-foreground/50 size-3 shrink-0" />
                          {detailMember.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="border-border/60 flex items-center justify-between rounded-2xl border p-4">
                  <span className="text-muted-foreground text-sm font-medium">
                    Status da Inscrição
                  </span>
                  {detailMember.status === "approved" ? (
                    <Badge
                      variant="outline"
                      className="gap-1.5 rounded-full border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400"
                    >
                      <CheckCircle className="size-3.5" weight="fill" />
                      Aprovado
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="gap-1.5 rounded-full border-orange-500/30 bg-orange-500/10 text-xs text-orange-600 dark:text-orange-400"
                    >
                      <Clock className="size-3.5" weight="fill" />
                      Pendente
                    </Badge>
                  )}
                </div>

                {/* Pendente: mensagem + ações */}
                {detailMember.status === "pending" && (
                  <>
                    {detailMember.applicationMessage ? (
                      <div className="relative">
                        <span className="absolute top-0 bottom-0 left-0 w-[3px] rounded-full bg-gradient-to-b from-orange-500/40 to-amber-500/20" />
                        <div className="border-border/40 bg-muted/30 ml-4 rounded-r-xl border border-l-0 px-4 py-3">
                          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-orange-600/80 uppercase dark:text-orange-400/70">
                            <ChatText className="size-3" />
                            Mensagem de Inscrição
                          </p>
                          <p className="text-foreground/80 text-sm leading-relaxed">
                            &ldquo;{detailMember.applicationMessage}&rdquo;
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="border-border/40 bg-muted/20 text-muted-foreground/40 flex items-center gap-2.5 rounded-2xl border p-4">
                        <ChatText className="size-4 shrink-0" />
                        <p className="text-sm italic">
                          Nenhuma mensagem de inscrição enviada
                        </p>
                      </div>
                    )}

                    {detailMember.applicationDate && (
                      <div className="text-muted-foreground/50 flex items-center gap-2 px-1 text-xs">
                        <CalendarBlank className="size-3" />
                        Inscreveu-se em{" "}
                        {new Date(
                          detailMember.applicationDate,
                        ).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </div>
                    )}

                    {detailMember.applicationId && (
                      <div className="flex items-center gap-3 pt-2">
                        <Button
                          className="h-10 flex-1 cursor-pointer gap-2 rounded-xl bg-green-600 text-sm text-white shadow-sm hover:bg-green-500"
                          disabled={
                            approveMutation.isPending ||
                            rejectMutation.isPending
                          }
                          onClick={() => {
                            approveMutation.mutate({
                              applicationId: detailMember.applicationId!,
                            })
                            setDetailMemberId(null)
                          }}
                        >
                          {approveMutation.isPending ? (
                            <Spinner className="size-4 animate-spin" />
                          ) : (
                            <UserCheck className="size-4" />
                          )}
                          Aprovar Inscrição
                        </Button>
                        <Button
                          variant="outline"
                          className="h-10 flex-1 cursor-pointer gap-2 rounded-xl border-red-500/30 text-sm text-red-500 hover:bg-red-500/10 hover:text-red-400"
                          disabled={
                            approveMutation.isPending ||
                            rejectMutation.isPending
                          }
                          onClick={() => {
                            rejectMutation.mutate({
                              applicationId: detailMember.applicationId!,
                            })
                            setDetailMemberId(null)
                          }}
                        >
                          {rejectMutation.isPending ? (
                            <Spinner className="size-4 animate-spin" />
                          ) : (
                            <XCircle className="size-4" />
                          )}
                          Rejeitar
                        </Button>
                      </div>
                    )}
                  </>
                )}

                {/* Aprovado: resumo */}
                {detailMember.status === "approved" && (
                  <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <CheckCircle
                      className="mt-0.5 size-5 shrink-0 text-emerald-500 dark:text-emerald-400"
                      weight="fill"
                    />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400/90">
                        Membro aprovado
                      </p>
                      <p className="text-muted-foreground/60 text-xs">
                        Este clipador foi aprovado e faz parte do clã{" "}
                        {clan.name}.
                      </p>
                      <div className="mt-2 flex items-center gap-4 border-t border-emerald-500/10 pt-2">
                        <span className="text-muted-foreground text-xs">
                          <span className="text-foreground font-medium">
                            {formatNumber(detailMember.totalViews)}
                          </span>{" "}
                          views
                        </span>
                        <span className="text-muted-foreground text-xs">
                          <span className="text-foreground font-medium">
                            {detailMember.totalPosts}
                          </span>{" "}
                          posts
                        </span>
                        <span className="text-muted-foreground text-xs">
                          <span className="text-foreground font-medium">
                            {formatNumber(detailMember.totalLikes)}
                          </span>{" "}
                          curtidas
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
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
            <Bone delay={480} className="h-4 w-2/3 max-w-md rounded-full" />
          </div>
        </div>
      </section>

      {/* Dono + Inscrições */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Bone className="h-28 rounded-2xl" />
        <Bone delay={120} className="h-28 rounded-2xl" />
      </div>

      {/* KPIs */}
      <StatTilesGridSkeleton
        count={4}
        className="grid-cols-2 gap-4 lg:grid-cols-4"
      />

      {/* Breakdown */}
      <StatTilesGridSkeleton
        count={3}
        className="grid-cols-1 gap-4 sm:grid-cols-3"
      />

      {/* Membro destaque */}
      <Bone className="h-24 rounded-2xl" />

      {/* Tabela */}
      <TableSkeleton rows={6} />
    </div>
  )
}
