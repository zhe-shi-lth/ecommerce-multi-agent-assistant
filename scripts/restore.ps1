param(
    [Parameter(Mandatory = $true)][string]$BackupDir,
    [switch]$ConfirmRestore
)

$ErrorActionPreference = "Stop"
if (-not $ConfirmRestore) {
    throw "Restore overwrites the current database and application data. Add -ConfirmRestore to continue."
}

$repo = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$backup = [IO.Path]::GetFullPath($BackupDir)
$backupRoot = [IO.Path]::GetFullPath((Join-Path $repo "backups"))
$backupRootPrefix = $backupRoot.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
if (-not ($backup.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar).StartsWith(
        $backupRootPrefix, [StringComparison]::OrdinalIgnoreCase) -or
        -not (Test-Path $backup -PathType Container)) {
    throw "Backup directory must be a valid directory inside the project backups directory"
}

$sums = Join-Path $backup "SHA256SUMS"
if (-not (Test-Path $sums -PathType Leaf)) { throw "Backup is missing SHA256SUMS" }
foreach ($line in Get-Content $sums) {
    $hash, $name = $line -split '\s+', 2
    $file = Join-Path $backup $name.Trim()
    if ((Get-FileHash $file -Algorithm SHA256).Hash -ne $hash) {
        throw "Backup checksum failed: $name"
    }
}

$envMap = @{}
Get-Content (Join-Path $repo ".env") | Where-Object { $_ -match '^[^#=]+=' } | ForEach-Object {
    $key, $value = $_.Split('=', 2)
    $envMap[$key] = $value
}
$database = $envMap.POSTGRES_DB
if (-not $database) { $database = "ecommerce_agent" }
$user = $envMap.POSTGRES_USER
if (-not $user) { $user = "ecommerce" }

$dump = Join-Path $backup "postgres.dump"
if (Test-Path $dump) {
    docker cp $dump ecommerce-agent-postgres:/tmp/ecommerce-agent-restore.dump
    if ($LASTEXITCODE -ne 0) { throw "Unable to copy database backup into container" }
    try {
        docker exec ecommerce-agent-postgres pg_restore -U $user -d $database `
            --clean --if-exists --exit-on-error /tmp/ecommerce-agent-restore.dump
        if ($LASTEXITCODE -ne 0) { throw "Database restore failed" }
    } finally {
        docker exec ecommerce-agent-postgres rm -f /tmp/ecommerce-agent-restore.dump | Out-Null
    }
}

$data = [IO.Path]::GetFullPath((Join-Path $repo "data"))
$mediaArchive = Join-Path $backup "media.zip"
if (Test-Path $mediaArchive) {
    $mediaTarget = [IO.Path]::GetFullPath((Join-Path $data "media"))
    $dataPrefix = $data.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    if (-not ($mediaTarget.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar).StartsWith(
            $dataPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Media restore target is outside the project data directory"
    }
    if (Test-Path $mediaTarget) {
        Remove-Item -LiteralPath $mediaTarget -Recurse -Force
    }
    Expand-Archive -LiteralPath $mediaArchive -DestinationPath $data -Force
}

$settings = Join-Path $backup "settings.json"
if (Test-Path $settings) {
    Copy-Item -LiteralPath $settings -Destination (Join-Path $data "settings.json") -Force
}

Write-Output "Restore completed. Restart Java and Python, then run scripts/production_smoke.py."
