import { describe, expect, it } from "vitest";

import { getMenuByRole } from "./navigation";

describe("getMenuByRole", () => {
  it("CUSTOMER_SUCCESS tem menu próprio e não cai no fallback de CLIPPER", () => {
    const menu = getMenuByRole("CUSTOMER_SUCCESS");
    expect(menu.map((item) => item.url)).toEqual(["/"]);
    expect(menu).not.toEqual(getMenuByRole("CLIPPER"));
  });

  it("papel desconhecido continua caindo no menu de CLIPPER", () => {
    expect(getMenuByRole("NAO_EXISTE")).toEqual(getMenuByRole("CLIPPER"));
  });

  it("ADMIN tem o item Equipe CS em Configurações", () => {
    const settings = getMenuByRole("ADMIN").find(
      (item) => item.url === "/settings",
    );
    expect(settings?.items.some((sub) => sub.url === "/settings/cs-team")).toBe(
      true,
    );
  });

  it("CLIENT não ganhou itens novos", () => {
    const urls = getMenuByRole("CLIENT").map((item) => item.url);
    expect(urls).toEqual([
      "/",
      "/posts",
      "/performance",
      "/client-comments",
      "/client-downloads",
      "/settings",
    ]);
  });
});
