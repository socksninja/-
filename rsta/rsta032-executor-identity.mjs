import crypto from 'node:crypto';

export const RSTA032_PROTOCOL = 'RNCP-EXECUTOR-IDENTITY-v1';
export const GITHUB_OIDC_ISSUER = 'https://token.actions.githubusercontent.com';

const b64u = (s) => Buffer.from(s).toString('base64url');
const fromB64u = (s) => Buffer.from(s, 'base64url').toString('utf8');

export function sha256Hex(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

export function parseJwt(token) {
  if (typeof token !== 'string') throw new Error('OIDC_TOKEN_REQUIRED');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('OIDC_JWT_SHAPE_INVALID');
  return { header: JSON.parse(fromB64u(parts[0])), payload: JSON.parse(fromB64u(parts[1])), signingInput: `${parts[0]}.${parts[1]}`, signature: Buffer.from(parts[2], 'base64url') };
}

export function verifyJwtRs256(token, jwk) {
  const { header, payload, signingInput, signature } = parseJwt(token);
  if (header.alg !== 'RS256') return { decision: 'REJECT', code: 'ALG_NOT_ALLOWED' };
  if (!jwk || header.kid !== jwk.kid) return { decision: 'REJECT', code: 'KID_NOT_TRUSTED' };
  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const verify = crypto.createVerify('RSA-SHA256');
  verify.update(signingInput);
  verify.end();
  if (!verify.verify(publicKey, signature)) return { decision: 'REJECT', code: 'SIGNATURE_INVALID' };
  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== GITHUB_OIDC_ISSUER) return { decision: 'REJECT', code: 'ISSUER_INVALID' };
  if (payload.exp !== undefined && now >= payload.exp) return { decision: 'REJECT', code: 'TOKEN_EXPIRED' };
  if (payload.nbf !== undefined && now < payload.nbf) return { decision: 'REJECT', code: 'TOKEN_NOT_YET_VALID' };
  return { decision: 'ACCEPT', code: 'JWT_VERIFIED', header, payload };
}

export function authorizeExecutorIdentity(payload, expected) {
  if (!payload || !expected) return { decision: 'REJECT', code: 'CLAIMS_REQUIRED' };
  if (payload.iss !== GITHUB_OIDC_ISSUER) return { decision: 'REJECT', code: 'ISSUER_INVALID' };
  if (payload.aud !== expected.audience) return { decision: 'REJECT', code: 'AUDIENCE_INVALID' };
  if (payload.repository !== expected.repository) return { decision: 'REJECT', code: 'REPOSITORY_INVALID' };
  if (expected.repository_id && String(payload.repository_id) !== String(expected.repository_id)) return { decision: 'REJECT', code: 'REPOSITORY_ID_INVALID' };
  if (payload.repository_visibility !== expected.repository_visibility) return { decision: 'REJECT', code: 'REPOSITORY_VISIBILITY_INVALID' };
  if (payload.workflow_ref !== expected.workflow_ref) return { decision: 'REJECT', code: 'WORKFLOW_REF_INVALID' };
  if (payload.ref !== expected.ref) return { decision: 'REJECT', code: 'REF_INVALID' };
  if (payload.ref_type !== expected.ref_type) return { decision: 'REJECT', code: 'REF_TYPE_INVALID' };
  if (payload.event_name !== expected.event_name) return { decision: 'REJECT', code: 'EVENT_INVALID' };
  if (payload.runner_environment !== expected.runner_environment) return { decision: 'REJECT', code: 'RUNNER_ENVIRONMENT_INVALID' };
  return { decision: 'ACCEPT', code: 'EXECUTOR_IDENTITY_ADMITTED', executor_id: expected.executor_id };
}

export function createAttestation({ token, claims, executorId }) {
  return {
    protocol: RSTA032_PROTOCOL,
    executor_id: executorId,
    issuer: GITHUB_OIDC_ISSUER,
    token_hash: sha256Hex(token),
    claims_hash: sha256Hex(claims),
    claims: {
      sub: claims.sub,
      aud: claims.aud,
      repository: claims.repository,
      repository_id: claims.repository_id,
      workflow_ref: claims.workflow_ref,
      workflow_sha: claims.workflow_sha,
      ref: claims.ref,
      ref_type: claims.ref_type,
      event_name: claims.event_name,
      run_id: claims.run_id,
      check_run_id: claims.check_run_id,
      runner_environment: claims.runner_environment,
    },
  };
}
