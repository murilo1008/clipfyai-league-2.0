"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import {
  ArrowRight,
  CircleNotch,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  Lightning,
  LockSimple,
  Phone,
  User,
} from "@phosphor-icons/react"

import { DashboardBackground } from "@/components/dashboard-background"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { useSignUpForm } from "./use-sign-up-form"

function SignUpForm() {
  const searchParams = useSearchParams()
  const slugParam = searchParams.get("slug")
  // `?ref=` é o código de afiliado gerado em /affiliates
  const refParam = searchParams.get("ref")

  const form = useSignUpForm(slugParam, refParam)

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-10">
      <DashboardBackground />

      <div className="animate-fade-in-up flex w-full max-w-[95%] flex-col items-center sm:max-w-xl md:max-w-2xl">
        {/* Logo + tagline */}
        <Link href="/" aria-label="Clipfy League" className="group">
          <Logo
            width={176}
            height={44}
            className="h-11 w-auto dark:drop-shadow-[0_0_24px_rgba(20,247,254,0.3)] transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </Link>
        <p className="text-muted-foreground mt-3 text-center text-sm">
          Participe de competições de cortes
        </p>

        {/* Card */}
        <div className="glass-card mt-8 w-full rounded-3xl p-6 sm:p-8">
          <div className="mb-7 text-center">
            <h1 className="text-2xl font-bold tracking-tight sm:text-[1.7rem]">
              Clipador{" "}
              <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
                Crie sua conta
              </span>
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Junte-se à arena de competições
            </p>
          </div>

          <form onSubmit={form.handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Nome completo</Label>
              <div className="relative">
                <User className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2" />
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Seu nome completo"
                  value={form.name}
                  onChange={(e) => form.setName(e.target.value)}
                  disabled={form.isLoading}
                  className="focus-visible:ring-brand-cyan/40 h-12 rounded-xl pl-10.5"
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <EnvelopeSimple className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="seu@email.com"
                    value={form.email}
                    onChange={(e) => form.setEmail(e.target.value)}
                    disabled={form.isLoading}
                    className="focus-visible:ring-brand-cyan/40 h-12 rounded-xl pl-10.5"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">Telefone</Label>
                <div className="relative">
                  <Phone className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2" />
                  <Input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    maxLength={15}
                    placeholder="(11) 99999-9999"
                    value={form.phone}
                    onChange={(e) => form.handlePhoneChange(e.target.value)}
                    disabled={form.isLoading}
                    className="focus-visible:ring-brand-cyan/40 h-12 rounded-xl pl-10.5"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <LockSimple className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2" />
                  <Input
                    id="password"
                    type={form.showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => form.setPassword(e.target.value)}
                    disabled={form.isLoading}
                    className="focus-visible:ring-brand-cyan/40 h-12 rounded-xl pr-11 pl-10.5"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={form.showPassword ? "Ocultar senha" : "Mostrar senha"}
                    onClick={() => form.setShowPassword(!form.showPassword)}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3.5 -translate-y-1/2 transition-colors"
                  >
                    {form.showPassword ? (
                      <EyeSlash className="size-4.5" />
                    ) : (
                      <Eye className="size-4.5" />
                    )}
                  </button>
                </div>
                <p className="text-muted-foreground/70 text-xs">
                  Mínimo de 8 caracteres
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <div className="relative">
                  <LockSimple className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2" />
                  <Input
                    id="confirmPassword"
                    type={form.showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={form.confirmPassword}
                    onChange={(e) => form.setConfirmPassword(e.target.value)}
                    disabled={form.isLoading}
                    className="focus-visible:ring-brand-cyan/40 h-12 rounded-xl pr-11 pl-10.5"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={
                      form.showConfirmPassword ? "Ocultar senha" : "Mostrar senha"
                    }
                    onClick={() =>
                      form.setShowConfirmPassword(!form.showConfirmPassword)
                    }
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3.5 -translate-y-1/2 transition-colors"
                  >
                    {form.showConfirmPassword ? (
                      <EyeSlash className="size-4.5" />
                    ) : (
                      <Eye className="size-4.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={form.isLoading}
              className="btn-gradient-auth mt-1 h-12 w-full rounded-xl text-[0.95rem] font-semibold shadow-[0_8px_30px_-8px_rgba(20,247,254,0.45)] transition-all hover:shadow-[0_10px_36px_-8px_rgba(55,250,156,0.5)]"
            >
              {form.isLoading ? (
                <CircleNotch className="size-5 animate-spin" />
              ) : (
                <>
                  Criar conta Clipador
                  <ArrowRight className="size-4.5" weight="bold" />
                </>
              )}
            </Button>
          </form>

          <p className="text-muted-foreground mt-6 text-center text-sm">
            Já tem uma conta?{" "}
            <Link
              href="/sign-in"
              className="text-brand-cyan not-dark:text-primary font-medium transition-opacity hover:opacity-80"
            >
              Fazer login
            </Link>
          </p>
        </div>

        {/* CTA comercial */}
        <Link
          href="/interest-list"
          className="glass text-muted-foreground hover:text-foreground hover:border-brand-cyan/30 mt-6 flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors"
        >
          <Lightning
            className="text-brand-mint not-dark:text-emerald-600 size-4"
            weight="fill"
          />
          Contrate uma competição de cortes
        </Link>

        <p className="text-muted-foreground/60 mt-8 text-center text-xs">
          © 2026 Clipfy. Todos os direitos reservados.
        </p>
      </div>
    </main>
  )
}

export default function SignUp() {
  return (
    <React.Suspense fallback={null}>
      <SignUpForm />
    </React.Suspense>
  )
}
