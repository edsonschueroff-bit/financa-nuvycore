const db = require("../../db");
const mercadopagoService = require("../services/mercadopagoService");

// Obter detalhes da assinatura atual e faturas da empresa logada
const obterMinhaAssinatura = async (req, res) => {
    try {
        const empresaId = req.user.empresa_id;

        if (!empresaId) {
            return res.status(400).json({ error: "Empresa não identificada." });
        }

        // Buscar dados da empresa e seu plano atual
        const [empRows] = await db.query(
            `SELECT e.id, e.nome, e.slug, e.email, e.status_saas, e.trial_ate, e.plano_saas_id, e.created_at,
              p.nome as plano_nome, p.descricao as plano_descricao, p.valor as plano_valor, p.valor_anual as plano_valor_anual,
              p.tipo_publico as plano_tipo_publico, p.recursos as plano_recursos,
              p.max_filiais, p.max_usuarios, p.max_transacoes_mes
       FROM empresas e
       LEFT JOIN saas_planos p ON p.id = e.plano_saas_id
       WHERE e.id = ?`,
            [empresaId]
        );

        if (!empRows.length) {
            return res.status(404).json({ error: "Empresa não encontrada." });
        }

        const empresa = empRows[0];
        if (empresa.plano_recursos && typeof empresa.plano_recursos === "string") {
            try {
                empresa.plano_recursos = JSON.parse(empresa.plano_recursos);
            } catch (e) {
                empresa.plano_recursos = {};
            }
        }

        // Buscar todas as faturas do tenant
        const [faturas] = await db.query(
            `SELECT f.*, p.nome as plano_nome 
       FROM saas_faturas f
       LEFT JOIN saas_planos p ON p.id = f.plano_id
       WHERE f.empresa_id = ?
       ORDER BY f.data_vencimento DESC, f.id DESC`,
            [empresaId]
        );

        // Buscar todos os planos disponíveis para upgrade/troca
        const [planosDisponiveis] = await db.query(
            `SELECT * FROM saas_planos ORDER BY tipo_publico ASC, valor ASC`
        );

        const planosFormatados = planosDisponiveis.map((p) => {
            let recursosParsed = {};
            if (p.recursos) {
                try {
                    recursosParsed = typeof p.recursos === "string" ? JSON.parse(p.recursos) : p.recursos;
                } catch (e) {
                    recursosParsed = {};
                }
            }
            return {
                ...p,
                recursos: recursosParsed,
            };
        });

        // Calcular dias restantes de trial se aplicável
        let diasTrialRestantes = 0;
        if (empresa.trial_ate) {
            const trialDate = new Date(empresa.trial_ate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            trialDate.setHours(0, 0, 0, 0);
            diasTrialRestantes = Math.max(0, Math.ceil((trialDate - today) / (1000 * 60 * 60 * 24)));
        }

        return res.json({
            empresa,
            diasTrialRestantes,
            faturas,
            planosDisponiveis: planosFormatados,
        });
    } catch (err) {
        console.error("Erro ao obter assinatura do tenant:", err);
        return res.status(500).json({ error: "Erro interno ao buscar dados da assinatura." });
    }
};

// Trocar de Plano e Gerar Fatura Pendente Imediata
const trocarPlano = async (req, res) => {
    try {
        const empresaId = req.user.empresa_id;
        const { plano_id, ciclo = "mensal" } = req.body;

        if (!empresaId) {
            return res.status(400).json({ error: "Empresa não identificada." });
        }

        if (!plano_id) {
            return res.status(400).json({ error: "Selecione um plano válido." });
        }

        // Buscar dados do plano selecionado
        const [planos] = await db.query(`SELECT * FROM saas_planos WHERE id = ?`, [plano_id]);
        if (!planos.length) {
            return res.status(404).json({ error: "Plano selecionado não existe." });
        }

        const plano = planos[0];

        // Atualizar a empresa com o novo plano e limites (se a empresa estivesse em trial, muda para status pendente se não for trial)
        await db.query(
            `UPDATE empresas 
       SET plano_saas_id = ?, limite_filiais = ?, limite_usuarios = ?,
           status_saas = IF(status_saas = 'trial', 'pendente', status_saas)
       WHERE id = ?`,
            [plano.id, plano.max_filiais, plano.max_usuarios, empresaId]
        );

        // 1. Verificar se já existe UMA fatura pendente para a empresa (Regra de Fatura Única)
        const [faturasPendentes] = await db.query(
            `SELECT * FROM saas_faturas 
              WHERE empresa_id = ? AND status = 'pendente' 
              ORDER BY id DESC LIMIT 1`,
            [empresaId]
        );

        let faturaId = null;
        let valorFatura = (ciclo === "anual" && plano.valor_anual) ? parseFloat(plano.valor_anual) : parseFloat(plano.valor);

        if (faturasPendentes.length > 0) {
            // Reutilizar a fatura pendente existente MANTENDO A DATA DE VENCIMENTO ORIGINAL
            const fPendente = faturasPendentes[0];
            faturaId = fPendente.id;

            await db.query(
                `UPDATE saas_faturas 
                 SET plano_id = ?, valor = ?, ciclo = ?, pix_copia_cola = NULL, pix_qr_code_url = NULL, gateway_transaction_id = NULL
                 WHERE id = ?`,
                [plano.id, valorFatura, ciclo, faturaId]
            );
        } else {
            // Verificar se já possui uma fatura PAGA recente para calcular valor proporcional
            const [faturasPagas] = await db.query(
                `SELECT * FROM saas_faturas 
                  WHERE empresa_id = ? AND status = 'pago' 
                  ORDER BY data_pagamento DESC LIMIT 1`,
                [empresaId]
            );

            if (faturasPagas.length > 0 && faturasPagas[0].data_pagamento) {
                const fatPaga = faturasPagas[0];
                const dataPag = new Date(fatPaga.data_pagamento);
                const hoje = new Date();
                const diffMs = hoje - dataPag;
                const diasUsados = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                const diasRestantes = Math.max(0, 30 - diasUsados);

                if (diasRestantes > 0 && plano.valor > fatPaga.valor) {
                    const valorNovoDiario = plano.valor / 30;
                    const valorAntigoDiario = fatPaga.valor / 30;
                    const valorProporcional = (valorNovoDiario - valorAntigoDiario) * diasRestantes;
                    valorFatura = Math.max(1, Math.round(valorProporcional * 100) / 100);
                }
            }

            // Criar nova fatura pendente com vencimento em 3 dias
            const dataVencimento = new Date();
            dataVencimento.setDate(dataVencimento.getDate() + 3);

            const [resIns] = await db.query(
                `INSERT INTO saas_faturas (empresa_id, plano_id, valor, ciclo, status, data_vencimento)
                 VALUES (?, ?, ?, ?, 'pendente', ?)`,
                [empresaId, plano.id, valorFatura, ciclo, dataVencimento.toISOString().split("T")[0]]
            );
            faturaId = resIns.insertId;
        }

        // Gerar a chave Pix automaticamente via Mercado Pago
        let pixData = null;
        try {
            const [empRows] = await db.query(`SELECT nome, email FROM empresas WHERE id = ?`, [empresaId]);
            const emp = empRows[0] || {};

            pixData = await mercadopagoService.gerarPixFatura({
                faturaId,
                valor: valorFatura,
                descricao: `Assinatura Nuvy Finance - Plano ${plano.nome}`,
                emailCliente: emp.email,
                nomeCliente: emp.nome,
            });

            // Salvar Pix gerado
            await db.query(
                `UPDATE saas_faturas 
                 SET pix_copia_cola = ?, pix_qr_code_url = ?, gateway = 'mercadopago', gateway_transaction_id = ?
                 WHERE id = ?`,
                [pixData.pixCopiaCola, pixData.pixQrCodeBase64, String(pixData.transactionId), faturaId]
            );
        } catch (ePix) {
            console.warn("Aviso ao gerar Pix no trocaPlano:", ePix.message);
        }

        return res.json({
            sucesso: true,
            message: `Plano alterado para ${plano.nome} com sucesso! Fatura #${faturaId} atualizada.`,
            fatura_id: faturaId,
            valor: valorFatura,
            pix_copia_cola: pixData?.pixCopiaCola || null,
            pix_qr_code_url: pixData?.pixQrCodeBase64 || null,
        });
    } catch (err) {
        console.error("Erro ao trocar plano do tenant:", err);
        return res.status(500).json({ error: "Erro interno ao atualizar plano." });
    }
};

module.exports = {
    obterMinhaAssinatura,
    trocarPlano,
};
