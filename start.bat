@echo off
setlocal enabledelayedexpansion

:: Check if components are installed
if not exist venv (
    echo Virtual environment not found. Please run install.bat first.
    pause
    exit /b 1
)

if not exist node_modules (
    echo Node modules not found. Please run install.bat first.
    pause
    exit /b 1
)

:: Activate virtual environment
call venv\Scripts\activate

:: Check if ChromaDB server is already running
echo Checking ChromaDB server...
netstat -ano | findstr ":8001" > nul
if %errorlevel% equ 0 (
    echo ChromaDB server already running
) else (
    echo Starting ChromaDB server...
    start cmd /k "python start_chroma.py"
    echo Waiting for ChromaDB to initialize...
    timeout /t 2
)

:: Start the frontend
echo Starting frontend...
npm run dev
