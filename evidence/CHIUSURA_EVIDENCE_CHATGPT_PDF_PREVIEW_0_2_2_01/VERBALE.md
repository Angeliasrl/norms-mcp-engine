# Chiusura evidence ChatGPT PDF preview 0.2.2 - 01

## Stato

`EVIDENCE_PASS_ANCHOR_PENDING`

Il PASS funzionale ChatGPT PDF preview e registrato. Non esiste nel repository
una procedura RFC 3161 configurata e verificabile; pertanto il digest del
manifest non e stato inviato a una TSA e nessun anchor e dichiarato.

Data di congelamento del bundle: `2026-08-07T16:37:56.496Z`.

## Baseline verificata

- repository: `Angeliasrl/norms-mcp-engine`;
- branch: `feat/cloudflare-preview-0.5.3-0.2.2`;
- commit MCP preview locale e remoto:
  `bb00f85f1579dd56a29a7469178ef1a42088b30f`;
- CI del commit: run `31195971736`, tre check `suite (20)`, `suite (22)` e
  `suite (24)` completati con `success`;
- Worker preview Version ID:
  `22766d5d-d190-40ef-a484-944bd479f039`;
- endpoint preview:
  `https://norms-mcp-preview-0-2-2-pipeline-0-5-3.friva1947.workers.dev`;
- health preview: `{"status":"ok"}`;
- pipeline image manifest digest:
  `sha256:92835dd5c86e730250f586a7dee2ddab04f961bd5dc6ad726ca5ec743a63b73c`;
- pipeline commit: `b1f0baef902abdf2a77208e5e567cc522dc12e85`;
- pipeline publication commit:
  `1616ed4f1a7ec601c1e9fd913ee531279a6c01c8`;
- pipeline publication CI run: `31191426777`, attempt `2`;
- produzione Version ID invariata:
  `0466a165-39a5-4024-b24d-8e91f830a45b`;
- produzione live: server `0.1.1`, toolset limitato a
  `assess_normative_reliance` e `run_positive_current_operational_demo`, health
  e pagine pubbliche verificate.

## Claim 1 - PASS ChatGPT con richiesta vuota

### Claim

Il file PDF inerte e stato elaborato dalla preview mediante il lifecycle
upload, finalize, audit e delete, con verifica diretta dell'assenza dello
specifico oggetto caricato. NORMS Core non e stato chiamato, correttamente,
perche `audit_request` era vuoto.

### Basis

Esito indipendente ChatGPT fornito come input di chiusura dall'operatore e
identita locale del fixture verificata mediante SHA-256.

### Proof

- document bundle version: `0.2.1`;
- PDF SHA-256:
  `254e301772cd54612d3e0e620434f3f94e341be4a94b7a43ea87642eaf2211e9`;
- document bundle SHA-256:
  `b09a8ca4257167b242e2c8b840aece177d3374a94424d1dc41605a877a7779b9`;
- pages: `1`;
- byte verification, finalize, audit e delete: `PASS`;
- cleanup claim: `SPECIFIC_UPLOADED_OBJECT_ABSENT`;
- cleanup scope: `SINGLE_OPAQUE_UPLOAD_OBJECT` /
  `SINGLE_UPLOAD_SESSION`;
- storage liveness: `LIVE`;
- absence proof: `DIRECT_STORAGE_METADATA_LOOKUP: ABSENT`;
- `verified_absent: true`;
- `norms_core_called: false`.

### Limit

Il record conserva l'esito strutturato comunicato, ma non include l'envelope
nativo ChatGPT, capability, URL firmati o payload originali. La prova di
assenza riguarda un solo oggetto opaco e una sola sessione; non prova assenza
da backup, log o sistemi esterni. La richiesta vuota non dimostra una
valutazione normativa e non autorizza `CURRENT_OPERATIONAL`.

## Claim 2 - smoke CURRENT_OPERATIONAL separato

### Claim

Uno smoke live distinto, eseguito sulla stessa preview con il fixture sintetico
canonico `CURRENT_OPERATIONAL`, ha chiamato NORMS Core e ha concluso il proprio
lifecycle con cancellazione verificata.

### Basis

Esecuzione del runner gia presente al commit baseline
`scripts/preview-live-core-pdf-smoke.mjs` contro l'endpoint preview, senza
modificare o distribuire infrastruttura.

### Proof

Il report `CURRENT_OPERATIONAL_SMOKE.json` registra:

- `core_called: true`;
- PDF SHA-256 uguale al fixture ChatGPT;
- document bundle version `0.2.1`;
- binding separato degli hash di PDF, audit request e output NORMS;
- `authorizes_current_operational: true` e `admissible: true` esclusivamente
  per il fixture sintetico canonico;
- cleanup `deleted: true` e `verified_absent: true` mediante
  `R2_HEAD_AFTER_DELETE` alle `2026-08-07T16:37:48.250Z`.

### Limit

Lo smoke riguarda un fixture sintetico e non certifica fatti reali, conformita
o validita giuridica. Non trasforma l'audit ChatGPT a richiesta vuota in una
chiamata Core e non estende la prova di cleanup oltre il singolo oggetto e la
singola sessione.

## Anchor RFC 3161

La ricerca nel checkout non ha trovato endpoint TSA, policy, certificato,
script di richiesta o procedura di verifica RFC 3161 configurati. In assenza di
una procedura esistente verificabile:

- TSA: `NOT_CONFIGURED`;
- timestamp RFC 3161: `NOT_ISSUED`;
- token: `NOT_CREATED`;
- verifica token: `NOT_RUN`;
- stato finale: `EVIDENCE_PASS_ANCHOR_PENDING`.

Il digest del manifest e pubblicato in `SHA256SUMS.txt`; quello, e non un hash
derivato o ricostruito, e il valore da ancorare quando sara disponibile una
procedura autorizzata e verificabile.

## Confini operativi preservati

Nessuna modifica o distribuzione di codice, Worker, Container, NORMS Core o
produzione. Nessun deploy, merge, tag, nuovo workflow o modifica di secret.
Nessun secret, capability, URL firmato, bucket key o dato personale e incluso
nel bundle.
