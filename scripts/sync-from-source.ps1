<#
.SYNOPSIS
    Sync new/changed files from MCPOrchestration source into FEC_CR_Builder.
.DESCRIPTION
    Copies templates, .kiro (excluding settings), and indexer scripts.
    Only copies files that are NEW or CHANGED (by hash comparison).
    Skips: settings/, node_modules/, __pycache__/, out/, .git/
.USAGE
    powershell -ExecutionPolicy Bypass -File scripts\sync-from-source.ps1
    powershell -ExecutionPolicy Bypass -File scripts\sync-from-source.ps1 -DryRun
#>

param(
    [switch]$DryRun
)

$SOURCE_ROOT = "C:\projects\kotlin\MCPOrchestration"
$DEST_ROOT = "C:\projects\kiro\FEC_CR_Builder"

$MAPPINGS = @(
    @{ Src = "documents\templates";                    Dst = "documents\templates" },
    @{ Src = ".kiro";                                  Dst = ".kiro" },
    @{ Src = ".analysis\code-intelligence\scripts";    Dst = ".analysis\code-intelligence\scripts" }
)

$SKIP_DIRS = @("settings", "node_modules", "__pycache__", "out", "dist", ".git")
$SKIP_FILES = @("mcp.json", "mcp.json,bk")

function Should-Skip($relativePath) {
    foreach ($dir in $SKIP_DIRS) {
        if ($relativePath -match "(^|\\)$dir(\\|$)") { return $true }
    }
    return $false
}

function Should-SkipFile($fileName) {
    return $SKIP_FILES -contains $fileName
}

$newCount = 0
$changedCount = 0
$skippedCount = 0

foreach ($mapping in $MAPPINGS) {
    $srcDir = Join-Path $SOURCE_ROOT $mapping.Src
    $dstDir = Join-Path $DEST_ROOT $mapping.Dst

    if (!(Test-Path $srcDir)) {
        Write-Host "SKIP: Source not found — $srcDir" -ForegroundColor Yellow
        continue
    }

    Write-Host "`n=== $($mapping.Src) ===" -ForegroundColor Cyan

    $files = Get-ChildItem -Path $srcDir -Recurse -File
    foreach ($f in $files) {
        $rel = $f.FullName.Substring($srcDir.Length)

        if (Should-Skip $rel) { $skippedCount++; continue }
        if (Should-SkipFile $f.Name) { $skippedCount++; continue }

        $dstFile = Join-Path $dstDir $rel

        if (!(Test-Path $dstFile)) {
            # New file
            if ($DryRun) {
                Write-Host "  NEW: $($mapping.Src)$rel" -ForegroundColor Green
            } else {
                $dir = Split-Path $dstFile -Parent
                if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
                Copy-Item $f.FullName -Destination $dstFile
                Write-Host "  NEW: $($mapping.Src)$rel" -ForegroundColor Green
            }
            $newCount++
        } else {
            # Check if changed
            $srcHash = (Get-FileHash $f.FullName -Algorithm MD5).Hash
            $dstHash = (Get-FileHash $dstFile -Algorithm MD5).Hash
            if ($srcHash -ne $dstHash) {
                if ($DryRun) {
                    Write-Host "  CHANGED: $($mapping.Src)$rel" -ForegroundColor Yellow
                } else {
                    Copy-Item $f.FullName -Destination $dstFile -Force
                    Write-Host "  CHANGED: $($mapping.Src)$rel" -ForegroundColor Yellow
                }
                $changedCount++
            }
        }
    }
}

Write-Host "`n--- Summary ---" -ForegroundColor White
Write-Host "  New:     $newCount" -ForegroundColor Green
Write-Host "  Changed: $changedCount" -ForegroundColor Yellow
Write-Host "  Skipped: $skippedCount" -ForegroundColor DarkGray
if ($DryRun) { Write-Host "  (DRY RUN — no files were copied)" -ForegroundColor Magenta }
