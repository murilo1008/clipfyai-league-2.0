"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"

import {
  CalendarBlank,
  CheckCircle,
  CircleNotch,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  Lightning,
  LockSimple,
  Phone,
  ShieldCheck,
  Trophy,
  User,
} from "@phosphor-icons/react"

import { DashboardBackground } from "@/components/dashboard-background"
import { Logo } from "@/components/logo"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatPrizeLabel } from "@/lib/currency"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"

import { useSignUpForm } from "./use-sign-up-form"

interface CampaignData {
  name: string
  slug: string
  description: string | null
  coverImageUrl: string
  platforms: string[]
  prizeInfo: { totalPrize?: string | number } | null
  startDate: string
  endDate: string
  status: string
  clientName: string | null
  clientImageUrl: string | null
}

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso))

const formatPrize = (prize: string | number | undefined) => {
  if (prize === undefined || prize === null) return null
  if (typeof prize === "number") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(prize)
  }
  return formatPrizeLabel(prize) || null
}

/** Força da senha em 4 níveis (mesma régua da Clipfy League). */
const strengthColors = [
  "bg-red-500",
  "bg-amber-500",
  "bg-brand-cyan not-dark:bg-primary",
  "bg-brand-green not-dark:bg-[#0eb981]",
]

export default function SignUpCompetition({
  campaign,
  affiliateCode = null,
}: {
  campaign: CampaignData
  /** Código de afiliado vindo de `?ref=` — indicação do clipador. */
  affiliateCode?: string | null
}) {
  const form = useSignUpForm(campaign.slug, affiliateCode)
  const [imageLoaded, setImageLoaded] = React.useState(false)

  const prize = formatPrize(campaign.prizeInfo?.totalPrize ?? undefined)
  const passwordsMatch =
    form.confirmPassword.length > 0 && form.password === form.confirmPassword

  const competitionCard = (
    <div className="glass-card w-full rounded-2xl p-5">
      <div className="flex items-start gap-3.5">
        <span className="bg-gradient-custom flex size-11 shrink-0 items-center justify-center rounded-xl">
          <Trophy className="size-5.5 text-[#04222A]" weight="fill" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-brand-cyan not-dark:text-primary text-[11px] font-semibold tracking-[0.16em] uppercase">
            Convite Especial
          </p>
          <h2 className="mt-0.5 truncate text-lg font-bold">{campaign.name}</h2>
          {campaign.clientName && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <Avatar className="size-5">
                <AvatarImage
                  src={campaign.clientImageUrl ?? undefined}
                  alt={campaign.clientName}
                />
                <AvatarFallback className="text-[9px]">
                  {campaign.clientName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-muted-foreground truncate text-sm">
                {campaign.clientName}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="border-border/60 rounded-xl border p-3">
          <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] uppercase">
            <CalendarBlank className="size-3.5" /> Período
          </p>
          <p className="mt-1 text-sm font-medium">
            {formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}
          </p>
        </div>
        <div className="border-border/60 rounded-xl border p-3">
          <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] uppercase">
            <Trophy className="size-3.5" /> Premiação
          </p>
          <p className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4] mt-1 text-sm font-bold">
            {prize ?? "A divulgar"}
          </p>
        </div>
      </div>

      {campaign.platforms.length > 0 && (
        <div className="mt-3.5 flex flex-wrap gap-2">
          {campaign.platforms.map((platform) => {
            const config = platformConfig[platform as PlatformKey]
            if (!config) return null
            const PlatformIcon = config.icon
            return (
              <Badge
                key={platform}
                variant="outline"
                className={cn(
                  "gap-1.5 rounded-full px-2.5 py-1",
                  config.bgColor,
                  config.borderColor,
                  config.color,
                )}
              >
                <PlatformIcon className="size-3.5" />
                {config.label}
              </Badge>
            )
          })}
        </div>
      )}
    </div>
  )

  const renderForm = (prefix: string) => (
    <form onSubmit={form.handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefix}-name`}>Nome completo</Label>
        <div className="relative">
          <User className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2" />
          <Input
            id={`${prefix}-name`}
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
          <Label htmlFor={`${prefix}-email`}>Email</Label>
          <div className="relative">
            <EnvelopeSimple className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2" />
            <Input
              id={`${prefix}-email`}
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
          <Label htmlFor={`${prefix}-phone`}>Telefone</Label>
          <div className="relative">
            <Phone className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2" />
            <Input
              id={`${prefix}-phone`}
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

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefix}-password`}>Senha</Label>
        <div className="relative">
          <LockSimple className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2" />
          <Input
            id={`${prefix}-password`}
            type={form.showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Mínimo de 8 caracteres"
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
        {form.password.length > 0 && (
          <div className="mt-1 flex gap-1.5">
            {[1, 2, 3, 4].map((level) => (
              <span
                key={level}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-300",
                  form.password.length >= level * 3
                    ? strengthColors[level - 1]
                    : "bg-border",
                )}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefix}-confirmPassword`}>Confirmar senha</Label>
        <div className="relative">
          <LockSimple className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2" />
          <Input
            id={`${prefix}-confirmPassword`}
            type={form.showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Repita a senha"
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
            onClick={() => form.setShowConfirmPassword(!form.showConfirmPassword)}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3.5 -translate-y-1/2 transition-colors"
          >
            {form.showConfirmPassword ? (
              <EyeSlash className="size-4.5" />
            ) : (
              <Eye className="size-4.5" />
            )}
          </button>
        </div>
        {passwordsMatch && (
          <p className="text-brand-green not-dark:text-[#0eb981] flex items-center gap-1.5 text-xs">
            <CheckCircle className="size-3.5" weight="fill" /> Senhas coincidem
          </p>
        )}
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
            <Lightning className="size-4.5" weight="fill" />
            Criar conta e Competir
          </>
        )}
      </Button>

      <p className="text-muted-foreground/80 flex items-center justify-center gap-1.5 text-xs">
        <ShieldCheck
          className="text-brand-mint not-dark:text-emerald-600 size-4"
          weight="fill"
        />
        Seus dados estão protegidos com criptografia
      </p>
    </form>
  )

  const formColumn = (prefix: string) => (
    <div className="flex w-full flex-col items-center">
      <Link href="/" aria-label="Clipfy League">
        <Logo
          width={160}
          height={40}
          className="h-10 w-auto dark:drop-shadow-[0_0_24px_rgba(20,247,254,0.3)]"
        />
      </Link>

      <div className="mt-6 w-full">{competitionCard}</div>

      <div className="glass-card mt-5 w-full rounded-3xl p-6 sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Crie sua conta e{" "}
            <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
              participe
            </span>
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Cadastre-se para entrar nessa competição
          </p>
        </div>
        {renderForm(prefix)}
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

      <p className="text-muted-foreground/60 mt-8 pb-4 text-center text-xs">
        © 2026 Clipfy. Todos os direitos reservados.
      </p>
    </div>
  )

  return (
    <main className="bg-background relative min-h-svh">
      <DashboardBackground />
      {/* ===== Desktop: split screen ===== */}
      <div className="hidden lg:flex">
        {/* Capa fixa à esquerda */}
        <div className="fixed inset-y-0 left-0 w-1/2 overflow-hidden">
          {!imageLoaded && (
            <div className="absolute inset-0 animate-pulse bg-[#071321] motion-reduce:animate-none" />
          )}
          <Image
            src={campaign.coverImageUrl}
            alt={campaign.name}
            fill
            priority
            sizes="50vw"
            onLoad={() => setImageLoaded(true)}
            className={cn(
              "object-cover transition-opacity duration-700",
              imageLoaded ? "opacity-100" : "opacity-0",
            )}
          />
          {/* Overlay petróleo para fundir com o tema */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#030d18]/40 via-transparent to-[#030d18]" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#030d18]/90 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 p-10">
            <span className="bg-gradient-custom inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold tracking-[0.14em] text-[#04222A] uppercase">
              <Trophy className="size-3.5" weight="fill" /> Competição de cortes
            </span>
            <h2 className="mt-3 max-w-xl text-3xl font-bold text-white drop-shadow-lg">
              {campaign.name}
            </h2>
            {campaign.description && (
              <p className="mt-2 line-clamp-2 max-w-lg text-sm text-white/75">
                {campaign.description}
              </p>
            )}
          </div>
        </div>

        {/* Coluna do formulário (scrollável) */}
        <div className="relative ml-[50%] flex w-1/2 justify-center px-8 py-10 xl:px-14">
          <div className="w-full max-w-lg">{formColumn("d")}</div>
        </div>
      </div>

      {/* ===== Mobile: banner no topo ===== */}
      <div className="lg:hidden">
        <div className="relative h-52 w-full overflow-hidden sm:h-64">
          <Image
            src={campaign.coverImageUrl}
            alt={campaign.name}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#030d18] via-[#030d18]/35 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4">
            <span className="bg-gradient-custom inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.14em] text-[#04222A] uppercase">
              <Trophy className="size-3" weight="fill" /> Competição de cortes
            </span>
          </div>
        </div>
        <div className="relative flex justify-center px-4 pt-6">
          <div className="w-full max-w-lg">{formColumn("m")}</div>
        </div>
      </div>
    </main>
  )
}
