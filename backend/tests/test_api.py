from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_metrics():
    res = client.get("/api/v1/metrics")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["pack"] in ("demo", "generic")


def test_bootstrap():
    res = client.get("/api/v1/setup/bootstrap")
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["pack_id"] in ("demo", "generic")
    assert any(m["id"] == "ai_studio" for m in body["modules"])


def test_login_ok():
    res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    assert res.status_code == 200
    assert res.json()["user"]["role"] == "admin"


def test_login_bad():
    res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "wrong"})
    assert res.status_code == 401


def test_chat_golden_sql():
    res = client.post(
        "/api/v1/chat",
        json={"message": "low stock items", "session_id": "test_session"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["action_type"] == "sql_query"
    assert body["total_rows"] >= 1
    assert "product" in {c.lower() for row in body["data"][:1] for c in row.keys()} or body["data"]


def test_setup_tables():
    res = client.get("/api/v1/setup/tables")
    assert res.status_code == 200
    body = res.json()
    assert body["count"] >= 6
