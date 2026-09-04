const db = require("../../db");

// Listar extrato pendente com Sugestões Inteligentes de Conciliação (Auto-Match)
const listarExtratoPendente = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const { conta_bancaria_id } = req.query;

    let whereClause = `WHERE ot.empresa_id = ? AND ot.status_conciliacao = 'pendente'`;
    const params = [empresaId];

    if (conta_bancaria_id) {
      whereClause += ` AND ot.conta_bancaria_id = ?`;
      params.push(conta_bancaria_id);
    }

    const [extratoRows] = await db.query(
      `SELECT ot.*, oc.instituicao_nome, cb.nome as conta_nome 
       FROM openfinance_transacoes ot
       LEFT JOIN openfinance_conexoes oc ON oc.id = ot.conexao_id
       LEFT JOIN contas_bancarias cb ON cb.id = ot.conta_bancaria_id
       ${whereClause}
       ORDER BY ot.data_ocorrencia DESC, ot.id DESC`,
      params
    );

    // 1. Buscar lançamentos financeiros provisionados em aberto para cruzar (Sugestão de Conciliação)
    const [provisoes] = await db.query(
      `SELECT t.*, cat.nome as categoria_nome, c.nome as contato_nome, cb.nome as conta_nome
       FROM transacoes_financeiras t
       LEFT JOIN categorias_financeiras cat ON cat.id = t.categoria_id
       LEFT JOIN contatos c ON c.id = t.contato_id
       LEFT JOIN contas_bancarias cb ON cb.id = t.conta_bancaria_id
       WHERE t.empresa_id = ? AND t.status = 'pendente'`,
      [empresaId]
    );

    // 2. Buscar lançamentos que já foram liquidados (status = 'pago') nos últimos 60 dias para alertar duplicidade
    const [liquidadas] = await db.query(
      `SELECT t.*, cat.nome as categoria_nome, c.nome as contato_nome, cb.nome as conta_nome
       FROM transacoes_financeiras t
       LEFT JOIN categorias_financeiras cat ON cat.id = t.categoria_id
       LEFT JOIN contatos c ON c.id = t.contato_id
       LEFT JOIN contas_bancarias cb ON cb.id = t.conta_bancaria_id
       WHERE t.empresa_id = ? AND t.status = 'pago' 
         AND t.data_pagamento >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)`,
      [empresaId]
    );

    // Motor de Auto-Match (Cruzar extrato com previsões e avisar sobre já pagos)
    const itensComMatch = extratoRows.map((item) => {
      const vExtrato = parseFloat(item.valor);
      const tipoEsperado = item.tipo === "credito" ? "receita" : "despesa";
      const dataOcorr = new Date(item.data_ocorrencia);

      let melhorCandidato = null;
      let melhorScore = 0;

      provisoes.forEach((prov) => {
        if (prov.tipo !== tipoEsperado) return;

        let score = 0;
        const vProv = parseFloat(prov.valor);

        // 1. Similaridade de Valor (50 pts se exato)
        const diffValor = Math.abs(vExtrato - vProv);
        if (diffValor === 0) {
          score += 50;
        } else if (diffValor / vExtrato < 0.05) {
          score += 25;
        }

        // 2. Tipo idêntico (20 pts)
        score += 20;

        // 3. Proximidade de Data (20 pts)
        const dataVenc = new Date(prov.data_vencimento);
        const diffDias = Math.abs((dataOcorr - dataVenc) / (1000 * 60 * 60 * 24));
        if (diffDias === 0) {
          score += 20;
        } else if (diffDias <= 3) {
          score += 15;
        } else if (diffDias <= 7) {
          score += 8;
        }

        // 4. Correspondência de Texto/Contato (10 pts)
        const descUpper = item.descricao_banco.toUpperCase();
        if (prov.contato_nome && descUpper.includes(prov.contato_nome.toUpperCase().split(" ")[0])) {
          score += 10;
        }

        if (score > melhorScore && score >= 50) {
          melhorScore = score;
          melhorCandidato = {
            ...prov,
            score_confianca: score,
          };
        }
      });

      // Checar se já existe um lançamento IDÊNTICO liquidado no sistema (Alerta de Duplicidade Nível 2)
      let possivelDuplicataJaPaga = null;
      for (const liq of liquidadas) {
        if (liq.tipo !== tipoEsperado) continue;
        const vLiq = parseFloat(liq.valor_pago || liq.valor);
        if (Math.abs(vExtrato - vLiq) === 0) {
          const dLiq = new Date(liq.data_pagamento || liq.data_vencimento);
          const diffDias = Math.abs((dataOcorr - dLiq) / (1000 * 60 * 60 * 24));
          if (diffDias <= 2) {
            possivelDuplicataJaPaga = {
              id: liq.id,
              descricao: liq.descricao,
              data_pagamento: liq.data_pagamento,
              valor: vLiq,
              categoria_nome: liq.categoria_nome,
              contato_nome: liq.contato_nome,
            };
            break;
          }
        }
      }

      return {
        extrato: item,
        sugestao_match: melhorCandidato,
        alerta_ja_pago: possivelDuplicataJaPaga,
      };
    });

    return res.json(itensComMatch);
  } catch (err) {
    console.error("Erro ao listar extrato para conciliação:", err);
    return res.status(500).json({ error: "Erro ao gerar motor de conciliação" });
  }
};

// Conciliar com Lançamento Existente
const conciliarComExistente = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const empresaId = req.user.empresa_id;
    const { openfinance_transacao_id, transacao_financeira_id, conta_bancaria_id } = req.body;

    if (!openfinance_transacao_id || !transacao_financeira_id) {
      await connection.rollback();
      return res.status(400).json({ error: "IDs do extrato e do lançamento são obrigatórios." });
    }

    // 1. Obter item do extrato
    const [extratoRows] = await connection.query(
      `SELECT * FROM openfinance_transacoes WHERE id = ? AND empresa_id = ? FOR UPDATE`,
      [openfinance_transacao_id, empresaId]
    );

    if (!extratoRows.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Item do extrato não encontrado." });
    }
    const ext = extratoRows[0];

    // 2. Obter lançamento do sistema
    const [transRows] = await connection.query(
      `SELECT * FROM transacoes_financeiras WHERE id = ? AND empresa_id = ? FOR UPDATE`,
      [transacao_financeira_id, empresaId]
    );

    if (!transRows.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Lançamento provisionado não encontrado." });
    }
    const trans = transRows[0];

    const contaFinalId = conta_bancaria_id || ext.conta_bancaria_id || trans.conta_bancaria_id;
    const valorPago = parseFloat(ext.valor);

    // 3. Liquidar o lançamento oficial
    const [resultTrans] = await connection.query(
      `UPDATE transacoes_financeiras 
       SET status = 'pago', 
           valor_pago = ?, 
           data_pagamento = ?, 
           conta_bancaria_id = ?
       WHERE id = ? AND empresa_id = ?`,
      [valorPago, ext.data_ocorrencia, contaFinalId || null, trans.id, empresaId]
    );

    if (resultTrans.affectedRows === 0) {
      console.warn("[Conciliação] UPDATE não afetou nenhuma linha — possível divergência de empresa_id ou id:", {
        transacao_id: trans.id,
        empresa_id: empresaId,
      });
    }

    // 4. Atualizar saldo da conta bancária
    if (contaFinalId) {
      const delta = ext.tipo === "credito" ? valorPago : -valorPago;
      await connection.query(
        `UPDATE contas_bancarias SET saldo_atual = saldo_atual + ? WHERE id = ? AND empresa_id = ?`,
        [delta, contaFinalId, empresaId]
      );
    }

    // 5. Marcar item do extrato como conciliado
    const [resultExtrato] = await connection.query(
      `UPDATE openfinance_transacoes 
       SET status_conciliacao = 'conciliado', transacao_financeira_id = ? 
       WHERE id = ? AND empresa_id = ?`,
      [trans.id, ext.id, empresaId]
    );

    if (resultExtrato.affectedRows === 0) {
      console.warn("[Conciliação] UPDATE no extrato não afetou nenhuma linha — possível divergência de empresa_id ou id:", {
        extrato_id: ext.id,
        empresa_id: empresaId,
      });
    }

    await connection.commit();
    return res.json({ message: "Lançamento conciliado e liquidado com sucesso!" });
  } catch (err) {
    await connection.rollback();
    console.error("Erro ao conciliar:", err);
    return res.status(500).json({ error: "Erro ao processar conciliação." });
  } finally {
    connection.release();
  }
};

// Criar Novo Lançamento Direto do Extrato e Conciliar
const criarEConciliar = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const empresaId = req.user.empresa_id;
    const userId = req.user.id;
    const {
      openfinance_transacao_id,
      descricao,
      categoria_id,
      centro_custo_id,
      contato_id,
      conta_bancaria_id,
    } = req.body;

    const [extratoRows] = await connection.query(
      `SELECT * FROM openfinance_transacoes WHERE id = ? AND empresa_id = ? FOR UPDATE`,
      [openfinance_transacao_id, empresaId]
    );

    if (!extratoRows.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Item do extrato não encontrado." });
    }
    const ext = extratoRows[0];

    const tipo = ext.tipo === "credito" ? "receita" : "despesa";
    const valor = parseFloat(ext.valor);
    const contaFinalId = conta_bancaria_id || ext.conta_bancaria_id;

    // 1. Inserir lançamento financeiro já liquidado
    const [resTrans] = await connection.query(
      `INSERT INTO transacoes_financeiras 
       (empresa_id, conta_bancaria_id, categoria_id, centro_custo_id, contato_id, tipo, descricao, valor, valor_pago, data_competencia, data_vencimento, data_pagamento, status, forma_pagamento, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pago', 'outro', ?)`,
      [
        empresaId,
        contaFinalId || null,
        categoria_id || null,
        centro_custo_id || null,
        contato_id || null,
        tipo,
        descricao || ext.descricao_banco,
        valor,
        valor,
        ext.data_ocorrencia,
        ext.data_ocorrencia,
        ext.data_ocorrencia,
        userId,
      ]
    );

    // 2. Atualizar saldo da conta bancária
    if (contaFinalId) {
      const delta = tipo === "receita" ? valor : -valor;
      await connection.query(
        `UPDATE contas_bancarias SET saldo_atual = saldo_atual + ? WHERE id = ? AND empresa_id = ?`,
        [delta, contaFinalId, empresaId]
      );
    }

    // 3. Marcar extrato como conciliado
    await connection.query(
      `UPDATE openfinance_transacoes 
       SET status_conciliacao = 'conciliado', transacao_financeira_id = ? 
       WHERE id = ?`,
      [resTrans.insertId, ext.id]
    );

    await connection.commit();
    return res.status(201).json({ message: "Lançamento criado e conciliado com sucesso!" });
  } catch (err) {
    await connection.rollback();
    console.error("Erro ao criar e conciliar:", err);
    return res.status(500).json({ error: "Erro ao criar lançamento e conciliar." });
  } finally {
    connection.release();
  }
};

// Ignorar item do extrato
const ignorarItemExtrato = async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.user.empresa_id;

    await db.query(
      `UPDATE openfinance_transacoes SET status_conciliacao = 'ignorado' WHERE id = ? AND empresa_id = ?`,
      [id, empresaId]
    );

    return res.json({ message: "Item do extrato ignorado com sucesso!" });
  } catch (err) {
    console.error("Erro ao ignorar item do extrato:", err);
    return res.status(500).json({ error: "Erro ao ignorar item" });
  }
};

// Limpar todos os itens pendentes da fila de conciliação
const limparFila = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const { conta_bancaria_id } = req.body;

    let query = `DELETE FROM openfinance_transacoes WHERE empresa_id = ? AND status_conciliacao = 'pendente'`;
    const params = [empresaId];

    if (conta_bancaria_id) {
      query += ` AND conta_bancaria_id = ?`;
      params.push(conta_bancaria_id);
    }

    const [result] = await db.query(query, params);
    return res.json({ message: `${result.affectedRows} movimentação(ões) pendente(s) removida(s) da fila!` });
  } catch (err) {
    console.error("Erro ao limpar fila de conciliação:", err);
    return res.status(500).json({ error: "Erro ao limpar fila de conciliação" });
  }
};

module.exports = {
  listarExtratoPendente,
  conciliarComExistente,
  criarEConciliar,
  ignorarItemExtrato,
  limparFila,
};
