$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootUri = [Uri]($root.TrimEnd('\') + '\')
$items = Get-ChildItem -LiteralPath $root -Recurse -File |
    Where-Object {
        $_.Extension -in @('.md', '.pdf') -and
        $_.Name -notin @('README.md', 'LICENSE.md') -and
        $_.FullName -notmatch '[\\/]\.obsidian[\\/]'
    } |
    ForEach-Object {
        $relative = [Uri]::UnescapeDataString($rootUri.MakeRelativeUri([Uri]$_.FullName).ToString())
        $type = if ($_.Extension -eq '.pdf') { 'pdf' } else { 'markdown' }
        $first = if ($type -eq 'markdown') { Get-Content -LiteralPath $_.FullName -TotalCount 1 } else { '' }
        $title = if ($first -match '^#\s+(.+)$') { $Matches[1].Trim() } else { $_.BaseName }
        $folder = if ($relative.Contains('/')) { $relative.Split('/')[0] } else { 'Start' }
        [ordered]@{ title = $title; path = $relative; folder = $folder; type = $type }
    } | Sort-Object path
$json = $items | ConvertTo-Json -Depth 3
[IO.File]::WriteAllText((Join-Path $root 'content-manifest.json'), $json, [Text.UTF8Encoding]::new($false))
Write-Host "Entrenched site index refreshed: $($items.Count) readable documents."
