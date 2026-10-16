"use client"

import * as React from "react"
import { CircleNotch, GearSix } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Bone } from "@/components/shared/skeletons"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatScoreMultiplier } from "@/lib/clipper-discipline/score-multiplier"
import type { DisciplineSettings } from "@/lib/clipper-discipline/settings"
import { api } from "@/trpc/react"

/** Valores da escala editáveis no painel (getSettings / updateSettings). */
export function DisciplineSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GearSix className="size-5" weight="fill" />
            Configurações das advertências
          </DialogTitle>
          <DialogDescription>
            Valem para as próximas advertências; as já aplicadas guardam os
            valores do momento em que foram aplicadas.
          </DialogDescription>
        </DialogHeader>
        {open && <SettingsForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

type FormValues = {
  level1SuspensionHours: string
  level2SuspensionHours: string
  level2ScoreMultiplierPercent: string
  level2ScoreMultiplierDays: string
  warningExpiryDays: string
}

function toForm(settings: DisciplineSettings): FormValues {
  return {
    level1SuspensionHours: String(settings.level1SuspensionHours),
    level2SuspensionHours: String(settings.level2SuspensionHours),
    level2ScoreMultiplierPercent: (settings.level2ScoreMultiplierBps / 100)
      .toLocaleString("pt-BR", { maximumFractionDigits: 2 }),
    level2ScoreMultiplierDays: String(settings.level2ScoreMultiplierDays),
    warningExpiryDays: String(settings.warningExpiryDays),
  }
}

/** Inteiro dentro do intervalo, ou null. */
function parseIntInRange(value: string, min: number, max: number) {
  const parsed = Number(value.trim())
  return Number.isInteger(parsed) && parsed >= min && parsed <= max
    ? parsed
    : null
}

function SettingsForm({ onDone }: { onDone: () => void }) {
  const utils = api.useUtils()
  const { data: settings, isLoading } =
    api.clipperDiscipline.getSettings.useQuery()
  const [values, setValues] = React.useState<FormValues | null>(null)

  // Preenche o formulário uma vez, quando os valores chegam.
  const form = values ?? (settings ? toForm(settings) : null)
  const update = (key: keyof FormValues, value: string) => {
    if (!form) return
    setValues({ ...form, [key]: value })
  }

  const saveMutation = api.clipperDiscipline.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Configurações salvas")
      void utils.clipperDiscipline.getSettings.invalidate()
      void utils.clipperDiscipline.applyContext.invalidate()
      onDone()
    },
    onError: (error) =>
      toast.error(error.message || "Erro ao salvar configurações"),
  })

  if (isLoading || !form) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Bone key={index} delay={index * 60} className="h-10 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  const percent = Number(form.level2ScoreMultiplierPercent.replace(",", "."))
  const bps = Math.round(percent * 100)
  const percentValid = Number.isFinite(percent) && bps >= 100 && bps <= 9999

  const handleSave = () => {
    const level1SuspensionHours = parseIntInRange(form.level1SuspensionHours, 1, 24 * 90)
    const level2SuspensionHours = parseIntInRange(form.level2SuspensionHours, 1, 24 * 90)
    const level2ScoreMultiplierDays = parseIntInRange(form.level2ScoreMultiplierDays, 1, 365)
    const warningExpiryDays = parseIntInRange(form.warningExpiryDays, 1, 730)
    if (level1SuspensionHours === null || level2SuspensionHours === null) {
      toast.error("As suspensões precisam ser horas inteiras entre 1 e 2160")
      return
    }
    if (!percentValid) {
      toast.error("O redutor precisa ficar entre 1% e 99,99%")
      return
    }
    if (level2ScoreMultiplierDays === null) {
      toast.error("A duração do redutor precisa ficar entre 1 e 365 dias")
      return
    }
    if (warningExpiryDays === null) {
      toast.error("A expiração precisa ficar entre 1 e 730 dias")
      return
    }
    saveMutation.mutate({
      level1SuspensionHours,
      level2SuspensionHours,
      level2ScoreMultiplierBps: bps,
      level2ScoreMultiplierDays,
      warningExpiryDays,
    })
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SettingField
          id="settings-level1-hours"
          label="Suspensão do nível 1 (horas)"
          value={form.level1SuspensionHours}
          onChange={(value) => update("level1SuspensionHours", value)}
          hint="Padrão: 24 h"
        />
        <SettingField
          id="settings-level2-hours"
          label="Suspensão do nível 2 (horas)"
          value={form.level2SuspensionHours}
          onChange={(value) => update("level2SuspensionHours", value)}
          hint="Padrão: 72 h"
        />
        <SettingField
          id="settings-level2-percent"
          label="Redutor do nível 2 (% mantido)"
          value={form.level2ScoreMultiplierPercent}
          onChange={(value) => update("level2ScoreMultiplierPercent", value)}
          inputMode="decimal"
          hint={
            percentValid
              ? `${formatScoreMultiplier(bps)} na pontuação · padrão: 80%`
              : "Entre 1% e 99,99%"
          }
          invalid={!percentValid}
        />
        <SettingField
          id="settings-level2-days"
          label="Duração do redutor (dias)"
          value={form.level2ScoreMultiplierDays}
          onChange={(value) => update("level2ScoreMultiplierDays", value)}
          hint="Padrão: 7 dias"
        />
        <SettingField
          id="settings-expiry-days"
          label="Expiração das advertências (dias)"
          value={form.warningExpiryDays}
          onChange={(value) => update("warningExpiryDays", value)}
          hint="Sem nova infração nesse período, as ativas expiram. Padrão: 60"
          className="sm:col-span-2"
        />
      </div>
      <DialogFooter className="gap-2">
        <Button
          variant="outline"
          className="cursor-pointer rounded-xl"
          onClick={onDone}
          disabled={saveMutation.isPending}
        >
          Cancelar
        </Button>
        <Button
          className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
          onClick={handleSave}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <>
              <CircleNotch className="size-4 animate-spin" />
              Salvando...
            </>
          ) : (
            "Salvar"
          )}
        </Button>
      </DialogFooter>
    </>
  )
}

function SettingField({
  id,
  label,
  value,
  onChange,
  hint,
  invalid,
  inputMode = "numeric",
  className,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  invalid?: boolean
  inputMode?: "numeric" | "decimal"
  className?: string
}) {
  return (
    <div className={className}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id} className="text-sm font-semibold">
          {label}
        </Label>
        <Input
          id={id}
          inputMode={inputMode}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid || undefined}
          className="h-10 rounded-xl"
        />
        {hint && (
          <p
            className={
              invalid ? "text-xs text-red-500" : "text-muted-foreground text-xs"
            }
          >
            {hint}
          </p>
        )}
      </div>
    </div>
  )
}
