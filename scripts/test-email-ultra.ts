import { Resend } from "resend";
import * as dotenv from "dotenv";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

// ============================================
// Template de parabéns ULTRA (cópia exata do src/lib/emails/clipfy-ultra.ts)
// ============================================
function getUltraPurchaseConfirmationEmailTemplate(name: string, email: string): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Parabéns! Você agora é ULTRA!</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a; color: #ffffff;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 40px;">
            <img src="https://league.clipfyai.com/images/logo-clipfy-white.svg" alt="Clipfy League" style="width: 180px; height: auto;" />
            <div style="display: inline-block; background: linear-gradient(90deg, hsl(182,100%,54%), hsl(151,100%,61%)); color: #000; font-size: 12px; font-weight: bold; padding: 4px 12px; border-radius: 20px; margin-top: 10px;">
              ⚡ ULTRA
            </div>
          </div>
          
          <!-- Main Content -->
          <div style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); border-radius: 20px; padding: 40px; border: 1px solid rgba(0,212,170,0.2);">
            <h1 style="margin: 0 0 20px 0; font-size: 28px; background: linear-gradient(90deg, hsl(182,100%,54%), hsl(151,100%,61%)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
              ⚡ Parabéns! Você agora é ULTRA!
            </h1>
            
            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #a0a0a0;">
              Olá, <strong style="color: #ffffff;">${name || "Clipador"}</strong>!
            </p>
            
            <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #a0a0a0;">
              Sua compra do <strong style="color: hsl(182,100%,54%);">Clipfy League ULTRA</strong> foi confirmada com sucesso! 🎉
              Você acaba de desbloquear o nível mais alto da plataforma e está pronto para dominar as competições.
            </p>
            
            <!-- Status Box -->
            <div style="background: linear-gradient(135deg, rgba(0,212,170,0.1), rgba(0,245,196,0.05)); border: 1px solid rgba(0,212,170,0.3); border-radius: 12px; padding: 24px; margin-bottom: 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">⚡</div>
              <div style="font-size: 20px; font-weight: bold; background: linear-gradient(90deg, hsl(182,100%,54%), hsl(151,100%,61%)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                Tier ULTRA Ativado
              </div>
              <div style="font-size: 14px; color: #a0a0a0; margin-top: 8px;">
                E-mail: <strong style="color: #ffffff;">${email}</strong>
              </div>
            </div>
            
            <!-- Benefits Unlocked -->
            <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #ffffff;">
              🔓 Tudo que você desbloqueou:
            </h3>
            <div style="margin-bottom: 30px;">
              <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 16px; margin-bottom: 8px;">
                <span style="font-size: 20px; margin-right: 10px;">✅</span>
                <strong style="color: hsl(182,100%,54%);">Tudo do Clipfy PRO incluído</strong>
                <div style="font-size: 13px; color: #a0a0a0; margin-top: 4px; padding-left: 30px;">
                  Academia Clipadora, comunidade, cargo VIP e portfólio
                </div>
              </div>
              <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 16px; margin-bottom: 8px;">
                <span style="font-size: 20px; margin-right: 10px;">👥</span>
                <strong style="color: #ffffff;">Comunidade VIP com Embaixadores</strong>
                <div style="font-size: 13px; color: #a0a0a0; margin-top: 4px; padding-left: 30px;">
                  Grupo exclusivo com clipadores que já faturam nas competições
                </div>
              </div>
              <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 16px; margin-bottom: 8px;">
                <span style="font-size: 20px; margin-right: 10px;">👑</span>
                <strong style="color: #ffffff;">Cargo ULTRA exclusivo no Discord</strong>
                <div style="font-size: 13px; color: #a0a0a0; margin-top: 4px; padding-left: 30px;">
                  Destaque exclusivo com acesso a canais e benefícios especiais
                </div>
              </div>
              <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 16px; margin-bottom: 8px;">
                <span style="font-size: 20px; margin-right: 10px;">🎬</span>
                <strong style="color: #ffffff;">Review Semanal dos seus Cortes</strong>
                <div style="font-size: 13px; color: #a0a0a0; margin-top: 4px; padding-left: 30px;">
                  Seus vídeos analisados por quem já domina as competições
                </div>
              </div>
              <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 16px; margin-bottom: 8px;">
                <span style="font-size: 20px; margin-right: 10px;">🎯</span>
                <strong style="color: #ffffff;">Estratégias Exclusivas de Competição</strong>
                <div style="font-size: 13px; color: #a0a0a0; margin-top: 4px; padding-left: 30px;">
                  O que funciona para rankear e ganhar premiações
                </div>
              </div>
              <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 16px;">
                <span style="font-size: 20px; margin-right: 10px;">🏆</span>
                <strong style="color: #ffffff;">Garantia de R$3.000 em 6 meses</strong>
                <div style="font-size: 13px; color: #a0a0a0; margin-top: 4px; padding-left: 30px;">
                  Se seguir o método e não atingir, devolvemos seu dinheiro
                </div>
              </div>
            </div>
            
            <!-- Highlight Box -->
            <div style="background: linear-gradient(135deg, rgba(0,212,170,0.15), rgba(0,245,196,0.05)); border: 1px dashed rgba(0,212,170,0.4); border-radius: 12px; padding: 20px; margin-bottom: 30px; text-align: center;">
              <p style="margin: 0; font-size: 15px; color: #a0a0a0;">
                💡 <strong style="color: hsl(182,100%,54%);">Dica:</strong> Acesse a plataforma e confira seu novo cargo ULTRA. 
                Os embaixadores já estão te esperando na comunidade VIP!
              </p>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center;">
              <a href="https://league.clipfyai.com/classes" style="display: inline-block; background: linear-gradient(90deg, hsl(182,100%,54%), hsl(151,100%,61%)); color: #000000; font-size: 16px; font-weight: bold; padding: 16px 40px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 20px rgba(0,212,170,0.4);">
                Acessar a Plataforma →
              </a>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; margin-top: 40px; color: #666666; font-size: 12px;">
            <p style="margin: 0 0 10px 0;">
              Bem-vindo ao nível mais alto do Clipfy League! ⚡
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
  console.log("📧 TESTE DE EMAIL - CLIPFY LEAGUE ULTRA");
  console.log("=" .repeat(60));
  console.log(`📬 Enviando para: ${TEST_EMAIL}`);
  console.log(`👤 Nome teste: ${TEST_NAME}\n`);

  // ---- Email: Parabéns pela aquisição do ULTRA ----
  try {
    console.log("1️⃣  Enviando: Email de Parabéns pela Aquisição do ULTRA...");
    const result = await resend.emails.send({
      from: "Clipfy League <noreply@league.clipfyai.com>",
      to: TEST_EMAIL,
      subject: "🧪 [TESTE] ⚡ Parabéns! Você agora é Clipfy League ULTRA!",
      html: getUltraPurchaseConfirmationEmailTemplate(TEST_NAME, TEST_EMAIL),
    });
    console.log(`   ✅ Enviado! ID: ${result.data?.id}`);
  } catch (error: any) {
    console.error(`   ❌ Erro:`, error.message);
  }

  console.log("\n" + "=" .repeat(60));
  console.log("✅ EMAIL ULTRA ENVIADO!");
  console.log("=" .repeat(60));
  console.log(`\n📩 Verifique sua caixa de entrada em ${TEST_EMAIL}`);
  console.log("   O email enviado é:");
  console.log("   1. ⚡ Parabéns pela aquisição do ULTRA (sem senha, apenas congratulações)");
}

main();

