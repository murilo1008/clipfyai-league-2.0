"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useClerk, useUser } from "@clerk/nextjs"
import {
  ArrowClockwise,
  ArrowRight,
  CheckCircle,
  Clock,
  EnvelopeSimple,
  Lightning,
  ShieldCheck,
  SignOut,
  Sparkle,
  Star,
  Trophy,
  Users,
  WarningCircle,
  XCircle,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react"

import { DiscordIcon } from "@/components/icons/discord-icon"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { api } from "@/trpc/react"
import { cn } from "@/lib/utils"

/** Posições fixas das partículas de status (determinístico — sem hydration drift). */
const PARTICLES = [
  { top: "12%", left: "8%" },
  { top: "22%", left: "86%" },
  { top: "48%", left: "5%" },
  { top: "64%", left: "92%" },
  { top: "82%", left: "16%" },
  { top: "88%", left: "72%" },
]

interface StatusStep {
  text: string
  icon: PhosphorIcon
}

export default function Approve() {
  const { user, isLoaded } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { data: userData } = api.user.getCurrentUser.useQuery()
  const {
    data: verificationData,
    isLoading,
    refetch,
  } = api.user.getVerificationStatus.useQuery(undefined, {
    refetchInterval: 10000,
  })

  // Redirecionar se não está logado
  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/sign-in")
    }
  }, [isLoaded, user, router])

  // Redirecionar se não completou onboarding
  useEffect(() => {
    if (userData && !userData.onboardingCompleted) {
      router.push("/onboarding")
    }
  }, [userData, router])

  // Redirecionar para dashboard se verificado
  useEffect(() => {
    if (verificationData?.verificationStatus === "VERIFIED") {
      setTimeout(() => {
        router.push("/")
      }, 3000)
    }
  }, [verificationData, router])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refetch()
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  // ===== Loading — espera bonita na identidade da marca =====
  if (!isLoaded || isLoading) {
    return (
      <div className="dashboard-galaxy relative flex min-h-svh items-center justify-center overflow-hidden p-4">
        <div className="bg-grid-pattern pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_64%_56%_at_50%_46%,black_28%,transparent_100%)]" />

        {/* Auroras em deriva */}
        <span
          aria-hidden
          className="arena-aurora not-dark:bg-[color-mix(in_oklab,var(--primary)_9%,transparent)] pointer-events-none absolute -top-32 -left-24 size-[24rem] rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_13%,transparent)] blur-3xl sm:size-[30rem]"
        />
        <span
          aria-hidden
          className="arena-aurora pointer-events-none absolute -right-28 -bottom-36 size-[24rem] rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_9%,transparent)] blur-3xl not-dark:bg-[color-mix(in_oklab,var(--primary)_6%,transparent)] sm:size-[30rem]"
          style={{ animationDelay: "-6s" }}
        />

        <div className="relative z-10 space-y-8 text-center">
          {/* Órbitas + núcleo */}
          <div className="relative inline-flex items-center justify-center">
            <span
              aria-hidden
              className="border-brand-cyan/20 not-dark:border-primary/20 absolute size-32 animate-ping rounded-full border-4"
              style={{ animationDuration: "2.5s" }}
            />
            <span
              aria-hidden
              className="border-t-brand-cyan not-dark:border-t-primary absolute size-24 animate-spin rounded-full border-4 border-r-transparent border-l-transparent"
              style={{
                animationDuration: "1.5s",
                borderBottomColor: "var(--brand-green)",
              }}
            />
            <span
              aria-hidden
              className="border-r-brand-mint border-l-brand-mint absolute size-16 animate-spin rounded-full border-4 border-t-transparent border-b-transparent not-dark:border-r-[#0eb981] not-dark:border-l-[#0eb981]"
              style={{ animationDuration: "1s", animationDirection: "reverse" }}
            />
            <span className="bg-gradient-custom shadow-brand-cyan/30 relative flex size-12 animate-pulse items-center justify-center rounded-full shadow-lg">
              <Sparkle
                className="size-6 animate-spin text-[#04222A]"
                weight="fill"
                style={{ animationDuration: "3s" }}
              />
            </span>
          </div>

          <div className="animate-fade-in space-y-3">
            <h2 className="text-gradient text-2xl font-bold not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
              Carregando...
            </h2>
            <div className="flex items-center justify-center gap-1">
              <span className="bg-brand-cyan not-dark:bg-primary size-2 animate-bounce rounded-full" />
              <span
                className="bg-brand-mint not-dark:bg-primary/80 size-2 animate-bounce rounded-full"
                style={{ animationDelay: "0.1s" }}
              />
              <span
                className="bg-brand-green size-2 animate-bounce rounded-full not-dark:bg-[#0eb981]"
                style={{ animationDelay: "0.2s" }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const getStatusConfig = () => {
    switch (verificationData?.verificationStatus) {
      case "PENDING":
        return {
          icon: Clock,
          iconBg: "from-amber-500 to-orange-500",
          glowColor: "shadow-amber-500/50",
          cardBg: "from-amber-500/10 via-orange-500/5 to-transparent",
          borderColor: "border-amber-500/30",
          particleColor: "bg-amber-500",
          title: "Em Análise",
          subtitle: "Sua aplicação está sendo revisada",
          emoji: "⏰",
          badge: {
            text: "Pendente",
            className:
              "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30 animate-pulse",
          },
          steps: [
            { text: "Revisando perfil e portfólio", icon: Lightning },
            { text: "Análise em até 48 horas", icon: Clock },
            { text: "Notificação por e-mail", icon: EnvelopeSimple },
          ] satisfies StatusStep[],
        }
      case "VERIFIED":
        return {
          icon: CheckCircle,
          iconBg: "from-green-500 to-emerald-500",
          glowColor: "shadow-green-500/50",
          cardBg: "from-green-500/10 via-emerald-500/5 to-transparent",
          borderColor: "border-green-500/30",
          particleColor: "bg-green-500",
          title: "Aprovado!",
          subtitle: "Bem-vindo à Clipfy League",
          emoji: "🎉",
          badge: {
            text: "Aprovado",
            className:
              "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30 animate-pulse",
          },
          steps: [
            { text: "Redirecionando...", icon: ArrowRight },
            { text: "Explore competições", icon: Trophy },
            { text: "Conquiste o topo!", icon: Star },
          ] satisfies StatusStep[],
        }
      case "REJECTED":
        return {
          icon: XCircle,
          iconBg: "from-red-500 to-pink-500",
          glowColor: "shadow-red-500/50",
          cardBg: "from-red-500/10 via-pink-500/5 to-transparent",
          borderColor: "border-red-500/30",
          particleColor: "bg-red-500",
          title: "Não Aprovado",
          subtitle: "Sua aplicação não foi aprovada",
          emoji: "😔",
          badge: {
            text: "Rejeitado",
            className:
              "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
          },
          steps: [
            { text: "E-mail com detalhes enviado", icon: EnvelopeSimple },
            { text: "Revise seu perfil", icon: WarningCircle },
            { text: "Tente novamente", icon: ArrowClockwise },
          ] satisfies StatusStep[],
        }
      default:
        return {
          icon: WarningCircle,
          iconBg: "from-gray-500 to-slate-500",
          glowColor: "shadow-gray-500/50",
          cardBg: "from-gray-500/10 via-slate-500/5 to-transparent",
          borderColor: "border-gray-500/30",
          particleColor: "bg-gray-500",
          title: "Não Enviado",
          subtitle: "Complete o onboarding",
          emoji: "📝",
          badge: {
            text: "Pendente",
            className:
              "bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/30",
          },
          steps: [
            { text: "Complete o onboarding", icon: WarningCircle },
            { text: "Preencha informações", icon: Sparkle },
            { text: "Envie aplicação", icon: ArrowRight },
          ] satisfies StatusStep[],
        }
    }
  }

  const config = getStatusConfig()
  const StatusIcon = config.icon
  const displayName =
    verificationData?.artisticName ||
    verificationData?.fullName ||
    user?.fullName ||
    "Clipador"

  return (
    <div className="dashboard-galaxy relative flex min-h-svh items-center justify-center overflow-hidden p-4 py-8 sm:py-12">
      {/* ===== Ambiente galaxy da marca ===== */}
      <div className="bg-grid-pattern pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_64%_56%_at_50%_46%,black_28%,transparent_100%)]" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <span className="arena-aurora not-dark:bg-[color-mix(in_oklab,var(--primary)_8%,transparent)] absolute -top-24 -left-24 size-[22rem] rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_11%,transparent)] blur-3xl sm:size-[30rem]" />
        <span
          className="arena-aurora absolute -right-28 -bottom-32 size-[24rem] rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_8%,transparent)] blur-3xl not-dark:bg-[color-mix(in_oklab,var(--primary)_5%,transparent)] sm:size-[32rem]"
          style={{ animationDelay: "-7s" }}
        />

        {/* Partículas na cor do status */}
        {PARTICLES.map((pos, i) => (
          <span
            key={i}
            className={cn(
              "absolute size-2 animate-ping rounded-full opacity-20",
              config.particleColor,
            )}
            style={{
              top: pos.top,
              left: pos.left,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${2 + i * 0.5}s`,
            }}
          />
        ))}
      </div>

      {/* ===== Card principal ===== */}
      <Card className="glass-card animate-scale-in relative z-10 w-full max-w-lg rounded-3xl border-0 py-0 shadow-2xl">
        <CardContent className="p-5 sm:p-8">
          {/* Header */}
          <div className="animate-fade-in-down mb-6 text-center">
            <div
              className="text-muted-foreground animate-fade-in mb-3 inline-flex items-center gap-2 text-xs sm:text-sm"
              style={{ animationDelay: "0.1s" }}
            >
              <Sparkle
                className="text-brand-cyan not-dark:text-primary size-3 animate-pulse sm:size-4"
                weight="fill"
              />
              <span>Olá, {displayName}</span>
            </div>
            <h1
              className="animate-fade-in text-xl font-bold sm:text-2xl"
              style={{ animationDelay: "0.2s" }}
            >
              Status da <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">Aplicação</span>
            </h1>
          </div>

          {/* Status Card */}
          <div
            className={cn(
              "animate-scale-in mb-6 rounded-2xl border bg-gradient-to-br p-6 transition-transform hover:scale-[1.02]",
              config.cardBg,
              config.borderColor,
            )}
            style={{ animationDelay: "0.3s" }}
          >
            <div className="flex flex-col items-center space-y-4 text-center">
              {/* Ícone com anel orbital */}
              <div className="relative">
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-0 animate-spin rounded-full border-2 border-dashed",
                    config.borderColor,
                  )}
                  style={{ animationDuration: "3s" }}
                />
                <div
                  className={cn(
                    "relative flex size-16 animate-pulse items-center justify-center rounded-full bg-gradient-to-br shadow-lg",
                    config.iconBg,
                    config.glowColor,
                  )}
                >
                  <StatusIcon className="size-8 text-white" weight="fill" />
                </div>
              </div>

              {/* Badge */}
              <Badge
                variant="outline"
                className={cn(
                  "animate-fade-in-up px-3 py-1 text-xs",
                  config.badge.className,
                )}
                style={{ animationDelay: "0.5s" }}
              >
                {config.badge.text}
              </Badge>

              {/* Título & emoji */}
              <div
                className="animate-fade-in-up space-y-2"
                style={{ animationDelay: "0.6s" }}
              >
                <div
                  className="animate-bounce text-3xl"
                  style={{ animationDuration: "2s" }}
                >
                  {config.emoji}
                </div>
                <h2 className="text-xl font-bold sm:text-2xl">{config.title}</h2>
                <p className="text-muted-foreground text-sm">{config.subtitle}</p>
              </div>
            </div>
          </div>

          {/* Próximos passos */}
          <div
            className="animate-fade-in-up mb-6 space-y-3"
            style={{ animationDelay: "0.7s" }}
          >
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <WarningCircle className="text-primary size-4 animate-pulse" weight="fill" />
              Próximos Passos
            </h3>
            <div className="space-y-2">
              {config.steps.map((step, index) => {
                const StepIcon = step.icon
                return (
                  <div
                    key={index}
                    className="animate-fade-in-up flex items-start gap-2 text-sm transition-transform hover:translate-x-1"
                    style={{ animationDelay: `${0.8 + index * 0.1}s` }}
                  >
                    <span className="bg-gradient-custom mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full shadow-sm">
                      <StepIcon className="size-3 text-[#04222A]" weight="bold" />
                    </span>
                    <span className="text-muted-foreground leading-relaxed">
                      {step.text}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Ações */}
          <div
            className="animate-fade-in-up space-y-3"
            style={{ animationDelay: "1s" }}
          >
            {verificationData?.verificationStatus === "VERIFIED" ? (
              <Button
                onClick={() => router.push("/")}
                size="lg"
                className="btn-gradient-auth h-12 w-full animate-pulse gap-2 rounded-xl font-semibold shadow-[0_8px_30px_-8px_rgba(20,247,254,0.45)]"
              >
                <ArrowRight className="size-4" weight="bold" />
                Ir para Dashboard
              </Button>
            ) : verificationData?.verificationStatus === "REJECTED" ? (
              <Button
                onClick={() => (window.location.href = "mailto:support@clipfyai.com")}
                variant="outline"
                size="lg"
                className="h-12 w-full gap-2 rounded-xl"
              >
                <EnvelopeSimple className="size-4" />
                Contatar Suporte
              </Button>
            ) : verificationData?.verificationStatus === "UNVERIFIED" ? (
              <Button
                onClick={() => router.push("/onboarding")}
                size="lg"
                className="btn-gradient-auth h-12 w-full gap-2 rounded-xl font-semibold"
              >
                <ArrowRight className="size-4" weight="bold" />
                Ir para Onboarding
              </Button>
            ) : null}

            {/* Recarregar Página */}
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="lg"
              className="group h-12 w-full gap-2 rounded-xl"
              disabled={isRefreshing}
            >
              <ArrowClockwise
                className={cn(
                  "size-4",
                  isRefreshing
                    ? "animate-spin"
                    : "transition-transform duration-500 group-hover:rotate-180",
                )}
              />
              {isRefreshing ? "Recarregando..." : "Recarregar Página"}
            </Button>
          </div>

          {/* Comunidade Discord — OBRIGATÓRIO */}
          <div
            className="animate-scale-in relative mt-6 overflow-hidden rounded-2xl border-2 border-indigo-500/40 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent p-4 transition-transform hover:scale-[1.02] sm:p-5"
            style={{ animationDelay: "1.1s" }}
          >
            {/* Badge Obrigatório */}
            <div className="absolute top-3 right-3">
              <Badge className="animate-pulse gap-1 border-red-500/40 bg-red-500/20 text-red-700 dark:text-red-400">
                <ShieldCheck className="size-3" weight="fill" />
                OBRIGATÓRIO
              </Badge>
            </div>

            <div className="mb-4 flex items-start gap-3 sm:gap-4">
              <span className="flex size-12 shrink-0 animate-pulse items-center justify-center rounded-2xl bg-gradient-to-br from-[#5865F2] to-[#7289DA] shadow-lg shadow-indigo-500/50 sm:size-14">
                <DiscordIcon className="size-6 text-white sm:size-7" />
              </span>
              <div className="min-w-0 flex-1 pr-16">
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="text-base font-bold sm:text-lg">
                    Comunidade Discord
                  </h3>
                  <Badge
                    variant="outline"
                    className="border-indigo-500/30 bg-indigo-500/20 px-1.5 py-0 text-[10px] text-indigo-700 dark:text-indigo-300"
                  >
                    Discord
                  </Badge>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed sm:text-sm">
                  Entre no nosso servidor oficial do Discord.{" "}
                  <span className="font-bold text-red-500">
                    A participação é obrigatória
                  </span>{" "}
                  para competir e receber atualizações importantes.
                </p>
              </div>
            </div>

            {/* Benefícios */}
            <div className="mb-4 space-y-2">
              {(
                [
                  { icon: ShieldCheck, text: "Acesso obrigatório às competições" },
                  { icon: Trophy, text: "Anúncios de rankings e premiações" },
                  { icon: Sparkle, text: "Suporte direto da equipe Clipfy" },
                  { icon: Users, text: "Comunidade ativa de clipadores" },
                ] satisfies StatusStep[]
              ).map((benefit, index) => {
                const BenefitIcon = benefit.icon
                return (
                  <div
                    key={index}
                    className="animate-fade-in-up flex items-center gap-2 text-xs sm:text-sm"
                    style={{ animationDelay: `${1.2 + index * 0.1}s` }}
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#5865F2] to-[#7289DA] sm:size-5">
                      <BenefitIcon
                        className="size-2.5 text-white sm:size-3"
                        weight="fill"
                      />
                    </span>
                    <span className="text-muted-foreground">{benefit.text}</span>
                  </div>
                )
              })}
            </div>

            {/* CTA */}
            <Button
              onClick={() => window.open("https://discord.gg/f2eNVbYnzn", "_blank")}
              className="h-12 w-full gap-2 rounded-xl bg-gradient-to-r from-[#5865F2] to-[#7289DA] text-white shadow-lg hover:from-[#4752C4] hover:to-[#5B6EAE] hover:shadow-xl"
              size="lg"
            >
              <DiscordIcon className="size-4" />
              Entrar no Discord (Obrigatório)
              <ArrowRight className="size-4" weight="bold" />
            </Button>

            {/* Alerta */}
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <WarningCircle
                className="mt-0.5 size-4 shrink-0 text-red-500"
                weight="fill"
              />
              <p className="text-xs text-red-600 dark:text-red-400">
                <span className="font-bold">Atenção:</span> Você deve estar no
                servidor Discord para participar de qualquer competição. Sem isso,
                sua participação será invalidada.
              </p>
            </div>
          </div>

          {/* Email Info */}
          {verificationData?.verificationStatus === "PENDING" && (
            <div
              className="bg-muted/50 animate-scale-in mt-4 rounded-xl p-4 text-center"
              style={{ animationDelay: "1.6s" }}
            >
              <EnvelopeSimple className="text-muted-foreground mx-auto mb-2 size-6 animate-pulse" />
              <p className="text-muted-foreground text-xs">
                Notificação em{" "}
                <span className="text-foreground font-semibold">
                  {user?.primaryEmailAddress?.emailAddress}
                </span>
              </p>
            </div>
          )}

          {/* Sair da conta */}
          <div
            className="animate-fade-in-up mt-5 text-center"
            style={{ animationDelay: "1.7s" }}
          >
            <button
              type="button"
              onClick={() => signOut({ redirectUrl: "/sign-in" })}
              className="text-muted-foreground/70 hover:text-foreground inline-flex items-center gap-1.5 text-xs transition-colors"
            >
              <SignOut className="size-3.5" />
              Sair da conta
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
