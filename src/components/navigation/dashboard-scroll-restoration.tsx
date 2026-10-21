"use client"

import { usePathname } from "next/navigation"
import * as React from "react"

import {
  getNavigation,
  persistScroll,
  recallScroll,
  rememberScroll,
  restoreTracker,
  type NavigateEventLike,
} from "@/lib/navigation-restore"

/** Quanto esperar a página crescer (dados chegando) até a posição salva. */
const RESTORE_TIMEOUT_MS = 5_000
const PERSIST_DELAY_MS = 200
/** Gestos que encerram a restauração: o usuário assumiu o scroll. */
const USER_SCROLL_EVENTS = [
  "wheel",
  "touchstart",
  "pointerdown",
  "keydown",
] as const

function getScrollContainer() {
  return document.querySelector<HTMLElement>('[data-slot="sidebar-inset"]')
}

/**
 * Leva o container até `top`, esperando a página ter altura para isso.
 * Devolve a função que interrompe a espera.
 */
function restoreScroll(
  container: HTMLElement,
  top: number,
  restoringRef: React.RefObject<boolean>,
) {
  const deadline = performance.now() + RESTORE_TIMEOUT_MS
  let frame = 0

  const stop = () => {
    cancelAnimationFrame(frame)
    restoringRef.current = false
    for (const type of USER_SCROLL_EVENTS) {
      window.removeEventListener(type, stop, true)
    }
  }

  const step = () => {
    const maxTop = container.scrollHeight - container.clientHeight
    container.scrollTo({ top: Math.min(top, maxTop), behavior: "instant" })
    if (maxTop >= top || performance.now() >= deadline) {
      stop()
      return
    }
    frame = requestAnimationFrame(step)
  }

  restoringRef.current = true
  for (const type of USER_SCROLL_EVENTS) {
    window.addEventListener(type, stop, { capture: true, passive: true })
  }
  step()
  return stop
}

/**
 * Devolve o `<main>` do dashboard à posição em que estava ao voltar/avançar
 * no navegador ou pelos botões `BackLink`. Navegações comuns não mudam.
 */
export function DashboardScrollRestoration() {
  const pathname = usePathname()
  // Rota que o scroll atual representa. Entre o commit da rota nova e o
  // efeito abaixo a URL já mudou, e o scroll que acontece é de transição.
  const renderedPathRef = React.useRef<string | null>(null)
  const restoringRef = React.useRef(false)
  const stopRestoreRef = React.useRef<(() => void) | null>(null)

  const startRestore = React.useCallback((path: string) => {
    stopRestoreRef.current?.()
    const container = getScrollContainer()
    stopRestoreRef.current = container
      ? restoreScroll(container, recallScroll(path) ?? 0, restoringRef)
      : null
  }, [])

  React.useEffect(() => {
    const container = getScrollContainer()
    if (!container) return

    let frame = 0
    let persistTimer: ReturnType<typeof setTimeout> | undefined

    const onScroll = () => {
      if (restoringRef.current) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const path = renderedPathRef.current
        if (!path || path !== window.location.pathname) return
        rememberScroll(path, container.scrollTop)
        clearTimeout(persistTimer)
        persistTimer = setTimeout(() => persistScroll(path), PERSIST_DELAY_MS)
      })
    }

    // A página de destino precisa saber que é um voltar/avançar antes de
    // renderizar. O `navigate` da Navigation API dispara antes do popstate,
    // onde o React renderiza a rota de forma síncrona no listener do Next
    // (registrado antes deste, já que o dashboard monta depois do login).
    const onTraverse = (path: string) => {
      if (restoreTracker.traverse(path, renderedPathRef.current)) {
        startRestore(path)
      }
    }
    const onNavigate = (event: NavigateEventLike) => {
      if (event.navigationType !== "traverse") return
      onTraverse(new URL(event.destination.url).pathname)
    }
    // Sem Navigation API: captura roda antes dos listeners comuns no window.
    const onPopState = () => onTraverse(window.location.pathname)
    const onPageHide = () => {
      if (renderedPathRef.current) persistScroll(renderedPathRef.current)
    }

    const navigation = getNavigation()
    container.addEventListener("scroll", onScroll, { passive: true })
    navigation?.addEventListener?.("navigate", onNavigate)
    window.addEventListener("popstate", onPopState, true)
    window.addEventListener("pagehide", onPageHide)
    return () => {
      container.removeEventListener("scroll", onScroll)
      navigation?.removeEventListener?.("navigate", onNavigate)
      window.removeEventListener("popstate", onPopState, true)
      window.removeEventListener("pagehide", onPageHide)
      cancelAnimationFrame(frame)
      clearTimeout(persistTimer)
    }
  }, [startRestore])

  // Layout effect: posiciona antes da pintura, sem piscar no topo.
  React.useLayoutEffect(() => {
    const shouldRestore = restoreTracker.commit(pathname)
    renderedPathRef.current = pathname
    if (shouldRestore) startRestore(pathname)
    return () => {
      stopRestoreRef.current?.()
      stopRestoreRef.current = null
    }
  }, [pathname, startRestore])

  return null
}
