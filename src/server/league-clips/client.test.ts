import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({
  env: {
    LEAGUE_API_URL: "https://league.example.test",
    LEAGUE_INTERNAL_API_KEY: "test-key",
    LEAGUE_CLIPS_MOCK: "0",
  },
}));
import { leagueClips } from "./client";

afterEach(() => vi.unstubAllGlobals());
describe("client de exportação", () => {
  it.each([undefined, ["9:16", "1:1"] as const])(
    "envia userId do servidor e formatos %j ao League",
    async (ratios) => {
      const fetch = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ renders: [], clipVersion: 3 }), {
            status: 202,
          }),
        );
      vi.stubGlobal("fetch", fetch);
      expect(
        await leagueClips.exportClip(
          "clerk-user",
          "clip/id",
          ratios ? [...ratios] : undefined,
        ),
      ).toEqual({ renders: [], clipVersion: 3 });
      const [url, options] = fetch.mock.calls[0] as [URL, RequestInit];
      expect(url.href).toBe(
        "https://league.example.test/api/v1/league-clips/clips/clip%2Fid/export",
      );
      expect(options.method).toBe("POST");
      expect(options.headers).toMatchObject({
        "x-internal-api-key": "test-key",
      });
      expect(JSON.parse(options.body as string)).toEqual({
        userId: "clerk-user",
        ...(ratios ? { aspectRatios: ratios } : {}),
      });
    },
  );
});
