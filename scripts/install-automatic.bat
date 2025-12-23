@echo off
REM Instalador simples para criar a tarefa agendada que roda o downloader automaticamente.
REM Execute este arquivo com um duplo-clique para configurar (uma vez).

powershell -ExecutionPolicy Bypass -NoProfile -Command "Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -NoProfile -File "%~dp0setup-automatic-download.ps1"' -Verb runAs"
echo Instalacao iniciada. A janela do PowerShell pode pedir confirmacao para executar como Administrador.
pause
