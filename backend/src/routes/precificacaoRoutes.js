const express = require("express");
const router = express.Router();
const precificacaoController = require("../controllers/precificacaoController");
const { auth } = require("../middleware/auth");

router.get("/", auth, precificacaoController.listar);
router.post("/simular", auth, precificacaoController.simular);
router.post("/", auth, precificacaoController.criar);
router.put("/:id", auth, precificacaoController.atualizar);
router.delete("/:id", auth, precificacaoController.deletar);

module.exports = router;
