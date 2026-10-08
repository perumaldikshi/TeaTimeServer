const db = require('./src/config/db');

async function showAuditLogs() {
    console.log('\n===============================================================');
    console.log('       🛡️  TEA TIME - SECURITY & AUDIT LOGS INSPECTOR          ');
    console.log('===============================================================\n');

    try {
        const result = await db.query(`
            SELECT TOP 50
                id,
                action,
                method,
                endpoint,
                status_code,
                target_user_id,
                target_user_name,
                target_user_email,
                performed_by_id,
                performed_by_name,
                performed_by_email,
                ip_address,
                user_agent,
                details,
                created_at
            FROM audit_logs
            ORDER BY id DESC
        `);

        if (result.rows.length === 0) {
            console.log('ℹ️  Tharpodhu pudhiya audit logs edhuvum illai (No audit logs recorded yet).');
            console.log('💡 Inimel website-la yaru enna seithalum:');
            console.log('   -> IP Address, Username, Action, Endpoint, Time ellame thaanaga inge save aagum!\n');
            process.exit(0);
        }

        console.log(`📋 Total Audit Records Found: ${result.rows.length}\n`);

        result.rows.forEach(log => {
            console.log(`---------------------------------------------------------------`);
            console.log(`🆔 Log ID:        #${log.id}`);
            console.log(`⚡ Action:        ${log.action}`);
            if (log.method || log.endpoint) {
                console.log(`📡 Route/Status:  [${log.method || 'REQ'}] ${log.endpoint || '-'} -> Status: ${log.status_code || 200}`);
            }
            console.log(`🕒 Timestamp:     ${new Date(log.created_at).toLocaleString()}`);
            console.log(`🌐 System IP:     ${log.ip_address || 'Unknown'}`);
            console.log(`👤 Performed By:  ${log.performed_by_name || 'N/A'} (${log.performed_by_email || 'N/A'})`);
            if (log.target_user_name || log.target_user_email) {
                console.log(`🎯 Target User:   ${log.target_user_name || 'N/A'} (${log.target_user_email || 'N/A'})`);
            }
            console.log(`💻 Device/Agent:  ${log.user_agent ? log.user_agent.substring(0, 80) : 'N/A'}`);
            if (log.details) {
                console.log(`📝 Details:       ${log.details.substring(0, 200)}${log.details.length > 200 ? '...' : ''}`);
            }
        });

        console.log(`---------------------------------------------------------------\n`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Error fetching audit logs:', err.message);
        process.exit(1);
    }
}

showAuditLogs();
