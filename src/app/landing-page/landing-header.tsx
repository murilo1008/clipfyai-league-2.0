"use client"

import * as React from "react"
import Link from "next/link"
import { List, X } from "@phosphor-icons/react"

import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"

/* Partes interativas da landing page. A página em si é server component:
   só o menu (estado de aberto/fechado) e os botões que rolam a página ou
   abrem a lista de interesse precisam de JS no navegador. */

function openInterestList() {
  window.open("/interest-list", "_blank")
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
}

type LandingButtonProps = Omit<React.ComponentProps<typeof Button>, "onClick">

/** CTA de contratação: abre a lista de interesse em nova aba. */
export function ContratarButton(props: LandingButtonProps) {
  return <Button {...props} onClick={openInterestList} />
}

/** "Sou Clipador": rola até a seção dos clipadores. */
export function ScrollToClippersButton(props: LandingButtonProps) {
  return <Button {...props} onClick={() => scrollToId("clipadores")} />
}

/** Header fixo com navegação, menu mobile e overlay. */
export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  const handleContratar = openInterestList

  const scrollToClippers = () => {
    scrollToId("clipadores")
    setMobileMenuOpen(false)
  }

  const scrollToSection = (id: string) => {
    scrollToId(id)
    setMobileMenuOpen(false)
  }

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  return (
    <>
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="animate-fade-in fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={toggleMobileMenu}
        />
      )}

      {/* Header */}
      <header className="fixed top-0 right-0 left-0 z-50 border-b border-white/10 bg-[#050f1c]/85 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Clipfy League">
            <Logo width={140} height={35} shadow={false} className="h-8 w-auto" />
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <button
              onClick={() => scrollToSection("como-funciona")}
              className="hover:text-brand-cyan cursor-pointer text-sm font-medium text-white/75 transition-colors"
            >
              Como funciona
            </button>
            <button
              onClick={() => scrollToSection("plataforma")}
              className="hover:text-brand-cyan cursor-pointer text-sm font-medium text-white/75 transition-colors"
            >
              Plataforma
            </button>
            <button
              onClick={() => scrollToSection("faq")}
              className="hover:text-brand-cyan cursor-pointer text-sm font-medium text-white/75 transition-colors"
            >
              FAQ
            </button>
            <button
              onClick={scrollToClippers}
              className="hover:text-brand-cyan cursor-pointer text-sm font-medium text-white/75 transition-colors"
            >
              Sou Clipador
            </button>
            <Button
              onClick={handleContratar}
              size="sm"
              className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
            >
              Quero contratar
            </Button>
          </nav>
          <button
            className={`group relative cursor-pointer rounded-lg p-2 transition-all md:hidden ${
              mobileMenuOpen
                ? "bg-brand-cyan/20 shadow-lg shadow-brand-cyan/50"
                : "hover:bg-white/10"
            }`}
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
          >
            <div className="relative h-6 w-6">
              <List
                className={`absolute inset-0 h-6 w-6 transition-all duration-200 ease-in-out ${
                  mobileMenuOpen
                    ? "scale-75 rotate-45 opacity-0"
                    : "scale-100 rotate-0 opacity-100"
                }`}
              />
              <X
                className={`text-brand-cyan absolute inset-0 h-6 w-6 transition-all duration-200 ease-in-out ${
                  mobileMenuOpen
                    ? "scale-100 rotate-0 opacity-100"
                    : "scale-75 -rotate-45 opacity-0"
                }`}
              />
            </div>
          </button>
        </div>
        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="animate-fade-in-down border-brand-cyan/30 shadow-brand-cyan/20 border-t bg-gradient-to-b from-[#050f1c]/95 to-[#050f1c]/90 shadow-2xl backdrop-blur-xl md:hidden">
            <div className="container mx-auto space-y-3 px-4 py-6">
              <button
                onClick={() => scrollToSection("como-funciona")}
                className="animate-fade-in-down hover:text-brand-cyan block w-full cursor-pointer rounded-lg py-3 text-left text-sm font-medium transition-all hover:bg-white/10 hover:pl-2"
                style={{ animationDelay: "0.05s" }}
              >
                Como funciona
              </button>
              <button
                onClick={() => scrollToSection("plataforma")}
                className="animate-fade-in-down hover:text-brand-cyan block w-full cursor-pointer rounded-lg py-3 text-left text-sm font-medium transition-all hover:bg-white/10 hover:pl-2"
                style={{ animationDelay: "0.1s" }}
              >
                Plataforma
              </button>
              <button
                onClick={() => scrollToSection("faq")}
                className="animate-fade-in-down hover:text-brand-cyan block w-full cursor-pointer rounded-lg py-3 text-left text-sm font-medium transition-all hover:bg-white/10 hover:pl-2"
                style={{ animationDelay: "0.15s" }}
              >
                FAQ
              </button>
              <Button
                onClick={scrollToClippers}
                variant="outline"
                size="sm"
                className="animate-fade-in-down w-full cursor-pointer rounded-xl border-white/15 text-white transition-all hover:scale-[1.02] hover:bg-white/5 hover:text-white"
                style={{ animationDelay: "0.2s" }}
              >
                Sou Clipador
              </Button>
              <Button
                onClick={handleContratar}
                size="sm"
                className="btn-gradient-auth animate-fade-in-down w-full cursor-pointer rounded-xl font-semibold transition-all hover:scale-[1.02]"
                style={{ animationDelay: "0.25s" }}
              >
                Quero contratar
              </Button>
            </div>
          </div>
        )}
      </header>
    </>
  )
}
