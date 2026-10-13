<#
.SYNOPSIS
  Thread Studio for Windows: starts the local engine (asset factory + phone API) and opens the studio.

.DESCRIPTION
  First run creates .env.local-reconstruction with a private engine token (loopback only), builds the
  server and starts it in this window. If the engine is already running, it just opens the studio.
  The token reaches the browser in the address fragment, which never leaves this computer, and the
  page removes it from the address bar immediately.

.PARAMETER EnvFile   Engine settings file (default: .env.local-reconstruction in the project root).
.PARAMETER NoBrowser Start the engine without opening a browser window.
#>
param([string]$EnvFile = '', [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if (-not $EnvFile) { $EnvFile = Join-Path $root '.env.local-reconstruction' }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22 LTS or newer, then run Thread-Studio again.' }
if (-not (Test-Path (Join-Path $root 'node_modules'))) { & npm.cmd ci; if ($LASTEXITCODE) { throw 'npm ci failed. Check the error above.' } }

if (-not (Test-Path $EnvFile)) {
  $bytes = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $token = -join ($bytes | ForEach-Object { $_.ToString('x2') })
  @("THREAD_RECONSTRUCTION_TOKEN=$token", 'THREAD_RECONSTRUCTION_PORT=8790', 'THREAD_RECONSTRUCTION_HOST=127.0.0.1') | Set-Content $EnvFile -Encoding ascii
  Write-Host "Created $EnvFile with a new private engine token."
}
$settings = @{}
foreach ($line in Get-Content $EnvFile) { if ($line -match '^\s*([A-Z_]+)\s*=\s*(.*)$') { $settings[$Matches[1]] = $Matches[2].Trim() } }
$token = $settings['THREAD_RECONSTRUCTION_TOKEN']
if (-not $token -or $token.Length -lt 32) { throw "$EnvFile needs THREAD_RECONSTRUCTION_TOKEN (at least 32 characters)." }
$port = if ($settings['THREAD_RECONSTRUCTION_PORT']) { [int]$settings['THREAD_RECONSTRUCTION_PORT'] } else { 8790 }
$tls = [bool]$settings['THREAD_RECONSTRUCTION_TLS_CERT']
$hostName = if ($tls -and $settings['THREAD_RECONSTRUCTION_HOST']) { $settings['THREAD_RECONSTRUCTION_HOST'] } else { '127.0.0.1' }
$url = "$(if ($tls) { 'https' } else { 'http' })://${hostName}:$port/studio/#token=$token"

if (-not (Test-Path (Join-Path $root 'pipeline\envs\body\Scripts\python.exe'))) {
  Write-Warning 'The asset factory is not installed yet: you can inspect kits, but building bodies and garments needs pipeline\setup.ps1 first.'
}

$running = $false
try { $client = New-Object Net.Sockets.TcpClient; $client.Connect($hostName, $port); $running = $true; $client.Close() } catch { }
if ($running) {
  Write-Host "The engine is already running on port $port."
  if (-not $NoBrowser) { Start-Process $url }
  exit 0
}

& npx.cmd tsc -p tsconfig.node.json
if ($LASTEXITCODE) { throw 'The engine did not compile. Check the error above.' }
if (-not $NoBrowser) {
  # Open the studio once the engine accepts connections.
  Start-Job -ArgumentList $hostName, $port, $url -ScriptBlock {
    param($h, $p, $u)
    for ($i = 0; $i -lt 60; $i++) { try { $c = New-Object Net.Sockets.TcpClient; $c.Connect($h, $p); $c.Close(); Start-Process $u; return } catch { Start-Sleep -Milliseconds 500 } }
  } | Out-Null
}
Write-Host 'Thread engine starting. Keep this window open while you use the studio or the phone; close it to stop.'
& node "--env-file=$EnvFile" .node-build/server/reconstruction-entry.js
