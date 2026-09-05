import crypto from 'node:crypto';

export const PROTOCOL = 'RNCP-PORTABLE-1';
export const ACTION = 'RSTA038_PERSIST_EXTERNAL_FACT';
export const FIXED_EXTERNAL_SERVICE = 'aisenseapi.com';
export const FIXED_EXTERNAL_ENDPOINT = 'https://aisenseapi.com/services/v1/storage';

export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
export function sha256(value) { return crypto.createHash('sha256').update(canonical(value), 'utf8').digest('hex'); }
export function verifyPortableReceipt(receipt) {
  const required = ['protocol_version','commitment_id','commitment_hash','execution_id','executor_id','executor_revision','policy','observed','receipt_hash'];
  const missing = required.filter((key) => !(key in (receipt || {})));
  if (missing.length) return { decision:'REJECT', reason:'MISSING_FIELDS', missing };
  const recomputedCommitmentHash = sha256({ protocol_version:receipt.protocol_version, commitment_id:receipt.commitment_id, action:receipt.observed?.action, payload:receipt.observed?.payload });
  const unsigned = { ...receipt }; delete unsigned.receipt_hash;
  const recomputedReceiptHash = sha256(unsigned);
  const checks = {
    protocol: receipt.protocol_version === PROTOCOL,
    identity: Boolean(receipt.execution_id && receipt.executor_id && receipt.executor_revision),
    observed_executed: receipt.observed?.status === 'EXECUTED' && receipt.observed?.action === ACTION,
    commitment_hash: receipt.commitment_hash === recomputedCommitmentHash,
    receipt_hash: receipt.receipt_hash === recomputedReceiptHash,
    fixed_action: receipt.policy?.action === ACTION,
    fixed_endpoint: receipt.policy?.external_endpoint === FIXED_EXTERNAL_ENDPOINT,
    fixed_method: receipt.policy?.external_method === 'POST',
    external_service: receipt.observed?.external_fact?.service === FIXED_EXTERNAL_SERVICE,
    external_locator: typeof receipt.observed?.external_fact?.locator === 'string' && receipt.observed.external_fact.locator.length > 0,
  };
  return { decision:Object.values(checks).every(Boolean) ? 'ACCEPT':'REJECT', checks, recomputed_commitment_hash:recomputedCommitmentHash, recomputed_receipt_hash:recomputedReceiptHash };
}
export function assertNoReplay(receipts) { const ids=receipts.map((r)=>r.execution_id); return new Set(ids).size===ids.length; }
