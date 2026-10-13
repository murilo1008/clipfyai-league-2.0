import { describe, expect, it } from "vitest"

import { getStatusRedirect, type AuthRedirectUser } from "./auth-redirect"

/** Cópia literal da cadeia de `if` que o AuthTemplate usava no efeito. */
function originalGuard(dbUser: AuthRedirectUser, pathname: string) {
  if (dbUser?.role === "CLIPPER") {
    if (!dbUser.onboardingCompleted && pathname !== "/onboarding") {
      return "/onboarding"
    }
    if (
      dbUser.onboardingCompleted &&
      dbUser.clipperProfile?.verificationStatus === "PENDING" &&
      pathname !== "/approve"
    ) {
      return "/approve"
    }
    if (
      dbUser.onboardingCompleted &&
      dbUser.clipperProfile?.verificationStatus === "UNVERIFIED" &&
      pathname !== "/approve"
    ) {
      return "/approve"
    }
    if (
      dbUser.clipperProfile?.verificationStatus === "REJECTED" &&
      pathname !== "/approve"
    ) {
      return "/approve"
    }
    if (
      dbUser.clipperProfile?.verificationStatus === "BANNED" &&
      pathname !== "/banned"
    ) {
      return "/banned"
    }
    if (dbUser.clipperProfile?.verificationStatus === "VERIFIED") {
      if (pathname === "/onboarding" || pathname === "/approve") {
        return "/"
      }
    }
  }
  return null
}

const ROLES = ["ADMIN", "ORGANIZER_ADMIN", "CLIENT", "CLIPPER"]
const STATUSES = [null, "UNVERIFIED", "PENDING", "VERIFIED", "REJECTED", "BANNED"]
const PATHS = ["/", "/my-competitions", "/onboarding", "/approve", "/banned"]

describe("redirecionamento de status do guard", () => {
  it("segue exatamente a regra antiga para todo papel, status e rota", () => {
    const users: AuthRedirectUser[] = [null, undefined]
    for (const role of ROLES) {
      for (const onboardingCompleted of [false, true]) {
        for (const status of STATUSES) {
          users.push({
            role,
            onboardingCompleted,
            clipperProfile: status ? { verificationStatus: status } : null,
          })
        }
      }
    }

    for (const user of users) {
      for (const pathname of PATHS) {
        expect(getStatusRedirect(user, pathname)).toBe(
          originalGuard(user, pathname),
        )
      }
    }
  })

  it("manda cada clipador para a tela do seu status", () => {
    const clipper = (onboardingCompleted: boolean, status: string | null) => ({
      role: "CLIPPER",
      onboardingCompleted,
      clipperProfile: status ? { verificationStatus: status } : null,
    })

    expect(getStatusRedirect(clipper(false, "UNVERIFIED"), "/")).toBe("/onboarding")
    expect(getStatusRedirect(clipper(false, "BANNED"), "/")).toBe("/onboarding")
    expect(getStatusRedirect(clipper(true, "PENDING"), "/")).toBe("/approve")
    expect(getStatusRedirect(clipper(true, "UNVERIFIED"), "/")).toBe("/approve")
    expect(getStatusRedirect(clipper(true, "REJECTED"), "/")).toBe("/approve")
    expect(getStatusRedirect(clipper(true, "BANNED"), "/")).toBe("/banned")
    expect(getStatusRedirect(clipper(true, "VERIFIED"), "/")).toBeNull()
    expect(getStatusRedirect(clipper(true, null), "/")).toBeNull()
  })

  it("não redireciona outros papéis nem usuário sem cadastro no banco", () => {
    for (const role of ["ADMIN", "ORGANIZER_ADMIN", "CLIENT"]) {
      expect(
        getStatusRedirect(
          { role, onboardingCompleted: false, clipperProfile: null },
          "/",
        ),
      ).toBeNull()
    }
    expect(getStatusRedirect(null, "/")).toBeNull()
    expect(getStatusRedirect(undefined, "/")).toBeNull()
  })
})
