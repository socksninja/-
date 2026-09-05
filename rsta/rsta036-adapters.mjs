export const RSTA036_ADAPTER_PROTOCOL = 'RNCP-EXECUTOR-ADAPTER-SPI-v1';

export function assertAdapter(adapter) {
  if (!adapter || typeof adapter.provider !== 'string' || typeof adapter.execute !== 'function') throw new Error('ADAPTER_CONTRACT_INVALID');
  return true;
}

export function createGithubActionsAdapter({ token }) {
  return {
    provider: 'github-actions',
    async execute({ method, url }) {
      const r = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
      return { status: r.status, body: await r.text() };
    },
  };
}

export function createHttpAdapter({ fetchImpl = fetch } = {}) {
  return {
    provider: 'generic-http',
    async execute({ method, url, headers = {} }) {
      const r = await fetchImpl(url, { method, headers: { Accept: 'application/json', ...headers } });
      return { status: r.status, body: await r.text() };
    },
  };
}

export function createVercelRuntimeAdapter() {
  return {
    provider: 'vercel-runtime',
    contract_only: true,
    execute() { throw new Error('VERCEL_LIVE_RUNTIME_NOT_CONFIGURED'); },
  };
}
