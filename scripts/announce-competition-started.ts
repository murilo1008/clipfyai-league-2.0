import { Resend } from "resend";
import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

// Carregar variáveis de ambiente
dotenv.config();

// Inicializar Resend e Prisma
const resend = new Resend(process.env.RESEND_API_KEY);
const prisma = new PrismaClient();

// Template de email - COMEÇOU AGORA!!!
function getCompetitionStartedTemplate(clipperName: string) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🚀 COMEÇOU AGORA! A COMPETIÇÃO ESTÁ ABERTA!</title>
  <style>
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.9; transform: scale(1.05); }
    }
    @keyframes slideIn {
      from { transform: translateY(-20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes glow {
      0%, 100% { box-shadow: 0 0 20px rgba(20, 247, 255, 0.5), 0 0 40px rgba(55, 255, 159, 0.3); }
      50% { box-shadow: 0 0 30px rgba(20, 247, 255, 0.8), 0 0 60px rgba(55, 255, 159, 0.5); }
    }
    .pulse { animation: pulse 2s ease-in-out infinite; }
    .slide-in { animation: slideIn 0.8s ease-out; }
    .glow { animation: glow 2s ease-in-out infinite; }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #000000; color: #ffffff;">
  <div style="max-width: 600px; margin: 0 auto; background: #000000;">
    
    <!-- Header ÉPICO -->
    <div style="background: linear-gradient(135deg, #14F7FF 0%, #37FF9F 50%, #14F7FF 100%); padding: 48px 24px; text-align: center; position: relative; overflow: hidden; border: 4px solid #14F7FF; box-shadow: 0 0 40px rgba(20, 247, 255, 0.8), inset 0 0 40px rgba(255, 255, 255, 0.3);">
      <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.1) 20px, rgba(255,255,255,0.1) 40px);"></div>
      <div style="position: relative; z-index: 1;">
        <div style="font-size: 72px; margin: 0 0 16px 0; animation: pulse 2s ease-in-out infinite;">
          🚀
        </div>
        <h1 style="margin: 0 0 12px 0; font-size: 48px; font-weight: 900; color: #000000; text-shadow: 3px 3px 6px rgba(0,0,0,0.2), 0 0 30px rgba(255,255,255,0.5); animation: pulse 2s ease-in-out infinite;">
          COMEÇOU AGORA!
        </h1>
        <p style="margin: 0 0 8px 0; font-size: 24px; font-weight: 900; color: #000000; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">
          A COMPETIÇÃO ESTÁ OFICIALMENTE ABERTA!
        </p>
        <div style="background: rgba(0, 0, 0, 0.9); border: 3px solid #37FF9F; border-radius: 16px; padding: 20px; margin: 20px auto 0; max-width: 400px; box-shadow: 0 0 30px rgba(55, 255, 159, 0.6);">
          <div style="font-size: 28px; font-weight: 900; color: #37FF9F; line-height: 1.4; text-shadow: 0 0 20px rgba(55, 255, 159, 0.8);">
            💰 R$ 50.000 em prêmios<br/>
            🎯 Competição ATIVA!
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div style="padding: 32px 24px; background: linear-gradient(180deg, #001a1a 0%, #0a0a0a 100%);">
      
      <!-- Greeting -->
      <div style="margin-bottom: 24px; text-align: center;">
        <p style="margin: 0 0 16px 0; font-size: 22px; color: #ffffff; font-weight: 700;">
          <span style="background: linear-gradient(135deg, #14F7FF, #37FF9F); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-weight: 900;">${clipperName}</span>, É AGORA OU NUNCA! 🔥
        </p>
        <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0; font-weight: 600;">
          A competição de <strong style="color: #14F7FF;">R$ 50.000</strong> acabou de começar! É hora de mostrar todo o seu talento e dominar os rankings! 🏆
        </p>
        <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #cccccc;">
          Cada segundo conta! Envie seus melhores cortes e comece a acumular views agora mesmo!
        </p>
      </div>

      <!-- Status ATIVO Banner -->
      <div style="background: linear-gradient(135deg, #14F7FF20 0%, #37FF9F20 100%); border: 3px solid #14F7FF; border-radius: 16px; padding: 24px; margin: 24px 0; text-align: center; box-shadow: 0 0 30px rgba(20, 247, 255, 0.4); animation: glow 2s ease-in-out infinite;">
        <div style="font-size: 20px; font-weight: 800; color: #14F7FF; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 2px;">
          🎬 STATUS DA COMPETIÇÃO 🎬
        </div>
        <div style="font-size: 56px; font-weight: 900; background: linear-gradient(135deg, #14F7FF, #37FF9F); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; line-height: 1; margin-bottom: 8px; text-shadow: 0 0 30px rgba(20, 247, 255, 0.8);">
          ATIVA
        </div>
        <div style="font-size: 14px; color: #37FF9F; font-weight: 700; text-transform: uppercase;">
          Envie seus posts agora e comece a pontuar!
        </div>
      </div>

      <!-- Como Participar AGORA -->
      <div style="background: linear-gradient(135deg, #14F7FF15 0%, #37FF9F15 100%); border: 2px solid #37FF9F; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <h2 style="margin: 0 0 20px 0; font-size: 22px; font-weight: 800; color: #37FF9F; text-align: center;">
          🎯 COMO PARTICIPAR AGORA
        </h2>
        <ul style="margin: 0; padding: 0; list-style: none;">
          <li style="margin-bottom: 16px; font-size: 15px; line-height: 1.6; color: #ffffff; position: relative; padding-left: 32px; font-weight: 600;">
            <span style="position: absolute; left: 0; color: #14F7FF; font-weight: 900; font-size: 20px;">1️⃣</span>
            <strong style="color: #14F7FF;">ENTRE NA PLATAFORMA</strong> e acesse a competição
          </li>
          <li style="margin-bottom: 16px; font-size: 15px; line-height: 1.6; color: #ffffff; position: relative; padding-left: 32px; font-weight: 600;">
            <span style="position: absolute; left: 0; color: #37FF9F; font-weight: 900; font-size: 20px;">2️⃣</span>
            <strong style="color: #37FF9F;">ENVIE SEUS CORTES</strong> com as hashtags obrigatórias
          </li>
          <li style="margin-bottom: 16px; font-size: 15px; line-height: 1.6; color: #ffffff; position: relative; padding-left: 32px; font-weight: 600;">
            <span style="position: absolute; left: 0; color: #14F7FF; font-weight: 900; font-size: 20px;">3️⃣</span>
            <strong style="color: #14F7FF;">ACOMPANHE O RANKING</strong> em tempo real
          </li>
          <li style="margin-bottom: 0; font-size: 15px; line-height: 1.6; color: #ffffff; position: relative; padding-left: 32px; font-weight: 600;">
            <span style="position: absolute; left: 0; color: #37FF9F; font-weight: 900; font-size: 20px;">4️⃣</span>
            <strong style="color: #37FF9F;">GANHE PRÊMIOS</strong> diários e mensais!
          </li>
        </ul>
      </div>

      <!-- Prize Structure Detalhada -->
      <div style="background: #111111; border-left: 4px solid #FFD700; border-radius: 8px; padding: 24px; margin: 24px 0;">
        <h3 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 800; color: #FFD700; text-align: center;">
          💰 ESTRUTURA DE PRÊMIOS
        </h3>
        
        <!-- Prêmios Diários -->
        <div style="background: rgba(20, 247, 255, 0.1); border: 1px solid #14F7FF; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <div style="font-size: 16px; font-weight: 800; color: #14F7FF; margin-bottom: 12px; text-align: center;">
            🏆 PRÊMIOS DIÁRIOS
          </div>
          <div style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 12px;">
            <div style="flex: 1; min-width: 100px; text-align: center;">
              <div style="font-size: 14px; color: #888888; margin-bottom: 4px;">1º Lugar</div>
              <div style="font-size: 20px; font-weight: 800; color: #FFD700;">R$ 350</div>
            </div>
            <div style="flex: 1; min-width: 100px; text-align: center;">
              <div style="font-size: 14px; color: #888888; margin-bottom: 4px;">2º Lugar</div>
              <div style="font-size: 20px; font-weight: 800; color: #C0C0C0;">R$ 200</div>
            </div>
            <div style="flex: 1; min-width: 100px; text-align: center;">
              <div style="font-size: 14px; color: #888888; margin-bottom: 4px;">3º Lugar</div>
              <div style="font-size: 20px; font-weight: 800; color: #CD7F32;">R$ 150</div>
            </div>
          </div>
          <div style="text-align: center; margin-top: 12px; font-size: 13px; color: #14F7FF; font-weight: 600;">
            + 4º ao 15º lugar: R$ 25 cada
          </div>
          <div style="text-align: center; margin-top: 8px; font-size: 14px; color: #ffffff; font-weight: 700;">
            💵 Total Diário: R$ 1.000
          </div>
        </div>

        <!-- Prêmios Mensais -->
        <div style="background: rgba(55, 255, 159, 0.1); border: 1px solid #37FF9F; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <div style="font-size: 16px; font-weight: 800; color: #37FF9F; margin-bottom: 12px; text-align: center;">
            🌟 PRÊMIOS MENSAIS
          </div>
          <div style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 12px;">
            <div style="flex: 1; min-width: 100px; text-align: center;">
              <div style="font-size: 14px; color: #888888; margin-bottom: 4px;">1º Lugar</div>
              <div style="font-size: 24px; font-weight: 900; color: #FFD700;">R$ 7.000</div>
            </div>
            <div style="flex: 1; min-width: 100px; text-align: center;">
              <div style="font-size: 14px; color: #888888; margin-bottom: 4px;">2º Lugar</div>
              <div style="font-size: 24px; font-weight: 900; color: #C0C0C0;">R$ 4.000</div>
            </div>
            <div style="flex: 1; min-width: 100px; text-align: center;">
              <div style="font-size: 14px; color: #888888; margin-bottom: 4px;">3º Lugar</div>
              <div style="font-size: 24px; font-weight: 900; color: #CD7F32;">R$ 3.000</div>
            </div>
          </div>
          <div style="text-align: center; margin-top: 12px; font-size: 13px; color: #37FF9F; font-weight: 600;">
            + 4º ao 10º lugar: prêmios até R$ 400
          </div>
          <div style="text-align: center; margin-top: 8px; font-size: 14px; color: #ffffff; font-weight: 700;">
            💵 Total Mensal: R$ 20.000
          </div>
        </div>

        <!-- Bônus Especial -->
        <div style="background: rgba(255, 215, 0, 0.1); border: 1px solid #FFD700; border-radius: 8px; padding: 16px;">
          <div style="font-size: 16px; font-weight: 800; color: #FFD700; margin-bottom: 8px; text-align: center;">
            ⚡ BÔNUS ESPECIAL
          </div>
          <div style="text-align: center; font-size: 15px; color: #ffffff; line-height: 1.6;">
            Ganhe <strong style="color: #FFD700; font-size: 18px;">R$ 100</strong> por cada vídeo que atingir<br/>
            <strong style="color: #14F7FF; font-size: 18px;">+1 MILHÃO</strong> de visualizações! 🔥
          </div>
        </div>
      </div>

      <!-- Regras Importantes -->
      <div style="background: #0d0d0d; border: 2px solid #14F7FF; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 800; color: #14F7FF; text-align: center;">
          📋 REGRAS IMPORTANTES
        </h3>
        <ul style="margin: 0; padding: 0; list-style: none;">
          <li style="margin-bottom: 10px; font-size: 14px; line-height: 1.6; color: #cccccc; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F; font-size: 16px;">✓</span>
            Use <strong style="color: #ffffff;">TODAS as hashtags obrigatórias</strong> em seus posts
          </li>
          <li style="margin-bottom: 10px; font-size: 14px; line-height: 1.6; color: #cccccc; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F; font-size: 16px;">✓</span>
            Posts devem estar no <strong style="color: #ffffff;">período da competição</strong>
          </li>
          <li style="margin-bottom: 10px; font-size: 14px; line-height: 1.6; color: #cccccc; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F; font-size: 16px;">✓</span>
            Use apenas <strong style="color: #ffffff;">contas cadastradas</strong> na plataforma
          </li>
          <li style="margin-bottom: 10px; font-size: 14px; line-height: 1.6; color: #cccccc; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F; font-size: 16px;">✓</span>
            Ranking atualizado <strong style="color: #ffffff;">em tempo real</strong>
          </li>
          <li style="margin-bottom: 0; font-size: 14px; line-height: 1.6; color: #cccccc; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F; font-size: 16px;">✓</span>
            Prêmios pagos via <strong style="color: #ffffff;">PIX</strong>
          </li>
        </ul>
      </div>

      <!-- CTA Button PRINCIPAL -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="https://league.clipfyai.com/my-competitions/schedule" 
           target="_blank" 
           style="display: inline-block; padding: 20px 48px; background: linear-gradient(135deg, #14F7FF 0%, #37FF9F 100%); color: #000000; text-decoration: none; border-radius: 12px; font-weight: 900; font-size: 20px; box-shadow: 0 6px 30px rgba(20, 247, 255, 0.6); text-transform: uppercase; letter-spacing: 1px; border: none;">
          🚀 ENVIAR POSTS AGORA!
        </a>
      </div>

      <!-- Motivacional Final -->
      <div style="background: linear-gradient(135deg, #14F7FF10 0%, #37FF9F10 100%); border: 2px solid #37FF9F; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
        <h3 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 800; background: linear-gradient(135deg, #14F7FF, #37FF9F); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
          💪 É HORA DE BRILHAR!
        </h3>
        <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #ffffff; font-weight: 600;">
          Você treinou, se preparou e agora é o momento de mostrar seu talento!<br/>
          <strong style="color: #14F7FF;">Boa sorte</strong> e que os melhores <strong style="color: #37FF9F;">ganhem!</strong> 🏆
        </p>
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
    console.log("🚀 Iniciando envio de COMEÇOU AGORA - COMPETIÇÃO ATIVA!\n");

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
    console.log("🚀 INICIANDO ENVIO EM MASSA - COMEÇOU AGORA!");
    console.log("=" .repeat(70));
    console.log(`📬 Total de emails a enviar: ${clippers.length}`);
    console.log(`📝 Assunto: 🚀 COMEÇOU AGORA! A Competição de R$ 50.000 está ATIVA!`);
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
        const emailHtml = getCompetitionStartedTemplate(clipperName);
        
        await resend.emails.send({
          from: "ClipfyAI <noreply@league.clipfyai.com>",
          to: email,
          subject: "🚀 COMEÇOU AGORA! A Competição de R$ 50.000 está ATIVA!",
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
    console.log("🚀 A COMPETIÇÃO COMEÇOU OFICIALMENTE!\n");

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

