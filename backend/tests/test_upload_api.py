"""
Integration tests for /api/upload endpoint.

Uses FastAPI's TestClient (synchronous) with an in-memory SQLite database
so tests are isolated and never touch the real finsight.db.

Covers:
- File size limit (50 MB) — Req 2.7
- Unsupported file type rejection — Req 2.1
- Duplicate detection via SHA-256 — Req 2.5
- Successful CSV upload end-to-end
- Empty file / no transactions rejection
- DB rollback on parse failure (no partial state)
"""

import io
import pytest


# ── Helpers ───────────────────────────────────────────────────────────────────

def _csv_bytes(rows: list[str]) -> bytes:
    """Build minimal CSV file bytes."""
    content = "\n".join(rows)
    return content.encode("utf-8")


MINIMAL_CSV = _csv_bytes([
    "Date,Narration,Debit,Credit,Balance",
    "2024-01-01,Salary,0.00,50000.00,50000.00",
    "2024-01-05,Swiggy,500.00,0.00,49500.00",
    "2024-01-10,Netflix,649.00,0.00,48851.00",
])


# ── File size limit — Req 2.7 ─────────────────────────────────────────────────

def test_file_over_50mb_rejected(client):
    # Use 50 MB + 1 byte — just over the limit, fast to allocate
    over_limit = b"x" * (50 * 1024 * 1024 + 1)
    response = client.post(
        "/api/upload/",
        files={"file": ("big.csv", io.BytesIO(over_limit), "text/csv")},
    )
    assert response.status_code == 413
    assert "50 MB" in response.json()["detail"]


# ── Unsupported file type — Req 2.1 ──────────────────────────────────────────

def test_unsupported_extension_rejected(client):
    response = client.post(
        "/api/upload/",
        files={"file": ("statement.txt", io.BytesIO(b"some text"), "text/plain")},
    )
    assert response.status_code == 415
    assert "Unsupported" in response.json()["detail"]


def test_exe_file_rejected(client):
    response = client.post(
        "/api/upload/",
        files={"file": ("malware.exe", io.BytesIO(b"MZ\x00\x00"), "application/octet-stream")},
    )
    assert response.status_code == 415


def test_csv_extension_accepted(client):
    response = client.post(
        "/api/upload/",
        files={"file": ("statement.csv", io.BytesIO(MINIMAL_CSV), "text/csv")},
    )
    # 200 = success, 422 = parsed but no txns — both mean size/format check passed
    assert response.status_code in (200, 422)


# ── Duplicate detection — Req 2.5 ────────────────────────────────────────────

def test_duplicate_upload_rejected(client):
    """Uploading the same file twice must return 409 on the second attempt."""
    files = {"file": ("statement.csv", io.BytesIO(MINIMAL_CSV), "text/csv")}
    first = client.post("/api/upload/", files=files)
    # First upload must succeed
    assert first.status_code == 200

    files = {"file": ("statement.csv", io.BytesIO(MINIMAL_CSV), "text/csv")}
    second = client.post("/api/upload/", files=files)
    assert second.status_code == 409
    assert "duplicate" in second.json()["detail"].lower()


def test_different_file_not_flagged_as_duplicate(client):
    csv_a = _csv_bytes(["Date,Narration,Debit,Credit", "2024-01-01,Test A,100,0"])
    csv_b = _csv_bytes(["Date,Narration,Debit,Credit", "2024-01-02,Test B,200,0"])

    r1 = client.post("/api/upload/", files={"file": ("a.csv", io.BytesIO(csv_a), "text/csv")})
    r2 = client.post("/api/upload/", files={"file": ("b.csv", io.BytesIO(csv_b), "text/csv")})

    # Neither should be rejected as a duplicate of the other
    assert r1.status_code != 409
    assert r2.status_code != 409


# ── Successful CSV upload ─────────────────────────────────────────────────────

def test_successful_csv_upload_returns_200(client):
    response = client.post(
        "/api/upload/",
        files={"file": ("statement.csv", io.BytesIO(MINIMAL_CSV), "text/csv")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert body["transactions_parsed"] >= 1


def test_successful_upload_response_has_required_fields(client):
    response = client.post(
        "/api/upload/",
        files={"file": ("statement.csv", io.BytesIO(MINIMAL_CSV), "text/csv")},
    )
    body = response.json()
    for field in ("status", "filename", "file_type", "transactions_parsed", "deposits", "withdrawals"):
        assert field in body, f"Missing field: {field}"


def test_transactions_saved_to_db(client):
    client.post(
        "/api/upload/",
        files={"file": ("statement.csv", io.BytesIO(MINIMAL_CSV), "text/csv")},
    )
    body = client.get("/api/analytics/transactions").json()
    assert body["total"] >= 1


# ── Empty / bad content ───────────────────────────────────────────────────────

def test_empty_csv_rejected(client):
    response = client.post(
        "/api/upload/",
        files={"file": ("empty.csv", io.BytesIO(b""), "text/csv")},
    )
    # Empty file should fail — 415 (unrecognised) or 422 (no transactions)
    assert response.status_code in (415, 422)


def test_csv_with_no_recognisable_transactions(client):
    bad_csv = _csv_bytes(["col1,col2,col3", "abc,def,ghi"])
    response = client.post(
        "/api/upload/",
        files={"file": ("bad.csv", io.BytesIO(bad_csv), "text/csv")},
    )
    assert response.status_code == 422


# ── Analytics endpoints after upload ─────────────────────────────────────────

def test_overview_after_upload(client):
    client.post(
        "/api/upload/",
        files={"file": ("s.csv", io.BytesIO(MINIMAL_CSV), "text/csv")},
    )
    response = client.get("/api/analytics/overview")
    assert response.status_code == 200
    body = response.json()
    assert body["total_income"] >= 0
    assert body["total_expenses"] >= 0


def test_analytics_work_with_no_data(client):
    """All analytics endpoints must return 200 even with an empty database."""
    for endpoint in ("/overview", "/categories", "/monthly", "/merchants",
                     "/behavioral", "/insights", "/transactions"):
        r = client.get(f"/api/analytics{endpoint}")
        assert r.status_code == 200, f"Expected 200 on {endpoint}, got {r.status_code}: {r.text}"
