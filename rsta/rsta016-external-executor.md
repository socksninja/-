# RSTA-016 — External Executor Interoperability

Status target: PASS only after a real remote invocation produces a receipt that RNCP verifies.

## Isolation boundary

RNCP implementation repository: `socksninja/orion`.
External executor repository: `socksninja/-` (public).

The executor implementation is `app/api/rsta016/executor/route.js` and has no imports from RNCP, ORION, `conformance/`, or any shared executor module. It uses only Next.js route primitives and Node's built-in `crypto` module.

## Portable input

```json
{
  "commitment_id": "RSTA-016-PORTABLE-001",
  "action": "POSTMAN_ECHO",
  "payload": {
    "message": "RSTA-016 external execution"
  }
}
```

## Receipt contract

The external executor returns:

- `commitment_id`
- `commitment_hash`
- `execution_id`
- `executor_id`
- `executor_repository`
- `executor_revision`
- `observed.status = EXECUTED`
- `receipt_hash`

Hashes are SHA-256 over recursively key-sorted canonical JSON.

## Required acceptance evidence

1. RNCP issues only the Portable Commitment; it does not ship executor code.
2. A public remote runtime in the external repository receives the commitment and executes it.
3. RNCP boundary verification accepts the returned receipt and recomputes the commitment and receipt hashes.
4. Changing any receipt field causes rejection.
5. Replaying the same commitment after durable RNCP consumption causes `DURABLE_EVENT_ALREADY_CONSUMED`.
6. The final evidence records the external repository, remote deployment, invocation, receipt, verifier decision, tamper rejection, and replay rejection.
