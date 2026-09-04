const axios = require("axios");

/**
 * Serviço de Integração SMSNET
 * Suporta SMS 1-Way e SMS 2-Way para disparo de réguas de cobrança e notificações.
 */
class SmsnetService {
    /**
     * Enviar SMS via SMSNET
     * @param {Object} params
     * @param {string} params.telefone - Número do destinatário (ex: 11999998888 ou 5511999998888)
     * @param {string} params.mensagem - Texto da mensagem SMS
     * @param {string} [params.usuario] - Usuário / Client ID SMSNET
     * @param {string} [params.token] - Token / Client Secret SMSNET
     */
    static async enviarSms({ telefone, mensagem, usuario, token }) {
        try {
            // Formatar telefone: apenas dígitos
            let cleanPhone = String(telefone || "").replace(/\D/g, "");
            if (cleanPhone.length === 10 || cleanPhone.length === 11) {
                cleanPhone = "55" + cleanPhone;
            }

            let smsUser = usuario || process.env.SMSNET_GLOBAL_USER || process.env.SMSNET_CLIENT_ID || "tohs4x4yz5xffcalqcnrdwogkq8hhyoe";
            let smsToken = token || process.env.SMSNET_GLOBAL_TOKEN || process.env.SMSNET_CLIENT_SECRET || "ad9wn3zd17dwfjljdurfa96egdrxksak";

            // Se o token vier no formato combinado "client_id:client_secret", separar se necessário
            if (smsToken && smsToken.includes(":") && !usuario) {
                const parts = smsToken.split(":");
                smsUser = parts[0];
                smsToken = parts[1];
            }

            let ultimoErro = null;

            // Estratégia 1: GET oficial da SMSNET (Tentativa com Rota 6 WhatsApp e Fallback Padrão)
            const userRota6 = smsUser.endsWith("-6") ? smsUser : `${smsUser}-6`;
            const urlGet = `https://sistema.smsnet.com.br/sms/global`;

            // 1.1 Tentar com Rota 6 (WhatsApp da SMSNET)
            try {
                const resRota6 = await axios.get(urlGet, {
                    params: {
                        username: userRota6,
                        password: smsToken,
                        to: cleanPhone,
                        msg: mensagem,
                    },
                    timeout: 8000,
                });

                if (resRota6.data?.success === true || resRota6.status === 200) {
                    console.log(`[SMSNET ROTA 6] Mensagem entregue via WhatsApp SMSNET para ${cleanPhone}:`, resRota6.data);
                    return {
                        sucesso: true,
                        metodo: "GET_ROTA_6",
                        data: resRota6.data,
                        telefone: cleanPhone,
                    };
                }
            } catch (errRota6) {
                ultimoErro = errRota6.response?.data || errRota6.message;
                console.warn("[SMSNET] Tentativa Rota 6 falhou, tentando fallback padrão:", ultimoErro);
            }

            // 1.2 Fallback: Tentar com username padrão (SMS Shortcode)
            try {
                const responseGet = await axios.get(urlGet, {
                    params: {
                        username: smsUser.replace(/-6$/, ""),
                        password: smsToken,
                        to: cleanPhone,
                        msg: mensagem,
                    },
                    timeout: 8000,
                });

                if (responseGet.data?.success === true || responseGet.status === 200) {
                    console.log(`[SMSNET] Mensagem enviada via GET para ${cleanPhone}. Resposta:`, responseGet.data);
                    return {
                        sucesso: true,
                        metodo: "GET",
                        data: responseGet.data,
                        telefone: cleanPhone,
                    };
                }
            } catch (errGet) {
                ultimoErro = errGet.response?.data || errGet.message;
            }

            // Estratégia 2: POST para o endpoint da API SMSNET
            try {
                const postPayload = {
                    username: smsUser,
                    password: smsToken,
                    token: `${smsUser}:${smsToken}`,
                    u: smsUser,
                    p: smsToken,
                    number: cleanPhone,
                    to: cleanPhone,
                    msg: mensagem,
                    content: mensagem,
                };

                const urlPost = process.env.SMSNET_API_URL || "https://sistema.smsnet.com.br/api/sms/send";
                const response = await axios.post(urlPost, postPayload, {
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Basic ${Buffer.from(`${smsUser}:${smsToken}`).toString("base64")}`,
                    },
                    timeout: 8000,
                }).catch(async () => {
                    return await axios.post(urlPost, new URLSearchParams(postPayload).toString(), {
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        timeout: 8000,
                    });
                });

                if (response && (response.status === 200 || response.status === 201)) {
                    console.log(`[SMSNET] Mensagem enviada com sucesso para ${cleanPhone} via POST.`);
                    return {
                        sucesso: true,
                        metodo: "POST",
                        data: response.data,
                        telefone: cleanPhone,
                    };
                }
            } catch (errPost) {
                ultimoErro = errPost.response?.data || errPost.message;
            }

            return {
                sucesso: false,
                error: ultimoErro || "Falha na comunicação com a API da SMSNET.",
                telefone: cleanPhone,
            };
        } catch (error) {
            console.error("[SMSNET] Erro crítico no envio de SMS:", error.response?.data || error.message);
            return {
                sucesso: false,
                error: error.response?.data?.message || error.message,
                telefone,
            };
        }
    }
}

module.exports = SmsnetService;
