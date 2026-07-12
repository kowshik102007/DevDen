#!/usr/bin/env python3
"""
NetFixAI Backend — Startup Script
Run this on your server machine: python run.py
"""
import socket
import os
import sys

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

if __name__ == "__main__":
    ip = get_local_ip()
    port = 8000

    print()
    print("=" * 60)
    print("   NetFixAI Backend Server")
    print("=" * 60)
    print(f"   Local IP     : {ip}")
    print(f"   Port         : {port}")
    print(f"   API URL      : http://{ip}:{port}")
    print(f"   Docs/Swagger : http://{ip}:{port}/docs")
    print(f"   Health check : http://{ip}:{port}/health")
    print()
    print("   👉 Set this in your mobile app's config:")
    print(f"      API_BASE_URL = 'http://{ip}:{port}'")
    print("=" * 60)
    print()

    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info",
    )
