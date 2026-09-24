@echo off
setlocal
chcp 65001 > nul
cls
set "SCRIPT_DIR=%~dp0..\"
set "BACKEND_DIR=%SCRIPT_DIR%backend"
set "PYTHONPATH=%BACKEND_DIR%;%PYTHONPATH%"
cd /d "%BACKEND_DIR%"
start "" http://localhost:8000/
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --app-dir "%BACKEND_DIR%"
pause
