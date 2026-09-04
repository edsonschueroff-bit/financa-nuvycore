const axios = require("axios");
const db = require("../../db");

// Obter credencial ativa do Mercado Pago (do banco ou das variáveis de ambiente)
const getCredentials = async () => {
    const [rows] = await db.query(
        `SELECT * FROM saas_gateways WHERE provider = 'mercadopago' AND ativo = 1 LIMIT 1`
    );

    if (rows.length > 0 && rows[0].access_token) {
        return {
            accessToken: rows[0].access_token,
            sandbox: Boolean(rows[0].sandbox),
            publicKey: rows[0].public_key || null,
        };
    }

    // Fallback para .env
    return {
        accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || null,
        sandbox: process.env.MERCADOPAGO_SANDBOX === "true",
        publicKey: process.env.MERCADOPAGO_PUBLIC_KEY || null,
    };
};

/**
 * Gerar cobrança Pix via Mercado Pago
 */
const gerarPixFatura = async ({ faturaId, valor, descricao, emailCliente, nomeCliente }) => {
    const { accessToken } = await getCredentials();

    if (!accessToken) {
        throw new Error("Mercado Pago não configurado. Adicione o AccessToken no painel Super Admin.");
    }

    try {
        const payload = {
            transaction_amount: parseFloat(valor),
            description: descricao || `Mensalidade Nuvy Finance - Fatura #${faturaId}`,
            payment_method_id: "pix",
            payer: {
                email: emailCliente || "financeiro@nuvycore.online",
                first_name: nomeCliente || "Cliente Nuvy Finance",
            },
            external_reference: String(faturaId),
        };

        const response = await axios.post("https://api.mercadopago.com/v1/payments", payload, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                "X-Idempotency-Key": `fatura_pix_${faturaId}_${Date.now()}`,
            },
        });

        const data = response.data;
        const pixData = data.point_of_interaction?.transaction_data;

        return {
            transactionId: data.id,
            status: data.status,
            pixCopiaCola: pixData?.qr_code || null,
            pixQrCodeBase64: pixData?.qr_code_base64 ? `data:image/png;base64,${pixData.qr_code_base64}` : null,
            ticketUrl: pixData?.ticket_url || null,
        };
    } catch (err) {
        console.error("Erro na API Mercado Pago (Pix):", err.response?.data || err.message);
        throw new Error(err.response?.data?.message || "Erro ao conectar com Mercado Pago");
    }
};

/**
 * Processar Pagamento via Cartão de Crédito no Mercado Pago
 */
const pagarCartaoFatura = async ({
    faturaId,
    valor,
    token,
    paymentMethodId,
    installments = 1,
    emailCliente,
    nomeCliente,
    cpfCnpj,
}) => {
    const { accessToken } = await getCredentials();

    if (!accessToken) {
        throw new Error("Mercado Pago não configurado. Adicione o AccessToken no painel Super Admin.");
    }

    try {
        const payload = {
            transaction_amount: parseFloat(valor),
            token: token,
            description: `Mensalidade Nuvy Finance - Fatura #${faturaId}`,
            installments: Number(installments) || 1,
            payment_method_id: paymentMethodId,
            payer: {
                email: emailCliente || "financeiro@nuvycore.online",
                first_name: nomeCliente || "Cliente Nuvy Finance",
                identification: cpfCnpj
                    ? {
                        type: cpfCnpj.length > 11 ? "CNPJ" : "CPF",
                        number: cpfCnpj.replace(/\D/g, ""),
                    }
                    : undefined,
            },
            external_reference: String(faturaId),
        };

        const response = await axios.post("https://api.mercadopago.com/v1/payments", payload, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                "X-Idempotency-Key": `fatura_card_${faturaId}_${Date.now()}`,
            },
        });

        const data = response.data;

        return {
            transactionId: data.id,
            status: data.status, // approved, in_process, rejected
            statusDetail: data.status_detail,
        };
    } catch (err) {
        console.error("Erro na API Mercado Pago (Cartão):", err.response?.data || err.message);
        const msg = err.response?.data?.message || err.response?.data?.cause?.[0]?.description || "Erro ao processar cartão de crédito.";
        throw new Error(msg);
    }
};

/**
 * Consultar Status do Pagamento no Mercado Pago
 */
const consultarPagamento = async (transactionId) => {
    const { accessToken } = await getCredentials();
    if (!accessToken) return null;

    try {
        const response = await axios.get(`https://api.mercadopago.com/v1/payments/${transactionId}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        return response.data;
    } catch (err) {
        console.error("Erro ao consultar pagamento MP:", err.message);
        return null;
    }
};

module.exports = {
    getCredentials,
    gerarPixFatura,
    pagarCartaoFatura,
    consultarPagamento,
};
