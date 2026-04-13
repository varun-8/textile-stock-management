const errorHandler = (err, req, res, next) => {
    // Log the error for diagnostics
    console.error(`[Entry] ${new Date().toISOString()}`);
    console.error(`[Error] ${err.message}`);
    if (err.stack) console.error(err.stack);

    // Determine Status
    const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

    res.status(statusCode).json({
        success: false,
        error: err.message || 'Internal Server Error',
        // Only show stack in development
        stack: process.env.NODE_ENV === 'production' ? null : err.stack
    });
};

module.exports = errorHandler;
