// Phase 5: Performance Monitoring Middleware
// Tracks response times, memory usage, and identifies slow queries

const performanceMonitoring = (req, res, next) => {
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed;

  // Intercept res.json() to track response time
  const originalJson = res.json.bind(res);
  res.json = function (data) {
    const duration = Date.now() - startTime;
    const memoryDelta = process.memoryUsage().heapUsed - startMemory;

    // Log slow requests (> 500ms)
    if (duration > 500) {
      console.warn(`⚠️ SLOW REQUEST: ${req.method} ${req.path} - ${duration}ms`);
    }

    // Add performance headers
    res.setHeader('X-Response-Time', `${duration}ms`);
    res.setHeader('X-Memory-Delta', `${Math.round(memoryDelta / 1024)}KB`);
    res.setHeader('X-DB-Time', req.dbTime || '0ms');

    return originalJson(data);
  };

  next();
};

module.exports = { performanceMonitoring };
