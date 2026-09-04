const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const notificacaoController = require("../controllers/notificacaoController");

router.use(auth);

router.get("/", notificacaoController.listar);
router.post("/:id/marcar-lida", notificacaoController.marcarLida);
router.post("/marcar-todas-lidas", notificacaoController.marcarTodasLidas);
router.delete("/limpar", notificacaoController.limpar);

module.exports = router;
