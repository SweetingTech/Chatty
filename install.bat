@echo off
setlocal enabledelayedexpansion

:: Check for admin privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Please run this script as Administrator
    pause
    exit /b 1
)

:menu
cls
echo ===================================
echo Chatty Installation Menu
echo ===================================
echo.
echo 1. Full Installation (All Components)
echo 2. Frontend Only (npm packages)
echo 3. Python Environment Only
echo 4. ChromaDB Setup Only
echo 5. Weaviate Setup Only
echo 6. Exit
echo.
set /p choice="Enter your choice (1-6): "

if "%choice%"=="1" goto full_install
if "%choice%"=="2" goto frontend_install
if "%choice%"=="3" goto python_install
if "%choice%"=="4" goto chromadb_install
if "%choice%"=="5" goto weaviate_install
if "%choice%"=="6" goto end
goto menu

:check_prerequisites
echo Checking prerequisites...
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo Node.js is not installed. Please install Node.js and try again.
    pause
    exit /b 1
)

where python >nul 2>&1
if %errorLevel% neq 0 (
    echo Python is not installed. Please install Python and try again.
    pause
    exit /b 1
)

where npm >nul 2>&1
if %errorLevel% neq 0 (
    echo npm is not installed. Please install npm and try again.
    pause
    exit /b 1
)
goto :eof

:setup_env
if not exist .env (
    echo Setting up environment variables...
    copy .env.example .env
    echo Environment file created. Please update .env with your configuration.
)
goto :eof

:frontend_install
call :check_prerequisites
echo Installing frontend dependencies...
call npm install
if %errorLevel% neq 0 (
    echo Failed to install npm dependencies
    pause
    goto menu
)
echo Frontend installation complete!
pause
goto menu

:python_install
call :check_prerequisites
echo Setting up Python virtual environment...
if not exist venv (
    python -m venv venv
)
call venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
if %errorLevel% neq 0 (
    echo Failed to install Python dependencies
    pause
    goto menu
)
echo Python environment setup complete!
pause
goto menu

:chromadb_install
call :check_prerequisites
echo Setting up ChromaDB...
call venv\Scripts\activate
node scripts/init-chromadb.js
if %errorLevel% neq 0 (
    echo Failed to initialize ChromaDB
    pause
    goto menu
)
echo ChromaDB setup complete!
pause
goto menu

:weaviate_install
call :check_prerequisites
echo Setting up Weaviate...
node scripts/init-weaviate.js
if %errorLevel% neq 0 (
    echo Failed to initialize Weaviate
    pause
    goto menu
)
echo Weaviate setup complete!
pause
goto menu

:full_install
echo Starting full installation...
call :check_prerequisites
call :setup_env

echo Installing frontend dependencies...
call :frontend_install

echo Setting up Python environment...
call :python_install

echo Setting up ChromaDB...
call :chromadb_install

echo Setting up Weaviate...
call :weaviate_install

echo.
echo Full installation complete!
echo Please update the .env file with your configuration if you haven't already.
pause
goto menu

:end
echo Installation process completed.
endlocal
exit /b 0
