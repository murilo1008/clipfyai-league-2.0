"use client"

import {
  CheckCircle,
  Copy,
  Info,
  LinkSimple,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"

import { sanitizeArtisticName, type CompetitionDetails } from "./shared"

/* Ordem fixa: Instagram, TikTok, YouTube, Facebook, Kwai. */
const AFFILIATE_PLATFORMS: Array<{
  platform: PlatformKey
  key:
    | "affiliateLinkInstagram"
    | "affiliateLinkTiktok"
    | "affiliateLinkYoutube"
    | "affiliateLinkFacebook"
    | "affiliateLinkKwai"
  gradient: string
  border: string
  color: string
}> = [
  {
    platform: "INSTAGRAM",
    key: "affiliateLinkInstagram",
    gradient: "from-pink-500 via-purple-500 to-orange-500",
    border: "border-pink-500/40",
    color: "text-pink-500 dark:text-pink-400",
  },
  {
    platform: "TIKTOK",
    key: "affiliateLinkTiktok",
    gradient: "from-cyan-500 to-blue-500",
    border: "border-cyan-500/40",
    color: "text-cyan-600 dark:text-cyan-400",
  },
  {
    platform: "YOUTUBE",
    key: "affiliateLinkYoutube",
    gradient: "from-red-500 to-red-600",
    border: "border-red-500/40",
    color: "text-red-500 dark:text-red-400",
  },
  {
    platform: "FACEBOOK",
    key: "affiliateLinkFacebook",
    gradient: "from-blue-500 to-blue-600",
    border: "border-blue-500/40",
    color: "text-blue-500 dark:text-blue-400",
  },
  {
    platform: "KWAI",
    key: "affiliateLinkKwai",
    gradient: "from-orange-500 to-yellow-500",
    border: "border-orange-500/40",
    color: "text-orange-500 dark:text-orange-400",
  },
]

/* ============================================================
   Dialog "Links de Afiliado" (obrigatório)
   ============================================================ */

export function AffiliateLinksDialog({
  open,
  onOpenChange,
  competition,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  competition: CompetitionDetails
}) {
  const sanitizedName = sanitizeArtisticName(
    competition.clipperArtisticName || "",
  )

  const affiliateLinks = AFFILIATE_PLATFORMS.map((item) => ({
    ...item,
    link: competition[item.key],
  })).filter((item) => !!item.link)

  const handleCopyLink = (link: string, platformLabel: string) => {
    const fullLink = `${link}${sanitizedName}`
    void navigator.clipboard.writeText(fullLink)
    toast.success(`Link do ${platformLabel} copiado!`, {
      description: "Cole na bio ou descrição do seu vídeo",
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/30">
              <LinkSimple className="size-6 text-white" weight="bold" />
            </span>
            <div className="text-left">
              <DialogTitle className="flex flex-wrap items-center gap-2 text-xl font-bold sm:text-2xl">
                <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent dark:from-emerald-400 dark:to-teal-400">
                  Links de Afiliado
                </span>
                <Badge className="animate-pulse border-0 bg-red-500 px-2 py-0.5 text-xs text-white">
                  ⚠️ Obrigatório
                </Badge>
              </DialogTitle>
              <DialogDescription className="mt-1">
                Copie e cole os links na bio ou descrição dos seus vídeos
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Aviso obrigatório */}
          <div className="flex items-start gap-3 rounded-2xl border-l-4 border-l-red-500 bg-gradient-to-r from-red-500/10 to-orange-500/10 p-4">
            <span className="shrink-0 rounded-lg bg-red-500/20 p-2">
              <Info className="size-5 text-red-400" weight="fill" />
            </span>
            <div>
              <p className="mb-1 text-sm font-bold text-red-500 dark:text-red-400">
                ⚠️ ATENÇÃO - OBRIGATÓRIO
              </p>
              <p className="text-muted-foreground text-xs">
                É{" "}
                <span className="font-semibold text-red-500 dark:text-red-400">
                  OBRIGATÓRIO
                </span>{" "}
                colocar o link de afiliado correspondente à plataforma na{" "}
                <span className="font-semibold text-red-500 dark:text-red-400">
                  bio
                </span>{" "}
                ou na{" "}
                <span className="font-semibold text-red-500 dark:text-red-400">
                  descrição de TODOS os seus vídeos
                </span>
                . Posts sem o link podem ser desqualificados.
              </p>
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-col gap-3">
            {affiliateLinks.map((item) => {
              const config = platformConfig[item.platform]
              const PlatformIcon = config.icon
              const fullLink = `${item.link}${sanitizedName}`

              return (
                <div
                  key={item.platform}
                  className={cn(
                    "glass-card flex flex-col gap-3 rounded-2xl border p-3 transition-all hover:shadow-lg sm:p-4",
                    item.border,
                  )}
                >
                  {/* Plataforma */}
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "shrink-0 rounded-lg bg-gradient-to-r p-2",
                        item.gradient,
                      )}
                    >
                      <PlatformIcon className="size-4 text-white sm:size-5" />
                    </span>
                    <p className={cn("text-sm font-bold sm:text-base", item.color)}>
                      {config.label}
                    </p>
                  </div>

                  {/* Link */}
                  <div className="border-border/50 bg-muted/40 overflow-hidden rounded-lg border p-3">
                    <p className="text-muted-foreground mb-1 text-[10px] font-medium">
                      Seu link personalizado:
                    </p>
                    <p className="font-mono text-xs leading-relaxed break-all select-all sm:text-sm">
                      {fullLink}
                    </p>
                  </div>

                  {/* Copiar */}
                  <Button
                    className={cn(
                      "w-full cursor-pointer gap-2 rounded-xl border-0 bg-gradient-to-r text-white shadow-lg hover:opacity-90",
                      item.gradient,
                    )}
                    onClick={() => handleCopyLink(item.link!, config.label)}
                  >
                    <Copy className="size-4" weight="bold" />
                    Copiar Link do {config.label}
                  </Button>
                </div>
              )
            })}
          </div>

          {/* Instruções */}
          <div className="rounded-2xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="size-4" weight="fill" />
              Como usar os links corretamente:
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  1.
                </span>
                <p className="text-muted-foreground text-xs">
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    Copie o link
                  </span>{" "}
                  da plataforma onde você vai postar
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  2.
                </span>
                <p className="text-muted-foreground text-xs">
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    Cole na bio
                  </span>{" "}
                  do seu perfil ou na{" "}
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    descrição do vídeo
                  </span>
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  3.
                </span>
                <p className="text-muted-foreground text-xs">
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    Repita
                  </span>{" "}
                  para cada plataforma que você for postar
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            className="w-full cursor-pointer rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 font-semibold text-white hover:opacity-90 sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            <CheckCircle className="size-4" weight="fill" />
            Entendi, vou usar os links
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
