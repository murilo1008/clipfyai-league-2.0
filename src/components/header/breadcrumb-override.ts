"use client"

import * as React from "react"

/**
 * Trilha do breadcrumb definida pela própria página, no lugar da derivada da
 * URL. Usada pelo modo apresentação do sandbox, para a topbar mostrar a
 * trilha de uma competição em vez de "Sandbox › Edição do sandbox".
 */
export type BreadcrumbCrumb = { href: string; label: string }

let current: BreadcrumbCrumb[] | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useBreadcrumbOverride() {
  return React.useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  )
}

/** Troca a trilha enquanto o componente estiver montado (`null` = da URL). */
export function useOverrideBreadcrumbs(crumbs: BreadcrumbCrumb[] | null) {
  const key = crumbs ? JSON.stringify(crumbs) : null
  React.useEffect(() => {
    current = key ? (JSON.parse(key) as BreadcrumbCrumb[]) : null
    listeners.forEach((listener) => listener())
    return () => {
      current = null
      listeners.forEach((listener) => listener())
    }
  }, [key])
}
