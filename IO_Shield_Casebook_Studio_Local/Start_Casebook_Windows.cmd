@echo off
setlocal
cd /d "%~dp0"
if exist "runtime\node.exe" (
  set "CASEBOOK_NODE=%~dp0runtime\node.exe"
) else (
  set "CASEBOOK_NODE=node"
  where node >nul 2>nul
  if errorlevel 1 (
    echo Node.js is required. Install Node.js 22.13 or newer from https://nodejs.org/en/download
    echo Or put a portable Node.js 22.13+ node.exe in the runtime folder.
    pause
    exit /b 1
  )
)
"%CASEBOOK_NODE%" -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||a===22&&b>=13?0:1)"
if errorlevel 1 (
  echo Please install Node.js 22.13 or newer, then run this launcher again.
  pause
  exit /b 1
)
"%CASEBOOK_NODE%" server.mjs --open
pause
