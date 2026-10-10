import { describe, expect, it } from "vitest";
import {
  optionsSchema,
  optionsInputSchema,
  createBrandKitSchema,
  brandKitSchema,
  logoUploadSchema,
  clipSchema,
  renderSchema,
  patchClipSchema,
  projectSchema,
  resolveIntroTitle,
} from "./contracts";
import { messageForCode, projectError } from "@/lib/ai-clips/messages";
import { leagueError, LeagueErrorCause } from "./errors";
describe("contrato e mensagens", () => {
  describe("prévia e exportação", () => {
    const legacy = {
      id: "render",
      version: 1,
      aspectRatio: "9:16",
      status: "READY",
      width: 1080,
      height: 1920,
      durationMs: 60000,
      videoUrl: "full.mp4",
      thumbnailUrl: "poster.jpg",
      subtitles: null,
    };
    it("aceita renders antigos e usa o MP4 do player como download full", () => {
      expect(renderSchema.parse(legacy)).toMatchObject({
        quality: "full",
        exportStatus: null,
        downloadUrl: "full.mp4",
      });
    });
    it("mantém o download nulo na prévia, inclusive com campo ausente", () => {
      expect(
        renderSchema.parse({ ...legacy, quality: "preview" }).downloadUrl,
      ).toBeNull();
      expect(
        renderSchema.parse({ ...legacy, downloadUrl: null }).downloadUrl,
      ).toBeNull();
    });
    it.each([null, "QUEUED", "RENDERING", "READY", "FAILED", "CANCELLED"])(
      "aceita exportStatus %s e preserva a URL de 1080p",
      (exportStatus) => {
        expect(
          renderSchema.parse({
            ...legacy,
            quality: "preview",
            exportStatus,
            downloadUrl: "export.mp4",
          }),
        ).toMatchObject({
          videoUrl: "full.mp4",
          downloadUrl: "export.mp4",
          exportStatus,
        });
      },
    );
    it("rejeita qualidade e estado desconhecidos", () => {
      expect(
        renderSchema.safeParse({ ...legacy, quality: "720p" }).success,
      ).toBe(false);
      expect(
        renderSchema.safeParse({ ...legacy, exportStatus: "DONE" }).success,
      ).toBe(false);
    });
  });
  describe.each([
    ["opções efetivas", optionsSchema],
    ["opções de entrada", optionsInputSchema],
  ])("duração ideal: %s", (_name, schema) => {
    it.each([
      { minDurationMs: 15000, maxDurationMs: 30000 },
      { minDurationMs: 60000, maxDurationMs: 70000 },
      { minDurationMs: 60000, maxDurationMs: 180000 },
    ])(
      "aceita limites inclusivos e intervalo de 10 segundos: %j",
      (options) => {
        expect(schema.safeParse(options).success).toBe(true);
      },
    );
    it.each([
      [
        { minDurationMs: 14999 },
        "minDurationMs",
        'O campo "de" deve ficar entre 15 e 60 segundos.',
      ],
      [
        { minDurationMs: 60001 },
        "minDurationMs",
        'O campo "de" deve ficar entre 15 e 60 segundos.',
      ],
      [
        { maxDurationMs: 29999 },
        "maxDurationMs",
        'O campo "até" deve ficar entre 30 e 180 segundos.',
      ],
      [
        { maxDurationMs: 180001 },
        "maxDurationMs",
        'O campo "até" deve ficar entre 30 e 180 segundos.',
      ],
      [
        { minDurationMs: 60000, maxDurationMs: 69999 },
        "maxDurationMs",
        'O campo "até" deve ser pelo menos 10 segundos maior que o campo "de".',
      ],
      [
        { minDurationMs: 20000.5 },
        "minDurationMs",
        'Informe uma duração válida em segundos no campo "de".',
      ],
      [
        { maxDurationMs: 90000.5 },
        "maxDurationMs",
        'Informe uma duração válida em segundos no campo "até".',
      ],
    ])(
      "rejeita opções inválidas com mensagem em segundos: %j",
      (options, field, message) => {
        const result = schema.safeParse(options);
        expect(result.success).toBe(false);
        if (!result.success)
          expect(result.error.issues).toContainEqual(
            expect.objectContaining({
              path: [field],
              message,
            }),
          );
      },
    );
  });
  it("considera os padrões na validação de opções parciais", () => {
    expect(optionsInputSchema.safeParse({ minDurationMs: 60000 }).success).toBe(
      true,
    );
    expect(optionsInputSchema.safeParse({ maxDurationMs: 30000 }).success).toBe(
      true,
    );
    expect(optionsInputSchema.parse({ maxDurationMs: 30000 })).toEqual({
      maxDurationMs: 30000,
    });
  });
  it("traduz NO_MOMENTS_FOUND e informa a devolução dos créditos sem repetir a mensagem técnica", () => {
    const message =
      "Não encontramos momentos com potencial de corte neste vídeo. Seus créditos foram devolvidos.";
    expect(messageForCode("NO_MOMENTS_FOUND")).toBe(message);
    expect(
      projectError({
        code: "NO_MOMENTS_FOUND",
        message: "No moments passed the threshold",
      }),
    ).toBe(message);
    expect(projectError({ code: "NO_MOMENTS_FOUND", message })).toBe(message);
  });
  it("aplica padrões e valida duração, formatos e palavras-chave", () => {
    expect(optionsSchema.parse({})).toMatchObject({
      clipCount: 10,
      minDurationMs: 20000,
      maxDurationMs: 90000,
      aspectRatios: ["9:16"],
      language: "pt",
    });
    expect(
      optionsSchema.safeParse({ minDurationMs: 60000, maxDurationMs: 65000 })
        .success,
    ).toBe(false);
    expect(
      optionsSchema.safeParse({ aspectRatios: ["9:16", "9:16"] }).success,
    ).toBe(false);
    expect(
      optionsSchema.safeParse({ keyterms: ["x".repeat(51)] }).success,
    ).toBe(false);
  });
  it("mantém o erro estruturado e mapeia erros HTTP, inclusive corpo não JSON", () => {
    const error = leagueError(409, {
      error: {
        code: "VERSION_CONFLICT",
        message: "versão 4",
        details: { currentVersion: 4 },
      },
    });
    expect(error.cause).toBeInstanceOf(LeagueErrorCause);
    expect((error.cause as LeagueErrorCause).details).toEqual({
      currentVersion: 4,
    });
    expect((error.cause as LeagueErrorCause).leagueMessage).toBe("versão 4");
    expect(error.message).toBe("versão 4");
    expect(leagueError(400, null).code).toBe("BAD_REQUEST");
    expect(
      leagueError(400, { error: { code: "VALIDATION_ERROR", message: "   " } })
        .message,
    ).toBe("Confira os dados informados.");
    expect(leagueError(402, null).code).toBe("PAYMENT_REQUIRED");
    expect(leagueError(410, null).code).toBe("NOT_FOUND");
    expect(leagueError(413, null).code).toBe("PAYLOAD_TOO_LARGE");
    expect(
      leagueError(413, {
        error: { code: "SOURCE_TOO_LARGE", message: "O logo passa de 2 MB." },
      }).message,
    ).toBe("O logo passa de 2 MB.");
    expect(
      leagueError(400, {
        error: { code: "VALIDATION_ERROR", message: "Cor inválida." },
      }).message,
    ).toBe("Cor inválida.");
    expect(leagueError(503, null).message).toContain(
      "Tente novamente em instantes",
    );
  });
  it("preserva opções parciais para os padrões e o brand kit do servidor", () => {
    expect(optionsInputSchema.parse({})).toEqual({});
    expect(optionsInputSchema.parse({ brandKitId: null })).toEqual({
      brandKitId: null,
    });
    expect(optionsInputSchema.parse({ brandKitId: "kit" })).toEqual({
      brandKitId: "kit",
    });
    expect(optionsInputSchema.parse({ clipCount: 3 })).toEqual({
      clipCount: 3,
    });
  });
  it("valida os campos do brand kit e a resposta de upload do logo", () => {
    expect(
      createBrandKitSchema.parse({
        name: " Meu kit ",
        captionStyle: { highlightColor: "#abcdef" },
      }).name,
    ).toBe("Meu kit");
    expect(
      createBrandKitSchema.safeParse({
        name: "x",
        captionStyle: { fontSizePx: 200 },
      }).success,
    ).toBe(false);
    expect(
      createBrandKitSchema.safeParse({ name: "x", logo: { scale: 0.9 } })
        .success,
    ).toBe(false);
    expect(brandKitSchema.safeParse({ id: "incompleto" }).success).toBe(false);
    expect(
      logoUploadSchema.safeParse({
        uploadKey: "key",
        url: "/put",
        method: "PUT",
        sizeBytes: 100,
        expiresAt: "now",
        maxBytes: 2097152,
      }).success,
    ).toBe(true);
  });
  it("traduz códigos do backend e preserva o conflito", () => {
    expect(messageForCode("SOURCE_TOO_LONG")).toContain("2 horas");
    const error = leagueError(409, {
      error: { code: "VERSION_CONFLICT", message: "raw" },
    });
    expect(error.code).toBe("CONFLICT");
    expect(error.message).toBe("raw");
  });
  describe("título de abertura", () => {
    const clipBase = {
      id: "c",
      projectId: "p",
      rank: 1,
      status: "READY",
      title: "Título",
      hookText: null,
      description: null,
      hashtags: [],
      viralityScore: null,
      reason: null,
      category: null,
      lowConfidence: false,
      startMs: 0,
      endMs: 20000,
      durationMs: 20000,
      layout: "AUTO",
      captionTemplateKey: "default",
      captionsEnabled: true,
      styleOverrides: null,
      version: 1,
      renders: [],
    };
    const projectBase = {
      id: "p",
      userId: "u",
      status: "COMPLETED",
      currentStage: null,
      progressPct: 100,
      source: {
        type: "url",
        url: "https://youtu.be/x",
        platform: "YOUTUBE",
        title: null,
        durationMs: 60000,
      },
      options: {},
      counts: { clipsTotal: 0, clipsReady: 0, clipsFailed: 0 },
      error: null,
      stages: [],
      externalRef: null,
      createdAt: "2026-10-08T00:00:00Z",
      updatedAt: "2026-10-08T00:00:00Z",
      completedAt: null,
      expiresAt: null,
    };
    it("lê respostas sem o recurso (league antigo) como padrão", () => {
      const clip = clipSchema.parse(clipBase);
      expect(clip.introTitle ?? null).toBeNull();
      expect(resolveIntroTitle(clip.introTitleEffective)).toEqual(
        resolveIntroTitle(),
      );
      expect(projectSchema.parse(projectBase).options.introTitle).toBe(
        undefined,
      );
    });
    it("ignora valores fora do contrato na leitura sem derrubar a resposta", () => {
      const clip = clipSchema.parse({
        ...clipBase,
        introTitle: "inválido",
        introTitleEffective: {
          durationMs: 99999,
          position: "bottom",
          bgColor: null,
          band: "box",
          novoCampo: true,
        },
      });
      expect(clip.introTitle).toBeNull();
      expect(resolveIntroTitle(clip.introTitleEffective)).toEqual({
        ...resolveIntroTitle(),
        band: "box",
      });
      const project = projectSchema.parse({
        ...projectBase,
        options: { introTitle: { durationMs: "3s", hideCaptions: false } },
      });
      expect(resolveIntroTitle(project.options.introTitle)).toMatchObject({
        durationMs: 3000,
        hideCaptions: false,
      });
    });
    it("valida a entrada com as faixas do contrato", () => {
      const invalid = optionsInputSchema.safeParse({
        introTitle: { durationMs: 500 },
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success)
        expect(invalid.error.issues[0]).toMatchObject({
          path: ["introTitle", "durationMs"],
          message:
            "A duração do título de abertura deve ficar entre 1 e 8 segundos.",
        });
      expect(
        optionsInputSchema.safeParse({ introTitle: { cor: "#ffffff" } })
          .success,
      ).toBe(false);
      expect(
        optionsInputSchema.parse({
          introTitle: { enabled: true, position: "top", marginV: 200 },
        }),
      ).toEqual({
        introTitle: { enabled: true, position: "top", marginV: 200 },
      });
      expect(patchClipSchema.parse({ introTitle: null })).toEqual({
        introTitle: null,
      });
      expect(
        createBrandKitSchema.safeParse({
          name: "Kit",
          introTitle: { band: "box", bgColor: "#7f1d1d", maxFontSizePx: 121 },
        }).success,
      ).toBe(false);
      expect(
        createBrandKitSchema.parse({
          name: "Kit",
          introTitle: { band: "box", fontName: "Inter", uppercase: true },
        }).introTitle,
      ).toEqual({ band: "box", fontName: "Inter", uppercase: true });
    });
    it("aceita animação, efeito, fundo e destaque e lê valores desconhecidos como padrão", () => {
      const style = {
        band: "rounded",
        animation: "words",
        effect: "glow",
        highlight: "auto",
      } as const;
      expect(optionsInputSchema.parse({ introTitle: style })).toEqual({
        introTitle: style,
      });
      expect(
        patchClipSchema.parse({ introTitle: { band: "none", effect: "none" } }),
      ).toEqual({ introTitle: { band: "none", effect: "none" } });
      for (const introTitle of [
        { animation: "bounce" },
        { effect: "neon" },
        { band: "pill" },
        { highlight: "manual" },
      ])
        expect(optionsInputSchema.safeParse({ introTitle }).success).toBe(
          false,
        );
      const clip = clipSchema.parse({
        ...clipBase,
        introTitleEffective: {
          animation: "bounce",
          effect: "outline",
          band: "none",
          highlight: "auto",
        },
      });
      expect(resolveIntroTitle(clip.introTitleEffective)).toEqual({
        ...resolveIntroTitle(),
        effect: "outline",
        band: "none",
        highlight: "auto",
      });
    });
  });
});
