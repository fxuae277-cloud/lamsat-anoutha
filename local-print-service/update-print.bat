@echo off
REM update-print.bat — one-click updater for the Lamsa local print service.
REM
REM What it does (no npm, no build):
REM   1. Pulls latest code from GitHub (compiled dist/ is shipped inside git
REM      starting from session 47 — see CONTEXT.md).
REM   2. Stops the running print-service node process.
REM   3. Starts the freshly-pulled service in a minimised background window.
REM
REM Task Scheduler config is NOT touched. After the next reboot, Task
REM Scheduler still respawns the service exactly as it does today.
REM
REM Usage: double-click this file. That is all.

title Lamsa Local Print - Update
color 0A
echo.
echo ============================================================
echo  Lamsa Local Print Service - One-click Update
echo ============================================================
echo.

cd /d C:\Users\HP\lamsat-anoutha
if errorlevel 1 (
  echo [ERROR] Repository folder not found: C:\Users\HP\lamsat-anoutha
  echo Please contact support.
  pause
  exit /b 1
)

echo [1/3] Pulling latest code from GitHub...
git pull --ff-only
if errorlevel 1 (
  echo.
  echo [ERROR] git pull failed. Local changes may conflict.
  echo Please contact support before retrying.
  pause
  exit /b 1
)
echo.

echo [2/3] Stopping running print service (if any)...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo.

echo [3/3] Starting print service in background...
start "Lamsa Local Print" /MIN cmd /c "node C:\Users\HP\lamsat-anoutha\local-print-service\dist\index.js"
timeout /t 2 /nobreak >nul
echo.

echo ============================================================
echo  Done. The new receipt design is active.
echo  You can close this window.
echo ============================================================
echo.
pause
