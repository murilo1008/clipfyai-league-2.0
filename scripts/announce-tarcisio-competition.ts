import { Resend } from "resend";
import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

// Carregar variáveis de ambiente
dotenv.config();

// Inicializar Resend e Prisma
const resend = new Resend(process.env.RESEND_API_KEY);
const prisma = new PrismaClient();

// Template de email de anúncio da competição
function getCompetitionAnnouncementTemplate(clipperName: string) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🚨 COMPETIÇÃO COMEÇA EM MENOS DE 5H!</title>
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

    <!-- Banner Principal com Urgência -->
    <div style="background: #1a1a1a; border: 3px solid #FF0000; padding: 32px 24px; border-radius: 16px; margin: 0 16px 32px; text-align: center; box-shadow: 0 0 40px rgba(255, 0, 0, 0.3); animation: pulse 2s ease-in-out infinite;">
      <div style="background: rgba(255, 0, 0, 0.1); border: 2px solid #FF0000; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 18px; font-weight: 900; color: #FF0000; text-transform: uppercase; letter-spacing: 2px;">
          🚨 ALERTA DE URGÊNCIA 🚨
        </p>
        <p style="margin: 8px 0 0; font-size: 32px; font-weight: 900; color: #FF0000; line-height: 1;">
          FALTAM MENOS DE 5 HORAS!
        </p>
      </div>

      <h1 style="margin: 0; font-size: 40px; font-weight: 900; color: #14F7FF; line-height: 1.1; letter-spacing: -0.5px; text-transform: uppercase;">
        NOVA COMPETIÇÃO<br/>CLIPFY LEAGUE
      </h1>
      <p style="margin: 16px 0 0; font-size: 20px; font-weight: 700; color: #37FF9F;">
        A maior competição do Brasil! 🏆
      </p>
      
      <div style="background: linear-gradient(135deg, #14F7FF 0%, #37FF9F 100%); border-radius: 12px; padding: 24px; margin-top: 24px;">
        <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #000000; text-transform: uppercase; letter-spacing: 1px;">
          💰 PREMIAÇÃO TOTAL
        </p>
        <p style="margin: 0; font-size: 48px; font-weight: 900; color: #000000; line-height: 1; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">
          R$ 50.000
        </p>
      </div>
    </div>

    <!-- Conteúdo Principal -->
    <div style="padding: 0 24px 32px;">
      
      <!-- Olá Clipper -->
      <div style="background: #111111; border: 1px solid #333333; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <p style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #14F7FF;">
          Olá, ${clipperName}! 👋
        </p>
        <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
          A competição que você estava esperando está prestes a começar! <strong style="color: #37FF9F;">Faltam menos de 5 horas</strong> para o início oficial da <strong style="color: #14F7FF;">maior competição da Clipfy League</strong>.
        </p>
      </div>

      <!-- Countdown Visual -->
      <div style="background: linear-gradient(135deg, #FF0000 0%, #FF6B00 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
        <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 700; color: #ffffff; text-transform: uppercase;">
          ⏰ CONTAGEM REGRESSIVA
        </p>
        <p style="margin: 0; font-size: 56px; font-weight: 900; color: #ffffff; line-height: 1; font-family: 'Courier New', monospace;">
          &lt; 5h
        </p>
        <p style="margin: 12px 0 0; font-size: 14px; font-weight: 600; color: rgba(255, 255, 255, 0.9);">
          Prepare seus cortes AGORA! 🎬
        </p>
      </div>

      <!-- Informações da Competição -->
      <div style="background: #111111; border: 1px solid #333333; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #14F7FF;">
          📋 Detalhes da Competição
        </h2>
        <ul style="margin: 0; padding: 0 0 0 20px; list-style-type: none;">
          <li style="margin-bottom: 12px; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F;">🎯</span>
            <strong style="color: #ffffff;">Início:</strong> 03 de Novembro de 2025
          </li>
          <li style="margin-bottom: 12px; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F;">🏁</span>
            <strong style="color: #ffffff;">Término:</strong> 03 de Dezembro de 2025
          </li>
          <li style="margin-bottom: 12px; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F;">💰</span>
            <strong style="color: #ffffff;">Premiação Total:</strong> R$ 50.000,00
          </li>
          <li style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #37FF9F;">🎬</span>
            <strong style="color: #ffffff;">Tema:</strong> Cortes virais
          </li>
        </ul>
      </div>

      <!-- Estrutura de Premiação -->
      <div style="background: #111111; border: 1px solid #333333; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #14F7FF;">
          💎 Como Ganhar Prêmios
        </h2>
        
        <!-- Prêmios Diários -->
        <div style="background: rgba(20, 247, 255, 0.1); border: 1px solid #14F7FF; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #14F7FF;">
            🏆 Prêmios Diários
          </p>
          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #e0e0e0;">
            <strong style="color: #37FF9F;">R$ 1.000/dia</strong> distribuídos entre os <strong>Top 15</strong> vídeos mais vistos de cada dia!
          </p>
        </div>

        <!-- Prêmios Mensais -->
        <div style="background: rgba(55, 255, 159, 0.1); border: 1px solid #37FF9F; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #37FF9F;">
            🌟 Prêmios Mensais
          </p>
          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #e0e0e0;">
            <strong style="color: #14F7FF;">R$ 20.000/mês</strong> para os <strong>Top 10</strong> clippers com mais views acumuladas!
          </p>
        </div>

        <!-- Bônus -->
        <div style="background: rgba(255, 215, 0, 0.1); border: 1px solid #FFD700; border-radius: 8px; padding: 16px;">
          <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #FFD700;">
            ⚡ Bônus Especial
          </p>
          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #e0e0e0;">
            <strong style="color: #FFD700;">+R$ 100</strong> para cada vídeo que atingir <strong>1 milhão de views</strong>!
          </p>
        </div>
      </div>

      <!-- O que fazer AGORA -->
      <div style="background: linear-gradient(135deg, #14F7FF 0%, #37FF9F 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #000000;">
          🚀 O QUE FAZER AGORA
        </h2>
        <ul style="margin: 0; padding: 0 0 0 20px; list-style-type: none;">
          <li style="margin-bottom: 12px; font-size: 15px; line-height: 1.6; color: #000000; position: relative; padding-left: 24px; font-weight: 600;">
            <span style="position: absolute; left: 0; font-size: 18px;">1️⃣</span>
            Complete seu cadastro na plataforma
          </li>
          <li style="margin-bottom: 12px; font-size: 15px; line-height: 1.6; color: #000000; position: relative; padding-left: 24px; font-weight: 600;">
            <span style="position: absolute; left: 0; font-size: 18px;">2️⃣</span>
            Cadastre suas contas de redes sociais
          </li>
          <li style="margin-bottom: 12px; font-size: 15px; line-height: 1.6; color: #000000; position: relative; padding-left: 24px; font-weight: 600;">
            <span style="position: absolute; left: 0; font-size: 18px;">3️⃣</span>
            Prepare seus melhores cortes
          </li>
          <li style="margin: 0; font-size: 15px; line-height: 1.6; color: #000000; position: relative; padding-left: 24px; font-weight: 600;">
            <span style="position: absolute; left: 0; font-size: 18px;">4️⃣</span>
            Poste assim que começar às 00h!
          </li>
        </ul>
      </div>

      <!-- Call to Action Principal -->
      <div style="text-align: center; margin: 32px 0;">
        <p style="margin: 0 0 20px 0; font-size: 20px; font-weight: 700; color: #ffffff;">
          ⚡ Não perca tempo! Acesse agora:
        </p>
        <a href="https://league.clipfyai.com/my-competitions/schedule" 
           target="_blank" 
           style="display: inline-block; padding: 18px 40px; background: linear-gradient(135deg, #14F7FF 0%, #37FF9F 100%); color: #000000; text-decoration: none; border-radius: 12px; font-weight: 900; font-size: 18px; box-shadow: 0 6px 25px rgba(20, 247, 255, 0.4); text-transform: uppercase; letter-spacing: 1px;">
          🏆 INSCREVER-SE AGORA
        </a>
      </div>

      <!-- Discord - Presença Obrigatória -->
      <div style="background: linear-gradient(135deg, #5865F2 0%, #7289DA 100%); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center; border: 3px solid #FEE75C;">
        <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #ffffff;">
          💬 Discord da Clipfy League
        </h2>
        <p style="margin: 0 0 20px 0; color: #FEE75C; font-size: 16px; font-weight: 700; line-height: 1.5;">
          ⚠️ PRESENÇA OBRIGATÓRIA NO DISCORD
        </p>
        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #ffffff;">
          Todas as comunicações oficiais, anúncios de prêmios e suporte acontecem no nosso servidor do Discord. É essencial estar lá!
        </p>
        <a href="https://discord.gg/f2eNVbYnzn" 
           target="_blank" 
           style="display: inline-block; padding: 14px 28px; background: #ffffff; color: #5865F2; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);">
          🎮 Entrar no Discord AGORA
        </a>
      </div>

      <!-- Dica Final -->
      <div style="background: rgba(255, 0, 0, 0.1); border: 2px solid #FF0000; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #FF0000;">
          ⚡ DICA DE OURO
        </p>
        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #e0e0e0;">
          Quem postar primeiro nos primeiros minutos da competição tem MUITO mais chances de dominar o ranking diário! <strong style="color: #37FF9F;">Prepare tudo com antecedência</strong> e esteja pronto para postar exatamente às 00h! 🚀
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
          Boa sorte e que vença o melhor! 🎬✨
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
    console.log("🚀 Iniciando envio de email de anúncio da Nova Competição...\n");

    // Verificar API key
    if (!process.env.RESEND_API_KEY) {
      console.error("❌ RESEND_API_KEY não encontrada nas variáveis de ambiente!");
      process.exit(1);
    }
    
    console.log("✅ API Key encontrada:", process.env.RESEND_API_KEY.substring(0, 10) + "...");

    // Buscar IDs dos clippers verificados que já receberam o email
    console.log("\n📊 Buscando clippers que já receberam o email...");
    
    const verifiedClippers = await prisma.clipperProfile.findMany({
      where: {
        verificationStatus: "VERIFIED",
      },
      select: {
        userId: true,
      },
    });

    const verifiedUserIds = verifiedClippers.map(c => c.userId);
    console.log(`✅ ${verifiedUserIds.length} clippers verificados já receberam o email\n`);

    // Buscar TODOS os usuários que NÃO são verificados
    console.log("📊 Buscando TODOS os outros usuários...");
    
    const allUsers = await prisma.user.findMany({
      where: {
        id: {
          notIn: verifiedUserIds, // Excluir os que já receberam
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    // Filtrar apenas os que têm email
    const allOtherUsers = allUsers.filter(user => user.email !== null && user.email !== "");

    console.log(`✅ Encontrados ${allOtherUsers.length} usuários para enviar\n`);

    if (allOtherUsers.length === 0) {
      console.log("⚠️ Nenhum usuário adicional encontrado. Encerrando...");
      await prisma.$disconnect();
      return;
    }

    // Estatísticas
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    console.log("=" .repeat(70));
    console.log("📧 INICIANDO ENVIO EM MASSA PARA USUÁRIOS NÃO VERIFICADOS");
    console.log("=" .repeat(70));
    console.log(`📬 Total de emails a enviar: ${allOtherUsers.length}`);
    console.log(`📝 Assunto: 🚨 COMPETIÇÃO COMEÇA EM MENOS DE 5H! - R$ 50.000`);
    console.log(`⚠️ Excluídos: ${verifiedUserIds.length} clippers verificados (já receberam)`);
    console.log("=" .repeat(70));
    console.log("\n⏳ Enviando emails...\n");

    // Enviar email para cada usuário
    for (let i = 0; i < allOtherUsers.length; i++) {
      const user = allOtherUsers[i];
      
      if (!user) {
        console.log(`⚠️ [${i + 1}/${allOtherUsers.length}] Usuário não encontrado. Pulando...`);
        errorCount++;
        errors.push(`Índice ${i}: Usuário não encontrado`);
        continue;
      }
      
      const userName = user.name || "Clipper";
      const email = user.email;

      if (!email) {
        console.log(`⚠️ [${i + 1}/${allOtherUsers.length}] Usuário ${userName} não tem email. Pulando...`);
        errorCount++;
        errors.push(`${userName}: Sem email`);
        continue;
      }

      try {
        const emailHtml = getCompetitionAnnouncementTemplate(userName);
        
        await resend.emails.send({
          from: "ClipfyAI <noreply@league.clipfyai.com>",
          to: email,
          subject: "🚨 COMPETIÇÃO COMEÇA EM MENOS DE 5H! - R$ 50.000",
          html: emailHtml,
        });

        successCount++;
        console.log(`✅ [${i + 1}/${allOtherUsers.length}] Email enviado para ${userName} (${email})`);
        
        // Pequeno delay para evitar rate limiting (50ms)
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (error: any) {
        errorCount++;
        const errorMsg = error?.message || "Erro desconhecido";
        errors.push(`${userName} (${email}): ${errorMsg}`);
        console.error(`❌ [${i + 1}/${allOtherUsers.length}] Erro ao enviar para ${userName}: ${errorMsg}`);
      }
    }

    // Relatório final
    console.log("\n" + "=".repeat(70));
    console.log("📊 RELATÓRIO FINAL");
    console.log("=".repeat(70));
    console.log(`✅ Emails enviados com sucesso: ${successCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log(`📧 Total processado: ${allOtherUsers.length}`);
    console.log(`⚠️ Clippers verificados excluídos: ${verifiedUserIds.length}`);
    console.log(`📬 TOTAL GERAL DE EMAILS ENVIADOS: ${88 + successCount}`);
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

