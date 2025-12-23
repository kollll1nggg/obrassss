@echo off
REM install-and-schedule-downloader.bat
REM Double-click this file (or run from an elevated cmd) to create a scheduled task
REM that runs the downloader every 1 minute as SYSTEM. It elevates via UAC.

SETLOCAL ENABLEEXTENSIONS

echo This will run the setup script with elevation to create the scheduled task 'ObrasDownload'.
echo You may be prompted by User Account Control (UAC). If prompted, accept to continue.

REM Resolve the script path relative to this batch file
SET "SCRIPT_PATH=%~dp0scripts\setup-automatic-download.ps1"

IF NOT EXIST "%SCRIPT_PATH%" (
    echo ERROR: Expected script not found: "%SCRIPT_PATH%"
    echo Make sure this .bat file is located in the project root next to the "scripts" folder.
    pause
    EXIT /B 2
)

REM Start an elevated PowerShell instance which runs the setup script with required args
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process PowerShell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_PATH%" -IntervalMinutes 1 -RunAsSystem' -Verb RunAs"

echo If you accepted UAC, the setup script ran (or will run) elevated and created the scheduled task.
echo Logs (if the task is created to redirect output) are typically at C:\Users\%USERNAME%\obras\logs\downloader.log or as configured in the script.
pause

ENDLOCAL
