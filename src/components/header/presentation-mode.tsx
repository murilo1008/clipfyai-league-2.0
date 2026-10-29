"use client"

import * as React from "react"
import { ProjectorScreen } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/*
 * Modo exibição do sandbox de competição: ícone marcado = a página aparece
 * como uma competição real, sem nada que entregue que é uma cópia;
 * desmarcado = modo edição. O ícone fica na topbar, ao lado do "ocultar
 * valores", e só aparece enquanto essa página está montada. A preferência
 * fica no navegador.
 */

const STORAGE_KEY = "competition-sandbox:presentation"

type PresentationSnapshot = { available: boolean; enabled: boolean }

const SERVER_SNAPSHOT: PresentationSnapshot = {
  available: false,
  enabled: false,
}
let snapshot = SERVER_SNAPSHOT
let providers = 0
const listeners = new Set<() => void>()

function emit(next: PresentationSnapshot) {
  snapshot = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function readStored() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function setPresentationMode(enabled: boolean) {
  try {
    if (enabled) window.localStorage.setItem(STORAGE_KEY, "1")
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage bloqueado: o modo vale só até recarregar
  }
  emit({ ...snapshot, enabled })
}

function usePresentationMode() {
  return React.useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => SERVER_SNAPSHOT,
  )
}

/** Liga o ícone da topbar enquanto a página estiver montada; diz se o modo está ativo. */
export function useProvidePresentationMode() {
  React.useEffect(() => {
    providers += 1
    emit({ available: true, enabled: readStored() })
    return () => {
      providers -= 1
      if (providers === 0) emit(SERVER_SNAPSHOT)
    }
  }, [])
  return usePresentationMode().enabled
}

export function PresentationModeToggle() {
  const { available, enabled } = usePresentationMode()
  if (!available) return null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-pressed={enabled}
          aria-label={enabled ? "Voltar para o modo edição" : "Modo exibição"}
          onClick={() => setPresentationMode(!enabled)}
          className={cn(
            "size-8 cursor-pointer rounded-lg",
            enabled && "text-brand-cyan not-dark:text-primary",
          )}
        >
          <ProjectorScreen
            className="size-4"
            weight={enabled ? "fill" : "regular"}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {enabled ? "Voltar para o modo edição" : "Modo exibição"}
      </TooltipContent>
    </Tooltip>
  )
}
