import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { db } from "@/server/db"

import ClansAdmin from "./clans-admin"
import ClansClipper from "./clans-clipper"

export default async function ClansPage() {
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  if (!user) {
    redirect("/")
  }

  if (user.role === "ADMIN") {
    return <ClansAdmin />
  }

  return <ClansClipper />
}
