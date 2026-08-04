"use client"

import { useEffect, useState } from "react"
import { useClerk, useUser } from "@clerk/nextjs"
import {
  ChatCircle,
  EnvelopeSimple,
  FileX,
  Fire,
  LockSimple,
  Prohibit,
  ShieldSlash,
  SignOut,
  Skull,
  Warning,
  WarningOctagon,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react"

import { Logo } from "@/components/logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

/** Ícones-fantasma de alerta flutuando ao fundo (posições fixas — determinístico). */
const FLOATING_WARNINGS: Array<{
  icon: PhosphorIcon
  position: string
  color: string
  size: string
  opacity: string
  delay: string
}> = [
  {
    icon: Prohibit,
    position: "top-[15%] left-[8%]",
    color: "text-red-500",
    size: "size-10 sm:size-16",
    opacity: "opacity-[0.06]",
    delay: "0s",
  },
  {
    icon: Skull,
    position: "top-[25%] right-[10%]",
    color: "text-red-600",
    size: "size-8 sm:size-12",
    opacity: "opacity-[0.05]",
    delay: "1s",
  },
  {
    icon: Fire,
    position: "bottom-[20%] left-[12%]",
    color: "text-orange-500",
    size: "size-9 sm:size-14",
    opacity: "opacity-[0.06]",
    delay: "2s",
  },
  {
    icon: WarningOctagon,
    position: "bottom-[30%] right-[8%]",
    color: "text-red-500",
    size: "size-8 sm:size-12",
    opacity: "opacity-[0.05]",
    delay: "1.5s",
  },
  {
    icon: LockSimple,
    position: "top-[60%] left-[5%]",
    color: "text-red-700",
    size: "size-7 sm:size-10",
    opacity: "opacity-[0.04]",
    delay: "0.5s",
  },
]

/** Posições fixas das partículas vermelhas. */
const PARTICLES = [
  { top: "18%", left: "22%" },
  { top: "32%", left: "78%" },
  { top: "46%", left: "10%" },
  { top: "58%", left: "88%" },
  { top: "70%", left: "30%" },
  { top: "78%", left: "64%" },
  { top: "24%", left: "52%" },
  { top: "84%", left: "14%" },
]

export default function Banned() {
  const { user, isLoaded } = useUser()
  const { signOut } = useClerk()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isLoaded || !mounted) {
    return (
      <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-gradient-to-br from-[#050f1c] via-red-950/20 to-[#050f1c] p-4 not-dark:from-background not-dark:via-red-500/5 not-dark:to-background">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 size-72 animate-pulse rounded-full bg-red-500/10 blur-3xl" />
          <div
            className="absolute right-1/4 bottom-1/4 size-96 animate-pulse rounded-full bg-red-900/10 blur-3xl"
            style={{ animationDelay: "1s" }}
          />
        </div>
        <div className="relative z-10 space-y-6 text-center">
          <div className="relative inline-flex items-center justify-center">
            <span
              className="absolute size-24 animate-spin rounded-full border-4 border-red-500/30 border-t-transparent"
              style={{ animationDuration: "2s" }}
            />
            <span className="relative flex size-14 animate-pulse items-center justify-center rounded-full bg-gradient-to-br from-red-600 to-red-900 shadow-lg shadow-red-500/40">
              <ShieldSlash className="size-7 text-white" weight="fill" />
            </span>
          </div>
          <div className="flex items-center justify-center gap-1">
            <span className="size-2 animate-bounce rounded-full bg-red-500" />
            <span
              className="size-2 animate-bounce rounded-full bg-red-600"
              style={{ animationDelay: "0.1s" }}
            />
            <span
              className="size-2 animate-bounce rounded-full bg-red-700"
              style={{ animationDelay: "0.2s" }}
            />
          </div>
        </div>
      </div>
    )
  }

  const displayName =
    user?.fullName || user?.primaryEmailAddress?.emailAddress || "Usuário"

  return (
    <>
      {/* Keyframes locais da página (prefixo banned- para não colidir com o globals) */}
      <style>{`
        @keyframes banned-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(3deg); }
        }
        @keyframes banned-glow-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.3); }
          50% { box-shadow: 0 0 40px rgba(239, 68, 68, 0.6); }
        }
        @keyframes banned-slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes banned-fade-in-scale {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes banned-border-glow {
          0%, 100% { border-color: rgba(239, 68, 68, 0.3); }
          50% { border-color: rgba(239, 68, 68, 0.6); }
        }
        .banned-float { animation: banned-float 4s ease-in-out infinite; }
        .banned-glow-pulse { animation: banned-glow-pulse 2s ease-in-out infinite; }
        .banned-slide-up { animation: banned-slide-up 0.6s ease-out forwards; opacity: 0; }
        .banned-fade-in-scale { animation: banned-fade-in-scale 0.5s ease-out forwards; opacity: 0; }
        .banned-border-glow { animation: banned-border-glow 2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .banned-float, .banned-glow-pulse, .banned-border-glow { animation: none; }
          .banned-slide-up, .banned-fade-in-scale { animation: none; opacity: 1; }
        }
      `}</style>

      <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-gradient-to-br from-[#050f1c] via-red-950/20 to-[#050f1c] p-3 not-dark:from-background not-dark:via-red-950/10 not-dark:to-background sm:p-4">
        {/* === EFEITOS DE FUNDO === */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* Orbes de gradiente */}
          <div className="absolute -top-20 -left-20 h-[300px] w-[300px] animate-pulse rounded-full bg-red-500/8 blur-3xl sm:h-[500px] sm:w-[500px]" />
          <div
            className="absolute -right-20 -bottom-20 h-[350px] w-[350px] animate-pulse rounded-full bg-red-900/6 blur-3xl sm:h-[600px] sm:w-[600px]"
            style={{ animationDelay: "1.5s" }}
          />
          <div
            className="absolute top-1/2 left-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-orange-900/5 blur-3xl sm:h-[400px] sm:w-[400px]"
            style={{ animationDelay: "0.7s" }}
          />

          {/* Ícones de alerta flutuando */}
          {FLOATING_WARNINGS.map((item, index) => {
            const FloatIcon = item.icon
            return (
              <div
                key={index}
                className={`banned-float absolute ${item.position} ${item.opacity}`}
                style={{ animationDelay: item.delay }}
              >
                <FloatIcon
                  className={`${item.size} ${item.color}`}
                  weight="fill"
                />
              </div>
            )
          })}

          {/* Partículas */}
          {PARTICLES.map((pos, i) => (
            <div
              key={i}
              className="absolute size-1.5 animate-ping rounded-full bg-red-500 opacity-[0.15] sm:size-2"
              style={{
                top: pos.top,
                left: pos.left,
                animationDelay: `${i * 0.6}s`,
                animationDuration: `${2.5 + i * 0.4}s`,
              }}
            />
          ))}

          {/* Scanlines */}
          <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(239,68,68,0.01)_2px,rgba(239,68,68,0.01)_4px)]" />
        </div>

        {/* === CONTEÚDO PRINCIPAL === */}
        <div className="relative z-10 mx-auto w-full max-w-lg">
          {/* Logo */}
          <div className="banned-slide-up mb-4 flex justify-center sm:mb-6">
            <div className="relative">
              <div className="absolute inset-0 animate-pulse rounded-xl bg-gradient-to-r from-red-500/10 to-red-900/10 blur-xl" />
              <div className="bg-card/80 relative rounded-xl border border-red-500/20 px-4 py-2 backdrop-blur-sm sm:px-6 sm:py-3">
                <Logo
                  width={180}
                  height={45}
                  className="h-auto w-36 opacity-60 grayscale sm:w-44"
                  shadow={false}
                />
              </div>
            </div>
          </div>

          {/* Card principal */}
          <Card
            className="banned-fade-in-scale banned-border-glow relative gap-0 overflow-hidden rounded-2xl border-2 border-red-500/30 py-0 shadow-2xl shadow-red-500/10"
            style={{ animationDelay: "0.2s" }}
          >
            {/* Faixa de perigo no topo */}
            <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-red-500 to-orange-500" />

            {/* Overlay de perigo */}
            <div className="pointer-events-none absolute top-0 right-0 left-0 h-32 bg-gradient-to-b from-red-500/8 to-transparent sm:h-40" />

            <CardContent className="relative p-5 sm:p-8">
              {/* Header */}
              <div className="mb-6 text-center sm:mb-8">
                {/* Ícone de banimento com glow */}
                <div
                  className="banned-slide-up relative mb-4 inline-flex items-center justify-center sm:mb-5"
                  style={{ animationDelay: "0.3s" }}
                >
                  {/* Anel pulsante externo */}
                  <div
                    className="absolute size-24 animate-ping rounded-full border-2 border-red-500/20 sm:size-28"
                    style={{ animationDuration: "3s" }}
                  />
                  {/* Anel tracejado girando */}
                  <div
                    className="absolute size-20 animate-spin rounded-full border-2 border-dashed border-red-500/30 sm:size-24"
                    style={{ animationDuration: "6s" }}
                  />
                  {/* Glow interno */}
                  <div className="absolute size-16 animate-pulse rounded-full bg-red-500/20 blur-lg sm:size-20" />
                  {/* Container do ícone */}
                  <div className="banned-glow-pulse relative flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-red-600 to-red-900 shadow-xl sm:size-20">
                    <ShieldSlash
                      className="size-8 text-white drop-shadow-lg sm:size-10"
                      weight="fill"
                    />
                  </div>
                </div>

                {/* Badge */}
                <div className="banned-slide-up" style={{ animationDelay: "0.4s" }}>
                  <Badge
                    variant="outline"
                    className="mb-3 animate-pulse gap-1.5 border-red-500/40 bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-400 not-dark:text-red-600 sm:mb-4 sm:px-4 sm:py-1.5 sm:text-sm"
                  >
                    <Prohibit className="size-3 sm:size-3.5" weight="bold" />
                    CONTA BANIDA
                  </Badge>
                </div>

                {/* Título */}
                <div
                  className="banned-slide-up space-y-2 sm:space-y-3"
                  style={{ animationDelay: "0.5s" }}
                >
                  <h1 className="text-2xl font-bold text-red-400 not-dark:text-red-600 sm:text-3xl">
                    Acesso Bloqueado
                  </h1>
                  <p className="text-muted-foreground mx-auto max-w-sm text-sm leading-relaxed sm:text-base">
                    Olá,{" "}
                    <span className="text-foreground font-semibold">
                      {displayName}
                    </span>
                    . Sua conta foi{" "}
                    <span className="font-semibold text-red-400 not-dark:text-red-600">
                      permanentemente suspensa
                    </span>{" "}
                    da plataforma Clipfy League.
                  </p>
                </div>
              </div>

              {/* Motivo */}
              <div
                className="banned-slide-up mb-5 rounded-xl border border-red-500/25 bg-gradient-to-br from-red-500/10 via-red-900/5 to-transparent p-4 sm:mb-6 sm:p-5"
                style={{ animationDelay: "0.6s" }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-red-600 to-red-800 shadow-lg shadow-red-500/30 sm:size-10">
                    <Warning className="size-4.5 text-white sm:size-5" weight="fill" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-1 text-sm font-bold text-red-400 not-dark:text-red-600 sm:text-base">
                      Motivo do Banimento
                    </h3>
                    <p className="text-muted-foreground text-xs leading-relaxed sm:text-sm">
                      Sua conta foi banida por violar os termos de uso da
                      plataforma. Todas as funcionalidades foram desabilitadas
                      permanentemente.
                    </p>
                  </div>
                </div>
              </div>

              {/* Restrições */}
              <div className="mb-5 space-y-2.5 sm:mb-6 sm:space-y-3">
                <h3
                  className="banned-slide-up text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wider uppercase sm:text-sm"
                  style={{ animationDelay: "0.7s" }}
                >
                  <FileX className="size-3.5 text-red-500 sm:size-4" weight="fill" />
                  Restrições Aplicadas
                </h3>
                {(
                  [
                    { icon: LockSimple, text: "Acesso ao painel bloqueado", delay: "0.75s" },
                    { icon: Prohibit, text: "Participação em competições suspensa", delay: "0.8s" },
                    { icon: WarningOctagon, text: "Envio de clipes desabilitado", delay: "0.85s" },
                    { icon: ShieldSlash, text: "Ranking e premiações cancelados", delay: "0.9s" },
                  ] as Array<{ icon: PhosphorIcon; text: string; delay: string }>
                ).map((item, index) => {
                  const ItemIcon = item.icon
                  return (
                    <div
                      key={index}
                      className="banned-slide-up flex items-center gap-2.5 rounded-lg border border-red-500/10 bg-red-500/5 p-2.5 transition-all duration-300 hover:translate-x-1 hover:border-red-500/25 sm:gap-3 sm:p-3"
                      style={{ animationDelay: item.delay }}
                    >
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-500/20 to-red-900/20 sm:size-8">
                        <ItemIcon
                          className="size-3.5 text-red-400 not-dark:text-red-600 sm:size-4"
                          weight="fill"
                        />
                      </div>
                      <span className="text-muted-foreground text-xs sm:text-sm">
                        {item.text}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Suporte */}
              <div
                className="banned-slide-up mb-5 rounded-xl border border-slate-500/20 bg-gradient-to-br from-slate-500/10 via-slate-800/5 to-transparent p-4 sm:mb-6 sm:p-5"
                style={{ animationDelay: "0.95s" }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 shadow-lg sm:size-11">
                    <ChatCircle className="size-5 text-white sm:size-5.5" weight="fill" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-1 text-sm font-bold sm:text-base">
                      Precisa de ajuda?
                    </h3>
                    <p className="text-muted-foreground mb-3 text-xs leading-relaxed sm:text-sm">
                      Se você acredita que houve um erro ou deseja mais
                      informações sobre o banimento, entre em contato com nossa
                      equipe de suporte.
                    </p>
                    <Button
                      onClick={() =>
                        (window.location.href =
                          "mailto:support@clipfyai.com?subject=Revisão de Banimento - Clipfy League")
                      }
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 rounded-lg border-slate-500/30 text-xs hover:border-slate-500/50 hover:bg-slate-500/10 sm:w-auto sm:text-sm"
                    >
                      <EnvelopeSimple className="size-3.5 sm:size-4" />
                      Contatar Suporte
                    </Button>
                  </div>
                </div>
              </div>

              {/* Logout */}
              <div className="banned-slide-up space-y-3" style={{ animationDelay: "1s" }}>
                <Button
                  onClick={() => signOut({ redirectUrl: "/sign-in" })}
                  variant="destructive"
                  size="lg"
                  className="h-12 w-full gap-2 rounded-xl bg-gradient-to-r from-red-600 to-red-800 text-sm font-semibold text-white shadow-lg shadow-red-500/25 hover:from-red-700 hover:to-red-900 sm:text-base"
                >
                  <SignOut className="size-4 sm:size-5" weight="bold" />
                  Sair da Conta
                </Button>
              </div>

              {/* Rodapé */}
              <div
                className="banned-slide-up mt-5 border-t border-red-500/10 pt-4 text-center sm:mt-6"
                style={{ animationDelay: "1.1s" }}
              >
                <p className="text-muted-foreground/50 text-[10px] sm:text-xs">
                  Conta registrada:{" "}
                  <span className="text-muted-foreground/70">
                    {user?.primaryEmailAddress?.emailAddress}
                  </span>
                </p>
                <p className="text-muted-foreground/40 mt-1 text-[10px] sm:text-xs">
                  Clipfy League &bull; Todos os direitos reservados
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
