const axios = require("axios");
const db = require("../../db");
const { resolverOuCriarCategoria } = require("./categoriaResolver");

const OPENAI_KEY = process.env.OPENAI_API_KEY;

/**
 * Normaliza datas para 'YYYY-MM-DD'
 */
const toDateSQL = (val) => {
  if (!val) return null;
  if (typeof val === "string") {
    const limpo = val.trim();
    const m = limpo.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const br = limpo.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    const d = new Date(limpo);
    if (!isNaN(d.getTime())) return d.toISOString().substring(0, 10);
    return null;
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().substring(0, 10);
  }
  return null;
};

/**
 * Analisa comprovantes fiscais e bancários com GPT-4o Vision com alta precisão
 */
async function analisarComprovanteVisionUniversal(imageInput, legenda = "", admin, empresaId) {
  if (!OPENAI_KEY) {
    throw new Error("OPENAI_API_KEY não configurada no backend.");
  }

  // Obter base64 limpa
  let cleanBase64 = "";
  if (Buffer.isBuffer(imageInput)) {
    cleanBase64 = `data:image/jpeg;base64,${imageInput.toString("base64")}`;
  } else if (typeof imageInput === "string") {
    cleanBase64 = imageInput.startsWith("data:")
      ? imageInput
      : `data:image/jpeg;base64,${imageInput}`;
  } else {
    throw new Error("Formato de imagem inválido para OCR.");
  }

  // Buscar contas bancárias e categorias da empresa
  const [contas] = await db.query(
    `SELECT id, nome, banco, saldo_atual FROM contas_bancarias WHERE empresa_id = ? AND ativo = 1`,
    [empresaId]
  );
  const [categorias] = await db.query(
    `SELECT id, nome, tipo FROM categorias_financeiras WHERE empresa_id = ? AND ativo = 1 ORDER BY nome ASC`,
    [empresaId]
  );

  const titularNome = admin?.nome || "Titular";
  const empresaNome = admin?.emp_nome || "Empresa";

  const promptSystem = `Você é um especialista de precisão máxima em OCR e auditoria fiscal/financeira de comprovantes bancários do Brasil (PIX, TED/DOC, boletos pagos, recibos, cupons fiscais e notas fiscais).

DADOS DO TITULAR DA CONTA / GESTOR DA PLATAFORMA:
- Nome do Titular / Gestor: ${titularNome}
- Nome da Empresa: ${empresaNome}

REGRA DE OURO ABSOLUTA DE CLASSIFICAÇÃO (RECEITA vs DESPESA):
1. RECEITA (Entrada de Dinheiro na conta do Titular/Empresa):
   - Se o Recebedor / Favorecido / Destinatário na imagem for o titular (${titularNome}) ou a empresa (${empresaNome}), ou variação deste nome (ex: nome e sobrenome coincidentes, CPF correspondente): É SEMPRE UMA RECEITA 🟢!
   - ATENÇÃO CRÍTICA: Muitas vezes o documento é um print enviado pelo cliente do banco dele dizendo 'Pix Enviado', 'Comprovante BB', 'Comprovante Santander', 'Transferência Realizada'. Mas se quem RECEBEU o valor foi o titular (${titularNome}), para o nosso controle financeiro É OBRIGATORIAMENTE UMA RECEITA!
   - Nesse caso, a conta bancária da nossa empresa onde o dinheiro entrou é a conta correspondente ao 'banco_destino' (ex: Nubank / Nu Pagamentos, Bradesco, Inter, etc.).
   - O Pagador (cliente) é o contato principal.
2. DESPESA (Saída de Dinheiro da conta do Titular/Empresa):
   - Se o Pagador / Remetente na imagem for o titular (${titularNome}) ou a empresa (${empresaNome}): É UMA DESPESA 🔴.
   - A conta bancária da nossa empresa de onde o dinheiro saiu é a conta correspondente ao 'banco_origem'.
   - O Favorecido/Recebedor (fornecedor/prestador) é o contato principal.

CONTAS BANCÁRIAS CADASTRADAS NO SISTEMA:
${contas.map(c => `- ID ${c.id}: ${c.nome} (Banco: ${c.banco})`).join("\n")}

CATEGORIAS FINANCEIRAS DA EMPRESA:
${categorias.map(c => `- ID ${c.id}: ${c.nome} (${c.tipo})`).join("\n")}

INSTRUÇÃO DE RESPOSTA:
Responda ESTRITAMENTE em formato JSON com os campos abaixo:
{
  "tipo": "receita" ou "despesa",
  "descricao": "Descrição concisa (ex: PIX Recebido de [Nome Pagador] ou Pagamento [Nome Recebedor])",
  "valor": 123.45,
  "data": "YYYY-MM-DD",
  "pagador": "Nome completo de quem pagou (Origem)",
  "recebedor": "Nome completo de quem recebeu (Destino)",
  "banco_origem": "Nome do banco emissor",
  "banco_destino": "Nome do banco recebedor",
  "conta_id": número ID da conta bancária correspondente da lista de contas da empresa (se identificado),
  "conta_nome": "Nome exato da conta bancária identificada",
  "categoria_id": número ID da categoria mais apropriada,
  "categoria_nome": "Nome da categoria",
  "documento_numero": "ID da transação, autenticação ou código do comprovante",
  "status": "pago"
}`;

  const resVision = await axios.post(
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
                ? `Legenda enviada pelo usuário: "${legenda}". Extraia os dados deste comprovante.`
                : "Extraia com atenção máxima todos os dados fiscais e bancários deste comprovante.",
            },
            { type: "image_url", image_url: { url: cleanBase64 } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 35000,
    }
  );

  const rawJson = resVision.data?.choices?.[0]?.message?.content || "{}";
  let ocrResult = {};
  try {
    ocrResult = JSON.parse(rawJson);
  } catch (e) {
    throw new Error("Falha ao interpretar resposta do Vision.");
  }

  // Normalizações
  const tipo = ocrResult.tipo === "receita" ? "receita" : "despesa";
  const valor = Math.abs(parseFloat(ocrResult.valor || 0));
  const dataFormatada = toDateSQL(ocrResult.data) || new Date().toISOString().substring(0, 10);

  // Mapear conta bancária resiliente se não vier com ID válido
  let contaId = ocrResult.conta_id ? parseInt(ocrResult.conta_id) : null;
  let contaNome = ocrResult.conta_nome || null;
  let contaIdentificada = false;

  const contaEncontrada = contas.find(c => c.id === contaId);
  if (contaEncontrada) {
    contaNome = contaEncontrada.nome;
    contaIdentificada = true;
  } else {
    // Tenta casar pelo banco ou termo
    const termoBusca = `${ocrResult.banco_destino || ''} ${ocrResult.banco_origem || ''} ${ocrResult.conta_nome || ''}`.toLowerCase();
    for (const c of contas) {
      const bLower = (c.banco || '').toLowerCase();
      const nLower = (c.nome || '').toLowerCase();
      if ((bLower && termoBusca.includes(bLower)) || (nLower && termoBusca.includes(nLower))) {
        contaId = c.id;
        contaNome = c.nome;
        contaIdentificada = true;
        break;
      }
    }
    if (!contaId && contas.length > 0) {
      contaId = contas[0].id;
      contaNome = contas[0].nome;
      contaIdentificada = false;
    }
  }

  // Categoria
  let catId = ocrResult.categoria_id ? parseInt(ocrResult.categoria_id) : null;
  let catNome = ocrResult.categoria_nome || null;
  const catEncontrada = categorias.find(c => c.id === catId);
  if (catEncontrada) {
    catNome = catEncontrada.nome;
  } else {
    const catObj = await resolverOuCriarCategoria(
      empresaId,
      ocrResult.categoria_nome || null,
      tipo,
      `${ocrResult.descricao || ''} ${ocrResult.pagador || ''} ${ocrResult.recebedor || ''}`
    );
    catId = catObj.id;
    catNome = catObj.nome;
  }

  const descricaoFinal = ocrResult.descricao || (tipo === "receita"
    ? `PIX Recebido de ${ocrResult.pagador || 'Cliente'}`
    : `Pagamento para ${ocrResult.recebedor || 'Fornecedor'}`);

  return {
    sucesso: true,
    tipo,
    descricao: descricaoFinal,
    valor,
    data: dataFormatada,
    data_vencimento: dataFormatada,
    data_pagamento: dataFormatada,
    pagador: ocrResult.pagador || null,
    recebedor: ocrResult.recebedor || null,
    banco_origem: ocrResult.banco_origem || null,
    banco_destino: ocrResult.banco_destino || null,
    conta_id: contaId,
    conta_nome: contaNome || "Conta Principal",
    conta_identificada: contaIdentificada,
    categoria_id: catId,
    categoria_nome: catNome || "Geral",
    documento_numero: ocrResult.documento_numero || null,
    status: "pago",
    status_pagamento: "pago",
  };
}

module.exports = {
  analisarComprovanteVisionUniversal,
  toDateSQL,
};
