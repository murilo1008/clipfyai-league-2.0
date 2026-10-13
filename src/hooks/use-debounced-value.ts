import * as React from "react"

/**
 * Devolve `value` só depois de `delayMs` sem mudanças — use no input de
 * queries ligadas a campos de busca, para não disparar uma requisição por
 * tecla.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value)

  React.useEffect(() => {
    const timeout = setTimeout(() => setDebouncedValue(value), delayMs)
    return () => clearTimeout(timeout)
  }, [value, delayMs])

  return debouncedValue
}
