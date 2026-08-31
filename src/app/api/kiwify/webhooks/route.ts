import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { db } from "@/server/db"
import { clerkClient } from "@clerk/nextjs/server"
import {
  type KiwifyWebhookPayload,
  KIWIFY_WEBHOOK_EVENTS,
  validateKiwifyWebhook,
  mapKiwifyStatus,
  mapKiwifySubscriptionStatus,
  isSubscriptionWebhook,
  isSubscriptionRenewal,
  isSubscriptionCancellation,
  isOrderApproved,
  isRefundOrChargeback,
  isClipperManualProduct,
  isClipfyUltraProduct,
  isClipfyProLegacySubscriptionProduct,
  isClipfyProLifetimeProduct,
} from "@/lib/kiwify"
import {
  sendWelcomeProEmail,
  sendPaymentConfirmationEmail,
  sendSubscriptionCanceledEmail,
} from "@/lib/emails/clipfy-pro"
import { sendUltraPurchaseConfirmationEmail } from "@/lib/emails/clipfy-ultra"
import { sendManualPurchaseConfirmationEmail } from "@/lib/emails/clipfy-manual"

// ============================================
// CONFIGURAÇÃO
// ============================================

const KIWIFY_WEBHOOK_SECRET = process.env.KIWIFY_WEBHOOK_SECRET

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Gera uma senha aleatória forte
 */
function generateRandomPassword(length = 12): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*"
  let password = ""
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

/**
 * Converte um valor desconhecido do payload em string de forma segura.
 * Retorna "" para objetos/arrays/null/undefined (evita "[object Object]").
 */
function safeString(value: unknown): string {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return ""
}

// ============================================
// WEBHOOK HANDLER PRINCIPAL
// ============================================

export async function POST(req: NextRequest) {
  const body = await req.text()
  
  // Extrair signature da query string (como documentado pela Kiwify)
  const url = new URL(req.url)
  const signature = url.searchParams.get("signature")
  
  // Validar assinatura se configurado
  if (KIWIFY_WEBHOOK_SECRET) {
    console.log(`\n🔐 Validando assinatura do webhook Kiwify...`)
    
    if (!validateKiwifyWebhook(signature, body, KIWIFY_WEBHOOK_SECRET)) {
      console.error("❌ Webhook Kiwify: assinatura inválida")
      // Em produção, você pode descomentar o return abaixo:
      // return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 })
      console.warn("⚠️ Continuando mesmo com assinatura inválida (modo de debug)")
    } else {
      console.log("✅ Assinatura válida!")
    }
  } else {
    console.warn("⚠️ KIWIFY_WEBHOOK_SECRET não configurado - assinatura não validada")
  }
  
  // Parse do body
  let parsedBody: Record<string, unknown> = {}
  try {
    parsedBody = JSON.parse(body)
  } catch {
    console.error("❌ Webhook Kiwify: erro ao parsear body")
    return NextResponse.json(
      { error: "Payload inválido" },
      { status: 400 }
    )
  }

  // Extrair dados aninhados
  const customerData = parsedBody.Customer as Record<string, unknown> | undefined
  const productData = parsedBody.Product as Record<string, unknown> | undefined
  const commissionsData = parsedBody.Commissions as Record<string, unknown> | undefined
  const subscriptionData = parsedBody.Subscription as Record<string, unknown> | undefined

  // Log para debug
  console.log(`\n🔍 ========================================`)
  console.log(`🔍 Webhook Kiwify - Clipfy PRO`)
  console.log(`🔍 ========================================`)
  console.log(`   Order ID: ${safeString(parsedBody.order_id) || "N/A"}`)
  console.log(`   Order Status: ${safeString(parsedBody.order_status) || "N/A"}`)
  console.log(`   Event Type: ${safeString(parsedBody.webhook_event_type) || "N/A"}`)
  console.log(`   Customer Email: ${safeString(customerData?.email) || "N/A"}`)
  console.log(`   Customer Name: ${safeString(customerData?.full_name) || "N/A"}`)
  console.log(`   Product ID: ${safeString(productData?.product_id) || "N/A"}`)
  console.log(`   Product Name: ${safeString(productData?.product_name) || "N/A"}`)

  // Validação básica
  const email = customerData?.email as string | undefined
  
  if (!email) {
    console.error("❌ Webhook Kiwify: email do cliente não encontrado")
    return NextResponse.json(
      { error: "Email do cliente não encontrado" },
      { status: 400 }
    )
  }

  // Converter para o formato esperado
  const payload: KiwifyWebhookPayload = {
    webhook_event_type: parsedBody.webhook_event_type as KiwifyWebhookPayload["webhook_event_type"],
    order_id: safeString(parsedBody.order_id),
    order_ref: safeString(parsedBody.order_ref),
    order_status: mapKiwifyStatus(safeString(parsedBody.order_status)),
    product_id: safeString(productData?.product_id),
    product_name: safeString(productData?.product_name),
    Customer: {
      full_name: safeString(customerData?.full_name),
      email: safeString(customerData?.email),
      mobile: safeString(customerData?.mobile),
      CPF: safeString(customerData?.CPF),
    },
    Commissions: {
      charge_amount: safeString(commissionsData?.charge_amount) || "0",
      product_base_price: safeString(commissionsData?.product_base_price) || "0",
      kiwify_fee: safeString(commissionsData?.kiwify_fee) || "0",
    },
    Subscription: subscriptionData ? {
      id: safeString(subscriptionData.id) || safeString(parsedBody.subscription_id),
      start_date: safeString(subscriptionData.start_date) || safeString(parsedBody.created_at),
      next_payment: safeString(subscriptionData.next_payment),
      status: mapKiwifySubscriptionStatus(safeString(subscriptionData.status) || safeString(parsedBody.order_status)),
      plan: {
        id: safeString((subscriptionData.plan as Record<string, unknown>)?.id) || safeString(productData?.product_id),
        name: safeString((subscriptionData.plan as Record<string, unknown>)?.name) || safeString(productData?.product_name),
        frequency: safeString((subscriptionData.plan as Record<string, unknown>)?.frequency) || "monthly",
        qty_charges: Number((subscriptionData.plan as Record<string, unknown>)?.qty_charges || 12),
      },
      charges: {
        completed: Number((subscriptionData.charges as Record<string, unknown>)?.completed || 0),
        future: Number((subscriptionData.charges as Record<string, unknown>)?.future || 0),
      },
    } : undefined,
    subscription_id: parsedBody.subscription_id as string | undefined,
    created_at: safeString(parsedBody.created_at) || new Date().toISOString(),
    approved_date: parsedBody.approved_date as string | undefined,
    payment_method: parsedBody.payment_method as string | undefined,
  }

  try {
    const eventType = payload.webhook_event_type
    const orderStatus = payload.order_status

    console.log(`🔄 Processando evento: ${eventType}`)
    console.log(`   Order Status: ${orderStatus}`)

    // =====================================================
    // VERIFICAÇÕES DE SEGURANÇA - NÃO ATIVAR ASSINATURA
    // =====================================================

    // 0. COMPRA RECUSADA/REJEITADA
    if (eventType === KIWIFY_WEBHOOK_EVENTS.ORDER_REJECTED ||
        orderStatus === "refused" ||
        orderStatus === "expired") {
      console.log(`❌ Compra recusada/expirada: ${payload.Customer?.email}`)
      return NextResponse.json({ received: true, action: "rejected" })
    }

    // 0.1 AGUARDANDO PAGAMENTO
    if (orderStatus === "waiting_payment" || orderStatus === "in_analysis") {
      console.log(`⏳ Aguardando pagamento: ${payload.Customer?.email}`)
      return NextResponse.json({ received: true, action: "waiting_payment" })
    }

    // 1. CANCELAMENTO/ATRASADO
    if (eventType === KIWIFY_WEBHOOK_EVENTS.SUBSCRIPTION_CANCELED || 
        eventType === KIWIFY_WEBHOOK_EVENTS.SUBSCRIPTION_LATE ||
        isSubscriptionCancellation(payload)) {
      await handleSubscriptionCanceled(payload)
    }
    // 2. REEMBOLSO/CHARGEBACK
    else if (eventType === KIWIFY_WEBHOOK_EVENTS.ORDER_REFUNDED ||
             eventType === KIWIFY_WEBHOOK_EVENTS.CHARGEBACK ||
             isRefundOrChargeback(payload)) {
      await handleRefundOrChargeback(payload)
    }
    // 3. RENOVAÇÃO
    else if (eventType === KIWIFY_WEBHOOK_EVENTS.SUBSCRIPTION_RENEWED || isSubscriptionRenewal(payload)) {
      await handleSubscriptionRenewed(payload)
    }
    // 4. PEDIDO APROVADO (novo cliente ou nova assinatura)
    else if ((eventType === KIWIFY_WEBHOOK_EVENTS.ORDER_APPROVED || isOrderApproved(payload)) && orderStatus === "paid") {
      await handleOrderApproved(payload)
    }
    // 5. PIX/BOLETO GERADO
    else if (eventType === KIWIFY_WEBHOOK_EVENTS.PIX_CREATED || eventType === KIWIFY_WEBHOOK_EVENTS.BILLET_CREATED) {
      console.log(`⏳ PIX/Boleto gerado para: ${payload.Customer?.email}`)
    }
    // 6. EVENTO NÃO TRATADO
    else {
      console.log(`⚠️ Evento não tratado: ${eventType || orderStatus}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("❌ Erro ao processar webhook:", error)
    return NextResponse.json(
      { error: "Erro ao processar evento" },
      { status: 500 }
    )
  }
}

// ============================================
// HANDLERS DE EVENTOS ESPECÍFICOS
// ============================================

/**
 * Handler para pedido APROVADO
 *
 * Roteia o webhook para o handler específico do produto comprado:
 * - Manual do Clipador (compra única R$ 19,90)
 * - Clipfy League ULTRA (upgrade do PRO)
 * - Clipfy League PRO LEGADO (assinatura R$ 5 + R$ 29/mês — só recebemos
 *   eventos para clientes que já assinaram, novas vendas estão fechadas)
 * - Clipfy League PRO (PAGAMENTO ÚNICO de R$ 197 — produto vigente)
 *
 * Estratégia de roteamento (em ordem):
 * 1. Manual e ULTRA são identificados por nome/ID dedicado.
 * 2. Para o PRO, usamos a presença de `Subscription` no payload como
 *    SINAL DEFINITIVO:
 *      - Tem Subscription → é o produto LEGADO (assinatura)
 *      - Não tem Subscription → é o produto NOVO (pagamento único)
 *    Isso funciona mesmo se ambos os produtos tiverem o mesmo nome
 *    "Clipfy League PRO" na Kiwify.
 * 3. Os helpers `isClipfyProLifetime/Legacy...` ainda são usados como
 *    confirmação por product_id específico (UUID), garantindo que IDs
 *    explícitos têm precedência sobre a heurística de Subscription.
 */
async function handleOrderApproved(payload: KiwifyWebhookPayload) {
  const { Customer, order_status, product_id, product_name } = payload
  const hasSubscription = !!(payload.Subscription || payload.subscription_id)

  // Verificação de segurança
  if (order_status !== "paid") {
    console.log(`⛔ BLOQUEADO: Status não é "paid" (${order_status})`)
    return
  }

  console.log(`\n✅ Processando pedido aprovado`)
  console.log(`   Email: ${Customer.email}`)
  console.log(`   Nome: ${Customer.full_name}`)
  console.log(`   Produto: ${product_name} (${product_id})`)
  console.log(`   Tem Subscription? ${hasSubscription ? "sim (ASSINATURA)" : "não (PAGAMENTO ÚNICO)"}`)

  // 1. Manual do Clipador
  if (isClipperManualProduct(product_id, product_name)) {
    console.log(`📚 Compra do Manual do Clipador detectada`)
    await handleManualPurchase(payload)
    return
  }

  // 2. Clipfy League ULTRA
  if (isClipfyUltraProduct(product_id, product_name)) {
    console.log(`🚀 Compra/Upgrade para Clipfy League ULTRA detectada`)
    await handleUltraPurchase(payload)
    return
  }

  // 3. Identificação explícita pelo product_id NOVO (pagamento único)
  //    Tem precedência absoluta — se bateu o UUID, é o vitalício.
  if (isClipfyProLifetimeProduct(product_id, product_name) && !hasSubscription) {
    console.log(`💎 Compra do PRO (pagamento único, identificado por ID) detectada`)
    await handleProLifetimeApproved(payload)
    return
  }

  // 4. Identificação explícita pelo produto LEGADO (assinatura)
  if (isClipfyProLegacySubscriptionProduct(product_id, product_name)) {
    console.log(`🗂️ Compra do PRO LEGADO (identificado por ID) detectada — processando`)
    await handleProSubscriptionLegacyApproved(payload)
    return
  }

  // 5. HEURÍSTICA por presença de Subscription:
  //    Se o produto parece "Clipfy PRO" (nome bate parcialmente) e:
  //      - TEM Subscription → é o LEGADO (assinatura R$ 5 + R$ 29/mês)
  //      - NÃO tem Subscription → é o NOVO (pagamento único R$ 197)
  //
  //    Essa heurística garante que mesmo se ambos os produtos tiverem
  //    o nome idêntico "Clipfy League PRO" na Kiwify, o roteamento funciona.
  const looksLikePro =
    `${product_id} ${product_name}`.toLowerCase().includes("clipfy") &&
    `${product_id} ${product_name}`.toLowerCase().includes("pro")

  if (looksLikePro) {
    if (hasSubscription) {
      console.log(`🗂️ Compra do PRO LEGADO (heurística: tem Subscription) detectada`)
      await handleProSubscriptionLegacyApproved(payload)
      return
    } else {
      console.log(`💎 Compra do PRO (heurística: sem Subscription = pagamento único) detectada`)
      await handleProLifetimeApproved(payload)
      return
    }
  }

  // 6. Fallback de segurança: se chegou um produto desconhecido,
  //    NÃO criamos usuário automaticamente e logamos para revisão manual.
  console.warn(
    `⚠️ Produto desconhecido no webhook Kiwify — não foi possível classificar:`,
    { product_id, product_name, hasSubscription }
  )
}

/**
 * Handler para Clipfy League PRO — PAGAMENTO ÚNICO (R$ 197)
 *
 * Esta é a forma vigente de venda do PRO. Não há `subscriptionId`
 * (não é assinatura), apenas um `kiwifyOrderId` e o tier `PRO` ativo
 * de forma vitalícia.
 */
async function handleProLifetimeApproved(payload: KiwifyWebhookPayload) {
  const { Customer, order_id } = payload

  console.log(`\n💎 Processando compra do Clipfy PRO (pagamento único)`)
  console.log(`   Email: ${Customer.email}`)
  console.log(`   Nome: ${Customer.full_name}`)
  console.log(`   Order ID: ${order_id}`)

  const existingUser = await db.user.findFirst({
    where: { email: Customer.email },
  })

  if (existingUser) {
    // ========================================
    // USUÁRIO JÁ EXISTE — Ativar PRO vitalício
    // ========================================
    console.log(`👤 Usuário existente encontrado: ${existingUser.id}`)

    await db.user.update({
      where: { id: existingUser.id },
      data: {
        subscriptionStatus: "ACTIVE",
        subscriptionTier: "PRO",
        // Pagamento único: NÃO setamos kiwifySubscriptionId.
        // Mantemos o kiwifySubscriptionId existente (caso ele já tivesse a
        // assinatura legada e tenha agora migrado) para preservar o histórico.
        kiwifyOrderId: order_id,
        paymentPlatform: "kiwify",
        lastPurchaseDate: new Date(),
      },
    })

    console.log(`✅ PRO vitalício ativado para usuário existente: ${Customer.email}`)

    try {
      await sendPaymentConfirmationEmail({
        email: Customer.email,
        name: existingUser.name,
      })
    } catch (emailError) {
      console.error(`❌ Erro ao enviar email de confirmação:`, emailError)
    }
  } else {
    // ========================================
    // NOVO USUÁRIO — Criar conta com PRO vitalício
    // ========================================
    console.log(`🆕 Criando novo usuário (PRO vitalício): ${Customer.email}`)

    const password = generateRandomPassword()
    const clerk = await clerkClient()

    try {
      const clerkUser = await clerk.users.createUser({
        emailAddress: [Customer.email],
        password,
        firstName: Customer.full_name?.split(" ")[0] || undefined,
        lastName: Customer.full_name?.split(" ").slice(1).join(" ") || undefined,
        skipPasswordRequirement: false,
      })

      console.log(`✅ Usuário criado no Clerk: ${clerkUser.id}`)

      await db.user.create({
        data: {
          id: clerkUser.id,
          email: Customer.email,
          name: Customer.full_name || null,
          subscriptionStatus: "ACTIVE",
          subscriptionTier: "PRO",
          // Pagamento único: SEM kiwifySubscriptionId
          kiwifyOrderId: order_id,
          paymentPlatform: "kiwify",
          lastPurchaseDate: new Date(),
          role: "CLIPPER",
          referralSlug: "clipfy-pro", // Origem: compra do Clipfy League PRO (lifetime)
        },
      })

      console.log(`✅ Usuário criado no banco com PRO vitalício: ${Customer.email}`)
      console.log(`   ID: ${clerkUser.id}`)
      console.log(`   Tier: PRO`)
      console.log(`   Status: ACTIVE (vitalício)`)

      try {
        await sendWelcomeProEmail({
          email: Customer.email,
          name: Customer.full_name,
          password,
        })
      } catch (emailError) {
        console.error(`❌ Erro ao enviar email de boas-vindas:`, emailError)
      }
    } catch (error) {
      console.error("❌ Erro ao criar usuário no Clerk:", error)
      throw error
    }
  }
}

/**
 * Handler para Clipfy League PRO — ASSINATURA LEGADA (R$ 5 + R$ 29/mês)
 *
 * Produto descontinuado para novas vendas. Se chegar um `order_approved`
 * desse produto, é (a) primeiro pagamento de um cliente que já tinha
 * iniciado a assinatura antes da migração, ou (b) reativação manual.
 *
 * Mantém compatibilidade total: setamos `kiwifySubscriptionId` para que
 * as renovações futuras (`subscription_renewed`) continuem funcionando.
 */
async function handleProSubscriptionLegacyApproved(payload: KiwifyWebhookPayload) {
  const { Customer, order_id } = payload
  const subscriptionId = payload.Subscription?.id || payload.subscription_id || null

  console.log(`\n🗂️ Processando ativação do PRO LEGADO (assinatura)`)
  console.log(`   Email: ${Customer.email}`)
  console.log(`   Nome: ${Customer.full_name}`)
  console.log(`   Subscription ID: ${subscriptionId}`)

  const existingUser = await db.user.findFirst({
    where: { email: Customer.email },
  })

  if (existingUser) {
    console.log(`👤 Usuário existente encontrado: ${existingUser.id}`)

    await db.user.update({
      where: { id: existingUser.id },
      data: {
        subscriptionStatus: "ACTIVE",
        subscriptionTier: "PRO",
        kiwifySubscriptionId: subscriptionId,
        kiwifyOrderId: order_id,
        paymentPlatform: "kiwify",
        lastPurchaseDate: new Date(),
      },
    })

    console.log(`✅ PRO LEGADO (assinatura) ativado: ${Customer.email}`)

    try {
      await sendPaymentConfirmationEmail({
        email: Customer.email,
        name: existingUser.name,
      })
    } catch (emailError) {
      console.error(`❌ Erro ao enviar email de confirmação:`, emailError)
    }
  } else {
    // Cliente novo no nosso banco mas com a assinatura legada — caminho raro,
    // mas precisamos cobrir (ex.: cliente comprou antes do match no Clerk).
    console.log(`🆕 Criando novo usuário (PRO LEGADO assinatura): ${Customer.email}`)

    const password = generateRandomPassword()
    const clerk = await clerkClient()

    try {
      const clerkUser = await clerk.users.createUser({
        emailAddress: [Customer.email],
        password,
        firstName: Customer.full_name?.split(" ")[0] || undefined,
        lastName: Customer.full_name?.split(" ").slice(1).join(" ") || undefined,
        skipPasswordRequirement: false,
      })

      console.log(`✅ Usuário criado no Clerk: ${clerkUser.id}`)

      await db.user.create({
        data: {
          id: clerkUser.id,
          email: Customer.email,
          name: Customer.full_name || null,
          subscriptionStatus: "ACTIVE",
          subscriptionTier: "PRO",
          kiwifySubscriptionId: subscriptionId,
          kiwifyOrderId: order_id,
          paymentPlatform: "kiwify",
          lastPurchaseDate: new Date(),
          role: "CLIPPER",
          referralSlug: "clipfy-pro-legacy", // Origem: assinatura legada
        },
      })

      console.log(`✅ Usuário criado com PRO LEGADO (assinatura): ${Customer.email}`)

      try {
        await sendWelcomeProEmail({
          email: Customer.email,
          name: Customer.full_name,
          password,
        })
      } catch (emailError) {
        console.error(`❌ Erro ao enviar email de boas-vindas:`, emailError)
      }
    } catch (error) {
      console.error("❌ Erro ao criar usuário no Clerk:", error)
      throw error
    }
  }
}

/**
 * Handler para compra do MANUAL DO CLIPADOR (produto único)
 * Libera acesso ao manual para usuário existente ou cria novo usuário
 */
async function handleManualPurchase(payload: KiwifyWebhookPayload) {
  const { Customer, order_id } = payload

  console.log(`\n📚 Processando compra do Manual do Clipador`)
  console.log(`   Email: ${Customer.email}`)
  console.log(`   Nome: ${Customer.full_name}`)

  // Verificar se usuário já existe no banco
  const existingUser = await db.user.findFirst({
    where: { email: Customer.email },
  })

  if (existingUser) {
    // ========================================
    // USUÁRIO JÁ EXISTE - Apenas liberar acesso ao Manual
    // ========================================
    console.log(`👤 Usuário existente encontrado: ${existingUser.id}`)

    await db.user.update({
      where: { id: existingUser.id },
      data: {
        hasClipperManual: true,
        clipperManualPurchaseDate: new Date(),
      },
    })

    console.log(`✅ Acesso ao Manual do Clipador liberado para: ${Customer.email}`)

    // Enviar email de confirmação de compra do Manual
    try {
      await sendManualPurchaseConfirmationEmail({
        email: Customer.email,
        name: existingUser.name,
      })
    } catch (emailError) {
      console.error(`❌ Erro ao enviar email de confirmação do Manual:`, emailError)
    }
  } else {
    // ========================================
    // NOVO USUÁRIO - Criar conta e liberar acesso ao Manual
    // ========================================
    console.log(`🆕 Criando novo usuário para acesso ao Manual: ${Customer.email}`)

    const password = generateRandomPassword()
    const clerk = await clerkClient()

    try {
      // Criar usuário no Clerk
      const clerkUser = await clerk.users.createUser({
        emailAddress: [Customer.email],
        password,
        firstName: Customer.full_name?.split(' ')[0] || undefined,
        lastName: Customer.full_name?.split(' ').slice(1).join(' ') || undefined,
        skipPasswordRequirement: false,
      })

      console.log(`✅ Usuário criado no Clerk: ${clerkUser.id}`)

      // Criar usuário no banco com acesso ao Manual (sem assinatura PRO)
      await db.user.create({
        data: {
          id: clerkUser.id,
          email: Customer.email,
          name: Customer.full_name || null,
          subscriptionStatus: "NONE", // Não tem assinatura PRO, apenas o Manual
          hasClipperManual: true,
          clipperManualPurchaseDate: new Date(),
          role: "CLIPPER",
          referralSlug: "clipfy-manual", // Origem: compra do Manual do Clipador
        },
      })

      console.log(`✅ Usuário criado com acesso ao Manual: ${Customer.email}`)
      console.log(`   ID: ${clerkUser.id}`)
      console.log(`   Manual: LIBERADO`)

      // Enviar email de confirmação de compra do Manual
      try {
        await sendManualPurchaseConfirmationEmail({
          email: Customer.email,
          name: Customer.full_name,
        })
      } catch (emailError) {
        console.error(`❌ Erro ao enviar email de confirmação do Manual:`, emailError)
      }
    } catch (error) {
      console.error("❌ Erro ao criar usuário no Clerk:", error)
      throw error
    }
  }
}

/**
 * Handler para compra/upgrade para CLIPFY LEAGUE ULTRA
 * Ativa o tier ULTRA para usuário PRO existente ou cria novo usuário com ULTRA
 */
async function handleUltraPurchase(payload: KiwifyWebhookPayload) {
  const { Customer, order_id } = payload
  const subscriptionId = payload.Subscription?.id || payload.subscription_id || null

  console.log(`\n🚀 Processando upgrade para Clipfy League ULTRA`)
  console.log(`   Email: ${Customer.email}`)
  console.log(`   Nome: ${Customer.full_name}`)

  // Verificar se usuário já existe no banco
  const existingUser = await db.user.findFirst({
    where: { email: Customer.email },
  })

  if (existingUser) {
    // ========================================
    // USUÁRIO JÁ EXISTE - Upgrade para ULTRA
    // ========================================
    console.log(`👤 Usuário existente encontrado: ${existingUser.id}`)

    // Verificar se o usuário já tem PRO ativo (requisito para ULTRA)
    if (existingUser.subscriptionStatus !== "ACTIVE") {
      console.warn(`⚠️ Usuário não tem assinatura PRO ativa, mas está comprando ULTRA`)
      // Mesmo assim, vamos ativar o ULTRA (pode ser uma promoção especial)
    }

    await db.user.update({
      where: { id: existingUser.id },
      data: {
        subscriptionStatus: "ACTIVE",
        subscriptionTier: "ULTRA", // Upgrade para ULTRA
        ultraSubscriptionId: subscriptionId,
        ultraOrderId: order_id,
        ultraSubscriptionDate: new Date(),
        paymentPlatform: "kiwify",
        lastPurchaseDate: new Date(),
      },
    })

    console.log(`✅ Upgrade para ULTRA concluído: ${Customer.email}`)

    // Enviar email de parabéns ULTRA
    try {
      await sendUltraPurchaseConfirmationEmail({
        email: Customer.email,
        name: existingUser.name,
      })
    } catch (emailError) {
      console.error(`❌ Erro ao enviar email de parabéns ULTRA:`, emailError)
    }
  } else {
    // ========================================
    // NOVO USUÁRIO - Criar conta com ULTRA (inclui PRO implicitamente)
    // ========================================
    console.log(`🆕 Criando novo usuário com ULTRA: ${Customer.email}`)

    const password = generateRandomPassword()
    const clerk = await clerkClient()

    try {
      // Criar usuário no Clerk
      const clerkUser = await clerk.users.createUser({
        emailAddress: [Customer.email],
        password,
        firstName: Customer.full_name?.split(' ')[0] || undefined,
        lastName: Customer.full_name?.split(' ').slice(1).join(' ') || undefined,
        skipPasswordRequirement: false,
      })

      console.log(`✅ Usuário criado no Clerk: ${clerkUser.id}`)

      // Criar usuário no banco com ULTRA ativo
      await db.user.create({
        data: {
          id: clerkUser.id,
          email: Customer.email,
          name: Customer.full_name || null,
          subscriptionStatus: "ACTIVE",
          subscriptionTier: "ULTRA", // Direto para ULTRA
          ultraSubscriptionId: subscriptionId,
          ultraOrderId: order_id,
          ultraSubscriptionDate: new Date(),
          paymentPlatform: "kiwify",
          lastPurchaseDate: new Date(),
          role: "CLIPPER",
          referralSlug: "clipfy-ultra", // Origem: compra do Clipfy League ULTRA
        },
      })

      console.log(`✅ Usuário criado com ULTRA: ${Customer.email}`)
      console.log(`   ID: ${clerkUser.id}`)
      console.log(`   Tier: ULTRA`)

      // Enviar email de parabéns ULTRA
      try {
        await sendUltraPurchaseConfirmationEmail({
          email: Customer.email,
          name: Customer.full_name,
        })
      } catch (emailError) {
        console.error(`❌ Erro ao enviar email de parabéns ULTRA:`, emailError)
      }
    } catch (error) {
      console.error("❌ Erro ao criar usuário no Clerk:", error)
      throw error
    }
  }
}

/**
 * Handler para RENOVAÇÃO de assinatura
 *
 * Aplica-se essencialmente ao PRO LEGADO (assinatura R$ 5 + R$ 29/mês),
 * já que o produto vigente (PRO vitalício) não gera renovações.
 * Mantém o usuário ativo como PRO e atualiza a data da última compra.
 */
async function handleSubscriptionRenewed(payload: KiwifyWebhookPayload) {
  const { Customer, order_id, product_id, product_name } = payload

  console.log(`\n🔄 Renovação de assinatura`)
  console.log(`   Email: ${Customer.email}`)
  console.log(`   Produto: ${product_name} (${product_id})`)

  const user = await db.user.findFirst({
    where: { email: Customer.email },
  })

  if (!user) {
    console.error(`❌ Usuário não encontrado para renovação: ${Customer.email}`)
    return
  }

  // Renovação do ULTRA — apenas atualizar datas, manter tier ULTRA
  if (isClipfyUltraProduct(product_id, product_name)) {
    await db.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: "ACTIVE",
        lastPurchaseDate: new Date(),
        ultraOrderId: order_id,
      },
    })
    console.log(`✅ Assinatura ULTRA renovada: ${Customer.email}`)
    return
  }

  // Renovação do PRO LEGADO (assinatura R$ 5 + R$ 29/mês)
  // Mantém o usuário com tier PRO ativo. Se já estava como ULTRA,
  // não rebaixamos — só refrescamos lastPurchaseDate.
  await db.user.update({
    where: { id: user.id },
    data: {
      subscriptionStatus: "ACTIVE",
      // Só promove para PRO se não estiver ULTRA (não rebaixa).
      ...(user.subscriptionTier === "ULTRA" ? {} : { subscriptionTier: "PRO" }),
      lastPurchaseDate: new Date(),
      kiwifyOrderId: order_id,
    },
  })

  console.log(`✅ Assinatura PRO LEGADO renovada: ${Customer.email}`)
}

/**
 * Handler para CANCELAMENTO de assinatura
 *
 * Distingue entre cancelamento do ULTRA, do PRO LEGADO (assinatura) e
 * eventuais cancelamentos relacionados ao produto vigente. Como o PRO
 * vitalício NÃO é assinatura, a Kiwify não deveria emitir
 * `subscription_canceled` para ele — mas, por garantia, se o usuário
 * tem `subscriptionTier = PRO` e NÃO existe `kiwifySubscriptionId` ativo,
 * tratamos como PRO vitalício e NÃO derrubamos o acesso.
 */
async function handleSubscriptionCanceled(payload: KiwifyWebhookPayload) {
  const { Customer, product_id, product_name } = payload

  console.log(`\n❌ Cancelamento de assinatura`)
  console.log(`   Email: ${Customer.email}`)
  console.log(`   Produto: ${product_name} (${product_id})`)

  const user = await db.user.findFirst({
    where: { email: Customer.email },
  })

  if (!user) {
    console.error(`❌ Usuário não encontrado: ${Customer.email}`)
    return
  }

  // 1. Cancelamento do ULTRA
  if (isClipfyUltraProduct(product_id, product_name) && user.subscriptionTier === "ULTRA") {
    console.log(`🔄 Cancelamento do ULTRA detectado`)

    // Se ainda tem PRO (assinatura legada OU PRO vitalício via kiwifyOrderId), faz downgrade
    const stillHasPro = !!user.kiwifySubscriptionId || !!user.kiwifyOrderId

    if (stillHasPro) {
      await db.user.update({
        where: { id: user.id },
        data: {
          subscriptionTier: "PRO",
          ultraSubscriptionId: null,
          ultraOrderId: null,
        },
      })
      console.log(`🔄 Downgrade para PRO: ${Customer.email}`)
    } else {
      await db.user.update({
        where: { id: user.id },
        data: {
          subscriptionStatus: "CANCELLED",
          subscriptionTier: "NONE",
          kiwifySubscriptionId: null,
          ultraSubscriptionId: null,
          ultraOrderId: null,
        },
      })
      console.log(`❌ Assinatura totalmente cancelada: ${Customer.email}`)
    }

    try {
      await sendSubscriptionCanceledEmail({
        email: Customer.email,
        name: user.name,
      })
    } catch (emailError) {
      console.error(`❌ Erro ao enviar email de cancelamento:`, emailError)
    }
    return
  }

  // 2. Tentativa de cancelamento do PRO VITALÍCIO (não deveria acontecer):
  //    Se o produto bate como PRO vitalício, ignoramos para não derrubar o
  //    acesso de quem pagou para sempre.
  if (isClipfyProLifetimeProduct(product_id, product_name)) {
    console.warn(
      `⚠️ Webhook de "subscription_canceled" para PRO vitalício recebido — IGNORADO. ` +
        `O PRO vitalício não é assinatura. Email: ${Customer.email}`
    )
    return
  }

  // 3. Cancelamento do PRO LEGADO (assinatura R$ 5 + R$ 29/mês)
  //
  // ATENÇÃO: se o usuário ALÉM da assinatura legada também comprou o PRO
  // vitalício (kiwifyOrderId apontando para o produto novo), NÃO podemos
  // tirar o tier PRO dele. Aqui, a heurística é: só rebaixamos para NONE
  // se o usuário NÃO tinha pagamento único registrado posteriormente.
  //
  // Como o `kiwifyOrderId` pode ter sido sobrescrito pelo lifetime, usamos
  // a presença de `kiwifySubscriptionId` (assinatura) como sinal exclusivo
  // do legado: se for ela quem está sendo cancelada, derrubamos a assinatura
  // mas mantemos o usuário ativo se houver indício de PRO vitalício.
  const isLegacyCancel = isClipfyProLegacySubscriptionProduct(product_id, product_name) ||
    !isClipfyProLifetimeProduct(product_id, product_name) // fallback

  if (isLegacyCancel) {
    console.log(`📜 Cancelamento da assinatura PRO LEGADA detectado`)

    // Se o usuário tem PRO vitalício, apenas remove a referência de assinatura
    // mas mantém o tier PRO ativo.
    // Heurística: se `kiwifyOrderId` foi gravado por uma compra do produto
    // vitalício após a assinatura legada, mantemos o acesso. Como não temos
    // como diferenciar 100% sem outro campo, optamos por:
    //  - Se `paymentPlatform === "kiwify"` e `kiwifyOrderId` existe E
    //    `lastPurchaseDate` > data da subscription, é provável vitalício →
    //    mantemos. Caso contrário, cancelamos como antes.
    //
    // Para máxima segurança nesta fase de transição, vamos APENAS limpar
    // a assinatura e manter o tier PRO se o usuário tiver `kiwifyOrderId`
    // gravado (ele pagou alguma coisa pela última vez via Kiwify).
    const keepProActive = !!user.kiwifyOrderId

    await db.user.update({
      where: { id: user.id },
      data: {
        // Limpa a assinatura legada
        kiwifySubscriptionId: null,
        // Se o usuário possivelmente tem PRO vitalício, mantém ativo;
        // caso contrário, cancela o acesso.
        ...(keepProActive
          ? {}
          : {
              subscriptionStatus: "CANCELLED",
              subscriptionTier: "NONE",
              ultraSubscriptionId: null,
              ultraOrderId: null,
            }),
      },
    })

    if (keepProActive) {
      console.log(
        `✅ Assinatura PRO LEGADA cancelada, mas usuário mantém acesso (possível PRO vitalício): ${Customer.email}`
      )
    } else {
      console.log(`❌ Assinatura PRO LEGADA cancelada e acesso removido: ${Customer.email}`)
    }

    try {
      await sendSubscriptionCanceledEmail({
        email: Customer.email,
        name: user.name,
      })
    } catch (emailError) {
      console.error(`❌ Erro ao enviar email de cancelamento:`, emailError)
    }
    return
  }
}

/**
 * Handler para REEMBOLSO ou CHARGEBACK
 *
 * Em reembolso/chargeback do PRO vitalício devolvemos completamente o
 * acesso. Para PRO legado, o comportamento é o mesmo do cancelamento.
 */
async function handleRefundOrChargeback(payload: KiwifyWebhookPayload) {
  const { Customer, product_id, product_name } = payload

  console.log(`\n💸 Reembolso/Chargeback detectado`)
  console.log(`   Email: ${Customer.email}`)
  console.log(`   Status: ${payload.order_status}`)
  console.log(`   Produto: ${product_name} (${product_id})`)

  const user = await db.user.findFirst({
    where: { email: Customer.email },
  })

  if (!user) {
    console.error(`❌ Usuário não encontrado: ${Customer.email}`)
    return
  }

  // 1. Reembolso do ULTRA
  if (isClipfyUltraProduct(product_id, product_name) && user.subscriptionTier === "ULTRA") {
    const stillHasPro = !!user.kiwifySubscriptionId || !!user.kiwifyOrderId

    if (stillHasPro) {
      await db.user.update({
        where: { id: user.id },
        data: {
          subscriptionTier: "PRO",
          ultraSubscriptionId: null,
          ultraOrderId: null,
        },
      })
      console.log(`💸 Reembolso ULTRA - Downgrade para PRO: ${Customer.email}`)
    } else {
      await db.user.update({
        where: { id: user.id },
        data: {
          subscriptionStatus: "CANCELLED",
          subscriptionTier: "NONE",
          kiwifySubscriptionId: null,
          ultraSubscriptionId: null,
          ultraOrderId: null,
        },
      })
      console.log(`💸 Reembolso ULTRA - Cancelado totalmente: ${Customer.email}`)
    }
    return
  }

  // 2. Reembolso do PRO VITALÍCIO (pagamento único)
  if (isClipfyProLifetimeProduct(product_id, product_name)) {
    await db.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: "CANCELLED",
        subscriptionTier: "NONE",
        kiwifyOrderId: null,
        ultraSubscriptionId: null,
        ultraOrderId: null,
      },
    })
    console.log(`💸 Reembolso PRO VITALÍCIO - Acesso removido: ${Customer.email}`)
    return
  }

  // 3. Reembolso do PRO LEGADO (ou fallback genérico)
  await db.user.update({
    where: { id: user.id },
    data: {
      subscriptionStatus: "CANCELLED",
      subscriptionTier: "NONE",
      kiwifySubscriptionId: null,
      ultraSubscriptionId: null,
      ultraOrderId: null,
    },
  })

  console.log(`💸 Reembolso/Chargeback processado: ${Customer.email}`)
}
