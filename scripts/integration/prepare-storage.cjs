const { createRequire } = require('node:module');
const requireBackend = createRequire(require('node:path').resolve(__dirname, '../../backend/package.json'));
const { S3Client, CreateBucketCommand, HeadBucketCommand } = requireBackend('@aws-sdk/client-s3');

async function main() {
  const endpoint = new URL(process.env.S3_ENDPOINT);
  if (process.env.NODE_ENV === 'production' || endpoint.hostname !== '127.0.0.1'
      || process.env.S3_BUCKET !== 'noirsound-integration-test') throw new Error('Test storage guard rejected configuration.');
  const client = new S3Client({
    endpoint: endpoint.toString(), region: 'us-east-1', forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
  });
  await client.send(new CreateBucketCommand({ Bucket: process.env.S3_BUCKET }));
  await client.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET }));
  client.destroy();
  console.log('Private integration-test bucket is ready.');
}
main().catch(error => { console.error(error.name || 'Storage initialization failed'); process.exitCode = 1; });
