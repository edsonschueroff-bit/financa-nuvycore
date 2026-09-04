const express = require("express");
const router = express.Router();
const inteligenciaController = require("../controllers/inteligenciaController");
const { auth } = require("../middleware/auth");

router.get("/capital-giro", auth, inteligenciaController.obterCapitalGiro);
router.get("/curva-abc", auth, inteligenciaController.obterCurvaABC);

module.exports = router;
