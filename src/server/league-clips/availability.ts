export function mockAllowed(
  nodeEnv: string | undefined,
  mock: string | undefined,
) {
  return nodeEnv !== "production" || mock !== "1";
}
export function clientMockMode(
  nodeEnv: string | undefined,
  mock: string | undefined,
): "real" | "mock" | "blocked" {
  if (mock !== "1") return "real";
  return mockAllowed(nodeEnv, mock) ? "mock" : "blocked";
}
export function clipsEnabled(flag: string | undefined) {
  return flag === "1";
}

type VerifiedEmail = {
  emailAddress: string;
  verification?: { status: string } | null;
};

export type AIClipsUser = {
  primaryEmailAddress?: VerifiedEmail | null;
  emailAddresses?: VerifiedEmail[];
};

export function clipsAllowedForUser(
  flag: string | undefined,
  allowedEmails: string | undefined,
  user: AIClipsUser | null | undefined,
) {
  if (!clipsEnabled(flag) || !user) return false;
  const allowed = new Set(
    (allowedEmails ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  const emails = [user.primaryEmailAddress, ...(user.emailAddresses ?? [])];
  return emails.some(
    (email) =>
      email?.verification?.status === "verified" &&
      allowed.has(email.emailAddress.trim().toLowerCase()),
  );
}
