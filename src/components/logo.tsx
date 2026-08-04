import Image from "next/image"

import { cn } from "@/lib/utils"

interface LogoProps {
  width?: number
  height?: number
  className?: string
  /** Sombra sutil no tema light (desative onde o fundo já dá contraste) */
  shadow?: boolean
}

/**
 * Logo da Clipfy — troca automaticamente por tema:
 * dark = "Clip" branco, light = "Clip" preto. Gradientes intactos nos dois.
 * A sombra do light fica no wrapper: WebKit corta filtro aplicado direto no <img>.
 */
export function Logo({
  width = 200,
  height = 50,
  className = "",
  shadow = true,
}: LogoProps) {
  return (
    <span
      className={cn(
        "block w-fit",
        shadow &&
          "[filter:drop-shadow(0_0_1px_rgba(0,0,0,0.35))_drop-shadow(0_1.5px_2.5px_rgba(0,0,0,0.30))] dark:[filter:none]"
      )}
    >
      <Image
        src="/images/logo-clipfy-white.svg"
        alt="Clipfy League"
        width={width}
        height={height}
        className={cn("hidden dark:block", className)}
        priority
      />
      <Image
        src="/images/logo-clipfy-black.svg"
        alt="Clipfy League"
        width={width}
        height={height}
        className={cn("block dark:hidden", className)}
        priority
      />
    </span>
  )
}
