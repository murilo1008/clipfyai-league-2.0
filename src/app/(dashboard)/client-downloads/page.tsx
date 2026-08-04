import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { VideoDownloadsView } from "@/components/video-downloads/video-downloads-view";
import { db } from "@/server/db";

export default async function ClientDownloadsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user || user.role !== "CLIENT") {
    redirect("/");
  }

  return <VideoDownloadsView mode="client" />;
}
