"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowSquareOut,
  ChatCircle,
  ChatText,
  CheckCircle,
  Clock,
  Eye,
  Gavel,
  Heart,
  Prohibit,
  ShieldWarning,
  VideoCamera,
  XCircle,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import {
  ClippersHeroViz,
  ClippersHeroVizSkeleton,
} from "@/components/clippers/clippers-hero-viz";
import { SanctionList } from "@/components/clippers/discipline-sanction-list";
import {
  formatBrtDateTime,
  useNow,
} from "@/components/clippers/discipline-shared";
import { HomeHero } from "@/components/home/home-hero";
import { formatCompact } from "@/components/shared/count-up";
import { Reveal } from "@/components/shared/reveal";
import { Bone } from "@/components/shared/skeletons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { platformConfig, type PlatformKey } from "@/lib/platform-config";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";

import {
  RevokeWarningDialog,
  type RevokeWarningTarget,
} from "../revoke-warning-dialog";
import { useInvalidateDiscipline } from "../use-invalidate-discipline";
import {
  WarningDetailsDialog,
  clipperDisplayName,
  revokeTargetOf,
  type AdminWarning,
} from "../warning-details-dialog";

type ObservationPost =
  RouterOutputs["clipperDiscipline"]["observationQueue"][number];

type BanDecision = { warning: AdminWarning; ban: boolean };

export default function Review() {
  const now = useNow(60_000);
  const invalidate = useInvalidateDiscipline();

  const observation = api.clipperDiscipline.observationQueue.useQuery();
  const banQueue = api.clipperDiscipline.banReviewQueue.useQuery();

  /* ===== Vídeos em observação ===== */
  const [rejectTarget, setRejectTarget] =
    React.useState<ObservationPost | null>(null);
  const reviewMutation =
    api.clipperDiscipline.reviewObservationPost.useMutation({
      onSuccess: (_, variables) => {
        toast.success(
          variables.approve
            ? "Vídeo aprovado: passa a pontuar"
            : "Vídeo reprovado: não pontua",
        );
        setRejectTarget(null);
        invalidate();
      },
      onError: (error) =>
        toast.error(error.message || "Erro ao revisar o vídeo"),
    });
  const reviewingId = reviewMutation.isPending
    ? reviewMutation.variables?.clipPostId
    : undefined;

  /* ===== Análise de banimento ===== */
  const [decision, setDecision] = React.useState<BanDecision | null>(null);
  const [detailsWarning, setDetailsWarning] =
    React.useState<AdminWarning | null>(null);
  const [revokeTarget, setRevokeTarget] =
    React.useState<RevokeWarningTarget | null>(null);
  const decideMutation = api.clipperDiscipline.decideBanReview.useMutation({
    onSuccess: (_, variables) => {
      toast.success(
        variables.ban ? "Clipador banido" : "Análise arquivada sem banimento",
      );
      setDecision(null);
      invalidate();
    },
    onError: (error) =>
      toast.error(error.message || "Erro ao decidir a análise"),
  });

  const observationCount = observation.data?.length ?? 0;
  const banCount = banQueue.data?.length ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <HomeHero
        eyebrow="Clipfy League · Advertências"
        title={
          <>
            Fila de <span className="text-gradient">revisões</span>
          </>
        }
        subtitle="Aprove ou reprove os vídeos de clipadores em observação e decida as análises de banimento abertas por infrações graves."
        isLoading={observation.isLoading || banQueue.isLoading}
        viz={<ClippersHeroViz />}
        vizSkeleton={<ClippersHeroVizSkeleton />}
        stats={[
          {
            icon: <VideoCamera className="size-3.5" weight="fill" />,
            label: "Vídeos em observação",
            value: observationCount,
            kind: "int",
          },
          {
            icon: <Gavel className="size-3.5" weight="fill" />,
            label: "Análises de ban",
            value: banCount,
            kind: "int",
          },
        ]}
      />

      <div>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-9 cursor-pointer rounded-xl"
        >
          <Link href="/clippers/warnings">
            <ArrowLeft className="size-3.5" weight="bold" />
            Voltar para advertências
          </Link>
        </Button>
      </div>

      {/* ===== Vídeos em observação ===== */}
      <Reveal immediate>
        <section className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
          <SectionHeader
            icon={<VideoCamera className="size-4" weight="fill" />}
            title="Vídeos em observação"
            description="Vídeos de clipadores em modo observação só pontuam depois de aprovados."
            count={observationCount}
          />
          <div className="flex items-start gap-2.5 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-3 text-sm text-sky-800 dark:text-sky-300">
            <Clock className="mt-0.5 size-4 shrink-0" weight="fill" />
            <span>
              O ranking diário fecha às <strong>17h</strong> (horário de
              Brasília) e o snapshot roda às <strong>21h</strong>. Revise os
              vídeos antes desses horários para que os aprovados entrem no
              ranking do dia.
            </span>
          </div>

          {observation.isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Bone
                  key={index}
                  delay={index * 80}
                  className="h-20 w-full rounded-2xl"
                />
              ))}
            </div>
          ) : observation.isError ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Não foi possível carregar a fila de observação.
            </p>
          ) : observationCount === 0 ? (
            <EmptyQueue text="Nenhum vídeo aguardando revisão." />
          ) : (
            <ul className="flex flex-col gap-2">
              {observation.data?.map((post) => (
                <ObservationRow
                  key={post.id}
                  post={post}
                  busy={reviewingId === post.id}
                  disabled={reviewMutation.isPending}
                  onApprove={() =>
                    reviewMutation.mutate({
                      clipPostId: post.id,
                      approve: true,
                    })
                  }
                  onReject={() => setRejectTarget(post)}
                />
              ))}
            </ul>
          )}
          {observationCount >= 200 && (
            <p className="text-muted-foreground text-xs">
              Mostrando os 200 vídeos mais antigos da fila.
            </p>
          )}
        </section>
      </Reveal>

      {/* ===== Análise de banimento ===== */}
      <Reveal immediate delayMs={60}>
        <section className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
          <SectionHeader
            icon={<Gavel className="size-4" weight="fill" />}
            title="Análise de banimento (infrações graves)"
            description="A infração grave já removeu o clipador da competição e reteve os pagamentos. Aqui a equipe decide se ele é banido."
            count={banCount}
          />
          {banQueue.isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <Bone
                  key={index}
                  delay={index * 80}
                  className="h-40 w-full rounded-2xl"
                />
              ))}
            </div>
          ) : banQueue.isError ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Não foi possível carregar as análises de banimento.
            </p>
          ) : banCount === 0 ? (
            <EmptyQueue text="Nenhuma análise de banimento pendente." />
          ) : (
            <ul className="flex flex-col gap-3">
              {banQueue.data?.map((warning) => (
                <li
                  key={warning.id}
                  className="border-border/60 bg-muted/10 flex flex-col gap-3 rounded-2xl border p-3.5 sm:p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-bold">
                        <ShieldWarning
                          className="size-4 text-red-500"
                          weight="fill"
                        />
                        {clipperDisplayName(warning.clipperProfile)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {warning.clipperProfile.user.email}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {warning.campaign?.name ?? "Sem competição"} · aplicada
                        em {formatBrtDateTime(warning.appliedAt)} por{" "}
                        {warning.appliedByName ?? "—"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 cursor-pointer rounded-xl"
                        onClick={() => setDetailsWarning(warning)}
                      >
                        <Eye className="size-3.5" />
                        Detalhes
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 cursor-pointer rounded-xl"
                        disabled={decideMutation.isPending}
                        onClick={() => setDecision({ warning, ban: false })}
                      >
                        <XCircle className="size-3.5" />
                        Arquivar
                      </Button>
                      <Button
                        size="sm"
                        className="h-9 cursor-pointer rounded-xl bg-red-600 font-semibold text-white hover:bg-red-700"
                        disabled={decideMutation.isPending}
                        onClick={() => setDecision({ warning, ban: true })}
                      >
                        <Prohibit className="size-3.5" weight="bold" />
                        Banir
                      </Button>
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

                  <div className="border-border/60 bg-background/40 rounded-xl border px-3 py-2">
                    <p className="text-muted-foreground mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] uppercase">
                      <ChatText className="size-3.5" />
                      Defesa
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {warning.defenseText ?? (
                        <span className="text-muted-foreground">
                          O clipador ainda não enviou defesa.
                        </span>
                      )}
                    </p>
                  </div>

                  <SanctionList
                    sanctions={warning.sanctions}
                    now={now}
                    linkedToWarning
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </Reveal>

      {/* ===== Reprovar vídeo ===== */}
      <AlertDialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null);
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Reprovar vídeo?</AlertDialogTitle>
            <AlertDialogDescription>
              O vídeo de{" "}
              {rejectTarget
                ? clipperDisplayName(rejectTarget.application.clipperProfile)
                : "—"}{" "}
              fica desclassificado e não pontua no ranking.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer rounded-xl">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer rounded-xl bg-red-600 font-semibold text-white hover:bg-red-700"
              disabled={reviewMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (!rejectTarget) return;
                reviewMutation.mutate({
                  clipPostId: rejectTarget.id,
                  approve: false,
                });
              }}
            >
              {reviewMutation.isPending ? "Reprovando..." : "Reprovar vídeo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== Banir / Arquivar ===== */}
      <AlertDialog
        open={!!decision}
        onOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle
              className={cn(
                "flex items-center gap-2",
                decision?.ban && "text-red-600 dark:text-red-400",
              )}
            >
              {decision?.ban ? (
                <Prohibit className="size-5" weight="fill" />
              ) : (
                <XCircle className="size-5" weight="fill" />
              )}
              {decision?.ban ? "Banir clipador" : "Arquivar análise"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {decision
                ? clipperDisplayName(decision.warning.clipperProfile)
                : ""}
              {decision?.ban
                ? " será banido da plataforma:"
                : " não será banido. A remoção da competição e a retenção de pagamento desta infração continuam valendo; para liberar o pagamento, use o perfil do clipador."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {decision?.ban && (
            <ul className="text-muted-foreground flex flex-col gap-1.5 text-sm">
              {[
                "Bloqueia o acesso à plataforma",
                "Remove das competições em andamento (sem estornar o que já foi ganho)",
                "Mantém a carteira retida",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <XCircle
                    className="mt-0.5 size-3.5 shrink-0 text-red-500"
                    weight="fill"
                  />
                  {item}
                </li>
              ))}
            </ul>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer rounded-xl">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                "cursor-pointer rounded-xl font-semibold",
                decision?.ban
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "btn-gradient-auth",
              )}
              disabled={decideMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (!decision) return;
                decideMutation.mutate({
                  warningId: decision.warning.id,
                  ban: decision.ban,
                });
              }}
            >
              {decideMutation.isPending
                ? "Salvando..."
                : decision?.ban
                  ? "Banir clipador"
                  : "Arquivar análise"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <WarningDetailsDialog
        warning={detailsWarning}
        open={!!detailsWarning}
        onOpenChange={(open) => {
          if (!open) setDetailsWarning(null);
        }}
        onRevoke={(warning) => {
          setDetailsWarning(null);
          setRevokeTarget(revokeTargetOf(warning));
        }}
      />
      <RevokeWarningDialog
        warning={revokeTarget}
        open={!!revokeTarget}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
      />
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  description,
  count,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  count: number;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-2 text-base font-bold">
          {title}
          <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
            {count}
          </span>
        </h2>
        <p className="text-muted-foreground text-xs sm:text-sm">
          {description}
        </p>
      </div>
    </div>
  );
}

function EmptyQueue({ text }: { text: string }) {
  return (
    <div className="border-border/60 bg-muted/10 flex flex-col items-center gap-2 rounded-2xl border py-10 text-center">
      <CheckCircle className="size-7 text-emerald-500" weight="fill" />
      <p className="text-muted-foreground text-sm">{text}</p>
    </div>
  );
}

function ObservationRow({
  post,
  busy,
  disabled,
  onApprove,
  onReject,
}: {
  post: ObservationPost;
  busy: boolean;
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const platform = platformConfig[post.platform as PlatformKey];
  const PlatformIcon = platform?.icon;
  return (
    <li className="border-border/60 bg-muted/10 flex flex-col gap-3 rounded-2xl border p-3.5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {PlatformIcon && (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl",
              platform.bgColor,
              platform.color,
            )}
          >
            <PlatformIcon className="size-4.5" />
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-sm font-semibold">
            {clipperDisplayName(post.application.clipperProfile)}
            <span className="text-muted-foreground font-normal">
              {" "}
              · {post.campaign.name}
            </span>
          </p>
          <a
            href={post.submittedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary inline-flex max-w-full items-center gap-1 truncate text-xs font-medium underline-offset-4 hover:underline"
          >
            <ArrowSquareOut className="size-3.5 shrink-0" />
            <span className="truncate">{post.submittedUrl}</span>
          </a>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
            <span>
              Postado em{" "}
              {post.postedAt ? formatBrtDateTime(post.postedAt) : "—"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3" />
              {formatCompact(Number(post.views))}
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart className="size-3" />
              {formatCompact(post.likes)}
            </span>
            <span className="inline-flex items-center gap-1">
              <ChatCircle className="size-3" />
              {formatCompact(post.comments)}
            </span>
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-9 flex-1 cursor-pointer rounded-xl border-red-500/40 text-red-600 hover:text-red-600 sm:flex-none dark:text-red-400"
          disabled={disabled}
          onClick={onReject}
        >
          <XCircle className="size-3.5" weight="fill" />
          Reprovar
        </Button>
        <Button
          size="sm"
          className="h-9 flex-1 cursor-pointer rounded-xl bg-emerald-600 font-semibold text-white hover:bg-emerald-700 sm:flex-none"
          disabled={disabled}
          onClick={onApprove}
        >
          <CheckCircle className="size-3.5" weight="fill" />
          {busy ? "Salvando..." : "Aprovar"}
        </Button>
      </div>
    </li>
  );
}
