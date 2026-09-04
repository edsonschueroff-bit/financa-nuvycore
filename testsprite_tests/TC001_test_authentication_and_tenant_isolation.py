import requests
import time

BASE_URL = "http://localhost:3005"
LOGIN_ENDPOINT = "/api/auth/login"
PROFILE_ENDPOINT = "/api/profile"

HEADERS_JSON = {"Content-Type": "application/json"}
TIMEOUT = 30

# Valid tenant user credentials for testing (assumed known for the test)
VALID_TENANT_USER = {
    "username": "tenantuser@example.com",
    "password": "correctpassword"
}

# Invalid credentials for negative testing
INVALID_USER = {
    "username": "tenantuser@example.com",
    "password": "wrongpassword"
}


def test_authentication_and_tenant_isolation():
    session = requests.Session()
    try:
        # 1. Successful login with valid tenant user credentials
        resp_login = session.post(
            BASE_URL + LOGIN_ENDPOINT,
            headers=HEADERS_JSON,
            json=VALID_TENANT_USER,
            timeout=TIMEOUT,
        )
        assert resp_login.status_code == 200, f"Expected 200 but got {resp_login.status_code}"
        login_data = resp_login.json()
        assert "token" in login_data and isinstance(login_data["token"], str) and len(login_data["token"]) > 0, "JWT token missing in login response"
        assert "empresa_id" in login_data and login_data["empresa_id"], "empresa_id missing or empty in login response"

        jwt_token = login_data["token"]
        empresa_id = login_data["empresa_id"]

        # 2. Use JWT token to get user profile scoped to tenant context
        headers_auth = {
            "Authorization": f"Bearer {jwt_token}"
        }
        resp_profile = session.get(
            BASE_URL + PROFILE_ENDPOINT,
            headers=headers_auth,
            timeout=TIMEOUT,
        )
        assert resp_profile.status_code == 200, f"Expected 200 from profile but got {resp_profile.status_code}"
        profile_data = resp_profile.json()
        # Verify profile has empresa_id and it's the same as from login response
        assert "empresa_id" in profile_data and profile_data["empresa_id"] == empresa_id, "User profile empresa_id does not match login empresa_id"
        # Optionally verify minimal profile fields
        assert "username" in profile_data or "email" in profile_data, "Profile missing username/email field"

        # 3. Invalid login attempt returns 401
        resp_invalid_login = session.post(
            BASE_URL + LOGIN_ENDPOINT,
            headers=HEADERS_JSON,
            json=INVALID_USER,
            timeout=TIMEOUT,
        )
        assert resp_invalid_login.status_code == 401, f"Expected 401 for invalid login but got {resp_invalid_login.status_code}"

        # 4. Rate limiting enforcement after repeated failures
        max_attempts = 10
        last_status = None
        for attempt in range(max_attempts):
            r = session.post(
                BASE_URL + LOGIN_ENDPOINT,
                headers=HEADERS_JSON,
                json=INVALID_USER,
                timeout=TIMEOUT,
            )
            last_status = r.status_code
            if last_status == 429:
                # Rate limit enforced
                break
            # Small short delay to simulate rapid requests but allow processing
            time.sleep(0.2)
        else:
            # If loop completes without break, no 429 received
            assert False, "Rate limiting (HTTP 429) not enforced after repeated invalid logins"

        # After rate limiting, access to profile without valid JWT should be blocked
        # We'll try access profile without or with invalid token
        resp_profile_no_auth = session.get(BASE_URL + PROFILE_ENDPOINT, timeout=TIMEOUT)
        assert resp_profile_no_auth.status_code == 401, f"Expected 401 profile access without token but got {resp_profile_no_auth.status_code}"

        # Also try profile access with invalid token
        invalid_headers_auth = {"Authorization": "Bearer invalid.jwt.token"}
        resp_profile_invalid_token = session.get(
            BASE_URL + PROFILE_ENDPOINT, headers=invalid_headers_auth, timeout=TIMEOUT
        )
        assert resp_profile_invalid_token.status_code == 401, f"Expected 401 profile access with invalid token but got {resp_profile_invalid_token.status_code}"

    finally:
        session.close()


test_authentication_and_tenant_isolation()