import requests
import uuid

BASE_URL = "http://localhost:3005"
TIMEOUT = 30

# Replace these credentials with valid tenant user credentials for authentication
AUTH_CREDENTIALS = {
    "email": "tenant_user",
    "senha": "tenant_password"
}

def authenticate():
    url = f"{BASE_URL}/api/auth/login"
    resp = requests.post(url, json=AUTH_CREDENTIALS, timeout=TIMEOUT)
    assert resp.status_code == 200, f"Authentication failed: {resp.text}"
    token = resp.json().get("token")
    assert token, "JWT token not returned"
    return token

def test_financial_transactions_crud_and_batch_operations():
    token = authenticate()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    created_ids = []

    try:
        # Create accounts payable transaction (despesa)
        despesa_payload = {
            "tipo": "despesa",
            "descricao": f"Conta a pagar teste {uuid.uuid4()}",
            "valor": 1500.50,
            "data_vencimento": "2026-12-15",
            "empresa_id": None,  # Should be automatically inferred, omit if not needed
            "rateios": [
                {"centro_custo_id": 1, "percentual": 100}
            ]
        }
        resp = requests.post(f"{BASE_URL}/api/transacoes", json=despesa_payload, headers=headers, timeout=TIMEOUT)
        assert resp.status_code == 201, f"Failed to create despesa transaction: {resp.text}"
        despesa = resp.json()
        despesa_id = despesa.get("id")
        assert despesa_id, "Despesa transaction ID missing in response"
        created_ids.append(despesa_id)

        # Create accounts receivable transaction (receita)
        receita_payload = {
            "tipo": "receita",
            "descricao": f"Conta a receber teste {uuid.uuid4()}",
            "valor": 2500.75,
            "data_vencimento": "2026-12-20",
            "empresa_id": None,
            "rateios": [
                {"centro_custo_id": 2, "percentual": 100}
            ]
        }
        resp = requests.post(f"{BASE_URL}/api/transacoes", json=receita_payload, headers=headers, timeout=TIMEOUT)
        assert resp.status_code == 201, f"Failed to create receita transaction: {resp.text}"
        receita = resp.json()
        receita_id = receita.get("id")
        assert receita_id, "Receita transaction ID missing in response"
        created_ids.append(receita_id)

        # Retrieve each transaction and validate fields
        for tx_id, original_payload in [(despesa_id, despesa_payload), (receita_id, receita_payload)]:
            resp = requests.get(f"{BASE_URL}/api/transacoes/{tx_id}", headers=headers, timeout=TIMEOUT)
            assert resp.status_code == 200, f"Failed to get transaction {tx_id}: {resp.text}"
            tx = resp.json()
            assert tx.get("id") == tx_id
            assert tx.get("tipo") == original_payload["tipo"]
            assert abs(float(tx.get("valor", 0)) - original_payload["valor"]) < 0.01
            assert tx.get("descricao").startswith("Conta a ")

        # Update one transaction (despesa)
        despesa_update = {
            "descricao": f"Conta a pagar atualizada {uuid.uuid4()}",
            "valor": 1800.00,
            "rateios": [
                {"centro_custo_id": 1, "percentual": 100}
            ]
        }
        resp = requests.put(f"{BASE_URL}/api/transacoes/{despesa_id}", json=despesa_update, headers=headers, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Failed to update despesa: {resp.text}"
        updated_tx = resp.json()
        assert updated_tx.get("descricao") == despesa_update["descricao"]
        assert abs(float(updated_tx.get("valor", 0)) - despesa_update["valor"]) < 0.01

        # Batch liquidation: mark both transactions as liquidated/settled
        batch_liquidation_payload = {"ids": created_ids}
        resp = requests.post(f"{BASE_URL}/api/transacoes/baixarEmLote", json=batch_liquidation_payload, headers=headers, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Batch liquidation failed: {resp.text}"
        result = resp.json()
        assert "audit_log" in result or "message" in result

        # Verify transactions are marked as settled / baixado
        for tx_id in created_ids:
            resp = requests.get(f"{BASE_URL}/api/transacoes/{tx_id}", headers=headers, timeout=TIMEOUT)
            assert resp.status_code == 200, f"Failed to get transaction after liquidation {tx_id}: {resp.text}"
            tx = resp.json()
            # The settled flag might be named baixar, baixado, liquidado or status; we check typical keys
            settled_flags = ["baixado", "liquidado", "status", "baixar"]
            settled = any((tx.get(f) in (True, "baixado", "liquidado", "settled", "1") for f in settled_flags))
            assert settled, f"Transaction {tx_id} not marked as liquidated after batch operation"

        # Batch deletion of the transactions
        batch_delete_payload = {"ids": created_ids}
        resp = requests.post(f"{BASE_URL}/api/transacoes/deletarLote", json=batch_delete_payload, headers=headers, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Batch deletion failed: {resp.text}"
        delete_result = resp.json()
        assert "deleted_count" in delete_result or "message" in delete_result

        # Confirm deleted items no longer exist
        for tx_id in created_ids:
            resp = requests.get(f"{BASE_URL}/api/transacoes/{tx_id}", headers=headers, timeout=TIMEOUT)
            assert resp.status_code == 404, f"Deleted transaction {tx_id} still accessible: {resp.text}"

        # Cleanup already done by batch delete

    finally:
        # In case batch deletion fails, clean up individually
        for tx_id in created_ids:
            try:
                resp = requests.delete(f"{BASE_URL}/api/transacoes/{tx_id}", headers=headers, timeout=TIMEOUT)
                if resp.status_code not in (200, 404):
                    print(f"Warning: failed to cleanup transaction {tx_id}: {resp.status_code} {resp.text}")
            except Exception as e:
                print(f"Exception during cleanup of transaction {tx_id}: {e}")

test_financial_transactions_crud_and_batch_operations()
