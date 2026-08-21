'use strict';

const EventEmitter = require('events');
const Redis = require('ioredis');

class InMemoryPresenceStore extends EventEmitter {
  constructor() {
    super();
    this.store = new Map();
    this.timers = new Map();
  }

  async get(key) {
    return this.store.get(key) || null;
  }

  async set(key, value, mode, ttlSeconds) {
    this.store.set(key, value);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    if (ttlSeconds && Number(ttlSeconds) > 0) {
      const timer = setTimeout(() => {
        this.store.delete(key);
        this.timers.delete(key);
      }, Number(ttlSeconds) * 1000);
      timer.unref?.();
      this.timers.set(key, timer);
    }
    return 'OK';
  }

  async del(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    return this.store.delete(key) ? 1 : 0;
  }

  async publish(channel, message) {
    this.emit(`channel:${channel}`, message);
    return 1;
  }

  createSubscriber(channel, onMessage) {
    const eventName = `channel:${channel}`;
    const handler = (message) => onMessage(message);
    this.on(eventName, handler);
    return () => {
      this.off(eventName, handler);
    };
  }

  async close() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.store.clear();
    this.timers.clear();
    this.removeAllListeners();
  }
}

class RedisPresenceManager {
  constructor(options = {}) {
    this.isTest = options.isTest || process.env.NODE_ENV === 'test';
    this.redisUrl = options.redisUrl || process.env.REDIS_URL;
    this.redisHost = options.redisHost || process.env.REDIS_HOST;
    this.redisPort = Number(options.redisPort || process.env.REDIS_PORT || 6379);

    if (this.isTest || (!this.redisUrl && !this.redisHost)) {
      this.inMemory = new InMemoryPresenceStore();
      this.client = null;
      this.subClient = null;
    } else {
      this.inMemory = null;
      const connectionOptions = {
        maxRetriesPerRequest: 2,
        enableOfflineQueue: true,
        lazyConnect: false,
        connectionName: 'noirsound-desktop-presence'
      };
      this.client = this.redisUrl
        ? new Redis(this.redisUrl, connectionOptions)
        : new Redis({
            host: this.redisHost,
            port: this.redisPort,
            ...connectionOptions
          });

      this.client.on('error', () => {
        // gracefully handle logging
      });

      this.subscribers = new Map(); // channel -> Set<callback>
    }
  }

  async get(key) {
    if (this.inMemory) return this.inMemory.get(key);
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async set(key, value, ttlSeconds = null) {
    if (this.inMemory) return this.inMemory.set(key, value, 'EX', ttlSeconds);
    try {
      if (ttlSeconds && Number(ttlSeconds) > 0) {
        return await this.client.set(key, value, 'EX', Number(ttlSeconds));
      }
      return await this.client.set(key, value);
    } catch {
      return null;
    }
  }

  async del(key) {
    if (this.inMemory) return this.inMemory.del(key);
    try {
      return await this.client.del(key);
    } catch {
      return 0;
    }
  }

  async publish(channel, message) {
    const stringMessage = typeof message === 'string' ? message : JSON.stringify(message);
    if (this.inMemory) return this.inMemory.publish(channel, stringMessage);
    try {
      return await this.client.publish(channel, stringMessage);
    } catch {
      return 0;
    }
  }

  async subscribe(channel, onMessage) {
    if (this.inMemory) {
      return this.inMemory.createSubscriber(channel, onMessage);
    }

    if (!this.subClient) {
      const subOptions = {
        maxRetriesPerRequest: 2,
        connectionName: 'noirsound-desktop-sub'
      };
      this.subClient = this.redisUrl
        ? new Redis(this.redisUrl, subOptions)
        : new Redis({
            host: this.redisHost,
            port: this.redisPort,
            ...subOptions
          });

      this.subClient.on('message', (ch, msg) => {
        const callbacks = this.subscribers.get(ch);
        if (callbacks) {
          for (const cb of callbacks) {
            try {
              cb(msg);
            } catch {
              // ignore callback error
            }
          }
        }
      });
    }

    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
      await this.subClient.subscribe(channel);
    }

    const callbacks = this.subscribers.get(channel);
    callbacks.add(onMessage);

    return async () => {
      callbacks.delete(onMessage);
      if (callbacks.size === 0) {
        this.subscribers.delete(channel);
        try {
          if (this.subClient) {
            await this.subClient.unsubscribe(channel);
          }
        } catch {
          // ignore
        }
      }
    };
  }

  async close() {
    if (this.inMemory) {
      await this.inMemory.close();
    }
    if (this.client) {
      try { await this.client.quit(); } catch { /* noop */ }
    }
    if (this.subClient) {
      try { await this.subClient.quit(); } catch { /* noop */ }
    }
  }
}

let defaultInstance = null;

function getPresenceManager(options) {
  if (options) return new RedisPresenceManager(options);
  if (!defaultInstance) {
    defaultInstance = new RedisPresenceManager();
  }
  return defaultInstance;
}

module.exports = {
  RedisPresenceManager,
  getPresenceManager
};
