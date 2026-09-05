import crypto from 'node:crypto';
import fs from 'node:fs';

export const RSTA036_PROTOCOL = 'RNCP-PORTABLE-VERIFIER-v1';
const sha256 = (v) => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');

export function verifyPortableReceipt(receipt) {
  const reasons = [];
  if (!receipt || receipt.schema !== 'RNCP-EXECUTION-RECEIPT-v1') reasons.push('SCHEMA_INVALID');
  if (receipt?.rsta !== 'RSTA-035') reasons.push('RSTA_MISMATCH');
  if (receipt?.protocol !== 'RNCP-BYZANTINE-MULTI-EXECUTOR-v1') reasons.push('PROTOCOL_MISMATCH');
  if (receipt?.verdict !== 'PASS') reasons.push('UPSTREAM_NOT_PASS');
  const assertions = receipt?.assertions || {};
  if (!Object.values(assertions).every(Boolean)) reasons.push('ASSERTION_FALSE');
  if (!Array.isArray(receipt?.evaluated) || receipt.evaluated.length !== 3) reasons.push('EXECUTOR_SET_INVALID');
  const collusion = receipt?.scenarios?.two_colluding_false_reports;
  if (collusion?.accepted !== false || collusion?.quorum !== 2) reasons.push('COLLUSION_RULE_INVALID');
  return { decision: reasons.length === 0 ? 'ACCEPT' : 'REJECT', protocol: RSTA036_PROTOCOL, reasons };
}

export function loadReceipt(path) { return JSON.parse(fs.readFileSync(path, 'utf8')); }

if (process.argv[1]?.endsWith('rsta036-portable-verifier.mjs')) {
  const path = process.argv[2];
  if (!path) throw new Error('RECEIPT_PATH_REQUIRED');
  const receipt = loadReceipt(path);
  const result = verifyPortableReceipt(receipt);
  console.log(JSON.stringify(result, null, 2));
  if (result.decision !== 'ACCEPT') process.exit(1);
}
