#!/bin/bash
set -e

echo "Running database migrations..."
alembic upgrade head

# Default workspace for the filesystem MCP server (its allowed root).
mkdir -p /app/workspace

echo "Starting server..."
# --reload-dir limits the watcher to app/ so MCP package caches, uploads and
# other runtime writes under /app never trigger a restart.
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir /app/app
