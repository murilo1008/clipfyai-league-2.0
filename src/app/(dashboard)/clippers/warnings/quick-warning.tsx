"use client"

import * as React from "react"
import type { ClipperInfractionType } from "@prisma/client"
import { Info, ShieldWarning } from "@phosphor-icons/react"

import {
  SEVERE_DESCRIPTION,
  levelDescription,
} from "@/components/clippers/discipline-shared"
import { Bone } from "@/components/shared/skeletons"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { MAX_WARNING_LEVEL } from "@/lib/clipper-discipline/constants"
import {
  INFRACTION_TYPE_LABELS,
  warningLevelLabel,
} from "@/lib/clipper-discipline/levels"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

import { BAN_CONFIRMATION_WORD } from "./apply-warning-dialog"

const LEVELS = Array.from({ length: MAX_WARNING_LEVEL + 1 }, (_, level) => level)
const INFRACTION_TYPES = ["LIGHT", "MEDIUM", "SEVERE"] as const

/** Campos da advertência que acompanham outra ação (ex.: desclassificar um vídeo). */
export type QuickWarningPayload = {
  infractionType: ClipperInfractionType
  level: number | null
  reason: string
  confirmBan?: boolean
}

/**
 * Estado do toggle "Aplicar advertência". O nível começa no sugerido para o
 * clipador e o admin pode trocar.
 */
export function useQuickWarning(clipperProfileId: string | null) {
  const [enabled, setEnabled] = React.useState(false)
  const [infractionType, setInfractionType] =
    React.useState<ClipperInfractionType>("LIGHT")
  /** null = segue a sugestão do sistema. */
  const [levelChoice, setLevelChoice] = React.useState<number | null>(null)
  const [reason, setReason] = React.useState("")
  const [banConfirmation, setBanConfirmation] = React.useState("")

  const context = api.clipperDiscipline.applyContext.useQuery(
    { clipperProfileId: clipperProfileId ?? "" },
    { enabled: enabled && !!clipperProfileId },
  )

  const isSevere = infractionType === "SEVERE"
  const suggestedLevel = context.data?.suggestedLevel ?? null
  const level = isSevere ? null : (levelChoice ?? suggestedLevel)
  const requiresBanConfirmation = !isSevere && level === MAX_WARNING_LEVEL
  const banConfirmed =
    banConfirmation.trim().toUpperCase() === BAN_CONFIRMATION_WORD

  const missing: string[] = []
  if (enabled) {
    if (!context.data) missing.push("os dados do clipador")
    if (reason.trim().length < 3) missing.push("a mensagem da advertência")
    if (requiresBanConfirmation && !banConfirmed) {
      missing.push(`a confirmação "${BAN_CONFIRMATION_WORD}"`)
    }
  }

  const payload: QuickWarningPayload | null =
    enabled && missing.length === 0 && (isSevere || level !== null)
      ? {
          infractionType,
          level,
          reason: reason.trim(),
          confirmBan: requiresBanConfirmation ? banConfirmed : undefined,
        }
      : null

  const reset = React.useCallback(() => {
    setEnabled(false)
    setInfractionType("LIGHT")
    setLevelChoice(null)
    setReason("")
    setBanConfirmation("")
  }, [])

  return {
    enabled,
    setEnabled,
    infractionType,
    setInfractionType,
    level,
    setLevelChoice,
    suggestedLevel,
    reason,
    setReason,
    banConfirmation,
    setBanConfirmation,
    requiresBanConfirmation,
    context,
    missing,
    payload,
    reset,
  }
}

export type QuickWarning = ReturnType<typeof useQuickWarning>

/** "Advertência 2 aplicada", "Aviso formal registrado"... para os toasts. */
export function quickWarningTitle(
  infractionType: ClipperInfractionType,
  level: number | null,
) {
  if (infractionType === "SEVERE") return "Infração grave registrada"
  return level === 0 ? "Aviso formal registrado" : `Advertência ${level} aplicada`
}

export function QuickWarningFields({
  quick,
  disabled,
  idPrefix,
  note,
  noteTone = "info",
}: {
  quick: QuickWarning
  disabled?: boolean
  /** Prefixo dos ids dos campos (vários dialogs na mesma tela). */
  idPrefix: string
  /** Explica o que a advertência muda na ação em que ela foi ligada. */
  note?: string
  noteTone?: "info" | "warning"
}) {
  const settings = quick.context.data?.settings
  const activeCount = quick.context.data?.activeCount ?? 0
  const isSevere = quick.infractionType === "SEVERE"

  return (
    <div className="border-border/60 flex flex-col gap-3 rounded-2xl border px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <Label
          htmlFor={`${idPrefix}-toggle`}
          className="flex cursor-pointer items-start gap-2.5"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-600 dark:text-red-400">
            <ShieldWarning className="size-4" weight="fill" />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-bold">Aplicar advertência</span>
            <span className="text-muted-foreground text-xs font-normal">
              O clipador recebe a mensagem por notificação e e-mail
            </span>
          </span>
        </Label>
        <Switch
          id={`${idPrefix}-toggle`}
          checked={quick.enabled}
          onCheckedChange={quick.setEnabled}
          disabled={disabled}
          className="mt-1 cursor-pointer"
        />
      </div>

      {quick.enabled &&
        (quick.context.isLoading ? (
          <div className="flex flex-col gap-2">
            <Bone className="h-10 w-full rounded-xl" />
            <Bone delay={80} className="h-20 w-full rounded-xl" />
          </div>
        ) : quick.context.isError || !settings ? (
          <p className="text-muted-foreground text-xs">
            Não foi possível carregar as advertências do clipador.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor={`${idPrefix}-type`}
                  className="text-muted-foreground text-xs font-medium"
                >
                  Tipo de infração
                </Label>
                <Select
                  value={quick.infractionType}
                  onValueChange={(value) =>
                    quick.setInfractionType(value as ClipperInfractionType)
                  }
                  disabled={disabled}
                >
                  <SelectTrigger
                    id={`${idPrefix}-type`}
                    className="h-10 w-full cursor-pointer rounded-xl"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {INFRACTION_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {INFRACTION_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!isSevere && (
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor={`${idPrefix}-level`}
                    className="text-muted-foreground text-xs font-medium"
                  >
                    Nível
                  </Label>
                  <Select
                    value={quick.level === null ? "" : String(quick.level)}
                    onValueChange={(value) => quick.setLevelChoice(Number(value))}
                    disabled={disabled}
                  >
                    <SelectTrigger
                      id={`${idPrefix}-level`}
                      className="h-10 w-full cursor-pointer rounded-xl"
                    >
                      <SelectValue placeholder="Escolha o nível" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {LEVELS.map((option) => (
                        <SelectItem key={option} value={String(option)}>
                          {warningLevelLabel("LIGHT", option)}
                          {option === quick.suggestedLevel ? " · sugerido" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {isSevere
                  ? SEVERE_DESCRIPTION
                  : quick.level !== null
                    ? levelDescription(quick.level, settings)
                    : ""}
                {" · "}
                {activeCount === 0
                  ? "nenhuma advertência ativa"
                  : `${activeCount} ${activeCount === 1 ? "advertência ativa" : "advertências ativas"}`}
              </span>
            </p>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor={`${idPrefix}-reason`}
                className="text-muted-foreground text-xs font-medium"
              >
                Mensagem para o clipador<span className="text-red-500">*</span>
              </Label>
              <Textarea
                id={`${idPrefix}-reason`}
                value={quick.reason}
                onChange={(event) => quick.setReason(event.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Ex.: vídeo sem a hashtag obrigatória #exemplo"
                className="rounded-xl text-sm"
                disabled={disabled}
              />
            </div>

            {quick.requiresBanConfirmation && (
              <div className="flex flex-col gap-1.5 rounded-xl border border-red-500/40 bg-red-500/10 p-3">
                <Label
                  htmlFor={`${idPrefix}-ban`}
                  className="text-xs font-bold text-red-700 dark:text-red-400"
                >
                  Digite {BAN_CONFIRMATION_WORD} para confirmar o banimento
                </Label>
                <Input
                  id={`${idPrefix}-ban`}
                  value={quick.banConfirmation}
                  onChange={(event) =>
                    quick.setBanConfirmation(event.target.value)
                  }
                  placeholder={BAN_CONFIRMATION_WORD}
                  autoComplete="off"
                  className="h-10 rounded-xl font-mono uppercase"
                  disabled={disabled}
                />
              </div>
            )}

            {quick.missing.length > 0 && (
              <p className="text-muted-foreground text-xs">
                Falta preencher: {quick.missing.join(", ")}.
              </p>
            )}

            {note && (
              <p
                className={cn(
                  "text-xs",
                  noteTone === "warning"
                    ? "rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-400"
                    : "text-muted-foreground",
                )}
              >
                {note}
              </p>
            )}
          </div>
        ))}
    </div>
  )
}
