const pool = require("../../db");

/**
 * Helper interno para criar notificação no banco
 */
async function criarNotificacao({ empresa_id, usuario_id = null, titulo, mensagem, tipo = "sistema", link = null }) {
  try {
    const [res] = await pool.query(
      `INSERT INTO notificacoes_financeiras (empresa_id, usuario_id, titulo, mensagem, tipo, link)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [empresa_id, usuario_id, titulo, mensagem, tipo, link]
    );
    return res.insertId;
  } catch (err) {
    console.error("Erro ao criar notificação:", err);
    return null;
  }
}

/**
 * Listar notificações da empresa (persistidas + alertas em tempo real)
 */
async function listar(req, res) {
  try {
    const empresaId = req.user.empresa_id;

    // 1. Notificações persistidas
    const [notificacoesDb] = await pool.query(
      `SELECT id, empresa_id, usuario_id, titulo, mensagem, tipo, link, lida, criado_em
       FROM notificacoes_financeiras
       WHERE empresa_id = ?
       ORDER BY criado_em DESC
       LIMIT 30`,
      [empresaId]
    );

    // 2. Alertas dinâmicos em tempo real (contas vencendo hoje / atrasadas)
    const [resPagarHoje] = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(valor), 0) as total
       FROM transacoes_financeiras
       WHERE empresa_id = ? AND tipo = 'despesa' AND status = 'pendente' AND data_vencimento = CURDATE()`,
      [empresaId]
    );

    const [resPagarAtrasado] = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(valor), 0) as total
       FROM transacoes_financeiras
       WHERE empresa_id = ? AND tipo = 'despesa' AND status = 'pendente' AND data_vencimento < CURDATE()`,
      [empresaId]
    );

    const [resReceberHoje] = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(valor), 0) as total
       FROM transacoes_financeiras
       WHERE empresa_id = ? AND tipo = 'receita' AND status = 'pendente' AND data_vencimento = CURDATE()`,
      [empresaId]
    );

    const [resReceberAtrasado] = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(valor), 0) as total
       FROM transacoes_financeiras
       WHERE empresa_id = ? AND tipo = 'receita' AND status = 'pendente' AND data_vencimento < CURDATE()`,
      [empresaId]
    );

    const formatBRL = (val) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

    const alertasTempoReal = [];

    if (resPagarAtrasado[0].count > 0) {
      alertasTempoReal.push({
        id: "rt_pagar_atrasado",
        titulo: "Contas a Pagar Vencidas",
        mensagem: `Você tem ${resPagarAtrasado[0].count} despesa(s) atrasada(s) totalizando ${formatBRL(resPagarAtrasado[0].total)}.`,
        tipo: "alerta_atraso",
        link: "/admin/contas-pagar?aba=vencidas",
        lida: 0,
        urgente: true,
        criado_em: new Date(),
      });
    }

    if (resPagarHoje[0].count > 0) {
      alertasTempoReal.push({
        id: "rt_pagar_hoje",
        titulo: "Despesas Vencendo Hoje",
        mensagem: `${resPagarHoje[0].count} conta(s) a pagar vencem hoje (${formatBRL(resPagarHoje[0].total)}).`,
        tipo: "vencimento_pagar",
        link: "/admin/contas-pagar?aba=hoje",
        lida: 0,
        urgente: false,
        criado_em: new Date(),
      });
    }

    if (resReceberAtrasado[0].count > 0) {
      alertasTempoReal.push({
        id: "rt_receber_atrasado",
        titulo: "Inadimplência de Clientes",
        mensagem: `${resReceberAtrasado[0].count} conta(s) a receber em atraso (${formatBRL(resReceberAtrasado[0].total)}).`,
        tipo: "alerta_receber",
        link: "/admin/contas-receber?aba=vencidas",
        lida: 0,
        urgente: false,
        criado_em: new Date(),
      });
    }

    if (resReceberHoje[0].count > 0) {
      alertasTempoReal.push({
        id: "rt_receber_hoje",
        titulo: "Recebimentos Previstos Hoje",
        mensagem: `${resReceberHoje[0].count} receita(s) prevista(s) para hoje (${formatBRL(resReceberHoje[0].total)}).`,
        tipo: "vencimento_receber",
        link: "/admin/contas-receber?aba=hoje",
        lida: 0,
        urgente: false,
        criado_em: new Date(),
      });
    }

    // Lista unificada
    const todas = [...alertasTempoReal, ...notificacoesDb];
    const totalNaoLidas = todas.filter((n) => !n.lida).length;

    return res.json({
      notificacoes: todas,
      totalNaoLidas,
      resumo: {
        pagarAtrasado: resPagarAtrasado[0],
        pagarHoje: resPagarHoje[0],
        receberAtrasado: resReceberAtrasado[0],
        receberHoje: resReceberHoje[0],
      },
    });
  } catch (err) {
    console.error("Erro ao listar notificações:", err);
    return res.status(500).json({ error: "Erro ao buscar notificações" });
  }
}

/**
 * Marcar notificação específica como lida
 */
async function marcarLida(req, res) {
  try {
    const { id } = req.params;
    const empresaId = req.user.empresa_id;

    if (String(id).startsWith("rt_")) {
      // Notificação em tempo real virtual
      return res.json({ success: true });
    }

    await pool.query(
      `UPDATE notificacoes_financeiras SET lida = 1 WHERE id = ? AND empresa_id = ?`,
      [id, empresaId]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Erro ao marcar notificação como lida:", err);
    return res.status(500).json({ error: "Erro ao atualizar notificação" });
  }
}

/**
 * Marcar todas as notificações como lidas
 */
async function marcarTodasLidas(req, res) {
  try {
    const empresaId = req.user.empresa_id;

    await pool.query(
      `UPDATE notificacoes_financeiras SET lida = 1 WHERE empresa_id = ?`,
      [empresaId]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Erro ao marcar todas notificações:", err);
    return res.status(500).json({ error: "Erro ao atualizar notificações" });
  }
}

/**
 * Limpar notificações lidas
 */
async function limpar(req, res) {
  try {
    const empresaId = req.user.empresa_id;

    await pool.query(
      `DELETE FROM notificacoes_financeiras WHERE empresa_id = ? AND lida = 1`,
      [empresaId]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Erro ao limpar notificações:", err);
    return res.status(500).json({ error: "Erro ao excluir notificações" });
  }
}

module.exports = {
  listar,
  marcarLida,
  marcarTodasLidas,
  limpar,
  criarNotificacao,
};
