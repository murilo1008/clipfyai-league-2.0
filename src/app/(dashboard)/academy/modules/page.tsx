import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { db } from "@/server/db"

import Modules from "./modules"

export default async function ModulesPage() {
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

  if (user.role !== "ADMIN") {
    redirect("/")
  }

  return <Modules />
}
