"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { useSignIn } from "@clerk/nextjs"
import {
  ArrowRight,
  CircleNotch,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  Lightning,
  LockSimple,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { DashboardBackground } from "@/components/dashboard-background"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function SignIn() {
  const { isLoaded, signIn, setActive } = useSignIn()
  const router = useRouter()

  const [showPassword, setShowPassword] = React.useState(false)
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [remember, setRemember] = React.useState(true)
  const [isLoading, setIsLoading] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoaded) return

    if (!email.trim()) {
      toast.error("Email é obrigatório", {
        description: "Por favor, insira seu endereço de email",
        duration: 4000,
      })
      return
    }

    if (!password.trim()) {
      toast.error("Senha é obrigatória", {
        description: "Por favor, insira sua senha",
        duration: 4000,
      })
      return
    }

    setIsLoading(true)

    try {
      const result = await signIn.create({
        identifier: email,
        password: password,
      })

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId })
        toast.success("🎉 Login realizado com sucesso!", {
          description: "Bem-vindo de volta ao Clipfy League",
          duration: 5000,
        })
        router.push("/")
      } else {
        toast.error("Login incompleto", {
          description: "Algo deu errado. Tente novamente",
          duration: 4000,
        })
      }
    } catch {
      toast.error("❌ Erro no login", {
        description: "Conta não encontrada ou senha incorreta. Verifique seus dados",
        duration: 5000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-10">
      <DashboardBackground />

      <div className="animate-fade-in-up flex w-full max-w-md flex-col items-center">
        {/* Logo + tagline */}
        <Link href="/" aria-label="Clipfy League" className="group">
          <Logo
            width={176}
            height={44}
            className="h-11 w-auto dark:drop-shadow-[0_0_24px_rgba(20,247,254,0.3)] transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </Link>
        <p className="text-muted-foreground mt-3 text-center text-sm">
          Transforme seus vídeos em conteúdo viral
        </p>

        {/* Card */}
        <div className="glass-card mt-8 w-full rounded-3xl p-6 sm:p-8">
          <div className="mb-7 text-center">
            <h1 className="text-2xl font-bold tracking-tight sm:text-[1.7rem]">
              Bem-vindo <span className="text-gradient">de volta</span>
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Entre na sua conta para continuar
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <EnvelopeSimple className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="focus-visible:ring-brand-cyan/40 h-12 rounded-xl pl-10.5"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <LockSimple className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="focus-visible:ring-brand-cyan/40 h-12 rounded-xl pr-11 pl-10.5"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3.5 -translate-y-1/2 transition-colors"
                >
                  {showPassword ? (
                    <EyeSlash className="size-4.5" />
                  ) : (
                    <Eye className="size-4.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={remember}
                  onCheckedChange={(checked) => setRemember(checked === true)}
                  disabled={isLoading}
                />
                <span className="text-muted-foreground text-sm">
                  Lembrar de mim
                </span>
              </label>
              <Link
                href="/forgot-password"
                className="text-brand-cyan text-sm font-medium transition-opacity hover:opacity-80"
              >
                Esqueci a senha
              </Link>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !isLoaded}
              className="btn-gradient-auth h-12 w-full rounded-xl text-[0.95rem] font-semibold shadow-[0_8px_30px_-8px_rgba(20,247,254,0.45)] transition-all hover:shadow-[0_10px_36px_-8px_rgba(55,250,156,0.5)]"
            >
              {isLoading ? (
                <CircleNotch className="size-5 animate-spin" />
              ) : (
                <>
                  Entrar
                  <ArrowRight className="size-4.5" weight="bold" />
                </>
              )}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-xs uppercase">ou</span>
            <span className="bg-border h-px flex-1" />
          </div>

          <Button
            asChild
            variant="outline"
            className="border-brand-cyan/25 hover:border-brand-cyan/50 hover:bg-brand-cyan/5 h-11 w-full rounded-xl"
          >
            <Link href="/sign-up">Criar conta</Link>
          </Button>
        </div>

        {/* CTA comercial */}
        <Link
          href="/interest-list"
          className="glass text-muted-foreground hover:text-foreground hover:border-brand-cyan/30 mt-6 flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors"
        >
          <Lightning className="text-brand-mint size-4" weight="fill" />
          Contrate uma competição de cortes
        </Link>

        <p className="text-muted-foreground/60 mt-8 text-center text-xs">
          © 2026 Clipfy. Todos os direitos reservados.
        </p>
      </div>
    </main>
  )
}
