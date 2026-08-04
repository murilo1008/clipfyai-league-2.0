import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { db } from "@/server/db"

import Banned from "./banned"

export default async function BannedPage() {
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  const user = await db.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      clipperProfile: true,
    },
  })

  if (!user) {
    redirect("/sign-in")
  }

  // Se não está banido, redireciona para home
  if (user.clipperProfile?.verificationStatus !== "BANNED") {
    redirect("/")
  }

  return <Banned />
}
