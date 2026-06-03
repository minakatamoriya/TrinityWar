[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string]$BackupPath,
  [string]$EnvFilePath,
  [string]$BackupDirectory,
  [switch]$SkipSafetySnapshot
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($EnvFilePath)) {
  $EnvFilePath = Join-Path $repoRoot 'services\game-server\.env'
}

if ([string]::IsNullOrWhiteSpace($BackupDirectory)) {
  $BackupDirectory = Join-Path $repoRoot 'backups'
}

function Read-DotEnvValue {
  param(
    [string]$FilePath,
    [string]$Name
  )

  if (-not (Test-Path $FilePath)) {
    throw "Env file not found: $FilePath"
  }

  foreach ($line in Get-Content -Path $FilePath) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) {
      continue
    }

    $separatorIndex = $line.IndexOf('=')
    if ($separatorIndex -lt 0) {
      continue
    }

    $key = $line.Substring(0, $separatorIndex).Trim()
    if ($key -ne $Name) {
      continue
    }

    return $line.Substring($separatorIndex + 1).Trim()
  }

  throw "Missing $Name in $FilePath"
}

function Parse-DatabaseUrl {
  param([string]$DatabaseUrl)

  $uri = [System.Uri]$DatabaseUrl
  $userInfo = $uri.UserInfo.Split(':', 2)
  $username = [System.Uri]::UnescapeDataString($userInfo[0])
  $password = if ($userInfo.Count -gt 1) { [System.Uri]::UnescapeDataString($userInfo[1]) } else { '' }
  $database = $uri.AbsolutePath.Trim('/').Trim()

  if ([string]::IsNullOrWhiteSpace($database)) {
    throw "Database name is missing in DATABASE_URL: $DatabaseUrl"
  }

  return @{
    Host = $uri.Host
    Port = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
    Username = $username
    Password = $password
    Database = $database
  }
}

function Find-PostgresTool {
  param([string]$ToolName)

  $command = Get-Command "$ToolName.exe" -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $searchRoots = @(
    'C:\Program Files\PostgreSQL',
    'C:\Program Files (x86)\PostgreSQL',
    'C:\PostgreSQL'
  )

  foreach ($root in $searchRoots) {
    if (-not (Test-Path $root)) {
      continue
    }

    $candidate = Get-ChildItem -Path $root -Directory -ErrorAction SilentlyContinue |
      Sort-Object Name -Descending |
      ForEach-Object { Join-Path $_.FullName "bin\$ToolName.exe" } |
      Where-Object { Test-Path $_ } |
      Select-Object -First 1

    if ($candidate) {
      return $candidate
    }
  }

  throw "$ToolName.exe not found in PATH or standard PostgreSQL install locations."
}

function Resolve-BackupFile {
  param(
    [string]$RequestedBackupPath,
    [string]$ResolvedBackupDirectory
  )

  if (-not [string]::IsNullOrWhiteSpace($RequestedBackupPath)) {
    if ([System.IO.Path]::IsPathRooted($RequestedBackupPath)) {
      return $RequestedBackupPath
    }

    return Join-Path $repoRoot $RequestedBackupPath
  }

  if (-not (Test-Path $ResolvedBackupDirectory)) {
    throw "Backup directory not found: $ResolvedBackupDirectory"
  }

  $latestBackup = Get-ChildItem -Path $ResolvedBackupDirectory -Filter 'trinitywar-*.backup' -File |
    Where-Object { $_.Name -notlike 'pre-restore-*' } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if (-not $latestBackup) {
    throw "No restore backup found in $ResolvedBackupDirectory"
  }

  return $latestBackup.FullName
}

$databaseUrl = Read-DotEnvValue -FilePath $EnvFilePath -Name 'DATABASE_URL'
$connection = Parse-DatabaseUrl -DatabaseUrl $databaseUrl
$pgDumpPath = Find-PostgresTool -ToolName 'pg_dump'
$pgRestorePath = Find-PostgresTool -ToolName 'pg_restore'
$resolvedBackupPath = Resolve-BackupFile -RequestedBackupPath $BackupPath -ResolvedBackupDirectory $BackupDirectory

if (-not (Test-Path $resolvedBackupPath)) {
  throw "Backup file not found: $resolvedBackupPath"
}

$resolvedBackupDirectory = if ([System.IO.Path]::IsPathRooted($BackupDirectory)) {
  $BackupDirectory
} else {
  Join-Path $repoRoot $BackupDirectory
}

if (-not (Test-Path $resolvedBackupDirectory)) {
  New-Item -ItemType Directory -Path $resolvedBackupDirectory | Out-Null
}

$snapshotPath = Join-Path $resolvedBackupDirectory ("pre-restore-{0}.backup" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))

Write-Host "Env file: $EnvFilePath"
Write-Host "Restore backup: $resolvedBackupPath"
Write-Host "Database: $($connection.Username)@$($connection.Host):$($connection.Port)/$($connection.Database)"
Write-Host "pg_dump: $pgDumpPath"
Write-Host "pg_restore: $pgRestorePath"

$env:PGPASSWORD = $connection.Password

try {
  if (-not $SkipSafetySnapshot) {
    $snapshotTarget = "$($connection.Database) <= $snapshotPath"
    if ($PSCmdlet.ShouldProcess($snapshotTarget, 'Create pre-restore safety snapshot')) {
      & $pgDumpPath --format=custom --no-owner --no-privileges --verbose --host=$connection.Host --port=$connection.Port --username=$connection.Username --dbname=$connection.Database --file=$snapshotPath
      if ($LASTEXITCODE -ne 0) {
        throw "pg_dump failed with exit code $LASTEXITCODE"
      }
      Write-Host "Safety snapshot created: $snapshotPath"
    }
  }

  $restoreTarget = "$($connection.Database) <= $resolvedBackupPath"
  if ($PSCmdlet.ShouldProcess($restoreTarget, 'Restore PostgreSQL backup')) {
    & $pgRestorePath --clean --if-exists --no-owner --no-privileges --exit-on-error --verbose --host=$connection.Host --port=$connection.Port --username=$connection.Username --dbname=$connection.Database $resolvedBackupPath
    if ($LASTEXITCODE -ne 0) {
      throw "pg_restore failed with exit code $LASTEXITCODE"
    }
    Write-Host "Restore completed: $resolvedBackupPath"
  }
}
finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}