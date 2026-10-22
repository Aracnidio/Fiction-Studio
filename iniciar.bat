@echo off
cd /d "%~dp0"
where py >nul 2>nul && (py -3 servidor.py & goto :eof)
where python >nul 2>nul && (python servidor.py & goto :eof)
echo Python 3 nao encontrado. Instale em https://www.python.org/downloads/ (marque "Add python.exe to PATH").
pause
