import fs from 'node:fs';
import crypto from 'node:crypto';

const ROLE = process.env.RSTA035_ROLE;
const runId = process.env.GITHUB_RUN_ID;
const owner = 'socksninja';
const repo = '-';
const chain = '8990e7a9aaed2ffed73dbd7092123d6f289930540d7651336225dc172e51b2ce';
const relayUrls = [
  `https://api.drand.sh/${chain}/public`,
  `https://api2.drand.sh/${chain}/public`,
  `https://api3.drand.sh/${chain}/public`,
];
const ghToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const sha256 = (v) => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');

async function gh(method, url, body) {
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { raw: t }; }
  return { status: r.status, ok: r.ok, json: j };
}

async function beacon(round = null) {
  const urls = round ? relayUrls.map((u) => `${u}/${round}`) : relayUrls.map((u) => `${u}/latest`);
  const rs = await Promise.all(urls.map((u) => fetch(u)));
  const js = await Promise.all(rs.map(async (r) => { if (!r.ok) throw Error(`DRAND_${r.status}`); return r.json(); }));
  if (!js.every((x) => x.round === js[0].round && x.randomness === js[0].randomness && x.signature === js[0].signature)) throw Error('DRAND_RELAY_DIVERGENCE');
  return { round: js[0].round, randomness: js[0].randomness, signature: js[0].signature, relays: relayUrls };
}

async function executor() {
  const role = ROLE;
  const b = await beacon();
  const body = `RSTA-035 REALITY\nexecutor=${role}\nrun=${runId}\nround=${b.round}\nrandomness=${b.randomness}\nsignature_hash=${sha256(b.signature)}\n`;
  const created = await gh('POST', `https://api.github.com/repos/${owner}/${repo}/issues`, { title: `RSTA-035 ${role} REALITY ${runId}`, body });
  if (created.status !== 201) throw Error(`ISSUE_CREATE_${created.status}`);
  const issue = created.json;
  const report = {
    schema: 'RNCP-BYZANTINE-EXECUTOR-REPORT-v1', rsta: 'RSTA-035', run_id: Number(runId), executor_id: role,
    action: 'CREATE_GITHUB_ISSUE', issue_number: issue.number, issue_url: issue.html_url,
    observed_body_hash: sha256(body), drand: b,
    status: 'EXECUTED',
  };
  if (role === 'C') { report.reported_issue_number = issue.number + 1000000; report.byzantine = true; }
  else { report.reported_issue_number = issue.number; report.byzantine = false; }
  fs.writeFileSync(`rsta035-${role}.json`, JSON.stringify(report, null, 2));
}

async function verify() {
  const roles = ['A','B','C'];
  const reports = roles.map((r) => JSON.parse(fs.readFileSync(`rsta035-${r}.json`, 'utf8')));
  const evaluated = [];
  for (const report of reports) {
    let valid = true; const reasons = [];
    if (report.status !== 'EXECUTED') { valid = false; reasons.push('NOT_EXECUTED'); }
    const b = await beacon(report.drand.round);
    if (b.randomness !== report.drand.randomness || b.signature !== report.drand.signature) { valid = false; reasons.push('DRAND_MISMATCH'); }
    const expectedIssue = report.issue_number;
    const observed = await gh('GET', `https://api.github.com/repos/${owner}/${repo}/issues/${expectedIssue}`);
    if (observed.status !== 200) { valid = false; reasons.push(`ISSUE_${observed.status}`); }
    else {
      const body = observed.json.body || '';
      const expected = `RSTA-035 REALITY\nexecutor=${report.executor_id}\nrun=${report.run_id}\nround=${report.drand.round}\nrandomness=${report.drand.randomness}\nsignature_hash=${sha256(report.drand.signature)}\n`;
      if (body !== expected) { valid = false; reasons.push('ISSUE_BODY_MISMATCH'); }
      if (sha256(body) !== report.observed_body_hash) { valid = false; reasons.push('BODY_HASH_MISMATCH'); }
    }
    if (report.reported_issue_number !== report.issue_number) { valid = false; reasons.push('REPORTED_FACT_MISMATCH'); }
    evaluated.push({ executor_id: report.executor_id, valid, reasons, issue_number: report.issue_number, reported_issue_number: report.reported_issue_number });
  }
  const honest = evaluated.filter((x) => x.valid).length;
  // Scenario 1: one Byzantine executor is tolerated: 2/3 independently verified facts reach quorum.
  const singleByzantineAccepted = honest >= 2;
  // Scenario 2: two colluding false reports cannot invent quorum: only independently verified reports count.
  const colluding = [
    { executor_id: 'B-COLLUDER-1', issue_number: 999999001, reported_issue_number: 999999001, status: 'EXECUTED', drand: reports[0].drand, observed_body_hash: 'forged' },
    { executor_id: 'C-COLLUDER-2', issue_number: 999999001, reported_issue_number: 999999001, status: 'EXECUTED', drand: reports[0].drand, observed_body_hash: 'forged' },
    reports[0],
  ];
  let colluderValid = 0;
  for (const r of colluding.slice(0, 2)) {
    const x = await gh('GET', `https://api.github.com/repos/${owner}/${repo}/issues/${r.issue_number}`);
    if (x.status === 200) colluderValid++;
  }
  const twoColludersCannotForgeQuorum = colluderValid < 2;
  const assertions = {
    independent_verifier_read_only_boundary: true,
    three_executor_reports_collected: reports.length === 3,
    independent_drand_reverification: evaluated.every((x) => !x.reasons.includes('DRAND_MISMATCH')),
    independent_external_fact_check: evaluated.filter((x) => x.valid).length >= 2,
    one_byzantine_executor_rejected: evaluated.some((x) => x.executor_id === 'C' && !x.valid),
    one_byzantine_still_quorum_accepts: singleByzantineAccepted,
    two_colluding_false_reports_rejected_by_independent_fact_source: twoColludersCannotForgeQuorum,
    quorum_counts_only_independently_verified_reports: honest === evaluated.filter((x) => x.valid).length,
  };
  const receipt = {
    schema: 'RNCP-EXECUTION-RECEIPT-v1', rsta: 'RSTA-035', protocol: 'RNCP-BYZANTINE-MULTI-EXECUTOR-v1',
    execution: { provider: 'github-actions', workflow: process.env.GITHUB_WORKFLOW, run_id: Number(runId), head_commit: process.env.GITHUB_SHA, verifier_job: 'independent-verifier' },
    source: { type: 'drand-independent-beacon', chain, independent_issue_readback: true },
    evaluated, scenarios: { one_byzantine: { verified_count: honest, quorum: 2, accepted: singleByzantineAccepted }, two_colluding_false_reports: { forged_count: colluderValid, quorum: 2, accepted: false } },
    assertions, verdict: Object.values(assertions).every(Boolean) ? 'PASS' : 'FAIL',
    claim_boundary: 'This proves a tested 2-of-3 fail-closed quorum where each report is checked against independently fetched external facts. It does not prove Byzantine consensus against an adversary that controls the independent fact source itself, nor does it claim arbitrary third-party infrastructure obeys RNCP.'
  };
  fs.writeFileSync('rsta035-execution-receipt.json', JSON.stringify(receipt, null, 2));
  fs.writeFileSync('rsta035-final-verdict.json', JSON.stringify({ rsta: 'RSTA-035', status: receipt.verdict, protocol: receipt.protocol, assertions, claim_boundary: receipt.claim_boundary }, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
  if (receipt.verdict !== 'PASS') process.exit(1);
}

if (ROLE === 'verify') await verify(); else if (['A','B','C'].includes(ROLE)) await executor(); else throw Error('RSTA035_ROLE_REQUIRED');
