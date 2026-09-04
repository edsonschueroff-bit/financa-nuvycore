const express = require("express");
const router = express.Router();
const auditoriaController = require("../controllers/auditoriaController");
const { auth, superAdminOnly } = require("../middleware/auth");
const { requireTenant } = require("../middleware/tenant");

// Rotas Globais do Super Admin
router.get("/global", auth, superAdminOnly, auditoriaController.listarGlobal);
router.get("/global/estatisticas", auth, superAdminOnly, auditoriaController.estatisticasGlobal);

// Rotas do Tenant
router.get("/", auth, requireTenant, auditoriaController.listar);
router.get("/estatisticas", auth, requireTenant, auditoriaController.estatisticas);

module.exports = router;
