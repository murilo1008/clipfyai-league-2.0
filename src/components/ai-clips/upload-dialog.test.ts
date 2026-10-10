import { describe, expect, it } from "vitest";
import { canChangeUploadDialog, canChangeUploadTab } from "./upload-dialog";
describe("diálogo durante upload", () => {
  it("impede fechar por Escape, clique externo ou trocar aba com envio ativo", () => {
    expect(canChangeUploadDialog(false, true)).toBe(false);
    expect(canChangeUploadTab("file", "link", true)).toBe(false);
    expect(canChangeUploadDialog(false, false)).toBe(true);
    expect(canChangeUploadTab("file", "link", false)).toBe(true);
  });
});
