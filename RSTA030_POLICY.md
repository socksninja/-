# RSTA-030

External Executor Enforcement requires an execution request bound to a valid RNCP commitment, capability, executor identity, action, endpoint, and payload hash. Tested external HTTP execution must produce a signed reality receipt. Missing or mismatched bindings and tampered receipts must fail closed.

Claim boundary: this proves the tested HTTP boundary is protocol-enforced; it does not force arbitrary unrelated infrastructure to obey RNCP without an integration point at that execution boundary.
