import { Resend } from "resend";
import * as dotenv from "dotenv";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

// ============================================
// Template de parabéns Manual do Clipador (cópia exata do src/lib/emails/clipfy-manual.ts)
// ============================================
function getManualPurchaseConfirmationEmailTemplate(name: string, email: string): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Manual do Clipador Adquirido!</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a; color: #ffffff;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 40px;">
            <img src="https://league.clipfyai.com/images/logo-clipfy-white.svg" alt="Clipfy League" style="width: 180px; height: auto;" />
            <div style="display: inline-block; background: linear-gradient(90deg, #10b981, #059669); color: #fff; font-size: 12px; font-weight: bold; padding: 4px 12px; border-radius: 20px; margin-top: 10px;">
              📚 MANUAL DO CLIPADOR
            </div>
          </div>
          
          <!-- Main Content -->
          <div style="background: linear-gradient(135deg, #0f172a 0%, #064e3b 100%); border-radius: 20px; padding: 40px; border: 1px solid rgba(16,185,129,0.2);">
            <h1 style="margin: 0 0 20px 0; font-size: 28px; background: linear-gradient(90deg, #10b981, #34d399); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
              📚 Parabéns pela aquisição!
            </h1>
            
            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #a0a0a0;">
              Olá, <strong style="color: #ffffff;">${name || "Clipador"}</strong>!
            </p>
            
            <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #a0a0a0;">
              Sua compra do <strong style="color: #10b981;">Manual do Clipador</strong> foi confirmada com sucesso! 🎉
              Agora você tem em mãos o guia definitivo para dominar a arte da clipagem e transformar cortes em renda.
            </p>
            
            <!-- Status Box -->
            <div style="background: linear-gradient(135deg, rgba(16,185,129,0.1), rgba(52,211,153,0.05)); border: 1px solid rgba(16,185,129,0.3); border-radius: 12px; padding: 24px; margin-bottom: 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">📖</div>
              <div style="font-size: 20px; font-weight: bold; background: linear-gradient(90deg, #10b981, #34d399); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                Acesso Liberado!
              </div>
              <div style="font-size: 14px; color: #a0a0a0; margin-top: 8px;">
                E-mail: <strong style="color: #ffffff;">${email}</strong>
              </div>
              <div style="font-size: 13px; color: #10b981; margin-top: 4px;">
                ✅ Acesso vitalício garantido
              </div>
            </div>
            
            <!-- What's Inside -->
            <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #ffffff;">
              📋 O que você encontra no Manual:
            </h3>
            <div style="margin-bottom: 30px;">
              <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 14px 16px; margin-bottom: 6px; display: flex; align-items: center;">
                <span style="color: #10b981; margin-right: 10px; font-size: 16px;">📄</span>
                <div>
                  <strong style="color: #ffffff;">+60 páginas</strong>
                  <span style="color: #a0a0a0;"> de conteúdo exclusivo</span>
                </div>
              </div>
              <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 14px 16px; margin-bottom: 6px; display: flex; align-items: center;">
                <span style="color: #10b981; margin-right: 10px; font-size: 16px;">📖</span>
                <div>
                  <strong style="color: #ffffff;">12 capítulos completos</strong>
                  <span style="color: #a0a0a0;"> — do iniciante ao profissional</span>
                </div>
              </div>
              <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 14px 16px; margin-bottom: 6px; display: flex; align-items: center;">
                <span style="color: #10b981; margin-right: 10px; font-size: 16px;">🧠</span>
                <div>
                  <strong style="color: #ffffff;">Mentalidade Clipadora</strong>
                  <span style="color: #a0a0a0;"> — consistência e longo prazo</span>
                </div>
              </div>
              <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 14px 16px; margin-bottom: 6px; display: flex; align-items: center;">
                <span style="color: #10b981; margin-right: 10px; font-size: 16px;">🎯</span>
                <div>
                  <strong style="color: #ffffff;">Estratégias de Competição</strong>
                  <span style="color: #a0a0a0;"> — como vencer diário e mensal</span>
                </div>
              </div>
              <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 14px 16px; margin-bottom: 6px; display: flex; align-items: center;">
                <span style="color: #10b981; margin-right: 10px; font-size: 16px;">📊</span>
                <div>
                  <strong style="color: #ffffff;">Algoritmo no Bolso</strong>
                  <span style="color: #a0a0a0;"> — o que faz um corte explodir</span>
                </div>
              </div>
              <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 14px 16px; margin-bottom: 6px; display: flex; align-items: center;">
                <span style="color: #10b981; margin-right: 10px; font-size: 16px;">✂️</span>
                <div>
                  <strong style="color: #ffffff;">Edição que Prende</strong>
                  <span style="color: #a0a0a0;"> — ritmo, zoom e legendas</span>
                </div>
              </div>
              <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 14px 16px; margin-bottom: 6px; display: flex; align-items: center;">
                <span style="color: #10b981; margin-right: 10px; font-size: 16px;">📝</span>
                <div>
                  <strong style="color: #ffffff;">Templates Prontos</strong>
                  <span style="color: #a0a0a0;"> — 30 legendas + 20 CTAs + 10 comentários</span>
                </div>
              </div>
              <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 14px 16px; display: flex; align-items: center;">
                <span style="color: #10b981; margin-right: 10px; font-size: 16px;">💰</span>
                <div>
                  <strong style="color: #ffffff;">Dinheiro no Bolso</strong>
                  <span style="color: #a0a0a0;"> — premiações, portfólio e clientes</span>
                </div>
              </div>
            </div>
            
            <!-- Highlight Box -->
            <div style="background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(52,211,153,0.05)); border: 1px dashed rgba(16,185,129,0.4); border-radius: 12px; padding: 20px; margin-bottom: 30px; text-align: center;">
              <p style="margin: 0; font-size: 15px; color: #a0a0a0;">
                💡 <strong style="color: #10b981;">Dica:</strong> Comece pelo Capítulo 00 (Antes de Começar) 
                para configurar tudo e já saia fazendo seus primeiros cortes vencedores!
              </p>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center;">
              <a href="https://league.clipfyai.com" style="display: inline-block; background: linear-gradient(90deg, #10b981, #34d399); color: #000000; font-size: 16px; font-weight: bold; padding: 16px 40px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 20px rgba(16,185,129,0.4);">
                Acessar o Manual →
              </a>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; margin-top: 40px; color: #666666; font-size: 12px;">
            <p style="margin: 0 0 10px 0;">
              Obrigado pela confiança! Bons cortes! ✂️🎉
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
// ENVIO DO TESTE
// ============================================

const TEST_EMAIL = "murilo.rocha.mattoso@gmail.com";
const TEST_NAME = "Murilo Rocha";

async function main() {
  console.log("=" .repeat(60));
  console.log("📧 TESTE DE EMAIL - MANUAL DO CLIPADOR");
  console.log("=" .repeat(60));
  console.log(`📬 Enviando para: ${TEST_EMAIL}`);
  console.log(`👤 Nome teste: ${TEST_NAME}\n`);

  // ---- Email: Parabéns pela aquisição do Manual ----
  try {
    console.log("1️⃣  Enviando: Email de Parabéns pela Aquisição do Manual do Clipador...");
    const result = await resend.emails.send({
      from: "Clipfy League <noreply@league.clipfyai.com>",
      to: TEST_EMAIL,
      subject: "🧪 [TESTE] 📚 Parabéns! Seu Manual do Clipador está liberado!",
      html: getManualPurchaseConfirmationEmailTemplate(TEST_NAME, TEST_EMAIL),
    });
    console.log(`   ✅ Enviado! ID: ${result.data?.id}`);
  } catch (error: any) {
    console.error(`   ❌ Erro:`, error.message);
  }

  console.log("\n" + "=" .repeat(60));
  console.log("✅ EMAIL MANUAL DO CLIPADOR ENVIADO!");
  console.log("=" .repeat(60));
  console.log(`\n📩 Verifique sua caixa de entrada em ${TEST_EMAIL}`);
  console.log("   O email enviado é:");
  console.log("   1. 📚 Parabéns pela aquisição do Manual (sem senha, apenas congratulações)");
}

main();

