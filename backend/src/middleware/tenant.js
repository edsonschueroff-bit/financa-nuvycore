const db = require("../../db");

const requireTenant = (req, res, next) => {
  if (!req.user || !req.user.empresa_id) {
    return res.status(400).json({ error: "Nenhuma empresa selecionada para esta operação." });
  }

  // Verificar se o tenant está bloqueado por inadimplência no SaaS
  if (req.user.empresa_status === 'bloqueado' && !req.user.is_super) {
    return res.status(403).json({ 
      error: "Acesso bloqueado temporariamente por pendência financeira. Regularize sua assinatura.",
      bloqueado: true
    });
  }

  req.empresaId = req.user.empresa_id;
  next();
};

// Permissões padrão por perfil de fallback caso permissoes venha null
const PERMISSOES_PADRAO = {
  proprietario: [
    "dashboard", "dre", "receber", "pagar", "contas", "conciliacao",
    "investimentos", "precificacao", "orcamento", "inteligencia",
    "contatos", "categorias", "automacoes", "usuarios"
  ],
  gerente_financeiro: [
    "dashboard", "dre", "receber", "pagar", "contas", "conciliacao",
    "investimentos", "precificacao", "orcamento", "inteligencia",
    "contatos", "categorias", "automacoes"
  ],
  operador: ["dashboard", "receber", "pagar", "contas", "contatos", "categorias"],
  contador: ["dashboard", "dre", "conciliacao", "contas", "categorias"],
  visualizador: ["dashboard", "dre", "relatorios"],
};

const exigirPermissao = (...modulosRequeridos) => {
  return (req, res, next) => {
    // Super admin e proprietário têm acesso irrestrito
    if (req.user?.is_super || req.user?.role === "proprietario") {
      return next();
    }

    let listaPermissoes = [];
    try {
      const permissoes = req.user?.permissoes;
      if (Array.isArray(permissoes)) {
        listaPermissoes = permissoes;
      } else if (typeof permissoes === "string" && permissoes.trim() !== "") {
        listaPermissoes = JSON.parse(permissoes);
      } else if (req.user?.role && PERMISSOES_PADRAO[req.user.role]) {
        listaPermissoes = PERMISSOES_PADRAO[req.user.role];
      }
    } catch (err) {
      console.error("[RBAC] Falha ao interpretar permissões do usuário:", req.user?.id, err.message);
      listaPermissoes = [];
    }

    // Permite se o usuário possuir qualquer um dos módulos requeridos informados
    const temPermissao = Array.isArray(listaPermissoes) && modulosRequeridos.some((m) => listaPermissoes.includes(m));

    if (!temPermissao) {
      console.warn("[RBAC] Acesso negado:", {
        usuario_id: req.user?.id,
        empresa_id: req.user?.empresa_id,
        role: req.user?.role,
        rota: req.originalUrl,
        metodo: req.method,
        modulos_requeridos: modulosRequeridos,
      });
      return res.status(403).json({
        error: `Acesso negado. Você não tem permissão para acessar esta operação (${modulosRequeridos.join(" ou ")}).`,
      });
    }

    next();
  };
};

module.exports = { requireTenant, exigirPermissao };
