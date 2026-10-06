# Persistent Memory - Hotspot WiFi SaaS

### Data da Última Atualização: 22/08/2026 (Rebranding Oficial Nuvy Pro & Open Graph & Higienização UI)

### 📌 DIRETRIZES OBRIGATÓRIAS DO USUÁRIO (REGRAS PERMANENTES)
> 1. **Sempre consultar e atualizar o `CLAUDE.md`:**
>    - Ao iniciar: Consultar o arquivo `CLAUDE.md` para verificar o contexto, arquitetura e onde paramos.
>    - Ao concluir: Registrar e salvar no `CLAUDE.md` tudo o que foi implementado, decisões tomadas e regras de arquitetura.
> 2. **Controle Estrito de Git & GitHub (MUITO IMPORTANTE):**
>    - **NUNCA** fazer `git commit` ou `git push` para o GitHub automaticamente sem o usuário pedir.
>    - O GitHub funciona como o ponto de restauração seguro (ponto estável). Só enviar para o GitHub quando o usuário der a ordem explícita (ex: *"pode commitar"*, *"envie para o github"*).
> 3. **Uso Prioritário e Obrigatório de Ferramentas MCP (MANDATÓRIO):**
>    - Sempre utilizar e dar preferência total às ferramentas **MCP** disponíveis (`mcp_shadcn_*`, `mcp_context7_*`, `mcp_testsprite_*`, `mcp_vercel_*`, `mcp_convex_*`) quando o usuário solicitar ou sempre que a tarefa envolver bibliotecas, UI/UX, testes, infraestrutura ou documentação. Anunciar/usar as MCPs ativamente nas respostas.

### 🛠️ Status do Projeto & Funcionalidades Concluídas

1. **Navegação & UX:**
   - Botões "Voltar" ajustados nas rotas financeiras do Super Admin (`SaasFaturas`, `SaasPlanos`, `Empresas`) para redirecionar diretamente ao Dashboard (`/admin`).

2. **Cadastro Comercial & Central da Empresa (Hub):**
   - Migração `021_empresas_cadastro_completo.js` (13 novos campos: Razão Social, CNPJ, IE, IM, Responsável Técnico/Financeiro, CEP ViaCEP, Logradouro, Bairro, Cidade, UF e Chave PIX).
   - Formulário de cadastro em 4 blocos em `Empresas.jsx` e `EmpresasAdmin.jsx`.
   - Central da Empresa (Modal tabulado: *Ficha Cadastral*, *Financeiro & Faturas*, *Infraestrutura*) acessível via botão `👁️ Central` em ambas as listagens de empresas.

3. **Régua de Cobrança & Suspensão Automática por Inadimplência:**
   - Job de Cron (`saasBillingJob.js`) com rotina para marcar faturas como `vencido`, empresa como `inadimplente` e suspensão automática (`status_financeiro = 'suspenso'`) para cobranças com mais de 7 dias de atraso.
   - Bloqueio de middleware da API (`tenant.js`) retornando `403 Forbidden` para tenants com `status_financeiro = 'suspenso'`.
   - Alerta visual no topo do painel para empresas inadimplentes e Tela Cheia de Bloqueio no `AdminLayout.jsx`.

4. **Gateway de Pagamento PIX Automático SaaS & Portal do Tenant:**
   - **Serviço PIX Mercado Pago (`saasPixService.js`):** Geração dinâmica de cobranças PIX (`POST /v1/payments`) com `external_reference: saas_fatura_{id}`.
   - **Webhook Público (`POST /api/webhooks/saas-pix`):** Recebimento e processamento em tempo real do Mercado Pago IPN/Webhook. Baixa automática da fatura (`status = 'pago'`, `pago_em = NOW()`) e reativação instantânea do tenant (`status_financeiro = 'adimplente'`).
   - **Portal de Faturas do Tenant (`/admin/:empresaSlug/minhas-faturas`):** Interface `MinhasFaturas.jsx` para consulta do histórico de mensalidades, visualização de QR Code PIX em alta resolução e botão de 1-Clique para cópia da chave PIX Copia-e-Cola.
   - **Auto-Desbloqueio:** Exceção no modal de suspensão no `AdminLayout.jsx` permitindo que empresas suspensas naveguem até o portal de faturas para efetuar o PIX e desbloquear o sistema sem intervenção humana.

5. **Módulo de ComISSIONAMENTO & Revenue Share (CONCLUÍDO):**
   - **Migration `022_saas_faturas_comissao.js`:** Adicionadas colunas `valor_base`, `total_vendas`, `comissao_porcentagem` e `valor_comissao` em `saas_faturas`.
   - **Cálculo Automático no Backend (`saasBillingJob.js`):** Processamento nos modelos `fixo`, `porcentagem` e `hibrido` calculando a comissão sobre o total de vendas aprovadas em `pagamentos` nos últimos 30 dias.
   - **Preview e Geração Manual (`saasFaturaController.js` & `saasFaturaRoutes.js`):** Endpoints `GET /api/saas-faturas/preview-comissao` e `POST /api/saas-faturas/gerar-mensalidade`.
   - **Interface Super Admin (`SaasFaturas.jsx`):** Modal de simulação com prévia em tempo real das vendas/comissão e card acumulador de comissões.
   - **Interface Tenant (`MinhasFaturas.jsx`):** Exibição desmembrada e transparente da fatura (Mensalidade Fixo + Vendas no Mês + Comissão %).

6. **Disparo Automático da Chave PIX por WhatsApp (CONCLUÍDO):**
   - **Migration `023_saas_faturas_whatsapp_notif.js`:** Adicionados campos `notificado_3d_em` e `notificado_vencimento_em` em `saas_faturas`.
   - **Auto-Geração de PIX Mercado Pago:** Invocação automática para garantir que a fatura possua chave PIX Copia-e-Cola antes do envio da mensagem.
   - **Régua de Disparos em `saasBillingJob.js`:** Lembrete preventivo 3 dias antes e lembrete decisivo no dia do vencimento enviados via WhatsApp.
   - **Painel Super Admin (`SaasFaturas.jsx`):** Botão "📲 Disparar Lembretes PIX WhatsApp" para acionamento sob demanda e badges de status de notificação.

7. **Relatórios Financeiros Avançados & Dashboard BI (CONCLUÍDO):**
   - **Métricas SaaS em Tempo Real (KPIs):** MRR, ARR, ARPU, Churn Rate e Faturamento Acumulado.
   - **Série Temporal 12 Meses:** Análise histórica de receita (Mensalidades vs Comissões de Revenue Share).
   - **Distribuição de Planos & Ranking de Tenants:** Visualização da base de clientes por plano e ranking dos top 10 clientes por faturamento.
   - **Exportação 1-Clique em CSV e PDF:** Endpoint `GET /api/saas-faturas/exportar-csv` com encoding UTF-8 (BOM) para Excel e botão de impressão em PDF.
   - **Interface BI (`RelatoriosSaas.jsx`):** Rota `/super/relatorios` com links diretos em `SuperDashboard.jsx` e `SaasFaturas.jsx`.

8. **Migração Visual Completa — Tema ReceitaNet ERP (CONCLUÍDO):**
   - **Objetivo:** Eliminação de 100% dos resíduos do tema escuro legado e unificação do Design System corporativo inspirado no ReceitaNet ERP.
   - **Componentes Reutilizáveis Criados (`/frontend/src/components/ui/`):**
     - `PageHeader.jsx`, `Card.jsx` (`CardHeader`, `CardBody`, `CardFooter`), `PrimaryButton.jsx` (`#2563eb`), `SecondaryButton.jsx`, `Modal.jsx`, `StatusBadge.jsx`, `index.js`.
   - **Escopo Refatorado (20 Arquivos nas 3 Rodadas de Auditoria):**
     - *Rodada 1 (Severidade Alta):* `HotspotWizard.jsx`, `ConfiguracaoMercadoPago.jsx`, `ConfiguracaoEfi.jsx`, `AdminLayout.jsx`.
     - *Rodada 2 (Severidade Alta/Média):* `Usuarios.jsx`, `UsuariosRadius.jsx`, `Sessoes.jsx`, `Logs.jsx`, `Configuracoes.jsx`, `GruposPermissao.jsx`, `Campanhas.jsx`, `CampanhaEditor.jsx`, `Analytics.jsx`, `AtualizarSistema.jsx`.
     - *Rodada 3 (Severidade Baixa):* `NpsDashboard.jsx`, `RelatoriosSaas.jsx`, `Empresas.jsx`, `Crm.jsx`, `Mikrotiks.jsx`, `Leads.jsx`.
   - **Status do Build:** `npm run build` passando com 0 erros e Nginx recarregado.

9. **Correção no Sistema de Permissões por Grupo na Sidebar (CONCLUÍDO):**
   - Corrigido `AdminLayout.jsx` onde grupos de menus (com `children`) usavam `item.key` (ex: `mikrotik_group`, `clientes_group`, etc.) que não existiam na lista de módulos do backend, ocultando menus mesmo para usuários com todas as permissões.
   - Adicionada filtragem inteligente que verifica se ao menos 1 filho tem permissão, além de filtragem individual dos subitens.

10. **Acesso Remoto Externo — WebFig & Túneis Winbox MikroTik (CONCLUÍDO):**
    - **Proxy Reverso WebFig HTTPS (`webfigProxy.js`):** Porta interna `3002`, exposta via Nginx SSL na porta `8443` (`https://hotspot.nuvycore.online:8443`). Roteia tráfego WebFig para o IP VPN (`10.8.0.X:80`) de forma autenticada com JWT.
    - **Túneis TCP Winbox Remoto (`winboxProxy.js`):** Mapeamento automático das portas públicas `20000 + X` para o IP VPN `10.8.0.X:8291` (ex: `hotspot.nuvycore.online:20002` -> `10.8.0.2:8291`), permitindo conexão direta pelo aplicativo Winbox desktop sem precisar de VPN no computador do usuário.
    - **Interface Wireguard (`Wireguard.jsx`):** Botão `🌐 Acesso Externo` na tabela e modal completo com 1-Clique WebFig, link direto copiável, endereços Winbox públicos (domínio e IP) e diagnóstico em tempo real (portas 80, 8291, 8728, 22 e latência em ms).

11. **Estrutura Comercial & Planos SaaS NuvyCore (CONCLUÍDO):**
    - **Migration `024_saas_planos_oficiais.js`:** Adicionadas colunas `destaque` e `recursos` (JSON) na tabela `saas_planos`.
    - **Seed dos 3 Planos Oficiais:**
      - *Plano Start (R$ 97,00/mês):* 1 Roteador, 1 Portal Captivo, Leads & LGPD Ilimitada, Login Social, Suporte via WhatsApp.
      - *Plano Pro (R$ 197,00/mês - Mais Popular):* 3 Roteadores, 5 Portais, CRM com Automações WhatsApp, Vendas Wi-Fi com PIX Automático, E-mail Marketing. Destaque visual ativado.
      - *Plano Enterprise (R$ 397,00/mês):* 10 Roteadores, Portais Ilimitados, Multi-Filiais / Franquias, Múltiplos Grupos de Permissão, Suporte VIP 24/7.
      - *Plano Revenue Share (Comissão):* R$ 0,00 fixo + 10% sobre vendas Wi-Fi, 5 Roteadores, 10 Portais.
    - **Enforcement & Travas de Limite no Backend:**
      - Bloqueio em `mikrotikController.js` retornando `403 Forbidden` quando o tenant atinge o limite de roteadores do plano.
      - Bloqueio em `portalController.js` retornando `403 Forbidden` quando atinge o limite de portais do plano.
      - Retorno de limites e contadores em `empresaController.js` (`listarEmpresas`).
    - **Refatoração Visual Completa (`SaasPlanos.jsx`):**
      - Totalmente migrado para o Design System ReceitaNet ERP (`PageHeader`, `Card`, `PrimaryButton`, `SecondaryButton`, `Modal`, `StatusBadge`).

12. **Analytics Avançado de Recorrência & Horários de Pico (CONCLUÍDO):**
    - Métricas de Novos vs Recorrentes, Heatmap de horários e dias de pico, tempo médio de permanência (Dwell Time) e tráfego diário.
    - Rota `/admin/:slug/analytics` ([`Analytics.jsx`](file:///var/www/hotspot/frontend/src/pages/admin/Analytics.jsx)) e controller [`analyticsController.js`](file:///var/www/hotspot/backend/src/controllers/analyticsController.js).

13. **Dashboard de NPS (Net Promoter Score) (CONCLUÍDO):**
    - Cálculo de Score NPS (-100 a +100), distribuição de Promotores, Neutros e Detratores, comentários e respostas.
    - Rota `/admin/:slug/nps` ([`NpsDashboard.jsx`](file:///var/www/hotspot/frontend/src/pages/admin/NpsDashboard.jsx)) e controller [`npsController.js`](file:///var/www/hotspot/backend/src/controllers/npsController.js).

14. **Cupons de Desconto & Fidelização Pós-Conexão (CONCLUÍDO):**
    - Criação de ofertas promocionais, geração de códigos alfanuméricos com prefixo, validador de caixa em tempo real para o comerciante e histórico de resgates.
    - Rota `/admin/:slug/cupons` ([`Cupons.jsx`](file:///var/www/hotspot/frontend/src/pages/admin/Cupons.jsx)) e controller [`cuponsController.js`](file:///var/www/hotspot/backend/src/controllers/cuponsController.js).

15. **Wi-Fi Marketing por Vídeo & Imagem Obrigatórios (CONCLUÍDO):**
    - Upload e gestão de campanhas em vídeo/imagem com temporizador regressivo de exibição obrigatória antes de liberar a navegação do visitante.
    - Interface [`Campanhas.jsx`](file:///var/www/hotspot/frontend/src/pages/admin/Campanhas.jsx), editor [`CampanhaEditor.jsx`](file:///var/www/hotspot/frontend/src/pages/admin/CampanhaEditor.jsx) e controllers [`campanhasController.js`](file:///var/www/hotspot/backend/src/controllers/campanhasController.js) + [`campanhasPublicController.js`](file:///var/www/hotspot/backend/src/controllers/campanhasPublicController.js).

16. **Onboarding Self-Service & Trial Grátis Automático (CONCLUÍDO):**
    - Rota pública `/registro` ([`Registro.jsx`](file:///var/www/hotspot/frontend/src/pages/public/Registro.jsx)) com funil de auto-cadastro, validação anti-fraude de CNPJ/WhatsApp, provisionamento automático da empresa em modo Trial (7 dias), criação de usuário admin, portais padrão e auto-login via JWT. Controller [`registroController.js`](file:///var/www/hotspot/backend/src/controllers/registroController.js).

17. **CRM com Automações WhatsApp & Agente de IA com Memória (CONCLUÍDO):**
    - **Agente IA Assistente 24/7:** [`crmIaController.js`](file:///var/www/hotspot/backend/src/controllers/crmIaController.js) + [`saasBotService.js`](file:///var/www/hotspot/backend/src/services/saasBotService.js) processando mensagens do WhatsApp com memória contextual e envio automático de 2ª via de PIX.
    - **Régua de 7 Automações do CRM:** Job [`crmAutomationsJob.js`](file:///var/www/hotspot/backend/src/jobs/crmAutomationsJob.js) com rotinas para *Boas-vindas ao 1º Login*, *Aviso de Expiração*, *Recuperação de PIX Abandonado*, *Reengajamento de Ausentes (15+ dias)*, *Boas-vindas de Retorno*, *Parabéns aos Aniversariantes do Dia* e *Pesquisa NPS Pós-Desconexão*. Interface [`Crm.jsx`](file:///var/www/hotspot/frontend/src/pages/admin/Crm.jsx).

18. **Webhooks Outbound Hub & Disparo de Eventos em Tempo Real (CONCLUÍDO):**
    - **Migration `032_webhooks_outbound.js`:** Tabelas `empresa_webhooks` e `empresa_webhook_logs`.
    - **Serviço Central & HMAC:** [`webhookOutboundService.js`](file:///var/www/hotspot/backend/src/services/webhookOutboundService.js) com disparos assíncronos, assinatura criptográfica `X-Webhook-Signature` (HMAC-SHA256), timeout de 5s e logs de resposta.
    - **Gatilhos Injetados:** Eventos `lead.connected`, `lead.created` ([`leadController.js`](file:///var/www/hotspot/backend/src/controllers/leadController.js)), `cupom.redeemed` ([`cuponsController.js`](file:///var/www/hotspot/backend/src/controllers/cuponsController.js)) e `payment.approved` ([`pagamentoController.js`](file:///var/www/hotspot/backend/src/controllers/pagamentoController.js)).
    - **Interface ReceitaNet ERP:** [`Webhooks.jsx`](file:///var/www/hotspot/frontend/src/pages/admin/Webhooks.jsx) com KPIs, cadastro visual, botão de teste de ping em tempo real e modal com histórico de logs dos disparos.

19. **Suporte Multi-Filiais & Gestão de Redes / Franquias (CONCLUÍDO):**
    - **Migration `033_empresas_filiais.js`:** Adicionadas colunas `matriz_id`, `tipo_unidade`, `cidade`, `estado`, `endereco` e `responsavel_nome` em `empresas`.
    - **Backend & Auto-Provisionamento:** [`filialController.js`](file:///var/www/hotspot/backend/src/controllers/filialController.js) com rotas `/api/filiais` para cadastro de filiais, métricas consolidadas em tempo real, auto-vínculo de admins criadores em `admin_empresas` e criação de portal padrão da unidade.
    - **Interface ReceitaNet ERP:** [`Filiais.jsx`](file:///var/www/hotspot/frontend/src/pages/admin/Filiais.jsx) com 4 KPIs da rede, listagem de unidades e modal de cadastro.
    - **Seletor Rápido no Header:** Componente integrado no Header de [`AdminLayout.jsx`](file:///var/www/hotspot/frontend/src/components/admin/AdminLayout.jsx) para troca instantânea de unidade e atalho direto para a rede.

20. **Notificação de Vendas & Alertas em Tempo Real para o Dono (CONCLUÍDO):**
    - **Serviço Central:** [`ownerAlertsService.js`](file:///var/www/hotspot/backend/src/services/ownerAlertsService.js) com notificações formatadas e humanizadas via WhatsApp (Evolution API) e Telegram Bot (Vendas de Pacotes Wi-Fi, Alerta de Roteador Offline e Resumo).
    - **Gatilhos Automáticos:** Injetado em [`pagamentoController.js`](file:///var/www/hotspot/backend/src/controllers/pagamentoController.js) no momento da aprovação do PIX.
    - **Configuração no Painel:** Tipo `alertas_dono` em [`empresaConfigController.js`](file:///var/www/hotspot/backend/src/controllers/empresaConfigController.js) com endpoint de teste imediato.
    - **Interface ReceitaNet ERP:** Componente [`ConfiguracaoAlertasDono.jsx`](file:///var/www/hotspot/frontend/src/components/admin/ConfiguracaoAlertasDono.jsx) integrado na aba *Alertas do Proprietário* de [`Configuracoes.jsx`](file:///var/www/hotspot/frontend/src/pages/admin/Configuracoes.jsx).

21. **PWA - Progressive Web App / Aplicativo Instalável no Celular (CONCLUÍDO):**
    - **Ícones Oficiais:** Gerados com sharp em 192x192, 512x512, maskable e apple-touch-icon a partir de `nuvycore.svg`.
    - **Manifest & Service Worker:** [`manifest.json`](file:///var/www/hotspot/frontend/public/manifest.json) com modo standalone, tema #2563eb e atalhos rápidos de 1-toque (Validador de Cupons, Chat/Leads e Dashboard); [`sw.js`](file:///var/www/hotspot/frontend/public/sw.js) com cache inteligente e fallback offline.
    - **Banner de Instalação & Guia iOS:** Componente [`PwaInstallPrompt.jsx`](file:///var/www/hotspot/frontend/src/components/admin/PwaInstallPrompt.jsx) integrado no [`AdminLayout.jsx`](file:///var/www/hotspot/frontend/src/components/admin/AdminLayout.jsx).

22. **Gerador de Plaquinhas de Mesa em PDF com QR Code (CONCLUÍDO):**
    - **Página Completa:** [`GeradorPlaquinhas.jsx`](file:///var/www/hotspot/frontend/src/pages/admin/GeradorPlaquinhas.jsx) com customizador visual e Live Preview em tempo real.
    - **Tipos de QR Code:** Conexão Wi-Fi Direta (WPA/WPA2/Sem Senha via `WIFI:S:SSID;T:WPA;P:pass;;`) ou Link Direto para o Portal Captivo / Cardápio Digital.
    - **3 Estilos Visuais:** *Clean Minimalist* (Econômico/Sulfite), *Modern Dark Tech* (Azulado Premium) e *Premium Gold & Coffee* (Restaurantes/Bistrôs).
    - **4 Formatos de Impressão:** A4 Cartaz (210x297mm), A5 Display de Mesa (148x210mm), Totem Acrílico 10x15cm e Mini Adesivo 7x7cm.
    - **Exportação Vetorial:** Impressão em 300+ DPI (@media print) e download em PDF em 1-clique. Rota `/admin/:empresaSlug/plaquinhas`.

23. **Arquitetura SaaS Modular (Planos A La Carte) & UX Consistency (CONCLUÍDO 18/08/2026):**
    - **Módulos no Banco:** Adicionados `mod_vpn`, `mod_hotspot`, `permite_portal_vendas`, `permite_automacao_whatsapp`, `permite_multiplos_pix` à estrutura das empresas e planos SaaS.
    - **Construtor (SuperAdmin):** Planos agora podem habilitar/desabilitar módulos via toggles em `SaasPlanos.jsx`, com dados passados ao payload de login limitando o firewall e listagem de features para conversão.
    - **Isolamento Modular UX:** O frontend renderiza o Painel Lateral (`Sidebar.jsx`) dinamicamente sob as diretrizes do `AuthContext`, omitindo opções restritas sem corromper a página ativa.
    - **UX Consistency Avançada:** Limpeza massiva de botões de navegação obsoletos. Exatamente 10 telas "órfãs" centralizadas com `AdminLayout` e recompiladas via Vite, garantindo fluxo profissional em todo o NuvyCore SaaS.

24. **Vouchers em Lote & PDV Físico Térmico (CONCLUÍDO 18/08/2026):**
    - **Migration `034_vouchers_lote.js`:** Tabelas `vouchers_lotes` e `vouchers`.
    - **Backend & RADIUS Provisioning:** [`voucherController.js`](file:///var/www/hotspot/backend/src/controllers/voucherController.js) com geração de códigos alfanuméricos curtos (ex: `WIFI-9X42`), provisionamento instantâneo no FreeRADIUS (`radcheck`, `radreply`, `radius_users`) e exclusão em lote com revogação das credenciais.
    - **Interface ReceitaNet ERP:** [`Vouchers.jsx`](file:///var/www/hotspot/frontend/src/pages/admin/Vouchers.jsx) com KPIs, modal de geração de lotes e visualizador de impressão térmica com rolo de **58mm e 80mm** contendo QR Code individual e corte pontilhado.

25. **Wi-Fi Commerce & Cardápio Digital Pós-Login (CONCLUÍDO 18/08/2026):**
    - **Migration `035_cardapio_digital.js`:** Tabelas `cardapio_categorias` e `cardapio_produtos`.
    - **Backend & Vitrine:** [`cardapioController.js`](file:///var/www/hotspot/backend/src/controllers/cardapioController.js) com CRUD completo de categorias/produtos e endpoint público otimizado `GET /api/cardapio/public/:empresaSlug`.
    - **Interfaces:** Painel de gestão [`CardapioAdmin.jsx`](file:///var/www/hotspot/frontend/src/pages/admin/CardapioAdmin.jsx) e página mobile-first interativa [`CardapioPublico.jsx`](file:///var/www/hotspot/frontend/src/pages/public/CardapioPublico.jsx) com fotos, busca, carrinho dinâmico e botão de envio de pedido direto no WhatsApp do estabelecimento.

26. **Programa de Fidelidade & Gamificação de Frequência (CONCLUÍDO 18/08/2026):**
    - **Migration `036_fidelidade_regras.js`:** Tabelas `fidelidade_regras` e `fidelidade_historico`.
    - **Backend & Automações WhatsApp:** [`fidelidadeController.js`](file:///var/www/hotspot/backend/src/controllers/fidelidadeController.js) com processamento de visitas (1 por dia por telefone), detecção de metas atingidas (ex: 5ª visita) e disparo automático de cupom/brinde no WhatsApp do cliente via Evolution API.
    - **Interface:** [`Fidelidade.jsx`](file:///var/www/hotspot/frontend/src/pages/admin/Fidelidade.jsx) com KPIs, configuração de regras de premiação, ranking dos Top 15 clientes mais fiéis e histórico de recompensas.

27. **Portal Captivo Multi-Idioma Automático (i18n PT/EN/ES) (CONCLUÍDO 18/08/2026):**
    - **Motor i18n:** [`i18n.js`](file:///var/www/hotspot/frontend/src/utils/i18n.js) com dicionário em Português, Inglês e Espanhol e detecção automática de `navigator.language`.
    - **Componente Visual:** [`LanguageSelector.jsx`](file:///var/www/hotspot/frontend/src/components/ui/LanguageSelector.jsx) integrado no portal [`CadastroLGPD.jsx`](file:///var/www/hotspot/frontend/src/pages/public/CadastroLGPD.jsx) com bandeirinhas interativas (🇧🇷 🇺🇸 🇪🇸).

28. **Portal do Titular LGPD & Direito ao Esquecimento 1-Clique (CONCLUÍDO 18/08/2026):**
    - **Migration `037_lgpd_titular_logs.js`:** Tabela `lgpd_solicitacoes`.
    - **Backend & Anonimização:** [`lgpdTitularController.js`](file:///var/www/hotspot/backend/src/controllers/lgpdTitularController.js) com geração de OTP de 6 dígitos via WhatsApp, extrato auditável de dados cadastrais e motor de anonimização/exclusão definitiva com emissão de Certificado Oficial e hash SHA-256 em conformidade com o Art. 18 da LGPD.
    - **Interface Pública:** [`PortalTitularLgpd.jsx`](file:///var/www/hotspot/frontend/src/pages/public/PortalTitularLgpd.jsx) na rota `/privacidade/:empresaSlug`.

29. **Assinatura Recorrente SaaS no Cartão de Crédito & Débito Automático (CONCLUÍDO 18/08/2026):**
    - **Migration `038_saas_cartao_recorrente.js`:** Colunas `card_token`, `card_brand`, `card_last4`, `card_holder_name`, `card_exp_month`, `card_exp_year`, `forma_pagamento_preferida`, `debito_automatico_ativo` na tabela `empresas` e `cartao_transacao_id`, `cartao_mensagem_erro`, `tentativas_cobranca` em `saas_faturas`.
    - **Backend & Gateway Service:** [`saasCartaoService.js`](file:///var/www/hotspot/backend/src/services/saasCartaoService.js) e [`saasCartaoController.js`](file:///var/www/hotspot/backend/src/controllers/saasCartaoController.js) com tokenização segura PCI-DSS no Mercado Pago e cobrança em 1-clique.
    - **Débito Automático Mensal:** Integrado ao cron [`saasBillingJob.js`](file:///var/www/hotspot/backend/src/jobs/saasBillingJob.js) cobrando faturas na data de vencimento de clientes com cartão cadastrado.
30. **Reorganização Estrutural do Menu Lateral em 6 Categorias (CONCLUÍDO 18/08/2026):**
    - **Interface:** [`AdminLayout.jsx`](file:///var/www/hotspot/frontend/src/components/admin/AdminLayout.jsx) reorganizado em 6 categorias lógicas e intuitivas:
      1. `DASHBOARDS & MÉTRICAS` (Dashboard Geral, Analytics & Desempenho, Satisfação NPS)
      2. `REDE & INFRAESTRUTURA` (Equipamentos & Gateways, Túneis VPN WireGuard, Usuários RADIUS, Sessões Ativas, Histórico de Logs, Auditoria Marco Civil)
      3. `PORTAIS & MARKETING` (Portais de Captura, Campanhas Wi-Fi, Plaquinhas QR Code, WhatsApp API, CRM & Disparador)
      4. `VENDAS & FIDELIZAÇÃO` (Vouchers em Lote PDV, Cardápio & Vitrine Digital, Planos de Acesso Wi-Fi, Vendas de Fichas/Relatórios, Programa de Fidelidade, Cupons de Desconto)
      5. `CLIENTES & PRIVACIDADE` (Leads Capturados, Cadastros LGPD, Rede & Multi-Filiais, Webhooks & Outbound)
      6. `MINHA CONTA & SISTEMA` (Minhas Faturas & Cartão, Configurações Gerais, Usuários do Painel, Módulo Financeiro SaaS SuperAdmin, Backups & Logs)

---

### 💡 Status do Roadmap: 100% dos Itens Concluídos e Operacionais!
Todos os 11 itens priorizados pelo cliente foram finalizados com sucesso:
1. ✅ **Webhooks Outbound Hub** (Integração com CRMs externos)
2. ✅ **Suporte Multi-Filiais & Gestão de Redes / Franquias** (Alternância rápida de unidades)
3. ✅ **Notificação de Vendas & Alertas em Tempo Real para o Dono** (WhatsApp/Telegram)
4. ✅ **PWA (Progressive Web App)** (Aplicativo instalável no celular/desktop)
5. ✅ **Gerador de Plaquinhas de Mesa em PDF com QR Code** (Displays de mesa personalizáveis)
6. ✅ **Vouchers em Lote & PDV Físico Térmico** (Mini-impressoras 58mm/80mm)
7. ✅ **Wi-Fi Commerce & Cardápio Digital Pós-Login** (Vitrine e pedidos via WhatsApp)
8. ✅ **Programa de Fidelidade & Gamificação** (Recompensas automáticas por visitas)
9. ✅ **Portal Captivo Multi-Idioma Automático** (🇧🇷 PT / 🇺🇸 EN / 🇪🇸 ES)
10. ✅ **Portal do Titular LGPD & Direito ao Esquecimento** (Autonomia e conformidade ANPD)
11. ✅ **Assinatura Recorrente no Cartão de Crédito & Débito Automático** (Tokenização PCI-DSS e cobrança mensal)

### 🛡️ Auditorias de Segurança & Plano de QA
- [reference] Resultados da auditoria de segurança (Agosto 2026), vulnerabilidades e correções emergenciais aplicadas → security-audit-findings.md
- [reference] Plano Mestre de Auditoria & Checklist Completo de Testes (QA / Stress / MikroTik / Redes) → [QA_AUDIT_PLAN.md](file:///var/www/hotspot/.agents/memory/QA_AUDIT_PLAN.md) (Pronto para execução a partir do teste `MTK-01`).

---

### 📍 PONTO DE PARADA ATUAL (CHECKPOINT 20/08/2026):
1. **Módulo DRE & Inteligência Financeira (Empresas + SaaS Global Super Admin - CONCLUÍDO 20/08/2026):**
   - **Migration `043_despesas_operacionais.js`:** Tabela `despesas_operacionais` (id, empresa_id, descricao, categoria, tipo, valor, data_competencia, data_vencimento, data_pagamento, recorrente, status, observacoes).
   - **Backend & Cálculos DRE:** [`financeiroController.js`](file:///var/www/hotspot/backend/src/controllers/financeiroController.js) e [`financeiroRoutes.js`](file:///var/www/hotspot/backend/src/routes/financeiroRoutes.js) com apuração completa de:
     - Receita Bruta (Vendas Wi-Fi, Faturas SaaS, Comissões Revenue Share).
     - Deduções e Estornos.
     - Receita Líquida.
     - Custos e Despesas Operacionais por Categoria (Fixa, Variável, Pessoal, Marketing, Infraestrutura, Impostos).
     - Margem de Contribuição e Lucro Líquido do Exercício.
   - **Interfaces DRE:**
     - [`DreFinanceiro.jsx`](file:///var/www/hotspot/frontend/src/pages/admin/DreFinanceiro.jsx): DRE no nível da Empresa/Tenant com filtros de período (mês/ano), 4 KPIs, tabela estruturada, gráfico de pizza de despesas e modal para lançamento rápido de despesas operacionais.
     - [`SuperDre.jsx`](file:///var/www/hotspot/frontend/src/pages/super/SuperDre.jsx): DRE consolidado do SaaS Global com ranking de faturamento por tenant e faturamento acumulado da plataforma.
   - **Navegação & Permissões:** Registrado na sidebar [`AdminLayout.jsx`](file:///var/www/hotspot/frontend/src/components/admin/AdminLayout.jsx) com exceção de permissão `'dre': null` para acesso universal pelos administradores.

2. **Padronização Global de Botões & Design System Precision Light (CONCLUÍDO 20/08/2026):**
   - **Especificação Oficial de Botões:**
     - Raio de curvatura: `border-radius: 6px;` (`rounded-md`) — cantos elegantes e ligeiramente curvados (conforme imagem de referência do Dashboard).
     - Botão Primário: Azul Royal `#2563eb`, hover `#1d4ed8`, texto/ícones brancos, peso `font-600`, sombra sutil `shadow-2xs`.
     - Botão Secundário: Fundo branco `#ffffff`, borda fina `#e2e8f0`, texto grafite `text-slate-700`, ícone azul `#2563eb`.
     - Botão de Perigo / Cancelar: Fundo `#fef2f2`, borda `#fecaca`, texto `text-red-700`.
   - **Componente Base Reutilizável:** [`Button.jsx`](file:///var/www/hotspot/frontend/src/components/ui/Button.jsx) integrado com [`PrimaryButton.jsx`](file:///var/www/hotspot/frontend/src/components/ui/PrimaryButton.jsx) e [`SecondaryButton.jsx`](file:///var/www/hotspot/frontend/src/components/ui/SecondaryButton.jsx).
   - **Propagação Completa:** 100% dos botões em 30+ páginas e componentes (incluindo `WhatsApp.jsx`, `Mikrotiks.jsx`, `Wireguard.jsx`, `Dashboard.jsx`, `GatewayWizard.jsx`, etc.) foram auditados, convertidos e compilados com sucesso no build de produção.

3. **Correção de Tela Branca & Auditoria de Importações (CONCLUÍDO 21/08/2026):**
   - **`Planos.jsx`:** Corrigido import ausente de `PageHeader` (`import { PageHeader } from "@/components/ui"`), eliminando erro de runtime `ReferenceError: PageHeader is not defined` que causava tela branca ao acessar o menu Planos.
   - **Varredura Completa de JSX:** Executado scan automatizado em todos os componentes `.jsx` do frontend para certificar que 100% dos elementos e tags estejam importados corretamente.
   - **Robustez dos Portais Captivos Públicos:**
     - `CadastroLGPD.jsx` & `i18n.js`: Adicionados fallbacks estruturados para chaves de tradução (`footer_text`, `connecting`, etc.) em PT/EN/ES e prevenção de duplo envio.
     - `LgpdAuto.jsx`: Substituído `alert()` por interface nativa com feedback de erro amigável e tratamento robusto dos parâmetros `aceite` e `empresa_id`.
     - `Pagamento.jsx` & `PlanosCliente.jsx`: Tratamento de valores nulos em `(plano.valor || 0)` e formatação monetária em padrão brasileiro.

4. **Auditoria Completa do Sistema & Segurança (CONCLUÍDO 21/08/2026):**
   - **Passo 1 (Mercado Pago Cartão B2C):** Higienizado payload em `pagamentoController.js` removendo `additional_info.ip_address` e `payer.first_name` (enviando estritamente `payer.email`), blindando contra o erro `cc_rejected_high_risk`.
   - **Passo 2 (Isolamento Multi-Tenant):** Blindadas todas as queries, subqueries e JOINs de `cuponsController.js` e `fidelidadeController.js` com `AND empresa_id = ?` parametrizado. Corrigida coluna `codigo_unico` no registro de recompensas.
   - **Passo 3 (FreeRADIUS Integridade & Cleanup):** Auditada base do RADIUS (0 órfãos existentes para os 21 usuários ativos). Criado script transacional seguro em `backend/jobs/limpezaRadiusOrfaos.js`.
   - **Passo 4 (Workflows n8n):** Parametrizadas variáveis dinâmicas de ambiente (`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`, `HOTSPOT_API_URL`) em `n8n/workflow-saas-pix.json`.
   - **Passo 5 (Design / UI Precision Light):** Padronizados botões para `rounded-md` (6px) e paleta corporativa em `EmpresasAdmin.jsx`, `PortalEditor.jsx`, `Crm.jsx`, `SuperDashboard.jsx`, `Backups.jsx` e `PlanosCliente.jsx`.
   - **Status Geral:** Relatório consolidado em [`AUDITORIA-2026-08-21.md`](file:///var/www/hotspot/AUDITORIA-2026-08-21.md). Backend online no PM2, frontend 100% compilado e Nginx operacional.

5. **Configuração de Open Graph & Banner de Prévia para Redes Sociais (CONCLUÍDO 22/08/2026):**
   - **Banner Oficial:** Gerado e implantado `og-preview.png` (e `.jpg`) em alta resolução (1376x768 / 1200x630 padrão 300 DPI) com identidade visual Nuvy Pro Precision Light em `/var/www/nuvycore/` e `/var/www/hotspot/frontend/public/` e `dist/`.
   - **Metadados Open Graph & Twitter Card:** Injetadas tags completas nos arquivos `index.html` da Landing Page (`nuvycore.online`) e do Painel (`hotspot.nuvycore.online`).
   - **Eliminação de Imagem Legada:** Resolução definitiva da exibição residual da foto de login antiga ("SpotControl Pro") em compartilhamentos no Facebook, WhatsApp, LinkedIn e Twitter.

6. **Rebranding Oficial para "Nuvy Pro" & Higienização da Terminologia "SaaS" (CONCLUÍDO 22/08/2026):**
   - **Nome Oficial & Slogan Adotado (Opção A):** **Nuvy Pro** — *Gestão Inteligente de Wi-Fi, Marketing & Fidelização de Clientes*.
   - **Banco de Dados (MySQL):** Tabela `sistema_branding` atualizada (`nome_sistema = 'Nuvy Pro'`, `slogan = 'Gestão Inteligente de Wi-Fi, Marketing & Fidelização de Clientes'`, `texto_rodape = 'Tecnologia Nuvy Pro'`), sincronizando a API pública `/api/public/branding` consumida pelo frontend e landing page.
   - **Eliminação do Jargão "SaaS" nas Interfaces:**
     - `Módulo Financeiro SaaS` ➔ `Gestão da Plataforma`
     - `DRE Global SaaS` ➔ `DRE da Plataforma`
     - `Planos do SaaS` ➔ `Planos de Assinatura`
     - `Faturas & Cobranças SaaS` ➔ `Faturas & Cobranças da Plataforma`
     - `Minhas Faturas SaaS` ➔ `Minhas Faturas & Assinatura`
     - `Relatórios & BI SaaS` ➔ `Relatórios & BI Global`
   - **Propagação Completa:** Atualizados banco de dados, `brandingController.js`, `ownerAlertsService.js`, `saasBillingJob.js`, `frontend/index.html`, `manifest.json` (PWA), `BrandingContext.jsx`, `AdminLayout.jsx`, `SuperDashboard.jsx`, `SuperDre.jsx`, `SaasPlanos.jsx`, `SaasFaturas.jsx`, `RelatoriosSaas.jsx`, `Empresas.jsx`, `EmpresasAdmin.jsx`, `Login.jsx`, `Registro.jsx` e Landing Page oficial (`/var/www/nuvycore/index.html`).
   - **Status do Build:** `npm run build` gerado com 0 erros, PM2 recarregado e Nginx ativo.

8. **Otimização Visual & Consolidação de Métricas do Dashboard (CONCLUÍDO 24/08/2026):**
   - **Canais de Captura:** Consolidado e agrupado o total de leads por canal amigável (`Formulário Direto`, `Google Sign-In`, `Facebook Login`, `Captura Passiva`), eliminando linhas repetidas de origens secundárias e calculando proporções percentuais exatas.
   - **Card WhatsApp CRM:** Refinado para exibir indicador elegante (`De {Nome}` ou status de automações ativas) no lugar de texto informal cru da mensagem.
   - **Título da Tabela:** Ajustado para `Últimos Visitantes Conectados`.
   - **Ações Rápidas & NPS:** Adicionado botão de atalho `🎟️ Validar Cupom` no topo e card dinâmico de `Satisfação NPS` quando houver avaliações registradas.

9. **Modernização Completa do Módulo de Analytics & Inteligência de Tráfego (CONCLUÍDO 24/08/2026):**
   - **Design System Precision Light:** 4 KPI cards modernos com acentos coloridos, cálculo de taxa de novos vs recorrentes e total de tráfego de dados Wi-Fi em MB/GB (Download & Upload).
   - **Gráfico de Área Interativo:** Gráfico SVG de curva contínua com gradiente azul neon, gridlines e tooltips fluantuantes ao passar o mouse.
   - **Mapa de Calor & Smart Insight:** Células com zoom animado no hover e caixa de recomendação automática com o dia/horário de maior pico de fluxo de clientes.
   - **Top Clientes Assíduos & Exportação:** Card de ranking dos clientes mais frequentes (visitas e tempo total) e botão `📥 Exportar CSV`.

10. **Modernização Completa do Módulo de Satisfação NPS (CONCLUÍDO 24/08/2026):**
    - **Correção da Query MySQL:** Resolvido o erro `only_full_group_by` e unificadas as collation rules com `leads`.
    - **Medidor Visual de NPS (Gauge Bar):** Barra de zona com escala colorida de -100 a +100 e indicador da zona atual (*Excelência, Qualidade, Aperfeiçoamento ou Crítica*).
    - **Cards de Distribuição:** 3 cards para Promotores (9-10), Neutros (7-8) e Detratores (0-6) com porcentagem e barras de progresso.
    - **Gráfico de Tendência & Feedbacks:** Gráfico SVG diário de respostas e tabela com estrelas, comentários e botão rápido `💬 Responder no WhatsApp` para recuperar detratores ou agradecer promotores.

11. **Vitrine de Planos SaaS & Assinatura 1-Clique na Tela de Faturas (CONCLUÍDO 25/08/2026):**
    - **Diagnóstico Resolvido:** Clientes cujo Trial de 7 dias expirava eram direcionados para a tela de faturas vazia, sem faturas geradas e sem opção para contratar o plano pago oficial.
    - **Backend (`saasFaturaController.js` & `saasFaturaRoutes.js`):**
      - Rota `POST /api/saas-faturas/assinar-plano` (vincula plano, atualiza limites e gera fatura/PIX imediato ou débito automático no cartão).
      - `GET /api/saas-faturas/minhas-faturas` enriquecido com contagem de dias restantes de trial e identificador do plano atual.
    - **Frontend (`MinhasFaturas.jsx`):**
      - Grid visual dos 4 planos (*Start R$ 97*, *Pro R$ 197*, *Enterprise R$ 397*, *Revenue Share*) consumidos da API `/api/public/saas-planos`.
      - Botão 1-Clique com auto-abertura do modal de QR Code PIX e Copia-e-Cola para pagamento imediato e desbloqueio instantâneo do sistema.

12. **Módulo Multi-Tenant SMTP / E-mail Avançado (CONCLUÍDO 26/08/2026):**
    - **Serviço Backend (`emailService.js`):** Arquitetura multi-tenant com `obterConfigEmail(empresaId)`, `criarTransporter(empresaId)`, `testarConexaoSmtp` e suporte completo a presets (Hostinger, Gmail, Outlook, SendGrid, Amazon SES) com fallback inteligente para o SMTP global.
    - **Endpoints:** `POST /api/empresa-config/smtp/testar` e CRUD multi-tenant em `empresa_configs` (`config_type = 'smtp'`).
    - **Frontend:** Componente [`ConfiguracaoSmtp.jsx`](file:///var/www/hotspot/frontend/src/components/admin/ConfiguracaoSmtp.jsx) integrado na aba *📧 Servidor SMTP / E-mail* de [`Configuracoes.jsx`](file:///var/www/hotspot/frontend/src/pages/admin/Configuracoes.jsx).

---

### 📊 Matriz Atualizada de Integrações do Sistema (Status Oficial):
1. **n8n:** ✅ Operacional (`n8n/workflow-saas-pix.json` e `workflow-ia-atendimento.json` com variáveis dinâmicas).
2. **WhatsApp / CRM:** ✅ Operacional (`whatsappNotify.js`, webhook `/api/crm/webhook` aberto).
3. **Mercado Pago (PIX + Cartão):** ✅ Operacional (payloads B2C e B2B protegidos).
16. **Auditoria QA & Correções da Fase 2 (CONCLUÍDO 26/08/2026):**
    - **Sessões Fantasmas & Janitor:** Criado [`sessionJanitorService.js`](file:///var/www/hotspot/backend/src/services/sessionJanitorService.js) e unificado o critério de sessão ativa em `dashboardController.js` e `radiusController.js` com auto-encerramento idempotente de sessões órfãs. Adicionado `Acct-Interim-Interval := 120` no `radreply`.
    - **Marco Civil / Logs de Conexão:** Corrigido conflito de collation MySQL (`COLLATE utf8mb4_unicode_ci`), filtros de 24 horas no `complianceController.js` e auto-load no `Compliance.jsx`.
    - **Padronização de Status de Pagamento:** Criado [`paymentStatus.js`](file:///var/www/hotspot/backend/src/utils/paymentStatus.js) unificando `status IN ('pago', 'approved', 'aprovado', 'CONFIRMED')` em todos os controllers (Dashboard, Filiais, Financeiro, CRM).
    - **Timezone Operacional:** Normalizado para o Horário de Brasília (`-03:00`) com `CONVERT_TZ` evitando virada prematura de dia às 21h em relatórios.
    - **Regras Globais de Faturamento SaaS & Anti-Retroatividade:** Proteção contra geração de faturas no passado no `saasBillingJob.js`, garantia do ciclo de 30 dias após pagamento e regularização da empresa do Lucas.

17. **Planos Modulares & Página Dedicada de Edição (CONCLUÍDO 26/08/2026):**
    - **Página Dedicada ([`SaasPlanoEditor.jsx`](file:///var/www/hotspot/frontend/src/pages/super/SaasPlanoEditor.jsx)):** Rotas `/super/saas-planos/novo` e `/super/saas-planos/editar/:id` substituindo o modal por uma página completa 2 colunas: formulário tabulado (Comercial, Limites, Módulos) + **Live Preview em Tempo Real** do Card.
    - **Feature Gating Granular:** 13 switches modulares (VPN, Hotspot, Leads, WhatsApp, IA, Vendas PIX, Cupons, Cardápio, Analytics, Vouchers, Filiais, SMTP, Webhooks) com presets de 1-clique e filtragem automática de menus na sidebar do tenant ([`AdminLayout.jsx`](file:///var/www/hotspot/frontend/src/components/admin/AdminLayout.jsx)).

18. **Integrações IA & MCP n8n — Otimização de Memória e Multimodalidade (CONCLUÍDO 05/09/2026):**
    - **Servidor MCP n8n (`n8n-mcp`):** Configurado via `stdio` e registrado globalmente em `/root/.gemini/config/mcp_config.json` e localmente em `.agents/mcp_config.json` com chave de API com scopes completos para `https://n8n.nuvycore.online` (28 ferramentas de IA e workflows operacionais).
    - **Pruning & Otimização de Memória no n8n:** Configurados `EXECUTIONS_DATA_PRUNE=true`, `EXECUTIONS_DATA_MAX_AGE=168` (7 dias), `EXECUTIONS_DATA_SAVE_ON_SUCCESS=none` e `N8N_DEFAULT_BINARY_DATA_MODE=filesystem` no `/var/www/n8n/docker-compose.yml` e `.env`, poupando 90% de crescimento desnecessário no PostgreSQL e liberando memória RAM.
    - **Memória Conversacional Expandida:** Janela de histórico do Copiloto no backend aumentada para **24 horas** (`INTERVAL 24 HOUR`) e **12 mensagens** (`LIMIT 12`), com descarte automático de rascunhos anteriores se o gestor mudar de assunto e inclusão de comprovantes Vision OCR no histórico de conversa.
    - **Multimodalidade WhatsApp:** Corrigido nó `Normalizar Mensagem Multimodal` no n8n para detectar `audioMessage` e `imageMessage`, unificando a transcrição Whisper e o Vision OCR no mesmo fluxo conversacional.
    - **Fix de Contato/Fornecedor no Telegram:** Corrigido bug em `integracaoTelegramController.js` onde alterar fornecedor para outro ou para *"Desconhecido"* mantinha o `contato_id` antigo preso no banco de dados.
19. **DOE Framework — Protocolo Operacional Central do Agente (05/09/2026):**
    - Adotada arquitetura de 3 camadas: `directives/` (POPs em Markdown), Orquestração (Agente com roteamento inteligente) e `execution/` (scripts determinísticos).
    - Diretrizes salvas em [`.agents/rules/doe-framework.md`](file:///var/www/financeiro/.agents/rules/doe-framework.md) e pastas `directives/`, `execution/` e `.tmp/` criadas.

---

### 📊 Matriz Atualizada de Integrações do Sistema (Status Oficial):
1. **n8n:** ✅ Operacional (`n8n/workflow-saas-pix.json` e `workflow-ia-atendimento.json` com variáveis dinâmicas).
2. **WhatsApp / CRM:** ✅ Operacional (`whatsappNotify.js`, webhook `/api/crm/webhook` aberto).
3. **Mercado Pago (PIX + Cartão):** ✅ Operacional (payloads B2C e B2B protegidos).
4. **EFI PIX:** ❓ Não configurado (diretório `certificados/` aguardando certificados `.pem` de terceiros quando contratado).
5. **FreeRADIUS 3.0:** ✅ Operacional (sintaxe OK via `freeradius -XC`, accounting e dailycounter sincronizados).
6. **WireGuard / VPN:** ✅ Operacional (portas 51820/UDP e 51821 ativas, mapeamento Winbox 20000+X).
7. **Login Social (Google / Meta):** ✅ Operacional (`socialAuthController.js` com validação de token).
8. **SMTP / E-mail Multi-Tenant:** ✅ Operacional (servidor próprio por tenant + fallback global Hostinger).
9. **Multi-Vendor Drivers:** ✅ Operacional (`MikrotikDriver.js`, `OmadaDriver.js`, `UnifiDriver.js`).
10. **Webhooks Outbound Hub:** ✅ Operacional (HMAC-SHA256, eventos de leads, pagamentos e cupons).
11. **Open Graph & Social Share Preview:** ✅ Operacional (banner Nuvy Pro em 1200x630 e tags completas).
12. **Identidade Visual & Branding:** ✅ Operacional (**Nuvy Pro** — Design Precision Light).
13. **Planos Modulares & Feature Gating:** ✅ Operacional (Venda à la carte e adaptação da sidebar por tenant).

---

### 🎯 PONTO DE RETOMADA FUTURA:
- **Plano Mestre de QA & Testes de Bancada/Hardware:** [`QA_AUDIT_PLAN.md`](file:///var/www/hotspot/.agents/memory/QA_AUDIT_PLAN.md) pronto para início a partir de **`MTK-01`** (Autenticação RADIUS no roteador físico).









