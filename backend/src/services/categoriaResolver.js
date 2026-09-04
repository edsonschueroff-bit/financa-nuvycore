const db = require("../../db");

/**
 * Remove acentos, pontuação e caracteres especiais para comparação fonética/textual
 */
const normalizarTexto = (str) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Dicionário Semântico Inteligente de Categorias
 */
const MAPA_SEMANTICO = [
  {
    chave: "transporte",
    palavras: [
      "gasolina", "combustivel", "etanol", "diesel", "posto", "ipiranga", "shell",
      "br", "petrobras", "abastecimento", "uber", "99", "taxi", "transporte",
      "veiculo", "carro", "moto", "pedagio", "estacionamento", "ipva", "oficina",
      "mecanico", "pneu", "multa", "sem parar", "conectcar", "veloe", "passagem",
      "onibus", "metro", "aviao", "combustiveis"
    ],
    nomePadrao: "Transporte & Combustível",
    tipo: "despesa",
    dreGrupo: "despesa_fixa",
    cor: "#0284c7",
  },
  {
    chave: "alimentacao",
    palavras: [
      "almoco", "jantar", "refeicao", "restaurante", "lanche", "ifood", "burger",
      "pizza", "comida", "mercado", "supermercado", "padaria", "cafe", "acougue",
      "hortifruti", "delivery", "churrascaria", "sorvete", "bebida", "refeicoes"
    ],
    nomePadrao: "Alimentação & Refeições",
    tipo: "despesa",
    dreGrupo: "despesa_fixa",
    cor: "#f97316",
  },
  {
    chave: "utilidades",
    palavras: [
      "luz", "energia", "enel", "copel", "cemig", "cpfl", "agua", "sabesp",
      "sanepar", "internet", "claro", "vivo", "tim", "oi", "telefonia", "gas",
      "conta de luz", "conta de agua"
    ],
    nomePadrao: "Aluguel, Luz, Água e Internet",
    tipo: "despesa",
    dreGrupo: "despesa_fixa",
    cor: "#eab308",
  },
  {
    chave: "moradia",
    palavras: [
      "aluguel", "condominio", "iptu", "moradia", "imovel", "casa", "apartamento",
      "inquilino", "imobiliaria"
    ],
    nomePadrao: "Moradia",
    tipo: "despesa",
    dreGrupo: "despesa_fixa",
    cor: "#8b5cf6",
  },
  {
    chave: "saude",
    palavras: [
      "farmacia", "drogaria", "remedio", "medicamento", "medico", "dentista",
      "consulta", "exame", "hospital", "saude", "plano de saude", "unimed",
      "laboratorio", "clinica"
    ],
    nomePadrao: "Saúde & Farmácia",
    tipo: "despesa",
    dreGrupo: "despesa_fixa",
    cor: "#ec4899",
  },
  {
    chave: "software",
    palavras: [
      "software", "saas", "hospedagem", "servidor", "aws", "google cloud",
      "digitalocean", "github", "openai", "chatgpt", "licenca", "antivirus",
      "dominio", "hostinger"
    ],
    nomePadrao: "Softwares e Licenças SaaS",
    tipo: "despesa",
    dreGrupo: "despesa_fixa",
    cor: "#6366f1",
  },
  {
    chave: "salarios",
    palavras: [
      "salario", "pro labore", "prolabore", "folha", "adiantamento", "fgts",
      "inss", "funcionario", "decimo terceiro"
    ],
    nomePadrao: "Salários e Pró-labore",
    tipo: "despesa",
    dreGrupo: "despesa_fixa",
    cor: "#14b8a6",
  },
  {
    chave: "marketing",
    palavras: [
      "marketing", "anuncio", "meta ads", "google ads", "facebook ads",
      "instagram ads", "trafego", "campanha", "propaganda", "publicidade"
    ],
    nomePadrao: "Marketing e Anúncios (Google/Meta)",
    tipo: "despesa",
    dreGrupo: "despesa_fixa",
    cor: "#f43f5e",
  },
  {
    chave: "receita_vendas",
    palavras: [
      "venda", "faturamento", "cliente pagou", "recebimento de cliente",
      "prestacao de servico", "servico prestado", "vendas"
    ],
    nomePadrao: "Vendas de Produtos/Serviços",
    tipo: "receita",
    dreGrupo: "receita_bruta",
    cor: "#059669",
  },
  {
    chave: "receita_rendimentos",
    palavras: [
      "salario recebido", "rendimento", "dividendos", "juros", "comissao",
      "aplicacao financeira", "b3", "fii"
    ],
    nomePadrao: "Receitas Financeiras / Rendimentos",
    tipo: "receita",
    dreGrupo: "receita_bruta",
    cor: "#10b981",
  },
];

/**
 * Encontra a melhor categoria existente na lista ou cria uma nova sob demanda
 */
const resolverOuCriarCategoria = async (empresaId, categoriaSugerida, tipoPreferido = "despesa", textoContexto = "") => {
  // 1. Buscar todas as categorias ativas da empresa
  const [categorias] = await db.query(
    `SELECT id, nome, tipo, dre_grupo FROM categorias_financeiras WHERE empresa_id = ? AND ativo = 1 ORDER BY id ASC`,
    [empresaId]
  );

  const sugNorm = normalizarTexto(categoriaSugerida);
  const ctxNorm = normalizarTexto(textoContexto);

  // 2. TENTATIVA 1: Match direto se a categoria sugerida foi informada
  if (sugNorm) {
    // 2.1 Match exato normalizado
    let match = categorias.find(c => normalizarTexto(c.nome) === sugNorm);
    if (match) return match;

    // 2.2 Match de substring bidirecional (ex: "transporte" em "Transporte & Combustível")
    match = categorias.find(c => {
      const cNorm = normalizarTexto(c.nome);
      return cNorm.includes(sugNorm) || sugNorm.includes(cNorm);
    });
    if (match) return match;

    // 2.3 Match por tokens separados por barra ou e comercial (ex: "Transporte / Veículos")
    const tokensSug = sugNorm.split(/\s+/).filter(t => t.length >= 3);
    match = categorias.find(c => {
      const cNorm = normalizarTexto(c.nome);
      return tokensSug.some(token => cNorm.includes(token));
    });
    if (match) return match;
  }

  // 3. TENTATIVA 2: Mapeamento Semântico via Dicionário de Sinônimos
  // Analisa tanto a categoria sugerida quanto o texto de contexto (ex: "gasolina", "uber")
  const textoParaAnalise = `${sugNorm} ${ctxNorm}`.trim();
  
  for (const item of MAPA_SEMANTICO) {
    const bateuPalavra = item.palavras.some(p => {
      const regex = new RegExp(`\\b${p}\\b`, "i");
      return regex.test(textoParaAnalise) || textoParaAnalise.includes(p);
    });

    if (bateuPalavra) {
      const itemChaveNorm = normalizarTexto(item.chave);
      const itemNomeNorm = normalizarTexto(item.nomePadrao);

      // Procurar se a empresa já tem alguma categoria compatível
      let match = categorias.find(c => {
        const cNorm = normalizarTexto(c.nome);
        return cNorm.includes(itemChaveNorm) || 
               cNorm.includes(itemNomeNorm) || 
               itemNomeNorm.includes(cNorm);
      });

      if (match) return match;

      // Se a empresa NÃO tem, auto-criar a categoria padrão do mapa semântico!
      try {
        const [ins] = await db.query(
          `INSERT INTO categorias_financeiras (empresa_id, nome, tipo, dre_grupo, cor, ativo)
           VALUES (?, ?, ?, ?, ?, 1)`,
          [empresaId, item.nomePadrao, item.tipo, item.dreGrupo, item.cor]
        );
        console.log(`[CATEGORIA AUTO-CRIADA] "${item.nomePadrao}" (ID #${ins.insertId}) para empresa #${empresaId}`);
        return {
          id: ins.insertId,
          nome: item.nomePadrao,
          tipo: item.tipo,
          dre_grupo: item.dreGrupo,
        };
      } catch (errIns) {
        console.error("[CATEGORIA AUTO-CREATE ERROR]:", errIns.message);
      }
    }
  }

  // 4. TENTATIVA 3: Se o usuário especificou uma categoria nova por nome próprio
  // Ex: "Transporte", "Combustível", "Farmácia", "Presentes"
  if (sugNorm && sugNorm.length >= 3) {
    const nomeFormatado = categoriaSugerida
      .trim()
      .split(" ")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

    try {
      const dreGrupo = tipoPreferido === "receita" ? "receita_bruta" : "despesa_fixa";
      const cor = tipoPreferido === "receita" ? "#059669" : "#64748b";
      const [ins] = await db.query(
        `INSERT INTO categorias_financeiras (empresa_id, nome, tipo, dre_grupo, cor, ativo)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [empresaId, nomeFormatado, tipoPreferido, dreGrupo, cor]
      );
      console.log(`[CATEGORIA AUTO-CRIADA POR USUARIO] "${nomeFormatado}" (ID #${ins.insertId}) para empresa #${empresaId}`);
      return {
        id: ins.insertId,
        nome: nomeFormatado,
        tipo: tipoPreferido,
        dre_grupo: dreGrupo,
      };
    } catch (errIns) {
      console.error("[CATEGORIA USER CREATE ERROR]:", errIns.message);
    }
  }

  // 5. TENTATIVA 4: Fallback seguro mantendo estritamente o tipo (receita vs despesa)
  const catMesmoTipo = categorias.find(c => c.tipo === tipoPreferido);
  if (catMesmoTipo) return catMesmoTipo;

  // Fallback final
  return categorias[0] || { id: 1, nome: "Geral", tipo: tipoPreferido };
};

module.exports = {
  resolverOuCriarCategoria,
  normalizarTexto,
  MAPA_SEMANTICO,
};
