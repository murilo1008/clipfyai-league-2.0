"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"

import {
  getNavigation,
  previousEntryPathname,
  restoreTracker,
} from "@/lib/navigation-restore"

type BackLinkProps = Omit<React.ComponentProps<typeof Link>, "href"> & {
  href: string
}

/**
 * Link "Voltar para …" que devolve a página de destino como estava (scroll e
 * filtros de `useRestorableState`). Se a entrada anterior do histórico é essa
 * página, volta pelo histórico; senão navega para `href` e restaura a última
 * posição conhecida nesta aba (ou o topo, se não houver).
 */
export function BackLink({ href, onClick, ...props }: BackLinkProps) {
  const router = useRouter()

  return (
    <Link
      {...props}
      href={href}
      scroll={false}
      onClick={(event) => {
        onClick?.(event)
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return
        }
        if (previousEntryPathname(getNavigation()) === href) {
          event.preventDefault()
          router.back()
          return
        }
        restoreTracker.expect(href)
      }}
    />
  )
}
