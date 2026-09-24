@echo off
chcp 65001 > nul
title Rapor Asistan Egitim Konsolu
cd /d "%~dp0\..\backend"
set "PY_CMD=python"
py --version >nul 2>&1
if %errorlevel% equ 0 set "PY_CMD=py"
%PY_CMD% trainer_cli.py
pause
