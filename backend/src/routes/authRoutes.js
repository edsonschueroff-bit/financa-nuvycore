const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { auth } = require("../middleware/auth");
const { loginLimiter } = require("../middleware/rateLimiters");

router.post("/login", loginLimiter, authController.login);
router.post("/register-trial", authController.registerTrial);
router.post("/forgot-password", loginLimiter, authController.forgotPassword);
router.post("/reset-password", loginLimiter, authController.resetPassword);
router.get("/me", auth, authController.me);
router.post("/switch-empresa", auth, authController.switchEmpresa);
router.put("/perfil", auth, authController.atualizarPerfil);

module.exports = router;
