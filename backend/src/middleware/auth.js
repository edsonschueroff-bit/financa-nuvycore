const jwt = require("jsonwebtoken");
const db = require("../../db");

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Token não fornecido" });
    }

    const [, token] = authHeader.split(" ");
    if (!token) {
      return res.status(401).json({ error: "Token mal formatado" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "financeiro_sec_secret");
    
    // Obter dados atualizados do usuário
    const [rows] = await db.query(
      `SELECT id, nome, email, is_super, empresa_id, status FROM admins WHERE id = ? AND status = 'ativo'`,
      [decoded.id]
    );

    if (!rows.length) {
      return res.status(401).json({ error: "Usuário não encontrado ou inativo" });
    }

    const admin = rows[0];

    // Se o token possui um empresa_id ativo (troca de tenant / switchEmpresa)
    const activeEmpresaId = decoded.activeEmpresaId || admin.empresa_id;

    // Buscar informações da empresa ativa
    let activeEmpresa = null;
    let userRole = 'operador';
    let userCargo = admin.cargo || 'Colaborador';
    let userPermissoes = null;

    if (activeEmpresaId) {
      const [empRows] = await db.query(
        `SELECT e.id, e.nome, e.slug, e.status_saas, e.trial_ate, e.limite_filiais, e.limite_usuarios,
                e.plano_saas_id, p.nome as plano_nome, p.tipo_publico as plano_tipo_publico, p.recursos as plano_recursos
         FROM empresas e
         LEFT JOIN saas_planos p ON p.id = e.plano_saas_id
         WHERE e.id = ?`,
        [activeEmpresaId]
      );
      if (empRows.length) {
        activeEmpresa = empRows[0];
        if (activeEmpresa.plano_recursos && typeof activeEmpresa.plano_recursos === 'string') {
          try {
            activeEmpresa.plano_recursos = JSON.parse(activeEmpresa.plano_recursos);
          } catch (e) {
            activeEmpresa.plano_recursos = {};
          }
        }
      }

      // Buscar o papel e permissões do usuário nessa empresa
      const [relRows] = await db.query(
        `SELECT role, cargo, permissoes, ativo FROM admin_empresas WHERE admin_id = ? AND empresa_id = ?`,
        [admin.id, activeEmpresaId]
      );
      if (relRows.length) {
        userRole = relRows[0].role;
        userCargo = relRows[0].cargo || admin.cargo || 'Colaborador';
        userPermissoes = relRows[0].permissoes;
      } else if (admin.is_super) {
        userRole = 'proprietario';
        userCargo = 'Super Administrador';
      }
    }

    let diasTrialRestantes = null;
    if (activeEmpresa && activeEmpresa.status_saas === 'trial' && activeEmpresa.trial_ate) {
      const trialDate = new Date(activeEmpresa.trial_ate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      trialDate.setHours(0, 0, 0, 0);
      diasTrialRestantes = Math.ceil((trialDate - today) / (1000 * 60 * 60 * 24));
    }

    req.user = {
      id: admin.id,
      nome: admin.nome,
      email: admin.email,
      telefone: admin.telefone,
      cargo: userCargo,
      is_super: Boolean(admin.is_super),
      empresa_id: activeEmpresaId,
      empresa_slug: activeEmpresa ? activeEmpresa.slug : null,
      empresa_nome: activeEmpresa ? activeEmpresa.nome : null,
      empresa_status: activeEmpresa ? activeEmpresa.status_saas : null,
      plano_saas_id: activeEmpresa ? activeEmpresa.plano_saas_id : null,
      plano_nome: activeEmpresa ? activeEmpresa.plano_nome : null,
      plano_tipo_publico: activeEmpresa ? activeEmpresa.plano_tipo_publico : null,
      plano_recursos: activeEmpresa ? activeEmpresa.plano_recursos : null,
      trial_ate: activeEmpresa ? activeEmpresa.trial_ate : null,
      dias_trial_restantes: diasTrialRestantes,
      role: userRole,
      permissoes: userPermissoes,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: "Sessão expirada. Faça login novamente." });
    }
    return res.status(401).json({ error: "Token inválido" });
  }
};

const superAdminOnly = (req, res, next) => {
  if (!req.user || !req.user.is_super) {
    return res.status(403).json({ error: "Acesso restrito ao Super Administrador" });
  }
  next();
};

module.exports = { auth, superAdminOnly };
