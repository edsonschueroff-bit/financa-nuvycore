const db = require("../../db");

// Listar planos SaaS
const listar = async (req, res) => {
  try {
    const { tipo_publico } = req.query;
    let query = `
      SELECT p.*, 
             (SELECT COUNT(*) FROM empresas WHERE plano_saas_id = p.id) as total_assinantes 
      FROM saas_planos p 
    `;
    const params = [];
    if (tipo_publico) {
      query += ` WHERE p.tipo_publico = ? `;
      params.push(tipo_publico);
    }
    query += ` ORDER BY p.tipo_publico ASC, p.valor ASC `;

    const [planos] = await db.query(query, params);

    const planosFormatados = planos.map((p) => {
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

    return res.json(planosFormatados);
  } catch (err) {
    console.error("Erro ao listar planos SaaS:", err);
    return res.status(500).json({ error: "Erro ao buscar planos SaaS" });
  }
};

// Criar plano
const criar = async (req, res) => {
  try {
    const {
      nome,
      descricao,
      valor,
      valor_anual,
      is_popular = false,
      ciclo = "mensal",
      tipo_publico = "empresarial",
      max_filiais = 1,
      max_usuarios = 3,
      max_transacoes_mes = 500,
      recursos,
      ativo = true,
    } = req.body;

    if (!nome || valor === undefined) {
      return res.status(400).json({ error: "Nome e valor do plano são obrigatórios." });
    }

    // Se marcar como popular, desmarcar os outros dentro do mesmo tipo_publico
    if (is_popular) {
      await db.query(`UPDATE saas_planos SET is_popular = 0 WHERE tipo_publico = ?`, [tipo_publico]);
    }

    const [result] = await db.query(
      `INSERT INTO saas_planos 
       (nome, descricao, valor, valor_anual, is_popular, ciclo, tipo_publico, max_filiais, max_usuarios, max_transacoes_mes, recursos, ativo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nome.trim(),
        descricao || null,
        valor,
        valor_anual ? parseFloat(valor_anual) : null,
        is_popular ? 1 : 0,
        ciclo,
        tipo_publico,
        max_filiais,
        max_usuarios,
        max_transacoes_mes,
        recursos ? JSON.stringify(recursos) : null,
        ativo ? 1 : 0,
      ]
    );

    return res.status(201).json({ message: "Plano SaaS criado com sucesso!", id: result.insertId });
  } catch (err) {
    console.error("Erro ao criar plano SaaS:", err);
    return res.status(500).json({ error: "Erro ao salvar plano SaaS" });
  }
};

// Atualizar plano
const atualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nome,
      descricao,
      valor,
      valor_anual,
      is_popular,
      ciclo,
      tipo_publico,
      max_filiais,
      max_usuarios,
      max_transacoes_mes,
      recursos,
      ativo,
    } = req.body;

    // Se marcar como popular, desmarcar os outros do mesmo tipo
    if (is_popular && tipo_publico) {
      await db.query(`UPDATE saas_planos SET is_popular = 0 WHERE tipo_publico = ? AND id != ?`, [tipo_publico, id]);
    }

    await db.query(
      `UPDATE saas_planos 
       SET nome = COALESCE(?, nome),
           descricao = ?,
           valor = COALESCE(?, valor),
           valor_anual = ?,
           is_popular = IFNULL(?, is_popular),
           ciclo = COALESCE(?, ciclo),
           tipo_publico = COALESCE(?, tipo_publico),
           max_filiais = COALESCE(?, max_filiais),
           max_usuarios = COALESCE(?, max_usuarios),
           max_transacoes_mes = COALESCE(?, max_transacoes_mes),
           recursos = ?,
           ativo = IFNULL(?, ativo)
       WHERE id = ?`,
      [
        nome,
        descricao || null,
        valor,
        valor_anual !== undefined && valor_anual !== "" && valor_anual !== null ? parseFloat(valor_anual) : null,
        is_popular !== undefined ? (is_popular ? 1 : 0) : null,
        ciclo,
        tipo_publico,
        max_filiais,
        max_usuarios,
        max_transacoes_mes,
        recursos ? JSON.stringify(recursos) : null,
        ativo !== undefined ? (ativo ? 1 : 0) : null,
        id,
      ]
    );

    return res.json({ message: "Plano atualizado com sucesso!" });
  } catch (err) {
    console.error("Erro ao atualizar plano SaaS:", err);
    return res.status(500).json({ error: "Erro ao atualizar plano" });
  }
};

// Toggle status ativo/inativo
const toggleAtivo = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`UPDATE saas_planos SET ativo = NOT ativo WHERE id = ?`, [id]);
    return res.json({ message: "Status do plano alterado com sucesso!" });
  } catch (err) {
    console.error("Erro ao alterar status do plano:", err);
    return res.status(500).json({ error: "Erro ao alterar status do plano" });
  }
};

// Toggle Destaque (Mais Popular)
const togglePopular = async (req, res) => {
  try {
    const { id } = req.params;
    const [planos] = await db.query(`SELECT is_popular FROM saas_planos WHERE id = ?`, [id]);
    if (!planos.length) return res.status(404).json({ error: "Plano não encontrado" });

    const jaPopular = Boolean(planos[0].is_popular);

    // Se vai virar popular, desmarca os outros
    if (!jaPopular) {
      await db.query(`UPDATE saas_planos SET is_popular = 0`);
      await db.query(`UPDATE saas_planos SET is_popular = 1 WHERE id = ?`, [id]);
    } else {
      await db.query(`UPDATE saas_planos SET is_popular = 0 WHERE id = ?`, [id]);
    }

    return res.json({ message: "Destaque do plano atualizado!" });
  } catch (err) {
    console.error("Erro ao alternar destaque popular:", err);
    return res.status(500).json({ error: "Erro ao atualizar destaque do plano" });
  }
};

// Excluir ou desativar plano
const deletar = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se existem empresas usando este plano
    const [empresas] = await db.query(`SELECT COUNT(*) as total FROM empresas WHERE plano_saas_id = ?`, [id]);
    const totalAssinantes = empresas[0]?.total ? empresas[0].total : 0;

    if (totalAssinantes > 0) {
      // Se tiver assinantes, desativamos o plano em vez de excluir da tabela
      await db.query(`UPDATE saas_planos SET ativo = 0 WHERE id = ?`, [id]);
      return res.json({
        message: `O plano possui ${totalAssinantes} assinante(s) e foi desativado para novas contratações.`,
      });
    }

    await db.query(`DELETE FROM saas_planos WHERE id = ?`, [id]);
    return res.json({ message: "Plano excluído com sucesso!" });
  } catch (err) {
    console.error("Erro ao deletar plano SaaS:", err);
    return res.status(500).json({ error: "Erro ao excluir plano" });
  }
};

module.exports = {
  listar,
  criar,
  atualizar,
  toggleAtivo,
  togglePopular,
  deletar,
};
