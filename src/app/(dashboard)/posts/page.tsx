import { redirect } from "next/navigation";

import { auth } from "@clerk/nextjs/server";

import { db } from "@/server/db";

import Posts from "./posts";

export default async function PostsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (user?.role !== "CLIENT") {
    redirect("/");
  }

  return <Posts />;
}
