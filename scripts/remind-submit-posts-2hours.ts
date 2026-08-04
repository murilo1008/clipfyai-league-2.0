import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";
import dotenv from "dotenv";

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
  <title>⏰ MENOS DE 2 HORAS - Deadline 22h!</title>
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

    <!-- Banner Principal - URGENTE -->
    <div style="background: linear-gradient(135deg, #FF0000 0%, #FF6B00 100%); border: 3px solid #FF0000; padding: 32px 24px; border-radius: 16px; margin: 0 16px 32px; text-align: center; box-shadow: 0 0 40px rgba(255, 0, 0, 0.4); animation: pulse 2s infinite;">
      <div style="font-size: 48px; margin-bottom: 12px;">⏰</div>
      <h1 style="margin: 0; font-size: 32px; font-weight: 900; color: #FFFFFF; line-height: 1.2; letter-spacing: -0.5px; text-transform: uppercase;">
        MENOS DE 2 HORAS!
      </h1>
      <p style="margin: 16px 0 0; font-size: 18px; font-weight: 700; color: #FFFFFF;">
        Olá, ${clipperName}!
      </p>
    </div>

    <!-- Conteúdo Principal -->
    <div style="padding: 0 24px 32px;">
      
      <!-- Aviso Crítico -->
      <div style="background: rgba(255, 0, 0, 0.15); border: 2px solid #FF0000; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <div style="font-size: 32px;">🚨</div>
          <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #FF0000;">
            ATENÇÃO: DEADLINE ÀS 22:00H
          </h2>
        </div>
        <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
          <strong style="color: #FF0000;">Faltam menos de 2 horas</strong> para o encerramento do prazo de submissão de posts de hoje!
        </p>
      </div>

      <!-- Informações Importantes -->
      <div style="background: #111111; border: 1px solid #333333; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #14F7FF;">
          ⚡ Informações Importantes
        </h2>
        <ul style="margin: 0; padding: 0 0 0 20px; list-style-type: none;">
          <li style="margin-bottom: 12px; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #FF0000; font-weight: bold;">⚠️</span>
            <strong style="color: #FF0000;">Posts enviados após 22:00h serão contabilizados apenas amanhã</strong>
          </li>
          <li style="margin-bottom: 12px; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F;">✓</span>
            Apenas <strong style="color: #14F7FF;">posts submetidos na plataforma</strong> contam para o ranking
          </li>
          <li style="margin-bottom: 12px; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F;">✓</span>
            O ranking diário é calculado com base nos <strong style="color: #14F7FF;">posts de hoje</strong>
          </li>
          <li style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F;">✓</span>
            Você pode enviar <strong style="color: #14F7FF;">múltiplos posts</strong> até o deadline
          </li>
        </ul>
      </div>

      <!-- Horário Limite -->
      <div style="background: linear-gradient(135deg, #14F7FF 0%, #37FF9F 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
        <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #000000; text-transform: uppercase; letter-spacing: 1px;">
          🕐 Horário Limite
        </p>
        <p style="margin: 0; font-size: 48px; font-weight: 900; color: #000000; line-height: 1;">
          22:00h
        </p>
        <p style="margin: 8px 0 0 0; font-size: 14px; font-weight: 600; color: #000000;">
          (Horário de Brasília)
        </p>
      </div>

      <!-- Call to Action Principal -->
      <div style="text-align: center; margin: 32px 0;">
        <p style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #ffffff;">
          ⚡ Não perca tempo! Envie seus posts agora!
        </p>
        <a href="https://league.clipfyai.com/my-competitions/tarcisio-de-freitas-novembro" 
           target="_blank" 
           style="display: inline-block; padding: 18px 36px; background: linear-gradient(135deg, #FF0000 0%, #FF6B00 100%); color: #FFFFFF; text-decoration: none; border-radius: 12px; font-weight: 800; font-size: 16px; box-shadow: 0 4px 20px rgba(255, 0, 0, 0.4); transition: transform 0.2s; text-transform: uppercase;">
          🚀 SUBMETER POSTS AGORA
        </a>
      </div>

      <!-- Lembrete Final -->
      <div style="background: rgba(20, 247, 255, 0.1); border: 1px solid #14F7FF; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #14F7FF;">
          💡 Lembrete Final
        </p>
        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #e0e0e0;">
          Quanto mais posts você submeter dentro do prazo, maiores suas chances de conquistar prêmios diários e mensais! 💰
        </p>
      </div>

      <!-- Premiação -->
      <div style="background: #111111; border: 1px solid #FFD700; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <div style="text-align: center; margin-bottom: 16px;">
          <span style="font-size: 40px;">🏆</span>
        </div>
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #FFD700; text-align: center;">
          Premiação Total: R$ 50.000
        </h2>
        <div style="text-align: center;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #e0e0e0;">
            <strong style="color: #14F7FF;">Diária:</strong> R$ 1.000/dia (Top 15)
          </p>
          <p style="margin: 0; font-size: 14px; color: #e0e0e0;">
            <strong style="color: #14F7FF;">Mensal:</strong> R$ 20.000 (Top 10)
          </p>
        </div>
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
    console.log("🚀 Iniciando envio de lembretes urgentes (MENOS DE 2 HORAS)...\n");

    // Buscar a campanha "Tarcísio De Freitas - Novembro"
    const campaign = await prisma.campaign.findFirst({
      where: {
        name: {
          contains: "Tarcísio",
        },
      },
    });

    if (!campaign) {
      console.log("❌ Campanha não encontrada");
      return;
    }

    console.log(`✅ Campanha encontrada: ${campaign.name}`);
    console.log(`📅 ID: ${campaign.id}\n`);

    // Buscar todos os clippers aprovados na campanha
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
              },
            },
          },
        },
      },
    });

    console.log(`👥 ${approvedApplications.length} clippers aprovados encontrados\n`);

    // Adicionar murilo@clipfyai.com
    const recipients = [
      ...approvedApplications
        .filter((app) => app.clipperProfile.user?.email)
        .map((app) => ({
          email: app.clipperProfile.user!.email!,
          name: app.clipperProfile.fullName,
        })),
      {
        email: "murilo@clipfyai.com",
        name: "Murilo",
      },
    ];

    console.log(`📧 Total de emails a enviar: ${recipients.length}\n`);

    // Enviar emails
    let successCount = 0;
    let errorCount = 0;

    for (const recipient of recipients) {
      if (!recipient) continue;

      try {
        const emailHtml = getReminderEmailTemplate(recipient.name);

        const result = await resend.emails.send({
          from: "ClipfyAI <noreply@league.clipfyai.com>",
          to: recipient.email,
          subject: "⏰ MENOS DE 2 HORAS - Deadline 22h para Posts!",
          html: emailHtml,
        });

        console.log(`✅ Email enviado para ${recipient.name} (${recipient.email}) - ID: ${result.data?.id}`);
        successCount++;

        // Pequeno delay para não sobrecarregar
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error: any) {
        console.error(`❌ Erro ao enviar para ${recipient.name} (${recipient.email}):`, error.message);
        errorCount++;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log(`✅ Emails enviados com sucesso: ${successCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log("=".repeat(50));
  } catch (error) {
    console.error("❌ Erro geral:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

