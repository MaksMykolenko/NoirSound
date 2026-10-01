const { createRequire } = require('node:module');
const requireBackend = createRequire(require('node:path').resolve(__dirname, '../../backend/package.json'));
const { S3Client, CreateBucketCommand, HeadBucketCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = requireBackend('@aws-sdk/client-s3');

const { getSignedUrl } = requireBackend('@aws-sdk/s3-request-presigner');

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
  const key = 'compatibility/presigned-roundtrip.txt';
  const body = 'NoirSound isolated S3 compatibility probe';
  try {
    await client.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: body }));
    const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }), { expiresIn: 60 });
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok || await response.text() !== body) throw new Error('Presigned S3 readback mismatch');
    const anonymous = await fetch(new URL(`${process.env.S3_BUCKET}/${key}`, endpoint.toString().replace(/\/?$/, '/')), { signal: AbortSignal.timeout(10000) });
    if (anonymous.status !== 403) throw new Error('Integration bucket is not private');
  } finally {
    await client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
    client.destroy();
  }
  console.log('Private integration-test bucket and presigned S3 readback verified.');
}
main().catch(error => { console.error(error.name || 'Storage initialization failed'); process.exitCode = 1; });
