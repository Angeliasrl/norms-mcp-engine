# SOURCE_MANIFEST_01

Phase: `NORMS_ITALIAN_PUBLIC_PROCUREMENT_AUDIT_02_DIRECT_AWARD_THRESHOLD_01`

Acquisition: 2026-08-04 10:47:33-10:52:38 Europe/Rome

## Frozen primary sources

| File | Entity | Official title | Act date | URL | MIME | Bytes | SHA-256 | Historical version | HTTP | Extraction |
|---|---|---|---|---|---:|---:|---|---|---:|---|
| `raw/CCIAA_Firenze_Determinazione_41_2024.pdf` | Camera di Commercio Industria Artigianato e Agricoltura di Firenze | Determinazione dirigenziale n. 41 | 2024-01-27 | `https://www.fi.camcom.gov.it/sites/default/files/uploads/Amministrazione_trasparente/Bandi_di_gara/Procedure_lavori_servizi_forniture/2024/Determina%2041-2024.pdf` | `application/pdf` | 149928 | `322c85d8e0e5f646fbabd6719c470e298af9e34485af4e8ac1c731161deb9d2e` | n/a | 200 | pypdf 6.10.2, 4 pages, non-interactive |
| `raw/Normattiva_DLG_36_2023_art_50_vig_2024-01-27.html` | Presidenza del Consiglio dei ministri / Normattiva | Decreto legislativo 31 marzo 2023, n. 36, articolo 50 | 2023-03-31 | `https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2023-03-31;36~art50!vig=2024-01-27` | `text/html; charset=UTF-8` | 344621 | `f1c54224f959c1452b644684903556aa153f0d98459dea3b77fed85f8b475fec` | vigente al 2024-01-27 | 200 | deterministic text segmentation; no script executed |
| `raw/Normattiva_DLG_36_2023_art_229_vig_2024-01-27.html` | Presidenza del Consiglio dei ministri / Normattiva | Decreto legislativo 31 marzo 2023, n. 36, articolo 229 | 2023-03-31 | `https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2023-03-31;36~art229!vig=2024-01-27` | `text/html; charset=UTF-8` | 339603 | `f30ded01e051be81ad6712f6ed660cfe5c83615623fd0c7494d14bb21cc316b7` | vigente al 2024-01-27 | 200 | temporal metadata corroboration only; no script executed |

Both records are primary official sources. The Normattiva response itself
contains `dataVigenza=27/01/2024` and labels the view `vigente al 27/01/2024`.
The raw HTML is retained because Normattiva serves the selected article inside
the official act view. Article 229(2) is frozen only to corroborate the
effectiveness date; it is not a predicate or modeled normative unit. Only
article 50(1)(b) is selected and segmented for the modeled decision.

## Derived files

| File | Derivation | SHA-256 |
|---|---|---|
| `extracted/CCIAA_Firenze_Determinazione_41_2024.txt` | pypdf 6.10.2 page-delimited extraction, trailing whitespace and line endings normalized | `8d74318da6e7ad6eb9adc62debaf8e517d79099d86d57435862520d1e2c538cc` |
| `extracted/Normattiva_DLG_36_2023_art_50_1_b_vig_2024-01-27.txt` | literal segment normalized to plain text | `4e181c6eecc6302b06c9cc92dbe8d71cc58081101642fee756081bc6d0c8b082` |

No software was installed. The PDF was not opened interactively; embedded
content, attachments and links were not executed.
