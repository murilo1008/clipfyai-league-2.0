"use client";

import { ClipThumbnail } from "@/components/ui/clip-thumbnail";
import { ArrowSquareOut, Play, VideoCamera } from "@phosphor-icons/react";

import { Reveal } from "@/components/shared/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { platformConfig } from "@/lib/platform-config";
import { cn } from "@/lib/utils";

import type { CompetitionDetails } from "./shared";

export function RequiredVideos({
  videos,
}: {
  videos: CompetitionDetails["requiredVideos"];
}) {
  if (videos.length === 0) return null;

  return (
    <Reveal immediate>
      <section className="glass-card rounded-3xl p-4 sm:p-6">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-500">
            <VideoCamera className="size-5" weight="fill" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold sm:text-lg">
                Vídeos obrigatórios para corte
              </h2>
              <Badge variant="outline" className="rounded-full">
                {videos.length}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
              Use estes conteúdos oficiais para produzir os cortes da
              competição.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {videos.map((video) => {
            const platform = platformConfig[video.platform];
            const PlatformIcon = platform.icon;
            const title = video.title?.trim() || "Vídeo obrigatório";

            return (
              <article
                key={video.id}
                className="border-border/60 bg-background/30 flex min-w-0 flex-col overflow-hidden rounded-2xl border"
              >
                <div className="bg-muted/30 relative flex aspect-video items-center justify-center">
                  {video.thumbnailUrl ? (
                    <ClipThumbnail
                      src={video.thumbnailUrl}
                      alt=""
                      fill
                      sizes="(min-width: 1280px) 400px, (min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <Play className="size-10 text-cyan-500/60" weight="fill" />
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <Badge
                    variant="outline"
                    className={cn(
                      "w-fit gap-1.5 rounded-full text-[10px]",
                      platform.borderColor,
                      platform.bgColor,
                      platform.color,
                    )}
                  >
                    <PlatformIcon className="size-3" />
                    {platform.label}
                  </Badge>
                  <div>
                    <h3 className="line-clamp-2 text-sm font-semibold">
                      {title}
                    </h3>
                    {video.description && (
                      <p className="text-muted-foreground mt-1 line-clamp-3 text-xs whitespace-pre-line">
                        {video.description}
                      </p>
                    )}
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="mt-auto w-full cursor-pointer rounded-xl"
                  >
                    <a
                      href={video.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Abrir vídeo: ${title}`}
                    >
                      <ArrowSquareOut className="size-4" />
                      Abrir vídeo
                    </a>
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </Reveal>
  );
}
