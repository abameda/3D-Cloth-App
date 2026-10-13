$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outputFolder = Join-Path $projectRoot 'work/mac-handoff'
[System.IO.Directory]::CreateDirectory($outputFolder) | Out-Null
$outputPath = Join-Path $outputFolder 'thread-mac-test-2026-10-12.zip'
$temporaryPath = Join-Path $outputFolder ('source-' + [guid]::NewGuid().ToString() + '.zip')

# A source allowlist excludes runtime data even if ignored/private files are added later.
$rootFiles = @('App.tsx', 'index.ts', 'app.json', 'package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.node.json', 'metro.config.js', 'LICENSE', '.gitignore')
$exactFiles = @('assets/avatar/thread-character.glb', 'assets/avatar/README.md', 'tests/fixtures/measured-castle.glb', 'tests/fixtures/static-scan.glb', 'tests/fixtures/README.md', 'scripts/run-ios-local.sh', 'docs/mac-iphone-setup.md', 'docs/live-face-native-acceptance.md')
$sourceFolders = @('src', 'server', 'plugins', 'modules', 'tests')
$files = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($relative in ($rootFiles + $exactFiles)) {
  $path = Join-Path $projectRoot $relative
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required source file is missing: $relative" }
  $files.Add($path) | Out-Null
}
foreach ($folder in $sourceFolders) {
  foreach ($file in (Get-ChildItem -LiteralPath (Join-Path $projectRoot $folder) -File -Recurse)) {
    if ($file.Extension -in @('.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.swift', '.podspec')) {
      $files.Add($file.FullName) | Out-Null
    }
  }
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stream = [System.IO.File]::Open($temporaryPath, [System.IO.FileMode]::CreateNew)
$archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($path in ($files | Sort-Object)) {
    $resolved = [System.IO.Path]::GetFullPath($path)
    if (-not $resolved.StartsWith($projectRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Source path escaped the project.' }
    $item = Get-Item -LiteralPath $resolved
    if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { throw 'Source symlinks must be reviewed before packaging.' }
    $relative = [System.IO.Path]::GetRelativePath($projectRoot, $resolved).Replace([char]92, [char]47)
    if ($relative -match '(^|/)(\.env[^/]*|\.data|\.runtime|node_modules|work|\.expo|\.git|\.codex|\.agents)(/|$)') { throw 'Private/runtime path is not allowed in this archive.' }
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $resolved, ('thread-native/' + $relative), [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $archive.Dispose(); $stream.Dispose() }
[System.IO.File]::Move($temporaryPath, $outputPath, $true)
$hash = (Get-FileHash -LiteralPath $outputPath -Algorithm SHA256).Hash.ToLowerInvariant()
[pscustomobject]@{ Path = $outputPath; Files = $files.Count; Bytes = (Get-Item -LiteralPath $outputPath).Length; SHA256 = $hash } | ConvertTo-Json
