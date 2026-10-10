import type { ReactNode } from "react";
import { ArrowSquareOut } from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ANNOUNCEMENT_CATEGORIES,
  announcementCategorySchema,
  type AnnouncementCategory,
  type AnnouncementPost,
} from "@/lib/competition-announcements";

export type AnnouncementFilter = AnnouncementCategory | "all";

export function AnnouncementCategoryFilter({
  value,
  onChange,
}: {
  value: AnnouncementFilter;
  onChange: (value: AnnouncementFilter) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as AnnouncementFilter)}
    >
      <SelectTrigger
        aria-label="Filtrar por categoria"
        className="h-10 w-full cursor-pointer rounded-xl transition-colors hover:border-[color-mix(in_oklab,var(--brand-cyan)_45%,transparent)] sm:w-72"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all" className="cursor-pointer">
          Todas as categorias
        </SelectItem>
        {announcementCategorySchema.options.map((key) => (
          <SelectItem key={key} value={key} className="cursor-pointer">
            {ANNOUNCEMENT_CATEGORIES[key].emoji}{" "}
            {ANNOUNCEMENT_CATEGORIES[key].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AnnouncementCard({
  post,
  actions,
  children,
}: {
  post: AnnouncementPost;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const category = ANNOUNCEMENT_CATEGORIES[post.category];
  const edited = post.updatedAt.getTime() - post.createdAt.getTime() > 1000;

  return (
    <article className="glass-card min-w-0 rounded-2xl p-4 transition-[box-shadow,border-color] duration-300 hover:border-[color-mix(in_oklab,var(--brand-cyan)_35%,transparent)] hover:shadow-[0_18px_48px_-24px_color-mix(in_oklab,var(--brand-cyan)_45%,transparent)] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={`rounded-full ${category.className}`}
          >
            <span aria-hidden>{category.emoji}</span> {category.label}
          </Badge>
          <time
            dateTime={post.createdAt.toISOString()}
            className="text-muted-foreground text-xs"
          >
            {post.createdAt.toLocaleString("pt-BR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "America/Sao_Paulo",
            })}
          </time>
          {edited && (
            <span className="text-muted-foreground text-xs">Editado</span>
          )}
          {post.isUnread && (
            <Badge className="rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300">
              Novo
            </Badge>
          )}
        </div>
        {actions && <div className="flex shrink-0 gap-1">{actions}</div>}
      </div>
      <h3 className="mt-4 text-lg font-bold wrap-anywhere">{post.title}</h3>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed wrap-anywhere whitespace-pre-wrap">
        {post.content}
      </p>
      {post.linkUrl && (
        <Button
          asChild
          variant="outline"
          size="sm"
          className="mt-4 cursor-pointer rounded-xl"
        >
          <a href={post.linkUrl} target="_blank" rel="noopener noreferrer">
            <ArrowSquareOut className="size-4" /> Acessar conteúdo
          </a>
        </Button>
      )}
      {children}
    </article>
  );
}
