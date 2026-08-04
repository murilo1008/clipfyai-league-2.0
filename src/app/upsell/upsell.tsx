"use client"

import * as React from "react"
import Image from "next/image"

import {
  ArrowRight,
  BookOpen,
  Brain,
  Bug,
  ChatText,
  CheckCircle,
  Clock,
  CreditCard,
  CurrencyDollar,
  Crown,
  FileText,
  Lightning,
  Lock,
  ShieldCheck,
  Sparkle,
  Stack,
  Star,
  Target,
  Timer,
  TrendUp,
  Trophy,
  Wallet,
  Warning,
  Wrench,
  X,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react"

// Dados do produto
const EBOOK_DATA = {
  name: "Manual do Clipador",
  subtitle: "Clipfy League Edition",
  price: 9.9,
  originalPrice: 19.9,
  discountPercent: 50,
  pages: 60,
}

// Capítulos do Ebook - COMPLETO
const EBOOK_CHAPTERS: Array<{
  number: string
  title: string
  subtitle: string
  icon: PhosphorIcon
  topics: string[]
}> = [
  {
    number: "00",
    title: "Antes de Começar",
    subtitle: "Entrando no jogo da Clipfy League",
    icon: Sparkle,
    topics: [
      "O que é a Clipfy League",
      "Como este eBook funciona",
      "Setup mínimo no celular e PC",
      "Checklist de início rápido",
    ],
  },
  {
    number: "01",
    title: "Mentalidade Clipadora",
    subtitle: "Prosperidade, Consistência e Longo Prazo",
    icon: Brain,
    topics: [
      "A mentalidade do clipador profissional",
      "Consistência que dá dinheiro",
      "O anti-burnout do clipador",
      "Plano de mentalidade em 30 dias",
    ],
  },
  {
    number: "02",
    title: "Clipfy League por Dentro",
    subtitle: "Como vencer competições e bater meta",
    icon: Trophy,
    topics: [
      "Estratégia da vitória diária",
      "Estratégia da vitória mensal",
      "O padrão do Top 10",
      "Meta de premiação e volume",
    ],
  },
  {
    number: "03",
    title: "Algoritmo no Bolso",
    subtitle: "O que faz um corte explodir",
    icon: TrendUp,
    topics: [
      "Retenção, replay e engajamento",
      "O primeiro segundo decide tudo",
      "Curva de retenção",
      "Sinais de vídeo 'vivo'",
    ],
  },
  {
    number: "04",
    title: "Caça ao Trecho Perfeito",
    subtitle: "A arte de escolher momentos que viram corte",
    icon: Target,
    topics: [
      "O que faz um trecho ser 'cortável'",
      "Método dos '3 ganchos'",
      "Estrutura do corte vencedor",
      "Exercício prático incluso",
    ],
  },
  {
    number: "05",
    title: "Edição que Prende",
    subtitle: "Retenção, ritmo e cortes que seguram",
    icon: Stack,
    topics: [
      "Ritmo e microcortes",
      "Zoom, destaque e ênfase",
      "Legendas que seguram",
      "Checklist antes de exportar",
    ],
  },
  {
    number: "06",
    title: "Setup de Guerra",
    subtitle: "Apps e ferramentas para clipadores",
    icon: Wrench,
    topics: [
      "CapCut, VN, InShot, Alight Motion",
      "Premiere, DaVinci, Final Cut",
      "Biblioteca de assets",
      "Setups por nível",
    ],
  },
  {
    number: "07",
    title: "Legenda que Vende",
    subtitle: "CTA, comentário fixado e engajamento",
    icon: ChatText,
    topics: [
      "Fórmulas de legenda que performam",
      "CTA que funciona",
      "30 legendas + 20 CTAs prontos",
      "10 comentários fixados",
    ],
  },
  {
    number: "08",
    title: "Máquina de Conteúdo",
    subtitle: "Como postar todo dia sem perder qualidade",
    icon: Stack,
    topics: [
      "Produção por lotes (batching)",
      "Calendário semanal",
      "Variações do mesmo conteúdo",
      "Rotinas 30min e 2h/dia",
    ],
  },
  {
    number: "09",
    title: "Dinheiro no Bolso",
    subtitle: "Premiação, renda recorrente e clientes",
    icon: Wallet,
    topics: [
      "Premiações diárias e mensais",
      "Portfólio que vende",
      "Como conseguir clientes",
      "Modelos de DM e proposta",
    ],
  },
  {
    number: "10",
    title: "Debug de Performance",
    subtitle: "Por que seu vídeo não performou",
    icon: Bug,
    topics: [
      "20 erros que derrubam alcance",
      "Quando morre no começo",
      "Seu estilo que funciona",
      "Matriz de testes A/B",
    ],
  },
  {
    number: "11",
    title: "Desafio Final",
    subtitle: "7 dias para virar clipador consistente",
    icon: Target,
    topics: [
      "Dia 1-7 passo a passo",
      "Metas e ajustes diários",
      "Plano mensal definitivo",
      "Rotina para competir",
    ],
  },
]

// Depoimentos
const TESTIMONIALS = [
  {
    name: "Rafael Oliveira",
    text: "Eu achava que sabia clipar, mas o manual abriu minha mente. Tripliquei minhas views em 2 semanas!",
    highlight: "3x mais views",
  },
  {
    name: "Carla Santos",
    text: "O capítulo de algoritmos sozinho vale o investimento. Finalmente entendi como viralizar.",
    highlight: "Viralização garantida",
  },
  {
    name: "Bruno Lima",
    text: "Comprei no upsell e não me arrependo. É o complemento perfeito pra Academia Clipadora.",
    highlight: "Complemento perfeito",
  },
]

// O que você vai aprender
const WHAT_YOULL_LEARN = [
  "Como vencer competições diárias e mensais na Clipfy League",
  "Técnicas de edição que prendem a atenção nos primeiros 3 segundos",
  "O segredo dos algoritmos de cada plataforma",
  "Como criar rotina de produção eficiente (30min ou 2h/dia)",
  "Estratégias para aumentar retenção e replay",
  "Como transformar premiações em renda recorrente",
  "Os 20 erros que derrubam alcance (e como evitá-los)",
  "Templates prontos: legendas, CTAs e comentários fixados",
]

// Estrelas do fundo (vocabulário arena-*)
const TWINKLES: Array<{
  top: string
  left: string
  size: string
  color: string
  dur: string
  delay: string
}> = [
  { top: "8%", left: "12%", size: "size-1", color: "bg-brand-cyan/60", dur: "3.6s", delay: "0s" },
  { top: "16%", left: "82%", size: "size-1.5", color: "bg-brand-mint/50", dur: "4.2s", delay: "0.9s" },
  { top: "32%", left: "6%", size: "size-1", color: "bg-brand-green/50", dur: "3.9s", delay: "1.8s" },
  { top: "44%", left: "94%", size: "size-1", color: "bg-brand-cyan/50", dur: "4.5s", delay: "0.5s" },
  { top: "58%", left: "14%", size: "size-1.5", color: "bg-brand-mint/40", dur: "3.7s", delay: "2.4s" },
  { top: "70%", left: "88%", size: "size-1", color: "bg-brand-cyan/50", dur: "4.1s", delay: "1.3s" },
  { top: "84%", left: "28%", size: "size-1", color: "bg-brand-green/50", dur: "4.4s", delay: "3s" },
  { top: "92%", left: "70%", size: "size-1", color: "bg-brand-cyan/40", dur: "3.8s", delay: "2s" },
  { top: "24%", left: "48%", size: "size-1", color: "bg-brand-mint/40", dur: "4.6s", delay: "3.4s" },
]

export default function Upsell() {
  // Timer funcional - 5 minutos
  const [timeLeft, setTimeLeft] = React.useState(5 * 60)

  React.useEffect(() => {
    if (timeLeft <= 0) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  // Carregar script do Kiwify
  React.useEffect(() => {
    const script = document.createElement("script")
    script.src = "https://snippets.kiwify.com/upsell/upsell.min.js"
    script.async = true
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [])

  const handleBuyClick = () => {
    const kiwifyButton = document.getElementById("kiwify-upsell-trigger-DxUITeH")
    if (kiwifyButton) {
      kiwifyButton.click()
    }
  }

  const handleDeclineClick = () => {
    const kiwifyDecline = document.getElementById(
      "kiwify-upsell-cancel-trigger-DxUITeH",
    )
    if (kiwifyDecline) {
      kiwifyDecline.click()
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050f1c] text-white">
      {/* Ambiente da marca — petróleo + auroras + grid + estrelas (fixed cobre tudo) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(1100px_620px_at_50%_-10%,#0a1c2b_0%,#050f1c_58%,#020910_100%)]" />
        <div className="hero-grid absolute inset-0 opacity-30" />
        <div className="arena-aurora absolute -top-40 left-1/2 h-[440px] w-[720px] max-w-[120vw] -translate-x-1/2 rounded-full bg-[#14f7fe]/[0.07] blur-[120px]" />
        <div
          className="arena-aurora absolute top-1/2 -left-40 h-[380px] w-[380px] rounded-full bg-[#1ffec8]/[0.05] blur-[110px]"
          style={{ animationDelay: "-6s" }}
        />
        <div
          className="arena-aurora absolute -right-32 bottom-0 h-[360px] w-[420px] rounded-full bg-[#37fa9c]/[0.05] blur-[110px]"
          style={{ animationDelay: "-3s" }}
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

      {/* Overlay para melhorar legibilidade */}
      <div className="pointer-events-none fixed inset-0 z-[1] bg-black/20" />

      {/* Kiwify Hidden Container */}
      <div
        style={{ display: "none" }}
        id="kiwify-upsell-DxUITeH"
        data-upsell-url=""
        data-downsell-url=""
      >
        <button id="kiwify-upsell-trigger-DxUITeH" style={{ cursor: "pointer" }}>
          Aceitar
        </button>
        <div
          id="kiwify-upsell-cancel-trigger-DxUITeH"
          style={{ cursor: "pointer" }}
        >
          Recusar
        </div>
      </div>

      {/* Conteúdo principal - scrollável por cima do ambiente */}
      <div className="relative z-10">
        {/* Sticky Header com Timer */}
        <header className="fixed top-0 right-0 left-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-[#050f1c]/90 backdrop-blur-xl" />

          {/* Shimmer effect */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="animate-shimmer absolute inset-0 bg-[linear-gradient(90deg,transparent_35%,rgba(20,247,254,0.06)_50%,transparent_65%)] bg-[length:200%_100%]" />
          </div>

          {/* Border glow */}
          <div className="absolute right-0 bottom-0 left-0 h-px bg-gradient-to-r from-transparent via-brand-cyan/50 to-transparent" />

          <div className="relative container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            {/* Left side - Logo + Offer */}
            <div className="flex items-center gap-4">
              {/* Logo (landing dark-fixa: versão branca) */}
              <Image
                src="/images/logo-clipfy-white.svg"
                alt="Clipfy League"
                width={100}
                height={25}
                className="hidden sm:block"
                priority
              />
              <Image
                src="/images/logo-clipfy-white.svg"
                alt="Clipfy League"
                width={80}
                height={20}
                className="sm:hidden"
                priority
              />

              {/* Divider */}
              <div className="hidden h-6 w-px bg-white/20 md:block" />

              {/* Offer Badge */}
              <div className="hidden items-center gap-2 md:flex">
                <span className="bg-gradient-custom rounded-full px-2.5 py-1 text-xs font-bold text-[#04222A]">
                  50% OFF
                </span>
                <span className="text-xs text-white/60">Oferta exclusiva</span>
              </div>
            </div>

            {/* Right side - Timer */}
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-1.5 text-xs text-white/60 sm:flex">
                <Warning className="size-3.5 text-red-400" weight="fill" />
                <span>Expira em:</span>
              </div>
              <div
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${
                  timeLeft < 60
                    ? "border-red-500/50 bg-red-500/10"
                    : "border-brand-cyan/30 bg-brand-cyan/10"
                }`}
              >
                <Timer
                  className={`size-4 ${
                    timeLeft < 60
                      ? "animate-pulse text-red-400"
                      : "text-brand-cyan"
                  }`}
                />
                <span
                  className={`font-mono text-lg font-black tracking-wider ${
                    timeLeft < 60 ? "text-red-400" : "text-white"
                  }`}
                >
                  {formatTime(timeLeft)}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-20">
          <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
            {/* Success Badge */}
            <div className="animate-fade-in-down mx-auto mb-10 max-w-lg text-center">
              <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-6 py-4 backdrop-blur-sm">
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle
                    className="size-5 shrink-0 text-emerald-400"
                    weight="fill"
                  />
                  <span className="text-lg font-semibold text-emerald-300">
                    Parabéns! Sua compra foi confirmada
                  </span>
                </div>
              </div>
            </div>

            <div className="mx-auto max-w-6xl">
              <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
                {/* Left Column - Content */}
                <div className="text-center lg:text-left">
                  {/* Exclusive Offer Badge */}
                  <div
                    className="animate-fade-in-up mb-5 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-brand-cyan/30 bg-gradient-to-r from-brand-cyan/15 to-brand-green/15 px-4 py-2 text-sm font-medium backdrop-blur-sm"
                    style={{ animationDelay: "0.1s" }}
                  >
                    <Lightning
                      className="size-4 text-brand-cyan"
                      weight="fill"
                    />
                    <span className="font-bold text-white">
                      OFERTA EXCLUSIVA
                    </span>
                    <span className="text-white/40">•</span>
                    <span className="text-brand-cyan/80">
                      Só para novos membros
                    </span>
                  </div>

                  <h1
                    className="animate-fade-in-up mb-4 text-2xl leading-tight font-extrabold tracking-tight sm:text-3xl md:text-4xl"
                    style={{ animationDelay: "0.2s" }}
                  >
                    Acelere seus Resultados com o
                    <span className="text-gradient block">
                      Manual do Clipador
                    </span>
                  </h1>

                  <p
                    className="animate-fade-in-up mb-8 text-base text-white/75 sm:text-lg"
                    style={{ animationDelay: "0.3s" }}
                  >
                    <strong className="text-white">
                      Ebook com +60 páginas
                    </strong>{" "}
                    de estratégias, técnicas e segredos que clipadores
                    profissionais usam para{" "}
                    <strong className="text-brand-green">faturar alto</strong>{" "}
                    todo mês.
                  </p>

                  {/* Pricing */}
                  <div
                    className="animate-fade-in-up mb-6 rounded-2xl border-2 border-brand-cyan/40 bg-[#050f1c]/70 p-6 backdrop-blur-xl"
                    style={{ animationDelay: "0.4s" }}
                  >
                    <div className="flex flex-wrap items-center justify-center gap-4 lg:justify-start">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm text-white/50 line-through">
                          R$ {EBOOK_DATA.originalPrice.toFixed(2).replace(".", ",")}
                        </span>
                        <span className="rounded-full bg-brand-green/20 px-2 py-0.5 text-xs font-bold text-brand-green">
                          -{EBOOK_DATA.discountPercent}%
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm text-white/60">R$</span>
                        <span className="text-5xl font-extrabold text-white">
                          9
                        </span>
                        <span className="text-lg text-white/60">,90</span>
                      </div>
                    </div>
                    <p className="mt-2 text-center text-sm text-brand-cyan/80 lg:text-left">
                      Pagamento único • Acesso vitalício • Acesso na plataforma
                    </p>
                  </div>

                  {/* CTA Buttons */}
                  <div
                    className="animate-fade-in-up flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start"
                    style={{ animationDelay: "0.5s" }}
                  >
                    <button
                      onClick={handleBuyClick}
                      className="btn-gradient-auth group relative inline-flex cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl px-8 py-4 text-lg font-bold shadow-xl shadow-brand-cyan/30 transition-all hover:scale-105"
                    >
                      <CreditCard className="size-5" weight="fill" />
                      SIM! Comprar com 1 Click
                      <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
                    </button>
                    <button
                      onClick={handleDeclineClick}
                      className="cursor-pointer px-6 py-3 text-white/50 transition-colors hover:text-white/70"
                    >
                      Não, obrigado
                    </button>
                  </div>

                  {/* Trust Badges */}
                  <div
                    className="animate-fade-in mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-white/60 lg:justify-start"
                    style={{ animationDelay: "0.6s" }}
                  >
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck
                        className="size-4 text-emerald-400"
                        weight="fill"
                      />
                      <span>Garantia de 7 dias</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Lightning
                        className="size-4 text-brand-cyan"
                        weight="fill"
                      />
                      <span>Acesso na plataforma</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Lock
                        className="size-4 text-brand-green"
                        weight="fill"
                      />
                      <span>Pagamento seguro</span>
                    </div>
                  </div>
                </div>

                {/* Right Column - Ebook Visual */}
                <div className="animate-scale-in relative mx-auto max-w-md lg:max-w-none">
                  {/* Ebook Mockup */}
                  <div className="relative">
                    {/* Main Ebook Cover */}
                    <div className="relative mx-auto w-[220px] sm:w-[260px] lg:w-[280px]">
                      {/* Book Cover */}
                      <div className="relative transform-gpu transition-transform duration-500 hover:scale-105">
                        <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl border-2 border-brand-cyan/50 shadow-2xl shadow-brand-cyan/30">
                          {/* Imagem real da capa */}
                          <Image
                            src="/images/Manual-do-Clipador.jpg"
                            alt="Manual do Clipador - Capa"
                            fill
                            sizes="(max-width: 640px) 220px, (max-width: 1024px) 260px, 280px"
                            className="object-cover"
                            priority
                          />

                          {/* Shine Effect */}
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent" />
                        </div>

                        {/* Book Spine Effect */}
                        <div className="pointer-events-none absolute top-0 left-0 h-full w-4 rounded-l-2xl bg-gradient-to-r from-black/50 to-transparent" />
                      </div>
                    </div>

                    {/* Floating Elements */}
                    <div
                      className="hero-float absolute -right-2 top-12 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 backdrop-blur-sm sm:-right-4"
                      style={
                        {
                          "--float-dur": "6s",
                          "--float-delay": "0s",
                        } as React.CSSProperties
                      }
                    >
                      <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
                        <TrendUp className="size-4" weight="bold" />
                        +300% Views
                      </div>
                    </div>

                    <div
                      className="hero-float absolute -left-2 bottom-24 rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 px-3 py-2 backdrop-blur-sm sm:-left-4"
                      style={
                        {
                          "--float-dur": "7s",
                          "--float-delay": "0.8s",
                        } as React.CSSProperties
                      }
                    >
                      <div className="flex items-center gap-2 text-sm font-medium text-brand-cyan">
                        <CurrencyDollar className="size-4" weight="bold" />
                        Aumente seus ganhos
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* O Que Você Vai Aprender */}
        <section className="relative border-y border-brand-cyan/10 bg-[#050f1c]/70 py-16 backdrop-blur-sm sm:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl">
              <div className="mb-12 text-center">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-cyan/30 bg-brand-cyan/10 px-4 py-2 text-sm font-medium text-brand-cyan">
                  <BookOpen className="size-4" />
                  Conteúdo Completo
                </div>
                <h2 className="mb-4 text-2xl font-bold sm:text-3xl">
                  O que você vai aprender no
                  <span className="text-gradient block">
                    Manual do Clipador
                  </span>
                </h2>
              </div>

              <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                {WHAT_YOULL_LEARN.map((item, index) => (
                  <div
                    key={index}
                    className="group flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-4 backdrop-blur-sm transition-all hover:border-brand-cyan/30 hover:bg-brand-cyan/5"
                  >
                    <div className="bg-gradient-custom flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                      <CheckCircle
                        className="size-4 text-[#04222A]"
                        weight="bold"
                      />
                    </div>
                    <p className="text-sm text-white/75 transition-colors group-hover:text-white">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Capítulos do Ebook - COMPLETO */}
        <section className="bg-[#050f1c]/60 py-16 backdrop-blur-sm sm:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
              <div className="mb-12 text-center">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-cyan/30 bg-brand-cyan/10 px-4 py-2 text-sm font-medium text-brand-cyan">
                  <FileText className="size-4" />
                  12 Capítulos Completos
                </div>
                <h2 className="mb-4 text-2xl font-bold sm:text-3xl">
                  Um guia passo a passo para o
                  <span className="text-gradient block">
                    sucesso na clipagem
                  </span>
                </h2>
              </div>

              <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {EBOOK_CHAPTERS.map((chapter) => {
                  const Icon = chapter.icon
                  return (
                    <div
                      key={chapter.number}
                      className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm transition-all hover:scale-[1.02] hover:border-brand-cyan/40 hover:shadow-lg hover:shadow-brand-cyan/10"
                    >
                      <div className="p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <div className="bg-gradient-custom flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-[#04222A] shadow-lg shadow-brand-cyan/30">
                            {chapter.number}
                          </div>
                          <Icon className="size-4 text-brand-cyan" />
                        </div>
                        <h3 className="mb-1 text-sm font-bold text-white">
                          {chapter.title}
                        </h3>
                        <p className="mb-3 text-xs text-white/45">
                          {chapter.subtitle}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {chapter.topics.slice(0, 2).map((topic) => (
                            <span
                              key={topic}
                              className="rounded-full bg-brand-cyan/5 px-2 py-0.5 text-[10px] text-brand-cyan/80"
                            >
                              {topic}
                            </span>
                          ))}
                          {chapter.topics.length > 2 && (
                            <span className="text-[10px] text-white/45">
                              +{chapter.topics.length - 2} mais
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Depoimentos */}
        <section className="border-y border-white/5 bg-[#050f1c]/70 py-16 backdrop-blur-sm sm:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">
              <div className="mb-12 text-center">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-cyan/30 bg-brand-cyan/10 px-4 py-2 text-sm font-medium text-brand-cyan">
                  <Star className="size-4" weight="fill" />
                  Resultados Reais
                </div>
                <h2 className="mb-4 text-2xl font-bold sm:text-3xl">
                  O que dizem os
                  <span className="text-gradient block">
                    clipadores que já leram
                  </span>
                </h2>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                {TESTIMONIALS.map((testimonial, index) => (
                  <div
                    key={index}
                    className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm"
                  >
                    <div className="p-6">
                      <div className="mb-4 flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className="size-4 text-brand-green"
                            weight="fill"
                          />
                        ))}
                      </div>
                      <p className="mb-4 text-sm text-white/75 italic">
                        &quot;{testimonial.text}&quot;
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-white">
                          {testimonial.name}
                        </span>
                        <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
                          {testimonial.highlight}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Comparativo */}
        <section className="bg-[#050f1c]/60 py-16 backdrop-blur-sm sm:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl">
              <div className="mb-12 text-center">
                <h2 className="mb-4 text-2xl font-bold sm:text-3xl">
                  Clipador <span className="text-white/40">Comum</span> vs
                  Clipador{" "}
                  <span className="text-gradient">com o Manual</span>
                </h2>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Comum */}
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6 backdrop-blur-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="rounded-full bg-white/10 p-2">
                      <X className="size-5 text-white/40" weight="bold" />
                    </div>
                    <h3 className="text-lg font-bold text-white/50">
                      Clipador Comum
                    </h3>
                  </div>
                  <ul className="space-y-3">
                    {[
                      "Posta sem estratégia",
                      "Não entende os algoritmos",
                      "Views inconsistentes",
                      "Não monetiza direito",
                      "Desiste em poucos meses",
                    ].map((item, index) => (
                      <li
                        key={index}
                        className="flex items-center gap-2 text-sm text-white/45"
                      >
                        <X className="size-4 shrink-0" weight="bold" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Com Manual */}
                <div className="relative rounded-2xl border-2 border-brand-cyan/50 bg-gradient-to-br from-brand-cyan/5 to-brand-green/5 p-6 backdrop-blur-sm">
                  <div className="bg-gradient-custom absolute -top-3 left-4 rounded-full px-3 py-1 text-xs font-bold text-[#04222A]">
                    VOCÊ
                  </div>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="bg-gradient-custom rounded-full p-2">
                      <Crown className="size-5 text-[#04222A]" weight="fill" />
                    </div>
                    <h3 className="text-lg font-bold text-brand-cyan">
                      Com o Manual
                    </h3>
                  </div>
                  <ul className="space-y-3">
                    {[
                      "Estratégia clara e definida",
                      "Domina cada plataforma",
                      "Views crescendo todo mês",
                      "Múltiplas fontes de renda",
                      "Resultados consistentes",
                    ].map((item, index) => (
                      <li
                        key={index}
                        className="flex items-center gap-2 text-sm text-brand-cyan"
                      >
                        <CheckCircle
                          className="size-4 shrink-0 text-brand-green"
                          weight="fill"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Final */}
        <section className="relative overflow-hidden bg-[#050f1c]/70 py-16 backdrop-blur-sm sm:py-20">
          <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              {/* Urgency */}
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400">
                <Clock className="size-4 animate-pulse" />
                Oferta válida apenas agora!
              </div>

              <h2 className="mb-6 text-2xl font-bold sm:text-3xl md:text-4xl">
                Última chance de garantir o
                <span className="text-gradient block">Manual do Clipador</span>
                com 50% de desconto!
              </h2>

              <p className="mb-8 text-base text-white/75">
                Essa oferta especial é exclusiva para novos membros da Academia
                Clipadora.
                <br />
                <strong className="text-brand-cyan">
                  Depois dessa página, o preço volta a R$ 19,90
                </strong>
                .
              </p>

              {/* Final Price */}
              <div className="mb-8 inline-block rounded-2xl border-2 border-brand-cyan/40 bg-[#050f1c]/80 p-8 backdrop-blur-xl">
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-lg text-white/50 line-through">
                    R$ 19,90
                  </span>
                  <span className="rounded-full bg-brand-green/20 px-3 py-1 text-sm font-bold text-brand-green">
                    -50%
                  </span>
                </div>
                <div className="my-4 flex items-baseline justify-center gap-1">
                  <span className="text-2xl text-white/60">R$</span>
                  <span className="text-7xl font-extrabold text-white">9</span>
                  <span className="text-2xl text-white/60">,90</span>
                </div>
                <p className="text-sm text-brand-cyan/80">
                  Pagamento único • Acesso vitalício
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={handleBuyClick}
                  className="btn-gradient-auth group relative w-full max-w-md cursor-pointer overflow-hidden rounded-xl px-8 py-5 text-xl font-bold shadow-2xl shadow-brand-cyan/40 transition-all hover:scale-105"
                >
                  <span className="flex items-center justify-center gap-2">
                    <CreditCard className="size-6" weight="fill" />
                    COMPRAR COM 1 CLICK!
                    <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
                  </span>
                </button>

                <button
                  onClick={handleDeclineClick}
                  className="cursor-pointer text-white/45 transition-colors hover:text-white/60"
                >
                  Não, vou perder essa oportunidade
                </button>
              </div>

              {/* Garantia */}
              <div className="mt-10 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-6 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <div className="rounded-full bg-emerald-400/20 p-4">
                    <ShieldCheck
                      className="size-10 text-emerald-300"
                      weight="fill"
                    />
                  </div>
                  <div className="text-center sm:text-left">
                    <h4 className="mb-1 text-lg font-bold text-emerald-300">
                      Garantia Incondicional de 7 Dias
                    </h4>
                    <p className="text-sm text-white/75">
                      Se por qualquer motivo você não ficar satisfeito com o
                      conteúdo, basta enviar um email e devolvemos 100% do seu
                      dinheiro. Sem perguntas, sem burocracia.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer Mínimo */}
        <footer className="border-t border-white/5 bg-[#050f1c]/85 py-8 backdrop-blur-sm">
          <div className="container mx-auto px-4 text-center">
            <Image
              src="/images/logo-clipfy-white.svg"
              alt="Clipfy League"
              width={100}
              height={25}
              className="mx-auto"
            />
            <p className="mt-3 text-xs text-white/45">
              © {new Date().getFullYear()} Clipfy League. Todos os direitos
              reservados.
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
