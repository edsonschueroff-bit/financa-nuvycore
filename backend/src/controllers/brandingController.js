const db = require("../../db");

// Obter branding público ou por empresa
const obterBranding = async (req, res) => {
  try {
    const { slug } = req.query;
    let empresaId = null;

    if (slug) {
      const [emp] = await db.query(`SELECT id FROM empresas WHERE slug = ?`, [slug]);
      if (emp.length) empresaId = emp[0].id;
    } else if (req.user && req.user.empresa_id) {
      empresaId = req.user.empresa_id;
    }

    let query = `SELECT * FROM sistema_branding WHERE empresa_id = ?`;
    let [rows] = empresaId ? await db.query(query, [empresaId]) : [[]];

    if (!rows.length) {
      // Buscar branding global
      [rows] = await db.query(`SELECT * FROM sistema_branding WHERE empresa_id IS NULL LIMIT 1`);
    }

    const branding = rows.length > 0 ? rows[0] : {
      nome_sistema: "Nuvy Finance",
      cor_primaria: "#059669",
      cor_secundaria: "#2563eb",
      logo_url: null,
      favicon_url: null,
    };

    return res.json(branding);
  } catch (err) {
    console.error("Erro ao obter branding:", err);
    return res.status(500).json({ error: "Erro ao carregar branding" });
  }
};

// Salvar branding
const salvarBranding = async (req, res) => {
  try {
    const isSuper = req.user.is_super;
    const empresaId = isSuper && req.body.global ? null : req.user.empresa_id;
    const { nome_sistema, logo_url, favicon_url, cor_primaria, cor_secundaria } = req.body;

    const [existing] = await db.query(
      `SELECT id FROM sistema_branding WHERE empresa_id <=> ?`,
      [empresaId]
    );

    if (existing.length) {
      await db.query(
        `UPDATE sistema_branding 
         SET nome_sistema = COALESCE(?, nome_sistema),
             logo_url = ?,
             favicon_url = ?,
             cor_primaria = COALESCE(?, cor_primaria),
             cor_secundaria = COALESCE(?, cor_secundaria)
         WHERE id = ?`,
        [nome_sistema, logo_url || null, favicon_url || null, cor_primaria, cor_secundaria, existing[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO sistema_branding (empresa_id, nome_sistema, logo_url, favicon_url, cor_primaria, cor_secundaria)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [empresaId, nome_sistema || 'Nuvy Finance', logo_url || null, favicon_url || null, cor_primaria || '#059669', cor_secundaria || '#2563eb']
      );
    }

    return res.json({ message: "Configuração visual salva com sucesso!" });
  } catch (err) {
    console.error("Erro ao salvar branding:", err);
    return res.status(500).json({ error: "Erro ao atualizar branding" });
  }
};

module.exports = {
  obterBranding,
  salvarBranding,
};
