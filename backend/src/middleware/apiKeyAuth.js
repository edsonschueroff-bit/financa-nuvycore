const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers["x-nuvy-integracao-key"] || req.headers["x-api-key"] || req.query.apiKey;
  const chavesValidas = [
    process.env.NUVY_INTEGRATION_KEY,
    process.env.NUVY_INTEGRATION_KEY_LEGADO,
  ].filter(Boolean);

  if (chavesValidas.length === 0) {
    console.error("[SECURITY] NUVY_INTEGRATION_KEY não está definida nas variáveis de ambiente!");
    return res.status(500).json({ error: "Configuração de segurança ausente no servidor." });
  }

  if (!apiKey || !chavesValidas.includes(apiKey)) {
    return res.status(401).json({
      error: "Acesso não autorizado. Chave de integração inválida ou ausente.",
    });
  }

  next();
};

module.exports = apiKeyAuth;

