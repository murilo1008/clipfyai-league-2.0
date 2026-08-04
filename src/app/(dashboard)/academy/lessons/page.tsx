import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { db } from "@/server/db"

import Lessons from "./lessons"

export default async function LessonsPage() {
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

  return <Lessons />
}
