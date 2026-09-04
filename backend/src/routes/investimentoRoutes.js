const express = require("express");
const router = express.Router();
const investimentoController = require("../controllers/investimentoController");
const { auth } = require("../middleware/auth");
const { requireTenant, exigirPermissao } = require("../middleware/tenant");

router.use(auth, requireTenant);

// Resumo e Cotações Reais B3 (Leitura livre para membros)
router.get("/resumo", investimentoController.resumoPatrimonial);
router.get("/cotacao-real/:ticker", investimentoController.consultarCotacaoTicker);

// Operações de Escrita/Sincronização (Exige permissão de investimentos)
router.post("/sincronizar-b3", exigirPermissao("investimentos"), investimentoController.sincronizarCotacoesB3);
router.post("/limpar-demo", exigirPermissao("investimentos"), investimentoController.limparDadosDemo);

// Ativos
router.get("/ativos", investimentoController.listarAtivos);
router.post("/ativos", exigirPermissao("investimentos"), investimentoController.criarAtivo);
router.post("/importar", exigirPermissao("investimentos"), investimentoController.importarPlanilhaB3);
router.put("/ativos/:id", exigirPermissao("investimentos"), investimentoController.atualizarAtivo);
router.delete("/ativos/:id", exigirPermissao("investimentos"), investimentoController.deletarAtivo);

// Carteiras
router.get("/carteiras", investimentoController.listarCarteiras);
router.post("/carteiras", exigirPermissao("investimentos"), investimentoController.criarCarteira);
router.delete("/carteiras/:id", exigirPermissao("investimentos"), investimentoController.deletarCarteira);

// Proventos
router.get("/proventos", investimentoController.listarProventos);
router.post("/proventos", exigirPermissao("investimentos"), investimentoController.registrarProvento);

module.exports = router;
