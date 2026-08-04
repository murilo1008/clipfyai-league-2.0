"use client"

import * as React from "react"
import Image from "next/image"
import {
  ArrowRight,
  Briefcase,
  Check,
  Crown,
  GraduationCap,
  Lightning,
  Lock,
  Medal,
  Sparkle,
  Star,
  UsersThree,
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
import { CLIPFY_PRO_PRODUCT, getCheckoutUrlWithEmail } from "@/lib/kiwify"
import { cn } from "@/lib/utils"

interface ClipfyProPricingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userEmail?: string // Email do usuário logado para pré-preencher no checkout
}

const BENEFITS = [
  {
    icon: GraduationCap,
    title: "Academia Clipadora",
    description:
      "Acesso completo a todos os módulos e aulas exclusivas para dominar a arte do clipping profissional.",
    bgColor: "bg-cyan-500/10",
    iconColor: "text-cyan-600 dark:text-cyan-400",
  },
  {
    icon: UsersThree,
    title: "Comunidade Exclusiva",
    description:
      "Faça parte de um grupo seleto de clipadores profissionais, troque experiências e cresça junto.",
    bgColor: "bg-violet-500/10",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
  {
    icon: Medal,
    title: "Cargo VIP no Discord",
    description:
      "Receba um cargo exclusivo no servidor da Clipfy e seja reconhecido como membro PRO da comunidade.",
    bgColor: "bg-amber-500/10",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  {
    icon: Briefcase,
    title: "Portfólio Profissional",
    description:
      "Construa seu portfólio e seja visto por empresas e influenciadores que buscam clipadores talentosos.",
    bgColor: "bg-emerald-500/10",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
]

const EXTRA_FEATURES = [
  "Suporte prioritário",
  "Acesso antecipado a novidades",
  "Badge exclusivo no perfil",
  "Desconto em competições",
  "Networking com profissionais",
  "Certificados de conclusão",
]

// Formata preços com vírgula (pt-BR)
const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export function ClipfyProPricingDialog({
  open,
  onOpenChange,
  userEmail,
}: ClipfyProPricingDialogProps) {
  const [isLoading, setIsLoading] = React.useState(false)

  const handleSubscribe = () => {
    setIsLoading(true)

    // Gerar URL do checkout (pagamento único de R$ 197) com email pré-preenchido
    const checkoutUrl = userEmail
      ? getCheckoutUrlWithEmail(userEmail)
      : CLIPFY_PRO_PRODUCT.checkoutUrl

    // Redirecionar para o checkout na mesma página
    window.location.href = checkoutUrl
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[95vh] w-[96vw] gap-0 overflow-hidden rounded-3xl border-0 p-0 sm:max-w-4xl"
      >
        <DialogTitle className="sr-only">Clipfy League PRO</DialogTitle>
        <DialogDescription className="sr-only">
          Garanta seu acesso vitalício ao Clipfy League PRO por R${" "}
          {formatBRL(CLIPFY_PRO_PRODUCT.price)} — pagamento único, podendo
          parcelar em até {CLIPFY_PRO_PRODUCT.maxInstallments}x
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
              {/* Glows da marca */}
              <span
                aria-hidden
                className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_12%,transparent)] blur-3xl"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute -bottom-24 -left-16 size-72 rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_8%,transparent)] blur-3xl"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-cyan)_45%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_30%,transparent)] to-transparent"
              />

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative flex h-full flex-col justify-center gap-6"
              >
                {/* Logo e badge PRO */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <Image
                      src="/images/logo-clipfy-white.svg"
                      alt="Clipfy League"
                      width={140}
                      height={35}
                      priority
                    />
                    <Badge
                      variant="outline"
                      className="gap-1 rounded-full border-amber-500/40 bg-amber-500/15 text-xs font-bold text-amber-400"
                    >
                      <Crown className="size-3" weight="fill" />
                      PRO
                    </Badge>
                  </div>

                  <h2 className="text-2xl leading-tight font-bold tracking-tight sm:text-3xl">
                    Eleve seu jogo de{" "}
                    <span className="text-gradient">clipador</span> ao próximo
                    nível
                  </h2>

                  <p className="text-sm text-white/60 sm:text-base">
                    Desbloqueie todo o potencial da plataforma e torne-se um
                    clipador profissional reconhecido no mercado.
                  </p>
                </div>

                {/* Preço */}
                <div className="relative">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-2xl bg-[color-mix(in_oklab,var(--brand-cyan)_16%,transparent)] blur-xl"
                  />
                  <div className="relative flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm sm:p-6">
                    <Badge
                      variant="outline"
                      className="w-fit animate-pulse gap-1 rounded-full border-emerald-500/40 bg-emerald-500/15 text-xs font-bold text-emerald-400"
                    >
                      <Lightning className="size-3" weight="fill" />
                      ACESSO VITALÍCIO
                    </Badge>

                    <span className="mt-4 text-sm text-white/60">
                      Pagamento único de
                    </span>

                    <span className="text-gradient mt-1 text-5xl font-bold tabular-nums sm:text-6xl">
                      R$ {formatBRL(CLIPFY_PRO_PRODUCT.price)}
                    </span>

                    <p className="mt-3 text-sm text-white/60">
                      ou em até{" "}
                      <span className="font-bold text-white">
                        {CLIPFY_PRO_PRODUCT.maxInstallments}x de R${" "}
                        {formatBRL(CLIPFY_PRO_PRODUCT.installmentPrice)}
                      </span>{" "}
                      no cartão
                    </p>

                    {/* CTA */}
                    <Button
                      onClick={handleSubscribe}
                      disabled={isLoading}
                      size="lg"
                      className="btn-gradient-auth mt-5 h-12 w-full cursor-pointer rounded-xl text-base font-bold"
                    >
                      {isLoading ? (
                        <>
                          <span className="size-4 animate-spin rounded-full border-2 border-[#04222A]/30 border-t-[#04222A]" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <Sparkle className="size-4" weight="fill" />
                          Garantir Acesso Vitalício
                          <ArrowRight className="size-4" weight="bold" />
                        </>
                      )}
                    </Button>

                    <p className="mt-3.5 text-center text-xs text-white/50">
                      Pagamento único • Sem mensalidade • Acesso para sempre
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
                    4.9/5 avaliação
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
                    <span className="bg-gradient-custom flex size-8 items-center justify-center rounded-lg text-[#04222A]">
                      <Crown className="size-4" weight="fill" />
                    </span>
                    Benefícios PRO
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Tudo que você precisa para se tornar um clipador de elite
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
                        className="border-border/60 bg-muted/20 hover:border-brand-cyan/30 relative flex flex-col gap-3 rounded-2xl border p-4 transition-colors sm:p-5"
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

                        <span className="absolute top-4 right-4 flex size-6 items-center justify-center rounded-full bg-emerald-500/10">
                          <Check
                            className="size-3.5 text-emerald-500"
                            weight="bold"
                          />
                        </span>
                      </motion.div>
                    )
                  })}
                </div>

                {/* Recursos adicionais */}
                <div className="border-border/60 bg-muted/20 flex flex-col gap-4 rounded-2xl border p-4 sm:p-5">
                  <h4 className="flex items-center gap-2 text-sm font-bold">
                    <span className="bg-gradient-custom flex size-7 items-center justify-center rounded-lg text-[#04222A]">
                      <Sparkle className="size-4" weight="fill" />
                    </span>
                    E muito mais...
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {EXTRA_FEATURES.map((feature) => (
                      <div
                        key={feature}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span className="bg-gradient-custom flex size-4.5 shrink-0 items-center justify-center rounded-full text-[#04222A]">
                          <Check className="size-2.5" weight="bold" />
                        </span>
                        <span className="text-muted-foreground">{feature}</span>
                      </div>
                    ))}
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
