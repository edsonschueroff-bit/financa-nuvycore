const db = require("../../db");

// Função matemática pura de cálculo de Markup e Margem de Contribuição
const calcularMetricasPrecificacao = (dados) => {
  const custoDireto = parseFloat(dados.custo_direto) || 0;
  const impostos = parseFloat(dados.aliquota_impostos) || 0;
  const comissao = parseFloat(dados.aliquota_comissao) || 0;
  const taxas = parseFloat(dados.aliquota_taxas_cartao) || 0;
  const fixas = parseFloat(dados.aliquota_despesas_fixas) || 0;
  const lucroDesejado = parseFloat(dados.margem_lucro_desejada) || 0;

  // Soma de todos os percentuais sobre o preço de venda
  const somaPercentuais = impostos + comissao + taxas + fixas + lucroDesejado;
  const divisor = Math.max(0.01, 100 - somaPercentuais);

  const markupMultiplicador = parseFloat((100 / divisor).toFixed(4));
  const precoSugerido = parseFloat((custoDireto * markupMultiplicador).toFixed(2));

  // Se o usuário já passou um preço praticado, usa ele; senão, usa o sugerido
  const precoPraticado = dados.preco_praticado !== undefined && dados.preco_praticado !== null && dados.preco_praticado !== ""
    ? parseFloat(dados.preco_praticado)
    : precoSugerido;

  // Custos Variáveis Unitários = Custo Direto + Impostos(R$) + Comissões(R$) + Taxas(R$)
  const impostosValor = (precoPraticado * impostos) / 100;
  const comissaoValor = (precoPraticado * comissao) / 100;
  const taxasValor = (precoPraticado * taxas) / 100;
  const custoVariavelTotal = custoDireto + impostosValor + comissaoValor + taxasValor;

  // Margem de Contribuição = Preço de Venda - Custos Variáveis
  const margemContribuicaoValor = parseFloat((precoPraticado - custoVariavelTotal).toFixed(2));
  const margemContribuicaoPercentual = precoPraticado > 0
    ? parseFloat(((margemContribuicaoValor / precoPraticado) * 100).toFixed(2))
    : 0;

  // Despesas Fixas Rateadas (R$) e Lucro Líquido Unitário (R$)
  const despesasFixasValor = (precoPraticado * fixas) / 100;
  const lucroEstimadoUnitario = parseFloat((margemContribuicaoValor - despesasFixasValor).toFixed(2));

  return {
    custo_direto: custoDireto,
    aliquota_impostos: impostos,
    aliquota_comissao: comissao,
    aliquota_taxas_cartao: taxas,
    aliquota_despesas_fixas: fixas,
    margem_lucro_desejada: lucroDesejado,
    markup_multiplicador: markupMultiplicador,
    preco_sugerido: precoSugerido,
    preco_praticado: precoPraticado,
    margem_contribuicao_valor: margemContribuicaoValor,
    margem_contribuicao_percentual: margemContribuicaoPercentual,
    lucro_estimado_unitario: lucroEstimadoUnitario,
    detalhamento: {
      impostos_valor: parseFloat(impostosValor.toFixed(2)),
      comissao_valor: parseFloat(comissaoValor.toFixed(2)),
      taxas_valor: parseFloat(taxasValor.toFixed(2)),
      despesas_fixas_valor: parseFloat(despesasFixasValor.toFixed(2)),
      custo_variavel_total: parseFloat(custoVariavelTotal.toFixed(2)),
    }
  };
};

// Listar produtos e serviços precificados
const listar = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const { tipo, search } = req.query;

    let query = `SELECT * FROM precificacao_produtos_servicos WHERE empresa_id = ? AND ativo = 1`;
    const params = [empresaId];

    if (tipo && ['produto', 'servico'].includes(tipo)) {
      query += ` AND tipo = ?`;
      params.push(tipo);
    }

    if (search) {
      query += ` AND nome LIKE ?`;
      params.push(`%${search.trim()}%`);
    }

    query += ` ORDER BY nome ASC`;

    const [itens] = await db.query(query, params);

    // Resumo executivo da carteira de produtos
    const totalItens = itens.length;
    const margemMedia = totalItens > 0
      ? (itens.reduce((acc, i) => acc + parseFloat(i.margem_contribuicao_percentual), 0) / totalItens).toFixed(1)
      : 0;

    return res.json({
      itens,
      resumo: {
        total_itens: totalItens,
        margem_media: parseFloat(margemMedia),
        produtos_count: itens.filter(i => i.tipo === 'produto').length,
        servicos_count: itens.filter(i => i.tipo === 'servico').length,
      }
    });
  } catch (err) {
    console.error("Erro ao listar precificações:", err);
    return res.status(500).json({ error: "Erro ao buscar itens de precificação." });
  }
};

// Simulação interativa instantânea (não salva no banco)
const simular = async (req, res) => {
  try {
    const metricas = calcularMetricasPrecificacao(req.body);
    return res.json(metricas);
  } catch (err) {
    console.error("Erro ao simular precificação:", err);
    return res.status(500).json({ error: "Erro ao calcular simulação de precificação." });
  }
};

// Criar novo produto/serviço precificado
const criar = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const { nome, tipo = 'servico', unidade_medida = 'un', observacoes } = req.body;

    if (!nome) {
      return res.status(400).json({ error: "O nome do produto ou serviço é obrigatório." });
    }

    const calc = calcularMetricasPrecificacao(req.body);

    const [result] = await db.query(
      `INSERT INTO precificacao_produtos_servicos 
       (empresa_id, nome, tipo, unidade_medida, custo_direto, aliquota_impostos, aliquota_comissao, 
        aliquota_taxas_cartao, aliquota_despesas_fixas, margem_lucro_desejada, markup_multiplicador, 
        preco_sugerido, preco_praticado, margem_contribuicao_valor, margem_contribuicao_percentual, 
        lucro_estimado_unitario, observacoes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId,
        nome.trim(),
        tipo,
        unidade_medida,
        calc.custo_direto,
        calc.aliquota_impostos,
        calc.aliquota_comissao,
        calc.aliquota_taxas_cartao,
        calc.aliquota_despesas_fixas,
        calc.margem_lucro_desejada,
        calc.markup_multiplicador,
        calc.preco_sugerido,
        calc.preco_praticado,
        calc.margem_contribuicao_valor,
        calc.margem_contribuicao_percentual,
        calc.lucro_estimado_unitario,
        observacoes || null,
      ]
    );

    return res.status(201).json({
      message: "Produto/Serviço precificado cadastrado com sucesso!",
      id: result.insertId,
      ...calc,
    });
  } catch (err) {
    console.error("Erro ao cadastrar precificação:", err);
    return res.status(500).json({ error: "Erro ao cadastrar item de precificação." });
  }
};

// Atualizar produto/serviço precificado
const atualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.user.empresa_id;
    const { nome, tipo, unidade_medida, observacoes } = req.body;

    const calc = calcularMetricasPrecificacao(req.body);

    const [result] = await db.query(
      `UPDATE precificacao_produtos_servicos 
       SET nome = COALESCE(?, nome),
           tipo = COALESCE(?, tipo),
           unidade_medida = COALESCE(?, unidade_medida),
           custo_direto = ?,
           aliquota_impostos = ?,
           aliquota_comissao = ?,
           aliquota_taxas_cartao = ?,
           aliquota_despesas_fixas = ?,
           margem_lucro_desejada = ?,
           markup_multiplicador = ?,
           preco_sugerido = ?,
           preco_praticado = ?,
           margem_contribuicao_valor = ?,
           margem_contribuicao_percentual = ?,
           lucro_estimado_unitario = ?,
           observacoes = ?
       WHERE id = ? AND empresa_id = ?`,
      [
        nome ? nome.trim() : null,
        tipo || null,
        unidade_medida || null,
        calc.custo_direto,
        calc.aliquota_impostos,
        calc.aliquota_comissao,
        calc.aliquota_taxas_cartao,
        calc.aliquota_despesas_fixas,
        calc.margem_lucro_desejada,
        calc.markup_multiplicador,
        calc.preco_sugerido,
        calc.preco_praticado,
        calc.margem_contribuicao_valor,
        calc.margem_contribuicao_percentual,
        calc.lucro_estimado_unitario,
        observacoes || null,
        id,
        empresaId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Item não encontrado." });
    }

    return res.json({ message: "Precificação atualizada com sucesso!", ...calc });
  } catch (err) {
    console.error("Erro ao atualizar precificação:", err);
    return res.status(500).json({ error: "Erro ao atualizar item de precificação." });
  }
};

// Deletar item
const deletar = async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.user.empresa_id;

    await db.query(
      `UPDATE precificacao_produtos_servicos SET ativo = 0 WHERE id = ? AND empresa_id = ?`,
      [id, empresaId]
    );

    return res.json({ message: "Item removido com sucesso!" });
  } catch (err) {
    console.error("Erro ao remover precificação:", err);
    return res.status(500).json({ error: "Erro ao remover item de precificação." });
  }
};

module.exports = {
  listar,
  simular,
  criar,
  atualizar,
  deletar,
};
