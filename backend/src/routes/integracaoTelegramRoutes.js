const express = require("express");
const router = express.Router();
const {
  processarWebhookTelegram,
  configurarWebhookTelegramAuto,
} = require("../controllers/integracaoTelegramController");

// Rota pública de webhook chamada pelos servidores do Telegram
router.post("/webhook", processarWebhookTelegram);
router.all("/webhook", processarWebhookTelegram);

// Rota para setup / registrar webhook manualmente
router.get("/setup-webhook", configurarWebhookTelegramAuto);
router.post("/setup-webhook", configurarWebhookTelegramAuto);

module.exports = router;
