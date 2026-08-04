"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowsOut, BookOpen, Lock } from "@phosphor-icons/react"
import { motion } from "framer-motion"

import { Bone } from "@/components/shared/skeletons"
import { Button } from "@/components/ui/button"
import { api } from "@/trpc/react"

export default function ManualViewer() {
  const router = useRouter()

  // Verifica se o usuário adquiriu o Manual (gate independente do PRO)
  const { data: userData, isLoading } = api.user.getCurrentUser.useQuery()
  const hasClipperManual = userData?.hasClipperManual === true

  // Bloqueia o menu de contexto no viewer para dificultar download
  React.useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest("#pdf-viewer")) {
        e.preventDefault()
      }
    }

    document.addEventListener("contextmenu", handleContextMenu)
    return () => document.removeEventListener("contextmenu", handleContextMenu)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen()
    } else {
      void document.exitFullscreen()
    }
  }

  // ===== Skeleton espelhando header + viewer =====
  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="border-border/60 border-b p-4">
          <div className="mx-auto flex max-w-7xl items-center gap-4 px-0 md:px-2 lg:px-4">
            <Bone className="h-9 w-24 rounded-xl" />
            <Bone delay={80} className="size-9 rounded-xl" />
            <div className="flex flex-col gap-1.5">
              <Bone delay={140} className="h-5 w-44" />
              <Bone delay={200} className="hidden h-3 w-64 rounded-full sm:block" />
            </div>
            <div className="flex-1" />
            <Bone delay={260} className="size-8 rounded-lg" />
          </div>
        </div>
        <div className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6 lg:p-8">
          <Bone delay={320} className="h-[70vh] w-full rounded-3xl" />
        </div>
      </div>
    )
  }

  // ===== Bloqueado — precisa adquirir o Manual =====
  if (!hasClipperManual) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 md:p-6 lg:p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          <div className="glass-card relative overflow-hidden rounded-3xl border-amber-500/20 p-8 text-center">
            {/* Aurora âmbar sutil */}
            <span
              aria-hidden
              className="arena-aurora pointer-events-none absolute -top-20 -right-16 size-56 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,#f59e0b_18%,transparent),transparent_66%)] blur-2xl"
            />
            <span
              aria-hidden
              className="arena-aurora pointer-events-none absolute -bottom-20 -left-16 size-56 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,#f97316_14%,transparent),transparent_66%)] blur-2xl"
              style={{ animationDelay: "-7s" }}
            />

            <div className="relative flex flex-col items-center gap-6">
              {/* Cadeado animado */}
              <div className="relative">
                <span
                  aria-hidden
                  className="hero-pulse-ring absolute -inset-4 rounded-full bg-amber-500/35"
                />
                <span className="relative flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30">
                  <Lock className="size-10 text-white" weight="fill" />
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold tracking-tight">
                  Acesso Restrito
                </h2>
                <p className="text-muted-foreground">
                  Você precisa adquirir o Manual do Clipador para acessar este
                  conteúdo.
                </p>
              </div>

              <div className="flex w-full flex-col gap-3">
                <Button
                  asChild
                  className="h-11 w-full cursor-pointer rounded-xl border-0 bg-gradient-to-r from-amber-500 to-orange-500 font-bold text-white shadow-lg shadow-amber-500/30 transition-all hover:from-amber-600 hover:to-orange-600"
                >
                  <Link href="/classes">Ver Opções de Compra</Link>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.back()}
                  className="h-11 w-full cursor-pointer rounded-xl"
                >
                  <ArrowLeft className="size-4" />
                  Voltar
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  // ===== Liberado — viewer do PDF =====
  return (
    <div className="flex h-full flex-1 flex-col">
      {/* Header sticky */}
      <div className="bg-background/95 border-border/60 sticky top-0 z-40 border-b backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="cursor-pointer gap-2 rounded-xl"
              >
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline">Voltar</span>
              </Button>

              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                  <BookOpen
                    className="size-4.5 text-amber-600 dark:text-amber-400"
                    weight="fill"
                  />
                </span>
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-bold tracking-tight">
                    Manual do Clipador
                  </h1>
                  <p className="text-muted-foreground hidden text-xs sm:block">
                    O guia definitivo para clipadores profissionais
                  </p>
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="size-8 shrink-0 cursor-pointer rounded-lg p-0"
              title="Tela cheia"
              aria-label="Tela cheia"
            >
              <ArrowsOut className="size-4" weight="bold" />
            </Button>
          </div>
        </div>
      </div>

      {/* Viewer do PDF */}
      <div className="bg-muted/30 flex-1 overflow-auto" id="pdf-viewer">
        <div className="mx-auto max-w-6xl p-4 md:p-6 lg:p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-background border-border/60 relative overflow-hidden rounded-3xl border shadow-2xl"
          >
            {/* object para melhor compatibilidade, iframe como fallback */}
            <object
              data="/Manual-do-Clipador.pdf#toolbar=0&navpanes=0&scrollbar=1"
              type="application/pdf"
              className="w-full"
              style={{ height: "calc(100vh - 180px)", minHeight: "600px" }}
            >
              <iframe
                src="/Manual-do-Clipador.pdf#toolbar=0&navpanes=0&scrollbar=1"
                className="w-full"
                style={{ height: "calc(100vh - 180px)", minHeight: "600px" }}
                title="Manual do Clipador"
              />
            </object>

            {/* Overlay transparente para dificultar interação direta */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ userSelect: "none" }}
            />
          </motion.div>

          {/* Rodapé */}
          <div className="text-muted-foreground mt-6 text-center text-sm">
            <p>
              Este material é de uso exclusivo para clipadores da Clipfy League.
              <br />
              A reprodução ou distribuição sem autorização é proibida.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
