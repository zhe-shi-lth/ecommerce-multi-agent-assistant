param([string]$OutputRoot = "backups")

$ErrorActionPreference = "Stop"
$repo = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$root = [IO.Path]::GetFullPath((Join-Path $repo $OutputRoot))
$repoPrefix = $repo.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
if (-not ($root.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar).StartsWith(
        $repoPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Backup directory must be inside the project directory"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path $root $stamp
New-Item -ItemType Directory -Path $target -Force | Out-Null

$envMap = @{}
$envFile = Join-Path $repo ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | Where-Object { $_ -match '^[^#=]+=' } | ForEach-Object {
        $key, $value = $_.Split('=', 2)
        $envMap[$key] = $value
    }
}
$database = $envMap.POSTGRES_DB
if (-not $database) { $database = "ecommerce_agent" }
$user = $envMap.POSTGRES_USER
if (-not $user) { $user = "ecommerce" }

$containerDump = "/tmp/ecommerce-agent-$stamp.dump"
try {
    docker exec ecommerce-agent-postgres pg_dump -U $user -d $database -Fc -f $containerDump
    if ($LASTEXITCODE -ne 0) { throw "pg_dump failed" }
    docker cp "ecommerce-agent-postgres:$containerDump" (Join-Path $target "postgres.dump")
    if ($LASTEXITCODE -ne 0) { throw "docker cp failed" }
} finally {
    docker exec ecommerce-agent-postgres rm -f $containerDump | Out-Null
}

$dataRoot = Join-Path $repo "data"
$mediaRoot = Join-Path $dataRoot "media"
if (Test-Path $mediaRoot) {
    Compress-Archive -Path $mediaRoot -DestinationPath (Join-Path $target "media.zip") -Force
}
$settings = Join-Path $dataRoot "settings.json"
if (Test-Path $settings) {
    Copy-Item -LiteralPath $settings -Destination (Join-Path $target "settings.json")
}

Get-ChildItem -File $target | Get-FileHash -Algorithm SHA256 | ForEach-Object {
    "$($_.Hash)  $([IO.Path]::GetFileName($_.Path))"
} | Set-Content -Encoding utf8 (Join-Path $target "SHA256SUMS")

Write-Output $target
