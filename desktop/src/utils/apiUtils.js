import axios from 'axios';

/**
 * Exponential backoff retry utility
 * Retries a function with exponential backoff on failure
 * @param {Function} asyncFn - Async function to execute
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @param {number} initialDelayMs - Initial delay in milliseconds (default: 300)
 * @returns {Promise} Result of the async function
 */
export async function withExponentialBackoff(asyncFn, maxRetries = 3, initialDelayMs = 300) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await asyncFn();
        } catch (error) {
            lastError = error;
            
            // Don't retry on client errors (4xx) except for 429 (Too Many Requests)
            if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 429) {
                throw error;
            }
            
            // If this was the last attempt, throw the error
            if (attempt === maxRetries) {
                break;
            }
            
            // Calculate delay with exponential backoff: 300ms, 600ms, 1200ms
            const delayMs = initialDelayMs * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    
    throw lastError;
}

/**
 * Cached axios GET with TTL
 * @param {string} url - URL to fetch
 * @param {Object} config - Axios config
 * @param {number} ttlMs - Time to live in milliseconds (default: 5000)
 * @returns {Promise} Axios response
 */
const requestCache = new Map();

export async function cachedAxiosGet(url, config = {}, ttlMs = 5000) {
    const cacheKey = `${url}_${JSON.stringify(config)}`;
    const cached = requestCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < ttlMs) {
        return cached.data;
    }
    
    const response = await axios.get(url, config);
    
    requestCache.set(cacheKey, {
        data: response,
        timestamp: Date.now()
    });
    
    // Clean up old cache entries periodically
    if (requestCache.size > 100) {
        const now = Date.now();
        for (const [key, value] of requestCache.entries()) {
            if (now - value.timestamp > ttlMs * 2) {
                requestCache.delete(key);
            }
        }
    }
    
    return response;
}
