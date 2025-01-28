@echo off
setlocal enabledelayedexpansion

set FORCE_INSTALL=0
set CHECK_ONLY=0
set RESET_DB=0
set RESET_CHROMA=0
set RESET_WEAVIATE=0

REM Parse command line arguments
if "%1"=="" (
    echo Chatty Setup Options:
    echo.
    echo Installation:
    echo   --force           Force reinstall everything including databases
    echo   --check          Check if everything is properly installed
    echo.
    echo Database Management:
    echo   --reset          Reset and reinitialize all databases
    echo   --reset-chroma   Reset and reinitialize ChromaDB only
    echo   --reset-weaviate Reset and reinitialize Weaviate only
    echo.
    echo For interactive installation, run install.bat instead
    exit /b 0
) else if "%1"=="--force" (
    set FORCE_INSTALL=1
    set RESET_DB=1
    echo Force installation mode enabled
) else if "%1"=="--check" (
    set CHECK_ONLY=1
    echo Check-only mode enabled
) else if "%1"=="--reset" (
    set RESET_DB=1
    echo Database reset mode enabled
) else if "%1"=="--reset-chroma" (
    set RESET_CHROMA=1
    echo ChromaDB reset mode enabled
) else if "%1"=="--reset-weaviate" (
    set RESET_WEAVIATE=1
    echo Weaviate reset mode enabled
) else if "%1"=="--help" (
    echo Chatty Setup Options:
    echo.
    echo Installation:
    echo   --force           Force reinstall everything including databases
    echo   --check          Check if everything is properly installed
    echo.
    echo Database Management:
    echo   --reset          Reset and reinitialize all databases
    echo   --reset-chroma   Reset and reinitialize ChromaDB only
    echo   --reset-weaviate Reset and reinitialize Weaviate only
    echo.
    echo For interactive installation, run install.bat instead
    exit /b 0
)

echo Starting Chatty setup...

REM Check prerequisites
echo Checking prerequisites...
where python >nul 2>&1
if %errorLevel% neq 0 (
    echo Python is not installed! Please install Python 3.8 or higher.
    echo Then run install.bat for a full installation with more options.
    pause
    exit /b 1
)

where node >nul 2>&1
if %errorLevel% neq 0 (
    echo Node.js is not installed! Please install Node.js 16 or higher.
    echo Then run install.bat for a full installation with more options.
    pause
    exit /b 1
)

REM Set up environment file if it doesn't exist
if not exist .env (
    echo Setting up environment file...
    copy .env.example .env
    echo Created .env file. Please update it with your configuration.
)

REM Create/activate Python virtual environment
if not exist "venv" (
    echo Creating Python virtual environment...
    python -m venv venv
) else (
    if %FORCE_INSTALL%==1 (
        echo Recreating Python virtual environment...
        rmdir /s /q venv
        python -m venv venv
    )
)

call venv\Scripts\activate

REM Check Python packages or install them
if %FORCE_INSTALL%==0 (
    echo Checking Python packages...
    python scripts/verify_setup.py
    if !errorlevel!==0 (
        if %CHECK_ONLY%==1 (
            echo Python packages are properly installed
            exit /b 0
        )
        echo Python packages are already installed, skipping...
    ) else (
        echo Installing Python requirements...
        python -m pip install --upgrade pip
        pip install -r requirements.txt
    )
) else (
    echo Force installing Python requirements...
    python -m pip install --upgrade pip
    pip install -r requirements.txt --force-reinstall
)

REM Check Node.js dependencies or install them
if %FORCE_INSTALL%==0 (
    if exist "node_modules" (
        echo Verifying Node.js dependencies...
        call npm list --json > nul 2>&1
        if !errorlevel!==0 (
            if %CHECK_ONLY%==1 (
                echo Node.js dependencies are properly installed
                exit /b 0
            )
            echo Node.js dependencies are already installed, skipping...
        ) else (
            echo Installing Node.js dependencies...
            call npm install
        )
    ) else (
        echo Installing Node.js dependencies...
        call npm install
    )
) else (
    echo Force installing Node.js dependencies...
    if exist "node_modules" rmdir /s /q node_modules
    call npm install --force
)

REM Initialize or reset databases as needed
if %CHECK_ONLY%==0 (
    if %RESET_DB%==1 (
        echo Resetting and initializing all databases...
        python scripts/reset-chromadb.py
        if errorlevel 1 (
            echo Failed to reset ChromaDB.
            pause
            exit /b 1
        )
    )

    echo Initializing system...
    node scripts/initialize-system.js
    if errorlevel 1 (
        echo System initialization failed.
        echo Please check if ChromaDB server is running and try again.
        echo You can also try running with --reset to reset all databases.
        pause
        exit /b 1
    )

    if %RESET_WEAVIATE%==1 (
        echo Resetting and initializing Weaviate...
        node scripts/init-weaviate.js
        if errorlevel 1 (
            echo Failed to initialize Weaviate.
            pause
            exit /b 1
        )
    )
)

if %CHECK_ONLY%==1 (
    echo All components are properly installed
    exit /b 0
)

echo.
echo Setup completed successfully!
echo.
echo Next steps:
echo 1. Update the .env file with your configuration if you haven't already
echo 2. Run 'npm run dev' to start the application
echo.
echo Note:
echo - For more detailed installation options, run install.bat
echo - To force reinstall everything, run setup.bat --force
echo - To reset databases only, run setup.bat --reset
echo - To only check installation status, run setup.bat --check
echo - For help, run setup.bat --help
pause
