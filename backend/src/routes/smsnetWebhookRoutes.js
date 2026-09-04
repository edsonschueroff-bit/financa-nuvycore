const express = require("express");
const router = express.Router();
const db = require("../../db");
const { processarMensagemIA } = require("../controllers/integracaoWhatsappController");

// Handshake GET para validação automática da SMSNET
router.get("/", (req, res) => {
    return res.status(200).json({ status: "success", message: "SMSNET Webhook Endpoint Ativo" });
});

// Handshake MKAuth companies / company / status
router.all(["/companies", "/company", "/status", "/auth", "/v1/whatsapp/companies"], (req, res) => {
    console.log(`[SMSNET MKAUTH HANDSHAKE] ${req.method} ${req.path} recebido com sucesso!`);
    return res.status(200).json([
        {
            id: 1,
            uuid: "nuvy-finance-001",
            nome: "Nuvy Finance",
            razao_social: "Nuvy Finance",
            fantasia: "Nuvy Finance",
            cnpj: "00000000000000",
            status: "active",
            ativo: true,
            success: true
        }
    ]);
});

/**
 * Webhook SMSNET
 * Recebe POST (form_params ou json) da SMSNET quando o cliente responde ou envia mensagem
 * Parâmetros: number, content, datetime, from, text, msg
 */
router.post("/", async (req, res) => {
    try {
        const payload = { ...req.query, ...req.body };
        const number = payload.number || payload.from || payload.phone || payload.sender || payload.contato || "";
        const content = payload.content || payload.msg || payload.text || payload.message || payload.mensagem || "";
        const datetime = payload.datetime || new Date().toISOString();

        console.log(`[SMSNET WEBHOOK] Payload recebido:`, JSON.stringify(payload));
        console.log(`[SMSNET WEBHOOK] Mensagem de ${number}: "${content}" às ${datetime}`);

        if (!number || !content) {
            return res.status(200).json({ status: "success", message: "Webhook recebido sem mensagem ativa." });
        }

        const cleanPhone = String(number).replace(/\D/g, "");
        const searchPhone = cleanPhone.slice(-8);

        // 1. Buscar contato no sistema para auditoria
        const [contatos] = await db.query(
            `SELECT id, empresa_id, nome FROM contatos WHERE telefone LIKE ? OR telefone LIKE ? LIMIT 5`,
            [`%${searchPhone}%`, `%${cleanPhone}%`]
        );

        if (contatos.length > 0) {
            for (const contato of contatos) {
                await db.query(
                    `INSERT INTO auditoria_logs (empresa_id, usuario_id, acao, detalhes, ip)
                     VALUES (?, NULL, 'SMS_RESPOSTA_RECEBIDA', ?, '127.0.0.1')`,
                    [
                        contato.empresa_id,
                        JSON.stringify({
                            origem: "SMSNET_WEBHOOK",
                            contato_id: contato.id,
                            contato_nome: contato.nome,
                            telefone: number,
                            mensagem: content,
                            recebido_em: datetime,
                        }),
                    ]
                );
            }
        }

        // 2. Responder imediatamente 200 para a SMSNET não dar timeout
        res.status(200).json({ status: "success", message: "Mensagem recebida e encaminhada para processamento" });

        // 3. Processar mensagem com o Copiloto IA Cora de forma assíncrona
        const reqFake = {
            body: {
                telefone: cleanPhone,
                mensagem: content,
                pushName: contatos[0]?.nome || "Gestor",
            },
        };
        const resFake = {
            json: (data) => console.log(`[CORA IA RESPOSTA SMSNET] Enviada para ${cleanPhone}:`, data?.resposta || data?.mensagem),
            status: () => resFake,
        };

        processarMensagemIA(reqFake, resFake).catch((iaErr) => {
            console.error("[SMSNET IA] Erro ao processar mensagem com Cora:", iaErr);
        });

    } catch (err) {
        console.error("[SMSNET WEBHOOK] Erro ao processar webhook:", err);
        return res.status(500).json({ error: "Erro interno no webhook SMSNET" });
    }
});

// Endpoint de compatibilidade para Robô MKAuth / ReceitaNet / IXC
router.all(["/mkauth", "/receitanet", "/ixc", "/robo"], async (req, res) => {
    try {
        const payload = { ...req.query, ...req.body, ...req.headers };
        console.log(`[SMSNET ROBO INTEGRACAO] Chamada recebida (${req.method} ${req.path}):`, JSON.stringify(payload));

        const number = payload.number || payload.from || payload.phone || payload.celular || payload.telefone || payload.cpf || "";
        const content = payload.content || payload.msg || payload.text || payload.message || payload.texto || "";

        if (number && content) {
            const cleanPhone = String(number).replace(/\D/g, "");
            const reqFake = {
                body: {
                    telefone: cleanPhone,
                    mensagem: content,
                    pushName: "Cliente",
                },
            };
            const resFake = {
                json: (data) => console.log(`[CORA IA RESPOSTA ROBO] Enviada para ${cleanPhone}:`, data?.resposta || data?.mensagem),
                status: () => resFake,
            };

            processarMensagemIA(reqFake, resFake).catch((iaErr) => {
                console.error("[SMSNET ROBO IA] Erro ao processar:", iaErr);
            });
        }

        // Retornar resposta padrão compatível com MKAuth/ISPs
        return res.status(200).json({
            status: "success",
            sucesso: true,
            msg: "Processado com sucesso",
            dados: []
        });
    } catch (err) {
        console.error("[SMSNET ROBO] Erro no endpoint:", err);
        return res.status(200).json({ status: "success", msg: "OK" });
    }
});

module.exports = router;
