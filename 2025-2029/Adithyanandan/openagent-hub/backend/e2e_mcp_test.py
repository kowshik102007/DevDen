"""E2E smoke test for the MCP install + chat-tools features.
Run inside the backend container: exercises catalog, resolve, install, sync.
"""
import json, os, sys, urllib.request, urllib.error

BASE = "http://localhost:8000"


def call(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            raw = r.read().decode()
            return r.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "null")


def main():
    # 1. Auth: register or login a throwaway user
    u = {"username": "mcptest", "email": "mcptest@example.com", "password": "testpass123"}
    code, _ = call("POST", "/api/auth/register", u)
    code, res = call("POST", "/api/auth/login",
                     {"email": u["email"], "password": u["password"]})
    assert code == 200, f"login failed {code} {res}"
    token = res["access_token"]
    print("AUTH ok")

    # 2. Catalog
    code, cat = call("GET", "/api/mcp/catalog", token=token)
    assert code == 200 and isinstance(cat, list) and len(cat) >= 6, f"catalog {code}"
    ids = {c["id"] for c in cat}
    print(f"CATALOG ok ({len(cat)} servers): {sorted(ids)}")
    assert "github" in ids and "fetch" in ids and "time" in ids

    # 3. Resolve a GitHub URL
    code, spec = call("POST", "/api/mcp/resolve",
                      {"source": "https://github.com/owner/some-mcp"}, token=token)
    assert code == 200, f"resolve github {code} {spec}"
    assert spec["command"] == "npx", spec
    print(f"RESOLVE github -> {spec['command']} {spec['args']}")

    # 4. Resolve a PyPI-style name
    code, spec = call("POST", "/api/mcp/resolve",
                      {"source": "mcp-server-fetch"}, token=token)
    assert code == 200 and spec["command"] == "uvx", f"resolve pypi {code} {spec}"
    print(f"RESOLVE mcp-server-fetch -> {spec['command']} {spec['args']}")

    # 5. GitHub catalog install WITHOUT token must be rejected
    code, res = call("POST", "/api/mcp/install", {"source": "github"}, token=token)
    assert code == 400 and "GITHUB" in json.dumps(res), f"github guard {code} {res}"
    print(f"ENV-GUARD ok: {res['detail'][:60]}")

    # 6. Install the 'time' server (uvx, no secrets) and verify sync
    code, srv = call("POST", "/api/mcp/install", {"source": "time"}, token=token)
    assert code == 201, f"install time {code} {srv}"
    print(f"INSTALL time -> id={srv['id']} status={srv['status']}")
    sid = srv["id"]

    code, synced = call("POST", f"/api/mcp/servers/{sid}/sync", token=token)
    assert code == 200, f"sync {code} {synced}"
    tools = synced.get("tools_cache") or []
    print(f"SYNC time -> status={synced['status']} tools={[t['name'] for t in tools]}")
    assert synced["status"] == "healthy", f"expected healthy: {synced}"
    assert len(tools) >= 1

    # 7. Backend still alive after uvx run (the reload-restart bug)
    code, _ = call("GET", "/api/mcp/catalog", token=token)
    assert code == 200, "backend died after sync!"
    print("BACKEND alive after uvx sync ✓")

    # cleanup
    call("DELETE", f"/api/mcp/servers/{sid}", token=token)
    print("\nALL TESTS PASSED ✅")


if __name__ == "__main__":
    main()
