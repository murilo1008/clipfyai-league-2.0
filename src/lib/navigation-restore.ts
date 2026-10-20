/**
 * "Voltar para onde eu estava" no dashboard.
 *
 * O dashboard rola o `<main>` do layout, não a janela: nem o navegador nem o
 * Next devolvem a posição ao voltar para uma página. Este módulo guarda, por
 * aba, a posição de cada rota e marca quais navegações devem restaurá-la
 * (voltar/avançar do navegador e os botões `BackLink`). Os filtros de
 * `useRestorableState` seguem a mesma marcação.
 */

/** Marca quais navegações devolvem a página como ela estava. */
export function createRestoreTracker() {
  // Próxima rota a renderizar que deve voltar como estava.
  let pending: string | null = null
  // Rota atual, se foi restaurada: estados montados depois também leem.
  let restored: string | null = null

  return {
    /** Voltar/avançar do navegador ou `BackLink` a caminho de `pathname`. */
    expect(pathname: string) {
      pending = pathname
    },
    /** A rota renderizada mudou; devolve se ela deve ser restaurada. */
    commit(pathname: string) {
      const restore = pending === pathname
      pending = null
      restored = restore ? pathname : null
      return restore
    },
    /** A página em `pathname` está sendo (ou foi) restaurada? */
    isRestoring(pathname: string) {
      return pending === pathname || restored === pathname
    },
    /**
     * Voltar/avançar para `pathname`, com a rota renderizada no momento.
     * Devolve `true` quando a rota de destino já renderizou sem a marcação
     * (o React renderiza de forma síncrona no popstate, e o listener do Next
     * pode rodar antes do nosso): o scroll deve ser restaurado agora.
     */
    traverse(pathname: string, renderedPathname: string | null) {
      if (renderedPathname !== pathname) {
        pending = pathname
        return false
      }
      if (restored === pathname) return false
      restored = pathname
      return true
    },
  }
}

export const restoreTracker = createRestoreTracker()

export type NavigateEventLike = Event & {
  navigationType: "push" | "replace" | "reload" | "traverse"
  destination: { url: string }
}

type NavigateListener = (event: NavigateEventLike) => void

/** Subconjunto da Navigation API (Chrome/Edge, Safari 26.2+, Firefox 147+). */
export type NavigationLike = {
  currentEntry: { index: number } | null
  entries(): { url: string | null }[]
  addEventListener?(type: "navigate", listener: NavigateListener): void
  removeEventListener?(type: "navigate", listener: NavigateListener): void
}

export function getNavigation(): NavigationLike | undefined {
  return (window as Window & { navigation?: NavigationLike }).navigation
}

/**
 * Pathname da entrada anterior do histórico desta aba, ou `undefined` quando
 * não há (link aberto direto, nova aba) ou o navegador não expõe o histórico.
 */
export function previousEntryPathname(
  navigation: NavigationLike | undefined,
): string | undefined {
  const index = navigation?.currentEntry?.index
  if (!navigation || index === undefined || index < 1) return undefined
  const url = navigation.entries()[index - 1]?.url
  return url ? new URL(url).pathname : undefined
}

/* ===== Posição do scroll por rota ===== */

const SCROLL_PREFIX = "dashboard-scroll:"
const scrollPositions = new Map<string, number>()

export function rememberScroll(pathname: string, top: number) {
  scrollPositions.set(pathname, top)
}

/** Grava a posição em memória no sessionStorage (sobrevive ao reload). */
export function persistScroll(pathname: string) {
  const top = scrollPositions.get(pathname)
  if (top !== undefined) writeSession(SCROLL_PREFIX + pathname, top)
}

export function recallScroll(pathname: string): number | undefined {
  return (
    scrollPositions.get(pathname) ??
    readSession<number>(SCROLL_PREFIX + pathname)
  )
}

/* ===== sessionStorage tolerante a modo privado/cota ===== */

export function readSession<T>(key: string): T | undefined {
  try {
    const raw = window.sessionStorage.getItem(key)
    return raw === null ? undefined : (JSON.parse(raw) as T)
  } catch {
    return undefined
  }
}

export function writeSession(key: string, value: unknown) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Sem storage a página só não volta como estava.
  }
}
