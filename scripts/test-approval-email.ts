import { Resend } from "resend";
import * as dotenv from "dotenv";

// Carregar variáveis de ambiente
dotenv.config();

// Inicializar Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Template de email de aprovação de inscrição
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

      <!-- Call to Action Principal -->
      <div style="text-align: center; margin: 32px 0;">
        <p style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #ffffff;">
          🚀 Pronto para começar a competir?
        </p>
        <a href="https://league.clipfyai.com/my-competitions/${campaignSlug}" 
           target="_blank" 
           style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #14F7FF 0%, #37FF9F 100%); color: #000000; text-decoration: none; border-radius: 12px; font-weight: 800; font-size: 16px; box-shadow: 0 4px 20px rgba(20, 247, 255, 0.3); transition: transform 0.2s;">
          ✨ ACESSAR COMPETIÇÃO AGORA
        </a>
      </div>

      <!-- Dica Importante -->
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

async function main() {
  try {
    console.log("🚀 Iniciando envio de email de teste...\n");

    // Verificar API key
    if (!process.env.RESEND_API_KEY) {
      console.error("❌ RESEND_API_KEY não encontrada nas variáveis de ambiente!");
      process.exit(1);
    }
    
    console.log("✅ API Key encontrada:", process.env.RESEND_API_KEY.substring(0, 10) + "...");

    // Dados de exemplo
    const clipperName = "Murilo Rocha";
    const campaignName = "Tarcísio De Freitas - Novembro 2025";
    const startDate = new Date("2025-11-03T00:00:00");
    const endDate = new Date("2025-12-03T23:59:59");
    const campaignSlug = "tarcisio-de-freitas-novembro";

    // Gerar HTML do email
    const emailHtml = getApplicationApprovalEmailTemplate(
      clipperName,
      campaignName,
      startDate,
      endDate,
      campaignSlug
    );

    console.log("📧 Enviando email para: murilo@clipfyai.com");
    console.log("📝 Assunto: 🎉 Inscrição aprovada: " + campaignName);
    console.log("👤 Clipper: " + clipperName);
    console.log("🏆 Competição: " + campaignName);
    console.log("📅 Período: " + startDate.toLocaleDateString('pt-BR') + " - " + endDate.toLocaleDateString('pt-BR'));
    console.log("\n⏳ Aguarde...\n");

    // Enviar email via Resend
    const result = await resend.emails.send({
      from: "ClipfyAI <noreply@league.clipfyai.com>",
      to: "murilo@clipfyai.com",
      subject: `🎉 Inscrição aprovada: ${campaignName}`,
      html: emailHtml,
    });

    console.log("✅ Email enviado com sucesso!");
    console.log("📬 Resultado completo:", JSON.stringify(result, null, 2));
    console.log("\n🎉 Verifique sua caixa de entrada em murilo@clipfyai.com\n");
    
  } catch (error) {
    console.error("❌ Erro ao enviar email:", error);
    console.error("Detalhes:", JSON.stringify(error, null, 2));
    process.exit(1);
  }
}

// Executar
main();
