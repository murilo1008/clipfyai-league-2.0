import { redirect } from "next/navigation"

import { auth } from "@clerk/nextjs/server"

import { db } from "@/server/db"

import { HomeByRole } from "./home-by-role"

export default async function HomePage() {
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  const user = await db.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      role: true,
    },
  })

  return <HomeByRole role={user?.role} />
}
