const express = require("express");
const router = express.Router();
const orcamentoController = require("../controllers/orcamentoController");
const { auth } = require("../middleware/auth");

router.get("/matriz", auth, orcamentoController.obterMatriz);
router.post("/salvar-lote", auth, orcamentoController.salvarLote);

module.exports = router;
