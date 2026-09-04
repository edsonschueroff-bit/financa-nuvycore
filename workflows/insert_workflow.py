#!/usr/bin/env python3
import json
import subprocess
import sys

# Ler o workflow
with open('/var/www/financeiro/workflows/n8n_copiloto_whatsapp_nuvy.json') as f:
    wf = json.load(f)

nodes = json.dumps(wf.get('nodes', []), ensure_ascii=False).replace("'", "''")
connections = json.dumps(wf.get('connections', {}), ensure_ascii=False).replace("'", "''")
settings = json.dumps(wf.get('settings', {}), ensure_ascii=False).replace("'", "''")

sql = f"""
INSERT INTO workflow_entity (id, name, active, nodes, connections, settings, \"staticData\", \"createdAt\", \"updatedAt\", \"pinData\", \"versionId\", meta, \"triggerCount\", \"isArchived\")
VALUES (
  'nuvy-copiloto-v1',
  'Nuvy Finance - Copiloto WhatsApp AI',
  true,
  '{nodes}'::jsonb,
  '{connections}'::jsonb,
  '{settings}'::jsonb,
  NULL,
  NOW(),
  NOW(),
  NULL,
  gen_random_uuid(),
  NULL,
  0,
  false
) ON CONFLICT (id) DO UPDATE SET
  nodes = EXCLUDED.nodes,
  connections = EXCLUDED.connections,
  settings = EXCLUDED.settings,
  active = true,
  \"updatedAt\" = NOW();
"""

result = subprocess.run(
    ['docker', 'exec', 'n8n_postgres', 'psql', '-U', 'n8n', '-d', 'n8n', '-c', sql],
    capture_output=True, text=True
)
print("STDOUT:", result.stdout)
print("STDERR:", result.stderr[:500] if result.stderr else "")
print("Return code:", result.returncode)
