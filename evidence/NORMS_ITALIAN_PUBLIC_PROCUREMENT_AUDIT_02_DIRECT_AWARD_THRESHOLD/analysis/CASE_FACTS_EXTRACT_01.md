# CASE_FACTS_EXTRACT_01

Source: official Determinazione dirigenziale n. 41 of the Camera di Commercio
Industria Artigianato e Agricoltura di Firenze, frozen PDF SHA-256
`322c85d8e0e5f646fbabd6719c470e298af9e34485af4e8ac1c731161deb9d2e`.

Status vocabulary: `VERIFIED_FROM_PRIMARY` means that the fact is stated in
the official act. It does not independently validate every premise of the act.

| Atomic id | Paraphrased fact | Location | Status | Engine input |
|---|---|---|---|---|
| `CASE_ENTITY_01` | The issuing entity is the Camera di Commercio Industria Artigianato e Agricoltura di Firenze. | pp. 1-4 headers | `VERIFIED_FROM_PRIMARY` | authority provenance only |
| `CASE_ACT_01` | The act is determination n. 2024000041 dated 27 January 2024. | p. 1 footer | `VERIFIED_FROM_PRIMARY` | evaluation date |
| `CASE_CONTRACT_TYPE_01` | The contractual object is a supply. | pp. 1, 3 | `VERIFIED_FROM_PRIMARY` | `contract_type=SUPPLY` |
| `CASE_OBJECT_01` | The supply comprises 72 AGM HAZE HZB12-70 batteries for AROS UPS equipment. | pp. 2-3 | `VERIFIED_FROM_PRIMARY` | not required by predicate |
| `CASE_AMOUNT_NET_01` | The offered and awarded amount excluding VAT is EUR 12,816.00. | pp. 2-3 | `VERIFIED_FROM_PRIMARY` | `amount_excluding_vat_eur=12816` |
| `CASE_VAT_01` | VAT is EUR 2,819.52. | p. 3 | `VERIFIED_FROM_PRIMARY` | excluded |
| `CASE_TOTAL_01` | The VAT-inclusive total is EUR 15,635.52. | p. 3 | `VERIFIED_FROM_PRIMARY` | excluded |
| `CASE_MEPA_DATE_01` | A MEPA direct negotiation was activated on 18 January 2024. | p. 2 | `VERIFIED_FROM_PRIMARY` | not required by predicate |
| `CASE_OPERATOR_01` | The named operator is Elettromec s.r.l. of Firenze. | pp. 1-3 | `VERIFIED_FROM_PRIMARY` | excluded |
| `CASE_CIG_01` | The CIG is B007FB331D. | p. 1 | `VERIFIED_FROM_PRIMARY` | case identifier only |
| `CASE_REFERENCE_01` | The act expressly cites D.Lgs. 36/2023, article 50(1)(b). | pp. 1-2 | `VERIFIED_FROM_PRIMARY` | source selection corroboration only |
| `CASE_EXPECTED_01` | The entity adopted an award decision described as direct award. | p. 3, dispositive item 2 | `VERIFIED_FROM_PRIMARY` | **external expected reference only; never engine input** |

The predicate uses the net amount, not the VAT-inclusive total. It does not use
the dispositive, the adopted method, the operator identity, DURC, price
reasonableness, general requirements, rotation, MEPA configuration or any
conclusion made by the entity.
