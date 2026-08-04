"use client"

import React, { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import {
  ArrowRight,
  ArrowsCounterClockwise,
  CaretDown,
  ChatCircle,
  Check,
  CheckCircle,
  CircleNotch,
  Crown,
  CurrencyDollar,
  DeviceMobile,
  Flame,
  GraduationCap,
  Lightning,
  Lock,
  Play,
  RocketLaunch,
  ShieldCheck,
  Sparkle,
  Storefront,
  Target,
  Timer,
  Trophy,
  UsersThree,
  VideoCamera,
} from "@phosphor-icons/react"

import { Logo } from "@/components/logo"
import { DarkScope } from "@/components/shared/dark-scope"
import { Reveal } from "@/components/shared/reveal"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"

// Dados do produto — Clipfy League PRO (PAGAMENTO ÚNICO de R$ 197)
const CLIPFY_PRO = {
  name: "Clipfy League PRO",
  price: 197,
  maxInstallments: 12,
  installmentPrice: 20.37, // 12x no cartão com juros (valor real cobrado pela Kiwify)
  checkoutUrl: "https://pay.kiwify.com.br/f2GUPz4",
}

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

// Módulos da Academia
const MODULES = [
  {
    number: "01",
    title: "Introdução",
    lessons: 2,
    description: "Do iniciante ao clipador avançado",
  },
  {
    number: "02",
    title: "Do zero ao primeiro corte",
    lessons: 3,
    description: "Primeiros passos para começar do zero",
  },
  {
    number: "03",
    title: "Algoritmos Desvendados",
    lessons: 4,
    description: "Como funcionam os algoritmos de cada plataforma",
  },
  {
    number: "04",
    title: "Monetização Avançada",
    lessons: 3,
    description: "Transforme views em dinheiro de verdade",
  },
  {
    number: "05",
    title: "Competições & Rankings",
    lessons: 3,
    description: "Domine as competições e ganhe mais prêmios",
  },
]

// Depoimentos - Screenshots de alunos (ordem aleatória)
const TESTIMONIAL_IMAGES = [
  "/images/clipfy-pro/depoimento5.jpeg",
  "/images/clipfy-pro/depoimento11.jpeg",
  "/images/clipfy-pro/depoimento2.jpeg",
  "/images/clipfy-pro/depoimento8.jpeg",
  "/images/clipfy-pro/depoimento1.jpeg",
  "/images/clipfy-pro/depoimento9.jpeg",
  "/images/clipfy-pro/depoimento4.jpeg",
  "/images/clipfy-pro/depoimento6.jpeg",
  "/images/clipfy-pro/depoimento10.jpeg",
  "/images/clipfy-pro/depoimento3.jpeg",
  "/images/clipfy-pro/depoimento7.jpeg",
]

// FAQ
const FAQ_ITEMS = [
  {
    question: "Quanto tempo tenho para acessar o conteúdo?",
    answer:
      "Acesso vitalício! Com o pagamento único de R$197, você tem acesso ilimitado e para sempre a todo o conteúdo da Academia, comunidade e benefícios PRO.",
  },
  {
    question: "R$197 é pagamento único?",
    answer:
      "Sim! É um pagamento único de R$197, podendo parcelar em até 12x no cartão de crédito. Sem mensalidades, sem renovação. Você paga uma vez e tem acesso vitalício a todo o conteúdo da Academia, comunidade e benefícios PRO.",
  },
  {
    question: "Preciso de equipamento profissional?",
    answer:
      "Não! Ensinamos técnicas para clipar com celular e computador básico. Muitos de nossos melhores alunos começaram apenas com um smartphone.",
  },
  {
    question: "Já sou clipador, vale a pena?",
    answer:
      "Com certeza! Os módulos avançados e a comunidade são especialmente valiosos para quem já clipa. Você vai acelerar seu crescimento e aumentar seus ganhos.",
  },
  {
    question: "Tem garantia?",
    answer:
      "Sim! Você tem 7 dias de garantia incondicional. Se não gostar do conteúdo, devolvemos 100% do seu dinheiro, sem perguntas e sem burocracia.",
  },
  {
    question: "Como funciona o portfólio para contratação?",
    answer:
      "Você monta seu portfólio dentro da plataforma e empresas parceiras podem encontrar e contratar você diretamente para projetos pagos.",
  },
]

// Passos "Como funciona" (mesma ordem/copy do original)
const STEPS = [
  {
    step: 1,
    icon: Crown,
    title: "Garanta o PRO",
    description:
      "Pague uma vez e receba o acesso vitalício instantaneamente por email",
  },
  {
    step: 2,
    icon: ChatCircle,
    title: "Entre no Discord",
    description: "Acesse a comunidade exclusiva da Clipfy no Discord",
  },
  {
    step: 3,
    icon: VideoCamera,
    title: "Acesse as Aulas",
    description: "Entre na aba de aulas dentro da plataforma Clipfy League",
  },
  {
    step: 4,
    icon: GraduationCap,
    title: "Assista e Aprenda",
    description: "Consuma o conteúdo e aplique as técnicas ensinadas",
  },
  {
    step: 5,
    icon: Target,
    title: "Inscreva-se",
    description: "Entre nas competições mensais da Clipfy League",
  },
  {
    step: 6,
    icon: CurrencyDollar,
    title: "Ganhe Dinheiro!",
    description: "Comece a faturar com seus clips e premiações",
  },
]

const STEPS_MOBILE = [
  {
    step: 1,
    icon: Crown,
    title: "Garanta o PRO",
    description:
      "Pague uma vez e receba o acesso vitalício instantaneamente por email",
  },
  {
    step: 2,
    icon: ChatCircle,
    title: "Entre no Discord",
    description: "Acesse a comunidade exclusiva da Clipfy no Discord",
  },
  {
    step: 3,
    icon: VideoCamera,
    title: "Acesse as Aulas",
    description: "Entre na aba de aulas dentro da plataforma",
  },
  {
    step: 4,
    icon: GraduationCap,
    title: "Assista e Aprenda",
    description: "Consuma o conteúdo e aplique as técnicas",
  },
  {
    step: 5,
    icon: Target,
    title: "Inscreva-se",
    description: "Entre nas competições mensais da Clipfy",
  },
  {
    step: 6,
    icon: CurrencyDollar,
    title: "Ganhe Dinheiro!",
    description: "Comece a faturar com seus clips!",
  },
]

// Maneiras de faturar (mesma ordem/copy do original)
const EARN_CARDS = [
  {
    icon: Trophy,
    title: "Competir em campeonatos",
    description: "de vídeos mensais com prêmios em dinheiro todos os dias.",
  },
  {
    icon: Storefront,
    title: "Crescer seu próprio canal",
    description: "e construir uma audiência fiel que gera receita constante.",
  },
  {
    icon: UsersThree,
    title: "Prestar serviço para negócios",
    description: "que querem crescer nas redes e aumentar suas vendas online.",
  },
  {
    icon: DeviceMobile,
    title: "Clipar para criadores",
    description: "que precisam de cortes que viralizam e geram engajamento.",
  },
]

export default function ClipperAcademy() {
  const searchParams = useSearchParams()
  const [isVideoPlaying, setIsVideoPlaying] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [affiliateCode, setAffiliateCode] = useState<string | null>(null)

  // Facebook (Meta) Pixel - Inicialização
  useEffect(() => {
    const w = window as any
    if (!w.fbq) {
      const n = (w.fbq = function (...args: any[]) {
        if ((n as any).callMethod) {
          ;(n as any).callMethod.apply(n, args)
        } else {
          ;(n as any).queue.push(args)
        }
      })
      if (!w._fbq) w._fbq = n
      ;(n as any).push = n
      ;(n as any).loaded = true
      ;(n as any).version = "2.0"
      ;(n as any).queue = []
      const script = document.createElement("script")
      script.async = true
      script.src = "https://connect.facebook.net/en_US/fbevents.js"
      const first = document.getElementsByTagName("script")[0]
      first?.parentNode?.insertBefore(script, first)
    }
    w.fbq(
      "init",
      "EAAJThCjoYkMBQyyBuhUnRSB4ae3gMErLLP0ZCESj4VapYOYVMfBYmCZCIWePiWGBqPh9jtZCAkAtds6aZC1IhrzyZARsJV9ugPpNOfBZCZACrwOEuTQD9U310ornpOXE7lluqZB9e7UFdnlWxIuZC5Klg3vA6So30kQtJiwggmCsnuTDtEDyVTRZCXudevJvC3Q2RZCXwZDZD",
    )
    w.fbq("track", "PageView")
  }, [])

  // TikTok Pixel - Inicialização
  useEffect(() => {
    const w = window as any
    if (!w.ttq) {
      w.TiktokAnalyticsObject = "ttq"
      const ttq: any[] & Record<string, any> = (w.ttq = w.ttq || [])
      ttq.methods = [
        "page",
        "track",
        "identify",
        "instances",
        "debug",
        "on",
        "off",
        "once",
        "ready",
        "alias",
        "group",
        "enableCookie",
        "disableCookie",
        "holdConsent",
        "revokeConsent",
        "grantConsent",
      ]
      ttq.setAndDefer = function (t: any, e: string) {
        t[e] = function (...args: any[]) {
          t.push([e].concat(args))
        }
      }
      for (const method of ttq.methods as string[]) {
        ttq.setAndDefer(ttq, method)
      }
      ttq.instance = function (t: string) {
        const e = (ttq as any)._i[t] || []
        for (const method of ttq.methods as string[]) {
          ttq.setAndDefer(e, method)
        }
        return e
      }
      ttq.load = function (e: string, n?: any) {
        const r = "https://analytics.tiktok.com/i18n/pixel/events.js"
        ;(ttq as any)._i = (ttq as any)._i || {}
        ;(ttq as any)._i[e] = []
        ;(ttq as any)._i[e]._u = r
        ;(ttq as any)._t = (ttq as any)._t || {}
        ;(ttq as any)._t[e] = +new Date()
        ;(ttq as any)._o = (ttq as any)._o || {}
        ;(ttq as any)._o[e] = n || {}
        const script = document.createElement("script")
        script.type = "text/javascript"
        script.async = true
        script.src = r + "?sdkid=" + e + "&lib=ttq"
        const first = document.getElementsByTagName("script")[0]
        first?.parentNode?.insertBefore(script, first)
      }
    }
    w.ttq.load("D6G8VJRC77UAAN00ARP0")
    w.ttq.page()
  }, [])

  // Capturar código de afiliado da URL
  useEffect(() => {
    const afid =
      searchParams.get("afid") ||
      searchParams.get("ref") ||
      searchParams.get("afiliado")
    if (afid) {
      setAffiliateCode(afid)
      // Salvar no localStorage para persistir entre navegações
      localStorage.setItem("clipfy_affiliate", afid)
    } else {
      // Verificar se existe no localStorage
      const savedAfid = localStorage.getItem("clipfy_affiliate")
      if (savedAfid) {
        setAffiliateCode(savedAfid)
      }
    }
  }, [searchParams])

  const handleSubscribe = () => {
    setIsLoading(true)

    // Facebook Pixel - Rastrear clique no botão de checkout
    const fbq = (window as any).fbq
    if (fbq) {
      fbq("track", "InitiateCheckout", {
        content_name: CLIPFY_PRO.name,
        content_type: "product",
        value: CLIPFY_PRO.price,
        currency: "BRL",
      })
    }

    // TikTok Pixel - Rastrear clique no botão de checkout
    const ttq = (window as any).ttq
    if (ttq) {
      ttq.track("ClickButton", {
        content_name: CLIPFY_PRO.name,
        content_type: "product",
        value: CLIPFY_PRO.price,
        currency: "BRL",
      })
      ttq.track("InitiateCheckout", {
        content_name: CLIPFY_PRO.name,
        content_type: "product",
        value: CLIPFY_PRO.price,
        currency: "BRL",
      })
    }

    // Construir URL do checkout com código de afiliado (se existir)
    let checkoutUrl = CLIPFY_PRO.checkoutUrl
    if (affiliateCode) {
      // Kiwify usa o parâmetro "afid" para rastrear afiliados
      const separator = checkoutUrl.includes("?") ? "&" : "?"
      checkoutUrl = `${checkoutUrl}${separator}afid=${affiliateCode}`
    }
    // Pequeno delay para mostrar o loading antes de redirecionar
    setTimeout(() => {
      window.location.href = checkoutUrl
    }, 500)
  }

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    element?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <DarkScope className="relative min-h-screen overflow-x-hidden bg-[#02080f] text-foreground">
      {/* Fundo petróleo fixo (identidade Clipfy) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(1100px_700px_at_50%_118%,rgba(5,33,43,0.9),transparent_60%),radial-gradient(900px_540px_at_78%_-12%,rgba(8,40,48,0.55),transparent_60%),radial-gradient(ellipse_at_center,#071321_0%,#030d18_62%,#02080f_100%)]" />
        <div className="bg-grid-pattern absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_78%)]" />
      </div>

      {/* Conteúdo principal */}
      <div className="relative z-10">
        {/* Hero Section with VSL */}
        <section className="relative overflow-hidden pt-8 pb-12 sm:pt-12 sm:pb-16">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="arena-aurora absolute -top-24 left-1/2 size-[480px] -translate-x-1/2 rounded-full bg-brand-cyan/10 blur-[120px]" />
          </div>
          <div className="relative container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl text-center">
              {/* Urgency Badge */}
              <Reveal immediate>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm font-medium text-yellow-400">
                  <Flame className="size-4 animate-pulse" weight="fill" />
                  OFERTA POR TEMPO LIMITADO
                  <Flame className="size-4 animate-pulse" weight="fill" />
                </div>
              </Reveal>

              <Reveal immediate delayMs={120}>
                <h1 className="mb-4 text-2xl leading-tight font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
                  Ganhe dinheiro apenas postando
                  <span className="text-gradient block">
                    cortes na internet
                  </span>
                </h1>
              </Reveal>

              <Reveal immediate delayMs={220}>
                <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-lg sm:text-xl">
                  Aprenda a realizar cortes virais na internet e
                  <strong className="text-foreground">
                    {" "}
                    ganhar mais de R$ 3.000{" "}
                  </strong>
                  todos os meses sem aparecer.
                </p>
              </Reveal>

              {/* VSL Video Container */}
              <Reveal immediate delayMs={320}>
                <div className="mx-auto mb-8 max-w-4xl">
                  <div className="border-brand-cyan/30 relative overflow-hidden rounded-2xl border-2 bg-black/50 shadow-2xl shadow-[rgba(20,247,254,0.2)]">
                    {/* Video Aspect Ratio Container (16:9) */}
                    <div className="relative aspect-video w-full">
                      {!isVideoPlaying ? (
                        // Thumbnail with Play Button
                        <div
                          className="absolute inset-0 flex cursor-pointer items-center justify-center bg-gradient-to-br from-[#071321] to-[#02080f]"
                          onClick={() => setIsVideoPlaying(true)}
                        >
                          <Image
                            src="/images/platform/clipfy-academy-cover.png"
                            alt="Clipfy Academy"
                            fill
                            sizes="(min-width: 1024px) 896px, 100vw"
                            className="object-cover opacity-60"
                          />

                          {/* Gradient Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />

                          {/* Play Button */}
                          <div className="relative z-10 flex flex-col items-center gap-4">
                            <div className="bg-gradient-custom group flex size-20 items-center justify-center rounded-full shadow-lg shadow-[rgba(20,247,254,0.5)] transition-all hover:scale-110 sm:size-24">
                              <Play
                                className="size-8 text-[#04222A] transition-transform group-hover:scale-110 sm:size-10"
                                weight="fill"
                              />
                            </div>
                            <span className="text-lg font-semibold text-white drop-shadow-lg">
                              Assista ao vídeo
                            </span>
                          </div>

                          {/* Video Duration Badge */}
                          <div className="absolute right-4 bottom-4 flex items-center gap-2 rounded-lg bg-black/70 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
                            <Timer className="size-4" />
                            8:42
                          </div>
                        </div>
                      ) : (
                        <iframe
                          id="panda-eec501ca-6200-4963-bbaa-2f0d76c0e20f"
                          src="https://player-vz-f09cd7cc-fa8.tv.pandavideo.com.br/embed/?v=eec501ca-6200-4963-bbaa-2f0d76c0e20f"
                          style={{ border: "none" }}
                          allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture"
                          allowFullScreen
                          width="720"
                          height="360"
                          className="absolute inset-0 h-full w-full"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </Reveal>

              {/* CTA Buttons */}
              <Reveal immediate delayMs={420}>
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                  <Button
                    onClick={() => scrollToSection("preco")}
                    size="lg"
                    className="btn-gradient-auth group relative h-auto overflow-hidden rounded-xl px-8 py-4 text-lg font-bold transition-all hover:scale-105 hover:shadow-lg hover:shadow-[rgba(20,247,254,0.5)]"
                  >
                    <span className="relative z-10 flex items-center">
                      <Crown className="mr-2 size-5" weight="fill" />
                      QUERO COMEÇAR AGORA
                      <ArrowRight className="ml-2 size-5 transition-transform group-hover:translate-x-1" />
                    </span>
                  </Button>
                </div>
              </Reveal>

              {/* Trust Badges */}
              <Reveal immediate delayMs={520}>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <ShieldCheck className="text-brand-green size-5" />
                    Pagamento seguro
                  </div>
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Lock className="text-brand-green size-5" />
                    Dados protegidos
                  </div>
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <CheckCircle className="text-brand-green size-5" />
                    Garantia de satisfação
                  </div>
                </div>
              </Reveal>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 animate-bounce">
            <CaretDown className="text-muted-foreground size-6" />
          </div>
        </section>

        {/* O que é a Clipfy Section - Compact Version */}
        <section className="relative overflow-hidden py-16 sm:py-20">
          {/* Subtle Background */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="bg-brand-cyan/10 absolute top-1/2 left-0 size-[400px] -translate-y-1/2 rounded-full blur-[100px]" />
            <div className="bg-brand-green/10 absolute top-1/2 right-0 size-[300px] -translate-y-1/2 rounded-full blur-[100px]" />
          </div>

          <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
              {/* Two Column Layout */}
              <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
                {/* Left Side - Platform Preview */}
                <Reveal className="relative order-2 lg:order-1">
                  {/* Main Dashboard Image */}
                  <div className="group relative">
                    {/* Glow effect behind image */}
                    <div className="from-brand-cyan/20 to-brand-green/20 absolute -inset-4 rounded-3xl bg-gradient-to-r opacity-60 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />

                    <div className="glass-card relative overflow-hidden rounded-2xl shadow-2xl">
                      <Image
                        src="/images/platform/home.png"
                        alt="Clipfy League Dashboard"
                        width={1280}
                        height={800}
                        sizes="(min-width: 1024px) 45vw, 92vw"
                        className="h-auto w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                      />
                      {/* Overlay gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#030d18]/70 via-transparent to-transparent" />

                      {/* Floating badge */}
                      <div className="absolute right-4 bottom-4 left-4 flex items-center gap-3 rounded-xl border border-white/10 bg-[#030d18]/70 p-3 backdrop-blur-md">
                        <div className="bg-gradient-custom flex size-10 shrink-0 items-center justify-center rounded-lg">
                          <Crown
                            className="size-5 text-[#04222A]"
                            weight="fill"
                          />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white">
                            Rankings em tempo real
                          </div>
                          <div className="text-muted-foreground text-xs">
                            Veja sua posição atualizar ao vivo
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Floating Stats Cards - Hidden on mobile */}
                  <div className="animate-float absolute -right-4 top-8 hidden sm:block lg:-right-8">
                    <div className="glass-card rounded-xl p-3 shadow-xl">
                      <div className="text-gradient text-2xl font-black">
                        +R$50K
                      </div>
                      <div className="text-muted-foreground text-xs">
                        em prêmios
                      </div>
                    </div>
                  </div>

                  <div
                    className="animate-float absolute -left-4 bottom-16 hidden sm:block lg:-left-8"
                    style={{ animationDelay: "1s" }}
                  >
                    <div className="glass-card rounded-xl p-3 shadow-xl">
                      <div className="text-gradient text-2xl font-black">
                        +500
                      </div>
                      <div className="text-muted-foreground text-xs">
                        clipadores ativos
                      </div>
                    </div>
                  </div>
                </Reveal>

                {/* Right Side - Content */}
                <Reveal className="order-1 lg:order-2" delayMs={120}>
                  {/* Badge */}
                  <div className="border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium">
                    <Sparkle className="size-4" weight="fill" />
                    O melhor ecossistema de cortes
                  </div>

                  {/* Title */}
                  <h2 className="mb-4 text-3xl leading-tight font-bold sm:text-4xl lg:text-5xl">
                    O que é a <span className="text-gradient">Clipfy League</span>
                  </h2>

                  {/* Description */}
                  <p className="text-muted-foreground mb-6 text-lg leading-relaxed">
                    A Clipfy League{" "}
                    <strong className="text-foreground">
                      gerencia e metrifica competições de cortes
                    </strong>
                    , conectando clipadores a influenciadores que pagam por
                    visualizações.
                  </p>

                  {/* Benefits List */}
                  <div className="mb-8 space-y-3">
                    {[
                      {
                        icon: CurrencyDollar,
                        text: "Premiações diárias e mensais por visualizações",
                      },
                      {
                        icon: Target,
                        text: "Rankings em tempo real para competir",
                      },
                      {
                        icon: Crown,
                        text: "Competições exclusivas com prêmios garantidos",
                      },
                    ].map((item, i) => (
                      <div key={i} className="group flex items-center gap-3">
                        <div className="border-brand-cyan/30 from-brand-cyan/15 to-brand-green/10 flex size-9 shrink-0 items-center justify-center rounded-lg border bg-gradient-to-br transition-all duration-300 group-hover:scale-110">
                          <item.icon className="text-brand-cyan size-4" />
                        </div>
                        <span className="text-muted-foreground group-hover:text-foreground font-medium transition-colors">
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Stats Row - Mobile Only */}
                  <div className="mb-6 grid grid-cols-2 gap-3 sm:hidden">
                    <div className="glass-card rounded-xl p-4 text-center">
                      <div className="text-gradient text-2xl font-black">
                        +R$50K
                      </div>
                      <div className="text-muted-foreground text-xs">
                        em prêmios
                      </div>
                    </div>
                    <div className="glass-card rounded-xl p-4 text-center">
                      <div className="text-gradient text-2xl font-black">
                        +500
                      </div>
                      <div className="text-muted-foreground text-xs">
                        clipadores
                      </div>
                    </div>
                  </div>

                  {/* CTA Text */}
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <CheckCircle
                      className="text-brand-green size-4"
                      weight="fill"
                    />
                    <span>
                      Mais de{" "}
                      <strong className="text-foreground">
                        20 competições
                      </strong>{" "}
                      já realizadas
                    </span>
                  </div>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section
          id="depoimentos"
          className="scroll-mt-20 overflow-hidden py-16 sm:py-24"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
              {/* Header */}
              <Reveal className="mb-12 text-center sm:mb-16">
                <div className="border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium">
                  <ChatCircle className="size-4" weight="fill" />
                  Resultados reais de alunos
                </div>
                <h2 className="mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
                  Veja o que nossos{" "}
                  <span className="text-gradient">alunos estão ganhando</span>
                </h2>
                <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
                  Prints reais de pagamentos e resultados da nossa comunidade
                </p>
              </Reveal>

              {/* Mobile - Lista Vertical */}
              <div className="space-y-4 sm:hidden">
                {TESTIMONIAL_IMAGES.map((image, index) => (
                  <Reveal key={index} delayMs={(index % 3) * 80}>
                    <div className="glass-card relative overflow-hidden rounded-2xl shadow-xl">
                      <Image
                        src={image}
                        alt={`Depoimento ${index + 1}`}
                        width={720}
                        height={900}
                        sizes="92vw"
                        className="h-auto w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  </Reveal>
                ))}
              </div>

              {/* Tablet - 2 colunas */}
              <div className="hidden sm:block lg:hidden">
                <div className="grid grid-cols-2 gap-4">
                  {TESTIMONIAL_IMAGES.slice(0, 10).map((image, index) => (
                    <Reveal key={index} delayMs={(index % 2) * 80}>
                      <div className="glass-card glass-card-hover group relative overflow-hidden rounded-2xl">
                        <Image
                          src={image}
                          alt={`Depoimento ${index + 1}`}
                          width={720}
                          height={900}
                          sizes="45vw"
                          className="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          loading="lazy"
                        />
                      </div>
                    </Reveal>
                  ))}
                </div>
                {/* Último depoimento centralizado */}
                <div className="mt-4 flex justify-center">
                  <Reveal className="w-1/2">
                    <div className="glass-card glass-card-hover group relative overflow-hidden rounded-2xl">
                      <Image
                        src={TESTIMONIAL_IMAGES[10]!}
                        alt="Depoimento 11"
                        width={720}
                        height={900}
                        sizes="45vw"
                        className="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    </div>
                  </Reveal>
                </div>
              </div>

              {/* Desktop - Layout em 3 colunas escalonadas */}
              <div className="hidden lg:block">
                <div className="grid grid-cols-3 gap-5">
                  {/* Coluna 1 */}
                  <div className="space-y-5">
                    {[0, 3, 6, 9].map(
                      (idx, i) =>
                        TESTIMONIAL_IMAGES[idx] && (
                          <Reveal key={idx} delayMs={i * 80}>
                            <div className="glass-card glass-card-hover group relative overflow-hidden rounded-2xl">
                              <Image
                                src={TESTIMONIAL_IMAGES[idx]}
                                alt={`Depoimento ${idx + 1}`}
                                width={720}
                                height={900}
                                sizes="30vw"
                                className="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                                loading="lazy"
                              />
                              {/* Overlay glow on hover */}
                              <div className="from-brand-cyan/10 absolute inset-0 bg-gradient-to-t to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                            </div>
                          </Reveal>
                        ),
                    )}
                  </div>

                  {/* Coluna 2 - offset */}
                  <div className="space-y-5 pt-10">
                    {[1, 4, 7, 10].map(
                      (idx, i) =>
                        TESTIMONIAL_IMAGES[idx] && (
                          <Reveal key={idx} delayMs={i * 80 + 40}>
                            <div className="glass-card glass-card-hover group relative overflow-hidden rounded-2xl">
                              <Image
                                src={TESTIMONIAL_IMAGES[idx]}
                                alt={`Depoimento ${idx + 1}`}
                                width={720}
                                height={900}
                                sizes="30vw"
                                className="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                                loading="lazy"
                              />
                              {/* Overlay glow on hover */}
                              <div className="from-brand-cyan/10 absolute inset-0 bg-gradient-to-t to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                            </div>
                          </Reveal>
                        ),
                    )}
                  </div>

                  {/* Coluna 3 */}
                  <div className="space-y-5 pt-5">
                    {[2, 5, 8].map(
                      (idx, i) =>
                        TESTIMONIAL_IMAGES[idx] && (
                          <Reveal key={idx} delayMs={i * 80 + 80}>
                            <div className="glass-card glass-card-hover group relative overflow-hidden rounded-2xl">
                              <Image
                                src={TESTIMONIAL_IMAGES[idx]}
                                alt={`Depoimento ${idx + 1}`}
                                width={720}
                                height={900}
                                sizes="30vw"
                                className="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                                loading="lazy"
                              />
                              {/* Overlay glow on hover */}
                              <div className="from-brand-cyan/10 absolute inset-0 bg-gradient-to-t to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                            </div>
                          </Reveal>
                        ),
                    )}
                  </div>
                </div>
              </div>

              {/* Badge de verificação */}
              <Reveal className="mt-12 flex justify-center sm:mt-16">
                <div className="border-brand-green/30 bg-brand-green/10 inline-flex items-center gap-3 rounded-full border px-5 py-2.5">
                  <CheckCircle
                    className="text-brand-green size-5"
                    weight="fill"
                  />
                  <span className="text-brand-green text-sm font-medium">
                    Todos os prints são reais e verificados
                  </span>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Benefits Section - Passo a Passo */}
        <section id="beneficios" className="scroll-mt-20 py-16 sm:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
              {/* Header */}
              <Reveal className="mb-12 text-center sm:mb-16">
                <div className="border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium">
                  <RocketLaunch className="size-4" weight="fill" />
                  Seu caminho para o sucesso
                </div>
                <h2 className="mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
                  Como funciona o{" "}
                  <span className="text-gradient">Clipfy League PRO</span>
                </h2>
                <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
                  Em apenas 6 passos simples, você sai do zero e começa a ganhar
                  dinheiro com seus clips
                </p>
              </Reveal>

              {/* Timeline - Desktop */}
              <div className="relative hidden lg:block">
                {/* Linha conectora horizontal */}
                <div className="via-brand-cyan/40 absolute top-[60px] right-[8%] left-[8%] h-1 rounded-full bg-gradient-to-r from-transparent to-transparent" />
                <div className="animate-shimmer absolute top-[60px] left-[8%] h-1 w-[84%] rounded-full bg-[linear-gradient(90deg,transparent,var(--brand-cyan),var(--brand-green),transparent)] [background-size:200%_100%]" />

                <div className="grid grid-cols-6 gap-4">
                  {STEPS.map((item, index) => (
                    <Reveal key={index} delayMs={index * 80}>
                      <div className="group flex flex-col items-center text-center">
                        {/* Círculo do passo */}
                        <div className="relative mb-6">
                          <div className="bg-gradient-custom relative z-10 flex size-[120px] items-center justify-center rounded-full shadow-lg shadow-[rgba(20,247,254,0.3)] transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-[rgba(20,247,254,0.5)]">
                            <item.icon
                              className="size-10 text-[#04222A]"
                              weight="fill"
                            />
                          </div>
                          {/* Número do passo */}
                          <div className="border-brand-cyan text-brand-cyan absolute -top-2 -right-2 z-20 flex size-8 items-center justify-center rounded-full border-2 bg-[#030d18] text-sm font-bold">
                            {item.step}
                          </div>
                          {/* Glow effect */}
                          <div className="bg-brand-cyan/20 absolute inset-0 rounded-full opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100" />
                        </div>

                        {/* Conteúdo */}
                        <h3 className="group-hover:text-brand-cyan mb-2 text-lg font-bold text-white transition-colors">
                          {item.title}
                        </h3>
                        <p className="text-muted-foreground px-2 text-sm leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>

              {/* Timeline - Tablet */}
              <div className="hidden sm:block lg:hidden">
                <div className="grid grid-cols-2 gap-6">
                  {STEPS.map((item, index) => (
                    <Reveal key={index} delayMs={(index % 2) * 80}>
                      <div className="glass-card glass-card-hover group relative overflow-hidden rounded-2xl p-6">
                        {/* Número grande no fundo */}
                        <div className="absolute -top-4 -right-4 text-[120px] font-black text-white/[0.03] select-none">
                          {item.step}
                        </div>

                        <div className="relative z-10 flex items-start gap-4">
                          {/* Ícone */}
                          <div className="bg-gradient-custom flex size-14 shrink-0 items-center justify-center rounded-xl shadow-lg">
                            <item.icon
                              className="size-7 text-[#04222A]"
                              weight="fill"
                            />
                          </div>

                          <div className="flex-1">
                            {/* Badge do passo */}
                            <div className="bg-brand-cyan/10 text-brand-cyan mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
                              <span>Passo {item.step}</span>
                            </div>

                            <h3 className="mb-1.5 text-lg font-bold text-white">
                              {item.title}
                            </h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>

              {/* Timeline - Mobile */}
              <div className="sm:hidden">
                <div className="relative">
                  {/* Linha vertical */}
                  <div className="from-brand-cyan via-brand-mint to-brand-green absolute top-0 bottom-0 left-[27px] w-0.5 bg-gradient-to-b" />

                  <div className="space-y-6">
                    {STEPS_MOBILE.map((item, index) => (
                      <Reveal key={index} delayMs={index * 60}>
                        <div className="relative flex gap-4">
                          {/* Círculo do ícone */}
                          <div className="bg-gradient-custom relative z-10 flex size-14 shrink-0 items-center justify-center rounded-full shadow-lg shadow-[rgba(20,247,254,0.3)]">
                            <item.icon
                              className="size-6 text-[#04222A]"
                              weight="fill"
                            />
                            {/* Badge do número */}
                            <div className="border-brand-cyan text-brand-cyan absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full border bg-[#030d18] text-[10px] font-bold">
                              {item.step}
                            </div>
                          </div>

                          {/* Card de conteúdo */}
                          <div className="glass-card glass-card-hover flex-1 rounded-xl p-4">
                            <h3 className="mb-1 text-base font-bold text-white">
                              {item.title}
                            </h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      </Reveal>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Multiple Ways to Earn Section */}
        <section className="py-16 sm:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
              {/* Header */}
              <Reveal className="mb-12 text-center sm:mb-16">
                <div className="border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium">
                  <CurrencyDollar className="size-4" />
                  Oportunidades reais de renda
                </div>
                <h2 className="text-3xl font-bold sm:text-4xl md:text-5xl">
                  Diversas maneiras de{" "}
                  <span className="text-gradient">faturar com clips</span>
                </h2>
                <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg">
                  Descubra como transformar suas habilidades em múltiplas fontes
                  de renda
                </p>
              </Reveal>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
                {EARN_CARDS.map((card, index) => (
                  <Reveal key={index} delayMs={index * 80}>
                    <div className="glass-card glass-card-hover group relative h-full overflow-hidden rounded-2xl p-6 sm:p-8">
                      {/* Número grande no fundo */}
                      <div className="absolute -top-4 -right-4 text-[100px] leading-none font-black text-white/[0.03] select-none">
                        {index + 1}
                      </div>

                      {/* Icon Container com gradiente */}
                      <div className="relative mb-6">
                        <div className="bg-gradient-custom flex size-14 items-center justify-center rounded-xl shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl">
                          <card.icon
                            className="size-7 text-[#04222A]"
                            weight="fill"
                          />
                        </div>
                        {/* Glow effect */}
                        <div className="bg-gradient-custom absolute inset-0 rounded-xl opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-40" />
                      </div>

                      <h3 className="group-hover:text-brand-cyan mb-3 text-lg font-bold text-white transition-colors duration-300 sm:text-xl">
                        {card.title}
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {card.description}
                      </p>

                      {/* Decorative corner glow */}
                      <div className="from-brand-cyan/10 to-brand-green/10 absolute -right-12 -bottom-12 size-40 rounded-full bg-gradient-to-br opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
                    </div>
                  </Reveal>
                ))}
              </div>

              {/* CTA - Pronto para começar */}
              <Reveal className="mt-12 text-center sm:mt-16">
                <div className="border-brand-cyan/30 from-brand-cyan/10 to-brand-green/10 inline-flex flex-col items-center gap-4 rounded-2xl border bg-gradient-to-r p-6 sm:flex-row sm:p-8">
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-custom flex size-12 items-center justify-center rounded-full">
                      <Sparkle className="size-6 text-[#04222A]" weight="fill" />
                    </div>
                    <div className="text-left">
                      <p className="text-lg font-bold text-white">
                        Pronto para começar?
                      </p>
                      <p className="text-muted-foreground text-sm">
                        Pagamento único de R$ {formatBRL(CLIPFY_PRO.price)} • até{" "}
                        {CLIPFY_PRO.maxInstallments}x no cartão
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleSubscribe}
                    disabled={isLoading}
                    className="btn-gradient-auth h-auto rounded-xl px-6 py-3 text-base font-bold transition-all hover:scale-105 hover:shadow-lg hover:shadow-[rgba(20,247,254,0.5)] disabled:opacity-70"
                  >
                    {isLoading ? (
                      <CircleNotch className="mr-2 size-5 animate-spin" />
                    ) : (
                      <ArrowRight className="mr-2 size-5" />
                    )}
                    {isLoading ? "Carregando..." : "Começar Agora"}
                  </Button>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Academia/Modules Section */}
        <section id="academia" className="scroll-mt-20 py-16 sm:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
              {/* Header */}
              <Reveal className="mb-12 text-center sm:mb-16">
                <div className="border-brand-green/30 bg-brand-green/10 text-brand-green mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium">
                  <GraduationCap className="size-4" weight="fill" />
                  Academia Clipadora
                </div>
                <h2 className="mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
                  Conteúdo <span className="text-gradient">passo a passo</span>{" "}
                  do zero ao avançado
                </h2>
                <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
                  Módulos organizados para você evoluir de forma estruturada e
                  alcançar resultados reais
                </p>
              </Reveal>

              {/* Modules Grid - Desktop */}
              <div className="hidden gap-4 lg:grid lg:grid-cols-5">
                {MODULES.map((module, index) => (
                  <Reveal key={index} delayMs={index * 80}>
                    <div className="glass-card glass-card-hover group relative h-full overflow-hidden rounded-2xl p-6">
                      {/* Número grande no fundo */}
                      <div className="absolute -top-4 -right-2 text-[80px] leading-none font-black text-white/[0.03] select-none">
                        {module.number}
                      </div>

                      {/* Ícone do módulo */}
                      <div className="relative mb-5">
                        <div className="bg-gradient-custom flex size-14 items-center justify-center rounded-xl shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl">
                          <span className="text-xl font-bold text-[#04222A]">
                            {module.number}
                          </span>
                        </div>
                        {/* Glow effect */}
                        <div className="bg-gradient-custom absolute inset-0 rounded-xl opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-40" />
                      </div>

                      {/* Badge de aulas */}
                      <div className="bg-brand-cyan/10 text-brand-cyan mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
                        <VideoCamera className="size-3" />
                        {module.lessons} aulas
                      </div>

                      <h3 className="group-hover:text-brand-cyan mb-2 line-clamp-2 text-base font-bold text-white transition-colors duration-300">
                        {module.title}
                      </h3>
                      <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
                        {module.description}
                      </p>

                      {/* Lock icon */}
                      <div className="absolute top-4 right-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        <Lock className="text-muted-foreground size-4" />
                      </div>

                      {/* Decorative corner glow */}
                      <div className="from-brand-cyan/10 to-brand-green/10 absolute -right-10 -bottom-10 size-32 rounded-full bg-gradient-to-br opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
                    </div>
                  </Reveal>
                ))}
              </div>

              {/* Modules Grid - Tablet */}
              <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:hidden">
                {MODULES.map((module, index) => (
                  <Reveal key={index} delayMs={(index % 2) * 80}>
                    <div className="glass-card glass-card-hover group relative overflow-hidden rounded-2xl p-6">
                      {/* Número grande no fundo */}
                      <div className="absolute -top-4 -right-2 text-[100px] leading-none font-black text-white/[0.03] select-none">
                        {module.number}
                      </div>

                      <div className="relative z-10 flex items-start gap-4">
                        {/* Ícone */}
                        <div className="bg-gradient-custom flex size-14 shrink-0 items-center justify-center rounded-xl shadow-lg">
                          <span className="text-lg font-bold text-[#04222A]">
                            {module.number}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          {/* Badge de aulas */}
                          <div className="bg-brand-cyan/10 text-brand-cyan mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
                            <VideoCamera className="size-3" />
                            {module.lessons} aulas
                          </div>

                          <h3 className="mb-1.5 text-lg font-bold text-white">
                            {module.title}
                          </h3>
                          <p className="text-muted-foreground text-sm leading-relaxed">
                            {module.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>

              {/* Modules List - Mobile */}
              <div className="sm:hidden">
                <div className="relative">
                  {/* Linha vertical */}
                  <div className="from-brand-cyan via-brand-mint to-brand-green absolute top-0 bottom-0 left-[27px] w-0.5 bg-gradient-to-b" />

                  <div className="space-y-5">
                    {MODULES.map((module, index) => (
                      <Reveal key={index} delayMs={index * 60}>
                        <div className="relative flex gap-4">
                          {/* Círculo do módulo */}
                          <div className="bg-gradient-custom relative z-10 flex size-14 shrink-0 items-center justify-center rounded-full shadow-lg shadow-[rgba(20,247,254,0.3)]">
                            <span className="text-lg font-bold text-[#04222A]">
                              {module.number}
                            </span>
                          </div>

                          {/* Card de conteúdo */}
                          <div className="glass-card flex-1 rounded-xl p-4">
                            <div className="bg-brand-cyan/10 text-brand-cyan mb-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold">
                              <VideoCamera className="size-3" />
                              {module.lessons} aulas
                            </div>
                            <h3 className="mb-1 text-base font-bold text-white">
                              {module.title}
                            </h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                              {module.description}
                            </p>
                          </div>
                        </div>
                      </Reveal>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Stats */}
              <Reveal className="mt-12 sm:mt-16">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { value: "+15", label: "Aulas", icon: VideoCamera },
                    { value: "5", label: "Módulos", icon: GraduationCap },
                    { value: "∞", label: "Atualizações", icon: RocketLaunch },
                    { value: "24/7", label: "Acesso", icon: Lock },
                  ].map((stat, index) => (
                    <div
                      key={index}
                      className="glass-card glass-card-hover group relative overflow-hidden rounded-xl p-4 text-center sm:p-6"
                    >
                      <stat.icon className="text-brand-cyan mx-auto mb-2 size-5 sm:size-6" />
                      <div className="text-gradient text-2xl font-bold sm:text-3xl">
                        {stat.value}
                      </div>
                      <div className="text-muted-foreground mt-1 text-xs sm:text-sm">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section
          id="preco"
          className="relative scroll-mt-20 overflow-hidden py-16 sm:py-24"
        >
          {/* Background Effects */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="from-brand-cyan/10 to-brand-green/10 absolute top-1/2 left-1/2 size-[800px] max-w-none -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r blur-[120px]" />
          </div>

          <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <Reveal className="mb-12 text-center">
              <div className="border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium">
                <Lightning className="size-4" weight="fill" />
                Oferta especial por tempo limitado
              </div>
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
                Invista no seu{" "}
                <span className="text-gradient">futuro como clipador</span>
              </h2>
              <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
                Acesso completo a tudo que você precisa para começar a ganhar
                dinheiro com cortes
              </p>
            </Reveal>

            {/* Pricing Card */}
            <div className="mx-auto max-w-md">
              <Reveal>
                <div className="group relative">
                  {/* Animated border glow */}
                  <div className="bg-gradient-custom animate-gradient absolute -inset-0.5 rounded-2xl opacity-40 blur transition-opacity duration-500 group-hover:opacity-60" />

                  {/* Card */}
                  <div className="glass-card relative overflow-hidden rounded-2xl">
                    {/* Best Value Badge */}
                    <div className="absolute top-0 right-0 z-10">
                      <div className="bg-gradient-custom rounded-bl-xl px-3 py-1.5 text-xs font-bold text-[#04222A]">
                        ⚡ OFERTA ESPECIAL
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-6 sm:p-8">
                      {/* Plan Name & Price Row */}
                      <div className="mb-5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-gradient-custom flex size-10 items-center justify-center rounded-lg">
                            <Crown
                              className="size-5 text-[#04222A]"
                              weight="fill"
                            />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-white">
                              Clipfy League PRO
                            </h3>
                            <p className="text-muted-foreground text-xs">
                              Acesso completo
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="border-border/60 mb-5 border-b pb-5">
                        <div className="flex flex-wrap items-end gap-2">
                          <span className="text-muted-foreground mb-1 text-sm">
                            12x de
                          </span>
                          <div className="flex items-baseline">
                            <span className="text-muted-foreground text-base">
                              R$
                            </span>
                            <span className="text-gradient text-5xl leading-none font-black">
                              {formatBRL(CLIPFY_PRO.installmentPrice)}
                            </span>
                          </div>
                          <span className="text-muted-foreground mb-1 text-sm">
                            no cartão
                          </span>
                        </div>
                        <p className="text-muted-foreground/80 mt-1 text-xs">
                          ou pagamento único de{" "}
                          <span className="font-semibold text-white">
                            R$ {formatBRL(CLIPFY_PRO.price)}
                          </span>{" "}
                          • acesso vitalício
                        </p>
                      </div>

                      {/* Features - Compact */}
                      <div className="mb-5 grid grid-cols-2 gap-2">
                        {[
                          "Academia Clipadora",
                          "Comunidade Discord",
                          "Cargo VIP",
                          "Portfólio PRO",
                          "Novos conteúdos",
                          "Suporte prioritário",
                        ].map((feature, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Check
                              className="text-brand-cyan size-4 shrink-0"
                              weight="bold"
                            />
                            <span className="text-muted-foreground text-sm">
                              {feature}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* CTA Button */}
                      <Button
                        onClick={handleSubscribe}
                        size="lg"
                        disabled={isLoading}
                        className="btn-gradient-auth h-auto w-full rounded-xl px-6 py-4 text-base font-bold transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-[rgba(20,247,254,0.3)] disabled:opacity-70 disabled:hover:scale-100"
                      >
                        {isLoading ? (
                          <CircleNotch className="mr-2 size-5 animate-spin" />
                        ) : (
                          <RocketLaunch className="mr-2 size-5" weight="fill" />
                        )}
                        {isLoading
                          ? "CARREGANDO..."
                          : "GARANTIR ACESSO VITALÍCIO"}
                      </Button>

                      {/* Trust Indicators - Compact */}
                      <div className="text-muted-foreground/80 mt-4 flex items-center justify-center gap-4 text-xs">
                        <div className="flex items-center gap-1">
                          <ShieldCheck className="text-brand-green size-3.5" />
                          <span>Seguro</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Lock className="text-brand-green size-3.5" />
                          <span>Protegido</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ArrowsCounterClockwise className="text-brand-green size-3.5" />
                          <span>Garantia de 7 dias</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Accent */}
                    <div className="bg-gradient-custom h-1" />
                  </div>
                </div>
              </Reveal>

              {/* Guarantee Section */}
              <Reveal className="mt-8" delayMs={120}>
                <div className="group relative">
                  <div className="from-brand-green/30 absolute -inset-0.5 rounded-2xl bg-gradient-to-r to-emerald-500/30 opacity-50 blur" />
                  <div className="border-brand-green/20 relative flex flex-col items-center gap-4 rounded-2xl border bg-[#030d18] p-5 sm:flex-row sm:gap-6 sm:p-6">
                    {/* Guarantee Image */}
                    <div className="shrink-0">
                      <div className="relative">
                        <div className="bg-brand-green/20 absolute inset-0 rounded-full blur-xl" />
                        <Image
                          src="/images/clipfy-pro/garantia.png"
                          alt="Garantia de 7 dias"
                          width={96}
                          height={96}
                          sizes="96px"
                          className="relative size-20 object-contain sm:size-24"
                        />
                      </div>
                    </div>

                    {/* Guarantee Text */}
                    <div className="text-center sm:text-left">
                      <h4 className="mb-1 text-lg font-bold text-white sm:text-xl">
                        Garantia de{" "}
                        <span className="from-brand-green bg-gradient-to-r to-emerald-400 bg-clip-text text-transparent">
                          7 dias
                        </span>
                      </h4>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        Experimente sem risco. Se não gostar, devolvemos 100% do
                        seu dinheiro, sem perguntas.
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="scroll-mt-20 py-12 sm:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
              <Reveal className="mb-10 text-center">
                <h2 className="mb-3 text-2xl font-bold sm:text-3xl md:text-4xl">
                  Perguntas <span className="text-gradient">frequentes</span>
                </h2>
              </Reveal>

              <Reveal delayMs={100}>
                <Accordion type="single" collapsible className="space-y-3">
                  {FAQ_ITEMS.map((item, index) => (
                    <AccordionItem
                      key={index}
                      value={`item-${index}`}
                      className="glass-card rounded-xl border-none px-6"
                    >
                      <AccordionTrigger className="text-left">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-16 sm:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl">
              <Reveal>
                <div className="glass-card border-brand-cyan/30 relative overflow-hidden rounded-3xl border p-12 text-center sm:p-16">
                  <div className="relative z-10">
                    <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm font-medium text-yellow-400">
                      <Flame className="size-4 animate-pulse" weight="fill" />
                      Oferta por tempo limitado
                    </div>

                    <h2 className="mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
                      Está pronto para{" "}
                      <span className="text-gradient">ganhar dinheiro</span> com
                      seus clips?
                    </h2>

                    <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-base sm:text-lg">
                      Com um pagamento único de{" "}
                      <strong className="text-brand-cyan">
                        R$ {formatBRL(CLIPFY_PRO.price)}
                      </strong>{" "}
                      (em até {CLIPFY_PRO.maxInstallments}x no cartão) você tem
                      acesso <strong className="text-white">vitalício</strong> a
                      tudo que precisa para transformar sua paixão em renda.
                    </p>

                    <Button
                      onClick={() => scrollToSection("preco")}
                      size="lg"
                      className="btn-gradient-auth group h-auto rounded-xl px-8 py-4 text-lg font-bold transition-all hover:scale-105 hover:shadow-lg hover:shadow-[rgba(20,247,254,0.5)]"
                    >
                      <Crown className="mr-2 size-5" weight="fill" />
                      QUERO COMEÇAR AGORA
                      <ArrowRight className="ml-2 size-5 transition-transform group-hover:translate-x-1" />
                    </Button>

                    <div className="text-muted-foreground mt-6 flex flex-wrap items-center justify-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle
                          className="text-brand-cyan size-4"
                          weight="fill"
                        />
                        <span>
                          Pagamento único de R$ {formatBRL(CLIPFY_PRO.price)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle
                          className="text-brand-cyan size-4"
                          weight="fill"
                        />
                        <span>Garantia de 7 dias</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle
                          className="text-brand-cyan size-4"
                          weight="fill"
                        />
                        <span>Acesso vitalício e imediato</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 py-8 pb-24 sm:pb-8">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <Logo width={120} height={30} shadow={false} />
              <nav className="flex flex-wrap justify-center gap-4 text-xs">
                <Link
                  href="/terms-of-use"
                  className="text-muted-foreground transition-colors hover:text-white"
                >
                  Termos de Uso
                </Link>
                <Link
                  href="/rules"
                  className="text-muted-foreground transition-colors hover:text-white"
                >
                  Política de Privacidade
                </Link>
                <a
                  href="#faq"
                  onClick={(e) => {
                    e.preventDefault()
                    scrollToSection("faq")
                  }}
                  className="text-muted-foreground transition-colors hover:text-white"
                >
                  FAQ
                </a>
              </nav>
            </div>
            <div className="text-muted-foreground mt-4 text-center text-xs">
              © {new Date().getFullYear()} Clipfy League. Todos os direitos
              reservados.
            </div>
          </div>
        </footer>

        {/* Floating CTA Button (Mobile) */}
        <div className="fixed right-4 bottom-4 left-4 z-40 sm:hidden">
          <Button
            onClick={() => scrollToSection("preco")}
            size="lg"
            className="btn-gradient-auth h-auto w-full rounded-xl py-4 text-lg font-bold shadow-lg shadow-[rgba(20,247,254,0.5)]"
          >
            <Crown className="mr-2 size-5" weight="fill" />
            COMEÇAR AGORA
          </Button>
        </div>
      </div>
      {/* Fecha div de conteúdo z-10 */}
    </DarkScope>
  )
}
