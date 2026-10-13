"use client"

import * as React from "react"
import { List, X } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"

/**
 * Sumário das páginas públicas longas (termos, privacidade, regulamento).
 * A página em si é server component; só a navegação precisa de JS.
 */
export type LegalNavSection = {
  id: string
  title: string
  /** Ícone já renderizado pela página (componentes não cruzam para o client). */
  icon: React.ReactNode
}

/** Rola até a seção descontando o topo; `false` se a âncora não existe. */
function scrollToSection(id: string) {
  const element = document.getElementById(id)
  if (!element) return false

  const offset = 100
  const bodyRect = document.body.getBoundingClientRect().top
  const elementRect = element.getBoundingClientRect().top
  const elementPosition = elementRect - bodyRect
  const offsetPosition = elementPosition - offset

  window.scrollTo({
    top: offsetPosition,
    behavior: "smooth",
  })
  return true
}

/** Lista do sumário lateral (desktop). */
export function LegalSectionNav({ sections }: { sections: LegalNavSection[] }) {
  return (
    <div className="space-y-1">
      {sections.map((section) => (
        <button
          key={section.id}
          onClick={() => scrollToSection(section.id)}
          className="hover:bg-brand-cyan/10 flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors"
        >
          {section.icon}
          <span className="truncate">{section.title}</span>
        </button>
      ))}
    </div>
  )
}

/** Botão flutuante + overlay de navegação (mobile). */
export function LegalMobileMenu({ sections }: { sections: LegalNavSection[] }) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  const goToSection = (id: string) => {
    if (scrollToSection(id)) setMobileMenuOpen(false)
  }

  return (
    <>
      {/* ===== Botão do menu mobile ===== */}
      <div className="fixed top-4 right-4 z-50 lg:hidden">
        <Button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          size="icon"
          aria-label={mobileMenuOpen ? "Fechar navegação" : "Abrir navegação"}
          className="btn-gradient-auth size-11 cursor-pointer rounded-full text-[#04222A] shadow-[0_8px_30px_-8px_rgba(20,247,254,0.5)]"
        >
          {mobileMenuOpen ? (
            <X className="size-5" weight="bold" />
          ) : (
            <List className="size-5" weight="bold" />
          )}
        </Button>
      </div>

      {/* ===== Overlay do menu mobile ===== */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 overflow-y-auto bg-[#030d18]/95 pt-20 backdrop-blur-md lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="p-6">
            <h3 className="mb-4 text-lg font-bold">Navegação</h3>
            <div className="space-y-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => goToSection(section.id)}
                  className="hover:bg-brand-cyan/10 flex w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors"
                >
                  {section.icon}
                  <span className="text-sm">{section.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
