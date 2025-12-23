param(
    # Updated default BaseUrl to the new Railway service
    [string]$BaseUrl = "https://obrassss-production.up.railway.app",
    [string]$OutDir = "./dados"
)

# Download all media files referenced by the remote /api/media/list into a local ./dados folder
# - Images -> dados/photos
# - Videos -> dados/videos
# - Others -> dados/others

Write-Host "BaseUrl: $BaseUrl"
Write-Host "OutDir: $OutDir"

$OutDir = Resolve-Path -Path $OutDir -ErrorAction SilentlyContinue | ForEach-Object { $_.Path }
if (-not $OutDir) { New-Item -ItemType Directory -Path (Join-Path (Get-Location) 'dados') -Force | Out-Null; $OutDir = (Resolve-Path './dados').Path }

$api = "$($BaseUrl.TrimEnd('/'))/api/media/list"
Write-Host "Fetching media list from: $api"

try {
    $resp = Invoke-RestMethod -Uri $api -Method Get -ErrorAction Stop
} catch {
    Write-Error "Failed to fetch media list: $_"
    exit 2
}

if (-not $resp.media) { Write-Host "No media items found."; exit 0 }

foreach ($m in $resp.media) {
    $rawUrl = $m.url
    if ($rawUrl -match '^(http|https)://') { $fileUrl = $rawUrl } else { $fileUrl = "$($BaseUrl.TrimEnd('/'))$rawUrl" }

    switch ($m.type) {
        'video' { $sub = 'videos' }
        'image' { $sub = 'photos' }
        default { $sub = 'others' }
    }

    $dir = Join-Path $OutDir $sub
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

    $fileName = [System.Uri]::UnescapeDataString((Split-Path $fileUrl -Leaf))
    $dest = Join-Path $dir $fileName
    if (Test-Path $dest) { Write-Host "Skipping existing: $dest"; continue }

    Write-Host "Downloading: $fileUrl -> $dest"
    try {
        Invoke-WebRequest -Uri $fileUrl -OutFile $dest -UseBasicParsing -ErrorAction Stop
    } catch {
        Write-Warning "Failed to download $fileUrl : $_"
    }
}

Write-Host "Done. Files saved under: $OutDir"

# --- Also fetch metadata JSONs (albums, events, users, media.json) and save locally ---
try {
    $metaDir = $OutDir
    if (-not (Test-Path $metaDir)) { New-Item -ItemType Directory -Path $metaDir -Force | Out-Null }

    $endpoints = @{
        'albums' = "$($BaseUrl.TrimEnd('/'))/api/albums"
        'events' = "$($BaseUrl.TrimEnd('/'))/api/events"
        'users'  = "$($BaseUrl.TrimEnd('/'))/api/users"
        'media'  = "$($BaseUrl.TrimEnd('/'))/api/media/list"
    }

    foreach ($k in $endpoints.Keys) {
        $u = $endpoints[$k]
        Write-Host "Fetching metadata $k from: $u"
        try {
            $r = Invoke-RestMethod -Uri $u -Method Get -ErrorAction Stop
            $outPath = Join-Path $metaDir "$k.json"
            # Normalize structure: if the endpoint returns { albums: [...] } write that array, else write the object
            if ($r.$k) { $payload = $r.$k } else { $payload = $r }
            $json = $payload | ConvertTo-Json -Depth 10
            Set-Content -Path $outPath -Value $json -Encoding UTF8
            Write-Host "Saved $k metadata -> $outPath"
        } catch {
            # Use explicit formatting to avoid PowerShell variable-parsing errors like `$k:` inside strings
            Write-Warning ("Failed to fetch/save {0}: {1}" -f $k, $_)
        }
    }
} catch {
    Write-Warning ("Failed to sync metadata: {0}" -f $_)
}
