@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul
cls

echo ===============================================================================
echo RAPOR ASISTAN - ILK KURULUM
echo ===============================================================================
echo.

cd /d "%~dp0"

git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [HATA] Git kurulu degil: https://git-scm.com
    pause
    exit /b 1
)

if not exist ".git" (
    echo [1/3] Proje GitHub'dan indiriliyor...
    git clone https://github.com/celaltokmak61/RaporAsistan.git .
) else (
    echo [1/3] Mevcut klasor guncelleniyor...
    git pull --no-rebase origin main
)

if not exist "backend\.env" (
    if exist "backend\.env.example" copy "backend\.env.example" "backend\.env" > nul
)

set "PY_CMD=python"
python --version >nul 2>&1
if %errorlevel% neq 0 (
    py --version >nul 2>&1
    if %errorlevel% equ 0 set "PY_CMD=py"
)

echo [2/3] Python kutuphaneleri yukleniyor (%PY_CMD%)...
%PY_CMD% -m pip install -r backend\requirements.txt --quiet --disable-pip-version-check

echo [3/3] Tamam.
echo.
echo backend\.env dosyasina API anahtari ve MSSQL bilgilerinizi yazin.
echo Ardindan KOKPIT_BASLAT.bat calistirin.
echo.
pause
