import { Resend } from "resend";
import * as dotenv from "dotenv";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

// ============================================
// Template: Notificação de Pagamento (Prêmio creditado na wallet)
// ============================================
function getPaymentNotificationEmailTemplate(
  clipperName: string,
  amount: number,
  paymentType: string,
  description: string,
  newBalance: number,
  campaignName?: string,
  position?: number,
  rankingType?: string
) {
  const paymentTypeLabel = paymentType === "PRIZE_CREDIT" ? "Prêmio" 
    : paymentType === "BONUS" ? "Bônus" 
    : "Ajuste";
  
  const paymentTypeEmoji = paymentType === "PRIZE_CREDIT" ? "🏆" 
    : paymentType === "BONUS" ? "⭐" 
    : "💰";
  
  const positionEmoji = position === 1 ? "🥇" : position === 2 ? "🥈" : position === 3 ? "🥉" : `${position}º`;
  const rankingLabel = rankingType === "daily" ? "Diário" : rankingType === "monthly" ? "Mensal" : "";

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pagamento Recebido - ClipfyAI</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #000000; color: #ffffff;">
  <div style="max-width: 600px; margin: 0 auto; background: #000000;">
    
    <!-- Header com Logo -->
    <div style="text-align: center; padding: 32px 24px;">
      <a href="https://www.clipfyai.com" target="_blank" style="text-decoration: none; display: inline-block;">
        <img src="https://framerusercontent.com/images/yDoe24MwEeKgmJpW2aiCrKIxzs.png?scale-down-to=512" 
             alt="Clipfy League" 
             width="250" 
             style="display: block; width: 250px; height: auto; border: 0; margin: 0 auto;" />
      </a>
    </div>

    <!-- Banner Principal -->
    <div style="background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); border: 2px solid #37FF9F; padding: 32px 24px; border-radius: 16px; margin: 0 16px 32px; text-align: center; box-shadow: 0 0 30px rgba(55, 255, 159, 0.2);">
      <div style="font-size: 64px; margin-bottom: 16px;">${paymentTypeEmoji}</div>
      <h1 style="margin: 0; font-size: 36px; font-weight: 900; color: #37FF9F; line-height: 1.2; letter-spacing: -0.5px;">
        PAGAMENTO RECEBIDO!
      </h1>
      <p style="margin: 16px 0 0 0; font-size: 18px; font-weight: 600; color: #14F7FF;">
        ${clipperName}, você recebeu um ${paymentTypeLabel.toLowerCase()}! 🎉
      </p>
      ${position && rankingType ? `
      <div style="margin-top: 20px; padding: 16px; background: rgba(55, 255, 159, 0.1); border: 1px solid #37FF9F; border-radius: 12px;">
        <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #888888; text-transform: uppercase; letter-spacing: 1px;">
          Posição no Ranking
        </p>
        <p style="margin: 0; font-size: 48px; font-weight: 900; color: #37FF9F; line-height: 1;">
          ${positionEmoji}
        </p>
        <p style="margin: 8px 0 0 0; font-size: 16px; font-weight: 700; color: #14F7FF;">
          Ranking ${rankingLabel}
        </p>
      </div>
      ` : ''}
    </div>

    <!-- Conteúdo Principal -->
    <div style="padding: 0 24px 32px;">
      
      <!-- Detalhes do Pagamento -->
      <div style="background: #111111; border: 2px solid #37FF9F; border-radius: 16px; padding: 32px; margin-bottom: 24px; box-shadow: 0 4px 20px rgba(55, 255, 159, 0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #14F7FF; text-transform: uppercase; letter-spacing: 1px;">
            💸 Valor Creditado
          </p>
          <p style="margin: 0; font-size: 48px; font-weight: 900; color: #37FF9F; line-height: 1.2;">
            ${formatCurrency(amount)}
          </p>
        </div>

        <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, #37FF9F 50%, transparent 100%); margin: 24px 0;"></div>

        <div style="space-y: 16px;">
          <div style="margin-bottom: 16px;">
            <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #888888; text-transform: uppercase; letter-spacing: 1px;">
              Tipo de Pagamento
            </p>
            <p style="margin: 0; font-size: 18px; font-weight: 700; color: #ffffff;">
              ${paymentTypeEmoji} ${paymentTypeLabel}
            </p>
          </div>

          <div style="margin-bottom: 16px;">
            <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #888888; text-transform: uppercase; letter-spacing: 1px;">
              Descrição
            </p>
            <p style="margin: 0; font-size: 16px; font-weight: 600; color: #e0e0e0; line-height: 1.5;">
              ${description}
            </p>
          </div>

          ${campaignName ? `
          <div style="margin-bottom: 16px;">
            <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #888888; text-transform: uppercase; letter-spacing: 1px;">
              Competição
            </p>
            <p style="margin: 0; font-size: 16px; font-weight: 700; color: #14F7FF;">
              ${campaignName}
            </p>
          </div>
          ` : ''}

          <div>
            <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #888888; text-transform: uppercase; letter-spacing: 1px;">
              Novo Saldo Disponível
            </p>
            <p style="margin: 0; font-size: 24px; font-weight: 900; color: #37FF9F;">
              ${formatCurrency(newBalance)}
            </p>
          </div>
        </div>
      </div>

      <!-- Informações Importantes -->
      <div style="background: rgba(20, 247, 255, 0.1); border: 1px solid #14F7FF; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 700; color: #14F7FF;">
          💡 Como funciona?
        </p>
        <ul style="margin: 0; padding: 0 0 0 20px; list-style-type: none;">
          <li style="margin-bottom: 8px; font-size: 14px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F; font-weight: 700;">✓</span>
            Os fundos foram <strong style="color: #ffffff;">creditados em sua carteira ClipfyAI</strong>
          </li>
          <li style="margin-bottom: 8px; font-size: 14px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F; font-weight: 700;">✓</span>
            Você pode <strong style="color: #ffffff;">acompanhar seu saldo</strong> na plataforma
          </li>
          <li style="margin-bottom: 8px; font-size: 14px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F; font-weight: 700;">✓</span>
            O pagamento será realizado <strong style="color: #ffffff;">via PIX no final da competição</strong>
          </li>
          <li style="margin: 0; font-size: 14px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F; font-weight: 700;">✓</span>
            Você receberá as <strong style="color: #ffffff;">instruções para saque</strong> em breve
          </li>
        </ul>
      </div>

      <!-- Call to Action -->
      <div style="text-align: center; margin: 32px 0;">
        <p style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #ffffff;">
          🚀 Continue competindo e ganhe ainda mais!
        </p>
        <a href="https://league.clipfyai.com/my-competitions" 
           target="_blank" 
           style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #14F7FF 0%, #37FF9F 100%); color: #000000; text-decoration: none; border-radius: 12px; font-weight: 800; font-size: 16px; box-shadow: 0 4px 20px rgba(20, 247, 255, 0.3);">
          ✨ ACESSAR MINHAS COMPETIÇÕES
        </a>
      </div>

      <!-- Dúvidas -->
      <div style="background: #111111; border: 1px solid #333333; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #14F7FF;">
          ❓ Tem dúvidas sobre o pagamento?
        </p>
        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #e0e0e0;">
          Nossa equipe está pronta para te ajudar! Entre em contato através das redes sociais ou pelo suporte na plataforma.
        </p>
      </div>

      <!-- Redes Sociais -->
      <div style="text-align: center; margin: 32px 0 24px;">
        <p style="margin: 0 0 16px 0; font-size: 14px; color: #888888;">
          Siga a Clipfy League nas redes sociais
        </p>
        <a href="https://tiktok.com/@clipfyai.league" target="_blank" style="display: inline-block; margin: 5px; padding: 12px 20px; background: #14F7FF; color: #000000; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
          TikTok
        </a>
        <a href="https://instagram.com/clipfyai.league" target="_blank" style="display: inline-block; margin: 5px; padding: 12px 20px; background: #37FF9F; color: #000000; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
          Instagram
        </a>
      </div>

      <!-- Footer -->
      <div style="text-align: center; padding: 24px 0; border-top: 1px solid #222222;">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #888888;">
          Parabéns pelo seu desempenho! 🎬✨
        </p>
        <p style="margin: 0 0 4px 0; font-size: 14px; color: #888888;">
          <strong style="color: #14F7FF;">ClipfyAI</strong> - Sua plataforma de competições de cortes
        </p>
        <p style="margin: 0; font-size: 12px; color: #666666;">
          <a href="https://league.clipfyai.com/terms-of-use" target="_blank" style="color: #14F7FF; text-decoration: none;">Termos de Uso</a> | 
          <a href="https://league.clipfyai.com/rules" target="_blank" style="color: #14F7FF; text-decoration: none;">Regras</a>
        </p>
      </div>

    </div>
  </div>
</body>
</html>
  `;
}

// ============================================
// Template: Inscrição Aprovada em Competição
// ============================================
function getApplicationApprovalEmailTemplate(
  clipperName: string,
  campaignName: string,
  startDate: Date,
  endDate: Date,
  campaignSlug: string
) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  };

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inscrição Aprovada - ${campaignName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #000000; color: #ffffff;">
  <div style="max-width: 600px; margin: 0 auto; background: #000000;">
    
    <!-- Header com Logo -->
    <div style="text-align: center; padding: 32px 24px;">
      <a href="https://www.clipfyai.com" target="_blank" style="text-decoration: none; display: inline-block;">
        <img src="https://framerusercontent.com/images/yDoe24MwEeKgmJpW2aiCrKIxzs.png?scale-down-to=512" 
             alt="Clipfy League" 
             width="250" 
             style="display: block; width: 250px; height: auto; border: 0; margin: 0 auto;" />
      </a>
    </div>

    <!-- Banner Principal -->
    <div style="background: #1a1a1a; border: 2px solid #14F7FF; padding: 32px 24px; border-radius: 16px; margin: 0 16px 32px; text-align: center; box-shadow: 0 0 30px rgba(20, 247, 255, 0.2);">
      <h1 style="margin: 0; font-size: 36px; font-weight: 900; color: #14F7FF; line-height: 1.2; letter-spacing: -0.5px;">
        🎉 PARABÉNS, ${clipperName.toUpperCase()}!
      </h1>
      <p style="margin: 12px 0 20px; font-size: 20px; font-weight: 700; color: #37FF9F;">
        Sua inscrição foi aprovada!
      </p>
      
      <div style="background: #111111; border: 1px solid #37FF9F; border-radius: 12px; padding: 20px; margin-top: 24px;">
        <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #14F7FF; text-transform: uppercase; letter-spacing: 1px;">
          🏆 Competição
        </p>
        <p style="margin: 0; font-size: 24px; font-weight: 900; color: #37FF9F; line-height: 1.3;">
          ${campaignName}
        </p>
      </div>
    </div>

    <!-- Conteúdo Principal -->
    <div style="padding: 0 24px 32px;">
      
      <!-- Informações da Competição -->
      <div style="background: #111111; border: 1px solid #333333; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #14F7FF;">
          📅 Período da Competição
        </h2>
        <p style="margin: 0 0 8px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
          <strong style="color: #37FF9F;">Início:</strong> ${formatDate(startDate)}
        </p>
        <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
          <strong style="color: #37FF9F;">Término:</strong> ${formatDate(endDate)}
        </p>
      </div>

      <!-- Próximos Passos -->
      <div style="background: #111111; border: 1px solid #333333; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #14F7FF;">
          🎯 Próximos Passos
        </h2>
        <ul style="margin: 0; padding: 0 0 0 20px; list-style-type: none;">
          <li style="margin-bottom: 12px; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F;">✓</span>
            <strong style="color: #ffffff;">Acesse a página da competição</strong> para ver regras e prêmios
          </li>
          <li style="margin-bottom: 12px; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F;">✓</span>
            <strong style="color: #ffffff;">Cadastre suas contas de redes sociais</strong>
          </li>
          <li style="margin-bottom: 12px; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F;">✓</span>
            <strong style="color: #ffffff;">Comece a enviar seus posts</strong> e concorra aos prêmios!
          </li>
          <li style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F;">✓</span>
            <strong style="color: #ffffff;">Acompanhe seu ranking</strong> em tempo real
          </li>
        </ul>
      </div>

      <!-- Call to Action -->
      <div style="text-align: center; margin: 32px 0;">
        <p style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #ffffff;">
          🚀 Pronto para começar a competir?
        </p>
        <a href="https://league.clipfyai.com/my-competitions/${campaignSlug}" 
           target="_blank" 
           style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #14F7FF 0%, #37FF9F 100%); color: #000000; text-decoration: none; border-radius: 12px; font-weight: 800; font-size: 16px; box-shadow: 0 4px 20px rgba(20, 247, 255, 0.3);">
          ✨ ACESSAR COMPETIÇÃO AGORA
        </a>
      </div>

      <!-- Dica -->
      <div style="background: rgba(20, 247, 255, 0.1); border: 1px solid #14F7FF; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #14F7FF;">
          💡 Dica Importante
        </p>
        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #e0e0e0;">
          Quanto mais cedo você começar a postar, maiores suas chances de ganhar prêmios diários e mensais. Não perca tempo! 🏃‍♂️💨
        </p>
      </div>

      <!-- Redes Sociais -->
      <div style="text-align: center; margin: 32px 0 24px;">
        <p style="margin: 0 0 16px 0; font-size: 14px; color: #888888;">
          Siga a Clipfy League nas redes sociais
        </p>
        <a href="https://tiktok.com/@clipfyai.league" target="_blank" style="display: inline-block; margin: 5px; padding: 12px 20px; background: #14F7FF; color: #000000; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
          TikTok
        </a>
        <a href="https://instagram.com/clipfyai.league" target="_blank" style="display: inline-block; margin: 5px; padding: 12px 20px; background: #37FF9F; color: #000000; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
          Instagram
        </a>
      </div>

      <!-- Footer -->
      <div style="text-align: center; padding: 24px 0; border-top: 1px solid #222222;">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #888888;">
          Boa sorte e boas criações! 🎬✨
        </p>
        <p style="margin: 0 0 4px 0; font-size: 14px; color: #888888;">
          <strong style="color: #14F7FF;">ClipfyAI</strong> - Sua plataforma de competições de cortes
        </p>
        <p style="margin: 0; font-size: 12px; color: #666666;">
          <a href="https://league.clipfyai.com/terms-of-use" target="_blank" style="color: #14F7FF; text-decoration: none;">Termos de Uso</a> | 
          <a href="https://league.clipfyai.com/rules" target="_blank" style="color: #14F7FF; text-decoration: none;">Regras</a>
        </p>
      </div>

    </div>
  </div>
</body>
</html>
  `;
}

// ============================================
// Template: PIX Enviado
// ============================================
function getPixSentEmailTemplate(
  clipperName: string,
  amount: number,
  pixKey: string,
  campaignName: string,
  proofUrl: string
) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .amount { font-size: 32px; font-weight: bold; color: #22c55e; text-align: center; margin: 20px 0; }
          .info-box { background: white; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💰 PIX Enviado!</h1>
          </div>
          <div class="content">
            <p>Olá, <strong>${clipperName}</strong>!</p>
            
            <p>Acabamos de enviar um PIX para você! 🎉</p>
            
            <div class="amount">
              ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)}
            </div>
            
            <div class="info-box">
              <h3 style="margin-top: 0;">📋 Detalhes do Pagamento</h3>
              <p><strong>Chave PIX:</strong> ${pixKey}</p>
              <p><strong>Competição:</strong> ${campaignName}</p>
              <p><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              <p><strong>Comprovante:</strong> <a href="${proofUrl}" target="_blank" style="color: #667eea;">Ver comprovante</a></p>
            </div>
            
            <p>O valor deve aparecer em sua conta em instantes.</p>
            
            <p style="margin-top: 30px;">Continue mandando bem! 🚀</p>
            
            <div class="footer">
              <p>ClipfyAI - Plataforma de Competições de Cortes</p>
              <p>Este é um email automático, não responda.</p>
            </div>
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

async function main() {
  console.log("=" .repeat(60));
  console.log("📧 TESTE DE EMAILS - COMPETIÇÃO / PAGAMENTOS");
  console.log("=" .repeat(60));
  console.log(`📬 Enviando para: ${TEST_EMAIL}`);
  console.log(`👤 Nome teste: ${TEST_NAME}\n`);

  // ---- Email 1: Notificação de Pagamento (Prêmio Ranking Diário) ----
  try {
    console.log("1️⃣  Enviando: Notificação de Pagamento (Prêmio 1º Lugar Ranking Diário)...");
    const result1 = await resend.emails.send({
      from: "ClipfyAI <noreply@league.clipfyai.com>",
      to: TEST_EMAIL,
      subject: "🧪 [TESTE] 🏆 Pagamento Recebido: R$ 500,00",
      html: getPaymentNotificationEmailTemplate(
        TEST_NAME,
        500.00,
        "PRIZE_CREDIT",
        "1º lugar no Ranking Diário - 20/02/2026",
        1250.00,
        "Competição Tarcísio",
        1,
        "daily"
      ),
    });
    console.log(`   ✅ Enviado! ID: ${result1.data?.id}`);
  } catch (error: any) {
    console.error(`   ❌ Erro:`, error.message);
  }

  await new Promise((r) => setTimeout(r, 1000));

  // ---- Email 2: Inscrição Aprovada em Competição ----
  try {
    console.log("2️⃣  Enviando: Inscrição Aprovada em Competição...");
    const result2 = await resend.emails.send({
      from: "ClipfyAI <noreply@league.clipfyai.com>",
      to: TEST_EMAIL,
      subject: "🧪 [TESTE] 🎉 Inscrição aprovada: Competição Tarcísio",
      html: getApplicationApprovalEmailTemplate(
        TEST_NAME,
        "Competição Tarcísio",
        new Date("2026-03-01"),
        new Date("2026-03-31"),
        "competicao-tarcisio"
      ),
    });
    console.log(`   ✅ Enviado! ID: ${result2.data?.id}`);
  } catch (error: any) {
    console.error(`   ❌ Erro:`, error.message);
  }

  await new Promise((r) => setTimeout(r, 1000));

  // ---- Email 3: PIX Enviado ----
  try {
    console.log("3️⃣  Enviando: PIX Enviado...");
    const result3 = await resend.emails.send({
      from: "ClipfyAI <noreply@league.clipfyai.com>",
      to: TEST_EMAIL,
      subject: "🧪 [TESTE] 💰 PIX Enviado: R$ 1.250,00",
      html: getPixSentEmailTemplate(
        TEST_NAME,
        1250.00,
        "murilo.rocha@exemplo.com",
        "Competição Tarcísio",
        "https://league.clipfyai.com/comprovante-exemplo"
      ),
    });
    console.log(`   ✅ Enviado! ID: ${result3.data?.id}`);
  } catch (error: any) {
    console.error(`   ❌ Erro:`, error.message);
  }

  console.log("\n" + "=" .repeat(60));
  console.log("✅ TODOS OS EMAILS DE COMPETIÇÃO ENVIADOS!");
  console.log("=" .repeat(60));
  console.log("\n📩 Verifique sua caixa de entrada em murilo.rocha.mattoso@gmail.com");
  console.log("   Os 3 emails enviados são:");
  console.log("   1. 🏆 Notificação de Pagamento (Prêmio 1º lugar diário)");
  console.log("   2. 🎉 Inscrição Aprovada em Competição");
  console.log("   3. 💰 PIX Enviado");
}

main();

