"use client"

import * as React from "react"
import {
  ArrowSquareOut,
  ChatText,
  CheckCircle,
  CircleNotch,
  Gavel,
  Info,
  PaperPlaneTilt,
  ShieldCheck,
  ShieldWarning,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { DisciplineBanner } from "@/components/clippers/discipline-banner"
import { SanctionList } from "@/components/clippers/discipline-sanction-list"
import {
  InfractionTypeBadge,
  SEVERE_DESCRIPTION,
  WarningStatusBadge,
  formatBrtDateTime,
  levelDescription,
  sanctionState,
  useNow,
} from "@/components/clippers/discipline-shared"
import { HomeHero } from "@/components/home/home-hero"
import { Reveal } from "@/components/shared/reveal"
import { Bone } from "@/components/shared/skeletons"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MAX_WARNING_LEVEL } from "@/lib/clipper-discipline/constants"
import { warningLevelLabel } from "@/lib/clipper-discipline/levels"
import { DEFAULT_DISCIPLINE_SETTINGS } from "@/lib/clipper-discipline/settings"
import { cn } from "@/lib/utils"
import { api, type RouterOutputs } from "@/trpc/react"

type MyWarning =
  RouterOutputs["clipperDiscipline"]["myWarnings"]["warnings"][number]

const DEFENSE_MIN_LENGTH = 10
const DEFENSE_MAX_LENGTH = 5000
const LEVELS = Array.from({ length: MAX_WARNING_LEVEL + 1 }, (_, level) => level)

export default function MyWarnings() {
  const now = useNow(30_000)
  const { data: userData, isLoading: isLoadingUser } =
    api.user.getCurrentUser.useQuery()
  const isClipper = userData?.role === "CLIPPER"
  const { data, isLoading } = api.clipperDiscipline.myWarnings.useQuery(
    undefined,
    { enabled: isClipper },
  )

  if (!isLoadingUser && userData && !isClipper) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 py-6 sm:px-6 sm:py-8">
        <div className="glass-card flex flex-col items-center gap-4 rounded-3xl py-20 text-center">
          <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
            <ShieldWarning className="size-6" weight="fill" />
          </span>
          <div className="px-4">
            <p className="text-base font-bold">Área exclusiva para clipadores</p>
            <p className="text-muted-foreground mt-1 text-sm">
              As advertências ficam disponíveis apenas para contas de
              clipador.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const warnings = data?.warnings ?? []
  const sanctions = data?.sanctions ?? []
  const activeCount = warnings.filter(
    (warning) => warning.effectiveStatus === "ACTIVE",
  ).length
  const activeSanctions = [
    ...warnings.flatMap((warning) => warning.sanctions),
    ...sanctions,
  ].filter((sanction) => sanctionState(sanction, now) === "active").length
  const loading = isLoadingUser || (isClipper && isLoading)

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <HomeHero
        eyebrow="Clipfy League · Advertências"
        title={
          <>
            Minhas <span className="text-gradient">advertências</span>
          </>
        }
        subtitle="Veja as advertências e punições da sua conta, o motivo de cada uma e envie sua defesa para a equipe analisar."
        isLoading={loading}
        stats={[
          {
            icon: <ShieldWarning className="size-3.5" weight="fill" />,
            label: "Ativas",
            value: activeCount,
            kind: "int",
          },
          {
            icon: <Gavel className="size-3.5" weight="fill" />,
            label: "Punições em vigor",
            value: activeSanctions,
            kind: "int",
          },
          {
            icon: <ChatText className="size-3.5" weight="fill" />,
            label: "Advertências no histórico",
            value: warnings.length,
            kind: "int",
          },
        ]}
      />

      <DisciplineBanner showLink={false} />

      <Reveal immediate>
        <HowItWorks />
      </Reveal>

      {/* ===== Advertências ===== */}
      <Reveal immediate delayMs={60}>
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">Advertências</h2>
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <Bone
                  key={index}
                  delay={index * 100}
                  className="h-48 w-full rounded-3xl"
                />
              ))}
            </div>
          ) : warnings.length === 0 ? (
            <div className="glass-card flex flex-col items-center gap-3 rounded-3xl py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="size-6" weight="fill" />
              </span>
              <div className="px-4">
                <p className="text-sm font-bold">Nenhuma advertência</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Continue seguindo as regras das competições.
                </p>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {warnings.map((warning) => (
                <WarningCard key={warning.id} warning={warning} now={now} />
              ))}
            </ul>
          )}
        </section>
      </Reveal>

      {/* ===== Punições avulsas ===== */}
      {sanctions.length > 0 && (
        <Reveal immediate delayMs={120}>
          <section className="glass-card flex flex-col gap-3 rounded-3xl p-4 sm:p-6">
            <div>
              <h2 className="text-lg font-bold">Outras punições</h2>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Punições aplicadas pela equipe fora da escala de advertências.
              </p>
            </div>
            <SanctionList
              sanctions={sanctions}
              now={now}
              linkedToWarning={false}
              showReason
            />
          </section>
        </Reveal>
      )}
    </div>
  )
}

function HowItWorks() {
  return (
    <section className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
      <div className="flex items-start gap-2.5">
        <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
          <Info className="size-4" weight="bold" />
        </span>
        <div>
          <h2 className="text-base font-bold">Como funcionam as advertências</h2>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Infrações leves e médias seguem uma escala: cada nova infração com
            advertências ativas sobe um nível.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ol className="flex flex-col gap-1.5">
          {LEVELS.map((level) => {
            const label = warningLevelLabel("LIGHT", level)
            // "Aviso formal: …" já começa pelo rótulo; não repete.
            const description = levelDescription(
              level,
              DEFAULT_DISCIPLINE_SETTINGS,
            ).replace(`${label}: `, "")
            return (
              <li key={level} className="flex items-start gap-2.5 text-sm">
                <span className="bg-muted text-muted-foreground mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
                  {level}
                </span>
                <span>
                  <span className="font-semibold">{label}:</span>{" "}
                  <span className="text-muted-foreground">{description}</span>
                </span>
              </li>
            )
          })}
        </ol>
        <ul className="text-muted-foreground flex flex-col gap-2 text-sm">
          <li>
            <span className="text-foreground font-semibold">
              Infração grave:
            </span>{" "}
            {SEVERE_DESCRIPTION.toLowerCase()} pela equipe.
          </li>
          <li>
            <span className="text-foreground font-semibold">Expiração:</span>{" "}
            as advertências ativas expiram após um período sem novas infrações
            (60 dias por padrão). Cada nova infração renova esse prazo.
          </li>
          <li>
            <span className="text-foreground font-semibold">Defesa:</span> você
            pode enviar uma defesa por advertência. A equipe analisa e pode
            revogá-la, desfazendo as punições.
          </li>
          <li className="text-xs">
            Durações e redutor mostrados com os valores padrão; a equipe pode
            ajustá-los.
          </li>
        </ul>
      </div>
    </section>
  )
}

function WarningCard({ warning, now }: { warning: MyWarning; now: Date }) {
  const levelLabel = warningLevelLabel(warning.infractionType, warning.level)
  return (
    <li
      className={cn(
        "glass-card flex flex-col gap-3 rounded-3xl p-4 sm:p-5",
        warning.effectiveStatus === "ACTIVE" && "ring-1 ring-red-500/25",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <ShieldWarning
              className={cn(
                "size-4.5",
                warning.effectiveStatus === "ACTIVE"
                  ? "text-red-500"
                  : "text-muted-foreground",
              )}
              weight="fill"
            />
            <span className="text-base font-bold">{levelLabel}</span>
            <InfractionTypeBadge type={warning.infractionType} />
            <WarningStatusBadge status={warning.effectiveStatus} />
          </div>
          <p className="text-muted-foreground text-xs">
            {warning.campaign?.name ?? "Sem competição"} · aplicada em{" "}
            {formatBrtDateTime(warning.appliedAt)}
            {warning.effectiveStatus === "ACTIVE" &&
              ` · expira em ${formatBrtDateTime(warning.expiresAt)}`}
          </p>
        </div>
      </div>

      {warning.status === "REVOKED" && (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle className="mt-0.5 size-4 shrink-0" weight="fill" />
          <span>
            Revogada pela equipe
            {warning.revokedAt
              ? ` em ${formatBrtDateTime(warning.revokedAt)}`
              : ""}
            {warning.revokeReason ? ` — ${warning.revokeReason}` : ""}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
          Motivo
        </p>
        <p className="text-sm whitespace-pre-wrap">{warning.reason}</p>
      </div>

      {warning.videoUrl && (
        <a
          href={warning.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary inline-flex max-w-full items-center gap-1.5 text-xs font-medium break-all underline-offset-4 hover:underline"
        >
          <ArrowSquareOut className="size-3.5 shrink-0" />
          {warning.videoUrl}
        </a>
      )}

      <div className="flex flex-col gap-1.5">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
          Punições
        </p>
        <SanctionList
          sanctions={warning.sanctions}
          now={now}
          linkedToWarning
          emptyText="Sem punições além do registro."
        />
      </div>

      {warning.defenseText ? (
        <div className="border-border/60 bg-muted/20 flex flex-col gap-1 rounded-2xl border px-3.5 py-3">
          <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase">
            <ChatText className="size-3.5" />
            Sua defesa
          </p>
          <p className="text-sm whitespace-pre-wrap">{warning.defenseText}</p>
          {warning.defenseSubmittedAt && (
            <p className="text-muted-foreground text-xs">
              Enviada em {formatBrtDateTime(warning.defenseSubmittedAt)}
            </p>
          )}
        </div>
      ) : warning.status !== "REVOKED" ? (
        <DefenseForm warningId={warning.id} />
      ) : null}
    </li>
  )
}

function DefenseForm({ warningId }: { warningId: string }) {
  const utils = api.useUtils()
  const [text, setText] = React.useState("")
  const trimmedLength = text.trim().length

  const submitMutation = api.clipperDiscipline.submitDefense.useMutation({
    onSuccess: () => {
      toast.success("Defesa enviada", {
        description: "A equipe vai analisar e você será avisado.",
      })
      void utils.clipperDiscipline.myWarnings.invalidate()
    },
    onError: (error) => toast.error(error.message || "Erro ao enviar defesa"),
  })

  const handleSubmit = () => {
    if (trimmedLength < DEFENSE_MIN_LENGTH) {
      toast.error(
        `Escreva sua defesa com pelo menos ${DEFENSE_MIN_LENGTH} caracteres`,
      )
      return
    }
    submitMutation.mutate({ warningId, text: text.trim() })
  }

  const fieldId = `defense-${warningId}`
  return (
    <div className="border-border/60 bg-muted/10 flex flex-col gap-2 rounded-2xl border p-3.5">
      <Label htmlFor={fieldId} className="text-sm font-bold">
        Enviar defesa
      </Label>
      <Textarea
        id={fieldId}
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={DEFENSE_MAX_LENGTH}
        rows={3}
        placeholder="Explique o que aconteceu. Se tiver, inclua links de provas (ex.: print da legenda com a hashtag)."
        className="rounded-xl"
        disabled={submitMutation.isPending}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-[11px]">
          {text.length}/{DEFENSE_MAX_LENGTH} · só é possível enviar uma defesa
          por advertência
        </p>
        <Button
          size="sm"
          className="btn-gradient-auth h-9 cursor-pointer rounded-xl font-semibold"
          onClick={handleSubmit}
          disabled={
            submitMutation.isPending || trimmedLength < DEFENSE_MIN_LENGTH
          }
        >
          {submitMutation.isPending ? (
            <>
              <CircleNotch className="size-4 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <PaperPlaneTilt className="size-4" weight="fill" />
              Enviar defesa
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
