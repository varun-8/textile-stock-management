// Phase 4: Circuit Breaker Pattern
// Prevents cascading failures by stopping requests to failing services

/**
 * Circuit Breaker States:
 * CLOSED - requests pass through normally
 * OPEN - requests fail immediately (fast-fail)
 * HALF_OPEN - limited requests allowed to test if service recovered
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 60000; // 60 seconds
    this.name = options.name || 'Circuit';

    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute(fn) {
    if (this.state === 'OPEN') {
      // Check if timeout has passed
      if (Date.now() > this.nextAttemptTime) {
        this.state = 'HALF_OPEN';
        this.successes = 0;
        console.log(`🔄 [${this.name}] Circuit HALF_OPEN - testing recovery`);
      } else {
        const waitTime = Math.ceil((this.nextAttemptTime - Date.now()) / 1000);
        throw new Error(
          `🔴 [${this.name}] Circuit OPEN - wait ${waitTime}s (${this.failures} failures)`
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful request
   */
  onSuccess() {
    this.failures = 0;

    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.state = 'CLOSED';
        console.log(`✅ [${this.name}] Circuit CLOSED - service recovered`);
      }
    }
  }

  /**
   * Handle failed request
   */
  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.timeout;
      console.log(`🔴 [${this.name}] Circuit OPEN - ${this.failures} failures detected`);
    }
  }

  /**
   * Get circuit state
   */
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime
    };
  }

  /**
   * Reset circuit manually
   */
  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    console.log(`🔄 [${this.name}] Circuit reset to CLOSED`);
  }
}

module.exports = { CircuitBreaker };
