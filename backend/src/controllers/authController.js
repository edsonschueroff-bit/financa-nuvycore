const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../../db");
const crypto = require("crypto");
const { registrarAuditoria } = require("../utils/auditLogger");
const { enviarEmailBoasVindas, enviarEmailRecuperacaoSenha } = require("../services/emailService");
const { enviarMensagemTelegram } = require("../services/telegramService");
const { enviarTextoWhatsApp } = require("./integracaoWhatsappController");

const generateToken = (user, activeEmpresaId) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      is_super: Boolean(user.is_super),
      activeEmpresaId: activeEmpresaId || user.empresa_id,
    },
    process.env.JWT_SECRET || "financeiro_sec_secret",
    { expiresIn: "7d" }
  );
};

const login = async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: "E-mail e senha são obrigatórios" });
    }

    const [rows] = await db.query(
      `SELECT id, nome, email, senha, is_super, empresa_id, status FROM admins WHERE email = ?`,
      [email.trim().toLowerCase()]
    );

    if (!rows.length) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const admin = rows[0];

    if (admin.status !== "ativo") {
      return res.status(401).json({ error: "Conta inativa. Entre em contato com o suporte." });
    }

    const validPassword = await bcrypt.compare(senha, admin.senha);
    if (!validPassword) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    // Buscar empresas às quais o usuário tem acesso
    let empresas = [];
    if (admin.is_super) {
      const [allEmpresas] = await db.query(
        `SELECT e.id, e.nome, e.slug, e.status_saas, e.trial_ate, e.ativo, e.plano_saas_id,
                p.nome as plano_nome, p.tipo_publico as plano_tipo_publico, p.recursos as plano_recursos
         FROM empresas e
         LEFT JOIN saas_planos p ON p.id = e.plano_saas_id
         ORDER BY e.nome ASC`
      );
      empresas = allEmpresas.map(emp => {
        let rec = emp.plano_recursos;
        if (typeof rec === 'string') {
          try { rec = JSON.parse(rec); } catch { rec = {}; }
        }
        return { ...emp, plano_recursos: rec };
      });
    } else {
      const [userEmpresas] = await db.query(
        `SELECT e.id, e.nome, e.slug, e.status_saas, e.trial_ate, e.ativo, e.plano_saas_id,
                p.nome as plano_nome, p.tipo_publico as plano_tipo_publico, p.recursos as plano_recursos,
                ae.role, ae.cargo, ae.permissoes
         FROM admin_empresas ae
         JOIN empresas e ON e.id = ae.empresa_id
         LEFT JOIN saas_planos p ON p.id = e.plano_saas_id
         WHERE ae.admin_id = ? AND COALESCE(ae.ativo, 1) = 1
         ORDER BY e.nome ASC`,
        [admin.id]
      );
      empresas = userEmpresas.map(emp => {
        let rec = emp.plano_recursos;
        if (typeof rec === 'string') {
          try { rec = JSON.parse(rec); } catch { rec = {}; }
        }
        return { ...emp, plano_recursos: rec };
      });
    }

    // Determinar empresa inicial ativa
    let activeEmpresa = null;
    if (admin.empresa_id) {
      activeEmpresa = empresas.find(e => e.id === admin.empresa_id) || empresas[0];
    } else if (empresas.length > 0) {
      activeEmpresa = empresas[0];
    }

    await db.query(`UPDATE admins SET ultimo_login = NOW() WHERE id = ?`, [admin.id]);

    const activeEmpresaId = activeEmpresa ? activeEmpresa.id : null;
    const token = generateToken(admin, activeEmpresaId);

    await registrarAuditoria({
      req,
      empresaId: activeEmpresaId,
      adminId: admin.id,
      usuarioNome: admin.nome,
      usuarioEmail: admin.email,
      acao: "LOGIN",
      modulo: "AUTH",
      detalhes: { empresa_nome: activeEmpresa?.nome || "Super Admin" },
    });

    let diasTrialRestantes = null;
    if (activeEmpresa && activeEmpresa.status_saas === 'trial' && activeEmpresa.trial_ate) {
      const trialDate = new Date(activeEmpresa.trial_ate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      trialDate.setHours(0, 0, 0, 0);
      diasTrialRestantes = Math.ceil((trialDate - today) / (1000 * 60 * 60 * 24));
    }

    const userRole = admin.is_super ? 'proprietario' : (activeEmpresa?.role || 'operador');
    const userCargo = admin.cargo || activeEmpresa?.cargo || 'Colaborador';
    let userPerms = activeEmpresa?.permissoes;
    if (typeof userPerms === 'string') {
      try { userPerms = JSON.parse(userPerms); } catch { userPerms = null; }
    }

    return res.json({
      token,
      user: {
        id: admin.id,
        nome: admin.nome,
        email: admin.email,
        telefone: admin.telefone,
        cargo: userCargo,
        is_super: Boolean(admin.is_super),
        empresa_id: activeEmpresaId,
        empresa_slug: activeEmpresa ? activeEmpresa.slug : null,
        empresa_nome: activeEmpresa ? activeEmpresa.nome : null,
        empresa_status: activeEmpresa ? activeEmpresa.status_saas : null,
        plano_saas_id: activeEmpresa ? activeEmpresa.plano_saas_id : null,
        plano_nome: activeEmpresa ? activeEmpresa.plano_nome : null,
        plano_tipo_publico: activeEmpresa ? activeEmpresa.plano_tipo_publico : null,
        plano_recursos: activeEmpresa ? activeEmpresa.plano_recursos : null,
        trial_ate: activeEmpresa ? activeEmpresa.trial_ate : null,
        dias_trial_restantes: diasTrialRestantes,
        role: userRole,
        permissoes: userPerms,
        empresas,
      },
    });
  } catch (err) {
    console.error("Erro no login:", err);
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
};

const me = async (req, res) => {
  try {
    const admin = req.user;

    // Buscar empresas acessíveis
    let empresas = [];
    if (admin.is_super) {
      const [allEmpresas] = await db.query(
        `SELECT e.id, e.nome, e.slug, e.status_saas, e.trial_ate, e.ativo, e.plano_saas_id,
                p.nome as plano_nome, p.tipo_publico as plano_tipo_publico, p.recursos as plano_recursos
         FROM empresas e
         LEFT JOIN saas_planos p ON p.id = e.plano_saas_id
         ORDER BY e.nome ASC`
      );
      empresas = allEmpresas.map(emp => {
        let rec = emp.plano_recursos;
        if (typeof rec === 'string') {
          try { rec = JSON.parse(rec); } catch { rec = {}; }
        }
        return { ...emp, plano_recursos: rec };
      });
    } else {
      const [userEmpresas] = await db.query(
        `SELECT e.id, e.nome, e.slug, e.status_saas, e.trial_ate, e.ativo, e.plano_saas_id,
                p.nome as plano_nome, p.tipo_publico as plano_tipo_publico, p.recursos as plano_recursos,
                ae.role, ae.cargo, ae.permissoes
         FROM admin_empresas ae
         JOIN empresas e ON e.id = ae.empresa_id
         LEFT JOIN saas_planos p ON p.id = e.plano_saas_id
         WHERE ae.admin_id = ? AND COALESCE(ae.ativo, 1) = 1
         ORDER BY e.nome ASC`,
        [admin.id]
      );
      empresas = userEmpresas.map(emp => {
        let rec = emp.plano_recursos;
        if (typeof rec === 'string') {
          try { rec = JSON.parse(rec); } catch { rec = {}; }
        }
        return { ...emp, plano_recursos: rec };
      });
    }

    let perms = admin.permissoes;
    if (typeof perms === 'string') {
      try { perms = JSON.parse(perms); } catch { perms = null; }
    }

    return res.json({
      user: {
        id: admin.id,
        nome: admin.nome,
        email: admin.email,
        telefone: admin.telefone,
        cargo: admin.cargo,
        is_super: admin.is_super,
        empresa_id: admin.empresa_id,
        empresa_slug: admin.empresa_slug,
        empresa_nome: admin.empresa_nome,
        empresa_status: admin.empresa_status,
        plano_saas_id: admin.plano_saas_id,
        plano_nome: admin.plano_nome,
        plano_tipo_publico: admin.plano_tipo_publico,
        plano_recursos: admin.plano_recursos,
        trial_ate: admin.trial_ate,
        dias_trial_restantes: admin.dias_trial_restantes,
        role: admin.role,
        permissoes: perms,
        empresas,
      },
    });
  } catch (err) {
    console.error("Erro ao obter dados do usuário:", err);
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
};

const switchEmpresa = async (req, res) => {
  try {
    const { empresa_id } = req.body;
    const admin = req.user;

    if (!empresa_id) {
      return res.status(400).json({ error: "ID da empresa é obrigatório" });
    }

    // Verificar permissão
    let allowed = false;
    if (admin.is_super) {
      allowed = true;
    } else {
      const [rel] = await db.query(
        `SELECT id FROM admin_empresas WHERE admin_id = ? AND empresa_id = ?`,
        [admin.id, empresa_id]
      );
      allowed = rel.length > 0;
    }

    if (!allowed) {
      return res.status(403).json({ error: "Você não tem permissão para acessar esta empresa" });
    }

    const [empRows] = await db.query(
      `SELECT id, nome, slug, status_saas, trial_ate FROM empresas WHERE id = ?`,
      [empresa_id]
    );

    if (!empRows.length) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    const targetEmpresa = empRows[0];
    const token = generateToken(admin, targetEmpresa.id);

    return res.json({
      token,
      empresa: targetEmpresa,
    });
  } catch (err) {
    console.error("Erro ao trocar de empresa:", err);
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
};

const atualizarPerfil = async (req, res) => {
  try {
    const { nome, senha_atual, nova_senha } = req.body;
    const adminId = req.user.id;

    if (nome) {
      await db.query(`UPDATE admins SET nome = ? WHERE id = ?`, [nome.trim(), adminId]);
    }

    if (nova_senha) {
      if (!senha_atual) {
        return res.status(400).json({ error: "Senha atual é obrigatória para alterar a senha" });
      }

      const [rows] = await db.query(`SELECT senha FROM admins WHERE id = ?`, [adminId]);
      const valid = await bcrypt.compare(senha_atual, rows[0].senha);
      if (!valid) {
        return res.status(400).json({ error: "Senha atual incorreta" });
      }

      const hash = await bcrypt.hash(nova_senha, 10);
      await db.query(`UPDATE admins SET senha = ? WHERE id = ?`, [hash, adminId]);
    }

    return res.json({ message: "Perfil atualizado com sucesso" });
  } catch (err) {
    console.error("Erro ao atualizar perfil:", err);
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
};

// Auto-Cadastro para Teste Gratuito (Trial 14 Dias)
const registerTrial = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { nome_empresa, nome_gestor, email, senha, telefone } = req.body;

    if (!nome_empresa || !nome_gestor || !email || !senha) {
      return res.status(400).json({ error: "Nome da empresa, seu nome, e-mail e senha são obrigatórios." });
    }

    if (senha.length < 6) {
      return res.status(400).json({ error: "A senha deve conter no mínimo 6 caracteres." });
    }

    const emailLimpo = email.trim().toLowerCase();

    // Verificar se e-mail já existe
    const [existing] = await connection.query(`SELECT id FROM admins WHERE email = ?`, [emailLimpo]);
    if (existing.length > 0) {
      await connection.rollback();
      return res.status(400).json({ error: "Este e-mail já possui cadastro no sistema. Faça login para acessar." });
    }

    // Gerar slug único para a empresa
    let baseSlug = nome_empresa
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!baseSlug) baseSlug = "empresa";

    let cleanSlug = baseSlug;
    let count = 1;
    while (true) {
      const [slugCheck] = await connection.query(`SELECT id FROM empresas WHERE slug = ?`, [cleanSlug]);
      if (slugCheck.length === 0) break;
      cleanSlug = `${baseSlug}-${count++}`;
    }

    // Criar empresa com status 'trial' e 14 dias de teste
    const [empResult] = await connection.query(
      `INSERT INTO empresas (nome, slug, email, telefone, status_saas, trial_ate, ativo, limite_filiais, limite_usuarios)
       VALUES (?, ?, ?, ?, 'trial', DATE_ADD(CURDATE(), INTERVAL 14 DAY), 1, 1, 5)`,
      [nome_empresa.trim(), cleanSlug, emailLimpo, telefone ? telefone.trim() : null]
    );

    const empresaId = empResult.insertId;

    // Criar Conta Bancária Padrão "Caixa Geral"
    await connection.query(
      `INSERT INTO contas_bancarias (empresa_id, nome, banco, tipo, saldo_inicial, saldo_atual, cor)
       VALUES (?, 'Caixa Geral', 'Caixa Físico', 'caixa_fisico', 0.00, 0.00, '#059669')`,
      [empresaId]
    );

    // Criar Categorias Financeiras Padrão para DRE
    const categoriasPadrao = [
      { nome: "Vendas de Produtos / Serviços", tipo: "receita", grupo: "receita_bruta" },
      { nome: "Rendimentos & Outras Receitas", tipo: "receita", grupo: "receita_bruta" },
      { nome: "Custos de Fornecedores & Mercadorias", tipo: "despesa", grupo: "custo_variavel" },
      { nome: "Aluguel, Luz, Água e Internet", tipo: "despesa", grupo: "despesa_fixa" },
      { nome: "Salários & Pró-Labore", tipo: "despesa", grupo: "despesa_fixa" },
      { nome: "Transporte & Combustível", tipo: "despesa", grupo: "despesa_fixa" },
      { nome: "Alimentação & Refeições", tipo: "despesa", grupo: "despesa_fixa" },
      { nome: "Saúde & Farmácia", tipo: "despesa", grupo: "despesa_fixa" },
      { nome: "Marketing & Vendas", tipo: "despesa", grupo: "despesa_fixa" },
      { nome: "Tarifas Bancárias & Impostos", tipo: "despesa", grupo: "despesa_financeira" },
    ];

    for (const cat of categoriasPadrao) {
      await connection.query(
        `INSERT INTO categorias_financeiras (empresa_id, nome, tipo, dre_grupo, cor, ativo)
         VALUES (?, ?, ?, ?, '#3b82f6', 1)`,
        [empresaId, cat.nome, cat.tipo, cat.grupo]
      );
    }

    // Criar Preferências de Automações & WhatsApp padrão
    await connection.query(
      `INSERT INTO configuracoes_automacoes_whatsapp (empresa_id, resumo_matinal_ativo, regua_cobranca_ativa, copiloto_ia_ativo)
       VALUES (?, 1, 1, 1)`,
      [empresaId]
    );

    // Criar Admin com Hash da Senha
    const hashSenha = await bcrypt.hash(senha, 10);
    const [adminResult] = await connection.query(
      `INSERT INTO admins (nome, email, senha, telefone, cargo, empresa_id, status)
       VALUES (?, ?, ?, ?, 'Proprietário', ?, 'ativo')`,
      [nome_gestor.trim(), emailLimpo, hashSenha, telefone ? telefone.trim() : null, empresaId]
    );

    const adminId = adminResult.insertId;

    // Vincular em admin_empresas como proprietario
    await connection.query(
      `INSERT INTO admin_empresas (admin_id, empresa_id, role, cargo, ativo)
       VALUES (?, ?, 'proprietario', 'Proprietário', 1)`,
      [adminId, empresaId]
    );

    await connection.commit();

    // Disparar E-mail de Boas-Vindas em segundo plano
    enviarEmailBoasVindas({
      to: emailLimpo,
      nomeGestor: nome_gestor.trim(),
      nomeEmpresa: nome_empresa.trim(),
      empresaSlug: cleanSlug,
    }).catch(e => console.error("[ERRO ENVIO BOAS-VINDAS]:", e.message));

    const userObj = {
      id: adminId,
      email: emailLimpo,
      is_super: false,
      empresa_id: empresaId,
    };

    const token = generateToken(userObj, empresaId);

    return res.status(201).json({
      sucesso: true,
      token,
      user: {
        id: adminId,
        nome: nome_gestor.trim(),
        email: emailLimpo,
        telefone: telefone ? telefone.trim() : null,
        cargo: "Proprietário",
        is_super: false,
        empresa_id: empresaId,
        empresa_slug: cleanSlug,
        empresa_nome: nome_empresa.trim(),
        empresa_status: "trial",
        trial_ate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        dias_trial_restantes: 14,
        role: "proprietario",
        permissoes: null,
      },
    });
  } catch (err) {
    await connection.rollback();
    console.error("Erro no auto-cadastro de trial:", err);
    return res.status(500).json({ error: "Erro ao criar conta de teste. Tente novamente." });
  } finally {
    connection.release();
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: "Informe o e-mail cadastrado." });
    }

    const emailLimpo = email.trim().toLowerCase();
    const [admins] = await db.query(
      `SELECT a.*, e.nome as empresa_nome 
       FROM admins a 
       LEFT JOIN empresas e ON e.id = a.empresa_id 
       WHERE LOWER(a.email) = ? AND a.status = 'ativo' 
       LIMIT 1`,
      [emailLimpo]
    );

    if (!admins.length) {
      // Resposta segura genérica para evitar enumeração de contas
      return res.json({
        sucesso: true,
        message: "Se o e-mail estiver cadastrado, você receberá o código e as instruções de acesso.",
        canais: ["email"],
      });
    }

    const admin = admins[0];
    const token = crypto.randomBytes(32).toString("hex");
    const codigo6 = Math.floor(100000 + Math.random() * 900000).toString();
    const expiraEm = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

    // Invalida tokens anteriores não usados
    await db.query(
      `UPDATE password_resets SET usado = 1 WHERE admin_id = ? AND usado = 0`,
      [admin.id]
    );

    // Grava novo token
    await db.query(
      `INSERT INTO password_resets (admin_id, email, token, codigo_6_digitos, expira_em)
       VALUES (?, ?, ?, ?, ?)`,
      [admin.id, admin.email, token, codigo6, expiraEm]
    );

    const appUrl = process.env.APP_URL || "https://financas.nuvycore.online";
    const resetLink = `${appUrl}/redefinir-senha?token=${token}`;
    const canaisDisparados = [];

    // 1. Enviar E-mail via Hostinger
    try {
      const emailRes = await enviarEmailRecuperacaoSenha({
        to: admin.email,
        nome: admin.nome,
        resetLink,
        codigo: codigo6,
      });
      if (emailRes.enviado) canaisDisparados.push("email");
    } catch (eMailErr) {
      console.error("[FORGOT PASSWORD EMAIL ERROR]:", eMailErr.message);
    }

    const msgAlertaCelular = `🔐 *[Nuvy Finance] Recuperação de Senha*\n\n` +
      `Olá, *${admin.nome}*!\n` +
      `Recebemos uma solicitação para redefinir a senha do seu painel.\n\n` +
      `🔑 *Seu Código de 6 Dígitos:* \`${codigo6}\`\n\n` +
      `Ou clique no link direto para definir uma nova senha:\n` +
      `👉 ${resetLink}\n\n` +
      `_Válido por 30 minutos. Se não foi você, desconsidere._`;

    // 2. Enviar WhatsApp / SMS se tiver telefone cadastrado
    if (admin.telefone) {
      const cleanTel = admin.telefone.replace(/\D/g, "");
      if (cleanTel.length >= 8) {
        try {
          await enviarTextoWhatsApp(cleanTel, msgAlertaCelular);
          canaisDisparados.push("whatsapp");
        } catch (waErr) {
          console.warn("[FORGOT PASSWORD WA ERROR]:", waErr.message);
        }
      }
    }

    // 3. Enviar Telegram se tiver chat vinculado
    if (admin.telegram_chat_id) {
      try {
        await enviarMensagemTelegram(admin.telegram_chat_id, msgAlertaCelular);
        canaisDisparados.push("telegram");
      } catch (tgErr) {
        console.warn("[FORGOT PASSWORD TELEGRAM ERROR]:", tgErr.message);
      }
    }

    return res.json({
      sucesso: true,
      message: "Código e instruções de recuperação enviados com sucesso!",
      canais: canaisDisparados.length ? canaisDisparados : ["email"],
    });
  } catch (err) {
    console.error("Erro no forgotPassword:", err);
    return res.status(500).json({ error: "Erro ao processar solicitação de recuperação de senha." });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, codigo, novaSenha } = req.body;

    if (!novaSenha || novaSenha.length < 6) {
      return res.status(400).json({ error: "A nova senha deve ter no mínimo 6 caracteres." });
    }

    if (!token && !codigo) {
      return res.status(400).json({ error: "Token ou código de verificação não informado." });
    }

    let queryReset = `SELECT * FROM password_resets WHERE usado = 0 AND expira_em > NOW()`;
    let paramsReset = [];

    if (token && token.trim()) {
      queryReset += ` AND token = ?`;
      paramsReset.push(token.trim());
    } else if (codigo && codigo.trim()) {
      queryReset += ` AND codigo_6_digitos = ?`;
      paramsReset.push(codigo.trim().replace(/\D/g, ""));
    }

    queryReset += ` ORDER BY id DESC LIMIT 1`;

    const [resets] = await db.query(queryReset, paramsReset);

    if (!resets.length) {
      return res.status(400).json({
        error: "Código ou link de recuperação inválido, já utilizado ou expirado. Solicite novamente.",
      });
    }

    const resetRow = resets[0];
    const hashSenha = await bcrypt.hash(novaSenha, 10);

    // Atualiza a senha do admin
    await db.query(`UPDATE admins SET senha = ? WHERE id = ?`, [hashSenha, resetRow.admin_id]);

    // Invalida o token de recuperação
    await db.query(`UPDATE password_resets SET usado = 1 WHERE id = ?`, [resetRow.id]);

    // Registra na auditoria
    await registrarAuditoria({
      req,
      adminId: resetRow.admin_id,
      usuarioEmail: resetRow.email,
      acao: "REDEFINICAO_SENHA",
      modulo: "AUTH",
      detalhes: { motivo: "Recuperação de senha via código/token" },
    });

    return res.json({
      sucesso: true,
      message: "Senha redefinida com sucesso! Você já pode fazer login com a nova senha.",
    });
  } catch (err) {
    console.error("Erro no resetPassword:", err);
    return res.status(500).json({ error: "Erro ao redefinir senha." });
  }
};

module.exports = {
  login,
  me,
  switchEmpresa,
  atualizarPerfil,
  registerTrial,
  forgotPassword,
  resetPassword,
};
