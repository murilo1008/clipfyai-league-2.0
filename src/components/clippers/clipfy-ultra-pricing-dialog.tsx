"use client"

import * as React from "react"
import Image from "next/image"
import {
  ArrowRight,
  ChatCircle,
  Check,
  Crown,
  Lightning,
  Lock,
  ShieldCheck,
  Star,
  Target,
  Trophy,
  Users,
  VideoCamera,
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
import { CLIPFY_ULTRA_PRODUCT, getUltraCheckoutUrlWithEmail } from "@/lib/kiwify"
import { cn } from "@/lib/utils"

interface ClipfyUltraPricingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userEmail?: string
}

const BENEFITS = [
  {
    icon: Users,
    title: "Comunidade VIP com Embaixadores",
    description:
      "Grupo exclusivo com clipadores que já faturam consistentemente nas competições. Networking de alto nível.",
    bgColor: "bg-violet-500/10",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
  {
    icon: VideoCamera,
    title: "Review Semanal de Cortes",
    description:
      "Seus vídeos analisados por quem já domina as competições. Feedback direto para acelerar sua evolução.",
    bgColor: "bg-cyan-500/10",
    iconColor: "text-cyan-600 dark:text-cyan-400",
  },
  {
    icon: Target,
    title: "Estratégias de Competição",
    description:
      "Aprenda exatamente o que funciona para rankear e ganhar premiações nas competições da Clipfy.",
    bgColor: "bg-amber-500/10",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  {
    icon: ChatCircle,
    title: "Acompanhamento Personalizado",
    description:
      "Tire dúvidas em tempo real e receba direcionamento sempre que precisar dos embaixadores.",
    bgColor: "bg-emerald-500/10",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
]

const INCLUDED_FEATURES = [
  "Academia Clipadora completa",
  "Comunidade geral no Discord",
  "Cargo ULTRA exclusivo",
  "Review semanal dos cortes",
  "Estratégias de competição",
  "Garantia de R$3.000",
]

export function ClipfyUltraPricingDialog({
  open,
  onOpenChange,
  userEmail,
}: ClipfyUltraPricingDialogProps) {
  const [isLoading, setIsLoading] = React.useState(false)

  const handleSubscribe = () => {
    setIsLoading(true)

    const checkoutUrl = userEmail
      ? getUltraCheckoutUrlWithEmail(userEmail)
      : CLIPFY_ULTRA_PRODUCT.checkoutUrl

    window.location.href = checkoutUrl
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[95vh] w-[96vw] gap-0 overflow-hidden rounded-3xl border-0 p-0 sm:max-w-4xl"
      >
        <DialogTitle className="sr-only">Clipfy League ULTRA</DialogTitle>
        <DialogDescription className="sr-only">
          Faça upgrade para o Clipfy League ULTRA e acelere seus resultados
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
            {/* ===== Lado esquerdo — Marca e Preço ===== */}
            <div className="relative shrink-0 overflow-hidden bg-[#050f1c] p-6 text-white sm:p-8 lg:w-2/5 lg:p-10">
              {/* Glows violeta do ULTRA + marca */}
              <span
                aria-hidden
                className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-violet-500/15 blur-3xl"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute -bottom-24 -left-16 size-72 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_10%,transparent)] blur-3xl"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-violet-500/60 via-purple-400/40 to-transparent"
              />

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative flex h-full flex-col justify-center gap-6"
              >
                {/* Logo e badge ULTRA */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <Image
                      src="/images/logo-clipfy-white.svg"
                      alt="Clipfy League"
                      width={140}
                      height={35}
                      priority
                    />
                    <Badge className="gap-1 rounded-full border-0 bg-gradient-to-r from-violet-500 to-purple-500 text-xs font-bold text-white">
                      <Trophy className="size-3" weight="fill" />
                      ULTRA
                    </Badge>
                  </div>

                  <h2 className="text-2xl leading-tight font-bold tracking-tight sm:text-3xl">
                    Acelere seus{" "}
                    <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                      resultados
                    </span>{" "}
                    com acompanhamento
                  </h2>

                  <p className="text-sm text-white/60 sm:text-base">
                    Acompanhamento personalizado com embaixadores que já vivem
                    de competições. O caminho mais rápido para premiações.
                  </p>
                </div>

                {/* Preço */}
                <div className="relative">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-2xl bg-violet-500/20 blur-xl"
                  />
                  <div className="relative flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm sm:p-6">
                    {/* Selo de desconto */}
                    <Badge className="w-fit animate-pulse gap-1 rounded-full border-0 bg-gradient-to-r from-violet-500 to-purple-500 text-xs font-bold text-white">
                      <Lightning className="size-3" weight="fill" />
                      40% OFF
                    </Badge>

                    <span className="mt-4 text-xl text-white/40 line-through">
                      R$ {CLIPFY_ULTRA_PRODUCT.oldPrice}
                    </span>

                    <span className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-lg font-bold text-white/80">
                        12x de
                      </span>
                      <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-4xl font-bold text-transparent tabular-nums sm:text-5xl">
                        R$ 30,72
                      </span>
                    </span>

                    <p className="mt-2 text-sm text-white/60">
                      ou{" "}
                      <span className="font-bold text-white">
                        R$ {CLIPFY_ULTRA_PRODUCT.price}
                      </span>{" "}
                      à vista
                    </p>

                    {/* Garantia */}
                    <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                      <ShieldCheck
                        className="size-5 shrink-0 text-emerald-400"
                        weight="fill"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-emerald-400">
                          Garantia de R$3.000
                        </p>
                        <p className="text-xs text-white/50">
                          em premiações ou seu dinheiro de volta
                        </p>
                      </div>
                    </div>

                    {/* CTA */}
                    <Button
                      onClick={handleSubscribe}
                      disabled={isLoading}
                      size="lg"
                      className="group relative mt-5 h-12 w-full cursor-pointer overflow-hidden rounded-xl border-0 bg-gradient-to-r from-violet-500 to-purple-500 text-base font-bold text-white shadow-lg shadow-violet-500/30 transition-all hover:from-violet-600 hover:to-purple-600 hover:shadow-xl hover:shadow-violet-500/40"
                    >
                      <span
                        aria-hidden
                        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-white/0 via-white/20 to-white/0 transition-transform duration-700 group-hover:translate-x-full"
                      />
                      {isLoading ? (
                        <>
                          <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <Trophy className="size-4" weight="fill" />
                          Upgrade para ULTRA
                          <ArrowRight
                            className="size-4 transition-transform group-hover:translate-x-1"
                            weight="bold"
                          />
                        </>
                      )}
                    </Button>

                    <p className="mt-3.5 text-center text-xs text-white/50">
                      Pagamento único anual • Acesso por 12 meses
                    </p>
                  </div>
                </div>

                {/* Selos de confiança */}
                <div className="flex items-center justify-center gap-4">
                  <span className="inline-flex items-center gap-1.5 text-xs text-white/50">
                    <Lock className="size-3.5" weight="fill" />
                    Pagamento seguro
                  </span>
                  <span className="h-4 w-px bg-white/15" />
                  <span className="inline-flex items-center gap-1.5 text-xs text-white/50">
                    <Star className="size-3.5 text-amber-400" weight="fill" />
                    +100 clipadores
                  </span>
                </div>
              </motion.div>
            </div>

            {/* ===== Lado direito — Benefícios ===== */}
            <div className="p-6 sm:p-8 lg:max-h-[95vh] lg:w-3/5 lg:overflow-y-auto lg:p-10">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex flex-col gap-5"
              >
                <div className="flex flex-col gap-1">
                  <h3 className="flex items-center gap-2 text-xl font-bold tracking-tight">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 text-white">
                      <Trophy className="size-4" weight="fill" />
                    </span>
                    Benefícios ULTRA
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Acompanhamento personalizado para acelerar seus resultados
                  </p>
                </div>

                {/* Grid de benefícios */}
                <div className="grid gap-3.5 sm:grid-cols-2">
                  {BENEFITS.map((benefit, index) => {
                    const BenefitIcon = benefit.icon
                    return (
                      <motion.div
                        key={benefit.title}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
                        className="border-border/60 bg-muted/20 relative flex flex-col gap-3 rounded-2xl border p-4 transition-colors hover:border-violet-500/30 sm:p-5"
                      >
                        <span
                          className={cn(
                            "flex size-11 items-center justify-center rounded-xl",
                            benefit.bgColor,
                          )}
                        >
                          <BenefitIcon
                            className={cn("size-5", benefit.iconColor)}
                            weight="fill"
                          />
                        </span>

                        <div className="flex flex-col gap-1">
                          <h4 className="text-sm font-bold sm:text-base">
                            {benefit.title}
                          </h4>
                          <p className="text-muted-foreground text-sm leading-relaxed">
                            {benefit.description}
                          </p>
                        </div>

                        <span className="absolute top-4 right-4 flex size-6 items-center justify-center rounded-full bg-violet-500/10">
                          <Check
                            className="size-3.5 text-violet-500"
                            weight="bold"
                          />
                        </span>
                      </motion.div>
                    )
                  })}
                </div>

                {/* Tudo incluído */}
                <div className="flex flex-col gap-4 rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-500/5 to-purple-500/5 p-4 sm:p-5">
                  <h4 className="flex items-center gap-2 text-sm font-bold">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 text-white">
                      <Crown className="size-4" weight="fill" />
                    </span>
                    Tudo do PRO + Exclusivo ULTRA
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {INCLUDED_FEATURES.map((feature, index) => (
                      <div
                        key={feature}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-purple-500 text-white">
                          <Check className="size-2.5" weight="bold" />
                        </span>
                        <span
                          className={cn(
                            "text-muted-foreground",
                            index >= 2 &&
                              "font-medium text-violet-600 dark:text-violet-400",
                          )}
                        >
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Você já é PRO */}
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20">
                      <Check
                        className="size-5 text-emerald-600 dark:text-emerald-400"
                        weight="bold"
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        Você já é PRO!
                      </p>
                      <p className="text-muted-foreground text-xs">
                        O ULTRA é o próximo passo para acelerar seus resultados
                        com acompanhamento personalizado.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
