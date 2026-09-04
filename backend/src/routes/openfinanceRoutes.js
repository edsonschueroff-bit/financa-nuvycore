const express = require("express");
const router = express.Router();
const openfinanceController = require("../controllers/openfinanceController");
const { auth } = require("../middleware/auth");
const { requireTenant } = require("../middleware/tenant");

// Rota pública de webhook
router.post("/webhook", openfinanceController.webhookOpenFinance);

// Rotas autenticadas do tenant
router.use(auth, requireTenant);
router.get("/conexoes", openfinanceController.listarConexoes);
router.post("/conectar", openfinanceController.conectarBanco);
router.post("/conexoes/:id/sincronizar", openfinanceController.sincronizarConexao);
router.post("/conexoes/:id/desconectar", openfinanceController.desconectarBanco);
router.post("/importar-extrato", openfinanceController.importarExtrato);

module.exports = router;
