import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { db } from "@/server/db";

import SpotifyMetrics from "./spotify-metrics";

export default async function SpotifyMetricsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user || user.role !== "ADMIN") {
    redirect("/");
  }

  return <SpotifyMetrics />;
}
