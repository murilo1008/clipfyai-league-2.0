import { Resend } from "resend";
import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

// Carregar variáveis de ambiente
dotenv.config();

// Inicializar Resend e Prisma
const resend = new Resend(process.env.RESEND_API_KEY);
const prisma = new PrismaClient();

// Template de email - FALTAM 2 HORAS
function getUrgentAnnouncementTemplate(clipperName: string) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🔥 ÚLTIMA CHAMADA - FALTAM 2 HORAS!</title>
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

    <!-- Banner Principal - URGÊNCIA MÁXIMA -->
    <div style="background: #1a1a1a; border: 4px solid #FF0000; padding: 32px 24px; border-radius: 16px; margin: 0 16px 32px; text-align: center; box-shadow: 0 0 50px rgba(255, 0, 0, 0.5); position: relative; overflow: hidden;">
      <!-- Efeito de brilho animado -->
      <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #FF0000 0%, #FF6B00 25%, #FFD700 50%, #FF6B00 75%, #FF0000 100%); background-size: 200% 100%; animation: shimmer 2s infinite;"></div>
      
      <div style="background: rgba(255, 0, 0, 0.2); border: 3px solid #FF0000; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 20px; font-weight: 900; color: #FF0000; text-transform: uppercase; letter-spacing: 3px;">
          🔥 ÚLTIMA CHAMADA 🔥
        </p>
        <p style="margin: 12px 0 0; font-size: 42px; font-weight: 900; color: #FF0000; line-height: 1; text-shadow: 0 0 20px rgba(255, 0, 0, 0.8);">
          FALTAM 2 HORAS!
        </p>
      </div>

      <h1 style="margin: 0; font-size: 44px; font-weight: 900; color: #14F7FF; line-height: 1.1; letter-spacing: -0.5px; text-transform: uppercase; text-shadow: 0 0 30px rgba(20, 247, 255, 0.6);">
        A HORA ESTÁ<br/>CHEGANDO!
      </h1>
      
      <div style="background: linear-gradient(135deg, #14F7FF 0%, #37FF9F 100%); border-radius: 12px; padding: 28px; margin-top: 24px; box-shadow: 0 8px 32px rgba(20, 247, 255, 0.4);">
        <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #000000; text-transform: uppercase; letter-spacing: 2px;">
          💰 PREMIAÇÃO TOTAL
        </p>
        <p style="margin: 0; font-size: 56px; font-weight: 900; color: #000000; line-height: 1; text-shadow: 3px 3px 6px rgba(0,0,0,0.3);">
          R$ 50.000
        </p>
      </div>
    </div>

    <!-- Conteúdo Principal -->
    <div style="padding: 0 24px 32px;">
      
      <!-- Mensagem de Urgência -->
      <div style="background: linear-gradient(135deg, #FF0000 0%, #FF6B00 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center; box-shadow: 0 6px 24px rgba(255, 0, 0, 0.4);">
        <p style="margin: 0 0 16px 0; font-size: 20px; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: 2px;">
          ${clipperName}, O MOMENTO É AGORA! ⚡
        </p>
        <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #ffffff; font-weight: 600;">
          A competição começa em <strong style="font-size: 22px; color: #FFD700;">APENAS 2 HORAS</strong>!<br/>
          Esta é sua <strong>ÚLTIMA CHANCE</strong> de se preparar para a maior competição da Clipfy League!
        </p>
      </div>

      <!-- Countdown Gigante -->
      <div style="background: #000000; border: 4px solid #FF0000; border-radius: 16px; padding: 32px; margin-bottom: 24px; text-align: center; box-shadow: 0 0 40px rgba(255, 0, 0, 0.3);">
        <p style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #FF0000; text-transform: uppercase; letter-spacing: 2px;">
          ⏰ CONTAGEM REGRESSIVA FINAL
        </p>
        <p style="margin: 0; font-size: 80px; font-weight: 900; color: #FF0000; line-height: 1; font-family: 'Courier New', monospace; text-shadow: 0 0 30px rgba(255, 0, 0, 0.8);">
          2h
        </p>
        <p style="margin: 16px 0 0; font-size: 16px; font-weight: 700; color: #FFD700;">
          ⚡ O TEMPO ESTÁ SE ESGOTANDO! ⚡
        </p>
      </div>

      <!-- Checklist de Preparação -->
      <div style="background: #111111; border: 2px solid #14F7FF; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 20px 0; font-size: 22px; font-weight: 700; color: #14F7FF; text-align: center;">
          ✅ CHECKLIST FINAL - FAÇA AGORA!
        </h2>
        <ul style="margin: 0; padding: 0; list-style-type: none;">
          <li style="margin-bottom: 16px; padding: 16px; background: rgba(20, 247, 255, 0.05); border-left: 4px solid #37FF9F; border-radius: 8px;">
            <p style="margin: 0; font-size: 16px; font-weight: 700; color: #37FF9F;">
              ✓ CADASTRO COMPLETO
            </p>
            <p style="margin: 4px 0 0; font-size: 14px; color: #e0e0e0;">
              Confirme que todos os seus dados estão atualizados na plataforma
            </p>
          </li>
          <li style="margin-bottom: 16px; padding: 16px; background: rgba(20, 247, 255, 0.05); border-left: 4px solid #37FF9F; border-radius: 8px;">
            <p style="margin: 0; font-size: 16px; font-weight: 700; color: #37FF9F;">
              ✓ CONTAS CADASTRADAS
            </p>
            <p style="margin: 4px 0 0; font-size: 14px; color: #e0e0e0;">
              Todas as suas contas de redes sociais devem estar ativas
            </p>
          </li>
          <li style="margin-bottom: 16px; padding: 16px; background: rgba(20, 247, 255, 0.05); border-left: 4px solid #37FF9F; border-radius: 8px;">
            <p style="margin: 0; font-size: 16px; font-weight: 700; color: #37FF9F;">
              ✓ CORTES PRONTOS
            </p>
            <p style="margin: 4px 0 0; font-size: 14px; color: #e0e0e0;">
              Tenha seus melhores cortes editados e prontos para postar
            </p>
          </li>
          <li style="margin: 0; padding: 16px; background: rgba(20, 247, 255, 0.05); border-left: 4px solid #37FF9F; border-radius: 8px;">
            <p style="margin: 0; font-size: 16px; font-weight: 700; color: #37FF9F;">
              ✓ DISCORD ATIVO
            </p>
            <p style="margin: 4px 0 0; font-size: 14px; color: #e0e0e0;">
              Esteja conectado no Discord para receber atualizações em tempo real
            </p>
          </li>
        </ul>
      </div>

      <!-- Prêmios - Lembrete Rápido -->
      <div style="background: linear-gradient(135deg, #14F7FF 0%, #37FF9F 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #000000; text-align: center;">
          💎 O QUE ESTÁ EM JOGO
        </h2>
        
        <div style="display: grid; gap: 12px;">
          <div style="background: rgba(0, 0, 0, 0.3); border-radius: 8px; padding: 16px; text-align: center;">
            <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 700; color: #000000;">
              🏆 DIÁRIO
            </p>
            <p style="margin: 0; font-size: 24px; font-weight: 900; color: #000000;">
              R$ 1.000/dia
            </p>
          </div>
          
          <div style="background: rgba(0, 0, 0, 0.3); border-radius: 8px; padding: 16px; text-align: center;">
            <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 700; color: #000000;">
              🌟 MENSAL
            </p>
            <p style="margin: 0; font-size: 24px; font-weight: 900; color: #000000;">
              R$ 20.000/mês
            </p>
          </div>
          
          <div style="background: rgba(0, 0, 0, 0.3); border-radius: 8px; padding: 16px; text-align: center;">
            <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 700; color: #000000;">
              ⚡ BÔNUS 1M+
            </p>
            <p style="margin: 0; font-size: 24px; font-weight: 900; color: #000000;">
              +R$ 100/vídeo
            </p>
          </div>
        </div>
      </div>

      <!-- Call to Action GIGANTE -->
      <div style="text-align: center; margin: 32px 0;">
        <p style="margin: 0 0 24px 0; font-size: 24px; font-weight: 900; color: #FF0000; text-transform: uppercase; letter-spacing: 2px;">
          🔥 ACESSE AGORA! 🔥
        </p>
        <a href="https://league.clipfyai.com/my-competitions/schedule" 
           target="_blank" 
           style="display: inline-block; padding: 24px 48px; background: linear-gradient(135deg, #FF0000 0%, #FF6B00 100%); color: #ffffff; text-decoration: none; border-radius: 16px; font-weight: 900; font-size: 22px; box-shadow: 0 8px 32px rgba(255, 0, 0, 0.6); text-transform: uppercase; letter-spacing: 2px; border: 3px solid #FFD700;">
          ⚡ ENTRAR NA PLATAFORMA
        </a>
        <p style="margin: 16px 0 0; font-size: 14px; color: #888888; font-weight: 600;">
          E prepare-se para postar às 00h em ponto!
        </p>
      </div>

      <!-- Discord - Urgência -->
      <div style="background: linear-gradient(135deg, #5865F2 0%, #7289DA 100%); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center; border: 3px solid #FEE75C;">
        <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #ffffff;">
          💬 ÚLTIMA CHANCE - Discord
        </h2>
        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #FEE75C; font-weight: 700;">
          Se você ainda NÃO está no Discord, entre AGORA!<br/>
          Todas as atualizações em tempo real acontecem lá!
        </p>
        <a href="https://discord.gg/f2eNVbYnzn" 
           target="_blank" 
           style="display: inline-block; padding: 16px 32px; background: #ffffff; color: #5865F2; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);">
          🎮 Entrar no Discord AGORA
        </a>
      </div>

      <!-- Aviso Final -->
      <div style="background: rgba(255, 215, 0, 0.1); border: 3px solid #FFD700; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="margin: 0 0 12px 0; font-size: 20px; font-weight: 900; color: #FFD700;">
          ⚡ ESTRATÉGIA VENCEDORA
        </p>
        <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0; font-weight: 600;">
          Os <strong style="color: #37FF9F;">primeiros clippers a postarem</strong> logo após o início (00h) têm <strong style="color: #14F7FF;">MUITO mais chances</strong> de dominar o ranking diário!<br/><br/>
          Prepare TUDO agora e esteja pronto para <strong style="color: #FFD700;">DISPARAR</strong> seus posts no primeiro segundo! 🚀
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
        <p style="margin: 0 0 8px 0; font-size: 16px; color: #FF0000; font-weight: 700;">
          ⏰ A CONTAGEM REGRESSIVA COMEÇOU!
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
    console.log("🔥 Iniciando envio de ÚLTIMA CHAMADA - 2 HORAS!\n");

    // Verificar API key
    if (!process.env.RESEND_API_KEY) {
      console.error("❌ RESEND_API_KEY não encontrada nas variáveis de ambiente!");
      process.exit(1);
    }
    
    console.log("✅ API Key encontrada\n");

    // Buscar TODOS os usuários que têm clipperProfile
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
    console.log("📧 INICIANDO ENVIO EM MASSA PARA TODOS OS CLIPADORES");
    console.log("=" .repeat(70));
    console.log(`📬 Total de emails a enviar: ${clippers.length}`);
    console.log(`📝 Assunto: 🔥 ÚLTIMA CHAMADA - FALTAM 2 HORAS! - R$ 50.000`);
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
        const emailHtml = getUrgentAnnouncementTemplate(clipperName);
        
        await resend.emails.send({
          from: "ClipfyAI <noreply@league.clipfyai.com>",
          to: email,
          subject: "🔥 ÚLTIMA CHAMADA - FALTAM 2 HORAS! - R$ 50.000",
          html: emailHtml,
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

