"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  BookOpen,
  CaretRight,
  ChartBar,
  CheckCircle,
  Clock,
  Eye,
  EyeSlash,
  GraduationCap,
  Heart,
  Play,
  Plus,
  SquaresFour,
  VideoCamera,
  Warning,
} from "@phosphor-icons/react"

import { AcademyHeroViz, AcademyHeroVizSkeleton } from "@/components/academy/academy-hero-viz"
import { HomeHero } from "@/components/home/home-hero"
import { SectionHeading } from "@/components/home/section-heading"
import { StatTile } from "@/components/home/stat-tile"
import { CountUp } from "@/components/shared/count-up"
import { Reveal } from "@/components/shared/reveal"
import {
  Bone,
  HeroSkeleton,
  StatTilesGridSkeleton,
} from "@/components/shared/skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

import { CreateModuleDialog } from "./create-module-dialog"

/** Formata duração em segundos como "Xh Ymin" / "Ymin". */
const formatDuration = (seconds: number) => {
  if (!seconds) return "0min"
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}h ${minutes}min`
  }
  return `${minutes}min`
}

export default function Academy() {
  const [isCreateModuleOpen, setIsCreateModuleOpen] = React.useState(false)
  const utils = api.useUtils()
  const { data, isLoading, error } = api.academy.getOverview.useQuery()

  if (isLoading) {
    return <AcademySkeleton />
  }

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-1 items-center justify-center px-4 py-6 sm:px-6 sm:py-8">
        <Reveal immediate>
          <div className="glass-card flex max-w-md flex-col items-center gap-4 rounded-3xl p-8 text-center">
            <span className="flex size-13 items-center justify-center rounded-2xl bg-red-500/15 text-red-500">
              <Warning className="size-6" weight="fill" />
            </span>
            <div>
              <p className="text-base font-bold">Erro ao carregar</p>
              <p className="text-muted-foreground mt-1 text-sm">
                {error.message}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    )
  }

  const stats = data?.stats
  const modules = data?.modules ?? []
  const recentLessons = data?.recentLessons ?? []

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero da academia ===== */}
      <HomeHero
        eyebrow="Clipfy League · Academia"
        title={
          <>
            A <span className="text-gradient">academia</span> clipadora
          </>
        }
        subtitle="Gerencie módulos e aulas para os clipadores assinantes — organize trilhas, publique conteúdos e acompanhe o engajamento."
        isLoading={isLoading}
        viz={<AcademyHeroViz />}
        vizSkeleton={<AcademyHeroVizSkeleton />}
        stats={[
          {
            icon: <SquaresFour className="size-3.5" weight="fill" />,
            label: "Módulos",
            value: stats?.totalModules ?? 0,
            kind: "int",
          },
          {
            icon: <Play className="size-3.5" weight="fill" />,
            label: "Aulas",
            value: stats?.totalLessons ?? 0,
            kind: "int",
          },
          {
            icon: <CheckCircle className="size-3.5" weight="fill" />,
            label: "Conclusões",
            value: stats?.totalCompletedLessons ?? 0,
            kind: "compact",
          },
        ]}
      />

      {/* ===== KPIs ===== */}
      <Reveal immediate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<SquaresFour className="size-4" weight="fill" />}
            label="Módulos"
            value={stats?.totalModules ?? 0}
            kind="int"
            hint={`${stats?.publishedModules ?? 0} publicados · ${stats?.draftModules ?? 0} rascunhos`}
            accent="cyan"
            isLoading={isLoading}
          />
          <StatTile
            icon={<Play className="size-4" weight="fill" />}
            label="Aulas"
            value={stats?.totalLessons ?? 0}
            kind="int"
            hint={`${stats?.publishedLessons ?? 0} publicadas · ${stats?.draftLessons ?? 0} rascunhos`}
            accent="green"
            isLoading={isLoading}
          />
          {/* Duração total (valor formatado, tile custom) */}
          <div className="glass-card glass-card-hover flex flex-col gap-3 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
                Duração Total
              </span>
              <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
                <Clock className="size-4" weight="fill" />
              </span>
            </div>
            <span className="text-2xl font-bold tracking-tight tabular-nums sm:text-[1.7rem]">
              {formatDuration(stats?.totalDurationSeconds ?? 0)}
            </span>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                de conteúdo disponível
              </span>
            </div>
          </div>
          {/* Engajamento (conclusões + curtidas, tile custom) */}
          <div className="glass-card glass-card-hover flex flex-col gap-3 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
                Engajamento
              </span>
              <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
                <Heart className="size-4" weight="fill" />
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle
                  className="size-4 text-emerald-500 dark:text-emerald-400"
                  weight="fill"
                />
                <CountUp
                  value={stats?.totalCompletedLessons ?? 0}
                  kind="int"
                  className="text-2xl font-bold tracking-tight tabular-nums sm:text-[1.7rem]"
                />
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Heart
                  className="size-4 text-rose-500 dark:text-rose-400"
                  weight="fill"
                />
                <CountUp
                  value={stats?.totalLikes ?? 0}
                  kind="int"
                  className="text-2xl font-bold tracking-tight tabular-nums sm:text-[1.7rem]"
                />
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                aulas concluídas e curtidas
              </span>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ===== Toolbar: contexto + ações ===== */}
      <Reveal immediate delayMs={60}>
        <div className="glass-card flex flex-col gap-3 rounded-3xl p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="bg-gradient-custom flex size-9 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
              <GraduationCap className="size-4.5" weight="fill" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold">
                Conteúdo da academia
              </p>
              <p className="text-muted-foreground truncate text-xs">
                Crie módulos e publique aulas para os assinantes
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              asChild
              className="h-10 cursor-pointer rounded-xl"
            >
              <Link href="/academy/lessons">
                <VideoCamera className="size-4" weight="fill" />
                Ver Aulas
              </Link>
            </Button>
            <Button
              onClick={() => setIsCreateModuleOpen(true)}
              className="btn-gradient-auth h-10 cursor-pointer rounded-xl px-4 font-semibold"
            >
              <Plus className="size-4" weight="bold" />
              Novo Módulo
            </Button>
          </div>
        </div>
      </Reveal>

      {/* ===== Módulos + Aulas Recentes ===== */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Módulos */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Reveal immediate delayMs={100}>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
              <div className="flex items-center gap-2.5">
                <SectionHeading
                  icon={<BookOpen className="size-4" weight="fill" />}
                  title="Módulos"
                  description="Trilhas de conteúdo da academia"
                />
                <Badge className="bg-gradient-custom rounded-full border-0 font-bold text-[#04222A]">
                  {modules.length}
                </Badge>
              </div>
              <Link
                href="/academy/modules"
                className="text-brand-cyan not-dark:text-primary inline-flex items-center gap-0.5 text-xs font-semibold transition-opacity hover:opacity-80 sm:text-sm"
              >
                Ver todos
                <CaretRight className="size-3.5" weight="bold" />
              </Link>
            </div>
          </Reveal>

          {modules.length === 0 ? (
            <Reveal immediate delayMs={140}>
              <div className="glass-card flex flex-col items-center gap-4 rounded-3xl py-14 text-center">
                <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
                  <BookOpen className="size-6" weight="fill" />
                </span>
                <div className="px-6">
                  <p className="text-base font-bold">Nenhum módulo criado</p>
                  <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
                    Comece criando seu primeiro módulo para organizar as aulas
                    da academia.
                  </p>
                </div>
                <Button
                  onClick={() => setIsCreateModuleOpen(true)}
                  className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
                >
                  <Plus className="size-4" weight="bold" />
                  Criar Primeiro Módulo
                </Button>
              </div>
            </Reveal>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {modules.slice(0, 4).map((module, index) => (
                <Reveal immediate key={module.id} delayMs={140 + index * 80}>
                  <Link
                    href="/academy/modules"
                    className="glass-card glass-card-hover group block overflow-hidden rounded-3xl"
                  >
                    <div className="relative aspect-[9/16] w-full overflow-hidden">
                      {/* Capa */}
                      {module.coverImageUrl ? (
                        <Image
                          src={module.coverImageUrl}
                          alt={module.title}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                        />
                      ) : (
                        <div className="dashboard-galaxy dark flex h-full w-full items-center justify-center">
                          <BookOpen
                            className="size-12 text-[color-mix(in_oklab,var(--brand-cyan)_30%,transparent)]"
                            weight="fill"
                          />
                        </div>
                      )}

                      {/* Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/25 opacity-70 transition-opacity group-hover:opacity-85" />

                      {/* Status */}
                      <span
                        className={cn(
                          "absolute top-3 right-3 z-10 flex size-7 items-center justify-center rounded-full text-white backdrop-blur-md",
                          module.isPublished
                            ? "bg-emerald-500/85"
                            : "bg-amber-500/85",
                        )}
                      >
                        {module.isPublished ? (
                          <Eye className="size-3.5" weight="fill" />
                        ) : (
                          <EyeSlash className="size-3.5" weight="fill" />
                        )}
                      </span>

                      {/* Ordem */}
                      <span className="absolute top-3 left-3 z-10 rounded-lg bg-black/55 px-2 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                        #{module.order}
                      </span>

                      {/* Info inferior */}
                      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 p-3">
                        <h3 className="line-clamp-2 text-sm font-bold text-white drop-shadow-lg">
                          {module.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                            <Play className="size-3" weight="fill" />
                            {module.lessonsCount}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                            <Clock className="size-3" weight="fill" />
                            {formatDuration(module.totalDuration)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          )}

          {modules.length > 4 && (
            <Reveal immediate delayMs={460}>
              <div className="text-center">
                <Button
                  variant="outline"
                  asChild
                  className="cursor-pointer rounded-xl"
                >
                  <Link href="/academy/modules">
                    Ver todos os {modules.length} módulos
                    <CaretRight className="size-4" weight="bold" />
                  </Link>
                </Button>
              </div>
            </Reveal>
          )}
        </div>

        {/* Aulas Recentes */}
        <div className="flex flex-col gap-4">
          <Reveal immediate delayMs={120}>
            <SectionHeading
              icon={<VideoCamera className="size-4" weight="fill" />}
              title="Aulas Recentes"
              description="Últimas aulas adicionadas"
              href="/academy/lessons"
              hrefLabel="Ver todas"
            />
          </Reveal>

          {recentLessons.length === 0 ? (
            <Reveal immediate delayMs={160}>
              <div className="glass-card flex flex-col items-center gap-3 rounded-3xl py-10 text-center">
                <span className="bg-gradient-custom flex size-11 items-center justify-center rounded-2xl text-[#04222A]">
                  <VideoCamera className="size-5" weight="fill" />
                </span>
                <div className="px-6">
                  <p className="text-sm font-bold">Nenhuma aula criada</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Crie um módulo primeiro para adicionar aulas.
                  </p>
                </div>
              </div>
            </Reveal>
          ) : (
            <div className="flex flex-col gap-3">
              {recentLessons.map((lesson, index) => (
                <Reveal immediate key={lesson.id} delayMs={160 + index * 60}>
                  <div className="glass-card glass-card-hover group flex gap-3 rounded-2xl p-3">
                    {/* Thumb 80×56 */}
                    <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-xl">
                      {lesson.thumbnailUrl ? (
                        <Image
                          src={lesson.thumbnailUrl}
                          alt={lesson.title}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="dashboard-galaxy dark flex h-full w-full items-center justify-center">
                          <Play
                            className="text-brand-cyan size-4"
                            weight="fill"
                          />
                        </div>
                      )}
                      {lesson.duration ? (
                        <span className="absolute right-1 bottom-1 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                          {formatDuration(lesson.duration)}
                        </span>
                      ) : null}
                    </div>

                    {/* Info */}
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <p className="group-hover:text-brand-cyan not-dark:group-hover:text-primary truncate text-sm font-semibold transition-colors">
                        {lesson.title}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {lesson.moduleTitle}
                      </p>
                      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle
                            className="size-3 text-emerald-500 dark:text-emerald-400"
                            weight="fill"
                          />
                          {lesson.completedCount}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Heart
                            className="size-3 text-rose-500 dark:text-rose-400"
                            weight="fill"
                          />
                          {lesson.likesCount}
                        </span>
                        {lesson.isFree && (
                          <Badge
                            variant="outline"
                            className="rounded-full border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[10px] text-emerald-600 dark:text-emerald-400"
                          >
                            Grátis
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Dot de status */}
                    <span
                      title={lesson.isPublished ? "Publicada" : "Rascunho"}
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        lesson.isPublished
                          ? "bg-emerald-400 shadow-[0_0_8px_1px_rgba(52,211,153,0.6)]"
                          : "bg-amber-400 shadow-[0_0_8px_1px_rgba(251,191,36,0.55)]",
                      )}
                    />
                  </div>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== Quick Actions ===== */}
      <Reveal immediate delayMs={180}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick={() => setIsCreateModuleOpen(true)}
            className="glass-card glass-card-hover flex cursor-pointer items-center gap-4 rounded-2xl p-4 text-left"
          >
            <QuickActionIcon accent="gradient">
              <Plus className="size-5" weight="bold" />
            </QuickActionIcon>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-bold">Novo Módulo</span>
              <span className="text-muted-foreground truncate text-xs">
                Criar módulo de aulas
              </span>
            </span>
          </button>

          <Link
            href="/academy/lessons"
            className="glass-card glass-card-hover flex items-center gap-4 rounded-2xl p-4"
          >
            <QuickActionIcon accent="cyan">
              <VideoCamera className="size-5" weight="fill" />
            </QuickActionIcon>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-bold">Nova Aula</span>
              <span className="text-muted-foreground truncate text-xs">
                Adicionar vídeo aula
              </span>
            </span>
          </Link>

          <Link
            href="/academy/modules"
            className="glass-card glass-card-hover flex items-center gap-4 rounded-2xl p-4"
          >
            <QuickActionIcon accent="green">
              <SquaresFour className="size-5" weight="fill" />
            </QuickActionIcon>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-bold">Gerenciar</span>
              <span className="text-muted-foreground truncate text-xs">
                Organizar conteúdo
              </span>
            </span>
          </Link>

          <Link
            href="/academy/reports"
            className="glass-card glass-card-hover flex items-center gap-4 rounded-2xl p-4"
          >
            <QuickActionIcon accent="gradient">
              <ChartBar className="size-5" weight="fill" />
            </QuickActionIcon>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-bold">Estatísticas</span>
              <span className="text-muted-foreground truncate text-xs">
                Ver métricas da academia
              </span>
            </span>
          </Link>
        </div>
      </Reveal>

      <CreateModuleDialog
        open={isCreateModuleOpen}
        onOpenChange={setIsCreateModuleOpen}
        onSuccess={() => void utils.academy.getOverview.invalidate()}
      />
    </div>
  )
}

function QuickActionIcon({
  accent,
  children,
}: {
  accent: "cyan" | "green" | "gradient"
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-xl text-[#04222A]",
        accent === "cyan" &&
          "bg-[var(--brand-cyan)] not-dark:bg-[#089eb8] not-dark:text-white",
        accent === "green" &&
          "bg-[var(--brand-green)] not-dark:bg-[#0eb981] not-dark:text-white",
        accent === "gradient" && "bg-gradient-custom",
      )}
    >
      {children}
    </span>
  )
}

/* ============================================================
   SKELETON — espelha o layout real com o kit da marca
   ============================================================ */
function AcademySkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* Hero */}
      <HeroSkeleton stats={3} viz={<AcademyHeroVizSkeleton />} />

      {/* KPIs */}
      <StatTilesGridSkeleton
        count={4}
        className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
      />

      {/* Toolbar */}
      <div className="glass-card flex flex-col gap-3 rounded-3xl p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex items-center gap-2.5">
          <Bone className="size-9 rounded-xl" />
          <div className="flex flex-col gap-1.5">
            <Bone delay={60} className="h-3.5 w-40" />
            <Bone delay={120} className="h-3 w-56 max-w-full rounded-full" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Bone delay={180} className="h-10 w-28 rounded-xl" />
          <Bone delay={260} className="h-10 w-34 rounded-xl" />
        </div>
      </div>

      {/* Módulos + Aulas Recentes */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Bone className="size-8 rounded-lg" />
              <div className="flex flex-col gap-1.5">
                <Bone delay={60} className="h-4 w-24" />
                <Bone delay={120} className="h-3 w-40 rounded-full" />
              </div>
              <Bone delay={160} className="h-5 w-8 rounded-full" />
            </div>
            <Bone delay={200} className="h-3.5 w-16 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Bone
                key={index}
                delay={index * 120}
                className="aspect-[9/16] w-full rounded-3xl"
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Bone className="size-8 rounded-lg" />
              <div className="flex flex-col gap-1.5">
                <Bone delay={60} className="h-4 w-32" />
                <Bone delay={120} className="h-3 w-36 rounded-full" />
              </div>
            </div>
            <Bone delay={180} className="h-3.5 w-16 rounded-full" />
          </div>
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="glass-card flex gap-3 rounded-2xl p-3"
              >
                <Bone
                  delay={index * 100}
                  className="h-14 w-20 shrink-0 rounded-xl"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Bone delay={index * 100 + 40} className="h-3.5 w-4/5" />
                  <Bone
                    delay={index * 100 + 80}
                    className="h-3 w-1/2 rounded-full"
                  />
                  <Bone
                    delay={index * 100 + 120}
                    className="h-3 w-2/3 rounded-full"
                  />
                </div>
                <Bone
                  delay={index * 100 + 160}
                  className="mt-1.5 size-2 shrink-0 rounded-full"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="glass-card flex items-center gap-4 rounded-2xl p-4"
          >
            <Bone delay={index * 100} className="size-11 shrink-0 rounded-xl" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Bone delay={index * 100 + 60} className="h-3.5 w-24" />
              <Bone
                delay={index * 100 + 120}
                className="h-3 w-32 max-w-full rounded-full"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
