# RSTA-017 — Third-Party Independent Verifier

Purpose: define a verifier that consumes only RNCP Portable Receipt data and does not import or depend on ORION/RNCP implementation internals.

## Trust boundary

INPUT ONLY:
- protocol
- commitment_id
- action
- payload
- commitment_hash
- execution_id
- executor_id
- executor_revision
- observed
- receipt_hash

The verifier must not trust executor code, ORION code, deployment metadata, or pre-authored expected hashes.

## Verification rules

1. Recompute the canonical commitment hash from `commitment_id`, `action`, `payload`.
2. Require recomputed commitment hash == supplied `commitment_hash`.
3. Require `protocol == RNCP-PORTABLE-1`.
4. Require non-empty `execution_id`, `executor_id`, `executor_revision`.
5. Recompute receipt hash from the complete receipt payload excluding `receipt_hash`.
6. Require recomputed receipt hash == supplied `receipt_hash`.
7. Return ACCEPT only when every rule passes.
8. A changed payload, commitment hash, executor identity, observation, or receipt hash must result in REJECT.

## Isolation requirement

This verifier is intentionally implemented without importing any code from the ORION/RNCP repository, executor routes, shared canonicalizer, or conformance harness.

## Evidence target

RSTA-017 is PASS only after a verifier implementation outside ORION independently accepts a genuine external receipt and rejects at least one tampered receipt.
