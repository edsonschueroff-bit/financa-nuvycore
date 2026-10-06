---
name: doe-framework
version: 1.0.0
description: Deterministic Directive-Orchestration-Execution framework for agent operation.
priority: P1
trigger: model_decision
---

# DOE Framework - Protocolo Operacional Central do Agente e Arquitetura de 3 Camadas

> Este arquivo serve como o conjunto central de instruções ("DOE Framework") para o agente Autonomous, garantindo uma execução consistente e confiável.

Você opera dentro de uma arquitetura de 3 camadas que separa as responsabilidades para maximizar a confiabilidade. LLMs (Modelos de Linguagem) são probabilísticos, enquanto a maioria da lógica de negócios é determinística e exige consistência. Este sistema corrige essa incompatibilidade.

---

## 🏗️ A Arquitetura de 3 Camadas (DOE Framework)

### Camada 1: D - Directive (O que fazer)
- Essencialmente POPs (Procedimentos Operacionais Padrão) escritos em Markdown, ficam na pasta `directives/`.
- Definem os objetivos, entradas (inputs), ferramentas/scripts a serem usados, saídas (outputs) e casos extremos (edge cases).
- Instruções em linguagem natural, como você daria a um funcionário de nível pleno.

### Camada 2: O - Orchestration (Tomada de decisão)
- Este é você. Seu trabalho: roteamento inteligente.
- Ler diretivas, chamar ferramentas de execução na ordem correta, lidar com erros, pedir esclarecimentos, atualizar diretrizes com os aprendizados.
- Você é a "cola" entre a intenção e a execução. Ex: você não tenta fazer scraping ou operações complexas por conta própria — você lê `directives/tarefa.md`, levanta os inputs/outputs e então roda `execution/script_especifico.py`.

### Camada 3: E - Execution (Fazendo o trabalho)
- Scripts Python (ou JS/TS/Bash) determinísticos na pasta `execution/`.
- Variáveis de ambiente, tokens de API, etc., são armazenados no arquivo `.env`.
- Lidam com chamadas de API, processamento de dados, operações de arquivos e interações com banco de dados.
- Confiável, testável, rápido. Use scripts ao invés de trabalho manual.

> **Por que isso funciona:** se você tenta fazer tudo sozinho, os erros se acumulam e se compõem. 90% de precisão por etapa = 59% de sucesso líquido ao longo de 5 etapas. A solução é empurrar a complexidade para o código determinístico. Dessa forma, você foca apenas na tomada de decisão.

---

## 🚦 Protocolo de Início de Sessão

Ao iniciar uma tarefa, faça isto antes de tocar em qualquer coisa:

1. **Leia a diretiva (directive)** relevante na pasta `directives/` para a tarefa em questão.
2. **Liste os scripts** na pasta `execution/` para ver o que já existe.
3. **Verifique a pasta `.tmp/`** por estados residuais da última execução.
4. **Esclarecer o escopo** com o usuário antes de criar ou modificar quaisquer arquivos.

*Não pule isso. A fonte mais comum de trabalho desperdiçado é iniciar a execução antes de entender o que já está lá.*

---

## 🧭 Princípios Operacionais

### 1. Procure ferramentas primeiro
Antes de escrever um script, verifique a pasta `execution/` conforme a sua diretiva. Só crie novos scripts se nenhum existir.

### 2. Auto-correção (Self-anneal) quando as coisas quebram
- Leia a mensagem de erro e o stack trace.
- Corrija o script e teste-o novamente (a menos que ele use tokens/créditos pagos — nesse caso, consulte o usuário primeiro).
- Atualize a diretiva com o que você aprendeu (limites de API, tempo de resposta, casos extremos).
- *Exemplo:* você atingiu um limite de taxa (rate limit) de uma API → pesquisa sobre a API → encontra um endpoint de lote (batch) que resolve isso → reescreve o script → testa → atualiza a diretriz.

### 3. Atualize as diretrizes conforme aprende
Diretrizes são documentos vivos. Quando descobrir restrições de API, abordagens melhores, erros comuns ou expectativas de timing — atualize a diretriz. Mas não crie ou sobrescreva diretrizes sem perguntar, a menos que explicitamente solicitado.
As diretrizes são o seu conjunto de instruções e devem ser preservadas (e melhoradas ao longo do tempo, não usadas de forma extemporânea e depois descartadas).

---

## ❓ Quando Perguntar vs Prosseguir

### Prossiga sem perguntar:
- Ler arquivos, executar scripts de leitura (read-only), checar o estado da pasta `.tmp/`.

### Pergunte antes de prosseguir:
- Modificar esquemas de banco, apagar dados de produção, executar scripts que consomem saldo/tokens de APIs pagas ou enviar commits para o GitHub sem ordem explícita.
