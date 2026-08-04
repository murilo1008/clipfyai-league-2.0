import { Resend } from "resend";
import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

// Carregar variáveis de ambiente
dotenv.config();

// Inicializar Resend e Prisma
const resend = new Resend(process.env.RESEND_API_KEY);
const prisma = new PrismaClient();

// Template de email - FALTAM 1 HORA - URGÊNCIA MÁXIMA!!!
function getUltimateFinalCallTemplate(clipperName: string) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>⚠️ ÚLTIMA HORA - A COMPETIÇÃO COMEÇA AGORA!</title>
  <style>
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(1.05); }
    }
    @keyframes blink {
      0%, 50%, 100% { opacity: 1; }
      25%, 75% { opacity: 0.3; }
    }
    .pulse { animation: pulse 1s ease-in-out infinite; }
    .blink { animation: blink 1.5s ease-in-out infinite; }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #000000; color: #ffffff;">
  <div style="max-width: 600px; margin: 0 auto; background: #000000;">
    
    <!-- Header URGENTE -->
    <div style="background: linear-gradient(135deg, #FF0000 0%, #FF4500 50%, #FF0000 100%); padding: 40px 24px; text-align: center; position: relative; overflow: hidden; border: 4px solid #FF0000; box-shadow: 0 0 30px rgba(255, 0, 0, 0.8), inset 0 0 30px rgba(255, 255, 255, 0.2);">
      <div style="position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.05) 10px, rgba(255,255,255,0.05) 20px); animation: pulse 2s linear infinite;"></div>
      <div style="position: relative; z-index: 1;">
        <h1 style="margin: 0 0 12px 0; font-size: 42px; font-weight: 900; color: #FFFFFF; text-shadow: 3px 3px 6px rgba(0,0,0,0.8), 0 0 20px rgba(255,255,255,0.5); animation: blink 1.5s ease-in-out infinite;">
          ⚠️ ÚLTIMA HORA! ⚠️
        </h1>
        <p style="margin: 0 0 8px 0; font-size: 24px; font-weight: 900; color: #FFFFFF; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">
          A COMPETIÇÃO COMEÇA AGORA!
        </p>
        <div style="background: rgba(0, 0, 0, 0.8); border: 3px solid #FFFFFF; border-radius: 16px; padding: 20px; margin: 16px auto 0; max-width: 280px; box-shadow: 0 0 20px rgba(255, 255, 255, 0.6);">
          <div style="font-size: 72px; font-weight: 900; color: #FFFFFF; line-height: 1; margin-bottom: 8px; text-shadow: 0 0 20px rgba(255, 255, 255, 0.8); animation: pulse 1s ease-in-out infinite;">
            1h
          </div>
          <div style="font-size: 16px; font-weight: 700; color: #FF4500; text-transform: uppercase; letter-spacing: 2px;">
            RESTANTE!
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div style="padding: 32px 24px; background: linear-gradient(180deg, #1a0000 0%, #0a0a0a 100%);">
      
      <!-- Greeting -->
      <div style="margin-bottom: 24px; text-align: center;">
        <p style="margin: 0 0 16px 0; font-size: 22px; color: #ffffff; font-weight: 700;">
          <span style="background: linear-gradient(135deg, #FF0000, #FF4500); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-weight: 900;">${clipperName}</span>, ESTA É SUA ÚLTIMA CHANCE! 🚨
        </p>
        <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0; font-weight: 600;">
          Falta <strong style="color: #FF0000; font-size: 20px;">APENAS 1 HORA</strong> para a competição de <strong style="color: #14F7FF;">R$ 50.000</strong> começar oficialmente!
        </p>
        <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #cccccc;">
          Se você ainda não se inscreveu ou não cadastrou suas contas, <strong style="color: #FF4500;">FAÇA AGORA!</strong> O tempo está acabando! ⏰
        </p>
      </div>

      <!-- Countdown Banner URGENTE -->
      <div style="background: linear-gradient(135deg, #FF000020 0%, #FF450020 100%); border: 3px solid #FF0000; border-radius: 16px; padding: 24px; margin: 24px 0; text-align: center; box-shadow: 0 0 30px rgba(255, 0, 0, 0.4);">
        <div style="font-size: 18px; font-weight: 800; color: #FF0000; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px;">
          ⚡ CONTAGEM REGRESSIVA FINAL ⚡
        </div>
        <div style="font-size: 64px; font-weight: 900; color: #FFFFFF; line-height: 1; margin-bottom: 8px; text-shadow: 0 0 20px rgba(255, 0, 0, 0.8); animation: pulse 1s ease-in-out infinite;">
          60min
        </div>
        <div style="font-size: 14px; color: #FF4500; font-weight: 700; text-transform: uppercase;">
          Até o início oficial da competição!
        </div>
      </div>

      <!-- Checklist URGENTE de Última Hora -->
      <div style="background: linear-gradient(135deg, #FF000015 0%, #FF450015 100%); border: 3px solid #FF4500; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 800; color: #FF0000; text-align: center;">
          🔥 FAÇA AGORA - NÃO PERCA TEMPO!
        </h2>
        <ul style="margin: 0; padding: 0; list-style: none;">
          <li style="margin-bottom: 12px; font-size: 15px; line-height: 1.6; color: #ffffff; position: relative; padding-left: 28px; font-weight: 600;">
            <span style="position: absolute; left: 0; color: #FF0000; font-weight: 900; font-size: 18px;">1.</span>
            <strong style="color: #FF4500;">INSCREVA-SE</strong> agora na competição (se ainda não fez)
          </li>
          <li style="margin-bottom: 12px; font-size: 15px; line-height: 1.6; color: #ffffff; position: relative; padding-left: 28px; font-weight: 600;">
            <span style="position: absolute; left: 0; color: #FF0000; font-weight: 900; font-size: 18px;">2.</span>
            <strong style="color: #FF4500;">CADASTRE</strong> todas as suas contas (Instagram, TikTok, etc)
          </li>
          <li style="margin-bottom: 12px; font-size: 15px; line-height: 1.6; color: #ffffff; position: relative; padding-left: 28px; font-weight: 600;">
            <span style="position: absolute; left: 0; color: #FF0000; font-weight: 900; font-size: 18px;">3.</span>
            <strong style="color: #FF4500;">PREPARE</strong> seus cortes mais virais
          </li>
          <li style="margin-bottom: 0; font-size: 15px; line-height: 1.6; color: #ffffff; position: relative; padding-left: 28px; font-weight: 600;">
            <span style="position: absolute; left: 0; color: #FF0000; font-weight: 900; font-size: 18px;">4.</span>
            <strong style="color: #FF4500;">ESTEJA PRONTO</strong> para postar assim que começar!
          </li>
        </ul>
      </div>

      <!-- Prize Pool -->
      <div style="background: linear-gradient(135deg, #14F7FF15 0%, #37FF9F15 100%); border: 2px solid #14F7FF; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
        <div style="font-size: 16px; color: #14F7FF; font-weight: 700; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px;">
          💰 Prize Pool Total
        </div>
        <div style="font-size: 48px; font-weight: 900; background: linear-gradient(135deg, #14F7FF, #37FF9F); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; line-height: 1; margin-bottom: 12px;">
          R$ 50.000
        </div>
        <div style="display: flex; justify-content: space-around; margin-top: 16px; flex-wrap: wrap; gap: 12px;">
          <div style="flex: 1; min-width: 120px;">
            <div style="font-size: 14px; color: #888888; margin-bottom: 4px;">Prêmio Diário</div>
            <div style="font-size: 20px; font-weight: 800; color: #14F7FF;">R$ 1.000</div>
          </div>
          <div style="flex: 1; min-width: 120px;">
            <div style="font-size: 14px; color: #888888; margin-bottom: 4px;">Prêmio Mensal</div>
            <div style="font-size: 20px; font-weight: 800; color: #37FF9F;">R$ 20.000</div>
          </div>
          <div style="flex: 1; min-width: 120px;">
            <div style="font-size: 14px; color: #888888; margin-bottom: 4px;">Bônus +1M</div>
            <div style="font-size: 20px; font-weight: 800; color: #FFD700;">R$ 100</div>
          </div>
        </div>
      </div>

      <!-- CTA Button URGENTE -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="https://league.clipfyai.com/my-competitions/schedule" 
           target="_blank" 
           style="display: inline-block; padding: 20px 48px; background: linear-gradient(135deg, #FF0000 0%, #FF4500 100%); color: #FFFFFF; text-decoration: none; border-radius: 12px; font-weight: 900; font-size: 20px; box-shadow: 0 6px 30px rgba(255, 0, 0, 0.6); text-transform: uppercase; letter-spacing: 1px; border: 3px solid #FFFFFF;">
          🚀 INSCREVER-SE AGORA!
        </a>
      </div>

      <!-- Warning Final -->
      <div style="background: #1a0000; border: 2px solid #FF0000; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 800; color: #FF0000; text-align: center;">
          ⚠️ ATENÇÃO - ÚLTIMA CHAMADA! ⚠️
        </h3>
        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #ffffff; text-align: center; font-weight: 600;">
          Esta é sua <strong style="color: #FF4500;">ÚLTIMA OPORTUNIDADE</strong> de se preparar! 
          <br/>Depois que começar, não há volta. <strong style="color: #14F7FF;">CORRA!</strong> 🏃💨
        </p>
      </div>

      <!-- Tips Section -->
      <div style="background: #0d0d0d; border: 1px solid #222222; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 800; color: #14F7FF;">
          💡 Dicas para Começar Arrasando:
        </h3>
        <ul style="margin: 0; padding: 0; list-style: none;">
          <li style="margin-bottom: 8px; font-size: 14px; line-height: 1.6; color: #cccccc; position: relative; padding-left: 20px;">
            <span style="position: absolute; left: 0; color: #37FF9F;">▸</span>
            Use SEMPRE as hashtags e menções obrigatórias
          </li>
          <li style="margin-bottom: 8px; font-size: 14px; line-height: 1.6; color: #cccccc; position: relative; padding-left: 20px;">
            <span style="position: absolute; left: 0; color: #37FF9F;">▸</span>
            Poste seus MELHORES cortes logo no início
          </li>
          <li style="margin-bottom: 8px; font-size: 14px; line-height: 1.6; color: #cccccc; position: relative; padding-left: 20px;">
            <span style="position: absolute; left: 0; color: #37FF9F;">▸</span>
            Acompanhe o ranking diário em tempo real
          </li>
          <li style="margin-bottom: 0; font-size: 14px; line-height: 1.6; color: #cccccc; position: relative; padding-left: 20px;">
            <span style="position: absolute; left: 0; color: #37FF9F;">▸</span>
            Mantenha consistência durante toda a competição
          </li>
        </ul>
      </div>

    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px; background: #0a0a0a; border-top: 1px solid #222222;">
      <p style="margin: 0 0 16px 0; font-size: 14px; color: #888888;">
        Siga a Clipfy League nas redes sociais:
      </p>
      <div style="margin: 0 0 20px 0;">
        <a href="https://tiktok.com/@clipfyai.league" target="_blank" style="display: inline-block; margin: 5px; padding: 12px 20px; background: #14F7FF; color: #000000; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
          🎵 TikTok
        </a>
        <a href="https://instagram.com/clipfyai.league" target="_blank" style="display: inline-block; margin: 5px; padding: 12px 20px; background: #37FF9F; color: #000000; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
          📸 Instagram
        </a>
      </div>
      <p style="margin: 0; font-size: 12px; color: #666666; line-height: 1.6;">
        © ${new Date().getFullYear()} Clipfy League - Todos os direitos reservados<br/>
        <a href="https://league.clipfyai.com/terms-of-use" target="_blank" style="color: #14F7FF; text-decoration: none;">Termos de Uso</a> | 
        <a href="https://league.clipfyai.com/rules" target="_blank" style="color: #14F7FF; text-decoration: none;">Regras</a>
      </p>
    </div>

  </div>
</body>
</html>
  `;
}

async function main() {
  try {
    console.log("⚠️ Iniciando envio de ÚLTIMA HORA - 1 HORA RESTANTE!\n");

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
    console.log("⚠️ INICIANDO ENVIO EM MASSA - ÚLTIMA HORA - 1 HORA!");
    console.log("=" .repeat(70));
    console.log(`📬 Total de emails a enviar: ${clippers.length}`);
    console.log(`📝 Assunto: ⚠️ ÚLTIMA HORA - FALTA 1 HORA! - R$ 50.000`);
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
        const emailHtml = getUltimateFinalCallTemplate(clipperName);
        
        await resend.emails.send({
          from: "ClipfyAI <noreply@league.clipfyai.com>",
          to: email,
          subject: "⚠️ ÚLTIMA HORA - FALTA 1 HORA! - R$ 50.000",
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

