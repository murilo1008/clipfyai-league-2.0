import 'dotenv/config';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

function getEmailTemplate() {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Primeira Competição Clipfy League</title>
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
    <div style="background: #1a1a1a; border: 2px solid #14F7FF; padding: 32px 24px; border-radius: 16px; margin: 0 16px 32px; text-align: center; box-shadow: 0 0 30px rgba(20, 247, 255, 0.2);">
      <div style="display: inline-block; background: linear-gradient(135deg, #14F7FF 0%, #37FF9F 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 8px;">
        <h1 style="margin: 0; font-size: 36px; font-weight: 900; color: #14F7FF; line-height: 1.2; letter-spacing: -0.5px;">
          🏆 PRIMEIRA COMPETIÇÃO
        </h1>
        <h1 style="margin: 4px 0 0; font-size: 36px; font-weight: 900; color: #37FF9F; line-height: 1.2; letter-spacing: -0.5px;">
          CLIPFY LEAGUE!
        </h1>
      </div>
      
      <div style="margin-top: 20px; padding: 16px 24px; background: rgba(20, 247, 255, 0.1); border-radius: 12px; display: inline-block;">
        <p style="margin: 0; font-size: 14px; font-weight: 600; color: #14F7FF; text-transform: uppercase; letter-spacing: 1px;">
          💰 Premiação Total
        </p>
        <p style="margin: 8px 0 0; font-size: 32px; font-weight: 900; color: #37FF9F; line-height: 1;">
          R$ 50.000,00
        </p>
      </div>
    </div>

    <!-- Conteúdo Principal -->
    <div style="padding: 0 24px 32px;">
      
      <!-- Informações da Competição -->
      <div style="background: #111111; border: 1px solid #333333; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #14F7FF;">
          📅 Quando?
        </h2>
        <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
          <strong style="color: #37FF9F;">Início:</strong> 03 de Novembro de 2025<br/>
          A primeira competição oficial da Clipfy League está chegando!
        </p>
      </div>

      <!-- Call to Action Principal -->
      <div style="text-align: center; margin: 32px 0;">
        <p style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #ffffff;">
          🎯 Pronto para competir pelos R$ 50.000?
        </p>
        <a href="https://league.clipfyai.com/onboarding" 
           target="_blank" 
           style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #14F7FF 0%, #37FF9F 100%); color: #000000; text-decoration: none; border-radius: 12px; font-weight: 800; font-size: 16px; box-shadow: 0 4px 20px rgba(20, 247, 255, 0.3); transition: transform 0.2s;">
          ✅ COMPLETAR CADASTRO AGORA
        </a>
      </div>

      <!-- Discord - Presença Obrigatória -->
      <div style="background: linear-gradient(135deg, #5865F2 0%, #7289DA 100%); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
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
           style="display: inline-block; padding: 14px 28px; background: #ffffff; color: #5865F2; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px;">
          🎮 Entrar no Discord
        </a>
      </div>

      <!-- O que você precisa fazer -->
      <div style="background: #111111; border: 1px solid #333333; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 700; color: #14F7FF;">
          ✨ O que você precisa fazer:
        </h2>
        
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; vertical-align: top;">
              <table role="presentation" style="width: 28px; height: 28px; border-radius: 14px; background: #14F7FF; overflow: hidden; float: left; margin-right: 12px;">
                <tr>
                  <td align="center" valign="middle" style="text-align: center; vertical-align: middle; height: 28px; font-size: 18px; color: #000000; font-weight: 900; line-height: 28px;">1</td>
                </tr>
              </table>
              <div style="overflow: hidden;">
                <p style="margin: 0; font-size: 15px; font-weight: 600; color: #ffffff; line-height: 28px;">
                  Complete seu cadastro na plataforma
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; vertical-align: top;">
              <table role="presentation" style="width: 28px; height: 28px; border-radius: 14px; background: #14F7FF; overflow: hidden; float: left; margin-right: 12px;">
                <tr>
                  <td align="center" valign="middle" style="text-align: center; vertical-align: middle; height: 28px; font-size: 18px; color: #000000; font-weight: 900; line-height: 28px;">2</td>
                </tr>
              </table>
              <div style="overflow: hidden;">
                <p style="margin: 0; font-size: 15px; font-weight: 600; color: #ffffff; line-height: 28px;">
                  Entre no Discord da Clipfy League
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; vertical-align: top;">
              <table role="presentation" style="width: 28px; height: 28px; border-radius: 14px; background: #14F7FF; overflow: hidden; float: left; margin-right: 12px;">
                <tr>
                  <td align="center" valign="middle" style="text-align: center; vertical-align: middle; height: 28px; font-size: 18px; color: #000000; font-weight: 900; line-height: 28px;">3</td>
                </tr>
              </table>
              <div style="overflow: hidden;">
                <p style="margin: 0; font-size: 15px; font-weight: 600; color: #ffffff; line-height: 28px;">
                  Aguarde o início da competição em 03/11
                </p>
              </div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Por que participar? -->
      <div style="background: #111111; border: 1px solid #333333; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 700; color: #37FF9F;">
          🎁 Por que participar?
        </h2>
        <ul style="margin: 0; padding: 0 0 0 20px; list-style: none;">
          <li style="margin-bottom: 12px; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #14F7FF; font-weight: 900;">✓</span>
            <strong style="color: #ffffff;">R$ 50.000</strong> em prêmios para os melhores
          </li>
          <li style="margin-bottom: 12px; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #14F7FF; font-weight: 900;">✓</span>
            Mostre seu talento e ganhe <strong style="color: #ffffff;">visibilidade</strong>
          </li>
          <li style="margin-bottom: 12px; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #14F7FF; font-weight: 900;">✓</span>
            Competição <strong style="color: #ffffff;">justa e transparente</strong>
          </li>
          <li style="margin-bottom: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0; position: relative; padding-left: 24px;">
            <span style="position: absolute; left: 0; color: #14F7FF; font-weight: 900;">✓</span>
            Faça parte da <strong style="color: #ffffff;">maior liga de clippers do Brasil</strong>
          </li>
        </ul>
      </div>

      <!-- CTA Final -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="https://league.clipfyai.com/onboarding" 
           target="_blank" 
           style="display: inline-block; padding: 18px 40px; background: linear-gradient(135deg, #14F7FF 0%, #37FF9F 100%); color: #000000; text-decoration: none; border-radius: 12px; font-weight: 800; font-size: 18px; box-shadow: 0 4px 20px rgba(20, 247, 255, 0.4);">
          🚀 COMEÇAR AGORA
        </a>
      </div>

    </div>

    <!-- Redes Sociais -->
    <div style="text-align: center; padding: 24px; background: #0a0a0a; border-top: 1px solid #222222;">
      <p style="margin: 0 0 16px 0; font-size: 14px; color: #888888;">
        Siga a Clipfy League nas redes sociais:
      </p>
      <div style="margin: 0 0 20px 0;">
        <!--[if mso]>
        <table role="presentation" align="center" style="margin: 0 auto;">
          <tr>
            <td style="padding: 0 5px;">
        <![endif]-->
        <a href="https://tiktok.com/@clipfyai" target="_blank" style="display: inline-block; margin: 5px; padding: 12px 20px; background: #14F7FF; color: #000000; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
          🎵 TikTok
        </a>
        <!--[if mso]>
            </td>
            <td style="padding: 0 5px;">
        <![endif]-->
        <a href="https://instagram.com/clipfyai" target="_blank" style="display: inline-block; margin: 5px; padding: 12px 20px; background: #37FF9F; color: #000000; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
          📸 Instagram
        </a>
        <!--[if mso]>
            </td>
            <td style="padding: 0 5px;">
        <![endif]-->
        <a href="https://discord.gg/f2eNVbYnzn" target="_blank" style="display: inline-block; margin: 5px; padding: 12px 20px; background: #5865F2; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
          💬 Discord
        </a>
        <!--[if mso]>
            </td>
          </tr>
        </table>
        <![endif]-->
      </div>
      <p style="margin: 16px 0 0 0; font-size: 12px; color: #666666; line-height: 1.5;">
        © 2026 Clipfy League. Todos os direitos reservados.<br/>
        Você está recebendo este email porque se cadastrou na Clipfy League.
      </p>
    </div>

  </div>
</body>
</html>
  `;
}

async function main() {
  try {
    console.log('📧 Enviando email de teste...');
    console.log('⚠️  Usando domínio de teste (onboarding@resend.dev)');
    console.log('📬 Para: clipfy.ai@gmail.com\n');

    const { data, error } = await resend.emails.send({
      from: 'Clipfy League <onboarding@resend.dev>',
      to: ['clipfy.ai@gmail.com'],
      subject: '🏆 PRIMEIRA COMPETIÇÃO CLIPFY LEAGUE - R$ 50.000 em Prêmios! Começa 03/11',
      html: getEmailTemplate(),
    });

    if (error) {
      console.error('❌ Erro ao enviar email:', error);
      process.exit(1);
    }

    console.log('✅ Email enviado com sucesso!');
    console.log(`📬 ID: ${data?.id}`);
    console.log(`📧 Enviado para: clipfy.ai@gmail.com\n`);
    console.log('='.repeat(50));
    console.log('✨ Verifique sua caixa de entrada!');
    console.log('='.repeat(50));
    console.log('\n💡 Para enviar do domínio clipfyai.com:');
    console.log('   1. Verifique o domínio no Resend');
    console.log('   2. Atualize o .env com a nova API key "League"');
    console.log('   3. Use o script test-competition-email.ts');

  } catch (error) {
    console.error('❌ Erro ao enviar email:', error);
    process.exit(1);
  }
}

main();

