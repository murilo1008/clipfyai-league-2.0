"use client"

import React, { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import {
  ArrowRight,
  BookOpen,
  CaretDown,
  ChatCircle,
  CheckCircle,
  CircleNotch,
  Crown,
  CurrencyDollar,
  DeviceMobile,
  Flame,
  Gift,
  GraduationCap,
  List,
  Lock,
  Play,
  RocketLaunch,
  ShieldCheck,
  Star,
  Storefront,
  Timer,
  TrendUp,
  Trophy,
  UsersThree,
  VideoCamera,
  Wallet,
  X,
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

// Dados do produto — Clipfy League PRO (PAGAMENTO ÚNICO)
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

// Benefícios principais
const BENEFITS = [
  {
    icon: GraduationCap,
    title: "Academia Clipadora Completa",
    description:
      "Acesso a todos os módulos e aulas exclusivas sobre clipagem profissional",
    highlight: "+15 horas de conteúdo",
  },
  {
    icon: UsersThree,
    title: "Comunidade Exclusiva",
    description:
      "Grupo privado com clipadores que faturam e trocam experiências diariamente",
    highlight: "Networking de elite",
  },
  {
    icon: Crown,
    title: "Cargo VIP no Discord",
    description:
      "Destaque na comunidade oficial da Clipfy com acesso a canais exclusivos",
    highlight: "Status diferenciado",
  },
  {
    icon: Wallet,
    title: "Portfólio para Contratação",
    description:
      "Construa seu portfólio profissional e seja encontrado por empresas",
    highlight: "Oportunidades reais",
  },
]

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

// Depoimentos
const TESTIMONIALS = [
  {
    name: "Lucas Mendes",
    role: "Clipador há 8 meses",
    image: "https://i.pravatar.cc/150?img=11",
    text: "Antes eu mal conseguia 10k views. Depois da Academia, meus cortes passaram de 500k frequentemente. Já ganhei mais de R$5.000 em prêmios.",
    highlight: "R$5.000+ em prêmios",
  },
  {
    name: "Amanda Silva",
    role: "Clipadora há 1 ano",
    image: "https://i.pravatar.cc/150?img=5",
    text: "A comunidade é o diferencial. Aprendi técnicas que ninguém ensina no YouTube. Hoje faço renda extra todo mês só com clips.",
    highlight: "Renda extra mensal",
  },
  {
    name: "Pedro Costa",
    role: "Clipador há 6 meses",
    image: "https://i.pravatar.cc/150?img=12",
    text: "O módulo de algoritmos mudou minha forma de criar. Passei de 100 para 3.000 seguidores em 2 meses. Vale cada centavo.",
    highlight: "3.000% crescimento",
  },
]

// FAQ
const FAQ_ITEMS = [
  {
    question: "Quanto tempo tenho para acessar o conteúdo?",
    answer:
      "Acesso vitalício! Com o pagamento único de R$ 197, você tem acesso ilimitado e para sempre a todo o conteúdo da Academia, comunidade e benefícios PRO.",
  },
  {
    question: "R$ 197 é pagamento único mesmo?",
    answer:
      "Sim! É um pagamento único de R$ 197, podendo parcelar em até 12x no cartão de crédito (cerca de R$ 20,37 por mês com os juros do cartão). Sem mensalidades, sem renovação. Você paga uma vez e tem acesso vitalício a todo o conteúdo, comunidade e benefícios PRO.",
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
      "Sim! Você tem 7 dias de garantia incondicional. Se não gostar, devolvemos 100% do seu dinheiro, sem perguntas e sem burocracia.",
  },
  {
    question: "Como funciona o portfólio para contratação?",
    answer:
      "Você monta seu portfólio dentro da plataforma e empresas parceiras podem encontrar e contratar você diretamente para projetos pagos.",
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

// Benefícios extras
const EXTRA_BENEFITS = [
  { icon: VideoCamera, text: "Aulas em vídeo HD" },
  { icon: BookOpen, text: "Material de apoio" },
  { icon: ChatCircle, text: "Suporte na comunidade" },
  { icon: RocketLaunch, text: "Novos conteúdos mensais" },
]

// Resultados dos alunos
const RESULT_STATS = [
  { value: "R$50k+", label: "Pagos em prêmios", icon: CurrencyDollar },
  { value: "500+", label: "Clipadores ativos", icon: UsersThree },
  { value: "10M+", label: "Views geradas", icon: TrendUp },
  { value: "4.9★", label: "Avaliação média", icon: Star },
]

// Navegação do header
const NAV_ITEMS = [
  { id: "beneficios", label: "Benefícios" },
  { id: "academia", label: "Academia" },
  { id: "depoimentos", label: "Depoimentos" },
  { id: "faq", label: "FAQ" },
]

export default function ClipperAcademy() {
  const searchParams = useSearchParams()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [affiliateCode, setAffiliateCode] = useState<string | null>(null)

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
    setMobileMenuOpen(false)
  }

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  return (
    <DarkScope className="text-foreground relative min-h-screen overflow-x-hidden bg-[#02080f]">
      {/* Fundo petróleo fixo (identidade Clipfy) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(1100px_700px_at_50%_118%,rgba(5,33,43,0.9),transparent_60%),radial-gradient(900px_540px_at_78%_-12%,rgba(8,40,48,0.55),transparent_60%),radial-gradient(ellipse_at_center,#071321_0%,#030d18_62%,#02080f_100%)]" />
        <div className="bg-grid-pattern absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_78%)]" />
        <div className="arena-aurora bg-brand-cyan/10 absolute -top-32 left-1/4 size-[420px] rounded-full blur-[130px]" />
        <div
          className="arena-aurora bg-brand-green/10 absolute right-1/5 bottom-0 size-[360px] rounded-full blur-[130px]"
          style={{ animationDelay: "4s" }}
        />
        {/* Partículas sutis no lugar do vórtice original */}
        <span
          className="arena-twinkle absolute top-[22%] left-[18%]"
          style={{ "--twinkle-dur": "3.6s" } as React.CSSProperties}
        >
          <Star className="text-brand-cyan/35 size-2.5" weight="fill" />
        </span>
        <span
          className="arena-twinkle absolute top-[38%] right-[14%]"
          style={
            {
              "--twinkle-dur": "4.4s",
              "--twinkle-delay": "0.8s",
            } as React.CSSProperties
          }
        >
          <Star className="text-brand-mint/30 size-2" weight="fill" />
        </span>
        <span
          className="arena-twinkle absolute bottom-[28%] left-[36%]"
          style={
            {
              "--twinkle-dur": "3.9s",
              "--twinkle-delay": "1.5s",
            } as React.CSSProperties
          }
        >
          <Star className="text-brand-green/35 size-2.5" weight="fill" />
        </span>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 md:hidden"
          onClick={toggleMobileMenu}
        />
      )}

      {/* Conteúdo principal */}
      <div className="relative z-10">
        {/* Header */}
        <header className="fixed top-0 right-0 left-0 z-50 border-b border-white/10 bg-[#030d18]/80 backdrop-blur-xl">
          <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <Logo width={140} height={35} shadow={false} />
            <nav className="hidden items-center gap-6 md:flex">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="text-muted-foreground hover:text-brand-cyan text-sm font-medium transition-colors"
                >
                  {item.label}
                </button>
              ))}
              <Button
                onClick={handleSubscribe}
                size="sm"
                disabled={isLoading}
                className="btn-gradient-auth rounded-lg font-semibold disabled:opacity-70"
              >
                {isLoading ? (
                  <CircleNotch className="mr-2 size-4 animate-spin" />
                ) : (
                  <Crown className="mr-2 size-4" weight="fill" />
                )}
                {isLoading
                  ? "Carregando..."
                  : `Comprar por R$ ${formatBRL(CLIPFY_PRO.price)}`}
              </Button>
            </nav>
            <button
              className={`group relative rounded-lg p-2 transition-all md:hidden ${
                mobileMenuOpen
                  ? "bg-brand-cyan/20 shadow-lg shadow-[rgba(20,247,254,0.5)]"
                  : "hover:bg-white/10"
              }`}
              onClick={toggleMobileMenu}
              aria-label="Toggle menu"
            >
              <div className="relative size-6">
                <List
                  className={`absolute inset-0 size-6 transition-all duration-200 ease-in-out ${
                    mobileMenuOpen
                      ? "scale-75 rotate-45 opacity-0"
                      : "scale-100 rotate-0 opacity-100"
                  }`}
                />
                <X
                  className={`text-brand-cyan absolute inset-0 size-6 transition-all duration-200 ease-in-out ${
                    mobileMenuOpen
                      ? "scale-100 rotate-0 opacity-100"
                      : "scale-75 -rotate-45 opacity-0"
                  }`}
                />
              </div>
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="border-brand-cyan/30 border-t bg-gradient-to-b from-[#030d18]/95 to-[#02080f]/90 shadow-2xl shadow-[rgba(20,247,254,0.2)] backdrop-blur-xl md:hidden">
              <div className="container mx-auto space-y-3 px-4 py-6">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className="hover:text-brand-cyan block w-full rounded-lg py-3 text-left text-sm font-medium transition-all hover:bg-white/10 hover:pl-2"
                  >
                    {item.label}
                  </button>
                ))}
                <Button
                  onClick={handleSubscribe}
                  size="sm"
                  disabled={isLoading}
                  className="btn-gradient-auth w-full rounded-lg font-semibold transition-all hover:scale-[1.02] disabled:opacity-70"
                >
                  {isLoading ? (
                    <CircleNotch className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Crown className="mr-2 size-4" weight="fill" />
                  )}
                  {isLoading
                    ? "Carregando..."
                    : `Comprar por R$ ${formatBRL(CLIPFY_PRO.price)}`}
                </Button>
              </div>
            </div>
          )}
        </header>

        {/* Hero Section with VSL */}
        <section className="relative overflow-hidden pt-24 pb-12 sm:pt-28 sm:pb-16">
          <div className="relative container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl text-center">
              {/* Urgency Badge */}
              <Reveal immediate>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm font-medium text-yellow-400">
                  <Flame className="size-4 animate-pulse" weight="fill" />
                  OFERTA ESPECIAL: Acesso vitalício por R${" "}
                  {formatBRL(CLIPFY_PRO.price)} (12x sem juros no cartão)
                  <Flame className="size-4 animate-pulse" weight="fill" />
                </div>
              </Reveal>

              <Reveal immediate delayMs={120}>
                <h1 className="mb-4 text-2xl leading-tight font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
                  Transforme seus cortes em
                  <span className="text-gradient block">
                    Renda Extra Todo Mês
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
                  todos os meses mês.
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
                        // Actual Video Player
                        <iframe
                          className="absolute inset-0 h-full w-full"
                          src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0"
                          title="Clipfy League PRO - VSL"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      )}
                    </div>
                  </div>
                </div>
              </Reveal>

              {/* Social Proof Mini */}
              <Reveal immediate delayMs={380}>
                <div className="text-muted-foreground mb-8 flex flex-wrap items-center justify-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className="bg-gradient-custom size-8 rounded-full border-2 border-[#02080f]"
                        />
                      ))}
                    </div>
                    <span>+500 clipadores ativos</span>
                  </div>
                  <div className="bg-border hidden h-4 w-px sm:block" />
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className="size-4 text-amber-400"
                        weight="fill"
                      />
                    ))}
                    <span className="ml-1">4.9/5 avaliações</span>
                  </div>
                </div>
              </Reveal>

              {/* CTA Buttons */}
              <Reveal immediate delayMs={440}>
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                  <Button
                    onClick={handleSubscribe}
                    size="lg"
                    disabled={isLoading}
                    className="btn-gradient-auth group relative h-auto overflow-hidden rounded-xl px-8 py-4 text-lg font-bold transition-all hover:scale-105 hover:shadow-lg hover:shadow-[rgba(20,247,254,0.5)] disabled:opacity-70 disabled:hover:scale-100"
                  >
                    <span className="relative z-10 flex items-center">
                      {isLoading ? (
                        <CircleNotch className="mr-2 size-5 animate-spin" />
                      ) : (
                        <Crown className="mr-2 size-5" weight="fill" />
                      )}
                      {isLoading
                        ? "CARREGANDO..."
                        : "QUERO ACESSO VITALÍCIO AGORA"}
                      {!isLoading && (
                        <ArrowRight className="ml-2 size-5 transition-transform group-hover:translate-x-1" />
                      )}
                    </span>
                  </Button>
                  <p className="text-muted-foreground text-sm">
                    Pagamento único de R$ {formatBRL(CLIPFY_PRO.price)} • até{" "}
                    {CLIPFY_PRO.maxInstallments}x de R${" "}
                    {formatBRL(CLIPFY_PRO.installmentPrice)} no cartão
                  </p>
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
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <CaretDown className="text-muted-foreground size-6" />
          </div>
        </section>

        {/* Multiple Ways to Earn Section */}
        <section className="py-16 sm:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
              <Reveal className="mb-12 text-center sm:mb-16">
                <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl lg:text-5xl">
                  Diversas maneiras de{" "}
                  <span className="text-gradient">faturar com clips</span>
                </h2>
              </Reveal>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
                {EARN_CARDS.map((card, index) => (
                  <Reveal key={index} delayMs={index * 80}>
                    <div className="glass-card glass-card-hover group relative h-full overflow-hidden rounded-2xl p-6 sm:p-8">
                      {/* Icon Container */}
                      <div className="border-brand-cyan/40 mb-6 flex size-16 items-center justify-center rounded-xl border bg-[#030d18]/60">
                        <card.icon className="text-brand-cyan size-8" />
                      </div>

                      <h3 className="text-brand-cyan mb-3 text-lg font-bold sm:text-xl">
                        {card.title}
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {card.description}
                      </p>

                      {/* Decorative glow */}
                      <div className="bg-brand-cyan/10 absolute -right-8 -bottom-8 size-32 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
                    </div>
                  </Reveal>
                ))}
              </div>

              {/* Bottom CTA Text */}
              <Reveal>
                <p className="text-muted-foreground mt-10 text-center text-lg sm:mt-12 sm:text-xl">
                  <strong className="text-white">E o melhor:</strong> você
                  aprende tudo isso com um pagamento único de{" "}
                  <span className="text-brand-cyan font-bold">
                    R$ {formatBRL(CLIPFY_PRO.price)}
                  </span>{" "}
                  (em até {CLIPFY_PRO.maxInstallments}x no cartão).
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section id="beneficios" className="scroll-mt-20 py-12 sm:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">
              <Reveal className="mb-10 text-center">
                <div className="border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium">
                  <Gift className="size-3" weight="fill" />
                  Tudo isso incluso no seu acesso vitalício
                </div>
                <h2 className="mb-3 text-2xl font-bold sm:text-3xl md:text-4xl">
                  O que você recebe no{" "}
                  <span className="text-gradient">Clipfy League PRO</span>
                </h2>
                <p className="text-muted-foreground mx-auto mt-4 max-w-2xl">
                  Tudo que você precisa para transformar sua paixão por clips em
                  uma fonte de renda real
                </p>
              </Reveal>

              <div className="grid gap-6 md:grid-cols-2">
                {BENEFITS.map((benefit, index) => (
                  <Reveal key={index} delayMs={(index % 2) * 100}>
                    <div className="glass-card glass-card-hover group relative h-full overflow-hidden rounded-2xl p-6">
                      <div className="bg-brand-cyan/10 group-hover:bg-brand-cyan/20 absolute top-0 right-0 size-24 translate-x-6 -translate-y-6 rounded-full blur-3xl transition-all duration-500 group-hover:scale-150" />
                      <div className="relative mb-3 flex items-center gap-3">
                        <div className="bg-gradient-custom flex size-12 items-center justify-center rounded-xl">
                          <benefit.icon
                            className="size-6 text-[#04222A]"
                            weight="fill"
                          />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">
                            {benefit.title}
                          </h3>
                          <span className="text-brand-cyan text-xs font-medium">
                            {benefit.highlight}
                          </span>
                        </div>
                      </div>
                      <p className="text-muted-foreground relative text-sm">
                        {benefit.description}
                      </p>
                    </div>
                  </Reveal>
                ))}
              </div>

              {/* Extra Benefits Grid */}
              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {EXTRA_BENEFITS.map((item, index) => (
                  <Reveal key={index} delayMs={index * 60}>
                    <div className="glass-card glass-card-hover flex items-center gap-3 rounded-lg p-4">
                      <item.icon className="text-brand-cyan size-5" />
                      <span className="text-sm font-medium">{item.text}</span>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Academia/Modules Section */}
        <section id="academia" className="scroll-mt-20 py-12 sm:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">
              <Reveal className="mb-10 text-center">
                <div className="border-brand-green/30 bg-brand-green/10 text-brand-green mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium">
                  <GraduationCap className="size-3" weight="fill" />
                  Academia Clipadora
                </div>
                <h2 className="mb-3 text-2xl font-bold sm:text-3xl md:text-4xl">
                  Conteúdo <span className="text-gradient">passo a passo</span>{" "}
                  do zero ao avançado
                </h2>
                <p className="text-muted-foreground mx-auto mt-4 max-w-2xl">
                  Módulos organizados para você evoluir de forma estruturada e
                  alcançar resultados reais
                </p>
              </Reveal>

              <div className="space-y-4">
                {MODULES.map((module, index) => (
                  <Reveal key={index} delayMs={index * 60}>
                    <div className="glass-card glass-card-hover group flex items-center gap-4 rounded-xl p-4 sm:p-6">
                      <div className="bg-gradient-custom flex size-14 shrink-0 items-center justify-center rounded-xl text-xl font-bold text-[#04222A] sm:size-16">
                        {module.number}
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold sm:text-xl">
                            {module.title}
                          </h3>
                          <span className="bg-brand-cyan/10 text-brand-cyan rounded-full px-2 py-0.5 text-xs font-medium">
                            {module.lessons} aulas
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {module.description}
                        </p>
                      </div>
                      <Lock className="text-muted-foreground size-5 opacity-0 transition-opacity group-hover:opacity-100 sm:size-6" />
                    </div>
                  </Reveal>
                ))}
              </div>

              <Reveal className="mt-8">
                <div className="border-brand-cyan/30 bg-brand-cyan/5 rounded-xl border p-6 text-center">
                  <p className="text-lg font-medium">
                    <span className="text-brand-cyan">+40 aulas</span> esperando
                    por você
                  </p>
                  <p className="text-muted-foreground mt-2 text-sm">
                    E novos conteúdos são adicionados toda semana
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Results/Proof Section */}
        <section className="py-12 sm:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">
              <Reveal className="mb-10 text-center">
                <h2 className="mb-3 text-2xl font-bold sm:text-3xl md:text-4xl">
                  Resultados que nossos alunos{" "}
                  <span className="text-gradient">já alcançaram</span>
                </h2>
              </Reveal>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {RESULT_STATS.map((stat, index) => (
                  <Reveal key={index} delayMs={index * 80}>
                    <div className="glass-card glass-card-hover rounded-xl p-6 text-center">
                      <stat.icon className="text-brand-cyan mx-auto mb-3 size-8" />
                      <div className="text-gradient text-3xl font-bold">
                        {stat.value}
                      </div>
                      <div className="text-muted-foreground mt-1 text-sm">
                        {stat.label}
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="depoimentos" className="scroll-mt-20 py-12 sm:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">
              <Reveal className="mb-10 text-center">
                <div className="border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium">
                  <ChatCircle className="size-3" weight="fill" />
                  O que dizem nossos alunos
                </div>
                <h2 className="mb-3 text-2xl font-bold sm:text-3xl md:text-4xl">
                  Histórias de{" "}
                  <span className="text-gradient">transformação</span>
                </h2>
              </Reveal>

              <div className="grid gap-6 md:grid-cols-3">
                {TESTIMONIALS.map((testimonial, index) => (
                  <Reveal key={index} delayMs={index * 100}>
                    <div className="glass-card glass-card-hover h-full rounded-2xl p-6">
                      <div className="mb-4 flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            className="size-4 text-amber-400"
                            weight="fill"
                          />
                        ))}
                      </div>
                      <p className="text-muted-foreground mb-4 text-sm">
                        &quot;{testimonial.text}&quot;
                      </p>
                      <div className="flex items-center gap-3">
                        <Image
                          src={testimonial.image}
                          alt={testimonial.name}
                          width={40}
                          height={40}
                          sizes="40px"
                          className="border-brand-cyan/50 size-10 rounded-full border-2"
                        />
                        <div>
                          <div className="font-semibold">
                            {testimonial.name}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {testimonial.role}
                          </div>
                        </div>
                      </div>
                      <div className="from-brand-cyan/10 to-brand-green/10 mt-4 rounded-lg bg-gradient-to-r p-2 text-center">
                        <span className="text-brand-cyan text-sm font-semibold">
                          {testimonial.highlight}
                        </span>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="relative overflow-hidden py-12 sm:py-16">
          {/* Background Effects */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="from-brand-cyan/10 to-brand-green/10 absolute top-1/2 left-1/2 size-[700px] max-w-none -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r blur-[120px]" />
          </div>

          <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
              <Reveal>
                <div className="group relative">
                  {/* Animated border glow */}
                  <div className="bg-gradient-custom animate-gradient absolute -inset-0.5 rounded-3xl opacity-40 blur transition-opacity duration-500 group-hover:opacity-60" />

                  <div className="glass-card relative overflow-hidden rounded-3xl p-8 sm:p-12">
                    {/* Best Value Badge */}
                    <div className="absolute top-6 -right-1 rotate-12">
                      <div className="rounded-l-lg bg-gradient-to-r from-yellow-500 to-orange-500 px-4 py-1 text-sm font-bold text-black shadow-lg">
                        MELHOR OFERTA
                      </div>
                    </div>

                    <div className="relative z-10 text-center">
                      <div className="bg-brand-cyan/20 mb-2 inline-flex items-center gap-2 rounded-full px-4 py-2">
                        <Crown className="text-brand-cyan size-5" weight="fill" />
                        <span className="text-brand-cyan font-semibold">
                          Clipfy League PRO
                        </span>
                      </div>

                      <h3 className="mt-4 text-2xl font-bold sm:text-3xl">
                        Comece sua jornada hoje
                      </h3>

                      {/* Pricing */}
                      <div className="mt-6">
                        <div className="flex items-baseline justify-center gap-2">
                          <span className="text-muted-foreground text-lg">
                            12x de
                          </span>
                          <span className="text-gradient text-5xl font-bold sm:text-6xl">
                            R$ {formatBRL(CLIPFY_PRO.installmentPrice)}
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-2">
                          ou pagamento único de{" "}
                          <span className="font-bold text-white">
                            R$ {formatBRL(CLIPFY_PRO.price)}
                          </span>{" "}
                          à vista
                        </p>
                        <p className="text-brand-cyan/80 mt-1 text-xs">
                          Acesso vitalício • Sem mensalidades • Sem renovação
                        </p>
                      </div>

                      {/* Features List */}
                      <div className="mx-auto mt-8 max-w-md space-y-3 text-left">
                        {[
                          "Academia Clipadora completa (+40 aulas)",
                          "Comunidade exclusiva de clipadores",
                          "Cargo VIP no Discord da Clipfy",
                          "Portfólio para contratação",
                          "Novos conteúdos toda semana",
                          "Suporte prioritário",
                        ].map((feature, index) => (
                          <div key={index} className="flex items-center gap-3">
                            <CheckCircle
                              className="text-brand-cyan size-5 shrink-0"
                              weight="fill"
                            />
                            <span className="text-muted-foreground">
                              {feature}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* CTA */}
                      <Button
                        onClick={handleSubscribe}
                        size="lg"
                        disabled={isLoading}
                        className="btn-gradient-auth mt-8 h-auto w-full rounded-xl px-8 py-4 text-lg font-bold transition-all hover:scale-105 hover:shadow-lg hover:shadow-[rgba(20,247,254,0.5)] disabled:opacity-70 disabled:hover:scale-100 sm:w-auto"
                      >
                        {isLoading ? (
                          <CircleNotch className="mr-2 size-5 animate-spin" />
                        ) : (
                          <Crown className="mr-2 size-5" weight="fill" />
                        )}
                        {isLoading
                          ? "CARREGANDO..."
                          : "GARANTIR ACESSO VITALÍCIO"}
                      </Button>

                      <p className="text-muted-foreground mt-4 text-sm">
                        Pagamento único • Sem mensalidades • Garantia de 7 dias
                      </p>

                      {/* Trust Badges */}
                      <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
                        <div className="text-muted-foreground flex items-center gap-2 text-xs">
                          <ShieldCheck className="text-brand-green size-4" />
                          Pagamento seguro
                        </div>
                        <div className="text-muted-foreground flex items-center gap-2 text-xs">
                          <Lock className="text-brand-green size-4" />
                          Seus dados protegidos
                        </div>
                      </div>
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
                      acesso completo e{" "}
                      <strong className="text-white">vitalício</strong> a tudo
                      que precisa para transformar sua paixão em renda.
                    </p>

                    <Button
                      onClick={handleSubscribe}
                      size="lg"
                      disabled={isLoading}
                      className="btn-gradient-auth group h-auto rounded-xl px-8 py-4 text-lg font-bold transition-all hover:scale-105 hover:shadow-lg hover:shadow-[rgba(20,247,254,0.5)] disabled:opacity-70 disabled:hover:scale-100"
                    >
                      {isLoading ? (
                        <CircleNotch className="mr-2 size-5 animate-spin" />
                      ) : (
                        <Crown className="mr-2 size-5" weight="fill" />
                      )}
                      {isLoading ? "CARREGANDO..." : "QUERO COMEÇAR AGORA"}
                      {!isLoading && (
                        <ArrowRight className="ml-2 size-5 transition-transform group-hover:translate-x-1" />
                      )}
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
                        <span>Até {CLIPFY_PRO.maxInstallments}x no cartão</span>
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
            onClick={handleSubscribe}
            size="lg"
            disabled={isLoading}
            className="btn-gradient-auth h-auto w-full rounded-xl py-4 text-lg font-bold shadow-lg shadow-[rgba(20,247,254,0.5)] disabled:opacity-70"
          >
            {isLoading ? (
              <CircleNotch className="mr-2 size-5 animate-spin" />
            ) : (
              <Crown className="mr-2 size-5" weight="fill" />
            )}
            {isLoading
              ? "CARREGANDO..."
              : `COMPRAR POR R$ ${formatBRL(CLIPFY_PRO.price)}`}
          </Button>
        </div>
      </div>
      {/* Fecha div de conteúdo z-10 */}
    </DarkScope>
  )
}
