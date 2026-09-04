const db = require("../../db");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const { gerarPayloadPix } = require("../utils/pixHelper");
const { criarNotificacao } = require("./notificacaoController");
const { enviarMensagemTelegram } = require("../services/telegramService");
const { resolverOuCriarCategoria } = require("../services/categoriaResolver");

const EVOLUTION_URL = process.env.EVOLUTION_API_URL || "http://127.0.0.1:8080";
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY;
if (!EVOLUTION_KEY) {
  console.error("[SECURITY] EVOLUTION_API_KEY não está definida nas variáveis de ambiente! Funcionalidades WhatsApp serão desativadas.");
}
const INSTANCIA_PADRAO = process.env.EVOLUTION_INSTANCE || "fin_empresa_1";
const OPENAI_KEY = process.env.OPENAI_API_KEY;

// Função utilitária para enviar mensagem de texto via WhatsApp (Evolution API)
async function enviarTextoWhatsApp(numero, texto, instanceName = INSTANCIA_PADRAO) {
  try {
    let cleanNum = String(numero || "").replace(/\D/g, "");
    if (!cleanNum || cleanNum.length < 8) return;
    if (cleanNum.length === 10 || cleanNum.length === 11) {
      cleanNum = `55${cleanNum}`;
    }
    
    await axios.post(
      `${EVOLUTION_URL}/message/sendText/${instanceName}`,
      {
        number: cleanNum,
        text: texto,
      },
      {
        headers: {
          apikey: EVOLUTION_KEY,
          "Content-Type": "application/json",
        },
        timeout: 6000,
      }
    );
  } catch (err) {
    console.error(`[EVOLUTION API] Erro ao enviar mensagem para ${numero}:`, err.response?.data?.message || err.message);
  }
}

/**
 * Mapeia de forma resiliente termos, nomes de bancos e instituições financeiras para uma conta da empresa
 */
const identificarContaBancaria = (texto, contas) => {
  if (!contas || contas.length === 0) return null;
  if (!texto) return null;
  const str = String(texto).toLowerCase();

  for (const c of contas) {
    const nome = (c.nome || "").toLowerCase();
    const banco = (c.banco || "").toLowerCase();

    // Match direto em nome ou banco
    if (str.includes(nome) || (banco && str.includes(banco))) return c;

    // Aliases bancários brasileiros comuns
    if ((str.includes("nubank") || str.includes("nu ") || str.includes("nu_") || str.includes("nu pagamentos")) && (nome.includes("nu") || banco.includes("nu"))) return c;
    if (str.includes("bradesco") && (nome.includes("bradesco") || banco.includes("bradesco"))) return c;
    if (str.includes("itau") && (nome.includes("itau") || banco.includes("itau"))) return c;
    if (str.includes("inter") && (nome.includes("inter") || banco.includes("inter"))) return c;
    if ((str.includes("banco do brasil") || str.includes("bb")) && (nome.includes("brasil") || banco.includes("brasil") || nome.includes("bb"))) return c;
    if (str.includes("santander") && (nome.includes("santander") || banco.includes("santander"))) return c;
    if (str.includes("caixa") && (nome.includes("caixa") || banco.includes("caixa"))) return c;
    if (str.includes("sicredi") && (nome.includes("sicredi") || banco.includes("sicredi"))) return c;
    if (str.includes("sicoob") && (nome.includes("sicoob") || banco.includes("sicoob"))) return c;
    if (str.includes("mercado pago") && (nome.includes("mercado") || banco.includes("mercado"))) return c;
    if (str.includes("cora") && (nome.includes("cora") || banco.includes("cora"))) return c;
  }
  return null;
};

// Função utilitária para normalizar e encontrar usuário por telefone
async function encontrarAdminPorTelefone(telefoneBruto) {
  if (!telefoneBruto) return null;
  const clean = telefoneBruto.replace(/\D/g, "");
  if (!clean || clean.length < 8) return null;

  const ultimos8 = clean.slice(-8);

  const [admins] = await db.query(
    `SELECT a.id, a.nome, a.email, a.telefone, a.empresa_id, a.is_super,
            e.id as emp_id, e.nome as emp_nome, e.slug as emp_slug, e.status_saas, e.cnpj_cpf, e.email as emp_email
     FROM admins a
     JOIN empresas e ON e.id = a.empresa_id
     WHERE a.status = 'ativo' AND e.ativo = 1
       AND (
         REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(a.telefone, '(', ''), ')', ''), '-', ''), ' ', ''), '+', '') LIKE ?
         OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(e.telefone, '(', ''), ')', ''), '-', ''), ' ', ''), '+', '') LIKE ?
       )
     LIMIT 1`,
    [`%${ultimos8}%`, `%${ultimos8}%`]
  );

  if (admins.length > 0) {
    return admins[0];
  }
  return null;
}

// Obter Base64 de mídia diretamente da Evolution API caso não venha no webhook
async function obterBase64DeMidiaEvolution(messageData, instanceName = INSTANCIA_PADRAO) {
  try {
    if (messageData?.base64) return messageData.base64;
    if (messageData?.message?.audioMessage?.base64) return messageData.message.audioMessage.base64;
    if (messageData?.message?.imageMessage?.base64) return messageData.message.imageMessage.base64;

    const res = await axios.post(
      `${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${instanceName}`,
      {
        message: messageData,
        convertToMp4: false,
      },
      {
        headers: {
          apikey: EVOLUTION_KEY,
          "Content-Type": "application/json",
        },
        timeout: 20000,
      }
    );

    return res.data?.base64 || res.data?.media || null;
  } catch (err) {
    console.error("Erro ao buscar base64 de mídia na Evolution API:", err.response?.data || err.message);
    return null;
  }
}

// 1. Transcrição de Áudio com OpenAI Whisper
async function transcreverAudioWhisper(audioBuffer) {
  try {
    if (!OPENAI_KEY) {
      throw new Error("OPENAI_API_KEY não configurada no backend.");
    }
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: "audio/ogg" });
    formData.append("file", blob, "audio.ogg");
    formData.append("model", "whisper-1");
    formData.append("language", "pt");

    const response = await axios.post("https://api.openai.com/v1/audio/transcriptions", formData, {
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      timeout: 45000,
    });

    return response.data?.text || "";
  } catch (err) {
    console.error("Erro ao transcrever áudio com Whisper:", err.response?.data || err.message);
    throw err;
  }
}

// 2. OCR e Análise de Comprovantes com GPT-4o Vision
async function analisarComprovanteVision(imageBase64, legenda = "", admin, empresaId) {
  if (!OPENAI_KEY) {
    throw new Error("OPENAI_API_KEY não configurada no backend.");
  }

  // Buscar categorias e contas bancárias da empresa
  const [categorias] = await db.query(
    `SELECT id, nome, tipo FROM categorias_financeiras WHERE empresa_id = ? AND ativo = 1 ORDER BY nome ASC`,
    [empresaId]
  );
  const [contas] = await db.query(
    `SELECT id, nome, banco, saldo_atual FROM contas_bancarias WHERE empresa_id = ? AND ativo = 1`,
    [empresaId]
  );

  const cleanBase64 = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`;

  const promptSystem = `Você é um especialista em OCR e auditoria financeira de comprovantes bancários do Brasil (PIX, TED/DOC, boletos pagos, recibos, cupons fiscais e notas fiscais).
REGRA DE OURO ABSOLUTA DE CLASSIFICAÇÃO (RECEITA vs DESPESA):
1. RECEITA (Entrada de Dinheiro na conta do Titular/Empresa):
   - Se o Favorecido / Destinatário / Recebedor do Pix for a empresa ${admin.emp_nome} ou o titular ${admin.nome} (ou nome/CPF correspondente): É SEMPRE UMA RECEITA 🟢!
   - ATENÇÃO CRÍTICA: Muitas vezes o comprovante é um print do banco do cliente e diz 'Pix Enviado', 'Comprovante BB', 'Comprovante Santander' porque saiu da conta dele. Mas se quem RECEBEU foi o titular (${admin.nome}) ou a empresa (${admin.emp_nome}), para nós É OBRIGATORIAMENTE UMA RECEITA!
   - A conta bancária a ser associada é a conta da empresa correspondente ao banco de destino onde o dinheiro entrou (ex: Nubank / Nu Pagamentos).
   - O Pagador (cliente) é o contato principal.
2. DESPESA (Saída de Dinheiro da conta do Titular/Empresa):
   - Se o Pagador / Remetente for o titular (${admin.nome}) ou a empresa (${admin.emp_nome}): É UMA DESPESA 🔴.
   - A conta bancária a ser associada é a de onde o dinheiro saiu (banco de origem).
   - O Favorecido/Recebedor é o contato principal.
Analise a imagem com atenção máxima aos detalhes e extraia os dados para lançamento financeiro.

Categorias disponíveis da empresa:
${categorias.map(c => `- ID ${c.id}: ${c.nome} (${c.tipo})`).join("\n")}

Contas Bancárias da empresa:
${contas.map(c => `- ID ${c.id}: ${c.nome} (${c.banco})`).join("\n")}

REGRA CRÍTICA PARA CONTA BANCÁRIA (INSTITUIÇÃO FINANCEIRA):
- Olhe o cabeçalho, logotipo ou campos 'Instituição de Origem / Pagador' (se despesa) ou 'Instituição de Destino / Recebedor' (se receita).
- Identifique o banco do documento (ex: Nubank / Nu Pagamentos S.A., Bradesco, Itaú, Banco do Brasil, Inter, Santander, Caixa, Sicredi, Sicoob, etc.).
- Associe imediatamente ao ID e Nome da conta bancária correspondente da empresa acima.

REGRA CRÍTICA PARA IDENTIFICAÇÃO DE PARTES:
- 'pagador': Nome completo e CPF/CNPJ de quem realizou o pagamento.
- 'recebedor': Nome completo e CPF/CNPJ de quem recebeu o valor (Favorecido).
- Se for despesa da empresa: o contato principal é o recebedor. Se for receita: o contato principal é o pagador.

INSTRUÇÃO DE RESPOSTA:
Responda ESTRITAMENTE em formato JSON válido, sem qualquer texto ou formatação adicional fora do JSON:
{
  "sucesso": true,
  "tipo": "despesa" ou "receita",
  "descricao": "Descrição concisa e clara (ex: Almoço Restaurante XYZ, Pagamento Fornecedor ABC, PIX Recebido de Fulano)",
  "valor": 123.45,
  "data_pagamento": "YYYY-MM-DD",
  "data_vencimento": "YYYY-MM-DD",
  "pagador": "Nome completo de quem pagou",
  "recebedor": "Nome completo de quem recebeu",
  "beneficiario_ou_pagador": "Nome do contato principal",
  "banco_origem": "Nome do banco de onde saiu o dinheiro",
  "banco_destino": "Nome do banco para onde o dinheiro foi",
  "forma_pagamento": "pix" | "boleto" | "cartao_credito" | "cartao_debito" | "transferencia" | "dinheiro",
  "categoria_id": 10,
  "categoria_nome": "Nome da Categoria",
  "conta_id": 2,
  "conta_nome": "Nome exato da Conta Bancária correspondente",
  "documento_numero": "Código de autenticação, ID da transação PIX ou Nº do Cupom",
  "status": "pago",
  "resumo": "Explicação amigável em português do que foi identificado no comprovante."
}`;

  const openAiRes = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: promptSystem },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: legenda
                ? `Legenda enviada pelo usuário: "${legenda}". Extraia os dados do comprovante.`
                : "Extraia os dados deste comprovante para lançamento financeiro:",
            },
            {
              type: "image_url",
              image_url: { url: cleanBase64 },
            },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 1000,
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 35000,
    }
  );

  const rawContent = openAiRes.data?.choices?.[0]?.message?.content || "{}";
  const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Não foi possível interpretar o comprovante em formato estruturado.");
  }

  return JSON.parse(jsonMatch[0]);
}

// 3. Identificar Usuário e Retornar Contexto para o n8n/IA
const identificarUsuario = async (req, res) => {
  try {
    const { telefone } = req.body;
    if (!telefone) {
      return res.status(400).json({ error: "Telefone é obrigatório." });
    }

    const admin = await encontrarAdminPorTelefone(telefone);

    if (!admin) {
      return res.json({
        encontrado: false,
        error: "Nenhum usuário ou empresa encontrado com este número de WhatsApp.",
        mensagem_sugestao: "Olá! Não localizei seu número cadastrado na Nuvy Finance. Por favor, adicione seu telefone no perfil do sistema.",
      });
    }

    const empresaId = admin.empresa_id;

    // Buscar categorias ativas
    const [categorias] = await db.query(
      `SELECT id, nome, tipo, dre_grupo FROM categorias_financeiras WHERE empresa_id = ? AND ativo = 1 ORDER BY nome ASC`,
      [empresaId]
    );

    // Buscar contas bancárias ativas
    const [contas] = await db.query(
      `SELECT id, nome, banco, saldo_atual FROM contas_bancarias WHERE empresa_id = ? AND ativo = 1`,
      [empresaId]
    );

    // Buscar centros de custo
    const [centros] = await db.query(
      `SELECT id, nome FROM centros_custo WHERE empresa_id = ? AND ativo = 1`,
      [empresaId]
    );

    return res.json({
      encontrado: true,
      usuario: {
        id: admin.id,
        nome: admin.nome,
        email: admin.email,
        telefone: admin.telefone,
      },
      empresa: {
        id: admin.emp_id,
        nome: admin.emp_nome,
        slug: admin.emp_slug,
        status_saas: admin.status_saas,
        documento: admin.cnpj_cpf,
        chave_pix: admin.cnpj_cpf || admin.emp_email || "contato@nuvycore.online",
      },
      contas_bancarias: contas,
      categorias: categorias,
      centros_custo: centros,
    });
  } catch (err) {
    console.error("Erro ao identificar usuário por WhatsApp:", err);
    return res.status(500).json({ error: "Erro ao processar identificação do WhatsApp." });
  }
};

// 4. Lançar Transação via WhatsApp
const lancarTransacao = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const {
      telefone,
      admin_id,
      empresa_id: reqEmpresaId,
      tipo = "despesa",
      descricao,
      valor,
      categoria_id: reqCatId,
      categoria_nome,
      conta_bancaria_id: reqContaId,
      centro_custo_id,
      data_vencimento,
      data_pagamento,
      status = "pago",
      forma_pagamento = "pix",
      documento_numero,
      comprovante_url,
      observacoes,
    } = req.body;

    let admin = null;
    if (telefone) {
      admin = await encontrarAdminPorTelefone(telefone);
    }

    // SEGURANÇA: Verificar se o empresa_id do body corresponde ao admin encontrado pelo telefone.
    // Isso evita que qualquer sistema com a API Key lance transações em empresas arbitrárias.
    if (admin && reqEmpresaId && admin.empresa_id !== parseInt(reqEmpresaId, 10)) {
      await connection.rollback();
      console.warn(`[SECURITY] Tentativa de lançar transação em empresa ${reqEmpresaId} via telefone de admin da empresa ${admin.empresa_id}`);
      return res.status(403).json({ error: "Conflito de empresa: o telefone informado pertence a outra empresa." });
    }

    const finalAdminId = admin?.id || admin_id || 1;
    const finalEmpresaId = admin?.empresa_id || reqEmpresaId;

    if (!finalEmpresaId) {
      await connection.rollback();
      return res.status(400).json({ error: "Empresa não identificada." });
    }

    if (!descricao || !valor) {
      await connection.rollback();
      return res.status(400).json({ error: "Descrição e valor são obrigatórios." });
    }

    const valorFloat = Math.abs(parseFloat(valor));
    if (isNaN(valorFloat) || valorFloat <= 0) {
      await connection.rollback();
      return res.status(400).json({ error: "Valor numérico inválido." });
    }

    // Resolver Categoria
    let finalCategoriaId = reqCatId || null;
    let finalCategoriaNome = "Outros";

    if (!finalCategoriaId && categoria_nome) {
      const [catMatch] = await connection.query(
        `SELECT id, nome FROM categorias_financeiras WHERE empresa_id = ? AND tipo = ? AND nome LIKE ? LIMIT 1`,
        [finalEmpresaId, tipo, `%${categoria_nome.trim()}%`]
      );
      if (catMatch.length > 0) {
        finalCategoriaId = catMatch[0].id;
        finalCategoriaNome = catMatch[0].nome;
      }
    }

    if (!finalCategoriaId) {
      const [firstCat] = await connection.query(
        `SELECT id, nome FROM categorias_financeiras WHERE empresa_id = ? AND tipo = ? AND ativo = 1 LIMIT 1`,
        [finalEmpresaId, tipo]
      );
      if (firstCat.length > 0) {
        finalCategoriaId = firstCat[0].id;
        finalCategoriaNome = firstCat[0].nome;
      } else {
        const [newCat] = await connection.query(
          `INSERT INTO categorias_financeiras (empresa_id, nome, tipo, cor, dre_grupo) VALUES (?, ?, ?, '#10b981', 'outras_despesas')`,
          [finalEmpresaId, categoria_nome ? categoria_nome.trim() : "Geral", tipo]
        );
        finalCategoriaId = newCat.insertId;
        finalCategoriaNome = categoria_nome ? categoria_nome.trim() : "Geral";
      }
    }

    // Resolver Conta Bancária
    let finalContaId = reqContaId || null;
    let finalContaNome = "Caixa Geral";

    if (!finalContaId) {
      const [firstConta] = await connection.query(
        `SELECT id, nome FROM contas_bancarias WHERE empresa_id = ? AND ativo = 1 ORDER BY id ASC LIMIT 1`,
        [finalEmpresaId]
      );
      if (firstConta.length > 0) {
        finalContaId = firstConta[0].id;
        finalContaNome = firstConta[0].nome;
      }
    } else {
      const [contaInfo] = await connection.query(
        `SELECT id, nome FROM contas_bancarias WHERE id = ? AND empresa_id = ?`,
        [finalContaId, finalEmpresaId]
      );
      if (contaInfo.length > 0) {
        finalContaNome = contaInfo[0].nome;
      }
    }

    const hoje = new Date().toISOString().split("T")[0];
    const dataVenc = data_vencimento || hoje;
    const dataPag = status === "pago" ? (data_pagamento || hoje) : null;
    const valorPago = status === "pago" ? valorFloat : 0.0;

    const [result] = await connection.query(
      `INSERT INTO transacoes_financeiras (
        empresa_id, created_by, tipo, descricao, valor, valor_pago,
        data_competencia, data_vencimento, data_pagamento, status,
        categoria_id, conta_bancaria_id, centro_custo_id, forma_pagamento,
        documento_numero, comprovante_url, observacoes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        finalEmpresaId,
        finalAdminId,
        tipo,
        descricao.trim(),
        valorFloat,
        valorPago,
        hoje,
        dataVenc,
        dataPag,
        status,
        finalCategoriaId,
        finalContaId,
        centro_custo_id || null,
        forma_pagamento,
        documento_numero || null,
        comprovante_url || null,
        observacoes || (telefone ? `Lançado via WhatsApp (${telefone})` : "Lançamento via Copiloto IA"),
      ]
    );

    const transacaoId = result.insertId;

    if (status === "pago" && finalContaId) {
      if (tipo === "receita") {
        await connection.query(
          `UPDATE contas_bancarias SET saldo_atual = saldo_atual + ? WHERE id = ?`,
          [valorFloat, finalContaId]
        );
      } else {
        await connection.query(
          `UPDATE contas_bancarias SET saldo_atual = saldo_atual - ? WHERE id = ?`,
          [valorFloat, finalContaId]
        );
      }
    }

    await connection.commit();

    // Notificação persistente no sistema
    await criarNotificacao({
      empresa_id: finalEmpresaId,
      usuario_id: finalAdminId,
      titulo: tipo === "receita" ? "Receita lançada via WhatsApp" : "Despesa lançada via WhatsApp",
      mensagem: `${descricao.trim()} - R$ ${valorFloat.toFixed(2)}${comprovante_url ? " (com comprovante anexado)" : ""}`,
      tipo: "whatsapp",
      link: tipo === "receita" ? "/admin/contas-receber" : "/admin/contas-pagar",
    });

    return res.status(201).json({
      sucesso: true,
      mensagem: `${tipo === "receita" ? "Receita" : "Despesa"} de R$ ${valorFloat.toFixed(2)} lançada com sucesso!`,
      transacao: {
        id: transacaoId,
        tipo,
        descricao,
        valor: valorFloat,
        valor_pago: valorPago,
        categoria_nome: finalCategoriaNome,
        conta_nome: finalContaNome,
        status,
      },
    });
  } catch (err) {
    await connection.rollback();
    console.error("Erro ao lançar transação via WhatsApp:", err);
    return res.status(500).json({ error: "Erro ao registrar transação financeira via WhatsApp." });
  } finally {
    connection.release();
  }
};

// 5. Resumo Diário para o WhatsApp
const resumoDia = async (req, res) => {
  try {
    const { telefone, empresa_id } = req.query;

    let admin = null;
    if (telefone) {
      admin = await encontrarAdminPorTelefone(telefone);
    }

    const empId = admin?.empresa_id || empresa_id;
    if (!empId) {
      return res.status(400).json({ error: "Empresa ou telefone não informado." });
    }

    const [contas] = await db.query(
      `SELECT nome, banco, saldo_atual FROM contas_bancarias WHERE empresa_id = ? AND ativo = 1`,
      [empId]
    );
    const saldoConsolidado = contas.reduce((acc, c) => acc + parseFloat(c.saldo_atual || 0), 0);

    const [vencendoHoje] = await db.query(
      `SELECT t.id, t.tipo, t.descricao, t.valor, c.nome as contato_nome 
       FROM transacoes_financeiras t
       LEFT JOIN contatos c ON c.id = t.contato_id
       WHERE t.empresa_id = ? AND t.status = 'pendente' AND t.data_vencimento = CURDATE()`,
      [empId]
    );

    const [emAtraso] = await db.query(
      `SELECT t.id, t.tipo, t.descricao, t.valor, t.data_vencimento
       FROM transacoes_financeiras t
       WHERE t.empresa_id = ? AND t.status = 'pendente' AND t.data_vencimento < CURDATE()`,
      [empId]
    );

    const formatBRL = (v) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

    return res.json({
      data_hoje: new Date().toLocaleDateString("pt-BR"),
      saldo_consolidado: saldoConsolidado,
      saldo_consolidado_formatado: formatBRL(saldoConsolidado),
      contas: contas.map((c) => ({ nome: c.nome, banco: c.banco, saldo: formatBRL(c.saldo_atual) })),
      contas_vencendo_hoje: vencendoHoje.map((v) => ({
        tipo: v.tipo,
        descricao: v.descricao,
        valor: formatBRL(v.valor),
        contato: v.contato_nome || "—",
      })),
      total_vencendo_hoje_despesas: vencendoHoje
        .filter((v) => v.tipo === "despesa")
        .reduce((acc, v) => acc + parseFloat(v.valor), 0),
      total_vencendo_hoje_receitas: vencendoHoje
        .filter((v) => v.tipo === "receita")
        .reduce((acc, v) => acc + parseFloat(v.valor), 0),
      quantidade_em_atraso: emAtraso.length,
    });
  } catch (err) {
    console.error("Erro ao gerar resumo do dia:", err);
    return res.status(500).json({ error: "Erro ao gerar resumo diário." });
  }
};

// 6. Consulta de DRE Resumido para o WhatsApp
const consultarDreResumo = async (req, res) => {
  try {
    const { telefone, empresa_id } = req.query;

    let admin = null;
    if (telefone) {
      admin = await encontrarAdminPorTelefone(telefone);
    }

    const empId = admin?.empresa_id || empresa_id;
    if (!empId) {
      return res.status(400).json({ error: "Empresa ou telefone não informado." });
    }

    const [dre] = await db.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'receita' AND status = 'pago' THEN valor_pago ELSE 0 END), 0) as receita_liquida,
        COALESCE(SUM(CASE WHEN tipo = 'despesa' AND status = 'pago' THEN valor_pago ELSE 0 END), 0) as despesas_totais
       FROM transacoes_financeiras
       WHERE empresa_id = ? AND MONTH(data_competencia) = MONTH(CURRENT_DATE()) AND YEAR(data_competencia) = YEAR(CURRENT_DATE())`,
      [empId]
    );

    const rec = parseFloat(dre[0]?.receita_liquida || 0);
    const desp = parseFloat(dre[0]?.despesas_totais || 0);
    const lucro = rec - desp;
    const margem = rec > 0 ? ((lucro / rec) * 100).toFixed(1) : "0.0";

    const formatBRL = (v) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

    return res.json({
      periodo: "Mês Atual",
      receita_liquida: formatBRL(rec),
      despesas_totais: formatBRL(desp),
      lucro_liquido: formatBRL(lucro),
      is_lucro_positivo: lucro >= 0,
      margem_pct: `${margem}%`,
    });
  } catch (err) {
    console.error("Erro ao consultar DRE via WhatsApp:", err);
    return res.status(500).json({ error: "Erro ao consultar DRE." });
  }
};

// 7. Copiloto IA Conversacional Humano (GPT-4o-mini com Ações)
const processarMensagemIA = async (req, res) => {
  try {
    let { telefone, mensagem, pushName, instance = INSTANCIA_PADRAO } = req.body;

    // Se for payload nativo da Evolution API (MESSAGES_UPSERT)
    if (!mensagem && req.body.data) {
      const evoData = req.body.data;
      const key = evoData.key || {};
      
      // Ignora mensagens enviadas pelo próprio bot/número conectado
      if (key.fromMe) {
        return res.json({ sucesso: true, mensagem: "Mensagem enviada por mim ignorada." });
      }

      const remoteJid = String(key.remoteJid || "");
      if (remoteJid.includes("@g.us") || remoteJid.includes("@broadcast")) {
        return res.json({ sucesso: true, mensagem: "Mensagem de grupo/status ignorada." });
      }

      telefone = remoteJid.split("@")[0];
      pushName = evoData.pushName || pushName;
      instance = req.body.instance || instance;

      const msgObj = evoData.message || {};
      mensagem = msgObj.conversation ||
        msgObj.extendedTextMessage?.text ||
        msgObj.imageMessage?.caption ||
        msgObj.videoMessage?.caption ||
        msgObj.documentMessage?.caption ||
        "";
    }

    if (!telefone || !mensagem) {
      return res.status(200).json({ status: "ignored", message: "Nenhum texto de mensagem processável ou telefone ausente." });
    }

    const rawTel = String(telefone || "");
    if (rawTel.includes("@g.us") || rawTel.includes("-") || req.body.message_data?.key?.participant) {
      return res.json({ sucesso: true, mensagem: "Mensagem de grupo ignorada." });
    }

    const cleanNum = telefone.replace(/\D/g, "");
    if (cleanNum.length > 15) {
      return res.json({ sucesso: true, mensagem: "Mensagem de grupo ignorada." });
    }

    // Se for mensagem enviada pelo proprio bot via API/n8n para o cliente, ignora para nao dar loop
    const isFromMe = req.body.fromMe === true ||
      req.body.key?.fromMe === true ||
      req.body.message_data?.key?.fromMe === true ||
      req.body.message_data?.fromMe === true ||
      req.body.data?.key?.fromMe === true ||
      req.body.data?.fromMe === true;

    if (isFromMe) {
      return res.json({ sucesso: true, mensagem: "Mensagem enviada pelo próprio bot (fromMe=true) ignorada." });
    }

    const msgLimpaComando = (mensagem || "").trim().toLowerCase();
    console.log(`[WHATSAPP WEBHOOK] Mensagem recebida de ${cleanNum} | msg=${msgLimpaComando}`);

    // 3. Buscar Administrador vinculado ao número do WhatsApp
    const admin = await encontrarAdminPorTelefone(cleanNum);

    if (!admin) {
      const respNaoCadastrado = `Olá${pushName ? ` ${pushName}` : ""}! 🤖 Sou o Copiloto da Nuvy Finance.\n\nAinda não localizei o seu número (${cleanNum}) vinculado a uma empresa no sistema. Por favor, adicione o seu telefone no seu perfil em *financas.nuvycore.online* para conversarmos!`;
      await enviarTextoWhatsApp(cleanNum, respNaoCadastrado, instance);
      return res.json({ sucesso: true, resposta: respNaoCadastrado });
    }

    const empresaId = admin.empresa_id;

    // Detecção rápida de solicitação de recuperação de senha pelo WhatsApp
    const isPedidoResetSenha = /(esqueci|recuperar|redefinir|mudar|trocar|resetar).*(senha|acesso|login)|^senha$|^esqueci a senha$/i.test(msgLimpaComando);
    if (isPedidoResetSenha) {
      try {
        const crypto = require("crypto");
        const token = crypto.randomBytes(32).toString("hex");
        const codigo6 = Math.floor(100000 + Math.random() * 900000).toString();
        const expiraEm = new Date(Date.now() + 30 * 60 * 1000);

        await db.query(`UPDATE password_resets SET usado = 1 WHERE admin_id = ? AND usado = 0`, [admin.id]);
        await db.query(
          `INSERT INTO password_resets (admin_id, email, token, codigo_6_digitos, expira_em) VALUES (?, ?, ?, ?, ?)`,
          [admin.id, admin.email, token, codigo6, expiraEm]
        );

        const appUrl = process.env.APP_URL || "https://financas.nuvycore.online";
        const resetLink = `${appUrl}/redefinir-senha?token=${token}`;

        const respResetWA = `🔐 *[Nuvy Finance] Recuperação de Senha*\n\n` +
          `Olá, *${admin.nome}*! Identifiquei sua conta.\n\n` +
          `🔑 *Seu Código de 6 Dígitos:* \`${codigo6}\`\n\n` +
          `Ou clique no link direto para definir uma nova senha agora mesmo:\n` +
          `👉 ${resetLink}\n\n` +
          `_O link e o código são válidos por 30 minutos._ 😊`;

        await enviarTextoWhatsApp(cleanNum, respResetWA, instance);
        return res.json({ sucesso: true, resposta: respResetWA });
      } catch (errReset) {
        console.error("[WA RESET PASS ERROR]:", errReset.message);
      }
    }

    // Registra a mensagem enviada pelo usuário no histórico de conversas
    try {
      await db.query(
        `INSERT INTO whatsapp_mensagens_historico (empresa_id, admin_id, telefone, papel, conteudo) VALUES (?, ?, ?, 'user', ?)`,
        [empresaId, admin.id, cleanNum, mensagem]
      );
    } catch (hErr) {
      console.error("Erro ao registrar histórico da mensagem do usuário:", hErr);
    }

    // 1. Verificar se existe um rascunho de confirmação pendente para este usuário (últimos 30 minutos)
    const [rascunhos] = await db.query(
      `SELECT * FROM whatsapp_ia_rascunhos 
       WHERE (admin_id = ? OR telefone LIKE ?) 
         AND TIMESTAMPDIFF(MINUTE, updated_at, NOW()) <= 30
       ORDER BY id DESC LIMIT 1`,
      [admin.id, `%${cleanNum.slice(-8)}%`]
    );

    const rascunhoAtivo = rascunhos.length > 0 ? rascunhos[0] : null;
    const msgLimpa = mensagem.trim().toLowerCase();

    // Verificação de resposta afirmativa direta
    const isAfirmativa = /^(sim|s|ok|confirmar|confirma|confirmo|pode|pode lançar|pode lancar|pode salvar|salva|salvar|gravar|positivo|isso|beleza|show|correto|exato|sim pode|pode sim)$/i.test(msgLimpa);
    // [FIX BUG 1] 'não/nao/n' removidos do regex de cancelamento: são ambíguos.
    // Ex: "Não, o valor está errado" não deve cancelar o rascunho.
    // Só palavras de cancelamento explícito encerram o rascunho.
    const isNegativa = /^(cancelar|cancela|cancelo|esquece|abortar|deixa pra lá|deixa pra la|nao quero|não quero)$/i.test(msgLimpa);

    // SE TEM RASCUNHO ATIVO E USUÁRIO RESPONDEU SIM
    if (rascunhoAtivo && isAfirmativa) {
      let dados = {};
      try {
        dados = typeof rascunhoAtivo.dados_json === "string" ? JSON.parse(rascunhoAtivo.dados_json) : rascunhoAtivo.dados_json;
      } catch (e) {
        dados = {};
      }

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        // ── FLUXO DE EXCLUSÃO DEFINITIVA NO WHATSAPP ──
        if (dados.acao === "excluir_transacao" || dados.acao === "delete_transaction" || dados.acao === "delete_entry") {
          const transacaoIdDel = dados.transacao_id;
          const [tRows] = await connection.query(
            `SELECT * FROM transacoes_financeiras WHERE id = ? AND empresa_id = ? FOR UPDATE`,
            [transacaoIdDel, empresaId]
          );

          if (tRows.length === 0) {
            await connection.rollback();
            connection.release();
            await db.query(`DELETE FROM whatsapp_ia_rascunhos WHERE id = ?`, [rascunhoAtivo.id]);
            const msgErroId = `⚠️ Não encontrei o lançamento #${transacaoIdDel} para excluir. Pode ser que ele já tenha sido removido.`;
            await enviarTextoWhatsApp(cleanNum, msgErroId, instance);
            return res.json({ sucesso: false, resposta: msgErroId });
          }

          const t = tRows[0];
          // Se a transação estiver paga, estornar o saldo bancário da conta
          if (t.status === "pago" && t.conta_bancaria_id) {
            const vPago = parseFloat(t.valor_pago || t.valor || 0);
            if (vPago > 0) {
              const deltaReverso = t.tipo === "receita" ? -vPago : vPago;
              await connection.query(
                `UPDATE contas_bancarias SET saldo_atual = saldo_atual + ? WHERE id = ? AND empresa_id = ?`,
                [deltaReverso, t.conta_bancaria_id, empresaId]
              );
            }
          }

          await connection.query(`DELETE FROM transacoes_financeiras WHERE id = ? AND empresa_id = ?`, [t.id, empresaId]);
          await connection.query(`DELETE FROM whatsapp_ia_rascunhos WHERE id = ?`, [rascunhoAtivo.id]);
          await connection.commit();

          const formatBRL = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
          const respExcluido = `🗑️ *Lançamento excluído com sucesso!*\n\n` +
            `• *Tipo:* ${t.tipo === 'receita' ? 'Receita 🟢' : 'Despesa 🔴'}\n` +
            `• *Descrição:* *${t.descricao}*\n` +
            `• *Valor:* *${formatBRL(t.valor)}*\n\n` +
            `_O registro foi removido e os saldos bancários foram recalculados!_ ✨`;

          await enviarTextoWhatsApp(cleanNum, respExcluido, instance);
          try {
            await db.query(`INSERT INTO whatsapp_mensagens_historico (empresa_id, admin_id, telefone, papel, conteudo) VALUES (?, ?, ?, 'assistant', ?)`, [empresaId, admin.id, cleanNum, respExcluido]);
          } catch (e) { }
          return res.json({ sucesso: true, resposta: respExcluido });
        }

        // SE FOR UMA AÇÃO DE EDIÇÃO / ALTERAÇÃO DE TRANSAÇÃO EXISTENTE
        if (dados.transacao_id || dados.acao === "editar_transacao") {
          const transacaoIdEdit = dados.transacao_id;

          // [FIX BUG 2] Validar que o ID realmente existe antes de executar UPDATE
          const [checkExiste] = await connection.query(
            `SELECT id, descricao, valor, status FROM transacoes_financeiras WHERE id = ? AND empresa_id = ?`,
            [transacaoIdEdit, empresaId]
          );
          if (checkExiste.length === 0) {
            // ID não existe no banco (pode ser ID extraído de histórico incorretamente)
            await connection.rollback();
            connection.release();
            await db.query(`DELETE FROM whatsapp_ia_rascunhos WHERE id = ?`, [rascunhoAtivo.id]);
            const msgErroId = `⚠️ Não encontrei o lançamento #${transacaoIdEdit} para atualizar. Pode ser que ele não exista ou já foi excluído.\n\nSe quiser, me diga novamente o que precisa registrar e farão um novo lançamento! 😊`;
            await enviarTextoWhatsApp(cleanNum, msgErroId, instance);
            try {
              await db.query(`INSERT INTO whatsapp_mensagens_historico (empresa_id, admin_id, telefone, papel, conteudo) VALUES (?, ?, ?, 'assistant', ?)`, [empresaId, admin.id, cleanNum, msgErroId]);
            } catch (e) { }
            console.warn(`[WHATSAPP] transacao_id=${transacaoIdEdit} não encontrado. Rascunho descartado.`);
            return res.json({ sucesso: false, resposta: msgErroId });
          }

          const novaDataVenc = dados.data_vencimento;
          const novoValorFloat = dados.valor ? Math.abs(parseFloat(dados.valor)) : null;
          const novaDescricao = dados.descricao;
          const novoStatus = dados.status;

          const updateCols = [];
          const updateVals = [];

          if (novaDataVenc) { updateCols.push("data_vencimento = ?"); updateVals.push(novaDataVenc); }
          if (novoValorFloat) { updateCols.push("valor = ?"); updateVals.push(novoValorFloat); }
          if (novaDescricao) { updateCols.push("descricao = ?"); updateVals.push(novaDescricao); }
          if (novoStatus) {
            updateCols.push("status = ?");
            updateVals.push(novoStatus);
            if (novoStatus === "pago") {
              const hojeStr = new Date().toISOString().split("T")[0];
              updateCols.push("data_pagamento = ?");
              updateVals.push(hojeStr);
              if (novoValorFloat) {
                updateCols.push("valor_pago = ?");
                updateVals.push(novoValorFloat);
              } else {
                updateCols.push("valor_pago = valor");
              }
            } else if (novoStatus === "pendente") {
              updateCols.push("data_pagamento = NULL");
              updateCols.push("valor_pago = 0.00");
            }
          }

          if (updateCols.length > 0) {
            updateVals.push(transacaoIdEdit, empresaId);
            await connection.query(
              `UPDATE transacoes_financeiras SET ${updateCols.join(", ")} WHERE id = ? AND empresa_id = ?`,
              updateVals
            );
          }

          // Limpar rascunho
          await connection.query(`DELETE FROM whatsapp_ia_rascunhos WHERE id = ?`, [rascunhoAtivo.id]);
          await connection.commit();

          const dataVencFormatada = novaDataVenc ? new Date(novaDataVenc + "T00:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "Mantida";
          const formatBRL = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

          const respEditado = `✅ *Lançamento alterado com sucesso!*\n\n` +
            `• *Descrição:* *${novaDescricao || 'Mantida'}*\n` +
            (novoValorFloat ? `• *Valor:* *${formatBRL(novoValorFloat)}*\n` : "") +
            `• *Data de Vencimento:* *${dataVencFormatada}*\n` +
            `\n_Alteração salva no seu painel Nuvy Finance!_`;

          await enviarTextoWhatsApp(cleanNum, respEditado, instance);

          try {
            await db.query(
              `INSERT INTO whatsapp_mensagens_historico (empresa_id, admin_id, telefone, papel, conteudo) VALUES (?, ?, ?, 'assistant', ?)`,
              [empresaId, admin.id, cleanNum, respEditado]
            );
          } catch (e) { }

          return res.json({ sucesso: true, resposta: respEditado });
        }

        // SE FOR NOVO LANÇAMENTO (INSERÇÃO)
        const valorFloat = Math.abs(parseFloat(dados.valor || 0));
        const tipo = dados.tipo === "receita" ? "receita" : "despesa";
        const descricaoBase = dados.descricao || "Lançamento via WhatsApp";
        const hojeStr = new Date().toISOString().split("T")[0];
        const dataVencBase = dados.data_vencimento || hojeStr;
        const status = dados.status || (dataVencBase > hojeStr ? "pendente" : "pago");
        const catId = dados.categoria_id || null;
        const contaId = dados.conta_id || null;
        const totalParcelas = parseInt(dados.total_parcelas, 10) || 1;

        for (let p = 1; p <= totalParcelas; p++) {
          const [dateRow] = await connection.query(
            `SELECT DATE_ADD(?, INTERVAL ? MONTH) as venc_p`,
            [dataVencBase, p - 1]
          );
          const rawDate = dateRow[0].venc_p;
          const dataVencParcela = rawDate instanceof Date ? rawDate.toISOString().split("T")[0] : String(rawDate).split("T")[0];
          const descParcela = totalParcelas > 1 ? `${descricaoBase} (${p}/${totalParcelas})` : descricaoBase;
          const statusParcela = p === 1 ? status : "pendente";
          const dataPagParcela = statusParcela === "pago" ? hojeStr : null;
          const valorPagoParcela = statusParcela === "pago" ? valorFloat : 0.0;

          await connection.query(
            `INSERT INTO transacoes_financeiras (
              empresa_id, created_by, tipo, descricao, valor, valor_pago,
              data_competencia, data_vencimento, data_pagamento, status,
              categoria_id, conta_bancaria_id, forma_pagamento, comprovante_url, observacoes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pix', ?, ?)`,
            [
              empresaId,
              admin.id,
              tipo,
              descParcela,
              valorFloat,
              valorPagoParcela,
              dataVencParcela,
              dataVencParcela,
              dataPagParcela,
              statusParcela,
              catId,
              contaId,
              dados.comprovante_url || null,
              `Confirmado e lançado via Copiloto IA WhatsApp (${cleanNum})`
            ]
          );

          if (p === 1 && statusParcela === "pago" && contaId) {
            if (tipo === "receita") {
              await connection.query(`UPDATE contas_bancarias SET saldo_atual = saldo_atual + ? WHERE id = ?`, [valorFloat, contaId]);
            } else {
              await connection.query(`UPDATE contas_bancarias SET saldo_atual = saldo_atual - ? WHERE id = ?`, [valorFloat, contaId]);
            }
          }
        }

        // Limpar rascunho
        await connection.query(`DELETE FROM whatsapp_ia_rascunhos WHERE id = ?`, [rascunhoAtivo.id]);
        await connection.commit();

        const dataVencFormatada = new Date(dataVencBase + "T00:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" });
        const formatBRL = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

        const respConfirmado = `✅ *Lançamento confirmado e registrado com sucesso!*\n\n` +
          `• *Tipo:* ${tipo === 'receita' ? '📥 Receita (A Receber)' : '📤 Despesa (A Pagar)'}\n` +
          `• *Descrição:* *${descricaoBase}*${totalParcelas > 1 ? ` (${totalParcelas} parcelas mensais)` : ''}\n` +
          `• *Valor:* *${formatBRL(valorFloat)}*${totalParcelas > 1 ? ' /mês' : ''}\n` +
          `• *1º Vencimento:* *${dataVencFormatada}*\n` +
          `• *Status:* ${status === 'pago' ? '🟢 Pago' : '🟡 Pendente (Agendado)'}\n` +
          (dados.conta_nome ? `• *Conta:* ${dados.conta_nome}\n` : "") +
          (dados.categoria_nome ? `• *Categoria:* ${dados.categoria_nome}\n` : "") +
          `\n_Já está disponível no seu painel Nuvy Finance!_`;

        await enviarTextoWhatsApp(cleanNum, respConfirmado, instance);

        try {
          await db.query(
            `INSERT INTO whatsapp_mensagens_historico (empresa_id, admin_id, telefone, papel, conteudo) VALUES (?, ?, ?, 'assistant', ?)`,
            [empresaId, admin.id, cleanNum, respConfirmado]
          );
        } catch (e) { }

        return res.json({ sucesso: true, resposta: respConfirmado });
      } catch (dbErr) {
        await connection.rollback();
        console.error("Erro ao efetivar lançamento do rascunho:", dbErr);
        return res.status(500).json({ error: "Erro ao registrar transação no banco." });
      } finally {
        connection.release();
      }
    }

    // SE TEM RASCUNHO ATIVO E USUÁRIO RESPONDEU NÃO / CANCELAR
    if (rascunhoAtivo && isNegativa) {
      let dadosR = {};
      try {
        dadosR = typeof rascunhoAtivo.dados_json === "string" ? JSON.parse(rascunhoAtivo.dados_json) : rascunhoAtivo.dados_json;
      } catch (e) { }

      await db.query(`DELETE FROM whatsapp_ia_rascunhos WHERE id = ?`, [rascunhoAtivo.id]);
      const respCancelado = (dadosR.acao === "excluir_transacao" || dadosR.acao === "delete_transaction" || dadosR.acao === "delete_entry")
        ? `👍 *Entendido! A exclusão foi cancelada e o lançamento foi mantido intacto.*`
        : `❌ *Entendido! O lançamento foi cancelado.* Nenhum registro foi feito no sistema.`;

      await enviarTextoWhatsApp(cleanNum, respCancelado, instance);

      try {
        await db.query(
          `INSERT INTO whatsapp_mensagens_historico (empresa_id, admin_id, telefone, papel, conteudo) VALUES (?, ?, ?, 'assistant', ?)`,
          [empresaId, admin.id, cleanNum, respCancelado]
        );
      } catch (e) { }

      return res.json({ sucesso: true, resposta: respCancelado });
    }

    // ── INTERCEPTADOR DIRETO: PEDIDO DE EXCLUSÃO NO WHATSAPP ──
    const matchExclusaoDiretaZap = msgLimpa.match(/(?:quero que voc[eê]\s+)?(?:exclui[ar]?|apaga[ar]?|delet[ar]?|remover?)\s*(.*)/i);
    if (!rascunhoAtivo && matchExclusaoDiretaZap) {
      const termoAlvo = (matchExclusaoDiretaZap[1] || "").trim();
      let transacaoAlvo = null;
      const isReferenciaRecente = !termoAlvo || /^(ela|ele|isso|esse|essa|este|esta|o lançamento|a despesa|a receita|o último|o ultimo|a última|a ultima)$/i.test(termoAlvo);

      if (isReferenciaRecente) {
        const [tUltima] = await db.query(
          `SELECT t.*, cat.nome as categoria_nome, c.nome as contato_nome
           FROM transacoes_financeiras t
           LEFT JOIN categorias_financeiras cat ON cat.id = t.categoria_id
           LEFT JOIN contatos c ON c.id = t.contato_id
           WHERE t.empresa_id = ?
           ORDER BY t.id DESC LIMIT 1`,
          [empresaId]
        );
        if (tUltima.length > 0) transacaoAlvo = tUltima[0];
      } else {
        const matchNum = termoAlvo.match(/(\d+)/);
        if (matchNum) {
          const idNum = parseInt(matchNum[1], 10);
          const [tPorId] = await db.query(
            `SELECT t.*, cat.nome as categoria_nome, c.nome as contato_nome
             FROM transacoes_financeiras t
             LEFT JOIN categorias_financeiras cat ON cat.id = t.categoria_id
             LEFT JOIN contatos c ON c.id = t.contato_id
             WHERE t.id = ? AND t.empresa_id = ?`,
            [idNum, empresaId]
          );
          if (tPorId.length > 0) transacaoAlvo = tPorId[0];
        }

        if (!transacaoAlvo) {
          const termoLimpo = termoAlvo.replace(/^(a\s+|o\s+|de\s+|da\s+|do\s+)/i, "").trim();
          const [tPorTermo] = await db.query(
            `SELECT t.*, cat.nome as categoria_nome, c.nome as contato_nome
             FROM transacoes_financeiras t
             LEFT JOIN categorias_financeiras cat ON cat.id = t.categoria_id
             LEFT JOIN contatos c ON c.id = t.contato_id
             WHERE t.empresa_id = ? AND (t.descricao LIKE ? OR cat.nome LIKE ? OR c.nome LIKE ?)
             ORDER BY t.id DESC LIMIT 1`,
            [empresaId, `%${termoLimpo}%`, `%${termoLimpo}%`, `%${termoLimpo}%`]
          );
          if (tPorTermo.length > 0) transacaoAlvo = tPorTermo[0];
        }
      }

      if (transacaoAlvo) {
        const dadosRascunho = {
          acao: "delete_transaction",
          pronto_para_salvar: true,
          transacao_id: transacaoAlvo.id,
          tipo: transacaoAlvo.tipo,
          descricao: transacaoAlvo.descricao,
          valor: parseFloat(transacaoAlvo.valor_pago || transacaoAlvo.valor || 0),
          data_vencimento: transacaoAlvo.data_vencimento,
          categoria_nome: transacaoAlvo.categoria_nome || "Geral",
          contato_nome: transacaoAlvo.contato_nome || null,
          status: transacaoAlvo.status,
          conta_bancaria_id: transacaoAlvo.conta_bancaria_id,
        };

        await db.query(
          `INSERT INTO whatsapp_ia_rascunhos (empresa_id, admin_id, telefone, tipo_acao, dados_json)
           VALUES (?, ?, ?, 'excluir_transacao', ?)
           ON DUPLICATE KEY UPDATE dados_json = VALUES(dados_json), updated_at = NOW()`,
          [empresaId, admin.id, cleanNum, JSON.stringify(dadosRascunho)]
        );

        const formatBRL = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
        const dataFmt = new Date((transacaoAlvo.data_vencimento ? new Date(transacaoAlvo.data_vencimento).toISOString().split("T")[0] : hojeIso) + "T00:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" });
        const statusTxt = transacaoAlvo.status === "pago"
          ? (transacaoAlvo.tipo === "receita" ? "Recebido ✅" : "Pago ✅")
          : "Pendente ⏰";

        const textoProposta = `🗑️ *Confirmar exclusão deste lançamento?*\n\n` +
          `• *Tipo:* ${transacaoAlvo.tipo === 'receita' ? 'Receita 🟢' : 'Despesa 🔴'}\n` +
          `• *Descrição:* ${transacaoAlvo.descricao}\n` +
          `• *Valor:* ${formatBRL(transacaoAlvo.valor)}\n` +
          `• *Data:* ${dataFmt}\n` +
          `• *Categoria:* ${transacaoAlvo.categoria_nome || 'Geral'}\n` +
          `${transacaoAlvo.contato_nome ? `• *${transacaoAlvo.tipo === 'receita' ? 'Cliente' : 'Fornecedor'}:* 👤 ${transacaoAlvo.contato_nome}\n` : ''}` +
          `• *Status atual:* ${statusTxt}\n\n` +
          `⚠️ _Atenção: Ao confirmar, este lançamento será removido permanentemente e o saldo bancário será devidamente recalculado._\n\n` +
          `Responda *sim* para confirmar ou *cancelar* para manter.`;

        await enviarTextoWhatsApp(cleanNum, textoProposta, instance);
        try {
          await db.query(
            `INSERT INTO whatsapp_mensagens_historico (empresa_id, admin_id, telefone, papel, conteudo) VALUES (?, ?, ?, 'assistant', ?)`,
            [empresaId, admin.id, cleanNum, textoProposta]
          );
        } catch (e) { }
        return res.json({ sucesso: true, resposta: textoProposta });
      }
    }

    // 2. Buscar Histórico Recente de Conversas dos Últimos 30 Minutos (Últimas 6 Mensagens)
    const [historicoRecente] = await db.query(
      `SELECT papel, conteudo FROM whatsapp_mensagens_historico 
       WHERE (admin_id = ? OR telefone LIKE ?)
         AND created_at >= NOW() - INTERVAL 30 MINUTE
       ORDER BY id DESC LIMIT 6`,
      [admin.id, `%${cleanNum.slice(-8)}%`]
    );

    // Inverter array para ter a ordem cronológica correta (mensagem mais antiga -> mensagem mais recente)
    const historicoCronologico = (historicoRecente || []).reverse();

    // 3. Preparar contexto completo para a IA
    const formatBRL = (v) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

    // Buscar Contas Bancárias
    const [contas] = await db.query(
      `SELECT id, nome, banco, saldo_atual, tipo FROM contas_bancarias WHERE empresa_id = ? AND ativo = 1`,
      [empresaId]
    );
    const contasTexto = contas.map(c => `- ${c.nome} (${c.banco}): ${formatBRL(c.saldo_atual)} (ID: ${c.id})`).join("\n");
    const saldoTotal = contas.reduce((acc, c) => acc + parseFloat(c.saldo_atual || 0), 0);

    // Buscar Categorias
    const [categorias] = await db.query(
      `SELECT id, nome, tipo, dre_grupo FROM categorias_financeiras WHERE empresa_id = ? AND ativo = 1 ORDER BY nome ASC`,
      [empresaId]
    );

    // Buscar DRE do mês
    const [dre] = await db.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'receita' AND status = 'pago' THEN valor_pago ELSE 0 END), 0) as receita_liquida,
        COALESCE(SUM(CASE WHEN tipo = 'despesa' AND status = 'pago' THEN valor_pago ELSE 0 END), 0) as despesas_totais
       FROM transacoes_financeiras
       WHERE empresa_id = ? AND MONTH(data_competencia) = MONTH(CURRENT_DATE()) AND YEAR(data_competencia) = YEAR(CURRENT_DATE())`,
      [empresaId]
    );
    const rec = parseFloat(dre[0]?.receita_liquida || 0);
    const desp = parseFloat(dre[0]?.despesas_totais || 0);
    const lucro = rec - desp;

    const hojeData = new Date();
    const hojeIso = hojeData.toISOString().split("T")[0];
    const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const mesAtualNome = mesesNomes[hojeData.getMonth()];
    const proximoMesNome = mesesNomes[(hojeData.getMonth() + 1) % 12];
    const anoAtual = hojeData.getFullYear();

    // 4. Busca Inteligente de Transações Relacionadas ao Assunto da Conversa (para suporte a Edição/Consulta)
    let transacoesRelevantesTexto = "";
    const textoCompletoConversa = historicoCronologico.map(h => h.conteudo).join(" ") + " " + mensagem;
    const palavrasChave = textoCompletoConversa
      .replace(/[^\w\s\d]/gi, " ")
      .split(/\s+/)
      .filter(p => p.length >= 3 && !["para", "quero", "mudar", "data", "alterar", "conta", "valor", "pode", "está", "você", "telefones", "contas", "mensagens", "vencimento", "primeira", "sobre"].includes(p.toLowerCase()));

    if (palavrasChave.length > 0) {
      const termosUnicos = Array.from(new Set(palavrasChave)).slice(0, 5);
      const condicoes = termosUnicos.map(() => `(t.descricao LIKE ? OR cat.nome LIKE ? OR c.nome LIKE ? OR t.valor LIKE ?)`).join(" OR ");
      const queryParams = [];
      termosUnicos.forEach(kw => {
        const term = `%${kw}%`;
        queryParams.push(term, term, term, term);
      });

      const [matches] = await db.query(
        `SELECT t.id, t.tipo, t.descricao, t.valor, DATE_FORMAT(t.data_vencimento, '%Y-%m-%d') as venc_iso,
                DATE_FORMAT(t.data_vencimento, '%d/%m/%Y') as venc_fmt, t.status,
                c.nome as contato_nome, cat.nome as categoria_nome
         FROM transacoes_financeiras t
         LEFT JOIN contatos c ON c.id = t.contato_id
         LEFT JOIN categorias_financeiras cat ON cat.id = t.categoria_id
         WHERE t.empresa_id = ? AND (${condicoes})
         ORDER BY t.id DESC LIMIT 8`,
        [empresaId, ...queryParams]
      );

      if (matches.length > 0) {
        transacoesRelevantesTexto = `\n🔍 TRANSAÇÕES ENCONTRADAS RELACIONADAS À CONVERSA (USE SE O USUÁRIO QUISER CONSULTAR OU EDITAR UMA DELAS):\n` +
          matches.map(m => `- ID ${m.id}: "${m.descricao}" | Valor: R$ ${parseFloat(m.valor).toFixed(2)} | Vencimento Atual: ${m.venc_fmt} (ISO: ${m.venc_iso}) | Status: ${m.status}`).join("\n") + "\n";
      }
    }

    // Buscar Contas Pendentes Ordenadas ESTRITAMENTE pela data mais próxima
    const [todasPendentes] = await db.query(
      `SELECT t.id, t.tipo, t.descricao, t.valor, 
              DATE_FORMAT(t.data_vencimento, '%d/%m/%Y') as vencimento_formatado, 
              t.data_vencimento,
              DATEDIFF(t.data_vencimento, CURDATE()) as dias_ate_vencimento,
              c.nome as contato_nome, cat.nome as categoria_nome
       FROM transacoes_financeiras t
       LEFT JOIN contatos c ON c.id = t.contato_id
       LEFT JOIN categorias_financeiras cat ON cat.id = t.categoria_id
       WHERE t.empresa_id = ? AND t.status = 'pendente'
       ORDER BY t.data_vencimento ASC
       LIMIT 150`,
      [empresaId]
    );

    const aPagarPendentes = todasPendentes.filter(t => t.tipo === "despesa");
    const aReceberPendentes = todasPendentes.filter(t => t.tipo === "receita");

    // Função de agrupamento mensal com subtotais claros
    const agruparContasPorMes = (contasLista) => {
      if (!contasLista || contasLista.length === 0) return "Nenhuma conta pendente.";

      const grupos = {};
      for (const item of contasLista) {
        const d = new Date(item.data_vencimento);
        const mesAnoKey = `${mesesNomes[d.getUTCMonth()]}/${d.getUTCFullYear()}`;
        if (!grupos[mesAnoKey]) {
          grupos[mesAnoKey] = { total: 0, itens: [] };
        }
        grupos[mesAnoKey].total += parseFloat(item.valor || 0);
        grupos[mesAnoKey].itens.push(item);
      }

      let resultadoTexto = "";
      for (const [mesAno, dados] of Object.entries(grupos)) {
        resultadoTexto += `\n📅 *${mesAno}* (Total a pagar: ${formatBRL(dados.total)} - ${dados.itens.length} contas):\n`;
        for (const it of dados.itens) {
          let prazoStr = "";
          if (it.dias_ate_vencimento === 0) prazoStr = " [VENCE HOJE]";
          else if (it.dias_ate_vencimento === 1) prazoStr = " [Vence amanhã]";
          else if (it.dias_ate_vencimento > 1) prazoStr = ` [Em ${it.dias_ate_vencimento} dias]`;
          else prazoStr = ` [⚠️ Atrasada há ${Math.abs(it.dias_ate_vencimento)} dias]`;

          resultadoTexto += `  • ID ${it.id} - ${it.vencimento_formatado}: ${it.descricao} - ${formatBRL(it.valor)}${prazoStr} (Fornecedor: ${it.contato_nome || 'Geral'})\n`;
        }
      }
      return resultadoTexto;
    };

    const aPagarTexto = agruparContasPorMes(aPagarPendentes);
    const aReceberTexto = agruparContasPorMes(aReceberPendentes);

    // 1. Identificar se é primeiro acesso do gestor
    const [countHistorico] = await db.query(
      `SELECT COUNT(*) as total FROM whatsapp_mensagens_historico WHERE empresa_id = ? AND (admin_id = ? OR telefone LIKE ?)`,
      [empresaId, admin.id, `%${cleanNum.slice(-8)}%`]
    );
    const isPrimeiroAcesso = (countHistorico[0]?.total || 0) <= 1;

    // 2. Formatar prévia pendente se houver
    let previaPendenteStr = "Nenhuma prévia pendente de confirmação.";
    if (rascunhoAtivo) {
      previaPendenteStr = typeof rascunhoAtivo.dados_json === "string" ? rascunhoAtivo.dados_json : JSON.stringify(rascunhoAtivo.dados_json);
    }

    const dataHoraAtualStr = `${hojeData.toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} (Data ISO: ${hojeIso})`;

    const systemPrompt = `Você é Cora, a Copiloto Financeira Inteligente da Nuvy Finance.
Seu objetivo é ajudar o gestor financeiro a controlar suas contas, consultar saldos,
entender seus resultados e registrar entradas e saídas de forma rápida e segura.

Personalidade: prestativa, direta e confiável — como uma assistente financeira
de verdade, não um robô genérico. Pode se referir a si mesma como "Cora" quando
fizer sentido (ex: "Aqui é a Cora! 😊"), mas sem exagerar — o foco continua sendo
resolver o financeiro do gestor com agilidade.

═══════════════════════════════════════
1. IDENTIFICAÇÃO E DATA DE REFERÊNCIA
═══════════════════════════════════════
- Gestor: ${admin.nome}
- Empresa: ${admin.emp_nome}
- Data e hora atual: ${dataHoraAtualStr}
- Primeiro acesso deste gestor: ${isPrimeiroAcesso ? "true" : "false"}
Use SEMPRE ${dataHoraAtualStr} como referência para resolver expressões relativas:
"hoje", "amanhã", "essa semana", "dia 15" (assuma o próximo dia 15 a partir de
hoje, a menos que o mês seja dito explicitamente), "mês passado", etc.

═══════════════════════════════════════
1.1 MENSAGEM DE BOAS-VINDAS (primeiro acesso)
═══════════════════════════════════════
Se {{primeiro_acesso}} for true, ANTES de responder ao que o gestor pediu (ou
mesmo que ele ainda não tenha mandado nada além de um "oi" inicial), envie uma
mensagem de boas-vindas apresentando a Cora e o que ela faz. Use algo neste
espírito, adaptando ao nome do gestor e da empresa:

"Oi, ${admin.nome}! 👋 Eu sou a *Cora*, sua Copiloto Financeira aqui da ${admin.emp_nome}.

A partir de agora você pode falar comigo por texto, áudio ou foto pra:
💰 Consultar saldo e contas do dia
📋 Lançar despesas e receitas (\"gastei 50 no almoço\")
📸 Enviar foto de comprovante PIX ou boleto que eu leio pra você
✅ Marcar contas como pagas

Pode mandar sua primeira mensagem quando quiser — vou te ajudar por aqui! 😊"

Depois dessa mensagem, se o gestor já tiver enviado um pedido real junto com o
"oi" (ex: "oi, quanto tenho de saldo?"), responda a essa pergunta em seguida,
como uma segunda mensagem lógica — não ignore o pedido dele.
Esta boas-vindas deve ser enviada apenas UMA VEZ (controlada por
{{primeiro_acesso}} vindo do backend); não repita em mensagens seguintes.

═══════════════════════════════════════
2. DADOS DISPONÍVEIS NO CONTEXTO (injetados a cada mensagem)
═══════════════════════════════════════
- Saldo consolidado: ${formatBRL(saldoTotal)}
- Saldos por conta:
${contasTexto || "Nenhuma conta cadastrada"}
${transacoesRelevantesTexto}
- Próximas contas a pagar:
${aPagarTexto}
- Próximas contas a receber:
${aReceberTexto}
- Resumo DRE do mês (${mesAtualNome}):
Receitas: ${formatBRL(rec)} | Despesas: ${formatBRL(desp)} | Resultado/Lucro: ${formatBRL(lucro)}
- Plano de contas (categorias válidas):
${categorias.map(c => `ID ${c.id}: ${c.nome} (${c.tipo})`).join(", ")}
- Prévia pendente de confirmação (se houver):
${previaPendenteStr}

═══════════════════════════════════════
3. REGRA CRÍTICA — NUNCA INVENTE DADOS
═══════════════════════════════════════
- Use exclusivamente os dados fornecidos acima. Nunca estime, arredonde de forma
  especulativa ou "calcule de cabeça" somando valores manualmente — use sempre
  os totais já consolidados no contexto.
- Se a informação pedida não estiver disponível no contexto, diga isso claramente:
  "Não tenho esse dado disponível no momento." Nunca preencha a lacuna com um
  palpite.
- A categoria de qualquer lançamento DEVE ser uma das existentes no plano de contas.
  Nunca crie uma categoria nova. Se nenhuma for adequada, pergunte ao gestor qual usar.

═══════════════════════════════════════
4. REGRAS DE CONVERSAÇÃO E CONSULTAS
═══════════════════════════════════════
1. Saudações ("Oi", "Olá") ou agradecimentos ("Valeu", "Obrigado"):
   Responda de forma educada, amigável e concisa, com emojis moderados.
   Ex: "Oi! Como posso te ajudar hoje? 😊"

2. Dúvidas sobre contas ("como estão minhas contas?", "o que vence hoje?"):
   Consulte as próximas contas a pagar / a receber e apresente um resumo
   organizado com datas, descrições e valores em Reais (R$).

3. Consulta de saldos / DRE / lucro:
   Apresente os dados de saldos por conta e resumo DRE de forma clara.

4. Fora de escopo (perguntas não financeiras — clima, notícias, opinião pessoal):
   Responda educadamente que você é especializada em finanças da empresa e
   redirecione: "Isso foge um pouco do que posso te ajudar por aqui — sou
   focada nas finanças da ${admin.emp_nome}. Quer que eu veja algo do seu
   financeiro?"

═══════════════════════════════════════
5. REGRAS PARA CRIAR NOVOS LANÇAMENTOS
═══════════════════════════════════════
1. Quando o gestor pedir para lançar/agendar uma conta:
   - Identifique: Tipo (despesa/receita), Valor, Data de vencimento e Categoria
     (obrigatoriamente do plano de contas).
   - Se faltar QUALQUER dado essencial (valor, data ou categoria), NÃO monte a
     prévia ainda — pergunte especificamente o que falta, um item por vez.
   - Se o gestor mencionar MAIS DE UM lançamento na mesma mensagem
     (ex: "gastei 50 no almoço e 30 no uber"), separe em prévias distintas e
     apresente uma de cada vez, na ordem em que foram citadas.

2. Monte a ficha de prévia formatada:
   "📋 *Confirmação de Lançamento:*
    • *Tipo:* Despesa
    • *Descrição:* Almoço de Negócios
    • *Valor:* R$ 50,00
    • *Data:* 15/09/2026
    • *Categoria:* Alimentação

    👉 Responda *Sim* para confirmar e salvar no sistema, ou me diga se deseja ajustar algo."

3. Armazene a proposta em formato estruturado (JSON) no campo "action" da resposta (ver seção 8).

═══════════════════════════════════════
6. GESTÃO DE PRÉVIA PENDENTE (evita o robô "se perder")
═══════════════════════════════════════
- Mantenha NO MÁXIMO UMA prévia pendente de confirmação por vez.
- Se o gestor mudar de assunto antes de confirmar a prévia atual, considere-a
  cancelada e avise: "Ok, vou deixar esse lançamento de lado. Se quiser
  retomar, é só me chamar de novo." Em seguida, trate a nova mensagem
  normalmente.
- Se o gestor responder "sim"/"ok"/"pode salvar" e HOUVER prévia pendente
  ativa no contexto, confirme e grave essa prévia.
- Se o gestor responder "sim" e NÃO houver prévia pendente no contexto,
  responda pedindo esclarecimento: "Não encontrei nenhuma confirmação
  pendente. Pode me dizer o que gostaria de lançar?" — nunca invente qual
  seria a prévia.
- Se o histórico indicar uma pausa longa (30+ minutos) desde a última
  mensagem antes do "sim", NÃO confirme automaticamente: reapresente a ficha
  de prévia resumida e peça confirmação novamente, para evitar lançar algo
  desatualizado ou já resolvido em outro canal.

═══════════════════════════════════════
7. CORREÇÕES, EDIÇÃO E EXCLUSÃO DE LANÇAMENTOS
═══════════════════════════════════════
- Se o gestor pedir para EXCLUIR, APAGAR, DELETAR ou REMOVER um lançamento ("exclui essa despesa", "apaga a conta", "deleta a receita", "exclui ela"):
  - Identifique o ID do lançamento em foco ou o mais recente.
  - Monte o JSON com action.type: "delete_entry", status: "preview" e data com transacao_id, descricao, valor e tipo.
  - Na mensagem (reply), monte a confirmação de exclusão:
    "🗑️ *Confirmar exclusão deste lançamento?*\n\n• *Tipo:* [Receita 🟢 ou Despesa 🔴]\n• *Descrição:* [Nome]\n• *Valor:* R$ [Valor]\n\n⚠️ _Atenção: Ao confirmar, o lançamento será removido permanentemente e os saldos serão ajustados._\n\nResponda *sim* para confirmar ou *cancelar* para manter."
- Se o gestor corrigir um campo da prévia antes de confirmar (ex: "não, era 60 não 50"), atualize APENAS o campo mencionado e reapresente a ficha completa e atualizada para nova confirmação.
- Se pedir para editar ou dar baixa em conta existente ("marca a luz como paga", "muda a data da internet"):
  - Se já constar como "pago" no contexto: informe isso e não altere nada.
    Ex: "A conta *Luz* (R$ 150,00) já consta como *PAGA* no seu painel Nuvy Finance! ✅"
  - Se estiver pendente: monte uma prévia de alteração (mesmo formato da seção 5) e aguarde confirmação antes de gravar.

═══════════════════════════════════════
8. FORMATO DE SAÍDA (JSON estruturado)
═══════════════════════════════════════
Responda SEMPRE em JSON válido, sem texto fora do JSON, no formato:

{
  "reply": "texto da mensagem formatada que será enviada ao gestor no WhatsApp",
  "action": {
    "type": "create_entry | edit_entry | delete_entry | mark_as_paid | none",
    "status": "preview | confirmed",
    "data": {
      "transacao_id": 123,
      "tipo": "despesa | receita",
      "descricao": "string",
      "valor": 0.00,
      "data_vencimento": "AAAA-MM-DD",
      "categoria": "string (deve existir no plano de contas)"
    }
  }
}

- IMPORTANTE: "data_vencimento" no JSON deve vir sempre no formato ISO
  "AAAA-MM-DD" (ex: 2026-09-15), pronto para inserção direta no MySQL. Isso
  vale apenas para o campo estruturado — na mensagem de "reply" mostrada ao
  gestor, continue exibindo a data no formato brasileiro DD/MM/AAAA, que é
  mais natural de ler.
- Use "action.type": "none" para mensagens de saudação, consulta, boas-vindas
  ou fora de escopo (nada a gravar).
- Use "status": "preview" enquanto aguarda confirmação do gestor, e
  "confirmed" apenas na mensagem imediatamente após o "sim" que fecha a
  prévia pendente.

═══════════════════════════════════════
9. ENTRADA POR ÁUDIO E IMAGEM
═══════════════════════════════════════
- Áudio (via Whisper): trate o texto transcrito como uma mensagem normal do
  gestor, aplicando todas as regras acima.
- Imagem (via GPT-4o Vision — comprovantes PIX, boletos, cupons, notas):
  extraia valor, destinatário/pagador, data e (se houver) autenticação
  bancária. Monte a prévia normalmente com esses dados. Se algum campo não
  for legível na imagem, pergunte ao gestor em vez de adivinhar.`;

    let resObj = { reply: "", action: { type: "none", status: "none", data: null } };
    if (OPENAI_KEY) {
      // Montar array de mensagens incluindo o histórico recente da conversa
      const apiMessages = [
        { role: "system", content: systemPrompt },
        ...historicoCronologico.map(h => ({
          role: h.papel === "assistant" ? "assistant" : "user",
          content: h.conteudo
        }))
      ];

      const openAiRes = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: apiMessages,
          temperature: 0.3,
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 25000,
        }
      );

      try {
        resObj = JSON.parse(openAiRes.data?.choices?.[0]?.message?.content || "{}");
      } catch (parseErr) {
        console.error("Erro ao fazer parse do JSON da OpenAI:", parseErr);
        resObj = {
          reply: openAiRes.data?.choices?.[0]?.message?.content || "Desculpe, não compreendi.",
          action: { type: "none" },
        };
      }
    } else {
      resObj = {
        reply: `Olá ${admin.nome}! Aqui é a Cora da Nuvy Finance. Recebi sua mensagem: "${mensagem}".`,
        action: { type: "none" },
      };
    }

    // Unificar extração de action (suporte a novo schema "reply"/"action" e retrocompatibilidade com "proposta_lancamento")
    const actionObj = resObj.action || (resObj.proposta_lancamento ? {
      type: resObj.proposta_lancamento.acao === "editar_transacao" ? "edit_entry" : "create_entry",
      status: "preview",
      data: resObj.proposta_lancamento
    } : null);

    // Salvar proposta de rascunho se houver (para criação ou edição em preview)
    if (actionObj && actionObj.type !== "none" && actionObj.data) {
      try {
        const p = actionObj.data;
        let catId = null;
        let catNome = p.categoria || p.categoria_nome || "Geral";
        if (catNome) {
          const catFound = categorias.find(c => c.nome.toLowerCase().includes(catNome.toLowerCase()));
          if (catFound) {
            catId = catFound.id;
            catNome = catFound.nome;
          }
        }
        if (!catId && categorias.length > 0) {
          const defaultCat = categorias.find(c => c.tipo === (p.tipo || "despesa")) || categorias[0];
          catId = defaultCat.id;
          catNome = defaultCat.nome;
        }

        const termoBuscaConta = [
          p.conta_nome,
          p.conta_bancaria,
          p.banco_origem,
          p.banco_destino,
          mensagem
        ].filter(Boolean).join(" ");
        const contaMatched = identificarContaBancaria(termoBuscaConta, contas);
        let contaId = contaMatched?.id || null;
        let contaNome = contaMatched?.nome || null;

        if (!contaId && contas.length > 0) {
          contaId = contas[0].id;
          contaNome = contas[0].nome;
        }

        const pagadorFinal = p.pagador || null;
        const recebedorFinal = p.recebedor || p.beneficiario_ou_pagador || null;

        // [FIX BUG 3] Busca por nome/descrição em transações pendentes
        // Ex: "pagou o maui", "pagamento do maui" → encontra Maui (1/11) pendente
        let transacaoIdSmartMatch = p.transacao_id || null;
        if (!transacaoIdSmartMatch) {
          const matchNomePagamento = mensagem.match(
            /(?:pagu(?:ei|ou|ar)|pagamento\s+d(?:o|a|e)|baixa\s+d(?:o|a|e)|quitar?|quitei)\s+(?:o\s+|a\s+|do\s+|da\s+)?([\w\u00C0-\u00FF]{2,25})/i
          );
          if (matchNomePagamento) {
            const nomeBuscado = matchNomePagamento[1].trim();
            const [tPendentes] = await db.query(
              `SELECT id, descricao, valor, data_vencimento FROM transacoes_financeiras
               WHERE empresa_id = ? AND descricao LIKE ? AND status = 'pendente'
               ORDER BY data_vencimento ASC LIMIT 1`,
              [empresaId, `%${nomeBuscado}%`]
            );
            if (tPendentes.length > 0) {
              transacaoIdSmartMatch = tPendentes[0].id;
              console.log(`[WHATSAPP SMART MATCH] Parcela pendente por nome "${nomeBuscado}": ID #${transacaoIdSmartMatch} - ${tPendentes[0].descricao}`);
            }
          }
        }

        const isDeleteAction = actionObj.type === "delete_entry" || actionObj.type === "delete_transaction";
        const dadosRascunho = {
          acao: isDeleteAction ? "delete_transaction" : ((transacaoIdSmartMatch || actionObj.type === "edit_entry") ? "editar_transacao" : "lancar_transacao"),
          transacao_id: p.transacao_id || transacaoIdSmartMatch || null,
          tipo: p.tipo || "despesa",
          descricao: p.descricao || mensagem,
          valor: Math.abs(parseFloat(p.valor || 0)),
          data_vencimento: p.data_vencimento || hojeIso,
          total_parcelas: (transacaoIdSmartMatch || isDeleteAction) ? 1 : (parseInt(p.total_parcelas, 10) || 1),
          categoria_id: catId,
          categoria_nome: catNome,
          pagador: pagadorFinal,
          recebedor: recebedorFinal,
          conta_id: contaId,
          conta_nome: contaNome,
          conta_identificada: Boolean(contaMatched),
          status: p.status || (p.data_vencimento > hojeIso ? "pendente" : "pago"),
        };

        await db.query(
          `INSERT INTO whatsapp_ia_rascunhos (empresa_id, admin_id, telefone, tipo_acao, dados_json)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             dados_json = VALUES(dados_json),
             updated_at = NOW()`,
          [empresaId, admin.id, cleanNum, isDeleteAction ? 'excluir_transacao' : 'lancar_transacao', JSON.stringify(dadosRascunho)]
        );
      } catch (errRascunho) {
        console.error("Erro ao gravar rascunho de lançamento/edição:", errRascunho);
      }
    }

    const textoFinal = resObj.reply || resObj.mensagem_whatsapp || "Comando recebido!";
    await enviarTextoWhatsApp(cleanNum, textoFinal, instance);

    // Registra a resposta da Cora no histórico
    try {
      await db.query(
        `INSERT INTO whatsapp_mensagens_historico (empresa_id, admin_id, telefone, papel, conteudo) VALUES (?, ?, ?, 'assistant', ?)`,
        [empresaId, admin.id, cleanNum, textoFinal]
      );
    } catch (e) { }

    return res.json({
      sucesso: true,
      mensagem_enviada: textoFinal,
    });
  } catch (err) {
    console.error("Erro no processarMensagemIA:", err);
    return res.status(500).json({ error: "Erro interno no copiloto de IA." });
  }
};

// 7b. Notificar Atendimento Humano (fromMe=true detectado pelo n8n)
// O n8n deve chamar este endpoint quando o dono/atendente enviar uma mensagem para um contato.
const notificarAtendimentoHumano = async (req, res) => {
  try {
    const { telefone, instance = INSTANCIA_PADRAO } = req.body;
    if (!telefone) {
      return res.status(400).json({ error: "Telefone é obrigatório." });
    }

    const cleanNum = String(telefone).replace(/\D/g, "");
    const msgLimpaComando = (req.body.mensagem || "").trim().toLowerCase();

    // Se for comando de reativação, remove a pausa
    if (["#voltar", "#robo", "#ia", "#ativar", "#despausar"].includes(msgLimpaComando)) {
      await db.query(
        `DELETE FROM whatsapp_pausas_atendimento WHERE telefone LIKE ?`,
        [`%${cleanNum.slice(-8)}%`]
      );
      console.log(`[WHATSAPP PAUSA] Copiloto IA reativado manualmente para ${cleanNum}`);
      return res.json({ sucesso: true, mensagem: `IA reativada para o número ${cleanNum}.` });
    }

    // Obter empresa_id via admin vinculado ao telefone OU usar o menor id disponível
    let empresaId = 1;
    try {
      const adminInfo = await encontrarAdminPorTelefone(cleanNum);
      if (adminInfo) empresaId = adminInfo.empresa_id;
      else {
        const [empRows] = await db.query(`SELECT id as empresa_id FROM empresas WHERE ativo = 1 ORDER BY id ASC LIMIT 1`);
        if (empRows.length > 0) empresaId = empRows[0].empresa_id;
      }
    } catch (e) { }

    // Ativar / Renovar Pausa Automática de 12 HORAS para este número de contato
    await db.query(
      `INSERT INTO whatsapp_pausas_atendimento (empresa_id, telefone, expira_em, motivo)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 12 HOUR), 'envio_manual_celular')
       ON DUPLICATE KEY UPDATE
         pausado_em = NOW(),
         expira_em = DATE_ADD(NOW(), INTERVAL 12 HOUR),
         motivo = 'envio_manual_celular'`,
      [empresaId, cleanNum]
    );

    console.log(`[WHATSAPP PAUSA] Atendimento humano registrado para ${cleanNum}. IA pausada por 12 horas.`);
    return res.json({
      sucesso: true,
      pausado: true,
      mensagem: `Atendimento humano registrado. IA em pausa por 12h para o número ${cleanNum}.`
    });
  } catch (err) {
    console.error("Erro em notificarAtendimentoHumano:", err);
    return res.status(500).json({ error: "Erro ao registrar pausa de atendimento." });
  }
};

// 8. Processador Universal Multimodal (Texto, Áudio Whisper & Imagem Vision)
const processarMidiaMensagem = async (req, res) => {
  try {
    const {
      telefone,
      mensagem = "",
      tipo_midia = "texto",
      media_base64,
      message_data,
      pushName,
      instance = INSTANCIA_PADRAO,
    } = req.body;

    if (!telefone) {
      return res.status(400).json({ error: "Telefone é obrigatório." });
    }

    const rawTel = String(telefone || "");
    if (rawTel.includes("@g.us") || rawTel.includes("-") || message_data?.key?.participant) {
      return res.json({ sucesso: true, mensagem: "Mensagem de grupo ignorada." });
    }

    const cleanNum = telefone.replace(/\D/g, "");
    if (cleanNum.length > 15) {
      return res.json({ sucesso: true, mensagem: "Mensagem de grupo ignorada." });
    }

    // 1. Verificar se a mensagem foi enviada pelo próprio atendente (fromMe = true)
    const isFromMe = req.body.fromMe === true ||
      message_data?.key?.fromMe === true ||
      message_data?.fromMe === true;

    const msgLimpaComando = (mensagem || "").trim().toLowerCase();

    if (isFromMe) {
      if (["#voltar", "#robo", "#ia", "#ativar", "#despausar"].includes(msgLimpaComando)) {
        await db.query(
          `DELETE FROM whatsapp_pausas_atendimento WHERE telefone LIKE ?`,
          [`%${cleanNum.slice(-8)}%`]
        );
        const msgReativado = `🟢 *Copiloto IA reativado para este contato!*`;
        await enviarTextoWhatsApp(cleanNum, msgReativado, instance);
        console.log(`[WHATSAPP PAUSA] Copiloto IA reativado manualmente para ${cleanNum}`);
        return res.json({ sucesso: true, mensagem: "Pausa removida por comando manual." });
      }

      let empresaId = 1;
      try {
        const [empRows] = await db.query(`SELECT id as empresa_id FROM empresas WHERE ativo = 1 ORDER BY id ASC LIMIT 1`);
        if (empRows.length > 0) empresaId = empRows[0].empresa_id;
      } catch (e) { }

      await db.query(
        `INSERT INTO whatsapp_pausas_atendimento (empresa_id, telefone, expira_em, motivo)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 12 HOUR), 'envio_manual_celular')
         ON DUPLICATE KEY UPDATE
           pausado_em = NOW(),
           expira_em = DATE_ADD(NOW(), INTERVAL 12 HOUR),
           motivo = 'envio_manual_celular'`,
        [empresaId, cleanNum]
      );

      console.log(`[WHATSAPP PAUSA] Atendimento humano detectado do celular para ${cleanNum}. IA pausada por 12 horas.`);
      return res.json({
        sucesso: true,
        pausado: true,
        mensagem: `Atendimento humano detectado (fromMe=true). IA em pausa por 12h para o número ${cleanNum}.`
      });
    }

    // 2. MENSAGEM DO CLIENTE (fromMe = false) -> VERIFICAR PAUSA ATIVA
    if (["#voltar", "#robo", "#ia", "#ativar", "#despausar"].includes(msgLimpaComando)) {
      await db.query(
        `DELETE FROM whatsapp_pausas_atendimento WHERE telefone LIKE ?`,
        [`%${cleanNum.slice(-8)}%`]
      );
    } else {
      const [pausaAtiva] = await db.query(
        `SELECT id, TIMESTAMPDIFF(MINUTE, NOW(), expira_em) as min_restantes
         FROM whatsapp_pausas_atendimento
         WHERE telefone LIKE ? AND expira_em > NOW()
         LIMIT 1`,
        [`%${cleanNum.slice(-8)}%`]
      );

      if (pausaAtiva.length > 0) {
        const minRestantes = pausaAtiva[0].min_restantes || 0;
        const horasRestantes = (minRestantes / 60).toFixed(1);
        console.log(`[WHATSAPP PAUSA] Ignorando resposta da IA para ${cleanNum}: Atendimento humano ativo (restam ~${horasRestantes}h).`);
        return res.json({
          sucesso: true,
          pausado: true,
          mensagem: `Atendimento humano ativo para este contato. Copiloto IA em pausa (restam ~${horasRestantes}h).`
        });
      }
    }

    const admin = await encontrarAdminPorTelefone(cleanNum);

    if (!admin) {
      const respNaoCadastrado = `Olá${pushName ? ` ${pushName}` : ""}! 🤖 Sou o Copiloto da Nuvy Finance.\n\nAinda não localizei o seu número (${cleanNum}) vinculado a uma empresa no sistema. Por favor, adicione o seu telefone no seu perfil em *financas.nuvycore.online* para conversarmos!`;
      await enviarTextoWhatsApp(cleanNum, respNaoCadastrado, instance);
      return res.json({ sucesso: true, resposta: respNaoCadastrado });
    }

    const empresaId = admin.empresa_id;

    // A) Processamento de Áudio com Whisper
    if (tipo_midia === "audio") {
      let base64 = media_base64;
      if (!base64 && message_data) {
        base64 = await obterBase64DeMidiaEvolution(message_data, instance);
      }

      if (!base64) {
        const msgErr = `Olá *${admin.nome}*! Recebi seu áudio, mas não consegui carregar o arquivo. Por favor, tente enviar novamente.`;
        await enviarTextoWhatsApp(cleanNum, msgErr, instance);
        return res.json({ sucesso: false, erro: "Base64 de áudio não disponível." });
      }

      const cleanAudioBase64 = base64.replace(/^data:audio\/[a-zA-Z0-9.-]+;base64,/, "");
      const audioBuffer = Buffer.from(cleanAudioBase64, "base64");

      const textoTranscrito = await transcreverAudioWhisper(audioBuffer);
      if (!textoTranscrito || !textoTranscrito.trim()) {
        const msgVazio = `Olá *${admin.nome}*! Não consegui transcrever o seu áudio com clareza. Pode repetir por favor?`;
        await enviarTextoWhatsApp(cleanNum, msgVazio, instance);
        return res.json({ sucesso: false, erro: "Transcrição vazia." });
      }

      // Processar mensagem transcrita como texto
      req.body.mensagem = textoTranscrito;
      return await processarMensagemIA(req, res);
    }

    // B) Processamento de Imagem / Comprovante com Vision OCR
    if (tipo_midia === "imagem") {
      let base64 = media_base64;
      if (!base64 && message_data) {
        base64 = await obterBase64DeMidiaEvolution(message_data, instance);
      }

      if (!base64) {
        const msgErr = `Olá *${admin.nome}*! Recebi sua foto, mas não consegui carregar a imagem. Por favor, envie novamente.`;
        await enviarTextoWhatsApp(cleanNum, msgErr, instance);
        return res.json({ sucesso: false, erro: "Base64 de imagem não disponível." });
      }

      try {
        const ocrData = await analisarComprovanteVision(base64, mensagem, admin, empresaId);

        if (!ocrData || !ocrData.valor) {
          const msgNaoLido = `Olá *${admin.nome}*! Analisei a imagem, mas não encontrei um comprovante ou valor financeiro legível. Se desejar, me informe o valor e a descrição por texto ou áudio!`;
          await enviarTextoWhatsApp(cleanNum, msgNaoLido, instance);
          return res.json({ sucesso: false, erro: "Comprovante sem valor legível." });
        }

        // Salvar imagem física do comprovante em disco
        let savedComprovanteUrl = null;
        try {
          const cleanImgBase64 = String(base64 || "")
            .replace(/^data:image\/[a-zA-Z0-9.-]+;base64,/, "")
            .replace(/^data:application\/pdf;base64,/, "");
          if (cleanImgBase64) {
            const imgBuffer = Buffer.from(cleanImgBase64, "base64");
            const uploadDir = path.resolve(__dirname, "../../uploads/comprovantes");
            if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
            }
            const filename = `comp_wh_${Date.now()}_${uuidv4().substring(0, 8)}.jpg`;
            const fullPath = path.join(uploadDir, filename);
            fs.writeFileSync(fullPath, imgBuffer);
            savedComprovanteUrl = `/uploads/comprovantes/${filename}`;
          }
        } catch (saveErr) {
          console.error("Erro ao salvar comprovante WhatsApp no disco:", saveErr.message);
        }

        // Lançar transação automaticamente
        const connection = await db.getConnection();
        let transacaoId = null;
        try {
          await connection.beginTransaction();

          const valorFloat = Math.abs(parseFloat(ocrData.valor || 0));
          const tipo = ocrData.tipo === "receita" ? "receita" : "despesa";
          const descricao = ocrData.descricao || `Comprovante - ${ocrData.beneficiario_ou_pagador || 'Despesa'}`;
          const hoje = new Date().toISOString().split("T")[0];
          const dataPag = ocrData.data_pagamento || hoje;
          const dataVenc = ocrData.data_vencimento || dataPag;
          const status = ocrData.status || "pago";

          let catId = ocrData.categoria_id;
          let catNome = ocrData.categoria_nome || "Geral";
          if (!catId) {
            const catObj = await resolverOuCriarCategoria(
              empresaId,
              ocrData.categoria_nome || null,
              tipo,
              `${descricao} ${ocrData.beneficiario_ou_pagador || ''}`
            );
            catId = catObj.id;
            catNome = catObj.nome;
          }

          let contaId = ocrData.conta_id;
          let contaNome = "Caixa Geral";
          if (!contaId) {
            const [firstConta] = await connection.query(
              `SELECT id, nome FROM contas_bancarias WHERE empresa_id = ? AND ativo = 1 ORDER BY id ASC LIMIT 1`,
              [empresaId]
            );
            if (firstConta.length > 0) {
              contaId = firstConta[0].id;
              contaNome = firstConta[0].nome;
            }
          } else {
            const [contaInfo] = await connection.query(
              `SELECT nome FROM contas_bancarias WHERE id = ? AND empresa_id = ?`,
              [contaId, empresaId]
            );
            if (contaInfo.length > 0) contaNome = contaInfo[0].nome;
          }

          const obs = `OCR Vision WhatsApp (${cleanNum}). Beneficiário/Pagador: ${ocrData.beneficiario_ou_pagador || '—'}. Autenticação: ${ocrData.documento_numero || '—'}`;

          const [result] = await connection.query(
            `INSERT INTO transacoes_financeiras (
              empresa_id, created_by, tipo, descricao, valor, valor_pago,
              data_competencia, data_vencimento, data_pagamento, status,
              categoria_id, conta_bancaria_id, forma_pagamento, documento_numero, comprovante_url, observacoes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              empresaId,
              admin.id,
              tipo,
              descricao,
              valorFloat,
              status === "pago" ? valorFloat : 0,
              dataPag,
              dataVenc,
              status === "pago" ? dataPag : null,
              status,
              catId,
              contaId,
              ocrData.forma_pagamento || "pix",
              ocrData.documento_numero || null,
              savedComprovanteUrl,
              obs,
            ]
          );

          transacaoId = result.insertId;

          if (status === "pago" && contaId) {
            if (tipo === "receita") {
              await connection.query(`UPDATE contas_bancarias SET saldo_atual = saldo_atual + ? WHERE id = ?`, [valorFloat, contaId]);
            } else {
              await connection.query(`UPDATE contas_bancarias SET saldo_atual = saldo_atual - ? WHERE id = ?`, [valorFloat, contaId]);
            }
          }

          await connection.commit();
        } catch (dbErr) {
          await connection.rollback();
          throw dbErr;
        } finally {
          connection.release();
        }

        const formatBRL = (v) =>
          new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

        const msgConfirmacao = `✅ *Comprovante Lido e Lançado com Sucesso!*\n\n` +
          `📝 *Descrição:* ${ocrData.descricao}\n` +
          `💰 *Valor:* ${formatBRL(ocrData.valor)}\n` +
          `📅 *Data:* ${ocrData.data_pagamento || 'Hoje'}\n` +
          `👤 *Favorecido:* ${ocrData.beneficiario_ou_pagador || 'Não informado'}\n` +
          `🏷️ *Categoria:* ${ocrData.categoria_nome || 'Geral'}\n` +
          `💳 *Forma:* ${(ocrData.forma_pagamento || 'PIX').toUpperCase()}\n` +
          `📊 *Status:* Lançado e Liquidado no sistema!\n\n` +
          `_Copiloto Financeiro Nuvy Finance_ 🤖`;

        await enviarTextoWhatsApp(cleanNum, msgConfirmacao, instance);

        return res.json({
          sucesso: true,
          transacao_id: transacaoId,
          ocr_data: ocrData,
          mensagem: msgConfirmacao,
        });
      } catch (ocrErr) {
        console.error("Erro no OCR Vision:", ocrErr);
        const msgFalha = `Olá *${admin.nome}*! Tive uma dificuldade técnica ao analisar o comprovante. Pode me informar o valor e a descrição por texto?`;
        await enviarTextoWhatsApp(cleanNum, msgFalha, instance);
        return res.status(500).json({ error: "Erro ao processar imagem com Vision OCR." });
      }
    }

    // C) Mensagem de Texto Normal
    return await processarMensagemIA(req, res);
  } catch (err) {
    console.error("Erro em processarMidiaMensagem:", err);
    return res.status(500).json({ error: "Erro interno no processamento de mídia." });
  }
};

// 9. Régua Inteligente de Cobrança e Inadimplência
const dispararReguaCobranca = async (req, res) => {
  try {
    // SEGURANÇA MULTI-TENANT:
    // - Se chamado via JWT de tenant (não super admin), forçar SEMPRE o empresa_id do token.
    //   Tenant não pode passar empresa_id arbitrário no body.
    // - Se chamado via API Key do n8n (sem req.user) OU via Super Admin, respeitar empresa_id do body.
    //   Quando empresa_id é null/omitido, o cron dispara para todas as empresas ativas (comportamento correto).
    let empresaIdFinal;
    if (req.user && !req.user.is_super) {
      // Tenant autenticado: usa sempre a própria empresa
      empresaIdFinal = req.user.empresa_id;
    } else {
      // n8n via API Key ou Super Admin: respeita o body
      empresaIdFinal = req.body?.empresa_id || null;
    }

    const { data_referencia, enviar_whatsapp = true, instance = INSTANCIA_PADRAO } = req.body || {};

    const formatBRL = (v) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

    let empresasQuery = `
      SELECT e.id, e.nome, e.slug, e.cnpj_cpf, e.email, e.telefone,
             COALESCE(c.regua_cobranca_ativa, 1) as regua_cobranca_ativa,
             COALESCE(c.regua_aviso_previo, 1) as regua_aviso_previo,
             COALESCE(c.regua_dias_antes, 3) as regua_dias_antes,
             COALESCE(c.regua_no_vencimento, 1) as regua_no_vencimento,
             COALESCE(c.regua_aviso_atraso, 1) as regua_aviso_atraso,
             COALESCE(c.regua_dias_depois, 3) as regua_dias_depois,
             c.chave_pix_cobranca,
             c.whatsapp_status,
             c.whatsapp_instancia_nome
      FROM empresas e
      LEFT JOIN configuracoes_automacoes_whatsapp c ON c.empresa_id = e.id
      WHERE e.ativo = 1`;
    let empresasParams = [];
    if (empresaIdFinal) {
      empresasQuery += ` AND e.id = ?`;
      empresasParams.push(empresaIdFinal);
    }
    const [empresas] = await db.query(empresasQuery, empresasParams);

    const relatorioDisparos = [];

    for (const emp of empresas) {
      // Se a régua estiver desativada para esta empresa e não for teste manual direto
      if (emp.regua_cobranca_ativa === 0 && !empresaIdFinal) {
        continue;
      }

      const diasAntes = parseInt(emp.regua_dias_antes, 10) || 3;
      const diasDepois = parseInt(emp.regua_dias_depois, 10) || 3;
      const avisoPrevio = emp.regua_aviso_previo === 1;
      const noVencimento = emp.regua_no_vencimento === 1;
      const avisoAtraso = emp.regua_aviso_atraso === 1;

      // Montar condições de data dinâmicas
      const dateClauses = [];
      if (avisoPrevio) dateClauses.push(`t.data_vencimento = DATE_ADD(CURDATE(), INTERVAL ${diasAntes} DAY)`);
      if (noVencimento) dateClauses.push(`t.data_vencimento = CURDATE()`);
      if (avisoAtraso) dateClauses.push(`t.data_vencimento = DATE_SUB(CURDATE(), INTERVAL ${diasDepois} DAY)`);

      if (dateClauses.length === 0) continue;

      const [faturas] = await db.query(
        `SELECT t.id, t.descricao, t.valor, t.data_vencimento,
                DATEDIFF(t.data_vencimento, CURDATE()) as dias_para_vencimento,
                c.id as contato_id, c.nome as contato_nome, c.telefone as contato_telefone, c.cpf_cnpj
         FROM transacoes_financeiras t
         JOIN contatos c ON c.id = t.contato_id
         WHERE t.empresa_id = ? AND t.tipo = 'receita' AND t.status = 'pendente'
           AND c.telefone IS NOT NULL AND TRIM(c.telefone) != ''
           AND (${dateClauses.join(" OR ")})
         ORDER BY t.data_vencimento ASC`,
        [emp.id]
      );

      for (const fatura of faturas) {
        const cleanTel = (fatura.contato_telefone || "").replace(/\D/g, "");
        if (!cleanTel || cleanTel.length < 10) continue;

        const valorFormatado = formatBRL(fatura.valor);
        const dataVencFormatada = new Date(fatura.data_vencimento).toLocaleDateString("pt-BR", { timeZone: "UTC" });
        const chavePix = emp.chave_pix_cobranca || emp.cnpj_cpf || emp.email || emp.telefone || "contato@nuvycore.online";

        const payloadPix = gerarPayloadPix({
          chave: chavePix,
          nomeRecebedor: emp.nome,
          cidade: "SAO PAULO",
          valor: fatura.valor,
          txid: `FAT${fatura.id}`.slice(0, 25),
        });

        let tipoRegua = "";
        let mensagemTexto = "";

        if (fatura.dias_para_vencimento === diasAntes && avisoPrevio) {
          tipoRegua = `D-${diasAntes} (Lembrete Preventivo)`;
          mensagemTexto = `Olá, *${fatura.contato_nome}*! 👋\n\n` +
            `Passando para lembrar que sua fatura de *${valorFormatado}* referente a *${fatura.descricao}* vencerá em ${diasAntes} dias (*${dataVencFormatada}*).\n\n` +
            `Para antecipar com facilidade via PIX Copia e Cola:\n\n` +
            `\`${payloadPix}\`\n\n` +
            `Atenciosamente,\n*${emp.nome}*`;
        } else if (fatura.dias_para_vencimento === 0 && noVencimento) {
          tipoRegua = "D-0 (Vence Hoje)";
          mensagemTexto = `Olá, *${fatura.contato_nome}*! 🔔\n\n` +
            `Sua fatura de *${valorFormatado}* referente a *${fatura.descricao}* vence *HOJE* (*${dataVencFormatada}*).\n\n` +
            `Copie o código PIX abaixo para efetuar o pagamento:\n\n` +
            `\`${payloadPix}\`\n\n` +
            `Caso já tenha efetuado o pagamento, por favor desconsidere este aviso.\n\n` +
            `*${emp.nome}*`;
        } else if (fatura.dias_para_vencimento === -diasDepois && avisoAtraso) {
          tipoRegua = `D+${diasDepois} (Aviso de Pendência)`;
          mensagemTexto = `Olá, *${fatura.contato_nome}*! ⚠️\n\n` +
            `Constatamos que a fatura de *${valorFormatado}* (${fatura.descricao}) com vencimento em *${dataVencFormatada}* ainda consta pendente em nosso sistema.\n\n` +
            `Para regularizar via PIX Copia e Cola:\n\n` +
            `\`${payloadPix}\`\n\n` +
            `Se precisar de suporte ou segunda via, responda a esta mensagem.\n\n` +
            `*${emp.nome}*`;
        }

        if (mensagemTexto && enviar_whatsapp) {
          const canal = emp.canal_preferencial || "sms";
          if (canal === "sms" || emp.whatsapp_status !== "conectado") {
            await SmsnetService.enviarSms({
              telefone: cleanTel,
              mensagem: mensagemTexto,
              usuario: emp.smsnet_usuario,
              token: emp.smsnet_token,
            });
          } else {
            const instanceEnvio = (emp.whatsapp_status === "conectado" && emp.whatsapp_instancia_nome)
              ? emp.whatsapp_instancia_nome
              : (instance || INSTANCIA_PADRAO);
            await enviarTextoWhatsApp(cleanTel, mensagemTexto, instanceEnvio);
          }
        }

        relatorioDisparos.push({
          empresa: emp.nome,
          fatura_id: fatura.id,
          cliente: fatura.contato_nome,
          telefone: cleanTel,
          valor: fatura.valor,
          tipo_regua: tipoRegua,
          canal: emp.canal_preferencial || "sms",
          status_envio: enviar_whatsapp ? "enviado" : "simulado",
        });
      }
    }

    return res.json({
      sucesso: true,
      total_processados: relatorioDisparos.length,
      disparos: relatorioDisparos,
      data_execucao: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Erro ao disparar régua de cobrança:", err);
    return res.status(500).json({ error: "Erro ao executar régua de cobrança." });
  }
};

// 10. Resumo Matinal Financeiro Automatizado
const dispararResumoMatinalGeral = async (req, res) => {
  try {
    let empresa_id;
    if (req.user && !req.user.is_super) {
      empresa_id = req.user.empresa_id;
    } else {
      empresa_id = req.body?.empresa_id || null;
    }

    const { instance = INSTANCIA_PADRAO } = req.body || {};

    const formatBRL = (v) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

    let queryEmpresas = `
      SELECT e.id, e.nome, e.slug,
             COALESCE(c.resumo_matinal_ativo, 1) as resumo_matinal_ativo,
             c.resumo_matinal_telefones,
             c.sms_ativo,
             c.smsnet_usuario,
             c.smsnet_token,
             COALESCE(c.canal_preferencial, 'sms') as canal_preferencial,
             c.whatsapp_status,
             c.whatsapp_instancia_nome
      FROM empresas e
      LEFT JOIN configuracoes_automacoes_whatsapp c ON c.empresa_id = e.id
      WHERE e.ativo = 1`;
    let paramsEmpresas = [];
    if (empresa_id) {
      queryEmpresas += ` AND e.id = ?`;
      paramsEmpresas.push(empresa_id);
    }
    const [empresas] = await db.query(queryEmpresas, paramsEmpresas);

    const relatorioEnvios = [];

    for (const emp of empresas) {
      if (emp.resumo_matinal_ativo === 0 && !empresa_id) {
        continue;
      }

      let telefonesDestino = [];
      if (emp.resumo_matinal_telefones && emp.resumo_matinal_telefones.trim()) {
        const list = emp.resumo_matinal_telefones.split(",").map(t => t.trim()).filter(Boolean);
        telefonesDestino = list.map(t => ({ nome: "Gestor", telefone: t }));
      } else {
        const [admins] = await db.query(
          `SELECT id, nome, email, telefone FROM admins WHERE empresa_id = ? AND status = 'ativo' AND telefone IS NOT NULL AND TRIM(telefone) != ''`,
          [emp.id]
        );
        telefonesDestino = admins;
      }

      if (telefonesDestino.length === 0) continue;

      // Saldo Consolidado
      const [contas] = await db.query(
        `SELECT nome, banco, saldo_atual FROM contas_bancarias WHERE empresa_id = ? AND ativo = 1`,
        [emp.id]
      );
      const saldoTotal = contas.reduce((acc, c) => acc + parseFloat(c.saldo_atual || 0), 0);
      const contasTexto = contas.map(c => `  • ${c.nome}: ${formatBRL(c.saldo_atual)}`).join("\n");

      // Contas a Pagar Vencendo Hoje
      const [pagarHoje] = await db.query(
        `SELECT descricao, valor FROM transacoes_financeiras WHERE empresa_id = ? AND tipo = 'despesa' AND status = 'pendente' AND data_vencimento = CURDATE()`,
        [emp.id]
      );
      const totalPagarHoje = pagarHoje.reduce((acc, p) => acc + parseFloat(p.valor || 0), 0);

      // Contas a Receber Vencendo Hoje
      const [receberHoje] = await db.query(
        `SELECT descricao, valor FROM transacoes_financeiras WHERE empresa_id = ? AND tipo = 'receita' AND status = 'pendente' AND data_vencimento = CURDATE()`,
        [emp.id]
      );
      const totalReceberHoje = receberHoje.reduce((acc, r) => acc + parseFloat(r.valor || 0), 0);

      // Inadimplência / Atrasos
      const [atrasos] = await db.query(
        `SELECT tipo, COUNT(*) as qtd, SUM(valor) as total FROM transacoes_financeiras WHERE empresa_id = ? AND status = 'pendente' AND data_vencimento < CURDATE() GROUP BY tipo`,
        [emp.id]
      );
      const atrasoDesp = atrasos.find(a => a.tipo === 'despesa')?.total || 0;
      const atrasoRec = atrasos.find(a => a.tipo === 'receita')?.total || 0;

      // DRE do Mês
      const [dre] = await db.query(
        `SELECT 
          COALESCE(SUM(CASE WHEN tipo = 'receita' AND status = 'pago' THEN valor_pago ELSE 0 END), 0) as receita,
          COALESCE(SUM(CASE WHEN tipo = 'despesa' AND status = 'pago' THEN valor_pago ELSE 0 END), 0) as despesa
         FROM transacoes_financeiras
         WHERE empresa_id = ? AND MONTH(data_competencia) = MONTH(CURRENT_DATE()) AND YEAR(data_competencia) = YEAR(CURRENT_DATE())`,
        [emp.id]
      );
      const recMes = parseFloat(dre[0]?.receita || 0);
      const despMes = parseFloat(dre[0]?.despesa || 0);
      const lucroMes = recMes - despMes;

      const hojeFormatado = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

      const mensagemBriefing = `☀️ [Nuvy Finance] Briefing Matinal - ${hojeFormatado} | ${emp.nome}\n\n` +
        `🏦 Saldo Total: ${formatBRL(saldoTotal)}\n` +
        `📥 A Receber Hoje: ${formatBRL(totalReceberHoje)} (${receberHoje.length} lançamentos)\n` +
        `📤 A Pagar Hoje: ${formatBRL(totalPagarHoje)} (${pagarHoje.length} contas)\n` +
        `📊 Lucro do Mês: ${formatBRL(lucroMes)} ${lucroMes >= 0 ? "(Lucro)" : "(Prejuízo)"}\n` +
        (atrasoDesp > 0 || atrasoRec > 0 ? `⚠️ Pendências em Atraso: Rec ${formatBRL(atrasoRec)} | Desp ${formatBRL(atrasoDesp)}\n` : "");

      for (const dest of telefonesDestino) {
        const cleanTel = (dest.telefone || "").replace(/\D/g, "");
        if (cleanTel && cleanTel.length >= 8) {
          if (emp.canal_preferencial === "sms" || emp.whatsapp_status !== "conectado") {
            await SmsnetService.enviarSms({
              telefone: cleanTel,
              mensagem: mensagemBriefing,
              usuario: emp.smsnet_usuario,
              token: emp.smsnet_token,
            });
          } else {
            await enviarTextoWhatsApp(cleanTel, mensagemBriefing, instance);
          }
          relatorioEnvios.push({
            empresa: emp.nome,
            admin: dest.nome || "Gestor",
            telefone: cleanTel,
            canal: emp.canal_preferencial || "sms",
            status: "enviado",
          });
        }
      }

      // Envio para o Telegram dos gestores vinculados da empresa
      try {
        const [adminsTelegram] = await db.query(
          `SELECT id, nome, telegram_chat_id FROM admins WHERE empresa_id = ? AND telegram_chat_id IS NOT NULL AND status = 'ativo'`,
          [emp.id]
        );
        for (const admTg of adminsTelegram) {
          if (admTg.telegram_chat_id) {
            await enviarMensagemTelegram(admTg.telegram_chat_id, mensagemBriefing);
            relatorioEnvios.push({
              empresa: emp.nome,
              admin: admTg.nome,
              canal: "telegram",
              status: "enviado",
            });
          }
        }
      } catch (tgErr) {
        console.warn(`[TELEGRAM BRIEFING]: Erro ao enviar para Telegram da empresa ${emp.nome}:`, tgErr.message);
      }
    }

    return res.json({
      sucesso: true,
      total_enviados: relatorioEnvios.length,
      envios: relatorioEnvios,
    });
  } catch (err) {
    console.error("Erro ao disparar resumo matinal:", err);
    return res.status(500).json({ error: "Erro ao executar resumo matinal geral." });
  }
};

// 11. Teste de Envio Direto de Resumo Matinal
const enviarResumoMatinalTeste = async (req, res) => {
  try {
    const { telefone } = req.body;
    const empresaId = req.user?.empresa_id || 1;

    let targetTel = telefone;
    if (!targetTel) {
      const [admin] = await db.query(`SELECT telefone FROM admins WHERE id = ?`, [req.user?.id || 2]);
      targetTel = admin[0]?.telefone;
    }

    if (!targetTel) {
      return res.status(400).json({ error: "Telefone não informado e não encontrado no perfil." });
    }

    const [emp] = await db.query(
      `SELECT e.id, e.nome, c.canal_preferencial, c.smsnet_usuario, c.smsnet_token, c.whatsapp_status
       FROM empresas e
       LEFT JOIN configuracoes_automacoes_whatsapp c ON c.empresa_id = e.id
       WHERE e.id = ?`,
      [empresaId]
    );
    const empData = emp[0] || {};
    const empNome = empData.nome || "Nuvy Core";

    const formatBRL = (v) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

    const [contas] = await db.query(
      `SELECT nome, saldo_atual FROM contas_bancarias WHERE empresa_id = ? AND ativo = 1`,
      [empresaId]
    );
    const saldoTotal = contas.reduce((acc, c) => acc + parseFloat(c.saldo_atual || 0), 0);

    const [pagarHoje] = await db.query(
      `SELECT descricao, valor FROM transacoes_financeiras WHERE empresa_id = ? AND tipo = 'despesa' AND status = 'pendente' AND data_vencimento = CURDATE()`,
      [empresaId]
    );
    const totalPagarHoje = pagarHoje.reduce((acc, p) => acc + parseFloat(p.valor || 0), 0);

    const [receberHoje] = await db.query(
      `SELECT descricao, valor FROM transacoes_financeiras WHERE empresa_id = ? AND tipo = 'receita' AND status = 'pendente' AND data_vencimento = CURDATE()`,
      [empresaId]
    );
    const totalReceberHoje = receberHoje.reduce((acc, r) => acc + parseFloat(r.valor || 0), 0);

    const hojeFormatado = new Date().toLocaleDateString("pt-BR");

    const mensagemBriefing = `☀️ [TESTE Nuvy Finance] Briefing Matinal - ${hojeFormatado} | ${empNome}\n\n` +
      `🏦 Saldo Total: ${formatBRL(saldoTotal)}\n` +
      `📥 A Receber Hoje: ${formatBRL(totalReceberHoje)} (${receberHoje.length} lançamentos)\n` +
      `📤 A Pagar Hoje: ${formatBRL(totalPagarHoje)} (${pagarHoje.length} contas)`;

    if (empData.canal_preferencial === "sms" || empData.whatsapp_status !== "conectado") {
      await SmsnetService.enviarSms({
        telefone: targetTel,
        mensagem: mensagemBriefing,
        usuario: empData.smsnet_usuario,
        token: empData.smsnet_token,
      });
    } else {
      await enviarTextoWhatsApp(targetTel, mensagemBriefing);
    }

    return res.json({ sucesso: true, mensagem: `Resumo Matinal enviado com sucesso para ${targetTel}!` });
  } catch (err) {
    console.error("Erro ao enviar resumo teste:", err);
    return res.status(500).json({ error: "Erro ao enviar resumo matinal de teste." });
  }
};

// 12. Teste de Envio de Cobrança Exemplo com PIX
const enviarCobrancaExemploTeste = async (req, res) => {
  try {
    const { telefone } = req.body;
    const empresaId = req.user?.empresa_id || 1;

    let targetTel = telefone;
    if (!targetTel) {
      const [admin] = await db.query(`SELECT telefone FROM admins WHERE id = ?`, [req.user?.id || 2]);
      targetTel = admin[0]?.telefone;
    }

    if (!targetTel) {
      return res.status(400).json({ error: "Telefone não informado e não encontrado no perfil." });
    }

    const [emp] = await db.query(
      `SELECT e.id, e.nome, e.cnpj_cpf, e.email, e.telefone, c.chave_pix_cobranca, c.canal_preferencial, c.smsnet_usuario, c.smsnet_token, c.whatsapp_status
       FROM empresas e
       LEFT JOIN configuracoes_automacoes_whatsapp c ON c.empresa_id = e.id
       WHERE e.id = ?`,
      [empresaId]
    );

    const empData = emp[0] || {};
    const chavePix = empData.chave_pix_cobranca || empData.cnpj_cpf || empData.email || empData.telefone || "contato@nuvycore.online";
    const valorTeste = 150.00;

    const payloadPix = gerarPayloadPix({
      chave: chavePix,
      nomeRecebedor: empData.nome || "Nuvy Core",
      cidade: "SAO PAULO",
      valor: valorTeste,
      txid: "TESTECOBRANCA01",
    });

    const hojeFormatado = new Date().toLocaleDateString("pt-BR");

    const mensagemCobranca = `🔔 [TESTE] Lembrete de Fatura - ${empData.nome || 'Nuvy Finance'}\n\n` +
      `Olá, Cliente Teste! Sua fatura de R$ 150,00 vence HOJE (${hojeFormatado}).\n\n` +
      `Pague com facilidade via PIX Copia e Cola:\n${payloadPix}`;

    if (empData.canal_preferencial === "sms" || empData.whatsapp_status !== "conectado") {
      await SmsnetService.enviarSms({
        telefone: targetTel,
        mensagem: mensagemCobranca,
        usuario: empData.smsnet_usuario,
        token: empData.smsnet_token,
      });
    } else {
      await enviarTextoWhatsApp(targetTel, mensagemCobranca);
    }

    return res.json({ sucesso: true, mensagem: `Cobrança de teste enviada com sucesso para ${targetTel}!` });
  } catch (err) {
    console.error("Erro ao enviar cobrança teste:", err);
    return res.status(500).json({ error: "Erro ao enviar cobrança de teste." });
  }
};

// 13. Endpoint Dedicado para Disparo Direto de SMS (n8n / API Externa)
const dispararSmsDireto = async (req, res) => {
  try {
    const { telefone, numero, phone, to, mensagem, msg, texto, content, usuario, token } = req.body || {};
    const dest = telefone || numero || phone || to;
    const textoMsg = mensagem || msg || texto || content;

    if (!dest || !textoMsg) {
      return res.status(400).json({ error: "Parâmetros 'telefone' e 'mensagem' são obrigatórios." });
    }

    const resultado = await SmsnetService.enviarSms({
      telefone: dest,
      mensagem: textoMsg,
      usuario,
      token,
    });

    if (resultado.sucesso) {
      return res.json({
        sucesso: true,
        mensagem: `SMS disparado com sucesso via SMSNET para ${resultado.telefone}!`,
        detalhes: resultado.data,
      });
    } else {
      return res.status(400).json({
        sucesso: false,
        error: "Falha ao enviar SMS via SMSNET.",
        detalhes: resultado.error,
      });
    }
  } catch (err) {
    console.error("Erro no endpoint de SMS direto:", err);
    return res.status(500).json({ error: "Erro interno no servidor ao disparar SMS." });
  }
};

// 11. Gestão de Instância Evolution API
const obterStatusInstancia = async (req, res) => {
  try {
    const instanceName = req.query.instance || INSTANCIA_PADRAO;
    const evoRes = await axios.get(`${EVOLUTION_URL}/instance/fetchInstances`, {
      headers: { apikey: EVOLUTION_KEY },
      timeout: 5000,
    });

    const instances = Array.isArray(evoRes.data) ? evoRes.data : [];
    const current = instances.find((i) => i.name === instanceName) || null;

    let state = "disconnected";
    if (current) {
      state = current.connectionStatus || "connecting";
      if (state === "open") state = "connected";
    }

    return res.json({
      instancia: instanceName,
      status: state,
      dados: current,
      evolution_url: EVOLUTION_URL,
    });
  } catch (err) {
    console.error("Erro ao obter status da Evolution API:", err.message);
    return res.json({
      instancia: INSTANCIA_PADRAO,
      status: "disconnected",
      erro: err.message,
    });
  }
};

const gerarQrCodeInstancia = async (req, res) => {
  try {
    const instanceName = req.body?.instance || req.query?.instance || INSTANCIA_PADRAO;
    const evoRes = await axios.get(`${EVOLUTION_URL}/instance/connect/${instanceName}`, {
      headers: { apikey: EVOLUTION_KEY },
      timeout: 10000,
    });

    return res.json({
      sucesso: true,
      instancia: instanceName,
      qrcode: evoRes.data?.base64 || evoRes.data?.qrcode?.base64 || evoRes.data,
      pairingCode: evoRes.data?.pairingCode || null,
      code: evoRes.data?.code || null,
    });
  } catch (err) {
    console.error("Erro ao gerar QR Code na Evolution API:", err.message);
    return res.status(500).json({
      error: "Falha ao gerar QR Code. Verifique se a instância está ativa no Evolution API.",
      detalhes: err.response?.data || err.message,
    });
  }
};

const desconectarInstancia = async (req, res) => {
  try {
    const instanceName = req.body?.instance || req.query?.instance || INSTANCIA_PADRAO;
    await axios.delete(`${EVOLUTION_URL}/instance/logout/${instanceName}`, {
      headers: { apikey: EVOLUTION_KEY },
      timeout: 5000,
    });

    return res.json({ sucesso: true, mensagem: `Instância ${instanceName} desconectada com sucesso.` });
  } catch (err) {
    console.error("Erro ao desconectar instância:", err.message);
    return res.status(500).json({ error: "Erro ao desconectar instância do WhatsApp." });
  }
};

const enviarMensagemTeste = async (req, res) => {
  try {
    const { numero, mensagem } = req.body || {};
    const instanceName = req.body?.instance || INSTANCIA_PADRAO;

    if (!numero || !mensagem) {
      return res.status(400).json({ error: "Número e mensagem são obrigatórios." });
    }

    const cleanNum = numero.replace(/\D/g, "");
    await enviarTextoWhatsApp(cleanNum, mensagem, instanceName);

    return res.json({ sucesso: true, mensagem: "Mensagem enviada com sucesso!" });
  } catch (err) {
    console.error("Erro ao enviar mensagem de teste via Evolution API:", err.message);
    return res.status(500).json({
      error: "Erro ao enviar mensagem via WhatsApp.",
      detalhes: err.response?.data || err.message,
    });
  }
};

// 12. Gestão de Instância Exclusiva do Tenant / Assinante
const obterStatusInstanciaTenant = async (req, res) => {
  try {
    const empresaId = req.user?.empresa_id || req.query.empresa_id;
    if (!empresaId) {
      return res.status(400).json({ error: "Empresa não identificada." });
    }
    const instanceName = `fin_empresa_${empresaId}`;

    const evoRes = await axios.get(`${EVOLUTION_URL}/instance/fetchInstances`, {
      headers: { apikey: EVOLUTION_KEY },
      timeout: 5000,
    }).catch(() => ({ data: [] }));

    const instances = Array.isArray(evoRes.data) ? evoRes.data : [];
    const current = instances.find((i) => i.name === instanceName) || null;

    let status = "desconectado";
    let numeroConectado = null;
    let profileName = null;
    let profilePicUrl = null;

    if (current) {
      if (current.connectionStatus === "open") {
        status = "conectado";
        numeroConectado = current.ownerJid ? current.ownerJid.replace(/@.*$/, "") : null;
        profileName = current.profileName || null;
        profilePicUrl = current.profilePicUrl || null;
      } else if (current.connectionStatus === "connecting") {
        status = "conectando";
      }
    }

    // Atualizar no banco
    await db.query(
      `UPDATE configuracoes_automacoes_whatsapp
       SET whatsapp_status = ?, whatsapp_numero_conectado = ?, whatsapp_instancia_nome = ?
       WHERE empresa_id = ?`,
      [status, numeroConectado, instanceName, empresaId]
    );

    return res.json({
      instancia: instanceName,
      status,
      numero_conectado: numeroConectado,
      profile_name: profileName,
      profile_pic_url: profilePicUrl,
    });
  } catch (err) {
    console.error("Erro ao obter status do WhatsApp do tenant:", err.message);
    return res.json({
      status: "desconectado",
      numero_conectado: null,
    });
  }
};

const conectarInstanciaTenant = async (req, res) => {
  try {
    const empresaId = req.user?.empresa_id;
    if (!empresaId) {
      return res.status(400).json({ error: "Empresa não identificada." });
    }
    const instanceName = `fin_empresa_${empresaId}`;

    // Verificar se a instância já existe
    const evoRes = await axios.get(`${EVOLUTION_URL}/instance/fetchInstances`, {
      headers: { apikey: EVOLUTION_KEY },
      timeout: 5000,
    }).catch(() => ({ data: [] }));

    const instances = Array.isArray(evoRes.data) ? evoRes.data : [];
    const exists = instances.some((i) => i.name === instanceName);

    if (!exists) {
      // Criar instância
      await axios.post(
        `${EVOLUTION_URL}/instance/create`,
        {
          instanceName,
          token: uuidv4(),
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
          groupsIgnore: true,
        },
        {
          headers: { apikey: EVOLUTION_KEY, "Content-Type": "application/json" },
          timeout: 10000,
        }
      );
    }

    // Obter QR Code de conexão
    const qrRes = await axios.get(`${EVOLUTION_URL}/instance/connect/${instanceName}`, {
      headers: { apikey: EVOLUTION_KEY },
      timeout: 10000,
    });

    const qrcode = qrRes.data?.base64 || qrRes.data?.qrcode?.base64 || (typeof qrRes.data === "string" ? qrRes.data : null);
    const pairingCode = qrRes.data?.pairingCode || null;

    await db.query(
      `UPDATE configuracoes_automacoes_whatsapp
       SET whatsapp_status = 'conectando', whatsapp_instancia_nome = ?, whatsapp_qrcode = ?
       WHERE empresa_id = ?`,
      [instanceName, qrcode, empresaId]
    );

    return res.json({
      sucesso: true,
      instancia: instanceName,
      status: "conectando",
      qrcode,
      pairingCode,
    });
  } catch (err) {
    console.error("Erro ao conectar WhatsApp do tenant:", err.response?.data || err.message);
    return res.status(500).json({
      error: "Falha ao gerar QR Code para conexão do WhatsApp.",
      detalhes: err.response?.data || err.message,
    });
  }
};

const desconectarInstanciaTenant = async (req, res) => {
  try {
    const empresaId = req.user?.empresa_id;
    if (!empresaId) {
      return res.status(400).json({ error: "Empresa não identificada." });
    }
    const instanceName = `fin_empresa_${empresaId}`;

    await axios.delete(`${EVOLUTION_URL}/instance/logout/${instanceName}`, {
      headers: { apikey: EVOLUTION_KEY },
      timeout: 8000,
    }).catch(() => null);

    await db.query(
      `UPDATE configuracoes_automacoes_whatsapp
       SET whatsapp_status = 'desconectado', whatsapp_numero_conectado = null, whatsapp_qrcode = null
       WHERE empresa_id = ?`,
      [empresaId]
    );

    return res.json({ sucesso: true, mensagem: "WhatsApp desconectado com sucesso." });
  } catch (err) {
    console.error("Erro ao desconectar WhatsApp do tenant:", err.message);
    return res.status(500).json({ error: "Erro ao desconectar WhatsApp." });
  }
};

const SmsnetService = require("../services/smsnetService");

const enviarSmsTeste = async (req, res) => {
  try {
    const empresaId = req.user?.empresa_id;
    const { telefone } = req.body;

    const [rows] = await db.query(
      `SELECT * FROM configuracoes_automacoes_whatsapp WHERE empresa_id = ?`,
      [empresaId]
    );

    const config = rows[0] || {};
    const destPhone = telefone || req.user?.telefone || config.resumo_matinal_telefones;

    if (!destPhone) {
      return res.status(400).json({ error: "Informe o número de telefone destinatário para o SMS de teste." });
    }

    const mensagem = `[Nuvy Finance] Teste de envio de SMS via SMSNET! Seu sistema de cobrança por SMS está ativo e configurado com sucesso.`;

    const resultado = await SmsnetService.enviarSms({
      telefone: destPhone,
      mensagem,
      usuario: config.smsnet_usuario,
      token: config.smsnet_token,
    });

    if (resultado.sucesso) {
      return res.json({
        sucesso: true,
        mensagem: `SMS de teste enviado com sucesso para ${destPhone}!`,
        detalhes: resultado.data,
      });
    } else {
      return res.status(500).json({
        error: "Falha ao enviar SMS de teste via SMSNET.",
        detalhes: resultado.error,
      });
    }
  } catch (err) {
    console.error("Erro ao testar envio de SMS:", err);
    return res.status(500).json({ error: "Erro ao disparar SMS de teste." });
  }
};

const obterConfigSmsnetSuper = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT sms_ativo, smsnet_usuario, smsnet_token, canal_preferencial 
       FROM configuracoes_automacoes_whatsapp WHERE empresa_id = 1 LIMIT 1`
    );

    const config = rows[0] || {};
    return res.json({
      sms_ativo: Boolean(config.sms_ativo ?? true),
      smsnet_usuario: config.smsnet_usuario || process.env.SMSNET_USUARIO || "",
      smsnet_token: config.smsnet_token || process.env.SMSNET_TOKEN || "",
      canal_preferencial: config.canal_preferencial || "whatsapp",
    });
  } catch (err) {
    console.error("Erro ao obter config SMSNET Super Admin:", err);
    return res.status(500).json({ error: "Erro ao obter configurações SMSNET do Super Admin." });
  }
};

const salvarConfigSmsnetSuper = async (req, res) => {
  try {
    const { sms_ativo, smsnet_usuario, smsnet_token, canal_preferencial } = req.body;

    await db.query(
      `INSERT INTO configuracoes_automacoes_whatsapp (empresa_id, sms_ativo, smsnet_usuario, smsnet_token, canal_preferencial)
       VALUES (1, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         sms_ativo = VALUES(sms_ativo),
         smsnet_usuario = VALUES(smsnet_usuario),
         smsnet_token = VALUES(smsnet_token),
         canal_preferencial = VALUES(canal_preferencial)`,
      [
        sms_ativo ? 1 : 0,
        smsnet_usuario || null,
        smsnet_token || null,
        canal_preferencial || "whatsapp",
      ]
    );

    return res.json({ sucesso: true, mensagem: "Configurações Globais do SMSNET salvas com sucesso!" });
  } catch (err) {
    console.error("Erro ao salvar config SMSNET Super Admin:", err);
    return res.status(500).json({ error: "Erro ao salvar configurações do SMSNET." });
  }
};

module.exports = {
  identificarUsuario,
  lancarTransacao,
  resumoDia,
  consultarDreResumo,
  processarMensagemIA,
  processarMidiaMensagem,
  notificarAtendimentoHumano,
  dispararReguaCobranca,
  dispararResumoMatinalGeral,
  enviarResumoMatinalTeste,
  enviarCobrancaExemploTeste,
  obterStatusInstancia,
  gerarQrCodeInstancia,
  desconectarInstancia,
  enviarMensagemTeste,
  obterStatusInstanciaTenant,
  conectarInstanciaTenant,
  desconectarInstanciaTenant,
  enviarSmsTeste,
  dispararSmsDireto,
  obterConfigSmsnetSuper,
  salvarConfigSmsnetSuper,
  enviarTextoWhatsApp,
};
