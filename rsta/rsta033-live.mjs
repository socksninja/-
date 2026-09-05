import fs from 'node:fs';
import https from 'node:https';
import { verifyCommitment } from './rncp-causal-commitment.mjs';
import { createExecutorIdentity, createExecutionRequest, verifyExecutionRequest } from './rsta030-external-executor.mjs';
import { parseJwt, verifyJwtRs256, authorizeExecutorIdentity, createAttestation } from './rsta032-executor-identity.mjs';
import { fixedDelegationPolicy, sha256Hex, verifyDelegation, consumeDelegation, createDelegatedRealityReceipt, verifyDelegatedRealityReceipt, RSTA033_PROTOCOL } from './rsta033-delegation.mjs';

const role = process.argv[2];
const repository = process.env.GITHUB_REPOSITORY;
const runId = process.env.GITHUB_RUN_ID;
const policy = fixedDelegationPolicy(repository);
const anchorFile = 'rsta032-execution-receipt.json';

const httpsGet = (url, headers = {}) => new Promise((resolve, reject) => {
  https.get(url, { headers }, (res) => { let data = ''; res.on('data', (x) => { data += x; }); res.on('end', () => resolve({ status: res.statusCode, body: data })); }).on('error', reject);
});
const httpsPost = (hostname, path, body, headers) => new Promise((resolve, reject) => {
  const payload = JSON.stringify(body);
  const req = https.request({ hostname, path, method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, (res) => { let data = ''; res.on('data', (x) => { data += x; }); res.on('end', () => resolve({ status: res.statusCode, body: data })); });
  req.on('error', reject); req.write(payload); req.end();
});

if (role === 'subject') {
  const prior = JSON.parse(fs.readFileSync(anchorFile, 'utf8'));
  if (prior.verdict !== 'PASS') throw new Error('RSTA-032 prerequisite invalid');
  const { createPrincipal, createCommitment } = await import('./rncp-causal-commitment.mjs');
  const subject = createPrincipal('SUBJECT-RSTA-033');
  const commitment = createCommitment({ subject, executorId: policy.executor_id, commitmentId: `RSTA-033-${runId}`, action: policy.action, prerequisites: { capability_token_id: 'RSTA-032-IDENTITY-PREREQUISITE', anchor_evidence_hash: prior.content_address }, predecessorEventHash: prior.chain.event_hash });
  const body = policy.body({ runId });
  const delegation = (await import('./rsta033-delegation.mjs')).createDelegation({ subject, delegationId: `RSTA-033-DELEGATION-${runId}`, executorId: policy.executor_id, commitmentHash: commitment.commitment_hash, action: policy.action, scope: { method: policy.method, path: policy.path, body_hash: sha256Hex(body) }, nonce: `${runId}:1` });
  fs.writeFileSync('rsta033-subject.json', JSON.stringify({ subject_public_key_pem: subject.publicKeyPem, commitment, delegation, execution_body: body, anchor: prior.content_address }, null, 2));
  console.log(JSON.stringify({ role, run_id: runId, delegation_id: delegation.delegation_id, commitment_hash: commitment.commitment_hash }, null, 2));
  process.exit(0);
}

if (role !== 'executor') throw new Error('ROLE_REQUIRED');
const intent = JSON.parse(fs.readFileSync('subject/rsta033-subject.json', 'utf8'));
const prior = JSON.parse(fs.readFileSync(anchorFile, 'utf8'));
const body = intent.execution_body;

const commitmentCheck = verifyCommitment(intent.commitment, { expectedExecutorId: policy.executor_id, expectedAction: policy.action, capabilityTokenId: 'RSTA-032-IDENTITY-PREREQUISITE', anchorEvidenceHash: prior.content_address });
if (commitmentCheck.decision !== 'ACCEPT') throw new Error(`commitment rejected: ${commitmentCheck.code}`);

const tokenUrl = `${process.env.ACTIONS_ID_TOKEN_REQUEST_URL}&audience=rsta-033`;
const tokenResponse = await httpsGet(tokenUrl, { Authorization: `bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` });
if (tokenResponse.status !== 200) throw new Error(`OIDC token request failed: ${tokenResponse.status}`);
const oidcToken = JSON.parse(tokenResponse.body).value;
const parsed = parseJwt(oidcToken);
const jwks = await httpsGet('https://token.actions.githubusercontent.com/.well-known/jwks');
if (jwks.status !== 200) throw new Error(`JWKS request failed: ${jwks.status}`);
const jwk = JSON.parse(jwks.body).keys.find((k) => k.kid === parsed.header.kid);
if (!jwk) throw new Error('OIDC signing key missing');
const jwtCheck = verifyJwtRs256(oidcToken, jwk);
if (jwtCheck.decision !== 'ACCEPT') throw new Error(`OIDC verification failed: ${jwtCheck.code}`);
const expectedIdentity = { executor_id: policy.executor_id, audience: 'rsta-033', repository, repository_id: process.env.GITHUB_REPOSITORY_ID, repository_visibility: 'public', workflow_ref: `${repository}/.github/workflows/rsta-033-executor-delegation.yml@refs/heads/main`, ref: process.env.GITHUB_REF, ref_type: 'branch', event_name: process.env.GITHUB_EVENT_NAME, runner_environment: 'github-hosted' };
const identity = authorizeExecutorIdentity(jwtCheck.payload, expectedIdentity);
if (identity.decision !== 'ACCEPT') throw new Error(`identity rejected: ${identity.code}`);
const attestation = createAttestation({ token: oidcToken, claims: jwtCheck.payload, executorId: identity.executor_id });
const attestationHash = sha256Hex(attestation);

const dctx = { subjectPublicKeyPem: intent.subject_public_key_pem, expectedSubjectId: intent.commitment.subject_id, expectedExecutorId: policy.executor_id, expectedCommitmentHash: intent.commitment.commitment_hash, expectedAction: policy.action, expectedMethod: policy.method, expectedPath: policy.path, expectedBodyHash: sha256Hex(body) };
if (verifyDelegation(intent.delegation, dctx).decision !== 'ACCEPT') throw new Error('valid delegation rejected');
if (verifyDelegation({ ...intent.delegation, subject_id: 'SUBJECT-ATTACKER' }, dctx).decision !== 'REJECT') throw new Error('subject substitution accepted');
if (verifyDelegation({ ...intent.delegation, executor_id: 'ATTACKER-EXECUTOR' }, dctx).decision !== 'REJECT') throw new Error('executor substitution accepted');
if (verifyDelegation({ ...intent.delegation, commitment_hash: '00'.repeat(32) }, dctx).decision !== 'REJECT') throw new Error('commitment substitution accepted');
if (verifyDelegation({ ...intent.delegation, action: 'DELETE_REPOSITORY' }, dctx).decision !== 'REJECT') throw new Error('action escalation accepted');
if (verifyDelegation({ ...intent.delegation, scope: { ...intent.delegation.scope, path: `/repos/${repository}/hooks` } }, dctx).decision !== 'REJECT') throw new Error('path escalation accepted');
if (verifyDelegation({ ...intent.delegation, scope: { ...intent.delegation.scope, body_hash: sha256Hex({ evil: true }) } }, dctx).decision !== 'REJECT') throw new Error('payload escalation accepted');
if (verifyDelegation({ ...intent.delegation, subject_signature: `${intent.delegation.subject_signature.slice(0, -2)}aa` }, dctx).decision !== 'REJECT') throw new Error('signature forgery accepted');
const consumed = new Set();
const firstUse = consumeDelegation(intent.delegation, consumed, dctx);
if (firstUse.decision !== 'ACCEPT') throw new Error(`delegation consumption failed: ${firstUse.code}`);
const replay = consumeDelegation(intent.delegation, consumed, dctx);
if (replay.decision !== 'REJECT' || replay.code !== 'DELEGATION_REPLAY') throw new Error('delegation replay accepted');

const executor = createExecutorIdentity(policy.executor_id);
const request = createExecutionRequest({ executor, requestId: `RSTA-033-REQ-${runId}`, commitmentHash: intent.commitment.commitment_hash, action: policy.action, method: policy.method, path: policy.path, body, capabilityTokenId: intent.delegation.delegation_id });
const requestCheck = verifyExecutionRequest(request, { executorPublicKeyPem: executor.publicKeyPem, expectedExecutorId: policy.executor_id, expectedCommitmentHash: intent.commitment.commitment_hash, expectedAction: policy.action, expectedMethod: policy.method, expectedPath: policy.path, expectedBodyHash: sha256Hex(body), expectedCapabilityTokenId: intent.delegation.delegation_id });
if (requestCheck.decision !== 'ACCEPT') throw new Error(`request rejected: ${requestCheck.code}`);

const api = await httpsPost('api.github.com', policy.path, body, { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'rsta-033-delegated-executor' });
if (api.status !== 201) throw new Error(`real external action failed: ${api.status} ${api.body}`);
const created = JSON.parse(api.body);
const delegatedReceipt = createDelegatedRealityReceipt({ executor, delegation: intent.delegation, commitmentHash: intent.commitment.commitment_hash, attestationHash, http: { status: api.status }, responseBody: created });
const receiptCheck = verifyDelegatedRealityReceipt(delegatedReceipt, { executorPublicKeyPem: executor.publicKeyPem, expectedDelegationId: intent.delegation.delegation_id, expectedCommitmentHash: intent.commitment.commitment_hash, expectedExecutorId: policy.executor_id, expectedStatus: 201, expectedAttestationHash: attestationHash });
if (receiptCheck.decision !== 'ACCEPT') throw new Error(`delegated receipt rejected: ${receiptCheck.code}`);

const guarantees = { commitment_verified: true, executor_identity_verified: true, delegation_signature_verified: true, delegation_subject_binding_verified: true, delegation_executor_binding_verified: true, delegation_commitment_binding_verified: true, delegation_action_scope_verified: true, delegation_endpoint_scope_verified: true, delegation_payload_scope_verified: true, subject_substitution_denied: true, executor_substitution_denied: true, commitment_substitution_denied: true, action_escalation_denied: true, endpoint_escalation_denied: true, payload_escalation_denied: true, signature_forgery_denied: true, delegation_consumed: true, delegation_replay_denied: true, request_scope_verified: true, real_external_api_action: true, delegated_reality_receipt_verified: true, receipt_binds_subject_and_executor: true };
const external_action = { system: 'GitHub REST API', method: policy.method, path: policy.path, status: api.status, issue_number: created.number, html_url: created.html_url };
const chain = { prior_rsta032_content_address: prior.content_address, commitment_hash: intent.commitment.commitment_hash, delegation_id: intent.delegation.delegation_id, delegation_hash: intent.delegation.delegation_hash, executor_attestation_hash: attestationHash, event_id: delegatedReceipt.event_id, event_hash: delegatedReceipt.event_hash };
const verdict = { rsta: 'RSTA-033', status: 'PASS', protocol: RSTA033_PROTOCOL, delegation: { subject_id: intent.delegation.subject_id, executor_id: intent.delegation.executor_id, action: intent.delegation.action, scope: intent.delegation.scope, nonce: intent.delegation.nonce }, executor_identity: identity, attestation, external_action, chain, guarantees, claim_boundary: 'This proves a subject-signed delegation constrains a named executor to a specific commitment, action, endpoint and payload, can be consumed once, and yields a delegated reality receipt bound to the executor identity. Other infrastructures require equivalent delegation enforcement.' };
const receipt = { schema: 'RNCP-EXECUTION-RECEIPT-v1', rsta: 'RSTA-033', execution: { provider: 'github-actions', workflow: process.env.GITHUB_WORKFLOW, run_id: Number(runId), job: 'rsta033-executor', head_commit: process.env.GITHUB_SHA, event: process.env.GITHUB_EVENT_NAME, ref: process.env.GITHUB_REF, generated_at: new Date().toISOString() }, assertions: guarantees, delegation: verdict.delegation, executor_identity: identity, attestation, external_action, chain, verdict: 'PASS' };
receipt.content_address = sha256Hex(receipt);
fs.writeFileSync('rsta033-final-verdict.json', JSON.stringify(verdict, null, 2));
fs.writeFileSync('rsta033-execution-receipt.json', JSON.stringify(receipt, null, 2));
fs.writeFileSync('rsta033-delegated-reality-receipt.json', JSON.stringify(delegatedReceipt, null, 2));
console.log(JSON.stringify(receipt, null, 2));
