"use client";

import * as React from "react";
import {
  CalendarBlank,
  ChatCircleDots,
  ChatsCircle,
  Eye,
  Pulse,
  Trophy,
  VideoCamera,
} from "@phosphor-icons/react";

import {
  CommentsAnalysisResultsPanel,
  CommentsAnalysisResultsSkeleton,
} from "@/components/comments-analysis/comments-analysis-results-panel";
import { HomeHero } from "@/components/home/home-hero";
import { StatTile } from "@/components/home/stat-tile";
import { Reveal } from "@/components/shared/reveal";
import { Bone, StatTilesGridSkeleton } from "@/components/shared/skeletons";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { platformConfig, type PlatformKey } from "@/lib/platform-config";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";

import { ClientCommentsHeroViz, ClientCommentsHeroVizSkeleton } from "./client-comments-hero-viz";

/* ============================================================
   COMENTÁRIOS (CLIENTE)
   O cliente lê a percepção pública consolidada dos comentários
   dos vídeos das suas competições. Só leitura: nenhum disparo
   de análise, nenhum custo — isso é operação do admin.
   ============================================================ */

type ClientCampaign =
  RouterOutputs["customers"]["getDashboard"]["campaigns"][number];

/* ── Status da competição (par claro/escuro obrigatório) ───────────────── */
const STATUS_META: Record<string, { label: string; className: string }> = {
  ACTIVE: {
    label: "Em andamento",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  SCHEDULED: {
    label: "Agendada",
    className: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  COMPLETED: {
    label: "Encerrada",
    className:
      "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-300",
  },
};

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ══════════════════════════════════════════════════════════════════════ */

export default function ClientComments() {
  const { data, isLoading } = api.customers.getDashboard.useQuery();

  const campaigns = React.useMemo<ClientCampaign[]>(
    () => data?.campaigns ?? [],
    [data?.campaigns],
  );

  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!selectedId && campaigns.length > 0) {
      setSelectedId(campaigns[0]!.id);
    }
  }, [campaigns, selectedId]);

  const selected =
    campaigns.find((campaign) => campaign.id === selectedId) ?? campaigns[0];

  const totalComments = campaigns.reduce(
    (sum, campaign) => sum + Number(campaign.totalComments ?? 0),
    0,
  );
  const totalPosts = campaigns.reduce(
    (sum, campaign) => sum + Number(campaign.totalPosts ?? 0),
    0,
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero ===== */}
      <HomeHero
        eyebrow="Clipfy League · Percepção pública"
        title={
          <>
            O que o público <span className="text-gradient">está dizendo</span>
          </>
        }
        subtitle="A leitura consolidada dos comentários dos vídeos das suas competições: sentimento da audiência, elogios que se repetem, críticas e sugestões — na voz de quem assistiu."
        viz={<ClientCommentsHeroViz />}
        vizSkeleton={<ClientCommentsHeroVizSkeleton />}
        isLoading={isLoading}
        stats={[
          {
            icon: <Trophy className="size-3.5" weight="fill" />,
            label: "Competições",
            value: campaigns.length,
            kind: "int",
          },
          {
            icon: <ChatCircleDots className="size-3.5" weight="fill" />,
            label: "Comentários",
            value: totalComments,
            kind: "compact",
          },
          {
            icon: <VideoCamera className="size-3.5" weight="fill" />,
            label: "Vídeos",
            value: totalPosts,
            kind: "compact",
          },
        ]}
      />

      {isLoading ? (
        <LoadingState />
      ) : campaigns.length === 0 ? (
        <Reveal immediate delayMs={80}>
          <EmptyCampaignsCard />
        </Reveal>
      ) : selected ? (
        <>
          {/* ===== Seletor de competição ===== */}
          <Reveal immediate delayMs={80}>
            <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="bg-gradient-custom flex size-10 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
                    <Trophy className="size-5" weight="fill" />
                  </span>
                  <div className="min-w-0 leading-tight">
                    <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
                      Competição
                    </p>
                    <p className="truncate text-base font-bold tracking-tight sm:text-lg">
                      {selected.name}
                    </p>
                  </div>
                </div>

                <div className="flex min-w-0 items-center gap-2">
                  <label htmlFor="competicao-comentarios" className="sr-only">
                    Selecionar competição
                  </label>
                  <Select
                    value={selected.id}
                    onValueChange={(value) => setSelectedId(value)}
                  >
                    <SelectTrigger
                      id="competicao-comentarios"
                      aria-label="Selecionar competição"
                      className="h-10 w-full min-w-0 rounded-xl lg:w-[320px]"
                    >
                      <ChatsCircle className="text-muted-foreground mr-1 size-4 shrink-0" />
                      <SelectValue placeholder="Selecione a competição" />
                    </SelectTrigger>
                    <SelectContent className="max-w-[calc(100vw-2rem)]">
                      {campaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="min-w-0 truncate">
                              {campaign.name}
                            </span>
                            <Badge
                              variant="outline"
                              className="shrink-0 px-1.5 text-[10px] tabular-nums"
                            >
                              {Number(
                                campaign.totalComments ?? 0,
                              ).toLocaleString("pt-BR")}
                            </Badge>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Meta da competição selecionada */}
              <div className="border-border/60 flex flex-wrap items-center gap-2 border-t pt-3.5">
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 text-[11px]",
                    STATUS_META[selected.status]?.className ??
                      "border-border text-muted-foreground",
                  )}
                >
                  {STATUS_META[selected.status]?.label ?? selected.status}
                </Badge>

                <span className="text-muted-foreground inline-flex min-w-0 items-center gap-1.5 text-xs">
                  <CalendarBlank className="size-3.5 shrink-0" weight="fill" />
                  <span className="truncate">
                    {formatDate(selected.startDate)} —{" "}
                    {formatDate(selected.endDate)}
                  </span>
                </span>

                {selected.platforms.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    {selected.platforms.map((platform) => {
                      const config =
                        platformConfig[platform as PlatformKey] ?? null;
                      if (!config) return null;
                      const PlatformIcon = config.icon;
                      return (
                        <span
                          key={platform}
                          role="img"
                          title={config.label}
                          aria-label={config.label}
                          className={cn(
                            "flex size-6 items-center justify-center rounded-lg border transition-transform hover:scale-110 motion-reduce:transition-none motion-reduce:hover:scale-100",
                            config.bgColor,
                            config.borderColor,
                            config.color,
                          )}
                        >
                          <PlatformIcon className="size-3.5" />
                        </span>
                      );
                    })}
                  </span>
                )}
              </div>
            </div>
          </Reveal>

          {/* ===== Volume da competição selecionada ===== */}
          <Reveal immediate delayMs={160}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                icon={<ChatCircleDots className="size-4" weight="fill" />}
                label="Comentários"
                value={Number(selected.totalComments ?? 0)}
                kind="compact"
                accent="gradient"
                gradientValue
                hint="recebidos nos vídeos"
              />
              <StatTile
                icon={<VideoCamera className="size-4" weight="fill" />}
                label="Vídeos"
                value={Number(selected.totalPosts ?? 0)}
                kind="int"
                accent="cyan"
                hint="publicados na competição"
              />
              <StatTile
                icon={<Eye className="size-4" weight="fill" />}
                label="Visualizações"
                value={Number(selected.totalViews ?? 0)}
                kind="compact"
                accent="green"
                hint="alcance total"
              />
              <StatTile
                icon={<Pulse className="size-4" weight="fill" />}
                label="Engajamento"
                value={Number(selected.engagementRate ?? 0)}
                kind="percent"
                accent="purple"
                hint="interações por view"
              />
            </div>
          </Reveal>

          {/* ===== Análise agregada dos comentários =====
              O painel já cuida do próprio Reveal, cabeçalho, skeleton,
              erro e estado vazio. A `key` reinicia o filtro de sentimento
              ao trocar de competição. */}
          <CommentsAnalysisResultsPanel
            key={selected.id}
            scope={{ type: "campaign", campaignId: selected.id }}
            revealDelayMs={240}
            title="Percepção pública"
            emptyDescription={`A competição "${selected.name}" ainda não tem uma análise de comentários publicada. Assim que a Clipfy League processar os comentários dos vídeos, o resultado aparece aqui.`}
          />
        </>
      ) : null}
    </div>
  );
}

/* ── Estados ───────────────────────────────────────────────────────────── */

/** Cliente ainda sem competições vinculadas. */
function EmptyCampaignsCard() {
  return (
    <div className="glass-card flex flex-col items-center gap-4 rounded-3xl px-4 py-14 text-center sm:py-16">
      <span className="bg-muted/60 text-muted-foreground flex size-13 items-center justify-center rounded-2xl">
        <Trophy className="size-6" weight="fill" />
      </span>
      <div className="min-w-0">
        <p className="text-base font-bold">Nenhuma competição encontrada</p>
        <p className="text-muted-foreground mx-auto mt-1.5 max-w-md text-sm leading-relaxed">
          Você ainda não possui competições vinculadas para acompanhar os
          comentários da audiência.
        </p>
      </div>
    </div>
  );
}

/** Skeleton da página: espelha seletor, KPIs e painel de análise. */
function LoadingState() {
  return (
    <>
      <Reveal immediate delayMs={80}>
        <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Bone className="size-10 shrink-0 rounded-xl" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Bone delay={60} className="h-3 w-24 rounded-full" />
                <Bone delay={120} className="h-4 w-40 max-w-full" />
              </div>
            </div>
            <Bone delay={180} className="h-10 w-full rounded-xl lg:w-[320px]" />
          </div>
          <div className="border-border/60 flex flex-wrap items-center gap-2 border-t pt-3.5">
            <Bone delay={240} className="h-5 w-24 rounded-full" />
            <Bone delay={300} className="h-5 w-40 rounded-full" />
            <Bone delay={360} className="size-6 rounded-lg" />
          </div>
        </div>
      </Reveal>

      <Reveal immediate delayMs={160}>
        <StatTilesGridSkeleton
          count={4}
          className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
        />
      </Reveal>

      <Reveal immediate delayMs={240}>
        <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:gap-6 sm:p-6">
          <div className="flex items-center gap-2.5">
            <Bone className="size-8 rounded-lg" />
            <div className="flex min-w-0 flex-col gap-1.5">
              <Bone delay={60} className="h-4 w-40 max-w-full" />
              <Bone delay={120} className="h-3 w-56 max-w-full rounded-full" />
            </div>
          </div>
          <CommentsAnalysisResultsSkeleton />
        </div>
      </Reveal>
    </>
  );
}
