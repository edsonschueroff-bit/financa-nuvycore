const express = require("express");
const router = express.Router();
const assinaturaTenantController = require("../controllers/assinaturaTenantController");
const { auth } = require("../middleware/auth");

router.get("/", auth, assinaturaTenantController.obterMinhaAssinatura);
router.post("/trocar-plano", auth, assinaturaTenantController.trocarPlano);

module.exports = router;
