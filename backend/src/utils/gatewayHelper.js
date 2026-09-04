const axios = require("axios");

/**
 * Utilitário para comunicação com Gateways de Pagamento (Asaas e Mercado Pago)
 */

const getAsaasBaseUrl = (ambiente) => {
  return ambiente === "producao"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/v3";
};

/**
 * Testar conexão com Asaas
 */
async function testarAsaas(apiKey, ambiente = "sandbox") {
  try {
    const url = `${getAsaasBaseUrl(ambiente)}/customers?limit=1`;
    const res = await axios.get(url, {
      headers: {
        access_token: apiKey,
      },
      timeout: 10000,
    });
    return { sucesso: true, dados: res.data };
  } catch (err) {
    const msg = err.response?.data?.errors?.[0]?.description || err.message;
    return { sucesso: false, erro: msg };
  }
}

/**
 * Testar conexão com Mercado Pago
 */
async function testarMercadoPago(accessToken) {
  try {
    const url = "https://api.mercadopago.com/users/me";
    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 10000,
    });
    return {
      sucesso: true,
      dados: {
        id: res.data.id,
        nickname: res.data.nickname,
        email: res.data.email,
      },
    };
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    return { sucesso: false, erro: msg };
  }
}

/**
 * Criar ou buscar cliente no Asaas
 */
async function criarClienteAsaas({ apiKey, ambiente, contato, empresaNome }) {
  const baseUrl = getAsaasBaseUrl(ambiente);

  // Buscar se cliente já existe por CPF/CNPJ ou Email
  if (contato?.cpf_cnpj || contato?.email) {
    try {
      const searchParam = contato.cpf_cnpj
        ? `cpfCnpj=${contato.cpf_cnpj.replace(/\D/g, "")}`
        : `email=${encodeURIComponent(contato.email)}`;
      const searchRes = await axios.get(`${baseUrl}/customers?${searchParam}`, {
        headers: { access_token: apiKey },
      });
      if (searchRes.data?.data?.length > 0) {
        return searchRes.data.data[0].id;
      }
    } catch (e) {
      console.warn("Erro ao buscar cliente existente no Asaas:", e.message);
    }
  }

  // Criar novo cliente
  const payload = {
    name: contato?.nome || "Cliente Consumidor",
    email: contato?.email || undefined,
    phone: contato?.telefone ? contato.telefone.replace(/\D/g, "") : undefined,
    mobilePhone: contato?.telefone ? contato.telefone.replace(/\D/g, "") : undefined,
    cpfCnpj: contato?.cpf_cnpj ? contato.cpf_cnpj.replace(/\D/g, "") : undefined,
    postalCode: contato?.cep ? contato.cep.replace(/\D/g, "") : undefined,
    address: contato?.logradouro || undefined,
    addressNumber: contato?.numero || undefined,
    complement: contato?.complemento || undefined,
    province: contato?.bairro || undefined,
    notificationDisabled: false,
  };

  const res = await axios.post(`${baseUrl}/customers`, payload, {
    headers: { access_token: apiKey },
  });

  return res.data.id;
}

/**
 * Gerar cobrança no Asaas (PIX, BOLETO ou CARTÃO)
 */
async function gerarCobrancaAsaas({ config, transacao, contato, forma = "UNDEFINED" }) {
  const baseUrl = getAsaasBaseUrl(config.ambiente);
  const customerId = await criarClienteAsaas({
    apiKey: config.api_key,
    ambiente: config.ambiente,
    contato,
  });

  let billingType = "UNDEFINED";
  if (forma === "pix") billingType = "PIX";
  else if (forma === "boleto") billingType = "BOLETO";
  else if (forma === "cartao_credito") billingType = "CREDIT_CARD";

  const payload = {
    customer: customerId,
    billingType,
    value: parseFloat(transacao.valor),
    dueDate: transacao.data_vencimento ? transacao.data_vencimento.split("T")[0] : new Date().toISOString().split("T")[0],
    description: transacao.descricao,
    externalReference: `TX_${transacao.id}`,
    discount: undefined,
    interest: config.juros_mensal > 0 ? { value: parseFloat(config.juros_mensal) } : undefined,
    fine: config.multa_atraso > 0 ? { value: parseFloat(config.multa_atraso) } : undefined,
  };

  const res = await axios.post(`${baseUrl}/payments`, payload, {
    headers: { access_token: config.api_key },
  });

  const payment = res.data;

  // Se for PIX ou UNDEFINED, obter QR Code PIX
  let pixData = null;
  try {
    const pixRes = await axios.get(`${baseUrl}/payments/${payment.id}/pixQrCode`, {
      headers: { access_token: config.api_key },
    });
    pixData = {
      encodedImage: pixRes.data.encodedImage,
      payload: pixRes.data.payload,
      expirationDate: pixRes.data.expirationDate,
    };
  } catch (e) {
    // Pode não estar disponível para boleto puro
  }

  return {
    sucesso: true,
    payment_id: payment.id,
    invoice_url: payment.invoiceUrl,
    bank_slip_url: payment.bankSlipUrl,
    status: payment.status,
    pix: pixData,
  };
}

/**
 * Gerar cobrança no Mercado Pago (PIX ou Boleto)
 */
async function gerarCobrancaMercadoPago({ config, transacao, contato, forma = "pix" }) {
  const url = "https://api.mercadopago.com/v1/payments";

  const payload = {
    transaction_amount: parseFloat(transacao.valor),
    description: transacao.descricao,
    payment_method_id: forma === "boleto" ? "bolbradesco" : "pix",
    payer: {
      email: contato?.email || "contato@cliente.com.br",
      first_name: contato?.nome?.split(" ")[0] || "Cliente",
      last_name: contato?.nome?.split(" ").slice(1).join(" ") || "Consumidor",
      identification: contato?.cpf_cnpj
        ? {
            type: contato.cpf_cnpj.length > 11 ? "CNPJ" : "CPF",
            number: contato.cpf_cnpj.replace(/\D/g, ""),
          }
        : undefined,
    },
    external_reference: `TX_${transacao.id}`,
    date_of_expiration: transacao.data_vencimento
      ? `${transacao.data_vencimento.split("T")[0]}T23:59:59.000-03:00`
      : undefined,
  };

  const res = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${config.api_key}`,
      "X-Idempotency-Key": `TX_${transacao.id}_${Date.now()}`,
    },
  });

  const payment = res.data;

  const qrCodeBase64 = payment.point_of_interaction?.transaction_data?.qr_code_base64 || null;
  const qrCode = payment.point_of_interaction?.transaction_data?.qr_code || null;
  const ticketUrl = payment.point_of_interaction?.transaction_data?.ticket_url || null;

  return {
    sucesso: true,
    payment_id: String(payment.id),
    invoice_url: ticketUrl,
    bank_slip_url: ticketUrl,
    status: payment.status,
    pix: qrCode ? { encodedImage: qrCodeBase64, payload: qrCode } : null,
  };
}

module.exports = {
  testarAsaas,
  testarMercadoPago,
  gerarCobrancaAsaas,
  gerarCobrancaMercadoPago,
};
