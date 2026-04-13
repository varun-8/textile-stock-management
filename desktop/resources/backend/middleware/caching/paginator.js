// Phase 3: Advanced Pagination
// Handles large datasets with cursor-based pagination

/**
 * Cursor-based pagination query builder
 * @param {Model} Model - Mongoose model
 * @param {Object} query - Query filter
 * @param {Object} options - {cursor, limit, sortBy, sortOrder}
 * @returns {Promise<Array>} Paginated results with next cursor
 */
async function buildPaginatedQuery(Model, query = {}, options = {}) {
  const {
    cursor = null,
    limit = 50,
    sortBy = '_id',
    sortOrder = 1,
    lean = true
  } = options;

  // Max limit safety
  const actualLimit = Math.min(limit, 500);

  let dbQuery = Model.find(query);
  let sortObj = { [sortBy]: sortOrder };

  // Use cursor if provided (pagination marker)
  if (cursor) {
    if (sortOrder === 1) {
      dbQuery = dbQuery.where(sortBy).gt(cursor);
    } else {
      dbQuery = dbQuery.where(sortBy).lt(cursor);
    }
  }

  // Fetch limit + 1 to determine if more results exist
  let results = await dbQuery
    .sort(sortObj)
    .limit(actualLimit + 1)
    .lean(lean)
    .exec();

  const hasMore = results.length > actualLimit;
  results = results.slice(0, actualLimit);

  const nextCursor = hasMore && results.length > 0 
    ? results[results.length - 1][sortBy] 
    : null;

  return {
    results,
    nextCursor,
    hasMore,
    count: results.length
  };
}

/**
 * Stream large query results to prevent memory overload
 */
async function streamQueryResults(Model, query, onBatch, batchSize = 100) {
  let processed = 0;
  let skip = 0;

  while (true) {
    const batch = await Model.find(query)
      .skip(skip)
      .limit(batchSize)
      .lean()
      .exec();

    if (batch.length === 0) break;

    await onBatch(batch);
    processed += batch.length;
    skip += batchSize;
  }

  return processed;
}

/**
 * Auto-paginate middleware for large responses
 */
const autoPaginateMiddleware = (req, res, next) => {
  res.setHeader('X-Pagination-Enabled', 'true');
  
  // Store pagination params in request
  req.pagination = {
    cursor: req.query.cursor || null,
    limit: Math.min(parseInt(req.query.limit) || 50, 500),
    page: parseInt(req.query.page) || 1,
    skip: (parseInt(req.query.page) - 1) * 50
  };

  next();
};

module.exports = {
  buildPaginatedQuery,
  streamQueryResults,
  autoPaginateMiddleware
};
