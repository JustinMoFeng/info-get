@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo       Starting Info-Get Application
echo ==========================================

:: Get project root and remove trailing backslash if present
set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

:: Check for virtual environment
set "VENV_ACTIVATE="
if exist "%PROJECT_ROOT%\venv\Scripts\activate.bat" (
    set "VENV_ACTIVATE=call "%PROJECT_ROOT%\venv\Scripts\activate.bat""
) else if exist "%PROJECT_ROOT%\.venv\Scripts\activate.bat" (
    set "VENV_ACTIVATE=call "%PROJECT_ROOT%\.venv\Scripts\activate.bat""
)

:: Check if frontend node_modules exists
if not exist "%PROJECT_ROOT%\frontend\node_modules" (
    echo Frontend dependencies not found. Installing...
    cd /d "%PROJECT_ROOT%\frontend"
    call npm install
    cd /d "%PROJECT_ROOT%"
)

echo Starting Backend Server...
if defined VENV_ACTIVATE (
    echo Using virtual environment...
    start "Info-Get Backend" /D "%PROJECT_ROOT%" cmd /k "%VENV_ACTIVATE% && python -m uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000"
) else (
    echo No virtual environment found, using system python...
    start "Info-Get Backend" /D "%PROJECT_ROOT%" cmd /k "python -m uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000"
)

echo Starting Frontend Dev Server...
start "Info-Get Frontend" /D "%PROJECT_ROOT%\frontend" cmd /k "npm run dev"

echo ==========================================
echo Backend running on http://localhost:8000
echo Frontend running on http://localhost:5173
echo ==========================================
echo Press any key to close this launcher...
pause > nul
