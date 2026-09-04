const bcrypt = require("bcryptjs");
const db = require("../db");

async function run() {
  console.log("Iniciando configuração de Produção Real para Nuvy Core...");

  const hashSenha = await bcrypt.hash("123@Mudar", 10);
  const emailReal = "contato@nuvycore.online";

  // 1. Atualizar Empresa Oficial
  const [empresas] = await db.query("SELECT id FROM empresas ORDER BY id ASC LIMIT 1");
  let empresaId;

  if (empresas.length > 0) {
    empresaId = empresas[0].id;
    await db.query(
      `UPDATE empresas 
       SET nome = 'Nuvy Core', 
           slug = 'nuvy-core', 
           razao_social = 'Nuvy Core Tecnologia Ltda',
           status_saas = 'ativo',
           ativo = 1 
       WHERE id = ?`,
      [empresaId]
    );
  } else {
    const [resEmp] = await db.query(
      `INSERT INTO empresas (nome, slug, razao_social, status_saas, ativo)
       VALUES ('Nuvy Core', 'nuvy-core', 'Nuvy Core Tecnologia Ltda', 'ativo', 1)`
    );
    empresaId = resEmp.insertId;
  }

  // 2. Atualizar ou Criar Usuário Administrador Oficial
  const [adminsExistentes] = await db.query("SELECT id FROM admins WHERE email = ?", [emailReal]);
  let adminId;

  if (adminsExistentes.length > 0) {
    adminId = adminsExistentes[0].id;
    await db.query(
      `UPDATE admins 
       SET nome = 'Administrador Nuvy Core', 
           senha = ?, 
           is_super = 1, 
           empresa_id = ?, 
           status = 'ativo' 
       WHERE id = ?`,
      [hashSenha, empresaId, adminId]
    );
  } else {
    const [resAdmin] = await db.query(
      `INSERT INTO admins (nome, email, senha, is_super, empresa_id, status)
       VALUES ('Administrador Nuvy Core', ?, ?, 1, ?, 'ativo')`,
      [emailReal, hashSenha, empresaId]
    );
    adminId = resAdmin.insertId;
  }

  // Remover usuário de teste antigo
  await db.query("DELETE FROM admins WHERE email = 'admin@nuvycore.online' AND id != ?", [adminId]);

  // Vincular admin à empresa em admin_empresas
  await db.query("DELETE FROM admin_empresas WHERE admin_id = ?", [adminId]);
  await db.query(
    "INSERT INTO admin_empresas (admin_id, empresa_id, role) VALUES (?, ?, 'proprietario')",
    [adminId, empresaId]
  );

  // 3. Limpar Dados de Demonstração
  await db.query("DELETE FROM transacoes_financeiras WHERE empresa_id = ?", [empresaId]);
  await db.query("DELETE FROM transferencias_contas WHERE empresa_id = ?", [empresaId]);
  await db.query("DELETE FROM contatos WHERE empresa_id = ?", [empresaId]);
  await db.query("DELETE FROM openfinance_transacoes WHERE empresa_id = ?", [empresaId]);
  await db.query("DELETE FROM openfinance_conexoes WHERE empresa_id = ?", [empresaId]);
  await db.query("DELETE FROM investimentos_proventos WHERE empresa_id = ?", [empresaId]);
  await db.query("DELETE FROM investimentos_ativos WHERE empresa_id = ?", [empresaId]);
  await db.query("DELETE FROM investimentos_carteiras WHERE empresa_id = ?", [empresaId]);

  // Criar 1 Carteira Principal Limpa de Investimentos
  await db.query(
    `INSERT INTO investimentos_carteiras (empresa_id, nome, tipo_titular, instituicao_corretora, cor)
     VALUES (?, 'Carteira Principal', 'pj', 'B3 - Área do Investidor', '#059669')`,
    [empresaId]
  );

  // 4. Limpar e Inicializar Contas Bancárias (1 Conta Principal Zerada)
  await db.query("DELETE FROM contas_bancarias WHERE empresa_id = ?", [empresaId]);
  await db.query(
    `INSERT INTO contas_bancarias (empresa_id, nome, banco, tipo, saldo_atual, cor, ativo)
     VALUES (?, 'Conta Principal / Caixa', 'Banco Principal', 'corrente', 0.00, '#059669', 1)`,
    [empresaId]
  );

  console.log("Setup de Produção concluído com sucesso!");
  console.log(`Usuário: ${emailReal}`);
  console.log("Senha: [123@Mudar]");
  console.log("Empresa: Nuvy Core (/admin/nuvy-core)");
}

run().catch(console.error).finally(() => process.exit(0));
