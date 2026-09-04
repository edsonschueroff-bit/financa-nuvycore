const db = require("../../db");
const mercadopagoService = require("../services/mercadopagoService");
const axios = require("axios");
const { enviarTextoWhatsApp } = require("./integracaoWhatsappController");

// Notificar cliente via WhatsApp quando a cobrança do cartão falhar ou vencer
const notificarFaturaVencidaWhatsapp = async (faturaId) => {
  try {
    const [faturas] = await db.query(
      `SELECT f.*, e.nome as empresa_nome, e.telefone as empresa_telefone, e.slug as empresa_slug
       FROM saas_faturas f
       JOIN empresas e ON e.id = f.empresa_id
       WHERE f.id = ?`,
      [faturaId]
    );

    if (!faturas.length) return;
    const f = faturas[0];

    let telefoneDestino = f.empresa_telefone;
    if (!telefoneDestino) {
      const [admins] = await db.query(
        `SELECT telefone FROM admins WHERE empresa_id = ? AND telefone IS NOT NULL ORDER BY id ASC LIMIT 1`,
        [f.empresa_id]
      );
      if (admins.length) telefoneDestino = admins[0].telefone;
    }

    if (!telefoneDestino) {
      console.warn(`[WhatsApp Cobrança]: Empresa #${f.empresa_id} não possui telefone cadastrado.`);
      return;
    }

    const valorFormatado = Number(f.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const cicloTexto = f.ciclo === "anual" ? "Anual" : "Mensal";

    let texto = `*Aviso de Renovação - Nuvy Finance* ⚠️\n\n`;
    texto += `Olá, *${f.empresa_nome}*!\n\n`;
    texto += `Não conseguimos processar o débito da sua assinatura (*Plano ${cicloTexto}* - ${valorFormatado}) no cartão cadastrado.\n\n`;
    texto += `Para que seu sistema continue operando normalmente sem bloqueios, você pode quitar em instantes via *Pix*:\n\n`;

    if (f.pix_copia_cola) {
      texto += `🔑 *Pix Copia e Cola:*\n\`\`\`${f.pix_copia_cola}\`\`\`\n\n`;
    }

    if (f.link_fatura) {
      texto += `🔗 *Pagar Online (Boleto / Cartão):*\n${f.link_fatura}\n\n`;
    }

    texto += `Assim que o pagamento for concluído, seu acesso é revalidado automaticamente em poucos segundos! 🚀`;

    if (typeof enviarTextoWhatsApp === "function") {
      await enviarTextoWhatsApp(telefoneDestino, texto);
      console.log(`[WhatsApp Cobrança]: Mensagem de contingência enviada para ${telefoneDestino} da empresa ${f.empresa_nome}.`);
    }
  } catch (err) {
    console.error("[WhatsApp Cobrança]: Erro ao enviar notificação de contingência:", err.message);
  }
};

// Listar todas as faturas SaaS (Super Admin) ou da empresa atual (Tenant)
const listar = async (req, res) => {
  try {
    const isSuper = req.user.is_super;
    const empresaId = req.user.empresa_id;

    let query = `
      SELECT f.*, e.nome as empresa_nome, e.slug as empresa_slug, e.email as empresa_email, e.telefone as empresa_telefone, p.nome as plano_nome
      FROM saas_faturas f
      JOIN empresas e ON e.id = f.empresa_id
      LEFT JOIN saas_planos p ON p.id = f.plano_id
    `;
    const params = [];

    if (!isSuper || req.query.minhas === "true") {
      query += ` WHERE f.empresa_id = ?`;
      params.push(empresaId);
    }

    query += ` ORDER BY f.data_vencimento DESC, f.id DESC`;

    const [faturas] = await db.query(query, params);
    return res.json(faturas);
  } catch (err) {
    console.error("Erro ao listar faturas SaaS:", err);
    return res.status(500).json({ error: "Erro ao buscar faturas SaaS" });
  }
};

// Gerar Pix Mercado Pago para uma Fatura
// Gerar Pix / Cobrança para uma Fatura SaaS
const gerarPix = async (req, res) => {
  try {
    const { id } = req.params;
    const isSuper = req.user.is_super;
    const empresaId = req.user.empresa_id;

    const [faturas] = await db.query(
      `SELECT f.*, e.nome as empresa_nome, e.email as empresa_email, e.telefone as empresa_telefone, e.cnpj_cpf as empresa_cnpj
       FROM saas_faturas f
       JOIN empresas e ON e.id = f.empresa_id
       WHERE f.id = ?`,
      [id]
    );

    if (!faturas.length) {
      return res.status(404).json({ error: "Fatura não encontrada." });
    }

    const f = faturas[0];

    // Verificar permissão
    if (!isSuper && f.empresa_id !== empresaId) {
      return res.status(403).json({ error: "Acesso negado a esta fatura." });
    }

    // Se a fatura já possui dados de pagamento gerados e está pendente, reutilizar
    if (f.pix_copia_cola && f.status === "pendente") {
      return res.json({
        sucesso: true,
        fatura_id: f.id,
        pix_copia_cola: f.pix_copia_cola,
        pix_qr_code_url: f.pix_qr_code_url,
        invoice_url: f.link_fatura,
        gateway_transaction_id: f.gateway_transaction_id,
        status: f.status,
        gateway: f.gateway,
      });
    }

    // 1. Verificar gateway ativo no SaaS (Asaas ou Mercado Pago)
    const [gatewaysAtivos] = await db.query(
      `SELECT * FROM saas_gateways WHERE ativo = 1 ORDER BY updated_at DESC LIMIT 1`
    );
    const activeGateway = gatewaysAtivos[0];

    // Se Asaas for o gateway ativo
    if (activeGateway && activeGateway.provider === "asaas" && activeGateway.access_token) {
      const isSandbox = Boolean(activeGateway.sandbox);
      const baseUrl = isSandbox ? "https://sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
      const apiKey = activeGateway.access_token.trim();

      const cpfCnpj = (req.body?.cpf_cnpj || f.empresa_cnpj || "").replace(/\D/g, "");

      // Se não possui CPF/CNPJ cadastrado nem enviado no modal
      if (!cpfCnpj) {
        return res.status(400).json({
          exige_cpf: true,
          error: "Para gerar a cobrança no Asaas, é obrigatório informar o CPF ou CNPJ do pagador.",
        });
      }

      // Se foi enviado um novo CPF/CNPJ, atualiza na tabela de empresas
      if (req.body?.cpf_cnpj && (!f.empresa_cnpj || f.empresa_cnpj.replace(/\D/g, "") !== cpfCnpj)) {
        await db.query(`UPDATE empresas SET cnpj_cpf = ? WHERE id = ?`, [cpfCnpj, f.empresa_id]);
      }

      // Criar ou buscar cliente no Asaas
      let customerId = null;
      try {
        const searchRes = await axios.get(
          `${baseUrl}/customers?email=${encodeURIComponent(f.empresa_email)}`,
          { headers: { access_token: apiKey } }
        );
        if (searchRes.data?.data && searchRes.data.data.length > 0) {
          customerId = searchRes.data.data[0].id;
          // Garantir que o CPF está atualizado no Asaas
          try {
            await axios.put(
              `${baseUrl}/customers/${customerId}`,
              {
                cpfCnpj,
                mobilePhone: f.empresa_telefone ? f.empresa_telefone.replace(/\D/g, "") : undefined,
              },
              { headers: { access_token: apiKey } }
            );
          } catch (e) {
            console.warn("Aviso ao atualizar CPF do cliente no Asaas:", e.response?.data || e.message);
          }
        }
      } catch (e) {
        console.warn("Erro ao buscar cliente no Asaas:", e.message);
      }

      if (!customerId) {
        const createRes = await axios.post(
          `${baseUrl}/customers`,
          {
            name: f.empresa_nome || "Assinante Nuvy Finance",
            email: f.empresa_email,
            cpfCnpj,
            mobilePhone: f.empresa_telefone ? f.empresa_telefone.replace(/\D/g, "") : undefined,
            notificationDisabled: false,
          },
          { headers: { access_token: apiKey } }
        );
        customerId = createRes.data?.id;
      }

      // Criar cobrança no Asaas com suporte a PIX, Boleto e Cartão (UNDEFINED)
      const paymentRes = await axios.post(
        `${baseUrl}/payments`,
        {
          customer: customerId,
          billingType: "UNDEFINED",
          value: parseFloat(f.valor),
          dueDate: f.data_vencimento
            ? new Date(f.data_vencimento).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
          description: `Mensalidade Nuvy Finance - ${f.empresa_nome}`,
          externalReference: `SAAS_FATURA_${f.id}`,
        },
        { headers: { access_token: apiKey } }
      );

      const payment = paymentRes.data;

      // Buscar QR Code PIX
      let pixCopiaCola = null;
      let pixQrCodeBase64 = null;
      try {
        const pixRes = await axios.get(`${baseUrl}/payments/${payment.id}/pixQrCode`, {
          headers: { access_token: apiKey },
        });
        pixCopiaCola = pixRes.data?.payload;
        const rawImage = pixRes.data?.encodedImage || "";
        pixQrCodeBase64 = rawImage
          ? (rawImage.startsWith("data:") ? rawImage : `data:image/png;base64,${rawImage}`)
          : null;
      } catch (e) {
        console.warn("QR Code Pix não disponível imediatamente:", e.message);
      }

      // Salvar Pix e Link da Fatura no Banco
      await db.query(
        `UPDATE saas_faturas 
         SET pix_copia_cola = ?, pix_qr_code_url = ?, link_fatura = ?, gateway = 'asaas', gateway_transaction_id = ?
         WHERE id = ?`,
        [pixCopiaCola, pixQrCodeBase64, payment.invoiceUrl || payment.bankSlipUrl || null, String(payment.id), f.id]
      );

      return res.json({
        sucesso: true,
        fatura_id: f.id,
        pix_copia_cola: pixCopiaCola,
        pix_qr_code_url: pixQrCodeBase64,
        invoice_url: payment.invoiceUrl,
        bank_slip_url: payment.bankSlipUrl,
        gateway_transaction_id: payment.id,
        status: "pendente",
        gateway: "asaas",
      });
    }

    // Gerar Pix via Mercado Pago (Fallback padrão)
    const pixResult = await mercadopagoService.gerarPixFatura({
      faturaId: f.id,
      valor: f.valor,
      descricao: `Mensalidade Nuvy Finance - ${f.empresa_nome}`,
      emailCliente: f.empresa_email,
      nomeCliente: f.empresa_nome,
    });

    // Salvar Pix na Fatura
    await db.query(
      `UPDATE saas_faturas 
       SET pix_copia_cola = ?, pix_qr_code_url = ?, gateway = 'mercadopago', gateway_transaction_id = ?
       WHERE id = ?`,
      [pixResult.pixCopiaCola, pixResult.pixQrCodeBase64, String(pixResult.transactionId), f.id]
    );

    return res.json({
      sucesso: true,
      fatura_id: f.id,
      pix_copia_cola: pixResult.pixCopiaCola,
      pix_qr_code_url: pixResult.pixQrCodeBase64,
      gateway_transaction_id: pixResult.transactionId,
      status: "pendente",
      gateway: "mercadopago",
    });
  } catch (err) {
    console.error("Erro ao gerar Pix da fatura:", err);
    const msg =
      err.response?.data?.errors?.[0]?.description ||
      err.response?.data?.error ||
      err.message ||
      "Erro ao gerar chave Pix da fatura.";
    return res.status(err.response?.status || 500).json({ error: msg });
  }
};

// Processar Pagamento via Cartão de Crédito
const pagarCartao = async (req, res) => {
  try {
    const { id } = req.params;
    const isSuper = req.user.is_super;
    const empresaId = req.user.empresa_id;

    const [faturas] = await db.query(
      `SELECT f.*, e.nome as empresa_nome, e.email as empresa_email, e.telefone as empresa_telefone, e.cnpj_cpf as empresa_cnpj
       FROM saas_faturas f
       JOIN empresas e ON e.id = f.empresa_id
       WHERE f.id = ?`,
      [id]
    );

    if (!faturas.length) {
      return res.status(404).json({ error: "Fatura não encontrada." });
    }

    const f = faturas[0];

    if (!isSuper && f.empresa_id !== empresaId) {
      return res.status(403).json({ error: "Acesso negado a esta fatura." });
    }

    if (f.status === "pago") {
      return res.status(400).json({ error: "Esta fatura já está paga." });
    }

    // 1. Verificar gateway ativo no SaaS
    const [gatewaysAtivos] = await db.query(
      `SELECT * FROM saas_gateways WHERE ativo = 1 ORDER BY updated_at DESC LIMIT 1`
    );
    const activeGateway = gatewaysAtivos[0];

    // Se Asaas for o gateway ativo
    if (activeGateway && activeGateway.provider === "asaas" && activeGateway.access_token) {
      const isSandbox = Boolean(activeGateway.sandbox);
      const baseUrl = isSandbox ? "https://sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
      const apiKey = activeGateway.access_token.trim();

      const {
        numero_cartao,
        nome_impresso,
        validade_mes,
        validade_ano,
        cvv,
        cpf_cnpj,
        parcelas = 1,
        cep = "01001000",
        telefone,
      } = req.body;

      if (!numero_cartao || !nome_impresso || !validade_mes || !validade_ano || !cvv) {
        return res.status(400).json({
          error: "Dados do cartão incompletos (Número, Nome, Validade e CVV são obrigatórios).",
        });
      }

      const cpfFinal = (cpf_cnpj || f.empresa_cnpj || "").replace(/\D/g, "");
      if (!cpfFinal) {
        return res.status(400).json({
          exige_cpf: true,
          error: "Informe o CPF ou CNPJ do titular do cartão.",
        });
      }

      // Salvar CPF na empresa se não tinha
      if (cpf_cnpj && !f.empresa_cnpj) {
        await db.query(`UPDATE empresas SET cnpj_cpf = ? WHERE id = ?`, [cpfFinal, f.empresa_id]);
      }

      // Buscar ou criar cliente no Asaas
      let customerId = null;
      try {
        const searchRes = await axios.get(
          `${baseUrl}/customers?email=${encodeURIComponent(f.empresa_email)}`,
          { headers: { access_token: apiKey } }
        );
        if (searchRes.data?.data && searchRes.data.data.length > 0) {
          customerId = searchRes.data.data[0].id;
          await axios.put(
            `${baseUrl}/customers/${customerId}`,
            {
              name: f.empresa_nome,
              cpfCnpj: cpfFinal,
              mobilePhone: telefone ? telefone.replace(/\D/g, "") : (f.empresa_telefone ? f.empresa_telefone.replace(/\D/g, "") : undefined),
            },
            { headers: { access_token: apiKey } }
          );
        }
      } catch (e) {
        console.warn("Erro busca cliente Asaas:", e.message);
      }

      if (!customerId) {
        const createRes = await axios.post(
          `${baseUrl}/customers`,
          {
            name: f.empresa_nome || "Assinante Nuvy Finance",
            email: f.empresa_email,
            cpfCnpj: cpfFinal,
            mobilePhone: telefone ? telefone.replace(/\D/g, "") : (f.empresa_telefone ? f.empresa_telefone.replace(/\D/g, "") : undefined),
            notificationDisabled: false,
          },
          { headers: { access_token: apiKey } }
        );
        customerId = createRes.data?.id;
      }

      const anoFormatado = String(validade_ano).trim();
      const expiryYear = anoFormatado.length === 2 ? `20${anoFormatado}` : anoFormatado;

      // Detectar se a fatura é de ciclo Anual ou Mensal
      const isAnual = f.ciclo === "anual" || parseFloat(f.valor) > 250;
      // No plano anual permitimos até 12x. No mensal, é sempre 1x (recorrente)
      const parcelasFinal = isAnual ? (parseInt(parcelas, 10) || 1) : 1;
      const diasRenovacao = isAnual ? 365 : 30;

      // Executar cobrança de cartão no Asaas
      const payloadCartao = {
        customer: customerId,
        billingType: "CREDIT_CARD",
        value: parseFloat(f.valor),
        dueDate: new Date().toISOString().split("T")[0],
        description: `Assinatura Nuvy Finance (${isAnual ? "Anual" : "Mensal"}) - ${f.empresa_nome}`,
        externalReference: `SAAS_FATURA_${f.id}`,
        installmentCount: parcelasFinal,
        installmentValue: (parseFloat(f.valor) / parcelasFinal).toFixed(2),
        creditCard: {
          holderName: nome_impresso.trim().toUpperCase(),
          number: numero_cartao.replace(/\D/g, ""),
          expiryMonth: String(validade_mes).padStart(2, "0"),
          expiryYear,
          ccv: String(cvv).trim(),
        },
        creditCardHolderInfo: {
          name: nome_impresso.trim().toUpperCase(),
          email: f.empresa_email,
          cpfCnpj: cpfFinal,
          postalCode: (cep || "01001000").replace(/\D/g, ""),
          addressNumber: "100",
          phone: (telefone || f.empresa_telefone || "11999999999").replace(/\D/g, ""),
        },
      };

      const paymentRes = await axios.post(`${baseUrl}/payments`, payloadCartao, {
        headers: { access_token: apiKey },
      });

      const payment = paymentRes.data;

      if (payment.status === "CONFIRMED" || payment.status === "RECEIVED") {
        // 1. Dar baixa na fatura
        await db.query(
          `UPDATE saas_faturas 
           SET status = 'pago', data_pagamento = NOW(), gateway = 'asaas', gateway_transaction_id = ?
           WHERE id = ?`,
          [String(payment.id), f.id]
        );

        // 2. Renovar tenant (+365 dias se anual, +30 dias se mensal)
        await db.query(
          `UPDATE empresas 
           SET status_saas = 'ativo', bloqueado_em = NULL, trial_ate = DATE_ADD(GREATEST(COALESCE(trial_ate, NOW()), NOW()), INTERVAL ? DAY) 
           WHERE id = ?`,
          [diasRenovacao, f.empresa_id]
        );

        return res.json({
          sucesso: true,
          status: "approved",
          message: `Pagamento aprovado com sucesso no cartão! Assinatura renovada por +${diasRenovacao} dias.`,
        });
      } else {
        // Disparar WhatsApp com Pix em segundo plano caso o cartão falhe
        notificarFaturaVencidaWhatsapp(f.id);
        return res.status(400).json({
          error: `Cartão não aprovado (${payment.status}). Enviamos as instruções de pagamento com Pix para o seu WhatsApp cadastrado.`,
        });
      }
    }

    // Caso seja Mercado Pago
    const { token, payment_method_id, installments = 1, cpf_cnpj } = req.body;
    if (!token || !payment_method_id) {
      return res.status(400).json({ error: "Dados do cartão incompletos para Mercado Pago." });
    }

    const isAnualMP = f.ciclo === "anual" || parseFloat(f.valor) > 250;
    const parcelasFinalMP = isAnualMP ? (parseInt(installments, 10) || 1) : 1;
    const diasRenovacaoMP = isAnualMP ? 365 : 30;

    const result = await mercadopagoService.pagarCartaoFatura({
      faturaId: f.id,
      valor: f.valor,
      token,
      paymentMethodId: payment_method_id,
      installments: parcelasFinalMP,
      emailCliente: f.empresa_email,
      nomeCliente: f.empresa_nome,
      cpfCnpj: cpf_cnpj,
    });

    if (result.status === "approved") {
      await db.query(
        `UPDATE saas_faturas 
         SET status = 'pago', data_pagamento = NOW(), gateway = 'mercadopago', gateway_transaction_id = ?
         WHERE id = ?`,
        [String(result.transactionId), f.id]
      );

      await db.query(
        `UPDATE empresas 
         SET status_saas = 'ativo', bloqueado_em = NULL, trial_ate = DATE_ADD(GREATEST(COALESCE(trial_ate, NOW()), NOW()), INTERVAL ? DAY) 
         WHERE id = ?`,
        [diasRenovacaoMP, f.empresa_id]
      );

      return res.json({
        sucesso: true,
        status: "approved",
        message: `Pagamento aprovado com sucesso via Mercado Pago! Assinatura renovada por +${diasRenovacaoMP} dias.`,
      });
    } else {
      notificarFaturaVencidaWhatsapp(f.id);
      return res.status(400).json({
        error: `Pagamento não aprovado. Status: ${result.status_detail || result.status}. Chave Pix enviada para seu WhatsApp.`,
      });
    }
  } catch (err) {
    console.error("Erro ao pagar cartão:", err);
    notificarFaturaVencidaWhatsapp(req.params.id);
    const msg =
      err.response?.data?.errors?.[0]?.description ||
      err.response?.data?.error ||
      err.message ||
      "Erro ao processar pagamento com cartão de crédito.";
    return res.status(err.response?.status || 500).json({ error: msg });
  }
};


// Liquidar fatura manualmente (Super Admin)
const liquidarFatura = async (req, res) => {
  try {
    const { id } = req.params;

    const [faturas] = await db.query(`SELECT * FROM saas_faturas WHERE id = ?`, [id]);
    if (!faturas.length) {
      return res.status(404).json({ error: "Fatura não encontrada" });
    }

    const f = faturas[0];
    const isAnual = f.ciclo === "anual" || parseFloat(f.valor) > 250;
    const diasRenovacao = isAnual ? 365 : 30;

    await db.query(
      `UPDATE saas_faturas SET status = 'pago', data_pagamento = NOW() WHERE id = ?`,
      [id]
    );

    // Reativar empresa e estender trial/validade
    await db.query(
      `UPDATE empresas 
       SET status_saas = 'ativo', bloqueado_em = NULL, trial_ate = DATE_ADD(GREATEST(COALESCE(trial_ate, NOW()), NOW()), INTERVAL ? DAY) 
       WHERE id = ?`,
      [diasRenovacao, f.empresa_id]
    );

    return res.json({ sucesso: true, message: `Fatura #${id} baixada manualmente com sucesso (+${diasRenovacao}d)!` });
  } catch (err) {
    console.error("Erro ao liquidar fatura SaaS:", err);
    return res.status(500).json({ error: "Erro interno ao liquidar fatura SaaS" });
  }
};

// Excluir fatura (Super Admin) - Apenas faturas pendentes ou vencidas
const deletarFatura = async (req, res) => {
  try {
    const { id } = req.params;

    const [faturas] = await db.query(`SELECT * FROM saas_faturas WHERE id = ?`, [id]);
    if (!faturas.length) {
      return res.status(404).json({ error: "Fatura não encontrada." });
    }

    const f = faturas[0];

    if (f.status === "pago") {
      return res.status(400).json({
        error: "Faturas pagas não podem ser excluídas para preservar o histórico financeiro e métricas de MRR.",
      });
    }

    // Se a cobrança foi gerada no Asaas, cancela/remove na Asaas também
    if (f.gateway === "asaas" && f.gateway_transaction_id) {
      try {
        const [gateways] = await db.query(
          `SELECT * FROM saas_gateways WHERE provider = 'asaas' LIMIT 1`
        );
        if (gateways.length && gateways[0].access_token) {
          const isSandbox = Boolean(gateways[0].sandbox);
          const baseUrl = isSandbox ? "https://sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
          const apiKey = gateways[0].access_token.trim();
          await axios.delete(`${baseUrl}/payments/${f.gateway_transaction_id}`, {
            headers: { access_token: apiKey },
          });
          console.log(`[Asaas]: Cobrança ${f.gateway_transaction_id} cancelada no Asaas com sucesso.`);
        }
      } catch (asaasErr) {
        console.warn(`[Asaas]: Aviso ao cancelar cobrança ${f.gateway_transaction_id} no Asaas:`, asaasErr.response?.data || asaasErr.message);
      }
    }

    await db.query(`DELETE FROM saas_faturas WHERE id = ?`, [id]);

    return res.json({ sucesso: true, message: `Fatura #${id} excluída do sistema e cancelada na Asaas com sucesso.` });
  } catch (err) {
    console.error("Erro ao deletar fatura SaaS:", err);
    return res.status(500).json({ error: "Erro ao excluir fatura SaaS." });
  }
};

// Webhook Mercado Pago (Baixa Instantânea no Pix)
const webhookMercadoPago = async (req, res) => {
  try {
    const { type, data, action } = req.body;
    console.log("[Webhook Mercado Pago Recebido]:", { type, action, data });

    const paymentId = data?.id || req.query["data.id"] || req.query.id;

    if (paymentId) {
      const paymentInfo = await mercadopagoService.consultarPagamento(paymentId);
      if (paymentInfo && paymentInfo.status === "approved") {
        const faturaId = paymentInfo.external_reference;

        if (faturaId) {
          const [faturas] = await db.query(`SELECT * FROM saas_faturas WHERE id = ?`, [faturaId]);
          if (faturas.length > 0) {
            const f = faturas[0];
            const valorPagoMP = parseFloat(paymentInfo.transaction_amount || 0);
            const valorEsperado = parseFloat(f.valor);

            // SEGURANÇA: Conferir se o valor pago bate com o valor da fatura (tolerância mínima de R$ 0,05)
            if (Math.abs(valorPagoMP - valorEsperado) > 0.05 && valorPagoMP < valorEsperado) {
              console.warn(`[SECURITY] Pagamento Mercado Pago rejeitado: valor pago (R$ ${valorPagoMP}) menor que a fatura #${faturaId} (R$ ${valorEsperado})`);
              return res.status(200).send("OK");
            }

            if (f.status !== "pago") {
              const isAnual = f.ciclo === "anual" || parseFloat(f.valor) > 250;
              const diasRenovacao = isAnual ? 365 : 30;

              // 1. Dar baixa na fatura
              await db.query(
                `UPDATE saas_faturas SET status = 'pago', data_pagamento = NOW() WHERE id = ?`,
                [faturaId]
              );

              // 2. Renovar tenant
              await db.query(
                `UPDATE empresas 
                 SET status_saas = 'ativo', bloqueado_em = NULL, trial_ate = DATE_ADD(GREATEST(COALESCE(trial_ate, NOW()), NOW()), INTERVAL ? DAY)
                 WHERE id = ?`,
                [diasRenovacao, f.empresa_id]
              );

              console.log(`[Mercado Pago Webhook]: Fatura #${faturaId} PAGA! Empresa #${f.empresa_id} reativada/renovada (+${diasRenovacao}d).`);
            }
          }
        }
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("Erro no webhook Mercado Pago:", err);
    return res.status(200).send("OK"); // Sempre responder 200 pro MP não re-tentar infinitamente em caso de falha pontual
  }
};

// Webhook Público Asaas para Baixa Automática de Faturas SaaS
const webhookAsaas = async (req, res) => {
  try {
    // 1. SEGURANÇA: Validar assinatura / token secreto do Asaas
    const asaasWebhookToken = req.headers["asaas-access-token"];

    // Buscar token configurado no .env ou no banco (saas_gateways client_secret)
    let configuredToken = process.env.ASAAS_WEBHOOK_TOKEN;
    if (!configuredToken) {
      const [gateways] = await db.query(
        `SELECT client_secret FROM saas_gateways WHERE provider = 'asaas' AND client_secret IS NOT NULL AND client_secret != '' LIMIT 1`
      );
      if (gateways.length > 0 && gateways[0].client_secret) {
        configuredToken = gateways[0].client_secret.trim();
      }
    }

    // Se há um token configurado no sistema, a requisição DEVE apresentar exatamente o mesmo token
    if (configuredToken) {
      if (!asaasWebhookToken || asaasWebhookToken !== configuredToken) {
        console.warn("[SECURITY] Tentativa de chamada no webhook Asaas com token ausente ou inválido!");
        return res.status(401).json({ error: "Acesso não autorizado. Assinatura do webhook Asaas ausente ou inválida." });
      }
    } else {
      // Se ainda não configurou ASAAS_WEBHOOK_TOKEN no .env/banco, exigir obrigatoriamente um token não vazio para evitar requisições anônimas
      if (!asaasWebhookToken) {
        console.warn("[SECURITY] Chamada no webhook Asaas bloqueada: nenhum token fornecido no header asaas-access-token.");
        return res.status(401).json({ error: "Cabeçalho asaas-access-token é obrigatório para autenticar o webhook." });
      }
    }

    const { event, payment } = req.body;
    console.log(`[Asaas SaaS Webhook]: Evento ${event} recebido. ID:`, payment?.id);

    const ref = payment?.externalReference || "";
    let faturaId = null;

    if (ref.startsWith("SAAS_FATURA_")) {
      faturaId = parseInt(ref.replace("SAAS_FATURA_", ""), 10);
    } else if (payment?.id) {
      const [byTx] = await db.query(
        "SELECT id FROM saas_faturas WHERE gateway_transaction_id = ?",
        [String(payment.id)]
      );
      if (byTx.length > 0) faturaId = byTx[0].id;
    }

    if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
      if (faturaId) {
        const [faturas] = await db.query("SELECT * FROM saas_faturas WHERE id = ?", [faturaId]);
        if (faturas.length > 0) {
          const f = faturas[0];
          if (f.status !== "pago") {
            const isAnual = f.ciclo === "anual" || parseFloat(f.valor) > 250;
            const diasRenovacao = isAnual ? 365 : 30;

            await db.query(
              "UPDATE saas_faturas SET status = 'pago', data_pagamento = NOW() WHERE id = ?",
              [faturaId]
            );
            await db.query(
              `UPDATE empresas 
               SET status_saas = 'ativo', bloqueado_em = NULL, trial_ate = DATE_ADD(GREATEST(COALESCE(trial_ate, NOW()), NOW()), INTERVAL ? DAY)
               WHERE id = ?`,
              [diasRenovacao, f.empresa_id]
            );
            console.log(`[Asaas Webhook]: Fatura #${faturaId} PAGA! Empresa #${f.empresa_id} reativada/renovada (+${diasRenovacao}d).`);
          }
        }
      }
    } else if (event === "PAYMENT_OVERDUE" || event === "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED") {
      if (faturaId) {
        console.log(`[Asaas Webhook]: Cobrança vencida ou cartão recusado na fatura #${faturaId}. Disparando Pix no WhatsApp.`);
        await notificarFaturaVencidaWhatsapp(faturaId);
      }
    }
    return res.status(200).send("OK");
  } catch (err) {
    console.error("Erro no webhook Asaas SaaS:", err);
    return res.status(200).send("OK");
  }
};

// Gerenciar Credenciais dos Gateways (Super Admin)
const getGateways = async (req, res) => {
  try {
    const [gateways] = await db.query(
      `SELECT id, provider, access_token, public_key, sandbox, ativo, updated_at FROM saas_gateways`
    );
    return res.json(gateways);
  } catch (err) {
    return res.status(500).json({ error: "Erro ao buscar gateways" });
  }
};

const salvarGateway = async (req, res) => {
  try {
    const { provider = "mercadopago", access_token, public_key, sandbox = false, ativo = true } = req.body;

    // Se este gateway estiver sendo ativado, desativa os outros para manter um ativo principal
    if (ativo) {
      await db.query(`UPDATE saas_gateways SET ativo = 0 WHERE provider != ?`, [provider]);
    }

    const [existing] = await db.query(`SELECT id FROM saas_gateways WHERE provider = ?`, [provider]);

    if (existing.length > 0) {
      await db.query(
        `UPDATE saas_gateways 
         SET access_token = ?, public_key = ?, sandbox = ?, ativo = ? 
         WHERE provider = ?`,
        [access_token ? access_token.trim() : null, public_key ? public_key.trim() : null, sandbox ? 1 : 0, ativo ? 1 : 0, provider]
      );
    } else {
      await db.query(
        `INSERT INTO saas_gateways (provider, access_token, public_key, sandbox, ativo)
         VALUES (?, ?, ?, ?, ?)`,
        [provider, access_token ? access_token.trim() : null, public_key ? public_key.trim() : null, sandbox ? 1 : 0, ativo ? 1 : 0]
      );
    }

    return res.json({ message: `Credenciais do gateway ${provider} atualizadas com sucesso!` });
  } catch (err) {
    console.error("Erro ao salvar gateway:", err);
    return res.status(500).json({ error: "Erro ao salvar credenciais do gateway." });
  }
};

// Métricas Globais SaaS (MRR, Inadimplência, Churn, Histórico)
const obterMetricasSaas = async (req, res) => {
  try {
    // 1. MRR atual (Soma dos planos de empresas ativas)
    const [mrrRow] = await db.query(`
      SELECT SUM(p.valor) as mrr, COUNT(e.id) as total_ativas
      FROM empresas e
      JOIN saas_planos p ON p.id = e.plano_saas_id
      WHERE e.status_saas = 'ativo' AND e.ativo = 1
    `);

    // 2. Inadimplência total
    const [inadimplenciaRow] = await db.query(`
      SELECT SUM(valor) as total_inadimplente, COUNT(*) as faturas_vencidas
      FROM saas_faturas
      WHERE status IN ('pendente', 'vencido') AND data_vencimento < CURDATE()
    `);

    // 3. Status das Empresas
    const [statusEmpresas] = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status_saas = 'ativo' THEN 1 END) as ativas,
        COUNT(CASE WHEN status_saas = 'trial' THEN 1 END) as trials,
        COUNT(CASE WHEN status_saas = 'bloqueado' THEN 1 END) as bloqueadas,
        COUNT(CASE WHEN status_saas = 'cancelado' THEN 1 END) as canceladas
      FROM empresas
    `);

    // 4. Faturamento do Mês Atual vs Mês Anterior
    const [faturamentoMes] = await db.query(`
      SELECT 
        SUM(CASE WHEN MONTH(data_pagamento) = MONTH(CURDATE()) AND YEAR(data_pagamento) = YEAR(CURDATE()) THEN valor ELSE 0 END) as mes_atual,
        SUM(CASE WHEN MONTH(data_pagamento) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(data_pagamento) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) THEN valor ELSE 0 END) as mes_anterior
      FROM saas_faturas
      WHERE status = 'pago'
    `);

    // 5. Histórico dos últimos 6 meses de faturamento pago
    const [historico6m] = await db.query(`
      SELECT 
        DATE_FORMAT(data_pagamento, '%Y-%m') as mes,
        SUM(valor) as total_pago,
        COUNT(*) as total_faturas
      FROM saas_faturas
      WHERE status = 'pago' AND data_pagamento >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(data_pagamento, '%Y-%m')
      ORDER BY mes ASC
    `);

    const mrr = parseFloat(mrrRow[0]?.mrr || 0);

    return res.json({
      mrr,
      arr: mrr * 12,
      inadimplencia_total: parseFloat(inadimplenciaRow[0]?.total_inadimplente || 0),
      faturas_vencidas: inadimplenciaRow[0]?.faturas_vencidas || 0,
      empresas: statusEmpresas[0] || {},
      faturamento_mes_atual: parseFloat(faturamentoMes[0]?.mes_atual || 0),
      faturamento_mes_anterior: parseFloat(faturamentoMes[0]?.mes_anterior || 0),
      historico_6meses: historico6m || [],
    });
  } catch (err) {
    console.error("Erro ao obter métricas SaaS:", err);
    return res.status(500).json({ error: "Erro ao calcular métricas globais do SaaS" });
  }
};

module.exports = {
  listar,
  gerarPix,
  pagarCartao,
  liquidarFatura,
  deletarFatura,
  webhookMercadoPago,
  webhookAsaas,
  getGateways,
  salvarGateway,
  obterMetricasSaas,
};
