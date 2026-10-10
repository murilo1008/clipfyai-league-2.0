"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQueries, type Query } from "@tanstack/react-query";
import { api } from "@/trpc/react";
import { type Clip } from "@/server/league-clips/contracts";
import {
  ClipDownloadManager,
  exportPollMs,
  mp4ButtonState,
} from "./export-downloads";

export function usePageVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

export function useClipDownloads(clips: Clip[]) {
  const utils = api.useUtils();
  const mutation = api.leagueClips.exportClip.useMutation();
  const mutate = useRef(mutation.mutateAsync);
  mutate.current = mutation.mutateAsync;
  const visible = usePageVisible();
  const [manager] = useState(
    () =>
      new ClipDownloadManager({
        exportClip: (id, aspectRatios) => mutate.current({ id, aspectRatios }),
        download: (url, clipId, render) => {
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = `${clipId}-${render.aspectRatio.replace(":", "x")}.mp4`;
          anchor.target = "_blank";
          anchor.rel = "noopener noreferrer";
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
        },
      }),
  );
  const requests = useSyncExternalStore(
    manager.subscribe,
    manager.getSnapshot,
    manager.getSnapshot,
  );
  const queries = useQueries({
    queries: clips.map((clip) => ({
      queryKey: ["ai-clips-export", clip.id],
      initialData: clip,
      queryFn: async () => {
        const latest = await utils.client.leagueClips.clip.query({
          id: clip.id,
        });
        utils.leagueClips.clip.setData({ id: clip.id }, latest);
        utils.leagueClips.clips.setData({ id: clip.projectId }, (list) =>
          list?.map((item) => (item.id === latest.id ? latest : item)),
        );
        return latest;
      },
      enabled: !!exportPollMs(
        clip,
        requests.filter((r) => r.clipId === clip.id),
        visible,
      ),
      refetchInterval: (query: Query<Clip>) =>
        exportPollMs(
          query.state.data,
          requests.filter((r) => r.clipId === clip.id),
          visible,
        ),
      refetchIntervalInBackground: false,
    })),
  });
  useEffect(() => {
    if (!visible) return;
    for (const query of queries) {
      const source = clips.find((clip) => clip.id === query.data?.id);
      if (
        query.data &&
        source &&
        query.isFetchedAfterMount &&
        !query.isFetching &&
        query.data.version >= source.version
      )
        manager.observe(query.data);
    }
  }, [queries, clips, manager, visible]);
  return {
    request: (clip: Clip, render: Clip["renders"][number]) =>
      manager.request(clip, [render]),
    requestAll: (all: Clip[]) => manager.requestAll(all),
    preparing: requests.some((r) =>
      ["submitting", "waiting", "retrying"].includes(r.phase),
    ),
    state: (clip: Clip, render: Clip["renders"][number]) =>
      mp4ButtonState(
        render,
        requests.find((r) => r.clipId === clip.id && r.renderId === render.id),
      ),
  };
}
