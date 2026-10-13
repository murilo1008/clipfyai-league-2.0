import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { CircleIcon, MapPinIcon } from "@/lib/icons"

import {
    DRAW_HANDLE_ICON_HTML,
    MAP_LOCATE_PULSE_ICON_HTML,
    MAP_PIN_ICON_HTML,
} from "./map-icons"

describe("ícones estáticos do mapa", () => {
    it("reproduzem a marcação que o renderToString gerava", () => {
        expect(MAP_PIN_ICON_HTML).toBe(
            renderToString(<MapPinIcon className="size-6" />)
        )
        expect(DRAW_HANDLE_ICON_HTML).toBe(
            renderToString(
                <CircleIcon className="fill-primary stroke-primary size-4 transition-transform hover:scale-110" />
            )
        )
    })

    it("mantém o ponto pulsante da localização igual ao componente antigo", () => {
        expect(MAP_LOCATE_PULSE_ICON_HTML).toBe(
            renderToString(
                <div className="absolute -top-1 -right-1 flex size-3 rounded-full">
                    <div className="bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-75" />
                    <div className="bg-primary relative inline-flex size-3 rounded-full" />
                </div>
            )
        )
    })
})
