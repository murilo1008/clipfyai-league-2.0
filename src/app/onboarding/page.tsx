import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import Onboarding from "./onboarding"

export default async function OnboardingPage() {
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  return <Onboarding />
}
