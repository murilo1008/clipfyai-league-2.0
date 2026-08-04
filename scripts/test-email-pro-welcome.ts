import { Resend } from "resend";
import * as dotenv from "dotenv";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

// ============================================
// Template de boas-vindas PRO (cópia exata do src/lib/emails/clipfy-pro.ts)
// ============================================
function getWelcomeProEmailTemplate(name: string, email: string, password: string): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bem-vindo ao Clipfy League PRO!</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a; color: #ffffff;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 40px;">
            <img src="https://league.clipfyai.com/images/logo-clipfy-white.svg" alt="Clipfy League" style="width: 180px; height: auto;" />
            <div style="display: inline-block; background: linear-gradient(90deg, #f59e0b, #ea580c); color: #000; font-size: 12px; font-weight: bold; padding: 4px 12px; border-radius: 20px; margin-top: 10px;">
              👑 PRO
            </div>
          </div>
          
          <!-- Main Content -->
          <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 20px; padding: 40px; border: 1px solid rgba(255,255,255,0.1);">
            <h1 style="margin: 0 0 20px 0; font-size: 28px; background: linear-gradient(90deg, #00d4aa, #00f5c4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
              🎉 Bem-vindo ao Clipfy League PRO!
            </h1>
            
            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #a0a0a0;">
              Olá, <strong style="color: #ffffff;">${name || "Clipador"}</strong>!
            </p>
            
            <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #a0a0a0;">
              Seu acesso vitalício ao <strong style="color: #00d4aa;">Clipfy League PRO</strong> foi ativado com sucesso!
              Você agora tem acesso para sempre a todos os benefícios exclusivos da nossa plataforma — sem mensalidade,
              sem renovação.
            </p>
            
            <!-- Credentials Box -->
            <div style="background: rgba(0,212,170,0.1); border: 1px solid rgba(0,212,170,0.3); border-radius: 12px; padding: 24px; margin-bottom: 30px;">
              <h3 style="margin: 0 0 16px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #00d4aa;">
                🔐 Seus dados de acesso
              </h3>
              <div style="margin-bottom: 12px;">
                <span style="color: #a0a0a0; font-size: 14px;">E-mail:</span>
                <div style="font-size: 16px; font-weight: bold; color: #ffffff;">${email}</div>
              </div>
              <div>
                <span style="color: #a0a0a0; font-size: 14px;">Senha temporária:</span>
                <div style="font-size: 18px; font-weight: bold; font-family: monospace; background: rgba(255,255,255,0.1); padding: 8px 12px; border-radius: 6px; color: #00d4aa; display: inline-block; margin-top: 4px;">
                  ${password}
                </div>
              </div>
              <p style="margin: 16px 0 0 0; font-size: 12px; color: #f59e0b;">
                ⚠️ Recomendamos trocar sua senha após o primeiro acesso.
              </p>
            </div>
            
            <!-- Benefits -->
            <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #ffffff;">
              ✨ O que você pode fazer agora:
            </h3>
            <ul style="margin: 0 0 30px 0; padding: 0; list-style: none;">
              <li style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1); color: #a0a0a0;">
                <span style="color: #00d4aa; margin-right: 8px;">🎓</span>
                <strong style="color: #ffffff;">Academia Clipadora</strong> - Acesso a todos os módulos e aulas
              </li>
              <li style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1); color: #a0a0a0;">
                <span style="color: #00d4aa; margin-right: 8px;">👥</span>
                <strong style="color: #ffffff;">Comunidade Exclusiva</strong> - Networking com clipadores profissionais
              </li>
              <li style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1); color: #a0a0a0;">
                <span style="color: #00d4aa; margin-right: 8px;">🏆</span>
                <strong style="color: #ffffff;">Cargo VIP no Discord</strong> - Reconhecimento na comunidade
              </li>
              <li style="padding: 10px 0; color: #a0a0a0;">
                <span style="color: #00d4aa; margin-right: 8px;">💼</span>
                <strong style="color: #ffffff;">Portfólio Profissional</strong> - Visibilidade para empresas
              </li>
            </ul>
            
            <!-- CTA Button -->
            <div style="text-align: center;">
              <a href="https://league.clipfyai.com/classes" style="display: inline-block; background: linear-gradient(90deg, #00d4aa, #00f5c4); color: #000000; font-size: 16px; font-weight: bold; padding: 16px 40px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 20px rgba(0,212,170,0.3);">
                Acessar a Plataforma →
              </a>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; margin-top: 40px; color: #666666; font-size: 12px;">
            <p style="margin: 0 0 10px 0;">
              Dúvidas? Responda este e-mail ou entre em contato conosco.
            </p>
            <p style="margin: 0;">
              © ${new Date().getFullYear()} Clipfy League. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

// ============================================
// Template de confirmação de pagamento PRO (cópia exata)
// ============================================
function getPaymentConfirmationEmailTemplate(name: string, email: string): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Acesso PRO Vitalício Ativado!</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a; color: #ffffff;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 40px;">
            <img src="https://league.clipfyai.com/images/logo-clipfy-white.svg" alt="Clipfy League" style="width: 180px; height: auto;" />
            <div style="display: inline-block; background: linear-gradient(90deg, #f59e0b, #ea580c); color: #000; font-size: 12px; font-weight: bold; padding: 4px 12px; border-radius: 20px; margin-top: 10px;">
              👑 PRO
            </div>
          </div>
          
          <!-- Main Content -->
          <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 20px; padding: 40px; border: 1px solid rgba(255,255,255,0.1);">
            <h1 style="margin: 0 0 20px 0; font-size: 28px; background: linear-gradient(90deg, #00d4aa, #00f5c4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
              🚀 Seu acesso vitalício PRO foi ativado!
            </h1>
            
            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #a0a0a0;">
              Olá, <strong style="color: #ffffff;">${name || "Clipador"}</strong>!
            </p>
            
            <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #a0a0a0;">
              Seu pagamento foi confirmado e seu acesso vitalício ao <strong style="color: #00d4aa;">Clipfy League PRO</strong>
              já está ativo! Agora você tem acesso completo, para sempre, a todos os benefícios exclusivos —
              sem mensalidade, sem renovação.
            </p>
            
            <!-- Status Box -->
            <div style="background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: 12px; padding: 20px; margin-bottom: 30px; text-align: center;">
              <div style="font-size: 40px; margin-bottom: 10px;">✅</div>
              <div style="font-size: 18px; font-weight: bold; color: #22c55e;">Acesso Vitalício Ativo</div>
              <div style="font-size: 14px; color: #a0a0a0; margin-top: 8px;">
                E-mail: <strong style="color: #ffffff;">${email}</strong>
              </div>
            </div>
            
            <!-- Benefits Unlocked -->
            <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #ffffff;">
              🔓 Benefícios desbloqueados:
            </h3>
            <div style="display: grid; gap: 12px; margin-bottom: 30px;">
              <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 16px; display: flex; align-items: center;">
                <span style="font-size: 24px; margin-right: 12px;">🎓</span>
                <div>
                  <div style="font-weight: bold; color: #ffffff;">Academia Clipadora</div>
                  <div style="font-size: 13px; color: #a0a0a0;">Acesso liberado a todos os módulos</div>
                </div>
              </div>
              <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 16px; display: flex; align-items: center;">
                <span style="font-size: 24px; margin-right: 12px;">👥</span>
                <div>
                  <div style="font-weight: bold; color: #ffffff;">Comunidade Exclusiva</div>
                  <div style="font-size: 13px; color: #a0a0a0;">Acesso ao grupo de clipadores PRO</div>
                </div>
              </div>
              <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 16px; display: flex; align-items: center;">
                <span style="font-size: 24px; margin-right: 12px;">🏆</span>
                <div>
                  <div style="font-weight: bold; color: #ffffff;">Cargo VIP no Discord</div>
                  <div style="font-size: 13px; color: #a0a0a0;">Seu cargo exclusivo será aplicado em breve</div>
                </div>
              </div>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center;">
              <a href="https://league.clipfyai.com/classes" style="display: inline-block; background: linear-gradient(90deg, #00d4aa, #00f5c4); color: #000000; font-size: 16px; font-weight: bold; padding: 16px 40px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 20px rgba(0,212,170,0.3);">
                Acessar Academia Clipadora →
              </a>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; margin-top: 40px; color: #666666; font-size: 12px;">
            <p style="margin: 0 0 10px 0;">
              Obrigado por fazer parte do Clipfy League PRO! 🎉
            </p>
            <p style="margin: 0;">
              © ${new Date().getFullYear()} Clipfy League. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

// ============================================
// Template de cancelamento (cópia exata do src/lib/emails/clipfy-pro.ts)
// PRO agora é PAGAMENTO ÚNICO de R$ 197 (até 12x).
// ============================================
function getSubscriptionCanceledEmailTemplate(name: string, email: string): string {
  // Mantemos os valores em sincronia manual com `CLIPFY_PRO_PRODUCT`
  // (este script é independente dos imports do app principal).
  const PRO_PRICE = 197
  const PRO_INSTALLMENT = 20.37
  const PRO_MAX_INSTALLMENTS = 12
  const PRO_CHECKOUT_URL = "https://pay.kiwify.com.br/f2GUPz4"
  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Acesso PRO encerrado</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a; color: #ffffff;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 40px;">
            <img src="https://league.clipfyai.com/images/logo-clipfy-white.svg" alt="Clipfy League" style="width: 180px; height: auto;" />
          </div>
          
          <!-- Main Content -->
          <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 20px; padding: 40px; border: 1px solid rgba(255,255,255,0.1);">
            <h1 style="margin: 0 0 20px 0; font-size: 24px; color: #ffffff;">
              Seu acesso PRO foi encerrado
            </h1>
            
            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #a0a0a0;">
              Olá, <strong style="color: #ffffff;">${name || "Clipador"}</strong>!
            </p>
            
            <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #a0a0a0;">
              Confirmamos o encerramento do seu acesso ao <strong style="color: #f59e0b;">Clipfy League PRO</strong>.
              Sentiremos sua falta! 😢
            </p>
            
            <!-- Info Box -->
            <div style="background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); border-radius: 12px; padding: 20px; margin-bottom: 30px;">
              <p style="margin: 0; font-size: 14px; color: #a0a0a0;">
                <strong style="color: #f59e0b;">📌 Boa notícia:</strong> agora o Clipfy League PRO é
                <strong style="color: #ffffff;">pagamento único de R$ ${fmt(PRO_PRICE)}</strong>
                (em até ${PRO_MAX_INSTALLMENTS}x de R$ ${fmt(PRO_INSTALLMENT)} no cartão) —
                <strong style="color: #ffffff;">acesso vitalício</strong>, sem mensalidade e sem renovação.
              </p>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center;">
              <a href="${PRO_CHECKOUT_URL}?email=${encodeURIComponent(email)}" style="display: inline-block; background: linear-gradient(90deg, #f59e0b, #ea580c); color: #000000; font-size: 16px; font-weight: bold; padding: 16px 40px; border-radius: 12px; text-decoration: none;">
                Garantir acesso vitalício →
              </a>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; margin-top: 40px; color: #666666; font-size: 12px;">
            <p style="margin: 0;">
              © ${new Date().getFullYear()} Clipfy League. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

// ============================================
// ENVIO DOS TESTES
// ============================================

const TEST_EMAIL = "murilo.rocha.mattoso@gmail.com";
const TEST_NAME = "Murilo Rocha";
const TEST_PASSWORD = "Abc@12345Xyz";

async function main() {
  console.log("=" .repeat(60));
  console.log("📧 TESTE DE EMAILS - CLIPFY LEAGUE PRO");
  console.log("=" .repeat(60));
  console.log(`📬 Enviando para: ${TEST_EMAIL}`);
  console.log(`👤 Nome teste: ${TEST_NAME}\n`);

  // ---- Email 1: Boas-vindas PRO (novo usuário com senha) ----
  try {
    console.log("1️⃣  Enviando: Email de Boas-Vindas PRO (novo usuário)...");
    const result1 = await resend.emails.send({
      from: "Clipfy League <noreply@league.clipfyai.com>",
      to: TEST_EMAIL,
      subject: "🧪 [TESTE] 🎉 Bem-vindo ao Clipfy League PRO!",
      html: getWelcomeProEmailTemplate(TEST_NAME, TEST_EMAIL, TEST_PASSWORD),
    });
    console.log(`   ✅ Enviado! ID: ${result1.data?.id}`);
  } catch (error: any) {
    console.error(`   ❌ Erro:`, error.message);
  }

  // Aguardar 1 segundo entre envios
  await new Promise((r) => setTimeout(r, 1000));

  // ---- Email 2: Confirmação de pagamento PRO (usuário existente) ----
  try {
    console.log("2️⃣  Enviando: Email de Confirmação de Pagamento PRO (usuário existente)...");
    const result2 = await resend.emails.send({
      from: "Clipfy League <noreply@league.clipfyai.com>",
      to: TEST_EMAIL,
      subject: "🧪 [TESTE] 🚀 Seu acesso vitalício ao Clipfy League PRO foi ativado!",
      html: getPaymentConfirmationEmailTemplate(TEST_NAME, TEST_EMAIL),
    });
    console.log(`   ✅ Enviado! ID: ${result2.data?.id}`);
  } catch (error: any) {
    console.error(`   ❌ Erro:`, error.message);
  }

  // Aguardar 1 segundo entre envios
  await new Promise((r) => setTimeout(r, 1000));

  // ---- Email 3: Cancelamento de assinatura ----
  try {
    console.log("3️⃣  Enviando: Email de Cancelamento de Assinatura PRO...");
    const result3 = await resend.emails.send({
      from: "Clipfy League <noreply@league.clipfyai.com>",
      to: TEST_EMAIL,
      subject: "🧪 [TESTE] Seu acesso ao Clipfy League PRO foi encerrado",
      html: getSubscriptionCanceledEmailTemplate(TEST_NAME, TEST_EMAIL),
    });
    console.log(`   ✅ Enviado! ID: ${result3.data?.id}`);
  } catch (error: any) {
    console.error(`   ❌ Erro:`, error.message);
  }

  console.log("\n" + "=" .repeat(60));
  console.log("✅ TODOS OS EMAILS PRO ENVIADOS!");
  console.log("=" .repeat(60));
  console.log("\n📩 Verifique sua caixa de entrada em murilo.rocha.mattoso@gmail.com");
  console.log("   Os 3 emails enviados são:");
  console.log("   1. 🎉 Boas-vindas PRO (novo usuário com senha)");
  console.log("   2. 🚀 Confirmação de pagamento PRO (usuário existente)");
  console.log("   3. ❌ Cancelamento de assinatura PRO");
}

main();

