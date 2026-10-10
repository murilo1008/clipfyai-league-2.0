import { describe, expect, it } from "vitest";
import {
  clientMockMode,
  clipsAllowedForUser,
  clipsEnabled,
  mockAllowed,
} from "./availability";
describe("disponibilidade de AI Clips", () => {
  it("decide o modo do client mesmo sem validação do env", () => {
    expect(clientMockMode("production", "1")).toBe("blocked");
    expect(clientMockMode("development", "1")).toBe("mock");
    expect(clientMockMode("production", "0")).toBe("real");
  });
  it("bloqueia mock em produção e fecha a feature desligada", () => {
    expect(mockAllowed("production", "1")).toBe(false);
    expect(mockAllowed("development", "1")).toBe(true);
    expect(mockAllowed("production", "0")).toBe(true);
    expect(clipsEnabled("0")).toBe(false);
    expect(clipsEnabled(undefined)).toBe(false);
    expect(clipsEnabled("1")).toBe(true);
  });
});

describe("acesso por e-mail ao AI Clips", () => {
  const verified = (emailAddress: string) => ({
    emailAddress,
    verification: { status: "verified" },
  });
  const user = { primaryEmailAddress: verified("tester@example.com") };

  it("nega acesso com a flag desligada, lista vazia ou sem sessão", () => {
    expect(clipsAllowedForUser("0", "tester@example.com", user)).toBe(false);
    expect(clipsAllowedForUser(undefined, "tester@example.com", user)).toBe(
      false,
    );
    expect(clipsAllowedForUser("1", undefined, user)).toBe(false);
    expect(clipsAllowedForUser("1", " , , ", user)).toBe(false);
    expect(clipsAllowedForUser("1", "tester@example.com", null)).toBe(false);
  });

  it("compara e-mails completos sem diferenciar maiúsculas ou espaços", () => {
    expect(
      clipsAllowedForUser(
        "1",
        " another@example.com, TESTER@EXAMPLE.COM ,",
        user,
      ),
    ).toBe(true);
    expect(clipsAllowedForUser("1", "other@example.com", user)).toBe(false);
    expect(clipsAllowedForUser("1", "example.com", user)).toBe(false);
    expect(clipsAllowedForUser("1", "test@example.com", user)).toBe(false);
    expect(clipsAllowedForUser("1", "*@example.com", user)).toBe(false);
  });

  it("aceita um e-mail secundário apenas quando verificado pelo Clerk", () => {
    expect(
      clipsAllowedForUser("1", "tester@example.com", {
        primaryEmailAddress: verified("other@example.com"),
        emailAddresses: [verified("tester@example.com")],
      }),
    ).toBe(true);
    for (const verification of [undefined, null, { status: "unverified" }]) {
      const email = { emailAddress: "tester@example.com", verification };
      expect(
        clipsAllowedForUser("1", "tester@example.com", {
          primaryEmailAddress: email,
          emailAddresses: [email],
        }),
      ).toBe(false);
    }
  });
});
