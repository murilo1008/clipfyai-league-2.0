"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useUser } from "@clerk/nextjs"
import {
  ArrowRight,
  BookOpen,
  CheckCircle,
  Clock,
  Crown,
  CurrencyDollar,
  FileText,
  Flame,
  Gift,
  GraduationCap,
  Lock,
  MagnifyingGlass,
  Medal,
  Play,
  Sparkle,
  Star,
  TrendUp,
  Trophy,
  Users,
  X,
} from "@phosphor-icons/react"
import { motion } from "framer-motion"

import { ClassesMarathonHeroViz, ClassesMarathonHeroVizSkeleton } from "@/components/classes/classes-marathon-hero-viz"
import { ClipfyProPricingDialog } from "@/components/clippers/clipfy-pro-pricing-dialog"
import { ClipfyUltraPricingDialog } from "@/components/clippers/clipfy-ultra-pricing-dialog"
import { ClipperManualPricingDialog } from "@/components/clippers/clipper-manual-pricing-dialog"
import { UltraDiscordInviteDialog } from "@/components/clippers/ultra-discord-invite-dialog"
import { DarkScope } from "@/components/shared/dark-scope"
import { Reveal } from "@/components/shared/reveal"
import { Bone, HeroSkeleton } from "@/components/shared/skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { api, type RouterOutputs } from "@/trpc/react"

type MemberContent = RouterOutputs["academy"]["getMemberContent"]
type ModuleItem = MemberContent["modules"][number]
type LessonItem = ModuleItem["lessons"][number]

/** "Xh Ymin" | "Ymin" */
const formatDuration = (seconds: number | null) => {
  if (!seconds) return "0min"
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${mins}min`
  return `${mins}min`
}

/** "m:ss" */
const formatDurationShort = (seconds: number | null) => {
  if (!seconds) return "0:00"
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

const AFFILIATE_URL = "https://dashboard.kiwify.com/join/affiliate/23Qa7ehA"

export default function ClassesAcademy() {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isProDialogOpen, setIsProDialogOpen] = React.useState(false)
  const [isManualDialogOpen, setIsManualDialogOpen] = React.useState(false)
  const [isUltraDialogOpen, setIsUltraDialogOpen] = React.useState(false)
  const [isUltraDiscordDialogOpen, setIsUltraDiscordDialogOpen] =
    React.useState(false)

  // Usuário logado (email para pré-preencher checkouts)
  const { user } = useUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress ?? ""

  // Assinatura / produtos do usuário
  const { data: userData } = api.user.getCurrentUser.useQuery()
  const isSubscriber = userData?.subscriptionStatus === "ACTIVE"
  const hasClipperManual = userData?.hasClipperManual === true
  const isUltraSubscriber = userData?.subscriptionTier === "ULTRA"

  const { data, isLoading, error } = api.academy.getMemberContent.useQuery()

  // Busca em título/descrição de módulos E de aulas (retorna o módulo inteiro)
  const filteredModules = React.useMemo(() => {
    if (!data?.modules) return []
    if (!searchQuery) return data.modules

    const query = searchQuery.toLowerCase()
    return data.modules.filter(
      (module) =>
        module.title.toLowerCase().includes(query) ||
        module.description?.toLowerCase().includes(query) ||
        module.lessons.some(
          (lesson) =>
            lesson.title.toLowerCase().includes(query) ||
            lesson.description?.toLowerCase().includes(query),
        ),
    )
  }, [data?.modules, searchQuery])

  // Aulas em andamento (iniciadas mas não concluídas)
  const inProgressLessons = React.useMemo(() => {
    if (!data?.modules) return []

    const lessons: Array<{ lesson: LessonItem; module: ModuleItem }> = []
    data.modules.forEach((module) => {
      module.lessons.forEach((lesson) => {
        if (lesson.progressPercent > 0 && !lesson.isCompleted) {
          lessons.push({ lesson, module })
        }
      })
    })

    return lessons.slice(0, 3)
  }, [data?.modules])

  if (isLoading) return <ClassesAcademySkeleton />

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-1 items-center justify-center px-4 py-16 sm:px-6">
        <div className="glass-card flex max-w-md flex-col items-center gap-4 rounded-3xl p-8 text-center">
          <span className="bg-destructive/10 flex size-14 items-center justify-center rounded-2xl">
            <GraduationCap className="text-destructive size-7" weight="fill" />
          </span>
          <div>
            <h2 className="text-xl font-bold">Erro ao carregar</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {error.message}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const stats = data?.stats
  const modules = filteredModules

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero da Academia — faixa de marca fixa (independente do tema) ===== */}
      <DarkScope className="contents">
        <section className="animate-fade-in-up relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#050f1c_0%,#0a1c2b_100%)] p-6 ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_18%,transparent)] sm:p-8 lg:p-10">
          {/* Glows da marca */}
          <span
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_16%,transparent)] blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-10 size-72 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_12%,transparent)] blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-cyan)_60%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_40%,transparent)] to-transparent"
          />

          {/* Visualização animada — maratona de aulas */}
          <ClassesMarathonHeroViz />

          <div className="relative z-10 flex max-w-2xl flex-col gap-4">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] text-[#8aa3b3] uppercase">
              <span className="bg-gradient-custom size-1.5 rounded-full" />
              Clipfy League · Academia
            </span>

            <h1 className="text-3xl leading-tight font-bold tracking-tight text-[#ecf7f9] sm:text-4xl lg:text-[2.75rem]">
              Domine a arte do <span className="text-gradient">clipping</span>
            </h1>

            <p className="max-w-xl text-sm leading-relaxed text-[#8aa3b3] sm:text-base">
              Módulos e aulas práticas para transformar cortes em resultado —
              estude no seu ritmo e vire um clipador de elite.
            </p>

            {/* CTAs conforme o plano do usuário */}
            {userData && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {isSubscriber ? (
                  isUltraSubscriber ? (
                    <Button
                      onClick={() => setIsUltraDiscordDialogOpen(true)}
                      className="group relative h-11 cursor-pointer overflow-hidden rounded-xl border-0 bg-gradient-to-r from-violet-500 to-purple-500 px-6 font-bold text-white shadow-lg shadow-violet-500/30 transition-all hover:scale-105 hover:from-violet-600 hover:to-purple-600 hover:shadow-xl hover:shadow-violet-500/40"
                    >
                      <span
                        aria-hidden
                        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-white/0 via-white/20 to-white/0 transition-transform duration-700 group-hover:translate-x-full"
                      />
                      <span className="relative flex items-center gap-2">
                        <Trophy className="size-4" weight="fill" />
                        Acessar Ultra
                        <Sparkle className="size-3 animate-pulse" weight="fill" />
                      </span>
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setIsUltraDialogOpen(true)}
                      className="group relative h-11 cursor-pointer overflow-hidden rounded-xl border-0 bg-gradient-to-r from-violet-500 to-purple-500 px-6 font-bold text-white shadow-lg shadow-violet-500/30 transition-all hover:scale-105 hover:from-violet-600 hover:to-purple-600 hover:shadow-xl hover:shadow-violet-500/40"
                    >
                      <span
                        aria-hidden
                        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-white/0 via-white/20 to-white/0 transition-transform duration-700 group-hover:translate-x-full"
                      />
                      <span className="relative flex items-center gap-2">
                        <Crown className="size-4" weight="fill" />
                        <span className="hidden sm:inline">
                          Fazer Upgrade para ULTRA
                        </span>
                        <span className="sm:hidden">ULTRA</span>
                        <Sparkle className="size-3 animate-pulse" weight="fill" />
                      </span>
                    </Button>
                  )
                ) : (
                  <>
                    <span className="inline-flex items-center gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 py-2 pr-4 pl-2 backdrop-blur-sm">
                      <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30">
                        <Lock className="size-4" weight="fill" />
                      </span>
                      <span className="text-sm font-bold text-amber-300">
                        Conteúdo Exclusivo PRO
                      </span>
                    </span>
                    <Button
                      onClick={() => setIsProDialogOpen(true)}
                      className="btn-gradient-auth h-11 cursor-pointer rounded-xl px-6 font-bold"
                    >
                      <Crown className="size-4" weight="fill" />
                      Desbloquear
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      </DarkScope>

      {/* ===== Continuar Assistindo ===== */}
      {inProgressLessons.length > 0 && (
        <Reveal immediate>
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-orange-500/10">
                <Flame className="size-4.5 text-orange-500" weight="fill" />
              </span>
              <h2 className="text-xl font-bold tracking-tight">
                Continuar Assistindo
              </h2>
            </div>

            <div className="group/watch relative">
              <Carousel
                opts={{ align: "start", dragFree: true, containScroll: "trimSnaps" }}
                className="w-full"
              >
                <CarouselContent className="-ml-3 sm:-ml-4">
                  {inProgressLessons.map(({ lesson, module }) => (
                    <CarouselItem
                      key={lesson.id}
                      className="basis-full pl-3 sm:basis-1/2 sm:pl-4 lg:basis-1/3"
                    >
                      {/* Link direto para a aula no player (corrige o 404 do original) */}
                      <Link
                        href={`/classes/modules?lessonId=${lesson.id}`}
                        className="group block"
                      >
                        <article className="glass-card glass-card-hover overflow-hidden rounded-3xl">
                          <div className="relative aspect-video overflow-hidden">
                            {lesson.thumbnailUrl ? (
                              <Image
                                src={lesson.thumbnailUrl}
                                alt={lesson.title}
                                fill
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,color-mix(in_oklab,var(--brand-cyan)_16%,transparent),color-mix(in_oklab,var(--brand-mint)_12%,transparent))]">
                                <Play
                                  className="text-brand-cyan not-dark:text-primary size-12 opacity-60"
                                  weight="fill"
                                />
                              </div>
                            )}

                            {/* Overlay + play no hover */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                              <span className="bg-gradient-custom flex size-12 items-center justify-center rounded-full text-[#04222A] shadow-xl">
                                <Play className="size-5" weight="fill" />
                              </span>
                            </div>

                            {/* Duração */}
                            {lesson.duration ? (
                              <span className="absolute right-2 bottom-2.5 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
                                {formatDurationShort(lesson.duration)}
                              </span>
                            ) : null}

                            {/* Barra de progresso */}
                            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
                              <div
                                className="bg-gradient-custom h-full"
                                style={{ width: `${lesson.progressPercent}%` }}
                              />
                            </div>
                          </div>

                          <div className="flex flex-col gap-1 p-4">
                            <p className="text-muted-foreground truncate text-xs">
                              {module.title}
                            </p>
                            <h3 className="group-hover:text-brand-cyan not-dark:group-hover:text-primary line-clamp-2 font-semibold transition-colors">
                              {lesson.title}
                            </h3>
                            <p className="text-muted-foreground mt-1 text-xs">
                              {lesson.progressPercent}% concluído
                            </p>
                          </div>
                        </article>
                      </Link>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="bg-background/90 left-2 z-10 hidden size-9 border opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-300 group-hover/watch:opacity-100 sm:flex" />
                <CarouselNext className="bg-background/90 right-2 z-10 hidden size-9 border opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-300 group-hover/watch:opacity-100 sm:flex" />
              </Carousel>
            </div>
          </section>
        </Reveal>
      )}

      {/* ===== Header de Módulos + busca ===== */}
      <Reveal immediate delayMs={60}>
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <span className="bg-gradient-custom flex size-9 items-center justify-center rounded-xl text-[#04222A]">
              <GraduationCap className="size-4.5" weight="fill" />
            </span>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Módulos</h2>
              <p className="text-muted-foreground text-sm">
                {modules.length} módulos disponíveis
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-72">
            <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar aulas ou módulos..."
              className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl pl-10"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Limpar busca"
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>
      </Reveal>

      {/* ===== Carrossel de módulos ===== */}
      {modules.length === 0 ? (
        <Reveal immediate>
          <div className="glass-card flex flex-col items-center gap-4 rounded-3xl py-16 text-center">
            <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
              <BookOpen className="size-6" weight="fill" />
            </span>
            <div className="px-4">
              <p className="text-base font-bold">
                {searchQuery
                  ? "Nenhum resultado encontrado"
                  : "Nenhum módulo disponível"}
              </p>
              <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                {searchQuery
                  ? "Tente buscar por outro termo."
                  : "Novos conteúdos serão adicionados em breve!"}
              </p>
            </div>
            {searchQuery && (
              <Button
                variant="outline"
                className="cursor-pointer rounded-xl"
                onClick={() => setSearchQuery("")}
              >
                Limpar busca
              </Button>
            )}
          </div>
        </Reveal>
      ) : (
        <Reveal immediate delayMs={120}>
          <div className="group/modules relative">
            <Carousel
              opts={{ align: "start", dragFree: true, containScroll: "trimSnaps" }}
              className="w-full"
            >
              <CarouselContent className="-ml-2 sm:-ml-3">
                {modules.map((module) => (
                  <CarouselItem
                    key={module.id}
                    className="basis-1/2 pl-2 sm:pl-3 lg:basis-1/3 xl:basis-1/4"
                  >
                    {isSubscriber ? (
                      <ModuleCard module={module} />
                    ) : (
                      <LockedModuleCard
                        module={module}
                        onUnlock={() => setIsProDialogOpen(true)}
                      />
                    )}
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="bg-background/90 left-2 z-10 hidden size-9 border opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-300 group-hover/modules:opacity-100 sm:flex" />
              <CarouselNext className="bg-background/90 right-2 z-10 hidden size-9 border opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-300 group-hover/modules:opacity-100 sm:flex" />
            </Carousel>
          </div>
        </Reveal>
      )}

      {/* ===== eBooks ===== */}
      <Reveal>
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
              <FileText
                className="size-4.5 text-emerald-600 dark:text-emerald-400"
                weight="fill"
              />
            </span>
            <div>
              <h2 className="text-xl font-bold tracking-tight">eBooks</h2>
              <p className="text-muted-foreground text-sm">
                Materiais exclusivos para clipadores
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {hasClipperManual ? (
              /* ===== Manual DESBLOQUEADO ===== */
              <article className="group relative overflow-hidden rounded-3xl shadow-sm ring-1 ring-emerald-500/20 transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/20">
                <div className="relative aspect-[9/16] overflow-hidden">
                  <Image
                    src="/images/Manual-do-Clipador.jpg"
                    alt="Manual do Clipador"
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

                  <Badge className="absolute top-4 right-4 z-10 gap-1 rounded-full border-0 bg-emerald-500 text-xs font-bold text-white shadow-lg">
                    <CheckCircle className="size-3" weight="fill" />
                    Adquirido
                  </Badge>

                  <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 p-4 sm:p-5">
                    <h3 className="text-lg font-bold text-white drop-shadow-lg sm:text-xl">
                      Manual do Clipador
                    </h3>
                    <p className="line-clamp-2 text-sm text-gray-300">
                      Como vencer competições, construir constância e
                      transformar cortes em renda
                    </p>
                    <Link
                      href="/classes/manual"
                      className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all hover:scale-[1.02] hover:from-emerald-600 hover:to-teal-600"
                    >
                      <BookOpen className="size-4" weight="fill" />
                      Acessar
                    </Link>
                  </div>
                </div>
              </article>
            ) : (
              /* ===== Manual BLOQUEADO ===== */
              <article
                onClick={() => setIsManualDialogOpen(true)}
                className="group ring-border/60 relative cursor-pointer overflow-hidden rounded-3xl shadow-sm ring-1 transition-all duration-500 hover:shadow-2xl hover:shadow-amber-500/20"
              >
                <div className="relative aspect-[9/16] overflow-hidden">
                  <Image
                    src="/images/Manual-do-Clipador.jpg"
                    alt="Manual do Clipador"
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    className="object-cover grayscale transition-all duration-700 group-hover:scale-110 group-hover:grayscale-0"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/30 transition-all group-hover:via-black/40" />

                  {/* Cadeado central com micro-rotação */}
                  <div className="absolute inset-0 z-20 flex items-center justify-center">
                    <motion.span
                      className="flex items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/90 to-orange-500/90 p-5 shadow-xl shadow-amber-500/30 transition-transform duration-300 group-hover:scale-110"
                      whileHover={{ rotate: [0, -5, 5, 0] }}
                      transition={{ duration: 0.5 }}
                    >
                      <Lock className="size-8 text-white" weight="fill" />
                    </motion.span>
                  </div>

                  <Badge className="absolute top-4 right-4 z-10 gap-1 rounded-full border-0 bg-gradient-to-r from-amber-500 to-orange-500 text-xs font-bold text-white shadow-lg">
                    <FileText className="size-3" weight="fill" />
                    eBook
                  </Badge>

                  <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 p-4 sm:p-5">
                    <h3 className="text-lg font-bold text-white drop-shadow-lg sm:text-xl">
                      Manual do Clipador
                    </h3>
                    <p className="line-clamp-2 text-sm text-gray-300">
                      Como vencer competições, construir constância e
                      transformar cortes em renda
                    </p>
                    <span className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-4 py-2 backdrop-blur-sm">
                      <Sparkle className="size-4 text-amber-400" weight="fill" />
                      <span className="text-sm font-semibold text-amber-400">
                        Desbloquear Acesso
                      </span>
                    </span>
                  </div>
                </div>
              </article>
            )}
          </div>
        </section>
      </Reveal>

      {/* ===== Conquistas / Motivação ===== */}
      <Reveal>
        <section className="glass-card relative overflow-hidden rounded-3xl p-6 sm:p-8">
          <span
            aria-hidden
            className="pointer-events-none absolute top-0 right-0 -mt-32 -mr-32 size-64 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_8%,transparent)] blur-2xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-0 -mb-24 -ml-24 size-48 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_8%,transparent)] blur-2xl"
          />

          <div className="relative flex flex-col items-center gap-6 lg:flex-row lg:gap-10">
            <div className="flex flex-1 flex-col items-center gap-3 text-center lg:items-start lg:text-left">
              <span className="border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan not-dark:border-primary/30 not-dark:bg-primary/10 not-dark:text-primary inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold">
                <Medal className="size-4" weight="fill" />
                Continue aprendendo!
              </span>
              <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Sua jornada de{" "}
                <span className="text-gradient">clipador profissional</span>
              </h3>
              <p className="text-muted-foreground max-w-lg">
                Cada aula assistida é um passo mais perto de dominar a arte do
                clipping. Continue estudando e se torne um clipador de elite!
              </p>
            </div>

            <div className="flex items-center gap-4 sm:gap-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <span className="flex size-15 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 sm:size-16">
                  <Star
                    className="size-7 text-amber-500 sm:size-8"
                    weight="fill"
                  />
                </span>
                <p className="text-2xl font-bold tabular-nums">
                  {stats?.completedLessons ?? 0}
                </p>
                <p className="text-muted-foreground -mt-1.5 text-xs">Aulas</p>
              </div>
              <div className="flex flex-col items-center gap-2 text-center">
                <span className="flex size-15 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 sm:size-16">
                  <TrendUp
                    className="size-7 text-purple-500 sm:size-8"
                    weight="fill"
                  />
                </span>
                <p className="text-2xl font-bold tabular-nums">
                  {stats?.overallProgress ?? 0}%
                </p>
                <p className="text-muted-foreground -mt-1.5 text-xs">
                  Progresso
                </p>
              </div>
              <div className="flex flex-col items-center gap-2 text-center">
                <span className="flex size-15 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 sm:size-16">
                  <Users
                    className="size-7 text-cyan-500 sm:size-8"
                    weight="fill"
                  />
                </span>
                <p className="text-2xl font-bold tabular-nums">
                  {stats?.totalModules ?? 0}
                </p>
                <p className="text-muted-foreground -mt-1.5 text-xs">Módulos</p>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ===== Indique e Ganhe — Programa de Afiliados ===== */}
      <Reveal>
        <section className="glass-card relative overflow-hidden rounded-3xl">
          {/* Pattern pontilhado sutil */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          />
          {/* Blobs decorativos */}
          <span
            aria-hidden
            className="pointer-events-none absolute top-0 right-0 -mt-40 -mr-40 size-80 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_10%,transparent)] blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-0 -mb-30 -ml-30 size-60 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_10%,transparent)] blur-3xl"
          />

          <div className="relative grid gap-6 p-5 sm:p-8 lg:grid-cols-2 lg:gap-10 lg:p-10">
            {/* Conteúdo */}
            <div className="order-2 flex flex-col justify-center lg:order-1">
              <span className="border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan not-dark:border-primary/30 not-dark:bg-primary/10 not-dark:text-primary mb-4 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium sm:text-sm">
                <Gift className="size-4" weight="fill" />
                Programa de Afiliados
              </span>

              <h3 className="mb-3 text-xl leading-tight font-bold tracking-tight sm:text-2xl lg:text-3xl">
                Indique a{" "}
                <span className="text-gradient">Clipfy League PRO</span> e ganhe
                dinheiro
              </h3>

              <p className="text-muted-foreground mb-5 max-w-lg text-sm leading-relaxed sm:text-base">
                Compartilhe seu link de afiliado e ganhe comissão por cada
                pessoa que se tornar{" "}
                <strong className="text-foreground">PRO</strong> através da sua
                indicação. Quanto mais indicar, mais você ganha!
              </p>

              <div className="mb-6 flex flex-col gap-2.5">
                {[
                  {
                    icon: CurrencyDollar,
                    text: "Comissão em cada venda realizada",
                    chip: "bg-brand-cyan/10 border-brand-cyan/25 text-brand-cyan not-dark:bg-primary/10 not-dark:border-primary/25 not-dark:text-primary",
                  },
                  {
                    icon: Users,
                    text: "Ganhos com recorrência mensal",
                    chip: "bg-brand-mint/10 border-brand-mint/25 text-teal-600 dark:text-brand-mint",
                  },
                  {
                    icon: TrendUp,
                    text: "Produto com alta taxa de conversão",
                    chip: "bg-brand-green/10 border-brand-green/25 text-emerald-600 dark:text-brand-green",
                  },
                ].map((item) => {
                  const ItemIcon = item.icon
                  return (
                    <div key={item.text} className="group flex items-center gap-3">
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg border transition-transform duration-300 group-hover:scale-110",
                          item.chip,
                        )}
                      >
                        <ItemIcon className="size-4" weight="fill" />
                      </span>
                      <span className="text-muted-foreground group-hover:text-foreground text-sm font-medium transition-colors sm:text-base">
                        {item.text}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="flex flex-col items-start gap-3 sm:flex-row">
                <Button
                  asChild
                  className="btn-gradient-auth group h-12 w-full cursor-pointer rounded-xl px-6 text-sm font-bold sm:w-auto sm:text-base"
                >
                  <a
                    href={AFFILIATE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Sparkle className="size-4.5" weight="fill" />
                    Quero ser Afiliado
                    <ArrowRight
                      className="size-4.5 transition-transform group-hover:translate-x-1"
                      weight="bold"
                    />
                  </a>
                </Button>
                <p className="text-muted-foreground/70 text-[11px] sm:self-center sm:text-xs">
                  Cadastro gratuito na Kiwify
                </p>
              </div>
            </div>

            {/* Card visual */}
            <div className="relative order-1 flex items-center justify-center lg:order-2">
              <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
                <span
                  aria-hidden
                  className="pointer-events-none absolute -inset-4 rounded-3xl bg-[linear-gradient(90deg,color-mix(in_oklab,var(--brand-cyan)_15%,transparent),color-mix(in_oklab,var(--brand-green)_15%,transparent))] opacity-60 blur-2xl"
                />

                <div className="border-border/60 bg-card/80 relative overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-sm">
                  {/* Header do card */}
                  <div className="p-5 pb-0 sm:p-6 sm:pb-0">
                    <div className="mb-4 flex items-center gap-3">
                      <span className="bg-gradient-custom flex size-11 items-center justify-center rounded-xl text-[#04222A] shadow-lg sm:size-12">
                        <Crown className="size-5 sm:size-6" weight="fill" />
                      </span>
                      <div>
                        <h4 className="text-base font-bold sm:text-lg">
                          Clipfy League PRO
                        </h4>
                        <p className="text-muted-foreground text-xs">
                          Programa de Afiliados
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Stats — copy de marketing (não mascara) */}
                  <div className="px-5 pb-5 sm:px-6 sm:pb-6">
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      {[
                        { value: "+R$50K", label: "em prêmios" },
                        { value: "+500", label: "clipadores" },
                        { value: "Alta", label: "conversão" },
                      ].map((stat) => (
                        <div
                          key={stat.label}
                          className="border-border/50 rounded-xl border bg-[color-mix(in_oklab,var(--brand-cyan)_5%,transparent)] p-3 text-center sm:p-4"
                        >
                          <div className="text-gradient text-lg font-black sm:text-xl">
                            {stat.value}
                          </div>
                          <div className="text-muted-foreground mt-0.5 text-[10px] sm:text-xs">
                            {stat.label}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Mini-lista de recursos */}
                    <div className="mt-4 flex flex-col gap-2">
                      {[
                        "Comissão atrativa por venda",
                        "Upsell automático (ULTRA + Manual)",
                        "Link de afiliado personalizado",
                      ].map((feature) => (
                        <div key={feature} className="flex items-center gap-2">
                          <CheckCircle
                            className="text-brand-cyan not-dark:text-primary size-4 shrink-0"
                            weight="fill"
                          />
                          <span className="text-muted-foreground text-xs sm:text-sm">
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Barra de acento */}
                  <div className="bg-gradient-custom h-1" />
                </div>

                {/* Badge flutuante */}
                <div
                  className="absolute -right-2 top-4 hidden animate-bounce sm:block lg:-right-4 lg:top-8"
                  style={{ animationDuration: "3s" }}
                >
                  <div className="border-brand-cyan/30 bg-card/90 rounded-xl border p-2.5 shadow-xl backdrop-blur-md sm:p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-green-500/15">
                        <CurrencyDollar
                          className="size-4 text-green-500"
                          weight="bold"
                        />
                      </span>
                      <div>
                        <div className="text-xs font-bold text-green-600 dark:text-green-500">
                          Comissão
                        </div>
                        <div className="text-muted-foreground text-[10px]">
                          Recorrente
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ===== Dialogs ===== */}
      <ClipfyProPricingDialog
        open={isProDialogOpen}
        onOpenChange={setIsProDialogOpen}
        userEmail={userEmail}
      />
      <ClipperManualPricingDialog
        open={isManualDialogOpen}
        onOpenChange={setIsManualDialogOpen}
        userEmail={userEmail}
      />
      <ClipfyUltraPricingDialog
        open={isUltraDialogOpen}
        onOpenChange={setIsUltraDialogOpen}
        userEmail={userEmail}
      />
      <UltraDiscordInviteDialog
        open={isUltraDiscordDialogOpen}
        onOpenChange={setIsUltraDiscordDialogOpen}
      />
    </div>
  )
}

/* ============================================================
   CARD DE MÓDULO (assinante) — capa 9:16 com progresso
   ============================================================ */

function ModuleCard({ module }: { module: ModuleItem }) {
  return (
    <Link href={`/classes/modules?moduleId=${module.id}`} className="group block">
      <article className="ring-border/60 hover:shadow-brand-cyan/15 relative overflow-hidden rounded-3xl shadow-sm ring-1 transition-all duration-500 hover:shadow-2xl">
        <div className="relative aspect-[9/16] overflow-hidden">
          {module.coverImageUrl ? (
            <Image
              src={module.coverImageUrl}
              alt={module.title}
              fill
              sizes="(max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
              className="object-cover transition-transform duration-700 group-hover:scale-110"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,color-mix(in_oklab,var(--brand-cyan)_22%,#0a1c2b),#0d2436_52%,color-mix(in_oklab,var(--brand-mint)_18%,#0a1c2b))]">
              <span className="flex items-center justify-center rounded-2xl bg-black/40 p-4 backdrop-blur-sm sm:rounded-3xl sm:p-6">
                <BookOpen
                  className="text-brand-cyan size-8 sm:size-12"
                  weight="fill"
                />
              </span>
            </div>
          )}

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

          {/* Badge de progresso */}
          {module.progress > 0 && (
            <div className="absolute top-2 right-2 z-10 sm:top-4 sm:right-4">
              <span
                className={cn(
                  "flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm sm:rounded-xl sm:px-3 sm:py-1.5 sm:text-sm",
                  module.progress === 100
                    ? "bg-emerald-500/90 text-white"
                    : "bg-white/20 text-white",
                )}
              >
                {module.progress === 100 ? (
                  <span className="flex items-center gap-0.5 sm:gap-1">
                    <CheckCircle className="size-3 sm:size-4" weight="fill" />
                    <span className="hidden sm:inline">Concluído</span>
                    <span className="sm:hidden">100%</span>
                  </span>
                ) : (
                  `${module.progress}%`
                )}
              </span>
            </div>
          )}

          {/* Conteúdo */}
          <div className="absolute inset-x-0 bottom-0 z-10 p-2.5 sm:p-4 md:p-5">
            <h3 className="mb-1 line-clamp-2 text-xs leading-tight font-bold text-white drop-shadow-lg sm:mb-2 sm:text-base md:text-lg lg:text-xl">
              {module.title}
            </h3>
            <div className="mb-1.5 flex flex-wrap items-center gap-1 sm:mb-3 sm:gap-2">
              <span className="flex items-center gap-1 rounded-md bg-white/20 px-1.5 py-0.5 backdrop-blur-sm sm:rounded-lg sm:px-2.5 sm:py-1">
                <Play
                  className="size-2.5 shrink-0 text-white sm:size-3.5"
                  weight="fill"
                />
                <span className="text-[10px] font-medium whitespace-nowrap text-white sm:text-xs">
                  {module.lessonsCount} aulas
                </span>
              </span>
              <span className="flex items-center gap-1 rounded-md bg-white/20 px-1.5 py-0.5 backdrop-blur-sm sm:rounded-lg sm:px-2.5 sm:py-1">
                <Clock
                  className="size-2.5 shrink-0 text-white sm:size-3.5"
                  weight="fill"
                />
                <span className="text-[10px] font-medium whitespace-nowrap text-white sm:text-xs">
                  {formatDuration(module.totalDuration)}
                </span>
              </span>
            </div>
            <div className="flex flex-col gap-0.5 sm:gap-1">
              <span className="truncate text-[10px] text-gray-300 sm:text-xs">
                {module.completedLessonsCount} de {module.lessonsCount} aulas
              </span>
              <div className="h-1 overflow-hidden rounded-full bg-white/20 sm:h-1.5">
                <div
                  className="bg-gradient-custom h-full rounded-full transition-all duration-500"
                  style={{ width: `${module.progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </article>
    </Link>
  )
}

/* ============================================================
   CARD DE MÓDULO BLOQUEADO (não assinante) — grayscale + cadeado
   ============================================================ */

function LockedModuleCard({
  module,
  onUnlock,
}: {
  module: ModuleItem
  onUnlock: () => void
}) {
  return (
    <article
      onClick={onUnlock}
      className="group ring-border/60 relative cursor-pointer overflow-hidden rounded-3xl shadow-sm ring-1 transition-all duration-500 hover:shadow-2xl hover:shadow-amber-500/20"
    >
      <div className="relative aspect-[9/16] overflow-hidden">
        {module.coverImageUrl ? (
          <Image
            src={module.coverImageUrl}
            alt={module.title}
            fill
            sizes="(max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="object-cover grayscale transition-all duration-700 group-hover:scale-110 group-hover:grayscale-0"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,color-mix(in_oklab,var(--brand-cyan)_22%,#0a1c2b),#0d2436_52%,color-mix(in_oklab,var(--brand-mint)_18%,#0a1c2b))]">
            <span className="flex items-center justify-center rounded-2xl bg-black/40 p-4 backdrop-blur-sm sm:rounded-3xl sm:p-6">
              <BookOpen
                className="text-brand-cyan size-8 sm:size-12"
                weight="fill"
              />
            </span>
          </div>
        )}

        {/* Overlay escuro do bloqueio */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/30 transition-all group-hover:via-black/40" />

        {/* Cadeado central com micro-rotação no hover */}
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <motion.span
            className="flex items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/90 to-orange-500/90 p-3 shadow-xl shadow-amber-500/30 transition-transform duration-300 group-hover:scale-110 sm:rounded-2xl sm:p-5"
            whileHover={{ rotate: [0, -5, 5, 0] }}
            transition={{ duration: 0.5 }}
          >
            <Lock className="size-5 text-white sm:size-8" weight="fill" />
          </motion.span>
        </div>

        {/* Badge PRO */}
        <Badge className="absolute top-2 right-2 z-10 gap-0.5 rounded-full border-0 bg-gradient-to-r from-amber-500 to-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-lg sm:top-4 sm:right-4 sm:gap-1 sm:px-2.5 sm:py-1 sm:text-xs">
          <Crown className="size-2.5 sm:size-3" weight="fill" />
          PRO
        </Badge>

        {/* Conteúdo */}
        <div className="absolute inset-x-0 bottom-0 z-10 p-2.5 sm:p-4 md:p-5">
          <h3 className="mb-1 line-clamp-2 text-xs leading-tight font-bold text-white drop-shadow-lg sm:mb-2 sm:text-base md:text-lg lg:text-xl">
            {module.title}
          </h3>
          <div className="mb-1.5 flex flex-wrap items-center gap-1 sm:mb-3 sm:gap-2">
            <span className="flex items-center gap-1 rounded-md bg-white/20 px-1.5 py-0.5 backdrop-blur-sm sm:rounded-lg sm:px-2.5 sm:py-1">
              <Play
                className="size-2.5 shrink-0 text-white sm:size-3.5"
                weight="fill"
              />
              <span className="text-[10px] font-medium whitespace-nowrap text-white sm:text-xs">
                {module.lessonsCount} aulas
              </span>
            </span>
            <span className="flex items-center gap-1 rounded-md bg-white/20 px-1.5 py-0.5 backdrop-blur-sm sm:rounded-lg sm:px-2.5 sm:py-1">
              <Clock
                className="size-2.5 shrink-0 text-white sm:size-3.5"
                weight="fill"
              />
              <span className="text-[10px] font-medium whitespace-nowrap text-white sm:text-xs">
                {formatDuration(module.totalDuration)}
              </span>
            </span>
          </div>

          {/* CTA de desbloqueio */}
          <span className="flex items-center justify-center gap-1 rounded-lg border border-amber-500/30 bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-2 py-1.5 backdrop-blur-sm sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2">
            <Sparkle
              className="size-3 shrink-0 text-amber-400 sm:size-4"
              weight="fill"
            />
            <span className="truncate text-[10px] font-semibold text-amber-400 sm:text-sm">
              Desbloquear com PRO
            </span>
          </span>
        </div>
      </div>
    </article>
  )
}

/* ============================================================
   SKELETON — espelha o layout real com o kit da marca
   ============================================================ */

function ClassesAcademySkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* Hero */}
      <HeroSkeleton stats={2} viz={<ClassesMarathonHeroVizSkeleton />} />

      {/* Header de módulos + busca */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5">
          <Bone className="size-9 rounded-xl" />
          <div className="flex flex-col gap-1.5">
            <Bone delay={60} className="h-5 w-28" />
            <Bone delay={120} className="h-3.5 w-40 rounded-full" />
          </div>
        </div>
        <Bone delay={180} className="h-10 w-full rounded-xl sm:w-72" />
      </div>

      {/* Carrossel de módulos 9/16 */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Bone
            key={index}
            delay={index * 120}
            className={cn(
              "aspect-[9/16] w-full rounded-3xl",
              index >= 4 && "lg:hidden xl:block",
            )}
          />
        ))}
      </div>

      {/* eBooks */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <Bone className="size-9 rounded-xl" />
          <div className="flex flex-col gap-1.5">
            <Bone delay={60} className="h-5 w-24" />
            <Bone delay={120} className="h-3.5 w-52 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Bone delay={200} className="aspect-[9/16] w-full rounded-3xl" />
        </div>
      </div>

      {/* Conquistas */}
      <div className="glass-card flex flex-col items-center gap-6 rounded-3xl p-6 sm:p-8 lg:flex-row lg:gap-10">
        <div className="flex w-full flex-1 flex-col items-center gap-3 lg:items-start">
          <Bone className="h-8 w-44 rounded-full" />
          <Bone delay={80} className="h-8 w-full max-w-sm" />
          <Bone delay={160} className="h-4 w-full max-w-md rounded-full" />
          <Bone delay={220} className="h-4 w-2/3 max-w-sm rounded-full" />
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="flex flex-col items-center gap-2"
            >
              <Bone delay={index * 120} className="size-15 rounded-2xl sm:size-16" />
              <Bone delay={index * 120 + 60} className="h-6 w-10" />
              <Bone
                delay={index * 120 + 120}
                className="h-2.5 w-14 rounded-full"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Afiliados */}
      <div className="glass-card grid gap-6 rounded-3xl p-5 sm:p-8 lg:grid-cols-2 lg:gap-10 lg:p-10">
        <div className="flex flex-col gap-3.5">
          <Bone className="h-8 w-48 rounded-full" />
          <Bone delay={80} className="h-8 w-full max-w-md" />
          <Bone delay={160} className="h-4 w-full rounded-full" />
          <Bone delay={220} className="h-4 w-4/5 rounded-full" />
          <div className="mt-1 flex flex-col gap-2.5">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Bone delay={280 + index * 80} className="size-9 rounded-lg" />
                <Bone
                  delay={320 + index * 80}
                  className="h-4 w-2/3 max-w-64 rounded-full"
                />
              </div>
            ))}
          </div>
          <Bone delay={560} className="mt-2 h-12 w-full rounded-xl sm:w-52" />
        </div>
        <Bone delay={300} className="h-64 w-full rounded-2xl lg:h-auto" />
      </div>
    </div>
  )
}
