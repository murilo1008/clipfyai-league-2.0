/**
 * Opções do IntersectionObserver do <Reveal>.
 *
 * `threshold` PRECISA ser 0 (basta 1px visível). Um valor fracionário
 * quebra silenciosamente qualquer bloco mais alto que a viewport: a
 * interseção máxima possível é `viewport / alturaDoBloco`, então um
 * bloco de 9478px numa tela de 800px nunca passa de ~8% — com
 * threshold 0.15 ele ficava em opacity-0 para sempre, mesmo rolando.
 * Foi o que derrubou as tabs da competição na visão do clipador.
 *
 * Está isolado num módulo sem JSX para poder ser testado direto.
 */
export const REVEAL_OBSERVER_OPTIONS: IntersectionObserverInit = {
  rootMargin: "0px 0px -4% 0px",
  threshold: 0,
}

/**
 * Maior fração da área de um elemento que pode ficar visível de uma vez.
 * Serve para deixar explícito por que threshold fracionário é uma cilada.
 */
export function maxVisibleRatio(elementHeight: number, viewportHeight: number) {
  if (elementHeight <= 0) return 0
  return Math.min(1, viewportHeight / elementHeight)
}
