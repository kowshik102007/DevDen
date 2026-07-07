#!/usr/bin/env python3
import socket

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]; s.close(); return ip
    except: return "127.0.0.1"

if __name__ == "__main__":
    ip = get_local_ip()
    print(f"""
╔══════════════════════════════════════════════════╗
║         NeuralFix — AI Tech Support              ║
╠══════════════════════════════════════════════════╣
║  Local IP  : {ip:<35}║
║  API URL   : http://{ip}:8001          ║
║  Docs      : http://{ip}:8001/docs     ║
║  Health    : http://{ip}:8001/health   ║
╠══════════════════════════════════════════════════╣
║  👉 Set in mobile/src/utils/config.js:           ║
║  API_BASE_URL = 'http://{ip}:8001'     ║
╚══════════════════════════════════════════════════╝
""")
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True, log_level="info")
