/**
 * PHASE 8: MOBILE APP OPTIMIZATION
 * Reduces API calls, implements local caching, offline support
 */

/**
 * Mobile API response format - Stripped down, minimal payload
 */
const createMobileResponse = (data, options = {}) => {
    const {
        timestamp = new Date().toISOString(),
        cached = false,
        ttl = 300, // seconds
        version = 1
    } = options;

    return {
        v: version, // API version
        d: data, // data
        t: timestamp, // timestamp
        c: cached, // cached flag
        ttl // time-to-live in seconds
    };
};

/**
 * Batch API endpoint - Combine multiple requests into one
 * Reduces HTTP overhead for mobile apps
 * Example: POST /api/mobile/batch
 * Body: { requests: [{method: 'GET', path: '/scanners'}, {method: 'GET', path: '/missing-scans'}] }
 */
const batchRequestHandler = async (requests, authenticator) => {
    const results = [];

    for (const req of requests) {
        try {
            // Simulate request processing
            const result = await processRequest(req, authenticator);
            results.push({
                path: req.path,
                status: 200,
                data: result,
                error: null
            });
        } catch (err) {
            results.push({
                path: req.path,
                status: err.status || 500,
                data: null,
                error: err.message
            });
        }
    }

    return results;
};

/**
 * Delta sync - Send only changed data since last sync
 * Reduces bandwidth significantly for mobile
 */
class DeltaSyncManager {
    constructor(storeKey = 'lastSyncTime') {
        this.storeKey = storeKey;
        this.lastSyncs = new Map(); // scannerId -> timestamp
    }

    // Client stores last sync time
    getLastSyncTime(clientId) {
        return this.lastSyncs.get(clientId) || 0;
    }

    // Server returns only records changed since last sync
    async getDelta(Model, clientId, query = {}) {
        const lastSyncTime = this.getLastSyncTime(clientId);
        const now = Date.now();

        const deltaQuery = {
            ...query,
            updatedAt: { $gte: new Date(lastSyncTime) }
        };

        const changedRecords = await Model.find(deltaQuery).lean();
        this.lastSyncs.set(clientId, now);

        return {
            records: changedRecords,
            syncTime: now,
            count: changedRecords.length
        };
    }

    invalidateSync(clientId) {
        this.lastSyncs.delete(clientId);
    }
}

/**
 * Request deduplication for mobile - Prevent duplicate requests
 * Client sends unique request ID, server skips if already processed
 */
class MobileRequestDeduplicator {
    constructor(ttl = 600000) {
        // ttl: 10 minutes
        this.processed = new Map(); // requestId -> result
        this.ttl = ttl;
    }

    register(requestId, result) {
        this.processed.set(requestId, {
            result,
            timestamp: Date.now()
        });

        // Cleanup old entries
        if (this.processed.size > 10000) {
            const cutoff = Date.now() - this.ttl;
            this.processed.forEach((val, key) => {
                if (val.timestamp < cutoff) {
                    this.processed.delete(key);
                }
            });
        }
    }

    isDuplicate(requestId) {
        if (!this.processed.has(requestId)) return false;

        const entry = this.processed.get(requestId);
        if (Date.now() - entry.timestamp > this.ttl) {
            this.processed.delete(requestId);
            return false;
        }

        return true;
    }

    getResult(requestId) {
        return this.processed.get(requestId)?.result;
    }
}

/**
 * Data compression format for mobile - Binary/Protobuf alternative
 * For extreme bandwidth optimization
 */
const compressForMobile = (data) => {
    // Simple compression: remove nulls, use short keys
    const compressed = JSON.stringify(data)
        .replace(/:null,/g, ':,')
        .replace(/:null}/g, ':}');

    return {
        compressed: Buffer.from(compressed).toString('base64'),
        originalSize: JSON.stringify(data).length,
        compressedSize: compressed.length,
        ratio: ((1 - compressed.length / JSON.stringify(data).length) * 100).toFixed(2)
    };
};

/**
 * Offline queue manager for mobile app
 * Store requests made while offline, sync when online
 */
class OfflineQueueManager {
    constructor() {
        this.queue = [];
        this.maxQueueSize = 100;
    }

    enqueue(request) {
        if (this.queue.length >= this.maxQueueSize) {
            // Remove oldest
            this.queue.shift();
        }

        this.queue.push({
            ...request,
            queuedAt: Date.now()
        });
    }

    async flushQueue(apiClient) {
        const itemsToSync = [...this.queue];
        this.queue = [];

        const results = [];
        for (const item of itemsToSync) {
            try {
                const result = await apiClient.request(item.method, item.path, item.data);
                results.push({ success: true, item, result });
            } catch (err) {
                // Re-queue failed items
                this.enqueue(item);
                results.push({ success: false, item, error: err });
            }
        }

        return results;
    }

    getQueueSize() {
        return this.queue.length;
    }

    clearQueue() {
        this.queue = [];
    }
}

/**
 * Image optimization for mobile - Auto-compress and resize
 */
const optimizeImageForMobile = (imageUrl, options = {}) => {
    const {
        width = 400,
        height = 400,
        quality = 75,
        format = 'webp'
    } = options;

    // In production, use a service like Cloudinary or ImageOptim
    // This is a template showing how to handle it
    return {
        original: imageUrl,
        optimized: `${imageUrl}?w=${width}&h=${height}&q=${quality}&f=${format}`,
        estimatedSize: Math.round((imageUrl.length * quality) / 100)
    };
};

module.exports = {
    createMobileResponse,
    batchRequestHandler,
    DeltaSyncManager,
    MobileRequestDeduplicator,
    compressForMobile,
    OfflineQueueManager,
    optimizeImageForMobile
};
