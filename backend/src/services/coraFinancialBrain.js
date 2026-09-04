const db = require("../../db");
const axios = require("axios");

const OPENAI_KEY = process.env.OPENAI_API_KEY;

const formatBRL = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

/**
 * Monta o Snapshot Financeiro 360° da empresa em tempo real
 */
const obterSnapshotFinanceiroCompleto = async (empresaId, adminId, identificador) => {
  const hojeData = new Date();
  const hojeIso = hojeData.toISOString().split("T")[0];
  const inicioMes = `${hojeIso.slice(0, 7)}-01`;

  // 1. Contas Bancárias
  const [contas] = await db.query(
    `SELECT id, nome, banco, saldo_atual FROM contas_bancarias WHERE empresa_id = ? AND ativo = 1 ORDER BY id ASC`,
    [empresaId]
  );
  const saldoTotal = contas.reduce((acc, c) => acc + parseFloat(c.saldo_atual || 0), 0);

  // 2. Categorias Financeiras
  const [categorias] = await db.query(
    `SELECT id, nome, tipo, dre_grupo FROM categorias_financeiras WHERE empresa_id = ? AND ativo = 1 ORDER BY nome ASC`,
    [empresaId]
  );

  // 3. Lançamentos REALIZADOS/PAGOS HOJE
  const [transacoesHoje] = await db.query(
    `SELECT t.id, t.tipo, t.descricao, COALESCE(t.valor_pago, t.valor) as valor, 
            DATE_FORMAT(COALESCE(t.data_pagamento, t.data_vencimento), '%d/%m/%Y') as data_formatada,
            cat.nome as categoria_nome, c.nome as contato_nome
     FROM transacoes_financeiras t
     LEFT JOIN contatos c ON c.id = t.contato_id
     LEFT JOIN categorias_financeiras cat ON cat.id = t.categoria_id
     WHERE t.empresa_id = ? AND t.status = 'pago' 
       AND (t.data_pagamento = ? OR t.data_vencimento = ? OR t.data_competencia = ?)
     ORDER BY t.id DESC`,
    [empresaId, hojeIso, hojeIso, hojeIso]
  );
  const despesasHoje = transacoesHoje.filter(t => t.tipo === "despesa");
  const receitasHoje = transacoesHoje.filter(t => t.tipo === "receita");
  const totalGastoHoje = despesasHoje.reduce((acc, t) => acc + parseFloat(t.valor || 0), 0);
  const totalRecebidoHoje = receitasHoje.reduce((acc, t) => acc + parseFloat(t.valor || 0), 0);

  // 4. Lançamentos dos Últimos 7 Dias (Histórico Recente)
  const [transacoesRecentes] = await db.query(
    `SELECT t.id, t.tipo, t.descricao, COALESCE(t.valor_pago, t.valor) as valor, 
            DATE_FORMAT(COALESCE(t.data_pagamento, t.data_vencimento), '%d/%m/%Y') as data_formatada,
            cat.nome as categoria_nome
     FROM transacoes_financeiras t
     LEFT JOIN categorias_financeiras cat ON cat.id = t.categoria_id
     WHERE t.empresa_id = ? AND t.status = 'pago' 
       AND COALESCE(t.data_pagamento, t.data_vencimento) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
     ORDER BY t.id DESC LIMIT 15`,
    [empresaId]
  );

  // 5. Contas Pendentes (A Pagar e A Receber)
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
     LIMIT 50`,
    [empresaId]
  );
  const aPagarPendentes = todasPendentes.filter(t => t.tipo === "despesa");
  const aReceberPendentes = todasPendentes.filter(t => t.tipo === "receita");

  // 6. DRE do Mês
  const [dre] = await db.query(
    `SELECT 
       COALESCE(SUM(CASE WHEN tipo = 'receita' AND status = 'pago' THEN valor_pago ELSE 0 END), 0) as receita_liquida,
       COALESCE(SUM(CASE WHEN tipo = 'despesa' AND status = 'pago' THEN valor_pago ELSE 0 END), 0) as despesas_totais
     FROM transacoes_financeiras
     WHERE empresa_id = ? AND data_competencia >= ?`,
    [empresaId, inicioMes]
  );
  const rec = parseFloat(dre[0]?.receita_liquida || 0);
  const desp = parseFloat(dre[0]?.despesas_totais || 0);
  const lucro = rec - desp;

  // 7. Últimos Lançamentos em Geral (Registrados recentemente, pagos ou pendentes)
  const [ultimosLancamentosGeral] = await db.query(
    `SELECT t.id, t.tipo, t.descricao, COALESCE(t.valor_pago, t.valor) as valor, t.status,
            DATE_FORMAT(COALESCE(t.data_pagamento, t.data_vencimento), '%d/%m/%Y') as data_formatada,
            cat.nome as categoria_nome, c.nome as contato_nome
     FROM transacoes_financeiras t
     LEFT JOIN contatos c ON c.id = t.contato_id
     LEFT JOIN categorias_financeiras cat ON cat.id = t.categoria_id
     WHERE t.empresa_id = ?
     ORDER BY t.id DESC LIMIT 10`,
    [empresaId]
  );

  // 8. Rascunho Ativo (Últimos 30 minutos)
  const [rascunhos] = await db.query(
    `SELECT * FROM whatsapp_ia_rascunhos 
     WHERE (admin_id = ? OR telefone LIKE ?) 
       AND TIMESTAMPDIFF(MINUTE, updated_at, NOW()) <= 30
     ORDER BY id DESC LIMIT 1`,
    [adminId, `%${identificador}%`]
  );
  const rascunhoAtivo = rascunhos.length > 0 ? rascunhos[0] : null;

  return {
    hojeIso,
    hojeData,
    saldoTotal,
    contas,
    categorias,
    transacoesHoje,
    despesasHoje,
    receitasHoje,
    totalGastoHoje,
    totalRecebidoHoje,
    transacoesRecentes,
    aPagarPendentes,
    aReceberPendentes,
    ultimosLancamentosGeral,
    rec,
    desp,
    lucro,
    rascunhoAtivo,
  };
};

/**
 * 1. DEFINIÇÃO DAS TOOLS (Function Calling)
 */
const coraTools = [
  {
    type: "function",
    function: {
      name: "create_entry",
      description: "Cria um novo lançamento financeiro (despesa ou receita) que ainda não existe no sistema.",
      parameters: {
        type: "object",
        properties: {
          tipo: {
            type: "string",
            enum: ["despesa", "receita"],
            description: "CRÍTICO: Use 'receita' para salários recebidos, recebimentos de clientes, rendimentos, vendas ou qualquer entrada. Use 'despesa' para pagamentos efetuados, compras, contas de consumo e saídas.",
          },
          descricao: {
            type: "string",
            description: "Nome limpo e resumido da transação (ex: 'Salário - Hokinet', 'Conta de Luz - Enel', 'Supermercado Carrefour'). NUNCA coloque frases inteiras ou comandos do usuário aqui.",
          },
          valor: { type: "number", description: "CRÍTICO: Sempre informe o valor de UMA parcela/recorrência — nunca o total. Exemplos: '10x de R$ 2.500' → valor=2500, parcelas=10. 'Comprei R$ 1.200 em 12x' → valor=100, parcelas=12. '1 pagamento de R$ 500' → valor=500, parcelas=1." },
          categoria: {
            type: "string",
            description: "Categoria mais adequada do plano de contas inferida pelo contexto (ex: Alimentação & Refeições, Aluguel, Luz, Água e Internet, Salários, Vendas).",
          },
          contato_nome: {
            type: "string",
            description: "Nome do estabelecimento, fornecedor (se despesa) ou cliente/pagador (se receita), ex: 'Hokinet', 'Enel', 'Carrefour'. O sistema vinculará ou cadastrará automaticamente.",
          },
          contato_cnpj_cpf: {
            type: "string",
            description: "CNPJ ou CPF do estabelecimento ou pagador se identificado no comprovante ou texto.",
          },
          data_vencimento: { type: "string", description: "Formato AAAA-MM-DD" },
          status_pagamento: {
            type: "string",
            enum: ["pendente", "pago", "recebido"],
            description: "Use 'pago' ou 'recebido' quando a transação já foi realizada hoje ou veio de comprovante quitado. Use 'pendente' apenas para cobranças futuras.",
          },
          data_pagamento: {
            type: "string",
            description: "Formato AAAA-MM-DD. Só preencher se status_pagamento != 'pendente'.",
          },
          conta_bancaria: {
            type: "string",
            description: "Opcional. Nome da conta bancária de liquidação.",
          },
          parcelas: {
            type: "integer",
            description: "Número de parcelas/meses. Use 1 para lançamentos únicos. Quando o usuário disser '10x de R$ 2.500' o valor=2500 e parcelas=10. Quando disser 'parcelei R$ 1.200 em 12x' o valor=100 e parcelas=12. O sistema cria uma linha por mês.",
          },
        },
        required: ["tipo", "descricao", "valor"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_entry",
      description: "Edita campos de um lançamento existente ou prévia.",
      parameters: {
        type: "object",
        properties: {
          transacao_id: { type: "integer", description: "ID da transação a ser editada." },
          tipo: { type: "string", enum: ["despesa", "receita"] },
          descricao: { type: "string" },
          valor: { type: "number" },
          categoria: { type: "string" },
          contato_nome: { type: "string" },
          data_vencimento: { type: "string" },
          status_pagamento: { type: "string", enum: ["pendente", "pago", "recebido"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_transaction",
      description: "Dá baixa (quita) ou atualiza uma transação PENDENTE já existente no snapshot (ex: dar baixa em salário ou conta que foi recebida ou paga).",
      parameters: {
        type: "object",
        properties: {
          transacao_id: { type: "integer", description: "ID exato da transação pendente no snapshot ou identificada na conversa." },
          status: { type: "string", enum: ["pago", "recebido"], description: "Status final: use 'pago' (despesa) ou 'recebido' (receita)." },
          novo_valor: { type: "number", description: "Se o valor real recebido ou pago for diferente do previsto original, envie o novo valor aqui." },
          nova_descricao: { type: "string", description: "Descrição limpa atualizada se houver (ex: 'Salário - Hokinet')." },
          contato_nome: { type: "string", description: "Nome da empresa pagadora ou recebedora (ex: 'Hokinet')." },
          data_pagamento: { type: "string", description: "Formato AAAA-MM-DD" },
          conta_bancaria: { type: "string", description: "Conta bancária de liquidação" },
        },
        required: ["transacao_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_transaction",
      description: "Solicita a exclusão ou cancelamento definitivo de uma transação financeira existente (despesa ou receita). Use OBRIGATORIAMENTE sempre que o usuário pedir para 'excluir', 'apagar', 'deletar', 'remover' uma despesa, receita ou lançamento existente.",
      parameters: {
        type: "object",
        properties: {
          transacao_id: { type: "integer", description: "ID exato da transação a ser excluída/apagada do snapshot ou da conversa recente." },
          descricao: { type: "string", description: "Descrição da transação a ser excluída (ex: 'Gasolina', 'Conta de Luz', 'Salário')." },
          tipo: { type: "string", enum: ["despesa", "receita"], description: "Tipo da transação (despesa ou receita)." },
        },
        required: ["transacao_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_receipt",
      description: "Gera um recibo financeiro oficial em PDF de uma transação existente.",
      parameters: {
        type: "object",
        properties: {
          transacao_id: { type: "integer" },
          descricao: { type: "string" },
          valor: { type: "number" },
        },
        required: ["transacao_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_password_reset",
      description: "Gera um link seguro e código de 6 dígitos para o gestor redefinir sua senha do painel web.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

/**
 * Constrói o System Prompt oficial e infalível da Cora (v3.5 - Function Calling & Zero Friction)
 */
const construirSystemPromptCora = (admin, snapshot) => {
  const contasTexto = snapshot.contas.map(c => `• ${c.nome} (${c.banco || 'Geral'}): ${formatBRL(c.saldo_atual)}`).join("\n") || "Nenhuma conta cadastrada";
  
  const despesasHojeTexto = snapshot.despesasHoje.length > 0
    ? snapshot.despesasHoje.map(d => `• [ID #${d.id}] ${d.descricao}: ${formatBRL(d.valor)} (${d.categoria_nome || 'Geral'})`).join("\n")
    : "Nenhuma despesa realizada/paga hoje.";

  const receitasHojeTexto = snapshot.receitasHoje.length > 0
    ? snapshot.receitasHoje.map(r => `• [ID #${r.id}] ${r.descricao}: ${formatBRL(r.valor)} (${r.categoria_nome || 'Geral'})`).join("\n")
    : "Nenhuma receita recebida hoje.";

  const ultimasTransacoesTexto = snapshot.transacoesRecentes.length > 0
    ? snapshot.transacoesRecentes.map(t => `• [ID #${t.id} - ${t.data_formatada}] ${t.tipo.toUpperCase()}: ${t.descricao} - ${formatBRL(t.valor)}`).join("\n")
    : "Nenhum histórico recente.";

  const ultimosCadastradosTexto = (snapshot.ultimosLancamentosGeral || []).length > 0
    ? (snapshot.ultimosLancamentosGeral || []).map(t => `• [ID #${t.id}] ${t.tipo.toUpperCase()}: ${t.descricao} - ${formatBRL(t.valor)} (Status: ${t.status})`).join("\n")
    : "Nenhum lançamento no sistema.";

  const aPagarTexto = snapshot.aPagarPendentes.slice(0, 15).map(p => `• [ID #${p.id}] ${p.descricao}: ${formatBRL(p.valor)} (Vence: ${p.vencimento_formatado})`).join("\n") || "Nenhuma conta a pagar pendente.";
  const aReceberTexto = snapshot.aReceberPendentes.slice(0, 15).map(r => `• [ID #${r.id}] ${r.descricao}: ${formatBRL(r.valor)} (Receber: ${r.vencimento_formatado})`).join("\n") || "Nenhuma conta a receber pendente.";

  let previaAtualStr = "NENHUMA";
  if (snapshot.rascunhoAtivo) {
    try {
      previaAtualStr = typeof snapshot.rascunhoAtivo.dados_json === "string" 
        ? snapshot.rascunhoAtivo.dados_json 
        : JSON.stringify(snapshot.rascunhoAtivo.dados_json);
    } catch (e) { }
  }

  return `Você é Cora, a Copiloto Financeira Inteligente da Nuvy Finance. Seu objetivo é ajudar o gestor financeiro a controlar suas contas, consultar saldos, gerar relatórios, baixar recibos em PDF e registrar entradas e saídas com extrema agilidade, precisão e ZERO BUROCRACIA. Personalidade: prestativa, direta, refinada e confiável — como uma assistente financeira executiva de alto nível.

═══════════════════════════════════════
1. IDENTIFICAÇÃO E DADOS DE REFERÊNCIA
═══════════════════════════════════════
- Gestor: ${admin.nome}
- Empresa/Titular: ${admin.emp_nome}
- Data e Hora Atual: ${snapshot.hojeData.toLocaleDateString("pt-BR")} às ${snapshot.hojeData.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} (Data ISO: ${snapshot.hojeIso})

═══════════════════════════════════════
2. SNAPSHOT FINANCEIRO COMPLETO EM TEMPO REAL
═══════════════════════════════════════
- Saldo Consolidado: ${formatBRL(snapshot.saldoTotal)}
- Saldos por Conta Bancária:
${contasTexto}

- 🔴 DESPESAS PAGAS/REALIZADAS HOJE (${snapshot.hojeData.toLocaleDateString("pt-BR")}):
Total Gasto Hoje: ${formatBRL(snapshot.totalGastoHoje)} (${snapshot.despesasHoje.length} lançamentos)
${despesasHojeTexto}

- 🟢 RECEITAS RECEBIDAS HOJE (${snapshot.hojeData.toLocaleDateString("pt-BR")}):
Total Recebido Hoje: ${formatBRL(snapshot.totalRecebidoHoje)}
${receitasHojeTexto}

- 📜 ÚLTIMOS LANÇAMENTOS PAGOS (Últimos 7 dias):
${ultimasTransacoesTexto}

- 📌 ÚLTIMOS LANÇAMENTOS REGISTRADOS NO SISTEMA (Qualquer status):
${ultimosCadastradosTexto}

- ⏰ PRÓXIMAS CONTAS A PAGAR (Pendentes a vencer):
${aPagarTexto}

- 💵 PRÓXIMAS CONTAS A RECEBER (Pendentes a receber):
${aReceberTexto}

- 📊 RESULTADO DRE DO MÊS ATUAL:
Receitas Líquidas: ${formatBRL(snapshot.rec)} | Despesas Totais: ${formatBRL(snapshot.desp)} | Resultado/Lucro: ${formatBRL(snapshot.lucro)}

- 🏷️ PLANO DE CONTAS (Categorias Oficiais):
${snapshot.categorias.map(c => `${c.nome} (${c.tipo})`).join(", ")}

- ⚠️ PRÉVIA PENDENTE DESTE GESTOR AGORA:
${previaAtualStr}

═══════════════════════════════════════
3. IDENTIDADE VISUAL E DESIGN DOS RELATÓRIOS
═══════════════════════════════════════
Sempre formate as respostas e resumos financeiros utilizando esta padronização estética de ícones e formatação Markdown:
🔴 Despesas / Gastos | 🟢 Receitas / Entradas | 💰 Saldos / Bancos | 📊 DRE / Lucro | ⏰ Vencimentos | 📜 Extrato 7 dias | ⚠️ Prévias | ✅ Confirmações | 🗑️ Exclusões | 📄 Recibos em PDF

═══════════════════════════════════════
4. REGRAS DE PRECISÃO E AÇÕES (MANDATÓRIAS)
═══════════════════════════════════════
1. DISTINÇÃO INFALÍVEL ENTRE RECEITA E DESPESA:
   - RECEITA (Entrada de Dinheiro / 🟢):
     Sempre que o usuário mencionar: 'meu salário', 'salário que recebi', 'pagou meu salário', 'recebi', 'caiu na conta', 'cliente me pagou', 'venda', 'recebimento', 'comissão', 'rendimento'.
     SE O USUÁRIO DISSER 'não é despesa é receita', trate OBRIGATORIAMENTE como RECEITA 🟢.
   - DESPESA (Saída de Dinheiro / 🔴):
     Pagamentos feitos pelo usuário: contas de consumo (luz, água, internet, gás), aluguel, supermercado, farmácia, restaurantes, compras, tributos e fornecedores.

2. CONTEXTO E MEMÓRIA DE TRANSAÇÃO (DAR BAIXA / EDITAR CONTA EXISTENTE):
   - Se uma transação estiver em foco na conversa recente (exemplo: você acabou de mostrar a receita 'Salário' ID #X prevista para dia 5, ou o usuário perguntou 'Sabe meu salário que iria receber dia 5?'):
   - E em seguida o usuário disser 'edita pra mim', 'novo valor é X e já recebi hj', 'dá baixa', 'marca como pago', 'recebi':
   - Você DEVE chamar update_transaction passando o transacao_id dessa conta que estava em foco, junto com o novo_valor se ele informou, status: 'recebido' (ou 'pago' se for despesa), e data_pagamento de hoje!
   - NUNCA chame create_entry para criar um novo lançamento duplicado quando o usuário estiver apenas quitando ou ajustando uma conta que já existia no snapshot!

3. EXCLUSÃO E APAGAMENTO DE LANÇAMENTOS (CRÍTICO E MANDATÓRIO):
   - Se o usuário pedir para 'excluir', 'apagar', 'deletar', 'remover', 'cancela o lançamento' (ex: 'Quero que você exclui ela', 'exclui a gasolina', 'apaga o lançamento de 10 reais', 'deleta essa receita', 'apaga a última conta'):
   - Você DEVE chamar OBRIGATORIAMENTE a tool delete_transaction passando o transacao_id da transação que está sendo referenciada!
   - JAMAIS, SOB HIPÓTESE ALGUMA, chame update_transaction ou edit_entry quando a intenção do usuário for EXCLUIR / APAGAR!
   - Se ele acabou de registrar, atualizar ou visualizar um lançamento e disse 'exclui ela', 'apaga ela' ou 'deleta isso', use o ID dessa transação recente!

4. AUTO-CATEGORIZAÇÃO INTELIGENTE (ZERO PERGUNTAS / FLUIDEZ TOTAL):
   - NUNCA interrompa o fluxo ou pergunte ao usuário 'qual categoria você quer usar'! Você deve inferir automaticamente a melhor categoria com base no contexto:
     • Combustível, gasolina, etanol, diesel, posto de gasolina, Ipiranga, Shell, Uber, 99, táxi, pedágio, mecânico, IPVA ➔ Transporte & Combustível (CRÍTICO: NUNCA classifique combustível ou veículos como Alimentação!).
     • Supermercado, padaria, restaurante, iFood, lanchonete, hortifruti, café, almoço, jantar ➔ Alimentação & Refeições.
     • Farmácia, remédios, drogaria, médicos, dentistas, exames ➔ Saúde & Farmácia.
     • Luz, água, energia, Enel, Copel, Sabesp, internet, Claro, Vivo, aluguel ➔ Aluguel, Luz, Água e Internet.
     • Salário que o titular recebeu, pró-labore pessoal, comissões ➔ Rendimentos & Outras Receitas ou Salários & Pró-Labore.
     • Pagamentos de clientes por serviços ou produtos ➔ Vendas de Produtos / Serviços.
     • Hospedagem, servidores, SaaS, AWS, OpenAI, softwares ➔ Softwares e Licenças SaaS.
   - AJUSTE EXPLICITO DE CATEGORIA PELO USUÁRIO:
     Se houver uma prévia pendente e o usuário disser 'categoria transporte', 'muda para transporte', 'categoria alimentação', etc.:
     Você DEVE chamar edit_entry ou create_entry atualizando a categoria imediatamente para a categoria solicitada pelo gestor!

5. IDENTIFICAÇÃO E CADASTRO AUTOMÁTICO DE CLIENTES / FORNECEDORES:
   - Sempre que identificar no comprovante ou na mensagem o nome da empresa, loja, cliente ou pessoa (ex: 'Hokinet', 'Enel', 'Carrefour', 'Posto Ipiranga', 'Carlos Eduardo'):
   - Preencha o parâmetro contato_nome com esse nome! O backend cuidará de vincular ou cadastrar esse contato automaticamente na tabela de Contatos do sistema.

6. DESCRIÇÃO LIMPA E PROFISSIONAL:
   - O campo descricao deve ser curto, claro e elegante (ex: 'Salário - Hokinet', 'Conta de Luz - Enel', 'Supermercado Carrefour').
   - NUNCA use a frase inteira dita pelo usuário (ex: JAMAIS coloque 'Novo valor eh de 2.493,97 e já recebi hj' como descrição).

7. FOTOS DE COMPROVANTES E NOTAS FISCAIS:
   - Ao receber foto ou OCR de comprovante já quitado (PIX enviado/recebido, cupom de máquina de cartão, recibo pago):
   - Defina status_pagamento: 'pago' (se despesa) ou 'recebido' (se receita) e data_pagamento de hoje (${snapshot.hojeIso}) ou a data impressa.
   - Extraia o valor exato, o favorecido/pagador (contato_nome) e deduza a categoria automaticamente.

8. GERAÇÃO DE RECIBOS EM PDF:
   - Se o gestor pedir recibo ('gera o recibo', 'quero o comprovante em PDF'): chame generate_receipt com o transacao_id correspondente.

9. RECUPERAÇÃO DE SENHA DO PAINEL WEB:
   - Se o gestor pedir redefinição de senha: chame request_password_reset.

═══════════════════════════════════════
5. COMO RESPONDER (MODO FUNCTION CALLING)
═══════════════════════════════════════
- Chame a tool adequada (create_entry, update_transaction, delete_transaction, edit_entry, generate_receipt, request_password_reset).
- Se a mensagem do usuário for apenas uma pergunta/consulta (saldo, extrato, contas a pagar), NÃO chame nenhuma tool: responda diretamente em texto com a formatação de ícones.`;
};

module.exports = {
  formatBRL,
  obterSnapshotFinanceiroCompleto,
  construirSystemPromptCora,
  coraTools,
};
