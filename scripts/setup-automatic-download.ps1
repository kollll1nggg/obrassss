<#
setup-automatic-download.ps1

Cria uma tarefa agendada do Windows (Task Scheduler) para rodar o
script download-uploads-from-deploy.ps1 periodicamente (padrão: a cada 5 minutos).

Uso:
  # criar/atualizar a tarefa com agendamento padrão (5 minutos)
  .\scripts\setup-automatic-download.ps1

Parâmetros:
  -TaskName: nome da tarefa no Task Scheduler (default: ObrasDownload)
  -IntervalMinutes: intervalo em minutos (default: 5)
  -BaseUrl: URL base do deploy (default: https://obrasltda-production.up.railway.app)
  -OutDir: diretório de saída local (default: .\dados)

Observações:
  - A tarefa é criada para o usuário atual e será executada apenas quando o usuário estiver logado.
  - Se você quiser que ela rode mesmo com usuário desconectado, é necessário fornecer credenciais (/RU com senha),
    o que não é recomendado automatizar sem precauções de segurança.
#>

param(
  [string]$TaskName = "ObrasDownload",
  [int]$IntervalMinutes = 1,
  # Default updated to the new Railway service (use public domain, no port)
  [string]$BaseUrl = 'https://obrassss-production.up.railway.app',
  [string]$OutDir = "C:\Users\$env:USERNAME\obras\dados",
  [switch]$RunAsSystem
)


# Resolve the downloader script path relative to this script file so the setup works
# even when the current working directory is different (e.g. C:\Windows\system32).
$scriptPath = Join-Path -Path $PSScriptRoot -ChildPath "download-uploads-from-deploy.ps1"
if (-not (Test-Path $scriptPath)) {
  # Fallback to previous relative location if not found at $PSScriptRoot
  $scriptPath = (Resolve-Path -Path "./scripts/download-uploads-from-deploy.ps1" -ErrorAction SilentlyContinue).Path
}
if (-not $scriptPath) {
  Write-Error "Downloader script not found. Expected at '$PSScriptRoot\\download-uploads-from-deploy.ps1' or './scripts/download-uploads-from-deploy.ps1'."
  exit 1
}
$scriptPath = (Resolve-Path -Path $scriptPath).Path

Write-Host "Setting up scheduled task '$TaskName' to run every $IntervalMinutes minutes."
Write-Host "Downloader script: $scriptPath"

# Build the action string (powershell invocation)
# Use double quotes for the -BaseUrl and -OutDir values so they survive being passed
# through schtasks and cmd.exe when paths/URLs contain spaces.
$action = "powershell -ExecutionPolicy Bypass -NoProfile -File `"$scriptPath`" -BaseUrl `"$BaseUrl`" -OutDir `"$OutDir`""

$runAsSystemFlag = $RunAsSystem.IsPresent

# Check if task exists
$exists = & schtasks /Query /TN $TaskName 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "Task '$TaskName' already exists. Deleting to recreate..."
  schtasks /Delete /TN $TaskName /F | Out-Null
}

Write-Host "Creating task..."

# Build create arguments; if RunAsSystem is requested, create task to run as SYSTEM (no password)
$createCmd = @('/Create','/SC','MINUTE','/MO',$IntervalMinutes.ToString(),'/TN',$TaskName,'/TR',$action,'/F')
if ($runAsSystemFlag) {
  # Use SYSTEM account so the task runs even when no user is logged on
  $createCmd += @('/RU','SYSTEM')
}

Write-Host "schtasks $($createCmd -join ' ')"
& schtasks @createCmd

if ($LASTEXITCODE -eq 0) {
  Write-Host "Task '$TaskName' created successfully."
  Write-Host "You can run it now with: schtasks /Run /TN $TaskName"
} else {
  Write-Error "Failed to create task. Exit code: $LASTEXITCODE"
}
