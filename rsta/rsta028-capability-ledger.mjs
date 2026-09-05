import crypto from 'node:crypto';

export const CAPABILITY_SCHEMA = 'RNCP-CAPABILITY-v1';
export const CAPABILITY_STATE = Object.freeze({ UNLOCKED: 'UNLOCKED', CONSUMED: 'CONSUMED' });

const canonical = (value) => value && typeof value === 'object'
  ? (Array.isArray(value)
    ? '[' + value.map(canonical).join(',') + ']'
    : '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}')
  : JSON.stringify(value);

export const sha256Hex = (value) => crypto.createHash('sha256').update(canonical(value)).digest('hex');

const signingPayload = (token) => ({
  schema: token.schema,
  policy_version: token.policy_version,
  token_id: token.token_id,
  commitment_id: token.commitment_id,
  action: token.action,
  anchor_evidence_hash: token.anchor_evidence_hash,
  anchor_round: token.anchor_round,
  nonce: token.nonce,
  state: token.state,
});

const sign = (privateKey, payload) => crypto.sign(null, Buffer.from(canonical(payload)), privateKey).toString('base64url');
const verify = (publicKey, payload, signature) => {
  try { return crypto.verify(null, Buffer.from(canonical(payload)), publicKey, Buffer.from(signature, 'base64url')); }
  catch { return false; }
};

export function createCapabilityKeyPair() {
  return crypto.generateKeyPairSync('ed25519');
}

export function issueCapability({ privateKey, publicKey, policyVersion = 'RNCP-CAPABILITY-GATE-v2', commitmentId, action, anchorEvidenceHash, anchorRound, nonce }) {
  if (!privateKey || !publicKey) throw new Error('KEY_REQUIRED');
  if (!commitmentId || !action || !anchorEvidenceHash || nonce === undefined) throw new Error('BINDING_REQUIRED');
  const tokenId = sha256Hex({ policyVersion, commitmentId, action, anchorEvidenceHash, anchorRound: Number(anchorRound), nonce });
  const unsigned = {
    schema: CAPABILITY_SCHEMA,
    policy_version: policyVersion,
    token_id: tokenId,
    commitment_id: commitmentId,
    action,
    anchor_evidence_hash: anchorEvidenceHash,
    anchor_round: Number(anchorRound),
    nonce,
    state: CAPABILITY_STATE.UNLOCKED,
  };
  const token = { ...unsigned, token_signature: sign(privateKey, signingPayload(unsigned)) };
  token.issuer_public_key_pem = publicKey.export({ type: 'spki', format: 'pem' });
  return Object.freeze(token);
}

export function verifyCapability(token, { publicKeyPem, commitmentId, action, anchorEvidenceHash } = {}) {
  if (!token || token.schema !== CAPABILITY_SCHEMA) return { decision: 'REJECT', code: 'SCHEMA_INVALID' };
  if (token.state !== CAPABILITY_STATE.UNLOCKED) return { decision: 'REJECT', code: 'STATE_INVALID' };
  if (commitmentId !== undefined && token.commitment_id !== commitmentId) return { decision: 'REJECT', code: 'COMMITMENT_MISMATCH' };
  if (action !== undefined && token.action !== action) return { decision: 'REJECT', code: 'ACTION_MISMATCH' };
  if (anchorEvidenceHash !== undefined && token.anchor_evidence_hash !== anchorEvidenceHash) return { decision: 'REJECT', code: 'ANCHOR_MISMATCH' };
  const expectedId = sha256Hex({
    policyVersion: token.policy_version,
    commitmentId: token.commitment_id,
    action: token.action,
    anchorEvidenceHash: token.anchor_evidence_hash,
    anchorRound: Number(token.anchor_round),
    nonce: token.nonce,
  });
  if (expectedId !== token.token_id) return { decision: 'REJECT', code: 'TOKEN_ID_INVALID' };
  if (!publicKeyPem) return { decision: 'REJECT', code: 'ISSUER_KEY_MISSING' };
  let publicKey;
  try { publicKey = crypto.createPublicKey(publicKeyPem); } catch { return { decision: 'REJECT', code: 'ISSUER_KEY_INVALID' }; }
  return verify(publicKey, signingPayload(token), token.token_signature)
    ? { decision: 'ACCEPT', code: 'ACCEPT', signature_valid: true, token_id_valid: true }
    : { decision: 'REJECT', code: 'SIGNATURE_INVALID', signature_valid: false, token_id_valid: true };
}

export function consumeCapability(token, consumedTokenIds = new Set(), request = {}) {
  const verdict = verifyCapability(token, request);
  if (verdict.decision !== 'ACCEPT') return { ...verdict, consumed: false };
  if (consumedTokenIds.has(token.token_id)) return { decision: 'REJECT', code: 'TOKEN_REPLAY', consumed: false };
  consumedTokenIds.add(token.token_id);
  return { decision: 'ACCEPT', code: 'CONSUMED', consumed: true, token_id: token.token_id, state: CAPABILITY_STATE.CONSUMED };
}

export function tokenFingerprint(token) {
  return sha256Hex({ token_id: token.token_id, token_signature: token.token_signature });
}
