import { Resend } from "resend";
import * as dotenv from "dotenv";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function main() {
  try {
    console.log("📧 Testando envio de email simples...\n");

    const result = await resend.emails.send({
      from: "ClipfyAI League <noreply@league.clipfyai.com>",
      to: "murilo.rocha.mattoso@gmail.com",
      subject: "🧪 Teste de Email - ClipfyAI",
      html: `
        <h1>Teste de Email</h1>
        <p>Este é um email de teste simples da ClipfyAI League.</p>
        <p>Se você recebeu este email, a configuração do Resend está funcionando corretamente.</p>
        <p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</p>
      `,
    });

    console.log("✅ Email enviado com sucesso!");
    console.log(`📧 Email ID: ${result.data?.id}`);
    console.log(`📬 Para: murilo.rocha.mattoso@gmail.com`);
    console.log(`\n⏰ Aguarde alguns segundos para o email chegar...`);
  } catch (error: any) {
    console.error("❌ Erro ao enviar email:", error);
  }
}

main();

