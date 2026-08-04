export function parseSpotifyTrackId(input: string): string | null {
  const value = input.trim();
  const urlMatch =
    /open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]{22})/.exec(
      value,
    );
  if (urlMatch?.[1]) return urlMatch[1];
  const uriMatch = /^spotify:track:([A-Za-z0-9]{22})$/.exec(value);
  if (uriMatch?.[1]) return uriMatch[1];
  return /^[A-Za-z0-9]{22}$/.test(value) ? value : null;
}
