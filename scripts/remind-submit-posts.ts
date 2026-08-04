import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);

function getSubmitPostsReminderEmailTemplate(clipperName: string, campaignName: string) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>⚠️ URGENTE: Submeta seus Posts AGORA!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%); padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Container Principal -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 255, 255, 0.3);">
          
          <!-- Header com Alerta -->
          <tr>
            <td style="background: linear-gradient(135deg, #ff3b3b 0%, #ff6b6b 100%); padding: 30px; text-align: center; position: relative;">
              <div style="background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border-radius: 16px; padding: 20px; border: 2px solid rgba(255, 255, 255, 0.2);">
                <div style="font-size: 64px; margin-bottom: 10px;">⚠️</div>
                <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 900; text-shadow: 0 4px 12px rgba(0, 0, 0, 0.5); letter-spacing: -0.5px;">
                  ATENÇÃO URGENTE!
                </h1>
                <p style="margin: 12px 0 0 0; color: #ffffff; font-size: 18px; font-weight: 600; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);">
                  Prazo Final: HOJE às 22:00h
                </p>
              </div>
            </td>
          </tr>

          <!-- Saudação -->
          <tr>
            <td style="padding: 40px 40px 20px 40px;">
              <h2 style="margin: 0 0 20px 0; color: #00ffff; font-size: 28px; font-weight: 800; text-shadow: 0 0 20px rgba(0, 255, 255, 0.5);">
                Olá, ${clipperName}! 👋
              </h2>
              <p style="margin: 0; color: #e0e0e0; font-size: 18px; line-height: 1.8; font-weight: 500;">
                Este é um <strong style="color: #ff6b6b;">LEMBRETE URGENTE</strong> sobre a competição:
              </p>
            </td>
          </tr>

          <!-- Nome da Competição -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <div style="background: linear-gradient(135deg, rgba(0, 255, 255, 0.15) 0%, rgba(0, 255, 157, 0.15) 100%); border: 2px solid rgba(0, 255, 255, 0.3); border-radius: 16px; padding: 24px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 12px;">🏆</div>
                <h3 style="margin: 0; color: #00ff9d; font-size: 26px; font-weight: 800; text-shadow: 0 0 20px rgba(0, 255, 157, 0.5);">
                  ${campaignName}
                </h3>
              </div>
            </td>
          </tr>

          <!-- Aviso Principal -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <div style="background: linear-gradient(135deg, rgba(255, 59, 59, 0.2) 0%, rgba(255, 107, 107, 0.2) 100%); border: 3px solid rgba(255, 59, 59, 0.5); border-radius: 16px; padding: 32px;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <div style="font-size: 56px; margin-bottom: 12px;">⏰</div>
                  <h3 style="margin: 0; color: #ff6b6b; font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">
                    PRAZO FINAL: HOJE ÀS 22:00H
                  </h3>
                </div>
                
                <div style="background: rgba(0, 0, 0, 0.3); border-radius: 12px; padding: 24px; margin-top: 20px;">
                  <p style="margin: 0 0 16px 0; color: #ffffff; font-size: 18px; line-height: 1.8; font-weight: 600; text-align: center;">
                    📢 <strong style="color: #00ffff;">ATENÇÃO:</strong> Você precisa <strong style="color: #00ff9d;">SUBMETER TODOS OS SEUS POSTS</strong> na plataforma até as 22h de hoje!
                  </p>
                  
                  <div style="background: rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 16px; margin-top: 16px; border-left: 4px solid #ff6b6b;">
                    <p style="margin: 0; color: #ffffff; font-size: 16px; line-height: 1.7;">
                      ⚠️ <strong>IMPORTANTE:</strong> Apenas os posts que você <strong style="color: #00ff9d;">SUBMETER NA PLATAFORMA</strong> serão contabilizados para o ranking e premiação!
                    </p>
                  </div>
                </div>
              </div>
            </td>
          </tr>

          <!-- Regras Importantes -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <div style="background: linear-gradient(135deg, rgba(0, 255, 255, 0.1) 0%, rgba(0, 255, 157, 0.1) 100%); border: 2px solid rgba(0, 255, 255, 0.3); border-radius: 16px; padding: 28px;">
                <h3 style="margin: 0 0 20px 0; color: #00ffff; font-size: 22px; font-weight: 800; text-align: center;">
                  📋 Regras Importantes:
                </h3>
                
                <div style="margin-bottom: 16px;">
                  <div style="display: inline-block; background: linear-gradient(135deg, #00ffff 0%, #00ff9d 100%); border-radius: 50%; width: 32px; height: 32px; text-align: center; line-height: 32px; margin-right: 12px; vertical-align: middle;">
                    <span style="color: #0a0a0a; font-weight: 900; font-size: 18px;">1</span>
                  </div>
                  <span style="color: #e0e0e0; font-size: 16px; line-height: 1.8; vertical-align: middle;">
                    <strong style="color: #00ffff;">Submeta na Plataforma:</strong> Postar nas redes sociais NÃO é suficiente! Você precisa <strong style="color: #00ff9d;">submeter o link do post na plataforma Clipfy League</strong>.
                  </span>
                </div>
                
                <div style="margin-bottom: 16px;">
                  <div style="display: inline-block; background: linear-gradient(135deg, #00ffff 0%, #00ff9d 100%); border-radius: 50%; width: 32px; height: 32px; text-align: center; line-height: 32px; margin-right: 12px; vertical-align: middle;">
                    <span style="color: #0a0a0a; font-weight: 900; font-size: 18px;">2</span>
                  </div>
                  <span style="color: #e0e0e0; font-size: 16px; line-height: 1.8; vertical-align: middle;">
                    <strong style="color: #00ffff;">Prazo Limite:</strong> Posts submetidos <strong style="color: #ff6b6b;">APÓS as 22:00h de hoje</strong> NÃO serão contabilizados para o ranking de hoje.
                  </span>
                </div>
                
                <div style="margin-bottom: 16px;">
                  <div style="display: inline-block; background: linear-gradient(135deg, #00ffff 0%, #00ff9d 100%); border-radius: 50%; width: 32px; height: 32px; text-align: center; line-height: 32px; margin-right: 12px; vertical-align: middle;">
                    <span style="color: #0a0a0a; font-weight: 900; font-size: 18px;">3</span>
                  </div>
                  <span style="color: #e0e0e0; font-size: 16px; line-height: 1.8; vertical-align: middle;">
                    <strong style="color: #00ffff;">Vídeos Publicados Tarde:</strong> Se você publicou um vídeo nas redes sociais <strong>após as 22:00h</strong>, ele será contabilizado para o <strong style="color: #00ff9d;">ranking do dia seguinte</strong>.
                  </span>
                </div>
                
                <div>
                  <div style="display: inline-block; background: linear-gradient(135deg, #00ffff 0%, #00ff9d 100%); border-radius: 50%; width: 32px; height: 32px; text-align: center; line-height: 32px; margin-right: 12px; vertical-align: middle;">
                    <span style="color: #0a0a0a; font-weight: 900; font-size: 18px;">4</span>
                  </div>
                  <span style="color: #e0e0e0; font-size: 16px; line-height: 1.8; vertical-align: middle;">
                    <strong style="color: #00ffff;">Todos os Posts:</strong> Submeta <strong style="color: #00ff9d;">TODOS</strong> os seus posts válidos! Quanto mais posts, maiores suas chances de ganhar!
                  </span>
                </div>
              </div>
            </td>
          </tr>

          <!-- CTA Principal -->
          <tr>
            <td style="padding: 0 40px 40px 40px; text-align: center;">
              <div style="margin-bottom: 24px;">
                <a href="https://league.clipfyai.com" style="display: inline-block; background: linear-gradient(135deg, #00ffff 0%, #00ff9d 100%); color: #0a0a0a; text-decoration: none; padding: 20px 48px; border-radius: 16px; font-weight: 900; font-size: 20px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 8px 24px rgba(0, 255, 255, 0.4); transition: all 0.3s ease;">
                  🚀 SUBMETER POSTS AGORA
                </a>
              </div>
              <p style="margin: 20px 0 0 0; color: #888; font-size: 14px; line-height: 1.6;">
                Não perca tempo! Acesse a plataforma e submeta seus posts antes das 22:00h!
              </p>
            </td>
          </tr>

          <!-- Countdown Visual -->
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <div style="background: linear-gradient(135deg, rgba(255, 59, 59, 0.2) 0%, rgba(255, 107, 107, 0.1) 100%); border: 2px dashed rgba(255, 107, 107, 0.5); border-radius: 16px; padding: 24px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 12px;">⏱️</div>
                <p style="margin: 0; color: #ff6b6b; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">
                  O TEMPO ESTÁ ACABANDO!
                </p>
                <p style="margin: 12px 0 0 0; color: #e0e0e0; font-size: 16px;">
                  Não deixe para a última hora! Submeta seus posts agora mesmo!
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: rgba(0, 0, 0, 0.3); padding: 32px 40px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.1);">
              <div style="margin-bottom: 20px;">
                <img src="https://league.clipfyai.com/images/logo-clipfy-white.svg" alt="Clipfy League" style="height: 32px; display: inline-block;">
              </div>
              <p style="margin: 0 0 16px 0; color: #888; font-size: 14px; line-height: 1.6;">
                Precisa de ajuda? Entre em contato com nosso suporte.
              </p>
              <div style="margin-top: 20px;">
                <a href="https://league.clipfyai.com" style="color: #00ffff; text-decoration: none; font-size: 14px; margin: 0 12px;">🌐 Acessar Plataforma</a>
                <span style="color: #444; margin: 0 8px;">|</span>
                <a href="https://league.clipfyai.com/rules" style="color: #00ffff; text-decoration: none; font-size: 14px; margin: 0 12px;">📖 Ver Regras</a>
              </div>
              <p style="margin: 24px 0 0 0; color: #666; font-size: 12px; line-height: 1.6;">
                © ${new Date().getFullYear()} Clipfy League. Todos os direitos reservados.<br>
                Este é um email automático, por favor não responda.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

async function main() {
  try {
    console.log("🔍 Buscando competição do Tarcísio...");

    // Buscar a campanha
    const campaign = await prisma.campaign.findFirst({
      where: {
        OR: [
          { name: { contains: "Tarcísio", mode: "insensitive" } },
          { name: { contains: "Tarcisio", mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!campaign) {
      console.error("❌ Campanha do Tarcísio não encontrada!");
      return;
    }

    console.log(`✅ Campanha encontrada: ${campaign.name} (ID: ${campaign.id})`);

    // Buscar todos os clipadores aprovados nesta campanha
    const applications = await prisma.clipperApplication.findMany({
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

    console.log(`\n📊 Total de clipadores aprovados: ${applications.length}`);

    if (applications.length === 0) {
      console.log("⚠️ Nenhum clipador aprovado encontrado!");
      return;
    }

    // Primeiro enviar para murilo@clipfyai.com
    console.log("\n📧 Enviando email de teste para murilo@clipfyai.com...");

    const testEmail = await resend.emails.send({
      from: "Clipfy League <noreply@league.clipfyai.com>",
      to: ["murilo@clipfyai.com"],
      subject: "⚠️ URGENTE: Prazo Final às 22h - Submeta seus Posts AGORA!",
      html: getSubmitPostsReminderEmailTemplate("Murilo (TESTE)", campaign.name),
    });

    console.log("✅ Email de teste enviado com sucesso!");
    if (testEmail.data?.id) {
      console.log(`   ID: ${testEmail.data.id}`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("📝 RESUMO:");
    console.log("=".repeat(60));
    console.log(`Campanha: ${campaign.name}`);
    console.log(`Clipadores aprovados: ${applications.length}`);
    console.log(`Email de teste enviado para: murilo@clipfyai.com`);
    console.log("\n⚠️  AGUARDANDO CONFIRMAÇÃO PARA ENVIAR PARA TODOS!");
    console.log("=".repeat(60));

    // Preparar lista de emails para envio em massa (comentado)
    const clippersWithEmail = applications.filter(
      (app) => app.clipperProfile.user?.email
    );

    console.log(`\n💡 Clipadores com email válido: ${clippersWithEmail.length}`);
    console.log("\n📋 Lista de emails:");
    clippersWithEmail.forEach((app, index) => {
      const name = app.clipperProfile.artisticName || app.clipperProfile.fullName;
      const email = app.clipperProfile.user?.email;
      console.log(`   ${index + 1}. ${name} - ${email}`);
    });

    console.log("\n✅ Script concluído! Verifique o email de teste.");
    console.log("   Para enviar para todos, descomente o código no script.\n");

  } catch (error) {
    console.error("❌ Erro ao executar script:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

