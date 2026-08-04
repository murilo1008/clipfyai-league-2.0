import { redirect } from "next/navigation"

import { auth } from "@clerk/nextjs/server"

import { db } from "@/server/db"

import Home from "./home"
import HomeClient from "./home-client"
import HomeClipper from "./home-clipper"

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

  if (user?.role === "CLIPPER") {
    return <HomeClipper />
  } else if (user?.role === "CLIENT") {
    return <HomeClient />
  } else {
    return <Home />
  }
}
