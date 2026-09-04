const db = require('../db');

async function up() {
  console.log('[Migration] Iniciando criação do schema do Financeiro SaaS...');

  // 1. Tabela de Planos SaaS
  await db.query(`
    CREATE TABLE IF NOT EXISTS saas_planos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(100) NOT NULL,
      descricao TEXT,
      valor DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
      ciclo ENUM('mensal', 'trimestral', 'semestral', 'anual') DEFAULT 'mensal',
      max_filiais INT DEFAULT 1,
      max_usuarios INT DEFAULT 3,
      max_transacoes_mes INT DEFAULT 500,
      recursos JSON,
      ativo TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 2. Tabela de Empresas (Tenants)
  await db.query(`
    CREATE TABLE IF NOT EXISTS empresas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(150) NOT NULL,
      razao_social VARCHAR(200),
      cnpj_cpf VARCHAR(20) UNIQUE,
      slug VARCHAR(100) UNIQUE NOT NULL,
      email VARCHAR(150),
      telefone VARCHAR(30),
      endereco TEXT,
      cidade VARCHAR(100),
      estado VARCHAR(2),
      cep VARCHAR(10),
      plano_saas_id INT,
      status_saas ENUM('ativo', 'trial', 'pendente', 'bloqueado', 'cancelado') DEFAULT 'trial',
      trial_ate DATE,
      dias_tolerancia INT DEFAULT 3,
      bloqueado_em TIMESTAMP NULL,
      limite_filiais INT DEFAULT 1,
      limite_usuarios INT DEFAULT 5,
      ativo TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (plano_saas_id) REFERENCES saas_planos(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 3. Tabela de Filiais
  await db.query(`
    CREATE TABLE IF NOT EXISTS filiais (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      nome VARCHAR(150) NOT NULL,
      cnpj VARCHAR(20),
      telefone VARCHAR(30),
      endereco TEXT,
      ativo TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 4. Tabela de Admins / Usuários
  await db.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(150) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      senha VARCHAR(255) NOT NULL,
      telefone VARCHAR(30),
      is_super TINYINT(1) DEFAULT 0,
      empresa_id INT NULL,
      status ENUM('ativo', 'inativo') DEFAULT 'ativo',
      ultimo_login TIMESTAMP NULL,
      reset_token VARCHAR(255) NULL,
      reset_token_expira TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 5. Relação Admin-Empresa (Multi-Tenant Switch)
  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_empresas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      admin_id INT NOT NULL,
      empresa_id INT NOT NULL,
      role ENUM('proprietario', 'gerente_financeiro', 'operador', 'contador', 'visualizador') DEFAULT 'operador',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_admin_empresa (admin_id, empresa_id),
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 6. Grupos e Permissões RBAC
  await db.query(`
    CREATE TABLE IF NOT EXISTS grupos_permissao (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      nome VARCHAR(100) NOT NULL,
      descricao TEXT,
      permissoes JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 7. Faturamento SaaS (Billing do próprio SaaS)
  await db.query(`
    CREATE TABLE IF NOT EXISTS saas_faturas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      plano_id INT NULL,
      valor DECIMAL(10, 2) NOT NULL,
      status ENUM('pendente', 'pago', 'cancelado', 'vencido') DEFAULT 'pendente',
      data_vencimento DATE NOT NULL,
      data_pagamento TIMESTAMP NULL,
      gateway ENUM('mercadopago', 'efi_pix', 'manual') DEFAULT 'efi_pix',
      txid VARCHAR(150),
      codigo_pix TEXT,
      qrcode_pix TEXT,
      link_fatura VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
      FOREIGN KEY (plano_id) REFERENCES saas_planos(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 8. Customização e Branding
  await db.query(`
    CREATE TABLE IF NOT EXISTS sistema_branding (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT UNIQUE NULL,
      nome_sistema VARCHAR(100) DEFAULT 'Nuvy Finance',
      logo_url VARCHAR(255),
      favicon_url VARCHAR(255),
      cor_primaria VARCHAR(30) DEFAULT '#059669',
      cor_secundaria VARCHAR(30) DEFAULT '#2563eb',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // ============================================================
  // TABELAS DO ERP FINANCEIRO
  // ============================================================

  // 9. Contas Bancárias & Caixas
  await db.query(`
    CREATE TABLE IF NOT EXISTS contas_bancarias (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      filial_id INT NULL,
      nome VARCHAR(100) NOT NULL,
      banco VARCHAR(80) DEFAULT 'Carteira/Caixa',
      tipo ENUM('corrente', 'poupanca', 'caixa_fisico', 'investimento', 'outro') DEFAULT 'corrente',
      agencia VARCHAR(20),
      conta VARCHAR(30),
      saldo_inicial DECIMAL(12, 2) DEFAULT 0.00,
      saldo_atual DECIMAL(12, 2) DEFAULT 0.00,
      cor VARCHAR(20) DEFAULT '#059669',
      ativo TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
      FOREIGN KEY (filial_id) REFERENCES filiais(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 10. Categorias Financeiras / Plano de Contas para DRE
  await db.query(`
    CREATE TABLE IF NOT EXISTS categorias_financeiras (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      nome VARCHAR(100) NOT NULL,
      tipo ENUM('receita', 'despesa') NOT NULL,
      dre_grupo ENUM('receita_bruta', 'deducao_receita', 'custo_variavel', 'despesa_fixa', 'despesa_financeira', 'investimento', 'imposto') DEFAULT 'despesa_fixa',
      categoria_pai_id INT NULL,
      cor VARCHAR(20) DEFAULT '#64748b',
      icone VARCHAR(50) DEFAULT 'Folder',
      ativo TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
      FOREIGN KEY (categoria_pai_id) REFERENCES categorias_financeiras(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 11. Centros de Custo
  await db.query(`
    CREATE TABLE IF NOT EXISTS centros_custo (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      nome VARCHAR(100) NOT NULL,
      codigo VARCHAR(30),
      responsavel VARCHAR(100),
      ativo TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 12. Clientes e Fornecedores (Contatos)
  await db.query(`
    CREATE TABLE IF NOT EXISTS contatos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      tipo ENUM('cliente', 'fornecedor', 'ambos') DEFAULT 'cliente',
      nome VARCHAR(150) NOT NULL,
      razao_social VARCHAR(200),
      cpf_cnpj VARCHAR(20),
      email VARCHAR(150),
      telefone VARCHAR(30),
      endereco VARCHAR(255),
      cidade VARCHAR(100),
      estado VARCHAR(2),
      cep VARCHAR(10),
      observacoes TEXT,
      ativo TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 13. Transações Financeiras (Contas a Pagar / Receber / Movimentações)
  await db.query(`
    CREATE TABLE IF NOT EXISTS transacoes_financeiras (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      filial_id INT NULL,
      conta_bancaria_id INT NULL,
      categoria_id INT NULL,
      centro_custo_id INT NULL,
      contato_id INT NULL,
      tipo ENUM('receita', 'despesa', 'transferencia') NOT NULL,
      descricao VARCHAR(255) NOT NULL,
      valor DECIMAL(12, 2) NOT NULL,
      valor_pago DECIMAL(12, 2) DEFAULT 0.00,
      data_competencia DATE NOT NULL,
      data_vencimento DATE NOT NULL,
      data_pagamento DATE NULL,
      status ENUM('pendente', 'pago', 'parcial', 'cancelado', 'atrasado') DEFAULT 'pendente',
      forma_pagamento ENUM('pix', 'boleto', 'cartao_credito', 'cartao_debito', 'transferencia', 'dinheiro', 'outro') DEFAULT 'pix',
      recorrente TINYINT(1) DEFAULT 0,
      frequencia ENUM('mensal', 'semanal', 'anual') NULL,
      numero_parcela INT DEFAULT 1,
      total_parcelas INT DEFAULT 1,
      grupo_parcelas_id VARCHAR(50) NULL,
      documento_numero VARCHAR(50) NULL,
      comprovante_url VARCHAR(255) NULL,
      observacoes TEXT,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
      FOREIGN KEY (filial_id) REFERENCES filiais(id) ON DELETE SET NULL,
      FOREIGN KEY (conta_bancaria_id) REFERENCES contas_bancarias(id) ON DELETE SET NULL,
      FOREIGN KEY (categoria_id) REFERENCES categorias_financeiras(id) ON DELETE SET NULL,
      FOREIGN KEY (centro_custo_id) REFERENCES centros_custo(id) ON DELETE SET NULL,
      FOREIGN KEY (contato_id) REFERENCES contatos(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL,
      INDEX idx_empresa_vencimento (empresa_id, data_vencimento),
      INDEX idx_empresa_status (empresa_id, status),
      INDEX idx_empresa_tipo (empresa_id, tipo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 14. Transferências entre Contas
  await db.query(`
    CREATE TABLE IF NOT EXISTS transferencias_contas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      conta_origem_id INT NOT NULL,
      conta_destino_id INT NOT NULL,
      transacao_saida_id INT NULL,
      transacao_entrada_id INT NULL,
      valor DECIMAL(12, 2) NOT NULL,
      data_transferencia DATE NOT NULL,
      observacoes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
      FOREIGN KEY (conta_origem_id) REFERENCES contas_bancarias(id) ON DELETE CASCADE,
      FOREIGN KEY (conta_destino_id) REFERENCES contas_bancarias(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 15. Conciliações Bancárias / OFX
  await db.query(`
    CREATE TABLE IF NOT EXISTS conciliacoes_bancarias (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      conta_bancaria_id INT NOT NULL,
      transacao_id INT NULL,
      fitid_ofx VARCHAR(100) NULL,
      data_extrato DATE NOT NULL,
      descricao_extrato VARCHAR(255) NOT NULL,
      valor_extrato DECIMAL(12, 2) NOT NULL,
      tipo_extrato ENUM('credito', 'debito') NOT NULL,
      conciliado TINYINT(1) DEFAULT 0,
      conciliado_em TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
      FOREIGN KEY (conta_bancaria_id) REFERENCES contas_bancarias(id) ON DELETE CASCADE,
      FOREIGN KEY (transacao_id) REFERENCES transacoes_financeiras(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 16. Inserção de Planos SaaS Iniciais (se não existirem)
  const [planosExistentes] = await db.query('SELECT COUNT(*) as total FROM saas_planos');
  if (planosExistentes[0].total === 0) {
    await db.query(`
      INSERT INTO saas_planos (nome, descricao, valor, ciclo, max_filiais, max_usuarios, max_transacoes_mes, recursos) VALUES
      ('Starter Finance', 'Ideal para MEIs e pequenas empresas organizarem suas finanças', 69.90, 'mensal', 1, 2, 500, '{"dre": true, "ofx": false, "pix": true}'),
      ('Pro Business', 'Completo para PMEs com DRE gerencial, conciliação e múltiplos caixas', 149.90, 'mensal', 3, 5, 2500, '{"dre": true, "ofx": true, "pix": true, "centros_custo": true}'),
      ('Enterprise', 'Gestão avançada, múltiplas filiais, auditoria e usuários ilimitados', 299.90, 'mensal', 10, 20, 10000, '{"dre": true, "ofx": true, "pix": true, "centros_custo": true, "filiais": true}')
    `);
    console.log('[Migration] Planos SaaS padrão inseridos com sucesso.');
  }

  // 17. Inserção de Super Admin Inicial
  const bcrypt = require('bcryptjs');
  const [adminsExistentes] = await db.query('SELECT COUNT(*) as total FROM admins WHERE is_super = 1');
  if (adminsExistentes[0].total === 0) {
    const hashSenha = await bcrypt.hash('admin123', 10);
    
    // Criar Empresa Demonstração
    const [empresaRes] = await db.query(`
      INSERT INTO empresas (nome, razao_social, slug, email, status_saas, trial_ate) 
      VALUES ('Nuvy Matriz Demonstração', 'Nuvy Finance Soluções Ltda', 'demo', 'contato@nuvycore.online', 'ativo', DATE_ADD(CURDATE(), INTERVAL 365 DAY))
    `);
    const empresaId = empresaRes.insertId;

    // Criar Super Admin
    const [adminRes] = await db.query(`
      INSERT INTO admins (nome, email, senha, is_super, empresa_id, status)
      VALUES ('Administrador', 'admin@nuvycore.online', ?, 1, ?, 'ativo')
    `, [hashSenha, empresaId]);
    const adminId = adminRes.insertId;

    // Vincular à empresa demo
    await db.query(`
      INSERT INTO admin_empresas (admin_id, empresa_id, role)
      VALUES (?, ?, 'proprietario')
    `, [adminId, empresaId]);

    // Criar Contas Bancárias Demo
    const [conta1] = await db.query(`
      INSERT INTO contas_bancarias (empresa_id, nome, banco, tipo, saldo_inicial, saldo_atual, cor)
      VALUES (?, 'Conta Principal - Banco Inter', 'Banco Inter', 'corrente', 15400.00, 18950.00, '#ff7a00')
    `, [empresaId]);

    const [conta2] = await db.query(`
      INSERT INTO contas_bancarias (empresa_id, nome, banco, tipo, saldo_inicial, saldo_atual, cor)
      VALUES (?, 'Caixa Físico / Tesouraria', 'Caixa Físico', 'caixa_fisico', 1200.00, 1500.00, '#059669')
    `, [empresaId]);

    // Criar Categorias Demo (Plano de Contas DRE)
    const categorias = [
      ['Vendas de Produtos/Serviços', 'receita', 'receita_bruta', '#10b981', 'TrendingUp'],
      ['Receitas Financeiras / Rendimentos', 'receita', 'receita_bruta', '#059669', 'DollarSign'],
      ['Impostos sobre Faturamento (Simples/ICMS)', 'despesa', 'imposto', '#ef4444', 'FileText'],
      ['Custos de Fornecedores / Mercadorias', 'despesa', 'custo_variavel', '#f59e0b', 'Truck'],
      ['Aluguel, Luz e Internet', 'despesa', 'despesa_fixa', '#64748b', 'Home'],
      ['Salários e Pró-labore', 'despesa', 'despesa_fixa', '#3b82f6', 'Users'],
      ['Softwares e Licenças SaaS', 'despesa', 'despesa_fixa', '#8b5cf6', 'Monitor'],
      ['Marketing e Anúncios (Google/Meta)', 'despesa', 'despesa_fixa', '#ec4899', 'Megaphone']
    ];

    for (const cat of categorias) {
      await db.query(`
        INSERT INTO categorias_financeiras (empresa_id, nome, tipo, dre_grupo, cor, icone)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [empresaId, cat[0], cat[1], cat[2], cat[3], cat[4]]);
    }

    // Criar Contatos Demo
    const [cliente] = await db.query(`
      INSERT INTO contatos (empresa_id, tipo, nome, razao_social, cpf_cnpj, email, telefone, cidade, estado)
      VALUES (?, 'cliente', 'Tech Solutions Corp', 'Tech Solutions Consultoria ME', '12.345.678/0001-90', 'financeiro@techsolutions.com', '(11) 98888-7777', 'São Paulo', 'SP')
    `, [empresaId]);

    const [fornecedor] = await db.query(`
      INSERT INTO contatos (empresa_id, tipo, nome, razao_social, cpf_cnpj, email, telefone, cidade, estado)
      VALUES (?, 'fornecedor', 'DataCenter Cloud Host', 'DataCenter Web Host S.A.', '98.765.432/0001-10', 'cobranca@cloudhost.com', '(11) 97777-6666', 'Campinas', 'SP')
    `, [empresaId]);

    // Criar Transações Demo
    await db.query(`
      INSERT INTO transacoes_financeiras (empresa_id, conta_bancaria_id, categoria_id, contato_id, tipo, descricao, valor, valor_pago, data_competencia, data_vencimento, data_pagamento, status, forma_pagamento)
      VALUES 
      (?, ?, 1, ?, 'receita', 'Mensalidade Contrato Tech Solutions', 4500.00, 4500.00, CURDATE(), CURDATE(), CURDATE(), 'pago', 'pix'),
      (?, ?, 7, ?, 'despesa', 'Assinatura Servidores Cloud', 950.00, 950.00, CURDATE(), CURDATE(), CURDATE(), 'pago', 'cartao_credito'),
      (?, ?, 1, ?, 'receita', 'Serviço de Implantação e Consultoria', 3200.00, 0.00, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 5 DAY), NULL, 'pendente', 'boleto'),
      (?, ?, 5, NULL, 'despesa', 'Aluguel do Escritório Central', 2500.00, 0.00, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 10 DAY), NULL, 'pendente', 'transferencia')
    `, [
      empresaId, conta1.insertId, cliente.insertId,
      empresaId, conta1.insertId, fornecedor.insertId,
      empresaId, conta1.insertId, cliente.insertId,
      empresaId, conta1.insertId
    ]);

    console.log('[Migration] Tenant Demonstração, Super Admin e dados iniciais criados com sucesso!');
  }

  console.log('[Migration] Schema concluído com 100% de sucesso.');
}

module.exports = { up };

if (require.main === module) {
  up().then(() => {
    console.log('Migração executada com sucesso!');
    process.exit(0);
  }).catch((err) => {
    console.error('Erro na migração:', err);
    process.exit(1);
  });
}
