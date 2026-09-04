const axios = require("axios");
const FormData = require("form-data");

const getBaseUrl = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  return `https://api.telegram.org/bot${token}`;
};

/**
 * Envia mensagem de texto para um chat do Telegram
 */
const enviarMensagemTelegram = async (chatId, texto, extraOptions = {}) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) {
    console.warn("[TELEGRAM] Token ou ChatId ausente.");
    return null;
  }

  try {
    const payload = {
      chat_id: chatId,
      text: texto,
      parse_mode: extraOptions.parse_mode || "Markdown",
      ...extraOptions,
    };

    const res = await axios.post(`${getBaseUrl()}/sendMessage`, payload, { timeout: 10000 });
    return res.data;
  } catch (err) {
    console.error(`[TELEGRAM] Erro ao enviar mensagem para ${chatId}:`, err.response?.data || err.message);
    if (err.response?.data?.description?.includes("can't parse entities")) {
      try {
        const resRetry = await axios.post(`${getBaseUrl()}/sendMessage`, {
          chat_id: chatId,
          text: texto,
        });
        return resRetry.data;
      } catch (retryErr) {
        console.error(`[TELEGRAM] Erro no retry texto puro:`, retryErr.message);
      }
    }
    return null;
  }
};

/**
 * Envia documento PDF / arquivo para um chat do Telegram
 */
const enviarDocumentoTelegram = async (chatId, bufferArquivo, nomeArquivo = "documento.pdf", legenda = "") => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return null;

  try {
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("document", bufferArquivo, { filename: nomeArquivo, contentType: "application/pdf" });
    if (legenda) {
      form.append("caption", legenda);
      form.append("parse_mode", "Markdown");
    }

    const res = await axios.post(`${getBaseUrl()}/sendDocument`, form, {
      headers: form.getHeaders(),
      timeout: 30000,
    });
    return res.data;
  } catch (err) {
    console.error(`[TELEGRAM] Erro ao enviar documento PDF para ${chatId}:`, err.response?.data || err.message);
    return null;
  }
};

/**
 * Envia mensagem com teclado inline de botões clicáveis
 */
const enviarBotoesTelegram = async (chatId, texto, botoesMatriz) => {
  return enviarMensagemTelegram(chatId, texto, {
    reply_markup: {
      inline_keyboard: botoesMatriz,
    },
  });
};

/**
 * Responde a um Callback Query (click do botão)
 */
const responderCallbackQuery = async (callbackQueryId, textoAlerta = null) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !callbackQueryId) return;
  try {
    await axios.post(`${getBaseUrl()}/answerCallbackQuery`, {
      callback_query_id: callbackQueryId,
      text: textoAlerta || "",
      show_alert: false,
    });
  } catch (e) {
    console.error("[TELEGRAM] Erro ao responder callback query:", e.message);
  }
};

/**
 * Registra o Webhook no Telegram
 */
const registrarWebhookTelegram = async (urlWebhook) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  try {
    const res = await axios.post(`${getBaseUrl()}/setWebhook`, {
      url: urlWebhook,
      allowed_updates: ["message", "callback_query"],
    });
    console.log("[TELEGRAM] Webhook configurado com sucesso:", res.data);
    return res.data;
  } catch (err) {
    console.error("[TELEGRAM] Falha ao registrar webhook:", err.response?.data || err.message);
    return false;
  }
};

/**
 * Obter informações do arquivo (áudio ou foto) para download
 */
const obterArquivoTelegram = async (fileId) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  try {
    const res = await axios.get(`${getBaseUrl()}/getFile?file_id=${fileId}`);
    if (res.data?.ok) {
      const filePath = res.data.result.file_path;
      const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
      return { filePath, downloadUrl };
    }
    return null;
  } catch (err) {
    console.error("[TELEGRAM] Erro ao obter arquivo:", err.message);
    return null;
  }
};

module.exports = {
  enviarMensagemTelegram,
  enviarDocumentoTelegram,
  enviarBotoesTelegram,
  responderCallbackQuery,
  registrarWebhookTelegram,
  obterArquivoTelegram,
};
