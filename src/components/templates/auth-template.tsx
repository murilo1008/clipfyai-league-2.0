"use client"

import { useAuth, useUser } from "@clerk/nextjs"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { CheckCircle, ShieldCheck, Trophy, UserCircle } from "@phosphor-icons/react"

import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

interface AuthTemplateProps {
  children: React.ReactNode
  requireAuth?: boolean
}

/**
 * Guard de autenticação e status — mesma lógica de redirecionamento da
 * Clipfy League (onboarding / aprovação / banimento por verificationStatus).
 */
export function AuthTemplate({ children, requireAuth = true }: AuthTemplateProps) {
  const { isLoaded: authLoaded, isSignedIn } = useAuth()
  const { isLoaded: userLoaded } = useUser()
  const router = useRouter()
  const pathname = usePathname()
  const [isInitialized, setIsInitialized] = useState(false)

  const publicRoutes = ["/sign-in", "/sign-up", "/forgot-password"]
  const isPublicRoute = publicRoutes.includes(pathname)

  const { data: dbUser, isLoading: isLoadingDbUser } =
    api.user.getCurrentUser.useQuery(undefined, {
      enabled: isSignedIn && authLoaded && userLoaded && !isPublicRoute,
      retry: 1,
    })

  useEffect(() => {
    if (!authLoaded || !userLoaded) return

    // CASO 1: Não está logado
    if (!isSignedIn) {
      setIsInitialized(true)
      if (requireAuth && !isPublicRoute) {
        router.push("/sign-in")
      }
      return
    }

    // CASO 2: Está logado - aguardar dados do DB
    if (isLoadingDbUser) return

    // CASO 3: Está logado e dados carregados
    setIsInitialized(true)

    if (isPublicRoute) {
      router.push("/")
      return
    }

    // CASO 4: CLIPPER - onboarding e status de verificação
    if (dbUser?.role === "CLIPPER") {
      if (!dbUser.onboardingCompleted && pathname !== "/onboarding") {
        router.push("/onboarding")
        return
      }

      if (
        dbUser.onboardingCompleted &&
        dbUser.clipperProfile?.verificationStatus === "PENDING" &&
        pathname !== "/approve"
      ) {
        router.push("/approve")
        return
      }

      if (
        dbUser.onboardingCompleted &&
        dbUser.clipperProfile?.verificationStatus === "UNVERIFIED" &&
        pathname !== "/approve"
      ) {
        router.push("/approve")
        return
      }

      if (
        dbUser.clipperProfile?.verificationStatus === "REJECTED" &&
        pathname !== "/approve"
      ) {
        router.push("/approve")
        return
      }

      if (
        dbUser.clipperProfile?.verificationStatus === "BANNED" &&
        pathname !== "/banned"
      ) {
        router.push("/banned")
        return
      }

      if (dbUser.clipperProfile?.verificationStatus === "VERIFIED") {
        if (pathname === "/onboarding" || pathname === "/approve") {
          router.push("/")
          return
        }
      }
    }
  }, [
    authLoaded,
    userLoaded,
    isSignedIn,
    requireAuth,
    isPublicRoute,
    router,
    pathname,
    isLoadingDbUser,
    dbUser,
  ])

  const isCheckingSession = !authLoaded || !userLoaded
  const isLoadingProfile = isSignedIn && isLoadingDbUser

  if (isCheckingSession || !isInitialized || isLoadingProfile) {
    return (
      <AuthLoadingScreen
        stage={
          isCheckingSession ? "session" : isLoadingProfile ? "profile" : "arena"
        }
      />
    )
  }

  if (requireAuth && !isSignedIn && !isPublicRoute) {
    return null
  }

  if (isSignedIn && isPublicRoute) {
    return null
  }

  return <>{children}</>
}

/* ============================================================
   SPLASH DE CARREGAMENTO
   Adapta-se aos DOIS temas (tokens --auth-* em globals.css):
   • light — gelo com brumas teal e acentos escuros legíveis
     (o neon #14f7fe some no branco);
   • dark  — petróleo da apresentação com o gradiente neon.
   Em vez de uma barra falsa correndo até 92%, mostra o ESTÁGIO
   real do guard: sessão → perfil → arena.
   ============================================================ */

export type AuthLoadingStage = "session" | "profile" | "arena"

const STAGES: {
  key: AuthLoadingStage
  /** Título da etapa em andamento */
  label: string
  /** Rótulo curto do stepper — cabe em 320px */
  short: string
  hint: string
  icon: typeof ShieldCheck
}[] = [
  {
    key: "session",
    label: "Verificando sessão",
    short: "Sessão",
    hint: "Confirmando suas credenciais com segurança.",
    icon: ShieldCheck,
  },
  {
    key: "profile",
    label: "Carregando perfil",
    short: "Perfil",
    hint: "Buscando seus dados e permissões.",
    icon: UserCircle,
  },
  {
    key: "arena",
    label: "Preparando arena",
    short: "Arena",
    hint: "Montando seu painel da Clipfy League.",
    icon: Trophy,
  },
]

export function AuthLoadingScreen({
  stage = "session",
}: {
  stage?: AuthLoadingStage
}) {
  const activeIndex = STAGES.findIndex((item) => item.key === stage)
  const currentIndex = activeIndex === -1 ? 0 : activeIndex
  const current = STAGES[currentIndex] ?? STAGES[0]!
  const CurrentIcon = current.icon

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="bg-background fixed inset-0 z-50 overflow-y-auto overscroll-contain select-none"
    >
      {/* Leitor de tela: uma frase só, sem narrar a decoração */}
      <span className="sr-only">{current.label}, aguarde…</span>

      <AuthLoadingBackdrop />

      {/* min-h-full + m-auto centraliza sem cortar o topo quando o
          conteúdo é mais alto que a viewport (bug clássico do
          align-items:center dentro de container com scroll). */}
      <div className="relative flex min-h-full w-full flex-col px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="animate-fade-in-up m-auto w-full max-w-[25rem]">
          <div className="glass-card short:py-6 rounded-[1.75rem] px-5 py-8 text-center shadow-[var(--auth-card-shadow)] sm:px-8 sm:py-10">
            {/* ═══ Emblema: arco cônico girando + ícone da etapa ═══ */}
            <div className="short:size-16 relative mx-auto flex size-[clamp(4.5rem,20vw,6rem)] items-center justify-center">
              <span
                aria-hidden
                className="auth-halo absolute -inset-7 rounded-full bg-[radial-gradient(circle,var(--auth-halo-color),transparent_70%)] blur-2xl"
              />
              {[0, 1].map((ring) => (
                <span
                  key={ring}
                  aria-hidden
                  className="arena-ripple absolute inset-0 rounded-full border border-[var(--auth-ring)]"
                  style={
                    {
                      "--ripple-dur": "3.6s",
                      "--ripple-delay": `${ring * 1.8}s`,
                    } as React.CSSProperties
                  }
                />
              ))}
              <span
                aria-hidden
                className="absolute inset-0 rounded-full ring-1 ring-[var(--auth-ring-soft)]"
              />
              <span
                aria-hidden
                className="auth-arc auth-spin absolute inset-0 rounded-full"
              />
              <span
                aria-hidden
                className="absolute inset-[5px] rounded-full bg-[var(--auth-emblem)] shadow-[var(--auth-emblem-shadow)] ring-1 ring-[var(--auth-ring-soft)]"
              />
              {/* Anel tracejado externo com o ponto orbitando */}
              <span
                aria-hidden
                className="auth-spin absolute -inset-3 rounded-full border border-dashed border-[var(--auth-ring-soft)] [--auth-spin-dur:12s]"
              >
                <span className="auth-fill absolute top-1/2 -right-[3px] size-1.5 -translate-y-1/2 rounded-full" />
              </span>
              <CurrentIcon
                key={current.key}
                weight="fill"
                aria-hidden
                className="animate-scale-in relative size-[38%] text-[var(--auth-accent)]"
              />
            </div>

            {/* ═══ Marca ═══ */}
            <div className="short:mt-4 mt-6 flex justify-center">
              <Logo
                width={200}
                height={50}
                shadow={false}
                className="short:w-28 h-auto w-[clamp(7rem,32vw,9.5rem)]"
              />
            </div>

            {/* ═══ Etapa atual ═══ */}
            <p className="short:mt-4 mt-5 text-[0.6875rem] font-semibold tracking-[0.18em] text-[var(--auth-accent-text)] uppercase">
              Etapa {currentIndex + 1} de {STAGES.length}
            </p>

            <h2 className="mt-1.5 flex items-center justify-center gap-2 text-[1.0625rem] font-semibold tracking-tight text-balance sm:text-lg">
              {current.label}
              <span aria-hidden className="flex shrink-0 items-center gap-1">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="auth-fill size-1 animate-bounce rounded-full motion-reduce:animate-none"
                    style={{ animationDelay: `${dot * 140}ms` }}
                  />
                ))}
              </span>
            </h2>

            <p className="text-muted-foreground short:hidden mx-auto mt-1.5 max-w-[20rem] text-sm leading-relaxed text-balance">
              {current.hint}
            </p>

            {/* ═══ Barra indeterminada — honesta: não simula porcentagem ═══ */}
            <div
              aria-hidden
              className="short:mt-4 relative mt-6 h-1.5 overflow-hidden rounded-full bg-[var(--auth-track)]"
            >
              <span className="auth-indeterminate auth-bar absolute inset-y-0 left-0 w-2/5 rounded-full" />
            </div>

            {/* ═══ Stepper dos estágios reais do guard ═══ */}
            <ol className="short:mt-4 mt-6 flex w-full items-start">
              {STAGES.map((item, index) => {
                const StageIcon = item.icon
                const isDone = index < currentIndex
                const isCurrent = index === currentIndex
                return (
                  <li
                    key={item.key}
                    aria-current={isCurrent ? "step" : undefined}
                    className="relative flex flex-1 flex-col items-center gap-2"
                  >
                    {/* Conector: do círculo anterior até este */}
                    {index > 0 && (
                      <span
                        aria-hidden
                        className="absolute top-4 right-[calc(50%+1.25rem)] left-[calc(-50%+1.25rem)] h-0.5 -translate-y-1/2 overflow-hidden rounded-full bg-[var(--auth-track)]"
                      >
                        <span
                          className={cn(
                            "auth-fill block h-full origin-left rounded-full transition-transform duration-700 ease-out motion-reduce:transition-none",
                            index <= currentIndex ? "scale-x-100" : "scale-x-0",
                          )}
                        />
                      </span>
                    )}

                    <span
                      className={cn(
                        "relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full transition-colors duration-500 motion-reduce:transition-none",
                        isDone &&
                          "bg-[var(--auth-tile-done)] text-[var(--auth-accent-text)]",
                        isCurrent &&
                          "auth-fill ring-2 ring-[var(--auth-ring)] ring-offset-2 ring-offset-[var(--auth-emblem)]",
                        !isDone &&
                          !isCurrent &&
                          "bg-[var(--auth-tile)] text-[var(--auth-tile-fg)]",
                      )}
                    >
                      {isDone ? (
                        <CheckCircle className="size-4" weight="fill" />
                      ) : (
                        <StageIcon className="size-4" weight="fill" />
                      )}
                      {/* Brilho varrendo só na etapa em andamento */}
                      {isCurrent && (
                        <span
                          aria-hidden
                          className="auth-sheen absolute inset-y-0 -left-full w-full bg-white/45"
                        />
                      )}
                    </span>

                    <span
                      className={cn(
                        "max-w-full truncate text-[0.6875rem] font-medium transition-colors duration-500 motion-reduce:transition-none sm:text-xs",
                        isCurrent && "text-foreground font-semibold",
                        isDone && "text-muted-foreground",
                        !isDone && !isCurrent && "text-muted-foreground/70",
                      )}
                    >
                      {item.short}
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>

          <p className="text-muted-foreground/70 short:hidden mt-5 text-center text-xs">
            Isso costuma levar só alguns segundos.
          </p>
        </div>
      </div>
    </div>
  )
}

/** Sparkles discretos — o suficiente para dar vida, sem virar ruído. */
const SPARKS = [
  { left: "12%", top: "22%", size: 10, delay: 0, dur: 3.8 },
  { left: "84%", top: "18%", size: 8, delay: 1.4, dur: 4.4 },
  { left: "22%", top: "76%", size: 7, delay: 2.6, dur: 4 },
  { left: "78%", top: "72%", size: 9, delay: 0.8, dur: 3.4 },
] as const

/**
 * Ambiente do splash — fixo na viewport (não rola junto com o card):
 * base por tema, grid em pan, auroras da marca, hairline, cometa e
 * sparkles. Tudo decorativo e sensível a prefers-reduced-motion.
 */
function AuthLoadingBackdrop() {
  return (
    <div
      aria-hidden
      className="auth-backdrop pointer-events-none fixed inset-0 overflow-hidden"
    >
      <span className="auth-grid absolute inset-0" />
      <span className="arena-aurora absolute -top-32 -left-24 size-[26rem] rounded-full bg-[var(--auth-glow-1)] blur-3xl sm:size-[34rem]" />
      <span
        className="arena-aurora absolute -right-28 -bottom-32 size-[26rem] rounded-full bg-[var(--auth-glow-2)] blur-3xl sm:size-[34rem]"
        style={{ animationDelay: "-6s" }}
      />
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--auth-ring)] to-transparent" />
      <span
        className="arena-comet absolute top-[12%] right-[14%] hidden h-px w-24 rounded-full bg-gradient-to-l from-transparent via-[var(--auth-spark)] to-transparent sm:block dark:from-white/70"
        style={
          {
            "--comet-dur": "11s",
            "--comet-delay": "2.4s",
            "--comet-x": "-320px",
            "--comet-y": "220px",
            "--comet-angle": "-32deg",
          } as React.CSSProperties
        }
      />
      {SPARKS.map((spark, index) => (
        <span
          key={index}
          className="arena-twinkle absolute hidden rounded-full bg-[var(--auth-spark)] sm:block"
          style={
            {
              left: spark.left,
              top: spark.top,
              width: spark.size,
              height: spark.size,
              filter: "blur(1px)",
              "--twinkle-delay": `${spark.delay}s`,
              "--twinkle-dur": `${spark.dur}s`,
              "--twinkle-opacity": 0.55,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
