const db = require("../../db");

// 1. Relatório de Gestão de Capital de Giro & Prazos Médios (NCG)
const obterCapitalGiro = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const ano = parseInt(req.query.ano, 10) || new Date().getFullYear();

    // 1.1 Buscar transações de receitas pagas para calcular PMR (Prazo Médio de Recebimento)
    const [receitas] = await db.query(
      `SELECT DATEDIFF(COALESCE(data_pagamento, data_vencimento), data_competencia) as dias, 
              COALESCE(valor_pago, valor) as valor
       FROM transacoes_financeiras
       WHERE empresa_id = ? AND tipo = 'receita' AND status = 'pago' AND YEAR(data_vencimento) = ?`,
      [empresaId, ano]
    );

    let somaPonderadaPMR = 0;
    let somaValorReceitas = 0;
    receitas.forEach((r) => {
      const v = parseFloat(r.valor);
      const d = Math.max(0, parseInt(r.dias, 10) || 0);
      somaPonderadaPMR += d * v;
      somaValorReceitas += v;
    });
    const pmr = somaValorReceitas > 0 ? Math.round(somaPonderadaPMR / somaValorReceitas) : 30;

    // 1.2 Buscar transações de despesas pagas para calcular PMP (Prazo Médio de Pagamento)
    const [despesas] = await db.query(
      `SELECT DATEDIFF(COALESCE(data_pagamento, data_vencimento), data_competencia) as dias, 
              COALESCE(valor_pago, valor) as valor
       FROM transacoes_financeiras
       WHERE empresa_id = ? AND tipo = 'despesa' AND status = 'pago' AND YEAR(data_vencimento) = ?`,
      [empresaId, ano]
    );

    let somaPonderadaPMP = 0;
    let somaValorDespesas = 0;
    despesas.forEach((d) => {
      const v = parseFloat(d.valor);
      const dias = Math.max(0, parseInt(d.dias, 10) || 0);
      somaPonderadaPMP += dias * v;
      somaValorDespesas += v;
    });
    const pmp = somaValorDespesas > 0 ? Math.round(somaPonderadaPMP / somaValorDespesas) : 28;

    // 1.3 Ciclo Financeiro (Dias)
    const cicloFinanceiroDias = pmr - pmp;

    // 1.4 Média diária de despesas operacionais
    const totalDespesasAno = somaValorDespesas > 0 ? somaValorDespesas : 1000;
    const despesaMediaDiaria = totalDespesasAno / 365;

    // 1.5 Necessidade de Capital de Giro (NCG em R$)
    const ncgValor = cicloFinanceiroDias > 0 ? parseFloat((cicloFinanceiroDias * despesaMediaDiaria).toFixed(2)) : 0.00;

    // 1.6 Caixa Mínimo de Segurança (Recomendação: 45 dias de despesas diárias)
    const caixaMinimoSeguranca = parseFloat((despesaMediaDiaria * 45).toFixed(2));

    // 1.7 Saldo Disponível Atual em Contas Bancárias
    const [contas] = await db.query(
      `SELECT COALESCE(SUM(saldo_atual), 0) as saldo_total FROM contas_bancarias WHERE empresa_id = ? AND ativo = 1`,
      [empresaId]
    );
    const saldoTotalAtual = parseFloat(contas[0]?.saldo_total || 0);

    // 1.8 Índice de Cobertura do Caixa Mínimo
    const indiceCobertura = caixaMinimoSeguranca > 0
      ? parseFloat(((saldoTotalAtual / caixaMinimoSeguranca) * 100).toFixed(1))
      : 100;

    return res.json({
      ano,
      pmr_dias: pmr,
      pmp_dias: pmp,
      ciclo_financeiro_dias: cicloFinanceiroDias,
      despesa_media_diaria: parseFloat(despesaMediaDiaria.toFixed(2)),
      ncg_valor: ncgValor,
      caixa_minimo_seguranca: caixaMinimoSeguranca,
      saldo_disponivel_atual: saldoTotalAtual,
      indice_cobertura: indiceCobertura,
      status_saude_caixa: saldoTotalAtual >= caixaMinimoSeguranca ? 'confortavel' : (saldoTotalAtual >= ncgValor ? 'atencao' : 'critico'),
      diagnostico: cicloFinanceiroDias > 0
        ? `Você financia seus clientes em média por ${cicloFinanceiroDias} dias antes de receber dos seus próprios fornecedores. Recomenda-se aumentar prazos com fornecedores ou antecipar recebíveis.`
        : `Excelente! Seus fornecedores lhe concedem ${Math.abs(cicloFinanceiroDias)} dias de prazo a mais do que o prazo que você concede aos seus clientes. Seu caixa é autofinanciado.`,
    });
  } catch (err) {
    console.error("Erro ao calcular capital de giro:", err);
    return res.status(500).json({ error: "Erro ao gerar indicadores de Capital de Giro." });
  }
};

// 2. Relatório de Curva ABC (Pareto 80/20 de Clientes e Categorias)
const obterCurvaABC = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const ano = parseInt(req.query.ano, 10) || new Date().getFullYear();

    // 2.1 Curva ABC de Clientes / Pagadores (Receitas)
    const [clientesRaw] = await db.query(
      `SELECT COALESCE(c.nome, 'Cliente Avulso / Direto') as nome,
              COALESCE(c.cpf_cnpj, '') as cpf_cnpj,
              COUNT(t.id) as total_pedidos,
              SUM(COALESCE(t.valor_pago, t.valor)) as total_faturado
       FROM transacoes_financeiras t
       LEFT JOIN contatos c ON c.id = t.contato_id
       WHERE t.empresa_id = ? AND t.tipo = 'receita' AND t.status = 'pago' AND YEAR(t.data_vencimento) = ?
       GROUP BY t.contato_id, c.nome, c.cpf_cnpj
       ORDER BY total_faturado DESC`,
      [empresaId, ano]
    );

    const totalFaturamentoGeral = clientesRaw.reduce((acc, c) => acc + parseFloat(c.total_faturado), 0);

    let acumuladoClientes = 0;
    const curvaClientes = clientesRaw.map((c) => {
      const valor = parseFloat(c.total_faturado);
      const percentual = totalFaturamentoGeral > 0 ? (valor / totalFaturamentoGeral) * 100 : 0;
      acumuladoClientes += percentual;

      let classe = 'C';
      if (acumuladoClientes <= 80 || (acumuladoClientes - percentual < 80)) {
        classe = 'A';
      } else if (acumuladoClientes <= 95 || (acumuladoClientes - percentual < 95)) {
        classe = 'B';
      }

      return {
        nome: c.nome,
        cpf_cnpj: c.cpf_cnpj,
        total_pedidos: c.total_pedidos,
        valor_faturado: valor,
        percentual: parseFloat(percentual.toFixed(2)),
        percentual_acumulado: parseFloat(Math.min(100, acumuladoClientes).toFixed(2)),
        classe,
      };
    });

    // 2.2 Curva ABC de Despesas / Centros de Custo
    const [despesasRaw] = await db.query(
      `SELECT cat.nome as categoria_nome,
              cat.dre_grupo,
              cat.cor,
              COUNT(t.id) as total_lancamentos,
              SUM(COALESCE(t.valor_pago, t.valor)) as total_despesa
       FROM transacoes_financeiras t
       JOIN categorias_financeiras cat ON cat.id = t.categoria_id
       WHERE t.empresa_id = ? AND t.tipo = 'despesa' AND t.status = 'pago' AND YEAR(t.data_vencimento) = ?
       GROUP BY t.categoria_id, cat.nome, cat.dre_grupo, cat.cor
       ORDER BY total_despesa DESC`,
      [empresaId, ano]
    );

    const totalDespesasGeral = despesasRaw.reduce((acc, d) => acc + parseFloat(d.total_despesa), 0);

    let acumuladoDespesas = 0;
    const curvaDespesas = despesasRaw.map((d) => {
      const valor = parseFloat(d.total_despesa);
      const percentual = totalDespesasGeral > 0 ? (valor / totalDespesasGeral) * 100 : 0;
      acumuladoDespesas += percentual;

      let classe = 'C';
      if (acumuladoDespesas <= 80 || (acumuladoDespesas - percentual < 80)) {
        classe = 'A';
      } else if (acumuladoDespesas <= 95 || (acumuladoDespesas - percentual < 95)) {
        classe = 'B';
      }

      return {
        nome: d.categoria_nome,
        dre_grupo: d.dre_grupo,
        cor: d.cor,
        total_lancamentos: d.total_lancamentos,
        valor_despesa: valor,
        percentual: parseFloat(percentual.toFixed(2)),
        percentual_acumulado: parseFloat(Math.min(100, acumuladoDespesas).toFixed(2)),
        classe,
      };
    });

    return res.json({
      ano,
      total_faturamento: parseFloat(totalFaturamentoGeral.toFixed(2)),
      total_despesas: parseFloat(totalDespesasGeral.toFixed(2)),
      clientes: {
        lista: curvaClientes,
        resumo_classes: {
          classe_a_count: curvaClientes.filter(c => c.classe === 'A').length,
          classe_b_count: curvaClientes.filter(c => c.classe === 'B').length,
          classe_c_count: curvaClientes.filter(c => c.classe === 'C').length,
        }
      },
      despesas: {
        lista: curvaDespesas,
        resumo_classes: {
          classe_a_count: curvaDespesas.filter(d => d.classe === 'A').length,
          classe_b_count: curvaDespesas.filter(d => d.classe === 'B').length,
          classe_c_count: curvaDespesas.filter(d => d.classe === 'C').length,
        }
      }
    });
  } catch (err) {
    console.error("Erro ao gerar curva ABC:", err);
    return res.status(500).json({ error: "Erro ao processar relatório de Curva ABC Pareto." });
  }
};

module.exports = {
  obterCapitalGiro,
  obterCurvaABC,
};
