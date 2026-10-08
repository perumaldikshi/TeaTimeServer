const db = require('./src/config/db');

async function ensureAuditColumns() {
    try {
        const queries = [
            `IF COL_LENGTH('audit_logs', 'method') IS NULL ALTER TABLE audit_logs ADD method VARCHAR(10) NULL;`,
            `IF COL_LENGTH('audit_logs', 'endpoint') IS NULL ALTER TABLE audit_logs ADD endpoint VARCHAR(255) NULL;`,
            `IF COL_LENGTH('audit_logs', 'status_code') IS NULL ALTER TABLE audit_logs ADD status_code INT NULL;`
        ];

        for (const q of queries) {
            await db.query(q);
        }
        console.log('✅ Audit table columns updated successfully!');
        process.exit(0);
    } catch (e) {
        console.error('Error updating columns:', e.message);
        process.exit(1);
    }
}

ensureAuditColumns();
