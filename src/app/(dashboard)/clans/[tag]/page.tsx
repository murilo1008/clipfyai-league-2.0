import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { db } from "@/server/db"

import ClanDetailAdmin from "./clan-detail-admin"
import ClanDetailClipper from "./clan-detail-clipper"

export default async function ClanPage({
  params,
}: {
  params: Promise<{ tag: string }>
}) {
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

  const { tag } = await params

  if (user.role === "ADMIN") {
    return <ClanDetailAdmin tag={tag} />
  }

  return <ClanDetailClipper tag={tag} />
}
