/**
 * PHASE 3-7: Response Compression, Caching, Monitoring, Rate Limiting, Error Recovery
 */

const compression = require('compression');
const NodeCache = require('node-cache');

// ============================================================================
// PHASE 3: COMPRESSION & RESPONSE OPTIMIZATION
// ============================================================================

// Compression middleware with aggressive settings
const compressionMiddleware = compression({
    level: 6, // Balance between compression ratio and CPU (0-9, 6 is default)
    threshold: 1024, // Only compress responses > 1KB
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
});

// ============================================================================
// PHASE 7: RESPONSE CACHING + ETags
// ============================================================================

// Cache Store: 10-minute TTL, auto-delete expired, check expiry every 60s
const responseCache = new NodeCache({ stdTTL: 600, checkperiod: 60 });

// Cache middleware for read-only endpoints
const createCacheMiddleware = (keyPrefix, ttl = 600) => {
    return (req, res, next) => {
        // Skip caching for non-GET requests
        if (req.method !== 'GET') {
            return next();
        }

        // Generate cache key from URL + query params
        const cacheKey = `${keyPrefix}:${req.originalUrl}`;
        const cachedResponse = responseCache.get(cacheKey);

        // Return cached response if available
        if (cachedResponse) {
            res.set('X-Cache', 'HIT'); // Debugging header
            res.set('ETag', cachedResponse.etag);
            return res.json(cachedResponse.data);
        }

        // Wrap res.json() to cache responses
        const originalJson = res.json.bind(res);
        res.json = function (data) {
            const etag = require('crypto')
                .createHash('md5')
                .update(JSON.stringify(data))
                .digest('hex');

            responseCache.set(cacheKey, { data, etag }, ttl);
            res.set('X-Cache', 'MISS');
            res.set('ETag', etag);
            res.set('Cache-Control', `public, max-age=${ttl}`);
            return originalJson(data);
        };

        next();
    };
};

// Cache invalidation: Clear cache when data changes
const invalidateCache = (pattern) => {
    const keys = responseCache.keys();
    keys.forEach(key => {
        if (key.includes(pattern)) {
            responseCache.del(key);
        }
    });
};

// ============================================================================
// PHASE 5: PERFORMANCE MONITORING & METRICS
// ============================================================================

// Request timer and logging
const performanceMonitoringMiddleware = (req, res, next) => {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    // Capture original send
    const originalSend = res.send;
    res.send = function (data) {
        const duration = Date.now() - startTime;
        const memoryUsed = (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024;

        // Log slow queries (> 500ms)
        if (duration > 500) {
            console.warn(`⚠️ SLOW: ${req.method} ${req.path} - ${duration}ms`);
        }

        // Attach performance headers
        res.set('X-Response-Time', `${duration}ms`);
        res.set('X-Memory-Delta', `${memoryUsed.toFixed(2)}MB`);

        return originalSend.call(this, data);
    };

    next();
};

// Query execution logger for Mongoose
const queryPerformanceLogger = () => {
    return (req, res, next) => {
        if (!req.mongooseQuery) {
            return next();
        }

        const startTime = Date.now();
        const originalExec = req.mongooseQuery.exec;

        req.mongooseQuery.exec = async function () {
            const result = await originalExec.call(this);
            const duration = Date.now() - startTime;

            // Log slow database queries (> 200ms)
            if (duration > 200) {
                console.warn(`🐢 SLOW QUERY: ${duration}ms`);
            }

            return result;
        };

        next();
    };
};

// ============================================================================
// PHASE 4: ERROR HANDLING & RETRY LOGIC
// ============================================================================

// Exponential backoff retry decorator
const withRetry = async (fn, maxRetries = 3, baseDelay = 100) => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            if (attempt === maxRetries) {
                throw err;
            }
            const delay = baseDelay * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

// Circuit breaker for external service calls
class CircuitBreaker {
    constructor(threshold = 5, timeout = 60000) {
        this.failureCount = 0;
        this.threshold = threshold;
        this.timeout = timeout;
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.nextAttempt = Date.now();
    }

    async execute(fn) {
        if (this.state === 'OPEN') {
            if (Date.now() < this.nextAttempt) {
                throw new Error('Circuit breaker is OPEN');
            }
            this.state = 'HALF_OPEN';
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (err) {
            this.onFailure();
            throw err;
        }
    }

    onSuccess() {
        this.failureCount = 0;
        this.state = 'CLOSED';
    }

    onFailure() {
        this.failureCount++;
        if (this.failureCount >= this.threshold) {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.timeout;
            console.error(`⚠️ Circuit Breaker OPEN - Waiting ${this.timeout}ms`);
        }
    }
}

// ============================================================================
// PHASE 6: SECURITY & RATE LIMITING (Enhanced)
// ============================================================================

// Advanced rate limiting by endpoint + user
const createAdvancedRateLimiter = (options = {}) => {
    const {
        windowMs = 60000, // 1 minute
        maxRequests = 100,
        keyGenerator = (req) => req.ip
    } = options;

    const store = new Map();

    return (req, res, next) => {
        const key = keyGenerator(req);
        const now = Date.now();

        if (!store.has(key)) {
            store.set(key, []);
        }

        const requests = store.get(key);
        const cutoff = now - windowMs;
        const recentRequests = requests.filter(t => t > cutoff);

        if (recentRequests.length >= maxRequests) {
            res.status(429).json({
                error: 'Too Many Requests',
                retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000)
            });
            return;
        }

        recentRequests.push(now);
        store.set(key, recentRequests);

        // Cleanup old entries periodically
        if (Math.random() < 0.01) {
            store.forEach((reqs, k) => {
                const recent = reqs.filter(t => t > cutoff);
                if (recent.length === 0) {
                    store.delete(k);
                } else {
                    store.set(k, recent);
                }
            });
        }

        next();
    };
};

// CORS hardening
const corsHardening = (req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('X-XSS-Protection', '1; mode=block');
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.set('Content-Security-Policy', "default-src 'self'");
    next();
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Phase 3
    compressionMiddleware,

    // Phase 4
    withRetry,
    CircuitBreaker,

    // Phase 5
    performanceMonitoringMiddleware,
    queryPerformanceLogger,

    // Phase 6
    createAdvancedRateLimiter,
    corsHardening,

    // Phase 7
    createCacheMiddleware,
    invalidateCache,
    responseCache,
};
