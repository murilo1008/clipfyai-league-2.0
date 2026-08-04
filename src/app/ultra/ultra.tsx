"use client"

import * as React from "react"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import Script from "next/script"

import {
  ArrowRight,
  CaretDown,
  CheckCircle,
  Clock,
  Crown,
  Flame,
  Gift,
  Lightning,
  Lock,
  Play,
  Shield,
  SpeakerHigh,
  Target,
  Timer,
  Trophy,
  UsersThree,
  VideoCamera,
  Warning,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

// Dados do produto
const CLIPFY_ULTRA = {
  name: "Clipfy League ULTRA",
  originalPrice: 397,
  promoPrice: 197,
  installments: 12,
  installmentValue: 20.37,
}

// FAQ do ULTRA
const FAQ_ITEMS = [
  {
    question: "O que acontece se eu não conseguir postar 5 vídeos por dia?",
    answer:
      "O ULTRA foi feito justamente para te dar estrutura e acompanhamento. Se você tiver dificuldades, nossos embaixadores vão te ajudar a encontrar um ritmo que funcione. Porém, a garantia de R$3.000 só é válida para quem cumprir o mínimo de 5 vídeos por dia durante os 6 meses.",
  },
  {
    question: "Como funciona o acompanhamento dos embaixadores?",
    answer:
      "Você terá acesso a um grupo exclusivo com embaixadores da Clipfy que já vivem de competições. Eles fazem reviews semanais dos seus cortes, dão feedback em tempo real e compartilham estratégias que estão funcionando nas competições atuais.",
  },
  {
    question: "Posso entrar no ULTRA depois?",
    answer:
      "Sim, mas não por esse preço. Essa oferta de R$197 (ao invés de R$397) é exclusiva para quem acabou de entrar no PRO. Depois, o ULTRA estará disponível apenas pelo preço cheio.",
  },
  {
    question: "A garantia de R$3.000 é real?",
    answer:
      "100% real. Se você seguir o método corretamente (5 vídeos/dia, participação nas competições elegíveis, durante 6 meses) e não atingir pelo menos R$3.000 em premiações, devolvemos seu dinheiro. Simples assim.",
  },
  {
    question: "Como comprovar que segui o método?",
    answer:
      "Seus posts são registrados automaticamente na plataforma Clipfy League. Ao final do período, basta solicitar a análise e verificamos seu histórico de postagens e participações. Tudo transparente.",
  },
  {
    question: "Quantas vagas têm disponíveis?",
    answer:
      "Por ser um acompanhamento personalizado, limitamos as vagas para garantir qualidade. O número exato varia conforme a disponibilidade dos embaixadores, mas essa oferta especial tem quantidade ainda mais limitada.",
  },
]

// Diferenciais do ULTRA — tiles alternam âmbar premium e gradiente da marca
const ULTRA_BENEFITS: Array<{
  icon: PhosphorIcon
  title: string
  description: string
  tile: string
}> = [
  {
    icon: UsersThree,
    title: "Comunidade VIP com Embaixadores",
    description:
      "Grupo exclusivo com clipadores que já faturam consistentemente nas competições.",
    tile: "bg-gradient-custom",
  },
  {
    icon: Crown,
    title: "Cargo ULTRA no Discord",
    description:
      "Destaque exclusivo na comunidade com acesso a canais e benefícios especiais.",
    tile: "bg-gradient-to-br from-amber-300 to-yellow-500",
  },
  {
    icon: VideoCamera,
    title: "Review Semanal de Cortes",
    description:
      "Seus vídeos analisados por quem já domina as competições da Clipfy.",
    tile: "bg-gradient-custom",
  },
  {
    icon: Target,
    title: "Estratégias de Competição",
    description:
      "Aprenda exatamente o que funciona para rankear e ganhar premiações.",
    tile: "bg-gradient-to-br from-amber-300 to-yellow-500",
  },
  {
    icon: Lightning,
    title: "Feedback em Tempo Real",
    description: "Tire dúvidas e receba direcionamento sempre que precisar.",
    tile: "bg-gradient-custom",
  },
  {
    icon: Trophy,
    title: "Garantia de R$3.000",
    description:
      "Se seguir o método por 6 meses e não atingir, devolvemos seu dinheiro.",
    tile: "bg-gradient-to-br from-emerald-300 to-emerald-500",
  },
]

// Regras da garantia
const GUARANTEE_RULES: Array<{
  icon: PhosphorIcon
  title: string
  description: string
}> = [
  {
    icon: VideoCamera,
    title: "5 vídeos por dia",
    description: "Postar no mínimo 5 vídeos diariamente nas plataformas elegíveis",
  },
  {
    icon: Clock,
    title: "6 meses de consistência",
    description: "Manter o ritmo durante todo o período de garantia",
  },
  {
    icon: Trophy,
    title: "Participar das competições",
    description: "Estar inscrito e ativo nas competições mensais da Clipfy",
  },
  {
    icon: CheckCircle,
    title: "Seguir as orientações",
    description: "Aplicar os feedbacks e estratégias passadas pelos embaixadores",
  },
]

// Objeções
const OBJECTIONS = [
  {
    objection: '"Não tenho muito tempo"',
    response:
      "O ULTRA te dá estrutura e prioridade. Você vai saber exatamente o que fazer, sem perder tempo com tentativa e erro.",
  },
  {
    objection: '"Não sei editar tão bem"',
    response:
      "Os embaixadores fazem review dos seus cortes e te mostram onde melhorar. Você evolui rápido com feedback direto.",
  },
  {
    objection: '"E se eu não conseguir 5/dia?"',
    response:
      "O ambiente te ajuda a manter consistência. Mas a garantia é clara: vale pra quem realmente executa. Sem atalhos.",
  },
]

// Partículas premium do fundo (âmbar + ciano, vocabulário arena-*)
const TWINKLES: Array<{
  top: string
  left: string
  size: string
  color: string
  dur: string
  delay: string
}> = [
  { top: "12%", left: "8%", size: "size-1", color: "bg-amber-300/70", dur: "3.4s", delay: "0s" },
  { top: "22%", left: "88%", size: "size-1.5", color: "bg-brand-cyan/60", dur: "4.2s", delay: "0.8s" },
  { top: "38%", left: "16%", size: "size-1", color: "bg-brand-mint/50", dur: "3.8s", delay: "1.6s" },
  { top: "52%", left: "92%", size: "size-1", color: "bg-amber-200/60", dur: "4.6s", delay: "0.4s" },
  { top: "68%", left: "6%", size: "size-1.5", color: "bg-amber-300/50", dur: "3.6s", delay: "2.2s" },
  { top: "82%", left: "84%", size: "size-1", color: "bg-brand-cyan/50", dur: "4s", delay: "1.2s" },
  { top: "90%", left: "34%", size: "size-1", color: "bg-brand-green/50", dur: "4.4s", delay: "2.8s" },
  { top: "30%", left: "58%", size: "size-1", color: "bg-amber-200/50", dur: "3.9s", delay: "3.2s" },
]

// Botão de upsell (Kiwify) — CTA com gradiente oficial da marca
function UpsellButton({
  variant = "primary",
}: {
  variant?: "primary" | "hero" | "final" | "mobile"
}) {
  const base =
    "group relative flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl border-none font-bold transition-all disabled:opacity-70"

  const variants = {
    hero: "btn-gradient-auth px-8 py-5 text-lg hover:scale-[1.02] hover:shadow-xl hover:shadow-brand-cyan/40",
    primary:
      "btn-gradient-auth px-8 py-5 text-lg hover:scale-[1.02] hover:shadow-xl hover:shadow-brand-cyan/40",
    final:
      "btn-gradient-auth px-8 py-5 text-lg hover:scale-[1.02] hover:shadow-xl hover:shadow-brand-cyan/40",
    mobile: "btn-gradient-auth py-5 text-lg shadow-lg shadow-brand-cyan/40",
  }

  return (
    <button
      id="kiwify-upsell-trigger-9tuYtzX"
      className={`${base} ${variants[variant]}`}
    >
      <Trophy className="size-5" weight="fill" />
      <span>SIM! QUERO O ULTRA AGORA</span>
      <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
    </button>
  )
}

// Botão de recusa (Kiwify) — visível, contorno branco
function DeclineButton({
  variant = "text",
}: {
  variant?: "text" | "bordered" | "prominent"
}) {
  if (variant === "bordered") {
    return (
      <button
        id="kiwify-upsell-cancel-trigger-9tuYtzX"
        className="w-full cursor-pointer rounded-xl border-2 border-white/80 px-8 py-4 text-center text-base font-semibold text-white transition-all hover:bg-white/10 sm:w-auto"
      >
        Não, vou ficar só com o PRO
      </button>
    )
  }

  if (variant === "prominent") {
    return (
      <button
        id="kiwify-upsell-cancel-trigger-9tuYtzX"
        className="w-full cursor-pointer rounded-xl border-2 border-white/80 py-5 text-center text-base font-semibold text-white transition-all hover:bg-white/10"
      >
        NÃO, PREFIRO CONTINUAR APENAS COM O PRO
      </button>
    )
  }

  return (
    <button
      id="kiwify-upsell-cancel-trigger-9tuYtzX"
      className="w-full cursor-pointer rounded-xl border-2 border-white/80 py-4 text-center text-base font-semibold text-white transition-all hover:bg-white/10"
    >
      Não, obrigado. Prefiro continuar apenas com o PRO.
    </button>
  )
}

// CSS dark mode do modal Kiwify — petróleo da marca
const kiwifyDarkModeCSS = `
  /* Container principal do modal */
  #kiwify-upsell-modal-content {
    background: #0a1c2b !important;
    border: 1px solid rgba(148,224,232,0.18) !important;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7) !important;
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
    color: #e2e8f0 !important;
  }

  #kiwify-upsell-modal-content h1,
  #kiwify-upsell-modal-content h2,
  #kiwify-upsell-modal-content h3,
  #kiwify-upsell-modal-content strong {
    color: #f8fafc !important;
  }

  /* Select/dropdown */
  #kiwify-upsell-modal-content select,
  #kiwify-upsell-modal-content input {
    background: #0f2438 !important;
    color: #e2e8f0 !important;
    border: 1px solid rgba(148,224,232,0.22) !important;
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
    background: #0f2438 !important;
    color: #e2e8f0 !important;
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
    background: linear-gradient(135deg, #14f7fe 0%, #1ffec8 50%, #37fa9c 100%) !important;
    background-image: linear-gradient(135deg, #14f7fe 0%, #1ffec8 50%, #37fa9c 100%) !important;
    color: #04222a !important;
    border: none !important;
  }

  #kiwify-upsell-modal-content button:first-of-type:hover {
    transform: scale(1.02) !important;
    box-shadow: 0 10px 30px -5px rgba(20,247,254,0.4) !important;
  }

  /* Botão Cancelar (último no DOM, aparece à esquerda) - transparente */
  #kiwify-upsell-modal-content button:last-of-type {
    background: transparent !important;
    background-image: none !important;
    color: #e2e8f0 !important;
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
    border-color: rgba(148,224,232,0.12) !important;
  }
`

// Gradiente premium dourado para destaques do ULTRA
const goldText =
  "bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent"

export default function Ultra() {
  const searchParams = useSearchParams()
  const [isVideoPlaying, setIsVideoPlaying] = React.useState(true)
  const [isVideoMuted, setIsVideoMuted] = React.useState(true)
  const videoRef = React.useRef<HTMLVideoElement>(null)

  // Capturar código de afiliado da URL e persistir para o funil
  React.useEffect(() => {
    const afid =
      searchParams.get("afid") ??
      searchParams.get("ref") ??
      searchParams.get("afiliado")
    if (afid) {
      localStorage.setItem("clipfy_affiliate", afid)
    }
  }, [searchParams])

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050f1c] text-white">
      {/* CSS Dark Mode para o modal do Kiwify */}
      <style dangerouslySetInnerHTML={{ __html: kiwifyDarkModeCSS }} />

      {/* Kiwify Upsell Script */}
      <Script
        src="https://snippets.kiwify.com/upsell/upsell.min.js"
        strategy="afterInteractive"
      />

      {/* Kiwify Upsell Container - Hidden, controls the upsell logic */}
      <div
        id="kiwify-upsell-9tuYtzX"
        data-upsell-url="https://league.clipfyai.com/thank-you"
        data-downsell-url="https://league.clipfyai.com/manual-do-clipador"
        style={{ display: "none" }}
      />

      {/* Ambiente premium: petróleo + auroras âmbar/ciano + grid + partículas */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(1100px_620px_at_50%_-10%,#0a1c2b_0%,#050f1c_58%,#020910_100%)]" />
        <div className="hero-grid absolute inset-0 opacity-30" />
        <div className="arena-aurora absolute -top-40 left-1/2 h-[440px] w-[720px] max-w-[120vw] -translate-x-1/2 rounded-full bg-amber-400/[0.08] blur-[120px]" />
        <div
          className="arena-aurora absolute top-1/3 -left-40 h-[380px] w-[380px] rounded-full bg-[#14f7fe]/[0.06] blur-[110px]"
          style={{ animationDelay: "-7s" }}
        />
        <div
          className="arena-aurora absolute -right-32 bottom-0 h-[360px] w-[420px] rounded-full bg-[#37fa9c]/[0.05] blur-[110px]"
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

      {/* Warning Banner - Alta Demanda */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 px-4 py-3">
        <div className="container mx-auto flex items-center justify-center gap-3 text-center">
          <Warning
            className="hidden size-5 animate-pulse text-black sm:block"
            weight="fill"
          />
          <p className="text-sm font-semibold text-black sm:text-base">
            Devido à alta procura pelo acompanhamento do ULTRA, as vagas vão
            fechar em breve
          </p>
          <Warning
            className="hidden size-5 animate-pulse text-black sm:block"
            weight="fill"
          />
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="relative z-10">
        {/* Hero Section with VSL */}
        <section className="relative overflow-hidden pt-8 pb-12 sm:pt-12 sm:pb-16">
          <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl text-center">
              {/* Congratulations Badge */}
              <div className="animate-fade-in-down mb-4 inline-flex flex-col items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-6 py-3 sm:flex-row">
                <div className="flex items-center gap-2">
                  <CheckCircle
                    className="size-5 text-emerald-400"
                    weight="fill"
                  />
                  <span className="text-base font-bold text-emerald-300">
                    Parabéns! Você acabou de entrar no PRO
                  </span>
                </div>
              </div>

              <h1
                className="animate-fade-in-up mb-4 text-2xl leading-tight font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl"
                style={{ animationDelay: "0.2s" }}
              >
                Aviso importante:
                <span className={`block ${goldText}`}>
                  Não feche essa página.
                </span>
              </h1>

              <p
                className="animate-fade-in-up mx-auto mb-8 max-w-2xl text-lg text-white/70 sm:text-xl"
                style={{ animationDelay: "0.4s" }}
              >
                Você <strong className="text-amber-300">NÃO</strong> terá mais
                essa <strong className="text-white">oportunidade.</strong>{" "}
                Assista!
              </p>

              {/* VSL Video Container */}
              <div
                className="animate-scale-in mx-auto mb-8 max-w-4xl"
                style={{ animationDelay: "0.5s" }}
              >
                <div className="relative overflow-hidden rounded-2xl border-2 border-amber-300/30 bg-black/50 shadow-2xl shadow-amber-400/15">
                  {/* Video Aspect Ratio Container (16:9) */}
                  <div className="relative aspect-video w-full">
                    {!isVideoPlaying ? (
                      // Thumbnail with Play Button
                      <div
                        className="absolute inset-0 flex cursor-pointer items-center justify-center bg-gradient-to-br from-[#0a1c2b] to-[#050f1c]"
                        onClick={() => setIsVideoPlaying(true)}
                      >
                        <div className="absolute inset-0 bg-[url('/images/platform/clipfy-ultra-cover.png')] bg-cover bg-center opacity-60" />

                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />

                        {/* Play Button */}
                        <div className="relative z-10 flex flex-col items-center gap-4">
                          <div className="group bg-gradient-custom flex h-20 w-20 items-center justify-center rounded-full shadow-lg shadow-brand-cyan/50 transition-all hover:scale-110 sm:h-24 sm:w-24">
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
                          1:30
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Actual Video Player - Local VSL video */}
                        <video
                          ref={videoRef}
                          className="absolute inset-0 h-full w-full object-cover"
                          src="/videos/vsl-02.mp4"
                          autoPlay
                          muted
                          playsInline
                          onEnded={(e) => {
                            // When video ends, reset to beginning without looping
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
                              className="btn-gradient-auth group flex cursor-pointer items-center gap-3 rounded-full px-6 py-4 shadow-2xl shadow-brand-cyan/50 transition-all duration-300 hover:scale-110 hover:shadow-brand-cyan/70 active:scale-95 sm:px-8 sm:py-5"
                            >
                              <SpeakerHigh
                                className="size-6 sm:size-7"
                                weight="fill"
                              />
                              <span className="text-base font-bold whitespace-nowrap sm:text-lg">
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

              {/* Value Proposition */}
              <div
                className="animate-fade-in-up mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3"
                style={{ animationDelay: "0.6s" }}
              >
                {(
                  [
                    { icon: UsersThree, text: "Acompanhamento com Embaixadores" },
                    { icon: Target, text: "Menos dúvida, mais execução" },
                    { icon: Trophy, text: "Garantia de R$3.000" },
                  ] as Array<{ icon: PhosphorIcon; text: string }>
                ).map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-sm"
                  >
                    <item.icon className="size-5 shrink-0 text-amber-300" />
                    <span className="text-sm font-medium text-white/85">
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA Buttons - Kiwify Upsell */}
              <div
                className="animate-fade-in mx-auto flex w-full max-w-md flex-col items-center gap-3"
                style={{ animationDelay: "0.7s" }}
              >
                <UpsellButton variant="hero" />
                <DeclineButton variant="prominent" />
              </div>

              {/* Trust Badges */}
              <div
                className="animate-fade-in mt-8 flex flex-wrap items-center justify-center gap-6"
                style={{ animationDelay: "0.8s" }}
              >
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Shield className="size-5 text-emerald-400" weight="fill" />
                  Pagamento seguro
                </div>
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Lock className="size-5 text-emerald-400" weight="fill" />
                  Dados protegidos
                </div>
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Gift className="size-5 text-amber-300" weight="fill" />
                  Garantia de R$3.000
                </div>
              </div>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 animate-bounce">
            <CaretDown className="size-6 text-white/50" />
          </div>
        </section>

        {/* O que é o ULTRA Section */}
        <section className="py-16 sm:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
              {/* Header */}
              <div className="mb-12 text-center sm:mb-16">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm font-medium text-amber-300">
                  <Crown className="size-4" weight="fill" />
                  O próximo nível
                </div>
                <h2 className="mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
                  O que o <span className={goldText}>ULTRA</span> te entrega
                </h2>
                <p className="mx-auto max-w-2xl text-lg text-white/60">
                  Não é &quot;mais do mesmo&quot;. É um ambiente onde o padrão é
                  mais alto e o feedback é mais rápido.
                </p>
              </div>

              {/* Benefits Grid */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
                {ULTRA_BENEFITS.map((benefit, index) => (
                  <div
                    key={index}
                    className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-2 hover:border-amber-300/40 hover:shadow-xl hover:shadow-amber-400/10 sm:p-8"
                  >
                    {/* Número grande no fundo */}
                    <div className="absolute -top-4 -right-4 text-[100px] leading-none font-black text-white/[0.03] select-none">
                      {index + 1}
                    </div>

                    {/* Icon Container */}
                    <div className="relative mb-6">
                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-xl ${benefit.tile} shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl`}
                      >
                        <benefit.icon
                          className="size-7 text-[#04222A]"
                          weight="fill"
                        />
                      </div>
                    </div>

                    <h3 className="mb-3 text-lg font-bold text-white transition-colors duration-300 group-hover:text-amber-200 sm:text-xl">
                      {benefit.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-white/60">
                      {benefit.description}
                    </p>

                    {/* Decorative corner glow */}
                    <div className="absolute -right-12 -bottom-12 h-40 w-40 rounded-full bg-gradient-to-br from-amber-300/10 to-brand-green/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
                  </div>
                ))}
              </div>

              {/* Comparison with PRO */}
              <div className="mt-16 overflow-hidden rounded-2xl border border-amber-300/25 bg-gradient-to-br from-amber-300/[0.06] to-brand-cyan/[0.05] p-8 backdrop-blur-sm sm:p-12">
                <div className="mb-8 text-center">
                  <h3 className="mb-2 text-2xl font-bold sm:text-3xl">
                    PRO vs ULTRA
                  </h3>
                  <p className="text-white/60">
                    Veja o que você desbloqueia com o upgrade
                  </p>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  {/* PRO Column */}
                  <div className="rounded-xl border border-white/10 bg-[#050f1c]/70 p-6">
                    <div className="mb-4 flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-cyan/15">
                        <Crown className="size-5 text-brand-cyan" />
                      </div>
                      <span className="text-lg font-bold text-brand-cyan">
                        Clipfy PRO
                      </span>
                      <span className="ml-auto rounded-full bg-emerald-400/15 px-2 py-1 text-xs text-emerald-300">
                        Você já tem
                      </span>
                    </div>
                    <ul className="space-y-3">
                      {[
                        "Academia Clipadora completa",
                        "Comunidade geral no Discord",
                        "Acesso às competições",
                        "Portfólio para contratação",
                        "Novos conteúdos toda semana",
                      ].map((item, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-2 text-sm text-white/75"
                        >
                          <CheckCircle
                            className="size-4 shrink-0 text-brand-cyan"
                            weight="fill"
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* ULTRA Column */}
                  <div className="relative overflow-hidden rounded-xl border border-amber-300/50 bg-gradient-to-br from-amber-300/[0.08] to-yellow-500/[0.05] p-6">
                    <div className="absolute top-2 right-2">
                      <span className="rounded-full bg-gradient-to-r from-amber-300 to-yellow-400 px-2 py-1 text-xs font-bold text-black">
                        UPGRADE
                      </span>
                    </div>
                    <div className="mb-4 flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-300 to-yellow-500">
                        <Trophy className="size-5 text-black" weight="fill" />
                      </div>
                      <span className={`text-lg font-bold ${goldText}`}>
                        Clipfy ULTRA
                      </span>
                    </div>
                    <ul className="space-y-3">
                      {[
                        "Tudo do PRO incluído",
                        "Comunidade VIP com Embaixadores",
                        "Cargo ULTRA exclusivo no Discord",
                        "Review semanal dos seus cortes",
                        "Estratégias exclusivas de competição",
                        "Garantia de R$3.000 em premiações",
                      ].map((item, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-2 text-sm text-white/85"
                        >
                          <CheckCircle
                            className="size-4 shrink-0 text-amber-300"
                            weight="fill"
                          />
                          <span
                            className={
                              i === 5 ? "font-semibold text-amber-300" : ""
                            }
                          >
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Guarantee Section */}
        <section className="py-16 sm:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">
              {/* Header */}
              <div className="mb-12 text-center sm:mb-16">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-300">
                  <Shield className="size-4" weight="fill" />
                  Compromisso real
                </div>
                <h2 className="mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
                  Garantia de{" "}
                  <span className="bg-gradient-to-r from-emerald-300 to-brand-green bg-clip-text text-transparent">
                    R$3.000 em premiações
                  </span>
                </h2>
                <p className="mx-auto max-w-2xl text-lg text-white/60">
                  Se você seguir o método com consistência e não atingir pelo
                  menos R$3.000 em 6 meses,
                  <strong className="text-white"> devolvemos seu dinheiro.</strong>
                </p>
              </div>

              {/* Guarantee Card */}
              <div className="relative mb-12 overflow-hidden rounded-3xl border-2 border-emerald-400/40 bg-[#050f1c]/80 p-8 backdrop-blur-sm sm:p-12">
                {/* Background decoration */}
                <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-emerald-400/10 blur-[100px]" />

                <div className="relative z-10">
                  <div className="mb-8 flex flex-col items-center justify-between gap-6 sm:flex-row">
                    <div className="flex items-center gap-4">
                      <div className="shrink-0">
                        <div className="relative">
                          <div className="absolute inset-0 rounded-full bg-emerald-400/20 blur-xl" />
                          <Image
                            src="/images/clipfy-ultra/garantia-ultra.png"
                            alt="Garantia de R$3.000 em 6 meses"
                            width={96}
                            height={96}
                            className="relative h-20 w-20 object-contain sm:h-24 sm:w-24"
                          />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white sm:text-3xl">
                          Garantia Total
                        </h3>
                        <p className="text-emerald-300">6 meses de proteção</p>
                      </div>
                    </div>
                    <div className="text-center sm:text-right">
                      <div className="text-4xl font-black text-emerald-300 sm:text-5xl">
                        R$3.000
                      </div>
                      <p className="text-sm text-white/60">
                        ou seu dinheiro de volta
                      </p>
                    </div>
                  </div>

                  <div className="my-8 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />

                  <h4 className="mb-6 text-center text-lg font-semibold text-white sm:text-left">
                    Para a garantia ser válida, você precisa:
                  </h4>

                  {/* Guarantee Rules Grid */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {GUARANTEE_RULES.map((rule, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-4 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-400/15">
                          <rule.icon className="size-5 text-emerald-300" />
                        </div>
                        <div>
                          <h5 className="font-semibold text-white">
                            {rule.title}
                          </h5>
                          <p className="text-sm text-white/60">
                            {rule.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="mt-8 text-center text-sm text-white/60">
                    Seus posts são registrados automaticamente na plataforma.
                    Tudo é transparente e verificável.
                  </p>
                </div>
              </div>

              {/* Objections */}
              <div className="grid gap-4 sm:grid-cols-3">
                {OBJECTIONS.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm"
                  >
                    <p className="mb-2 text-sm font-medium text-amber-300">
                      {item.objection}
                    </p>
                    <p className="text-sm text-white/75">{item.response}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="py-16 sm:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
              <div className="relative overflow-hidden rounded-3xl border-2 border-amber-300/40 bg-[#050f1c]/80 p-8 backdrop-blur-xl sm:p-12">
                {/* Exclusive Badge */}
                <div className="absolute -right-1 top-6 rotate-12">
                  <div className="rounded-l-lg bg-gradient-to-r from-amber-300 to-yellow-400 px-4 py-1 text-sm font-bold text-black shadow-lg">
                    OFERTA ÚNICA
                  </div>
                </div>

                {/* Limited Spots Warning */}
                <div className="absolute top-4 left-4">
                  <div className="flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/15 px-3 py-1.5">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-amber-300" />
                    <span className="text-xs font-medium text-amber-300">
                      Vagas Limitadas
                    </span>
                  </div>
                </div>

                <div className="relative z-10 pt-8 text-center">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-300/15 px-4 py-2">
                    <Trophy className="size-5 text-amber-300" weight="fill" />
                    <span className="font-semibold text-amber-300">
                      Clipfy League ULTRA
                    </span>
                  </div>

                  <h3 className="mt-4 text-2xl font-bold sm:text-3xl">
                    Acelere seus resultados agora
                  </h3>

                  <p className="mt-2 text-white/60">
                    Acompanhamento personalizado + Garantia de R$3.000
                  </p>

                  {/* Pricing */}
                  <div className="mt-8 border-b border-white/10 pb-6">
                    <div className="mb-3 flex items-center justify-center gap-3">
                      <span className="text-xl text-white/40 line-through">
                        R${CLIPFY_ULTRA.originalPrice}
                      </span>
                      <span className="rounded-full bg-gradient-to-r from-amber-300 to-yellow-400 px-3 py-1 text-sm font-bold text-black">
                        -50%
                      </span>
                    </div>
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-xl text-white/60">12x de</span>
                      <span className="text-base text-white/60">R$</span>
                      <span
                        className={`text-5xl leading-none font-black ${goldText}`}
                      >
                        {CLIPFY_ULTRA.installmentValue}
                      </span>
                    </div>
                    <p className="mt-3 text-white/60">
                      ou{" "}
                      <strong className="text-white">
                        R${CLIPFY_ULTRA.promoPrice}
                      </strong>{" "}
                      à vista
                    </p>
                    <p className="mt-2 text-sm text-amber-300">
                      Pagamento único • Acesso anual
                    </p>
                  </div>

                  {/* What's Included */}
                  <div className="mx-auto mt-8 max-w-md space-y-3 text-left">
                    {[
                      "Tudo do Clipfy PRO incluído",
                      "Comunidade VIP com Embaixadores",
                      "Cargo ULTRA exclusivo no Discord",
                      "Review semanal dos seus cortes",
                      "Estratégias exclusivas de competição",
                      "Garantia de R$3.000 em 6 meses",
                    ].map((feature, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <CheckCircle
                          className="size-5 shrink-0 text-amber-300"
                          weight="fill"
                        />
                        <span className="text-white/80">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA Buttons - Kiwify Upsell */}
                  <div className="mt-8 space-y-3">
                    <UpsellButton variant="primary" />
                    <DeclineButton variant="prominent" />
                  </div>

                  {/* Trust Badges */}
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <Shield
                        className="size-4 text-emerald-400"
                        weight="fill"
                      />
                      Pagamento seguro
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <Lock className="size-4 text-emerald-400" weight="fill" />
                      Dados protegidos
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <Gift className="size-4 text-amber-300" weight="fill" />
                      Garantia de R$3.000
                    </div>
                  </div>
                </div>
              </div>

              {/* Urgency Message */}
              <div className="mt-6 text-center">
                <p className="text-sm text-white/60">
                  <Flame
                    className="mr-1 inline size-4 text-amber-400"
                    weight="fill"
                  />
                  Essa oferta é{" "}
                  <strong className="text-amber-300">exclusiva</strong> para quem
                  acabou de entrar no PRO.
                  <br />
                  Depois, o ULTRA estará disponível apenas por{" "}
                  <strong className="text-white">
                    R${CLIPFY_ULTRA.originalPrice}
                  </strong>
                  .
                </p>
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
                  Dúvidas sobre o <span className={goldText}>ULTRA</span>
                </h2>
              </div>

              <Accordion type="single" collapsible className="space-y-3">
                {FAQ_ITEMS.map((item, index) => (
                  <AccordionItem
                    key={index}
                    value={`item-${index}`}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-6 backdrop-blur-sm last:border-b"
                  >
                    <AccordionTrigger className="text-left text-base text-white hover:text-amber-200 hover:no-underline [&>svg]:text-white/60">
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
              <div className="relative overflow-hidden rounded-3xl border border-amber-300/30 bg-[#050f1c]/70 p-12 text-center backdrop-blur-sm sm:p-16">
                <div
                  aria-hidden
                  className="arena-aurora absolute -top-24 left-1/2 h-56 w-[420px] max-w-full -translate-x-1/2 rounded-full bg-amber-300/[0.07] blur-[90px]"
                />
                <div className="relative z-10">
                  <h2 className="mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
                    A decisão é <span className={goldText}>sua</span>
                  </h2>

                  <p className="mx-auto mb-8 max-w-2xl text-base text-white/75 sm:text-lg">
                    Você já tomou a decisão certa entrando no PRO. Agora existe
                    um atalho legítimo para reduzir tentativa e erro e acelerar
                    seus resultados.
                  </p>

                  {/* CTA Buttons - Kiwify Upsell */}
                  <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center gap-3">
                    <UpsellButton variant="final" />
                    <DeclineButton variant="prominent" />
                  </div>

                  <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-white/60">
                    <div className="flex items-center gap-2">
                      <CheckCircle
                        className="size-4 text-amber-300"
                        weight="fill"
                      />
                      <span>Pagamento único anual</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle
                        className="size-4 text-amber-300"
                        weight="fill"
                      />
                      <span>Garantia de R$3.000</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle
                        className="size-4 text-amber-300"
                        weight="fill"
                      />
                      <span>Vagas limitadas</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 py-8">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <Image
                src="/images/logo-clipfy-white.svg"
                alt="Clipfy League"
                width={120}
                height={30}
              />
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
              </nav>
            </div>
            <div className="mt-4 text-center text-xs text-white/60">
              © {new Date().getFullYear()} Clipfy League. Todos os direitos
              reservados.
            </div>
          </div>
        </footer>

        {/* Floating CTA Button (Mobile) - Kiwify Upsell */}
        <div className="fixed right-4 bottom-4 left-4 z-40 sm:hidden">
          <UpsellButton variant="mobile" />
        </div>
      </div>
    </div>
  )
}
