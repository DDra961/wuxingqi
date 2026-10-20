@echo off
setlocal
pushd "%~dp0" || (echo [ERROR] cannot enter script folder & pause & exit /b 1)

netstat -ano | findstr /c:":8765" | findstr /c:"LISTENING" >nul
if not errorlevel 1 (
  echo Port 8765 is already in use, opening browser...
  start "" "http://127.0.0.1:8765/index.html"
  popd
  exit /b 0
)

set "PY="
py -3 -c "import sys" >nul 2>nul
if not errorlevel 1 set "PY=py -3"
if not defined PY (
  python -c "import sys" >nul 2>nul
  if not errorlevel 1 set "PY=python"
)
if not defined PY (
  echo.
  echo [ERROR] Python 3 not found.
  echo Install Python 3 and tick "Add python.exe to PATH", then run this again.
  echo.
  pause
  popd
  exit /b 1
)

echo Using: %PY%
echo Starting server on 8765...
if not exist "logs" mkdir "logs"
if exist "logs\server.log" del "logs\server.log"
start "board-server" /min cmd /c "%PY% app\server.py 8765 > logs\server.log 2>&1"

set /a tries=0
:wait
ping -n 2 127.0.0.1 >nul
netstat -ano | findstr /c:":8765" | findstr /c:"LISTENING" >nul
if not errorlevel 1 goto ready
set /a tries+=1
if %tries% lss 10 goto wait

echo.
echo [ERROR] Server did not start within 20 seconds.
echo ----------------------------------------------
if exist "logs\server.log" type "logs\server.log"
echo ----------------------------------------------
echo Check: python version, antivirus / firewall blocking python,
echo        or another program occupying port 8765.
echo.
pause
popd
exit /b 1

:ready
echo Server is up.
start "" "http://127.0.0.1:8765/index.html"
popd
exit /b 0