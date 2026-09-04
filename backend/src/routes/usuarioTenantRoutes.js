const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const { requireTenant, exigirPermissao } = require("../middleware/tenant");
const usuarioTenantController = require("../controllers/usuarioTenantController");

// Todas as rotas exigem autenticação e contexto de empresa
router.use(auth);
router.use(requireTenant);

router.get("/", usuarioTenantController.listarUsuarios);
router.post("/", exigirPermissao("usuarios"), usuarioTenantController.criarUsuario);
router.put("/:id", exigirPermissao("usuarios"), usuarioTenantController.atualizarUsuario);
router.delete("/:id", exigirPermissao("usuarios"), usuarioTenantController.removerUsuario);

module.exports = router;
