const db = require("../../db");
const axios = require("axios");

// Listar contatos com saldo pendente e histórico
const listar = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const { tipo, search, aba } = req.query;

    let query = `SELECT c.*, 
      (SELECT COUNT(*) FROM transacoes_financeiras WHERE contato_id = c.id) as total_transacoes,
      (SELECT COALESCE(SUM(valor_pago), 0) FROM transacoes_financeiras WHERE contato_id = c.id AND tipo = 'receita' AND status = 'pago') as total_pago_receita,
      (SELECT COALESCE(SUM(valor_pago), 0) FROM transacoes_financeiras WHERE contato_id = c.id AND tipo = 'despesa' AND status = 'pago') as total_pago_despesa,
      (SELECT COALESCE(SUM(valor), 0) FROM transacoes_financeiras WHERE contato_id = c.id AND status = 'pendente') as saldo_em_aberto,
      (SELECT COUNT(*) FROM transacoes_financeiras WHERE contato_id = c.id AND status = 'pendente' AND data_vencimento < CURDATE()) as faturas_vencidas_count
     FROM contatos c
     WHERE c.empresa_id = ? AND c.ativo = 1`;
    const params = [empresaId];

    if (tipo && ['cliente', 'fornecedor', 'ambos'].includes(tipo)) {
      query += ` AND (c.tipo = ? OR c.tipo = 'ambos')`;
      params.push(tipo);
    }

    if (aba === "inadimplentes") {
      query += ` AND (SELECT COUNT(*) FROM transacoes_financeiras WHERE contato_id = c.id AND status = 'pendente' AND data_vencimento < CURDATE()) > 0`;
    }

    if (search) {
      query += ` AND (c.nome LIKE ? OR c.razao_social LIKE ? OR c.cpf_cnpj LIKE ? OR c.email LIKE ? OR c.cidade LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term);
    }

    query += ` ORDER BY c.nome ASC`;

    const [contatos] = await db.query(query, params);
    return res.json(contatos);
  } catch (err) {
    console.error("Erro ao listar contatos:", err);
    return res.status(500).json({ error: "Erro ao buscar clientes e fornecedores" });
  }
};

// Obter ficha 360 do contato com histórico de transações
const obterFicha360 = async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.user.empresa_id;

    const [rows] = await db.query(
      `SELECT c.* FROM contatos c WHERE c.id = ? AND c.empresa_id = ?`,
      [id, empresaId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Contato não encontrado" });
    }

    const contato = rows[0];

    const [transacoes] = await db.query(
      `SELECT t.*, cat.nome as categoria_nome, cb.nome as conta_nome
       FROM transacoes_financeiras t
       LEFT JOIN categorias_financeiras cat ON cat.id = t.categoria_id
       LEFT JOIN contas_bancarias cb ON cb.id = t.conta_bancaria_id
       WHERE t.contato_id = ? AND t.empresa_id = ?
       ORDER BY t.data_vencimento DESC, t.id DESC
       LIMIT 100`,
      [id, empresaId]
    );

    const totalFaturado = transacoes
      .filter((t) => t.tipo === "receita" && t.status === "pago")
      .reduce((acc, t) => acc + parseFloat(t.valor_pago || t.valor), 0);

    const totalPendente = transacoes
      .filter((t) => t.status === "pendente")
      .reduce((acc, t) => acc + parseFloat(t.valor), 0);

    return res.json({
      contato,
      resumo: {
        total_faturado: totalFaturado,
        total_pendente: totalPendente,
        total_lancamentos: transacoes.length,
      },
      transacoes,
    });
  } catch (err) {
    console.error("Erro ao obter ficha 360:", err);
    return res.status(500).json({ error: "Erro ao gerar ficha do contato" });
  }
};

// Consultar dados de CNPJ na Receita Federal (BrasilAPI)
const consultarCnpj = async (req, res) => {
  try {
    const { cnpj } = req.params;
    const cleanCnpj = cnpj.replace(/\D/g, "");

    if (cleanCnpj.length !== 14) {
      return res.status(400).json({ error: "CNPJ inválido (deve conter 14 dígitos)" });
    }

    const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
      timeout: 8000,
    });

    const d = response.data;
    return res.json({
      nome: d.nome_fantasia || d.razao_social,
      razao_social: d.razao_social,
      cpf_cnpj: cleanCnpj,
      email: d.email || "",
      telefone: d.ddd_telefone_1 || "",
      cep: d.cep || "",
      endereco: `${d.logradouro || ""}, ${d.numero || "S/N"} ${d.bairro ? "- " + d.bairro : ""}`.trim(),
      cidade: d.municipio || "",
      estado: d.uf || "",
    });
  } catch (err) {
    console.error("Erro ao consultar CNPJ:", err.message);
    return res.status(400).json({ error: "Não foi possível consultar os dados deste CNPJ na Receita Federal." });
  }
};

// Criar contato
const criar = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const {
      tipo = 'cliente',
      nome,
      razao_social,
      cpf_cnpj,
      email,
      telefone,
      endereco,
      cidade,
      estado,
      cep,
      observacoes,
    } = req.body;

    if (!nome) {
      return res.status(400).json({ error: "Nome ou razão social é obrigatório" });
    }

    const [result] = await db.query(
      `INSERT INTO contatos 
       (empresa_id, tipo, nome, razao_social, cpf_cnpj, email, telefone, endereco, cidade, estado, cep, observacoes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId,
        tipo,
        nome.trim(),
        razao_social ? razao_social.trim() : null,
        cpf_cnpj ? cpf_cnpj.trim() : null,
        email ? email.trim() : null,
        telefone ? telefone.trim() : null,
        endereco || null,
        cidade || null,
        estado || null,
        cep || null,
        observacoes || null,
      ]
    );

    return res.status(201).json({ message: "Contato cadastrado com sucesso!", id: result.insertId });
  } catch (err) {
    console.error("Erro ao criar contato:", err);
    return res.status(500).json({ error: "Erro ao cadastrar contato" });
  }
};

// Atualizar contato
const atualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.user.empresa_id;
    const {
      tipo,
      nome,
      razao_social,
      cpf_cnpj,
      email,
      telefone,
      endereco,
      cidade,
      estado,
      cep,
      observacoes,
    } = req.body;

    const [result] = await db.query(
      `UPDATE contatos 
       SET tipo = COALESCE(?, tipo),
           nome = COALESCE(?, nome),
           razao_social = ?,
           cpf_cnpj = ?,
           email = ?,
           telefone = ?,
           endereco = ?,
           cidade = ?,
           estado = ?,
           cep = ?,
           observacoes = ?
       WHERE id = ? AND empresa_id = ?`,
      [
        tipo,
        nome,
        razao_social || null,
        cpf_cnpj || null,
        email || null,
        telefone || null,
        endereco || null,
        cidade || null,
        estado || null,
        cep || null,
        observacoes || null,
        id,
        empresaId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Contato não encontrado" });
    }

    return res.json({ message: "Contato atualizado com sucesso!" });
  } catch (err) {
    console.error("Erro ao atualizar contato:", err);
    return res.status(500).json({ error: "Erro ao atualizar dados do contato" });
  }
};

// Deletar contato (soft delete)
const deletar = async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.user.empresa_id;

    await db.query(`UPDATE contatos SET ativo = 0 WHERE id = ? AND empresa_id = ?`, [id, empresaId]);
    return res.json({ message: "Contato desativado com sucesso!" });
  } catch (err) {
    console.error("Erro ao deletar contato:", err);
    return res.status(500).json({ error: "Erro ao desativar contato" });
  }
};

module.exports = {
  listar,
  obterFicha360,
  consultarCnpj,
  criar,
  atualizar,
  deletar,
};
