const db = require("../../db");
const { registrarAuditoria } = require("../utils/auditLogger");

/**
 * Gerar código aleatório legível de ticket (Ex: #TKT-7821)
 */
function gerarCodigoTicket() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `#TKT-${num}`;
}

/**
 * Listar chamados do Tenant (Empresa)
 */
async function listarPorTenant(req, res) {
  try {
    const empresaId = req.user.empresa_id;
    const { status, categoria, search } = req.query;

    let query = `
      SELECT c.*, u.nome as usuario_nome, u.email as usuario_email,
             (SELECT COUNT(*) FROM suporte_mensagens m WHERE m.chamado_id = c.id) as total_mensagens,
             (SELECT m.mensagem FROM suporte_mensagens m WHERE m.chamado_id = c.id ORDER BY m.id DESC LIMIT 1) as ultima_mensagem,
             (SELECT m.criado_em FROM suporte_mensagens m WHERE m.chamado_id = c.id ORDER BY m.id DESC LIMIT 1) as ultima_mensagem_em
      FROM suporte_chamados c
      LEFT JOIN admins u ON u.id = c.usuario_id
      WHERE c.empresa_id = ?
    `;
    const params = [empresaId];

    if (status && status !== "todos") {
      query += " AND c.status = ?";
      params.push(status);
    }
    if (categoria && categoria !== "todas") {
      query += " AND c.categoria = ?";
      params.push(categoria);
    }
    if (search) {
      query += " AND (c.assunto LIKE ? OR c.codigo LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    query += " ORDER BY c.atualizado_em DESC";

    const [rows] = await db.query(query, params);
    return res.json({ chamados: rows });
  } catch (err) {
    console.error("Erro ao listar chamados do tenant:", err);
    return res.status(500).json({ error: "Erro ao carregar chamados de suporte" });
  }
}

/**
 * Criar novo chamado pelo Tenant
 */
async function criarChamado(req, res) {
  try {
    const empresaId = req.user.empresa_id;
    const usuarioId = req.user.id;
    const { assunto, categoria = "duvida", prioridade = "media", mensagem, anexos = [] } = req.body;

    if (!assunto || !mensagem) {
      return res.status(400).json({ error: "Assunto e mensagem inicial são obrigatórios." });
    }

    let codigo = gerarCodigoTicket();
    // Garantir unicidade
    const [existente] = await db.query("SELECT id FROM suporte_chamados WHERE codigo = ?", [codigo]);
    if (existente.length > 0) {
      codigo = `#TKT-${Math.floor(10000 + Math.random() * 90000)}`;
    }

    const [result] = await db.query(
      `INSERT INTO suporte_chamados (empresa_id, usuario_id, codigo, assunto, categoria, prioridade, status)
       VALUES (?, ?, ?, ?, ?, ?, 'aberto')`,
      [empresaId, usuarioId, codigo, assunto, categoria, prioridade]
    );

    const chamadoId = result.insertId;

    // Inserir mensagem inicial
    await db.query(
      `INSERT INTO suporte_mensagens (chamado_id, usuario_id, is_admin, mensagem, anexos_json)
       VALUES (?, ?, 0, ?, ?)`,
      [chamadoId, usuarioId, mensagem, JSON.stringify(anexos)]
    );

    await registrarAuditoria({
      req,
      acao: "CRIAR",
      modulo: "SUPORTE",
      registroId: chamadoId,
      detalhes: { codigo, assunto, categoria, prioridade },
    });

    return res.status(201).json({
      message: "Chamado aberto com sucesso!",
      chamado: { id: chamadoId, codigo, assunto, status: "aberto" },
    });
  } catch (err) {
    console.error("Erro ao abrir chamado:", err);
    return res.status(500).json({ error: "Erro ao registrar chamado de suporte" });
  }
}

/**
 * Obter detalhes e mensagens do chamado
 */
async function obterDetalhes(req, res) {
  try {
    const { id } = req.params;
    const isSuper = Boolean(req.user.is_super || req.user.role === "super_admin" || req.user.role === "admin");
    const empresaId = req.user.empresa_id;

    let queryChamado = `
      SELECT c.*, e.nome as empresa_nome, e.slug as empresa_slug, u.nome as usuario_nome, u.email as usuario_email
      FROM suporte_chamados c
      JOIN empresas e ON e.id = c.empresa_id
      LEFT JOIN admins u ON u.id = c.usuario_id
      WHERE c.id = ?
    `;
    const params = [id];

    if (!isSuper) {
      queryChamado += " AND c.empresa_id = ?";
      params.push(empresaId);
    }

    const [chamadoRows] = await db.query(queryChamado, params);
    if (chamadoRows.length === 0) {
      return res.status(404).json({ error: "Chamado não encontrado ou acesso restrito." });
    }

    const chamado = chamadoRows[0];

    const [mensagens] = await db.query(
      `SELECT m.*, u.nome as autor_nome, u.email as autor_email, u.cargo as autor_cargo, u.is_super as autor_is_super
       FROM suporte_mensagens m
       LEFT JOIN admins u ON u.id = m.usuario_id
       WHERE m.chamado_id = ?
       ORDER BY m.criado_em ASC`,
      [id]
    );

    return res.json({
      chamado,
      mensagens: mensagens.map((m) => ({
        ...m,
        anexos: m.anexos_json ? JSON.parse(m.anexos_json) : [],
      })),
    });
  } catch (err) {
    console.error("Erro ao obter detalhes do chamado:", err);
    return res.status(500).json({ error: "Erro ao buscar histórico do chamado" });
  }
}

/**
 * Adicionar mensagem / resposta no chamado
 */
async function adicionarMensagem(req, res) {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;
    const isSuper = Boolean(req.user.is_super || req.user.role === "super_admin" || req.user.role === "admin");
    const empresaId = req.user.empresa_id;
    const { mensagem, anexos = [] } = req.body;

    if (!mensagem || !mensagem.trim()) {
      return res.status(400).json({ error: "A mensagem não pode estar vazia." });
    }

    // Verificar chamado
    let checkQuery = "SELECT id, status, empresa_id FROM suporte_chamados WHERE id = ?";
    const checkParams = [id];
    if (!isSuper) {
      checkQuery += " AND empresa_id = ?";
      checkParams.push(empresaId);
    }
    const [chamadoRows] = await db.query(checkQuery, checkParams);
    if (chamadoRows.length === 0) {
      return res.status(404).json({ error: "Chamado não encontrado." });
    }

    const chamado = chamadoRows[0];

    // Inserir mensagem
    await db.query(
      `INSERT INTO suporte_mensagens (chamado_id, usuario_id, is_admin, mensagem, anexos_json)
       VALUES (?, ?, ?, ?, ?)`,
      [id, usuarioId, isSuper ? 1 : 0, mensagem, JSON.stringify(anexos)]
    );

    // Atualizar status inteligente
    let novoStatus = chamado.status;
    if (isSuper && chamado.status === "aberto") {
      novoStatus = "em_atendimento";
    } else if (isSuper && chamado.status !== "resolvido" && chamado.status !== "fechado") {
      novoStatus = "aguardando_cliente";
    } else if (!isSuper && chamado.status === "aguardando_cliente") {
      novoStatus = "em_atendimento";
    }

    await db.query(
      "UPDATE suporte_chamados SET status = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
      [novoStatus, id]
    );

    return res.json({ message: "Resposta enviada com sucesso!", status: novoStatus });
  } catch (err) {
    console.error("Erro ao adicionar mensagem no chamado:", err);
    return res.status(500).json({ error: "Erro ao enviar resposta" });
  }
}

/**
 * Atualizar status ou prioridade do chamado
 */
async function atualizarStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, prioridade } = req.body;
    const isSuper = Boolean(req.user.is_super || req.user.role === "super_admin" || req.user.role === "admin");
    const empresaId = req.user.empresa_id;

    let query = "UPDATE suporte_chamados SET ";
    const params = [];
    const fields = [];

    if (status) {
      fields.push("status = ?");
      params.push(status);
      if (status === "resolvido" || status === "fechado") {
        fields.push("fechado_em = CURRENT_TIMESTAMP");
      }
    }
    if (prioridade && isSuper) {
      fields.push("prioridade = ?");
      params.push(prioridade);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: "Nenhum campo fornecido para atualização." });
    }

    query += fields.join(", ") + " WHERE id = ?";
    params.push(id);

    if (!isSuper) {
      query += " AND empresa_id = ?";
      params.push(empresaId);
    }

    await db.query(query, params);

    return res.json({ message: "Chamado atualizado com sucesso!" });
  } catch (err) {
    console.error("Erro ao atualizar chamado:", err);
    return res.status(500).json({ error: "Erro ao atualizar status do chamado" });
  }
}

/**
 * Listar chamados no Super Admin (Todas as Empresas)
 */
async function listarTodosSuperAdmin(req, res) {
  try {
    const { status, categoria, prioridade, empresa_id, search } = req.query;

    let query = `
      SELECT c.*, e.nome as empresa_nome, e.slug as empresa_slug, u.nome as usuario_nome, u.email as usuario_email,
             (SELECT COUNT(*) FROM suporte_mensagens m WHERE m.chamado_id = c.id) as total_mensagens,
             (SELECT m.mensagem FROM suporte_mensagens m WHERE m.chamado_id = c.id ORDER BY m.id DESC LIMIT 1) as ultima_mensagem,
             (SELECT m.criado_em FROM suporte_mensagens m WHERE m.chamado_id = c.id ORDER BY m.id DESC LIMIT 1) as ultima_mensagem_em
      FROM suporte_chamados c
      JOIN empresas e ON e.id = c.empresa_id
      LEFT JOIN admins u ON u.id = c.usuario_id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== "todos") {
      query += " AND c.status = ?";
      params.push(status);
    }
    if (categoria && categoria !== "todas") {
      query += " AND c.categoria = ?";
      params.push(categoria);
    }
    if (prioridade && prioridade !== "todas") {
      query += " AND c.prioridade = ?";
      params.push(prioridade);
    }
    if (empresa_id) {
      query += " AND c.empresa_id = ?";
      params.push(empresa_id);
    }
    if (search) {
      query += " AND (c.assunto LIKE ? OR c.codigo LIKE ? OR e.nome LIKE ? OR u.nome LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += " ORDER BY CASE WHEN c.status = 'aberto' THEN 1 WHEN c.status = 'em_atendimento' THEN 2 ELSE 3 END, c.atualizado_em DESC";

    const [rows] = await db.query(query, params);

    // Contadores rápidos para o Super Admin
    const [counts] = await db.query(`
      SELECT 
        COUNT(CASE WHEN status = 'aberto' THEN 1 END) as abertos,
        COUNT(CASE WHEN status = 'em_atendimento' THEN 1 END) as em_atendimento,
        COUNT(CASE WHEN status = 'aguardando_cliente' THEN 1 END) as aguardando,
        COUNT(CASE WHEN status = 'resolvido' OR status = 'fechado' THEN 1 END) as resolvidos,
        COUNT(*) as total
      FROM suporte_chamados
    `);

    return res.json({
      chamados: rows,
      metricas: counts[0] || {},
    });
  } catch (err) {
    console.error("Erro ao listar chamados globais Super Admin:", err);
    return res.status(500).json({ error: "Erro ao carregar tickets de suporte globais" });
  }
}

module.exports = {
  listarPorTenant,
  criarChamado,
  obterDetalhes,
  adicionarMensagem,
  atualizarStatus,
  listarTodosSuperAdmin,
};
