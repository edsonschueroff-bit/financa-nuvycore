const express = require("express");
const router = express.Router();
const comunicadosController = require("../controllers/comunicadosController");
const { auth, superAdminOnly } = require("../middleware/auth");
const { requireTenant } = require("../middleware/tenant");

// Rotas do Tenant
router.get("/ativos", auth, requireTenant, comunicadosController.listarAtivosTenant);
router.post("/:id/dispensar", auth, comunicadosController.dispensarComunicado);

// Rotas do Super Admin
router.get("/admin", auth, superAdminOnly, comunicadosController.listarTodosSuperAdmin);
router.post("/admin", auth, superAdminOnly, comunicadosController.criarComunicado);
router.put("/admin/:id", auth, superAdminOnly, comunicadosController.atualizarComunicado);
router.delete("/admin/:id", auth, superAdminOnly, comunicadosController.excluirComunicado);

module.exports = router;
