import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { db } from "@/server/db";
import Review from "./review";

export default async function WarningsReviewPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") redirect("/");
  return <Review />;
}
