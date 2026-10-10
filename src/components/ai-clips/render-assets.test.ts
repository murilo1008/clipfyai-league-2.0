import { describe, expect, it } from "vitest";
import { type Clip } from "@/server/league-clips/contracts";
import {
  freshRenderAsset,
  isPreviousRender,
  preferredCardRender,
  previousRenderState,
  renderDownloadLabel,
  renderStatusLabel,
} from "./render-assets";

const renders = [
  {
    id: "old",
    version: 1,
    aspectRatio: "9:16",
    status: "READY",
    videoUrl: "old.mp4",
    subtitles: { srt: "old.srt", vtt: "old.vtt", ass: "old.ass" },
  },
  {
    id: "new",
    version: 2,
    aspectRatio: "9:16",
    status: "READY",
    videoUrl: "fresh.mp4",
    subtitles: { srt: "fresh.srt", vtt: "fresh.vtt", ass: "fresh.ass" },
  },
] as Clip["renders"];

describe("assets de render", () => {
  it("baixa o 1080p sem alterar as legendas da prévia", () => {
    const preview = {
      ...renders[0]!,
      quality: "preview" as const,
      downloadUrl: "1080p.mp4",
      videoUrl: "540p.mp4",
    };
    expect(freshRenderAsset([preview], "old", "video")).toBe("1080p.mp4");
    expect(freshRenderAsset([preview], "old", "srt")).toBe("old.srt");
    expect(freshRenderAsset([preview], "old", "vtt")).toBe("old.vtt");
    expect(preview.videoUrl).toBe("540p.mp4");
  });
  it("nunca usa a prévia como MP4 de download quando downloadUrl está ausente ou nulo", () => {
    for (const downloadUrl of [null, undefined]) {
      const preview = {
        ...renders[0]!,
        quality: "preview" as const,
        downloadUrl,
      };
      expect(
        freshRenderAsset([preview] as Clip["renders"], "old", "video"),
      ).toBeNull();
    }
  });
  it("usa URLs recém consultadas do render escolhido para MP4, SRT e VTT", () => {
    expect(freshRenderAsset(renders, "new", "video")).toBe("fresh.mp4");
    expect(freshRenderAsset(renders, "new", "srt")).toBe("fresh.srt");
    expect(freshRenderAsset(renders, "new", "vtt")).toBe("fresh.vtt");
    expect(freshRenderAsset(renders, "missing", "srt")).toBeNull();
  });
  it("prefere o READY antigo 9:16 mesmo quando o league lista 1:1 primeiro", () => {
    const oldSquare = {
      ...renders[0]!,
      id: "old-square",
      aspectRatio: "1:1" as const,
    };
    const oldVertical = renders[0]!;
    const renderingVertical = {
      ...renders[1]!,
      status: "RENDERING" as const,
    };
    const failedSquare = {
      ...renders[1]!,
      id: "new-square",
      aspectRatio: "1:1" as const,
      status: "FAILED" as const,
    };
    const visible = [oldSquare, oldVertical, renderingVertical, failedSquare];
    const selected = preferredCardRender(visible, 2);
    expect(selected?.id).toBe("old");
    expect(previousRenderState(selected!, visible, 2)).toBe("pending");
    expect(preferredCardRender([oldSquare, oldVertical], 2)?.id).toBe("old");
    expect(preferredCardRender([oldVertical, renders[1]!], 2)?.id).toBe("new");
  });
  it("rotula um render cancelado como Cancelada", () => {
    const cancelled = { ...renders[1]!, status: "CANCELLED" as const };
    expect(renderStatusLabel(cancelled, [cancelled], 2)).toBe("Cancelada");
  });
  it("marca o render anterior como pendente quando o novo está na fila ou renderizando", () => {
    const old = renders[0]!;
    const queued = { ...renders[1]!, status: "QUEUED" as const };
    const rendering = { ...renders[1]!, status: "RENDERING" as const };
    expect(previousRenderState(old, [old, queued], 2)).toBe("pending");
    expect(previousRenderState(old, [old, rendering], 2)).toBe("pending");
    expect(renderStatusLabel(old, [old, rendering], 2)).toBe(
      "Pronta · versão anterior (será substituída)",
    );
    expect(renderDownloadLabel(old, 2, "MP4")).toBe(
      "MP4 9:16 · versão anterior",
    );
    expect(renderDownloadLabel(old, 2, "SRT")).toBe("SRT · versão anterior");
  });
  it("avisa sobre falha do render novo quando não há outro em andamento", () => {
    const old = renders[0]!;
    const failed = { ...renders[1]!, status: "FAILED" as const };
    expect(previousRenderState(old, [old, failed], 2)).toBe("failed");
    expect(renderStatusLabel(old, [old, failed], 2)).toBe(
      "Pronta · versão anterior (novo render falhou)",
    );
  });
  it("pede novo render após PATCH sem render da versão atual", () => {
    const old = renders[0]!;
    expect(previousRenderState(old, [old], 2)).toBe("stale");
    expect(renderStatusLabel(old, [old], 2)).toBe(
      "Pronta · versão anterior (edições não renderizadas)",
    );
    const ready = renders[1]!;
    expect(previousRenderState(ready, [ready], 2)).toBeNull();
    expect(previousRenderState(old, [old, ready], 2)).toBeNull();
    expect(renderStatusLabel(ready, [ready], 2)).toBe("Pronta");
    expect(renderDownloadLabel(ready, 2, "VTT")).toBe("VTT");
    expect(isPreviousRender(old, 2)).toBe(true);
  });
  it("compara somente renders atuais do mesmo formato", () => {
    const oldVertical = { ...renders[0]!, version: 2 };
    const oldSquare = {
      ...renders[0]!,
      id: "old-square",
      version: 2,
      aspectRatio: "1:1" as const,
    };
    const renderingVertical = {
      ...renders[1]!,
      version: 3,
      status: "RENDERING" as const,
    };
    const failedSquare = {
      ...renders[1]!,
      id: "new-square",
      version: 3,
      aspectRatio: "1:1" as const,
      status: "FAILED" as const,
    };
    const visible = [oldVertical, oldSquare, renderingVertical, failedSquare];
    expect(previousRenderState(oldVertical, visible, 3)).toBe("pending");
    expect(previousRenderState(oldSquare, visible, 3)).toBe("failed");
    expect(renderStatusLabel(oldSquare, visible, 3)).toContain(
      "versão anterior (novo render falhou)",
    );
  });
});
