"use client"

import * as React from "react"
import Image, { type ImageProps } from "next/image"
import { VideoCamera } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

type ClipThumbnailProps = Omit<ImageProps, "src" | "unoptimized" | "loader"> & {
  src: string | null | undefined
  /**
   * O que mostrar quando não há URL ou a imagem falha. Padrão: placeholder
   * neutro no mesmo tamanho. Use `null` para não renderizar nada.
   */
  fallback?: React.ReactNode
}

/**
 * Thumbnail de post de rede social (TikTok, Instagram, YouTube…).
 *
 * As URLs são assinadas pelo CDN da plataforma e expiram ~24 h depois da
 * coleta, então a imagem:
 * - não passa pelo otimizador do Next (`unoptimized`): cada URL assinada é
 *   uma imagem nova (o cache nunca acerta), o servidor teria que buscá-la no
 *   CDN da plataforma e, depois de expirada, o `/_next/image` só devolve erro;
 * - vai sem Referer (`referrerPolicy="no-referrer"`): os CDNs recusam hotlink
 *   vindo de outro domínio;
 * - carrega sob demanda (`loading="lazy"`), exceto com `priority`;
 * - quando falha, vira um placeholder neutro que ocupa a mesma caixa, em vez
 *   do ícone de imagem quebrada.
 */
function ClipThumbnail({
  src,
  alt,
  fill,
  width,
  height,
  className,
  style,
  priority,
  loading,
  onError,
  fallback,
  ...props
}: ClipThumbnailProps) {
  // Guarda a URL que falhou (e não um booleano): se `src` mudar, a nova URL
  // é tentada sem precisar de efeito para resetar o estado.
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null)

  if (!src || failedSrc === src) {
    if (fallback !== undefined) return <>{fallback}</>
    return (
      <span
        data-slot="clip-thumbnail-fallback"
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        className={cn(
          "from-muted to-muted/60 text-muted-foreground/60 items-center justify-center bg-gradient-to-br",
          fill ? "absolute inset-0 flex" : "inline-flex",
          className,
        )}
        style={
          fill
            ? style
            : {
                width: width === undefined ? undefined : Number(width),
                height: height === undefined ? undefined : Number(height),
                ...style,
              }
        }
      >
        <VideoCamera
          aria-hidden
          className="size-1/4 max-h-10 min-h-4 max-w-10 min-w-4"
          weight="duotone"
        />
      </span>
    )
  }

  return (
    <Image
      {...props}
      src={src}
      alt={alt}
      fill={fill}
      width={width}
      height={height}
      className={className}
      style={style}
      priority={priority}
      loading={priority ? undefined : (loading ?? "lazy")}
      unoptimized
      referrerPolicy="no-referrer"
      onError={(event) => {
        setFailedSrc(src)
        onError?.(event)
      }}
    />
  )
}

export { ClipThumbnail }
export type { ClipThumbnailProps }
