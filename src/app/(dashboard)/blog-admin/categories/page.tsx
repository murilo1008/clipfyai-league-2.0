import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { db } from "@/server/db"

import BlogCategories from "./categories"

export default async function BlogCategoriesPage() {
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

  return <BlogCategories />
}
