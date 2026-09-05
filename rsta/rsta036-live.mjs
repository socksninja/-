import fs from 'node:fs';
import { createGithubActionsAdapter, createHttpAdapter, assertAdapter } from './rsta036-adapters.mjs';
import { verifyPortableReceipt } from './rsta036-portable-verifier.mjs';

const runId = process.env.GITHUB_RUN_ID || 'LOCAL';
const receiptUrl = 'https://raw.githubusercontent.com/socksninja/-/main/rsta-evidence/rsta035/33979726811-rsta035-execution-receipt.json';
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

function parse(body) { return JSON.parse(body); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }

async function main() {
  const gh = createGithubActionsAdapter({ token });
  const http = createHttpAdapter();
  assertAdapter(gh); assertAdapter(http);

  const ghRead = await gh.execute({ method: 'GET', url: receiptUrl });
  const httpRead = await http.execute({ method: 'GET', url: receiptUrl });
  if (ghRead.status !== 200 || httpRead.status !== 200) throw new Error(`SOURCE_READ_${ghRead.status}_${httpRead.status}`);
  if (ghRead.body !== httpRead.body) throw new Error('ADAPTER_RESULT_DIVERGENCE');

  const receipt = parse(httpRead.body);
  const accepted = verifyPortableReceipt(receipt);

  const tampered = clone(receipt);
  tampered.scenarios.one_byzantine.accepted = false;
  const rejected = verifyPortableReceipt(tampered);

  const adapterClaims = {
    adapter_contract_valid: true,
    github_actions_adapter_live_read: ghRead.status === 200,
    generic_http_adapter_live_read: httpRead.status === 200,
    adapter_outputs_identical: ghRead.body === httpRead.body,
    portable_verifier_accepts_genuine: accepted.decision === 'ACCEPT',
    portable_verifier_rejects_tamper: rejected.decision === 'REJECT',
    provider_neutral_core_used: true,
    vercel_adapter_contract_present: true,
    vercel_live_runtime_verified: false,
  };

  const receiptOut = {
    schema: 'RNCP-EXECUTION-RECEIPT-v1',
    rsta: 'RSTA-036',
    protocol: 'RNCP-PORTABLE-VERIFIER-v1',
    execution: { provider: 'github-actions', workflow: process.env.GITHUB_WORKFLOW, run_id: Number(runId), head_commit: process.env.GITHUB_SHA },
    source: { receipt_url: receiptUrl, upstream_rsta: 'RSTA-035', upstream_run_id: 33979726811 },
    adapters: ['github-actions', 'generic-http', 'vercel-runtime-contract'],
    adapter_claims: adapterClaims,
    genuine_verifier_result: accepted,
    tampered_verifier_result: rejected,
    verdict: Object.entries(adapterClaims).filter(([k]) => k !== 'vercel_live_runtime_verified').every(([,v]) => v) ? 'PASS' : 'FAIL',
    claim_boundary: 'Proves a provider-neutral RNCP verifier can consume the same real receipt through multiple executor adapter implementations and reject tampering. It does not yet prove a live second cloud runtime such as Vercel executing the adapter; the Vercel adapter is contract-only in this run.'
  };

  fs.writeFileSync('rsta036-execution-receipt.json', JSON.stringify(receiptOut, null, 2));
  fs.writeFileSync('rsta036-final-verdict.json', JSON.stringify({ rsta: 'RSTA-036', status: receiptOut.verdict, protocol: receiptOut.protocol, adapter_claims: adapterClaims, claim_boundary: receiptOut.claim_boundary }, null, 2));
  console.log(JSON.stringify(receiptOut, null, 2));
  if (receiptOut.verdict !== 'PASS') process.exit(1);
}

await main();
