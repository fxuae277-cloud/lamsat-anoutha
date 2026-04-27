@echo off
REM install-startup-shortcut.bat — register the local print service to
REM auto-start (silently) on every Windows logon.
REM
REM What it does:
REM   1. Creates a .lnk inside the user's Startup folder pointing at
REM      start-print-service-hidden.vbs.
REM   2. Sets the shortcut to "Run: Minimized" so even the brief
REM      wscript host icon does not appear in the taskbar.
REM
REM After running this once, the cashier never has to think about the
REM print service again — it comes up hidden every time Windows boots.

setlocal

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS=%~dp0start-print-service-hidden.vbs"
set "LNK=%STARTUP%\Lamsa Local Print.lnk"

if not exist "%VBS%" (
  echo [ERROR] start-print-service-hidden.vbs not found next to this script.
  echo Expected at: %VBS%
  pause
  exit /b 1
)

echo Creating Startup shortcut...
echo   Target:   %VBS%
echo   Location: %LNK%
echo.

REM Use PowerShell to create the .lnk — no third-party tool required.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut('%LNK%');" ^
  "$s.TargetPath = 'wscript.exe';" ^
  "$s.Arguments = '\"%VBS%\"';" ^
  "$s.WorkingDirectory = '%~dp0';" ^
  "$s.WindowStyle = 7;" ^
  "$s.Description = 'Lamsa Local Print Service (silent)';" ^
  "$s.Save()"

if errorlevel 1 (
  echo.
  echo [ERROR] Failed to create the Startup shortcut.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo  Done. The print service will start silently on next logon.
echo  To start it NOW without rebooting, double-click:
echo    start-print-service-hidden.vbs
echo ============================================================
echo.
pause
