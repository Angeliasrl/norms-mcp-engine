# SPEC CONTRATTO `norms-resolver-service/0.6.0` — rev. 2 **RATIFICATA**

> **RATIFICA_NORMS_RESOLVER_0_6_0_REV_2_01 — 2026-08-11.**
> Francesco Riva ratifica la revisione 2 del disegno NORMS resolver 0.6.0
> b-primo, e ratifica VERBATIM la regola §3.4:
>
> "PUBLIC_RESOLVED sse: identità unica EXACT e ledger vuoto e blocking
> vuoto e coexistence_kind ∈ {assente, DOUBLE_PUB_IDENTICAL} e — se la
> richiesta porta as_of — temporal_selection.selection = APPLIED."
>
> Decisioni sui punti aperti: **P3** approvato il bump versionato degli
> schemi interni; **P4** nessuna deprecazione di `matching` in questo round;
> **P6** approvata la propagazione di `as_of` sul ramo `citation` 0.6.0;
> **P7** `evidence_records` senza HTML integrali, conservando hash e
> metadati necessari.
> Ratificati inoltre: il default legacy 0.5.4 congelato, il ramo 0.6.0
> esclusivamente opt-in, la formula di non-inesistenza pinnata (§5.1) e la
> sequenza di attivazione vincolata (§7).
> **La ratifica chiude soltanto il disegno. NON autorizza codice, build,
> modifica del container, resolutionView, deploy, binding o variazioni
> della produzione.**

Data: 2026-08-11. Round progettuale (DECISIONE_B_PRIMO_01, architettura b′).
Rev. 2: incorpora **DECISIONE_CONSUMATORI_01** — i consumatori esterni di
`resolve_normative_evidence` sono UNKNOWN (endpoint pubblico e anonimo, uso
esclusivo del proprietario non dimostrabile): la retrocompatibilità è
OBBLIGATORIA, il default è legacy, e non cambia senza un successivo atto di
deprecazione.
Solo design: nessun codice, nessun container, nessun deploy.
Base fattuale: `RAPPORTO_CONTRATTO_054_vs_EVIDENCE_2026-08-11.md` (fatti
accertati: 0.5.4 elegge un candidato; `VERIFIED_APPLICABLE` oggi
irraggiungibile; `sources: []` frequente; blocker per-candidato non risalgono;
`contradiction_ledger` a enum chiuso).

**Invariante non negoziabile applicato in tutto il documento:** nessun campo
Evidence viene eliminato, reinterpretato o trasformato in un giudizio di
inesistenza. `SOURCE_DATE_OUT_OF_RANGE` e l'assenza di risoluzione non
diventano mai "not found"/"non esiste". Dove il disegno non regge senza
forzatura, il punto è in §9 PROBLEMI APERTI, non aggirato.

**Principio di composizione (rev. 2):** un solo servizio, DUE RAMI DI
VERSIONE selezionati dalla request. Il ramo legacy esegue ed emette 0.5.4
TALE E QUALE (congelato); il ramo 0.6.0 esegue ed emette il contratto nuovo
(0.5.4 + campi additivi). Nessun campo 0.5.4 cambia nome, tipo o semantica in
nessun ramo; sul ramo 0.6.0 le uniche evoluzioni sono (i) ampliamenti di enum
dichiarati, (ii) la precisazione di significato di `selected_candidate_id`
resa vincolante (§3, §6b — mai esercitata in 0.5.4, quindi non-breaking di
fatto ma dichiarata).

---

## 1. SCHEMA COMPLETO 0.6.0

### 1.0 Selezione di versione (DECISIONE_CONSUMATORI_01)

Campo di request NUOVO `contract_version`, opzionale, enum `"0.5.4" | "0.6.0"`:

| request | ramo eseguito | output |
|---|---|---|
| `contract_version` ASSENTE | **legacy 0.5.4** | risposta 0.5.4 tale e quale (incluso `schema_version: "norms-resolver-service/0.5.0"`) |
| `contract_version: "0.5.4"` | **legacy 0.5.4** | **bit-identico al caso assente** (§6b-C1) |
| `contract_version: "0.6.0"` | 0.6.0 | risposta 0.6.0 (§1.2) |

Regole:
- SOLO il ramo 0.6.0 può produrre: `DOUBLE_PUB_IDENTICAL`, la promozione
  temporale (`PUBLIC_RESOLVED` con `as_of`), `resolution_outcome`,
  `segnalazione` e ogni altro campo nuovo. Il ramo legacy non li produce MAI.
- La forma `reference` è ammessa SOLO con `contract_version: "0.6.0"`; una
  request con `reference` e versione assente o `"0.5.4"` è rifiutata
  (`RESOLVER_REQUEST_INVALID`): il default legacy non acquisisce capacità
  nuove per via implicita.
- Il default legacy NON cambia senza un successivo atto esplicito di
  deprecazione (fuori da questo contratto).

**Risoluzione della collisione con `additionalProperties: false` (C1).**
Il vincolo `additionalProperties: false` è applicato dal VALIDATORE DEL
SERVER, non dai client: lo schema 0.5.4 pubblicato non viene modificato. Il
server 0.6.0 valida ogni request contro il NUOVO schema di request 0.6.0
(anch'esso `additionalProperties: false`), le cui properties sono: le sei
0.5.4 + `contract_version` + `reference`, con le regole condizionali sopra.
Il layer di routing CONSUMA `contract_version` (lo rimuove) PRIMA di passare
la request effettiva al ramo selezionato: il ramo legacy riceve una request
byte-identica a quella del caso "versione assente" e la valida contro lo
schema 0.5.4 originale, intatto. Limite transitorio dichiarato: un SERVER
0.5.4 ancora in esercizio rifiuta `contract_version`
(`RESOLVER_REQUEST_INVALID`) — dichiarare la versione ha senso solo verso un
server ≥0.6.0; i client che non dichiarano nulla non se ne accorgono mai.

**Prova di identità (A ≡ B), verificabile.** "Versione assente" e
`contract_version: "0.5.4"` producono output BIT-IDENTICO perché: (i) il
routing rimuove il campo prima del ramo legacy → request effettiva identica;
(ii) il ramo legacy è lo stesso codice congelato in entrambi i casi; (iii)
nessun dato del routing entra nella risposta. La bit-identità si intende a
parità di request effettiva e di codice: gli elementi NON deterministici di
qualunque chiamata live (timestamp, durate, byte acquisiti dalla fonte)
variano tra due chiamate qualsiasi — anche tra due casi "versione assente" —
e sono quindi fuori dal claim. Verifica prescritta nella suite (§7):
acquisizione simulata (fixture), stessa request nei due casi, confronto
byte-per-byte delle due risposte: DEVONO coincidere. Se l'implementazione non
riuscisse a renderle identiche, è un problema aperto da dichiarare (§9), non
da nascondere.

### 1.1 Request

| campo | tipo | obbl. | origine |
|---|---|---|---|
| `citation` | string 1..2048 | oneOf (esattamente uno dei tre) | EREDITATO |
| `official_url` | string uri ≤4096, allowlist+anti-SSRF | oneOf | EREDITATO |
| `reference` | object `{scheme: string (es. "urn:nir"), value: string 1..2048, granularity?: object}` | oneOf — SOLO con `contract_version: "0.6.0"` | **NUOVO** |
| `contract_version` | enum `"0.5.4"` \| `"0.6.0"` | opzionale (assente = ramo legacy, §1.0) | **NUOVO** |
| `jurisdiction` | string `^[A-Z]{2,8}$` | obbligatorio | EREDITATO |
| `as_of` | string date (data civile reale) | opzionale | EREDITATO |
| `source_requirements` | object `{minimum_independent_official_sources: int 1..4, require_primary_official: bool}` | obbligatorio | EREDITATO |
| `request_id` | string `^[A-Za-z0-9._:-]{1,128}$` | obbligatorio | EREDITATO |

`additionalProperties: false` (schema di request 0.6.0, §1.0). `reference`
estende il `oneOf` da due a tre membri: è la via URN-addressed della terza
gamba (permette la propagazione di `as_of` come `!vig=` che il percorso
`citation` oggi non ha) ed esige `contract_version: "0.6.0"` esplicito. La
selezione di versione è IN-BAND (`contract_version`, §1.0); `GET /healthz`
resta come sola diagnostica della versione del server.

### 1.2 Response 200 — SOLO ramo `contract_version: "0.6.0"`

Il ramo legacy (versione assente o `"0.5.4"`) emette la risposta 0.5.4 tale e
quale, senza NESSUNO dei campi nuovi e con `schema_version:
"norms-resolver-service/0.5.0"` invariato. Tutto ciò che segue in §1.2
descrive esclusivamente il ramo 0.6.0.

**Campi EREDITATI — tutti presenti, forma e semantica 0.5.4 invariate:**

| campo | tipo | note 0.6.0 |
|---|---|---|
| `schema_version` | string | valore aggiornato a `"norms-resolver-service/0.6.0"` (nessun consumatore 0.5.4 lo legge nei gate: additivo di fatto) |
| `request_id` | string echo | invariato |
| `canonical_citation` | object (11 fields, official_identifiers ELI/CELEX/URN, missing_fields, canonical_id) | invariato; per reference URN: `article` dal `~artN`; il comma della terza gamba mappa su `paragraph` con trasformazione dichiarata (vedi §2.6 nota granularità) |
| `acquisition_receipts` | array receipt (21 campi) | invariato; i receipt della via terza-gamba sono prodotti dall'envelope di cattura (url, httpStatus, byte_sha256, timestamp) |
| `evidence_sources` | object `{sources[], independent_official_source_count, source_independence_score, duplicate_fingerprint_groups, provider_errors, searched_scope_absence_is_not_nonexistence}` | invariato; le entry `sources[i]` acquistano UNA chiave nuova opzionale (sotto) |
| `matching` | `{classification, resolution_status, selected_candidate_id}` | invariato nella forma; `resolution_status` con UN valore nuovo di enum (§5.2); significato di `selected_candidate_id` precisato e reso vincolante (§3.2) |
| `temporal_evidence` | array (8 campi/elemento) | invariato; 0.6.0 lo POPOLA finalmente: `verified_as_of`, `effective_from`, `effective_until_exclusive`, `status=VERIFIED_APPLICABLE` diventano producibili (§2.3) |
| `corroboration` | object (duplicato di evidence_sources) | invariato |
| `contradiction_ledger` | array<string> | invariato nel tipo; enum AMPLIATO con `SOURCE_CONTENT_CONTRADICTION` (§5.3) |
| `blocking` | array<string> | invariato nel tipo e nella semantica di gate (non vuoto → bloccato); enum AMPLIATO (§3.3, §5) — ampliare `blocking` è additivo nella direzione sicura: un client vecchio può solo bloccare di più, mai di meno |
| `unknown` | array<string> | invariato |
| `unexamined` | array<string> | invariato |
| `audit_level` | `DOCUMENT_ONLY`\|`PUBLIC_RESOLVED` | invariato nei valori; regola di promozione ESTESA (§3.4) |
| `ready_for_norms` | bool | invariato |
| `evidence_package` | object | invariato + chiavi nuove additive: `evidence_records[]` (le Evidence integrali della terza gamba, hash-vincolate), `publication_variants`, `segnalazione` (specchi dei top-level); `evidence_package_schema` → `norms-live-resolution/0.5.0` (§9-P3) |
| `package_canonical_json` / `package_sha256` | string / hex64 | invariati (stessa proiezione canonica; i campi nuovi del package vi entrano) |
| `resolution_fingerprint` | hex64 | invariato (stessa proiezione semantica) |
| `metrics` | object | invariato (`public_resolved_blockers` resta, per continuità) |

**Chiave nuova dentro struttura ereditata:**

| campo | tipo | obbl. | origine |
|---|---|---|---|
| `evidence_sources.sources[i].authority_pointer` | string \| null | opzionale | **NUOVO** — l'estremo GU visibile nella vista sources (da Evidence.provenance/variants; per i provider 0.5.4 derivabile da `official_gazette_number`+`publication_date` quando presenti) |

**Campi top-level NUOVI in 0.6.0:**

| campo | tipo | obbl. | contenuto |
|---|---|---|---|
| `segnalazione` | string non vuota | **OBBLIGATORIO, sempre** | canale testo umano non sopprimibile (§2.5) |
| `resolution_outcome` | object `{status: RESOLVED_MATCH\|RESOLVED_DIVERGENT\|UNRESOLVABLE, unresolvable_reason?: enum(10), coexistence_kind?: DOUBT\|MULTIVIGENZA\|SOURCE_CONTRADICTION\|DOUBLE_PUB_IDENTICAL, coexistence_at_granularity?: string, requested_granularity?: object}` | **OBBLIGATORIO** | l'esito della terza gamba SENZA reinterpretazione: canale nuovo, non sovrapposto a `matching` (§2.6, §3) |
| `publication_variants` | array `[{authority_pointer: string, validity_window: {from: date\|null, to: date\|null, end_declared_open: bool}, content_sha256: hex64, consultable_at?: string}]` | opzionale (presente quando la fonte ha restituito varianti) | le variants[] Evidence, NESSUNA eletta, ordine della fonte (§2.1) |
| `resolution_provenance` | object `{source: string, urn: string\|null, eli: string\|null, resolved_at: iso8601, response_sha256: hex64\|null, authority_pointer: string}` | obbligatorio quando l'esito proviene dalla via terza-gamba; null altrimenti | la Provenance Evidence integrale e VISIBILE (§2.2) — `response_sha256: null` ammesso solo per "nessuna risposta ricevuta" |
| `temporal_selection` | object `{selection: APPLIED\|NOT_APPLIED, basis?: {requested_date: date, applied_via: string, declared_window: {start: date, end: date\|null, end_declared_open: bool}}}` | **OBBLIGATORIO** | onestà temporale esplicita (§2.3); `basis` obbligatorio sse APPLIED |
| `completeness` | object `{state: COMPLETENESS_UNATTESTED\|DECLARED_COMPLETE, basis?: {level, internal_strength?, external_authority?}}` | **OBBLIGATORIO** | invariante-completezza (§2.4); default UNATTESTED |
| `candidate_blockers` | array `[{code: string, candidate_id: string\|null}]` | obbligatorio (può essere `[]`) | la risalita dei blocker per-candidato (§4) |

### 1.3 Errori

Ereditati invariati (stessi codici, status, forma `{"error":{"code","message?"}}`):
`JSON_INVALID` 400, `RESOLVER_REQUEST_INVALID` 400, `RESOLVER_AS_OF_INVALID`
400, `RESOLVER_URL_REJECTED` 400, `REQUEST_ID_INVALID` 400,
`REQUEST_SIZE_INVALID` 413, `CONTENT_TYPE_INVALID` 415,
`RESOLVER_INTERNAL_ERROR` 500, `CONCURRENCY_LIMIT` 503, `NOT_FOUND` 404.
NUOVO: `RESOLVER_REFERENCE_INVALID` 400 (campo `reference` malformato:
scheme non supportato, value non parsabile). Regola ereditata e confermata: i
fallimenti di rete/provider NON sono errori HTTP — degradano a receipt/esito
tipizzato dentro un 200 (fail-closed applicativo, §5).

---

## 2. RAPPRESENTAZIONE SENZA PERDITA — I SEI ELEMENTI

### 2.1 `publication_variants[]` ← Evidence.variants[]

| Evidence | 0.6.0 | trasformazione |
|---|---|---|
| `variants[i].authorityPointer` | `publication_variants[i].authority_pointer` | identità |
| `variants[i].validityWindow.from` | `.validity_window.from` | identità (inclusivo, com'è) |
| `variants[i].validityWindow.to` | `.validity_window.to` | identità (inclusivo; NESSUNA conversione a esclusivo in questo campo nuovo) |
| distinzione fine-aperta (99999999) vs fine-non-dichiarata (0) | `.validity_window.end_declared_open` | bool esplicito: `true` = la fonte dichiara fine aperta; `false` con `to: null` = fine NON dichiarata. La distinzione che collassava su null è preservata |
| `variants[i].contentHash` | `.content_sha256` | identità |
| (consultableAt dell'Evidence) | `.consultable_at` | facoltativo, "mai prova" (semantica dichiarata nel contratto) |

Nessuna variante eletta: l'array è integrale, nell'ordine della fonte.
Dichiarazione: mappatura SENZA perdita.

### 2.2 `authorityPointer` visibile nel claim ← Evidence.provenance

Tre slot, in ordine di visibilità: (i) `resolution_provenance.authority_pointer`
(top-level, obbligatorio sulla via terza-gamba — anche `NO_GU_POINTER` quando
la fonte non ha restituito estremi); (ii) `publication_variants[].authority_pointer`
(per variante); (iii) `evidence_sources.sources[i].authority_pointer` (chiave
nuova opzionale nella vista ereditata, così anche un consumatore che legge solo
`sources` lo vede). Il rapporto segnalava la perdita nel claim a 6 campi: 0.6.0
la chiude su tutti e tre i livelli. SENZA perdita.

### 2.3 `temporal_selection` ← temporalSelection + temporalBasis

Canale esplicito nuovo (tabella in §1.2): `selection` e `basis` sono la copia
1:1 del contratto Evidence, incluso `end_declared_open`. SENZA perdita.

In più, DOPPIO BINARIO verso il canale ereditato `temporal_evidence[]`, perché
lo stato applicabile-alla-data diventi finalmente raggiungibile anche per i
consumatori 0.5.4:
- `APPLIED` → elemento con `status: VERIFIED_APPLICABLE`,
  `verified_as_of = basis.requested_date`,
  `effective_from = declared_window.start`,
  `effective_until_exclusive = declared_window.end + 1 giorno` (trasformazione
  dichiarata inclusivo→esclusivo; `null` se end aperta/non dichiarata — la
  distinzione vive in `temporal_selection.basis.end_declared_open` e nel
  fragment di `evidence[]`), `version_type: AS_OF`,
  `current_distinguished_from_historical: true`, `evidence[]` con
  `extraction_method = basis.applied_via` e il frammento-finestra.
- `NOT_APPLIED` → `status: UNVERIFIABLE` (idioma già usato da 0.5.4 per
  l'as_of registrato-ma-non-verificato): la data resta registrata, mai
  spacciata per selezione.
Il binario ereditato è una PROIEZIONE (perde `end_declared_open`); il canale
nuovo è la verità integrale. Dichiarazione: senza perdita nel canale nuovo;
proiezione dichiarata nel canale ereditato.

### 2.4 `completeness` ← completeness + completenessBasis

Copia 1:1 degli enum e della regola di soglia della terza gamba:
`DECLARED_COMPLETE` ammesso SOLO con basis a soglia (INTERNAL_RECONCILIATION/
CHECKSUM oppure EXTERNAL_CROSS_CHECK con autorità DIVERSA dall'autorità
primaria); un basis debole è allegabile solo a `COMPLETENESS_UNATTESTED` senza
alzare il claim. REGOLA DI LETTURA nel contratto: nessun consumatore può
inferire completezza da un match; `audit_level: PUBLIC_RESOLVED` NON è un
claim di completezza (frase normativa nel testo del contratto). SENZA perdita.

### 2.5 `segnalazione` — canale umano OBBLIGATORIO e non sopprimibile

- Presente in OGNI risposta 200, stringa non vuota — anche negli esiti pieni
  (`PUBLIC_RESOLVED` incluso) e negli esiti vuoti (`sources: []`).
- Composizione: la segnalazione dell'Evidence (che già include per costruzione
  la clausola temporale APPLIED/NOT_APPLIED) + eventuali clausole del livello
  resolver (es. coesistenza, blocker propagati §4). Concatenazione, mai
  sostituzione.
- Non spegnibile PER CONTRATTO: un server 0.6.0 che ometta `segnalazione` è
  non conforme; la validazione di risposta (novità di processo: 0.5.4 non
  valida l'output, 0.6.0 SÌ — §7) la rende strutturale.
- Copertura della garanzia (rev. 2): il ramo legacy non emette esiti nuovi,
  quindi non esiste il caso "esito nuovo senza segnalazione visibile". Sul
  ramo 0.6.0 la visibilità è garantita dal gate di attivazione: la
  `resolutionView` del worker DEVE proiettare le mandatory notices PRIMA che
  il worker dichiari `contract_version: "0.6.0"` (§6b, §7). P1 chiuso da
  DECISIONE_CONSUMATORI_01 (§9).

### 2.6 Motivi tipizzati — tutti e 10 gli `unresolvableReason`

`resolution_outcome.unresolvable_reason` accoglie l'enum COMPLETO della terza
gamba, senza rimappature distruttive:

| unresolvableReason | rappresentabile in 0.5.4? | slot 0.6.0 |
|---|---|---|
| `SOURCE_GRANULARITY_UNSUPPORTED` | no | passa tale e quale; `requested_granularity` documenta cosa era stato chiesto |
| `SOURCE_GRANULARITY_TRUNCATED` | no | tale e quale |
| `SOURCE_COMPLETENESS_UNATTESTED` | no | tale e quale |
| `SOURCE_DATE_OUT_OF_RANGE` | no (collassava in not-found) | tale e quale + `resolution_status` nuovo dedicato (§5.2): MAI not-found |
| `ADAPTER_UNSUPPORTED_REFERENCE` | parziale | tale e quale |
| `SOURCE_REJECTED_REFERENCE` | parziale | tale e quale (+ receipt con http_status) |
| `SOURCE_ERROR` | `PROVIDER_ERROR` | tale e quale (il receipt porta il dettaglio) |
| `SOURCE_UNREACHABLE` | `TEMPORARILY_UNAVAILABLE` | tale e quale |
| `SOURCE_RESPONSE_UNINTERPRETABLE` | `INVALID_CONTENT` | tale e quale |
| `SOURCE_NO_RESOLUTION` | `NOT_FOUND_IN_FETCHED_SCOPE` | tale e quale, con la semantica ereditata `searched_scope_absence_is_not_nonexistence: true` sempre affiancata |

Nota granularità: il comma della terza gamba mappa su
`canonical_citation.fields.paragraph` con trasformazione dichiarata
(comma→paragraph); `resolution_outcome.requested_granularity` conserva la
forma originale (`{article, comma}`) senza perdita.

---

## 3. REGOLA ANTI-DEGRADO

### 3.1 La distinzione fondante

- **Pluralità documentata** = più pubblicazioni della STESSA identità d'atto
  (stessa firma su act_type/number/date/article/jurisdiction), ciascuna con
  provenienza propria (estremo GU), finestra dichiarata e hash del contenuto.
  È un esito LEGITTIMO: tutte riportate in `publication_variants[]`, nessuna
  eletta, `resolution_outcome` tipizzato. NON è ambiguità.
- **Ambiguità irrisolta** = ≥2 identità d'atto DISTINTE che soddisfano la
  citazione (atti diversi). Resta il caso 0.5.4: `classification: AMBIGUOUS`,
  bloccato. Invariato.

Regola formale: la coesistenza di varianti vive SOTTO il candidato, mai come
candidati concorrenti. È VIETATO (per contratto) rappresentare varianti di
pubblicazione come candidati distinti di matching.

### 3.2 `selected_candidate_id` — significato precisato e vincolante

`selected_candidate_id` seleziona l'IDENTITÀ DELL'ATTO che risolve la
citazione — MAI la variante di pubblicazione che fa fede. In 0.5.4 questa
distinzione non è mai stata esercitata (il provider Normattiva non produce
varianti: un candidato per atto — fatto accertato nel rapporto), quindi la
precisazione non cambia alcun comportamento osservabile passato: è una
clausola nuova resa vincolante, dichiarata in §6b come punto critico, non
nascosta.

### 3.3 Mappa dei quattro coexistenceKind

| coexistenceKind | resolution_outcome.status | matching (ereditato) | blocking | audit_level max |
|---|---|---|---|---|
| `DOUBLE_PUB_IDENTICAL` (stessa finestra, testo identico) | `RESOLVED_MATCH` | `EXACT` possibile (identità unica) | nessun codice aggiunto | `PUBLIC_RESOLVED` raggiungibile (§3.4) |
| `MULTIVIGENZA` (finestre distinte compatibili) | `RESOLVED_DIVERGENT` | classificazione d'identità invariata (l'atto è identificato) | + `RESOLUTION_DIVERGENT_COEXISTENCE` | `DOCUMENT_ONLY` |
| `DOUBT` (almeno una finestra non dichiarata) | `RESOLVED_DIVERGENT` | idem | + `RESOLUTION_DIVERGENT_COEXISTENCE` | `DOCUMENT_ONLY` |
| `SOURCE_CONTRADICTION` (stessa finestra, testi diversi) | `RESOLVED_DIVERGENT` | idem | + `SOURCE_CONTRADICTION`; ledger + `SOURCE_CONTENT_CONTRADICTION` (§5.3) | `DOCUMENT_ONLY` |

I codici nuovi in `blocking` rendono i tre casi divergenti FAIL-CLOSED anche
per un consumatore fermo a 0.5.4 (che vede `blocking` non vuoto → RESOLUTION_BLOCKED):
il degrado semantico è evitato per i consumatori nuovi (che leggono
`resolution_outcome` + `publication_variants`) e il consumatore vecchio è
protetto per difetto, mai illuso.

### 3.4 Regola di promozione estesa — SOLO ramo 0.6.0

Sul ramo `contract_version: "0.6.0"`: `PUBLIC_RESOLVED` sse: identità unica
EXACT **e** ledger vuoto **e** blocking vuoto **e**
`coexistence_kind ∈ {assente, DOUBLE_PUB_IDENTICAL}` **e** — se la richiesta
porta `as_of` — `temporal_selection.selection = APPLIED`.
Effetti: (i) la doppia stampa VERIFICATA non è più un degrado (il fatto
§k-quater sopravvive); (ii) con `as_of`, PUBLIC_RESOLVED diventa
RAGGIUNGIBILE (oggi impossibile) e al tempo stesso PIÙ ESIGENTE (pretende la
selezione per data provata sul fatto-finestra).
Il ramo legacy conserva INTATTA la regola 0.5.4
(`PUBLIC_RESOLVED_IFF_SINGLE_IDENTITY_FOUND_EXACT_AND_NO_CONTRADICTIONS`):
nessun esito legacy cambia distribuzione. La promozione estesa vive solo sul
ramo opt-in dichiarato: P2 chiuso da DECISIONE_CONSUMATORI_01 (§9). Il TESTO
della regola è RATIFICATO VERBATIM da
RATIFICA_NORMS_RESOLVER_0_6_0_REV_2_01 (2026-08-11, blocco di ratifica in
testa al documento).

---

## 4. PROPAGAZIONE DEI BLOCKER PER-CANDIDATO

Fatto 0.5.4: `BLOCKING_<FIELD>_UNKNOWN`, `BLOCKING_OFFICIAL_EVIDENCE_INSUFFICIENT`,
`BLOCKING_CORROBORATION_INSUFFICIENT`, `BLOCKING_TEMPORAL_VERSION_NOT_VERIFIED`
restano in `candidate_evaluations[].found_exact_blockers` e in
`metrics.public_resolved_blockers`: `blocking: []` non significa nessun ostacolo.

Disegno 0.6.0 — campo nuovo top-level:

```
candidate_blockers: [ { code: string, candidate_id: string | null } ]
```

- Aggregazione: unione deduplicata e ordinata di TUTTI i
  `found_exact_blockers` di ogni candidato + gli status di
  `retrieval_limitations` (con `candidate_id: null` per i limiti non
  attribuibili a un candidato).
- SEPARATO da `blocking` (ereditato): mettere i blocker per-candidato dentro
  `blocking` cambierebbe la semantica di gate del campo ereditato (risposte
  oggi passanti diventerebbero bloccate) — violazione di additività. Il campo
  nuovo informa; `blocking` continua a governare il gate come in 0.5.4.
- Obbligatorio, anche vuoto (`[]`): l'assenza di ostacoli si dichiara, non si
  deduce dal silenzio.
- La `segnalazione` DEVE menzionare in chiaro la presenza di
  candidate_blockers non vuoti (clausola resolver, §2.5).
- `metrics.public_resolved_blockers` resta per continuità (duplicazione
  dichiarata, non contraddizione).

---

## 5. FAIL-CLOSED — I TRE CASI (obblighi del ramo `contract_version: "0.6.0"`; il ramo legacy conserva gli esiti 0.5.4 tali e quali)

### 5.1 `sources: []` (discovery senza candidati)

- `resolution_outcome`: `{status: UNRESOLVABLE, unresolvable_reason: SOURCE_NO_RESOLUTION}`
  (via terza-gamba) oppure assente-motivato per la sola via discovery 0.5.4
  (che non produce Evidence): in quel caso `resolution_outcome.status: UNRESOLVABLE`
  con `unresolvable_reason: SOURCE_NO_RESOLUTION` derivato dalla condizione
  "nessun candidato".
- Ereditati invariati: `resolution_status: NOT_FOUND_IN_SEARCHED_SCOPE` (la cui
  semantica contrattuale 0.5.4 è già "solo nello scope cercato" —
  `negative_evidence_semantics: NOT_FOUND_IN_SEARCHED_SCOPE_ONLY`),
  `blocking: [SOURCE_DISCOVERY_REQUIRED, …]`,
  `searched_scope_absence_is_not_nonexistence: true`.
- OBBLIGO NUOVO — FORMULA CANONICA PINNATA NEL CONTRATTO (ramo 0.6.0): la
  `segnalazione` contiene ESATTAMENTE, come primo periodo, la stringa:

  > "Il resolver non ha individuato candidati nel perimetro di ricerca
  > dichiarato per questo riferimento e, se indicata, questa data.
  > Questo esito non dimostra l'assenza della norma nell'ordinamento."

  La stringa è parte normativa del contratto (non un esempio): un server che
  la ometta o la alteri in questo esito è non conforme. Clausole aggiuntive
  possono seguire, mai sostituire. `resolution_provenance` presente se un
  tentativo è stato fatto (anche con `response_sha256: null` = nessuna
  risposta ricevuta).
- MAI un esito "non esiste": né nei campi, né nel testo.

### 5.2 Data fuori intervallo — `SOURCE_DATE_OUT_OF_RANGE` preservato

- `resolution_outcome`: `{status: UNRESOLVABLE, unresolvable_reason: SOURCE_DATE_OUT_OF_RANGE}` — tale e quale.
- `matching.resolution_status`: valore di enum NUOVO
  `DATE_OUT_OF_REACHABLE_RANGE` — MAI collassato in
  `NOT_FOUND_IN_SEARCHED_SCOPE`. (Precedente fattuale: 0.5.4 già emette valori
  fuori enum per sovrascrittura live — qui l'ampliamento è dichiarato e
  versionato invece che implicito; impatto schema in §9-P3.)
- `temporal_selection: {selection: NOT_APPLIED}`; la finestra-stub degenere
  resta nei dettagli dell'Evidence (in `evidence_package.evidence_records[]`),
  mai promossa a finestra vera.
- `segnalazione` obbligatoria: "la data richiesta precede l'inizio di vigenza
  dichiarato / è fuori dall'intervallo raggiungibile — nessun giudizio oltre
  questo intervallo". Provenienza sempre presente.

### 5.3 Contraddizione tra fonti — `SOURCE_CONTRADICTION` esprimibile

- `resolution_outcome`: `{status: RESOLVED_DIVERGENT, coexistence_kind: SOURCE_CONTRADICTION}`.
- `contradiction_ledger`: enum AMPLIATO con **`SOURCE_CONTENT_CONTRADICTION`**
  (stessa finestra dichiarata, contenuti diversi) — il ledger 0.5.4 copriva
  solo i mismatch identità-citazione (`BLOCKING_<FIELD>_MISMATCH`); il tipo
  resta array<string>, quindi l'ampliamento è additivo e un consumatore 0.5.4
  reagisce correttamente (ledger non vuoto → bloccato).
- `blocking`: + `SOURCE_CONTRADICTION`.
- `publication_variants[]`: TUTTI i testi in contrasto riportati con finestra,
  hash e puntatore — nessuno scelto.
- `segnalazione` obbligatoria: "la fonte restituisce N testi diversi per la
  stessa finestra dichiarata: contraddizione della fonte; nessun testo scelto".
- Fail-closed: `ready_for_norms: false`, `audit_level: DOCUMENT_ONLY`.

---

## 6. MATRICE DI COMPATIBILITÀ — BIDIREZIONALE

### 6a. 0.5.4 → 0.6.0 (dove finisce ogni campo/esito 0.5.4)

| campo/esito 0.5.4 | destino in 0.6.0 |
|---|---|
| tutti i 18 campi top-level | presenti, stessa forma e semantica (§1.2) |
| `schema_version` | stesso campo, valore nuovo |
| enum `classification` (EXACT/PROBABLE/AMBIGUOUS/REJECTED) | invariati, stessi criteri |
| enum `resolution_status` | invariati + `DATE_OUT_OF_REACHABLE_RANGE` |
| `selected_candidate_id` | invariato, significato precisato (identità d'atto, mai variante) |
| regola di promozione `PUBLIC_RESOLVED_IFF_SINGLE_IDENTITY_FOUND_EXACT_AND_NO_CONTRADICTIONS` | INTATTA sul ramo legacy; estesa SOLO sul ramo 0.6.0 (§3.4) |
| `contradiction_ledger` codici | invariati + `SOURCE_CONTENT_CONTRADICTION` |
| `blocking` codici (10) | invariati + `RESOLUTION_DIVERGENT_COEXISTENCE`, `SOURCE_CONTRADICTION` |
| blocker per-candidato | restano dove sono + risalgono in `candidate_blockers` (§4) |
| receipt/snapshot/package/hashing | invariati; package con chiavi additive e schema-version proprio aggiornato |
| errori HTTP | invariati + `RESOLVER_REFERENCE_INVALID` |
| esito `sources: []` | invariato + obblighi nuovi (segnalazione, outcome tipizzato) |

### 6b. MATRICE DI VERSIONE (rev. 2, DECISIONE_CONSUMATORI_01) — il default legacy è protetto

| riga | (A) versione ASSENTE | (B) `contract_version: "0.5.4"` | (C) `contract_version: "0.6.0"` |
|---|---|---|---|
| semantica eseguita | **legacy 0.5.4 congelata** | **legacy 0.5.4 congelata** (routing consuma il campo, poi identico ad A) | 0.6.0 (anti-degrado, fail-closed nuovi) |
| schema restituito | 0.5.4 tale e quale (`schema_version: …/0.5.0`) | **bit-identico ad (A)** — prova C1 in §1.0 | 0.6.0 integrale |
| `resolution_outcome` | assente | assente | presente |
| mandatory notices (`segnalazione`) | assenti (il ramo legacy non produce esiti che le richiedano) | assenti | presenti nel body E visibili: l'attivazione del ramo è gated sull'aggiornamento di `resolutionView` (sotto) |
| `DOUBLE_PUB_IDENTICAL` producibile | **NO, mai** | **NO, mai** | sì (via `reference`/terza gamba) |
| promozione temporale (`PUBLIC_RESOLVED` con `as_of`) | **NO, mai** (regola 0.5.4 intatta: di fatto irraggiungibile, com'è oggi) | **NO, mai** | sì, con la regola §3.4 |
| comportamento `resolutionView` | invariato (nulla di nuovo da proiettare) | invariato | **prerequisito di attivazione**: `resolutionView` DEVE proiettare segnalazione, resolution_outcome, publication_variants, resolution_provenance, temporal_selection, completeness, candidate_blockers PRIMA che il worker dichiari `"0.6.0"`. Un worker non aggiornato semplicemente non dichiara la versione e resta in (A) |

Conseguenza per il rischio P1 (com'era in rev. 1): il caso "esito nuovo
ricevuto da un client che non lo proietta" NON può più verificarsi — un
client che non dichiara `"0.6.0"` non riceve MAI esiti nuovi (A e B), e chi
dichiara `"0.6.0"` lo fa, per contratto, solo dopo aver esteso la propria
proiezione. La retrocompatibilità non dipende più dall'ignorare-campi-ignoti:
dipende dal routing, verificabile con la prova di identità C1.

Vincoli tecnici che restano validi sul ramo (C): `boundedJson` 2 MiB (§7);
gate hash del worker (`packageHashProjection` riproietta il package INTEGRALE,
chiavi nuove comprese → la proiezione canonica del server DEVE includerle);
enum `resolution_status` ampliato (un client con switch esaustivo va
aggiornato prima di dichiarare `"0.6.0"`); `blocking` ampliato solo su (C),
nella direzione sicura (più blocchi, mai meno).

**PUNTO CRITICO (dichiarato, non nascosto): `selected_candidate_id` /
`matching` in presenza di `publication_variants[]` — solo ramo (C).**
Se le varianti fossero rappresentate come candidati, `selected_candidate_id`
diventerebbe elezione della variante → breaking semantico del campo ereditato
e violazione del principio di non-elezione. La strategia scelta NON è
deprecare il campo ma VINCOLARLO: (i) divieto contrattuale di modellare
varianti come candidati (§3.1); (ii) `selected_candidate_id` = identità d'atto
(§3.2); (iii) le varianti vivono SOLO in `publication_variants[]`. Con questo
vincolo l'additività regge; senza, 0.6.0 sarebbe breaking: il vincolo è parte
NORMATIVA del contratto. Il residuo di rev. 1 (consumatore 0.5.4 che riceve
un match di doppia stampa senza vederne la coesistenza) è ELIMINATO alla
radice: quell'esito non raggiunge mai chi non dichiara `"0.6.0"`.

---

## 7. IMPATTO (elencato, NON eseguito)

- **Manifest/config del worker**: nessun binding nuovo; bump di versione server
  MCP (`0.2.2` → successiva) alla adozione; nessuna migrazione DO.
- **tools/list (schema dei tool)**: `resolve_normative_evidence` e
  `audit_normative_reliance` — lo zod `locator` acquisisce `contract_version`
  e il membro `reference`; SEQUENZA DI ATTIVAZIONE VINCOLATA
  (DECISIONE_CONSUMATORI_01): (1) estendere `resolutionView` ai campi nuovi
  (segnalazione, resolution_outcome, publication_variants,
  resolution_provenance, temporal_selection, completeness, candidate_blockers);
  (2) SOLO DOPO, il worker inizia a dichiarare `contract_version: "0.6.0"`.
  Finché non dichiara, tutto resta legacy per costruzione.
- **Suite di test da estendere**: `test/resolver-client.mjs` (risposta 0.6.0 e
  campi nuovi), `test/end-to-end-tools.mjs` (fixture 0.6.0: promozione estesa,
  gate hash con package esteso, esiti divergenti fail-closed), test container
  (`norms-document-pipeline`: validazione OUTPUT — novità: 0.5.4 non valida la
  risposta in uscita, 0.6.0 introduce il validatore di risposta sul solo ramo
  nuovo), contratto JSON nuovo `resolver-service-contract-0.6.0.json` con
  `response_required` esteso E tipi strutturati (il 0.5.0 è una lista piatta
  di nomi); **TEST DI IDENTITÀ C1 obbligatorio**: stessa request con e senza
  `contract_version: "0.5.4"`, acquisizione simulata, risposte byte-identiche;
  **test di congelamento legacy**: le fixture 0.5.4 esistenti devono passare
  INVARIATE sul ramo legacy del server 0.6.0; suite norms-db-verify invariate
  (il contratto Evidence non cambia).
- **Dimensioni**: `publication_variants` + `evidence_records` crescono il body;
  vincolo client 2 MiB (`RESOLVER_MAX_RESPONSE_BYTES`) da verificare coi casi
  reali (L. 244 ha HTML grandi: gli `evidence_records` portano hash e metadati,
  NON gli HTML integrali — regola di progetto da fissare).
- **Documentazione pubblica**: `NORMS_END_TO_END` (bump 0.2.x→0.3.0),
  `MCP_PUBLIC_TOOL_CONTRACT_01`, `TOOLS.md`, pagine pubbliche del worker se
  descrivono i campi.
- **Privacy**: i campi nuovi espongono SOLO dati pubblici di fonte (estremi GU,
  finestre di vigenza, hash di contenuti normativi pubblici, testo di
  segnalazione generato). Nessun dato personale nuovo. `request_id` resta
  scelto dal chiamante (invariato). Da riflettere in `PRIVACY_POLICY_01` solo
  come descrizione dei campi.
- **Flusso di approvazione pubblica (cosa vede l'utente che cambia)**: (i) la
  segnalazione in chiaro in OGNI risposta; (ii) le varianti di pubblicazione
  elencate, nessuna eletta; (iii) esiti prima assenti: applicabile-alla-data
  (APPLIED), doppia stampa verificata come match, divergenze tipizzate; (iv)
  possibili PIÙ blocchi visibili (fail-closed sui divergenti). Richiede
  ri-passaggio dei gate manuali di submission (OpenAI plugin) se i testi degli
  output cambiano.

---

## 8. PIANO FUTURO (solo disegno)

### 8.1 Preview isolata

Pattern già collaudato nel repo (NORMS_END_TO_END_0.2.0, preview 0.5.x):
- Worker isolato `norms-mcp-e2e-preview` + Container application dedicata
  (es. `norms-resolver-e2e-preview`) con la NUOVA image 0.6.0 a digest
  esplicito; DO namespace dedicato; **workers.dev only, nessuna route, nessun
  custom domain** (analogo al workers.dev usato dalla terza gamba nel round
  resolver, poi chiuso col GATE 0).
- Egress del container invariato: allowlist ufficiale versionata.
- Smoke sulla preview: i tre casi noti della terza gamba su ramo 0.6.0
  (Cost. 117 APPLIED; L. 244 comma 428 troncato; L. 244 doppia pubblicazione
  classificata) + la matrice di versione §6b eseguita dal vivo: un client
  0.5.4 REALE puntato alla preview nei casi (A) e (B) — risposte legacy
  bit-identiche a parità di fixture — e un client aggiornato nel caso (C).
- Evidenza catturata, poi la preview si ELIMINA (regola ereditata: "Preview
  must be deployed separately, smoke-tested, and deleted after evidence
  capture. Production is never a preview rollback target").
- Solo dopo ratifica dei risultati: round di produzione separato, con GO
  esplicito.

### 8.2 Rollback

- **Punto di ritorno dichiarato**: l'image attualmente fissata in produzione
  `registry.cloudflare.com/db9156a9c16c01ee4341b429b2dd448d/norms-resolver@sha256:53b7e3dd47ac93cc67746ef33917631fb05ddfeb2fb3dd760f20df4902caca81`
  (0.5.4), pin nel `wrangler.jsonc` di `norms-mcp` (e nello staging). Questo
  digest È il rollback target.
- 0.6.0 dovrà essere un digest NUOVO e distinto: il rollback è allora un
  revert di sola config (ripristino del campo `image` al digest 0.5.4 +
  deploy), senza rebuild, senza migrazioni DO (0.6.0 non ne introduce), senza
  perdita di dati (R2/DO invariati).
- I consumatori restano compatibili in entrambe le direzioni per costruzione
  additiva (un client aggiornato che rilegge risposte 0.5.4 deve trattare i
  campi nuovi come assenti — requisito di implementazione del client 0.6.0,
  dichiarato).
- Condizioni di ritiro: fallimento dei gate di preview/produzione, crescita
  oltre il limite 2 MiB, o regressione dei consumatori.

---

## 9. PROBLEMI — stato dopo DECISIONE_CONSUMATORI_01 (rev. 2)

### 9.1 CHIUSI da questa decisione

- **P1 — Segnalazione invisibile ai consumatori pre-0.6.0: RISOLTO.**
  Retrocompatibilità obbligatoria + routing di versione: chi non dichiara
  `"0.6.0"` non riceve MAI esiti nuovi (matrice §6b, casi A e B); chi lo
  dichiara ha, per contratto, la `resolutionView` già estesa alle mandatory
  notices (sequenza di attivazione §7). Il caso "esito nuovo senza
  segnalazione visibile" è eliminato alla radice, non mitigato.
- **P2 — Promozione estesa su output pubblico: RISOLTO nel perimetro.**
  La promozione temporale e la doppia stampa promossa vivono SOLO sul ramo
  opt-in `"0.6.0"`; il ramo legacy conserva intatta la regola e la
  distribuzione 0.5.4 (nessun consumatore UNKNOWN vede cambiare nulla senza
  averlo chiesto). Resta in ratifica il TESTO della regola §3.4 come parte del
  contratto nuovo — non più come cambio del comportamento esistente.
- **P5 — Negoziazione di versione: RISOLTO.** `contract_version` in-band
  (§1.0), collisione con `additionalProperties: false` risolta lato
  validatore del server, prova di identità (A)≡(B) prescritta come test
  obbligatorio. Residuo transitorio dichiarato (non decisionale): un server
  0.5.4 ancora in esercizio rifiuta `contract_version`; i client che non
  dichiarano nulla non ne sono toccati.

### 9.2 DECISI con RATIFICA_NORMS_RESOLVER_0_6_0_REV_2_01 (erano aperti)

- **P3 — Versioni degli schemi interni: APPROVATO il bump versionato.**
  Catena di bump (`norms-live-resolution/0.5.0`, matching-schema compatibile,
  validatore di risposta del ramo nuovo). L'incoerenza 0.5.4 preesistente
  (enum `resolution_status` già violato dal live) resta dichiarata qui come
  fatto, senza sanatoria nel ramo legacy congelato. — Interno.
- **P4 — Doppio canale di verità: NESSUNA deprecazione di `matching` in
  questo round.** I due canali coesistono liberi sul ramo 0.6.0; i blocking
  nuovi (§3.3) restano la protezione fail-closed per chi legge solo
  `matching`.
- **P6 — Propagazione `as_of` sul ramo `citation` 0.6.0: APPROVATA.** Con
  `contract_version: "0.6.0"` la forma `citation` propaga l'as_of alla query
  (coerenza del ramo con la via `reference`). Il ramo legacy resta com'è:
  nessun companion fix silenzioso.
- **P7 — Budget dimensionale: DECISO.** `evidence_records` senza HTML
  integrali; si conservano hash e metadati necessari (i byte restano negli
  snapshot content-addressed del container).

### 9.3 Dichiarazione C3 — pubblico-opponibile

Dopo questa correzione, **sul default legacy non resta NULLA di
pubblico-opponibile irrisolto**: i consumatori UNKNOWN continuano a ricevere
esattamente il comportamento e lo schema 0.5.4, congelati e verificati dal
test di identità e dal test di congelamento (§7), finché un successivo atto
esplicito di deprecazione non disponga altrimenti. Con
RATIFICA_NORMS_RESOLVER_0_6_0_REV_2_01 anche P3, P4, P6 e P7 sono decisi:
**il disegno è chiuso e non restano punti aperti che blocchino il round di
codice** — il quale resta comunque NON autorizzato da questa ratifica e
richiede un proprio atto (la ratifica non autorizza codice, build, container,
resolutionView, deploy, binding o variazioni di produzione).

---
*Documento di design, rev. 2 RATIFICATA
(RATIFICA_NORMS_RESOLVER_0_6_0_REV_2_01, 2026-08-11). La ratifica chiude
soltanto il disegno: nessun codice, build, container, resolutionView, deploy,
binding o variazione di produzione è autorizzato da essa.*
