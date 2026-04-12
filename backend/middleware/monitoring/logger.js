// Request & Response Logging
// Structured logging for debugging and monitoring

const logger = (req, res, next) => {
  const start = Date.now();

  // Log request
  console.log(`📨 [${new Date().toISOString()}] ${req.method} ${req.path}`);

  // Override res.send to log response
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const color = status >= 400 ? '❌' : status >= 300 ? '⚠️' : '✅';
    
    console.log(`${color} [${status}] ${duration}ms`);
    res.send = originalSend;
    return res.send(data);
  };

  next();
};

module.exports = { logger };
