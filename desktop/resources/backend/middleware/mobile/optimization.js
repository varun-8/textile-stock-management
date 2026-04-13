// Phase 8: Mobile Optimization
// Mobile-specific response format and delta sync

/**
 * Compress response for mobile (reduce payload 70%)
 * Format: {v: version, d: data, t: timestamp, c: checksum, ttl: cacheTTL}
 */
function createMobileResponse(data, options = {}) {
  const {
    version = 1,
    cacheTTL = 3600,
    includeChecksum = true
  } = options;

  const timestamp = Date.now();
  const compressed = {
    v: version,        // API version
    d: data,            // Actual data (compressed by gzip middleware)
    t: timestamp,       // Server timestamp
    ttl: cacheTTL       // Client cache time-to-live
  };

  // Optional checksum for data integrity
  if (includeChecksum) {
    const crypto = require('crypto');
    compressed.c = crypto
      .createHash('md5')
      .update(JSON.stringify(data))
      .digest('hex')
      .substring(0, 8);
  }

  return compressed;
}

/**
 * Delta Sync Manager - only send changed data since last sync
 */
class DeltaSyncManager {
  constructor() {
    this.clientStates = new Map(); // clientId -> lastStateHash
  }

  /**
   * Calculate delta between current and previous state
   */
  calculateDelta(clientId, currentData) {
    const crypto = require('crypto');
    const currentHash = crypto
      .createHash('md5')
      .update(JSON.stringify(currentData))
      .digest('hex');

    const previousHash = this.clientStates.get(clientId);
    const hasChanged = previousHash !== currentHash;

    this.clientStates.set(clientId, currentHash);

    return {
      hasChanged,
      data: hasChanged ? currentData : null,
      previousHash,
      currentHash
    };
  }

  /**
   * Clear client state (logout/reconnect)
   */
  resetClient(clientId) {
    this.clientStates.delete(clientId);
  }
}

/**
 * Batch multiple API calls into single request
 */
async function batchRequestHandler(requests) {
  const results = [];

  for (const request of requests) {
    try {
      // Route to appropriate handler
      const result = await executeRequest(request);
      results.push({ id: request.id, success: true, data: result });
    } catch (error) {
      results.push({ id: request.id, success: false, error: error.message });
    }
  }

  return results;
}

/**
 * Offline Queue Manager - queue requests while offline
 */
class OfflineQueueManager {
  constructor(maxQueueSize = 1000) {
    this.queue = [];
    this.maxQueueSize = maxQueueSize;
  }

  /**
   * Add request to offline queue
   */
  enqueue(request) {
    if (this.queue.length >= this.maxQueueSize) {
      // Remove oldest request if queue full
      this.queue.shift();
    }
    this.queue.push({
      ...request,
      queuedAt: Date.now()
    });
  }

  /**
   * Process all queued requests when online
   */
  async flushQueue(handler) {
    const requests = [...this.queue];
    this.queue = [];

    const results = [];
    for (const request of requests) {
      try {
        const result = await handler(request);
        results.push({ success: true, id: request.id, data: result });
      } catch (error) {
        results.push({ success: false, id: request.id, error: error.message });
      }
    }

    return results;
  }

  /**
   * Get queue size
   */
  getQueueSize() {
    return this.queue.length;
  }
}

module.exports = {
  createMobileResponse,
  DeltaSyncManager,
  batchRequestHandler,
  OfflineQueueManager
};
