"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowSquareOut,
  Check,
  CheckCircle,
  CircleNotch,
  Copy,
  LinkSimple,
  SealCheck,
  ShareNetwork,
  Sparkle,
  TelegramLogo,
  UserPlus,
  Users,
  WarningCircle,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { AffiliatesHeroViz, AffiliatesHeroVizSkeleton } from "@/components/affiliates/affiliates-hero-viz";
import { HomeHero } from "@/components/home/home-hero";
import { SectionHeading } from "@/components/home/section-heading";
import { StatTile } from "@/components/home/stat-tile";
import { CountUp } from "@/components/shared/count-up";
import { Reveal } from "@/components/shared/reveal";
import { Bone, ListRowsSkeleton } from "@/components/shared/skeletons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

/* ── Status da indicação ───────────────────────────────────────────────── */
type ReferralStatus = "registered" | "onboarded" | "verified";

interface StatusMeta {
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  badgeClass: string;
  barClass: string;
}

const STATUS_META: Record<ReferralStatus, StatusMeta> = {
  registered: {
    label: "Cadastrado",
    shortLabel: "Cadastrado",
    icon: UserPlus,
    badgeClass:
      "border-slate-400/30 bg-slate-400/10 text-slate-600 dark:border-slate-300/25 dark:bg-slate-300/10 dark:text-slate-300",
    barClass:
      "from-slate-400 to-slate-500 dark:from-slate-500 dark:to-slate-400",
  },
  onboarded: {
    label: "Onboarding completo",
    shortLabel: "Onboarding",
    icon: CheckCircle,
    badgeClass:
      "border-cyan-500/30 bg-cyan-500/12 text-cyan-700 dark:border-cyan-400/30 dark:bg-cyan-400/12 dark:text-cyan-300",
    barClass:
      "from-[#089eb8] to-[#0eb981] dark:from-[var(--brand-cyan)] dark:to-[var(--brand-mint)]",
  },
  verified: {
    label: "Verificado",
    shortLabel: "Verificado",
    icon: SealCheck,
    badgeClass:
      "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/12 dark:text-emerald-300",
    barClass:
      "from-emerald-500 to-emerald-400 dark:from-emerald-400 dark:to-[var(--brand-green)]",
  },
};

const FILTERS = [
  { key: "all", label: "Todos" },
  { key: "registered", label: "Cadastrados" },
  { key: "onboarded", label: "Onboarding" },
  { key: "verified", label: "Verificados" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

interface Referral {
  id: string;
  name: string | null;
  email: string;
  imageUrl: string | null;
  onboardingCompleted: boolean;
  verificationStatus: string;
  createdAt: Date | string;
}

function getStatus(referral: Referral): ReferralStatus {
  if (referral.verificationStatus === "VERIFIED") return "verified";
  if (referral.onboardingCompleted) return "onboarded";
  return "registered";
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const formatDate = (value: Date | string) =>
  dateFormatter.format(new Date(value));

const getInitials = (name: string | null, email: string) =>
  (name?.trim() || email).slice(0, 2).toUpperCase();

const SHARE_MESSAGE =
  "Entrei na Clipfy League e tô ganhando com os meus clipes. Cria a sua conta pelo meu link:";

/* ── Feedback de cópia ─────────────────────────────────────────────────── */
function useCopyFeedback() {
  const [copied, setCopied] = React.useState<string | null>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const copy = React.useCallback(
    async (key: string, value: string, message: string) => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(key);
        toast.success(message, { description: value });
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setCopied(null), 2200);
      } catch {
        toast.error("Não foi possível copiar automaticamente.", {
          description: "Selecione o texto e copie manualmente.",
        });
      }
    },
    [],
  );

  return { copied, copy };
}

/* ── Página ────────────────────────────────────────────────────────────── */
export default function Affiliates() {
  const utils = api.useUtils();
  const { data, isLoading, error } = api.affiliate.getMine.useQuery();
  const { copied, copy } = useCopyFeedback();
  const [filter, setFilter] = React.useState<FilterKey>("all");

  const createLink = api.affiliate.createLink.useMutation({
    onSuccess: async () => {
      await utils.affiliate.getMine.invalidate();
      toast.success("Seu link de indicação está pronto!", {
        description: "Copie e comece a convidar novos clipadores.",
      });
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });

  const affiliateUrl = data?.affiliateUrl ?? null;
  const affiliateCode = data?.affiliateCode ?? null;
  const stats = data?.stats;
  const referrals = React.useMemo<Referral[]>(
    () => data?.referrals ?? [],
    [data?.referrals],
  );

  const counts = React.useMemo(() => {
    const base = {
      all: referrals.length,
      registered: 0,
      onboarded: 0,
      verified: 0,
    };
    for (const referral of referrals) base[getStatus(referral)] += 1;
    return base;
  }, [referrals]);

  const visibleReferrals = React.useMemo(
    () =>
      filter === "all"
        ? referrals
        : referrals.filter((referral) => getStatus(referral) === filter),
    [referrals, filter],
  );

  const copyUrl = () => {
    if (!affiliateUrl) return;
    void copy("url", affiliateUrl, "Link copiado!");
  };

  if (error) {
    return (
      <AffiliateErrorCard
        message={error.message}
        showProfileCta={error.data?.code === "PRECONDITION_FAILED"}
      />
    );
  }

  const registrations = stats?.registrations ?? 0;
  const completed = stats?.completed ?? 0;
  const verified = stats?.verified ?? 0;
  const verifiedRate =
    registrations > 0 ? Math.round((verified / registrations) * 100) : 0;
  const completedRate =
    registrations > 0 ? Math.round((completed / registrations) * 100) : 0;

  const funnel = [
    { status: "registered" as const, label: "Cadastros", value: registrations },
    {
      status: "onboarded" as const,
      label: "Onboarding concluído",
      value: completed,
    },
    { status: "verified" as const, label: "Verificados", value: verified },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero ===== */}
      <HomeHero
        eyebrow="Clipfy League · Indicações"
        title={
          <>
            Convide clipadores e cresça com a sua{" "}
            <span className="text-gradient">rede</span>
          </>
        }
        subtitle="Gere o seu link exclusivo, compartilhe com quem cria conteúdo e acompanhe cada cadastro que entrou na Clipfy League por você."
        viz={<AffiliatesHeroViz />}
        vizSkeleton={<AffiliatesHeroVizSkeleton />}
        isLoading={isLoading}
        stats={[
          {
            icon: <UserPlus className="size-3.5" weight="fill" />,
            label: "Cadastros",
            value: registrations,
            kind: "int",
          },
          {
            icon: <CheckCircle className="size-3.5" weight="fill" />,
            label: "Onboardings",
            value: completed,
            kind: "int",
          },
          {
            icon: <SealCheck className="size-3.5" weight="fill" />,
            label: "Verificados",
            value: verified,
            kind: "int",
          },
        ]}
      />

      {/* ===== KPIs ===== */}
      <Reveal immediate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile
            icon={<UserPlus className="size-4" weight="fill" />}
            label="Cadastros"
            value={registrations}
            kind="int"
            hint="contas criadas pelo seu link"
            accent="cyan"
            isLoading={isLoading}
          />
          <StatTile
            icon={<CheckCircle className="size-4" weight="fill" />}
            label="Onboardings concluídos"
            value={completed}
            kind="int"
            hint={`${completedRate}% dos cadastros`}
            accent="green"
            isLoading={isLoading}
          />
          <StatTile
            icon={<SealCheck className="size-4" weight="fill" />}
            label="Verificados"
            value={verified}
            kind="int"
            hint={`${verifiedRate}% dos cadastros`}
            accent="gradient"
            gradientValue
            isLoading={isLoading}
          />
        </div>
      </Reveal>

      {/* ===== Link de indicação ===== */}
      <Reveal immediate delayMs={70}>
        <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
          <SectionHeading
            icon={<ShareNetwork className="size-4" weight="fill" />}
            title="Seu link exclusivo"
            description="Todo cadastro feito por este endereço fica vinculado a você."
          />

          {isLoading ? (
            <div aria-hidden className="flex flex-col gap-3">
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <Bone className="h-11 min-w-0 flex-1 rounded-xl" />
                <Bone delay={90} className="h-11 w-full rounded-xl sm:w-40" />
              </div>
              <Bone delay={180} className="h-14 w-full rounded-2xl" />
            </div>
          ) : affiliateUrl ? (
            <div className="flex flex-col gap-4">
              {/* campo + copiar */}
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <LinkSimple className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <Input
                    readOnly
                    value={affiliateUrl}
                    aria-label="Seu link de indicação"
                    onFocus={(event) => event.currentTarget.select()}
                    className="h-11 rounded-xl pr-3 pl-9 font-mono text-xs sm:text-[13px]"
                  />
                </div>
                <Button
                  type="button"
                  onClick={copyUrl}
                  className={cn(
                    "h-11 shrink-0 cursor-pointer rounded-xl px-5 font-semibold transition-all sm:w-auto",
                    copied === "url"
                      ? "bg-emerald-500 text-white hover:bg-emerald-500/90"
                      : "btn-gradient-auth text-[#04222A] shadow-[0_8px_30px_-10px_rgba(20,247,254,0.45)] hover:shadow-[0_10px_36px_-10px_rgba(55,250,156,0.5)]",
                  )}
                >
                  {copied === "url" ? (
                    <>
                      <Check className="size-4" weight="bold" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" />
                      Copiar link
                    </>
                  )}
                </Button>
              </div>

              {/* código em destaque + compartilhamento */}
              <div className="border-border/70 bg-muted/25 flex flex-col gap-4 rounded-2xl border border-dashed p-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="bg-gradient-custom flex size-9 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
                    <Sparkle className="size-4.5" weight="fill" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
                      Seu código
                    </p>
                    <p className="text-gradient truncate font-mono text-lg font-bold tracking-tight not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
                      {affiliateCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (affiliateCode) {
                        void copy("code", affiliateCode, "Código copiado!");
                      }
                    }}
                    aria-label="Copiar código de indicação"
                    className={cn(
                      "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-all",
                      copied === "code"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    {copied === "code" ? (
                      <Check className="size-4" weight="bold" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </button>
                </div>

                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-muted-foreground w-full text-[10px] font-semibold tracking-[0.14em] uppercase sm:w-auto">
                    Compartilhar
                  </span>
                  <ShareButton
                    href={`https://wa.me/?text=${encodeURIComponent(`${SHARE_MESSAGE} ${affiliateUrl}`)}`}
                    label="WhatsApp"
                    icon={
                      <WhatsappLogo
                        className="size-4 text-emerald-600 dark:text-emerald-400"
                        weight="fill"
                      />
                    }
                  />
                  <ShareButton
                    href={`https://t.me/share/url?url=${encodeURIComponent(affiliateUrl)}&text=${encodeURIComponent(SHARE_MESSAGE)}`}
                    label="Telegram"
                    icon={
                      <TelegramLogo
                        className="size-4 text-sky-600 dark:text-sky-400"
                        weight="fill"
                      />
                    }
                  />
                </div>
              </div>

              {/* como funciona */}
              <ol className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {[
                  {
                    icon: Copy,
                    title: "Copie o link",
                    text: "Ele é só seu e nunca expira.",
                  },
                  {
                    icon: ShareNetwork,
                    title: "Compartilhe",
                    text: "Mande para quem cria conteúdo.",
                  },
                  {
                    icon: SealCheck,
                    title: "Acompanhe",
                    text: "Veja quem entrou e se verificou.",
                  },
                ].map((step, index) => (
                  <li
                    key={step.title}
                    className="border-border/60 bg-muted/20 hover:border-brand-cyan/30 flex items-start gap-2.5 rounded-2xl border px-3 py-2.5 transition-colors"
                  >
                    <span className="bg-gradient-custom flex size-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-[#04222A]">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
                        <step.icon
                          className="text-brand-cyan not-dark:text-primary size-3.5 shrink-0"
                          weight="fill"
                        />
                        <span className="truncate">{step.title}</span>
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {step.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="bg-gradient-custom flex size-11 shrink-0 items-center justify-center rounded-2xl text-[#04222A]">
                  <LinkSimple className="size-5" weight="bold" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold sm:text-base">
                    Você ainda não tem um link de indicação
                  </p>
                  <p className="text-muted-foreground mt-1 max-w-md text-xs sm:text-sm">
                    É um clique: geramos um endereço exclusivo com o seu código
                    para você convidar novos clipadores.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => createLink.mutate()}
                disabled={createLink.isPending}
                className="btn-gradient-auth h-11 w-full shrink-0 cursor-pointer rounded-xl px-5 font-semibold text-[#04222A] shadow-[0_8px_30px_-10px_rgba(20,247,254,0.45)] transition-all hover:shadow-[0_10px_36px_-10px_rgba(55,250,156,0.5)] sm:w-auto"
              >
                {createLink.isPending ? (
                  <>
                    <CircleNotch className="size-4 animate-spin motion-reduce:animate-none" />
                    Gerando…
                  </>
                ) : (
                  <>
                    Gerar meu link
                    <ArrowRight className="size-4" weight="bold" />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </Reveal>

      {/* ===== Funil das indicações ===== */}
      <Reveal immediate delayMs={140}>
        <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
          <SectionHeading
            icon={<Users className="size-4" weight="fill" />}
            title="Funil das suas indicações"
            description="Do cadastro até o clipador verificado"
          />
          <div className="flex flex-col gap-3.5">
            {funnel.map((step, index) => {
              const meta = STATUS_META[step.status];
              const pct =
                registrations > 0
                  ? Math.max(
                      (step.value / registrations) * 100,
                      step.value > 0 ? 3 : 0,
                    )
                  : 0;
              return (
                <div key={step.status} className="flex flex-col gap-1.5">
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <meta.icon
                        className="text-muted-foreground size-3.5 shrink-0"
                        weight="fill"
                      />
                      <span className="truncate text-xs font-medium sm:text-[13px]">
                        {step.label}
                      </span>
                    </span>
                    {isLoading ? (
                      <Bone className="h-3.5 w-10 shrink-0 rounded-full" />
                    ) : (
                      <CountUp
                        value={step.value}
                        kind="int"
                        delayMs={index * 120}
                        className="shrink-0 text-xs font-bold tabular-nums sm:text-sm"
                      />
                    )}
                  </div>
                  <div className="bg-muted/60 relative h-2 w-full overflow-hidden rounded-full">
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out motion-reduce:transition-none",
                        meta.barClass,
                      )}
                      style={{ width: isLoading ? "0%" : `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* ===== Indicados ===== */}
      <Reveal immediate delayMs={210}>
        <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
          <SectionHeading
            icon={<UserPlus className="size-4" weight="fill" />}
            title="Quem entrou pelo seu link"
            description="Últimos cadastros vinculados ao seu código"
          />

          {!isLoading && referrals.length > 0 && (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {FILTERS.map((option) => {
                const isActive = filter === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setFilter(option.key)}
                    className={cn(
                      "flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-all",
                      isActive
                        ? "border-brand-cyan/40 not-dark:border-primary/40 text-foreground bg-[color-mix(in_oklab,var(--brand-cyan)_14%,transparent)]"
                        : "border-border/70 text-muted-foreground hover:border-brand-cyan/30 hover:text-foreground",
                    )}
                  >
                    {option.label}
                    <span className="tabular-nums opacity-70">
                      {counts[option.key]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {isLoading ? (
            <ListRowsSkeleton rows={6} />
          ) : referrals.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
                <Users className="size-6" weight="fill" />
              </span>
              <div className="px-4">
                <p className="text-base font-bold">
                  Você ainda não indicou ninguém
                </p>
                <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                  {affiliateUrl
                    ? "Compartilhe o seu link com quem cria conteúdo — cada cadastro aparece aqui na hora."
                    : "Gere o seu link de indicação acima e comece a convidar novos clipadores."}
                </p>
              </div>
              {affiliateUrl ? (
                <Button
                  type="button"
                  onClick={copyUrl}
                  className={cn(
                    "h-10 cursor-pointer rounded-xl px-5 font-semibold transition-all",
                    copied === "url"
                      ? "bg-emerald-500 text-white hover:bg-emerald-500/90"
                      : "btn-gradient-auth text-[#04222A] shadow-[0_8px_30px_-10px_rgba(20,247,254,0.45)]",
                  )}
                >
                  {copied === "url" ? (
                    <>
                      <Check className="size-4" weight="bold" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" />
                      Copiar meu link
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => createLink.mutate()}
                  disabled={createLink.isPending}
                  className="btn-gradient-auth h-10 cursor-pointer rounded-xl px-5 font-semibold text-[#04222A]"
                >
                  {createLink.isPending ? (
                    <CircleNotch className="size-4 animate-spin motion-reduce:animate-none" />
                  ) : (
                    <LinkSimple className="size-4" weight="bold" />
                  )}
                  Gerar meu link
                </Button>
              )}
            </div>
          ) : visibleReferrals.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="bg-muted/60 text-muted-foreground flex size-12 items-center justify-center rounded-2xl">
                <Users className="size-6" weight="fill" />
              </span>
              <p className="text-muted-foreground text-sm">
                Nenhum indicado neste status por enquanto
              </p>
            </div>
          ) : (
            <ul className="-mr-1 flex max-h-[520px] flex-col gap-1.5 overflow-y-auto pr-1">
              {visibleReferrals.map((referral, index) => {
                const meta = STATUS_META[getStatus(referral)];
                const StatusIcon = meta.icon;
                const displayName = referral.name?.trim() ?? "";
                return (
                  <li key={referral.id}>
                    <div className="hover:bg-muted/40 flex min-w-0 items-center gap-3 rounded-2xl px-2 py-2 transition-colors sm:px-2.5">
                      <span className="text-muted-foreground hidden w-6 shrink-0 text-right text-xs font-medium tabular-nums sm:block">
                        {index + 1}.
                      </span>
                      <Avatar className="size-10 shrink-0 rounded-xl">
                        <AvatarImage
                          src={referral.imageUrl ?? undefined}
                          alt={displayName || referral.email}
                        />
                        <AvatarFallback className="bg-gradient-custom rounded-xl text-xs font-bold text-[#04222A]">
                          {getInitials(referral.name, referral.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {displayName || "Sem nome"}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {referral.email}
                        </p>
                        <p className="text-muted-foreground mt-1 text-[11px] sm:hidden">
                          {formatDate(referral.createdAt)}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          meta.badgeClass,
                        )}
                      >
                        <StatusIcon className="size-3 shrink-0" weight="fill" />
                        <span className="hidden sm:inline">{meta.label}</span>
                        <span className="sm:hidden">{meta.shortLabel}</span>
                      </Badge>
                      <span className="text-muted-foreground hidden shrink-0 text-[11px] tabular-nums sm:block">
                        {formatDate(referral.createdAt)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Reveal>
    </div>
  );
}

/* ── Botão de compartilhamento externo ─────────────────────────────────── */
function ShareButton({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="border-border/70 bg-background/60 hover:border-brand-cyan/35 hover:bg-muted/50 flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-all"
    >
      {icon}
      {label}
      <ArrowSquareOut className="text-muted-foreground size-3" />
    </a>
  );
}

/* ── Estado de erro ────────────────────────────────────────────────────── */
function AffiliateErrorCard({
  message,
  showProfileCta,
}: {
  message: string;
  showProfileCta: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <Reveal immediate>
        <div className="glass-card flex flex-col items-center gap-4 rounded-3xl px-4 py-16 text-center sm:py-20">
          <span className="flex size-13 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <WarningCircle className="size-6" weight="fill" />
          </span>
          <div>
            <p className="text-base font-bold">
              Não foi possível carregar suas indicações
            </p>
            <p className="text-muted-foreground mt-1 max-w-sm text-sm">
              {message}
            </p>
          </div>
          {showProfileCta && (
            <Link
              href="/settings/profile"
              className="btn-gradient-auth inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold"
            >
              Completar meu perfil
              <ArrowRight className="size-4" weight="bold" />
            </Link>
          )}
        </div>
      </Reveal>
    </div>
  );
}
