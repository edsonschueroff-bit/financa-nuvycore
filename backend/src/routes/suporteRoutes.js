const express = require("express");
const router = express.Router();
const suporteController = require("../controllers/suporteController");
const { auth, superAdminOnly } = require("../middleware/auth");
const { requireTenant } = require("../middleware/tenant");

// Rotas do Tenant
router.get("/chamados", auth, requireTenant, suporteController.listarPorTenant);
router.post("/chamados", auth, requireTenant, suporteController.criarChamado);
router.get("/chamados/:id", auth, suporteController.obterDetalhes);
router.post("/chamados/:id/mensagens", auth, suporteController.adicionarMensagem);
router.patch("/chamados/:id/status", auth, suporteController.atualizarStatus);

// Rotas do Super Admin
router.get("/admin/chamados", auth, superAdminOnly, suporteController.listarTodosSuperAdmin);

module.exports = router;
