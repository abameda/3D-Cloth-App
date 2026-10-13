@echo off
rem Thread Studio for Windows: 3D fitting room and asset factory. Keep this window open while you use it.
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\thread-studio.ps1" %*
if errorlevel 1 pause
