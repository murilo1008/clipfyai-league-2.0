"use client"

import * as React from "react"
import Image from "next/image"
import { Eye, Heart } from "@phosphor-icons/react"

import { formatCompact } from "@/components/shared/count-up"
import { platformMeta } from "@/components/home/platform-chart-meta"

export interface TickerClip {
  id: string
  thumbnail: string
  views: number
  engagementRate: number
  username: string
  platform: string
}

/**
 * Marquee dos vídeos mais vistos das competições ativas — só thumbnails
 * reais (frames com imagem quebrada são removidos automaticamente).
 * Loop infinito e contínuo; pausa no hover; respeita reduced-motion.
 */
export function HeroClipsTicker({ clips }: { clips: TickerClip[] }) {
  if (clips.length === 0) return null

  // Repete a lista até a metade do strip ter largura suficiente p/ loop suave
  const repeats = Math.max(1, Math.ceil(16 / clips.length))
  const half = Array.from({ length: repeats }, () => clips).flat()

  return (
    <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_92%,transparent)]">
      <div
        className="hero-filmstrip flex w-max"
        style={
          {
            "--strip-dur": `${Math.max(half.length * 2.6, 24)}s`,
          } as React.CSSProperties
        }
      >
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 gap-2.5 pr-2.5">
            {half.map((clip, index) => (
              <TickerCard key={`${copy}-${index}-${clip.id}`} clip={clip} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function TickerCard({ clip }: { clip: TickerClip }) {
  const [broken, setBroken] = React.useState(false)
  if (broken) return null

  const { Icon } = platformMeta(clip.platform)

  return (
    <div className="relative h-24 w-[54px] shrink-0 overflow-hidden rounded-xl ring-1 ring-white/12 xl:h-28 xl:w-16">
      <Image
        src={clip.thumbnail}
        alt={clip.username ? `@${clip.username}` : "Corte em destaque"}
        fill
        sizes="80px"
        className="object-cover"
        onError={() => setBroken(true)}
      />

      {/* Overlay para leitura das métricas */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/20" />

      {/* Plataforma */}
      {Icon && (
        <span className="absolute top-1 right-1 flex size-4.5 items-center justify-center rounded-md bg-black/55 text-white backdrop-blur-sm">
          <Icon className="size-2.5" />
        </span>
      )}

      {/* Métricas */}
      <div className="absolute inset-x-1.5 bottom-1.5 flex flex-col gap-px leading-tight">
        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-white tabular-nums">
          <Eye className="size-2.5 text-[var(--brand-cyan)]" weight="fill" />
          {formatCompact(clip.views)}
        </span>
        <span className="inline-flex items-center gap-1 text-[8px] font-semibold text-white/85 tabular-nums">
          <Heart className="size-2.5 text-[var(--brand-green)]" weight="fill" />
          {clip.engagementRate.toLocaleString("pt-BR", {
            maximumFractionDigits: 1,
          })}
          %
        </span>
      </div>
    </div>
  )
}
