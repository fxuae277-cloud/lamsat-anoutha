<#
.SYNOPSIS
    Lamsa POS - comprehensive backup of the local print service.

.DESCRIPTION
    Produces four artefacts under -BackupRoot:
      1. BACKUP-CODE-<version>-<date>.zip  - current source tree (excludes
         node_modules / test-output / *.log)
      2. HISTORY-N-<sha>-<msg>.zip         - archive of the local-print-service
         folder at each of the last N commits (skipped with -SkipHistory)
      3. BACKUP-CONFIG-<date>.zip          - .env, printer list, NSSM/SC service
         config, package.json snapshot, /health response
      4. MANIFEST-<date>.txt               - human-readable index + restore guide

    All zips and the manifest are mirrored to G:\BACKUPS-Lamsa unless
    -SkipGoogleDrive is set or G:\ is missing.

    NOTE: this script must stay pure-ASCII. PowerShell 5.1 reads source files
    without a BOM as Windows-1252 in the en-US default locale, which corrupts
    multi-byte UTF-8 characters and triggers misleading parser errors. The
    Write tool that authors this file does not emit a BOM.

.PARAMETER SourcePath
    Override the auto-detected local-print-service path. By default the script
    walks (in order) its own folder's parent, C:\Users\mcc\lamsa\local-print-service,
    and C:\Users\HP\lamsat-anoutha\local-print-service.

.PARAMETER BackupRoot
    Custom backup destination. Defaults to "<source>\..\BACKUPS".

.PARAMETER KeepHistoryCommits
    Number of historical commits to archive (default 5).

.PARAMETER SkipHistory
    Skip the git-history layer entirely.

.PARAMETER SkipGoogleDrive
    Skip the offsite copy to G:\BACKUPS-Lamsa.

.EXAMPLE
    .\backup.ps1
    .\backup.ps1 -BackupRoot D:\bk -KeepHistoryCommits 10 -SkipGoogleDrive
#>
[CmdletBinding()]
param(
    [string]$SourcePath = "",
    [string]$BackupRoot = "",
    [int]$KeepHistoryCommits = 5,
    [switch]$SkipHistory,
    [switch]$SkipGoogleDrive
)

$ErrorActionPreference = "Stop"
$date = Get-Date -Format "yyyy-MM-dd-HHmm"

# --------------------------------------------------------------------
# Auto-detection
# --------------------------------------------------------------------
function Resolve-SourcePath {
    param([string]$Override)

    if ($Override) {
        if (-not (Test-Path $Override)) {
            throw "SourcePath '$Override' does not exist."
        }
        return (Resolve-Path $Override).Path
    }

    # 1. Script lives at <repo>/local-print-service/scripts/backup.ps1
    $candidate = Join-Path $PSScriptRoot ".."
    $pkgPath = Join-Path $candidate "package.json"
    if (Test-Path $pkgPath) {
        try {
            $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
            if ($pkg.name -eq "lamsa-local-print-service") {
                return (Resolve-Path $candidate).Path
            }
        } catch { }
    }

    # 2. Common cashier install
    $cashier = "C:\Users\mcc\lamsat\local-print-service"
    if (Test-Path $cashier) { return $cashier }

    # 3. Common dev install
    $dev = "C:\Users\HP\lamsat-anoutha\local-print-service"
    if (Test-Path $dev) { return $dev }

    throw "Could not auto-detect local-print-service path. Pass -SourcePath."
}

function Resolve-BackupRoot {
    param([string]$Override, [string]$Source)
    if ($Override) {
        if (-not (Test-Path $Override)) {
            New-Item -ItemType Directory -Path $Override -Force | Out-Null
        }
        return (Resolve-Path $Override).Path
    }
    $default = Join-Path (Split-Path $Source -Parent) "BACKUPS"
    if (-not (Test-Path $default)) {
        New-Item -ItemType Directory -Path $default -Force | Out-Null
    }
    return (Resolve-Path $default).Path
}

function Get-ServiceVersion {
    param([string]$Source)
    $pkgPath = Join-Path $Source "package.json"
    if (Test-Path $pkgPath) {
        try {
            $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
            if ($pkg.version) { return $pkg.version }
        } catch { }
    }
    return "unknown"
}

# --------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------
function Format-Mb {
    param([long]$Bytes)
    return [math]::Round($Bytes / 1MB, 2)
}

function Write-Section {
    param([string]$Label)
    Write-Host ""
    Write-Host "==============================================="  -ForegroundColor Cyan
    Write-Host "  $Label" -ForegroundColor Cyan
    Write-Host "==============================================="  -ForegroundColor Cyan
}

# --------------------------------------------------------------------
# Resolve paths
# --------------------------------------------------------------------
$src = Resolve-SourcePath -Override $SourcePath
$bkRoot = Resolve-BackupRoot -Override $BackupRoot -Source $src
$version = Get-ServiceVersion -Source $src

Write-Section "Lamsa POS - Backup Strategy"
Write-Host "  Source:  $src" -ForegroundColor White
Write-Host "  Target:  $bkRoot" -ForegroundColor White
Write-Host "  Version: $version" -ForegroundColor White
Write-Host "  Date:    $date" -ForegroundColor White

# --------------------------------------------------------------------
# Layer 1: current state
# --------------------------------------------------------------------
Write-Host ""
Write-Host "[1/4] Current state backup (v$version)..." -ForegroundColor Yellow
$tempDir = Join-Path $env:TEMP "lamsa-bk-$date"
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }

# robocopy returns non-zero exit codes for "success with copies" -- ignore them.
& robocopy $src $tempDir /E /XF "*.log" /XD "node_modules" "test-output" `
    "BACKUPS" "dist" /NFL /NDL /NJH /NJS | Out-Null
if (-not (Test-Path $tempDir)) {
    throw "robocopy produced no output for '$src'."
}

$codeZip = Join-Path $bkRoot "BACKUP-CODE-v$version-$date.zip"
Compress-Archive -Path "$tempDir\*" -DestinationPath $codeZip -Force
Remove-Item $tempDir -Recurse -Force
$codeMb = Format-Mb (Get-Item $codeZip).Length
$codeName = Split-Path $codeZip -Leaf
Write-Host "   OK  $codeName  ($codeMb MB)" -ForegroundColor Green

# --------------------------------------------------------------------
# Layer 2: git history
# --------------------------------------------------------------------
Write-Host ""
Write-Host "[2/4] Git history backup ($KeepHistoryCommits commits)..." -ForegroundColor Yellow
if ($SkipHistory) {
    Write-Host "   SKIPPED (-SkipHistory)" -ForegroundColor DarkGray
} else {
    # Prefer the local repo (parent of source). Falls back to a shallow clone
    # only when no .git is reachable from the source path.
    $repoRoot = Split-Path $src -Parent
    $useLocal = Test-Path (Join-Path $repoRoot ".git")
    $cleanupClone = $false

    if (-not $useLocal) {
        Write-Host "   No local .git found, cloning shallow copy..." -ForegroundColor DarkGray
        $repoRoot = Join-Path $env:TEMP "lamsa-history-$date"
        if (Test-Path $repoRoot) { Remove-Item $repoRoot -Recurse -Force }
        $depth = $KeepHistoryCommits + 5
        & git clone --depth=$depth `
            "https://github.com/fxuae277-cloud/lamsat-anoutha.git" `
            $repoRoot 2>&1 | Out-Null
        if (-not (Test-Path (Join-Path $repoRoot ".git"))) {
            Write-Host "   FAILED to clone history (skipping layer 2)" -ForegroundColor Yellow
            $repoRoot = $null
        } else {
            $cleanupClone = $true
        }
    }

    if ($repoRoot) {
        Push-Location $repoRoot
        try {
            $shas = & git log --pretty=format:"%h" -n $KeepHistoryCommits 2>$null
            $i = 1
            foreach ($sha in $shas) {
                if ($sha -notmatch '^[a-f0-9]{7,}$') { continue }
                $msg = & git log -1 --pretty=format:"%s" $sha 2>$null
                # Strip non-word/space/dash, trim, replace whitespace with dash,
                # cap at 40 chars so the file name stays readable.
                $clean = ($msg -replace '[^\w\s-]', '').Trim() -replace '\s+', '-'
                if ($clean.Length -gt 40) { $clean = $clean.Substring(0, 40) }
                $archive = Join-Path $bkRoot "HISTORY-$i-$sha-$clean-$date.zip"
                & git archive --format=zip --output="$archive" $sha -- local-print-service/ 2>&1 | Out-Null
                if (Test-Path $archive) {
                    $archMb = Format-Mb (Get-Item $archive).Length
                    Write-Host "   OK  $i  $sha  $archMb MB  $msg" -ForegroundColor Green
                } else {
                    Write-Host "   SKIP $sha (no local-print-service path at this commit)" -ForegroundColor DarkGray
                }
                $i++
            }
        } finally {
            Pop-Location
        }
        if ($cleanupClone -and (Test-Path $repoRoot)) {
            Remove-Item $repoRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

# --------------------------------------------------------------------
# Layer 3: configs
# --------------------------------------------------------------------
Write-Host ""
Write-Host "[3/4] Sensitive configs backup..." -ForegroundColor Yellow
$configBk = Join-Path $bkRoot "CONFIG-$date"
New-Item -ItemType Directory -Path $configBk -Force | Out-Null

# .env
$envPath = Join-Path $src ".env"
if (Test-Path $envPath) {
    Copy-Item $envPath (Join-Path $configBk "env-backup.txt") -Force
    Write-Host "   OK  .env saved" -ForegroundColor Green
} else {
    Write-Host "   SKIP .env (not present)" -ForegroundColor DarkGray
}

# Printer list -- TSC + EPSON only.
try {
    $printers = Get-Printer 2>$null | Where-Object {
        $_.Name -like "*TSC*" -or $_.Name -like "*EPSON*"
    }
    if ($printers) {
        $printers | Select-Object Name, DriverName, PortName, Datatype, Shared, PrinterStatus |
            Export-Csv -Path (Join-Path $configBk "printers-config.csv") `
                       -NoTypeInformation -Encoding UTF8
        Write-Host "   OK  Printers ($($printers.Count) found)" -ForegroundColor Green
    } else {
        "No TSC/EPSON printers found at backup time." |
            Out-File -FilePath (Join-Path $configBk "printers-config.txt") -Encoding utf8
        Write-Host "   OK  Printers (none matched filter)" -ForegroundColor DarkGray
    }
} catch {
    Write-Host "   SKIP Printers (Get-Printer unavailable: $($_.Exception.Message))" -ForegroundColor DarkGray
}

# Service config (best effort -- these tools may be missing on dev boxes).
try {
    & sc.exe query lamsa-print 2>&1 |
        Out-File -FilePath (Join-Path $configBk "service-status.txt") -Encoding utf8
} catch { }

if (Get-Command nssm -ErrorAction SilentlyContinue) {
    try {
        & nssm dump lamsa-print 2>&1 |
            Out-File -FilePath (Join-Path $configBk "service-config.txt") -Encoding utf8
    } catch { }
}
Write-Host "   OK  Service config (best effort)" -ForegroundColor Green

# package.json snapshot
$pkgPath = Join-Path $src "package.json"
if (Test-Path $pkgPath) {
    Copy-Item $pkgPath (Join-Path $configBk "package-snapshot.json") -Force
}

# /health snapshot (defensive -- endpoint shape varies across versions).
$health = $null
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:3001/health" `
        -TimeoutSec 3 -ErrorAction Stop
    $health | ConvertTo-Json -Depth 6 |
        Out-File -FilePath (Join-Path $configBk "health.json") -Encoding utf8
    Write-Host "   OK  /health captured" -ForegroundColor Green
} catch {
    Write-Host "   SKIP /health (service not responding)" -ForegroundColor DarkGray
}

$configZip = Join-Path $bkRoot "BACKUP-CONFIG-$date.zip"
Compress-Archive -Path "$configBk\*" -DestinationPath $configZip -Force
Remove-Item $configBk -Recurse -Force
$configName = Split-Path $configZip -Leaf
Write-Host "   OK  $configName" -ForegroundColor Green

# --------------------------------------------------------------------
# Layer 4: manifest
# --------------------------------------------------------------------
Write-Host ""
Write-Host "[4/4] Writing manifest..." -ForegroundColor Yellow

$manifestPath = Join-Path $bkRoot "MANIFEST-$date.txt"
$manifestLines = New-Object System.Collections.Generic.List[string]
[void]$manifestLines.Add("===============================================")
[void]$manifestLines.Add("  LAMSA POS - BACKUP MANIFEST")
[void]$manifestLines.Add("===============================================")
[void]$manifestLines.Add("  Backup Date:     $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
[void]$manifestLines.Add("  Service Version: $version")
[void]$manifestLines.Add("  Source Path:     $src")
[void]$manifestLines.Add("  Backup Root:     $bkRoot")
[void]$manifestLines.Add("  Computer:        $env:COMPUTERNAME")
[void]$manifestLines.Add("  User:            $env:USERNAME")
[void]$manifestLines.Add("")
[void]$manifestLines.Add("===============================================")
[void]$manifestLines.Add("  PRINTERS / SERVICE STATUS")
[void]$manifestLines.Add("===============================================")
if ($health) {
    $serviceState = if ($health.ok) { "OK" } else { "NOT OK" }
    $verSuffix = if ($health.version) { " v$($health.version)" } else { "" }
    [void]$manifestLines.Add("  Service: $serviceState$verSuffix")
    if ($health.printers -and $health.printers.receipt -and $health.printers.receipt.name) {
        [void]$manifestLines.Add("  Receipt: $($health.printers.receipt.name)")
    }
    if ($health.printers -and $health.printers.label -and $health.printers.label.name) {
        [void]$manifestLines.Add("  Label:   $($health.printers.label.name)")
    }
} else {
    [void]$manifestLines.Add("  Service: NOT REACHABLE at backup time")
}
[void]$manifestLines.Add("")
[void]$manifestLines.Add("===============================================")
[void]$manifestLines.Add("  FILES IN THIS BACKUP")
[void]$manifestLines.Add("===============================================")

Get-ChildItem $bkRoot -File | Sort-Object LastWriteTime -Descending |
    Select-Object -First 20 | ForEach-Object {
        $mb = Format-Mb $_.Length
        [void]$manifestLines.Add("  - $($_.Name)  ($mb MB)")
    }

[void]$manifestLines.Add("")
[void]$manifestLines.Add("===============================================")
[void]$manifestLines.Add("  RESTORATION GUIDE")
[void]$manifestLines.Add("===============================================")
[void]$manifestLines.Add("")
[void]$manifestLines.Add("  1. Stop service:")
[void]$manifestLines.Add("     nssm stop lamsa-print")
[void]$manifestLines.Add("")
[void]$manifestLines.Add("  2. Backup current state (just in case):")
[void]$manifestLines.Add("     Compress-Archive '$src' 'BACKUP-emergency.zip'")
[void]$manifestLines.Add("")
[void]$manifestLines.Add("  3. Extract the desired backup over the source folder:")
[void]$manifestLines.Add("     Expand-Archive 'BACKUP-CODE-v$version-$date.zip' '$src' -Force")
[void]$manifestLines.Add("")
[void]$manifestLines.Add("  4. Restore .env from the matching CONFIG zip.")
[void]$manifestLines.Add("")
[void]$manifestLines.Add("  5. Reinstall + rebuild:")
[void]$manifestLines.Add("     cd '$src'")
[void]$manifestLines.Add("     npm install")
[void]$manifestLines.Add("     npm run build")
[void]$manifestLines.Add("")
[void]$manifestLines.Add("  6. Start service:")
[void]$manifestLines.Add("     nssm start lamsa-print")
[void]$manifestLines.Add("")
[void]$manifestLines.Add("  7. Verify:")
[void]$manifestLines.Add("     curl http://127.0.0.1:3001/health")
[void]$manifestLines.Add("")
[void]$manifestLines.Add("===============================================")

$manifestLines -join "`r`n" | Out-File -FilePath $manifestPath -Encoding utf8
$manifestName = Split-Path $manifestPath -Leaf
Write-Host "   OK  $manifestName" -ForegroundColor Green

# --------------------------------------------------------------------
# Offsite mirror to G:\
# --------------------------------------------------------------------
if (-not $SkipGoogleDrive) {
    Write-Host ""
    Write-Host "[+] Offsite copy to G:\BACKUPS-Lamsa..." -ForegroundColor Yellow
    if (Test-Path "G:\") {
        $offsite = "G:\BACKUPS-Lamsa"
        if (-not (Test-Path $offsite)) {
            New-Item -ItemType Directory -Path $offsite -Force | Out-Null
        }
        try {
            Copy-Item $codeZip $offsite -Force
            Copy-Item $configZip $offsite -Force
            Copy-Item $manifestPath $offsite -Force
            Get-ChildItem $bkRoot -Filter "HISTORY-*-$date*.zip" -File |
                ForEach-Object { Copy-Item $_.FullName $offsite -Force }
            Write-Host "   OK  Mirrored to $offsite" -ForegroundColor Green
        } catch {
            Write-Host "   FAILED Offsite copy: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   SKIP G:\ not present" -ForegroundColor DarkGray
    }
} else {
    Write-Host ""
    Write-Host "[+] Offsite copy SKIPPED (-SkipGoogleDrive)" -ForegroundColor DarkGray
}

# --------------------------------------------------------------------
# Summary
# --------------------------------------------------------------------
Write-Section "Backup complete"
$allFiles = Get-ChildItem $bkRoot -File
$totalMb = Format-Mb (($allFiles | Measure-Object -Property Length -Sum).Sum)
Write-Host "  Files in backup root: $($allFiles.Count)" -ForegroundColor White
Write-Host "  Total size:           $totalMb MB" -ForegroundColor White
Write-Host ""
Write-Host "  This-run artefacts:" -ForegroundColor Cyan
$allFiles | Where-Object { $_.Name -match $date } | Sort-Object Name |
    ForEach-Object {
        $mb = Format-Mb $_.Length
        Write-Host "   - $($_.Name)  ($mb MB)" -ForegroundColor White
    }
Write-Host ""
