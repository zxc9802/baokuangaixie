$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$extensionDirectoryName = -join ([char[]](0x6293, 0x53D6, 0x811A, 0x672C))
$extensionRoot = (Resolve-Path (Join-Path $projectRoot $extensionDirectoryName)).Path
$targetPath = Join-Path $projectRoot 'public\video-script-browser-extension.zip'

if (-not $extensionRoot.StartsWith($projectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'Extension source path is outside the project root.'
}

$files = @(
  'manifest.json',
  'background.js',
  'bridge.js',
  'collectors.js',
  'popup.html',
  'popup.css',
  'popup.js'
) | ForEach-Object { Join-Path $extensionRoot $_ }

Compress-Archive -LiteralPath $files -DestinationPath $targetPath -Force
Write-Output "Created $targetPath"
