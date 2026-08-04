"use client"

import * as React from "react"
import Link from "next/link"

import {
  ArrowRight,
  CalendarBlank,
  CaretDown,
  ChartBar,
  CheckCircle,
  Clock,
  Eye,
  Lightning,
  List,
  Medal,
  SealCheck,
  Shield,
  Sparkle,
  Target,
  TrendUp,
  UsersThree,
  Warning,
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

import { Safari } from "./safari"

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  const handleContratar = () => {
    window.open("/interest-list", "_blank")
  }

  const scrollToClippers = () => {
    document.getElementById("clipadores")?.scrollIntoView({ behavior: "smooth" })
    setMobileMenuOpen(false)
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
    <DarkScope className="text-foreground relative min-h-svh overflow-x-hidden bg-[#050f1c] text-white">
      {/* Ambiente fixo: petróleo + grade + auroras da marca */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(1100px_620px_at_50%_-10%,#0a1c2b_0%,#050f1c_58%,#020910_100%)]" />
        <div className="hero-grid absolute inset-0 opacity-30" />
        <div className="arena-aurora absolute -top-40 left-1/4 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-cyan/[0.08] blur-[128px]" />
        <div
          className="arena-aurora absolute top-1/4 right-1/4 h-96 w-96 translate-x-1/2 rounded-full bg-brand-green/[0.07] blur-[128px]"
          style={{ animationDelay: "-7s" }}
        />
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="animate-fade-in fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={toggleMobileMenu}
        />
      )}

      {/* Header */}
      <header className="fixed top-0 right-0 left-0 z-50 border-b border-white/10 bg-[#050f1c]/85 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Clipfy League">
            <Logo width={140} height={35} shadow={false} className="h-8 w-auto" />
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <button
              onClick={() => scrollToSection("como-funciona")}
              className="hover:text-brand-cyan cursor-pointer text-sm font-medium text-white/75 transition-colors"
            >
              Como funciona
            </button>
            <button
              onClick={() => scrollToSection("plataforma")}
              className="hover:text-brand-cyan cursor-pointer text-sm font-medium text-white/75 transition-colors"
            >
              Plataforma
            </button>
            <button
              onClick={() => scrollToSection("faq")}
              className="hover:text-brand-cyan cursor-pointer text-sm font-medium text-white/75 transition-colors"
            >
              FAQ
            </button>
            <button
              onClick={scrollToClippers}
              className="hover:text-brand-cyan cursor-pointer text-sm font-medium text-white/75 transition-colors"
            >
              Sou Clipador
            </button>
            <Button
              onClick={handleContratar}
              size="sm"
              className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
            >
              Quero contratar
            </Button>
          </nav>
          <button
            className={`group relative cursor-pointer rounded-lg p-2 transition-all md:hidden ${
              mobileMenuOpen
                ? "bg-brand-cyan/20 shadow-lg shadow-brand-cyan/50"
                : "hover:bg-white/10"
            }`}
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
          >
            <div className="relative h-6 w-6">
              <List
                className={`absolute inset-0 h-6 w-6 transition-all duration-200 ease-in-out ${
                  mobileMenuOpen
                    ? "scale-75 rotate-45 opacity-0"
                    : "scale-100 rotate-0 opacity-100"
                }`}
              />
              <X
                className={`text-brand-cyan absolute inset-0 h-6 w-6 transition-all duration-200 ease-in-out ${
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
          <div className="animate-fade-in-down border-brand-cyan/30 shadow-brand-cyan/20 border-t bg-gradient-to-b from-[#050f1c]/95 to-[#050f1c]/90 shadow-2xl backdrop-blur-xl md:hidden">
            <div className="container mx-auto space-y-3 px-4 py-6">
              <button
                onClick={() => scrollToSection("como-funciona")}
                className="animate-fade-in-down hover:text-brand-cyan block w-full cursor-pointer rounded-lg py-3 text-left text-sm font-medium transition-all hover:bg-white/10 hover:pl-2"
                style={{ animationDelay: "0.05s" }}
              >
                Como funciona
              </button>
              <button
                onClick={() => scrollToSection("plataforma")}
                className="animate-fade-in-down hover:text-brand-cyan block w-full cursor-pointer rounded-lg py-3 text-left text-sm font-medium transition-all hover:bg-white/10 hover:pl-2"
                style={{ animationDelay: "0.1s" }}
              >
                Plataforma
              </button>
              <button
                onClick={() => scrollToSection("faq")}
                className="animate-fade-in-down hover:text-brand-cyan block w-full cursor-pointer rounded-lg py-3 text-left text-sm font-medium transition-all hover:bg-white/10 hover:pl-2"
                style={{ animationDelay: "0.15s" }}
              >
                FAQ
              </button>
              <Button
                onClick={scrollToClippers}
                variant="outline"
                size="sm"
                className="animate-fade-in-down w-full cursor-pointer rounded-xl border-white/15 text-white transition-all hover:scale-[1.02] hover:bg-white/5 hover:text-white"
                style={{ animationDelay: "0.2s" }}
              >
                Sou Clipador
              </Button>
              <Button
                onClick={handleContratar}
                size="sm"
                className="btn-gradient-auth animate-fade-in-down w-full cursor-pointer rounded-xl font-semibold transition-all hover:scale-[1.02]"
                style={{ animationDelay: "0.25s" }}
              >
                Quero contratar
              </Button>
            </div>
          </div>
        )}
      </header>

      <div className="relative z-10">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-24 pb-12 sm:pt-28 sm:pb-16">
          <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl text-center">
              <div className="animate-fade-in-down border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium">
                <Sparkle className="size-3" weight="fill" />
                Realize competições profissionais de cortes para sua marca
              </div>

              <h1
                className="animate-fade-in-up mb-4 text-3xl leading-tight font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl"
                style={{ animationDelay: "0.2s" }}
              >
                Clipfy League
                <span className="text-gradient block">
                  Competições de cortes com acompanhamento em tempo real
                </span>
              </h1>

              <p
                className="animate-fade-in-up mx-auto mb-6 max-w-2xl text-base text-white/70 sm:text-lg"
                style={{ animationDelay: "0.4s" }}
              >
                Operamos competições de cortes end-to-end: do planejamento ao
                pagamento dos vencedores, com ranking ao vivo, antifraude e
                métricas em tempo real.
              </p>

              {/* Value Bullets */}
              <div className="mx-auto mb-8 grid max-w-3xl gap-3 sm:grid-cols-3">
                <div
                  className="animate-fade-in-up hover:border-brand-cyan/50 flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-3 backdrop-blur-sm transition-all hover:bg-white/10"
                  style={{ animationDelay: "0.5s" }}
                >
                  <CheckCircle className="text-brand-cyan size-4 shrink-0" weight="fill" />
                  <p className="text-left text-xs text-white/75">
                    Cuidamos de tudo: onboarding, validação, ranking e pagamento
                    dos vencedores
                  </p>
                </div>
                <div
                  className="animate-fade-in-up hover:border-brand-cyan/50 flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-3 backdrop-blur-sm transition-all hover:bg-white/10"
                  style={{ animationDelay: "0.6s" }}
                >
                  <Shield className="text-brand-cyan size-4 shrink-0" weight="fill" />
                  <p className="text-left text-xs text-white/75">
                    Antifraude nativo e auditoria completa para proteger sua
                    marca
                  </p>
                </div>
                <div
                  className="animate-fade-in-up hover:border-brand-cyan/50 flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-3 backdrop-blur-sm transition-all hover:bg-white/10"
                  style={{ animationDelay: "0.7s" }}
                >
                  <ChartBar className="text-brand-cyan size-4 shrink-0" weight="fill" />
                  <p className="text-left text-xs text-white/75">
                    Relatórios completos com alcance, engajamento e top
                    performers
                  </p>
                </div>
              </div>

              {/* CTA */}
              <div
                className="animate-fade-in flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
                style={{ animationDelay: "0.8s" }}
              >
                <Button
                  onClick={handleContratar}
                  className="btn-gradient-auth cursor-pointer rounded-xl text-sm font-semibold shadow-[0_8px_30px_-8px_rgba(20,247,254,0.45)] transition-all hover:scale-105"
                >
                  Realizar uma competição
                  <ArrowRight className="ml-2 size-4" />
                </Button>
                <Button
                  onClick={scrollToClippers}
                  variant="outline"
                  className="cursor-pointer rounded-xl border-white/15 text-sm text-white transition-all hover:scale-105 hover:bg-white/5 hover:text-white"
                >
                  Sou Clipador
                </Button>
              </div>

              <p
                className="animate-fade-in mt-3 text-xs text-white/60"
                style={{ animationDelay: "0.8s" }}
              >
                ✓ Operamos sua competição do início ao fim
              </p>
            </div>

            {/* Platform Preview with Safari */}
            <div
              className="animate-scale-in mx-auto mt-12 max-w-5xl"
              style={{ animationDelay: "0.8s" }}
            >
              <Safari
                imageSrc="/images/platform/home.png"
                url="app.clipfyleague.com"
                className="shadow-2xl transition-all duration-300 hover:scale-105"
              />
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <CaretDown className="size-6 text-white/50" />
          </div>
        </section>

        {/* Social Proof */}
        <section className="border-y border-white/10 bg-white/5 py-8 backdrop-blur-sm">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="mx-auto max-w-3xl text-center">
                <h3 className="text-brand-cyan mb-2 text-sm font-semibold">
                  Marcas e criadores que já realizaram competições conosco
                </h3>
                <p className="text-sm text-white/75">
                  Alcance orgânico + criadores motivados = ROI mensurável e
                  previsível
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Como Funciona */}
        <section id="como-funciona" className="scroll-mt-20 py-12 sm:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">
              <Reveal>
                <div className="mb-10 text-center">
                  <h2 className="mb-3 text-2xl font-bold sm:text-3xl md:text-4xl">
                    Do kick-off ao payout,{" "}
                    <span className="text-gradient">em 4 passos simples</span>
                  </h2>
                </div>
              </Reveal>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Passo 1 */}
                <Reveal delayMs={0}>
                  <div className="group hover:border-brand-cyan/50 hover:shadow-brand-cyan/20 relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:scale-[1.02] hover:-translate-y-1 hover:shadow-lg">
                    <div className="bg-brand-cyan/10 group-hover:bg-brand-cyan/20 absolute top-0 right-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full blur-3xl transition-all duration-500 group-hover:scale-150" />
                    <div className="mb-3 flex items-center gap-3">
                      <div className="bg-gradient-custom flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-[#04222A]">
                        1
                      </div>
                      <h3 className="text-lg font-semibold">Regras &amp; Calendário</h3>
                    </div>
                    <p className="text-sm text-white/75">
                      Definimos objetivo, datas e regulamento claro: disputa por
                      visualizações no período, critérios de desempate, hashtags
                      e menções oficiais.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="bg-brand-cyan/10 text-brand-cyan rounded-full px-2.5 py-0.5 text-xs font-medium">
                        <Target className="mr-1 inline-block size-3" />
                        Objetivos claros
                      </span>
                      <span className="bg-brand-green/10 text-brand-green rounded-full px-2.5 py-0.5 text-xs font-medium">
                        <CalendarBlank className="mr-1 inline-block size-3" />
                        Datas definidas
                      </span>
                    </div>
                  </div>
                </Reveal>

                {/* Passo 2 */}
                <Reveal delayMs={80}>
                  <div className="group hover:border-brand-cyan/50 hover:shadow-brand-cyan/20 relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:scale-[1.02] hover:-translate-y-1 hover:shadow-lg">
                    <div className="bg-brand-green/10 group-hover:bg-brand-green/20 absolute top-0 right-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full blur-3xl transition-all duration-500 group-hover:scale-150" />
                    <div className="mb-3 flex items-center gap-3">
                      <div className="bg-gradient-custom flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-[#04222A]">
                        2
                      </div>
                      <h3 className="text-lg font-semibold">
                        Comunidade &amp; Inscrições
                      </h3>
                    </div>
                    <p className="text-sm text-white/75">
                      Onboarding de clipadores com termos de participação, guias
                      e formulário de envio de links.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="bg-brand-cyan/10 text-brand-cyan rounded-full px-2.5 py-0.5 text-xs font-medium">
                        <UsersThree className="mr-1 inline-block size-3" />
                        Onboarding
                      </span>
                      <span className="bg-brand-green/10 text-brand-green rounded-full px-2.5 py-0.5 text-xs font-medium">
                        <SealCheck className="mr-1 inline-block size-3" />
                        Termos claros
                      </span>
                    </div>
                  </div>
                </Reveal>

                {/* Passo 3 */}
                <Reveal delayMs={160}>
                  <div className="group hover:border-brand-cyan/50 hover:shadow-brand-cyan/20 relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:scale-[1.02] hover:-translate-y-1 hover:shadow-lg">
                    <div className="bg-brand-cyan/10 group-hover:bg-brand-cyan/20 absolute top-0 right-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full blur-3xl transition-all duration-500 group-hover:scale-150" />
                    <div className="mb-3 flex items-center gap-3">
                      <div className="bg-gradient-custom flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-[#04222A]">
                        3
                      </div>
                      <h3 className="text-lg font-semibold">Publicação Oficial</h3>
                    </div>
                    <p className="text-sm text-white/75">
                      Os participantes postam nos próprios perfis (Instagram,
                      TikTok, YouTube Shorts) usando as regras oficiais; a
                      plataforma coleta os links.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="bg-brand-cyan/10 text-brand-cyan rounded-full px-2.5 py-0.5 text-xs font-medium">
                        Instagram
                      </span>
                      <span className="bg-brand-green/10 text-brand-green rounded-full px-2.5 py-0.5 text-xs font-medium">
                        TikTok
                      </span>
                      <span className="bg-brand-cyan/10 text-brand-cyan rounded-full px-2.5 py-0.5 text-xs font-medium">
                        YouTube
                      </span>
                    </div>
                  </div>
                </Reveal>

                {/* Passo 4 */}
                <Reveal delayMs={240}>
                  <div className="group hover:border-brand-cyan/50 hover:shadow-brand-cyan/20 relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:scale-[1.02] hover:-translate-y-1 hover:shadow-lg">
                    <div className="bg-brand-green/10 group-hover:bg-brand-green/20 absolute top-0 right-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full blur-3xl transition-all duration-500 group-hover:scale-150" />
                    <div className="mb-3 flex items-center gap-3">
                      <div className="bg-gradient-custom flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-[#04222A]">
                        4
                      </div>
                      <h3 className="text-lg font-semibold">
                        Metrificação &amp; Ranking
                      </h3>
                    </div>
                    <p className="text-sm text-white/75">
                      A Clipfy League valida os envios, atualiza o leaderboard,
                      acompanha engajamento e gera relatórios semanais e final.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="bg-brand-cyan/10 text-brand-cyan rounded-full px-2.5 py-0.5 text-xs font-medium">
                        <TrendUp className="mr-1 inline-block size-3" />
                        Ranking ao vivo
                      </span>
                      <span className="bg-brand-green/10 text-brand-green rounded-full px-2.5 py-0.5 text-xs font-medium">
                        <ChartBar className="mr-1 inline-block size-3" />
                        Relatórios
                      </span>
                    </div>
                  </div>
                </Reveal>
              </div>

              <Reveal>
                <div className="border-brand-cyan/30 bg-brand-cyan/5 mt-8 rounded-lg border p-4 text-center backdrop-blur-sm">
                  <Warning className="text-brand-cyan mx-auto mb-2 size-5" weight="fill" />
                  <p className="text-sm font-medium text-white/90">
                    Os prêmios só são pagos após auditoria final
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* A Plataforma */}
        <section
          id="plataforma"
          className="scroll-mt-20 bg-white/5 py-12 backdrop-blur-sm sm:py-16"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">
              <Reveal>
                <div className="mb-10 text-center">
                  <h2 className="mb-3 text-2xl font-bold sm:text-3xl md:text-4xl">
                    <span className="text-gradient">Métricas completas,</span>{" "}
                    sem complexidade
                  </h2>
                  <p className="mx-auto mt-4 max-w-2xl text-sm text-white/75">
                    Tudo acontece dentro da Clipfy League: contagem de
                    visualizações (métrica de disputa), curtidas, comentários,
                    compartilhamentos, taxa de engajamento, contas mais
                    engajadas, top criadores, vídeos mais engajados e evolução
                    temporal — com filtros por plataforma e período.
                  </p>
                </div>
              </Reveal>

              {/* Platform Screenshots Grid */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Clippers */}
                <Reveal delayMs={0}>
                  <div className="space-y-3">
                    <Safari
                      imageSrc="/images/platform/clippers.png"
                      url="app.clipfyleague.com/clippers"
                      className="shadow-brand-cyan/10 hover:shadow-brand-cyan/20 shadow-lg transition-all hover:scale-[1.02] hover:shadow-2xl"
                    />
                    <div className="text-center">
                      <h3 className="text-brand-cyan mb-1 text-sm font-semibold">
                        Leaderboard ao vivo
                      </h3>
                      <p className="text-xs text-white/60">
                        Ranking mensal e geral da campanha atualizado em tempo
                        real
                      </p>
                    </div>
                  </div>
                </Reveal>

                {/* Metrics */}
                <Reveal delayMs={80}>
                  <div className="space-y-3">
                    <Safari
                      imageSrc="/images/platform/metrics.png"
                      url="app.clipfyleague.com/metrics"
                      className="shadow-brand-green/10 hover:shadow-brand-green/20 shadow-lg transition-all hover:scale-[1.02] hover:shadow-2xl"
                    />
                    <div className="text-center">
                      <h3 className="text-brand-green mb-1 text-sm font-semibold">
                        Módulo de engajamento
                      </h3>
                      <p className="text-xs text-white/60">
                        Engajamento, top contas e vídeos mais performados
                      </p>
                    </div>
                  </div>
                </Reveal>

                {/* Accounts & Posts */}
                <Reveal delayMs={0}>
                  <div className="space-y-3">
                    <Safari
                      imageSrc="/images/platform/accounts-posts-metrics.png"
                      url="app.clipfyleague.com/analytics"
                      className="shadow-brand-cyan/10 hover:shadow-brand-cyan/20 shadow-lg transition-all hover:scale-[1.02] hover:shadow-2xl"
                    />
                    <div className="text-center">
                      <h3 className="text-brand-cyan mb-1 text-sm font-semibold">
                        Analytics detalhados
                      </h3>
                      <p className="text-xs text-white/60">
                        Análise profunda de contas e posts por período
                      </p>
                    </div>
                  </div>
                </Reveal>

                {/* Reports */}
                <Reveal delayMs={80}>
                  <div className="space-y-3">
                    <Safari
                      imageSrc="/images/platform/report-competition.png"
                      url="app.clipfyleague.com/reports"
                      className="shadow-brand-green/10 hover:shadow-brand-green/20 shadow-lg transition-all hover:scale-[1.02] hover:shadow-2xl"
                    />
                    <div className="text-center">
                      <h3 className="text-brand-green mb-1 text-sm font-semibold">
                        Relatórios executivos
                      </h3>
                      <p className="text-xs text-white/60">
                        Highlights e anexos de auditoria completos
                      </p>
                    </div>
                  </div>
                </Reveal>
              </div>

              {/* Features Grid */}
              <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Reveal delayMs={0}>
                  <div className="group hover:border-brand-cyan/50 h-full rounded-lg border border-white/10 bg-white/5 p-4 text-center backdrop-blur-sm transition-all hover:scale-105 hover:-translate-y-1 hover:bg-white/10">
                    <TrendUp className="text-brand-cyan mx-auto mb-2 size-6 transition-transform group-hover:scale-110" weight="duotone" />
                    <h4 className="mb-1 text-sm font-semibold">
                      Leaderboard ao vivo
                    </h4>
                    <p className="text-xs text-white/60">
                      Mensal e geral da campanha
                    </p>
                  </div>
                </Reveal>
                <Reveal delayMs={80}>
                  <div className="group hover:border-brand-green/50 h-full rounded-lg border border-white/10 bg-white/5 p-4 text-center backdrop-blur-sm transition-all hover:scale-105 hover:-translate-y-1 hover:bg-white/10">
                    <ChartBar className="text-brand-green mx-auto mb-2 size-6 transition-transform group-hover:scale-110" weight="duotone" />
                    <h4 className="mb-1 text-sm font-semibold">Engajamento</h4>
                    <p className="text-xs text-white/60">
                      Taxa de interação, top contas e vídeos
                    </p>
                  </div>
                </Reveal>
                <Reveal delayMs={160}>
                  <div className="group hover:border-brand-cyan/50 h-full rounded-lg border border-white/10 bg-white/5 p-4 text-center backdrop-blur-sm transition-all hover:scale-105 hover:-translate-y-1 hover:bg-white/10">
                    <SealCheck className="text-brand-cyan mx-auto mb-2 size-6 transition-transform group-hover:scale-110" weight="duotone" />
                    <h4 className="mb-1 text-sm font-semibold">
                      Relatórios executivos
                    </h4>
                    <p className="text-xs text-white/60">
                      Highlights e auditoria
                    </p>
                  </div>
                </Reveal>
                <Reveal delayMs={240}>
                  <div className="group hover:border-brand-green/50 h-full rounded-lg border border-white/10 bg-white/5 p-4 text-center backdrop-blur-sm transition-all hover:scale-105 hover:-translate-y-1 hover:bg-white/10">
                    <Lightning className="text-brand-green mx-auto mb-2 size-6 transition-transform group-hover:scale-110" weight="duotone" />
                    <h4 className="mb-1 text-sm font-semibold">Exportações</h4>
                    <p className="text-xs text-white/60">
                      E webhooks quando aplicável
                    </p>
                  </div>
                </Reveal>
              </div>

              <Reveal>
                <div className="mt-8 text-center">
                  <Button
                    onClick={handleContratar}
                    className="btn-gradient-auth cursor-pointer rounded-xl font-semibold transition-all hover:scale-105"
                  >
                    Ver a plataforma em ação
                    <Eye className="ml-2 size-4" />
                  </Button>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Antifraude & Auditoria */}
        <section className="py-12 sm:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">
              <div className="grid items-center gap-8 lg:grid-cols-2">
                <Reveal>
                  <div>
                    <div className="border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium">
                      <Shield className="size-3" weight="fill" />
                      Proteção nativa
                    </div>
                    <h2 className="mb-4 text-2xl font-bold sm:text-3xl md:text-4xl">
                      <span className="text-gradient">Confiabilidade</span> por
                      padrão
                    </h2>
                    <p className="mb-6 text-sm text-white/75">
                      Protegemos a disputa com detecção de duplicidade, alertas
                      de tráfego suspeito e revalidação de finalistas.
                      Entregamos relatório de auditoria e histórico de decisões.
                    </p>
                    <p className="text-brand-cyan mb-6 text-base font-semibold">
                      Simples: não existe prêmio sem auditoria final.
                    </p>

                    <div className="space-y-3">
                      <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
                        <CheckCircle className="text-brand-cyan size-5 shrink-0" weight="fill" />
                        <div>
                          <h4 className="mb-0.5 text-sm font-semibold">
                            Conteúdo duplicado não conta
                          </h4>
                          <p className="text-xs text-white/60">
                            Detecção automática de links e vídeos repetidos
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
                        <Warning className="text-brand-green size-5 shrink-0" weight="fill" />
                        <div>
                          <h4 className="mb-0.5 text-sm font-semibold">
                            Visualizações falsas = desclassificação
                          </h4>
                          <p className="text-xs text-white/60">
                            Monitoramos crescimento suspeito e bloqueamos
                            tráfego falso
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
                        <SealCheck className="text-brand-cyan size-5 shrink-0" weight="fill" />
                        <div>
                          <h4 className="mb-0.5 text-sm font-semibold">
                            Histórico completo garante rastreabilidade
                          </h4>
                          <p className="text-xs text-white/60">
                            Registro completo de decisões e auditoria
                            transparente
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Reveal>

                <Reveal delayMs={120}>
                  <div className="relative">
                    <div className="from-brand-cyan/20 to-brand-green/20 absolute inset-0 rounded-2xl bg-gradient-to-br blur-3xl" />
                    <div className="glass-card relative rounded-xl p-6">
                      <Shield className="text-brand-cyan mb-4 size-12" weight="duotone" />
                      <h3 className="mb-3 text-lg font-bold">
                        Sistema antifraude multicamadas
                      </h3>
                      <ul className="space-y-2 text-sm text-white/75">
                        <li className="flex items-center gap-3">
                          <div className="bg-brand-cyan h-2 w-2 rounded-full" />
                          Validação automática de elegibilidade
                        </li>
                        <li className="flex items-center gap-3">
                          <div className="bg-brand-green h-2 w-2 rounded-full" />
                          Detecção de anomalias em tempo real
                        </li>
                        <li className="flex items-center gap-3">
                          <div className="bg-brand-cyan h-2 w-2 rounded-full" />
                          Revalidação manual de finalistas
                        </li>
                        <li className="flex items-center gap-3">
                          <div className="bg-brand-green h-2 w-2 rounded-full" />
                          Relatório de auditoria final detalhado
                        </li>
                      </ul>
                    </div>
                  </div>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        {/* Cronograma */}
        <section className="bg-white/5 py-12 backdrop-blur-sm sm:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl">
              <Reveal>
                <div className="mb-10 text-center">
                  <h2 className="mb-3 text-2xl font-bold sm:text-3xl md:text-4xl">
                    Quanto tempo <span className="text-gradient">leva?</span>
                  </h2>
                  <p className="mx-auto mt-3 max-w-2xl text-sm text-white/75">
                    Do primeiro contato até o pagamento dos vencedores
                  </p>
                </div>
              </Reveal>

              <div className="grid gap-6 md:grid-cols-3">
                <Reveal delayMs={0}>
                  <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6">
                    <div className="bg-gradient-custom mb-2 flex h-10 w-10 items-center justify-center rounded-lg">
                      <CalendarBlank className="size-5 text-[#04222A]" weight="fill" />
                    </div>
                    <h3 className="mb-3 text-base font-semibold">
                      1-2 semanas antes
                    </h3>
                    <p className="text-sm text-white/75">
                      Definimos regras, montamos a página e preparamos os
                      participantes
                    </p>
                  </div>
                </Reveal>

                <Reveal delayMs={80}>
                  <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6">
                    <div className="bg-gradient-custom mb-2 flex h-10 w-10 items-center justify-center rounded-lg">
                      <Lightning className="size-5 text-[#04222A]" weight="fill" />
                    </div>
                    <h3 className="mb-3 text-base font-semibold">1 a 6 meses</h3>
                    <p className="text-sm text-white/75">
                      Competição rola, ranking atualiza diariamente e
                      acompanhamos tudo
                    </p>
                  </div>
                </Reveal>

                <Reveal delayMs={160}>
                  <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6">
                    <div className="bg-gradient-custom mb-2 flex h-10 w-10 items-center justify-center rounded-lg">
                      <Medal className="size-5 text-[#04222A]" weight="fill" />
                    </div>
                    <h3 className="mb-3 text-base font-semibold">
                      7 dias depois
                    </h3>
                    <p className="text-sm text-white/75">
                      Fazemos auditoria final e pagamos os vencedores
                    </p>
                  </div>
                </Reveal>
              </div>

              {/* Destaque */}
              <Reveal>
                <div className="border-brand-cyan/30 bg-brand-cyan/5 mt-8 rounded-xl border p-6 text-center backdrop-blur-sm">
                  <Clock className="text-brand-cyan mx-auto mb-3 size-8" weight="duotone" />
                  <h3 className="mb-2 text-base font-bold">Duração típica</h3>
                  <p className="text-sm text-white/75">
                    Competições de <strong>1 mês</strong> são as mais comuns,
                    mas fazemos de <strong>2 semanas até 6 meses</strong>{" "}
                    conforme sua necessidade
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Resultados & Benefícios */}
        <section className="py-12 sm:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">
              <Reveal>
                <div className="mb-10 text-center">
                  <h2 className="mb-3 text-2xl font-bold sm:text-3xl md:text-4xl">
                    Por que fazer uma{" "}
                    <span className="text-gradient">competição de cortes</span>{" "}
                    agora
                  </h2>
                </div>
              </Reveal>

              <div className="grid gap-6 md:grid-cols-2">
                <Reveal delayMs={0}>
                  <div className="group hover:border-brand-cyan/50 relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:scale-[1.02] hover:-translate-y-1">
                    <div className="bg-brand-cyan/10 group-hover:bg-brand-cyan/20 absolute top-0 right-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full blur-3xl transition-all duration-500 group-hover:scale-150" />
                    <Eye className="text-brand-cyan mb-3 size-8 transition-transform group-hover:scale-110" weight="duotone" />
                    <h3 className="mb-3 text-lg font-semibold">
                      Alcance orgânico real
                    </h3>
                    <p className="text-sm text-white/75">
                      Disputa por visualizações com validação e auditoria. Cada
                      visualização é genuína e rastreável, garantindo retorno
                      sobre investimento mensurável.
                    </p>
                  </div>
                </Reveal>

                <Reveal delayMs={80}>
                  <div className="group hover:border-brand-green/50 relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:scale-[1.02] hover:-translate-y-1">
                    <div className="bg-brand-green/10 group-hover:bg-brand-green/20 absolute top-0 right-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full blur-3xl transition-all duration-500 group-hover:scale-150" />
                    <Shield className="text-brand-green mb-3 size-8 transition-transform group-hover:scale-110" weight="duotone" />
                    <h3 className="mb-3 text-lg font-semibold">
                      Conteúdo com controle
                    </h3>
                    <p className="text-sm text-white/75">
                      Regras simples e transparência do começo ao fim. Controle
                      total sobre o que é publicado e como é mensurado.
                    </p>
                  </div>
                </Reveal>

                <Reveal delayMs={160}>
                  <div className="group hover:border-brand-cyan/50 relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:scale-[1.02] hover:-translate-y-1">
                    <div className="bg-brand-cyan/10 group-hover:bg-brand-cyan/20 absolute top-0 right-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full blur-3xl transition-all duration-500 group-hover:scale-150" />
                    <ChartBar className="text-brand-cyan mb-3 size-8 transition-transform group-hover:scale-110" weight="duotone" />
                    <h3 className="mb-3 text-lg font-semibold">
                      Dados acionáveis
                    </h3>
                    <p className="text-sm text-white/75">
                      Entenda o que performa melhor: conteúdos, contas,
                      formatos. Insights profundos para otimizar sua estratégia.
                    </p>
                  </div>
                </Reveal>

                <Reveal delayMs={240}>
                  <div className="group hover:border-brand-green/50 relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:scale-[1.02] hover:-translate-y-1">
                    <div className="bg-brand-green/10 group-hover:bg-brand-green/20 absolute top-0 right-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full blur-3xl transition-all duration-500 group-hover:scale-150" />
                    <CheckCircle className="text-brand-green mb-3 size-8 transition-transform group-hover:scale-110" weight="duotone" />
                    <h3 className="mb-3 text-lg font-semibold">Brand safety</h3>
                    <p className="text-sm text-white/75">
                      Antifraude nativo e payout condicionado à auditoria. Sua
                      marca protegida em todas as etapas da competição.
                    </p>
                  </div>
                </Reveal>
              </div>

              <Reveal>
                <div className="mt-8 text-center">
                  <Button
                    onClick={handleContratar}
                    className="btn-gradient-auth cursor-pointer rounded-xl font-semibold transition-all hover:scale-105"
                  >
                    Quero um plano para minha marca
                    <ArrowRight className="ml-2 size-4" />
                  </Button>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          className="scroll-mt-20 bg-white/5 py-12 backdrop-blur-sm sm:py-16"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
              <Reveal>
                <div className="mb-10 text-center">
                  <h2 className="mb-3 text-2xl font-bold sm:text-3xl md:text-4xl">
                    Perguntas <span className="text-gradient">frequentes</span>
                  </h2>
                </div>
              </Reveal>

              <Reveal delayMs={80}>
                <Accordion type="single" collapsible className="space-y-3">
                  <AccordionItem
                    value="item-1"
                    className="rounded-xl border border-white/10 bg-white/5 px-6 backdrop-blur-sm last:border-b"
                  >
                    <AccordionTrigger className="hover:text-brand-cyan text-left text-white hover:no-underline">
                      Como é definido o vencedor?
                    </AccordionTrigger>
                    <AccordionContent className="text-white/75">
                      Por visualizações válidas no período da competição. Em
                      caso de empate, usamos taxa de engajamento médio e, se
                      necessário, número de vídeos válidos.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="item-2"
                    className="rounded-xl border border-white/10 bg-white/5 px-6 backdrop-blur-sm last:border-b"
                  >
                    <AccordionTrigger className="hover:text-brand-cyan text-left text-white hover:no-underline">
                      Como vocês evitam fraude?
                    </AccordionTrigger>
                    <AccordionContent className="text-white/75">
                      Detectamos duplicidades, monitoramos crescimento suspeito
                      de visualizações e revalidamos todos os finalistas. A
                      disputa só encerra com auditoria final completa e
                      relatório detalhado de evidências.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="item-3"
                    className="rounded-xl border border-white/10 bg-white/5 px-6 backdrop-blur-sm last:border-b"
                  >
                    <AccordionTrigger className="hover:text-brand-cyan text-left text-white hover:no-underline">
                      Quais plataformas são aceitas?
                    </AccordionTrigger>
                    <AccordionContent className="text-white/75">
                      Instagram, TikTok e YouTube Shorts, ou conforme o escopo
                      aprovado no planejamento da sua campanha.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="item-4"
                    className="rounded-xl border border-white/10 bg-white/5 px-6 backdrop-blur-sm last:border-b"
                  >
                    <AccordionTrigger className="hover:text-brand-cyan text-left text-white hover:no-underline">
                      Quem paga os prêmios?
                    </AccordionTrigger>
                    <AccordionContent className="text-white/75">
                      A Clipfy operacionaliza o payout após auditoria final,
                      garantindo que todos os critérios foram atendidos e que
                      não há irregularidades.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="item-5"
                    className="rounded-xl border border-white/10 bg-white/5 px-6 backdrop-blur-sm last:border-b"
                  >
                    <AccordionTrigger className="hover:text-brand-cyan text-left text-white hover:no-underline">
                      Quanto tempo dura a competição?
                    </AccordionTrigger>
                    <AccordionContent className="text-white/75">
                      Definimos conforme sua estratégia. Os modelos mais comuns
                      são competições de 1 mês (sprint), 3 meses (trimestral) e
                      6 meses (semestral).
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Seção Clipadores */}
        <section id="clipadores" className="scroll-mt-20 py-12 sm:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">
              <Reveal>
                <div className="border-brand-green/30 from-brand-green/10 to-brand-cyan/10 rounded-2xl border bg-gradient-to-br p-6 backdrop-blur-sm sm:p-8 lg:p-10">
                  <div className="text-center">
                    <div className="border-brand-green/30 bg-brand-green/10 text-brand-green mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium">
                      <Medal className="size-3" weight="fill" />
                      Para clipadores
                    </div>
                    <h2 className="mb-3 text-2xl font-bold sm:text-3xl md:text-4xl">
                      É clipador e quer{" "}
                      <span className="text-gradient">competir?</span>
                    </h2>
                    <p className="mx-auto mb-8 max-w-2xl text-sm text-white/75">
                      Ranking por visualizações, regras simples e pagamento após
                      auditoria.
                    </p>

                    <div className="mb-8 grid gap-4 text-left sm:grid-cols-3">
                      <div className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                        <div className="bg-gradient-custom mb-2 flex h-10 w-10 items-center justify-center rounded-lg">
                          <Lightning className="size-5 text-[#04222A]" weight="fill" />
                        </div>
                        <h3 className="mb-1 text-sm font-semibold">
                          Publique nas suas redes
                        </h3>
                        <p className="text-xs text-white/60">
                          Use as hashtags oficiais e crie seus vídeos do seu
                          jeito
                        </p>
                      </div>

                      <div className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                        <div className="bg-gradient-custom mb-2 flex h-10 w-10 items-center justify-center rounded-lg">
                          <TrendUp className="size-5 text-[#04222A]" weight="fill" />
                        </div>
                        <h3 className="mb-1 text-sm font-semibold">
                          Acompanhe seu ranking
                        </h3>
                        <p className="text-xs text-white/60">
                          Envie os links e veja sua posição em tempo real
                        </p>
                      </div>

                      <div className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                        <div className="bg-gradient-custom mb-2 flex h-10 w-10 items-center justify-center rounded-lg">
                          <Medal className="size-5 text-[#04222A]" weight="fill" />
                        </div>
                        <h3 className="mb-1 text-sm font-semibold">
                          Transparência total
                        </h3>
                        <p className="text-xs text-white/60">
                          Pagamento confiável após auditoria final
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold">Benefícios</h3>
                      <div className="flex flex-wrap justify-center gap-2">
                        <span className="border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan rounded-full border px-3 py-1.5 text-xs font-medium">
                          Leaderboard transparente
                        </span>
                        <span className="border-brand-green/30 bg-brand-green/10 text-brand-green rounded-full border px-3 py-1.5 text-xs font-medium">
                          Consistência valorizada
                        </span>
                        <span className="border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan rounded-full border px-3 py-1.5 text-xs font-medium">
                          Visibilidade real
                        </span>
                      </div>
                    </div>

                    <div className="mt-8">
                      <Link href="/sign-up" target="_blank">
                        <Button className="btn-gradient-auth cursor-pointer rounded-xl text-sm font-semibold transition-all hover:scale-105">
                          Quero Participar
                          <ArrowRight className="ml-2 size-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* CTA Final */}
        <section className="scroll-mt-20 bg-white/5 py-16 backdrop-blur-sm sm:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl">
              <Reveal>
                <div className="border-brand-cyan/30 from-brand-cyan/10 to-brand-green/10 relative overflow-hidden rounded-3xl border bg-gradient-to-br p-12 text-center backdrop-blur-sm sm:p-16">
                  {/* Background glow effect */}
                  <div className="pointer-events-none absolute inset-0">
                    <div className="bg-brand-cyan/20 absolute top-0 left-1/4 h-96 w-96 -translate-x-1/2 rounded-full blur-[128px]" />
                    <div className="bg-brand-green/20 absolute right-1/4 bottom-0 h-96 w-96 translate-x-1/2 rounded-full blur-[128px]" />
                  </div>

                  <div className="relative z-10">
                    <div className="border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium">
                      <Sparkle className="size-4" weight="fill" />
                      Pronto para começar
                    </div>

                    <h2 className="mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
                      Vamos <span className="text-gradient">revolucionar</span>{" "}
                      suas competições?
                    </h2>

                    <p className="mx-auto mb-8 max-w-2xl text-base text-white/75 sm:text-lg">
                      Preencha um formulário rápido e nosso time entrará em
                      contato em até 1 dia útil com uma proposta personalizada
                      ou convite para demo ao vivo.
                    </p>

                    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                      <Button
                        onClick={handleContratar}
                        className="btn-gradient-auth cursor-pointer rounded-xl text-base font-semibold shadow-[0_8px_30px_-8px_rgba(20,247,254,0.45)] transition-all hover:scale-105"
                      >
                        Quero contratar a Clipfy League
                        <ArrowRight className="ml-2 size-5" />
                      </Button>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-sm text-white/60">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="text-brand-cyan size-4" weight="fill" />
                        <span>Resposta em 1 dia útil</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="text-brand-cyan size-4" weight="fill" />
                        <span>Proposta personalizada</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="text-brand-cyan size-4" weight="fill" />
                        <span>Demo ao vivo disponível</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 bg-[#020910] py-8">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <Logo width={120} height={30} shadow={false} className="h-7 w-auto" />
              <nav className="flex flex-wrap justify-center gap-4 text-xs">
                <a
                  href="/terms-of-use"
                  className="text-white/60 transition-colors hover:text-white"
                >
                  Termos de Uso
                </a>
                <a
                  href="/rules"
                  className="text-white/60 transition-colors hover:text-white"
                >
                  Política de Privacidade
                </a>
                <a
                  href="#faq"
                  className="text-white/60 transition-colors hover:text-white"
                >
                  FAQ
                </a>
              </nav>
            </div>
            <div className="mt-4 text-center text-xs text-white/60">
              © {new Date().getFullYear()} Clipfy League. Todos os direitos
              reservados.
            </div>
          </div>
        </footer>
      </div>
    </DarkScope>
  )
}
