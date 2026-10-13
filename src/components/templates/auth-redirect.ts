/** Campos de `user.getCurrentUser` que decidem o redirecionamento. */
export type AuthRedirectUser =
  | {
      role: string
      onboardingCompleted: boolean
      clipperProfile: { verificationStatus: string } | null
    }
  | null
  | undefined

/**
 * Para onde o guard deve mandar o usuário logado que está em `pathname`
 * (onboarding / aprovação / banimento por verificationStatus), ou `null` se
 * ele pode ficar. Só CLIPPER é redirecionado; a ordem das regras importa.
 */
export function getStatusRedirect(
  user: AuthRedirectUser,
  pathname: string,
): string | null {
  if (user?.role !== "CLIPPER") return null

  const status = user.clipperProfile?.verificationStatus

  if (!user.onboardingCompleted && pathname !== "/onboarding") {
    return "/onboarding"
  }

  if (
    user.onboardingCompleted &&
    (status === "PENDING" || status === "UNVERIFIED") &&
    pathname !== "/approve"
  ) {
    return "/approve"
  }

  if (status === "REJECTED" && pathname !== "/approve") return "/approve"

  if (status === "BANNED" && pathname !== "/banned") return "/banned"

  if (
    status === "VERIFIED" &&
    (pathname === "/onboarding" || pathname === "/approve")
  ) {
    return "/"
  }

  return null
}
