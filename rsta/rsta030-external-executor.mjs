import crypto from 'node:crypto';

const canonical = (v) => v && typeof v === 'object'
  ? (Array.isArray(v)
    ? '[' + v.map(canonical).join(',') + ']'
    : '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}')
  : JSON.stringify(v);

export const sha256Hex = (v) => crypto.createHash('sha256').update(canonical(v)).digest('hex');

export function createExecutorIdentity(id) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  return {
    id,
    privateKey,
    publicKey,
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
  };
}

const signingPayload = ({ protocol, request_id, commitment_hash, action, method, path, body_hash, capability_token_id }) => ({
  protocol, request_id, commitment_hash, action, method, path, body_hash, capability_token_id,
});

const sign = (privateKey, payload) => crypto.sign(null, Buffer.from(canonical(payload)), privateKey).toString('base64url');
const verifySig = (publicKey, payload, signature) => {
  try { return crypto.verify(null, Buffer.from(canonical(payload)), publicKey, Buffer.from(signature, 'base64url')); }
  catch { return false; }
};

export function createExecutionRequest({ executor, requestId, commitmentHash, action, method, path, body, capabilityTokenId }) {
  const bodyHash = sha256Hex(body ?? null);
  const unsigned = {
    protocol: 'RNCP-EXTERNAL-EXECUTOR-v1',
    request_id: requestId,
    commitment_hash: commitmentHash,
    action,
    method,
    path,
    body_hash: bodyHash,
    capability_token_id: capabilityTokenId,
  };
  return Object.freeze({ ...unsigned, executor_id: executor.id, executor_signature: sign(executor.privateKey, unsigned) });
}

export function verifyExecutionRequest(request, { executorPublicKeyPem, expectedExecutorId, expectedCommitmentHash, expectedAction, expectedMethod, expectedPath, expectedBodyHash, expectedCapabilityTokenId } = {}) {
  if (!request || request.protocol !== 'RNCP-EXTERNAL-EXECUTOR-v1') return { decision: 'REJECT', code: 'PROTOCOL_INVALID' };
  if (expectedExecutorId !== undefined && request.executor_id !== expectedExecutorId) return { decision: 'REJECT', code: 'EXECUTOR_MISMATCH' };
  if (expectedCommitmentHash !== undefined && request.commitment_hash !== expectedCommitmentHash) return { decision: 'REJECT', code: 'COMMITMENT_MISMATCH' };
  if (expectedAction !== undefined && request.action !== expectedAction) return { decision: 'REJECT', code: 'ACTION_MISMATCH' };
  if (expectedMethod !== undefined && request.method !== expectedMethod) return { decision: 'REJECT', code: 'METHOD_MISMATCH' };
  if (expectedPath !== undefined && request.path !== expectedPath) return { decision: 'REJECT', code: 'PATH_MISMATCH' };
  if (expectedBodyHash !== undefined && request.body_hash !== expectedBodyHash) return { decision: 'REJECT', code: 'BODY_HASH_MISMATCH' };
  if (expectedCapabilityTokenId !== undefined && request.capability_token_id !== expectedCapabilityTokenId) return { decision: 'REJECT', code: 'CAPABILITY_MISMATCH' };
  if (!executorPublicKeyPem) return { decision: 'REJECT', code: 'EXECUTOR_KEY_MISSING' };
  const key = crypto.createPublicKey(executorPublicKeyPem);
  const valid = verifySig(key, signingPayload(request), request.executor_signature);
  return valid ? { decision: 'ACCEPT', code: 'ACCEPT', signature_valid: true } : { decision: 'REJECT', code: 'SIGNATURE_INVALID', signature_valid: false };
}

export function createRealityReceipt({ executor, request, http, responseBody }) {
  const responseHash = sha256Hex(responseBody ?? null);
  const receiptCore = {
    schema: 'RNCP-EXTERNAL-REALITY-RECEIPT-v1',
    protocol: request.protocol,
    request_id: request.request_id,
    executor_id: executor.id,
    commitment_hash: request.commitment_hash,
    action: request.action,
    request_target: { method: request.method, path: request.path, body_hash: request.body_hash },
    external_observation: { status: http.status, response_hash: responseHash },
    observed_at: new Date().toISOString(),
  };
  const eventHash = sha256Hex(receiptCore);
  const eventId = `${request.request_id}:REALITY`;
  const signature = sign(executor.privateKey, { ...receiptCore, event_id: eventId, event_hash: eventHash });
  return Object.freeze({ ...receiptCore, event_id: eventId, event_hash: eventHash, executor_signature: signature });
}

export function verifyRealityReceipt(receipt, { executorPublicKeyPem, expectedExecutorId, expectedCommitmentHash, expectedRequestId, expectedStatus } = {}) {
  if (!receipt || receipt.schema !== 'RNCP-EXTERNAL-REALITY-RECEIPT-v1') return { decision: 'REJECT', code: 'RECEIPT_SCHEMA_INVALID' };
  if (expectedExecutorId !== undefined && receipt.executor_id !== expectedExecutorId) return { decision: 'REJECT', code: 'EXECUTOR_MISMATCH' };
  if (expectedCommitmentHash !== undefined && receipt.commitment_hash !== expectedCommitmentHash) return { decision: 'REJECT', code: 'COMMITMENT_MISMATCH' };
  if (expectedRequestId !== undefined && receipt.request_id !== expectedRequestId) return { decision: 'REJECT', code: 'REQUEST_MISMATCH' };
  if (expectedStatus !== undefined && receipt.external_observation?.status !== expectedStatus) return { decision: 'REJECT', code: 'STATUS_MISMATCH' };
  if (!executorPublicKeyPem) return { decision: 'REJECT', code: 'EXECUTOR_KEY_MISSING' };
  const recomputedHash = sha256Hex({
    schema: receipt.schema,
    protocol: receipt.protocol,
    request_id: receipt.request_id,
    executor_id: receipt.executor_id,
    commitment_hash: receipt.commitment_hash,
    action: receipt.action,
    request_target: receipt.request_target,
    external_observation: receipt.external_observation,
    observed_at: receipt.observed_at,
  });
  if (recomputedHash !== receipt.event_hash) return { decision: 'REJECT', code: 'EVENT_HASH_INVALID' };
  const publicKey = crypto.createPublicKey(executorPublicKeyPem);
  const signatureOk = verifySig(publicKey, {
    schema: receipt.schema,
    protocol: receipt.protocol,
    request_id: receipt.request_id,
    executor_id: receipt.executor_id,
    commitment_hash: receipt.commitment_hash,
    action: receipt.action,
    request_target: receipt.request_target,
    external_observation: receipt.external_observation,
    observed_at: receipt.observed_at,
    event_id: receipt.event_id,
    event_hash: receipt.event_hash,
  }, receipt.executor_signature);
  return signatureOk ? { decision: 'ACCEPT', code: 'ACCEPT', signature_valid: true, event_hash_valid: true } : { decision: 'REJECT', code: 'SIGNATURE_INVALID', signature_valid: false };
}

export function enforceExternalExecution({ commitmentValid, request, requestVerifier, realityReceipt, receiptVerifier, bypassRequest }) {
  const requestAccepted = requestVerifier.decision === 'ACCEPT';
  if (!commitmentValid || !requestAccepted) return { decision: 'DENY', code: 'COMMITMENT_GATE_DENIED' };
  const receiptAccepted = receiptVerifier.decision === 'ACCEPT';
  if (!receiptAccepted) return { decision: 'DENY', code: 'REALITY_RECEIPT_REQUIRED' };
  if (bypassRequest) return { decision: 'DENY', code: 'BYPASS_NOT_AUTHORIZED' };
  return { decision: 'ALLOW', code: 'EXECUTION_AUTHORIZED' };
}
