"use client"

import * as React from "react"
import {
  BookOpen,
  CheckCircle,
  Clock,
  Crown,
  Eye,
  Fire,
  Heart,
  Play,
  Pulse,
  ShieldWarning,
  Sparkle,
  Stack,
  TrendUp,
  Trophy,
  UsersThree,
} from "@phosphor-icons/react"

import { LearningCurveHeroViz, LearningCurveHeroVizSkeleton } from "@/components/academy/learning-curve-hero-viz"
import { HomeHero } from "@/components/home/home-hero"
import { StatTile } from "@/components/home/stat-tile"
import { Reveal } from "@/components/shared/reveal"
import {
  Bone,
  ListRowsSkeleton,
  StatTilesGridSkeleton,
} from "@/components/shared/skeletons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { api, type RouterOutputs } from "@/trpc/react"

import { PositionBadge } from "../../competitions/[slug]/shared"

/* ============================================================
   Tipos do contrato
   ============================================================ */

type ReportsData = RouterOutputs["academy"]["getReports"]
type LessonRank = ReportsData["topCompletedLessons"][number]

/* ============================================================
   Helpers
   ============================================================ */

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}min`
  return `${minutes}min`
}

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return "agora"
  if (minutes < 60) return `${minutes}min atrás`
  if (hours < 24) return `${hours}h atrás`
  if (days < 7) return `${days}d atrás`
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
}

/* ============================================================
   Página
   ============================================================ */

export default function Reports() {
  const { data, isLoading, error } = api.academy.getReports.useQuery()

  const stats = data?.stats

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero ===== */}
      <HomeHero
        eyebrow="Clipfy League · Academia"
        title={
          <>
            Métricas & <span className="text-gradient">engajamento</span>
          </>
        }
        subtitle="Dados completos sobre o desempenho da Academia Clipadora"
        viz={<LearningCurveHeroViz />}
        vizSkeleton={<LearningCurveHeroVizSkeleton />}
        isLoading={isLoading}
        stats={[
          {
            icon: <UsersThree className="size-3.5" weight="fill" />,
            label: "Alunos ativos",
            value: stats?.activeStudents ?? 0,
            kind: "int",
          },
          {
            icon: <CheckCircle className="size-3.5" weight="fill" />,
            label: "Conclusões",
            value: stats?.totalCompletions ?? 0,
            kind: "int",
          },
          {
            icon: <Heart className="size-3.5" weight="fill" />,
            label: "Curtidas",
            value: stats?.totalLikes ?? 0,
            kind: "int",
          },
        ]}
      />

      {error ? (
        <Reveal immediate>
          <div className="glass-card flex flex-col items-center gap-4 rounded-3xl px-6 py-16 text-center">
            <span className="flex size-13 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <ShieldWarning className="size-6" weight="fill" />
            </span>
            <div>
              <p className="text-base font-bold">Erro ao carregar métricas</p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
                Não foi possível buscar os dados da Academia agora. Recarregue a
                página ou tente novamente em instantes.
              </p>
            </div>
          </div>
        </Reveal>
      ) : isLoading || !data ? (
        <ReportsSkeleton />
      ) : (
        <ReportsContent data={data} />
      )}
    </div>
  )
}

/* ============================================================
   Conteúdo
   ============================================================ */

function ReportsContent({ data }: { data: ReportsData }) {
  const {
    stats,
    moduleStats,
    topCompletedLessons,
    topLikedLessons,
    topStudents,
    recentActivity,
    recentLikes,
  } = data

  // Cálculo EXATO do original (exibido com clamp em 100)
  const completionRate =
    stats.totalLessons > 0 && stats.activeStudents > 0
      ? Math.round(
          (stats.totalCompletions /
            (stats.publishedLessons * stats.activeStudents)) *
            100,
        )
      : 0

  const maxCompletions = Math.max(
    ...moduleStats.map((mod) => mod.totalCompletions),
    1,
  )

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* ===== KPIs primários ===== */}
      <Reveal immediate>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatTile
            icon={<Stack className="size-4" weight="fill" />}
            label="Módulos"
            value={stats.totalModules}
            kind="int"
            hint={`${stats.publishedModules} publicados${
              stats.draftModules > 0
                ? ` · ${stats.draftModules} rascunhos`
                : ""
            }`}
            accent="cyan"
          />
          <StatTile
            icon={<Play className="size-4" weight="fill" />}
            label="Aulas"
            value={stats.totalLessons}
            kind="int"
            hint={`${stats.publishedLessons} publicadas${
              stats.draftLessons > 0
                ? ` · ${stats.draftLessons} rascunhos`
                : ""
            }`}
            accent="green"
          />
          <CustomStatTile
            icon={<Clock className="size-4" weight="fill" />}
            label="Duração Total"
            value={formatDuration(stats.totalDurationSeconds)}
            footer={
              <span className="text-muted-foreground text-xs">
                de conteúdo disponível
              </span>
            }
          />
          <StatTile
            icon={<UsersThree className="size-4" weight="fill" />}
            label="Alunos Ativos"
            value={stats.activeStudents}
            kind="int"
            hint={`de ${stats.totalStudents} totais`}
            gradientValue
          />
        </div>
      </Reveal>

      {/* ===== KPIs secundários ===== */}
      <Reveal immediate delayMs={60}>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatTile
            icon={<CheckCircle className="size-4" weight="fill" />}
            label="Conclusões"
            value={stats.totalCompletions}
            kind="int"
            hint={`média de ${stats.avgCompletionsPerStudent} por aluno`}
            accent="green"
          />
          <StatTile
            icon={<Heart className="size-4" weight="fill" />}
            label="Curtidas"
            value={stats.totalLikes}
            kind="int"
            hint={
              stats.totalLessons > 0 && stats.publishedLessons > 0
                ? `média de ${(
                    stats.totalLikes / stats.publishedLessons
                  ).toFixed(1)} por aula`
                : "nenhuma aula"
            }
            accent="cyan"
          />
          <CustomStatTile
            icon={<TrendUp className="size-4" weight="fill" />}
            label="Taxa de Conclusão"
            value={`${Math.min(completionRate, 100)}%`}
            footer={
              <Progress
                value={Math.min(completionRate, 100)}
                className="h-1.5"
              />
            }
          />
          <CustomStatTile
            icon={<Fire className="size-4" weight="fill" />}
            label="Engajamento"
            value={
              stats.activeStudents > 0
                ? (
                    (stats.totalCompletions + stats.totalLikes) /
                    stats.activeStudents
                  ).toFixed(1)
                : "0"
            }
            footer={
              <span className="text-muted-foreground text-xs">
                interações por aluno ativo
              </span>
            }
          />
        </div>
      </Reveal>

      {/* ===== Desempenho por módulo ===== */}
      <Reveal immediate delayMs={100}>
        <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
          <CardHeading
            icon={<Stack className="size-4" weight="fill" />}
            title="Desempenho por Módulo"
            description="Engajamento e progresso em cada módulo do curso"
            aside={
              moduleStats.length > 0 ? (
                <Badge variant="outline" className="rounded-full">
                  {moduleStats.length}{" "}
                  {moduleStats.length === 1 ? "módulo" : "módulos"}
                </Badge>
              ) : undefined
            }
          />

          {moduleStats.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <BookOpen className="text-muted-foreground/40 size-10" />
              <p className="text-muted-foreground text-sm">
                Nenhum módulo cadastrado
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {moduleStats.map((mod, index) => (
                <div
                  key={mod.id}
                  className="border-border/60 bg-muted/20 hover:bg-muted/30 flex flex-col gap-3 rounded-2xl border p-3.5 transition-colors sm:p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <PositionBadge position={index + 1} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold">
                            {mod.title}
                          </p>
                          {!mod.isPublished && (
                            <Badge
                              variant="outline"
                              className="shrink-0 rounded-full border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
                            >
                              Rascunho
                            </Badge>
                          )}
                        </div>
                        <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <span className="inline-flex items-center gap-1">
                            <Play className="size-3" weight="fill" />
                            {mod.publishedLessons}/{mod.totalLessons} aulas
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3" weight="fill" />
                            {formatDuration(mod.totalDurationSeconds)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 pl-12 sm:gap-6 sm:pl-0">
                      <ModuleMetric
                        value={mod.totalCompletions}
                        label="Conclusões"
                        className="text-emerald-600 dark:text-emerald-400"
                      />
                      <ModuleMetric
                        value={mod.totalLikes}
                        label="Curtidas"
                        className="text-pink-600 dark:text-pink-400"
                      />
                      <ModuleMetric
                        value={mod.avgCompletionsPerLesson}
                        label="Média/aula"
                        className="text-blue-600 dark:text-blue-400"
                      />
                    </div>
                  </div>

                  {/* barra proporcional ao módulo com mais conclusões */}
                  <div className="bg-muted/60 h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--brand-cyan)] to-[var(--brand-mint)] transition-[width] duration-700 ease-out not-dark:from-[#089eb8] not-dark:to-[#0eb981]"
                      style={{
                        width: `${(mod.totalCompletions / maxCompletions) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Reveal>

      {/* ===== Rankings & atividade (tabs) ===== */}
      <Reveal immediate delayMs={140}>
        <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
          <CardHeading
            icon={<Trophy className="size-4" weight="fill" />}
            title="Rankings & Atividade"
            description="Top aulas, alunos e interações recentes"
          />

          <Tabs defaultValue="top-lessons">
            <TabsList className="bg-muted/40 grid h-auto w-full grid-cols-3 gap-1 rounded-2xl p-1">
              <TabsTrigger
                value="top-lessons"
                className="cursor-pointer gap-1.5 rounded-full px-2 py-2 text-xs font-semibold"
              >
                <Trophy className="size-3.5" weight="fill" />
                <span className="hidden sm:inline">Top Aulas</span>
                <span className="sm:hidden">Aulas</span>
              </TabsTrigger>
              <TabsTrigger
                value="top-students"
                className="cursor-pointer gap-1.5 rounded-full px-2 py-2 text-xs font-semibold"
              >
                <Crown className="size-3.5" weight="fill" />
                <span className="hidden sm:inline">Top Alunos</span>
                <span className="sm:hidden">Alunos</span>
              </TabsTrigger>
              <TabsTrigger
                value="activity"
                className="cursor-pointer gap-1.5 rounded-full px-2 py-2 text-xs font-semibold"
              >
                <Pulse className="size-3.5" weight="fill" />
                <span className="hidden sm:inline">Atividade Recente</span>
                <span className="sm:hidden">Atividade</span>
              </TabsTrigger>
            </TabsList>

            {/* ---- Tab: Top Aulas ---- */}
            <TabsContent value="top-lessons" className="mt-5">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <TopLessonsCard
                  title="Mais Completadas"
                  description="Aulas com mais conclusões"
                  icon={<CheckCircle className="size-4" weight="fill" />}
                  iconClass="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  lessons={topCompletedLessons}
                  primary="completed"
                  emptyText="Nenhuma conclusão registrada"
                />
                <TopLessonsCard
                  title="Mais Curtidas"
                  description="Aulas favoritas dos alunos"
                  icon={<Heart className="size-4" weight="fill" />}
                  iconClass="bg-pink-500/15 text-pink-600 dark:text-pink-400"
                  lessons={topLikedLessons}
                  primary="liked"
                  emptyText="Nenhuma curtida registrada"
                />
              </div>
            </TabsContent>

            {/* ---- Tab: Top Alunos ---- */}
            <TabsContent value="top-students" className="mt-5">
              <div className="border-border/60 bg-muted/10 flex flex-col gap-4 rounded-2xl border p-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <Crown className="size-4" weight="fill" />
                  </span>
                  <div className="leading-tight">
                    <h3 className="text-sm font-bold sm:text-base">
                      Top 10 Alunos Mais Ativos
                    </h3>
                    <p className="text-muted-foreground text-xs">
                      Alunos que mais completaram aulas
                    </p>
                  </div>
                </div>

                {topStudents.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <UsersThree className="text-muted-foreground/40 size-10" />
                    <p className="text-muted-foreground text-sm">
                      Nenhum aluno registrado
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {topStudents.map((student, index) => {
                      const maxCompleted =
                        topStudents[0]?.completedLessons ?? 1
                      const barWidth =
                        (student.completedLessons / Math.max(maxCompleted, 1)) *
                        100
                      const progressPercent =
                        stats.publishedLessons > 0
                          ? Math.round(
                              (student.completedLessons /
                                stats.publishedLessons) *
                                100,
                            )
                          : 0

                      return (
                        <div
                          key={student.userId}
                          className="hover:bg-muted/30 relative flex items-center gap-3 overflow-hidden rounded-xl p-3 transition-colors"
                        >
                          <PositionBadge position={index + 1} />

                          <Avatar className="border-border/50 size-9 shrink-0 border">
                            <AvatarImage src={student.imageUrl ?? undefined} />
                            <AvatarFallback className="bg-gradient-custom text-xs font-semibold text-[#04222A]">
                              {student.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold">
                                {student.name}
                              </p>
                              {index < 3 && (
                                <Sparkle
                                  className="size-3.5 shrink-0 text-amber-500 dark:text-amber-400"
                                  weight="fill"
                                />
                              )}
                            </div>
                            <p className="text-muted-foreground truncate text-[11px]">
                              {student.email}
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            <div className="text-sm font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                              {student.completedLessons}
                            </div>
                            <div className="text-muted-foreground text-[10px]">
                              aulas ({Math.min(progressPercent, 100)}%)
                            </div>
                          </div>

                          {/* barra de progresso na base da linha */}
                          <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-cyan)_45%,transparent)] to-[color-mix(in_oklab,var(--brand-mint)_45%,transparent)]"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ---- Tab: Atividade Recente ---- */}
            <TabsContent value="activity" className="mt-5">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ActivityCard
                  title="Conclusões Recentes"
                  description="Últimas aulas completadas"
                  tone="emerald"
                  verb="completou"
                  emptyText="Nenhuma atividade registrada"
                  items={recentActivity.map((activity) => ({
                    userName: activity.userName,
                    userImage: activity.userImage,
                    lessonTitle: activity.lessonTitle,
                    moduleTitle: activity.moduleTitle,
                    at: activity.completedAt,
                  }))}
                />
                <ActivityCard
                  title="Curtidas Recentes"
                  description="Últimas aulas curtidas"
                  tone="pink"
                  verb="curtiu"
                  emptyText="Nenhuma curtida registrada"
                  items={recentLikes.map((like) => ({
                    userName: like.userName,
                    userImage: like.userImage,
                    lessonTitle: like.lessonTitle,
                    moduleTitle: like.moduleTitle,
                    at: like.likedAt,
                  }))}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </Reveal>
    </div>
  )
}

/* ============================================================
   Componentes da identidade
   ============================================================ */

function CardHeading({
  icon,
  title,
  description,
  aside,
}: {
  icon: React.ReactNode
  title: string
  description?: string
  aside?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="flex items-center gap-2.5">
        <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
          {icon}
        </span>
        <div className="leading-tight">
          <h2 className="text-base font-bold tracking-tight sm:text-lg">
            {title}
          </h2>
          {description && (
            <p className="text-muted-foreground text-xs sm:text-[13px]">
              {description}
            </p>
          )}
        </div>
      </div>
      {aside}
    </div>
  )
}

/** Tile no formato do StatTile para valores não-numéricos/custom. */
function CustomStatTile({
  icon,
  label,
  value,
  footer,
}: {
  icon: React.ReactNode
  label: string
  value: string
  footer?: React.ReactNode
}) {
  return (
    <div className="glass-card glass-card-hover flex flex-col gap-3 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
          {label}
        </span>
        <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
          {icon}
        </span>
      </div>
      <span className="text-2xl font-bold tracking-tight tabular-nums sm:text-[1.7rem]">
        {value}
      </span>
      {footer}
    </div>
  )
}

/** Métrica compacta das linhas de módulo (valor colorido + label). */
function ModuleMetric({
  value,
  label,
  className,
}: {
  value: number
  label: string
  className?: string
}) {
  return (
    <div className="text-center">
      <div className={cn("text-sm font-bold tabular-nums", className)}>
        {value.toLocaleString("pt-BR")}
      </div>
      <div className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
        {label}
      </div>
    </div>
  )
}

/** Ranking de aulas (mais completadas/mais curtidas) com medalhas 1–3. */
function TopLessonsCard({
  title,
  description,
  icon,
  iconClass,
  lessons,
  primary,
  emptyText,
}: {
  title: string
  description: string
  icon: React.ReactNode
  iconClass: string
  lessons: LessonRank[]
  primary: "completed" | "liked"
  emptyText: string
}) {
  return (
    <div className="border-border/60 bg-muted/10 flex flex-col gap-4 rounded-2xl border p-4">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            iconClass,
          )}
        >
          {icon}
        </span>
        <div className="leading-tight">
          <h3 className="text-sm font-bold sm:text-base">{title}</h3>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
      </div>

      {lessons.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          {emptyText}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {lessons.map((lesson, index) => {
            const completedBadge = (
              <Badge
                variant="outline"
                className="gap-1 rounded-full border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-600 dark:text-emerald-400"
              >
                <Eye className="size-2.5" weight="fill" />
                {lesson.completedCount}
              </Badge>
            )
            const likedBadge = (
              <Badge
                variant="outline"
                className="gap-1 rounded-full border-pink-500/30 bg-pink-500/10 px-1.5 text-[10px] text-pink-600 dark:text-pink-400"
              >
                <Heart className="size-2.5" weight="fill" />
                {lesson.likesCount}
              </Badge>
            )

            return (
              <div
                key={lesson.id}
                className="hover:bg-muted/30 flex items-center gap-3 rounded-xl p-2 transition-colors"
              >
                <PositionBadge position={index + 1} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{lesson.title}</p>
                  <p className="text-muted-foreground truncate text-[11px]">
                    {lesson.moduleTitle}
                    {lesson.duration
                      ? ` • ${formatDuration(lesson.duration)}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {primary === "completed" ? (
                    <>
                      {completedBadge}
                      {lesson.likesCount > 0 && likedBadge}
                    </>
                  ) : (
                    <>
                      {likedBadge}
                      {lesson.completedCount > 0 && completedBadge}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Feed de atividade recente ("{aluno} completou/curtiu {aula}"). */
function ActivityCard({
  title,
  description,
  tone,
  verb,
  items,
  emptyText,
}: {
  title: string
  description: string
  tone: "emerald" | "pink"
  verb: string
  items: {
    userName: string
    userImage: string | null
    lessonTitle: string
    moduleTitle: string
    at: string
  }[]
  emptyText: string
}) {
  const toneText =
    tone === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-pink-600 dark:text-pink-400"
  const toneChip =
    tone === "emerald" ? "bg-emerald-500/15" : "bg-pink-500/15"
  const ToneIcon = tone === "emerald" ? CheckCircle : Heart

  return (
    <div className="border-border/60 bg-muted/10 flex flex-col gap-4 rounded-2xl border p-4">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            toneChip,
            toneText,
          )}
        >
          <ToneIcon className="size-4" weight="fill" />
        </span>
        <div className="leading-tight">
          <h3 className="text-sm font-bold sm:text-base">{title}</h3>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          {emptyText}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {items.map((item, index) => (
            <div
              key={index}
              className="hover:bg-muted/30 flex items-center gap-3 rounded-xl p-2 transition-colors"
            >
              <Avatar className="border-border/50 size-8 shrink-0 border">
                <AvatarImage src={item.userImage ?? undefined} />
                <AvatarFallback
                  className={cn("text-[10px] font-semibold", toneChip, toneText)}
                >
                  {item.userName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs">
                  <span className="text-foreground font-semibold">
                    {item.userName}
                  </span>{" "}
                  <span className="text-muted-foreground">{verb}</span>{" "}
                  <span className={cn("font-medium", toneText)}>
                    {item.lessonTitle}
                  </span>
                </p>
                <p className="text-muted-foreground text-[10px]">
                  {item.moduleTitle} • {formatTimeAgo(item.at)}
                </p>
              </div>
              <ToneIcon
                className={cn("size-4 shrink-0 opacity-50", toneText)}
                weight="fill"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ============================================================
   Skeleton (kit da marca, espelhando o layout real)
   ============================================================ */

function ReportsSkeleton() {
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* KPIs primários + secundários */}
      <StatTilesGridSkeleton className="xl:grid-cols-4" />
      <StatTilesGridSkeleton className="xl:grid-cols-4" />

      {/* Desempenho por módulo */}
      <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
        <div className="flex items-center gap-2.5">
          <Bone className="size-8 rounded-lg" />
          <div className="flex flex-col gap-1.5">
            <Bone delay={60} className="h-4 w-44 sm:w-52" />
            <Bone delay={120} className="h-3 w-36 rounded-full sm:w-64" />
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="border-border/60 bg-muted/10 flex flex-col gap-3 rounded-2xl border p-3.5 sm:p-4"
            >
              <div className="flex items-center gap-3">
                <Bone delay={index * 100} className="size-9 shrink-0 rounded-xl" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Bone
                    delay={index * 100 + 40}
                    className="h-3.5 w-1/2 max-w-52"
                  />
                  <Bone
                    delay={index * 100 + 80}
                    className="h-3 w-1/3 max-w-36 rounded-full"
                  />
                </div>
                <div className="hidden items-center gap-6 sm:flex">
                  {Array.from({ length: 3 }).map((_, statIndex) => (
                    <div
                      key={statIndex}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <Bone
                        delay={index * 100 + 120 + statIndex * 40}
                        className="h-3.5 w-8"
                      />
                      <Bone
                        delay={index * 100 + 140 + statIndex * 40}
                        className="h-2.5 w-14 rounded-full"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <Bone
                delay={index * 100 + 240}
                className="h-1.5 w-full rounded-full"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Rankings & atividade */}
      <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
        <div className="flex items-center gap-2.5">
          <Bone className="size-8 rounded-lg" />
          <div className="flex flex-col gap-1.5">
            <Bone delay={60} className="h-4 w-44" />
            <Bone delay={120} className="h-3 w-36 rounded-full sm:w-56" />
          </div>
        </div>
        <Bone delay={160} className="h-11 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ListRowsSkeleton rows={5} />
          <ListRowsSkeleton rows={5} className="hidden lg:flex" />
        </div>
      </div>
    </div>
  )
}
