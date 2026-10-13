type CompetitionVideoEmailInput = {
  recipientName: string;
  campaignName: string;
  campaignSlug: string;
  videoTitle: string;
  videoUrl: string;
  appUrl?: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character] ?? character;
  });
}

export function buildCompetitionVideoEmail(input: CompetitionVideoEmailInput) {
  const name = input.recipientName.trim().split(/\s+/)[0] || "Clipador";
  const campaignName = input.campaignName.trim().replace(/\s+/g, " ");
  const videoTitle = input.videoTitle.trim() || "Novo conteúdo oficial";
  const competitionUrl = new URL(
    `/my-competitions/${encodeURIComponent(input.campaignSlug)}`,
    input.appUrl || "https://league.clipfyai.com",
  ).toString();
  const subject = `Vídeo obrigatório disponível — ${campaignName}`;
  const preheader = `Novo conteúdo em ${campaignName}. Assista ao vídeo e prepare seus próximos cortes.`;
  const safeName = escapeHtml(name);
  const safeCampaignName = escapeHtml(campaignName);
  const safeTitle = escapeHtml(videoTitle);
  const safeVideoUrl = escapeHtml(input.videoUrl);
  const safeCompetitionUrl = escapeHtml(competitionUrl);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#03101b;font-family:Arial,Helvetica,sans-serif;color:#ecf7f9;">
    <div style="display:none;font-size:1px;line-height:1px;color:#03101b;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#03101b;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
            <tr>
              <td style="padding:8px 12px 24px;">
                <p style="margin:0;font-size:24px;font-weight:800;letter-spacing:-0.6px;color:#ecf7f9;">Clipfy<span style="color:#14f7ff;"> League</span></p>
                <p style="margin:6px 0 0;font-size:11px;letter-spacing:2px;color:#8aa3b3;">CONTEÚDO OFICIAL DA COMPETIÇÃO</p>
              </td>
            </tr>
            <tr>
              <td style="background-color:#071b29;border:1px solid #1d3b49;border-radius:20px;overflow:hidden;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td width="50%" height="4" style="background-color:#14f7ff;font-size:0;line-height:0;">&nbsp;</td>
                    <td width="50%" height="4" style="background-color:#37ff9f;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding:28px 24px;">
                      <p style="margin:0 0 16px;font-size:11px;font-weight:700;letter-spacing:1.5px;color:#37ff9f;">NOVO VÍDEO OBRIGATÓRIO PARA CORTE</p>
                      <h1 style="margin:0 0 20px;font-size:28px;line-height:1.25;letter-spacing:-0.6px;color:#ecf7f9;">Seu próximo corte<br>começa aqui.</h1>
                      <p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:#b6ccd6;">Olá, <strong style="color:#ecf7f9;">${safeName}</strong>!</p>
                      <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#b6ccd6;">Um novo vídeo obrigatório está disponível na competição <strong style="color:#ecf7f9;">${safeCampaignName}</strong>. Confira o conteúdo e use os melhores momentos para produzir seus próximos cortes.</p>

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0c2635;border:1px solid #245062;border-radius:12px;">
                        <tr>
                          <td style="padding:20px;">
                            <p style="margin:0 0 8px;font-size:11px;letter-spacing:1px;color:#8aa3b3;">VÍDEO SELECIONADO</p>
                            <h2 style="margin:0;font-size:20px;line-height:1.4;overflow-wrap:anywhere;color:#ecf7f9;">${safeTitle}</h2>
                            <p style="margin:10px 0 0;font-size:13px;line-height:1.6;color:#8aa3b3;">Conteúdo oficial de ${safeCampaignName}</p>
                          </td>
                        </tr>
                      </table>

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td align="center" style="padding:24px 0;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                              <tr>
                                <td align="center" bgcolor="#14f7ff" style="background-color:#14f7ff;border-radius:10px;mso-padding-alt:16px 28px;">
                                  <a href="${safeVideoUrl}" target="_blank" style="display:inline-block;padding:16px 28px;border:1px solid #14f7ff;border-radius:10px;font-size:16px;font-weight:700;line-height:1.2;color:#04222a;text-decoration:none;">Assistir ao vídeo</a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      <h2 style="margin:0 0 16px;font-size:16px;color:#ecf7f9;">Próximos passos</h2>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td width="28" valign="top" style="padding:0 0 14px;font-size:14px;font-weight:700;color:#37ff9f;">01</td>
                          <td style="padding:0 0 14px;font-size:14px;line-height:1.6;color:#b6ccd6;">Assista ao vídeo e escolha os trechos para seus cortes.</td>
                        </tr>
                        <tr>
                          <td width="28" valign="top" style="padding:0 0 14px;font-size:14px;font-weight:700;color:#37ff9f;">02</td>
                          <td style="padding:0 0 14px;font-size:14px;line-height:1.6;color:#b6ccd6;">Edite e publique seguindo as regras, hashtags e menções da competição.</td>
                        </tr>
                        <tr>
                          <td width="28" valign="top" style="padding:0 0 20px;font-size:14px;font-weight:700;color:#37ff9f;">03</td>
                          <td style="padding:0 0 20px;font-size:14px;line-height:1.6;color:#b6ccd6;">Envie o link do seu post pela página da competição na Clipfy League.</td>
                        </tr>
                      </table>

                      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;"><a href="${safeCompetitionUrl}" target="_blank" style="font-weight:700;color:#14f7ff;text-decoration:underline;">Abrir competição na Clipfy League</a></p>
                      <p style="margin:0;padding-top:20px;border-top:1px solid #1d3b49;font-size:12px;line-height:1.7;color:#8aa3b3;">Se o botão não abrir, copie o link do vídeo no seu navegador:<br><a href="${safeVideoUrl}" style="color:#8aa3b3;text-decoration:underline;word-break:break-all;">${safeVideoUrl}</a></p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 16px 8px;">
                <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#37ff9f;">Bons cortes! Equipe Clipfy League</p>
                <p style="margin:0;font-size:11px;line-height:1.7;color:#8aa3b3;">Você recebeu este aviso porque está aprovado na competição ${safeCampaignName}.<br>Esta é uma mensagem automática da Clipfy League.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `Olá, ${name}!

Um novo vídeo obrigatório para corte está disponível na competição ${campaignName}.

VÍDEO SELECIONADO
${videoTitle}

Assistir ao vídeo: ${input.videoUrl}

PRÓXIMOS PASSOS
1. Assista ao vídeo e escolha os trechos para seus cortes.
2. Edite e publique seguindo as regras, hashtags e menções da competição.
3. Envie o link do seu post pela página da competição na Clipfy League.

Abrir competição na Clipfy League: ${competitionUrl}

Bons cortes!
Equipe Clipfy League

Você recebeu este aviso porque está aprovado na competição ${campaignName}.
Esta é uma mensagem automática da Clipfy League.`;

  return { subject, html, text };
}
