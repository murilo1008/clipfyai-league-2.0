import { describe, expect, it } from "vitest";
import { type Clip } from "@/server/league-clips/contracts";
import { projectSchema } from "@/server/league-clips/contracts";
import {
  projectClipThumbnail,
  projectThumbnailUrls,
  youtubeThumbnailUrl,
} from "./project-thumbnail";

const videoId = "SYVahq9Hmb0";
const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
const source = {
  type: "url" as const,
  url: `https://www.youtube.com/watch?v=${videoId}`,
  platform: "YOUTUBE" as const,
  title: "Meu vídeo",
  durationMs: 10000,
};
const render = (
  version: number,
  status: "READY" | "RENDERING" | "FAILED",
  thumbnailUrl: string | null,
  aspectRatio: "9:16" | "1:1" = "9:16",
) =>
  ({ version, status, thumbnailUrl, aspectRatio }) as Clip["renders"][number];
const clip = (rank: number, version: number, renders: Clip["renders"]) =>
  ({ rank, version, renders }) as Clip;

describe("thumbnail dos projetos", () => {
  it.each([
    `https://www.youtube.com/watch?v=${videoId}&t=30`,
    `https://youtu.be/${videoId}?si=abc`,
    `https://m.youtube.com/shorts/${videoId}`,
    `https://www.youtube.com/live/${videoId}`,
    `https://www.youtube-nocookie.com/embed/${videoId}`,
  ])("extrai a capa de %s", (url) => {
    expect(youtubeThumbnailUrl(url)).toBe(thumbnail);
  });
  it.each([
    null,
    "",
    "não é uma URL",
    "https://www.youtube.com/watch?v=demo",
    "https://youtube.com.evil.test/watch?v=SYVahq9Hmb0",
    "https://vimeo.com/SYVahq9Hmb0",
    "https://www.youtube.com/playlist?list=SYVahq9Hmb0",
    "file://youtube.com/watch?v=SYVahq9Hmb0",
  ])("ignora fontes sem uma capa válida: %s", (url) => {
    expect(youtubeThumbnailUrl(url)).toBeNull();
  });
  it("prioriza a thumb fornecida pela API e preserva contratos sem esse campo", () => {
    expect(projectSchema.shape.source.parse(source)).toEqual(source);
    const withThumbnail = {
      ...source,
      thumbnailUrl: "https://cdn.test/video.jpg",
    };
    expect(projectSchema.shape.source.parse(withThumbnail).thumbnailUrl).toBe(
      withThumbnail.thumbnailUrl,
    );
    expect(projectThumbnailUrls(withThumbnail)).toEqual([
      withThumbnail.thumbnailUrl,
      thumbnail,
    ]);
    expect(
      projectThumbnailUrls({ ...source, thumbnailUrl: thumbnail }),
    ).toEqual([thumbnail]);
    expect(
      projectThumbnailUrls({
        ...source,
        type: "upload",
        platform: "UPLOAD",
        url: null,
      }),
    ).toEqual([]);
  });
  it("usa a thumb pronta da versão atual do primeiro clipe por ordem de rank", () => {
    const clips = [
      clip(2, 1, [render(1, "READY", "/second.jpg")]),
      clip(1, 2, [
        render(1, "READY", "/old.jpg"),
        render(2, "READY", "/current.jpg"),
      ]),
    ];
    expect(projectClipThumbnail(clips)).toBe("/current.jpg");
    expect(clips[0]?.rank).toBe(2);
  });
  it("mantém uma thumb anterior enquanto renderiza e pula clipes sem imagem pronta", () => {
    expect(
      projectClipThumbnail([
        clip(1, 2, [
          render(2, "RENDERING", null),
          render(1, "READY", "/old.jpg"),
        ]),
      ]),
    ).toBe("/old.jpg");
    expect(
      projectClipThumbnail([
        clip(1, 1, [render(1, "FAILED", "/failed.jpg")]),
        clip(2, 1, [
          render(1, "READY", null),
          render(1, "READY", "/square.jpg", "1:1"),
        ]),
      ]),
    ).toBe("/square.jpg");
    expect(projectClipThumbnail([])).toBeNull();
    expect(
      projectClipThumbnail([clip(1, 1, [render(1, "RENDERING", null)])]),
    ).toBeNull();
  });
});
