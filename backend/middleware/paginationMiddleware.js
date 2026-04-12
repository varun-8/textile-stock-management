/**
 * PHASE 3: PAGINATION & DATASET OPTIMIZATION
 * Reduces memory usage and bandwidth for large result sets
 */

/**
 * Pagination middleware factory
 * Implements efficient cursor-based or offset-based pagination
 */
const paginationMiddleware = (defaultPageSize = 50, maxPageSize = 500) => {
    return (req, res, next) => {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(
            maxPageSize,
            parseInt(req.query.limit) || defaultPageSize
        );
        const skip = (page - 1) * limit;

        // Attach pagination info to request
        req.pagination = { page, limit, skip };

        // Wrap res.json to automatically add pagination metadata
        const originalJson = res.json.bind(res);
        res.json = function (data) {
            if (Array.isArray(data)) {
                // If data is array, add pagination info
                const total = req.totalCount || data.length;
                const totalPages = Math.ceil(total / limit);

                return originalJson({
                    data,
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages,
                        hasMore: page < totalPages
                    }
                });
            }

            // If not array, return as-is
            return originalJson(data);
        };

        next();
    };
};

/**
 * Query builder for efficient pagination with Mongoose
 */
const buildPaginatedQuery = async (Model, query = {}, options = {}) => {
    const {
        pagination = { limit: 50, skip: 0 },
        sort = { createdAt: -1 },
        select = null,
        lean = false
    } = options;

    // Get total count
    const total = await Model.countDocuments(query);

    // Build query
    let queryBuilder = Model.find(query);

    if (select) queryBuilder = queryBuilder.select(select);
    if (sort) queryBuilder = queryBuilder.sort(sort);
    if (lean) queryBuilder = queryBuilder.lean();

    // Apply pagination
    queryBuilder = queryBuilder.skip(pagination.skip).limit(pagination.limit);

    const data = await queryBuilder;

    return {
        data,
        total,
        page: Math.floor(pagination.skip / pagination.limit) + 1,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit)
    };
};

/**
 * Stream large result sets for minimal memory usage
 * Useful for CSV exports, large reports, bulk operations
 */
const streamQueryResults = async (Model, query = {}, options = {}) => {
    const { select = null, sort = { createdAt: -1 }, batchSize = 1000 } = options;

    let queryBuilder = Model.find(query);
    if (select) queryBuilder = queryBuilder.select(select);
    if (sort) queryBuilder = queryBuilder.sort(sort);

    return queryBuilder.cursor({ batchSize }).exec();
};

/**
 * Efficient counting without fetching data
 */
const getCount = async (Model, query = {}) => {
    return await Model.countDocuments(query);
};

/**
 * Aggregation pipeline optimizer for complex queries
 */
const createOptimizedAggregation = (pipeline = []) => {
    return [
        // Stage 1: Match - filter early to reduce document processing
        ...pipeline.filter(stage => stage.$match),

        // Stage 2: Project early - Select only needed fields
        ...pipeline.filter(stage => stage.$project),

        // Stage 3: Group/Sort operations
        ...pipeline.filter(stage => stage.$group || stage.$sort),

        // Stage 4: Remaining stages
        ...pipeline.filter(
            stage =>
                !stage.$match && !stage.$project && !stage.$group && !stage.$sort
        ),

        // Stage 5: Limit/Skip at the end
        ...pipeline.filter(stage => stage.$limit || stage.$skip)
    ];
};

/**
 * Auto-pagination for API responses
 * Detects if data should be paginated based on size
 */
const autoPaginate = (req, res, next) => {
    const dataSizeThreshold = 1024 * 100; // 100KB
    let dataSize = 0;

    const originalJson = res.json.bind(res);
    res.json = function (data) {
        if (Array.isArray(data)) {
            dataSize = JSON.stringify(data).length;

            // If response > 100KB, enforce pagination
            if (dataSize > dataSizeThreshold && !req.query.limit) {
                return originalJson({
                    error: 'Dataset too large. Please use pagination.',
                    hint: 'Add ?page=1&limit=50 to your request',
                    dataSize,
                    maxUnpaginatedSize: dataSizeThreshold
                });
            }
        }

        return originalJson(data);
    };

    next();
};

module.exports = {
    paginationMiddleware,
    buildPaginatedQuery,
    streamQueryResults,
    getCount,
    createOptimizedAggregation,
    autoPaginate
};
