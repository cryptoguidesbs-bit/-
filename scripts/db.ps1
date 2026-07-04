# Local dev PostgreSQL manager (embedded binaries, no admin rights needed).
# The postgres binaries and data dir live under ~\.cryptoguide because
# PostgreSQL cannot run from a path with non-ASCII characters (the project
# folder name is Korean).
#
# Usage: powershell -File scripts/db.ps1 [start|stop|status]

param([string]$Command = 'start')

$ErrorActionPreference = 'Stop'

$root = Join-Path $env:USERPROFILE '.cryptoguide'
$pg = Join-Path $root 'pg'
$data = Join-Path $root 'pgdata'
$log = Join-Path $root 'postgres.log'
$source = Join-Path $PSScriptRoot '..\node_modules\@embedded-postgres\windows-x64\native'

function Ensure-Binaries {
  if (-not (Test-Path (Join-Path $pg 'bin\pg_ctl.exe'))) {
    if (-not (Test-Path $source)) {
      throw "Embedded postgres not installed. Run: npm install"
    }
    Write-Output "Copying PostgreSQL binaries to $pg ..."
    New-Item -ItemType Directory -Force $root | Out-Null
    Copy-Item -Recurse -Force $source $pg
  }
}

function Ensure-Data {
  if (-not (Test-Path (Join-Path $data 'PG_VERSION'))) {
    Write-Output "Initializing data directory $data ..."
    & (Join-Path $pg 'bin\initdb.exe') -U postgres -A trust -E UTF8 --no-locale -D $data | Out-Null
  }
}

switch ($Command) {
  'start' {
    Ensure-Binaries
    Ensure-Data
    & (Join-Path $pg 'bin\pg_ctl.exe') -D $data -l $log -o '-p 5432' start
  }
  'stop' {
    & (Join-Path $pg 'bin\pg_ctl.exe') -D $data stop
  }
  'status' {
    & (Join-Path $pg 'bin\pg_ctl.exe') -D $data status
  }
  default {
    Write-Output "Unknown command: $Command (use start|stop|status)"
    exit 1
  }
}
