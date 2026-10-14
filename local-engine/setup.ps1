param()
$ErrorActionPreference = 'Stop'
$taskProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not (Test-Path -LiteralPath (Join-Path $taskProjectRoot 'package.json'))) { throw 'Run setup from the Thread project.' }
$taskRuntimeRoot = Join-Path $taskProjectRoot '.runtime'
New-Item -ItemType Directory -Force -Path $taskRuntimeRoot | Out-Null
function Install-VerifiedArchive($TaskName,$TaskUrl,$TaskHash,$TaskExpected) {
  $taskDestination = Join-Path $taskRuntimeRoot $TaskName
  $taskDestinationResolved = [IO.Path]::GetFullPath($taskDestination)
  if (-not $taskDestinationResolved.StartsWith($taskProjectRoot + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid runtime destination.' }
  if (Test-Path -LiteralPath (Join-Path $taskDestination $TaskExpected)) { return }
  New-Item -ItemType Directory -Force -Path $taskDestination | Out-Null
  $taskArchive = Join-Path $taskDestination 'download.zip'
  Invoke-WebRequest -Uri $TaskUrl -OutFile $taskArchive
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath $taskArchive).Hash.ToLowerInvariant() -ne $TaskHash) { throw "$TaskName checksum verification failed." }
  Expand-Archive -LiteralPath $taskArchive -DestinationPath (Join-Path $taskDestination 'bin') -Force
}
Install-VerifiedArchive 'colmap' 'https://github.com/colmap/colmap/releases/download/4.2.1/colmap-x64-windows-nocuda.zip' 'c493d88cb4a43f21afba42cb55bf786e5434a0420e73db0ba1454c5d8b3686ae' 'bin/bin/colmap.exe'
# With an NVIDIA GPU, the CUDA build (415 MB, same release, pinned checksum) runs feature extraction and matching on the GPU.
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
  Install-VerifiedArchive 'colmap-cuda' 'https://github.com/colmap/colmap/releases/download/4.2.1/colmap-x64-windows-cuda.zip' 'e9c5cbd84c2ea986d2e970a2473fc2d2e6b34a2cdcf5d3df2765c319a63af881' 'bin/bin/colmap.exe'
}
Install-VerifiedArchive 'openmvs' 'https://github.com/cdcseacave/openMVS/releases/download/v2.4.0/OpenMVS_Windows_x64.zip' '0c31660c15c9ebc4c106873cf67564d9570d404aef7a6403451da1b6178b2167' 'bin/vc17/x64/Release/TextureMesh.exe'
$taskPython = Join-Path $taskRuntimeRoot 'reconstruction-python/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $taskPython)) { & python -m venv (Join-Path $taskRuntimeRoot 'reconstruction-python'); if ($LASTEXITCODE -ne 0) { throw 'Python 3.11 is required.' } }
& $taskPython -m pip install -r (Join-Path $PSScriptRoot 'requirements.lock.txt')
if ($LASTEXITCODE -ne 0) { throw 'Local Python dependency setup failed.' }
& $taskPython (Join-Path $PSScriptRoot 'setup-models.py')
if ($LASTEXITCODE -ne 0) { throw 'Local model setup failed.' }
$taskEnvironment = Join-Path $taskProjectRoot '.env.local-reconstruction'
if (-not (Test-Path -LiteralPath $taskEnvironment)) {
  $taskRandom = New-Object byte[] 32
  $taskGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $taskGenerator.GetBytes($taskRandom) } finally { $taskGenerator.Dispose() }
  $taskToken = -join ($taskRandom | ForEach-Object { $_.ToString('x2') })
  [IO.File]::WriteAllText($taskEnvironment,"THREAD_RECONSTRUCTION_TOKEN=$taskToken`nTHREAD_RECONSTRUCTION_PORT=8790`n")
}
Write-Output 'Local reconstruction runtime installed. No paid reconstruction service is used.'
Write-Output 'Run npm run server:reconstruction. Pair the phone through your own authenticated HTTPS gateway. Keep .env.local-reconstruction private.'
