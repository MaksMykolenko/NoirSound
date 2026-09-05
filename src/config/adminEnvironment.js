import { isMockMode } from '../api/mode';

const configured = String(import.meta.env.VITE_APP_ENVIRONMENT || '').trim().toUpperCase();
const fallback = import.meta.env.PROD ? 'PRODUCTION' : 'DEVELOPMENT';
const mode = isMockMode() ? 'DEMO' : (['PRODUCTION', 'STAGING', 'DEVELOPMENT'].includes(configured) ? configured : fallback);

export const adminEnvironment = Object.freeze({
  mode,
  isDemo: mode === 'DEMO',
  isProduction: mode === 'PRODUCTION',
});
