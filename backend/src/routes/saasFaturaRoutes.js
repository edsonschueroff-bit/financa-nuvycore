const express = require("express");
const router = express.Router();
const saasFaturaController = require("../controllers/saasFaturaController");
const { auth, superAdminOnly } = require("../middleware/auth");

// Rotas Autenticadas
router.get("/", auth, saasFaturaController.listar);
router.post("/:id/gerar-pix", auth, saasFaturaController.gerarPix);
router.post("/:id/pagar-cartao", auth, saasFaturaController.pagarCartao);
router.post("/:id/liquidar", auth, superAdminOnly, saasFaturaController.liquidarFatura);
router.delete("/:id", auth, superAdminOnly, saasFaturaController.deletarFatura);

// Gerenciamento de Gateways pelo Super Admin
router.get("/metricas-saas", auth, superAdminOnly, saasFaturaController.obterMetricasSaas);
router.get("/gateways", auth, superAdminOnly, saasFaturaController.getGateways);
router.post("/gateways", auth, superAdminOnly, saasFaturaController.salvarGateway);

// Webhooks Públicos (Mercado Pago & Asaas / Notificação Automática de Pagamento)
router.post("/webhook/mercadopago", saasFaturaController.webhookMercadoPago);
router.get("/webhook/mercadopago", saasFaturaController.webhookMercadoPago);
router.post("/webhook/asaas", saasFaturaController.webhookAsaas);
router.get("/webhook/asaas", (req, res) => res.send("Asaas Webhook SaaS Ativo"));

module.exports = router;
