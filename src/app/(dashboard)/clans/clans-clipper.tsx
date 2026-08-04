"use client"

import * as React from "react"
import Link from "next/link"
import {
  ChatCircle,
  ChatCircleText,
  CircleNotch,
  Clock,
  Crown,
  Eye,
  Handshake,
  Heart,
  MagnifyingGlass,
  Question,
  Shield,
  ShareNetwork,
  SignOut,
  Sparkle,
  TrendUp,
  Trophy,
  UserPlus,
  Users,
  UsersThree,
  X,
  XCircle,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { ClanTagBadge, getClanIcon } from "@/components/clan-tag-badge"
import { ClansHeroViz, ClansHeroVizSkeleton } from "@/components/clans/clans-hero-viz"
import { HomeHero } from "@/components/home/home-hero"
import { formatCompact } from "@/components/shared/count-up"
import { Reveal } from "@/components/shared/reveal"
import {
  Bone,
  CardGridSkeleton,
  HeroSkeleton,
  ToolbarSkeleton,
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
} from "@/components/ui/alert-dialog"
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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

/* ============================================================
   Benefícios e passos do dialog "Como funcionam os Clãs?"
   ============================================================ */
const CLAN_BENEFITS = [
  {
    icon: Handshake,
    color: "#8b5cf6",
    title: "Rede de Apoio",
    desc: "Conecte-se com outros clipadores que compartilham seus objetivos. Troque dicas, estratégias e apoie-se mutuamente.",
  },
  {
    icon: TrendUp,
    color: "#06b6d4",
    title: "Crescimento Conjunto",
    desc: "Membros de clãs ativos crescem mais rápido. O engajamento coletivo potencializa os resultados de todos.",
  },
  {
    icon: Users,
    color: "#f59e0b",
    title: "Comunidade Exclusiva",
    desc: "Faça parte de um grupo seleto de clipadores comprometidos com qualidade e constância.",
  },
  {
    icon: Heart,
    color: "#ef4444",
    title: "Motivação Diária",
    desc: "Ter um clã te mantém motivado. A responsabilidade coletiva inspira todos a darem o seu melhor.",
  },
  {
    icon: Crown,
    color: "#eab308",
    title: "Reconhecimento",
    desc: "Seu clã aparece no seu perfil. Destaque-se como membro de uma comunidade ativa e engajada.",
  },
  {
    icon: Sparkle,
    color: "#a855f7",
    title: "Oportunidades Exclusivas",
    desc: "Clãs ativos podem receber destaque em competições e acesso a oportunidades especiais na plataforma.",
  },
] as const

const CLAN_STEPS = [
  { step: "1", text: "Escolha um clã que combine com você" },
  { step: "2", text: "Envie sua inscrição com uma mensagem de comprometimento" },
  { step: "3", text: "Aguarde a aprovação do dono do clã" },
  { step: "4", text: "Após aprovado, participe ativamente da comunidade!" },
] as const

/* ============================================================
   Estilos do pódio do Ranking de Clãs (1º violet, 2º slate,
   3º bronze) — fiéis ao original.
   ============================================================ */
const PODIUM_STYLES: Record<
  1 | 2 | 3,
  {
    card: string
    bg: string
    badge: string
    textColor: string
    ring: string
    size: string
    orbColor: string
    orbColor2: string
  }
> = {
  1: {
    card: "border-violet-500/60 shadow-[0_0_30px_rgba(139,92,246,0.25),0_0_60px_rgba(139,92,246,0.1)] hover:shadow-[0_0_40px_rgba(139,92,246,0.35),0_0_80px_rgba(139,92,246,0.15)]",
    bg: "from-violet-500/25 via-fuchsia-500/15 to-purple-500/10",
    badge:
      "bg-gradient-to-br from-yellow-400 to-amber-500 shadow-[0_0_16px_rgba(234,179,8,0.5)]",
    textColor: "text-violet-500 dark:text-violet-400",
    ring: "ring-violet-500/70 shadow-[0_0_16px_rgba(139,92,246,0.4)]",
    size: "size-14 sm:size-16",
    orbColor: "rgba(139,92,246,0.15)",
    orbColor2: "rgba(192,132,252,0.1)",
  },
  2: {
    card: "border-slate-400/50 shadow-[0_0_20px_rgba(148,163,184,0.15),0_0_40px_rgba(148,163,184,0.06)] hover:shadow-[0_0_30px_rgba(148,163,184,0.25),0_0_50px_rgba(148,163,184,0.1)]",
    bg: "from-slate-300/20 via-slate-400/10 to-slate-300/5",
    badge:
      "bg-gradient-to-br from-slate-300 to-slate-400 shadow-[0_0_12px_rgba(148,163,184,0.4)]",
    textColor: "text-slate-500 dark:text-slate-400",
    ring: "ring-slate-400/60 shadow-[0_0_10px_rgba(148,163,184,0.3)]",
    size: "size-11 sm:size-14",
    orbColor: "rgba(148,163,184,0.1)",
    orbColor2: "rgba(148,163,184,0.06)",
  },
  3: {
    card: "border-amber-700/50 shadow-[0_0_20px_rgba(180,83,9,0.15),0_0_40px_rgba(180,83,9,0.06)] hover:shadow-[0_0_30px_rgba(180,83,9,0.25),0_0_50px_rgba(180,83,9,0.1)]",
    bg: "from-amber-700/20 via-orange-800/10 to-amber-700/5",
    badge:
      "bg-gradient-to-br from-amber-600 to-orange-700 shadow-[0_0_12px_rgba(180,83,9,0.4)]",
    textColor: "text-amber-700",
    ring: "ring-amber-700/60 shadow-[0_0_10px_rgba(180,83,9,0.3)]",
    size: "size-11 sm:size-14",
    orbColor: "rgba(180,83,9,0.1)",
    orbColor2: "rgba(217,119,6,0.06)",
  },
}

/* ============================================================
   Skeletons do kit espelhando o layout real da página
   ============================================================ */
function MyClanBannerSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-r from-violet-500/5 via-card to-fuchsia-500/5 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Bone className="size-16 shrink-0 rounded-2xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Bone delay={80} className="h-3 w-24 rounded-full" />
          <Bone delay={140} className="h-5 w-44 max-w-full" />
          <Bone delay={200} className="h-6 w-36 max-w-full rounded-md" />
        </div>
        <Bone delay={260} className="h-9 w-32 rounded-xl" />
      </div>
      <div className="border-border/40 mt-4 flex flex-wrap gap-2 border-t pt-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <Bone
            key={index}
            delay={320 + index * 80}
            className="h-7 w-24 rounded-full"
          />
        ))}
      </div>
    </div>
  )
}

function RankingDialogSkeleton() {
  return (
    <div className="animate-in fade-in-50 duration-500">
      {/* Fantasma do pódio */}
      <div className="p-3 pb-4 sm:p-5 sm:pb-6">
        <div className="grid grid-cols-3 gap-2 pt-3 sm:gap-3">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className={cn(
                "border-border/40 bg-muted/20 flex flex-col items-center gap-2 rounded-2xl border p-2.5 sm:p-4",
                index === 1 && "-mt-2 border-violet-500/30 sm:-mt-4",
              )}
            >
              <Bone
                delay={index * 120}
                className="size-5 rounded-full sm:size-6"
              />
              <Bone
                delay={index * 120 + 60}
                className={cn(
                  "rounded-xl",
                  index === 1 ? "size-14 sm:size-16" : "size-11 sm:size-14",
                )}
              />
              <div className="flex w-full flex-col items-center gap-1.5">
                <Bone delay={index * 120 + 120} className="h-3 w-3/4" />
                <Bone
                  delay={index * 120 + 180}
                  className="h-2.5 w-1/2 rounded-full"
                />
              </div>
              <Bone delay={index * 120 + 240} className="h-5 w-12" />
            </div>
          ))}
        </div>
      </div>

      {/* Fantasma da lista */}
      <div className="border-border/40 space-y-2 border-t p-3 sm:p-5">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="border-border/30 bg-muted/20 flex items-center gap-2.5 rounded-xl border p-2.5 sm:gap-3 sm:p-3"
          >
            <Bone
              delay={index * 100}
              className="size-7 shrink-0 rounded-full sm:size-8"
            />
            <Bone
              delay={index * 100 + 60}
              className="size-10 shrink-0 rounded-xl sm:size-12"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Bone delay={index * 100 + 120} className="h-3.5 w-28 sm:w-36" />
              <Bone
                delay={index * 100 + 180}
                className="h-2.5 w-20 rounded-full sm:w-24"
              />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Bone delay={index * 100 + 240} className="h-4 w-14" />
              <Bone
                delay={index * 100 + 300}
                className="h-2.5 w-20 rounded-full"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ClansClipper() {
  const [search, setSearch] = React.useState("")
  const [joinClanId, setJoinClanId] = React.useState<string | null>(null)
  const [showLeaveDialog, setShowLeaveDialog] = React.useState(false)
  const [applicationMessage, setApplicationMessage] = React.useState("")
  const [showHowItWorks, setShowHowItWorks] = React.useState(false)
  const [isRankingDialogOpen, setIsRankingDialogOpen] = React.useState(false)

  // ===== Queries =====
  const { data: clans, isLoading } = api.clan.listPublic.useQuery({
    search: search || undefined,
  })
  const { data: rankingData, isLoading: isLoadingRanking } =
    api.clan.getClanRanking.useQuery(undefined, {
      enabled: isRankingDialogOpen,
    })
  const { data: myData, isLoading: myLoading } = api.clan.myClan.useQuery()
  const { data: myApplications } = api.clan.myApplications.useQuery()

  const utils = api.useUtils()

  // ===== Mutations =====
  const applyMutation = api.clan.applyClan.useMutation({
    onSuccess: () => {
      toast.success("Inscrição enviada com sucesso!")
      void utils.clan.myApplications.invalidate()
      void utils.clan.listPublic.invalidate()
      setJoinClanId(null)
      setApplicationMessage("")
    },
    onError: (err) => toast.error(err.message),
  })

  const cancelApplicationMutation = api.clan.cancelApplication.useMutation({
    onSuccess: () => {
      toast.success("Inscrição cancelada")
      void utils.clan.myApplications.invalidate()
      void utils.clan.listPublic.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  const leaveMutation = api.clan.leaveClan.useMutation({
    onSuccess: () => {
      toast.success("Você saiu do clã")
      void utils.clan.myClan.invalidate()
      void utils.clan.listPublic.invalidate()
      setShowLeaveDialog(false)
    },
    onError: (err) => toast.error(err.message),
  })

  // ===== Derivados =====
  const myClanId = myData?.clan?.id ?? null
  const joiningClan = clans?.find((clan) => clan.id === joinClanId)

  const getPendingApplication = (clanId: string) =>
    myApplications?.find(
      (application) =>
        application.clanId === clanId && application.status === "PENDING",
    )

  const totalMembers = (clans ?? []).reduce(
    (sum, clan) => sum + clan.memberCount,
    0,
  )
  const pendingApplicationsCount = (myApplications ?? []).filter(
    (application) => application.status === "PENDING",
  ).length

  // ===== Skeleton do kit espelhando o layout =====
  if (myLoading || (isLoading && !search)) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
        <HeroSkeleton stats={3} viz={<ClansHeroVizSkeleton />} />
        <MyClanBannerSkeleton />
        <ToolbarSkeleton buttons={2} />
        <CardGridSkeleton
          count={8}
          aspectClass="aspect-square"
          gridClass="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
          withStats={false}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero dos clãs ===== */}
      <HomeHero
        eyebrow="Clipfy League · Clãs"
        title={
          <>
            Encontre o seu <span className="text-gradient">clã</span>
          </>
        }
        subtitle="Junte-se a uma comunidade de clipadores, cresça em grupo e dispute o topo do ranking coletivo da liga."
        viz={<ClansHeroViz />}
        vizSkeleton={<ClansHeroVizSkeleton />}
        stats={[
          {
            icon: <Shield className="size-3.5" weight="fill" />,
            label: "Clãs disponíveis",
            value: clans?.length ?? 0,
            kind: "int",
          },
          {
            icon: <UsersThree className="size-3.5" weight="fill" />,
            label: "Membros",
            value: totalMembers,
            kind: "int",
          },
          {
            icon: <Clock className="size-3.5" weight="fill" />,
            label: "Pendentes",
            value: pendingApplicationsCount,
            kind: "int",
          },
        ]}
      />

      {/* ===== Banner "Seu Clã" ===== */}
      {myData?.clan && (
        <Reveal immediate>
          <section className="relative overflow-hidden rounded-3xl border border-violet-500/30 bg-gradient-to-r from-violet-500/10 via-card to-fuchsia-500/10">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-20 -right-16 size-56 rounded-full bg-violet-500/10 blur-3xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-16 -left-12 size-44 rounded-full bg-fuchsia-500/10 blur-3xl"
            />

            <div className="relative p-4 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                {myData.clan.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={myData.clan.imageUrl}
                    alt={myData.clan.name}
                    className="size-16 shrink-0 rounded-2xl border-2 border-violet-500/30 object-cover"
                  />
                ) : (
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl border-2 border-violet-500/20 bg-violet-500/10">
                    <Shield
                      className="size-8 text-violet-400/60"
                      weight="fill"
                    />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] text-amber-600 uppercase dark:text-amber-400">
                    <Crown className="size-3" weight="fill" />
                    Seu Clã
                  </span>
                  <h3 className="mt-1.5 truncate text-lg font-bold tracking-tight sm:text-xl">
                    {myData.clan.name}
                  </h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3">
                    <ClanTagBadge
                      tag={myData.clan.tag}
                      emoji={myData.clan.emoji}
                      emojiColor={myData.clan.emojiColor}
                      size="md"
                    />
                    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                      <Users className="size-3" weight="fill" />
                      {myData.clan.memberCount} membros
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLeaveDialog(true)}
                  className="h-9 shrink-0 cursor-pointer gap-2 rounded-xl border-red-500/30 font-semibold text-red-500 hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
                >
                  <SignOut className="size-4" weight="bold" />
                  Sair do Clã
                </Button>
              </div>

              {/* Chips dos membros (máx. 10) */}
              {myData.clan.members.length > 0 && (
                <div className="border-border/40 mt-4 border-t pt-4">
                  <p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-[0.14em] uppercase">
                    Membros
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {myData.clan.members.slice(0, 10).map((member) => (
                      <div
                        key={member.id}
                        className="border-border/40 bg-card/80 flex items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1"
                      >
                        <Avatar className="size-5">
                          <AvatarImage src={member.imageUrl ?? undefined} />
                          <AvatarFallback className="text-[8px]">
                            {member.name?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-muted-foreground max-w-[80px] truncate text-xs">
                          {member.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </Reveal>
      )}

      {/* ===== Toolbar: busca + como funciona + ranking ===== */}
      <Reveal immediate delayMs={60}>
        <div className="glass-card flex flex-col gap-3 rounded-3xl p-3.5 sm:p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar clãs por nome ou tag..."
              className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl pl-10"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Limpar busca"
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              onClick={() => setShowHowItWorks(true)}
              className="h-10 cursor-pointer rounded-xl font-semibold"
            >
              <Question className="size-4" weight="fill" />
              <span className="hidden sm:inline">Como funciona</span>
              <span className="sm:hidden">Info</span>
            </Button>

            <div className="relative">
              <Button
                onClick={() => setIsRankingDialogOpen(true)}
                className="btn-gradient-auth h-10 cursor-pointer rounded-xl px-4 font-semibold"
              >
                <Crown className="size-4" weight="fill" />
                <span className="hidden sm:inline">Ranking de Clãs</span>
                <span className="sm:hidden">Ranking</span>
              </Button>
              <span className="pointer-events-none absolute -top-2.5 -right-2 flex items-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-yellow-500 opacity-40" />
                <span className="relative rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 px-2 py-[3px] text-[9px] font-black tracking-widest text-black uppercase shadow-[0_0_14px_rgba(234,179,8,0.7),0_0_4px_rgba(234,179,8,0.9)]">
                  Novo
                </span>
              </span>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ===== Grid de clãs ===== */}
      {isLoading ? (
        <CardGridSkeleton
          count={8}
          aspectClass="aspect-square"
          gridClass="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
          withStats={false}
        />
      ) : !clans?.length ? (
        <Reveal immediate>
          <div className="glass-card flex flex-col items-center gap-4 rounded-3xl py-16 text-center">
            <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
              <Shield className="size-6" weight="fill" />
            </span>
            <div className="px-4">
              <p className="text-base font-bold">
                {search ? "Nenhum clã encontrado" : "Nenhum clã disponível"}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {search
                  ? "Tente buscar com outros termos"
                  : "Novos clãs serão adicionados em breve"}
              </p>
            </div>
          </div>
        </Reveal>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3 2xl:grid-cols-4">
          {clans.map((clan, index) => {
            const ClanIcon = getClanIcon(clan.emoji)
            const isMyCurrentClan = clan.id === myClanId
            const alreadyInAClan = !!myClanId
            const pendingApplication = getPendingApplication(clan.id)

            return (
              <Reveal immediate key={clan.id} delayMs={(index % 4) * 70}>
                <article
                  className={cn(
                    "glass-card glass-card-hover group relative flex h-full flex-col overflow-hidden rounded-3xl",
                    isMyCurrentClan && "ring-1 ring-violet-500/40",
                  )}
                >
                  {/* Glow suave na cor do clã (sem styled-jsx) */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-10 rounded-3xl opacity-70 transition-opacity duration-500 group-hover:opacity-100"
                    style={{
                      boxShadow: `inset 0 0 0 1px ${clan.emojiColor}2a, inset 0 0 34px ${clan.emojiColor}12, 0 0 22px ${clan.emojiColor}10`,
                    }}
                  />
                  {/* Barra de acento inferior */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-4 bottom-0 z-10 h-[2px] animate-pulse"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${clan.emojiColor}90, transparent)`,
                    }}
                  />

                  {/* Capa 1:1 */}
                  <div className="relative aspect-square w-full overflow-hidden">
                    {clan.imageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={clan.imageUrl}
                        alt={clan.name}
                        loading="eager"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{
                          background: `linear-gradient(135deg, ${clan.emojiColor}20, transparent 65%)`,
                        }}
                      >
                        <ClanIcon
                          className="h-20 w-20"
                          style={{ color: `${clan.emojiColor}30` }}
                        />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />

                    {/* Wash de cor no topo */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 top-0 h-28 animate-pulse"
                      style={{
                        background: `linear-gradient(180deg, ${clan.emojiColor}22, transparent)`,
                      }}
                    />
                    {/* Orbe de acento no canto */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -top-10 -right-10 size-36 rounded-full blur-2xl"
                      style={{ backgroundColor: clan.emojiColor, opacity: 0.12 }}
                    />

                    {isMyCurrentClan && (
                      <div className="absolute top-3 left-3">
                        <span className="flex h-6 items-center gap-1.5 rounded-full bg-violet-500/90 px-2.5 text-[11px] font-semibold text-white shadow-lg backdrop-blur-sm">
                          <Crown className="size-3" weight="fill" />
                          Seu Clã
                        </span>
                      </div>
                    )}

                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <h3 className="truncate text-xl font-bold tracking-tight text-white drop-shadow-lg">
                        {clan.name}
                      </h3>
                    </div>
                  </div>

                  {/* Corpo */}
                  <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
                    <div className="flex items-center gap-2">
                      <ClanTagBadge
                        tag={clan.tag}
                        emoji={clan.emoji}
                        emojiColor={clan.emojiColor}
                      />
                    </div>

                    {clan.description && (
                      <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
                        {clan.description}
                      </p>
                    )}

                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Users
                          className="text-muted-foreground/60 size-3.5"
                          weight="fill"
                        />
                        <span className="text-sm font-semibold tabular-nums">
                          {clan.memberCount}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          membros
                        </span>
                      </div>

                      {clan.topMembers.length > 0 && (
                        <div className="flex -space-x-2">
                          {clan.topMembers.slice(0, 4).map((member) => (
                            <Avatar
                              key={member.id}
                              className="border-card size-6 border-2"
                            >
                              <AvatarImage src={member.imageUrl ?? undefined} />
                              <AvatarFallback className="bg-muted text-[8px]">
                                {member.name?.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {clan.topMembers.length > 4 && (
                            <div className="border-card bg-muted flex size-6 items-center justify-center rounded-full border-2">
                              <span className="text-muted-foreground text-[8px]">
                                +{clan.topMembers.length - 4}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ação */}
                  <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                    {isMyCurrentClan ? (
                      <Button
                        asChild
                        className="btn-gradient-auth h-10 w-full cursor-pointer rounded-xl font-semibold"
                      >
                        <Link href={`/clans/${clan.tag}`}>
                          <Eye className="size-4" weight="fill" />
                          Ver Meu Clã
                        </Link>
                      </Button>
                    ) : pendingApplication ? (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          disabled
                          className="h-10 flex-1 cursor-default gap-2 rounded-xl border-amber-500/30 font-semibold text-amber-600 dark:text-amber-400"
                        >
                          <Clock className="size-4" weight="fill" />
                          Inscrição Pendente
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Cancelar inscrição"
                          disabled={cancelApplicationMutation.isPending}
                          onClick={() =>
                            cancelApplicationMutation.mutate({
                              clanId: clan.id,
                            })
                          }
                          className="size-10 shrink-0 cursor-pointer rounded-xl border-red-500/30 text-red-500 hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
                        >
                          {cancelApplicationMutation.isPending ? (
                            <CircleNotch className="size-4 animate-spin" />
                          ) : (
                            <XCircle className="size-4" weight="bold" />
                          )}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        disabled={alreadyInAClan}
                        onClick={() => setJoinClanId(clan.id)}
                        variant={alreadyInAClan ? "outline" : "default"}
                        className={cn(
                          "h-10 w-full rounded-xl font-semibold",
                          alreadyInAClan
                            ? "cursor-default"
                            : "btn-gradient-auth cursor-pointer",
                        )}
                      >
                        <UserPlus className="size-4" weight="fill" />
                        {alreadyInAClan
                          ? "Saia do clã atual primeiro"
                          : "Se Inscrever"}
                      </Button>
                    )}
                  </div>
                </article>
              </Reveal>
            )
          })}
        </div>
      )}

      {/* ===== Dialog: Inscrição no clã (split imagem/formulário) ===== */}
      <Dialog
        open={!!joinClanId}
        onOpenChange={(open) => {
          if (!open) {
            setJoinClanId(null)
            setApplicationMessage("")
          }
        }}
      >
        <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto rounded-3xl p-0 sm:max-w-3xl lg:overflow-hidden">
          <DialogTitle className="sr-only">Se Inscrever no Clã</DialogTitle>
          <DialogDescription className="sr-only">
            Confirmação para se inscrever em um clã
          </DialogDescription>

          {joiningClan &&
            (() => {
              const JoinIcon = getClanIcon(joiningClan.emoji)
              return (
                <div className="flex flex-col lg:max-h-[90vh] lg:flex-row">
                  {/* Esquerda — imagem + informações do clã */}
                  <div className="border-border/40 relative w-full shrink-0 border-b lg:w-[42%] lg:overflow-y-auto lg:border-r lg:border-b-0">
                    <div className="relative aspect-[4/3] w-full overflow-hidden lg:aspect-square">
                      {joiningClan.imageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={joiningClan.imageUrl}
                          alt={joiningClan.name}
                          loading="eager"
                          decoding="async"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="absolute inset-0 flex items-center justify-center"
                          style={{
                            background: `linear-gradient(135deg, ${joiningClan.emojiColor}25, ${joiningClan.emojiColor}08 60%)`,
                          }}
                        >
                          <JoinIcon
                            className="h-24 w-24"
                            style={{ color: `${joiningClan.emojiColor}30` }}
                          />
                        </div>
                      )}
                      <div className="from-background absolute inset-0 bg-gradient-to-t via-transparent to-transparent" />
                      <span
                        aria-hidden
                        className="pointer-events-none absolute -right-6 -bottom-6 size-28 rounded-full blur-3xl"
                        style={{
                          backgroundColor: joiningClan.emojiColor,
                          opacity: 0.15,
                        }}
                      />
                    </div>

                    <div className="relative z-10 -mt-10 space-y-3 p-4 sm:p-5">
                      <h2 className="truncate text-xl font-bold tracking-tight drop-shadow-sm sm:text-2xl">
                        {joiningClan.name}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <ClanTagBadge
                          tag={joiningClan.tag}
                          emoji={joiningClan.emoji}
                          emojiColor={joiningClan.emojiColor}
                          size="md"
                          className="shadow-sm"
                        />
                        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                          <Users className="size-3" weight="fill" />
                          {joiningClan.memberCount} membros
                        </span>
                      </div>

                      {joiningClan.description && (
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          {joiningClan.description}
                        </p>
                      )}

                      {joiningClan.topMembers.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <p className="text-muted-foreground/60 text-[10px] font-semibold tracking-[0.14em] uppercase">
                            Membros
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {joiningClan.topMembers.map((member) => (
                              <div
                                key={member.id}
                                className="border-border/40 bg-card/80 flex items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1"
                              >
                                <Avatar className="size-5">
                                  <AvatarImage
                                    src={member.imageUrl ?? undefined}
                                  />
                                  <AvatarFallback className="text-[8px]">
                                    {member.name?.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-muted-foreground max-w-[72px] truncate text-xs">
                                  {member.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Direita — formulário de inscrição */}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex-1 space-y-5 p-5 sm:p-6 lg:overflow-y-auto">
                      <div className="space-y-1">
                        <h3 className="flex items-center gap-2 text-base font-semibold">
                          <ChatCircleText
                            className="size-4"
                            weight="fill"
                            style={{ color: joiningClan.emojiColor }}
                          />
                          Inscrição
                        </h3>
                        <p className="text-muted-foreground text-xs">
                          Escreva uma mensagem sobre seu comprometimento com o
                          clã e sua participação ativa na comunidade.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="text-muted-foreground/70 text-[10px] font-semibold tracking-[0.14em] uppercase">
                            Mensagem
                          </p>
                          <span
                            className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                            style={{
                              backgroundColor: `${joiningClan.emojiColor}15`,
                              color: joiningClan.emojiColor,
                            }}
                          >
                            Obrigatório
                          </span>
                        </div>
                        <div className="relative">
                          <Textarea
                            value={applicationMessage}
                            onChange={(e) =>
                              setApplicationMessage(
                                e.target.value.slice(0, 300),
                              )
                            }
                            placeholder="Conte por que quer fazer parte deste clã e como pretende contribuir com a comunidade..."
                            className="bg-muted/30 border-border/40 placeholder:text-muted-foreground/40 max-h-[180px] min-h-[120px] resize-none rounded-xl text-sm leading-relaxed"
                            style={
                              {
                                "--tw-ring-color": `${joiningClan.emojiColor}40`,
                              } as React.CSSProperties
                            }
                          />
                          <span
                            className={cn(
                              "absolute right-3 bottom-2.5 text-[10px] tabular-nums transition-colors",
                              applicationMessage.length >= 280
                                ? "text-amber-500 dark:text-amber-400"
                                : "text-muted-foreground/40",
                            )}
                          >
                            {applicationMessage.length}/300
                          </span>
                        </div>
                      </div>

                      <div
                        className="flex items-start gap-3 rounded-xl border p-3"
                        style={{
                          borderColor: `${joiningClan.emojiColor}20`,
                          backgroundColor: `${joiningClan.emojiColor}06`,
                        }}
                      >
                        <Clock
                          className="mt-0.5 size-4 shrink-0"
                          weight="fill"
                          style={{ color: joiningClan.emojiColor }}
                        />
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          Sua inscrição ficará pendente até ser aprovada pelo
                          dono do clã. Após aprovação, o clã será exibido no seu
                          perfil.
                        </p>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="border-border/60 flex shrink-0 flex-col-reverse gap-2.5 border-t px-5 py-4 sm:flex-row sm:px-6">
                      <Button
                        variant="outline"
                        disabled={applyMutation.isPending}
                        onClick={() => setJoinClanId(null)}
                        className="h-11 flex-1 cursor-pointer rounded-xl font-semibold"
                      >
                        Cancelar
                      </Button>
                      <Button
                        disabled={
                          applyMutation.isPending ||
                          applicationMessage.trim().length < 10
                        }
                        onClick={() =>
                          joinClanId &&
                          applyMutation.mutate({
                            clanId: joinClanId,
                            message: applicationMessage.trim(),
                          })
                        }
                        className="btn-gradient-auth h-11 flex-1 cursor-pointer rounded-xl font-semibold"
                      >
                        {applyMutation.isPending ? (
                          <>
                            <CircleNotch className="size-4 animate-spin" />
                            Enviando inscrição...
                          </>
                        ) : (
                          <>
                            <UserPlus className="size-4" weight="fill" />
                            Se Inscrever no Clã
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })()}
        </DialogContent>
      </Dialog>

      {/* ===== AlertDialog: sair do clã ===== */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Sair do clã {myData?.clan?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você deixará de fazer parte deste clã. Você poderá entrar
              novamente ou em outro clã depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={leaveMutation.isPending}
              className="cursor-pointer rounded-xl"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => leaveMutation.mutate()}
              disabled={leaveMutation.isPending}
              className="cursor-pointer rounded-xl bg-red-600 text-white hover:bg-red-700"
            >
              {leaveMutation.isPending ? "Saindo..." : "Sair do Clã"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== Dialog: Como funcionam os Clãs? ===== */}
      <Dialog open={showHowItWorks} onOpenChange={setShowHowItWorks}>
        <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto rounded-3xl p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">
            Como funcionam os Clãs?
          </DialogTitle>
          <DialogDescription className="sr-only">
            Benefícios e funcionamento dos clãs
          </DialogDescription>

          {/* Hero */}
          <div className="border-border/60 relative overflow-hidden border-b px-6 pt-8 pb-6">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_14%,transparent)] blur-3xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-12 -left-12 size-36 rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_10%,transparent)] blur-3xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-cyan)_60%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_40%,transparent)] to-transparent"
            />

            <div className="relative space-y-3">
              <span className="bg-gradient-custom flex size-12 items-center justify-center rounded-2xl text-[#04222A]">
                <Shield className="size-6" weight="fill" />
              </span>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                Como funcionam os Clãs?
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Clãs são comunidades dentro da Clipfy onde clipadores se unem
                para crescer juntos, trocar experiências e alcançar melhores
                resultados.
              </p>
            </div>
          </div>

          {/* Benefícios */}
          <div className="space-y-3 px-6 py-5">
            <p className="text-muted-foreground/60 text-[10px] font-semibold tracking-[0.14em] uppercase">
              Benefícios
            </p>
            {CLAN_BENEFITS.map((benefit) => (
              <div
                key={benefit.title}
                className="border-border/40 bg-card/40 hover:bg-card/70 hover:border-border/60 flex items-start gap-3.5 rounded-2xl border p-3.5 transition-all duration-200 hover:shadow-sm"
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${benefit.color}15` }}
                >
                  <benefit.icon
                    className="size-4.5"
                    weight="fill"
                    style={{ color: benefit.color }}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold">{benefit.title}</h4>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                    {benefit.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Como participar */}
          <div className="space-y-3 px-6 pb-6">
            <p className="text-muted-foreground/60 text-[10px] font-semibold tracking-[0.14em] uppercase">
              Como participar
            </p>
            <div className="space-y-2">
              {CLAN_STEPS.map((item) => (
                <div
                  key={item.step}
                  className="border-border/40 bg-muted/30 flex items-center gap-3 rounded-2xl border p-3"
                >
                  <span className="bg-brand-cyan/15 text-brand-cyan not-dark:bg-primary/10 not-dark:text-primary flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold">
                    {item.step}
                  </span>
                  <p className="text-muted-foreground text-sm">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6">
            <Button
              onClick={() => setShowHowItWorks(false)}
              className="btn-gradient-auth h-11 w-full cursor-pointer rounded-xl font-semibold"
            >
              Entendi!
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Dialog: Ranking de Clãs (lazy) ===== */}
      <Dialog open={isRankingDialogOpen} onOpenChange={setIsRankingDialogOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-2xl">
          {/* Header */}
          <DialogHeader className="border-border/60 relative shrink-0 overflow-hidden border-b p-4 text-left sm:p-6">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_14%,transparent)] blur-3xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-14 -left-10 size-36 rounded-full bg-violet-500/10 blur-3xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-cyan)_60%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_40%,transparent)] to-transparent"
            />
            <div className="relative flex items-center gap-3">
              <span className="bg-gradient-custom flex size-9 shrink-0 items-center justify-center rounded-xl text-[#04222A] sm:size-10">
                <Trophy className="size-4.5 sm:size-5" weight="fill" />
              </span>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg font-bold sm:text-xl">
                  Ranking de Clãs
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-xs sm:text-sm">
                  Os melhores clãs por total de views
                </DialogDescription>
              </div>
              <Badge
                variant="outline"
                className="mr-6 shrink-0 gap-1 rounded-full border-violet-500/30 bg-violet-500/15 text-[10px] font-bold text-violet-600 sm:text-xs dark:text-violet-400"
              >
                <Shield className="size-3" weight="fill" />
                Geral
              </Badge>
            </div>
          </DialogHeader>

          {/* Conteúdo */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoadingRanking ? (
              <RankingDialogSkeleton />
            ) : rankingData?.clans && rankingData.clans.length > 0 ? (
              <div className="divide-border/40 divide-y">
                {/* Pódio top 3 — ordem visual [2º, 1º, 3º] */}
                <div className="relative overflow-hidden p-3 pb-4 sm:p-5 sm:pb-6">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-gradient-to-b from-violet-500/[0.03] via-transparent to-transparent"
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute top-0 left-1/2 size-40 -translate-x-1/2 rounded-full bg-violet-500/5 blur-3xl"
                  />

                  <div
                    className={cn(
                      "grid gap-2 pt-3 sm:gap-3",
                      rankingData.clans.length >= 3
                        ? "grid-cols-3"
                        : rankingData.clans.length === 2
                          ? "mx-auto max-w-md grid-cols-2"
                          : "mx-auto max-w-xs grid-cols-1",
                    )}
                  >
                    {(rankingData.clans.length >= 3
                      ? [1, 0, 2]
                      : rankingData.clans.length === 2
                        ? [0, 1]
                        : [0]
                    ).map((idx) => {
                      const clan = rankingData.clans[idx]
                      if (!clan) return <div key={idx} />
                      const position = (idx + 1) as 1 | 2 | 3
                      const ClanIcon = getClanIcon(clan.emoji)
                      const podium = PODIUM_STYLES[position]

                      return (
                        <div
                          key={clan.id}
                          className={cn(
                            "relative flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 transition-all duration-500 sm:gap-2 sm:p-4",
                            `bg-gradient-to-br ${podium.bg} ${podium.card}`,
                            position === 1 &&
                              rankingData.clans.length >= 3 &&
                              "-mt-2 sm:-mt-4",
                          )}
                        >
                          {/* Orbes de brilho */}
                          <span
                            aria-hidden
                            className="pointer-events-none absolute -top-6 -right-6 size-24 animate-pulse rounded-full blur-2xl"
                            style={{ backgroundColor: podium.orbColor }}
                          />
                          <span
                            aria-hidden
                            className="pointer-events-none absolute -bottom-4 -left-4 size-20 animate-pulse rounded-full blur-2xl"
                            style={{
                              backgroundColor: podium.orbColor2,
                              animationDelay: "1s",
                            }}
                          />
                          {position === 1 && (
                            <span
                              aria-hidden
                              className="pointer-events-none absolute inset-0 animate-pulse rounded-2xl bg-gradient-to-br from-violet-500/10 via-transparent to-fuchsia-500/10"
                            />
                          )}

                          {/* Selo da posição */}
                          <div
                            className={cn(
                              "absolute -top-2.5 left-1/2 z-10 flex size-5 -translate-x-1/2 items-center justify-center rounded-full text-[10px] font-black text-black sm:-top-3 sm:size-6 sm:text-xs",
                              podium.badge,
                            )}
                          >
                            {position}
                          </div>

                          {/* Avatar do clã */}
                          <div
                            className={cn(
                              "ring-offset-background relative mt-1.5 flex items-center justify-center overflow-hidden rounded-xl ring-2 ring-offset-2 transition-transform duration-300 hover:scale-110",
                              podium.size,
                              podium.ring,
                            )}
                            style={{
                              backgroundColor: `${clan.emojiColor}15`,
                            }}
                          >
                            {clan.imageUrl ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={clan.imageUrl}
                                alt={clan.name}
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                            ) : (
                              <ClanIcon
                                className="size-6 sm:size-8"
                                style={{ color: clan.emojiColor }}
                              />
                            )}
                          </div>

                          {/* Info */}
                          <div className="relative w-full min-w-0 text-center">
                            <p className="truncate text-[10px] font-bold sm:text-xs">
                              {clan.name}
                            </p>
                            <div className="mt-1 flex justify-center">
                              <ClanTagBadge
                                tag={clan.tag}
                                emoji={clan.emoji}
                                emojiColor={clan.emojiColor}
                                size="xs"
                              />
                            </div>
                            <p className="text-muted-foreground mt-1 flex items-center justify-center gap-1 text-[8px] sm:text-[10px]">
                              <Users className="size-2.5" weight="fill" />
                              {clan.memberCount}
                            </p>
                          </div>

                          {/* Views */}
                          <div className="relative text-center">
                            <p
                              className={cn(
                                "text-sm font-black tabular-nums sm:text-lg",
                                podium.textColor,
                              )}
                            >
                              {formatCompact(clan.totalViews)}
                            </p>
                            <p className="text-muted-foreground text-[8px] font-medium sm:text-[10px]">
                              views
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Do 4º em diante */}
                {rankingData.clans.slice(3).length > 0 && (
                  <div className="space-y-1.5 p-3 sm:space-y-2 sm:p-5">
                    {rankingData.clans.slice(3).map((clan, i) => {
                      const position = i + 4
                      const ClanIcon = getClanIcon(clan.emoji)
                      return (
                        <div
                          key={clan.id}
                          className="border-border/40 bg-card/30 hover:bg-card/60 hover:border-border/60 flex items-center gap-2.5 rounded-xl border p-2.5 transition-all sm:gap-3 sm:p-3"
                        >
                          <div className="bg-muted/50 text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums sm:size-8 sm:text-xs">
                            {position}
                          </div>

                          <div
                            className="border-border/40 flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border sm:size-12"
                            style={{
                              backgroundColor: `${clan.emojiColor}10`,
                            }}
                          >
                            {clan.imageUrl ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={clan.imageUrl}
                                alt={clan.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <ClanIcon
                                className="size-5 sm:size-6"
                                style={{ color: clan.emojiColor }}
                              />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold sm:text-sm">
                              {clan.name}
                            </p>
                            <div className="mt-0.5 flex items-center gap-2">
                              <ClanTagBadge
                                tag={clan.tag}
                                emoji={clan.emoji}
                                emojiColor={clan.emojiColor}
                                size="xs"
                              />
                              <span className="text-muted-foreground flex items-center gap-0.5 text-[9px] sm:text-[10px]">
                                <Users className="size-2.5" weight="fill" />
                                {clan.memberCount}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="text-brand-cyan not-dark:text-primary text-xs font-bold tabular-nums sm:text-sm">
                              {formatCompact(clan.totalViews)}
                            </p>
                            <div className="mt-0.5 flex items-center justify-end gap-2">
                              <span className="flex items-center gap-0.5">
                                <Heart
                                  className="size-2.5 text-pink-500/60"
                                  weight="fill"
                                />
                                <span className="text-muted-foreground text-[9px] tabular-nums sm:text-[10px]">
                                  {formatCompact(clan.totalLikes)}
                                </span>
                              </span>
                              <span className="flex items-center gap-0.5">
                                <ChatCircle
                                  className="size-2.5 text-blue-500/60"
                                  weight="fill"
                                />
                                <span className="text-muted-foreground text-[9px] tabular-nums sm:text-[10px]">
                                  {formatCompact(clan.totalComments)}
                                </span>
                              </span>
                              <span className="flex items-center gap-0.5">
                                <ShareNetwork
                                  className="size-2.5 text-emerald-500/60"
                                  weight="fill"
                                />
                                <span className="text-muted-foreground text-[9px] tabular-nums sm:text-[10px]">
                                  {formatCompact(clan.totalShares)}
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Destaques dos Clãs */}
                {rankingData.clans.length <= 5 &&
                  rankingData.clans.some(
                    (clan) => clan.topMembers.length > 0,
                  ) && (
                    <div className="space-y-3 p-3 sm:p-5">
                      <p className="text-muted-foreground/60 text-[10px] font-semibold tracking-[0.14em] uppercase">
                        Destaques dos Clãs
                      </p>
                      <div className="space-y-2">
                        {rankingData.clans
                          .filter((clan) => clan.topMembers.length > 0)
                          .map((clan) => (
                            <div key={clan.id} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <ClanTagBadge
                                  tag={clan.tag}
                                  emoji={clan.emoji}
                                  emojiColor={clan.emojiColor}
                                  size="xs"
                                />
                                <span className="text-muted-foreground text-[10px] font-medium">
                                  {clan.name}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {clan.topMembers
                                  .slice(0, 3)
                                  .map((member, memberIndex) => (
                                    <div
                                      key={member.id}
                                      className="border-border/40 bg-card/60 flex items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1"
                                    >
                                      <Avatar className="size-5">
                                        <AvatarImage
                                          src={member.imageUrl ?? undefined}
                                        />
                                        <AvatarFallback className="bg-muted text-[8px]">
                                          {member.name?.charAt(0)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="text-muted-foreground max-w-[64px] truncate text-[10px]">
                                        {member.name}
                                      </span>
                                      {memberIndex === 0 && (
                                        <Crown
                                          className="size-2.5 shrink-0 text-yellow-500"
                                          weight="fill"
                                        />
                                      )}
                                    </div>
                                  ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                <div className="mb-4 rounded-2xl bg-violet-500/10 p-4">
                  <Shield className="size-8 text-violet-500/50" weight="fill" />
                </div>
                <p className="text-muted-foreground text-sm font-semibold">
                  Nenhum clã encontrado
                </p>
                <p className="text-muted-foreground/70 mt-1 text-xs">
                  Os dados aparecerão quando houver clãs ativos na plataforma
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
