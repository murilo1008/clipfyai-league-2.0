"use client";

import { useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Bell, Megaphone } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { ANNOUNCEMENT_CATEGORIES } from "@/lib/competition-announcements";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

export function NotificationsBell() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ slug?: string | string[] }>();
  const competitionSlug =
    pathname.startsWith("/my-competitions/") && typeof params.slug === "string"
      ? params.slug
      : undefined;
  const [open, setOpen] = useState(false);
  const { data: user } = api.user.getCurrentUser.useQuery();
  const enabled = user?.role === "CLIPPER";
  const summary = api.notifications.unreadSummary.useQuery(
    competitionSlug ? { slug: competitionSlug } : undefined,
    {
      enabled,
      refetchInterval: 30000,
    },
  );
  const notifications = api.notifications.list.useInfiniteQuery(
    { slug: competitionSlug },
    {
      enabled: enabled && open,
      getNextPageParam: (page) => page.nextCursor,
      refetchInterval: open ? 30000 : false,
    },
  );
  if (!enabled) return null;
  const unread = summary.data?.total ?? 0;
  const items = notifications.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-8 cursor-pointer rounded-lg"
          aria-label={
            unread ? `Notificações, ${unread} não lidas` : "Notificações"
          }
        >
          <Bell className="size-4" weight={unread ? "fill" : "regular"} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-cyan-500 px-1 text-[9px] font-bold text-[#04222a]">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl p-0"
      >
        <div className="border-b p-4">
          <h2 className="font-bold">
            {competitionSlug ? "Avisos desta competição" : "Notificações"}
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            {summary.isLoading
              ? "Carregando avisos…"
              : summary.error
                ? "Não foi possível consultar os avisos não lidos."
                : unread
                  ? `${unread} aviso(s) não lido(s)`
                  : "Você está em dia com os avisos."}
          </p>
        </div>
        <div className="max-h-[min(65vh,480px)] overflow-y-auto">
          {notifications.isLoading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : notifications.error ? (
            <div role="alert" className="p-6 text-center">
              <p className="text-muted-foreground mb-3 text-sm">
                Não foi possível carregar as notificações.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void notifications.refetch()}
              >
                Tentar novamente
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-3 p-8 text-center text-sm">
              <Megaphone className="size-7" weight="duotone" />
              {competitionSlug
                ? "Nenhum aviso recebido nesta competição."
                : "Nenhum aviso recebido ainda."}
            </div>
          ) : (
            items.map((notification) => (
              <button
                type="button"
                key={notification.id}
                className={cn(
                  "hover:bg-muted/60 flex w-full cursor-pointer items-start gap-3 border-b p-4 text-left transition-colors last:border-b-0",
                  !notification.isRead && "bg-cyan-500/5",
                )}
                onClick={() => {
                  setOpen(false);
                  router.push(notification.actionUrl);
                }}
              >
                <span aria-hidden className="shrink-0 text-lg">
                  {ANNOUNCEMENT_CATEGORIES[notification.category].emoji}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-muted-foreground truncate text-xs">
                    {notification.campaignName}
                  </span>
                  <span className="line-clamp-2 text-sm font-semibold wrap-anywhere">
                    {notification.title}
                  </span>
                  <time
                    dateTime={notification.createdAt.toISOString()}
                    className="text-muted-foreground text-[10px]"
                  >
                    {notification.createdAt.toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "America/Sao_Paulo",
                    })}
                  </time>
                </span>
                {!notification.isRead && (
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-cyan-500">
                    <span className="sr-only">Não lido</span>
                  </span>
                )}
              </button>
            ))
          )}
          {notifications.hasNextPage && (
            <div className="p-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-xl"
                disabled={notifications.isFetchingNextPage}
                onClick={() => void notifications.fetchNextPage()}
              >
                {notifications.isFetchingNextPage
                  ? "Carregando…"
                  : "Carregar mais"}
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
