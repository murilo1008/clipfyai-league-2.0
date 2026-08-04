import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkTransactions() {
  try {
    console.log("\n🔍 VERIFICANDO ÚLTIMAS TRANSAÇÕES...\n");

    // Buscar as últimas 20 transações criadas hoje
    const transactions = await prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)), // Desde meia-noite de hoje
        },
      },
      include: {
        wallet: {
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
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log(`📊 Total de transações encontradas: ${transactions.length}\n`);
    console.log("═".repeat(100));
    console.log(`${"#".padEnd(4)} | ${"Clipper".padEnd(20)} | ${"Email".padEnd(35)} | ${"Valor".padEnd(10)} | ${"Posição".padEnd(10)} | Transaction ID`);
    console.log("═".repeat(100));

    transactions.forEach((tx, i) => {
      const clipperName = tx.wallet.clipperProfile.artisticName || tx.wallet.clipperProfile.fullName;
      const email = tx.wallet.clipperProfile.user?.email || "N/A";
      const amount = `R$ ${tx.amount.toFixed(2)}`;
      const position = tx.rankingPosition ? `${tx.rankingPosition}º` : "N/A";

      console.log(
        `${String(i + 1).padEnd(4)} | ${clipperName.padEnd(20)} | ${email.padEnd(35)} | ${amount.padEnd(10)} | ${position.padEnd(10)} | ${tx.id}`
      );
    });

    console.log("═".repeat(100));
    console.log(`\n💰 Total pago: R$ ${transactions.reduce((sum, tx) => sum + tx.amount, 0).toFixed(2)}\n`);

    // Contar quantos clipadores únicos
    const uniqueClippers = new Set(transactions.map(tx => tx.wallet.clipperProfileId));
    console.log(`👥 Clipadores únicos que receberam: ${uniqueClippers.size}`);

    // Contar quantos emails únicos
    const uniqueEmails = new Set(transactions.map(tx => tx.wallet.clipperProfile.user?.email).filter(e => e));
    console.log(`📧 Emails únicos: ${uniqueEmails.size}\n`);

  } catch (error) {
    console.error("Erro:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTransactions();

