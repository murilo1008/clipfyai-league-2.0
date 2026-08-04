"use client"

import * as React from "react"
import {
  ArrowCounterClockwise,
  Bell,
  ChatCircleText,
  CheckCircle,
  CircleNotch,
  DeviceMobile,
  DownloadSimple,
  EnvelopeSimple,
  Eye,
  FloppyDisk,
  GearSix,
  Globe,
  Info,
  LockSimple,
  MapPin,
  Monitor,
  Moon,
  Palette,
  Shield,
  SignOut,
  Sun,
  Translate,
  Trash,
  Warning,
} from "@phosphor-icons/react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { DarkScope } from "@/components/shared/dark-scope"
import { Reveal } from "@/components/shared/reveal"
import { Bone } from "@/components/shared/skeletons"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

/* ============================================================
   Blocos locais da página (identidade da marca)
   ============================================================ */

/** Card de seção: glass-card com chip de ícone e acento próprio. */
function SectionCard({
  icon,
  title,
  description,
  chipClass,
  children,
  className,
}: {
  icon: React.ReactNode
  title: string
  description: string
  chipClass: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "glass-card flex h-full flex-col overflow-hidden rounded-3xl",
        className,
      )}
    >
      <header className="border-border/60 flex items-center gap-3 border-b p-4 sm:p-5">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-10",
            chipClass,
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold tracking-tight sm:text-base">
            {title}
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm">
            {description}
          </p>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-3 p-4 sm:gap-4 sm:p-5">
        {children}
      </div>
    </section>
  )
}

/** Linha com ícone em chip + título/descrição + Switch. */
function SwitchRow({
  icon,
  chipClass,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  icon: React.ReactNode
  chipClass: string
  title: string
  description: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
}) {
  return (
    <div className="border-border/60 bg-muted/20 hover:bg-muted/35 flex items-center justify-between gap-2 rounded-2xl border p-2.5 transition-colors sm:p-3">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            chipClass,
          )}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold sm:text-sm">{title}</p>
          <p className="text-muted-foreground text-[10px] sm:text-xs">
            {description}
          </p>
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="cursor-pointer"
      />
    </div>
  )
}

/** Linha compacta (só título) + Switch. */
function MiniSwitchRow({
  title,
  checked,
  onCheckedChange,
  icon,
}: {
  title: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
  icon?: React.ReactNode
}) {
  return (
    <div className="bg-muted/30 hover:bg-muted/45 flex items-center justify-between gap-2 rounded-xl p-2 transition-colors sm:p-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
        {icon && (
          <span className="text-muted-foreground shrink-0">{icon}</span>
        )}
        <p className="text-xs font-medium sm:text-sm">{title}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="cursor-pointer"
      />
    </div>
  )
}

/** Hairline divisória (substitui o Separator dos cards do original). */
function Hairline() {
  return <div className="bg-border/60 h-px" />
}

export default function Settings() {
  // ===== Tema REAL (next-themes) — melhoria sobre o mock do original =====
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  // ===== States de configurações (sem endpoint — locais, como o original) =====
  const [language, setLanguage] = React.useState("pt-BR")
  const [timezone, setTimezone] = React.useState("America/Sao_Paulo")

  // Notificações
  const [emailNotifications, setEmailNotifications] = React.useState(true)
  const [pushNotifications, setPushNotifications] = React.useState(true)
  const [smsNotifications, setSmsNotifications] = React.useState(false)
  const [competitionUpdates, setCompetitionUpdates] = React.useState(true)
  const [rankingChanges, setRankingChanges] = React.useState(true)
  const [paymentNotifications, setPaymentNotifications] = React.useState(true)
  const [marketingEmails, setMarketingEmails] = React.useState(false)

  // Privacidade
  const [profileVisibility, setProfileVisibility] = React.useState("public")
  const [showEmail, setShowEmail] = React.useState(false)
  const [showPhone, setShowPhone] = React.useState(false)
  const [allowAnalytics, setAllowAnalytics] = React.useState(true)

  // Segurança
  const [twoFactorEnabled, setTwoFactorEnabled] = React.useState(false)
  const [sessionTimeout, setSessionTimeout] = React.useState("30")

  // Estados de loading e diálogos
  const [isSaving, setIsSaving] = React.useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)
  const [isExportDialogOpen, setIsExportDialogOpen] = React.useState(false)

  const handleSaveSettings = async () => {
    setIsSaving(true)
    try {
      // Simular salvamento
      await new Promise((resolve) => setTimeout(resolve, 1500))
      toast.success("Configurações salvas!", {
        description: "Suas preferências foram atualizadas com sucesso.",
      })
    } catch {
      toast.error("Erro ao salvar", {
        description: "Não foi possível salvar suas configurações.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetSettings = () => {
    // Reset para valores padrão
    setTheme("system")
    setLanguage("pt-BR")
    setTimezone("America/Sao_Paulo")
    setEmailNotifications(true)
    setPushNotifications(true)
    setSmsNotifications(false)
    setCompetitionUpdates(true)
    setRankingChanges(true)
    setPaymentNotifications(true)
    setMarketingEmails(false)
    setProfileVisibility("public")
    setShowEmail(false)
    setShowPhone(false)
    setAllowAnalytics(true)
    setTwoFactorEnabled(false)
    setSessionTimeout("30")

    toast.success("Configurações restauradas!", {
      description: "Todas as configurações foram restauradas aos valores padrão.",
    })
  }

  const handleExportData = () => {
    toast.success("Exportação iniciada!", {
      description: "Você receberá um email com seus dados em até 24 horas.",
    })
    setIsExportDialogOpen(false)
  }

  const handleDeleteAccount = () => {
    toast.error("Conta excluída", {
      description: "Sua conta será excluída permanentemente em 30 dias.",
    })
    setIsDeleteDialogOpen(false)
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:gap-6 sm:px-6 sm:py-8">
      {/* ===== Hero band compacto (sempre no dark da marca) ===== */}
      <DarkScope className="contents">
        <section className="animate-fade-in-up relative overflow-hidden rounded-3xl bg-[#050f1c] p-5 ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_18%,transparent)] sm:p-7">
          {/* Ambiente: glows + hairline da marca */}
          <span
            aria-hidden
            className="pointer-events-none absolute -top-20 -right-14 size-60 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_16%,transparent)] blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-12 size-60 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_11%,transparent)] blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-cyan)_60%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_40%,transparent)] to-transparent"
          />
          {/* Engrenagem-fantasma de ambiente */}
          <GearSix
            aria-hidden
            weight="duotone"
            className="text-brand-cyan/10 animate-float pointer-events-none absolute -right-6 -bottom-8 size-36 sm:-right-4 sm:size-44"
          />

          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] uppercase">
                <span className="bg-gradient-custom size-1.5 rounded-full" />
                Clipfy League · Preferências
              </span>
              <h1 className="text-gradient mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                Configurações
              </h1>
              <p className="text-muted-foreground mt-1.5 text-xs sm:text-sm">
                Personalize sua experiência na plataforma
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetSettings}
                className="h-9 cursor-pointer rounded-xl font-semibold"
              >
                <ArrowCounterClockwise className="size-4" weight="bold" />
                <span className="hidden sm:inline">Restaurar</span>
              </Button>
              <Button
                size="sm"
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="btn-gradient-auth h-9 cursor-pointer rounded-xl font-semibold"
              >
                {isSaving ? (
                  <>
                    <CircleNotch className="size-4 animate-spin" />
                    <span className="hidden sm:inline">Salvando...</span>
                  </>
                ) : (
                  <>
                    <FloppyDisk className="size-4" weight="fill" />
                    <span className="hidden sm:inline">Salvar</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </section>
      </DarkScope>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        {/* ===== Aparência ===== */}
        <Reveal immediate>
          <SectionCard
            icon={
              <Palette
                className="size-4.5 text-[#04222A] sm:size-5"
                weight="fill"
              />
            }
            chipClass="bg-gradient-custom"
            title="Aparência"
            description="Personalize a interface"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="theme" className="text-xs sm:text-sm">
                Tema
              </Label>
              {mounted ? (
                <Select value={theme ?? "system"} onValueChange={setTheme}>
                  <SelectTrigger
                    id="theme"
                    className="h-10 w-full cursor-pointer rounded-xl"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="dark">
                      <span className="flex items-center gap-2">
                        <Moon className="size-4" weight="duotone" />
                        <span>Escuro</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="light">
                      <span className="flex items-center gap-2">
                        <Sun className="size-4" weight="duotone" />
                        <span>Claro</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="system">
                      <span className="flex items-center gap-2">
                        <Monitor className="size-4" weight="duotone" />
                        <span>Sistema</span>
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Bone className="h-10 w-full rounded-xl" />
              )}
              <p className="text-muted-foreground text-xs">
                Escolha o tema da interface da plataforma
              </p>
            </div>

            <Hairline />

            <div className="flex flex-col gap-2">
              <Label htmlFor="language" className="text-xs sm:text-sm">
                Idioma
              </Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger
                  id="language"
                  className="h-10 w-full cursor-pointer rounded-xl"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="pt-BR">
                    <span className="flex items-center gap-2">
                      <Translate className="size-4" weight="duotone" />
                      <span>Português (BR)</span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="timezone" className="text-xs sm:text-sm">
                Fuso Horário
              </Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger
                  id="timezone"
                  className="h-10 w-full cursor-pointer rounded-xl"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="America/Sao_Paulo">
                    <span className="flex items-center gap-2">
                      <MapPin className="size-4" weight="duotone" />
                      <span>Brasília (GMT-3)</span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </SectionCard>
        </Reveal>

        {/* ===== Notificações ===== */}
        <Reveal immediate delayMs={80}>
          <SectionCard
            icon={
              <Bell
                className="size-4.5 text-sky-500 sm:size-5 dark:text-sky-400"
                weight="fill"
              />
            }
            chipClass="bg-sky-500/15"
            title="Notificações"
            description="Gerencie suas notificações"
          >
            <SwitchRow
              icon={
                <EnvelopeSimple
                  className="text-brand-cyan not-dark:text-primary size-4"
                  weight="fill"
                />
              }
              chipClass="bg-brand-cyan/15 not-dark:bg-primary/10"
              title="Email"
              description="Notificações por email"
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
            <SwitchRow
              icon={
                <Bell
                  className="size-4 text-violet-500 dark:text-violet-400"
                  weight="fill"
                />
              }
              chipClass="bg-violet-500/15"
              title="Push"
              description="Notificações no navegador"
              checked={pushNotifications}
              onCheckedChange={setPushNotifications}
            />
            <SwitchRow
              icon={
                <ChatCircleText
                  className="size-4 text-orange-500 dark:text-orange-400"
                  weight="fill"
                />
              }
              chipClass="bg-orange-500/15"
              title="SMS"
              description="Alertas por mensagem"
              checked={smsNotifications}
              onCheckedChange={setSmsNotifications}
            />

            <Hairline />

            <div className="flex flex-col gap-2 sm:gap-2.5">
              <Label className="text-xs font-semibold sm:text-sm">
                Tipos de Notificação
              </Label>
              <MiniSwitchRow
                title="Competições"
                checked={competitionUpdates}
                onCheckedChange={setCompetitionUpdates}
              />
              <MiniSwitchRow
                title="Rankings"
                checked={rankingChanges}
                onCheckedChange={setRankingChanges}
              />
              <MiniSwitchRow
                title="Pagamentos"
                checked={paymentNotifications}
                onCheckedChange={setPaymentNotifications}
              />
              <MiniSwitchRow
                title="Marketing"
                checked={marketingEmails}
                onCheckedChange={setMarketingEmails}
              />
            </div>
          </SectionCard>
        </Reveal>

        {/* ===== Privacidade ===== */}
        <Reveal immediate delayMs={160}>
          <SectionCard
            icon={
              <Eye
                className="size-4.5 text-violet-500 sm:size-5 dark:text-violet-400"
                weight="fill"
              />
            }
            chipClass="bg-violet-500/15"
            title="Privacidade"
            description="Controle sua privacidade"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-visibility" className="text-xs sm:text-sm">
                Visibilidade do Perfil
              </Label>
              <Select
                value={profileVisibility}
                onValueChange={setProfileVisibility}
              >
                <SelectTrigger
                  id="profile-visibility"
                  className="h-10 w-full cursor-pointer rounded-xl"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="public">
                    <span className="flex items-center gap-2">
                      <Globe className="size-4" weight="duotone" />
                      <span>Público</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="private">
                    <span className="flex items-center gap-2">
                      <LockSimple className="size-4" weight="duotone" />
                      <span>Privado</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="friends">
                    <span className="flex items-center gap-2">
                      <Shield className="size-4" weight="duotone" />
                      <span>Apenas Amigos</span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Hairline />

            <div className="flex flex-col gap-2 sm:gap-2.5">
              <Label className="text-xs font-semibold sm:text-sm">
                Informações Visíveis
              </Label>
              <MiniSwitchRow
                icon={<EnvelopeSimple className="size-4" />}
                title="Mostrar Email"
                checked={showEmail}
                onCheckedChange={setShowEmail}
              />
              <MiniSwitchRow
                icon={<DeviceMobile className="size-4" />}
                title="Mostrar Telefone"
                checked={showPhone}
                onCheckedChange={setShowPhone}
              />
              <MiniSwitchRow
                icon={<Info className="size-4" />}
                title="Permitir Analytics"
                checked={allowAnalytics}
                onCheckedChange={setAllowAnalytics}
              />
            </div>
          </SectionCard>
        </Reveal>

        {/* ===== Segurança ===== */}
        <Reveal immediate delayMs={240}>
          <SectionCard
            icon={
              <Shield
                className="size-4.5 text-amber-500 sm:size-5 dark:text-amber-400"
                weight="fill"
              />
            }
            chipClass="bg-amber-500/15"
            title="Segurança"
            description="Proteja sua conta"
          >
            <div className="border-border/60 bg-muted/20 flex items-center justify-between gap-2 rounded-2xl border p-3 sm:p-4">
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
                  <LockSimple
                    className="size-4.5 text-emerald-500 dark:text-emerald-400"
                    weight="fill"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold sm:text-sm">
                    Autenticação de 2 Fatores
                  </p>
                  <p className="text-muted-foreground text-[10px] sm:text-xs">
                    Proteção adicional para sua conta
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {twoFactorEnabled && (
                  <Badge
                    variant="outline"
                    className="hidden gap-1 rounded-full border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-600 sm:inline-flex dark:text-emerald-400"
                  >
                    <CheckCircle className="size-3" weight="fill" />
                    Ativo
                  </Badge>
                )}
                <Switch
                  checked={twoFactorEnabled}
                  onCheckedChange={setTwoFactorEnabled}
                  className="cursor-pointer"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="session-timeout" className="text-xs sm:text-sm">
                Timeout da Sessão
              </Label>
              <Select value={sessionTimeout} onValueChange={setSessionTimeout}>
                <SelectTrigger
                  id="session-timeout"
                  className="h-10 w-full cursor-pointer rounded-xl"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                  <SelectItem value="120">2 horas</SelectItem>
                  <SelectItem value="never">Nunca</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Tempo de inatividade antes de desconectar
              </p>
            </div>

            <Hairline />

            <div className="flex flex-col gap-2 sm:gap-2.5">
              <Label className="text-xs font-semibold sm:text-sm">
                Sessões Ativas
              </Label>

              <div className="border-border/60 bg-muted/20 flex items-center justify-between gap-2 rounded-2xl border p-2.5 sm:p-3">
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                  <Monitor
                    className="text-brand-cyan not-dark:text-primary size-4.5 shrink-0 sm:size-5"
                    weight="duotone"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold sm:text-sm">
                      Chrome - Windows
                    </p>
                    <p className="text-muted-foreground text-[10px] sm:text-xs">
                      Ativo agora
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="shrink-0 rounded-full border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400"
                >
                  Atual
                </Badge>
              </div>

              <div className="border-border/60 bg-muted/20 flex items-center justify-between gap-2 rounded-2xl border p-2.5 sm:p-3">
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                  <DeviceMobile
                    className="text-muted-foreground size-4.5 shrink-0 sm:size-5"
                    weight="duotone"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold sm:text-sm">
                      Safari - iPhone
                    </p>
                    <p className="text-muted-foreground text-[10px] sm:text-xs">
                      Há 2 horas
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Encerrar sessão"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 size-8 shrink-0 cursor-pointer rounded-lg"
                >
                  <SignOut className="size-4" weight="bold" />
                </Button>
              </div>
            </div>
          </SectionCard>
        </Reveal>
      </div>

      {/* ===== Zona de Perigo ===== */}
      <Reveal immediate delayMs={320}>
        <section className="glass-card relative overflow-hidden rounded-3xl ring-1 ring-red-500/25">
          <span
            aria-hidden
            className="pointer-events-none absolute -top-16 -right-12 size-44 rounded-full bg-red-500/10 blur-3xl"
          />
          <header className="border-border/60 relative flex items-center gap-3 border-b p-4 sm:p-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-red-500/15 sm:size-10">
              <Warning
                className="size-4.5 text-red-500 sm:size-5 dark:text-red-400"
                weight="fill"
              />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold tracking-tight sm:text-base">
                Zona de Perigo
              </h2>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Ações irreversíveis
              </p>
            </div>
          </header>

          <div className="relative grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:gap-4 sm:p-5">
            <div className="flex flex-col gap-3 rounded-2xl border border-orange-500/25 bg-orange-500/5 p-3 sm:p-4">
              <div className="flex items-start gap-2.5 sm:gap-3">
                <DownloadSimple
                  className="mt-0.5 size-4.5 shrink-0 text-orange-500 sm:size-5 dark:text-orange-400"
                  weight="bold"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs font-bold sm:text-sm">
                    Exportar Dados
                  </h3>
                  <p className="text-muted-foreground mt-0.5 text-[10px] sm:mt-1 sm:text-xs">
                    Baixe todos os seus dados da plataforma
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExportDialogOpen(true)}
                className="mt-auto h-9 w-full cursor-pointer rounded-xl border-orange-500/30 text-xs font-semibold text-orange-600 hover:bg-orange-500/10 hover:text-orange-600 sm:text-sm dark:text-orange-400 dark:hover:text-orange-400"
              >
                <DownloadSimple className="size-4" weight="bold" />
                Exportar
              </Button>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-red-500/25 bg-red-500/5 p-3 sm:p-4">
              <div className="flex items-start gap-2.5 sm:gap-3">
                <Trash
                  className="mt-0.5 size-4.5 shrink-0 text-red-500 sm:size-5 dark:text-red-400"
                  weight="bold"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs font-bold sm:text-sm">
                    Excluir Conta
                  </h3>
                  <p className="text-muted-foreground mt-0.5 text-[10px] sm:mt-1 sm:text-xs">
                    Remova permanentemente sua conta
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="mt-auto h-9 w-full cursor-pointer rounded-xl border-red-500/30 text-xs font-semibold text-red-500 hover:bg-red-500/10 hover:text-red-500 sm:text-sm"
              >
                <Trash className="size-4" weight="bold" />
                Excluir
              </Button>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ===== Dialog: Exportar Dados ===== */}
      <AlertDialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <AlertDialogContent className="max-w-md rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/15">
                <DownloadSimple
                  className="size-4.5 text-orange-500 dark:text-orange-400"
                  weight="bold"
                />
              </span>
              Exportar Dados
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você receberá um arquivo com todos os seus dados (perfil,
              competições, posts, transações) em até 24 horas no seu email
              cadastrado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer rounded-xl">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExportData}
              className="cursor-pointer rounded-xl bg-orange-500 text-white hover:bg-orange-600"
            >
              <DownloadSimple className="size-4" weight="bold" />
              Confirmar Exportação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== Dialog: Excluir Conta ===== */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-red-500/15">
                <Warning
                  className="size-4.5 text-red-500 dark:text-red-400"
                  weight="fill"
                />
              </span>
              Excluir Conta
            </AlertDialogTitle>
            <AlertDialogDescription className="text-destructive font-semibold">
              Esta ação não pode ser desfeita!
            </AlertDialogDescription>
            <div className="text-muted-foreground space-y-2 text-sm">
              <p>Ao excluir sua conta, você perderá permanentemente:</p>
              <ul className="list-inside list-disc space-y-1 text-xs">
                <li>Todos os seus dados pessoais</li>
                <li>Histórico de competições e posts</li>
                <li>Rankings e conquistas</li>
                <li>Saldo pendente na carteira</li>
              </ul>
              <p className="text-xs font-medium">
                Você terá 30 dias para cancelar esta ação antes da exclusão
                permanente.
              </p>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer rounded-xl">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer rounded-xl"
            >
              <Trash className="size-4" weight="bold" />
              Excluir Conta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
