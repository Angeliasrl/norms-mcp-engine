# NORMS_WINDOWS_SANDBOX_ISOLATION_SMOKE_01

Data chiusura: 2026-08-04 08:54:54 +02:00

## Esiti osservati

- Sentinel leggibile nella Sandbox: PASS
- Cartella condivisa montata in sola lettura: PASS
- Tentativo di creazione write_test.txt: bloccato
- File write_test.txt nella cartella host: assente
- Appunti host/Sandbox: disabilitati
- PingSucceeded: False
- TcpTestSucceeded: False
- Sessioni Sandbox attive dopo lo stop: 0
- File inattesi nella cartella input: 0
- Processo host WindowsSandboxServer presente: True
- WindowsSandboxServer non classificato come sessione Sandbox attiva

## SHA-256

- READ_ONLY_SENTINEL.txt: 4FFA19541CE128D0D08FECEA1BB1990AB4ECA375DE0ADBACEDE2D4674E3421B1
- Configurazione .wsb: 8DC72A164483E66349CEF2441E41CD679D1C15B45944E8B8C70E8E634EEB2AAD
- Script run-smoke.ps1: C2E60FE04ADD3409A8564CC0B2331DDFF4BE7D699BEF4FBD77E36CF07C5BD3B9

## Verdetto

NORMS_WINDOWS_SANDBOX_ISOLATION_SMOKE_01 — PASS
