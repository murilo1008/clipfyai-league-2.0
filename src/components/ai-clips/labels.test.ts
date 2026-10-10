import { describe, expect, it } from "vitest";
import {
  layoutLabels,
  optionErrorPt,
  platformLabels,
  tierLabels,
} from "./labels";
describe("rótulos pt-BR", () => {
  it("traduz layout, plataforma, plano e erro do formulário", () => {
    expect(layoutLabels.FACE_TRACK).toBe("Rosto");
    expect(platformLabels.GOOGLE_DRIVE).toBe("Google Drive");
    expect(tierLabels.FREE).toBe("Gratuito");
    expect(optionErrorPt(["clipCount"])).toContain("máximo de clipes");
  });
});
