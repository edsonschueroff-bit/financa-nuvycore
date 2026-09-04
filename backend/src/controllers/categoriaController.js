const db = require("../../db");

// Listar categorias com total acumulado no ano
const listarCategorias = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const { tipo } = req.query;

    let query = `SELECT c.*,
      (SELECT COUNT(*) FROM transacoes_financeiras WHERE categoria_id = c.id) as total_transacoes,
      (SELECT COALESCE(SUM(valor), 0) FROM transacoes_financeiras WHERE categoria_id = c.id AND YEAR(data_competencia) = YEAR(CURDATE())) as total_ano
     FROM categorias_financeiras c
     WHERE c.empresa_id = ? AND c.ativo = 1`;
    const params = [empresaId];

    if (tipo && ['receita', 'despesa'].includes(tipo)) {
      query += ` AND c.tipo = ?`;
      params.push(tipo);
    }

    query += ` ORDER BY c.tipo ASC, c.dre_grupo ASC, c.nome ASC`;

    const [categorias] = await db.query(query, params);
    return res.json(categorias);
  } catch (err) {
    console.error("Erro ao listar categorias:", err);
    return res.status(500).json({ error: "Erro ao buscar categorias" });
  }
};

// Criar categoria
const criarCategoria = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const { nome, tipo, dre_grupo = 'despesa_fixa', categoria_pai_id, cor = '#059669', icone = 'Folder' } = req.body;

    if (!nome || !tipo) {
      return res.status(400).json({ error: "Nome e tipo (receita/despesa) são obrigatórios." });
    }

    const [result] = await db.query(
      `INSERT INTO categorias_financeiras (empresa_id, nome, tipo, dre_grupo, categoria_pai_id, cor, icone)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [empresaId, nome.trim(), tipo, dre_grupo, categoria_pai_id || null, cor, icone]
    );

    return res.status(201).json({ message: "Categoria criada com sucesso!", id: result.insertId });
  } catch (err) {
    console.error("Erro ao criar categoria:", err);
    return res.status(500).json({ error: "Erro ao criar categoria" });
  }
};

// Atualizar categoria
const atualizarCategoria = async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.user.empresa_id;
    const { nome, dre_grupo, cor, icone } = req.body;

    await db.query(
      `UPDATE categorias_financeiras 
       SET nome = COALESCE(?, nome),
           dre_grupo = COALESCE(?, dre_grupo),
           cor = COALESCE(?, cor),
           icone = COALESCE(?, icone)
       WHERE id = ? AND empresa_id = ?`,
      [nome, dre_grupo, cor, icone, id, empresaId]
    );

    return res.json({ message: "Categoria atualizada com sucesso!" });
  } catch (err) {
    console.error("Erro ao atualizar categoria:", err);
    return res.status(500).json({ error: "Erro ao atualizar categoria" });
  }
};

// Deletar categoria
const deletarCategoria = async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.user.empresa_id;

    await db.query(`UPDATE categorias_financeiras SET ativo = 0 WHERE id = ? AND empresa_id = ?`, [id, empresaId]);
    return res.json({ message: "Categoria desativada com sucesso!" });
  } catch (err) {
    console.error("Erro ao desativar categoria:", err);
    return res.status(500).json({ error: "Erro ao desativar categoria" });
  }
};

// Centros de Custo com Gastos e Orçamento (Budget) do Mês
const listarCentrosCusto = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;

    const [centros] = await db.query(
      `SELECT cc.*,
        (SELECT COALESCE(SUM(valor), 0) 
         FROM transacoes_financeiras 
         WHERE centro_custo_id = cc.id 
           AND tipo = 'despesa'
           AND MONTH(data_competencia) = MONTH(CURDATE()) 
           AND YEAR(data_competencia) = YEAR(CURDATE())) as gasto_mes_atual,
        (SELECT COUNT(*) FROM transacoes_financeiras WHERE centro_custo_id = cc.id) as total_lancamentos
       FROM centros_custo cc
       WHERE cc.empresa_id = ? AND cc.ativo = 1
       ORDER BY cc.nome ASC`,
      [empresaId]
    );

    const centrosComCalculo = centros.map((c) => {
      const orcamento = parseFloat(c.orcamento_mensal || 0);
      const gasto = parseFloat(c.gasto_mes_atual || 0);
      const pctConsumido = orcamento > 0 ? ((gasto / orcamento) * 100).toFixed(1) : "0.0";
      return {
        ...c,
        gasto_mes_atual: gasto,
        orcamento_mensal: orcamento,
        percentual_consumido: parseFloat(pctConsumido),
      };
    });

    return res.json(centrosComCalculo);
  } catch (err) {
    console.error("Erro ao listar centros de custo:", err);
    return res.status(500).json({ error: "Erro ao buscar centros de custo" });
  }
};

// Criar Centro de Custo
const criarCentroCusto = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const { nome, codigo, responsavel, orcamento_mensal = 0, cor = '#059669' } = req.body;

    if (!nome) {
      return res.status(400).json({ error: "Nome do centro de custo é obrigatório" });
    }

    const [result] = await db.query(
      `INSERT INTO centros_custo (empresa_id, nome, codigo, responsavel, orcamento_mensal, cor) VALUES (?, ?, ?, ?, ?, ?)`,
      [empresaId, nome.trim(), codigo || null, responsavel || null, parseFloat(orcamento_mensal) || 0, cor]
    );

    return res.status(201).json({ message: "Centro de custo criado com sucesso!", id: result.insertId });
  } catch (err) {
    console.error("Erro ao criar centro de custo:", err);
    return res.status(500).json({ error: "Erro ao criar centro de custo" });
  }
};

// Atualizar Centro de Custo
const atualizarCentroCusto = async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.user.empresa_id;
    const { nome, codigo, responsavel, orcamento_mensal, cor } = req.body;

    await db.query(
      `UPDATE centros_custo 
       SET nome = COALESCE(?, nome),
           codigo = ?,
           responsavel = ?,
           orcamento_mensal = COALESCE(?, orcamento_mensal),
           cor = COALESCE(?, cor)
       WHERE id = ? AND empresa_id = ?`,
      [nome, codigo || null, responsavel || null, orcamento_mensal !== undefined ? parseFloat(orcamento_mensal) : null, cor, id, empresaId]
    );

    return res.json({ message: "Centro de custo atualizado com sucesso!" });
  } catch (err) {
    console.error("Erro ao atualizar centro de custo:", err);
    return res.status(500).json({ error: "Erro ao atualizar centro de custo" });
  }
};

// Deletar Centro de Custo
const deletarCentroCusto = async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.user.empresa_id;

    await db.query(`UPDATE centros_custo SET ativo = 0 WHERE id = ? AND empresa_id = ?`, [id, empresaId]);
    return res.json({ message: "Centro de custo desativado com sucesso!" });
  } catch (err) {
    console.error("Erro ao deletar centro de custo:", err);
    return res.status(500).json({ error: "Erro ao desativar centro de custo" });
  }
};

module.exports = {
  listarCategorias,
  criarCategoria,
  atualizarCategoria,
  deletarCategoria,
  listarCentrosCusto,
  criarCentroCusto,
  atualizarCentroCusto,
  deletarCentroCusto,
};
