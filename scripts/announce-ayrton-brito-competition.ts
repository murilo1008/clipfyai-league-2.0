import { Resend } from "resend";
import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

// Carregar variáveis de ambiente
dotenv.config();

// Inicializar Resend e Prisma
const resend = new Resend(process.env.RESEND_API_KEY);
const prisma = new PrismaClient();

// MODO DE TESTE - Alterar para false para enviar para todos
const TEST_MODE = false;
const TEST_EMAIL = "murilo.rocha.mattoso@gmail.com";

// Template de email - COMPETIÇÃO AYRTON BRITO
function getAyrtonBritoAnnouncementTemplate(clipperName: string) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nova Competição: Ayrton Brito - R$ 30.000</title>
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
    <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2d1a3d 100%); border: 4px solid #9b4dff; padding: 32px 24px; border-radius: 16px; margin: 0 16px 32px; text-align: center; box-shadow: 0 0 50px rgba(155, 77, 255, 0.5); position: relative; overflow: hidden;">
      <!-- Efeito de brilho -->
      <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #9b4dff 0%, #14F7FF 50%, #9b4dff 100%); background-size: 200% 100%;"></div>
      
      <div style="background: rgba(155, 77, 255, 0.2); border: 3px solid #9b4dff; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 16px; font-weight: 700; color: #9b4dff; letter-spacing: 1px;">
          Nova Competição
        </p>
        <p style="margin: 12px 0 0; font-size: 42px; font-weight: 800; color: #9b4dff; line-height: 1;">
          Ayrton Brito
        </p>
      </div>

      <h1 style="margin: 0; font-size: 32px; font-weight: 700; color: #14F7FF; line-height: 1.3;">
        Começa hoje às 00:00
      </h1>
      
      <div style="background: linear-gradient(135deg, #9b4dff 0%, #14F7FF 100%); border-radius: 12px; padding: 28px; margin-top: 24px; box-shadow: 0 8px 32px rgba(155, 77, 255, 0.4);">
        <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #000000; text-transform: uppercase; letter-spacing: 2px;">
          💰 PREMIAÇÃO TOTAL
        </p>
        <p style="margin: 0; font-size: 56px; font-weight: 900; color: #000000; line-height: 1; text-shadow: 3px 3px 6px rgba(0,0,0,0.3);">
          R$ 30.000
        </p>
        <p style="margin: 8px 0 0; font-size: 16px; font-weight: 700; color: #000000;">
          R$ 18.000 diários + R$ 12.000 mensais
        </p>
      </div>
    </div>

    <!-- Conteúdo Principal -->
    <div style="padding: 0 24px 32px;">
      
      <!-- Mensagem Principal -->
      <div style="background: linear-gradient(135deg, #9b4dff 0%, #7b3fd4 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center; box-shadow: 0 6px 24px rgba(155, 77, 255, 0.4);">
        <p style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #ffffff;">
          Olá ${clipperName}! 🎯
        </p>
        <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #ffffff; font-weight: 500;">
          A nova competição do <strong style="color: #FFD700;">Ayrton Brito</strong> começa hoje à meia-noite!<br/>
          Prepare seus melhores cortes e participe dessa competição incrível.
        </p>
      </div>

      <!-- Countdown -->
      <div style="background: #000000; border: 3px solid #9b4dff; border-radius: 12px; padding: 28px; margin-bottom: 24px; text-align: center; box-shadow: 0 0 30px rgba(155, 77, 255, 0.2);">
        <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #9b4dff;">
          ⏰ Início da Competição
        </p>
        <p style="margin: 0; font-size: 56px; font-weight: 800; color: #14F7FF; line-height: 1; font-family: 'Courier New', monospace;">
          00:00
        </p>
        <p style="margin: 12px 0 0; font-size: 16px; font-weight: 600; color: #9b4dff;">
          Sexta-feira → Sábado
        </p>
        <p style="margin: 8px 0 0; font-size: 14px; font-weight: 500; color: #e0e0e0;">
          Esteja preparado para postar no horário de início
        </p>
      </div>

      <!-- Sobre Ayrton Brito -->
      <div style="background: #111111; border: 2px solid #14F7FF; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #14F7FF; text-align: center;">
          Sobre Ayrton Brito
        </h2>
        <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0; text-align: center;">
          Ayrton Brito é um dos criadores de conteúdo mais influentes do Brasil.<br/>
          Esta é sua oportunidade de editar os melhores cortes dos vídeos dele e conquistar excelentes premiações.
        </p>
      </div>

      <!-- Estrutura de Premiação -->
      <div style="background: linear-gradient(135deg, #14F7FF 0%, #37FF9F 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 700; color: #000000; text-align: center;">
          💎 Estrutura de Premiação
        </h2>
        
        <div style="display: grid; gap: 16px;">
          <!-- Diário -->
          <div style="background: rgba(0, 0, 0, 0.3); border-radius: 10px; padding: 20px;">
            <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #000000; text-align: center;">
              🏆 PREMIAÇÃO DIÁRIA
            </p>
            <p style="margin: 0 0 12px 0; font-size: 32px; font-weight: 900; color: #000000; text-align: center;">
              R$ 600/dia
            </p>
            <div style="text-align: left; font-size: 13px; color: #000000; font-weight: 600;">
              <p style="margin: 4px 0;">• 1º lugar: R$ 200</p>
              <p style="margin: 4px 0;">• 2º lugar: R$ 100</p>
              <p style="margin: 4px 0;">• 3º lugar: R$ 60</p>
              <p style="margin: 4px 0;">• 4º ao 15º: R$ 20 cada</p>
              <p style="margin: 8px 0 0; font-size: 12px; font-style: italic;">Total mensal: R$ 18.000</p>
            </div>
          </div>
          
          <!-- Mensal -->
          <div style="background: rgba(0, 0, 0, 0.3); border-radius: 10px; padding: 20px;">
            <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #000000; text-align: center;">
              🌟 PREMIAÇÃO MENSAL
            </p>
            <p style="margin: 0 0 12px 0; font-size: 32px; font-weight: 900; color: #000000; text-align: center;">
              R$ 12.000/mês
            </p>
            <div style="text-align: left; font-size: 13px; color: #000000; font-weight: 600;">
              <p style="margin: 4px 0;">• 1º lugar: R$ 4.000</p>
              <p style="margin: 4px 0;">• 2º lugar: R$ 2.500</p>
              <p style="margin: 4px 0;">• 3º lugar: R$ 1.300</p>
              <p style="margin: 4px 0;">• 4º lugar: R$ 900</p>
              <p style="margin: 4px 0;">• 5º lugar: R$ 800</p>
              <p style="margin: 4px 0;">• 6º ao 10º: R$ 700 a R$ 300</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Checklist de Preparação -->
      <div style="background: #111111; border: 2px solid #9b4dff; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 700; color: #9b4dff; text-align: center;">
          Como se preparar
        </h2>
        <ul style="margin: 0; padding: 0; list-style-type: none;">
          <li style="margin-bottom: 16px; padding: 16px; background: rgba(155, 77, 255, 0.1); border-left: 3px solid #9b4dff; border-radius: 8px;">
            <p style="margin: 0; font-size: 15px; font-weight: 600; color: #9b4dff;">
              ✓ Estude o conteúdo
            </p>
            <p style="margin: 4px 0 0; font-size: 14px; color: #e0e0e0;">
              Assista aos vídeos do Ayrton Brito e entenda o estilo dele
            </p>
          </li>
          <li style="margin-bottom: 16px; padding: 16px; background: rgba(155, 77, 255, 0.1); border-left: 3px solid #9b4dff; border-radius: 8px;">
            <p style="margin: 0; font-size: 15px; font-weight: 600; color: #9b4dff;">
              ✓ Prepare seus cortes
            </p>
            <p style="margin: 4px 0 0; font-size: 14px; color: #e0e0e0;">
              Tenha pelo menos 5 cortes editados e prontos para postar
            </p>
          </li>
          <li style="margin-bottom: 16px; padding: 16px; background: rgba(155, 77, 255, 0.1); border-left: 3px solid #9b4dff; border-radius: 8px;">
            <p style="margin: 0; font-size: 15px; font-weight: 600; color: #9b4dff;">
              ✓ Verifique suas contas
            </p>
            <p style="margin: 4px 0 0; font-size: 14px; color: #e0e0e0;">
              Confirme que suas contas de redes sociais estão cadastradas na plataforma
            </p>
          </li>
          <li style="margin: 0; padding: 16px; background: rgba(155, 77, 255, 0.1); border-left: 3px solid #9b4dff; border-radius: 8px;">
            <p style="margin: 0; font-size: 15px; font-weight: 600; color: #9b4dff;">
              ✓ Configure um lembrete
            </p>
            <p style="margin: 4px 0 0; font-size: 14px; color: #e0e0e0;">
              Configure um alarme para não perder o horário de início
            </p>
          </li>
        </ul>
      </div>

      <!-- Call to Action -->
      <div style="text-align: center; margin: 32px 0;">
        <p style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #9b4dff;">
          Acesse a plataforma para participar:
        </p>
        <a href="https://league.clipfyai.com/my-competitions/schedule" 
           target="_blank" 
           style="display: inline-block; padding: 18px 40px; background: linear-gradient(135deg, #9b4dff 0%, #7b3fd4 100%); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 18px; box-shadow: 0 6px 24px rgba(155, 77, 255, 0.4); border: 2px solid #14F7FF;">
          Acessar Plataforma
        </a>
        <p style="margin: 16px 0 0; font-size: 14px; color: #888888; font-weight: 500;">
          A competição começa às 00h - esteja preparado!
        </p>
      </div>

      <!-- Dica Estratégica -->
      <div style="background: rgba(255, 215, 0, 0.1); border: 2px solid #FFD700; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #FFD700;">
          💡 Dica Importante
        </p>
        <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0; font-weight: 500;">
          Clippers que postam logo no início da competição têm maiores chances de se destacar no ranking diário.<br/><br/>
          Configure um alarme para estar pronto no horário de início da competição.
        </p>
      </div>

      <!-- Discord -->
      <div style="background: linear-gradient(135deg, #5865F2 0%, #7289DA 100%); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
        <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #ffffff;">
          💬 Junte-se à comunidade
        </h2>
        <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #ffffff; font-weight: 500;">
          Receba atualizações e interaja com outros clippers no Discord
        </p>
        <a href="https://discord.gg/f2eNVbYnzn" 
           target="_blank" 
           style="display: inline-block; padding: 14px 28px; background: #ffffff; color: #5865F2; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);">
          Acessar Discord
        </a>
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
        <p style="margin: 0 0 8px 0; font-size: 16px; color: #9b4dff; font-weight: 700;">
          🎯 COMPETIÇÃO AYRTON BRITO - R$ 30.000
        </p>
        <p style="margin: 0 0 4px 0; font-size: 14px; color: #888888;">
          <strong style="color: #14F7FF;">ClipfyAI</strong> - Sua plataforma de competições de cortes
        </p>
        <p style="margin: 0; font-size: 12px; color: #666666;">
          <a href="https://league.clipfyai.com/terms-of-use" target="_blank" style="color: #14F7FF; text-decoration: none;">Termos de Uso</a> | 
          <a href="https://league.clipfyai.com/privacy-policy" target="_blank" style="color: #14F7FF; text-decoration: none;">Política de Privacidade</a> | 
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
    console.log("🚀 Iniciando envio - COMPETIÇÃO AYRTON BRITO!\n");

    // Verificar API key
    if (!process.env.RESEND_API_KEY) {
      console.error("❌ RESEND_API_KEY não encontrada nas variáveis de ambiente!");
      process.exit(1);
    }
    
    console.log("✅ API Key encontrada\n");

    if (TEST_MODE) {
      console.log("=" .repeat(70));
      console.log("🧪 MODO DE TESTE ATIVADO");
      console.log("=" .repeat(70));
      console.log(`📧 Enviando email apenas para: ${TEST_EMAIL}`);
      console.log(`📝 Assunto: Nova competição disponível: Ayrton Brito - R$ 30.000`);
      console.log("=" .repeat(70));
      console.log("\n⏳ Enviando email de teste...\n");

      try {
        const emailHtml = getAyrtonBritoAnnouncementTemplate("Murilo");
        
        await resend.emails.send({
          from: "Clipfy League <noreply@league.clipfyai.com>",
          replyTo: "support@clipfyai.com",
          to: TEST_EMAIL,
          subject: "Nova competição disponível: Ayrton Brito - R$ 30.000",
          html: emailHtml,
          headers: {
            'X-Entity-Ref-ID': `ayrton-brito-${Date.now()}`,
          },
        });

        console.log(`✅ Email de teste enviado com sucesso para ${TEST_EMAIL}!`);
        console.log("\n" + "=".repeat(70));
        console.log("🎉 TESTE CONCLUÍDO COM SUCESSO!");
        console.log("=".repeat(70));
        console.log("\n💡 Para enviar para todos os clippers:");
        console.log("   1. Abra o arquivo: scripts/announce-ayrton-brito-competition.ts");
        console.log("   2. Altere: const TEST_MODE = true; para: const TEST_MODE = false;");
        console.log("   3. Execute novamente o script\n");
        
      } catch (error: any) {
        console.error(`❌ Erro ao enviar email de teste: ${error?.message || "Erro desconhecido"}`);
        throw error;
      }

    } else {
      // MODO PRODUÇÃO - Enviar para todos
      console.log("📊 Buscando TODOS os clipadores...");
      
      const clippersWithUsers = await prisma.clipperProfile.findMany({
        select: {
          id: true,
          fullName: true,
          artisticName: true,
          verificationStatus: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      // Filtrar apenas os que têm email
      const clippers = clippersWithUsers.filter(
        (clipper) => clipper.user?.email !== null && clipper.user?.email !== ""
      );

      console.log(`✅ Encontrados ${clippers.length} clipadores com email\n`);

      if (clippers.length === 0) {
        console.log("⚠️ Nenhum clipador encontrado. Encerrando...");
        await prisma.$disconnect();
        return;
      }

      // Estatísticas por status
      const byStatus = {
        VERIFIED: clippers.filter(c => c.verificationStatus === "VERIFIED").length,
        PENDING: clippers.filter(c => c.verificationStatus === "PENDING").length,
        UNVERIFIED: clippers.filter(c => c.verificationStatus === "UNVERIFIED").length,
        REJECTED: clippers.filter(c => c.verificationStatus === "REJECTED").length,
      };

      // Estatísticas
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      console.log("=" .repeat(70));
      console.log("📧 INICIANDO ENVIO EM MASSA - COMPETIÇÃO AYRTON BRITO");
      console.log("=" .repeat(70));
      console.log(`📬 Total de emails a enviar: ${clippers.length}`);
      console.log(`📝 Assunto: Nova competição disponível: Ayrton Brito - R$ 30.000`);
      console.log(`\n📊 Clipadores por status:`);
      console.log(`   ✅ Verificados: ${byStatus.VERIFIED}`);
      console.log(`   ⏳ Pendentes: ${byStatus.PENDING}`);
      console.log(`   ⚠️ Não Verificados: ${byStatus.UNVERIFIED}`);
      console.log(`   ❌ Rejeitados: ${byStatus.REJECTED}`);
      console.log("=" .repeat(70));
      console.log("\n⏳ Enviando emails...\n");

      // Enviar email para cada clipador
      for (let i = 0; i < clippers.length; i++) {
        const clipper = clippers[i];
        
        if (!clipper || !clipper.user) {
          console.log(`⚠️ [${i + 1}/${clippers.length}] Clipper não encontrado. Pulando...`);
          errorCount++;
          errors.push(`Índice ${i}: Clipper não encontrado`);
          continue;
        }
        
        const clipperName = clipper.artisticName || clipper.fullName || clipper.user.name || "Clipper";
        const email = clipper.user.email;

        if (!email) {
          console.log(`⚠️ [${i + 1}/${clippers.length}] ${clipperName} não tem email. Pulando...`);
          errorCount++;
          errors.push(`${clipperName}: Sem email`);
          continue;
        }

        try {
          const emailHtml = getAyrtonBritoAnnouncementTemplate(clipperName);
          
          await resend.emails.send({
            from: "Clipfy League <noreply@league.clipfyai.com>",
            replyTo: "support@clipfyai.com",
            to: email,
            subject: "Nova competição disponível: Ayrton Brito - R$ 30.000",
            html: emailHtml,
            headers: {
              'X-Entity-Ref-ID': `ayrton-brito-${clipper.id}-${Date.now()}`,
            },
          });

          successCount++;
          const statusEmoji = 
            clipper.verificationStatus === "VERIFIED" ? "✅" :
            clipper.verificationStatus === "PENDING" ? "⏳" :
            clipper.verificationStatus === "REJECTED" ? "❌" : "⚠️";
          
          console.log(`${statusEmoji} [${i + 1}/${clippers.length}] Email enviado para ${clipperName} (${email}) - ${clipper.verificationStatus}`);
          
          // Pequeno delay para evitar rate limiting (50ms)
          await new Promise(resolve => setTimeout(resolve, 50));
          
        } catch (error: any) {
          errorCount++;
          const errorMsg = error?.message || "Erro desconhecido";
          errors.push(`${clipperName} (${email}): ${errorMsg}`);
          console.error(`❌ [${i + 1}/${clippers.length}] Erro ao enviar para ${clipperName}: ${errorMsg}`);
        }
      }

      // Relatório final
      console.log("\n" + "=".repeat(70));
      console.log("📊 RELATÓRIO FINAL");
      console.log("=".repeat(70));
      console.log(`✅ Emails enviados com sucesso: ${successCount}`);
      console.log(`❌ Erros: ${errorCount}`);
      console.log(`📧 Total processado: ${clippers.length}`);
      console.log(`\n📈 Taxa de sucesso: ${((successCount / clippers.length) * 100).toFixed(1)}%`);
      console.log("=".repeat(70));

      if (errors.length > 0) {
        console.log("\n⚠️ DETALHES DOS ERROS:");
        errors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error}`);
        });
      }

      console.log("\n🎉 Processo de envio em massa concluído!\n");
    }

    // Desconectar do Prisma
    await prisma.$disconnect();
    
  } catch (error) {
    console.error("❌ Erro fatal ao enviar emails:", error);
    console.error("Detalhes:", JSON.stringify(error, null, 2));
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Executar
main();

