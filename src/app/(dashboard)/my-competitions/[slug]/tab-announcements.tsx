"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone } from "@phosphor-icons/react";
import { toast } from "sonner";

import {
  AnnouncementCard,
  AnnouncementCategoryFilter,
  type AnnouncementFilter,
} from "@/components/competitions/announcement-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";

export function AnnouncementsTab({
  slug,
  initialAnnouncementId,
}: {
  slug: string;
  initialAnnouncementId?: string;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const [selectedId, setSelectedId] = useState<string | null>(
    initialAnnouncementId ?? null,
  );
  useEffect(() => {
    setSelectedId(initialAnnouncementId ?? null);
  }, [initialAnnouncementId]);
  const [category, setCategory] = useState<AnnouncementFilter>("all");
  const posts = api.competitionAnnouncements.listForClipper.useInfiniteQuery(
    { slug, category: category === "all" ? undefined : category },
    { getNextPageParam: (page) => page.nextCursor, refetchInterval: 30000 },
  );
  const selectedPost = api.notifications.getAnnouncement.useQuery(
    { slug, announcementId: selectedId ?? "" },
    {
      enabled: !!selectedId,
      retry: false,
      refetchInterval: selectedId ? 30000 : false,
    },
  );
  const { mutate: markRead } = api.notifications.markRead.useMutation({
    onSuccess: () => {
      void utils.notifications.unreadSummary.invalidate();
      void utils.notifications.list.invalidate();
      void utils.notifications.getAnnouncement.invalidate();
      void utils.competitionAnnouncements.listForClipper.invalidate();
    },
    onError: () =>
      toast.error("Não foi possível atualizar a leitura do aviso."),
  });
  useEffect(() => {
    if (
      selectedId &&
      selectedPost.data?.id === selectedId &&
      selectedPost.data.isUnread &&
      !selectedPost.error
    )
      markRead({ announcementId: selectedId });
  }, [
    selectedId,
    selectedPost.data?.id,
    selectedPost.data?.isUnread,
    selectedPost.error,
    markRead,
  ]);
  const items = posts.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section
      className="flex flex-col gap-4"
      aria-label="Mural de avisos da competição"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Megaphone className="size-5 text-cyan-500" weight="duotone" />
            Avisos da competição
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Conteúdos, regras e orientações para acompanhar a competição.
          </p>
        </div>
        <AnnouncementCategoryFilter value={category} onChange={setCategory} />
      </div>
      {posts.isLoading ? (
        Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-40 rounded-2xl" />
        ))
      ) : posts.error ? (
        <div role="alert" className="glass-card rounded-2xl p-6 text-center">
          <p className="text-muted-foreground mb-3 text-sm">
            {posts.error.message || "Não foi possível carregar os avisos."}
          </p>
          <Button variant="outline" onClick={() => void posts.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-3 rounded-3xl px-6 py-16 text-center">
          <Megaphone className="size-10 text-cyan-500/70" weight="duotone" />
          <h3 className="text-lg font-bold">
            {category === "all"
              ? "Nenhum aviso publicado ainda"
              : "Nenhum aviso nesta categoria"}
          </h3>
          <p className="text-muted-foreground max-w-md text-sm">
            As novas informações da competição aparecerão neste mural.
          </p>
        </div>
      ) : (
        items.map((post) => (
          <AnnouncementCard key={post.id} post={post}>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 rounded-xl"
              onClick={() => setSelectedId(post.id)}
            >
              Abrir aviso
            </Button>
          </AnnouncementCard>
        ))
      )}
      <Dialog
        open={!!selectedId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
            if (initialAnnouncementId)
              router.replace(
                `/my-competitions/${encodeURIComponent(slug)}?tab=announcements`,
                { scroll: false },
              );
          }
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Aviso da competição</DialogTitle>
            <DialogDescription>
              Informações publicadas no mural da competição.
            </DialogDescription>
          </DialogHeader>
          {selectedPost.isLoading ? (
            <Skeleton className="h-48 rounded-2xl" />
          ) : selectedPost.error ? (
            <p role="alert" className="text-muted-foreground text-sm">
              {selectedPost.error.message}
            </p>
          ) : selectedPost.data ? (
            <AnnouncementCard
              post={{ ...selectedPost.data, isUnread: false }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      {posts.hasNextPage && (
        <Button
          variant="outline"
          disabled={posts.isFetchingNextPage}
          onClick={() => void posts.fetchNextPage()}
          className="rounded-xl"
        >
          {posts.isFetchingNextPage ? "Carregando…" : "Carregar mais avisos"}
        </Button>
      )}
    </section>
  );
}
