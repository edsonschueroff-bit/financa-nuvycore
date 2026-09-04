#!/usr/bin/env python3
"""Registra o workflow Nuvy Finance completamente no n8n postgres"""
import json, subprocess, uuid

# Ler o workflow
with open('/var/www/financeiro/workflows/n8n_copiloto_whatsapp_nuvy.json') as f:
    wf = json.load(f)

workflow_id = 'nuvy-copiloto-v1'
version_id = str(uuid.uuid4())
nodes_json = json.dumps(wf.get('nodes', []))
connections_json = json.dumps(wf.get('connections', {}))
settings_json = json.dumps(wf.get('settings', {}))
name = wf.get('name', 'Nuvy Finance - Copiloto WhatsApp AI')

def run_sql(sql):
    r = subprocess.run(
        ['docker', 'exec', 'n8n_postgres', 'psql', '-U', 'n8n', '-d', 'n8n', '-c', sql],
        capture_output=True, text=True
    )
    if r.returncode != 0:
        print("ERRO SQL:", r.stderr[:300])
    else:
        print("OK:", r.stdout.strip()[:100])
    return r

# 1. Inserir na workflow_entity com activeVersionId
nodes_esc = nodes_json.replace("'", "''")
connections_esc = connections_json.replace("'", "''")
settings_esc = settings_json.replace("'", "''")

print("=== Inserindo workflow_entity ===")
run_sql(f"""
UPDATE workflow_entity 
SET "versionId" = '{version_id}', "updatedAt" = NOW()
WHERE id = '{workflow_id}';
""")

# 2. Inserir na workflow_history (versão ativa)
print("=== Inserindo workflow_history ===")
run_sql(f"""
INSERT INTO workflow_history ("versionId", "workflowId", authors, nodes, connections, name, autosaved, "nodeGroups")
VALUES (
    '{version_id}',
    '{workflow_id}',
    'admin',
    '{nodes_esc}'::json,
    '{connections_esc}'::json,
    '{name}',
    false,
    '[]'
) ON CONFLICT ("versionId") DO NOTHING;
""")

# 3. Atualizar activeVersionId na workflow_entity
print("=== Atualizando activeVersionId ===")
run_sql(f"""
UPDATE workflow_entity 
SET "activeVersionId" = '{version_id}'
WHERE id = '{workflow_id}';
""")

# 4. Inserir na workflow_published_version
print("=== Inserindo workflow_published_version ===")
run_sql(f"""
INSERT INTO workflow_published_version ("workflowId", "publishedVersionId")
VALUES ('{workflow_id}', '{version_id}')
ON CONFLICT ("workflowId") DO UPDATE SET "publishedVersionId" = '{version_id}', "updatedAt" = NOW();
""")

# 5. Verificar resultado final
print("\n=== Verificando workflow_entity ===")
run_sql(f"""
SELECT id, name, active, "versionId", "activeVersionId" FROM workflow_entity WHERE id = '{workflow_id}';
""")

print(f"\nVersion ID criado: {version_id}")
