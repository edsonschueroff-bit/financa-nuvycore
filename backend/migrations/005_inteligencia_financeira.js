const db = require("../db");

async function run() {
  console.log("Iniciando migration: 005_inteligencia_financeira...");

  // 1. Tabela de Precificação Inteligente & Markup
  await db.query(`
    CREATE TABLE IF NOT EXISTS precificacao_produtos_servicos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      nome VARCHAR(200) NOT NULL,
      tipo ENUM('produto', 'servico') DEFAULT 'servico',
      unidade_medida VARCHAR(20) DEFAULT 'un',
      custo_direto DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      aliquota_impostos DECIMAL(5,2) NOT NULL DEFAULT 0.00,
      aliquota_comissao DECIMAL(5,2) NOT NULL DEFAULT 0.00,
      aliquota_taxas_cartao DECIMAL(5,2) NOT NULL DEFAULT 0.00,
      aliquota_despesas_fixas DECIMAL(5,2) NOT NULL DEFAULT 0.00,
      margem_lucro_desejada DECIMAL(5,2) NOT NULL DEFAULT 0.00,
      markup_multiplicador DECIMAL(8,4) NOT NULL DEFAULT 1.0000,
      preco_sugerido DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      preco_praticado DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      margem_contribuicao_valor DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      margem_contribuicao_percentual DECIMAL(5,2) NOT NULL DEFAULT 0.00,
      lucro_estimado_unitario DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      observacoes TEXT,
      ativo TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 2. Tabela de Orçamento Empresarial & Metas (Budget 12M)
  await db.query(`
    CREATE TABLE IF NOT EXISTS orcamento_metas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      ano INT NOT NULL,
      categoria_id INT NOT NULL,
      mes INT NOT NULL,
      valor_planejado DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_empresa_ano_cat_mes (empresa_id, ano, categoria_id, mes),
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
      FOREIGN KEY (categoria_id) REFERENCES categorias_financeiras(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("Migration 005_inteligencia_financeira executada com sucesso!");
}

run().catch(console.error).finally(() => process.exit(0));
