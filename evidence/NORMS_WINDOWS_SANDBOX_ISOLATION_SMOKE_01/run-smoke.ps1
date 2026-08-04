$ErrorActionPreference = 'Continue'
Clear-Host

Write-Host 'NORMS_WINDOWS_SANDBOX_ISOLATION_SMOKE_01' -ForegroundColor Cyan
Write-Host ''

Write-Host '1. LETTURA SENTINEL' -ForegroundColor Yellow

$sentinel = 'C:\NormsAuditInput\READ_ONLY_SENTINEL.txt'

if (Test-Path $sentinel) {
    Get-Content $sentinel
    Write-Host 'SENTINEL_READ: PASS' -ForegroundColor Green
}
else {
    Write-Host 'SENTINEL_READ: FAIL - file non trovato' -ForegroundColor Red
}

Write-Host ''
Write-Host '2. SCRITTURA NELLA CARTELLA MAPPATA' -ForegroundColor Yellow

$probe = 'C:\NormsAuditInput\SANDBOX_WRITE_PROBE.txt'

try {
    Set-Content -LiteralPath $probe -Value 'WRITE_SHOULD_BE_BLOCKED' -ErrorAction Stop
    Write-Host 'WRITE_BLOCKED: FAIL - la scrittura è riuscita' -ForegroundColor Red
    Remove-Item -LiteralPath $probe -Force -ErrorAction SilentlyContinue
}
catch {
    Write-Host 'WRITE_BLOCKED: PASS - scrittura rifiutata' -ForegroundColor Green
    Write-Host $_.Exception.Message
}

Write-Host ''
Write-Host '3. RETE TCP 1.1.1.1:443' -ForegroundColor Yellow

$result = Test-NetConnection 1.1.1.1 -Port 443 -InformationLevel Detailed

Write-Host ("TcpTestSucceeded : {0}" -f $result.TcpTestSucceeded)

if ($result.TcpTestSucceeded -eq $false) {
    Write-Host 'NETWORK_DISABLED: PASS' -ForegroundColor Green
}
else {
    Write-Host 'NETWORK_DISABLED: FAIL' -ForegroundColor Red
}

Write-Host ''
Write-Host 'Lascia aperta questa finestra e comunicami i tre risultati.' -ForegroundColor Cyan