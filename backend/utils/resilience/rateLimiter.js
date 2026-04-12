// Phase 6: Advanced Rate Limiting
// Per-IP rate limiting with configurable rules

class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000; // 1 minute
    this.maxRequests = options.maxRequests || 100;
    this.keyPrefix = options.keyPrefix || 'rate-limit';
    this.store = new Map();
  }

  /**
   * Get rate limit key for a request
   */
  getKey(req) {
    const ip = req.ip || req.connection.remoteAddress;
    const userId = req.user?.id || 'anonymous';
    return `${this.keyPrefix}:${ip}:${userId}`;
  }

  /**
   * Rate limiting middleware
   */
  middleware(options = {}) {
    const maxRequests = options.maxRequests || this.maxRequests;
    const windowMs = options.windowMs || this.windowMs;

    return (req, res, next) => {
      const key = this.getKey(req);
      const now = Date.now();
      const window = Math.floor(now / windowMs);

      // Get current bucket
      const bucket = this.store.get(key) || { window: window, count: 0 };

      // Reset if new window
      if (bucket.window !== window) {
        bucket.window = window;
        bucket.count = 0;
      }

      // Increment request count
      bucket.count++;
      this.store.set(key, bucket);

      // Set headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - bucket.count));

      // Check limit
      if (bucket.count > maxRequests) {
        const resetTime = new Date((window + 1) * windowMs);
        res.setHeader('X-RateLimit-Reset', resetTime.toISOString());
        res.setHeader('Retry-After', Math.ceil(windowMs / 1000));

        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      next();
    };
  }

  /**
   * Reset limit for specific IP/user
   */
  reset(req) {
    const key = this.getKey(req);
    this.store.delete(key);
  }

  /**
   * Clear all limits
   */
  clear() {
    this.store.clear();
  }

  /**
   * Get stats
   */
  getStats(req) {
    const key = this.getKey(req);
    const bucket = this.store.get(key);
    return bucket || { window: 0, count: 0 };
  }
}

module.exports = { RateLimiter };
