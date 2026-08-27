"use client";

import * as React from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowsDownUp,
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  Copy,
  Crosshair,
  CurrencyDollar,
  Eye,
  Funnel,
  Globe,
  Lock,
  MagnifyingGlass,
  Play,
  ShieldCheck,
  Sparkle,
  Spinner,
  Trophy,
  UserCheck,
  UserPlus,
  UsersThree,
  Warning,
  X,
  XCircle,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { ClanTagBadge } from "@/components/clan-tag-badge";
import { Reveal } from "@/components/shared/reveal";
import { Bone } from "@/components/shared/skeletons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { platformConfig, type PlatformKey } from "@/lib/platform-config";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import { ApplicationDetailsDialog } from "./application-details-dialog";
import { ProcessPaymentDialog } from "./process-payment-dialog";
import {
  APPLICATION_STATUS_CONFIG,
  CAMPAIGN_STATUS_CONFIG,
  ConfirmWordInput,
  formatNumber,
  useFormatCurrency,
  type AdminApplication,
  type CompetitionTabProps,
} from "./shared";

/* ============================================================
   Tipos e configs locais
   ============================================================ */

type StatusFilter =
  | "all"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "UNDER_REVIEW";
type ApproveAllStep = "confirm" | "processing" | "done";
type ApproveClipperStep = "approving" | "ranking" | "email" | "done";
type CloneStep = "select" | "confirm" | "processing" | "done";

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos os Status" },
  { value: "PENDING", label: "Pendentes" },
  { value: "APPROVED", label: "Aprovados" },
  { value: "REJECTED", label: "Rejeitados" },
  { value: "UNDER_REVIEW", label: "Em Revisão" },
];

const APPROVE_STEP_SEQUENCE: ApproveClipperStep[] = [
  "approving",
  "ranking",
  "email",
  "done",
];

const APPROVE_STEP_CARDS = [
  {
    number: 1,
    base: "Aprovação",
    active: "Aprovando...",
    done: "Aprovado",
    tone: "emerald",
  },
  {
    number: 2,
    base: "Ranking",
    active: "Adicionando...",
    done: "No ranking",
    tone: "sky",
  },
  {
    number: 3,
    base: "Email",
    active: "Enviando...",
    done: "Email enviado",
    tone: "violet",
  },
] as const;

const STEP_TONES: Record<
  "emerald" | "sky" | "violet",
  {
    cardActive: string;
    cardDone: string;
    iconActive: string;
    iconDone: string;
    labelActive: string;
    labelDone: string;
  }
> = {
  emerald: {
    cardActive: "border-emerald-500/40 bg-emerald-500/10",
    cardDone: "border-emerald-500/30 bg-emerald-500/5",
    iconActive: "bg-emerald-500/20 text-emerald-500",
    iconDone: "bg-emerald-500 text-white",
    labelActive: "text-emerald-500",
    labelDone: "text-emerald-500/70",
  },
  sky: {
    cardActive: "border-sky-500/40 bg-sky-500/10",
    cardDone: "border-sky-500/30 bg-sky-500/5",
    iconActive: "bg-sky-500/20 text-sky-500",
    iconDone: "bg-sky-500 text-white",
    labelActive: "text-sky-500",
    labelDone: "text-sky-500/70",
  },
  violet: {
    cardActive: "border-violet-500/40 bg-violet-500/10",
    cardDone: "border-violet-500/30 bg-violet-500/5",
    iconActive: "bg-violet-500/20 text-violet-500",
    iconDone: "bg-violet-500 text-white",
    labelActive: "text-violet-500",
    labelDone: "text-violet-500/70",
  },
};

/* ============================================================
   Tab de Aplicações
   ============================================================ */

export function ApplicationsTab(props: CompetitionTabProps) {
  const { slug, campaignId, data, active, refetch } = props;
  const utils = api.useUtils();
  const formatCurrency = useFormatCurrency();

  /* ===== Filtros ===== */
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");

  React.useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  /* ===== Query principal ===== */
  const { data: applicationsData, isLoading: isLoadingApplications } =
    api.admin.getCompetitionApplicationsAdmin.useQuery(
      {
        slug,
        status: statusFilter !== "all" ? statusFilter : undefined,
        search: debouncedSearch || undefined,
        page: 1,
        pageSize: 200,
      },
      { enabled: active || undefined },
    );

  /* ===== Dialogs de detalhes/pagamento ===== */
  const [selectedApplication, setSelectedApplication] =
    React.useState<AdminApplication | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
  const [selectedPaymentApp, setSelectedPaymentApp] =
    React.useState<AdminApplication | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = React.useState(false);

  /* ===== Aprovar Todos ===== */
  const [isApproveAllDialogOpen, setIsApproveAllDialogOpen] =
    React.useState(false);
  const [approveAllStep, setApproveAllStep] =
    React.useState<ApproveAllStep>("confirm");
  const [approveAllProgress, setApproveAllProgress] = React.useState({
    current: 0,
    total: 0,
    approved: 0,
    errors: 0,
  });
  const [approveAllCurrentClipper, setApproveAllCurrentClipper] =
    React.useState<{
      name: string;
      imageUrl: string | null;
      step: ApproveClipperStep;
    } | null>(null);
  const [approveAllProcessedClippers, setApproveAllProcessedClippers] =
    React.useState<
      { name: string; imageUrl: string | null; status: "success" | "error" }[]
    >([]);

  const approveApplicationSingle = api.admin.approveApplication.useMutation();

  const resetApproveAllState = () => {
    setApproveAllStep("confirm");
    setApproveAllProgress({ current: 0, total: 0, approved: 0, errors: 0 });
    setApproveAllCurrentClipper(null);
    setApproveAllProcessedClippers([]);
  };

  const executeApproveAllWithProgress = async () => {
    if (!campaignId || !applicationsData?.applications) return;

    const pendingApps = applicationsData.applications.filter(
      (app) => app.status === "PENDING",
    );

    if (pendingApps.length === 0) {
      toast.info("Nenhuma aplicação pendente encontrada");
      return;
    }

    setApproveAllStep("processing");
    setApproveAllProgress({
      current: 0,
      total: pendingApps.length,
      approved: 0,
      errors: 0,
    });
    setApproveAllCurrentClipper(null);
    setApproveAllProcessedClippers([]);

    let approved = 0;
    let errors = 0;

    for (let i = 0; i < pendingApps.length; i++) {
      const app = pendingApps[i]!;
      const clipperName =
        app.clipperName || app.clipperArtisticName || "Clipador";
      const clipperImage = app.clipperImageUrl ?? null;

      setApproveAllCurrentClipper({
        name: clipperName,
        imageUrl: clipperImage,
        step: "approving",
      });

      try {
        await new Promise((r) => setTimeout(r, 150));
        setApproveAllCurrentClipper({
          name: clipperName,
          imageUrl: clipperImage,
          step: "ranking",
        });

        await approveApplicationSingle.mutateAsync({ applicationId: app.id });

        setApproveAllCurrentClipper({
          name: clipperName,
          imageUrl: clipperImage,
          step: "email",
        });
        await new Promise((r) => setTimeout(r, 200));

        setApproveAllCurrentClipper({
          name: clipperName,
          imageUrl: clipperImage,
          step: "done",
        });
        await new Promise((r) => setTimeout(r, 100));

        approved++;
        setApproveAllProcessedClippers((prev) => [
          ...prev,
          { name: clipperName, imageUrl: clipperImage, status: "success" },
        ]);
      } catch {
        errors++;
        setApproveAllProcessedClippers((prev) => [
          ...prev,
          { name: clipperName, imageUrl: clipperImage, status: "error" },
        ]);
      }

      setApproveAllProgress((prev) => ({
        ...prev,
        current: i + 1,
        approved,
        errors,
      }));
    }

    setApproveAllStep("done");
    setApproveAllCurrentClipper(null);

    if (approved > 0) {
      toast.success(`${approved} clipador(es) aprovado(s) com sucesso!`);
    }

    await Promise.all([
      utils.admin.getCompetitionDetailsAdmin.invalidate({ slug }),
      utils.admin.getCompetitionApplicationsAdmin.invalidate({ slug }),
    ]);
    refetch();
  };

  /* ===== Puxar Clipadores (clone) ===== */
  const [isCloneDialogOpen, setIsCloneDialogOpen] = React.useState(false);
  const [cloneStep, setCloneStep] = React.useState<CloneStep>("select");
  const [cloneSourceCampaignId, setCloneSourceCampaignId] = React.useState("");
  const [cloneConfirmText, setCloneConfirmText] = React.useState("");
  const [cloneProgress, setCloneProgress] = React.useState({
    current: 0,
    total: 0,
    cloned: 0,
    errors: 0,
    skipped: 0,
  });
  const [cloneCurrentClipper, setCloneCurrentClipper] = React.useState<{
    name: string;
    imageUrl: string | null;
  } | null>(null);
  const [cloneProcessedClippers, setCloneProcessedClippers] = React.useState<
    {
      name: string;
      imageUrl: string | null;
      status: "success" | "error" | "skipped";
    }[]
  >([]);

  const { data: cloneCampaignsData, isLoading: isLoadingCloneCampaigns } =
    api.admin.listCampaignsForClone.useQuery(
      { excludeCampaignId: campaignId },
      { enabled: isCloneDialogOpen && !!campaignId },
    );

  const cloneSingleMutation = api.admin.cloneSingleApplication.useMutation();
  const logCloneMutation = api.admin.logCloneCompletion.useMutation();

  const resetCloneState = () => {
    setCloneSourceCampaignId("");
    setCloneConfirmText("");
    setCloneStep("select");
    setCloneProgress({
      current: 0,
      total: 0,
      cloned: 0,
      errors: 0,
      skipped: 0,
    });
    setCloneCurrentClipper(null);
    setCloneProcessedClippers([]);
  };

  const executeCloneWithProgress = async () => {
    if (!campaignId || !cloneSourceCampaignId) return;

    const sourceCampaignName =
      cloneCampaignsData?.find((c) => c.id === cloneSourceCampaignId)?.name ??
      "";

    setCloneStep("processing");
    setCloneProgress({
      current: 0,
      total: 0,
      cloned: 0,
      errors: 0,
      skipped: 0,
    });
    setCloneCurrentClipper(null);
    setCloneProcessedClippers([]);

    try {
      // Buscar preview dos clipadores elegíveis
      const preview = await utils.admin.previewCloneApplications.fetch({
        sourceCampaignId: cloneSourceCampaignId,
        targetCampaignId: campaignId,
      });

      if (preview.eligible.length === 0) {
        toast.info(
          preview.skippedCount > 0
            ? "Todos os clipadores já estão inscritos na competição de destino"
            : "Nenhum clipador elegível encontrado na competição de origem",
        );
        setCloneStep("done");
        setCloneProgress({
          current: 0,
          total: 0,
          cloned: 0,
          errors: 0,
          skipped: preview.skippedCount,
        });
        return;
      }

      const total = preview.eligible.length;
      setCloneProgress((prev) => ({
        ...prev,
        total,
        skipped: preview.skippedCount,
      }));

      let cloned = 0;
      let errors = 0;

      // Processar um por um
      for (let i = 0; i < preview.eligible.length; i++) {
        const clipper = preview.eligible[i]!;
        setCloneCurrentClipper({
          name: clipper.fullName,
          imageUrl: clipper.imageUrl,
        });

        try {
          const result = await cloneSingleMutation.mutateAsync({
            sourceCampaignId: cloneSourceCampaignId,
            targetCampaignId: campaignId,
            clipperProfileId: clipper.clipperProfileId,
            socialAccountIds: clipper.socialAccountIds,
            autoScore: clipper.autoScore,
            sourceCampaignName,
          });

          if (result.skipped) {
            setCloneProcessedClippers((prev) => [
              ...prev,
              {
                name: clipper.fullName,
                imageUrl: clipper.imageUrl,
                status: "skipped",
              },
            ]);
          } else {
            cloned++;
            setCloneProcessedClippers((prev) => [
              ...prev,
              {
                name: clipper.fullName,
                imageUrl: clipper.imageUrl,
                status: "success",
              },
            ]);
          }
        } catch {
          errors++;
          setCloneProcessedClippers((prev) => [
            ...prev,
            {
              name: clipper.fullName,
              imageUrl: clipper.imageUrl,
              status: "error",
            },
          ]);
        }

        setCloneProgress((prev) => ({
          ...prev,
          current: i + 1,
          cloned,
          errors,
        }));
      }

      // Log de auditoria
      await logCloneMutation.mutateAsync({
        sourceCampaignId: cloneSourceCampaignId,
        sourceCampaignName,
        targetCampaignId: campaignId,
        targetCampaignName: data.campaign.name,
        totalInSource: preview.totalInSource,
        clonedCount: cloned,
        skippedCount: preview.skippedCount,
        errorsCount: errors,
      });

      setCloneStep("done");

      if (cloned > 0) {
        toast.success(`${cloned} clipador(es) puxado(s) com sucesso!`);
      }

      // Invalidar queries
      await Promise.all([
        utils.admin.getCompetitionDetailsAdmin.invalidate({ slug }),
        utils.admin.getCompetitionApplicationsAdmin.invalidate({ slug }),
      ]);
      refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao puxar clipadores",
      );
      setCloneStep("done");
    }
  };

  /* ===== Convidar Clipadores (competição privada) ===== */
  const [isInviteClippersOpen, setIsInviteClippersOpen] = React.useState(false);
  const [inviteSearch, setInviteSearch] = React.useState("");
  const [inviteSearchDebounced, setInviteSearchDebounced] = React.useState("");
  const [selectedClipperIds, setSelectedClipperIds] = React.useState<
    Set<string>
  >(new Set());
  const [invitePage, setInvitePage] = React.useState(1);

  React.useEffect(() => {
    const timeout = setTimeout(
      () => setInviteSearchDebounced(inviteSearch),
      400,
    );
    return () => clearTimeout(timeout);
  }, [inviteSearch]);

  const { data: availableClippersData, isLoading: isLoadingAvailableClippers } =
    api.admin.listAvailableClippersForCompetition.useQuery(
      {
        campaignId,
        search: inviteSearchDebounced || undefined,
        page: invitePage,
        limit: 50,
      },
      { enabled: isInviteClippersOpen && !!campaignId },
    );

  const resetInviteState = () => {
    setSelectedClipperIds(new Set());
    setInviteSearch("");
    setInviteSearchDebounced("");
    setInvitePage(1);
  };

  const enrollMultipleClippers =
    api.admin.enrollMultipleClippersInPrivateCompetition.useMutation({
      onSuccess: async (result) => {
        if (result.enrolledCount > 0) {
          toast.success(
            `${result.enrolledCount} clipador(es) inscrito(s) com sucesso!`,
            {
              description:
                result.skippedCount > 0
                  ? `${result.skippedCount} já estavam inscritos`
                  : undefined,
            },
          );
        } else {
          toast.info(result.message);
        }
        setIsInviteClippersOpen(false);
        resetInviteState();
        await Promise.all([
          utils.admin.getCompetitionDetailsAdmin.invalidate({ slug }),
          utils.admin.getCompetitionApplicationsAdmin.invalidate({ slug }),
          utils.admin.listAvailableClippersForCompetition.invalidate(),
        ]);
        refetch();
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao inscrever clipadores");
      },
    });

  const toggleClipperSelection = (clipperId: string) => {
    setSelectedClipperIds((prev) => {
      const next = new Set(prev);
      if (next.has(clipperId)) {
        next.delete(clipperId);
      } else {
        next.add(clipperId);
      }
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    if (!availableClippersData?.clippers) return;
    const visibleIds = availableClippersData.clippers.map((c) => c.id);
    const allSelected = visibleIds.every((id) => selectedClipperIds.has(id));
    setSelectedClipperIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  /* ===== Copiar listas ===== */
  const copyAllClippers = () => {
    const apps = applicationsData?.applications;
    if (!apps || apps.length === 0) {
      toast.error("Nenhum clipador disponível para copiar");
      return;
    }

    let text = `📋 LISTA DE CLIPADORES - ${data.campaign.name.toUpperCase()}\n`;
    text += `Total: ${apps.length} clipadores\n\n`;
    text += `${"=".repeat(60)}\n\n`;

    apps.forEach((app, index) => {
      const statusEmoji =
        app.status === "APPROVED"
          ? "✅"
          : app.status === "PENDING"
            ? "⏳"
            : app.status === "REJECTED"
              ? "❌"
              : "🔄";

      text += `${index + 1}. ${statusEmoji} ${app.clipperName}\n`;
      if (app.clipperArtisticName) {
        text += `   Nome Artístico: ${app.clipperArtisticName}\n`;
      }
      text += `   Email: ${app.clipperEmail || "N/A"}\n`;
      text += `   Status: ${app.status}\n`;
      text += `   Posts: ${app.postsCount}\n\n`;
    });

    text += `${"=".repeat(60)}\n`;
    text += `\n📊 RESUMO:\n`;
    text += `Total: ${apps.length} clipadores\n`;
    text += `Aprovados: ${apps.filter((app) => app.status === "APPROVED").length}\n`;
    text += `Pendentes: ${apps.filter((app) => app.status === "PENDING").length}\n`;
    text += `Rejeitados: ${apps.filter((app) => app.status === "REJECTED").length}\n`;

    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success("Lista de clipadores copiada!", {
          description: `${apps.length} clipadores copiados para área de transferência`,
        });
      })
      .catch(() => {
        toast.error("Erro ao copiar para área de transferência");
      });
  };

  const copyApprovedClippers = () => {
    const apps = applicationsData?.applications;
    if (!apps || apps.length === 0) {
      toast.error("Nenhum clipador disponível");
      return;
    }

    const approvedApps = apps.filter((app) => app.status === "APPROVED");

    if (approvedApps.length === 0) {
      toast.error("Nenhum clipador aprovado encontrado");
      return;
    }

    const platformEmoji: Record<string, string> = {
      TIKTOK: "🎵",
      INSTAGRAM: "📸",
      YOUTUBE: "▶️",
      TWITTER: "🐦",
      KWAI: "🎬",
      FACEBOOK: "📘",
    };

    let text = `✅ CLIPADORES APROVADOS - ${data.campaign.name.toUpperCase()}\n`;
    text += `Total: ${approvedApps.length} clipadores aprovados\n\n`;
    text += `${"=".repeat(60)}\n\n`;

    let totalAccountsWithPosts = 0;
    let totalAccountsWithoutPosts = 0;

    approvedApps.forEach((app, index) => {
      text += `${index + 1}. ${app.clipperName}\n`;
      if (app.clipperArtisticName) {
        text += `   Nome Artístico: ${app.clipperArtisticName}\n`;
      }
      text += `   Email: ${app.clipperEmail || "N/A"}\n`;
      text += `   CPF: ${app.clipperCpf || "N/A"}\n`;
      text += `   Chave PIX: ${app.clipperPixKey || "N/A"}\n`;
      text += `   Posts: ${app.postsCount} | Views: ${formatNumber(app.totalViews)}\n`;

      if (app.socialAccounts && app.socialAccounts.length > 0) {
        text += `\n   📱 CONTAS VINCULADAS (${app.socialAccounts.length}):\n`;
        app.socialAccounts.forEach((acc) => {
          const emoji = platformEmoji[acc.platform] || "🌐";
          const hasPostsEmoji = acc.postsCount > 0 ? "✅" : "❌";
          text += `   ${hasPostsEmoji} ${emoji} ${acc.platform} — @${acc.username}\n`;

          if (acc.postsCount > 0) {
            text += `      └─ ${acc.postsCount} post(s) | ${acc.eligiblePostsCount} elegível(is) | ${formatNumber(acc.totalViews)} views\n`;
            totalAccountsWithPosts++;
          } else {
            text += `      └─ Nenhum vídeo postado\n`;
            totalAccountsWithoutPosts++;
          }
        });
      } else {
        text += `\n   ⚠️ Nenhuma conta social vinculada\n`;
      }

      text += `\n${"─".repeat(60)}\n\n`;
    });

    text += `${"=".repeat(60)}\n`;
    text += `\n📊 RESUMO GERAL:\n`;
    text += `👥 Total de aprovados: ${approvedApps.length}\n`;
    text += `📝 Total de posts: ${approvedApps.reduce((sum, app) => sum + app.postsCount, 0)}\n`;
    text += `👁️ Total de views: ${formatNumber(approvedApps.reduce((sum, app) => sum + app.totalViews, 0))}\n`;
    text += `\n📱 CONTAS:\n`;
    text += `✅ Contas com vídeos: ${totalAccountsWithPosts}\n`;
    text += `❌ Contas sem vídeos: ${totalAccountsWithoutPosts}\n`;
    text += `📊 Total de contas: ${totalAccountsWithPosts + totalAccountsWithoutPosts}\n`;

    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success("Clipadores aprovados copiados!", {
          description: `${approvedApps.length} clipadores com detalhes de contas copiados`,
        });
      })
      .catch(() => {
        toast.error("Erro ao copiar para área de transferência");
      });
  };

  /* ===== Tabela ===== */
  const applications = React.useMemo(
    () => applicationsData?.applications ?? [],
    [applicationsData?.applications],
  );

  const [sorting, setSorting] = React.useState<SortingState>([]);

  const columns = React.useMemo<ColumnDef<AdminApplication>[]>(
    () => [
      {
        accessorKey: "clipperName",
        header: ({ column }) => (
          <SortHeader
            label="Clipador"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => {
          const app = row.original;
          const totalEarned = app.totalEarned || 0;
          return (
            <div className="flex min-w-0 items-center gap-3 py-1">
              <Avatar className="size-10 shrink-0 rounded-xl">
                <AvatarImage
                  src={app.clipperImageUrl ?? undefined}
                  alt={app.clipperName}
                />
                <AvatarFallback className="bg-gradient-custom rounded-xl text-xs font-bold text-[#04222A]">
                  {app.clipperName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="max-w-[180px] truncate text-sm font-semibold">
                  {app.clipperName}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {app.clipperArtisticName && (
                    <p className="text-muted-foreground max-w-[120px] truncate text-xs">
                      @{app.clipperArtisticName}
                    </p>
                  )}
                  {app.clanTag && (
                    <ClanTagBadge
                      tag={app.clanTag}
                      emoji={app.clanEmoji || "Shield"}
                      emojiColor={app.clanEmojiColor || "#6b7280"}
                      size="xs"
                    />
                  )}
                  {totalEarned > 0 && (
                    <Badge
                      variant="outline"
                      className="gap-1 rounded-full border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0 text-[10px] text-emerald-600 dark:text-emerald-400"
                    >
                      <CurrencyDollar className="size-2.5" weight="bold" />
                      {formatCurrency(totalEarned)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "socialAccounts",
        header: "Plataformas",
        cell: ({ row }) => {
          const accounts = row.original.socialAccounts ?? [];
          if (accounts.length === 0) {
            return <span className="text-muted-foreground text-xs">—</span>;
          }
          const platformCounts: Record<string, number> = {};
          accounts.forEach((acc) => {
            platformCounts[acc.platform] =
              (platformCounts[acc.platform] ?? 0) + 1;
          });
          return (
            <div className="flex flex-wrap gap-1">
              {Object.entries(platformCounts).map(([platform, count]) => {
                const config = platformConfig[platform as PlatformKey];
                if (!config) return null;
                const PlatformIcon = config.icon;
                return (
                  <Badge
                    key={platform}
                    variant="outline"
                    className={cn(
                      "gap-1 rounded-full px-2 py-0.5",
                      config.borderColor,
                      config.bgColor,
                      config.color,
                    )}
                  >
                    <PlatformIcon className="size-3" />
                    {count > 1 && <span className="text-[10px]">×{count}</span>}
                  </Badge>
                );
              })}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status =
            APPLICATION_STATUS_CONFIG[row.original.status] ??
            APPLICATION_STATUS_CONFIG.PENDING!;
          return (
            <Badge
              variant="outline"
              className={cn("gap-1.5 rounded-full", status.badge)}
            >
              <span
                className={cn(
                  "size-1.5 animate-pulse rounded-full",
                  status.dot,
                )}
              />
              {status.label}
            </Badge>
          );
        },
      },
      {
        accessorKey: "postsCount",
        header: ({ column }) => (
          <SortHeader
            label="Posts"
            icon={<Play className="size-3" weight="fill" />}
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => {
          const totalPosts = row.original.postsCount || 0;
          const eligiblePosts = row.original.eligiblePostsCount || 0;
          return (
            <div className="space-y-0.5 text-center">
              <div className="text-sm font-bold tabular-nums">{totalPosts}</div>
              {totalPosts > 0 && (
                <div className="text-muted-foreground text-[10px]">
                  {eligiblePosts} elegíve{eligiblePosts !== 1 ? "is" : "l"}
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "totalViews",
        header: ({ column }) => (
          <SortHeader
            label="Views"
            icon={<Eye className="size-3" weight="fill" />}
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => (
          <div className="text-center">
            <span className="text-sm font-bold tabular-nums">
              {formatNumber(row.original.totalViews || 0)}
            </span>
          </div>
        ),
      },
      {
        id: "actions",
        header: "Ações",
        cell: ({ row }) => {
          const app = row.original;
          return (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 cursor-pointer rounded-xl"
                onClick={() => {
                  setSelectedApplication(app);
                  setIsDetailsOpen(true);
                }}
              >
                <Eye className="size-3.5" />
                <span className="hidden sm:inline">Detalhes</span>
              </Button>
              {app.status === "APPROVED" && (
                <Button
                  size="sm"
                  className="h-9 cursor-pointer rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 font-semibold text-white hover:opacity-90"
                  onClick={() => {
                    setSelectedPaymentApp(app);
                    setIsPaymentOpen(true);
                  }}
                >
                  <CurrencyDollar className="size-3.5" weight="bold" />
                  <span className="hidden lg:inline">Pagar</span>
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [formatCurrency],
  );

  const table = useReactTable({
    data: applications,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
    initialState: { pagination: { pageSize: 10 } },
  });

  React.useEffect(() => {
    table.setPageIndex(0);
  }, [debouncedSearch, statusFilter, table]);

  const pendingCount = applicationsData?.pendingCount ?? 0;
  const approvedCount = applicationsData?.approvedCount ?? 0;
  const selectedCloneCampaign = cloneCampaignsData?.find(
    (c) => c.id === cloneSourceCampaignId,
  );

  /* ===== Skeleton ===== */
  if (isLoadingApplications && !applicationsData) {
    return (
      <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
        {/* Header fantasma: título + ações */}
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <Bone className="size-8 rounded-lg" />
              <Bone delay={60} className="h-6 w-36" />
            </div>
            <Bone delay={120} className="h-4 w-52 rounded-full" />
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Bone delay={180} className="h-10 w-28 rounded-xl" />
            <Bone delay={280} className="h-10 w-32 rounded-xl" />
            <Bone delay={380} className="h-10 w-32 rounded-xl" />
            <Bone delay={480} className="h-10 w-36 rounded-xl" />
          </div>
        </div>

        {/* Filtros fantasma: busca + select de status */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Bone className="h-10 min-w-0 flex-1 rounded-xl" />
          <Bone delay={120} className="h-10 w-full rounded-xl sm:w-[190px]" />
        </div>

        {/* Tabela fantasma: avatar, nome+@, plataformas, status, posts, views, ações */}
        <div className="border-border/60 overflow-hidden rounded-2xl border">
          <div className="border-border/60 bg-muted/30 flex h-12 items-center gap-4 border-b px-4">
            <Bone className="h-3 w-24 rounded-full" />
            <Bone
              delay={80}
              className="hidden h-3 w-20 rounded-full sm:block"
            />
            <Bone
              delay={160}
              className="hidden h-3 w-16 rounded-full md:block"
            />
            <Bone delay={240} className="ml-auto h-3 w-14 rounded-full" />
          </div>
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="border-border/40 flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
            >
              <Bone
                delay={index * 90}
                className="size-10 shrink-0 rounded-xl"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Bone
                  delay={index * 90 + 40}
                  className="h-3.5 w-2/5 max-w-44"
                />
                <Bone
                  delay={index * 90 + 80}
                  className="h-3 w-1/4 max-w-28 rounded-full"
                />
              </div>
              <div className="hidden gap-1 md:flex">
                <Bone
                  delay={index * 90 + 120}
                  className="h-6 w-10 rounded-full"
                />
                <Bone
                  delay={index * 90 + 160}
                  className="h-6 w-10 rounded-full"
                />
              </div>
              <Bone
                delay={index * 90 + 200}
                className="hidden h-6 w-24 rounded-full sm:block"
              />
              <Bone
                delay={index * 90 + 240}
                className="hidden h-4 w-10 lg:block"
              />
              <Bone
                delay={index * 90 + 280}
                className="hidden h-4 w-12 lg:block"
              />
              <Bone delay={index * 90 + 320} className="h-9 w-24 rounded-xl" />
            </div>
          ))}
          {/* Paginação fantasma */}
          <div className="border-border/60 flex flex-col items-center justify-between gap-3 border-t px-4 py-3.5 sm:flex-row">
            <Bone className="h-3 w-44 rounded-full" />
            <div className="flex items-center gap-2">
              <Bone delay={100} className="h-9 w-24 rounded-xl" />
              <Bone delay={200} className="h-9 w-24 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Reveal immediate>
      <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
        {/* ===== Header ===== */}
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
              <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
                <UserCheck className="size-4" weight="fill" />
              </span>
              Aplicações
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {debouncedSearch ? (
                <>
                  {applicationsData?.pagination?.totalCount ?? 0} resultado(s)
                  com a busca atual
                </>
              ) : (
                <>
                  {applicationsData?.totalCount ?? 0} aplicações no total
                  {pendingCount ? ` · ${pendingCount} pendentes` : ""}
                </>
              )}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-10 cursor-pointer rounded-xl"
              onClick={copyAllClippers}
            >
              <Copy className="size-4" weight="bold" />
              <span className="hidden sm:inline">Copiar Todos</span>
              <span className="sm:hidden">Todos</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 cursor-pointer rounded-xl"
              onClick={copyApprovedClippers}
              disabled={
                approvedCount === 0 ||
                (statusFilter !== "all" && statusFilter !== "APPROVED")
              }
            >
              <Copy className="size-4" weight="bold" />
              <span className="hidden sm:inline">Copiar Aprovados</span>
              <span className="sm:hidden">Aprovados</span>
            </Button>
            <Button
              size="sm"
              className="h-10 cursor-pointer rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 font-semibold text-white hover:opacity-90"
              onClick={() => {
                setApproveAllStep("confirm");
                setIsApproveAllDialogOpen(true);
              }}
              disabled={approveAllStep === "processing" || pendingCount === 0}
            >
              {approveAllStep === "processing" ? (
                <>
                  <Spinner className="size-4 animate-spin" />
                  Aprovando...
                </>
              ) : (
                <>
                  <CheckCircle className="size-4" weight="fill" />
                  <span className="hidden sm:inline">Aprovar Todos</span>
                  <span className="sm:hidden">Aprovar</span>
                </>
              )}
            </Button>
            <Button
              size="sm"
              className="h-10 cursor-pointer rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:from-cyan-700 hover:to-blue-700 hover:shadow-cyan-500/40"
              onClick={() => {
                resetCloneState();
                setIsCloneDialogOpen(true);
              }}
            >
              <UsersThree className="size-4" weight="fill" />
              <span className="hidden sm:inline">Puxar Clipadores</span>
              <span className="sm:hidden">Puxar</span>
            </Button>
            {data.campaign.isPrivate && (
              <Button
                size="sm"
                className="h-10 cursor-pointer rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 font-semibold text-white shadow-lg shadow-violet-500/25 transition-all duration-300 hover:from-violet-700 hover:to-purple-700 hover:shadow-violet-500/40"
                onClick={() => setIsInviteClippersOpen(true)}
              >
                <UserPlus className="size-4" weight="fill" />
                <span className="hidden sm:inline">Convidar Clipadores</span>
                <span className="sm:hidden">Convidar</span>
              </Button>
            )}
          </div>
        </div>

        {/* ===== Filtros ===== */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, email, telefone, CPF, PIX, @username..."
              className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl pl-10"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Limpar busca"
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl sm:w-[190px]">
              <Funnel className="size-4" />
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {STATUS_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span className="inline-flex items-center gap-2">
                    {option.value !== "all" && (
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          APPLICATION_STATUS_CONFIG[option.value]?.dot,
                        )}
                      />
                    )}
                    {option.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ===== Cards mobile/tablet ===== */}
        <div className="space-y-3 lg:hidden">
          {table.getRowModel().rows.length === 0 ? (
            <div className="border-border/60 text-muted-foreground rounded-2xl border px-4 py-10 text-center text-sm">
              Nenhuma aplicação encontrada
            </div>
          ) : (
            table.getRowModel().rows.map((row) => {
              const app = row.original;
              const status =
                APPLICATION_STATUS_CONFIG[app.status] ??
                APPLICATION_STATUS_CONFIG.PENDING!;

              return (
                <article
                  key={row.id}
                  className="border-border/60 bg-muted/10 flex flex-col gap-3 rounded-2xl border p-3.5"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar className="size-10 shrink-0 rounded-xl">
                      <AvatarImage
                        src={app.clipperImageUrl ?? undefined}
                        alt={app.clipperName}
                      />
                      <AvatarFallback className="bg-gradient-custom rounded-xl text-xs font-bold text-[#04222A]">
                        {app.clipperName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {app.clipperName}
                      </p>
                      {app.clipperArtisticName && (
                        <p className="text-muted-foreground truncate text-xs">
                          @{app.clipperArtisticName}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 gap-1.5 rounded-full",
                        status.badge,
                      )}
                    >
                      <span
                        className={cn("size-1.5 rounded-full", status.dot)}
                      />
                      {status.label}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <ApplicationMobileValue
                      label="Contas"
                      value={String(app.socialAccounts?.length ?? 0)}
                    />
                    <ApplicationMobileValue
                      label="Posts"
                      value={String(app.postsCount ?? 0)}
                    />
                    <ApplicationMobileValue
                      label="Views"
                      value={formatNumber(app.totalViews ?? 0)}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 flex-1 cursor-pointer rounded-xl"
                      onClick={() => {
                        setSelectedApplication(app);
                        setIsDetailsOpen(true);
                      }}
                    >
                      <Eye className="size-3.5" />
                      Detalhes
                    </Button>
                    {app.status === "APPROVED" && (
                      <Button
                        size="sm"
                        className="h-9 flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 font-semibold text-white hover:opacity-90"
                        onClick={() => {
                          setSelectedPaymentApp(app);
                          setIsPaymentOpen(true);
                        }}
                      >
                        <CurrencyDollar className="size-3.5" weight="bold" />
                        Pagar
                      </Button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* ===== Tabela desktop ===== */}
        <div className="border-border/60 hidden overflow-hidden rounded-2xl border lg:block">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="border-border/60 hover:bg-transparent"
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="text-muted-foreground bg-muted/30 h-12 px-4 text-[11px] font-semibold tracking-[0.12em] whitespace-nowrap uppercase"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="py-14">
                      <div className="flex flex-col items-center gap-4 text-center">
                        <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
                          <UserCheck className="size-6" weight="fill" />
                        </span>
                        <div>
                          <p className="text-base font-bold">
                            Nenhuma aplicação encontrada
                          </p>
                          <p className="text-muted-foreground mt-1 text-sm">
                            Tente ajustar seus filtros de busca
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="border-border/40 hover:bg-muted/30 transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className="px-4 py-3 align-middle"
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
          <div className="border-border/60 flex flex-col items-center justify-between gap-3 border-t px-4 py-3.5 sm:flex-row">
            <p className="text-muted-foreground text-xs">
              {table.getFilteredRowModel().rows.length} aplicações · Página{" "}
              <span className="text-foreground font-semibold">
                {table.getState().pagination.pageIndex + 1}
              </span>{" "}
              de {Math.max(table.getPageCount(), 1)}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 cursor-pointer rounded-xl"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <CaretLeft className="size-3.5" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 cursor-pointer rounded-xl"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Próxima
                <CaretRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* ===== Dialog: Detalhes da Aplicação ===== */}
        <ApplicationDetailsDialog
          application={selectedApplication}
          open={isDetailsOpen}
          onOpenChange={(open) => {
            setIsDetailsOpen(open);
            if (!open) setSelectedApplication(null);
          }}
          slug={slug}
          campaignId={campaignId}
        />

        {/* ===== Dialog: Processar Pagamento ===== */}
        <ProcessPaymentDialog
          application={selectedPaymentApp}
          open={isPaymentOpen}
          onOpenChange={(open) => {
            setIsPaymentOpen(open);
            if (!open) setSelectedPaymentApp(null);
          }}
          slug={slug}
          campaignId={campaignId}
        />

        {/* ===== Dialog: Aprovar Todos ===== */}
        <Dialog
          open={isApproveAllDialogOpen}
          onOpenChange={(open) => {
            if (!open && approveAllStep !== "processing") {
              resetApproveAllState();
            }
            if (approveAllStep !== "processing") {
              setIsApproveAllDialogOpen(open);
            }
          }}
        >
          <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-[560px]">
            <DialogHeader className="text-left">
              <DialogTitle className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-green-500/20">
                  <UserCheck
                    className="size-5 text-emerald-500"
                    weight="fill"
                  />
                </span>
                <span>
                  <span className="text-lg">Aprovar Todos os Clipadores</span>
                  <span className="text-muted-foreground mt-0.5 block text-sm font-normal">
                    Aprovação em massa dos pendentes
                  </span>
                </span>
              </DialogTitle>
            </DialogHeader>

            {approveAllStep === "confirm" ? (
              <div className="flex flex-col gap-4 py-2">
                {/* Info */}
                <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-green-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20">
                      <Sparkle
                        className="size-4 text-emerald-500"
                        weight="fill"
                      />
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        O que vai acontecer?
                      </p>
                      <ul className="text-muted-foreground flex flex-col gap-1.5 text-xs">
                        {[
                          "Cada clipador pendente será aprovado individualmente",
                          "Serão adicionados aos rankings mensais da campanha",
                          "Cada um receberá um email de aprovação",
                          "Você acompanhará o progresso em tempo real",
                        ].map((item) => (
                          <li key={item} className="flex items-center gap-1.5">
                            <span className="size-1 shrink-0 rounded-full bg-emerald-400" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Pendentes */}
                <div className="flex items-center justify-between rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-3">
                  <div className="flex items-center gap-2">
                    <Warning
                      className="size-4 shrink-0 text-amber-500"
                      weight="fill"
                    />
                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                      Clipadores pendentes
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="rounded-full border-amber-500/30 bg-amber-500/10 px-3 text-sm font-bold text-amber-600 tabular-nums dark:text-amber-400"
                  >
                    {pendingCount}
                  </Badge>
                </div>

                {/* Campanha */}
                <div className="rounded-xl border border-emerald-500/15 bg-gradient-to-r from-emerald-500/5 to-green-500/5 p-3">
                  <div className="flex items-center gap-2">
                    <Trophy
                      className="size-4 shrink-0 text-emerald-500"
                      weight="fill"
                    />
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Campanha:
                    </span>
                    <span className="truncate text-sm font-semibold">
                      {data.campaign.name}
                    </span>
                  </div>
                </div>

                {/* Etapas */}
                <div className="border-border/40 bg-muted/20 flex flex-col gap-2.5 rounded-2xl border p-4">
                  <p className="text-muted-foreground mb-1 text-xs font-semibold">
                    Etapas por clipador:
                  </p>
                  {[
                    {
                      n: 1,
                      label: "Aprovação da inscrição",
                      className:
                        "border-emerald-500/30 bg-emerald-500/15 text-emerald-500",
                    },
                    {
                      n: 2,
                      label: "Adição ao ranking mensal",
                      className: "border-sky-500/30 bg-sky-500/15 text-sky-500",
                    },
                    {
                      n: 3,
                      label: "Envio do email de aprovação",
                      className:
                        "border-violet-500/30 bg-violet-500/15 text-violet-500",
                    },
                  ].map((step) => (
                    <div
                      key={step.n}
                      className="flex items-center gap-3 text-xs"
                    >
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full border text-[10px] font-bold",
                          step.className,
                        )}
                      >
                        {step.n}
                      </span>
                      <span className="text-muted-foreground">
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>

                <DialogFooter className="gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="cursor-pointer rounded-xl"
                    onClick={() => setIsApproveAllDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="cursor-pointer gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 font-semibold text-white shadow-lg shadow-emerald-500/25 hover:opacity-90"
                    onClick={() => void executeApproveAllWithProgress()}
                  >
                    <CheckCircle className="size-4" weight="fill" />
                    Aprovar Todos
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="flex flex-col gap-5 py-2">
                {/* Header de progresso */}
                <div className="flex flex-col items-center gap-3 text-center">
                  {approveAllStep === "processing" ? (
                    <>
                      <div className="relative size-16">
                        <span className="absolute inset-0 animate-ping rounded-full bg-gradient-to-r from-emerald-500/20 to-green-500/20" />
                        <span className="relative flex size-16 items-center justify-center rounded-full border border-emerald-500/40 bg-gradient-to-br from-emerald-500/30 to-green-500/30">
                          <Spinner className="size-7 animate-spin text-emerald-500" />
                        </span>
                      </div>
                      <div>
                        <p className="bg-gradient-to-r from-emerald-500 to-green-500 bg-clip-text text-base font-bold text-transparent">
                          Aprovando Clipadores...
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          Aguarde, não feche esta janela
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="relative size-16">
                        <span className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-r from-emerald-500/20 to-green-500/20" />
                        <span className="relative flex size-16 items-center justify-center rounded-full border border-emerald-500/40 bg-gradient-to-br from-emerald-500/30 to-green-500/30">
                          <Check
                            className="size-8 text-emerald-500"
                            weight="bold"
                          />
                        </span>
                      </div>
                      <div>
                        <p className="bg-gradient-to-r from-emerald-500 to-green-500 bg-clip-text text-base font-bold text-transparent">
                          Aprovação Concluída!
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          Todos os clipadores foram processados
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Barra de progresso */}
                {approveAllProgress.total > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">
                        {approveAllProgress.current} de{" "}
                        {approveAllProgress.total} processados
                      </span>
                      <span className="font-bold text-emerald-500 tabular-nums">
                        {Math.round(
                          (approveAllProgress.current /
                            approveAllProgress.total) *
                            100,
                        )}
                        %
                      </span>
                    </div>
                    <div className="border-border/30 bg-muted/50 relative h-3 w-full overflow-hidden rounded-full border">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-400 transition-all duration-500 ease-out"
                        style={{
                          width: `${(approveAllProgress.current / approveAllProgress.total) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-center gap-4 pt-1 text-[11px]">
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        <span className="text-muted-foreground">
                          Aprovados:
                        </span>
                        <span className="font-bold text-emerald-500 tabular-nums">
                          {approveAllProgress.approved}
                        </span>
                      </span>
                      {approveAllProgress.errors > 0 && (
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-red-500" />
                          <span className="text-muted-foreground">Erros:</span>
                          <span className="font-bold text-red-500 tabular-nums">
                            {approveAllProgress.errors}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Clipador atual + etapas */}
                {approveAllStep === "processing" &&
                  approveAllCurrentClipper && (
                    <div className="flex flex-col gap-3 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 to-green-500/5 p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <span className="absolute -inset-1 animate-pulse rounded-full bg-gradient-to-r from-emerald-500/40 to-green-500/40" />
                          <Avatar className="relative size-10 border-2 border-emerald-500/50">
                            <AvatarImage
                              src={
                                approveAllCurrentClipper.imageUrl ?? undefined
                              }
                              alt={approveAllCurrentClipper.name}
                            />
                            <AvatarFallback className="bg-gradient-to-br from-emerald-500/30 to-green-500/30 text-xs font-bold">
                              {approveAllCurrentClipper.name
                                .charAt(0)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {approveAllCurrentClipper.name}
                          </p>
                          <p className="text-[11px] font-medium text-emerald-500">
                            Processando agora...
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {APPROVE_STEP_CARDS.map((card, index) => {
                          const currentIndex = APPROVE_STEP_SEQUENCE.indexOf(
                            approveAllCurrentClipper.step,
                          );
                          const state =
                            currentIndex > index
                              ? "done"
                              : currentIndex === index
                                ? "active"
                                : "pending";
                          return (
                            <ApproveStepCard
                              key={card.number}
                              card={card}
                              state={state}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                {/* Lista de processados */}
                {approveAllProcessedClippers.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-muted-foreground flex items-center gap-2 text-xs font-semibold">
                      <UserCheck className="size-3.5" weight="fill" />
                      Clipadores processados (
                      {approveAllProcessedClippers.length})
                    </p>
                    <div className="border-border/40 bg-muted/20 divide-border/30 max-h-[200px] divide-y overflow-y-auto rounded-2xl border">
                      {approveAllProcessedClippers.map((clipper, index) => (
                        <ProcessedClipperRow
                          key={index}
                          name={clipper.name}
                          imageUrl={clipper.imageUrl}
                          badge={
                            clipper.status === "success" ? (
                              <Badge
                                variant="outline"
                                className="shrink-0 gap-1 rounded-full border-emerald-500/30 bg-emerald-500/10 py-0 text-[10px] text-emerald-600 dark:text-emerald-400"
                              >
                                <Check className="size-3" weight="bold" />
                                Aprovado
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="shrink-0 gap-1 rounded-full border-red-500/30 bg-red-500/10 py-0 text-[10px] text-red-500"
                              >
                                <X className="size-3" weight="bold" />
                                Erro
                              </Badge>
                            )
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Concluído */}
                {approveAllStep === "done" && (
                  <DialogFooter className="pt-2">
                    <Button
                      className="w-full cursor-pointer gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 font-semibold text-white shadow-lg shadow-emerald-500/25 hover:opacity-90"
                      onClick={() => {
                        setIsApproveAllDialogOpen(false);
                        resetApproveAllState();
                      }}
                    >
                      <Check className="size-4" weight="bold" />
                      Fechar
                    </Button>
                  </DialogFooter>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ===== Dialog: Puxar Clipadores (clone) ===== */}
        <Dialog
          open={isCloneDialogOpen}
          onOpenChange={(open) => {
            if (!open && cloneStep !== "processing") {
              resetCloneState();
            }
            if (cloneStep !== "processing") {
              setIsCloneDialogOpen(open);
            }
          }}
        >
          <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-[600px]">
            <DialogHeader className="text-left">
              <DialogTitle className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-cyan-500/30 bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
                  <UsersThree className="size-5 text-cyan-500" weight="fill" />
                </span>
                <span>
                  <span className="text-lg">Puxar Clipadores</span>
                  <span className="text-muted-foreground mt-0.5 block text-sm font-normal">
                    Clone aplicações de outra competição
                  </span>
                </span>
              </DialogTitle>
            </DialogHeader>

            {cloneStep === "select" ? (
              <div className="flex flex-col gap-4 py-2">
                {/* Info */}
                <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20">
                      <Sparkle className="size-4 text-cyan-500" weight="fill" />
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-cyan-600 dark:text-cyan-400">
                        Como funciona?
                      </p>
                      <ul className="text-muted-foreground flex flex-col gap-1 text-xs">
                        <li className="flex items-center gap-1.5">
                          <span className="size-1 shrink-0 rounded-full bg-cyan-400" />
                          Todos os clipadores aprovados/pendentes serão copiados
                        </li>
                        <li className="flex flex-wrap items-center gap-1.5">
                          <span className="size-1 shrink-0 rounded-full bg-cyan-400" />
                          Entrarão com status{" "}
                          <Badge
                            variant="outline"
                            className="rounded-full border-amber-500/30 bg-amber-500/15 px-1.5 py-0 text-[10px] font-semibold text-amber-600 dark:text-amber-400"
                          >
                            Pendente
                          </Badge>
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="size-1 shrink-0 rounded-full bg-cyan-400" />
                          Clipadores já inscritos serão ignorados
                          automaticamente
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="size-1 shrink-0 rounded-full bg-cyan-400" />
                          A competição de origem não será alterada
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Destino */}
                <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 to-green-500/10 p-3">
                  <div className="flex items-center gap-2">
                    <Crosshair
                      className="size-4 shrink-0 text-emerald-500"
                      weight="bold"
                    />
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Destino:
                    </span>
                    <span className="truncate text-sm font-semibold">
                      {data.campaign.name}
                    </span>
                  </div>
                </div>

                {/* Origem */}
                <div className="flex flex-col gap-2">
                  <Label className="flex items-center gap-2 text-sm font-semibold">
                    <Globe className="size-4 text-cyan-500" weight="fill" />
                    Selecione a competição de origem
                  </Label>
                  {isLoadingCloneCampaigns ? (
                    <div className="flex items-center justify-center py-6">
                      <Spinner className="size-5 animate-spin text-cyan-500" />
                      <span className="text-muted-foreground ml-2 text-sm">
                        Carregando competições...
                      </span>
                    </div>
                  ) : (
                    <div className="flex max-h-[280px] flex-col gap-2 overflow-y-auto pr-1">
                      {cloneCampaignsData?.map((campaign) => {
                        const isSelected =
                          cloneSourceCampaignId === campaign.id;
                        const statusCfg =
                          CAMPAIGN_STATUS_CONFIG[campaign.status] ??
                          CAMPAIGN_STATUS_CONFIG.DRAFT!;
                        return (
                          <button
                            key={campaign.id}
                            type="button"
                            onClick={() =>
                              setCloneSourceCampaignId(campaign.id)
                            }
                            className={cn(
                              "group flex w-full cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all",
                              isSelected
                                ? "border-cyan-500/50 bg-cyan-500/10 shadow-lg shadow-cyan-500/10"
                                : "border-border/50 bg-muted/10 hover:bg-muted/30 hover:border-cyan-500/30",
                            )}
                          >
                            <span
                              className={cn(
                                "flex size-10 shrink-0 items-center justify-center rounded-xl transition-all",
                                isSelected
                                  ? "bg-gradient-to-br from-cyan-500 to-blue-500 text-white shadow-md shadow-cyan-500/30"
                                  : "bg-muted/50 text-muted-foreground group-hover:bg-cyan-500/10 group-hover:text-cyan-500",
                              )}
                            >
                              <Trophy className="size-5" weight="fill" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="truncate text-sm font-semibold">
                                  {campaign.name}
                                </span>
                                {campaign.isPrivate && (
                                  <Lock
                                    className="size-3 shrink-0 text-violet-500"
                                    weight="fill"
                                  />
                                )}
                              </span>
                              <span className="mt-1 flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "rounded-full px-1.5 py-0 text-[10px] font-semibold",
                                    statusCfg.badge,
                                  )}
                                >
                                  {statusCfg.label}
                                </Badge>
                                <span className="text-muted-foreground text-xs">
                                  {campaign._count.applications} clipador(es)
                                </span>
                              </span>
                            </span>
                            {isSelected && (
                              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-white">
                                <Check className="size-3.5" weight="bold" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {cloneCampaignsData?.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <Trophy
                            className="text-muted-foreground/30 mb-3 size-10"
                            weight="fill"
                          />
                          <p className="text-muted-foreground text-sm">
                            Nenhuma competição disponível
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <DialogFooter className="gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="cursor-pointer rounded-xl"
                    onClick={() => setIsCloneDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="cursor-pointer gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 font-semibold text-white shadow-lg shadow-cyan-500/25 hover:from-cyan-700 hover:to-blue-700"
                    onClick={() => setCloneStep("confirm")}
                    disabled={!cloneSourceCampaignId}
                  >
                    Continuar
                    <CaretRight className="size-4" />
                  </Button>
                </DialogFooter>
              </div>
            ) : cloneStep === "confirm" ? (
              <div className="flex flex-col gap-4 py-2">
                {/* Aviso */}
                <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <Warning
                      className="mt-0.5 size-5 shrink-0 text-amber-500"
                      weight="fill"
                    />
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                        Atenção — Ação irreversível
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Você está prestes a puxar todos os clipadores da
                        competição{" "}
                        <strong className="text-foreground">
                          {selectedCloneCampaign?.name}
                        </strong>{" "}
                        para a competição{" "}
                        <strong className="text-foreground">
                          {data.campaign.name}
                        </strong>
                        .
                      </p>
                    </div>
                  </div>
                </div>

                {/* Visual de transferência */}
                <div className="flex items-center justify-center gap-3 py-3">
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <span className="border-border/50 from-muted/80 to-muted/40 flex size-14 items-center justify-center rounded-2xl border bg-gradient-to-br">
                      <Trophy
                        className="text-muted-foreground size-7"
                        weight="fill"
                      />
                    </span>
                    <span className="text-muted-foreground max-w-[140px] truncate text-center text-xs font-medium">
                      {selectedCloneCampaign?.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="gap-1 rounded-full py-0 text-[10px]"
                    >
                      <UsersThree className="size-3" weight="fill" />
                      {selectedCloneCampaign?._count.applications ?? 0}{" "}
                      clipadores
                    </Badge>
                  </div>
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <span className="flex size-10 animate-pulse items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30">
                      <CaretRight className="size-5" weight="bold" />
                    </span>
                    <span className="text-[10px] font-semibold text-cyan-500">
                      CLONAR
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <span className="flex size-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-green-500/20">
                      <Trophy
                        className="size-7 text-emerald-500"
                        weight="fill"
                      />
                    </span>
                    <span className="max-w-[140px] truncate text-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      {data.campaign.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="gap-1 rounded-full border-emerald-500/30 py-0 text-[10px] text-emerald-600 dark:text-emerald-400"
                    >
                      <Crosshair className="size-3" weight="bold" />
                      Destino
                    </Badge>
                  </div>
                </div>

                {/* Confirmação */}
                <ConfirmWordInput
                  word="CONFIRMAR"
                  value={cloneConfirmText}
                  onChange={setCloneConfirmText}
                  id="clone-confirm"
                />

                <DialogFooter className="gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="cursor-pointer gap-1.5 rounded-xl"
                    onClick={() => setCloneStep("select")}
                  >
                    <CaretLeft className="size-4" />
                    Voltar
                  </Button>
                  <Button
                    className="cursor-pointer gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 font-semibold text-white shadow-lg shadow-cyan-500/25 hover:from-cyan-700 hover:to-blue-700 disabled:opacity-50"
                    onClick={() => void executeCloneWithProgress()}
                    disabled={cloneConfirmText !== "CONFIRMAR"}
                  >
                    <UsersThree className="size-4" weight="fill" />
                    Puxar Clipadores
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="flex flex-col gap-5 py-2">
                {/* Header de progresso */}
                <div className="flex flex-col items-center gap-3 text-center">
                  {cloneStep === "processing" ? (
                    <>
                      <div className="relative size-16">
                        <span className="absolute inset-0 animate-ping rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20" />
                        <span className="relative flex size-16 items-center justify-center rounded-full border border-cyan-500/40 bg-gradient-to-br from-cyan-500/30 to-blue-500/30">
                          <Spinner className="size-7 animate-spin text-cyan-500" />
                        </span>
                      </div>
                      <div>
                        <p className="bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-base font-bold text-transparent">
                          Puxando Clipadores...
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          Aguarde, não feche esta janela
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="relative size-16">
                        <span className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-r from-emerald-500/20 to-green-500/20" />
                        <span className="relative flex size-16 items-center justify-center rounded-full border border-emerald-500/40 bg-gradient-to-br from-emerald-500/30 to-green-500/30">
                          <Check
                            className="size-8 text-emerald-500"
                            weight="bold"
                          />
                        </span>
                      </div>
                      <div>
                        <p className="bg-gradient-to-r from-emerald-500 to-green-500 bg-clip-text text-base font-bold text-transparent">
                          Concluído!
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          Todos os clipadores foram processados
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Barra de progresso */}
                {cloneProgress.total > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">
                        {cloneProgress.current} de {cloneProgress.total}{" "}
                        processados
                      </span>
                      <span className="font-bold text-cyan-500 tabular-nums">
                        {Math.round(
                          (cloneProgress.current / cloneProgress.total) * 100,
                        )}
                        %
                      </span>
                    </div>
                    <div className="border-border/30 bg-muted/50 relative h-3 w-full overflow-hidden rounded-full border">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-400 transition-all duration-500 ease-out"
                        style={{
                          width: `${(cloneProgress.current / cloneProgress.total) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-4 pt-1 text-[11px]">
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        <span className="text-muted-foreground">Puxados:</span>
                        <span className="font-bold text-emerald-500 tabular-nums">
                          {cloneProgress.cloned}
                        </span>
                      </span>
                      {cloneProgress.skipped > 0 && (
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-amber-500" />
                          <span className="text-muted-foreground">
                            Já inscritos:
                          </span>
                          <span className="font-bold text-amber-500 tabular-nums">
                            {cloneProgress.skipped}
                          </span>
                        </span>
                      )}
                      {cloneProgress.errors > 0 && (
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-red-500" />
                          <span className="text-muted-foreground">Erros:</span>
                          <span className="font-bold text-red-500 tabular-nums">
                            {cloneProgress.errors}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Clipador atual */}
                {cloneStep === "processing" && cloneCurrentClipper && (
                  <div className="flex items-center gap-3 rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 p-3">
                    <div className="relative shrink-0">
                      <span className="absolute -inset-1 animate-pulse rounded-full bg-gradient-to-r from-cyan-500/40 to-blue-500/40" />
                      <Avatar className="relative size-10 border-2 border-cyan-500/50">
                        <AvatarImage
                          src={cloneCurrentClipper.imageUrl ?? undefined}
                          alt={cloneCurrentClipper.name}
                        />
                        <AvatarFallback className="bg-gradient-to-br from-cyan-500/30 to-blue-500/30 text-xs font-bold">
                          {cloneCurrentClipper.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {cloneCurrentClipper.name}
                      </p>
                      <p className="flex items-center gap-1.5 text-[11px] font-medium text-cyan-500">
                        <Spinner className="size-3 animate-spin" />
                        Processando agora...
                      </p>
                    </div>
                  </div>
                )}

                {/* Lista de processados */}
                {cloneProcessedClippers.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-muted-foreground flex items-center gap-2 text-xs font-semibold">
                      <UsersThree className="size-3.5" weight="fill" />
                      Clipadores processados ({cloneProcessedClippers.length})
                    </p>
                    <div className="border-border/40 bg-muted/20 divide-border/30 max-h-[200px] divide-y overflow-y-auto rounded-2xl border">
                      {cloneProcessedClippers.map((clipper, index) => (
                        <ProcessedClipperRow
                          key={index}
                          name={clipper.name}
                          imageUrl={clipper.imageUrl}
                          badge={
                            clipper.status === "success" ? (
                              <Badge
                                variant="outline"
                                className="shrink-0 gap-1 rounded-full border-emerald-500/30 bg-emerald-500/10 py-0 text-[10px] text-emerald-600 dark:text-emerald-400"
                              >
                                <Check className="size-3" weight="bold" />
                                Puxado
                              </Badge>
                            ) : clipper.status === "skipped" ? (
                              <Badge
                                variant="outline"
                                className="shrink-0 gap-1 rounded-full border-amber-500/30 bg-amber-500/10 py-0 text-[10px] text-amber-600 dark:text-amber-400"
                              >
                                <Warning className="size-3" weight="fill" />
                                Já inscrito
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="shrink-0 gap-1 rounded-full border-red-500/30 bg-red-500/10 py-0 text-[10px] text-red-500"
                              >
                                <X className="size-3" weight="bold" />
                                Erro
                              </Badge>
                            )
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Concluído */}
                {cloneStep === "done" && (
                  <DialogFooter className="pt-2">
                    <Button
                      className="w-full cursor-pointer gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 font-semibold text-white shadow-lg shadow-emerald-500/25 hover:opacity-90"
                      onClick={() => {
                        setIsCloneDialogOpen(false);
                        resetCloneState();
                      }}
                    >
                      <Check className="size-4" weight="bold" />
                      Fechar
                    </Button>
                  </DialogFooter>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ===== Dialog: Convidar Clipadores ===== */}
        <Dialog
          open={isInviteClippersOpen}
          onOpenChange={(open) => {
            setIsInviteClippersOpen(open);
            if (!open) resetInviteState();
          }}
        >
          <DialogContent className="flex max-h-[90vh] w-[96vw] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-2xl">
            {/* Header */}
            <div className="border-border/60 shrink-0 border-b bg-gradient-to-br from-violet-500/5 via-purple-500/5 to-fuchsia-500/5 px-5 pt-5 pb-4">
              <DialogHeader className="text-left">
                <DialogTitle className="flex items-center gap-2.5 text-lg">
                  <span className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/20 to-purple-500/20 p-2">
                    <UserPlus
                      className="size-5 text-violet-500"
                      weight="fill"
                    />
                  </span>
                  Convidar Clipadores
                </DialogTitle>
                <DialogDescription className="mt-1.5 text-sm">
                  Selecione os clipadores verificados para inscrever nesta
                  competição privada. Eles serão adicionados com status{" "}
                  <span className="font-medium text-amber-500">pendente</span>.
                </DialogDescription>
              </DialogHeader>

              {/* Busca */}
              <div className="relative mt-4">
                <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
                <Input
                  placeholder="Buscar por nome, email, telefone..."
                  value={inviteSearch}
                  onChange={(e) => {
                    setInviteSearch(e.target.value);
                    setInvitePage(1);
                  }}
                  className="h-10 rounded-xl border-violet-500/20 pl-10 focus-visible:border-violet-500/40 focus-visible:ring-violet-500/30"
                />
              </div>
            </div>

            {/* Barra de seleção */}
            <div className="border-border/60 bg-muted/30 flex shrink-0 items-center justify-between border-b px-5 py-2.5">
              <div className="flex items-center gap-3">
                {availableClippersData?.clippers &&
                  availableClippersData.clippers.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleSelectAllVisible}
                      className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-2 text-sm transition-colors"
                    >
                      <Checkbox
                        checked={
                          availableClippersData.clippers.length > 0 &&
                          availableClippersData.clippers.every((c) =>
                            selectedClipperIds.has(c.id),
                          )
                        }
                        className="pointer-events-none data-[state=checked]:border-violet-500 data-[state=checked]:bg-violet-500"
                      />
                      <span className="text-xs font-medium">
                        Selecionar todos
                      </span>
                    </button>
                  )}
              </div>
              <div className="flex items-center gap-2">
                {selectedClipperIds.size > 0 && (
                  <Badge
                    variant="outline"
                    className="gap-1.5 rounded-full border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-violet-600 dark:text-violet-400"
                  >
                    <UserPlus className="size-3" weight="fill" />
                    <span className="text-xs font-semibold">
                      {selectedClipperIds.size}
                    </span>
                    <span className="text-xs">
                      selecionado{selectedClipperIds.size !== 1 ? "s" : ""}
                    </span>
                  </Badge>
                )}
                {availableClippersData && (
                  <span className="text-muted-foreground text-xs">
                    {availableClippersData.total} disponíve
                    {availableClippersData.total !== 1 ? "is" : "l"}
                  </span>
                )}
              </div>
            </div>

            {/* Lista */}
            <div className="max-h-[50vh] min-h-0 flex-1 overflow-y-auto">
              <div className="flex flex-col gap-1.5 px-5 py-3">
                {isLoadingAvailableClippers ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 rounded-2xl p-3"
                    >
                      <Bone delay={index * 100} className="size-4 rounded" />
                      <Bone
                        delay={index * 100 + 50}
                        className="size-10 rounded-full"
                      />
                      <div className="flex flex-1 flex-col gap-2">
                        <Bone
                          delay={index * 100 + 100}
                          className="h-3.5 w-32"
                        />
                        <Bone
                          delay={index * 100 + 150}
                          className="h-3 w-48 rounded-full"
                        />
                      </div>
                    </div>
                  ))
                ) : availableClippersData?.clippers &&
                  availableClippersData.clippers.length > 0 ? (
                  availableClippersData.clippers.map((clipper) => {
                    const isSelected = selectedClipperIds.has(clipper.id);
                    return (
                      <button
                        key={clipper.id}
                        type="button"
                        onClick={() => toggleClipperSelection(clipper.id)}
                        className={cn(
                          "group flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-3 text-left transition-all duration-200",
                          isSelected
                            ? "border-violet-500/30 bg-violet-500/10 shadow-sm shadow-violet-500/10"
                            : "hover:bg-muted/50 hover:border-border/50 border-transparent bg-transparent",
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          className="pointer-events-none shrink-0 data-[state=checked]:border-violet-500 data-[state=checked]:bg-violet-500"
                        />
                        <Avatar
                          className={cn(
                            "size-10 shrink-0 rounded-xl ring-2 transition-all duration-200",
                            isSelected
                              ? "ring-violet-500/50"
                              : "group-hover:ring-muted-foreground/20 ring-transparent",
                          )}
                        >
                          <AvatarImage
                            src={clipper.imageUrl ?? undefined}
                            alt={clipper.fullName}
                          />
                          <AvatarFallback className="rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 text-xs font-bold">
                            {clipper.fullName?.slice(0, 2).toUpperCase() ||
                              "??"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-semibold">
                              {clipper.fullName}
                            </span>
                            {clipper.artisticName && (
                              <span className="text-muted-foreground truncate text-xs">
                                @{clipper.artisticName}
                              </span>
                            )}
                            <Badge
                              variant="outline"
                              className="h-4 shrink-0 gap-1 rounded-full border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[10px] text-emerald-600 dark:text-emerald-400"
                            >
                              <ShieldCheck className="size-2.5" weight="fill" />
                              Verificado
                            </Badge>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-3">
                            <span className="text-muted-foreground truncate text-xs">
                              {clipper.email}
                            </span>
                            <span className="flex items-center gap-1.5">
                              {clipper.instagramUsernames &&
                                clipper.instagramUsernames.length > 0 && (
                                  <platformConfig.INSTAGRAM.icon className="size-3 text-pink-400/70" />
                                )}
                              {clipper.tiktokUsernames &&
                                clipper.tiktokUsernames.length > 0 && (
                                  <platformConfig.TIKTOK.icon className="size-3 text-cyan-400/70" />
                                )}
                              {clipper.youtubeUsernames &&
                                clipper.youtubeUsernames.length > 0 && (
                                  <platformConfig.YOUTUBE.icon className="size-3 text-red-400/70" />
                                )}
                            </span>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-full transition-all duration-200",
                            isSelected
                              ? "scale-100 bg-gradient-to-r from-violet-500 to-purple-500"
                              : "scale-0 bg-transparent",
                          )}
                        >
                          <CheckCircle
                            className="size-3.5 text-white"
                            weight="fill"
                          />
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <span className="bg-muted/50 mb-4 rounded-2xl p-4">
                      <UsersThree
                        className="text-muted-foreground size-10"
                        weight="fill"
                      />
                    </span>
                    <h3 className="mb-1 text-sm font-bold">
                      Nenhum clipador disponível
                    </h3>
                    <p className="text-muted-foreground max-w-xs text-xs">
                      {inviteSearchDebounced
                        ? "Nenhum clipador verificado encontrado para esta busca. Tente outro termo."
                        : "Todos os clipadores verificados já estão inscritos nesta competição."}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Paginação */}
            {availableClippersData && availableClippersData.totalPages > 1 && (
              <div className="border-border/60 flex shrink-0 items-center justify-between border-t px-5 py-2">
                <span className="text-muted-foreground text-xs">
                  Página {availableClippersData.page} de{" "}
                  {availableClippersData.totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 cursor-pointer rounded-xl text-xs"
                    disabled={invitePage <= 1}
                    onClick={() => setInvitePage((p) => Math.max(1, p - 1))}
                  >
                    <CaretLeft className="size-3" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 cursor-pointer rounded-xl text-xs"
                    disabled={invitePage >= availableClippersData.totalPages}
                    onClick={() => setInvitePage((p) => p + 1)}
                  >
                    Próxima
                    <CaretRight className="size-3" />
                  </Button>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="border-border/60 bg-muted/20 shrink-0 border-t px-5 py-4">
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                {selectedClipperIds.size > 0 && (
                  <div className="flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 sm:mr-auto">
                    <Lock className="size-3.5 text-violet-500" weight="fill" />
                    <span className="text-xs text-violet-600 dark:text-violet-300">
                      <span className="font-bold">
                        {selectedClipperIds.size}
                      </span>{" "}
                      clipador{selectedClipperIds.size !== 1 ? "es" : ""} será
                      {selectedClipperIds.size !== 1 ? "ão" : ""} inscrito
                      {selectedClipperIds.size !== 1 ? "s" : ""} como{" "}
                      <span className="font-semibold text-amber-500">
                        pendente
                      </span>
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 sm:ml-auto">
                  <Button
                    variant="outline"
                    className="flex-1 cursor-pointer rounded-xl sm:flex-none"
                    onClick={() => setIsInviteClippersOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 cursor-pointer gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 font-semibold text-white shadow-lg shadow-violet-500/25 transition-all duration-300 hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:shadow-none sm:flex-none"
                    disabled={
                      selectedClipperIds.size === 0 ||
                      enrollMultipleClippers.isPending
                    }
                    onClick={() => {
                      if (campaignId && selectedClipperIds.size > 0) {
                        enrollMultipleClippers.mutate({
                          campaignId,
                          clipperProfileIds: Array.from(selectedClipperIds),
                        });
                      }
                    }}
                  >
                    {enrollMultipleClippers.isPending ? (
                      <>
                        <Spinner className="size-4 animate-spin" />
                        Inscrevendo...
                      </>
                    ) : (
                      <>
                        <UserPlus className="size-4" weight="fill" />
                        Inscrever{" "}
                        {selectedClipperIds.size > 0
                          ? `(${selectedClipperIds.size})`
                          : ""}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Reveal>
  );
}

/* ============================================================
   Blocos auxiliares
   ============================================================ */

function ApplicationMobileValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="bg-muted/40 min-w-0 rounded-xl px-1.5 py-2">
      <p className="text-muted-foreground text-[10px] font-medium">{label}</p>
      <p className="truncate text-xs font-bold tabular-nums">{value}</p>
    </div>
  );
}

function SortHeader({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:text-foreground inline-flex cursor-pointer items-center gap-1.5 font-semibold transition-colors"
    >
      {icon}
      {label}
      <ArrowsDownUp className="size-3.5" />
    </button>
  );
}

function ProcessedClipperRow({
  name,
  imageUrl,
  badge,
}: {
  name: string;
  imageUrl: string | null;
  badge: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Avatar className="border-border/50 size-8 shrink-0 border">
        <AvatarImage src={imageUrl ?? undefined} alt={name} />
        <AvatarFallback className="bg-muted/60 text-[10px] font-bold">
          {name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {name}
      </span>
      {badge}
    </div>
  );
}

function ApproveStepCard({
  card,
  state,
}: {
  card: (typeof APPROVE_STEP_CARDS)[number];
  state: "pending" | "active" | "done";
}) {
  const tone = STEP_TONES[card.tone];
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-all duration-300",
        state === "active"
          ? tone.cardActive
          : state === "done"
            ? tone.cardDone
            : "border-border/30 bg-muted/10",
      )}
    >
      <span
        className={cn(
          "flex size-6 items-center justify-center rounded-full transition-all duration-300",
          state === "active"
            ? tone.iconActive
            : state === "done"
              ? tone.iconDone
              : "bg-muted/40 text-muted-foreground",
        )}
      >
        {state === "active" ? (
          <Spinner className="size-3 animate-spin" />
        ) : state === "done" ? (
          <Check className="size-3" weight="bold" />
        ) : (
          <span className="text-[9px] font-bold">{card.number}</span>
        )}
      </span>
      <span
        className={cn(
          "text-center text-[9px] leading-tight font-semibold",
          state === "active"
            ? tone.labelActive
            : state === "done"
              ? tone.labelDone
              : "text-muted-foreground/50",
        )}
      >
        {state === "active"
          ? card.active
          : state === "done"
            ? card.done
            : card.base}
      </span>
    </div>
  );
}
