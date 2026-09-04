# Nuvy Finance — SaaS de Gestão Financeira B2B, DRE & Inteligência Estratégica

## 1. Visão Geral

O **Nuvy Finance** é uma plataforma SaaS Multi-Tenant B2B completa voltada para gestão financeira corporativa, controle de liquidez, fluxo de caixa, **Open Finance integrado**, **conciliação bancária inteligente com Auto-Match**, **Investimentos & Carteira B3 (Wealth Management)**, **Precificação Inteligente & Markup**, **Orçamento Empresarial & Metas (Budget 12M)**, **Capital de Giro & Curva ABC (80/20 de Pareto)**, contas a pagar/receber com edição completa e **exclusão/baixa em lote**, **Régua Inteligente de Cobrança (D-3, D-0, D+3 com PIX Copia e Cola via WhatsApp e SMSNET ShortCode)**, **SMS Gateway Integrado (SMSNET 1-Way/2-Way com Webhook Centralizado `POST /api/webhooks/smsnet` e Configuração Global no Super Admin `/super/whatsapp`)**, **Canal de WhatsApp Próprio por Empresa (Disparador Oficial do Tenant via QR Code)**, **Telegram Bot Oficial do Copiloto Financeiro (`@NuvyFinanca_bot`) com Leitura de Áudio Whisper, OCR Vision de Comprovantes, Confirmação por Botões Inline e Emissão de Recibos Oficiais em PDF**, **Cérebro Financeiro 360° Unificado (`coraFinancialBrain.js`)**, **Anexo Automático de Comprovantes nas Transações (`comprovante_url`)**, **Cronograma Diário de Caixa com Detalhamento de Lançamentos Pagos e Pendentes**, **Resumo Matinal Financeiro Automatizado (Briefing 08h30)**, **Gestão de Equipe & Permissões Granulares por Tenant**, **Período de Teste Gratuito (Free Trial 14 Dias)**, **Portal Self-Service de Assinatura & Troca de Planos**, **Automação de Faturas SaaS com Mercado Pago (Pix & Cartão de Crédito com Webhook de Baixa Automática e Renovação de +30 dias)**, **Gateways Próprios do Tenant (Asaas & Mercado Pago para Emissão Direta de Boletos/PIX)**, **Rateio Multi-Centros de Custo**, **Central de Chamados & Helpdesk Multi-Tenant**, **Banners Broadcast Globais**, **Dossiê 360° do Cliente & Métricas SaaS (MRR / ARR / Inadimplência)** e geração da **Demonstração do Resultado do Exercício (DRE Gerencial)** em tempo real.

- **Domínio Oficial de Produção:** [https://financas.nuvycore.online](https://financas.nuvycore.online)
- **Painel Super Admin:** [https://financas.nuvycore.online/super](https://financas.nuvycore.online/super)
- **Bot Oficial do Telegram:** [https://t.me/NuvyFinanca_bot](https://t.me/NuvyFinanca_bot) (`@NuvyFinanca_bot`)
- **Empresa Principal:** Nuvy Core (`/admin/nuvy-core`)
- **Administrador Oficial:** `contato@nuvycore.online`
- **Diretório Raiz:** `/var/www/financeiro`
- **Banco de Dados MySQL:** `financeiro` (Totalmente Isolado na porta 3306)
- **Processo Backend PM2:** `financeiro-api` (Porta `3005`)
- **Frontend SPA:** Servido via Nginx + Vite React (Porta `5174` dev / `/dist` prod)

---

## 2. Stack Tecnológica

### Backend (`/var/www/financeiro/backend`)
- **Runtime:** Node.js (v20+)
- **Framework Web:** Express 5.1.0
- **Geração de Documentos:** `pdfkit` (Geração de Recibos Financeiros Oficiais em PDF A4)
- **Banco de Dados:** MySQL 8.0 (`mysql2/promise` com Connection Pooling)
- **Autenticação & Segurança:** JWT (`jsonwebtoken`), `bcryptjs`, `helmet`, `express-rate-limit`, `cors`, API Key Auth para integrações n8n (`apiKeyAuth.js`), autenticação híbrida (`authOrApiKey`), middleware de permissões modulares (`tenant.js`, `auth.js`).
- **Segurança Multi-Tenant Auditada:**
  - Isolamento estrito de queries com `WHERE empresa_id = ?` em 100% dos controllers e operações em lote (`baixarEmLote`, `deletarLote`).
  - Guards de permissão impedindo que tenants comuns acessem dados de outras empresas.
  - Vínculo seguro de contas do Telegram via validação de e-mail e chave única `telegram_chat_id`.
- **Serviços & Controladores:**
  - `coraFinancialBrain.js`: Cérebro Financeiro 360° unificado para WhatsApp e Telegram. Injeta snapshot completo em tempo real (contas, gastos de hoje, receitas de hoje, extrato de 7 dias, contas a vencer, DRE do mês e rascunhos ativos) e padroniza a identidade visual executiva com ícones.
  - `reciboPdfService.js`: Gerador oficial de Recibos de Pagamento e Quitação em PDF A4 com cabeçalho institucional, dados do pagador/favorecido, valor total quitado, código de autenticação eletrônica `NUVY-XXX-...` e linha de assinatura.
  - `telegramService.js`: Wrapper da Telegram Bot API para envio de mensagens Markdown, botões interativos inline (`inline_keyboard`), resposta a callbacks (`answerCallbackQuery`), download de áudios/fotos e envio de arquivos/documentos PDF (`sendDocument`).
  - `integracaoTelegramController.js`: Controlador do webhook oficial do Telegram (`POST /api/integracoes/telegram/webhook`). Processa comandos de voz (Whisper), fotos de comprovantes (GPT-4o Vision com auto-save em `/uploads/comprovantes/`), emissão de recibos PDF e confirmação interativa com 1 clique.
  - `integracaoWhatsappController.js`: Gateway Evolution API, disparador de cobranças, resumo matinal às 08h30 e copiloto de WhatsApp.
  - `relatoriosFinanceirosController.js`: Dashboard KPIs, DRE Gerencial em tempo real e **Fluxo de Caixa Projetado** com integração das movimentações realizadas de hoje e detalhamento por item.
  - `transacaoController.js`: Gestão de contas a pagar/receber, conciliação, rateio e upload/visualização de comprovantes.
  - `usuarioTenantController.js`: Gestão de equipe, múltiplos usuários por empresa e permissões modulares.
  - `suporteController.js`: Helpdesk e chamados de suporte com chat em tempo real.
  - `comunicadosController.js`: Avisos broadcast no topo da plataforma.
  - `gatewayTenantController.js` & `gatewayHelper.js`: Emissão de boletos e PIX via Asaas e Mercado Pago.

### Frontend (`/var/www/financeiro/frontend`)
- **Framework:** React 19.1.0 + Vite 7.3.6
- **Estilização:** Tailwind CSS 3.4.1 + Design Tokens (`DESIGN.md`, `index.css`)
- **Design System:** Precision Emerald corporativo, limpo e executivo.
- **Componentes Avançados:**
  - `FluxoCaixaProjetado.jsx`: Curva de liquidez, cronograma diário com movimentações de hoje e painel de detalhamento de lançamentos com badges de *Pago / Quitado ✅* e *Pendente ⏰*.
  - `AutomacoesWhatsApp.jsx`: Central de automações multicanal com Cards do **WhatsApp Conectado** e do **Telegram Bot Oficial (@NuvyFinanca_bot)**.
  - `ComprovanteModal.jsx`: Visualizador de fotos de comprovantes com suporte a `/api/uploads/comprovantes/`.
  - `AdminLayout.jsx`: Menu lateral categorizado com links atualizados do Copiloto IA (WhatsApp & Telegram).
  - `Login.jsx`: Vitrine SaaS destacando a IA Financeira Multicanal com leitura de notas e recibos em PDF.

---

## 3. Principais Módulos & Recursos

### 1. 🤖 Copiloto Financeiro Cora (WhatsApp & Telegram)
- **Canais Integrados:**
  - **Telegram Bot:** `@NuvyFinanca_bot` com Webhook ativo em `/api/integracoes/telegram/webhook`.
  - **WhatsApp Central:** Evolution API integrada com Webhook em `/api/integracoes/whatsapp/webhook`.
- **Recursos Principais:**
  - **🎙️ Voz (Whisper):** Transcrição e lançamento por áudio natural (*"gastei 60 no almoço"*).
  - **📸 Foto OCR (GPT-4o Vision):** Leitura de comprovantes PIX, boletos e notas com extração de valor, data e favorecido.
  - **📎 Anexo Automático:** Toda foto enviada é salva automaticamente em `/uploads/comprovantes/` e vinculada ao campo `comprovante_url` do lançamento.
  - **📄 Recibos em PDF:** Solicitação em linguagem natural (*"Cora, gera o recibo do pagamento de 113 reais"*) gera e envia o PDF oficial no chat em tempo real.
  - **🔘 Botões Interativos:** Confirmação com 1 toque (*"Sim, Confirmar e Salvar"* ou *"Ajustar"*).
  - **📊 Identidade Visual com Ícones:** Relatórios executivos formatados com `🔴` (Despesas), `🟢` (Receitas), `💰` (Saldos), `📊` (DRE), `⏰` (A Pagar), `💵` (A Receber), `📜` (Extrato) e `✅` (Confirmações).

### 2. 📈 Fluxo de Caixa Projetado & Cronograma Diário
- **Curva de Liquidez (30, 60, 90 dias):** Projeção diária do saldo acumulado e alertas de risco de déficit.
- **Integração do Dia Atual:** A linha do dia de hoje (`CURDATE()`) consolida as despesas e receitas já realizadas/pagas no dia + pendências restantes.
- **Painel de Detalhamento Diário:** Ao clicar em qualquer dia da tabela, abre a lista detalhada com badges de status (*Pago / Quitado* ou *Pendente*), categoria, descrição e valor.

### 3. 💳 Gestão Financeira & DRE Gerencial
- **Contas a Pagar & Receber:** Filtros por período, favorecido, status, edição completa, baixa em lote e visualização de comprovante anexo.
- **DRE Gerencial em Tempo Real:** Receita bruta, deduções, receita líquida, custos, despesas fixas/variáveis e lucro operacional.
- **Exportação:** Exportação para PDF timbrado A4 paisagem e planilhas Excel/CSV.

### 4. 🏦 Conciliação Bancária com Parser Brasileiro e Blindagem Anti-Duplicidade
- **Importação de Extratos Bancários (CSV):** Suporte completo aos formatos dos principais bancos brasileiros (Bradesco, Nubank, Itaú, Santander, Banco do Brasil, Inter, Caixa).
- **Parser Inteligente de Formatos Nacionais:**
  - Reconhecimento automático de sufixos `D` (Débito) e `C` (Crédito) (ex: `595,78 D` = despesa, `1.200,00 C` = receita).
  - Suporte a colunas separadas de Débito/Crédito ou coluna única com sinais positivos/negativos.
  - Extração inteligente de descrições reais do extrato, descartando textos genéricos.
- **Blindagem Anti-Duplicidade em 2 Níveis:**
  - **Nível 1 (Na Importação do Arquivo):** Consulta no banco por conta, data, valor, tipo e descrição antes de inserir. Lançamentos idênticos são descartados automaticamente, informando ao usuário quantos registros novos foram criados e quantos foram ignorados por duplicidade.
  - **Nível 2 (Alerta Inteligente de Já Liquidado):** Ao listar movimentações pendentes, cruza os dados com transações já liquidadas (`status = 'pago'`) dos últimos 60 dias com valor e tipo iguais (+/- 2 dias). Exibe um card de destaque amarelo com o botão direto *"Já Lançado (Descartar Extrato)"*.
- **Filtro por Conta Bancária & Limpeza Rápida:** Dropdown no topo para alternar entre contas bancárias e endpoint `POST /api/conciliacao/limpar-fila` para esvaziar pendências de forma instantânea.

### 5. 📈 Investimentos & Carteira B3 em Tempo Real (Wealth Management)
- **Cotações 100% Reais ao Vivo:** Integração direta via feed de mercado da B3 (`query1.finance.yahoo.com/v8/finance/chart/{TICKER}.SA`).
- **Automação de Ativos:** Ao digitar qualquer ticker (ex: `PETR4`, `VALE3`, `MXRF11`, `IVVB11`), busca automaticamente o nome da empresa e a cotação oficial do pregão.
- **Importador Rápido de Planilha B3 / Corretoras:**
  - Botão no topo para upload de arquivo `.CSV`/`.TXT` ou área de colar texto (ex: `PETR4; 100; 38.50`).
  - Identifica automaticamente o ticker, quantidade e preço médio.
  - Detecta automaticamente a classe do ativo: Ações, FIIs (terminados em 11) ou ETFs/BDRs.
  - Consulta a B3 ao vivo e atualiza os preços e nomes oficiais.
- **Nova Aba "Evolução & Renda Passiva":**
  - Gráfico de barras com o fluxo mensal de dividendos/proventos recebidos nos últimos 12 meses.
  - Curva de crescimento patrimonial: Custo Total Investido vs Patrimônio Líquido a Mercado.
  - Indicador de Yield on Cost (YoC): Rentabilidade anual dos proventos sobre o custo de aquisição.
  - Integração com Caixa: Opção de creditar proventos e dividendos diretamente no Caixa/DRE da empresa com 1 clique.
- **Botão "Sincronizar Cotações B3":** Varre todos os papéis da carteira e atualiza os preços de mercado instantaneamente.

### 6. 📊 Dashboard Executivo e Separação Rigorosa DRE vs Fluxo de Caixa
- **DRE (Regime de Competência):** Agrupamento econômico por `data_competencia`.
- **Fluxo de Caixa Mensal (Regime de Caixa):** Agrupamento financeiro rigoroso por `data_pagamento` (data da efetiva liquidação bancária). Transações pagas no mês corrente são alocadas com precisão cirúrgica no mês em que o dinheiro saiu/entrou, evitando distorções em meses anteriores.

---

## 4. Estrutura do Banco de Dados

### Tabelas Centrais:
1. `empresas`: `id`, `nome`, `razao_social`, `cnpj_cpf`, `slug`, `email`, `telefone`, `status_saas`, `ativo`, `trial_ate`, `plano_saas_id`, `limite_filiais`, `limite_usuarios`, `bloqueado_em`.
2. `admins`: `id`, `empresa_id`, `nome`, `email`, `senha`, `telefone`, `cargo`, `status`, `is_super`, `telegram_chat_id`, `telegram_username`.
3. `transacoes_financeiras`: `id`, `empresa_id`, `conta_bancaria_id`, `categoria_id`, `centro_custo_id`, `contato_id`, `tipo` ('receita','despesa','transferencia'), `descricao`, `valor`, `valor_pago`, `data_competencia`, `data_vencimento`, `data_pagamento`, `status` ('pendente','pago','parcial','cancelado','atrasado'), `forma_pagamento`, `recorrente`, `documento_numero`, `comprovante_url`, `observacoes`.
4. `contas_bancarias`: `id`, `empresa_id`, `nome`, `banco`, `saldo_atual`, `ativo`.
5. `categorias_financeiras`: `id`, `empresa_id`, `nome`, `tipo`, `dre_grupo`, `ativo`.
6. `contatos`: `id`, `empresa_id`, `tipo` ('cliente','fornecedor','ambos'), `nome`, `razao_social`, `cpf_cnpj`, `telefone`, `ativo`.
7. `extratos_bancarios_importados`: `id`, `empresa_id`, `conta_bancaria_id`, `data_ocorrencia`, `descricao_banco`, `valor`, `tipo` ('credito','debito'), `status_conciliacao` ('pendente','conciliado','ignorado'), `transacao_id`.
8. `investimentos_carteiras`: `id`, `empresa_id`, `nome`, `tipo_titular` ('pj','pf'), `instituicao_corretora`, `cor`.
9. `investimentos_ativos`: `id`, `empresa_id`, `carteira_id`, `codigo_ticker`, `nome_ativo`, `classe_ativo`, `quantidade`, `preco_medio`, `preco_atual`, `data_aplicacao`, `data_vencimento`.
10. `investimentos_proventos`: `id`, `empresa_id`, `ativo_id`, `tipo_provento`, `valor_liquido`, `data_pagamento`, `status`, `transacao_financeira_id`.
11. `whatsapp_ia_rascunhos`: `id`, `empresa_id`, `admin_id`, `telefone`, `tipo_acao`, `dados_json`, `created_at`, `updated_at`.
12. `whatsapp_mensagens_historico`: `id`, `empresa_id`, `admin_id`, `telefone`, `papel` ('user','assistant'), `conteudo`, `created_at`.
13. `suporte_chamados` & `suporte_mensagens`: Helpdesk e chamados de suporte.
14. `saas_comunicados`: Banners de avisos broadcast.

---

## 5. Rotas de API Principais

| Método | Endpoint | Proteção | Descrição |
|---|---|---|---|
| `POST` | `/api/integracoes/telegram/webhook` | Público | Webhook oficial do Telegram Bot (@NuvyFinanca_bot) |
| `POST` | `/api/integracoes/whatsapp/webhook` | Público / API Key | Webhook oficial da Evolution API / n8n |
| `GET` | `/api/relatorios/fluxo-caixa-projetado` | `auth` | Fluxo de Caixa Projetado (30/60/90 dias) e Cronograma Diário |
| `GET` | `/api/relatorios/dre` | `auth` | DRE Gerencial em tempo real |
| `GET` | `/api/transacoes` | `auth` | Listar transações com filtros de status e período |
| `POST` | `/api/transacoes` | `auth` | Criar transação com anexo de comprovante |
| `POST` | `/api/openfinance/importar-extrato` | `auth` | Importar extrato bancário CSV com proteção anti-duplicidade |
| `POST` | `/api/conciliacao/limpar-fila` | `auth` | Limpar pendências de conciliação de uma ou todas as contas |
| `GET` | `/api/investimentos/resumo` | `auth` | Resumo patrimonial, alocação e fluxo de dividendos de 12 meses |
| `GET` | `/api/investimentos/cotacao-real/:ticker` | `auth` | Consulta cotação ao vivo de qualquer ativo da B3 |
| `POST` | `/api/investimentos/importar` | `auth` | Importar planilha de posições da B3 / Corretoras em lote |
| `POST` | `/api/investimentos/sincronizar-b3` | `auth` | Sincronizar carteira inteira com cotações ao vivo do pregão |
| `GET` | `/api/uploads/comprovantes/:file` | Estático | Visualização direta de imagens de comprovantes |
| `GET` | `/api/suporte/chamados` | `auth` | Listar chamados de suporte da empresa |
| `POST` | `/api/suporte/chamados` | `auth` | Criar novo chamado de suporte |

---

## 6. Comandos Úteis de Manutenção

```bash
# Status dos processos backend
pm2 status

# Reiniciar backend da API
pm2 restart financeiro-api --update-env

# Logs em tempo real da API
pm2 logs financeiro-api --lines 50

# Executar backup manual do banco de dados
/etc/cron.daily/backup-financeiro.sh

# Compilar frontend React para produção
cd /var/www/financeiro/frontend && npm run build

# Testar configuração do Nginx e recarregar
nginx -t && systemctl reload nginx
```

---

## 7. Checklist Obrigatório de Segurança & Desenvolvimento (Code Review / PRs)

Sempre que novos módulos (ex: Precificação, Orçamento 12M, Curva ABC, Relatórios Fiscais) forem implementados ou refatorados, os itens abaixo são de verificação obrigatória:

1. **Multi-Tenancy Estrito:**
   - Todo comando `SELECT`, `UPDATE`, `DELETE` ou `INSERT` deve incluir explicitamente a cláusula `WHERE empresa_id = ?` (ou coluna correspondente). Nunca assumir isolamento apenas por `id`.
2. **RBAC no Backend:**
   - Toda rota nova que realize criação, alteração ou deleção (`POST`, `PUT`, `DELETE`, `PATCH`) deve aplicar o middleware `exigirPermissao("modulo")`. Jamais confiar unicamente no bloqueio visual de botões do frontend.
3. **Proteção de Segredos & Credenciais:**
   - Nunca expor chaves de API, senhas ou tokens em código versionado, histórico ou canais de conversa.
   - Variáveis de ambiente sensíveis devem ser mantidas exclusivamente no `.env` e carregadas via `process.env`.
4. **Validação de Assinatura em Webhooks:**
   - Qualquer novo endpoint público de webhook (ex: Asaas, Mercado Pago, WhatsApp, SMSNET) deve obrigatoriamente exigir token no header (`req.headers`) ou assinar requisições antes de processar alterações de status financeiro.
5. **Sanitização de Datas:**
   - Datas recebidas de provedores externos (ex: IA/OpenAI, gateways, planilhas importadas) devem passar por `toDateSQL()` antes de entrar em queries para evitar erro de truncamento `1292 Incorrect date value` e inconsistências de timezone UTC vs Horário de Brasília.

---

## 8. Modernização do Frontend com Shadcn UI / Radix UI (Concluído em 04/09/2026)

- **Eliminação Completa de Popups Nativos:** 100% dos `window.alert()` e `window.confirm()` em todas as 32 telas do sistema foram substituídos por notificações flutuantes do **Sonner** (`toast.success`, `toast.error`, `toast.warning`, `toast.info`) e modais de confirmação acessíveis com foco protegido (`useConfirmDialog` + `<ConfirmDialog />` baseados em **Radix UI Alert Dialog**).
- **Biblioteca de Componentes Shadcn UI / Radix UI Oficial (`/frontend/src/components/ui/`):**
  - `alert-dialog.jsx` & `useConfirmDialog.jsx`: Diálogos de confirmação acessíveis.
  - `dialog.jsx`: Modais corporativos com animações zoom-in/fade.
  - `dropdown-menu.jsx`: Menus contextuais e ações rápidas de tabela.
  - `sheet.jsx`: Gavetas laterais deslizantes.
  - `tabs.jsx` & `switch.jsx`: Alternância e toggles de configurações.
  - `input.jsx` & `label.jsx`: Campos de formulário com foco e acessibilidade.
  - `avatar.jsx`: Avatares com fallback de iniciais corporativas.
  - `popover.jsx`: Popovers flutuantes ancorados.
  - `chart.jsx`: Integração Recharts com design system do Nuvy Finance.
  - `sonner.jsx` & `<Toaster />`: Sistema de notificações em pilha richColors no topo direito.
- **Higienização Visual & Design Tokens:**
  - 100% das classes residuais `purple-*` foram eliminadas em favor da paleta executiva oficial *Precision Emerald* (`DESIGN.md`).
  - Build de produção (`npm run build`) validado com 0 erros e servido via Nginx.

