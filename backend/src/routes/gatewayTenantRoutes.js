const express = require("express");
const router = express.Router();
const gatewayController = require("../controllers/gatewayTenantController");
const { auth } = require("../middleware/auth");
const { requireTenant } = require("../middleware/tenant");

// Rota pública de Webhook
router.post("/webhook/:empresaId/:provedor", gatewayController.webhook);

// Rotas autenticadas do Tenant
router.get("/", auth, requireTenant, gatewayController.listar);
router.post("/salvar", auth, requireTenant, gatewayController.salvar);
router.post("/testar", auth, requireTenant, gatewayController.testar);
router.post("/gerar-cobranca", auth, requireTenant, gatewayController.gerarCobranca);

module.exports = router;
