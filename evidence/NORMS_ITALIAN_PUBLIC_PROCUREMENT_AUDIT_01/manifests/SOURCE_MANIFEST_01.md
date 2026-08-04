# SOURCE_MANIFEST_01

Phase: `NORMS_ITALIAN_PUBLIC_PROCUREMENT_AUDIT_01_SOURCE_AND_CASE_FREEZE`

Acquisition date: 2026-08-04 (UTC timestamps below). Sources were frozen without overwriting pre-existing evidence; the phase directory did not exist at preflight.

## Canonical primary sources

| File | Entity | Official title | Act date | Acquired at (UTC) | Source URL | MIME | Bytes | SHA-256 | HTTP | Nature | Requested temporal version | Error/incompleteness |
|---|---|---|---|---|---|---|---:|---|---:|---|---|---|
| `raw/anac_parere_225_2024.pdf` | ANAC | Parere di precontenzioso n. 225 dell'8 maggio 2024 | 2024-05-08 | 2026-08-04T08:03:38.381Z | `https://www.anticorruzione.it/documents/91439/0/Parere%2Bdi%2BPrecontenzioso%2Bn.%2B225%2Bdel%2B8%2Bmaggio%2B2024.pdf/4e25fdb4-18e7-0601-2dc2-1504b1534aea?t=1716294624257` | application/pdf | 103851 | `e270d6b9983cf11576d40ca4bc4096519b2ad7503529cc8c938c33e7074a5d44` | 200 | PRIMARY | Act as issued | None observed |
| `raw/anac_parere_225_2024_page.html` | ANAC | Parere di precontenzioso n. 225 dell'8 maggio 2024 | 2024-05-08 | 2026-08-04T08:03:38.381Z | `https://www.anticorruzione.it/-/parere-di-precontenzioso-n.-225-del-8-maggio-2024` | text/html; charset=UTF-8 | 183216 | `c020660ace29d36712ae015112f51f74d09081f7e3b13c3983aed4ceb772cd88` | 200 | PRIMARY (official metadata/page) | Current official publication page | HTTP Content-Length not supplied |
| `raw/normattiva_d36_2023_art10_vig_2024-03-04.html` | Presidenza del Consiglio dei ministri / Normattiva | D.Lgs. 31 marzo 2023, n. 36 — art. 10 | 2023-03-31 | 2026-08-04T08:06:28.253Z | `https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2023-03-31;36~art10!vig=2024-03-04` | text/html; charset=UTF-8 | 338398 | `861553fbe139a0acded1bf2714986a024ed93259474389f889ed9bf1546c1958` | 200 | PRIMARY | `vig=2024-03-04` | Page also contains navigation/current-update metadata; selected unit separately extracted |
| `raw/normattiva_d36_2023_art100_vig_2024-03-04.html` | Presidenza del Consiglio dei ministri / Normattiva | D.Lgs. 31 marzo 2023, n. 36 — art. 100 | 2023-03-31 | 2026-08-04T08:06:28.730Z | `https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2023-03-31;36~art100!vig=2024-03-04` | text/html; charset=UTF-8 | 349008 | `20170ea91d03365f2c059f52375b22128dc6e2a6a5c2a300d2b960f42ca0b34f` | 200 | PRIMARY | `vig=2024-03-04` | Page also contains navigation/current-update metadata; selected unit separately extracted |
| `raw/normattiva_d36_2023_allegato_II_12_art18_vig_2024-03-04.html` | Presidenza del Consiglio dei ministri / Normattiva | D.Lgs. 31 marzo 2023, n. 36 — Allegato II.12, art. 18 | 2023-03-31 | 2026-08-04T08:09:57.3681230Z | Normattiva `caricaArticolo` fragment URL recorded in `manifests/normattiva_http_acquisition.json` | text/html; charset=UTF-8 | 22164 | `d73e45a7c2f602a47431f3a5739bfc8660d4fba250daf4bf48c49ea60f1dd8db` | 200 | PRIMARY | Historical index `vig=2024-03-04`; fragment version 1 | Session-bound fragment; provenance includes parent historical index and complete endpoint parameters |

## Accessory official source

| File | Entity | Official title | Act date | Acquired at (UTC) | Source URL | MIME | Bytes | SHA-256 | HTTP | Nature | Requested temporal version | Error/incompleteness |
|---|---|---|---|---|---|---|---:|---|---:|---|---|---|
| `raw/asl_napoli_3_sud_pubblicazione_77_2024.pdf` | ASL Napoli 3 Sud | Pubblicazione n. 77 del 5 luglio 2024 / Deliberazione n. 1036 del 2 luglio 2024 | 2024-07-02 | 2026-08-04T08:05:02.383Z | `https://aslnapoli3sud.it/documents/20121/0/pubblicazione%2Bn.%2B77%2Bdel%2B05.07.2024%2B%281%29.pdf/b2c92cda-dadc-91c1-c36c-f6660c93644b?t=1720511747557` | application/pdf | 143211 | `c249e235172b3a3613f4a0dfc7f3fee3b25f82b7f144fd1e30745483cdd37920` | 200 | ACCESSORY, post-opinion | Act as issued | Used only to corroborate RDO date and subsequent procedural history; not evidence of pre-opinion tender contents |

## Extraction and safety record

- PDF extraction: `pypdf 6.10.2`, non-interactive; no new software installed.
- ANAC PDF: 5 pages, not encrypted. The pypdf structural inspection did not detect `/OpenAction`, additional actions, a names dictionary, embedded-file name tree, or JavaScript name tree.
- ASL PDF: 4 pages, not encrypted. The same inspection did not detect `/OpenAction`, additional actions, embedded-file name tree, or JavaScript name tree.
- No PDF attachment, link, script, action, or embedded content was executed. The PDFs were not opened manually on the host.
- Extracted files: `extracted/anac_parere_225_2024_pypdf.txt`, `extracted/asl_napoli_3_sud_pubblicazione_77_2024_pypdf.txt`, `extracted/normattiva_selected_units_2024-03-04.txt`.
- Machine-readable acquisition/extraction details are in the JSON files under `manifests/`.

## Completeness boundary

No official letter of invitation, tender specification, MEPA/RDO record, platform filter export, exclusion/decision act, or SOA certificate of the applicant was found and frozen in this phase. The ASL is the contracting authority; the phrase "PO di Boscotrecase" identifies the facility/location in the official sources and is not treated as the Comune di Boscotrecase or as a contracting authority.
