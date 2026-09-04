// Use the normal app/configuration with a loopback-only listener for tests.
const buildServer = require('../../backend/src/index');
const { loadAndValidateConfig } = require('../../backend/src/config');
async function main() {
  if (process.env.NODE_ENV === 'production' || !/^noirsound-verify-[a-f0-9]{12}$/.test(process.env.COMPOSE_PROJECT_NAME || '')) throw new Error('Isolated integration environment required.');
  const config = loadAndValidateConfig();
  const app = buildServer();
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); process.exit(0); });
  await app.listen({ host: '127.0.0.1', port: config.port });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
