$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')
$target = Join-Path $repoRoot "backups/$stamp"
New-Item -ItemType Directory -Path $target | Out-Null
docker compose exec -T postgres pg_dump -U estate -d estate -Fc -f /tmp/estate-backup.dump
if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed' }
docker compose cp postgres:/tmp/estate-backup.dump (Join-Path $target 'database.dump')
if ($LASTEXITCODE -ne 0) { throw 'Database copy failed' }
# Quiesce writes before running this script. No delete/retention or restore is automatic.
docker compose exec -T storage tar -czf /tmp/estate-objects.tar.gz -C /data .
if ($LASTEXITCODE -ne 0) { throw 'Storage backup failed' }
docker compose cp storage:/tmp/estate-objects.tar.gz (Join-Path $target 'objects.tar.gz')
if ($LASTEXITCODE -ne 0) { throw 'Storage copy failed' }
Get-ChildItem -LiteralPath $target -File | Get-FileHash -Algorithm SHA256 | Select-Object Hash,Path | Export-Csv -NoTypeInformation -Path (Join-Path $target 'checksums.csv')
Write-Output "Backup local created: $target. Verify by restoring into a separate environment."
