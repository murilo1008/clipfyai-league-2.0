import { redirect } from "next/navigation"

import { auth } from "@clerk/nextjs/server"

import SignIn from "./sign-in"

export default async function SignInPage() {
  const { userId } = await auth()

  if (userId) {
    redirect("/")
  }

  return <SignIn />
}
