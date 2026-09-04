const db = require("../../db");
const {
  testarAsaas,
  testarMercadoPago,
  gerarCobrancaAsaas,
  gerarCobrancaMercadoPago,
} = require("../utils/gatewayHelper");
const { registrarAuditoria } = require("../utils/auditLogger");

/**
 * Listar configurações de gateway da empresa
 */
async function listar(req, res) {
  try {
    const empresaId = req.user.empresa_id;

    const [rows] = await db.query(
      `SELECT id, empresa_id, provedor, ambiente, api_key, webhook_token,
              ativo, habilitar_pix, habilitar_boleto, habilitar_cartao,
              juros_mensal, multa_atraso, dias_vencimento_padrao, atualizado_em
       FROM gateways_pagamento_tenant
       WHERE empresa_id = ?`,
      [empresaId]
    );

    // Mascarar chaves de API para segurança
    const sanitized = rows.map((g) => {
      const rawKey = g.api_key || "";
      const masked = rawKey.length > 8
        ? `${rawKey.slice(0, 4)}••••••••${rawKey.slice(-4)}`
        : "••••••••";
      return {
        ...g,
        api_key_mascarada: masked,
      };
    });

    return res.json({ gateways: sanitized });
  } catch (err) {
    console.error("Erro ao listar gateways da empresa:", err);
    return res.status(500).json({ error: "Erro ao carregar configurações de gateway" });
  }
}

/**
 * Salvar ou atualizar gateway da empresa
 */
async function salvar(req, res) {
  try {
    const empresaId = req.user.empresa_id;
    const {
      provedor, // 'asaas' | 'mercadopago'
      ambiente = 'sandbox',
      api_key,
      webhook_token,
      ativo = 1,
      habilitar_pix = 1,
      habilitar_boleto = 1,
      habilitar_cartao = 0,
      juros_mensal = 0,
      multa_atraso = 0,
      dias_vencimento_padrao = 3,
    } = req.body;

    if (!provedor) {
      return res.status(400).json({ error: "Provedor é obrigatório (asaas ou mercadopago)." });
    }

    // Verificar se já existe
    const [existente] = await db.query(
      "SELECT id, api_key FROM gateways_pagamento_tenant WHERE empresa_id = ? AND provedor = ?",
      [empresaId, provedor]
    );

    // Se api_key vier mascarada ou vazia e já existir, manter a antiga
    let finalApiKey = api_key;
    if ((!api_key || api_key.includes("••••")) && existente.length > 0) {
      finalApiKey = existente[0].api_key;
    }

    if (!finalApiKey) {
      return res.status(400).json({ error: "Chave de API / Access Token é obrigatória." });
    }

    if (existente.length > 0) {
      await db.query(
        `UPDATE gateways_pagamento_tenant 
         SET ambiente = ?, api_key = ?, webhook_token = ?, ativo = ?,
             habilitar_pix = ?, habilitar_boleto = ?, habilitar_cartao = ?,
             juros_mensal = ?, multa_atraso = ?, dias_vencimento_padrao = ?
         WHERE id = ? AND empresa_id = ?`,
        [
          ambiente,
          finalApiKey,
          webhook_token || null,
          ativo ? 1 : 0,
          habilitar_pix ? 1 : 0,
          habilitar_boleto ? 1 : 0,
          habilitar_cartao ? 1 : 0,
          juros_mensal,
          multa_atraso,
          dias_vencimento_padrao,
          existente[0].id,
          empresaId,
        ]
      );
    } else {
      await db.query(
        `INSERT INTO gateways_pagamento_tenant 
         (empresa_id, provedor, ambiente, api_key, webhook_token, ativo,
          habilitar_pix, habilitar_boleto, habilitar_cartao, juros_mensal, multa_atraso, dias_vencimento_padrao)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          empresaId,
          provedor,
          ambiente,
          finalApiKey,
          webhook_token || null,
          ativo ? 1 : 0,
          habilitar_pix ? 1 : 0,
          habilitar_boleto ? 1 : 0,
          habilitar_cartao ? 1 : 0,
          juros_mensal,
          multa_atraso,
          dias_vencimento_padrao,
        ]
      );
    }

    await registrarAuditoria({
      req,
      acao: "EDITAR",
      modulo: "CONFIGURACOES",
      detalhes: { gateway: provedor, ambiente, ativo: Boolean(ativo) },
    });

    return res.json({ message: `Gateway ${provedor.toUpperCase()} salvo com sucesso!` });
  } catch (err) {
    console.error("Erro ao salvar gateway:", err);
    return res.status(500).json({ error: "Erro ao salvar configurações do gateway" });
  }
}

/**
 * Testar conexão com gateway em tempo real
 */
async function testar(req, res) {
  try {
    const empresaId = req.user.empresa_id;
    const { provedor, ambiente = "sandbox", api_key } = req.body;

    let finalKey = api_key;
    if (!finalKey || finalKey.includes("••••")) {
      const [rows] = await db.query(
        "SELECT api_key FROM gateways_pagamento_tenant WHERE empresa_id = ? AND provedor = ?",
        [empresaId, provedor]
      );
      if (rows.length > 0) finalKey = rows[0].api_key;
    }

    if (!finalKey) {
      return res.status(400).json({ error: "Chave de API não informada para teste." });
    }

    let resultado;
    if (provedor === "asaas") {
      resultado = await testarAsaas(finalKey, ambiente);
    } else if (provedor === "mercadopago") {
      resultado = await testarMercadoPago(finalKey);
    } else {
      return res.status(400).json({ error: "Provedor inválido" });
    }

    return res.json(resultado);
  } catch (err) {
    console.error("Erro no teste de gateway:", err);
    return res.status(500).json({ sucesso: false, erro: "Falha ao testar conexão com o gateway" });
  }
}

/**
 * Gerar cobrança oficial no gateway do tenant
 */
async function gerarCobranca(req, res) {
  try {
    const empresaId = req.user.empresa_id;
    const { transacao_id, provedor = "asaas", forma = "pix" } = req.body;

    // Buscar transação com dados do contato
    const [txRows] = await db.query(
      `SELECT t.*, c.nome as contato_nome, c.email as contato_email, c.telefone as contato_telefone,
              c.cpf_cnpj as contato_cpf_cnpj, c.cep as contato_cep, c.logradouro as contato_logradouro,
              c.numero as contato_numero, c.bairro as contato_bairro, c.complemento as contato_complemento
       FROM transacoes_financeiras t
       LEFT JOIN contatos c ON c.id = t.contato_id
       WHERE t.id = ? AND t.empresa_id = ?`,
      [transacao_id, empresaId]
    );

    if (txRows.length === 0) {
      return res.status(404).json({ error: "Lançamento não encontrado." });
    }
    const transacao = txRows[0];

    // Buscar configuração do gateway ativo
    const [gwRows] = await db.query(
      `SELECT * FROM gateways_pagamento_tenant WHERE empresa_id = ? AND provedor = ? AND ativo = 1`,
      [empresaId, provedor]
    );

    if (gwRows.length === 0) {
      return res.status(400).json({
        error: `O gateway ${provedor.toUpperCase()} não está ativo ou configurado para esta empresa.`,
      });
    }
    const config = gwRows[0];

    let resultadoCobranca;
    if (provedor === "asaas") {
      resultadoCobranca = await gerarCobrancaAsaas({
        config,
        transacao,
        contato: transacao,
        forma,
      });
    } else {
      resultadoCobranca = await gerarCobrancaMercadoPago({
        config,
        transacao,
        contato: transacao,
        forma,
      });
    }

    return res.json({
      sucesso: true,
      transacao_id: transacao.id,
      provedor,
      ...resultadoCobranca,
    });
  } catch (err) {
    console.error("Erro ao gerar cobrança no gateway:", err);
    return res.status(500).json({
      error: err.response?.data?.errors?.[0]?.description || err.response?.data?.message || err.message || "Erro ao emitir cobrança",
    });
  }
}

/**
 * Webhook público para baixa automática de pagamentos
 */
async function webhook(req, res) {
  try {
    const { empresaId, provedor } = req.params;

    console.log(`[GATEWAY_WEBHOOK] Recebido evento do provedor ${provedor} para empresa ${empresaId}:`, JSON.stringify(req.body).slice(0, 300));

    let transacaoId = null;
    let valorPago = null;
    let pagoConfirmado = false;

    if (provedor === "asaas") {
      const event = req.body?.event;
      const payment = req.body?.payment;

      if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
        pagoConfirmado = true;
        valorPago = parseFloat(payment?.value || payment?.netValue || 0);
        const ref = payment?.externalReference || "";
        if (ref.startsWith("TX_")) {
          transacaoId = parseInt(ref.replace("TX_", ""), 10);
        }
      }
    } else if (provedor === "mercadopago") {
      const action = req.body?.action;
      const data = req.body?.data;
      if (action === "payment.updated" || action === "payment.created") {
        // Se enviado via Mercado Pago
        const ref = req.body?.external_reference || "";
        if (ref.startsWith("TX_")) {
          transacaoId = parseInt(ref.replace("TX_", ""), 10);
          pagoConfirmado = true;
        }
      }
    }

    if (pagoConfirmado && transacaoId) {
      const [txRows] = await db.query(
        "SELECT * FROM transacoes_financeiras WHERE id = ? AND empresa_id = ? AND status = 'pendente'",
        [transacaoId, empresaId]
      );

      if (txRows.length > 0) {
        const tx = txRows[0];
        const finalVal = valorPago || parseFloat(tx.valor);
        const hoje = new Date().toISOString().split("T")[0];

        await db.query(
          `UPDATE transacoes_financeiras 
           SET status = 'pago', valor_pago = ?, data_pagamento = ?
           WHERE id = ? AND empresa_id = ?`,
          [finalVal, hoje, transacaoId, empresaId]
        );

        if (tx.conta_bancaria_id) {
          await db.query(
            `UPDATE contas_bancarias SET saldo_atual = saldo_atual + ? WHERE id = ? AND empresa_id = ?`,
            [finalVal, tx.conta_bancaria_id, empresaId]
          );
        }

        await registrarAuditoria({
          empresaId: parseInt(empresaId, 10),
          usuarioNome: `Gateway (${provedor.toUpperCase()})`,
          usuarioEmail: "webhook@gateway.com",
          acao: "BAIXAR",
          modulo: "TRANSACOES",
          registroId: transacaoId,
          detalhes: { origem: "WEBHOOK_AUTOMATICO", valor_pago: finalVal, provedor },
        });

        console.log(`[GATEWAY_WEBHOOK] Lançamento #${transacaoId} liquidado com sucesso via Webhook ${provedor}!`);
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("[GATEWAY_WEBHOOK] Erro ao processar webhook:", err);
    return res.status(200).send("ERROR_LOGGED");
  }
}

module.exports = {
  listar,
  salvar,
  testar,
  gerarCobranca,
  webhook,
};
