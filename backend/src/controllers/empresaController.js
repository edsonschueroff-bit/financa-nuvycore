const db = require("../../db");
const axios = require("axios");

// Listar empresas (Super Admin)
const listarEmpresas = async (req, res) => {
  try {
    const [empresas] = await db.query(
      `SELECT e.*, p.nome as plano_nome, p.valor as plano_valor,
        (SELECT COUNT(*) FROM filiais WHERE empresa_id = e.id) as total_filiais,
        (SELECT COUNT(*) FROM transacoes_financeiras WHERE empresa_id = e.id) as total_transacoes
       FROM empresas e
       LEFT JOIN saas_planos p ON p.id = e.plano_saas_id
       ORDER BY e.id DESC`
    );
    return res.json(empresas);
  } catch (err) {
    console.error("Erro ao listar empresas:", err);
    return res.status(500).json({ error: "Erro ao buscar empresas" });
  }
};

// Criar empresa / Novo Tenant
const criarEmpresa = async (req, res) => {
  try {
    const {
      nome,
      razao_social,
      cnpj_cpf,
      slug,
      email,
      telefone,
      endereco,
      cidade,
      estado,
      cep,
      plano_saas_id,
      status_saas = 'trial',
      trial_dias = 14,
    } = req.body;

    if (!nome || !slug) {
      return res.status(400).json({ error: "Nome e slug são obrigatórios." });
    }

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");

    const [existing] = await db.query(`SELECT id FROM empresas WHERE slug = ?`, [cleanSlug]);
    if (existing.length) {
      return res.status(400).json({ error: "Este slug já está em uso por outra empresa." });
    }

    const parsedPlanoId = plano_saas_id ? parseInt(plano_saas_id, 10) : null;
    const cleanCpfCnpj = cnpj_cpf ? cnpj_cpf.replace(/\D/g, "") : null;
    const cleanCep = cep ? cep.replace(/\D/g, "") : null;

    const [result] = await db.query(
      `INSERT INTO empresas (nome, razao_social, cnpj_cpf, slug, email, telefone, endereco, cidade, estado, cep, plano_saas_id, status_saas, trial_ate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY))`,
      [
        nome.trim(),
        razao_social || null,
        cleanCpfCnpj,
        cleanSlug,
        email || null,
        telefone || null,
        endereco || null,
        cidade || null,
        estado || null,
        cleanCep,
        parsedPlanoId,
        status_saas,
        parseInt(trial_dias, 10) || 14,
      ]
    );

    const empresaId = result.insertId;

    // Criar conta bancária padrão "Caixa Geral" para a nova empresa
    await db.query(
      `INSERT INTO contas_bancarias (empresa_id, nome, banco, tipo, saldo_inicial, saldo_atual, cor)
       VALUES (?, 'Caixa Geral', 'Caixa Físico', 'caixa_fisico', 0.00, 0.00, '#059669')`,
      [empresaId]
    );

    // Se quem criou foi o super admin ou o próprio usuário, vincular
    if (req.user && req.user.id) {
      await db.query(
        `INSERT IGNORE INTO admin_empresas (admin_id, empresa_id, role) VALUES (?, ?, 'proprietario')`,
        [req.user.id, empresaId]
      );
    }

    return res.status(201).json({ message: "Empresa criada com sucesso!", id: empresaId, slug: cleanSlug });
  } catch (err) {
    console.error("Erro ao criar empresa:", err);
    return res.status(500).json({ error: "Erro ao registrar nova empresa" });
  }
};

// Obter dados da empresa atual
const obterEmpresaAtual = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const [rows] = await db.query(
      `SELECT e.*, p.nome as plano_nome, p.valor as plano_valor, p.tipo_publico as plano_tipo_publico 
       FROM empresas e 
       LEFT JOIN saas_planos p ON p.id = e.plano_saas_id 
       WHERE e.id = ?`,
      [empresaId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("Erro ao buscar empresa:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
};

// Atualizar empresa
const atualizarEmpresa = async (req, res) => {
  try {
    // SEGURANÇA: Super Admin pode editar qualquer empresa via /:id.
    // Tenant comum NUNCA pode editar outro tenant — usa sempre sua própria empresa_id do token.
    let empresaId;
    if (req.user.is_super && req.params.id) {
      empresaId = parseInt(req.params.id, 10);
      if (isNaN(empresaId)) {
        return res.status(400).json({ error: "ID de empresa inválido." });
      }
    } else {
      // Rota /minha — tenant só pode editar a própria empresa
      empresaId = req.user.empresa_id;
    }

    if (!empresaId) {
      return res.status(400).json({ error: "Empresa não identificada." });
    }

    const {
      nome,
      razao_social,
      cnpj_cpf,
      email,
      telefone,
      endereco,
      cidade,
      estado,
      cep,
      status_saas,
      plano_saas_id,
      trial_ate,
      limite_filiais,
      limite_usuarios,
    } = req.body;

    // Campos restritos ao Super Admin
    const statusFinal = req.user.is_super ? (status_saas || 'ativo') : undefined;
    const planoFinal = req.user.is_super ? (plano_saas_id ? parseInt(plano_saas_id, 10) : null) : undefined;
    const trialFinal = req.user.is_super ? (trial_ate || null) : undefined;
    const filialFinal = req.user.is_super ? (limite_filiais ? parseInt(limite_filiais, 10) : 1) : undefined;
    const usuariosFinal = req.user.is_super ? (limite_usuarios ? parseInt(limite_usuarios, 10) : 5) : undefined;

    if (req.user.is_super) {
      await db.query(
        `UPDATE empresas 
         SET nome = COALESCE(?, nome),
             razao_social = ?,
             cnpj_cpf = ?,
             email = ?,
             telefone = ?,
             endereco = ?,
             cidade = ?,
             estado = ?,
             cep = ?,
             status_saas = COALESCE(?, status_saas),
             ativo = CASE WHEN ? = 'bloqueado' OR ? = 'cancelado' THEN 0 ELSE 1 END,
             bloqueado_em = CASE WHEN ? = 'bloqueado' THEN NOW() ELSE NULL END,
             plano_saas_id = ?,
             trial_ate = ?,
             limite_filiais = ?,
             limite_usuarios = ?
         WHERE id = ?`,
        [
          nome,
          razao_social || null,
          cnpj_cpf || null,
          email || null,
          telefone || null,
          endereco || null,
          cidade || null,
          estado || null,
          cep || null,
          statusFinal,
          statusFinal,
          statusFinal,
          statusFinal,
          planoFinal,
          trialFinal,
          filialFinal,
          usuariosFinal,
          empresaId,
        ]
      );
    } else {
      // Tenant: só pode atualizar dados básicos da própria empresa
      await db.query(
        `UPDATE empresas 
         SET nome = COALESCE(?, nome),
             razao_social = COALESCE(?, razao_social),
             cnpj_cpf = COALESCE(?, cnpj_cpf),
             email = COALESCE(?, email),
             telefone = COALESCE(?, telefone),
             endereco = COALESCE(?, endereco),
             cidade = COALESCE(?, cidade),
             estado = COALESCE(?, estado),
             cep = COALESCE(?, cep)
         WHERE id = ?`,
        [
          nome || null,
          razao_social || null,
          cnpj_cpf || null,
          email || null,
          telefone || null,
          endereco || null,
          cidade || null,
          // Truncar para max 2 chars (varchar(2) no banco)
          estado ? estado.trim().toUpperCase().substring(0, 2) : null,
          cep || null,
          empresaId,
        ]
      );
    }

    return res.json({ message: "Dados da empresa atualizados com sucesso!" });
  } catch (err) {
    console.error("Erro ao atualizar empresa:", err);
    return res.status(500).json({ error: "Erro ao atualizar dados da empresa" });
  }
};


// Bloquear / Desbloquear / Alterar Status SaaS
const alterarStatusSaas = async (req, res) => {
  try {
    const { id } = req.params;
    const { status_saas } = req.body;

    if (!status_saas) {
      return res.status(400).json({ error: "Status SaaS é obrigatório." });
    }

    const bloqueadoEm = status_saas === 'bloqueado' ? new Date() : null;
    const ativo = (status_saas === 'bloqueado' || status_saas === 'cancelado') ? 0 : 1;

    await db.query(
      `UPDATE empresas SET status_saas = ?, ativo = ?, bloqueado_em = ? WHERE id = ?`,
      [status_saas, ativo, bloqueadoEm, id]
    );

    return res.json({
      message: `Status da empresa alterado para ${status_saas.toUpperCase()} com sucesso!`,
      status_saas,
      ativo,
    });
  } catch (err) {
    console.error("Erro ao alterar status SaaS da empresa:", err);
    return res.status(500).json({ error: "Erro ao alterar status da empresa." });
  }
};

// Excluir empresa (Super Admin)
const excluirEmpresa = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const empresaId = parseInt(id, 10);

    // Proteção de segurança: nunca permitir excluir a empresa raiz (ID: 1)
    if (empresaId === 1) {
      await connection.rollback();
      return res.status(403).json({ error: "A empresa matriz principal (ID 1) não pode ser excluída." });
    }

    // Excluir dados relacionados
    await connection.query(`DELETE FROM transacoes_financeiras WHERE empresa_id = ?`, [empresaId]);
    await connection.query(`DELETE FROM contas_bancarias WHERE empresa_id = ?`, [empresaId]);
    await connection.query(`DELETE FROM categorias_financeiras WHERE empresa_id = ?`, [empresaId]);
    await connection.query(`DELETE FROM contatos WHERE empresa_id = ?`, [empresaId]);
    await connection.query(`DELETE FROM admin_empresas WHERE empresa_id = ?`, [empresaId]);
    await connection.query(`DELETE FROM saas_faturas WHERE empresa_id = ?`, [empresaId]);
    await connection.query(`DELETE FROM empresas WHERE id = ?`, [empresaId]);

    await connection.commit();
    return res.json({ message: "Empresa e todos os seus dados foram excluídos com sucesso!" });
  } catch (err) {
    await connection.rollback();
    console.error("Erro ao excluir empresa:", err);
    return res.status(500).json({ error: "Erro ao excluir empresa." });
  } finally {
    connection.release();
  }
};

// Obter configurações de automações WhatsApp do tenant
const obterConfiguracoesAutomacoes = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const [rows] = await db.query(
      `SELECT * FROM configuracoes_automacoes_whatsapp WHERE empresa_id = ?`,
      [empresaId]
    );

    const [usuarios] = await db.query(
      `SELECT id, nome, email, telefone FROM admins WHERE empresa_id = ? AND status = 'ativo' ORDER BY nome ASC`,
      [empresaId]
    );

    if (rows.length > 0) {
      return res.json({
        ...rows[0],
        usuarios: usuarios || [],
      });
    }

    // Se não existir, criar registro padrão com a chave da empresa
    const [emp] = await db.query(`SELECT id, cnpj_cpf, email, telefone FROM empresas WHERE id = ?`, [empresaId]);
    const chaveDefault = emp[0]?.cnpj_cpf || emp[0]?.email || emp[0]?.telefone || "contato@nuvycore.online";

    await db.query(
      `INSERT INTO configuracoes_automacoes_whatsapp (
        empresa_id, resumo_matinal_ativo, resumo_matinal_horario,
        regua_cobranca_ativa, regua_cobranca_horario, regua_aviso_previo, regua_dias_antes,
        regua_no_vencimento, regua_aviso_atraso, regua_dias_depois, chave_pix_cobranca,
        copiloto_ia_ativo, audio_transcricao_ativa, ocr_comprovantes_ativo
      ) VALUES (?, 1, '08:30', 1, '09:00', 1, 3, 1, 1, 3, ?, 1, 1, 1)
      ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      [empresaId, chaveDefault]
    );

    const [novaConfig] = await db.query(
      `SELECT * FROM configuracoes_automacoes_whatsapp WHERE empresa_id = ?`,
      [empresaId]
    );

    return res.json({
      ...(novaConfig[0] || {}),
      usuarios: usuarios || [],
    });
  } catch (err) {
    console.error("Erro ao obter configurações de automações:", err);
    return res.status(500).json({ error: "Erro ao buscar configurações de automações." });
  }
};

// Salvar configurações de automações WhatsApp / SMS do tenant
const salvarConfiguracoesAutomacoes = async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    const {
      resumo_matinal_ativo,
      resumo_matinal_horario = '08:30',
      resumo_matinal_telefones = null,
      regua_cobranca_ativa,
      regua_cobranca_horario = '09:00',
      regua_aviso_previo,
      regua_dias_antes = 3,
      regua_no_vencimento,
      regua_aviso_atraso,
      regua_dias_depois = 3,
      chave_pix_cobranca = null,
      copiloto_ia_ativo,
      audio_transcricao_ativa,
      ocr_comprovantes_ativo,
      sms_ativo = 0,
      smsnet_usuario = null,
      smsnet_token = null,
      canal_preferencial = 'whatsapp',
    } = req.body;

    await db.query(
      `INSERT INTO configuracoes_automacoes_whatsapp (
        empresa_id,
        resumo_matinal_ativo, resumo_matinal_horario, resumo_matinal_telefones,
        regua_cobranca_ativa, regua_cobranca_horario, regua_aviso_previo, regua_dias_antes,
        regua_no_vencimento, regua_aviso_atraso, regua_dias_depois, chave_pix_cobranca,
        copiloto_ia_ativo, audio_transcricao_ativa, ocr_comprovantes_ativo,
        sms_ativo, smsnet_usuario, smsnet_token, canal_preferencial
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        resumo_matinal_ativo = VALUES(resumo_matinal_ativo),
        resumo_matinal_horario = VALUES(resumo_matinal_horario),
        resumo_matinal_telefones = VALUES(resumo_matinal_telefones),
        regua_cobranca_ativa = VALUES(regua_cobranca_ativa),
        regua_cobranca_horario = VALUES(regua_cobranca_horario),
        regua_aviso_previo = VALUES(regua_aviso_previo),
        regua_dias_antes = VALUES(regua_dias_antes),
        regua_no_vencimento = VALUES(regua_no_vencimento),
        regua_aviso_atraso = VALUES(regua_aviso_atraso),
        regua_dias_depois = VALUES(regua_dias_depois),
        chave_pix_cobranca = VALUES(chave_pix_cobranca),
        copiloto_ia_ativo = VALUES(copiloto_ia_ativo),
        audio_transcricao_ativa = VALUES(audio_transcricao_ativa),
        ocr_comprovantes_ativo = VALUES(ocr_comprovantes_ativo),
        sms_ativo = VALUES(sms_ativo),
        smsnet_usuario = VALUES(smsnet_usuario),
        smsnet_token = VALUES(smsnet_token),
        canal_preferencial = VALUES(canal_preferencial),
        updated_at = NOW()`,
      [
        empresaId,
        resumo_matinal_ativo ? 1 : 0,
        resumo_matinal_horario,
        resumo_matinal_telefones || null,
        regua_cobranca_ativa ? 1 : 0,
        regua_cobranca_horario,
        regua_aviso_previo ? 1 : 0,
        parseInt(regua_dias_antes, 10) || 3,
        regua_no_vencimento ? 1 : 0,
        regua_aviso_atraso ? 1 : 0,
        parseInt(regua_dias_depois, 10) || 3,
        chave_pix_cobranca || null,
        copiloto_ia_ativo ? 1 : 0,
        audio_transcricao_ativa ? 1 : 0,
        ocr_comprovantes_ativo ? 1 : 0,
        sms_ativo ? 1 : 0,
        smsnet_usuario || null,
        smsnet_token || null,
        canal_preferencial || 'whatsapp',
      ]
    );

    return res.json({ sucesso: true, message: "Configurações de automações salvas com sucesso!" });
  } catch (err) {
    console.error("Erro ao salvar configurações de automações:", err);
    return res.status(500).json({ error: "Erro ao salvar preferências de automações." });
  }
};

// Estender Trial da Empresa (Super Admin)
const estenderTrial = async (req, res) => {
  try {
    const { id } = req.params;
    const { dias = 7 } = req.body;

    const [emp] = await db.query(`SELECT id, trial_ate, status_saas FROM empresas WHERE id = ?`, [id]);
    if (!emp.length) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    await db.query(
      `UPDATE empresas 
       SET status_saas = 'trial',
           trial_ate = DATE_ADD(GREATEST(COALESCE(trial_ate, CURDATE()), CURDATE()), INTERVAL ? DAY),
           ativo = 1,
           bloqueado_em = NULL
       WHERE id = ?`,
      [parseInt(dias, 10) || 7, id]
    );

    return res.json({ sucesso: true, mensagem: `Trial estendido em ${dias} dias com sucesso!` });
  } catch (err) {
    console.error("Erro ao estender trial:", err);
    return res.status(500).json({ error: "Erro interno ao estender trial." });
  }
};

// Obter Dossiê 360 Completo da Empresa (Super Admin)
const obterDossieEmpresa = async (req, res) => {
  try {
    const { id } = req.params;

    const [empRows] = await db.query(
      `SELECT e.*, p.nome as plano_nome, p.valor as plano_valor, p.max_usuarios as plano_limite_usuarios
       FROM empresas e
       LEFT JOIN saas_planos p ON p.id = e.plano_saas_id
       WHERE e.id = ?`,
      [id]
    );

    if (empRows.length === 0) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }
    const empresa = empRows[0];

    // Estatísticas de Uso
    const [txTotal] = await db.query("SELECT COUNT(*) as total, SUM(CASE WHEN tipo='receita' THEN valor ELSE 0 END) as receita_total, SUM(CASE WHEN tipo='despesa' THEN valor ELSE 0 END) as despesa_total FROM transacoes_financeiras WHERE empresa_id = ?", [id]);
    const [txMes] = await db.query("SELECT COUNT(*) as total FROM transacoes_financeiras WHERE empresa_id = ? AND MONTH(data_competencia) = MONTH(CURRENT_DATE()) AND YEAR(data_competencia) = YEAR(CURRENT_DATE())", [id]);
    const [saldoContas] = await db.query("SELECT SUM(saldo_atual) as saldo_geral, COUNT(*) as total_contas FROM contas_bancarias WHERE empresa_id = ?", [id]);
    const [usuarios] = await db.query("SELECT u.id, u.nome, u.email, ae.role, ae.ativo, u.created_at FROM admins u JOIN admin_empresas ae ON ae.admin_id = u.id WHERE ae.empresa_id = ?", [id]);
    const [contatosCount] = await db.query("SELECT COUNT(*) as total FROM contatos WHERE empresa_id = ?", [id]);
    const [centrosCount] = await db.query("SELECT COUNT(*) as total FROM centros_custo WHERE empresa_id = ?", [id]);

    // Histórico Financeiro SaaS
    const [faturas] = await db.query(
      "SELECT * FROM saas_faturas WHERE empresa_id = ? ORDER BY id DESC LIMIT 12",
      [id]
    );
    const [ltvRow] = await db.query(
      "SELECT SUM(valor) as ltv FROM saas_faturas WHERE empresa_id = ? AND status = 'pago'",
      [id]
    );

    // Histórico de Suporte
    const [chamados] = await db.query(
      "SELECT * FROM suporte_chamados WHERE empresa_id = ? ORDER BY id DESC LIMIT 10",
      [id]
    );

    return res.json({
      empresa,
      estatisticas: {
        total_transacoes: txTotal[0]?.total || 0,
        transacoes_mes_atual: txMes[0]?.total || 0,
        receita_acumulada: parseFloat(txTotal[0]?.receita_total || 0),
        despesa_acumulada: parseFloat(txTotal[0]?.despesa_total || 0),
        saldo_bancario_atual: parseFloat(saldoContas[0]?.saldo_geral || 0),
        total_contas_bancarias: saldoContas[0]?.total_contas || 0,
        total_contatos: contatosCount[0]?.total || 0,
        total_centros_custo: centrosCount[0]?.total || 0,
      },
      usuarios,
      financeiro_saas: {
        ltv: parseFloat(ltvRow[0]?.ltv || 0),
        total_faturas: faturas.length,
        faturas,
      },
      suporte: {
        total_chamados: chamados.length,
        chamados,
      },
    });
  } catch (err) {
    console.error("Erro ao obter dossiê da empresa:", err);
    return res.status(500).json({ error: "Erro ao gerar dossiê 360 da empresa" });
  }
};

const consultarCnpj = async (req, res) => {
  try {
    const { cnpj } = req.params;
    const cleanCnpj = (cnpj || "").replace(/\D/g, "");
    if (cleanCnpj.length !== 14) {
      return res.status(400).json({ error: "CNPJ deve conter 14 dígitos numéricos." });
    }

    // 1. Tenta BrasilAPI
    try {
      const resp = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, { timeout: 8000 });
      const data = resp.data;
      return res.json({
        sucesso: true,
        cnpj: cleanCnpj,
        razao_social: data.razao_social,
        nome_fantasia: data.nome_fantasia || data.razao_social,
        logradouro: `${data.descricao_tipo_de_logradouro || ""} ${data.logradouro || ""}`.trim(),
        numero: data.numero,
        complemento: data.complemento,
        bairro: data.bairro,
        cep: data.cep?.replace(/\D/g, ""),
        cidade: data.municipio,
        estado: data.uf,
        telefone: data.ddd_telefone_1 || data.ddd_telefone_2,
        email: data.email,
        cnae: data.cnae_fiscal_descricao,
        situacao: data.descricao_situacao_cadastral,
      });
    } catch (apiErr) {
      // 2. Fallback ReceitaWS
      const fallback = await axios.get(`https://www.receitaws.com.br/v1/cnpj/${cleanCnpj}`, { timeout: 8000 });
      const d = fallback.data;
      if (d.status === "ERROR") {
        return res.status(404).json({ error: d.message || "CNPJ não encontrado na Receita Federal." });
      }
      return res.json({
        sucesso: true,
        cnpj: cleanCnpj,
        razao_social: d.nome,
        nome_fantasia: d.fantasia || d.nome,
        logradouro: d.logradouro,
        numero: d.numero,
        complemento: d.complemento,
        bairro: d.bairro,
        cep: d.cep?.replace(/\D/g, ""),
        cidade: d.municipio,
        estado: d.uf,
        telefone: d.telefone,
        email: d.email,
        cnae: d.atividade_principal?.[0]?.text,
        situacao: d.situacao,
      });
    }
  } catch (err) {
    console.error("Erro ao consultar CNPJ:", err.message);
    return res.status(500).json({ error: "Não foi possível consultar este CNPJ automaticamente. Você pode preencher os campos manualmente." });
  }
};

const consultarCep = async (req, res) => {
  try {
    const { cep } = req.params;
    const cleanCep = (cep || "").replace(/\D/g, "");
    if (cleanCep.length !== 8) {
      return res.status(400).json({ error: "CEP deve conter 8 dígitos." });
    }

    const resp = await axios.get(`https://viacep.com.br/ws/${cleanCep}/json/`, { timeout: 6000 });
    if (resp.data?.erro) {
      return res.status(404).json({ error: "CEP não encontrado." });
    }

    return res.json({
      sucesso: true,
      cep: cleanCep,
      logradouro: resp.data.logradouro,
      bairro: resp.data.bairro,
      cidade: resp.data.localidade,
      estado: resp.data.uf,
    });
  } catch (err) {
    console.error("Erro ao consultar CEP:", err.message);
    return res.status(500).json({ error: "Erro ao consultar CEP. Preencha manualmente." });
  }
};

const atualizarDadosFiscais = async (req, res) => {
  try {
    const empresaId = req.empresaId || req.user?.empresa_id;
    if (!empresaId) {
      return res.status(400).json({ error: "Empresa não identificada." });
    }

    const {
      cnpj_cpf,
      razao_social,
      nome_fantasia,
      endereco,
      numero,
      complemento,
      bairro,
      cidade,
      estado,
      cep,
    } = req.body;

    const cleanCpfCnpj = (cnpj_cpf || "").replace(/\D/g, "");
    const cleanCep = (cep || "").replace(/\D/g, "");

    const partesEndereco = [endereco, numero ? `nº ${numero}` : "", complemento, bairro ? `- Bairro ${bairro}` : ""].filter(Boolean);
    const enderecoCompleto = partesEndereco.join(", ");
    // Truncar estado para max 2 chars (varchar(2))
    const estadoFinal = estado ? estado.trim().toUpperCase().substring(0, 2) : null;

    await db.query(
      `UPDATE empresas SET 
         cnpj_cpf = COALESCE(?, cnpj_cpf),
         razao_social = COALESCE(?, razao_social),
         nome = COALESCE(?, nome),
         endereco = COALESCE(?, endereco),
         cidade = COALESCE(?, cidade),
         estado = COALESCE(?, estado),
         cep = COALESCE(?, cep)
       WHERE id = ?`,
      [
        cleanCpfCnpj || null,
        razao_social ? razao_social.trim() : null,
        nome_fantasia ? nome_fantasia.trim() : null,
        enderecoCompleto || null,
        cidade ? cidade.trim() : null,
        estadoFinal,
        cleanCep || null,
        empresaId,
      ]
    );

    return res.json({
      sucesso: true,
      message: "Dados fiscais e de endereço salvos com sucesso!",
    });
  } catch (err) {
    console.error("Erro ao atualizar dados fiscais:", err);
    return res.status(500).json({ error: "Erro interno ao atualizar dados fiscais." });
  }
};

module.exports = {
  listarEmpresas,
  criarEmpresa,
  obterEmpresaAtual,
  atualizarEmpresa,
  alterarStatusSaas,
  estenderTrial,
  excluirEmpresa,
  obterConfiguracoesAutomacoes,
  salvarConfiguracoesAutomacoes,
  obterDossieEmpresa,
  consultarCnpj,
  consultarCep,
  atualizarDadosFiscais,
};
