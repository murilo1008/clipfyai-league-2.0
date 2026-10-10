import "server-only";
import { env } from "@/env";
import { clipsAllowedForUser, type AIClipsUser } from "./availability";

export function canUseAIClips(user: AIClipsUser | null | undefined) {
  return clipsAllowedForUser(
    env.AI_CLIPS_ENABLED,
    env.AI_CLIPS_ALLOWED_EMAILS,
    user,
  );
}
