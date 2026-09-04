const express = require("express");
const router = express.Router();
const transacaoController = require("../controllers/transacaoController");
const { uploadComprovante } = require("../config/uploadConfig");
const { auth } = require("../middleware/auth");
const { requireTenant, exigirPermissao } = require("../middleware/tenant");

router.use(auth, requireTenant);

// Leitura (Livre para qualquer membro do tenant autenticado)
router.get("/", transacaoController.listar);
router.get("/:id", transacaoController.obterPorId);
router.get("/:id/cobranca-pix", transacaoController.gerarCobrancaPix);

// Escrita & Alteração (Exige permissão de pagar OU receber)
router.post("/", exigirPermissao("pagar", "receber"), transacaoController.criar);
router.post("/upload-comprovante", exigirPermissao("pagar", "receber"), uploadComprovante.single("comprovante"), transacaoController.uploadComprovante);
router.delete("/:id/remover-comprovante", exigirPermissao("pagar", "receber"), transacaoController.removerComprovante);
router.post("/baixar-lote", exigirPermissao("pagar", "receber"), transacaoController.baixarEmLote);
router.post("/deletar-lote", exigirPermissao("pagar", "receber"), transacaoController.deletarLote);
router.post("/:id/baixar", exigirPermissao("pagar", "receber"), transacaoController.baixar);
router.post("/:id/estornar", exigirPermissao("pagar", "receber"), transacaoController.estornar);
router.put("/:id", exigirPermissao("pagar", "receber"), transacaoController.atualizar);
router.delete("/:id", exigirPermissao("pagar", "receber"), transacaoController.deletar);

module.exports = router;
