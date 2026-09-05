# RSTA-017 Evidence — Independent Verification Core

Date: 2026-09-05

## Genuine receipt

Source receipt: `rsta/rsta016-live-evidence.json`

The receipt's commitment hash independently recomputes to:
`5eecca09351dd256a0f18680f30ebb41327db19ecfcf0fbd4398abcdbca529dd`

The receipt hash independently recomputes to:
`9140584473ad40e184f68ee93d20081b3eb6d149ac72efddd550c2ede03e5f27`

Both match the recorded hashes.

## Tamper test

Changed `observed.payload.message` from `RSTA-016 external execution` to `TAMPERED`.
The resulting receipt hash differs from the original, therefore integrity verification rejects the tampered receipt.

## Important scope statement

This evidence proves the verifier algorithm independently recomputes the portable hashes and rejects tampering. It does **not** yet prove a live third-party verifier deployment: the current Vercel project is the same project as Executor #2 and its protected URL currently redirects to Vercel SSO. RSTA-017 therefore remains PARTIAL until the verifier executes from a separately controlled runtime/repository or other independently controlled infrastructure.
