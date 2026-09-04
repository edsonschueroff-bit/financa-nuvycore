const express = require("express");
const router = express.Router();
const empresaController = require("../controllers/empresaController");
const { auth, superAdminOnly } = require("../middleware/auth");

router.get("/minha", auth, empresaController.obterEmpresaAtual);
router.put("/minha", auth, empresaController.atualizarEmpresa);
router.put("/dados-fiscais", auth, empresaController.atualizarDadosFiscais);
router.get("/cnpj/:cnpj", auth, empresaController.consultarCnpj);
router.get("/cep/:cep", auth, empresaController.consultarCep);

// Automações & WhatsApp do Tenant
router.get("/automacoes-whatsapp", auth, empresaController.obterConfiguracoesAutomacoes);
router.put("/automacoes-whatsapp", auth, empresaController.salvarConfiguracoesAutomacoes);

// Super admin rotas
router.get("/todas", auth, superAdminOnly, empresaController.listarEmpresas);
router.post("/nova", auth, superAdminOnly, empresaController.criarEmpresa);
router.put("/:id", auth, superAdminOnly, empresaController.atualizarEmpresa);
router.patch("/:id/status", auth, superAdminOnly, empresaController.alterarStatusSaas);
router.post("/:id/estender-trial", auth, superAdminOnly, empresaController.estenderTrial);
router.get("/:id/dossie", auth, superAdminOnly, empresaController.obterDossieEmpresa);
router.delete("/:id", auth, superAdminOnly, empresaController.excluirEmpresa);

module.exports = router;
