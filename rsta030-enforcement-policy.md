# RSTA-030 — External Executor Enforcement

Protocol objective: an external execution boundary must reject a target action unless the request is bound to a valid RNCP commitment, capability, executor identity, action, method/path, and payload hash.

Test chain:
`Subject → RNCP Commitment → Capability → External Executor → HTTP Action → External Reality Receipt → RNCP Verifier`

Fail-closed requirements: missing/invalid commitment, wrong executor, wrong action/method/path/payload, invalid executor signature, missing capability binding, or tampered external receipt must cause rejection.

Claim boundary: the test proves an actual HTTP execution boundary can be wrapped by RNCP verification and that tested bypasses are denied before protocol acceptance. It does not prove arbitrary unrelated infrastructure will obey RNCP without an enforcement adapter, gateway, proxy, SDK, agent runtime, or equivalent control at that boundary.
