import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clipSchema,
  renderSchema,
  type Clip,
} from "@/server/league-clips/contracts";
import {
  ClipDownloadManager,
  cancelledExport,
  failedExport,
  preparingExport,
  exportPollMs,
  exportErrorMessage,
  mp4ButtonState,
  clipExportMessage,
} from "./export-downloads";
import { Mp4DownloadButton } from "./mp4-download-button";

function clip(
  id = "clip",
  exportStatus: Clip["renders"][number]["exportStatus"] = null,
) {
  return clipSchema.parse({
    id,
    projectId: "project",
    rank: 1,
    status: "READY",
    title: "Corte",
    hookText: null,
    description: null,
    hashtags: [],
    viralityScore: null,
    reason: null,
    category: null,
    lowConfidence: false,
    startMs: 0,
    endMs: 60000,
    durationMs: 60000,
    layout: "AUTO",
    captionTemplateKey: "default",
    captionsEnabled: true,
    styleOverrides: null,
    version: 1,
    renders: [
      {
        id: `${id}-render`,
        version: 1,
        aspectRatio: "9:16",
        status: "READY",
        width: 540,
        height: 960,
        durationMs: 60000,
        videoUrl: "preview.mp4",
        thumbnailUrl: "poster.jpg",
        subtitles: null,
        quality: "preview",
        exportStatus,
        downloadUrl: null,
      },
    ],
  });
}
function rejection(
  c: Clip,
  code: "VALIDATION_ERROR" | "RATE_LIMITED",
  at = new Date().toISOString(),
): Clip {
  return {
    ...c,
    lastError: {
      code,
      message: "Technical message",
      source: "command.rejected",
      command: "clip.export",
      at,
    },
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("botão MP4", () => {
  it.each([
    [null, "full.mp4", "Baixar MP4", false, null],
    [null, null, "Baixar MP4", false, null],
    ["QUEUED", null, preparingExport, true, null],
    ["RENDERING", null, preparingExport, true, null],
    ["READY", "full.mp4", "Baixar MP4", false, null],
    ["FAILED", null, "Tentar de novo", false, failedExport],
    ["CANCELLED", null, "Baixar MP4", false, cancelledExport],
  ] as const)(
    "mostra %s com download %s",
    (exportStatus, downloadUrl, label, preparing, message) => {
      const render = { ...clip("c", exportStatus).renders[0]!, downloadUrl };
      const html = renderToStaticMarkup(
        <Mp4DownloadButton
          render={render}
          clipVersion={1}
          onDownload={() => undefined}
        />,
      );
      expect(html).toContain(label);
      expect(html.includes('disabled=""')).toBe(preparing);
      expect(html).toContain(`aria-busy="${String(preparing)}"`);
      if (message) expect(html).toContain(message);
      if (preparing) {
        expect(html).toContain("motion-safe:animate-spin");
        expect(html).toContain('aria-live="polite"');
      }
    },
  );
});

describe("download individual e polling", () => {
  function setup() {
    const exportClip = vi
      .fn()
      .mockResolvedValue({ renders: [], clipVersion: 1 });
    const download = vi.fn();
    return {
      exportClip,
      download,
      manager: new ClipDownloadManager({ exportClip, download }),
    };
  }
  it("não duplica o comando ao clicar duas vezes e permite tentar novamente após falha", async () => {
    const c = clip(),
      { manager, exportClip } = setup();
    const first = manager.request(c, c.renders);
    await manager.request(c, c.renders);
    await first;
    expect(exportClip).toHaveBeenCalledTimes(1);
    manager.observe(clip("clip", "RENDERING"));
    const failed = clip("clip", "FAILED");
    manager.observe(failed);
    const request = manager.getSnapshot()[0]!;
    const html = renderToStaticMarkup(
      <Mp4DownloadButton
        render={failed.renders[0]!}
        clipVersion={1}
        state={mp4ButtonState(failed.renders[0]!, request)}
        onDownload={() => undefined}
      />,
    );
    expect(html).toContain("Tentar de novo");
    expect(html).toContain(failedExport);
    await manager.request(failed, failed.renders);
    expect(exportClip).toHaveBeenCalledTimes(2);
  });
  it("ignora leituras antigas enquanto espera a exportação da versão atual", async () => {
    const c = { ...clip(), version: 2 },
      { manager } = setup();
    await manager.request(c, c.renders);
    manager.observe(clip());
    expect(manager.getSnapshot()[0]?.phase).toBe("waiting");
  });
  it("baixa direto o full, inclusive resposta antiga normalizada", async () => {
    const c = clip(),
      { manager, exportClip, download } = setup();
    const {
      quality: _quality,
      exportStatus: _status,
      downloadUrl: _url,
      ...legacy
    } = c.renders[0]!;
    c.renders = [renderSchema.parse(legacy)];
    await manager.request(c, c.renders);
    expect(download).toHaveBeenCalledWith("preview.mp4", c.id, c.renders[0]);
    expect(exportClip).not.toHaveBeenCalled();
  });
  it.each([null, "FAILED", "CANCELLED"] as const)(
    "pede export de %s e ignora o estado anterior ao aceite",
    async (status) => {
      const c = clip("c", status),
        { manager, exportClip, download } = setup();
      await manager.request(c, c.renders);
      manager.observe(c);
      expect(exportClip).toHaveBeenCalledWith(c.id, ["9:16"]);
      expect(exportPollMs(c, manager.getSnapshot(), true)).toBe(3000);
      expect(download).not.toHaveBeenCalled();
      const queued = {
        ...c,
        renders: [{ ...c.renders[0]!, exportStatus: "QUEUED" as const }],
      };
      manager.observe(queued);
      manager.observe({
        ...c,
        renders: [
          { ...c.renders[0]!, exportStatus: "READY", downloadUrl: "1080p.mp4" },
        ],
      });
      expect(download).toHaveBeenCalledOnce();
      expect(download.mock.calls[0]?.[0]).toBe("1080p.mp4");
      expect(manager.getSnapshot()).toHaveLength(0);
    },
  );
  it.each(["QUEUED", "RENDERING"] as const)(
    "acompanha %s sem reenviar o comando",
    async (status) => {
      const c = clip("c", status),
        { manager, exportClip } = setup();
      await manager.request(c, c.renders);
      expect(exportClip).not.toHaveBeenCalled();
      expect(exportPollMs(c, manager.getSnapshot(), true)).toBe(3000);
      expect(exportPollMs(c, manager.getSnapshot(), false)).toBe(false);
    },
  );
  it.each(["READY", "FAILED", "CANCELLED"] as const)(
    "para o polling em %s",
    async (status) => {
      const c = clip("c", "RENDERING"),
        { manager, download } = setup();
      await manager.request(c, c.renders);
      const terminal = {
        ...c,
        renders: [
          {
            ...c.renders[0]!,
            exportStatus: status,
            downloadUrl: status === "READY" ? "1080.mp4" : null,
          },
        ],
      };
      manager.observe(terminal);
      expect(exportPollMs(terminal, manager.getSnapshot(), true)).toBe(false);
      expect(download).toHaveBeenCalledTimes(status === "READY" ? 1 : 0);
    },
  );
  it("para após READY sem URL, sem baixar a prévia", async () => {
    const c = clip("c", "RENDERING"),
      { manager, download } = setup();
    await manager.request(c, c.renders);
    const done = clip("c", "READY");
    manager.observe(done);
    expect(exportPollMs(done, manager.getSnapshot(), true)).toBe(false);
    expect(download).not.toHaveBeenCalled();
    expect(manager.getSnapshot()[0]?.message).toBe(failedExport);
  });
  it("não baixa uma exportação de um corte alterado", async () => {
    const c = clip("c", "RENDERING"),
      { manager, download } = setup();
    await manager.request(c, c.renders);
    manager.observe({ ...c, version: 2 });
    expect(manager.getSnapshot()[0]?.message).toBe(cancelledExport);
    expect(download).not.toHaveBeenCalled();
  });
  it.each(["VALIDATION_ERROR", "RATE_LIMITED"] as const)(
    "traduz a recusa assíncrona %s e para",
    async (code) => {
      const c = clip(),
        { manager } = setup();
      await manager.request(c, c.renders);
      const rejected = rejection(c, code);
      manager.observe(rejected);
      expect(manager.getSnapshot()[0]?.message).toBe(exportErrorMessage(code));
      expect(clipExportMessage(rejected)).toBe(exportErrorMessage(code));
      expect(exportPollMs(rejected, manager.getSnapshot(), true)).toBe(false);
    },
  );
  it("ignora lastError anterior ao tentar de novo e aceita a nova recusa", async () => {
    const c = rejection(clip(), "RATE_LIMITED"),
      { manager } = setup();
    await manager.request(c, c.renders);
    manager.observe(c);
    expect(manager.getSnapshot()[0]?.phase).toBe("waiting");
    vi.advanceTimersByTime(3000);
    manager.observe(rejection(c, "VALIDATION_ERROR"));
    expect(manager.getSnapshot()[0]?.phase).toBe("failed");
  });
  it("encerra um comando que nunca foi aceito", async () => {
    const c = clip(),
      { manager } = setup();
    await manager.request(c, c.renders);
    vi.advanceTimersByTime(30_000);
    manager.observe(c);
    expect(exportPollMs(c, manager.getSnapshot(), true)).toBe(false);
  });
});

describe("baixar todos", () => {
  it("dispara todos os cortes juntos, agrupa formatos, baixa os prontos e acompanha os pendentes", async () => {
    const resolvers: (() => void)[] = [];
    const exportClip = vi.fn(
      () =>
        new Promise<void>((done) => {
          resolvers.push(done);
        }),
    );
    const download = vi.fn();
    const manager = new ClipDownloadManager({ exportClip, download });
    const full = clip("full");
    full.renders[0]!.downloadUrl = "already.mp4";
    const first = clip("first"),
      second = clip("second");
    first.renders.push({
      ...first.renders[0]!,
      id: "square",
      aspectRatio: "1:1",
    });
    const pending = manager.requestAll([full, first, second]);
    expect(exportClip.mock.calls).toEqual([
      ["first", ["9:16", "1:1"]],
      ["second", ["9:16"]],
    ]);
    expect(download.mock.calls[0]?.[0]).toBe("already.mp4");
    // Both commands are already in flight before either resolves.
    expect(manager.getSnapshot()).toHaveLength(3);
    resolvers.forEach((resolve) => resolve());
    await pending;
    manager.observe({
      ...first,
      renders: first.renders.map((r) => ({
        ...r,
        exportStatus: "READY",
        downloadUrl: `${r.id}-full.mp4`,
      })),
    });
    manager.observe({
      ...second,
      renders: [
        {
          ...second.renders[0]!,
          exportStatus: "READY",
          downloadUrl: "second-full.mp4",
        },
      ],
    });
    expect(download).toHaveBeenCalledTimes(4);
    expect(manager.getSnapshot()).toHaveLength(0);
  });
  it.each(["sync", "async"])(
    "espera RATE_LIMITED %s e tenta de novo",
    async (mode) => {
      const exportClip = vi.fn().mockResolvedValue({});
      if (mode === "sync")
        exportClip.mockRejectedValueOnce({
          data: { leagueError: { code: "RATE_LIMITED" } },
        });
      const download = vi.fn(),
        manager = new ClipDownloadManager({ exportClip, download });
      const c = clip();
      await manager.requestAll([c]);
      const rejected = mode === "async" ? rejection(c, "RATE_LIMITED") : c;
      manager.observe(rejected);
      expect(manager.getSnapshot()[0]?.phase).toBe("retrying");
      manager.observe(rejected);
      expect(exportClip).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(6000);
      manager.observe(rejected);
      expect(exportClip).toHaveBeenCalledTimes(2);
      await Promise.resolve();
      manager.observe({
        ...c,
        renders: [{ ...c.renders[0]!, exportStatus: "RENDERING" }],
      });
      manager.observe({
        ...c,
        renders: [
          { ...c.renders[0]!, exportStatus: "READY", downloadUrl: "full.mp4" },
        ],
      });
      expect(download.mock.calls[0]?.[0]).toBe("full.mp4");
    },
  );
});
