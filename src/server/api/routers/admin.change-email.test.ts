import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const clerkClient = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: "admin-1" }),
  currentUser: vi.fn(),
  clerkClient,
}));
vi.mock("@/server/db", () => ({ db: {} }));

import { adminRouter } from "./admin";

const TARGET = { id: "user-1", email: "antigo@x.com", name: "Clipador" };

function setup({
  emailOwner = null as { id: string } | null,
  updateError = null as Error | null,
  emailAddresses = [{ id: "ea-old", emailAddress: "antigo@x.com" }],
} = {}) {
  const clerk = {
    users: {
      getUser: vi.fn().mockResolvedValue({
        id: TARGET.id,
        primaryEmailAddressId: "ea-old",
        emailAddresses,
      }),
      updateUser: vi.fn().mockResolvedValue({}),
    },
    emailAddresses: {
      createEmailAddress: vi.fn().mockResolvedValue({ id: "ea-new" }),
      updateEmailAddress: vi.fn().mockResolvedValue({}),
      deleteEmailAddress: vi.fn().mockResolvedValue({}),
    },
  };
  clerkClient.mockResolvedValue(clerk);

  const db = {
    user: {
      // O primeiro findUnique é o do middleware de admin.
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === "admin-1" ? { role: "ADMIN" } : TARGET),
      ),
      findFirst: vi.fn().mockResolvedValue(emailOwner),
      update: updateError
        ? vi.fn().mockRejectedValue(updateError)
        : vi.fn().mockResolvedValue({}),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };

  const api = adminRouter.createCaller({
    db,
    headers: new Headers(),
  } as never);

  return { api, clerk, db };
}

beforeEach(() => {
  clerkClient.mockReset();
});

describe("changeUserEmail", () => {
  it("troca o primário no Clerk, salva no banco e remove o e-mail antigo", async () => {
    const { api, clerk, db } = setup();

    const result = await api.changeUserEmail({
      userId: TARGET.id,
      newEmail: "  Novo@X.com ",
    });

    expect(result).toEqual({ success: true, email: "novo@x.com" });
    expect(clerk.emailAddresses.createEmailAddress).toHaveBeenCalledWith({
      userId: TARGET.id,
      emailAddress: "novo@x.com",
      verified: true,
      primary: true,
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: TARGET.id },
      data: { email: "novo@x.com" },
    });
    expect(clerk.emailAddresses.deleteEmailAddress).toHaveBeenCalledTimes(1);
    expect(clerk.emailAddresses.deleteEmailAddress).toHaveBeenCalledWith(
      "ea-old",
    );
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityId: TARGET.id,
        changes: expect.objectContaining({
          action: "email_changed",
          before: { email: "antigo@x.com" },
          after: { email: "novo@x.com" },
        }),
      }),
    });
  });

  it("promove o e-mail que já está na conta em vez de criar outro", async () => {
    const { api, clerk } = setup({
      emailAddresses: [
        { id: "ea-old", emailAddress: "antigo@x.com" },
        { id: "ea-secondary", emailAddress: "novo@x.com" },
      ],
    });

    await api.changeUserEmail({ userId: TARGET.id, newEmail: "novo@x.com" });

    expect(clerk.emailAddresses.createEmailAddress).not.toHaveBeenCalled();
    expect(clerk.emailAddresses.updateEmailAddress).toHaveBeenCalledWith(
      "ea-secondary",
      { verified: true, primary: true },
    );
    expect(clerk.emailAddresses.deleteEmailAddress).toHaveBeenCalledWith(
      "ea-old",
    );
    expect(clerk.emailAddresses.deleteEmailAddress).not.toHaveBeenCalledWith(
      "ea-secondary",
    );
  });

  it("recusa e-mail que já pertence a outra conta sem tocar no Clerk", async () => {
    const { api, clerk, db } = setup({ emailOwner: { id: "user-2" } });

    await expect(
      api.changeUserEmail({ userId: TARGET.id, newEmail: "novo@x.com" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(db.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: { equals: "novo@x.com", mode: "insensitive" },
        id: { not: TARGET.id },
      },
      select: { id: true },
    });
    expect(clerk.emailAddresses.createEmailAddress).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("recusa o mesmo e-mail atual", async () => {
    const { api, clerk } = setup();

    await expect(
      api.changeUserEmail({ userId: TARGET.id, newEmail: "ANTIGO@x.com" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(clerkClient).not.toHaveBeenCalled();
    expect(clerk.emailAddresses.createEmailAddress).not.toHaveBeenCalled();
  });

  it("converte o e-mail já usado no Clerk em CONFLICT", async () => {
    const { api, clerk, db } = setup();
    clerk.emailAddresses.createEmailAddress.mockRejectedValue({
      errors: [{ code: "form_identifier_exists" }],
    });

    await expect(
      api.changeUserEmail({ userId: TARGET.id, newEmail: "novo@x.com" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("desfaz a troca no Clerk quando o banco falha", async () => {
    const { api, clerk } = setup({
      updateError: new Prisma.PrismaClientKnownRequestError("unique", {
        code: "P2002",
        clientVersion: "test",
      }),
    });

    await expect(
      api.changeUserEmail({ userId: TARGET.id, newEmail: "novo@x.com" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(clerk.users.updateUser).toHaveBeenCalledWith(TARGET.id, {
      primaryEmailAddressID: "ea-old",
    });
    expect(clerk.emailAddresses.deleteEmailAddress).toHaveBeenCalledTimes(1);
    expect(clerk.emailAddresses.deleteEmailAddress).toHaveBeenCalledWith(
      "ea-new",
    );
  });
});
