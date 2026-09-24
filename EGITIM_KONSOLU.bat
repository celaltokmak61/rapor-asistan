@echo off
chcp 65001 > nul
cls
echo =======================================================
echo   RAPOR ASISTAN - YAPAY ZEKA EGITIM KONSOLU
echo =======================================================
echo.
cd /d "%~dp0backend"
python trainer_cli.py
pause
