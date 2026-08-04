"use client"

import * as React from "react"

import {
  ArrowSquareOut,
  BookOpen,
  CheckCircle,
  Confetti as ConfettiIcon,
  EnvelopeSimple,
  Gift,
  Heart,
  Lightning,
  Play,
  Rocket,
  Sparkle,
  Star,
  Trophy,
  UsersThree,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react"

import { Logo } from "@/components/logo"
import { DarkScope } from "@/components/shared/dark-scope"
import { Reveal } from "@/components/shared/reveal"

// Passos para acessar
const ACCESS_STEPS: Array<{
  number: string
  icon: PhosphorIcon
  title: string
  description: string
  tile: string
}> = [
  {
    number: "01",
    icon: EnvelopeSimple,
    title: "Verifique seu E-mail",
    description:
      "Enviamos os dados de acesso para o e-mail cadastrado na compra. Confira também a caixa de spam.",
    tile: "bg-gradient-custom",
  },
  {
    number: "02",
    icon: ArrowSquareOut,
    title: "Acesse a Plataforma",
    description:
      "Entre em league.clipfyai.com com o e-mail e senha recebidos para acessar todo o conteúdo.",
    tile: "bg-gradient-to-br from-amber-300 to-yellow-500",
  },
  {
    number: "03",
    icon: Play,
    title: "Comece a Aprender",
    description:
      "Assista às aulas, participe das competições e comece a faturar com seus cortes!",
    tile: "bg-gradient-to-br from-emerald-300 to-emerald-500",
  },
]

// O que você tem acesso
const ACCESS_ITEMS: Array<{
  icon: PhosphorIcon
  title: string
  description: string
}> = [
  {
    icon: BookOpen,
    title: "Todas as Aulas",
    description: "Conteúdo completo do zero ao avançado",
  },
  {
    icon: Trophy,
    title: "Competições",
    description: "Participe e ganhe prêmios em dinheiro",
  },
  {
    icon: UsersThree,
    title: "Comunidade PRO",
    description: "Networking com outros clipadores",
  },
  {
    icon: Lightning,
    title: "Suporte Prioritário",
    description: "Tire suas dúvidas rapidamente",
  },
]

// Partículas ambiente do fundo (vocabulário arena-*)
const TWINKLES: Array<{
  top: string
  left: string
  size: string
  color: string
  dur: string
  delay: string
}> = [
  { top: "10%", left: "8%", size: "size-1", color: "bg-brand-cyan/60", dur: "3.4s", delay: "0s" },
  { top: "20%", left: "90%", size: "size-1.5", color: "bg-brand-mint/50", dur: "4.2s", delay: "0.8s" },
  { top: "36%", left: "14%", size: "size-1", color: "bg-amber-300/60", dur: "3.8s", delay: "1.6s" },
  { top: "50%", left: "92%", size: "size-1", color: "bg-brand-green/50", dur: "4.6s", delay: "0.4s" },
  { top: "66%", left: "6%", size: "size-1.5", color: "bg-brand-cyan/50", dur: "3.6s", delay: "2.2s" },
  { top: "80%", left: "86%", size: "size-1", color: "bg-amber-200/50", dur: "4s", delay: "1.2s" },
  { top: "90%", left: "32%", size: "size-1", color: "bg-brand-mint/50", dur: "4.4s", delay: "2.8s" },
  { top: "28%", left: "56%", size: "size-1", color: "bg-brand-green/40", dur: "3.9s", delay: "3.2s" },
]

// Chuva de confete celebratória (vocabulário arena-confetti, cores da marca)
function ConfettiRain() {
  const [particles, setParticles] = React.useState<
    Array<{
      id: number
      x: number
      y: number
      delay: number
      duration: number
      drift: number
      rotation: number
      color: string
    }>
  >([])

  React.useEffect(() => {
    const colors = [
      "#14f7fe",
      "#1ffec8",
      "#37fa9c",
      "#fbbf24",
      "#fde68a",
      "#f8fafc",
    ]
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 70,
      delay: Math.random() * 2,
      duration: 3 + Math.random() * 2,
      drift: -40 + Math.random() * 80,
      rotation: 180 + Math.random() * 240,
      color: colors[Math.floor(Math.random() * colors.length)]!,
    }))
    setParticles(newParticles)
  }, [])

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="arena-confetti absolute h-3 w-1.5 rounded-[2px]"
          style={
            {
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              backgroundColor: particle.color,
              "--confetti-dur": `${particle.duration}s`,
              "--confetti-delay": `${particle.delay}s`,
              "--confetti-x": `${particle.drift}px`,
              "--confetti-rot": `${particle.rotation}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}

export default function ThankYou() {
  const [showConfetti, setShowConfetti] = React.useState(true)

  React.useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 5000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <DarkScope className="relative min-h-svh overflow-x-hidden bg-[#050f1c] text-white">
      {/* Chuva de confete celebratória */}
      {showConfetti && <ConfettiRain />}

      {/* Ambiente: petróleo + auroras da marca + grid + partículas */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(1100px_620px_at_50%_-10%,#0a1c2b_0%,#050f1c_58%,#020910_100%)]" />
        <div className="hero-grid absolute inset-0 opacity-30" />
        <div className="arena-aurora absolute -top-40 left-1/2 h-[440px] w-[720px] max-w-[120vw] -translate-x-1/2 rounded-full bg-[#37fa9c]/[0.07] blur-[120px]" />
        <div
          className="arena-aurora absolute top-1/3 -left-40 h-[380px] w-[380px] rounded-full bg-[#14f7fe]/[0.06] blur-[110px]"
          style={{ animationDelay: "-7s" }}
        />
        <div
          className="arena-aurora absolute -right-32 bottom-0 h-[360px] w-[420px] rounded-full bg-amber-400/[0.05] blur-[110px]"
          style={{ animationDelay: "-3.5s" }}
        />
        {TWINKLES.map((t, i) => (
          <span
            key={i}
            className={`arena-twinkle absolute rounded-full ${t.size} ${t.color}`}
            style={
              {
                top: t.top,
                left: t.left,
                "--twinkle-dur": t.dur,
                "--twinkle-delay": t.delay,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* Conteúdo principal */}
      <div className="relative z-10">
        {/* Header */}
        <header className="px-4 py-6">
          <div className="mx-auto flex max-w-6xl justify-center">
            <Logo shadow={false} />
          </div>
        </header>

        {/* Hero - Mensagem de sucesso */}
        <section className="px-4 pt-8 pb-16">
          <div className="mx-auto max-w-4xl text-center">
            {/* Ícone de sucesso */}
            <div className="animate-scale-in mb-8" style={{ animationDelay: "0.2s" }}>
              <div className="relative inline-flex">
                <div className="bg-gradient-custom absolute inset-0 animate-pulse rounded-full opacity-50 blur-2xl" />
                <div className="bg-gradient-custom relative flex h-28 w-28 items-center justify-center rounded-full shadow-2xl shadow-brand-cyan/30 sm:h-32 sm:w-32">
                  <CheckCircle
                    className="h-14 w-14 text-[#04222A] sm:h-16 sm:w-16"
                    weight="fill"
                  />
                </div>
                <div
                  className="animate-fade-in absolute -top-2 -right-2"
                  style={{ animationDelay: "0.5s" }}
                >
                  <ConfettiIcon
                    className="h-8 w-8 text-amber-300"
                    weight="fill"
                  />
                </div>
              </div>
            </div>

            {/* Título */}
            <div className="animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
              <h1 className="mb-6 text-4xl font-black sm:text-5xl md:text-6xl">
                <span className="text-gradient">Parabéns!</span>
              </h1>
              <p className="mb-4 text-2xl font-bold text-white sm:text-3xl">
                Sua compra foi confirmada! 🎉
              </p>
              <p className="mx-auto max-w-2xl text-lg text-white/60 sm:text-xl">
                Você agora faz parte da{" "}
                <span className="font-semibold text-amber-300">
                  Clipfy League PRO
                </span>
                . Prepare-se para transformar seus cortes em uma fonte real de
                renda!
              </p>
            </div>

            {/* Badge de celebração */}
            <div
              className="animate-scale-in mt-8 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-6 py-3"
              style={{ animationDelay: "0.6s" }}
            >
              <Gift className="size-5 text-amber-300" weight="fill" />
              <span className="font-medium text-amber-300">
                Seu acesso já está liberado!
              </span>
              <Sparkle className="size-5 text-amber-300" weight="fill" />
            </div>
          </div>
        </section>

        {/* Passos de acesso */}
        <section className="px-4 py-16">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
                Como acessar seu <span className="text-gradient">conteúdo</span>
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-white/60">
                Siga estes 3 passos simples para começar sua jornada
              </p>
            </Reveal>

            {/* Grade de passos */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8">
              {ACCESS_STEPS.map((step, index) => (
                <Reveal
                  key={step.number}
                  delayMs={index * 120}
                  className="group relative"
                >
                  {/* Linha de conexão (desktop) */}
                  {index < ACCESS_STEPS.length - 1 && (
                    <div className="absolute top-16 left-full z-0 hidden h-0.5 w-full bg-gradient-to-r from-white/15 to-transparent md:block" />
                  )}

                  <div className="relative h-full">
                    {/* Glow */}
                    <div className="bg-gradient-custom absolute -inset-0.5 rounded-2xl opacity-0 blur transition-opacity duration-500 group-hover:opacity-30" />

                    {/* Card */}
                    <div className="relative h-full rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-6 backdrop-blur-sm transition-all duration-300 group-hover:border-brand-cyan/40 sm:p-8">
                      {/* Número do passo */}
                      <div className="bg-gradient-custom absolute -top-4 -left-2 flex size-10 items-center justify-center rounded-xl shadow-lg">
                        <span className="text-sm font-bold text-[#04222A]">
                          {step.number}
                        </span>
                      </div>

                      {/* Ícone */}
                      <div
                        className={`mb-6 flex h-16 w-16 items-center justify-center rounded-2xl ${step.tile} shadow-lg transition-transform duration-300 group-hover:scale-110`}
                      >
                        <step.icon
                          className="size-8 text-[#04222A]"
                          weight="fill"
                        />
                      </div>

                      {/* Conteúdo */}
                      <h3 className="mb-3 text-xl font-bold text-white">
                        {step.title}
                      </h3>
                      <p className="leading-relaxed text-white/60">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            {/* Destaque do e-mail */}
            <Reveal delayMs={160} className="mx-auto mt-12 max-w-2xl">
              <div className="group relative">
                <div className="bg-gradient-custom absolute -inset-0.5 rounded-2xl opacity-25 blur" />
                <div className="relative rounded-2xl border border-brand-cyan/30 bg-[#050f1c]/90 p-6 sm:p-8">
                  <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:gap-6 sm:text-left">
                    <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-cyan/15">
                      <EnvelopeSimple
                        className="size-8 text-brand-cyan"
                        weight="fill"
                      />
                    </div>
                    <div>
                      <h3 className="mb-2 text-lg font-bold text-white">
                        📧 Não recebeu o e-mail?
                      </h3>
                      <p className="text-sm text-white/60">
                        Verifique sua caixa de spam ou lixo eletrônico. Se ainda
                        assim não encontrar, entre em contato pelo suporte que
                        te ajudamos!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* O que você tem acesso */}
        <section className="px-4 py-16">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
                O que você tem{" "}
                <span className="text-gradient">acesso agora</span>
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-white/60">
                Aproveite todos os benefícios da sua assinatura PRO
              </p>
            </Reveal>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
              {ACCESS_ITEMS.map((item, index) => (
                <Reveal key={item.title} delayMs={index * 100} className="group">
                  <div className="relative h-full rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-6 backdrop-blur-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:border-brand-cyan/30">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-cyan/15 transition-transform duration-300 group-hover:scale-110">
                      <item.icon className="size-6 text-brand-cyan" />
                    </div>
                    <h3 className="mb-2 text-lg font-bold text-white">
                      {item.title}
                    </h3>
                    <p className="text-sm text-white/60">{item.description}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 py-16">
          <div className="mx-auto max-w-4xl">
            <Reveal className="relative">
              {/* Glow */}
              <div className="bg-gradient-custom absolute -inset-1 rounded-3xl opacity-25 blur-xl" />

              {/* Card */}
              <div className="relative overflow-hidden rounded-3xl border border-brand-cyan/30 bg-[#050f1c]/90 p-8 text-center sm:p-12">
                {/* Elementos decorativos */}
                <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-gradient-to-br from-brand-cyan/10 to-transparent blur-3xl" />
                <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-gradient-to-tr from-brand-green/10 to-transparent blur-3xl" />

                <div className="relative z-10">
                  <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-cyan/30 bg-brand-cyan/10 px-4 py-2">
                    <Rocket className="size-4 text-brand-cyan" weight="fill" />
                    <span className="text-sm font-medium text-brand-cyan">
                      Comece agora mesmo
                    </span>
                  </div>

                  <h2 className="mb-6 text-3xl font-bold sm:text-4xl">
                    Pronto para{" "}
                    <span className="text-gradient">começar sua jornada</span>?
                  </h2>

                  <p className="mx-auto mb-8 max-w-2xl text-lg text-white/60">
                    Acesse a plataforma agora e comece a assistir as aulas. Sua
                    primeira competição pode ser o começo de uma nova fonte de
                    renda!
                  </p>

                  <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                    <a
                      href="https://league.clipfyai.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-gradient-auth group flex h-14 w-full items-center justify-center gap-2 rounded-xl px-10 text-lg font-bold transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-brand-cyan/40 sm:w-auto"
                    >
                      ACESSAR PLATAFORMA
                      <ArrowSquareOut className="size-5 transition-transform group-hover:translate-x-1" />
                    </a>
                  </div>

                  <p className="mt-6 flex items-center justify-center gap-2 text-sm text-white/50">
                    <Star className="size-4 text-amber-300" weight="fill" />
                    league.clipfyai.com
                    <Star className="size-4 text-amber-300" weight="fill" />
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Mensagem de agradecimento */}
        <section className="px-4 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal>
              <div className="mb-6 inline-flex items-center justify-center gap-2">
                <Heart className="size-6 text-red-400" weight="fill" />
                <span className="text-lg text-white/60">
                  Obrigado por confiar na Clipfy
                </span>
                <Heart className="size-6 text-red-400" weight="fill" />
              </div>

              <p className="text-sm leading-relaxed text-white/50">
                Estamos muito felizes em ter você com a gente. Qualquer dúvida,
                estamos à disposição para ajudar. Bora dominar as competições
                juntos! 🚀
              </p>
            </Reveal>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 px-4 py-8">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
            <Logo width={120} height={30} shadow={false} />
            <p className="text-sm text-white/50">
              © {new Date().getFullYear()} Clipfy League. Todos os direitos
              reservados.
            </p>
          </div>
        </footer>
      </div>
    </DarkScope>
  )
}
