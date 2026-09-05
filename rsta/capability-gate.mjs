import crypto from 'node:crypto';
import { verifyVerifiedAnchorOffline } from './verified-anchor.mjs';

export const CAPABILITY_STATE = Object.freeze({
  PENDING: 'PENDING',
  ANCHOR_VERIFIED: 'ANCHOR_VERIFIED',
  CAPABILITY_UNLOCKED: 'CAPABILITY_UNLOCKED',
  EXECUTING: 'EXECUTING',
  EXECUTED: 'EXECUTED',
  REALITY_RECEIPT: 'REALITY_RECEIPT',
});

export const CAPABILITY_POLICY_VERSION = 'RNCP-CAPABILITY-GATE-v1';

export class CapabilityGateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CapabilityGateError';
    this.code = code;
  }
}

const canonical = (value) => value && typeof value === 'object'
  ? (Array.isArray(value)
    ? '[' + value.map(canonical).join(',') + ']'
    : '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}')
  : JSON.stringify(value);

export const sha256Hex = (value) => crypto.createHash('sha256').update(canonical(value)).digest('hex');

const payloadForToken = (token) => ({
  token_type: token.token_type,
  policy_version: token.policy_version,
  commitment: token.commitment,
  action: token.action,
  anchor_type: token.anchor_type,
  anchor_version: token.anchor_version,
  anchor_verifier_id: token.anchor_verifier_id,
  anchor_chain: token.anchor_chain,
  anchor_round: token.anchor_round,
  anchor_signature: token.anchor_signature,
  anchor_previous_signature: token.anchor_previous_signature,
  anchor_proof: token.anchor_proof,
  anchor_evidence_hash: token.anchor_evidence_hash,
  anchor_verifier_signature: token.anchor_verifier_signature,
  issued_nonce: token.issued_nonce,
  state: token.state,
});

const signPayload = (privateKey, payload) => crypto.sign(null, Buffer.from(canonical(payload)), privateKey).toString('base64url');
const verifyPayloadSignature = (publicKey, payload, signature) => {
  try { return crypto.verify(null, Buffer.from(canonical(payload)), publicKey, Buffer.from(signature, 'base64url')); }
  catch { return false; }
};

export function createCapabilityIssuer({ privateKey, publicKey, policyVersion = CAPABILITY_POLICY_VERSION }) {
  if (!privateKey || !publicKey) throw new CapabilityGateError('KEY_REQUIRED', 'signing keypair is required');
  const issued = new Map();
  const consumed = new Set();

  function verifyAnchorForIssue(anchor, anchorVerifierPublicKeyPem) {
    if (!anchorVerifierPublicKeyPem) throw new CapabilityGateError('ANCHOR_VERIFIER_KEY_REQUIRED', 'pinned anchor verifier public key is required');
    const verdict = verifyVerifiedAnchorOffline({ anchor, publicKeyPem: anchorVerifierPublicKeyPem });
    if (verdict.decision !== 'ACCEPT') throw new CapabilityGateError(`ANCHOR_${verdict.code}`, `capability cannot unlock: ${verdict.code}`);
  }

  function issue({ commitment, action, anchor, anchorVerifierPublicKeyPem, nonce = crypto.randomBytes(16).toString('hex') }) {
    verifyAnchorForIssue(anchor, anchorVerifierPublicKeyPem);
    if (!commitment || !action) throw new CapabilityGateError('BINDING_REQUIRED', 'commitment and action are required');
    const token = {
      token_type: 'RNCP-CAPABILITY', policy_version: policyVersion,
      commitment, action,
      anchor_type: anchor.type, anchor_version: anchor.version, anchor_verifier_id: anchor.verifier_id,
      anchor_chain: anchor.core.chain, anchor_round: Number(anchor.core.round),
      anchor_signature: anchor.core.signature, anchor_previous_signature: anchor.core.previous_signature,
      anchor_proof: anchor.proof, anchor_evidence_hash: anchor.evidence_hash,
      anchor_verifier_signature: anchor.verifier_signature,
      issued_nonce: nonce, state: CAPABILITY_STATE.CAPABILITY_UNLOCKED,
    };
    const tokenSignature = signPayload(privateKey, payloadForToken(token));
    const signedToken = Object.freeze({ ...token, token_signature: tokenSignature });
    const tokenId = sha256Hex({ payload: payloadForToken(signedToken), token_signature: tokenSignature });
    issued.set(tokenId, signedToken);
    return Object.freeze({ ...signedToken, token_id: tokenId, issuer_public_key_pem: publicKey.export({ type: 'spki', format: 'pem' }) });
  }

  function verifyCapability(token, request = {}) {
    if (!token || token.token_type !== 'RNCP-CAPABILITY') return { valid: false, code: 'TOKEN_INVALID' };
    if (token.policy_version !== policyVersion) return { valid: false, code: 'POLICY_MISMATCH' };
    if (token.state !== CAPABILITY_STATE.CAPABILITY_UNLOCKED) return { valid: false, code: 'STATE_INVALID' };
    if (request.commitment !== undefined && request.commitment !== token.commitment) return { valid: false, code: 'COMMITMENT_MISMATCH' };
    if (request.action !== undefined && request.action !== token.action) return { valid: false, code: 'ACTION_MISMATCH' };
    if (!verifyPayloadSignature(publicKey, payloadForToken(token), token.token_signature)) return { valid: false, code: 'TOKEN_SIGNATURE_INVALID' };
    const recomputedId = sha256Hex({ payload: payloadForToken(token), token_signature: token.token_signature });
    if (recomputedId !== token.token_id) return { valid: false, code: 'TOKEN_ID_INVALID' };
    if (!issued.has(token.token_id)) return { valid: false, code: 'TOKEN_NOT_ISSUED_BY_THIS_GATE' };
    if (consumed.has(token.token_id)) return { valid: false, code: 'TOKEN_REPLAY' };
    return { valid: true, code: 'ACCEPT' };
  }

  function beginExecution(token, request = {}) {
    const verdict = verifyCapability(token, request);
    if (!verdict.valid) throw new CapabilityGateError(verdict.code, `capability execution rejected: ${verdict.code}`);
    consumed.add(token.token_id);
    return Object.freeze({ state: CAPABILITY_STATE.EXECUTED, commitment: token.commitment, action: token.action, anchor_round: token.anchor_round, token_id: token.token_id });
  }

  return Object.freeze({ issue, verifyCapability, beginExecution, policyVersion, publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }) });
}

export function generateIssuerKeyPair() { return crypto.generateKeyPairSync('ed25519'); }

export function verifyCapabilityOffline({ token, publicKeyPem, commitment, action }) {
  const publicKey = crypto.createPublicKey(publicKeyPem);
  const validSignature = verifyPayloadSignature(publicKey, payloadForToken(token), token.token_signature);
  const validBinding = token.commitment === commitment && token.action === action;
  const validId = sha256Hex({ payload: payloadForToken(token), token_signature: token.token_signature }) === token.token_id;
  return { decision: validSignature && validBinding && validId ? 'ACCEPT' : 'REJECT', signature_valid: validSignature, binding_valid: validBinding, token_id_valid: validId };
}
