#!/usr/bin/env python3
"""Sincroniza e ativa todos os workflows do Nuvy Finance no n8n PostgreSQL respeitando Foreign Keys"""
import json, subprocess, uuid, os

WORKFLOWS = [
    {
        "id": "nuvy-copiloto-v1",
        "file": "/var/www/financeiro/workflows/n8n_copiloto_whatsapp_nuvy.json",
        "active": True
    },
    {
        "id": "nuvy-cron-matinal-v1",
        "file": "/var/www/financeiro/workflows/n8n_cron_lembretes_matinais.json",
        "active": True
    },
    {
        "id": "nuvy-cron-cobranca-v1",
        "file": "/var/www/financeiro/workflows/n8n_cron_regua_cobranca.json",
        "active": True
    }
]

def run_sql(sql):
    r = subprocess.run(
        ['docker', 'exec', 'n8n_postgres', 'psql', '-U', 'n8n', '-d', 'n8n', '-c', sql],
        capture_output=True, text=True
    )
    if r.returncode != 0:
        print("ERRO SQL:", r.stderr.strip()[:300])
    else:
        print("OK:", r.stdout.strip()[:80])
    return r

for item in WORKFLOWS:
    w_id = item["id"]
    w_file = item["file"]
    w_active = 'true' if item["active"] else 'false'
    
    if not os.path.exists(w_file):
        print(f"Arquivo {w_file} não encontrado.")
        continue

    with open(w_file, 'r') as f:
        wf = json.load(f)

    version_id = str(uuid.uuid4())
    nodes_json = json.dumps(wf.get('nodes', []))
    connections_json = json.dumps(wf.get('connections', {}))
    settings_json = json.dumps(wf.get('settings', {}))
    name = wf.get('name', 'Workflow Nuvy')

    nodes_esc = nodes_json.replace("'", "''")
    connections_esc = connections_json.replace("'", "''")
    settings_esc = settings_json.replace("'", "''")
    name_esc = name.replace("'", "''")

    print(f"\n==========================================")
    print(f"Sincronizando: {name} (ID: {w_id})")
    print(f"==========================================")

    # 1. Upsert workflow_entity (sem activeVersionId inicial se for novo)
    print("Passo 1: Inserir/Atualizar workflow_entity")
    run_sql(f"""
    INSERT INTO workflow_entity (id, name, active, nodes, connections, settings, "versionId", "createdAt", "updatedAt")
    VALUES (
        '{w_id}',
        '{name_esc}',
        {w_active},
        '{nodes_esc}'::json,
        '{connections_esc}'::json,
        '{settings_esc}'::json,
        '{version_id}',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        name = '{name_esc}',
        active = {w_active},
        nodes = '{nodes_esc}'::json,
        connections = '{connections_esc}'::json,
        settings = '{settings_esc}'::json,
        "versionId" = '{version_id}',
        "updatedAt" = NOW();
    """)

    # 2. Inserir workflow_history
    print("Passo 2: Inserir workflow_history")
    run_sql(f"""
    INSERT INTO workflow_history ("versionId", "workflowId", authors, nodes, connections, name, autosaved, "nodeGroups")
    VALUES (
        '{version_id}',
        '{w_id}',
        'admin',
        '{nodes_esc}'::json,
        '{connections_esc}'::json,
        '{name_esc}',
        false,
        '[]'
    ) ON CONFLICT ("versionId") DO NOTHING;
    """)

    # 3. Atualizar activeVersionId na workflow_entity
    print("Passo 3: Atualizar activeVersionId")
    run_sql(f"""
    UPDATE workflow_entity 
    SET "activeVersionId" = '{version_id}', active = {w_active}, "updatedAt" = NOW()
    WHERE id = '{w_id}';
    """)

    # 4. Inserir/Atualizar workflow_published_version
    print("Passo 4: Inserir workflow_published_version")
    run_sql(f"""
    INSERT INTO workflow_published_version ("workflowId", "publishedVersionId", "createdAt", "updatedAt")
    VALUES ('{w_id}', '{version_id}', NOW(), NOW())
    ON CONFLICT ("workflowId") DO UPDATE SET "publishedVersionId" = '{version_id}', "updatedAt" = NOW();
    """)

print("\n=== Verificação Final dos Workflows ===")
run_sql("SELECT id, name, active FROM workflow_entity;")
