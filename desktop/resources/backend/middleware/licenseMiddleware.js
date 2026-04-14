const { getLicenseStatus, isLicenseRequired } = require('../services/licenseService');

const ALLOWED_PREFIXES = [
    '/api/license',
    '/api/auth',
    '/api/admin/server-ip',
    '/pwa'
];

const isAllowedPath = (pathname = '') => {
    return ALLOWED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
};

const requireLicense = (req, res, next) => {
    if (!isLicenseRequired()) {
        return next();
    }

    if (isAllowedPath(req.path || req.originalUrl || '')) {
        return next();
    }

    const status = getLicenseStatus();
    if (status.active) {
        return next();
    }

    return res.status(402).json({
        error: 'License activation required',
        license: status
    });
};

module.exports = {
    requireLicense
};
