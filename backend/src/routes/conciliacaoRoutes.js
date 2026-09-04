const express = require("express");
const router = express.Router();
const conciliacaoController = require("../controllers/conciliacaoController");
const { auth } = require("../middleware/auth");
const { requireTenant, exigirPermissao } = require("../middleware/tenant");

router.use(auth, requireTenant);

// Leitura livre para membros autenticados
router.get("/extrato-pendente", conciliacaoController.listarExtratoPendente);

// Escrita (Exige permissão de conciliação)
router.post("/conciliar", exigirPermissao("conciliacao"), conciliacaoController.conciliarComExistente);
router.post("/criar-e-conciliar", exigirPermissao("conciliacao"), conciliacaoController.criarEConciliar);
router.post("/ignorar/:id", exigirPermissao("conciliacao"), conciliacaoController.ignorarItemExtrato);
router.post("/limpar-fila", exigirPermissao("conciliacao"), conciliacaoController.limparFila);

module.exports = router;
