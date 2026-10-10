import { describe, expect, it } from "vitest";
import {
  captionChanges,
  canApplyTranscriptVersion,
  canRenderTranscriptVersion,
  transcriptVersionError,
  invalidCaptionChange,
  type EditableWord,
} from "./caption-edits";
const base: EditableWord[] = [
  {
    id: 1,
    punctuatedText: "Olá,",
    hidden: false,
    edited: false,
    startMs: 0,
    endMs: 500,
  },
  {
    id: 2,
    punctuatedText: "mundo!",
    hidden: false,
    edited: true,
    startMs: 500,
    endMs: 1000,
  },
];
describe("edições parciais de legenda", () => {
  it("não envia captionWords quando só outro campo muda", () =>
    expect(captionChanges(base, base)).toEqual([]));
  it("preserva pontuação e envia só a palavra alterada", () => {
    expect(
      captionChanges(base, [{ ...base[0]!, punctuatedText: "Olá!" }, base[1]!]),
    ).toEqual([{ id: 1, punctuatedText: "Olá!" }]);
  });
  it("oculta, restaura e desfaz uma edição salva", () => {
    expect(
      captionChanges(base, [base[0]!, { ...base[1]!, hidden: true }]),
    ).toEqual([{ id: 2, hidden: true }]);
    expect(
      captionChanges(base, [
        base[0]!,
        { ...base[1]!, reset: true, hidden: true },
      ]),
    ).toEqual([{ id: 2, punctuatedText: null, hidden: true }]);
  });
  it("mantém edições locais enquanto clipVersion do transcript está atrás", () => {
    expect(canApplyTranscriptVersion(1, 2)).toBe(false);
    expect(canApplyTranscriptVersion(null, 2)).toBe(false);
    expect(canApplyTranscriptVersion(2, 2)).toBe(true);
    expect(canApplyTranscriptVersion(3, 2)).toBe(true);
  });
  it("bloqueia render até o transcript confirmar a versão salva", () => {
    expect(canRenderTranscriptVersion(undefined, 2, false)).toBe(false);
    expect(canRenderTranscriptVersion(null, 2, false)).toBe(false);
    expect(canRenderTranscriptVersion(1, 2, false)).toBe(false);
    expect(canRenderTranscriptVersion(2, 2, true)).toBe(false);
    expect(canRenderTranscriptVersion(2, 2, false)).toBe(true);
  });
  it("explica a indisponibilidade sem expor termos de migração", () => {
    expect(transcriptVersionError(undefined)).toBeNull();
    expect(transcriptVersionError(2)).toBeNull();
    expect(transcriptVersionError(null)).toContain("atualização do serviço");
    expect(transcriptVersionError(null)).not.toMatch(/migration|0005/i);
  });
  it("rejeita texto vazio ou longo", () => {
    expect(
      invalidCaptionChange(
        captionChanges(base, [{ ...base[0]!, punctuatedText: " " }, base[1]!]),
      ),
    ).toBe(true);
  });
});
