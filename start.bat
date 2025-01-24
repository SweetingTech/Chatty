@echo off
start "ChromaDB Server" cmd /k "python start_chroma.py"
timeout /t 5
start "Vite Dev Server" cmd /k "npm run dev"
