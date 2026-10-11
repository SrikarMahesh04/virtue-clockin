$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskUv = Get-Command uv -ErrorAction SilentlyContinue
$taskUvPath = if ($taskUv) { $taskUv.Source } else { Join-Path $taskRoot '.tools\bin\uv.exe' }
if (-not (Test-Path -LiteralPath $taskUvPath)) { throw 'Install uv first, then follow README.md.' }
Push-Location (Join-Path $taskRoot 'backend')
try {
    $env:DISABLE_SQLALCHEMY_CEXT_RUNTIME = '1'
    $taskLanAddresses = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
        $_.AddressState -eq 'Preferred' -and ($_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' -or $_.IPAddress -match '^172\.(1[6-9]|2[0-9]|3[01])\.')
    } | Select-Object -ExpandProperty IPAddress -Unique
    $taskExtraOrigins = @($env:FRONTEND_ADDITIONAL_ORIGINS -split ',' | Where-Object { $_ })
    foreach ($taskAddress in $taskLanAddresses) {
        $taskExtraOrigins += "http://${taskAddress}:3000"
        Write-Host "Phone browser URL (same Wi-Fi): http://${taskAddress}:3000"
    }
    $env:FRONTEND_ADDITIONAL_ORIGINS = ($taskExtraOrigins | Select-Object -Unique) -join ','
    & $taskUvPath run uvicorn app.main:app --host 0.0.0.0 --port 8000
} finally { Pop-Location }
