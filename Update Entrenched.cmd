@echo off
setlocal
title Update Entrenched on GitHub
cd /d "%~dp0"

echo.
echo ========================================
echo   UPDATE ENTRENCHED ON GITHUB
echo ========================================
echo.

set "GIT_EXE="
where git >nul 2>nul && set "GIT_EXE=git"
if not defined GIT_EXE if exist "%ProgramFiles%\Git\cmd\git.exe" set "GIT_EXE=%ProgramFiles%\Git\cmd\git.exe"
if not defined GIT_EXE if exist "%LocalAppData%\Programs\Git\cmd\git.exe" set "GIT_EXE=%LocalAppData%\Programs\Git\cmd\git.exe"
if not defined GIT_EXE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe" set "GIT_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe"

if not defined GIT_EXE (
  echo Git could not be found. Install Git for Windows, then try again.
  goto :failed
)

if not exist ".git" (
  echo This folder is not connected to a Git repository.
  goto :failed
)

echo [1/4] Checking GitHub for changes...
"%GIT_EXE%" pull --rebase --autostash origin main
if errorlevel 1 goto :failed

echo.
echo [2/4] Refreshing the reader's document index...
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0refresh-content-index.ps1"
if errorlevel 1 goto :failed

echo.
echo [3/4] Preparing local changes...
"%GIT_EXE%" add -A
if errorlevel 1 goto :failed

"%GIT_EXE%" diff --cached --quiet
if not errorlevel 1 goto :no_changes

"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command "$message = 'Update Entrenched ' + (Get-Date -Format 'yyyy-MM-dd HH:mm'); ^& $env:GIT_EXE commit -m $message; exit $LASTEXITCODE"
if errorlevel 1 goto :failed

echo.
echo [4/4] Publishing to GitHub...
"%GIT_EXE%" push origin main
if errorlevel 1 goto :failed

echo.
echo Entrenched was updated successfully.
echo The public reader may take a minute to refresh.
goto :done

:no_changes
echo.
echo Nothing has changed. The GitHub repository is already current.
goto :done

:failed
echo.
echo The update did not finish. Read the message above for details.
echo Your local files have not been discarded.

:done
echo.
pause
endlocal
