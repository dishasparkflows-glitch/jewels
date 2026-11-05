const Redis = require('ioredis');
const { CACHE_TTL } = require('../config/constants');

/**
 * Production-ready Redis Client utility.
 * Supports REDIS_URL, individual host/port/auth configs, TLS, auto JSON serialization/deserialization,
 * SCAN-based pattern deletion, and cache-aside (getOrSet).
 */
class RedisClient {
  constructor(customConfig = null) {
    this.client = null;
    this.isConnected = false;
    this.init(customConfig);
  }

  /**
   * Initializes the Redis connection directly using REDIS_URL.
   *
   * @param {string|object|null} customConfig Optional custom URL or config
   */
  init(customConfig = null) {
    try {
      if (this.client && !customConfig && (this.isConnected || this.client.status === 'ready' || this.client.status === 'connecting')) {
        return;
      }
      if (this.client) {
        try {
          this.client.disconnect();
        } catch (_) {}
      }

      const redisUrl = (typeof customConfig === 'string' && customConfig.trim())
        ? customConfig.trim()
        : (process.env.REDIS_URL || '');

      if (!redisUrl) {
        return;
      }

      const isTls = redisUrl.startsWith('rediss://');

      this.client = new Redis(redisUrl, {
        retryStrategy: (times) => Math.min(times * 50, 2000),
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        lazyConnect: false,
        ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
      });

      this.client.on('connect', () => {
        console.log('Redis client connected successfully');
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        console.log('Redis client ready to accept commands');
      });

      this.client.on('error', (error) => {
        console.error('Redis client error:', error.message);
      });

      this.client.on('close', () => {
        this.isConnected = false;
        console.log('Redis client connection closed');
      });

      this.client.on('reconnecting', () => {
        this.isConnected = false;
        console.log('Redis client reconnecting...');
      });

      this.client.on('end', () => {
        this.isConnected = false;
        console.log('Redis client connection ended');
      });
    } catch (error) {
      console.error('Failed to initialize Redis client:', error);
    }
  }

  /**
   * Check whether Redis connection is ready to accept commands
   *
   * @returns {boolean}
   */
  isReady() {
    return Boolean(this.client && this.client.status === 'ready');
  }

  /**
   * Ensures the Redis client is ready before executing commands.
   * If connecting, awaits up to timeoutMs for 'ready' event.
   *
   * @param {number} [timeoutMs=2500]
   * @returns {Promise<boolean>}
   */
  async ensureReady(timeoutMs = 2500) {
    if (!this.client) return false;
    if (this.client.status === 'ready') return true;
    if (['close', 'end'].includes(this.client.status)) return false;

    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(this.isReady()), timeoutMs);
      const onReady = () => {
        clearTimeout(timer);
        this.client?.removeListener('ready', onReady);
        this.client?.removeListener('error', onError);
        resolve(true);
      };
      const onError = () => {
        clearTimeout(timer);
        this.client?.removeListener('ready', onReady);
        this.client?.removeListener('error', onError);
        resolve(false);
      };
      this.client.once('ready', onReady);
      this.client.once('error', onError);
    });
  }

  /**
   * Returns current Redis connection status string
   *
   * @returns {string} e.g. 'ready', 'connecting', 'reconnecting', 'close', 'disconnected'
   */
  getStatus() {
    return this.client ? this.client.status : 'disconnected';
  }

  /**
   * Direct access to underlying ioredis client instance
   *
   * @returns {Redis|null}
   */
  getClient() {
    return this.client;
  }

  /**
   * Pings the Redis server.
   *
   * @returns {Promise<boolean>} True if server responds with 'PONG'
   */
  async ping() {
    try {
      if (!this.client) {
        return false;
      }

      await this.ensureReady(3000);
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis ping error:', error.message);
      return false;
    }
  }

  /**
   * Helper to safely serialize values before saving to Redis
   *
   * @param {*} value
   * @returns {string}
   */
  _serialize(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Helper to safely deserialize values retrieved from Redis
   *
   * @param {string|null} value
   * @returns {*}
   */
  _deserialize(value) {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return value;

    const trimmed = value.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }

  /**
   * Retrieves a cached value by key. Auto-deserializes JSON objects and arrays.
   *
   * @param {string} key Cache key
   * @returns {Promise<*|null>}
   */
  async get(key) {
    try {
      if (!this.isReady()) {
        const ready = await this.ensureReady();
        if (!ready) return null;
      }
      const value = await this.client.get(key);
      if (value === null) return null;
      return this._deserialize(value);
    } catch (error) {
      console.error('Redis get error:', error.message);
      return null;
    }
  }

  /**
   * Sets a key value with optional expiration TTL (in seconds).
   *
   * @param {string} key Cache key
   * @param {*} value Value to store (auto JSON serialized if object/array)
   * @param {number|null} [ttl] Optional expiration TTL in seconds
   * @returns {Promise<boolean>}
   */
  async set(key, value, ttl = null) {
    try {
      if (!this.isReady()) {
        const ready = await this.ensureReady();
        if (!ready) return false;
      }
      const serialized = this._serialize(value);
      if (ttl && Number.isInteger(Number(ttl)) && Number(ttl) > 0) {
        await this.client.set(key, serialized, 'EX', Number(ttl));
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (error) {
      console.error('Redis set error:', error.message);
      return false;
    }
  }

  /**
   * Deletes one or multiple keys.
   *
   * @param {...string|string[]} keys Single key, list of keys, or array of keys
   * @returns {Promise<boolean>}
   */
  async del(...keys) {
    try {
      if (!this.isReady()) {
        const ready = await this.ensureReady();
        if (!ready) return false;
      }
      const targetKeys = keys.flat().filter(Boolean);
      if (targetKeys.length === 0) return true;

      const count = await this.client.del(...targetKeys);
      return count > 0;
    } catch (error) {
      console.error('Redis del error:', error.message);
      return false;
    }
  }

  /**
   * Alias for del
   */
  async delete(...keys) {
    return this.del(...keys);
  }

  /**
   * Safe, non-blocking scan to find keys matching a pattern.
   * Uses Redis SCAN stream instead of blocking KEYS command for production safety.
   *
   * @param {string} [pattern='*'] Search pattern (e.g. 'r:*')
   * @returns {Promise<string[]>}
   */
  async keys(pattern = '*') {
    try {
      if (!this.isReady()) {
        const ready = await this.ensureReady();
        if (!ready) return [];
      }

      return new Promise((resolve, reject) => {
        const matchingKeys = [];
        const stream = this.client.scanStream({
          match: pattern,
          count: 100,
        });

        stream.on('data', (resultKeys = []) => {
          for (let i = 0; i < resultKeys.length; i++) {
            matchingKeys.push(resultKeys[i]);
          }
        });

        stream.on('end', () => resolve(matchingKeys));
        stream.on('error', (err) => reject(err));
      });
    } catch (error) {
      console.error('Redis keys error:', error.message);
      return [];
    }
  }

  /**
   * Safely deletes all keys matching a specific pattern using non-blocking SCAN.
   *
   * @param {string} pattern Pattern to match and delete (e.g. 'r:*')
   * @returns {Promise<number>} Number of deleted keys
   */
  async delByPattern(pattern) {
    try {
      if (!pattern) {
        return 0;
      }
      if (!this.isReady()) {
        const ready = await this.ensureReady();
        if (!ready) return 0;
      }

      const matchingKeys = await this.keys(pattern);
      if (matchingKeys.length === 0) {
        return 0;
      }

      // Delete in batches of 500 to keep commands light
      const chunkSize = 500;
      let totalDeleted = 0;
      for (let i = 0; i < matchingKeys.length; i += chunkSize) {
        const chunk = matchingKeys.slice(i, i + chunkSize);
        totalDeleted += await this.client.del(...chunk);
      }
      return totalDeleted;
    } catch (error) {
      console.error('Redis delByPattern error:', error.message);
      return 0;
    }
  }

  /**
   * Alias for delByPattern
   *
   * @param {string} pattern Pattern to match and delete (e.g. 'r:*')
   * @returns {Promise<number>} Number of deleted keys
   */
  async deleteByPattern(pattern) {
    return this.delByPattern(pattern);
  }

  /**
   * Cache-Aside Helper:
   * Returns cached value if available. Otherwise invokes fetchFn, caches result with TTL, and returns it.
   *
   * @param {string} key Cache key
   * @param {number} [ttl=3600] TTL in seconds
   * @param {Function} fetchFn Async function returning fresh data
   * @returns {Promise<*>}
   */
  async getOrSet(key, ttl = CACHE_TTL || 86400, fetchFn) {
    if (typeof ttl === 'function' && !fetchFn) {
      fetchFn = ttl;
      ttl = CACHE_TTL || 86400;
    }

    try {
      const cached = await this.get(key);
      if (cached !== null && cached !== undefined) {
        return cached;
      }
    } catch (err) {
      console.warn(`Cache fetch error for key "${key}", falling back to fetch callback: ${err.message}`);
    }

    const freshData = await fetchFn();
    if (freshData !== null && freshData !== undefined) {
      await this.set(key, freshData, ttl);
    }
    return freshData;
  }

  /**
   * Gracefully disconnects from Redis waiting for pending commands to finish.
   *
   * @returns {Promise<boolean>}
   */
  async quit() {
    try {
      if (this.client) {
        await this.client.quit();
        this.isConnected = false;
        console.log('Redis client disconnected gracefully');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Redis quit error:', error.message);
      return false;
    }
  }
}

// Instantiate default singleton instance
const redisClient = new RedisClient();

/**
 * Production-ready Cache Helper wrapping Redis Client.
 * Implements cache-aside pattern (getOrSet) and safe pattern invalidation.
 */
const cacheHelper = {
  /**
   * Cache-Aside Helper:
   * Returns cached value if available. Otherwise invokes fetchFn, caches result with TTL, and returns it.
   *
   * @param {string} key Cache key (e.g. 'r:admin:list:1:10:')
   * @param {number} [ttl=3600] TTL in seconds (default 1 hour)
   * @param {Function} fetchFn Async callback returning fresh data
   * @returns {Promise<*>}
   */
  async getOrSet(key, ttl = 3600, fetchFn) {
    return redisClient.getOrSet(key, ttl, fetchFn);
  },

  /**
   * Retrieves a cached value by key.
   *
   * @param {string} key Cache key
   * @returns {Promise<*|null>}
   */
  async get(key) {
    return redisClient.get(key);
  },

  /**
   * Sets a cache key with TTL.
   *
   * @param {string} key Cache key
   * @param {*} value Value to store
   * @param {number} [ttl=3600] TTL in seconds
   * @returns {Promise<boolean>}
   */
  async set(key, value, ttl = 3600) {
    return redisClient.set(key, value, ttl);
  },

  /**
   * Deletes one or multiple keys.
   *
   * @param {...string|string[]} keys
   * @returns {Promise<boolean>}
   */
  async del(...keys) {
    return redisClient.del(...keys);
  },

  /**
   * Safely deletes all keys matching a specific pattern using non-blocking SCAN.
   *
   * @param {string} pattern Search pattern (e.g. 'r:*')
   * @returns {Promise<number>} Number of deleted keys
   */
  async deleteByPattern(pattern) {
    return redisClient.deleteByPattern(pattern);
  },

  /**
   * Alias for deleteByPattern
   */
  async delByPattern(pattern) {
    return redisClient.deleteByPattern(pattern);
  }
};

// Attach cacheHelper to redisClient instance as well
redisClient.cacheHelper = cacheHelper;

module.exports = redisClient;
module.exports.redisClient = redisClient;
module.exports.cacheHelper = cacheHelper;
module.exports.RedisClient = RedisClient;
module.exports.default = redisClient;
