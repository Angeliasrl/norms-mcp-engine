# norms-mcp-engine

**Version 0.1.0 · experimental prerelease · companion: `CLAIM_MAP.md`**

The admissibility model and claim-map linter, as pure functions. No I/O, no
network, no transport.

> **This is not an MCP server.** It is the engine an MCP server would consume.
> There is no entrypoint, no tool handler and no deployment here. `norms-mcp`,
> the server, does not yet exist as a published artifact. The naming distinction
> is deliberate: claiming a transport that is absent would be exactly the kind of
> overclaim this library exists to make visible.

```bash
npm test    # 73 tests + claim-map sync check; no network, no account required
```

---

## What it does

Computes, for each constant in a normative corpus, its **evidentiary status and
eligibility verdict** — so a consumer can decline to rely on something that is
not currently good for anything. This package computes; it publishes nothing,
because it has no transport.

It enforces nothing. It computes eligibility and reports it. The decision
belongs to whoever is asking.

The Italian word for the property is *opponibile*: something you can assert
against someone, before a third party. *Enforceable* is the wrong translation —
enforcement means somebody applies it. The closest is **admissibility**: whether
a claim holds up when challenged.

---

## The model

### Two independent axes

Origin and verification answer different questions, and a constant does not stop
being declared when it becomes ratified.

```
origin.type          SOURCE_DOCUMENT | OWNER_DECLARATION
verification_state   RATIFIED | UNCONFIRMED
```

| | `UNCONFIRMED` | `RATIFIED` |
|---|---|---|
| **`SOURCE_DOCUMENT`** | transcribed, never checked | checked against its source |
| **`OWNER_DECLARATION`** | asserted, awaiting a ratification act | asserted, then formally approved |

The bottom-right cell is the one a single-axis scheme cannot name. It matters
beyond bookkeeping: it is what lets a later reader distinguish norms derived from
documents from norms that stand because the owner said so.

### Three-valued qualifiers

A binary field cannot distinguish *checked and false* from *never checked*.

```
currency         CURRENT | STALE | UNKNOWN
authority_status VALID | INVALID | UNKNOWN
expiry_status    ACTIVE | EXPIRED | REVIEW_DUE | UNKNOWN
```

`UNKNOWN` fails closed — it yields a negative result — but never appears in
`blocking`. A thing nobody has examined is not a thing found wanting.

```js
import { eligibleAsGround } from 'norms-mcp-engine/model';

eligibleAsGround(entry);
// { eligible: false,
//   blocking: [],                    // nothing was found wanting
//   unknown: ['authority_status'],   // nobody has checked
//   unexamined: true }
```

### Eligibility, and applicability

```
eligible_as_ground = verification_state == RATIFIED
                     AND currency         == CURRENT
                     AND authority_status == VALID
                     AND expiry_status    == ACTIVE
```

That answers *may this be used as a ground at all*. It does not answer *does it
bear on the decision in front of me* — a constant can be ratified, current,
competently approved and unexpired, and still be about something else.

```js
import { admissibleFor } from 'norms-mcp-engine/model';

admissibleFor(entry, { subject: 'android' });
```

Where the entry declares no `scope`, the result is `admissible: false` with
`scope_known: false` and a note that applicability is the caller's judgement. The
engine reports the match; it never decides.

**Limit (v0.1):** scope matching is exact-value only across `subject`,
`jurisdiction` and `applicable_operations`. No hierarchies, wildcards or
negation. An empty or malformed scope **throws** — it never becomes a match,
because "unspecified" must not silently mean "applies to everything".

### Ratification carries its proof

```js
{
  verification_state: 'RATIFIED',
  ratification: {
    date:         '2026-07-31',
    document:     'POLICY.md',
    sha256:       '<64 lowercase hex>',
    section_id:   'sec-4-2',      // stable id, resolved against
    section_label: '§4.2 Retention'  // human-readable, may drift
  }
}
```

`RATIFIED` without a complete block **throws**. This is the guard that stops
"verified in conversation" from ever becoming a ratification.

### Revalidation, not falsification

The stored `sha256` is the digest of the document the verification ran against.
If the index moves and the ratification does not, the proof is stale — which is
not the same as the constant being false.

```js
import { revalidate } from 'norms-mcp-engine/model';

revalidate(entry, corpusIndex);
// { currency: 'STALE', reason: 'fingerprint diverged from index; proof requires revalidation' }
```

A document absent from the index yields `UNKNOWN`, not `STALE`.

### Expiry policy

Forcing an artificial decay condition onto a rule that ought to be permanent is
its own error.

```
expiry_policy: CONDITIONAL | REVIEWED | PERMANENT
```

`PERMANENT` never expires but **throws** unless it records `permanence.authority`
and `permanence.reason`. Permanence is a decision, not an absence of one. The
check lives in `validateEntry`, so it cannot be bypassed by never calling
`evaluateExpiry`.

`CONDITIONAL` without declared conditions yields `UNKNOWN`, not `ACTIVE`: the
absence of conditions is not evidence that none fired.

---

## Canonicalisation

```
for each document, in id-byte order:
    len(id) || id || len(content) || content
```

Two properties, both of which have bitten real systems:

**Lengths are UTF-8 byte counts.** `String.prototype.length` returns UTF-16 code
units. One character outside the BMP makes two conforming implementations
disagree. The prefix is 8-byte unsigned big-endian — fixed width and endianness
are part of the specification.

**Framing, not concatenation.** Two different corpora can concatenate to the same
byte stream. The suite demonstrates the collision and shows framing removing it:

```
ok    COLLISION: plain concatenation is ambiguous
```

Per-document canonical form: UTF-8, no BOM, LF line endings, trailing whitespace
stripped, Unicode NFC.

---

## Claim-map linter

A claim map written as prose is a convention someone has to remember to apply.
This makes it a test.

| Rule | |
|---|---|
| R1 | `O` requires every evidence field |
| R2 | `O` requires `PUBLICLY_INSPECTABLE` or `INDEPENDENTLY_ATTESTED` — a private digest is a commitment, not a verification |
| R3 | `D` requires `derived_from` and `support_status` |
| R4 | **Support rule**: a derived claim cannot carry stronger support than its weakest premise |
| R5 | `A` requires a named precondition |
| R6 | `derived_from` must reference claims that exist |
| R7 | No cycles in `derived_from` |
| R8 | No duplicate claim ids |
| R9 | `support_status` must be a recognised value |
| R10 | `D` with no premises must declare `SPEC` or `NONE` |

```js
import { lintClaimMap } from 'norms-mcp-engine/claimmap';

lintClaimMap(claims);
// { ok: false, findings: [{ id: '2', rule: 'R4', message: '…' }], counts: {…} }
```

### This package's own map is data, and lints itself

`claims.mjs` is the canonical form. `CLAIM_MAP.md` is generated from it by
`scripts/build-claimmap.mjs`, and `npm test` fails if the committed Markdown has
drifted from the data or if the map does not pass R1–R10.

The inversion is deliberate. A map kept as prose is a convention someone has to
remember to apply, and in this project's own history that convention failed
three revisions running.

States: `O` (observed, resolvable by a third party) · `O-PENDING` (reported, not
yet resolvable — **not admissible as evidence**) · `D` (derived) · `A` (open,
precondition named).

---

## What is not here

- **No MCP server.** No transport, no tool handlers, no entrypoint.
- **No persistence.** Pure functions; the caller owns storage.
- **No `applyRevalidation` / `applyExpiry` helpers.** `revalidate` and
  `evaluateExpiry` return verdicts; the caller applies them.
- **No JSON schema.** Shapes are enforced by `validateEntry` and the suite.
- **No independent audit of the code.** Seven review rounds; the last two read
  the source. None was a human reviewer.
- **No independent verification.** One author, one test run, no external
  replication.

See `CLAIM_MAP.md` for the full evidentiary status of every claim made here.

---

## Failure discipline

Every public API validates its input and throws a `ModelError` or `CorpusError`
with a stable `code`. A malformed record is never interpreted as a verdict —
neither negative nor positive — because *malformed* and *ineligible* are
different facts, and a library about evidentiary status must not conflate them.

`normaliseDocuments` is the single admission gate for a corpus: the digest and
the index apply identical rules, so they cannot disagree about which documents
exist. `buildIndex` uses a null-prototype object and `revalidate` looks up with
`Object.hasOwn`, so an id such as `__proto__` resolves to a real record or to
nothing.

---

## Licence

MIT — Copyright (c) 2026 Francesco Riva — Angelia srl SB.

The software and `README.md` are under MIT. `CLAIM_MAP.md` may be copied and
quoted freely, but a modified version should not circulate under the same name:
its value lies in not having been altered after the fact. See `LICENSE`.
