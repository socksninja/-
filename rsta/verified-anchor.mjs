import crypto from 'node:crypto';

export const VERIFIED_ANCHOR_TYPE = 'RNCP-VERIFIED-ANCHOR';
export const VERIFIED_ANCHOR_VERSION = 'RNCP-VERIFIED-ANCHOR-v1';

export class VerifiedAnchorError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'VerifiedAnchorError';
    this.code = code;
  }
}

const canonical = (value) => value && typeof value === 'object'
  ? (Array.isArray(value)
    ? '[' + value.map(canonical).join(',') + ']'
    : '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}')
  : JSON.stringify(value);

export const sha256Hex = (value) => crypto.createHash('sha256').update(canonical(value)).digest('hex');

const signingPayload = (anchor) => ({
  type: anchor.type,
  version: anchor.version,
  core: anchor.core,
  evidence_hash: anchor.evidence_hash,
  proof: anchor.proof,
});

const sign = (privateKey, payload) => crypto.sign(null, Buffer.from(canonical(payload)), privateKey).toString('base64url');
const verify = (publicKey, payload, signature) => {
  try {
    return crypto.verify(null, Buffer.from(canonical(payload)), publicKey, Buffer.from(signature, 'base64url'));
  } catch {
    return false;
  }
};

export function generateAnchorVerifierKeyPair() {
  return crypto.generateKeyPairSync('ed25519');
}

export function createAnchorVerifier({ privateKey, publicKey, verifierId = 'RNCP-ANCHOR-VERIFIER-001' }) {
  if (!privateKey || !publicKey) throw new VerifiedAnchorError('KEY_REQUIRED', 'anchor verifier keypair is required');

  function verifyVerifiedAnchor(anchor) {
    if (!anchor || anchor.type !== VERIFIED_ANCHOR_TYPE) return { valid: false, code: 'TYPE_INVALID' };
    if (anchor.version !== VERIFIED_ANCHOR_VERSION) return { valid: false, code: 'VERSION_INVALID' };
    if (anchor.verifier_id !== verifierId) return { valid: false, code: 'VERIFIER_ID_MISMATCH' };
    if (!anchor.core || !anchor.proof || !anchor.evidence_hash || !anchor.verifier_signature) return { valid: false, code: 'PROOF_MATERIAL_MISSING' };
    if (anchor.proof !== sha256Hex(anchor.core)) return { valid: false, code: 'ANCHOR_PROOF_INVALID' };
    if (anchor.evidence_hash !== sha256Hex({ core: anchor.core, proof: anchor.proof })) return { valid: false, code: 'EVIDENCE_HASH_INVALID' };
    if (!verify(publicKey, signingPayload(anchor), anchor.verifier_signature)) return { valid: false, code: 'VERIFIER_SIGNATURE_INVALID' };
    return { valid: true, code: 'ACCEPT' };
  }

  function attest({ core }) {
    if (!core || typeof core !== 'object') throw new VerifiedAnchorError('CORE_REQUIRED', 'anchor core is required');
    const proof = sha256Hex(core);
    const evidence_hash = sha256Hex({ core, proof });
    const unsigned = Object.freeze({
      type: VERIFIED_ANCHOR_TYPE,
      version: VERIFIED_ANCHOR_VERSION,
      verifier_id: verifierId,
      core,
      proof,
      evidence_hash,
    });
    const verifier_signature = sign(privateKey, signingPayload(unsigned));
    const anchor = Object.freeze({ ...unsigned, verifier_signature, verifier_public_key_pem: publicKey.export({ type: 'spki', format: 'pem' }) });
    const verdict = verifyVerifiedAnchor(anchor);
    if (!verdict.valid) throw new VerifiedAnchorError(verdict.code, `self-verification failed: ${verdict.code}`);
    return anchor;
  }

  return Object.freeze({
    attest,
    verifyVerifiedAnchor,
    verifierId,
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
  });
}

export function verifyVerifiedAnchorOffline({ anchor, publicKeyPem, verifierId }) {
  try {
    if (!anchor || anchor.type !== VERIFIED_ANCHOR_TYPE) return { decision: 'REJECT', code: 'TYPE_INVALID' };
    if (anchor.version !== VERIFIED_ANCHOR_VERSION) return { decision: 'REJECT', code: 'VERSION_INVALID' };
    if (verifierId !== undefined && anchor.verifier_id !== verifierId) return { decision: 'REJECT', code: 'VERIFIER_ID_MISMATCH' };
    if (anchor.proof !== sha256Hex(anchor.core)) return { decision: 'REJECT', code: 'ANCHOR_PROOF_INVALID' };
    if (anchor.evidence_hash !== sha256Hex({ core: anchor.core, proof: anchor.proof })) return { decision: 'REJECT', code: 'EVIDENCE_HASH_INVALID' };
    const publicKey = crypto.createPublicKey(publicKeyPem);
    const signatureValid = verify(publicKey, signingPayload(anchor), anchor.verifier_signature);
    return signatureValid
      ? { decision: 'ACCEPT', code: 'ACCEPT', signature_valid: true, proof_valid: true, evidence_hash_valid: true }
      : { decision: 'REJECT', code: 'VERIFIER_SIGNATURE_INVALID', signature_valid: false, proof_valid: true, evidence_hash_valid: true };
  } catch {
    return { decision: 'REJECT', code: 'VERIFIER_SIGNATURE_INVALID' };
  }
}
