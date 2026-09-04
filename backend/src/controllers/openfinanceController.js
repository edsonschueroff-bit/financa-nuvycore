const db = require("../../db");

// Listar conexões Open Finance da empresa
const listarConexoes = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;

    const [conexoes] = await db.query(
      `SELECT oc.*, cb.nome as conta_nome, cb.saldo_atual as conta_saldo,
        (SELECT COUNT(*) FROM openfinance_transacoes WHERE conexao_id = oc.id AND status_conciliacao = 'pendente') as transacoes_pendentes_count,
        (SELECT COUNT(*) FROM openfinance_transacoes WHERE conexao_id = oc.id) as total_transacoes_importadas
       FROM openfinance_conexoes oc
       LEFT JOIN contas_bancarias cb ON cb.id = oc.conta_bancaria_id
       WHERE oc.empresa_id = ?
       ORDER BY oc.id DESC`,
      [empresaId]
    );

    return res.json(conexoes);
  } catch (err) {
    console.error("Erro ao listar conexões Open Finance:", err);
    return res.status(500).json({ error: "Erro ao buscar conexões bancárias" });
  }
};

// Conectar novo banco (Geração de Connect Token ou Conexão Rápida)
const conectarBanco = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const { instituicao_nome, instituicao_cor = '#059669', conta_bancaria_id } = req.body;

    if (!instituicao_nome) {
      return res.status(400).json({ error: "Nome da instituição financeira é obrigatório." });
    }

    const itemId = `conn_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const [result] = await db.query(
      `INSERT INTO openfinance_conexoes 
       (empresa_id, conta_bancaria_id, provider, item_id, instituicao_nome, instituicao_cor, status_conexao, ultima_sincronizacao)
       VALUES (?, ?, 'pluggy', ?, ?, ?, 'conectado', NOW())`,
      [empresaId, conta_bancaria_id || null, itemId, instituicao_nome, instituicao_cor]
    );

    // Gerar primeiras transações de extrato de demonstração
    const hoje = new Date().toISOString().split("T")[0];
    await db.query(
      `INSERT INTO openfinance_transacoes 
       (empresa_id, conexao_id, conta_bancaria_id, transacao_provider_id, data_ocorrencia, descricao_banco, valor, tipo, status_conciliacao)
       VALUES 
       (?, ?, ?, 'tx_sync_01', ?, 'PIX RECEBIDO - FATURA CLIENTE', 1200.00, 'credito', 'pendente'),
       (?, ?, ?, 'tx_sync_02', ?, 'PAGAMENTO BOLETO FORNECEDOR', 450.00, 'debito', 'pendente')`,
      [
        empresaId, result.insertId, conta_bancaria_id || null, hoje,
        empresaId, result.insertId, conta_bancaria_id || null, hoje,
      ]
    );

    return res.status(201).json({
      message: `Conexão Open Finance com ${instituicao_nome} estabelecida com sucesso!`,
      conexao_id: result.insertId,
    });
  } catch (err) {
    console.error("Erro ao conectar Open Finance:", err);
    return res.status(500).json({ error: "Erro ao estabelecer conexão bancária" });
  }
};

// Sincronizar agora uma conexão
const sincronizarConexao = async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.user.empresa_id;

    await db.query(
      `UPDATE openfinance_conexoes 
       SET ultima_sincronizacao = NOW(), status_conexao = 'conectado'
       WHERE id = ? AND empresa_id = ?`,
      [id, empresaId]
    );

    return res.json({ message: "Conexão bancária sincronizada com sucesso!" });
  } catch (err) {
    console.error("Erro ao sincronizar conexão:", err);
    return res.status(500).json({ error: "Erro ao sincronizar extrato bancário" });
  }
};

// Desconectar banco
const desconectarBanco = async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.user.empresa_id;

    await db.query(
      `UPDATE openfinance_conexoes SET status_conexao = 'desconectado' WHERE id = ? AND empresa_id = ?`,
      [id, empresaId]
    );

    return res.json({ message: "Conexão bancária desconectada com sucesso!" });
  } catch (err) {
    console.error("Erro ao desconectar banco:", err);
    return res.status(500).json({ error: "Erro ao desconectar instituição bancária" });
  }
};

// Importar extrato OFX / CSV manual
const importarExtrato = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const { conta_bancaria_id, transacoes } = req.body;

    if (!Array.isArray(transacoes) || transacoes.length === 0) {
      return res.status(400).json({ error: "Nenhuma linha de extrato fornecida para importação." });
    }

    let inseridas = 0;
    let duplicadasIgnoradas = 0;

    for (const t of transacoes) {
      const v = Math.abs(parseFloat(t.valor));
      const tipo = t.tipo || (parseFloat(t.valor) >= 0 ? "credito" : "debito");
      const dataOcorr = t.data_ocorrencia || t.data || new Date().toISOString().split("T")[0];
      const descBanco = (t.descricao_banco || t.descricao || "Lançamento de Extrato").trim();

      // Blindagem Nível 1: Verificar se essa exata movimentação já foi importada anteriormente para esta conta
      const [existeExtrato] = await db.query(
        `SELECT id FROM openfinance_transacoes 
         WHERE empresa_id = ? 
           AND (conta_bancaria_id = ? OR (conta_bancaria_id IS NULL AND ? IS NULL))
           AND data_ocorrencia = ? 
           AND valor = ? 
           AND tipo = ? 
           AND descricao_banco = ?
         LIMIT 1`,
        [empresaId, conta_bancaria_id || null, conta_bancaria_id || null, dataOcorr, v, tipo, descBanco]
      );

      if (existeExtrato.length > 0) {
        duplicadasIgnoradas++;
        continue;
      }

      await db.query(
        `INSERT INTO openfinance_transacoes 
         (empresa_id, conta_bancaria_id, data_ocorrencia, descricao_banco, valor, tipo, status_conciliacao)
         VALUES (?, ?, ?, ?, ?, ?, 'pendente')`,
        [empresaId, conta_bancaria_id || null, dataOcorr, descBanco, v, tipo]
      );
      inseridas++;
    }

    let mensagem = `${inseridas} movimentação(ões) nova(s) importada(s) para conciliação!`;
    if (duplicadasIgnoradas > 0) {
      mensagem += ` (${duplicadasIgnoradas} já existiam no extrato e foram ignoradas automaticamente para evitar duplicidade).`;
    }

    return res.json({ 
      message: mensagem,
      inseridas,
      duplicadas_ignoradas: duplicadasIgnoradas 
    });
  } catch (err) {
    console.error("Erro ao importar extrato:", err);
    return res.status(500).json({ error: "Erro ao processar importação de extrato" });
  }
};

// Webhook Open Finance (Pluggy / Belvo Receiver)
const webhookOpenFinance = async (req, res) => {
  try {
    const event = req.body;
    console.log("[Webhook Open Finance Recebido]:", event.event || "TRANSACTIONS_UPDATED");

    // Retornar 200 OK para o agregador
    return res.status(200).json({ status: "received" });
  } catch (err) {
    console.error("Erro no webhook Open Finance:", err);
    return res.status(500).json({ error: "Erro ao processar webhook" });
  }
};

module.exports = {
  listarConexoes,
  conectarBanco,
  sincronizarConexao,
  desconectarBanco,
  importarExtrato,
  webhookOpenFinance,
};
