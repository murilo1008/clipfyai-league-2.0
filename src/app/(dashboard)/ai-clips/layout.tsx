import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { env } from "@/env";
import { clipsEnabled } from "@/server/league-clips/availability";
import { canUseAIClips } from "@/server/league-clips/access";

// A autorização depende da sessão e da configuração atual do servidor.
export const dynamic = "force-dynamic";

export default async function AIClipsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!clipsEnabled(env.AI_CLIPS_ENABLED)) redirect("/");
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!canUseAIClips(user)) redirect("/");
  return children;
}
