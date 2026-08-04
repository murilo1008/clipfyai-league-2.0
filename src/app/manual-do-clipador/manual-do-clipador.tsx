"use client"

import React, { useEffect, useRef, useState } from "react"
import Image from "next/image"

import {
  ArrowRight,
  BookOpen,
  Brain,
  Bug,
  CaretDown,
  ChatText,
  Check,
  CheckCircle,
  CreditCard,
  Crown,
  CurrencyDollar,
  FileText,
  Flame,
  Lightning,
  Lock,
  Play,
  Rocket,
  ShieldCheck,
  Sparkle,
  SpeakerHigh,
  Stack,
  Star,
  Target,
  Timer,
  TrendUp,
  Trophy,
  Wallet,
  Wrench,
  X,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { cn } from "@/lib/utils"

// Dados do produto
const EBOOK_DATA = {
  name: "Manual do Clipador",
  subtitle: "Clipfy League Edition",
  price: 9.9,
  originalPrice: 19.9,
  discountPercent: 50,
  pages: 60,
  checkoutUrl: "https://pay.kiwify.com.br/0eiXb6e",
}

// Acentos que ciclam pelos capítulos (mesma paleta do pricing dialog do Manual)
const CHAPTER_ACCENTS = [
  { icon: "text-violet-400", bg: "bg-violet-500/10" },
  { icon: "text-cyan-400", bg: "bg-cyan-500/10" },
  { icon: "text-amber-400", bg: "bg-amber-500/10" },
  { icon: "text-emerald-400", bg: "bg-emerald-500/10" },
]

// Capítulos do Ebook
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

// FAQ
const FAQ_ITEMS = [
  {
    question: "Quanto tempo tenho para acessar o conteúdo?",
    answer:
      "Após a compra, você tem acesso vitalício ao Manual do Clipador diretamente na plataforma da Clipfy League. Acesse quando quiser, quantas vezes quiser.",
  },
  {
    question: "O Manual é atualizado?",
    answer:
      "Sim! Sempre que houver mudanças relevantes nos algoritmos ou novas estratégias, o manual será atualizado e você terá acesso automático às novas versões.",
  },
  {
    question: "Preciso de experiência prévia com clipagem?",
    answer:
      "Não! O manual foi pensado tanto para iniciantes quanto para clipadores experientes. Começamos do zero e avançamos até técnicas profissionais.",
  },
  {
    question: "O pagamento é único ou recorrente?",
    answer:
      "Pagamento único! Você paga uma vez e tem acesso para sempre. Sem mensalidades, sem surpresas.",
  },
  {
    question: "E se eu não gostar do conteúdo?",
    answer:
      "Oferecemos garantia incondicional de 7 dias. Se por qualquer motivo não ficar satisfeito, devolvemos 100% do seu dinheiro sem perguntas.",
  },
  {
    question: "Recebo algo físico?",
    answer:
      "O Manual do Clipador é um conteúdo 100% digital, acessível diretamente pela plataforma da Clipfy League. Nada será enviado fisicamente.",
  },
]

// CSS Dark Mode para o modal do Kiwify — repaginado com o petróleo da marca
const kiwifyDarkModeCSS = `
  /* Container principal do modal */
  #kiwify-upsell-modal-content {
    background: #0a1c2b !important;
    border: 1px solid rgba(255,255,255,0.14) !important;
    box-shadow: 0 25px 50px -12px rgba(2,8,15,0.75) !important;
    border-radius: 16px !important;
  }

  /* Forçar fundo escuro em todos os elementos com bg-white */
  .kw-bg-white,
  #kiwify-upsell-modal-content .kw-bg-white,
  #kiwify-upsell-modal-content > div,
  #kiwify-upsell-modal-content div[class*="bg-white"],
  #kiwify-upsell-modal-content div[class*="kw-bg-white"] {
    background: #0a1c2b !important;
    background-color: #0a1c2b !important;
  }

  /* Textos */
  #kiwify-upsell-modal-content,
  #kiwify-upsell-modal-content * {
    color: #d8e8ef !important;
  }

  #kiwify-upsell-modal-content h1,
  #kiwify-upsell-modal-content h2,
  #kiwify-upsell-modal-content h3,
  #kiwify-upsell-modal-content strong {
    color: #f4fbfd !important;
  }

  /* Select/dropdown */
  #kiwify-upsell-modal-content select,
  #kiwify-upsell-modal-content input {
    background: #10293d !important;
    color: #d8e8ef !important;
    border: 1px solid rgba(255,255,255,0.18) !important;
    border-radius: 12px !important;
  }

  #kiwify-upsell-modal-content select:focus,
  #kiwify-upsell-modal-content input:focus {
    border-color: #14f7fe !important;
    box-shadow: 0 0 0 3px rgba(20,247,254,0.2) !important;
    outline: none !important;
  }

  /* Dropdown options */
  #kiwify-upsell-modal-content option {
    background: #10293d !important;
    color: #d8e8ef !important;
  }

  /* Estilo base dos botões */
  #kiwify-upsell-modal-content button {
    border-radius: 12px !important;
    font-weight: 600 !important;
    padding: 12px 24px !important;
    transition: all 0.2s ease !important;
    cursor: pointer !important;
  }

  /* Botão Confirmar (primeiro no DOM, aparece à direita) - gradiente */
  #kiwify-upsell-modal-content button:first-of-type {
    background: linear-gradient(to right, #f59e0b, #f97316) !important;
    background-image: linear-gradient(to right, #f59e0b, #f97316) !important;
    color: #fff !important;
    border: none !important;
  }

  #kiwify-upsell-modal-content button:first-of-type:hover {
    transform: scale(1.02) !important;
    box-shadow: 0 10px 30px -5px rgba(245,158,11,0.4) !important;
  }

  /* Botão Cancelar (último no DOM, aparece à esquerda) - transparente */
  #kiwify-upsell-modal-content button:last-of-type {
    background: transparent !important;
    background-image: none !important;
    color: #d8e8ef !important;
    border: none !important;
  }

  #kiwify-upsell-modal-content button:last-of-type:hover {
    color: #ffffff !important;
  }

  /* Links */
  #kiwify-upsell-modal-content a {
    color: #14f7fe !important;
  }

  /* Bordas internas */
  #kiwify-upsell-modal-content [class*="border"] {
    border-color: rgba(255,255,255,0.1) !important;
  }
`

export default function ManualDoClipador() {
  const [isVideoPlaying, setIsVideoPlaying] = useState(true)
  const [isVideoMuted, setIsVideoMuted] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Carregar script do Kiwify
  useEffect(() => {
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

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    element?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050f1c] text-white">
      {/* CSS Dark Mode para o modal do Kiwify */}
      <style dangerouslySetInnerHTML={{ __html: kiwifyDarkModeCSS }} />

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

      {/* Ambiente petróleo fixo — grade fina + auroras da marca */}
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1100px_700px_at_50%_118%,rgba(5,33,43,0.9),transparent_60%),radial-gradient(900px_540px_at_78%_-12%,rgba(8,40,48,0.55),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(20,247,254,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(20,247,254,0.04)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,black_30%,transparent_100%)]" />
        <span className="arena-aurora absolute -top-32 -left-24 size-[26rem] rounded-full bg-amber-500/[0.08] blur-3xl sm:size-[32rem]" />
        <span
          className="arena-aurora absolute top-1/3 -right-28 size-[24rem] rounded-full bg-[rgba(20,247,254,0.06)] blur-3xl"
          style={{ animationDelay: "-7s" }}
        />
        <span
          className="arena-aurora absolute -bottom-36 left-1/4 size-[26rem] rounded-full bg-orange-500/[0.06] blur-3xl"
          style={{ animationDelay: "-4s" }}
        />
      </div>

      {/* Conteúdo principal */}
      <div className="relative">
        {/* Hero Section with VSL */}
        <section className="relative overflow-hidden pt-8 pb-12 sm:pt-12 sm:pb-16">
          <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl text-center">
              {/* Urgency Badge */}
              <div className="animate-fade-in-down mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400">
                <Flame className="size-4 animate-pulse" weight="fill" />
                OFERTA ESPECIAL — 50% OFF
                <Flame className="size-4 animate-pulse" weight="fill" />
              </div>

              <h1
                className="animate-fade-in-up mb-4 text-2xl leading-tight font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl"
                style={{ animationDelay: "0.2s" }}
              >
                Domine a arte da clipagem com o
                <span className="block bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                  Manual do Clipador
                </span>
              </h1>

              <p
                className="animate-fade-in-up mx-auto mb-8 max-w-2xl text-lg text-white/70 sm:text-xl"
                style={{ animationDelay: "0.4s" }}
              >
                <strong className="text-white">Ebook com +60 páginas</strong> de
                estratégias, técnicas e segredos que clipadores profissionais
                usam para{" "}
                <strong className="text-amber-400">faturar alto</strong> todo
                mês.
              </p>

              {/* VSL Video Container */}
              <div
                className="animate-scale-in mx-auto mb-8 max-w-4xl"
                style={{ animationDelay: "0.5s" }}
              >
                <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500/30 bg-black/60 shadow-2xl shadow-amber-500/20">
                  {/* Video Aspect Ratio Container (16:9) */}
                  <div className="relative aspect-video w-full">
                    {!isVideoPlaying ? (
                      // Thumbnail with Play Button
                      <div
                        className="absolute inset-0 flex cursor-pointer items-center justify-center bg-gradient-to-br from-[#0a1c2b] to-[#02080f]"
                        onClick={() => setIsVideoPlaying(true)}
                      >
                        {/* Placeholder Thumbnail */}
                        <div className="absolute inset-0 bg-[url('/images/Manual-do-Clipador.jpg')] bg-cover bg-center opacity-40" />

                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />

                        {/* Play Button */}
                        <div className="relative z-10 flex flex-col items-center gap-4">
                          <div className="group flex size-20 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/50 transition-all hover:scale-110 sm:size-24">
                            <Play
                              className="size-8 text-white transition-transform group-hover:scale-110 sm:size-10"
                              weight="fill"
                            />
                          </div>
                          <span className="text-lg font-semibold text-white drop-shadow-lg">
                            Assista ao vídeo
                          </span>
                        </div>

                        {/* Video Duration Badge */}
                        <div className="absolute right-4 bottom-4 flex items-center gap-2 rounded-lg bg-black/70 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
                          <Timer className="size-4" weight="fill" />
                          5:30
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Actual Video Player */}
                        <video
                          ref={videoRef}
                          className="absolute inset-0 h-full w-full object-cover"
                          src="/videos/vsl-03.mp4"
                          autoPlay
                          muted
                          playsInline
                          onEnded={(e) => {
                            e.currentTarget.currentTime = 0
                            e.currentTarget.pause()
                          }}
                        />

                        {/* "Click to enable audio" overlay button */}
                        {isVideoMuted && (
                          <div className="absolute inset-0 z-20 flex items-center justify-center">
                            <button
                              onClick={() => {
                                if (videoRef.current) {
                                  videoRef.current.muted = false
                                  videoRef.current.currentTime = 0
                                  void videoRef.current.play()
                                  setIsVideoMuted(false)
                                }
                              }}
                              className="group flex cursor-pointer items-center gap-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 shadow-2xl shadow-amber-500/50 transition-all duration-300 hover:scale-110 hover:shadow-amber-500/70 active:scale-95 sm:px-8 sm:py-5"
                            >
                              <SpeakerHigh
                                className="size-6 text-white sm:size-7"
                                weight="fill"
                              />
                              <span className="text-base font-bold whitespace-nowrap text-white sm:text-lg">
                                Clique para ouvir
                              </span>
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* CTA Buttons */}
              <div
                className="animate-fade-in mx-auto flex w-full max-w-md flex-col items-center gap-3"
                style={{ animationDelay: "0.7s" }}
              >
                <button
                  onClick={handleBuyClick}
                  className="group relative flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl border-none bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-5 text-lg font-bold text-white transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-amber-500/40"
                >
                  <BookOpen className="size-5" weight="fill" />
                  SIM! QUERO O MANUAL AGORA
                  <ArrowRight
                    className="size-5 transition-transform group-hover:translate-x-1"
                    weight="bold"
                  />
                </button>
                <button
                  onClick={handleDeclineClick}
                  className="w-full cursor-pointer rounded-xl border-2 border-white/60 bg-transparent py-4 text-center text-base font-semibold text-white transition-all hover:bg-white/10"
                >
                  Não, obrigado
                </button>
              </div>

              {/* Trust Badges */}
              <div
                className="animate-fade-in mt-8 flex flex-wrap items-center justify-center gap-6"
                style={{ animationDelay: "0.8s" }}
              >
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <ShieldCheck className="size-5 text-emerald-400" weight="fill" />
                  Garantia de 7 dias
                </div>
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Lock className="size-5 text-emerald-400" weight="fill" />
                  Pagamento seguro
                </div>
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <CheckCircle className="size-5 text-emerald-400" weight="fill" />
                  Acesso vitalício
                </div>
              </div>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 animate-bounce">
            <CaretDown className="size-6 text-white/40" weight="bold" />
          </div>
        </section>

        {/* O Que é o Manual - Section */}
        <section className="relative overflow-hidden py-16 sm:py-20">
          {/* Subtle Background */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute top-1/2 left-0 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-amber-500/10 blur-[100px]" />
            <div className="absolute top-1/2 right-0 h-[300px] w-[300px] -translate-y-1/2 rounded-full bg-[rgba(20,247,254,0.08)] blur-[100px]" />
          </div>

          <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
              <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
                {/* Left Side - Ebook Cover */}
                <div className="relative order-2 flex justify-center lg:order-1">
                  <div className="group relative">
                    {/* Glow effect behind image */}
                    <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-amber-500/25 to-orange-500/20 opacity-60 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />

                    {/* Main Ebook Cover */}
                    <div className="relative mx-auto w-[220px] sm:w-[260px] lg:w-[300px]">
                      <div className="relative transform-gpu transition-transform duration-500 hover:scale-105">
                        <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl border-2 border-amber-500/50 shadow-2xl shadow-amber-500/30">
                          <Image
                            src="/images/Manual-do-Clipador.jpg"
                            alt="Manual do Clipador - Capa"
                            fill
                            sizes="(min-width: 1024px) 300px, (min-width: 640px) 260px, 220px"
                            className="object-cover"
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
                      className="hero-float absolute top-12 -right-4 hidden rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 backdrop-blur-sm sm:block"
                      style={{ "--float-dur": "5s" } as React.CSSProperties}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                        <TrendUp className="size-4" weight="bold" />
                        +300% Views
                      </div>
                    </div>

                    <div
                      className="hero-float absolute bottom-24 -left-4 hidden rounded-xl border border-[#14f7fe]/30 bg-[#14f7fe]/10 px-3 py-2 backdrop-blur-sm sm:block"
                      style={
                        {
                          "--float-dur": "6s",
                          "--float-delay": "0.8s",
                        } as React.CSSProperties
                      }
                    >
                      <div className="flex items-center gap-2 text-sm font-medium text-[#14f7fe]">
                        <CurrencyDollar className="size-4" weight="bold" />
                        Aumente seus ganhos
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side - Content */}
                <div className="order-1 lg:order-2">
                  {/* Badge */}
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400">
                    <BookOpen className="size-4" weight="fill" />
                    +60 páginas de conteúdo
                  </div>

                  {/* Title */}
                  <h2 className="mb-4 text-3xl leading-tight font-bold sm:text-4xl lg:text-5xl">
                    O que é o{" "}
                    <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                      Manual do Clipador
                    </span>
                  </h2>

                  {/* Description */}
                  <p className="mb-6 text-lg leading-relaxed text-white/60">
                    O guia definitivo para quem quer{" "}
                    <strong className="text-white">
                      dominar a arte da clipagem
                    </strong>{" "}
                    e transformar cortes em uma fonte de renda consistente. Do
                    iniciante ao profissional em 12 capítulos.
                  </p>

                  {/* Benefits List */}
                  <div className="mb-8 space-y-3">
                    {[
                      {
                        icon: Brain,
                        text: "Mentalidade e estratégias de clipadores profissionais",
                        chip: "border-violet-500/30 bg-violet-500/10",
                        color: "text-violet-400",
                      },
                      {
                        icon: TrendUp,
                        text: "Domine os algoritmos e faça seus cortes explodirem",
                        chip: "border-cyan-400/30 bg-cyan-400/10",
                        color: "text-cyan-400",
                      },
                      {
                        icon: CurrencyDollar,
                        text: "Transforme premiações em renda recorrente",
                        chip: "border-emerald-500/30 bg-emerald-500/10",
                        color: "text-emerald-400",
                      },
                    ].map((item, i) => (
                      <div key={i} className="group flex items-center gap-3">
                        <div
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-lg border transition-all duration-300 group-hover:scale-110",
                            item.chip,
                          )}
                        >
                          <item.icon
                            className={cn("size-4", item.color)}
                            weight="fill"
                          />
                        </div>
                        <span className="font-medium text-white/70 transition-colors group-hover:text-white">
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Stats Row - Mobile Only */}
                  <div className="mb-6 grid grid-cols-2 gap-3 sm:hidden">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                      <div className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-2xl font-black text-transparent">
                        +60
                      </div>
                      <div className="text-xs text-white/50">páginas</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                      <div className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-2xl font-black text-transparent">
                        12
                      </div>
                      <div className="text-xs text-white/50">capítulos</div>
                    </div>
                  </div>

                  {/* CTA Text */}
                  <div className="flex items-center gap-2 text-sm text-white/50">
                    <CheckCircle className="size-4 text-emerald-400" weight="fill" />
                    <span>
                      Pagamento único •{" "}
                      <strong className="text-white">Acesso vitalício</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* O Que Você Vai Aprender */}
        <section className="relative overflow-hidden py-16 sm:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl">
              <div className="mb-12 text-center">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400">
                  <Sparkle className="size-4" weight="fill" />
                  Conteúdo Completo
                </div>
                <h2 className="mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
                  O que você vai aprender no
                  <span className="block bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                    Manual do Clipador
                  </span>
                </h2>
              </div>

              <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                {WHAT_YOULL_LEARN.map((item, index) => (
                  <div
                    key={index}
                    className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm transition-all hover:border-amber-400/40 hover:bg-amber-500/5"
                  >
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-500">
                      <Check className="size-3.5 text-white" weight="bold" />
                    </div>
                    <p className="text-sm text-white/70 transition-colors group-hover:text-white">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Capítulos do Ebook */}
        <section id="capitulos" className="scroll-mt-20 py-16 sm:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
              <div className="mb-12 text-center sm:mb-16">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#37fa9c]/30 bg-[#37fa9c]/10 px-4 py-2 text-sm font-medium text-[#37fa9c]">
                  <FileText className="size-4" weight="fill" />
                  12 Capítulos Completos
                </div>
                <h2 className="mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
                  Um guia passo a passo para o
                  <span className="block bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                    sucesso na clipagem
                  </span>
                </h2>
                <p className="mx-auto max-w-2xl text-lg text-white/60">
                  Cada capítulo foi pensado para te levar do zero ao
                  profissional de forma estruturada
                </p>
              </div>

              {/* Desktop - 4 columns */}
              <div className="hidden gap-4 lg:grid lg:grid-cols-4">
                {EBOOK_CHAPTERS.map((chapter, index) => {
                  const Icon = chapter.icon
                  const accent = CHAPTER_ACCENTS[index % CHAPTER_ACCENTS.length]!
                  return (
                    <div
                      key={chapter.number}
                      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-5 transition-all duration-300 hover:-translate-y-2 hover:border-amber-400/50 hover:shadow-xl hover:shadow-amber-500/20"
                    >
                      {/* Número grande no fundo */}
                      <div className="absolute -top-4 -right-2 text-[80px] leading-none font-black text-white/[0.03] select-none">
                        {chapter.number}
                      </div>

                      <div className="relative z-10">
                        {/* Icon + Number */}
                        <div className="mb-4 flex items-center gap-2">
                          <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-xs font-bold text-white shadow-lg shadow-amber-500/30 transition-all duration-300 group-hover:scale-110">
                            {chapter.number}
                          </div>
                          <span
                            className={cn(
                              "flex size-7 items-center justify-center rounded-md",
                              accent.bg,
                            )}
                          >
                            <Icon
                              className={cn("size-4", accent.icon)}
                              weight="fill"
                            />
                          </span>
                        </div>

                        <h3 className="mb-1 text-sm font-bold text-white transition-colors group-hover:text-amber-300">
                          {chapter.title}
                        </h3>
                        <p className="mb-3 text-xs text-white/45">
                          {chapter.subtitle}
                        </p>

                        <div className="flex flex-wrap gap-1">
                          {chapter.topics.slice(0, 2).map((topic) => (
                            <span
                              key={topic}
                              className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300/80"
                            >
                              {topic}
                            </span>
                          ))}
                          {chapter.topics.length > 2 && (
                            <span className="text-[10px] text-white/40">
                              +{chapter.topics.length - 2} mais
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Decorative corner glow */}
                      <div className="absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-gradient-to-br from-amber-500/10 to-orange-500/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
                    </div>
                  )
                })}
              </div>

              {/* Tablet - 2 columns */}
              <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:hidden">
                {EBOOK_CHAPTERS.map((chapter, index) => {
                  const Icon = chapter.icon
                  const accent = CHAPTER_ACCENTS[index % CHAPTER_ACCENTS.length]!
                  return (
                    <div
                      key={chapter.number}
                      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-5 transition-all duration-300 hover:border-amber-400/50 hover:shadow-lg hover:shadow-amber-500/20"
                    >
                      <div className="absolute -top-4 -right-2 text-[100px] leading-none font-black text-white/[0.03] select-none">
                        {chapter.number}
                      </div>

                      <div className="relative z-10 flex items-start gap-4">
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg">
                          <span className="text-sm font-bold text-white">
                            {chapter.number}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-1.5">
                            <Icon
                              className={cn("size-3.5", accent.icon)}
                              weight="fill"
                            />
                            <span className="text-xs text-white/45">
                              {chapter.topics.length} tópicos
                            </span>
                          </div>
                          <h3 className="mb-1 text-base font-bold text-white">
                            {chapter.title}
                          </h3>
                          <p className="text-xs text-white/55">
                            {chapter.subtitle}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Mobile - Timeline */}
              <div className="sm:hidden">
                <div className="relative">
                  {/* Linha vertical */}
                  <div className="absolute top-0 bottom-0 left-[27px] w-0.5 bg-gradient-to-b from-amber-400 via-orange-400 to-amber-500" />

                  <div className="space-y-5">
                    {EBOOK_CHAPTERS.map((chapter, index) => {
                      const Icon = chapter.icon
                      const accent =
                        CHAPTER_ACCENTS[index % CHAPTER_ACCENTS.length]!
                      return (
                        <div key={chapter.number} className="relative flex gap-4">
                          {/* Círculo do capítulo */}
                          <div className="relative z-10 flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30">
                            <span className="text-sm font-bold text-white">
                              {chapter.number}
                            </span>
                          </div>

                          {/* Card de conteúdo */}
                          <div className="flex-1 rounded-xl border border-white/10 bg-white/5 p-4">
                            <div className="mb-1 flex items-center gap-1.5">
                              <Icon
                                className={cn("size-3.5", accent.icon)}
                                weight="fill"
                              />
                              <span className="text-xs text-white/45">
                                {chapter.topics.length} tópicos
                              </span>
                            </div>
                            <h3 className="mb-1 text-base font-bold text-white">
                              {chapter.title}
                            </h3>
                            <p className="text-sm leading-relaxed text-white/55">
                              {chapter.subtitle}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Bottom Stats */}
              <div className="mt-12 sm:mt-16">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { value: "+60", label: "Páginas", icon: FileText, color: "text-amber-400" },
                    { value: "12", label: "Capítulos", icon: BookOpen, color: "text-cyan-400" },
                    { value: "∞", label: "Acesso vitalício", icon: Lightning, color: "text-[#1ffec8]" },
                    { value: "100%", label: "Prático", icon: Target, color: "text-emerald-400" },
                  ].map((stat, index) => (
                    <div
                      key={index}
                      className="group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-4 text-center transition-all duration-300 hover:border-amber-400/50 sm:p-6"
                    >
                      <stat.icon
                        className={cn("mx-auto mb-2 size-5 sm:size-6", stat.color)}
                        weight="fill"
                      />
                      <div className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
                        {stat.value}
                      </div>
                      <div className="mt-1 text-xs text-white/50 sm:text-sm">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Comparativo */}
        <section className="relative overflow-hidden py-16 sm:py-24">
          {/* Background */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute top-1/2 left-1/4 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-amber-500/5 blur-[120px]" />
          </div>

          <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl">
              <div className="mb-12 text-center">
                <h2 className="mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
                  Clipador <span className="text-white/40">Comum</span> vs
                  Clipador{" "}
                  <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                    com o Manual
                  </span>
                </h2>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Comum */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-sm">
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
                <div className="relative rounded-2xl border-2 border-amber-500/50 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-6 backdrop-blur-sm">
                  <div className="absolute -top-3 left-4 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1 text-xs font-bold text-white">
                    VOCÊ
                  </div>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="rounded-full bg-gradient-to-br from-amber-500 to-orange-500 p-2">
                      <Crown className="size-5 text-white" weight="fill" />
                    </div>
                    <h3 className="text-lg font-bold text-amber-400">
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
                        className="flex items-center gap-2 text-sm text-amber-300"
                      >
                        <CheckCircle
                          className="size-4 shrink-0 text-emerald-400"
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

        {/* Passo a Passo - O que acontece após a compra */}
        <section className="py-16 sm:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
              {/* Header */}
              <div className="mb-12 text-center sm:mb-16">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#14f7fe]/30 bg-[#14f7fe]/10 px-4 py-2 text-sm font-medium text-[#14f7fe]">
                  <Rocket className="size-4" weight="fill" />
                  Simples e rápido
                </div>
                <h2 className="mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
                  Como funciona após{" "}
                  <span className="bg-gradient-to-r from-[#14f7fe] via-[#1ffec8] to-[#37fa9c] bg-clip-text text-transparent">
                    a compra
                  </span>
                </h2>
                <p className="mx-auto max-w-2xl text-lg text-white/60">
                  Em 3 passos simples, você já estará dominando a arte da
                  clipagem
                </p>
              </div>

              {/* Desktop */}
              <div className="relative hidden lg:block">
                {/* Linha conectora */}
                <div className="absolute top-[60px] right-[16%] left-[16%] h-1 rounded-full bg-gradient-to-r from-[#14f7fe]/20 via-[#1ffec8]/40 to-[#37fa9c]/20" />

                <div className="grid grid-cols-3 gap-8">
                  {[
                    {
                      step: 1,
                      icon: CreditCard,
                      title: "Faça sua Compra",
                      description:
                        "Pagamento seguro e processado na hora. Acesso liberado instantaneamente.",
                      color: "from-[#14f7fe] to-[#1ffec8]",
                    },
                    {
                      step: 2,
                      icon: BookOpen,
                      title: "Acesse o Manual",
                      description:
                        "Conteúdo disponível direto na plataforma da Clipfy League.",
                      color: "from-[#1ffec8] to-[#2bfcb2]",
                    },
                    {
                      step: 3,
                      icon: CurrencyDollar,
                      title: "Aplique e Fature",
                      description:
                        "Coloque as estratégias em prática e comece a ver resultados.",
                      color: "from-[#2bfcb2] to-[#37fa9c]",
                    },
                  ].map((item, index) => (
                    <div
                      key={index}
                      className="group flex flex-col items-center text-center"
                    >
                      <div className="relative mb-6">
                        <div
                          className={`relative z-10 flex h-[120px] w-[120px] items-center justify-center rounded-full bg-gradient-to-br ${item.color} shadow-lg shadow-[#14f7fe]/25 transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-[#14f7fe]/40`}
                        >
                          <item.icon
                            className="size-10 text-[#04222A]"
                            weight="fill"
                          />
                        </div>
                        <div className="absolute -top-2 -right-2 flex size-8 items-center justify-center rounded-full border-2 border-[#14f7fe] bg-[#050f1c] text-sm font-bold text-[#14f7fe]">
                          {item.step}
                        </div>
                        <div className="absolute inset-0 rounded-full bg-[#14f7fe]/20 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100" />
                      </div>

                      <h3 className="mb-2 text-lg font-bold text-white transition-colors group-hover:text-[#14f7fe]">
                        {item.title}
                      </h3>
                      <p className="px-2 text-sm leading-relaxed text-white/60">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobile + Tablet */}
              <div className="lg:hidden">
                <div className="relative">
                  <div className="absolute top-0 bottom-0 left-[27px] w-0.5 bg-gradient-to-b from-[#14f7fe] via-[#1ffec8] to-[#37fa9c]" />

                  <div className="space-y-6">
                    {[
                      {
                        step: 1,
                        icon: CreditCard,
                        title: "Faça sua Compra",
                        description:
                          "Pagamento seguro e processado na hora. Acesso liberado instantaneamente.",
                      },
                      {
                        step: 2,
                        icon: BookOpen,
                        title: "Acesse o Manual",
                        description:
                          "Conteúdo disponível direto na plataforma da Clipfy League.",
                      },
                      {
                        step: 3,
                        icon: CurrencyDollar,
                        title: "Aplique e Fature",
                        description:
                          "Coloque as estratégias em prática e comece a ver resultados.",
                      },
                    ].map((item, index) => (
                      <div key={index} className="relative flex gap-4">
                        <div className="relative z-10 flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#14f7fe] to-[#37fa9c] shadow-lg shadow-[#14f7fe]/25">
                          <item.icon
                            className="size-6 text-[#04222A]"
                            weight="fill"
                          />
                          <div className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full border border-[#14f7fe] bg-[#050f1c] text-[10px] font-bold text-[#14f7fe]">
                            {item.step}
                          </div>
                        </div>

                        <div className="flex-1 rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-[#14f7fe]/30">
                          <h3 className="mb-1 text-base font-bold text-white">
                            {item.title}
                          </h3>
                          <p className="text-sm leading-relaxed text-white/60">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section
          id="preco"
          className="relative scroll-mt-20 overflow-hidden py-16 sm:py-24"
        >
          {/* Background Effects */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 blur-[120px]" />
          </div>

          <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="mb-12 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400">
                <Lightning className="size-4" weight="fill" />
                Oferta especial por tempo limitado
              </div>
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
                Garanta o seu{" "}
                <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                  Manual do Clipador
                </span>
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-white/60">
                O investimento mais inteligente que um clipador pode fazer
              </p>
            </div>

            {/* Pricing Card */}
            <div className="mx-auto max-w-md">
              <div className="group relative">
                {/* Animated border glow */}
                <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500 opacity-40 blur transition-opacity duration-500 group-hover:opacity-60" />

                {/* Card */}
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a1c2b] via-[#050f1c] to-[#0a1c2b]">
                  {/* Best Value Badge */}
                  <div className="absolute top-0 right-0">
                    <div className="rounded-bl-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-xs font-bold text-white">
                      ⚡ 50% OFF
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-6 sm:p-8">
                    {/* Plan Name */}
                    <div className="mb-5 flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500">
                        <BookOpen className="size-5 text-white" weight="fill" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">
                          Manual do Clipador
                        </h3>
                        <p className="text-xs text-white/50">
                          Ebook com +60 páginas
                        </p>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mb-5 border-b border-white/10 pb-5">
                      <div className="flex items-end gap-2">
                        <span className="text-base text-white/40 line-through">
                          R$19,90
                        </span>
                        <div className="flex items-baseline">
                          <span className="text-base text-white/50">R$</span>
                          <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-5xl leading-none font-black text-transparent">
                            9
                          </span>
                          <span className="text-lg text-white/50">,90</span>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-white/45">
                        Pagamento único • Acesso vitalício • Acesso na
                        plataforma
                      </p>
                    </div>

                    {/* Features */}
                    <div className="mb-5 grid grid-cols-2 gap-2">
                      {[
                        "12 capítulos completos",
                        "+60 páginas",
                        "Acesso vitalício",
                        "Atualizações grátis",
                        "Templates prontos",
                        "Exercícios práticos",
                      ].map((feature, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Check
                            className="size-4 shrink-0 text-amber-400"
                            weight="bold"
                          />
                          <span className="text-sm text-white/70">
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* CTA Buttons */}
                    <div className="space-y-3">
                      <button
                        onClick={handleBuyClick}
                        className="group relative flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl border-none bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 text-base font-bold text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-amber-500/30"
                      >
                        <CreditCard className="size-5" weight="fill" />
                        SIM! COMPRAR COM 1 CLICK
                        <ArrowRight
                          className="size-5 transition-transform group-hover:translate-x-1"
                          weight="bold"
                        />
                      </button>
                      <button
                        onClick={handleDeclineClick}
                        className="w-full cursor-pointer rounded-xl border-2 border-white/60 bg-transparent py-4 text-center text-base font-semibold text-white transition-all hover:bg-white/10"
                      >
                        Não, obrigado
                      </button>
                    </div>

                    {/* Trust Indicators */}
                    <div className="mt-4 flex items-center justify-center gap-4 text-xs text-white/45">
                      <div className="flex items-center gap-1">
                        <ShieldCheck
                          className="size-3.5 text-emerald-400"
                          weight="fill"
                        />
                        <span>Seguro</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Lock
                          className="size-3.5 text-emerald-400"
                          weight="fill"
                        />
                        <span>Protegido</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star
                          className="size-3.5 text-emerald-400"
                          weight="fill"
                        />
                        <span>Acesso vitalício</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Accent */}
                  <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500" />
                </div>
              </div>

              {/* Guarantee Section */}
              <div className="mt-8">
                <div className="group relative">
                  <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-emerald-500/30 to-[#37fa9c]/30 opacity-50 blur" />
                  <div className="relative flex flex-col items-center gap-4 rounded-2xl border border-emerald-500/20 bg-[#050f1c] p-5 sm:flex-row sm:gap-6 sm:p-6">
                    {/* Guarantee Image */}
                    <div className="shrink-0">
                      <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl" />
                        <div className="relative flex size-20 items-center justify-center rounded-full border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-[#37fa9c]/20 sm:size-24">
                          <ShieldCheck
                            className="size-10 text-emerald-400 sm:size-12"
                            weight="fill"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Guarantee Text */}
                    <div className="text-center sm:text-left">
                      <h4 className="mb-1 text-lg font-bold text-white sm:text-xl">
                        Garantia de{" "}
                        <span className="bg-gradient-to-r from-emerald-400 to-[#37fa9c] bg-clip-text text-transparent">
                          7 dias
                        </span>
                      </h4>
                      <p className="text-sm leading-relaxed text-white/60">
                        Experimente sem risco. Se não gostar, devolvemos 100% do
                        seu dinheiro, sem perguntas.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="scroll-mt-20 py-12 sm:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
              <div className="mb-10 text-center">
                <h2 className="mb-3 text-2xl font-bold sm:text-3xl md:text-4xl">
                  Perguntas{" "}
                  <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                    frequentes
                  </span>
                </h2>
              </div>

              <Accordion type="single" collapsible className="space-y-3">
                {FAQ_ITEMS.map((item, index) => (
                  <AccordionItem
                    key={index}
                    value={`item-${index}`}
                    className="rounded-xl border border-white/10 bg-white/5 px-6 backdrop-blur-sm"
                  >
                    <AccordionTrigger className="text-left text-white">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-white/70">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-16 sm:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl">
              <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-[#0a1c2b]/60 p-12 text-center backdrop-blur-sm sm:p-16">
                {/* Brilhos decorativos */}
                <span
                  aria-hidden
                  className="arena-twinkle absolute top-8 left-[12%]"
                  style={{ "--twinkle-dur": "3.4s" } as React.CSSProperties}
                >
                  <Star className="size-3 text-amber-400/50" weight="fill" />
                </span>
                <span
                  aria-hidden
                  className="arena-twinkle absolute right-[14%] bottom-10"
                  style={
                    {
                      "--twinkle-dur": "4.2s",
                      "--twinkle-delay": "0.7s",
                    } as React.CSSProperties
                  }
                >
                  <Star className="size-2.5 text-[#14f7fe]/40" weight="fill" />
                </span>
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-amber-500/10 blur-3xl"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute -bottom-16 -left-16 size-48 rounded-full bg-orange-500/10 blur-3xl"
                />

                <div className="relative z-10">
                  <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400">
                    <Flame className="size-4 animate-pulse" weight="fill" />
                    Oferta por tempo limitado
                  </div>

                  <h2 className="mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
                    Está pronto para{" "}
                    <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                      dominar a clipagem
                    </span>
                    ?
                  </h2>

                  <p className="mx-auto mb-8 max-w-2xl text-base text-white/70 sm:text-lg">
                    Por apenas <strong className="text-amber-400">R$9,90</strong>{" "}
                    você tem acesso ao guia definitivo com tudo que precisa para
                    transformar seus clips em dinheiro.
                  </p>

                  <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3">
                    <button
                      onClick={handleBuyClick}
                      className="group relative flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl border-none bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-5 text-lg font-bold text-white transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-amber-500/40"
                    >
                      <BookOpen className="size-5" weight="fill" />
                      SIM! QUERO O MANUAL AGORA
                      <ArrowRight
                        className="size-5 transition-transform group-hover:translate-x-1"
                        weight="bold"
                      />
                    </button>
                    <button
                      onClick={handleDeclineClick}
                      className="w-full cursor-pointer rounded-xl border-2 border-white/60 bg-transparent py-4 text-center text-base font-semibold text-white transition-all hover:bg-white/10"
                    >
                      Não, vou perder essa oportunidade
                    </button>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-sm text-white/60">
                    <div className="flex items-center gap-2">
                      <CheckCircle
                        className="size-4 text-amber-400"
                        weight="fill"
                      />
                      <span>Pagamento único</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle
                        className="size-4 text-amber-400"
                        weight="fill"
                      />
                      <span>Garantia de 7 dias</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle
                        className="size-4 text-amber-400"
                        weight="fill"
                      />
                      <span>Acesso vitalício</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 py-8 pb-28 sm:pb-8">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <Image
                src="/images/logo-clipfy-white.svg"
                alt="Clipfy League"
                width={120}
                height={30}
                className="h-auto w-[120px]"
              />
              <nav className="flex flex-wrap justify-center gap-4 text-xs">
                <a
                  href="/terms-of-use"
                  className="text-white/50 transition-colors hover:text-white"
                >
                  Termos de Uso
                </a>
                <a
                  href="/rules"
                  className="text-white/50 transition-colors hover:text-white"
                >
                  Política de Privacidade
                </a>
                <a
                  href="#faq"
                  onClick={(e) => {
                    e.preventDefault()
                    scrollToSection("faq")
                  }}
                  className="text-white/50 transition-colors hover:text-white"
                >
                  FAQ
                </a>
              </nav>
            </div>
            <div className="mt-4 text-center text-xs text-white/50">
              © {new Date().getFullYear()} Clipfy League. Todos os direitos
              reservados.
            </div>
          </div>
        </footer>

        {/* Floating CTA Button (Mobile) */}
        <div className="fixed right-4 bottom-4 left-4 z-40 sm:hidden">
          <button
            onClick={handleBuyClick}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-none bg-gradient-to-r from-amber-500 to-orange-500 py-5 text-lg font-bold text-white shadow-lg shadow-amber-500/50"
          >
            <BookOpen className="size-5" weight="fill" />
            SIM! QUERO O MANUAL
          </button>
        </div>
      </div>
    </div>
  )
}
