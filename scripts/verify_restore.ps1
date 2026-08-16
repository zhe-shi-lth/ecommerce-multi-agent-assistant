param([Parameter(Mandatory = $true)][string]$BackupDir)

$ErrorActionPreference = "Stop"
$repo = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$backup = [IO.Path]::GetFullPath($BackupDir)
$backupRoot = [IO.Path]::GetFullPath((Join-Path $repo "backups"))
$backupRootPrefix = $backupRoot.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
if (-not ($backup.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar).StartsWith(
        $backupRootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Backup directory must be inside the project backups directory"
}

$dump = Join-Path $backup "postgres.dump"
$sums = Join-Path $backup "SHA256SUMS"
if (-not (Test-Path $dump -PathType Leaf) -or -not (Test-Path $sums -PathType Leaf)) {
    throw "Backup is missing postgres.dump or SHA256SUMS"
}
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
$user = $envMap.POSTGRES_USER
if (-not $user) { $user = "ecommerce" }
$temporaryDatabase = "restore_verify_" + (Get-Date -Format "yyyyMMddHHmmss")
$containerDump = "/tmp/$temporaryDatabase.dump"

try {
    docker cp $dump "ecommerce-agent-postgres:$containerDump"
    if ($LASTEXITCODE -ne 0) { throw "Unable to copy backup into database container" }
    docker exec ecommerce-agent-postgres createdb -U $user $temporaryDatabase
    if ($LASTEXITCODE -ne 0) { throw "Unable to create isolated restore database" }
    docker exec ecommerce-agent-postgres pg_restore -U $user -d $temporaryDatabase --exit-on-error $containerDump
    if ($LASTEXITCODE -ne 0) { throw "Isolated pg_restore failed" }

    $result = docker exec ecommerce-agent-postgres psql -U $user -d $temporaryDatabase -tAc `
        "select count(*) from information_schema.tables where table_schema='public' and table_name in ('orders','purchase_orders','platform_tasks','daily_sales');"
    if ($LASTEXITCODE -ne 0 -or [int]$result.Trim() -ne 4) {
        throw "Restored database is missing critical business tables"
    }
    Write-Output "Isolated restore verified: $temporaryDatabase"
} finally {
    docker exec ecommerce-agent-postgres dropdb -U $user --if-exists $temporaryDatabase | Out-Null
    docker exec ecommerce-agent-postgres rm -f $containerDump | Out-Null
}
