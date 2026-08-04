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
  <title>🚨 MENOS DE 3 HORAS: Submeta seus Posts AGORA!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%); padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Container Principal -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px rgba(255, 0, 0, 0.4);">
          
          <!-- Header com Alerta CRÍTICO -->
          <tr>
            <td style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); padding: 30px; text-align: center; position: relative;">
              <div style="background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border-radius: 16px; padding: 20px; border: 2px solid rgba(255, 255, 255, 0.3); animation: pulse 2s infinite;">
                <div style="font-size: 72px; margin-bottom: 10px;">🚨</div>
                <h1 style="margin: 0; color: #ffffff; font-size: 36px; font-weight: 900; text-shadow: 0 4px 12px rgba(0, 0, 0, 0.5); letter-spacing: -0.5px; text-transform: uppercase;">
                  MENOS DE 3 HORAS!
                </h1>
                <p style="margin: 12px 0 0 0; color: #ffffff; font-size: 20px; font-weight: 700; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);">
                  Prazo Final: HOJE às 22:00h
                </p>
              </div>
            </td>
          </tr>

          <!-- Saudação -->
          <tr>
            <td style="padding: 40px 40px 20px 40px;">
              <h2 style="margin: 0 0 20px 0; color: #00ffff; font-size: 28px; font-weight: 800; text-shadow: 0 0 20px rgba(0, 255, 255, 0.5);">
                ${clipperName}! ⏰
              </h2>
              <p style="margin: 0; color: #e0e0e0; font-size: 18px; line-height: 1.8; font-weight: 600;">
                <strong style="color: #ef4444;">URGENTE!</strong> Faltam <strong style="color: #00ff9d; font-size: 20px;">MENOS DE 3 HORAS</strong> para o prazo final!
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

          <!-- Contador Regressivo Visual -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <div style="background: linear-gradient(135deg, rgba(220, 38, 38, 0.3) 0%, rgba(239, 68, 68, 0.3) 100%); border: 3px solid rgba(220, 38, 38, 0.6); border-radius: 16px; padding: 32px;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <div style="font-size: 64px; margin-bottom: 16px; animation: shake 0.5s infinite;">⏰</div>
                  <h3 style="margin: 0 0 12px 0; color: #ef4444; font-size: 32px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">
                    MENOS DE 3 HORAS!
                  </h3>
                  <p style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">
                    Prazo termina às <span style="color: #00ff9d; font-size: 28px;">22:00h</span>
                  </p>
                </div>
                
                <div style="background: rgba(0, 0, 0, 0.4); border-radius: 12px; padding: 28px; margin-top: 20px; border: 2px solid rgba(239, 68, 68, 0.5);">
                  <p style="margin: 0 0 20px 0; color: #ffffff; font-size: 20px; line-height: 1.8; font-weight: 700; text-align: center;">
                    🚨 <strong style="color: #ef4444;">AÇÃO IMEDIATA NECESSÁRIA!</strong>
                  </p>
                  
                  <p style="margin: 0 0 16px 0; color: #ffffff; font-size: 18px; line-height: 1.8; font-weight: 600; text-align: center;">
                    📢 Você precisa <strong style="color: #00ff9d;">SUBMETER TODOS OS SEUS POSTS</strong> na plataforma <strong style="color: #ef4444;">AGORA</strong>!
                  </p>
                  
                  <div style="background: rgba(239, 68, 68, 0.2); border-radius: 8px; padding: 20px; margin-top: 20px; border-left: 4px solid #ef4444;">
                    <p style="margin: 0; color: #ffffff; font-size: 17px; line-height: 1.7; font-weight: 600;">
                      ⚠️ <strong>CRÍTICO:</strong> Posts submetidos <strong style="color: #ef4444;">APÓS AS 22:00h</strong> serão contabilizados apenas para o <strong style="color: #00ffff;">DIA SEGUINTE</strong>!
                    </p>
                  </div>
                </div>
              </div>
            </td>
          </tr>

          <!-- Instruções de Ação -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <div style="background: linear-gradient(135deg, rgba(0, 255, 255, 0.1) 0%, rgba(0, 255, 157, 0.1) 100%); border: 2px solid rgba(0, 255, 255, 0.3); border-radius: 16px; padding: 28px;">
                <h3 style="margin: 0 0 24px 0; color: #00ffff; font-size: 24px; font-weight: 800; text-align: center;">
                  ⚡ O QUE FAZER AGORA:
                </h3>
                
                <div style="margin-bottom: 20px;">
                  <div style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 50%; width: 36px; height: 36px; text-align: center; line-height: 36px; margin-right: 12px; vertical-align: middle; font-weight: 900; color: #ffffff; font-size: 18px;">
                    1
                  </div>
                  <span style="color: #e0e0e0; font-size: 17px; font-weight: 600; line-height: 1.7;">
                    Acesse a plataforma <strong style="color: #00ff9d;">IMEDIATAMENTE</strong>
                  </span>
                </div>
                
                <div style="margin-bottom: 20px;">
                  <div style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 50%; width: 36px; height: 36px; text-align: center; line-height: 36px; margin-right: 12px; vertical-align: middle; font-weight: 900; color: #ffffff; font-size: 18px;">
                    2
                  </div>
                  <span style="color: #e0e0e0; font-size: 17px; font-weight: 600; line-height: 1.7;">
                    Vá para a aba <strong style="color: #00ffff;">"Meus Posts"</strong>
                  </span>
                </div>
                
                <div style="margin-bottom: 20px;">
                  <div style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 50%; width: 36px; height: 36px; text-align: center; line-height: 36px; margin-right: 12px; vertical-align: middle; font-weight: 900; color: #ffffff; font-size: 18px;">
                    3
                  </div>
                  <span style="color: #e0e0e0; font-size: 17px; font-weight: 600; line-height: 1.7;">
                    Clique em <strong style="color: #00ff9d;">"Enviar Post"</strong>
                  </span>
                </div>
                
                <div>
                  <div style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 50%; width: 36px; height: 36px; text-align: center; line-height: 36px; margin-right: 12px; vertical-align: middle; font-weight: 900; color: #ffffff; font-size: 18px;">
                    4
                  </div>
                  <span style="color: #e0e0e0; font-size: 17px; font-weight: 600; line-height: 1.7;">
                    Cole os links dos seus vídeos <strong style="color: #ef4444;">ANTES DAS 22h</strong>
                  </span>
                </div>
              </div>
            </td>
          </tr>

          <!-- Aviso Final -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <div style="background: rgba(239, 68, 68, 0.15); border: 2px dashed rgba(239, 68, 68, 0.5); border-radius: 12px; padding: 24px; text-align: center;">
                <p style="margin: 0 0 12px 0; color: #ef4444; font-size: 20px; font-weight: 800; text-transform: uppercase;">
                  ⚠️ NÃO PERCA SEUS PONTOS!
                </p>
                <p style="margin: 0; color: #e0e0e0; font-size: 16px; line-height: 1.7; font-weight: 600;">
                  Apenas posts <strong style="color: #00ff9d;">submetidos na plataforma</strong> contam para o ranking e premiação!
                </p>
              </div>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 40px 40px 40px; text-align: center;">
              <a href="https://league.clipfyai.com/my-competitions" style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #ffffff; text-decoration: none; padding: 20px 50px; border-radius: 16px; font-weight: 900; font-size: 20px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 8px 24px rgba(239, 68, 68, 0.4); transition: all 0.3s ease;">
                🚀 SUBMETER POSTS AGORA
              </a>
              <p style="margin: 16px 0 0 0; color: #9ca3af; font-size: 14px;">
                Faltam menos de 3 horas para o prazo final!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background: rgba(0, 0, 0, 0.3); border-top: 1px solid rgba(255, 255, 255, 0.1);">
              <p style="margin: 0; color: #9ca3af; font-size: 14px; line-height: 1.6; text-align: center;">
                📧 Você está recebendo este email porque está participando ativamente da competição <strong style="color: #00ffff;">${campaignName}</strong>
              </p>
              <p style="margin: 16px 0 0 0; color: #6b7280; font-size: 13px; text-align: center;">
                © 2024 Clipfy League. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

async function main() {
  try {
    console.log("🚀 Iniciando script de lembrete de submissão de posts (3 HORAS) - TODAS AS COMPETIÇÕES...\n");

    // Buscar TODAS as campanhas ATIVAS
    const campaigns = await prisma.campaign.findMany({
      where: {
        status: "ACTIVE",
      },
    });

    if (campaigns.length === 0) {
      console.log("⚠️  Nenhuma campanha ativa encontrada!");
      return;
    }

    console.log(`✅ ${campaigns.length} campanha(s) ativa(s) encontrada(s):`);
    campaigns.forEach((camp, index) => {
      console.log(`   ${index + 1}. ${camp.name} (ID: ${camp.id})`);
    });
    console.log();

    // Buscar todas as aplicações aprovadas de TODAS as campanhas ativas
    const allApplications = await prisma.clipperApplication.findMany({
      where: {
        campaignId: {
          in: campaigns.map(c => c.id),
        },
        status: "APPROVED",
      },
      include: {
        campaign: {
          select: {
            name: true,
          },
        },
        clipperProfile: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    console.log(`📊 Total de aplicações aprovadas (todas as campanhas): ${allApplications.length}\n`);

    if (allApplications.length === 0) {
      console.log("⚠️  Nenhuma aplicação aprovada encontrada!");
      return;
    }

    // Preparar lista de destinatários (um email por competição)
    const recipients = [
      ...allApplications
        .filter(app => app.clipperProfile.user.email)
        .map(app => ({
          name: app.clipperProfile.artisticName || app.clipperProfile.fullName || app.clipperProfile.user.name || "Clipador",
          email: app.clipperProfile.user.email,
          campaignName: app.campaign.name,
        })),
      // Adicionar Murilo para cada competição
      ...campaigns.map(camp => ({
        name: "Murilo (Clipfy)",
        email: "murilo@clipfyai.com",
        campaignName: camp.name,
      })),
      ...campaigns.map(camp => ({
        name: "Murilo Rocha",
        email: "murilo.rocha.mattoso@gmail.com",
        campaignName: camp.name,
      })),
    ];

    console.log("=" .repeat(60));
    console.log("📧 ENVIANDO EMAILS INDIVIDUAIS POR COMPETIÇÃO");
    console.log("=" .repeat(60));
    console.log(`Total de emails a enviar: ${recipients.length}`);
    console.log(`  - Aplicações aprovadas: ${allApplications.length}`);
    console.log(`  - Emails adicionais: ${campaigns.length * 2} (Murilo x2 por competição)`);
    console.log(`  - Competições ativas: ${campaigns.length}`);
    console.log("=" .repeat(60));
    console.log();

    console.log(`\n📧 Enviando emails para ${recipients.length} destinatários...\n`);

    let successCount = 0;
    let errorCount = 0;

    // Enviar emails individualmente com delay
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      
      if (!recipient) continue;
      
      try {
        const result = await resend.emails.send({
          from: "Clipfy League <noreply@league.clipfyai.com>",
          to: [recipient.email],
          subject: `🚨 MENOS DE 3 HORAS: Submeta seus Posts até 22h - ${recipient.campaignName}!`,
          html: getSubmitPostsReminderEmailTemplate(recipient.name, recipient.campaignName),
        });

        successCount++;
        console.log(`✅ [${i + 1}/${recipients.length}] Email enviado para: ${recipient.name} (${recipient.email}) - ${recipient.campaignName}`);

        // Delay de 100ms entre emails para evitar rate limit
        if (i < recipients.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error: any) {
        errorCount++;
        console.error(`❌ [${i + 1}/${recipients.length}] Erro ao enviar para ${recipient.name} (${recipient.email}):`, error.message);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📝 RESUMO FINAL:");
    console.log("=".repeat(60));
    console.log(`✅ Emails enviados com sucesso: ${successCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log(`📊 Total de destinatários únicos: ${recipients.length}`);
    console.log(`🏆 Competições ativas processadas: ${campaigns.length}`);
    campaigns.forEach((camp, index) => {
      const campClippers = allApplications.filter(app => app.campaignId === camp.id).length;
      console.log(`   ${index + 1}. ${camp.name}: ${campClippers} clipador(es)`);
    });
    console.log("=".repeat(60));
    console.log("\n✅ Script finalizado com sucesso!");

  } catch (error) {
    console.error("❌ Erro ao executar o script:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

