@echo off
setlocal
title Update Entrenched on GitHub
cd /d "%~dp0"

echo.
echo ========================================
echo   UPDATE ENTRENCHED ON GITHUB
echo ========================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo Git could not be found. Install Git for Windows, then try again.
  goto :failed
)

if not exist ".git" (
  echo This folder is not connected to a Git repository.
  goto :failed
)

echo [1/4] Checking GitHub for changes...
git pull --rebase --autostash origin main
if errorlevel 1 goto :failed

echo.
echo [2/4] Refreshing the reader's document index...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0refresh-content-index.ps1"
if errorlevel 1 goto :failed

echo.
echo [3/4] Preparing local changes...
git add -A
if errorlevel 1 goto :failed

git diff --cached --quiet
if not errorlevel 1 goto :no_changes

powershell.exe -NoProfile -Command "$message = 'Update Entrenched ' + (Get-Date -Format 'yyyy-MM-dd HH:mm'); git commit -m $message; exit $LASTEXITCODE"
if errorlevel 1 goto :failed

echo.
echo [4/4] Publishing to GitHub...
git push origin main
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
