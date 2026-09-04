const express = require("express");
const router = express.Router();
const saasPlanoController = require("../controllers/saasPlanoController");
const { auth, superAdminOnly } = require("../middleware/auth");

router.get("/", auth, saasPlanoController.listar);
router.post("/", auth, superAdminOnly, saasPlanoController.criar);
router.put("/:id", auth, superAdminOnly, saasPlanoController.atualizar);
router.delete("/:id", auth, superAdminOnly, saasPlanoController.deletar);
router.patch("/:id/toggle-ativo", auth, superAdminOnly, saasPlanoController.toggleAtivo);
router.patch("/:id/toggle-popular", auth, superAdminOnly, saasPlanoController.togglePopular);

module.exports = router;
