import crypto from 'node:crypto';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export async function GET(request) {
  const url = new URL(request.url);
  const nonce = url.searchParams.get('nonce');
  if (!nonce || !/^[A-Za-z0-9._:-]{1,128}$/.test(nonce)) {
    return Response.json({ ok: false, error: 'INVALID_NONCE' }, { status: 400 });
  }

  const startedAt = new Date().toISOString();
  const issueUrl = 'https://api.github.com/repos/socksninja/-/issues/131';
  const anchorUrl = 'https://raw.githubusercontent.com/socksninja/-/main/rsta-evidence/rsta035/33979726811-rsta035-execution-receipt.json';
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'rncp-rsta037-vercel-executor' };

  try {
    const [issueResponse, anchorResponse] = await Promise.all([
      fetch(issueUrl, { headers, cache: 'no-store' }),
      fetch(anchorUrl, { cache: 'no-store' })
    ]);
    const issueText = await issueResponse.text();
    const anchorText = await anchorResponse.text();
    const issueHash = sha256(issueText);
    const anchorHash = sha256(anchorText);
    const executionHash = sha256(JSON.stringify({
      provider: 'vercel', nonce, issueStatus: issueResponse.status, issueHash,
      anchorStatus: anchorResponse.status, anchorHash,
      vercelRegion: process.env.VERCEL_REGION || null, startedAt
    }));
    const ok = issueResponse.ok && anchorResponse.ok;
    return Response.json({
      schema: 'RNCP-RSTA037-VERCEL-EXECUTION-v1', ok,
      provider: 'vercel', runtime: 'vercel-lambda', nonce,
      external_actions: [
        { method: 'GET', url: issueUrl, status: issueResponse.status, response_sha256: issueHash },
        { method: 'GET', url: anchorUrl, status: anchorResponse.status, response_sha256: anchorHash }
      ],
      execution_sha256: executionHash,
      region: process.env.VERCEL_REGION || null,
      timestamp: startedAt
    }, { status: ok ? 200 : 502 });
  } catch (error) {
    return Response.json({ schema: 'RNCP-RSTA037-VERCEL-EXECUTION-v1', ok: false,
      provider: 'vercel', runtime: 'vercel-lambda', nonce,
      error: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
