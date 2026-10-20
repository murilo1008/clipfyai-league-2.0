import { usePathname } from "next/navigation"
import * as React from "react"

import {
  readSession,
  restoreTracker,
  writeSession,
} from "@/lib/navigation-restore"

/**
 * `useState` que volta com o último valor quando a página é restaurada
 * (voltar do navegador ou `BackLink`), como os filtros de uma lista. Numa
 * navegação comum (menu, link) começa de `initialValue`.
 */
export function useRestorableState<T>(id: string, initialValue: T) {
  const pathname = usePathname()
  const storageKey = `dashboard-state:${pathname}:${id}`

  const [value, setValue] = React.useState<T>(() => {
    const restoring =
      typeof window !== "undefined" && restoreTracker.isRestoring(pathname)
    if (!restoring) return initialValue
    const stored = readSession<T>(storageKey)
    return stored === undefined ? initialValue : stored
  })

  React.useEffect(() => {
    writeSession(storageKey, value)
  }, [storageKey, value])

  return [value, setValue] as const
}
