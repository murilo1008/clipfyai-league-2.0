import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: { AI_CLIPS_ENABLED: "1", AI_CLIPS_ALLOWED_EMAILS: "tester@example.com" },
  currentUser: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({ env: mocks.env }));
vi.mock("@clerk/nextjs/server", () => ({ currentUser: mocks.currentUser }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import AIClipsLayout from "./layout";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.AI_CLIPS_ENABLED = "1";
  mocks.env.AI_CLIPS_ALLOWED_EMAILS = "tester@example.com";
  mocks.currentUser.mockResolvedValue({
    primaryEmailAddress: {
      emailAddress: "tester@example.com",
      verification: { status: "verified" },
    },
  });
});

describe("acesso direto às páginas AI Clips", () => {
  it("redireciona à home quando a feature está desligada", async () => {
    mocks.env.AI_CLIPS_ENABLED = "0";
    await expect(AIClipsLayout({ children: "editor" })).rejects.toThrow(
      "redirect:/",
    );
    expect(mocks.currentUser).not.toHaveBeenCalled();
  });

  it("pede login a quem não tem sessão", async () => {
    mocks.currentUser.mockResolvedValue(null);
    await expect(AIClipsLayout({ children: "editor" })).rejects.toThrow(
      "redirect:/sign-in",
    );
  });

  it("redireciona quem não está na lista, mesmo abrindo a URL diretamente", async () => {
    mocks.env.AI_CLIPS_ALLOWED_EMAILS = "other@example.com";
    await expect(AIClipsLayout({ children: "editor" })).rejects.toThrow(
      "redirect:/",
    );
  });

  it("abre as páginas para o e-mail verificado liberado", async () => {
    await expect(AIClipsLayout({ children: "editor" })).resolves.toBe("editor");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
