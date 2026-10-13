import "server-only"

import { createHmac } from "node:crypto"

/**
 * Valida a assinatura do webhook da Kiwify usando HMAC-SHA1
 * A Kiwify envia a assinatura na query string: ?signature=xxx
 *
 * signature = hmac_sha1(JSON.stringify(request.body), secretKey)
 */
export function validateKiwifyWebhook(
  signature: string | null,
  body: string,
  secret: string
): boolean {
  if (!signature || !secret || !body) return false

  // Calcular HMAC-SHA1
  const calculatedSignature = createHmac("sha1", secret)
    .update(body)
    .digest("hex")

  return signature === calculatedSignature
}
