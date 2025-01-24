@echo off
REM Activate virtual environment and start ChromaDB server
if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
    call venv\Scripts\activate
    echo Installing Python dependencies...
    pip install -r requirements.txt
) else (
    call venv\Scripts\activate
)

REM Start ChromaDB server in a new window
echo Starting ChromaDB server...
start cmd /k "python start_chroma.py"

REM Wait a moment for ChromaDB to start
timeout /t 2

REM Start the frontend
echo Starting frontend...
npm run start
