const db = require("../../db");

/**
 * Listar logs de auditoria da empresa com filtros
 */
async function listar(req, res) {
  try {
    const empresaId = req.user.empresa_id;
    const {
      page = 1,
      limit = 50,
      modulo,
      acao,
      admin_id,
      data_inicio,
      data_fim,
      search,
    } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const params = [empresaId];
    let whereClause = "WHERE empresa_id = ?";

    if (modulo) {
      whereClause += " AND modulo = ?";
      params.push(modulo.toUpperCase());
    }

    if (acao) {
      whereClause += " AND acao = ?";
      params.push(acao.toUpperCase());
    }

    if (admin_id) {
      whereClause += " AND admin_id = ?";
      params.push(admin_id);
    }

    if (data_inicio) {
      whereClause += " AND DATE(criado_em) >= ?";
      params.push(data_inicio);
    }

    if (data_fim) {
      whereClause += " AND DATE(criado_em) <= ?";
      params.push(data_fim);
    }

    if (search) {
      whereClause += " AND (usuario_nome LIKE ? OR usuario_email LIKE ? OR detalhes LIKE ? OR ip_origem LIKE ?)";
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    // Total de registros para paginação
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM logs_auditoria ${whereClause}`,
      params
    );
    const total = countResult[0]?.total || 0;

    // Buscar logs
    const query = `
      SELECT id, empresa_id, admin_id, usuario_nome, usuario_email,
             acao, modulo, registro_id, detalhes, ip_origem, user_agent, criado_em
      FROM logs_auditoria
      ${whereClause}
      ORDER BY criado_em DESC
      LIMIT ? OFFSET ?
    `;
    params.push(parseInt(limit, 10), offset);

    const [rows] = await db.query(query, params);

    return res.json({
      data: rows,
      meta: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10)) || 1,
      },
    });
  } catch (err) {
    console.error("Erro ao listar logs de auditoria:", err);
    return res.status(500).json({ error: "Erro ao buscar logs de auditoria" });
  }
}

/**
 * Obter métricas e estatísticas de auditoria
 */
async function estatisticas(req, res) {
  try {
    const empresaId = req.user.empresa_id;

    // Total de ações
    const [totalRows] = await db.query(
      `SELECT COUNT(*) as total FROM logs_auditoria WHERE empresa_id = ?`,
      [empresaId]
    );

    // Ações hoje
    const [hojeRows] = await db.query(
      `SELECT COUNT(*) as total FROM logs_auditoria WHERE empresa_id = ? AND DATE(criado_em) = CURDATE()`,
      [empresaId]
    );

    // Exclusões e Estornos
    const [criticosRows] = await db.query(
      `SELECT COUNT(*) as total FROM logs_auditoria WHERE empresa_id = ? AND acao IN ('EXCLUIR', 'ESTORNAR', 'EXCLUIR_ANEXO')`,
      [empresaId]
    );

    // Usuários únicos ativos
    const [usuariosRows] = await db.query(
      `SELECT COUNT(DISTINCT admin_id) as total FROM logs_auditoria WHERE empresa_id = ? AND admin_id IS NOT NULL`,
      [empresaId]
    );

    // Distribuição por Módulo
    const [modulosDist] = await db.query(
      `SELECT modulo, COUNT(*) as qtd
       FROM logs_auditoria
       WHERE empresa_id = ?
       GROUP BY modulo
       ORDER BY qtd DESC
       LIMIT 6`,
      [empresaId]
    );

    // Top 5 Usuários mais ativos
    const [topUsuarios] = await db.query(
      `SELECT usuario_nome, usuario_email, COUNT(*) as total_acoes
       FROM logs_auditoria
       WHERE empresa_id = ? AND usuario_nome IS NOT NULL
       GROUP BY usuario_nome, usuario_email
       ORDER BY total_acoes DESC
       LIMIT 5`,
      [empresaId]
    );

    return res.json({
      totalAcoes: totalRows[0]?.total || 0,
      acoesHoje: hojeRows[0]?.total || 0,
      acoesCriticas: criticosRows[0]?.total || 0,
      totalUsuariosAtivos: usuariosRows[0]?.total || 0,
      distribuicaoModulos: modulosDist,
      topUsuarios,
    });
  } catch (err) {
    console.error("Erro ao carregar estatísticas de auditoria:", err);
    return res.status(500).json({ error: "Erro ao calcular estatísticas" });
  }
}

/**
 * Listar logs de auditoria GLOBAIS do SaaS (Super Admin)
 */
async function listarGlobal(req, res) {
  try {
    const {
      page = 1,
      limit = 50,
      empresa_id,
      modulo,
      acao,
      data_inicio,
      data_fim,
      search,
    } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const params = [];
    let whereConditions = [];

    if (empresa_id) {
      whereConditions.push("l.empresa_id = ?");
      params.push(empresa_id);
    }

    if (modulo) {
      whereConditions.push("l.modulo = ?");
      params.push(modulo.toUpperCase());
    }

    if (acao) {
      whereConditions.push("l.acao = ?");
      params.push(acao.toUpperCase());
    }

    if (data_inicio) {
      whereConditions.push("DATE(l.criado_em) >= ?");
      params.push(data_inicio);
    }

    if (data_fim) {
      whereConditions.push("DATE(l.criado_em) <= ?");
      params.push(data_fim);
    }

    if (search) {
      whereConditions.push("(l.usuario_nome LIKE ? OR l.usuario_email LIKE ? OR l.detalhes LIKE ? OR l.ip_origem LIKE ? OR e.nome LIKE ?)");
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

    // Contagem total
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total 
       FROM logs_auditoria l
       LEFT JOIN empresas e ON e.id = l.empresa_id
       ${whereClause}`,
      params
    );
    const total = countResult[0]?.total || 0;

    // Buscar logs com dados da empresa
    const query = `
      SELECT l.id, l.empresa_id, e.nome as empresa_nome, e.slug as empresa_slug,
             l.admin_id, l.usuario_nome, l.usuario_email,
             l.acao, l.modulo, l.registro_id, l.detalhes, l.ip_origem, l.user_agent, l.criado_em
      FROM logs_auditoria l
      LEFT JOIN empresas e ON e.id = l.empresa_id
      ${whereClause}
      ORDER BY l.criado_em DESC
      LIMIT ? OFFSET ?
    `;
    params.push(parseInt(limit, 10), offset);

    const [rows] = await db.query(query, params);

    return res.json({
      data: rows,
      meta: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10)) || 1,
      },
    });
  } catch (err) {
    console.error("Erro ao listar logs globais de auditoria:", err);
    return res.status(500).json({ error: "Erro ao buscar logs globais de auditoria" });
  }
}

/**
 * Estatísticas globais do SaaS (Super Admin)
 */
async function estatisticasGlobal(req, res) {
  try {
    const [totalRows] = await db.query(`SELECT COUNT(*) as total FROM logs_auditoria`);
    const [hojeRows] = await db.query(`SELECT COUNT(*) as total FROM logs_auditoria WHERE DATE(criado_em) = CURDATE()`);
    const [empresasRows] = await db.query(`SELECT COUNT(DISTINCT empresa_id) as total FROM logs_auditoria`);
    const [criticosRows] = await db.query(`SELECT COUNT(*) as total FROM logs_auditoria WHERE acao IN ('EXCLUIR', 'ESTORNAR', 'EXCLUIR_ANEXO')`);

    const [topEmpresas] = await db.query(
      `SELECT e.id, e.nome, e.slug, COUNT(l.id) as total_acoes
       FROM logs_auditoria l
       JOIN empresas e ON e.id = l.empresa_id
       GROUP BY e.id, e.nome, e.slug
       ORDER BY total_acoes DESC
       LIMIT 6`
    );

    return res.json({
      totalAcoes: totalRows[0]?.total || 0,
      acoesHoje: hojeRows[0]?.total || 0,
      empresasAtivas: empresasRows[0]?.total || 0,
      acoesCriticas: criticosRows[0]?.total || 0,
      topEmpresas,
    });
  } catch (err) {
    console.error("Erro ao calcular estatísticas globais:", err);
    return res.status(500).json({ error: "Erro ao calcular métricas" });
  }
}

module.exports = {
  listar,
  estatisticas,
  listarGlobal,
  estatisticasGlobal,
};
