@echo off
setlocal enabledelayedexpansion

:: Initialize the system
echo Initializing system...
node scripts/initialize-system.js
if errorlevel 1 (
    echo System initialization failed.
    echo Running full setup...
    call setup.bat
    if errorlevel 1 (
        echo Setup failed. Please check the error messages above.
        pause
        exit /b 1
    )
)

:: Activate virtual environment
call venv\Scripts\activate

:: Check ChromaDB port
echo Checking ChromaDB port...
netstat -ano | findstr ":8001" > nul
if %errorlevel% equ 0 (
    echo Port 8001 is in use. Attempting to kill process...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8001"') do (
        taskkill /F /PID %%a
    )
    timeout /t 2
)

:: Start everything in one window
echo Starting services...
npx concurrently -k "python start_chroma.py" "wait-on tcp:8001 && vite"
