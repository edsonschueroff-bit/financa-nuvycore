const express = require("express");
const router = express.Router();
const contatoController = require("../controllers/contatoController");
const { auth } = require("../middleware/auth");
const { requireTenant } = require("../middleware/tenant");

router.use(auth, requireTenant);

router.get("/", contatoController.listar);
router.get("/cnpj/:cnpj", contatoController.consultarCnpj);
router.get("/:id/ficha360", contatoController.obterFicha360);
router.post("/", contatoController.criar);
router.put("/:id", contatoController.atualizar);
router.delete("/:id", contatoController.deletar);

module.exports = router;
