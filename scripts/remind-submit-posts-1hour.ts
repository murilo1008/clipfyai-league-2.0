import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";
import * as dotenv from "dotenv";

// Carregar variáveis de ambiente
dotenv.config();

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);

// Template do email
function getReminderEmailTemplate(clipperName: string) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>⏰ ÚLTIMA HORA - Envie seus posts AGORA!</title>
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

    <!-- Banner URGENTE -->
    <div style="background: linear-gradient(135deg, #FF0000 0%, #FF4400 100%); border: 3px solid #FF0000; padding: 32px 24px; border-radius: 16px; margin: 0 16px 32px; text-align: center; box-shadow: 0 0 40px rgba(255, 0, 0, 0.5); animation: pulse 2s infinite;">
      <h1 style="margin: 0; font-size: 42px; font-weight: 900; color: #FFFFFF; line-height: 1.2; letter-spacing: -0.5px; text-transform: uppercase; text-shadow: 0 0 20px rgba(255, 0, 0, 0.8);">
        ⏰ ÚLTIMA HORA! ⏰
      </h1>
      <p style="margin: 16px 0 0; font-size: 24px; font-weight: 900; color: #FFFF00; text-transform: uppercase; text-shadow: 0 0 10px rgba(255, 255, 0, 0.8);">
        MENOS DE 1 HORA RESTANTE!
      </p>
    </div>

    <!-- Saudação -->
    <div style="padding: 0 24px 32px;">
      <p style="margin: 0 0 24px 0; font-size: 18px; line-height: 1.6; color: #ffffff;">
        Olá, <strong style="color: #14F7FF;">${clipperName}</strong>! 👋
      </p>

      <!-- Alerta Vermelho -->
      <div style="background: rgba(255, 0, 0, 0.15); border: 3px solid #FF0000; border-radius: 12px; padding: 24px; margin-bottom: 32px; box-shadow: 0 0 30px rgba(255, 0, 0, 0.3);">
        <div style="text-align: center; margin-bottom: 16px;">
          <span style="font-size: 64px; line-height: 1;">⚠️</span>
        </div>
        <h2 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 900; color: #FF0000; text-align: center; text-transform: uppercase;">
          ATENÇÃO: DEADLINE EM 1 HORA!
        </h2>
        <p style="margin: 0 0 16px 0; font-size: 18px; line-height: 1.6; color: #ffffff; text-align: center; font-weight: 700;">
          O prazo para enviar seus posts termina em <span style="color: #FF0000; font-size: 24px; font-weight: 900;">MENOS DE 1 HORA</span>!
        </p>
        <div style="background: #000000; border: 2px solid #FF0000; border-radius: 8px; padding: 16px; margin-top: 20px;">
          <p style="margin: 0; font-size: 32px; font-weight: 900; color: #FF0000; text-align: center; font-family: monospace;">
            22:00 HOJE
          </p>
          <p style="margin: 8px 0 0; font-size: 14px; color: #999999; text-align: center;">
            Posts enviados após este horário contarão para o dia seguinte
          </p>
        </div>
      </div>

      <!-- Instruções Urgentes -->
      <div style="background: #111111; border: 2px solid #FF4400; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #FF4400;">
          🚨 AÇÃO IMEDIATA NECESSÁRIA
        </h2>
        <ul style="margin: 0; padding: 0 0 0 20px; list-style-type: none;">
          <li style="margin-bottom: 12px; font-size: 16px; line-height: 1.6; color: #ffffff; position: relative; padding-left: 24px; font-weight: 600;">
            <span style="position: absolute; left: 0; color: #FF0000; font-size: 20px;">⚡</span>
            <strong style="color: #FF4400;">ENVIE SEUS POSTS AGORA</strong> - não deixe para o último minuto!
          </li>
          <li style="margin-bottom: 12px; font-size: 16px; line-height: 1.6; color: #ffffff; position: relative; padding-left: 24px; font-weight: 600;">
            <span style="position: absolute; left: 0; color: #FF0000; font-size: 20px;">⚡</span>
            <strong style="color: #FF4400;">APENAS POSTS SUBMETIDOS NA PLATAFORMA CONTAM</strong>
          </li>
          <li style="margin-bottom: 12px; font-size: 16px; line-height: 1.6; color: #ffffff; position: relative; padding-left: 24px; font-weight: 600;">
            <span style="position: absolute; left: 0; color: #FF0000; font-size: 20px;">⚡</span>
            <strong style="color: #FF4400;">Após 22:00h</strong>, os posts contarão para o ranking de amanhã
          </li>
          <li style="margin: 0; font-size: 16px; line-height: 1.6; color: #ffffff; position: relative; padding-left: 24px; font-weight: 600;">
            <span style="position: absolute; left: 0; color: #FF0000; font-size: 20px;">⚡</span>
            <strong style="color: #FF4400;">Não perca a chance de pontuar hoje!</strong>
          </li>
        </ul>
      </div>

      <!-- Call to Action GIGANTE -->
      <div style="text-align: center; margin: 40px 0;">
        <p style="margin: 0 0 24px 0; font-size: 22px; font-weight: 900; color: #FF0000; text-transform: uppercase;">
          🔥 CORRA! O TEMPO ESTÁ ACABANDO! 🔥
        </p>
        <a href="https://league.clipfyai.com/my-competitions/tarcisio-de-freitas-novembro" 
           target="_blank" 
           style="display: inline-block; padding: 24px 48px; background: linear-gradient(135deg, #FF0000 0%, #FF4400 100%); color: #FFFFFF; text-decoration: none; border-radius: 16px; font-weight: 900; font-size: 22px; box-shadow: 0 8px 30px rgba(255, 0, 0, 0.5); text-transform: uppercase; border: 3px solid #FFFFFF;">
          ⚡ ENVIAR POSTS AGORA ⚡
        </a>
        <p style="margin: 16px 0 0; font-size: 14px; color: #FF4400; font-weight: 700;">
          ⏰ MENOS DE 1 HORA PARA O DEADLINE!
        </p>
      </div>

      <!-- Aviso Final -->
      <div style="background: rgba(255, 68, 0, 0.1); border: 2px solid #FF4400; border-radius: 12px; padding: 20px; margin: 32px 0;">
        <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #FF4400; text-align: center;">
          ⚠️ ÚLTIMA CHAMADA
        </p>
        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #e0e0e0; text-align: center;">
          Este é o <strong style="color: #FF0000;">ÚLTIMO LEMBRETE</strong>! Após 22:00h, você perde a oportunidade de pontuar no ranking de hoje. <strong style="color: #FF4400;">Não deixe para depois!</strong>
        </p>
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
          <a href="https://league.clipfyai.com" target="_blank" style="color: #14F7FF; text-decoration: none;">league.clipfyai.com</a>
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
    console.log("🚀 Iniciando envio de email de última hora (1h restante)...\n");

    // Buscar TODAS as campanhas ATIVAS
    const campaigns = await prisma.campaign.findMany({
      where: {
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    if (campaigns.length === 0) {
      console.error("❌ Nenhuma campanha ativa encontrada");
      return;
    }

    console.log(`✅ Campanhas ativas encontradas: ${campaigns.length}`);
    campaigns.forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.name}`);
    });

    // Buscar todas as aplicações APROVADAS de TODAS as campanhas ativas
    const allApplications = await prisma.clipperApplication.findMany({
      where: {
        campaignId: {
          in: campaigns.map((c) => c.id),
        },
        status: "APPROVED",
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
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
      orderBy: {
        campaignId: "asc",
      },
    });

    console.log(`\n📊 Total de aplicações aprovadas (todas campanhas): ${allApplications.length}`);

    // Criar um array de recipients - um email por competição que o clipador participa
    const recipients: Array<{
      email: string;
      name: string;
      campaignName: string;
      campaignSlug: string;
    }> = [];

    // Para cada aplicação, adicionar um recipient
    allApplications.forEach((app) => {
      const email = app.clipperProfile.user?.email;
      if (!email) return;

      recipients.push({
        email,
        name: app.clipperProfile.fullName,
        campaignName: app.campaign.name,
        campaignSlug: app.campaign.slug,
      });
    });

    // Adicionar Murilo para CADA competição
    campaigns.forEach((campaign) => {
      recipients.push(
        {
          email: "murilo@clipfyai.com",
          name: "Murilo (Admin)",
          campaignName: campaign.name,
          campaignSlug: campaign.slug,
        },
        {
          email: "murilo.rocha.mattoso@gmail.com",
          name: "Murilo Mattoso (Admin)",
          campaignName: campaign.name,
          campaignSlug: campaign.slug,
        }
      );
    });

    console.log("\n" + "=".repeat(60));
    console.log("📧 ENVIANDO EMAILS INDIVIDUAIS POR COMPETIÇÃO");
    console.log("=".repeat(60));
    console.log(`Total de emails a enviar: ${recipients.length}`);
    console.log(`  - Aplicações aprovadas: ${allApplications.length}`);
    console.log(`  - Emails adicionais: ${campaigns.length * 2} (Murilo x2 por competição)`);
    console.log(`  - Competições ativas: ${campaigns.length}`);
    console.log("=".repeat(60));
    console.log();

    let successCount = 0;
    let errorCount = 0;

    // Enviar um email por competição
    for (const recipient of recipients) {
      try {
        const emailHtml = getReminderEmailTemplate(recipient.name);

        const result = await resend.emails.send({
          from: "ClipfyAI League <noreply@league.clipfyai.com>",
          to: recipient.email,
          subject: `⏰ ÚLTIMA HORA! Menos de 1h para enviar seus posts - ${recipient.campaignName}`,
          html: emailHtml,
        });

        console.log(
          `✅ ${recipient.email} | ${recipient.campaignName} (ID: ${result.data?.id})`
        );
        successCount++;

        // Delay para não sobrecarregar a API
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error: any) {
        console.error(`❌ Erro ao enviar para ${recipient.email} (${recipient.campaignName}):`, error.message);
        errorCount++;
      }
    }

    // Resumo por competição
    console.log("\n" + "=".repeat(60));
    console.log("📊 RESUMO POR COMPETIÇÃO");
    console.log("=".repeat(60));
    campaigns.forEach((campaign) => {
      const campaignEmails = recipients.filter((r) => r.campaignName === campaign.name);
      const clipperEmails = campaignEmails.filter(
        (r) => !r.email.includes("murilo")
      ).length;
      console.log(
        `${campaign.name}: ${campaignEmails.length} emails (${clipperEmails} clippers + 2 admin)`
      );
    });

    console.log("\n" + "=".repeat(60));
    console.log("📈 RESULTADO FINAL");
    console.log("=".repeat(60));
    console.log(`✅ Emails enviados com sucesso: ${successCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log(`📊 Total processado: ${recipients.length}`);
    console.log(`🏆 Competições: ${campaigns.length}`);
    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ Erro geral:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();


