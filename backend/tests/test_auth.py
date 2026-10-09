from fastapi.testclient import TestClient

from tests.conftest import DEMO_LOGIN


def test_login_sets_http_only_session_cookie(anon_client: TestClient) -> None:
    response = anon_client.post("/api/auth/login", json=DEMO_LOGIN)

    assert response.status_code == 200
    assert response.json()["username"] == "demo"
    cookie_header = response.headers["set-cookie"]
    assert "r53_session=" in cookie_header
    assert "HttpOnly" in cookie_header
    assert "SameSite=lax" in cookie_header

    me = anon_client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["account_id"] == "123456789012"


def test_account_id_may_include_dashes(anon_client: TestClient) -> None:
    response = anon_client.post("/api/auth/login", json={**DEMO_LOGIN, "account_id": "1234-5678-9012"})
    assert response.status_code == 200


def test_wrong_password_is_rejected(anon_client: TestClient) -> None:
    response = anon_client.post("/api/auth/login", json={**DEMO_LOGIN, "password": "wrong"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"
    assert "set-cookie" not in response.headers


def test_missing_fields_return_validation_error(anon_client: TestClient) -> None:
    response = anon_client.post("/api/auth/login", json={"username": "demo"})

    assert response.status_code == 422
    fields = {detail["field"] for detail in response.json()["error"]["details"]}
    assert {"account_id", "password"} <= fields


def test_protected_endpoints_require_a_session(anon_client: TestClient) -> None:
    for method, path in [
        ("get", "/api/auth/me"),
        ("get", "/api/hosted-zones"),
        ("post", "/api/hosted-zones"),
        ("get", "/api/hosted-zones/Z123/records"),
        ("delete", "/api/hosted-zones/Z123"),
    ]:
        response = getattr(anon_client, method)(path)
        assert response.status_code == 401, path
        assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_logout_invalidates_the_session(client: TestClient) -> None:
    token = client.cookies.get("r53_session")
    assert client.get("/api/auth/me").status_code == 200

    response = client.post("/api/auth/logout")
    assert response.status_code == 204
    assert client.get("/api/auth/me").status_code == 401

    client.cookies.set("r53_session", token)
    assert client.get("/api/auth/me").status_code == 401


def test_forged_session_token_is_rejected(anon_client: TestClient) -> None:
    anon_client.cookies.set("r53_session", "not-a-real-token")
    assert anon_client.get("/api/hosted-zones").status_code == 401
