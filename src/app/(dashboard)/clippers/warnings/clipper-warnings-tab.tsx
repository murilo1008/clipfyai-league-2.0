"use client"

import * as React from "react"
import {
  ArrowCounterClockwise,
  ArrowSquareOut,
  Eye,
  Gavel,
  ShieldWarning,
} from "@phosphor-icons/react"

import {
  SanctionList,
  type SanctionListItem,
} from "@/components/clippers/discipline-sanction-list"
import {
  InfractionTypeBadge,
  RestrictionBadges,
  WarningStatusBadge,
  formatBrtDateTime,
  useNow,
} from "@/components/clippers/discipline-shared"
import { Bone } from "@/components/shared/skeletons"
import { Button } from "@/components/ui/button"
import { warningLevelLabel } from "@/lib/clipper-discipline/levels"
import { api } from "@/trpc/react"

import { ApplySanctionDialog } from "./apply-sanction-dialog"
import { ApplyWarningDialog } from "./apply-warning-dialog"
import { EndSanctionDialog, type EndSanctionTarget } from "./end-sanction-dialog"
import {
  RevokeWarningDialog,
  type RevokeWarningTarget,
} from "./revoke-warning-dialog"
import {
  BanReviewBadge,
  WarningDetailsDialog,
  revokeTargetOf,
  type AdminWarning,
} from "./warning-details-dialog"

/**
 * Aba "Advertências" do perfil do clipador: restrições em vigor, histórico
 * de advertências e punições avulsas, com as ações de aplicar e revogar.
 */
export function ClipperWarningsTab({
  clipperProfileId,
  clipperName,
}: {
  clipperProfileId: string
  clipperName: string
}) {
  const now = useNow(30_000)
  const { data, isLoading, isError } =
    api.clipperDiscipline.historyByClipper.useQuery({ clipperProfileId })

  const [isApplyOpen, setIsApplyOpen] = React.useState(false)
  const [isSanctionOpen, setIsSanctionOpen] = React.useState(false)
  const [detailsWarning, setDetailsWarning] =
    React.useState<AdminWarning | null>(null)
  const [revokeTarget, setRevokeTarget] =
    React.useState<RevokeWarningTarget | null>(null)
  const [endTarget, setEndTarget] = React.useState<EndSanctionTarget | null>(
    null,
  )

  const openEnd = (
    sanction: SanctionListItem,
    actionLabel: string,
    description: string,
  ) => setEndTarget({ id: sanction.id, type: sanction.type, actionLabel, description })

  const openRevoke = (warning: AdminWarning) => {
    setDetailsWarning(null)
    setRevokeTarget(revokeTargetOf(warning))
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Bone className="h-20 w-full rounded-2xl" />
        <Bone delay={80} className="h-32 w-full rounded-2xl" />
        <Bone delay={160} className="h-32 w-full rounded-2xl" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        Não foi possível carregar as advertências do clipador.
      </p>
    )
  }

  const activeCount = data.activeCount

  return (
    <div className="flex flex-col gap-4">
      {/* Restrições em vigor + ações */}
      <div className="border-border/60 bg-muted/20 flex flex-col gap-3 rounded-2xl border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm font-bold">Restrições em vigor</p>
            <p className="text-muted-foreground text-xs">
              {activeCount === 0
                ? "Nenhuma advertência ativa · próxima sugerida: aviso formal"
                : `${activeCount} ${activeCount === 1 ? "advertência ativa" : "advertências ativas"} · próxima sugerida: ${warningLevelLabel("LIGHT", data.suggestedLevel)}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 cursor-pointer rounded-xl"
              onClick={() => setIsSanctionOpen(true)}
            >
              <Gavel className="size-3.5" weight="fill" />
              Aplicar punição
            </Button>
            <Button
              size="sm"
              className="h-9 cursor-pointer rounded-xl bg-red-600 font-semibold text-white hover:bg-red-700"
              onClick={() => setIsApplyOpen(true)}
            >
              <ShieldWarning className="size-3.5" weight="fill" />
              Aplicar advertência
            </Button>
          </div>
        </div>
        <RestrictionBadges
          restrictions={data.restrictions}
          emptyText="Nenhuma restrição em vigor."
        />
      </div>

      {/* Advertências */}
      <section className="flex flex-col gap-2">
        <h3 className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
          Advertências ({data.warnings.length})
        </h3>
        {data.warnings.length === 0 ? (
          <p className="border-border/60 bg-muted/10 text-muted-foreground rounded-2xl border px-4 py-6 text-center text-sm">
            Nenhuma advertência aplicada.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {data.warnings.map((warning) => (
              <li
                key={warning.id}
                className="border-border/60 bg-muted/10 flex flex-col gap-2.5 rounded-2xl border p-3.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-bold">
                        {warningLevelLabel(
                          warning.infractionType,
                          warning.level,
                        )}
                      </span>
                      <InfractionTypeBadge type={warning.infractionType} />
                      <WarningStatusBadge status={warning.effectiveStatus} />
                      {warning.status !== "REVOKED" && (
                        <BanReviewBadge status={warning.banReviewStatus} />
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {warning.campaign?.name ?? "Sem competição"} ·{" "}
                      {formatBrtDateTime(warning.appliedAt)} por{" "}
                      {warning.appliedByName ?? "—"}
                      {warning.effectiveStatus === "ACTIVE" &&
                        ` · expira em ${formatBrtDateTime(warning.expiresAt)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 cursor-pointer rounded-lg px-2.5 text-xs"
                      onClick={() => setDetailsWarning(warning)}
                    >
                      <Eye className="size-3.5" />
                      Detalhes
                    </Button>
                    {warning.status !== "REVOKED" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 cursor-pointer rounded-lg px-2.5 text-xs"
                        onClick={() => openRevoke(warning)}
                      >
                        <ArrowCounterClockwise className="size-3.5" />
                        Revogar
                      </Button>
                    )}
                  </div>
                </div>

                <p className="text-sm whitespace-pre-wrap">{warning.reason}</p>

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

                {warning.status === "REVOKED" && (
                  <p className="text-muted-foreground text-xs">
                    Revogada em{" "}
                    {warning.revokedAt
                      ? formatBrtDateTime(warning.revokedAt)
                      : "—"}{" "}
                    por {warning.revokedByName ?? "—"}
                    {warning.revokeReason ? ` — ${warning.revokeReason}` : ""}
                  </p>
                )}

                <SanctionList
                  sanctions={warning.sanctions}
                  now={now}
                  linkedToWarning
                  onEnd={warning.status === "REVOKED" ? undefined : openEnd}
                  emptyText="Sem punições (aviso sem vídeo)."
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Punições avulsas */}
      <section className="flex flex-col gap-2">
        <h3 className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
          Punições avulsas ({data.sanctions.length})
        </h3>
        {data.sanctions.length === 0 ? (
          <p className="border-border/60 bg-muted/10 text-muted-foreground rounded-2xl border px-4 py-6 text-center text-sm">
            Nenhuma punição avulsa.
          </p>
        ) : (
          <SanctionList
            sanctions={data.sanctions}
            now={now}
            linkedToWarning={false}
            showReason
            onEnd={openEnd}
          />
        )}
      </section>

      <ApplyWarningDialog
        clipperProfileId={clipperProfileId}
        clipperName={clipperName}
        open={isApplyOpen}
        onOpenChange={setIsApplyOpen}
      />
      <ApplySanctionDialog
        clipperProfileId={clipperProfileId}
        clipperName={clipperName}
        open={isSanctionOpen}
        onOpenChange={setIsSanctionOpen}
      />
      <WarningDetailsDialog
        warning={detailsWarning}
        open={!!detailsWarning}
        onOpenChange={(open) => {
          if (!open) setDetailsWarning(null)
        }}
        onRevoke={openRevoke}
      />
      <RevokeWarningDialog
        warning={revokeTarget}
        open={!!revokeTarget}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null)
        }}
      />
      <EndSanctionDialog
        sanction={endTarget}
        open={!!endTarget}
        onOpenChange={(open) => {
          if (!open) setEndTarget(null)
        }}
      />
    </div>
  )
}
