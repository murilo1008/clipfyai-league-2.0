/**
 * Normalização canônica de valores monetários em BRL.
 *
 * O campo `prize` das competições (e das faixas de premiação) é uma string
 * livre digitada pelo admin — chega como "10000", "R$ 10000", "R$ 50.000",
 * "10.000,50" etc. Todo lugar que EXIBE um prêmio deve passar por
 * `formatPrizeLabel` para o usuário sempre ver "R$ 10.000", nunca "10000".
 *
 * Comparações de valor cru (ex.: `prize !== "R$ 0"`) devem continuar usando
 * a string original — o helper é só para exibição.
 */

/**
 * Interpreta uma string monetária pt-BR (com ou sem "R$").
 * Retorna `null` quando o texto não é um valor numérico puro
 * (ex.: "iPhone + bônus"), para que o chamador preserve o original.
 */
export function parseBRLNumber(raw: string): number | null {
  const s = raw
    .replace(/R\$\s*/gi, "")
    .replace(/\s+/g, "")
    .trim()
  if (!s) return null

  // pt-BR completo: 1.234.567 ou 1.234.567,89
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) {
    return Number(s.replace(/\./g, "").replace(",", "."))
  }
  // Sem milhar, vírgula decimal: 1234 ou 1234,56
  if (/^\d+(,\d{1,2})?$/.test(s)) {
    return Number(s.replace(",", "."))
  }
  // Estilo en com 1–2 decimais: 1234.56 ("10.000" NÃO cai aqui — 3 dígitos é milhar)
  if (/^\d+\.\d{1,2}$/.test(s)) {
    return Number(s)
  }
  return null
}

/** Formata um número como BRL: inteiros sem centavos ("R$ 10.000"). */
export function formatBRLNumber(value: number): string {
  const isInt = Number.isInteger(value)
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: isInt ? 0 : 2,
    maximumFractionDigits: isInt ? 0 : 2,
  })
}

/**
 * Normaliza uma string de prêmio para exibição.
 * "10000" → "R$ 10.000" · "R$ 10000,50" → "R$ 10.000,50" ·
 * "R$ 50.000" → "R$ 50.000" · "iPhone + R$ 5.000" → inalterado.
 */
export function formatPrizeLabel(raw: string | null | undefined): string {
  if (raw == null) return ""
  const trimmed = String(raw).trim()
  if (!trimmed) return ""
  const parsed = parseBRLNumber(trimmed)
  if (parsed == null) return trimmed
  return formatBRLNumber(parsed)
}
