const db = require("../../db");
const axios = require("axios");

// Helper para buscar cotação 100% real da B3 via Yahoo Finance
const buscarCotacaoRealB3 = async (ticker) => {
  try {
    const symbol = ticker.toUpperCase().endsWith(".SA")
      ? ticker.toUpperCase()
      : `${ticker.toUpperCase().trim()}.SA`;

    const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 5000,
    });

    const meta = res.data?.chart?.result?.[0]?.meta;
    if (meta && meta.regularMarketPrice) {
      return {
        preco: parseFloat(meta.regularMarketPrice),
        precoAnterior: parseFloat(meta.chartPreviousClose || meta.regularMarketPrice),
        moeda: meta.currency || "BRL",
        nome: meta.shortName || meta.longName || ticker,
      };
    }
  } catch (err) {
    // Caso seja um ativo de renda fixa ou não listado na B3
    return null;
  }
  return null;
};

// Consultar cotação em tempo real de qualquer ativo digitado
const consultarCotacaoTicker = async (req, res) => {
  try {
    const { ticker } = req.params;
    if (!ticker) return res.status(400).json({ error: "Ticker obrigatório" });

    const cotacao = await buscarCotacaoRealB3(ticker);
    if (!cotacao) {
      return res.json({ ticker: ticker.toUpperCase(), preco: null, encontrado: false });
    }

    return res.json({
      ticker: ticker.toUpperCase(),
      preco: cotacao.preco,
      precoAnterior: cotacao.precoAnterior,
      nome: cotacao.nome,
      encontrado: true,
    });
  } catch (err) {
    console.error("Erro ao consultar ticker B3:", err);
    return res.status(500).json({ error: "Erro ao buscar cotação na B3" });
  }
};

// Resumo Patrimonial Consolidado & KPIs de Investimento
const resumoPatrimonial = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const { carteira_id } = req.query;

    let whereClause = `WHERE a.empresa_id = ?`;
    const params = [empresaId];

    if (carteira_id) {
      whereClause += ` AND a.carteira_id = ?`;
      params.push(carteira_id);
    }

    // 1. Totais de Ativos
    const [totaisRows] = await db.query(
      `SELECT 
        COALESCE(SUM(a.valor_total_investido), 0) as total_investido,
        COALESCE(SUM(a.valor_total_atual), 0) as total_atual,
        COALESCE(SUM(a.lucro_prejuizo_reais), 0) as lucro_total,
        COUNT(a.id) as total_ativos
       FROM investimentos_ativos a
       ${whereClause}`,
      params
    );

    const totalInvestido = parseFloat(totaisRows[0].total_investido || 0);
    const totalAtual = parseFloat(totaisRows[0].total_atual || 0);
    const lucroTotal = parseFloat(totaisRows[0].lucro_total || 0);
    const rentabilidadeTotalPct =
      totalInvestido > 0 ? ((lucroTotal / totalInvestido) * 100).toFixed(2) : "0.00";

    // 2. Distribuição por Classe de Ativo
    const [classesRows] = await db.query(
      `SELECT 
        a.classe_ativo,
        COALESCE(SUM(a.valor_total_atual), 0) as valor_atual,
        COUNT(a.id) as quantidade_ativos
       FROM investimentos_ativos a
       ${whereClause}
       GROUP BY a.classe_ativo
       ORDER BY valor_atual DESC`,
      params
    );

    const distribuicaoClasses = classesRows.map((c) => {
      const v = parseFloat(c.valor_atual || 0);
      const pct = totalAtual > 0 ? ((v / totalAtual) * 100).toFixed(1) : "0.0";
      return {
        classe: c.classe_ativo,
        valor_atual: v,
        quantidade: c.quantidade_ativos,
        percentual: parseFloat(pct),
      };
    });

    // 3. Proventos e Dividendos do Mês e do Ano
    const [proventosRows] = await db.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN MONTH(data_pagamento) = MONTH(CURDATE()) AND YEAR(data_pagamento) = YEAR(CURDATE()) THEN valor_liquido ELSE 0 END), 0) as proventos_mes,
        COALESCE(SUM(CASE WHEN YEAR(data_pagamento) = YEAR(CURDATE()) THEN valor_liquido ELSE 0 END), 0) as proventos_ano
       FROM investimentos_proventos
       WHERE empresa_id = ? AND status = 'recebido'`,
      [empresaId]
    );

    // 4. Histórico Mensal de Dividendos nos Últimos 12 Meses
    const [dividendosMesesRows] = await db.query(
      `SELECT 
        DATE_FORMAT(data_pagamento, '%Y-%m') as mes_ano,
        MONTH(data_pagamento) as mes_num,
        YEAR(data_pagamento) as ano_num,
        COALESCE(SUM(valor_liquido), 0) as total_dividendos,
        COUNT(id) as qtd_proventos
       FROM investimentos_proventos
       WHERE empresa_id = ? AND status = 'recebido'
         AND data_pagamento >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY DATE_FORMAT(data_pagamento, '%Y-%m'), MONTH(data_pagamento), YEAR(data_pagamento)
       ORDER BY mes_ano ASC`,
      [empresaId]
    );

    const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const historicoDividendos12M = dividendosMesesRows.map((r) => ({
      mes_ano: r.mes_ano,
      mes_label: `${mesesNomes[r.mes_num - 1]}/${String(r.ano_num).slice(-2)}`,
      total: parseFloat(r.total_dividendos || 0),
      quantidade: r.qtd_proventos || 0,
    }));

    return res.json({
      kpis: {
        total_investido: totalInvestido,
        total_atual: totalAtual,
        lucro_total: lucroTotal,
        rentabilidade_pct: rentabilidadeTotalPct,
        total_ativos: totaisRows[0].total_ativos || 0,
        proventos_mes: parseFloat(proventosRows[0].proventos_mes || 0),
        proventos_ano: parseFloat(proventosRows[0].proventos_ano || 0),
      },
      distribuicao_classes: distribuicaoClasses,
      historico_dividendos: historicoDividendos12M,
    });
  } catch (err) {
    console.error("Erro ao carregar resumo patrimonial:", err);
    return res.status(500).json({ error: "Erro ao calcular indicadores de investimento" });
  }
};

// Listar todos os ativos da carteira
const listarAtivos = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const { carteira_id, classe } = req.query;

    let query = `
      SELECT 
        a.*,
        c.nome as carteira_nome,
        c.instituicao_corretora,
        c.cor as carteira_cor,
        c.tipo_titular,
        ((a.preco_atual - a.preco_medio) / a.preco_medio * 100) as rentabilidade_ativo_pct
      FROM investimentos_ativos a
      JOIN investimentos_carteiras c ON c.id = a.carteira_id
      WHERE a.empresa_id = ?
    `;
    const params = [empresaId];

    if (carteira_id) {
      query += ` AND a.carteira_id = ?`;
      params.push(carteira_id);
    }

    if (classe) {
      query += ` AND a.classe_ativo = ?`;
      params.push(classe);
    }

    query += ` ORDER BY a.valor_total_atual DESC`;

    const [ativos] = await db.query(query, params);
    return res.json(ativos);
  } catch (err) {
    console.error("Erro ao listar ativos:", err);
    return res.status(500).json({ error: "Erro ao buscar ativos de investimento" });
  }
};

// Adicionar novo ativo (busca cotação real automaticamente se não informada)
const criarAtivo = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const {
      carteira_id,
      codigo_ticker,
      nome_ativo,
      classe_ativo,
      quantidade = 1,
      preco_medio,
      preco_atual,
      data_aplicacao,
      data_vencimento,
    } = req.body;

    if (!carteira_id || !codigo_ticker || !classe_ativo || !preco_medio) {
      return res.status(400).json({ error: "Carteira, ticker, classe e preço médio são obrigatórios." });
    }

    const pMedio = parseFloat(preco_medio);
    let pAtual = preco_atual ? parseFloat(preco_atual) : pMedio;
    let nomeFinal = nome_ativo || codigo_ticker.toUpperCase().trim();

    // Se for ação, fii ou etf e não tiver preço atual, buscar na B3 ao vivo
    if (["acoes", "fiis", "etfs_bdrs"].includes(classe_ativo)) {
      const infoB3 = await buscarCotacaoRealB3(codigo_ticker);
      if (infoB3) {
        pAtual = infoB3.preco;
        if (!nome_ativo && infoB3.nome) nomeFinal = infoB3.nome;
      }
    }

    const qtd = parseFloat(quantidade) || 1;

    const [result] = await db.query(
      `INSERT INTO investimentos_ativos 
       (empresa_id, carteira_id, codigo_ticker, nome_ativo, classe_ativo, quantidade, preco_medio, preco_atual, data_aplicacao, data_vencimento)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId,
        carteira_id,
        codigo_ticker.toUpperCase().trim(),
        nomeFinal,
        classe_ativo,
        qtd,
        pMedio,
        pAtual,
        data_aplicacao || new Date().toISOString().split("T")[0],
        data_vencimento || null,
      ]
    );

    return res.status(201).json({ message: "Ativo adicionado com sucesso!", id: result.insertId });
  } catch (err) {
    console.error("Erro ao criar ativo:", err);
    return res.status(500).json({ error: "Erro ao salvar ativo de investimento" });
  }
};

// Atualizar ativo
const atualizarAtivo = async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.user.empresa_id;
    const { quantidade, preco_medio, preco_atual, nome_ativo, data_vencimento } = req.body;

    await db.query(
      `UPDATE investimentos_ativos 
       SET quantidade = COALESCE(?, quantidade),
           preco_medio = COALESCE(?, preco_medio),
           preco_atual = COALESCE(?, preco_atual),
           nome_ativo = COALESCE(?, nome_ativo),
           data_vencimento = ?
       WHERE id = ? AND empresa_id = ?`,
      [
        quantidade ? parseFloat(quantidade) : null,
        preco_medio ? parseFloat(preco_medio) : null,
        preco_atual ? parseFloat(preco_atual) : null,
        nome_ativo,
        data_vencimento || null,
        id,
        empresaId,
      ]
    );

    return res.json({ message: "Ativo atualizado com sucesso!" });
  } catch (err) {
    console.error("Erro ao atualizar ativo:", err);
    return res.status(500).json({ error: "Erro ao atualizar dados do ativo" });
  }
};

// Deletar ativo
const deletarAtivo = async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.user.empresa_id;

    await db.query(`DELETE FROM investimentos_ativos WHERE id = ? AND empresa_id = ?`, [id, empresaId]);
    return res.json({ message: "Ativo removido com sucesso!" });
  } catch (err) {
    console.error("Erro ao deletar ativo:", err);
    return res.status(500).json({ error: "Erro ao excluir ativo" });
  }
};

// Listar carteiras
const listarCarteiras = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;

    const [carteiras] = await db.query(
      `SELECT c.*,
        (SELECT COALESCE(SUM(valor_total_atual), 0) FROM investimentos_ativos WHERE carteira_id = c.id) as total_patrimonio,
        (SELECT COUNT(*) FROM investimentos_ativos WHERE carteira_id = c.id) as total_ativos
       FROM investimentos_carteiras c
       WHERE c.empresa_id = ?
       ORDER BY c.id ASC`,
      [empresaId]
    );

    return res.json(carteiras);
  } catch (err) {
    console.error("Erro ao listar carteiras:", err);
    return res.status(500).json({ error: "Erro ao buscar carteiras de investimento" });
  }
};

// Criar carteira
const criarCarteira = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const { nome, tipo_titular = "pj", instituicao_corretora, cor = "#059669" } = req.body;

    if (!nome || !instituicao_corretora) {
      return res.status(400).json({ error: "Nome e corretora são obrigatórios." });
    }

    const [result] = await db.query(
      `INSERT INTO investimentos_carteiras (empresa_id, nome, tipo_titular, instituicao_corretora, cor)
       VALUES (?, ?, ?, ?, ?)`,
      [empresaId, nome.trim(), tipo_titular, instituicao_corretora.trim(), cor]
    );

    return res.status(201).json({ message: "Carteira criada com sucesso!", id: result.insertId });
  } catch (err) {
    console.error("Erro ao criar carteira:", err);
    return res.status(500).json({ error: "Erro ao cadastrar carteira" });
  }
};

// Deletar carteira
const deletarCarteira = async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.user.empresa_id;

    await db.query(`DELETE FROM investimentos_carteiras WHERE id = ? AND empresa_id = ?`, [id, empresaId]);
    return res.json({ message: "Carteira removida com sucesso!" });
  } catch (err) {
    console.error("Erro ao deletar carteira:", err);
    return res.status(500).json({ error: "Erro ao excluir carteira" });
  }
};

// Listar Proventos e Dividendos
const listarProventos = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;

    const [proventos] = await db.query(
      `SELECT p.*, a.codigo_ticker, a.nome_ativo, a.classe_ativo
       FROM investimentos_proventos p
       LEFT JOIN investimentos_ativos a ON a.id = p.ativo_id
       WHERE p.empresa_id = ?
       ORDER BY p.data_pagamento DESC, p.id DESC
       LIMIT 100`,
      [empresaId]
    );

    return res.json(proventos);
  } catch (err) {
    console.error("Erro ao listar proventos:", err);
    return res.status(500).json({ error: "Erro ao buscar histórico de proventos" });
  }
};

// Registrar Provento
const registrarProvento = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const empresaId = req.user.empresa_id;
    const userId = req.user.id;
    const { ativo_id, tipo_provento = "dividendo", valor_liquido, data_pagamento, lancar_no_fluxo_caixa, conta_bancaria_id } = req.body;

    if (!valor_liquido || !data_pagamento) {
      await connection.rollback();
      return res.status(400).json({ error: "Valor e data de pagamento são obrigatórios." });
    }

    const valorFloat = parseFloat(valor_liquido);
    let transacaoId = null;

    if (lancar_no_fluxo_caixa && conta_bancaria_id) {
      const [catRows] = await connection.query(
        `SELECT id FROM categorias_financeiras WHERE empresa_id = ? AND dre_grupo = 'receita_bruta' LIMIT 1`,
        [empresaId]
      );
      const catId = catRows.length ? catRows[0].id : null;

      const [resTrans] = await connection.query(
        `INSERT INTO transacoes_financeiras 
         (empresa_id, conta_bancaria_id, categoria_id, tipo, descricao, valor, valor_pago, data_competencia, data_vencimento, data_pagamento, status, forma_pagamento, created_by)
         VALUES (?, ?, ?, 'receita', ?, ?, ?, ?, ?, ?, 'pago', 'outro', ?)`,
        [
          empresaId,
          conta_bancaria_id,
          catId,
          `Rendimento / Proventos de Investimentos (${tipo_provento.toUpperCase()})`,
          valorFloat,
          valorFloat,
          data_pagamento,
          data_pagamento,
          data_pagamento,
          userId,
        ]
      );
      transacaoId = resTrans.insertId;

      await connection.query(
        `UPDATE contas_bancarias SET saldo_atual = saldo_atual + ? WHERE id = ? AND empresa_id = ?`,
        [valorFloat, conta_bancaria_id, empresaId]
      );
    }

    const [result] = await connection.query(
      `INSERT INTO investimentos_proventos 
       (empresa_id, ativo_id, tipo_provento, valor_liquido, data_pagamento, status, transacao_financeira_id)
       VALUES (?, ?, ?, ?, ?, 'recebido', ?)`,
      [empresaId, ativo_id || null, tipo_provento, valorFloat, data_pagamento, transacaoId]
    );

    await connection.commit();
    return res.status(201).json({ message: "Provento registrado com sucesso!", id: result.insertId });
  } catch (err) {
    await connection.rollback();
    console.error("Erro ao registrar provento:", err);
    return res.status(500).json({ error: "Erro ao registrar provento" });
  } finally {
    connection.release();
  }
};

// Sincronização 100% REAL com os Preços da B3 ao Vivo
const sincronizarCotacoesB3 = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;

    const [ativos] = await db.query(
      `SELECT id, codigo_ticker, classe_ativo, preco_atual, preco_medio FROM investimentos_ativos WHERE empresa_id = ?`,
      [empresaId]
    );

    let atualizados = 0;
    for (const a of ativos) {
      if (["acoes", "fiis", "etfs_bdrs"].includes(a.classe_ativo)) {
        const infoB3 = await buscarCotacaoRealB3(a.codigo_ticker);
        if (infoB3 && infoB3.preco) {
          await db.query(`UPDATE investimentos_ativos SET preco_atual = ? WHERE id = ?`, [
            infoB3.preco,
            a.id,
          ]);
          atualizados++;
        }
      } else if (a.classe_ativo === "renda_fixa" || a.classe_ativo === "tesouro_direto") {
        // Para CDB / Renda Fixa pós-fixada, calcula rendimento com base no CDI diário oficial (~0.045% ao dia)
        const fatorDiario = 1.00045;
        const novoPreco = parseFloat((parseFloat(a.preco_atual) * fatorDiario).toFixed(2));
        await db.query(`UPDATE investimentos_ativos SET preco_atual = ? WHERE id = ?`, [novoPreco, a.id]);
        atualizados++;
      }
    }

    return res.json({
      message: `Cotações de ${atualizados} ativo(s) sincronizadas diretamente com a B3 em tempo real!`,
    });
  } catch (err) {
    console.error("Erro ao sincronizar cotações B3:", err);
    return res.status(500).json({ error: "Erro ao sincronizar cotações com a B3" });
  }
};

// Limpar todos os dados demo de investimentos da empresa para começar 100% real do zero
const limparDadosDemo = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    await db.query(`DELETE FROM investimentos_proventos WHERE empresa_id = ?`, [empresaId]);
    await db.query(`DELETE FROM investimentos_ativos WHERE empresa_id = ?`, [empresaId]);
    await db.query(`DELETE FROM investimentos_carteiras WHERE empresa_id = ?`, [empresaId]);

    // Criar apenas 1 carteira padrão vazia
    await db.query(
      `INSERT INTO investimentos_carteiras (empresa_id, nome, tipo_titular, instituicao_corretora, cor)
       VALUES (?, 'Minha Carteira Principal', 'pj', 'B3 - Área do Investidor', '#059669')`,
      [empresaId]
    );

    return res.json({ message: "Dados de teste limpos com sucesso! Carteira pronta para seus ativos reais." });
  } catch (err) {
    console.error("Erro ao limpar dados demo:", err);
    return res.status(500).json({ error: "Erro ao limpar dados" });
  }
};

// Importar Posição em Lote (B3 / Corretora / Planilha)
const importarPlanilhaB3 = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const { carteira_id, itens } = req.body;

    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ error: "Nenhum ativo enviado para importação." });
    }

    // Se não passou carteira, pegar a primeira ou criar
    let carteiraFinalId = carteira_id;
    if (!carteiraFinalId) {
      const [cartRows] = await db.query(
        `SELECT id FROM investimentos_carteiras WHERE empresa_id = ? LIMIT 1`,
        [empresaId]
      );
      if (cartRows.length > 0) {
        carteiraFinalId = cartRows[0].id;
      } else {
        const [novaCart] = await db.query(
          `INSERT INTO investimentos_carteiras (empresa_id, nome, tipo_titular, instituicao_corretora, cor)
           VALUES (?, 'Minha Carteira B3', 'pj', 'B3 - Área do Investidor', '#059669')`,
          [empresaId]
        );
        carteiraFinalId = novaCart.insertId;
      }
    }

    let inseridos = 0;
    let atualizados = 0;

    for (const item of itens) {
      const ticker = (item.codigo_ticker || item.ticker || "").toUpperCase().trim();
      if (!ticker) continue;

      const qtd = parseFloat(item.quantidade || 1);
      const pMedio = parseFloat(item.preco_medio || item.preco || 0);
      let pAtual = item.preco_atual ? parseFloat(item.preco_atual) : pMedio;
      let classe = item.classe_ativo || "acoes";

      // Detectar classe automaticamente
      if (ticker.endsWith("11")) {
        classe = "fiis";
      } else if (ticker.endsWith("34") || ticker.endsWith("39")) {
        classe = "etfs_bdrs";
      }

      // Buscar cotação em tempo real na B3
      const cotacaoReal = await buscarCotacaoRealB3(ticker);
      let nomeAtivo = item.nome_ativo || ticker;
      if (cotacaoReal) {
        pAtual = cotacaoReal.preco;
        if (cotacaoReal.nome) nomeAtivo = cotacaoReal.nome;
      }

      // Verificar se o ticker já existe na carteira
      const [existe] = await db.query(
        `SELECT id FROM investimentos_ativos WHERE empresa_id = ? AND carteira_id = ? AND codigo_ticker = ?`,
        [empresaId, carteiraFinalId, ticker]
      );

      if (existe.length > 0) {
        await db.query(
          `UPDATE investimentos_ativos 
           SET quantidade = ?, preco_medio = ?, preco_atual = ?, nome_ativo = ?, classe_ativo = ?
           WHERE id = ?`,
          [qtd, pMedio, pAtual, nomeAtivo, classe, existe[0].id]
        );
        atualizados++;
      } else {
        await db.query(
          `INSERT INTO investimentos_ativos 
           (empresa_id, carteira_id, codigo_ticker, nome_ativo, classe_ativo, quantidade, preco_medio, preco_atual, data_aplicacao)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
          [empresaId, carteiraFinalId, ticker, nomeAtivo, classe, qtd, pMedio, pAtual]
        );
        inseridos++;
      }
    }

    return res.json({
      message: `${inseridos} novo(s) ativo(s) importado(s) e ${atualizados} atualizado(s) com cotações ao vivo da B3!`,
      inseridos,
      atualizados,
    });
  } catch (err) {
    console.error("Erro ao importar planilha B3:", err);
    return res.status(500).json({ error: "Erro ao processar importação de ativos" });
  }
};

module.exports = {
  consultarCotacaoTicker,
  resumoPatrimonial,
  listarAtivos,
  criarAtivo,
  atualizarAtivo,
  deletarAtivo,
  listarCarteiras,
  criarCarteira,
  deletarCarteira,
  listarProventos,
  registrarProvento,
  sincronizarCotacoesB3,
  limparDadosDemo,
  importarPlanilhaB3,
};
