"use client"

import { useAuth, useUser } from "@clerk/nextjs"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

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
   SPLASH DE CARREGAMENTO — A LOGO É O ASSUNTO
   A marca ocupa o centro da tela, com halo respirando atrás e um
   brilho que atravessa as letras (recortado pela própria silhueta
   do SVG, então só a logo acende). O resto — barra, etapa e os
   três pontos — fica subordinado, em escala menor.

   Adapta-se aos DOIS temas (tokens --auth-* em globals.css):
   • light — gelo com brumas teal e acentos escuros legíveis
     (o neon #14f7fe some no branco);
   • dark  — petróleo da apresentação com o gradiente neon.
   A barra não simula porcentagem: mostra o ESTÁGIO real do guard
   (sessão → perfil → arena).
   ============================================================ */

export type AuthLoadingStage = "session" | "profile" | "arena"

/** Silhueta usada como máscara do brilho — a forma é a mesma nos dois temas. */
const LOGO_MASK = "url(/images/logo-clipfy-white.svg)"

const STAGES: { key: AuthLoadingStage; label: string; short: string }[] = [
  { key: "session", label: "Verificando sessão", short: "Sessão" },
  { key: "profile", label: "Carregando perfil", short: "Perfil" },
  { key: "arena", label: "Preparando arena", short: "Arena" },
]

export function AuthLoadingScreen({
  stage = "session",
}: {
  stage?: AuthLoadingStage
}) {
  const activeIndex = STAGES.findIndex((item) => item.key === stage)
  const currentIndex = activeIndex === -1 ? 0 : activeIndex
  const current = STAGES[currentIndex] ?? STAGES[0]!

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
      <div className="relative flex min-h-full w-full flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="animate-fade-in-up m-auto flex w-full max-w-[min(30rem,88vw)] flex-col items-center">
          {/* ═══ A LOGO ═══ */}
          <div className="relative flex items-center justify-center">
            {/* halo largo respirando atrás da marca */}
            <span
              aria-hidden
              className="auth-halo pointer-events-none absolute -inset-x-[26%] -inset-y-[190%] rounded-[50%] bg-[radial-gradient(closest-side,var(--auth-halo-color),transparent)] blur-2xl"
            />
            {/* anel de luz difuso, só para dar profundidade */}
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-x-[8%] -inset-y-[70%] rounded-[50%] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--auth-accent)_16%,transparent),transparent)] blur-xl"
            />

            <span className="auth-logo-breathe relative inline-block">
              <Logo
                width={400}
                height={100}
                shadow={false}
                className="short:w-[clamp(8.5rem,42vw,13rem)] h-auto w-[clamp(10.5rem,58vw,19rem)]"
              />
              {/* brilho atravessando — recortado pela silhueta da logo */}
              <span
                aria-hidden
                className="auth-logo-sheen pointer-events-none absolute inset-0"
                style={{
                  maskImage: LOGO_MASK,
                  WebkitMaskImage: LOGO_MASK,
                  maskSize: "contain",
                  WebkitMaskSize: "contain",
                  maskRepeat: "no-repeat",
                  WebkitMaskRepeat: "no-repeat",
                  maskPosition: "center",
                  WebkitMaskPosition: "center",
                }}
              />
            </span>
          </div>

          {/* ═══ Barra indeterminada — honesta: não simula porcentagem ═══ */}
          <div
            aria-hidden
            className="short:mt-6 relative mt-9 h-1 w-full max-w-[min(17rem,62vw)] overflow-hidden rounded-full bg-[var(--auth-track)]"
          >
            <span className="auth-indeterminate auth-bar absolute inset-y-0 left-0 w-2/5 rounded-full" />
          </div>

          {/* ═══ Etapa real do guard ═══ */}
          <p className="short:mt-4 mt-5 flex items-center gap-2 text-[0.9375rem] font-semibold tracking-tight text-balance sm:text-base">
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
          </p>

          {/* ═══ Três marcadores de estágio — discretos, só contexto ═══ */}
          <ol className="mt-4 flex items-center gap-2.5">
            {STAGES.map((item, index) => {
              const isDone = index < currentIndex
              const isCurrent = index === currentIndex
              return (
                <li
                  key={item.key}
                  aria-current={isCurrent ? "step" : undefined}
                  className="flex items-center gap-2.5"
                >
                  <span className="sr-only">{item.short}</span>
                  <span
                    aria-hidden
                    className={cn(
                      "block h-1 rounded-full transition-all duration-500 motion-reduce:transition-none",
                      isCurrent
                        ? "auth-fill w-6"
                        : isDone
                          ? "w-3 bg-[var(--auth-accent)]/55"
                          : "w-3 bg-[var(--auth-track)]",
                    )}
                  />
                </li>
              )
            })}
          </ol>

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
