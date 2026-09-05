import crypto from 'node:crypto';

export const RSTA031_PROTOCOL = 'RNCP-EXECUTOR-POLICY-v1';

const canonical = (v) => v && typeof v === 'object'
  ? (Array.isArray(v) ? '[' + v.map(canonical).join(',') + ']' : '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}')
  : JSON.stringify(v);

export const sha256Hex = (v) => crypto.createHash('sha256').update(canonical(v)).digest('hex');

export function fixedExecutorPolicy(repository) {
  if (!repository) throw new Error('REPOSITORY_REQUIRED');
  return Object.freeze({
    protocol: RSTA031_PROTOCOL,
    executor_id: 'EXTERNAL-GITHUB-EXECUTOR',
    action: 'CREATE_GITHUB_ISSUE',
    method: 'POST',
    path: `/repos/${repository}/issues`,
    body: ({ runId }) => ({
      title: `RSTA-031 REALITY ${runId}`,
      body: 'Created only after the Executor policy independently authorizes the endpoint and payload.'
    }),
  });
}

export function authorizeExecutionRequest(request, policy, expectedBody) {
  if (!request || request.executor_id !== policy.executor_id) return { decision: 'REJECT', code: 'EXECUTOR_MISMATCH' };
  if (request.action !== policy.action) return { decision: 'REJECT', code: 'ACTION_NOT_ALLOWED' };
  if (request.method !== policy.method) return { decision: 'REJECT', code: 'METHOD_NOT_ALLOWED' };
  if (request.path !== policy.path) return { decision: 'REJECT', code: 'PATH_NOT_ALLOWED' };
  if (request.body_hash !== sha256Hex(expectedBody)) return { decision: 'REJECT', code: 'PAYLOAD_NOT_ALLOWED' };
  return { decision: 'ACCEPT', code: 'POLICY_ACCEPT' };
}
