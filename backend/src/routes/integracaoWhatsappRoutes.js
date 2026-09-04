const express = require("express");
const router = express.Router();
const apiKeyAuth = require("../middleware/apiKeyAuth");
const { auth } = require("../middleware/auth");
const {
  identificarUsuario,
  lancarTransacao,
  resumoDia,
  consultarDreResumo,
  processarMensagemIA,
  processarMidiaMensagem,
  notificarAtendimentoHumano,
  dispararReguaCobranca,
  dispararResumoMatinalGeral,
  enviarResumoMatinalTeste,
  enviarCobrancaExemploTeste,
  obterStatusInstancia,
  gerarQrCodeInstancia,
  desconectarInstancia,
  enviarMensagemTeste,
  obterStatusInstanciaTenant,
  conectarInstanciaTenant,
  desconectarInstanciaTenant,
  enviarSmsTeste,
  dispararSmsDireto,
  obterConfigSmsnetSuper,
  salvarConfigSmsnetSuper,
} = require("../controllers/integracaoWhatsappController");

// Middleware que aceita ou JWT de Super Admin ou API Key
const authOrApiKey = (req, res, next) => {
  const apiKey = req.headers["x-nuvy-integracao-key"] || req.headers["x-api-key"] || req.query.apiKey;
  const chavesValidas = [
    process.env.NUVY_INTEGRATION_KEY,
    process.env.NUVY_INTEGRATION_KEY_LEGADO,
  ].filter(Boolean);

  if (chavesValidas.length === 0) {
    console.error("[SECURITY] NUVY_INTEGRATION_KEY não está definida nas variáveis de ambiente!");
    return res.status(500).json({ error: "Configuração de segurança ausente no servidor." });
  }

  if (apiKey && chavesValidas.includes(apiKey)) {
    return next();
  }

  // Caso contrário, autentica via JWT do Super Admin
  return auth(req, res, next);
};

// Rota pública de Webhook chamada pela Evolution API
router.post("/webhook", processarMensagemIA);
router.all("/webhook", processarMensagemIA);

// Rotas com API Key para n8n e integrações
router.post("/identificar-usuario", apiKeyAuth, identificarUsuario);
router.post("/lancar-transacao", apiKeyAuth, lancarTransacao);
router.post("/processar-mensagem-ia", apiKeyAuth, processarMensagemIA);
router.post("/processar-midia", apiKeyAuth, processarMidiaMensagem);
// Rota chamada pelo n8n quando detecta fromMe=true (atendente respondeu pelo celular)
router.post("/pausar-atendimento", apiKeyAuth, notificarAtendimentoHumano);
router.get("/resumo-dia", apiKeyAuth, resumoDia);
router.get("/consultar-dre-resumo", apiKeyAuth, consultarDreResumo);

// Disparo de SMS via SMSNET para o n8n ou integrações
router.post("/disparar-sms", authOrApiKey, dispararSmsDireto);
router.post("/sms/enviar", authOrApiKey, dispararSmsDireto);


// Régua de Cobrança e Resumo Matinal (aceita API Key do n8n OU JWT logado do painel)
router.post("/cobrancas/disparar-regua", authOrApiKey, dispararReguaCobranca);
router.get("/cobrancas/disparar-regua", authOrApiKey, dispararReguaCobranca);
router.post("/resumo-matinal/disparar", authOrApiKey, dispararResumoMatinalGeral);
router.get("/resumo-matinal/disparar", authOrApiKey, dispararResumoMatinalGeral);

// Testes Manuais de Disparo para o WhatsApp do Gestor / SMS
router.post("/testar-resumo-matinal", authOrApiKey, enviarResumoMatinalTeste);
router.post("/testar-cobranca", authOrApiKey, enviarCobrancaExemploTeste);
router.post("/testar-sms", authOrApiKey, enviarSmsTeste);

// Configuração Global do SMSNET (Super Admin)
router.get("/super/smsnet", authOrApiKey, obterConfigSmsnetSuper);
router.post("/super/smsnet", authOrApiKey, salvarConfigSmsnetSuper);

// Rotas de Gestão de Instância / QR Code para o Painel Super Admin
router.get("/evolution/status", authOrApiKey, obterStatusInstancia);
router.post("/evolution/qrcode", authOrApiKey, gerarQrCodeInstancia);
router.post("/evolution/disconnect", authOrApiKey, desconectarInstancia);
router.post("/evolution/test-message", authOrApiKey, enviarMensagemTeste);

// Rotas de Conexão WhatsApp Exclusiva do Tenant (Empresa Contratante)
router.get("/tenant/status", auth, obterStatusInstanciaTenant);
router.post("/tenant/conectar", auth, conectarInstanciaTenant);
router.post("/tenant/desconectar", auth, desconectarInstanciaTenant);

module.exports = router;
