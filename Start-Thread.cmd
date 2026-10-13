@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto missing
if not exist node_modules call npm.cmd ci
if errorlevel 1 goto failed
call npm.cmd start
goto :eof
:missing
echo Install Node.js 22 LTS or newer, then run this file again.
pause
goto :eof
:failed
echo Dependencies could not be installed. Check the error above and your connection.
pause
