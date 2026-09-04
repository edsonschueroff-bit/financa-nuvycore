const express = require("express");
const router = express.Router();
const categoriaController = require("../controllers/categoriaController");
const { auth } = require("../middleware/auth");
const { requireTenant } = require("../middleware/tenant");

router.use(auth, requireTenant);

// Categorias
router.get("/", categoriaController.listarCategorias);
router.post("/", categoriaController.criarCategoria);
router.put("/:id", categoriaController.atualizarCategoria);
router.delete("/:id", categoriaController.deletarCategoria);

// Centros de Custo
router.get("/centros-custo/todos", categoriaController.listarCentrosCusto);
router.post("/centros-custo", categoriaController.criarCentroCusto);
router.put("/centros-custo/:id", categoriaController.atualizarCentroCusto);
router.delete("/centros-custo/:id", categoriaController.deletarCentroCusto);

module.exports = router;
