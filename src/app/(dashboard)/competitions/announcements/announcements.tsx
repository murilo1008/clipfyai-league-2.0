"use client";

import { useState } from "react";
import {
  CircleNotch,
  EnvelopeSimple,
  Megaphone,
  PencilSimple,
  Plus,
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
import { api, type RouterOutputs } from "@/trpc/react";

type AdminAnnouncementPost =
  RouterOutputs["competitionAnnouncements"]["listAdmin"]["items"][number];

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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="glass-card relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-12 size-56 rounded-full bg-cyan-500/10 blur-3xl"
        />
        <div className="relative flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-300">
            <Megaphone className="size-6" weight="duotone" />
          </span>
          <div>
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Comunicação das competições
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Mural de avisos
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
              Selecione uma competição para publicar conteúdos, regras, avisos e
              direcionamentos para os clipadores.
            </p>
          </div>
        </div>
      </header>

      <section className="glass-card rounded-2xl p-4 sm:p-6">
        <Label htmlFor="announcement-campaign" className="mb-2 block">
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
              className="w-full rounded-xl"
            >
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
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                  {campaign.status === "ARCHIVED" ? " (arquivada)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </section>

      {!campaignId ? (
        <div className="glass-card flex flex-col items-center gap-3 rounded-3xl px-6 py-16 text-center">
          <Trophy className="size-10 text-cyan-500" weight="duotone" />
          <h2 className="text-lg font-bold">Escolha uma competição</h2>
          <p className="text-muted-foreground max-w-sm text-sm">
            O mural e o formulário de publicação aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <form
            id="announcement-form"
            onSubmit={submitPost}
            className="glass-card flex min-w-0 flex-col gap-4 rounded-2xl p-4 sm:p-6"
          >
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                {editingId ? (
                  <PencilSimple className="size-5" />
                ) : (
                  <Plus className="size-5" />
                )}
                {editingId ? "Editar postagem" : "Nova postagem"}
              </h2>
              <p className="text-muted-foreground mt-1 text-xs wrap-anywhere">
                {selectedCampaign?.name}
              </p>
            </div>
            {isArchived && (
              <p role="status" className="text-muted-foreground text-sm">
                Esta competição está arquivada. As postagens estão disponíveis
                para consulta e exclusão.
              </p>
            )}
            <fieldset
              disabled={busy || isArchived}
              className="flex min-w-0 flex-col gap-4 disabled:opacity-60"
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
                    className="w-full rounded-xl"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {announcementCategorySchema.options.map((key) => (
                      <SelectItem key={key} value={key}>
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
                  className="rounded-xl"
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
                  className="rounded-xl"
                />
              </div>
              {!editingId && (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Ao publicar, os destinatários recebem uma notificação na
                  plataforma. O envio por e-mail é opcional.
                </p>
              )}
              {!editingId && (
                <div className="bg-muted/40 flex items-start gap-3 rounded-xl p-3">
                  <Checkbox
                    id="announcement-email"
                    checked={notifyClippers}
                    disabled={busy || isArchived}
                    onCheckedChange={(checked) =>
                      setNotifyClippers(checked === true)
                    }
                    className="mt-0.5"
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
                  className="btn-gradient-auth flex-1 cursor-pointer rounded-xl font-semibold"
                >
                  {busy ? (
                    <CircleNotch className="size-4 animate-spin" />
                  ) : (
                    <Megaphone className="size-4" />
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
                    className="rounded-xl"
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </fieldset>
          </form>

          <section
            className="flex min-w-0 flex-col gap-4"
            aria-label="Postagens da competição"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Postagens do mural</h2>
              <AnnouncementCategoryFilter value={filter} onChange={setFilter} />
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
                <Button variant="outline" onClick={() => void posts.refetch()}>
                  Tentar novamente
                </Button>
              </div>
            ) : items.length === 0 ? (
              <div className="glass-card flex flex-col items-center gap-3 rounded-2xl px-6 py-14 text-center">
                <Megaphone
                  className="size-8 text-cyan-500/70"
                  weight="duotone"
                />
                <p className="font-semibold">
                  {filter === "all"
                    ? "Nenhuma postagem ainda"
                    : "Nenhuma postagem nesta categoria"}
                </p>
                <p className="text-muted-foreground text-sm">
                  Publique uma mensagem para disponibilizá-la no mural dos
                  clipadores.
                </p>
              </div>
            ) : (
              items.map((post) => (
                <AnnouncementCard
                  key={post.id}
                  post={post}
                  actions={
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={busy || isArchived}
                        onClick={() => editPost(post)}
                        aria-label={`Editar: ${post.title}`}
                        className="size-8 rounded-lg"
                      >
                        <PencilSimple className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={busy}
                        onClick={() => setDeletingPost(post)}
                        aria-label={`Excluir: ${post.title}`}
                        className="size-8 rounded-lg text-red-500"
                      >
                        <Trash className="size-4" />
                      </Button>
                    </>
                  }
                >
                  {post.category === "GUIDANCE" && (
                    <p className="text-muted-foreground mt-4 border-t pt-3 text-xs">
                      {post.recipient
                        ? `Visível somente para ${post.recipient.artisticName || post.recipient.fullName}.`
                        : "Selecione um destinatário ao editar para disponibilizar este direcionamento."}
                    </p>
                  )}
                  {post.notifyClippers && (
                    <div className="text-muted-foreground mt-4 flex items-start gap-2 border-t pt-3 text-xs">
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
              ))
            )}
            {posts.hasNextPage && (
              <Button
                variant="outline"
                disabled={posts.isFetchingNextPage}
                onClick={() => void posts.fetchNextPage()}
                className="rounded-xl"
              >
                {posts.isFetchingNextPage
                  ? "Carregando…"
                  : "Carregar mais postagens"}
              </Button>
            )}
          </section>
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
            <AlertDialogCancel disabled={deletePost.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deletePost.isPending}
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
