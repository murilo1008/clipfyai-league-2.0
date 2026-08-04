"use client"

import * as React from "react"
import Image from "next/image"
import {
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  Clock,
  DownloadSimple,
  FileText,
  Lightning,
  Lock,
  Rocket,
  ShieldCheck,
  Sparkle,
  Star,
  Target,
  TrendUp,
  Users,
  X,
} from "@phosphor-icons/react"
import { motion } from "framer-motion"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  CLIPPER_MANUAL_PRODUCT,
  getManualCheckoutUrlWithEmail,
} from "@/lib/kiwify"
import { cn } from "@/lib/utils"

interface ClipperManualPricingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userEmail?: string
}

const CHAPTERS = [
  {
    icon: Brain,
    title: "Mentalidade Clipadora",
    description: "Prosperidade e longo prazo para vencer no jogo do clipping",
    bgColor: "bg-violet-500/10",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
  {
    icon: Target,
    title: "Dominando o Algoritmo",
    description: "Como funciona a retenção e o que faz um vídeo viralizar",
    bgColor: "bg-cyan-500/10",
    iconColor: "text-cyan-600 dark:text-cyan-400",
  },
  {
    icon: Lightning,
    title: "Edição de Alta Performance",
    description: "Hooks poderosos, ritmo perfeito e legendas que convertem",
    bgColor: "bg-amber-500/10",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  {
    icon: Rocket,
    title: "Máquina de Conteúdo",
    description: "Batching, organização e como postar todo dia sem burnout",
    bgColor: "bg-emerald-500/10",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
]

const HIGHLIGHTS = [
  "Estratégias validadas por clipadores profissionais",
  "Checklist de 7 dias para começar forte",
  "Templates de hooks que funcionam",
  "Guia de legendas e CTAs eficazes",
  "Como construir portfólio e conseguir clientes",
  "Acesso vitalício ao material",
]

export function ClipperManualPricingDialog({
  open,
  onOpenChange,
  userEmail,
}: ClipperManualPricingDialogProps) {
  const [isLoading, setIsLoading] = React.useState(false)

  const handlePurchase = () => {
    setIsLoading(true)

    const checkoutUrl = userEmail
      ? getManualCheckoutUrlWithEmail(userEmail)
      : CLIPPER_MANUAL_PRODUCT.checkoutUrl

    window.location.href = checkoutUrl
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[95vh] w-[96vw] gap-0 overflow-hidden rounded-3xl border-0 p-0 sm:max-w-5xl"
      >
        <DialogTitle className="sr-only">Manual do Clipador</DialogTitle>
        <DialogDescription className="sr-only">
          Adquira o Manual do Clipador e domine a arte do clipping profissional
        </DialogDescription>

        <div className="relative overflow-hidden">
          {/* Botão de fechar */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
            className="bg-background/80 border-border/50 hover:bg-muted absolute top-4 right-4 z-50 cursor-pointer rounded-full border p-2 backdrop-blur-sm transition-colors"
          >
            <X className="size-4" />
          </button>

          <div className="relative flex max-h-[95vh] flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
            {/* ===== Lado esquerdo — Capa do livro e Preço ===== */}
            <div className="relative shrink-0 overflow-hidden bg-[#050f1c] p-5 text-white sm:p-6 lg:w-[42%] lg:p-8">
              {/* Glows âmbar do eBook */}
              <span
                aria-hidden
                className="pointer-events-none absolute -top-20 -right-12 size-56 rounded-full bg-amber-500/15 blur-3xl"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute -bottom-24 -left-16 size-64 rounded-full bg-orange-500/10 blur-3xl"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-amber-500/60 via-orange-400/40 to-transparent"
              />

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative flex h-full flex-col justify-center gap-4"
              >
                {/* Badge e título */}
                <div className="flex flex-col gap-2">
                  <Badge className="w-fit gap-1 rounded-full border-0 bg-gradient-to-r from-amber-500 to-orange-500 text-xs font-bold text-white shadow-lg shadow-amber-500/30">
                    <FileText className="size-3" weight="fill" />
                    eBOOK EXCLUSIVO
                  </Badge>
                  <h2 className="text-2xl leading-tight font-black tracking-tight sm:text-3xl">
                    Manual do{" "}
                    <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                      Clipador
                    </span>
                  </h2>
                  <p className="text-sm leading-relaxed text-white/60">
                    O guia definitivo para vencer competições e transformar
                    cortes em renda.
                  </p>
                </div>

                {/* Capa do livro com efeito 3D */}
                <div className="relative py-2">
                  <div className="relative mx-auto w-[140px] sm:w-[160px]">
                    {/* Sombra do livro */}
                    <span
                      aria-hidden
                      className="absolute inset-0 translate-y-3 scale-95 rounded-lg bg-gradient-to-br from-amber-500/40 to-orange-600/40 blur-2xl"
                    />

                    {/* Livro */}
                    <motion.div
                      className="relative"
                      initial={{ rotateY: -15 }}
                      animate={{ rotateY: [-15, -10, -15] }}
                      transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      <div className="relative aspect-[3/4] overflow-hidden rounded-lg border-2 border-amber-500/30 shadow-2xl">
                        <Image
                          src="/images/Manual-do-Clipador.jpg"
                          alt="Manual do Clipador"
                          fill
                          sizes="160px"
                          className="object-cover"
                          priority
                        />
                        <span
                          aria-hidden
                          className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent"
                        />
                      </div>
                    </motion.div>

                    {/* Elementos flutuantes */}
                    <motion.span
                      animate={{ y: [-4, 4, -4] }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="absolute -top-3 -right-3 flex items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 p-1.5 shadow-lg"
                    >
                      <Star className="size-4 text-white" weight="fill" />
                    </motion.span>

                    <motion.span
                      animate={{ y: [4, -4, 4] }}
                      transition={{
                        duration: 3.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="absolute -bottom-2 -left-3 flex items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 p-1.5 shadow-lg"
                    >
                      <TrendUp className="size-4 text-white" weight="bold" />
                    </motion.span>
                  </div>
                </div>

                {/* Preço */}
                <div className="relative">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 blur-xl"
                  />
                  <div className="relative rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                    {/* Vitalício + desconto */}
                    <div className="mb-2 flex items-center justify-between">
                      <Badge className="gap-1 rounded-full border-0 bg-gradient-to-r from-emerald-500 to-green-500 px-2 py-0.5 text-xs font-bold text-white">
                        <ShieldCheck className="size-3" weight="fill" />
                        VITALÍCIO
                      </Badge>
                      <span className="flex items-center gap-2">
                        <span className="text-sm text-white/40 line-through">
                          R$ 47
                        </span>
                        <Badge
                          variant="outline"
                          className="rounded-full border-emerald-400/50 bg-emerald-400/10 px-1.5 py-0 text-[10px] text-emerald-400"
                        >
                          -58%
                        </Badge>
                      </span>
                    </div>

                    <span className="mb-3 flex items-baseline gap-1">
                      <span className="text-sm text-white/40">R$</span>
                      <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-4xl font-black text-transparent tabular-nums sm:text-5xl">
                        19,90
                      </span>
                    </span>

                    {/* CTA */}
                    <Button
                      onClick={handlePurchase}
                      disabled={isLoading}
                      size="lg"
                      className="h-12 w-full cursor-pointer rounded-xl border-0 bg-gradient-to-r from-amber-500 to-orange-500 text-base font-bold text-white shadow-lg shadow-amber-500/30 transition-all hover:scale-[1.02] hover:from-amber-600 hover:to-orange-600"
                    >
                      {isLoading ? (
                        <>
                          <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <Sparkle className="size-4" weight="fill" />
                          Comprar Agora
                          <ArrowRight className="size-4" weight="bold" />
                        </>
                      )}
                    </Button>

                    <div className="mt-3 flex items-center justify-center gap-3 text-[10px] text-white/50">
                      <span className="flex items-center gap-1">
                        <Lock className="size-3" weight="fill" />
                        Pagamento seguro
                      </span>
                      <span className="h-2.5 w-px bg-white/20" />
                      <span className="flex items-center gap-1">
                        <DownloadSimple className="size-3" weight="bold" />
                        Download imediato
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* ===== Lado direito — Conteúdo e capítulos ===== */}
            <div className="p-5 sm:p-6 lg:max-h-[95vh] lg:w-[58%] lg:overflow-y-auto lg:p-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex flex-col gap-5"
              >
                {/* O que você vai aprender */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                      <BookOpen
                        className="size-4 text-amber-600 dark:text-amber-400"
                        weight="fill"
                      />
                    </span>
                    <h3 className="text-lg font-bold tracking-tight">
                      O que você vai aprender
                    </h3>
                  </div>

                  {/* Grid de capítulos */}
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {CHAPTERS.map((chapter, index) => {
                      const ChapterIcon = chapter.icon
                      return (
                        <motion.div
                          key={chapter.title}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            duration: 0.3,
                            delay: 0.3 + index * 0.1,
                          }}
                          className="border-border/60 bg-muted/20 flex items-start gap-2.5 rounded-2xl border p-3 transition-colors hover:border-amber-500/30"
                        >
                          <span
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-xl",
                              chapter.bgColor,
                            )}
                          >
                            <ChapterIcon
                              className={cn("size-4", chapter.iconColor)}
                              weight="fill"
                            />
                          </span>
                          <div className="min-w-0 flex-1">
                            <h4 className="mb-0.5 text-xs leading-tight font-bold">
                              {chapter.title}
                            </h4>
                            <p className="text-muted-foreground line-clamp-2 text-[11px] leading-snug">
                              {chapter.description}
                            </p>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>

                {/* Destaques */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                  className="rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-amber-500/5 p-4"
                >
                  <h4 className="mb-3 flex items-center gap-2 text-xs font-bold">
                    <Sparkle
                      className="size-3.5 text-amber-500"
                      weight="fill"
                    />
                    Destaques do conteúdo
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {HIGHLIGHTS.map((highlight, index) => (
                      <motion.div
                        key={highlight}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          duration: 0.2,
                          delay: 0.7 + index * 0.05,
                        }}
                        className="flex items-center gap-1.5"
                      >
                        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                          <Check className="size-2.5" weight="bold" />
                        </span>
                        <span className="text-muted-foreground text-[11px]">
                          {highlight}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                {/* Stats + garantia */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.8 }}
                  className="flex flex-col gap-3 sm:flex-row"
                >
                  <div className="flex flex-1 gap-2">
                    <div className="border-border/60 bg-muted/30 flex-1 rounded-2xl border p-3 text-center">
                      <FileText
                        className="mx-auto mb-1 size-4 text-amber-500"
                        weight="fill"
                      />
                      <p className="text-lg leading-none font-bold">50+</p>
                      <p className="text-muted-foreground text-[10px]">
                        Páginas
                      </p>
                    </div>
                    <div className="border-border/60 bg-muted/30 flex-1 rounded-2xl border p-3 text-center">
                      <Clock
                        className="mx-auto mb-1 size-4 text-cyan-500"
                        weight="fill"
                      />
                      <p className="text-lg leading-none font-bold">7</p>
                      <p className="text-muted-foreground text-[10px]">
                        Capítulos
                      </p>
                    </div>
                    <div className="border-border/60 bg-muted/30 flex-1 rounded-2xl border p-3 text-center">
                      <Users
                        className="mx-auto mb-1 size-4 text-emerald-500"
                        weight="fill"
                      />
                      <p className="text-lg leading-none font-bold">500+</p>
                      <p className="text-muted-foreground text-[10px]">
                        Clipadores
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 sm:w-auto">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                      <ShieldCheck
                        className="size-5 text-emerald-500"
                        weight="fill"
                      />
                    </span>
                    <div>
                      <h5 className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        Garantia 7 dias
                      </h5>
                      <p className="text-muted-foreground text-[10px] leading-snug">
                        100% do dinheiro de volta
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* CTA mobile */}
                <div className="pt-1 lg:hidden">
                  <Button
                    onClick={handlePurchase}
                    disabled={isLoading}
                    size="lg"
                    className="h-12 w-full cursor-pointer rounded-xl border-0 bg-gradient-to-r from-amber-500 to-orange-500 text-base font-bold text-white shadow-lg shadow-amber-500/30 transition-all hover:scale-[1.02] hover:from-amber-600 hover:to-orange-600"
                  >
                    {isLoading ? (
                      <>
                        <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Sparkle className="size-4" weight="fill" />
                        Comprar por R$ 19,90
                        <ArrowRight className="size-4" weight="bold" />
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
