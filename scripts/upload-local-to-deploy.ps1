param(
    [string]$BaseUrl = 'https://obrassss-production.up.railway.app',
    [string]$SourceDir = './dados',
    [int]$DelaySeconds = 1
)

Write-Host "BaseUrl: $BaseUrl"
Write-Host "SourceDir: $SourceDir"

$SourceDir = Resolve-Path -Path $SourceDir -ErrorAction SilentlyContinue | ForEach-Object { $_.Path }
if (-not $SourceDir) { Write-Error "SourceDir not found: $SourceDir"; exit 2 }

# Fetch remote media list to avoid duplicate uploads
try {
    $mediaList = Invoke-RestMethod -Uri "$($BaseUrl.TrimEnd('/'))/api/media/list" -Method Get -ErrorAction Stop
    $existingFileNames = @{}
    foreach ($m in $mediaList.media) { $existingFileNames[$m.filename] = $true }
} catch {
    Write-Warning "Failed to fetch remote media list: $_. Will attempt uploads but may create duplicates."
    $existingFileNames = @{}
}

$subdirs = @('photos','videos','others')
$allToUpload = @()
foreach ($s in $subdirs) {
    $d = Join-Path $SourceDir $s
    if (Test-Path $d) {
        $files = Get-ChildItem -Path $d -File -ErrorAction SilentlyContinue
        foreach ($f in $files) { $allToUpload += $f }
    }
}

if ($allToUpload.Count -eq 0) { Write-Host "No files found under $SourceDir to upload."; exit 0 }

$summary = @{ uploaded = 0; skipped = 0; failed = 0 }

foreach ($file in $allToUpload) {
    $name = $file.Name
    if ($existingFileNames.ContainsKey($name)) {
        Write-Host "Skipping existing on server: $name"
        $summary.skipped++
        continue
    }

    Write-Host "Uploading: $($file.FullName)"
    try {
        $form = @{ 'files' = Get-Item $file.FullName }
        $resp = Invoke-RestMethod -Uri "$($BaseUrl.TrimEnd('/'))/api/upload/media" -Method Post -Form $form -ErrorAction Stop
        Write-Host "-> Uploaded: $name"
        $summary.uploaded++
    } catch {
        Write-Warning "Failed to upload $name: $_"
        $summary.failed++
    }

    Start-Sleep -Seconds $DelaySeconds
}

Write-Host "Done. Uploaded: $($summary.uploaded), Skipped: $($summary.skipped), Failed: $($summary.failed)"
