import { describe, expect, it } from "vitest"

import {
  createRestoreTracker,
  previousEntryPathname,
  type NavigationLike,
} from "./navigation-restore"

describe("createRestoreTracker", () => {
  it("restaura só a rota esperada (voltar/BackLink)", () => {
    const tracker = createRestoreTracker()
    tracker.commit("/competitions/abc")

    tracker.expect("/competitions")
    // A página de destino lê a marcação já no render, antes do commit.
    expect(tracker.isRestoring("/competitions")).toBe(true)
    expect(tracker.commit("/competitions")).toBe(true)
    // Estados montados depois (dados chegando) continuam restaurando.
    expect(tracker.isRestoring("/competitions")).toBe(true)
  })

  it("navegação comum não restaura e limpa a marcação anterior", () => {
    const tracker = createRestoreTracker()
    tracker.expect("/competitions")
    expect(tracker.commit("/competitions")).toBe(true)

    expect(tracker.commit("/competitions/abc")).toBe(false)
    expect(tracker.isRestoring("/competitions")).toBe(false)
    expect(tracker.isRestoring("/competitions/abc")).toBe(false)
  })

  it("marcação para outra rota não vale para a rota que chegou", () => {
    const tracker = createRestoreTracker()
    tracker.expect("/clans")

    expect(tracker.commit("/competitions")).toBe(false)
    // Consumida: não sobra para uma navegação futura para /clans.
    expect(tracker.commit("/clans")).toBe(false)
  })

  it("voltar avisado antes do render marca a rota de destino", () => {
    const tracker = createRestoreTracker()
    tracker.commit("/competitions/abc")

    expect(tracker.traverse("/competitions", "/competitions/abc")).toBe(false)
    expect(tracker.isRestoring("/competitions")).toBe(true)
    expect(tracker.commit("/competitions")).toBe(true)
    // O popstate que chega depois do `navigate` não restaura de novo.
    expect(tracker.traverse("/competitions", "/competitions")).toBe(false)
  })

  it("voltar avisado depois do render (popstate tardio) restaura na hora", () => {
    const tracker = createRestoreTracker()
    tracker.commit("/competitions/abc")
    // O Next já renderizou a lista no popstate, antes do nosso listener.
    expect(tracker.commit("/competitions")).toBe(false)

    expect(tracker.traverse("/competitions", "/competitions")).toBe(true)
    expect(tracker.isRestoring("/competitions")).toBe(true)
    expect(tracker.traverse("/competitions", "/competitions")).toBe(false)
  })
})

function fakeNavigation(urls: string[], index: number): NavigationLike {
  return {
    currentEntry: { index },
    entries: () => urls.map((url) => ({ url })),
  }
}

describe("previousEntryPathname", () => {
  it("devolve o pathname da entrada anterior", () => {
    const navigation = fakeNavigation(
      [
        "https://app.test/competitions?x=1",
        "https://app.test/competitions/abc",
      ],
      1,
    )
    expect(previousEntryPathname(navigation)).toBe("/competitions")
  })

  it("não há anterior na primeira entrada nem sem Navigation API", () => {
    expect(
      previousEntryPathname(
        fakeNavigation(["https://app.test/competitions/abc"], 0),
      ),
    ).toBeUndefined()
    expect(previousEntryPathname(undefined)).toBeUndefined()
    expect(
      previousEntryPathname({ currentEntry: null, entries: () => [] }),
    ).toBeUndefined()
  })

  it("entrada sem URL (outra origem) não conta", () => {
    const navigation: NavigationLike = {
      currentEntry: { index: 1 },
      entries: () => [{ url: null }, { url: "https://app.test/clans/x" }],
    }
    expect(previousEntryPathname(navigation)).toBeUndefined()
  })
})
