const db = require("../db");

async function up() {
  console.log("Iniciando migração 002: Open Finance & Conciliação Bancária...");

  // 1. Tabela openfinance_conexoes
  await db.query(`
    CREATE TABLE IF NOT EXISTS openfinance_conexoes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      conta_bancaria_id INT NULL,
      provider VARCHAR(50) DEFAULT 'pluggy',
      item_id VARCHAR(150) NOT NULL,
      instituicao_nome VARCHAR(100) NOT NULL,
      instituicao_logo VARCHAR(255) NULL,
      instituicao_cor VARCHAR(20) DEFAULT '#059669',
      status_conexao ENUM('conectado', 'pendente', 'erro', 'desconectado') DEFAULT 'conectado',
      ultima_sincronizacao DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
      FOREIGN KEY (conta_bancaria_id) REFERENCES contas_bancarias(id) ON DELETE SET NULL,
      INDEX idx_empresa (empresa_id),
      INDEX idx_item (item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 2. Tabela openfinance_transacoes (Extrato bruto do banco)
  await db.query(`
    CREATE TABLE IF NOT EXISTS openfinance_transacoes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      conexao_id INT NULL,
      conta_bancaria_id INT NULL,
      transacao_provider_id VARCHAR(150) NULL,
      data_ocorrencia DATE NOT NULL,
      descricao_banco VARCHAR(255) NOT NULL,
      valor DECIMAL(12,2) NOT NULL,
      tipo ENUM('credito', 'debito') NOT NULL,
      categoria_provedor VARCHAR(100) NULL,
      status_conciliacao ENUM('pendente', 'conciliado', 'ignorado') DEFAULT 'pendente',
      transacao_financeira_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
      FOREIGN KEY (conexao_id) REFERENCES openfinance_conexoes(id) ON DELETE SET NULL,
      FOREIGN KEY (conta_bancaria_id) REFERENCES contas_bancarias(id) ON DELETE SET NULL,
      FOREIGN KEY (transacao_financeira_id) REFERENCES transacoes_financeiras(id) ON DELETE SET NULL,
      INDEX idx_empresa_status (empresa_id, status_conciliacao),
      INDEX idx_data (data_ocorrencia)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 3. Tabela regras_conciliacao
  await db.query(`
    CREATE TABLE IF NOT EXISTS regras_conciliacao (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      termo_busca VARCHAR(100) NOT NULL,
      categoria_id INT NOT NULL,
      centro_custo_id INT NULL,
      tipo ENUM('receita', 'despesa') NOT NULL,
      auto_conciliar TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
      FOREIGN KEY (categoria_id) REFERENCES categorias_financeiras(id) ON DELETE CASCADE,
      FOREIGN KEY (centro_custo_id) REFERENCES centros_custo(id) ON DELETE SET NULL,
      INDEX idx_empresa (empresa_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Inserir conexões demo e extratos simulados para o tenant demo se ainda não houver
  const [demoEmpresas] = await db.query("SELECT id FROM empresas WHERE slug = 'demo'");
  if (demoEmpresas.length > 0) {
    const demoId = demoEmpresas[0].id;

    const [contas] = await db.query("SELECT id FROM contas_bancarias WHERE empresa_id = ? LIMIT 1", [demoId]);
    const contaId = contas.length > 0 ? contas[0].id : null;

    const [conexoesExistem] = await db.query("SELECT id FROM openfinance_conexoes WHERE empresa_id = ?", [demoId]);
    if (conexoesExistem.length === 0) {
      const [resConexao] = await db.query(`
        INSERT INTO openfinance_conexoes 
        (empresa_id, conta_bancaria_id, provider, item_id, instituicao_nome, instituicao_cor, status_conexao, ultima_sincronizacao)
        VALUES (?, ?, 'pluggy', 'item_demo_inter_001', 'Banco Inter PJ', '#ff7a00', 'conectado', NOW())
      `, [demoId, contaId]);

      const conexaoId = resConexao.insertId;

      // Inserir extratos brutos de exemplo para conciliação
      await db.query(`
        INSERT INTO openfinance_transacoes 
        (empresa_id, conexao_id, conta_bancaria_id, transacao_provider_id, data_ocorrencia, descricao_banco, valor, tipo, categoria_provedor, status_conciliacao)
        VALUES 
        (?, ?, ?, 'tx_001', CURDATE(), 'PIX RECEBIDO - CLIENTE ACME TECNOLOGIA', 1500.00, 'credito', 'Receitas', 'pendente'),
        (?, ?, ?, 'tx_002', CURDATE(), 'TARIFA BANCARIA PACOTE PIX EMPRESAS', 49.90, 'debito', 'Tarifas', 'pendente'),
        (?, ?, ?, 'tx_003', DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'PAGTO ELETRONICO - SERVIDORES CLOUD AWS', 850.00, 'debito', 'TI & Infra', 'pendente'),
        (?, ?, ?, 'tx_004', DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'PIX RECEBIDO - NEXUS TELECOM LTDA', 3200.00, 'credito', 'Receitas', 'pendente')
      `, [
        demoId, conexaoId, contaId,
        demoId, conexaoId, contaId,
        demoId, conexaoId, contaId,
        demoId, conexaoId, contaId,
      ]);
    }
  }

  console.log("Migração 002 executada com sucesso!");
}

up().catch(console.error).finally(() => process.exit(0));
