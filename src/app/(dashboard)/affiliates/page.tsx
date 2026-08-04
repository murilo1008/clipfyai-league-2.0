import { redirect } from "next/navigation";

import { auth } from "@clerk/nextjs/server";

import { db } from "@/server/db";

import Affiliates from "./affiliates";

export default async function AffiliatesPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (user?.role !== "CLIPPER") {
    redirect("/");
  }

  return <Affiliates />;
}
