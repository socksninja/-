import crypto from 'node:crypto';

export const RSTA034_PROTOCOL = 'RNCP-PERSISTENT-DELEGATION-LEDGER-v1';

const canonical = (value) => value && typeof value === 'object'
  ? (Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}')
  : JSON.stringify(value);
export const sha256Hex = (v) => crypto.createHash('sha256').update(canonical(v)).digest('hex');

export const VALID_STATES = Object.freeze(['UNCONSUMED', 'RESERVED', 'CONSUMED', 'REVOKED']);

export function createLedgerEntry({ delegationId, delegationHash, subjectId, executorId, commitmentHash, scope }) {
  if (!delegationId || !delegationHash || !subjectId || !executorId || !commitmentHash || !scope) throw new Error('LEDGER_BINDING_REQUIRED');
  return { protocol: RSTA034_PROTOCOL, delegation_id: delegationId, delegation_hash: delegationHash, subject_id: subjectId, executor_id: executorId, commitment_hash: commitmentHash, scope, state: 'UNCONSUMED', version: 0, updated_at: new Date().toISOString() };
}

export function transition(entry, nextState, expectedVersion) {
  if (!entry || !VALID_STATES.includes(entry.state) || !VALID_STATES.includes(nextState)) return { decision: 'REJECT', code: 'STATE_INVALID' };
  if (entry.version !== expectedVersion) return { decision: 'REJECT', code: 'VERSION_CONFLICT' };
  const allowed = { UNCONSUMED: new Set(['RESERVED', 'REVOKED']), RESERVED: new Set(['CONSUMED', 'REVOKED']), CONSUMED: new Set(), REVOKED: new Set() };
  if (!allowed[entry.state].has(nextState)) return { decision: 'REJECT', code: 'ILLEGAL_TRANSITION' };
  return { decision: 'ACCEPT', entry: { ...entry, state: nextState, version: entry.version + 1, updated_at: new Date().toISOString() } };
}

export function reserve(entry) { return transition(entry, 'RESERVED', entry.version); }
export function consume(entry) { return transition(entry, 'CONSUMED', entry.version); }
export function revoke(entry) { return transition(entry, 'REVOKED', entry.version); }

export function ledgerHash(entry) { return sha256Hex(entry); }
