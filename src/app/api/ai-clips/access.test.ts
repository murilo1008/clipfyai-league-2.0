import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: { AI_CLIPS_ENABLED: "1", AI_CLIPS_ALLOWED_EMAILS: "tester@example.com" },
  currentUser: vi.fn(),
  mockLogoPut: vi.fn(),
  mockUploadPart: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({ env: mocks.env }));
vi.mock("@clerk/nextjs/server", () => ({ currentUser: mocks.currentUser }));
vi.mock("@/server/league-clips/mock", () => ({
  MockClipsError: class extends Error {},
  mockLogoPut: mocks.mockLogoPut,
  mockUploadPart: mocks.mockUploadPart,
}));

import { PUT as putLogo } from "./mock-logo/route";
import { PUT as putUpload } from "./mock-upload/route";

const user = {
  id: "clerk-tester",
  primaryEmailAddress: {
    emailAddress: "tester@example.com",
    verification: { status: "verified" },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("LEAGUE_CLIPS_MOCK", "1");
  mocks.env.AI_CLIPS_ENABLED = "1";
  mocks.env.AI_CLIPS_ALLOWED_EMAILS = "tester@example.com";
  mocks.currentUser.mockResolvedValue(user);
  mocks.mockUploadPart.mockReturnValue("part-etag");
});
afterEach(() => vi.unstubAllEnvs());

describe.each([
  [
    "logo",
    putLogo,
    "https://app.example.test/api/ai-clips/mock-logo?key=logo-1",
  ],
  [
    "upload",
    putUpload,
    "https://app.example.test/api/ai-clips/mock-upload?uploadId=upload-1&partNumber=1",
  ],
])("autorização de mock %s", (_name, handler, url) => {
  const request = () => new Request(url, { method: "PUT", body: "bytes" });

  it("recusa mock em produção e quando desligado antes da autenticação", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await handler(request())).status).toBe(404);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LEAGUE_CLIPS_MOCK", "0");
    expect((await handler(request())).status).toBe(404);
    expect(mocks.currentUser).not.toHaveBeenCalled();
  });

  it("exige sessão e a mesma autorização por e-mail do router", async () => {
    mocks.currentUser.mockResolvedValue(null);
    expect((await handler(request())).status).toBe(401);
    mocks.currentUser.mockResolvedValue(user);
    mocks.env.AI_CLIPS_ALLOWED_EMAILS = "other@example.com";
    expect((await handler(request())).status).toBe(403);
    mocks.env.AI_CLIPS_ALLOWED_EMAILS = "tester@example.com";
    mocks.env.AI_CLIPS_ENABLED = "0";
    expect((await handler(request())).status).toBe(403);
    expect(mocks.mockLogoPut).not.toHaveBeenCalled();
    expect(mocks.mockUploadPart).not.toHaveBeenCalled();
  });

  it("aceita o e-mail liberado e usa a identidade da sessão", async () => {
    expect((await handler(request())).status).toBe(200);
    if (_name === "logo")
      expect(mocks.mockLogoPut).toHaveBeenCalledWith(
        "logo-1",
        "clerk-tester",
        expect.any(Uint8Array),
        expect.any(String),
      );
    else
      expect(mocks.mockUploadPart).toHaveBeenCalledWith(
        "upload-1",
        1,
        "clerk-tester",
        5,
      );
  });
});
