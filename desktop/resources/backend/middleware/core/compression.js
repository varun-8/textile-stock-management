// Phase 3: Compression Middleware
// Reduces payload size by 75% using gzip compression

const compression = require('compression');

/**
 * Initialize compression middleware with optimized settings
 * @returns {Function} Express middleware
 */
function initCompressionMiddleware() {
  return compression({
    level: 6, // Balanced: 75% reduction, minimal CPU overhead
    threshold: 1024, // Only compress payloads > 1KB
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    }
  });
}

module.exports = { initCompressionMiddleware };
