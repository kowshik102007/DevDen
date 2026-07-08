"""
MCP catalog + installer.

Lets users install MCP servers the way they would in Claude / Claude Code:
  - one click from a curated catalog of popular servers, or
  - by pasting a GitHub repo URL, an npm package name, a PyPI package, or a raw
    command line straight out of a README.

We resolve any of those into a concrete stdio launch spec:
    { command, args, env_required }
and create an MCPServer row. Nothing is executed until the user (or sync) runs it.
"""
import os
import re
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.mcp_server import MCPServer
from app.services.mcp_service import create_server


# --------------------------------------------------------------------------- #
# Curated catalog                                                             #
# --------------------------------------------------------------------------- #
# `env_required` lists secrets the server needs; the UI prompts for them and we
# store them in MCPServer.env. `args` may contain "{{PLACEHOLDER}}" tokens that
# are filled from user-provided config at install time.

CATALOG = [
    {
        "id": "github",
        "name": "GitHub",
        "description": "Manage repos, issues, PRs, code search and files on GitHub.",
        "category": "Dev",
        "transport": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env_required": [
            {"key": "GITHUB_PERSONAL_ACCESS_TOKEN", "label": "GitHub Personal Access Token", "help": "Create at github.com/settings/tokens"},
        ],
        "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/github",
    },
    {
        "id": "filesystem",
        "name": "Filesystem",
        "description": "Read, write and search files within an allowed directory.",
        "category": "Dev",
        "transport": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "{{ROOT_PATH}}"],
        "config_required": [
            {"key": "ROOT_PATH", "label": "Allowed directory", "default": "/app/workspace", "help": "Directory the server may access (created automatically if missing)", "ensure_dir": True},
        ],
        "env_required": [],
        "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem",
    },
    {
        "id": "playwright",
        "name": "Playwright Browser",
        "description": "Full browser automation via Microsoft Playwright — navigate pages, click, fill forms, take screenshots, and extract content from JavaScript-rendered sites.",
        "category": "Web",
        "transport": "stdio",
        "command": "npx",
        "args": ["-y", "@playwright/mcp@latest", "--browser", "chromium"],
        "env_required": [],
        "homepage": "https://github.com/microsoft/playwright-mcp",
    },
    {
        "id": "terminal",
        "name": "Terminal",
        "description": "Run shell commands inside the server environment. Use to install missing dependencies (e.g. browser binaries), run scripts, or inspect the system.",
        "category": "Dev",
        "transport": "stdio",
        "command": "python",
        "args": ["/app/mcp_servers/terminal_server.py"],
        "env_required": [],
        "homepage": None,
    },
    {
        "id": "memory",
        "name": "Knowledge Graph Memory",
        "description": "A persistent knowledge-graph memory the agent can read and write.",
        "category": "Memory",
        "transport": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-memory"],
        "env_required": [],
        "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/memory",
    },
    {
        "id": "sequential-thinking",
        "name": "Sequential Thinking",
        "description": "A structured step-by-step reasoning scratchpad tool.",
        "category": "Reasoning",
        "transport": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
        "env_required": [],
        "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking",
    },
    {
        "id": "time",
        "name": "Time & Timezones",
        "description": "Current time and timezone conversion utilities.",
        "category": "Utility",
        "transport": "stdio",
        "command": "uvx",
        "args": ["mcp-server-time"],
        "env_required": [],
        "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/time",
    },
    {
        "id": "git",
        "name": "Git",
        "description": "Inspect and operate on a local Git repository.",
        "category": "Dev",
        "transport": "stdio",
        "command": "uvx",
        "args": ["mcp-server-git", "--repository", "{{REPO_PATH}}"],
        "config_required": [
            {"key": "REPO_PATH", "label": "Repository path", "default": "/app", "help": "Local git repo to operate on"},
        ],
        "env_required": [],
        "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/git",
    },
    {
        "id": "everything",
        "name": "Everything (demo)",
        "description": "Reference server exercising every MCP feature — great for testing.",
        "category": "Utility",
        "transport": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-everything"],
        "env_required": [],
        "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/everything",
    },
]

CATALOG_BY_ID = {c["id"]: c for c in CATALOG}


def get_catalog() -> list[dict]:
    """Public catalog (without internal launch details the UI doesn't need to show)."""
    out = []
    for c in CATALOG:
        out.append({
            "id": c["id"],
            "name": c["name"],
            "description": c["description"],
            "category": c["category"],
            "command": c["command"],
            "args": c["args"],
            "env_required": c.get("env_required", []),
            "config_required": c.get("config_required", []),
            "homepage": c.get("homepage"),
        })
    return out


# --------------------------------------------------------------------------- #
# Resolver: turn a pasted source into a launch spec                            #
# --------------------------------------------------------------------------- #

_GITHUB_RE = re.compile(r"github\.com[:/]+([\w.-]+)/([\w.-]+?)(?:\.git)?(?:/.*)?$", re.I)
_NPM_PKG_RE = re.compile(r"^(@[\w.-]+/)?[\w.-]+$")


def _spec_from_npm(pkg: str) -> dict:
    return {"command": "npx", "args": ["-y", pkg], "transport": "stdio"}


def _spec_from_pypi(pkg: str) -> dict:
    return {"command": "uvx", "args": [pkg], "transport": "stdio"}


def _slug_to_name(slug: str) -> str:
    slug = slug.replace("server-", "").replace("mcp-", "").replace("-mcp", "")
    return slug.replace("-", " ").replace("_", " ").strip().title() or "MCP Server"


def resolve_source(source: str) -> dict:
    """Resolve a pasted source string into a launch spec dict:
       { name, command, args, transport, note }

    Accepts:
      * catalog id (e.g. "github")
      * npm package ("@modelcontextprotocol/server-github")
      * GitHub URL ("https://github.com/owner/repo")
      * PyPI package hint ("pypi:mcp-server-fetch" or "mcp-server-...")
      * raw command ("npx -y some-server --flag" / "uvx some.pkg")
    """
    source = (source or "").strip()
    if not source:
        raise HTTPException(status_code=400, detail="Provide a catalog id, package, GitHub URL, or command.")

    # 1. Catalog id
    if source in CATALOG_BY_ID:
        c = CATALOG_BY_ID[source]
        return {
            "name": c["name"],
            "command": c["command"],
            "args": list(c["args"]),
            "transport": c["transport"],
            "env_required": c.get("env_required", []),
            "config_required": c.get("config_required", []),
            "note": f"Installed from catalog: {c['name']}",
        }

    # 2. Raw command (starts with a known launcher)
    parts = source.split()
    if parts and parts[0] in ("npx", "uvx", "node", "python", "python3", "uv", "deno", "bunx"):
        return {
            "name": _slug_to_name(parts[-1].split("/")[-1]),
            "command": parts[0],
            "args": parts[1:],
            "transport": "stdio",
            "note": "Installed from raw command.",
        }

    # 3. Explicit pypi: / npm: prefixes
    if source.lower().startswith("pypi:"):
        pkg = source[5:].strip()
        return {**_spec_from_pypi(pkg), "name": _slug_to_name(pkg), "note": f"Installed from PyPI: {pkg}"}
    if source.lower().startswith("npm:"):
        pkg = source[4:].strip()
        return {**_spec_from_npm(pkg), "name": _slug_to_name(pkg.split("/")[-1]), "note": f"Installed from npm: {pkg}"}

    # 4. GitHub URL
    m = _GITHUB_RE.search(source)
    if m:
        owner, repo = m.group(1), m.group(2)
        # Heuristic: most published MCP servers are on npm under @owner/repo or the repo name.
        # Prefer npx with the repo name; users can edit args if the package id differs.
        # Many official servers live in modelcontextprotocol/servers — map those specially.
        if owner.lower() == "modelcontextprotocol" and repo.lower() == "servers":
            # Can't tell which sub-server; tell the user to pick from catalog.
            raise HTTPException(
                status_code=400,
                detail="That's the servers monorepo. Pick a specific server from the catalog, or paste its npm package name (e.g. @modelcontextprotocol/server-github).",
            )
        guessed_pkg = repo if repo.startswith("@") else repo
        return {
            "command": "npx",
            "args": ["-y", f"github:{owner}/{repo}"],
            "transport": "stdio",
            "name": _slug_to_name(repo),
            "note": f"Installed from GitHub: {owner}/{repo}. If it's a Python server, edit the command to 'uvx'.",
        }

    # 5. Bare npm/pypi package name
    if _NPM_PKG_RE.match(source):
        # PyPI-style first: mcp-server-* and mcp_* are conventionally Python servers.
        if source.startswith("mcp-server") or source.startswith("mcp_") or source.endswith("-mcp-server"):
            return {**_spec_from_pypi(source), "name": _slug_to_name(source), "note": f"Installed from PyPI: {source}"}
        # npm-style: scoped packages, server-* and *-mcp names.
        if source.startswith("@") or "server-" in source or source.endswith("-mcp"):
            return {**_spec_from_npm(source), "name": _slug_to_name(source.split("/")[-1]), "note": f"Installed from npm: {source}"}
        # default to npm
        return {**_spec_from_npm(source), "name": _slug_to_name(source), "note": f"Installed from npm: {source}"}

    raise HTTPException(
        status_code=400,
        detail="Couldn't recognise that. Paste a GitHub URL, an npm/PyPI package, a catalog id, or a full command.",
    )


def install_server(
    db: Session,
    user_id: UUID,
    source: str,
    name: str | None = None,
    env: dict | None = None,
    config: dict | None = None,
    auto_approve: bool = True,
) -> MCPServer:
    """Resolve `source` and create an MCPServer for the user. `config` fills
    {{PLACEHOLDER}} tokens in args; `env` supplies secrets."""
    spec = resolve_source(source)

    # Fill {{PLACEHOLDER}} tokens in args from config (with catalog defaults).
    config = dict(config or {})
    for field in spec.get("config_required", []):
        key = field["key"]
        if key not in config and field.get("default") is not None:
            config[key] = field["default"]

    # Create any directory-typed config paths so servers like filesystem don't
    # crash on a missing root directory at first launch.
    for field in spec.get("config_required", []):
        if field.get("ensure_dir") and config.get(field["key"]):
            path = str(config[field["key"]])
            if path.startswith("/") and ".." not in path:
                try:
                    os.makedirs(path, exist_ok=True)
                except OSError:
                    pass

    def _fill(token: str) -> str:
        def repl(m):
            k = m.group(1)
            return str(config.get(k, m.group(0)))
        return re.sub(r"\{\{(\w+)\}\}", repl, token)

    args = [_fill(a) for a in spec["args"]]

    # Validate required env is present.
    env = dict(env or {})
    missing = [f["key"] for f in spec.get("env_required", []) if not env.get(f["key"])]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"This server needs: {', '.join(missing)}. Provide them and try again.",
        )

    return create_server(db, user_id, {
        "name": name or spec.get("name") or "MCP Server",
        "transport": spec.get("transport", "stdio"),
        "command": spec["command"],
        "args": args,
        "env": env,
        "enabled": True,
        "auto_approve": auto_approve,
    })
