const db = require("../db");

async function up() {
  console.log("Iniciando migração 003: Investimentos & B3 Wealth Management...");

  // 1. Tabela investimentos_carteiras
  await db.query(`
    CREATE TABLE IF NOT EXISTS investimentos_carteiras (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      nome VARCHAR(100) NOT NULL,
      tipo_titular ENUM('pj', 'socio') DEFAULT 'pj',
      instituicao_corretora VARCHAR(100) NOT NULL,
      cor VARCHAR(20) DEFAULT '#059669',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
      INDEX idx_empresa (empresa_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 2. Tabela investimentos_ativos
  await db.query(`
    CREATE TABLE IF NOT EXISTS investimentos_ativos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      carteira_id INT NOT NULL,
      codigo_ticker VARCHAR(30) NOT NULL,
      nome_ativo VARCHAR(150) NOT NULL,
      classe_ativo ENUM('renda_fixa', 'acoes', 'fiis', 'tesouro_direto', 'etfs_bdrs', 'fundos') NOT NULL,
      quantidade DECIMAL(14,4) NOT NULL DEFAULT 1,
      preco_medio DECIMAL(12,2) NOT NULL,
      preco_atual DECIMAL(12,2) NOT NULL,
      valor_total_investido DECIMAL(14,2) GENERATED ALWAYS AS (quantidade * preco_medio) STORED,
      valor_total_atual DECIMAL(14,2) GENERATED ALWAYS AS (quantidade * preco_atual) STORED,
      lucro_prejuizo_reais DECIMAL(14,2) GENERATED ALWAYS AS ((quantidade * preco_atual) - (quantidade * preco_medio)) STORED,
      data_aplicacao DATE NULL,
      data_vencimento DATE NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
      FOREIGN KEY (carteira_id) REFERENCES investimentos_carteiras(id) ON DELETE CASCADE,
      INDEX idx_empresa_classe (empresa_id, classe_ativo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 3. Tabela investimentos_proventos
  await db.query(`
    CREATE TABLE IF NOT EXISTS investimentos_proventos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      ativo_id INT NULL,
      tipo_provento ENUM('dividendo', 'jcp', 'rendimento_fii', 'juros_renda_fixa') NOT NULL,
      valor_liquido DECIMAL(12,2) NOT NULL,
      data_pagamento DATE NOT NULL,
      status ENUM('recebido', 'provisionado') DEFAULT 'recebido',
      transacao_financeira_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
      FOREIGN KEY (ativo_id) REFERENCES investimentos_ativos(id) ON DELETE SET NULL,
      FOREIGN KEY (transacao_financeira_id) REFERENCES transacoes_financeiras(id) ON DELETE SET NULL,
      INDEX idx_empresa_data (empresa_id, data_pagamento)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Inserir carteiras e ativos demo para o tenant demo se não houver
  const [demoEmpresas] = await db.query("SELECT id FROM empresas WHERE slug = 'demo'");
  if (demoEmpresas.length > 0) {
    const demoId = demoEmpresas[0].id;

    const [carteirasExistem] = await db.query("SELECT id FROM investimentos_carteiras WHERE empresa_id = ?", [demoId]);
    if (carteirasExistem.length === 0) {
      const [resC1] = await db.query(`
        INSERT INTO investimentos_carteiras (empresa_id, nome, tipo_titular, instituicao_corretora, cor)
        VALUES (?, 'Reserva de Emergência & Caixa PJ', 'pj', 'BTG Pactual Empresas', '#00204a')
      `, [demoId]);

      const [resC2] = await db.query(`
        INSERT INTO investimentos_carteiras (empresa_id, nome, tipo_titular, instituicao_corretora, cor)
        VALUES (?, 'Carteira de Renda Variável B3', 'socio', 'B3 - Área do Investidor', '#ff7a00')
      `, [demoId]);

      const cart1Id = resC1.insertId;
      const cart2Id = resC2.insertId;

      // Inserir Ativos
      const [resA1] = await db.query(`
        INSERT INTO investimentos_ativos 
        (empresa_id, carteira_id, codigo_ticker, nome_ativo, classe_ativo, quantidade, preco_medio, preco_atual, data_aplicacao, data_vencimento)
        VALUES 
        (?, ?, 'CDB 105% CDI', 'CDB Liquidez Diária BTG', 'renda_fixa', 1.0000, 50000.00, 52840.00, DATE_SUB(CURDATE(), INTERVAL 6 MONTH), DATE_ADD(CURDATE(), INTERVAL 2 YEAR)),
        (?, ?, 'Tesouro Selic 2029', 'Tesouro Selic Pós-Fixado', 'tesouro_direto', 2.5000, 14200.00, 14850.00, DATE_SUB(CURDATE(), INTERVAL 4 MONTH), '2029-03-01')
      `, [demoId, cart1Id, demoId, cart1Id]);

      const [resA2] = await db.query(`
        INSERT INTO investimentos_ativos 
        (empresa_id, carteira_id, codigo_ticker, nome_ativo, classe_ativo, quantidade, preco_medio, preco_atual, data_aplicacao)
        VALUES 
        (?, ?, 'HGLG11', 'CSHG Logística FII', 'fiis', 150.0000, 155.20, 163.80, DATE_SUB(CURDATE(), INTERVAL 8 MONTH)),
        (?, ?, 'MXRF11', 'Maxi Renda FII', 'fiis', 800.0000, 9.85, 10.45, DATE_SUB(CURDATE(), INTERVAL 5 MONTH)),
        (?, ?, 'WEGE3', 'WEG S.A. Ações ON', 'acoes', 200.0000, 48.50, 54.20, DATE_SUB(CURDATE(), INTERVAL 10 MONTH)),
        (?, ?, 'ITUB4', 'Itaú Unibanco PN', 'acoes', 300.0000, 32.10, 35.80, DATE_SUB(CURDATE(), INTERVAL 7 MONTH))
      `, [demoId, cart2Id, demoId, cart2Id, demoId, cart2Id, demoId, cart2Id]);

      // Inserir Proventos
      await db.query(`
        INSERT INTO investimentos_proventos 
        (empresa_id, ativo_id, tipo_provento, valor_liquido, data_pagamento, status)
        VALUES 
        (?, 3, 'rendimento_fii', 165.00, DATE_SUB(CURDATE(), INTERVAL 15 DAY), 'recebido'),
        (?, 4, 'rendimento_fii', 72.00, DATE_SUB(CURDATE(), INTERVAL 12 DAY), 'recebido'),
        (?, 5, 'dividendo', 140.00, DATE_SUB(CURDATE(), INTERVAL 5 DAY), 'recebido')
      `, [demoId, demoId, demoId]);
    }
  }

  console.log("Migração 003 executada com sucesso!");
}

up().catch(console.error).finally(() => process.exit(0));
