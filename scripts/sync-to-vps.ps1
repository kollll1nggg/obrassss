<#
  sync-to-vps.ps1
  Script de sincronização usando rclone (Windows PowerShell).

  Uso (dry-run):
    .\sync-to-vps.ps1 -VPSHost "1.2.3.4" -VPSUser "ubuntu" -DryRun

  Depois de testar com -DryRun, rode sem -DryRun para efetivar.

  Atenção: substitua os valores de VPSHost/VPSUser ou passe como parâmetros.
#>

param(
  [Parameter(Mandatory=$false)] [string] $VPSHost = "VPS_HOST_HERE",
  [Parameter(Mandatory=$false)] [string] $VPSUser = "VPS_USER_HERE",
  [Parameter(Mandatory=$false)] [string] $LocalDir = "C:\Users\mateu\obras\dados",
  [Parameter(Mandatory=$false)] [string] $RemoteDir = "/var/lib/obras/dados",
  [Parameter(Mandatory=$false)] [string] $RclonePath = "C:\Program Files\rclone\rclone.exe",
  [Parameter(Mandatory=$false)] [string] $KeyFile = "$env:USERPROFILE\.ssh\id_ed25519",
  [switch] $DryRun
)

if (-not (Test-Path $RclonePath)) {
  Write-Error "rclone não encontrado em $RclonePath. Instale rclone e atualize a variável.`nBaixar: https://rclone.org/downloads/"
  exit 1
}

if ($VPSHost -eq 'VPS_HOST_HERE' -or $VPSUser -eq 'VPS_USER_HERE') {
  Write-Warning "Você deixou VPSHost/VPSUser padrão. Passe -VPSHost e -VPSUser ou edite o script antes de rodar."
}

$remote = "vps_sftp:$RemoteDir"

Write-Output "LocalDir: $LocalDir"
Write-Output "Remote: $remote"
Write-Output "Rclone: $RclonePath"
Write-Output "SSH key: $KeyFile"

# Ensure local dir exists
if (-not (Test-Path $LocalDir)) {
  Write-Error "LocalDir não existe: $LocalDir"
  exit 1
}

# Compose rclone args
$common = @("--progress","--verbose","--log-file=C:\Users\$env:USERNAME\obras-rclone.log","--log-level=INFO")

if ($DryRun) {
  $args = @("sync", $LocalDir, $remote, "--dry-run") + $common
  Write-Output "Executando dry-run de sincronização (não fará alterações)."
} else {
  $args = @("sync", $LocalDir, $remote) + $common
  Write-Output "Executando sincronização REAL (irá copiar alterações)."
}

Write-Output "Executando: $RclonePath $($args -join ' ')"
& $RclonePath @args

if ($LASTEXITCODE -ne 0) {
  Write-Error "rclone retornou código $LASTEXITCODE. Verifique o log em C:\Users\$env:USERNAME\obras-rclone.log"
  exit $LASTEXITCODE
}

Write-Output "Sincronização concluída. Verifique o log: C:\Users\$env:USERNAME\obras-rclone.log"
