# MCP public input contract metrics 01

Measured locally on 4 August 2026. Token estimates use the transparent approximation of four JSON characters per token; they are not model-specific tokenizer counts.

| Metric | Previous contract | Typed contract | Change |
|---|---:|---:|---:|
| Complete `tools/list` JSON | 6,275 bytes | 18,938 bytes | +12,663 bytes |
| Input schema JSON | 1,337 bytes | 14,000 bytes | +12,663 bytes |
| Estimated `tools/list` tokens | 1,569 | 4,735 | +3,166 |
| Initialize latency | 58.23 ms, one cold sample | 18.46 ms, five-sample mean | not directly comparable |
| `tools/list` latency | 35.77 ms, one cold sample | 32.34 ms, five-sample mean | not directly comparable |
| Worker upload | 1006.16 KiB | 1020.31 KiB | +14.15 KiB |
| Worker gzip | 198.17 KiB | 201.19 KiB | +3.02 KiB |

The increase is accepted because the typed contract covers every decision-bearing input object with reusable definitions and references. Descriptions are bounded and facts alone retain a deliberately extensible key space. No decision object was reverted to free-form JSON to reduce size.

Typed dry-run bundle SHA-256: `1192CF1FA2189F637990326A2180893ADB1D4EC0CE21669B53BC4D69B3722256`.
