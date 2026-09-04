const express = require("express");
const router = express.Router();
const brandingController = require("../controllers/brandingController");
const { auth } = require("../middleware/auth");

router.get("/", brandingController.obterBranding);
router.post("/", auth, brandingController.salvarBranding);

module.exports = router;
