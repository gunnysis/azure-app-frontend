@echo off
cd /d "%~dp0"
set PYTHON_RUNTIME=C:\Users\letgo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe
if exist "%PYTHON_RUNTIME%" (
  "%PYTHON_RUNTIME%" -m http.server 4202 --bind 127.0.0.1
) else (
  python -m http.server 4202 --bind 127.0.0.1
)
