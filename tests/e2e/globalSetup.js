const EXPECTED_IDENTITY = 'noirsound-web-e2e';

export default async function globalSetup(config) {
  const baseURL = config.projects[0]?.use?.baseURL;
  if (!baseURL) throw new Error('Playwright project is missing use.baseURL.');

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
