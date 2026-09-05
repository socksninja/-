import crypto from 'node:crypto';

export const RSTA033_PROTOCOL = 'RNCP-EXECUTOR-DELEGATION-v1';

const canonical = (value) => value && typeof value === 'object'
  ? (Array.isArray(value)
    ? '[' + value.map(canonical).join(',') + ']'
    : '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}')
  : JSON.stringify(value);

export const sha256Hex = (value) => crypto.createHash('sha256').update(canonical(value)).digest('hex');
const sign = (privateKey, payload) => crypto.sign(null, Buffer.from(canonical(payload)), privateKey).toString('base64url');
const verify = (publicKey, payload, signature) => { try { return crypto.verify(null, Buffer.from(canonical(payload)), publicKey, Buffer.from(signature, 'base64url')); } catch { return false; } };

const signingPayload = (d) => ({
  protocol: d.protocol,
  delegation_id: d.delegation_id,
  subject_id: d.subject_id,
  executor_id: d.executor_id,
  commitment_hash: d.commitment_hash,
  action: d.action,
  scope: d.scope,
  nonce: d.nonce,
  state: d.state,
});

export function fixedDelegationPolicy(repository) {
  if (!repository) throw new Error('REPOSITORY_REQUIRED');
  return Object.freeze({
    executor_id: 'EXTERNAL-GITHUB-EXECUTOR',
    action: 'CREATE_GITHUB_ISSUE',
    method: 'POST',
    path: `/repos/${repository}/issues`,
    max_calls: 1,
  });
}

export function createDelegation({ subject, delegationId, executorId, commitmentHash, action, scope, nonce }) {
  if (!subject?.id || !subject?.privateKey) throw new Error('SUBJECT_REQUIRED');
  if (!delegationId || !executorId || !commitmentHash || !action || !scope?.method || !scope?.path || !scope?.body_hash || nonce === undefined) throw new Error('DELEGATION_BINDING_REQUIRED');
  const unsigned = {
    protocol: RSTA033_PROTOCOL,
    delegation_id: delegationId,
    subject_id: subject.id,
    executor_id: executorId,
    commitment_hash: commitmentHash,
    action,
    scope,
    nonce,
    state: 'UNCONSUMED',
  };
  return Object.freeze({
    ...unsigned,
    delegation_hash: sha256Hex(signingPayload(unsigned)),
    subject_signature: sign(subject.privateKey, signingPayload(unsigned)),
    subject_public_key_pem: subject.publicKeyPem,
  });
}

export function verifyDelegation(delegation, { subjectPublicKeyPem, expectedSubjectId, expectedExecutorId, expectedCommitmentHash, expectedAction, expectedMethod, expectedPath, expectedBodyHash } = {}) {
  if (!delegation || delegation.protocol !== RSTA033_PROTOCOL) return { decision: 'REJECT', code: 'PROTOCOL_INVALID' };
  if (delegation.state !== 'UNCONSUMED') return { decision: 'REJECT', code: 'STATE_INVALID' };
  if (expectedSubjectId !== undefined && delegation.subject_id !== expectedSubjectId) return { decision: 'REJECT', code: 'SUBJECT_MISMATCH' };
  if (expectedExecutorId !== undefined && delegation.executor_id !== expectedExecutorId) return { decision: 'REJECT', code: 'EXECUTOR_MISMATCH' };
  if (expectedCommitmentHash !== undefined && delegation.commitment_hash !== expectedCommitmentHash) return { decision: 'REJECT', code: 'COMMITMENT_MISMATCH' };
  if (expectedAction !== undefined && delegation.action !== expectedAction) return { decision: 'REJECT', code: 'ACTION_MISMATCH' };
  if (expectedMethod !== undefined && delegation.scope?.method !== expectedMethod) return { decision: 'REJECT', code: 'METHOD_SCOPE_MISMATCH' };
  if (expectedPath !== undefined && delegation.scope?.path !== expectedPath) return { decision: 'REJECT', code: 'PATH_SCOPE_MISMATCH' };
  if (expectedBodyHash !== undefined && delegation.scope?.body_hash !== expectedBodyHash) return { decision: 'REJECT', code: 'BODY_SCOPE_MISMATCH' };
  if (delegation.delegation_hash !== sha256Hex(signingPayload(delegation))) return { decision: 'REJECT', code: 'DELEGATION_HASH_INVALID' };
  if (!subjectPublicKeyPem) return { decision: 'REJECT', code: 'SUBJECT_KEY_MISSING' };
  let publicKey;
  try { publicKey = crypto.createPublicKey(subjectPublicKeyPem); } catch { return { decision: 'REJECT', code: 'SUBJECT_KEY_INVALID' }; }
  return verify(publicKey, signingPayload(delegation), delegation.subject_signature)
    ? { decision: 'ACCEPT', code: 'DELEGATION_AUTHORIZED', signature_valid: true, hash_valid: true }
    : { decision: 'REJECT', code: 'SUBJECT_SIGNATURE_INVALID' };
}

export function consumeDelegation(delegation, consumedIds = new Set(), requestContext = {}) {
  const check = verifyDelegation(delegation, requestContext);
  if (check.decision !== 'ACCEPT') return { ...check, consumed: false };
  if (consumedIds.has(delegation.delegation_id)) return { decision: 'REJECT', code: 'DELEGATION_REPLAY', consumed: false };
  consumedIds.add(delegation.delegation_id);
  return { decision: 'ACCEPT', code: 'DELEGATION_CONSUMED', consumed: true, delegation_id: delegation.delegation_id };
}

export function delegationFingerprint(delegation) {
  return sha256Hex({ delegation_id: delegation.delegation_id, delegation_hash: delegation.delegation_hash, subject_signature: delegation.subject_signature });
}
