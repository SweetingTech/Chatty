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

:: Start ChromaDB server in a new window
echo Starting ChromaDB server...
start cmd /k "python start_chroma.py"

:: Wait for ChromaDB to initialize
echo Waiting for ChromaDB to initialize...
timeout /t 2

:: Start the frontend
echo Starting frontend...
npm run dev
