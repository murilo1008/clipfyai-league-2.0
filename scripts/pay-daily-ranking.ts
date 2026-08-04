/**
 * Script para processar pagamentos do Ranking Diário
 * 
 * Uso:
 * npx tsx scripts/pay-daily-ranking.ts <campaignSlug> <date> [--dry-run]
 * 
 * Exemplo:
 * npx tsx scripts/pay-daily-ranking.ts tarcisio-de-freitas-nov 2025-11-06 --dry-run
 * npx tsx scripts/pay-daily-ranking.ts tarcisio-de-freitas-nov 2025-11-06
 */

import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);

// ============================================================================
// TEMPLATE DE EMAIL (mesmo usado em admin.ts)
// ============================================================================

function getPaymentNotificationEmailTemplate(
  clipperName: string,
  amount: number,
  paymentType: string,
  description: string,
  newBalance: number,
  campaignName?: string,
  position?: number,
  rankingType?: string
) {
  const displayName = clipperName;
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const typeLabel: Record<string, string> = {
    PRIZE_CREDIT: "Prêmio",
    BONUS: "Bônus",
    ADJUSTMENT: "Ajuste Manual",
  };

  const rankingTypeLabel: Record<string, string> = {
    daily: "Diário",
    monthly: "Mensal",
  };

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pagamento Recebido - Clipfy League</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);">
  <div style="max-width: 600px; margin: 0 auto; background: #000000;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #14F7FF 0%, #37FF9F 50%, #14F7FF 100%); padding: 32px 24px; text-align: center;">
      <h1 style="margin: 0 0 8px 0; font-size: 32px; font-weight: 900; color: #000000;">
        💰 PAGAMENTO RECEBIDO!
      </h1>
      <p style="margin: 0; font-size: 18px; font-weight: 700; color: #000000;">
        ${formatCurrency(amount)} creditado na sua carteira
      </p>
    </div>

    <!-- Main Content -->
    <div style="padding: 32px 24px; background: #0a0a0a;">
      
      <!-- Greeting -->
      <div style="margin-bottom: 24px;">
        <p style="margin: 0 0 16px 0; font-size: 18px; color: #ffffff; font-weight: 600;">
          Olá, <span style="background: linear-gradient(135deg, #14F7FF, #37FF9F); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-weight: 900;">${displayName}</span>! 🎉
        </p>
        <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
          Ótimas notícias! Um novo pagamento foi processado e já está disponível na sua carteira.
        </p>
      </div>

      <!-- Payment Details -->
      <div style="background: linear-gradient(135deg, #14F7FF15 0%, #37FF9F15 100%); border: 2px solid #14F7FF40; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 800; color: #14F7FF; text-align: center;">
          📋 Detalhes do Pagamento
        </h2>
        <div style="background: #111111; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #222222;">
            <span style="color: #888888; font-size: 14px;">Tipo:</span>
            <span style="color: #ffffff; font-weight: 600; font-size: 14px;">${typeLabel[paymentType] || paymentType}</span>
          </div>
          ${position ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #222222;">
            <span style="color: #888888; font-size: 14px;">Posição:</span>
            <span style="color: #ffffff; font-weight: 600; font-size: 14px;">${position}º lugar</span>
          </div>
          ` : ''}
          ${rankingType ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #222222;">
            <span style="color: #888888; font-size: 14px;">Ranking:</span>
            <span style="color: #ffffff; font-weight: 600; font-size: 14px;">${rankingTypeLabel[rankingType]}</span>
          </div>
          ` : ''}
          ${campaignName ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #222222;">
            <span style="color: #888888; font-size: 14px;">Competição:</span>
            <span style="color: #ffffff; font-weight: 600; font-size: 14px;">${campaignName}</span>
          </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #222222;">
            <span style="color: #888888; font-size: 14px;">Descrição:</span>
            <span style="color: #ffffff; font-weight: 600; font-size: 14px;">${description}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #222222;">
            <span style="color: #888888; font-size: 14px;">Valor:</span>
            <span style="color: #37FF9F; font-weight: 800; font-size: 18px;">${formatCurrency(amount)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #888888; font-size: 14px;">Saldo Atual:</span>
            <span style="color: #14F7FF; font-weight: 800; font-size: 18px;">${formatCurrency(newBalance)}</span>
          </div>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="https://league.clipfyai.com" 
           target="_blank" 
           style="display: inline-block; padding: 18px 40px; background: linear-gradient(135deg, #14F7FF 0%, #37FF9F 100%); color: #000000; text-decoration: none; border-radius: 12px; font-weight: 800; font-size: 18px; box-shadow: 0 4px 20px rgba(20, 247, 255, 0.4);">
          💰 VER MINHA CARTEIRA
        </a>
      </div>

      <!-- Tips -->
      <div style="background: #0d0d0d; border: 1px solid #222222; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 800; color: #ffffff;">
          💡 Próximos passos:
        </h3>
        <ul style="margin: 0; padding: 0; list-style: none;">
          <li style="margin-bottom: 8px; font-size: 14px; line-height: 1.6; color: #cccccc; position: relative; padding-left: 20px;">
            <span style="position: absolute; left: 0; color: #37FF9F;">▸</span>
            Acesse sua carteira para visualizar o saldo atualizado
          </li>
          <li style="margin-bottom: 8px; font-size: 14px; line-height: 1.6; color: #cccccc; position: relative; padding-left: 20px;">
            <span style="position: absolute; left: 0; color: #37FF9F;">▸</span>
            Continue participando das competições para ganhar mais prêmios
          </li>
          <li style="margin-bottom: 0; font-size: 14px; line-height: 1.6; color: #cccccc; position: relative; padding-left: 20px;">
            <span style="position: absolute; left: 0; color: #37FF9F;">▸</span>
            Solicite um saque quando atingir o valor mínimo de R$ 50
          </li>
        </ul>
      </div>

    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px; background: #0a0a0a; border-top: 1px solid #222222;">
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

// ============================================================================
// FUNÇÃO PRINCIPAL
// ============================================================================

interface PaymentResult {
  success: boolean;
  clipperName: string;
  position: number;
  amount: number;
  error?: string;
}

async function payDailyRanking(
  campaignSlug: string,
  dateStr: string,
  dryRun: boolean = true
): Promise<void> {
  try {
    console.log("\n🚀 INICIANDO PROCESSAMENTO DE PAGAMENTOS DO RANKING DIÁRIO");
    console.log("=".repeat(70));
    console.log(`📅 Data: ${dateStr}`);
    console.log(`🏆 Competição: ${campaignSlug}`);
    console.log(`🔧 Modo: ${dryRun ? "DRY RUN (simulação)" : "PRODUÇÃO (pagamentos reais)"}`);
    console.log("=".repeat(70));
    console.log("");

    // 1. Buscar campanha
    const campaign = await prisma.campaign.findUnique({
      where: { slug: campaignSlug },
      include: {
        activeRankingRule: true,
      },
    });

    if (!campaign) {
      throw new Error(`❌ Campanha não encontrada: ${campaignSlug}`);
    }

    if (!campaign.activeRankingRule) {
      throw new Error(`❌ Campanha sem regra de ranking ativa`);
    }

    console.log(`✅ Campanha encontrada: ${campaign.name}`);
    console.log(`📊 Regra de ranking: ${campaign.activeRankingRule.label} (v${campaign.activeRankingRule.version})`);
    console.log("");

    // 2. Calcular janela de tempo (22h do dia anterior até 22h do dia especificado)
    const targetDate = new Date(dateStr);
    
    // Horário de Brasília (UTC-3)
    const nowBrasilia = new Date(targetDate.getTime() - (3 * 60 * 60 * 1000));
    
    // 22h do dia anterior
    const yesterday22hBrasilia = new Date(nowBrasilia);
    yesterday22hBrasilia.setDate(yesterday22hBrasilia.getDate() - 1);
    yesterday22hBrasilia.setHours(22, 0, 0, 0);
    
    // 22h do dia especificado
    const today22hBrasilia = new Date(nowBrasilia);
    today22hBrasilia.setHours(22, 0, 0, 0);

    console.log(`⏰ Janela de tempo do ranking:`);
    console.log(`   Início: ${yesterday22hBrasilia.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
    console.log(`   Fim: ${today22hBrasilia.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
    console.log("");

    // 3. Definir lista de URLs e prêmios (do ranking que você forneceu)
    const rankingData = [
      { position: 1, url: "https://www.tiktok.com/@politicas.de.dire/video/7569420328821181703", prize: 350, expectedUsername: "@@Politicas.de.dire" },
      { position: 2, url: "https://www.facebook.com/reel/1535401140829310/", prize: 200, expectedUsername: "@@vivaoextraordinarioo" },
      { position: 3, url: "https://youtube.com/shorts/8MVAtqVD0Y4?feature=share", prize: 150, expectedUsername: "@@politicanewssp" },
      { position: 4, url: "https://www.facebook.com/reel/4161857917390228/", prize: 25, expectedUsername: "@@vivaoextraordinarioo" },
      { position: 5, url: "https://www.tiktok.com/@politicas.de.dire/video/7569439985837870343", prize: 25, expectedUsername: "@@Politicas.de.dire" },
      { position: 6, url: "https://www.facebook.com/reel/1124575956324594", prize: 25, expectedUsername: "@@Magnata.br1" },
      { position: 7, url: "https://www.facebook.com/reel/25115423054773378", prize: 25, expectedUsername: "@@politicanewssp" },
      { position: 8, url: "https://www.facebook.com/reel/1136758888602372/", prize: 25, expectedUsername: "@@vivaoextraordinarioo" },
      { position: 9, url: "https://www.facebook.com/reel/863981372806213", prize: 25, expectedUsername: "@@nomeiodapolitica" },
      { position: 10, url: "https://youtube.com/shorts/z9nS6nnbHHQ?si=WFahmU8jCDwQJ8TQ", prize: 25, expectedUsername: "@@resumodopoderr" },
      { position: 11, url: "https://youtube.com/shorts/kmv6Qi1MqUs?si=sYRdODfD7hA9oBwz", prize: 25, expectedUsername: "@@spemfoco-y6z" },
      { position: 12, url: "https://www.instagram.com/reel/DQsrTGzDdue/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==", prize: 25, expectedUsername: "@@portaldojaca" },
      { position: 13, url: "https://www.facebook.com/reel/673706762233753/", prize: 25, expectedUsername: "@@vivaoextraordinarioo" },
      { position: 14, url: "https://www.facebook.com/reel/835617402311074", prize: 25, expectedUsername: "@@nomeiodapolitica" },
      { position: 15, url: "https://www.facebook.com/reel/720844620387993", prize: 25, expectedUsername: "@@vivaoextraordinarioo" },
    ];

    console.log(`🔍 Buscando posts do ranking pelo submittedUrl...`);
    console.log(`   Campaign ID: ${campaign.id}`);
    console.log(`   Total de posts no ranking: ${rankingData.length}`);
    console.log("");

    // Buscar cada post pela URL exata
    const posts: Array<any> = [];
    const notFoundUrls: string[] = [];
    
    for (const item of rankingData) {
      console.log(`   Buscando: ${item.url.substring(0, 60)}...`);
      
      const post = await prisma.clipPost.findFirst({
        where: {
          campaignId: campaign.id,
          submittedUrl: item.url,
        },
        include: {
          application: {
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
          },
        },
      });

      if (post) {
        posts.push({ ...post, expectedPosition: item.position, expectedPrize: item.prize });
        console.log(`   ✅ Encontrado: ${post.application.clipperProfile.artisticName || post.application.clipperProfile.fullName} (@${post.username})`);
        console.log(`      Post ID: ${post.id} | Views: ${Number(post.views)} | Status: ${post.status}`);
      } else {
        notFoundUrls.push(item.url);
        console.log(`   ❌ NÃO ENCONTRADO no banco de dados`);
      }
    }

    console.log("");
    console.log(`📝 Posts encontrados: ${posts.length}/${rankingData.length}`);
    
    if (notFoundUrls.length > 0) {
      console.log(`⚠️  URLs não encontradas no banco de dados:`);
      notFoundUrls.forEach(url => console.log(`   - ${url}`));
      console.log("");
    }
    
    if (posts.length === 0) {
      console.log("⚠️  Nenhum post encontrado no ranking diário para esta data.");
      return;
    }

    console.log("");
    console.log("🏆 RANKING DIÁRIO - TOP 15");
    console.log("-".repeat(70));

    // 4. Extrair tabela de prêmios
    const prizeTable = campaign.activeRankingRule.dailyPrizeTable as Record<string, number>;
    
    console.log(`💰 Tabela de prêmios da regra de ranking:`);
    console.log(`   ${JSON.stringify(prizeTable, null, 2)}`);
    console.log("");
    
    // Função auxiliar para obter o prêmio baseado na posição
    const getPrizeAmount = (position: number): number => {
      // Verificar prêmio exato
      if (prizeTable[position.toString()]) {
        return prizeTable[position.toString()] as number;
      }
      
      // Verificar intervalos (ex: "4-15")
      for (const [key, value] of Object.entries(prizeTable)) {
        if (key.includes("-")) {
          const parts = key.split("-").map(Number);
          const start = parts[0];
          const end = parts[1];
          if (start && end && position >= start && position <= end) {
            return value as number;
          }
        }
      }
      
      return 0;
    };

    // 5. Preparar lista de pagamentos
    const payments: PaymentResult[] = [];

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const position = post.expectedPosition; // Usar a posição esperada do ranking
      const amount = post.expectedPrize; // Usar o prêmio esperado do ranking
      const clipperProfile = post.application.clipperProfile;
      const clipperName = clipperProfile.artisticName || clipperProfile.fullName;

      console.log(
        `${position}º ${clipperName.padEnd(20)} | R$ ${amount.toString().padStart(6)} | ${Number(post.views).toLocaleString('pt-BR').padStart(10)} views | @${post.username}`
      );

      if (amount > 0) {
        payments.push({
          success: false,
          clipperName,
          position,
          amount,
        });
      }
    }

    console.log("-".repeat(70));
    console.log(`💵 Total a pagar: ${payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
    console.log(`👥 Clipadores a receber: ${payments.length}`);
    console.log("");

    if (dryRun) {
      console.log("⚠️  DRY RUN MODE - Nenhum pagamento foi processado.");
      console.log("   Para executar os pagamentos reais, remova o flag --dry-run");
      console.log("");
      return;
    }

    // 6. Confirmar antes de processar
    console.log("⚠️  ATENÇÃO: Você está prestes a processar pagamentos REAIS!");
    console.log("   Pressione Ctrl+C para cancelar ou aguarde 5 segundos...");
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log("");
    console.log("💳 PROCESSANDO PAGAMENTOS...");
    console.log("=".repeat(70));

    // 7. Processar cada pagamento
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const position = post.expectedPosition; // Usar posição do ranking
      const amount = post.expectedPrize; // Usar prêmio do ranking

      if (amount === 0) continue;

      const clipperProfile = post.application.clipperProfile;
      const clipperName = clipperProfile.artisticName || clipperProfile.fullName;

      try {
        console.log(`\n🔄 Processando pagamento ${i + 1}/${posts.length}...`);
        console.log(`   Clipper: ${clipperName} (${clipperProfile.id})`);
        console.log(`   Username: @${post.username}`);
        console.log(`   Posição: ${position}º`);
        console.log(`   Valor: R$ ${amount}`);
        console.log(`   URL do post: ${post.submittedUrl.substring(0, 80)}...`);
        
        // a) Buscar ou criar wallet
        console.log(`   📂 Buscando wallet...`);
        let wallet = await prisma.wallet.findUnique({
          where: { clipperProfileId: clipperProfile.id },
        });

        if (!wallet) {
          console.log(`   ⚠️  Wallet não encontrada. Criando nova wallet...`);
          wallet = await prisma.wallet.create({
            data: {
              clipperProfileId: clipperProfile.id,
              balance: 0,
              totalEarned: 0,
              totalWithdrawn: 0,
              pendingWithdraw: 0,
              currency: "BRL",
              isActive: true,
            },
          });
          console.log(`   ✅ Wallet criada: ${wallet.id}`);
        } else {
          console.log(`   ✅ Wallet encontrada: ${wallet.id}`);
          console.log(`   💰 Saldo atual: R$ ${wallet.balance}`);
        }

        // b) Calcular novos saldos
        const newBalance = wallet.balance + amount;
        const newTotalEarned = wallet.totalEarned + amount;
        console.log(`   📊 Novo saldo: R$ ${newBalance}`);
        console.log(`   📊 Total ganho histórico: R$ ${newTotalEarned}`);

        // c) Formatar data para descrição
        const dateFormatted = new Date(dateStr).toLocaleDateString('pt-BR', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric' 
        });

        const description = `Prêmio ${position}º lugar - Ranking Diário ${dateFormatted}`;
        console.log(`   📝 Descrição: ${description}`);

        // d) Criar transação
        console.log(`   💳 Criando transação...`);
        const transaction = await prisma.transaction.create({
          data: {
            walletId: wallet.id,
            type: "PRIZE_CREDIT",
            status: "COMPLETED",
            amount: amount,
            balanceBefore: wallet.balance,
            balanceAfter: newBalance,
            description,
            campaignId: campaign.id,
            rankingPosition: position,
            processedAt: new Date(),
          },
        });
        console.log(`   ✅ Transação criada: ${transaction.id}`);

        // e) Atualizar wallet
        console.log(`   💼 Atualizando wallet...`);
        await prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: newBalance,
            totalEarned: newTotalEarned,
          },
        });
        console.log(`   ✅ Wallet atualizada`);

        // f) Enviar email
        if (clipperProfile.user?.email) {
          console.log(`   📧 Enviando email para: ${clipperProfile.user.email}`);
          await resend.emails.send({
            from: "ClipfyAI <noreply@league.clipfyai.com>",
            to: clipperProfile.user.email,
            subject: `🏆 Pagamento Recebido: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)}`,
            html: getPaymentNotificationEmailTemplate(
              clipperProfile.fullName,
              amount,
              "PRIZE_CREDIT",
              description,
              newBalance,
              campaign.name,
              position,
              "daily"
            ),
          });
          console.log(`   ✅ Email enviado com sucesso`);
        } else {
          console.log(`   ⚠️  Sem email cadastrado - email não enviado`);
        }

        console.log(`✅ ${position}º ${clipperName} - R$ ${amount} - Transaction ID: ${transaction.id}`);
        
        // Atualizar o payment correspondente
        const paymentIndex = payments.findIndex(p => p.position === position && p.clipperName === clipperName);
        if (paymentIndex >= 0 && payments[paymentIndex]) {
          payments[paymentIndex]!.success = true;
        }

      } catch (error: any) {
        console.error(`❌ ${position}º ${clipperName} - ERRO: ${error.message}`);
        
        // Atualizar o payment correspondente com erro
        const paymentIndex = payments.findIndex(p => p.position === position && p.clipperName === clipperName);
        if (paymentIndex >= 0 && payments[paymentIndex]) {
          payments[paymentIndex]!.error = error.message;
        }
      }
    }

    console.log("=".repeat(70));
    console.log("");
    console.log("📊 RESUMO FINAL");
    console.log("-".repeat(70));
    console.log(`✅ Pagamentos processados com sucesso: ${payments.filter(p => p.success).length}`);
    console.log(`❌ Pagamentos com erro: ${payments.filter(p => !p.success).length}`);
    console.log(`💰 Total pago: ${payments.filter(p => p.success).reduce((sum, p) => sum + p.amount, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
    console.log("");

    if (payments.some(p => !p.success)) {
      console.log("⚠️  ATENÇÃO: Alguns pagamentos falharam!");
      console.log("Pagamentos com erro:");
      payments.filter(p => !p.success).forEach(p => {
        console.log(`   ${p.position}º ${p.clipperName} - ${p.error}`);
      });
    }

    console.log("");
    console.log("✅ Processamento concluído!");
    console.log("");

  } catch (error: any) {
    console.error("");
    console.error("❌ ERRO FATAL:", error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// ============================================================================
// EXECUÇÃO DO SCRIPT
// ============================================================================

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error("");
  console.error("❌ Uso incorreto!");
  console.error("");
  console.error("Uso: npx tsx scripts/pay-daily-ranking.ts <campaignSlug> <date> [--dry-run]");
  console.error("");
  console.error("Exemplos:");
  console.error("  npx tsx scripts/pay-daily-ranking.ts tarcisio-de-freitas-nov 2025-11-06 --dry-run");
  console.error("  npx tsx scripts/pay-daily-ranking.ts tarcisio-de-freitas-nov 2025-11-06");
  console.error("");
  process.exit(1);
}

const campaignSlug = args[0];
const dateStr = args[1];
const dryRun = args.includes("--dry-run");

if (!campaignSlug || !dateStr) {
  console.error("❌ Parâmetros obrigatórios não fornecidos!");
  process.exit(1);
}

payDailyRanking(campaignSlug, dateStr, dryRun);

