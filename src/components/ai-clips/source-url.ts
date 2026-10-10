const domains = [
  "youtube.com",
  "youtu.be",
  "twitch.tv",
  "kick.com",
  "tiktok.com",
  "instagram.com",
  "facebook.com",
  "fb.watch",
  "vimeo.com",
  "drive.google.com",
];

export function validSource(raw: string, nodeEnv = process.env.NODE_ENV) {
  try {
    const url = new URL(raw);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      (domains.some(
        (domain) =>
          url.hostname === domain || url.hostname.endsWith("." + domain),
      ) ||
        (nodeEnv !== "production" && url.hostname === "fake.local"))
    );
  } catch {
    return false;
  }
}
