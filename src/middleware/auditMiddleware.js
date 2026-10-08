const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * Extract real client IP
 */
const getClientIp = (req) => {
    if (!req) return 'Unknown';
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || req.ip || 'Unknown';
};

/**
 * Sanitize request body to remove sensitive credentials like raw passwords
 */
const sanitizeData = (data) => {
    if (!data || typeof data !== 'object') return data;
    const clean = Array.isArray(data) ? [...data] : { ...data };
    for (const key of Object.keys(clean)) {
        if (/password|secret|token/i.test(key) && key !== 'token_version') {
            clean[key] = '[REDACTED]';
        } else if (typeof clean[key] === 'object' && clean[key] !== null) {
            clean[key] = sanitizeData(clean[key]);
        }
    }
    return clean;
};

/**
 * Map Route & Method to clear Action names
 */
const resolveAction = (method, path) => {
    const cleanPath = path.toLowerCase().replace(/^\/api/, '');

    if (cleanPath === '/login') return 'USER_LOGIN';
    if (cleanPath === '/register') return 'USER_REGISTER';
    if (cleanPath.startsWith('/order') && method === 'POST') return 'ORDER_PLACED';
    if (cleanPath.startsWith('/order') && cleanPath.includes('cancel')) return 'ORDER_CANCELLED';
    if (cleanPath.startsWith('/order') && method === 'PUT') return 'ORDER_UPDATED';
    if (cleanPath.startsWith('/order') && method === 'DELETE') return 'ORDER_DELETED';
    if (cleanPath.startsWith('/employees') && method === 'POST') return 'EMPLOYEE_CREATED';
    if (cleanPath.startsWith('/employees') && method === 'PUT') return 'EMPLOYEE_UPDATED';
    if (cleanPath.startsWith('/employees') && method === 'DELETE') return 'EMPLOYEE_DELETED';
    if (cleanPath.startsWith('/tea-items') && method === 'POST') return 'TEA_ITEM_CREATED';
    if (cleanPath.startsWith('/tea-items') && method === 'PUT') return 'TEA_ITEM_UPDATED';
    if (cleanPath.startsWith('/tea-items') && method === 'DELETE') return 'TEA_ITEM_DELETED';
    if (cleanPath.startsWith('/settings/force-toggle')) return 'ORDERING_FORCE_TOGGLED';
    if (cleanPath.startsWith('/settings')) return 'SETTINGS_UPDATED';
    if (cleanPath.startsWith('/send-notification')) return 'NOTIFICATION_SENT';
    if (cleanPath.startsWith('/download-pdf')) return 'REPORT_DOWNLOAD_PDF';
    if (cleanPath.startsWith('/download-excel')) return 'REPORT_DOWNLOAD_EXCEL';

    return `${method}_${cleanPath.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
};

/**
 * Global HTTP Audit Middleware
 */
const globalAuditMiddleware = (req, res, next) => {
    const method = req.method;
    const originalUrl = req.originalUrl || req.url;

    // Ignore static assets, health checks, Swagger docs
    if (
        originalUrl.startsWith('/api-docs') ||
        originalUrl === '/health' ||
        originalUrl.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2|ttf|map)$/)
    ) {
        return next();
    }

    // Only audit mutations (POST, PUT, DELETE, PATCH) and sensitive report downloads
    const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
    const isSensitiveGet = method === 'GET' && (originalUrl.includes('download') || originalUrl.includes('report'));

    if (!isMutation && !isSensitiveGet) {
        return next();
    }

    const startTime = Date.now();
    const clientIp = getClientIp(req);
    const userAgent = (req.headers['user-agent'] || 'Unknown').substring(0, 500);

    // Capture response completion
    res.on('finish', () => {
        // Run asynchronously so response is never blocked
        setImmediate(async () => {
            try {
                // Determine user
                let user = req.user;
                if (!user && req.headers['authorization']) {
                    const parts = req.headers['authorization'].split(' ');
                    const token = parts[1] || parts[0];
                    if (token) {
                        try {
                            user = jwt.decode(token);
                        } catch (e) {
                            // ignore decode error
                        }
                    }
                }

                // If login/register, check body for identity
                let performerId = user?.id || null;
                let performerName = user?.name || (req.body?.email ? `Email: ${req.body.email}` : 'Anonymous');
                let performerEmail = user?.email || (req.body?.email ? req.body.email.trim().toLowerCase() : null);

                const action = resolveAction(method, originalUrl);
                const sanitizedBody = sanitizeData(req.body);
                const sanitizedQuery = sanitizeData(req.query);

                const details = JSON.stringify({
                    body: sanitizedBody,
                    query: sanitizedQuery,
                    durationMs: Date.now() - startTime
                });

                // Console visual badge
                const statusColor = res.statusCode < 400 ? '\x1b[32m' : '\x1b[31m';
                console.log(
                    `\x1b[44m\x1b[37m[AUDIT]\x1b[0m \x1b[33m${action.padEnd(22)}\x1b[0m ${statusColor}${res.statusCode}\x1b[0m | IP: \x1b[36m${clientIp}\x1b[0m | User: \x1b[32m${performerName}\x1b[0m`
                );

                // Insert into audit_logs table
                await db.query(
                    `INSERT INTO audit_logs (
                        action, method, endpoint, status_code,
                        performed_by_id, performed_by_name, performed_by_email,
                        ip_address, user_agent, details
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [
                        action,
                        method,
                        originalUrl.substring(0, 255),
                        res.statusCode,
                        performerId,
                        performerName,
                        performerEmail,
                        clientIp,
                        userAgent,
                        details
                    ]
                );
            } catch (err) {
                // Silently log error, do not crash server
                console.error('Audit middleware error:', err.message);
            }
        });
    });

    next();
};

module.exports = globalAuditMiddleware;
