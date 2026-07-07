"""E2E test for the four fixes: filesystem MCP, run delete, tool_mode, workspace dir."""
import json, urllib.request, urllib.error

BASE = "http://localhost:8000"


def call(m, p, b=None, t=None, timeout=180):
    d = json.dumps(b).encode() if b is not None else None
    r = urllib.request.Request(BASE + p, data=d, method=m)
    r.add_header("Content-Type", "application/json")
    if t:
        r.add_header("Authorization", "Bearer " + t)
    try:
        x = urllib.request.urlopen(r, timeout=timeout)
        raw = x.read().decode()
        return x.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        return e.code, json.loads(body) if body else None


def main():
    u = {"username": "fixtest", "email": "fixtest@example.com", "password": "testpass123"}
    call("POST", "/api/auth/register", u)
    code, res = call("POST", "/api/auth/login", {"email": u["email"], "password": u["password"]})
    assert code == 200, f"login {code} {res}"
    tok = res["access_token"]
    print("AUTH ok")

    # --- Fix #1: Filesystem MCP installs + syncs healthy (dir auto-created) ---
    code, srv = call("POST", "/api/mcp/install", {"source": "filesystem"}, t=tok)
    assert code == 201, f"install filesystem {code} {srv}"
    print(f"INSTALL filesystem -> args={srv['args']}")
    assert "/app/workspace" in srv["args"], srv
    fid = srv["id"]
    code, synced = call("POST", f"/api/mcp/servers/{fid}/sync", t=tok)
    assert code == 200, f"sync fs {code} {synced}"
    tools = synced.get("tools_cache") or []
    print(f"SYNC filesystem -> status={synced['status']} tools={len(tools)}")
    assert synced["status"] == "healthy", f"filesystem not healthy: {synced}"
    assert len(tools) >= 3, f"expected filesystem tools, got {tools}"
    call("DELETE", f"/api/mcp/servers/{fid}", t=tok)
    print("FIX#1 filesystem MCP works ✅")

    # --- Fix #3: delete single run + clear all runs ---
    # Create two runs via the run endpoint isn't trivial (SSE); instead test the
    # DELETE endpoints return success/no-content even with no runs, and 404 on bogus.
    code, _ = call("DELETE", "/api/agents/runs", t=tok)
    assert code == 204, f"clear runs {code}"
    code, _ = call("DELETE", "/api/agents/runs/00000000-0000-0000-0000-000000000000", t=tok)
    assert code == 404, f"delete bogus run should 404, got {code}"
    print("FIX#3 run delete endpoints present (clear=204, bogus=404) ✅")

    # --- Fix #4: tool_mode accepted by chat schema ---
    # We can't run a full LLM turn without keys, but a malformed-but-valid request
    # should pass schema validation (not 422). Use a non-existent conversation so it
    # fails later, but the schema with tool_mode must parse.
    code, res = call("POST", "/api/chat/stream",
                     {"message": "hi", "tool_mode": "auto"}, t=tok, timeout=20)
    # Streaming endpoint returns 200 and streams; or errors inside stream. Either way
    # NOT a 422 schema rejection.
    assert code != 422, f"tool_mode rejected by schema: {code} {res}"
    print(f"FIX#4 tool_mode accepted by chat schema (status={code}) ✅")

    print("\nALL FIX TESTS PASSED ✅")


if __name__ == "__main__":
    main()
