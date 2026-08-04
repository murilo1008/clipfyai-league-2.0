import { TRPCError } from "@trpc/server";
import { env } from "@/env";

type ClerkUserLike = {
  primaryEmailAddress?: { emailAddress?: string | null } | null;
  emailAddresses?: Array<{ emailAddress?: string | null }>;
};

function parseCsv(value?: string) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function getUserEmails(user?: ClerkUserLike) {
  const emails = new Set<string>();

  const primaryEmail = user?.primaryEmailAddress?.emailAddress;
  if (primaryEmail) emails.add(primaryEmail.toLowerCase());

  for (const email of user?.emailAddresses ?? []) {
    if (email.emailAddress) emails.add(email.emailAddress.toLowerCase());
  }

  return emails;
}

export function canUseSocialIntegrations(params: {
  userId: string;
  user?: ClerkUserLike;
}) {
  const allowedUserIds = parseCsv(env.SOCIAL_INTEGRATIONS_ALLOWED_USER_IDS);
  const allowedEmails = parseCsv(
    env.SOCIAL_INTEGRATIONS_ALLOWED_EMAILS?.toLowerCase(),
  );

  if (allowedUserIds.size === 0 && allowedEmails.size === 0) {
    return false;
  }

  if (allowedUserIds.has(params.userId)) {
    return true;
  }

  for (const email of getUserEmails(params.user)) {
    if (allowedEmails.has(email)) {
      return true;
    }
  }

  return false;
}

export function assertCanUseSocialIntegrations(params: {
  userId: string;
  user?: ClerkUserLike;
}) {
  if (!canUseSocialIntegrations(params)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Integrações sociais ainda não estão disponíveis para este usuário",
    });
  }
}
