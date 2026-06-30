const { Queue } = require('bullmq');

function getRedisConnection() {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    return {
      host: url.hostname,
      port: Number(url.port || 6379),
      username: url.username || undefined,
      password: url.password || undefined,
      maxRetriesPerRequest: null
    };
  }

  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6379),
    maxRetriesPerRequest: null
  };
}

function createAudioQueue() {
  return new Queue('audioProcessingQueue', {
    connection: getRedisConnection()
  });
}

module.exports = {
  createAudioQueue,
  getRedisConnection
};
