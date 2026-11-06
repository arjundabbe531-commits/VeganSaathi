# ==============================================================================
# VeganSaathi — tests/run_all.ps1
# Runs every automated unit suite, static check, and syntax gate on Windows PowerShell.
# Exit code 0 on all pass, non-zero if any test or check fails.
# Usage:
#     powershell -ExecutionPolicy Bypass -File tests/run_all.ps1
# ==============================================================================

param (
    [switch]$SkipBrowser
)

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Failed = 0
$Summary = @()

function Record-Result {
    param (
        [string]$Name,
        [int]$ExitCode,
        [string[]]$OutputLines
    )

    $passCount = ($OutputLines | Select-String -Pattern '^PASS' | Measure-Object).Count
    $failCount = ($OutputLines | Select-String -Pattern '^FAIL' | Measure-Object).Count
    $tapSummary = $OutputLines | Select-String -Pattern 'tests (\d+)' | Select-Object -Last 1
    if ($tapSummary) {
        $tapFailureSummary = $OutputLines | Select-String -Pattern 'fail (\d+)' | Select-Object -Last 1
        $failCount = if ($tapFailureSummary) { [int]$tapFailureSummary.Matches[0].Groups[1].Value } else { 0 }
        $passCount = [int]$tapSummary.Matches[0].Groups[1].Value - $failCount
    }

    $status = "PASS"
    if ($ExitCode -ne 0 -or $failCount -gt 0) {
        $status = "FAIL"
        $script:Failed = 1
    }

    $script:Summary += [PSCustomObject]@{
        Status = $status
        Suite  = $Name
        Passed = $passCount
        Failed = $failCount
    }

    if ($status -eq "FAIL") {
        Write-Host "---- FAILURES IN $Name ----" -ForegroundColor Red
        $OutputLines | Select-String -Pattern '^FAIL' | Select-Object -First 10 | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    }
}

Write-Host "Running VeganSaathi Automated Test Suite on Windows PowerShell..." -ForegroundColor Cyan
Write-Host "Working Directory: $Root`n" -ForegroundColor Gray

# 1. Node ESM Unit Test Suites
$unitSuites = Get-ChildItem -Path "$Root\tests" -Filter "test-*.mjs" | Sort-Object Name
foreach ($suite in $unitSuites) {
    $suiteName = "node tests/$($suite.Name)"
    $output = & node $suite.FullName 2>&1
    Record-Result -Name $suiteName -ExitCode $LASTEXITCODE -OutputLines $output
}

# 2. Static Checker: Duplicate Globals
$dupOutput = & node "$Root\tests\check-duplicate-globals.js" 2>&1
Record-Result -Name "node tests/check-duplicate-globals.js" -ExitCode $LASTEXITCODE -OutputLines $dupOutput

# 3. Static Checker: Rules Fixture
$rulesOutput = & python "$Root\tests\rules\check_fixture_static.py" 2>&1
Record-Result -Name "python tests/rules/check_fixture_static.py" -ExitCode $LASTEXITCODE -OutputLines $rulesOutput

# 4. Playwright Headless Browser Test Suites (stubbed services)
if (-not $SkipBrowser) {
    $browserSuites = Get-ChildItem -Path "$Root\tests\browser" -Filter "test_*.py" | Sort-Object Name
    foreach ($suite in $browserSuites) {
        $suiteName = "python tests/browser/$($suite.Name)"
        $output = & python $suite.FullName 2>&1
        Record-Result -Name $suiteName -ExitCode $LASTEXITCODE -OutputLines $output
    }
} else {
    Write-Host "Skipping browser test suites (-SkipBrowser specified)`n" -ForegroundColor Yellow
}

# 5. Syntax Validation across all JS/MJS scripts
$jsFiles = Get-ChildItem -Path $Root -Recurse -Include *.js, *.mjs | Where-Object { $_.FullName -notmatch '\\(node_modules|\.git)\\' }
$syntaxFail = 0
foreach ($f in $jsFiles) {
    # Force ESM parsing for browser modules too; node --check on a filename
    # silently treats .js as CommonJS when the root package is not type=module.
    $syntaxOutput = Get-Content -Raw $f.FullName | & node --input-type=module --check 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "SYNTAX FAIL: $($f.FullName)" -ForegroundColor Red
        Write-Host ($syntaxOutput -join "`n") -ForegroundColor DarkRed
        $syntaxFail++
    }
}

if ($syntaxFail -gt 0) {
    $script:Failed = 1
    $script:Summary += [PSCustomObject]@{
        Status = "FAIL"
        Suite  = "node --check (syntax errors)"
        Passed = ($jsFiles.Count - $syntaxFail)
        Failed = $syntaxFail
    }
} else {
    $script:Summary += [PSCustomObject]@{
        Status = "PASS"
        Suite  = "node --check on all $($jsFiles.Count) JS/MJS files"
        Passed = $jsFiles.Count
        Failed = 0
    }
}

Write-Host "`n================================ SUMMARY ================================" -ForegroundColor Cyan
$Summary | Format-Table -AutoSize
Write-Host "========================================================================`n" -ForegroundColor Cyan

# Cleanup Python cache
Get-ChildItem -Path "$Root\tests" -Recurse -Filter "__pycache__" -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

if ($Failed -eq 0) {
    Write-Host "ALL ACTIVE TEST SUITES AND STATIC GATES PASSED (100% CLEAN)" -ForegroundColor Green
    exit 0
} else {
    Write-Host "TEST RUN FAILED - SEE FAILURES ABOVE" -ForegroundColor Red
    exit 1
}
