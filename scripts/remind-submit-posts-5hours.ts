import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";
import * as dotenv from "dotenv";

// Carregar variáveis de ambiente
dotenv.config();

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);

// Template do email
function getReminderEmailTemplate(clipperName: string, campaignName: string, campaignSlug: string) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>⏰ Faltam menos de 5 horas - Envie seus posts!</title>
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

    <!-- Banner ALERTA -->
    <div style="background: linear-gradient(135deg, #FF6B00 0%, #FF8C00 100%); border: 3px solid #FF6B00; padding: 32px 24px; border-radius: 16px; margin: 0 16px 32px; text-align: center; box-shadow: 0 0 40px rgba(255, 107, 0, 0.4);">
      <h1 style="margin: 0; font-size: 42px; font-weight: 900; color: #FFFFFF; line-height: 1.2; letter-spacing: -0.5px; text-transform: uppercase; text-shadow: 0 0 20px rgba(255, 107, 0, 0.8);">
        ⏰ ATENÇÃO! ⏰
      </h1>
      <p style="margin: 16px 0 0; font-size: 24px; font-weight: 900; color: #FFFF00; text-transform: uppercase; text-shadow: 0 0 10px rgba(255, 255, 0, 0.8);">
        MENOS DE 5 HORAS RESTANTES!
      </p>
    </div>

    <!-- Saudação -->
    <div style="padding: 0 24px 32px;">
      <p style="margin: 0 0 24px 0; font-size: 18px; line-height: 1.6; color: #ffffff;">
        Olá, <strong style="color: #14F7FF;">${clipperName}</strong>! 👋
      </p>

      <!-- Alerta Laranja -->
      <div style="background: rgba(255, 107, 0, 0.15); border: 3px solid #FF6B00; border-radius: 12px; padding: 24px; margin-bottom: 32px; box-shadow: 0 0 30px rgba(255, 107, 0, 0.3);">
        <div style="text-align: center; margin-bottom: 16px;">
          <span style="font-size: 64px; line-height: 1;">⚡</span>
        </div>
        <h2 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 900; color: #FF6B00; text-align: center; text-transform: uppercase;">
          ATENÇÃO: MENOS DE 5 HORAS!
        </h2>
        <p style="margin: 0 0 16px 0; font-size: 18px; line-height: 1.6; color: #ffffff; text-align: center; font-weight: 700;">
          O prazo para enviar seus posts do dia termina em <span style="color: #FF6B00; font-size: 24px; font-weight: 900;">MENOS DE 5 HORAS</span>!
        </p>
        <div style="background: #000000; border: 2px solid #FF6B00; border-radius: 8px; padding: 16px; margin-top: 20px;">
          <p style="margin: 0; font-size: 32px; font-weight: 900; color: #FF6B00; text-align: center; font-family: monospace;">
            22:00 HOJE
          </p>
          <p style="margin: 8px 0 0; font-size: 14px; color: #999999; text-align: center;">
            Posts enviados após este horário contarão para o ranking de amanhã
          </p>
        </div>
      </div>

      <!-- Info da Competição -->
      <div style="background: #111111; border: 2px solid #14F7FF; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #14F7FF; text-transform: uppercase; letter-spacing: 1px;">
          🏆 Competição
        </p>
        <p style="margin: 0; font-size: 20px; font-weight: 900; color: #37FF9F;">
          ${campaignName}
        </p>
      </div>

      <!-- Instruções -->
      <div style="background: #111111; border: 2px solid #FF8C00; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #FF8C00;">
          📋 LEMBRETE IMPORTANTE
        </h2>
        <ul style="margin: 0; padding: 0 0 0 20px; list-style-type: none;">
          <li style="margin-bottom: 12px; font-size: 16px; line-height: 1.6; color: #ffffff; position: relative; padding-left: 24px; font-weight: 600;">
            <span style="position: absolute; left: 0; color: #FF8C00; font-size: 20px;">✓</span>
            <strong style="color: #FF8C00;">Envie seus posts</strong> antes das 22:00h de hoje
          </li>
          <li style="margin-bottom: 12px; font-size: 16px; line-height: 1.6; color: #ffffff; position: relative; padding-left: 24px; font-weight: 600;">
            <span style="position: absolute; left: 0; color: #FF8C00; font-size: 20px;">✓</span>
            <strong style="color: #FF8C00;">Apenas posts submetidos na plataforma contam</strong>
          </li>
          <li style="margin-bottom: 12px; font-size: 16px; line-height: 1.6; color: #ffffff; position: relative; padding-left: 24px; font-weight: 600;">
            <span style="position: absolute; left: 0; color: #FF8C00; font-size: 20px;">✓</span>
            Use as <strong style="color: #FF8C00;">hashtags e menções obrigatórias</strong>
          </li>
          <li style="margin: 0; font-size: 16px; line-height: 1.6; color: #ffffff; position: relative; padding-left: 24px; font-weight: 600;">
            <span style="position: absolute; left: 0; color: #FF8C00; font-size: 20px;">✓</span>
            <strong style="color: #FF8C00;">Posts após 22:00h</strong> contam para o ranking de amanhã
          </li>
        </ul>
      </div>

      <!-- Call to Action -->
      <div style="text-align: center; margin: 40px 0;">
        <p style="margin: 0 0 24px 0; font-size: 20px; font-weight: 900; color: #FF8C00; text-transform: uppercase;">
          🚀 Não perca tempo! Envie agora!
        </p>
        <a href="https://league.clipfyai.com/my-competitions/${campaignSlug}" 
           target="_blank" 
           style="display: inline-block; padding: 20px 40px; background: linear-gradient(135deg, #FF6B00 0%, #FF8C00 100%); color: #FFFFFF; text-decoration: none; border-radius: 16px; font-weight: 900; font-size: 20px; box-shadow: 0 8px 30px rgba(255, 107, 0, 0.5); text-transform: uppercase; border: 3px solid #FFFFFF;">
          ⚡ ENVIAR POSTS AGORA ⚡
        </a>
        <p style="margin: 16px 0 0; font-size: 14px; color: #FF8C00; font-weight: 700;">
          ⏰ MENOS DE 5 HORAS PARA O DEADLINE DE HOJE!
        </p>
      </div>

      <!-- Dica Importante -->
      <div style="background: rgba(20, 247, 255, 0.1); border: 1px solid #14F7FF; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #14F7FF;">
          💡 Dica do Dia
        </p>
        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #e0e0e0;">
          Quanto mais cedo você enviar seus posts, mais tempo eles terão para ganhar visualizações e você subir no ranking diário! 🏃‍♂️💨
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
      <div style="text-align: center; padding: 24px 0; border-top: 1px solid #222222; margin-top: 32px;">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #888888;">
          Boa sorte e boas criações! 🎬✨
        </p>
        <p style="margin: 0 0 4px 0; font-size: 14px; color: #888888;">
          <strong style="color: #14F7FF;">ClipfyAI League</strong> - Sua plataforma de competições
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
    console.log("🚀 Iniciando envio de emails - Faltam menos de 5 horas...\n");

    // Buscar TODAS as campanhas ATIVAS
    const activeCampaigns = await prisma.campaign.findMany({
      where: {
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    if (activeCampaigns.length === 0) {
      console.log("⚠️ Nenhuma campanha ativa encontrada");
      return;
    }

    console.log(`✅ Campanhas ativas encontradas: ${activeCampaigns.length}\n`);
    activeCampaigns.forEach((campaign) => {
      console.log(`   - ${campaign.name} (${campaign.slug})`);
    });

    const allRecipients: Array<{
      email: string;
      name: string;
      campaignName: string;
      campaignSlug: string;
    }> = [];

    // Para cada campanha ativa, buscar clippers aprovados
    for (const campaign of activeCampaigns) {
      console.log(`\n📋 Processando campanha: ${campaign.name}`);

      const approvedApplications = await prisma.clipperApplication.findMany({
        where: {
          campaignId: campaign.id,
          status: "APPROVED",
        },
        include: {
          clipperProfile: {
            include: {
              user: {
                select: {
                  email: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      console.log(`   ✅ Clippers aprovados: ${approvedApplications.length}`);

      // Adicionar à lista de destinatários
      const campaignRecipients = approvedApplications
        .map((app) => ({
          email: app.clipperProfile.user?.email || "",
          name: app.clipperProfile.fullName,
          campaignName: campaign.name,
          campaignSlug: campaign.slug,
        }))
        .filter((r) => r.email);

      allRecipients.push(...campaignRecipients);
    }

    console.log(`\n📧 Total de emails a enviar: ${allRecipients.length}\n`);

    let successCount = 0;
    let errorCount = 0;

    // Enviar emails para TODOS os clippers
    for (const recipient of allRecipients) {
      try {
        const emailHtml = getReminderEmailTemplate(
          recipient.name,
          recipient.campaignName,
          recipient.campaignSlug
        );

        const result = await resend.emails.send({
          from: "ClipfyAI League <noreply@league.clipfyai.com>",
          to: recipient.email,
          subject: `⏰ Faltam menos de 5 horas! Envie seus posts - ${recipient.campaignName}`,
          html: emailHtml,
        });

        console.log(
          `✅ Email enviado para: ${recipient.email} (${recipient.campaignName}) - ID: ${result.data?.id}`
        );
        successCount++;

        // Delay para não sobrecarregar a API
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error: any) {
        console.error(`❌ Erro ao enviar para ${recipient.email}:`, error.message);
        errorCount++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log(`✅ Emails enviados com sucesso: ${successCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log(`📊 Total de clippers: ${allRecipients.length}`);
    console.log(`🏆 Campanhas ativas: ${activeCampaigns.length}`);
    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ Erro geral:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

