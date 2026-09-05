const EXPECTED_IDENTITY = 'noirsound-web-e2e';

export default async function globalSetup(config) {
  const baseURLs = [...new Set(config.projects.map(project => project.use?.baseURL))];
  if (baseURLs.some(url => !url)) throw new Error('Playwright project is missing use.baseURL.');
  for (const baseURL of baseURLs) await verifyIdentity(baseURL);
  if (process.env.E2E_REQUIRE_REAL_SERVICES === 'true') {
    const database = new URL(process.env.DATABASE_URL);
    const api = new URL(process.env.VITE_API_BASE_URL);
    if (process.env.NODE_ENV === 'production' || database.hostname !== '127.0.0.1' || !database.pathname.endsWith('_test')
        || api.hostname !== '127.0.0.1' || process.env.VITE_USE_MOCK_API !== 'false') throw new Error('Release E2E requires isolated real test services.');
    const response = await fetch(`${api.toString().replace(/\/$/, '')}/ready`, { signal: AbortSignal.timeout(10_000) });
    const body = await response.json();
    if (!response.ok || body.status !== 'ready') throw new Error('Real API/storage/database/queue readiness is required; fixture-only fallback is forbidden.');
  }
}

async function verifyIdentity(baseURL) {
  const identityUrl = new URL('/noirsound-e2e-identity.json', baseURL);
  let response;
  try {
    response = await fetch(identityUrl, { signal: AbortSignal.timeout(10_000) });
  } catch (error) {
    throw new Error(`NoirSound E2E server identity check failed at ${identityUrl}: ${error.message}`);
  }

  if (!response.ok) {
    throw new Error(`NoirSound E2E server identity check returned HTTP ${response.status} at ${identityUrl}.`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Foreign server detected at ${identityUrl}: expected JSON, received ${contentType || 'unknown content type'}.`);
  }

  const identity = await response.json().catch(() => null);
  if (identity?.project !== EXPECTED_IDENTITY) {
    throw new Error(`Foreign server detected at ${identityUrl}: NoirSound identity marker is missing.`);
  }
}
