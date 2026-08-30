@echo off
setlocal
title Entrenched Local Reader
cd /d "%~dp0"

set "CODEX_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if not exist "%CODEX_NODE%" (
  echo.
  echo The Entrenched local reader could not find the Codex runtime.
  echo Open Codex once, then try this launcher again.
  echo.
  pause
  exit /b 1
)

"%CODEX_NODE%" "%~dp0local-server.cjs"

if errorlevel 1 (
  echo.
  echo The Entrenched local reader stopped because of the error shown above.
  echo.
  pause
)
