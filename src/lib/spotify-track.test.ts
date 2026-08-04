import { describe, expect, it } from "vitest";
import { parseSpotifyTrackId } from "./spotify-track";

describe("parseSpotifyTrackId", () => {
  const id = "4uLU6hMCjMI75M1A2tKUQC";

  it.each([
    `https://open.spotify.com/track/${id}`,
    `https://open.spotify.com/intl-pt/track/${id}?si=abc`,
    `spotify:track:${id}`,
    id,
  ])("extracts an ID from %s", (input) => {
    expect(parseSpotifyTrackId(input)).toBe(id);
  });

  it("rejects non-track Spotify URLs and invalid identifiers", () => {
    expect(
      parseSpotifyTrackId(
        "https://open.spotify.com/album/4uLU6hMCjMI75M1A2tKUQC",
      ),
    ).toBeNull();
    expect(parseSpotifyTrackId("spotify:track:invalid")).toBeNull();
  });
});
