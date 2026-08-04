import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { db } from "@/server/db"

import Approve from "./approve"

export default async function ApprovePage() {
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

  if (user.clipperProfile?.verificationStatus === "VERIFIED") {
    redirect("/")
  }

  return <Approve />
}
