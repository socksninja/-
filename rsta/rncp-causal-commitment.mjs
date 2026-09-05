import crypto from 'node:crypto';

export const RNCP_PROTOCOL = 'RNCP-CAUSAL-COMMITMENT-v1';
export const RNCP_STATE = Object.freeze({
  PROPOSED: 'PROPOSED',
  ACCEPTED: 'ACCEPTED',
  EXECUTED: 'EXECUTED',
  REJECTED: 'REJECTED',
});

const canonical = (value) => value && typeof value === 'object'
  ? (Array.isArray(value)
    ? '[' + value.map(canonical).join(',') + ']'
    : '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}')
  : JSON.stringify(value);

export const sha256Hex = (value) => crypto.createHash('sha256').update(canonical(value)).digest('hex');
const sign = (privateKey, payload) => crypto.sign(null, Buffer.from(canonical(payload)), privateKey).toString('base64url');
const verify = (publicKey, payload, signature) => {
  try { return crypto.verify(null, Buffer.from(canonical(payload)), publicKey, Buffer.from(signature, 'base64url')); }
  catch { return false; }
};

const commitmentSigningPayload = (commitment) => ({
  protocol: commitment.protocol,
  commitment_id: commitment.commitment_id,
  subject_id: commitment.subject_id,
  executor_id: commitment.executor_id,
  action: commitment.action,
  prerequisites: commitment.prerequisites,
  predecessor_event_hash: commitment.predecessor_event_hash,
  state: commitment.state,
});

const receiptSigningPayload = (receipt) => ({
  protocol: receipt.protocol,
  event_id: receipt.event_id,
  commitment_id: receipt.commitment_id,
  executor_id: receipt.executor_id,
  action: receipt.action,
  result: receipt.result,
  predecessor_event_hash: receipt.predecessor_event_hash,
  commitment_hash: receipt.commitment_hash,
  state: receipt.state,
});

export function createPrincipal(id) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  return Object.freeze({
    id,
    privateKey,
    publicKey,
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
  });
}

export function commitmentHash(commitment) {
  return sha256Hex(commitmentSigningPayload(commitment));
}

export function createCommitment({ subject, executorId, commitmentId, action, prerequisites, predecessorEventHash = null }) {
  if (!subject?.id || !subject?.privateKey) throw new Error('SUBJECT_REQUIRED');
  if (!executorId || !commitmentId || !action || !prerequisites?.capability_token_id || !prerequisites?.anchor_evidence_hash) {
    throw new Error('COMMITMENT_BINDING_REQUIRED');
  }
  const commitment = {
    protocol: RNCP_PROTOCOL,
    commitment_id: commitmentId,
    subject_id: subject.id,
    executor_id: executorId,
    action,
    prerequisites,
    predecessor_event_hash: predecessorEventHash,
    state: RNCP_STATE.ACCEPTED,
  };
  return Object.freeze({
    ...commitment,
    commitment_hash: commitmentHash(commitment),
    subject_signature: sign(subject.privateKey, commitmentSigningPayload(commitment)),
    subject_public_key_pem: subject.publicKeyPem,
  });
}

export function verifyCommitment(commitment, { expectedExecutorId, expectedAction, capabilityTokenId, anchorEvidenceHash } = {}) {
  if (!commitment || commitment.protocol !== RNCP_PROTOCOL) return { decision: 'REJECT', code: 'PROTOCOL_INVALID' };
  if (commitment.state !== RNCP_STATE.ACCEPTED) return { decision: 'REJECT', code: 'STATE_INVALID' };
  if (expectedExecutorId && commitment.executor_id !== expectedExecutorId) return { decision: 'REJECT', code: 'EXECUTOR_MISMATCH' };
  if (expectedAction && commitment.action !== expectedAction) return { decision: 'REJECT', code: 'ACTION_MISMATCH' };
  if (capabilityTokenId && commitment.prerequisites?.capability_token_id !== capabilityTokenId) return { decision: 'REJECT', code: 'CAPABILITY_MISMATCH' };
  if (anchorEvidenceHash && commitment.prerequisites?.anchor_evidence_hash !== anchorEvidenceHash) return { decision: 'REJECT', code: 'ANCHOR_MISMATCH' };
  if (commitment.commitment_hash !== commitmentHash(commitment)) return { decision: 'REJECT', code: 'COMMITMENT_HASH_INVALID' };
  let publicKey;
  try { publicKey = crypto.createPublicKey(commitment.subject_public_key_pem); } catch { return { decision: 'REJECT', code: 'SUBJECT_KEY_INVALID' }; }
  return verify(publicKey, commitmentSigningPayload(commitment), commitment.subject_signature)
    ? { decision: 'ACCEPT', code: 'ACCEPT', signature_valid: true, hash_valid: true }
    : { decision: 'REJECT', code: 'SUBJECT_SIGNATURE_INVALID' };
}

export function createExecutionReceipt({ executor, commitment, result }) {
  if (!executor?.id || !executor?.privateKey) throw new Error('EXECUTOR_REQUIRED');
  if (!commitment?.commitment_hash) throw new Error('COMMITMENT_REQUIRED');
  const eventId = `${commitment.commitment_id}:EXECUTED`;
  const receipt = {
    protocol: RNCP_PROTOCOL,
    event_id: eventId,
    commitment_id: commitment.commitment_id,
    executor_id: executor.id,
    action: commitment.action,
    result,
    predecessor_event_hash: commitment.predecessor_event_hash,
    commitment_hash: commitment.commitment_hash,
    state: RNCP_STATE.EXECUTED,
  };
  return Object.freeze({
    ...receipt,
    event_hash: sha256Hex(receiptSigningPayload(receipt)),
    executor_signature: sign(executor.privateKey, receiptSigningPayload(receipt)),
    executor_public_key_pem: executor.publicKeyPem,
  });
}

export function verifyExecutionReceipt(receipt, { expectedExecutorId, expectedCommitmentHash, expectedEventId } = {}) {
  if (!receipt || receipt.protocol !== RNCP_PROTOCOL) return { decision: 'REJECT', code: 'PROTOCOL_INVALID' };
  if (receipt.state !== RNCP_STATE.EXECUTED) return { decision: 'REJECT', code: 'STATE_INVALID' };
  if (expectedExecutorId && receipt.executor_id !== expectedExecutorId) return { decision: 'REJECT', code: 'EXECUTOR_MISMATCH' };
  if (expectedCommitmentHash && receipt.commitment_hash !== expectedCommitmentHash) return { decision: 'REJECT', code: 'COMMITMENT_MISMATCH' };
  if (expectedEventId && receipt.event_id !== expectedEventId) return { decision: 'REJECT', code: 'EVENT_ID_MISMATCH' };
  if (receipt.event_hash !== sha256Hex(receiptSigningPayload(receipt))) return { decision: 'REJECT', code: 'EVENT_HASH_INVALID' };
  let publicKey;
  try { publicKey = crypto.createPublicKey(receipt.executor_public_key_pem); } catch { return { decision: 'REJECT', code: 'EXECUTOR_KEY_INVALID' }; }
  return verify(publicKey, receiptSigningPayload(receipt), receipt.executor_signature)
    ? { decision: 'ACCEPT', code: 'ACCEPT', signature_valid: true, hash_valid: true }
    : { decision: 'REJECT', code: 'EXECUTOR_SIGNATURE_INVALID' };
}

export function enforceCausalPrecondition(commitment, receipt, options = {}) {
  const commitmentVerdict = verifyCommitment(commitment, options);
  if (commitmentVerdict.decision !== 'ACCEPT') return { decision: 'REJECT', code: `COMMITMENT_${commitmentVerdict.code}` };
  if (!options.requirePredecessorReceipt) return { decision: 'ACCEPT', code: 'READY' };
  if (!receipt) return { decision: 'REJECT', code: 'PREDECESSOR_RECEIPT_REQUIRED' };
  const receiptVerdict = verifyExecutionReceipt(receipt, {
    expectedExecutorId: options.predecessorExecutorId,
    expectedCommitmentHash: options.predecessorCommitmentHash,
    expectedEventId: options.predecessorEventId,
  });
  if (receiptVerdict.decision !== 'ACCEPT') return { decision: 'REJECT', code: `PREDECESSOR_${receiptVerdict.code}` };
  if (commitment.predecessor_event_hash !== receipt.event_hash) return { decision: 'REJECT', code: 'PREDECESSOR_EVENT_HASH_MISMATCH' };
  return { decision: 'ACCEPT', code: 'READY', predecessor_verified: true };
}

export function deriveNextCommitment({ subject, executorId, commitmentId, action, prerequisites, fulfilledReceipt }) {
  if (!fulfilledReceipt?.event_hash) throw new Error('FULFILLED_RECEIPT_REQUIRED');
  return createCommitment({ subject, executorId, commitmentId, action, prerequisites, predecessorEventHash: fulfilledReceipt.event_hash });
}

export const canonicalize = canonical;
