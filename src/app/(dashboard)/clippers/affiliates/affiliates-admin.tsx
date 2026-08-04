"use client";

import * as React from "react";
import {
  ArrowsDownUp,
  CheckCircle,
  Clock,
  Copy,
  Crown,
  LinkSimple,
  MagnifyingGlass,
  Medal,
  Percent,
  Ranking,
  SealCheck,
  ShareNetwork,
  ShieldWarning,
  UserPlus,
  Users,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { AffiliatesHeroViz, AffiliatesAdminHeroVizSkeleton } from "@/components/clippers/affiliates-hero-viz";
import { HomeHero } from "@/components/home/home-hero";
import { SectionHeading } from "@/components/home/section-heading";
import { StatTile } from "@/components/home/stat-tile";
import { CountUp } from "@/components/shared/count-up";
import { Reveal } from "@/components/shared/reveal";
import { Bone } from "@/components/shared/skeletons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";

type AdminList = RouterOutputs["affiliate"]["adminList"];
type AffiliateRow = AdminList["affiliates"][number];
type ReferralRow = AffiliateRow["referrals"][number];

type SortKey = "referrals" | "completed" | "verified" | "conversion" | "name";

const SORT_LABELS: Record<SortKey, string> = {
  referrals: "Mais indicados",
  completed: "Mais onboardings",
  verified: "Mais verificados",
  conversion: "Melhor conversão",
  name: "Nome (A–Z)",
};

const RANK_BADGES = [
  "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  "bg-slate-400/25 text-slate-600 dark:text-slate-300",
  "bg-orange-500/20 text-orange-600 dark:text-orange-400",
] as const;

const initialsOf = (name: string) => name.trim().slice(0, 2).toUpperCase();

const rate = (part: number, total: number) =>
  total > 0 ? (part / total) * 100 : 0;

const formatInt = (value: number) => value.toLocaleString("pt-BR");

const formatPct = (value: number) =>
  `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

const formatDate = (value: string | Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).format(new Date(value));

/* ── Página ────────────────────────────────────────────────────────────── */
export default function AffiliatesAdmin() {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("referrals");

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, error } = api.affiliate.adminList.useQuery(
    { search: debouncedSearch || undefined },
    { placeholderData: (previous) => previous },
  );

  if (error) return <AccessDeniedCard />;

  const stats = data?.stats;
  const isFiltered = debouncedSearch.length > 0;

  const registrations = stats?.registrations ?? 0;
  const completedRate = rate(stats?.completed ?? 0, registrations);
  const verifiedRate = rate(stats?.verified ?? 0, registrations);
  const idleAffiliates = (data?.affiliates ?? []).filter(
    (affiliate) => affiliate.stats.registrations === 0,
  ).length;

  const ranked = [...(data?.affiliates ?? [])].sort((a, b) => {
    switch (sort) {
      case "completed":
        return (
          b.stats.completed - a.stats.completed ||
          b.stats.registrations - a.stats.registrations
        );
      case "verified":
        return (
          b.stats.verified - a.stats.verified ||
          b.stats.registrations - a.stats.registrations
        );
      case "conversion":
        return (
          rate(b.stats.completed, b.stats.registrations) -
            rate(a.stats.completed, a.stats.registrations) ||
          b.stats.registrations - a.stats.registrations
        );
      case "name":
        return a.name.localeCompare(b.name, "pt-BR");
      default:
        return (
          b.stats.registrations - a.stats.registrations ||
          b.stats.completed - a.stats.completed
        );
    }
  });

  /* Pódio sempre pelo nº de indicados — só aparece na visão geral,
     para não confundir o ranking global com um resultado de busca. */
  const podium = isFiltered
    ? []
    : [...(data?.affiliates ?? [])]
        .sort(
          (a, b) =>
            b.stats.registrations - a.stats.registrations ||
            b.stats.completed - a.stats.completed,
        )
        .slice(0, 3)
        .filter((affiliate) => affiliate.stats.registrations > 0);

  const recentReferrals = (data?.affiliates ?? [])
    .flatMap((affiliate) =>
      affiliate.referrals.map((referral) => ({
        referral,
        affiliateName: affiliate.name,
      })),
    )
    .sort(
      (a, b) =>
        new Date(b.referral.createdAt).getTime() -
        new Date(a.referral.createdAt).getTime(),
    )
    .slice(0, 12);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero ===== */}
      <HomeHero
        eyebrow="Clipfy League · Indicações"
        title={
          <>
            Clipador que traz <span className="text-gradient">clipador</span>
          </>
        }
        subtitle="Visão global do programa de afiliados — quem indica, quantos cadastros cada link gera e quanto disso vira clipador de verdade."
        viz={<AffiliatesHeroViz />}
        vizSkeleton={<AffiliatesAdminHeroVizSkeleton />}
        isLoading={isLoading}
        stats={[
          {
            icon: <ShareNetwork className="size-3.5" weight="fill" />,
            label: "Afiliados",
            value: stats?.activeAffiliates ?? 0,
            kind: "int",
          },
          {
            icon: <UserPlus className="size-3.5" weight="fill" />,
            label: "Indicados",
            value: registrations,
            kind: "int",
          },
          {
            icon: <SealCheck className="size-3.5" weight="fill" />,
            label: "Verificados",
            value: stats?.verified ?? 0,
            kind: "int",
          },
        ]}
      />

      {/* ===== KPIs globais ===== */}
      <Reveal immediate>
        <div className="flex flex-col gap-3">
          {isFiltered && (
            <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <MagnifyingGlass className="size-3.5 shrink-0" weight="bold" />
              <span className="min-w-0 truncate">
                Métricas refletem o filtro “{debouncedSearch}”.
              </span>
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              icon={<ShareNetwork className="size-4" weight="fill" />}
              label="Afiliados"
              value={stats?.activeAffiliates ?? 0}
              kind="int"
              hint="com link de indicação criado"
              accent="cyan"
              isLoading={isLoading}
            />
            <StatTile
              icon={<UserPlus className="size-4" weight="fill" />}
              label="Indicados"
              value={registrations}
              kind="int"
              hint="cadastros vindos de links"
              accent="green"
              isLoading={isLoading}
            />
            <StatTile
              icon={<CheckCircle className="size-4" weight="fill" />}
              label="Onboardings"
              value={stats?.completed ?? 0}
              kind="int"
              hint="perfil de clipador concluído"
              accent="cyan"
              isLoading={isLoading}
            />
            <StatTile
              icon={<SealCheck className="size-4" weight="fill" />}
              label="Verificados"
              value={stats?.verified ?? 0}
              kind="int"
              hint="aprovados na verificação"
              accent="green"
              gradientValue
              isLoading={isLoading}
            />
          </div>
        </div>
      </Reveal>

      <Reveal immediate delayMs={60}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile
            icon={<Percent className="size-4" weight="bold" />}
            label="Conversão"
            value={completedRate}
            kind="percent"
            hint="indicado → onboarding concluído"
            accent="cyan"
            isLoading={isLoading}
          />
          <StatTile
            icon={<SealCheck className="size-4" weight="fill" />}
            label="Taxa de verificação"
            value={verifiedRate}
            kind="percent"
            hint="indicado → clipador verificado"
            accent="green"
            isLoading={isLoading}
          />
          <StatTile
            icon={<UsersThree className="size-4" weight="fill" />}
            label="Sem indicados"
            value={idleAffiliates}
            kind="int"
            hint="afiliados que ainda não converteram"
            accent="cyan"
            isLoading={isLoading}
          />
        </div>
      </Reveal>

      {/* ===== Pódio ===== */}
      {(isLoading || podium.length > 0) && !isFiltered && (
        <Reveal immediate delayMs={120}>
          <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
            <SectionHeading
              icon={<Crown className="size-4" weight="fill" />}
              title="Pódio dos afiliados"
              description="Quem mais trouxe clipadores para a Clipfy League"
            />
            {isLoading ? (
              <PodiumSkeleton />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
                {podium.map((affiliate, index) => (
                  <PodiumCard
                    key={affiliate.id}
                    affiliate={affiliate}
                    position={(index + 1) as 1 | 2 | 3}
                  />
                ))}
              </div>
            )}
          </div>
        </Reveal>
      )}

      {/* ===== Ranking ===== */}
      <Reveal immediate delayMs={180}>
        <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
          <SectionHeading
            icon={<Ranking className="size-4" weight="fill" />}
            title="Ranking de afiliados"
            description="Links criados, indicados gerados e taxa de conversão"
          />

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome, e-mail ou código..."
                aria-label="Buscar afiliado"
                className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl pr-10 pl-10"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Limpar busca"
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg transition-colors"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <Select
              value={sort}
              onValueChange={(value) => setSort(value as SortKey)}
            >
              <SelectTrigger
                aria-label="Ordenar ranking"
                className="h-10 w-full rounded-xl lg:w-[210px]"
              >
                <ArrowsDownUp className="text-muted-foreground mr-1 size-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {SORT_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <AffiliatesTable affiliates={ranked} isLoading={isLoading} />
        </div>
      </Reveal>

      {/* ===== Últimos indicados ===== */}
      <Reveal immediate delayMs={240}>
        <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
          <SectionHeading
            icon={<UserPlus className="size-4" weight="fill" />}
            title="Últimos indicados"
            description="Cadastros mais recentes que chegaram por um link de afiliado"
          />
          <RecentReferrals items={recentReferrals} isLoading={isLoading} />
        </div>
      </Reveal>
    </div>
  );
}

/* ── Botão de copiar link ──────────────────────────────────────────────── */
function CopyLinkButton({
  url,
  label,
  className,
}: {
  url: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado!", { description: url });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      aria-label={`Copiar link de indicação de ${label}`}
      title="Copiar link de indicação"
      className={cn(
        "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors motion-reduce:transition-none",
        copied
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
        className,
      )}
    >
      {copied ? (
        <CheckCircle className="size-4" weight="fill" />
      ) : (
        <Copy className="size-4" />
      )}
    </button>
  );
}

/* ── Barra de conversão ────────────────────────────────────────────────── */
function ConversionBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-end gap-2", className)}>
      <div className="bg-muted/60 h-1.5 w-14 shrink-0 overflow-hidden rounded-full sm:w-16">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--brand-cyan)] to-[var(--brand-mint)] transition-[width] duration-700 ease-out not-dark:from-[#089eb8] not-dark:to-[#0eb981] motion-reduce:transition-none"
          style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
        />
      </div>
      <span className="text-muted-foreground w-11 shrink-0 text-right text-[11px] font-semibold tabular-nums">
        {formatPct(value)}
      </span>
    </div>
  );
}

/* ── Pódio (top 3) ─────────────────────────────────────────────────────── */
function PodiumCard({
  affiliate,
  position,
}: {
  affiliate: AffiliateRow;
  position: 1 | 2 | 3;
}) {
  const isFirst = position === 1;
  const conversion = rate(
    affiliate.stats.completed,
    affiliate.stats.registrations,
  );

  return (
    <div
      className={cn(
        "glass-card glass-card-hover relative flex flex-col items-center gap-3 rounded-3xl p-5 text-center",
        isFirst
          ? "py-6 ring-1 ring-[color-mix(in_oklab,var(--brand-mint)_45%,transparent)] sm:order-2 sm:py-7"
          : position === 2
            ? "sm:order-1"
            : "sm:order-3",
      )}
    >
      <span
        className={cn(
          "absolute top-3 right-3 flex size-7 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
          RANK_BADGES[position - 1],
        )}
      >
        {position}º
      </span>

      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-full",
          isFirst
            ? "bg-gradient-custom text-[#04222A]"
            : RANK_BADGES[position - 1],
        )}
      >
        {isFirst ? (
          <Crown className="size-4" weight="fill" />
        ) : (
          <Medal className="size-4" weight="fill" />
        )}
      </span>

      <span
        className={cn(
          "rounded-full p-[3px]",
          isFirst ? "bg-gradient-custom" : "bg-border",
        )}
      >
        <Avatar
          className={cn(
            "border-background border-2",
            isFirst ? "size-18 sm:size-22" : "size-15 sm:size-16",
          )}
        >
          <AvatarImage
            src={affiliate.imageUrl ?? undefined}
            alt={affiliate.name}
          />
          <AvatarFallback
            className={cn(
              "bg-brand-cyan/15 font-bold",
              isFirst ? "text-base" : "text-sm",
            )}
          >
            {initialsOf(affiliate.name)}
          </AvatarFallback>
        </Avatar>
      </span>

      <div className="flex w-full min-w-0 flex-col gap-0.5">
        <p
          className={cn(
            "w-full truncate font-bold tracking-tight",
            isFirst ? "text-base sm:text-lg" : "text-sm",
          )}
          title={affiliate.name}
        >
          {affiliate.name}
        </p>
        <p
          className="text-muted-foreground w-full truncate text-xs"
          title={affiliate.email}
        >
          {affiliate.email}
        </p>
      </div>

      <div className="flex w-full min-w-0 items-center justify-center gap-1.5">
        <Badge
          variant="outline"
          className="border-brand-cyan/25 not-dark:border-primary/30 min-w-0 rounded-full font-mono text-[10px] font-semibold"
        >
          <span className="truncate">{affiliate.affiliateCode}</span>
        </Badge>
        <CopyLinkButton
          url={affiliate.affiliateUrl}
          label={affiliate.name}
          className="size-8"
        />
      </div>

      <CountUp
        value={affiliate.stats.registrations}
        kind="int"
        className={cn(
          "font-bold tabular-nums",
          isFirst
            ? "text-gradient text-2xl not-dark:brightness-[0.7] not-dark:saturate-[1.4] sm:text-3xl"
            : "text-foreground text-xl",
        )}
      />
      <span className="text-muted-foreground -mt-2 text-[10px] font-semibold tracking-[0.14em] uppercase">
        indicados
      </span>

      <div className="grid w-full grid-cols-3 gap-2">
        <div className="bg-muted/40 flex min-w-0 flex-col rounded-xl px-1.5 py-1.5">
          <span className="truncate text-[13px] font-bold tabular-nums">
            {formatInt(affiliate.stats.completed)}
          </span>
          <span className="text-muted-foreground truncate text-[10px] font-semibold tracking-wide uppercase">
            onboard.
          </span>
        </div>
        <div className="bg-muted/40 flex min-w-0 flex-col rounded-xl px-1.5 py-1.5">
          <span className="truncate text-[13px] font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
            {formatInt(affiliate.stats.verified)}
          </span>
          <span className="text-muted-foreground truncate text-[10px] font-semibold tracking-wide uppercase">
            verific.
          </span>
        </div>
        <div className="bg-muted/40 flex min-w-0 flex-col rounded-xl px-1.5 py-1.5">
          <span className="truncate text-[13px] font-bold text-cyan-600 tabular-nums dark:text-cyan-400">
            {formatPct(conversion)}
          </span>
          <span className="text-muted-foreground truncate text-[10px] font-semibold tracking-wide uppercase">
            conv.
          </span>
        </div>
      </div>
    </div>
  );
}

function PodiumSkeleton() {
  return (
    <div
      aria-hidden
      className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end"
    >
      {[1, 2, 3].map((position, index) => (
        <div
          key={position}
          className="glass-card flex flex-col items-center gap-3 rounded-3xl p-5"
        >
          <Bone delay={index * 120} className="size-8 rounded-full" />
          <Bone
            delay={index * 120 + 60}
            className={cn(
              "rounded-full",
              position === 1 ? "size-18 sm:size-22" : "size-15 sm:size-16",
            )}
          />
          <Bone delay={index * 120 + 120} className="h-4 w-28 rounded-full" />
          <Bone delay={index * 120 + 160} className="h-3 w-36 rounded-full" />
          <Bone delay={index * 120 + 200} className="h-6 w-24 rounded-full" />
          <Bone delay={index * 120 + 240} className="h-7 w-20 rounded-xl" />
          <div className="grid w-full grid-cols-3 gap-2">
            {[0, 1, 2].map((cell) => (
              <Bone
                key={cell}
                delay={index * 120 + 280 + cell * 60}
                className="h-11 rounded-xl"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Tabela do ranking ─────────────────────────────────────────────────── */
function AffiliatesTable({
  affiliates,
  isLoading,
}: {
  affiliates: AffiliateRow[];
  isLoading: boolean;
}) {
  if (isLoading) return <TableBones rows={8} />;

  if (affiliates.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="bg-muted/60 text-muted-foreground flex size-12 items-center justify-center rounded-2xl">
          <ShareNetwork className="size-6" weight="fill" />
        </span>
        <div>
          <p className="text-sm font-semibold">Nenhum afiliado encontrado</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Ajuste a busca ou aguarde os clipadores criarem seus links de
            indicação.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border">
      <Table className="sm:min-w-[620px]">
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-12 text-[10px] font-bold uppercase">
              #
            </TableHead>
            <TableHead className="text-[10px] font-bold uppercase">
              Afiliado
            </TableHead>
            <TableHead className="hidden text-[10px] font-bold uppercase sm:table-cell">
              Código
            </TableHead>
            <TableHead className="text-right text-[10px] font-bold uppercase">
              Indicados
            </TableHead>
            <TableHead className="hidden text-right text-[10px] font-bold uppercase md:table-cell">
              Onboardings
            </TableHead>
            <TableHead className="hidden text-right text-[10px] font-bold uppercase lg:table-cell">
              Verificados
            </TableHead>
            <TableHead className="hidden text-right text-[10px] font-bold uppercase md:table-cell">
              Conversão
            </TableHead>
            <TableHead className="hidden text-[10px] font-bold uppercase xl:table-cell">
              Últimos indicados
            </TableHead>
            <TableHead className="w-12 text-right text-[10px] font-bold uppercase">
              Link
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {affiliates.map((affiliate, index) => {
            const rank = index + 1;
            const conversion = rate(
              affiliate.stats.completed,
              affiliate.stats.registrations,
            );
            const lastReferrals = affiliate.referrals
              .slice(0, 3)
              .map((referral) => referral.name ?? referral.email)
              .join(", ");

            return (
              <TableRow
                key={affiliate.id}
                className="hover:bg-muted/20 transition-colors motion-reduce:transition-none"
              >
                <TableCell className="py-3">
                  <RankBubble rank={rank} />
                </TableCell>
                <TableCell className="py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar className="border-border/60 size-9 shrink-0 border">
                      <AvatarImage
                        src={affiliate.imageUrl ?? undefined}
                        alt={affiliate.name}
                      />
                      <AvatarFallback className="bg-gradient-custom text-[10px] font-bold text-[#04222A]">
                        {initialsOf(affiliate.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p
                        className="max-w-[120px] truncate text-xs font-semibold sm:max-w-[200px]"
                        title={affiliate.name}
                      >
                        {affiliate.name}
                      </p>
                      <p
                        className="text-muted-foreground max-w-[120px] truncate text-[10px] sm:max-w-[200px]"
                        title={affiliate.email}
                      >
                        {affiliate.email}
                      </p>
                      <Badge
                        variant="outline"
                        className="border-brand-cyan/25 not-dark:border-primary/30 mt-1 max-w-[120px] rounded-full font-mono text-[9px] font-semibold sm:hidden"
                      >
                        <span className="truncate">
                          {affiliate.affiliateCode}
                        </span>
                      </Badge>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden py-3 sm:table-cell">
                  <Badge
                    variant="outline"
                    className="border-brand-cyan/25 not-dark:border-primary/30 rounded-full font-mono text-[10px] font-semibold"
                  >
                    {affiliate.affiliateCode}
                  </Badge>
                </TableCell>
                <TableCell className="py-3 text-right">
                  <span className="text-sm font-bold tabular-nums">
                    {formatInt(affiliate.stats.registrations)}
                  </span>
                </TableCell>
                <TableCell className="hidden py-3 text-right md:table-cell">
                  <span className="text-xs font-semibold text-cyan-600 tabular-nums dark:text-cyan-400">
                    {formatInt(affiliate.stats.completed)}
                  </span>
                </TableCell>
                <TableCell className="hidden py-3 text-right lg:table-cell">
                  <span className="text-xs font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                    {formatInt(affiliate.stats.verified)}
                  </span>
                </TableCell>
                <TableCell className="hidden py-3 md:table-cell">
                  <ConversionBar value={conversion} />
                </TableCell>
                <TableCell className="hidden py-3 xl:table-cell">
                  <p
                    className="text-muted-foreground max-w-56 truncate text-xs"
                    title={lastReferrals || undefined}
                  >
                    {lastReferrals || "Nenhum"}
                  </p>
                </TableCell>
                <TableCell className="py-3">
                  <div className="flex justify-end">
                    <CopyLinkButton
                      url={affiliate.affiliateUrl}
                      label={affiliate.name}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function RankBubble({ rank }: { rank: number }) {
  const isTop3 = rank <= 3;
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
        isTop3 ? RANK_BADGES[rank - 1] : "bg-muted/60 text-muted-foreground",
      )}
    >
      {rank === 1 ? <Crown className="size-4" weight="fill" /> : `${rank}º`}
    </span>
  );
}

function TableBones({ rows }: { rows: number }) {
  return (
    <div aria-hidden className="overflow-hidden rounded-2xl border">
      <div className="bg-muted/30 border-border/60 flex items-center gap-4 border-b px-4 py-3">
        <Bone className="h-3 w-6 rounded-full" />
        <Bone delay={60} className="h-3 w-20 rounded-full" />
        <Bone delay={120} className="ml-auto h-3 w-16 rounded-full" />
        <Bone delay={180} className="hidden h-3 w-20 rounded-full md:block" />
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="border-border/40 flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
        >
          <Bone delay={index * 90} className="size-8 shrink-0 rounded-full" />
          <Bone
            delay={index * 90 + 40}
            className="size-9 shrink-0 rounded-full"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Bone delay={index * 90 + 80} className="h-3 w-2/5 max-w-36" />
            <Bone
              delay={index * 90 + 120}
              className="h-2.5 w-1/3 max-w-28 rounded-full"
            />
          </div>
          <Bone
            delay={index * 90 + 160}
            className="hidden h-5 w-20 rounded-full sm:block"
          />
          <Bone delay={index * 90 + 200} className="h-3 w-8 rounded-full" />
          <Bone
            delay={index * 90 + 240}
            className="hidden h-1.5 w-24 rounded-full md:block"
          />
          <Bone delay={index * 90 + 280} className="size-8 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/* ── Últimos indicados ─────────────────────────────────────────────────── */
function ReferralStatusBadge({ referral }: { referral: ReferralRow }) {
  if (referral.verificationStatus === "VERIFIED") {
    return (
      <Badge
        variant="outline"
        className="gap-1 rounded-full border-emerald-500/30 bg-emerald-500/15 text-[10px] text-emerald-600 dark:text-emerald-400"
      >
        <SealCheck className="size-3 shrink-0" weight="fill" />
        Verificado
      </Badge>
    );
  }

  if (referral.onboardingCompleted) {
    return (
      <Badge
        variant="outline"
        className="gap-1 rounded-full border-cyan-500/30 bg-cyan-500/15 text-[10px] text-cyan-600 dark:text-cyan-400"
      >
        <CheckCircle className="size-3 shrink-0" weight="fill" />
        Onboarding ok
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="gap-1 rounded-full border-amber-500/30 bg-amber-500/15 text-[10px] text-amber-600 dark:text-amber-400"
    >
      <Clock className="size-3 shrink-0" weight="fill" />
      Pendente
    </Badge>
  );
}

function RecentReferrals({
  items,
  isLoading,
}: {
  items: { referral: ReferralRow; affiliateName: string }[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div aria-hidden className="flex flex-col gap-1.5">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 px-2 py-2">
            <Bone delay={index * 90} className="size-9 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Bone delay={index * 90 + 50} className="h-3 w-2/5 max-w-36" />
              <Bone
                delay={index * 90 + 100}
                className="h-2.5 w-1/2 max-w-48 rounded-full"
              />
            </div>
            <Bone
              delay={index * 90 + 150}
              className="hidden h-5 w-24 rounded-full sm:block"
            />
            <Bone
              delay={index * 90 + 200}
              className="hidden h-3 w-14 rounded-full lg:block"
            />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="bg-muted/60 text-muted-foreground flex size-12 items-center justify-center rounded-2xl">
          <Users className="size-6" weight="fill" />
        </span>
        <p className="text-muted-foreground text-sm">
          Nenhum clipador indicado ainda
        </p>
      </div>
    );
  }

  return (
    <div className="-mr-2 flex max-h-[460px] flex-col gap-1 overflow-y-auto pr-2">
      {items.map(({ referral, affiliateName }) => {
        const displayName = referral.name ?? referral.email;
        return (
          <div
            key={referral.id}
            className="hover:bg-muted/40 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors motion-reduce:transition-none"
          >
            <Avatar className="border-border/60 size-9 shrink-0 border">
              <AvatarImage
                src={referral.imageUrl ?? undefined}
                alt={displayName}
              />
              <AvatarFallback className="bg-brand-cyan/15 text-[10px] font-bold">
                {initialsOf(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="text-muted-foreground truncate text-xs">
                <LinkSimple className="mr-1 inline size-3 shrink-0 align-[-1px]" />
                via {affiliateName}
              </p>
            </div>
            <div className="hidden shrink-0 sm:block">
              <ReferralStatusBadge referral={referral} />
            </div>
            <span className="text-muted-foreground hidden shrink-0 text-[10px] tabular-nums lg:block">
              {formatDate(referral.createdAt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Card de acesso restrito ───────────────────────────────────────────── */
function AccessDeniedCard() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <Reveal immediate>
        <div className="glass-card flex flex-col items-center gap-4 rounded-3xl px-4 py-20 text-center">
          <span className="flex size-13 items-center justify-center rounded-2xl bg-red-500/15 text-red-500">
            <ShieldWarning className="size-6" weight="fill" />
          </span>
          <div>
            <p className="text-base font-bold">
              Acesso restrito a administradores
            </p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
              Você não tem permissão para visualizar o programa de indicações.
              Fale com um administrador da Clipfy League.
            </p>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
