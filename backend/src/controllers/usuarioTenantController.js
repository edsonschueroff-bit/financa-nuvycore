const bcrypt = require("bcryptjs");
const db = require("../../db");

// Lista de módulos padrão do sistema
const MODULOS_SISTEMA = [
  { key: "dashboard", label: "Dashboard Executivo" },
  { key: "dre", label: "DRE Gerencial" },
  { key: "receber", label: "Contas a Receber" },
  { key: "pagar", label: "Contas a Pagar" },
  { key: "contas", label: "Contas & Caixas" },
  { key: "conciliacao", label: "Conciliação Bancária & OFX" },
  { key: "investimentos", label: "Investimentos & B3" },
  { key: "precificacao", label: "Precificação & Markup" },
  { key: "orcamento", label: "Orçamento & Metas" },
  { key: "inteligencia", label: "Inteligência Estratégica" },
  { key: "contatos", label: "Clientes & Fornecedores" },
  { key: "categorias", label: "Plano de Contas" },
  { key: "automacoes", label: "Automações & WhatsApp" },
  { key: "usuarios", label: "Equipe & Usuários" },
];

// Permissões padrão por perfil
const PERMISSOES_POR_PERFIL = {
  proprietario: MODULOS_SISTEMA.map(m => m.key),
  gerente_financeiro: MODULOS_SISTEMA.filter(m => m.key !== "usuarios").map(m => m.key),
  operador: ["dashboard", "receber", "pagar", "contas", "contatos", "categorias"],
  contador: ["dashboard", "dre", "conciliacao", "contas", "categorias"],
  visualizador: ["dashboard", "dre", "relatorios"],
};

// 1. Listar usuários da empresa
const listarUsuarios = async (req, res) => {
  try {
    const empresaId = req.empresaId || req.params.empresaId;
    if (!empresaId) {
      return res.status(400).json({ error: "Empresa não identificada." });
    }

    const [usuarios] = await db.query(
      `SELECT 
        a.id, a.nome, a.email, a.telefone, a.status as admin_status, a.ultimo_login, a.created_at,
        ae.id as vinculacao_id, 
        COALESCE(ae.cargo, a.cargo, 'Colaborador') as cargo,
        COALESCE(ae.role, 'operador') as role,
        ae.permissoes,
        COALESCE(ae.ativo, 1) as ativo
       FROM admin_empresas ae
       JOIN admins a ON a.id = ae.admin_id
       WHERE ae.empresa_id = ?
       ORDER BY ae.role = 'proprietario' DESC, a.nome ASC`,
      [empresaId]
    );

    // Formatar permissões JSON se necessário
    const formatados = usuarios.map(u => {
      let perms = [];
      if (u.role === "proprietario") {
        perms = PERMISSOES_POR_PERFIL.proprietario;
      } else if (u.permissoes) {
        try {
          perms = typeof u.permissoes === "string" ? JSON.parse(u.permissoes) : u.permissoes;
        } catch {
          perms = PERMISSOES_POR_PERFIL[u.role] || [];
        }
      } else {
        perms = PERMISSOES_POR_PERFIL[u.role] || [];
      }

      return {
        ...u,
        permissoes: perms,
      };
    });

    return res.json({
      sucesso: true,
      usuarios: formatados,
      modulos_disponiveis: MODULOS_SISTEMA,
    });
  } catch (err) {
    console.error("Erro ao listar usuários do tenant:", err);
    return res.status(500).json({ error: "Erro interno ao buscar usuários." });
  }
};

// 2. Criar novo usuário na empresa
const criarUsuario = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const empresaId = req.empresaId || req.params.empresaId;
    const { nome, email, senha, telefone, cargo = "Colaborador", role = "operador", permissoes = [] } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
    }

    if (senha.length < 6) {
      return res.status(400).json({ error: "A senha deve conter no mínimo 6 caracteres." });
    }

    const emailLimpo = email.trim().toLowerCase();

    // Verificar limite de usuários da empresa
    const [empresaRows] = await connection.query(
      `SELECT e.limite_usuarios, COUNT(ae.id) as total_atual
       FROM empresas e
       LEFT JOIN admin_empresas ae ON ae.empresa_id = e.id AND ae.ativo = 1
       WHERE e.id = ?
       GROUP BY e.id`,
      [empresaId]
    );

    if (empresaRows.length > 0) {
      const limite = empresaRows[0].limite_usuarios || 10;
      const atual = empresaRows[0].total_atual || 0;
      if (atual >= limite && !req.user?.is_super) {
        return res.status(403).json({
          error: `Limite de ${limite} usuários atingido para o seu plano. Faça upgrade para adicionar mais membros.`,
        });
      }
    }

    // Verificar se usuário já existe em `admins`
    const [existing] = await connection.query(`SELECT id, nome, email FROM admins WHERE email = ?`, [emailLimpo]);

    let adminId = null;
    if (existing.length > 0) {
      adminId = existing[0].id;

      // Verificar se já está vinculado a esta empresa
      const [vinculo] = await connection.query(
        `SELECT id FROM admin_empresas WHERE admin_id = ? AND empresa_id = ?`,
        [adminId, empresaId]
      );

      if (vinculo.length > 0) {
        await connection.rollback();
        return res.status(400).json({ error: "Este usuário já faz parte desta empresa." });
      }
    } else {
      // Criar novo admin
      const hashSenha = await bcrypt.hash(senha, 10);
      const [novoAdmin] = await connection.query(
        `INSERT INTO admins (nome, email, senha, telefone, cargo, empresa_id, status)
         VALUES (?, ?, ?, ?, ?, ?, 'ativo')`,
        [nome.trim(), emailLimpo, hashSenha, telefone ? telefone.trim() : null, cargo.trim(), empresaId]
      );
      adminId = novoAdmin.insertId;
    }

    // Definir permissões finais
    let permsFinal = permissoes;
    if (role !== "personalizado" && PERMISSOES_POR_PERFIL[role]) {
      permsFinal = PERMISSOES_POR_PERFIL[role];
    }

    // Vincular à empresa
    await connection.query(
      `INSERT INTO admin_empresas (admin_id, empresa_id, role, cargo, permissoes, ativo)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [adminId, empresaId, role, cargo, JSON.stringify(permsFinal)]
    );

    await connection.commit();

    return res.status(201).json({
      sucesso: true,
      mensagem: "Usuário adicionado com sucesso!",
      usuario_id: adminId,
    });
  } catch (err) {
    await connection.rollback();
    console.error("Erro ao criar usuário do tenant:", err);
    return res.status(500).json({ error: "Erro interno ao cadastrar usuário." });
  } finally {
    connection.release();
  }
};

// 3. Atualizar usuário
const atualizarUsuario = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const empresaId = req.empresaId || req.params.empresaId;
    const { id: targetUserId } = req.params;
    const { nome, telefone, cargo, role, permissoes, senha, ativo } = req.body;

    // Verificar se o vínculo existe
    const [vinculo] = await connection.query(
      `SELECT ae.*, a.is_super, a.email FROM admin_empresas ae
       JOIN admins a ON a.id = ae.admin_id
       WHERE ae.admin_id = ? AND ae.empresa_id = ?`,
      [targetUserId, empresaId]
    );

    if (vinculo.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Usuário não encontrado nesta empresa." });
    }

    const currentVinculo = vinculo[0];

    // Impedir que o proprietário se auto-desative ou rebaixe para não-admin se for o único
    if (currentVinculo.role === "proprietario" && role && role !== "proprietario") {
      const [outrosAdmins] = await connection.query(
        `SELECT id FROM admin_empresas WHERE empresa_id = ? AND role = 'proprietario' AND admin_id != ?`,
        [empresaId, targetUserId]
      );
      if (outrosAdmins.length === 0) {
        await connection.rollback();
        return res.status(400).json({ error: "Não é possível alterar a função do proprietário principal sem nomear outro proprietário." });
      }
    }

    // Atualizar dados cadastrais em `admins`
    const updatesAdmin = [];
    const paramsAdmin = [];

    if (nome) {
      updatesAdmin.push("nome = ?");
      paramsAdmin.push(nome.trim());
    }
    if (telefone !== undefined) {
      updatesAdmin.push("telefone = ?");
      paramsAdmin.push(telefone ? telefone.trim() : null);
    }
    if (cargo) {
      updatesAdmin.push("cargo = ?");
      paramsAdmin.push(cargo.trim());
    }
    if (senha && senha.length >= 6) {
      const hash = await bcrypt.hash(senha, 10);
      updatesAdmin.push("senha = ?");
      paramsAdmin.push(hash);
    }

    if (updatesAdmin.length > 0) {
      paramsAdmin.push(targetUserId);
      await connection.query(`UPDATE admins SET ${updatesAdmin.join(", ")} WHERE id = ?`, paramsAdmin);
    }

    // Atualizar dados de permissões em `admin_empresas`
    const updatesVinculo = [];
    const paramsVinculo = [];

    if (cargo !== undefined) {
      updatesVinculo.push("cargo = ?");
      paramsVinculo.push(cargo);
    }
    if (role !== undefined) {
      updatesVinculo.push("role = ?");
      paramsVinculo.push(role);
    }
    if (ativo !== undefined) {
      updatesVinculo.push("ativo = ?");
      paramsVinculo.push(ativo ? 1 : 0);
    }
    if (permissoes !== undefined) {
      let permsFinal = permissoes;
      if (role && role !== "personalizado" && PERMISSOES_POR_PERFIL[role]) {
        permsFinal = PERMISSOES_POR_PERFIL[role];
      }
      updatesVinculo.push("permissoes = ?");
      paramsVinculo.push(JSON.stringify(permsFinal));
    }

    if (updatesVinculo.length > 0) {
      paramsVinculo.push(targetUserId, empresaId);
      await connection.query(
        `UPDATE admin_empresas SET ${updatesVinculo.join(", ")} WHERE admin_id = ? AND empresa_id = ?`,
        paramsVinculo
      );
    }

    await connection.commit();

    return res.json({
      sucesso: true,
      mensagem: "Usuário atualizado com sucesso!",
    });
  } catch (err) {
    await connection.rollback();
    console.error("Erro ao atualizar usuário do tenant:", err);
    return res.status(500).json({ error: "Erro interno ao atualizar usuário." });
  } finally {
    connection.release();
  }
};

// 4. Remover usuário da empresa
const removerUsuario = async (req, res) => {
  try {
    const empresaId = req.empresaId || req.params.empresaId;
    const { id: targetUserId } = req.params;

    const [vinculo] = await db.query(
      `SELECT role FROM admin_empresas WHERE admin_id = ? AND empresa_id = ?`,
      [targetUserId, empresaId]
    );

    if (vinculo.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado nesta empresa." });
    }

    if (vinculo[0].role === "proprietario") {
      const [outrosAdmins] = await db.query(
        `SELECT id FROM admin_empresas WHERE empresa_id = ? AND role = 'proprietario' AND admin_id != ?`,
        [empresaId, targetUserId]
      );
      if (outrosAdmins.length === 0) {
        return res.status(400).json({ error: "Não é possível remover o proprietário único da empresa." });
      }
    }

    await db.query(`DELETE FROM admin_empresas WHERE admin_id = ? AND empresa_id = ?`, [targetUserId, empresaId]);

    return res.json({
      sucesso: true,
      mensagem: "Usuário desvinculado da empresa com sucesso!",
    });
  } catch (err) {
    console.error("Erro ao remover usuário:", err);
    return res.status(500).json({ error: "Erro interno ao desvincular usuário." });
  }
};

module.exports = {
  listarUsuarios,
  criarUsuario,
  atualizarUsuario,
  removerUsuario,
  MODULOS_SISTEMA,
  PERMISSOES_POR_PERFIL,
};
