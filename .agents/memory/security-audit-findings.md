---
type: reference
created: 2026-08-17
updated: 2026-08-17
---

# Security Audit Findings (Aug 2026)

## Solved (Emergencial Hotfix)
- **Emergency Backups Expostos:** As rotas em `GET /api/emergency/backups` estavam acessíveis publicamente. Foram trancadas com `auth`, `authorize('super_admin')` e `$EMERGENCY_ACCESS_TOKEN` em `server.js`.
- **N8N IA Context Leak:** O endpoint `GET /api/n8n/ia-contexto` vazava histórico de chats sem auth. Trancado no `crmIaController.js` forçando header `Authorization: Bearer <TOKEN>` batendo com `empresa_configs` (onde config_type = `n8n_webhook_token`).

## Pending Issues (Alta/Média Severidade)
- **Hierarquia Matriz/Filial (Escalada de Privilégios):** O `filialController.js` permite a um administrador de filial (role owner/manager) alterar ou desativar **outras filiais** de sua mesma `matriz_id`, pois falta validação de contexto na tabela associativa `admin_empresas`.
- **SSRF nos Webhooks Outbound:** O arquivo `webhookOutboundService.js` faz `axios.post(webhook.url)` sem sanitizar se o IP destino é interno (ex: `localhost`, AWS Meta-data `169.254.169.254`).
- **Alertas ao Dono (Sem Rate Limit):** O endpoint `/api/empresa-config/alertas-dono/testar` que envia mensagem via WhatsApp dispara `enviarMensagemDireta` em `ownerAlertsService.js` sem nenhum limite de requisições.
- **CORS Aberto:** `server.js` exporta `app.use(cors())` universal (*).
- **Inbound Webhook Evolution API:** A API `/api/crm/webhook` não checa rigorosamente assinaturas, abrindo margem para message spoofing.
- **Senhas em Plain-Text:** As credenciais dos roteadores MikroTik na tabela `mikrotiks` estão abertas no BD.
