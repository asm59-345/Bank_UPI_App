@echo off
title PayFlow — Starting Servers

echo ╔══════════════════════════════════════════╗
echo ║       PayFlow UPI Banking System         ║
echo ╚══════════════════════════════════════════╝
echo.

:: ─── Check if frontend node_modules exists ───
IF NOT EXIST "d:\java\Bank_UPI_app\Bank_UPI_App\frontend\node_modules" (
    echo [1/3] Installing frontend dependencies...
    cd /d "d:\java\Bank_UPI_app\Bank_UPI_App\frontend"
    call npm install
    echo     Done.
    echo.
) ELSE (
    echo [1/3] Frontend dependencies already installed. Skipping.
    echo.
)

:: ─── Start Backend in new window ───
echo [2/3] Starting Backend on http://localhost:3000 ...
start "PayFlow Backend" cmd /k "cd /d d:\java\Bank_UPI_app\Bank_UPI_App && npm run dev:upi"
timeout /t 4 /nobreak >nul

:: ─── Start Frontend in new window ───
echo [3/4] Starting Frontend on http://localhost:3001 ...
start "PayFlow Frontend" cmd /k "cd /d d:\java\Bank_UPI_app\Bank_UPI_App\frontend && npm run dev"
timeout /t 6 /nobreak >nul

:: ─── Start Fraud Service in new window ───
echo [4/4] Starting AI Fraud Service on http://localhost:8000 ...
start "PayFlow Fraud Service" cmd /k "cd /d d:\java\Bank_UPI_app\Bank_UPI_App\fraud_service && uvicorn main:app --port 8000 --reload"
timeout /t 4 /nobreak >nul

:: ─── Open browser ───
echo.
echo Opening browser at http://localhost:3001 ...
start "" "http://localhost:3001"

echo.
echo ✓ All servers launched in separate windows.
echo   Backend:        http://localhost:3000
echo   Frontend:       http://localhost:3001
echo   Fraud Service:  http://localhost:8000
echo.
pause
