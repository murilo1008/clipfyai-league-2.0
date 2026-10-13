import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ClipThumbnail } from "./clip-thumbnail"

const TIKTOK_URL =
  "https://p16-sign-va.tiktokcdn.com/obj/thumb.jpeg?x-expires=1760000000&x-signature=abc"

describe("thumbnail de post de rede social", () => {
  it("usa a URL do CDN direto, sem Referer e com carregamento sob demanda", () => {
    const markup = renderToStaticMarkup(
      <ClipThumbnail src={TIKTOK_URL} alt="Post de @clipador" fill sizes="96px" />,
    )

    expect(markup).toContain("<img")
    expect(markup).not.toContain("/_next/image")
    expect(markup).toContain(`src="${TIKTOK_URL.replaceAll("&", "&amp;")}"`)
    expect(markup).toContain('referrerPolicy="no-referrer"')
    expect(markup).toContain('loading="lazy"')
  })

  it("não força lazy quando a imagem é prioritária", () => {
    const markup = renderToStaticMarkup(
      <ClipThumbnail src={TIKTOK_URL} alt="" fill priority sizes="33vw" />,
    )

    expect(markup).toContain("<img")
    expect(markup).not.toContain('loading="lazy"')
  })

  it("mostra o placeholder no mesmo tamanho quando não há URL", () => {
    const filled = renderToStaticMarkup(
      <ClipThumbnail src={null} alt="Post de @clipador" fill />,
    )
    expect(filled).not.toContain("<img")
    expect(filled).toContain('data-slot="clip-thumbnail-fallback"')
    expect(filled).toContain('role="img"')
    expect(filled).toContain('aria-label="Post de @clipador"')
    expect(filled).toContain("absolute inset-0")

    const sized = renderToStaticMarkup(
      <ClipThumbnail src="" alt="" width={48} height="64" className="rounded-lg" />,
    )
    expect(sized).toContain("width:48px;height:64px")
    expect(sized).toContain("rounded-lg")
    expect(sized).toContain('aria-hidden="true"')
  })

  it("aceita um fallback próprio, inclusive nenhum", () => {
    expect(
      renderToStaticMarkup(<ClipThumbnail src={undefined} alt="" fill fallback={null} />),
    ).toBe("")
    expect(
      renderToStaticMarkup(
        <ClipThumbnail src={undefined} alt="" fill fallback={<b>sem capa</b>} />,
      ),
    ).toBe("<b>sem capa</b>")
  })
})
