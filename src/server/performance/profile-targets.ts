import { Platform } from "@prisma/client";

const PROFILE_PLATFORMS = [
  Platform.INSTAGRAM,
  Platform.TIKTOK,
  Platform.YOUTUBE,
] as const;

type ProfilePlatform = (typeof PROFILE_PLATFORMS)[number];

const PLATFORM_ALIASES: Array<[RegExp, ProfilePlatform]> = [
  [/^(?:instagram|insta)\b/i, Platform.INSTAGRAM],
  [/^(?:tik\s*tok)\b/i, Platform.TIKTOK],
  [/^(?:you\s*tube)\b/i, Platform.YOUTUBE],
];

function extractHandle(value: string) {
  const match = /@([a-zA-Z0-9._-]+)/.exec(value);
  if (match?.[1]) return match[1];

  const plain = value.trim().replace(/^@+/, "");
  return /^[a-zA-Z0-9._-]+$/.test(plain) ? plain : null;
}

export function buildOfficialProfileTargets(mentions: string[]) {
  const explicit = new Map<ProfilePlatform, string>();
  const generic: string[] = [];

  for (const rawMention of mentions) {
    const value = rawMention.trim();
    const handle = extractHandle(value);
    if (!handle) continue;

    const platform = PLATFORM_ALIASES.find(([pattern]) =>
      pattern.test(value),
    )?.[1];

    if (platform) explicit.set(platform, handle);
    else generic.push(handle);
  }

  const fallback =
    generic[0] ??
    explicit.get(Platform.INSTAGRAM) ??
    explicit.get(Platform.TIKTOK) ??
    explicit.get(Platform.YOUTUBE);

  if (!fallback) return [];

  return PROFILE_PLATFORMS.map((platform) => ({
    platform,
    username: explicit.get(platform) ?? fallback,
  }));
}
