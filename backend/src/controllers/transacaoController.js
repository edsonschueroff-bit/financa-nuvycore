const db = require("../../db");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");
const { gerarPayloadPix } = require("../utils/pixHelper");
const { registrarAuditoria } = require("../utils/auditLogger");

// Listar transações com filtros avançados
const listar = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const {
      tipo,
      status,
      aba, // vencidas | hoje | semana | mes | recebidas
      data_inicio,
      data_fim,
      conta_bancaria_id,
      categoria_id,
      contato_id,
      search,
      page = 1,
      limit = 100,
    } = req.query;

    let whereClause = "WHERE t.empresa_id = ?";
    const params = [empresaId];

    if (tipo && ['receita', 'despesa', 'transferencia'].includes(tipo)) {
      whereClause += " AND t.tipo = ?";
      params.push(tipo);
    }

    if (status) {
      whereClause += " AND t.status = ?";
      params.push(status);
    }

    // Filtros por Abas Inteligentes
    if (aba === "vencidas") {
      whereClause += " AND t.status = 'pendente' AND t.data_vencimento < CURDATE()";
    } else if (aba === "hoje") {
      whereClause += " AND t.data_vencimento = CURDATE()";
    } else if (aba === "semana") {
      whereClause += " AND t.data_vencimento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)";
    } else if (aba === "recebidas" || aba === "pagas") {
      whereClause += " AND t.status = 'pago'";
    }

    if (data_inicio) {
      whereClause += " AND t.data_vencimento >= ?";
      params.push(data_inicio);
    }

    if (data_fim) {
      whereClause += " AND t.data_vencimento <= ?";
      params.push(data_fim);
    }

    if (conta_bancaria_id) {
      whereClause += " AND t.conta_bancaria_id = ?";
      params.push(conta_bancaria_id);
    }

    if (categoria_id) {
      whereClause += " AND t.categoria_id = ?";
      params.push(categoria_id);
    }

    if (contato_id) {
      whereClause += " AND t.contato_id = ?";
      params.push(contato_id);
    }

    if (search) {
      whereClause += " AND (t.descricao LIKE ? OR c.nome LIKE ? OR c.cpf_cnpj LIKE ?)";
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const offset = (Number(page) - 1) * Number(limit);

    const [countResult] = await db.query(
      `SELECT COUNT(*) as total 
       FROM transacoes_financeiras t
       LEFT JOIN contatos c ON c.id = t.contato_id
       ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    const [transacoes] = await db.query(
      `SELECT 
        t.*,
        DATEDIFF(CURDATE(), t.data_vencimento) as dias_atraso,
        cb.nome as conta_nome,
        cb.banco as conta_banco,
        cb.cor as conta_cor,
        cat.nome as categoria_nome,
        cat.cor as categoria_cor,
        cat.dre_grupo as categoria_dre_grupo,
        cat.icone as categoria_icone,
        c.nome as contato_nome,
        c.cpf_cnpj as contato_cpf_cnpj,
        c.telefone as contato_telefone,
        c.email as contato_email,
        c.tipo as contato_tipo,
        cc.nome as centro_custo_nome
       FROM transacoes_financeiras t
       LEFT JOIN contas_bancarias cb ON cb.id = t.conta_bancaria_id
       LEFT JOIN categorias_financeiras cat ON cat.id = t.categoria_id
       LEFT JOIN contatos c ON c.id = t.contato_id
       LEFT JOIN centros_custo cc ON cc.id = t.centro_custo_id
       ${whereClause}
       ORDER BY t.data_vencimento ASC, t.id DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    // Carregar rateios vinculados se houver transações
    if (transacoes.length > 0) {
      const ids = transacoes.map((t) => t.id);
      const [rateiosRows] = await db.query(
        `SELECT tr.id, tr.transacao_id, tr.centro_custo_id, tr.percentual, tr.valor, tr.observacao,
                cc.nome as centro_custo_nome, cc.cor as centro_custo_cor, cc.codigo as centro_custo_codigo
         FROM transacao_rateios tr
         JOIN centros_custo cc ON cc.id = tr.centro_custo_id
         WHERE tr.transacao_id IN (?) AND tr.empresa_id = ?`,
        [ids, empresaId]
      );

      const mapRateios = {};
      rateiosRows.forEach((r) => {
        if (!mapRateios[r.transacao_id]) mapRateios[r.transacao_id] = [];
        mapRateios[r.transacao_id].push(r);
      });

      transacoes.forEach((t) => {
        t.rateios = mapRateios[t.id] || [];
      });
    }

    return res.json({
      data: transacoes,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    console.error("Erro ao listar transações:", err);
    return res.status(500).json({ error: "Erro ao buscar transações financeiras" });
  }
};

// Obter transação individual
const obterPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.user.empresa_id;

    const [rows] = await db.query(
      `SELECT 
        t.*,
        cb.nome as conta_nome,
        cat.nome as categoria_nome,
        c.nome as contato_nome,
        c.telefone as contato_telefone,
        c.email as contato_email,
        cc.nome as centro_custo_nome
       FROM transacoes_financeiras t
       LEFT JOIN contas_bancarias cb ON cb.id = t.conta_bancaria_id
       LEFT JOIN categorias_financeiras cat ON cat.id = t.categoria_id
       LEFT JOIN contatos c ON c.id = t.contato_id
       LEFT JOIN centros_custo cc ON cc.id = t.centro_custo_id
       WHERE t.id = ? AND t.empresa_id = ?`,
      [id, empresaId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Transação não encontrada" });
    }

    const transacao = rows[0];

    // Carregar rateios da transação
    const [rateios] = await db.query(
      `SELECT tr.id, tr.centro_custo_id, tr.percentual, tr.valor, tr.observacao,
              cc.nome as centro_custo_nome, cc.cor as centro_custo_cor, cc.codigo as centro_custo_codigo
       FROM transacao_rateios tr
       JOIN centros_custo cc ON cc.id = tr.centro_custo_id
       WHERE tr.transacao_id = ? AND tr.empresa_id = ?`,
      [id, empresaId]
    );
    transacao.rateios = rateios;

    return res.json(transacao);
  } catch (err) {
    console.error("Erro ao obter transação:", err);
    return res.status(500).json({ error: "Erro ao buscar detalhes da transação" });
  }
};

// Criar transação (suporta lançamentos únicos, recorrentes ou parcelados)
const criar = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const empresaId = req.user.empresa_id;
    const userId = req.user.id;
    const {
      tipo,
      descricao,
      valor,
      data_competencia,
      data_vencimento,
      data_pagamento,
      status = 'pendente',
      forma_pagamento = 'pix',
      conta_bancaria_id,
      categoria_id,
      centro_custo_id,
      contato_id,
      documento_numero,
      observacoes,
      comprovante_url,
      total_parcelas = 1,
      tipo_parcelamento = 'dividir', // 'dividir' (total dividido) ou 'fixo' (valor fixo por parcela)
      recorrente = false,
      frequencia = 'mensal',
    } = req.body;

    if (!tipo || !descricao || !valor || !data_vencimento) {
      await connection.rollback();
      return res.status(400).json({ error: "Tipo, descrição, valor e data de vencimento são obrigatórios." });
    }

    const parcelasCount = Math.max(1, parseInt(total_parcelas, 10) || 1);
    const grupoParcelasId = parcelasCount > 1 ? uuidv4() : null;
    const valorFloat = parseFloat(valor);
    const valorParcela = (tipo_parcelamento === 'fixo' || tipo_parcelamento === 'recorrente')
      ? valorFloat
      : parseFloat((valorFloat / parcelasCount).toFixed(2));
    const createdIds = [];

    const baseVencimento = new Date(data_vencimento);

    for (let i = 1; i <= parcelasCount; i++) {
      let vencimentoParcela = new Date(baseVencimento);
      if (i > 1) {
        vencimentoParcela.setMonth(baseVencimento.getMonth() + (i - 1));
      }
      const vencimentoFormatado = vencimentoParcela.toISOString().split("T")[0];
      const descParcelada = parcelasCount > 1 ? `${descricao} (${i}/${parcelasCount})` : descricao;
      const statusFinal = (i === 1 && status === 'pago') ? 'pago' : 'pendente';
      const pagoValor = statusFinal === 'pago' ? valorParcela : 0.00;
      const dataPagto = statusFinal === 'pago' ? (data_pagamento || new Date().toISOString().split("T")[0]) : null;

      const [result] = await connection.query(
        `INSERT INTO transacoes_financeiras 
         (empresa_id, conta_bancaria_id, categoria_id, centro_custo_id, contato_id, tipo, descricao, valor, valor_pago, data_competencia, data_vencimento, data_pagamento, status, forma_pagamento, recorrente, frequencia, numero_parcela, total_parcelas, grupo_parcelas_id, documento_numero, comprovante_url, observacoes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          empresaId,
          conta_bancaria_id || null,
          categoria_id || null,
          centro_custo_id || null,
          contato_id || null,
          tipo,
          descParcelada,
          valorParcela,
          pagoValor,
          data_competencia || vencimentoFormatado,
          vencimentoFormatado,
          dataPagto,
          statusFinal,
          forma_pagamento,
          recorrente ? 1 : 0,
          recorrente ? frequencia : null,
          i,
          parcelasCount,
          grupoParcelasId,
          documento_numero || null,
          comprovante_url || null,
          observacoes || null,
          userId,
        ]
      );

      createdIds.push(result.insertId);

      // Persistir rateio por centro de custo se especificado
      if (Array.isArray(req.body.rateios) && req.body.rateios.length > 0) {
        for (const r of req.body.rateios) {
          if (!r.centro_custo_id || !r.percentual) continue;
          const pct = parseFloat(r.percentual);
          const valRateio = parseFloat(((valorParcela * pct) / 100).toFixed(2));
          await connection.query(
            `INSERT INTO transacao_rateios (empresa_id, transacao_id, centro_custo_id, percentual, valor, observacao)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [empresaId, result.insertId, r.centro_custo_id, pct, valRateio, r.observacao || null]
          );
        }
      }

      if (statusFinal === 'pago' && conta_bancaria_id) {
        const delta = tipo === 'receita' ? valorParcela : -valorParcela;
        await connection.query(
          `UPDATE contas_bancarias SET saldo_atual = saldo_atual + ? WHERE id = ? AND empresa_id = ?`,
          [delta, conta_bancaria_id, empresaId]
        );
      }
    }

    await connection.commit();
    await registrarAuditoria({
      req,
      acao: "CRIAR",
      modulo: "TRANSACOES",
      registroId: createdIds[0],
      detalhes: { tipo, descricao, valor: valorFloat, parcelas: parcelasCount },
    });

    return res.status(201).json({
      message: `${parcelasCount} lançamento(s) criado(s) com sucesso!`,
      ids: createdIds,
    });
  } catch (err) {
    await connection.rollback();
    console.error("Erro ao criar transação:", err);
    return res.status(500).json({ error: "Erro ao registrar transação financeira." });
  } finally {
    connection.release();
  }
};

// Dar baixa (Liquidar) em um lançamento
const baixar = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const empresaId = req.user.empresa_id;
    const { conta_bancaria_id, data_pagamento, valor_pago, forma_pagamento } = req.body;

    const [rows] = await connection.query(
      `SELECT * FROM transacoes_financeiras WHERE id = ? AND empresa_id = ? FOR UPDATE`,
      [id, empresaId]
    );

    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Lançamento não encontrado" });
    }

    const t = rows[0];
    if (t.status === 'pago') {
      await connection.rollback();
      return res.status(400).json({ error: "Este lançamento já está liquidado/pago." });
    }

    const contaFinalId = conta_bancaria_id || t.conta_bancaria_id;
    const finalValorPago = valor_pago !== undefined ? parseFloat(valor_pago) : parseFloat(t.valor);
    const dataPagto = data_pagamento || new Date().toISOString().split("T")[0];

    await connection.query(
      `UPDATE transacoes_financeiras 
       SET status = 'pago', 
           valor_pago = ?, 
           data_pagamento = ?, 
           conta_bancaria_id = ?,
           forma_pagamento = COALESCE(?, forma_pagamento)
       WHERE id = ? AND empresa_id = ?`,
      [finalValorPago, dataPagto, contaFinalId || null, forma_pagamento || null, id, empresaId]
    );

    if (contaFinalId) {
      const delta = t.tipo === 'receita' ? finalValorPago : -finalValorPago;
      await connection.query(
        `UPDATE contas_bancarias SET saldo_atual = saldo_atual + ? WHERE id = ? AND empresa_id = ?`,
        [delta, contaFinalId, empresaId]
      );
    }

    await connection.commit();
    await registrarAuditoria({
      req,
      acao: "BAIXAR",
      modulo: "TRANSACOES",
      registroId: id,
      detalhes: { descricao: t.descricao, valor_pago: finalValorPago, tipo: t.tipo },
    });

    return res.json({ message: "Lançamento liquidado com sucesso!", valor_pago: finalValorPago });
  } catch (err) {
    await connection.rollback();
    console.error("Erro ao baixar transação:", err);
    return res.status(500).json({ error: "Erro ao liquidar lançamento." });
  } finally {
    connection.release();
  }
};

// Baixa em lote (Múltiplas transações de uma só vez)
const baixarEmLote = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const empresaId = req.user.empresa_id;
    const { ids, conta_bancaria_id, data_pagamento } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: "Nenhum lançamento selecionado para baixa." });
    }

    const dataPagto = data_pagamento || new Date().toISOString().split("T")[0];

    const [transacoes] = await connection.query(
      `SELECT * FROM transacoes_financeiras WHERE id IN (?) AND empresa_id = ? AND status = 'pendente' FOR UPDATE`,
      [ids, empresaId]
    );

    let totalBaixado = 0;

    for (const t of transacoes) {
      const cId = conta_bancaria_id || t.conta_bancaria_id;
      const v = parseFloat(t.valor);

      await connection.query(
        `UPDATE transacoes_financeiras 
         SET status = 'pago', valor_pago = ?, data_pagamento = ?, conta_bancaria_id = ?
         WHERE id = ? AND empresa_id = ?`,
        [v, dataPagto, cId || null, t.id, empresaId]
      );

      if (cId) {
        const delta = t.tipo === 'receita' ? v : -v;
        // SEGURANÇA: AND empresa_id = ? garante que nunca atualizamos conta de outro tenant
        await connection.query(
          `UPDATE contas_bancarias SET saldo_atual = saldo_atual + ? WHERE id = ? AND empresa_id = ?`,
          [delta, cId, empresaId]
        );
      }

      totalBaixado += v;
    }

    await connection.commit();
    return res.json({
      message: `${transacoes.length} lançamento(s) baixado(s) com sucesso!`,
      total_baixado: totalBaixado,
    });
  } catch (err) {
    await connection.rollback();
    console.error("Erro ao baixar em lote:", err);
    return res.status(500).json({ error: "Erro ao processar baixa em lote." });
  } finally {
    connection.release();
  }
};

// Gerar Cobrança PIX e Mensagem de WhatsApp
const gerarCobrancaPix = async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.user.empresa_id;

    const [rows] = await db.query(
      `SELECT t.*, c.nome as contato_nome, c.telefone as contato_telefone, c.cpf_cnpj as contato_cpf_cnpj, e.nome as empresa_nome
       FROM transacoes_financeiras t
       LEFT JOIN contatos c ON c.id = t.contato_id
       JOIN empresas e ON e.id = t.empresa_id
       WHERE t.id = ? AND t.empresa_id = ?`,
      [id, empresaId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Transação não encontrada" });
    }

    const t = rows[0];
    const valorFloat = parseFloat(t.valor);
    const vencimentoFormatado = new Date(t.data_vencimento).toLocaleDateString("pt-BR");

    // Gerar Payload PIX Copia-e-Cola
    const payloadPix = gerarPayloadPix({
      chave: "financeiro@nuvycore.online",
      nomeRecebedor: t.empresa_nome || "Nuvy Finance",
      cidade: "SAO PAULO",
      valor: valorFloat,
      txid: `FAT${t.id}`,
    });

    // Gerar Mensagem Pronta de WhatsApp
    const saudacao = `Olá ${t.contato_nome ? t.contato_nome : "Cliente"}, tudo bem?`;
    const msgWhatsApp = `${saudacao}\n\nSegue o lembrete da sua fatura:\n📄 *${t.descricao}*\n💰 *Valor:* R$ ${valorFloat.toFixed(2).replace(".", ",")}\n📅 *Vencimento:* ${vencimentoFormatado}\n\nPara pagar via PIX, copie o código abaixo:\n\`\`\`${payloadPix}\`\`\`\n\nQualquer dúvida, estamos à disposição!`;

    const telefoneLimpo = t.contato_telefone ? t.contato_telefone.replace(/\D/g, "") : "";
    const linkWhatsApp = telefoneLimpo
      ? `https://wa.me/55${telefoneLimpo}?text=${encodeURIComponent(msgWhatsApp)}`
      : null;

    return res.json({
      transacao: t,
      payload_pix: payloadPix,
      mensagem_whatsapp: msgWhatsApp,
      link_whatsapp: linkWhatsApp,
    });
  } catch (err) {
    console.error("Erro ao gerar cobrança PIX:", err);
    return res.status(500).json({ error: "Erro ao gerar cobrança PIX" });
  }
};

// Estornar / Reabrir um lançamento pago
const estornar = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const empresaId = req.user.empresa_id;

    const [rows] = await connection.query(
      `SELECT * FROM transacoes_financeiras WHERE id = ? AND empresa_id = ? FOR UPDATE`,
      [id, empresaId]
    );

    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Lançamento não encontrado" });
    }

    const t = rows[0];
    if (t.status !== 'pago') {
      await connection.rollback();
      return res.status(400).json({ error: "Apenas lançamentos pagos podem ser estornados." });
    }

    if (t.conta_bancaria_id && t.valor_pago > 0) {
      const deltaReverso = t.tipo === 'receita' ? -t.valor_pago : t.valor_pago;
      await connection.query(
        `UPDATE contas_bancarias SET saldo_atual = saldo_atual + ? WHERE id = ? AND empresa_id = ?`,
        [deltaReverso, t.conta_bancaria_id, empresaId]
      );
    }

    await connection.query(
      `UPDATE transacoes_financeiras 
       SET status = 'pendente', valor_pago = 0.00, data_pagamento = NULL 
       WHERE id = ? AND empresa_id = ?`,
      [id, empresaId]
    );

    await connection.commit();
    await registrarAuditoria({
      req,
      acao: "ESTORNAR",
      modulo: "TRANSACOES",
      registroId: id,
      detalhes: { descricao: t.descricao, valor: t.valor_pago || t.valor, tipo: t.tipo },
    });

    return res.json({ message: "Lançamento estornado e reaberto com sucesso!" });
  } catch (err) {
    await connection.rollback();
    console.error("Erro ao estornar transação:", err);
    return res.status(500).json({ error: "Erro ao estornar lançamento." });
  } finally {
    connection.release();
  }
};

// Atualizar lançamento
const atualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.user.empresa_id;
    const {
      descricao,
      valor,
      data_competencia,
      data_vencimento,
      conta_bancaria_id,
      categoria_id,
      centro_custo_id,
      contato_id,
      forma_pagamento,
      documento_numero,
      observacoes,
      comprovante_url,
    } = req.body;

    const [result] = await db.query(
      `UPDATE transacoes_financeiras 
       SET descricao = COALESCE(?, descricao),
           valor = COALESCE(?, valor),
           data_competencia = COALESCE(?, data_competencia),
           data_vencimento = COALESCE(?, data_vencimento),
           conta_bancaria_id = ?,
           categoria_id = ?,
           centro_custo_id = ?,
           contato_id = ?,
           forma_pagamento = COALESCE(?, forma_pagamento),
           documento_numero = ?,
           observacoes = ?,
           comprovante_url = COALESCE(?, comprovante_url)
       WHERE id = ? AND empresa_id = ?`,
      [
        descricao,
        valor,
        data_competencia,
        data_vencimento,
        conta_bancaria_id || null,
        categoria_id || null,
        centro_custo_id || null,
        contato_id || null,
        forma_pagamento,
        documento_numero || null,
        observacoes || null,
        comprovante_url !== undefined ? comprovante_url : null,
        id,
        empresaId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Lançamento não encontrado" });
    }

    // Se rateios foram informados, atualizar tabela transacao_rateios
    if (req.body.rateios !== undefined) {
      await db.query(`DELETE FROM transacao_rateios WHERE transacao_id = ? AND empresa_id = ?`, [id, empresaId]);
      if (Array.isArray(req.body.rateios) && req.body.rateios.length > 0) {
        const [[tx]] = await db.query(`SELECT valor FROM transacoes_financeiras WHERE id = ? AND empresa_id = ?`, [id, empresaId]);
        const txValor = valor !== undefined ? parseFloat(valor) : parseFloat(tx?.valor || 0);

        for (const r of req.body.rateios) {
          if (!r.centro_custo_id || !r.percentual) continue;
          const pct = parseFloat(r.percentual);
          const valRateio = parseFloat(((txValor * pct) / 100).toFixed(2));
          await db.query(
            `INSERT INTO transacao_rateios (empresa_id, transacao_id, centro_custo_id, percentual, valor, observacao)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [empresaId, id, r.centro_custo_id, pct, valRateio, r.observacao || null]
          );
        }
      }
    }

    await registrarAuditoria({
      req,
      acao: "EDITAR",
      modulo: "TRANSACOES",
      registroId: id,
      detalhes: { descricao, valor },
    });

    return res.json({ message: "Lançamento atualizado com sucesso!" });
  } catch (err) {
    console.error("Erro ao atualizar transação:", err);
    return res.status(500).json({ error: "Erro ao atualizar dados do lançamento." });
  }
};

// Upload de Comprovante Avulso ou Vinculado
const uploadComprovante = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }
    const url = `/uploads/comprovantes/${req.file.filename}`;
    const { transacao_id } = req.body;
    const empresaId = req.user.empresa_id;

    if (transacao_id) {
      await db.query(
        "UPDATE transacoes_financeiras SET comprovante_url = ? WHERE id = ? AND empresa_id = ?",
        [url, transacao_id, empresaId]
      );
    }

    await registrarAuditoria({
      req,
      acao: "UPLOAD_ANEXO",
      modulo: "TRANSACOES",
      registroId: transacao_id || null,
      detalhes: { filename: req.file.filename, tamanho: req.file.size },
    });

    return res.json({
      sucesso: true,
      url,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (err) {
    console.error("Erro no upload de comprovante:", err);
    return res.status(500).json({ error: "Falha ao processar upload de comprovante." });
  }
};

// Remover Comprovante
const removerComprovante = async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.user.empresa_id;

    const [[transacao]] = await db.query(
      "SELECT comprovante_url FROM transacoes_financeiras WHERE id = ? AND empresa_id = ?",
      [id, empresaId]
    );

    if (!transacao) {
      return res.status(404).json({ error: "Lançamento não encontrado." });
    }

    if (transacao.comprovante_url) {
      const relativePath = transacao.comprovante_url.replace(/^\//, "");
      const filePath = path.resolve(__dirname, "../../", relativePath);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.warn("Aviso ao deletar arquivo físico do comprovante:", e.message);
        }
      }
    }

    await db.query(
      "UPDATE transacoes_financeiras SET comprovante_url = NULL WHERE id = ? AND empresa_id = ?",
      [id, empresaId]
    );

    await registrarAuditoria({
      req,
      acao: "EXCLUIR_ANEXO",
      modulo: "TRANSACOES",
      registroId: id,
    });

    return res.json({ sucesso: true, message: "Comprovante removido com sucesso!" });
  } catch (err) {
    console.error("Erro ao remover comprovante:", err);
    return res.status(500).json({ error: "Erro ao remover comprovante." });
  }
};

// Deletar lançamento
const deletar = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const empresaId = req.user.empresa_id;

    const [rows] = await connection.query(
      `SELECT * FROM transacoes_financeiras WHERE id = ? AND empresa_id = ? FOR UPDATE`,
      [id, empresaId]
    );

    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Lançamento não encontrado" });
    }

    const t = rows[0];

    if (t.status === 'pago' && t.conta_bancaria_id && t.valor_pago > 0) {
      const deltaReverso = t.tipo === 'receita' ? -t.valor_pago : t.valor_pago;
      await connection.query(
        `UPDATE contas_bancarias SET saldo_atual = saldo_atual + ? WHERE id = ? AND empresa_id = ?`,
        [deltaReverso, t.conta_bancaria_id, empresaId]
      );
    }

    await connection.query(`DELETE FROM transacoes_financeiras WHERE id = ? AND empresa_id = ?`, [id, empresaId]);

    await connection.commit();
    await registrarAuditoria({
      req,
      acao: "EXCLUIR",
      modulo: "TRANSACOES",
      registroId: id,
      detalhes: { descricao: t.descricao, valor: t.valor, tipo: t.tipo },
    });

    return res.json({ message: "Lançamento excluído com sucesso!" });
  } catch (err) {
    await connection.rollback();
    console.error("Erro ao deletar transação:", err);
    return res.status(500).json({ error: "Erro ao excluir lançamento." });
  } finally {
    connection.release();
  }
};

const deletarLote = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { ids } = req.body;
    const empresaId = req.user.empresa_id;

    if (!Array.isArray(ids) || ids.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: "Nenhum item selecionado para exclusão." });
    }

    const [rows] = await connection.query(
      `SELECT * FROM transacoes_financeiras WHERE id IN (?) AND empresa_id = ? FOR UPDATE`,
      [ids, empresaId]
    );

    for (const t of rows) {
      if (t.status === 'pago' && t.conta_bancaria_id && t.valor_pago > 0) {
        const deltaReverso = t.tipo === 'receita' ? -t.valor_pago : t.valor_pago;
        // SEGURANÇA: AND empresa_id = ? garante isolamento cross-tenant no estorno de lote
        await connection.query(
          `UPDATE contas_bancarias SET saldo_atual = saldo_atual + ? WHERE id = ? AND empresa_id = ?`,
          [deltaReverso, t.conta_bancaria_id, empresaId]
        );
      }
    }

    await connection.query(
      `DELETE FROM transacoes_financeiras WHERE id IN (?) AND empresa_id = ?`,
      [ids, empresaId]
    );

    await connection.commit();
    return res.json({ message: `${rows.length} lançamento(s) excluído(s) com sucesso!`, total: rows.length });
  } catch (err) {
    await connection.rollback();
    console.error("Erro ao deletar transações em lote:", err);
    return res.status(500).json({ error: "Erro ao excluir lançamentos em lote." });
  } finally {
    connection.release();
  }
};

module.exports = {
  listar,
  obterPorId,
  criar,
  baixar,
  baixarEmLote,
  estornar,
  gerarCobrancaPix,
  atualizar,
  uploadComprovante,
  removerComprovante,
  deletar,
  deletarLote,
};
