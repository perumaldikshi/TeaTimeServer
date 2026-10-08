const db = require('../config/db');

/**
 * Extract real client IP address from Express request
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
 * Record an audit event into audit_logs table
 */
const logAuditEvent = async ({
    req,
    action,
    targetUserId = null,
    targetUserName = null,
    targetUserEmail = null,
    performedBy = null, // { id, name, email }
    details = null
}) => {
    try {
        const ipAddress = getClientIp(req);
        const userAgent = req?.headers ? (req.headers['user-agent'] || 'Unknown').substring(0, 500) : 'Server Script';

        const performerId = performedBy?.id || req?.user?.id || null;
        const performerName = performedBy?.name || req?.user?.name || (req?.user ? `User #${req.user.id}` : 'Anonymous/Direct Script');
        const performerEmail = performedBy?.email || req?.user?.email || null;

        const detailsStr = typeof details === 'object' ? JSON.stringify(details) : (details || null);

        // Print security notice in console
        console.log(`\x1b[41m\x1b[37m[AUDIT ALERT]\x1b[0m Action: \x1b[33m${action}\x1b[0m | IP: \x1b[36m${ipAddress}\x1b[0m | By: \x1b[32m${performerName} (${performerEmail || 'N/A'})\x1b[0m -> Target: ${targetUserName || targetUserEmail || targetUserId || 'N/A'}`);

        // Insert into database audit_logs table
        await db.query(
            `INSERT INTO audit_logs (
                action, target_user_id, target_user_name, target_user_email,
                performed_by_id, performed_by_name, performed_by_email,
                ip_address, user_agent, details
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
                action,
                targetUserId,
                targetUserName,
                targetUserEmail,
                performerId,
                performerName,
                performerEmail,
                ipAddress,
                userAgent,
                detailsStr
            ]
        );
    } catch (err) {
        console.error('Failed to write audit log:', err.message);
    }
};

module.exports = {
    getClientIp,
    logAuditEvent
};
