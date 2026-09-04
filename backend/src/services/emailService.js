const nodemailer = require("nodemailer");

/**
 * Cria o transporte SMTP para a Hostinger
 */
function obterTransportador() {
  const host = process.env.SMTP_HOST || "smtp.hostinger.com";
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const secure = process.env.SMTP_SECURE === "false" ? false : true;
  const user = process.env.SMTP_USER || "contato@nuvycore.online";
  const pass = process.env.SMTP_PASS;

  if (!pass) {
    console.warn("[EMAIL SERVICE]: SMTP_PASS não configurada. Defina no .env para habilitar envio real.");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

/**
 * Envia E-mail de Boas-Vindas no cadastro de nova empresa / teste
 */
async function enviarEmailBoasVindas({ to, nomeGestor, nomeEmpresa, empresaSlug }) {
  try {
    const transporter = obterTransportador();
    if (!transporter) {
      console.warn(`[EMAIL BOAS-VINDAS]: E-mail para ${to} ignorado pois SMTP_PASS não está preenchida.`);
      return { enviado: false, motivo: "SMTP_PASS não configurada" };
    }

    const appUrl = process.env.APP_URL || "https://financas.nuvycore.online";
    const linkAcesso = `${appUrl}/admin/${empresaSlug}`;
    const remetente = process.env.SMTP_FROM || `"Nuvy Finance" <${process.env.SMTP_USER || "contato@nuvycore.online"}>`;

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Bem-vindo ao Nuvy Finance</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090d16; color: #e2e8f0; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #0f172a; border-radius: 16px; border: 1px solid #1e293b; overflow: hidden; }
        .header { background: linear-gradient(135deg, #059669 0%, #0d9488 100%); padding: 36px 30px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
        .header p { margin: 8px 0 0 0; opacity: 0.9; font-size: 14px; }
        .content { padding: 32px 30px; line-height: 1.6; font-size: 15px; color: #cbd5e1; }
        .card-credenciais { background: #1e293b; border-radius: 12px; padding: 20px; margin: 24px 0; border-left: 4px solid #10b981; }
        .btn-acessar { display: block; width: fit-content; margin: 30px auto; background: #10b981; color: #ffffff !important; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 12px; text-align: center; font-size: 16px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4); }
        .footer { padding: 24px 30px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; }
        .feature-item { margin-bottom: 12px; display: flex; align-items: center; }
        .badge { background: #064e3b; color: #34d399; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; margin-right: 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Nuvy Finance</h1>
          <p>O ERP Financeiro Inteligente com Copiloto IA</p>
        </div>
        
        <div class="content">
          <p>Olá, <strong>${nomeGestor}</strong>! 👋</p>
          <p>Seja muito bem-vindo ao <strong>Nuvy Finance</strong>. Sua conta para a empresa <strong>${nomeEmpresa}</strong> foi criada com sucesso e seu período de teste já está liberado!</p>
          
          <div class="card-credenciais">
            <h3 style="margin-top: 0; color: #f8fafc; font-size: 16px;">🔑 Seus Dados de Acesso:</h3>
            <p style="margin: 6px 0;"><strong>Empresa:</strong> ${nomeEmpresa}</p>
            <p style="margin: 6px 0;"><strong>E-mail de Login:</strong> ${to}</p>
            <p style="margin: 6px 0;"><strong>Seu Link Direto:</strong> <a href="${linkAcesso}" style="color: #34d399;">${linkAcesso}</a></p>
          </div>

          <a href="${linkAcesso}" class="btn-acessar">Acessar Meu Painel Agora 🚀</a>

          <h4 style="color: #f8fafc; margin-top: 30px;">⚡ Primeiros passos para aproveitar ao máximo:</h4>
          <p class="feature-item"><span class="badge">1</span> Conecte o <strong>WhatsApp ou Telegram da Cora</strong> para lançar despesas por voz, áudio ou foto de comprovante PIX.</p>
          <p class="feature-item"><span class="badge">2</span> Cadastre suas contas bancárias e cartões para acompanhar o saldo consolidado.</p>
          <p class="feature-item"><span class="badge">3</span> Receba o <strong>Resumo Matinal Diário</strong> com o briefing completo de quanto tem a pagar e a receber hoje!</p>
        </div>
        
        <div class="footer">
          <p>Nuvy Finance • contato@nuvycore.online</p>
          <p>Se você não solicitou este cadastro, por favor ignore este e-mail.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    const info = await transporter.sendMail({
      from: remetente,
      to,
      subject: `🎉 Bem-vindo ao Nuvy Finance - ${nomeEmpresa}`,
      html: htmlContent,
    });

    console.log(`[EMAIL BOAS-VINDAS]: E-mail enviado com sucesso para ${to}! ID:`, info.messageId);
    return { enviado: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[EMAIL BOAS-VINDAS ERROR] Falha ao enviar para ${to}:`, err.message);
    return { enviado: false, erro: err.message };
  }
}

/**
 * Envia E-mail com Token e Código para Recuperação de Senha
 */
async function enviarEmailRecuperacaoSenha({ to, nome, resetLink, codigo }) {
  try {
    const transporter = obterTransportador();
    if (!transporter) {
      console.warn(`[EMAIL RESET]: E-mail para ${to} ignorado pois SMTP_PASS não está preenchida.`);
      return { enviado: false, motivo: "SMTP_PASS não configurada" };
    }

    const remetente = process.env.SMTP_FROM || `"Nuvy Finance" <${process.env.SMTP_USER || "contato@nuvycore.online"}>`;

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Recuperação de Senha - Nuvy Finance</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090d16; color: #e2e8f0; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #0f172a; border-radius: 16px; border: 1px solid #1e293b; overflow: hidden; }
        .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 30px; text-align: center; color: #ffffff; border-bottom: 2px solid #10b981; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 800; color: #10b981; }
        .content { padding: 32px 30px; line-height: 1.6; font-size: 15px; color: #cbd5e1; }
        .card-codigo { background: #1e293b; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center; border: 1px dashed #10b981; }
        .codigo-val { font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #34d399; font-family: monospace; margin: 10px 0; }
        .btn-redefinir { display: block; width: fit-content; margin: 26px auto; background: #10b981; color: #ffffff !important; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 12px; text-align: center; font-size: 16px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4); }
        .footer { padding: 20px 30px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Nuvy Finance</h1>
          <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 14px;">Solicitação de Recuperação de Acesso</p>
        </div>
        
        <div class="content">
          <p>Olá, <strong>${nome}</strong>! 👋</p>
          <p>Recebemos uma solicitação para redefinir a senha da sua conta no <strong>Nuvy Finance</strong>.</p>
          
          <div class="card-codigo">
            <span style="font-size: 12px; text-transform: uppercase; color: #94a3b8; font-weight: bold; letter-spacing: 1px;">Seu Código de 6 Dígitos:</span>
            <div class="codigo-val">${codigo}</div>
            <span style="font-size: 12px; color: #64748b;">(Válido por 30 minutos)</span>
          </div>

          <p style="text-align: center; margin: 20px 0 10px 0;">Ou clique no botão abaixo para definir sua nova senha diretamente:</p>
          <a href="${resetLink}" class="btn-redefinir">Redefinir Minha Senha 🔐</a>

          <p style="font-size: 13px; color: #64748b; margin-top: 25px;">
            ⚠️ <em>Se você não solicitou a alteração de senha, nenhuma ação é necessária. Sua senha atual permanece segura.</em>
          </p>
        </div>
        
        <div class="footer">
          <p>Nuvy Finance • contato@nuvycore.online</p>
        </div>
      </div>
    </body>
    </html>
    `;

    const info = await transporter.sendMail({
      from: remetente,
      to,
      subject: `🔐 Código de Recuperação de Senha: ${codigo} - Nuvy Finance`,
      html: htmlContent,
    });

    console.log(`[EMAIL RESET]: E-mail enviado com sucesso para ${to}! ID:`, info.messageId);
    return { enviado: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[EMAIL RESET ERROR] Falha ao enviar para ${to}:`, err.message);
    return { enviado: false, erro: err.message };
  }
}

module.exports = {
  obterTransportador,
  enviarEmailBoasVindas,
  enviarEmailRecuperacaoSenha,
};
