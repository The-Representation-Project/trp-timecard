@echo off
REM Serve Timecard over http://localhost so the app can load (file:// is blank).
cd /d "%~dp0"
set PORT=8765
set URL=http://127.0.0.1:%PORT%/Timecard.html

where python >nul 2>&1
if %ERRORLEVEL%==0 (
  set PY=python
) else (
  where py >nul 2>&1
  if %ERRORLEVEL%==0 (
    set PY=py
  ) else (
    echo Python is required. Install from https://www.python.org then try again.
    pause
    exit /b 1
  )
)

echo.
echo   TRP Timecard - local server
echo   Open:  %URL%
echo   Stop:  Ctrl+C in this window
echo.

start "" "%URL%"
%PY% -m http.server %PORT%
pause
