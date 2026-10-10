"use client";

import { useState } from "react";
import {
  Archive,
  CaretDown,
  CircleNotch,
  EnvelopeSimple,
  Megaphone,
  PencilSimple,
  Play,
  Plus,
  PushPin,
  Trash,
  Trophy,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import {
  AnnouncementCard,
  AnnouncementCategoryFilter,
  type AnnouncementFilter,
} from "@/components/competitions/announcement-card";
import {
  AnnouncementRecipientPicker,
  type AnnouncementRecipient,
} from "@/components/competitions/announcement-recipient-picker";
import {
  AnnouncementsHeroViz,
  AnnouncementsHeroVizSkeleton,
} from "@/components/competitions/announcements-hero-viz";
import { HomeHero } from "@/components/home/home-hero";
import { Reveal } from "@/components/shared/reveal";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  ANNOUNCEMENT_CATEGORIES,
  announcementCategorySchema,
  announcementDraftSchema,
  type AnnouncementCategory,
  type AnnouncementPost,
} from "@/lib/competition-announcements";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";

type AdminAnnouncementPost =
  RouterOutputs["competitionAnnouncements"]["listAdmin"]["items"][number];
type AnnouncementCampaign =
  RouterOutputs["competitionAnnouncements"]["campaigns"][number];

const CAMPAIGN_STATUS: Record<
  AnnouncementCampaign["status"],
  { label: string; className: string }
> = {
  DRAFT: {
    label: "Rascunho",
    className: "border-border/60 bg-muted/60 text-muted-foreground",
  },
  SCHEDULED: {
    label: "Agendada",
    className:
      "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  ACTIVE: {
    label: "Ativa",
    className:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  PAUSED: {
    label: "Pausada",
    className:
      "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  COMPLETED: {
    label: "Concluída",
    className:
      "border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  },
  ARCHIVED: {
    label: "Arquivada",
    className: "border-border/60 bg-muted/60 text-muted-foreground",
  },
};

export default function Announcements() {
  const utils = api.useUtils();
  const [campaignId, setCampaignId] = useState("");
  const [filter, setFilter] = useState<AnnouncementFilter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [category, setCategory] = useState<AnnouncementCategory>("NOTICE");
  const [recipient, setRecipient] = useState<AnnouncementRecipient | null>(
    null,
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [notifyClippers, setNotifyClippers] = useState(false);
  const [deletingPost, setDeletingPost] = useState<AnnouncementPost | null>(
    null,
  );

  const campaigns = api.competitionAnnouncements.campaigns.useQuery();
  const posts = api.competitionAnnouncements.listAdmin.useInfiniteQuery(
    { campaignId, category: filter === "all" ? undefined : filter },
    { enabled: !!campaignId, getNextPageParam: (page) => page.nextCursor },
  );
  const selectedCampaign = campaigns.data?.find(
    (campaign) => campaign.id === campaignId,
  );
  const isArchived = selectedCampaign?.status === "ARCHIVED";
  const items = posts.data?.pages.flatMap((page) => page.items) ?? [];
  const campaignCount = campaigns.data?.length ?? 0;
  const activeCampaignCount =
    campaigns.data?.filter((campaign) => campaign.status === "ACTIVE").length ??
    0;
  const selectedStatus = selectedCampaign
    ? CAMPAIGN_STATUS[selectedCampaign.status]
    : null;

  function resetForm() {
    setEditingId(null);
    setCategory("NOTICE");
    setRecipient(null);
    setTitle("");
    setContent("");
    setLinkUrl("");
    setNotifyClippers(false);
  }

  function refreshPosts() {
    void utils.competitionAnnouncements.listAdmin.invalidate();
    void utils.competitionAnnouncements.listForClipper.invalidate();
    void utils.notifications.unreadSummary.invalidate();
    void utils.notifications.list.invalidate();
    void utils.notifications.getAnnouncement.invalidate();
  }

  const createPost = api.competitionAnnouncements.create.useMutation({
    onSuccess: (result, variables) => {
      if (result.notificationError) {
        toast.warning(
          `Postagem publicada. ${result.notified} e-mail(s) enviado(s). ${result.notificationError}`,
        );
      } else if (variables.notifyClippers) {
        toast.success(
          `Postagem publicada. ${result.notified} e-mail(s) enviado(s).`,
        );
      } else {
        toast.success(
          variables.category === "GUIDANCE"
            ? "Direcionamento publicado para o clipador selecionado!"
            : "Postagem publicada no mural!",
        );
      }
      resetForm();
      refreshPosts();
    },
    onError: (error) => toast.error(error.message),
  });
  const updatePost = api.competitionAnnouncements.update.useMutation({
    onSuccess: () => {
      toast.success("Postagem atualizada!");
      resetForm();
      refreshPosts();
    },
    onError: (error) => toast.error(error.message),
  });
  const deletePost = api.competitionAnnouncements.delete.useMutation({
    onSuccess: (_, variables) => {
      toast.success("Postagem excluída.");
      setDeletingPost(null);
      if (editingId === variables.id) resetForm();
      refreshPosts();
    },
    onError: (error) => toast.error(error.message),
  });
  const busy =
    createPost.isPending || updatePost.isPending || deletePost.isPending;

  function editPost(post: AdminAnnouncementPost) {
    setEditingId(post.id);
    setCategory(post.category);
    setRecipient(post.recipient);
    setTitle(post.title);
    setContent(post.content);
    setLinkUrl(post.linkUrl ?? "");
    setNotifyClippers(false);
    document
      .getElementById("announcement-form")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function readDraft() {
    const parsed = announcementDraftSchema.safeParse({
      category,
      recipientClipperProfileId:
        category === "GUIDANCE" ? (recipient?.id ?? null) : null,
      title,
      content,
      linkUrl: linkUrl.trim() || null,
    });
    if (!parsed.success) {
      toast.error(
        parsed.error.issues[0]?.message || "Confira os campos da postagem.",
      );
      return null;
    }
    return { ...parsed.data, campaignId };
  }

  function submitPost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!campaignId || busy || isArchived) return;
    const draft = readDraft();
    if (!draft) return;
    if (editingId) updatePost.mutate({ ...draft, id: editingId });
    else createPost.mutate({ ...draft, notifyClippers });
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero do mural ===== */}
      <HomeHero
        eyebrow="Clipfy League · Competições"
        title={
          <>
            Mural de <span className="text-gradient">avisos</span>
          </>
        }
        subtitle="Publique conteúdos, regras, avisos e direcionamentos para os clipadores de cada competição — tudo em um só lugar, com notificação na plataforma e por e-mail."
        isLoading={campaigns.isLoading}
        viz={<AnnouncementsHeroViz />}
        vizSkeleton={<AnnouncementsHeroVizSkeleton />}
        stats={[
          {
            icon: <Trophy className="size-3.5" weight="fill" />,
            label: "Competições",
            value: campaignCount,
            kind: "int",
          },
          {
            icon: <Play className="size-3.5" weight="fill" />,
            label: "Ativas",
            value: activeCampaignCount,
            kind: "int",
          },
          {
            icon: <PushPin className="size-3.5" weight="fill" />,
            label: "Postagens",
            value: items.length,
            kind: "int",
          },
        ]}
      />

      {/* ===== Seleção da competição ===== */}
      <Reveal immediate delayMs={60}>
        <section className="glass-card relative overflow-hidden rounded-3xl p-4 sm:p-5">
          <span
            aria-hidden
            className="pointer-events-none absolute -top-16 -right-12 size-44 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_8%,transparent)] blur-3xl"
          />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="bg-gradient-custom flex size-10 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
                <Trophy className="size-5" weight="fill" />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
                  Competição
                </p>
                <p className="truncate text-base font-bold tracking-tight sm:text-lg">
                  {selectedCampaign?.name ?? "Selecione uma competição"}
                </p>
              </div>
            </div>
            <div className="w-full min-w-0 lg:w-[360px]">
              <Label htmlFor="announcement-campaign" className="sr-only">
                Competição
              </Label>
              {campaigns.isLoading ? (
                <Skeleton className="h-10 w-full rounded-xl" />
              ) : campaigns.error ? (
                <div
                  role="alert"
                  className="flex flex-wrap items-center gap-3 text-sm text-red-500"
                >
                  Não foi possível carregar as competições.
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void campaigns.refetch()}
                    className="cursor-pointer rounded-xl"
                  >
                    Tentar novamente
                  </Button>
                </div>
              ) : (
                <Select
                  value={campaignId}
                  disabled={busy}
                  onValueChange={(id) => {
                    setCampaignId(id);
                    setFilter("all");
                    resetForm();
                  }}
                >
                  <SelectTrigger
                    id="announcement-campaign"
                    className="h-10 w-full min-w-0 cursor-pointer rounded-xl transition-colors hover:border-[color-mix(in_oklab,var(--brand-cyan)_45%,transparent)]"
                  >
                    <Trophy className="text-muted-foreground mr-1 size-4 shrink-0" />
                    <SelectValue
                      placeholder={
                        campaigns.data?.length
                          ? "Selecione a competição"
                          : "Nenhuma competição cadastrada"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.data?.map((campaign) => (
                      <SelectItem
                        key={campaign.id}
                        value={campaign.id}
                        className="cursor-pointer"
                      >
                        {campaign.name}
                        {campaign.status === "ARCHIVED" ? " (arquivada)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className="border-border/60 text-muted-foreground relative mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-3.5 text-xs">
            {selectedStatus ? (
              <>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-semibold",
                    selectedStatus.className,
                  )}
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  {selectedStatus.label}
                </span>
                <span>
                  {isArchived
                    ? "Postagens disponíveis para consulta e exclusão."
                    : "As postagens ficam visíveis para os clipadores aprovados nesta competição."}
                </span>
              </>
            ) : (
              <span>
                Escolha a competição para publicar e gerenciar as postagens do
                mural.
              </span>
            )}
          </div>
        </section>
      </Reveal>

      {!campaignId ? (
        <Reveal immediate delayMs={120}>
          <div className="glass-card relative flex flex-col items-center gap-4 overflow-hidden rounded-3xl px-6 py-14 text-center sm:py-20">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_10%,transparent)] blur-3xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-24 -left-10 size-56 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_8%,transparent)] blur-3xl"
            />
            <span
              className="hero-float relative"
              style={{ "--float-dur": "6.5s" } as React.CSSProperties}
            >
              <span className="hero-pulse-ring absolute -inset-3 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_30%,transparent)]" />
              <span className="bg-gradient-custom relative flex size-14 items-center justify-center rounded-2xl text-[#04222A] shadow-[0_14px_40px_-10px_rgba(20,247,254,0.55)]">
                <Trophy className="size-7" weight="fill" />
              </span>
            </span>
            <div className="relative">
              <h2 className="text-lg font-bold tracking-tight sm:text-xl">
                Escolha uma competição
              </h2>
              <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-sm leading-relaxed">
                O mural e o formulário de publicação aparecerão aqui assim que
                você selecionar uma competição acima.
              </p>
            </div>
            <div className="relative flex flex-wrap justify-center gap-2">
              {announcementCategorySchema.options.map((key) => (
                <span
                  key={key}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                    ANNOUNCEMENT_CATEGORIES[key].className,
                  )}
                >
                  <span aria-hidden>{ANNOUNCEMENT_CATEGORIES[key].emoji}</span>
                  {ANNOUNCEMENT_CATEGORIES[key].label}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <Reveal immediate delayMs={120} className="min-w-0">
            <form
              id="announcement-form"
              onSubmit={submitPost}
              className="glass-card relative flex min-w-0 flex-col gap-4 overflow-hidden rounded-3xl p-4 sm:p-6"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -top-20 -left-16 size-48 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_8%,transparent)] blur-3xl"
              />
              <div className="relative flex items-start gap-3">
                <span className="bg-gradient-custom flex size-9 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
                  {editingId ? (
                    <PencilSimple className="size-4.5" weight="fill" />
                  ) : (
                    <Plus className="size-4.5" weight="bold" />
                  )}
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-bold tracking-tight sm:text-lg">
                    {editingId ? "Editar postagem" : "Nova postagem"}
                  </h2>
                  <p className="text-muted-foreground mt-0.5 text-xs wrap-anywhere">
                    {selectedCampaign?.name}
                  </p>
                </div>
              </div>
              {isArchived && (
                <p
                  role="status"
                  className="relative flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-700 dark:text-amber-300"
                >
                  <Archive className="mt-0.5 size-4 shrink-0" weight="fill" />
                  Esta competição está arquivada. As postagens estão disponíveis
                  para consulta e exclusão.
                </p>
              )}
              <fieldset
                disabled={busy || isArchived}
                className="relative flex min-w-0 flex-col gap-4 disabled:opacity-60"
              >
                <div className="space-y-2">
                  <Label htmlFor="announcement-category">Categoria</Label>
                  <Select
                    value={category}
                    onValueChange={(value) => {
                      setCategory(value as AnnouncementCategory);
                      setRecipient(null);
                    }}
                    disabled={busy || isArchived}
                  >
                    <SelectTrigger
                      id="announcement-category"
                      className="h-10 w-full cursor-pointer rounded-xl transition-colors hover:border-[color-mix(in_oklab,var(--brand-cyan)_45%,transparent)]"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {announcementCategorySchema.options.map((key) => (
                        <SelectItem
                          key={key}
                          value={key}
                          className="cursor-pointer"
                        >
                          {ANNOUNCEMENT_CATEGORIES[key].emoji}{" "}
                          {ANNOUNCEMENT_CATEGORIES[key].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {category === "GUIDANCE" && (
                  <div className="space-y-2">
                    <Label htmlFor="announcement-recipient">
                      Clipador destinatário
                    </Label>
                    <AnnouncementRecipientPicker
                      key={campaignId}
                      campaignId={campaignId}
                      value={recipient}
                      onChange={setRecipient}
                      disabled={busy || isArchived}
                    />
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      Somente o clipador selecionado verá este direcionamento no
                      mural de avisos da competição.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="announcement-title">Título</Label>
                  <Input
                    id="announcement-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Ex.: Novos conteúdos para os próximos cortes"
                    required
                    maxLength={200}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="announcement-content">Mensagem</Label>
                  <Textarea
                    id="announcement-content"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="Escreva as informações para os participantes…"
                    required
                    maxLength={20000}
                    rows={8}
                    className="min-h-44 resize-y rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="announcement-link">Link (opcional)</Label>
                  <Input
                    id="announcement-link"
                    type="url"
                    value={linkUrl}
                    onChange={(event) => setLinkUrl(event.target.value)}
                    placeholder="https://…"
                    maxLength={2048}
                    className="h-10 rounded-xl"
                  />
                </div>
                {!editingId && (
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Ao publicar, os destinatários recebem uma notificação na
                    plataforma. O envio por e-mail é opcional.
                  </p>
                )}
                {!editingId && (
                  <div className="border-border/60 bg-muted/30 hover:bg-muted/50 flex items-start gap-3 rounded-xl border p-3 transition-colors">
                    <Checkbox
                      id="announcement-email"
                      checked={notifyClippers}
                      disabled={busy || isArchived}
                      onCheckedChange={(checked) =>
                        setNotifyClippers(checked === true)
                      }
                      className="mt-0.5 cursor-pointer"
                    />
                    <Label
                      htmlFor="announcement-email"
                      className="block cursor-pointer text-xs leading-relaxed"
                    >
                      {category === "GUIDANCE"
                        ? "Enviar e-mail somente para o clipador selecionado"
                        : "Enviar e-mail para todos os clipadores aprovados nesta competição"}
                    </Label>
                  </div>
                )}
                {editingId && (
                  <p className="text-muted-foreground text-xs">
                    A edição atualiza o mural. Os e-mails enviados anteriormente
                    não serão reenviados.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    disabled={
                      busy ||
                      isArchived ||
                      !title.trim() ||
                      !content.trim() ||
                      (category === "GUIDANCE" && !recipient)
                    }
                    className="btn-gradient-auth h-10 flex-1 cursor-pointer rounded-xl font-semibold"
                  >
                    {busy ? (
                      <CircleNotch className="size-4 animate-spin" />
                    ) : (
                      <Megaphone className="size-4" weight="fill" />
                    )}
                    {createPost.isPending
                      ? "Publicando…"
                      : updatePost.isPending
                        ? "Salvando…"
                        : editingId
                          ? "Salvar alterações"
                          : notifyClippers
                            ? "Publicar e enviar e-mail"
                            : category === "GUIDANCE"
                              ? "Enviar direcionamento"
                              : "Publicar no mural"}
                  </Button>
                  {editingId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetForm}
                      disabled={busy}
                      className="h-10 cursor-pointer rounded-xl"
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </fieldset>
            </form>
          </Reveal>

          <Reveal immediate delayMs={180} className="min-w-0">
            <section
              className="flex min-w-0 flex-col gap-4"
              aria-label="Postagens da competição"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
                    <Megaphone className="size-4" weight="fill" />
                  </span>
                  <div className="flex items-center gap-2 leading-tight">
                    <h2 className="text-base font-bold tracking-tight sm:text-lg">
                      Postagens do mural
                    </h2>
                    {items.length > 0 && (
                      <span className="border-brand-cyan/25 not-dark:border-primary/30 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5">
                        <span className="relative flex size-1.5">
                          <span className="bg-gradient-custom absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:animate-none" />
                          <span className="bg-gradient-custom relative inline-flex size-1.5 rounded-full" />
                        </span>
                        <span className="text-gradient text-[10px] font-bold tabular-nums not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
                          {items.length}
                          {posts.hasNextPage ? "+" : ""}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                <AnnouncementCategoryFilter
                  value={filter}
                  onChange={setFilter}
                />
              </div>
              {posts.isLoading ? (
                Array.from({ length: 3 }, (_, index) => (
                  <Skeleton key={index} className="h-44 rounded-2xl" />
                ))
              ) : posts.error ? (
                <div
                  role="alert"
                  className="glass-card rounded-2xl p-6 text-center"
                >
                  <p className="text-muted-foreground mb-3 text-sm">
                    Não foi possível carregar as postagens.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => void posts.refetch()}
                    className="cursor-pointer rounded-xl"
                  >
                    Tentar novamente
                  </Button>
                </div>
              ) : items.length === 0 ? (
                <div className="glass-card relative flex flex-col items-center gap-3 overflow-hidden rounded-3xl px-6 py-14 text-center">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -top-20 left-1/2 size-56 -translate-x-1/2 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_8%,transparent)] blur-3xl"
                  />
                  <span
                    className="hero-float relative"
                    style={{ "--float-dur": "6.5s" } as React.CSSProperties}
                  >
                    <span className="hero-pulse-ring absolute -inset-2.5 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_25%,transparent)]" />
                    <span className="bg-gradient-custom relative flex size-12 items-center justify-center rounded-2xl text-[#04222A] shadow-[0_12px_32px_-8px_rgba(20,247,254,0.5)]">
                      <Megaphone className="size-6" weight="fill" />
                    </span>
                  </span>
                  <p className="relative font-bold tracking-tight">
                    {filter === "all"
                      ? "Nenhuma postagem ainda"
                      : "Nenhuma postagem nesta categoria"}
                  </p>
                  <p className="text-muted-foreground relative max-w-xs text-sm leading-relaxed">
                    Publique uma mensagem para disponibilizá-la no mural dos
                    clipadores.
                  </p>
                </div>
              ) : (
                items.map((post, index) => (
                  <Reveal key={post.id} delayMs={Math.min(index, 5) * 70}>
                    <AnnouncementCard
                      post={post}
                      actions={
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={busy || isArchived}
                            onClick={() => editPost(post)}
                            aria-label={`Editar: ${post.title}`}
                            className="size-8 cursor-pointer rounded-lg"
                          >
                            <PencilSimple className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={busy}
                            onClick={() => setDeletingPost(post)}
                            aria-label={`Excluir: ${post.title}`}
                            className="size-8 cursor-pointer rounded-lg text-red-500 hover:bg-red-500/10 hover:text-red-500"
                          >
                            <Trash className="size-4" />
                          </Button>
                        </>
                      }
                    >
                      {post.category === "GUIDANCE" && (
                        <p className="text-muted-foreground border-border/60 mt-4 border-t pt-3 text-xs">
                          {post.recipient
                            ? `Visível somente para ${post.recipient.artisticName || post.recipient.fullName}.`
                            : "Selecione um destinatário ao editar para disponibilizar este direcionamento."}
                        </p>
                      )}
                      {post.notifyClippers && (
                        <div className="text-muted-foreground border-border/60 mt-4 flex items-start gap-2 border-t pt-3 text-xs">
                          <EnvelopeSimple className="mt-0.5 size-4 shrink-0" />
                          <p>
                            {post.notificationLastError
                              ? `${post.notificationRecipientCount} e-mail(s) enviado(s). ${post.notificationLastError}`
                              : post.notificationSentAt
                                ? `${post.notificationRecipientCount} e-mail(s) enviado(s).`
                                : "Envio de e-mails em andamento."}
                          </p>
                        </div>
                      )}
                    </AnnouncementCard>
                  </Reveal>
                ))
              )}
              {posts.hasNextPage && (
                <Button
                  variant="outline"
                  disabled={posts.isFetchingNextPage}
                  onClick={() => void posts.fetchNextPage()}
                  className="h-10 cursor-pointer self-center rounded-xl px-5"
                >
                  {posts.isFetchingNextPage ? (
                    <CircleNotch className="size-4 animate-spin" />
                  ) : (
                    <CaretDown className="size-4" />
                  )}
                  {posts.isFetchingNextPage
                    ? "Carregando…"
                    : "Carregar mais postagens"}
                </Button>
              )}
            </section>
          </Reveal>
        </div>
      )}

      <AlertDialog
        open={!!deletingPost}
        onOpenChange={(open) => {
          if (!open && !deletePost.isPending) setDeletingPost(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir postagem?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deletingPost?.title}” será removida do mural desta competição.
              E-mails já enviados permanecerão nas caixas dos destinatários.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deletePost.isPending}
              className="cursor-pointer"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deletePost.isPending}
              className="cursor-pointer"
              onClick={(event) => {
                event.preventDefault();
                if (deletingPost)
                  deletePost.mutate({ id: deletingPost.id, campaignId });
              }}
            >
              {deletePost.isPending ? "Excluindo…" : "Excluir postagem"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
