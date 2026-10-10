import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: {
    AI_CLIPS_ENABLED: "1",
    AI_CLIPS_ALLOWED_EMAILS: "tester@example.com",
  },
  currentUser: vi.fn(),
  brandKits: vi.fn(),
  cancel: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({ env: mocks.env }));
vi.mock("@clerk/nextjs/server", () => ({ currentUser: mocks.currentUser }));
vi.mock("@/server/db", () => ({
  db: { user: { findUnique: mocks.findUnique } },
}));
vi.mock("@/server/league-clips/client", () => ({
  leagueClips: { brandKits: mocks.brandKits, cancel: mocks.cancel },
}));

import { db } from "@/server/db";
import { leagueClipsRouter } from "./league-clips";

const caller = leagueClipsRouter.createCaller({ db, headers: new Headers() });
const user = (emailAddress: string, status = "verified") => ({
  id: "clerk-tester",
  primaryEmailAddress: { emailAddress, verification: { status } },
  emailAddresses: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.AI_CLIPS_ENABLED = "1";
  mocks.env.AI_CLIPS_ALLOWED_EMAILS = "tester@example.com";
  mocks.currentUser.mockResolvedValue(user("tester@example.com"));
  mocks.brandKits.mockResolvedValue({ items: [] });
  mocks.cancel.mockResolvedValue({ id: "project-1" });
});

describe("autorização do router AI Clips", () => {
  it("informa a liberação sem expor a lista e permite um tester sem privilégios admin", async () => {
    await expect(caller.access()).resolves.toEqual({ enabled: true });
    await expect(caller.brandKits()).resolves.toEqual({ items: [] });
    await expect(caller.cancel({ id: "project-1" })).resolves.toEqual({
      id: "project-1",
    });
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.brandKits).toHaveBeenCalledWith("clerk-tester");
    expect(mocks.cancel).toHaveBeenCalledWith("clerk-tester", "project-1");
  });

  it.each(["disabled", "empty", "not-listed", "unverified"])(
    "bloqueia leitura e mutação antes de chamar o League: %s",
    async (scenario) => {
      if (scenario === "disabled") mocks.env.AI_CLIPS_ENABLED = "0";
      if (scenario === "empty") mocks.env.AI_CLIPS_ALLOWED_EMAILS = "";
      if (scenario === "not-listed")
        mocks.currentUser.mockResolvedValue(user("other@example.com"));
      if (scenario === "unverified")
        mocks.currentUser.mockResolvedValue(
          user("tester@example.com", "unverified"),
        );
      await expect(caller.access()).resolves.toEqual({ enabled: false });
      await expect(caller.brandKits()).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(caller.cancel({ id: "project-1" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(mocks.brandKits).not.toHaveBeenCalled();
      expect(mocks.cancel).not.toHaveBeenCalled();
    },
  );

  it("nega chamadas sem sessão autenticada", async () => {
    mocks.currentUser.mockResolvedValue(null);
    await expect(caller.access()).rejects.toThrow("Unauthorized");
    await expect(caller.brandKits()).rejects.toThrow("Unauthorized");
    await expect(caller.cancel({ id: "project-1" })).rejects.toThrow(
      "Unauthorized",
    );
    expect(mocks.brandKits).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
});
