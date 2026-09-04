const db = require("../../db");

// Dashboard Executivo Avançado & KPIs Corporativos
const dashboardKpis = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const { mes, ano, periodo = "ano", data_inicio, data_fim, conta_selecionada_id } = req.query;

    const now = new Date();
    const targetAno = ano ? parseInt(ano, 10) : now.getFullYear();
    const targetMes = mes ? parseInt(mes, 10) : now.getMonth() + 1;

    let dataInicio = data_inicio;
    let dataFim = data_fim;

    if (!dataInicio || !dataFim) {
      if (periodo === "hoje") {
        const hojeStr = now.toISOString().split("T")[0];
        dataInicio = hojeStr;
        dataFim = hojeStr;
      } else if (periodo === "semana") {
        const d = new Date(now);
        const primeiroDiaSemana = new Date(d.setDate(d.getDate() - d.getDay()));
        const ultimoDiaSemana = new Date(d.setDate(d.getDate() - d.getDay() + 6));
        dataInicio = primeiroDiaSemana.toISOString().split("T")[0];
        dataFim = ultimoDiaSemana.toISOString().split("T")[0];
      } else if (periodo === "mes") {
        dataInicio = `${targetAno}-${String(targetMes).padStart(2, "0")}-01`;
        const ultimoDia = new Date(targetAno, targetMes, 0).getDate();
        dataFim = `${targetAno}-${String(targetMes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
      } else {
        // ano
        dataInicio = `${targetAno}-01-01`;
        dataFim = `${targetAno}-12-31`;
      }
    }

    // 1. Contas Bancárias e Caixas
    const [contasRows] = await db.query(
      `SELECT id, nome, banco, tipo, saldo_atual, cor 
       FROM contas_bancarias 
       WHERE empresa_id = ? AND ativo = 1 
       ORDER BY saldo_atual DESC`,
      [empresaId]
    );
    const saldoContasBancarias = contasRows.reduce((acc, c) => acc + parseFloat(c.saldo_atual || 0), 0);

    // 2. Investimentos & Carteira B3
    const [investimentosRows] = await db.query(
      `SELECT 
        COALESCE(SUM(valor_total_atual), 0) as total_investido,
        COALESCE(SUM(lucro_prejuizo_reais), 0) as lucro_total,
        COUNT(id) as total_ativos
       FROM investimentos_ativos
       WHERE empresa_id = ?`,
      [empresaId]
    );
    const saldoInvestimentosB3 = parseFloat(investimentosRows[0]?.total_investido || 0);
    const lucroInvestimentosB3 = parseFloat(investimentosRows[0]?.lucro_total || 0);
    const patrimonioConsolidadoTotal = saldoContasBancarias + saldoInvestimentosB3;

    // 3. Receitas e Despesas do Período
    const [recRes] = await db.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN status = 'pago' THEN valor_pago ELSE 0 END), 0) as realizado,
        COALESCE(SUM(valor), 0) as total_previsto,
        COALESCE(SUM(CASE WHEN status = 'pendente' THEN valor ELSE 0 END), 0) as pendente,
        COUNT(id) as qtd_total,
        COUNT(CASE WHEN status = 'pendente' THEN 1 END) as qtd_pendente
       FROM transacoes_financeiras 
       WHERE empresa_id = ? AND tipo = 'receita' 
         AND data_vencimento BETWEEN ? AND ?`,
      [empresaId, dataInicio, dataFim]
    );

    const [despRes] = await db.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN status = 'pago' THEN valor_pago ELSE 0 END), 0) as realizado,
        COALESCE(SUM(valor), 0) as total_previsto,
        COALESCE(SUM(CASE WHEN status = 'pendente' THEN valor ELSE 0 END), 0) as pendente,
        COUNT(id) as qtd_total,
        COUNT(CASE WHEN status = 'pendente' THEN 1 END) as qtd_pendente
       FROM transacoes_financeiras 
       WHERE empresa_id = ? AND tipo = 'despesa' 
         AND data_vencimento BETWEEN ? AND ?`,
      [empresaId, dataInicio, dataFim]
    );

    const receitaRealizada = parseFloat(recRes[0].realizado || 0);
    const receitaPrevista = parseFloat(recRes[0].total_previsto || 0);
    const despesaRealizada = parseFloat(despRes[0].realizado || 0);
    const despesaPrevista = parseFloat(despRes[0].total_previsto || 0);
    const lucroLiquidoRealizado = receitaRealizada - despesaRealizada;

    // 4. Inadimplência e Atrasos (Geral)
    const [vencidosRes] = await db.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'receita' AND status = 'pendente' AND data_vencimento < CURDATE() THEN valor ELSE 0 END), 0) as total_receber_vencido,
        COUNT(CASE WHEN tipo = 'receita' AND status = 'pendente' AND data_vencimento < CURDATE() THEN 1 END) as qtd_receber_vencido,
        COALESCE(SUM(CASE WHEN tipo = 'despesa' AND status = 'pendente' AND data_vencimento < CURDATE() THEN valor ELSE 0 END), 0) as total_pagar_vencido,
        COUNT(CASE WHEN tipo = 'despesa' AND status = 'pendente' AND data_vencimento < CURDATE() THEN 1 END) as qtd_pagar_vencido
       FROM transacoes_financeiras
       WHERE empresa_id = ?`,
      [empresaId]
    );

    // 5. Matriz Anual de 12 Meses (Visão Econômica DRE & Visão Financeira Fluxo de Caixa)
    // 5.1 Competência (DRE) baseada em data_competencia
    const [compRows] = await db.query(
      `SELECT 
        MONTH(data_competencia) as mes_num,
        COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END), 0) as receita_competencia,
        COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END), 0) as despesa_competencia
       FROM transacoes_financeiras
       WHERE empresa_id = ? AND YEAR(data_competencia) = ?
       GROUP BY MONTH(data_competencia)
       ORDER BY mes_num ASC`,
      [empresaId, targetAno]
    );

    // 5.2 Regime de Caixa (Entradas e Saídas efetivamente liquidadas no mês de pagamento)
    const [caixaRows] = await db.query(
      `SELECT 
        MONTH(data_pagamento) as mes_num,
        COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor_pago ELSE 0 END), 0) as receita_caixa,
        COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN valor_pago ELSE 0 END), 0) as despesa_caixa
       FROM transacoes_financeiras
       WHERE empresa_id = ? AND status = 'pago' AND data_pagamento IS NOT NULL AND YEAR(data_pagamento) = ?
       GROUP BY MONTH(data_pagamento)
       ORDER BY mes_num ASC`,
      [empresaId, targetAno]
    );

    const mesesNomes = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    const matriz12Meses = mesesNomes.map((nome, index) => {
      const mesNum = index + 1;
      const rComp = compRows.find((r) => r.mes_num === mesNum);
      const rCaixa = caixaRows.find((r) => r.mes_num === mesNum);

      const recComp = rComp ? parseFloat(rComp.receita_competencia || 0) : 0;
      const despComp = rComp ? parseFloat(rComp.despesa_competencia || 0) : 0;
      const recCaixa = rCaixa ? parseFloat(rCaixa.receita_caixa || 0) : 0;
      const despCaixa = rCaixa ? parseFloat(rCaixa.despesa_caixa || 0) : 0;

      return {
        mes: nome,
        mes_num: mesNum,
        receita_bruta: recComp,
        custos_despesas: despComp,
        lucro_liquido_dre: recComp - despComp,
        entradas_caixa: recCaixa,
        saidas_caixa: despCaixa,
        saldo_mensal_caixa: recCaixa - despCaixa,
      };
    });

    // 6. Evolução Acumulada do Saldo Final
    let saldoAcumulado = saldoContasBancarias * 0.4; // Base inicial aproximada
    const evolucaoSaldoConsolidado = matriz12Meses.map((m) => {
      saldoAcumulado += m.saldo_mensal_caixa;
      return {
        mes: m.mes,
        saldo_final: parseFloat(saldoAcumulado.toFixed(2)),
      };
    });

    // 7. Evolução de Saldo por Banco Selecionado
    const contaIdAlvo = conta_selecionada_id ? parseInt(conta_selecionada_id, 10) : (contasRows[0]?.id || null);
    let evolucaoBancoSelecionado = [];

    if (contaIdAlvo) {
      const [bancoMeses] = await db.query(
        `SELECT 
          MONTH(data_pagamento) as mes_num,
          COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor_pago ELSE -valor_pago END), 0) as variacao_saldo
         FROM transacoes_financeiras
         WHERE empresa_id = ? AND conta_bancaria_id = ? AND status = 'pago' AND YEAR(data_pagamento) = ?
         GROUP BY MONTH(data_pagamento)`,
        [empresaId, contaIdAlvo, targetAno]
      );

      const contaAlvoObj = contasRows.find((c) => c.id === contaIdAlvo);
      let saldoBaseBanco = contaAlvoObj ? parseFloat(contaAlvoObj.saldo_atual || 0) * 0.5 : 0;

      evolucaoBancoSelecionado = mesesNomes.map((nome, index) => {
        const mesNum = index + 1;
        const row = bancoMeses.find((b) => b.mes_num === mesNum);
        const variacao = row ? parseFloat(row.variacao_saldo || 0) : 0;
        saldoBaseBanco += variacao;
        return {
          mes: nome,
          saldo: parseFloat(saldoBaseBanco.toFixed(2)),
        };
      });
    }

    return res.json({
      periodo: {
        tipo: periodo,
        mes: targetMes,
        ano: targetAno,
        inicio: dataInicio,
        fim: dataFim,
      },
      kpis: {
        saldo_bancario: saldoContasBancarias,
        saldo_investimentos_b3: saldoInvestimentosB3,
        lucro_investimentos_b3: lucroInvestimentosB3,
        patrimonio_total: patrimonioConsolidadoTotal,
        receita_realizada: receitaRealizada,
        receita_prevista: receitaPrevista,
        receita_pendente: parseFloat(recRes[0].pendente || 0),
        despesa_realizada: despesaRealizada,
        despesa_prevista: despesaPrevista,
        despesa_pendente: parseFloat(despRes[0].pendente || 0),
        lucro_liquido: lucroLiquidoRealizado,
        contas_receber: {
          total: receitaPrevista,
          quantidade: recRes[0].qtd_total || 0,
        },
        contas_pagar: {
          total: despesaPrevista,
          quantidade: despRes[0].qtd_total || 0,
        },
        receber_vencido: {
          total: parseFloat(vencidosRes[0].total_receber_vencido || 0),
          quantidade: vencidosRes[0].qtd_receber_vencido || 0,
        },
        pagar_vencido: {
          total: parseFloat(vencidosRes[0].total_pagar_vencido || 0),
          quantidade: vencidosRes[0].qtd_pagar_vencido || 0,
        },
      },
      contas_bancarias: contasRows,
      conta_selecionada_id: contaIdAlvo,
      matriz_12_meses: matriz12Meses,
      evolucao_saldo_consolidado: evolucaoSaldoConsolidado,
      evolucao_banco_selecionado: evolucaoBancoSelecionado,
    });
  } catch (err) {
    console.error("Erro ao carregar Dashboard KPIs:", err);
    return res.status(500).json({ error: "Erro ao gerar indicadores do dashboard" });
  }
};

// DRE Gerencial Avançada
const dreGerencial = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const { ano = new Date().getFullYear(), mes } = req.query;

    const targetAno = parseInt(ano, 10);

    const [transacoes] = await db.query(
      `SELECT 
        MONTH(t.data_competencia) as mes_num,
        COALESCE(cat.dre_grupo, 'despesa_fixa') as dre_grupo,
        COALESCE(cat.nome, 'Sem Categoria') as categoria_nome,
        cat.id as categoria_id,
        t.tipo,
        COALESCE(SUM(CASE WHEN t.status = 'pago' THEN t.valor_pago ELSE t.valor END), 0) as valor
       FROM transacoes_financeiras t
       LEFT JOIN categorias_financeiras cat ON cat.id = t.categoria_id
       WHERE t.empresa_id = ? AND YEAR(t.data_competencia) = ?
       GROUP BY MONTH(t.data_competencia), cat.dre_grupo, cat.nome, cat.id, t.tipo
       ORDER BY cat.dre_grupo ASC, valor DESC`,
      [empresaId, targetAno]
    );

    const mesesValores = () => Array(13).fill(0);

    const dreMatriz = {
      receita_bruta: { total: 0, meses: mesesValores(), categorias: {} },
      deducoes_impostos: { total: 0, meses: mesesValores(), categorias: {} },
      receita_liquida: { total: 0, meses: mesesValores() },
      custos_variaveis: { total: 0, meses: mesesValores(), categorias: {} },
      margem_contribuicao: { total: 0, meses: mesesValores() },
      despesas_fixas: { total: 0, meses: mesesValores(), categorias: {} },
      resultado_operacional_ebitda: { total: 0, meses: mesesValores() },
      resultado_financeiro: { total: 0, meses: mesesValores(), categorias: {} },
      lucro_liquido: { total: 0, meses: mesesValores() },
    };

    transacoes.forEach((t) => {
      const m = t.mes_num;
      const v = parseFloat(t.valor || 0);
      const grupo = t.dre_grupo;
      const catNome = t.categoria_nome;

      if (t.tipo === "receita") {
        dreMatriz.receita_bruta.total += v;
        dreMatriz.receita_bruta.meses[m] += v;

        if (!dreMatriz.receita_bruta.categorias[catNome]) {
          dreMatriz.receita_bruta.categorias[catNome] = { total: 0, meses: mesesValores() };
        }
        dreMatriz.receita_bruta.categorias[catNome].total += v;
        dreMatriz.receita_bruta.categorias[catNome].meses[m] += v;
      } else {
        if (grupo === "imposto" || grupo === "deducao_receita") {
          dreMatriz.deducoes_impostos.total += v;
          dreMatriz.deducoes_impostos.meses[m] += v;

          if (!dreMatriz.deducoes_impostos.categorias[catNome]) {
            dreMatriz.deducoes_impostos.categorias[catNome] = { total: 0, meses: mesesValores() };
          }
          dreMatriz.deducoes_impostos.categorias[catNome].total += v;
          dreMatriz.deducoes_impostos.categorias[catNome].meses[m] += v;
        } else if (grupo === "custo_variavel") {
          dreMatriz.custos_variaveis.total += v;
          dreMatriz.custos_variaveis.meses[m] += v;

          if (!dreMatriz.custos_variaveis.categorias[catNome]) {
            dreMatriz.custos_variaveis.categorias[catNome] = { total: 0, meses: mesesValores() };
          }
          dreMatriz.custos_variaveis.categorias[catNome].total += v;
          dreMatriz.custos_variaveis.categorias[catNome].meses[m] += v;
        } else if (grupo === "despesa_financeira") {
          dreMatriz.resultado_financeiro.total += v;
          dreMatriz.resultado_financeiro.meses[m] += v;

          if (!dreMatriz.resultado_financeiro.categorias[catNome]) {
            dreMatriz.resultado_financeiro.categorias[catNome] = { total: 0, meses: mesesValores() };
          }
          dreMatriz.resultado_financeiro.categorias[catNome].total += v;
          dreMatriz.resultado_financeiro.categorias[catNome].meses[m] += v;
        } else {
          dreMatriz.despesas_fixas.total += v;
          dreMatriz.despesas_fixas.meses[m] += v;

          if (!dreMatriz.despesas_fixas.categorias[catNome]) {
            dreMatriz.despesas_fixas.categorias[catNome] = { total: 0, meses: mesesValores() };
          }
          dreMatriz.despesas_fixas.categorias[catNome].total += v;
          dreMatriz.despesas_fixas.categorias[catNome].meses[m] += v;
        }
      }
    });

    for (let m = 1; m <= 12; m++) {
      dreMatriz.receita_liquida.meses[m] =
        dreMatriz.receita_bruta.meses[m] - dreMatriz.deducoes_impostos.meses[m];
      dreMatriz.margem_contribuicao.meses[m] =
        dreMatriz.receita_liquida.meses[m] - dreMatriz.custos_variaveis.meses[m];
      dreMatriz.resultado_operacional_ebitda.meses[m] =
        dreMatriz.margem_contribuicao.meses[m] - dreMatriz.despesas_fixas.meses[m];
      dreMatriz.lucro_liquido.meses[m] =
        dreMatriz.resultado_operacional_ebitda.meses[m] - dreMatriz.resultado_financeiro.meses[m];
    }

    dreMatriz.receita_liquida.total = dreMatriz.receita_bruta.total - dreMatriz.deducoes_impostos.total;
    dreMatriz.margem_contribuicao.total =
      dreMatriz.receita_liquida.total - dreMatriz.custos_variaveis.total;
    dreMatriz.resultado_operacional_ebitda.total =
      dreMatriz.margem_contribuicao.total - dreMatriz.despesas_fixas.total;
    dreMatriz.lucro_liquido.total =
      dreMatriz.resultado_operacional_ebitda.total - dreMatriz.resultado_financeiro.total;

    const margemContribuicaoPct =
      dreMatriz.receita_liquida.total > 0
        ? dreMatriz.margem_contribuicao.total / dreMatriz.receita_liquida.total
        : 0;

    const pontoEquilibrioMensal =
      margemContribuicaoPct > 0 ? dreMatriz.despesas_fixas.total / 12 / margemContribuicaoPct : 0;

    let mesFiltroNum = mes ? parseInt(mes, 10) : null;

    return res.json({
      ano: targetAno,
      mes_selecionado: mesFiltroNum,
      ponto_equilibrio: {
        faturamento_minimo_mensal: pontoEquilibrioMensal,
        margem_contribuicao_pct: (margemContribuicaoPct * 100).toFixed(1),
        despesa_fixa_media_mensal: dreMatriz.despesas_fixas.total / (mesFiltroNum ? 1 : 12),
      },
      matriz: dreMatriz,
    });
  } catch (err) {
    console.error("Erro ao gerar DRE Avançada:", err);
    return res.status(500).json({ error: "Erro ao calcular DRE Gerencial" });
  }
};

// Projeção de Fluxo de Caixa Futuro (30 / 60 / 90 Dias)
const fluxoCaixaProjetado = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const dias = parseInt(req.query.dias, 10) || 30; // 30, 60, 90

    // 1. Saldo Bancário Consolidado Atual
    const [contasRows] = await db.query(
      `SELECT id, nome, banco, saldo_atual, cor 
       FROM contas_bancarias 
       WHERE empresa_id = ? AND ativo = 1`,
      [empresaId]
    );
    const saldoInicial = contasRows.reduce((acc, c) => acc + parseFloat(c.saldo_atual || 0), 0);

    // 2. Pendências Vencidas Anteriores (Atrasados a Pagar e a Receber)
    const [atrasadosRows] = await db.query(
      `SELECT 
         tipo,
         COALESCE(SUM(valor), 0) as total,
         COUNT(id) as qtd
       FROM transacoes_financeiras
       WHERE empresa_id = ? AND status = 'pendente' AND data_vencimento < CURDATE()
       GROUP BY tipo`,
      [empresaId]
    );

    let pagarAtrasado = 0;
    let receberAtrasado = 0;
    atrasadosRows.forEach((row) => {
      if (row.tipo === "despesa") pagarAtrasado = parseFloat(row.total);
      if (row.tipo === "receita") receberAtrasado = parseFloat(row.total);
    });

    // 3. Entradas e Saídas futuras previstas no horizonte de dias
    const [transacoesFuturas] = await db.query(
      `SELECT 
         t.id,
         t.tipo,
         t.descricao,
         t.valor,
         t.status,
         DATE_FORMAT(t.data_vencimento, '%Y-%m-%d') as data_vencimento,
         t.contato_id,
         c.nome as contato_nome,
         cat.nome as categoria_nome,
         cat.cor as categoria_cor
       FROM transacoes_financeiras t
       LEFT JOIN contatos c ON c.id = t.contato_id
       LEFT JOIN categorias_financeiras cat ON cat.id = t.categoria_id
       WHERE t.empresa_id = ? 
         AND t.status = 'pendente' 
         AND t.data_vencimento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
       ORDER BY t.data_vencimento ASC, t.id ASC`,
      [empresaId, dias]
    );

    // 3.1 Transações REALIZADAS / PAGAS HOJE
    const [transacoesHojePagas] = await db.query(
      `SELECT 
         t.id,
         t.tipo,
         t.descricao,
         COALESCE(t.valor_pago, t.valor) as valor,
         'pago' as status,
         DATE_FORMAT(COALESCE(t.data_pagamento, t.data_vencimento), '%Y-%m-%d') as data_vencimento,
         t.contato_id,
         c.nome as contato_nome,
         cat.nome as categoria_nome,
         cat.cor as categoria_cor
       FROM transacoes_financeiras t
       LEFT JOIN contatos c ON c.id = t.contato_id
       LEFT JOIN categorias_financeiras cat ON cat.id = t.categoria_id
       WHERE t.empresa_id = ? 
         AND t.status = 'pago' 
         AND (t.data_pagamento = CURDATE() OR t.data_vencimento = CURDATE())
       ORDER BY t.id DESC`,
      [empresaId]
    );

    // Mapear transações agrupadas por dia
    const mapDia = {};
    
    // Inserir transações pagas de hoje no mapa do dia
    const hojeIsoStr = new Date().toISOString().split("T")[0];
    transacoesHojePagas.forEach((t) => {
      const d = hojeIsoStr;
      if (!mapDia[d]) {
        mapDia[d] = {
          entradas: 0,
          saidas: 0,
          itens: [],
        };
      }
      const val = parseFloat(t.valor || 0);
      if (t.tipo === "receita") {
        mapDia[d].entradas += val;
      } else {
        mapDia[d].saidas += val;
      }
      mapDia[d].itens.push(t);
    });

    // Inserir transações futuras pendentes no mapa
    transacoesFuturas.forEach((t) => {
      const d = t.data_vencimento;
      if (!mapDia[d]) {
        mapDia[d] = {
          entradas: 0,
          saidas: 0,
          itens: [],
        };
      }
      const val = parseFloat(t.valor || 0);
      if (t.tipo === "receita") {
        mapDia[d].entradas += val;
      } else {
        mapDia[d].saidas += val;
      }
      mapDia[d].itens.push(t);
    });

    // 4. Construir curva diária de projeção
    const curvaDiaria = [];
    let saldoAcumulado = saldoInicial;
    let menorSaldo = saldoInicial;
    let dataMenorSaldo = null;
    let maiorSaldo = saldoInicial;
    let dataMaiorSaldo = null;
    let totalEntradas = 0;
    let totalSaidas = 0;
    const diasCriticos = [];

    const hoje = new Date();
    for (let i = 0; i <= dias; i++) {
      const dataCursor = new Date(hoje);
      dataCursor.setDate(dataCursor.getDate() + i);
      const dataIso = dataCursor.toISOString().split("T")[0];

      const diaData = mapDia[dataIso] || { entradas: 0, saidas: 0, itens: [] };
      const entradas = diaData.entradas;
      const saidas = diaData.saidas;
      const resultadoDia = entradas - saidas;

      totalEntradas += entradas;
      totalSaidas += saidas;

      if (i > 0) {
        saldoAcumulado += resultadoDia;
      }

      if (saldoAcumulado < menorSaldo) {
        menorSaldo = saldoAcumulado;
        dataMenorSaldo = dataIso;
      }
      if (saldoAcumulado > maiorSaldo) {
        maiorSaldo = saldoAcumulado;
        dataMaiorSaldo = dataIso;
      }

      const isNegativo = saldoAcumulado < 0;
      if (isNegativo) {
        diasCriticos.push({
          data: dataIso,
          saldo: saldoAcumulado,
          deficit: Math.abs(saldoAcumulado),
        });
      }

      curvaDiaria.push({
        dia_indice: i,
        data: dataIso,
        dia_semana: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][dataCursor.getDay()],
        entradas,
        saidas,
        resultado_dia: resultadoDia,
        saldo_acumulado: saldoAcumulado,
        alerta_negativo: isNegativo,
        qtd_lancamentos: diaData.itens.length,
        itens: diaData.itens,
      });
    }

    // 5. Agrupamento semanal executivo
    const semanas = [];
    let semanaAtual = null;

    curvaDiaria.forEach((dia, idx) => {
      const semanaNum = Math.floor(idx / 7) + 1;
      if (!semanaAtual || semanaAtual.semana !== semanaNum) {
        if (semanaAtual) semanas.push(semanaAtual);
        semanaAtual = {
          semana: semanaNum,
          data_inicio: dia.data,
          data_fim: dia.data,
          entradas: 0,
          saidas: 0,
          resultado: 0,
          saldo_final_semana: dia.saldo_acumulado,
          alerta_negativo: false,
        };
      }
      semanaAtual.data_fim = dia.data;
      semanaAtual.entradas += dia.entradas;
      semanaAtual.saidas += dia.saidas;
      semanaAtual.resultado += dia.resultado_dia;
      semanaAtual.saldo_final_semana = dia.saldo_acumulado;
      if (dia.alerta_negativo) semanaAtual.alerta_negativo = true;
    });
    if (semanaAtual) semanas.push(semanaAtual);

    return res.json({
      horizonte_dias: dias,
      resumo: {
        saldo_inicial: saldoInicial,
        total_entradas_previstas: totalEntradas,
        total_saidas_previstas: totalSaidas,
        resultado_liquido_periodo: totalEntradas - totalSaidas,
        saldo_final_projetado: saldoAcumulado,
        menor_saldo: {
          valor: menorSaldo,
          data: dataMenorSaldo,
        },
        maior_saldo: {
          valor: maiorSaldo,
          data: dataMaiorSaldo,
        },
        contas_atrasadas: {
          pagar: pagarAtrasado,
          receber: receberAtrasado,
        },
        possui_deficit: diasCriticos.length > 0,
        primeiro_dia_deficit: diasCriticos[0] || null,
        total_dias_deficit: diasCriticos.length,
      },
      contas_bancarias: contasRows,
      curva_diaria: curvaDiaria,
      semanas,
    });
  } catch (err) {
    console.error("Erro ao calcular Fluxo de Caixa Projetado:", err);
    return res.status(500).json({ error: "Erro ao projetar fluxo de caixa" });
  }
};

// Relatório Analítico de Rateio por Centros de Custo
const relatorioRateioCentrosCusto = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const { ano, mes, data_inicio, data_fim } = req.query;

    const now = new Date();
    const targetAno = ano ? parseInt(ano, 10) : now.getFullYear();
    const targetMes = mes ? parseInt(mes, 10) : null;

    let dataInicio = data_inicio;
    let dataFim = data_fim;

    if (!dataInicio || !dataFim) {
      if (targetMes) {
        dataInicio = `${targetAno}-${String(targetMes).padStart(2, "0")}-01`;
        const ultimoDia = new Date(targetAno, targetMes, 0).getDate();
        dataFim = `${targetAno}-${String(targetMes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
      } else {
        dataInicio = `${targetAno}-01-01`;
        dataFim = `${targetAno}-12-31`;
      }
    }

    // 1. Listar Centros de Custo Ativos
    const [centros] = await db.query(
      `SELECT id, nome, codigo, responsavel, orcamento_mensal, cor 
       FROM centros_custo 
       WHERE empresa_id = ? AND ativo = 1
       ORDER BY nome ASC`,
      [empresaId]
    );

    // 2. Transações rateadas via transacao_rateios
    const [rateiosRows] = await db.query(
      `SELECT 
         tr.centro_custo_id,
         t.tipo,
         t.id as transacao_id,
         t.descricao,
         t.data_competencia,
         t.data_vencimento,
         t.data_pagamento,
         t.status,
         tr.percentual,
         tr.valor as valor_rateado,
         c.nome as contato_nome,
         cat.nome as categoria_nome
       FROM transacao_rateios tr
       JOIN transacoes_financeiras t ON t.id = tr.transacao_id
       LEFT JOIN contatos c ON c.id = t.contato_id
       LEFT JOIN categorias_financeiras cat ON cat.id = t.categoria_id
       WHERE tr.empresa_id = ?
         AND t.data_competencia BETWEEN ? AND ?`,
      [empresaId, dataInicio, dataFim]
    );

    // 3. Transações diretas (com centro_custo_id direto, que NÃO possuem registro em transacao_rateios)
    const [diretosRows] = await db.query(
      `SELECT 
         t.centro_custo_id,
         t.tipo,
         t.id as transacao_id,
         t.descricao,
         t.data_competencia,
         t.data_vencimento,
         t.data_pagamento,
         t.status,
         100.00 as percentual,
         t.valor as valor_rateado,
         c.nome as contato_nome,
         cat.nome as categoria_nome
       FROM transacoes_financeiras t
       LEFT JOIN contatos c ON c.id = t.contato_id
       LEFT JOIN categorias_financeiras cat ON cat.id = t.categoria_id
       WHERE t.empresa_id = ?
         AND t.centro_custo_id IS NOT NULL
         AND t.id NOT IN (SELECT transacao_id FROM transacao_rateios WHERE empresa_id = ?)
         AND t.data_competencia BETWEEN ? AND ?`,
      [empresaId, empresaId, dataInicio, dataFim]
    );

    // Consolidar todos os lançamentos
    const todosLancamentos = [...rateiosRows, ...diretosRows];

    // Agrupar por Centro de Custo
    const mapCentros = {};
    centros.forEach((c) => {
      mapCentros[c.id] = {
        centro_id: c.id,
        nome: c.nome,
        codigo: c.codigo,
        responsavel: c.responsavel,
        orcamento_mensal: parseFloat(c.orcamento_mensal || 0),
        cor: c.cor || "#059669",
        total_receitas: 0,
        total_despesas: 0,
        saldo_resultado: 0,
        qtd_lancamentos: 0,
        itens: [],
      };
    });

    let totalGeralReceitas = 0;
    let totalGeralDespesas = 0;

    todosLancamentos.forEach((item) => {
      const cId = item.centro_custo_id;
      if (!mapCentros[cId]) {
        mapCentros[cId] = {
          centro_id: cId,
          nome: "Não Especificado",
          orcamento_mensal: 0,
          cor: "#64748b",
          total_receitas: 0,
          total_despesas: 0,
          saldo_resultado: 0,
          qtd_lancamentos: 0,
          itens: [],
        };
      }

      const val = parseFloat(item.valor_rateado || 0);
      if (item.tipo === "receita") {
        mapCentros[cId].total_receitas += val;
        totalGeralReceitas += val;
      } else {
        mapCentros[cId].total_despesas += val;
        totalGeralDespesas += val;
      }
      mapCentros[cId].saldo_resultado = mapCentros[cId].total_receitas - mapCentros[cId].total_despesas;
      mapCentros[cId].qtd_lancamentos += 1;
      mapCentros[cId].itens.push(item);
    });

    const listaCentros = Object.values(mapCentros).map((c) => {
      const orcamentoComparativo = targetMes ? c.orcamento_mensal : c.orcamento_mensal * 12;
      const pctOrcamentoUtilizado = orcamentoComparativo > 0
        ? ((c.total_despesas / orcamentoComparativo) * 100).toFixed(1)
        : null;
      const pctDespesaGeral = totalGeralDespesas > 0
        ? ((c.total_despesas / totalGeralDespesas) * 100).toFixed(1)
        : "0.0";

      return {
        ...c,
        orcamento_periodo: orcamentoComparativo,
        pct_orcamento_utilizado: pctOrcamentoUtilizado,
        pct_despesa_geral: pctDespesaGeral,
      };
    });

    return res.json({
      periodo: {
        ano: targetAno,
        mes: targetMes,
        data_inicio: dataInicio,
        data_fim: dataFim,
      },
      resumo: {
        total_centros: centros.length,
        total_geral_receitas: totalGeralReceitas,
        total_geral_despesas: totalGeralDespesas,
        resultado_liquido_geral: totalGeralReceitas - totalGeralDespesas,
      },
      centros: listaCentros,
    });
  } catch (err) {
    console.error("Erro ao gerar relatório de rateio de centros de custo:", err);
    return res.status(500).json({ error: "Erro ao gerar relatório de rateio" });
  }
};

module.exports = {
  dashboardKpis,
  dreGerencial,
  fluxoCaixaProjetado,
  relatorioRateioCentrosCusto,
};
