const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'minioadmin'
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false'
});

// Server-side object operations use the private endpoint above. Presigned URLs
// must use an endpoint the browser can reach (Caddy in production).
const presignClient = new S3Client({
  endpoint: process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT || 'http://localhost:9000',
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'minioadmin'
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false'
});

const BUCKET = process.env.S3_BUCKET || 'noirsound-audio';

async function createPresignedPutUrl(key, mimeType, expiresIn = 900, contentLength) {
  const input = {
    Bucket: BUCKET,
    Key: key,
    ContentType: mimeType
  };
  if (Number.isInteger(contentLength) && contentLength > 0) {
    input.ContentLength = contentLength;
  }
  const command = new PutObjectCommand(input);
  return getSignedUrl(presignClient, command, { expiresIn });
}

async function createPresignedGetUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key
  });
  return getSignedUrl(presignClient, command, { expiresIn });
}

async function getPublicOrSignedUrl(key) {
  // All objects stay private. Public tracks are delivered through expiring
  // signed URLs, while original upload keys are never exposed by a route.
  return createPresignedGetUrl(key);
}

async function getObjectMetadata(key) {
  try {
    const command = new HeadObjectCommand({ Bucket: BUCKET, Key: key });
    const response = await s3Client.send(command);
    return {
      exists: true,
      size: response.ContentLength,
      mimeType: response.ContentType
    };
  } catch (err) {
    if (
      err.name === 'NotFound' ||
      err.name === 'NoSuchKey' ||
      err.$metadata?.httpStatusCode === 404
    ) {
      return { exists: false };
    }
    throw err;
  }
}

async function objectExists(key) {
  const meta = await getObjectMetadata(key);
  return meta.exists;
}

async function checkHealth() {
  await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET }));
  return true;
}

async function putObject(key, body, mimeType) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: mimeType
  });
  return s3Client.send(command);
}

async function getObjectStream(key) {
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: BUCKET,
    Key: key
  }));
  return response.Body;
}

async function getObjectPrefix(key, byteLength = 16) {
  const length = Math.max(1, Math.min(1024, Number(byteLength) || 16));
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Range: `bytes=0-${length - 1}`
  }));
  const body = response.Body;
  if (body && typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray()).subarray(0, length);
  }

  const chunks = [];
  let total = 0;
  for await (const chunk of body || []) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const remaining = length - total;
    if (remaining <= 0) break;
    chunks.push(buffer.subarray(0, remaining));
    total += Math.min(buffer.length, remaining);
    if (total >= length) break;
  }
  return Buffer.concat(chunks, total);
}

async function copyObject(sourceKey, destinationKey) {
  return s3Client.send(new CopyObjectCommand({
    Bucket: BUCKET,
    CopySource: encodeURI(`${BUCKET}/${sourceKey}`),
    Key: destinationKey,
    MetadataDirective: 'COPY'
  }));
}

async function listObjectsByPrefix(prefix) {
  const objects = [];
  let continuationToken;
  do {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken
    }));
    for (const object of response.Contents || []) {
      if (!object.Key) continue;
      objects.push({
        key: object.Key,
        lastModified: object.LastModified || null,
        size: Number(object.Size || 0)
      });
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);
  return objects;
}

async function deleteObject(key) {
  return s3Client.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key
  }));
}

module.exports = {
  s3Client,
  presignClient,
  BUCKET,
  createPresignedPutUrl,
  createPresignedGetUrl,
  getPublicOrSignedUrl,
  checkHealth,
  objectExists,
  getObjectMetadata,
  putObject,
  getObjectStream,
  getObjectPrefix,
  copyObject,
  listObjectsByPrefix,
  deleteObject
};
