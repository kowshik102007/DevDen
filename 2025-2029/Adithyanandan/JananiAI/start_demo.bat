@echo off
echo ====================================================
echo    JananiAI (जननी AI) - Hackathon Demo Launcher
echo ====================================================
echo.

echo [1/2] Starting FastAPI Backend on port 8000...
start cmd /k "cd api && python main.py"

echo [2/2] Starting React Dashboard on port 3000...
start cmd /k "cd dashboard && npm run dev"

echo.
echo ====================================================
echo Both services are starting up!
echo 
echo - Dashboard will be available at: http://localhost:5173 (or as shown in the terminal)
echo - API will be available at: http://localhost:8000/docs
echo ====================================================
