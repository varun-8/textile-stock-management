// Phase 4: Error Handling & Recovery Middleware
// Graceful error handling with retry logic and detailed logging

const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', {
    path: req.path,
    method: req.method,
    message: err.message,
    code: err.code,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  // MongoDB connection errors
  if (err.name === 'MongoServerError') {
    return res.status(503).json({
      error: 'Database connection failed',
      retryable: true,
      retryAfter: 5000
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: Object.values(err.errors).map(e => e.message)
    });
  }

  // Default server error
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal server error',
    requestId: req.id
  });
};

module.exports = { errorHandler };
