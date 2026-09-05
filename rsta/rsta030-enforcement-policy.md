# RSTA-030 — External Executor Enforcement

## Protocol objective

A third-party execution boundary MUST NOT perform the target action unless the request carries a valid RNCP commitment binding, capability, executor identity, action, method/path, and payload hash.

## Tested chain

`Subject → RNCP Commitment → Capability → External Executor → HTTP Action → External Reality Receipt → RNCP Verifier`

## Fail-closed requirements

- Missing or invalid commitment binding: DENY.
- Wrong executor: DENY.
- Wrong action/method/path: DENY.
- Invalid executor signature: DENY.
- Missing capability binding: DENY.
- External reality receipt absent or invalid: DENY for post-execution acceptance.
- Tampered external receipt: DENY.
- Attempt to replace the bound commitment with a forged commitment: DENY.

## Claim boundary

RSTA-030 proves an actual HTTP execution boundary can be wrapped by RNCP verification and that tested bypasses are denied before protocol acceptance. It does **not** prove that arbitrary unrelated third-party infrastructure can be forced to obey RNCP without an enforcement adapter, gateway, proxy, SDK, agent runtime, or equivalent control inserted at that execution boundary.
