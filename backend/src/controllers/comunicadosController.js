const db = require("../../db");
const { registrarAuditoria } = require("../utils/auditLogger");

/**
 * Listar comunicados ativos para o Tenant
 */
async function listarAtivosTenant(req, res) {
  try {
    const empresaId = req.user.empresa_id;
    const usuarioId = req.user.id;

    // Buscar plano da empresa
    const [empRows] = await db.query("SELECT plano_saas_id FROM empresas WHERE id = ?", [empresaId]);
    const planoId = empRows[0]?.plano_saas_id || null;

    const hoje = new Date().toISOString().split("T")[0];

    const [rows] = await db.query(
      `SELECT c.id, c.titulo, c.mensagem, c.tipo, c.criado_em
       FROM saas_comunicados c
       LEFT JOIN saas_comunicados_lidos l ON l.comunicado_id = c.id AND l.usuario_id = ?
       WHERE c.ativo = 1
         AND l.id IS NULL
         AND (c.data_inicio IS NULL OR c.data_inicio <= ?)
         AND (c.data_fim IS NULL OR c.data_fim >= ?)
         AND (
           c.destinatarios = 'todas'
           OR (c.destinatarios = 'empresa_especifica' AND c.empresa_id = ?)
           OR (c.destinatarios = 'plano_especifico' AND c.plano_id = ?)
         )
       ORDER BY CASE WHEN c.tipo = 'urgente' THEN 1 WHEN c.tipo = 'aviso' THEN 2 ELSE 3 END, c.id DESC`,
      [usuarioId, hoje, hoje, empresaId, planoId]
    );

    return res.json({ comunicados: rows });
  } catch (err) {
    console.error("Erro ao listar comunicados do tenant:", err);
    return res.status(500).json({ error: "Erro ao buscar avisos e comunicados" });
  }
}

/**
 * Dispensar comunicado permanentemente para o usuário logado
 */
async function dispensarComunicado(req, res) {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;

    await db.query(
      `INSERT INTO saas_comunicados_lidos (comunicado_id, usuario_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE dispensado_em = CURRENT_TIMESTAMP`,
      [id, usuarioId]
    );

    return res.json({ message: "Comunicado dispensado com sucesso!" });
  } catch (err) {
    console.error("Erro ao dispensar comunicado:", err);
    return res.status(500).json({ error: "Erro ao registrar dispensa do comunicado" });
  }
}

/**
 * Listar todos os comunicados no Super Admin
 */
async function listarTodosSuperAdmin(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT c.*, e.nome as empresa_nome, p.nome as plano_nome
      FROM saas_comunicados c
      LEFT JOIN empresas e ON e.id = c.empresa_id
      LEFT JOIN saas_planos p ON p.id = c.plano_id
      ORDER BY c.id DESC
    `);

    return res.json({ comunicados: rows });
  } catch (err) {
    console.error("Erro ao listar comunicados Super Admin:", err);
    return res.status(500).json({ error: "Erro ao carregar comunicados" });
  }
}

/**
 * Criar comunicado (Super Admin)
 */
async function criarComunicado(req, res) {
  try {
    const {
      titulo,
      mensagem,
      tipo = "info",
      destinatarios = "todas",
      plano_id = null,
      empresa_id = null,
      ativo = 1,
      data_inicio = null,
      data_fim = null,
    } = req.body;

    if (!titulo || !mensagem) {
      return res.status(400).json({ error: "Título e mensagem do comunicado são obrigatórios." });
    }

    const [result] = await db.query(
      `INSERT INTO saas_comunicados 
       (titulo, mensagem, tipo, destinatarios, plano_id, empresa_id, ativo, data_inicio, data_fim)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        titulo,
        mensagem,
        tipo,
        destinatarios,
        plano_id || null,
        empresa_id || null,
        ativo ? 1 : 0,
        data_inicio || null,
        data_fim || null,
      ]
    );

    await registrarAuditoria({
      req,
      acao: "CRIAR",
      modulo: "COMUNICADOS",
      registroId: result.insertId,
      detalhes: { titulo, tipo, destinatarios },
    });

    return res.status(201).json({
      message: "Comunicado publicado com sucesso!",
      id: result.insertId,
    });
  } catch (err) {
    console.error("Erro ao criar comunicado:", err);
    return res.status(500).json({ error: "Erro ao criar comunicado" });
  }
}

/**
 * Atualizar comunicado (Super Admin)
 */
async function atualizarComunicado(req, res) {
  try {
    const { id } = req.params;
    const {
      titulo,
      mensagem,
      tipo,
      destinatarios,
      plano_id,
      empresa_id,
      ativo,
      data_inicio,
      data_fim,
    } = req.body;

    await db.query(
      `UPDATE saas_comunicados 
       SET titulo = ?, mensagem = ?, tipo = ?, destinatarios = ?,
           plano_id = ?, empresa_id = ?, ativo = ?, data_inicio = ?, data_fim = ?
       WHERE id = ?`,
      [
        titulo,
        mensagem,
        tipo,
        destinatarios,
        plano_id || null,
        empresa_id || null,
        ativo ? 1 : 0,
        data_inicio || null,
        data_fim || null,
        id,
      ]
    );

    return res.json({ message: "Comunicado atualizado com sucesso!" });
  } catch (err) {
    console.error("Erro ao atualizar comunicado:", err);
    return res.status(500).json({ error: "Erro ao atualizar comunicado" });
  }
}

/**
 * Excluir comunicado (Super Admin)
 */
async function excluirComunicado(req, res) {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM saas_comunicados WHERE id = ?", [id]);
    return res.json({ message: "Comunicado excluído com sucesso!" });
  } catch (err) {
    console.error("Erro ao excluir comunicado:", err);
    return res.status(500).json({ error: "Erro ao excluir comunicado" });
  }
}

module.exports = {
  listarAtivosTenant,
  dispensarComunicado,
  listarTodosSuperAdmin,
  criarComunicado,
  atualizarComunicado,
  excluirComunicado,
};
