// Phase 4: Retry Logic with Exponential Backoff
// Handles transient failures automatically

/**
 * Retry decorator with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} baseDelay - Initial delay in ms (doubles each retry)
 * @returns {Function} Wrapped function with retry logic
 */
async function withRetry(fn, maxRetries = 3, baseDelay = 100) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) break;

      // Calculate exponential backoff: baseDelay * 2^attempt
      const delay = baseDelay * Math.pow(2, attempt);
      const jitter = Math.random() * delay * 0.1; // 10% jitter to avoid thundering herd

      console.warn(
        `⚠️ Retry ${attempt + 1}/${maxRetries} after ${delay + jitter}ms`,
        error.message
      );

      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }

  throw lastError;
}

/**
 * Advanced retry with custom conditions
 */
async function retryWithCondition(
  fn,
  shouldRetry,
  maxRetries = 3,
  baseDelay = 100
) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();

      // Check if we should retry based on result
      if (shouldRetry(result)) {
        throw new Error('Retry condition met');
      }

      return result;
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) break;

      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

module.exports = {
  withRetry,
  retryWithCondition
};
