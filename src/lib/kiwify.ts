// ============================================
// KIWIFY API CLIENT E TIPOS
// ============================================

/**
 * Status possíveis de um pedido na Kiwify
 * IMPORTANTE: Apenas "paid" deve resultar em criação/ativação de usuário
 */
export type KiwifyOrderStatus =
  | "waiting_payment"  // Aguardando pagamento - NÃO criar usuário
  | "paid"             // Pago/Aprovado - CRIAR/ATIVAR usuário
  | "refused"          // Recusado - NÃO criar usuário
  | "refunded"         // Reembolsado - CANCELAR assinatura
  | "chargedback"      // Chargeback - CANCELAR assinatura
  | "expired"          // Expirado - NÃO criar usuário
  | "in_analysis"      // Em análise - NÃO criar usuário

/**
 * Status possíveis de uma assinatura na Kiwify
 */
export type KiwifySubscriptionStatus =
  | "active"           // Ativa
  | "canceled"         // Cancelada
  | "past_due"         // Vencida
  | "unpaid"           // Não paga
  | "trialing"         // Em período de teste

/**
 * Tipos de eventos de webhook da Kiwify (documentação oficial)
 */
export type KiwifyWebhookEvent =
  | "order_approved"           // Compra aprovada
  | "order_refunded"           // Reembolso
  | "order_rejected"           // Compra recusada
  | "chargeback"               // Chargeback
  | "subscription_renewed"     // Assinatura renovada
  | "subscription_canceled"    // Assinatura cancelada
  | "subscription_late"        // Assinatura atrasada
  | "pix_created"              // PIX gerado
  | "billet_created"           // Boleto gerado
  // Carrinho abandonado NÃO envia webhook_event_type

/**
 * Cliente/Comprador (estrutura aninhada no webhook)
 */
export interface KiwifyCustomer {
  full_name: string
  email: string
  mobile?: string
  CPF?: string
  ip?: string
}

/**
 * Comissões (estrutura aninhada no webhook)
 */
export interface KiwifyCommissions {
  charge_amount: string           // Valor cobrado (em centavos como string)
  product_base_price: string      // Preço base do produto
  kiwify_fee: string              // Taxa Kiwify
  commissioned_stores?: Array<{
    id: string
    type: string                   // "affiliate" | "coproducer"
    custom_name: string
    email: string
    amount: string                 // Valor da comissão
  }>
  my_commission?: string          // Sua comissão
  funds_status?: string           // Status dos fundos
  estimated_deposit_date?: string // Data estimada de depósito
  currency_id?: string            // Moeda (ex: "BRL")
}

/**
 * Produto (estrutura aninhada no webhook)
 */
export interface KiwifyProduct {
  product_id: string
  product_name: string
}

/**
 * Assinatura (para produtos recorrentes)
 */
export interface KiwifySubscription {
  id: string
  start_date: string             // Data de início
  next_payment: string           // Próximo pagamento
  status: KiwifySubscriptionStatus
  plan: {
    id: string
    name: string
    frequency: string           // "monthly" | "yearly"
    qty_charges: number          // Quantidade de cobranças
  }
  charges: {
    completed: number             // Cobranças completadas
    future: number               // Cobranças futuras
  }
}

/**
 * Detalhes do pedido
 */
export interface KiwifyOrderDetails {
  order_id: string
  order_ref: string               // Referência do pedido
  order_status: KiwifyOrderStatus
  payment_method: string         // "credit_card" | "pix" | "boleto"
  store_id: string
  payment_link?: string          // Link do pagamento (para boleto/pix)
  billet_URL?: string            // URL do boleto
  billet_barcode?: string        // Código de barras do boleto
  billet_expiry_date?: string    // Data de expiração do boleto
  pix_code?: string              // Código PIX
  pix_expiration?: string        // Expiração do PIX
  refund_reason?: string         // Motivo do reembolso
  sale_type?: string             // "one_time" | "subscription"
  created_at: string             // Data de criação
  updated_at: string             // Data de atualização
  approved_date?: string         // Data de aprovação
}

/**
 * Rastreamento (tracking)
 */
export interface KiwifyTracking {
  src?: string                   // Fonte
  sck?: string                   // Subchave
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
}

/**
 * Payload completo do Webhook da Kiwify
 */
export interface KiwifyWebhookPayload {
  // Identificação do evento
  webhook_event_type?: KiwifyWebhookEvent
  
  // Dados do pedido
  order_id: string
  order_ref: string
  order_status: KiwifyOrderStatus
  
  // Dados do produto
  product_id: string
  product_name: string
  Product?: KiwifyProduct
  
  // Dados do cliente
  Customer: KiwifyCustomer
  
  // Dados financeiros
  Commissions: KiwifyCommissions
  
  // Dados de assinatura (se aplicável)
  Subscription?: KiwifySubscription
  subscription_id?: string
  
  // Tracking
  TrackingParameters?: KiwifyTracking
  
  // Timestamps
  created_at: string
  updated_at?: string
  approved_date?: string
  
  // Método de pagamento
  payment_method?: string
  installments?: number
  
  // Outros campos
  purchase_link?: string
  access_url?: string
  
  // Webhook Token (para validação)
  signature?: string
}

/**
 * Eventos de webhook suportados pela Kiwify (documentação oficial)
 */
export const KIWIFY_WEBHOOK_EVENTS = {
  // Compra
  ORDER_APPROVED: "order_approved",
  ORDER_REFUNDED: "order_refunded",
  ORDER_REJECTED: "order_rejected",
  CHARGEBACK: "chargeback",
  // Assinatura
  SUBSCRIPTION_RENEWED: "subscription_renewed",
  SUBSCRIPTION_CANCELED: "subscription_canceled",
  SUBSCRIPTION_LATE: "subscription_late",
  // Pagamento pendente
  PIX_CREATED: "pix_created",
  BILLET_CREATED: "billet_created",
} as const

// ============================================
// FUNÇÕES DE VALIDAÇÃO
// ============================================

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
  
  // Importar crypto para HMAC
  const crypto = require('crypto')
  
  // Calcular HMAC-SHA1
  const calculatedSignature = crypto
    .createHmac('sha1', secret)
    .update(body)
    .digest('hex')
  
  return signature === calculatedSignature
}

// ============================================
// MAPEAMENTO DE STATUS
// ============================================

/**
 * Mapeia status da Kiwify para status do sistema (SubscriptionStatus do Prisma)
 */
export function mapKiwifyStatusToSystemStatus(
  status: KiwifyOrderStatus | KiwifySubscriptionStatus
): "ACTIVE" | "CANCELLED" | "EXPIRED" | "TRIAL" | "NONE" {
  switch (status) {
    case "paid":
    case "active":
      return "ACTIVE"
    case "trialing":
      return "TRIAL"
    case "canceled":
      return "CANCELLED"
    case "refused":
    case "refunded":
    case "chargedback":
    case "expired":
    case "unpaid":
    case "past_due":
    case "waiting_payment":
    case "in_analysis":
      return "EXPIRED"
    default:
      return "NONE"
  }
}

/**
 * Mapeia o status da Kiwify para o formato esperado (para compatibilidade)
 * SEGURANÇA: Status desconhecido = waiting_payment (NÃO criar usuário!)
 */
export function mapKiwifyStatus(status: string): KiwifyOrderStatus {
  const statusLower = status.toLowerCase()
  
  // APROVADO - ÚNICO status que deve criar/ativar usuário
  if (statusLower === "approved" || statusLower === "paid" || statusLower === "completed") {
    return "paid"
  }
  
  // RECUSADO
  if (statusLower === "refused" || statusLower === "rejected" || statusLower === "declined" || statusLower === "failed") {
    return "refused"
  }
  
  // CANCELADO
  if (statusLower === "cancelled" || statusLower === "canceled") {
    return "refused"
  }
  
  // REEMBOLSADO
  if (statusLower === "refunded" || statusLower === "refund") {
    return "refunded"
  }
  
  // CHARGEBACK
  if (statusLower === "chargedback" || statusLower === "chargeback") {
    return "chargedback"
  }
  
  // AGUARDANDO PAGAMENTO
  if (statusLower === "waiting_payment" || statusLower === "pending" || statusLower === "waiting") {
    return "waiting_payment"
  }
  
  // EM ANÁLISE
  if (statusLower === "in_analysis" || statusLower === "analysis" || statusLower === "processing") {
    return "in_analysis"
  }
  
  // EXPIRADO
  if (statusLower === "expired") {
    return "expired"
  }
  
  // SEGURANÇA: Status desconhecido = aguardando pagamento (NÃO criar usuário!)
  console.warn(`⚠️ Status Kiwify não reconhecido: "${status}" - tratando como "waiting_payment" por segurança`)
  return "waiting_payment"
}

/**
 * Mapeia o status de assinatura da Kiwify
 */
export function mapKiwifySubscriptionStatus(status: string): KiwifySubscriptionStatus {
  const statusLower = status.toLowerCase()
  
  if (statusLower === "active" || statusLower === "approved" || statusLower === "paid") {
    return "active"
  }
  if (statusLower === "cancelled" || statusLower === "canceled") {
    return "canceled"
  }
  if (statusLower === "past_due" || statusLower === "overdue") {
    return "past_due"
  }
  if (statusLower === "unpaid") {
    return "unpaid"
  }
  if (statusLower === "trialing" || statusLower === "trial") {
    return "trialing"
  }
  
  return "active"
}

// ============================================
// FUNÇÕES DE VERIFICAÇÃO
// ============================================

/**
 * Verifica se o webhook é de uma assinatura
 */
export function isSubscriptionWebhook(payload: KiwifyWebhookPayload): boolean {
  return !!(payload.Subscription || payload.subscription_id)
}

/**
 * Verifica se é uma renovação de assinatura
 */
export function isSubscriptionRenewal(payload: KiwifyWebhookPayload): boolean {
  return payload.webhook_event_type === "subscription_renewed"
}

/**
 * Verifica se é um cancelamento
 */
export function isSubscriptionCancellation(payload: KiwifyWebhookPayload): boolean {
  return payload.webhook_event_type === "subscription_canceled" ||
         payload.webhook_event_type === "subscription_late"
}

/**
 * Verifica se o pedido foi aprovado/pago
 */
export function isOrderApproved(payload: KiwifyWebhookPayload): boolean {
  return payload.order_status === "paid" ||
         payload.webhook_event_type === "order_approved"
}

/**
 * Verifica se foi reembolso ou chargeback
 */
export function isRefundOrChargeback(payload: KiwifyWebhookPayload): boolean {
  return payload.order_status === "refunded" ||
         payload.order_status === "chargedback" ||
         payload.webhook_event_type === "order_refunded" ||
         payload.webhook_event_type === "chargeback"
}

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================

/**
 * Extrai o valor cobrado em reais (converte de centavos string para número)
 */
export function getChargeAmountInReais(commissions: KiwifyCommissions): number {
  const cents = parseInt(commissions.charge_amount || "0", 10)
  return cents / 100
}

/**
 * Formata valor em reais para exibição
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

// ============================================
// CONFIGURAÇÃO DOS PRODUTOS
// ============================================

/**
 * Clipfy League PRO — PAGAMENTO ÚNICO (produto ATIVO para novas vendas)
 *
 * Este é o produto vigente: R$ 197 à vista, podendo parcelar em até 12x.
 * Acesso vitalício, SEM assinatura/recorrência.
 *
 * IMPORTANTE:
 * - Toda nova venda deve ser direcionada para este produto.
 * - O produto antigo (assinatura R$5 + R$29/mês) está descontinuado para
 *   novas vendas, mas continua ativo para os clientes que já assinaram
 *   (apenas renovações). Veja `CLIPFY_PRO_LEGACY_SUBSCRIPTION_PRODUCT`.
 */
export const CLIPFY_PRO_PRODUCT = {
  id: "clipfy-pro",
  name: "Clipfy League PRO",
  checkoutUrl: "https://pay.kiwify.com.br/f2GUPz4",
  price: 197,
  maxInstallments: 12,
  installmentPrice: 20.37, // 12x no cartão com juros (valor real cobrado pela Kiwify)
  currency: "BRL",
  paymentType: "one_time" as const, // Pagamento único (não é mais assinatura)
  // Identificadores para verificação no webhook (pode ser product_id ou product_name parcial)
  // O primeiro item é o product_id REAL na Kiwify (UUID do produto novo).
  // Os demais são fallbacks por nome para máxima robustez.
  kiwifyProductIdentifiers: [
    "1bfc2050-45a3-11f1-aa52-e7258ad1149f", // product_id REAL na Kiwify (PRO vitalício R$ 197)
    "clipfy-pro-lifetime",
    "clipfy pro lifetime",
    "clipfy-pro-vitalicio",
    "clipfy pro vitalicio",
    "clipfy pro vitalício",
    "clipfy league pro lifetime",
    "clipfy league pro vitalício",
    "clipfy league pro vitalicio",
  ],
}

/**
 * Clipfy League PRO — ASSINATURA LEGADA (apenas renovações)
 *
 * Produto descontinuado para novas vendas. Continuamos honrando as
 * renovações automáticas dos clientes que já tinham essa assinatura
 * (R$ 5 no primeiro mês + R$ 29/mês).
 *
 * NÃO direcionar novos clientes para este checkout.
 */
export const CLIPFY_PRO_LEGACY_SUBSCRIPTION_PRODUCT = {
  id: "clipfy-pro-legacy",
  name: "Clipfy League PRO (Assinatura legada)",
  checkoutUrl: "https://pay.kiwify.com.br/NBpiTEH", // Produto antigo na Kiwify
  firstMonthPrice: 5,
  recurringPrice: 29,
  currency: "BRL",
  paymentType: "subscription" as const,
  // Identificadores para verificação no webhook (pode ser product_id ou product_name parcial)
  // Estes batem no produto antigo. Diferente de identifiers do novo PRO.
  kiwifyProductIdentifiers: [
    "clipfy-pro-legacy",
    "clipfy pro legacy",
    "clipfy-pro-assinatura",
    "clipfy pro assinatura",
    "clipfy league pro mensal",
    "clipfy league pro assinatura",
  ],
}

// Clipfy League ULTRA - Upgrade do PRO
export const CLIPFY_ULTRA_PRODUCT = {
  id: "clipfy-ultra",
  name: "Clipfy League ULTRA",
  checkoutUrl: "https://pay.kiwify.com.br/JAG2vRU",
  price: 297, // Preço promocional do ULTRA
  oldPrice: 497, // Preço original
  currency: "BRL",
  // Identificadores para verificação no webhook (pode ser product_id ou product_name parcial)
  kiwifyProductIdentifiers: ["ultra", "clipfy-ultra", "clipfy league ultra"],
}

// Manual do Clipador - Produto de compra única
export const CLIPPER_MANUAL_PRODUCT = {
  id: "manual-do-clipador",
  name: "Manual do Clipador",
  checkoutUrl: "https://pay.kiwify.com.br/0eiXb6e",
  price: 19.90,
  currency: "BRL",
  // Identificadores para verificação no webhook (pode ser product_id ou product_name parcial)
  kiwifyProductIdentifiers: ["manual", "clipador", "manual-do-clipador", "manual do clipador"],
}

/**
 * Gera URL de checkout do PRO (pagamento único) com email pré-preenchido
 */
export function getCheckoutUrlWithEmail(email: string): string {
  const encodedEmail = encodeURIComponent(email)
  return `${CLIPFY_PRO_PRODUCT.checkoutUrl}?email=${encodedEmail}`
}

/**
 * Gera URL de checkout do Manual do Clipador com email pré-preenchido
 */
export function getManualCheckoutUrlWithEmail(email: string): string {
  const encodedEmail = encodeURIComponent(email)
  return `${CLIPPER_MANUAL_PRODUCT.checkoutUrl}?email=${encodedEmail}`
}

/**
 * Verifica se o produto é o Manual do Clipador baseado no nome ou ID
 */
export function isClipperManualProduct(productId: string, productName: string): boolean {
  const searchStr = `${productId} ${productName}`.toLowerCase()
  return CLIPPER_MANUAL_PRODUCT.kiwifyProductIdentifiers.some(
    (identifier) => searchStr.includes(identifier.toLowerCase())
  )
}

/**
 * Verifica se o produto é o Clipfy League ULTRA baseado no nome ou ID
 */
export function isClipfyUltraProduct(productId: string, productName: string): boolean {
  const searchStr = `${productId} ${productName}`.toLowerCase()
  return CLIPFY_ULTRA_PRODUCT.kiwifyProductIdentifiers.some(
    (identifier) => searchStr.includes(identifier.toLowerCase())
  )
}

/**
 * Verifica se o produto é o Clipfy League PRO LEGADO (assinatura R$ 5 + R$ 29/mês)
 *
 * Importante: a Kiwify não vai mais permitir novas vendas, mas pode
 * continuar enviando webhooks de renovação/cancelamento desse produto.
 */
export function isClipfyProLegacySubscriptionProduct(
  productId: string,
  productName: string
): boolean {
  const searchStr = `${productId} ${productName}`.toLowerCase()
  return CLIPFY_PRO_LEGACY_SUBSCRIPTION_PRODUCT.kiwifyProductIdentifiers.some(
    (identifier) => searchStr.includes(identifier.toLowerCase())
  )
}

/**
 * Verifica se o produto é o Clipfy League PRO NOVO (pagamento único de R$ 197)
 *
 * Estratégia de matching:
 * 1. Bate em algum identificador específico do produto novo
 *    (ex.: "clipfy-pro-lifetime"); OU
 * 2. Contém algo como "clipfy pro" / "clipfy-pro" e NÃO bate como ULTRA,
 *    NÃO bate como Manual e NÃO bate como o legado de assinatura.
 *
 * Isso garante que, mesmo que o nome do produto na Kiwify ainda esteja
 * só como "Clipfy League PRO", ele é considerado o produto novo
 * (pagamento único) por padrão.
 */
export function isClipfyProLifetimeProduct(
  productId: string,
  productName: string
): boolean {
  const searchStr = `${productId} ${productName}`.toLowerCase()

  // 1. Match direto pelos identificadores explícitos do novo produto
  const matchesExplicit = CLIPFY_PRO_PRODUCT.kiwifyProductIdentifiers.some(
    (identifier) => searchStr.includes(identifier.toLowerCase())
  )
  if (matchesExplicit) return true

  // 2. Fallback: parece "Clipfy PRO" e não é ULTRA/Manual/Legado
  const looksLikePro =
    searchStr.includes("clipfy pro") ||
    searchStr.includes("clipfy-pro") ||
    searchStr.includes("clipfy league pro")

  if (!looksLikePro) return false

  if (isClipfyUltraProduct(productId, productName)) return false
  if (isClipperManualProduct(productId, productName)) return false
  if (isClipfyProLegacySubscriptionProduct(productId, productName)) return false

  return true
}

/**
 * Gera URL de checkout do Clipfy ULTRA com email pré-preenchido
 */
export function getUltraCheckoutUrlWithEmail(email: string): string {
  const encodedEmail = encodeURIComponent(email)
  return `${CLIPFY_ULTRA_PRODUCT.checkoutUrl}?email=${encodedEmail}`
}

/**
 * Gera URL de checkout com parâmetros UTM para tracking
 */
export function getCheckoutUrlWithTracking(params: {
  email?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
}): string {
  const url = new URL(CLIPFY_PRO_PRODUCT.checkoutUrl)
  
  if (params.email) {
    url.searchParams.set('email', params.email)
  }
  if (params.utmSource) {
    url.searchParams.set('utm_source', params.utmSource)
  }
  if (params.utmMedium) {
    url.searchParams.set('utm_medium', params.utmMedium)
  }
  if (params.utmCampaign) {
    url.searchParams.set('utm_campaign', params.utmCampaign)
  }
  
  return url.toString()
}
