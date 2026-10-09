import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { db } from "@/server/db";
import Announcements from "./announcements";

export default async function AnnouncementsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") redirect("/");
  return <Announcements />;
}
