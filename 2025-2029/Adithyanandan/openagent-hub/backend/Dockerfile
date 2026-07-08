FROM python:3.11-slim

WORKDIR /app

# System deps:
#  - gcc: build native python wheels
#  - git: clone MCP servers from GitHub
#  - curl/ca-certificates: fetch Node + uv installers
#  - nodejs/npm (via NodeSource): run npm-based MCP servers with npx
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc git curl ca-certificates gnupg \
        # Chromium dependencies for Playwright MCP
        libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
        libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
        libpango-1.0-0 libcairo2 libx11-xcb1 libxcb-dri3-0 \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*


# uv / uvx: run Python-based MCP servers without a venv juggling step
RUN curl -LsSf https://astral.sh/uv/install.sh | sh \
    && cp /root/.local/bin/uv /usr/local/bin/uv \
    && cp /root/.local/bin/uvx /usr/local/bin/uvx

# Caches/tools live OUTSIDE /app: the backend bind-mounts ./backend to /app and
# runs uvicorn --reload, so any npx/uvx writes under /app would restart the server
# mid-request. Keeping them in /opt isolates them from the file watcher.
ENV UV_TOOL_DIR=/opt/mcp/uv-tools \
    UV_CACHE_DIR=/opt/mcp/uv-cache \
    NPM_CONFIG_CACHE=/opt/mcp/npm-cache \
    XDG_CACHE_HOME=/opt/mcp/cache \
    XDG_DATA_HOME=/opt/mcp/data \
    PATH="/usr/local/bin:${PATH}"

RUN mkdir -p /opt/mcp/uv-tools /opt/mcp/uv-cache /opt/mcp/npm-cache /opt/mcp/cache /opt/mcp/data

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x /app/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
