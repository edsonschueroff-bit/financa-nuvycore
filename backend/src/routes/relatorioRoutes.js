const express = require("express");
const router = express.Router();
const relatoriosController = require("../controllers/relatoriosFinanceirosController");
const { auth } = require("../middleware/auth");
const { requireTenant } = require("../middleware/tenant");

router.use(auth, requireTenant);

router.get("/dashboard", relatoriosController.dashboardKpis);
router.get("/dre", relatoriosController.dreGerencial);
router.get("/fluxo-caixa-projetado", relatoriosController.fluxoCaixaProjetado);
router.get("/rateio-centros-custo", relatoriosController.relatorioRateioCentrosCusto);

module.exports = router;
