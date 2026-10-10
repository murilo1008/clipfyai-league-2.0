import { describe, expect, it } from "vitest";
import {
  displayTemplateKey,
  effectiveTemplate,
  fallbackTemplateOption,
  logoReasonMessage,
  selectedBrandKit,
  templateDisplayName,
  shouldPollBrandKit,
  validateLogoMeta,
} from "./brand-kit-utils";
import { type BrandKit } from "@/server/league-clips/contracts";
const kits = [
  { id: "default", isDefault: true, defaultTemplateKey: "bold" },
  { id: "other", isDefault: false, defaultTemplateKey: "quiet" },
] as BrandKit[];
describe("brand kit no cliente", () => {
  it("valida tipo, bytes e dimensões do logo", () => {
    expect(
      validateLogoMeta({
        type: "image/svg+xml",
        size: 100,
        width: 64,
        height: 64,
      }),
    ).toContain("SVG");
    expect(
      validateLogoMeta({
        type: "image/png",
        size: 2 * 1024 * 1024 + 1,
        width: 64,
        height: 64,
      }),
    ).toContain("2 MB");
    expect(
      validateLogoMeta({
        type: "image/webp",
        size: 100,
        width: 15,
        height: 64,
      }),
    ).toContain("16 px");
    expect(
      validateLogoMeta({
        type: "image/jpeg",
        size: 100,
        width: 1025,
        height: 64,
      }),
    ).toContain("1024 px");
    expect(
      validateLogoMeta({ type: "image/png", size: 100, width: 64, height: 64 }),
    ).toBeNull();
    expect(logoReasonMessage("upload_not_found")).toContain("expirou");
  });
  it("usa padrão se ausente, nenhum se null e id quando escolhido", () => {
    expect(selectedBrandKit(kits, {})?.id).toBe("default");
    expect(selectedBrandKit(kits, { brandKitId: null })).toBeNull();
    expect(selectedBrandKit(kits, { brandKitId: "other" })?.id).toBe("other");
    expect(effectiveTemplate(kits, {})).toBe("bold");
    expect(effectiveTemplate(kits, { brandKitId: "other" })).toBe("quiet");
    expect(effectiveTemplate(kits, { captionTemplateKey: "default" })).toBe(
      "default",
    );
  });
  it("mostra o template padrão quando o league devolve o alias default", () => {
    const templates = [
      { key: "hormozi", isDefault: true },
      { key: "clean", isDefault: false },
    ];
    expect(displayTemplateKey("default", templates)).toBe("hormozi");
    expect(displayTemplateKey("clean", templates)).toBe("clean");
    expect(
      effectiveTemplate(kits, { captionTemplateKey: "default" }, templates),
    ).toBe("hormozi");
    expect(effectiveTemplate([], {}, templates)).toBe("hormozi");
  });
  it("mostra o nome do template do kit em vez da chave", () => {
    const templates = [
      { key: "hormozi", name: "Hormozi", isDefault: true },
      { key: "clean", name: "Limpo", isDefault: false },
    ];
    expect(templateDisplayName("clean", templates)).toBe("Limpo");
    expect(templateDisplayName("default", templates)).toBe("Hormozi");
    expect(templateDisplayName(null, templates)).toBe("Hormozi");
    expect(templateDisplayName("clean", [])).toBe("clean");
    expect(templateDisplayName("karaoke-fill", [])).toBe("karaoke-fill");
    expect(templateDisplayName("default", [])).toBe("Padrão");
    expect(templateDisplayName(null, [])).toBe("Padrão");
  });
  it("cria fallback quando a lista está vazia", () => {
    expect(fallbackTemplateOption("clean", [])).toEqual({
      value: "clean",
      name: "clean",
      needsFallback: true,
    });
    expect(fallbackTemplateOption("default", [])).toEqual({
      value: "default",
      name: "Padrão",
      needsFallback: true,
    });
  });
  it("cria fallback se a lista carregada não contém a chave atual", () => {
    const templates = [{ key: "hormozi", isDefault: true, name: "Hormozi" }];
    expect(fallbackTemplateOption("clean", templates)).toEqual({
      value: "clean",
      name: "clean",
      needsFallback: true,
    });
  });
  it("não duplica uma opção existente, inclusive o alias default", () => {
    const templates = [
      { key: "hormozi", isDefault: true, name: "Hormozi" },
      { key: "clean", isDefault: false, name: "Limpo" },
    ];
    expect(fallbackTemplateOption("clean", templates)).toEqual({
      value: "clean",
      name: "Limpo",
      needsFallback: false,
    });
    expect(fallbackTemplateOption("default", templates)).toEqual({
      value: "hormozi",
      name: "Hormozi",
      needsFallback: false,
    });
  });
  it("aguarda pending e para quando confirmado ou recusado", () => {
    expect(shouldPollBrandKit({ pending: true })).toBe(true);
    expect(shouldPollBrandKit({ pending: false })).toBe(false);
    expect(
      shouldPollBrandKit({
        pending: true,
        lastError: {
          code: "RATE_LIMITED",
          message: "limite",
          source: "command.rejected",
          command: "brand_kit.update",
          at: "now",
        },
      }),
    ).toBe(false);
  });
});
