import { describe, expect, it } from "vitest";

import {
  CS_COOKIE_NAME,
  csCookieOptions,
  parseCsCookie,
  parseCsCookieValue,
  readCsCookieFromHeader,
  serializeCsCookie,
} from "./cookie";

describe("cookie de visualização de CS", () => {
  it("serializa e interpreta o valor amarrado ao ator", () => {
    const value = serializeCsCookie({
      actorId: "user_abc",
      clientId: "user_def",
    });
    expect(value).toBe("user_abc:user_def");
    expect(parseCsCookieValue(value)).toEqual({
      actorId: "user_abc",
      clientId: "user_def",
    });
  });

  it("rejeita valores malformados", () => {
    const bad = [
      null,
      undefined,
      "",
      "semseparador",
      ":client",
      "actor:",
      "a b:c",
      "a:b:c",
      "../x:y",
      `${"a".repeat(65)}:b`,
    ];
    for (const value of bad) {
      expect(parseCsCookieValue(value), String(value)).toBeNull();
    }
  });

  it("lê o cookie dentro do header Cookie completo (inclusive URL-encoded)", () => {
    const header = `foo=bar; ${CS_COOKIE_NAME}=user_a%3Auser_b; sidebar_state=true`;
    expect(readCsCookieFromHeader(header)).toBe("user_a%3Auser_b");
    expect(parseCsCookie(header)).toEqual({
      actorId: "user_a",
      clientId: "user_b",
    });
    expect(parseCsCookie("foo=bar; sidebar_state=true")).toBeNull();
    expect(parseCsCookie(null)).toBeNull();
    expect(parseCsCookie(`${CS_COOKIE_NAME}_other=a:b`)).toBeNull();
  });

  it("opções: httpOnly, lax, raiz e secure só quando pedido", () => {
    expect(csCookieOptions(true)).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
    });
    expect(csCookieOptions(false).secure).toBe(false);
    expect(csCookieOptions(false).maxAge).toBeGreaterThan(0);
  });
});
