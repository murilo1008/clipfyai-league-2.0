"use client";
import { CircleNotch, DownloadSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { type Clip } from "@/server/league-clips/contracts";
import { mp4ButtonState } from "./export-downloads";
import { renderDownloadLabel } from "./render-assets";

export function Mp4DownloadButton({
  render,
  clipVersion,
  state = mp4ButtonState(render),
  onDownload,
}: {
  render: Clip["renders"][number];
  clipVersion: number;
  state?: ReturnType<typeof mp4ButtonState>;
  onDownload: () => void;
}) {
  return (
    <div className="min-w-0 flex-1 space-y-2" aria-live="polite">
      <Button
        size="sm"
        className="h-auto min-h-9 w-full rounded-lg whitespace-normal"
        disabled={state.preparing}
        aria-busy={state.preparing}
        onClick={onDownload}
      >
        {state.preparing ? (
          <CircleNotch
            aria-hidden
            className="size-4 shrink-0 motion-safe:animate-spin"
          />
        ) : (
          <DownloadSimple aria-hidden className="size-4 shrink-0" />
        )}
        {state.label}
        {!state.preparing && ` · ${render.aspectRatio}`}
        <span className="sr-only">
          {" "}
          {renderDownloadLabel(render, clipVersion, "MP4")}
        </span>
      </Button>
      {state.preparing && (
        <p className="text-muted-foreground text-xs">
          Cerca de 20 s para um corte de 1 min, com a fila livre.
        </p>
      )}
      {state.message && (
        <p role="status" className="text-muted-foreground text-xs">
          {state.message}
        </p>
      )}
    </div>
  );
}
