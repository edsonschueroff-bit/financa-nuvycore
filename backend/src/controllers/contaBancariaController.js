const db = require("../../db");

// Listar todas as contas bancárias com saldos e percentual do total
const listar = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;

    const [contas] = await db.query(
      `SELECT cb.*, f.nome as filial_nome 
       FROM contas_bancarias cb
       LEFT JOIN filiais f ON f.id = cb.filial_id
       WHERE cb.empresa_id = ? AND cb.ativo = 1
       ORDER BY cb.saldo_atual DESC, cb.nome ASC`,
      [empresaId]
    );

    const saldoTotal = contas.reduce((acc, c) => acc + parseFloat(c.saldo_atual || 0), 0);

    const contasComPercentual = contas.map((c) => ({
      ...c,
      percentual_patrimonio:
        saldoTotal > 0 ? ((parseFloat(c.saldo_atual || 0) / saldoTotal) * 100).toFixed(1) : "0.0",
    }));

    return res.json({
      contas: contasComPercentual,
      saldo_consolidado: saldoTotal,
    });
  } catch (err) {
    console.error("Erro ao listar contas bancárias:", err);
    return res.status(500).json({ error: "Erro ao buscar contas bancárias" });
  }
};

// Obter extrato detalhado de uma conta específica
const extrato = async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.user.empresa_id;

    const [contaRows] = await db.query(
      `SELECT * FROM contas_bancarias WHERE id = ? AND empresa_id = ?`,
      [id, empresaId]
    );

    if (!contaRows.length) {
      return res.status(404).json({ error: "Conta não encontrada" });
    }

    const conta = contaRows[0];

    // Buscar movimentações liquidadas
    const [movimentacoes] = await db.query(
      `SELECT 
        t.id, t.tipo, t.descricao, t.valor_pago as valor, t.data_pagamento, t.forma_pagamento,
        cat.nome as categoria_nome, cat.cor as categoria_cor,
        c.nome as contato_nome
       FROM transacoes_financeiras t
       LEFT JOIN categorias_financeiras cat ON cat.id = t.categoria_id
       LEFT JOIN contatos c ON c.id = t.contato_id
       WHERE t.conta_bancaria_id = ? AND t.empresa_id = ? AND t.status = 'pago'
       ORDER BY t.data_pagamento DESC, t.id DESC
       LIMIT 100`,
      [id, empresaId]
    );

    return res.json({
      conta,
      movimentacoes,
    });
  } catch (err) {
    console.error("Erro ao carregar extrato:", err);
    return res.status(500).json({ error: "Erro ao buscar extrato bancário" });
  }
};

// Listar histórico de transferências entre contas
const listarTransferencias = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;

    const [transferencias] = await db.query(
      `SELECT 
        tc.*,
        co.nome as conta_origem_nome, co.cor as conta_origem_cor,
        cd.nome as conta_destino_nome, cd.cor as conta_destino_cor
       FROM transferencias_contas tc
       JOIN contas_bancarias co ON co.id = tc.conta_origem_id
       JOIN contas_bancarias cd ON cd.id = tc.conta_destino_id
       WHERE tc.empresa_id = ?
       ORDER BY tc.data_transferencia DESC, tc.id DESC
       LIMIT 50`,
      [empresaId]
    );

    return res.json(transferencias);
  } catch (err) {
    console.error("Erro ao listar transferências:", err);
    return res.status(500).json({ error: "Erro ao buscar transferências" });
  }
};

// Ajuste rápido de saldo (Sangria / Aporte / Reconciliação)
const ajustarSaldo = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const empresaId = req.user.empresa_id;
    const userId = req.user.id;
    const { novo_saldo, motivo } = req.body;

    if (novo_saldo === undefined) {
      await connection.rollback();
      return res.status(400).json({ error: "Novo saldo é obrigatório." });
    }

    const [rows] = await connection.query(
      `SELECT * FROM contas_bancarias WHERE id = ? AND empresa_id = ? FOR UPDATE`,
      [id, empresaId]
    );

    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Conta não encontrada" });
    }

    const conta = rows[0];
    const saldoAntigo = parseFloat(conta.saldo_atual);
    const saldoNovoFloat = parseFloat(novo_saldo);
    const diferenca = saldoNovoFloat - saldoAntigo;

    if (diferenca !== 0) {
      const tipoTransacao = diferenca > 0 ? "receita" : "despesa";
      const valorAbsoluto = Math.abs(diferenca);
      const hoje = new Date().toISOString().split("T")[0];

      // Criar transação de ajuste
      await connection.query(
        `INSERT INTO transacoes_financeiras 
         (empresa_id, conta_bancaria_id, tipo, descricao, valor, valor_pago, data_competencia, data_vencimento, data_pagamento, status, forma_pagamento, observacoes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pago', 'outro', ?, ?)`,
        [
          empresaId,
          id,
          tipoTransacao,
          `Ajuste de Saldo / Reconciliação: ${motivo || "Conferência de Caixa"}`,
          valorAbsoluto,
          valorAbsoluto,
          hoje,
          hoje,
          hoje,
          `Saldo anterior: R$ ${saldoAntigo.toFixed(2)} -> Novo: R$ ${saldoNovoFloat.toFixed(2)}`,
          userId,
        ]
      );

      // Atualizar conta
      await connection.query(
        `UPDATE contas_bancarias SET saldo_atual = ? WHERE id = ? AND empresa_id = ?`,
        [saldoNovoFloat, id, empresaId]
      );
    }

    await connection.commit();
    return res.json({ message: "Saldo ajustado com sucesso!", novo_saldo: saldoNovoFloat });
  } catch (err) {
    await connection.rollback();
    console.error("Erro ao ajustar saldo:", err);
    return res.status(500).json({ error: "Erro ao processar ajuste de saldo" });
  } finally {
    connection.release();
  }
};

// Criar conta bancária
const criar = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const { nome, banco, tipo = 'corrente', agencia, conta, saldo_inicial = 0, cor = '#059669', filial_id } = req.body;

    if (!nome) {
      return res.status(400).json({ error: "Nome da conta é obrigatório" });
    }

    const inicial = parseFloat(saldo_inicial) || 0;

    const [result] = await db.query(
      `INSERT INTO contas_bancarias (empresa_id, filial_id, nome, banco, tipo, agencia, conta, saldo_inicial, saldo_atual, cor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [empresaId, filial_id || null, nome, banco || 'Carteira', tipo, agencia || null, conta || null, inicial, inicial, cor]
    );

    return res.status(201).json({
      message: "Conta bancária criada com sucesso!",
      id: result.insertId,
    });
  } catch (err) {
    console.error("Erro ao criar conta bancária:", err);
    return res.status(500).json({ error: "Erro ao salvar conta bancária" });
  }
};

// Atualizar conta
const atualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.user.empresa_id;
    const { nome, banco, tipo, agencia, conta, cor, filial_id } = req.body;

    const [result] = await db.query(
      `UPDATE contas_bancarias 
       SET nome = COALESCE(?, nome),
           banco = COALESCE(?, banco),
           tipo = COALESCE(?, tipo),
           agencia = ?,
           conta = ?,
           cor = COALESCE(?, cor),
           filial_id = ?
       WHERE id = ? AND empresa_id = ?`,
      [nome, banco, tipo, agencia || null, conta || null, cor, filial_id || null, id, empresaId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Conta bancária não encontrada" });
    }

    return res.json({ message: "Conta bancária atualizada com sucesso!" });
  } catch (err) {
    console.error("Erro ao atualizar conta bancária:", err);
    return res.status(500).json({ error: "Erro ao atualizar conta bancária" });
  }
};

// Desativar conta bancária
const deletar = async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.user.empresa_id;

    await db.query(`UPDATE contas_bancarias SET ativo = 0 WHERE id = ? AND empresa_id = ?`, [id, empresaId]);

    return res.json({ message: "Conta desativada com sucesso!" });
  } catch (err) {
    console.error("Erro ao desativar conta bancária:", err);
    return res.status(500).json({ error: "Erro ao desativar conta" });
  }
};

// Transferência entre contas
const transferir = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const empresaId = req.user.empresa_id;
    const userId = req.user.id;
    const { conta_origem_id, conta_destino_id, valor, data_transferencia, observacoes } = req.body;

    if (!conta_origem_id || !conta_destino_id || !valor || valor <= 0) {
      await connection.rollback();
      return res.status(400).json({ error: "Conta origem, destino e valor válido são obrigatórios." });
    }

    if (conta_origem_id === conta_destino_id) {
      await connection.rollback();
      return res.status(400).json({ error: "A conta de origem e destino devem ser diferentes." });
    }

    const valorFloat = parseFloat(valor);
    const dataTransf = data_transferencia || new Date().toISOString().split("T")[0];

    const [contas] = await connection.query(
      `SELECT id, nome FROM contas_bancarias WHERE id IN (?, ?) AND empresa_id = ?`,
      [conta_origem_id, conta_destino_id, empresaId]
    );

    if (contas.length < 2) {
      await connection.rollback();
      return res.status(404).json({ error: "Uma ou ambas as contas não foram encontradas." });
    }

    const cOrigem = contas.find(c => c.id == conta_origem_id);
    const cDestino = contas.find(c => c.id == conta_destino_id);

    const [tSaida] = await connection.query(
      `INSERT INTO transacoes_financeiras 
       (empresa_id, conta_bancaria_id, tipo, descricao, valor, valor_pago, data_competencia, data_vencimento, data_pagamento, status, forma_pagamento, observacoes, created_by)
       VALUES (?, ?, 'despesa', ?, ?, ?, ?, ?, ?, 'pago', 'transferencia', ?, ?)`,
      [
        empresaId,
        conta_origem_id,
        `Transferência enviada para: ${cDestino.nome}`,
        valorFloat,
        valorFloat,
        dataTransf,
        dataTransf,
        dataTransf,
        observacoes || null,
        userId,
      ]
    );

    const [tEntrada] = await connection.query(
      `INSERT INTO transacoes_financeiras 
       (empresa_id, conta_bancaria_id, tipo, descricao, valor, valor_pago, data_competencia, data_vencimento, data_pagamento, status, forma_pagamento, observacoes, created_by)
       VALUES (?, ?, 'receita', ?, ?, ?, ?, ?, ?, 'pago', 'transferencia', ?, ?)`,
      [
        empresaId,
        conta_destino_id,
        `Transferência recebida de: ${cOrigem.nome}`,
        valorFloat,
        valorFloat,
        dataTransf,
        dataTransf,
        dataTransf,
        observacoes || null,
        userId,
      ]
    );

    await connection.query(
      `INSERT INTO transferencias_contas 
       (empresa_id, conta_origem_id, conta_destino_id, transacao_saida_id, transacao_entrada_id, valor, data_transferencia, observacoes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId,
        conta_origem_id,
        conta_destino_id,
        tSaida.insertId,
        tEntrada.insertId,
        valorFloat,
        dataTransf,
        observacoes || null,
      ]
    );

    await connection.query(
      `UPDATE contas_bancarias SET saldo_atual = saldo_atual - ? WHERE id = ? AND empresa_id = ?`,
      [valorFloat, conta_origem_id, empresaId]
    );
    await connection.query(
      `UPDATE contas_bancarias SET saldo_atual = saldo_atual + ? WHERE id = ? AND empresa_id = ?`,
      [valorFloat, conta_destino_id, empresaId]
    );

    await connection.commit();
    return res.json({ message: "Transferência realizada com sucesso!" });
  } catch (err) {
    await connection.rollback();
    console.error("Erro ao transferir valores:", err);
    return res.status(500).json({ error: "Erro ao processar transferência bancária." });
  } finally {
    connection.release();
  }
};

module.exports = {
  listar,
  extrato,
  listarTransferencias,
  ajustarSaldo,
  criar,
  atualizar,
  deletar,
  transferir,
};
