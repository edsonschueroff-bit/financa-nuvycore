const db = require("../../db");

// Obter Matriz Anual de Orçamento & Metas (Budget vs. Actual - 12 Meses)
const obterMatriz = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const ano = parseInt(req.query.ano, 10) || new Date().getFullYear();

    // 1. Buscar todas as categorias ativas da empresa
    const [categorias] = await db.query(
      `SELECT id, nome, tipo, dre_grupo, cor 
       FROM categorias_financeiras 
       WHERE empresa_id = ? AND ativo = 1 
       ORDER BY tipo DESC, dre_grupo ASC, nome ASC`,
      [empresaId]
    );

    // 2. Buscar metas orçadas do ano
    const [metas] = await db.query(
      `SELECT categoria_id, mes, valor_planejado 
       FROM orcamento_metas 
       WHERE empresa_id = ? AND ano = ?`,
      [empresaId, ano]
    );

    // Mapear metas por categoria e mês: metasMap[catId][mes] = valor
    const metasMap = {};
    metas.forEach((m) => {
      if (!metasMap[m.categoria_id]) metasMap[m.categoria_id] = {};
      metasMap[m.categoria_id][m.mes] = parseFloat(m.valor_planejado);
    });

    // 3. Buscar lançamentos realizados (pagos) no ano agrupados por categoria e mês
    const [realizados] = await db.query(
      `SELECT categoria_id, MONTH(data_vencimento) as mes, SUM(COALESCE(valor_pago, valor)) as total_realizado
       FROM transacoes_financeiras
       WHERE empresa_id = ? AND YEAR(data_vencimento) = ? AND status = 'pago' AND categoria_id IS NOT NULL
       GROUP BY categoria_id, MONTH(data_vencimento)`,
      [empresaId, ano]
    );

    const realizadosMap = {};
    realizados.forEach((r) => {
      if (!realizadosMap[r.categoria_id]) realizadosMap[r.categoria_id] = {};
      realizadosMap[r.categoria_id][r.mes] = parseFloat(r.total_realizado);
    });

    // 4. Montar a Matriz 12M consolidada
    const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    let totalReceitaPlanejada = 0;
    let totalReceitaRealizada = 0;
    let totalDespesaPlanejada = 0;
    let totalDespesaRealizada = 0;

    const linhas = categorias.map((cat) => {
      const mesesLinha = [];
      let totalCatPlanejado = 0;
      let totalCatRealizado = 0;

      for (let m = 1; m <= 12; m++) {
        const plan = metasMap[cat.id]?.[m] || 0;
        const real = realizadosMap[cat.id]?.[m] || 0;
        const diff = real - plan;
        const percentual = plan > 0 ? parseFloat(((real / plan) * 100).toFixed(1)) : (real > 0 ? 100 : 0);

        totalCatPlanejado += plan;
        totalCatRealizado += real;

        if (cat.tipo === 'receita') {
          totalReceitaPlanejada += plan;
          totalReceitaRealizada += real;
        } else {
          totalDespesaPlanejada += plan;
          totalDespesaRealizada += real;
        }

        mesesLinha.push({
          mes: m,
          mes_nome: mesesNomes[m - 1],
          planejado: plan,
          realizado: real,
          diferenca: diff,
          percentual: percentual,
          status_meta: cat.tipo === 'receita'
            ? (percentual >= 100 ? 'atingida' : 'abaixo')
            : (percentual > 100 ? 'estourada' : 'no_limite'),
        });
      }

      return {
        categoria_id: cat.id,
        nome: cat.nome,
        tipo: cat.tipo,
        dre_grupo: cat.dre_grupo,
        cor: cat.cor,
        meses: mesesLinha,
        total_planejado: parseFloat(totalCatPlanejado.toFixed(2)),
        total_realizado: parseFloat(totalCatRealizado.toFixed(2)),
        total_diferenca: parseFloat((totalCatRealizado - totalCatPlanejado).toFixed(2)),
        total_percentual: totalCatPlanejado > 0
          ? parseFloat(((totalCatRealizado / totalCatPlanejado) * 100).toFixed(1))
          : 0,
      };
    });

    const lucroPlanejado = totalReceitaPlanejada - totalDespesaPlanejada;
    const lucroRealizado = totalReceitaRealizada - totalDespesaRealizada;

    return res.json({
      ano,
      resumo_anual: {
        receita_planejada: parseFloat(totalReceitaPlanejada.toFixed(2)),
        receita_realizada: parseFloat(totalReceitaRealizada.toFixed(2)),
        receita_atingimento: totalReceitaPlanejada > 0 ? ((totalReceitaRealizada / totalReceitaPlanejada) * 100).toFixed(1) : "0.0",
        despesa_planejada: parseFloat(totalDespesaPlanejada.toFixed(2)),
        despesa_realizada: parseFloat(totalDespesaRealizada.toFixed(2)),
        despesa_atingimento: totalDespesaPlanejada > 0 ? ((totalDespesaRealizada / totalDespesaPlanejada) * 100).toFixed(1) : "0.0",
        lucro_planejado: parseFloat(lucroPlanejado.toFixed(2)),
        lucro_realizado: parseFloat(lucroRealizado.toFixed(2)),
      },
      linhas,
    });
  } catch (err) {
    console.error("Erro ao obter matriz de orçamento:", err);
    return res.status(500).json({ error: "Erro ao gerar matriz de orçamento e metas." });
  }
};

// Salvar / Atualizar metas orçamentárias em lote
const salvarLote = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const empresaId = req.user.empresa_id;
    const { ano, metas } = req.body;

    if (!ano || !Array.isArray(metas)) {
      await connection.rollback();
      return res.status(400).json({ error: "Ano e lista de metas são obrigatórios." });
    }

    for (const m of metas) {
      const catId = parseInt(m.categoria_id, 10);
      const mes = parseInt(m.mes, 10);
      const valor = Math.max(0, parseFloat(m.valor_planejado) || 0);

      if (catId && mes >= 1 && mes <= 12) {
        await connection.query(
          `INSERT INTO orcamento_metas (empresa_id, ano, categoria_id, mes, valor_planejado)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE valor_planejado = VALUES(valor_planejado)`,
          [empresaId, ano, catId, mes, valor]
        );
      }
    }

    await connection.commit();
    return res.json({ message: "Orçamento e metas salvos com sucesso!" });
  } catch (err) {
    await connection.rollback();
    console.error("Erro ao salvar metas orçamentárias:", err);
    return res.status(500).json({ error: "Erro ao registrar metas de orçamento." });
  } finally {
    connection.release();
  }
};

module.exports = {
  obterMatriz,
  salvarLote,
};
