require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

const authRoutes = require("./src/routes/authRoutes");
const transacaoRoutes = require("./src/routes/transacaoRoutes");
const contaBancariaRoutes = require("./src/routes/contaBancariaRoutes");
const categoriaRoutes = require("./src/routes/categoriaRoutes");
const contatoRoutes = require("./src/routes/contatoRoutes");
const relatorioRoutes = require("./src/routes/relatorioRoutes");
const empresaRoutes = require("./src/routes/empresaRoutes");
const saasPlanoRoutes = require("./src/routes/saasPlanoRoutes");
const saasFaturaRoutes = require("./src/routes/saasFaturaRoutes");
const brandingRoutes = require("./src/routes/brandingRoutes");
const openfinanceRoutes = require("./src/routes/openfinanceRoutes");
const conciliacaoRoutes = require("./src/routes/conciliacaoRoutes");
const investimentoRoutes = require("./src/routes/investimentoRoutes");
const precificacaoRoutes = require("./src/routes/precificacaoRoutes");
const orcamentoRoutes = require("./src/routes/orcamentoRoutes");
const inteligenciaRoutes = require("./src/routes/inteligenciaRoutes");
const integracaoWhatsappRoutes = require("./src/routes/integracaoWhatsappRoutes");
const integracaoTelegramRoutes = require("./src/routes/integracaoTelegramRoutes");
const usuarioTenantRoutes = require("./src/routes/usuarioTenantRoutes");
const assinaturaTenantRoutes = require("./src/routes/assinaturaTenantRoutes");
const notificacaoRoutes = require("./src/routes/notificacaoRoutes");
const auditoriaRoutes = require("./src/routes/auditoriaRoutes");
const gatewayTenantRoutes = require("./src/routes/gatewayTenantRoutes");
const suporteRoutes = require("./src/routes/suporteRoutes");
const comunicadosRoutes = require("./src/routes/comunicadosRoutes");
const smsnetWebhookRoutes = require("./src/routes/smsnetWebhookRoutes");

const app = express();
const PORT = process.env.PORT || 3005;

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

const allowedOrigins = [
  "https://financas.nuvycore.online",
  "http://financas.nuvycore.online",
  "https://www.financas.nuvycore.online",
  "http://www.financas.nuvycore.online",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
];

// Se houver origens adicionais configuradas no .env, adicioná-las dinamicamente
if (process.env.CORS_ORIGIN) {
  process.env.CORS_ORIGIN.split(",").forEach((orig) => {
    const limpo = orig.trim();
    if (limpo && !allowedOrigins.includes(limpo)) {
      allowedOrigins.push(limpo);
    }
  });
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite requisições sem origin (ex: webhooks server-to-server, curl interno, apps móveis)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn("[CORS] Bloqueio de origem não autorizada:", origin);
      return callback(new Error("Origem não autorizada por política de CORS."));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "X-Nuvy-Integracao-Key",
      "X-API-Key",
      "asaas-access-token",
    ],
  })
);

// Middleware dedicado de tratamento de erro do CORS (retorna 403 padronizado em vez de 500)
app.use((err, req, res, next) => {
  if (err && err.message === "Origem não autorizada por política de CORS.") {
    return res.status(403).json({ error: "Origem não autorizada por política de segurança." });
  }
  next(err);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir uploads estáticos (comprovantes, logos)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/uploads", express.static(path.join(__dirname, "uploads")));

// 1. Rate Limiting Específico para Webhooks Públicos (60 req/min por IP)
const { apiLimiter, webhookLimiter } = require("./src/middleware/rateLimiters");
app.use("/api/webhooks/smsnet", webhookLimiter, smsnetWebhookRoutes);
app.use("/api/v1/whatsapp", webhookLimiter, smsnetWebhookRoutes);
app.use("/v1/whatsapp", webhookLimiter, smsnetWebhookRoutes);
app.use("/api/v1", webhookLimiter, smsnetWebhookRoutes);
app.use("/api/integracoes/whatsapp/webhook", webhookLimiter);
app.use("/api/integracao-whatsapp/webhook", webhookLimiter);
app.use("/api/integracoes/telegram/webhook", webhookLimiter);
app.use("/api/saas-faturas/webhook", webhookLimiter);

// 2. Rate Limiting Geral para todas as demais rotas /api (300 req/min por IP real)
app.use("/api", apiLimiter);

// Rotas da API
app.use("/api/auth", authRoutes);
app.use("/api/transacoes", transacaoRoutes);
app.use("/api/contas-bancarias", contaBancariaRoutes);
app.use("/api/categorias", categoriaRoutes);
app.use("/api/contatos", contatoRoutes);
app.use("/api/relatorios", relatorioRoutes);
app.use("/api/empresas", empresaRoutes);
app.use("/api/saas-planos", saasPlanoRoutes);
app.use("/api/saas-faturas", saasFaturaRoutes);
app.use("/api/branding", brandingRoutes);
app.use("/api/openfinance", openfinanceRoutes);
app.use("/api/conciliacao", conciliacaoRoutes);
app.use("/api/investimentos", investimentoRoutes);
app.use("/api/precificacao", precificacaoRoutes);
app.use("/api/orcamento", orcamentoRoutes);
app.use("/api/inteligencia", inteligenciaRoutes);
app.use("/api/integracoes/whatsapp", integracaoWhatsappRoutes);
app.use("/api/integracao-whatsapp", integracaoWhatsappRoutes);
app.use("/api/integracoes/telegram", integracaoTelegramRoutes);
app.use("/api/usuarios", usuarioTenantRoutes);
app.use("/api/minha-assinatura", assinaturaTenantRoutes);
app.use("/api/notificacoes", notificacaoRoutes);
app.use("/api/auditoria", auditoriaRoutes);
app.use("/api/gateways", gatewayTenantRoutes);
app.use("/api/suporte", suporteRoutes);
app.use("/api/comunicados", comunicadosRoutes);

// Health check
const healthHandler = (req, res) => {
  res.json({
    status: "online",
    service: "Nuvy Finance ERP Backend",
    version: "1.2.0",
    openfinance: "active",
    investimentos_b3: "active",
    timestamp: new Date().toISOString(),
  });
};

app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

// Handler global de erros para a API (garante respostas em JSON)
app.use((err, req, res, next) => {
  console.error("[SERVER ERROR]:", err.message || err);
  if (res.headersSent) {
    return next(err);
  }
  return res.status(err.status || 500).json({
    error: err.message || "Erro interno no servidor.",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[Financeiro Backend] Servidor rodando na porta ${PORT}`);
  console.log(`[CORS] Origens autorizadas:`, allowedOrigins);

  // Configurar webhook do Telegram se o token estiver presente
  if (process.env.TELEGRAM_BOT_TOKEN) {
    const { configurarWebhookTelegramAuto } = require("./src/controllers/integracaoTelegramController");
    configurarWebhookTelegramAuto().then(() => {
      console.log("[Telegram Bot] Webhook oficial registrado com sucesso!");
    }).catch(e => {
      console.error("[Telegram Bot] Erro ao registrar webhook:", e.message);
    });
  }

  // Iniciar agendador de rotinas diárias (Resumo Matinal & Régua de Cobrança)
  const { iniciarAgendadores } = require("./src/services/cronScheduler");
  iniciarAgendadores();
});
