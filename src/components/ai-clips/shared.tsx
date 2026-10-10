"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckCircle,
  CircleNotch,
  Folders,
  Palette,
  PauseCircle,
  Sparkle,
  Wallet,
  WarningCircle,
} from "@phosphor-icons/react";
import { api } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { type Project } from "@/server/league-clips/contracts";
import { terminal } from "./polling";
export { projectError } from "@/lib/ai-clips/messages";

export const statusLabels: Record<Project["status"], string> = {
  QUEUED: "Na fila",
  INGESTING: "Preparando",
  NEEDS_UPLOAD: "Envie o arquivo",
  TRANSCRIBING: "Transcrevendo",
  ANALYZING: "Analisando",
  RENDERING: "Gerando clipes",
  COMPLETED: "Pronto",
  COMPLETED_WITH_ERRORS: "Pronto com avisos",
  FAILED: "Falha no processamento",
  CANCELLED: "Cancelado",
};
export const stageLabels: Record<
  NonNullable<Project["currentStage"]>,
  string
> = {
  ingest: "Preparando o vídeo",
  transcribe: "Transcrevendo",
  analyze: "Escolhendo os melhores momentos",
  "render-prep": "Preparando os cortes",
  render: "Gerando os clipes",
  finalize: "Finalizando",
};
export { pollMs, terminal } from "./polling";

export function ProjectStatusBadge({ status }: { status: Project["status"] }) {
  const ready = status === "COMPLETED";
  const warning =
    status === "NEEDS_UPLOAD" || status === "COMPLETED_WITH_ERRORS";
  const failed = status === "FAILED";
  const cancelled = status === "CANCELLED";
  const Icon = ready
    ? CheckCircle
    : warning || failed
      ? WarningCircle
      : cancelled
        ? PauseCircle
        : CircleNotch;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        ready &&
          "dark:text-brand-green border-emerald-600/20 bg-emerald-500/10 text-emerald-700",
        warning &&
          "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        failed && "border-destructive/25 bg-destructive/10 text-destructive",
        cancelled && "bg-muted text-muted-foreground",
        !terminal(status) &&
          !warning &&
          "border-primary/20 bg-primary/10 text-primary",
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {statusLabels[status]}
    </Badge>
  );
}
export function ErrorPanel({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="border-destructive/25 bg-destructive/5 flex items-start gap-3 rounded-xl border p-5 text-sm"
    >
      <WarningCircle
        aria-hidden
        className="text-destructive mt-0.5 size-5 shrink-0"
      />
      <div>
        <p className="leading-relaxed">{message}</p>
        {retry && (
          <Button className="mt-3" variant="outline" onClick={retry}>
            Tentar novamente
          </Button>
        )}
      </div>
    </div>
  );
}
export function EmptyPanel({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-card/60 flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
      <div className="bg-primary/10 ring-primary/10 mb-5 flex size-16 items-center justify-center rounded-2xl ring-8">
        <Sparkle aria-hidden className="text-primary size-7" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
        {detail}
      </p>
      {children && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {children}
        </div>
      )}
    </div>
  );
}
const sections = [
  { href: "/ai-clips", label: "Projetos", icon: Folders },
  { href: "/ai-clips/brand-kits", label: "Identidade visual", icon: Palette },
  { href: "/ai-clips/credits", label: "Créditos", icon: Wallet },
];
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  const pathname = usePathname();
  const credits = api.leagueClips.credits.useQuery();
  return (
    <header className="mb-7">
      <div className="border-border/70 mb-7 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <nav
          aria-label="Navegação do AI Clips"
          className="flex flex-wrap gap-1"
        >
          {sections.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/ai-clips"
                ? !pathname.startsWith("/ai-clips/brand-kits") &&
                  !pathname.startsWith("/ai-clips/credits")
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-primary/50 inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/ai-clips/credits"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-primary/50 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <Wallet aria-hidden className="text-primary size-4" />
          {credits.isLoading
            ? "Consultando saldo…"
            : credits.data
              ? `${credits.data.balanceMinutes} min disponíveis`
              : "Consultar créditos"}
          {!!credits.data?.reservedMinutes && (
            <span className="sr-only">
              {" "}
              · {credits.data.reservedMinutes} min reservados
            </span>
          )}
        </Link>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-64">
          <p className="text-primary mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase">
            <Sparkle aria-hidden className="size-3.5" />
            Clipfy · AI Clips
          </p>
          <h1 className="text-2xl font-semibold tracking-tight break-words sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {children && (
          <div className="flex flex-wrap items-center gap-2">{children}</div>
        )}
      </div>
    </header>
  );
}
export function ProjectProgress({ project }: { project: Project }) {
  const stopped = terminal(project.status) || project.status === "NEEDS_UPLOAD";
  const label =
    stopped || !project.currentStage
      ? statusLabels[project.status]
      : stageLabels[project.currentStage];
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground" role="status">
          {label}
        </span>
        <span className="shrink-0 font-medium tabular-nums">
          {project.progressPct}%
        </span>
      </div>
      <Progress
        value={project.progressPct}
        aria-label={`Processamento: ${label}`}
        className="h-1.5"
      />
    </div>
  );
}
export function formatDuration(value: number | null | undefined) {
  if (value === null || value === undefined) return "Duração a confirmar";
  const seconds = Math.max(0, Math.floor(value / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
    : `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
export function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
