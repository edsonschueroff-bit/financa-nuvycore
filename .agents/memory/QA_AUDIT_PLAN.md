# 📋 Plano Mestre de Auditoria & Checklist de Testes (QA / Stress / Infraestrutura)
**Sistema:** NuvyCore Hotspot SaaS & MikroTik RouterOS  
**Escopo:** Testes Funcionais, Segurança, Integração de Rede, Pagamentos e Stress  
**Versão:** 2.4.0  
**Status da Auditoria:** Pronto para Execução (Iniciando em `MTK-01`)  

---

## 📊 Placar de Progresso da Auditoria
- **Total de Casos de Teste:** 22
- **Aprovados (PASS):** 0
- **Reprovados (FAIL):** 0
- **Pendentes:** 22
- **Ponto de Parada Atual:** `MTK-01` (Autenticação via RADIUS)

---

## 1. 🌐 Integração com MikroTik & RouterOS

| ID | Camada | Cenário de Teste | Ação / Passo a Passo | Resultado Esperado | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **MTK-01** | **RADIUS** | Autenticação via RADIUS (UDP 1812) | 1. Monitorar log MikroTik: `/log print follow-only where topics~"radius"`<br>2. Logar no portal com voucher.<br>3. Verificar liberação. | Recebe `Access-Accept` com atributos de banda; tráfego liberado em `< 500ms`. | 🟡 Pendente |
| **MTK-02** | **Resiliência** | Queda e Reboot do Roteador (RB) | 1. Autenticar clientes.<br>2. Executar `/system reboot` no MikroTik.<br>3. Validar reconexão WireGuard e API. | Túnel WireGuard e API voltam automaticamente; clientes com cookie/MAC Auth reconectam sem novo login. | ⚪ Pendente |
| **MTK-03** | **Walled Garden** | Liberação Pré-Login (Gateways/CDNs) | 1. Sem login, navegar em URLs de pagamento (Mercado Pago, EFI/Gerencianet). | Páginas de pagamento carregam normalmente mantendo restante da web bloqueada. | ⚪ Pendente |
| **MTK-04** | **IP Binding** | Bypass de Dispositivos Específicos | 1. Cadastrar MAC da impressora/POS como "Bypassed".<br>2. Verificar binding no MikroTik. | Dispositivo acessa internet sem portal captivo (`type=bypassed`). | ⚪ Pendente |
| **MTK-05** | **PoD / CoA** | Desconexão Remota (Kick de Sessão) | 1. Clicar em "Desconectar" no painel admin.<br>2. Monitorar `/ip hotspot active`. | NuvyCore envia PoD (UDP 3799); cliente é desconectado instantaneamente. | ⚪ Pendente |
| **MTK-06** | **Queues** | Limitação Dinâmica de Banda | 1. Logar com plano 5M/2M.<br>2. Rodar Speedtest/Fast.com. | MikroTik cria Queue Simple com limites exatos de `2M/5M`. | ⚪ Pendente |

---

## 2. 📱 Portal Captivo & Experiência do Usuário (CNA / UX)

| ID | Camada | Cenário de Teste | Ação / Passo a Passo | Resultado Esperado | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **CNA-01** | **CNA Pop-up** | Abertura Automática do Navegador Nativo | 1. Conectar dispositivo iOS, Android e Windows no Wi-Fi. | Assistente de conexão (CNA) abre automaticamente na tela de login. | ⚪ Pendente |
| **CNA-02** | **HTTPS Redirect** | Acesso Direto HTTPS antes do Login | 1. Sem login, tentar acessar `https://google.com`. | Redirecionamento limpo para o portal sem erro de certificado SSL no navegador. | ⚪ Pendente |
| **CNA-03** | **Voucher Único** | Login com Voucher Térmico (PDV) | 1. Digitar código `WIFI-8X92` na aba Voucher.<br>2. Clicar em "Liberar Acesso". | Autenticado no FreeRADIUS; redirect para Cardápio/Sucesso; internet ativa. | ⚪ Pendente |
| **CNA-04** | **LGPD & Termos** | Consentimento e Registro de Opt-in | 1. Tentar cadastro sem marcar checkbox LGPD.<br>2. Marcar e submeter. | Bloqueia se desmarcado; grava IP, MAC e data/hora do consentimento no banco. | ⚪ Pendente |
| **CNA-05** | **MAC Auth / Cookie** | Reconexão Automática (Persistência) | 1. Desconectar e reconectar o Wi-Fi do smartphone autenticado. | Libera acesso imediato via Cookie/MAC Auth sem pedir novo login. | ⚪ Pendente |
| **CNA-06** | **Multi-Idioma** | Troca Dinâmica de Idioma (i18n) | 1. Alternar bandeiras 🇧🇷 PT, 🇺🇸 EN e 🇪🇸 ES no portal. | Textos e botões mudam instantaneamente de idioma. | ⚪ Pendente |

---

## 3. 💳 Gateway de Pagamentos & Webhooks

| ID | Camada | Cenário de Teste | Ação / Passo a Passo | Resultado Esperado | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **PAY-01** | **PIX Dinâmico** | Geração e Pagamento de Cobrança PIX | 1. Gerar QR Code PIX.<br>2. Efetuar pagamento.<br>3. Monitorar webhook. | Webhook recebido em `< 2s`; fatura muda para paga; MikroTik libera acesso. | ⚪ Pendente |
| **PAY-02** | **Idempotência** | Webhook Duplicado / Retentativas | 1. Enviar 3 requisições POST idênticas do webhook. | Processa apenas uma vez; responde 200 OK sem duplicar sessões. | ⚪ Pendente |
| **PAY-03** | **PIX Expirado** | Pagamento após o Tempo Limite | 1. Aguardar expiração da cobrança (5 min). | Portal avisa expiração e impede liberação indevida. | ⚪ Pendente |
| **PAY-04** | **Dead-Letter / Retry** | Falha de Comunicação com Backend | 1. Simular backend offline no momento do webhook.<br>2. Subir backend 2 min depois. | Gateway retenta envio; backend processa e libera a conta retroativamente. | ⚪ Pendente |

---

## 4. ⏱️ Gestão de Sessões, Franquias & Segurança de Rede

| ID | Camada | Cenário de Teste | Ação / Passo a Passo | Resultado Esperado | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **NET-01** | **Session Timeout** | Expiração de Tempo de Acesso | 1. Autenticar plano teste de 2 minutos.<br>2. Aguardar expiração. | MikroTik desconecta cliente pontualmente e exige novo login. | ⚪ Pendente |
| **NET-02** | **Simultaneidade** | Limite de Dispositivos por Conta | 1. Plano com 1 usuário simultâneo.<br>2. Tentar logar em 2 celulares. | Rejeita segundo login ou desconecta o primeiro (conforme regra). | ⚪ Pendente |
| **NET-03** | **Isolamento L2** | Client Isolation (Ataques Locais) | 1. Conectar 2 laptops no Wi-Fi.<br>2. Laptop A tenta pingar Laptop B. | Pacotes bloqueados no nível de Access Point/Bridge (sem tráfego lateral). | ⚪ Pendente |
| **NET-04** | **MAC Spoofing** | Clonagem de MAC Bypassed | 1. Dispositivo altera MAC para MAC autenticado. | MikroTik detecta colisão de IP/MAC e bloqueia conflito de rede. | ⚪ Pendente |

---

## 5. 🖥️ Painel Administrativo, Logs & Testes de Stress

| ID | Camada | Cenário de Teste | Ação / Passo a Passo | Resultado Esperado | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **ADM-01** | **Monitoramento** | Heartbeat de Roteadores (Online/Offline) | 1. Desconectar cabo de rede do MikroTik.<br>2. Observar painel admin. | Roteador muda para 🔴 Offline em até 60s e dispara alerta ao dono. | ⚪ Pendente |
| **ADM-02** | **Auditoria LGPD** | Direito ao Esquecimento | 1. Acessar `/privacidade/:slug`.<br>2. Validar OTP e solicitar esquecimento. | Dados anonimizados no MySQL; gera hash SHA-256 e certificado oficial. | ⚪ Pendente |
| **STR-01** | **Stress / Carga** | 200 Logins Simultâneos em 5s | 1. Disparar script de carga no endpoint de login. | Resposta em `< 800ms`, CPU `< 75%`, zero erros 500. | ⚪ Pendente |
| **STR-02** | **Queda do Banco** | Falha e Retomada do MySQL | 1. Parar temporariamente o MySQL.<br>2. Religar o serviço. | Pool do Node.js se reconecta automaticamente sem reiniciar aplicação. | ⚪ Pendente |
