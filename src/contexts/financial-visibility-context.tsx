"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

interface FinancialVisibilityContextType {
  isVisible: boolean
  toggleVisibility: () => void
  formatHidden: (value: string | number) => string
}

const FinancialVisibilityContext = createContext<FinancialVisibilityContextType | undefined>(undefined)

const STORAGE_KEY = "clipfy-financial-visibility"

export function FinancialVisibilityProvider({ children }: { children: ReactNode }) {
  const [isVisible, setIsVisible] = useState(true)
  const [isHydrated, setIsHydrated] = useState(false)

  // Carregar preferência do localStorage após hidratação
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      setIsVisible(stored === "true")
    }
    setIsHydrated(true)
  }, [])

  // Salvar preferência no localStorage
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, String(isVisible))
    }
  }, [isVisible, isHydrated])

  const toggleVisibility = () => {
    setIsVisible((prev) => !prev)
  }

  // Função para formatar valores ocultos
  const formatHidden = (value: string | number): string => {
    if (isVisible) {
      return typeof value === "number" ? value.toString() : value
    }
    // Retorna asteriscos para ocultar
    return "••••••"
  }

  return (
    <FinancialVisibilityContext.Provider value={{ isVisible, toggleVisibility, formatHidden }}>
      {children}
    </FinancialVisibilityContext.Provider>
  )
}

export function useFinancialVisibility() {
  const context = useContext(FinancialVisibilityContext)
  if (context === undefined) {
    throw new Error("useFinancialVisibility must be used within a FinancialVisibilityProvider")
  }
  return context
}

const HIDDEN = "••••••"

/**
 * Formatadores de moeda que respeitam o olhinho da topbar.
 * - maskBRL: BRL sem centavos (padrão da plataforma)
 * - maskBRLExact: BRL com centavos
 * - maskText: mascara um valor já formatado (strings tipo "R$ 50.000")
 */
export function useMaskedCurrency() {
  const { isVisible } = useFinancialVisibility()
  return {
    isVisible,
    maskBRL: (value: number) =>
      isVisible
        ? value.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
            maximumFractionDigits: 0,
          })
        : HIDDEN,
    maskBRLExact: (value: number) =>
      isVisible
        ? value.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })
        : HIDDEN,
    maskText: (value: string) => (isVisible ? value : HIDDEN),
  }
}

