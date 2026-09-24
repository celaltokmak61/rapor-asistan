@echo off
setlocal
chcp 65001 > nul
cls

echo ===============================================================================
echo RAPOR ASISTAN
echo ===============================================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "BACKEND_DIR=%SCRIPT_DIR%backend"
set "PYTHONPATH=%BACKEND_DIR%;%PYTHONPATH%"

cd /d "%BACKEND_DIR%"

if exist "%SCRIPT_DIR%venv\Scripts\activate.bat" (
    call "%SCRIPT_DIR%venv\Scripts\activate.bat"
    set "PY_CMD=python"
    goto :run_app
)
if exist "%BACKEND_DIR%\venv\Scripts\activate.bat" (
    call "%BACKEND_DIR%\venv\Scripts\activate.bat"
    set "PY_CMD=python"
    goto :run_app
)

set "PY_CMD=python"
python -c "import uvicorn" >nul 2>&1
if %errorlevel% equ 0 (
    set "PY_CMD=python"
    goto :run_app
)
py -c "import uvicorn" >nul 2>&1
if %errorlevel% equ 0 (
    set "PY_CMD=py"
    goto :run_app
)
echo [HATA] Python / uvicorn bulunamadi. pip install -r backend\requirements.txt
pause
exit /b 1

:run_app
if not exist "%BACKEND_DIR%\.env" (
    if exist "%BACKEND_DIR%\.env.example" copy "%BACKEND_DIR%\.env.example" "%BACKEND_DIR%\.env" > nul
    echo [BILGI] backend\.env olusturuldu (demo SQLite).
)
%PY_CMD% "%BACKEND_DIR%\app\packs\demo\data\build_demo_db.py"

echo [1/2] Tarayici baslatiliyor...
start "" http://localhost:8000/

echo [2/2] FastAPI Sunucusu (Port 8000)
echo.
echo  Python:            %PY_CMD%
echo  Yerel:             http://localhost:8000
echo  Admin:             http://localhost:8000/admin
echo.
echo ===============================================================================

%PY_CMD% -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --app-dir "%BACKEND_DIR%"
pause
