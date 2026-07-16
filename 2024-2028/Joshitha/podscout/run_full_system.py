
import subprocess
import time
import sys
import os
import signal

def run_system():
    # Paths
    backend_script = "start_backend.py"
    frontend_script = "frontend/streamlit_app.py"
    
    print("🚀 Starting PodScout Pro Full System...")
    print("---------------------------------------")
    
    processes = []
    
    try:
        # 1. Start Backend
        print("Starting Backend API (Port 8000)...")
        backend_process = subprocess.Popen(
            ["uv", "run", "python", backend_script],
            cwd=os.getcwd(),
            creationflags=subprocess.CREATE_NEW_CONSOLE if sys.platform == 'win32' else 0
        )
        processes.append(backend_process)
        time.sleep(2) # Give backend a moment
        
        # 2. Start Frontend
        print("Starting Streamlit Frontend (Port 8501)...")
        frontend_process = subprocess.Popen(
            ["uv", "run", "streamlit", "run", frontend_script, "--server.port", "8501"],
            cwd=os.getcwd(),
            creationflags=subprocess.CREATE_NEW_CONSOLE if sys.platform == 'win32' else 0
        )
        processes.append(frontend_process)
        
        print("---------------------------------------")
        print("✅ System Active!")
        print("  👉 Backend: http://localhost:8000")
        print("  👉 Frontend: http://localhost:8501")
        print("---------------------------------------")
        print("Press Ctrl+C to stop all services.")
        
        # Keep alive
        while True:
            time.sleep(1)
            
            # Check if processes are alive
            if backend_process.poll() is not None:
                print("⚠️ Backend stopped unexpectedly.")
                break
            if frontend_process.poll() is not None:
                print("⚠️ Frontend stopped unexpectedly.")
                break
                
    except KeyboardInterrupt:
        print("\n🛑 Stopping services...")
    finally:
        for p in processes:
            if p.poll() is None:
                p.terminate()
        print("Services stopped.")

if __name__ == "__main__":
    run_system()
