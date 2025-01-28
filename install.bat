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
echo Installation Options:
echo 1. Full Installation (Clean Install)
echo 2. Force Reinstall Everything
echo 3. Check Installation Status
echo.
echo Component Options:
echo 4. Frontend Only (npm packages)
echo 5. Python Environment Only
echo.
echo Database Options:
echo 6. Database Management
echo 7. Backup Current Data
echo 8. Restore from Backup
echo.
echo 9. Exit
echo.
set /p choice="Enter your choice (1-9): "

if "%choice%"=="1" goto full_install
if "%choice%"=="2" goto force_install
if "%choice%"=="3" goto check_status
if "%choice%"=="4" goto frontend_install
if "%choice%"=="5" goto python_install
if "%choice%"=="6" goto database_menu
if "%choice%"=="7" goto backup_data
if "%choice%"=="8" goto restore_data
if "%choice%"=="9" goto end
goto menu

:database_menu
cls
echo ===================================
echo Database Management
echo ===================================
echo.
echo 1. Reset ChromaDB Only
echo 2. Reset Weaviate Only
echo 3. Reset Both Databases
echo 4. Back to Main Menu
echo.
set /p db_choice="Enter your choice (1-4): "

if "%db_choice%"=="1" (
    call setup.bat --reset-chroma
    pause
    goto database_menu
)
if "%db_choice%"=="2" (
    call setup.bat --reset-weaviate
    pause
    goto database_menu
)
if "%db_choice%"=="3" (
    call setup.bat --reset
    pause
    goto database_menu
)
if "%db_choice%"=="4" goto menu
goto database_menu

:force_install
echo Starting force reinstall...
call setup.bat --force
pause
goto menu

:check_status
echo Checking installation status...
call setup.bat --check
pause
goto menu

:backup_data
echo Backing up current data...
call npm run backup-db
pause
goto menu

:restore_data
echo Restoring from backup...
call npm run restore-db
pause
goto menu

:check_prerequisites
echo Checking prerequisites...
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo Node.js is not installed. Please install Node.js 16 or higher.
    pause
    exit /b 1
)

where python >nul 2>&1
if %errorLevel% neq 0 (
    echo Python is not installed. Please install Python 3.8 or higher.
    pause
    exit /b 1
)

where npm >nul 2>&1
if %errorLevel% neq 0 (
    echo npm is not installed. Please install npm.
    pause
    exit /b 1
)

:: Check Python version
python -c "import sys; sys.exit(0 if sys.version_info >= (3,8) else 1)" >nul 2>&1
if %errorLevel% neq 0 (
    echo Python 3.8 or higher is required.
    pause
    exit /b 1
)

:: Check Node.js version
node -e "process.exit(process.version.localeCompare('v16.0.0') >= 0 ? 0 : 1)" >nul 2>&1
if %errorLevel% neq 0 (
    echo Node.js 16 or higher is required.
    pause
    exit /b 1
)
goto :eof

:setup_env
if not exist .env (
    echo Setting up environment variables...
    copy .env.example .env
    echo.
    echo Environment file created at .env
    echo IMPORTANT: Please update the following in your .env file:
    echo - CHROMA_API_KEY
    echo - WEAVIATE_API_KEY
    echo - OPENAI_API_KEY (if using OpenAI)
    echo - CLAUDE_API_KEY (if using Claude)
    echo - DEEPSEEK_API_KEY (if using Deepseek)
    echo.
    pause
)
goto :eof

:frontend_install
call :check_prerequisites
echo Installing frontend dependencies...
call npm install
if %errorLevel% neq 0 (
    echo Failed to install npm dependencies
    echo Try running with administrator privileges or check for errors above
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
) else (
    echo Found existing virtual environment
    choice /C YN /M "Do you want to recreate it"
    if !errorlevel!==1 (
        echo Recreating virtual environment...
        rmdir /s /q venv
        python -m venv venv
    )
)
call venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
if %errorLevel% neq 0 (
    echo Failed to install Python dependencies
    echo Check the error messages above
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

:: Start ChromaDB server if not running
echo Checking if ChromaDB server is running...
netstat -ano | findstr ":8001" > nul
if %errorlevel% neq 0 (
    echo Starting ChromaDB server...
    start cmd /k "python start_chroma.py"
    echo Waiting for ChromaDB to initialize...
    timeout /t 5
)

node scripts/init-chromadb.js
if %errorLevel% neq 0 (
    echo Failed to initialize ChromaDB
    echo Check if the server is running and try again
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
    echo Make sure Weaviate is running and accessible
    pause
    goto menu
)
echo Weaviate setup complete!
pause
goto menu

:full_install
cls
echo Starting full installation...
echo This will perform a clean installation of all components.
echo.
choice /C YN /M "Do you want to continue"
if !errorlevel!==2 goto menu

call :check_prerequisites
call :setup_env

echo.
echo Step 1/4: Installing frontend dependencies...
call :frontend_install

echo.
echo Step 2/4: Setting up Python environment...
call :python_install

echo.
echo Step 3/4: Setting up ChromaDB...
call :chromadb_install

echo.
echo Step 4/4: Setting up Weaviate...
call :weaviate_install

echo.
echo ===================================
echo Installation Complete!
echo ===================================
echo.
echo Next steps:
echo 1. Update the .env file with your API keys
echo 2. Run 'npm run dev' to start the application
echo.
pause
goto menu

:end
cls
echo ===================================
echo Installation process completed.
echo ===================================
echo.
echo To start the application:
echo 1. Make sure your .env file is configured
echo 2. Run 'npm run dev' to start the development server
echo.
echo For help or issues:
echo - Check the docs/ directory for documentation
echo - Run 'setup.bat --help' for command-line options
echo.
endlocal
exit /b 0
