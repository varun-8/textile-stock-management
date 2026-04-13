// Phase 7: Response Caching with ETags
// Caches responses with automatic invalidation

const NodeCache = require('node-cache');

class ResponseCacheManager {
  constructor(stdTTL = 600, checkperiod = 120) {
    this.cache = new NodeCache({ stdTTL, checkperiod });
  }

  /**
   * Middleware to cache GET responses
   * @param {number} ttl - Time to live in seconds
   * @returns {Function} Express middleware
   */
  middleware(ttl = 600) {
    return (req, res, next) => {
      // Only cache GET requests
      if (req.method !== 'GET') return next();

      const key = `${req.method}:${req.originalUrl}`;
      const cached = this.cache.get(key);

      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
      }

      // Intercept res.json() to cache response
      const originalJson = res.json.bind(res);
      res.json = function (data) {
        this.cache.set(key, data, ttl);
        res.setHeader('X-Cache', 'MISS');
        return originalJson(data);
      }.bind(this);

      next();
    };
  }

  /**
   * Invalidate cache by pattern
   * @param {string|RegExp} pattern - Pattern to match cache keys
   */
  invalidate(pattern) {
    const keys = this.cache.keys();
    keys.forEach(key => {
      if (typeof pattern === 'string' && key.includes(pattern)) {
        this.cache.del(key);
      } else if (pattern instanceof RegExp && pattern.test(key)) {
        this.cache.del(key);
      }
    });
  }

  /**
   * Clear entire cache
   */
  clear() {
    this.cache.flushAll();
  }
}

module.exports = { ResponseCacheManager };
