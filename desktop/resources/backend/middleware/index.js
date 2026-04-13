// Middleware exports - Core layer
module.exports = {
  // Core middleware
  compression: require('./core/compression'),
  security: require('./core/security'),
  errorHandler: require('./core/errorHandler'),
  
  // Monitoring
  performance: require('./monitoring/performance'),
  logger: require('./monitoring/logger'),
  
  // Caching & Pagination
  cache: require('./caching/responseCache'),
  pagination: require('./caching/paginator'),
  
  // Mobile
  mobile: require('./mobile/optimization')
};
