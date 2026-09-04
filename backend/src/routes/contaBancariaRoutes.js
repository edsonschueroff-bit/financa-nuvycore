const express = require("express");
const router = express.Router();
const contaBancariaController = require("../controllers/contaBancariaController");
const { auth } = require("../middleware/auth");
const { requireTenant } = require("../middleware/tenant");

router.use(auth, requireTenant);

router.get("/", contaBancariaController.listar);
router.get("/transferencias", contaBancariaController.listarTransferencias);
router.get("/:id/extrato", contaBancariaController.extrato);
router.post("/", contaBancariaController.criar);
router.post("/transferir", contaBancariaController.transferir);
router.post("/:id/ajustar-saldo", contaBancariaController.ajustarSaldo);
router.put("/:id", contaBancariaController.atualizar);
router.delete("/:id", contaBancariaController.deletar);

module.exports = router;
