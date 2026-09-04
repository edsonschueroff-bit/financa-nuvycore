# 🤖 Guia de Integração WhatsApp AI (Evolution API + n8n + Nuvy Finance)

Este diretório contém os templates de workflows do **n8n** prontos para importar na sua instância oficial: `https://n8n.nuvycore.online`.

---

## 🔑 Credenciais & Endpoints Configurados

- **URL Base Backend Nuvy Finance**: `http://127.0.0.1:3005/api/integracoes/whatsapp`
- **Header de Autenticação**: `X-Nuvy-Integracao-Key`
- **Chave de Integração (API Key)**: `nuvy_wh_9a8b1c4e7f290d238a9d18721c0e69830da`

---

## 📡 Endpoints Disponíveis para o n8n

### 1. `POST /api/integracoes/whatsapp/identificar-usuario`
Recebe o número do WhatsApp de quem enviou e retorna a empresa, categorias e contas bancárias ativas.
```json
{
  "telefone": "5511999999999"
}
```

### 2. `POST /api/integracoes/whatsapp/lancar-transacao`
Lança uma receita ou despesa automaticamente com vínculo ao tenant.
```json
{
  "telefone": "5511999999999",
  "tipo": "despesa",
  "descricao": "Almoço de Negócios",
  "valor": 78.50,
  "categoria_nome": "Alimentação & Refeições",
  "status": "pago",
  "forma_pagamento": "pix"
}
```

### 3. `GET /api/integracoes/whatsapp/resumo-dia?telefone=5511999999999`
Retorna saldo consolidado e lista de contas a pagar/receber com vencimento hoje para o resumo matinal.

### 4. `GET /api/integracoes/whatsapp/consultar-dre-resumo?telefone=5511999999999`
Retorna o faturamento líquido, despesas totais, lucro líquido e margem % do mês atual.

---

## 🚀 Como Ativar no n8n

1. Acesse seu painel: `https://n8n.nuvycore.online`.
2. Vá em **Workflows** ➔ **Import from File...** e selecione os arquivos `.json` desta pasta:
   - `n8n_copiloto_whatsapp_nuvy.json`
   - `n8n_cron_lembretes_matinais.json`
3. Na sua instância da **Evolution API** (`http://127.0.0.1:8080`), configure o webhook para apontar para o webhook gerado no n8n.
