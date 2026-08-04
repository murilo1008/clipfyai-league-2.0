"use client"

import Image from "next/image"
import {
  ArrowRight,
  ArrowSquareOut,
  ChatCircle,
  Sparkle,
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

interface UltraDiscordInviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DISCORD_INVITE_URL = "https://discord.gg/f2eNVbYnzn"

const ULTRA_PERKS = [
  {
    icon: Users,
    title: "Comunidade VIP",
    description: "Acesso aos canais exclusivos ULTRA",
  },
  {
    icon: VideoCamera,
    title: "Review Semanal",
    description: "Seus cortes analisados por embaixadores",
  },
  {
    icon: Target,
    title: "Estratégias",
    description: "Dicas exclusivas para competições",
  },
  {
    icon: ChatCircle,
    title: "Suporte Direto",
    description: "Tire dúvidas em tempo real",
  },
]

export function UltraDiscordInviteDialog({
  open,
  onOpenChange,
}: UltraDiscordInviteDialogProps) {
  const handleJoinDiscord = () => {
    window.open(DISCORD_INVITE_URL, "_blank")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[95vh] w-[96vw] gap-0 overflow-y-auto rounded-3xl border-0 p-0 sm:max-w-2xl"
      >
        <DialogTitle className="sr-only">Bem-vindo ao ULTRA</DialogTitle>
        <DialogDescription className="sr-only">
          Entre no Discord para acessar o acompanhamento exclusivo
        </DialogDescription>

        <div className="relative overflow-hidden">
          {/* Efeitos de fundo */}
          <span
            aria-hidden
            className="pointer-events-none absolute -top-24 -left-16 size-72 rounded-full bg-violet-500/10 blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -right-16 -bottom-24 size-72 rounded-full bg-emerald-500/10 blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-violet-500/60 via-purple-400/40 to-transparent"
          />

          {/* Botão de fechar */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
            className="bg-background/80 border-border/50 hover:bg-muted absolute top-4 right-4 z-50 cursor-pointer rounded-full border p-2 backdrop-blur-sm transition-colors"
          >
            <X className="size-4" />
          </button>

          <div className="relative p-6 sm:p-8">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-8 text-center"
            >
              {/* Selo de sucesso */}
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2">
                <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  Você é membro ULTRA!
                </span>
                <Trophy
                  className="size-4 text-emerald-600 dark:text-emerald-400"
                  weight="fill"
                />
              </div>

              {/* Logo */}
              <div className="mb-4 flex items-center justify-center gap-3">
                <Image
                  src="/images/logo-clipfy-white.svg"
                  alt="Clipfy League"
                  width={120}
                  height={30}
                  className="hidden dark:block"
                />
                <Image
                  src="/images/logo-clipfy-black.svg"
                  alt="Clipfy League"
                  width={120}
                  height={30}
                  className="block dark:hidden"
                />
                <Badge className="gap-1 rounded-full border-0 bg-gradient-to-r from-violet-500 to-purple-500 text-xs font-bold text-white">
                  <Trophy className="size-3" weight="fill" />
                  ULTRA
                </Badge>
              </div>

              <h2 className="mb-3 text-2xl font-bold tracking-tight sm:text-3xl">
                Seu acompanhamento está{" "}
                <span className="bg-gradient-to-r from-violet-500 to-purple-500 bg-clip-text text-transparent dark:from-violet-400 dark:to-purple-400">
                  pronto!
                </span>
              </h2>

              <p className="text-muted-foreground mx-auto max-w-sm">
                Entre no Discord para acessar a comunidade VIP e começar seu
                acompanhamento com os embaixadores.
              </p>
            </motion.div>

            {/* Card do Discord */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative mb-6 overflow-hidden rounded-2xl border border-[#5865F2]/30 bg-[#5865F2]/10 p-6"
            >
              {/* Glow do Discord */}
              <span
                aria-hidden
                className="pointer-events-none absolute -top-20 -right-20 size-40 rounded-full bg-[#5865F2]/20 blur-3xl"
              />

              <div className="relative flex flex-col items-center gap-4 sm:flex-row">
                {/* Logo do Discord */}
                <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-[#5865F2] shadow-lg shadow-[#5865F2]/30">
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="size-9 text-white"
                    aria-hidden
                  >
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                </span>

                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-foreground mb-1 text-lg font-bold">
                    Clipfy League ULTRA
                  </h3>
                  <div className="text-muted-foreground flex items-center justify-center gap-2 text-sm sm:justify-start">
                    <span className="flex items-center gap-1">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      Online agora
                    </span>
                    <span>•</span>
                    <span>Comunidade exclusiva</span>
                  </div>
                </div>

                <Button
                  onClick={handleJoinDiscord}
                  className="w-full cursor-pointer rounded-xl bg-[#5865F2] px-6 font-bold text-white shadow-lg shadow-[#5865F2]/30 transition-all hover:scale-105 hover:bg-[#4752C4] sm:w-auto"
                >
                  Entrar
                  <ArrowSquareOut className="size-4" weight="bold" />
                </Button>
              </div>
            </motion.div>

            {/* Grid de vantagens */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mb-6 grid grid-cols-2 gap-3"
            >
              {ULTRA_PERKS.map((perk, index) => {
                const PerkIcon = perk.icon
                return (
                  <motion.div
                    key={perk.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.4 + index * 0.1 }}
                    className="border-border/60 bg-muted/30 flex items-start gap-3 rounded-2xl border p-3"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                      <PerkIcon
                        className="size-4 text-violet-600 dark:text-violet-400"
                        weight="fill"
                      />
                    </span>
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-semibold">
                        {perk.title}
                      </h4>
                      <p className="text-muted-foreground line-clamp-2 text-xs">
                        {perk.description}
                      </p>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <Button
                onClick={handleJoinDiscord}
                size="lg"
                className="group relative h-12 w-full cursor-pointer overflow-hidden rounded-xl border-0 bg-gradient-to-r from-violet-500 to-purple-500 font-bold text-white shadow-lg shadow-violet-500/30 transition-all hover:scale-[1.02] hover:from-violet-600 hover:to-purple-600 hover:shadow-xl hover:shadow-violet-500/40"
              >
                <span
                  aria-hidden
                  className="absolute inset-0 -translate-x-full bg-gradient-to-r from-white/0 via-white/20 to-white/0 transition-transform duration-700 group-hover:translate-x-full"
                />
                <span className="relative flex items-center justify-center gap-2">
                  <Sparkle className="size-4" weight="fill" />
                  <span className="text-sm whitespace-nowrap">
                    Acessar Comunidade ULTRA
                  </span>
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-1"
                    weight="bold"
                  />
                </span>
              </Button>

              <p className="text-muted-foreground mt-4 text-center text-xs">
                Todo o acompanhamento acontece no Discord. Não perca nenhum
                review ou estratégia!
              </p>
            </motion.div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
