/**
 * Ícones dos marcadores do mapa como HTML estático.
 *
 * O `L.divIcon` do Leaflet só aceita string (ou elemento DOM), e gerar essa
 * string com `renderToString` puxava o `react-dom/server` inteiro para o
 * bundle do navegador. Como os ícones são fixos, a marcação fica pronta aqui:
 * é a mesma que `renderToString` produzia para os componentes de
 * `@/lib/icons` (garantido por `map-icons.test.tsx`).
 */

const svg = (className: string, path: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 256 256" class="${className}"><path d="${path}"></path></svg>`

/** `<MapPinIcon className="size-6" />` */
export const MAP_PIN_ICON_HTML = svg(
    "size-6",
    "M128,64a40,40,0,1,0,40,40A40,40,0,0,0,128,64Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,128Zm0-112a88.1,88.1,0,0,0-88,88c0,31.4,14.51,64.68,42,96.25a254.19,254.19,0,0,0,41.45,38.3,8,8,0,0,0,9.18,0A254.19,254.19,0,0,0,174,200.25c27.45-31.57,42-64.85,42-96.25A88.1,88.1,0,0,0,128,16Zm0,206c-16.53-13-72-60.75-72-118a72,72,0,0,1,144,0C200,161.23,144.53,209,128,222Z"
)

/** Alça de edição dos desenhos: `<CircleIcon className="fill-primary …" />` */
export const DRAW_HANDLE_ICON_HTML = svg(
    "fill-primary stroke-primary size-4 transition-transform hover:scale-110",
    "M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Z"
)

/** Ponto pulsante da localização atual (era o componente MapLocatePulseIcon). */
export const MAP_LOCATE_PULSE_ICON_HTML =
    '<div class="absolute -top-1 -right-1 flex size-3 rounded-full">' +
    '<div class="bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-75"></div>' +
    '<div class="bg-primary relative inline-flex size-3 rounded-full"></div>' +
    "</div>"
